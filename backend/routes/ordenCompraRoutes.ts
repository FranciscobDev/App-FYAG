import { Router } from 'express';
import {
    aprobarOrdenCompra,
    actualizarOrdenCompra,
    calcularDesgloseFactura,
    cambiarEstadoOrdenCompra,
    crearOrdenCompra,
    descargarPdfOrdenCompra,
    ejecutarMotorStockMinimo,
    listarAlertasReposicionH40,
    listarInsumosPendientesReposicion,
    listarOrdenesCompra,
    obtenerOrdenCompraPorId,
    obtenerTrazabilidadRecepcionOc,
    registrarFacturaCompra,
    registrarRecepcionOrdenCompra,
} from '../controllers/ordenCompraController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Motor automático de reposición por stock mínimo (H35 / H40 / H43), consulta optimizada [DB] y alertas H40
router.get('/alertas', verificarRoles('admin', 'warehouse'), listarAlertasReposicionH40);
router.get('/pendientes-reposicion', verificarRoles('admin', 'warehouse'), listarInsumosPendientesReposicion);
router.post('/motor-stock-minimo', verificarRoles('admin', 'warehouse'), ejecutarMotorStockMinimo);

// Facturas de compra con 3 descuentos en cascada, Neto, IVA (19%) y aviso de discrepancia con recepción [FRONT-2]
router.post('/facturas/calcular', verificarRoles('admin', 'warehouse'), calcularDesgloseFactura);
router.post('/facturas', verificarRoles('admin', 'warehouse'), registrarFacturaCompra);

// Lectura, trazabilidad y descarga del PDF: Administrador y Bodeguero
router.get('/', verificarRoles('admin', 'warehouse'), listarOrdenesCompra);
router.get('/:id', verificarRoles('admin', 'warehouse'), obtenerOrdenCompraPorId);
router.get('/:id/pdf', verificarRoles('admin', 'warehouse'), descargarPdfOrdenCompra);
router.get('/:id/trazabilidad-recepcion', verificarRoles('admin', 'warehouse'), obtenerTrazabilidadRecepcionOc);

// Creación, edición en borrador y aprobación con envío de PDF por correo: Administrador
router.post('/', verificarRoles('admin'), crearOrdenCompra);
router.put('/:id', verificarRoles('admin'), actualizarOrdenCompra);
router.patch('/:id', verificarRoles('admin'), actualizarOrdenCompra);
router.put('/:id/lineas', verificarRoles('admin'), actualizarOrdenCompra);
router.patch('/:id/lineas', verificarRoles('admin'), actualizarOrdenCompra);
router.post('/:id/aprobar', verificarRoles('admin'), aprobarOrdenCompra);
router.patch('/:id/aprobar', verificarRoles('admin'), aprobarOrdenCompra);
router.patch('/:id/estado', verificarRoles('admin', 'warehouse'), cambiarEstadoOrdenCompra);

// Recepción en bodega basada en la OC (H33): Administrador y Bodeguero
router.post('/:id/recepcion', verificarRoles('admin', 'warehouse'), registrarRecepcionOrdenCompra);

export default router;
