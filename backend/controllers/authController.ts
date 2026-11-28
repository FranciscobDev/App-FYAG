import { Request, Response } from 'express';
import { randomInt, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import {
    EXPIRACION_ACCESS_TOKEN,
    EXPIRACION_REFRESH_TOKEN,
    SEGUNDOS_ACCESS_TOKEN,
    crearSesion,
    guardarRefreshTokenSesion,
    revocarSesionIndividual,
} from '../services/sesiones';
import { obtenerValorParametro } from '../services/parametros';
import { normalizarRol, obtenerIdEjecutor, obtenerSidEjecutor } from '../middleware/authMiddleware';
import { obtenerJwtSecret } from '../config/entorno';
import { hashToken } from '../services/claves';
import { enviarCorreo } from '../services/correo';

interface LoginBody {
    correo_usuario?: string;
    contrasena?: string;
    soportar_2fa?: boolean;
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
    requiere_2fa?: boolean;
}

interface PayloadDesafio2fa {
    id: number;
    desafioId: string;
    tipo: '2fa_challenge';
}

interface PayloadRefreshToken {
    id: number;
    rol: string | null;
    sid: string;
    jti: string;
    tipo: 'refresh';
}

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';
const MAX_INTENTOS_2FA = 5;

const emitirParTokens = async (
    usuario: { id_usuario: number; nombre_rol: string | null },
    idSesion: string
): Promise<{ token: string; refresh_token: string; expira_en_segundos: number }> => {
    const secreto = obtenerJwtSecret();
    const token = jwt.sign(
        { id: usuario.id_usuario, rol: usuario.nombre_rol, sid: idSesion, tipo: 'access' },
        secreto,
        { expiresIn: EXPIRACION_ACCESS_TOKEN }
    );
    const refreshToken = jwt.sign(
        {
            id: usuario.id_usuario,
            rol: usuario.nombre_rol,
            sid: idSesion,
            jti: randomUUID(),
            tipo: 'refresh',
        },
        secreto,
        { expiresIn: EXPIRACION_REFRESH_TOKEN }
    );

    await guardarRefreshTokenSesion(idSesion, hashToken(refreshToken));

    return {
        token,
        refresh_token: refreshToken,
        expira_en_segundos: SEGUNDOS_ACCESS_TOKEN,
    };
};

const esRolAdministrativo = (nombreRol: string | null | undefined, idRol?: number | null): boolean =>
    normalizarRol(nombreRol) === 'admin' || Number(idRol) === 1;

export const login = async (req: Request<Record<string, string>, unknown, LoginBody>, res: Response): Promise<void> => {
    const { correo_usuario, contrasena } = req.body ?? {};

    if (!correo_usuario || !contrasena) {
        res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
        return;
    }

    try {
        const result = await pool.query<FilaLogin>(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo, u.contrasena_hash,
                    COALESCE(u.requiere_2fa, FALSE) AS requiere_2fa,
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
            const maximoIntentos = await obtenerValorParametro('intentos_bloqueo');
            const minutosBloqueo = await obtenerValorParametro('minutos_bloqueo');

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

        // Acceso correcto: reinicia contador y levanta bloqueo
        await pool.query(
            `UPDATE usuario
             SET ultimo_acceso = CURRENT_TIMESTAMP, intentos_fallidos = 0, bloqueado_hasta = NULL
             WHERE id_usuario = $1`,
            [fila.id_usuario]
        );

        const exige2faAdmin =
            esRolAdministrativo(fila.nombre_rol, fila.id_rol) &&
            (Boolean(fila.requiere_2fa) || process.env.EXIGIR_2FA_ADMIN === 'true');

        if (exige2faAdmin) {
            const codigoOtp = String(randomInt(100000, 1000000));
            const idDesafio = randomUUID();

            // Invalidar desafíos anteriores no consumidos del administrador y registrar el nuevo (5 min)
            await pool.query(
                `UPDATE desafio_2fa_admin
                 SET consumido_en = CURRENT_TIMESTAMP
                 WHERE id_usuario = $1 AND consumido_en IS NULL`,
                [fila.id_usuario]
            );
            await pool.query(
                `INSERT INTO desafio_2fa_admin (id_desafio, id_usuario, codigo_hash, expira_en)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
                [idDesafio, fila.id_usuario, hashToken(codigoOtp)]
            );

            await enviarCorreo({
                para: fila.correo_usuario,
                asunto: 'Código de verificación 2FA - FYAG',
                texto:
                    `Se solicitó iniciar sesión en una cuenta con permisos administrativos.\n\n` +
                    `Tu código de verificación de segundo factor (2FA) es: ${codigoOtp}\n\n` +
                    `Este código vence en 5 minutos y es de un solo uso.`,
            });

            const desafioToken = jwt.sign(
                { id: fila.id_usuario, desafioId: idDesafio, tipo: '2fa_challenge' } satisfies PayloadDesafio2fa,
                obtenerJwtSecret(),
                { expiresIn: '5m' }
            );

            res.status(200).json({
                requiere_2fa: true,
                desafio_token: desafioToken,
                mensaje: 'Se envió un código de verificación de 6 dígitos a tu correo corporativo.',
            });
            return;
        }

        const idSesion = await crearSesion(fila.id_usuario);
        const { contrasena_hash, bloqueada, requiere_2fa, ...usuario } = fila;
        const tokens = await emitirParTokens(usuario, idSesion);

        res.status(200).json({ ...tokens, usuario });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
};

/** POST /api/auth/verificar-2fa — Completa el inicio de sesión de un Administrador validando el OTP de 6 dígitos. */
export const verificar2faLogin = async (req: Request, res: Response): Promise<void> => {
    const desafioToken = typeof req.body?.desafio_token === 'string' ? req.body.desafio_token.trim() : '';
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';

    if (!desafioToken || !/^\d{6}$/.test(codigo)) {
        res.status(400).json({ mensaje: 'Debes ingresar el código de verificación de 6 dígitos' });
        return;
    }

    let payload: PayloadDesafio2fa;
    try {
        payload = jwt.verify(desafioToken, obtenerJwtSecret()) as PayloadDesafio2fa;
    } catch {
        res.status(401).json({
            codigo: 'DESAFIO_2FA_EXPIRADO',
            mensaje: 'El código de verificación expiró o no es válido. Inicia sesión nuevamente.',
        });
        return;
    }

    if (payload.tipo !== '2fa_challenge' || !payload.id || !payload.desafioId) {
        res.status(401).json({ codigo: 'DESAFIO_2FA_INVALIDO', mensaje: 'El desafío de verificación no es válido' });
        return;
    }

    try {
        const resDesafio = await pool.query<{
            id_desafio: string;
            id_usuario: number;
            codigo_hash: string;
            intentos: number;
        }>(
            `SELECT id_desafio, id_usuario, codigo_hash, intentos
             FROM desafio_2fa_admin
             WHERE id_desafio = $1
               AND id_usuario = $2
               AND consumido_en IS NULL
               AND expira_en > CURRENT_TIMESTAMP`,
            [payload.desafioId, payload.id]
        );

        const desafio = resDesafio.rows[0];
        if (!desafio || desafio.intentos >= MAX_INTENTOS_2FA) {
            res.status(401).json({
                codigo: 'DESAFIO_2FA_EXPIRADO',
                mensaje: 'El código de verificación expiró o superó el límite de intentos. Inicia sesión nuevamente.',
            });
            return;
        }

        if (hashToken(codigo) !== desafio.codigo_hash) {
            const nuevosIntentos = desafio.intentos + 1;
            await pool.query(
                `UPDATE desafio_2fa_admin
                 SET intentos = $2,
                     consumido_en = CASE WHEN $2 >= $3 THEN CURRENT_TIMESTAMP ELSE consumido_en END
                 WHERE id_desafio = $1`,
                [desafio.id_desafio, nuevosIntentos, MAX_INTENTOS_2FA]
            );
            res.status(401).json({
                codigo: 'CODIGO_2FA_INVALIDO',
                mensaje: 'Código de verificación incorrecto',
            });
            return;
        }

        await pool.query(
            'UPDATE desafio_2fa_admin SET consumido_en = CURRENT_TIMESTAMP WHERE id_desafio = $1',
            [desafio.id_desafio]
        );

        const resUsuario = await pool.query<{
            id_usuario: number;
            nombre_usuario: string;
            apellido_usuario: string;
            correo_usuario: string;
            rut: string | null;
            id_rol: number;
            nombre_rol: string | null;
            activo: boolean;
        }>(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol, u.activo
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND u.activo = TRUE`,
            [payload.id]
        );

        const usuario = resUsuario.rows[0];
        if (!usuario) {
            res.status(401).json({ codigo: 'SESSION_REVOKED', mensaje: 'Tu cuenta está deshabilitada o ya no existe' });
            return;
        }

        const idSesion = await crearSesion(usuario.id_usuario);
        const tokens = await emitirParTokens(usuario, idSesion);

        res.status(200).json({ ...tokens, usuario });
    } catch (error) {
        console.error('Error al verificar 2FA:', error);
        res.status(500).json({ error: 'Error interno al verificar el segundo factor' });
    }
};

/** POST /api/auth/refresh — Renueva el Access Token corto usando un Refresh Token válido (con rotación). */
export const renovarSesion = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token.trim() : '';
    if (!refreshToken) {
        res.status(400).json({ mensaje: 'El refresh_token es obligatorio' });
        return;
    }

    let payload: PayloadRefreshToken;
    try {
        payload = jwt.verify(refreshToken, obtenerJwtSecret()) as PayloadRefreshToken;
    } catch {
        res.status(401).json({ codigo: 'SESSION_EXPIRED', mensaje: 'La sesión expiró. Inicia sesión nuevamente' });
        return;
    }

    if (payload.tipo !== 'refresh' || !Number.isInteger(Number(payload.id)) || !payload.sid) {
        res.status(401).json({ codigo: 'SESSION_REVOKED', mensaje: 'Token de renovación inválido' });
        return;
    }

    try {
        const resultado = await pool.query<{
            id_usuario: number;
            nombre_usuario: string;
            apellido_usuario: string;
            correo_usuario: string;
            rut: string | null;
            id_rol: number;
            nombre_rol: string | null;
            activo: boolean;
            id_sesion: string | null;
            revocada: boolean | null;
            inactiva: boolean | null;
            refresh_token_hash: string | null;
            refresh_vencido: boolean | null;
        }>(
            `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario,
                    u.rut, u.id_rol, r.nombre_rol::text AS nombre_rol, u.activo,
                    s.id_sesion, s.revocada, s.refresh_token_hash,
                    (s.refresh_expira_en IS NOT NULL AND s.refresh_expira_en < CURRENT_TIMESTAMP) AS refresh_vencido,
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
        if (!fila || !fila.activo || !fila.id_sesion || fila.revocada || fila.refresh_vencido) {
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'Tu sesión fue cerrada o ya no es válida. Inicia sesión nuevamente',
            });
            return;
        }

        if (fila.inactiva) {
            await pool.query('UPDATE sesion_usuario SET revocada = TRUE, refresh_token_hash = NULL WHERE id_sesion = $1', [
                payload.sid,
            ]);
            res.status(401).json({
                codigo: 'SESSION_EXPIRED',
                mensaje: 'Tu sesión expiró por inactividad. Inicia sesión nuevamente',
            });
            return;
        }

        // Si el hash del refresh token está registrado en la sesión y no coincide, se detectó reutilización
        const hashRecibido = hashToken(refreshToken);
        if (fila.refresh_token_hash && fila.refresh_token_hash !== hashRecibido) {
            await pool.query('UPDATE sesion_usuario SET revocada = TRUE, refresh_token_hash = NULL WHERE id_sesion = $1', [
                payload.sid,
            ]);
            res.status(401).json({
                codigo: 'SESSION_REVOKED',
                mensaje: 'El token de renovación ya fue utilizado. Por seguridad, la sesión fue cerrada.',
            });
            return;
        }

        const usuario = {
            id_usuario: fila.id_usuario,
            nombre_usuario: fila.nombre_usuario,
            apellido_usuario: fila.apellido_usuario,
            correo_usuario: fila.correo_usuario,
            rut: fila.rut,
            id_rol: fila.id_rol,
            nombre_rol: fila.nombre_rol,
            activo: fila.activo,
        };

        const tokens = await emitirParTokens(usuario, payload.sid);
        res.status(200).json({ ...tokens, usuario });
    } catch (error) {
        console.error('Error al renovar la sesión:', error);
        res.status(500).json({ error: 'Error interno al renovar la sesión' });
    }
};

/** POST /api/auth/logout — Invalida inmediatamente la sesión actual en el servidor. */
export const logout = async (req: Request, res: Response): Promise<void> => {
    const idUsuario = obtenerIdEjecutor(req);
    const idSesion = obtenerSidEjecutor(req);

    if (!idSesion) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    try {
        await revocarSesionIndividual(idSesion, idUsuario);
        res.status(200).json({ ok: true, mensaje: 'Sesión cerrada e invalidada correctamente' });
    } catch (error) {
        console.error('Error al cerrar la sesión:', error);
        res.status(500).json({ error: 'Error interno al cerrar la sesión' });
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
