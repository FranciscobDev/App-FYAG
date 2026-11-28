import { Request, Response } from 'express';
import { DatabaseError, PoolClient } from 'pg';
import pool from '../config/db';
import { normalizarRol, obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';
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

/**
 * Principio de mínimo privilegio: oculta campos financieros confidenciales (valor de venta,
 * presupuestos, costos reales y márgenes) cuando quien consulta es un técnico.
 */
export const sanitizarProyectoParaRol = <T extends Record<string, any>>(
    proyecto: T,
    esTecnico: boolean
): T => {
    if (!esTecnico || !proyecto) return proyecto;
    const copia: Record<string, any> = { ...proyecto };
    delete copia.presupuesto_inicial;
    delete copia.presupuesto_materiales;
    delete copia.presupuesto_mermas;
    delete copia.valor_venta;
    delete copia.costo_real_acumulado;
    delete copia.margen_estimado;
    delete copia.porcentaje_consumo_presupuesto;
    delete copia.semaforo_financiero;
    return copia as T;
};

/**
 * Verifica que un técnico esté asignado activamente al proyecto indicado (protección anti-IDOR).
 * Lanza ErrorAplicacion(403) si el técnico no pertenece al proyecto.
 */
export const verificarTecnicoAsignadoAProyecto = async (
    cliente: { query: (sql: string, params?: any[]) => Promise<any> },
    idProyecto: number,
    idTecnico: number | null
): Promise<void> => {
    if (!idTecnico) {
        throw new ErrorAplicacion(401, 'Debes iniciar sesión');
    }
    const asignadoRes = await cliente.query(
        `/* idor:verificar-asignacion-proyecto */
         SELECT 1 FROM asignaciones_proyecto WHERE proyecto_id = $1 AND tecnico_id = $2 AND activo = TRUE
         UNION
         SELECT 1 FROM proyecto_tecnico WHERE id_proyecto = $1 AND id_usuario = $2
         UNION
         SELECT 1 FROM proyecto WHERE id_proyecto = $1 AND id_usuario = $2`,
        [idProyecto, idTecnico]
    );
    if (!asignadoRes.rows || asignadoRes.rows.length === 0) {
        throw new ErrorAplicacion(403, 'Acceso denegado: no estás asignado a este proyecto');
    }
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
        res.status(200).json(result.rows.map((p) => sanitizarProyectoParaRol(p, esTecnico)));
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

        res.status(200).json(sanitizarProyectoParaRol(result.rows[0], esTecnico));
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

        // Verificar si el proyecto ya está cerrado antes de editar
        const actual = await pool.query<Proyecto>('SELECT estado_proyecto FROM proyecto WHERE id_proyecto = $1', [id]);
        if (actual.rows.length === 0) {
            res.status(404).json({ mensaje: 'Proyecto no encontrado para actualizar' });
            return;
        }
        
        if (actual.rows[0].estado_proyecto === 'Cerrado') {
            res.status(400).json({ mensaje: 'No se puede editar un proyecto cerrado' });
            return;
        }

        // Si se intenta cerrar el proyecto, verificar pendientes
        if (estado_proyecto === 'Cerrado') {
            const pendientes = await pool.query(
                'SELECT count(*) FROM solicitud_material WHERE id_proyecto = $1 AND estado = $2',
                [id, 'Pendiente']
            );
            if (parseInt(pendientes.rows[0].count) > 0) {
                res.status(400).json({ mensaje: 'No se puede cerrar un proyecto con solicitudes pendientes' });
                return;
            }
        }

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
        // Validar proyecto Activo (o En Proceso)
        const proyecto = await pool.query<Proyecto>('SELECT estado_proyecto FROM proyecto WHERE id_proyecto = $1', [id]);
        if (
            proyecto.rows.length === 0 ||
            !['Activo', 'En Proceso'].includes(String(proyecto.rows[0].estado_proyecto))
        ) {
            res.status(400).json({ mensaje: 'Solo se pueden asignar técnicos a proyectos Activos' });
            return;
        }

        // Validar técnico habilitado y rol
        const usuario = await pool.query(
            `SELECT u.activo, u.id_rol, r.nombre_rol 
             FROM usuario u
             LEFT JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1`,
            [id_usuario]
        );
        if (
            usuario.rows.length === 0 ||
            !(usuario.rows[0].id_rol === 3 || String(usuario.rows[0].nombre_rol ?? '').toLowerCase().includes('tecnic'))
        ) {
            res.status(400).json({ mensaje: 'El usuario seleccionado no es un técnico' });
            return;
        }
        if (!usuario.rows[0].activo) {
            res.status(400).json({ mensaje: 'El técnico seleccionado está deshabilitado' });
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

export interface ItemMaterialUtilizadoInput {
    id_articulo?: number;
    sku?: string;
    cantidad?: number;
    quantity?: number;
    cantidad_utilizada?: number;
}

export interface MaterialUtilizadoRegistrado {
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_utilizada: number;
}

export interface AvanceRegistrado {
    id_avance: number;
    proyecto_id: number;
    porcentaje_avance: number;
    comentarios: string;
    fecha_registro: string;
    tecnico_id: number;
    tecnico_nombre: string;
    materiales_utilizados: MaterialUtilizadoRegistrado[];
}

/**
 * [BACK-1] Lógica central transaccional para registrar un avance físico (0-100%) y declarar
 * materiales utilizados sobre los insumos ya retirados/asignados del proyecto, SIN generar
 * un nuevo egreso de bodega ni alterar o duplicar el Cardex.
 */
export const registrarAvanceProyectoEnTransaccion = async (
    cliente: { query: (sql: string, params?: any[]) => Promise<any> },
    idProyecto: number,
    idEjecutor: number,
    rol: string,
    datos: {
        porcentaje_avance?: number;
        progressPct?: number;
        avance?: number;
        comentarios?: string;
        comments?: string;
        observaciones?: string;
        materiales_utilizados?: ItemMaterialUtilizadoInput[];
        materialsUsed?: ItemMaterialUtilizadoInput[];
        materiales?: ItemMaterialUtilizadoInput[];
        items?: ItemMaterialUtilizadoInput[];
    }
): Promise<AvanceRegistrado> => {
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
        throw new ErrorAplicacion(400, 'Identificador de proyecto inválido');
    }
    if (!idEjecutor) {
        throw new ErrorAplicacion(401, 'Debes iniciar sesión');
    }

    // Si es técnico, validar que esté asignado activamente al proyecto
    if (rol === 'technician') {
        const asignadoRes = await cliente.query(
            `SELECT 1 FROM asignaciones_proyecto WHERE proyecto_id = $1 AND tecnico_id = $2 AND activo = TRUE
             UNION
             SELECT 1 FROM proyecto_tecnico WHERE id_proyecto = $1 AND id_usuario = $2
             UNION
             SELECT 1 FROM proyecto WHERE id_proyecto = $1 AND id_usuario = $2`,
            [idProyecto, idEjecutor]
        );
        if (!asignadoRes.rows || asignadoRes.rows.length === 0) {
            throw new ErrorAplicacion(403, 'No tienes permiso para registrar avances en un proyecto no asignado');
        }
    }

    // Validar proyecto
    const proyRes = await cliente.query(
        `SELECT id_proyecto, nombre_proyecto, estado_proyecto::text AS estado_proyecto, porcentaje_avance::float8 AS porcentaje_avance
         FROM proyecto WHERE id_proyecto = $1 LIMIT 1`,
        [idProyecto]
    );
    const proyecto = proyRes.rows?.[0];
    if (!proyecto) {
        throw new ErrorAplicacion(404, 'Proyecto no encontrado');
    }

    const estadoNorm = String(proyecto.estado_proyecto || '').toLowerCase();
    if (estadoNorm === 'completado' || estadoNorm === 'cerrado' || estadoNorm === 'cancelado') {
        throw new ErrorAplicacion(400, 'No se pueden registrar avances en un proyecto cerrado o completado');
    }

    // Validar porcentaje de avance
    const pctRaw = datos.porcentaje_avance ?? datos.progressPct ?? datos.avance;
    const porcentajeAvance = Number(pctRaw);
    if (!Number.isFinite(porcentajeAvance) || porcentajeAvance < 0 || porcentajeAvance > 100) {
        throw new ErrorAplicacion(400, 'El porcentaje de avance debe estar entre 0 y 100');
    }

    // Validar comentarios
    const comentarios = String(datos.comentarios ?? datos.comments ?? datos.observaciones ?? '').trim();
    if (!comentarios) {
        throw new ErrorAplicacion(400, 'Las observaciones o comentarios son obligatorios');
    }

    // Obtener datos del técnico
    const tecRes = await cliente.query(
        `SELECT id_usuario,
                TRIM(COALESCE(nombre_usuario, '') || ' ' || COALESCE(apellido_usuario, '')) AS nombre_completo
         FROM usuario WHERE id_usuario = $1 LIMIT 1`,
        [idEjecutor]
    );
    const tecnico = tecRes.rows?.[0];
    const tecnicoNombre =
        tecnico?.nombre_completo ||
        (tecnico ? [tecnico.nombre, tecnico.apellido].filter(Boolean).join(' ').trim() : '') ||
        'Técnico';

    // Normalizar materiales declarados
    const materialesRaw = (
        datos.materiales_utilizados ??
        datos.materialsUsed ??
        datos.materiales ??
        datos.items ??
        []
    ) as ItemMaterialUtilizadoInput[];

    const materialesParaGuardar: {
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad: number;
    }[] = [];

    if (Array.isArray(materialesRaw) && materialesRaw.length > 0) {
        for (const item of materialesRaw) {
            const cant = Number(item.cantidad ?? item.quantity ?? item.cantidad_utilizada ?? 0);
            if (!Number.isFinite(cant) || cant <= 0) {
                throw new ErrorAplicacion(400, 'La cantidad de material utilizado debe ser mayor a 0');
            }

            let artFila: { id_articulo: number; sku: string; nombre_articulo: string } | null = null;
            if (Number.isInteger(Number(item.id_articulo)) && Number(item.id_articulo) > 0) {
                const artRes = await cliente.query(
                    `SELECT id_articulo, sku, nombre_articulo FROM articulo WHERE id_articulo = $1 LIMIT 1`,
                    [Number(item.id_articulo)]
                );
                artFila = artRes.rows?.[0] ?? null;
            } else if (typeof item.sku === 'string' && item.sku.trim()) {
                const artRes = await cliente.query(
                    `SELECT id_articulo, sku, nombre_articulo FROM articulo WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1)) LIMIT 1`,
                    [item.sku.trim()]
                );
                artFila = artRes.rows?.[0] ?? null;
            }

            if (!artFila) {
                throw new ErrorAplicacion(400, `Insumo no encontrado en el catálogo`);
            }

            materialesParaGuardar.push({
                id_articulo: artFila.id_articulo,
                sku: artFila.sku,
                nombre_articulo: artFila.nombre_articulo,
                cantidad: Number(cant.toFixed(3)),
            });
        }
    }

    // 1. Insertar cabecera de avance
    const avanceInsert = await cliente.query(
        `INSERT INTO avances_proyecto (
            proyecto_id, tecnico_id, tecnico_nombre, porcentaje_avance, comentarios, fecha_registro
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id_avance, fecha_registro`,
        [idProyecto, idEjecutor, tecnicoNombre, porcentajeAvance, comentarios]
    );
    const idAvance = avanceInsert.rows[0].id_avance;
    const fechaRegistro = avanceInsert.rows[0].fecha_registro;

    // 2. Actualizar porcentaje de avance en el proyecto
    await cliente.query(
        `UPDATE proyecto SET porcentaje_avance = $1 WHERE id_proyecto = $2`,
        [porcentajeAvance, idProyecto]
    );

    // 3. Declarar materiales utilizados en uso_insumos_proyecto vinculados al avance
    // (SIN tocar stock_actual de artículos, SIN salidas_bodega, SIN movimientos_inventario)
    for (const mat of materialesParaGuardar) {
        await cliente.query(
            `INSERT INTO uso_insumos_proyecto (
                proyecto_id, tecnico_id, id_articulo, cantidad_utilizada, fecha_registro, id_usuario_registro, id_avance
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [idProyecto, idEjecutor, mat.id_articulo, mat.cantidad, fechaRegistro, idEjecutor, idAvance]
        );
    }

    // 4. Auditoría inmutable
    await registrarAuditoria(
        {
            entidad: 'proyecto',
            accion: 'REGISTRO_AVANCE_TERRENO',
            idRegistro: idProyecto,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: { porcentaje_avance: proyecto.porcentaje_avance },
            estadoNuevo: {
                porcentaje_avance: porcentajeAvance,
                comentarios,
                total_materiales: materialesParaGuardar.length,
                materiales: materialesParaGuardar,
            },
            descripcion: `Avance del ${porcentajeAvance}% registrado por ${tecnicoNombre}`,
        },
        cliente as PoolClient
    );

    return {
        id_avance: idAvance,
        proyecto_id: idProyecto,
        porcentaje_avance: porcentajeAvance,
        comentarios,
        fecha_registro: fechaRegistro,
        tecnico_id: idEjecutor,
        tecnico_nombre: tecnicoNombre,
        materiales_utilizados: materialesParaGuardar.map((m) => ({
            id_articulo: m.id_articulo,
            sku: m.sku,
            nombre_articulo: m.nombre_articulo,
            cantidad_utilizada: m.cantidad,
        })),
    };
};

/**
 * [BACK-1] Registra un avance físico (0-100%) y declara materiales utilizados sobre los insumos
 * ya retirados/asignados del proyecto, SIN generar un nuevo egreso de bodega ni alterar o duplicar el Cardex.
 */
export const registrarAvanceProyecto = async (req: Request, res: Response): Promise<void> => {
    try {
        const idProyecto = Number(req.params.id ?? req.body?.id_proyecto ?? req.body?.projectId);
        const idEjecutor = obtenerIdEjecutor(req);
        if (!idEjecutor) {
            throw new ErrorAplicacion(401, 'Debes iniciar sesión');
        }

        const payloadUsuario = typeof req.usuario === 'object' ? req.usuario : null;
        const rol = normalizarRol(payloadUsuario?.rol);

        const resultadoAvance = await ejecutarTransaccion(async (cliente: PoolClient) => {
            return registrarAvanceProyectoEnTransaccion(
                cliente,
                idProyecto,
                idEjecutor,
                rol,
                req.body ?? {}
            );
        });

        res.status(201).json({
            mensaje: `Avance del ${resultadoAvance.porcentaje_avance}% registrado exitosamente`,
            avance: resultadoAvance,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar el avance del proyecto');
    }
};

/**
 * [BACK-1] Lista el historial cronológico de avances de un proyecto con sus materiales utilizados.
 */
export const listarAvancesProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const idProyecto = Number(req.params.id);
        if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
            throw new ErrorAplicacion(400, 'Identificador de proyecto inválido');
        }

        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        if (esTecnico) {
            await verificarTecnicoAsignadoAProyecto(pool, idProyecto, obtenerIdEjecutor(req));
        }

        const result = await pool.query(
            `SELECT a.id_avance,
                    a.proyecto_id,
                    a.tecnico_id,
                    a.tecnico_nombre,
                    a.porcentaje_avance::float8 AS porcentaje_avance,
                    a.comentarios,
                    a.fecha_registro,
                    COALESCE((
                        SELECT json_agg(json_build_object(
                            'id_articulo', u.id_articulo,
                            'sku', art.sku,
                            'nombre_articulo', art.nombre_articulo,
                            'cantidad_utilizada', u.cantidad_utilizada::float8,
                            'unidad', COALESCE(um.codigo, 'un')
                        ) ORDER BY u.id_uso ASC)
                        FROM uso_insumos_proyecto u
                        JOIN articulo art ON art.id_articulo = u.id_articulo
                        LEFT JOIN insumos i ON i.id_insumo = art.id_articulo
                        LEFT JOIN unidades_medida um ON um.id_unidad = i.id_unidad
                        WHERE u.id_avance = a.id_avance
                    ), '[]'::json) AS materiales_utilizados
             FROM avances_proyecto a
             WHERE a.proyecto_id = $1
             ORDER BY a.fecha_registro DESC`,
            [idProyecto]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar avances del proyecto');
    }
};

/**
 * [BACK-1] Reporte final consolidado del proyecto: avances, materiales consumidos y sobrante.
 */
export const obtenerReporteFinalProyecto = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const idProyecto = Number(req.params.id);
        if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
            throw new ErrorAplicacion(400, 'Identificador de proyecto inválido');
        }

        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        if (esTecnico) {
            await verificarTecnicoAsignadoAProyecto(pool, idProyecto, obtenerIdEjecutor(req));
        }

        // Datos del proyecto
        const proyRes = await pool.query(
            `SELECT p.id_proyecto, p.nombre_proyecto, p.tipo_proyecto, p.cliente, p.direccion,
                    p.fecha_inicio, p.fecha_fin, p.presupuesto_inicial, p.presupuesto_horas,
                    p.valor_venta, p.porcentaje_avance::float8 AS porcentaje_avance, p.estado_proyecto
             FROM proyecto p WHERE p.id_proyecto = $1`,
            [idProyecto]
        );
        if (proyRes.rows.length === 0) {
            throw new ErrorAplicacion(404, 'Proyecto no encontrado');
        }

        // Historial de avances
        const avancesRes = await pool.query(
            `SELECT a.id_avance, a.tecnico_nombre, a.porcentaje_avance::float8 AS porcentaje_avance,
                    a.comentarios, a.fecha_registro
             FROM avances_proyecto a
             WHERE a.proyecto_id = $1
             ORDER BY a.fecha_registro ASC`,
            [idProyecto]
        );

        // Resumen consolidado de insumos: asignado, retirado de bodega, utilizado en terreno y devuelto
        const insumosRes = await pool.query(
            `SELECT a.id_articulo,
                    a.sku,
                    a.nombre_articulo,
                    COALESCE(um.codigo, 'un') AS unidad,
                    COALESCE(aep.total_asignado, 0)::float8 AS cantidad_asignada,
                    COALESCE(sb.total_retirado, 0)::float8 AS cantidad_retirada,
                    COALESCE(u.total_utilizado, 0)::float8 AS cantidad_utilizada,
                    COALESCE(dev.total_devuelto, 0)::float8 AS cantidad_devuelta
             FROM articulo a
             LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
             LEFT JOIN unidades_medida um ON um.id_unidad = i.id_unidad
             LEFT JOIN (
                 SELECT id_articulo, SUM(cantidad) AS total_asignado
                 FROM articulo_en_proyecto WHERE id_proyecto = $1 GROUP BY id_articulo
             ) aep ON aep.id_articulo = a.id_articulo
             LEFT JOIN (
                 SELECT el.id_articulo, SUM(el.cantidad_egresada) AS total_retirado
                 FROM egresos_bodega e JOIN egreso_lineas el ON el.id_egreso = e.id_egreso
                 WHERE e.proyecto_id = $1 GROUP BY el.id_articulo
             ) sb ON sb.id_articulo = a.id_articulo
             LEFT JOIN (
                 SELECT id_articulo, SUM(cantidad_utilizada) AS total_utilizado
                 FROM uso_insumos_proyecto WHERE proyecto_id = $1 GROUP BY id_articulo
             ) u ON u.id_articulo = a.id_articulo
             LEFT JOIN (
                 SELECT dl.id_articulo, SUM(dl.cantidad_declarada) AS total_devuelto
                 FROM devoluciones_tecnico dt JOIN devolucion_lineas dl ON dl.id_devolucion = dt.id_devolucion
                 WHERE dt.proyecto_id = $1 AND dt.estado IN ('En tránsito', 'Recibida') GROUP BY dl.id_articulo
             ) dev ON dev.id_articulo = a.id_articulo
             WHERE aep.total_asignado > 0 OR sb.total_retirado > 0 OR u.total_utilizado > 0 OR dev.total_devuelto > 0
             ORDER BY a.nombre_articulo ASC`,
            [idProyecto]
        );

        res.status(200).json({
            proyecto: sanitizarProyectoParaRol(proyRes.rows[0], esTecnico),
            avances: avancesRes.rows,
            resumen_materiales: insumosRes.rows.map((r: any) => ({
                ...r,
                sobrante_disponible: Math.max(0, Number((r.cantidad_retirada - r.cantidad_utilizada - r.cantidad_devuelta).toFixed(3))),
            })),
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener reporte final del proyecto');
    }
};