import type { CorreoSaliente } from './correo';

export interface LineaPdfOrdenCompra {
    sku: string;
    nombre_articulo: string;
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    subtotal_linea: number;
}

export interface DatosPdfOrdenCompra {
    id_orden_compra: number;
    numero_oc: string;
    estado: string;
    origen: string;
    fecha_emision: string;
    fecha_estimada_oc: string | null;
    observaciones: string | null;
    proveedor: {
        id_proveedor: number;
        nombre_proveedor: string;
        razon_social?: string | null;
        rut_proveedor: string;
        correo_contacto: string | null;
        telefono?: string | null;
        direccion?: string | null;
    };
    lineas: LineaPdfOrdenCompra[];
    subtotal_neto: number;
    iva: number;
    total: number;
    aprobado_por?: string | null;
}

const formatearMonedaCLP = (monto: number): string => {
    const entero = Math.round(Number(monto) || 0);
    const signo = entero < 0 ? '-' : '';
    const abs = Math.abs(entero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${signo}$${abs}`;
};

const formatearCantidad = (cant: number): string => {
    const num = Number(cant) || 0;
    return Number.isInteger(num) ? String(num) : num.toFixed(3).replace(/\.?0+$/, '');
};

/**
 * Convierte texto UTF-8 a caracteres seguros para WinAnsiEncoding en PDF 1.4
 * y escapa paréntesis y barras invertidas del operador Tj.
 */
const escaparTextoPdf = (texto: string): string => {
    return (texto || '')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2022/g, '-')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
};

const truncar = (texto: string, max: number): string => {
    const limpio = (texto || '').trim();
    return limpio.length > max ? `${limpio.slice(0, max - 3)}...` : limpio;
};

/**
 * Genera un documento PDF 1.4 corporativo válido (%PDF-1.4 ... %%EOF) sin dependencias externas.
 * Incluye membrete corporativo FYAG Multisystem SpA, numeración correlativa,
 * datos del proveedor, tabla detallada de insumos, desglose Neto / IVA (19%) / Total CLP y firmas.
 */
export const generarPdfOrdenCompra = (datos: DatosPdfOrdenCompra): Buffer => {
    const ops: string[] = [];

    const texto = (
        x: number,
        y: number,
        contenido: string,
        tamano = 10,
        negrita = false,
        colorRgb: [number, number, number] = [0.11, 0.1, 0.09]
    ) => {
        const fuente = negrita ? '/F2' : '/F1';
        const [r, g, b] = colorRgb;
        ops.push(
            `BT ${fuente} ${tamano} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escaparTextoPdf(contenido)}) Tj ET`
        );
    };

    const rectanguloRelleno = (
        x: number,
        y: number,
        w: number,
        h: number,
        colorRgb: [number, number, number]
    ) => {
        const [r, g, b] = colorRgb;
        ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    };

    const rectanguloBorde = (
        x: number,
        y: number,
        w: number,
        h: number,
        colorRgb: [number, number, number],
        grosor = 0.8
    ) => {
        const [r, g, b] = colorRgb;
        ops.push(`${grosor.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    };

    const linea = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        colorRgb: [number, number, number] = [0.85, 0.83, 0.81],
        grosor = 0.7
    ) => {
        const [r, g, b] = colorRgb;
        ops.push(`${grosor.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    };

    // 1. BANNER CORPORATIVO SUPERIOR (A4: 595 x 842 pt)
    rectanguloRelleno(0, 752, 595, 90, [0.11, 0.1, 0.09]); // Fondo oscuro corporativo
    rectanguloRelleno(0, 747, 595, 5, [0.85, 0.47, 0.02]);  // Franja ámbar FYAG

    texto(40, 812, 'FYAG MULTISYSTEM SpA', 16, true, [1, 1, 1]);
    texto(40, 795, 'RUT: 76.982.341-K  |  Giro: Ingenieria, Obras e Instalaciones Industriales', 9, false, [0.84, 0.83, 0.82]);
    texto(40, 781, 'Casa Matriz: Av. El Salto 4001, Huechuraba, Santiago de Chile', 9, false, [0.84, 0.83, 0.82]);
    texto(40, 767, 'Telefono: +56 2 2890 4100  |  Correo: compras@fyag.cl', 9, false, [0.84, 0.83, 0.82]);

    // Recuadro derecho: Número correlativo de OC
    rectanguloRelleno(380, 764, 175, 66, [0.16, 0.14, 0.13]);
    rectanguloBorde(380, 764, 175, 66, [0.96, 0.62, 0.04], 1.2);
    texto(402, 812, 'ORDEN DE COMPRA', 11, true, [0.98, 0.75, 0.14]);
    texto(402, 793, `N° ${datos.numero_oc}`, 13, true, [1, 1, 1]);
    texto(402, 775, `ESTADO: ${datos.estado.toUpperCase()}`, 8.5, true, [0.53, 0.94, 0.67]);

    // 2. SECCIÓN DATOS DEL PROVEEDOR Y METADATOS DE LA ORDEN
    rectanguloRelleno(40, 642, 515, 90, [0.98, 0.98, 0.97]);
    rectanguloBorde(40, 642, 515, 90, [0.88, 0.86, 0.84], 0.8);

    texto(52, 716, 'DATOS DEL PROVEEDOR', 9.5, true, [0.71, 0.33, 0.04]);
    const nombreProv = datos.proveedor.razon_social || datos.proveedor.nombre_proveedor;
    texto(52, 700, `Razon Social: ${truncar(nombreProv, 48)}`, 9.5, true);
    texto(52, 685, `RUT Proveedor: ${datos.proveedor.rut_proveedor}`, 9);
    texto(52, 670, `Correo Contacto: ${datos.proveedor.correo_contacto || 'No especificado'}`, 9);
    texto(52, 655, `Direccion: ${truncar(datos.proveedor.direccion || 'Santiago, Chile', 52)}`, 9);

    linea(330, 650, 330, 724, [0.88, 0.86, 0.84], 0.7);
    texto(342, 716, 'DETALLES DE EMISION', 9.5, true, [0.71, 0.33, 0.04]);
    texto(342, 700, `Fecha Emision: ${datos.fecha_emision}`, 9);
    texto(342, 685, `Entrega Estimada: ${datos.fecha_estimada_oc || 'A convenir'}`, 9);
    texto(342, 670, `Origen OC: ${datos.origen || 'Manual'}`, 9);
    texto(342, 655, `Moneda: Pesos Chilenos (CLP)`, 9);

    // 3. TABLA DE INSUMOS / LÍNEAS DE LA OC
    let cursorY = 615;
    rectanguloRelleno(40, cursorY - 6, 515, 22, [0.16, 0.15, 0.14]);
    texto(48, cursorY + 2, 'SKU', 8.5, true, [1, 1, 1]);
    texto(125, cursorY + 2, 'DESCRIPCION DEL INSUMO / ARTICULO', 8.5, true, [1, 1, 1]);
    texto(340, cursorY + 2, 'UNIDAD', 8.5, true, [1, 1, 1]);
    texto(390, cursorY + 2, 'CANT.', 8.5, true, [1, 1, 1]);
    texto(440, cursorY + 2, 'P. UNIT NETO', 8.5, true, [1, 1, 1]);
    texto(505, cursorY + 2, 'SUBTOTAL', 8.5, true, [1, 1, 1]);

    cursorY -= 24;
    const maxFilas = Math.min(datos.lineas.length, 14);
    for (let i = 0; i < maxFilas; i++) {
        const item = datos.lineas[i];
        if (i % 2 === 0) {
            rectanguloRelleno(40, cursorY - 6, 515, 20, [0.99, 0.99, 0.98]);
        }
        texto(48, cursorY, truncar(item.sku || `ITEM-${i + 1}`, 13), 8.5, false);
        texto(125, cursorY, truncar(item.nombre_articulo, 38), 8.5, true);
        texto(342, cursorY, truncar(item.unidad || 'un', 8), 8.5, false);
        texto(392, cursorY, formatearCantidad(item.cantidad), 8.5, false);
        texto(442, cursorY, formatearMonedaCLP(item.precio_unitario), 8.5, false);
        texto(502, cursorY, formatearMonedaCLP(item.subtotal_linea), 8.5, true);
        linea(40, cursorY - 6, 555, cursorY - 6, [0.91, 0.9, 0.89], 0.5);
        cursorY -= 20;
    }

    // 4. OBSERVACIONES Y CUADRO DE TOTALES (NETO + IVA 19% + TOTAL)
    const bloqueTotalesY = Math.min(cursorY - 15, 310);

    // Observaciones a la izquierda
    rectanguloRelleno(40, bloqueTotalesY - 55, 285, 70, [0.98, 0.98, 0.97]);
    rectanguloBorde(40, bloqueTotalesY - 55, 285, 70, [0.88, 0.86, 0.84], 0.7);
    texto(50, bloqueTotalesY, 'OBSERVACIONES Y CONDICIONES DE ENTREGA:', 8.5, true, [0.47, 0.44, 0.42]);
    texto(
        50,
        bloqueTotalesY - 16,
        truncar(datos.observaciones || 'Entregar en Bodega Central FYAG indicando N° de OC en Guia o Factura.', 54),
        8.5,
        false
    );
    texto(50, bloqueTotalesY - 32, 'La Orden de Compra es requisito obligatorio para la recepcion (H33).', 8, false, [0.47, 0.44, 0.42]);

    // Totales a la derecha
    rectanguloRelleno(340, bloqueTotalesY - 55, 215, 70, [0.99, 0.97, 0.93]);
    rectanguloBorde(340, bloqueTotalesY - 55, 215, 70, [0.96, 0.62, 0.04], 1);

    texto(352, bloqueTotalesY - 2, 'Subtotal Neto:', 9.5, false);
    texto(480, bloqueTotalesY - 2, formatearMonedaCLP(datos.subtotal_neto), 9.5, true);

    texto(352, bloqueTotalesY - 20, 'IVA (19%):', 9.5, false);
    texto(480, bloqueTotalesY - 20, formatearMonedaCLP(datos.iva), 9.5, true);

    linea(350, bloqueTotalesY - 28, 545, bloqueTotalesY - 28, [0.85, 0.47, 0.02], 0.8);
    texto(352, bloqueTotalesY - 44, 'TOTAL CON IVA (CLP):', 10.5, true, [0.71, 0.33, 0.04]);
    texto(475, bloqueTotalesY - 44, formatearMonedaCLP(datos.total), 11, true, [0.71, 0.33, 0.04]);

    // 5. BLOQUES DE FIRMA Y TIMBRE DE APROBACIÓN
    const firmasY = 120;
    linea(70, firmasY, 245, firmasY, [0.34, 0.33, 0.31], 0.9);
    texto(88, firmasY - 14, 'Autorizado por Administracion', 9, true);
    texto(95, firmasY - 27, datos.aprobado_por || 'FYAG Multisystem SpA', 8.5, false, [0.47, 0.44, 0.42]);

    linea(350, firmasY, 525, firmasY, [0.34, 0.33, 0.31], 0.9);
    texto(375, firmasY - 14, 'Recepcion Conforme Bodega', 9, true);
    texto(390, firmasY - 27, 'Firma, Fecha y Timbre Recepcion', 8.5, false, [0.47, 0.44, 0.42]);

    // Pie de página corporativo
    linea(40, 58, 555, 58, [0.88, 0.86, 0.84], 0.6);
    texto(
        40,
        44,
        `Documento oficial generado electronicamente por Sistema ERP FYAG  |  Orden N° ${datos.numero_oc}`,
        8,
        false,
        [0.47, 0.44, 0.42]
    );

    const flujoContenido = ops.join('\n');
    const bytesContenido = Buffer.byteLength(flujoContenido, 'latin1');

    // Construcción de objetos PDF 1.4 con tabla XREF exacta
    const objetos: string[] = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
        `6 0 obj\n<< /Length ${bytesContenido} >>\nstream\n${flujoContenido}\nendstream\nendobj\n`,
    ];

    const cabecera = '%PDF-1.4\n';
    const desplazamientos: number[] = [];
    let cuerpo = cabecera;

    for (const obj of objetos) {
        desplazamientos.push(Buffer.byteLength(cuerpo, 'latin1'));
        cuerpo += obj;
    }

    const inicioXref = Buffer.byteLength(cuerpo, 'latin1');
    let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const offset of desplazamientos) {
        xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
    return Buffer.from(cuerpo + xref + trailer, 'latin1');
};

/**
 * Construye el correo saliente con el PDF corporativo adjunto para despachar al proveedor
 * cuando el Administrador aprueba la Orden de Compra.
 */
export const construirCorreoOrdenCompra = (
    datos: DatosPdfOrdenCompra,
    pdfBuffer: Buffer,
    correoDestino: string
): CorreoSaliente => {
    const nombreProveedor = datos.proveedor.razon_social || datos.proveedor.nombre_proveedor;
    const asunto = `Orden de Compra ${datos.numero_oc} - FYAG Multisystem SpA`;

    const resumenLineasTexto = datos.lineas
        .map(
            (l) =>
                `  - ${l.nombre_articulo} (${l.sku}): ${formatearCantidad(l.cantidad)} ${l.unidad} x ${formatearMonedaCLP(l.precio_unitario)} = ${formatearMonedaCLP(l.subtotal_linea)}`
        )
        .join('\n');

    const texto = [
        `Estimados ${nombreProveedor} (RUT ${datos.proveedor.rut_proveedor}),`,
        '',
        `Junto con saludar, informamos que nuestra Administración ha aprobado y emitido la Orden de Compra N° ${datos.numero_oc}.`,
        'Adjuntamos el documento PDF corporativo oficial con el detalle de los insumos requeridos:',
        '',
        `Número de OC: ${datos.numero_oc}`,
        `Estado: ${datos.estado}`,
        `Fecha de Emisión: ${datos.fecha_emision}`,
        `Fecha Estimada de Entrega: ${datos.fecha_estimada_oc || 'A convenir'}`,
        '',
        'Detalle de Ítems:',
        resumenLineasTexto,
        '',
        `Subtotal Neto: ${formatearMonedaCLP(datos.subtotal_neto)}`,
        `IVA (19%): ${formatearMonedaCLP(datos.iva)}`,
        `Total con IVA: ${formatearMonedaCLP(datos.total)}`,
        '',
        datos.observaciones ? `Observaciones: ${datos.observaciones}` : '',
        '',
        'Por favor indicar el número de Orden de Compra en su Guía de Despacho y Factura.',
        '',
        'Atentamente,',
        'Departamento de Adquisiciones y Abastecimiento',
        'FYAG Multisystem SpA',
    ]
        .filter((lineaTexto, idx, arr) => !(lineaTexto === '' && arr[idx - 1] === ''))
        .join('\n');

    const filasHtml = datos.lineas
        .map(
            (l) => `
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e7e5e4;font-family:monospace;">${l.sku}</td>
                <td style="padding:8px;border-bottom:1px solid #e7e5e4;"><strong>${l.nombre_articulo}</strong></td>
                <td style="padding:8px;border-bottom:1px solid #e7e5e4;text-align:center;">${formatearCantidad(l.cantidad)} ${l.unidad}</td>
                <td style="padding:8px;border-bottom:1px solid #e7e5e4;text-align:right;">${formatearMonedaCLP(l.precio_unitario)}</td>
                <td style="padding:8px;border-bottom:1px solid #e7e5e4;text-align:right;"><strong>${formatearMonedaCLP(l.subtotal_linea)}</strong></td>
            </tr>`
        )
        .join('');

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
        <div style="background:#1c1917;color:#ffffff;padding:20px 24px;border-bottom:4px solid #d97706;">
            <h2 style="margin:0;font-size:18px;">FYAG MULTISYSTEM SpA</h2>
            <p style="margin:4px 0 0;color:#d6d3d1;font-size:13px;">Orden de Compra Aprobada N° <strong>${datos.numero_oc}</strong></p>
        </div>
        <div style="padding:24px;color:#1c1917;font-size:14px;line-height:1.5;">
            <p>Estimados <strong>${nombreProveedor}</strong> (${datos.proveedor.rut_proveedor}),</p>
            <p>Adjuntamos el PDF oficial correspondiente a la <strong>Orden de Compra ${datos.numero_oc}</strong>, aprobada por Administración.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
                <thead>
                    <tr style="background:#f5f5f4;text-align:left;">
                        <th style="padding:8px;">SKU</th>
                        <th style="padding:8px;">Insumo</th>
                        <th style="padding:8px;text-align:center;">Cantidad</th>
                        <th style="padding:8px;text-align:right;">P. Neto</th>
                        <th style="padding:8px;text-align:right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${filasHtml}</tbody>
            </table>
            <div style="text-align:right;margin-top:12px;">
                <p style="margin:2px 0;">Subtotal Neto: <strong>${formatearMonedaCLP(datos.subtotal_neto)}</strong></p>
                <p style="margin:2px 0;">IVA (19%): <strong>${formatearMonedaCLP(datos.iva)}</strong></p>
                <p style="margin:6px 0;font-size:16px;color:#b45309;">Total c/ IVA: <strong>${formatearMonedaCLP(datos.total)}</strong></p>
            </div>
        </div>
    </div>`;

    return {
        para: correoDestino,
        asunto,
        texto,
        html,
        adjuntos: [
            {
                filename: `${datos.numero_oc}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    };
};
