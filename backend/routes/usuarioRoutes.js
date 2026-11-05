const express = require('express');
const router = express.Router();
const {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    listarRoles,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
} = require('../controllers/usuarioController');

router.get('/', obtenerUsuarios);
router.post('/', crearUsuario);

// Debe ir antes de '/:id'
router.get('/roles', listarRoles);

router.get('/:id', obtenerUsuarioPorId);
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

module.exports = router;