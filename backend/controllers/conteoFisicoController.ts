import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import {
    ESTADO_CONTEO_AJUSTADO_DIRECTO,
    ESTADO_CONTEO_APROBADO,
    ESTADO_CONTEO_EN_CURSO,
    ESTADO_CONTEO_PENDIENTE_APROBACION,
    ESTADO_CONTEO_RECHAZADO,
    EstadoConteoFisico,
    UMBRAL_CONTEO_POR_DEFECTO,
    calcularDiferenciaConteo,
    construirAlertaConteoPendienteAdmin,
    normalizarCantidadContada,
} from '../services/conteoFisicoService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export interface RegistroConteoFisico {
    id_conteo: number;
    codigo_conteo: string;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    stock_sistema: number;
    stock_contado: number | null;
    diferencia_cantidad: number | null;
    diferencia_porcentaje: number | null;
    pmp_unitario: number;
    diferencia_valor: number | null;
    umbral_porcentaje: number;
    estado: EstadoConteoFisico;
    bloqueo_activo: boolean;
    requiere_aprobacion_admin: boolean;
    id_movimiento_cardex: number | null;
    alerta_administrador: { titulo: string; descripcion: string } | null;
}

/**
 * [BACK-1] Verifica que un insumo NO esté bloqueado por un conteo físico en curso o pendiente de aprobación.
 * Si está bloqueado, lanza 409 Conflict impidiendo cualquier salida o movimiento de bodega.
 */
export const verificarInsumoNoBloqueadoPorConteo = async (
    cliente: Pick<PoolClient, 'query'>,
    idArticulo: number,
    etiquetaArticulo?: string
): Promise<void> => {
    const res = await cliente.query<{
        bloqueado_por_conteo?: boolean;
        id_conteo_activo?: number | null;
    }>(
        `/* conteo:check-bloqueo */
         SELECT bloqueado_por_conteo, id_conteo_activo
         FROM articulos_stock
         WHERE id_articulo = $1`,
        [idArticulo]
    );
    const fila = res.rows?.[0];
    if (fila?.bloqueado_por_conteo) {
        const refConteo = fila.id_conteo_activo ? ` (conteo #${fila.id_conteo_activo})` : '';
        throw new ErrorAplicacion(
            409,
            `Movimiento bloqueado: el insumo ${etiquetaArticulo ?? `#${idArticulo}`} se encuentra en proceso de conteo físico${refConteo}. No se permiten salidas ni movimientos hasta finalizar o resolver el conteo.`
        );
    }
};

const obtenerUmbralConteoH39 = async (
    cliente: Pick<PoolClient, 'query'>,
    umbralOverride?: number
): Promise<number> => {
    if (umbralOverride !== undefined && Number.isFinite(umbralOverride) && umbralOverride > 0) {
        return Number(umbralOverride);
    }
    const res = await cliente.query<{ valor: number }>(
        `/* conteo:select-umbral */
         SELECT valor FROM parametro_sistema WHERE clave = 'umbral_diferencia_conteo' LIMIT 1`
    );
    const val = Number(res.rows?.[0]?.valor);
    return Number.isFinite(val) && val > 0 ? val : UMBRAL_CONTEO_POR_DEFECTO;
};

const obtenerStockArticuloParaConteo = async (
    cliente: Pick<PoolClient, 'query'>,
    datos: { id_articulo?: number; sku?: string }
) => {
    const idArt = Number(datos.id_articulo ?? 0);
    const sku = typeof datos.sku === 'string' ? datos.sku.trim() : '';
    if ((!Number.isInteger(idArt) || idArt <= 0) && !sku) {
        throw new ErrorAplicacion(400, 'Debe indicar id_articulo o sku del insumo a contar');
    }

    const stockRes = await cliente.query<{
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_disponible: number;
        cantidad_comprometida: number;
        pmp: number;
        precio_unitario: number;
        bloqueado_por_conteo: boolean;
        id_conteo_activo: number | null;
    }>(
        idArt > 0
            ? `/* conteo:select-stock */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                      COALESCE(s.bloqueado_por_conteo, FALSE) AS bloqueado_por_conteo,
                      s.id_conteo_activo
               FROM articulos_stock s
               JOIN articulo a ON a.id_articulo = s.id_articulo
               WHERE s.id_articulo = $1
               FOR UPDATE OF s`
            : `/* conteo:select-stock-sku */
               SELECT a.id_articulo, a.sku, a.nombre_articulo,
                      COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                      COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                      COALESCE(s.pmp, 0)::float8 AS pmp,
                      COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                      COALESCE(s.bloqueado_por_conteo, FALSE) AS bloqueado_por_conteo,
                      s.id_conteo_activo
               FROM articulos_stock s
               JOIN articulo a ON a.id_articulo = s.id_articulo
               WHERE UPPER(TRIM(a.sku)) = UPPER(TRIM($1))
               FOR UPDATE OF s`,
        [idArt > 0 ? idArt : sku]
    );

    const stock = stockRes.rows?.[0];
    if (!stock) {
        throw new ErrorAplicacion(404, 'Insumo no encontrado en el registro de stock');
    }
    return stock;
};

/**
 * [BACK-1] Paso 1: Inicia una sesión de conteo físico sobre un insumo y bloquea todos sus movimientos.
 */
export const iniciarConteoFisicoEnTransaccion = async (
    cliente: PoolClient,
    datos: { id_articulo?: number; sku?: string; observaciones?: string | null },
    idBodeguero: number | null
): Promise<RegistroConteoFisico> => {
    const stock = await obtenerStockArticuloParaConteo(cliente, datos);
    if (stock.bloqueado_por_conteo) {
        throw new ErrorAplicacion(
            409,
            `El insumo ${stock.nombre_articulo} (${stock.sku}) ya tiene un conteo físico activo (#${stock.id_conteo_activo ?? ''})`
        );
    }

    const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
    const umbral = await obtenerUmbralConteoH39(cliente);
    const observaciones =
        typeof datos.observaciones === 'string' && datos.observaciones.trim()
            ? datos.observaciones.trim().slice(0, 250)
            : null;

    const insRes = await cliente.query<{ id_conteo: number; codigo_conteo?: string }>(
        `/* conteo:insert-inicio */
         INSERT INTO conteos_fisicos (
             codigo_conteo, id_articulo, stock_sistema, pmp_unitario, umbral_porcentaje,
             estado, bloqueo_activo, observaciones, bodeguero_id
         )
         VALUES (
             'CNT-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(nextval('seq_codigo_conteo')::text, 5, '0'),
             $1, $2, $3, $4, $5, TRUE, $6, $7
         )
         RETURNING id_conteo, codigo_conteo`,
        [stock.id_articulo, Number(stock.cantidad_disponible), pmp, umbral, ESTADO_CONTEO_EN_CURSO, observaciones, idBodeguero]
    );
    const idConteo = Number(insRes.rows[0].id_conteo);
    const codigoConteo = insRes.rows[0].codigo_conteo || `CNT-${new Date().getFullYear()}-${String(idConteo).padStart(5, '0')}`;

    await cliente.query(
        `/* conteo:bloquear-stock */
         UPDATE articulos_stock
         SET bloqueado_por_conteo = TRUE, id_conteo_activo = $2
         WHERE id_articulo = $1`,
        [stock.id_articulo, idConteo]
    );

    await registrarAuditoria(
        {
            entidad: 'conteo_fisico',
            accion: 'iniciar_conteo',
            idRegistro: idConteo,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { bloqueado_por_conteo: false, stock_sistema: Number(stock.cantidad_disponible) },
            estadoNuevo: {
                id_conteo: idConteo,
                codigo_conteo: codigoConteo,
                estado: ESTADO_CONTEO_EN_CURSO,
                bloqueado_por_conteo: true,
            },
            descripcion: `Iniciado conteo físico ${codigoConteo} para ${stock.sku}. Movimientos bloqueados.`,
        },
        cliente
    );

    return {
        id_conteo: idConteo,
        codigo_conteo: codigoConteo,
        id_articulo: stock.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        stock_sistema: Number(stock.cantidad_disponible),
        stock_contado: null,
        diferencia_cantidad: null,
        diferencia_porcentaje: null,
        pmp_unitario: pmp,
        diferencia_valor: null,
        umbral_porcentaje: umbral,
        estado: ESTADO_CONTEO_EN_CURSO,
        bloqueo_activo: true,
        requiere_aprobacion_admin: false,
        id_movimiento_cardex: null,
        alerta_administrador: null,
    };
};

/**
 * [BACK-1] Registra la cantidad física contada (sobre un conteo ya iniciado en estado 'En conteo',
 * o iniciando y registrando en un solo paso).
 * - Si |diferencia_%| <= umbral (5 % por defecto en H39): ajusta stock disponible y Cardex directamente y libera el bloqueo.
 * - Si |diferencia_%| > umbral: deja el ajuste en 'Pendiente aprobación' del Administrador, manteniendo bloqueado el insumo.
 */
export const registrarConteoFisicoEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        id_conteo?: number;
        id_articulo?: number;
        sku?: string;
        stock_contado?: unknown;
        cantidad_contada?: unknown;
        countedStock?: unknown;
        umbral_porcentaje?: number;
        observaciones?: string | null;
        notes?: string | null;
    },
    idBodeguero: number | null
): Promise<RegistroConteoFisico> => {
    const rawContado = datos.stock_contado ?? datos.cantidad_contada ?? datos.countedStock;
    const stockContado = normalizarCantidadContada(rawContado);
    const observaciones =
        typeof (datos.observaciones ?? datos.notes) === 'string' && String(datos.observaciones ?? datos.notes).trim()
            ? String(datos.observaciones ?? datos.notes).trim().slice(0, 250)
            : null;

    let idConteo = Number(datos.id_conteo ?? 0);
    let codigoConteo = '';
    let idArticulo = Number(datos.id_articulo ?? 0);

    if (idConteo > 0) {
        const cabRes = await cliente.query<{
            id_conteo: number;
            codigo_conteo: string;
            id_articulo: number;
            estado: string;
        }>(
            `/* conteo:select-cabecera */
             SELECT id_conteo, codigo_conteo, id_articulo, estado
             FROM conteos_fisicos
             WHERE id_conteo = $1
             FOR UPDATE`,
            [idConteo]
        );
        const cab = cabRes.rows?.[0];
        if (!cab) throw new ErrorAplicacion(404, 'Sesión de conteo físico no encontrada');
        if (cab.estado !== ESTADO_CONTEO_EN_CURSO) {
            throw new ErrorAplicacion(409, `El conteo ${cab.codigo_conteo} ya fue procesado (estado: ${cab.estado})`);
        }
        codigoConteo = cab.codigo_conteo;
        idArticulo = cab.id_articulo;
    }

    const stock = await obtenerStockArticuloParaConteo(cliente, { id_articulo: idArticulo, sku: datos.sku });

    // Si no venía id_conteo pero el insumo ya tiene un conteo 'En conteo', lo usamos; si tiene uno 'Pendiente aprobación', bloqueamos
    if (idConteo <= 0 && stock.bloqueado_por_conteo) {
        if (stock.id_conteo_activo) {
            const activoRes = await cliente.query<{
                id_conteo: number;
                codigo_conteo: string;
                estado: string;
            }>(
                `/* conteo:select-cabecera */
                 SELECT id_conteo, codigo_conteo, id_articulo, estado
                 FROM conteos_fisicos
                 WHERE id_conteo = $1
                 FOR UPDATE`,
                [stock.id_conteo_activo]
            );
            const activo = activoRes.rows?.[0];
            if (activo && activo.estado === ESTADO_CONTEO_EN_CURSO) {
                idConteo = activo.id_conteo;
                codigoConteo = activo.codigo_conteo;
            } else {
                throw new ErrorAplicacion(
                    409,
                    `El insumo ${stock.nombre_articulo} (${stock.sku}) se encuentra bloqueado por un conteo pendiente de aprobación del Administrador`
                );
            }
        } else {
            throw new ErrorAplicacion(
                409,
                `El insumo ${stock.nombre_articulo} (${stock.sku}) se encuentra bloqueado por un conteo físico activo`
            );
        }
    }

    const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
    const umbral = await obtenerUmbralConteoH39(cliente, datos.umbral_porcentaje);

    const calculo = calcularDiferenciaConteo({
        stockSistema: Number(stock.cantidad_disponible),
        stockContado,
        pmpUnitario: pmp,
        umbralPorcentaje: umbral,
    });

    if (idConteo <= 0) {
        const insRes = await cliente.query<{ id_conteo: number; codigo_conteo?: string }>(
            `/* conteo:insert-cabecera */
             INSERT INTO conteos_fisicos (
                 codigo_conteo, id_articulo, stock_sistema, stock_contado, diferencia_cantidad,
                 diferencia_porcentaje, pmp_unitario, diferencia_valor, umbral_porcentaje,
                 estado, bloqueo_activo, observaciones, bodeguero_id, fecha_conteo
             )
             VALUES (
                 'CNT-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(nextval('seq_codigo_conteo')::text, 5, '0'),
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP
             )
             RETURNING id_conteo, codigo_conteo`,
            [
                stock.id_articulo,
                calculo.stock_sistema,
                calculo.stock_contado,
                calculo.diferencia_cantidad,
                calculo.diferencia_porcentaje,
                calculo.pmp_unitario,
                calculo.diferencia_valor,
                calculo.umbral_porcentaje,
                calculo.estado_resultante,
                calculo.requiere_aprobacion_admin,
                observaciones,
                idBodeguero,
            ]
        );
        idConteo = Number(insRes.rows[0].id_conteo);
        codigoConteo = insRes.rows[0].codigo_conteo || `CNT-${new Date().getFullYear()}-${String(idConteo).padStart(5, '0')}`;
    }

    let idMovimientoCardex: number | null = null;
    let alertaAdmin: { titulo: string; descripcion: string } | null = null;

    if (!calculo.requiere_aprobacion_admin) {
        // Caso 1: |diferencia_%| <= umbral (5% por defecto) -> Ajuste directo en stock y Cardex, libera bloqueo
        await cliente.query(
            `/* conteo:update-stock-directo */
             UPDATE articulos_stock
             SET cantidad_disponible = $2, bloqueado_por_conteo = FALSE, id_conteo_activo = NULL
             WHERE id_articulo = $1`,
            [stock.id_articulo, calculo.stock_contado]
        );

        if (calculo.diferencia_cantidad !== 0) {
            const comprometido = Number(stock.cantidad_comprometida);
            const saldoHistorico = Number((calculo.stock_contado + comprometido).toFixed(3));
            const valorTotal = Math.round(saldoHistorico * pmp);
            const signo = calculo.diferencia_cantidad > 0 ? '+' : '';
            const referencia =
                `${codigoConteo} | Ajuste directo por conteo físico (${signo}${calculo.diferencia_porcentaje}% <= ${calculo.umbral_porcentaje}%) | ` +
                `Sistema: ${calculo.stock_sistema} -> Contado: ${calculo.stock_contado} (${signo}${calculo.diferencia_cantidad})`;

            const movRes = await cliente.query<{ id_movimiento: number }>(
                `/* conteo:insert-cardex */
                 INSERT INTO movimientos_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, 'Ajuste', 'disponible', $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_movimiento`,
                [
                    stock.id_articulo,
                    Math.abs(calculo.diferencia_cantidad),
                    pmp,
                    saldoHistorico,
                    pmp,
                    valorTotal,
                    referencia,
                    idBodeguero,
                ]
            );
            idMovimientoCardex = movRes.rows?.[0]?.id_movimiento ?? null;

            await cliente.query(
                `/* conteo:insert-cardex-simple */
                 INSERT INTO movimiento_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, referencia, id_usuario)
                 VALUES ($1, 'Ajuste', 'disponible', $2, $3, $4, $5, $6, $7)`,
                [
                    stock.id_articulo,
                    Math.abs(calculo.diferencia_cantidad),
                    pmp,
                    saldoHistorico,
                    pmp,
                    referencia,
                    idBodeguero,
                ]
            );
        }

        await cliente.query(
            `/* conteo:update-cabecera */
             UPDATE conteos_fisicos
             SET stock_sistema = $2, stock_contado = $3, diferencia_cantidad = $4,
                 diferencia_porcentaje = $5, pmp_unitario = $6, diferencia_valor = $7,
                 umbral_porcentaje = $8, estado = $9, bloqueo_activo = FALSE,
                 id_movimiento_cardex = $10, observaciones = COALESCE($11, observaciones),
                 fecha_conteo = CURRENT_TIMESTAMP, fecha_resolucion = CURRENT_TIMESTAMP
             WHERE id_conteo = $1`,
            [
                idConteo,
                calculo.stock_sistema,
                calculo.stock_contado,
                calculo.diferencia_cantidad,
                calculo.diferencia_porcentaje,
                calculo.pmp_unitario,
                calculo.diferencia_valor,
                calculo.umbral_porcentaje,
                ESTADO_CONTEO_AJUSTADO_DIRECTO,
                idMovimientoCardex,
                observaciones,
            ]
        );
    } else {
        // Caso 2: |diferencia_%| > umbral -> Pasa a aprobación del Administrador y MANTIENE bloqueado el insumo
        await cliente.query(
            `/* conteo:bloquear-stock */
             UPDATE articulos_stock
             SET bloqueado_por_conteo = TRUE, id_conteo_activo = $2
             WHERE id_articulo = $1`,
            [stock.id_articulo, idConteo]
        );

        await cliente.query(
            `/* conteo:update-cabecera */
             UPDATE conteos_fisicos
             SET stock_sistema = $2, stock_contado = $3, diferencia_cantidad = $4,
                 diferencia_porcentaje = $5, pmp_unitario = $6, diferencia_valor = $7,
                 umbral_porcentaje = $8, estado = $9, bloqueo_activo = TRUE,
                 observaciones = COALESCE($10, observaciones), fecha_conteo = CURRENT_TIMESTAMP
             WHERE id_conteo = $1`,
            [
                idConteo,
                calculo.stock_sistema,
                calculo.stock_contado,
                calculo.diferencia_cantidad,
                calculo.diferencia_porcentaje,
                calculo.pmp_unitario,
                calculo.diferencia_valor,
                calculo.umbral_porcentaje,
                ESTADO_CONTEO_PENDIENTE_APROBACION,
                observaciones,
            ]
        );

        alertaAdmin = construirAlertaConteoPendienteAdmin({
            codigoConteo,
            sku: stock.sku,
            nombreArticulo: stock.nombre_articulo,
            stockSistema: calculo.stock_sistema,
            stockContado: calculo.stock_contado,
            diferenciaCantidad: calculo.diferencia_cantidad,
            diferenciaPorcentaje: calculo.diferencia_porcentaje,
            diferenciaValor: calculo.diferencia_valor,
            umbralPorcentaje: calculo.umbral_porcentaje,
        });

        await cliente.query(
            `/* conteo:insert-alerta */
             INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('conteo_pendiente_aprobacion', 'amarillo', $1, $2, $3, NULL, FALSE)`,
            [alertaAdmin.titulo, alertaAdmin.descripcion, stock.id_articulo]
        );
    }

    await registrarAuditoria(
        {
            entidad: 'conteo_fisico',
            accion: calculo.requiere_aprobacion_admin ? 'retener_conteo_admin' : 'ajuste_directo_conteo',
            idRegistro: idConteo,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { stock_disponible: calculo.stock_sistema },
            estadoNuevo: {
                id_conteo: idConteo,
                codigo_conteo: codigoConteo,
                stock_contado: calculo.stock_contado,
                diferencia_cantidad: calculo.diferencia_cantidad,
                diferencia_porcentaje: calculo.diferencia_porcentaje,
                diferencia_valor: calculo.diferencia_valor,
                estado: calculo.estado_resultante,
                bloqueo_activo: calculo.requiere_aprobacion_admin,
            },
            descripcion: observaciones ?? undefined,
        },
        cliente
    );

    return {
        id_conteo: idConteo,
        codigo_conteo: codigoConteo,
        id_articulo: stock.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        stock_sistema: calculo.stock_sistema,
        stock_contado: calculo.stock_contado,
        diferencia_cantidad: calculo.diferencia_cantidad,
        diferencia_porcentaje: calculo.diferencia_porcentaje,
        pmp_unitario: calculo.pmp_unitario,
        diferencia_valor: calculo.diferencia_valor,
        umbral_porcentaje: calculo.umbral_porcentaje,
        estado: calculo.estado_resultante,
        bloqueo_activo: calculo.requiere_aprobacion_admin,
        requiere_aprobacion_admin: calculo.requiere_aprobacion_admin,
        id_movimiento_cardex: idMovimientoCardex,
        alerta_administrador: alertaAdmin,
    };
};

/**
 * [BACK-1] Resolución del Administrador sobre un conteo físico retenido (> umbral H39).
 * - Si aprueba: aplica el ajuste al stock disponible, genera movimiento en Cardex y desbloquea el insumo.
 * - Si rechaza: mantiene el stock original del sistema sin tocar Cardex y desbloquea el insumo.
 */
export const resolverConteoPendienteAdminEnTransaccion = async (
    cliente: PoolClient,
    idConteo: number,
    datos: { accion?: string; decision?: string; aprobar?: boolean; motivo_rechazo?: string | null },
    idAdmin: number | null
): Promise<RegistroConteoFisico> => {
    const cabRes = await cliente.query<{
        id_conteo: number;
        codigo_conteo: string;
        id_articulo: number;
        stock_sistema: number;
        stock_contado: number;
        diferencia_cantidad: number;
        diferencia_porcentaje: number;
        pmp_unitario: number;
        diferencia_valor: number;
        umbral_porcentaje: number;
        estado: string;
    }>(
        `/* conteo:select-cabecera-admin */
         SELECT id_conteo, codigo_conteo, id_articulo,
                stock_sistema::float8 AS stock_sistema,
                stock_contado::float8 AS stock_contado,
                diferencia_cantidad::float8 AS diferencia_cantidad,
                diferencia_porcentaje::float8 AS diferencia_porcentaje,
                pmp_unitario::float8 AS pmp_unitario,
                diferencia_valor::bigint AS diferencia_valor,
                umbral_porcentaje::float8 AS umbral_porcentaje,
                estado
         FROM conteos_fisicos
         WHERE id_conteo = $1
         FOR UPDATE`,
        [idConteo]
    );
    const cab = cabRes.rows?.[0];
    if (!cab) throw new ErrorAplicacion(404, 'Conteo físico no encontrado');
    if (cab.estado !== ESTADO_CONTEO_PENDIENTE_APROBACION) {
        throw new ErrorAplicacion(409, `El conteo ${cab.codigo_conteo} no está pendiente de aprobación (estado actual: ${cab.estado})`);
    }

    const stock = await obtenerStockArticuloParaConteo(cliente, { id_articulo: cab.id_articulo });
    const rawDecision = String(datos.accion ?? datos.decision ?? (datos.aprobar === false ? 'rechazar' : 'aprobar')).trim().toLowerCase();
    const esAprobacion = rawDecision === 'aprobar' || rawDecision === 'aprobado' || rawDecision === 'approve';

    let idMovimientoCardex: number | null = null;
    const nuevoEstado: EstadoConteoFisico = esAprobacion ? ESTADO_CONTEO_APROBADO : ESTADO_CONTEO_RECHAZADO;

    if (esAprobacion) {
        const pmp = Number(cab.pmp_unitario) > 0 ? Number(cab.pmp_unitario) : Number(stock.pmp) || Number(stock.precio_unitario);
        const stockContado = Number(cab.stock_contado);
        const difCantidad = Number(cab.diferencia_cantidad);

        await cliente.query(
            `/* conteo:update-stock-directo */
             UPDATE articulos_stock
             SET cantidad_disponible = $2, bloqueado_por_conteo = FALSE, id_conteo_activo = NULL
             WHERE id_articulo = $1`,
            [cab.id_articulo, stockContado]
        );

        if (difCantidad !== 0) {
            const comprometido = Number(stock.cantidad_comprometida);
            const saldoHistorico = Number((stockContado + comprometido).toFixed(3));
            const valorTotal = Math.round(saldoHistorico * pmp);
            const signo = difCantidad > 0 ? '+' : '';
            const referencia =
                `${cab.codigo_conteo} | Ajuste por conteo físico aprobado por Admin (${signo}${cab.diferencia_porcentaje}%) | ` +
                `Sistema: ${cab.stock_sistema} -> Contado: ${stockContado}`;

            const movRes = await cliente.query<{ id_movimiento: number }>(
                `/* conteo:insert-cardex */
                 INSERT INTO movimientos_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, 'Ajuste', 'disponible', $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_movimiento`,
                [cab.id_articulo, Math.abs(difCantidad), pmp, saldoHistorico, pmp, valorTotal, referencia, idAdmin]
            );
            idMovimientoCardex = movRes.rows?.[0]?.id_movimiento ?? null;

            await cliente.query(
                `/* conteo:insert-cardex-simple */
                 INSERT INTO movimiento_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, referencia, id_usuario)
                 VALUES ($1, 'Ajuste', 'disponible', $2, $3, $4, $5, $6, $7)`,
                [cab.id_articulo, Math.abs(difCantidad), pmp, saldoHistorico, pmp, referencia, idAdmin]
            );
        }

        await cliente.query(
            `/* conteo:resolver-cabecera */
             UPDATE conteos_fisicos
             SET estado = $2, bloqueo_activo = FALSE, aprobador_id = $3,
                 id_movimiento_cardex = $4, fecha_resolucion = CURRENT_TIMESTAMP
             WHERE id_conteo = $1`,
            [idConteo, ESTADO_CONTEO_APROBADO, idAdmin, idMovimientoCardex]
        );
    } else {
        const motivo = typeof datos.motivo_rechazo === 'string' ? datos.motivo_rechazo.trim() : '';
        if (!motivo) {
            throw new ErrorAplicacion(400, 'Debe indicar el motivo de rechazo del conteo físico');
        }

        await cliente.query(
            `/* conteo:desbloquear-stock */
             UPDATE articulos_stock
             SET bloqueado_por_conteo = FALSE, id_conteo_activo = NULL
             WHERE id_articulo = $1`,
            [cab.id_articulo]
        );

        await cliente.query(
            `/* conteo:resolver-cabecera */
             UPDATE conteos_fisicos
             SET estado = $2, bloqueo_activo = FALSE, aprobador_id = $3,
                 motivo_rechazo = $4, fecha_resolucion = CURRENT_TIMESTAMP
             WHERE id_conteo = $1`,
            [idConteo, ESTADO_CONTEO_RECHAZADO, idAdmin, motivo.slice(0, 250)]
        );
    }

    await registrarAuditoria(
        {
            entidad: 'conteo_fisico',
            accion: esAprobacion ? 'aprobar_conteo' : 'rechazar_conteo',
            idRegistro: idConteo,
            idUsuarioEjecutor: idAdmin,
            estadoAnterior: { estado: ESTADO_CONTEO_PENDIENTE_APROBACION, stock_disponible: Number(cab.stock_sistema) },
            estadoNuevo: {
                estado: nuevoEstado,
                stock_disponible: esAprobacion ? Number(cab.stock_contado) : Number(cab.stock_sistema),
                bloqueo_activo: false,
            },
            descripcion: esAprobacion
                ? `Conteo ${cab.codigo_conteo} aprobado por Administrador`
                : `Conteo ${cab.codigo_conteo} rechazado por Administrador`,
        },
        cliente
    );

    return {
        id_conteo: cab.id_conteo,
        codigo_conteo: cab.codigo_conteo,
        id_articulo: cab.id_articulo,
        sku: stock.sku,
        nombre_articulo: stock.nombre_articulo,
        stock_sistema: Number(cab.stock_sistema),
        stock_contado: Number(cab.stock_contado),
        diferencia_cantidad: Number(cab.diferencia_cantidad),
        diferencia_porcentaje: Number(cab.diferencia_porcentaje),
        pmp_unitario: Number(cab.pmp_unitario),
        diferencia_valor: Number(cab.diferencia_valor),
        umbral_porcentaje: Number(cab.umbral_porcentaje),
        estado: nuevoEstado,
        bloqueo_activo: false,
        requiere_aprobacion_admin: false,
        id_movimiento_cardex: idMovimientoCardex,
        alerta_administrador: null,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const iniciarConteoFisico = async (req: Request, res: Response): Promise<void> => {
    try {
        const idBodeguero = obtenerIdEjecutor(req);
        const conteo = await ejecutarTransaccion((cliente) =>
            iniciarConteoFisicoEnTransaccion(cliente, req.body ?? {}, idBodeguero)
        );
        res.status(201).json({
            mensaje: `Conteo físico ${conteo.codigo_conteo} iniciado. Los movimientos del insumo ${conteo.sku} han sido bloqueados.`,
            conteo,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al iniciar el conteo físico');
    }
};

export const registrarConteoFisico = async (req: Request, res: Response): Promise<void> => {
    try {
        const idBodeguero = obtenerIdEjecutor(req);
        const idConteoParam = req.params.id ? Number(req.params.id) : undefined;
        const tieneCantidad =
            req.body?.stock_contado !== undefined ||
            req.body?.cantidad_contada !== undefined ||
            req.body?.countedStock !== undefined;

        if (!tieneCantidad && !idConteoParam) {
            const conteo = await ejecutarTransaccion((cliente) =>
                iniciarConteoFisicoEnTransaccion(cliente, req.body ?? {}, idBodeguero)
            );
            res.status(201).json({
                mensaje: `Conteo físico ${conteo.codigo_conteo} iniciado. Los movimientos del insumo ${conteo.sku} han sido bloqueados.`,
                conteo,
            });
            return;
        }

        const conteo = await ejecutarTransaccion((cliente) =>
            registrarConteoFisicoEnTransaccion(
                cliente,
                { ...(req.body ?? {}), ...(idConteoParam ? { id_conteo: idConteoParam } : {}) },
                idBodeguero
            )
        );

        const mensaje = conteo.requiere_aprobacion_admin
            ? `Conteo ${conteo.codigo_conteo} retenido: la diferencia de ${conteo.diferencia_porcentaje}% supera el umbral de ${conteo.umbral_porcentaje}% (H39). Pendiente de aprobación del Administrador.`
            : `Conteo ${conteo.codigo_conteo} aplicado directamente (${conteo.diferencia_porcentaje}% <= ${conteo.umbral_porcentaje}%). Stock y Cardex actualizados.`;

        res.status(201).json({ mensaje, conteo });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar el conteo físico');
    }
};

export const resolverConteoFisicoAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const idConteo = Number(req.params.id);
        if (!Number.isInteger(idConteo) || idConteo <= 0) {
            throw new ErrorAplicacion(400, 'Identificador de conteo inválido');
        }
        const idAdmin = obtenerIdEjecutor(req);
        const accionRuta = req.path.endsWith('/aprobar')
            ? 'aprobar'
            : req.path.endsWith('/rechazar')
              ? 'rechazar'
              : undefined;

        const conteo = await ejecutarTransaccion((cliente) =>
            resolverConteoPendienteAdminEnTransaccion(
                cliente,
                idConteo,
                { ...(req.body ?? {}), ...(accionRuta ? { accion: accionRuta } : {}) },
                idAdmin
            )
        );

        res.status(200).json({
            mensaje:
                conteo.estado === ESTADO_CONTEO_APROBADO
                    ? `Conteo ${conteo.codigo_conteo} aprobado. Stock y Cardex actualizados.`
                    : `Conteo ${conteo.codigo_conteo} rechazado. El insumo fue desbloqueado sin alterar el stock.`,
            conteo,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al resolver el conteo físico');
    }
};

export const listarConteosFisicos = async (req: Request, res: Response): Promise<void> => {
    try {
        const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
        const resultado = await pool.query(
            `SELECT c.id_conteo, c.codigo_conteo, c.id_articulo, a.sku, a.nombre_articulo,
                    c.stock_sistema::float8 AS stock_sistema,
                    c.stock_contado::float8 AS stock_contado,
                    c.diferencia_cantidad::float8 AS diferencia_cantidad,
                    c.diferencia_porcentaje::float8 AS diferencia_porcentaje,
                    c.pmp_unitario::float8 AS pmp_unitario,
                    c.diferencia_valor::bigint AS diferencia_valor,
                    c.umbral_porcentaje::float8 AS umbral_porcentaje,
                    c.estado, c.bloqueo_activo, c.observaciones, c.motivo_rechazo,
                    c.bodeguero_id, c.aprobador_id, c.id_movimiento_cardex,
                    c.fecha_inicio, c.fecha_conteo, c.fecha_resolucion
             FROM conteos_fisicos c
             JOIN articulo a ON a.id_articulo = c.id_articulo
             WHERE ($1 = '' OR c.estado = $1)
             ORDER BY c.id_conteo DESC`,
            [estado]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar los conteos físicos');
    }
};
