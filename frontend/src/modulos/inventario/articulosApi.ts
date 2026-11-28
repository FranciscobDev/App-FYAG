import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import type { Producto } from "@/nucleo/tipos";

/** Fila que devuelve GET /api/articulos (artículo + stock). */
export interface ArticuloApi {
  id_articulo: number;
  nombre_articulo: string;
  sku: string | null;
  precio_unitario: number;
  categoria: string;
  id_proveedor: number | null;
  activo: boolean;
  cantidad_disponible: number | null;
  stock_minimo: number | null;
  ubicacion: string | null;
}

interface RespuestaApi {
  ok: boolean;
  json: any;
}

const pedir = async (metodo: "GET" | "POST" | "PUT", ruta: string, cuerpo?: unknown): Promise<RespuestaApi> => {
  const res = await fetch(`${obtenerBaseUrlApi()}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...encabezadosAuth() },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
};

const MENSAJE_CONEXION = "No se pudo conectar con el servidor. Intenta nuevamente.";

export const listarArticulosApi = async (): Promise<ArticuloApi[] | null> => {
  try {
    const r = await pedir("GET", "/articulos");
    return r.ok && Array.isArray(r.json) ? (r.json as ArticuloApi[]) : null;
  } catch {
    return null;
  }
};

export const crearArticuloApi = async (
  cuerpo: Record<string, unknown>
): Promise<{ ok: true; articulo: ArticuloApi } | { ok: false; mensaje: string }> => {
  try {
    const r = await pedir("POST", "/articulos", cuerpo);
    return r.ok ? { ok: true, articulo: r.json.articulo } : { ok: false, mensaje: r.json.mensaje ?? MENSAJE_CONEXION };
  } catch {
    return { ok: false, mensaje: MENSAJE_CONEXION };
  }
};

export const actualizarArticuloApi = async (
  id: number,
  cuerpo: Record<string, unknown>
): Promise<{ ok: true; articulo: ArticuloApi } | { ok: false; mensaje: string }> => {
  try {
    const r = await pedir("PUT", `/articulos/${id}`, cuerpo);
    return r.ok ? { ok: true, articulo: r.json.articulo } : { ok: false, mensaje: r.json.mensaje ?? MENSAJE_CONEXION };
  } catch {
    return { ok: false, mensaje: MENSAJE_CONEXION };
  }
};

/** Convierte una fila de la API al modelo de la pantalla. Los campos que la base no guarda quedan fuera. */
export const articuloAProducto = (a: ArticuloApi): Producto => ({
  id: a.id_articulo,
  sku: a.sku ?? "",
  name: a.nombre_articulo,
  category: a.categoria,
  unit: "un",
  stock: Number(a.cantidad_disponible ?? 0),
  minStock: Number(a.stock_minimo ?? 0),
  unitCost: a.precio_unitario,
  location: a.ubicacion ?? "",
  disabled: !a.activo,
});

/** Traduce solo los campos de la pantalla que existen en la base. El resto no se envía. */
export const productoACuerpoArticulo = (cambios: Partial<Producto>): Record<string, unknown> => {
  const cuerpo: Record<string, unknown> = {};
  if (cambios.sku !== undefined) cuerpo.sku = cambios.sku;
  if (cambios.name !== undefined) cuerpo.nombre_articulo = cambios.name;
  if (cambios.category !== undefined) cuerpo.categoria = cambios.category;
  if (cambios.unitCost !== undefined) cuerpo.precio_unitario = cambios.unitCost;
  if (cambios.stock !== undefined) cuerpo.stock = cambios.stock;
  if (cambios.minStock !== undefined) cuerpo.stock_minimo = cambios.minStock;
  if (cambios.location !== undefined) cuerpo.ubicacion = cambios.location;
  if (cambios.disabled !== undefined) cuerpo.activo = !cambios.disabled;
  return cuerpo;
};
