import express, { Router } from 'express';
import * as magazine from '../controllers/magazine.controller.mjs';
import * as exporter from '../controllers/export.controller.mjs';
import * as card from '../controllers/card.controller.mjs';
import * as source from '../controllers/source.controller.mjs';
import * as review from '../controllers/review.controller.mjs';
import { isLoggedIn, isOwner } from '../middlewares/auth.mjs';
import {
  validateIdParam, validateListQuery, validateCreateMagazine, validateUpdateMagazine,
  validateCreateCard, validateReorder, validateCreateSource, validateStatusChange,
} from '../validators/magazine.validator.mjs';

// /api/magazines
const router = Router();

router.get('/', isLoggedIn, validateListQuery, magazine.list);
router.post('/', isLoggedIn, validateCreateMagazine, magazine.create);
router.get('/:id', isLoggedIn, validateIdParam, magazine.detail);
router.put('/:id', isLoggedIn, isOwner('magazine'), validateUpdateMagazine, magazine.update);
router.delete('/:id', isLoggedIn, isOwner('magazine'), magazine.remove);

router.post('/:id/cards', isLoggedIn, isOwner('magazine'), validateCreateCard, card.create);
router.patch('/:id/cards/order', isLoggedIn, isOwner('magazine'), validateReorder, card.reorder);
router.post('/:id/sources', isLoggedIn, isOwner('magazine'), validateCreateSource, source.create);

// 고유 기능: 말투 검사, 검토·승인 흐름, 카드 이미지 내보내기(APPROVED 이상만, 아니면 403)
router.get('/:id/voice', isLoggedIn, validateIdParam, review.voice);
router.patch('/:id/status', isLoggedIn, isOwner('magazine'), validateStatusChange, review.changeStatus);
router.post('/:id/export', isLoggedIn, isOwner('magazine'), exporter.requireExportable, express.json({ limit: '40mb' }), exporter.exportZip);

export default router;
