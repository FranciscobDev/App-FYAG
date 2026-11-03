import React from "react";
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { CampoBusqueda } from "./CampoBusqueda";

export interface ChipFiltro<T = string> {
  id: T;
  label: string;
  count?: number;
  color?: string;
}

export interface PropiedadesBarraFiltros<T = string> {
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  chips?: ChipFiltro<T>[];
  selectedChip?: T;
  onSelectChip?: (id: T) => void;
  selectedChips?: T[]; // For multi-select
  onToggleMultiChip?: (id: T) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function BarraFiltros<T = string>({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Filtrar por texto...",
  chips,
  selectedChip,
  onSelectChip,
  selectedChips,
  onToggleMultiChip,
  onClearFilters,
  hasActiveFilters = false,
  containerStyle,
}: PropiedadesBarraFiltros<T>) {
  const esSeleccionado = (id: T) => {
    if (selectedChips) return selectedChips.includes(id);
    return selectedChip === id;
  };

  const manejarChipPress = (id: T) => {
    if (onToggleMultiChip) {
      onToggleMultiChip(id);
    } else if (onSelectChip) {
      onSelectChip(id);
    }
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Barra de Búsqueda */}
      {onSearchChange && (
        <View style={estilos.buscarFila}>
          <View style={{ flex: 1 }}>
            <CampoBusqueda
              value={searchQuery || ""}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </View>

          {hasActiveFilters && onClearFilters && (
            <TouchableOpacity
              onPress={onClearFilters}
              style={estilos.limpiarBoton}
              activeOpacity={0.7}
              accessibilityLabel="Limpiar todos los filtros"
            >
              <Ionicons name="refresh-outline" size={16} color={tema.colors.danger} />
              <Text style={estilos.limpiarBotonTexto}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chips de Estado Horizontales */}
      {chips && chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.chipsScroll}
          contentContainerStyle={estilos.chipsScrollContenido}
        >
          {chips.map((chip) => {
            const activo = esSeleccionado(chip.id);
            return (
              <TouchableOpacity
                key={String(chip.id)}
                onPress={() => manejarChipPress(chip.id)}
                activeOpacity={0.7}
                style={[
                  estilos.chip,
                  activo && estilos.chipActivo,
                ]}
              >
                {chip.color && (
                  <View
                    style={[
                      estilos.colorPunto,
                      { backgroundColor: chip.color },
                    ]}
                  />
                )}
                <Text
                  style={[
                    estilos.chipEtiqueta,
                    activo && estilos.chipEtiquetaActivo,
                  ]}
                >
                  {chip.label}
                </Text>
                {chip.count !== undefined && (
                  <View
                    style={[
                      estilos.conteoInsignia,
                      activo && estilos.conteoInsigniaActivo,
                    ]}
                  >
                    <Text
                      style={[
                        estilos.conteoTexto,
                        activo && estilos.conteoTextoActivo,
                      ]}
                    >
                      {chip.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
    ...tema.shadows.sm,
  },
  buscarFila: {
    flexDirection: "row",
    alignItems: "center",
  },
  limpiarBoton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.md,
    minHeight: 44,
  },
  limpiarBotonTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
    marginLeft: 4,
  },
  chipsScroll: {
    marginTop: tema.spacing.sm,
  },
  chipsScrollContenido: {
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tema.radius.full,
    marginRight: 8,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px accesible
  },
  chipActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  colorPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  chipEtiquetaActivo: {
    color: tema.colors.primaryDark,
    fontWeight: tema.fontWeight.semibold,
  },
  conteoInsignia: {
    backgroundColor: tema.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    marginLeft: 6,
  },
  conteoInsigniaActivo: {
    backgroundColor: tema.colors.primary,
  },
  conteoTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textMuted,
  },
  conteoTextoActivo: {
    color: tema.colors.textInverse,
  },
});
