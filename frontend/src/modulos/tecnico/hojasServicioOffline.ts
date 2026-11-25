// Persistencia inmediata en disco local (a prueba de cierres inesperados de la app)
// y subida automática al recuperar internet para Hojas de Servicio y Checklists.
import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import { encabezadosAuth, obtenerUrlsCandidatasApi } from "@/nucleo/sesion";
import {
  FotoHojaServicio,
  HojaServicio,
  ItemListaChequeoServicio,
} from "@/nucleo/tipos";

export interface BorradorHojaServicio {
  proyectoId: string;
  receptor: string;
  notas: string;
  checklist: ItemListaChequeoServicio[];
  fotos: FotoHojaServicio[];
  actualizadoEn: string;
}

export interface EstadoDiscoHojasServicio {
  hojasLocales: HojaServicio[];
  borrador: BorradorHojaServicio | null;
}

const TIEMPO_LIMITE_RED_MS = 3500;

export const CHECKLIST_BASE_FAENA: ItemListaChequeoServicio[] = [
  {
    id: "c1",
    label: "Verificación de aislamiento eléctrico y continuidad de fases",
    completed: false,
  },
  {
    id: "c2",
    label: "Prueba de hermeticidad y estanqueidad hidrostática/nitrógeno",
    completed: false,
  },
  {
    id: "c3",
    label: "Verificación de presiones, parámetros operativos y tableros",
    completed: false,
  },
  {
    id: "c4",
    label: "Inspección de anclajes mecánicos y soportes antivibratorios",
    completed: false,
  },
  {
    id: "c5",
    label: "Limpieza del área intervenida y retiro de excedentes de obra",
    completed: false,
  },
];

const construirClaveDiscoHojas = (identificadorUsuario: string): string => {
  const limpio = (identificadorUsuario || "tecnico").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `hojas_servicio_disco_${limpio}`;
};

/**
 * Formatea una marca ISO a formato legible chileno (dd-mm-aaaa HH:mm h).
 */
export const formatearMarcaDiscoHojas = (iso: string | null): string => {
  if (!iso) return "Sin respaldo previo";
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
 * Escribe de forma inmediata en disco local (expo-file-system / localStorage)
 * las hojas emitidas offline y el borrador en curso (checklist + fotos).
 */
export const guardarEstadoDiscoHojas = async (
  identificadorUsuario: string,
  estado: EstadoDiscoHojasServicio
): Promise<string> => {
  const registro = await guardarCache<EstadoDiscoHojasServicio>(
    construirClaveDiscoHojas(identificadorUsuario),
    estado
  );
  return registro.guardadoEn;
};

/**
 * Recupera desde disco local las hojas pendientes y cualquier borrador en curso
 * tras un cierre inesperado o reinicio de la aplicación sin conexión.
 */
export const leerEstadoDiscoHojas = async (
  identificadorUsuario: string
): Promise<{ estado: EstadoDiscoHojasServicio; guardadoEn: string } | null> => {
  const registro = await leerCache<EstadoDiscoHojasServicio>(
    construirClaveDiscoHojas(identificadorUsuario)
  );
  if (!registro || !registro.datos) return null;
  return {
    estado: {
      hojasLocales: Array.isArray(registro.datos.hojasLocales)
        ? registro.datos.hojasLocales
        : [],
      borrador: registro.datos.borrador ?? null,
    },
    guardadoEn: registro.guardadoEn,
  };
};

/**
 * Verifica conectividad real con el backend para disparar la subida automática
 * de hojas de servicio pendientes.
 */
export const verificarConexionSubidaHojas = async (
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
