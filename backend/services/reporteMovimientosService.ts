import ExcelJS from 'exceljs';
import { ErrorAplicacion } from './errores';

export const TIPOS_MOVIMIENTO_REPORTE = ['Entrada', 'Salida', 'Ajuste', 'Transferencia'] as const;
export const DIAS_REPORTE_DEFECTO = 30;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface FiltrosReporteMovimientos {
    fecha_desde: string;
    fecha_hasta: string;
    id_insumo: number | null;
    tipo_movimiento: string | null;
    id_proyecto: number | null;
    id_usuario: number | null;
}

export interface LineaReporteMovimiento {
    id_movimiento: number;
    fecha_movimiento: string | Date;
    sku: string;
    insumo: string;
    tipo_movimiento: string;
    cantidad: number;
    costo_unitario: number;
    costo_total: number;
    id_proyecto: number | null;
    proyecto: string | null;
    id_usuario: number | null;
    usuario: string | null;
}

export interface TotalesReporte {
    total_lineas: number;
    total_cantidad: number;
    total_costo: number;
    por_tipo: { tipo_movimiento: string; lineas: number; cantidad: number; costo: number }[];
}

export interface ReporteMovimientos {
    filtros: FiltrosReporteMovimientos;
    lineas: LineaReporteMovimiento[];
    totales: TotalesReporte;
}

const entero = (v: unknown, nombre: string): number | null => {
    if (v === undefined || v === null || v === '') return null;
    if (!/^\d+$/.test(String(v)) || Number(v) <= 0) {
        throw new ErrorAplicacion(400, `${nombre} debe ser un entero positivo`);
    }
    return Number(v);
};

/** Por defecto: últimos 30 días hasta hoy. El rango es modificable por fecha_desde / fecha_hasta. */
export const normalizarFiltrosReporte = (q: Record<string, unknown>, ahora: Date = new Date()): FiltrosReporteMovimientos => {
    const hasta = q.fecha_hasta ? String(q.fecha_hasta) : isoLocal(ahora);
    const desde = q.fecha_desde
        ? String(q.fecha_desde)
        : isoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - DIAS_REPORTE_DEFECTO));
    if (!FORMATO_FECHA.test(desde) || !FORMATO_FECHA.test(hasta) || Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) {
        throw new ErrorAplicacion(400, 'Las fechas deben tener formato AAAA-MM-DD válido');
    }
    if (desde > hasta) throw new ErrorAplicacion(400, 'fecha_desde no puede ser posterior a fecha_hasta');

    const tipo = q.tipo_movimiento ? String(q.tipo_movimiento) : null;
    if (tipo && !(TIPOS_MOVIMIENTO_REPORTE as readonly string[]).includes(tipo)) {
        throw new ErrorAplicacion(400, `Tipo de movimiento inválido. Valores permitidos: ${TIPOS_MOVIMIENTO_REPORTE.join(', ')}`);
    }
    return {
        fecha_desde: desde,
        fecha_hasta: hasta,
        id_insumo: entero(q.id_insumo, 'id_insumo'),
        tipo_movimiento: tipo,
        id_proyecto: entero(q.id_proyecto, 'id_proyecto'),
        id_usuario: entero(q.id_usuario, 'id_usuario'),
    };
};

/** Consulta con filtros combinables (AND). El costo de línea = cantidad × costo unitario, redondeado. */
export const construirConsultaReporte = (f: FiltrosReporteMovimientos): { sql: string; params: unknown[] } => {
    const params: unknown[] = [f.fecha_desde, f.fecha_hasta];
    const cond = ['m.fecha_movimiento::date >= $1::date', 'm.fecha_movimiento::date <= $2::date'];
    const agregar = (col: string, v: unknown) => {
        if (v === null) return;
        params.push(v);
        cond.push(`${col} = $${params.length}`);
    };
    agregar('m.id_insumo', f.id_insumo);
    agregar('m.tipo_movimiento::text', f.tipo_movimiento);
    agregar('m.id_proyecto', f.id_proyecto);
    agregar('m.id_usuario', f.id_usuario);

    const sql = `/* reporte:movimientos */
        SELECT m.id_movimiento, m.fecha_movimiento, i.sku, i.nombre AS insumo,
               m.tipo_movimiento::text AS tipo_movimiento,
               m.cantidad::float8 AS cantidad, m.costo_unitario::float8 AS costo_unitario,
               ROUND(m.cantidad * m.costo_unitario)::float8 AS costo_total,
               m.id_proyecto, p.nombre_proyecto AS proyecto,
               m.id_usuario, NULLIF(TRIM(CONCAT(u.nombre_usuario, ' ', u.apellido_usuario)), '') AS usuario
        FROM movimientos_inventario m
        JOIN insumos i ON i.id_insumo = m.id_insumo
        LEFT JOIN proyecto p ON p.id_proyecto = m.id_proyecto
        LEFT JOIN usuario u ON u.id_usuario = m.id_usuario
        WHERE ${cond.join(' AND ')}
        ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC`;
    return { sql, params };
};

/** Totales calculados desde las MISMAS líneas que se muestran/exportan, para que siempre cuadren. */
export const calcularTotalesReporte = (lineas: LineaReporteMovimiento[]): TotalesReporte => {
    const mapa = new Map<string, { tipo_movimiento: string; lineas: number; cantidad: number; costo: number }>();
    let cant = 0;
    let costo = 0;
    for (const l of lineas) {
        const c = Number(l.cantidad) || 0;
        const k = Number(l.costo_total) || 0;
        cant += c;
        costo += k;
        const t = mapa.get(l.tipo_movimiento) ?? { tipo_movimiento: l.tipo_movimiento, lineas: 0, cantidad: 0, costo: 0 };
        t.lineas += 1;
        t.cantidad = redondear3(t.cantidad + c);
        t.costo += k;
        mapa.set(l.tipo_movimiento, t);
    }
    return {
        total_lineas: lineas.length,
        total_cantidad: redondear3(cant),
        total_costo: costo,
        por_tipo: [...mapa.values()],
    };
};

const redondear3 = (n: number) => Math.round(n * 1000) / 1000;

export const armarReporte = (filtros: FiltrosReporteMovimientos, lineas: LineaReporteMovimiento[]): ReporteMovimientos => ({
    filtros,
    lineas,
    totales: calcularTotalesReporte(lineas),
});

export const describirFiltros = (f: FiltrosReporteMovimientos): string[] => [
    `Periodo: ${f.fecha_desde} a ${f.fecha_hasta}`,
    `Insumo: ${f.id_insumo ?? 'Todos'}`,
    `Tipo de movimiento: ${f.tipo_movimiento ?? 'Todos'}`,
    `Proyecto: ${f.id_proyecto ?? 'Todos'}`,
    `Usuario: ${f.id_usuario ?? 'Todos'}`,
];

const fechaTexto = (v: string | Date) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 16).replace('T', ' ');

export const generarExcelReporteMovimientos = async (r: ReporteMovimientos): Promise<Buffer> => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Movimientos');
    hoja.addRow(['Reporte de movimientos de inventario']).font = { bold: true, size: 14 };
    for (const t of describirFiltros(r.filtros)) hoja.addRow([t]);
    hoja.addRow([]);
    const cab = hoja.addRow(['Fecha', 'SKU', 'Insumo', 'Tipo', 'Cantidad', 'Costo unitario', 'Costo total', 'Proyecto', 'Usuario']);
    cab.font = { bold: true };
    for (const l of r.lineas) {
        hoja.addRow([
            fechaTexto(l.fecha_movimiento), l.sku, l.insumo, l.tipo_movimiento, l.cantidad,
            l.costo_unitario, l.costo_total, l.proyecto ?? l.id_proyecto ?? '', l.usuario ?? l.id_usuario ?? '',
        ]);
    }
    const tot = hoja.addRow(['TOTAL', '', `${r.totales.total_lineas} líneas`, '', r.totales.total_cantidad, '', r.totales.total_costo, '', '']);
    tot.font = { bold: true };
    [14, 40, 14, 14, 12, 16, 14, 24, 24].forEach((w, i) => (hoja.getColumn(i + 1).width = Math.max(w, 12)));
    return Buffer.from(await libro.xlsx.writeBuffer());
};

const moneda = (n: number) => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const cantidadTxt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, ''));
const esc = (t: string) => (t || '').replace(/[\u2013\u2014]/g, '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const cortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}.` : t);

/** PDF A4 horizontal, multipágina, con filtros aplicados y totales (sin dependencias externas). */
export const generarPdfReporteMovimientos = (r: ReporteMovimientos): Buffer => {
    const FILAS_POR_PAGINA = 24;
    const cols = [
        { t: 'Fecha', x: 30 }, { t: 'SKU', x: 105 }, { t: 'Insumo', x: 185 }, { t: 'Tipo', x: 355 },
        { t: 'Cantidad', x: 420 }, { t: 'Costo total', x: 485 }, { t: 'Proyecto', x: 560 }, { t: 'Usuario', x: 680 },
    ];
    const paginas: string[][] = [];
    const txt = (ops: string[], x: number, y: number, s: string, size = 8, bold = false) =>
        ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(s)}) Tj ET`);

    const lineas = r.lineas;
    const nPag = Math.max(1, Math.ceil(lineas.length / FILAS_POR_PAGINA));
    for (let p = 0; p < nPag; p++) {
        const ops: string[] = [];
        txt(ops, 30, 565, 'FYAG MULTISYSTEM SpA - Reporte de movimientos de inventario', 13, true);
        describirFiltros(r.filtros).forEach((f, i) => txt(ops, 30, 548 - i * 11, f, 8));
        let y = 480;
        cols.forEach((c) => txt(ops, c.x, y, c.t, 8, true));
        ops.push(`0.5 w 30 ${y - 4} m 812 ${y - 4} l S`);
        y -= 16;
        for (const l of lineas.slice(p * FILAS_POR_PAGINA, (p + 1) * FILAS_POR_PAGINA)) {
            txt(ops, 30, y, fechaTexto(l.fecha_movimiento), 7.5);
            txt(ops, 105, y, cortar(l.sku, 14), 7.5);
            txt(ops, 185, y, cortar(l.insumo, 32), 7.5);
            txt(ops, 355, y, l.tipo_movimiento, 7.5);
            txt(ops, 420, y, cantidadTxt(l.cantidad), 7.5);
            txt(ops, 485, y, moneda(l.costo_total), 7.5);
            txt(ops, 560, y, cortar(String(l.proyecto ?? l.id_proyecto ?? '-'), 22), 7.5);
            txt(ops, 680, y, cortar(String(l.usuario ?? l.id_usuario ?? '-'), 24), 7.5);
            y -= 16;
        }
        if (p === nPag - 1) {
            ops.push(`0.8 w 30 ${y + 8} m 812 ${y + 8} l S`);
            txt(ops, 30, y - 6, `TOTAL: ${r.totales.total_lineas} lineas`, 9, true);
            txt(ops, 420, y - 6, cantidadTxt(r.totales.total_cantidad), 9, true);
            txt(ops, 485, y - 6, moneda(r.totales.total_costo), 9, true);
        }
        txt(ops, 30, 20, `Pagina ${p + 1} de ${nPag}`, 7);
        paginas.push(ops);
    }

    const objetos: string[] = [];
    const idsPagina: number[] = [];
    for (let i = 0; i < nPag; i++) idsPagina.push(5 + i * 2);
    objetos.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objetos.push(`2 0 obj\n<< /Type /Pages /Kids [${idsPagina.map((n) => `${n} 0 R`).join(' ')}] /Count ${nPag} >>\nendobj\n`);
    objetos.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
    objetos.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
    paginas.forEach((ops, i) => {
        const idP = 5 + i * 2;
        const flujo = ops.join('\n');
        objetos.push(`${idP} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idP + 1} 0 R >>\nendobj\n`);
        objetos.push(`${idP + 1} 0 obj\n<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream\nendobj\n`);
    });

    let cuerpo = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const o of objetos) {
        offsets.push(Buffer.byteLength(cuerpo, 'latin1'));
        cuerpo += o;
    }
    const inicio = Buffer.byteLength(cuerpo, 'latin1');
    let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    return Buffer.from(`${cuerpo}${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`, 'latin1');
};
