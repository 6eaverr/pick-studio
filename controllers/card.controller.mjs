import * as cards from '../services/card.service.mjs';
import { pick } from '../validators/common.mjs';
import { CARD_RULES } from '../validators/magazine.validator.mjs';

const CARD_FIELDS = Object.keys(CARD_RULES);

// 응답의 magazine 은 { id, status, updatedAt, reverted } — 승인 상태가 REVIEW 로 되돌아가면 화면이 바로 알 수 있게

// POST /api/magazines/:id/cards → 201 (맨 뒤에 추가)
export async function create(req, res) {
  const result = await cards.addCard(req.magazine.id, { layout: 'story', ...pick(req.body, CARD_FIELDS) });
  res.status(201).json(result);
}

// PUT /api/cards/:id
export async function update(req, res) {
  res.json(await cards.updateCard(req.card.id, req.card.magazineId, pick(req.body, CARD_FIELDS)));
}

// DELETE /api/cards/:id → 200 { magazine }
export async function remove(req, res) {
  res.json(await cards.deleteCard(req.card.id, req.card.magazineId));
}

// PATCH /api/magazines/:id/cards/order  { cardIds: [3, 1, 2, ...] }
export async function reorder(req, res) {
  res.json(await cards.reorderCards(req.magazine.id, req.body.cardIds));
}
