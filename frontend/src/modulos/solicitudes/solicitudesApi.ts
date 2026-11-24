import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import type { Producto, Proyecto, SolicitudMaterial } from "@/nucleo/tipos";

/** Fila que devuelve GET /api/solicitudes en el servidor. */
export interface SolicitudServidor {
  id_solicitud: number;
  id_usuario: number;
  id_proyecto: number;
  nombre_proyecto: string;
  estado_solicitud: string;
  motivo_rechazo: string | null;
  nro_comprobante: string | null;
  descripcion_solicitud: string | null;
  fecha_solicitud: string;
  tecnico_rut: string;
  tecnico_nombre: string;
  lineas: {
    id_articulo: number;
    sku: string | null;
    nombre_articulo: string;
    cantidad_solicitada: number;
  }[];
}

export interface ResultadoSolicitudApi<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type UrgenciaSolicitud = "normal" | "alta" | "urgente";

async function peticion<T>(ruta: string, opciones?: RequestInit): Promise<ResultadoSolicitudApi<T>> {
  try {
    const res = await fetch(`${obtenerBaseUrlApi()}${ruta}`, {
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
    return { ok: false, error: "No se pudo conectar con el servidor. La solicitud no fue guardada." };
  }
}

/** La urgencia no tiene columna propia en la base: se guarda como prefijo de la descripción. */
const prefijoUrgencia = (urgencia: UrgenciaSolicitud): string =>
  urgencia === "urgente" ? "[URGENTE] " : urgencia === "alta" ? "[ALTA] " : "";

const separarUrgencia = (descripcion: string | null): { urgencia: UrgenciaSolicitud; comentario: string } => {
  const texto = descripcion ?? "";
  if (texto.startsWith("[URGENTE] ")) return { urgencia: "urgente", comentario: texto.slice(10) };
  if (texto.startsWith("[ALTA] ")) return { urgencia: "alta", comentario: texto.slice(7) };
  return { urgencia: "normal", comentario: texto };
};

/**
 * Guarda la solicitud en la base de datos (solicitudes_insumos). El servidor valida el estado del proyecto
 * y el stock disponible; si rechaza, la solicitud no existe.
 */
export const crearSolicitudInsumosApi = (datos: {
  idProyecto: number;
  items: { sku: string; cantidad: number }[];
  comentario?: string;
  urgencia: UrgenciaSolicitud;
}) => {
  const descripcion = `${prefijoUrgencia(datos.urgencia)}${datos.comentario ?? ""}`.trim();
  return peticion<{ mensaje: string; solicitud: { id_solicitud: number } }>("/solicitudes", {
    method: "POST",
    body: JSON.stringify({
      id_proyecto: datos.idProyecto,
      items: datos.items.map((i) => ({ sku: i.sku, cantidad_solicitada: i.cantidad })),
      descripcion_solicitud: descripcion || null,
    }),
  });
};

export const listarSolicitudesApi = () => peticion<SolicitudServidor[]>("/solicitudes");

const ESTADO_EN_APP: Record<string, SolicitudMaterial["status"]> = {
  Pendiente: "pendiente",
  Aprobada: "aprobada",
  "En Proceso": "aprobada",
  Rechazada: "rechazada",
  Anulada: "anulada",
  Completada: "entregada",
};

/** Convierte una solicitud de la base al modelo que usa la aplicación. */
export const solicitudDesdeApi = (
  fila: SolicitudServidor,
  proyecto: Proyecto | undefined,
  productos: Producto[]
): SolicitudMaterial => {
  const { urgencia, comentario } = separarUrgencia(fila.descripcion_solicitud);
  const fecha = (fila.fecha_solicitud ?? "").slice(0, 10);
  const anio = fecha.slice(0, 4) || String(new Date().getFullYear());
  return {
    id: `sol_${fila.id_solicitud}`,
    code: `SOL-${anio}-${String(fila.id_solicitud).padStart(3, "0")}`,
    projectId: String(fila.id_proyecto),
    projectCode: proyecto?.code ?? `PROJ-${fila.id_proyecto}`,
    projectName: proyecto?.name ?? fila.nombre_proyecto,
    technicianRut: fila.tecnico_rut,
    technicianName: fila.tecnico_nombre || "Técnico de Terreno",
    date: fecha,
    urgency: urgencia,
    status: ESTADO_EN_APP[fila.estado_solicitud] ?? "pendiente",
    items: fila.lineas.map((l) => ({
      sku: l.sku ?? "",
      name: l.nombre_articulo,
      quantity: Number(l.cantidad_solicitada),
      unit: productos.find((p) => p.sku === l.sku)?.unit ?? "un",
    })),
    comment: comentario || undefined,
    rejectionReason: fila.motivo_rechazo ?? undefined,
    receiptNumber: fila.nro_comprobante ?? undefined,
  };
};