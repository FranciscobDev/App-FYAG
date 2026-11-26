import { ErrorAplicacion } from './errores';

export const ESTADO_CONTEO_EN_CURSO = 'En conteo' as const;
export const ESTADO_CONTEO_AJUSTADO_DIRECTO = 'Ajustado directo' as const;
export const ESTADO_CONTEO_PENDIENTE_APROBACION = 'Pendiente aprobación' as const;
export const ESTADO_CONTEO_APROBADO = 'Aprobado' as const;
export const ESTADO_CONTEO_RECHAZADO = 'Rechazado' as const;

export type EstadoConteoFisico =
    | typeof ESTADO_CONTEO_EN_CURSO
    | typeof ESTADO_CONTEO_AJUSTADO_DIRECTO
    | typeof ESTADO_CONTEO_PENDIENTE_APROBACION
    | typeof ESTADO_CONTEO_APROBADO
    | typeof ESTADO_CONTEO_RECHAZADO;

export const UMBRAL_CONTEO_POR_DEFECTO = 5;

const redondear3 = (valor: number): number => Number(valor.toFixed(3));
const redondear2 = (valor: number): number => Number(valor.toFixed(2));

/**
 * Valida y normaliza la cantidad física contada (>= 0, hasta 3 decimales).
 */
export const normalizarCantidadContada = (valor: unknown): number => {
    const num = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN;
    if (!Number.isFinite(num) || num < 0) {
        throw new ErrorAplicacion(400, 'La cantidad contada debe ser un número mayor o igual a 0');
    }
    const redondeado = redondear3(num);
    if (Math.abs(num - redondeado) > 1e-6) {
        throw new ErrorAplicacion(400, 'La cantidad contada admite como máximo 3 decimales');
    }
    return redondeado;
};

export interface CalculoDiferenciaConteo {
    stock_sistema: number;
    stock_contado: number;
    diferencia_cantidad: number;
    diferencia_porcentaje: number;
    diferencia_porcentaje_abs: number;
    pmp_unitario: number;
    diferencia_valor: number;
    umbral_porcentaje: number;
    requiere_aprobacion_admin: boolean;
    estado_resultante: typeof ESTADO_CONTEO_AJUSTADO_DIRECTO | typeof ESTADO_CONTEO_PENDIENTE_APROBACION;
}

/**
 * [BACK-1] Calcula la diferencia en cantidad, porcentaje y valorización a PMP,
 * y determina si se ajusta directamente (|%| <= umbral) o pasa a aprobación del Administrador (|%| > umbral).
 */
export const calcularDiferenciaConteo = (params: {
    stockSistema: number;
    stockContado: number;
    pmpUnitario: number;
    umbralPorcentaje?: number;
}): CalculoDiferenciaConteo => {
    const stockSistema = redondear3(Number(params.stockSistema));
    const stockContado = normalizarCantidadContada(params.stockContado);
    const pmpUnitario = Number.isFinite(params.pmpUnitario) && params.pmpUnitario > 0 ? Number(params.pmpUnitario) : 0;
    const umbral =
        params.umbralPorcentaje !== undefined && Number.isFinite(params.umbralPorcentaje) && params.umbralPorcentaje > 0
            ? redondear2(Number(params.umbralPorcentaje))
            : UMBRAL_CONTEO_POR_DEFECTO;

    const diferenciaCantidad = redondear3(stockContado - stockSistema);
    const diferenciaPorcentaje =
        stockSistema > 0
            ? redondear2((diferenciaCantidad / stockSistema) * 100)
            : diferenciaCantidad === 0
              ? 0
              : 100;
    const diferenciaPorcentajeAbs = redondear2(Math.abs(diferenciaPorcentaje));
    const diferenciaValor = Math.round(diferenciaCantidad * pmpUnitario);

    const requiereAprobacionAdmin = diferenciaPorcentajeAbs > umbral;

    return {
        stock_sistema: stockSistema,
        stock_contado: stockContado,
        diferencia_cantidad: diferenciaCantidad,
        diferencia_porcentaje: diferenciaPorcentaje,
        diferencia_porcentaje_abs: diferenciaPorcentajeAbs,
        pmp_unitario: pmpUnitario,
        diferencia_valor: diferenciaValor,
        umbral_porcentaje: umbral,
        requiere_aprobacion_admin: requiereAprobacionAdmin,
        estado_resultante: requiereAprobacionAdmin
            ? ESTADO_CONTEO_PENDIENTE_APROBACION
            : ESTADO_CONTEO_AJUSTADO_DIRECTO,
    };
};

export const construirAlertaConteoPendienteAdmin = (params: {
    codigoConteo: string;
    sku: string;
    nombreArticulo: string;
    stockSistema: number;
    stockContado: number;
    diferenciaCantidad: number;
    diferenciaPorcentaje: number;
    diferenciaValor: number;
    umbralPorcentaje: number;
}): { titulo: string; descripcion: string } => {
    const signo = params.diferenciaCantidad > 0 ? '+' : '';
    const signoPct = params.diferenciaPorcentaje > 0 ? '+' : '';
    return {
        titulo: `Conteo físico retenido (${signoPct}${params.diferenciaPorcentaje}% > ${params.umbralPorcentaje}%): ${params.sku}`.slice(0, 200),
        descripcion:
            `El conteo ${params.codigoConteo} sobre ${params.nombreArticulo} (${params.sku}) arrojó ${params.stockContado} (sistema: ${params.stockSistema}, ` +
            `diferencia: ${signo}${params.diferenciaCantidad} un. / ${signoPct}${params.diferenciaPorcentaje}%, valorizada a PMP en $${params.diferenciaValor}). ` +
            `Supera el umbral de ${params.umbralPorcentaje}% (H39): el insumo permanece bloqueado hasta aprobación del Administrador.`.slice(0, 500),
    };
};
