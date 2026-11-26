import { Router } from 'express';
import {
    ejecutarRespaldoManual,
    estadoRespaldos,
    listarPruebasRestauracion,
    registrarPruebaRestauracion,
} from '../controllers/respaldoController';
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();
router.use(verificarAdmin);

router.get('/', estadoRespaldos);
router.post('/ejecutar', ejecutarRespaldoManual);
router.get('/pruebas-restauracion', listarPruebasRestauracion);
router.post('/pruebas-restauracion', registrarPruebaRestauracion);

export default router;
