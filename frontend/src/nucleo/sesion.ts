import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

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
 */
export const obtenerUrlsCandidatasApi = (): string[] => {
  const candidatas: string[] = [];

  if (urlBaseResuelta) {
    candidatas.push(urlBaseResuelta);
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    candidatas.push(process.env.EXPO_PUBLIC_API_URL);
  }

  if (Platform.OS === "web") {
    candidatas.push("http://localhost:3000/api");
    candidatas.push("http://10.13.103.8:3000/api");
  } else {
    const hostMetro = obtenerHostMetro();
    if (hostMetro) {
      candidatas.push(`http://${hostMetro}:3000/api`);
    }
    // IP Wi-Fi local actual del PC
    candidatas.push("http://10.13.103.8:3000/api");
    // Emulador Android estándar
    candidatas.push("http://10.0.2.2:3000/api");
    candidatas.push("http://localhost:3000/api");
  }

  return Array.from(new Set(candidatas));
};

export const obtenerBaseUrlApi = (): string => {
  if (urlBaseResuelta) return urlBaseResuelta;
  return obtenerUrlsCandidatasApi()[0] ?? "http://10.13.103.8:3000/api";
};
