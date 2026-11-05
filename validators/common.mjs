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

export const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// http(s) 주소 형식 (계정정보 포함 주소 거부, 2048자 이하)
export function isHttpUrl(v) {
  if (!isString(v) || v.length > 2048) return false;
  try {
    const u = new URL(v.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password;
  } catch { return false; }
}

// URL 경로의 :id → 양의 정수 (아니면 400 INVALID_ID)
export function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || String(id) !== String(value)) throw badRequest('잘못된 id 입니다.', 'INVALID_ID');
  return id;
}

// rules = { 필드: 값 => true | '오류 메시지' }
// required 필드는 반드시 있어야 하고, 규칙에 없는 필드는 무시합니다(컨트롤러가 아는 필드만 골라 씀).
export function checkFields(obj, rules, { required = [], label = '' } = {}) {
  if (!isPlainObject(obj)) throw invalid(`${label}형식이 올바르지 않습니다.`);
  for (const key of required) if (obj[key] === undefined) throw invalid(`${label}${key} 값이 필요합니다.`);
  for (const [key, rule] of Object.entries(rules)) {
    if (obj[key] === undefined) continue;
    const result = rule(obj[key]);
    if (result !== true) throw invalid(label + result);
  }
}

// 규칙에 있는 필드만 골라 문자열은 앞뒤 공백을 정리
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] !== undefined) out[k] = isString(obj[k]) ? obj[k].trim() : obj[k];
  return out;
}
