import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { enviarCorreo } from '../services/correo';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import {
    DatosPdfOrdenCompra,
    construirCorreoOrdenCompra,
    generarPdfOrdenCompra,
} from '../services/ocPdfService';
import {
    AlertaReposicionH40,
    detectarInsumosBajoMinimoSinOcAbierta,
    ejecutarMotorReposicionCatalogo,
    evaluarReposicionArticuloEnTransaccion,
} from '../services/motorReposicionService';
import {
    LineaFacturaCascadaInput,
    OrdenCompraRecepcionReferencia,
    calcularPmpExactoSinErrorRedondeo,
    calcularTotalesFacturaCascada,
    detectarDiscrepanciasFacturaConRecepcion,
} from '../services/facturaCalculoService';
import { ejecutarTransaccion } from '../services/transaccion';

export const ESTADOS_OC = [
    'Borrador',
    'Enviada',
    'Recibida parcial',
    'Recibida',
    'Cerrada',
    'Anulada',
] as const;

export type EstadoOrdenCompra = (typeof ESTADOS_OC)[number];

/**
 * Matriz oficial de transiciones de estado válidas para una Orden de Compra [BACK-2].
 */
export const TRANSICIONES_VALIDAS_OC: Record<EstadoOrdenCompra, readonly EstadoOrdenCompra[]> = {
    Borrador: ['Enviada', 'Anulada'],
    Enviada: ['Recibida parcial', 'Recibida', 'Anulada'],
    'Recibida parcial': ['Recibida parcial', 'Recibida', 'Cerrada'],
    Recibida: ['Cerrada'],
    Cerrada: [],
    Anulada: [],
};

/**
 * [BACK-2] Valida si una OC en `estadoActual` puede ser editada (cabecera o cantidades de insumos).
 * Devuelve `null` si es editable (solo en 'Borrador') o el mensaje de error si debe bloquearse.
 */
export const validarEdicionOrdenCompra = (estadoActual: string): string | null => {
    if (estadoActual === 'Borrador') {
        return null;
    }
    return `No se puede editar ni modificar cantidades de una orden de compra en estado '${estadoActual}'. Solo es editable mientras esté en estado Borrador.`;
};

/**
 * [BACK-2] Valida si la transición desde `estadoActual` hacia `nuevoEstado` está permitida.
 * Devuelve `null` si la transición es válida o el mensaje de error si es inválida.
 */
export const validarTransicionEstadoOc = (
    estadoActual: EstadoOrdenCompra,
    nuevoEstado: EstadoOrdenCompra
): string | null => {
    const permitidos = TRANSICIONES_VALIDAS_OC[estadoActual] ?? [];
    if (permitidos.includes(nuevoEstado)) {
        return null;
    }
    if (permitidos.length === 0) {
        return `La orden de compra se encuentra en estado terminal '${estadoActual}' y no admite más cambios de estado.`;
    }
    return `Transición de estado inválida: no se puede pasar de '${estadoActual}' a '${nuevoEstado}'. Transiciones permitidas desde '${estadoActual}': ${permitidos.join(', ')}.`;
};

export interface LineaOrdenCompraInput {
    id_articulo?: number;
    sku?: string;
    cantidad_orden?: number;
    quantity?: number;
    precio_unitario?: number;
    unitPrice?: number;
}

export interface OrdenCompraBody {
    proveedor_id?: number;
    origen?: string;
    fecha_estimada_oc?: string | null;
    observaciones?: string | null;
    lineas?: LineaOrdenCompraInput[];
    items?: LineaOrdenCompraInput[];
    aprobar_inmediatamente?: boolean;
    correo_destino?: string;
}

export interface LineaOrdenCompraDetalle {
    id_oc_linea: number;
    id_orden_compra: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    unidad: string;
    cantidad_orden: number;
    precio_unitario: number;
    subtotal_linea: number;
    cantidad_recibida: number;
    cantidad_defectuosa?: number;
    saldo_pendiente?: number;
}

export interface OrdenCompraCompleta {
    id_orden_compra: number;
    numero_oc: string;
    proveedor_id: number;
    nombre_proveedor: string;
    razon_social_proveedor: string | null;
    rut_proveedor: string;
    correo_proveedor: string | null;
    telefono_proveedor: string | null;
    direccion_proveedor: string | null;
    estado: EstadoOrdenCompra;
    origen: string;
    fecha_estimada_oc: string | null;
    fecha_creacion: string;
    observaciones: string | null;
    fecha_aprobacion: string | null;
    id_usuario_aprobador: number | null;
    correo_enviado_a: string | null;
    fecha_envio_correo: string | null;
    lineas: LineaOrdenCompraDetalle[];
    subtotal_neto: number;
    iva: number;
    total: number;
}

const normalizarEstadoOc = (valor: unknown): EstadoOrdenCompra | null => {
    if (typeof valor !== 'string') return null;
    const limpio = valor.trim().toLowerCase().replace(/_/g, ' ');
    for (const est of ESTADOS_OC) {
        if (est.toLowerCase() === limpio) return est;
    }
    return null;
};

/**
 * Obtiene el siguiente número correlativo único OC-YYYY-NNNNN sincronizando seq_numero_oc.
 */
export const generarSiguienteNumeroOc = async (cliente: PoolClient): Promise<string> => {
    const anio = new Date().getFullYear();
    await cliente.query(`
        DO $$
        DECLARE
            max_corr INT;
        BEGIN
            SELECT COALESCE(MAX(
                NULLIF(REGEXP_REPLACE(numero_oc, '^OC-\\d{4}-(\\d+)$', '\\1'), numero_oc)::INT
            ), 0)
            INTO max_corr
            FROM ordenes_compra
            WHERE numero_oc ~ '^OC-\\d{4}-\\d+$';

            IF max_corr > 0 THEN
                PERFORM setval('seq_numero_oc', GREATEST(max_corr, (SELECT last_value FROM seq_numero_oc)), true);
            END IF;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END $$;
    `);

    for (let intento = 0; intento < 20; intento++) {
        const seqRes = await cliente.query<{ siguiente: string }>(
            `SELECT ('OC-' || $1::text || '-' || LPAD(NEXTVAL('seq_numero_oc')::TEXT, 5, '0')) AS siguiente`,
            [String(anio)]
        );
        const candidato = seqRes.rows[0].siguiente;
        const existe = await cliente.query(
            'SELECT 1 FROM ordenes_compra WHERE numero_oc = $1',
            [candidato]
        );
        if (existe.rows.length === 0) {
            return candidato;
        }
    }
    throw new ErrorAplicacion(500, 'No fue posible generar un número correlativo único para la OC');
};

/**
 * Resuelve y valida las líneas de insumos enviadas en el cuerpo (por id_articulo o por sku).
 */
const resolverLineasEntrada = async (
    cliente: PoolClient,
    lineasRaw: LineaOrdenCompraInput[] | undefined
): Promise<{ id_articulo: number; cantidad_orden: number; precio_unitario: number }[]> => {
    if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
        throw new ErrorAplicacion(400, 'La orden de compra debe incluir al menos un insumo');
    }

    const resueltas: { id_articulo: number; cantidad_orden: number; precio_unitario: number }[] = [];

    for (const item of lineasRaw) {
        const cantidad = Number(item.cantidad_orden ?? item.quantity);
        const precio = Number(item.precio_unitario ?? item.unitPrice ?? 0);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new ErrorAplicacion(400, 'La cantidad de cada insumo en la OC debe ser mayor que 0');
        }
        if (!Number.isFinite(precio) || precio < 0 || !Number.isInteger(Math.round(precio))) {
            throw new ErrorAplicacion(400, 'El precio unitario de cada insumo debe ser un número mayor o igual a 0');
        }

        let idArticulo = item.id_articulo != null ? Number(item.id_articulo) : NaN;

        if (!Number.isInteger(idArticulo) || idArticulo <= 0) {
            const skuLimpio = (item.sku ?? '').trim();
            if (!skuLimpio) {
                throw new ErrorAplicacion(400, 'Cada línea de la OC debe indicar id_articulo o sku válido');
            }
            const artRes = await cliente.query<{ id_articulo: number; precio_unitario: number }>(
                'SELECT id_articulo, precio_unitario FROM articulo WHERE UPPER(sku) = UPPER($1) LIMIT 1',
                [skuLimpio]
            );
            if (artRes.rows.length === 0) {
                throw new ErrorAplicacion(400, `El insumo con SKU '${skuLimpio}' no existe`);
            }
            idArticulo = Number(artRes.rows[0].id_articulo);
        } else {
            const artRes = await cliente.query<{ id_articulo: number }>(
                'SELECT id_articulo FROM articulo WHERE id_articulo = $1 LIMIT 1',
                [idArticulo]
            );
            if (artRes.rows.length === 0) {
                throw new ErrorAplicacion(400, `El insumo con ID ${idArticulo} no existe`);
            }
        }

        resueltas.push({
            id_articulo: idArticulo,
            cantidad_orden: Number(cantidad.toFixed(3)),
            precio_unitario: Math.round(precio),
        });
    }

    return resueltas;
};

/**
 * Carga una Orden de Compra completa con datos del proveedor, líneas e importes calculados.
 */
export const cargarOrdenCompraCompleta = async (
    consultor: Pick<PoolClient, 'query'>,
    idOrden: number | string
): Promise<OrdenCompraCompleta | null> => {
    const cabRes = await consultor.query<{
        id_orden_compra: number;
        numero_oc: string;
        proveedor_id: number;
        nombre_proveedor: string;
        razon_social_proveedor: string | null;
        rut_proveedor: string;
        correo_proveedor: string | null;
        telefono_proveedor: string | null;
        direccion_proveedor: string | null;
        estado: EstadoOrdenCompra;
        origen: string;
        fecha_estimada_oc: string | null;
        fecha_creacion: Date | string;
        observaciones: string | null;
        fecha_aprobacion: Date | string | null;
        id_usuario_aprobador: number | null;
        correo_enviado_a: string | null;
        fecha_envio_correo: Date | string | null;
    }>(
        `SELECT
            oc.id_orden_compra,
            oc.numero_oc,
            oc.proveedor_id,
            p.nombre_proveedor,
            p.nombre_proveedor AS razon_social_proveedor,
            p.rut_proveedor,
            p.correo_contacto AS correo_proveedor,
            p.telefono AS telefono_proveedor,
            p.direccion AS direccion_proveedor,
            oc.estado::text AS estado,
            COALESCE(oc.origen, 'Manual') AS origen,
            TO_CHAR(oc.fecha_estimada_oc, 'YYYY-MM-DD') AS fecha_estimada_oc,
            oc.fecha_creacion,
            oc.observaciones,
            oc.fecha_aprobacion,
            oc.id_usuario_aprobador,
            oc.correo_enviado_a,
            oc.fecha_envio_correo
         FROM ordenes_compra oc
         JOIN proveedor p ON p.id_proveedor = oc.proveedor_id
         WHERE oc.id_orden_compra = $1`,
        [idOrden]
    );

    if (cabRes.rows.length === 0) return null;
    const cab = cabRes.rows[0];

    const linRes = await consultor.query<{
        id_oc_linea: number;
        id_orden_compra: number;
        id_articulo: number;
        sku: string | null;
        nombre_articulo: string;
        unidad: string | null;
        cantidad_orden: number;
        precio_unitario: number;
        cantidad_recibida: number;
        cantidad_defectuosa?: number;
    }>(
        `SELECT
            l.id_oc_linea,
            l.id_orden_compra,
            l.id_articulo,
            COALESCE(a.sku, 'ART-' || l.id_articulo::text) AS sku,
            COALESCE(a.nombre_articulo, 'Insumo #' || l.id_articulo::text) AS nombre_articulo,
            COALESCE(u.tipo_unidad, 'un') AS unidad,
            l.cantidad_orden::float8 AS cantidad_orden,
            l.precio_unitario::int AS precio_unitario,
            COALESCE((
                SELECT SUM(rd.cantidad_recibida)::float8
                FROM registro_recepcion_articulo_detalle rd
                WHERE rd.id_oc_linea = l.id_oc_linea
            ), 0)::float8 AS cantidad_recibida,
            COALESCE((
                SELECT SUM(rd.cantidad_defectuosa)::float8
                FROM registro_recepcion_articulo_detalle rd
                WHERE rd.id_oc_linea = l.id_oc_linea
            ), 0)::float8 AS cantidad_defectuosa
         FROM oc_lineas l
         LEFT JOIN articulo a ON a.id_articulo = l.id_articulo
         LEFT JOIN unidad_de_medida u ON u.id_unidad = a.id_unidad
         WHERE l.id_orden_compra = $1
         ORDER BY l.id_oc_linea ASC`,
        [idOrden]
    );

    const lineas: LineaOrdenCompraDetalle[] = linRes.rows.map((r) => {
        const cantOrden = Number(r.cantidad_orden);
        const cantRecibida = Number(r.cantidad_recibida || 0);
        const cantDefectuosa = Number(r.cantidad_defectuosa || 0);
        const subtotal = Math.round(cantOrden * Number(r.precio_unitario));
        return {
            id_oc_linea: Number(r.id_oc_linea),
            id_orden_compra: Number(r.id_orden_compra),
            id_articulo: Number(r.id_articulo),
            sku: r.sku || `ART-${r.id_articulo}`,
            nombre_articulo: r.nombre_articulo,
            unidad: r.unidad || 'un',
            cantidad_orden: cantOrden,
            precio_unitario: Number(r.precio_unitario),
            subtotal_linea: subtotal,
            cantidad_recibida: cantRecibida,
            cantidad_defectuosa: cantDefectuosa,
            saldo_pendiente: Math.max(0, Number((cantOrden - cantRecibida).toFixed(3))),
        };
    });

    const subtotalNeto = lineas.reduce((acc, l) => acc + l.subtotal_linea, 0);
    const iva = Math.round(subtotalNeto * 0.19);
    const total = subtotalNeto + iva;

    return {
        id_orden_compra: Number(cab.id_orden_compra),
        numero_oc: cab.numero_oc,
        proveedor_id: Number(cab.proveedor_id),
        nombre_proveedor: cab.nombre_proveedor,
        razon_social_proveedor: cab.razon_social_proveedor,
        rut_proveedor: cab.rut_proveedor,
        correo_proveedor: cab.correo_proveedor,
        telefono_proveedor: cab.telefono_proveedor,
        direccion_proveedor: cab.direccion_proveedor,
        estado: cab.estado,
        origen: cab.origen,
        fecha_estimada_oc: cab.fecha_estimada_oc,
        fecha_creacion: cab.fecha_creacion instanceof Date ? cab.fecha_creacion.toISOString() : String(cab.fecha_creacion),
        observaciones: cab.observaciones,
        fecha_aprobacion: cab.fecha_aprobacion
            ? cab.fecha_aprobacion instanceof Date
                ? cab.fecha_aprobacion.toISOString()
                : String(cab.fecha_aprobacion)
            : null,
        id_usuario_aprobador: cab.id_usuario_aprobador != null ? Number(cab.id_usuario_aprobador) : null,
        correo_enviado_a: cab.correo_enviado_a,
        fecha_envio_correo: cab.fecha_envio_correo
            ? cab.fecha_envio_correo instanceof Date
                ? cab.fecha_envio_correo.toISOString()
                : String(cab.fecha_envio_correo)
            : null,
        lineas,
        subtotal_neto: subtotalNeto,
        iva,
        total,
    };
};

const aDatosPdf = (oc: OrdenCompraCompleta): DatosPdfOrdenCompra => ({
    id_orden_compra: oc.id_orden_compra,
    numero_oc: oc.numero_oc,
    estado: oc.estado,
    origen: oc.origen,
    fecha_emision: oc.fecha_creacion.slice(0, 10),
    fecha_estimada_oc: oc.fecha_estimada_oc,
    observaciones: oc.observaciones,
    proveedor: {
        id_proveedor: oc.proveedor_id,
        nombre_proveedor: oc.nombre_proveedor,
        razon_social: oc.razon_social_proveedor,
        rut_proveedor: oc.rut_proveedor,
        correo_contacto: oc.correo_proveedor,
        telefono: oc.telefono_proveedor,
        direccion: oc.direccion_proveedor,
    },
    lineas: oc.lineas.map((l) => ({
        sku: l.sku,
        nombre_articulo: l.nombre_articulo,
        unidad: l.unidad,
        cantidad: l.cantidad_orden,
        precio_unitario: l.precio_unitario,
        subtotal_linea: l.subtotal_linea,
    })),
    subtotal_neto: oc.subtotal_neto,
    iva: oc.iva,
    total: oc.total,
});

/**
 * Ejecuta la aprobación de una OC en estado Borrador dentro de una transacción:
 *  1. Cambia el estado de 'Borrador' a 'Enviada'
 *  2. Genera el PDF corporativo con su número correlativo
 *  3. Despacha automáticamente el correo al proveedor con el PDF adjunto
 *  4. Registra el evento en bitácora de auditoría
 */
const ejecutarAprobacionYEnvioInterno = async (
    cliente: PoolClient,
    idOrden: number,
    idEjecutor: number | null,
    correoDestinoOverride?: string
): Promise<{
    ordenActualizada: OrdenCompraCompleta;
    pdfBuffer: Buffer;
    correoDestino: string;
    asuntoCorreo: string;
}> => {
    const antes = await cargarOrdenCompraCompleta(cliente, idOrden);
    if (!antes) {
        throw new ErrorAplicacion(404, 'Orden de compra no encontrada');
    }

    if (antes.estado !== 'Borrador') {
        throw new ErrorAplicacion(
            400,
            `Solo se pueden aprobar órdenes de compra en estado Borrador (estado actual: ${antes.estado})`
        );
    }

    if (antes.lineas.length === 0) {
        throw new ErrorAplicacion(400, 'No se puede aprobar una orden de compra sin insumos');
    }

    const correoDestino = (correoDestinoOverride || antes.correo_proveedor || '').trim();
    if (!correoDestino) {
        throw new ErrorAplicacion(
            400,
            'El proveedor no tiene un correo electrónico de contacto registrado para enviar la OC'
        );
    }

    await cliente.query(
        `UPDATE ordenes_compra
         SET estado = 'Enviada',
             fecha_aprobacion = CURRENT_TIMESTAMP,
             id_usuario_aprobador = $2,
             correo_enviado_a = $3,
             fecha_envio_correo = CURRENT_TIMESTAMP
         WHERE id_orden_compra = $1`,
        [idOrden, idEjecutor, correoDestino]
    );

    const despues = (await cargarOrdenCompraCompleta(cliente, idOrden))!;
    const datosPdf = aDatosPdf(despues);
    const pdfBuffer = generarPdfOrdenCompra(datosPdf);
    const correoSaliente = construirCorreoOrdenCompra(datosPdf, pdfBuffer, correoDestino);

    await registrarAuditoria(
        {
            entidad: 'orden_compra',
            accion: 'aprobar_enviar',
            idRegistro: idOrden,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: {
                id_orden_compra: antes.id_orden_compra,
                numero_oc: antes.numero_oc,
                estado: antes.estado,
                subtotal_neto: antes.subtotal_neto,
                total: antes.total,
            },
            estadoNuevo: {
                id_orden_compra: despues.id_orden_compra,
                numero_oc: despues.numero_oc,
                estado: despues.estado,
                correo_enviado_a: correoDestino,
                subtotal_neto: despues.subtotal_neto,
                total: despues.total,
            },
            descripcion: `Orden de Compra ${despues.numero_oc} aprobada (Borrador -> Enviada) y PDF enviado por correo a ${correoDestino}`,
        },
        cliente
    );

    await enviarCorreo(correoSaliente);

    return {
        ordenActualizada: despues,
        pdfBuffer,
        correoDestino,
        asuntoCorreo: correoSaliente.asunto,
    };
};

// =============================================================================
// ENDPOINTS HTTP
// =============================================================================

export const listarOrdenesCompra = async (req: Request, res: Response): Promise<void> => {
    try {
        const estadoFiltro = typeof req.query.estado === 'string' ? normalizarEstadoOc(req.query.estado) : null;
        const idsRes = estadoFiltro
            ? await pool.query<{ id_orden_compra: number }>(
                  'SELECT id_orden_compra FROM ordenes_compra WHERE estado = $1 ORDER BY id_orden_compra DESC',
                  [estadoFiltro]
              )
            : await pool.query<{ id_orden_compra: number }>(
                  'SELECT id_orden_compra FROM ordenes_compra ORDER BY id_orden_compra DESC'
              );

        const ordenes: OrdenCompraCompleta[] = [];
        for (const row of idsRes.rows) {
            const oc = await cargarOrdenCompraCompleta(pool, row.id_orden_compra);
            if (oc) ordenes.push(oc);
        }

        res.status(200).json(ordenes);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las órdenes de compra');
    }
};

export const obtenerOrdenCompraPorId = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const oc = await cargarOrdenCompraCompleta(pool, req.params.id);
        if (!oc) {
            res.status(404).json({ mensaje: 'Orden de compra no encontrada' });
            return;
        }
        res.status(200).json(oc);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener la orden de compra');
    }
};

export const crearOrdenCompra = async (
    req: Request<Record<string, string>, unknown, OrdenCompraBody>,
    res: Response
): Promise<void> => {
    const {
        proveedor_id,
        origen,
        fecha_estimada_oc,
        observaciones,
        lineas,
        items,
        aprobar_inmediatamente,
        correo_destino,
    } = req.body;

    const idEjecutor = obtenerIdEjecutor(req);

    if (!proveedor_id || !Number.isInteger(Number(proveedor_id))) {
        res.status(400).json({ mensaje: 'Debe seleccionar un proveedor válido (proveedor_id)' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion(async (cliente) => {
            const provRes = await cliente.query<{ id_proveedor: number; activo?: boolean }>(
                'SELECT id_proveedor, activo FROM proveedor WHERE id_proveedor = $1',
                [proveedor_id]
            );
            if (provRes.rows.length === 0) {
                throw new ErrorAplicacion(400, 'El proveedor seleccionado no existe');
            }
            if (provRes.rows[0].activo === false) {
                throw new ErrorAplicacion(400, 'No se puede emitir una orden de compra a un proveedor inactivo');
            }

            const lineasResueltas = await resolverLineasEntrada(cliente, lineas ?? items);
            const numeroOc = await generarSiguienteNumeroOc(cliente);

            const insCab = await cliente.query<{ id_orden_compra: number }>(
                `INSERT INTO ordenes_compra
                    (numero_oc, proveedor_id, estado, origen, fecha_estimada_oc, observaciones)
                 VALUES ($1, $2, 'Borrador', $3, $4, $5)
                 RETURNING id_orden_compra`,
                [
                    numeroOc,
                    Number(proveedor_id),
                    (origen || 'Manual').trim(),
                    fecha_estimada_oc || null,
                    observaciones?.trim() || null,
                ]
            );
            const idOrden = insCab.rows[0].id_orden_compra;

            for (const l of lineasResueltas) {
                await cliente.query(
                    `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
                     VALUES ($1, $2, $3, $4)`,
                    [idOrden, l.id_articulo, l.cantidad_orden, l.precio_unitario]
                );
            }

            const creada = (await cargarOrdenCompraCompleta(cliente, idOrden))!;

            await registrarAuditoria(
                {
                    entidad: 'orden_compra',
                    accion: 'crear',
                    idRegistro: idOrden,
                    idUsuarioEjecutor: idEjecutor,
                    estadoAnterior: null,
                    estadoNuevo: {
                        id_orden_compra: creada.id_orden_compra,
                        numero_oc: creada.numero_oc,
                        proveedor_id: creada.proveedor_id,
                        estado: creada.estado,
                        subtotal_neto: creada.subtotal_neto,
                        total: creada.total,
                        cantidad_lineas: creada.lineas.length,
                    },
                    descripcion: `Orden de Compra ${creada.numero_oc} creada en estado Borrador`,
                },
                cliente
            );

            if (aprobar_inmediatamente) {
                const aprobacion = await ejecutarAprobacionYEnvioInterno(
                    cliente,
                    idOrden,
                    idEjecutor,
                    correo_destino
                );
                return {
                    orden_compra: aprobacion.ordenActualizada,
                    aprobada: true,
                    correo_enviado: {
                        para: aprobacion.correoDestino,
                        asunto: aprobacion.asuntoCorreo,
                        nombre_adjunto: `${aprobacion.ordenActualizada.numero_oc}.pdf`,
                        tamano_pdf_bytes: aprobacion.pdfBuffer.length,
                    },
                    pdf_base64: aprobacion.pdfBuffer.toString('base64'),
                };
            }

            return {
                orden_compra: creada,
                aprobada: false,
            };
        });

        res.status(201).json({
            mensaje: resultado.aprobada
                ? `Orden de compra ${resultado.orden_compra.numero_oc} creada, aprobada y enviada por correo al proveedor`
                : `Orden de compra ${resultado.orden_compra.numero_oc} guardada en borrador`,
            ...resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al crear la orden de compra');
    }
};

export const actualizarOrdenCompra = async (
    req: Request<{ id: string }, unknown, OrdenCompraBody>,
    res: Response
): Promise<void> => {
    const idOrden = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);
    const { proveedor_id, origen, fecha_estimada_oc, observaciones, lineas, items } = req.body;

    if (!Number.isInteger(idOrden) || idOrden <= 0) {
        res.status(400).json({ mensaje: 'Identificador de orden de compra inválido' });
        return;
    }

    try {
        const actualizada = await ejecutarTransaccion(async (cliente) => {
            const antes = await cargarOrdenCompraCompleta(cliente, idOrden);
            if (!antes) {
                throw new ErrorAplicacion(404, 'Orden de compra no encontrada');
            }

            const errorEdicion = validarEdicionOrdenCompra(antes.estado);
            if (errorEdicion) {
                throw new ErrorAplicacion(400, errorEdicion);
            }

            const nuevoProveedorId = proveedor_id != null ? Number(proveedor_id) : antes.proveedor_id;
            const provRes = await cliente.query<{ id_proveedor: number; activo?: boolean }>(
                'SELECT id_proveedor, activo FROM proveedor WHERE id_proveedor = $1',
                [nuevoProveedorId]
            );
            if (provRes.rows.length === 0) {
                throw new ErrorAplicacion(400, 'El proveedor seleccionado no existe');
            }
            if (provRes.rows[0].activo === false) {
                throw new ErrorAplicacion(400, 'El proveedor seleccionado está inactivo');
            }

            await cliente.query(
                `UPDATE ordenes_compra
                 SET proveedor_id = $1,
                     origen = $2,
                     fecha_estimada_oc = $3,
                     observaciones = $4
                 WHERE id_orden_compra = $5`,
                [
                    nuevoProveedorId,
                    (origen ?? antes.origen).trim(),
                    fecha_estimada_oc !== undefined ? fecha_estimada_oc || null : antes.fecha_estimada_oc,
                    observaciones !== undefined ? observaciones?.trim() || null : antes.observaciones,
                    idOrden,
                ]
            );

            const nuevasLineasInput = lineas ?? items;
            if (nuevasLineasInput !== undefined) {
                const lineasResueltas = await resolverLineasEntrada(cliente, nuevasLineasInput);
                await cliente.query('DELETE FROM oc_lineas WHERE id_orden_compra = $1', [idOrden]);
                for (const l of lineasResueltas) {
                    await cliente.query(
                        `INSERT INTO oc_lineas (id_orden_compra, id_articulo, cantidad_orden, precio_unitario)
                         VALUES ($1, $2, $3, $4)`,
                        [idOrden, l.id_articulo, l.cantidad_orden, l.precio_unitario]
                    );
                }
            }

            const despues = (await cargarOrdenCompraCompleta(cliente, idOrden))!;

            await registrarAuditoria(
                {
                    entidad: 'orden_compra',
                    accion: 'editar',
                    idRegistro: idOrden,
                    idUsuarioEjecutor: idEjecutor,
                    estadoAnterior: {
                        id_orden_compra: antes.id_orden_compra,
                        numero_oc: antes.numero_oc,
                        proveedor_id: antes.proveedor_id,
                        estado: antes.estado,
                        subtotal_neto: antes.subtotal_neto,
                        total: antes.total,
                        cantidad_lineas: antes.lineas.length,
                    },
                    estadoNuevo: {
                        id_orden_compra: despues.id_orden_compra,
                        numero_oc: despues.numero_oc,
                        proveedor_id: despues.proveedor_id,
                        estado: despues.estado,
                        subtotal_neto: despues.subtotal_neto,
                        total: despues.total,
                        cantidad_lineas: despues.lineas.length,
                    },
                    descripcion: `Orden de Compra ${despues.numero_oc} editada en estado Borrador`,
                },
                cliente
            );

            return despues;
        });

        res.status(200).json({
            mensaje: `Orden de compra ${actualizada.numero_oc} actualizada exitosamente`,
            orden_compra: actualizada,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al actualizar la orden de compra');
    }
};

/**
 * [BACK-1] Aprueba una OC en estado Borrador:
 *  - Cambia su estado de 'Borrador' a 'Enviada'
 *  - Genera el PDF corporativo con numeración correlativa
 *  - Envía automáticamente el correo con el PDF adjunto al proveedor
 */
export const aprobarOrdenCompra = async (
    req: Request<{ id: string }, unknown, { correo_destino?: string }>,
    res: Response
): Promise<void> => {
    const idOrden = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);
    const correoDestinoOverride = req.body?.correo_destino;

    if (!Number.isInteger(idOrden) || idOrden <= 0) {
        res.status(400).json({ mensaje: 'Identificador de orden de compra inválido' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion(async (cliente) =>
            ejecutarAprobacionYEnvioInterno(cliente, idOrden, idEjecutor, correoDestinoOverride)
        );

        res.status(200).json({
            mensaje: `Orden de compra ${resultado.ordenActualizada.numero_oc} aprobada y PDF enviado a ${resultado.correoDestino}`,
            orden_compra: resultado.ordenActualizada,
            correo_enviado: {
                para: resultado.correoDestino,
                asunto: resultado.asuntoCorreo,
                nombre_adjunto: `${resultado.ordenActualizada.numero_oc}.pdf`,
                tamano_pdf_bytes: resultado.pdfBuffer.length,
            },
            pdf_base64: resultado.pdfBuffer.toString('base64'),
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al aprobar y enviar la orden de compra');
    }
};

/**
 * Descarga o visualiza el PDF corporativo de la Orden de Compra.
 */
export const descargarPdfOrdenCompra = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const oc = await cargarOrdenCompraCompleta(pool, req.params.id);
        if (!oc) {
            res.status(404).json({ mensaje: 'Orden de compra no encontrada' });
            return;
        }

        const pdfBuffer = generarPdfOrdenCompra(aDatosPdf(oc));
        const disposicion = req.query.descargar === '1' ? 'attachment' : 'inline';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposicion}; filename="${oc.numero_oc}.pdf"`);
        res.setHeader('Content-Length', String(pdfBuffer.length));
        res.status(200).send(pdfBuffer);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al generar el PDF de la orden de compra');
    }
};

/**
 * Cambia el estado de una Orden de Compra validando los 6 estados del flujo:
 * Borrador, Enviada, Recibida parcial, Recibida, Cerrada y Anulada.
 */
export const cambiarEstadoOrdenCompra = async (
    req: Request<{ id: string }, unknown, { estado?: string; correo_destino?: string }>,
    res: Response
): Promise<void> => {
    const idOrden = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);
    const nuevoEstado = normalizarEstadoOc(req.body?.estado);

    if (!Number.isInteger(idOrden) || idOrden <= 0) {
        res.status(400).json({ mensaje: 'Identificador de orden de compra inválido' });
        return;
    }

    if (!nuevoEstado) {
        res.status(400).json({
            mensaje: `Estado inválido. Estados permitidos: ${ESTADOS_OC.join(', ')}`,
        });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion(async (cliente) => {
            const antes = await cargarOrdenCompraCompleta(cliente, idOrden);
            if (!antes) {
                throw new ErrorAplicacion(404, 'Orden de compra no encontrada');
            }

            const errorTransicion = validarTransicionEstadoOc(antes.estado, nuevoEstado);
            if (errorTransicion) {
                throw new ErrorAplicacion(400, errorTransicion);
            }

            // Si pasa de Borrador a Enviada, ejecuta el flujo oficial de aprobación + PDF + correo
            if (antes.estado === 'Borrador' && nuevoEstado === 'Enviada') {
                return ejecutarAprobacionYEnvioInterno(
                    cliente,
                    idOrden,
                    idEjecutor,
                    req.body?.correo_destino
                );
            }

            await cliente.query(
                'UPDATE ordenes_compra SET estado = $1 WHERE id_orden_compra = $2',
                [nuevoEstado, idOrden]
            );

            const despues = (await cargarOrdenCompraCompleta(cliente, idOrden))!;

            await registrarAuditoria(
                {
                    entidad: 'orden_compra',
                    accion: 'cambiar_estado',
                    idRegistro: idOrden,
                    idUsuarioEjecutor: idEjecutor,
                    estadoAnterior: { estado: antes.estado },
                    estadoNuevo: { estado: despues.estado },
                    descripcion: `Estado de OC ${despues.numero_oc} cambiado de ${antes.estado} a ${despues.estado}`,
                },
                cliente
            );

            return {
                ordenActualizada: despues,
                pdfBuffer: null,
                correoDestino: null,
                asuntoCorreo: null,
            };
        });

        res.status(200).json({
            mensaje: `Estado de la orden ${resultado.ordenActualizada.numero_oc} actualizado a ${resultado.ordenActualizada.estado}`,
            orden_compra: resultado.ordenActualizada,
            ...(resultado.pdfBuffer
                ? {
                      correo_enviado: {
                          para: resultado.correoDestino,
                          asunto: resultado.asuntoCorreo,
                          nombre_adjunto: `${resultado.ordenActualizada.numero_oc}.pdf`,
                          tamano_pdf_bytes: resultado.pdfBuffer.length,
                      },
                      pdf_base64: resultado.pdfBuffer.toString('base64'),
                  }
                : {}),
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al cambiar el estado de la orden de compra');
    }
};

/**
 * [H33] Registra la recepción de insumos tomando la Orden de Compra aprobada como base.
 * Actualiza el estado de la OC a 'Recibida parcial' o 'Recibida' e incrementa el stock disponible.
 */
export interface ItemRecepcionOrdenInput {
    id_oc_linea?: number;
    id_articulo?: number;
    sku?: string;
    cantidad_conforme?: number;
    cantidad_recibida?: number;
    received?: number;
    cantidad_defectuosa?: number;
    defective?: number;
    cantidad_faltante?: number;
    missing?: number;
}

export interface SaldoBolsaActualizado {
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    conforme_ingresado: number;
    defectuoso_ingresado: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    cuarentena_anterior: number;
    cuarentena_nuevo: number;
    costo_neto_ingreso?: number;
    pmp_anterior?: number;
    pmp_nuevo?: number;
}

export type EstadoLineaRecepcion = 'Conforme' | 'Defectuoso' | 'Faltante';

export interface LineaRecepcionTrazable {
    id_recepcion_linea: number;
    id_recepcion: number;
    id_oc_linea: number;
    id_articulo: number;
    sku: string;
    estado_linea: EstadoLineaRecepcion;
    cantidad: number;
    precio_unitario_ingreso: number;
}

export interface MovimientoRecepcionRegistrado {
    id_movimiento: number;
    id_insumo: number;
    id_orden_compra: number;
    id_recepcion: number;
    id_recepcion_linea: number;
    sku: string;
    tipo_movimiento: 'Entrada';
    destino_bolsa: 'disponible' | 'cuarentena';
    cantidad: number;
    costo_unitario: number;
    saldo_historico: number;
    pmp_historico: number;
    valor_total_historico: number;
    referencia: string;
}

/**
 * Calcula el nuevo Precio Medio Ponderado (PMP) histórico tras un ingreso conforme a stock disponible:
 * (valor stock actual + valor ingreso neto) / (stock actual + cantidad ingresada)
 * sin errores de redondeo de punto flotante.
 */
export const calcularPmpHistorico = (
    stockDisponibleAnterior: number,
    pmpAnterior: number,
    cantidadConformeIngresada: number,
    costoUnitarioIngreso: number
): number => {
    return calcularPmpExactoSinErrorRedondeo(
        stockDisponibleAnterior,
        pmpAnterior,
        cantidadConformeIngresada,
        costoUnitarioIngreso
    );
};

/**
 * [BACK-1 / DB] Ejecuta en una sola transacción atómica la recepción parcial o total de una OC:
 *  - Crea cabecera en `recepciones` vinculada a `ordenes_compra(id_orden_compra)`
 *  - Registra cada tramo de la línea en `recepcion_lineas` con estado `Conforme`, `Defectuoso` o `Faltante`
 *    vinculado a `recepciones(id_recepcion)` y a `oc_lineas(id_oc_linea)`
 *  - Lo Conforme suma únicamente a la bolsa de stock disponible (`cantidad_disponible`) y recalcula el PMP
 *  - Lo Defectuoso suma únicamente a la bolsa de cuarentena (`cantidad_cuarentena`)
 *  - Registra movimientos separados en `movimientos_inventario` (base del Cardex) con `id_orden_compra`,
 *    `id_recepcion`, `id_recepcion_linea`, `saldo_historico` y `pmp_historico`
 *  - Actualiza el estado de la OC a 'Recibida parcial' o 'Recibida'
 */
export const ejecutarRecepcionOrdenCompraEnTransaccion = async (
    cliente: PoolClient,
    idOrden: number,
    itemsRecepcion: ItemRecepcionOrdenInput[],
    idEjecutor: number | null = null,
    numeroFactura?: string
): Promise<{
    id_recepcion: number;
    orden_compra: OrdenCompraCompleta;
    lineas_recepcion: LineaRecepcionTrazable[];
    saldos_actualizados: SaldoBolsaActualizado[];
    movimientos_registrados: MovimientoRecepcionRegistrado[];
    alertas_discrepancia_factura?: AlertaReposicionH40[];
}> => {
    const ocAntes = await cargarOrdenCompraCompleta(cliente, idOrden);
    if (!ocAntes) {
        throw new ErrorAplicacion(404, 'Orden de compra no encontrada');
    }

    if (ocAntes.estado !== 'Enviada' && ocAntes.estado !== 'Recibida parcial') {
        throw new ErrorAplicacion(
            400,
            `Solo se pueden recepcionar órdenes en estado Enviada o Recibida parcial (estado actual: ${ocAntes.estado})`
        );
    }

    // 1. Insertar cabecera en `recepciones` [DB] y en `registro_recepcion_articulo` (compatibilidad)
    const recCabRes = await cliente.query<{ id_recepcion: number }>(
        `INSERT INTO recepciones (id_orden_compra, id_usuario_bodeguero, numero_factura, estado_resultante_oc)
         VALUES ($1, $2, $3, $4)
         RETURNING id_recepcion`,
        [idOrden, idEjecutor, numeroFactura || null, ocAntes.estado]
    );
    const idRecepcion = Number(recCabRes.rows[0].id_recepcion);

    const cabRecLegacy = await cliente.query<{ id_registro_recepcion_articulo: number }>(
        `INSERT INTO registro_recepcion_articulo (id_orden_compra, estado)
         VALUES ($1, $2)
         RETURNING id_registro_recepcion_articulo`,
        [idOrden, ocAntes.estado]
    );
    const idRegistroRec = cabRecLegacy.rows[0].id_registro_recepcion_articulo;

    const lineasRecepcion: LineaRecepcionTrazable[] = [];
    const saldosActualizados: SaldoBolsaActualizado[] = [];
    const movimientosRegistrados: MovimientoRecepcionRegistrado[] = [];
    const detallesDiscrepancia: string[] = [];

    // [BACK-1 / BACK-2] Consultar si ya existe una Factura de Compra asociada a esta OC (o por numeroFactura)
    // para tomar su costo neto unitario (con los 3 descuentos en cascada aplicados) al calcular el PMP
    // y contrastar automáticamente las cantidades facturadas contra las cantidades recibidas en H33.
    const mapaCostoNetoFactura = new Map<number, number>();
    const mapaLineasFacturaExistente = new Map<
        number,
        {
            id_factura: number;
            numero_factura: string;
            lineas: { id_articulo: number; sku: string; cantidad: number; precio_unitario: number }[];
        }
    >();
    const facCostoRes = await cliente.query<{
        id_factura: number;
        numero_factura: string;
        id_articulo: number;
        cantidad: number;
        precio_unitario: number;
    }>(
        `SELECT f.id_factura,
                f.numero_factura,
                fl.id_articulo,
                COALESCE(fl.cantidad, 0)::float8 AS cantidad,
                fl.precio_unitario_neto::float8 AS precio_unitario
         FROM factura_lineas fl
         JOIN facturas_compra f ON f.id_factura = fl.id_factura
         WHERE f.oc_id = $1
            OR ($2::text IS NOT NULL AND f.proveedor_id = $3 AND LOWER(TRIM(f.numero_factura)) = LOWER(TRIM($2)))
         UNION ALL
         SELECT f.id_factura,
                f.numero_factura,
                fd.id_articulo,
                COALESCE(fd.cantidad, 0)::float8 AS cantidad,
                fd.precio_unitario::float8 AS precio_unitario
         FROM factura_detalle fd
         JOIN factura f ON f.id_factura = fd.id_factura
         WHERE f.id_orden_compra = $1
            OR ($2::text IS NOT NULL AND f.id_proveedor = $3 AND LOWER(TRIM(f.numero_factura)) = LOWER(TRIM($2)))
         ORDER BY id_factura DESC`,
        [idOrden, numeroFactura || null, ocAntes.proveedor_id]
    );
    for (const filaCosto of facCostoRes.rows) {
        const idArtCosto = Number(filaCosto.id_articulo);
        if (!mapaCostoNetoFactura.has(idArtCosto) && Number(filaCosto.precio_unitario) > 0) {
            mapaCostoNetoFactura.set(idArtCosto, Number(filaCosto.precio_unitario));
        }
        const idFac = Number(filaCosto.id_factura);
        if (idFac > 0) {
            const lineaOcMatch = ocAntes.lineas.find((l) => l.id_articulo === idArtCosto);
            const actualFac = mapaLineasFacturaExistente.get(idFac) ?? {
                id_factura: idFac,
                numero_factura: String(filaCosto.numero_factura || numeroFactura || ''),
                lineas: [],
            };
            actualFac.lineas.push({
                id_articulo: idArtCosto,
                sku: lineaOcMatch?.sku || String(idArtCosto),
                cantidad: Number(filaCosto.cantidad || 0),
                precio_unitario: Number(filaCosto.precio_unitario || 0),
            });
            mapaLineasFacturaExistente.set(idFac, actualFac);
        }
    }

    for (const item of itemsRecepcion) {
        const conforme = Number(item.cantidad_conforme ?? item.cantidad_recibida ?? item.received ?? 0);
        const defectuosa = Number(item.cantidad_defectuosa ?? item.defective ?? 0);
        const faltanteInput = item.cantidad_faltante ?? item.missing;

        if (
            !Number.isFinite(conforme) ||
            conforme < 0 ||
            !Number.isFinite(defectuosa) ||
            defectuosa < 0 ||
            (faltanteInput !== undefined && (!Number.isFinite(Number(faltanteInput)) || Number(faltanteInput) < 0))
        ) {
            throw new ErrorAplicacion(400, 'Las cantidades conformes, defectuosas y faltantes deben ser números no negativos');
        }
        if (conforme === 0 && defectuosa === 0 && (faltanteInput === undefined || Number(faltanteInput) === 0)) {
            continue;
        }

        const lineaOc = ocAntes.lineas.find(
            (l) =>
                (item.id_oc_linea && l.id_oc_linea === Number(item.id_oc_linea)) ||
                (item.id_articulo && l.id_articulo === Number(item.id_articulo)) ||
                (item.sku && l.sku.toUpperCase() === item.sku.trim().toUpperCase())
        );
        if (!lineaOc) {
            throw new ErrorAplicacion(400, 'Uno de los insumos indicados no pertenece a esta Orden de Compra');
        }

        const saldoPendienteLinea = Math.max(0, Number((lineaOc.cantidad_orden - lineaOc.cantidad_recibida).toFixed(3)));
        const faltanteCalculado =
            faltanteInput !== undefined
                ? Number(faltanteInput)
                : Math.max(0, Number((saldoPendienteLinea - conforme - defectuosa).toFixed(3)));

        await cliente.query(
            `INSERT INTO registro_recepcion_articulo_detalle
                (id_registro_recepcion_articulo, id_oc_linea, fecha_recepcion, cantidad_recibida, cantidad_defectuosa)
             VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
            [idRegistroRec, lineaOc.id_oc_linea, conforme, defectuosa]
        );

        // Leer saldos y PMP actuales de articulos_stock
        const stockPrevRes = await cliente.query<{
            id_stock: number;
            cantidad_disponible: number;
            cantidad_cuarentena: number;
            pmp?: number;
        }>(
            `SELECT id_stock,
                    COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible,
                    COALESCE(cantidad_cuarentena, 0)::float8 AS cantidad_cuarentena,
                    COALESCE(pmp, 0)::float8 AS pmp
             FROM articulos_stock
             WHERE id_articulo = $1
             LIMIT 1`,
            [lineaOc.id_articulo]
        );

        const dispAnterior = stockPrevRes.rows[0] ? Number(stockPrevRes.rows[0].cantidad_disponible) : 0;
        const cuarAnterior = stockPrevRes.rows[0] ? Number(stockPrevRes.rows[0].cantidad_cuarentena) : 0;
        const pmpAnterior =
            stockPrevRes.rows[0] && Number(stockPrevRes.rows[0].pmp) > 0
                ? Number(stockPrevRes.rows[0].pmp)
                : lineaOc.precio_unitario;

        // [BACK-1] Si la orden tiene factura con descuentos en cascada, usar su costo neto unitario exacto;
        // de lo contrario, usar el precio unitario pactado en la OC.
        const costoNetoIngreso = mapaCostoNetoFactura.get(lineaOc.id_articulo) ?? lineaOc.precio_unitario;

        const pmpHistorico = calcularPmpHistorico(
            dispAnterior,
            pmpAnterior,
            conforme,
            costoNetoIngreso
        );

        let dispNuevo = Number((dispAnterior + conforme).toFixed(3));
        let cuarNuevo = Number((cuarAnterior + defectuosa).toFixed(3));

        if (stockPrevRes.rows.length > 0) {
            const updStock = await cliente.query<{
                cantidad_disponible: number;
                cantidad_cuarentena: number;
            }>(
                `UPDATE articulos_stock
                 SET cantidad_disponible = COALESCE(cantidad_disponible, 0) + $2,
                     cantidad_cuarentena = COALESCE(cantidad_cuarentena, 0) + $3,
                     pmp = $4
                 WHERE id_articulo = $1
                 RETURNING cantidad_disponible::float8 AS cantidad_disponible,
                           cantidad_cuarentena::float8 AS cantidad_cuarentena`,
                [lineaOc.id_articulo, conforme, defectuosa, pmpHistorico]
            );
            if (updStock.rows[0]) {
                dispNuevo = Number(updStock.rows[0].cantidad_disponible);
                cuarNuevo = Number(updStock.rows[0].cantidad_cuarentena);
            }
        } else {
            const insStock = await cliente.query<{
                cantidad_disponible: number;
                cantidad_cuarentena: number;
            }>(
                `INSERT INTO articulos_stock (id_articulo, cantidad_disponible, cantidad_cuarentena, stock_minimo, pmp)
                 VALUES ($1, $2, $3, 0, $4)
                 RETURNING cantidad_disponible::float8 AS cantidad_disponible,
                           cantidad_cuarentena::float8 AS cantidad_cuarentena`,
                [lineaOc.id_articulo, conforme, defectuosa, pmpHistorico]
            );
            if (insStock.rows[0]) {
                dispNuevo = Number(insStock.rows[0].cantidad_disponible);
                cuarNuevo = Number(insStock.rows[0].cantidad_cuarentena);
            }
        }

        saldosActualizados.push({
            id_articulo: lineaOc.id_articulo,
            sku: lineaOc.sku,
            nombre_articulo: lineaOc.nombre_articulo,
            conforme_ingresado: conforme,
            defectuoso_ingresado: defectuosa,
            disponible_anterior: dispAnterior,
            disponible_nuevo: dispNuevo,
            cuarentena_anterior: cuarAnterior,
            cuarentena_nuevo: cuarNuevo,
            costo_neto_ingreso: costoNetoIngreso,
            pmp_anterior: pmpAnterior,
            pmp_nuevo: pmpHistorico,
        });

        // 2.A Trazabilidad de línea CONFORME -> recepcion_lineas + movimientos_inventario (Cardex disponible)
        if (conforme > 0) {
            const rlConforme = await cliente.query<{ id_recepcion_linea: number }>(
                `INSERT INTO recepcion_lineas
                    (id_recepcion, id_oc_linea, id_articulo, estado_linea, cantidad, precio_unitario_ingreso)
                 VALUES ($1, $2, $3, 'Conforme', $4, $5)
                 RETURNING id_recepcion_linea`,
                [idRecepcion, lineaOc.id_oc_linea, lineaOc.id_articulo, conforme, costoNetoIngreso]
            );
            const idRlConforme = Number(rlConforme.rows[0].id_recepcion_linea);
            lineasRecepcion.push({
                id_recepcion_linea: idRlConforme,
                id_recepcion: idRecepcion,
                id_oc_linea: lineaOc.id_oc_linea,
                id_articulo: lineaOc.id_articulo,
                sku: lineaOc.sku,
                estado_linea: 'Conforme',
                cantidad: conforme,
                precio_unitario_ingreso: costoNetoIngreso,
            });

            const refDisp = `${ocAntes.numero_oc}${numeroFactura ? ` / Fac ${numeroFactura}` : ''} - Recepción Conforme a Disponible`;
            const valorTotalHist = Math.round(dispNuevo * pmpHistorico);

            const movDisp = await cliente.query<{ id_movimiento: number }>(
                `INSERT INTO movimientos_inventario
                    (id_insumo, id_orden_compra, id_recepcion, id_recepcion_linea, tipo_movimiento, destino_bolsa,
                     cantidad, costo_unitario, saldo_historico, pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, $2, $3, $4, 'Entrada', 'disponible', $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id_movimiento`,
                [
                    lineaOc.id_articulo,
                    idOrden,
                    idRecepcion,
                    idRlConforme,
                    conforme,
                    costoNetoIngreso,
                    dispNuevo,
                    pmpHistorico,
                    valorTotalHist,
                    refDisp,
                    idEjecutor,
                ]
            );
            await cliente.query(
                `INSERT INTO movimiento_inventario
                    (id_insumo, tipo_movimiento, cantidad, id_usuario, id_orden_compra, id_recepcion, id_recepcion_linea,
                     destino_bolsa, costo_unitario, saldo_historico, pmp_historico, referencia)
                 VALUES ($1, 'Entrada', $2, $3, $4, $5, $6, 'disponible', $7, $8, $9, $10)`,
                [
                    lineaOc.id_articulo,
                    conforme,
                    idEjecutor,
                    idOrden,
                    idRecepcion,
                    idRlConforme,
                    costoNetoIngreso,
                    dispNuevo,
                    pmpHistorico,
                    refDisp,
                ]
            );

            movimientosRegistrados.push({
                id_movimiento: Number(movDisp.rows[0].id_movimiento),
                id_insumo: lineaOc.id_articulo,
                id_orden_compra: idOrden,
                id_recepcion: idRecepcion,
                id_recepcion_linea: idRlConforme,
                sku: lineaOc.sku,
                tipo_movimiento: 'Entrada',
                destino_bolsa: 'disponible',
                cantidad: conforme,
                costo_unitario: costoNetoIngreso,
                saldo_historico: dispNuevo,
                pmp_historico: pmpHistorico,
                valor_total_historico: valorTotalHist,
                referencia: refDisp,
            });
        }

        // 2.B Trazabilidad de línea DEFECTUOSO -> recepcion_lineas + movimientos_inventario (Cardex cuarentena)
        if (defectuosa > 0) {
            const rlDefectuoso = await cliente.query<{ id_recepcion_linea: number }>(
                `INSERT INTO recepcion_lineas
                    (id_recepcion, id_oc_linea, id_articulo, estado_linea, cantidad, precio_unitario_ingreso)
                 VALUES ($1, $2, $3, 'Defectuoso', $4, $5)
                 RETURNING id_recepcion_linea`,
                [idRecepcion, lineaOc.id_oc_linea, lineaOc.id_articulo, defectuosa, lineaOc.precio_unitario]
            );
            const idRlDefectuoso = Number(rlDefectuoso.rows[0].id_recepcion_linea);
            lineasRecepcion.push({
                id_recepcion_linea: idRlDefectuoso,
                id_recepcion: idRecepcion,
                id_oc_linea: lineaOc.id_oc_linea,
                id_articulo: lineaOc.id_articulo,
                sku: lineaOc.sku,
                estado_linea: 'Defectuoso',
                cantidad: defectuosa,
                precio_unitario_ingreso: lineaOc.precio_unitario,
            });

            const refCuar = `${ocAntes.numero_oc}${numeroFactura ? ` / Fac ${numeroFactura}` : ''} - Recepción Defectuosa a Cuarentena`;
            const valorCuarHist = Math.round(cuarNuevo * pmpHistorico);

            const movCuar = await cliente.query<{ id_movimiento: number }>(
                `INSERT INTO movimientos_inventario
                    (id_insumo, id_orden_compra, id_recepcion, id_recepcion_linea, tipo_movimiento, destino_bolsa,
                     cantidad, costo_unitario, saldo_historico, pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, $2, $3, $4, 'Entrada', 'cuarentena', $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id_movimiento`,
                [
                    lineaOc.id_articulo,
                    idOrden,
                    idRecepcion,
                    idRlDefectuoso,
                    defectuosa,
                    lineaOc.precio_unitario,
                    cuarNuevo,
                    pmpHistorico,
                    valorCuarHist,
                    refCuar,
                    idEjecutor,
                ]
            );
            await cliente.query(
                `INSERT INTO movimiento_inventario
                    (id_insumo, tipo_movimiento, cantidad, id_usuario, id_orden_compra, id_recepcion, id_recepcion_linea,
                     destino_bolsa, costo_unitario, saldo_historico, pmp_historico, referencia)
                 VALUES ($1, 'Entrada', $2, $3, $4, $5, $6, 'cuarentena', $7, $8, $9, $10)`,
                [
                    lineaOc.id_articulo,
                    defectuosa,
                    idEjecutor,
                    idOrden,
                    idRecepcion,
                    idRlDefectuoso,
                    lineaOc.precio_unitario,
                    cuarNuevo,
                    pmpHistorico,
                    refCuar,
                ]
            );

            movimientosRegistrados.push({
                id_movimiento: Number(movCuar.rows[0].id_movimiento),
                id_insumo: lineaOc.id_articulo,
                id_orden_compra: idOrden,
                id_recepcion: idRecepcion,
                id_recepcion_linea: idRlDefectuoso,
                sku: lineaOc.sku,
                tipo_movimiento: 'Entrada',
                destino_bolsa: 'cuarentena',
                cantidad: defectuosa,
                costo_unitario: lineaOc.precio_unitario,
                saldo_historico: cuarNuevo,
                pmp_historico: pmpHistorico,
                valor_total_historico: valorCuarHist,
                referencia: refCuar,
            });
            detallesDiscrepancia.push(`${lineaOc.sku}: ${defectuosa} unidad(es) defectuosa(s) en cuarentena`);
        }

        // 2.C Trazabilidad de línea FALTANTE -> recepcion_lineas (sin movimiento físico de stock)
        if (faltanteCalculado > 0) {
            const rlFaltante = await cliente.query<{ id_recepcion_linea: number }>(
                `INSERT INTO recepcion_lineas
                    (id_recepcion, id_oc_linea, id_articulo, estado_linea, cantidad, precio_unitario_ingreso)
                 VALUES ($1, $2, $3, 'Faltante', $4, $5)
                 RETURNING id_recepcion_linea`,
                [idRecepcion, lineaOc.id_oc_linea, lineaOc.id_articulo, faltanteCalculado, lineaOc.precio_unitario]
            );
            lineasRecepcion.push({
                id_recepcion_linea: Number(rlFaltante.rows[0].id_recepcion_linea),
                id_recepcion: idRecepcion,
                id_oc_linea: lineaOc.id_oc_linea,
                id_articulo: lineaOc.id_articulo,
                sku: lineaOc.sku,
                estado_linea: 'Faltante',
                cantidad: faltanteCalculado,
                precio_unitario_ingreso: lineaOc.precio_unitario,
            });
        }

        if (conforme < saldoPendienteLinea) {
            const faltanteReal = Number((saldoPendienteLinea - conforme).toFixed(3));
            detallesDiscrepancia.push(`${lineaOc.sku}: saldo pendiente de ${faltanteReal} unidad(es)`);
        }
    }

    const ocIntermedia = (await cargarOrdenCompraCompleta(cliente, idOrden))!;
    const todoRecibido = ocIntermedia.lineas.every(
        (l) => l.cantidad_recibida >= l.cantidad_orden
    );
    const nuevoEstado: EstadoOrdenCompra = todoRecibido ? 'Recibida' : 'Recibida parcial';

    await cliente.query(
        'UPDATE ordenes_compra SET estado = $1 WHERE id_orden_compra = $2',
        [nuevoEstado, idOrden]
    );
    await cliente.query(
        'UPDATE recepciones SET estado_resultante_oc = $1 WHERE id_recepcion = $2',
        [nuevoEstado, idRecepcion]
    );
    await cliente.query(
        'UPDATE registro_recepcion_articulo SET estado = $1 WHERE id_registro_recepcion_articulo = $2',
        [nuevoEstado, idRegistroRec]
    );

    if (detallesDiscrepancia.length > 0) {
        await cliente.query(
            `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('recepcion_discrepancia', $1, $2, $3, $4, $5, FALSE)`,
            [
                saldosActualizados.some((s) => s.defectuoso_ingresado > 0) ? 'rojo' : 'amarillo',
                `Recepción con observaciones en ${ocAntes.numero_oc} (${nuevoEstado})`,
                `Observaciones registradas en bodega sobre ${ocAntes.numero_oc}: ${detallesDiscrepancia.join(' | ')}`,
                saldosActualizados[0]?.id_articulo ?? null,
                idOrden,
            ]
        );
    }

    const ocDespues = (await cargarOrdenCompraCompleta(cliente, idOrden))!;
    const alertasDiscrepanciaFactura: AlertaReposicionH40[] = [];

    // [BACK-2] Si ya existía una factura ingresada para esta OC, contrastar automáticamente
    // las cantidades facturadas vs las cantidades recibidas conformes en H33 y disparar alerta al Administrador
    for (const facExistente of mapaLineasFacturaExistente.values()) {
        const ocRefActualizada: OrdenCompraRecepcionReferencia = {
            code: ocDespues.numero_oc,
            status: ocDespues.estado,
            items: ocDespues.lineas.map((l) => ({
                sku: l.sku,
                name: l.nombre_articulo,
                unit: l.unidad,
                quantity: l.cantidad_orden,
                unitPrice: l.precio_unitario,
                receivedQuantity: l.cantidad_recibida,
                defectiveQuantity: l.cantidad_defectuosa,
                missingQuantity: l.saldo_pendiente,
            })),
        };
        const evalDisc = detectarDiscrepanciasFacturaConRecepcion(
            facExistente.lineas.map((lf) => ({
                sku: lf.sku,
                quantity: lf.cantidad,
                grossPrice: lf.precio_unitario,
            })),
            ocRefActualizada
        );

        await cliente.query(
            `UPDATE facturas_compra
             SET tiene_discrepancia_recepcion = $2,
                 detalle_discrepancia = $3
             WHERE id_factura = $1`,
            [
                facExistente.id_factura,
                evalDisc.tieneDiscrepancia,
                evalDisc.resumenAlertas.join(' | ') || null,
            ]
        );
        await cliente.query(
            `UPDATE factura
             SET tiene_discrepancia_recepcion = $2,
                 detalle_discrepancia = $3
             WHERE id_factura = $1`,
            [
                facExistente.id_factura,
                evalDisc.tieneDiscrepancia,
                evalDisc.resumenAlertas.join(' | ') || null,
            ]
        );

        if (evalDisc.tieneDiscrepancia) {
            const alertaRes = await cliente.query<AlertaReposicionH40>(
                `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
                 VALUES ('discrepancia_factura_recepcion', 'rojo', $1, $2, $3, $4, FALSE)
                 RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida, fecha_creacion::text AS fecha_creacion`,
                [
                    `Discrepancia Factura ${facExistente.numero_factura} vs Recepción ${ocDespues.numero_oc}`,
                    `Contraste H33 detectó diferencia entre Factura N° ${facExistente.numero_factura} y recepción en bodega de ${ocDespues.numero_oc}: ${evalDisc.resumenAlertas.join(' | ')}`,
                    facExistente.lineas[0]?.id_articulo ?? saldosActualizados[0]?.id_articulo ?? null,
                    idOrden,
                ]
            );
            if (alertaRes.rows[0]) {
                alertasDiscrepanciaFactura.push(alertaRes.rows[0]);
            }
        }
    }

    await registrarAuditoria(
        {
            entidad: 'orden_compra',
            accion: 'recepcionar',
            idRegistro: idOrden,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: { estado: ocAntes.estado },
            estadoNuevo: {
                id_recepcion: idRecepcion,
                estado: ocDespues.estado,
                lineas_recepcion: lineasRecepcion.length,
                saldos_actualizados: saldosActualizados,
                movimientos: movimientosRegistrados.length,
            },
            descripcion: `Recepción #${idRecepcion} registrada sobre OC ${ocDespues.numero_oc} (nuevo estado: ${ocDespues.estado})`,
        },
        cliente
    );

    return {
        id_recepcion: idRecepcion,
        orden_compra: ocDespues,
        lineas_recepcion: lineasRecepcion,
        saldos_actualizados: saldosActualizados,
        movimientos_registrados: movimientosRegistrados,
        alertas_discrepancia_factura: alertasDiscrepanciaFactura,
    };
};

export const registrarRecepcionOrdenCompra = async (
    req: Request<
        { id: string },
        unknown,
        {
            items?: ItemRecepcionOrdenInput[];
            numero_factura?: string;
        }
    >,
    res: Response
): Promise<void> => {
    const idOrden = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);
    const itemsRecepcion = req.body?.items;
    const numeroFactura = req.body?.numero_factura;

    if (!Number.isInteger(idOrden) || idOrden <= 0) {
        res.status(400).json({ mensaje: 'Identificador de orden de compra inválido' });
        return;
    }

    if (!Array.isArray(itemsRecepcion) || itemsRecepcion.length === 0) {
        res.status(400).json({ mensaje: 'Debe indicar los ítems recibidos de la orden de compra' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion(async (cliente) =>
            ejecutarRecepcionOrdenCompraEnTransaccion(
                cliente,
                idOrden,
                itemsRecepcion,
                idEjecutor,
                numeroFactura
            )
        );

        res.status(200).json({
            mensaje: `Recepción registrada exitosamente. Estado de la OC: ${resultado.orden_compra.estado}`,
            id_recepcion: resultado.id_recepcion,
            orden_compra: resultado.orden_compra,
            lineas_recepcion: resultado.lineas_recepcion,
            saldos_actualizados: resultado.saldos_actualizados,
            movimientos_registrados: resultado.movimientos_registrados,
            alertas_discrepancia_factura: resultado.alertas_discrepancia_factura ?? [],
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar la recepción de la orden de compra');
    }
};

/**
 * [DB] Obtiene la trazabilidad completa de recepciones, recepcion_lineas (Conforme, Defectuoso, Faltante)
 * y movimientos_inventario (con saldo_historico y pmp_historico) vinculados a una Orden de Compra.
 */
export const obtenerTrazabilidadRecepcionOc = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const idOrden = Number(req.params.id);
    if (!Number.isInteger(idOrden) || idOrden <= 0) {
        res.status(400).json({ mensaje: 'Identificador de orden de compra inválido' });
        return;
    }

    try {
        const [recepcionesRes, lineasRes, movimientosRes] = await Promise.all([
            pool.query(
                `SELECT id_recepcion, id_orden_compra, id_usuario_bodeguero, numero_factura,
                        estado_resultante_oc::text AS estado_resultante_oc, observaciones, fecha_recepcion
                 FROM recepciones
                 WHERE id_orden_compra = $1
                 ORDER BY id_recepcion ASC`,
                [idOrden]
            ),
            pool.query(
                `SELECT rl.id_recepcion_linea, rl.id_recepcion, rl.id_oc_linea, rl.id_articulo,
                        rl.estado_linea::text AS estado_linea,
                        rl.cantidad::float8 AS cantidad,
                        rl.precio_unitario_ingreso::int AS precio_unitario_ingreso,
                        rl.fecha_registro
                 FROM recepcion_lineas rl
                 JOIN recepciones r ON r.id_recepcion = rl.id_recepcion
                 WHERE r.id_orden_compra = $1
                 ORDER BY rl.id_recepcion_linea ASC`,
                [idOrden]
            ),
            pool.query(
                `SELECT id_movimiento, id_insumo, id_orden_compra, id_recepcion, id_recepcion_linea,
                        tipo_movimiento::text AS tipo_movimiento, destino_bolsa,
                        cantidad::float8 AS cantidad,
                        costo_unitario::float8 AS costo_unitario,
                        saldo_historico::float8 AS saldo_historico,
                        pmp_historico::float8 AS pmp_historico,
                        valor_total_historico::float8 AS valor_total_historico,
                        referencia, id_usuario, fecha_movimiento
                 FROM movimientos_inventario
                 WHERE id_orden_compra = $1
                 ORDER BY id_movimiento ASC`,
                [idOrden]
            ),
        ]);

        res.status(200).json({
            id_orden_compra: idOrden,
            recepciones: recepcionesRes.rows,
            recepcion_lineas: lineasRes.rows,
            movimientos_inventario: movimientosRes.rows,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar la trazabilidad de recepción de la OC');
    }
};

/**
 * [BACK-1] Endpoint del motor automático de reposición por stock mínimo (H35 / H40 / H43).
 * Si recibe `id_articulo` o `sku`, evalúa ese insumo específico; si no, evalúa todo el catálogo.
 * Crea un único borrador de OC por insumo bajo mínimo (sin duplicar si ya hay una OC abierta)
 * y genera la alerta para H40, sin enviarla por correo hasta aprobación del Administrador.
 */
export const ejecutarMotorStockMinimo = async (
    req: Request<Record<string, string>, unknown, { id_articulo?: number; sku?: string }>,
    res: Response
): Promise<void> => {
    const idEjecutor = obtenerIdEjecutor(req);
    const { id_articulo, sku } = req.body ?? {};

    try {
        const resultados = await ejecutarTransaccion(async (cliente) => {
            if (id_articulo != null || (typeof sku === 'string' && sku.trim() !== '')) {
                let idArt = id_articulo != null ? Number(id_articulo) : NaN;
                if (!Number.isInteger(idArt) || idArt <= 0) {
                    const artRes = await cliente.query<{ id_articulo: number }>(
                        'SELECT id_articulo FROM articulo WHERE UPPER(sku) = UPPER($1) LIMIT 1',
                        [sku!.trim()]
                    );
                    if (artRes.rows.length === 0) {
                        throw new ErrorAplicacion(404, `Insumo con SKU '${sku}' no encontrado`);
                    }
                    idArt = Number(artRes.rows[0].id_articulo);
                }
                const evaluacion = await evaluarReposicionArticuloEnTransaccion(cliente, idArt, idEjecutor);
                if (!evaluacion) {
                    throw new ErrorAplicacion(404, 'Insumo no encontrado');
                }
                return [evaluacion];
            }

            return ejecutarMotorReposicionCatalogo(cliente, idEjecutor);
        });

        const creadas = resultados.filter((r) => r.creada);
        res.status(200).json({
            mensaje:
                creadas.length > 0
                    ? `Motor ejecutado: se generaron ${creadas.length} borrador(es) automático(s) de OC y alerta(s) H40`
                    : 'Motor ejecutado: no se generaron nuevos borradores de OC (sin insumos nuevos bajo mínimo o ya cuentan con OC abierta)',
            evaluados: resultados.length,
            creadas: creadas.length,
            resultados,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al ejecutar el motor automático de stock mínimo');
    }
};

/**
 * Lista las alertas H40 generadas por el motor automático de stock mínimo y órdenes de compra.
 */
export const listarAlertasReposicionH40 = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query<AlertaReposicionH40>(
            `SELECT id_alerta, tipo, severidad, titulo, descripcion,
                    id_articulo, id_orden_compra, leida, fecha_creacion
             FROM alertas_sistema
             ORDER BY id_alerta DESC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener las alertas de reposición H40');
    }
};

/**
 * [DB] Endpoint que expone la consulta optimizada de insumos activos con
 * `disponible <= stock_minimo` que no tienen ninguna OC abierta ('Borrador', 'Enviada' o 'Recibida parcial').
 */
export const listarInsumosPendientesReposicion = async (_req: Request, res: Response): Promise<void> => {
    try {
        const insumos = await detectarInsumosBajoMinimoSinOcAbierta(pool);
        res.status(200).json(insumos);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar insumos bajo mínimo sin OC abierta');
    }
};

/**
 * [FRONT-2] Calcula en el backend el desglose exacto de los 3 descuentos en cascada,
 * subtotal neto, IVA (19%), total y el aviso de discrepancia con la recepción de la OC.
 * Garantiza que los totales en pantalla coincidan peso a peso con el servidor.
 */
export const calcularDesgloseFactura = async (
    req: Request<
        Record<string, string>,
        unknown,
        {
            items?: LineaFacturaCascadaInput[];
            orden_compra?: OrdenCompraRecepcionReferencia | null;
        }
    >,
    res: Response
): Promise<void> => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const totales = calcularTotalesFacturaCascada(items);
    const discrepancias = detectarDiscrepanciasFacturaConRecepcion(items, req.body?.orden_compra);

    res.status(200).json({
        ...totales,
        discrepancias,
    });
};

/**
 * [FRONT-2] Registra una Factura de Compra con hasta 3 descuentos en cascada por ítem,
 * validando número de factura único por proveedor, calculando subtotal neto, IVA (19%) y total,
 * y detectando discrepancias frente a la recepción de la OC vinculada.
 */
export const registrarFacturaCompra = async (
    req: Request<
        Record<string, string>,
        unknown,
        {
            numero_factura?: string;
            id_proveedor?: number;
            proveedor_id?: number;
            id_orden_compra?: number | null;
            oc_id?: number | null;
            numero_oc?: string | null;
            items?: LineaFacturaCascadaInput[];
            orden_compra?: OrdenCompraRecepcionReferencia | null;
        }
    >,
    res: Response
): Promise<void> => {
    const idEjecutor = obtenerIdEjecutor(req);
    const numeroFactura = String(req.body?.numero_factura || '').trim();
    const idProveedor = Number(req.body?.proveedor_id ?? req.body?.id_proveedor ?? 0);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!numeroFactura) {
        res.status(400).json({ mensaje: 'El número de factura es obligatorio' });
        return;
    }
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
        res.status(400).json({ mensaje: 'Debe seleccionar un proveedor válido' });
        return;
    }
    if (items.length === 0) {
        res.status(400).json({ mensaje: 'La factura debe incluir al menos un ítem' });
        return;
    }

    const totales = calcularTotalesFacturaCascada(items);

    try {
        const resultado = await ejecutarTransaccion(async (cliente) => {
            const dupRes = await cliente.query<{ id_factura: number }>(
                `SELECT id_factura
                 FROM facturas_compra
                 WHERE proveedor_id = $1 AND LOWER(TRIM(numero_factura)) = LOWER(TRIM($2))
                 UNION ALL
                 SELECT id_factura
                 FROM factura
                 WHERE id_proveedor = $1 AND LOWER(TRIM(numero_factura)) = LOWER(TRIM($2))
                 LIMIT 1`,
                [idProveedor, numeroFactura]
            );
            if (dupRes.rows.length > 0) {
                throw new ErrorAplicacion(
                    409,
                    `La factura N° ${numeroFactura} ya fue ingresada para este proveedor.`
                );
            }

            const rawOcId = req.body?.oc_id ?? req.body?.id_orden_compra;
            let idOrdenCompra: number | null =
                rawOcId && Number(rawOcId) > 0 ? Number(rawOcId) : null;

            if (!idOrdenCompra && req.body?.numero_oc) {
                const ocRes = await cliente.query<{ id_orden_compra: number }>(
                    'SELECT id_orden_compra FROM ordenes_compra WHERE UPPER(TRIM(numero_oc)) = UPPER(TRIM($1)) LIMIT 1',
                    [String(req.body.numero_oc)]
                );
                if (ocRes.rows.length > 0) {
                    idOrdenCompra = Number(ocRes.rows[0].id_orden_compra);
                }
            }

            let ocRef: OrdenCompraRecepcionReferencia | null = req.body?.orden_compra ?? null;
            if (!ocRef && idOrdenCompra) {
                const ocCargada = await cargarOrdenCompraCompleta(cliente, idOrdenCompra);
                if (ocCargada) {
                    ocRef = {
                        code: ocCargada.numero_oc,
                        status: ocCargada.estado,
                        items: ocCargada.lineas.map((l) => ({
                            sku: l.sku,
                            name: l.nombre_articulo,
                            unit: l.unidad,
                            quantity: l.cantidad_orden,
                            unitPrice: l.precio_unitario,
                            receivedQuantity: l.cantidad_recibida,
                            defectiveQuantity: l.cantidad_defectuosa,
                            missingQuantity: l.saldo_pendiente,
                        })),
                    };
                }
            }

            const discrepancias = detectarDiscrepanciasFacturaConRecepcion(items, ocRef);

            const facCompraRes = await cliente.query<{ id_factura: number; fecha_emision: string }>(
                `INSERT INTO facturas_compra (
                    proveedor_id, numero_factura, oc_id,
                    subtotal_bruto, total_descuentos, subtotal_neto,
                    monto_iva, total_factura,
                    tiene_discrepancia_recepcion, detalle_discrepancia
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id_factura, fecha_emision::text AS fecha_emision`,
                [
                    idProveedor,
                    numeroFactura,
                    idOrdenCompra,
                    totales.subtotalGross,
                    totales.totalDiscounts,
                    totales.subtotalNet,
                    totales.iva,
                    totales.total,
                    discrepancias.tieneDiscrepancia,
                    discrepancias.resumenAlertas.join(' | ') || null,
                ]
            );
            const idFacturaCompra = Number(facCompraRes.rows[0].id_factura);

            const facRes = await cliente.query<{ id_factura: number; fecha_emision: string }>(
                `INSERT INTO factura (
                    numero_factura, id_proveedor, id_orden_compra,
                    subtotal_bruto, total_descuentos, subtotal_neto,
                    monto_iva, total_factura,
                    tiene_discrepancia_recepcion, detalle_discrepancia
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id_factura, fecha_emision::text AS fecha_emision`,
                [
                    numeroFactura,
                    idProveedor,
                    idOrdenCompra,
                    totales.subtotalGross,
                    totales.totalDiscounts,
                    totales.subtotalNet,
                    totales.iva,
                    totales.total,
                    discrepancias.tieneDiscrepancia,
                    discrepancias.resumenAlertas.join(' | ') || null,
                ]
            );
            const idFactura = Number(facRes.rows[0]?.id_factura ?? idFacturaCompra);
            const pmpActualizadosEnBd: {
                id_articulo: number;
                sku: string;
                cantidad_conforme_aplicada: number;
                costo_neto_factura: number;
                pmp_anterior: number;
                pmp_nuevo: number;
            }[] = [];
            let primerIdArticuloFactura: number | null = null;

            for (const linea of totales.lineas) {
                const artRes = await cliente.query<{ id_articulo: number; precio_unitario: number }>(
                    'SELECT id_articulo, precio_unitario::float8 AS precio_unitario FROM articulo WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1)) LIMIT 1',
                    [linea.sku]
                );
                const idArticulo = artRes.rows.length > 0 ? Number(artRes.rows[0].id_articulo) : 0;
                if (idArticulo > 0 && primerIdArticuloFactura === null) {
                    primerIdArticuloFactura = idArticulo;
                }
                if (idArticulo > 0) {
                    await cliente.query(
                        `INSERT INTO factura_lineas (
                            id_factura, id_articulo, cantidad,
                            precio_bruto, descuento_1_pct, descuento_2_pct, descuento_3_pct,
                            precio_unitario_neto
                        )
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            idFacturaCompra,
                            idArticulo,
                            linea.quantity,
                            linea.grossPrice,
                            linea.discount1Pct,
                            linea.discount2Pct,
                            linea.discount3Pct,
                            linea.netUnitPrice,
                        ]
                    );
                    await cliente.query(
                        `INSERT INTO factura_detalle (
                            id_factura, id_articulo, cantidad,
                            precio_bruto, descuento_1_pct, descuento_2_pct, descuento_3_pct,
                            precio_unitario
                        )
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            idFactura,
                            idArticulo,
                            linea.quantity,
                            linea.grossPrice,
                            linea.discount1Pct,
                            linea.discount2Pct,
                            linea.discount3Pct,
                            linea.netUnitPrice,
                        ]
                    );

                    // [BACK-1] Si la OC vinculada ya registra recepción conforme en bodega para este insumo,
                    // recalcular inmediatamente el PMP en base de datos usando el costo neto exacto de la factura
                    // con la fórmula: (valor stock actual + valor ingreso neto) / (stock actual + cantidad ingresada).
                    const itemOcRecibido = ocRef?.items.find(
                        (it) => it.sku.trim().toUpperCase() === linea.sku.trim().toUpperCase()
                    );
                    const cantRecibidaConforme = Number(itemOcRecibido?.receivedQuantity || 0);
                    if (cantRecibidaConforme > 0) {
                        const stockRes = await cliente.query<{
                            cantidad_disponible: number;
                            pmp: number;
                        }>(
                            `SELECT COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible,
                                    COALESCE(pmp, 0)::float8 AS pmp
                             FROM articulos_stock
                             WHERE id_articulo = $1
                             LIMIT 1`,
                            [idArticulo]
                        );
                        if (stockRes.rows.length > 0) {
                            const dispTotalActual = Number(stockRes.rows[0].cantidad_disponible);
                            const pmpRegistrado =
                                Number(stockRes.rows[0].pmp) > 0
                                    ? Number(stockRes.rows[0].pmp)
                                    : Number(artRes.rows[0].precio_unitario || linea.grossPrice);
                            const costoProvisionalOc = Number(
                                itemOcRecibido?.unitPrice || artRes.rows[0].precio_unitario || pmpRegistrado
                            );
                            const stockAntesDeRecepcion = Math.max(
                                0,
                                Number((dispTotalActual - cantRecibidaConforme).toFixed(3))
                            );
                            const valorAntesDeRecepcion = Math.max(
                                0,
                                dispTotalActual * pmpRegistrado - cantRecibidaConforme * costoProvisionalOc
                            );
                            const pmpAntesDeRecepcion =
                                stockAntesDeRecepcion > 0
                                    ? valorAntesDeRecepcion / stockAntesDeRecepcion
                                    : pmpRegistrado;

                            const nuevoPmpExacto = calcularPmpHistorico(
                                stockAntesDeRecepcion,
                                pmpAntesDeRecepcion,
                                cantRecibidaConforme,
                                linea.netUnitPrice
                            );

                            await cliente.query(
                                `UPDATE articulos_stock
                                 SET pmp = $2
                                 WHERE id_articulo = $1`,
                                [idArticulo, nuevoPmpExacto]
                            );
                            await cliente.query(
                                `UPDATE movimientos_inventario
                                 SET costo_unitario = $3,
                                     pmp_historico = $4,
                                     valor_total_historico = ROUND(saldo_historico * $4)
                                 WHERE id_orden_compra = $1 AND id_insumo = $2 AND destino_bolsa = 'disponible'`,
                                [idOrdenCompra, idArticulo, linea.netUnitPrice, nuevoPmpExacto]
                            );

                            pmpActualizadosEnBd.push({
                                id_articulo: idArticulo,
                                sku: linea.sku,
                                cantidad_conforme_aplicada: cantRecibidaConforme,
                                costo_neto_factura: linea.netUnitPrice,
                                pmp_anterior: Math.round((pmpAntesDeRecepcion + Number.EPSILON) * 100) / 100,
                                pmp_nuevo: nuevoPmpExacto,
                            });
                        }
                    }
                }
            }

            let alertaGenerada: AlertaReposicionH40 | null = null;
            if (discrepancias.tieneDiscrepancia) {
                const codigoOcTexto = discrepancias.codigoOc || (idOrdenCompra ? `OC #${idOrdenCompra}` : 'OC');
                const alertaRes = await cliente.query<AlertaReposicionH40>(
                    `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
                     VALUES ('discrepancia_factura_recepcion', 'rojo', $1, $2, $3, $4, FALSE)
                     RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida, fecha_creacion::text AS fecha_creacion`,
                    [
                        `Discrepancia Factura ${numeroFactura} vs Recepción ${codigoOcTexto}`,
                        `Contraste automático H33 detectó discrepancia en Factura N° ${numeroFactura} (${codigoOcTexto}): ${discrepancias.resumenAlertas.join(' | ')}`,
                        primerIdArticuloFactura,
                        idOrdenCompra,
                    ]
                );
                alertaGenerada = alertaRes.rows[0] ?? null;
            }

            await registrarAuditoria(
                {
                    entidad: 'factura',
                    accion: 'registrar_factura_compra',
                    idRegistro: idFactura,
                    idUsuarioEjecutor: idEjecutor,
                    estadoAnterior: null,
                    estadoNuevo: {
                        numero_factura: numeroFactura,
                        id_proveedor: idProveedor,
                        id_orden_compra: idOrdenCompra,
                        subtotal_bruto: totales.subtotalGross,
                        total_descuentos: totales.totalDiscounts,
                        subtotal_neto: totales.subtotalNet,
                        iva: totales.iva,
                        total: totales.total,
                        tiene_discrepancia: discrepancias.tieneDiscrepancia,
                        id_alerta_generada: alertaGenerada?.id_alerta ?? null,
                    },
                    descripcion: `Factura ${numeroFactura} registrada (Neto: $${totales.subtotalNet}, IVA: $${totales.iva}, Total: $${totales.total}${discrepancias.tieneDiscrepancia ? ' - CON DISCREPANCIA H33' : ''})`,
                },
                cliente
            );

            return {
                id_factura: idFacturaCompra || idFactura,
                numero_factura: numeroFactura,
                id_proveedor: idProveedor,
                proveedor_id: idProveedor,
                id_orden_compra: idOrdenCompra,
                oc_id: idOrdenCompra,
                ...totales,
                discrepancias,
                alerta_generada: alertaGenerada,
                pmp_actualizados: pmpActualizadosEnBd,
            };
        });

        res.status(201).json({
            mensaje: `Factura N° ${numeroFactura} registrada exitosamente`,
            factura: resultado,
        });
    } catch (error: any) {
        if (error && error.code === '23505') {
            res.status(409).json({
                mensaje: `La factura N° ${numeroFactura} ya fue ingresada para este proveedor.`,
            });
            return;
        }
        enviarErrorHttp(res, error, 'Error al registrar la factura de compra');
    }
};

/**
 * [DB] Inserta una Factura de Compra en `facturas_compra` y sus líneas con hasta 3 descuentos
 * porcentuales en `factura_lineas` dentro de una transacción, garantizando la restricción única
 * `(proveedor_id, numero_factura)` y el vínculo opcional a `oc_id`.
 */
export const insertarFacturaCompraEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        proveedor_id: number;
        numero_factura: string;
        oc_id?: number | null;
        items: LineaFacturaCascadaInput[];
    }
): Promise<{
    id_factura: number;
    proveedor_id: number;
    numero_factura: string;
    oc_id: number | null;
    subtotal_bruto: number;
    total_descuentos: number;
    subtotal_neto: number;
    monto_iva: number;
    total_factura: number;
    lineas: {
        id_factura_linea: number;
        id_factura: number;
        id_articulo: number;
        sku: string;
        cantidad: number;
        precio_bruto: number;
        descuento_1_pct: number;
        descuento_2_pct: number;
        descuento_3_pct: number;
        precio_unitario_neto: number;
        subtotal_neto: number;
    }[];
}> => {
    const proveedorId = Number(datos.proveedor_id);
    const numeroFactura = String(datos.numero_factura || '').trim();
    const ocId = datos.oc_id && Number(datos.oc_id) > 0 ? Number(datos.oc_id) : null;

    if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
        throw new ErrorAplicacion(400, 'proveedor_id inválido');
    }
    if (!numeroFactura) {
        throw new ErrorAplicacion(400, 'numero_factura es obligatorio');
    }

    const dup = await cliente.query<{ id_factura: number }>(
        `SELECT id_factura
         FROM facturas_compra
         WHERE proveedor_id = $1 AND LOWER(TRIM(numero_factura)) = LOWER(TRIM($2))
         LIMIT 1`,
        [proveedorId, numeroFactura]
    );
    if (dup.rows.length > 0) {
        throw new ErrorAplicacion(
            409,
            `Restricción única violada (proveedor_id + numero_factura): la factura N° ${numeroFactura} ya existe para el proveedor ${proveedorId}.`
        );
    }

    const totales = calcularTotalesFacturaCascada(datos.items || []);

    const cab = await cliente.query<{ id_factura: number }>(
        `INSERT INTO facturas_compra (
            proveedor_id, numero_factura, oc_id,
            subtotal_bruto, total_descuentos, subtotal_neto,
            monto_iva, total_factura
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_factura`,
        [
            proveedorId,
            numeroFactura,
            ocId,
            totales.subtotalGross,
            totales.totalDiscounts,
            totales.subtotalNet,
            totales.iva,
            totales.total,
        ]
    );
    const idFactura = Number(cab.rows[0].id_factura);

    const lineasInsertadas: {
        id_factura_linea: number;
        id_factura: number;
        id_articulo: number;
        sku: string;
        cantidad: number;
        precio_bruto: number;
        descuento_1_pct: number;
        descuento_2_pct: number;
        descuento_3_pct: number;
        precio_unitario_neto: number;
        subtotal_neto: number;
    }[] = [];

    for (const l of totales.lineas) {
        const artRes = await cliente.query<{ id_articulo: number }>(
            'SELECT id_articulo FROM articulo WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1)) LIMIT 1',
            [l.sku]
        );
        const idArticulo = artRes.rows.length > 0 ? Number(artRes.rows[0].id_articulo) : 1;
        const linRes = await cliente.query<{ id_factura_linea: number }>(
            `INSERT INTO factura_lineas (
                id_factura, id_articulo, cantidad,
                precio_bruto, descuento_1_pct, descuento_2_pct, descuento_3_pct,
                precio_unitario_neto
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id_factura_linea`,
            [
                idFactura,
                idArticulo,
                l.quantity,
                l.grossPrice,
                l.discount1Pct,
                l.discount2Pct,
                l.discount3Pct,
                l.netUnitPrice,
            ]
        );
        lineasInsertadas.push({
            id_factura_linea: Number(linRes.rows[0].id_factura_linea),
            id_factura: idFactura,
            id_articulo: idArticulo,
            sku: l.sku,
            cantidad: l.quantity,
            precio_bruto: l.grossPrice,
            descuento_1_pct: l.discount1Pct,
            descuento_2_pct: l.discount2Pct,
            descuento_3_pct: l.discount3Pct,
            precio_unitario_neto: l.netUnitPrice,
            subtotal_neto: l.subtotalNet,
        });
    }

    return {
        id_factura: idFactura,
        proveedor_id: proveedorId,
        numero_factura: numeroFactura,
        oc_id: ocId,
        subtotal_bruto: totales.subtotalGross,
        total_descuentos: totales.totalDiscounts,
        subtotal_neto: totales.subtotalNet,
        monto_iva: totales.iva,
        total_factura: totales.total,
        lineas: lineasInsertadas,
    };
};


