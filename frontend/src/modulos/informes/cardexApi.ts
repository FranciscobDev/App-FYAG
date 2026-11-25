import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import type { MovimientoCardex, Proyecto } from "@/nucleo/tipos";

/** Fila que devuelve GET /api/cardex. */
interface MovimientoCardexApi {
  id_movimiento: number;
  fecha_movimiento: string;
  tipo_movimiento: "Entrada" | "Salida" | "Ajuste" | "Transferencia";
  destino_bolsa: string;
  sku: string | null;
  insumo: string;
  cantidad: number;
  costo_unitario: number;
  saldo_historico: number;
  pmp_historico: number;
  valor_total_historico: number;
  id_proyecto: number | null;
  referencia: string | null;
}

// Tipos de la pantalla -> tipos del backend (los que no existen en backend no se filtran en servidor)
const TIPO_UI_A_API: Record<string, MovimientoCardexApi["tipo_movimiento"]> = {
  entrada_compra: "Entrada",
  salida_obra: "Salida",
  ajuste_conteo: "Ajuste",
};

const TIPO_API_A_UI: Record<MovimientoCardexApi["tipo_movimiento"], MovimientoCardex["type"]> = {
  Entrada: "entrada_compra",
  Salida: "salida_obra",
  Ajuste: "ajuste_conteo",
  Transferencia: "devolucion",
};

const ETIQUETA_TIPO: Record<MovimientoCardexApi["tipo_movimiento"], string> = {
  Entrada: "Entrada por compra",
  Salida: "Salida a obra",
  Ajuste: "Ajuste de conteo",
  Transferencia: "Transferencia",
};

const fechaIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Convierte los filtros de la pantalla en query string para /api/cardex. */
export const construirQueryCardex = (
  periodo: string,
  tipoUi: string,
  codigoProyecto: string,
  proyectos: Proyecto[]
): string => {
  const params = new URLSearchParams();
  const hoy = new Date();

  if (periodo === "7dias" || periodo === "30dias") {
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (periodo === "7dias" ? 7 : 30));
    params.set("fecha_desde", fechaIso(desde));
  } else if (periodo === "mes_actual") {
    params.set("fecha_desde", fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  }

  if (tipoUi !== "todos" && TIPO_UI_A_API[tipoUi]) {
    params.set("tipo_movimiento", TIPO_UI_A_API[tipoUi]);
  }

  if (codigoProyecto !== "todos") {
    const proyecto = proyectos.find((p) => p.code === codigoProyecto);
    if (proyecto) params.set("id_proyecto", String(Number(proyecto.id)));
  }

  return params.toString();
};

const aMovimientoUi = (m: MovimientoCardexApi, proyectos: Proyecto[]): MovimientoCardex => {
  const proyecto =
    m.id_proyecto != null ? proyectos.find((p) => Number(p.id) === m.id_proyecto) : undefined;
  const cantidad = Number(m.cantidad);
  const esEntrada = m.tipo_movimiento === "Entrada";

  return {
    id: String(m.id_movimiento),
    sku: m.sku ?? "",
    productName: m.insumo,
    date: m.fecha_movimiento,
    type: TIPO_API_A_UI[m.tipo_movimiento],
    typeLabel: ETIQUETA_TIPO[m.tipo_movimiento],
    reference: m.referencia ?? "",
    projectCode: proyecto?.code,
    projectName: proyecto?.name,
    qtyIn: esEntrada ? cantidad : 0,
    qtyOut: esEntrada ? 0 : cantidad,
    balance: Number(m.saldo_historico),
    pmp: Number(m.pmp_historico),
    totalValue: Number(m.valor_total_historico),
  };
};

/** Carga los movimientos reales del Cardex con los filtros indicados. */
export const obtenerCardexApi = async (query: string, proyectos: Proyecto[]): Promise<MovimientoCardex[]> => {
  const res = await fetch(`${obtenerBaseUrlApi()}/cardex?${query}`, { headers: encabezadosAuth() });
  const datos: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.mensaje || "No se pudo cargar el Cardex");
  return (datos.movimientos as MovimientoCardexApi[]).map((m) => aMovimientoUi(m, proyectos));
};

/** Descarga el Excel del Cardex con los mismos filtros (solo web). */
export const descargarCardexExcel = async (query: string): Promise<void> => {
  const params = new URLSearchParams(query);
  params.set("formato", "xlsx");
  const res = await fetch(`${obtenerBaseUrlApi()}/cardex?${params.toString()}`, { headers: encabezadosAuth() });
  if (!res.ok) throw new Error("No se pudo descargar el Excel del Cardex");

  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `cardex_${fechaIso(new Date())}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};
