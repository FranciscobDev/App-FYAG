import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import {
    DIAS_MAX_PRESTAMO_DEFECTO,
    estadoHerramientaTrasDevolucion,
    motivoAlertaPrestamo,
    normalizarEstadoDevolucion,
    validarHerramientaPrestable,
} from '../services/prestamoHerramientaService';
import { ejecutarTransaccion } from '../services/transaccion';
import type { HerramientaFila } from './herramientaController';

const MS_DIA = 24 * 60 * 60 * 1000;

export const entregarHerramientaEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    datos: { id_herramienta: number; id_tecnico: number; id_proyecto?: number | null; observacion?: string },
    idBodeguero: number | null
) => {
    if (!Number.isInteger(datos.id_herramienta) || !Number.isInteger(datos.id_tecnico)) {
        throw new ErrorAplicacion(400, 'Debes indicar la herramienta y el técnico que la retira');
    }

    const h = await cliente.query<HerramientaFila>(
        'SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE',
        [datos.id_herramienta]
    );
    if (!h.rows[0]) throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    validarHerramientaPrestable(h.rows[0]);

    const prestamo = await cliente.query(
        `INSERT INTO prestamos_herramienta (id_herramienta, id_tecnico, id_proyecto, id_bodeguero, observacion)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [datos.id_herramienta, datos.id_tecnico, datos.id_proyecto ?? null, idBodeguero, datos.observacion ?? null]
    );
    await cliente.query(
        `UPDATE herramientas SET estado = 'asignada', fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_herramienta = $1 RETURNING *`,
        [datos.id_herramienta]
    );

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'entrega_herramienta',
            idRegistro: datos.id_herramienta,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { estado: h.rows[0].estado },
            estadoNuevo: { estado: 'asignada', id_tecnico: datos.id_tecnico, id_proyecto: datos.id_proyecto ?? null },
            descripcion: `Entrega de ${h.rows[0].codigo_herramienta} al técnico ${datos.id_tecnico}`,
        },
        cliente as PoolClient
    );

    return { prestamo: prestamo.rows[0], estado_herramienta: 'asignada' as const };
};

export const devolverHerramientaEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    idPrestamo: number,
    datos: { estado_devolucion: unknown; observacion?: string },
    idBodeguero: number | null
) => {
    const estadoDev = normalizarEstadoDevolucion(datos.estado_devolucion);

    const p = await cliente.query(
        'SELECT * FROM prestamos_herramienta WHERE id_prestamo = $1 FOR UPDATE',
        [idPrestamo]
    );
    if (!p.rows[0]) throw new ErrorAplicacion(404, 'Préstamo no encontrado');
    if (p.rows[0].fecha_devolucion) throw new ErrorAplicacion(409, 'Este préstamo ya fue devuelto');

    const nuevoEstado = estadoHerramientaTrasDevolucion(estadoDev);
    const cerrado = await cliente.query(
        `UPDATE prestamos_herramienta SET fecha_devolucion = CURRENT_TIMESTAMP, estado_devolucion = $1,
                observacion = COALESCE($2, observacion)
         WHERE id_prestamo = $3 RETURNING *`,
        [estadoDev, datos.observacion ?? null, idPrestamo]
    );
    await cliente.query(
        `UPDATE herramientas SET estado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_herramienta = $2 RETURNING *`,
        [nuevoEstado, p.rows[0].id_herramienta]
    );

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'devolucion_herramienta',
            idRegistro: p.rows[0].id_herramienta,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { estado: 'asignada' },
            estadoNuevo: { estado: nuevoEstado, estado_devolucion: estadoDev },
            descripcion: `Devolución en estado ${estadoDev}: herramienta pasa a ${nuevoEstado}`,
        },
        cliente as PoolClient
    );

    return { prestamo: cerrado.rows[0], estado_herramienta: nuevoEstado };
};

/** Proceso diario: alerta préstamos > N días (H39) o con proyecto cerrado, una sola vez por préstamo. */
export const procesarAlertasPrestamosEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    ahoraMs: number = Date.now()
) => {
    let diasMax = DIAS_MAX_PRESTAMO_DEFECTO;
    const param = await cliente.query(
        `SELECT valor FROM parametro_sistema WHERE clave = 'dias_max_prestamo_herramienta'`
    );
    if (param.rows[0]) diasMax = Number(param.rows[0].valor);

    const abiertos = await cliente.query(
        `/* prestamos:abiertos */
         SELECT p.id_prestamo, p.fecha_entrega, p.id_tecnico, h.codigo_herramienta, h.nombre,
                (pr.estado_proyecto IS NOT NULL
                 AND pr.estado_proyecto ~* '(cerrad|complet|cancel|finaliz)') AS proyecto_cerrado
         FROM prestamos_herramienta p
         JOIN herramientas h ON h.id_herramienta = p.id_herramienta
         LEFT JOIN proyecto pr ON pr.id_proyecto = p.id_proyecto
         WHERE p.fecha_devolucion IS NULL AND p.alerta_atraso_enviada = FALSE`
    );

    const alertas: { id_prestamo: number; motivo: string }[] = [];
    for (const p of abiertos.rows) {
        const motivo = motivoAlertaPrestamo(p, diasMax, ahoraMs);
        if (!motivo) continue;
        const dias = Math.floor((ahoraMs - new Date(p.fecha_entrega).getTime()) / MS_DIA);
        const titulo =
            motivo === 'cierre_proyecto'
                ? `Herramienta sin devolver al cerrar el proyecto: ${p.codigo_herramienta}`
                : `Herramienta con préstamo atrasado (${dias} días): ${p.codigo_herramienta}`;
        const descripcion = `${p.nombre} sigue asignada al técnico ${p.id_tecnico}. Límite: ${diasMax} días (H39).`;
        await cliente.query(
            `/* prestamos:insert-alerta */
             INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('herramienta_no_devuelta', 'amarillo', $1, $2, NULL, NULL, FALSE)`,
            [titulo, descripcion]
        );
        await cliente.query(
            'UPDATE prestamos_herramienta SET alerta_atraso_enviada = TRUE WHERE id_prestamo = $1',
            [p.id_prestamo]
        );
        alertas.push({ id_prestamo: p.id_prestamo, motivo });
    }
    return { dias_max: diasMax, alertas_generadas: alertas.length, alertas };
};

let temporizadorDiario: NodeJS.Timeout | null = null;
export const iniciarProcesoDiarioPrestamos = (): void => {
    if (temporizadorDiario) return;
    const correr = () =>
        ejecutarTransaccion((c) => procesarAlertasPrestamosEnTransaccion(c)).catch((e) =>
            console.error('Error en proceso diario de préstamos de herramientas', e)
        );
    temporizadorDiario = setInterval(correr, MS_DIA);
    temporizadorDiario.unref();
};

// ---- Handlers HTTP ----
export const entregarHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        const b = req.body ?? {};
        const r = await ejecutarTransaccion((c) =>
            entregarHerramientaEnTransaccion(
                c,
                {
                    id_herramienta: Number(b.id_herramienta),
                    id_tecnico: Number(b.id_tecnico),
                    id_proyecto: b.id_proyecto != null ? Number(b.id_proyecto) : null,
                    observacion: b.observacion,
                },
                obtenerIdEjecutor(req)
            )
        );
        res.status(201).json({ ok: true, mensaje: 'Herramienta entregada y marcada como Asignada', ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al entregar la herramienta');
    }
};

export const devolverHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ mensaje: 'ID de préstamo inválido' });
            return;
        }
        const r = await ejecutarTransaccion((c) =>
            devolverHerramientaEnTransaccion(c, id, req.body ?? {}, obtenerIdEjecutor(req))
        );
        res.status(200).json({ ok: true, mensaje: `Herramienta ahora: ${r.estado_herramienta}`, ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al devolver la herramienta');
    }
};

export const historialPrestamosHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        const r = await pool.query(
            'SELECT * FROM prestamos_herramienta WHERE id_herramienta = $1 ORDER BY fecha_entrega DESC',
            [Number(req.params.id)]
        );
        res.status(200).json({ ok: true, prestamos: r.rows });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al consultar el historial de préstamos');
    }
};

export const ejecutarProcesoAlertasPrestamos = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ ok: true, ...(await ejecutarTransaccion((c) => procesarAlertasPrestamosEnTransaccion(c))) });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al procesar alertas de préstamos');
    }
};
