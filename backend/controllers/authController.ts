import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { crearSesion } from '../services/sesiones';
import { obtenerValorParametro } from '../services/parametros';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

interface LoginBody {
    correo_usuario?: string;
    contrasena?: string;
}

interface FilaLogin {
    id_usuario: number;
    nombre_usuario: string;
    apellido_usuario: string;
    correo_usuario: string;
    rut: string | null;
    id_rol: number;
    nombre_rol: string | null;
    activo: boolean;
    contrasena_hash: string | null;
    bloqueada: boolean;
}

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';

export const login = async (req: Request<Record<string, string>, unknown, LoginBody>, res: Response): Promise<void> => {
    const { correo_usuario, contrasena } = req.body;

    if (!correo_usuario || !contrasena) {
        res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
        return;
    }

    try {
        const result = await pool.query<FilaLogin>(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo, u.contrasena_hash,
                    (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > CURRENT_TIMESTAMP) AS bloqueada
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE LOWER(u.correo_usuario) = LOWER($1)`,
            [String(correo_usuario).trim()]
        );

        const fila = result.rows[0];

        // Mismo mensaje si el correo no existe o la clave es incorrecta
        if (!fila) {
            res.status(401).json({ mensaje: MENSAJE_CREDENCIALES });
            return;
        }

        // Cuenta bloqueada: se rechaza aunque la clave sea correcta (p. ej. el 5.º intento)
        if (fila.bloqueada) {
            res.status(423).json({
                codigo: 'CUENTA_BLOQUEADA',
                mensaje: 'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta más tarde',
            });
            return;
        }

        const claveOk = fila.contrasena_hash
            ? await bcrypt.compare(String(contrasena), fila.contrasena_hash)
            : false;

        if (!claveOk) {
            // Parámetros leídos en vivo: un cambio administrativo aplica en el siguiente intento.
            // La cuenta se bloquea al superar `intentos_bloqueo` fallos consecutivos.
            const maximoIntentos = await obtenerValorParametro('intentos_bloqueo');
            const minutosBloqueo = await obtenerValorParametro('minutos_bloqueo');

            // Un único UPDATE atómico: incrementa el contador y, si llega al límite, bloquea
            await pool.query(
                `UPDATE usuario SET
                    intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
                    bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2
                        THEN CURRENT_TIMESTAMP + make_interval(mins => $3)
                        ELSE bloqueado_hasta END
                 WHERE id_usuario = $1`,
                [fila.id_usuario, maximoIntentos, minutosBloqueo]
            );

            res.status(401).json({ mensaje: MENSAJE_CREDENCIALES });
            return;
        }

        if (!fila.activo) {
            res.status(403).json({ mensaje: 'Tu cuenta está desactivada' });
            return;
        }

        // Acceso correcto: reinicia contador, levanta bloqueo y registra último acceso
        await pool.query(
            `UPDATE usuario
             SET ultimo_acceso = CURRENT_TIMESTAMP, intentos_fallidos = 0, bloqueado_hasta = NULL
             WHERE id_usuario = $1`,
            [fila.id_usuario]
        );

        const idSesion = await crearSesion(fila.id_usuario);

        const { contrasena_hash, bloqueada, ...usuario } = fila;

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.nombre_rol, sid: idSesion },
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
    const idUsuario = obtenerIdEjecutor(req);
    if (idUsuario === null) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    try {
        const result = await pool.query(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND u.activo = TRUE`,
            [idUsuario]
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
