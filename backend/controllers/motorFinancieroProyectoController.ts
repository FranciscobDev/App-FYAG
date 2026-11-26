import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import {
    COSTO_HORA_HOMBRE_H39_DEFECTO,
    ColorSemaforoFinanciero,
    ResultadoCalculoFinancieroProyecto,
    calcularEstadoFinancieroProyecto,
    construirAlertaFinancieraProyectoAdmin,
} from '../services/motorFinancieroProyectoService';
import { ejecutarTransaccion } from '../services/transaccion';

export interface EstadoFinancieroProyectoRespuesta extends ResultadoCalculoFinancieroProyecto {
    id_proyecto: number;
    nombre_proyecto: string;
    presupuesto_materiales: number;
    presupuesto_horas: number;
    alerta_generada: {
        tipo: string;
        severidad: string;
        titulo: string;
        descripcion: string;
    } | null;
}

const obtenerCostoHoraHombreH39 = async (cliente: Pick<PoolClient, 'query'>): Promise<number> => {
    const res = await cliente.query<{ valor: number }>(
        `/* fin:select-costo-hora-h39 */
         SELECT valor FROM parametro_sistema WHERE clave = 'costo_hora_hombre' LIMIT 1`
    );
    const val = Number(res.rows?.[0]?.valor);
    return Number.isFinite(val) && val > 0 ? val : COSTO_HORA_HOMBRE_H39_DEFECTO;
};

/**
 * [BACK-1 / H27] Recalcula automáticamente el Costo Real, Margen Estimado y Semáforo Financiero
 * de un proyecto dentro de la transacción activa (tras una salida de bodega, devolución H36 o registro de horas H41).
 * Si el semáforo pasa a Amarillo (80 %-100 %) o a Rojo (> 100 %), dispara una alerta inmediata al Administrador.
 */
export const recalcularFinanzasProyectoEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    idProyecto: number,
    origenEvento?: string
): Promise<EstadoFinancieroProyectoRespuesta | null> => {
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) return null;

    const proyRes = await cliente.query<{
        id_proyecto: number;
        nombre_proyecto: string;
        presupuesto_inicial: number;
        presupuesto_materiales?: number | null;
        presupuesto_horas: number;
        valor_venta: number;
        semaforo_financiero?: string | null;
    }>(
        `/* fin:select-proyecto */
         SELECT id_proyecto,
                nombre_proyecto,
                COALESCE(presupuesto_inicial, 0)::float8 AS presupuesto_inicial,
                presupuesto_materiales::float8 AS presupuesto_materiales,
                COALESCE(presupuesto_horas, 0)::float8 AS presupuesto_horas,
                COALESCE(valor_venta, 0)::float8 AS valor_venta,
                COALESCE(semaforo_financiero, 'verde') AS semaforo_financiero
         FROM proyecto
         WHERE id_proyecto = $1
         LIMIT 1`,
        [idProyecto]
    );
    const proy = proyRes.rows?.[0];
    if (!proy) return null;

    const costoHoraH39 = await obtenerCostoHoraHombreH39(cliente);

    // 1. Suma de egresos brutos a PMP desde egresos_bodega + egreso_lineas
    const egrRes = await cliente.query<{ total_egresos_pmp: number }>(
        `/* fin:select-egresos-pmp */
         SELECT COALESCE(SUM(ROUND(el.cantidad_egresada * el.costo_unitario_pmp)), 0)::float8 AS total_egresos_pmp
         FROM egresos_bodega eb
         JOIN egreso_lineas el ON el.id_egreso = eb.id_egreso
         WHERE eb.proyecto_id = $1`,
        [idProyecto]
    );
    const egresosBrutosPmp = Number(egrRes.rows?.[0]?.total_egresos_pmp ?? 0);

    // 2. Suma de ajustes por devoluciones confirmadas en bodega (H36: montos negativos en proyecto_costo_ajuste)
    const ajuRes = await cliente.query<{ total_ajustes_pmp: number }>(
        `/* fin:select-ajustes-devoluciones */
         SELECT COALESCE(SUM(monto), 0)::float8 AS total_ajustes_pmp
         FROM proyecto_costo_ajuste
         WHERE proyecto_id = $1`,
        [idProyecto]
    );
    const ajustesDevolucionesPmp = Number(ajuRes.rows?.[0]?.total_ajustes_pmp ?? 0);

    // 3. Suma de horas registradas en H41 para el proyecto
    const hrsRes = await cliente.query<{ total_horas: number }>(
        `/* fin:select-horas-h41 */
         SELECT COALESCE(SUM(horas), 0)::float8 AS total_horas
         FROM horas_proyecto_h41
         WHERE proyecto_id = $1`,
        [idProyecto]
    );
    const horasRegistradasH41 = Number(hrsRes.rows?.[0]?.total_horas ?? 0);

    // Presupuesto total: si tiene presupuesto_materiales explícito (> 0), suma presupuesto_materiales + (presupuesto_horas * costo_hora_h39);
    // de lo contrario, usa presupuesto_inicial (que ya representa el presupuesto total en H34).
    const presupuestoMateriales =
        proy.presupuesto_materiales != null && Number(proy.presupuesto_materiales) > 0
            ? Number(proy.presupuesto_materiales)
            : Number(proy.presupuesto_inicial);
    const presupuestoTotal =
        proy.presupuesto_materiales != null && Number(proy.presupuesto_materiales) > 0
            ? Math.round(Number(proy.presupuesto_materiales) + Number(proy.presupuesto_horas) * costoHoraH39)
            : Math.round(Number(proy.presupuesto_inicial));

    const calculo = calcularEstadoFinancieroProyecto({
        presupuesto_total: presupuestoTotal,
        valor_venta: Number(proy.valor_venta),
        egresos_brutos_pmp: egresosBrutosPmp,
        ajustes_devoluciones_pmp: ajustesDevolucionesPmp,
        horas_registradas_h41: horasRegistradasH41,
        costo_hora_h39: costoHoraH39,
        semaforo_anterior: (proy.semaforo_financiero as ColorSemaforoFinanciero) ?? 'verde',
    });

    await cliente.query(
        `/* fin:update-proyecto */
         UPDATE proyecto
         SET costo_real_acumulado = $2,
             margen_estimado = $3,
             porcentaje_consumo_presupuesto = $4,
             semaforo_financiero = $5
         WHERE id_proyecto = $1`,
        [
            idProyecto,
            calculo.costo_real,
            calculo.margen_estimado,
            calculo.porcentaje_consumo_presupuesto,
            calculo.semaforo_actual,
        ]
    );

    const alerta = construirAlertaFinancieraProyectoAdmin({
        idProyecto,
        nombreProyecto: proy.nombre_proyecto,
        calculo,
        origenEvento,
    });

    if (alerta) {
        await cliente.query(
            `/* fin:insert-alerta */
             INSERT INTO alertas_sistema (
                 tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, rol_destino, leida
             )
             VALUES ($1, $2, $3, $4, NULL, NULL, 'admin', FALSE)`,
            [alerta.tipo, alerta.severidad, alerta.titulo, alerta.descripcion]
        );
    }

    return {
        id_proyecto: idProyecto,
        nombre_proyecto: proy.nombre_proyecto,
        presupuesto_materiales: Math.round(presupuestoMateriales),
        presupuesto_horas: Number(proy.presupuesto_horas),
        ...calculo,
        alerta_generada: alerta,
    };
};

/**
 * [BACK-1 / H41] Registra horas trabajadas en un proyecto, las valoriza al costo por hora de H39
 * y recalcula automáticamente el motor financiero del proyecto (Costo Real, Margen Estimado y Semáforo).
 */
export const registrarHorasProyectoEnTransaccion = async (
    cliente: PoolClient,
    idProyecto: number,
    datos: {
        horas?: unknown;
        hours?: unknown;
        tecnico_id?: number | null;
        descripcion?: string | null;
        fecha_trabajo?: string | null;
    },
    idEjecutor: number | null
): Promise<{
    id_registro_hora: number;
    proyecto_id: number;
    tecnico_id: number | null;
    horas: number;
    costo_hora_aplicado: number;
    costo_total: number;
    descripcion: string | null;
    finanzas: EstadoFinancieroProyectoRespuesta;
}> => {
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
        throw new ErrorAplicacion(400, 'Identificador de proyecto inválido');
    }

    const rawHoras = datos.horas ?? datos.hours;
    const numHoras =
        typeof rawHoras === 'number'
            ? rawHoras
            : typeof rawHoras === 'string' && rawHoras.trim() !== ''
              ? Number(rawHoras)
              : NaN;

    if (!Number.isFinite(numHoras) || numHoras <= 0) {
        throw new ErrorAplicacion(400, 'La cantidad de horas registradas debe ser mayor a 0');
    }
    const horas = Number(numHoras.toFixed(2));
    const costoHoraH39 = await obtenerCostoHoraHombreH39(cliente);
    const costoTotal = Math.round(horas * costoHoraH39);
    const tecnicoId = datos.tecnico_id !== undefined ? datos.tecnico_id : idEjecutor;
    const descripcion =
        typeof datos.descripcion === 'string' && datos.descripcion.trim()
            ? datos.descripcion.trim().slice(0, 250)
            : null;

    const insRes = await cliente.query<{ id_registro_hora: number }>(
        `/* fin:insert-horas-h41 */
         INSERT INTO horas_proyecto_h41 (
             proyecto_id, tecnico_id, horas, costo_hora_aplicado, costo_total, descripcion, fecha_trabajo
         )
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE))
         RETURNING id_registro_hora`,
        [idProyecto, tecnicoId ?? null, horas, costoHoraH39, costoTotal, descripcion, datos.fecha_trabajo ?? null]
    );
    const idRegistroHora = Number(insRes.rows?.[0]?.id_registro_hora ?? 1);

    const finanzas = await recalcularFinanzasProyectoEnTransaccion(
        cliente,
        idProyecto,
        `registro de ${horas} h en H41`
    );
    if (!finanzas) {
        throw new ErrorAplicacion(404, 'Proyecto no encontrado');
    }

    return {
        id_registro_hora: idRegistroHora,
        proyecto_id: idProyecto,
        tecnico_id: tecnicoId ?? null,
        horas,
        costo_hora_aplicado: costoHoraH39,
        costo_total: costoTotal,
        descripcion,
        finanzas,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const obtenerEstadoFinancieroProyecto = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const idProyecto = Number(req.params.id);
        if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
            throw new ErrorAplicacion(400, 'Identificador de proyecto inválido');
        }
        const estado = await ejecutarTransaccion((cliente) =>
            recalcularFinanzasProyectoEnTransaccion(cliente, idProyecto)
        );
        if (!estado) {
            throw new ErrorAplicacion(404, 'Proyecto no encontrado');
        }
        res.status(200).json(estado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al calcular el estado financiero del proyecto');
    }
};

export const registrarHorasProyecto = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const idProyecto = Number(req.params.id ?? req.body?.proyecto_id ?? req.body?.id_proyecto);
        const idEjecutor = obtenerIdEjecutor(req);
        const resultado = await ejecutarTransaccion((cliente) =>
            registrarHorasProyectoEnTransaccion(cliente, idProyecto, req.body ?? {}, idEjecutor)
        );
        res.status(201).json({
            mensaje: `Horas registradas (${resultado.horas} h) y finanzas del proyecto recalculadas (Semáforo: ${resultado.finanzas.semaforo_actual.toUpperCase()}).`,
            ...resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar las horas del proyecto');
    }
};
