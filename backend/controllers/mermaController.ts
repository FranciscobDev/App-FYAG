import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { construirAlertaMermaAdmin, validarYValorizarMerma } from '../services/mermaService';
import { ejecutarTransaccion } from '../services/transaccion';
import { verificarInsumoNoBloqueadoPorConteo } from './conteoFisicoController';

export interface MermaRegistrada {
    id_merma: number;
    codigo_merma: string;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad: number;
    motivo: string;
    observacion: string;
    pmp_unitario: number;
    perdida_total: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    id_movimiento_cardex: number | null;
    alerta_administrador: { titulo: string; descripcion: string };
}

/**
 * [BACK-2] Ejecuta el registro transaccional de una merma:
 * - Valida que cantidad <= cantidad_disponible y que el insumo no esté bloqueado por conteo
 * - Descuenta cantidad_disponible en articulos_stock
 * - Registra la salida por merma en el Cardex (movimientos_inventario)
 * - Valoriza la pérdida financiera exacta al PMP actual (cantidad * PMP)
 * - Envía alerta inmediata al Administrador
 */
export const registrarMermaEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        id_articulo?: number;
        sku?: string;
        cantidad?: unknown;
        quantity?: unknown;
        motivo?: unknown;
        reason?: unknown;
        observacion?: unknown;
        observation?: unknown;
    },
    idUsuario: number | null
): Promise<MermaRegistrada> => {
    const idArt = Number(datos.id_articulo ?? 0);
    const skuInput = typeof datos.sku === 'string' ? datos.sku.trim() : '';
    if ((!Number.isInteger(idArt) || idArt <= 0) && !skuInput) {
        throw new ErrorAplicacion(400, 'Debe indicar el artículo (id_articulo o sku) para registrar la merma');
    }

    const stockRes = await cliente.query<{
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_disponible: number;
        cantidad_comprometida: number;
        pmp: number;
        precio_unitario: number;
    }>(
        idArt > 0
            ? `/* merma:select-stock */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario
               FROM articulos_stock s
               JOIN articulo a ON a.id_articulo = s.id_articulo
               WHERE s.id_articulo = $1
               FOR UPDATE OF s`
            : `/* merma:select-stock-sku */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario
               FROM articulos_stock s
               JOIN articulo a ON a.id_articulo = s.id_articulo
               WHERE UPPER(TRIM(a.sku)) = UPPER(TRIM($1))
               FOR UPDATE OF s`,
        [idArt > 0 ? idArt : skuInput]
    );

    const stock = stockRes.rows?.[0];
    if (!stock) {
        throw new ErrorAplicacion(404, 'Insumo no encontrado en el registro de stock');
    }

    await verificarInsumoNoBloqueadoPorConteo(cliente, stock.id_articulo, `${stock.nombre_articulo} (${stock.sku})`);

    const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
    const valorizada = validarYValorizarMerma({
        cantidad: datos.cantidad ?? datos.quantity,
        disponibleActual: Number(stock.cantidad_disponible),
        pmpUnitario: pmp,
        motivo: datos.motivo ?? datos.reason,
        observacion: datos.observacion ?? datos.observation,
        etiquetaArticulo: `${stock.nombre_articulo} (${stock.sku})`,
    });

    // 1. Descontar stock disponible
    await cliente.query(
        `/* merma:update-stock */
         UPDATE articulos_stock
         SET cantidad_disponible = $2
         WHERE id_articulo = $1`,
        [stock.id_articulo, valorizada.disponible_nuevo]
    );

    // 2. Insertar registro en mermas_bodega
    const insRes = await cliente.query<{ id_merma: number; codigo_merma?: string }>(
        `/* merma:insert-cabecera */
         INSERT INTO mermas_bodega (
             codigo_merma, id_articulo, cantidad, motivo, observacion,
             pmp_unitario, perdida_total, disponible_anterior, disponible_nuevo, id_usuario
         )
         VALUES (
             'MERMA-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(nextval('seq_codigo_merma')::text, 5, '0'),
             $1, $2, $3, $4, $5, $6, $7, $8, $9
         )
         RETURNING id_merma, codigo_merma`,
        [
            stock.id_articulo,
            valorizada.cantidad,
            valorizada.motivo,
            valorizada.observacion,
            valorizada.pmp_unitario,
            valorizada.perdida_total,
            valorizada.disponible_anterior,
            valorizada.disponible_nuevo,
            idUsuario,
        ]
    );
    const idMerma = Number(insRes.rows[0].id_merma);
    const codigoMerma =
        insRes.rows[0].codigo_merma || `MERMA-${new Date().getFullYear()}-${String(idMerma).padStart(5, '0')}`;

    // 3. Registrar salida por merma en el Cardex (movimientos_inventario y movimiento_inventario)
    const comprometido = Number(stock.cantidad_comprometida);
    const saldoHistorico = Number((valorizada.disponible_nuevo + comprometido).toFixed(3));
    const valorTotalHistorico = Math.round(saldoHistorico * pmp);
    const referenciaCardex =
        `${codigoMerma} | Salida por merma (${valorizada.motivo}): ${valorizada.observacion} | ` +
        `Pérdida valorizada a PMP ($${valorizada.pmp_unitario}): $${valorizada.perdida_total}`;

    const movRes = await cliente.query<{ id_movimiento: number }>(
        `/* merma:insert-cardex */
         INSERT INTO movimientos_inventario
             (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
              pmp_historico, valor_total_historico, referencia, id_usuario)
         VALUES ($1, 'Salida', 'disponible', $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_movimiento`,
        [
            stock.id_articulo,
            valorizada.cantidad,
            valorizada.pmp_unitario,
            saldoHistorico,
            valorizada.pmp_unitario,
            valorTotalHistorico,
            referenciaCardex,
            idUsuario,
        ]
    );
    const idMovimientoCardex = movRes.rows?.[0]?.id_movimiento ?? null;

    await cliente.query(
        `/* merma:insert-cardex-simple */
         INSERT INTO movimiento_inventario
             (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
              pmp_historico, referencia, id_usuario)
         VALUES ($1, 'Salida', 'disponible', $2, $3, $4, $5, $6, $7)`,
        [
            stock.id_articulo,
            valorizada.cantidad,
            valorizada.pmp_unitario,
            saldoHistorico,
            valorizada.pmp_unitario,
            referenciaCardex,
            idUsuario,
        ]
    );

    if (idMovimientoCardex) {
        await cliente.query(
            `/* merma:update-movimiento-cabecera */
             UPDATE mermas_bodega SET id_movimiento_cardex = $2 WHERE id_merma = $1`,
            [idMerma, idMovimientoCardex]
        );
    }

    // 4. Enviar alerta inmediata al Administrador
    const alertaAdmin = construirAlertaMermaAdmin({
        codigoMerma,
        sku: stock.sku,
        nombreArticulo: stock.nombre_articulo,
        cantidad: valorizada.cantidad,
        motivo: valorizada.motivo,
        observacion: valorizada.observacion,
        pmpUnitario: valorizada.pmp_unitario,
        perdidaTotal: valorizada.perdida_total,
        disponibleNuevo: valorizada.disponible_nuevo,
    });

    await cliente.query(
        `/* merma:insert-alerta */
         INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('merma_inventario', 'amarillo', $1, $2, $3, NULL, FALSE)`,
        [alertaAdmin.titulo, alertaAdmin.descripcion, stock.id_articulo]
    );

    // 5. Auditoría inmutable
    await registrarAuditoria(
        {
            entidad: 'merma_bodega',
            accion: 'registrar_merma',
            idRegistro: idMerma,
            idUsuarioEjecutor: idUsuario,
            estadoAnterior: { cantidad_disponible: valorizada.disponible_anterior },
            estadoNuevo: {
                id_merma: idMerma,
                codigo_merma: codigoMerma,
                id_articulo: stock.id_articulo,
                cantidad: valorizada.cantidad,
                motivo: valorizada.motivo,
                pmp_unitario: valorizada.pmp_unitario,
                perdida_total: valorizada.perdida_total,
                cantidad_disponible: valorizada.disponible_nuevo,
            },
            descripcion: referenciaCardex,
        },
        cliente
    );

    return {
        id_merma: idMerma,
        codigo_merma: codigoMerma,
        id_articulo: stock.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        cantidad: valorizada.cantidad,
        motivo: valorizada.motivo,
        observacion: valorizada.observacion,
        pmp_unitario: valorizada.pmp_unitario,
        perdida_total: valorizada.perdida_total,
        disponible_anterior: valorizada.disponible_anterior,
        disponible_nuevo: valorizada.disponible_nuevo,
        id_movimiento_cardex: idMovimientoCardex,
        alerta_administrador: alertaAdmin,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const registrarMerma = async (req: Request, res: Response): Promise<void> => {
    try {
        const idUsuario = obtenerIdEjecutor(req);
        const merma = await ejecutarTransaccion((cliente) =>
            registrarMermaEnTransaccion(cliente, req.body ?? {}, idUsuario)
        );
        res.status(201).json({
            mensaje: `Merma ${merma.codigo_merma} registrada exitosamente. Stock descontado, Cardex actualizado y Administrador notificado.`,
            merma,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar la merma de inventario');
    }
};

export const listarMermas = async (_req: Request, res: Response): Promise<void> => {
    try {
        const resultado = await pool.query(
            `SELECT m.id_merma, m.codigo_merma, m.id_articulo, a.sku, a.nombre_articulo,
                    m.cantidad::float8 AS cantidad, m.motivo, m.observacion,
                    m.pmp_unitario::float8 AS pmp_unitario, m.perdida_total::bigint AS perdida_total,
                    m.disponible_anterior::float8 AS disponible_anterior,
                    m.disponible_nuevo::float8 AS disponible_nuevo,
                    m.id_movimiento_cardex, m.id_usuario, m.fecha_registro
             FROM mermas_bodega m
             JOIN articulo a ON a.id_articulo = m.id_articulo
             ORDER BY m.id_merma DESC`
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las mermas de inventario');
    }
};
