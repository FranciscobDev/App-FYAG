import { Router } from 'express';
import {
    obtenerProyectos,
    obtenerProyectoPorId,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
    listarTecnicos,
    obtenerTecnicosDeProyecto,
    asignarTecnico,
    quitarTecnico,
    cerrarProyecto,
    listarInsumosAsignados,
    registrarAvanceProyecto,
    listarAvancesProyecto,
    obtenerReporteFinalProyecto,
} from '../controllers/proyectoController';
import {
    obtenerEstadoFinancieroProyecto,
    registrarHorasProyecto,
} from '../controllers/motorFinancieroProyectoController';
import { verificarRoles } from '../middleware/authMiddleware';
import { dashboardRentabilidadProyecto } from '../controllers/dashboardRentabilidadController';

const router = Router();

router.get('/', verificarRoles('admin', 'technician'), obtenerProyectos);
router.get('/movil', verificarRoles('admin', 'technician'), obtenerProyectos);
router.post('/', verificarRoles('admin'), crearProyecto);

// Debe ir antes de '/:id'
router.get('/tecnicos', verificarRoles('admin'), listarTecnicos);

// Insumos planificados por proyecto (visible para el técnico solo en sus proyectos)
router.get('/insumos-asignados', verificarRoles('admin', 'technician'), listarInsumosAsignados);

// [BACK-1] Registro de avance móvil compatible con POST /api/proyectos/avances (con id_proyecto en body)
router.post('/avances', verificarRoles('admin', 'technician'), registrarAvanceProyecto);

router.get('/:id', verificarRoles('admin', 'technician'), obtenerProyectoPorId);
router.put('/:id', verificarRoles('admin'), actualizarProyecto);
router.post('/:id/cerrar', verificarRoles('admin'), cerrarProyecto);
router.patch('/:id/cerrar', verificarRoles('admin'), cerrarProyecto);
router.delete('/:id', verificarRoles('admin'), eliminarProyecto);

// [BACK-1] Avances, materiales utilizados y reporte final de proyecto
router.post('/:id/avances', verificarRoles('admin', 'technician'), registrarAvanceProyecto);
router.get('/:id/avances', verificarRoles('admin', 'technician'), listarAvancesProyecto);
router.get('/:id/reporte-final', verificarRoles('admin', 'technician'), obtenerReporteFinalProyecto);

// [BACK-1 / H27 / H41] Motor financiero del proyecto (Costo Real, Margen Estimado, Semáforo) y registro de horas
router.get('/:id/finanzas', verificarRoles('admin'), obtenerEstadoFinancieroProyecto);
router.get('/:id/dashboard-rentabilidad', verificarRoles('admin'), dashboardRentabilidadProyecto);
router.post('/:id/horas', verificarRoles('admin', 'technician'), registrarHorasProyecto);

router.get('/:id/tecnicos', verificarRoles('admin'), obtenerTecnicosDeProyecto);
router.post('/:id/tecnicos', verificarRoles('admin'), asignarTecnico);
router.delete('/:id/tecnicos/:idUsuario', verificarRoles('admin'), quitarTecnico);

export default router;