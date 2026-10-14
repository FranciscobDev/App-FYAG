import React from "react";
import {
  StyleProp,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/core/theme";

export interface SwitchProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  description?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
  containerStyle,
}) => {
  return (
    <TouchableOpacity
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={`${label}${description ? `: ${description}` : ""}`}
      style={[
        styles.container,
        disabled && styles.containerDisabled,
        containerStyle,
      ]}
    >
      <View style={styles.textCol}>
        <Text style={[styles.label, disabled && styles.textDisabled]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.description, disabled && styles.textDisabled]}>
            {description}
          </Text>
        )}
      </View>

      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: theme.colors.borderDark,
          true: theme.colors.primary,
        }}
        thumbColor={value ? theme.colors.textInverse : theme.colors.background}
        ios_backgroundColor={theme.colors.borderDark}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  textCol: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
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
});
