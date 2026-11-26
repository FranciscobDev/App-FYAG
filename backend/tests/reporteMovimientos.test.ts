import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { obtenerReporteMovimientos } from '../controllers/reporteController';
import {
    generarExcelReporteMovimientos,
    generarPdfReporteMovimientos,
    normalizarFiltrosReporte,
} from '../services/reporteMovimientosService';

const AHORA = new Date(2026, 10, 25, 12, 0, 0); // 25-11-2026

const fila = (id: number, dia: string, insumo: number, tipo: string, cant: number, costo: number, proyecto: number | null, usuario: number) => ({
    id_movimiento: id,
    fecha_movimiento: `${dia}T10:00:00Z`,
    id_insumo: insumo,
    sku: `SKU-${insumo}`,
    insumo: `Insumo ${insumo}`,
    tipo_movimiento: tipo,
    cantidad: cant,
    costo_unitario: costo,
    costo_total: Math.round(cant * costo),
    id_proyecto: proyecto,
    proyecto: proyecto ? `Proyecto ${proyecto}` : null,
    id_usuario: usuario,
    usuario: `Usuario ${usuario}`,
});

const DATOS = [
    fila(1, '2026-11-20', 10, 'Salida', 5, 1200, 7, 3),
    fila(2, '2026-11-21', 10, 'Salida', 2.5, 1200, 7, 3),
    fila(3, '2026-11-22', 10, 'Salida', 4, 1200, 8, 3), // otro proyecto
    fila(4, '2026-11-22', 10, 'Entrada', 20, 1100, 7, 3), // otro tipo
    fila(5, '2026-11-23', 11, 'Salida', 3, 900, 7, 3), // otro insumo
    fila(6, '2026-11-23', 10, 'Salida', 1, 1200, 7, 4), // otro usuario
    fila(7, '2026-09-01', 10, 'Salida', 9, 1200, 7, 3), // fuera de rango (por defecto)
];

/** Cliente simulado que aplica los filtros reales de la consulta generada (parseando su SQL). */
const clienteSimulado: any = {
    query: async (sql: string, p: any[]) => {
        const desde = p[0];
        const hasta = p[1];
        const reglas = [...sql.matchAll(/m\.(\w+)(?:::text)? = \$(\d+)/g)].map((m) => ({ col: m[1], val: p[Number(m[2]) - 1] }));
        const rows = DATOS.filter((d: any) => {
            const dia = String(d.fecha_movimiento).slice(0, 10);
            return dia >= desde && dia <= hasta && reglas.every((r) => String(d[r.col]) === String(r.val));
        });
        return { rows };
    },
};

test('[BACK-1] por defecto cubre los últimos 30 días y el rango es modificable', () => {
    const def = normalizarFiltrosReporte({}, AHORA);
    assert.equal(def.fecha_hasta, '2026-11-25');
    assert.equal(def.fecha_desde, '2026-10-26');
    const custom = normalizarFiltrosReporte({ fecha_desde: '2026-01-01', fecha_hasta: '2026-01-31' }, AHORA);
    assert.equal(custom.fecha_desde, '2026-01-01');
    assert.throws(() => normalizarFiltrosReporte({ fecha_desde: '2026-12-01', fecha_hasta: '2026-11-01' }, AHORA), /posterior/);
    assert.throws(() => normalizarFiltrosReporte({ tipo_movimiento: 'Otro' }, AHORA), /Tipo de movimiento inválido/);
    assert.throws(() => normalizarFiltrosReporte({ id_insumo: 'abc' }, AHORA), /entero positivo/);
});

test('[BACK-1] sin filtros adicionales excluye lo anterior a 30 días e incluye totales por tipo', async () => {
    const r = await obtenerReporteMovimientos(clienteSimulado, {}, AHORA);
    assert.equal(r.lineas.length, 6);
    assert.equal(r.totales.total_lineas, 6);
    assert.equal(r.totales.por_tipo.find((t) => t.tipo_movimiento === 'Entrada')?.cantidad, 20);
});

test('[BACK-1][SCRUM] aplica 3 filtros combinados, exporta PDF y Excel y los totales coinciden', async () => {
    const q = { id_insumo: '10', tipo_movimiento: 'Salida', id_proyecto: '7' };
    const r = await obtenerReporteMovimientos(clienteSimulado, q, AHORA);

    // Líneas 1, 2 y 6 cumplen los 3 filtros
    assert.deepEqual(r.lineas.map((l) => l.id_movimiento).sort(), [1, 2, 6]);
    assert.equal(r.totales.total_cantidad, 8.5);
    assert.equal(r.totales.total_costo, 6000 + 3000 + 1200);
    assert.equal(r.totales.total_costo, r.lineas.reduce((a, l) => a + l.costo_total, 0));

    // 4º filtro (usuario) se combina con los anteriores
    const conUsuario = await obtenerReporteMovimientos(clienteSimulado, { ...q, id_usuario: '3' }, AHORA);
    assert.deepEqual(conUsuario.lineas.map((l) => l.id_movimiento).sort(), [1, 2]);
    assert.equal(conUsuario.totales.total_cantidad, 7.5);

    // Excel: filtros visibles, mismas líneas y misma fila de totales
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await generarExcelReporteMovimientos(r)) as any);
    const hoja = libro.getWorksheet('Movimientos')!;
    const textos: string[] = [];
    hoja.eachRow((row) => textos.push(String(row.getCell(1).value ?? '')));
    assert.ok(textos.some((t) => t.includes('Insumo: 10')));
    assert.ok(textos.some((t) => t.includes('Tipo de movimiento: Salida')));
    assert.ok(textos.some((t) => t.includes('Proyecto: 7')));
    const filaTotal = hoja.lastRow!;
    assert.equal(filaTotal.getCell(1).value, 'TOTAL');
    assert.equal(filaTotal.getCell(5).value, r.totales.total_cantidad);
    assert.equal(filaTotal.getCell(7).value, r.totales.total_costo);
    let sumaCant = 0;
    let sumaCosto = 0;
    let lineasExcel = 0;
    hoja.eachRow((row) => {
        if (typeof row.getCell(5).value === 'number' && row.getCell(1).value !== 'TOTAL') {
            lineasExcel += 1;
            sumaCant += Number(row.getCell(5).value);
            sumaCosto += Number(row.getCell(7).value);
        }
    });
    assert.equal(lineasExcel, r.lineas.length);
    assert.equal(sumaCant, r.totales.total_cantidad);
    assert.equal(sumaCosto, r.totales.total_costo);

    // PDF: válido, con filtros y totales
    const pdf = generarPdfReporteMovimientos(r).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
    assert.ok(pdf.includes('Tipo de movimiento: Salida'));
    assert.ok(pdf.includes('Proyecto: 7'));
    assert.ok(pdf.includes('TOTAL: 3 lineas'));
    assert.ok(pdf.includes('$10.200'));
    assert.ok(pdf.includes('(8.5)'));
});

test('[BACK-1] el PDF pagina los reportes largos y mantiene un único total', async () => {
    const lineas = Array.from({ length: 60 }, (_, i) => fila(i + 1, '2026-11-20', 10, 'Salida', 1, 1000, 7, 3));
    const { armarReporte } = await import('../services/reporteMovimientosService');
    const rep = armarReporte(normalizarFiltrosReporte({}, AHORA), lineas as any);
    const pdf = generarPdfReporteMovimientos(rep).toString('latin1');
    assert.ok(pdf.includes('/Count 3'));
    assert.equal(pdf.split('TOTAL: 60 lineas').length - 1, 1);
    assert.ok(pdf.includes('$60.000'));
});
