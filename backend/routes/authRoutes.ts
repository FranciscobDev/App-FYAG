import { Router } from 'express';
import { login, obtenerSesion } from '../controllers/authController';
import { verificarToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.get('/sesion', verificarToken, obtenerSesion);

export default router;

