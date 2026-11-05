import { Router } from 'express';
import { health } from '../controllers/health.controller.mjs';
import authRoutes from './auth.routes.mjs';

// 경로 연결만 담당합니다. 로직은 controllers/, DB 접근은 services/ 에 둡니다.
const router = Router();

router.get('/api/health', health);
router.use('/auth', authRoutes);
// 4단계: router.use('/api', magazineRoutes, cardRoutes, sourceRoutes);

export default router;
