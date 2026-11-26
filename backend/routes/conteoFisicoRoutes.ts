import { Router } from 'express';
import {
    iniciarConteoFisico,
    listarConteosFisicos,
    registrarConteoFisico,
    resolverConteoFisicoAdmin,
} from '../controllers/conteoFisicoController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Listado de conteos físicos (Bodeguero y Administrador)
router.get('/', verificarRoles('warehouse', 'admin'), listarConteosFisicos);

// [BACK-1] Iniciar sesión de conteo físico (bloquea movimientos del insumo)
router.post('/iniciar', verificarRoles('warehouse', 'admin'), iniciarConteoFisico);

// [BACK-1] Registrar conteo físico (<= umbral 5% H39 ajusta directo stock y Cardex; > 5% pasa a aprobación del Admin)
router.post('/', verificarRoles('warehouse', 'admin'), registrarConteoFisico);
router.post('/:id/registrar', verificarRoles('warehouse', 'admin'), registrarConteoFisico);

// [BACK-1] Firma / resolución del Administrador para conteos que superan el umbral H39
router.post('/:id/resolver', verificarRoles('admin'), resolverConteoFisicoAdmin);
router.post('/:id/aprobar', verificarRoles('admin'), resolverConteoFisicoAdmin);
router.post('/:id/rechazar', verificarRoles('admin'), resolverConteoFisicoAdmin);

export default router;
