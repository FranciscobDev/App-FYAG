import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { PlantillaAdmin } from "@/plantillas/PlantillaAdmin";
import { PlantillaBodega } from "@/plantillas/PlantillaBodega";
import { PlantillaTecnico } from "@/plantillas/PlantillaTecnico";
import { PlantillaAutenticacion, VistaAutenticacion } from "@/plantillas/PlantillaAutenticacion";
import { PantallaRestablecerClave } from "@/plantillas/PantallaRestablecerClave";
import { leerTokenDeEnlace, limpiarEnlaceRecuperacion } from "@/modulos/autenticacion/enlaceRecuperacion";

export const NavegadorRaiz: React.FC = () => {
  const { haySesion, rolActual, cerrarSesion } = usarAutenticacion();

  // Si la página se abrió desde el enlace del correo (/restablecer-clave?token=...), se muestra
  // la pantalla de nueva contraseña antes del inicio de sesión.
  const [tokenEnlace, establecerTokenEnlace] = useState<string | null>(() => leerTokenDeEnlace());
  const [vistaInicial, establecerVistaInicial] = useState<VistaAutenticacion>("login");

  if (!haySesion) {
    if (tokenEnlace) {
      return (
        <View style={estilos.contenedor}>
          <StatusBar style="dark" />
          <PantallaRestablecerClave
            token={tokenEnlace}
            onTerminado={() => {
              limpiarEnlaceRecuperacion();
              establecerTokenEnlace(null);
            }}
            onSolicitarNuevo={() => {
              limpiarEnlaceRecuperacion();
              establecerTokenEnlace(null);
              establecerVistaInicial("forgot");
            }}
          />
        </View>
      );
    }

    return (
      <View style={estilos.contenedor}>
        <StatusBar style="dark" />
        <PlantillaAutenticacion initialView={vistaInicial} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <View style={estilos.contenedor}>
        <StatusBar style="light" />
        {rolActual === "admin" && <PlantillaAdmin onLogout={cerrarSesion} />}
        {rolActual === "warehouse" && <PlantillaBodega onLogout={cerrarSesion} />}
        {rolActual === "technician" && <PlantillaTecnico onLogout={cerrarSesion} />}
      </View>
    </NavigationContainer>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
});
