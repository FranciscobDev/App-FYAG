const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

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

export const loginApi = async (correo: string, contrasena: string): Promise<RespuestaLogin> => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 10000);

  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo_usuario: correo, contrasena }),
      signal: controlador.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? "No se pudo iniciar sesión" };
    }
    return { ok: true, data: json };
  } catch (e) {
    const expiro = (e as Error).name === "AbortError";
    return {
      ok: false,
      error: expiro ? "El servidor no respondió a tiempo" : "No se pudo conectar con el servidor",
    };
  } finally {
    clearTimeout(temporizador);
  }
};