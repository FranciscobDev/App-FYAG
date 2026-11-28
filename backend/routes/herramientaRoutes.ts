import { Router } from 'express';
import {
    crearHerramienta,
    listarHerramientas,
    obtenerHerramienta,
    actualizarHerramienta,
    cambiarEstadoHerramienta,
    eliminarHerramienta,
    reactivarHerramienta,
} from '../controllers/herramientaController';
import { verificarAdmin, verificarRoles } from '../middleware/authMiddleware';
import { ejecutarJobMantenimiento, registrarMantenimiento } from '../controllers/mantenimientoHerramientaController';

const router = Router();

// Consultas de herramientas permitidas para admin, warehouse y technician
router.get('/', verificarRoles('admin', 'warehouse', 'technician'), listarHerramientas);
router.get('/:id', verificarRoles('admin', 'warehouse', 'technician'), obtenerHerramienta);

// Mutaciones exclusivas del Administrador con auditoría transversal y bloqueo de eliminación física
router.post('/', verificarAdmin, crearHerramienta);
router.put('/:id', verificarAdmin, actualizarHerramienta);
router.patch('/:id/estado', verificarAdmin, cambiarEstadoHerramienta);
router.patch('/:id/activar', verificarAdmin, reactivarHerramienta);
router.delete('/:id', verificarAdmin, eliminarHerramienta);
router.post('/mantenimiento/ejecutar-job', verificarAdmin, ejecutarJobMantenimiento);
router.post('/:id/mantenimiento', verificarAdmin, registrarMantenimiento);

export default router;
