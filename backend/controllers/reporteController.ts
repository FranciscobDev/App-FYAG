import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { enviarErrorHttp } from '../services/errores';
import {
    LineaReporteMovimiento,
    ReporteMovimientos,
    armarReporte,
    construirConsultaReporte,
    generarExcelReporteMovimientos,
    generarPdfReporteMovimientos,
    normalizarFiltrosReporte,
} from '../services/reporteMovimientosService';

export const obtenerReporteMovimientos = async (
    cliente: Pick<PoolClient, 'query'>,
    query: Record<string, unknown>,
    ahora: Date = new Date()
): Promise<ReporteMovimientos> => {
    const filtros = normalizarFiltrosReporte(query, ahora);
    const { sql, params } = construirConsultaReporte(filtros);
    const r = await cliente.query<LineaReporteMovimiento>(sql, params);
    return armarReporte(filtros, r.rows);
};

/** GET /api/reportes/movimientos?formato=json|pdf|xlsx (solo Administrador). */
export const reporteMovimientos = async (req: Request, res: Response): Promise<void> => {
    try {
        const reporte = await obtenerReporteMovimientos(pool, req.query as Record<string, unknown>);
        const formato = String(req.query.formato ?? 'json').toLowerCase();

        if (formato === 'pdf' || formato === 'xlsx') {
            await registrarAuditoria({
                entidad: 'reporte_movimientos',
                accion: `exportar_${formato}`,
                idRegistro: null,
                idUsuarioEjecutor: obtenerIdEjecutor(req),
                estadoAnterior: null,
                estadoNuevo: { filtros: reporte.filtros, totales: reporte.totales },
                descripcion: `Exportación del reporte de movimientos a ${formato.toUpperCase()}`,
            });
        }

        if (formato === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte-movimientos.pdf"');
            res.send(generarPdfReporteMovimientos(reporte));
            return;
        }
        if (formato === 'xlsx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte-movimientos.xlsx"');
            res.send(await generarExcelReporteMovimientos(reporte));
            return;
        }
        res.status(200).json({ ok: true, ...reporte });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al generar el reporte de movimientos');
    }
};
