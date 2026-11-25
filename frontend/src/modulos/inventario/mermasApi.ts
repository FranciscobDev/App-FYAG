import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import type { RegistroMerma } from "@/nucleo/tipos";

type MotivoPantalla = RegistroMerma["reason"];

const MOTIVO_A_API: Record<MotivoPantalla, string> = {
  daño: "dano",
  caducidad: "vencimiento",
  pérdida: "extravio",
  otro: "otro",
};

const MOTIVO_DESDE_API: Record<string, MotivoPantalla> = {
  dano: "daño",
  vencimiento: "caducidad",
  extravio: "pérdida",
  otro: "otro",
};

/** Fila que devuelve GET /api/mermas. */
interface MermaApi {
  id_merma: number;
  sku: string;
  insumo: string;
  cantidad_baja: number;
  precio_unitario: number;
  perdida_valor_total: number;
  motivo_merma: string;
  observacion_merma: string | null;
  fecha_merma: string;
  usuario: string | null;
}

const mensajeError = async (res: Response, porDefecto: string): Promise<string> => {
  const json: any = await res.json().catch(() => ({}));
  return json.mensaje || porDefecto;
};

/** Registra la merma en el servidor. Devuelve la pérdida valorizada al PMP. */
export const registrarMermaApi = async (datos: {
  id_articulo: number;
  cantidad: string;
  motivo: MotivoPantalla;
  observacion: string;
}): Promise<{ perdida: number }> => {
  const res = await fetch(`${obtenerBaseUrlApi()}/mermas`, {
    method: "POST",
    headers: { ...encabezadosAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      id_articulo: datos.id_articulo,
      cantidad_baja: datos.cantidad,
      motivo: MOTIVO_A_API[datos.motivo],
      observacion: datos.observacion,
    }),
  });
  if (!res.ok) throw new Error(await mensajeError(res, "No se pudo registrar la merma"));
  const json: any = await res.json();
  return { perdida: Number(json.perdida_valor_total) };
};

/** Historial real de mermas en el formato que usa la pantalla. */
export const listarMermasApi = async (): Promise<RegistroMerma[]> => {
  const res = await fetch(`${obtenerBaseUrlApi()}/mermas`, { headers: encabezadosAuth() });
  if (!res.ok) throw new Error(await mensajeError(res, "No se pudo cargar el historial de mermas"));
  const filas = (await res.json()) as MermaApi[];
  return filas.map((m) => ({
    id: String(m.id_merma),
    sku: m.sku,
    productName: m.insumo,
    quantity: Number(m.cantidad_baja),
    unit: "un",
    pmp: Number(m.precio_unitario),
    totalLoss: Number(m.perdida_valor_total),
    reason: MOTIVO_DESDE_API[m.motivo_merma] ?? "otro",
    observation: m.observacion_merma ?? "",
    date: m.fecha_merma,
    user: m.usuario ?? "",
  }));
};
