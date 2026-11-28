import { EstadoHerramienta } from '../controllers/herramientaController';
import { ErrorAplicacion } from './errores';

export type EstadoDevolucionHerramienta = 'bueno' | 'dañado';

export const DIAS_MAX_PRESTAMO_DEFECTO = 7;

/** Bloquea prestar una herramienta En mantención, ya Asignada, dada de baja o deshabilitada. */
export const validarHerramientaPrestable = (h: {
    codigo_herramienta: string;
    estado: EstadoHerramienta;
    activo: boolean;
}): void => {
    if (!h.activo) {
        throw new ErrorAplicacion(409, `La herramienta ${h.codigo_herramienta} está deshabilitada`);
    }
    if (h.estado === 'asignada') {
        throw new ErrorAplicacion(409, `La herramienta ${h.codigo_herramienta} ya está Asignada a otro técnico`);
    }
    if (h.estado === 'en mantención') {
        throw new ErrorAplicacion(409, `La herramienta ${h.codigo_herramienta} está En mantención y no puede prestarse`);
    }
    if (h.estado !== 'disponible') {
        throw new ErrorAplicacion(409, `La herramienta ${h.codigo_herramienta} está ${h.estado} y no puede prestarse`);
    }
};

export const normalizarEstadoDevolucion = (valor: unknown): EstadoDevolucionHerramienta => {
    const v = String(valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (v === 'bueno') return 'bueno';
    if (v === 'danado') return 'dañado';
    throw new ErrorAplicacion(400, 'El estado de devolución debe ser "Bueno" o "Dañado"');
};

/** Bueno → Disponible; Dañado → En mantención (automático). */
export const estadoHerramientaTrasDevolucion = (e: EstadoDevolucionHerramienta): EstadoHerramienta =>
    e === 'bueno' ? 'disponible' : 'en mantención';

const MS_DIA = 24 * 60 * 60 * 1000;

export interface PrestamoAbierto {
    id_prestamo: number;
    fecha_entrega: string | Date;
    proyecto_cerrado?: boolean;
}

/** Motivo de alerta: proyecto cerrado con herramienta sin devolver, o préstamo superior a N días. */
export const motivoAlertaPrestamo = (
    p: PrestamoAbierto,
    diasMax: number,
    ahoraMs: number
): 'cierre_proyecto' | 'atraso' | null => {
    if (p.proyecto_cerrado) return 'cierre_proyecto';
    const dias = (ahoraMs - new Date(p.fecha_entrega).getTime()) / MS_DIA;
    return dias > diasMax ? 'atraso' : null;
};
