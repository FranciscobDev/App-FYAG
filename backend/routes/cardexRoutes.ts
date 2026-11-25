import { Router } from 'express';
import { listarCardex } from '../controllers/cardexController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Solo lectura: Bodeguero y Administrador. Técnicos reciben 403.
router.get('/', verificarRoles('admin', 'warehouse'), listarCardex);

export default router;
