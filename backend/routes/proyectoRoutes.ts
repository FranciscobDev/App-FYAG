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
} from '../controllers/proyectoController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verificarRoles('admin', 'technician'), obtenerProyectos);
router.post('/', verificarRoles('admin'), crearProyecto);

// Debe ir antes de '/:id'
router.get('/tecnicos', verificarRoles('admin'), listarTecnicos);

router.get('/:id', verificarRoles('admin', 'technician'), obtenerProyectoPorId);
router.put('/:id', verificarRoles('admin'), actualizarProyecto);
router.delete('/:id', verificarRoles('admin'), eliminarProyecto);

router.get('/:id/tecnicos', verificarRoles('admin'), obtenerTecnicosDeProyecto);
router.post('/:id/tecnicos', verificarRoles('admin'), asignarTecnico);
router.delete('/:id/tecnicos/:idUsuario', verificarRoles('admin'), quitarTecnico);

export default router;

