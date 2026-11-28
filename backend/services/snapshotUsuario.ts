import type { PoolClient } from 'pg';

/**
 * Estado auditable de un usuario. Nunca incluye `contrasena_hash`.
 * Con `bloquear = true` hace SELECT ... FOR UPDATE para evitar carreras con otras mutaciones.
 */
export const snapshotUsuario = async (
    cliente: PoolClient,
    idUsuario: number | string,
    bloquear = false
): Promise<Record<string, unknown> | null> => {
    const res = await cliente.query(
        `SELECT u.id_usuario, u.nombre_usuario, u.apellido_usuario, u.correo_usuario, u.rut,
                u.id_rol, r.nombre_rol::text AS nombre_rol, u.especializacion, u.activo,
                u.intentos_fallidos, u.bloqueado_hasta
         FROM usuario u
         LEFT JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = $1 ${bloquear ? 'FOR UPDATE OF u' : ''}`,
        [idUsuario]
    );
    return res.rows[0] ?? null;
};
