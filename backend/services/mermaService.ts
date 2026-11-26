import { ErrorAplicacion } from './errores';

const redondear3 = (valor: number): number => Number(valor.toFixed(3));

export interface DatosMermaValorizada {
    cantidad: number;
    motivo: string;
    observacion: string;
    disponible_anterior: number;
    disponible_nuevo: number;
    pmp_unitario: number;
    perdida_total: number;
}

/**
 * [BACK-2] Valida que 0 < cantidad <= disponible, exige motivo y observación,
 * calcula el nuevo stock disponible y valoriza la pérdida financiera exacta al PMP actual.
 */
export const validarYValorizarMerma = (params: {
    cantidad: unknown;
    disponibleActual: number;
    pmpUnitario: number;
    motivo: unknown;
    observacion?: unknown;
    etiquetaArticulo?: string;
}): DatosMermaValorizada => {
    const rawCant = params.cantidad;
    const numCant =
        typeof rawCant === 'number'
            ? rawCant
            : typeof rawCant === 'string' && rawCant.trim() !== ''
              ? Number(rawCant)
              : NaN;

    if (!Number.isFinite(numCant) || numCant <= 0) {
        throw new ErrorAplicacion(400, 'La cantidad de merma debe ser un número mayor a 0');
    }

    const cantidad = redondear3(numCant);
    if (Math.abs(numCant - cantidad) > 1e-6) {
        throw new ErrorAplicacion(400, 'La cantidad de merma admite como máximo 3 decimales');
    }

    const motivo = typeof params.motivo === 'string' ? params.motivo.trim() : '';
    if (!motivo) {
        throw new ErrorAplicacion(400, 'El motivo de la merma (p. ej. Daño, Caducidad, Pérdida) es obligatorio');
    }

    const rawObs = params.observacion !== undefined && params.observacion !== null ? String(params.observacion).trim() : '';
    const observacion = rawObs || motivo;

    const disponibleAnterior = redondear3(Number(params.disponibleActual));
    if (cantidad > disponibleAnterior) {
        const ref = params.etiquetaArticulo ? ` en ${params.etiquetaArticulo}` : '';
        throw new ErrorAplicacion(
            400,
            `La cantidad de merma (${cantidad}) no puede superar el stock disponible (${disponibleAnterior})${ref}`
        );
    }

    const pmpUnitario = Number.isFinite(params.pmpUnitario) && params.pmpUnitario > 0 ? Number(params.pmpUnitario) : 0;
    const disponibleNuevo = redondear3(disponibleAnterior - cantidad);
    const perdidaTotal = Math.round(cantidad * pmpUnitario);

    return {
        cantidad,
        motivo: motivo.slice(0, 80),
        observacion: observacion.slice(0, 250),
        disponible_anterior: disponibleAnterior,
        disponible_nuevo: disponibleNuevo,
        pmp_unitario: pmpUnitario,
        perdida_total: perdidaTotal,
    };
};

export const construirAlertaMermaAdmin = (params: {
    codigoMerma: string;
    sku: string;
    nombreArticulo: string;
    cantidad: number;
    motivo: string;
    observacion: string;
    pmpUnitario: number;
    perdidaTotal: number;
    disponibleNuevo: number;
}): { titulo: string; descripcion: string } => ({
    titulo: `Merma registrada (${params.motivo}): ${params.sku} (-${params.cantidad} un. / $${params.perdidaTotal})`.slice(0, 200),
    descripcion:
        `Se registró la merma ${params.codigoMerma} sobre ${params.nombreArticulo} (${params.sku}) por motivo "${params.motivo}": ` +
        `-${params.cantidad} un. valorizadas a PMP $${params.pmpUnitario} (pérdida total: $${params.perdidaTotal}). ` +
        `Detalle: ${params.observacion}. Stock disponible resultante: ${params.disponibleNuevo} un.`.slice(0, 500),
});
