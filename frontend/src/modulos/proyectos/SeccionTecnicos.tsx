import React from "react";
import { AsignacionTecnicos } from "@/componentes/AsignacionTecnicos";
import { Proyecto } from "./proyectosApi";

type Props = {
  proyectoId: number;
  proyectos?: Proyecto[];
  onAviso?: (mensaje: string) => void;
};

export const SeccionTecnicos: React.FC<Props> = ({
  proyectoId,
  proyectos,
  onAviso,
}) => {
  return (
    <AsignacionTecnicos
      proyectoIdInicial={proyectoId}
      proyectosProp={proyectos}
      onAviso={onAviso}
      titulo="Asignación de Técnicos y Control de Historial"
    />
  );
};

export default SeccionTecnicos;
