import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { theme } from "@/core/theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "outlined" | "accent";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = "default",
}) => {
  return (
    <View
      style={[
        styles.card,
        variant === "elevated" && styles.elevated,
        variant === "outlined" && styles.outlined,
        variant === "accent" && styles.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.border,
    ...theme.shadows.subtle,
    marginBottom: theme.spacing.md,
  },
  elevated: {
    ...theme.shadows.md,
    borderColor: theme.colors.borderLight,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderColor: theme.colors.borderDark,
  },
  accent: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
});
