// proyectosApi.ts
import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import type { Proyecto as ProyectoUI } from "@/nucleo/tipos";

const obtenerRuta = () => `${obtenerBaseUrlApi()}/proyectos`;

// Valores exactos de los ENUM de la BD (estructura_db.md)
export const TIPOS_PROYECTO = ["Instalacion", "Mantencion"] as const;
export const ESTADOS_PROYECTO = ["Planificado", "En Proceso", "Pausado", "Completado", "Cancelado"] as const;

export type TipoProyecto = (typeof TIPOS_PROYECTO)[number];
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

/** Forma exacta de una fila de la tabla `proyecto`. */
export interface Proyecto {
  id_proyecto: number;
  nombre_proyecto: string;
  tipo_proyecto: TipoProyecto;
  cliente: string | null;
  id_cliente?: number | null;
  direccion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  presupuesto_inicial: number;
  presupuesto_horas: number;
  valor_venta: number;
  porcentaje_avance: number;
  estado_proyecto: EstadoProyecto;
  id_usuario: number | null;
}

/** Datos que se envían al crear o actualizar. */
export type FormularioProyecto = Omit<Proyecto, "id_proyecto"> & {
  id_kit_proyecto?: number | null;
  id_cliente?: number | null;
};

export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(url: string, opciones?: RequestInit): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...encabezadosAuth(),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? json.error ?? "Error en el servidor" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

export const listarProyectos = () => peticion<Proyecto[]>(obtenerRuta());

export const obtenerProyecto = (id: number) => peticion<Proyecto>(`${obtenerRuta()}/${id}`);

export const crearProyecto = (datos: FormularioProyecto) =>
  peticion<{ mensaje: string; proyecto: Proyecto }>(obtenerRuta(), {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const actualizarProyecto = (id: number, datos: FormularioProyecto) =>
  peticion<{ mensaje: string; proyecto: Proyecto }>(`${obtenerRuta()}/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const eliminarProyecto = (id: number) =>
  peticion<{ mensaje: string; proyectoEliminado: Proyecto }>(`${obtenerRuta()}/${id}`, {
    method: "DELETE",
  });

export interface Tecnico {
  id_usuario: number;
  nombre: string;
  rut?: string | null;
}

export const listarTecnicos = () =>
  peticion<Tecnico[]>(`${obtenerRuta()}/tecnicos`);

export const listarTecnicosDeProyecto = (idProyecto: number) =>
  peticion<Tecnico[]>(`${obtenerRuta()}/${idProyecto}/tecnicos`);

export const asignarTecnico = (idProyecto: number, idUsuario: number) =>
  peticion<{ mensaje: string }>(`${obtenerRuta()}/${idProyecto}/tecnicos`, {
    method: "POST",
    body: JSON.stringify({ id_usuario: idUsuario }),
  });

export const quitarTecnico = (idProyecto: number, idUsuario: number) =>
  peticion<{ mensaje: string }>(`${obtenerRuta()}/${idProyecto}/tecnicos/${idUsuario}`, {
    method: "DELETE",
  });

// ---------------------------------------------------------------------------
// Mapeo de la fila de la BD al tipo Proyecto que usa la UI
// ---------------------------------------------------------------------------

// Estado de la BD (estado_proyecto_enum) -> estado que usa la UI
const mapearEstado = (estado: EstadoProyecto): ProyectoUI["status"] => {
  const mapa: Record<EstadoProyecto, string> = {
    Planificado: "planificado",
    "En Proceso": "activo",
    Pausado: "pausado",
    Completado: "cerrado",
    Cancelado: "cerrado",
  };
  return mapa[estado] as ProyectoUI["status"];
};

// Convierte una fila de la tabla `proyecto` al tipo que usa la UI
export const proyectoDesdeApi = (p: Proyecto): ProyectoUI => ({
  id: String(p.id_proyecto),
  code: `PRY-${p.id_proyecto}`,
  name: p.nombre_proyecto,
  kind: p.tipo_proyecto as ProyectoUI["kind"],
  status: mapearEstado(p.estado_proyecto),
  client: p.cliente ?? "",
  address: p.direccion ?? "",
  progress: Number(p.porcentaje_avance ?? 0),
  technicianRuts: [], // el backend ya filtra por técnico autenticado
  budgetMaterials: Number(p.presupuesto_inicial ?? 0),
  budgetHours: Number(p.presupuesto_horas ?? 0),
  saleValue: Number(p.valor_venta ?? 0),
  budget: Number(p.presupuesto_inicial ?? 0),
  costReal: 0,
  startDate: p.fecha_inicio ?? "",
  deadline: p.fecha_fin ?? "",
});