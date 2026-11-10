import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/db';

/** Crea una sesión del servidor y devuelve su identificador (claim `sid` del JWT). */
export const crearSesion = async (idUsuario: number): Promise<string> => {
    const idSesion = randomUUID();
    await pool.query(
        'INSERT INTO sesion_usuario (id_sesion, id_usuario) VALUES ($1, $2)',
        [idSesion, idUsuario]
    );
    return idSesion;
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
