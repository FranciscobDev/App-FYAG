import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';
import { normalizarRol, obtenerIdEjecutor } from '../middleware/authMiddleware';
import { verificarBloqueoCierreProyectoPorSolicitudesH34 } from './solicitudController';

export interface Proyecto {
    id_proyecto: number;
    nombre_proyecto: string;
    tipo_proyecto: string;
    cliente: string | null;
    id_cliente?: number | null;
    direccion: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    presupuesto_inicial: number;
    presupuesto_horas: number;
    valor_venta: number;
    porcentaje_avance: number;
    estado_proyecto: string;
    id_usuario: number | null;
}

interface ProyectoBody {
    nombre_proyecto?: string;
    tipo_proyecto?: string;
    cliente?: string | null;
    id_cliente?: number | null;
    direccion?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    presupuesto_inicial?: number;
    presupuesto_horas?: number;
    valor_venta?: number;
    porcentaje_avance?: number;
    estado_proyecto?: string;
    id_usuario?: number | null;
    id_kit_proyecto?: number | null;
}

interface TecnicoResumen {
    id_usuario: number;
    nombre: string;
    rut?: string | null;
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// Listar todos
export const obtenerProyectos = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        const result = esTecnico
            ? await pool.query<Proyecto>(
                `SELECT DISTINCT p.*
                 FROM proyecto p
                 LEFT JOIN asignaciones_proyecto ap ON ap.proyecto_id = p.id_proyecto AND ap.tecnico_id = $1 AND ap.activo = TRUE
                 LEFT JOIN proyecto_tecnico pt ON pt.id_proyecto = p.id_proyecto AND pt.id_usuario = $1
                 WHERE (ap.tecnico_id = $1 OR pt.id_usuario = $1 OR p.id_usuario = $1)
                 ORDER BY p.fecha_fin ASC NULLS LAST, p.id_proyecto ASC`,
                [payload?.id]
            )
            : await pool.query<Proyecto>('SELECT * FROM proyecto ORDER BY fecha_fin ASC NULLS LAST, id_proyecto ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: 'Error al obtener los proyectos' });
    }
};

// Obtener uno por ID
export const obtenerProyectoPorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        const result = esTecnico
            ? await pool.query<Proyecto>(
                `SELECT DISTINCT p.*
                 FROM proyecto p
                 LEFT JOIN asignaciones_proyecto ap ON ap.proyecto_id = p.id_proyecto AND ap.tecnico_id = $2 AND ap.activo = TRUE
                 LEFT JOIN proyecto_tecnico pt ON pt.id_proyecto = p.id_proyecto AND pt.id_usuario = $2
                 WHERE p.id_proyecto = $1 AND (ap.tecnico_id = $2 OR pt.id_usuario = $2 OR p.id_usuario = $2)`,
                [id, payload?.id]
            )
            : await pool.query<Proyecto>(
                'SELECT * FROM proyecto WHERE id_proyecto = $1',
                [id]
            );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado' });
            return;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Crear un proyecto
export const crearProyecto = async (req: Request<Record<string, string>, unknown, ProyectoBody>, res: Response): Promise<void> => {
    const {
        nombre_proyecto, tipo_proyecto, cliente, id_cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta,
        porcentaje_avance, estado_proyecto, id_usuario, id_kit_proyecto
    } = req.body;

    if (!nombre_proyecto) {
        res.status(400).json({ mensaje: 'El nombre del proyecto es obligatorio' });
        return;
    }

    try {
        let presupuestoFinal = Number(presupuesto_inicial) || 0;
        let clienteNombreFinal = cliente || null;
        let idClienteValido: number | null = null;

        // 1. Validar y resolver id_cliente de forma segura
        if (id_cliente) {
            try {
                const cliRes = await pool.query<{ id_cliente: number; razon_social: string }>(
                    'SELECT id_cliente, razon_social FROM cliente WHERE id_cliente = $1',
                    [id_cliente]
                );
                if (cliRes.rows.length > 0) {
                    idClienteValido = cliRes.rows[0].id_cliente;
                    if (!clienteNombreFinal) {
                        clienteNombreFinal = cliRes.rows[0].razon_social;
                    }
                }
            } catch (errCli) {
                console.warn('Advertencia al verificar id_cliente:', errCli);
            }
        }

        // Si no se vinculó por id_cliente pero viene nombre de cliente, buscar coincidencia por razón social
        if (!idClienteValido && clienteNombreFinal) {
            try {
                const cliByName = await pool.query<{ id_cliente: number }>(
                    'SELECT id_cliente FROM cliente WHERE LOWER(razon_social) = LOWER($1) LIMIT 1',
                    [clienteNombreFinal.trim()]
                );
                if (cliByName.rows.length > 0) {
                    idClienteValido = cliByName.rows[0].id_cliente;
                }
            } catch {
                // Silencioso
            }
        }

        // 2. Validar y resolver id_usuario de forma segura (previene error de clave foránea)
        let idUsuarioValido: number | null = null;
        const idUsuarioCandidato = id_usuario ?? obtenerIdEjecutor(req);

        if (idUsuarioCandidato) {
            try {
                const userRes = await pool.query<{ id_usuario: number }>(
                    'SELECT id_usuario FROM usuario WHERE id_usuario = $1 LIMIT 1',
                    [idUsuarioCandidato]
                );
                if (userRes.rows.length > 0) {
                    idUsuarioValido = userRes.rows[0].id_usuario;
                }
            } catch {
                // Silencioso
            }
        }

        // Si no se encontró usuario válido, asignar primer administrador o usuario activo existente
        if (!idUsuarioValido) {
            try {
                const primerAdmin = await pool.query<{ id_usuario: number }>(
                    'SELECT id_usuario FROM usuario WHERE activo = true ORDER BY id_rol ASC, id_usuario ASC LIMIT 1'
                );
                if (primerAdmin.rows.length > 0) {
                    idUsuarioValido = primerAdmin.rows[0].id_usuario;
                }
            } catch {
                // Silencioso
            }
        }

        // Si se seleccionó un kit y no se especificó un presupuesto manual distinto de 0,
        // calculamos el presupuesto sumando el costo de los insumos del kit
        if (id_kit_proyecto && (!presupuestoFinal || presupuestoFinal === 0)) {
            try {
                const kitCostRes = await pool.query<{ costo_total: string }>(`
                    SELECT COALESCE(SUM(dk.cantidad_requerida_kit * a.precio_unitario), 0) AS costo_total
                    FROM detalle_kit dk
                    JOIN articulo a ON a.id_articulo = dk.id_articulo
                    WHERE dk.id_kit_proyecto = $1
                `, [id_kit_proyecto]);
                if (kitCostRes.rows.length > 0) {
                    presupuestoFinal = Math.round(Number(kitCostRes.rows[0].costo_total) || 0);
                }
            } catch (errKitCost) {
                console.warn('No se pudo calcular costo automático del kit:', errKitCost);
            }
        }

        const query = `
        INSERT INTO proyecto (nombre_proyecto, tipo_proyecto, cliente, id_cliente, direccion, fecha_inicio, fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
        const values = [
            nombre_proyecto,
            tipo_proyecto || 'Instalacion',
            clienteNombreFinal,
            idClienteValido,
            direccion || null,
            fecha_inicio || null,
            fecha_fin || null,
            presupuestoFinal,
            presupuesto_horas || 0,
            valor_venta || 0,
            porcentaje_avance || 0,
            estado_proyecto || 'Planificado',
            idUsuarioValido
        ];

        const result = await pool.query<Proyecto>(query, values);
        const proyectoCreado = result.rows[0];

        // Si se asignó un kit, vinculamos sus insumos al proyecto
        if (id_kit_proyecto && proyectoCreado) {
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS articulo_en_proyecto (
                        id_articulo_proyecto SERIAL PRIMARY KEY,
                        id_proyecto INT NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
                        id_articulo INT NOT NULL REFERENCES articulo(id_articulo),
                        cantidad NUMERIC(10,2) NOT NULL,
                        id_unidad INT
                    );
                `);
                await pool.query(`
                    INSERT INTO articulo_en_proyecto (id_proyecto, id_articulo, cantidad, id_unidad)
                    SELECT $1, dk.id_articulo, dk.cantidad_requerida_kit, a.id_unidad
                    FROM detalle_kit dk
                    JOIN articulo a ON a.id_articulo = dk.id_articulo
                    WHERE dk.id_kit_proyecto = $2;
                `, [proyectoCreado.id_proyecto, id_kit_proyecto]);
            } catch (kitErr) {
                console.warn('Advertencia al vincular insumos del kit al proyecto:', kitErr);
            }
        }

        res.status(201).json({
            mensaje: 'Proyecto creado exitosamente',
            proyecto: proyectoCreado
        });
    } catch (error) {
        if (esErrorPg(error)) {
            if (error.code === '22P02') {
                res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
                return;
            }
            if (error.code === '23503') {
                const constraint = (error.constraint || '').toLowerCase();
                const detail = (error.detail || '').toLowerCase();
                if (constraint.includes('cliente') || detail.includes('cliente')) {
                    res.status(400).json({ mensaje: 'El cliente seleccionado no es válido en el sistema' });
                    return;
                }
                if (constraint.includes('usuario') || detail.includes('usuario')) {
                    res.status(400).json({ mensaje: 'El usuario responsable no existe' });
                    return;
                }
                res.status(400).json({ mensaje: 'Error de integridad referencial: un dato vinculado no existe' });
                return;
            }
        }
        console.error('Error al crear proyecto:', error);
        res.status(500).json({ error: 'Error al crear el proyecto' });
    }
};

// Modificar un proyecto
export const actualizarProyecto = async (req: Request<{ id: string }, unknown, ProyectoBody>, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
        nombre_proyecto, tipo_proyecto, cliente, id_cliente, direccion, fecha_inicio, fecha_fin,
        presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, id_usuario
    } = req.body;

    try {
        const proyectoPrevio = await pool.query<Proyecto>('SELECT * FROM proyecto WHERE id_proyecto = $1', [id]);
        if (proyectoPrevio.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para actualizar' });
            return;
        }

        const proyectoExistente = proyectoPrevio.rows[0];
        // Bloqueo de solo lectura para proyectos cerrados/completados/cancelados: no se permite modificar presupuesto
        const estadoExistenteNorm = String(proyectoExistente.estado_proyecto || '').trim().toLowerCase();
        if (estadoExistenteNorm === 'cerrado' || estadoExistenteNorm === 'completado' || estadoExistenteNorm === 'cancelado') {
            const intentoModificarPresupuesto =
                presupuesto_inicial !== undefined && Number(presupuesto_inicial) !== Number(proyectoExistente.presupuesto_inicial);
            const intentoModificarHoras =
                presupuesto_horas !== undefined && Number(presupuesto_horas) !== Number(proyectoExistente.presupuesto_horas);

            if (intentoModificarPresupuesto || intentoModificarHoras) {
                res.status(400).json({
                    mensaje: 'No se puede modificar el presupuesto de un proyecto que ya está cerrado.'
                });
                return;
            }
        }

        const estadoNorm = String(estado_proyecto || '').trim().toLowerCase();
        if (estadoNorm === 'completado' || estadoNorm === 'cerrado' || estadoNorm === 'finalizado') {
            const bloqueoH34 = await verificarBloqueoCierreProyectoPorSolicitudesH34(pool, Number(id));
            if (bloqueoH34.bloqueado) {
                res.status(409).json({
                    mensaje: bloqueoH34.motivoBloqueo,
                    solicitudes_bloqueantes: bloqueoH34.solicitudesBloqueantes,
                });
                return;
            }

            const bloqueoDev = await verificarBloqueoCierreProyectoPorDevolucionesH34(pool, Number(id));
            if (bloqueoDev.bloqueado) {
                res.status(409).json({
                    mensaje: bloqueoDev.motivoBloqueo,
                    devoluciones_bloqueantes: bloqueoDev.devolucionesBloqueantes,
                });
                return;
            }
        }

        let idClienteValido: number | null = null;
        if (id_cliente) {
            try {
                const cliRes = await pool.query<{ id_cliente: number }>(
                    'SELECT id_cliente FROM cliente WHERE id_cliente = $1',
                    [id_cliente]
                );
                if (cliRes.rows.length > 0) {
                    idClienteValido = cliRes.rows[0].id_cliente;
                }
            } catch {
                // Silencioso
            }
        }

        let idUsuarioValido: number | null = null;
        if (id_usuario) {
            try {
                const userRes = await pool.query<{ id_usuario: number }>(
                    'SELECT id_usuario FROM usuario WHERE id_usuario = $1',
                    [id_usuario]
                );
                if (userRes.rows.length > 0) {
                    idUsuarioValido = userRes.rows[0].id_usuario;
                }
            } catch {
                // Silencioso
            }
        }
        const query = `
      UPDATE proyecto
      SET nombre_proyecto = $1, tipo_proyecto = $2, cliente = $3,
          id_cliente = CASE WHEN $4::int IS NOT NULL THEN $4::int ELSE id_cliente END,
          direccion = $5,
          fecha_inicio = $6, fecha_fin = $7, presupuesto_inicial = $8, presupuesto_horas = $9, valor_venta = $10,
          porcentaje_avance = $11, estado_proyecto = $12,
          id_usuario = COALESCE($13, id_usuario)
      WHERE id_proyecto = $14
      RETURNING *;
    `;
        const values = [
            nombre_proyecto, tipo_proyecto, cliente, idClienteValido, direccion, fecha_inicio,
            fecha_fin, presupuesto_inicial, presupuesto_horas, valor_venta, porcentaje_avance, estado_proyecto, idUsuarioValido, id
        ];

        const result = await pool.query<Proyecto>(query, values);

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para actualizar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proyecto actualizado exitosamente',
            proyecto: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error)) {
            if (error.code === '22P02') {
                res.status(400).json({ mensaje: 'Valor inválido en tipo_proyecto, estado_proyecto o algún número' });
                return;
            }
            if (error.code === '23503') {
                const constraint = (error.constraint || '').toLowerCase();
                const detail = (error.detail || '').toLowerCase();
                if (constraint.includes('cliente') || detail.includes('cliente')) {
                    res.status(400).json({ mensaje: 'El cliente seleccionado no es válido en el sistema' });
                    return;
                }
                if (constraint.includes('usuario') || detail.includes('usuario')) {
                    res.status(400).json({ mensaje: 'El usuario responsable no existe' });
                    return;
                }
                res.status(400).json({ mensaje: 'Error de integridad referencial: un dato vinculado no existe' });
                return;
            }
        }
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({ error: 'Error al actualizar el proyecto' });
    }
};

// Eliminar un proyecto
export const eliminarProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<Proyecto>(
            'DELETE FROM proyecto WHERE id_proyecto = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para eliminar' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proyecto eliminado correctamente',
            proyectoEliminado: result.rows[0]
        });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({
                mensaje: 'No se puede eliminar el proyecto porque tiene horas o solicitudes asociadas'
            });
            return;
        }
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({ error: 'Error al eliminar el proyecto' });
    }
};

// ---------- Técnicos asignados a proyectos ----------

// Listar usuarios con rol técnico activos (para el selector)
export const listarTecnicos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<TecnicoResumen>(
            `SELECT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre,
                    u.rut
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE (u.id_rol = 3 OR LOWER(r.nombre_rol::text) LIKE '%tecnic%') AND u.activo = TRUE
             ORDER BY u.nombre_usuario ASC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar técnicos:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos' });
    }
};

// Técnicos asignados a un proyecto
export const obtenerTecnicosDeProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query<TecnicoResumen>(
            `SELECT DISTINCT u.id_usuario,
                    TRIM(u.nombre_usuario || ' ' || u.apellido_usuario) AS nombre
             FROM usuario u
             LEFT JOIN asignaciones_proyecto ap ON ap.tecnico_id = u.id_usuario AND ap.proyecto_id = $1 AND ap.activo = TRUE
             LEFT JOIN proyecto_tecnico pt ON pt.id_usuario = u.id_usuario AND pt.id_proyecto = $1
             WHERE (ap.tecnico_id IS NOT NULL OR pt.id_usuario IS NOT NULL)
             ORDER BY nombre ASC`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener técnicos del proyecto:', error);
        res.status(500).json({ error: 'Error al obtener los técnicos del proyecto' });
    }
};

// Asignar un técnico a un proyecto (solo usuarios con rol técnico)
export const asignarTecnico = async (
    req: Request<{ id: string }, unknown, { id_usuario?: number }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;
    const { id_usuario } = req.body;

    if (!id_usuario) {
        res.status(400).json({ mensaje: 'Debe indicar el técnico a asignar' });
        return;
    }

    try {
        const esTecnico = await pool.query(
            `SELECT u.id_usuario
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1 AND (u.id_rol = 3 OR LOWER(r.nombre_rol::text) LIKE '%tecnic%')`,
            [id_usuario]
        );
        if (esTecnico.rows.length === 0) {
            res.status(400).json({ mensaje: 'El usuario seleccionado no es un técnico' });
            return;
        }

        // 1. Insertar / reactivar en asignaciones_proyecto garantizando unicidad activa
        await pool.query(
            `INSERT INTO asignaciones_proyecto (proyecto_id, tecnico_id, fecha_asignacion, activo)
             VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
             ON CONFLICT DO NOTHING`,
            [id, id_usuario]
        );
        await pool.query(
            `UPDATE asignaciones_proyecto
             SET activo = TRUE, fecha_desasignacion = NULL, fecha_asignacion = CURRENT_TIMESTAMP
             WHERE proyecto_id = $1 AND tecnico_id = $2`,
            [id, id_usuario]
        );

        // 2. Insertar en tabla proyecto_tecnico si existe físicamente (compatibilidad)
        try {
            await pool.query(
                `INSERT INTO proyecto_tecnico (id_proyecto, id_usuario, fecha_asignacion)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT DO NOTHING`,
                [id, id_usuario]
            );
        } catch {
            // Silencioso si es una vista
        }

        res.status(201).json({ mensaje: 'Técnico asignado al proyecto' });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(409).json({ mensaje: 'El técnico ya está asignado a este proyecto' });
            return;
        }
        if (esErrorPg(error) && error.code === '23503') {
            res.status(400).json({ mensaje: 'El proyecto o el técnico no existe' });
            return;
        }
        if (esErrorPg(error) && error.code === '22P02') {
            res.status(400).json({ mensaje: 'Identificador inválido' });
            return;
        }
        console.error('Error al asignar técnico:', error);
        res.status(500).json({ error: 'Error al asignar el técnico' });
    }
};

// Quitar un técnico de un proyecto (desasignar conservando historial)
export const quitarTecnico = async (req: Request<{ id: string; idUsuario: string }>, res: Response): Promise<void> => {
    const { id, idUsuario } = req.params;
    try {
        const result = await pool.query(
            `UPDATE asignaciones_proyecto
             SET activo = FALSE, fecha_desasignacion = CURRENT_TIMESTAMP
             WHERE proyecto_id = $1 AND tecnico_id = $2 AND activo = TRUE
             RETURNING *`,
            [id, idUsuario]
        );

        try {
            await pool.query(
                `DELETE FROM proyecto_tecnico WHERE id_proyecto = $1 AND id_usuario = $2`,
                [id, idUsuario]
            );
        } catch {
            // Silencioso si es vista
        }

        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'El técnico no está asignado a este proyecto' });
            return;
        }

        res.status(200).json({ mensaje: 'Técnico quitado del proyecto' });
    } catch (error) {
        console.error('Error al quitar técnico:', error);
        res.status(500).json({ error: 'Error al quitar el técnico' });
    }
};

export const verificarBloqueoCierreProyectoPorDevolucionesH34 = async (
    cliente: { query: (text: string, params?: any[]) => Promise<any> },
    idProyecto: number
): Promise<{
    bloqueado: boolean;
    devolucionesBloqueantes: { id_devolucion: number; codigo_devolucion: string }[];
    motivoBloqueo: string | null;
}> => {
    try {
        const res = await cliente.query(
            `SELECT id_devolucion, COALESCE(codigo_devolucion, codigo) AS codigo_devolucion
             FROM devoluciones_tecnico
             WHERE proyecto_id = $1 AND estado = 'En tránsito'
             ORDER BY id_devolucion ASC`,
            [idProyecto]
        );
        if (!res.rows || res.rows.length === 0) {
            return { bloqueado: false, devolucionesBloqueantes: [], motivoBloqueo: null };
        }
        const detalle = res.rows.map((d: any) => d.codigo_devolucion || `#${d.id_devolucion}`).join(', ');
        return {
            bloqueado: true,
            devolucionesBloqueantes: res.rows,
            motivoBloqueo: `No se puede cerrar el proyecto (H34): existen ${res.rows.length} devolución(es) en tránsito pendientes de recepción en bodega (${detalle}).`,
        };
    } catch {
        return { bloqueado: false, devolucionesBloqueantes: [], motivoBloqueo: null };
    }
};

/**
 * [H34 / BACK-1] Endpoint para cerrar un proyecto (`POST /api/proyectos/:id/cerrar`),
 * bloqueando el cierre si existen solicitudes de insumos en estado `Pendiente` o `Aprobada` sin egresar,
 * o si existen devoluciones de insumos en estado `En tránsito`.
 */
export const cerrarProyecto = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const idProyecto = Number(req.params.id);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
        res.status(400).json({ mensaje: 'Identificador de proyecto inválido' });
        return;
    }

    try {
        const bloqueoH34 = await verificarBloqueoCierreProyectoPorSolicitudesH34(pool, idProyecto);
        if (bloqueoH34.bloqueado) {
            res.status(409).json({
                mensaje: bloqueoH34.motivoBloqueo,
                solicitudes_bloqueantes: bloqueoH34.solicitudesBloqueantes,
            });
            return;
        }

        const bloqueoDev = await verificarBloqueoCierreProyectoPorDevolucionesH34(pool, idProyecto);
        if (bloqueoDev.bloqueado) {
            res.status(409).json({
                mensaje: bloqueoDev.motivoBloqueo,
                devoluciones_bloqueantes: bloqueoDev.devolucionesBloqueantes,
            });
            return;
        }

        const result = await pool.query<Proyecto>(
            `UPDATE proyecto
             SET estado_proyecto = 'Completado'
             WHERE id_proyecto = $1
             RETURNING *`,
            [idProyecto]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado' });
            return;
        }

        res.status(200).json({
            mensaje: 'Proyecto cerrado exitosamente',
            proyecto: result.rows[0],
        });
    } catch (error) {
        console.error('Error al cerrar proyecto:', error);
        res.status(500).json({ error: 'Error al cerrar el proyecto' });
    }
};


/**
 * Insumos planificados de cada proyecto (tabla articulo_en_proyecto, cargada desde el kit o manualmente).
 * El técnico solo recibe los insumos de los proyectos que tiene asignados; el administrador recibe todos.
 */
export const listarInsumosAsignados = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';

        const result = await pool.query<{
            id_proyecto: number;
            id_articulo: number;
            sku: string | null;
            nombre_articulo: string;
            unidad: string;
            cantidad_asignada: number;
        }>(
            `SELECT aep.id_proyecto,
                    aep.id_articulo,
                    a.sku,
                    a.nombre_articulo,
                    COALESCE(um.codigo, 'un') AS unidad,
                    SUM(aep.cantidad)::float8 AS cantidad_asignada
             FROM articulo_en_proyecto aep
             JOIN articulo a ON a.id_articulo = aep.id_articulo
             LEFT JOIN insumos i ON i.id_insumo = aep.id_articulo
             LEFT JOIN unidades_medida um ON um.id_unidad = COALESCE(aep.id_unidad, i.id_unidad)
             WHERE ($1::boolean = FALSE OR aep.id_proyecto IN (
                     SELECT DISTINCT p.id_proyecto
                     FROM proyecto p
                     LEFT JOIN asignaciones_proyecto ap ON ap.proyecto_id = p.id_proyecto AND ap.tecnico_id = $2 AND ap.activo = TRUE
                     LEFT JOIN proyecto_tecnico pt ON pt.id_proyecto = p.id_proyecto AND pt.id_usuario = $2
                     WHERE (ap.tecnico_id = $2 OR pt.id_usuario = $2 OR p.id_usuario = $2)
                 ))
             GROUP BY aep.id_proyecto, aep.id_articulo, a.sku, a.nombre_articulo, um.codigo
             ORDER BY aep.id_proyecto ASC, a.nombre_articulo ASC`,
            [esTecnico, payload?.id ?? null]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al listar insumos asignados a proyectos:', error);
        res.status(500).json({ error: 'Error al obtener los insumos de los proyectos' });
    }
};