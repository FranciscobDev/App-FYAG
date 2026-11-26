import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import {
    ESTADO_DEV_PROVEEDOR_PENDIENTE,
    ESTADO_DEV_PROVEEDOR_RESUELTA,
    EstadoDevolucionProveedor,
    TIPO_RESOLUCION_REPOSICION,
    TipoResolucionProveedor,
    construirAlertaEgresoCuarentenaAdmin,
    normalizarTipoResolucionProveedor,
    validarDatosEgresoCuarentena,
} from '../services/devolucionProveedorService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';
import { verificarInsumoNoBloqueadoPorConteo } from './conteoFisicoController';

export interface EgresoCuarentenaRegistrado {
    id_devolucion_proveedor: number;
    codigo_devolucion: string;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    id_proveedor: number | null;
    nombre_proveedor: string | null;
    id_orden_compra: number | null;
    cantidad: number;
    motivo: string;
    numero_guia_despacho: string;
    estado: EstadoDevolucionProveedor;
    tipo_resolucion: TipoResolucionProveedor | null;
    referencia_resolucion: string | null;
    notas_resolucion: string | null;
    cuarentena_anterior: number;
    cuarentena_nuevo: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    pmp_unitario: number;
    id_movimiento_cardex: number | null;
    id_movimiento_reposicion_cardex: number | null;
    alerta_administrador: { titulo: string; descripcion: string } | null;
}

const redondear3 = (valor: number): number => Number(valor.toFixed(3));

/**
 * [BACK-2] Ejecuta el egreso de productos defectuosos desde la bolsa de cuarentena hacia el proveedor:
 * - Valida motivo, número de guía de despacho y que cantidad <= cantidad_cuarentena
 * - Descuenta EXCLUSIVAMENTE de cantidad_cuarentena sin afectar cantidad_disponible (stock sano)
 * - Registra la salida desde cuarentena en el Cardex (movimientos_inventario)
 * - Deja el registro en estado 'Pendiente de resolución' y genera alerta al Administrador para seguimiento
 */
export const registrarEgresoCuarentenaEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        id_articulo?: number;
        sku?: string;
        productSku?: string;
        id_proveedor?: number;
        supplierId?: number | string;
        id_orden_compra?: number;
        cantidad?: unknown;
        quantity?: unknown;
        motivo?: unknown;
        reason?: unknown;
        numero_guia_despacho?: unknown;
        numero_guia?: unknown;
        dispatchGuideNumber?: unknown;
    },
    idBodeguero: number | null
): Promise<EgresoCuarentenaRegistrado> => {
    const idArt = Number(datos.id_articulo ?? 0);
    const skuInput = String(datos.sku ?? datos.productSku ?? '').trim();
    if ((!Number.isInteger(idArt) || idArt <= 0) && !skuInput) {
        throw new ErrorAplicacion(400, 'Debe indicar el artículo (id_articulo o sku) en cuarentena a devolver');
    }

    const stockRes = await cliente.query<{
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_disponible: number;
        cantidad_comprometida: number;
        cantidad_cuarentena: number;
        pmp: number;
        precio_unitario: number;
        id_proveedor_principal: number | null;
    }>(
        idArt > 0
            ? `/* cuar:select-stock */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.cantidad_cuarentena, 0)::float8 AS cantidad_cuarentena,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                      a.id_proveedor_principal
               FROM articulos_stock s
               JOIN articulo a ON a.id_articulo = s.id_articulo
               WHERE s.id_articulo = $1
               FOR UPDATE OF s`
            : `/* cuar:select-stock-sku */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.cantidad_cuarentena, 0)::float8 AS cantidad_cuarentena,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                      a.id_proveedor_principal
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

    const dispActual = redondear3(Number(stock.cantidad_disponible));
    const cuarAnterior = redondear3(Number(stock.cantidad_cuarentena));
    const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);

    const validados = validarDatosEgresoCuarentena({
        cantidad: datos.cantidad ?? datos.quantity,
        cuarentenaDisponible: cuarAnterior,
        motivo: datos.motivo ?? datos.reason,
        numeroGuiaDespacho: datos.numero_guia_despacho ?? datos.numero_guia ?? datos.dispatchGuideNumber,
        etiquetaArticulo: `${stock.nombre_articulo} (${stock.sku})`,
    });

    const idProveedorRaw = Number(datos.id_proveedor ?? datos.supplierId ?? stock.id_proveedor_principal ?? 0);
    const idProveedor = Number.isInteger(idProveedorRaw) && idProveedorRaw > 0 ? idProveedorRaw : null;
    const idOrdenCompraRaw = Number(datos.id_orden_compra ?? 0);
    const idOrdenCompra = Number.isInteger(idOrdenCompraRaw) && idOrdenCompraRaw > 0 ? idOrdenCompraRaw : null;

    let nombreProveedor: string | null = null;
    if (idProveedor) {
        const provRes = await cliente.query<{ nombre_proveedor: string }>(
            `/* cuar:select-proveedor */
             SELECT nombre_proveedor FROM proveedor WHERE id_proveedor = $1 LIMIT 1`,
            [idProveedor]
        );
        nombreProveedor = provRes.rows?.[0]?.nombre_proveedor ?? null;
    }

    const cuarNuevo = redondear3(cuarAnterior - validados.cantidad);

    // 1. Descontar EXCLUSIVAMENTE de cantidad_cuarentena (cantidad_disponible no se toca)
    await cliente.query(
        `/* cuar:update-stock-cuarentena */
         UPDATE articulos_stock
         SET cantidad_cuarentena = $2
         WHERE id_articulo = $1`,
        [stock.id_articulo, cuarNuevo]
    );

    // 2. Insertar cabecera de devolución a proveedor en estado 'Pendiente de resolución'
    const insRes = await cliente.query<{ id_devolucion_proveedor: number; codigo_devolucion?: string }>(
        `/* cuar:insert-cabecera */
         INSERT INTO devoluciones_proveedor (
             codigo_devolucion, id_articulo, id_proveedor, id_orden_compra,
             cantidad, motivo, numero_guia_despacho, estado, bodeguero_id
         )
         VALUES (
             'DEV-PROV-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(nextval('seq_codigo_devolucion_proveedor')::text, 5, '0'),
             $1, $2, $3, $4, $5, $6, $7, $8
         )
         RETURNING id_devolucion_proveedor, codigo_devolucion`,
        [
            stock.id_articulo,
            idProveedor,
            idOrdenCompra,
            validados.cantidad,
            validados.motivo,
            validados.numero_guia_despacho,
            ESTADO_DEV_PROVEEDOR_PENDIENTE,
            idBodeguero,
        ]
    );
    const idDevolucionProv = Number(insRes.rows[0].id_devolucion_proveedor);
    const codigoDevolucion =
        insRes.rows[0].codigo_devolucion ||
        `DEV-PROV-${new Date().getFullYear()}-${String(idDevolucionProv).padStart(5, '0')}`;

    // 3. Registrar movimiento de salida desde cuarentena en el Cardex
    const valorTotalCuarentenaRestante = Math.round(cuarNuevo * pmp);
    const referenciaCardex =
        `${codigoDevolucion} | Guía N° ${validados.numero_guia_despacho} | ` +
        `Egreso desde cuarentena a proveedor${nombreProveedor ? ` (${nombreProveedor})` : ''} | ` +
        `Motivo: ${validados.motivo}`;

    const movRes = await cliente.query<{ id_movimiento: number }>(
        `/* cuar:insert-cardex */
         INSERT INTO movimientos_inventario
             (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
              pmp_historico, valor_total_historico, id_orden_compra, referencia, id_usuario)
         VALUES ($1, 'Salida', 'cuarentena', $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id_movimiento`,
        [
            stock.id_articulo,
            validados.cantidad,
            pmp,
            cuarNuevo,
            pmp,
            valorTotalCuarentenaRestante,
            idOrdenCompra,
            referenciaCardex,
            idBodeguero,
        ]
    );
    const idMovimientoCardex = movRes.rows?.[0]?.id_movimiento ?? null;

    await cliente.query(
        `/* cuar:insert-cardex-simple */
         INSERT INTO movimiento_inventario
             (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
              pmp_historico, referencia, id_usuario)
         VALUES ($1, 'Salida', 'cuarentena', $2, $3, $4, $5, $6, $7)`,
        [stock.id_articulo, validados.cantidad, pmp, cuarNuevo, pmp, referenciaCardex, idBodeguero]
    );

    if (idMovimientoCardex) {
        await cliente.query(
            `/* cuar:update-movimiento-cabecera */
             UPDATE devoluciones_proveedor SET id_movimiento_cardex = $2 WHERE id_devolucion_proveedor = $1`,
            [idDevolucionProv, idMovimientoCardex]
        );
    }

    // 4. Notificar al Administrador para seguimiento hasta obtener Nota de crédito o Reposición
    const alertaAdmin = construirAlertaEgresoCuarentenaAdmin({
        codigoDevolucion,
        sku: stock.sku,
        nombreArticulo: stock.nombre_articulo,
        cantidad: validados.cantidad,
        motivo: validados.motivo,
        numeroGuiaDespacho: validados.numero_guia_despacho,
        nombreProveedor,
    });

    await cliente.query(
        `/* cuar:insert-alerta */
         INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('devolucion_proveedor_cuarentena', 'amarillo', $1, $2, $3, $4, FALSE)`,
        [alertaAdmin.titulo, alertaAdmin.descripcion, stock.id_articulo, idOrdenCompra]
    );

    // 5. Auditoría inmutable
    await registrarAuditoria(
        {
            entidad: 'devolucion_proveedor',
            accion: 'egreso_cuarentena',
            idRegistro: idDevolucionProv,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: {
                cantidad_cuarentena: cuarAnterior,
                cantidad_disponible: dispActual,
            },
            estadoNuevo: {
                id_devolucion_proveedor: idDevolucionProv,
                codigo_devolucion: codigoDevolucion,
                cantidad_egresada_cuarentena: validados.cantidad,
                cantidad_cuarentena: cuarNuevo,
                cantidad_disponible: dispActual,
                numero_guia_despacho: validados.numero_guia_despacho,
                motivo: validados.motivo,
                estado: ESTADO_DEV_PROVEEDOR_PENDIENTE,
            },
            descripcion: referenciaCardex,
        },
        cliente
    );

    return {
        id_devolucion_proveedor: idDevolucionProv,
        codigo_devolucion: codigoDevolucion,
        id_articulo: stock.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        id_proveedor: idProveedor,
        nombre_proveedor: nombreProveedor,
        id_orden_compra: idOrdenCompra,
        cantidad: validados.cantidad,
        motivo: validados.motivo,
        numero_guia_despacho: validados.numero_guia_despacho,
        estado: ESTADO_DEV_PROVEEDOR_PENDIENTE,
        tipo_resolucion: null,
        referencia_resolucion: null,
        notas_resolucion: null,
        cuarentena_anterior: cuarAnterior,
        cuarentena_nuevo: cuarNuevo,
        disponible_anterior: dispActual,
        disponible_nuevo: dispActual,
        pmp_unitario: pmp,
        id_movimiento_cardex: idMovimientoCardex,
        id_movimiento_reposicion_cardex: null,
        alerta_administrador: alertaAdmin,
    };
};

/**
 * [BACK-2] Permite al Administrador dar seguimiento y cerrar la devolución a proveedor
 * cambiando su estado de 'Pendiente de resolución' a 'Resuelta' (por 'Nota de crédito', 'Reposición' o 'Reembolso').
 * Si es 'Reposición', reincorpora la cantidad repuesta al stock disponible sano y la registra en el Cardex.
 */
export const resolverDevolucionProveedorEnTransaccion = async (
    cliente: PoolClient,
    idDevolucionProv: number,
    datos: {
        tipo_resolucion?: unknown;
        resolutionType?: unknown;
        referencia_resolucion?: string | null;
        notas_resolucion?: string | null;
        notes?: string | null;
    },
    idAdmin: number | null
): Promise<EgresoCuarentenaRegistrado> => {
    const cabRes = await cliente.query<{
        id_devolucion_proveedor: number;
        codigo_devolucion: string;
        id_articulo: number;
        id_proveedor: number | null;
        id_orden_compra: number | null;
        cantidad: number;
        motivo: string;
        numero_guia_despacho: string;
        estado: string;
        id_movimiento_cardex: number | null;
    }>(
        `/* cuar:select-cabecera */
         SELECT id_devolucion_proveedor, codigo_devolucion, id_articulo, id_proveedor, id_orden_compra,
                cantidad::float8 AS cantidad, motivo, numero_guia_despacho, estado, id_movimiento_cardex
         FROM devoluciones_proveedor
         WHERE id_devolucion_proveedor = $1
         FOR UPDATE`,
        [idDevolucionProv]
    );
    const cab = cabRes.rows?.[0];
    if (!cab) throw new ErrorAplicacion(404, 'Devolución a proveedor no encontrada');
    if (cab.estado !== ESTADO_DEV_PROVEEDOR_PENDIENTE) {
        throw new ErrorAplicacion(409, `La devolución ${cab.codigo_devolucion} ya se encuentra en estado "${cab.estado}"`);
    }

    const tipoResolucion = normalizarTipoResolucionProveedor(datos.tipo_resolucion ?? datos.resolutionType);
    const referenciaRes =
        typeof datos.referencia_resolucion === 'string' && datos.referencia_resolucion.trim()
            ? datos.referencia_resolucion.trim().slice(0, 150)
            : null;
    const notasRes =
        typeof (datos.notas_resolucion ?? datos.notes) === 'string' && String(datos.notas_resolucion ?? datos.notes).trim()
            ? String(datos.notas_resolucion ?? datos.notes).trim().slice(0, 250)
            : null;

    const stockRes = await cliente.query<{
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_disponible: number;
        cantidad_comprometida: number;
        cantidad_cuarentena: number;
        pmp: number;
        precio_unitario: number;
    }>(
        `/* cuar:select-stock */
         SELECT a.id_articulo, a.sku, a.nombre_articulo,
                COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                COALESCE(s.cantidad_cuarentena, 0)::float8 AS cantidad_cuarentena,
                COALESCE(s.pmp, 0)::float8 AS pmp,
                COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario
         FROM articulos_stock s
         JOIN articulo a ON a.id_articulo = s.id_articulo
         WHERE s.id_articulo = $1
         FOR UPDATE OF s`,
        [cab.id_articulo]
    );
    const stock = stockRes.rows[0];
    const dispAnterior = redondear3(Number(stock.cantidad_disponible));
    const compActual = redondear3(Number(stock.cantidad_comprometida));
    const cuarActual = redondear3(Number(stock.cantidad_cuarentena));
    const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
    const cantidad = redondear3(Number(cab.cantidad));

    let dispNuevo = dispAnterior;
    let idMovReposicion: number | null = null;

    if (tipoResolucion === TIPO_RESOLUCION_REPOSICION) {
        dispNuevo = redondear3(dispAnterior + cantidad);
        await cliente.query(
            `/* cuar:update-stock-reposicion */
             UPDATE articulos_stock SET cantidad_disponible = $2 WHERE id_articulo = $1`,
            [cab.id_articulo, dispNuevo]
        );

        const saldoHistorico = redondear3(dispNuevo + compActual);
        const valorTotal = Math.round(saldoHistorico * pmp);
        const refCardex =
            `${cab.codigo_devolucion} | Reposición de proveedor por Guía N° ${cab.numero_guia_despacho}` +
            `${referenciaRes ? ` (${referenciaRes})` : ''}`;

        const movRes = await cliente.query<{ id_movimiento: number }>(
            `/* cuar:insert-cardex-reposicion */
             INSERT INTO movimientos_inventario
                 (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                  pmp_historico, valor_total_historico, id_orden_compra, referencia, id_usuario)
             VALUES ($1, 'Entrada', 'disponible', $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id_movimiento`,
            [cab.id_articulo, cantidad, pmp, saldoHistorico, pmp, valorTotal, cab.id_orden_compra, refCardex, idAdmin]
        );
        idMovReposicion = movRes.rows?.[0]?.id_movimiento ?? null;
    }

    await cliente.query(
        `/* cuar:resolver-cabecera */
         UPDATE devoluciones_proveedor
         SET estado = $2, tipo_resolucion = $3, referencia_resolucion = $4,
             notas_resolucion = $5, id_movimiento_reposicion_cardex = $6,
             admin_resuelve_id = $7, fecha_resolucion = CURRENT_TIMESTAMP
         WHERE id_devolucion_proveedor = $1`,
        [idDevolucionProv, ESTADO_DEV_PROVEEDOR_RESUELTA, tipoResolucion, referenciaRes, notasRes, idMovReposicion, idAdmin]
    );

    await registrarAuditoria(
        {
            entidad: 'devolucion_proveedor',
            accion: 'resolver_devolucion_proveedor',
            idRegistro: idDevolucionProv,
            idUsuarioEjecutor: idAdmin,
            estadoAnterior: { estado: ESTADO_DEV_PROVEEDOR_PENDIENTE, cantidad_disponible: dispAnterior },
            estadoNuevo: {
                estado: ESTADO_DEV_PROVEEDOR_RESUELTA,
                tipo_resolucion: tipoResolucion,
                referencia_resolucion: referenciaRes,
                cantidad_disponible: dispNuevo,
            },
            descripcion: notasRes ?? `Resuelta por ${tipoResolucion}`,
        },
        cliente
    );

    return {
        id_devolucion_proveedor: cab.id_devolucion_proveedor,
        codigo_devolucion: cab.codigo_devolucion,
        id_articulo: cab.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        id_proveedor: cab.id_proveedor,
        nombre_proveedor: null,
        id_orden_compra: cab.id_orden_compra,
        cantidad,
        motivo: cab.motivo,
        numero_guia_despacho: cab.numero_guia_despacho,
        estado: ESTADO_DEV_PROVEEDOR_RESUELTA,
        tipo_resolucion: tipoResolucion,
        referencia_resolucion: referenciaRes,
        notas_resolucion: notasRes,
        cuarentena_anterior: cuarActual,
        cuarentena_nuevo: cuarActual,
        disponible_anterior: dispAnterior,
        disponible_nuevo: dispNuevo,
        pmp_unitario: pmp,
        id_movimiento_cardex: cab.id_movimiento_cardex,
        id_movimiento_reposicion_cardex: idMovReposicion,
        alerta_administrador: null,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const registrarEgresoCuarentena = async (req: Request, res: Response): Promise<void> => {
    try {
        const idBodeguero = obtenerIdEjecutor(req);
        const devolucion = await ejecutarTransaccion((cliente) =>
            registrarEgresoCuarentenaEnTransaccion(cliente, req.body ?? {}, idBodeguero)
        );
        res.status(201).json({
            mensaje: `Egreso desde cuarentena ${devolucion.codigo_devolucion} registrado con Guía N° ${devolucion.numero_guia_despacho}. Administrador notificado para seguimiento.`,
            devolucion,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar el egreso desde cuarentena');
    }
};

export const resolverDevolucionProveedor = async (req: Request, res: Response): Promise<void> => {
    try {
        const idDevolucionProv = Number(req.params.id);
        if (!Number.isInteger(idDevolucionProv) || idDevolucionProv <= 0) {
            throw new ErrorAplicacion(400, 'Identificador de devolución a proveedor inválido');
        }
        const idAdmin = obtenerIdEjecutor(req);
        const devolucion = await ejecutarTransaccion((cliente) =>
            resolverDevolucionProveedorEnTransaccion(cliente, idDevolucionProv, req.body ?? {}, idAdmin)
        );
        res.status(200).json({
            mensaje: `Devolución a proveedor ${devolucion.codigo_devolucion} marcada como Resuelta (${devolucion.tipo_resolucion}).`,
            devolucion,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al resolver la devolución a proveedor');
    }
};

export const listarDevolucionesProveedor = async (req: Request, res: Response): Promise<void> => {
    try {
        const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
        const resultado = await pool.query(
            `SELECT dp.id_devolucion_proveedor, dp.codigo_devolucion, dp.id_articulo,
                    a.sku, a.nombre_articulo, dp.id_proveedor, p.nombre_proveedor,
                    dp.id_orden_compra, dp.cantidad::float8 AS cantidad,
                    dp.motivo, dp.numero_guia_despacho, dp.estado,
                    dp.tipo_resolucion, dp.referencia_resolucion, dp.notas_resolucion,
                    dp.id_movimiento_cardex, dp.id_movimiento_reposicion_cardex,
                    dp.bodeguero_id, dp.admin_resuelve_id,
                    dp.fecha_despacho, dp.fecha_resolucion
             FROM devoluciones_proveedor dp
             JOIN articulo a ON a.id_articulo = dp.id_articulo
             LEFT JOIN proveedor p ON p.id_proveedor = dp.id_proveedor
             WHERE ($1 = '' OR dp.estado = $1)
             ORDER BY dp.id_devolucion_proveedor DESC`,
            [estado]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las devoluciones a proveedor');
    }
};
