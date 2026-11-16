import { Router } from 'express';
import {
    obtenerClientes,
    obtenerClientePorId,
    crearCliente,
    actualizarCliente,
    cambiarEstadoCliente,
    obtenerPlanesMantencion,
    crearPlanMantencion,
    actualizarPlanMantencion,
    registrarSeguimientoContacto,
} from '../controllers/clienteController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Planes de mantención periódica y seguimiento de contacto (antes de /:id para evitar colisión)
router.get('/planes/mantencion', verificarRoles('admin', 'technician', 'warehouse'), obtenerPlanesMantencion);
router.post('/planes/mantencion', verificarRoles('admin'), crearPlanMantencion);
router.put('/planes/mantencion/:idPlan', verificarRoles('admin'), actualizarPlanMantencion);
router.post('/planes/mantencion/:idPlan/seguimiento', verificarRoles('admin'), registrarSeguimientoContacto);

// CRUD de Clientes
router.get('/', verificarRoles('admin', 'technician', 'warehouse'), obtenerClientes);
router.get('/:id', verificarRoles('admin', 'technician', 'warehouse'), obtenerClientePorId);
router.post('/', verificarRoles('admin'), crearCliente);
router.put('/:id', verificarRoles('admin'), actualizarCliente);
router.patch('/:id/estado', verificarRoles('admin'), cambiarEstadoCliente);

export default router;
