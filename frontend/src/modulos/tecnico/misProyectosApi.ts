import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import {
  encabezadosAuth,
  fijarBaseUrlApi,
  obtenerUrlsCandidatasApi,
} from "@/nucleo/sesion";
import { EstadoProyecto, Proyecto, TipoProyecto } from "@/nucleo/tipos";

/** Estructura devuelta por GET /api/proyectos en el servidor */
interface ProyectoServidor {
  id_proyecto: number;
  nombre_proyecto: string;
  tipo_proyecto: string;
  cliente: string | null;
  direccion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  presupuesto_inicial: number | string;
  presupuesto_horas: number | string;
  valor_venta: number | string;
  porcentaje_avance: number | string;
  estado_proyecto: string;
  id_usuario: number | null;
}

export interface ResultadoMisProyectos {
  proyectos: Proyecto[];
  origen: "red" | "cache";
  guardadoEn: string | null;
  sinConexion: boolean;
}

const TIEMPO_LIMITE_MS = 4500;

const construirClaveCache = (identificadorUsuario: string): string => {
  const limpio = (identificadorUsuario || "tecnico").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mis_proyectos_${limpio}`;
};

/**
 * Normaliza el estado proveniente de la base de datos al tipo EstadoProyecto del frontend.
 * Soporta tanto (Planificado, Activo, Cerrado) como (En Proceso, Pausado, Completado, Cancelado).
 */
export const normalizarEstadoProyecto = (estadoCrudo?: string | null): EstadoProyecto => {
  const valor = (estadoCrudo ?? "").trim().toLowerCase();
  if (valor === "planificado") return "planificado";
  if (valor === "pausado") return "pausado";
  if (valor === "en proceso" || valor === "en_proceso" || valor === "en curso" || valor === "en_curso") {
    return "activo";
  }
  if (valor === "activo") return "activo";
  if (
    valor === "cerrado" ||
    valor === "completado" ||
    valor === "finalizado" ||
    valor === "cancelado"
  ) {
    return "cerrado";
  }
  return "planificado";
};

/**
 * Normaliza el tipo de proyecto del servidor ("Instalacion" | "Mantencion") a ("obra" | "mantencion").
 */
const normalizarTipoProyecto = (tipoCrudo?: string | null): TipoProyecto => {
  const valor = (tipoCrudo ?? "").trim().toLowerCase();
  if (valor.includes("manten")) return "mantencion";
  return "obra";
};

/**
 * Convierte una fila de la tabla `proyecto` del backend al modelo `Proyecto` utilizado en la vista móvil.
 */
const mapearProyectoServidor = (
  fila: ProyectoServidor,
  rutTecnicoActual: string,
  existentes: Proyecto[]
): Proyecto => {
  const idStr = String(fila.id_proyecto);
  const coincidenciaLocal = existentes.find(
    (p) =>
      p.id === idStr ||
      p.name.trim().toLowerCase() === (fila.nombre_proyecto ?? "").trim().toLowerCase()
  );

  const tipo = normalizarTipoProyecto(fila.tipo_proyecto);
  const prefijoCodigo = tipo === "mantencion" ? "MT" : "OB";
  const anio = (fila.fecha_inicio ?? new Date().toISOString()).slice(0, 4);
  const codigoGenerado = `${prefijoCodigo}-${anio}-${String(fila.id_proyecto).padStart(3, "0")}`;

  const presupuestoInicial = Number(fila.presupuesto_inicial) || 0;
  const presupuestoHoras = Number(fila.presupuesto_horas) || 0;
  const valorVenta = Number(fila.valor_venta) || 0;
  const avance = Math.max(0, Math.min(100, Number(fila.porcentaje_avance) || 0));

  return {
    id: coincidenciaLocal?.id ?? idStr,
    code: coincidenciaLocal?.code ?? codigoGenerado,
    name: fila.nombre_proyecto || "Proyecto sin título",
    kind: tipo,
    status: normalizarEstadoProyecto(fila.estado_proyecto),
    client: fila.cliente || coincidenciaLocal?.client || "Cliente directo FYAG",
    address: fila.direccion || coincidenciaLocal?.address || "Ubicación en terreno por confirmar",
    progress: avance,
    technicianRuts:
      coincidenciaLocal?.technicianRuts && coincidenciaLocal.technicianRuts.length > 0
        ? coincidenciaLocal.technicianRuts
        : rutTecnicoActual
        ? [rutTecnicoActual]
        : [],
    budgetMaterials: coincidenciaLocal?.budgetMaterials ?? presupuestoInicial,
    budgetHours: presupuestoHoras,
    hourlyRate: coincidenciaLocal?.hourlyRate ?? 18500,
    saleValue: valorVenta,
    budget: presupuestoInicial,
    costReal: coincidenciaLocal?.costReal ?? valorVenta,
    startDate: fila.fecha_inicio ?? coincidenciaLocal?.startDate ?? new Date().toISOString().slice(0, 10),
    // Si el proyecto en BD no tiene fecha_fin asignada, se deja cadena vacía para ubicarlo al final del orden
    deadline: fila.fecha_fin ?? coincidenciaLocal?.deadline ?? "",
    dispatches: coincidenciaLocal?.dispatches ?? [],
    laborEntries: coincidenciaLocal?.laborEntries ?? [],
    wasteEntries: coincidenciaLocal?.wasteEntries ?? [],
  };
};

/**
 * Realiza una petición GET con tiempo límite para detectar desconexión o modo avión sin bloquear la pantalla.
 */
async function consultarServidorConLimite(url: string): Promise<ProyectoServidor[] | null> {
  const controlador = typeof AbortController !== "undefined" ? new AbortController() : null;
  const temporizador = controlador
    ? setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS)
    : null;

  try {
    const respuesta = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...encabezadosAuth(),
      },
      signal: controlador?.signal,
    });

    if (!respuesta.ok) {
      return null;
    }

    const datos = await respuesta.json();
    return Array.isArray(datos) ? (datos as ProyectoServidor[]) : null;
  } catch {
    return null;
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

/**
 * Lee directamente los proyectos guardados en la caché local del dispositivo para este técnico.
 */
export async function leerMisProyectosCacheLocal(
  identificadorUsuario: string
): Promise<{ proyectos: Proyecto[]; guardadoEn: string } | null> {
  const clave = construirClaveCache(identificadorUsuario);
  const registro = await leerCache<Proyecto[]>(clave);
  if (!registro || !Array.isArray(registro.datos)) {
    return null;
  }
  return {
    proyectos: registro.datos,
    guardadoEn: registro.guardadoEn,
  };
}

/**
 * Guarda explícitamente la lista de proyectos del técnico en la caché local del dispositivo.
 */
export async function guardarMisProyectosCacheLocal(
  identificadorUsuario: string,
  proyectos: Proyecto[]
): Promise<string> {
  const clave = construirClaveCache(identificadorUsuario);
  const registro = await guardarCache<Proyecto[]>(clave, proyectos);
  return registro.guardadoEn;
}

/**
 * Obtiene la lista de proyectos asignados al técnico:
 * - Si está en modo avión / sin conexión o si falla la red, devuelve la lista guardada en la caché local sin errores.
 * - Si hay conexión con el servidor, actualiza la caché local y devuelve los datos frescos.
 * - Si aún no hay datos en el servidor, asegura que la caché local tenga los proyectos asignados al técnico.
 */
export async function obtenerMisProyectosConCache(opciones: {
  identificadorUsuario: string;
  rutTecnico: string;
  proyectosContexto: Proyecto[];
  forzarSinConexion?: boolean;
}): Promise<ResultadoMisProyectos> {
  const {
    identificadorUsuario,
    rutTecnico,
    proyectosContexto,
    forzarSinConexion = false,
  } = opciones;

  const clave = construirClaveCache(identificadorUsuario);

  // Proyectos asignados en el contexto como respaldo inicial si aún no se han creado en BD
  const respaldoAsignados = proyectosContexto.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(rutTecnico) || p.technicianRuts.length === 0)
  );

  // 1. Si se activa modo avión / modo offline, leer directamente desde la caché local del dispositivo
  if (forzarSinConexion) {
    const enCache = await leerCache<Proyecto[]>(clave);
    if (enCache && Array.isArray(enCache.datos) && enCache.datos.length > 0) {
      return {
        proyectos: enCache.datos,
        origen: "cache",
        guardadoEn: enCache.guardadoEn,
        sinConexion: true,
      };
    }

    // Si se activó modo avión sin haber sincronizado antes, guardamos y entregamos el respaldo local
    const guardado = await guardarCache<Proyecto[]>(clave, respaldoAsignados);
    return {
      proyectos: guardado.datos,
      origen: "cache",
      guardadoEn: guardado.guardadoEn,
      sinConexion: true,
    };
  }

  // 2. Intentar consultar al servidor probando las URLs candidatas configuradas
  const urlsCandidatas = obtenerUrlsCandidatasApi();
  for (const baseUrl of urlsCandidatas) {
    const filas = await consultarServidorConLimite(`${baseUrl}/proyectos`);
    if (filas !== null) {
      fijarBaseUrlApi(baseUrl);

      // Si el servidor devolvió proyectos asignados, los mapeamos y guardamos en caché local
      if (filas.length > 0) {
        const proyectosMapeados = filas.map((f) =>
          mapearProyectoServidor(f, rutTecnico, proyectosContexto)
        );
        const guardado = await guardarCache<Proyecto[]>(clave, proyectosMapeados);
        return {
          proyectos: proyectosMapeados,
          origen: "red",
          guardadoEn: guardado.guardadoEn,
          sinConexion: false,
        };
      }

      // Si la tabla en BD aún no tiene filas asignadas para este técnico, sincronizamos los del contexto en caché
      const guardado = await guardarCache<Proyecto[]>(clave, respaldoAsignados);
      return {
        proyectos: respaldoAsignados,
        origen: "red",
        guardadoEn: guardado.guardadoEn,
        sinConexion: false,
      };
    }
  }

  // 3. No hubo respuesta de red (modo avión real en el celular o servidor apagado):
  // cargamos desde la caché local guardada en el dispositivo sin arrojar errores
  const enCache = await leerCache<Proyecto[]>(clave);
  if (enCache && Array.isArray(enCache.datos) && enCache.datos.length > 0) {
    return {
      proyectos: enCache.datos,
      origen: "cache",
      guardadoEn: enCache.guardadoEn,
      sinConexion: true,
    };
  }

  // Si nunca hubo caché previa y no hay red, persistimos el respaldo local para no fallar
  const guardadoRespaldo = await guardarCache<Proyecto[]>(clave, respaldoAsignados);
  return {
    proyectos: guardadoRespaldo.datos,
    origen: "cache",
    guardadoEn: guardadoRespaldo.guardadoEn,
    sinConexion: true,
  };
}
