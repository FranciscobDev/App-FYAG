import { Router } from 'express';
import {
    escanearCodigoQrH18,
    exportarCodigosQrLote,
    generarCodigoQrInsumo,
    listarCodigosQrInsumo,
    marcarCodigoQrAsignado,
} from '../controllers/codigoQrController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Lectura y validación con el escáner de bodega H18 (Bodeguero y Administrador)
router.get('/', verificarRoles('admin', 'warehouse'), listarCodigosQrInsumo);
router.get('/escanear', verificarRoles('admin', 'warehouse'), escanearCodigoQrH18);
router.post('/escanear', verificarRoles('admin', 'warehouse'), escanearCodigoQrH18);

// [BACK-2] Exportación en lote a PDF / PNG con tamaño H39, texto legible y auditoría H14
router.get('/exportar', verificarRoles('admin'), exportarCodigosQrLote);
router.post('/exportar', verificarRoles('admin'), exportarCodigosQrLote);

// [BACK-2] Marcar código QR como "Asignado a objeto físico" con auditoría H14
router.post('/:id/asignar', verificarRoles('admin'), marcarCodigoQrAsignado);
router.patch('/:id/asignar', verificarRoles('admin'), marcarCodigoQrAsignado);

// [BACK-1] Creación de códigos QR exclusiva del Administrador, con registro en auditoría (H14)
router.post('/', verificarRoles('admin'), generarCodigoQrInsumo);

export default router;
