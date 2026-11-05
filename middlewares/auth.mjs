import { unauthorized, badRequest } from '../lib/http-error.mjs';

// 로그인한 사용자만 통과 (아니면 401)
export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  next(unauthorized('로그인이 필요합니다.'));
}

// 로그인하지 않은 사용자만 통과 (회원가입·로그인 중복 방지, 아니면 400)
export function isNotLoggedIn(req, res, next) {
  if (!req.isAuthenticated?.()) return next();
  next(badRequest('이미 로그인되어 있습니다. 먼저 로그아웃하세요.', 'ALREADY_LOGGED_IN'));
}

// isOwner(소유자 확인)는 4단계에서 매거진·카드·출처 라우트와 함께 추가합니다.
