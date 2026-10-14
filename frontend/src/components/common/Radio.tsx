import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/core/theme";

export interface RadioOption<T = string | number> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T = string | number> {
  label?: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (val: T) => void;
  required?: boolean;
  error?: string;
  horizontal?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function RadioGroup<T = string | number>({
  label,
  options,
  value,
  onChange,
  required = false,
  error,
  horizontal = false,
  containerStyle,
}: RadioGroupProps<T>) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.groupLabel}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
      )}

      <View style={[styles.optionsWrapper, horizontal && styles.optionsHorizontal]}>
        {options.map((opt, idx) => {
          const isSelected = opt.value === value;
          const isDisabled = opt.disabled;

          return (
            <TouchableOpacity
              key={String(opt.value) + idx}
              onPress={() => !isDisabled && onChange(opt.value)}
              disabled={isDisabled}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              accessibilityLabel={`${opt.label}${opt.description ? `: ${opt.description}` : ""}`}
              style={[
                styles.radioRow,
                horizontal && styles.radioRowHorizontal,
                isDisabled && styles.radioDisabled,
              ]}
            >
              <View
                style={[
                  styles.outerCircle,
                  isSelected && styles.outerCircleSelected,
                  Boolean(error) && styles.outerCircleError,
                  isDisabled && styles.outerCircleDisabled,
                ]}
              >
                {isSelected && <View style={styles.innerDot} />}
              </View>

              <View style={styles.textCol}>
                <Text
                  style={[
                    styles.optLabel,
                    isSelected && styles.optLabelSelected,
                    isDisabled && styles.textDisabled,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.description && (
                  <Text style={[styles.optDesc, isDisabled && styles.textDisabled]}>
                    {opt.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  groupLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  requiredMark: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  optionsWrapper: {
    flexDirection: "column",
  },
  optionsHorizontal: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingVertical: 8,
    marginRight: 16,
  },
  radioRowHorizontal: {
    marginRight: 20,
  },
  radioDisabled: {
    opacity: 0.6,
  },
  outerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 10,
  },
  outerCircleSelected: {
    borderColor: theme.colors.primary,
  },
  outerCircleError: {
    borderColor: theme.colors.danger,
  },
  outerCircleDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
  },
  optLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  optLabelSelected: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  optDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginTop: 4,
    fontWeight: theme.fontWeight.medium,
  },
});
