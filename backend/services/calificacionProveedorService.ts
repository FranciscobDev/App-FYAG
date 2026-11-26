import { ErrorAplicacion } from './errores';

export const ESTADOS_OC_CALIFICABLES = ['Recibida', 'Cerrada'] as const;

export const validarEstrellas = (valor: unknown, criterio: string): number => {
    const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) {
        throw new ErrorAplicacion(400, `La calificación de ${criterio} debe ser un entero de 1 a 5 estrellas`);
    }
    return n;
};

export const redondear2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Promedio simple de tiempo, calidad y precio con 2 decimales. */
export const promedioCalificacion = (tiempo: number, calidad: number, precio: number): number =>
    redondear2((tiempo + calidad + precio) / 3);

export const validarOcCalificable = (estado: string): void => {
    if (!(ESTADOS_OC_CALIFICABLES as readonly string[]).includes(estado)) {
        throw new ErrorAplicacion(409, `Solo se puede calificar una OC Recibida o Cerrada (estado actual: ${estado})`);
    }
};

const COLUMNAS_ORDEN: Record<string, string> = {
    calificacion: 'calificacion_promedio',
    id: 'id_proveedor',
    nombre: 'nombre_proveedor',
};

/** ORDER BY seguro (lista blanca) para el listado de proveedores. Sin calificar queda al final. */
export const construirOrdenProveedores = (q: { ordenar_por?: unknown; orden?: unknown }): string => {
    const clave = String(q.ordenar_por ?? '').toLowerCase();
    if (!clave) return 'id_proveedor ASC';
    const col = COLUMNAS_ORDEN[clave];
    if (!col) throw new ErrorAplicacion(400, `ordenar_por inválido. Valores permitidos: ${Object.keys(COLUMNAS_ORDEN).join(', ')}`);
    const dir = String(q.orden ?? (clave === 'calificacion' ? 'desc' : 'asc')).toLowerCase();
    if (dir !== 'asc' && dir !== 'desc') throw new ErrorAplicacion(400, 'orden debe ser asc o desc');
    return `${col} ${dir.toUpperCase()} NULLS LAST, id_proveedor ASC`;
};
