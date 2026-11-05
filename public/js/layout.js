// 로그인 후 화면 공통 틀: 왼쪽 내비게이션 + 로그인 사용자 + 로그아웃
// 로그인 안 됐으면 api() 가 401 을 받아 로그인 화면으로 보냅니다.
import { api } from './api.js';
import { $, esc, action, toast } from './ui.js';

const ICON = {
  list: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  mine: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  templates: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
};

export async function mountLayout(active) {
  const { user } = await api('/auth/me');
  const nav = (key, href, label) => `<a class="nav${active === key ? ' active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}><span aria-hidden="true">${ICON[key]}</span> ${label}</a>`;
  $('#sidebar').innerHTML = `
    <a class="brand" href="/magazines.html" aria-label="PICK Studio 홈"><span class="ring"><img src="/assets/pick-logo.jpg" alt="PICK 로고"></span><span>pick<span class="brand-dot">.</span><small>EDITORIAL STUDIO</small></span></a>
    <a class="primary new-button" href="/edit.html">＋ 새 매거진</a>
    <div class="nav-label">WORKSPACE</div>
    ${nav('list', '/magazines.html', '매거진 목록')}
    ${nav('mine', '/magazines.html?mine=1', '내 매거진')}
    ${nav('templates', '/templates.html', '템플릿 6종')}
    <div class="profile"><span class="ring"><img src="/assets/pick-logo.jpg" alt=""></span>
      <div><span class="profile-name">${esc(user.nickname)}</span><small>${esc(user.email)}</small></div>
      <button class="quiet logout" id="logoutBtn">로그아웃</button></div>`;
  $('#logoutBtn').onclick = action(async () => {
    await api('/auth/logout', { method: 'POST' });
    toast('로그아웃했습니다.');
    location.href = '/login.html';
  });
  document.body.classList.remove('loading');
  return user;
}
