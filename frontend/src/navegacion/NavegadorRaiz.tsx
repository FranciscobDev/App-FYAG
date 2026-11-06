import React from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { PlantillaAdmin } from "@/plantillas/PlantillaAdmin";
import { PlantillaBodega } from "@/plantillas/PlantillaBodega";
import { PlantillaTecnico } from "@/plantillas/PlantillaTecnico";
import { PlantillaAutenticacion } from "@/plantillas/PlantillaAutenticacion";

export const NavegadorRaiz: React.FC = () => {
  const { haySesion, rolActual, cerrarSesion } = usarAutenticacion();

  if (!haySesion) {
    return (
      <View style={estilos.contenedor}>
        <StatusBar style="dark" />
        <PlantillaAutenticacion />
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