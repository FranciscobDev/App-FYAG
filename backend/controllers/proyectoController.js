const pool = require('../config/db');

// Listar todos
const obtenerProyectos = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proyecto ORDER BY id_proyecto ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: 'Error al obtener los proyectos' });
    }
};

// Obtener uno por ID
const obtenerProyectoPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM proyecto WHERE id_proyecto = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proyecto no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un proyecto
const crearProyecto = async (req, res) => {
    const {
        nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta,
        porcentaje_avance, estado_proyecto, id_usuario
    } = req.body;
    if (!nombre_proyecto) {
        return res.status(400).json({ mensaje: 'El nombre del proyecto es obligatorio' });
    }

    try {
        const query = `
        INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
        const values = [
            nombre_proyecto,
            tipo_proyecto || 'Instalacion',
            cliente || null,
            direccion || null,
            fecha_inicio || null,
            fecha_fin || null,
            presupuesto_inicial || 0,
            presupuesto_horas || 0,
            valor_venta || 0,
            porcentaje_avance || 0,
            estado_proyecto || 'Planificado',
            id_usuario || null
        ];

        const result = await pool.query(query, values);
        res.status(201).json({
            mensaje: 'Proyecto creado exitosamente',
            proyecto: result.rows[0]
        });
    } catch (error) {
        if (error.code === '22P02') {
            return res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El usuario responsable no existe' });
        }
        console.error('Error al crear proyecto:', error);
        res.status(500).json({ error: 'Error al crear el proyecto' });
    }
};

// Modificar un proyecto
const actualizarProyecto = async (req, res) => {
    const { id } = req.params;
    const {
        nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario
    } = req.body;

    try {
        const query = `
      UPDATE proyecto
      SET nombre_proyecto = $1, tipo_proyecto = $2, cliente = $3, direccion = $4,
          fecha_inicio = $5, fecha_fin = $6, presupuesto_inicial = $7, presupuesto_horas = $8, valor_venta = $9,
          porcentaje_avance = $10, estado_proyecto = $11, id_usuario = $12
      WHERE id_proyecto = $13
      RETURNING *;
    `;
        const values = [
            nombre_proyecto, tipo_proyecto, cliente, direccion, fecha_inicio,
            fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario, id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proyecto no encontrado para actualizar' });
        }

        res.status(200).json({
            mensaje: 'Proyecto actualizado exitosamente',
            proyecto: result.rows[0]
        });
    } catch (error) {
        if (error.code === '22P02') {
            return res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El usuario responsable no existe' });
        }
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({ error: 'Error al actualizar el proyecto' });
    }
};

// Eliminar un proyecto
const eliminarProyecto = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM proyecto WHERE id_proyecto = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Proyecto no encontrado para eliminar' });
        }

        res.status(200).json({
            mensaje: 'Proyecto eliminado correctamente',
            proyectoEliminado: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                mensaje: 'No se puede eliminar el proyecto porque tiene horas o solicitudes asociadas'
            });
        }
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({ error: 'Error al eliminar el proyecto' });
    }
};

// ---------- Técnicos asignados a proyectos ----------

// Listar usuarios con rol técnico activos (para el selector)
const listarTecnicos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre
             FROM usuario u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE r.nombre_rol = 'Tecnico' AND u.activo = TRUE
             ORDER BY u.nombre_usuario ASC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar técnicos:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos' });
    }
};

// Técnicos asignados a un proyecto
const obtenerTecnicosDeProyecto = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre
             FROM proyecto_tecnico pt
             JOIN usuario u ON u.id_usuario = pt.id_usuario
             WHERE pt.id_proyecto = $1
             ORDER BY u.nombre_usuario ASC`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener técnicos del proyecto:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos del proyecto' });
    }
};

// Asignar un técnico a un proyecto (solo usuarios con rol técnico)
const asignarTecnico = async (req, res) => {
    const { id } = req.params;
    const { id_usuario } = req.body;

    if (!id_usuario) {
        return res.status(400).json({ mensaje: 'Debe indicar el técnico a asignar' });
    }

    try {
        const esTecnico = await pool.query(
            `SELECT 1
             FROM usuario u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND r.nombre_rol = 'Tecnico'`,
            [id_usuario]
        );
        if (esTecnico.rows.length === 0) {
            return res.status(400).json({ mensaje: 'El usuario seleccionado no es un técnico' });
        }

        await pool.query(
            'INSERT INTO proyecto_tecnico (id_proyecto, id_usuario) VALUES ($1, $2)',
            [id, id_usuario]
        );
        res.status(201).json({ mensaje: 'Técnico asignado al proyecto' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'El técnico ya está asignado a este proyecto' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El proyecto o el técnico no existe' });
        }
        if (error.code === '22P02') {
            return res.status(400).json({ mensaje: 'Identificador inválido' });
        }
        console.error('Error al asignar técnico:', error);
        res.status(500).json({ error: 'Error al asignar el técnico' });
    }
};

// Quitar un técnico de un proyecto
const quitarTecnico = async (req, res) => {
    const { id, idUsuario } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM proyecto_tecnico WHERE id_proyecto = $1 AND id_usuario = $2 RETURNING *',
            [id, idUsuario]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'El técnico no está asignado a este proyecto' });
        }

        res.status(200).json({ mensaje: 'Técnico quitado del proyecto' });
    } catch (error) {
        console.error('Error al quitar técnico:', error);
        res.status(500).json({ error: 'Error al quitar el técnico' });
    }
};

module.exports = {
    obtenerProyectos,
    obtenerProyectoPorId,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
    listarTecnicos,
    obtenerTecnicosDeProyecto,
    asignarTecnico,
    quitarTecnico,
};