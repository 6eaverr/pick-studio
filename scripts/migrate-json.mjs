// 기존 data/projects.json → Supabase(DB) 마이그레이션 (선택 실행)
//
//   미리보기(DB 접근 없음):  npm run db:import -- --dry-run
//   실제 가져오기:           npm run db:import -- --email 내계정@example.com
//
// - 소유자 계정은 미리 회원가입되어 있어야 합니다(비밀번호를 스크립트에서 다루지 않기 위해).
// - 같은 소유자·제목·작성 시각의 매거진이 이미 있으면 건너뜁니다(여러 번 실행해도 중복 없음).
// - 매거진 하나를 카드·출처와 함께 트랜잭션으로 넣습니다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { mapProject } from '../lib/legacy-map.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({
  options: {
    email: { type: 'string' },
    file: { type: 'string', default: path.join(process.env.PICK_DATA_DIR || path.join(ROOT, 'data'), 'projects.json') },
    'dry-run': { type: 'boolean', default: false },
  },
});

const { projects = [] } = JSON.parse(readFileSync(args.file, 'utf8'));
const mapped = projects.map(p => ({ id: p.id, ...mapProject(p) }));

console.log(`원본: ${args.file}`);
console.log(`원고 ${projects.length}개`);
console.table(mapped.map(m => ({
  제목: m.magazine.title.slice(0, 28),
  상태: m.magazine.status,
  종류: m.magazine.type,
  템플릿: m.magazine.template,
  카드: m.cards.length,
  출처: m.sources.length,
  확인됨: m.sources.filter(s => s.verified).length,
  경고: m.warnings.join(' / ') || '-',
})));

if (args['dry-run']) {
  console.log('--dry-run: DB에는 아무것도 쓰지 않았습니다.');
  process.exit(0);
}
if (!args.email) {
  console.error('소유자 이메일이 필요합니다: npm run db:import -- --email 내계정@example.com');
  process.exit(1);
}

const { prisma } = await import('../services/prisma.mjs');
try {
  const owner = await prisma.user.findUnique({ where: { email: args.email.trim().toLowerCase() } });
  if (!owner) throw new Error(`${args.email} 계정이 없습니다. 먼저 회원가입한 뒤 다시 실행하세요.`);

  let created = 0, skipped = 0;
  for (const m of mapped) {
    const exists = await prisma.magazine.findFirst({
      where: { authorId: owner.id, title: m.magazine.title, createdAt: m.magazine.createdAt },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }
    await prisma.magazine.create({
      data: {
        ...m.magazine,
        authorId: owner.id,
        cards: { create: m.cards },
        sources: { create: m.sources },
      },
    });
    created++;
  }
  console.log(`완료: 새로 ${created}개, 이미 있어서 건너뜀 ${skipped}개 (소유자 id ${owner.id})`);
} catch (e) {
  console.error('가져오기 실패:', e.code || '', String(e.message).split('\n').find(l => l.trim()));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
