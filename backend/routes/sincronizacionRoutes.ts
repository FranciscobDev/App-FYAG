import express, { Router } from 'express';
import {
    editarRegistroCentral,
    listarConflictosSincronizacion,
    obtenerRegistroSincronizado,
    sincronizarLote,
} from '../controllers/sincronizacionController';
import { verificarRoles } from '../middleware/authMiddleware';
import { LIMITE_JSON_SINCRONIZACION } from '../services/sincronizacionService';

const router = Router();
const analizadorJsonLote = express.json({ limit: LIMITE_JSON_SINCRONIZACION });
const analizadorJsonEdicion = express.json({ limit: '256kb' });

// [BACK-1] Sincronización por lotes desde el móvil (fotos <= 5 MB; conflicto => se conservan ambas versiones)
router.post('/lote', verificarRoles('technician', 'admin'), analizadorJsonLote, sincronizarLote);

// Edición desde la central (web) y consulta del historial de versiones
router.put('/registros/:id', verificarRoles('admin'), analizadorJsonEdicion, editarRegistroCentral);
router.get('/registros/:id', verificarRoles('technician', 'admin'), obtenerRegistroSincronizado);

// Bandeja del Administrador: conflictos con ambas versiones
router.get('/conflictos', verificarRoles('admin'), listarConflictosSincronizacion);

export default router;
