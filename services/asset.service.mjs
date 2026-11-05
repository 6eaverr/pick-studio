import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ASSETS } from '../lib/paths.mjs';
import { imageType } from '../lib/images.mjs';
import { badRequest } from '../lib/http-error.mjs';

export const MAX_UPLOAD = 8 * 1024 * 1024;

// 카드 사진 저장: 내용 해시를 파일 이름으로 써서 같은 사진은 한 번만 저장 → '/assets/<sha256>.<jpg|png|webp>'
export function saveImage(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw badRequest('이미지 파일을 보내 주세요(JPG·PNG·WEBP).', 'INVALID_IMAGE');
  if (bytes.length > MAX_UPLOAD) throw badRequest('이미지는 8MB 이하여야 합니다.', 'INVALID_IMAGE');
  let type;
  try { type = imageType(bytes); } catch { throw badRequest('JPG, PNG, WEBP 이미지 파일만 올릴 수 있습니다.', 'INVALID_IMAGE'); }
  mkdirSync(ASSETS, { recursive: true });
  const name = `${createHash('sha256').update(bytes).digest('hex')}.${type.extension}`;
  const file = path.join(ASSETS, name);
  if (!existsSync(file)) writeFileSync(file, bytes);
  return `/assets/${name}`;
}
