import { prisma } from './prisma.mjs';
import { HttpError, badRequest, notFound } from '../lib/http-error.mjs';
import { statusAfterEdit, transitionProblem } from '../shared/status-rules.js';

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

// 매거진 정보 수정. 실제로 바뀐 값이 있을 때만 "수정"으로 보고 승인 규칙을 적용합니다.
// → { magazine, reverted }  (reverted: APPROVED 였다가 REVIEW 로 돌아갔는지)
export function updateMagazine(id, data) {
  return prisma.$transaction(async tx => {
    const current = await tx.magazine.findUnique({ where: { id } });
    if (!current) throw notFound('매거진을 찾을 수 없습니다.');
    const changed = Object.keys(data).filter(k => data[k] !== current[k]);
    if (!changed.length) return { magazine: await tx.magazine.findUnique({ where: { id }, include: FULL }), reverted: false };
    const after = await beginEdit(tx, id);
    const magazine = await tx.magazine.update({ where: { id }, data: { ...data, status: after.status }, include: FULL });
    return { magazine, reverted: after.reverted };
  }, TX);
}

export function deleteMagazine(id) {
  // 카드·출처는 onDelete: Cascade 로 함께 삭제 (게시 완료 매거진도 삭제는 가능)
  return prisma.magazine.delete({ where: { id } });
}

// ── 승인 규칙이 걸린 "내용 수정" 처리 ──
// 1) beginEdit: 수정 전에 호출. PUBLISHED 면 400 PUBLISHED_LOCKED (트랜잭션 전체 취소)
// 2) finishEdit: 수정 후에 호출. updatedAt 갱신 + APPROVED → REVIEW 되돌림
export async function beginEdit(tx, id) {
  const m = await tx.magazine.findUnique({ where: { id }, select: { status: true } });
  if (!m) throw notFound('매거진을 찾을 수 없습니다.');
  const after = statusAfterEdit(m.status);
  if (after.locked) throw badRequest('게시 완료된 매거진은 수정할 수 없습니다.', 'PUBLISHED_LOCKED');
  return after;
}

export async function finishEdit(tx, id, after) {
  const m = await tx.magazine.update({
    where: { id },
    data: { updatedAt: new Date(), status: after.status },
    select: { id: true, status: true, updatedAt: true },
  });
  return { ...m, reverted: after.reverted };
}

// 현재 상태 정보만 (수정이 없었을 때 응답용)
export async function statusInfo(tx, id) {
  const m = await tx.magazine.findUnique({ where: { id }, select: { id: true, status: true, updatedAt: true } });
  return { ...m, reverted: false };
}

// ── 상태 변경 (검토·승인 흐름) ──
// 규칙 위반이면 400 (INVALID_TRANSITION | APPROVAL_BLOCKED), 통과하면 { magazine, from }
export function changeStatus(id, to) {
  return prisma.$transaction(async tx => {
    const m = await tx.magazine.findUnique({ where: { id }, select: { status: true, sources: { select: { outlet: true, title: true, verified: true } } } });
    if (!m) throw notFound('매거진을 찾을 수 없습니다.');
    const problem = transitionProblem(m.status, to, { sources: m.sources });
    if (problem) throw new HttpError(400, problem.code, problem.message);
    const magazine = await tx.magazine.update({ where: { id }, data: { status: to }, select: { id: true, status: true, updatedAt: true } });
    return { magazine, from: m.status };
  }, TX);
}
