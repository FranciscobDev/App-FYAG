import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

export interface RegistroCache<T> {
  datos: T;
  guardadoEn: string;
}

// Almacenamiento en memoria como respaldo inmediato si el sistema de archivos no está disponible
const memoriaRespaldo = new Map<string, string>();

const PREFIJO_CACHE = "fyag_cache_";

const normalizarNombreArchivo = (clave: string): string => {
  const limpia = clave.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${PREFIJO_CACHE}${limpia}.json`;
};

/**
 * Guarda un valor serializado en JSON dentro de la caché local del dispositivo.
 * En móvil (Android / iOS) persiste en el directorio de documentos de Expo.
 * En navegador web utiliza localStorage.
 * Nunca lanza excepciones para garantizar operación continua en modo avión.
 */
export async function guardarCache<T>(
  clave: string,
  datos: T
): Promise<RegistroCache<T>> {
  const registro: RegistroCache<T> = {
    datos,
    guardadoEn: new Date().toISOString(),
  };
  const contenido = JSON.stringify(registro);
  const claveCompleta = `${PREFIJO_CACHE}${clave}`;

  memoriaRespaldo.set(claveCompleta, contenido);

  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(claveCompleta, contenido);
      }
    } catch {
      // Si el navegador bloquea localStorage, se conserva en memoriaRespaldo
    }
    return registro;
  }

  try {
    const archivo = new File(Paths.document, normalizarNombreArchivo(clave));
    await archivo.write(contenido);
  } catch {
    // Si falla la escritura en archivo nativo, se mantiene la copia en memoriaRespaldo
  }

  return registro;
}

/**
 * Lee un valor previamente guardado en la caché local del dispositivo.
 * Devuelve null si no existe copia guardada o si el contenido está corrupto.
 */
export async function leerCache<T>(
  clave: string
): Promise<RegistroCache<T> | null> {
  const claveCompleta = `${PREFIJO_CACHE}${clave}`;

  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const crudo = window.localStorage.getItem(claveCompleta);
        if (crudo) {
          return validarRegistroCache<T>(crudo);
        }
      }
    } catch {
      // Continúa al respaldo en memoria
    }
    const enMemoria = memoriaRespaldo.get(claveCompleta);
    return enMemoria ? validarRegistroCache<T>(enMemoria) : null;
  }

  try {
    const archivo = new File(Paths.document, normalizarNombreArchivo(clave));
    if (archivo.exists) {
      const crudo = await archivo.text();
      const validado = validarRegistroCache<T>(crudo);
      if (validado) {
        memoriaRespaldo.set(claveCompleta, crudo);
        return validado;
      }
    }
  } catch {
    // Si falla la lectura del sistema de archivos, se consulta el respaldo en memoria
  }

  const enMemoria = memoriaRespaldo.get(claveCompleta);
  return enMemoria ? validarRegistroCache<T>(enMemoria) : null;
}

/**
 * Valida que el texto JSON leído tenga la estructura esperada de RegistroCache.
 */
function validarRegistroCache<T>(crudo: string): RegistroCache<T> | null {
  try {
    const parseado = JSON.parse(crudo) as Partial<RegistroCache<T>>;
    if (
      parseado &&
      typeof parseado === "object" &&
      "datos" in parseado &&
      typeof parseado.guardadoEn === "string"
    ) {
      return {
        datos: parseado.datos as T,
        guardadoEn: parseado.guardadoEn,
      };
    }
  } catch {
    // Si el JSON está dañado, se ignora sin lanzar error
  }
  return null;
}
