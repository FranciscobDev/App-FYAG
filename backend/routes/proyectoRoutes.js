const express = require('express');
const router = express.Router();
const {
  obtenerProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  listarTecnicos,
  obtenerTecnicosDeProyecto,
  asignarTecnico,
  quitarTecnico,
} = require('../controllers/proyectoController');

router.get('/', obtenerProyectos);
router.post('/', crearProyecto);

// Debe ir antes de '/:id'
router.get('/tecnicos', listarTecnicos);

router.get('/:id', obtenerProyectoPorId);
router.put('/:id', actualizarProyecto);
router.delete('/:id', eliminarProyecto);

router.get('/:id/tecnicos', obtenerTecnicosDeProyecto);
router.post('/:id/tecnicos', asignarTecnico);
router.delete('/:id/tecnicos/:idUsuario', quitarTecnico);

module.exports = router;