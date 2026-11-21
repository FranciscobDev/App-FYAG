import { Router } from 'express';
import {
    crearSolicitudInsumos,
    listarSolicitudesInsumos,
} from '../controllers/solicitudController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verificarRoles('admin', 'warehouse', 'technician'), listarSolicitudesInsumos);
router.post('/', verificarRoles('admin', 'warehouse', 'technician'), crearSolicitudInsumos);

export default router;
