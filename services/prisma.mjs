import { PrismaClient } from '@prisma/client';

// 앱 전체에서 PrismaClient 하나만 씁니다(--watch 재시작 시 연결이 늘어나지 않게 전역에 보관).
// DB 접속 정보는 .env(로컬) 또는 Vercel 환경 변수의 DATABASE_URL 에서만 읽고, 쿼리 로그는 남기지 않습니다.
const globalForPrisma = globalThis;

// Vercel(서버리스)은 인스턴스가 많이 뜰 수 있어 인스턴스당 DB 연결을 1개로 제한 (Supabase 풀러 권장 설정)
function datasourceUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL || /[?&]connection_limit=/.test(url)) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
}

export const prisma = globalForPrisma.__pickPrisma ?? new PrismaClient({ log: ['warn', 'error'], ...(datasourceUrl() && { datasourceUrl: datasourceUrl() }) });

globalForPrisma.__pickPrisma = prisma;
