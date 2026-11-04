// DB 연결 확인: 테이블별 행 수만 출력합니다(접속 정보는 출력하지 않음).
// npm run db:check
import { prisma } from '../services/prisma.mjs';

try {
  const [users, magazines, cards, sources] = await Promise.all([
    prisma.user.count(), prisma.magazine.count(), prisma.card.count(), prisma.source.count(),
  ]);
  console.log('DB 연결 OK');
  console.table({ users, magazines, cards, sources });
} catch (e) {
  // Prisma 에러 메시지에 접속 문자열이 들어가지 않도록 코드와 첫 줄만 출력
  console.error('DB 연결 실패:', e.code || e.name, '-', String(e.message).split('\n').find(l => l.trim()) || '');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
