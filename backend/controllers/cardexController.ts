import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import pool from '../config/db';
import { enviarErrorHttp } from '../services/errores';

const TIPOS_MOVIMIENTO = ['Entrada', 'Salida', 'Ajuste', 'Transferencia'];
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ENTERO_POSITIVO = /^\d+$/;

/**
 * [BACK-2] Cardex de solo lectura (Bodeguero y Administrador).
 * Filtros combinables por query string: id_insumo, id_proyecto, tipo_movimiento,
 * fecha_desde y fecha_hasta (AAAA-MM-DD). Con formato=xlsx descarga el mismo resultado en Excel.
 */
export const listarCardex = async (req: Request, res: Response): Promise<void> => {
    const { id_insumo, id_proyecto, tipo_movimiento, fecha_desde, fecha_hasta, formato } =
        req.query as Record<string, string | undefined>;

    if ((fecha_desde && !FORMATO_FECHA.test(fecha_desde)) || (fecha_hasta && !FORMATO_FECHA.test(fecha_hasta))) {
        res.status(400).json({ mensaje: 'Las fechas deben tener formato AAAA-MM-DD' });
        return;
    }
    if (tipo_movimiento && !TIPOS_MOVIMIENTO.includes(tipo_movimiento)) {
        res.status(400).json({ mensaje: `Tipo de movimiento inválido. Valores permitidos: ${TIPOS_MOVIMIENTO.join(', ')}` });
        return;
    }
    if ((id_insumo && !ENTERO_POSITIVO.test(id_insumo)) || (id_proyecto && !ENTERO_POSITIVO.test(id_proyecto))) {
        res.status(400).json({ mensaje: 'id_insumo e id_proyecto deben ser enteros positivos' });
        return;
    }

    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (id_insumo) {
        params.push(Number(id_insumo));
        condiciones.push(`m.id_insumo = $${params.length}`);
    }
    if (id_proyecto) {
        params.push(Number(id_proyecto));
        condiciones.push(`m.id_proyecto = $${params.length}`);
    }
    if (tipo_movimiento) {
        params.push(tipo_movimiento);
        condiciones.push(`m.tipo_movimiento = $${params.length}`);
    }
    if (fecha_desde) {
        params.push(fecha_desde);
        condiciones.push(`m.fecha_movimiento::date >= $${params.length}::date`);
    }
    if (fecha_hasta) {
        params.push(fecha_hasta);
        condiciones.push(`m.fecha_movimiento::date <= $${params.length}::date`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    try {
        const resultado = await pool.query(
            `SELECT m.id_movimiento, m.fecha_movimiento, m.tipo_movimiento::text AS tipo_movimiento,
                    m.destino_bolsa, i.sku, i.nombre AS insumo,
                    m.cantidad::float8 AS cantidad, m.costo_unitario::float8 AS costo_unitario,
                    m.saldo_historico::float8 AS saldo_historico, m.pmp_historico::float8 AS pmp_historico,
                    m.valor_total_historico::float8 AS valor_total_historico,
                    m.id_proyecto, m.referencia
             FROM movimientos_inventario m
             JOIN insumos i ON i.id_insumo = m.id_insumo
             ${where}
             ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC`,
            params
        );

        if (formato === 'xlsx') {
            const libro = new ExcelJS.Workbook();
            const hoja = libro.addWorksheet('Cardex');
            hoja.columns = [
                { header: 'Fecha', key: 'fecha', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
                { header: 'Tipo', key: 'tipo', width: 14 },
                { header: 'Destino', key: 'destino', width: 14 },
                { header: 'SKU', key: 'sku', width: 18 },
                { header: 'Insumo', key: 'insumo', width: 40 },
                { header: 'Cantidad', key: 'cantidad', width: 12 },
                { header: 'Costo unitario', key: 'costo', width: 14 },
                { header: 'Saldo histórico', key: 'saldo', width: 16 },
                { header: 'PMP histórico', key: 'pmp', width: 14 },
                { header: 'Valor total', key: 'valor', width: 16 },
                { header: 'Proyecto', key: 'proyecto', width: 12 },
                { header: 'Referencia', key: 'referencia', width: 60 },
            ];
            hoja.getRow(1).font = { bold: true };
            for (const f of resultado.rows) {
                hoja.addRow({
                    fecha: f.fecha_movimiento,
                    tipo: f.tipo_movimiento,
                    destino: f.destino_bolsa,
                    sku: f.sku,
                    insumo: f.insumo,
                    cantidad: f.cantidad,
                    costo: f.costo_unitario,
                    saldo: f.saldo_historico,
                    pmp: f.pmp_historico,
                    valor: f.valor_total_historico,
                    proyecto: f.id_proyecto,
                    referencia: f.referencia,
                });
            }
            const contenido = await libro.xlsx.writeBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="cardex.xlsx"');
            res.send(Buffer.from(contenido));
            return;
        }

        res.json({ total: resultado.rows.length, movimientos: resultado.rows });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar el Cardex');
    }
};
