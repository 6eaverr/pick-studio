import { validate, invalid, isEmail, isString, lengthBetween } from './common.mjs';

// bcrypt는 72바이트까지만 비교하므로 비밀번호 최대 길이를 제한합니다.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export function checkSignup({ body = {} }) {
  if (!isEmail(body.email)) throw invalid('올바른 이메일 형식이 아닙니다.');
  if (!isString(body.password) || body.password.length < PASSWORD_MIN) throw invalid(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
  if (Buffer.byteLength(body.password) > PASSWORD_MAX) throw invalid(`비밀번호가 너무 깁니다(최대 ${PASSWORD_MAX}바이트).`);
  if (!lengthBetween(body.nickname, 1, 20)) throw invalid('닉네임은 1~20자로 입력하세요.');
}

export function checkLogin({ body = {} }) {
  if (!isEmail(body.email)) throw invalid('올바른 이메일 형식이 아닙니다.');
  if (!isString(body.password) || !body.password) throw invalid('비밀번호를 입력하세요.');
}

export const validateSignup = validate(checkSignup);
export const validateLogin = validate(checkLogin);
