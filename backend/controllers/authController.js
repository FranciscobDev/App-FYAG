const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { correo_usuario, contrasena } = req.body;

    if (!correo_usuario || !contrasena) {
        return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    try {
        const result = await pool.query(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo, u.contrasena_hash
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE LOWER(u.correo_usuario) = LOWER($1)`,
            [String(correo_usuario).trim()]
        );

        const fila = result.rows[0];
        const claveOk = fila?.contrasena_hash
            ? await bcrypt.compare(String(contrasena), fila.contrasena_hash)
            : false;

        // Mismo mensaje si el correo no existe o la clave es incorrecta
        if (!claveOk) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
        }

        if (!fila.activo) {
            return res.status(403).json({ mensaje: 'Tu cuenta está desactivada' });
        }

        const { contrasena_hash, ...usuario } = fila;

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.nombre_rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({ token, usuario });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
};

module.exports = { login };