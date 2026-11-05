// 매거진 목록: 검색(?q) + 상태·종류 필터 + 내 것만(?mine=1). 필터는 주소창에도 반영(새로고침·공유해도 유지).
import { api } from './api.js';
import { mountLayout } from './layout.js';
import { $, esc, statusBadge, typeBadge, date, toast, showError } from './ui.js';
import { drawMagazineCard, drawAllCards } from './cards.js';
import { openBook } from './flipbook.js';

const PAGE_SIZE = 24;
const params = new URLSearchParams(location.search);
const controls = { q: $('#q'), status: $('#status'), type: $('#type'), mine: $('#mine') };
controls.q.value = params.get('q') || '';
controls.status.value = params.get('status') || '';
controls.type.value = params.get('type') || '';
controls.mine.checked = params.get('mine') === '1';

await mountLayout(controls.mine.checked ? 'mine' : 'list');

let page = 1, loaded = 0, requestId = 0;

function currentQuery() {
  const p = new URLSearchParams();
  const q = controls.q.value.trim();
  if (q) p.set('q', q);
  if (controls.status.value) p.set('status', controls.status.value);
  if (controls.type.value) p.set('type', controls.type.value);
  if (controls.mine.checked) p.set('mine', '1');
  return p;
}

function headingFor(mine) {
  $('#heading').innerHTML = mine ? '내 <span>매거진</span>' : '매거진 <span>보관함</span>';
  $('#subheading').textContent = mine ? '내가 만든 매거진입니다. 표지를 누르면 수정·검토·내보내기를 할 수 있어요.' : '모든 에디터가 만든 매거진을 둘러보세요. 표지를 누르면 상세 화면, 📖 를 누르면 펼쳐볼 수 있어요.';
}

function cardHtml(m) {
  return `<div class="cover-wrap"><canvas aria-hidden="true"></canvas><button class="peek" type="button" data-peek="${m.id}" aria-label="${esc(m.title)} 펼쳐보기">📖 펼쳐보기</button></div>
    <strong>${esc(m.title)}</strong>
    <small>${esc(m.author.nickname)}${m.isOwner ? ' (나)' : ''} · ${m._count.cards}장 · ${date(m.updatedAt)}</small>
    <span class="meta">${statusBadge(m.status)}${typeBadge(m.type)}</span>`;
}

async function load(reset) {
  const id = ++requestId;
  if (reset) { page = 1; loaded = 0; }
  const query = currentQuery();
  history.replaceState(null, '', query.toString() ? `?${query}` : location.pathname);
  headingFor(controls.mine.checked);
  query.set('page', page); query.set('limit', PAGE_SIZE);
  let data;
  try {
    data = await api(`/api/magazines?${query}`);
  } catch (err) {
    if (id === requestId && err.status !== 401) showError($('#grid'), err.message);
    return;
  }
  if (id !== requestId) return; // 더 최근 검색이 있으면 버림
  const grid = $('#grid');
  if (reset) grid.innerHTML = '';
  if (!data.total) {
    const filtered = [...currentQuery().keys()].length;
    grid.innerHTML = `<div class="empty-state panel" style="grid-column:1/-1"><b>${filtered ? '조건에 맞는 매거진이 없습니다' : '아직 매거진이 없습니다'}</b><p>${filtered ? '검색어나 필터를 바꿔 보세요.' : '첫 매거진을 만들어 보세요.'}</p><a class="primary" href="/edit.html">＋ 새 매거진</a></div>`;
  }
  for (const m of data.magazines) {
    const a = document.createElement('a');
    a.className = 'archive-card';
    a.href = `/magazine.html?id=${m.id}`;
    a.innerHTML = cardHtml(m);
    grid.append(a);
    drawMagazineCard(a.querySelector('canvas'), m, 0);
  }
  loaded += data.magazines.length;
  $('#count').textContent = data.total ? `${data.total}개 중 ${loaded}개` : '';
  $('#more').hidden = loaded >= data.total;
}

// 검색어는 입력이 멈추면(0.3초) 검색
let timer;
controls.q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(true), 300); });
$('#filters').addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); load(true); });
for (const el of [controls.status, controls.type, controls.mine]) el.addEventListener('change', () => load(true));
controls.mine.addEventListener('change', () => mountLayout(controls.mine.checked ? 'mine' : 'list'));
$('#more').addEventListener('click', () => { page += 1; load(false); });

// 📖 펼쳐보기: 전체 카드를 받아 3D 책으로
$('#grid').addEventListener('click', async e => {
  const btn = e.target.closest('[data-peek]');
  if (!btn) return;
  e.preventDefault();
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = '펼치는 중…';
  try {
    const { magazine } = await api(`/api/magazines/${btn.dataset.peek}`);
    openBook(await drawAllCards(magazine), magazine.title, 0, btn);
  } catch (err) {
    if (err.status !== 401) toast(err.message);
  } finally {
    btn.disabled = false; btn.textContent = '📖 펼쳐보기';
  }
});

load(true);
