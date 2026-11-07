import { Router } from 'express';
import * as ai from '../controllers/ai.controller.mjs';
import { isLoggedIn } from '../middlewares/auth.mjs';
import { validateGenerate, validateJobId } from '../validators/ai.validator.mjs';

// /api/ai — AI 원고 생성 (로그인 사용자만, 결과는 그 사용자의 매거진으로 저장)
const router = Router();

router.get('/status', isLoggedIn, ai.status);
router.post('/generate', isLoggedIn, validateGenerate, ai.generate);
router.get('/jobs/:id', isLoggedIn, validateJobId, ai.job);

export default router;
