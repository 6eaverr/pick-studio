import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiService, fitCardCount } from '../services/ai.service.mjs';
import { checkGenerate, checkJobId } from '../validators/ai.validator.mjs';
import { mapContent } from '../lib/legacy-map.mjs';

// AI 가 돌려준다고 가정한 원고 (기존 lib/content.mjs 의 content 모양)
const aiContent = (n = 6) => ({
  keyword: '실리카겔', category: 'PLAYLIST', theme: 'paper', template: 'classic', caption: '첫 줄', hashtags: ['#인디밴드'],
  cards: Array.from({ length: n }, (_, i) => ({ label: i ? `TRACK ${i}` : 'PLAYLIST', title: i ? `곡 ${i}` : '히트곡만 듣고\n[이 밴드 안다고 하지 마]', body: '', note: '', image: '', layout: i ? 'story' : 'cover', sourceIds: [] })),
  sources: [{ id: 's1', title: '인터뷰', url: 'https://example.com/a', publisher: '뉴시스' }],
});

// 실제 CLI 대신 쓰는 가짜 파이프라인
function fakeDeps({ cards = 6, sources = true, fail, available = true } = {}) {
  const saved = [];
  let release;
  const gate = new Promise(r => { release = r; });
  const deps = {
    saved, release,
    status: async () => ({ models: [{ id: 'claude-sonnet', provider: 'claude', available }, { id: 'gpt-6-astra', provider: 'codex', available: false }] }),
    generate: async (p, step) => { step('조사 중'); await gate; if (fail) throw new Error(fail); const c = aiContent(cards); if (!sources) c.sources = []; return c; },
    review: async c => c,
    validate: c => c,
    photos: async () => ['사진 경고'],
    save: async (userId, m) => { saved.push({ userId, ...m }); return { id: 99 }; },
  };
  return deps;
}
const params = { keyword: '실리카겔', model: 'claude-sonnet', count: 6, type: 'CURATION', template: 'editorial', hook: 'balanced' };
const until = async (fn, ms = 1000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('timeout'); };

test('AI 생성: running → done, 로그인 사용자의 매거진으로 저장', async () => {
  const deps = fakeDeps();
  const ai = createAiService(async () => deps);
  const job = await ai.start(7, params);
  assert.equal(job.status, 'running');
  assert.equal('userId' in job, false); // 응답에 내부 정보 없음
  deps.release();
  await until(() => ai.get(7, job.id).status !== 'running');
  const done = ai.get(7, job.id);
  assert.equal(done.status, 'done');
  assert.equal(done.magazineId, 99);
  assert.deepEqual(done.warnings, ['사진 경고']);
  const s = deps.saved[0];
  assert.equal(s.userId, 7);
  assert.equal(s.magazine.status, 'DRAFT');
  assert.equal(s.magazine.template, 'editorial'); // 화면에서 고른 템플릿
  assert.equal(s.magazine.title, '히트곡만 듣고 이 밴드 안다고 하지 마');
  assert.equal(s.cards[1].headline, '곡 1');
  assert.equal(s.sources[0].outlet, '뉴시스');
  assert.equal(s.sources[0].verified, false); // AI 출처는 항상 미확인으로 시작
});

test('AI 생성: 다른 사용자는 작업을 볼 수 없음(404)', async () => {
  const deps = fakeDeps();
  const ai = createAiService(async () => deps);
  const job = await ai.start(7, params);
  assert.throws(() => ai.get(8, job.id), { status: 404 });
  deps.release();
});

test('AI 생성: 한 번에 하나만 (409 AI_BUSY)', async () => {
  const deps = fakeDeps();
  const ai = createAiService(async () => deps);
  await ai.start(7, params);
  await assert.rejects(ai.start(8, params), { status: 409, code: 'AI_BUSY' });
  deps.release();
});

test('AI 생성: 로그인 안 된 모델은 503 AI_UNAVAILABLE', async () => {
  const ai = createAiService(async () => fakeDeps({ available: false }));
  await assert.rejects(ai.start(7, params), { status: 503, code: 'AI_UNAVAILABLE' });
  await assert.rejects(ai.start(7, { ...params, model: 'gpt-6-astra' }), { message: /Codex/ });
});

test('AI 생성: 실패·출처 없음·카드 부족은 error 상태로 끝나고 저장 안 함', async () => {
  for (const opts of [{ fail: '사용량 초과' }, { sources: false }, { cards: 3 }]) {
    const deps = fakeDeps(opts);
    const ai = createAiService(async () => deps);
    const job = await ai.start(7, params);
    deps.release();
    await until(() => ai.get(7, job.id).status !== 'running');
    const j = ai.get(7, job.id);
    assert.equal(j.status, 'error', JSON.stringify(opts));
    assert.ok(j.error);
    assert.equal(deps.saved.length, 0);
  }
});

test('카드 장수 맞추기: 9~10장은 앞 7장 + 마무리, 4장 이하는 실패', () => {
  const ten = fitCardCount(aiContent(10));
  assert.equal(ten.cards.length, 8);
  assert.equal(ten.cards[7].title, '곡 9'); // 마지막 장 유지
  assert.equal(fitCardCount(aiContent(6)).cards.length, 6);
  assert.throws(() => fitCardCount(aiContent(4)), /4장/);
});

test('mapContent: 화면에서 고른 종류(type) 반영', () => {
  assert.equal(mapContent(aiContent(), { type: 'ISSUE' }).magazine.type, 'ISSUE');
});

test('AI 요청 검증: 키워드·모델 필수, 장수 5~8, 허용값', () => {
  const ok = { keyword: '실리카겔', model: 'claude-sonnet' };
  assert.doesNotThrow(() => checkGenerate({ body: ok }));
  assert.doesNotThrow(() => checkGenerate({ body: { ...ok, count: 8, type: 'ISSUE', template: 'live', hook: 'bold' } }));
  for (const bad of [{ keyword: '' }, { model: 'gpt-4' }, { count: 4 }, { count: 9 }, { count: '6' }, { type: 'NEWS' }, { template: 'x' }, { hook: 'max' }]) {
    assert.throws(() => checkGenerate({ body: { ...ok, ...bad } }), { code: 'VALIDATION_ERROR' }, JSON.stringify(bad));
  }
  assert.throws(() => checkJobId({ params: { id: '../../etc' } }), { code: 'VALIDATION_ERROR' });
});
