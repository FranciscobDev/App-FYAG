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
} from '../controllers/proyectoController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verificarRoles('admin', 'technician'), obtenerProyectos);
router.get('/movil', verificarRoles('admin', 'technician'), obtenerProyectos);
router.post('/', verificarRoles('admin'), crearProyecto);

// Debe ir antes de '/:id'
router.get('/tecnicos', verificarRoles('admin'), listarTecnicos);

// Insumos planificados por proyecto (visible para el técnico solo en sus proyectos)
router.get('/insumos-asignados', verificarRoles('admin', 'technician'), listarInsumosAsignados);

router.get('/:id', verificarRoles('admin', 'technician'), obtenerProyectoPorId);
router.put('/:id', verificarRoles('admin'), actualizarProyecto);
router.post('/:id/cerrar', verificarRoles('admin'), cerrarProyecto);
router.patch('/:id/cerrar', verificarRoles('admin'), cerrarProyecto);
router.delete('/:id', verificarRoles('admin'), eliminarProyecto);

router.get('/:id/tecnicos', verificarRoles('admin'), obtenerTecnicosDeProyecto);
router.post('/:id/tecnicos', verificarRoles('admin'), asignarTecnico);
router.delete('/:id/tecnicos/:idUsuario', verificarRoles('admin'), quitarTecnico);

export default router;