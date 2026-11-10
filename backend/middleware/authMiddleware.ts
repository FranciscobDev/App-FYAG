import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import pool from '../config/db';

export interface UsuarioTokenPayload extends JwtPayload {
    id: number;
    rol: string | null;
    /** Identificador de la sesión del servidor (tabla sesion_usuario). */
    sid?: string;
}

declare global {
    namespace Express {
        interface Request {
            usuario?: string | UsuarioTokenPayload;
        }
    }
}

/** ID del usuario autenticado que ejecuta la petición, o null si no hay sesión. */
export const obtenerIdEjecutor = (req: Request): number | null =>
    typeof req.usuario === 'object' && req.usuario ? Number(req.usuario.id) : null;

/**
 * Valida el JWT y la sesión del servidor:
 *  - la cuenta debe seguir activa;
 *  - la sesión (sid) no debe estar revocada (cambio de clave, deshabilitación, cierre);
 *  - si pasaron más minutos de inactividad que el parámetro `minutos_inactividad_sesion`
 *    (leído en vivo), la sesión se revoca y responde SESSION_EXPIRED.
 * Cada petición válida renueva `ultima_actividad`.
 */
export const verificarToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const encabezado = req.headers.authorization || '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

    if (!token) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    let payload: UsuarioTokenPayload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET as string) as UsuarioTokenPayload;
    } catch {
        res.status(401).json({ mensaje: 'La sesión expiró o no es válida' });
        return;
    }

    if (!Number.isInteger(Number(payload.id)) || !payload.sid) {
        res.status(401).json({ codigo: 'SESSION_REVOKED', mensaje: 'La sesión no es válida' });
        return;
    }

    try {
        const resultado = await pool.query<{
            id_usuario: number;
            nombre_rol: string | null;
            activo: boolean;
            id_sesion: string | null;
            revocada: boolean | null;
            inactiva: boolean | null;
        }>(
            `SELECT u.id_usuario, r.nombre_rol::text AS nombre_rol, u.activo,
                    s.id_sesion, s.revocada,
                    (s.ultima_actividad < CURRENT_TIMESTAMP - make_interval(mins => (
                        SELECT valor FROM parametro_sistema WHERE clave = 'minutos_inactividad_sesion'
                    ))) AS inactiva
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             LEFT JOIN sesion_usuario s ON s.id_sesion = $2 AND s.id_usuario = u.id_usuario
             WHERE u.id_usuario = $1`,
            [payload.id, payload.sid]
        );
        const fila = resultado.rows[0];

        if (!fila || !fila.activo) {
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'Tu cuenta está deshabilitada o ya no existe',
            });
            return;
        }

        if (!fila.id_sesion || fila.revocada) {
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'Tu sesión fue cerrada. Inicia sesión nuevamente',
            });
            return;
        }

        if (fila.inactiva) {
            await pool.query('UPDATE sesion_usuario SET revocada = TRUE WHERE id_sesion = $1', [payload.sid]);
            res.status(401).json({
                codigo: 'SESSION_EXPIRED',
                mensaje: 'Tu sesión expiró por inactividad. Inicia sesión nuevamente',
            });
            return;
        }

        await pool.query(
            'UPDATE sesion_usuario SET ultima_actividad = CURRENT_TIMESTAMP WHERE id_sesion = $1',
            [payload.sid]
        );

        req.usuario = { id: Number(fila.id_usuario), rol: fila.nombre_rol };
        next();
    } catch (error) {
        console.error('Error al validar la sesión:', error);
        res.status(500).json({ error: 'Error al validar la sesión' });
    }
};

export const normalizarRol = (rol: string | null | undefined): string => {
    const rolLimpio = (rol ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (rolLimpio.includes('admin')) return 'admin';
    if (rolLimpio.includes('bodeg') || rolLimpio.includes('warehouse') || rolLimpio.includes('almac')) {
        return 'warehouse';
    }
    if (rolLimpio.includes('tecnic') || rolLimpio.includes('technician') || rolLimpio.includes('oper')) {
        return 'technician';
    }
    return rolLimpio;
};

export const verificarRoles = (...rolesPermitidos: string[]) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const rolLimpio = normalizarRol(payload?.rol);

        if (!rolesPermitidos.map(normalizarRol).includes(rolLimpio)) {
            res.status(403).json({
                mensaje: 'Acceso denegado: tu rol no tiene permiso para esta operación',
            });
            return;
        }

        next();
    };

export const verificarAdmin = verificarRoles('admin');

export default verificarToken;
