import { Platform } from "react-native";

/** Ruta que el correo de recuperación apunta (ver URL_RESTABLECER_CLAVE en el backend). */
const RUTA_RESTABLECER = "/restablecer-clave";

/**
 * Devuelve el token si la página actual es /restablecer-clave?token=...
 * Solo funciona en la versión web; en nativo no hay esquema de deep link configurado.
 */
export const leerTokenDeEnlace = (): string | null => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const { pathname, search } = window.location;
  if (!pathname.replace(/\/+$/, "").endsWith(RUTA_RESTABLECER)) return null;

  const token = new URLSearchParams(search).get("token")?.trim();
  return token ? token : null;
};

/** Quita el token de la barra de direcciones para que no quede visible ni se reutilice al recargar. */
export const limpiarEnlaceRecuperacion = (): void => {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.history.replaceState(null, "", "/");
};
