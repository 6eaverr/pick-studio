import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { PrismaSessionStore } from './session-store.mjs';

export const SESSION_COOKIE = 'pick.sid';

// 세션 시크릿은 .env 의 SESSION_SECRET 에서만 읽습니다.
// 운영(NODE_ENV=production)에서 없으면 시작하지 않고, 개발·테스트에서는 실행할 때마다 임시 값을 씁니다(재시작하면 로그아웃).
function resolveSecret(secret) {
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET 이 설정되지 않았습니다(.env 확인).');
  console.warn('[session] SESSION_SECRET 이 없어 임시 시크릿을 사용합니다. 서버를 재시작하면 로그인이 풀립니다.');
  return randomBytes(32).toString('hex');
}

// 세션 저장소: DB(sessions 테이블). DATABASE_URL 이 없으면(단위 테스트) 메모리 저장소.
// SESSION_STORE=memory 로 강제로 메모리 저장소를 쓸 수도 있습니다.
export function defaultStore() {
  if (!process.env.DATABASE_URL || process.env.SESSION_STORE === 'memory') return undefined;
  return new PrismaSessionStore();
}

export function createSession({ secret = process.env.SESSION_SECRET, store = defaultStore() } = {}) {
  return session({
    name: SESSION_COOKIE,
    secret: resolveSecret(secret),
    store,
    resave: false,
    saveUninitialized: false, // 로그인 전에는 세션·쿠키를 만들지 않음
    cookie: {
      httpOnly: true, // JS에서 쿠키를 읽을 수 없음
      sameSite: 'lax', // 다른 사이트에서 보낸 POST에 쿠키가 실리지 않음 (CSRF 방어)
      secure: process.env.NODE_ENV === 'production', // 운영(HTTPS)에서만 secure
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    },
  });
}
