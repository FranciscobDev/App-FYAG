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
import { theme } from "@/core/theme";
import { SearchInput } from "./SearchInput";

export interface FilterChip<T = string> {
  id: T;
  label: string;
  count?: number;
  color?: string;
}

export interface FilterBarProps<T = string> {
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip<T>[];
  selectedChip?: T;
  onSelectChip?: (id: T) => void;
  selectedChips?: T[]; // For multi-select
  onToggleMultiChip?: (id: T) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function FilterBar<T = string>({
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
}: FilterBarProps<T>) {
  const isSelected = (id: T) => {
    if (selectedChips) return selectedChips.includes(id);
    return selectedChip === id;
  };

  const handleChipPress = (id: T) => {
    if (onToggleMultiChip) {
      onToggleMultiChip(id);
    } else if (onSelectChip) {
      onSelectChip(id);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Barra de Búsqueda */}
      {onSearchChange && (
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchInput
              value={searchQuery || ""}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </View>

          {hasActiveFilters && onClearFilters && (
            <TouchableOpacity
              onPress={onClearFilters}
              style={styles.clearBtn}
              activeOpacity={0.7}
              accessibilityLabel="Limpiar todos los filtros"
            >
              <Ionicons name="refresh-outline" size={16} color={theme.colors.danger} />
              <Text style={styles.clearBtnText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chips de Estado Horizontales */}
      {chips && chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {chips.map((chip) => {
            const active = isSelected(chip.id);
            return (
              <TouchableOpacity
                key={String(chip.id)}
                onPress={() => handleChipPress(chip.id)}
                activeOpacity={0.7}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                ]}
              >
                {chip.color && (
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: chip.color },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.chipLabel,
                    active && styles.chipLabelActive,
                  ]}
                >
                  {chip.label}
                </Text>
                {chip.count !== undefined && (
                  <View
                    style={[
                      styles.countBadge,
                      active && styles.countBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        active && styles.countTextActive,
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: theme.radius.md,
    minHeight: 44,
  },
  clearBtnText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    marginLeft: 4,
  },
  chipsScroll: {
    marginTop: theme.spacing.sm,
  },
  chipsScrollContent: {
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    marginRight: 8,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px accesible
  },
  chipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  chipLabelActive: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  countBadge: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginLeft: 6,
  },
  countBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  countText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
  },
  countTextActive: {
    color: theme.colors.textInverse,
  },
});
