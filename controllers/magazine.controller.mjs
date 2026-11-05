import * as magazines from '../services/magazine.service.mjs';
import { pick, parseId } from '../validators/common.mjs';
import { MAGAZINE_RULES, CARD_RULES } from '../validators/magazine.validator.mjs';
import { notFound } from '../lib/http-error.mjs';

const MAGAZINE_FIELDS = Object.keys(MAGAZINE_RULES);
const CARD_FIELDS = Object.keys(CARD_RULES);

// 레이아웃을 안 보냈으면: 첫 장 표지, 마지막 장 마무리, 나머지 본문
const defaultLayout = (i, n) => (i === 0 ? 'cover' : i === n - 1 ? 'end' : 'story');

// 로그인 사용자가 작성자인지 화면에 알려 줌 (본인 글이 아니면 수정·삭제 버튼 숨김)
const withOwnership = (m, user) => ({ ...m, isOwner: m.authorId === user.id });

// GET /api/magazines?q=&status=&type=&mine=1&page=&limit=
export async function list(req, res) {
  const { q, status, type, mine, page, limit } = req.query;
  const result = await magazines.listMagazines({
    q: q?.trim() || undefined,
    status,
    type,
    authorId: mine === '1' || mine === 'true' ? req.user.id : undefined,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
  });
  res.json({ ...result, magazines: result.magazines.map(m => withOwnership(m, req.user)) });
}

// GET /api/magazines/:id
export async function detail(req, res) {
  const magazine = await magazines.getMagazine(parseId(req.params.id));
  if (!magazine) throw notFound('매거진을 찾을 수 없습니다.');
  res.json({ magazine: withOwnership(magazine, req.user) });
}

// POST /api/magazines → 201 (항상 DRAFT로 시작)
export async function create(req, res) {
  const data = pick(req.body, MAGAZINE_FIELDS);
  const n = req.body.cards.length;
  const cards = req.body.cards.map((c, i) => ({ layout: defaultLayout(i, n), ...pick(c, CARD_FIELDS) }));
  const sources = (req.body.sources || []).map(s => pick(s, ['outlet', 'title', 'url']));
  const magazine = await magazines.createMagazine(req.user.id, data, cards, sources);
  res.status(201).location(`/api/magazines/${magazine.id}`).json({ magazine: withOwnership(magazine, req.user) });
}

// PUT /api/magazines/:id (소유자만)
export async function update(req, res) {
  const magazine = await magazines.updateMagazine(req.magazine.id, pick(req.body, MAGAZINE_FIELDS));
  res.json({ magazine: withOwnership(magazine, req.user) });
}

// DELETE /api/magazines/:id (소유자만) → 204
export async function remove(req, res) {
  await magazines.deleteMagazine(req.magazine.id);
  res.status(204).end();
}
