import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/db';

export const EXPIRACION_ACCESS_TOKEN = '15m';
export const EXPIRACION_REFRESH_TOKEN = '7d';
export const SEGUNDOS_ACCESS_TOKEN = 15 * 60;
export const DIAS_REFRESH_TOKEN = 7;

/** Crea una sesión del servidor y devuelve su identificador (claim `sid` del JWT). */
export const crearSesion = async (idUsuario: number): Promise<string> => {
    const idSesion = randomUUID();
    await pool.query(
        'INSERT INTO sesion_usuario (id_sesion, id_usuario) VALUES ($1, $2)',
        [idSesion, idUsuario]
    );
    return idSesion;
};

/** Guarda el hash del refresh token vigente asociado a la sesión para permitir rotación y revocación. */
export const guardarRefreshTokenSesion = async (
    idSesion: string,
    refreshTokenHash: string,
    diasVigencia: number = DIAS_REFRESH_TOKEN
): Promise<void> => {
    await pool.query(
        `UPDATE sesion_usuario
         SET refresh_token_hash = $2,
             refresh_expira_en = CURRENT_TIMESTAMP + make_interval(days => $3),
             ultima_actividad = CURRENT_TIMESTAMP
         WHERE id_sesion = $1 AND revocada = FALSE`,
        [idSesion, refreshTokenHash, diasVigencia]
    );
};

/** Revoca una sesión individual en el servidor (cierre de sesión explícito). */
export const revocarSesionIndividual = async (
    idSesion: string,
    idUsuario?: number | null
): Promise<boolean> => {
    const res = idUsuario != null
        ? await pool.query(
              `UPDATE sesion_usuario
               SET revocada = TRUE, refresh_token_hash = NULL
               WHERE id_sesion = $1 AND id_usuario = $2 AND revocada = FALSE`,
              [idSesion, idUsuario]
          )
        : await pool.query(
              `UPDATE sesion_usuario
               SET revocada = TRUE, refresh_token_hash = NULL
               WHERE id_sesion = $1 AND revocada = FALSE`,
              [idSesion]
          );
    return (res.rowCount ?? 0) > 0;
};

/**
 * Revoca todas las sesiones activas de un usuario. Devuelve cuántas se cerraron.
 * Se usa al cambiar la contraseña y al deshabilitar la cuenta.
 */
export const revocarSesionesUsuario = async (cliente: PoolClient, idUsuario: number | string): Promise<number> => {
    const res = await cliente.query(
        'UPDATE sesion_usuario SET revocada = TRUE WHERE id_usuario = $1 AND revocada = FALSE',
        [idUsuario]
    );
    return res.rowCount ?? 0;
};

/**
 * Política de retención y minimización de datos temporales de autenticación:
 * - Elimina desafíos 2FA vencidos o ya consumidos hace más de 24 horas.
 * - Elimina tokens de recuperación de contraseña vencidos o usados hace más de 7 días.
 * - Elimina sesiones cerradas/revocadas o con refresh token vencido cuya última actividad
 *   supere `diasRetencionSesiones` (30 días por defecto).
 */
export const purgarDatosAutenticacionExpirados = async (
    cliente: Pick<PoolClient, 'query'> = pool,
    diasRetencionSesiones: number = 30
): Promise<{
    desafios_2fa_eliminados: number;
    tokens_recuperacion_eliminados: number;
    sesiones_antiguas_eliminadas: number;
}> => {
    const dias = Number.isInteger(diasRetencionSesiones) && diasRetencionSesiones > 0 ? diasRetencionSesiones : 30;

    const res2fa = await cliente.query(
        `/* retencion:purgar-2fa */
         DELETE FROM desafio_2fa_admin
         WHERE expira_en < CURRENT_TIMESTAMP - INTERVAL '24 hours'
            OR (consumido_en IS NOT NULL AND consumido_en < CURRENT_TIMESTAMP - INTERVAL '24 hours')`
    );

    const resRecup = await cliente.query(
        `/* retencion:purgar-tokens-clave */
         DELETE FROM token_recuperacion_clave
         WHERE expira_en < CURRENT_TIMESTAMP - INTERVAL '7 days'
            OR (usado_en IS NOT NULL AND usado_en < CURRENT_TIMESTAMP - INTERVAL '7 days')`
    );

    const resSesiones = await cliente.query(
        `/* retencion:purgar-sesiones */
         DELETE FROM sesion_usuario
         WHERE (revocada = TRUE OR (refresh_expira_en IS NOT NULL AND refresh_expira_en < CURRENT_TIMESTAMP))
           AND ultima_actividad < CURRENT_TIMESTAMP - make_interval(days => $1)`,
        [dias]
    );

    return {
        desafios_2fa_eliminados: res2fa.rowCount ?? 0,
        tokens_recuperacion_eliminados: resRecup.rowCount ?? 0,
        sesiones_antiguas_eliminadas: resSesiones.rowCount ?? 0,
    };
};
