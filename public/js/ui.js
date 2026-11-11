// 화면 공통 도우미
import { STATUS_LABEL } from '/shared/status-rules.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// 사용자 입력을 HTML에 넣을 때 반드시 거칩니다(XSS 방지).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const TYPE_LABEL = { CURATION: '큐레이션', ISSUE: '이슈' };
export { STATUS_LABEL };

export const statusBadge = status => `<span class="badge status-${esc(status).toLowerCase()}">${esc(STATUS_LABEL[status] || status)}</span>`;
export const typeBadge = type => `<span class="badge type">${esc(TYPE_LABEL[type] || type)}</span>`;
export const date = iso => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

let toastTimer;
export function toast(message) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// 확인 창 (기존 dialog 스타일 재사용) → true/false
export function confirmDialog(title, message, { ok = '확인', danger = false } = {}) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.innerHTML = `<div class="modal-heading"><h2>${esc(title)}</h2></div><p>${esc(message)}</p>
      <div class="actions"><button class="secondary" value="no">취소</button><button class="primary${danger ? ' danger' : ''}" value="yes">${esc(ok)}</button></div>`;
    document.body.append(d);
    d.addEventListener('click', e => { const v = e.target.closest('button')?.value; if (v) { d.close(v); } else if (e.target === d) d.close('no'); });
    d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
    d.showModal();
    d.querySelector('[value="no"]').focus();
  });
}

// 버튼 클릭 중 중복 실행 막기 + 에러는 토스트로
export function action(fn) {
  return async function (e) {
    const btn = e?.currentTarget instanceof HTMLButtonElement ? e.currentTarget : null;
    if (btn?.disabled) return;
    if (btn) btn.disabled = true;
    try { await fn.call(this, e); } catch (err) { if (err.status !== 401) toast(err.message); } finally { if (btn) btn.disabled = false; }
  };
}

// 로그인·회원가입 칸을 빈 칸으로 시작 (브라우저가 저장된 이메일·비밀번호를 미리 채우지 않게)
// - HTML 에서 readonly 로 시작 → 브라우저 자동 채우기 대상에서 빠짐
// - 칸을 누르거나(Tab 포함) 터치하면 그 칸만 입력 가능
// - 그래도 채워진 값은 사용자가 입력을 시작하기 전까지만 비움
export function startEmpty(form) {
  const fields = [...form.querySelectorAll('input')];
  let userTyped = false;
  form.addEventListener('keydown', () => { userTyped = true; }, { once: true });
  for (const f of fields) {
    const unlock = () => { f.readOnly = false; };
    f.addEventListener('focus', unlock);
    f.addEventListener('pointerdown', unlock);
  }
  const clear = () => { if (!userTyped) fields.forEach(f => { if (f !== document.activeElement) f.value = ''; }); };
  clear();
  setTimeout(clear, 150);
  setTimeout(clear, 600);
  addEventListener('pageshow', e => { if (e.persisted) { userTyped = false; clear(); } }); // 뒤로 가기로 돌아왔을 때
}

export function showError(container, message) {
  container.innerHTML = `<div class="empty-state panel"><b>불러오지 못했습니다</b><p>${esc(message)}</p><a class="secondary" href="/magazines.html">목록으로</a></div>`;
}
