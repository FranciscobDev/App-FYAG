import { Router } from 'express';
import {
    obtenerArticulos,
    obtenerArticuloPorId,
    crearArticulo,
    actualizarArticulo,
    deshabilitarArticulo,
    eliminarArticulo,
} from '../controllers/articuloController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Lectura: administración, bodega y técnicos (el técnico necesita ver el catálogo)
const puedeLeer = verificarRoles('admin', 'warehouse', 'technician');
// Escritura: solo administración y bodega
const puedeEscribir = verificarRoles('admin', 'warehouse');

router.get('/', puedeLeer, obtenerArticulos);
router.get('/:id', puedeLeer, obtenerArticuloPorId);
router.post('/', puedeEscribir, crearArticulo);
router.put('/:id', puedeEscribir, actualizarArticulo);
router.patch('/:id/deshabilitar', puedeEscribir, deshabilitarArticulo);
router.delete('/:id', puedeEscribir, eliminarArticulo);

export default router;
