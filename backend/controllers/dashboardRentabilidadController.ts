import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { calcularDashboardRentabilidad, validarProyectoCerrado } from '../services/dashboardRentabilidadService';
import { COSTO_HORA_HOMBRE_H39_DEFECTO } from '../services/motorFinancieroProyectoService';

export const obtenerDashboardRentabilidadEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    idProyecto: number
) => {
    const p = await cliente.query(
        `/* dash:select-proyecto */
         SELECT id_proyecto, nombre_proyecto, estado_proyecto::text AS estado_proyecto,
                COALESCE(presupuesto_inicial, 0)::float8 AS presupuesto_inicial,
                presupuesto_materiales::float8 AS presupuesto_materiales,
                COALESCE(presupuesto_horas, 0)::float8 AS presupuesto_horas,
                COALESCE(presupuesto_mermas, 0)::float8 AS presupuesto_mermas,
                COALESCE(valor_venta, 0)::float8 AS valor_venta
         FROM proyecto WHERE id_proyecto = $1`,
        [idProyecto]
    );
    const proy = p.rows[0];
    if (!proy) throw new ErrorAplicacion(404, 'Proyecto no encontrado');
    validarProyectoCerrado(proy.estado_proyecto); // bloquea Planificado / Activo antes de calcular nada

    const ch = await cliente.query(`/* dash:costo-hora */ SELECT valor FROM parametro_sistema WHERE clave = 'costo_hora_hombre' LIMIT 1`);
    const costoHora = Number(ch.rows[0]?.valor) > 0 ? Number(ch.rows[0].valor) : COSTO_HORA_HOMBRE_H39_DEFECTO;

    const egr = await cliente.query(
        `/* dash:egresos-pmp */
         SELECT COALESCE(SUM(ROUND(el.cantidad_egresada * el.costo_unitario_pmp)), 0)::float8 AS total
         FROM egresos_bodega eb JOIN egreso_lineas el ON el.id_egreso = eb.id_egreso
         WHERE eb.proyecto_id = $1`,
        [idProyecto]
    );
    const aju = await cliente.query(
        `/* dash:ajustes */ SELECT COALESCE(SUM(monto), 0)::float8 AS total FROM proyecto_costo_ajuste WHERE proyecto_id = $1`,
        [idProyecto]
    );
    const mer = await cliente.query(
        `/* dash:mermas */ SELECT COALESCE(SUM(perdida_total), 0)::float8 AS total FROM mermas_bodega WHERE id_proyecto = $1`,
        [idProyecto]
    );
    const hrs = await cliente.query(
        `/* dash:horas */ SELECT COALESCE(SUM(horas), 0)::float8 AS total FROM horas_proyecto_h41 WHERE proyecto_id = $1`,
        [idProyecto]
    );

    const dashboard = calcularDashboardRentabilidad({
        valor_venta: Number(proy.valor_venta),
        presupuesto_inicial: Number(proy.presupuesto_inicial),
        presupuesto_materiales: proy.presupuesto_materiales != null ? Number(proy.presupuesto_materiales) : null,
        presupuesto_horas: Number(proy.presupuesto_horas),
        presupuesto_mermas: Number(proy.presupuesto_mermas),
        costo_hora: costoHora,
        egresos_netos_pmp: Number(egr.rows[0]?.total ?? 0) + Number(aju.rows[0]?.total ?? 0),
        mermas_total: Number(mer.rows[0]?.total ?? 0),
        horas_registradas: Number(hrs.rows[0]?.total ?? 0),
    });

    return {
        proyecto: { id_proyecto: proy.id_proyecto, nombre_proyecto: proy.nombre_proyecto, estado_proyecto: proy.estado_proyecto, valor_venta: Number(proy.valor_venta) },
        costo_hora_h39: costoHora,
        ...dashboard,
    };
};

/** GET /api/proyectos/:id/dashboard-rentabilidad (Administrador; solo proyectos Cerrados). */
export const dashboardRentabilidadProyecto = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ mensaje: 'ID de proyecto inválido' });
            return;
        }
        res.status(200).json({ ok: true, ...(await obtenerDashboardRentabilidadEnTransaccion(pool, id)) });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al generar el dashboard de rentabilidad');
    }
};
