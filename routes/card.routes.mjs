import { Router } from 'express';
import * as card from '../controllers/card.controller.mjs';
import { isLoggedIn, isOwner } from '../middlewares/auth.mjs';
import { validateUpdateCard } from '../validators/magazine.validator.mjs';

// /api/cards
const router = Router();

router.put('/:id', isLoggedIn, isOwner('card'), validateUpdateCard, card.update);
router.delete('/:id', isLoggedIn, isOwner('card'), card.remove);

export default router;
