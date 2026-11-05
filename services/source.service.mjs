import { prisma } from './prisma.mjs';
import { touchMagazine, TX } from './magazine.service.mjs';
import { badRequest } from '../lib/http-error.mjs';
import { SOURCE_MAX } from '../lib/rules.mjs';

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
    const count = await tx.source.count({ where: { magazineId } });
    if (count >= SOURCE_MAX) throw badRequest(`출처는 최대 ${SOURCE_MAX}개까지입니다.`, 'SOURCE_LIMIT');
    const source = await tx.source.create({ data: { outlet: data.outlet, title: data.title, url: data.url, verified: false, magazineId } });
    const magazine = await touchMagazine(tx, magazineId);
    return { source, magazine };
  }, TX);
}

// verified 값을 지정하거나(true/false), 생략하면 현재 값을 뒤집음
export function setVerified(id, magazineId, verified) {
  return prisma.$transaction(async tx => {
    const next = typeof verified === 'boolean'
      ? verified
      : !(await tx.source.findUniqueOrThrow({ where: { id }, select: { verified: true } })).verified;
    const source = await tx.source.update({ where: { id }, data: { verified: next } });
    const magazine = await touchMagazine(tx, magazineId);
    return { source, magazine };
  }, TX);
}

export function deleteSource(id, magazineId) {
  return prisma.$transaction(async tx => {
    await tx.source.delete({ where: { id } });
    const magazine = await touchMagazine(tx, magazineId);
    return { magazine };
  }, TX);
}
