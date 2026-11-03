import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";

// State Components
import { EsqueletoCarga } from "./EsqueletoCarga";
import { EstadoVacio, PropiedadesEstadoVacio } from "./EstadoVacio";
import { EstadoError, PropiedadesEstadoError } from "./EstadoError";
import { EstadoProhibido, PropiedadesEstadoProhibido } from "./EstadoProhibido";
import { BannerSinConexion } from "@/componentes/dominio/BannerSinConexion";
import { Tarjeta } from "@/componentes/base/Tarjeta";

export type ModoEstadoPantalla = "normal" | "loading" | "empty" | "error" | "forbidden" | "offline";

export interface PropiedadesContenedorEstadoPantalla {
  screenTitle?: string;
  defaultMode?: ModoEstadoPantalla;
  mode?: ModoEstadoPantalla;
  onModeChange?: (mode: ModoEstadoPantalla) => void;
  // Custom states configuration
  skeletonType?: "table" | "cards" | "kpis" | "form" | "custom";
  customSkeleton?: React.ReactNode;
  emptyProps?: Partial<PropiedadesEstadoVacio>;
  errorProps?: Partial<PropiedadesEstadoError>;
  forbiddenProps?: Partial<PropiedadesEstadoProhibido>;
  showSimulatorBar?: boolean;
  children: React.ReactNode;
}

export const ContenedorEstadoPantalla: React.FC<PropiedadesContenedorEstadoPantalla> = ({
  screenTitle,
  defaultMode = "normal",
  mode: controlledMode,
  onModeChange,
  skeletonType = "table",
  customSkeleton,
  emptyProps,
  errorProps,
  forbiddenProps,
  showSimulatorBar = false,
  children,
}) => {
  const [internalModo, establecerInternalModo] = useState<ModoEstadoPantalla>(defaultMode);
  const [simulatorExpanded, establecerSimulatorExpanded] = useState(false);
  const [esSimulatedSinConexion, establecerEsSimulatedSinConexion] = useState(false);

  const { rolActual, establecerRol } = usarAutenticacion();
  const { width } = useWindowDimensions();
  const esMobile = width < 768;

  const actualModo = controlledMode !== undefined ? controlledMode : internalModo;

  const manejarSeleccionarModo = (newMode: ModoEstadoPantalla) => {
    if (newMode === "offline") {
      establecerEsSimulatedSinConexion(true);
    } else {
      establecerEsSimulatedSinConexion(false);
    }

    if (onModeChange) {
      onModeChange(newMode);
    } else {
      establecerInternalModo(newMode);
    }
  };

  const manejarRetry = () => {
    // If retry is pressed, return to normal or call custom retry
    if (errorProps?.onRetry) {
      errorProps.onRetry();
    }
    manejarSeleccionarModo("normal");
  };

  const manejarRolAccion = () => {
    if (forbiddenProps?.onAction) {
      forbiddenProps.onAction();
    } else {
      // Toggle to admin or next role
      establecerRol("admin");
      manejarSeleccionarModo("normal");
    }
  };

  // Render Skeleton based on layout type
  const renderizarSkeleton = () => {
    if (customSkeleton) return customSkeleton;

    if (skeletonType === "cards") {
      return (
        <View style={estilos.skeletonContenedor}>
          <View style={estilos.skeletonKpiFila}>
            <View style={estilos.skeletonKpiElemento}>
              <EsqueletoCarga height={20} width="60%" borderRadius={4} />
              <EsqueletoCarga height={32} width="40%" borderRadius={6} style={{ marginTop: 8 }} />
            </View>
            <View style={estilos.skeletonKpiElemento}>
              <EsqueletoCarga height={20} width="50%" borderRadius={4} />
              <EsqueletoCarga height={32} width="45%" borderRadius={6} style={{ marginTop: 8 }} />
            </View>
          </View>
          <View style={{ gap: 12, marginTop: 16 }}>
            {[1, 2, 3].map((key) => (
              <Tarjeta key={key} style={estilos.skeletonTarjeta}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <EsqueletoCarga height={22} width="45%" borderRadius={4} />
                  <EsqueletoCarga height={22} width={70} borderRadius={12} />
                </View>
                <EsqueletoCarga height={16} width="85%" borderRadius={4} />
                <EsqueletoCarga height={16} width="60%" borderRadius={4} style={{ marginTop: 4 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                  <EsqueletoCarga height={14} width="30%" borderRadius={4} />
                  <EsqueletoCarga height={14} width="25%" borderRadius={4} />
                </View>
              </Tarjeta>
            ))}
          </View>
        </View>
      );
    }

    if (skeletonType === "kpis") {
      return (
        <View style={estilos.skeletonContenedor}>
          <View style={estilos.skeletonKpiGrilla}>
            {[1, 2, 3, 4].map((k) => (
              <View key={k} style={estilos.skeletonKpiCaja}>
                <EsqueletoCarga height={18} width="50%" borderRadius={4} />
                <EsqueletoCarga height={36} width="65%" borderRadius={6} style={{ marginVertical: 8 }} />
                <EsqueletoCarga height={14} width="80%" borderRadius={4} />
              </View>
            ))}
          </View>
          <Tarjeta style={{ padding: 16, marginTop: 16 }}>
            <EsqueletoCarga height={24} width="35%" borderRadius={4} style={{ marginBottom: 12 }} />
            <EsqueletoCarga height={120} width="100%" borderRadius={8} />
          </Tarjeta>
        </View>
      );
    }

    if (skeletonType === "form") {
      return (
        <Tarjeta style={{ padding: 20 }}>
          <EsqueletoCarga height={24} width="40%" borderRadius={4} style={{ marginBottom: 16 }} />
          <EsqueletoCarga height={16} width="30%" borderRadius={4} style={{ marginBottom: 6 }} />
          <EsqueletoCarga height={44} width="100%" borderRadius={8} style={{ marginBottom: 16 }} />
          <EsqueletoCarga height={16} width="25%" borderRadius={4} style={{ marginBottom: 6 }} />
          <EsqueletoCarga height={44} width="100%" borderRadius={8} style={{ marginBottom: 16 }} />
          <EsqueletoCarga height={16} width="35%" borderRadius={4} style={{ marginBottom: 6 }} />
          <EsqueletoCarga height={90} width="100%" borderRadius={8} style={{ marginBottom: 20 }} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
            <EsqueletoCarga height={44} width={100} borderRadius={8} />
            <EsqueletoCarga height={44} width={120} borderRadius={8} />
          </View>
        </Tarjeta>
      );
    }

    // Default: "table"
    return (
      <View style={estilos.skeletonContenedor}>
        {/* KPI Skeleton Row */}
        <View style={estilos.skeletonKpiFila}>
          <View style={estilos.skeletonKpiElemento}>
            <EsqueletoCarga height={16} width="40%" borderRadius={4} />
            <EsqueletoCarga height={28} width="50%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={estilos.skeletonKpiElemento}>
            <EsqueletoCarga height={16} width="45%" borderRadius={4} />
            <EsqueletoCarga height={28} width="40%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={estilos.skeletonKpiElemento}>
            <EsqueletoCarga height={16} width="35%" borderRadius={4} />
            <EsqueletoCarga height={28} width="55%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Filter Bar Skeleton */}
        <Tarjeta style={{ padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <EsqueletoCarga height={40} width="40%" borderRadius={8} />
            <EsqueletoCarga height={40} width="25%" borderRadius={8} />
            <EsqueletoCarga height={40} width="20%" borderRadius={8} />
          </View>
        </Tarjeta>

        {/* Table Skeleton */}
        <Tarjeta style={{ padding: 12 }}>
          <EsqueletoCarga height={32} width="100%" borderRadius={6} style={{ marginBottom: 10 }} />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={estilos.skeletonTablaFila}>
              <EsqueletoCarga height={18} width="20%" borderRadius={4} />
              <EsqueletoCarga height={18} width="35%" borderRadius={4} />
              <EsqueletoCarga height={18} width="15%" borderRadius={4} />
              <EsqueletoCarga height={18} width="15%" borderRadius={4} />
            </View>
          ))}
        </Tarjeta>
      </View>
    );
  };

  return (
    <View style={estilos.envoltorio}>
      {/* 1. Barra de Simulación de Estados (Paso 12) */}
      {showSimulatorBar && (
        <View style={estilos.simulatorBarraContenedor}>
          <TouchableOpacity
            style={estilos.simulatorAlternarBoton}
            onPress={() => establecerSimulatorExpanded(!simulatorExpanded)}
            activeOpacity={0.8}
          >
            <View style={estilos.simulatorAlternarIzquierda}>
              <Ionicons name="options" size={16} color={tema.colors.primaryDark} />
              <Text style={estilos.simulatorAlternarTitulo} numberOfLines={1} ellipsizeMode="tail">
                {screenTitle ? `${screenTitle} — ` : ""}Simulador de Estados
              </Text>
              <View
                style={[
                  estilos.modoPastilla,
                  actualModo === "normal" && estilos.modoPastillaNormal,
                  actualModo === "loading" && estilos.modoPastillaCargando,
                  actualModo === "empty" && estilos.modoPastillaVacio,
                  actualModo === "error" && estilos.modoPastillaError,
                  actualModo === "forbidden" && estilos.modoPastillaForbidden,
                  actualModo === "offline" && estilos.modoPastillaSinConexion,
                ]}
              >
                <Text style={estilos.modoPastillaTexto}>{actualModo.toUpperCase()}</Text>
              </View>
            </View>
            <Ionicons
              name={simulatorExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={tema.colors.textMuted}
            />
          </TouchableOpacity>

          {simulatorExpanded && (
            <View style={estilos.simulatorOpcionesFila}>
              <Text style={estilos.simulatorHelpTexto}>
                Selecciona un estado para verificar su renderizado, accesibilidad y comportamiento:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.modoChipsScroll}>
                {[
                  { id: "normal", label: "Normal (Datos)", icon: "checkmark-circle-outline", color: tema.colors.ok },
                  { id: "loading", label: "Cargando (Skeleton)", icon: "hourglass-outline", color: tema.colors.primary },
                  { id: "empty", label: "Vacío (Sin Datos)", icon: "file-tray-outline", color: tema.colors.textMuted },
                  { id: "error", label: "Error (Reintentar)", icon: "alert-circle-outline", color: tema.colors.danger },
                  { id: "forbidden", label: "Sin Permiso (403)", icon: "lock-closed-outline", color: tema.colors.warnDark },
                  { id: "offline", label: "Sin Conexión (Offline)", icon: "cloud-offline-outline", color: "#b45309" },
                ].map((item) => {
                  const esSeleccionado = actualModo === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[estilos.estadoChip, esSeleccionado && estilos.estadoChipSeleccionado]}
                      onPress={() => manejarSeleccionarModo(item.id as ModoEstadoPantalla)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={15}
                        color={esSeleccionado ? "#ffffff" : item.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[estilos.estadoChipTexto, esSeleccionado && estilos.estadoChipTextoSeleccionado]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* 2. Banner de Modo Sin Conexión */}
      {(actualModo === "offline" || esSimulatedSinConexion) && (
        <BannerSinConexion
          onToggle={(offline) => {
            establecerEsSimulatedSinConexion(offline);
            if (!offline && actualModo === "offline") {
              manejarSeleccionarModo("normal");
            }
          }}
        />
      )}

      {/* 3. Renderizado de Contenido según Estado */}
      <View style={estilos.contenidoArea}>
        {actualModo === "loading" && renderizarSkeleton()}

        {actualModo === "empty" && (
          <EstadoVacio
            title={emptyProps?.title || "No se encontraron registros"}
            description={
              emptyProps?.description ||
              "No existen elementos disponibles en este momento o los filtros aplicados no arrojaron coincidencias."
            }
            actionTitle={emptyProps?.actionTitle || "Restablecer Filtros"}
            onAction={emptyProps?.onAction || (() => manejarSeleccionarModo("normal"))}
            icon={emptyProps?.icon || "file-tray-outline"}
          />
        )}

        {actualModo === "error" && (
          <EstadoError
            title={errorProps?.title || "Error al sincronizar con el servidor"}
            message={
              errorProps?.message ||
              "No se pudo cargar la información desde la base de datos central. Verifique los servicios de red o intente nuevamente."
            }
            retryTitle={errorProps?.retryTitle || "Reintentar Operación"}
            onRetry={manejarRetry}
          />
        )}

        {actualModo === "forbidden" && (
          <EstadoProhibido
            title={forbiddenProps?.title || "Acceso Restringido para este Módulo"}
            message={
              forbiddenProps?.message ||
              `Tu rol actual (${rolActual}) no tiene los privilegios de seguridad necesarios para acceder a esta vista.`
            }
            actionTitle={forbiddenProps?.actionTitle || "Cambiar a Rol Administrador"}
            onAction={manejarRolAccion}
          />
        )}

        {(actualModo === "normal" || actualModo === "offline") && children}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  envoltorio: {
    flex: 1,
  },
  simulatorBarraContenedor: {
    backgroundColor: tema.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  simulatorAlternarBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  simulatorAlternarIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  simulatorAlternarTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.textSecondary,
    flexShrink: 1,
  },
  modoPastilla: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.border,
  },
  modoPastillaNormal: { backgroundColor: tema.colors.okLight },
  modoPastillaCargando: { backgroundColor: tema.colors.primaryLight },
  modoPastillaVacio: { backgroundColor: tema.colors.surfaceAlt, borderWidth: 1, borderColor: tema.colors.border },
  modoPastillaError: { backgroundColor: tema.colors.dangerLight },
  modoPastillaForbidden: { backgroundColor: tema.colors.warnLight },
  modoPastillaSinConexion: { backgroundColor: "#fef3c7" },
  modoPastillaTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: tema.colors.text,
  },
  simulatorOpcionesFila: {
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    marginTop: 6,
  },
  simulatorHelpTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 6,
  },
  modoChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  estadoChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  estadoChipSeleccionado: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  estadoChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  estadoChipTextoSeleccionado: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  contenidoArea: {
    flex: 1,
  },

  // Skeleton Styles
  skeletonContenedor: {
    padding: tema.spacing.md,
  },
  skeletonKpiFila: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  skeletonKpiElemento: {
    flex: 1,
    backgroundColor: tema.colors.card,
    padding: 14,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  skeletonKpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  skeletonKpiCaja: {
    flex: 1,
    minWidth: 160,
    backgroundColor: tema.colors.card,
    padding: 16,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  skeletonTarjeta: {
    padding: 16,
  },
  skeletonTablaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
});
