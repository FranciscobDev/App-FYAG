import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import {
    ESTADO_DEVOLUCION_EN_TRANSITO,
    ESTADO_DEVOLUCION_RECIBIDA,
    LineaDevolucionDb,
    calcularMontoAjusteCosto,
    construirAlertaDiferenciaDevolucion,
    planificarConfirmacionRecepcion,
} from '../services/devolucionBodegaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export interface LineaRecepcionConfirmada {
    id_devolucion_linea: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_declarada: number;
    cantidad_recibida: number;
    diferencia: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    costo_unitario: number;
    ajuste_costo: number;
    id_movimiento_cardex: number | null;
}

export interface ResultadoConfirmacionRecepcion {
    id_devolucion: number;
    codigo: string;
    estado: typeof ESTADO_DEVOLUCION_RECIBIDA;
    proyecto_id: number;
    tiene_diferencia: boolean;
    lineas: LineaRecepcionConfirmada[];
    /** Monto TOTAL descontado del costo del proyecto (negativo). */
    ajuste_costo_total: number;
    alerta_administrador: { titulo: string; descripcion: string } | null;
}

/**
 * [BACK-1] Confirma la recepción física de una devolución «En tránsito» en UNA sola transacción:
 *  1. Valida (antes de modificar nada) que cada ítem tenga su cantidad real y que no exceda lo declarado.
 *  2. Reincorpora la cantidad_recibida real a `cantidad_disponible` (bloqueando la fila con FOR UPDATE).
 *  3. Descuenta del costo del proyecto (`proyecto_costo_ajuste`, monto negativo = cantidad real × PMP).
 *  4. Registra la Entrada en Cardex (`movimientos_inventario` y `movimiento_inventario`).
 *  5. Si hay diferencia contra lo declarado, la deja en la línea y alerta al Administrador.
 * Si cualquier paso falla, el llamador hace ROLLBACK y no queda stock, costo ni Cardex a medias.
 */
export const confirmarRecepcionDevolucionEnTransaccion = async (
    cliente: PoolClient,
    idDevolucion: number,
    entradas: unknown,
    observaciones: string | null,
    idBodeguero: number | null
): Promise<ResultadoConfirmacionRecepcion> => {
    const cabeceraRes = await cliente.query<{
        id_devolucion: number;
        codigo: string;
        proyecto_id: number;
        tecnico_id: number;
        estado: string;
    }>(
        `/* dev:select-cabecera */
         SELECT id_devolucion, codigo, proyecto_id, tecnico_id, estado
         FROM devoluciones_tecnico
         WHERE id_devolucion = $1
         FOR UPDATE`,
        [idDevolucion]
    );
    const cabecera = cabeceraRes.rows[0];
    if (!cabecera) throw new ErrorAplicacion(404, 'Devolución no encontrada');
    if (cabecera.estado !== ESTADO_DEVOLUCION_EN_TRANSITO) {
        throw new ErrorAplicacion(409, `La devolución ${cabecera.codigo} ya fue confirmada; no se puede recibir dos veces`);
    }

    const lineasRes = await cliente.query<LineaDevolucionDb>(
        `/* dev:select-lineas */
         SELECT id_devolucion_linea, id_articulo, cantidad_declarada::float8 AS cantidad_declarada
         FROM devolucion_lineas
         WHERE id_devolucion = $1
         ORDER BY id_devolucion_linea
         FOR UPDATE`,
        [idDevolucion]
    );
    const plan = planificarConfirmacionRecepcion(
        lineasRes.rows.map((l) => ({ ...l, cantidad_declarada: Number(l.cantidad_declarada) })),
        entradas
    );

    const lineasConfirmadas: LineaRecepcionConfirmada[] = [];
    let ajusteTotal = 0;

    for (const item of plan) {
        const stockRes = await cliente.query<{
            cantidad_disponible: number;
            cantidad_comprometida: number;
            pmp: number;
            precio_unitario: number;
            sku: string;
            nombre_articulo: string;
        }>(
            `/* dev:select-stock */
             SELECT s.cantidad_disponible::float8 AS cantidad_disponible,
                    s.cantidad_comprometida::float8 AS cantidad_comprometida,
                    COALESCE(s.pmp, 0)::float8 AS pmp,
                    COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                    a.sku, a.nombre_articulo
             FROM articulos_stock s
             JOIN articulo a ON a.id_articulo = s.id_articulo
             WHERE s.id_articulo = $1
             FOR UPDATE OF s`,
            [item.id_articulo]
        );
        const stock = stockRes.rows[0];
        if (!stock) throw new ErrorAplicacion(404, `El artículo #${item.id_articulo} no tiene registro de stock`);

        const dispAnterior = Number(stock.cantidad_disponible);
        const comprometido = Number(stock.cantidad_comprometida);
        const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
        const dispNuevo = Number((dispAnterior + item.cantidad_recibida).toFixed(3));
        const ajuste = item.cantidad_recibida > 0 ? -calcularMontoAjusteCosto(item.cantidad_recibida, pmp) : 0;
        let idMovimiento: number | null = null;

        if (item.cantidad_recibida > 0) {
            // 2. Reincorporar al stock disponible la cantidad REAL (no la declarada). El PMP no cambia al devolver al mismo costo.
            await cliente.query(
                `/* dev:update-stock */
                 UPDATE articulos_stock SET cantidad_disponible = $2 WHERE id_articulo = $1`,
                [item.id_articulo, dispNuevo]
            );

            // 4. Cardex (Entrada a bolsa disponible) con saldo físico posterior y PMP histórico
            const saldoHistorico = Number((dispNuevo + comprometido).toFixed(3));
            const valorTotal = Math.round(saldoHistorico * pmp);
            const referencia =
                `${cabecera.codigo} | Devolución de técnico #${cabecera.tecnico_id} | Proyecto #${cabecera.proyecto_id} | ` +
                `Declarado: ${item.cantidad_declarada}, Recibido real: ${item.cantidad_recibida}`;

            const movRes = await cliente.query<{ id_movimiento: number }>(
                `/* dev:insert-cardex */
                 INSERT INTO movimientos_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, 'Entrada', 'disponible', $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_movimiento`,
                [item.id_articulo, item.cantidad_recibida, pmp, saldoHistorico, pmp, valorTotal, referencia, idBodeguero]
            );
            idMovimiento = movRes.rows[0]?.id_movimiento ?? null;

            await cliente.query(
                `/* dev:insert-cardex-simple */
                 INSERT INTO movimiento_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, referencia, id_usuario)
                 VALUES ($1, 'Entrada', 'disponible', $2, $3, $4, $5, $6, $7)`,
                [item.id_articulo, item.cantidad_recibida, pmp, saldoHistorico, pmp, referencia, idBodeguero]
            );

            // 3. Ajuste (descuento) del costo del proyecto: monto negativo en el libro de ajustes
            await cliente.query(
                `/* dev:insert-ajuste-costo */
                 INSERT INTO proyecto_costo_ajuste
                     (proyecto_id, id_devolucion, id_articulo, cantidad, costo_unitario, monto, tipo)
                 VALUES ($1, $2, $3, $4, $5, $6, 'devolucion_bodega')`,
                [cabecera.proyecto_id, cabecera.id_devolucion, item.id_articulo, item.cantidad_recibida, pmp, ajuste]
            );
        }

        await cliente.query(
            `/* dev:update-linea */
             UPDATE devolucion_lineas
             SET cantidad_recibida = $2, costo_unitario = $3, id_movimiento_cardex = $4
             WHERE id_devolucion_linea = $1`,
            [item.id_devolucion_linea, item.cantidad_recibida, item.cantidad_recibida > 0 ? pmp : null, idMovimiento]
        );

        ajusteTotal += ajuste;
        lineasConfirmadas.push({
            id_devolucion_linea: item.id_devolucion_linea,
            id_articulo: item.id_articulo,
            sku: stock.sku,
            nombre_articulo: stock.nombre_articulo,
            cantidad_declarada: item.cantidad_declarada,
            cantidad_recibida: item.cantidad_recibida,
            diferencia: item.diferencia,
            disponible_anterior: dispAnterior,
            disponible_nuevo: item.cantidad_recibida > 0 ? dispNuevo : dispAnterior,
            costo_unitario: pmp,
            ajuste_costo: ajuste,
            id_movimiento_cardex: idMovimiento,
        });
    }

    const tieneDiferencia = lineasConfirmadas.some((l) => l.diferencia !== 0);
    await cliente.query(
        `/* dev:update-cabecera */
         UPDATE devoluciones_tecnico
         SET estado = 'Recibida', bodeguero_id = $2, tiene_diferencia = $3,
             observaciones_recepcion = $4, fecha_recepcion = CURRENT_TIMESTAMP
         WHERE id_devolucion = $1`,
        [cabecera.id_devolucion, idBodeguero, tieneDiferencia, observaciones]
    );

    // 5. Diferencia con lo declarado: queda en la línea (columna `diferencia`) y se notifica al Administrador
    let alerta: ResultadoConfirmacionRecepcion['alerta_administrador'] = null;
    if (tieneDiferencia) {
        alerta = construirAlertaDiferenciaDevolucion({
            codigo: cabecera.codigo,
            proyectoId: cabecera.proyecto_id,
            tecnicoId: cabecera.tecnico_id,
            lineas: lineasConfirmadas.map((l) => ({ sku: l.sku, declarada: l.cantidad_declarada, recibida: l.cantidad_recibida })),
        });
        await cliente.query(
            `/* dev:insert-alerta */
             INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('diferencia_devolucion', 'amarillo', $1, $2, NULL, NULL, FALSE)`,
            [alerta.titulo, alerta.descripcion]
        );
    }

    await registrarAuditoria(
        {
            entidad: 'devolucion_tecnico',
            accion: 'confirmar_recepcion',
            idRegistro: cabecera.id_devolucion,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { estado: ESTADO_DEVOLUCION_EN_TRANSITO },
            estadoNuevo: {
                estado: ESTADO_DEVOLUCION_RECIBIDA,
                tiene_diferencia: tieneDiferencia,
                ajuste_costo_total: ajusteTotal,
                lineas: lineasConfirmadas.map((l) => ({
                    id_articulo: l.id_articulo,
                    declarada: l.cantidad_declarada,
                    recibida: l.cantidad_recibida,
                })),
            },
            descripcion: observaciones ?? undefined,
        },
        cliente
    );

    return {
        id_devolucion: cabecera.id_devolucion,
        codigo: cabecera.codigo,
        estado: ESTADO_DEVOLUCION_RECIBIDA,
        proyecto_id: cabecera.proyecto_id,
        tiene_diferencia: tieneDiferencia,
        lineas: lineasConfirmadas,
        ajuste_costo_total: ajusteTotal,
        alerta_administrador: alerta,
    };
};

/** GET /api/devoluciones?estado=En tránsito — lista devoluciones con sus ítems declarados. */
export const listarDevolucionesTecnico = async (req: Request, res: Response): Promise<void> => {
    try {
        const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
        if (estado && estado !== ESTADO_DEVOLUCION_EN_TRANSITO && estado !== ESTADO_DEVOLUCION_RECIBIDA) {
            throw new ErrorAplicacion(400, `estado debe ser "${ESTADO_DEVOLUCION_EN_TRANSITO}" o "${ESTADO_DEVOLUCION_RECIBIDA}"`);
        }

        const resultado = await pool.query(
            `SELECT d.id_devolucion, d.codigo, d.proyecto_id, p.nombre_proyecto, d.tecnico_id, d.estado,
                    d.tiene_diferencia, d.observaciones_recepcion, d.bodeguero_id,
                    d.fecha_declaracion, d.fecha_recepcion,
                    COALESCE((SELECT json_agg(json_build_object(
                        'id_devolucion_linea', l.id_devolucion_linea,
                        'id_articulo', l.id_articulo,
                        'sku', a.sku,
                        'nombre_articulo', a.nombre_articulo,
                        'cantidad_declarada', l.cantidad_declarada,
                        'cantidad_recibida', l.cantidad_recibida,
                        'diferencia', l.diferencia
                    ) ORDER BY l.id_devolucion_linea)
                    FROM devolucion_lineas l JOIN articulo a ON a.id_articulo = l.id_articulo
                    WHERE l.id_devolucion = d.id_devolucion), '[]'::json) AS items
             FROM devoluciones_tecnico d
             JOIN proyecto p ON p.id_proyecto = d.proyecto_id
             WHERE ($1 = '' OR d.estado = $1)
             ORDER BY d.fecha_declaracion DESC`,
            [estado]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las devoluciones');
    }
};

/** POST /api/devoluciones — el técnico declara lo que devuelve; nace «En tránsito». */
export const declararDevolucionTecnico = async (req: Request, res: Response): Promise<void> => {
    try {
        const idTecnico = obtenerIdEjecutor(req);
        const idProyecto = Number(req.body?.proyecto_id ?? req.body?.id_proyecto);
        const items: unknown = req.body?.items;

        if (!idTecnico) throw new ErrorAplicacion(401, 'Debes iniciar sesión');
        if (!Number.isInteger(idProyecto) || idProyecto <= 0) throw new ErrorAplicacion(400, 'El proyecto es obligatorio');
        if (!Array.isArray(items) || items.length === 0) throw new ErrorAplicacion(400, 'Debes declarar al menos un ítem a devolver');

        const acumulado = new Map<number, number>();
        for (const bruto of items) {
            const idArticulo = Number(bruto?.id_articulo);
            const cantidad = Number(bruto?.cantidad_declarada ?? bruto?.cantidad);
            if (!Number.isInteger(idArticulo) || idArticulo <= 0 || !Number.isFinite(cantidad) || cantidad <= 0) {
                throw new ErrorAplicacion(400, 'Cada ítem requiere id_articulo y una cantidad mayor a 0');
            }
            acumulado.set(idArticulo, Number(((acumulado.get(idArticulo) ?? 0) + cantidad).toFixed(3)));
        }

        const creada = await ejecutarTransaccion(async (cliente) => {
            const proy = await cliente.query('SELECT 1 FROM proyecto WHERE id_proyecto = $1', [idProyecto]);
            if (proy.rowCount === 0) throw new ErrorAplicacion(404, 'Proyecto no encontrado');

            const cab = await cliente.query<{ id_devolucion: number; codigo: string }>(
                `INSERT INTO devoluciones_tecnico (proyecto_id, tecnico_id)
                 VALUES ($1, $2) RETURNING id_devolucion, codigo`,
                [idProyecto, idTecnico]
            );
            const { id_devolucion, codigo } = cab.rows[0];

            for (const [idArticulo, cantidad] of acumulado) {
                const art = await cliente.query('SELECT 1 FROM articulo WHERE id_articulo = $1', [idArticulo]);
                if (art.rowCount === 0) throw new ErrorAplicacion(404, `Artículo #${idArticulo} no encontrado`);
                await cliente.query(
                    `INSERT INTO devolucion_lineas (id_devolucion, id_articulo, cantidad_declarada)
                     VALUES ($1, $2, $3)`,
                    [id_devolucion, idArticulo, cantidad]
                );
            }
            await registrarAuditoria(
                {
                    entidad: 'devolucion_tecnico',
                    accion: 'declarar',
                    idRegistro: id_devolucion,
                    idUsuarioEjecutor: idTecnico,
                    estadoAnterior: null,
                    estadoNuevo: { estado: ESTADO_DEVOLUCION_EN_TRANSITO, proyecto_id: idProyecto, items: Object.fromEntries(acumulado) },
                },
                cliente
            );
            return { id_devolucion, codigo, estado: ESTADO_DEVOLUCION_EN_TRANSITO };
        });
        res.status(201).json(creada);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al declarar la devolución');
    }
};

/** POST /api/devoluciones/:id/confirmar-recepcion — el Bodeguero confirma las cantidades reales. */
export const confirmarRecepcionDevolucion = async (req: Request, res: Response): Promise<void> => {
    try {
        const idDevolucion = Number(req.params.id);
        if (!Number.isInteger(idDevolucion) || idDevolucion <= 0) throw new ErrorAplicacion(400, 'Identificador inválido');

        const observaciones =
            typeof req.body?.observaciones === 'string' && req.body.observaciones.trim()
                ? req.body.observaciones.trim().slice(0, 250)
                : null;
        const idBodeguero = obtenerIdEjecutor(req);

        const resultado = await ejecutarTransaccion((cliente) =>
            confirmarRecepcionDevolucionEnTransaccion(
                cliente,
                idDevolucion,
                req.body?.lineas ?? req.body?.items,
                observaciones,
                idBodeguero
            )
        );
        res.status(200).json(resultado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al confirmar la recepción de la devolución');
    }
};
