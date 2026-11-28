import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { PantallaDevoluciones } from "@/modulos/devoluciones/PantallaDevoluciones";
import { FormularioReporteAvance } from "@/componentes/FormularioReporteAvance";

interface TechnicianRegisterViewProps {
  initialSubTab?: "avance" | "sobrante";
  initialProjectId?: string;
  isOffline?: boolean;
  onCambioConexion?: (offline: boolean) => void;
}

export const VistaRegistroTecnico: React.FC<TechnicianRegisterViewProps> = ({
  initialSubTab = "avance",
  initialProjectId,
}) => {
  const { proyectos } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const [activoSubPestana, establecerActivoSubPestana] = useState<"avance" | "sobrante">(initialSubTab);

  useEffect(() => {
    establecerActivoSubPestana(initialSubTab);
  }, [initialSubTab]);

  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || activoProyectos[0]?.id || ""
  );

  useEffect(() => {
    if (initialProjectId) {
      establecerSeleccionadoProyectoId(initialProjectId);
    }
  }, [initialProjectId]);

  return (
    <View style={estilos.contenedor}>
      {/* ========================================================================= */}
      {/* SELECTOR DE PESTAÑAS SUPERIOR (MOBILE)                                    */}
      {/* ========================================================================= */}
      <View style={estilos.subPestanaBarra}>
        <TouchableOpacity
          onPress={() => establecerActivoSubPestana("avance")}
          style={[estilos.subPestanaElemento, activoSubPestana === "avance" && estilos.subPestanaElementoActivo]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trending-up-outline"
            size={16}
            color={activoSubPestana === "avance" ? "#ffffff" : "#94a3b8"}
          />
          <Text style={[estilos.subPestanaEtiqueta, activoSubPestana === "avance" && estilos.subPestanaEtiquetaActivo]}>
            Avance (0-100%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => establecerActivoSubPestana("sobrante")}
          style={[estilos.subPestanaElemento, activoSubPestana === "sobrante" && estilos.subPestanaElementoActivo]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="return-down-back-outline"
            size={16}
            color={activoSubPestana === "sobrante" ? "#ffffff" : "#94a3b8"}
          />
          <Text style={[estilos.subPestanaEtiqueta, activoSubPestana === "sobrante" && estilos.subPestanaEtiquetaActivo]}>
            Devolver Sobrante
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. REGISTRAR AVANCE                                                       */}
      {/* ========================================================================= */}
      {activoSubPestana === "avance" && (
        <FormularioReporteAvance
          proyectoInicialId={seleccionadoProyectoId}
          mostrarHistorial={true}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. DEVOLVER SOBRANTE                                                      */}
      {/* ========================================================================= */}
      {activoSubPestana === "sobrante" && (
        <View style={{ flex: 1 }}>
          <PantallaDevoluciones showHeader={false} />
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  subPestanaBarra: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    padding: 3,
    marginHorizontal: tema.spacing.md,
    marginTop: tema.spacing.sm,
    marginBottom: tema.spacing.xs,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: "#334155",
  },
  subPestanaElemento: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: tema.radius.full,
  },
  subPestanaElementoActivo: {
    backgroundColor: tema.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  subPestanaEtiqueta: {
    fontSize: tema.fontSize.xs,
    color: "#94a3b8",
    fontWeight: "600",
    marginLeft: 4,
  },
  subPestanaEtiquetaActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
});