import { api, safeNext } from './api.js';
import { $ } from './ui.js';

const next = safeNext(new URLSearchParams(location.search).get('next'));
$('#loginLink').href = `/login.html${next !== '/magazines.html' ? `?next=${encodeURIComponent(next)}` : ''}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function showError(message, focus) {
  $('#formError').textContent = message;
  $('#formError').hidden = false;
  focus?.focus();
}

// 화면에서 먼저 안내하고, 최종 검사는 서버가 합니다(같은 규칙).
function check({ email, nickname, password, password2 }) {
  if (!EMAIL_RE.test(email)) return ['올바른 이메일 형식이 아닙니다.', $('#email')];
  if (!nickname || nickname.length > 20) return ['닉네임은 1~20자로 입력하세요.', $('#nickname')];
  if (password.length < 8) return ['비밀번호는 8자 이상이어야 합니다.', $('#password')];
  if (password !== password2) return ['비밀번호 확인이 일치하지 않습니다.', $('#password2')];
  return null;
}

$('#signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#formError').hidden = true;
  const values = { email: $('#email').value.trim(), nickname: $('#nickname').value.trim(), password: $('#password').value, password2: $('#password2').value };
  const problem = check(values);
  if (problem) return showError(...problem);
  $('#submitBtn').disabled = true;
  try {
    await api('/auth/signup', { method: 'POST', body: { email: values.email, nickname: values.nickname, password: values.password }, redirectOn401: false });
    location.href = next;
  } catch (err) {
    showError(err.message, err.code === 'EMAIL_TAKEN' ? $('#email') : null);
  } finally {
    $('#submitBtn').disabled = false;
  }
});
