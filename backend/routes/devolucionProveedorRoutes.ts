import { Router } from 'express';
import {
    listarDevolucionesProveedor,
    registrarEgresoCuarentena,
    resolverDevolucionProveedor,
} from '../controllers/devolucionProveedorController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// Listado de devoluciones a proveedor desde cuarentena ('Pendiente de resolución' y 'Resuelta')
router.get('/', verificarRoles('warehouse', 'admin'), listarDevolucionesProveedor);
router.get('/egresos', verificarRoles('warehouse', 'admin'), listarDevolucionesProveedor);

// [BACK-2] Egreso desde cuarentena indicando motivo y número de guía de despacho
router.post('/', verificarRoles('warehouse', 'admin'), registrarEgresoCuarentena);
router.post('/egresos', verificarRoles('warehouse', 'admin'), registrarEgresoCuarentena);

// [BACK-2] Seguimiento y resolución por el Administrador (Nota de crédito o Reposición)
router.post('/:id/resolver', verificarRoles('admin'), resolverDevolucionProveedor);
router.patch('/:id/resolver', verificarRoles('admin'), resolverDevolucionProveedor);

export default router;
