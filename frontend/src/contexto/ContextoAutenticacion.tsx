import React, { createContext, useContext, useEffect, useState } from "react";
import { Rol, Usuario } from "@/nucleo/tipos";
import { almacenamientoPersistente as AsyncStorage } from "@/nucleo/cacheLocal";
import {
  encabezadosAuth,
  establecerToken,
  fijarBaseUrlApi,
  obtenerBaseUrlApi,
} from "@/nucleo/sesion";
import { loginApi, logoutApi, verificar2faApi } from "@/modulos/autenticacion/authApi";
import {
  Desafio2faPendiente,
  SesionAutenticada,
  cerrarSesionSegura,
  procesarInicioSesion,
  procesarVerificacion2fa,
  restaurarSesionGuardada,
} from "@/nucleo/flujoAutenticacion";

const USUARIO_VACIO: Usuario = {
  rut: "",
  name: "",
  email: "",
  initials: "",
  role: "technician",
};

interface TipoContextoAutenticacion {
  haySesion: boolean;
  cargandoSesion: boolean;
  usuario: Usuario;
  rolActual: Rol;
  idUsuario: number | null;
  pendiente2fa: Desafio2faPendiente | null;
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>;
  confirmarCodigo2fa: (codigo: string) => Promise<string | null>;
  cancelar2fa: () => void;
  cerrarSesion: () => void;
  establecerRol: (rol: Rol) => void;
}

const ContextoAutenticacion = createContext<TipoContextoAutenticacion>({
  haySesion: false,
  cargandoSesion: true,
  usuario: USUARIO_VACIO,
  rolActual: "technician",
  idUsuario: null,
  pendiente2fa: null,
  iniciarSesion: async () => "Sin proveedor de autenticación",
  confirmarCodigo2fa: async () => "Sin proveedor de autenticación",
  cancelar2fa: () => {},
  cerrarSesion: () => {},
  establecerRol: () => {},
});

export const ProveedorAutenticacion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sesion, establecerSesion] = useState<SesionAutenticada | null>(null);
  const [cargandoSesion, establecerCargandoSesion] = useState(true);
  const [pendiente2fa, establecerPendiente2fa] = useState<Desafio2faPendiente | null>(null);

  useEffect(() => {
    let cancelado = false;

    const restaurar = async () => {
      try {
        const resultado = await restaurarSesionGuardada({
          almacenamiento: AsyncStorage,
          fetchFn: fetch,
          obtenerUrlBase: obtenerBaseUrlApi,
          fijarUrlBase: fijarBaseUrlApi,
          fijarToken: establecerToken,
          encabezadosAuth,
        });
        if (!cancelado && resultado.sesion) {
          establecerSesion(resultado.sesion);
        }
      } finally {
        if (!cancelado) establecerCargandoSesion(false);
      }
    };

    restaurar();
    return () => {
      cancelado = true;
    };
  }, []);

  const iniciarSesion = async (correo: string, contrasena: string): Promise<string | null> => {
    const resultado = await procesarInicioSesion({
      correo,
      contrasena,
      loginFn: loginApi,
      almacenamiento: AsyncStorage,
      obtenerUrlBase: obtenerBaseUrlApi,
      fijarToken: establecerToken,
      nodeEnv: process.env.NODE_ENV,
      permitirMockEnv: process.env.EXPO_PUBLIC_PERMITIR_MOCK,
    });

    if (resultado.desafio2fa) {
      establecerPendiente2fa(resultado.desafio2fa);
      return null;
    }

    establecerPendiente2fa(null);
    establecerSesion(resultado.sesion);
    return resultado.error;
  };

  const confirmarCodigo2fa = async (codigo: string): Promise<string | null> => {
    if (!pendiente2fa) {
      return "No hay una verificación de segundo factor pendiente";
    }
    const resultado = await procesarVerificacion2fa({
      desafioToken: pendiente2fa.desafioToken,
      codigo,
      verificarFn: verificar2faApi,
      almacenamiento: AsyncStorage,
      obtenerUrlBase: obtenerBaseUrlApi,
      fijarToken: establecerToken,
    });

    if (resultado.sesion) {
      establecerPendiente2fa(null);
      establecerSesion(resultado.sesion);
      return null;
    }
    return resultado.error;
  };

  const cancelar2fa = () => {
    establecerPendiente2fa(null);
  };

  const cerrarSesion = () => {
    establecerPendiente2fa(null);
    establecerSesion(null);
    void cerrarSesionSegura({
      almacenamiento: AsyncStorage,
      fijarToken: establecerToken,
      logoutFn: () => logoutApi(fetch),
    });
  };

  return (
    <ContextoAutenticacion.Provider
      value={{
        haySesion: sesion !== null,
        cargandoSesion,
        usuario: sesion?.usuario ?? USUARIO_VACIO,
        rolActual: sesion?.rol ?? "technician",
        idUsuario: sesion?.idUsuario ?? null,
        pendiente2fa,
        iniciarSesion,
        confirmarCodigo2fa,
        cancelar2fa,
        cerrarSesion,
        establecerRol: () => {},
      }}
    >
      {children}
    </ContextoAutenticacion.Provider>
  );
};

export const usarAutenticacion = () => useContext(ContextoAutenticacion);
