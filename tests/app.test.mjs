import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

// 실제 HTTP로 앱을 띄워 확인합니다(빈 포트 자동 선택).
let server, base;
before(async () => {
  server = createApp({ sessionSecret: 'test-secret' }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('GET /api/health → 200', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('없는 경로 → 404 { message, code: NOT_FOUND }', async () => {
  const r = await fetch(`${base}/api/does-not-exist`);
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.equal(body.code, 'NOT_FOUND');
  assert.equal(typeof body.message, 'string');
});

test('깨진 JSON 본문 → 400 INVALID_JSON', async () => {
  const r = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(await r.json()).sort(), ['code', 'message']);
});

test('다른 출처의 POST → 403 FORBIDDEN_ORIGIN', async () => {
  const r = await fetch(`${base}/api/health`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).code, 'FORBIDDEN_ORIGIN');
});

test('보안 헤더와 정적 파일', async () => {
  const r = await fetch(`${base}/renderer.js`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /javascript/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-powered-by'), null);
});
