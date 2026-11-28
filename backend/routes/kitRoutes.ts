import { Router } from 'express';
import {
    obtenerKits,
    obtenerKitPorId,
    crearKit,
    actualizarKit,
    eliminarKit,
} from '../controllers/kitController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verificarRoles('admin', 'technician', 'warehouse'), obtenerKits);
router.get('/:id', verificarRoles('admin', 'technician', 'warehouse'), obtenerKitPorId);
router.post('/', verificarRoles('admin'), crearKit);
router.put('/:id', verificarRoles('admin'), actualizarKit);
router.delete('/:id', verificarRoles('admin'), eliminarKit);

export default router;

