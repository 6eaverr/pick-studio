import { prisma } from './prisma.mjs';

const AUTHOR = { select: { id: true, nickname: true } };
// 상세 조회: 카드는 순서대로, 출처는 등록 순
const FULL = {
  author: AUTHOR,
  cards: { orderBy: { order: 'asc' } },
  sources: { orderBy: { id: 'asc' } },
};
// 목록: 표지 카드 한 장(썸네일용)과 개수만
const SUMMARY = {
  author: AUTHOR,
  cards: { orderBy: { order: 'asc' }, take: 1 },
  _count: { select: { cards: true, sources: true } },
};

// 여러 쿼리를 한 트랜잭션으로 묶을 때 쓰는 옵션 (Supabase 왕복 지연 고려)
export const TX = { timeout: 15000, maxWait: 10000 };

export async function listMagazines({ q, status, type, authorId, page = 1, limit = 20 }) {
  const where = {
    ...(status && { status }),
    ...(type && { type }),
    ...(authorId && { authorId }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { keyword: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [total, magazines] = await prisma.$transaction([
    prisma.magazine.count({ where }),
    prisma.magazine.findMany({ where, include: SUMMARY, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { total, page, limit, magazines };
}

export function getMagazine(id) {
  return prisma.magazine.findUnique({ where: { id }, include: FULL });
}

// 소유자 확인용 최소 정보
export function findMagazineOwner(id) {
  return prisma.magazine.findUnique({ where: { id }, select: { id: true, authorId: true, status: true } });
}

// 매거진 + 카드 5~8장 + 출처를 한 번에(중첩 create는 하나의 트랜잭션)
export function createMagazine(authorId, data, cards, sources = []) {
  return prisma.magazine.create({
    data: {
      ...data,
      authorId,
      cards: { create: cards.map((c, order) => ({ ...c, order })) },
      sources: { create: sources.map(s => ({ ...s, verified: false })) },
    },
    include: FULL,
  });
}

export function updateMagazine(id, data) {
  return prisma.magazine.update({ where: { id }, data, include: FULL });
}

export function deleteMagazine(id) {
  // 카드·출처는 onDelete: Cascade 로 함께 삭제
  return prisma.magazine.delete({ where: { id } });
}

// 카드·출처가 바뀌었을 때 매거진의 updatedAt 갱신 (5단계에서 승인 상태 되돌림도 여기서 처리)
export function touchMagazine(tx, id) {
  return tx.magazine.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true, status: true, updatedAt: true } });
}
