import { Router } from 'express';
import { login, obtenerSesion } from '../controllers/authController';
import { solicitarRecuperacion, restablecerClave, cambiarClave } from '../controllers/recuperacionController';
import { verificarToken } from '../middleware/authMiddleware';

const router = Router();

// Públicas
router.post('/login', login);
router.post('/recuperar-clave', solicitarRecuperacion);
router.post('/restablecer-clave', restablecerClave);

// Requieren sesión válida
router.get('/sesion', verificarToken, obtenerSesion);
router.post('/cambiar-clave', verificarToken, cambiarClave);

export default router;
