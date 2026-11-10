import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import pool from '../config/db';
import { registrarAuditoria } from '../services/auditoriaService';
import { ejecutarTransaccion } from '../services/transaccion';
import { snapshotUsuario } from '../services/snapshotUsuario';
import { revocarSesionesUsuario } from '../services/sesiones';
import { obtenerValorParametro } from '../services/parametros';
import { enviarCorreo } from '../services/correo';
import { hashToken, validarFortalezaClave } from '../services/claves';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

// Idéntico exista o no el correo: no debe revelar cuentas registradas
const MENSAJE_SOLICITUD =
    'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.';
const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido o ya expiró. Solicita uno nuevo.';

const urlRestablecer = (): string =>
    process.env.URL_RESTABLECER_CLAVE || 'http://localhost:8081/restablecer-clave';

const textoTrimOrVacio = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Genera un token aleatorio, guarda SOLO su hash y envía el enlace.
 * Invalida los enlaces anteriores pendientes del mismo usuario.
 */
const generarYEnviarEnlace = async (idUsuario: number, correo: string): Promise<void> => {
    const token = randomBytes(32).toString('base64url');
    const minutos = await obtenerValorParametro('minutos_validez_enlace_clave');

    await ejecutarTransaccion(async (cliente) => {
        await cliente.query(
            `UPDATE token_recuperacion_clave SET expira_en = CURRENT_TIMESTAMP
             WHERE id_usuario = $1 AND usado_en IS NULL AND expira_en > CURRENT_TIMESTAMP`,
            [idUsuario]
        );
        await cliente.query(
            `INSERT INTO token_recuperacion_clave (id_usuario, token_hash, expira_en)
             VALUES ($1, $2, CURRENT_TIMESTAMP + make_interval(mins => $3))`,
            [idUsuario, hashToken(token), minutos]
        );
    });

    const enlace = `${urlRestablecer()}?token=${encodeURIComponent(token)}`;
    await enviarCorreo({
        para: correo,
        asunto: 'Restablece tu contraseña - FYAG',
        texto:
            `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
            `Usa este enlace (válido por ${minutos} minutos y de un solo uso):\n${enlace}\n\n` +
            `Si no fuiste tú, ignora este correo; tu contraseña no cambiará.`,
    });
};

// POST /auth/recuperar-clave  (público)
export const solicitarRecuperacion = async (req: Request, res: Response): Promise<void> => {
    const correo = textoTrimOrVacio(req.body?.correo_usuario).toLowerCase();
    if (!correo) {
        res.status(400).json({ mensaje: 'Debes indicar tu correo' });
        return;
    }

    try {
        const resultado = await pool.query<{ id_usuario: number; correo_usuario: string; activo: boolean }>(
            'SELECT id_usuario, correo_usuario, activo FROM usuario WHERE LOWER(correo_usuario) = $1',
            [correo]
        );
        const usuario = resultado.rows[0];

        // El envío no bloquea la respuesta: correo real y falso responden igual y en el mismo tiempo
        if (usuario?.activo) {
            generarYEnviarEnlace(usuario.id_usuario, usuario.correo_usuario).catch((error) => {
                console.error('Error al generar o enviar enlace de recuperación:', error);
            });
        }

        res.status(200).json({ mensaje: MENSAJE_SOLICITUD });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error interno al procesar la solicitud');
    }
};

// POST /auth/restablecer-clave  (público, con el enlace recibido por correo)
export const restablecerClave = async (req: Request, res: Response): Promise<void> => {
    const token = textoTrimOrVacio(req.body?.token);
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';

    if (!token || !contrasena) {
        res.status(400).json({ mensaje: 'Debes indicar el enlace y la nueva contraseña' });
        return;
    }

    const errorClave = validarFortalezaClave(contrasena);
    if (errorClave) {
        res.status(400).json({ mensaje: errorClave });
        return;
    }

    try {
        const hash = await bcrypt.hash(contrasena, 10);

        await ejecutarTransaccion(async (cliente) => {
            // FOR UPDATE: dos peticiones simultáneas con el mismo enlace no pueden ambas aceptarlo
            const enlace = await cliente.query<{ id_token: number; id_usuario: number }>(
                `SELECT t.id_token, t.id_usuario
                 FROM token_recuperacion_clave t
                 JOIN usuario u ON u.id_usuario = t.id_usuario
                 WHERE t.token_hash = $1
                   AND t.usado_en IS NULL
                   AND t.expira_en > CURRENT_TIMESTAMP
                   AND u.activo = TRUE
                 FOR UPDATE OF t`,
                [hashToken(token)]
            );
            const fila = enlace.rows[0];
            if (!fila) {
                throw new ErrorAplicacion(400, MENSAJE_ENLACE_INVALIDO);
            }

            const antes = await snapshotUsuario(cliente, fila.id_usuario, true);

            await cliente.query(
                `UPDATE usuario SET contrasena_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL
                 WHERE id_usuario = $1`,
                [fila.id_usuario, hash]
            );

            // El enlace usado y cualquier otro pendiente del usuario quedan invalidados
            await cliente.query(
                `UPDATE token_recuperacion_clave SET usado_en = CURRENT_TIMESTAMP
                 WHERE id_usuario = $1 AND usado_en IS NULL`,
                [fila.id_usuario]
            );

            const sesionesCerradas = await revocarSesionesUsuario(cliente, fila.id_usuario);
            const despues = await snapshotUsuario(cliente, fila.id_usuario);

            await registrarAuditoria({
                entidad: 'usuario',
                accion: 'restablecer_clave',
                idRegistro: fila.id_usuario,
                idUsuarioEjecutor: null,
                estadoAnterior: antes,
                estadoNuevo: despues,
                descripcion: `Contraseña restablecida mediante enlace de recuperación; ${sesionesCerradas} sesión(es) cerradas`,
            }, cliente);
        });

        res.status(200).json({
            mensaje: 'Tu contraseña fue actualizada. Inicia sesión con la nueva contraseña.',
        });
    } catch (error) {
        if (error instanceof ErrorAplicacion && error.message === MENSAJE_ENLACE_INVALIDO) {
            res.status(400).json({ codigo: 'ENLACE_INVALIDO', mensaje: error.message });
            return;
        }
        enviarErrorHttp(res, error, 'Error interno al restablecer la contraseña');
    }
};

// POST /auth/cambiar-clave  (autenticado: cambio voluntario desde la cuenta)
export const cambiarClave = async (req: Request, res: Response): Promise<void> => {
    const idUsuario = obtenerIdEjecutor(req);
    const actual = typeof req.body?.contrasena_actual === 'string' ? req.body.contrasena_actual : '';
    const nueva = typeof req.body?.contrasena_nueva === 'string' ? req.body.contrasena_nueva : '';

    if (!actual || !nueva) {
        res.status(400).json({ mensaje: 'Debes indicar la contraseña actual y la nueva' });
        return;
    }

    const errorClave = validarFortalezaClave(nueva);
    if (errorClave) {
        res.status(400).json({ mensaje: errorClave });
        return;
    }

    if (actual === nueva) {
        res.status(400).json({ mensaje: 'La nueva contraseña debe ser distinta de la actual' });
        return;
    }

    try {
        const hash = await bcrypt.hash(nueva, 10);

        await ejecutarTransaccion(async (cliente) => {
            const fila = await cliente.query<{ contrasena_hash: string | null }>(
                'SELECT contrasena_hash FROM usuario WHERE id_usuario = $1 AND activo = TRUE FOR UPDATE',
                [idUsuario]
            );
            const hashActual = fila.rows[0]?.contrasena_hash;
            if (!hashActual) {
                throw new ErrorAplicacion(401, 'Debes iniciar sesión');
            }

            const coincide = await bcrypt.compare(actual, hashActual);
            if (!coincide) {
                throw new ErrorAplicacion(400, 'La contraseña actual no es correcta');
            }

            const antes = await snapshotUsuario(cliente, idUsuario as number, true);

            await cliente.query('UPDATE usuario SET contrasena_hash = $2 WHERE id_usuario = $1', [idUsuario, hash]);

            // Cierra TODAS las sesiones, incluida la actual: hay que volver a iniciar sesión
            const sesionesCerradas = await revocarSesionesUsuario(cliente, idUsuario as number);
            const despues = await snapshotUsuario(cliente, idUsuario as number);

            await registrarAuditoria({
                entidad: 'usuario',
                accion: 'cambiar_clave',
                idRegistro: idUsuario,
                idUsuarioEjecutor: idUsuario,
                estadoAnterior: antes,
                estadoNuevo: despues,
                descripcion: `Contraseña cambiada por el propio usuario; ${sesionesCerradas} sesión(es) cerradas`,
            }, cliente);
        });

        res.status(200).json({
            mensaje: 'Contraseña actualizada. Por seguridad, tus sesiones se cerraron: inicia sesión nuevamente.',
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error interno al cambiar la contraseña');
    }
};
