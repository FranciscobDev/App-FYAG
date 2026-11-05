import React, { createContext, ReactNode, useContext, useState } from "react";
import { establecerToken } from "@/nucleo/sesion";
import { UsuarioSesion, loginApi } from "@/modulos/autenticacion/authApi";

type ValorSesion = {
  usuario: UsuarioSesion | null;
  iniciarSesion: (correo: string, contrasena: string) => Promise<string | null>;
  cerrarSesion: () => void;
};

const ContextoSesion = createContext<ValorSesion | null>(null);

export const ProveedorSesion = ({ children }: { children: ReactNode }) => {
  const [usuario, establecerUsuario] = useState<UsuarioSesion | null>(null);

  // Devuelve null si entró, o el mensaje de error si falló
  const iniciarSesion = async (correo: string, contrasena: string) => {
    const res = await loginApi(correo, contrasena);
    if (!res.ok || !res.data) {
      return res.error ?? "No se pudo iniciar sesión";
    }
    establecerToken(res.data.token);
    establecerUsuario(res.data.usuario);
    return null;
  };

  const cerrarSesion = () => {
    establecerToken(null);
    establecerUsuario(null);
  };

  return (
    <ContextoSesion.Provider value={{ usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </ContextoSesion.Provider>
  );
};

export const usarSesion = () => {
  const ctx = useContext(ContextoSesion);
  if (!ctx) throw new Error("usarSesion debe usarse dentro de ProveedorSesion");
  return ctx;
};