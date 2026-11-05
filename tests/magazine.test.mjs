import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCreateMagazine, checkUpdateMagazine, checkListQuery, checkCreateCard, checkUpdateCard,
  checkReorder, checkCreateSource, checkPatchSource,
} from '../validators/magazine.validator.mjs';
import { isOwner } from '../middlewares/auth.mjs';

const V = { code: 'VALIDATION_ERROR', status: 400 };
const card = (i = 0) => ({ headline: `제목 ${i + 1}` });
const cards = n => Array.from({ length: n }, (_, i) => card(i));
const base = () => ({ title: '실리카겔 입문 4곡', keyword: '실리카겔', cards: cards(6) });
const create = body => () => checkCreateMagazine({ body });

// ── 매거진 생성 ──
test('생성: 올바른 입력 통과 (출처 포함)', () => {
  assert.doesNotThrow(create(base()));
  assert.doesNotThrow(create({ ...base(), type: 'ISSUE', template: 'playlist', theme: 'cobalt', sources: [{ outlet: '뉴시스', title: 't', url: 'https://www.newsis.com/a' }] }));
});

test('생성: 제목 1~60자', () => {
  assert.throws(create({ ...base(), title: '' }), V);
  assert.throws(create({ ...base(), title: '   ' }), V);
  assert.throws(create({ ...base(), title: 'a'.repeat(61) }), V);
  assert.doesNotThrow(create({ ...base(), title: 'a'.repeat(60) }));
});

test('생성: 카드 5~8장', () => {
  assert.throws(create({ ...base(), cards: cards(4) }), V);
  assert.throws(create({ ...base(), cards: cards(9) }), V);
  assert.throws(create({ ...base(), cards: undefined }), V);
  assert.doesNotThrow(create({ ...base(), cards: cards(5) }));
  assert.doesNotThrow(create({ ...base(), cards: cards(8) }));
});

test('생성: type 허용값, status 는 받지 않음', () => {
  assert.throws(create({ ...base(), type: 'NEWS' }), V);
  assert.throws(create({ ...base(), status: 'APPROVED' }), V);
  assert.throws(create({ ...base(), template: 'unknown' }), V);
});

test('생성: 카드 사진은 업로드 경로만, 레이아웃 허용값', () => {
  assert.throws(create({ ...base(), cards: [{ headline: 'x', photoUrl: 'https://evil.example/a.jpg' }, ...cards(5)] }), V);
  assert.throws(create({ ...base(), cards: [{ headline: 'x', layout: 'poster' }, ...cards(5)] }), V);
  assert.doesNotThrow(create({ ...base(), cards: [{ headline: 'x', photoUrl: '/assets/abc.jpg', layout: 'cover' }, ...cards(5)] }));
});

test('생성: 출처 url 형식', () => {
  const src = url => ({ ...base(), sources: [{ outlet: 'o', title: 't', url }] });
  for (const url of ['not a url', 'ftp://x.com/a', 'javascript:alert(1)', 'https://user:pw@x.com', '']) assert.throws(create(src(url)), V, url);
  assert.doesNotThrow(create(src('http://example.com/path?q=1')));
});

// ── 매거진 수정 ──
test('수정: 일부 필드만, 빈 요청·status·cards 거부', () => {
  assert.doesNotThrow(() => checkUpdateMagazine({ body: { caption: '새 캡션' } }));
  assert.throws(() => checkUpdateMagazine({ body: {} }), V);
  assert.throws(() => checkUpdateMagazine({ body: { status: 'PUBLISHED' } }), V);
  assert.throws(() => checkUpdateMagazine({ body: { cards: cards(6) } }), V);
  assert.throws(() => checkUpdateMagazine({ body: { title: 'a'.repeat(61) } }), V);
});

// ── 목록 검색·필터 ──
test('목록: status·type 허용값만', () => {
  assert.doesNotThrow(() => checkListQuery({ query: { q: '실리카겔', status: 'REVIEW', type: 'CURATION', mine: '1' } }));
  assert.throws(() => checkListQuery({ query: { status: 'done' } }), V);
  assert.throws(() => checkListQuery({ query: { type: 'curation' } }), V);
  assert.throws(() => checkListQuery({ query: { mine: 'yes' } }), V);
  assert.throws(() => checkListQuery({ query: { page: '-1' } }), V);
});

// ── 카드·순서·출처 ──
test('카드 추가·수정 검증', () => {
  assert.doesNotThrow(() => checkCreateCard({ body: { headline: 'h' } }));
  assert.throws(() => checkCreateCard({ body: { body: '제목 없음' } }), V);
  assert.throws(() => checkUpdateCard({ body: {} }), V);
  assert.throws(() => checkUpdateCard({ body: { headline: '' } }), V);
});

test('순서 변경: 정수 id 5~8개, 중복 없음', () => {
  assert.doesNotThrow(() => checkReorder({ body: { cardIds: [5, 4, 3, 2, 1] } }));
  assert.throws(() => checkReorder({ body: { cardIds: [1, 2, 3, 4] } }), V);
  assert.throws(() => checkReorder({ body: { cardIds: [1, 1, 2, 3, 4] } }), V);
  assert.throws(() => checkReorder({ body: { cardIds: ['1', 2, 3, 4, 5] } }), V);
});

test('출처 추가·확인 토글 검증', () => {
  assert.throws(() => checkCreateSource({ body: { outlet: 'o', title: 't' } }), V);
  assert.doesNotThrow(() => checkPatchSource({ body: {} }));
  assert.doesNotThrow(() => checkPatchSource({ body: { verified: true } }));
  assert.throws(() => checkPatchSource({ body: { verified: 'yes' } }), V);
});

// ── 소유자 확인 (DB 대신 가짜 로더) ──
const loaders = {
  magazine: async id => (id === 1 ? { magazine: { id: 1, authorId: 10, status: 'DRAFT' } } : null),
  card: async id => (id === 7 ? { magazine: { id: 1, authorId: 10, status: 'DRAFT' }, card: { id: 7, magazineId: 1 } } : null),
  source: async () => null,
};
async function runOwner(kind, id, userId) {
  const req = { params: { id: String(id) }, user: userId ? { id: userId } : undefined };
  const err = await new Promise(resolve => isOwner(kind, loaders)(req, {}, resolve));
  return { err, req };
}

test('isOwner: 작성자는 통과하고 req.magazine 이 채워짐', async () => {
  const { err, req } = await runOwner('magazine', 1, 10);
  assert.equal(err, undefined);
  assert.deepEqual(req.magazine, { id: 1, authorId: 10, status: 'DRAFT' });
});

test('isOwner: 다른 사용자 → 403 NOT_OWNER', async () => {
  assert.equal((await runOwner('magazine', 1, 99)).err.status, 403);
  assert.equal((await runOwner('card', 7, 99)).err.code, 'NOT_OWNER');
});

test('isOwner: 카드는 소속 매거진의 작성자로 판단', async () => {
  const { err, req } = await runOwner('card', 7, 10);
  assert.equal(err, undefined);
  assert.equal(req.card.magazineId, 1);
});

test('isOwner: 없는 대상 404, 잘못된 id 400, 비로그인 401', async () => {
  assert.equal((await runOwner('magazine', 2, 10)).err.status, 404);
  assert.equal((await runOwner('source', 3, 10)).err.status, 404);
  assert.equal((await runOwner('magazine', 'abc', 10)).err.code, 'INVALID_ID');
  assert.equal((await runOwner('magazine', '1.5', 10)).err.code, 'INVALID_ID');
  assert.equal((await runOwner('magazine', 1, null)).err.status, 401);
});
