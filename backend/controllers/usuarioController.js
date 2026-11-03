const pool = require('../config/db');


const obtenerUsuario = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM usuario ORDER BY id_usuario ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
};


const obtenerUsuarioPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM usuario WHERE id_usuario = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};



const crearUsuario = async (req, res) => {

    const { nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, especializacion, contrasena_hash } = req.body;


    if (!nombre_usuario || !apellido_usuario || !correo_usuario || !id_rol || !contrasena_hash) {
        return res.status(400).json({
            mensaje: 'Los campos nombre, apellido, correo, rol y contraseña son obligatorios'
        });
    }

    try {
        const query = `
            INSERT INTO usuario (
                nombre_usuario, 
                apellido_usuario, 
                correo_usuario, 
                rut, 
                id_rol, 
                especializacion, 
                contrasena_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id_usuario, nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, especializacion, activo;
        `;

        const values = [nombre_usuario, apellido_usuario, correo_usuario, rut || null, id_rol, especializacion || null, contrasena_hash];

        const result = await pool.query(query, values);

        res.status(201).json({
            mensaje: 'Usuario creado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados en el sistema' });
        }
        // Error 23503: Violación de llave foránea (el id_rol no existe en la tabla roles)
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El rol especificado no existe' });
        }

        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error interno al crear el usuario' });
    }
};

const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const {
        nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, especializacion, contrasena_hash, activo
    } = req.body;

    try {
        const query = `
            UPDATE usuario
            SET 
                nombre_usuario = $1,
                apellido_usuario = $2,
                correo_usuario = $3,
                rut = $4,
                id_rol = $5,
                especializacion = $6,
                contrasena_hash = $7,
                activo = $8
            WHERE id_usuario = $9
            RETURNING id_usuario, nombre_usuario, apellido_usuario, correo_usuario, rut, id_rol, especializacion, activo;
        `;

        const values = [
            nombre_usuario, apellido_usuario, correo_usuario, rut || null, id_rol, especializacion || null, contrasena_hash, activo, id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado para actualizar' });
        }

        res.status(200).json({
            mensaje: 'Usuario actualizado exitosamente',
            usuario: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ mensaje: 'El RUT o el correo ingresado ya están registrados por otro usuario' });
        }

        // Error 23503: Violación de llave foránea (el id_rol no existe en la tabla roles)
        if (error.code === '23503') {
            return res.status(400).json({ mensaje: 'El rol especificado no existe' });
        }

        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno al actualizar el usuario' });
    }
};

const eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM usuario WHERE id_usuario = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado para eliminar' });
        }

        res.status(200).json({
            mensaje: 'Usuario eliminado correctamente',
            usuarioEliminado: result.rows[0]
        });
    } catch (error) {
        // (se intenta borrar un usuario que se usa en otra tabla)
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
    obtenerUsuario,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
};