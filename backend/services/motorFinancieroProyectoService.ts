export type ColorSemaforoFinanciero = 'verde' | 'amarillo' | 'rojo';

export const COSTO_HORA_HOMBRE_H39_DEFECTO = 15000;
export const UMBRAL_SEMAFORO_AMARILLO_PCT = 80;
export const UMBRAL_SEMAFORO_ROJO_PCT = 100;

export interface EntradaCalculoFinancieroProyecto {
    presupuesto_total: number;
    valor_venta: number;
    egresos_brutos_pmp: number;
    ajustes_devoluciones_pmp?: number;
    horas_registradas_h41: number;
    costo_hora_h39: number;
    semaforo_anterior?: ColorSemaforoFinanciero | null;
}

export interface ResultadoCalculoFinancieroProyecto {
    presupuesto_total: number;
    valor_venta: number;
    egresos_brutos_pmp: number;
    ajustes_devoluciones_pmp: number;
    egresos_netos_pmp: number;
    horas_registradas_h41: number;
    costo_hora_h39: number;
    costo_horas_h41: number;
    costo_real: number;
    margen_estimado: number;
    porcentaje_margen_estimado: number;
    porcentaje_consumo_presupuesto: number;
    semaforo_anterior: ColorSemaforoFinanciero;
    semaforo_actual: ColorSemaforoFinanciero;
    dispara_alerta_amarillo: boolean;
    dispara_alerta_rojo: boolean;
    tipo_alerta_disparada: 'presupuesto_proyecto_amarillo' | 'presupuesto_proyecto_rojo' | null;
}

const redondear2 = (valor: number): number => Number(valor.toFixed(2));

/**
 * [BACK-1 / H27] Evalúa el color del semáforo financiero contra el presupuesto total:
 * - Verde:    < 80 %
 * - Amarillo: entre 80 % y 100 % (inclusive)
 * - Rojo:     > 100 %
 */
export const evaluarSemaforoPresupuesto = (porcentajeConsumo: number): ColorSemaforoFinanciero => {
    if (porcentajeConsumo > UMBRAL_SEMAFORO_ROJO_PCT) {
        return 'rojo';
    }
    if (porcentajeConsumo >= UMBRAL_SEMAFORO_AMARILLO_PCT) {
        return 'amarillo';
    }
    return 'verde';
};

/**
 * [BACK-1 / H27] Motor financiero puro por proyecto:
 * - Costo Real = Suma(Egresos netos a PMP) + (Horas registradas en H41 * Costo por hora de H39)
 * - Margen Estimado = Valor de Venta - Costo Real
 * - Semáforo: Verde (< 80 %), Amarillo (80 % a 100 %), Rojo (> 100 %)
 * - Dispara alerta al Administrador al pasar a Amarillo o a Rojo.
 */
export const calcularEstadoFinancieroProyecto = (
    entrada: EntradaCalculoFinancieroProyecto
): ResultadoCalculoFinancieroProyecto => {
    const presupuestoTotal = Math.max(0, Math.round(Number(entrada.presupuesto_total) || 0));
    const valorVenta = Math.max(0, Math.round(Number(entrada.valor_venta) || 0));
    const egresosBrutosPmp = Math.max(0, Math.round(Number(entrada.egresos_brutos_pmp) || 0));
    const ajustesDevolucionesPmp = Math.round(Number(entrada.ajustes_devoluciones_pmp) || 0);
    const egresosNetosPmp = Math.max(0, egresosBrutosPmp + ajustesDevolucionesPmp);

    const horasRegistradas = Math.max(0, redondear2(Number(entrada.horas_registradas_h41) || 0));
    const costoHora = Math.max(0, Math.round(Number(entrada.costo_hora_h39) || COSTO_HORA_HOMBRE_H39_DEFECTO));
    const costoHoras = Math.round(horasRegistradas * costoHora);

    const costoReal = egresosNetosPmp + costoHoras;
    const margenEstimado = valorVenta - costoReal;
    const porcentajeMargen =
        valorVenta > 0 ? redondear2((margenEstimado / valorVenta) * 100) : 0;

    const porcentajeConsumo =
        presupuestoTotal > 0 ? redondear2((costoReal / presupuestoTotal) * 100) : costoReal > 0 ? 100 : 0;

    const semaforoAnterior: ColorSemaforoFinanciero =
        entrada.semaforo_anterior === 'amarillo' || entrada.semaforo_anterior === 'rojo'
            ? entrada.semaforo_anterior
            : 'verde';
    const semaforoActual = evaluarSemaforoPresupuesto(porcentajeConsumo);

    // Se dispara alerta al pasar a amarillo (desde verde) o al pasar a rojo (desde verde o amarillo)
    const disparaAmarillo = semaforoActual === 'amarillo' && semaforoAnterior === 'verde';
    const disparaRojo = semaforoActual === 'rojo' && semaforoAnterior !== 'rojo';

    const tipoAlerta: 'presupuesto_proyecto_amarillo' | 'presupuesto_proyecto_rojo' | null = disparaRojo
        ? 'presupuesto_proyecto_rojo'
        : disparaAmarillo
          ? 'presupuesto_proyecto_amarillo'
          : null;

    return {
        presupuesto_total: presupuestoTotal,
        valor_venta: valorVenta,
        egresos_brutos_pmp: egresosBrutosPmp,
        ajustes_devoluciones_pmp: ajustesDevolucionesPmp,
        egresos_netos_pmp: egresosNetosPmp,
        horas_registradas_h41: horasRegistradas,
        costo_hora_h39: costoHora,
        costo_horas_h41: costoHoras,
        costo_real: costoReal,
        margen_estimado: margenEstimado,
        porcentaje_margen_estimado: porcentajeMargen,
        porcentaje_consumo_presupuesto: porcentajeConsumo,
        semaforo_anterior: semaforoAnterior,
        semaforo_actual: semaforoActual,
        dispara_alerta_amarillo: disparaAmarillo,
        dispara_alerta_rojo: disparaRojo,
        tipo_alerta_disparada: tipoAlerta,
    };
};

export const construirAlertaFinancieraProyectoAdmin = (params: {
    idProyecto: number;
    nombreProyecto: string;
    calculo: ResultadoCalculoFinancieroProyecto;
    origenEvento?: string;
}): {
    tipo: 'presupuesto_proyecto_amarillo' | 'presupuesto_proyecto_rojo';
    severidad: 'amarillo' | 'rojo';
    titulo: string;
    descripcion: string;
} | null => {
    const { calculo } = params;
    if (!calculo.tipo_alerta_disparada) return null;

    const esRojo = calculo.tipo_alerta_disparada === 'presupuesto_proyecto_rojo';
    const etiquetaColor = esRojo ? 'ROJO - Sobrecosto (> 100%)' : 'AMARILLO - Precaución (80% - 100%)';
    const origen = params.origenEvento ? ` tras ${params.origenEvento}` : '';

    return {
        tipo: calculo.tipo_alerta_disparada,
        severidad: esRojo ? 'rojo' : 'amarillo',
        titulo: `Semáforo ${etiquetaColor} en ${params.nombreProyecto} (${calculo.porcentaje_consumo_presupuesto}%)`.slice(0, 200),
        descripcion:
            `El proyecto "${params.nombreProyecto}" (#${params.idProyecto}) alcanzó un consumo presupuestario de ${calculo.porcentaje_consumo_presupuesto}%${origen}. ` +
            `Costo Real: $${calculo.costo_real} (Egresos netos a PMP: $${calculo.egresos_netos_pmp} + Horas H41: ${calculo.horas_registradas_h41} h × $${calculo.costo_hora_h39} = $${calculo.costo_horas_h41}) ` +
            `vs. Presupuesto: $${calculo.presupuesto_total}. Margen Estimado (Valor Venta $${calculo.valor_venta} − Costo Real): $${calculo.margen_estimado}.`.slice(0, 500),
    };
};
