// 매거진 등록 · 수정 (기존 카드 편집실 재사용: 미리보기 + 필름스트립 + 탭 인스펙터 + 말투 검사)
//   edit.html        → 새 매거진: 화면에서 다 쓰고 [만들기] 한 번에 POST
//   edit.html?id=N   → 수정: 바뀐 칸만 자동 저장(PUT), 카드 추가·삭제·순서·출처는 바로 API 호출
import { api, uploadImage } from './api.js';
import { mountLayout } from './layout.js';
import { $, $$, esc, statusBadge, toast, action, confirmDialog, showError } from './ui.js';
import { drawContentCard, drawAllCards } from './cards.js';
import { openBook } from './flipbook.js';
import { toContent } from '/shared/magazine-content.js';
import { lintCards } from '/shared/voice.js';
import { templates } from '/templates.js';

const MAX = { title: 60, keyword: 160, category: 40, caption: 2200, label: 40, headline: 64, body: 260, footer: 100, outlet: 100, sourceTitle: 180 };
const CARD_MIN = 5, CARD_MAX = 8;
const LAYOUTS = [['cover', '사진 표지'], ['story', '사진 + 이야기'], ['type', '타이포그래피'], ['end', '마무리']];
const THEMES = [['paper', '오프화이트 & 레드'], ['midnight', '블랙 & 라임'], ['cobalt', '코발트']];
const TEMPLATE_OPTIONS = [['classic', '기본 (테마 색상)'], ...templates.map(t => [t.id, `${t.name} · ${t.en}`])];
const FIELD_NAME = { title: '헤드라인', body: '본문', note: '하단 문구', caption: '캡션' };

const params = new URLSearchParams(location.search);
const id = params.get('id');
const createMode = !id;
let keySeq = 0;
const key = () => `k${++keySeq}`;

await mountLayout(createMode ? 'new' : 'mine');
const content = $('#content');

let mag, selected = 0, tab = 'text', locked = false, touched = false;

// ── 데이터 준비 (파일 맨 끝에서 호출: 아래 함수·상수가 모두 정의된 뒤에 실행) ──
async function boot() {
  if (createMode) {
    mag = {
      title: '', keyword: '', type: 'CURATION', template: 'playlist', theme: 'paper', category: 'MUSIC CURATION', caption: '', status: 'DRAFT', isOwner: true,
      cards: ['cover', 'story', 'type', 'story', 'type', 'end'].map((layout, i) => ({ key: key(), label: i === 0 ? 'PLAYLIST' : '', headline: '', body: '', footer: '', photoUrl: null, layout })),
      sources: [],
    };
    return start();
  }
  if (!/^\d+$/.test(id)) return showError(content, '주소에 매거진 번호가 없습니다.');
  try {
    const { magazine } = await api(`/api/magazines/${id}`);
    if (!magazine.isOwner) {
      showError(content, '본인이 작성한 매거진만 수정할 수 있습니다.');
      content.querySelector('.empty-state').insertAdjacentHTML('beforeend', ` <a class="primary" href="/magazine.html?id=${magazine.id}">상세 보기</a>`);
      return;
    }
    mag = { ...magazine, cards: magazine.cards.map(c => ({ ...c, key: key() })), sources: magazine.sources.map(s => ({ ...s, key: key() })) };
    start();
    if (params.get('created')) { toast('매거진을 만들었어요. 이제부터는 자동 저장됩니다.'); history.replaceState(null, '', `?id=${mag.id}`); }
    if (params.get('ai')) {
      let warnings = [];
      try { warnings = JSON.parse(sessionStorage.getItem('pick-ai-warnings') || '[]'); sessionStorage.removeItem('pick-ai-warnings'); } catch { /* 없음 */ }
      toast(['AI 초안이 준비됐어요. 문장을 다듬고, 검토 화면에서 출처를 확인하세요.', ...warnings].join(' '));
      history.replaceState(null, '', `?id=${mag.id}`);
    }
  } catch (err) {
    if (err.status !== 401) showError(content, err.status === 404 ? '삭제되었거나 없는 매거진입니다.' : err.message);
  }
}

// ── 화면 틀 ──
function start() {
  locked = mag.status === 'PUBLISHED';
  content.innerHTML = `
    <div class="workspace-title">
      <div><h2 id="heading"></h2><span id="statusBadge"></span></div>
      <div class="detail-actions" id="topActions"></div>
    </div>
    <p class="notice" id="notice" hidden></p>
    ${createMode ? '<section class="ai-panel panel" id="aiPanel" aria-labelledby="aiTitle"></section>' : ''}
    <div class="editor-layout">
      <section class="preview panel" aria-label="카드 미리보기">
        <div class="panel-toolbar"><span class="post-user"><span class="ring"><img src="/assets/pick-logo.jpg" alt=""></span><span><b>_pick.kr</b><small>카드 미리보기 · 1080 × 1350 · 4:5</small></span></span>
          <label class="sr-only" for="theme">색상 테마</label><select id="theme">${THEMES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
        <div class="artboard">
          <div class="post-stage" id="postStage"><canvas id="mainCanvas" width="1080" height="1350" title="클릭: 매거진으로 펼쳐보기"></canvas>
            <span class="post-count" id="postCount"></span>
            <button class="post-arrow prev" id="prevCard" aria-label="이전 카드">‹</button><button class="post-arrow next" id="nextCard" aria-label="다음 카드">›</button></div>
          <div class="canvas-meta"><span id="cardLabel"></span><span>INSTAGRAM FEED</span></div>
        </div>
        <div class="filmstrip" id="filmstrip"></div>
        <div class="card-ops" id="cardOps">
          <button class="secondary" id="addCard">＋ 카드 추가</button>
          <button class="quiet" id="moveLeft" aria-label="선택한 카드를 앞으로">← 앞으로</button>
          <button class="quiet" id="moveRight" aria-label="선택한 카드를 뒤로">뒤로 →</button>
          <button class="quiet danger-text" id="deleteCard">이 카드 삭제</button>
        </div>
      </section>
      <section class="inspector panel">
        <div class="tabs" role="tablist">
          ${[['text', '원고'], ['photo', '사진'], ['info', '매거진 정보'], ['caption', '캡션'], ['sources', '출처']].map(([t, n]) => `<button role="tab" data-tab="${t}">${n}</button>`).join('')}
        </div>
        <div class="inspector-body" id="inspectorBody"></div>
      </section>
    </div>`;

  $('#theme').value = mag.theme;
  $('#theme').onchange = e => setMag('theme', e.target.value, { all: true });
  $$('.tabs button').forEach(b => { b.onclick = () => { tab = b.dataset.tab; renderInspector(); }; });
  $('#prevCard').onclick = () => select(selected - 1);
  $('#nextCard').onclick = () => select(selected + 1);
  $('#mainCanvas').onclick = async () => openBook(await drawAllCards(previewMagazine()), mag.title || '새 매거진', selected, $('#mainCanvas'));
  $('#addCard').onclick = action(addCard);
  $('#deleteCard').onclick = action(deleteCard);
  $('#moveLeft').onclick = action(() => moveCard(-1));
  $('#moveRight').onclick = action(() => moveCard(1));

  renderTop();
  renderInspector();
  renderPreview({ all: true });
  if (createMode) setupAi();
  addEventListener('beforeunload', e => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });
}

// ── AI 로 초안 만들기 (새 매거진 화면) ──
// 서버 PC 의 Claude Code / Codex 구독으로 조사·작성·셀프 리뷰·사진 매칭 → 결과는 내 매거진(DRAFT)으로 저장
const AI_JOB_KEY = 'pick-ai-job';
const store = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } } };

async function setupAi() {
  const panel = $('#aiPanel');
  panel.innerHTML = `<div class="ai-head"><b id="aiTitle">✦ AI로 초안 만들기</b><small>키워드 하나로 조사·원고·사진까지. 1~5분 걸려요.</small></div><p class="muted" id="aiState">AI 연결을 확인하고 있습니다…</p>`;
  const running = store.get(AI_JOB_KEY);
  if (running) return pollAi(running);
  let status;
  try { status = await api('/api/ai/status'); } catch (err) { $('#aiState').textContent = err.message; return; }
  const usable = status.models.filter(m => m.available);
  panel.innerHTML = `<div class="ai-head"><b id="aiTitle">✦ AI로 초안 만들기</b><small>키워드 하나로 조사·원고·사진까지. 1~5분 걸려요.</small></div>
    <div class="ai-form">
      <label class="field ai-keyword">키워드<input id="aiKeyword" maxlength="160" placeholder="예: 실리카겔 입문, 펜타포트 라인업" value="${esc(mag.keyword)}"></label>
      <label class="field">AI 모델<select id="aiModel">${status.models.map(m => `<option value="${m.id}" ${m.available ? '' : 'disabled'}>${esc(m.label)}${m.available ? '' : ' (로그인 필요)'}</option>`).join('')}</select></label>
      <label class="field">카드<select id="aiCount">${[5, 6, 7, 8].map(n => `<option value="${n}"${n === 6 ? ' selected' : ''}>${n}장</option>`).join('')}</select></label>
      <label class="field">종류<select id="aiType"><option value="CURATION">큐레이션</option><option value="ISSUE">이슈</option></select></label>
      <label class="field">후킹<select id="aiHook"><option value="balanced">적당</option><option value="bold">강하게</option><option value="calm">담백</option></select></label>
      <button class="primary" id="aiStart" ${usable.length ? '' : 'disabled'}>AI로 만들기</button>
    </div>
    <p class="caption-hint" id="aiState">${usable.length
      ? `템플릿은 지금 고른 디자인(${esc(TEMPLATE_OPTIONS.find(([v]) => v === mag.template)?.[1] || mag.template)})으로 만듭니다. 만든 원고는 초안이며, 출처는 검토 화면에서 직접 확인해야 승인할 수 있어요.`
      : '이 서버 PC에 AI가 연결되어 있지 않습니다. 터미널에서 <b>claude auth login</b>(Claude) 또는 <b>AI 연결.cmd</b>(ChatGPT)로 로그인한 뒤 새로고침하세요. 직접 작성은 아래 편집실에서 할 수 있어요.'}</p>`;
  if (usable.length) $('#aiModel').value = usable[0].id;
  $('#aiStart').onclick = action(async () => {
    const keyword = $('#aiKeyword').value.trim();
    if (!keyword) throw new Error('키워드를 입력하세요.');
    const { job } = await api('/api/ai/generate', {
      method: 'POST',
      body: { keyword, model: $('#aiModel').value, count: Number($('#aiCount').value), type: $('#aiType').value, hook: $('#aiHook').value, template: mag.template },
    });
    store.set(AI_JOB_KEY, job.id);
    pollAi(job.id);
  });
}

async function pollAi(jobId) {
  const panel = $('#aiPanel');
  panel.innerHTML = `<div class="ai-head"><b id="aiTitle">✦ AI가 원고를 만들고 있어요</b><small>이 화면을 닫아도 서버에서 계속 진행됩니다.</small></div>
    <p class="ai-progress" id="aiState" role="status" aria-live="polite">준비 중…</p><div class="progress"><i class="indeterminate"></i></div>`;
  for (;;) {
    let job;
    try { ({ job } = await api(`/api/ai/jobs/${jobId}`)); } catch (err) {
      store.set(AI_JOB_KEY, null);
      if (err.status === 404) return setupAi(); // 서버 재시작 등으로 작업이 사라짐
      $('#aiState').textContent = err.message; return;
    }
    if (job.status === 'running') {
      $('#aiState').textContent = job.message;
      await new Promise(r => setTimeout(r, 2500));
      continue;
    }
    store.set(AI_JOB_KEY, null);
    if (job.status === 'done') {
      store.set('pick-ai-warnings', JSON.stringify(job.warnings || []));
      touched = false;
      location.replace(`/edit.html?id=${job.magazineId}&ai=1`);
      return;
    }
    panel.querySelector('.progress')?.remove();
    $('#aiState').innerHTML = `<span style="color:var(--heart)">${esc(job.error)}</span> <button class="secondary" id="aiRetry">다시 설정</button>`;
    $('#aiRetry').onclick = () => setupAi();
    return;
  }
}

function renderTop() {
  $('#heading').textContent = mag.title || (createMode ? '새 매거진' : '제목 없음');
  $('#crumb').textContent = createMode ? '새 매거진' : (mag.title || '편집');
  document.title = `${createMode ? '새 매거진' : mag.title} · PICK Studio`;
  $('#statusBadge').innerHTML = statusBadge(mag.status);
  $('#topActions').innerHTML = createMode
    ? '<button class="primary" id="createBtn">만들기</button>'
    : `<a class="secondary" data-go href="/magazine.html?id=${mag.id}">상세 보기</a><a class="primary" data-go href="/review.html?id=${mag.id}">검토 · 승인 →</a>`;
  if (createMode) $('#createBtn').onclick = action(createMagazine);
  $$('[data-go]').forEach(a => { a.onclick = async e => { e.preventDefault(); await flush().catch(() => {}); location.href = a.href; }; });
  const notice = $('#notice');
  if (locked) { notice.textContent = '게시 완료된 매거진은 수정할 수 없습니다. (서버도 수정 요청을 거부합니다)'; notice.hidden = false; }
  else if (mag.status === 'APPROVED') { notice.textContent = '승인 완료 상태입니다. 내용을 고치면 자동으로 검토 중으로 돌아가고, 다시 승인받아야 합니다.'; notice.hidden = false; }
  else if (createMode) { notice.textContent = '카드 5~8장과 제목·키워드를 채운 뒤 [만들기]를 누르세요. 만든 다음부터는 자동 저장됩니다.'; notice.hidden = false; }
  else notice.hidden = true;
  $('#cardOps').querySelectorAll('button').forEach(b => { b.disabled = locked; });
}

// ── 미리보기 (기존 drawCard) ──
const renumber = () => mag.cards.forEach((c, i) => { c.order = i; });
function previewMagazine() {
  renumber();
  return { ...mag, cards: mag.cards.map((c, i) => ({ ...c, headline: c.headline.trim() ? c.headline : i === 0 ? '표지 제목을\n입력하세요' : `${i + 1}장 제목` })) };
}
let renderSeq = 0;
async function renderPreview({ all = false } = {}) {
  const seq = ++renderSeq;
  const preview = toContent(previewMagazine());
  const strip = $('#filmstrip');
  if (all || strip.children.length !== mag.cards.length) {
    strip.innerHTML = mag.cards.map((_, i) => `<button class="thumb" data-i="${i}" aria-label="${i + 1}번 카드 편집"><canvas></canvas><small>${String(i + 1).padStart(2, '0')}</small></button>`).join('');
    $$('.thumb', strip).forEach((b, i) => { b.onclick = () => select(i); drawContentCard(b.querySelector('canvas'), preview, i); });
  } else {
    drawContentCard(strip.children[selected].querySelector('canvas'), preview, selected);
  }
  $$('.thumb', strip).forEach((b, i) => b.classList.toggle('active', i === selected));
  const temp = document.createElement('canvas');
  await drawContentCard(temp, preview, selected);
  if (seq !== renderSeq) return;
  const main = $('#mainCanvas').getContext('2d');
  main.clearRect(0, 0, 1080, 1350); main.drawImage(temp, 0, 0);
  const n = mag.cards.length;
  $('#cardLabel').textContent = `${String(selected + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${mag.cards[selected].layout.toUpperCase()}`;
  $('#postCount').textContent = `${selected + 1}/${n}`;
  $('#prevCard').disabled = selected === 0; $('#nextCard').disabled = selected === n - 1;
  $('#moveLeft').disabled = locked || selected === 0; $('#moveRight').disabled = locked || selected === n - 1;
  $('#addCard').disabled = locked || n >= CARD_MAX; $('#deleteCard').disabled = locked || n <= CARD_MIN;
}
let previewTimer;
const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(() => renderPreview(), 120); };

function select(i) {
  selected = Math.max(0, Math.min(mag.cards.length - 1, i));
  renderInspector();
  renderPreview();
}

// ── 인스펙터 탭 ──
const counter = (v, max) => `<small>${String(v ?? '').length}/${max}</small>`;
const input = (label, scope, field, value, max, extra = '') => `<label class="field">${label}${counter(value, max)}<input data-scope="${scope}" data-field="${field}" maxlength="${max}" value="${esc(value)}" ${extra}></label>`;
const area = (label, scope, field, value, max, cls = '', extra = '') => `<label class="field">${label}${counter(value, max)}<textarea data-scope="${scope}" data-field="${field}" maxlength="${max}" class="${cls}" ${extra}>${esc(value)}</textarea></label>`;
const options = (list, value) => list.map(([v, n]) => `<option value="${v}"${v === value ? ' selected' : ''}>${esc(n)}</option>`).join('');

function renderInspector() {
  const el = $('#inspectorBody');
  const c = mag.cards[selected];
  $$('.tabs button').forEach(b => { b.classList.toggle('selected', b.dataset.tab === tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
  if (tab === 'text') {
    el.innerHTML = `<div class="section-label"><b>${String(selected + 1).padStart(2, '0')} 카드 원고</b><small>${selected === 0 ? '첫 문장에서 시선을 잡으세요 · [대괄호] 줄은 강조색' : '한 장에 하나의 이야기'}</small></div>
      ${input('상단 라벨', 'card', 'label', c.label, MAX.label)}
      ${area('헤드라인 (필수)', 'card', 'headline', c.headline, MAX.headline, 'headline-input', 'required')}
      ${area('본문', 'card', 'body', c.body, MAX.body, 'body-input')}
      ${input('하단 문구', 'card', 'footer', c.footer, MAX.footer)}
      <label class="field">레이아웃<select data-scope="card" data-field="layout">${options(LAYOUTS, c.layout)}</select></label>
      <div id="lintBox"></div>`;
    renderLint();
  } else if (tab === 'photo') {
    el.innerHTML = `<div class="section-label"><b>사진</b><small>카드 ${selected + 1}</small></div>
      ${c.photoUrl ? `<img class="photo-preview" src="${esc(c.photoUrl)}" alt="카드 ${selected + 1} 사진">` : '<div class="tip">사진 없이 타이포그래피만으로도 카드를 만들 수 있어요.</div>'}
      <div class="two-buttons" style="margin-top:14px"><button class="secondary" id="pickPhoto">내 사진 선택</button><button class="quiet" id="removePhoto" ${c.photoUrl ? '' : 'disabled'}>사진 제거</button></div>
      <input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" hidden>
      <p class="caption-hint">JPG·PNG·WEBP, 8MB 이하. 이 서버에 올린 사진만 카드에 쓸 수 있습니다(내보내기 이미지에 그대로 들어감). 게시 전 사진 사용 권한을 확인하세요.</p>`;
    $('#pickPhoto').onclick = () => $('#photoFile').click();
    $('#photoFile').onchange = action(async e => {
      const file = e.target.files[0]; if (!file) return;
      setSave('사진 올리는 중…');
      const { url } = await uploadImage(file);
      setCard(c, 'photoUrl', url);
      renderInspector();
    });
    $('#removePhoto').onclick = () => { setCard(c, 'photoUrl', null); renderInspector(); };
  } else if (tab === 'info') {
    el.innerHTML = `<div class="section-label"><b>매거진 정보</b><small>목록·검색에 쓰여요</small></div>
      ${input('제목 (필수, 1~60자)', 'mag', 'title', mag.title, MAX.title, 'required')}
      ${input('키워드 (필수)', 'mag', 'keyword', mag.keyword, MAX.keyword, 'required placeholder="아티스트, 신보, 공연…"')}
      <label class="field">종류<select data-scope="mag" data-field="type">${options([['CURATION', '큐레이션'], ['ISSUE', '이슈']], mag.type)}</select></label>
      <label class="field">템플릿 (6종 + 기본)<select data-scope="mag" data-field="template">${options(TEMPLATE_OPTIONS, mag.template)}</select></label>
      ${input('카드 머리글 라벨', 'mag', 'category', mag.category, MAX.category)}
      <p class="caption-hint"><a href="/templates.html" target="_blank" rel="noopener">템플릿 6종 한눈에 비교 ↗</a> · 색상 테마는 미리보기 위쪽에서 바꿉니다.</p>`;
  } else if (tab === 'caption') {
    el.innerHTML = `<div class="section-label"><b>피드 캡션</b><small>내보내기 시 caption.txt</small></div>
      ${area('캡션', 'mag', 'caption', mag.caption, MAX.caption, '', 'style="min-height:320px"')}`;
  } else if (tab === 'sources') {
    renderSources(el);
  }
  // 입력 → 로컬 반영 + 미리보기 + 자동 저장
  $$('[data-field]', el).forEach(f => {
    const handler = () => {
      const value = f.value;
      const small = f.parentElement.querySelector('small');
      if (small && f.maxLength > 0) small.textContent = `${value.length}/${f.maxLength}`;
      if (f.dataset.scope === 'card') setCard(c, f.dataset.field, value, { inspector: false });
      else setMag(f.dataset.field, value, { all: ['template', 'category'].includes(f.dataset.field) });
      if (tab === 'text') renderLint();
    };
    f.addEventListener(f.tagName === 'SELECT' ? 'change' : 'input', handler);
  });
  if (locked) el.querySelectorAll('input,textarea,select,button').forEach(x => { x.disabled = true; });
}

function renderLint() {
  const box = $('#lintBox'); if (!box) return;
  const L = lintCards(toContent({ ...mag, cards: mag.cards.map((c, i) => ({ ...c, order: i })) }));
  const mine = L.issues.filter(x => x.card === selected), rest = L.issues.filter(x => x.card === -1), other = L.issues.length - mine.length - rest.length;
  const row = x => `<p><b>${esc(FIELD_NAME[x.field] || '')} · ${esc(x.label)}</b>${x.match ? ` <q>${esc(x.match)}</q>` : ''}<small>${esc(x.fix)}</small></p>`;
  box.innerHTML = `<div class="lint"><div class="lint-head"><b>말투 검사</b><span class="score ${L.score >= 80 ? 'good' : L.score >= 55 ? 'mid' : 'bad'}">원고 전체 ${L.score}점</span></div>
    ${mine.length ? mine.map(row).join('') : '<p class="ok">이 카드는 사람 말투로 읽혀요.</p>'}${rest.map(row).join('')}
    ${other ? `<p class="more">다른 카드에 ${other}곳 더 있어요.</p>` : ''}</div>`;
}

function renderSources(el) {
  el.innerHTML = `<div class="section-label"><b>출처 ${mag.sources.length}</b><small>확인(verified) 체크는 검토 화면에서</small></div>
    ${mag.sources.length ? mag.sources.map(s => `<div class="source-item"><small>${esc(s.outlet)} · ${s.verified ? '✓ 확인됨' : '미확인'}</small><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><button class="quiet danger-text" data-del="${s.key}">삭제</button></div>`).join('') : '<div class="tip">아직 출처가 없습니다. 승인하려면 출처가 1개 이상 필요해요.</div>'}
    <div class="section-label" style="margin-top:22px"><b>출처 추가</b></div>
    <label class="field">매체명 (outlet)<input id="srcOutlet" maxlength="${MAX.outlet}" placeholder="예: 뉴시스, 공식 인스타그램"></label>
    <label class="field">제목<input id="srcTitle" maxlength="${MAX.sourceTitle}" placeholder="원문 제목"></label>
    <label class="field">주소 (url)<input id="srcUrl" type="url" maxlength="2048" placeholder="https://…"></label>
    <button class="secondary" id="addSource">출처 추가</button>`;
  $('#addSource').onclick = action(addSource);
  $$('[data-del]', el).forEach(b => { b.onclick = action(() => deleteSource(b.dataset.del)); });
}

// ── 값 바꾸기 ──
function setMag(field, value, { all = false } = {}) {
  mag[field] = value; touched = true;
  if (field === 'title') renderTop();
  queueSave('mag', null, field, value);
  if (all) renderPreview({ all: true }); else schedulePreview();
}
function setCard(card, field, value, { inspector = true } = {}) {
  card[field] = value; touched = true;
  queueSave('card', card, field, value);
  if (field === 'photoUrl' || field === 'layout') renderPreview(); else schedulePreview();
  if (inspector && field === 'layout') renderInspector();
}

// ── 자동 저장 (수정 모드) ──
const pending = { mag: {}, cards: new Map() };
let saveTimer, chain = Promise.resolve();
function setSave(text, error = false) { const s = $('#saveState'); s.textContent = text; s.style.color = error ? 'var(--heart)' : ''; }
const hasUnsaved = () => (createMode ? touched : Object.keys(pending.mag).length > 0 || pending.cards.size > 0);
function queueSave(scope, card, field, value) {
  if (createMode || locked) return;
  if (scope === 'mag') pending.mag[field] = value;
  else pending.cards.set(card.id, { ...(pending.cards.get(card.id) || {}), [field]: value });
  setSave('저장 대기…');
  clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(() => {}), 700);
}
function flush() {
  clearTimeout(saveTimer);
  chain = chain.catch(() => {}).then(doFlush);
  return chain;
}
async function doFlush() {
  const magPatch = pending.mag, cardPatches = [...pending.cards];
  pending.mag = {}; pending.cards = new Map();
  if (!Object.keys(magPatch).length && !cardPatches.length) return;
  setSave('저장 중…');
  try {
    if (Object.keys(magPatch).length) {
      const r = await api(`/api/magazines/${mag.id}`, { method: 'PUT', body: magPatch });
      applyStatus(r.magazine, r.reverted);
    }
    for (const [cid, patch] of cardPatches) {
      const r = await api(`/api/cards/${cid}`, { method: 'PUT', body: patch });
      applyStatus(r.magazine, r.magazine.reverted);
    }
    setSave(hasUnsaved() ? '저장 대기…' : '저장됨');
  } catch (err) {
    // 실패한 변경은 다시 대기열에 넣고, 다음 입력 때 다시 보냄
    pending.mag = { ...magPatch, ...pending.mag };
    for (const [cid, p] of cardPatches) pending.cards.set(cid, { ...p, ...(pending.cards.get(cid) || {}) });
    setSave(`저장 실패 · ${err.message}`, true);
    if (err.code === 'PUBLISHED_LOCKED') { mag.status = 'PUBLISHED'; locked = true; pending.mag = {}; pending.cards = new Map(); renderTop(); renderInspector(); }
    throw err;
  }
}
function applyStatus(m, reverted) {
  if (!m) return;
  const changed = m.status !== mag.status;
  mag.status = m.status;
  if (reverted) toast('승인 완료였던 매거진을 고쳐서 검토 중으로 돌아갔어요. 검토 화면에서 다시 승인해 주세요.');
  if (changed || reverted) renderTop();
}

// ── 카드·출처 구조 변경 ──
async function addCard() {
  if (mag.cards.length >= CARD_MAX) throw new Error(`카드는 최대 ${CARD_MAX}장입니다.`);
  const draft = { label: '', headline: '새 카드 제목', body: '', footer: '', photoUrl: null, layout: 'story' };
  if (createMode) mag.cards.push({ ...draft, key: key() });
  else {
    await flush();
    const r = await api(`/api/magazines/${mag.id}/cards`, { method: 'POST', body: draft });
    mag.cards.push({ ...r.card, key: key() });
    applyStatus(r.magazine, r.magazine.reverted);
  }
  touched = true; selected = mag.cards.length - 1; tab = 'text';
  renderInspector(); renderPreview({ all: true });
}
async function deleteCard() {
  if (mag.cards.length <= CARD_MIN) throw new Error(`카드는 최소 ${CARD_MIN}장이어야 합니다.`);
  const c = mag.cards[selected];
  if (!(await confirmDialog('카드 삭제', `${selected + 1}번 카드${c.headline ? ` ‘${c.headline.replace(/\n/g, ' ').slice(0, 20)}’` : ''}를 삭제할까요?`, { ok: '삭제', danger: true }))) return;
  if (!createMode) {
    await flush();
    const r = await api(`/api/cards/${c.id}`, { method: 'DELETE' });
    applyStatus(r.magazine, r.magazine.reverted);
  }
  mag.cards.splice(selected, 1);
  touched = true; selected = Math.min(selected, mag.cards.length - 1);
  renderInspector(); renderPreview({ all: true });
}
async function moveCard(dir) {
  const to = selected + dir;
  if (to < 0 || to >= mag.cards.length) return;
  const next = [...mag.cards];
  [next[selected], next[to]] = [next[to], next[selected]];
  if (!createMode) {
    await flush();
    const r = await api(`/api/magazines/${mag.id}/cards/order`, { method: 'PATCH', body: { cardIds: next.map(c => c.id) } });
    applyStatus(r.magazine, r.magazine.reverted);
  }
  mag.cards = next; touched = true; selected = to;
  renderInspector(); renderPreview({ all: true });
}
const isHttpUrl = v => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol); } catch { return false; } };
async function addSource() {
  const s = { outlet: $('#srcOutlet').value.trim(), title: $('#srcTitle').value.trim(), url: $('#srcUrl').value.trim() };
  if (!s.outlet || !s.title) throw new Error('매체명과 제목을 입력하세요.');
  if (!isHttpUrl(s.url)) throw new Error('출처 주소는 http:// 또는 https:// 로 시작해야 합니다.');
  if (createMode) mag.sources.push({ ...s, verified: false, key: key() });
  else {
    const r = await api(`/api/magazines/${mag.id}/sources`, { method: 'POST', body: s });
    mag.sources.push({ ...r.source, key: key() });
    applyStatus(r.magazine, r.magazine.reverted);
  }
  touched = true;
  renderInspector();
  toast('출처를 추가했습니다. 검토 화면에서 원문을 확인하고 체크하세요.');
}
async function deleteSource(k) {
  const s = mag.sources.find(x => x.key === k);
  if (!s || !(await confirmDialog('출처 삭제', `‘${s.title}’ 출처를 삭제할까요?`, { ok: '삭제', danger: true }))) return;
  if (!createMode) {
    const r = await api(`/api/sources/${s.id}`, { method: 'DELETE' });
    applyStatus(r.magazine, r.magazine.reverted);
  }
  mag.sources = mag.sources.filter(x => x.key !== k);
  touched = true;
  renderInspector();
}

// ── 새 매거진 만들기 ──
function createProblem() {
  if (!mag.title.trim() || mag.title.trim().length > MAX.title) return { tab: 'info', message: '제목을 1~60자로 입력하세요.' };
  if (!mag.keyword.trim()) return { tab: 'info', message: '키워드를 입력하세요.' };
  const empty = mag.cards.findIndex(c => !c.headline.trim());
  if (empty >= 0) return { tab: 'text', card: empty, message: `${empty + 1}번 카드의 헤드라인을 입력하세요.` };
  if (mag.cards.length < CARD_MIN || mag.cards.length > CARD_MAX) return { tab: 'text', message: `카드는 ${CARD_MIN}~${CARD_MAX}장이어야 합니다.` };
  return null;
}
async function createMagazine() {
  const problem = createProblem();
  if (problem) {
    tab = problem.tab; if (problem.card !== undefined) selected = problem.card;
    renderInspector(); renderPreview();
    throw new Error(problem.message);
  }
  const pickCard = ({ label, headline, body, footer, photoUrl, layout }) => ({ label, headline, body, footer, photoUrl: photoUrl || null, layout });
  const body = {
    title: mag.title, keyword: mag.keyword, type: mag.type, template: mag.template, theme: mag.theme, category: mag.category, caption: mag.caption,
    cards: mag.cards.map(pickCard), sources: mag.sources.map(({ outlet, title, url }) => ({ outlet, title, url })),
  };
  const { magazine } = await api('/api/magazines', { method: 'POST', body });
  touched = false;
  location.replace(`/edit.html?id=${magazine.id}&created=1`);
}

await boot();
