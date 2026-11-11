// 모든 데이터는 이 함수로 fetch 합니다.
// - JSON 요청/응답, 같은 출처 쿠키(세션) 사용
// - 401 이면 로그인 화면으로 이동 (돌아올 주소를 next 로 넘김)
// - 실패 응답 { message, code } 는 Error(message) 로 던지고 err.code / err.status 를 붙입니다.
const AUTH_PAGES = ['/login.html', '/signup.html'];

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function loginUrl() {
  return `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
}

export async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && redirectOn401 && !AUTH_PAGES.includes(location.pathname)) {
    location.href = loginUrl();
    throw new ApiError(401, data.code || 'UNAUTHORIZED', data.message || '로그인이 필요합니다.');
  }
  if (!res.ok) throw new ApiError(res.status, data.code || 'ERROR', data.message || '요청에 실패했습니다.');
  return data;
}

// 카드 사진 올리기: 파일을 그대로 본문으로 보냄 → { url: '/assets/…' }
export async function uploadImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ApiError(400, 'INVALID_IMAGE', 'JPG, PNG, WEBP 이미지만 올릴 수 있습니다.');
  if (file.size > 4 * 1024 * 1024) throw new ApiError(400, 'INVALID_IMAGE', '이미지는 4MB 이하여야 합니다(사진 크기를 줄여 주세요).');
  const res = await fetch('/api/uploads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { location.href = loginUrl(); }
  if (!res.ok) throw new ApiError(res.status, data.code || 'ERROR', data.message || '사진을 올리지 못했습니다.');
  return data;
}

// 로그인 후 돌아갈 주소: 같은 사이트 안의 경로만 허용 (외부 주소로 보내는 공격 방지)
export function safeNext(value, fallback = '/magazines.html') {
  return typeof value === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) && !value.startsWith('/login') && !value.startsWith('/signup') ? value : fallback;
}
