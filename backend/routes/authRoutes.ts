import { Router } from 'express';
import {
    login,
    logout,
    obtenerSesion,
    renovarSesion,
    verificar2faLogin,
} from '../controllers/authController';
import { solicitarRecuperacion, restablecerClave, cambiarClave } from '../controllers/recuperacionController';
import { verificarToken } from '../middleware/authMiddleware';
import { limitadorLogin, limitadorRecuperacionClave } from '../middleware/seguridadHttp';

const router = Router();

// Públicas (protegidas con rate limit específico por IP)
router.post('/login', limitadorLogin, login);
router.post('/verificar-2fa', limitadorLogin, verificar2faLogin);
router.post('/refresh', limitadorLogin, renovarSesion);
router.post('/recuperar-clave', limitadorRecuperacionClave, solicitarRecuperacion);
router.post('/restablecer-clave', limitadorRecuperacionClave, restablecerClave);

// Requieren sesión válida
router.get('/sesion', verificarToken, obtenerSesion);
router.post('/logout', verificarToken, logout);
router.post('/cambiar-clave', verificarToken, cambiarClave);

export default router;
