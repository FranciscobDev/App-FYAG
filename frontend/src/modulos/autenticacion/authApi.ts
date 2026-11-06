import { fijarBaseUrlApi, obtenerUrlsCandidatasApi } from "@/nucleo/sesion";

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

export interface RespuestaLogin {
  ok: boolean;
  data?: { token: string; usuario: UsuarioApi };
  error?: string;
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
      body: JSON.stringify({ correo_usuario: correo, contrasena }),
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
    error: `No se pudo conectar al servidor (${urls[0]}). Verifica que el celular y el PC estén en el mismo Wi-Fi y el puerto 3000 esté abierto.`,
  };
};
