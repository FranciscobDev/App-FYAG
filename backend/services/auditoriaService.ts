import type { PoolClient } from 'pg';
import pool from '../config/db';

/**
 * Registro de auditoría transversal [BACK-1].
 *
 * Toda mutación de usuarios, roles, parámetros, artículos (catálogo de Cardex)
 * y futuras aprobaciones debe llamar a esta función DENTRO de su transacción,
 * pasando el `cliente` de esa transacción. Así, si la auditoría falla, la
 * mutación se revierte y nunca queda un cambio sin registro.
 *
 * Seguridad: los estados que se reciben NUNCA deben contener contraseñas ni hashes.
 */
export interface RegistroAuditoria {
    /** Entidad afectada: 'usuario', 'rol', 'parametro', 'articulo', ... */
    entidad: string;
    /** Acción realizada: 'crear', 'editar', 'cambiar_rol', 'deshabilitar', 'eliminar', ... */
    accion: string;
    /** ID numérico del registro afectado (null si se identifica por otra clave). */
    idRegistro: number | string | null;
    /** Usuario que ejecuta la acción (null cuando la hace el sistema). */
    idUsuarioEjecutor: number | string | null;
    /** Estado completo antes de la mutación (null si es una creación). */
    estadoAnterior: unknown;
    /** Estado completo después de la mutación (null si es una eliminación). */
    estadoNuevo: unknown;
    descripcion?: string;
}

const aJson = (valor: unknown): string | null =>
    valor === null || valor === undefined ? null : JSON.stringify(valor);

export const registrarAuditoria = async (
    registro: RegistroAuditoria,
    cliente?: PoolClient
): Promise<void> => {
    const ejecutor = registro.idUsuarioEjecutor != null ? Number(registro.idUsuarioEjecutor) : null;
    const idRegistro = registro.idRegistro != null ? Number(registro.idRegistro) : null;
    const consultor: Pick<PoolClient, 'query'> = cliente ?? pool;

    // clock_timestamp() da el instante exacto del evento, no el de inicio de la transacción.
    // Sin try/catch: un fallo aquí debe abortar la mutación asociada.
    await consultor.query(
        `INSERT INTO bitacora_auditoria
            (fecha_evento, id_usuario, entidad, accion, valor_anterior, valor_nuevo, descripcion, id_registro_afectado)
         VALUES (clock_timestamp(), $1, $2, $3, $4, $5, $6, $7)`,
        [
            ejecutor,
            registro.entidad,
            registro.accion,
            aJson(registro.estadoAnterior),
            aJson(registro.estadoNuevo),
            registro.descripcion ?? null,
            idRegistro,
        ]
    );
};

export default registrarAuditoria;
