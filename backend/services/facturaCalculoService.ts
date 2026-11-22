/**
 * Servicio compartido de cálculo de Facturas de Compra con hasta 3 descuentos en cascada,
 * subtotal neto, IVA (19%), recálculo de PMP y detección de discrepancias con la recepción de la OC.
 *
 * Sus fórmulas son idénticas a `frontend/src/modulos/compras/facturaCalculoUtils.ts`,
 * garantizando que los totales en pantalla coincidan peso a peso con el backend ([FRONT-2]).
 */

export interface LineaFacturaCascadaInput {
    sku: string;
    name?: string;
    unit?: string;
    quantity: number;
    grossPrice: number;
    disc1?: number;
    disc2?: number;
    disc3?: number;
    discount1Pct?: number;
    discount2Pct?: number;
    discount3Pct?: number;
    stockActual?: number;
    pmpActual?: number;
}

export interface DesgloseLineaFacturaCascada {
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    grossPrice: number;
    discount1Pct: number;
    discount2Pct: number;
    discount3Pct: number;
    /** Precio unitario tras aplicar Descuento 1: Bruto * (1 - d1/100) */
    priceAfterDisc1: number;
    /** Monto unitario descontado en el Paso 1 */
    discount1UnitAmount: number;
    /** Precio unitario tras aplicar Descuento 2 sobre Paso 1: P1 * (1 - d2/100) */
    priceAfterDisc2: number;
    /** Monto unitario descontado en el Paso 2 */
    discount2UnitAmount: number;
    /** Precio unitario tras aplicar Descuento 3 sobre Paso 2: P2 * (1 - d3/100) */
    priceAfterDisc3Raw: number;
    /** Monto unitario descontado en el Paso 3 */
    discount3UnitAmount: number;
    /** Precio Neto Unitario exacto sin redondeo intermedio: Bruto * (1 - d1/100) * (1 - d2/100) * (1 - d3/100) */
    netUnitPriceExact: number;
    /** Precio Neto Unitario redondeado a CLP entero: Math.round(P2 * (1 - d3/100)) */
    netUnitPrice: number;
    /** Ahorro total por unidad (Bruto - P. Neto Unitario) */
    unitDiscountAmount: number;
    /** Porcentaje de descuento efectivo acumulado en cascada */
    effectiveDiscountPct: number;
    /** Subtotal Bruto de la línea (Bruto * Cantidad) */
    subtotalGross: number;
    /** Descuento total aplicado en la línea (Subtotal Bruto - Subtotal Neto) */
    totalDiscountLine: number;
    /** Subtotal Neto exacto de la línea (netUnitPriceExact * Cantidad) */
    subtotalNetExact: number;
    /** Subtotal Neto de la línea en CLP (P. Neto Unitario * Cantidad) */
    subtotalNet: number;
    /** PMP proyectado exacto (2 decimales): (StockActual * PMPActual + Cantidad * CostoNeto) / (StockActual + Cantidad) */
    projectedPmpExact: number;
    /** PMP proyectado redondeado a CLP entero: Math.round((StockActual * PMPActual + Cantidad * CostoNeto) / (StockActual + Cantidad)) */
    projectedPmp: number;
}

export interface TotalesFacturaCascada {
    lineas: DesgloseLineaFacturaCascada[];
    subtotalGross: number;
    totalDiscounts: number;
    subtotalNet: number;
    iva: number;
    total: number;
}

export interface LineaRecepcionOcReferencia {
    sku: string;
    name?: string;
    unit?: string;
    quantity: number;
    unitPrice?: number;
    receivedQuantity?: number;
    defectiveQuantity?: number;
    missingQuantity?: number;
}

export interface OrdenCompraRecepcionReferencia {
    code: string;
    status: string;
    items: LineaRecepcionOcReferencia[];
}

export interface DetalleDiscrepanciaFacturaRecepcion {
    sku: string;
    nombre: string;
    tipo:
    | 'FACTURA_COBRA_MAS_DE_LO_RECIBIDO'
    | 'FACTURA_COBRA_MENOS_DE_LO_RECIBIDO'
    | 'CANTIDAD_FACTURADA_DISTINTA_A_RECIBIDA'
    | 'CANTIDAD_FACTURADA_SUPERA_OC'
    | 'UNIDADES_EN_CUARENTENA'
    | 'INSUMO_NO_PERTENECE_A_OC'
    | 'INSUMO_OC_NO_FACTURADO'
    | 'PRECIO_NETO_DISTINTO_A_OC';
    sentidoDiscrepancia?: 'COBRA_MAS' | 'COBRA_MENOS' | 'OTRO';
    diferenciaUnidades?: number;
    cantidadOrdenadaOc: number;
    cantidadRecibidaConforme: number;
    cantidadDefectuosaCuarentena: number;
    cantidadFacturada: number;
    mensaje: string;
}

export interface ResultadoDiscrepanciaFacturaRecepcion {
    tieneDiscrepancia: boolean;
    codigoOc: string | null;
    estadoOc: string | null;
    recepcionRegistrada: boolean;
    detalles: DetalleDiscrepanciaFacturaRecepcion[];
    resumenAlertas: string[];
}

const acotarPorcentaje = (valor: unknown): number => {
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (num > 100) return 100;
    return Number(num.toFixed(4));
};

/**
 * Calcula el Precio Medio Ponderado (PMP) exacto a 2 decimales sin errores de punto flotante:
 * (valor del stock actual + valor del ingreso neto) / (stock actual + cantidad ingresada)
 */
export const calcularPmpExactoSinErrorRedondeo = (
    stockActual: number,
    pmpActual: number,
    cantidadIngresada: number,
    costoNetoUnitarioFactura: number
): number => {
    const stock = Math.max(0, Number(stockActual || 0));
    const pmp = Math.max(0, Number(pmpActual || costoNetoUnitarioFactura || 0));
    const cantidad = Math.max(0, Number(cantidadIngresada || 0));
    const costoNeto = Math.max(0, Number(costoNetoUnitarioFactura || 0));

    if (cantidad <= 0) {
        return Math.round((pmp + Number.EPSILON) * 100) / 100;
    }
    const totalUnidades = stock + cantidad;
    if (totalUnidades <= 0) {
        return Math.round((costoNeto + Number.EPSILON) * 100) / 100;
    }
    const valorStockActual = stock * pmp;
    const valorIngresoNeto = cantidad * costoNeto;
    const pmpNuevo = (valorStockActual + valorIngresoNeto) / totalUnidades;
    return Math.round((pmpNuevo + Number.EPSILON) * 100) / 100;
};

/**
 * Calcula el Precio Medio Ponderado (PMP) redondeado a CLP entero:
 * (valor del stock actual + valor del ingreso) / (stock actual + cantidad ingresada)
 */
export const calcularPmpConCostoNetoFactura = (
    stockActual: number,
    pmpActual: number,
    cantidadIngresada: number,
    costoNetoUnitarioFactura: number
): number => {
    return Math.round(
        calcularPmpExactoSinErrorRedondeo(
            stockActual,
            pmpActual,
            cantidadIngresada,
            costoNetoUnitarioFactura
        )
    );
};

/**
 * Calcula el desglose paso a paso de los 3 descuentos sucesivos en cascada para una línea de factura.
 */
export const calcularLineaFacturaCascada = (
    input: LineaFacturaCascadaInput
): DesgloseLineaFacturaCascada => {
    const quantity = Math.max(0, Number(input.quantity || 0));
    const grossPrice = Math.max(0, Math.round(Number(input.grossPrice || 0)));
    const d1 = acotarPorcentaje(input.disc1 ?? input.discount1Pct ?? 0);
    const d2 = acotarPorcentaje(input.disc2 ?? input.discount2Pct ?? 0);
    const d3 = acotarPorcentaje(input.disc3 ?? input.discount3Pct ?? 0);

    // Multiplicación secuencial en cascada en alta precisión (sin truncar pasos intermedios):
    // Paso 1: Descuento 1 sobre Precio Bruto
    const paso1Raw = (grossPrice * (100 - d1)) / 100;
    const priceAfterDisc1 = Math.round(paso1Raw + Number.EPSILON);
    const discount1UnitAmount = Math.max(0, grossPrice - priceAfterDisc1);

    // Paso 2: Descuento 2 sobre el resultado exacto del Paso 1 (en cascada)
    const paso2Raw = (paso1Raw * (100 - d2)) / 100;
    const priceAfterDisc2 = Math.round(paso2Raw + Number.EPSILON);
    const discount2UnitAmount = Math.max(0, priceAfterDisc1 - priceAfterDisc2);

    // Paso 3: Descuento 3 sobre el resultado exacto del Paso 2 (en cascada)
    const paso3Raw = (paso2Raw * (100 - d3)) / 100;
    const netUnitPriceExact = Math.round((paso3Raw + Number.EPSILON) * 10000) / 10000;
    const netUnitPrice = Math.round(paso3Raw + Number.EPSILON);
    const discount3UnitAmount = Math.max(0, priceAfterDisc2 - netUnitPrice);

    const unitDiscountAmount = Math.max(0, grossPrice - netUnitPrice);
    const effectiveDiscountPct =
        grossPrice > 0
            ? Math.round((((grossPrice - netUnitPriceExact) / grossPrice) * 100 + Number.EPSILON) * 100) / 100
            : 0;

    const subtotalGross = Math.round(grossPrice * quantity);
    const subtotalNetExact = Math.round((netUnitPriceExact * quantity + Number.EPSILON) * 100) / 100;
    const subtotalNet = Math.round(netUnitPrice * quantity);
    const totalDiscountLine = Math.max(0, subtotalGross - subtotalNet);

    const projectedPmpExact = calcularPmpExactoSinErrorRedondeo(
        input.stockActual ?? 0,
        input.pmpActual ?? grossPrice,
        quantity,
        netUnitPrice
    );
    const projectedPmp = Math.round(projectedPmpExact);

    return {
        sku: String(input.sku || '').trim(),
        name: String(input.name || input.sku || '').trim(),
        unit: String(input.unit || 'un').trim(),
        quantity,
        grossPrice,
        discount1Pct: d1,
        discount2Pct: d2,
        discount3Pct: d3,
        priceAfterDisc1,
        discount1UnitAmount,
        priceAfterDisc2,
        discount2UnitAmount,
        priceAfterDisc3Raw: Math.round((paso3Raw + Number.EPSILON) * 100) / 100,
        discount3UnitAmount,
        netUnitPriceExact,
        netUnitPrice,
        unitDiscountAmount,
        effectiveDiscountPct,
        subtotalGross,
        totalDiscountLine,
        subtotalNetExact,
        subtotalNet,
        projectedPmpExact,
        projectedPmp,
    };
};

/**
 * Calcula los totales consolidados de la factura (Subtotal Bruto, Descuentos en Cascada, Subtotal Neto, IVA 19% y Total CLP).
 */
export const calcularTotalesFacturaCascada = (
    lineasInput: LineaFacturaCascadaInput[]
): TotalesFacturaCascada => {
    const lineas = (lineasInput || []).map(calcularLineaFacturaCascada);
    const subtotalGross = lineas.reduce((acc, item) => acc + item.subtotalGross, 0);
    const subtotalNet = lineas.reduce((acc, item) => acc + item.subtotalNet, 0);
    const totalDiscounts = Math.max(0, subtotalGross - subtotalNet);
    const iva = Math.round(subtotalNet * 0.19);
    const total = subtotalNet + iva;

    return {
        lineas,
        subtotalGross,
        totalDiscounts,
        subtotalNet,
        iva,
        total,
    };
};

/**
 * Compara en vivo las líneas de la factura con la Orden de Compra vinculada y su recepción en bodega.
 * Detecta diferencias de cantidades facturadas vs recibidas conformes, unidades en cuarentena,
 * insumos fuera de la OC o variaciones de precio neto unitario.
 */
export const detectarDiscrepanciasFacturaConRecepcion = (
    lineasInput: LineaFacturaCascadaInput[],
    ordenCompra?: OrdenCompraRecepcionReferencia | null
): ResultadoDiscrepanciaFacturaRecepcion => {
    if (!ordenCompra || !ordenCompra.code) {
        return {
            tieneDiscrepancia: false,
            codigoOc: null,
            estadoOc: null,
            recepcionRegistrada: false,
            detalles: [],
            resumenAlertas: [],
        };
    }

    const lineasCalculadas = (lineasInput || []).map(calcularLineaFacturaCascada);
    const detalles: DetalleDiscrepanciaFacturaRecepcion[] = [];
    const estadoNorm = (ordenCompra.status || '').toLowerCase();
    const tieneRecepcionRegistrada =
        estadoNorm === 'recibida' ||
        estadoNorm === 'recibida_parcial' ||
        estadoNorm === 'recibida parcial' ||
        estadoNorm === 'cerrada' ||
        (ordenCompra.items || []).some(
            (it) => Number(it.receivedQuantity || 0) > 0 || Number(it.defectiveQuantity || 0) > 0
        );

    for (const lineaFac of lineasCalculadas) {
        if (!lineaFac.sku) continue;
        const itemOc = (ordenCompra.items || []).find(
            (it) => it.sku.trim().toUpperCase() === lineaFac.sku.trim().toUpperCase()
        );

        if (!itemOc) {
            detalles.push({
                sku: lineaFac.sku,
                nombre: lineaFac.name,
                tipo: 'INSUMO_NO_PERTENECE_A_OC',
                cantidadOrdenadaOc: 0,
                cantidadRecibidaConforme: 0,
                cantidadDefectuosaCuarentena: 0,
                cantidadFacturada: lineaFac.quantity,
                mensaje: `${lineaFac.sku} (${lineaFac.name}): facturado por ${lineaFac.quantity} ${lineaFac.unit}, pero no figura en la ${ordenCompra.code}.`,
            });
            continue;
        }

        const cantOrdenada = Number(itemOc.quantity || 0);
        const cantRecibida = Number(itemOc.receivedQuantity || 0);
        const cantDefectuosa = Number(itemOc.defectiveQuantity || 0);
        const unidad = itemOc.unit || lineaFac.unit || 'un';

        if (tieneRecepcionRegistrada && Math.abs(lineaFac.quantity - cantRecibida) > 0.0001) {
            const diff = Number((lineaFac.quantity - cantRecibida).toFixed(3));
            const cobraMas = diff > 0;
            detalles.push({
                sku: lineaFac.sku,
                nombre: lineaFac.name,
                tipo: 'CANTIDAD_FACTURADA_DISTINTA_A_RECIBIDA',
                sentidoDiscrepancia: cobraMas ? 'COBRA_MAS' : 'COBRA_MENOS',
                diferenciaUnidades: diff,
                cantidadOrdenadaOc: cantOrdenada,
                cantidadRecibidaConforme: cantRecibida,
                cantidadDefectuosaCuarentena: cantDefectuosa,
                cantidadFacturada: lineaFac.quantity,
                mensaje: cobraMas
                    ? `${lineaFac.sku}: Factura cobra MÁS de lo recepcionado en H33 (${lineaFac.quantity} ${unidad} facturadas vs ${cantRecibida} ${unidad} recibidas conformes; exceso cobrado: +${Math.abs(diff)} ${unidad}, OC pidió ${cantOrdenada} ${unidad}).`
                    : `${lineaFac.sku}: Factura cobra MENOS de lo recepcionado en H33 (${lineaFac.quantity} ${unidad} facturadas vs ${cantRecibida} ${unidad} recibidas conformes; diferencia: -${Math.abs(diff)} ${unidad}, OC pidió ${cantOrdenada} ${unidad}).`,
            });
        } else if (!tieneRecepcionRegistrada && Math.abs(lineaFac.quantity - cantOrdenada) > 0.0001) {
            const diff = Number((lineaFac.quantity - cantOrdenada).toFixed(3));
            const cobraMas = diff > 0;
            detalles.push({
                sku: lineaFac.sku,
                nombre: lineaFac.name,
                tipo: 'CANTIDAD_FACTURADA_SUPERA_OC',
                sentidoDiscrepancia: cobraMas ? 'COBRA_MAS' : 'COBRA_MENOS',
                diferenciaUnidades: diff,
                cantidadOrdenadaOc: cantOrdenada,
                cantidadRecibidaConforme: cantRecibida,
                cantidadDefectuosaCuarentena: cantDefectuosa,
                cantidadFacturada: lineaFac.quantity,
                mensaje: `${lineaFac.sku}: Factura indica ${lineaFac.quantity} ${unidad}, distinto a lo solicitado en ${ordenCompra.code} (${cantOrdenada} ${unidad}).`,
            });
        }

        if (cantDefectuosa > 0) {
            detalles.push({
                sku: lineaFac.sku,
                nombre: lineaFac.name,
                tipo: 'UNIDADES_EN_CUARENTENA',
                cantidadOrdenadaOc: cantOrdenada,
                cantidadRecibidaConforme: cantRecibida,
                cantidadDefectuosaCuarentena: cantDefectuosa,
                cantidadFacturada: lineaFac.quantity,
                mensaje: `${lineaFac.sku}: Existen ${cantDefectuosa} ${unidad} rechazadas en cuarentena en la recepción de ${ordenCompra.code}. Verifique descuento o nota de crédito.`,
            });
        }

        if (
            itemOc.unitPrice !== undefined &&
            Number(itemOc.unitPrice) > 0 &&
            Math.abs(lineaFac.netUnitPrice - Number(itemOc.unitPrice)) > 1
        ) {
            detalles.push({
                sku: lineaFac.sku,
                nombre: lineaFac.name,
                tipo: 'PRECIO_NETO_DISTINTO_A_OC',
                cantidadOrdenadaOc: cantOrdenada,
                cantidadRecibidaConforme: cantRecibida,
                cantidadDefectuosaCuarentena: cantDefectuosa,
                cantidadFacturada: lineaFac.quantity,
                mensaje: `${lineaFac.sku}: P. Neto Unitario facturado ($${lineaFac.netUnitPrice.toLocaleString('es-CL')}) difiere del precio pactado en ${ordenCompra.code} ($${Number(itemOc.unitPrice).toLocaleString('es-CL')}).`,
            });
        }
    }

    for (const itemOc of ordenCompra.items || []) {
        const estaEnFactura = lineasCalculadas.some(
            (lf) => lf.sku.trim().toUpperCase() === itemOc.sku.trim().toUpperCase()
        );
        if (!estaEnFactura) {
            const cantRecibida = Number(itemOc.receivedQuantity || 0);
            const cantOrdenada = Number(itemOc.quantity || 0);
            detalles.push({
                sku: itemOc.sku,
                nombre: itemOc.name || itemOc.sku,
                tipo: 'INSUMO_OC_NO_FACTURADO',
                cantidadOrdenadaOc: cantOrdenada,
                cantidadRecibidaConforme: cantRecibida,
                cantidadDefectuosaCuarentena: Number(itemOc.defectiveQuantity || 0),
                cantidadFacturada: 0,
                mensaje: `${itemOc.sku} (${itemOc.name || itemOc.sku}): incluido en ${ordenCompra.code} (${cantRecibida > 0 ? `${cantRecibida} recibidos` : `${cantOrdenada} solicitados`}), pero ausente en esta factura.`,
            });
        }
    }

    return {
        tieneDiscrepancia: detalles.length > 0,
        codigoOc: ordenCompra.code,
        estadoOc: ordenCompra.status,
        recepcionRegistrada: tieneRecepcionRegistrada,
        detalles,
        resumenAlertas: detalles.map((d) => d.mensaje),
    };
};
