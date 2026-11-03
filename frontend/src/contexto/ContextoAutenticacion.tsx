import React, { createContext, useContext, useState } from "react";
import { Rol, Usuario } from "@/nucleo/tipos";
import { USUARIOS } from "@/datos/datosSimulados";

interface TipoContextoAutenticacion {
  rolActual: Rol;
  usuario: Usuario;
  establecerRol: (rol: Rol) => void;
}

const ContextoAutenticacion = createContext<TipoContextoAutenticacion>({
  rolActual: "admin",
  usuario: USUARIOS.admin,
  establecerRol: () => {},
});

export const ProveedorAutenticacion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actualRol, establecerActualRol] = useState<Rol>("admin");

  const establecerRol = (rol: Rol) => {
    establecerActualRol(rol);
  };

  const usuario = USUARIOS[actualRol];

  return (
    <ContextoAutenticacion.Provider value={{ rolActual: actualRol, usuario: usuario, establecerRol: establecerRol }}>
      {children}
    </ContextoAutenticacion.Provider>
  );
};

export const usarAutenticacion = () => useContext(ContextoAutenticacion);
