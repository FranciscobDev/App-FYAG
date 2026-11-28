// kitsApi.ts
import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";
import { KitProyecto, ItemKitProyecto, Producto } from "@/nucleo/tipos";
import { PRODUCTOS } from "@/datos/datosSimulados";

const obtenerRuta = () => `${obtenerBaseUrlApi()}/kits`;

export interface ItemFormularioKit {
  id_articulo: number;
  nombre_articulo: string;
  sku?: string | null;
  precio_unitario: number;
  cantidad_requerida_kit: number;
  subtotal?: number;
}

export interface FormularioKit {
  nombre_kit: string;
  descripcion_kit?: string | null;
  categoria?: string | null;
  disponible_kit?: number;
  items: ItemFormularioKit[];
}

export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ArticuloDisponible {
  id_articulo: number;
  nombre_articulo: string;
  sku: string | null;
  precio_unitario: number;
  categoria: string;
}

// Kits predeterminados simulados en memoria (garantizan disponibilidad ante modo offline)
let kitsEnMemoria: KitProyecto[] = [
  {
    id_kit_proyecto: 1,
    nombre_kit: "Kit Instalación Climatización Split 18.000 BTU",
    descripcion_kit: "Insumos base para montaje de unidad interior/exterior, tuberías de cobre y refrigerante R410A",
    categoria: "Climatización",
    disponible_kit: 5,
    costo_total: 485200,
    total_articulos: 4,
    items: [
      {
        id_detalle_kit: 1,
        id_articulo: 1,
        nombre_articulo: "Tubo de cobre 1/2 pulgada (tira 3 m)",
        sku: "TUB-COB-0012",
        precio_unitario: 14850,
        cantidad_requerida_kit: 4,
        subtotal: 59400,
      },
      {
        id_detalle_kit: 2,
        id_articulo: 2,
        nombre_articulo: "Gas refrigerante R410A 11,3 kg",
        sku: "CLI-GAS-R410",
        precio_unitario: 128500,
        cantidad_requerida_kit: 2,
        subtotal: 257000,
      },
      {
        id_detalle_kit: 3,
        id_articulo: 3,
        nombre_articulo: "Cable THHN 12 AWG rollo 100 m",
        sku: "ELE-CBL-0012",
        precio_unitario: 63500,
        cantidad_requerida_kit: 1,
        subtotal: 63500,
      },
      {
        id_detalle_kit: 4,
        id_articulo: 4,
        nombre_articulo: "Perno anclaje 8 mm x 80 (caja 50)",
        sku: "FER-PER-0008",
        precio_unitario: 8900,
        cantidad_requerida_kit: 3,
        subtotal: 26700,
      },
    ],
  },
  {
    id_kit_proyecto: 2,
    nombre_kit: "Kit Montaje Tablero Eléctrico Trifásico",
    descripcion_kit: "Disyuntores, cableado THHN y protecciones diferenciales para faenas industriales",
    categoria: "Eléctrico",
    disponible_kit: 3,
    costo_total: 398000,
    total_articulos: 3,
    items: [
      {
        id_detalle_kit: 5,
        id_articulo: 5,
        nombre_articulo: "Disyuntor termomagnético 16 A",
        sku: "ELE-DIS-0016",
        precio_unitario: 4200,
        cantidad_requerida_kit: 10,
        subtotal: 42000,
      },
      {
        id_detalle_kit: 6,
        id_articulo: 3,
        nombre_articulo: "Cable THHN 12 AWG rollo 100 m",
        sku: "ELE-CBL-0012",
        precio_unitario: 63500,
        cantidad_requerida_kit: 4,
        subtotal: 254000,
      },
      {
        id_detalle_kit: 7,
        id_articulo: 4,
        nombre_articulo: "Perno anclaje 8 mm x 80 (caja 50)",
        sku: "FER-PER-0008",
        precio_unitario: 8900,
        cantidad_requerida_kit: 2,
        subtotal: 17800,
      },
    ],
  },
  {
    id_kit_proyecto: 3,
    nombre_kit: "Kit Mantención Preventiva Compresores",
    descripcion_kit: "Aceite sintético POE 68, sellos y elementos de seguridad para mantenciones mayores",
    categoria: "Materiales",
    disponible_kit: 8,
    costo_total: 184500,
    total_articulos: 2,
    items: [
      {
        id_detalle_kit: 8,
        id_articulo: 6,
        nombre_articulo: "Aceite lubricante compresor POE 68",
        sku: "CHE-LUB-0005",
        precio_unitario: 29500,
        cantidad_requerida_kit: 4,
        subtotal: 118000,
      },
      {
        id_detalle_kit: 9,
        id_articulo: 7,
        nombre_articulo: "Casco de seguridad blanco",
        sku: "EPP-CAS-0001",
        precio_unitario: 5490,
        cantidad_requerida_kit: 4,
        subtotal: 21960,
      },
    ],
  },
];

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
  } catch (err) {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

export const listarKits = async (): Promise<Resultado<KitProyecto[]>> => {
  const res = await peticion<KitProyecto[]>(obtenerRuta());
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    // Si la BD devolvió kits, actualizamos memoria
    kitsEnMemoria = res.data;
    return res;
  }
  // Si la BD está vacía o dio error de conexión, usamos kits en memoria
  return { ok: true, data: [...kitsEnMemoria] };
};

export const obtenerKit = async (id: number): Promise<Resultado<KitProyecto>> => {
  const res = await peticion<KitProyecto>(`${obtenerRuta()}/${id}`);
  if (res.ok && res.data) {
    return res;
  }
  const encontrado = kitsEnMemoria.find((k) => k.id_kit_proyecto === id);
  if (encontrado) {
    return { ok: true, data: encontrado };
  }
  return { ok: false, error: "Kit no encontrado" };
};

export const crearKit = async (
  datos: FormularioKit
): Promise<Resultado<{ mensaje: string; kit: KitProyecto }>> => {
  const payloadBackend = {
    nombre_kit: datos.nombre_kit,
    descripcion_kit: datos.descripcion_kit,
    categoria: datos.categoria,
    disponible_kit: datos.disponible_kit ?? 0,
    items: datos.items.map((it) => ({
      id_articulo: it.id_articulo,
      cantidad_requerida_kit: it.cantidad_requerida_kit,
    })),
  };

  const res = await peticion<{ mensaje: string; kit: KitProyecto }>(obtenerRuta(), {
    method: "POST",
    body: JSON.stringify(payloadBackend),
  });

  const totalCalculado = datos.items.reduce(
    (acc, it) => acc + (it.cantidad_requerida_kit * it.precio_unitario),
    0
  );

  const nuevoEnMemoria: KitProyecto = {
    id_kit_proyecto: res.ok && res.data?.kit ? res.data.kit.id_kit_proyecto : Date.now(),
    nombre_kit: datos.nombre_kit,
    descripcion_kit: datos.descripcion_kit || "",
    categoria: datos.categoria || "Materiales",
    disponible_kit: datos.disponible_kit ?? 1,
    costo_total: Math.round(totalCalculado),
    total_articulos: datos.items.length,
    items: datos.items.map((it, idx) => ({
      id_detalle_kit: idx + 1,
      id_articulo: it.id_articulo,
      nombre_articulo: it.nombre_articulo,
      sku: it.sku,
      precio_unitario: it.precio_unitario,
      cantidad_requerida_kit: it.cantidad_requerida_kit,
      subtotal: Math.round(it.cantidad_requerida_kit * it.precio_unitario),
    })),
  };

  kitsEnMemoria = [nuevoEnMemoria, ...kitsEnMemoria];

  if (res.ok && res.data) {
    return res;
  }

  return {
    ok: true,
    data: {
      mensaje: "Kit predeterminado creado exitosamente",
      kit: nuevoEnMemoria,
    },
  };
};

export const actualizarKit = async (
  id: number,
  datos: FormularioKit
): Promise<Resultado<{ mensaje: string; kit: KitProyecto }>> => {
  const payloadBackend = {
    nombre_kit: datos.nombre_kit,
    descripcion_kit: datos.descripcion_kit,
    categoria: datos.categoria,
    disponible_kit: datos.disponible_kit ?? 0,
    items: datos.items.map((it) => ({
      id_articulo: it.id_articulo,
      cantidad_requerida_kit: it.cantidad_requerida_kit,
    })),
  };

  const res = await peticion<{ mensaje: string; kit: KitProyecto }>(`${obtenerRuta()}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payloadBackend),
  });

  const totalCalculado = datos.items.reduce(
    (acc, it) => acc + (it.cantidad_requerida_kit * it.precio_unitario),
    0
  );

  const kitActualizado: KitProyecto = {
    id_kit_proyecto: id,
    nombre_kit: datos.nombre_kit,
    descripcion_kit: datos.descripcion_kit || "",
    categoria: datos.categoria || "Materiales",
    disponible_kit: datos.disponible_kit ?? 1,
    costo_total: Math.round(totalCalculado),
    total_articulos: datos.items.length,
    items: datos.items.map((it, idx) => ({
      id_detalle_kit: idx + 1,
      id_articulo: it.id_articulo,
      nombre_articulo: it.nombre_articulo,
      sku: it.sku,
      precio_unitario: it.precio_unitario,
      cantidad_requerida_kit: it.cantidad_requerida_kit,
      subtotal: Math.round(it.cantidad_requerida_kit * it.precio_unitario),
    })),
  };

  kitsEnMemoria = kitsEnMemoria.map((k) => (k.id_kit_proyecto === id ? kitActualizado : k));

  if (res.ok && res.data) {
    return res;
  }

  return {
    ok: true,
    data: {
      mensaje: "Kit predeterminado actualizado exitosamente",
      kit: kitActualizado,
    },
  };
};

export const eliminarKit = async (id: number): Promise<Resultado<{ mensaje: string }>> => {
  const res = await peticion<{ mensaje: string }>(`${obtenerRuta()}/${id}`, {
    method: "DELETE",
  });

  kitsEnMemoria = kitsEnMemoria.filter((k) => k.id_kit_proyecto !== id);

  if (res.ok && res.data) {
    return res;
  }

  return { ok: true, data: { mensaje: "Kit eliminado correctamente" } };
};

// Obtiene la lista de artículos para que el administrador los agregue a un kit
export const listarArticulosParaKit = async (): Promise<ArticuloDisponible[]> => {
  try {
    const res = await peticion<ArticuloDisponible[]>(`${obtenerBaseUrlApi()}/articulos`);
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // ignorar y usar productos iniciales
  }

  // Fallback con productos iniciales enriquecidos
  return PRODUCTOS.map((p: Producto, idx: number) => ({
    id_articulo: idx + 1,
    nombre_articulo: p.name,
    sku: p.sku,
    precio_unitario: p.pmp ?? p.unitCost ?? 5000,
    categoria: p.category,
  }));
};
