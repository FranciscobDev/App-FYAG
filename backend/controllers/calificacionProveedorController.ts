import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { promedioCalificacion, validarEstrellas, validarOcCalificable } from '../services/calificacionProveedorService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export const registrarCalificacionEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    idOc: number,
    datos: { tiempo: unknown; calidad: unknown; precio: unknown; comentario?: string },
    idUsuario: number | null
) => {
    const tiempo = validarEstrellas(datos.tiempo, 'tiempo');
    const calidad = validarEstrellas(datos.calidad, 'calidad');
    const precio = validarEstrellas(datos.precio, 'precio');

    const oc = await cliente.query(
        `/* cal:select-oc */ SELECT id_orden_compra, numero_oc, proveedor_id, estado::text AS estado
         FROM ordenes_compra WHERE id_orden_compra = $1 FOR UPDATE`,
        [idOc]
    );
    if (!oc.rows[0]) throw new ErrorAplicacion(404, 'Orden de compra no encontrada');
    validarOcCalificable(oc.rows[0].estado);

    const previa = await cliente.query(
        '/* cal:select-previa */ SELECT id_calificacion FROM calificaciones_proveedor WHERE id_orden_compra = $1',
        [idOc]
    );
    if (previa.rows[0]) throw new ErrorAplicacion(409, 'Esta orden de compra ya fue calificada (una calificación por OC)');

    const promedio = promedioCalificacion(tiempo, calidad, precio);
    const ins = await cliente.query(
        `/* cal:insert */ INSERT INTO calificaciones_proveedor
            (id_orden_compra, id_proveedor, tiempo, calidad, precio, promedio, comentario, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [idOc, oc.rows[0].proveedor_id, tiempo, calidad, precio, promedio, datos.comentario ?? null, idUsuario]
    );

    // Recalcula el ranking del proveedor al instante, dentro de la misma transacción
    const prov = await cliente.query(
        `/* cal:recalcular */ UPDATE proveedor p SET
            calificacion_promedio = ROUND(a.prom, 2),
            calificacion_tiempo = ROUND(a.t, 2),
            calificacion_calidad = ROUND(a.c, 2),
            calificacion_precio = ROUND(a.pr, 2),
            total_calificaciones = a.n
         FROM (SELECT AVG(promedio) AS prom, AVG(tiempo) AS t, AVG(calidad) AS c, AVG(precio) AS pr, COUNT(*)::int AS n
               FROM calificaciones_proveedor WHERE id_proveedor = $1) a
         WHERE p.id_proveedor = $1
         RETURNING p.id_proveedor, p.calificacion_promedio, p.calificacion_tiempo, p.calificacion_calidad,
                   p.calificacion_precio, p.total_calificaciones`,
        [oc.rows[0].proveedor_id]
    );

    await registrarAuditoria(
        {
            entidad: 'proveedor',
            accion: 'calificar_proveedor',
            idRegistro: oc.rows[0].proveedor_id,
            idUsuarioEjecutor: idUsuario,
            estadoAnterior: null,
            estadoNuevo: { numero_oc: oc.rows[0].numero_oc, tiempo, calidad, precio, promedio, ranking: prov.rows[0] },
            descripcion: `Calificación de la OC ${oc.rows[0].numero_oc}: ${promedio}/5`,
        },
        cliente as PoolClient
    );

    return { calificacion: ins.rows[0], proveedor: prov.rows[0] };
};

/** POST /api/ordenes-compra/:id/calificacion  { tiempo, calidad, precio, comentario? } (Administrador) */
export const calificarOrdenCompra = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ mensaje: 'ID de orden de compra inválido' });
            return;
        }
        const r = await ejecutarTransaccion((c) =>
            registrarCalificacionEnTransaccion(c, id, req.body ?? {}, obtenerIdEjecutor(req))
        );
        res.status(201).json({ ok: true, mensaje: 'Calificación registrada y ranking del proveedor actualizado', ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al calificar la orden de compra');
    }
};

/** GET /api/proveedores/:id/calificaciones — historial para la ficha del proveedor (H15). */
export const listarCalificacionesProveedor = async (req: Request, res: Response): Promise<void> => {
    try {
        const r = await pool.query(
            `SELECT c.*, o.numero_oc FROM calificaciones_proveedor c
             JOIN ordenes_compra o ON o.id_orden_compra = c.id_orden_compra
             WHERE c.id_proveedor = $1 ORDER BY c.fecha_calificacion DESC`,
            [Number(req.params.id)]
        );
        res.status(200).json({ ok: true, total: r.rows.length, calificaciones: r.rows });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al consultar las calificaciones');
    }
};
