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
import { theme } from "@/core/theme";
import { useAuth } from "@/context/AuthContext";

// State Components
import { Skeleton } from "./Skeleton";
import { EmptyState, EmptyStateProps } from "./EmptyState";
import { ErrorState, ErrorStateProps } from "./ErrorState";
import { ForbiddenState, ForbiddenStateProps } from "./ForbiddenState";
import { OfflineBanner } from "./OfflineBanner";
import { Card } from "./Card";

export type ScreenStateMode = "normal" | "loading" | "empty" | "error" | "forbidden" | "offline";

export interface ScreenStateWrapperProps {
  screenTitle?: string;
  defaultMode?: ScreenStateMode;
  mode?: ScreenStateMode;
  onModeChange?: (mode: ScreenStateMode) => void;
  // Custom states configuration
  skeletonType?: "table" | "cards" | "kpis" | "form" | "custom";
  customSkeleton?: React.ReactNode;
  emptyProps?: Partial<EmptyStateProps>;
  errorProps?: Partial<ErrorStateProps>;
  forbiddenProps?: Partial<ForbiddenStateProps>;
  showSimulatorBar?: boolean;
  children: React.ReactNode;
}

export const ScreenStateWrapper: React.FC<ScreenStateWrapperProps> = ({
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
  const [internalMode, setInternalMode] = useState<ScreenStateMode>(defaultMode);
  const [simulatorExpanded, setSimulatorExpanded] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  const { currentRole, setRole } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const currentMode = controlledMode !== undefined ? controlledMode : internalMode;

  const handleSelectMode = (newMode: ScreenStateMode) => {
    if (newMode === "offline") {
      setIsSimulatedOffline(true);
    } else {
      setIsSimulatedOffline(false);
    }

    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };

  const handleRetry = () => {
    // If retry is pressed, return to normal or call custom retry
    if (errorProps?.onRetry) {
      errorProps.onRetry();
    }
    handleSelectMode("normal");
  };

  const handleRoleAction = () => {
    if (forbiddenProps?.onAction) {
      forbiddenProps.onAction();
    } else {
      // Toggle to admin or next role
      setRole("admin");
      handleSelectMode("normal");
    }
  };

  // Render Skeleton based on layout type
  const renderSkeleton = () => {
    if (customSkeleton) return customSkeleton;

    if (skeletonType === "cards") {
      return (
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonKpiRow}>
            <View style={styles.skeletonKpiItem}>
              <Skeleton height={20} width="60%" borderRadius={4} />
              <Skeleton height={32} width="40%" borderRadius={6} style={{ marginTop: 8 }} />
            </View>
            <View style={styles.skeletonKpiItem}>
              <Skeleton height={20} width="50%" borderRadius={4} />
              <Skeleton height={32} width="45%" borderRadius={6} style={{ marginTop: 8 }} />
            </View>
          </View>
          <View style={{ gap: 12, marginTop: 16 }}>
            {[1, 2, 3].map((key) => (
              <Card key={key} style={styles.skeletonCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Skeleton height={22} width="45%" borderRadius={4} />
                  <Skeleton height={22} width={70} borderRadius={12} />
                </View>
                <Skeleton height={16} width="85%" borderRadius={4} />
                <Skeleton height={16} width="60%" borderRadius={4} style={{ marginTop: 4 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                  <Skeleton height={14} width="30%" borderRadius={4} />
                  <Skeleton height={14} width="25%" borderRadius={4} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      );
    }

    if (skeletonType === "kpis") {
      return (
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonKpiGrid}>
            {[1, 2, 3, 4].map((k) => (
              <View key={k} style={styles.skeletonKpiBox}>
                <Skeleton height={18} width="50%" borderRadius={4} />
                <Skeleton height={36} width="65%" borderRadius={6} style={{ marginVertical: 8 }} />
                <Skeleton height={14} width="80%" borderRadius={4} />
              </View>
            ))}
          </View>
          <Card style={{ padding: 16, marginTop: 16 }}>
            <Skeleton height={24} width="35%" borderRadius={4} style={{ marginBottom: 12 }} />
            <Skeleton height={120} width="100%" borderRadius={8} />
          </Card>
        </View>
      );
    }

    if (skeletonType === "form") {
      return (
        <Card style={{ padding: 20 }}>
          <Skeleton height={24} width="40%" borderRadius={4} style={{ marginBottom: 16 }} />
          <Skeleton height={16} width="30%" borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={44} width="100%" borderRadius={8} style={{ marginBottom: 16 }} />
          <Skeleton height={16} width="25%" borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={44} width="100%" borderRadius={8} style={{ marginBottom: 16 }} />
          <Skeleton height={16} width="35%" borderRadius={4} style={{ marginBottom: 6 }} />
          <Skeleton height={90} width="100%" borderRadius={8} style={{ marginBottom: 20 }} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
            <Skeleton height={44} width={100} borderRadius={8} />
            <Skeleton height={44} width={120} borderRadius={8} />
          </View>
        </Card>
      );
    }

    // Default: "table"
    return (
      <View style={styles.skeletonContainer}>
        {/* KPI Skeleton Row */}
        <View style={styles.skeletonKpiRow}>
          <View style={styles.skeletonKpiItem}>
            <Skeleton height={16} width="40%" borderRadius={4} />
            <Skeleton height={28} width="50%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.skeletonKpiItem}>
            <Skeleton height={16} width="45%" borderRadius={4} />
            <Skeleton height={28} width="40%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.skeletonKpiItem}>
            <Skeleton height={16} width="35%" borderRadius={4} />
            <Skeleton height={28} width="55%" borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Filter Bar Skeleton */}
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Skeleton height={40} width="40%" borderRadius={8} />
            <Skeleton height={40} width="25%" borderRadius={8} />
            <Skeleton height={40} width="20%" borderRadius={8} />
          </View>
        </Card>

        {/* Table Skeleton */}
        <Card style={{ padding: 12 }}>
          <Skeleton height={32} width="100%" borderRadius={6} style={{ marginBottom: 10 }} />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.skeletonTableRow}>
              <Skeleton height={18} width="20%" borderRadius={4} />
              <Skeleton height={18} width="35%" borderRadius={4} />
              <Skeleton height={18} width="15%" borderRadius={4} />
              <Skeleton height={18} width="15%" borderRadius={4} />
            </View>
          ))}
        </Card>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* 1. Barra de Simulación de Estados (Paso 12) */}
      {showSimulatorBar && (
        <View style={styles.simulatorBarContainer}>
          <TouchableOpacity
            style={styles.simulatorToggleBtn}
            onPress={() => setSimulatorExpanded(!simulatorExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.simulatorToggleLeft}>
              <Ionicons name="options" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.simulatorToggleTitle} numberOfLines={1} ellipsizeMode="tail">
                {screenTitle ? `${screenTitle} — ` : ""}Simulador de Estados
              </Text>
              <View
                style={[
                  styles.modePill,
                  currentMode === "normal" && styles.modePillNormal,
                  currentMode === "loading" && styles.modePillLoading,
                  currentMode === "empty" && styles.modePillEmpty,
                  currentMode === "error" && styles.modePillError,
                  currentMode === "forbidden" && styles.modePillForbidden,
                  currentMode === "offline" && styles.modePillOffline,
                ]}
              >
                <Text style={styles.modePillText}>{currentMode.toUpperCase()}</Text>
              </View>
            </View>
            <Ionicons
              name={simulatorExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {simulatorExpanded && (
            <View style={styles.simulatorOptionsRow}>
              <Text style={styles.simulatorHelpText}>
                Selecciona un estado para verificar su renderizado, accesibilidad y comportamiento:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeChipsScroll}>
                {[
                  { id: "normal", label: "Normal (Datos)", icon: "checkmark-circle-outline", color: theme.colors.ok },
                  { id: "loading", label: "Cargando (Skeleton)", icon: "hourglass-outline", color: theme.colors.primary },
                  { id: "empty", label: "Vacío (Sin Datos)", icon: "file-tray-outline", color: theme.colors.textMuted },
                  { id: "error", label: "Error (Reintentar)", icon: "alert-circle-outline", color: theme.colors.danger },
                  { id: "forbidden", label: "Sin Permiso (403)", icon: "lock-closed-outline", color: theme.colors.warnDark },
                  { id: "offline", label: "Sin Conexión (Offline)", icon: "cloud-offline-outline", color: "#b45309" },
                ].map((item) => {
                  const isSelected = currentMode === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.stateChip, isSelected && styles.stateChipSelected]}
                      onPress={() => handleSelectMode(item.id as ScreenStateMode)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={15}
                        color={isSelected ? "#ffffff" : item.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.stateChipText, isSelected && styles.stateChipTextSelected]}>
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
      {(currentMode === "offline" || isSimulatedOffline) && (
        <OfflineBanner
          onToggle={(offline) => {
            setIsSimulatedOffline(offline);
            if (!offline && currentMode === "offline") {
              handleSelectMode("normal");
            }
          }}
        />
      )}

      {/* 3. Renderizado de Contenido según Estado */}
      <View style={styles.contentArea}>
        {currentMode === "loading" && renderSkeleton()}

        {currentMode === "empty" && (
          <EmptyState
            title={emptyProps?.title || "No se encontraron registros"}
            description={
              emptyProps?.description ||
              "No existen elementos disponibles en este momento o los filtros aplicados no arrojaron coincidencias."
            }
            actionTitle={emptyProps?.actionTitle || "Restablecer Filtros"}
            onAction={emptyProps?.onAction || (() => handleSelectMode("normal"))}
            icon={emptyProps?.icon || "file-tray-outline"}
          />
        )}

        {currentMode === "error" && (
          <ErrorState
            title={errorProps?.title || "Error al sincronizar con el servidor"}
            message={
              errorProps?.message ||
              "No se pudo cargar la información desde la base de datos central. Verifique los servicios de red o intente nuevamente."
            }
            retryTitle={errorProps?.retryTitle || "Reintentar Operación"}
            onRetry={handleRetry}
          />
        )}

        {currentMode === "forbidden" && (
          <ForbiddenState
            title={forbiddenProps?.title || "Acceso Restringido para este Módulo"}
            message={
              forbiddenProps?.message ||
              `Tu rol actual (${currentRole}) no tiene los privilegios de seguridad necesarios para acceder a esta vista.`
            }
            actionTitle={forbiddenProps?.actionTitle || "Cambiar a Rol Administrador"}
            onAction={handleRoleAction}
          />
        )}

        {(currentMode === "normal" || currentMode === "offline") && children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  simulatorBarContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  simulatorToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  simulatorToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  simulatorToggleTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  modePillNormal: { backgroundColor: theme.colors.okLight },
  modePillLoading: { backgroundColor: theme.colors.primaryLight },
  modePillEmpty: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  modePillError: { backgroundColor: theme.colors.dangerLight },
  modePillForbidden: { backgroundColor: theme.colors.warnLight },
  modePillOffline: { backgroundColor: "#fef3c7" },
  modePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.text,
  },
  simulatorOptionsRow: {
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    marginTop: 6,
  },
  simulatorHelpText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  modeChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  stateChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  stateChipTextSelected: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  contentArea: {
    flex: 1,
  },

  // Skeleton Styles
  skeletonContainer: {
    padding: theme.spacing.md,
  },
  skeletonKpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  skeletonKpiItem: {
    flex: 1,
    backgroundColor: theme.colors.card,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skeletonKpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  skeletonKpiBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skeletonCard: {
    padding: 16,
  },
  skeletonTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
});
