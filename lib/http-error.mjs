// 공통 HTTP 에러. 컨트롤러·서비스·미들웨어에서 throw 하면 에러 처리 미들웨어가 { message, code } 로 응답합니다.
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') => new HttpError(400, code, message);
export const unauthorized = (message = '로그인이 필요합니다.', code = 'UNAUTHORIZED') => new HttpError(401, code, message);
export const forbidden = (message = '권한이 없습니다.', code = 'FORBIDDEN') => new HttpError(403, code, message);
export const notFound = (message = '대상을 찾을 수 없습니다.', code = 'NOT_FOUND') => new HttpError(404, code, message);
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, code, message);
