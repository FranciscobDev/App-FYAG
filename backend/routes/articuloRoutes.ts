import { Router } from 'express';
import {
    obtenerArticulos,
    obtenerArticuloPorId,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo,
} from '../controllers/articuloController';

const router = Router();

router.get('/', obtenerArticulos);
router.get('/:id', obtenerArticuloPorId);
router.post('/', crearArticulo);
router.put('/:id', actualizarArticulo);
router.delete('/:id', eliminarArticulo);

export default router;

