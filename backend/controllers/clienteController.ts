import { Request, Response } from 'express';
import { DatabaseError } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';

export interface ClienteRow {
    id_cliente: number;
    rut_cliente: string;
    razon_social: string;
    giro: string | null;
    telefono: string | null;
    correo_contacto: string | null;
    direccion: string | null;
    nombre_contacto: string | null;
    banco: string | null;
    tipo_cuenta: string | null;
    numero_cuenta: string | null;
    calificacion_promedio: number;
    activo: boolean;
    fecha_creacion: string;
    total_proyectos?: number;
    planes_activos?: number;
}

export interface PlanMantencionRow {
    id_plan: number;
    id_cliente: number;
    razon_social?: string;
    rut_cliente?: string;
    telefono_cliente?: string | null;
    nombre_contacto?: string | null;
    id_proyecto_origen: number | null;
    nombre_proyecto_origen?: string | null;
    titulo_plan: string;
    modalidad: 'POR_KIT' | 'POR_CONTRATO' | 'MIXTO';
    id_kit_proyecto: number | null;
    nombre_kit?: string | null;
    codigo_contrato: string | null;
    frecuencia_meses: number;
    fecha_ultima_mantencion: string | null;
    fecha_proxima_mantencion: string;
    costo_pactado: number;
    estado_plan: string;
    notas_plan: string | null;
    dias_restantes?: number;
    kit_stock_ok?: boolean;
}

const esErrorPg = (error: unknown): error is DatabaseError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

// =============================================================================
// 1. CRUD DE CLIENTES
// =============================================================================

export const obtenerClientes = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<ClienteRow>(`
            SELECT
                c.*,
                COALESCE(c.calificacion_promedio, 5.0)::float8 AS calificacion_promedio,
                (SELECT COUNT(*)::int FROM proyecto p WHERE p.id_cliente = c.id_cliente OR LOWER(p.cliente) = LOWER(c.razon_social)) AS total_proyectos,
                (SELECT COUNT(*)::int FROM plan_mantencion_cliente pm WHERE pm.id_cliente = c.id_cliente AND pm.estado_plan = 'Activo') AS planes_activos
            FROM cliente c
            ORDER BY c.activo DESC, c.razon_social ASC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

export const obtenerClientePorId = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const clienteRes = await pool.query<ClienteRow>(
            'SELECT *, COALESCE(calificacion_promedio, 5.0)::float8 AS calificacion_promedio FROM cliente WHERE id_cliente = $1',
            [id]
        );
        if (clienteRes.rows.length === 0) {
            res.status(404).json({ mensaje: 'Cliente no encontrado' });
            return;
        }
        const cliente = clienteRes.rows[0];

        const [proyectosRes, planesRes, seguimientosRes] = await Promise.all([
            pool.query(
                `SELECT * FROM proyecto
                 WHERE id_cliente = $1 OR LOWER(cliente) = LOWER($2)
                 ORDER BY fecha_inicio DESC NULLS LAST, id_proyecto DESC`,
                [id, cliente.razon_social]
            ),
            pool.query(
                `SELECT pm.*, p.nombre_proyecto AS nombre_proyecto_origen, k.nombre_kit
                 FROM plan_mantencion_cliente pm
                 LEFT JOIN proyecto p ON p.id_proyecto = pm.id_proyecto_origen
                 LEFT JOIN kit_proyecto k ON k.id_kit_proyecto = pm.id_kit_proyecto
                 WHERE pm.id_cliente = $1
                 ORDER BY pm.fecha_proxima_mantencion ASC`,
                [id]
            ),
            pool.query(
                `SELECT sc.*, pm.titulo_plan, pr.nombre_proyecto AS proyecto_generado_nombre
                 FROM seguimiento_contacto_cliente sc
                 JOIN plan_mantencion_cliente pm ON pm.id_plan = sc.id_plan
                 LEFT JOIN proyecto pr ON pr.id_proyecto = sc.id_proyecto_generado
                 WHERE pm.id_cliente = $1
                 ORDER BY sc.fecha_contacto DESC`,
                [id]
            ),
        ]);

        res.status(200).json({
            ...cliente,
            proyectos: proyectosRes.rows,
            planes_mantencion: planesRes.rows,
            seguimientos: seguimientosRes.rows,
        });
    } catch (error) {
        console.error('Error al obtener ficha del cliente:', error);
        res.status(500).json({ error: 'Error al obtener la ficha del cliente' });
    }
};

export const crearCliente = async (req: Request, res: Response): Promise<void> => {
    const {
        rut_cliente,
        razon_social,
        giro,
        telefono,
        correo_contacto,
        direccion,
        nombre_contacto,
        banco,
        tipo_cuenta,
        numero_cuenta,
        calificacion_promedio,
    } = req.body ?? {};

    if (!rut_cliente || !razon_social) {
        res.status(400).json({ mensaje: 'El RUT y la razón social del cliente son obligatorios' });
        return;
    }

    try {
        const result = await pool.query<ClienteRow>(
            `INSERT INTO cliente (
                rut_cliente, razon_social, giro, telefono, correo_contacto,
                direccion, nombre_contacto, banco, tipo_cuenta, numero_cuenta,
                calificacion_promedio, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
            RETURNING *, COALESCE(calificacion_promedio, 5.0)::float8 AS calificacion_promedio`,
            [
                String(rut_cliente).trim(),
                String(razon_social).trim(),
                giro ? String(giro).trim() : null,
                telefono ? String(telefono).trim() : null,
                correo_contacto ? String(correo_contacto).trim() : null,
                direccion ? String(direccion).trim() : null,
                nombre_contacto ? String(nombre_contacto).trim() : null,
                banco ? String(banco).trim() : null,
                tipo_cuenta ? String(tipo_cuenta).trim() : null,
                numero_cuenta ? String(numero_cuenta).trim() : null,
                calificacion_promedio ? Number(calificacion_promedio) : 5.0,
            ]
        );
        const nuevo = result.rows[0];

        await registrarAuditoria({
            entidad: 'cliente',
            accion: 'crear',
            idRegistro: nuevo.id_cliente,
            idUsuarioEjecutor: obtenerIdEjecutor(req),
            estadoAnterior: null,
            estadoNuevo: { rut_cliente: nuevo.rut_cliente, razon_social: nuevo.razon_social },
            descripcion: `Cliente creado: ${nuevo.razon_social} (${nuevo.rut_cliente})`,
        }).catch(() => undefined);

        res.status(201).json({ mensaje: 'Cliente registrado exitosamente', cliente: nuevo });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(409).json({ mensaje: 'Ya existe un cliente registrado con este RUT' });
            return;
        }
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al registrar el cliente' });
    }
};

export const actualizarCliente = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
        rut_cliente,
        razon_social,
        giro,
        telefono,
        correo_contacto,
        direccion,
        nombre_contacto,
        banco,
        tipo_cuenta,
        numero_cuenta,
        calificacion_promedio,
        activo,
    } = req.body ?? {};

    if (!rut_cliente || !razon_social) {
        res.status(400).json({ mensaje: 'El RUT y la razón social del cliente son obligatorios' });
        return;
    }

    try {
        const previo = await pool.query<ClienteRow>('SELECT * FROM cliente WHERE id_cliente = $1', [id]);
        if (previo.rows.length === 0) {
            res.status(404).json({ mensaje: 'Cliente no encontrado' });
            return;
        }

        const result = await pool.query<ClienteRow>(
            `UPDATE cliente
             SET rut_cliente = $1,
                 razon_social = $2,
                 giro = $3,
                 telefono = $4,
                 correo_contacto = $5,
                 direccion = $6,
                 nombre_contacto = $7,
                 banco = $8,
                 tipo_cuenta = $9,
                 numero_cuenta = $10,
                 calificacion_promedio = $11,
                 activo = COALESCE($12, activo)
             WHERE id_cliente = $13
             RETURNING *, COALESCE(calificacion_promedio, 5.0)::float8 AS calificacion_promedio`,
            [
                String(rut_cliente).trim(),
                String(razon_social).trim(),
                giro ? String(giro).trim() : null,
                telefono ? String(telefono).trim() : null,
                correo_contacto ? String(correo_contacto).trim() : null,
                direccion ? String(direccion).trim() : null,
                nombre_contacto ? String(nombre_contacto).trim() : null,
                banco ? String(banco).trim() : null,
                tipo_cuenta ? String(tipo_cuenta).trim() : null,
                numero_cuenta ? String(numero_cuenta).trim() : null,
                calificacion_promedio !== undefined ? Number(calificacion_promedio) : previo.rows[0].calificacion_promedio,
                typeof activo === 'boolean' ? activo : null,
                id,
            ]
        );
        const actualizado = result.rows[0];

        await registrarAuditoria({
            entidad: 'cliente',
            accion: 'editar',
            idRegistro: actualizado.id_cliente,
            idUsuarioEjecutor: obtenerIdEjecutor(req),
            estadoAnterior: { rut_cliente: previo.rows[0].rut_cliente, razon_social: previo.rows[0].razon_social },
            estadoNuevo: { rut_cliente: actualizado.rut_cliente, razon_social: actualizado.razon_social },
            descripcion: `Cliente actualizado: ${actualizado.razon_social}`,
        }).catch(() => undefined);

        res.status(200).json({ mensaje: 'Cliente actualizado exitosamente', cliente: actualizado });
    } catch (error) {
        if (esErrorPg(error) && error.code === '23505') {
            res.status(409).json({ mensaje: 'El RUT indicado ya pertenece a otro cliente' });
            return;
        }
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

export const cambiarEstadoCliente = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { activo } = req.body ?? {};
    try {
        const previo = await pool.query<ClienteRow>('SELECT * FROM cliente WHERE id_cliente = $1', [id]);
        if (previo.rows.length === 0) {
            res.status(404).json({ mensaje: 'Cliente no encontrado' });
            return;
        }
        const nuevoEstado = typeof activo === 'boolean' ? activo : !previo.rows[0].activo;
        const result = await pool.query<ClienteRow>(
            `UPDATE cliente SET activo = $1 WHERE id_cliente = $2
             RETURNING *, COALESCE(calificacion_promedio, 5.0)::float8 AS calificacion_promedio`,
            [nuevoEstado, id]
        );
        res.status(200).json({
            mensaje: nuevoEstado ? 'Cliente habilitado' : 'Cliente deshabilitado (borrado lógico)',
            cliente: result.rows[0],
        });
    } catch (error) {
        console.error('Error al cambiar estado del cliente:', error);
        res.status(500).json({ error: 'Error al cambiar el estado del cliente' });
    }
};

// =============================================================================
// 2. PLANES DE MANTENCIÓN PERIÓDICA Y SEGUIMIENTO DE CONTACTO
// =============================================================================

export const obtenerPlanesMantencion = async (_req: Request, res: Response): Promise<void> => {
    try {
        const planesRes = await pool.query<PlanMantencionRow>(`
            SELECT
                pm.*,
                c.razon_social,
                c.rut_cliente,
                c.telefono AS telefono_cliente,
                c.nombre_contacto,
                p.nombre_proyecto AS nombre_proyecto_origen,
                k.nombre_kit,
                (pm.fecha_proxima_mantencion - CURRENT_DATE)::int AS dias_restantes,
                CASE
                    WHEN pm.id_kit_proyecto IS NULL THEN TRUE
                    ELSE NOT EXISTS (
                        SELECT 1
                        FROM detalle_kit dk
                        LEFT JOIN articulos_stock s ON s.id_articulo = dk.id_articulo
                        WHERE dk.id_kit_proyecto = pm.id_kit_proyecto
                          AND COALESCE(s.cantidad_disponible, 0) < dk.cantidad_requerida_kit
                    )
                END AS kit_stock_ok
            FROM plan_mantencion_cliente pm
            JOIN cliente c ON c.id_cliente = pm.id_cliente
            LEFT JOIN proyecto p ON p.id_proyecto = pm.id_proyecto_origen
            LEFT JOIN kit_proyecto k ON k.id_kit_proyecto = pm.id_kit_proyecto
            ORDER BY pm.fecha_proxima_mantencion ASC, pm.id_plan DESC
        `);

        const seguimientosRes = await pool.query(`
            SELECT sc.*, pr.nombre_proyecto AS proyecto_generado_nombre
            FROM seguimiento_contacto_cliente sc
            LEFT JOIN proyecto pr ON pr.id_proyecto = sc.id_proyecto_generado
            ORDER BY sc.fecha_contacto DESC
        `);

        const planesConHistorial = planesRes.rows.map((pl) => ({
            ...pl,
            seguimientos: seguimientosRes.rows.filter((s) => s.id_plan === pl.id_plan),
        }));

        res.status(200).json(planesConHistorial);
    } catch (error) {
        console.error('Error al obtener planes de mantención:', error);
        res.status(500).json({ error: 'Error al obtener los planes de mantención' });
    }
};

export const crearPlanMantencion = async (req: Request, res: Response): Promise<void> => {
    const {
        id_cliente,
        id_proyecto_origen,
        titulo_plan,
        modalidad,
        id_kit_proyecto,
        codigo_contrato,
        frecuencia_meses,
        fecha_ultima_mantencion,
        fecha_proxima_mantencion,
        costo_pactado,
        notas_plan,
    } = req.body ?? {};

    if (!id_cliente || !titulo_plan) {
        res.status(400).json({ mensaje: 'Debe seleccionar el cliente e indicar el título del plan de mantención' });
        return;
    }

    const freq = Math.max(1, Math.min(60, Number(frecuencia_meses) || 3));
    const mod = ['POR_KIT', 'POR_CONTRATO', 'MIXTO'].includes(modalidad) ? modalidad : 'POR_KIT';

    try {
        let costoFinal = Number(costo_pactado) || 0;
        if (id_kit_proyecto && costoFinal === 0) {
            const kitCost = await pool.query<{ total: string }>(`
                SELECT COALESCE(SUM(dk.cantidad_requerida_kit * a.precio_unitario), 0) AS total
                FROM detalle_kit dk
                JOIN articulo a ON a.id_articulo = dk.id_articulo
                WHERE dk.id_kit_proyecto = $1
            `, [id_kit_proyecto]);
            costoFinal = Math.round(Number(kitCost.rows[0]?.total) || 0);
        }

        const result = await pool.query(
            `INSERT INTO plan_mantencion_cliente (
                id_cliente, id_proyecto_origen, titulo_plan, modalidad,
                id_kit_proyecto, codigo_contrato, frecuencia_meses,
                fecha_ultima_mantencion, fecha_proxima_mantencion,
                costo_pactado, estado_plan, notas_plan
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                COALESCE($8::date, CURRENT_DATE),
                COALESCE($9::date, (CURRENT_DATE + ($7 || ' months')::interval)::date),
                $10, 'Activo', $11
            )
            RETURNING *`,
            [
                id_cliente,
                id_proyecto_origen || null,
                String(titulo_plan).trim(),
                mod,
                id_kit_proyecto || null,
                codigo_contrato ? String(codigo_contrato).trim() : null,
                freq,
                fecha_ultima_mantencion || null,
                fecha_proxima_mantencion || null,
                costoFinal,
                notas_plan ? String(notas_plan).trim() : null,
            ]
        );

        res.status(201).json({
            mensaje: `Plan de mantención cada ${freq} meses creado exitosamente`,
            plan: result.rows[0],
        });
    } catch (error) {
        console.error('Error al crear plan de mantención:', error);
        res.status(500).json({ error: 'Error al crear el plan de mantención' });
    }
};

export const actualizarPlanMantencion = async (req: Request<{ idPlan: string }>, res: Response): Promise<void> => {
    const { idPlan } = req.params;
    const {
        titulo_plan,
        modalidad,
        id_kit_proyecto,
        codigo_contrato,
        frecuencia_meses,
        fecha_proxima_mantencion,
        costo_pactado,
        estado_plan,
        notas_plan,
    } = req.body ?? {};

    try {
        const result = await pool.query(
            `UPDATE plan_mantencion_cliente
             SET titulo_plan = COALESCE($1, titulo_plan),
                 modalidad = COALESCE($2, modalidad),
                 id_kit_proyecto = $3,
                 codigo_contrato = $4,
                 frecuencia_meses = COALESCE($5, frecuencia_meses),
                 fecha_proxima_mantencion = COALESCE($6::date, fecha_proxima_mantencion),
                 costo_pactado = COALESCE($7, costo_pactado),
                 estado_plan = COALESCE($8, estado_plan),
                 notas_plan = $9
             WHERE id_plan = $10
             RETURNING *`,
            [
                titulo_plan ? String(titulo_plan).trim() : null,
                modalidad || null,
                id_kit_proyecto ?? null,
                codigo_contrato ?? null,
                frecuencia_meses ? Number(frecuencia_meses) : null,
                fecha_proxima_mantencion || null,
                costo_pactado !== undefined ? Number(costo_pactado) : null,
                estado_plan || null,
                notas_plan ?? null,
                idPlan,
            ]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ mensaje: 'Plan de mantención no encontrado' });
            return;
        }
        res.status(200).json({ mensaje: 'Plan de mantención actualizado', plan: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar plan de mantención:', error);
        res.status(500).json({ error: 'Error al actualizar el plan de mantención' });
    }
};

export const registrarSeguimientoContacto = async (req: Request<{ idPlan: string }>, res: Response): Promise<void> => {
    const { idPlan } = req.params;
    const {
        canal_contacto,
        resultado_contacto,
        observaciones,
        generar_faena,
        nueva_fecha_proxima,
    } = req.body ?? {};

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const planRes = await client.query<PlanMantencionRow & { direccion_cliente: string | null }>(
            `SELECT pm.*, c.razon_social, c.direccion AS direccion_cliente
             FROM plan_mantencion_cliente pm
             JOIN cliente c ON c.id_cliente = pm.id_cliente
             WHERE pm.id_plan = $1
             FOR UPDATE OF pm`,
            [idPlan]
        );
        if (planRes.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ mensaje: 'Plan de mantención no encontrado' });
            return;
        }
        const plan = planRes.rows[0];
        let idProyectoGenerado: number | null = null;
        let proyectoGeneradoRow: unknown = null;

        // Si el cliente confirma la visita y se solicita generar la faena automáticamente en 1 clic:
        if (generar_faena) {
            const nombreFaena = `${plan.titulo_plan} (${plan.frecuencia_meses}M) - ${plan.razon_social}`;
            const proyInsert = await client.query(
                `INSERT INTO proyecto (
                    nombre_proyecto, tipo_proyecto, cliente, id_cliente, direccion,
                    fecha_inicio, fecha_fin, presupuesto_inicial, presupuesto_horas,
                    valor_venta, porcentaje_avance, estado_proyecto, id_usuario
                ) VALUES (
                    $1, 'Mantencion', $2, $3, $4,
                    COALESCE($5::date, CURRENT_DATE),
                    (COALESCE($5::date, CURRENT_DATE) + INTERVAL '7 days')::date,
                    $6, 16, $6, 0, 'Planificado', $7
                ) RETURNING *`,
                [
                    nombreFaena,
                    plan.razon_social,
                    plan.id_cliente,
                    plan.direccion_cliente || null,
                    plan.fecha_proxima_mantencion,
                    plan.costo_pactado || 0,
                    obtenerIdEjecutor(req),
                ]
            );
            proyectoGeneradoRow = proyInsert.rows[0];
            idProyectoGenerado = proyInsert.rows[0].id_proyecto;

            // Si el plan tiene un Kit asociado, vincular sus insumos a la nueva faena
            if (plan.id_kit_proyecto && idProyectoGenerado) {
                await client.query(
                    `INSERT INTO articulo_en_proyecto (id_proyecto, id_articulo, cantidad, id_unidad)
                     SELECT $1, dk.id_articulo, dk.cantidad_requerida_kit, a.id_unidad
                     FROM detalle_kit dk
                     JOIN articulo a ON a.id_articulo = dk.id_articulo
                     WHERE dk.id_kit_proyecto = $2`,
                    [idProyectoGenerado, plan.id_kit_proyecto]
                );
            }

            // Avanzar automáticamente el ciclo de mantención sumando frecuencia_meses
            await client.query(
                `UPDATE plan_mantencion_cliente
                 SET fecha_ultima_mantencion = fecha_proxima_mantencion,
                     fecha_proxima_mantencion = COALESCE($2::date, (fecha_proxima_mantencion + (frecuencia_meses || ' months')::interval)::date)
                 WHERE id_plan = $1`,
                [idPlan, nueva_fecha_proxima || null]
            );
        } else if (nueva_fecha_proxima) {
            await client.query(
                `UPDATE plan_mantencion_cliente
                 SET fecha_proxima_mantencion = $2::date
                 WHERE id_plan = $1`,
                [idPlan, nueva_fecha_proxima]
            );
        }

        const segRes = await client.query(
            `INSERT INTO seguimiento_contacto_cliente (
                id_plan, canal_contacto, resultado_contacto,
                id_proyecto_generado, observaciones, id_usuario_ejecutor
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                idPlan,
                canal_contacto || 'Teléfono',
                resultado_contacto || (generar_faena ? 'Visita Confirmada' : 'Cliente Contactado'),
                idProyectoGenerado,
                observaciones ? String(observaciones).trim() : null,
                obtenerIdEjecutor(req),
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: generar_faena
                ? `Seguimiento registrado, faena de mantención creada y próximo ciclo (+${plan.frecuencia_meses} meses) programado`
                : 'Contacto de seguimiento registrado exitosamente',
            seguimiento: segRes.rows[0],
            proyecto_generado: proyectoGeneradoRow,
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error('Error al registrar seguimiento de cliente:', error);
        res.status(500).json({ error: 'Error al registrar el seguimiento' });
    } finally {
        client.release();
    }
};
