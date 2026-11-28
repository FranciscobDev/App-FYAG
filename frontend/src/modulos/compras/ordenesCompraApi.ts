import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import { EstadoOrdenCompra, ItemOrdenCompra, OrdenCompra } from "@/nucleo/tipos";

const obtenerRuta = () => `${obtenerBaseUrlApi()}/ordenes-compra`;

export interface LineaOrdenCompraApi {
  id_oc_linea: number;
  id_orden_compra: number;
  id_articulo: number;
  sku: string;
  nombre_articulo: string;
  unidad: string;
  cantidad_orden: number;
  precio_unitario: number;
  subtotal_linea: number;
  cantidad_recibida: number;
  cantidad_defectuosa?: number;
  saldo_pendiente?: number;
}

export interface OrdenCompraApi {
  id_orden_compra: number;
  numero_oc: string;
  proveedor_id: number;
  nombre_proveedor: string;
  razon_social_proveedor: string | null;
  rut_proveedor: string;
  correo_proveedor: string | null;
  telefono_proveedor: string | null;
  direccion_proveedor: string | null;
  estado: "Borrador" | "Enviada" | "Recibida parcial" | "Recibida" | "Cerrada" | "Anulada";
  origen: string;
  fecha_estimada_oc: string | null;
  fecha_creacion: string;
  observaciones: string | null;
  fecha_aprobacion: string | null;
  id_usuario_aprobador: number | null;
  correo_enviado_a: string | null;
  fecha_envio_correo: string | null;
  lineas: LineaOrdenCompraApi[];
  subtotal_neto: number;
  iva: number;
  total: number;
}

export interface RespuestaAprobacionOcApi {
  mensaje: string;
  orden_compra: OrdenCompraApi;
  correo_enviado?: {
    para: string;
    asunto: string;
    nombre_adjunto: string;
    tamano_pdf_bytes: number;
  };
  pdf_base64?: string;
}

export interface ResultadoApi<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(url: string, opciones?: RequestInit): Promise<ResultadoApi<T>> {
  try {
    const res = await fetch(url, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...encabezadosAuth(),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? json.error ?? "Error en el servidor" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

const mapearEstadoDesdeBd = (estadoBd: string): EstadoOrdenCompra => {
  const limpio = (estadoBd || "").trim().toLowerCase();
  if (limpio === "enviada") return "enviada";
  if (limpio === "recibida parcial" || limpio === "recibida_parcial") return "recibida_parcial";
  if (limpio === "recibida") return "recibida";
  if (limpio === "cerrada") return "cerrada";
  if (limpio === "anulada") return "anulada";
  return "borrador";
};

export const mapearEstadoHaciaBd = (estadoUi: EstadoOrdenCompra): OrdenCompraApi["estado"] => {
  const mapa: Record<EstadoOrdenCompra, OrdenCompraApi["estado"]> = {
    borrador: "Borrador",
    enviada: "Enviada",
    recibida_parcial: "Recibida parcial",
    recibida: "Recibida",
    cerrada: "Cerrada",
    anulada: "Anulada",
  };
  return mapa[estadoUi] ?? "Borrador";
};

export const ordenCompraDesdeApi = (oc: OrdenCompraApi): OrdenCompra => {
  const items: ItemOrdenCompra[] = (oc.lineas || []).map((l) => {
    const cantOrden = Number(l.cantidad_orden);
    const cantRecibida = Number(l.cantidad_recibida || 0);
    return {
      sku: l.sku,
      name: l.nombre_articulo,
      quantity: cantOrden,
      unitPrice: Number(l.precio_unitario),
      unit: l.unidad || "un",
      receivedQuantity: cantRecibida,
      defectiveQuantity: Number(l.cantidad_defectuosa || 0),
      missingQuantity:
        l.saldo_pendiente !== undefined
          ? Number(l.saldo_pendiente)
          : Math.max(0, Number((cantOrden - cantRecibida).toFixed(3))),
    };
  });

  return {
    id: String(oc.id_orden_compra),
    code: oc.numero_oc,
    supplierId: String(oc.proveedor_id),
    supplier: oc.razon_social_proveedor || oc.nombre_proveedor,
    supplierRut: oc.rut_proveedor,
    status: mapearEstadoDesdeBd(oc.estado),
    isAutoMinStock: (oc.origen || "").toLowerCase().includes("stock"),
    items,
    subtotal: Number(oc.subtotal_neto || 0),
    iva: Number(oc.iva || 0),
    total: Number(oc.total || 0),
    itemsCount: items.length,
    date: (oc.fecha_creacion || new Date().toISOString()).slice(0, 10),
    expectedDate: oc.fecha_estimada_oc || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: oc.observaciones || undefined,
  };
};

export const listarOrdenesCompraApi = () =>
  peticion<OrdenCompraApi[]>(obtenerRuta());

export const crearOrdenCompraApi = (datos: {
  proveedor_id: number;
  origen?: string;
  fecha_estimada_oc?: string;
  observaciones?: string;
  aprobar_inmediatamente?: boolean;
  lineas: { sku: string; cantidad_orden: number; precio_unitario: number }[];
}) =>
  peticion<RespuestaAprobacionOcApi>(obtenerRuta(), {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const actualizarOrdenCompraApi = (
  idOrden: number,
  datos: {
    proveedor_id?: number;
    origen?: string;
    fecha_estimada_oc?: string;
    observaciones?: string;
    lineas?: { sku: string; cantidad_orden: number; precio_unitario: number }[];
  }
) =>
  peticion<{ mensaje: string; orden_compra: OrdenCompraApi }>(`${obtenerRuta()}/${idOrden}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const aprobarOrdenCompraApi = (idOrden: number, correoDestino?: string) =>
  peticion<RespuestaAprobacionOcApi>(`${obtenerRuta()}/${idOrden}/aprobar`, {
    method: "POST",
    body: JSON.stringify(correoDestino ? { correo_destino: correoDestino } : {}),
  });

export const cambiarEstadoOrdenCompraApi = (idOrden: number, estado: OrdenCompraApi["estado"]) =>
  peticion<RespuestaAprobacionOcApi>(`${obtenerRuta()}/${idOrden}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });

export const registrarRecepcionOrdenCompraApi = (
  idOrden: number,
  items: { sku: string; cantidad_recibida: number; cantidad_defectuosa: number; cantidad_faltante?: number }[],
  numeroFactura?: string
) =>
  peticion<{ mensaje: string; orden_compra: OrdenCompraApi }>(`${obtenerRuta()}/${idOrden}/recepcion`, {
    method: "POST",
    body: JSON.stringify({ items, numero_factura: numeroFactura }),
  });

/**
 * Descarga el PDF corporativo oficial de una Orden de Compra en el navegador.
 * Si la orden existe en el backend por ID numérico, descarga el binario desde GET /api/ordenes-compra/:id/pdf.
 */
export const descargarPdfOrdenCompraWeb = async (order: OrdenCompra): Promise<boolean> => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const idNum = Number(order.id);
  if (Number.isInteger(idNum) && idNum > 0) {
    try {
      const res = await fetch(`${obtenerRuta()}/${idNum}/pdf?descargar=1`, {
        headers: { ...encabezadosAuth() },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${order.code}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return true;
      }
    } catch {
      // Continúa con respaldo local si el servidor no responde
    }
  }
  return false;
};
