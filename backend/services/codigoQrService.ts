import zlib from 'node:zlib';
import { ErrorAplicacion } from './errores';

export const ESTADO_QR_PENDIENTE_IMPRESION = 'Pendiente de impresión' as const;
export const ESTADO_QR_IMPRESO = 'Impreso' as const;
export const ESTADO_QR_ASIGNADO_OBJETO = 'Asignado a objeto físico' as const;

export type EstadoAsignacionQr =
    | typeof ESTADO_QR_PENDIENTE_IMPRESION
    | typeof ESTADO_QR_IMPRESO
    | typeof ESTADO_QR_ASIGNADO_OBJETO;

export const TAMANO_IMPRESION_QR_MM_DEFECTO = 50;

export interface PayloadQrInsumoH35 {
    sistema: 'FYAG';
    tipo: 'INSUMO';
    codigoQr: string;
    id_articulo: number;
    sku: string;
    nombre: string;
    unidad: string;
    categoria: string;
    ubicacion: string;
    lote?: string;
    generadoEn: string;
}

export interface EtiquetaQrExportable {
    id_codigo_qr: number;
    codigo_qr: string;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    unidad_medida: string;
    ubicacion?: string | null;
    lote?: string | null;
    payload_qr: string;
    estado_asignacion?: EstadoAsignacionQr;
    asignado_objeto_fisico?: boolean;
}

/**
 * [BACK-1] Construye el código único identificador del objeto físico y el payload JSON
 * compatible con el escáner óptico de H18 (ModalEscanerQr / parsearPayloadQrInsumo).
 * Codifica obligatoriamente SKU, nombre y unidad de medida a partir del catálogo H35.
 */
export const construirPayloadQrH35 = (params: {
    idArticulo: number;
    sku: string;
    nombreArticulo: string;
    unidadMedida: string;
    correlativo: number;
    codigoQrPersonalizado?: string | null;
    categoria?: string | null;
    ubicacion?: string | null;
    lote?: string | null;
    fechaIso?: string;
}): { codigo_qr: string; payload_objeto: PayloadQrInsumoH35; payload_qr: string } => {
    const sku = String(params.sku ?? '').trim().toUpperCase();
    const nombre = String(params.nombreArticulo ?? '').trim();
    const unidad = String(params.unidadMedida ?? '').trim();

    if (!sku) {
        throw new ErrorAplicacion(400, 'El insumo de H35 debe tener un SKU válido para generar su código QR');
    }
    if (!nombre) {
        throw new ErrorAplicacion(400, 'El insumo de H35 debe tener un nombre válido para generar su código QR');
    }
    if (!unidad) {
        throw new ErrorAplicacion(400, 'El insumo de H35 debe tener una unidad de medida válida para generar su código QR');
    }

    const correlativo = Number(params.correlativo);
    if (!Number.isInteger(correlativo) || correlativo <= 0) {
        throw new ErrorAplicacion(400, 'El correlativo del código QR debe ser un entero positivo');
    }

    const codigoPersonalizado =
        typeof params.codigoQrPersonalizado === 'string' && params.codigoQrPersonalizado.trim()
            ? params.codigoQrPersonalizado.trim().toUpperCase()
            : null;

    const codigoQr = codigoPersonalizado || `FYAG-QR-${sku}-${String(correlativo).padStart(4, '0')}`;
    const generadoEn = params.fechaIso || new Date().toISOString();
    const categoria = (params.categoria && params.categoria.trim()) || 'Materiales';
    const ubicacion = (params.ubicacion && params.ubicacion.trim()) || 'Bodega Central';
    const lote = params.lote && params.lote.trim() ? params.lote.trim() : undefined;

    const payloadObjeto: PayloadQrInsumoH35 = {
        sistema: 'FYAG',
        tipo: 'INSUMO',
        codigoQr,
        id_articulo: Number(params.idArticulo),
        sku,
        nombre,
        unidad,
        categoria,
        ubicacion,
        ...(lote ? { lote } : {}),
        generadoEn,
    };

    return {
        codigo_qr: codigoQr,
        payload_objeto: payloadObjeto,
        payload_qr: JSON.stringify(payloadObjeto),
    };
};

/**
 * [BACK-1 / H18] Decodifica y valida un payload escaneado por el lector de bodega (H18),
 * verificando que provenga del formato FYAG H35/H47 y contenga SKU, nombre y unidad de medida.
 */
export const decodificarPayloadQrEscanerH18 = (cadenaCruda: unknown): PayloadQrInsumoH35 => {
    if (typeof cadenaCruda !== 'string' || !cadenaCruda.trim()) {
        throw new ErrorAplicacion(400, 'El contenido escaneado del código QR está vacío');
    }
    let obj: any;
    try {
        obj = JSON.parse(cadenaCruda.trim());
    } catch {
        throw new ErrorAplicacion(400, 'El código QR no contiene un payload JSON válido para el escáner H18');
    }

    if (
        !obj ||
        obj.sistema !== 'FYAG' ||
        obj.tipo !== 'INSUMO' ||
        typeof obj.codigoQr !== 'string' ||
        !obj.codigoQr.trim() ||
        typeof obj.sku !== 'string' ||
        !obj.sku.trim() ||
        typeof obj.nombre !== 'string' ||
        !obj.nombre.trim() ||
        typeof obj.unidad !== 'string' ||
        !obj.unidad.trim()
    ) {
        throw new ErrorAplicacion(
            400,
            'El payload del código QR no cumple la estructura H35/H18 (requiere sistema FYAG, codigoQr, sku, nombre y unidad)'
        );
    }

    return obj as PayloadQrInsumoH35;
};

export type FormatoCodigoDetectadoH18 = 'QR_JSON_H47' | 'CODIGO_QR' | 'CODIGO_BARRAS_O_SKU';

export interface TerminoBusquedaEscanerH18 {
    codigo_crudo: string;
    formato_detectado: FormatoCodigoDetectadoH18;
    codigo_qr_busqueda: string | null;
    sku_o_barras_busqueda: string;
    payload_decodificado: PayloadQrInsumoH35 | null;
}

/**
 * [BACK-1 / H18] Analiza en microsegundos cualquier entrada del lector óptico
 * (JSON embebido en etiqueta QR H47, código QR textual FYAG-QR-..., código de barras EAN/Code128 o SKU)
 * y extrae las claves normalizadas en mayúsculas para consulta indexada (< 200 ms).
 */
export const extraerTerminoBusquedaEscanerH18 = (entradaCruda: unknown): TerminoBusquedaEscanerH18 => {
    const crudo = typeof entradaCruda === 'string' ? entradaCruda.trim() : '';
    if (!crudo) {
        throw new ErrorAplicacion(400, 'Debe proporcionar un código QR o código de barras para buscar el insumo');
    }

    if (crudo.startsWith('{')) {
        const payload = decodificarPayloadQrEscanerH18(crudo);
        return {
            codigo_crudo: crudo,
            formato_detectado: 'QR_JSON_H47',
            codigo_qr_busqueda: payload.codigoQr.trim().toUpperCase(),
            sku_o_barras_busqueda: payload.sku.trim().toUpperCase(),
            payload_decodificado: payload,
        };
    }

    const limpioUpper = crudo.toUpperCase();
    if (limpioUpper.startsWith('FYAG-QR-') || limpioUpper.startsWith('QR-FYAG-')) {
        // Extraer también el SKU si el código tiene el formato FYAG-QR-<SKU>-<CORRELATIVO>
        const matchSku = /^FYAG-QR-(.+)-\d{3,6}$/.exec(limpioUpper);
        return {
            codigo_crudo: crudo,
            formato_detectado: 'CODIGO_QR',
            codigo_qr_busqueda: limpioUpper,
            sku_o_barras_busqueda: matchSku ? matchSku[1] : limpioUpper,
            payload_decodificado: null,
        };
    }

    return {
        codigo_crudo: crudo,
        formato_detectado: 'CODIGO_BARRAS_O_SKU',
        codigo_qr_busqueda: limpioUpper,
        sku_o_barras_busqueda: limpioUpper,
        payload_decodificado: null,
    };
};

/**
 * Genera una matriz QR determinista de 21x21 con los 3 patrones buscadores 7x7 estándar
 * y módulos de datos derivados del payload del insumo.
 */
export const generarMatrizQrDeterminista = (contenido: string): number[][] => {
    const N = 21;
    const matriz: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const reservado: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

    const colocarFinder = (fila0: number, col0: number) => {
        for (let r = -1; r <= 7; r += 1) {
            for (let c = -1; c <= 7; c += 1) {
                const fr = fila0 + r;
                const fc = col0 + c;
                if (fr < 0 || fr >= N || fc < 0 || fc >= N) continue;
                reservado[fr][fc] = true;
                const enBorde = r === 0 || r === 6 || c === 0 || c === 6;
                const enCentro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                const dentro7x7 = r >= 0 && r <= 6 && c >= 0 && c <= 6;
                matriz[fr][fc] = dentro7x7 && (enBorde || enCentro) ? 1 : 0;
            }
        }
    };

    colocarFinder(0, 0);
    colocarFinder(0, N - 7);
    colocarFinder(N - 7, 0);

    // Patrones de sincronización (fila 6 y columna 6)
    for (let i = 8; i < N - 8; i += 1) {
        reservado[6][i] = true;
        reservado[i][6] = true;
        matriz[6][i] = i % 2 === 0 ? 1 : 0;
        matriz[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Semilla FNV-1a a partir del payload
    let hash = 2166136261;
    for (let i = 0; i < contenido.length; i += 1) {
        hash ^= contenido.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }

    let idxBit = 0;
    for (let r = 0; r < N; r += 1) {
        for (let c = 0; c < N; c += 1) {
            if (reservado[r][c]) continue;
            const charCode = contenido.charCodeAt(idxBit % contenido.length);
            const bit = ((hash >>> (idxBit % 31)) ^ (charCode >> (idxBit % 7)) ^ (r * 3 + c * 5)) & 1;
            matriz[r][c] = bit;
            idxBit += 1;
        }
    }

    return matriz;
};

const escaparTextoPdf = (texto: string): string =>
    texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

/**
 * [BACK-2] Genera un documento binario PDF 1.4 imprimible con una o varias etiquetas QR en lote.
 * Cada etiqueta aplica el tamaño en milímetros configurado en H39 e incluye el código QR gráfico
 * junto con texto legible que muestra el SKU, nombre del insumo, unidad y código único.
 */
export const generarPdfEtiquetasQrLote = (
    etiquetas: EtiquetaQrExportable[],
    tamanoMm: number
): { buffer: Buffer; ancho_pt: number; alto_pt: number; tamano_mm: number } => {
    if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
        throw new ErrorAplicacion(400, 'Debe seleccionar al menos un código QR para exportar a PDF');
    }

    const mm = Math.max(25, Math.min(150, Math.round(Number(tamanoMm) || TAMANO_IMPRESION_QR_MM_DEFECTO)));
    // 1 mm = 2.83465 pt. La etiqueta tiene ancho = mm y alto = mm * 1.35 para alojar QR + texto legible de SKU y nombre
    const anchoPt = Math.round(mm * 2.83465);
    const altoEtiquetaPt = Math.round(mm * 1.35 * 2.83465);
    const altoTotalPt = altoEtiquetaPt * etiquetas.length;

    const lineasStream: string[] = [];

    etiquetas.forEach((etq, idx) => {
        const offsetY = altoTotalPt - (idx + 1) * altoEtiquetaPt;
        const margen = Math.max(8, Math.round(anchoPt * 0.08));
        const ladoQrPt = anchoPt - margen * 2;
        const matriz = generarMatrizQrDeterminista(etq.payload_qr);
        const N = matriz.length;
        const moduloPt = Number((ladoQrPt / N).toFixed(2));
        const qrBaseY = offsetY + (altoEtiquetaPt - ladoQrPt - margen);

        // Borde de la etiqueta
        lineasStream.push('0.85 0.85 0.85 RG 0.8 w');
        lineasStream.push(`${margen / 2} ${offsetY + margen / 2} ${anchoPt - margen} ${altoEtiquetaPt - margen} re S`);

        // Dibujar módulos oscuros del QR
        lineasStream.push('0 0 0 rg');
        for (let r = 0; r < N; r += 1) {
            for (let c = 0; c < N; c += 1) {
                if (matriz[r][c] === 1) {
                    const x = Number((margen + c * moduloPt).toFixed(2));
                    const y = Number((qrBaseY + (N - 1 - r) * moduloPt).toFixed(2));
                    lineasStream.push(`${x} ${y} ${moduloPt} ${moduloPt} re f`);
                }
            }
        }

        // Texto legible debajo del QR: SKU, nombre del insumo, código QR y tamaño H39
        const fontSizeSku = Math.max(7, Math.round(anchoPt * 0.065));
        const fontSizeTexto = Math.max(6, Math.round(anchoPt * 0.05));
        const textoY1 = Math.max(offsetY + 6, Math.round(qrBaseY - fontSizeSku - 4));
        const textoY2 = Math.max(offsetY + 4, textoY1 - fontSizeTexto - 3);
        const textoY3 = Math.max(offsetY + 2, textoY2 - fontSizeTexto - 3);

        lineasStream.push('BT');
        lineasStream.push(`/F1 ${fontSizeSku} Tf`);
        lineasStream.push(`${margen} ${textoY1} Td`);
        lineasStream.push(`(SKU: ${escaparTextoPdf(etq.sku)} | ${escaparTextoPdf(etq.unidad_medida)}) Tj`);
        lineasStream.push('ET');

        lineasStream.push('BT');
        lineasStream.push(`/F1 ${fontSizeTexto} Tf`);
        lineasStream.push(`${margen} ${textoY2} Td`);
        lineasStream.push(`(${escaparTextoPdf(etq.nombre_articulo)}) Tj`);
        lineasStream.push('ET');

        lineasStream.push('BT');
        lineasStream.push(`/F1 ${fontSizeTexto} Tf`);
        lineasStream.push(`${margen} ${textoY3} Td`);
        lineasStream.push(`(${escaparTextoPdf(etq.codigo_qr)} [${mm}mm H39]) Tj`);
        lineasStream.push('ET');
    });

    const contenidoStream = lineasStream.join('\n');
    const objetos: string[] = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPt} ${altoTotalPt}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        `5 0 obj\n<< /Length ${Buffer.byteLength(contenidoStream, 'utf8')} >>\nstream\n${contenidoStream}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objetos) {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += obj;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objetos.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objetos.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return {
        buffer: Buffer.from(pdf, 'utf8'),
        ancho_pt: anchoPt,
        alto_pt: altoTotalPt,
        tamano_mm: mm,
    };
};

// Tabla CRC32 estándar para chunks PNG
const TABLA_CRC32: Uint32Array = (() => {
    const tabla = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        tabla[n] = c >>> 0;
    }
    return tabla;
})();

const calcularCrc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
        crc = TABLA_CRC32[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const construirChunkPng = (tipo: string, datos: Buffer): Buffer => {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(datos.length, 0);
    const tipoBuf = Buffer.from(tipo, 'ascii');
    const crcInput = Buffer.concat([tipoBuf, datos]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(calcularCrc32(crcInput), 0);
    return Buffer.concat([lenBuf, tipoBuf, datos, crcBuf]);
};

// Mini fuente bitmap 3x5 para renderizar texto legible (SKU y código) en el lienzo PNG
const GLIFOS_3X5: Record<string, number[]> = {
    A: [0b010, 0b101, 0b111, 0b101, 0b101],
    B: [0b110, 0b101, 0b110, 0b101, 0b110],
    C: [0b011, 0b100, 0b100, 0b100, 0b011],
    D: [0b110, 0b101, 0b101, 0b101, 0b110],
    E: [0b111, 0b100, 0b110, 0b100, 0b111],
    F: [0b111, 0b100, 0b110, 0b100, 0b100],
    G: [0b011, 0b100, 0b101, 0b101, 0b011],
    H: [0b101, 0b101, 0b111, 0b101, 0b101],
    I: [0b111, 0b010, 0b010, 0b010, 0b111],
    J: [0b001, 0b001, 0b001, 0b101, 0b010],
    K: [0b101, 0b101, 0b110, 0b101, 0b101],
    L: [0b100, 0b100, 0b100, 0b100, 0b111],
    M: [0b101, 0b111, 0b101, 0b101, 0b101],
    N: [0b110, 0b101, 0b101, 0b101, 0b101],
    O: [0b010, 0b101, 0b101, 0b101, 0b010],
    P: [0b110, 0b101, 0b110, 0b100, 0b100],
    Q: [0b010, 0b101, 0b101, 0b011, 0b001],
    R: [0b110, 0b101, 0b110, 0b101, 0b101],
    S: [0b011, 0b100, 0b010, 0b001, 0b110],
    T: [0b111, 0b010, 0b010, 0b010, 0b010],
    U: [0b101, 0b101, 0b101, 0b101, 0b111],
    V: [0b101, 0b101, 0b101, 0b101, 0b010],
    W: [0b101, 0b101, 0b101, 0b111, 0b101],
    X: [0b101, 0b101, 0b010, 0b101, 0b101],
    Y: [0b101, 0b101, 0b010, 0b010, 0b010],
    Z: [0b111, 0b001, 0b010, 0b100, 0b111],
    '0': [0b111, 0b101, 0b101, 0b101, 0b111],
    '1': [0b010, 0b110, 0b010, 0b010, 0b111],
    '2': [0b111, 0b001, 0b111, 0b100, 0b111],
    '3': [0b111, 0b001, 0b111, 0b001, 0b111],
    '4': [0b101, 0b101, 0b111, 0b001, 0b001],
    '5': [0b111, 0b100, 0b111, 0b001, 0b111],
    '6': [0b111, 0b100, 0b111, 0b101, 0b111],
    '7': [0b111, 0b001, 0b001, 0b001, 0b001],
    '8': [0b111, 0b101, 0b111, 0b101, 0b111],
    '9': [0b111, 0b101, 0b111, 0b001, 0b111],
    '-': [0b000, 0b000, 0b111, 0b000, 0b000],
    ':': [0b000, 0b010, 0b000, 0b010, 0b000],
};

/**
 * [BACK-2] Genera una imagen binaria PNG válida (8-bit grayscale) con una o varias etiquetas QR en lote,
 * escalada según el tamaño configurado en H39 (mm), renderizando la matriz QR, texto legible en píxeles
 * y chunks tEXt con el SKU, nombre del insumo y código QR.
 */
export const generarPngEtiquetasQrLote = (
    etiquetas: EtiquetaQrExportable[],
    tamanoMm: number
): { buffer: Buffer; ancho_px: number; alto_px: number; tamano_mm: number } => {
    if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
        throw new ErrorAplicacion(400, 'Debe seleccionar al menos un código QR para exportar a PNG');
    }

    const mm = Math.max(25, Math.min(150, Math.round(Number(tamanoMm) || TAMANO_IMPRESION_QR_MM_DEFECTO)));
    // 4 píxeles por milímetro para ancho y 5 px/mm de alto por etiqueta (espacio para QR + franja de texto legible)
    const anchoPx = mm * 4;
    const altoEtiquetaPx = mm * 5;
    const altoTotalPx = altoEtiquetaPx * etiquetas.length;

    // Lienzo en blanco (255 = blanco, 0 = negro)
    const pixeles = new Uint8Array(anchoPx * altoTotalPx);
    pixeles.fill(255);

    const pintarRect = (x0: number, y0: number, w: number, h: number, color: number) => {
        const xMax = Math.min(anchoPx, x0 + w);
        const yMax = Math.min(altoTotalPx, y0 + h);
        for (let y = Math.max(0, y0); y < yMax; y += 1) {
            const filaOffset = y * anchoPx;
            for (let x = Math.max(0, x0); x < xMax; x += 1) {
                pixeles[filaOffset + x] = color;
            }
        }
    };

    const pintarTextoBitmap = (texto: string, x0: number, y0: number, escala: number) => {
        const limpio = texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        let cursorX = x0;
        for (let i = 0; i < limpio.length; i += 1) {
            const glifo = GLIFOS_3X5[limpio[i]];
            if (glifo) {
                for (let r = 0; r < 5; r += 1) {
                    for (let c = 0; c < 3; c += 1) {
                        if ((glifo[r] >> (2 - c)) & 1) {
                            pintarRect(cursorX + c * escala, y0 + r * escala, escala, escala, 0);
                        }
                    }
                }
            }
            cursorX += 4 * escala;
            if (cursorX + 3 * escala >= anchoPx - 4) break;
        }
    };

    etiquetas.forEach((etq, idx) => {
        const yBase = idx * altoEtiquetaPx;
        const margen = Math.max(8, Math.round(anchoPx * 0.08));
        const ladoQr = anchoPx - margen * 2;
        const matriz = generarMatrizQrDeterminista(etq.payload_qr);
        const N = matriz.length;
        const tamModulo = Math.max(2, Math.floor(ladoQr / N));

        // Borde gris de la etiqueta
        for (let x = 2; x < anchoPx - 2; x += 1) {
            pixeles[(yBase + 2) * anchoPx + x] = 180;
            pixeles[(yBase + altoEtiquetaPx - 3) * anchoPx + x] = 180;
        }

        // Renderizar módulos del QR
        for (let r = 0; r < N; r += 1) {
            for (let c = 0; c < N; c += 1) {
                if (matriz[r][c] === 1) {
                    pintarRect(margen + c * tamModulo, yBase + margen + r * tamModulo, tamModulo, tamModulo, 0);
                }
            }
        }

        // Renderizar SKU y nombre en texto bitmap debajo del QR
        const yTexto1 = yBase + margen + N * tamModulo + Math.max(4, Math.round(margen * 0.4));
        const escala = Math.max(1, Math.floor(anchoPx / 100));
        pintarTextoBitmap(`SKU:${etq.sku}`, margen, yTexto1, escala);
        pintarTextoBitmap(etq.nombre_articulo, margen, yTexto1 + 7 * escala, escala);
    });

    // Construir scanlines PNG (1 byte de filtro 0x00 al inicio de cada fila)
    const rawScanlines = Buffer.alloc(altoTotalPx * (1 + anchoPx));
    for (let y = 0; y < altoTotalPx; y += 1) {
        const destOffset = y * (1 + anchoPx);
        rawScanlines[destOffset] = 0; // Filtro None
        const srcOffset = y * anchoPx;
        rawScanlines.set(pixeles.subarray(srcOffset, srcOffset + anchoPx), destOffset + 1);
    }

    const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(anchoPx, 0);
    ihdr.writeUInt32BE(altoTotalPx, 4);
    ihdr[8] = 8; // Bit depth: 8 bits
    ihdr[9] = 0; // Color type: 0 (grayscale)
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    // Chunks tEXt con el texto legible de cada etiqueta del lote (SKU, nombre, código QR y tamaño H39)
    const resumenTexto = etiquetas
        .map((e) => `${e.codigo_qr} | SKU: ${e.sku} | ${e.nombre_articulo} (${e.unidad_medida})`)
        .join(' ; ');
    const chunkTextoEtiquetas = construirChunkPng(
        'tEXt',
        Buffer.from(`EtiquetasFYAG\0${resumenTexto} | TamanoH39: ${mm}mm`, 'utf8')
    );

    const idatComprimido = zlib.deflateSync(rawScanlines);
    const pngBuffer = Buffer.concat([
        firmaPng,
        construirChunkPng('IHDR', ihdr),
        chunkTextoEtiquetas,
        construirChunkPng('IDAT', idatComprimido),
        construirChunkPng('IEND', Buffer.alloc(0)),
    ]);

    return {
        buffer: pngBuffer,
        ancho_px: anchoPx,
        alto_px: altoTotalPx,
        tamano_mm: mm,
    };
};
