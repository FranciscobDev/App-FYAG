import { Router } from 'express';
import {
    editarRegistroCentral,
    listarConflictosSincronizacion,
    obtenerRegistroSincronizado,
    sincronizarLote,
} from '../controllers/sincronizacionController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

// [BACK-1] Sincronización por lotes desde el móvil (fotos <= 5 MB; conflicto => se conservan ambas versiones)
router.post('/lote', verificarRoles('technician', 'admin'), sincronizarLote);

// Edición desde la central (web) y consulta del historial de versiones
router.put('/registros/:id', verificarRoles('admin'), editarRegistroCentral);
router.get('/registros/:id', verificarRoles('technician', 'admin'), obtenerRegistroSincronizado);

// Bandeja del Administrador: conflictos con ambas versiones
router.get('/conflictos', verificarRoles('admin'), listarConflictosSincronizacion);

export default router;
