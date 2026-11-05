import { prisma } from './prisma.mjs';
import { beginEdit, finishEdit, statusInfo, TX } from './magazine.service.mjs';
import { badRequest } from '../lib/http-error.mjs';
import { CARD_MIN, CARD_MAX } from '../lib/rules.mjs';

// 모든 수정은 트랜잭션 안에서 beginEdit(게시 완료면 거부) → 수정 → finishEdit(승인 상태면 REVIEW로) 순서.
// 응답의 magazine = { id, status, updatedAt, reverted }

// 소유자 확인용: 카드가 속한 매거진의 작성자·상태
export function findCardOwner(id) {
  return prisma.card.findUnique({
    where: { id },
    select: { id: true, magazineId: true, magazine: { select: { id: true, authorId: true, status: true } } },
  });
}

// 맨 뒤에 카드 추가 (최대 CARD_MAX장)
export function addCard(magazineId, data) {
  return prisma.$transaction(async tx => {
    const after = await beginEdit(tx, magazineId);
    const count = await tx.card.count({ where: { magazineId } });
    if (count >= CARD_MAX) throw badRequest(`카드는 최대 ${CARD_MAX}장까지입니다.`, 'CARD_LIMIT');
    const card = await tx.card.create({ data: { ...data, photoUrl: data.photoUrl || null, order: count, magazineId } });
    return { card, magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}

// 카드 수정. 실제로 바뀐 값이 없으면 승인 상태를 건드리지 않습니다.
export function updateCard(id, magazineId, data) {
  return prisma.$transaction(async tx => {
    if (data.photoUrl === '') data.photoUrl = null;
    const current = await tx.card.findUniqueOrThrow({ where: { id } });
    if (!Object.keys(data).some(k => data[k] !== current[k])) return { card: current, magazine: await statusInfo(tx, magazineId) };
    const after = await beginEdit(tx, magazineId);
    const card = await tx.card.update({ where: { id }, data });
    return { card, magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}

// 카드 삭제 (최소 CARD_MIN장 유지) 후 남은 카드 순서를 0부터 다시 매김
export function deleteCard(id, magazineId) {
  return prisma.$transaction(async tx => {
    const after = await beginEdit(tx, magazineId);
    const count = await tx.card.count({ where: { magazineId } });
    if (count <= CARD_MIN) throw badRequest(`카드는 최소 ${CARD_MIN}장이어야 합니다.`, 'CARD_LIMIT');
    await tx.card.delete({ where: { id } });
    const rest = await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' }, select: { id: true } });
    for (const [order, c] of rest.entries()) await tx.card.update({ where: { id: c.id }, data: { order } });
    return { magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}

// cardIds 순서대로 order 를 0,1,2… 로 지정. 매거진의 카드 전체를 빠짐없이 보내야 합니다.
export function reorderCards(magazineId, cardIds) {
  return prisma.$transaction(async tx => {
    const current = await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' }, select: { id: true } });
    const known = new Set(current.map(c => c.id));
    if (cardIds.length !== known.size || !cardIds.every(id => known.has(id))) {
      throw badRequest('cardIds 에 이 매거진의 카드 id를 빠짐없이, 한 번씩 보내야 합니다.', 'INVALID_ORDER');
    }
    if (current.every((c, i) => c.id === cardIds[i])) {
      return { cards: await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' } }), magazine: await statusInfo(tx, magazineId) };
    }
    const after = await beginEdit(tx, magazineId);
    for (const [order, id] of cardIds.entries()) await tx.card.update({ where: { id }, data: { order } });
    const cards = await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' } });
    return { cards, magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}
