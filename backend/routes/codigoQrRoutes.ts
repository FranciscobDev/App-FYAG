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

// [BACK-1] Lectura y búsqueda instantánea (< 200 ms) por código QR o código de barras con el escáner H18
router.get('/', verificarRoles('admin', 'warehouse'), listarCodigosQrInsumo);
router.get('/escanear', verificarRoles('admin', 'warehouse', 'technician'), escanearCodigoQrH18);
router.post('/escanear', verificarRoles('admin', 'warehouse', 'technician'), escanearCodigoQrH18);
router.get('/buscar/:codigo', verificarRoles('admin', 'warehouse', 'technician'), escanearCodigoQrH18);

// [BACK-2] Exportación en lote a PDF / PNG con tamaño H39, texto legible y auditoría H14
router.get('/exportar', verificarRoles('admin'), exportarCodigosQrLote);
router.post('/exportar', verificarRoles('admin'), exportarCodigosQrLote);

// [BACK-2] Marcar código QR como "Asignado a objeto físico" con auditoría H14
router.post('/:id/asignar', verificarRoles('admin'), marcarCodigoQrAsignado);
router.patch('/:id/asignar', verificarRoles('admin'), marcarCodigoQrAsignado);

// [BACK-1] Creación de códigos QR exclusiva del Administrador, con registro en auditoría (H14)
router.post('/', verificarRoles('admin'), generarCodigoQrInsumo);

export default router;
