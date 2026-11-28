import { obtenerUrlsCandidatasApi } from "@/nucleo/sesion";

export interface RespuestaRecuperacion {
  ok: boolean;
  mensaje: string;
  /** Código de negocio enviado por el backend (p. ej. ENLACE_INVALIDO) */
  codigo?: string;
}

/**
 * POST a la ruta de auth probando las URLs candidatas en orden, igual que el login.
 * Devuelve el mensaje que envía el backend; si no hay conexión, un mensaje de error.
 */
const postAuth = async (
  ruta: string,
  cuerpo: Record<string, string>
): Promise<RespuestaRecuperacion> => {
  const urls = obtenerUrlsCandidatasApi();

  for (const base of urls) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 5000);
    try {
      const res = await fetch(`${base}${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: controlador.signal,
      });
      const json = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        mensaje: json.mensaje ?? json.error ?? "Ocurrió un error inesperado. Intenta nuevamente.",
        codigo: json.codigo,
      };
    } catch {
      // Esta URL no respondió: se prueba la siguiente
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    ok: false,
    mensaje: "No se pudo conectar al servidor. Verifica tu conexión e intenta nuevamente.",
  };
};

/** Solicita el enlace de recuperación. El mensaje es el mismo exista o no el correo. */
export const solicitarRecuperacionApi = (correo: string): Promise<RespuestaRecuperacion> =>
  postAuth("/auth/recuperar-clave", { correo_usuario: correo.trim() });

/** Cambia la contraseña usando el token recibido por correo. */
export const restablecerClaveApi = (token: string, contrasena: string): Promise<RespuestaRecuperacion> =>
  postAuth("/auth/restablecer-clave", { token, contrasena });
