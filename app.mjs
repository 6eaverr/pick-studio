import express from 'express';
import path from 'node:path';
import routes from './routes/index.mjs';
import { securityHeaders, sameOrigin } from './middlewares/security.mjs';
import { notFoundHandler, errorHandler } from './middlewares/error.mjs';
import { createSession } from './config/session.mjs';
import { configurePassport } from './config/passport.mjs';
import { pageGuard } from './middlewares/pages.mjs';
import { ROOT, ASSETS } from './lib/paths.mjs';

const noCache = res => res.setHeader('Cache-Control', 'no-cache');

// 카드 이미지 내보내기는 JPG 여러 장을 받으므로 그 라우트에서 큰 한도로 따로 읽습니다(상태 확인 후).
const EXPORT_PATH = /^\/api\/magazines\/[^/]+\/export$/;
const jsonBody = express.json({ limit: '1mb' });

// 테스트에서 서버를 띄우지 않고 앱만 만들 수 있게 팩토리로 둡니다.
export function createApp({ sessionSecret } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Vercel 은 HTTPS 를 프록시가 받아 넘겨 주므로, 프록시 헤더를 믿어야 secure 쿠키·출처 검사가 https 로 동작
  if (process.env.VERCEL) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(sameOrigin);
  app.use((req, res, next) => (EXPORT_PATH.test(req.path) ? next() : jsonBody(req, res, next)));

  // 인증: express-session(쿠키 세션) + passport-local
  const passport = configurePassport();
  app.use(createSession({ secret: sessionSecret ?? process.env.SESSION_SECRET }));
  app.use(passport.initialize());
  app.use(passport.session());

  // 화면 접근 제어 (로그인 안 됐으면 로그인 화면으로)
  app.use(pageGuard);

  // API
  app.use(routes);

  // 정적 파일: 업로드·수집한 카드 사진(data/assets) → 기본 에셋(public/assets) → 화면 파일(public)
  app.use('/assets', express.static(ASSETS, { dotfiles: 'ignore', setHeaders: noCache }));
  app.use(express.static(path.join(ROOT, 'public'), { dotfiles: 'ignore', setHeaders: noCache }));
  // 서버·브라우저 공용 모듈 (말투 검사기, 승인 규칙, DB→원고 변환)
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { dotfiles: 'ignore', setHeaders: noCache }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
