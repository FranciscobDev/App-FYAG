import React, { createContext, useContext, useState } from "react";
import { Rol, Usuario } from "@/nucleo/tipos";
import { establecerToken } from "@/nucleo/sesion";
import { UsuarioApi, loginApi } from "@/modulos/autenticacion/authApi";

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
  usuario: USUARIO_VACIO,
  rolActual: "technician",
  idUsuario: null,
  iniciarSesion: async () => "Sin proveedor de autenticación",
  cerrarSesion: () => {},
  establecerRol: () => {},
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

  // Devuelve null si entró, o el mensaje de error si falló
  const iniciarSesion = async (correo: string, contrasena: string): Promise<string | null> => {
    const res = await loginApi(correo, contrasena);
    if (!res.ok || !res.data) {
      return res.error ?? "No se pudo iniciar sesión";
    }

    const nueva = construirSesion(res.data.usuario);
    if (!nueva) {
      return "Tu rol no tiene acceso a la aplicación";
    }

    establecerToken(res.data.token);
    establecerSesion(nueva);
    return null;
  };

  const cerrarSesion = () => {
    establecerToken(null);
    establecerSesion(null);
  };

  return (
    <ContextoAutenticacion.Provider
      value={{
        haySesion: sesion !== null,
        usuario: sesion?.usuario ?? USUARIO_VACIO,
        rolActual: sesion?.rol ?? "technician",
        idUsuario: sesion?.idUsuario ?? null,
        iniciarSesion,
        cerrarSesion,
        establecerRol: () => {},
      }}
    >
      {children}
    </ContextoAutenticacion.Provider>
  );
};

export const usarAutenticacion = () => useContext(ContextoAutenticacion);