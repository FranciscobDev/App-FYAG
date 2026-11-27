import { encabezadosAuth, fijarBaseUrlApi, obtenerBaseUrlApi, obtenerUrlsCandidatasApi } from "@/nucleo/sesion";

export interface UsuarioApi {
  id_usuario: number;
  nombre_usuario: string;
  apellido_usuario: string;
  correo_usuario: string;
  rut: string | null;
  id_rol: number;
  nombre_rol: string | null;
  activo: boolean;
}

export type UsuarioSesion = UsuarioApi;

export interface RespuestaLogin {
  ok: boolean;
  data?: {
    token?: string;
    refresh_token?: string;
    expira_en_segundos?: number;
    usuario?: UsuarioApi;
    requiere_2fa?: boolean;
    desafio_token?: string;
    mensaje?: string;
  };
  error?: string;
  /** true cuando ningún servidor candidato respondió (error de red / backend apagado). */
  sinConexion?: boolean;
}

const intentarLoginEnUrl = async (
  baseUrl: string,
  correo: string,
  contrasena: string
): Promise<{ conectado: boolean; respuesta?: RespuestaLogin }> => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 5000);

  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo_usuario: correo, contrasena, soportar_2fa: true }),
      signal: controlador.signal,
    });
    const json = await res.json().catch(() => ({}));
    fijarBaseUrlApi(baseUrl);

    if (!res.ok) {
      return {
        conectado: true,
        respuesta: { ok: false, error: json.mensaje ?? "Correo o contraseña incorrectos" },
      };
    }
    return {
      conectado: true,
      respuesta: { ok: true, data: json },
    };
  } catch {
    return { conectado: false };
  } finally {
    clearTimeout(temporizador);
  }
};

export const loginApi = async (correo: string, contrasena: string): Promise<RespuestaLogin> => {
  const urls = obtenerUrlsCandidatasApi();

  for (const url of urls) {
    const intento = await intentarLoginEnUrl(url, correo, contrasena);
    if (intento.conectado && intento.respuesta) {
      return intento.respuesta;
    }
  }

  return {
    ok: false,
    sinConexion: true,
    error: `No se pudo conectar al servidor (${urls[0] ?? "sin URL configurada"}). Verifica tu conexión y que el backend esté activo.`,
  };
};

/** Verifica el código 2FA de 6 dígitos enviado al Administrador. */
export const verificar2faApi = async (
  desafioToken: string,
  codigo: string
): Promise<RespuestaLogin> => {
  try {
    const res = await fetch(`${obtenerBaseUrlApi()}/auth/verificar-2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desafio_token: desafioToken, codigo }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? "Código de verificación incorrecto" };
    }
    return { ok: true, data: json };
  } catch {
    return {
      ok: false,
      sinConexion: true,
      error: "No se pudo conectar al servidor para verificar el código 2FA.",
    };
  }
};

/** Renueva el Access Token corto usando el Refresh Token rotativo. */
export const renovarSesionApi = async (
  refreshToken: string,
  fetchFn: typeof fetch = fetch
): Promise<RespuestaLogin> => {
  try {
    const res = await fetchFn(`${obtenerBaseUrlApi()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? "La sesión expiró" };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, sinConexion: true, error: "Sin conexión al renovar la sesión" };
  }
};

/** Notifica al servidor el cierre explícito de la sesión para revocarla en base de datos. */
export const logoutApi = async (fetchFn: typeof fetch = fetch): Promise<boolean> => {
  try {
    const res = await fetchFn(`${obtenerBaseUrlApi()}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...encabezadosAuth() },
    });
    return res.ok;
  } catch {
    return false;
  }
};
