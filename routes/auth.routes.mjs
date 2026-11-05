import { Router } from 'express';
import { signup, loginHandler, logout, me } from '../controllers/auth.controller.mjs';
import { validateSignup, validateLogin } from '../validators/auth.validator.mjs';
import { isLoggedIn, isNotLoggedIn } from '../middlewares/auth.mjs';

const router = Router();

router.post('/signup', isNotLoggedIn, validateSignup, signup);
router.post('/login', isNotLoggedIn, validateLogin, loginHandler);
router.post('/logout', isLoggedIn, logout);
router.get('/me', isLoggedIn, me);

export default router;
