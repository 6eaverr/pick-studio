import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { checkSignup, checkLogin } from '../validators/auth.validator.mjs';
import { isLoggedIn, isNotLoggedIn } from '../middlewares/auth.mjs';
import { createApp } from '../app.mjs';

// ── 입력 검증 (DB 불필요) ──
const signup = body => () => checkSignup({ body });
const ok = { email: 'a@pick.kr', password: '12345678', nickname: '에디터' };

test('회원가입 검증: 올바른 입력은 통과', () => {
  assert.doesNotThrow(signup(ok));
  assert.doesNotThrow(signup({ ...ok, email: '  Mixed.Case@Pick.KR ' }));
});

test('회원가입 검증: 이메일 형식', () => {
  for (const email of ['', 'abc', 'a@b', 'a b@pick.kr', 'a@pick.k', undefined, 123]) {
    assert.throws(signup({ ...ok, email }), { status: 400, code: 'VALIDATION_ERROR' }, String(email));
  }
});

test('회원가입 검증: 비밀번호 8자 이상, 72바이트 이하', () => {
  assert.throws(signup({ ...ok, password: '1234567' }), { code: 'VALIDATION_ERROR' });
  assert.throws(signup({ ...ok, password: 12345678 }), { code: 'VALIDATION_ERROR' });
  assert.throws(signup({ ...ok, password: 'a'.repeat(73) }), { code: 'VALIDATION_ERROR' });
  assert.doesNotThrow(signup({ ...ok, password: 'a'.repeat(72) }));
});

test('회원가입 검증: 닉네임 1~20자', () => {
  assert.throws(signup({ ...ok, nickname: '   ' }), { code: 'VALIDATION_ERROR' });
  assert.throws(signup({ ...ok, nickname: 'a'.repeat(21) }), { code: 'VALIDATION_ERROR' });
});

test('로그인 검증: 이메일·비밀번호 필수', () => {
  assert.throws(() => checkLogin({ body: { email: 'x', password: 'p' } }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => checkLogin({ body: { email: 'a@pick.kr', password: '' } }), { code: 'VALIDATION_ERROR' });
  assert.doesNotThrow(() => checkLogin({ body: { email: 'a@pick.kr', password: 'p' } }));
});

// ── 인증 미들웨어 ──
const run = (mw, authenticated) => {
  let passed;
  mw({ isAuthenticated: () => authenticated }, {}, e => { passed = e; });
  return passed;
};

test('isLoggedIn: 로그인 안 했으면 401, 했으면 통과', () => {
  assert.equal(run(isLoggedIn, false).status, 401);
  assert.equal(run(isLoggedIn, true), undefined);
});

test('isNotLoggedIn: 이미 로그인했으면 400 ALREADY_LOGGED_IN', () => {
  assert.equal(run(isNotLoggedIn, true).code, 'ALREADY_LOGGED_IN');
  assert.equal(run(isNotLoggedIn, false), undefined);
});

// ── HTTP (DB에 닿기 전에 끝나는 경로만) ──
let server, base;
before(async () => {
  server = createApp({ sessionSecret: 'test-secret' }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /auth/me 로그인 없이 → 401 UNAUTHORIZED', async () => {
  const r = await fetch(`${base}/auth/me`);
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { message: '로그인이 필요합니다.', code: 'UNAUTHORIZED' });
});

test('POST /auth/logout 로그인 없이 → 401', async () => {
  assert.equal((await post('/auth/logout', {})).status, 401);
});

test('POST /auth/signup 잘못된 입력 → 400 VALIDATION_ERROR, 세션 쿠키 없음', async () => {
  const r = await post('/auth/signup', { email: 'nope', password: 'short', nickname: '' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, 'VALIDATION_ERROR');
  assert.equal(r.headers.get('set-cookie'), null);
});

// ── 화면 접근 제어 ──
const page = path => fetch(base + path, { redirect: 'manual' });

test('로그인 없이 / → 로그인 화면으로 이동', async () => {
  const r = await page('/');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/login.html');
});

test('로그인 없이 보호된 화면 → /login.html?next=원래주소', async () => {
  for (const p of ['/magazines.html?status=REVIEW', '/magazine.html?id=3', '/edit.html', '/review.html?id=1', '/export.html?id=1']) {
    const r = await page(p);
    assert.equal(r.status, 302, p);
    assert.equal(r.headers.get('location'), `/login.html?next=${encodeURIComponent(p)}`);
  }
});

test('로그인·회원가입 화면은 로그인 없이 열림', async () => {
  for (const p of ['/login.html', '/signup.html']) assert.equal((await page(p)).status, 200, p);
});
