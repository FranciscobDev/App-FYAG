import React, { useState } from "react";
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

export interface SelectOption<T = string | number> {
  label: string;
  value: T;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SelectProps<T = string | number> {
  label: string;
  options: SelectOption<T>[];
  value?: T;
  onChange: (val: T) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Select<T = string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = "Seleccione una opción...",
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
}: SelectProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (val: T) => {
    onChange(val);
    setModalOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
      </Text>

      {/* Botón trigger táctil (mínimo 44 px) */}
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
          name="chevron-down-outline"
          size={18}
          color={disabled ? theme.colors.textMuted : theme.colors.textSecondary}
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

      {/* Modal Bottom Sheet Selector */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
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
                      <View>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
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
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "75%",
    paddingBottom: 24,
    ...theme.shadows.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  optionsList: {
    paddingHorizontal: theme.spacing.md,
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
  optionLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  optionLabelSelected: {
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  optionHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
