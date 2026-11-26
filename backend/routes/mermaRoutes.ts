import { Router } from 'express';
import { listarMermas, registrarMerma } from '../controllers/mermaController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Listado de mermas de inventario (Bodeguero y Administrador)
router.get('/', verificarRoles('warehouse', 'admin'), listarMermas);

// [BACK-2] Registro transaccional de merma: valida cantidad <= disponible, descuenta stock, registra en Cardex, valoriza a PMP y alerta al Admin
router.post('/', verificarRoles('warehouse', 'admin'), registrarMerma);

export default router;
