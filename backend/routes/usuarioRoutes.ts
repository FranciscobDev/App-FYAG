import { Router } from 'express';
import {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    listarRoles,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
} from '../controllers/usuarioController';

const router = Router();

router.get('/', obtenerUsuarios);
router.post('/', crearUsuario);

// Debe ir antes de '/:id'
router.get('/roles', listarRoles);

router.get('/:id', obtenerUsuarioPorId);
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

export default router;

