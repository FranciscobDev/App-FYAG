import pool from '../config/db';

export interface ParametrosAuditoria {
    accion: 'crear' | 'editar' | 'deshabilitar' | string;
    idUsuarioAfectado?: number | string | null;
    idUsuarioEjecutor?: number | string | null;
    detalles?: string;
    entidad?: string;
}

/**
 * Función requerida por [BACK-1] para registrar eventos de auditoría
 * al crear, editar o deshabilitar usuarios.
 * Se conecta a la tabla de auditoría en H14 (Sprint 2).
 * 
 * Cumplimiento de seguridad: NUNCA recibe ni almacena contraseñas en claro.
 */
export const registrarAuditoria = async (params: ParametrosAuditoria): Promise<void> => {
    const {
        accion,
        idUsuarioAfectado,
        idUsuarioEjecutor,
        detalles = '',
        entidad = 'usuario',
    } = params;

    const fecha = new Date().toISOString();
    console.log(
        `[AUDITORIA] [${fecha}] Entidad: ${entidad} | Acción: ${accion.toUpperCase()} | ` +
        `Usuario Afectado: ${idUsuarioAfectado ?? 'N/A'} | ` +
        `Ejecutor: ${idUsuarioEjecutor ?? 'Sistema'} | Detalle: ${detalles}`
    );

    // Conexión preparada para la tabla de auditoría (H14, Sprint 2)
    // Si la tabla bitacora_auditoria existe en la BD, persiste el registro de inmediato;
    // si aún no ha sido migrada, no interrumpe el flujo normal.
    try {
        await pool.query(
            `INSERT INTO bitacora_auditoria (id_usuario, entidad, accion, descripcion)
             VALUES ($1, $2, $3, $4)`,
            [
                idUsuarioEjecutor ? Number(idUsuarioEjecutor) : null,
                entidad,
                accion,
                `[Afectado: ${idUsuarioAfectado}] ${detalles}`,
            ]
        );
    } catch {
        // En Sprint 1, si la tabla no está creada, la auditoría se preserva en el log estructurado.
    }
};

export default registrarAuditoria;

