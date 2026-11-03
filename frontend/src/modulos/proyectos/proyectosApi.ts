// proyectosApi.ts
// Ajusta BASE_URL y la ruta según tu servidor.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";
const RUTA = `${BASE_URL}/proyectos`;

// Valores tomados del controlador (valores por defecto).
// Completa con los valores exactos del ENUM de la BD.
export const TIPOS_PROYECTO = ["Instalacion"] as const;
export const ESTADOS_PROYECTO = ["Planificado"] as const;

export type TipoProyecto = (typeof TIPOS_PROYECTO)[number];
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

/** Forma exacta de una fila de la tabla `proyecto`. */
export interface Proyecto {
  id_proyecto: number;
  nombre_proyecto: string;
  tipo_proyecto: TipoProyecto;
  cliente: string | null;
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
export type FormularioProyecto = Omit<Proyecto, "id_proyecto">;

export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(url: string, opciones?: RequestInit): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
    const json = await res.json();
    if (!res.ok) {
      // El controlador responde { mensaje } o { error }
      return { ok: false, error: json.mensaje ?? json.error ?? "Error en el servidor" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

export const listarProyectos = () => peticion<Proyecto[]>(RUTA);

export const obtenerProyecto = (id: number) => peticion<Proyecto>(`${RUTA}/${id}`);

export const crearProyecto = (datos: FormularioProyecto) =>
  peticion<{ mensaje: string; proyecto: Proyecto }>(RUTA, {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const actualizarProyecto = (id: number, datos: FormularioProyecto) =>
  peticion<{ mensaje: string; proyecto: Proyecto }>(`${RUTA}/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const eliminarProyecto = (id: number) =>
  peticion<{ mensaje: string; proyectoEliminado: Proyecto }>(`${RUTA}/${id}`, {
    method: "DELETE",
  });


  export interface Tecnico {
  id_usuario: number;
  nombre: string;
}

export const listarTecnicos = () =>
  peticion<Tecnico[]>(`${RUTA}/tecnicos`);

export const listarTecnicosDeProyecto = (idProyecto: number) =>
  peticion<Tecnico[]>(`${RUTA}/${idProyecto}/tecnicos`);

export const asignarTecnico = (idProyecto: number, idUsuario: number) =>
  peticion<{ mensaje: string }>(`${RUTA}/${idProyecto}/tecnicos`, {
    method: "POST",
    body: JSON.stringify({ id_usuario: idUsuario }),
  });

export const quitarTecnico = (idProyecto: number, idUsuario: number) =>
  peticion<{ mensaje: string }>(`${RUTA}/${idProyecto}/tecnicos/${idUsuario}`, {
    method: "DELETE",
  });