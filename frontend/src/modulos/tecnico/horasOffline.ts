// Utilidades de cronómetro automático, bloques de 0,5 h, ventana de edición (H41)
// y persistencia/sincronización offline de jornadas laborales del Técnico.
import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import { encabezadosAuth, obtenerUrlsCandidatasApi } from "@/nucleo/sesion";
import { HoraTrabajoTecnico, Rol, SesionTrabajoActiva } from "@/nucleo/tipos";

export interface EstadoCacheHorasTecnico {
  sesionActiva: SesionTrabajoActiva | null;
  horasOffline: HoraTrabajoTecnico[];
}

export interface EvaluacionVentanaEdicion {
  puedeEditar: boolean;
  vencido: boolean;
  horasTranscurridas: number;
  horasRestantes: number;
  plazoMaximoHoras: number;
  etiquetaEstado: string;
}

const TIEMPO_LIMITE_RED_MS = 3500;

const construirClaveCacheHoras = (identificadorUsuario: string): string => {
  const limpio = (identificadorUsuario || "tecnico").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `horas_trabajo_tecnico_${limpio}`;
};

/**
 * Redondea los segundos transcurridos del cronómetro al bloque normativo de 0,5 h
 * (mínimo 0,5 h y máximo 24,0 h por jornada).
 */
export const calcularBloqueMediaHora = (segundosTranscurridos: number): number => {
  const horasReales = Math.max(0, segundosTranscurridos) / 3600;
  const redondeado = Math.round(horasReales * 2) / 2;
  return Math.max(0.5, Math.min(24.0, redondeado));
};

/**
 * Evalúa si un registro de horas puede ser editado según la ventana permitida (por defecto 48 h)
 * y el rol del usuario autenticado.
 */
export const evaluarVentanaEdicionHoras = (
  createdAt: string,
  plazoMaximoHoras: number,
  rolActual: Rol,
  ahoraMs: number = Date.now()
): EvaluacionVentanaEdicion => {
  const creadoMs = new Date(createdAt).getTime();
  const horasTranscurridas = Number.isNaN(creadoMs)
    ? 0
    : Math.max(0, (ahoraMs - creadoMs) / (1000 * 60 * 60));
  const horasRestantes = Math.max(0, plazoMaximoHoras - horasTranscurridas);
  const vencido = horasTranscurridas > plazoMaximoHoras;
  const puedeEditar = rolActual === "admin" || !vencido;

  let etiquetaEstado = "";
  if (!vencido) {
    if (horasRestantes >= 1) {
      etiquetaEstado = `Editable (${Math.ceil(horasRestantes)} h restantes)`;
    } else {
      const minutosRestantes = Math.max(1, Math.ceil(horasRestantes * 60));
      etiquetaEstado = `Editable (${minutosRestantes} min restantes)`;
    }
  } else if (rolActual === "admin") {
    etiquetaEstado = `Plazo ${plazoMaximoHoras} h vencido (habilitado Admin)`;
  } else {
    etiquetaEstado = `Bloqueado (plazo de ${plazoMaximoHoras} h vencido)`;
  }

  return {
    puedeEditar,
    vencido,
    horasTranscurridas,
    horasRestantes,
    plazoMaximoHoras,
    etiquetaEstado,
  };
};

/**
 * Formatea una fecha ISO a formato legible chileno (dd-mm-aaaa HH:mm h).
 */
export const formatearMarcaHorasOffline = (iso: string | null): string => {
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
 * Guarda en el almacenamiento offline la sesión activa del cronómetro y los registros de horas.
 */
export const guardarEstadoHorasOffline = async (
  identificadorUsuario: string,
  estado: EstadoCacheHorasTecnico
): Promise<string> => {
  const registro = await guardarCache<EstadoCacheHorasTecnico>(
    construirClaveCacheHoras(identificadorUsuario),
    estado
  );
  return registro.guardadoEn;
};

/**
 * Lee el estado del cronómetro y horas guardadas localmente en el dispositivo.
 */
export const leerEstadoHorasOffline = async (
  identificadorUsuario: string
): Promise<{ estado: EstadoCacheHorasTecnico; guardadoEn: string } | null> => {
  const registro = await leerCache<EstadoCacheHorasTecnico>(
    construirClaveCacheHoras(identificadorUsuario)
  );
  if (!registro || !registro.datos) return null;
  return {
    estado: {
      sesionActiva: registro.datos.sesionActiva ?? null,
      horasOffline: Array.isArray(registro.datos.horasOffline)
        ? registro.datos.horasOffline
        : [],
    },
    guardadoEn: registro.guardadoEn,
  };
};

/**
 * Verifica si existe conectividad real con el backend para sincronizar jornadas pendientes.
 */
export const verificarConexionSincronizacionHoras = async (
  forzarSinConexion = false
): Promise<boolean> => {
  if (forzarSinConexion) return false;
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
