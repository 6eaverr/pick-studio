// 실제 DB(Supabase) + 실제 HTTP 로 확인하는 통합 테스트:  npm run test:db
// - 승인 흐름 규칙(순서·승인 조건·수정 시 되돌림·게시 후 잠금·내보내기 403)
// - 소유자 검사(다른 사용자의 매거진·카드·출처 수정·삭제·상태 변경 → 403)
// 테스트용 계정(qa-…@pick.test)을 만들고, 끝나면 계정째 삭제합니다(매거진·카드·출처는 Cascade).
// DATABASE_URL 이 없으면(.env 없음) 건너뜁니다.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const hasDb = !!process.env.DATABASE_URL;

describe('DB 통합: 승인 흐름 · 소유자 검사', { skip: !hasDb && 'DATABASE_URL 없음(.env) — 건너뜀' }, () => {
  let server, base, prisma, A, B, m;
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;

  async function call(method, path, body, cookie) {
    const r = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, body: data, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const signup = async tag => (await call('POST', '/auth/signup', { email: `qa-${tag}-${stamp}@pick.test`, password: randomBytes(12).toString('base64url'), nickname: `QA-${tag}` })).cookie;
  const setStatus = (status, cookie = A) => call('PATCH', `/api/magazines/${m.id}/status`, { status }, cookie);

  before(async () => {
    const { createApp } = await import('../../app.mjs');
    ({ prisma } = await import('../../services/prisma.mjs'));
    server = createApp({ sessionSecret: 'db-test-secret' }).listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
    A = await signup('a');
    B = await signup('b');
    const cards = Array.from({ length: 5 }, (_, i) => ({ headline: `카드 ${i + 1}` }));
    const r = await call('POST', '/api/magazines', { title: `통합 테스트 ${stamp}`, keyword: 'test', cards, sources: [{ outlet: '뉴시스', title: '기사', url: 'https://example.com/a' }] }, A);
    assert.equal(r.status, 201);
    m = r.body.magazine;
  });

  after(async () => {
    const qa = await prisma?.user.findMany({ where: { email: { startsWith: 'qa-', endsWith: `-${stamp}@pick.test` } }, select: { id: true } }) || [];
    // 테스트 계정의 로그인 세션(sessions 테이블)도 함께 정리
    if (qa.length) await prisma.session.deleteMany({ where: { OR: qa.map(u => ({ data: { contains: `"passport":{"user":${u.id}}` } })) } });
    await prisma?.user.deleteMany({ where: { id: { in: qa.map(u => u.id) } } });
    await prisma?.$disconnect();
    server?.close();
  });

  // ── 소유자 검사 ──
  test('다른 사용자는 읽을 수는 있지만 수정·삭제·상태 변경은 403', async () => {
    const view = await call('GET', `/api/magazines/${m.id}`, undefined, B);
    assert.equal(view.status, 200);
    assert.equal(view.body.magazine.isOwner, false);
    const attempts = [
      ['PUT', `/api/magazines/${m.id}`, { title: '탈취' }],
      ['DELETE', `/api/magazines/${m.id}`],
      ['POST', `/api/magazines/${m.id}/cards`, { headline: 'x' }],
      ['PUT', `/api/cards/${m.cards[0].id}`, { headline: 'x' }],
      ['DELETE', `/api/cards/${m.cards[0].id}`],
      ['PATCH', `/api/magazines/${m.id}/cards/order`, { cardIds: m.cards.map(c => c.id).reverse() }],
      ['POST', `/api/magazines/${m.id}/sources`, { outlet: 'o', title: 't', url: 'https://x.com' }],
      ['PATCH', `/api/sources/${m.sources[0].id}`, { verified: true }],
      ['DELETE', `/api/sources/${m.sources[0].id}`],
      ['PATCH', `/api/magazines/${m.id}/status`, { status: 'REVIEW' }],
    ];
    for (const [method, path, body] of attempts) {
      const r = await call(method, path, body, B);
      assert.equal(r.status, 403, `${method} ${path}`);
      assert.deepEqual(Object.keys(r.body).sort(), ['code', 'message']);
      assert.equal(r.body.code, 'NOT_OWNER');
    }
    const still = (await call('GET', `/api/magazines/${m.id}`, undefined, A)).body.magazine;
    assert.equal(still.title, m.title);
    assert.equal(still.cards.length, 5);
    assert.equal(still.sources[0].verified, false);
  });

  test('로그인하지 않으면 401', async () => {
    assert.equal((await call('GET', `/api/magazines/${m.id}`)).status, 401);
    assert.equal((await call('PUT', `/api/magazines/${m.id}`, { title: 'x' })).status, 401);
  });

  // ── 승인 흐름 ──
  test('건너뛰기·역방향은 400 INVALID_TRANSITION', async () => {
    for (const s of ['APPROVED', 'PUBLISHED', 'DRAFT']) {
      const r = await setStatus(s);
      assert.equal(r.status, 400, s);
      assert.equal(r.body.code, 'INVALID_TRANSITION');
    }
  });

  test('DRAFT → REVIEW, 출처 미확인이면 승인 거부(APPROVAL_BLOCKED), 확인하면 승인', async () => {
    assert.equal((await setStatus('REVIEW')).body.magazine.status, 'REVIEW');
    const blocked = await setStatus('APPROVED');
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.code, 'APPROVAL_BLOCKED');
    assert.match(blocked.body.message, /뉴시스/);
    await call('PATCH', `/api/sources/${m.sources[0].id}`, { verified: true }, A);
    assert.equal((await setStatus('APPROVED')).body.magazine.status, 'APPROVED');
  });

  test('APPROVED 에서 수정하면 REVIEW 로 자동 되돌림', async () => {
    const r = await call('PUT', `/api/cards/${m.cards[1].id}`, { headline: '고친 제목' }, A);
    assert.equal(r.status, 200);
    assert.equal(r.body.magazine.status, 'REVIEW');
    assert.equal(r.body.magazine.reverted, true);
    assert.equal((await setStatus('APPROVED')).status, 200);
  });

  test('내보내기는 APPROVED 이상 + 작성자만', async () => {
    assert.equal((await call('POST', `/api/magazines/${m.id}/export`, { images: [] }, B)).status, 403);
    // 승인 상태라 상태 검사는 통과 → 이미지 검사에서 400
    const r = await call('POST', `/api/magazines/${m.id}/export`, { images: [] }, A);
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'INVALID_EXPORT');
  });

  test('PUBLISHED 후에는 수정 400 PUBLISHED_LOCKED, 상태도 더 못 바꿈', async () => {
    assert.equal((await setStatus('PUBLISHED')).body.magazine.status, 'PUBLISHED');
    const r = await call('PUT', `/api/magazines/${m.id}`, { caption: '수정 시도' }, A);
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'PUBLISHED_LOCKED');
    assert.equal((await setStatus('APPROVED')).body.code, 'INVALID_TRANSITION');
    const after = (await call('GET', `/api/magazines/${m.id}`, undefined, A)).body.magazine;
    assert.equal(after.caption, ''); // 거부된 수정은 반영되지 않음
  });
});
