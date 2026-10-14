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
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: theme.spacing.md,
  },
  elevated: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
