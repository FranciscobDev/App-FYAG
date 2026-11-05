const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Consulta base: incluye el nombre del rol y nunca devuelve el hash
const SELECT_USUARIO = `
    SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
           u.rut, u.id_rol, r.nombre_rol, u.especializacion, u.activo
    FROM usuario u
    LEFT JOIN roles r ON r.id_rol = u.id_rol
`;

// Listar todos
const obtenerUsuarios = async (req, res) => {
    try {
        const result = await pool.query(`${SELECT_USUARIO} ORDER BY u.id_usuario ASC`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
};

// Obtener uno por ID
const obtenerUsuarioPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Listar roles (para el selector)
const listarRoles = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY id_rol ASC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar roles:', error);
        res.status(500).json({ error: 'Error al obtener los roles' });
    }
};

// Crear usuario
const crearUsuario = async (req, res) => {
    const {
        nombre_usuario, apellido_usuario, correo_usuario, rut,
        id_rol, especializacion, contrasena, activo
    } = req.body;

    if (!nombre_usuario || !apellido_usuario || !correo_usuario || !id_rol || !contrasena) {
        return res.status(400).json({
            mensaje: 'Los campos nombre, apellido, correo, rol y contraseña son obligatorios'
        });
    }

    try {
        const hash = await bcrypt.hash(contrasena, 10);

        const insert = await pool.query(
            `INSERT INTO usuario (nombre_usuario, apellido_usuario, correo_usuario, rut,
                                  id_rol, especializacion, contrasena_hash, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id_usuario`,
            [
                nombre_usuario,
                apellido_usuario,
                correo_usuario,
                rut || null,
                id_rol,
                especializacion || null,
                hash,
                activo !== false
            ]
        );

        const result = await pool.query(
            `${SELECT_USUARIO} WHERE u.id_usuario = $1`,
            [insert.rows[0].id_usuario]
        );

        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados en el sistema' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El rol especificado no existe' });
        }
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error interno al crear el usuario' });
    }
};

// Modificar usuario (los campos no enviados conservan su valor)
const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const {
        nombre_usuario, apellido_usuario, correo_usuario, rut,
        id_rol, especializacion, contrasena, activo
    } = req.body;

    try {
        // Solo se cifra si se envió una nueva contraseña
        const hash = contrasena ? await bcrypt.hash(contrasena, 10) : null;

        const update = await pool.query(
            `UPDATE usuario
             SET nombre_usuario   = COALESCE($1, nombre_usuario),
                 apellido_usuario = COALESCE($2, apellido_usuario),
                 correo_usuario   = COALESCE($3, correo_usuario),
                 rut              = COALESCE($4, rut),
                 id_rol           = COALESCE($5, id_rol),
                 especializacion  = COALESCE($6, especializacion),
                 contrasena_hash  = COALESCE($7, contrasena_hash),
                 activo           = COALESCE($8, activo)
             WHERE id_usuario = $9
             RETURNING id_usuario`,
            [
                nombre_usuario ?? null,
                apellido_usuario ?? null,
                correo_usuario ?? null,
                rut ?? null,
                id_rol ?? null,
                especializacion ?? null,
                hash,
                typeof activo === 'boolean' ? activo : null,
                id
            ]
        );

        if (update.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado para actualizar' });
        }

        const result = await pool.query(`${SELECT_USUARIO} WHERE u.id_usuario = $1`, [id]);

        res.status(200).json({
            mensaje: 'Usuario actualizado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados por otro usuario' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El rol especificado no existe' });
        }
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno al actualizar el usuario' });
    }
};

// Eliminar usuario
const eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM usuario WHERE id_usuario = $1 RETURNING id_usuario',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado para eliminar' });
        }

        res.status(200).json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({
                mensaje: 'No se puede eliminar el usuario porque está asociado a registros de proyectos u otras tablas'
            });
        }
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

module.exports = {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    listarRoles,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
};