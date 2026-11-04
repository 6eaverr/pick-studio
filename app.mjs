import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.mjs';
import { securityHeaders, sameOrigin } from './middlewares/security.mjs';
import { notFoundHandler, errorHandler } from './middlewares/error.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.PICK_DATA_DIR || path.join(ROOT, 'data');

const noCache = res => res.setHeader('Cache-Control', 'no-cache');

// 테스트에서 서버를 띄우지 않고 앱만 만들 수 있게 팩토리로 둡니다.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(sameOrigin);
  app.use(express.json({ limit: '1mb' }));

  // API
  app.use(routes);

  // 정적 파일: 업로드·수집한 카드 사진(data/assets) → 기본 에셋(public/assets) → 화면 파일(public)
  app.use('/assets', express.static(path.join(DATA, 'assets'), { dotfiles: 'ignore', setHeaders: noCache }));
  app.use(express.static(path.join(ROOT, 'public'), { dotfiles: 'ignore', setHeaders: noCache }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
