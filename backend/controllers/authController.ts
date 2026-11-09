import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

interface LoginBody {
    correo_usuario?: string;
    contrasena?: string;
}

interface UsuarioRow {
    id_usuario: number;
    nombre_usuario: string;
    apellido_usuario: string;
    correo_usuario: string;
    rut: string | null;
    id_rol: number;
    nombre_rol: string | null;
    activo: boolean;
    contrasena_hash: string | null;
}

export const login = async (req: Request<Record<string, string>, unknown, LoginBody>, res: Response): Promise<void> => {
    const { correo_usuario, contrasena } = req.body;

    if (!correo_usuario || !contrasena) {
        res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
        return;
    }

    try {
        const result = await pool.query<UsuarioRow>(
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
            res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
            return;
        }

        if (!fila.activo) {
            res.status(403).json({ mensaje: 'Tu cuenta está desactivada' });
            return;
        }

        // Registrar fecha y hora del último acceso
        await pool.query(
            'UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1',
            [fila.id_usuario]
        );

        const { contrasena_hash, ...usuario } = fila;

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.nombre_rol },
            process.env.JWT_SECRET as string,
            { expiresIn: '8h' }
        );

        res.status(200).json({ token, usuario });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
};

export const obtenerSesion = async (req: Request, res: Response): Promise<void> => {
    const payload = typeof req.usuario === 'object' ? req.usuario : null;
    if (!payload) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    try {
        const result = await pool.query<Omit<UsuarioRow, 'contrasena_hash'>>(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND u.activo = TRUE`,
            [payload.id]
        );

        if (!result.rows[0]) {
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'Tu cuenta está deshabilitada o ya no existe',
            });
            return;
        }

        res.status(200).json({ usuario: result.rows[0] });
    } catch (error) {
        console.error('Error al restaurar la sesión:', error);
        res.status(500).json({ error: 'Error interno al restaurar la sesión' });
    }
};

