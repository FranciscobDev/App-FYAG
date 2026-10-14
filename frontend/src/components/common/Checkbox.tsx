import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  error,
  containerStyle,
}) => {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TouchableOpacity
        onPress={() => !disabled && onChange(!checked)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={`${label}${description ? `: ${description}` : ""}`}
        style={[
          styles.container,
          disabled && styles.containerDisabled,
        ]}
      >
        <View
          style={[
            styles.checkboxBox,
            checked && styles.checkboxChecked,
            Boolean(error) && styles.checkboxError,
            disabled && styles.checkboxBoxDisabled,
          ]}
        >
          {checked && (
            <Ionicons name="checkmark" size={16} color={theme.colors.textInverse} />
          )}
        </View>

        <View style={styles.textCol}>
          <Text
            style={[
              styles.label,
              disabled && styles.textDisabled,
              checked && styles.labelChecked,
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text style={[styles.description, disabled && styles.textDisabled]}>
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {Boolean(error) && (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.sm,
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px de alto táctil
    paddingVertical: 8,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxError: {
    borderColor: theme.colors.danger,
  },
  checkboxBoxDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  labelChecked: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  description: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 32,
    marginTop: 2,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginLeft: 4,
  },
});
