import { Router } from 'express';
import {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    listarRoles,
    crearUsuario,
    actualizarUsuario,
    cambiarRolUsuario,
    deshabilitarUsuario,
    eliminarUsuario,
} from '../controllers/usuarioController';
import { verificarAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(verificarAdmin);

router.get('/', obtenerUsuarios);
router.post('/', crearUsuario);

// Debe ir antes de '/:id'
router.get('/roles', listarRoles);

router.get('/:id', obtenerUsuarioPorId);
router.put('/:id', actualizarUsuario);
router.patch('/:id/rol', cambiarRolUsuario);
router.patch('/:id/deshabilitar', deshabilitarUsuario);
router.delete('/:id', eliminarUsuario);

export default router;
