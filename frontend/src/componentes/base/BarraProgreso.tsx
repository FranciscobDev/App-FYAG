import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { tema } from "@/nucleo/tema";

export interface PropiedadesBarraProgreso {
  value: number; // 0 to 100+
  max?: number;
  height?: number;
  showPercentage?: boolean;
  semaforo?: boolean;
  color?: string;
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BarraProgreso: React.FC<PropiedadesBarraProgreso> = ({
  value,
  max = 100,
  height = 8,
  showPercentage = false,
  semaforo = false,
  color,
  label,
  containerStyle,
}) => {
  const porcentaje = Math.max(0, Math.round((value / max) * 100));
  const clampedAncho = Math.min(100, porcentaje);

  let barraColor = color || tema.colors.primary;

  if (semaforo) {
    if (porcentaje > 100) {
      barraColor = tema.colors.danger;
    } else if (porcentaje >= 80) {
      barraColor = tema.colors.warn;
    } else {
      barraColor = tema.colors.ok;
    }
  }

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {(label || showPercentage) && (
        <View style={estilos.etiquetaFila}>
          {label && <Text style={estilos.etiquetaTexto}>{label}</Text>}
          {showPercentage && (
            <Text style={[estilos.porcentajeTexto, { color: barraColor }]}>
              {porcentaje}%
            </Text>
          )}
        </View>
      )}

      <View style={[estilos.track, { height }]}>
        <View
          style={[
            estilos.fill,
            {
              width: `${clampedAncho}%`,
              backgroundColor: barraColor,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    marginVertical: 4,
    width: "100%",
  },
  etiquetaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  etiquetaTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.medium,
    color: tema.colors.textSecondary,
  },
  porcentajeTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
  },
  track: {
    width: "100%",
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.full,
    overflow: "hidden",
  },
  fill: {
    borderRadius: tema.radius.full,
  },
});
