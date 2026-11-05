import { Router } from 'express';
import * as magazine from '../controllers/magazine.controller.mjs';
import * as card from '../controllers/card.controller.mjs';
import * as source from '../controllers/source.controller.mjs';
import { isLoggedIn, isOwner } from '../middlewares/auth.mjs';
import {
  validateIdParam, validateListQuery, validateCreateMagazine, validateUpdateMagazine,
  validateCreateCard, validateReorder, validateCreateSource,
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

export default router;
