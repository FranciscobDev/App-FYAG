import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";

// Layouts por Rol (Paso 3)
import { PlantillaAdmin } from "@/plantillas/PlantillaAdmin";
import { PlantillaBodega } from "@/plantillas/PlantillaBodega";
import { PlantillaTecnico } from "@/plantillas/PlantillaTecnico";
import { PlantillaAutenticacion } from "@/plantillas/PlantillaAutenticacion";

/**
 * RootNavigator (Paso 3):
 * Orquesta los 4 layouts según el rol autenticado:
 * - AdminLayout: Escritorio con Sidebar colapsable en 4 grupos y Topbar completa.
 * - BodegaLayout: Tablet con Sidebar compacto, atajos y botón flotante de escáner FAB.
 * - TecnicoLayout: Celular mobile-first con BottomNav de 4 pestañas, SyncStatusChip y OfflineBanner.
 * - AuthLayout: Pantalla centrada con logo para autenticación y selección de rol.
 *
 * El menú muestra únicamente lo permitido para el rol activo.
 */
export const NavegadorRaiz: React.FC = () => {
  const { rolActual, establecerRol } = usarAutenticacion();
  const [esAuthenticated, establecerEsAuthenticated] = useState(false);

  if (!esAuthenticated) {
    return (
      <View style={estilos.contenedor}>
        <PlantillaAutenticacion
          onSuccessLogin={(selectedRole) => {
            establecerRol(selectedRole);
            establecerEsAuthenticated(true);
          }}
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <View style={estilos.contenedor}>
        {rolActual === "admin" && (
          <PlantillaAdmin onLogout={() => establecerEsAuthenticated(false)} />
        )}

        {rolActual === "warehouse" && (
          <PlantillaBodega onLogout={() => establecerEsAuthenticated(false)} />
        )}

        {rolActual === "technician" && (
          <PlantillaTecnico onLogout={() => establecerEsAuthenticated(false)} />
        )}
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
