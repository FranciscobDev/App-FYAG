import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
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

export interface ComboboxOption<T = string | number> {
  label: string;
  value: T;
  hint?: string;
  badge?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface ComboboxProps<T = string | number> {
  label: string;
  options: ComboboxOption<T>[];
  value?: T;
  onChange: (val: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Combobox<T = string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = "Buscar o seleccionar...",
  searchPlaceholder = "Escriba para filtrar...",
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
}: ComboboxProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const handleSelect = (val: T) => {
    onChange(val);
    setModalOpen(false);
    setSearchQuery("");
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
      </Text>

      {/* Trigger Táctil */}
      <TouchableOpacity
        onPress={() => !disabled && setModalOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${selectedOption ? selectedOption.label : placeholder}`}
        style={[
          styles.trigger,
          Boolean(error) && styles.triggerError,
          disabled && styles.triggerDisabled,
        ]}
      >
        <View style={styles.valueRow}>
          {selectedOption?.icon && (
            <Ionicons
              name={selectedOption.icon}
              size={18}
              color={theme.colors.primaryDark}
              style={styles.selectedIcon}
            />
          )}
          <Text
            style={[
              styles.valueText,
              !selectedOption && styles.placeholderText,
              disabled && styles.textDisabled,
            ]}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>

        <Ionicons
          name="swap-vertical-outline"
          size={18}
          color={disabled ? theme.colors.textMuted : theme.colors.primaryDark}
        />
      </TouchableOpacity>

      {Boolean(error) ? (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}

      {/* Modal con Barra de Búsqueda Integrada */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setModalOpen(false);
            setSearchQuery("");
          }}
        >
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalOpen(false);
                  setSearchQuery("");
                }}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Barra de Búsqueda con foco instantáneo */}
            <View style={styles.searchContainer}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={searchPlaceholder}
              />
            </View>

            {/* Lista Filtrada */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item, index) => String(item.value) + index}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionInfo}>
                      {item.icon && (
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                          style={styles.optionIcon}
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.labelBadgeRow}>
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.badge && (
                            <View style={styles.badgeChip}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
                        {item.hint && (
                          <Text style={styles.optionHint}>{item.hint}</Text>
                        )}
                      </View>
                    </View>

                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={32} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>No se encontraron coincidencias</Text>
                </View>
              }
              style={styles.optionsList}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  requiredMark: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: theme.spacing.md,
  },
  triggerError: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerLight,
  },
  triggerDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  selectedIcon: {
    marginRight: 8,
  },
  valueText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  placeholderText: {
    color: theme.colors.textLight,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  helperText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    maxHeight: "85%",
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  optionsList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    minHeight: 48,
  },
  optionRowSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
  },
  optionInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  optionIcon: {
    marginRight: 10,
  },
  labelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  optionLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  optionLabelSelected: {
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  badgeChip: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
  },
  optionHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
});
