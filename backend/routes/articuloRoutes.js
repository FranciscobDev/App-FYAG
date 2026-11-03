const express = require('express');
const router = express.Router();
const {
    obtenerArticulos,
    obtenerArticuloPorId,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo
} = require('../controllers/articuloController');

router.get('/', obtenerArticulos);
router.get('/:id', obtenerArticuloPorId);
router.post('/', crearArticulo);
router.put('/:id', actualizarArticulo);
router.delete('/:id', eliminarArticulo);

module.exports = router;