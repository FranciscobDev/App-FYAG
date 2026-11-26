import React, { createContext, useContext, useEffect, useState } from "react";
import { Rol, Usuario } from "@/nucleo/tipos";
import {
  encabezadosAuth,
  establecerToken,
  fijarBaseUrlApi,
  obtenerBaseUrlApi,
} from "@/nucleo/sesion";
import { UsuarioApi, loginApi } from "@/modulos/autenticacion/authApi";
import { USUARIOS, USUARIOS_SISTEMA } from "@/datos/datosSimulados";

// Almacenamiento seguro compatible con Web y Móvil sin dependencias externas
const memoriaAlmacen: Record<string, string> = {};
const AsyncStorage = {
  getItem: async (clave: string): Promise<string | null> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(clave);
      }
    } catch {}
    return memoriaAlmacen[clave] ?? null;
  },
  setItem: async (clave: string, valor: string): Promise<void> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(clave, valor);
      }
    } catch {}
    memoriaAlmacen[clave] = valor;
  },
  removeItem: async (clave: string): Promise<void> => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(clave);
      }
    } catch {}
    delete memoriaAlmacen[clave];
  },
  multiRemove: async (claves: string[]): Promise<void> => {
    claves.forEach((k) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(k);
        }
      } catch {}
      delete memoriaAlmacen[k];
    });
  },
};

// CAMBIO: claves donde se guarda la sesión entre recargas
const CLAVE_TOKEN = "fyag_token";
const CLAVE_BASE_API = "fyag_base_api";

// Normaliza el nombre del rol desde la BD (sin tildes ni sensibilidad a mayúsculas)
const resolverRolDesdeBd = (nombreRol?: string | null, idRol?: number | null): Rol | null => {
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

  // Respaldo por id_rol si nombre_rol viene nulo o distinto
  if (idRol === 1) return "admin";
  if (idRol === 2) return "warehouse";
  if (idRol === 3) return "technician";

  return null;
};

const USUARIO_VACIO: Usuario = {
  rut: "",
  name: "",
  email: "",
  initials: "",
  role: "technician",
};

interface Sesion {
  usuario: Usuario;
  rol: Rol;
  idUsuario: number;
}

interface TipoContextoAutenticacion {
  haySesion: boolean;
  // CAMBIO: true mientras se restaura la sesión guardada al abrir la app
  cargandoSesion: boolean;
  usuario: Usuario;
  rolActual: Rol;
  idUsuario: number | null;
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>;
  cerrarSesion: () => void;
  // Se mantiene para compatibilidad con los selectores de rol de las plantillas.
  // Ya no cambia el rol: el rol lo define la base de datos.
  establecerRol: (rol: Rol) => void;
}

const ContextoAutenticacion = createContext<TipoContextoAutenticacion>({
  haySesion: false,
  cargandoSesion: true,
  usuario: USUARIO_VACIO,
  rolActual: "technician",
  idUsuario: null,
  iniciarSesion: async () => "Sin proveedor de autenticación",
  cerrarSesion: () => { },
  establecerRol: () => { },
});

const construirSesion = (u: UsuarioApi): Sesion | null => {
  const rol = resolverRolDesdeBd(u.nombre_rol, u.id_rol);
  if (!rol) return null; // Sin rol reconocido: no se da acceso

  const nombre = `${u.nombre_usuario} ${u.apellido_usuario}`.trim();
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

export const ProveedorAutenticacion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sesion, establecerSesion] = useState<Sesion | null>(null);
  // CAMBIO: evita mostrar el login mientras se revisa la sesión guardada
  const [cargandoSesion, establecerCargandoSesion] = useState(true);

  // Borra la sesión guardada en el dispositivo
  const olvidarSesionGuardada = async () => {
    establecerToken(null);
    await AsyncStorage.multiRemove([CLAVE_TOKEN, CLAVE_BASE_API]);
  };

  // CAMBIO: al abrir la app (o recargar la página), valida el token guardado con el backend
  useEffect(() => {
    let cancelado = false;

    const restaurar = async () => {
      try {
        const token = await AsyncStorage.getItem(CLAVE_TOKEN);
        if (!token) return;

        const baseGuardada = await AsyncStorage.getItem(CLAVE_BASE_API);
        if (baseGuardada) fijarBaseUrlApi(baseGuardada);
        establecerToken(token);

        const res = await fetch(`${obtenerBaseUrlApi()}/auth/sesion`, {
          headers: { "Content-Type": "application/json", ...encabezadosAuth() },
        });

        // Token vencido, revocado o cuenta deshabilitada: se pide iniciar sesión
        if (!res.ok) {
          await olvidarSesionGuardada();
          return;
        }

        const json = (await res.json()) as { usuario: UsuarioApi };
        const restaurada = construirSesion(json.usuario);
        if (!restaurada) {
          await olvidarSesionGuardada();
          return;
        }

        if (!cancelado) establecerSesion(restaurada);
      } catch {
        // Sin conexión: no hay sesión en esta carga, pero el token guardado se conserva
        establecerToken(null);
      } finally {
        if (!cancelado) establecerCargandoSesion(false);
      }
    };

    restaurar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Devuelve null si entró, o el mensaje de error si falló
  const iniciarSesion = async (correo: string, contrasena: string): Promise<string | null> => {
    const res = await loginApi(correo, contrasena);
    if (!res.ok || !res.data) {
      establecerToken(null);
      establecerSesion(null);
      await AsyncStorage.removeItem(CLAVE_TOKEN);

      if (process.env.NODE_ENV === "development") {
        const correoLimpio = correo.trim().toLowerCase();
        const usuarioSimulado = USUARIOS_SISTEMA.find(
          (u) => u.email.toLowerCase() === correoLimpio
        );

        if (usuarioSimulado && !usuarioSimulado.disabled) {
          const partes = usuarioSimulado.name.split(" ");
          const nombre = partes[0] || "";
          const apellido = partes.slice(1).join(" ") || "";
          const iniciales = `${nombre.charAt(0)}${apellido.charAt(0) || ""}`.toUpperCase();

          establecerToken("token-sesion-simulada");
          establecerSesion({
            idUsuario: parseInt(usuarioSimulado.id.replace(/\D/g, "")) || 1,
            rol: usuarioSimulado.role,
            usuario: {
              rut: usuarioSimulado.rut,
              name: usuarioSimulado.name,
              email: usuarioSimulado.email,
              initials: iniciales,
              role: usuarioSimulado.role,
            },
          });
          return null;
        }

        const roles: Rol[] = ["admin", "warehouse", "technician"];
        for (const r of roles) {
          if (USUARIOS[r].email.toLowerCase() === correoLimpio || (correoLimpio === "admin@fyag.cl" && r === "admin")) {
            establecerToken("token-sesion-simulada");
            establecerSesion({
              idUsuario: r === "admin" ? 1 : r === "warehouse" ? 2 : 3,
              rol: r,
              usuario: USUARIOS[r],
            });
            return null;
          }
        }
      }

      return res.error ?? "No se pudo iniciar sesión";
    }

    const nueva = construirSesion(res.data.usuario);
    if (!nueva) {
      return "Tu rol no tiene acceso a la aplicación";
    }

    establecerToken(res.data.token);
    // CAMBIO: guarda token y base de la API para restaurarlos tras recargar
    await AsyncStorage.setItem(CLAVE_TOKEN, res.data.token);
    await AsyncStorage.setItem(CLAVE_BASE_API, obtenerBaseUrlApi());
    establecerSesion(nueva);
    return null;
  };

  const cerrarSesion = () => {
    establecerToken(null);
    establecerSesion(null);
    // CAMBIO: al cerrar sesión, también se borra lo guardado
    void AsyncStorage.multiRemove([CLAVE_TOKEN, CLAVE_BASE_API]);
  };

  return (
    <ContextoAutenticacion.Provider
      value={{
        haySesion: sesion !== null,
        cargandoSesion,
        usuario: sesion?.usuario ?? USUARIO_VACIO,
        rolActual: sesion?.rol ?? "technician",
        idUsuario: sesion?.idUsuario ?? null,
        iniciarSesion,
        cerrarSesion,
        establecerRol: () => { },
      }}
    >
      {children}
    </ContextoAutenticacion.Provider>
  );
};

export const usarAutenticacion = () => useContext(ContextoAutenticacion);