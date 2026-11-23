import { FacturaCompra, ItemOrdenCompra, OrdenCompra } from "@/nucleo/tipos";

export interface ItemChecklistRecepcion {
  sku: string;
  received: number;
  defective: number;
  missing: number;
  scanned?: boolean;
}

export interface ResumenAplicacionRecepcion {
  ordenActualizada: OrdenCompra;
  esRecepcionCompleta: boolean;
  nuevoEstado: "recibida" | "recibida_parcial";
  totalConformeHoy: number;
  totalDefectuosoHoy: number;
  totalSaldoPendienteOc: number;
  discrepancias: string[];
}

const redondearCantidad = (valor: number, esGranel = false): number => {
  const limpio = Number.isFinite(valor) ? Math.max(0, valor) : 0;
  return esGranel ? Number(limpio.toFixed(3)) : Math.round(limpio);
};

/**
 * [FRONT-1] Calcula el saldo pendiente de una línea de OC.
 */
export const calcularSaldoPendienteLineaOc = (linea: Pick<ItemOrdenCompra, "quantity" | "receivedQuantity">): number => {
  const pedido = Number(linea.quantity || 0);
  const recibidoAntes = Number(linea.receivedQuantity || 0);
  return Math.max(0, Number((pedido - recibidoAntes).toFixed(3)));
};

/**
 * [FRONT-1] Construye el estado inicial del checklist de tablet a partir de las líneas de la OC,
 * proponiendo por defecto el saldo pendiente de cada línea como cantidad conforme a recibir hoy.
 */
export const construirChecklistInicialDesdeOc = (orden: Pick<OrdenCompra, "items">): ItemChecklistRecepcion[] => {
  return (orden.items || []).map((it) => {
    const pendiente = calcularSaldoPendienteLineaOc(it);
    return {
      sku: it.sku,
      received: pendiente,
      defective: 0,
      missing: 0,
      scanned: false,
    };
  });
};

/**
 * [FRONT-1] Actualiza una línea del checklist de tablet sincronizando automáticamente
 * el saldo faltante/pendiente cuando el bodeguero modifica la cantidad Conforme o Defectuosa.
 */
export const actualizarLineaChecklistTablet = (
  actual: ItemChecklistRecepcion,
  pendienteLinea: number,
  cambio: Partial<Pick<ItemChecklistRecepcion, "received" | "defective" | "missing" | "scanned">>,
  esGranel = false
): ItemChecklistRecepcion => {
  const pend = redondearCantidad(pendienteLinea, esGranel);

  if (cambio.received !== undefined && cambio.missing === undefined && cambio.defective === undefined) {
    const nuevoConforme = redondearCantidad(cambio.received, esGranel);
    const defectuosoActual = redondearCantidad(actual.defective, esGranel);
    const nuevoFaltante = redondearCantidad(Math.max(0, pend - nuevoConforme - defectuosoActual), esGranel);
    return {
      ...actual,
      ...cambio,
      received: nuevoConforme,
      defective: defectuosoActual,
      missing: nuevoFaltante,
    };
  }

  if (cambio.defective !== undefined && cambio.received === undefined && cambio.missing === undefined) {
    const nuevoDefectuoso = redondearCantidad(cambio.defective, esGranel);
    // Si conforme + nuevoDefectuoso supera lo pendiente, ajustamos conforme para cuadrar con el pendiente
    let nuevoConforme = redondearCantidad(actual.received, esGranel);
    if (nuevoConforme + nuevoDefectuoso > pend) {
      nuevoConforme = redondearCantidad(Math.max(0, pend - nuevoDefectuoso), esGranel);
    }
    const nuevoFaltante = redondearCantidad(Math.max(0, pend - nuevoConforme - nuevoDefectuoso), esGranel);
    return {
      ...actual,
      ...cambio,
      received: nuevoConforme,
      defective: nuevoDefectuoso,
      missing: nuevoFaltante,
    };
  }

  if (cambio.missing !== undefined && cambio.received === undefined && cambio.defective === undefined) {
    const nuevoFaltante = redondearCantidad(cambio.missing, esGranel);
    return {
      ...actual,
      ...cambio,
      missing: nuevoFaltante,
    };
  }

  return {
    ...actual,
    ...cambio,
    received: cambio.received !== undefined ? redondearCantidad(cambio.received, esGranel) : actual.received,
    defective: cambio.defective !== undefined ? redondearCantidad(cambio.defective, esGranel) : actual.defective,
    missing: cambio.missing !== undefined ? redondearCantidad(cambio.missing, esGranel) : actual.missing,
  };
};

/**
 * [FRONT-1][SCRUM] Aplica una entrega (parcial o total) del checklist sobre la Orden de Compra:
 *  - Acumula lo conforme recibido (`receivedQuantity`) y lo defectuoso enviado a cuarentena (`defectiveQuantity`)
 *  - Recalcula el saldo pendiente de cada línea (`missingQuantity`)
 *  - Actualiza el estado de la OC a 'recibida_parcial' o 'recibida'
 *  - Detecta discrepancias por defectuosos, faltantes o diferencias contra la factura asociada
 */
export const aplicarEntregaChecklistEnOrden = (
  orden: OrdenCompra,
  checklist: ItemChecklistRecepcion[],
  facturaAsociada?: FacturaCompra | null,
  numeroFacturaOverride?: string
): ResumenAplicacionRecepcion => {
  const discrepancias: string[] = [];
  let todoCompletado = true;
  let totalConformeHoy = 0;
  let totalDefectuosoHoy = 0;
  let totalSaldoPendienteOc = 0;

  const nuevosItems: ItemOrdenCompra[] = orden.items.map((it) => {
    const check = checklist.find((c) => c.sku === it.sku);
    const pendienteAntes = calcularSaldoPendienteLineaOc(it);

    if (!check) {
      if (pendienteAntes > 0) todoCompletado = false;
      totalSaldoPendienteOc = Number((totalSaldoPendienteOc + pendienteAntes).toFixed(3));
      return { ...it, missingQuantity: pendienteAntes };
    }

    const conformeHoy = Math.max(0, Number(check.received || 0));
    const defectuosoHoy = Math.max(0, Number(check.defective || 0));
    totalConformeHoy = Number((totalConformeHoy + conformeHoy).toFixed(3));
    totalDefectuosoHoy = Number((totalDefectuosoHoy + defectuosoHoy).toFixed(3));

    const recibidoAcumulado = Number(((it.receivedQuantity || 0) + conformeHoy).toFixed(3));
    const defectuosoAcumulado = Number(((it.defectiveQuantity || 0) + defectuosoHoy).toFixed(3));
    const saldoPendienteDespues = Math.max(0, Number((it.quantity - recibidoAcumulado).toFixed(3)));

    if (saldoPendienteDespues > 0) {
      todoCompletado = false;
    }
    totalSaldoPendienteOc = Number((totalSaldoPendienteOc + saldoPendienteDespues).toFixed(3));

    if (defectuosoHoy > 0) {
      discrepancias.push(`${it.sku}: ${defectuosoHoy} ${it.unit} defectuoso(s) enviado(s) a cuarentena`);
    }
    if (conformeHoy + defectuosoHoy < pendienteAntes) {
      const faltanteEntrega = Number((pendienteAntes - (conformeHoy + defectuosoHoy)).toFixed(3));
      discrepancias.push(`${it.sku}: saldo pendiente/faltante de ${faltanteEntrega} ${it.unit}`);
    }

    if (facturaAsociada) {
      const itemFactura = facturaAsociada.items.find((fi) => fi.sku === it.sku);
      if (itemFactura && recibidoAcumulado !== itemFactura.quantity) {
        discrepancias.push(
          `${it.sku}: recibido conforme (${recibidoAcumulado} ${it.unit}) no coincide con lo facturado en Fac. N° ${facturaAsociada.number} (${itemFactura.quantity} ${it.unit})`
        );
      }
    }

    return {
      ...it,
      receivedQuantity: recibidoAcumulado,
      defectiveQuantity: defectuosoAcumulado,
      missingQuantity: saldoPendienteDespues,
    };
  });

  const nuevoEstado: "recibida" | "recibida_parcial" = todoCompletado ? "recibida" : "recibida_parcial";

  return {
    ordenActualizada: {
      ...orden,
      status: nuevoEstado,
      items: nuevosItems,
      invoiceNumber: numeroFacturaOverride || facturaAsociada?.number || orden.invoiceNumber,
    },
    esRecepcionCompleta: todoCompletado,
    nuevoEstado,
    totalConformeHoy,
    totalDefectuosoHoy,
    totalSaldoPendienteOc,
    discrepancias,
  };
};
