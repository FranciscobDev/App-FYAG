import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

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

export const verificarToken = (req: Request, res: Response, next: NextFunction): void => {
    const encabezado = req.headers.authorization || '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

    if (!token) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET as string) as UsuarioTokenPayload;
        next();
    } catch {
        res.status(401).json({ mensaje: 'La sesión expiró o no es válida' });
    }
};

export const verificarAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const payload = typeof req.usuario === 'object' ? req.usuario : null;
    const rolLimpio = (payload?.rol ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!rolLimpio.includes('admin')) {
        res.status(403).json({
            mensaje: 'Acceso denegado: solo el Administrador puede gestionar cuentas de usuario',
        });
        return;
    }

    next();
};

export default verificarToken;
