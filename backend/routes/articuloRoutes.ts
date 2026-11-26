import { Router } from 'express';
import {
    obtenerArticulos,
    obtenerArticuloPorId,
    crearArticulo,
    actualizarArticulo,
    deshabilitarArticulo,
    eliminarArticulo,
} from '../controllers/articuloController';
import {
    escanearCodigoQrH18,
    generarCodigoQrInsumo,
    listarCodigosQrInsumo,
} from '../controllers/codigoQrController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Lectura: administración, bodega y técnicos (el técnico necesita ver el catálogo)
const puedeLeer = verificarRoles('admin', 'warehouse', 'technician');
// Escritura: solo administración y bodega
const puedeEscribir = verificarRoles('admin', 'warehouse');

router.get('/', puedeLeer, obtenerArticulos);
// [BACK-1] Búsqueda instantánea (< 200 ms) por código QR o código de barras (antes de /:id)
router.get('/escanear', puedeLeer, escanearCodigoQrH18);
router.post('/escanear', puedeLeer, escanearCodigoQrH18);
router.get('/escanear/:codigo', puedeLeer, escanearCodigoQrH18);
router.get('/:id', puedeLeer, obtenerArticuloPorId);
router.post('/', puedeEscribir, crearArticulo);
router.put('/:id', puedeEscribir, actualizarArticulo);
router.patch('/:id/deshabilitar', puedeEscribir, deshabilitarArticulo);
router.delete('/:id', puedeEscribir, eliminarArticulo);

// [BACK-1] Generación de códigos QR del insumo (exclusiva del Administrador) y consulta
router.get('/:id/codigos-qr', verificarRoles('admin', 'warehouse'), listarCodigosQrInsumo);
router.post('/:id/codigos-qr', verificarRoles('admin'), generarCodigoQrInsumo);

export default router;
