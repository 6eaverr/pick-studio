import { Router } from 'express';
import { health } from '../controllers/health.controller.mjs';
import authRoutes from './auth.routes.mjs';
import magazineRoutes from './magazine.routes.mjs';
import cardRoutes from './card.routes.mjs';
import sourceRoutes from './source.routes.mjs';
import uploadRoutes from './upload.routes.mjs';
import aiRoutes from './ai.routes.mjs';
import { serveAsset } from '../controllers/upload.controller.mjs';

// 경로 연결만 담당합니다. 로직은 controllers/, DB 접근은 services/ 에 둡니다.
const router = Router();

router.get('/api/health', health);
router.get('/assets/:name', serveAsset); // DB 에 저장된 카드 사진 (없으면 정적 파일로 넘어감)
router.use('/auth', authRoutes);
router.use('/api/magazines', magazineRoutes);
router.use('/api/cards', cardRoutes);
router.use('/api/sources', sourceRoutes);
router.use('/api/uploads', uploadRoutes);
router.use('/api/ai', aiRoutes);

export default router;
