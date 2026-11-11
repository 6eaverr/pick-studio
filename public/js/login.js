import { api, safeNext } from './api.js';
import { $, startEmpty } from './ui.js';

startEmpty($('#loginForm'));
const next = safeNext(new URLSearchParams(location.search).get('next'));
$('#signupLink').href = `/signup.html${next !== '/magazines.html' ? `?next=${encodeURIComponent(next)}` : ''}`;

function showError(message) {
  $('#formError').textContent = message;
  $('#formError').hidden = false;
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#formError').hidden = true;
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (!email || !password) return showError('이메일과 비밀번호를 입력하세요.');
  $('#submitBtn').disabled = true;
  try {
    await api('/auth/login', { method: 'POST', body: { email, password }, redirectOn401: false });
    location.href = next;
  } catch (err) {
    showError(err.code === 'ALREADY_LOGGED_IN' ? '이미 로그인되어 있습니다. 잠시 후 이동합니다.' : err.message);
    if (err.code === 'ALREADY_LOGGED_IN') setTimeout(() => { location.href = next; }, 800);
    $('#password').value = '';
    $('#password').focus();
  } finally {
    $('#submitBtn').disabled = false;
  }
});
