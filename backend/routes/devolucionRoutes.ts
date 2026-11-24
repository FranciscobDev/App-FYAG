import { Router } from 'express';
import { declararDevolucion } from '../controllers/devolucionController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// [BACK-2] Declaración de devolución de sobrante: exclusiva del técnico que retiró los insumos
router.post('/', verificarRoles('technician'), declararDevolucion);

export default router;
