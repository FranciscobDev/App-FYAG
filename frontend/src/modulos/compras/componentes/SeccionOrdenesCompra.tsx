import React from "react";
import { ScrollView } from "react-native";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { BandejaOrdenesCompra } from "@/componentes/BandejaOrdenesCompra";
import { estilos } from "../estilos";

export interface PropiedadesSeccionOrdenesCompra {
  activoPestana: any;
  aprobarYEnviarOrden: any;
  establecerCalificacionComentario: any;
  establecerCalificacionPrecio: any;
  establecerCalificacionQuality: any;
  establecerCalificacionTiempo: any;
  establecerPdfVistaPreviaOrden: any;
  establecerPoFiltrarEstado: any;
  establecerTarifaModalOrden: any;
  filtradoOrdenes: any;
  manejarAbrirEditarOrden: any;
  manejarAbrirNuevoOrden: any;
  mostrarAviso: any;
  poFiltrarEstado: any;
  rolActual: any;
}

export const SeccionOrdenesCompra: React.FC<PropiedadesSeccionOrdenesCompra> = ({
  activoPestana,
  aprobarYEnviarOrden,
  establecerCalificacionComentario,
  establecerCalificacionPrecio,
  establecerCalificacionQuality,
  establecerCalificacionTiempo,
  establecerPdfVistaPreviaOrden,
  establecerPoFiltrarEstado,
  establecerTarifaModalOrden,
  manejarAbrirEditarOrden,
  manejarAbrirNuevoOrden,
  mostrarAviso,
  poFiltrarEstado,
  rolActual,
}) => {
  const { ordenesCompra } = usarAplicacion();

  if (activoPestana !== "ordenes") {
    return null;
  }

  return (
    <ScrollView
      style={estilos.pestanaContenido}
      contentContainerStyle={estilos.scrollCuerpo}
    >
      <BandejaOrdenesCompra
        ordenes={ordenesCompra}
        poFiltrarEstado={poFiltrarEstado}
        establecerPoFiltrarEstado={establecerPoFiltrarEstado}
        aprobarYEnviarOrden={aprobarYEnviarOrden}
        manejarAbrirNuevoOrden={manejarAbrirNuevoOrden}
        manejarAbrirEditarOrden={manejarAbrirEditarOrden}
        establecerPdfVistaPreviaOrden={establecerPdfVistaPreviaOrden}
        establecerTarifaModalOrden={establecerTarifaModalOrden}
        establecerCalificacionTiempo={establecerCalificacionTiempo}
        establecerCalificacionQuality={establecerCalificacionQuality}
        establecerCalificacionPrecio={establecerCalificacionPrecio}
        establecerCalificacionComentario={establecerCalificacionComentario}
        mostrarAviso={mostrarAviso}
        rolActual={rolActual}
      />
    </ScrollView>
  );
};
