import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { NotificacionFlotante } from "@/componentes/comunes";
import { KitProyecto } from "@/nucleo/tipos";
import { listarKits } from "./kitsApi";
import { Proyecto, listarProyectos } from "./proyectosApi";
import { ModalGestionClientesSeguimiento } from "./ModalGestionClientesSeguimiento";

export const PantallaClientes: React.FC = () => {
  const [proyectos, establecerProyectos] = useState<Proyecto[]>([]);
  const [kits, establecerKits] = useState<KitProyecto[]>([]);
  const [aviso, establecerAviso] = useState<string | null>(null);

  const cargarContexto = useCallback(async () => {
    const [resProy, resKits] = await Promise.all([listarProyectos(), listarKits()]);
    if (resProy.ok && resProy.data) {
      establecerProyectos(resProy.data);
    }
    if (resKits.ok && resKits.data) {
      establecerKits(resKits.data);
    }
  }, []);

  useEffect(() => {
    cargarContexto();
  }, [cargarContexto]);

  return (
    <View style={{ flex: 1 }}>
      <ModalGestionClientesSeguimiento
        visible={true}
        modoPagina={true}
        initialTab="clientes"
        proyectos={proyectos}
        kits={kits}
        onClose={() => {}}
        onDatosActualizados={cargarContexto}
        onAviso={(msg) => establecerAviso(msg)}
      />

      <NotificacionFlotante
        visible={Boolean(aviso)}
        message={aviso ?? ""}
        type="ok"
        onDismiss={() => establecerAviso(null)}
      />
    </View>
  );
};
