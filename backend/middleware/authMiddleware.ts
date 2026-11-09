import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import pool from '../config/db';

export interface UsuarioTokenPayload extends JwtPayload {
    id: number;
    rol: string | null;
}

declare global {
    namespace Express {
        interface Request {
            usuario?: string | UsuarioTokenPayload;
        }
    }
}

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

    if (!Number.isInteger(Number(payload.id))) {
        res.status(401).json({ mensaje: 'La sesión no es válida' });
        return;
    }

    try {
        const resultado = await pool.query<{ id_usuario: number; nombre_rol: string | null; activo: boolean }>(
            `SELECT u.id_usuario, r.nombre_rol::text AS nombre_rol, u.activo
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1`,
            [payload.id]
        );
        const usuario = resultado.rows[0];

        if (!usuario || !usuario.activo) {
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'Tu cuenta está deshabilitada o ya no existe',
            });
            return;
        }

        req.usuario = { id: Number(usuario.id_usuario), rol: usuario.nombre_rol };
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
