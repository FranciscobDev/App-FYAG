
const express = require('express');
const router = express.Router();
const {
    obtenerUsuario,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
} = require('../controllers/usuarioController');

router.get('/', obtenerUsuario);
router.get('/:id', obtenerUsuarioPorId);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

module.exports = router;