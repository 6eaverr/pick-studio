import { badRequest } from '../lib/http-error.mjs';

// 검증 실패는 모두 400 VALIDATION_ERROR 로 응답합니다.
export const invalid = message => badRequest(message, 'VALIDATION_ERROR');

// (req) => void 형태의 검사 함수를 Express 미들웨어로 감쌉니다. 검사 함수는 실패 시 throw.
export const validate = check => (req, res, next) => {
  try { check(req); next(); } catch (e) { next(e); }
};

export const isString = v => typeof v === 'string';

// 이메일 형식: 로컬@도메인.최상위 (공백 없음, 254자 이하)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = v => isString(v) && v.trim().length <= 254 && EMAIL_RE.test(v.trim());

// 길이 검사(앞뒤 공백 제외)
export const lengthBetween = (v, min, max) => isString(v) && v.trim().length >= min && v.trim().length <= max;
