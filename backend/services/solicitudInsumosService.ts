/**
 * Servicio compartido de validación y reserva de stock para "Nueva Solicitud de Insumos" (H6 / H36).
 *
 * Sincronizado 1:1 con `frontend/src/modulos/inventario/solicitudInsumosUtils.ts` ([FRONT-1]).
 *
 * Criterios de aceptación:
 * 1. Proyecto, insumos y cantidades son obligatorios.
 * 2. Solo se pueden solicitar insumos para proyectos activos (activo / en_curso / planificado; bloquea cerrado / finalizado / pausado).
 * 3. Si la cantidad solicitada supera el stock disponible en vivo, se informa y no se crea la solicitud.
 * 4. El estado inicial es "Pendiente" ('pendiente').
 * 5. El stock solicitado pasa de "Disponible" a "Comprometido" en el catálogo de inventario (H6).
 * 6. Se notifica al Administrador.
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
    /** Stock disponible en vivo en bodega */
    stock: number;
    /** Stock reservado / comprometido en solicitudes pendientes o aprobadas (H6) */
    committed?: number;
    quarantine?: number;
    minStock: number;
    disabled?: boolean;
    isBulk?: boolean;
    containerCapacity?: number;
}

// =========================================================================
// [FRONT-2] UTILIDADES PARA INSUMOS A GRANEL (HASTA 3 DECIMALES Y CAPACIDAD RESTANTE DEL CONTENEDOR)
// =========================================================================

export interface RemanenteContenedorGranel {
    sku: string;
    name: string;
    unit: string;
    esGranel: boolean;
    maxDecimales: number;
    capacidadNominalContenedor: number | null;
    stockBaseAntes: number;
    deltaMovimiento: number;
    remanenteExactoDespues: number;
    remanenteEnContenedorActual: number;
    contenedoresCompletosRestantes: number;
    porcentajeRestanteContenedor: number;
    etiquetaUnidadYRemanente: string;
    etiquetaCapacidadContenedor: string | null;
}

/**
 * [FRONT-2] Formatea una cantidad de movimiento de bodega mostrando hasta 3 decimales exactos
 * para insumos a granel (o cuando tiene parte fraccionaria) y acompañándola opcionalmente de su unidad de medida.
 */
export const formatearCantidadMovimientoBodega = (
    cantidad: number | string | undefined | null,
    esGranel = false,
    unidad?: string,
    forzarTresDecimales = false
): string => {
    const num = Number(String(cantidad ?? 0).replace(',', '.'));
    const seguro = Number.isFinite(num) ? Number(num.toFixed(3)) : 0;
    let textoNumero: string;
    if (esGranel && forzarTresDecimales) {
        textoNumero = seguro.toFixed(3);
    } else if (esGranel || !Number.isInteger(seguro)) {
        textoNumero = String(Number(seguro.toFixed(3)));
    } else {
        textoNumero = String(Math.trunc(seguro));
    }
    return unidad ? `${textoNumero} ${unidad}` : textoNumero;
};

/**
 * [FRONT-2] Sanitiza la entrada de texto de un formulario de movimiento de bodega:
 * - Si `esGranel` es true: admite separador decimal (`.` o `,`) y trunca hasta un máximo de 3 decimales,
 *   conservando estados intermedios de escritura (`"12."`, `"0.25"`, `"4.125"`).
 * - Si `esGranel` es false: admite únicamente dígitos enteros (0 decimales).
 */
export const sanitizarEntradaCantidadBodega = (
    textoRaw: string | number,
    esGranel = true,
    maxDecimales = 3
): {
    textoSanitizado: string;
    valorNumerico: number;
    decimalesIngresados: number;
    excedeMaxDecimales: boolean;
} => {
    const original = String(textoRaw ?? '').replace(/,/g, '.');
    const limiteDec = esGranel ? Math.min(3, Math.max(0, maxDecimales)) : 0;
    const soloPermitidos = original.replace(esGranel ? /[^0-9.]/g : /[^0-9]/g, '');

    if (!esGranel) {
        const enteroLimpio = soloPermitidos.replace(/^0+(\d)/, '$1');
        const val = parseInt(enteroLimpio, 10);
        return {
            textoSanitizado: enteroLimpio,
            valorNumerico: Number.isFinite(val) ? Math.max(0, val) : 0,
            decimalesIngresados: 0,
            excedeMaxDecimales: /\./.test(original),
        };
    }

    const idxPunto = soloPermitidos.indexOf('.');
    if (idxPunto === -1) {
        const enteroLimpio = soloPermitidos.replace(/^0+(\d)/, '$1');
        const val = parseFloat(enteroLimpio);
        return {
            textoSanitizado: enteroLimpio,
            valorNumerico: Number.isFinite(val) ? Math.max(0, Number(val.toFixed(limiteDec))) : 0,
            decimalesIngresados: 0,
            excedeMaxDecimales: false,
        };
    }

    const parteEnteraRaw = soloPermitidos.slice(0, idxPunto) || '0';
    const parteEntera = parteEnteraRaw.replace(/^0+(\d)/, '$1') || '0';
    const parteDecimalRaw = soloPermitidos.slice(idxPunto + 1).replace(/\./g, '');
    const excedeMaxDecimales = parteDecimalRaw.length > limiteDec;
    const parteDecimal = parteDecimalRaw.slice(0, limiteDec);
    const textoSanitizado = `${parteEntera}.${parteDecimal}`;
    const val = parseFloat(textoSanitizado);

    return {
        textoSanitizado,
        valorNumerico: Number.isFinite(val) ? Math.max(0, Number(val.toFixed(limiteDec))) : 0,
        decimalesIngresados: parteDecimal.length,
        excedeMaxDecimales,
    };
};

/**
 * [FRONT-2] Calcula el remanente exacto en pantalla (hasta 3 decimales) y la capacidad restante
 * del contenedor/carrete para formularios de movimiento de bodega (Egreso/Salida Física, Solicitud, Merma y Conteo Físico).
 */
export const calcularRemanenteContenedorGranel = (
    producto: {
        sku: string;
        name: string;
        unit: string;
        stock: number;
        committed?: number;
        isBulk?: boolean;
        containerCapacity?: number;
    },
    opciones: {
        cantidadMovimiento?: number;
        tipoMovimiento?: 'egreso' | 'solicitud' | 'merma' | 'conteo';
        stockBaseOverride?: number;
        cantidadContadaFisica?: number;
    } = {}
): RemanenteContenedorGranel => {
    const esGranel = Boolean(producto.isBulk);
    const maxDecimales = esGranel ? 3 : 0;
    const unit = producto.unit || 'un';
    const capacidadNominal =
        producto.containerCapacity && Number(producto.containerCapacity) > 0
            ? Number(Number(producto.containerCapacity).toFixed(3))
            : null;

    const stockBaseAntes = Number(
        Number(opciones.stockBaseOverride ?? producto.stock ?? 0).toFixed(3)
    );
    const tipo = opciones.tipoMovimiento || 'egreso';
    const cantMov = Number(Number(opciones.cantidadMovimiento ?? 0).toFixed(3));

    let remanenteExactoDespues: number;
    let deltaMovimiento: number;

    if (tipo === 'conteo' && opciones.cantidadContadaFisica !== undefined) {
        remanenteExactoDespues = Math.max(
            0,
            Number(Number(opciones.cantidadContadaFisica).toFixed(3))
        );
        deltaMovimiento = Number((remanenteExactoDespues - stockBaseAntes).toFixed(3));
    } else {
        deltaMovimiento = -Math.max(0, cantMov);
        remanenteExactoDespues = Math.max(
            0,
            Number((stockBaseAntes - Math.max(0, cantMov)).toFixed(3))
        );
    }

    let remanenteEnContenedorActual = remanenteExactoDespues;
    let contenedoresCompletosRestantes = 0;
    let porcentajeRestanteContenedor = 100;

    if (capacidadNominal && capacidadNominal > 0) {
        if (remanenteExactoDespues <= 0) {
            remanenteEnContenedorActual = 0;
            contenedoresCompletosRestantes = 0;
            porcentajeRestanteContenedor = 0;
        } else if (remanenteExactoDespues <= capacidadNominal) {
            remanenteEnContenedorActual = remanenteExactoDespues;
            contenedoresCompletosRestantes =
                Math.abs(remanenteExactoDespues - capacidadNominal) < 0.0005 ? 1 : 0;
            porcentajeRestanteContenedor = Number(
                Math.min(100, (remanenteEnContenedorActual / capacidadNominal) * 100).toFixed(1)
            );
        } else {
            const resto = Number((remanenteExactoDespues % capacidadNominal).toFixed(3));
            contenedoresCompletosRestantes = Math.floor(
                Number((remanenteExactoDespues / capacidadNominal).toFixed(6))
            );
            remanenteEnContenedorActual = resto === 0 ? capacidadNominal : resto;
            porcentajeRestanteContenedor = Number(
                Math.min(100, (remanenteEnContenedorActual / capacidadNominal) * 100).toFixed(1)
            );
        }
    }

    const remanenteTexto = esGranel
        ? remanenteExactoDespues.toFixed(3)
        : String(Number(remanenteExactoDespues.toFixed(3)));
    const contenedorActualTexto = esGranel
        ? remanenteEnContenedorActual.toFixed(3)
        : String(Number(remanenteEnContenedorActual.toFixed(3)));

    const etiquetaUnidadYRemanente = `Remanente exacto en bodega: ${remanenteTexto} ${unit}`;
    const etiquetaCapacidadContenedor = capacidadNominal
        ? `Capacidad restante del contenedor: ${contenedorActualTexto} / ${capacidadNominal} ${unit} (${porcentajeRestanteContenedor}%) — Total remanente: ${remanenteTexto} ${unit}`
        : null;

    return {
        sku: producto.sku,
        name: producto.name,
        unit,
        esGranel,
        maxDecimales,
        capacidadNominalContenedor: capacidadNominal,
        stockBaseAntes,
        deltaMovimiento,
        remanenteExactoDespues,
        remanenteEnContenedorActual,
        contenedoresCompletosRestantes,
        porcentajeRestanteContenedor,
        etiquetaUnidadYRemanente,
        etiquetaCapacidadContenedor,
    };
};

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
    /** Stock disponible que quedará en H6 si se confirma la solicitud */
    stockDisponibleRestanteH6: number;
    /** Stock comprometido que quedará en H6 si se confirma la solicitud */
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

export const ESTADOS_PROYECTO_ACTIVO_SOLICITUD = ['activo', 'en_curso', 'planificado'] as const;
export const ESTADOS_PROYECTO_INACTIVO_SOLICITUD = ['cerrado', 'finalizado', 'pausado', 'inactivo'] as const;

/**
 * Determina si un proyecto está activo y habilitado para recibir solicitudes de insumos.
 */
export const esProyectoActivoParaSolicitud = (
    proyecto?: ProyectoSolicitudReferencia | null
): boolean => {
    if (!proyecto || !proyecto.id) return false;
    const estado = String(proyecto.status || '').trim().toLowerCase();
    if (!estado) return false;
    if ((ESTADOS_PROYECTO_INACTIVO_SOLICITUD as readonly string[]).includes(estado)) {
        return false;
    }
    return (ESTADOS_PROYECTO_ACTIVO_SOLICITUD as readonly string[]).includes(estado);
};

/**
 * Evalúa en vivo el formulario "Nueva Solicitud de Insumos":
 * - Valida proyecto obligatorio y activo
 * - Agrega cantidades si el mismo SKU aparece repetido en el formulario
 * - Calcula stock disponible en vivo, alerta si la cantidad ingresada lo supera y proyecta el stock comprometido en H6
 */
export const validarFormularioNuevaSolicitudInsumos = (
    proyecto: ProyectoSolicitudReferencia | null | undefined,
    lineasInput: LineaSolicitudInsumoInput[],
    catalogoProductos: ProductoCatalogoH6Referencia[]
): ResultadoValidacionSolicitudInsumos => {
    let errorProyecto: string | null = null;
    const proyectoActivo = esProyectoActivoParaSolicitud(proyecto);

    if (!proyecto || !proyecto.id) {
        errorProyecto = 'El proyecto es obligatorio para emitir una solicitud de insumos.';
    } else if (!proyectoActivo) {
        errorProyecto = `No se pueden solicitar insumos para el proyecto "${proyecto.code} - ${proyecto.name}" porque se encuentra inactivo (${proyecto.status.toUpperCase()}). Solo se permiten proyectos activos.`;
    }

    if (!Array.isArray(lineasInput) || lineasInput.length === 0) {
        return {
            esValida: false,
            proyectoActivo,
            errorProyecto,
            errorGeneral: errorProyecto || 'Debe agregar al menos un insumo con cantidad mayor a 0.',
            lineasEvaluadas: [],
            faltantesStock: [],
        };
    }

    // Acumular cantidades por SKU para impedir superar el disponible mediante líneas duplicadas
    const acumuladoPorSku = new Map<string, number>();
    for (const item of lineasInput) {
        const skuNorm = String(item.sku || '').trim().toUpperCase();
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
        const skuNorm = String(item.sku || '').trim().toUpperCase();
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
            mensajeAlerta = `El insumo "${item.sku || 'sin SKU'}" no existe en el catálogo.`;
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
            unit: prod?.unit || item.unit || 'un',
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
            ? 'No se puede enviar la solicitud: uno o más insumos superan el stock disponible en bodega.'
            : hayLineaInvalida
              ? 'Verifique que todos los insumos seleccionados estén activos y tengan cantidad mayor a 0.'
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

/**
 * Transfiere el stock solicitado de "Disponible" (`stock`) a "Comprometido" (`committed`) en H6
 * al crear una solicitud válida en estado inicial "Pendiente".
 */
export const aplicarReservaComprometidoEnCatalogoH6 = <T extends ProductoCatalogoH6Referencia>(
    catalogo: T[],
    lineasSolicitadas: LineaSolicitudInsumoInput[]
): T[] => {
    const acumuladoPorSku = new Map<string, number>();
    for (const it of lineasSolicitadas) {
        const skuNorm = String(it.sku || '').trim().toUpperCase();
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

/**
 * Libera el stock comprometido de vuelta a disponible cuando una solicitud pendiente es rechazada o anulada.
 */
export const liberarReservaComprometidoEnCatalogoH6 = <T extends ProductoCatalogoH6Referencia>(
    catalogo: T[],
    lineasLiberadas: LineaSolicitudInsumoInput[]
): T[] => {
    const acumuladoPorSku = new Map<string, number>();
    for (const it of lineasLiberadas) {
        const skuNorm = String(it.sku || '').trim().toUpperCase();
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
    const estadoNorm = String(estadoSolicitud || '').trim().toLowerCase();
    if (estadoNorm === 'pendiente') {
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

/**
 * Genera un número de comprobante correlativo con formato `COMP-YYYY-NNN` (p. ej. `COMP-2026-001`)
 * al aprobar una solicitud de insumos.
 */
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
    return `COMP-${anio}-${String(maxCorrelativo + 1).padStart(3, '0')}`;
};

/**
 * [FRONT-1] Procesa la aprobación de una solicitud por parte del Administrador:
 * - Genera el comprobante numerado (`COMP-YYYY-NNN`) con detalle de proyecto, solicitante, autorizador e ítems.
 * - Construye la notificación inmediata para el bodeguero/técnico solicitante.
 */
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
        solicitud.receiptNumber && solicitud.receiptNumber.trim() !== ''
            ? solicitud.receiptNumber.trim()
            : generarNumeroComprobanteSolicitud(comprobantesExistentes);

    const totalItemsCount = solicitud.items.length;
    const totalUnitsCount = Number(
        solicitud.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0).toFixed(3)
    );
    const resumenInsumos = solicitud.items
        .map((it) => `${it.quantity} ${it.unit} ${it.name}`)
        .join(', ');

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

/**
 * [FRONT-1] Valida el rechazo de una solicitud por parte del Administrador (exige motivo obligatorio)
 * y construye la notificación inmediata para el bodeguero/técnico solicitante.
 */
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
    const motivoLimpio = String(reason || '').trim();
    if (!motivoLimpio) {
        return {
            esValido: false,
            error: 'El rechazo exige motivo obligatorio.',
            motivoLimpio: '',
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
    esGranel: boolean;
    maxDecimales: number;
    capacidadNominalContenedor: number | null;
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
    remanenteExactoBodegaDespues: number;
    remanenteEnContenedorActual: number;
    porcentajeRestanteContenedor: number;
    etiquetaUnidadYRemanente: string;
    etiquetaCapacidadContenedor: string | null;
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

/**
 * [FRONT-1 / FRONT-2] Calcula en tiempo real el saldo autorizado vs. entregado previo, entregando ahora,
 * entregado acumulado, saldo pendiente resultante y remanente exacto en contenedor (hasta 3 decimales)
 * para una línea de solicitud aprobada.
 */
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
        unit?: string;
        stock: number;
        committed?: number;
        isBulk?: boolean;
        containerCapacity?: number;
    } | null
): ResumenLineaSalidaFisica => {
    const esGranel = Boolean(productoCatalogo?.isBulk);
    const maxDecimales = esGranel ? 3 : 0;
    const unit = itemSolicitud.unit || productoCatalogo?.unit || 'un';

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
    // El stock físico real que respalda el egreso de esta solicitud aprobada incluye
    // las unidades reservadas en 'committed' (hasta el saldo pendiente de esta solicitud) más el stock libre.
    const reservaAplicable = Math.min(stockComprometidoBodega, saldoPendienteAntes);
    const stockRespaldoParaEgreso = Number((stockDisponibleBodega + reservaAplicable).toFixed(3));

    const infoContenedor = calcularRemanenteContenedorGranel(
        {
            sku: itemSolicitud.sku,
            name: itemSolicitud.name,
            unit,
            stock: stockRespaldoParaEgreso,
            committed: stockComprometidoBodega,
            isBulk: esGranel,
            containerCapacity: productoCatalogo?.containerCapacity,
        },
        {
            cantidadMovimiento: entregandoAhora,
            tipoMovimiento: 'egreso',
            stockBaseOverride: stockRespaldoParaEgreso,
        }
    );

    const superaSaldoPendiente = entregandoAhora > saldoPendienteAntes;
    const superaStockBodega = entregandoAhora > stockRespaldoParaEgreso;

    let mensajeAlerta: string | null = null;
    if (superaSaldoPendiente) {
        mensajeAlerta = `La cantidad a entregar de ${itemSolicitud.name} (${entregandoAhora} ${unit}) supera el saldo autorizado pendiente (${saldoPendienteAntes} ${unit}).`;
    } else if (superaStockBodega) {
        mensajeAlerta = `Stock físico insuficiente para ${itemSolicitud.name} (${itemSolicitud.sku}): respaldado en bodega ${stockRespaldoParaEgreso} ${unit}, intentando egresar ${entregandoAhora} ${unit}.`;
    }

    return {
        sku: itemSolicitud.sku,
        name: itemSolicitud.name,
        unit,
        esGranel,
        maxDecimales,
        capacidadNominalContenedor: infoContenedor.capacidadNominalContenedor,
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
        remanenteExactoBodegaDespues: infoContenedor.remanenteExactoDespues,
        remanenteEnContenedorActual: infoContenedor.remanenteEnContenedorActual,
        porcentajeRestanteContenedor: infoContenedor.porcentajeRestanteContenedor,
        etiquetaUnidadYRemanente: infoContenedor.etiquetaUnidadYRemanente,
        etiquetaCapacidadContenedor: infoContenedor.etiquetaCapacidadContenedor,
        superaSaldoPendiente,
        superaStockBodega,
        esEntregaValida: !superaSaldoPendiente && !superaStockBodega,
        mensajeAlerta,
    };
};

/**
 * [FRONT-1] Calcula el resumen completo en tiempo real de una solicitud aprobada en la pantalla
 * de "Registro de Salida Física" (saldo autorizado vs. entregado en vivo, soporte parcial o total).
 */
export const calcularResumenSolicitudSalidaFisica = <
    TProd extends {
        sku: string;
        name?: string;
        unit?: string;
        stock: number;
        committed?: number;
        isBulk?: boolean;
        containerCapacity?: number;
    }
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

export interface ResultadoEjecucionSalidaFisica<
    TSolicitud,
    TProd
> {
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

/**
 * [FRONT-1] Ejecuta en una sola transacción en memoria (todo o nada) el registro de salida física:
 * - Solo opera sobre solicitudes en estado 'aprobada'.
 * - Exige técnico que retira en bodega (RUT y nombre).
 * - Admite entrega parcial conservando el saldo pendiente en estado 'aprobada', o entrega total pasando a 'entregada'.
 * - Consume primero del stock comprometido (`committed`) de la solicitud y el remanente de `stock`, sin doble descuento.
 * - Genera un registro de egreso vinculado de forma irreversible al proyecto y al técnico que retira.
 */
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
            error: 'Solicitud no encontrada.',
            dispatchCode: null,
            esEntregaCompleta: false,
            resumen: null,
            solicitudActualizada: null,
            catalogoActualizado: catalogo,
            registroEgresoInmutable: null,
        };
    }

    if (String(solicitud.status || '').trim().toLowerCase() !== 'aprobada') {
        return {
            success: false,
            error: 'Solo se puede registrar la salida física sobre solicitudes Aprobadas.',
            dispatchCode: null,
            esEntregaCompleta: false,
            resumen: null,
            solicitudActualizada: null,
            catalogoActualizado: catalogo,
            registroEgresoInmutable: null,
        };
    }

    const rutLimpio = String(technicianRut || '').trim();
    const nombreTecnicoLimpio = String(technicianName || '').trim();
    if (!rutLimpio || !nombreTecnicoLimpio) {
        return {
            success: false,
            error: 'Debe seleccionar el técnico que retira en bodega (nombre y RUT obligatorios).',
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
            error: 'Debe ingresar una cantidad a entregar mayor a 0 en al menos un insumo autorizado.',
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

    // Descuento atómico (todo o nada): consume primero del stock comprometido (si fue pre-reservado) y luego del disponible
    const catalogoActualizado = catalogo.map((prod) => {
        const lineaResumen = resumen.lineas.find(
            (l) => l.sku.trim().toUpperCase() === prod.sku.trim().toUpperCase()
        );
        if (!lineaResumen || lineaResumen.entregandoAhora <= 0) return prod;

        const cantEgreso = lineaResumen.entregandoAhora;
        const comprometidoActual = Math.max(0, Number(prod.committed || 0));
        const stockActual = Math.max(0, Number(prod.stock || 0));

        // Si el producto tiene unidades en 'committed' respaldando esta solicitud, las consumimos al salir físicamente;
        // si no tenía 'committed' (p.ej. solicitud mock precargada sin reserva previa), descontamos de 'stock'.
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
        title: isFullyDelivered ? 'Egreso Completo en Bodega' : 'Egreso Parcial en Bodega',
        description: `Despachado a ${nombreTecnicoLimpio} (${rutLimpio}) bajo guía ${dispatchCode} (${resumen.totalEntregandoAhoraUnidades} un. entregadas; saldo pendiente: ${resumen.totalSaldoPendienteRestanteUnidades} un.). Registro irreversible vinculado a ${solicitud.projectCode}.`,
        date: nowStr,
        author: authorName,
        status: 'completado' as const,
    };

    const solicitudActualizada: TSolicitud = {
        ...solicitud,
        status: isFullyDelivered ? 'entregada' : 'aprobada',
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
            'El egreso queda vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones se realizan únicamente mediante un movimiento de ajuste en Cardex, nunca editando el registro.',
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

// =========================================================================
// [FRONT-1] VISTA DE CARDEX DE SOLO LECTURA, TABLA CRONOLÓGICA, CONTRASTE [SCRUM] Y EXPORTACIÓN A EXCEL
// =========================================================================

export interface MovimientoCardexConsulta {
    id: string;
    sku: string;
    productName: string;
    date: string;
    type: string;
    typeLabel: string;
    reference: string;
    projectCode?: string;
    projectName?: string;
    qtyIn: number;
    qtyOut: number;
    balance: number;
    pmp: number;
    totalValue: number;
    userName?: string;
    userRole?: string;
    userRut?: string;
}

export interface FiltrosDinamicosCardex {
    insumoQuery?: string;
    skuExacto?: string;
    tipoMovimiento?: string;
    rangoFechas?: 'todos' | '7d' | '30d' | 'personalizado';
    fechaDesde?: string;
    fechaHasta?: string;
    proyectoCodigo?: string;
    ordenCronologico?: 'asc' | 'desc';
}

export interface ContrasteSaldoInsumoCardex {
    sku: string;
    productName: string;
    unit: string;
    saldoActualInsumo: number;
    pmpActualInsumo: number;
    ultimaLineaCardex: MovimientoCardexConsulta | null;
    saldoUltimaLineaCardex: number | null;
    pmpUltimaLineaCardex: number | null;
    diferenciaSaldo: number;
    coincideSaldoConUltimaLinea: boolean;
    coincidePmpConUltimaLinea: boolean;
    totalMovimientosInsumo: number;
    mensajeVerificacion: string;
}

/**
 * Parsea una fecha de movimiento Cardex en formatos `DD-MM-YYYY HH:mm`, `DD-MM-YYYY` o `YYYY-MM-DD...`
 * a un timestamp numérico en milisegundos para ordenamiento cronológico exacto y filtro por rango.
 */
export const parsearFechaMovimientoCardexMs = (fechaStr: string): number => {
    const limpio = String(fechaStr || '').trim();
    if (!limpio) return 0;

    // Formato DD-MM-YYYY o DD-MM-YYYY HH:mm
    const matchDmy = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(limpio);
    if (matchDmy) {
        const dia = Number(matchDmy[1]);
        const mes = Number(matchDmy[2]) - 1;
        const anio = Number(matchDmy[3]);
        const hora = matchDmy[4] ? Number(matchDmy[4]) : 0;
        const min = matchDmy[5] ? Number(matchDmy[5]) : 0;
        return Date.UTC(anio, mes, dia, hora, min);
    }

    // Formato YYYY-MM-DD
    const matchYmd = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/.exec(limpio);
    if (matchYmd) {
        const anio = Number(matchYmd[1]);
        const mes = Number(matchYmd[2]) - 1;
        const dia = Number(matchYmd[3]);
        const hora = matchYmd[4] ? Number(matchYmd[4]) : 0;
        const min = matchYmd[5] ? Number(matchYmd[5]) : 0;
        return Date.UTC(anio, mes, dia, hora, min);
    }

    const parsed = Date.parse(limpio);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * [FRONT-1] Filtra dinámicamente los movimientos del Cardex (por insumo SKU/nombre, tipo de movimiento,
 * rango de fechas y opcionalmente proyecto) y los ordena en tabla cronológica mostrando saldo y PMP posterior.
 * La vista es estrictamente de solo lectura (`soloLectura: true`, `permiteEditar: false`, `permiteEliminar: false`).
 */
export const filtrarYOrdenarCardexSoloLectura = <T extends MovimientoCardexConsulta>(
    movimientos: T[],
    filtros: FiltrosDinamicosCardex = {},
    fechaReferenciaMs?: number
): {
    soloLectura: true;
    permiteEditar: false;
    permiteEliminar: false;
    movimientosOrdenados: T[];
    movimientosCronologicoAsc: T[];
    ultimaLineaCronologica: T | null;
} => {
    const queryInsumo = String(filtros.insumoQuery || '').trim().toLowerCase();
    const skuExacto = String(filtros.skuExacto || '').trim().toUpperCase();
    const tipoMov = String(filtros.tipoMovimiento || 'todos').trim().toLowerCase();
    const proyCod = String(filtros.proyectoCodigo || 'todos').trim().toUpperCase();
    const rango = filtros.rangoFechas || 'todos';
    const orden = filtros.ordenCronologico || 'asc';

    // Calcular timestamp de referencia (el mayor del conjunto si no se provee) para filtros '7d' y '30d'
    const todosTimestamps = movimientos
        .map((m) => parsearFechaMovimientoCardexMs(m.date))
        .filter((ts) => ts > 0);
    const maxTs =
        fechaReferenciaMs ??
        (todosTimestamps.length > 0 ? Math.max(...todosTimestamps) : Date.now());

    const desdeMs = filtros.fechaDesde ? parsearFechaMovimientoCardexMs(filtros.fechaDesde) : null;
    const hastaMs = filtros.fechaHasta
        ? parsearFechaMovimientoCardexMs(filtros.fechaHasta) + 24 * 60 * 60 * 1000 - 1
        : null;

    const filtrados = movimientos.filter((entry) => {
        if (skuExacto && entry.sku.trim().toUpperCase() !== skuExacto) {
            return false;
        }
        if (queryInsumo) {
            const matchSku = entry.sku.toLowerCase().includes(queryInsumo);
            const matchNombre = entry.productName.toLowerCase().includes(queryInsumo);
            const matchRef = String(entry.reference || '').toLowerCase().includes(queryInsumo);
            if (!matchSku && !matchNombre && !matchRef) return false;
        }
        if (tipoMov && tipoMov !== 'todos' && entry.type.toLowerCase() !== tipoMov) {
            return false;
        }
        if (proyCod && proyCod !== 'TODOS') {
            const entryProy = String(entry.projectCode || '').trim().toUpperCase();
            if (entryProy !== proyCod) return false;
        }

        const entryTs = parsearFechaMovimientoCardexMs(entry.date);
        if (rango === '7d' && entryTs > 0) {
            const limite7d = maxTs - 7 * 24 * 60 * 60 * 1000;
            if (entryTs < limite7d) return false;
        } else if (rango === '30d' && entryTs > 0) {
            const limite30d = maxTs - 30 * 24 * 60 * 60 * 1000;
            if (entryTs < limite30d) return false;
        }

        if (desdeMs && entryTs > 0 && entryTs < desdeMs) return false;
        if (hastaMs && entryTs > 0 && entryTs > hastaMs) return false;

        return true;
    });

    const movimientosCronologicoAsc = [...filtrados].sort((a, b) => {
        const tsA = parsearFechaMovimientoCardexMs(a.date);
        const tsB = parsearFechaMovimientoCardexMs(b.date);
        if (tsA !== tsB) return tsA - tsB;
        return String(a.id).localeCompare(String(b.id));
    });

    const ultimaLineaCronologica =
        movimientosCronologicoAsc.length > 0
            ? movimientosCronologicoAsc[movimientosCronologicoAsc.length - 1]
            : null;

    const movimientosOrdenados =
        orden === 'asc'
            ? movimientosCronologicoAsc
            : [...movimientosCronologicoAsc].reverse();

    return {
        soloLectura: true,
        permiteEditar: false,
        permiteEliminar: false,
        movimientosOrdenados,
        movimientosCronologicoAsc,
        ultimaLineaCronologica,
    };
};

/**
 * [FRONT-1][SCRUM] Contrasta el saldo actual del insumo en catálogo (`stock`) y su PMP actual
 * con la última línea cronológica registrada en el Cardex para ese insumo.
 */
export const contrastarSaldoInsumoConUltimaLineaCardex = (
    insumo: {
        sku: string;
        name: string;
        stock: number;
        pmp?: number;
        unitCost?: number;
        unit?: string;
    },
    movimientosCardex: MovimientoCardexConsulta[]
): ContrasteSaldoInsumoCardex => {
    const skuNorm = insumo.sku.trim().toUpperCase();
    const { movimientosCronologicoAsc, ultimaLineaCronologica } = filtrarYOrdenarCardexSoloLectura(
        movimientosCardex,
        { skuExacto: skuNorm, ordenCronologico: 'asc' }
    );

    const saldoActualInsumo = Number(Number(insumo.stock || 0).toFixed(3));
    const pmpActualInsumo = Math.round(Number(insumo.pmp ?? insumo.unitCost ?? 0));
    const unit = insumo.unit || 'un';

    if (!ultimaLineaCronologica) {
        return {
            sku: insumo.sku,
            productName: insumo.name,
            unit,
            saldoActualInsumo,
            pmpActualInsumo,
            ultimaLineaCardex: null,
            saldoUltimaLineaCardex: null,
            pmpUltimaLineaCardex: null,
            diferenciaSaldo: 0,
            coincideSaldoConUltimaLinea: true,
            coincidePmpConUltimaLinea: true,
            totalMovimientosInsumo: 0,
            mensajeVerificacion: `El insumo ${insumo.sku} (${insumo.name}) tiene saldo actual ${saldoActualInsumo} ${unit} sin movimientos históricos en Cardex.`,
        };
    }

    const saldoUltimaLineaCardex = Number(Number(ultimaLineaCronologica.balance || 0).toFixed(3));
    const pmpUltimaLineaCardex = Math.round(Number(ultimaLineaCronologica.pmp || 0));
    const diferenciaSaldo = Number((saldoActualInsumo - saldoUltimaLineaCardex).toFixed(3));
    const coincideSaldoConUltimaLinea = Math.abs(diferenciaSaldo) < 0.001;
    const coincidePmpConUltimaLinea = Math.abs(pmpActualInsumo - pmpUltimaLineaCardex) <= 1;

    const mensajeVerificacion = coincideSaldoConUltimaLinea
        ? `Conciliación exacta verificada: el saldo actual del insumo ${insumo.sku} (${saldoActualInsumo} ${unit}) y su PMP ($${pmpActualInsumo}) coinciden con la última línea del Cardex (${ultimaLineaCronologica.reference} del ${ultimaLineaCronologica.date} -> Saldo: ${saldoUltimaLineaCardex} ${unit}, PMP: $${pmpUltimaLineaCardex}).`
        : `Diferencia detectada en ${insumo.sku}: saldo actual en catálogo ${saldoActualInsumo} ${unit} vs. última línea del Cardex ${saldoUltimaLineaCardex} ${unit} (diferencia: ${diferenciaSaldo} ${unit}).`;

    return {
        sku: insumo.sku,
        productName: insumo.name,
        unit,
        saldoActualInsumo,
        pmpActualInsumo,
        ultimaLineaCardex: ultimaLineaCronologica,
        saldoUltimaLineaCardex,
        pmpUltimaLineaCardex,
        diferenciaSaldo,
        coincideSaldoConUltimaLinea,
        coincidePmpConUltimaLinea,
        totalMovimientosInsumo: movimientosCronologicoAsc.length,
        mensajeVerificacion,
    };
};

/**
 * [FRONT-1] Construye el contenido estructurado de exportación a Excel (CSV compatible con Excel con BOM UTF-8 y separador `;`)
 * de la tabla cronológica del Cardex con saldos, PMP, valorizado y responsable de cada movimiento.
 */
export const generarContenidoExcelCardex = (
    movimientos: MovimientoCardexConsulta[]
): {
    nombreArchivo: string;
    encabezados: string[];
    filas: string[][];
    contenidoCsvExcel: string;
} => {
    const encabezados = [
        'Fecha',
        'SKU',
        'Insumo',
        'Tipo Movimiento',
        'Referencia',
        'Proyecto / Destino',
        'Entrada (+)',
        'Salida (-)',
        'Saldo Posterior',
        'PMP Posterior (CLP)',
        'Valorizado Total (CLP)',
        'Responsable',
        'Rol',
        'RUT Responsable',
    ];

    const filas = movimientos.map((m) => [
        String(m.date || ''),
        String(m.sku || ''),
        String(m.productName || ''),
        String(m.typeLabel || m.type || ''),
        String(m.reference || ''),
        String(m.projectName || m.projectCode || 'Bodega Central'),
        String(m.qtyIn ?? 0),
        String(m.qtyOut ?? 0),
        String(m.balance ?? 0),
        String(Math.round(Number(m.pmp || 0))),
        String(Math.round(Number(m.totalValue || Number(m.balance || 0) * Number(m.pmp || 0)))),
        String(m.userName || 'Camila Vera Soto'),
        String(m.userRole || 'Bodeguero'),
        String(m.userRut || ''),
    ]);

    const escaparCelda = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const lineasCsv = [
        encabezados.map(escaparCelda).join(';'),
        ...filas.map((fila) => fila.map(escaparCelda).join(';')),
    ];

    return {
        nombreArchivo: `cardex_valorizado_${new Date().toISOString().slice(0, 10)}.csv`,
        encabezados,
        filas,
        contenidoCsvExcel: `\uFEFF${lineasCsv.join('\r\n')}`,
    };
};




