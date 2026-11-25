import { Router } from 'express';
import {
    confirmarRecepcionDevolucion,
    declararDevolucionTecnico,
    listarDevolucionesTecnico,
} from '../controllers/devolucionController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Lista (p. ej. ?estado=En tránsito) para el Bodeguero y el Administrador
router.get('/', verificarRoles('warehouse', 'admin'), listarDevolucionesTecnico);
// El técnico declara lo que devuelve (nace «En tránsito»)
router.post('/', verificarRoles('technician', 'admin'), declararDevolucionTecnico);
// [BACK-1] Confirmación de recepción real: stock + costo del proyecto + Cardex + alerta, en una transacción
router.post('/:id/confirmar-recepcion', verificarRoles('warehouse', 'admin'), confirmarRecepcionDevolucion);

export default router;
