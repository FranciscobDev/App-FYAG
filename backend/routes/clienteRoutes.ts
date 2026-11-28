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
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();

// Principio de mínimo privilegio: la cartera comercial de clientes y planes de mantención es exclusiva del Administrador
router.use(verificarAdmin);

// Planes de mantención periódica y seguimiento de contacto (antes de /:id para evitar colisión)
router.get('/planes/mantencion', obtenerPlanesMantencion);
router.post('/planes/mantencion', crearPlanMantencion);
router.put('/planes/mantencion/:idPlan', actualizarPlanMantencion);
router.post('/planes/mantencion/:idPlan/seguimiento', registrarSeguimientoContacto);

// CRUD de Clientes
router.get('/', obtenerClientes);
router.get('/:id', obtenerClientePorId);
router.post('/', crearCliente);
router.put('/:id', actualizarCliente);
router.patch('/:id/estado', cambiarEstadoCliente);

export default router;
