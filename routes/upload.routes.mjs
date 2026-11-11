import express, { Router } from 'express';
import { upload } from '../controllers/upload.controller.mjs';
import { isLoggedIn } from '../middlewares/auth.mjs';

// /api/uploads — 카드 사진 올리기 (로그인 사용자)
const router = Router();

router.post('/', isLoggedIn, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }), upload);

export default router;
