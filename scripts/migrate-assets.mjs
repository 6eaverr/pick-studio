// 로컬 data/assets/ 의 카드 사진을 DB(assets 테이블)로 옮깁니다. 배포(Vercel)에서도 사진이 보이게 하려면 한 번 실행하세요.
//   npm run db:assets              → 카드가 쓰는 사진만
//   npm run db:assets -- --all     → 폴더의 사진 전부
// 이미 있는 사진은 건너뜁니다(여러 번 실행해도 안전). 원본 파일은 지우지 않습니다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ASSETS, ROOT } from '../lib/paths.mjs';
import { imageType } from '../lib/images.mjs';

const all = process.argv.includes('--all');
const { prisma } = await import('../services/prisma.mjs');
try {
  const used = new Set((await prisma.card.findMany({ where: { photoUrl: { not: null } }, select: { photoUrl: true } })).map(c => c.photoUrl.replace('/assets/', '')));
  let files = [];
  try { files = readdirSync(ASSETS).filter(n => /^[0-9a-f]{64}\.(jpg|png|webp)$/.test(n)); } catch { /* 폴더 없음 */ }
  if (!all) files = files.filter(n => used.has(n));
  let added = 0, skipped = 0, bad = 0, totalBytes = 0;
  for (const name of files) {
    if (await prisma.asset.findUnique({ where: { name }, select: { name: true } })) { skipped++; continue; }
    const bytes = readFileSync(path.join(ASSETS, name));
    const hash = createHash('sha256').update(bytes).digest('hex');
    let type;
    try { type = imageType(bytes); } catch { bad++; continue; }
    if (`${hash}.${type.extension}` !== name) { bad++; continue; } // 이름과 내용이 다르면 건너뜀
    await prisma.asset.create({ data: { name, mime: type.mime, size: bytes.length, bytes } });
    added++; totalBytes += bytes.length;
  }
  const missing = [...used].filter(n => !files.includes(n));
  console.log(`사진 ${files.length}개 확인: 새로 저장 ${added}개(${(totalBytes / 1024 / 1024).toFixed(1)}MB), 이미 있음 ${skipped}개, 건너뜀 ${bad}개`);
  const stillMissing = [];
  const bundled = new Set(readdirSync(path.join(ROOT, 'public', 'assets'))); // 기본 에셋(git 에 포함, CDN 이 제공)
  for (const n of missing) {
    if (bundled.has(n)) continue;
    if (!(await prisma.asset.findUnique({ where: { name: n }, select: { name: true } }))) stillMissing.push(n);
  }
  if (stillMissing.length) console.log(`주의: 카드가 쓰는데 파일·DB 어디에도 없는 사진 ${stillMissing.length}개`);
  console.log(`DB 사진 총 ${await prisma.asset.count()}개`);
} catch (e) {
  console.error('사진 옮기기 실패:', e.code || '', String(e.message).split('\n').find(l => l.trim()));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
