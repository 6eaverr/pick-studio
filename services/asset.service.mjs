import { createHash } from 'node:crypto';
import { prisma } from './prisma.mjs';
import { imageType } from '../lib/images.mjs';
import { badRequest } from '../lib/http-error.mjs';

// Vercel 요청 본문 한도(4.5MB) 안에 들어오도록 4MB
export const MAX_UPLOAD = 4 * 1024 * 1024;
export const ASSET_NAME_RE = /^[0-9a-f]{64}\.(jpg|png|webp)$/;

// 카드 사진 저장 (DB assets 테이블): 내용 해시를 이름으로 써서 같은 사진은 한 번만 저장 → '/assets/<sha256>.<jpg|png|webp>'
// 서버가 요청마다 바뀌고 디스크가 없는 Vercel 에서도, 로컬에서도 같은 방식으로 동작합니다.
export async function saveImage(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw badRequest('이미지 파일을 보내 주세요(JPG·PNG·WEBP).', 'INVALID_IMAGE');
  if (bytes.length > MAX_UPLOAD) throw badRequest('이미지는 4MB 이하여야 합니다.', 'INVALID_IMAGE');
  let type;
  try { type = imageType(bytes); } catch { throw badRequest('JPG, PNG, WEBP 이미지 파일만 올릴 수 있습니다.', 'INVALID_IMAGE'); }
  const name = `${createHash('sha256').update(bytes).digest('hex')}.${type.extension}`;
  const exists = await prisma.asset.findUnique({ where: { name }, select: { name: true } });
  if (!exists) {
    await prisma.asset.create({ data: { name, mime: type.mime, size: bytes.length, bytes } })
      .catch(e => { if (e.code !== 'P2002') throw e; }); // 동시에 같은 사진을 올린 경우
  }
  return `/assets/${name}`;
}

export function findImage(name) {
  return prisma.asset.findUnique({ where: { name }, select: { mime: true, bytes: true } });
}
