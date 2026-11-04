import { HttpError } from '../lib/http-error.mjs';

// 어떤 라우트에도 걸리지 않은 요청 → 404
export function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', `${req.method} ${req.path} 경로를 찾을 수 없습니다.`));
}

// 공통 에러 응답: { message, code }
// - HttpError: 지정한 상태 코드·코드·메시지 그대로
// - express.json 파싱 실패 / 용량 초과: 400 / 413
// - 그 밖의 예상치 못한 에러: 500, 내부 메시지는 응답에 싣지 않고 서버 로그에만 남김
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = '서버 오류가 발생했습니다.';

  if (err instanceof HttpError) {
    ({ status, code, message } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = '요청 본문이 올바른 JSON이 아닙니다.';
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = '요청 크기가 너무 큽니다.';
  } else if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    // express / body-parser 등이 붙인 4xx (expose 가능한 메시지만 사용)
    status = err.status; code = 'BAD_REQUEST'; message = err.expose ? err.message : '잘못된 요청입니다.';
  }

  // 요청 본문·쿠키는 로그에 남기지 않습니다(비밀번호·세션 노출 방지).
  if (status >= 500) console.error(`[error] ${req.method} ${req.path}:`, err.stack || err);

  res.status(status).json({ message, code });
}
