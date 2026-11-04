import { PrismaClient } from '@prisma/client';

// 앱 전체에서 PrismaClient 하나만 씁니다(--watch 재시작 시 연결이 늘어나지 않게 전역에 보관).
// DB 접속 정보는 .env 의 DATABASE_URL 에서만 읽고, 쿼리 로그는 남기지 않습니다.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__pickPrisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__pickPrisma = prisma;
