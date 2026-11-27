import { Rol, Usuario } from "@/nucleo/tipos";
import { ROLES } from "@/nucleo/roles";
import { USUARIOS, USUARIOS_SISTEMA } from "@/datos/datosSimulados";
import type { RespuestaLogin, UsuarioApi } from "@/modulos/autenticacion/authApi";

export const CLAVE_TOKEN = "fyag_token";
export const CLAVE_REFRESH_TOKEN = "fyag_refresh_token";
export const CLAVE_BASE_API = "fyag_base_api";

export interface SesionAutenticada {
  usuario: Usuario;
  rol: Rol;
  idUsuario: number;
}

export interface Desafio2faPendiente {
  desafioToken: string;
  mensaje: string;
  correo: string;
}

export interface AlmacenamientoClaveValor {
  getItem: (clave: string) => Promise<string | null>;
  setItem: (clave: string, valor: string) => Promise<void>;
  removeItem: (clave: string) => Promise<void>;
  multiRemove: (claves: string[]) => Promise<void>;
}

/**
 * Normaliza el nombre del rol desde la BD (sin tildes ni sensibilidad a mayúsculas).
 */
export const resolverRolDesdeBd = (
  nombreRol?: string | null,
  idRol?: number | null
): Rol | null => {
  const limpio = (nombreRol ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (limpio.includes("admin") || limpio.includes("geren") || limpio.includes("jefe")) {
    return "admin";
  }
  if (limpio.includes("bodeg") || limpio.includes("almac") || limpio.includes("invent")) {
    return "warehouse";
  }
  if (limpio.includes("tecnic") || limpio.includes("terreno") || limpio.includes("oper")) {
    return "technician";
  }

  if (idRol === 1) return "admin";
  if (idRol === 2) return "warehouse";
  if (idRol === 3) return "technician";

  return null;
};

/**
 * Construye la sesión de aplicación a partir del usuario devuelto por el backend.
 * Devuelve null si el rol no es válido o no tiene acceso.
 */
export const construirSesion = (u: UsuarioApi): SesionAutenticada | null => {
  const rol = resolverRolDesdeBd(u.nombre_rol, u.id_rol);
  if (!rol) return null;

  const nombre = `${u.nombre_usuario ?? ""} ${u.apellido_usuario ?? ""}`.trim();
  const iniciales = `${u.nombre_usuario?.charAt(0) ?? ""}${u.apellido_usuario?.charAt(0) ?? ""}`.toUpperCase();

  return {
    idUsuario: u.id_usuario,
    rol,
    usuario: {
      rut: u.rut ?? "",
      name: nombre,
      email: u.correo_usuario,
      initials: iniciales,
      role: rol,
    },
  };
};

/**
 * Determina las rutas de navegación permitidas según el rol autenticado.
 */
export const obtenerRutasNavegacionPorRol = (rol: Rol): string[] => {
  return (ROLES[rol]?.nav ?? []).map((item) => item.key);
};

/**
 * Evalúa si está permitido activar el modo simulado:
 * SOLO en NODE_ENV === "development", con EXPO_PUBLIC_PERMITIR_MOCK === "true"
 * y únicamente cuando el fallo fue por falta de conexión (nunca ante un 401 del servidor).
 */
export const puedeUsarFallbackSimulado = (opciones: {
  nodeEnv?: string;
  permitirMockEnv?: string;
  sinConexion?: boolean;
}): boolean => {
  return (
    opciones.nodeEnv === "development" &&
    opciones.permitirMockEnv === "true" &&
    opciones.sinConexion === true
  );
};

export const resolverSesionSimulada = (correo: string): SesionAutenticada | null => {
  const correoLimpio = correo.trim().toLowerCase();
  const usuarioSimulado = USUARIOS_SISTEMA.find(
    (u) => u.email.toLowerCase() === correoLimpio
  );

  if (usuarioSimulado && !usuarioSimulado.disabled) {
    const partes = usuarioSimulado.name.split(" ");
    const nombre = partes[0] || "";
    const apellido = partes.slice(1).join(" ") || "";
    const iniciales = `${nombre.charAt(0)}${apellido.charAt(0) || ""}`.toUpperCase();

    return {
      idUsuario: parseInt(usuarioSimulado.id.replace(/\D/g, ""), 10) || 1,
      rol: usuarioSimulado.role,
      usuario: {
        rut: usuarioSimulado.rut,
        name: usuarioSimulado.name,
        email: usuarioSimulado.email,
        initials: iniciales,
        role: usuarioSimulado.role,
      },
    };
  }

  const roles: Rol[] = ["admin", "warehouse", "technician"];
  for (const r of roles) {
    if (
      USUARIOS[r].email.toLowerCase() === correoLimpio ||
      (correoLimpio === "admin@fyag.cl" && r === "admin")
    ) {
      return {
        idUsuario: r === "admin" ? 1 : r === "warehouse" ? 2 : 3,
        rol: r,
        usuario: USUARIOS[r],
      };
    }
  }

  return null;
};

/**
 * Restaura y valida con el backend la sesión almacenada localmente:
 * - Si el backend confirma 200 OK, devuelve la sesión autenticada.
 * - Si el Access Token corto (15m) expiró pero hay un Refresh Token válido, lo rota en /auth/refresh.
 * - Si el backend responde 401/403 y no se puede renovar, borra los tokens persistidos.
 * - Si no hay conexión de red, devuelve null (no presenta sesión falsa), pero conserva
 *   los tokens guardados en disco para revalidar cuando vuelva la conexión.
 */
export const restaurarSesionGuardada = async (deps: {
  almacenamiento: AlmacenamientoClaveValor;
  fetchFn: typeof fetch;
  obtenerUrlBase: () => string;
  fijarUrlBase: (url: string) => void;
  fijarToken: (token: string | null) => void;
  encabezadosAuth: () => Record<string, string>;
}): Promise<{
  sesion: SesionAutenticada | null;
  motivo: "sin_token" | "restaurada" | "renovada" | "revocada" | "sin_conexion";
}> => {
  const token = await deps.almacenamiento.getItem(CLAVE_TOKEN);
  const refreshToken = await deps.almacenamiento.getItem(CLAVE_REFRESH_TOKEN);
  if (!token && !refreshToken) {
    return { sesion: null, motivo: "sin_token" };
  }

  const baseGuardada = await deps.almacenamiento.getItem(CLAVE_BASE_API);
  if (baseGuardada) {
    deps.fijarUrlBase(baseGuardada);
  }

  const limpiarTodo = async () => {
    deps.fijarToken(null);
    await deps.almacenamiento.multiRemove([CLAVE_TOKEN, CLAVE_REFRESH_TOKEN, CLAVE_BASE_API]);
  };

  try {
    if (token) {
      deps.fijarToken(token);
      const res = await deps.fetchFn(`${deps.obtenerUrlBase()}/auth/sesion`, {
        headers: { "Content-Type": "application/json", ...deps.encabezadosAuth() },
      });

      if (res.ok) {
        const json = (await res.json()) as { usuario: UsuarioApi };
        const restaurada = construirSesion(json.usuario);
        if (!restaurada) {
          await limpiarTodo();
          return { sesion: null, motivo: "revocada" };
        }
        return { sesion: restaurada, motivo: "restaurada" };
      }
    }

    // Access token vencido o ausente: intentar renovación silenciosa con el Refresh Token
    if (refreshToken) {
      const resRefresh = await deps.fetchFn(`${deps.obtenerUrlBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (resRefresh.ok) {
        const jsonRefresh = (await resRefresh.json()) as {
          token?: string;
          refresh_token?: string;
          usuario?: UsuarioApi;
        };
        const sesionRenovada = jsonRefresh.usuario ? construirSesion(jsonRefresh.usuario) : null;
        if (jsonRefresh.token && sesionRenovada) {
          deps.fijarToken(jsonRefresh.token);
          await deps.almacenamiento.setItem(CLAVE_TOKEN, jsonRefresh.token);
          if (jsonRefresh.refresh_token) {
            await deps.almacenamiento.setItem(CLAVE_REFRESH_TOKEN, jsonRefresh.refresh_token);
          }
          return { sesion: sesionRenovada, motivo: "renovada" };
        }
      }
    }

    await limpiarTodo();
    return { sesion: null, motivo: "revocada" };
  } catch {
    deps.fijarToken(null);
    return { sesion: null, motivo: "sin_conexion" };
  }
};

const guardarTokensSesion = async (
  almacenamiento: AlmacenamientoClaveValor,
  obtenerUrlBase: () => string,
  fijarToken: (token: string | null) => void,
  token: string,
  refreshToken?: string
) => {
  fijarToken(token);
  await almacenamiento.setItem(CLAVE_TOKEN, token);
  if (refreshToken) {
    await almacenamiento.setItem(CLAVE_REFRESH_TOKEN, refreshToken);
  }
  await almacenamiento.setItem(CLAVE_BASE_API, obtenerUrlBase());
};

/**
 * Ejecuta el flujo de inicio de sesión contra el backend (soportando desafío 2FA para Admin).
 */
export const procesarInicioSesion = async (deps: {
  correo: string;
  contrasena: string;
  loginFn: (correo: string, contrasena: string) => Promise<RespuestaLogin>;
  almacenamiento: AlmacenamientoClaveValor;
  obtenerUrlBase: () => string;
  fijarToken: (token: string | null) => void;
  nodeEnv?: string;
  permitirMockEnv?: string;
}): Promise<{
  sesion: SesionAutenticada | null;
  error: string | null;
  desafio2fa?: Desafio2faPendiente;
}> => {
  const res = await deps.loginFn(deps.correo, deps.contrasena);

  if (!res.ok || !res.data) {
    deps.fijarToken(null);
    await deps.almacenamiento.multiRemove([CLAVE_TOKEN, CLAVE_REFRESH_TOKEN]);

    if (
      puedeUsarFallbackSimulado({
        nodeEnv: deps.nodeEnv,
        permitirMockEnv: deps.permitirMockEnv,
        sinConexion: res.sinConexion,
      })
    ) {
      const simulada = resolverSesionSimulada(deps.correo);
      if (simulada) {
        deps.fijarToken("token-sesion-simulada");
        return { sesion: simulada, error: null };
      }
    }

    return { sesion: null, error: res.error ?? "No se pudo iniciar sesión" };
  }

  // Si el servidor exige segundo factor (Administrador), devolver el desafío pendiente sin abrir sesión aún
  if (res.data.requiere_2fa && res.data.desafio_token) {
    deps.fijarToken(null);
    return {
      sesion: null,
      error: null,
      desafio2fa: {
        desafioToken: res.data.desafio_token,
        mensaje:
          res.data.mensaje ??
          "Ingresa el código de verificación de 6 dígitos enviado a tu correo corporativo.",
        correo: deps.correo.trim(),
      },
    };
  }

  if (!res.data.usuario || !res.data.token) {
    deps.fijarToken(null);
    return { sesion: null, error: "Respuesta de autenticación incompleta" };
  }

  const nueva = construirSesion(res.data.usuario);
  if (!nueva) {
    deps.fijarToken(null);
    return { sesion: null, error: "Tu rol no tiene acceso a la aplicación" };
  }

  await guardarTokensSesion(
    deps.almacenamiento,
    deps.obtenerUrlBase,
    deps.fijarToken,
    res.data.token,
    res.data.refresh_token
  );

  return { sesion: nueva, error: null };
};

/**
 * Completa el segundo factor (2FA) del Administrador y persiste los tokens definitivos.
 */
export const procesarVerificacion2fa = async (deps: {
  desafioToken: string;
  codigo: string;
  verificarFn: (desafioToken: string, codigo: string) => Promise<RespuestaLogin>;
  almacenamiento: AlmacenamientoClaveValor;
  obtenerUrlBase: () => string;
  fijarToken: (token: string | null) => void;
}): Promise<{ sesion: SesionAutenticada | null; error: string | null }> => {
  const codigoLimpio = deps.codigo.trim();
  if (!/^\d{6}$/.test(codigoLimpio)) {
    return { sesion: null, error: "El código debe tener exactamente 6 dígitos numéricos" };
  }

  const res = await deps.verificarFn(deps.desafioToken, codigoLimpio);
  if (!res.ok || !res.data?.token || !res.data?.usuario) {
    return { sesion: null, error: res.error ?? "Código de verificación incorrecto" };
  }

  const nueva = construirSesion(res.data.usuario);
  if (!nueva) {
    return { sesion: null, error: "Tu rol no tiene acceso a la aplicación" };
  }

  await guardarTokensSesion(
    deps.almacenamiento,
    deps.obtenerUrlBase,
    deps.fijarToken,
    res.data.token,
    res.data.refresh_token
  );

  return { sesion: nueva, error: null };
};

/**
 * Cierra la sesión invalidándola en el servidor (POST /auth/logout) y limpiando el almacenamiento local.
 */
export const cerrarSesionSegura = async (deps: {
  almacenamiento: AlmacenamientoClaveValor;
  fijarToken: (token: string | null) => void;
  logoutFn?: () => Promise<boolean>;
}): Promise<void> => {
  try {
    if (deps.logoutFn) {
      await deps.logoutFn();
    }
  } catch {
    // Incluso si falla la red al hacer logout, se borran las credenciales locales
  } finally {
    deps.fijarToken(null);
    await deps.almacenamiento.multiRemove([CLAVE_TOKEN, CLAVE_REFRESH_TOKEN, CLAVE_BASE_API]);
  }
};

/**
 * Guardia de concurrencia para evitar envíos duplicados de formularios (doble toque en botones).
 */
export const crearControlEnvioUnico = () => {
  let enVuelo = false;

  return {
    estaEnviando: () => enVuelo,
    ejecutar: async <T>(
      tarea: () => Promise<T>
    ): Promise<{ ejecutado: true; resultado: T } | { ejecutado: false }> => {
      if (enVuelo) {
        return { ejecutado: false };
      }
      enVuelo = true;
      try {
        const resultado = await tarea();
        return { ejecutado: true, resultado };
      } finally {
        enVuelo = false;
      }
    },
  };
};
