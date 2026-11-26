import { ErrorAplicacion } from './errores';

export const ESTADO_DEV_PROVEEDOR_PENDIENTE = 'Pendiente de resolución' as const;
export const ESTADO_DEV_PROVEEDOR_RESUELTA = 'Resuelta' as const;

export type EstadoDevolucionProveedor =
    | typeof ESTADO_DEV_PROVEEDOR_PENDIENTE
    | typeof ESTADO_DEV_PROVEEDOR_RESUELTA;

export const TIPO_RESOLUCION_NOTA_CREDITO = 'Nota de crédito' as const;
export const TIPO_RESOLUCION_REPOSICION = 'Reposición' as const;
export const TIPO_RESOLUCION_REEMBOLSO = 'Reembolso' as const;

export type TipoResolucionProveedor =
    | typeof TIPO_RESOLUCION_NOTA_CREDITO
    | typeof TIPO_RESOLUCION_REPOSICION
    | typeof TIPO_RESOLUCION_REEMBOLSO;

const redondear3 = (valor: number): number => Number(valor.toFixed(3));

export interface DatosValidadosEgresoCuarentena {
    cantidad: number;
    motivo: string;
    numero_guia_despacho: string;
}

/**
 * [BACK-2] Valida los datos obligatorios para egresar productos defectuosos desde cuarentena:
 * - cantidad > 0 (hasta 3 decimales) y <= stock en cuarentena
 * - motivo obligatorio
 * - número de guía de despacho obligatorio
 */
export const validarDatosEgresoCuarentena = (params: {
    cantidad: unknown;
    cuarentenaDisponible: number;
    motivo: unknown;
    numeroGuiaDespacho: unknown;
    etiquetaArticulo?: string;
}): DatosValidadosEgresoCuarentena => {
    const rawCant = params.cantidad;
    const numCant =
        typeof rawCant === 'number'
            ? rawCant
            : typeof rawCant === 'string' && rawCant.trim() !== ''
              ? Number(rawCant)
              : NaN;

    if (!Number.isFinite(numCant) || numCant <= 0) {
        throw new ErrorAplicacion(400, 'La cantidad a egresar desde cuarentena debe ser un número mayor a 0');
    }

    const cantidad = redondear3(numCant);
    if (Math.abs(numCant - cantidad) > 1e-6) {
        throw new ErrorAplicacion(400, 'La cantidad a egresar desde cuarentena admite hasta 3 decimales');
    }

    const motivo = typeof params.motivo === 'string' ? params.motivo.trim() : '';
    if (!motivo) {
        throw new ErrorAplicacion(400, 'El motivo del egreso desde cuarentena es obligatorio');
    }

    const numeroGuia = typeof params.numeroGuiaDespacho === 'string' ? params.numeroGuiaDespacho.trim() : '';
    if (!numeroGuia) {
        throw new ErrorAplicacion(400, 'El número de guía de despacho es obligatorio para egresar desde cuarentena');
    }

    const cuarentenaActual = redondear3(Number(params.cuarentenaDisponible));
    if (cantidad > cuarentenaActual) {
        const ref = params.etiquetaArticulo ? ` para ${params.etiquetaArticulo}` : '';
        throw new ErrorAplicacion(
            400,
            `La cantidad a devolver (${cantidad}) supera el saldo disponible en cuarentena (${cuarentenaActual})${ref}`
        );
    }

    return {
        cantidad,
        motivo: motivo.slice(0, 250),
        numero_guia_despacho: numeroGuia.slice(0, 80),
    };
};

export const normalizarTipoResolucionProveedor = (valor: unknown): TipoResolucionProveedor => {
    const limpio = String(valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (limpio === 'nota de credito' || limpio === 'nota_credito' || limpio === 'credito') {
        return TIPO_RESOLUCION_NOTA_CREDITO;
    }
    if (limpio === 'reposicion' || limpio === 'reemplazo_producto' || limpio === 'reemplazo') {
        return TIPO_RESOLUCION_REPOSICION;
    }
    if (limpio === 'reembolso') {
        return TIPO_RESOLUCION_REEMBOLSO;
    }
    throw new ErrorAplicacion(
        400,
        'El tipo de resolución debe ser "Nota de crédito", "Reposición" o "Reembolso"'
    );
};

export const construirAlertaEgresoCuarentenaAdmin = (params: {
    codigoDevolucion: string;
    sku: string;
    nombreArticulo: string;
    cantidad: number;
    motivo: string;
    numeroGuiaDespacho: string;
    nombreProveedor?: string | null;
}): { titulo: string; descripcion: string } => {
    const prov = params.nombreProveedor ? ` a ${params.nombreProveedor}` : ' al proveedor';
    return {
        titulo: `Egreso de cuarentena ${params.codigoDevolucion} (Guía ${params.numeroGuiaDespacho}): ${params.sku}`.slice(0, 200),
        descripcion:
            `Se despacharon ${params.cantidad} un. defectuosas de ${params.nombreArticulo} (${params.sku})${prov} ` +
            `con Guía de Despacho N° ${params.numeroGuiaDespacho}. Motivo: ${params.motivo}. ` +
            `Estado: Pendiente de resolución (dar seguimiento hasta obtener Nota de crédito o Reposición).`.slice(0, 500),
    };
};
