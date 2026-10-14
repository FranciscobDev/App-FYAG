import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/core/theme";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  label?: string;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Componente Spinner Minimalista:
 * Indicador de carga accesible y liviano para estados asíncronos.
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  color = theme.colors.primary,
  label,
  inline = false,
  style,
}) => {
  const indicatorSize = size === "lg" ? "large" : "small";

  return (
    <View
      style={[
        styles.container,
        inline ? styles.inline : styles.stacked,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label || "Cargando..."}
    >
      <ActivityIndicator size={indicatorSize} color={color} />
      {Boolean(label) && (
        <Text
          style={[
            styles.label,
            size === "sm" && styles.labelSm,
            size === "lg" && styles.labelLg,
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  stacked: {
    flexDirection: "column",
    padding: theme.spacing.md,
  },
  inline: {
    flexDirection: "row",
    paddingVertical: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  labelSm: {
    fontSize: theme.fontSize.caption,
  },
  labelLg: {
    fontSize: theme.fontSize.base,
    marginTop: theme.spacing.sm,
  },
});
