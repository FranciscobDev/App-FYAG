import { Router } from 'express';
import { obtenerParametros, modificarParametro } from '../controllers/parametrosController';
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();

// Solo administración puede leer y modificar parámetros del sistema
router.use(verificarAdmin);

router.get('/', obtenerParametros);
router.put('/:clave', modificarParametro);

export default router;
