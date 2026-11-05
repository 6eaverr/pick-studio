// 화면(HTML) 접근 제어
// - 로그인이 필요한 화면을 로그인 없이 열면 → /login.html?next=원래주소 로 이동
// - 이미 로그인했는데 로그인·회원가입 화면을 열면 → 매거진 목록으로
// - / 는 로그인 여부에 따라 목록 또는 로그인 화면으로
// API(401 JSON)와 별개로, 화면 파일 자체를 내려주기 전에 막습니다.
export const PROTECTED_PAGES = new Set(['/magazines.html', '/magazine.html', '/edit.html', '/review.html', '/export.html']);
export const GUEST_PAGES = new Set(['/login.html', '/signup.html']);

export function pageGuard(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const loggedIn = !!req.isAuthenticated?.();
  if (req.path === '/' || req.path === '/index.html') return res.redirect(loggedIn ? '/magazines.html' : '/login.html');
  if (PROTECTED_PAGES.has(req.path) && !loggedIn) return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
  if (GUEST_PAGES.has(req.path) && loggedIn) return res.redirect('/magazines.html');
  next();
}
