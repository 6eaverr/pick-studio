import { forbidden } from '../lib/http-error.mjs';

// 기존 server.mjs의 보안 헤더를 그대로 옮김
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', CSP);
  next();
}

// 상태를 바꾸는 요청(POST·PUT·PATCH·DELETE)은 같은 출처에서 온 것만 허용 (CSRF 방어)
// 브라우저는 교차 출처 요청에 Origin 헤더를 붙이므로, 있으면 현재 호스트와 같아야 합니다.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export function sameOrigin(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return next(forbidden('다른 웹사이트에서 보낸 요청은 허용되지 않습니다.', 'FORBIDDEN_ORIGIN'));
  }
  next();
}
