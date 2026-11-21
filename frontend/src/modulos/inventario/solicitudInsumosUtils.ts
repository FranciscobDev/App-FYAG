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
