// Almacenamiento offline y sincronización de "Insumos de mis Proyectos" para la vista móvil del Técnico.
// Persiste los saldos asignados, retirados y pendientes por retirar de bodega en la caché local del dispositivo.
import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import { encabezadosAuth, obtenerUrlsCandidatasApi } from "@/nucleo/sesion";
import { Producto, Proyecto, SolicitudMaterial } from "@/nucleo/tipos";

export interface InsumoAsignadoProyecto {
  sku: string;
  name: string;
  unit: string;
  quantityAssigned: number;
  quantityRetrieved: number;
  quantityPending: number;
  fulfillmentPct: number;
  origen: "despacho" | "solicitud" | "mixto" | "planificado";
}

/** Insumo planificado del proyecto (GET /api/proyectos/insumos-asignados). */
export interface InsumoPlanificadoServidor {
  id_proyecto: number;
  id_articulo: number;
  sku: string | null;
  nombre_articulo: string;
  unidad: string;
  cantidad_asignada: number;
}

export interface SnapshotInsumosProyecto {
  proyecto: Proyecto;
  insumos: InsumoAsignadoProyecto[];
  solicitudes: SolicitudMaterial[];
  totalAsignado: number;
  totalRetirado: number;
  totalPendiente: number;
  porcentajeAbastecimiento: number;
}

export interface DatosCacheInsumosTecnico {
  proyectos: SnapshotInsumosProyecto[];
}

export interface ResultadoSincronizacionInsumos {
  proyectos: SnapshotInsumosProyecto[];
  origen: "red" | "cache";
  guardadoEn: string | null;
  sinConexion: boolean;
}

const TIEMPO_LIMITE_RED_MS = 3500;

const construirClaveCacheInsumos = (identificadorUsuario: string): string => {
  const limpio = (identificadorUsuario || "tecnico").replace(/[^a-zA-Z0-9_-]/g, "_");
  // v2: los saldos guardados antes de este cambio incluían solicitudes pendientes; se descartan.
  return `insumos_mis_proyectos_v2_${limpio}`;
};

/**
 * Formatea una marca de tiempo ISO a formato legible chileno (dd-mm-aaaa HH:mm h).
 */
export const formatearMarcaSincronizacion = (iso: string | null): string => {
  if (!iso) return "Sin sincronización previa";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia}-${mes}-${anio} ${horas}:${minutos} h`;
};

/**
 * Calcula los insumos asignados, retirados y pendientes por retirar de bodega para un proyecto,
 * combinando despachos históricos y solicitudes activas (pendientes, aprobadas o entregadas).
 */
export const calcularInsumosProyecto = (
  proyecto: Proyecto,
  productos: Producto[],
  solicitudesMaterial: SolicitudMaterial[],
  planificados: InsumoPlanificadoServidor[] = []
): InsumoAsignadoProyecto[] => {
  const mapaPorSku = new Map<
    string,
    {
      sku: string;
      name: string;
      unit: string;
      retiradoDespachos: number;
      solicitadoActivo: number;
      entregadoSolicitudes: number;
      cantidadPlanificada: number;
      tieneDespacho: boolean;
      tieneSolicitud: boolean;
      tienePlanificacion: boolean;
    }
  >();

  const obtenerOInicializar = (sku: string, name?: string, unit?: string) => {
    const clave = sku.trim().toUpperCase();
    const existente = mapaPorSku.get(clave);
    if (existente) return existente;
    const prod = productos.find((p) => p.sku.trim().toUpperCase() === clave);
    const nuevo = {
      sku: prod?.sku || sku,
      name: name || prod?.name || sku,
      unit: unit || prod?.unit || "un",
      retiradoDespachos: 0,
      solicitadoActivo: 0,
      entregadoSolicitudes: 0,
      cantidadPlanificada: 0,
      tieneDespacho: false,
      tieneSolicitud: false,
      tienePlanificacion: false,
    };
    mapaPorSku.set(clave, nuevo);
    return nuevo;
  };

  // 1. Sumar retiros registrados en despachos de bodega del proyecto
  (proyecto.dispatches || []).forEach((d) => {
    const entry = obtenerOInicializar(d.sku, d.productName, d.unit);
    entry.retiradoDespachos += Number(d.quantity || 0);
    entry.tieneDespacho = true;
  });

  // 1b. Insumos planificados del proyecto (kit o carga manual): aparecen aunque no existan solicitudes ni despachos
  planificados.forEach((pl) => {
    const entry = obtenerOInicializar(pl.sku || String(pl.id_articulo), pl.nombre_articulo, pl.unidad);
    entry.cantidadPlanificada += Number(pl.cantidad_asignada || 0);
    entry.tienePlanificacion = true;
  });

  // 2. Sumar solo solicitudes aprobadas o entregadas. Una solicitud pendiente aún no fue
  //    aprobada por bodega, así que no tiene material asignado ni pendiente por retirar.
  const solicitudesVigentes = solicitudesMaterial.filter(
    (s) =>
      s.projectId === proyecto.id &&
      (s.status === "aprobada" || s.status === "entregada")
  );

  solicitudesVigentes.forEach((sol) => {
    sol.items.forEach((it) => {
      const entry = obtenerOInicializar(it.sku, it.name, it.unit);
      entry.solicitadoActivo += Number(it.quantity || 0);
      entry.entregadoSolicitudes +=
        sol.status === "entregada"
          ? Number(it.deliveredQuantity ?? it.quantity ?? 0)
          : Number(it.deliveredQuantity ?? 0);
      entry.tieneSolicitud = true;
    });
  });

  const lista: InsumoAsignadoProyecto[] = [];

  mapaPorSku.forEach((entry) => {
    const retirado = Number(
      Math.max(entry.retiradoDespachos, entry.entregadoSolicitudes).toFixed(3)
    );

    let asignado = 0;
    if (entry.tienePlanificacion) {
      // Cantidad planificada para el proyecto, sin perder lo ya retirado o solicitado
      asignado = Math.max(retirado, entry.solicitadoActivo, entry.cantidadPlanificada);
    } else if (entry.tieneSolicitud && entry.tieneDespacho) {
      asignado = Math.max(retirado, entry.solicitadoActivo, Math.round(entry.retiradoDespachos * 1.25));
    } else if (entry.tieneSolicitud) {
      asignado = Math.max(retirado, entry.solicitadoActivo);
    } else {
      // Despachos históricos sin solicitud asociada: estimación de holgura asignada a faena
      asignado = Math.max(retirado, Math.round(retirado * 1.25));
    }

    asignado = Number(asignado.toFixed(3));
    const pendiente = Number(Math.max(0, asignado - retirado).toFixed(3));
    const fulfillmentPct =
      asignado > 0 ? Math.min(100, Math.round((retirado / asignado) * 100)) : 100;

    const origen: InsumoAsignadoProyecto["origen"] =
      entry.tienePlanificacion && !entry.tieneDespacho && !entry.tieneSolicitud
        ? "planificado"
        : entry.tieneDespacho && entry.tieneSolicitud
        ? "mixto"
        : entry.tieneSolicitud
        ? "solicitud"
        : "despacho";

    lista.push({
      sku: entry.sku,
      name: entry.name,
      unit: entry.unit,
      quantityAssigned: asignado,
      quantityRetrieved: retirado,
      quantityPending: pendiente,
      fulfillmentPct,
      origen,
    });
  });

  // Priorizar arriba los insumos que aún tienen material pendiente por retirar de bodega
  return lista.sort((a, b) => {
    if (b.quantityPending !== a.quantityPending) {
      return b.quantityPending - a.quantityPending;
    }
    return a.name.localeCompare(b.name);
  });
};

/**
 * Construye el listado consolidado de snapshots de insumos para los proyectos asignados al técnico.
 */
export const construirSnapshotsInsumosTecnico = (
  proyectos: Proyecto[],
  rutTecnico: string,
  productos: Producto[],
  solicitudesMaterial: SolicitudMaterial[],
  planificadosPorProyecto: Map<string, InsumoPlanificadoServidor[]> = new Map()
): SnapshotInsumosProyecto[] => {
  const proyectosActivos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      p.status !== "finalizado" &&
      (p.technicianRuts.includes(rutTecnico) || p.technicianRuts.length === 0)
  );

  return proyectosActivos.map((proyecto) => {
    const insumos = calcularInsumosProyecto(
      proyecto,
      productos,
      solicitudesMaterial,
      planificadosPorProyecto.get(proyecto.id) ?? []
    );
    const solicitudes = solicitudesMaterial.filter((s) => s.projectId === proyecto.id);
    const totalAsignado = Number(
      insumos.reduce((acc, i) => acc + i.quantityAssigned, 0).toFixed(3)
    );
    const totalRetirado = Number(
      insumos.reduce((acc, i) => acc + i.quantityRetrieved, 0).toFixed(3)
    );
    const totalPendiente = Number(
      insumos.reduce((acc, i) => acc + i.quantityPending, 0).toFixed(3)
    );
    const porcentajeAbastecimiento =
      totalAsignado > 0 ? Math.min(100, Math.round((totalRetirado / totalAsignado) * 100)) : 0;

    return {
      proyecto,
      insumos,
      solicitudes,
      totalAsignado,
      totalRetirado,
      totalPendiente,
      porcentajeAbastecimiento,
    };
  });
};

/**
 * Lee los insumos previamente respaldados en la caché local del dispositivo.
 */
export const leerInsumosProyectosCacheLocal = async (
  identificadorUsuario: string
): Promise<{ proyectos: SnapshotInsumosProyecto[]; guardadoEn: string } | null> => {
  const registro = await leerCache<DatosCacheInsumosTecnico>(
    construirClaveCacheInsumos(identificadorUsuario)
  );
  if (!registro || !Array.isArray(registro.datos?.proyectos)) {
    return null;
  }
  return {
    proyectos: registro.datos.proyectos,
    guardadoEn: registro.guardadoEn,
  };
};

/**
 * Guarda los snapshots de insumos del técnico en la caché local y devuelve la marca ISO de guardado.
 */
export const guardarInsumosProyectosCacheLocal = async (
  identificadorUsuario: string,
  proyectos: SnapshotInsumosProyecto[]
): Promise<string> => {
  const registro = await guardarCache<DatosCacheInsumosTecnico>(
    construirClaveCacheInsumos(identificadorUsuario),
    { proyectos }
  );
  return registro.guardadoEn;
};

/**
 * Obtiene los insumos planificados de todos los proyectos visibles para el técnico, agrupados por proyecto.
 * Devuelve null si el servidor no responde, para no sobrescribir la caché con datos incompletos.
 */
export const obtenerInsumosPlanificadosServidor = async (): Promise<
  Map<string, InsumoPlanificadoServidor[]> | null
> => {
  for (const baseUrl of obtenerUrlsCandidatasApi()) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_RED_MS);
    try {
      const res = await fetch(`${baseUrl}/proyectos/insumos-asignados`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...encabezadosAuth(),
        },
        signal: controlador.signal,
      });
      if (!res.ok) continue;
      const filas = await res.json();
      if (!Array.isArray(filas)) return null;
      const mapa = new Map<string, InsumoPlanificadoServidor[]>();
      for (const fila of filas as InsumoPlanificadoServidor[]) {
        const clave = String(fila.id_proyecto);
        mapa.set(clave, [...(mapa.get(clave) ?? []), fila]);
      }
      return mapa;
    } catch {
      // Intenta la siguiente URL candidata
    } finally {
      clearTimeout(temporizador);
    }
  }
  return null;
};

/**
 * Verifica conectividad real con el servidor backend (respetando modo avión / navegador offline).
 */
const verificarConectividadServidor = async (): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  const urls = obtenerUrlsCandidatasApi();
  for (const baseUrl of urls) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_RED_MS);
    try {
      const res = await fetch(`${baseUrl}/proyectos`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...encabezadosAuth(),
        },
        signal: controlador.signal,
      });
      if (res.status < 500) {
        return true;
      }
    } catch {
      // Intenta la siguiente URL candidata
    } finally {
      clearTimeout(temporizador);
    }
  }
  return false;
};

/**
 * Sincroniza los insumos de los proyectos del técnico:
 * - Si hay conexión y no se fuerza modo offline: actualiza snapshots, guarda en caché local y retorna origen "red".
 * - Si no hay conexión o se activa modo offline: recupera los últimos datos guardados en caché local sin errores.
 */
export const sincronizarInsumosProyectosConCache = async (params: {
  identificadorUsuario: string;
  rutTecnico: string;
  proyectosContexto: Proyecto[];
  productosContexto: Producto[];
  solicitudesContexto: SolicitudMaterial[];
  forzarSinConexion?: boolean;
}): Promise<ResultadoSincronizacionInsumos> => {
  const {
    identificadorUsuario,
    rutTecnico,
    proyectosContexto,
    productosContexto,
    solicitudesContexto,
    forzarSinConexion = false,
  } = params;

  const claveCache = construirClaveCacheInsumos(identificadorUsuario);

  if (!forzarSinConexion) {
    const conectado = await verificarConectividadServidor();
    if (conectado) {
      const planificados = await obtenerInsumosPlanificadosServidor();
      // Si no se pudieron leer los insumos planificados, no se guarda una versión incompleta:
      // se usa la última copia local válida.
      if (planificados !== null) {
        const snapshots = construirSnapshotsInsumosTecnico(
          proyectosContexto,
          rutTecnico,
          productosContexto,
          solicitudesContexto,
          planificados
        );
        const guardadoEn = await guardarInsumosProyectosCacheLocal(
          identificadorUsuario,
          snapshots
        );
        return {
          proyectos: snapshots,
          origen: "red",
          guardadoEn,
          sinConexion: false,
        };
      }
    }
  }

  // Modo sin conexión: lee la última copia persistida en el dispositivo
  const cachePrevia = await leerCache<DatosCacheInsumosTecnico>(claveCache);
  if (cachePrevia && Array.isArray(cachePrevia.datos?.proyectos)) {
    return {
      proyectos: cachePrevia.datos.proyectos,
      origen: "cache",
      guardadoEn: cachePrevia.guardadoEn,
      sinConexion: true,
    };
  }

  // Primer uso sin caché previa: construye respaldo inicial desde contexto y lo guarda localmente
  const respaldoInicial = construirSnapshotsInsumosTecnico(
    proyectosContexto,
    rutTecnico,
    productosContexto,
    solicitudesContexto
  );
  const guardadoEn = await guardarInsumosProyectosCacheLocal(
    identificadorUsuario,
    respaldoInicial
  );
  return {
    proyectos: respaldoInicial,
    origen: "cache",
    guardadoEn,
    sinConexion: true,
  };
};