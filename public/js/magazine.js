// 매거진 상세: 카드 미리보기(넘겨보기·썸네일) + 펼쳐보기(3D 책) + 캡션·출처·말투 점수
// 본인 글일 때만 수정·검토·내보내기·삭제 버튼을 보여 줍니다(서버도 403 으로 막음).
import { api } from './api.js';
import { mountLayout } from './layout.js';
import { $, $$, esc, statusBadge, typeBadge, date, toast, action, confirmDialog, showError } from './ui.js';
import { drawAllCards } from './cards.js';
import { openBook } from './flipbook.js';

await mountLayout('list');
const content = $('#content');
const id = new URLSearchParams(location.search).get('id');

if (!/^\d+$/.test(id || '')) {
  showError(content, '주소에 매거진 번호가 없습니다.');
} else {
  try {
    const { magazine } = await api(`/api/magazines/${id}`);
    render(magazine);
  } catch (err) {
    if (err.status !== 401) showError(content, err.status === 404 ? '삭제되었거나 없는 매거진입니다.' : err.message);
  }
}

function render(m) {
  document.title = `${m.title} · PICK Studio`;
  $('#crumb').textContent = m.title;
  const ownerActions = m.isOwner ? `
    <div class="detail-actions">
      <a class="secondary" href="/edit.html?id=${m.id}">수정</a>
      <a class="secondary" href="/review.html?id=${m.id}">검토 · 승인</a>
      <a class="secondary" href="/export.html?id=${m.id}">내보내기</a>
      <button class="quiet" id="deleteBtn" style="color:var(--heart)">삭제</button>
    </div>` : '';
  content.innerHTML = `
    <div class="detail-title">
      <div>
        <h1>${esc(m.title)}</h1>
        <div class="sub">${statusBadge(m.status)}${typeBadge(m.type)}<span>${esc(m.author.nickname)}${m.isOwner ? ' (나)' : ''}</span><span>키워드 · ${esc(m.keyword)}</span><span>수정 ${date(m.updatedAt)}</span></div>
      </div>
      ${ownerActions}
    </div>
    <div class="detail-layout">
      <section class="viewer panel" aria-label="카드 미리보기">
        <div class="viewer-stage" id="stage"><p class="muted">카드를 그리는 중…</p></div>
        <div class="viewer-nav"><button id="prev" aria-label="이전 카드">‹</button><span id="pos">-</span><button id="next" aria-label="다음 카드">›</button></div>
        <div class="thumbs" id="thumbs"></div>
        <button class="primary" id="bookBtn" style="width:100%;margin-top:12px">📖 매거진 펼쳐보기</button>
      </section>
      <div class="info-stack">
        <section class="info-block panel" id="voice"><h2>말투 점수</h2><p class="muted">검사 중…</p></section>
        <section class="info-block panel"><h2>캡션</h2>${m.caption ? `<p class="caption-text">${esc(m.caption)}</p>` : '<p class="muted">캡션이 없습니다.</p>'}</section>
        <section class="info-block panel"><h2>출처 <span class="muted">${m.sources.filter(s => s.verified).length}/${m.sources.length} 확인</span></h2>
          ${m.sources.length ? `<ul class="source-list">${m.sources.map(s => `<li><span class="mark ${s.verified ? 'ok' : 'no'}">${s.verified ? '✓ 확인' : '· 미확인'}</span><span><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a> <small>${esc(s.outlet)}</small></span></li>`).join('')}</ul>` : '<p class="muted">등록된 출처가 없습니다.</p>'}
        </section>
      </div>
    </div>`;

  if (m.isOwner) $('#deleteBtn').onclick = action(async () => {
    if (!(await confirmDialog('매거진 삭제', `‘${m.title}’과(와) 카드 ${m.cards.length}장, 출처 ${m.sources.length}개를 삭제합니다. 되돌릴 수 없습니다.`, { ok: '삭제', danger: true }))) return;
    await api(`/api/magazines/${m.id}`, { method: 'DELETE' });
    toast('삭제했습니다.');
    location.href = '/magazines.html?mine=1';
  });

  loadViewer(m);
  loadVoice(m);
}

async function loadViewer(m) {
  const stage = $('#stage'), thumbs = $('#thumbs');
  const total = m.cards.length, pages = [];
  let index = 0;
  const main = document.createElement('canvas');
  main.width = 1080; main.height = 1350;
  main.setAttribute('role', 'img');
  thumbs.innerHTML = m.cards.map((_, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}번째 카드 보기" disabled></button>`).join('');
  const buttons = $$('button', thumbs);
  buttons.forEach((b, i) => { b.onclick = () => show(i); });
  // 한 장 그려질 때마다 썸네일을 채우고, 첫 장은 바로 크게 보여 줌
  const drawing = drawAllCards(m, (i, page) => {
    pages[i] = page;
    const t = document.createElement('canvas'); t.width = 216; t.height = 270;
    t.getContext('2d').drawImage(page, 0, 0, 216, 270);
    buttons[i].append(t); buttons[i].disabled = false;
    if (i === 0) { stage.innerHTML = ''; stage.append(main); show(0); }
    else if (i === index) show(i);
  });
  function show(i) {
    index = Math.max(0, Math.min(total - 1, i));
    if (!pages[index]) return; // 아직 그리는 중이면 다 그린 뒤 표시
    main.getContext('2d').drawImage(pages[index], 0, 0);
    main.setAttribute('aria-label', `${index + 1}번째 카드: ${m.cards[index]?.headline || ''}`);
    $('#pos').textContent = `${index + 1} / ${total}`;
    $('#prev').disabled = index === 0; $('#next').disabled = index === total - 1;
    buttons.forEach((b, k) => b.setAttribute('aria-current', String(k === index)));
  }
  $('#prev').onclick = () => show(index - 1);
  $('#next').onclick = () => show(index + 1);
  // 펼쳐보기는 모든 카드를 다 그린 뒤에
  const book = async opener => openBook(await drawing, m.title, index, opener);
  main.onclick = () => book(main);
  $('#bookBtn').onclick = action(async () => {
    $('#bookBtn').textContent = pages.filter(Boolean).length < total ? '카드를 준비하는 중…' : '📖 매거진 펼쳐보기';
    await book($('#bookBtn'));
    $('#bookBtn').textContent = '📖 매거진 펼쳐보기';
  });
  addEventListener('keydown', e => {
    if (document.querySelector('.book-viewer, dialog[open]') || e.target.closest('input,textarea,select')) return;
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  await drawing;
}

async function loadVoice(m) {
  const box = $('#voice');
  try {
    const v = await api(`/api/magazines/${m.id}/voice`);
    const total = v.cards.reduce((n, c) => n + c.issues.length, 0) + v.overall.length;
    box.innerHTML = `<h2>말투 점수 ${m.isOwner ? `<a class="quiet" href="/review.html?id=${m.id}" style="font-size:12px">자세히 →</a>` : ''}</h2>
      <div class="score">${v.score}<small>/ 100</small></div>
      <p class="muted" style="margin:6px 0 0">${total ? `AI 말투로 읽히는 곳 ${total}군데` : 'AI 말투로 읽히는 곳이 없습니다.'}</p>`;
  } catch (err) {
    box.innerHTML = `<h2>말투 점수</h2><p class="muted">${esc(err.message)}</p>`;
  }
}
