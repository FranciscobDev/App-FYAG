import { Router } from 'express';
import {
    confirmarRecepcionDevolucion,
    declararDevolucion,
    listarDevolucionesTecnico,
    obtenerSobranteDevolucion,
} from '../controllers/devolucionController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// [FRONT-2 / BACK-2] Sobrante real por insumo (tope máximo devolvible)
router.get('/sobrante', verificarRoles('technician', 'warehouse', 'admin'), obtenerSobranteDevolucion);

// [BACK-2] Declaración de devolución de sobrante: exclusiva del técnico que retiró los insumos
router.post('/', verificarRoles('technician'), declararDevolucion);

// Listar devoluciones para el Bodeguero o Administrador
router.get('/', verificarRoles('warehouse', 'admin'), listarDevolucionesTecnico);

// [BACK-1] Confirmación física en bodega: stock, costo del proyecto, Cardex y alerta
router.post('/:id/confirmar-recepcion', verificarRoles('warehouse', 'admin'), confirmarRecepcionDevolucion);

export default router;
