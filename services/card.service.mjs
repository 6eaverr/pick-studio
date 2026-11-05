import { prisma } from './prisma.mjs';
import { touchMagazine, TX } from './magazine.service.mjs';
import { badRequest } from '../lib/http-error.mjs';
import { CARD_MIN, CARD_MAX } from '../lib/rules.mjs';

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
    const count = await tx.card.count({ where: { magazineId } });
    if (count >= CARD_MAX) throw badRequest(`카드는 최대 ${CARD_MAX}장까지입니다.`, 'CARD_LIMIT');
    const card = await tx.card.create({ data: { ...data, photoUrl: data.photoUrl || null, order: count, magazineId } });
    const magazine = await touchMagazine(tx, magazineId);
    return { card, magazine };
  }, TX);
}

export function updateCard(id, magazineId, data) {
  return prisma.$transaction(async tx => {
    if (data.photoUrl === '') data.photoUrl = null;
    const card = await tx.card.update({ where: { id }, data });
    const magazine = await touchMagazine(tx, magazineId);
    return { card, magazine };
  }, TX);
}

// 카드 삭제 (최소 CARD_MIN장 유지) 후 남은 카드 순서를 0부터 다시 매김
export function deleteCard(id, magazineId) {
  return prisma.$transaction(async tx => {
    const count = await tx.card.count({ where: { magazineId } });
    if (count <= CARD_MIN) throw badRequest(`카드는 최소 ${CARD_MIN}장이어야 합니다.`, 'CARD_LIMIT');
    await tx.card.delete({ where: { id } });
    const rest = await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' }, select: { id: true } });
    for (const [order, c] of rest.entries()) await tx.card.update({ where: { id: c.id }, data: { order } });
    const magazine = await touchMagazine(tx, magazineId);
    return { magazine };
  }, TX);
}

// cardIds 순서대로 order 를 0,1,2… 로 지정. 매거진의 카드 전체를 빠짐없이 보내야 합니다.
export function reorderCards(magazineId, cardIds) {
  return prisma.$transaction(async tx => {
    const current = await tx.card.findMany({ where: { magazineId }, select: { id: true } });
    const known = new Set(current.map(c => c.id));
    if (cardIds.length !== known.size || !cardIds.every(id => known.has(id))) {
      throw badRequest('cardIds 에 이 매거진의 카드 id를 빠짐없이, 한 번씩 보내야 합니다.', 'INVALID_ORDER');
    }
    for (const [order, id] of cardIds.entries()) await tx.card.update({ where: { id }, data: { order } });
    const cards = await tx.card.findMany({ where: { magazineId }, orderBy: { order: 'asc' } });
    const magazine = await touchMagazine(tx, magazineId);
    return { cards, magazine };
  }, TX);
}
