import { ErrorAplicacion } from './errores';

/**
 * [BACK-1] Reglas puras (sin base de datos) de la confirmación de recepción de devoluciones:
 * validación de cantidades reales, diferencias contra lo declarado, ajuste de costo y alerta.
 */

export const ESTADO_DEVOLUCION_EN_TRANSITO = 'En tránsito';
export const ESTADO_DEVOLUCION_RECIBIDA = 'Recibida';

export interface LineaDevolucionDb {
    id_devolucion_linea: number;
    id_articulo: number;
    cantidad_declarada: number;
}

export interface LineaConfirmacionEntrada {
    id_devolucion_linea?: number;
    id_articulo?: number;
    cantidad_recibida?: unknown;
}

export interface LineaPlanConfirmacion {
    id_devolucion_linea: number;
    id_articulo: number;
    cantidad_declarada: number;
    cantidad_recibida: number;
    /** recibida - declarada (negativa = faltante, positiva = sobrante). */
    diferencia: number;
}

const redondear3 = (n: number): number => Number(n.toFixed(3));

/** Acepta solo números finitos >= 0 con hasta 3 decimales. */
export const normalizarCantidadRecibida = (valor: unknown): number | null => {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return redondear3(n);
};

/**
 * Cruza lo que el bodeguero confirma contra las líneas declaradas por el técnico.
 * Reglas (todas se validan ANTES de tocar stock, para que un error no deje cambios a medias):
 *  - Cada línea declarada debe confirmarse exactamente una vez (por id de línea o por id de artículo).
 *  - La cantidad real es un número >= 0 y no puede superar lo declarado (no se crea stock de la nada).
 */
export const planificarConfirmacionRecepcion = (
    lineasDb: LineaDevolucionDb[],
    entradas: unknown
): LineaPlanConfirmacion[] => {
    if (!Array.isArray(entradas) || entradas.length === 0) {
        throw new ErrorAplicacion(400, 'Debes informar la cantidad realmente recibida de cada ítem');
    }

    const usadas = new Set<number>();
    const plan: LineaPlanConfirmacion[] = [];

    for (const bruta of entradas as LineaConfirmacionEntrada[]) {
        const entrada = bruta ?? {};
        const linea = lineasDb.find((l) =>
            entrada.id_devolucion_linea !== undefined
                ? l.id_devolucion_linea === Number(entrada.id_devolucion_linea)
                : entrada.id_articulo !== undefined && l.id_articulo === Number(entrada.id_articulo)
        );
        if (!linea) {
            throw new ErrorAplicacion(400, 'Hay un ítem que no pertenece a esta devolución');
        }
        if (usadas.has(linea.id_devolucion_linea)) {
            throw new ErrorAplicacion(400, `El artículo #${linea.id_articulo} está repetido en la confirmación`);
        }
        const recibida = normalizarCantidadRecibida(entrada.cantidad_recibida);
        if (recibida === null) {
            throw new ErrorAplicacion(400, `Cantidad recibida inválida para el artículo #${linea.id_articulo} (debe ser un número mayor o igual a 0)`);
        }
        const declarada = Number(linea.cantidad_declarada);
        if (recibida > declarada) {
            throw new ErrorAplicacion(
                400,
                `El artículo #${linea.id_articulo}: no puedes recibir más de lo declarado (${declarada}). Registra el excedente como ajuste de inventario.`
            );
        }
        usadas.add(linea.id_devolucion_linea);
        plan.push({
            id_devolucion_linea: linea.id_devolucion_linea,
            id_articulo: linea.id_articulo,
            cantidad_declarada: declarada,
            cantidad_recibida: recibida,
            diferencia: redondear3(recibida - declarada),
        });
    }

    const faltantes = lineasDb.filter((l) => !usadas.has(l.id_devolucion_linea));
    if (faltantes.length > 0) {
        throw new ErrorAplicacion(
            400,
            `Falta confirmar la cantidad recibida de: ${faltantes.map((l) => `artículo #${l.id_articulo}`).join(', ')}`
        );
    }

    return plan;
};

/** Monto (CLP, entero) que se descuenta del costo del proyecto: cantidad reincorporada × costo unitario. */
export const calcularMontoAjusteCosto = (cantidadRecibida: number, costoUnitario: number): number =>
    Math.round(cantidadRecibida * costoUnitario);

export const construirAlertaDiferenciaDevolucion = (datos: {
    codigo: string;
    proyectoId: number;
    tecnicoId: number;
    lineas: { sku: string; declarada: number; recibida: number }[];
}): { titulo: string; descripcion: string } => {
    const detalle = datos.lineas
        .filter((l) => l.declarada !== l.recibida)
        .map((l) => {
            const dif = redondear3(l.recibida - l.declarada);
            return `${l.sku}: declarado ${l.declarada}, recibido ${l.recibida} (${dif > 0 ? '+' : ''}${dif})`;
        })
        .join('; ');
    return {
        titulo: `Diferencia en devolución ${datos.codigo}`.slice(0, 200),
        descripcion: (
            `El bodeguero recibió una cantidad distinta a la declarada por el técnico #${datos.tecnicoId} ` +
            `(proyecto #${datos.proyectoId}). ${detalle}.`
        ).slice(0, 500),
    };
};
