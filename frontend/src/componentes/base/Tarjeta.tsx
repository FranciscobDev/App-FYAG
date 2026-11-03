import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { tema } from "@/nucleo/tema";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "outlined" | "accent";
}

export const Tarjeta: React.FC<CardProps> = ({
  children,
  style,
  variant = "default",
}) => {
  return (
    <View
      style={[
        estilos.tarjeta,
        variant === "elevated" && estilos.elevated,
        variant === "outlined" && estilos.outlined,
        variant === "accent" && estilos.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.lg,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.border,
    ...tema.shadows.subtle,
    marginBottom: tema.spacing.md,
  },
  elevated: {
    ...tema.shadows.md,
    borderColor: tema.colors.borderLight,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderColor: tema.colors.borderDark,
  },
  accent: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
});
