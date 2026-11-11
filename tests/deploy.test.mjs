import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, defaultStore } from '../config/session.mjs';
import { PrismaSessionStore } from '../config/session-store.mjs';

// 배포(Vercel) 설정 확인 — DB 없이

test('세션 저장소: DB 가 있으면 PrismaSessionStore, 없거나 SESSION_STORE=memory 면 메모리', () => {
  const saved = { url: process.env.DATABASE_URL, store: process.env.SESSION_STORE };
  try {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/x';
    delete process.env.SESSION_STORE;
    assert.ok(defaultStore() instanceof PrismaSessionStore);
    process.env.SESSION_STORE = 'memory';
    assert.equal(defaultStore(), undefined);
    delete process.env.SESSION_STORE;
    delete process.env.DATABASE_URL;
    assert.equal(defaultStore(), undefined);
    assert.equal(typeof createSession({ secret: 's' }), 'function');
  } finally {
    if (saved.url === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.url;
    if (saved.store === undefined) delete process.env.SESSION_STORE; else process.env.SESSION_STORE = saved.store;
  }
});

test('vercel.json: 정적 파일은 public, 나머지는 Express 함수로, 보안 헤더 포함', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(v.outputDirectory, 'public');
  assert.deepEqual(v.rewrites, [{ source: '/(.*)', destination: '/api/index' }]);
  assert.match(v.functions['api/index.mjs'].includeFiles, /shared/);
  const headers = v.headers[0].headers.map(h => h.key);
  for (const h of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']) assert.ok(headers.includes(h), h);
});

test('Prisma: Vercel(rhel) 엔진 포함', () => {
  assert.match(readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'), /rhel-openssl-3\.0\.x/);
});
