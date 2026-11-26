import { Router } from 'express';
import { reporteMovimientos } from '../controllers/reporteController';
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/movimientos', verificarAdmin, reporteMovimientos);

export default router;
