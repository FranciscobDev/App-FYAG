import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ProveedorAutenticacion } from "@/contexto/ContextoAutenticacion";
import { ProveedorAplicacion } from "@/contexto/ContextoAplicacion";
import { NavegadorRaiz } from "@/navegacion/NavegadorRaiz";

export default function App() {
  return (
    <SafeAreaProvider>
      <ProveedorAutenticacion>
        <ProveedorAplicacion>
          <NavegadorRaiz />
          <StatusBar style="dark" />
        </ProveedorAplicacion>
      </ProveedorAutenticacion>
    </SafeAreaProvider>
  );
}
