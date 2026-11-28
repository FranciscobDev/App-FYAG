import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { tema } from "@/nucleo/tema";

export interface PropiedadesIndicadorCarga {
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
export const IndicadorCarga: React.FC<PropiedadesIndicadorCarga> = ({
  size = "md",
  color = tema.colors.primary,
  label,
  inline = false,
  style,
}) => {
  const indicatorTamano = size === "lg" ? "large" : "small";

  return (
    <View
      style={[
        estilos.contenedor,
        inline ? estilos.inline : estilos.stacked,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label || "Cargando..."}
    >
      <ActivityIndicator size={indicatorTamano} color={color} />
      {Boolean(label) && (
        <Text
          style={[
            estilos.etiqueta,
            size === "sm" && estilos.etiquetaPeq,
            size === "lg" && estilos.etiquetaGde,
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    justifyContent: "center",
  },
  stacked: {
    flexDirection: "column",
    padding: tema.spacing.md,
  },
  inline: {
    flexDirection: "row",
    paddingVertical: tema.spacing.xs,
  },
  etiqueta: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textMuted,
    fontWeight: tema.fontWeight.medium,
    marginTop: tema.spacing.xs,
    marginLeft: tema.spacing.xs,
  },
  etiquetaPeq: {
    fontSize: tema.fontSize.caption,
  },
  etiquetaGde: {
    fontSize: tema.fontSize.base,
    marginTop: tema.spacing.sm,
  },
});
