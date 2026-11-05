import { prisma } from './prisma.mjs';
import { beginEdit, finishEdit, statusInfo, TX } from './magazine.service.mjs';
import { badRequest } from '../lib/http-error.mjs';
import { SOURCE_MAX } from '../lib/rules.mjs';

// 출처를 더하거나 빼거나 확인 여부를 바꾸면 승인 조건이 달라지므로 카드와 같은 규칙을 적용합니다.

// 소유자 확인용: 출처가 속한 매거진의 작성자·상태
export function findSourceOwner(id) {
  return prisma.source.findUnique({
    where: { id },
    select: { id: true, magazineId: true, magazine: { select: { id: true, authorId: true, status: true } } },
  });
}

// 새 출처는 항상 미확인(verified=false)으로 시작
export function addSource(magazineId, data) {
  return prisma.$transaction(async tx => {
    const after = await beginEdit(tx, magazineId);
    const count = await tx.source.count({ where: { magazineId } });
    if (count >= SOURCE_MAX) throw badRequest(`출처는 최대 ${SOURCE_MAX}개까지입니다.`, 'SOURCE_LIMIT');
    const source = await tx.source.create({ data: { outlet: data.outlet, title: data.title, url: data.url, verified: false, magazineId } });
    return { source, magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}

// verified 값을 지정하거나(true/false), 생략하면 현재 값을 뒤집음. 값이 그대로면 상태도 그대로.
export function setVerified(id, magazineId, verified) {
  return prisma.$transaction(async tx => {
    const current = await tx.source.findUniqueOrThrow({ where: { id } });
    const next = typeof verified === 'boolean' ? verified : !current.verified;
    if (next === current.verified) return { source: current, magazine: await statusInfo(tx, magazineId) };
    const after = await beginEdit(tx, magazineId);
    const source = await tx.source.update({ where: { id }, data: { verified: next } });
    return { source, magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}

export function deleteSource(id, magazineId) {
  return prisma.$transaction(async tx => {
    const after = await beginEdit(tx, magazineId);
    await tx.source.delete({ where: { id } });
    return { magazine: await finishEdit(tx, magazineId, after) };
  }, TX);
}
