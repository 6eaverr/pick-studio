// AI 원고 생성 (기존 lib/ 의 조사·작성·셀프 리뷰·사진 매칭을 그대로 쓰고, 결과를 DB 의 Magazine/Card/Source 로 저장)
//
// 흐름: generate(웹 조사 + 원고) → review(말투 셀프 리뷰) → validateContent → 카드 5~8장 맞춤 → photos(곡별 사진) → save
// - 이 서버 PC 에 로그인된 Claude Code / Codex CLI 구독을 씁니다(API 키·과금 없음). 다른 PC 에 배포하면 동작하지 않습니다.
// - CLI 는 한 번에 하나만 실행(동시 요청은 409 AI_BUSY). 작업 상태는 메모리에 두고, 만든 사람만 조회할 수 있습니다.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { HttpError, notFound } from '../lib/http-error.mjs';
import { mapContent } from '../lib/legacy-map.mjs';
import { CARD_MIN, CARD_MAX } from '../lib/rules.mjs';
import { DATA } from '../lib/paths.mjs';

export const AI_MODELS = [
  { id: 'claude-sonnet', label: 'Claude Sonnet · 균형', provider: 'claude' },
  { id: 'claude-opus', label: 'Claude Opus · 정밀', provider: 'claude' },
  { id: 'claude-haiku', label: 'Claude Haiku · 빠름', provider: 'claude' },
  { id: 'gpt-6-astra', label: 'GPT-6 Astra · 정밀', provider: 'codex' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra · 균형', provider: 'codex' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna · 빠름', provider: 'codex' },
];
export const HOOKS = ['balanced', 'bold', 'calm'];

// AI 가 정한 장수가 규칙(5~8장)과 다를 때: 많으면 앞쪽 + 마지막 장(마무리)을 남기고, 모자라면 실패
export function fitCardCount(content) {
  const n = content.cards.length;
  if (n < CARD_MIN) throw new Error(`AI가 카드를 ${n}장만 만들었습니다(규칙 ${CARD_MIN}~${CARD_MAX}장). 다시 시도하세요.`);
  if (n <= CARD_MAX) return content;
  return { ...content, cards: [...content.cards.slice(0, CARD_MAX - 1), content.cards[n - 1]] };
}

// 실제 lib/ 기능 연결 (테스트에서는 가짜 함수로 바꿔 끼움)
async function defaultDeps() {
  const [{ claudeStatus, claudeModels, generate: generateClaude }, { codexStatus, generate: generateCodex }, { reviewCards }, { matchPhotos }, { validateContent }, { saveImage }, { createMagazine }] = await Promise.all([
    import('../lib/claude.mjs'), import('../lib/codex.mjs'), import('../lib/review.mjs'), import('../lib/photos.mjs'),
    import('../lib/content.mjs'), import('./asset.service.mjs'), import('./magazine.service.mjs'),
  ]);
  const workdir = path.join(DATA, 'jobs');
  mkdirSync(workdir, { recursive: true });
  return {
    async status() {
      const [claude, codex] = await Promise.all([claudeStatus(), codexStatus()]);
      const usable = { claude: claude.loggedIn && claude.method === 'Claude 구독', codex: codex.loggedIn && codex.method === 'ChatGPT' };
      return {
        claude: { installed: claude.installed, loggedIn: claude.loggedIn, usable: usable.claude },
        codex: { installed: codex.installed, loggedIn: codex.loggedIn, usable: usable.codex },
        models: AI_MODELS.map(m => ({ ...m, available: usable[m.provider] })),
      };
    },
    generate: (p, onProgress) => (claudeModels[p.model] ? generateClaude : generateCodex)(p.keyword, p.count, p.type === 'ISSUE' ? 'news' : 'curation', p.model, workdir, onProgress, p.template, p.hook, null),
    review: (content, onProgress) => reviewCards(content, workdir, onProgress),
    validate: content => validateContent(content),
    photos: (content, onProgress) => matchPhotos(content, saveImage, onProgress),
    save: (userId, m) => createMagazine(userId, m.magazine, m.cards, m.sources),
  };
}

// 배포 서버(Vercel)에는 Codex / Claude Code CLI 가 없으므로 AI 생성을 끄고 이유를 알려 줌
export const HOSTED_REASON = '배포된 사이트(Vercel)에서는 AI 원고 생성을 쓸 수 없습니다. 프로젝트를 PC에서 npm start 로 실행하면 사용할 수 있어요. 직접 작성은 그대로 됩니다.';

export function createAiService(depsFactory = defaultDeps, { hosted = !!process.env.VERCEL } = {}) {
  const jobs = new Map();
  let depsPromise, statusCache;
  if (hosted) {
    statusCache = { at: Infinity, value: { hosted: true, reason: HOSTED_REASON, models: AI_MODELS.map(m => ({ ...m, available: false })) } };
  }
  const deps = () => (depsPromise ??= depsFactory());
  const view = ({ userId, ...job }) => job;

  function prune() {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, j] of jobs) if (j.status !== 'running' && j.startedAt < hourAgo) jobs.delete(id);
  }

  async function run(job, params) {
    const d = await deps();
    const step = message => { job.message = message; };
    try {
      step('AI 연결을 확인하고 있습니다…');
      let content = await d.generate(params, step);
      content = await d.review(content, step);
      // 화면에서 고른 템플릿을 쓰고, 서버 규칙(길이·출처 형식)으로 다시 검사
      content = fitCardCount(d.validate({ ...content, template: params.template }));
      if (!content.sources.length) throw new Error('확인 가능한 원문 출처를 찾지 못했습니다. 더 구체적인 키워드로 다시 시도하세요.');
      job.warnings = (await d.photos(content, step)) || [];
      step('매거진으로 저장하고 있습니다…');
      const saved = await d.save(job.userId, mapContent(content, { type: params.type }));
      Object.assign(job, { status: 'done', message: '원고가 준비됐습니다.', magazineId: saved.id, finishedAt: Date.now() });
    } catch (err) {
      Object.assign(job, { status: 'error', error: err.message || 'AI 원고 생성에 실패했습니다.', finishedAt: Date.now() });
    }
  }

  return {
    // 사용 가능한 모델 (CLI 상태 확인은 느리므로 1분 캐시)
    async status() {
      if (!statusCache || Date.now() - statusCache.at > 60_000) statusCache = { at: Date.now(), value: await (await deps()).status() };
      return statusCache.value;
    },
    async start(userId, params) {
      prune();
      if ([...jobs.values()].some(j => j.status === 'running')) {
        throw new HttpError(409, 'AI_BUSY', '다른 AI 원고 생성이 진행 중입니다. 끝난 뒤 다시 시도하세요(한 번에 하나씩 실행).');
      }
      const status = await this.status();
      const model = status.models.find(m => m.id === params.model);
      if (!model?.available) {
        throw new HttpError(503, 'AI_UNAVAILABLE', status.hosted ? HOSTED_REASON : model?.provider === 'codex'
          ? 'Codex(ChatGPT) 로그인이 필요합니다. 서버 PC 에서 AI 연결.cmd 를 실행하세요.'
          : 'Claude 구독 로그인이 필요합니다. 서버 PC 터미널에서 claude auth login 을 실행하세요.');
      }
      const job = { id: randomUUID(), userId, status: 'running', message: '준비 중…', model: params.model, keyword: params.keyword, startedAt: Date.now() };
      jobs.set(job.id, job);
      run(job, params); // 응답은 바로 돌려주고 뒤에서 진행
      return view(job);
    },
    // 만든 사람만 조회 가능 (다른 사용자에게는 없는 것처럼 404)
    get(userId, id) {
      const job = jobs.get(id);
      if (!job || job.userId !== userId) throw notFound('작업을 찾을 수 없습니다.');
      return view(job);
    },
  };
}

export const ai = createAiService();
