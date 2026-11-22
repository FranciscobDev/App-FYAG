import { Router } from 'express';
import {
    anularSolicitudInsumos,
    aprobarSolicitudInsumos,
    bloquearEdicionEgresoSolicitud,
    crearSolicitudInsumos,
    editarSolicitudInsumos,
    listarSolicitudesInsumos,
    rechazarSolicitudInsumos,
    registrarEgresoSolicitud,
    resolverSolicitudInsumos,
} from '../controllers/solicitudController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verificarRoles('admin', 'warehouse', 'technician'), listarSolicitudesInsumos);
router.post('/', verificarRoles('admin', 'warehouse', 'technician'), crearSolicitudInsumos);

// [BACK-1] Resolución de solicitud por el Administrador (Aprobada con comprobante correlativo H5 / Rechazada con motivo obligatorio y liberación de stock)
router.post('/:id/resolver', verificarRoles('admin'), resolverSolicitudInsumos);
router.patch('/:id/resolver', verificarRoles('admin'), resolverSolicitudInsumos);
router.post('/:id/aprobar', verificarRoles('admin'), aprobarSolicitudInsumos);
router.patch('/:id/aprobar', verificarRoles('admin'), aprobarSolicitudInsumos);
router.post('/:id/rechazar', verificarRoles('admin'), rechazarSolicitudInsumos);
router.patch('/:id/rechazar', verificarRoles('admin'), rechazarSolicitudInsumos);

// [BACK-1] Egreso transaccional (todo o nada) exclusivo sobre solicitudes Aprobadas con soporte parcial y Cardex en tiempo real
router.post('/:id/egresos', verificarRoles('admin', 'warehouse'), registrarEgresoSolicitud);
router.post('/:id/egreso', verificarRoles('admin', 'warehouse'), registrarEgresoSolicitud);
// Prohibición estricta de editar o eliminar registros de egreso (correcciones solo por movimiento de ajuste)
router.put('/:id/egresos/:idEgreso', verificarRoles('admin', 'warehouse'), bloquearEdicionEgresoSolicitud);
router.patch('/:id/egresos/:idEgreso', verificarRoles('admin', 'warehouse'), bloquearEdicionEgresoSolicitud);
router.delete('/:id/egresos/:idEgreso', verificarRoles('admin', 'warehouse'), bloquearEdicionEgresoSolicitud);

// [BACK-2] Edición y anulación exclusivas en estado Pendiente con recálculo/liberación de stock comprometido y auditoría
router.put('/:id', verificarRoles('admin', 'warehouse'), editarSolicitudInsumos);
router.patch('/:id', verificarRoles('admin', 'warehouse'), editarSolicitudInsumos);
router.post('/:id/anular', verificarRoles('admin', 'warehouse'), anularSolicitudInsumos);
router.patch('/:id/anular', verificarRoles('admin', 'warehouse'), anularSolicitudInsumos);
router.delete('/:id', verificarRoles('admin', 'warehouse'), anularSolicitudInsumos);

export default router;
