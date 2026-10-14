import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/core/theme";

// Layouts por Rol (Paso 3)
import { AdminLayout } from "@/layouts/AdminLayout";
import { BodegaLayout } from "@/layouts/BodegaLayout";
import { TecnicoLayout } from "@/layouts/TecnicoLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

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
export const RootNavigator: React.FC = () => {
  const { currentRole, setRole } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AuthLayout
          onSuccessLogin={(selectedRole) => {
            setRole(selectedRole);
            setIsAuthenticated(true);
          }}
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <View style={styles.container}>
        {currentRole === "admin" && (
          <AdminLayout onLogout={() => setIsAuthenticated(false)} />
        )}

        {currentRole === "warehouse" && (
          <BodegaLayout onLogout={() => setIsAuthenticated(false)} />
        )}

        {currentRole === "technician" && (
          <TecnicoLayout onLogout={() => setIsAuthenticated(false)} />
        )}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
