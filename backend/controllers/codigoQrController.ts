import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import {
    ESTADO_QR_ASIGNADO_OBJETO,
    ESTADO_QR_IMPRESO,
    ESTADO_QR_PENDIENTE_IMPRESION,
    EstadoAsignacionQr,
    EtiquetaQrExportable,
    PayloadQrInsumoH35,
    TAMANO_IMPRESION_QR_MM_DEFECTO,
    construirPayloadQrH35,
    decodificarPayloadQrEscanerH18,
    extraerTerminoBusquedaEscanerH18,
    FormatoCodigoDetectadoH18,
    generarPdfEtiquetasQrLote,
    generarPngEtiquetasQrLote,
} from '../services/codigoQrService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export interface CodigoQrInsumoRegistrado {
    id_codigo_qr: number;
    codigo_qr: string;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    unidad_medida: string;
    categoria: string;
    ubicacion: string;
    lote: string | null;
    payload_qr: string;
    payload_objeto: PayloadQrInsumoH35;
    estado_asignacion: EstadoAsignacionQr;
    asignado_objeto_fisico: boolean;
    id_usuario_creador: number | null;
    fecha_creacion: string;
}

export interface ResultadoExportacionQrLote {
    formato: 'pdf' | 'png';
    mime_type: 'application/pdf' | 'image/png';
    nombre_archivo: string;
    tamano_impresion_mm: number;
    ancho: number;
    alto: number;
    cantidad_etiquetas: number;
    marcado_como_asignado: boolean;
    etiquetas: EtiquetaQrExportable[];
    contenido_base64: string;
    buffer: Buffer;
}

const obtenerTamanoImpresionQrH39 = async (
    cliente: Pick<PoolClient, 'query'>,
    overrideMm?: unknown
): Promise<number> => {
    if (overrideMm !== undefined && overrideMm !== null && overrideMm !== '') {
        const num = Number(overrideMm);
        if (!Number.isFinite(num) || num < 20 || num > 150) {
            throw new ErrorAplicacion(400, 'El tamaño de impresión QR debe estar entre 20 y 150 mm');
        }
        return Math.round(num);
    }
    const res = await cliente.query<{ valor: number }>(
        `/* qr:select-tamano-h39 */
         SELECT valor FROM parametro_sistema WHERE clave = 'tamano_impresion_qr_mm' LIMIT 1`
    );
    const val = Number(res.rows?.[0]?.valor);
    return Number.isFinite(val) && val >= 20 ? Math.round(val) : TAMANO_IMPRESION_QR_MM_DEFECTO;
};

/**
 * [BACK-1] Genera uno o varios códigos QR únicos para un insumo del catálogo H35,
 * codificando SKU, nombre y unidad de medida en un payload compatible con el escáner H18,
 * y registra cada creación en la bitácora de auditoría (H14).
 */
export const generarCodigosQrInsumoEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        id_articulo?: number;
        sku?: string;
        cantidad?: unknown;
        codigo_qr?: string | null;
        ubicacion?: string | null;
        lote?: string | null;
        marcar_asignado?: boolean;
    },
    idAdmin: number | null
): Promise<CodigoQrInsumoRegistrado[]> => {
    const idArt = Number(datos.id_articulo ?? 0);
    const skuInput = typeof datos.sku === 'string' ? datos.sku.trim() : '';
    if ((!Number.isInteger(idArt) || idArt <= 0) && !skuInput) {
        throw new ErrorAplicacion(400, 'Debe indicar el insumo de H35 (id_articulo o sku) para generar códigos QR');
    }

    const rawCantidad = datos.cantidad !== undefined ? Number(datos.cantidad) : 1;
    if (!Number.isInteger(rawCantidad) || rawCantidad < 1 || rawCantidad > 100) {
        throw new ErrorAplicacion(400, 'La cantidad de códigos QR a generar debe ser un entero entre 1 y 100');
    }
    if (rawCantidad > 1 && datos.codigo_qr) {
        throw new ErrorAplicacion(400, 'No se puede fijar un mismo codigo_qr personalizado al generar múltiples unidades');
    }

    // 1. Consultar datos del insumo en el catálogo H35 (SKU, nombre, unidad de medida, categoría y ubicación)
    const artRes = await cliente.query<{
        id_articulo: number;
        sku: string | null;
        nombre_articulo: string;
        categoria: string | null;
        unidad_medida: string;
        ubicacion: string | null;
        activo: boolean;
    }>(
        idArt > 0
            ? `/* qr:select-insumo */
               SELECT a.id_articulo,
                      a.sku,
                      a.nombre_articulo,
                      a.categoria::text AS categoria,
                      COALESCE(um.codigo, um.nombre, 'un') AS unidad_medida,
                      s.ubicacion,
                      a.activo
               FROM articulo a
               LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
               LEFT JOIN unidades_medida um ON um.id_unidad = COALESCE(a.id_unidad, i.id_unidad)
               LEFT JOIN articulos_stock s ON s.id_articulo = a.id_articulo
               WHERE a.id_articulo = $1
               LIMIT 1`
            : `/* qr:select-insumo-sku */
               SELECT a.id_articulo,
                      a.sku,
                      a.nombre_articulo,
                      a.categoria::text AS categoria,
                      COALESCE(um.codigo, um.nombre, 'un') AS unidad_medida,
                      s.ubicacion,
                      a.activo
               FROM articulo a
               LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
               LEFT JOIN unidades_medida um ON um.id_unidad = COALESCE(a.id_unidad, i.id_unidad)
               LEFT JOIN articulos_stock s ON s.id_articulo = a.id_articulo
               WHERE UPPER(TRIM(a.sku)) = UPPER(TRIM($1))
               LIMIT 1`,
        [idArt > 0 ? idArt : skuInput]
    );

    const insumo = artRes.rows?.[0];
    if (!insumo) {
        throw new ErrorAplicacion(404, 'El insumo indicado no existe en el catálogo H35');
    }
    if (insumo.activo === false) {
        throw new ErrorAplicacion(400, `El insumo "${insumo.nombre_articulo}" se encuentra inactivo`);
    }

    const skuFinal = (insumo.sku && insumo.sku.trim()) || `INS-${insumo.id_articulo}`;
    const unidadFinal = (insumo.unidad_medida && insumo.unidad_medida.trim()) || 'un';
    const categoriaFinal = (insumo.categoria && insumo.categoria.trim()) || 'Materiales';
    const ubicacionFinal =
        (typeof datos.ubicacion === 'string' && datos.ubicacion.trim()) ||
        (insumo.ubicacion && insumo.ubicacion.trim()) ||
        'Bodega Central';
    const loteFinal = typeof datos.lote === 'string' && datos.lote.trim() ? datos.lote.trim().slice(0, 80) : null;
    const asignadoInicial = Boolean(datos.marcar_asignado);
    const estadoInicial: EstadoAsignacionQr = asignadoInicial
        ? ESTADO_QR_ASIGNADO_OBJETO
        : ESTADO_QR_PENDIENTE_IMPRESION;

    const generados: CodigoQrInsumoRegistrado[] = [];

    for (let i = 0; i < rawCantidad; i += 1) {
        const seqRes = await cliente.query<{ correlativo: number }>(
            `/* qr:nextval */
             SELECT nextval('seq_codigo_qr_insumo')::int AS correlativo`
        );
        const correlativo = Number(seqRes.rows?.[0]?.correlativo ?? i + 1);

        const { codigo_qr, payload_objeto, payload_qr } = construirPayloadQrH35({
            idArticulo: insumo.id_articulo,
            sku: skuFinal,
            nombreArticulo: insumo.nombre_articulo,
            unidadMedida: unidadFinal,
            correlativo,
            codigoQrPersonalizado: datos.codigo_qr,
            categoria: categoriaFinal,
            ubicacion: ubicacionFinal,
            lote: loteFinal,
        });

        const dupRes = await cliente.query<{ id_codigo_qr: number; id_articulo: number }>(
            `/* qr:check-duplicado */
             SELECT id_codigo_qr, id_articulo
             FROM codigos_qr_insumos
             WHERE UPPER(codigo_qr) = UPPER($1)
             LIMIT 1`,
            [codigo_qr]
        );
        if (dupRes.rows && dupRes.rows.length > 0) {
            throw new ErrorAplicacion(
                409,
                `El código QR "${codigo_qr}" ya existe y está asociado al insumo #${dupRes.rows[0].id_articulo}; no puede repetirse`
            );
        }

        const insQr = await cliente.query<{ id_codigo_qr: number; fecha_creacion: string }>(
            `/* qr:insert-codigo */
             INSERT INTO codigos_qr_insumos (
                 codigo_qr, id_articulo, sku, nombre_articulo, unidad_medida,
                 categoria, ubicacion, lote, payload_qr, id_usuario_creador,
                 estado_asignacion, asignado_objeto_fisico, fecha_asignacion
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $12 THEN CURRENT_TIMESTAMP ELSE NULL END)
             RETURNING id_codigo_qr, fecha_creacion::text AS fecha_creacion`,
            [
                codigo_qr,
                insumo.id_articulo,
                skuFinal,
                insumo.nombre_articulo,
                unidadFinal,
                categoriaFinal,
                ubicacionFinal,
                loteFinal,
                payload_qr,
                idAdmin,
                estadoInicial,
                asignadoInicial,
            ]
        );
        const idCodigoQr = Number(insQr.rows[0].id_codigo_qr);
        const fechaCreacion = insQr.rows[0].fecha_creacion || payload_objeto.generadoEn;

        await registrarAuditoria(
            {
                entidad: 'codigo_qr_insumo',
                accion: 'generar_qr',
                idRegistro: idCodigoQr,
                idUsuarioEjecutor: idAdmin,
                estadoAnterior: null,
                estadoNuevo: {
                    id_codigo_qr: idCodigoQr,
                    codigo_qr,
                    id_articulo: insumo.id_articulo,
                    sku: skuFinal,
                    nombre_articulo: insumo.nombre_articulo,
                    unidad_medida: unidadFinal,
                    ubicacion: ubicacionFinal,
                    lote: loteFinal,
                    estado_asignacion: estadoInicial,
                    asignado_objeto_fisico: asignadoInicial,
                },
                descripcion: `Código QR ${codigo_qr} generado para insumo ${skuFinal} (${insumo.nombre_articulo}, unidad: ${unidadFinal})`,
            },
            cliente
        );

        generados.push({
            id_codigo_qr: idCodigoQr,
            codigo_qr,
            id_articulo: insumo.id_articulo,
            sku: skuFinal,
            nombre_articulo: insumo.nombre_articulo,
            unidad_medida: unidadFinal,
            categoria: categoriaFinal,
            ubicacion: ubicacionFinal,
            lote: loteFinal,
            payload_qr,
            payload_objeto,
            estado_asignacion: estadoInicial,
            asignado_objeto_fisico: asignadoInicial,
            id_usuario_creador: idAdmin,
            fecha_creacion: fechaCreacion,
        });
    }

    return generados;
};

/**
 * [BACK-2] Exporta uno o varios códigos QR en lote a formato imprimible (PDF o PNG)
 * incluyendo SKU y nombre del insumo en texto legible, aplicando el tamaño configurado en H39,
 * permitiendo marcar los códigos como "Asignado a objeto físico" y registrando la exportación en auditoría (H14).
 */
export const exportarCodigosQrLoteEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        formato?: unknown;
        ids_codigo_qr?: unknown;
        codigos_qr?: unknown;
        id_codigo_qr?: unknown;
        codigo_qr?: unknown;
        tamano_mm?: unknown;
        marcar_asignado?: unknown;
        asignar_objeto_fisico?: unknown;
    },
    idAdmin: number | null
): Promise<ResultadoExportacionQrLote> => {
    const rawFormato = String(datos.formato ?? 'pdf').trim().toLowerCase();
    if (rawFormato !== 'pdf' && rawFormato !== 'png') {
        throw new ErrorAplicacion(400, 'El formato de exportación debe ser "pdf" o "png"');
    }
    const formato = rawFormato as 'pdf' | 'png';

    const idsSolicitados: number[] = [];
    if (Array.isArray(datos.ids_codigo_qr)) {
        for (const id of datos.ids_codigo_qr) {
            const num = Number(id);
            if (!Number.isInteger(num) || num <= 0) {
                throw new ErrorAplicacion(400, 'Todos los ids_codigo_qr deben ser enteros positivos');
            }
            if (!idsSolicitados.includes(num)) idsSolicitados.push(num);
        }
    } else if (datos.id_codigo_qr !== undefined && datos.id_codigo_qr !== null) {
        const num = Number(datos.id_codigo_qr);
        if (!Number.isInteger(num) || num <= 0) {
            throw new ErrorAplicacion(400, 'id_codigo_qr debe ser un entero positivo');
        }
        idsSolicitados.push(num);
    }

    const codigosTexto: string[] = [];
    if (Array.isArray(datos.codigos_qr)) {
        for (const c of datos.codigos_qr) {
            if (typeof c === 'string' && c.trim()) {
                codigosTexto.push(c.trim().toUpperCase());
            }
        }
    } else if (typeof datos.codigo_qr === 'string' && datos.codigo_qr.trim()) {
        codigosTexto.push(datos.codigo_qr.trim().toUpperCase());
    }

    if (idsSolicitados.length === 0 && codigosTexto.length === 0) {
        throw new ErrorAplicacion(
            400,
            'Debe indicar al menos un código QR (ids_codigo_qr o codigos_qr) para exportar'
        );
    }

    const tamanoMm = await obtenerTamanoImpresionQrH39(cliente, datos.tamano_mm);
    const marcarAsignado = Boolean(datos.marcar_asignado ?? datos.asignar_objeto_fisico ?? false);

    const filasRes = await cliente.query<{
        id_codigo_qr: number;
        codigo_qr: string;
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        unidad_medida: string;
        ubicacion: string | null;
        lote: string | null;
        payload_qr: string;
        estado_asignacion: EstadoAsignacionQr;
        asignado_objeto_fisico: boolean;
    }>(
        idsSolicitados.length > 0
            ? `/* qr:select-lote-ids */
               SELECT id_codigo_qr, codigo_qr, id_articulo, sku, nombre_articulo, unidad_medida,
                      ubicacion, lote, payload_qr,
                      COALESCE(estado_asignacion, 'Pendiente de impresión') AS estado_asignacion,
                      COALESCE(asignado_objeto_fisico, FALSE) AS asignado_objeto_fisico
               FROM codigos_qr_insumos
               WHERE id_codigo_qr = ANY($1::int[])
               ORDER BY id_codigo_qr ASC
               FOR UPDATE`
            : `/* qr:select-lote-codigos */
               SELECT id_codigo_qr, codigo_qr, id_articulo, sku, nombre_articulo, unidad_medida,
                      ubicacion, lote, payload_qr,
                      COALESCE(estado_asignacion, 'Pendiente de impresión') AS estado_asignacion,
                      COALESCE(asignado_objeto_fisico, FALSE) AS asignado_objeto_fisico
               FROM codigos_qr_insumos
               WHERE UPPER(codigo_qr) = ANY($1::text[])
               ORDER BY id_codigo_qr ASC
               FOR UPDATE`,
        [idsSolicitados.length > 0 ? idsSolicitados : codigosTexto]
    );

    const filas = filasRes.rows ?? [];
    const totalEsperado = idsSolicitados.length > 0 ? idsSolicitados.length : codigosTexto.length;
    if (filas.length === 0 || filas.length < totalEsperado) {
        throw new ErrorAplicacion(404, 'Uno o más códigos QR solicitados para exportar no existen');
    }

    const etiquetasActualizadas: EtiquetaQrExportable[] = [];
    for (const fila of filas) {
        const nuevoAsignado = marcarAsignado || Boolean(fila.asignado_objeto_fisico);
        const nuevoEstado: EstadoAsignacionQr = nuevoAsignado
            ? ESTADO_QR_ASIGNADO_OBJETO
            : ESTADO_QR_IMPRESO;

        await cliente.query(
            `/* qr:update-exportacion */
             UPDATE codigos_qr_insumos
             SET estado_asignacion = $2,
                 asignado_objeto_fisico = $3,
                 fecha_asignacion = CASE WHEN $3 AND fecha_asignacion IS NULL THEN CURRENT_TIMESTAMP ELSE fecha_asignacion END,
                 fecha_ultima_exportacion = CURRENT_TIMESTAMP
             WHERE id_codigo_qr = $1`,
            [fila.id_codigo_qr, nuevoEstado, nuevoAsignado]
        );

        etiquetasActualizadas.push({
            id_codigo_qr: Number(fila.id_codigo_qr),
            codigo_qr: fila.codigo_qr,
            id_articulo: Number(fila.id_articulo),
            sku: fila.sku,
            nombre_articulo: fila.nombre_articulo,
            unidad_medida: fila.unidad_medida,
            ubicacion: fila.ubicacion,
            lote: fila.lote,
            payload_qr: fila.payload_qr,
            estado_asignacion: nuevoEstado,
            asignado_objeto_fisico: nuevoAsignado,
        });
    }

    let buffer: Buffer;
    let ancho: number;
    let alto: number;
    let mimeType: 'application/pdf' | 'image/png';

    if (formato === 'pdf') {
        const pdfGen = generarPdfEtiquetasQrLote(etiquetasActualizadas, tamanoMm);
        buffer = pdfGen.buffer;
        ancho = pdfGen.ancho_pt;
        alto = pdfGen.alto_pt;
        mimeType = 'application/pdf';
    } else {
        const pngGen = generarPngEtiquetasQrLote(etiquetasActualizadas, tamanoMm);
        buffer = pngGen.buffer;
        ancho = pngGen.ancho_px;
        alto = pngGen.alto_px;
        mimeType = 'image/png';
    }

    const nombreArchivo =
        etiquetasActualizadas.length === 1
            ? `${etiquetasActualizadas[0].codigo_qr}-${tamanoMm}mm.${formato}`
            : `lote-qr-${etiquetasActualizadas.length}-etiquetas-${tamanoMm}mm.${formato}`;

    await registrarAuditoria(
        {
            entidad: 'codigo_qr_insumo',
            accion: 'exportar_qr_lote',
            idRegistro: etiquetasActualizadas[0].id_codigo_qr,
            idUsuarioEjecutor: idAdmin,
            estadoAnterior: null,
            estadoNuevo: {
                formato: formato.toUpperCase(),
                tamano_impresion_mm: tamanoMm,
                cantidad_codigos: etiquetasActualizadas.length,
                marcado_como_asignado: marcarAsignado,
                codigos_qr: etiquetasActualizadas.map((e) => ({
                    id_codigo_qr: e.id_codigo_qr,
                    codigo_qr: e.codigo_qr,
                    sku: e.sku,
                    nombre_articulo: e.nombre_articulo,
                    estado_asignacion: e.estado_asignacion,
                    asignado_objeto_fisico: e.asignado_objeto_fisico,
                })),
            },
            descripcion:
                `Exportación en lote de ${etiquetasActualizadas.length} código(s) QR en formato ${formato.toUpperCase()} ` +
                `(tamaño H39: ${tamanoMm} mm)${marcarAsignado ? ' marcados como Asignado a objeto físico' : ''}`,
        },
        cliente
    );

    return {
        formato,
        mime_type: mimeType,
        nombre_archivo: nombreArchivo,
        tamano_impresion_mm: tamanoMm,
        ancho,
        alto,
        cantidad_etiquetas: etiquetasActualizadas.length,
        marcado_como_asignado: marcarAsignado,
        etiquetas: etiquetasActualizadas,
        contenido_base64: buffer.toString('base64'),
        buffer,
    };
};

/**
 * [BACK-2] Marca un código QR existente como "Asignado a objeto físico" y lo registra en auditoría (H14).
 */
export const marcarCodigoQrAsignadoEnTransaccion = async (
    cliente: PoolClient,
    idCodigoQr: number,
    datos: { ubicacion?: string | null; lote?: string | null } = {},
    idAdmin: number | null
): Promise<EtiquetaQrExportable> => {
    if (!Number.isInteger(idCodigoQr) || idCodigoQr <= 0) {
        throw new ErrorAplicacion(400, 'Identificador de código QR inválido');
    }

    const res = await cliente.query<{
        id_codigo_qr: number;
        codigo_qr: string;
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        unidad_medida: string;
        ubicacion: string | null;
        lote: string | null;
        payload_qr: string;
        estado_asignacion: EstadoAsignacionQr;
        asignado_objeto_fisico: boolean;
    }>(
        `/* qr:select-por-id */
         SELECT id_codigo_qr, codigo_qr, id_articulo, sku, nombre_articulo, unidad_medida,
                ubicacion, lote, payload_qr,
                COALESCE(estado_asignacion, 'Pendiente de impresión') AS estado_asignacion,
                COALESCE(asignado_objeto_fisico, FALSE) AS asignado_objeto_fisico
         FROM codigos_qr_insumos
         WHERE id_codigo_qr = $1
         FOR UPDATE`,
        [idCodigoQr]
    );
    const fila = res.rows?.[0];
    if (!fila) {
        throw new ErrorAplicacion(404, 'Código QR no encontrado');
    }

    const ubicacionNueva =
        typeof datos.ubicacion === 'string' && datos.ubicacion.trim()
            ? datos.ubicacion.trim().slice(0, 120)
            : fila.ubicacion;

    await cliente.query(
        `/* qr:update-asignar */
         UPDATE codigos_qr_insumos
         SET estado_asignacion = $2,
             asignado_objeto_fisico = TRUE,
             ubicacion = $3,
             fecha_asignacion = CURRENT_TIMESTAMP
         WHERE id_codigo_qr = $1`,
        [idCodigoQr, ESTADO_QR_ASIGNADO_OBJETO, ubicacionNueva]
    );

    await registrarAuditoria(
        {
            entidad: 'codigo_qr_insumo',
            accion: 'asignar_qr_objeto_fisico',
            idRegistro: idCodigoQr,
            idUsuarioEjecutor: idAdmin,
            estadoAnterior: {
                estado_asignacion: fila.estado_asignacion,
                asignado_objeto_fisico: fila.asignado_objeto_fisico,
            },
            estadoNuevo: {
                id_codigo_qr: idCodigoQr,
                codigo_qr: fila.codigo_qr,
                sku: fila.sku,
                nombre_articulo: fila.nombre_articulo,
                estado_asignacion: ESTADO_QR_ASIGNADO_OBJETO,
                asignado_objeto_fisico: true,
                ubicacion: ubicacionNueva,
            },
            descripcion: `Código QR ${fila.codigo_qr} (${fila.sku}) marcado como Asignado a objeto físico`,
        },
        cliente
    );

    return {
        id_codigo_qr: Number(fila.id_codigo_qr),
        codigo_qr: fila.codigo_qr,
        id_articulo: Number(fila.id_articulo),
        sku: fila.sku,
        nombre_articulo: fila.nombre_articulo,
        unidad_medida: fila.unidad_medida,
        ubicacion: ubicacionNueva,
        lote: fila.lote,
        payload_qr: fila.payload_qr,
        estado_asignacion: ESTADO_QR_ASIGNADO_OBJETO,
        asignado_objeto_fisico: true,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const generarCodigoQrInsumo = async (req: Request, res: Response): Promise<void> => {
    try {
        const idAdmin = obtenerIdEjecutor(req);
        const idArtParam = req.params.id ? Number(req.params.id) : undefined;
        const codigos = await ejecutarTransaccion((cliente) =>
            generarCodigosQrInsumoEnTransaccion(
                cliente,
                {
                    ...(req.body ?? {}),
                    ...(idArtParam ? { id_articulo: idArtParam } : {}),
                },
                idAdmin
            )
        );

        res.status(201).json({
            mensaje:
                codigos.length === 1
                    ? `Código QR ${codigos[0].codigo_qr} generado y auditado exitosamente.`
                    : `${codigos.length} códigos QR generados y auditados exitosamente para ${codigos[0].sku}.`,
            codigo_qr: codigos[0],
            codigos_qr: codigos,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al generar el código QR del insumo');
    }
};

export const exportarCodigosQrLote = async (req: Request, res: Response): Promise<void> => {
    try {
        const idAdmin = obtenerIdEjecutor(req);
        const idsQuery =
            typeof req.query.ids === 'string' && req.query.ids.trim()
                ? req.query.ids.split(',').map((x) => Number(x.trim()))
                : undefined;

        const resultado = await ejecutarTransaccion((cliente) =>
            exportarCodigosQrLoteEnTransaccion(
                cliente,
                {
                    formato: req.body?.formato ?? req.query.formato ?? 'pdf',
                    ids_codigo_qr: req.body?.ids_codigo_qr ?? idsQuery,
                    codigos_qr: req.body?.codigos_qr,
                    id_codigo_qr: req.body?.id_codigo_qr ?? (req.query.id_codigo_qr ? Number(req.query.id_codigo_qr) : undefined),
                    codigo_qr: req.body?.codigo_qr ?? req.query.codigo_qr,
                    tamano_mm: req.body?.tamano_mm ?? req.query.tamano_mm,
                    marcar_asignado: req.body?.marcar_asignado ?? (req.query.marcar_asignado === 'true'),
                    asignar_objeto_fisico: req.body?.asignar_objeto_fisico,
                },
                idAdmin
            )
        );

        if (req.query.binario === 'true' || req.body?.binario === true) {
            res.setHeader('Content-Type', resultado.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${resultado.nombre_archivo}"`);
            res.status(200).send(resultado.buffer);
            return;
        }

        const { buffer: _buf, ...respuestaJson } = resultado;
        res.status(200).json({
            mensaje: `Exportación de ${resultado.cantidad_etiquetas} etiqueta(s) QR en formato ${resultado.formato.toUpperCase()} (${resultado.tamano_impresion_mm} mm H39) generada y auditada.`,
            exportacion: respuestaJson,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al exportar los códigos QR');
    }
};

export const marcarCodigoQrAsignado = async (req: Request, res: Response): Promise<void> => {
    try {
        const idCodigoQr = Number(req.params.id);
        const idAdmin = obtenerIdEjecutor(req);
        const etiqueta = await ejecutarTransaccion((cliente) =>
            marcarCodigoQrAsignadoEnTransaccion(cliente, idCodigoQr, req.body ?? {}, idAdmin)
        );
        res.status(200).json({
            mensaje: `Código QR ${etiqueta.codigo_qr} marcado como Asignado a objeto físico y registrado en auditoría.`,
            codigo_qr: etiqueta,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al marcar el código QR como asignado');
    }
};

export const listarCodigosQrInsumo = async (req: Request, res: Response): Promise<void> => {
    try {
        const idArt = Number(req.params.id ?? req.query.id_articulo ?? 0);
        const resultado = await pool.query(
            `SELECT id_codigo_qr, codigo_qr, id_articulo, sku, nombre_articulo, unidad_medida,
                    categoria, ubicacion, lote, payload_qr, estado_asignacion,
                    asignado_objeto_fisico, fecha_asignacion, fecha_ultima_exportacion,
                    id_usuario_creador, fecha_creacion
             FROM codigos_qr_insumos
             WHERE ($1 = 0 OR id_articulo = $1)
             ORDER BY id_codigo_qr DESC`,
            [Number.isInteger(idArt) && idArt > 0 ? idArt : 0]
        );
        res.status(200).json(resultado.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar los códigos QR de insumos');
    }
};

export const escanearCodigoQrH18 = async (req: Request, res: Response): Promise<void> => {
    try {
        const crudo = String(
            req.params.codigo ?? req.body?.payload ?? req.body?.codigo ?? req.query.codigo ?? ''
        ).trim();
        const resultado = await buscarInsumoInstantaneoPorCodigo(pool, crudo);
        res.status(200).json(resultado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al buscar el insumo por código QR o código de barras');
    }
};

export const SLA_BUSQUEDA_ESCANER_MS = 200;

export interface FichaYStockInsumoEscaneado {
    valido: true;
    formato_detectado: FormatoCodigoDetectadoH18;
    codigo_consultado: string;
    tiempo_respuesta_ms: number;
    cumple_sla_200ms: boolean;
    insumo: {
        id_articulo: number;
        sku: string;
        codigo_barras: string | null;
        nombre_articulo: string;
        categoria: string;
        unidad_medida: string;
        precio_unitario: number;
        activo: boolean;
    };
    stock: {
        cantidad_disponible: number;
        cantidad_comprometida: number;
        cantidad_cuarentena: number;
        stock_minimo: number;
        cant_reposicion: number;
        pmp: number;
        ubicacion: string | null;
        bloqueado_por_conteo: boolean;
    };
    etiqueta_qr: {
        id_codigo_qr: number;
        codigo_qr: string;
        estado_asignacion: EstadoAsignacionQr;
        asignado_objeto_fisico: boolean;
        lote: string | null;
    } | null;
}

/**
 * [BACK-1] Búsqueda instantánea (< 200 ms) en una sola consulta indexada por código QR (JSON o código único),
 * código de barras o SKU. Devuelve la ficha técnica y el stock en vivo del insumo.
 * Si el código no existe o el insumo está inactivo, lanza 404 claro para bloquear la operación en bodega.
 */
export const buscarInsumoInstantaneoPorCodigo = async (
    cliente: Pick<PoolClient, 'query'>,
    entradaCruda: unknown
): Promise<FichaYStockInsumoEscaneado> => {
    const inicioNs = process.hrtime.bigint();
    const termino = extraerTerminoBusquedaEscanerH18(entradaCruda);

    const res = await cliente.query<{
        id_articulo: number;
        sku: string;
        codigo_barras: string | null;
        nombre_articulo: string;
        categoria: string;
        unidad_medida: string;
        precio_unitario: number;
        activo: boolean;
        cantidad_disponible: number;
        cantidad_comprometida: number;
        cantidad_cuarentena: number;
        stock_minimo: number;
        cant_reposicion: number;
        pmp: number;
        ubicacion: string | null;
        bloqueado_por_conteo: boolean;
        id_codigo_qr: number | null;
        codigo_qr: string | null;
        estado_asignacion: EstadoAsignacionQr | null;
        asignado_objeto_fisico: boolean | null;
        lote: string | null;
    }>(
        `/* qr:busqueda-instantanea */
         SELECT a.id_articulo,
                COALESCE(a.sku, 'INS-' || a.id_articulo::text) AS sku,
                i.codigo_barras,
                a.nombre_articulo,
                COALESCE(a.categoria::text, 'Materiales') AS categoria,
                COALESCE(um.codigo, um.nombre, 'un') AS unidad_medida,
                COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                COALESCE(a.activo, TRUE) AS activo,
                COALESCE(s.cantidad_disponible, 0)::float8 AS cantidad_disponible,
                COALESCE(s.cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                COALESCE(s.cantidad_cuarentena, 0)::float8 AS cantidad_cuarentena,
                COALESCE(s.stock_minimo, 0)::float8 AS stock_minimo,
                COALESCE(s.cant_reposicion, 0)::float8 AS cant_reposicion,
                COALESCE(NULLIF(s.pmp, 0), a.precio_unitario, 0)::float8 AS pmp,
                s.ubicacion,
                COALESCE(s.bloqueado_por_conteo, FALSE) AS bloqueado_por_conteo,
                q.id_codigo_qr,
                q.codigo_qr,
                q.estado_asignacion,
                q.asignado_objeto_fisico,
                q.lote
         FROM articulo a
         LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
         LEFT JOIN unidades_medida um ON um.id_unidad = COALESCE(a.id_unidad, i.id_unidad)
         LEFT JOIN articulos_stock s ON s.id_articulo = a.id_articulo
         LEFT JOIN codigos_qr_insumos q
                ON q.id_articulo = a.id_articulo
               AND ($1::text IS NOT NULL AND UPPER(TRIM(q.codigo_qr)) = $1)
         WHERE ($1::text IS NOT NULL AND UPPER(TRIM(q.codigo_qr)) = $1)
            OR UPPER(TRIM(a.sku)) = $2
            OR (i.codigo_barras IS NOT NULL AND UPPER(TRIM(i.codigo_barras)) = $2)
         ORDER BY (q.id_codigo_qr IS NOT NULL) DESC, a.id_articulo ASC
         LIMIT 1`,
        [termino.codigo_qr_busqueda, termino.sku_o_barras_busqueda]
    );

    const elapsedMs = Number((Number(process.hrtime.bigint() - inicioNs) / 1e6).toFixed(3));
    const fila = res.rows?.[0];

    if (!fila) {
        throw new ErrorAplicacion(
            404,
            `El código "${termino.codigo_qr_busqueda || termino.sku_o_barras_busqueda}" no existe en el catálogo de insumos. Operación bloqueada.`
        );
    }

    // Si se escaneó un código QR específico (p. ej. FYAG-QR-SKU-9999) pero esa etiqueta QR no está registrada, bloquear con 404
    if (
        (termino.formato_detectado === 'CODIGO_QR' || termino.formato_detectado === 'QR_JSON_H47') &&
        termino.codigo_qr_busqueda &&
        (!fila.codigo_qr || fila.codigo_qr.toUpperCase() !== termino.codigo_qr_busqueda)
    ) {
        throw new ErrorAplicacion(
            404,
            `La etiqueta QR "${termino.codigo_qr_busqueda}" no está registrada para ningún objeto físico. Operación bloqueada.`
        );
    }

    if (fila.activo === false) {
        throw new ErrorAplicacion(
            404,
            `El insumo asociado al código "${termino.sku_o_barras_busqueda}" (${fila.nombre_articulo}) se encuentra inactivo. Operación bloqueada.`
        );
    }

    return {
        valido: true,
        formato_detectado: termino.formato_detectado,
        codigo_consultado: termino.codigo_crudo,
        tiempo_respuesta_ms: elapsedMs,
        cumple_sla_200ms: elapsedMs < SLA_BUSQUEDA_ESCANER_MS,
        insumo: {
            id_articulo: Number(fila.id_articulo),
            sku: fila.sku,
            codigo_barras: fila.codigo_barras ?? null,
            nombre_articulo: fila.nombre_articulo,
            categoria: fila.categoria,
            unidad_medida: fila.unidad_medida,
            precio_unitario: Number(fila.precio_unitario),
            activo: Boolean(fila.activo),
        },
        stock: {
            cantidad_disponible: Number(fila.cantidad_disponible),
            cantidad_comprometida: Number(fila.cantidad_comprometida),
            cantidad_cuarentena: Number(fila.cantidad_cuarentena),
            stock_minimo: Number(fila.stock_minimo),
            cant_reposicion: Number(fila.cant_reposicion),
            pmp: Number(fila.pmp),
            ubicacion: fila.ubicacion ?? null,
            bloqueado_por_conteo: Boolean(fila.bloqueado_por_conteo),
        },
        etiqueta_qr: fila.id_codigo_qr
            ? {
                  id_codigo_qr: Number(fila.id_codigo_qr),
                  codigo_qr: fila.codigo_qr!,
                  estado_asignacion: fila.estado_asignacion ?? ESTADO_QR_PENDIENTE_IMPRESION,
                  asignado_objeto_fisico: Boolean(fila.asignado_objeto_fisico),
                  lote: fila.lote ?? null,
              }
            : null,
    };
};
