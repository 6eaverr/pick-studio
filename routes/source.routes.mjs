import { Router } from 'express';
import * as source from '../controllers/source.controller.mjs';
import { isLoggedIn, isOwner } from '../middlewares/auth.mjs';
import { validatePatchSource } from '../validators/magazine.validator.mjs';

// /api/sources
const router = Router();

router.patch('/:id', isLoggedIn, isOwner('source'), validatePatchSource, source.patch);
router.delete('/:id', isLoggedIn, isOwner('source'), source.remove);

export default router;
