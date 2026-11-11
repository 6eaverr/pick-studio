// 내보내기: 기존 renderer.js(drawCard)로 1080×1350 JPG 를 그려 서버로 보내면,
// 서버가 상태(APPROVED 이상, 아니면 403)·장수·크기를 검사하고 카드 이미지 + caption.txt ZIP 을 돌려줍니다.
import { api, ApiError, loginUrl } from './api.js';
import { mountLayout } from './layout.js';
import { $, $$, esc, statusBadge, toast, action, showError } from './ui.js';
import { drawAllCards } from './cards.js';
import { STATUS_LABEL, canExport } from '/shared/status-rules.js';

await mountLayout('mine');
const content = $('#content');
const id = new URLSearchParams(location.search).get('id');
const QUALITY = 0.92;
// 배포 서버(Vercel) 요청 한도 4.5MB 안에 들어오도록: 전체가 크면 JPG 품질을 단계적으로 낮춤
const MAX_BODY_CHARS = 4_000_000;
const QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5];

const download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const toBlob = (canvas, quality = QUALITY) => new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('JPG로 바꾸지 못했습니다.'))), 'image/jpeg', quality));
const toDataUrl = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });

if (!/^\d+$/.test(id || '')) showError(content, '주소에 매거진 번호가 없습니다.');
else {
  try {
    const { magazine } = await api(`/api/magazines/${id}`);
    if (!magazine.isOwner) showError(content, '내보내기는 매거진 작성자만 할 수 있습니다.');
    else render(magazine);
  } catch (err) {
    if (err.status !== 401) showError(content, err.status === 404 ? '삭제되었거나 없는 매거진입니다.' : err.message);
  }
}

function render(m) {
  document.title = `내보내기 · ${m.title} · PICK Studio`;
  $('#crumb').textContent = `${m.title} · 내보내기`;
  const allowed = canExport(m.status);
  content.innerHTML = `
    <div class="detail-title">
      <div><h1>${esc(m.title)}</h1><div class="sub">${statusBadge(m.status)}<span>카드 ${m.cards.length}장 · 1080 × 1350 JPG + caption.txt</span></div></div>
      <div class="detail-actions"><a class="secondary" href="/review.html?id=${m.id}">검토 · 승인</a><a class="secondary" href="/magazine.html?id=${m.id}">상세 보기</a></div>
    </div>
    ${allowed ? `
      <section class="info-block panel" style="margin-bottom:16px">
        <h2>게시 패키지 (ZIP)</h2>
        <p class="muted" style="margin:0 0 12px">카드 ${m.cards.length}장을 JPG로 그린 뒤 서버에서 확인하고 ZIP으로 받습니다. 01.jpg ~ ${String(m.cards.length).padStart(2, '0')}.jpg와 caption.txt가 들어 있어요.</p>
        <button class="primary" id="zipBtn" disabled>카드를 그리는 중…</button>
        <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      </section>
      <section class="info-block panel"><h2>카드 미리보기</h2><div class="export-grid" id="grid"></div></section>`
    : `
      <section class="panel locked-box">
        <b>아직 내보낼 수 없어요</b>
        <p class="muted">카드 이미지 내보내기는 <b>승인 완료</b> 이후에만 할 수 있습니다. 지금 상태: ${esc(STATUS_LABEL[m.status])}</p>
        <a class="primary" href="/review.html?id=${m.id}">검토 · 승인하러 가기</a>
      </section>`}`;
  if (allowed) prepare(m);
}

async function prepare(m) {
  const grid = $('#grid'), bar = $('#bar'), btn = $('#zipBtn');
  let pages;
  try {
    pages = await drawAllCards(m, (i, canvas) => {
      bar.style.width = `${Math.round(((i + 1) / m.cards.length) * 100)}%`;
      const fig = document.createElement('figure');
      fig.append(canvas);
      fig.insertAdjacentHTML('beforeend', `<figcaption><span>${String(i + 1).padStart(2, '0')}.jpg</span><button class="quiet" data-one="${i}">JPG ↓</button></figcaption>`);
      grid.append(fig);
    }, { strict: true });
  } catch (err) {
    btn.textContent = '내보낼 수 없음';
    toast(`${err.message} 편집 화면에서 고친 뒤 다시 시도하세요.`);
    return;
  }
  $$('[data-one]', grid).forEach(b => {
    b.onclick = action(async () => download(await toBlob(pages[Number(b.dataset.one)]), `${String(Number(b.dataset.one) + 1).padStart(2, '0')}.jpg`));
  });
  btn.disabled = false;
  btn.textContent = `ZIP 다운로드 (${pages.length}장 + caption.txt)`;
  btn.onclick = action(async () => {
    btn.textContent = 'JPG 만드는 중…';
    const images = [];
    for (const quality of QUALITY_STEPS) {
      images.length = 0;
      for (const p of pages) images.push(await toDataUrl(await toBlob(p, quality)));
      if (images.reduce((n, s) => n + s.length, 0) <= MAX_BODY_CHARS) break;
    }
    if (images.reduce((n, s) => n + s.length, 0) > MAX_BODY_CHARS) throw new Error('카드 이미지가 너무 커서 한 번에 보낼 수 없습니다. 사진을 더 작은 파일로 바꿔 보세요.');
    btn.textContent = '서버에서 확인 중…';
    const res = await fetch(`/api/magazines/${m.id}/export`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images }),
    });
    if (res.status === 401) { location.href = loginUrl(); return; }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      btn.textContent = `ZIP 다운로드 (${pages.length}장 + caption.txt)`;
      throw new ApiError(res.status, data.code, data.message || '내보내기에 실패했습니다.');
    }
    download(await res.blob(), `pick-${m.id}.zip`);
    btn.textContent = `ZIP 다운로드 (${pages.length}장 + caption.txt)`;
    toast('ZIP 파일을 내려받았습니다.');
  });
}
