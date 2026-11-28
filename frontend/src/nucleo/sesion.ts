import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

declare const process: any;

let tokenActual: string | null = null;
let urlBaseResuelta: string | null = null;

export const establecerToken = (token: string | null) => {
  tokenActual = token;
};

export const encabezadosAuth = (): Record<string, string> =>
  tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {};

export const fijarBaseUrlApi = (url: string) => {
  urlBaseResuelta = url;
};

const obtenerHostMetro = (): string | null => {
  try {
    const sourceCode =
      (TurboModuleRegistry?.get?.("SourceCode") as { getConstants?: () => { scriptURL?: string } } | null) ??
      NativeModules?.SourceCode;
    const scriptURL: string | undefined =
      sourceCode?.getConstants?.()?.scriptURL ?? (sourceCode as { scriptURL?: string })?.scriptURL;

    if (scriptURL) {
      const coincidencia = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?\//);
      const host = coincidencia?.[1];
      if (
        host &&
        host !== "localhost" &&
        host !== "127.0.0.1" &&
        host !== "192.168.56.1" &&
        !host.endsWith(".exp.direct") &&
        !host.endsWith(".ngrok.io")
      ) {
        return host;
      }
    }
  } catch {
    // Ignorar si no está disponible
  }
  return null;
};

/**
 * Lista de URLs candidatas para conectar al backend desde Web o Expo Go en celular.
 * En producción exige EXPO_PUBLIC_API_URL y no prueba IPs locales de desarrollo.
 */
export const obtenerUrlsCandidatasApi = (): string[] => {
  const candidatas: string[] = [];
  const urlConfigurada = typeof process.env.EXPO_PUBLIC_API_URL === "string"
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : "";
  const urlAlternativa = typeof process.env.EXPO_PUBLIC_API_URL_ALT === "string"
    ? process.env.EXPO_PUBLIC_API_URL_ALT.trim()
    : "";

  if (urlBaseResuelta) {
    candidatas.push(urlBaseResuelta);
  }

  if (urlConfigurada) {
    candidatas.push(urlConfigurada);
  }

  if (urlAlternativa) {
    candidatas.push(urlAlternativa);
  }

  // Respaldo de producción en Render por si EAS compiló sin leer .env local (que está en .gitignore)
  candidatas.push("https://app-fyag.onrender.com/api");
  candidatas.push("https://app-fyag-1.onrender.com/api");

  if (process.env.NODE_ENV === "production") {
    return Array.from(new Set(candidatas));
  }

  if (Platform.OS === "web") {
    candidatas.push("http://localhost:3000/api");
    candidatas.push("http://127.0.0.1:3000/api");
  } else {
    const hostMetro = obtenerHostMetro();
    if (hostMetro) {
      candidatas.push(`http://${hostMetro}:3000/api`);
    }
    // Emulador Android estándar
    candidatas.push("http://10.0.2.2:3000/api");
    candidatas.push("http://localhost:3000/api");
  }

  return Array.from(new Set(candidatas));
};

export const obtenerBaseUrlApi = (): string => {
  if (urlBaseResuelta) return urlBaseResuelta;
  const primera = obtenerUrlsCandidatasApi()[0];
  if (primera) return primera;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta configurar EXPO_PUBLIC_API_URL en producción");
  }
  return "http://localhost:3000/api";
};
