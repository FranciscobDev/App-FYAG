import { Router } from 'express';
import {
    devolverHerramienta,
    ejecutarProcesoAlertasPrestamos,
    entregarHerramienta,
    historialPrestamosHerramienta,
} from '../controllers/prestamoHerramientaController';
import { verificarAdmin, verificarRoles } from '../middleware/authMiddleware';

const router = Router();
const bodeguero = verificarRoles('admin', 'warehouse');

router.post('/entregas', bodeguero, entregarHerramienta);
router.patch('/:id/devolucion', bodeguero, devolverHerramienta);
router.get('/herramienta/:id', verificarRoles('admin', 'warehouse'), historialPrestamosHerramienta);
router.post('/procesar-alertas', verificarAdmin, ejecutarProcesoAlertasPrestamos);

export default router;
