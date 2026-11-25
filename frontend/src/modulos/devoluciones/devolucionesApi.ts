import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";

/** Fila del sobrante real por insumo, calculada por el servidor (GET /api/devoluciones/sobrante). */
export interface SobranteInsumoServidor {
  id_articulo: number;
  sku: string;
  nombre_articulo: string;
  unidad: string;
  cantidad_retirada: number;
  cantidad_utilizada: number;
  cantidad_devuelta_previa: number;
  cantidad_maxima_devolvible: number;
}

export interface LineaDevolucionServidor {
  sku: string | null;
  nombre_articulo: string;
  unidad: string;
  cantidad_retirada: number;
  cantidad_utilizada: number;
  cantidad_declarada: number;
  cantidad_recibida: number | null;
}

/** Devolución propia del técnico (GET /api/devoluciones). */
export interface DevolucionServidor {
  id_devolucion: number;
  codigo_devolucion: string | null;
  proyecto_id: number;
  nombre_proyecto: string;
  codigo_proyecto: string | null;
  estado: "En tránsito" | "Recibida";
  tecnico_nombre: string;
  tecnico_rut: string;
  fecha_declaracion: string;
  lineas: LineaDevolucionServidor[];
}

export interface ResultadoDevolucion<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(ruta: string, opciones?: RequestInit): Promise<ResultadoDevolucion<T>> {
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
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

export const obtenerSobranteProyecto = (idProyecto: string) =>
  peticion<{ id_proyecto: number; items: SobranteInsumoServidor[] }>(
    `/devoluciones/sobrante?id_proyecto=${encodeURIComponent(idProyecto)}`
  );

export const listarMisDevoluciones = () => peticion<DevolucionServidor[]>("/devoluciones");

export const declararDevolucionTecnico = (
  idProyecto: string,
  items: { id_articulo: number; cantidad_declarada: number }[]
) =>
  peticion<{ mensaje: string; devolucion: { codigo_devolucion: string; estado: string } }>("/devoluciones", {
    method: "POST",
    body: JSON.stringify({ id_proyecto: Number(idProyecto), items }),
  });
