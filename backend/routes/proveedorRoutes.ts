import { Router } from 'express';
import {
    obtenerProveedores,
    obtenerProveedorPorId,
    crearProveedor,
    actualizarProveedor,
    eliminarProveedor,
} from '../controllers/proveedorController';
import { verificarRoles } from '../middleware/authMiddleware';
import { listarCalificacionesProveedor } from '../controllers/calificacionProveedorController';

const router = Router();

router.use(verificarRoles('admin'));

router.get('/', obtenerProveedores);
router.get('/:id/calificaciones', listarCalificacionesProveedor);
router.get('/:id', obtenerProveedorPorId);
router.post('/', crearProveedor);
router.put('/:id', actualizarProveedor);
router.delete('/:id', eliminarProveedor);

export default router;