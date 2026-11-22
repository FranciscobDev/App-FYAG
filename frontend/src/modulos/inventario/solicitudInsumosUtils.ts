/**
 * Utilidades puras de validación en vivo y reserva de stock comprometido (H6)
 * para el formulario "Nueva Solicitud de Insumos" ([FRONT-1]).
 *
 * Sincronizado 1:1 con `backend/services/solicitudInsumosService.ts`.
 */

export interface ProyectoSolicitudReferencia {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface ProductoCatalogoH6Referencia {
  sku: string;
  name: string;
  unit: string;
  stock: number;
  committed?: number;
  quarantine?: number;
  minStock: number;
  disabled?: boolean;
  isBulk?: boolean;
}

export interface LineaSolicitudInsumoInput {
  sku: string;
  name?: string;
  unit?: string;
  quantity: number;
}

export interface EvaluacionLineaSolicitudEnVivo {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  stockDisponibleActual: number;
  stockComprometidoActual: number;
  stockDisponibleRestanteH6: number;
  stockComprometidoNuevoH6: number;
  superaDisponible: boolean;
  faltante: number;
  cantidadInvalida: boolean;
  insumoInactivo: boolean;
  mensajeAlerta: string | null;
}

export interface ResultadoValidacionSolicitudInsumos {
  esValida: boolean;
  proyectoActivo: boolean;
  errorProyecto: string | null;
  errorGeneral: string | null;
  lineasEvaluadas: EvaluacionLineaSolicitudEnVivo[];
  faltantesStock: string[];
}

export const ESTADOS_PROYECTO_ACTIVO_SOLICITUD = ["activo", "en_curso", "planificado"] as const;
export const ESTADOS_PROYECTO_INACTIVO_SOLICITUD = ["cerrado", "finalizado", "pausado", "inactivo"] as const;

export const esProyectoActivoParaSolicitud = (
  proyecto?: ProyectoSolicitudReferencia | null
): boolean => {
  if (!proyecto || !proyecto.id) return false;
  const estado = String(proyecto.status || "").trim().toLowerCase();
  if (!estado) return false;
  if ((ESTADOS_PROYECTO_INACTIVO_SOLICITUD as readonly string[]).includes(estado)) {
    return false;
  }
  return (ESTADOS_PROYECTO_ACTIVO_SOLICITUD as readonly string[]).includes(estado);
};

export const validarFormularioNuevaSolicitudInsumos = (
  proyecto: ProyectoSolicitudReferencia | null | undefined,
  lineasInput: LineaSolicitudInsumoInput[],
  catalogoProductos: ProductoCatalogoH6Referencia[]
): ResultadoValidacionSolicitudInsumos => {
  let errorProyecto: string | null = null;
  const proyectoActivo = esProyectoActivoParaSolicitud(proyecto);

  if (!proyecto || !proyecto.id) {
    errorProyecto = "El proyecto es obligatorio para emitir una solicitud de insumos.";
  } else if (!proyectoActivo) {
    errorProyecto = `No se pueden solicitar insumos para el proyecto "${proyecto.code} - ${proyecto.name}" porque se encuentra inactivo (${proyecto.status.toUpperCase()}). Solo se permiten proyectos activos.`;
  }

  if (!Array.isArray(lineasInput) || lineasInput.length === 0) {
    return {
      esValida: false,
      proyectoActivo,
      errorProyecto,
      errorGeneral: errorProyecto || "Debe agregar al menos un insumo con cantidad mayor a 0.",
      lineasEvaluadas: [],
      faltantesStock: [],
    };
  }

  const acumuladoPorSku = new Map<string, number>();
  for (const item of lineasInput) {
    const skuNorm = String(item.sku || "").trim().toUpperCase();
    if (!skuNorm) continue;
    const cant = Number(item.quantity || 0);
    if (Number.isFinite(cant) && cant > 0) {
      acumuladoPorSku.set(skuNorm, Number(((acumuladoPorSku.get(skuNorm) || 0) + cant).toFixed(3)));
    }
  }

  const lineasEvaluadas: EvaluacionLineaSolicitudEnVivo[] = [];
  const faltantesStock: string[] = [];
  let hayLineaInvalida = false;

  for (const item of lineasInput) {
    const skuNorm = String(item.sku || "").trim().toUpperCase();
    const prod = catalogoProductos.find(
      (p) => p.sku.trim().toUpperCase() === skuNorm
    );

    const cantLinea = Number(item.quantity);
    const cantidadInvalida = !skuNorm || !Number.isFinite(cantLinea) || cantLinea <= 0;
    const insumoInactivo = !prod || Boolean(prod.disabled);
    const stockDisp = prod ? Math.max(0, Number(prod.stock || 0)) : 0;
    const stockComp = prod ? Math.max(0, Number(prod.committed || 0)) : 0;
    const totalSolicitadoSku = acumuladoPorSku.get(skuNorm) ?? (Number.isFinite(cantLinea) ? cantLinea : 0);

    const superaDisponible = !cantidadInvalida && totalSolicitadoSku > stockDisp;
    const faltante = superaDisponible
      ? Number((totalSolicitadoSku - stockDisp).toFixed(3))
      : 0;

    let mensajeAlerta: string | null = null;
    if (!skuNorm || !prod) {
      mensajeAlerta = `El insumo "${item.sku || "sin SKU"}" no existe en el catálogo.`;
      hayLineaInvalida = true;
    } else if (insumoInactivo) {
      mensajeAlerta = `${prod.name} (${prod.sku}): el insumo está deshabilitado en el catálogo.`;
      hayLineaInvalida = true;
    } else if (cantidadInvalida) {
      mensajeAlerta = `${prod.name} (${prod.sku}): la cantidad solicitada debe ser mayor a 0 ${prod.unit}.`;
      hayLineaInvalida = true;
    } else if (superaDisponible) {
      mensajeAlerta = `${prod.name} (${prod.sku}): cantidad solicitada (${totalSolicitadoSku} ${prod.unit}) supera el stock disponible en vivo (${stockDisp} ${prod.unit}; faltan ${faltante} ${prod.unit}).`;
      if (!faltantesStock.includes(mensajeAlerta)) {
        faltantesStock.push(mensajeAlerta);
      }
    }

    lineasEvaluadas.push({
      sku: prod?.sku || skuNorm,
      name: prod?.name || item.name || skuNorm,
      unit: prod?.unit || item.unit || "un",
      quantity: Number.isFinite(cantLinea) ? cantLinea : 0,
      stockDisponibleActual: stockDisp,
      stockComprometidoActual: stockComp,
      stockDisponibleRestanteH6: Math.max(0, Number((stockDisp - totalSolicitadoSku).toFixed(3))),
      stockComprometidoNuevoH6: Number((stockComp + (Number.isFinite(cantLinea) && cantLinea > 0 ? totalSolicitadoSku : 0)).toFixed(3)),
      superaDisponible,
      faltante,
      cantidadInvalida,
      insumoInactivo,
      mensajeAlerta,
    });
  }

  const esValida = !errorProyecto && !hayLineaInvalida && faltantesStock.length === 0;
  const errorGeneral =
    errorProyecto ||
    (faltantesStock.length > 0
      ? "No se puede enviar la solicitud: uno o más insumos superan el stock disponible en bodega."
      : hayLineaInvalida
        ? "Verifique que todos los insumos seleccionados estén activos y tengan cantidad mayor a 0."
        : null);

  return {
    esValida,
    proyectoActivo,
    errorProyecto,
    errorGeneral,
    lineasEvaluadas,
    faltantesStock,
  };
};

export const aplicarReservaComprometidoEnCatalogoH6 = <T extends ProductoCatalogoH6Referencia>(
  catalogo: T[],
  lineasSolicitadas: LineaSolicitudInsumoInput[]
): T[] => {
  const acumuladoPorSku = new Map<string, number>();
  for (const it of lineasSolicitadas) {
    const skuNorm = String(it.sku || "").trim().toUpperCase();
    const cant = Number(it.quantity || 0);
    if (skuNorm && Number.isFinite(cant) && cant > 0) {
      acumuladoPorSku.set(skuNorm, Number(((acumuladoPorSku.get(skuNorm) || 0) + cant).toFixed(3)));
    }
  }

  return catalogo.map((prod) => {
    const cantReservada = acumuladoPorSku.get(prod.sku.trim().toUpperCase());
    if (!cantReservada || cantReservada <= 0) return prod;

    const nuevoDisponible = Math.max(0, Number((Number(prod.stock || 0) - cantReservada).toFixed(3)));
    const nuevoComprometido = Number((Number(prod.committed || 0) + cantReservada).toFixed(3));

    return {
      ...prod,
      stock: prod.isBulk ? nuevoDisponible : Math.round(nuevoDisponible * 1000) / 1000,
      committed: prod.isBulk ? nuevoComprometido : Math.round(nuevoComprometido * 1000) / 1000,
    };
  });
};

export const liberarReservaComprometidoEnCatalogoH6 = <T extends ProductoCatalogoH6Referencia>(
  catalogo: T[],
  lineasLiberadas: LineaSolicitudInsumoInput[]
): T[] => {
  const acumuladoPorSku = new Map<string, number>();
  for (const it of lineasLiberadas) {
    const skuNorm = String(it.sku || "").trim().toUpperCase();
    const cant = Number(it.quantity || 0);
    if (skuNorm && Number.isFinite(cant) && cant > 0) {
      acumuladoPorSku.set(skuNorm, Number(((acumuladoPorSku.get(skuNorm) || 0) + cant).toFixed(3)));
    }
  }

  return catalogo.map((prod) => {
    const cantLiberada = acumuladoPorSku.get(prod.sku.trim().toUpperCase());
    if (!cantLiberada || cantLiberada <= 0) return prod;

    const nuevoDisponible = Number((Number(prod.stock || 0) + cantLiberada).toFixed(3));
    const nuevoComprometido = Math.max(0, Number((Number(prod.committed || 0) - cantLiberada).toFixed(3)));

    return {
      ...prod,
      stock: prod.isBulk ? nuevoDisponible : Math.round(nuevoDisponible * 1000) / 1000,
      committed: prod.isBulk ? nuevoComprometido : Math.round(nuevoComprometido * 1000) / 1000,
    };
  });
};

export interface EstadoAccionesBodegueroSolicitud {
  puedeEditar: boolean;
  puedeAnular: boolean;
  motivoBloqueo: string | null;
}

/**
 * [FRONT-2] Determina si las acciones de "Editar" y "Anular" están activas para el Bodeguero.
 * Solo están habilitadas cuando el estado de la solicitud es 'pendiente' ('Pendiente').
 * Solicitudes 'aprobada', 'rechazada', 'anulada' o 'entregada' bloquean ambos botones.
 */
export const obtenerEstadoAccionesBodegueroSolicitud = (
  estadoSolicitud: string
): EstadoAccionesBodegueroSolicitud => {
  const estadoNorm = String(estadoSolicitud || "").trim().toLowerCase();
  if (estadoNorm === "pendiente") {
    return {
      puedeEditar: true,
      puedeAnular: true,
      motivoBloqueo: null,
    };
  }
  return {
    puedeEditar: false,
    puedeAnular: false,
    motivoBloqueo: `Acciones Editar y Anular bloqueadas: la solicitud ya se encuentra en estado '${estadoSolicitud.toUpperCase()}'. Solo se pueden editar o anular solicitudes en estado Pendiente.`,
  };
};

export interface ComprobanteAprobacionSolicitud {
  receiptNumber: string;
  requestId: string;
  requestCode: string;
  projectCode: string;
  projectName: string;
  requesterName: string;
  requesterRut: string;
  approvedBy: string;
  approvedAt: string;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  totalItemsCount: number;
  totalUnitsCount: number;
  notificationToRequester: {
    recipientName: string;
    recipientRut: string;
    title: string;
    message: string;
  };
}

export const generarNumeroComprobanteSolicitud = (
  comprobantesExistentes: (string | undefined | null)[],
  anio = new Date().getFullYear()
): string => {
  let maxCorrelativo = 0;
  for (const comp of comprobantesExistentes) {
    if (!comp) continue;
    const match = /^COMP-\d{4}-(\d+)$/i.exec(comp.trim());
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num) && num > maxCorrelativo) {
        maxCorrelativo = num;
      }
    }
  }
  return `COMP-${anio}-${String(maxCorrelativo + 1).padStart(3, "0")}`;
};

export const construirComprobanteYNotificacionAprobacion = (
  solicitud: {
    id: string;
    code: string;
    projectCode: string;
    projectName: string;
    technicianName: string;
    technicianRut: string;
    receiptNumber?: string;
    items: { sku: string; name: string; quantity: number; unit: string }[];
  },
  approverName: string,
  comprobantesExistentes: (string | undefined | null)[] = [],
  fechaAprobacion = new Date().toISOString().slice(0, 10)
): ComprobanteAprobacionSolicitud => {
  const receiptNumber =
    solicitud.receiptNumber && solicitud.receiptNumber.trim() !== ""
      ? solicitud.receiptNumber.trim()
      : generarNumeroComprobanteSolicitud(comprobantesExistentes);

  const totalItemsCount = solicitud.items.length;
  const totalUnitsCount = Number(
    solicitud.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0).toFixed(3)
  );
  const resumenInsumos = solicitud.items
    .map((it) => `${it.quantity} ${it.unit} ${it.name}`)
    .join(", ");

  return {
    receiptNumber,
    requestId: solicitud.id,
    requestCode: solicitud.code,
    projectCode: solicitud.projectCode,
    projectName: solicitud.projectName,
    requesterName: solicitud.technicianName,
    requesterRut: solicitud.technicianRut,
    approvedBy: approverName,
    approvedAt: fechaAprobacion,
    items: solicitud.items.map((it) => ({
      sku: it.sku,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
    })),
    totalItemsCount,
    totalUnitsCount,
    notificationToRequester: {
      recipientName: solicitud.technicianName,
      recipientRut: solicitud.technicianRut,
      title: `Solicitud ${solicitud.code} Aprobada — Comprobante N° ${receiptNumber}`,
      message: `El Administrador (${approverName}) aprobó su solicitud ${solicitud.code} para el proyecto ${solicitud.projectCode} - ${solicitud.projectName} (${resumenInsumos}). Comprobante de autorización N° ${receiptNumber} listo para retiro/egreso en bodega.`,
    },
  };
};

export const construirNotificacionRechazoSolicitud = (
  solicitud: {
    id: string;
    code: string;
    projectCode: string;
    projectName: string;
    technicianName: string;
    technicianRut: string;
  },
  reason: string,
  approverName: string
): {
  esValido: boolean;
  error: string | null;
  motivoLimpio: string;
  notificationToRequester: {
    recipientName: string;
    recipientRut: string;
    title: string;
    message: string;
  } | null;
} => {
  const motivoLimpio = String(reason || "").trim();
  if (!motivoLimpio) {
    return {
      esValido: false,
      error: "El rechazo exige motivo obligatorio.",
      motivoLimpio: "",
      notificationToRequester: null,
    };
  }

  return {
    esValido: true,
    error: null,
    motivoLimpio,
    notificationToRequester: {
      recipientName: solicitud.technicianName,
      recipientRut: solicitud.technicianRut,
      title: `Solicitud ${solicitud.code} Rechazada por Administración`,
      message: `El Administrador (${approverName}) rechazó su solicitud ${solicitud.code} del proyecto ${solicitud.projectCode} - ${solicitud.projectName}. Motivo: "${motivoLimpio}". El stock comprometido fue liberado en H6.`,
    },
  };
};

export interface ResumenLineaSalidaFisica {
  sku: string;
  name: string;
  unit: string;
  saldoAutorizado: number;
  entregadoPrevio: number;
  saldoPendienteAntes: number;
  entregandoAhora: number;
  entregadoAcumulado: number;
  saldoPendienteRestante: number;
  porcentajeAvanceEntrega: number;
  stockDisponibleBodega: number;
  stockComprometidoBodega: number;
  stockRespaldoParaEgreso: number;
  superaSaldoPendiente: boolean;
  superaStockBodega: boolean;
  esEntregaValida: boolean;
  mensajeAlerta: string | null;
}

export interface ResumenSolicitudSalidaFisica {
  requestId: string;
  requestCode: string;
  receiptNumber: string;
  projectCode: string;
  projectName: string;
  lineas: ResumenLineaSalidaFisica[];
  totalAutorizadoUnidades: number;
  totalEntregadoPrevioUnidades: number;
  totalEntregandoAhoraUnidades: number;
  totalEntregadoAcumuladoUnidades: number;
  totalSaldoPendienteRestanteUnidades: number;
  porcentajeAvanceTotal: number;
  esEntregaCompleta: boolean;
  esEntregaParcial: boolean;
  tieneErroresLinea: boolean;
  errores: string[];
}

export const calcularResumenLineaSalidaFisica = (
  itemSolicitud: {
    sku: string;
    name: string;
    quantity: number;
    deliveredQuantity?: number;
    unit: string;
  },
  cantidadAEntregarAhora: number,
  productoCatalogo?: {
    sku: string;
    name?: string;
    stock: number;
    committed?: number;
  } | null
): ResumenLineaSalidaFisica => {
  const saldoAutorizado = Math.max(0, Number(Number(itemSolicitud.quantity || 0).toFixed(3)));
  const entregadoPrevio = Math.max(0, Number(Number(itemSolicitud.deliveredQuantity || 0).toFixed(3)));
  const saldoPendienteAntes = Math.max(0, Number((saldoAutorizado - entregadoPrevio).toFixed(3)));
  const entregandoAhora = Math.max(0, Number(Number(cantidadAEntregarAhora || 0).toFixed(3)));
  const entregadoAcumulado = Number((entregadoPrevio + entregandoAhora).toFixed(3));
  const saldoPendienteRestante = Math.max(0, Number((saldoPendienteAntes - entregandoAhora).toFixed(3)));
  const porcentajeAvanceEntrega =
    saldoAutorizado > 0
      ? Math.min(100, Math.round((entregadoAcumulado / saldoAutorizado) * 100))
      : 100;

  const stockDisponibleBodega = Math.max(0, Number(Number(productoCatalogo?.stock || 0).toFixed(3)));
  const stockComprometidoBodega = Math.max(0, Number(Number(productoCatalogo?.committed || 0).toFixed(3)));
  const reservaAplicable = Math.min(stockComprometidoBodega, saldoPendienteAntes);
  const stockRespaldoParaEgreso = Number((stockDisponibleBodega + reservaAplicable).toFixed(3));

  const superaSaldoPendiente = entregandoAhora > saldoPendienteAntes;
  const superaStockBodega = entregandoAhora > stockRespaldoParaEgreso;

  let mensajeAlerta: string | null = null;
  if (superaSaldoPendiente) {
    mensajeAlerta = `La cantidad a entregar de ${itemSolicitud.name} (${entregandoAhora} ${itemSolicitud.unit}) supera el saldo autorizado pendiente (${saldoPendienteAntes} ${itemSolicitud.unit}).`;
  } else if (superaStockBodega) {
    mensajeAlerta = `Stock físico insuficiente para ${itemSolicitud.name} (${itemSolicitud.sku}): respaldado en bodega ${stockRespaldoParaEgreso} ${itemSolicitud.unit}, intentando egresar ${entregandoAhora} ${itemSolicitud.unit}.`;
  }

  return {
    sku: itemSolicitud.sku,
    name: itemSolicitud.name,
    unit: itemSolicitud.unit,
    saldoAutorizado,
    entregadoPrevio,
    saldoPendienteAntes,
    entregandoAhora,
    entregadoAcumulado,
    saldoPendienteRestante,
    porcentajeAvanceEntrega,
    stockDisponibleBodega,
    stockComprometidoBodega,
    stockRespaldoParaEgreso,
    superaSaldoPendiente,
    superaStockBodega,
    esEntregaValida: !superaSaldoPendiente && !superaStockBodega,
    mensajeAlerta,
  };
};

export const calcularResumenSolicitudSalidaFisica = <
  TProd extends { sku: string; name?: string; stock: number; committed?: number }
>(
  solicitud: {
    id: string;
    code: string;
    receiptNumber?: string;
    projectCode: string;
    projectName: string;
    items: {
      sku: string;
      name: string;
      quantity: number;
      deliveredQuantity?: number;
      unit: string;
    }[];
  },
  cantidadesPorSku: Record<string, number>,
  catalogo: TProd[]
): ResumenSolicitudSalidaFisica => {
  const lineas = solicitud.items.map((it) => {
    const prod = catalogo.find(
      (p) => p.sku.trim().toUpperCase() === it.sku.trim().toUpperCase()
    );
    const cantAhora = Number(cantidadesPorSku[it.sku] || 0);
    return calcularResumenLineaSalidaFisica(it, cantAhora, prod);
  });

  const totalAutorizadoUnidades = Number(
    lineas.reduce((acc, l) => acc + l.saldoAutorizado, 0).toFixed(3)
  );
  const totalEntregadoPrevioUnidades = Number(
    lineas.reduce((acc, l) => acc + l.entregadoPrevio, 0).toFixed(3)
  );
  const totalEntregandoAhoraUnidades = Number(
    lineas.reduce((acc, l) => acc + l.entregandoAhora, 0).toFixed(3)
  );
  const totalEntregadoAcumuladoUnidades = Number(
    lineas.reduce((acc, l) => acc + l.entregadoAcumulado, 0).toFixed(3)
  );
  const totalSaldoPendienteRestanteUnidades = Number(
    lineas.reduce((acc, l) => acc + l.saldoPendienteRestante, 0).toFixed(3)
  );

  const porcentajeAvanceTotal =
    totalAutorizadoUnidades > 0
      ? Math.min(
          100,
          Math.round((totalEntregadoAcumuladoUnidades / totalAutorizadoUnidades) * 100)
        )
      : 100;

  const errores = lineas
    .filter((l) => l.mensajeAlerta !== null)
    .map((l) => l.mensajeAlerta as string);

  const esEntregaCompleta =
    totalEntregandoAhoraUnidades > 0 &&
    totalSaldoPendienteRestanteUnidades === 0 &&
    errores.length === 0;
  const esEntregaParcial =
    totalEntregandoAhoraUnidades > 0 &&
    totalSaldoPendienteRestanteUnidades > 0 &&
    errores.length === 0;

  return {
    requestId: solicitud.id,
    requestCode: solicitud.code,
    receiptNumber: solicitud.receiptNumber || solicitud.code,
    projectCode: solicitud.projectCode,
    projectName: solicitud.projectName,
    lineas,
    totalAutorizadoUnidades,
    totalEntregadoPrevioUnidades,
    totalEntregandoAhoraUnidades,
    totalEntregadoAcumuladoUnidades,
    totalSaldoPendienteRestanteUnidades,
    porcentajeAvanceTotal,
    esEntregaCompleta,
    esEntregaParcial,
    tieneErroresLinea: errores.length > 0,
    errores,
  };
};

export interface ResultadoEjecucionSalidaFisica<TSolicitud, TProd> {
  success: boolean;
  error: string | null;
  dispatchCode: string | null;
  esEntregaCompleta: boolean;
  resumen: ResumenSolicitudSalidaFisica | null;
  solicitudActualizada: TSolicitud | null;
  catalogoActualizado: TProd[];
  registroEgresoInmutable: {
    dispatchCode: string;
    requestId: string;
    requestCode: string;
    receiptNumber: string;
    projectCode: string;
    projectName: string;
    technicianRut: string;
    technicianName: string;
    dispatchedBy: string;
    date: string;
    immutable: true;
    correctionPolicy: string;
    items: {
      sku: string;
      name: string;
      unit: string;
      quantityDispatched: number;
      authorizedQuantity: number;
      accumulatedDelivered: number;
      remainingBalance: number;
      unitCost: number;
    }[];
  } | null;
}

export const ejecutarSalidaFisicaSolicitudEnMemoria = <
  TSolicitud extends {
    id: string;
    code: string;
    status: string;
    receiptNumber?: string;
    projectCode: string;
    projectName: string;
    technicianName: string;
    technicianRut: string;
    items: {
      sku: string;
      name: string;
      quantity: number;
      deliveredQuantity?: number;
      unit: string;
    }[];
    timeline?: any[];
  },
  TProd extends {
    sku: string;
    name: string;
    stock: number;
    committed?: number;
    isBulk?: boolean;
    pmp?: number;
    unitCost?: number;
  }
>(params: {
  solicitud: TSolicitud;
  itemsToDispatch: { sku: string; quantity: number }[];
  technicianRut: string;
  technicianName: string;
  authorName: string;
  catalogo: TProd[];
  dispatchCode?: string;
  dateStr?: string;
}): ResultadoEjecucionSalidaFisica<TSolicitud, TProd> => {
  const {
    solicitud,
    itemsToDispatch,
    technicianRut,
    technicianName,
    authorName,
    catalogo,
  } = params;

  if (!solicitud) {
    return {
      success: false,
      error: "Solicitud no encontrada.",
      dispatchCode: null,
      esEntregaCompleta: false,
      resumen: null,
      solicitudActualizada: null,
      catalogoActualizado: catalogo,
      registroEgresoInmutable: null,
    };
  }

  if (String(solicitud.status || "").trim().toLowerCase() !== "aprobada") {
    return {
      success: false,
      error: "Solo se puede registrar la salida física sobre solicitudes Aprobadas.",
      dispatchCode: null,
      esEntregaCompleta: false,
      resumen: null,
      solicitudActualizada: null,
      catalogoActualizado: catalogo,
      registroEgresoInmutable: null,
    };
  }

  const rutLimpio = String(technicianRut || "").trim();
  const nombreTecnicoLimpio = String(technicianName || "").trim();
  if (!rutLimpio || !nombreTecnicoLimpio) {
    return {
      success: false,
      error: "Debe seleccionar el técnico que retira en bodega (nombre y RUT obligatorios).",
      dispatchCode: null,
      esEntregaCompleta: false,
      resumen: null,
      solicitudActualizada: null,
      catalogoActualizado: catalogo,
      registroEgresoInmutable: null,
    };
  }

  const cantidadesPorSku: Record<string, number> = {};
  for (const item of itemsToDispatch || []) {
    const cant = Number(item.quantity || 0);
    if (cant > 0) {
      cantidadesPorSku[item.sku] = Number(((cantidadesPorSku[item.sku] || 0) + cant).toFixed(3));
    }
  }

  const resumen = calcularResumenSolicitudSalidaFisica(solicitud, cantidadesPorSku, catalogo);

  if (resumen.totalEntregandoAhoraUnidades <= 0) {
    return {
      success: false,
      error: "Debe ingresar una cantidad a entregar mayor a 0 en al menos un insumo autorizado.",
      dispatchCode: null,
      esEntregaCompleta: false,
      resumen,
      solicitudActualizada: null,
      catalogoActualizado: catalogo,
      registroEgresoInmutable: null,
    };
  }

  if (resumen.tieneErroresLinea) {
    return {
      success: false,
      error: resumen.errores[0],
      dispatchCode: null,
      esEntregaCompleta: false,
      resumen,
      solicitudActualizada: null,
      catalogoActualizado: catalogo,
      registroEgresoInmutable: null,
    };
  }

  const nowStr = params.dateStr || new Date().toISOString().slice(0, 10);
  const dispatchCode =
    params.dispatchCode || `DESP-2026-${String(Math.floor(Math.random() * 900) + 100)}`;

  const catalogoActualizado = catalogo.map((prod) => {
    const lineaResumen = resumen.lineas.find(
      (l) => l.sku.trim().toUpperCase() === prod.sku.trim().toUpperCase()
    );
    if (!lineaResumen || lineaResumen.entregandoAhora <= 0) return prod;

    const cantEgreso = lineaResumen.entregandoAhora;
    const comprometidoActual = Math.max(0, Number(prod.committed || 0));
    const stockActual = Math.max(0, Number(prod.stock || 0));

    const consumidoDeComprometido = Math.min(
      comprometidoActual,
      lineaResumen.saldoPendienteAntes,
      cantEgreso
    );
    const consumidoDeDisponible = Math.max(
      0,
      Number((cantEgreso - consumidoDeComprometido).toFixed(3))
    );

    const nuevoComprometido = Math.max(
      0,
      Number((comprometidoActual - consumidoDeComprometido).toFixed(3))
    );
    const nuevoDisponible = Math.max(
      0,
      Number((stockActual - consumidoDeDisponible).toFixed(3))
    );

    return {
      ...prod,
      stock: prod.isBulk ? nuevoDisponible : Math.round(nuevoDisponible * 1000) / 1000,
      committed: prod.isBulk
        ? nuevoComprometido
        : Math.round(nuevoComprometido * 1000) / 1000,
    };
  });

  const updatedItems = solicitud.items.map((it) => {
    const lineaResumen = resumen.lineas.find(
      (l) => l.sku.trim().toUpperCase() === it.sku.trim().toUpperCase()
    );
    if (!lineaResumen) return it;
    return {
      ...it,
      deliveredQuantity: lineaResumen.entregadoAcumulado,
    };
  });

  const isFullyDelivered = updatedItems.every(
    (it) => Number(it.deliveredQuantity || 0) >= Number(it.quantity)
  );

  const currentTimeline = Array.isArray(solicitud.timeline) ? solicitud.timeline : [];
  const newTimelineStep = {
    id: `step_${Date.now()}`,
    title: isFullyDelivered ? "Egreso Completo en Bodega" : "Egreso Parcial en Bodega",
    description: `Despachado a ${nombreTecnicoLimpio} (${rutLimpio}) bajo guía ${dispatchCode} (${resumen.totalEntregandoAhoraUnidades} un. entregadas; saldo pendiente: ${resumen.totalSaldoPendienteRestanteUnidades} un.). Registro irreversible vinculado a ${solicitud.projectCode}.`,
    date: nowStr,
    author: authorName,
    status: "completado" as const,
  };

  const solicitudActualizada: TSolicitud = {
    ...solicitud,
    status: isFullyDelivered ? "entregada" : "aprobada",
    items: updatedItems,
    timeline: [...currentTimeline, newTimelineStep],
  };

  const registroEgresoInmutable = {
    dispatchCode,
    requestId: solicitud.id,
    requestCode: solicitud.code,
    receiptNumber: solicitud.receiptNumber || solicitud.code,
    projectCode: solicitud.projectCode,
    projectName: solicitud.projectName,
    technicianRut: rutLimpio,
    technicianName: nombreTecnicoLimpio,
    dispatchedBy: authorName,
    date: nowStr,
    immutable: true as const,
    correctionPolicy:
      "El egreso queda vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones se realizan únicamente mediante un movimiento de ajuste en Cardex, nunca editando el registro.",
    items: resumen.lineas
      .filter((l) => l.entregandoAhora > 0)
      .map((l) => {
        const prod = catalogo.find(
          (p) => p.sku.trim().toUpperCase() === l.sku.trim().toUpperCase()
        );
        return {
          sku: l.sku,
          name: l.name,
          unit: l.unit,
          quantityDispatched: l.entregandoAhora,
          authorizedQuantity: l.saldoAutorizado,
          accumulatedDelivered: l.entregadoAcumulado,
          remainingBalance: l.saldoPendienteRestante,
          unitCost: Number(prod?.pmp ?? prod?.unitCost ?? 0),
        };
      }),
  };

  return {
    success: true,
    error: null,
    dispatchCode,
    esEntregaCompleta: isFullyDelivered,
    resumen,
    solicitudActualizada,
    catalogoActualizado,
    registroEgresoInmutable,
  };
};



