import { Router } from 'express';
import {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    listarRoles,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
} from '../controllers/usuarioController';
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', obtenerUsuarios);
router.post('/', verificarAdmin, crearUsuario);

// Debe ir antes de '/:id'
router.get('/roles', listarRoles);

router.get('/:id', obtenerUsuarioPorId);
router.put('/:id', verificarAdmin, actualizarUsuario);
router.delete('/:id', verificarAdmin, eliminarUsuario);

export default router;
