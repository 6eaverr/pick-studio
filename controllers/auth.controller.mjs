import passport from 'passport';
import { createUser } from '../services/user.service.mjs';
import { unauthorized } from '../lib/http-error.mjs';
import { SESSION_COOKIE } from '../config/session.mjs';

// req.login 을 Promise로 (passport 0.7은 로그인 시 세션 id를 새로 발급해 세션 고정 공격을 막습니다)
const login = (req, user) => new Promise((resolve, reject) => req.login(user, e => (e ? reject(e) : resolve())));

// POST /auth/signup → 201 { user } (가입 후 바로 로그인)
export async function signup(req, res) {
  const { email, password, nickname } = req.body;
  const user = await createUser({ email, password, nickname });
  await login(req, user);
  res.status(201).json({ user });
}

// POST /auth/login → 200 { user } / 401 INVALID_CREDENTIALS
export function loginHandler(req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return next(unauthorized(info?.message || '이메일 또는 비밀번호가 올바르지 않습니다.', 'INVALID_CREDENTIALS'));
    login(req, user).then(() => res.json({ user }), next);
  })(req, res, next);
}

// POST /auth/logout → 200 { ok: true } (세션 삭제 + 쿠키 제거)
export function logout(req, res, next) {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(err2 => {
      if (err2) return next(err2);
      res.clearCookie(SESSION_COOKIE);
      res.json({ ok: true });
    });
  });
}

// GET /auth/me → 200 { user }
export function me(req, res) {
  res.json({ user: req.user });
}
