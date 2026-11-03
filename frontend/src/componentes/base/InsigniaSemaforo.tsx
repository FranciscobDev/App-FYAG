import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesInsigniaSemaforo {
  percentage: number; // e.g. 75, 92, 115
  showLabel?: boolean;
  labelPrefix?: string;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

/**
 * InsigniaSemaforo:
 * Semáforo estricto de costo y presupuesto (una sola palabra):
 * - Verde: < 80 % (Normal)
 * - Amarillo/Ámbar: 80 % – 100 % (Límite)
 * - Rojo: > 100 % (Sobregiro)
 */
export const InsigniaSemaforo: React.FC<PropiedadesInsigniaSemaforo> = ({
  percentage,
  showLabel = true,
  labelPrefix = "",
  size = "md",
  style,
}) => {
  const rounded = Math.round(percentage);

  let tono: "ok" | "warn" | "danger" = "ok";
  let etiquetaTexto = "Normal";
  let iconoNombre: keyof typeof Ionicons.glyphMap = "shield-checkmark-outline";

  if (rounded > 100) {
    tono = "danger";
    etiquetaTexto = "Sobregiro";
    iconoNombre = "alert-circle";
  } else if (rounded >= 80) {
    tono = "warn";
    etiquetaTexto = "Límite";
    iconoNombre = "warning-outline";
  }

  let bg = tema.colors.okLight;
  let textoColumna = tema.colors.okDark;
  let borde = tema.colors.okBorder;

  if (tono === "warn") {
    bg = tema.colors.warnLight;
    textoColumna = tema.colors.warnDark;
    borde = tema.colors.warnBorder;
  } else if (tono === "danger") {
    bg = tema.colors.dangerLight;
    textoColumna = tema.colors.dangerDark;
    borde = tema.colors.dangerBorder;
  }

  const esPeq = size === "sm";

  return (
    <View
      style={[
        estilos.insignia,
        {
          backgroundColor: bg,
          borderColor: borde,
          paddingVertical: esPeq ? 2 : 4,
          paddingHorizontal: esPeq ? 8 : 10,
        },
        style,
      ]}
    >
      <Ionicons
        name={iconoNombre}
        size={esPeq ? 12 : 14}
        color={textoColumna}
        style={estilos.icono}
      />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          estilos.texto,
          { color: textoColumna, fontSize: esPeq ? 11 : 12 },
        ]}
      >
        {labelPrefix ? `${labelPrefix} ` : ""}{rounded}%
        {showLabel ? ` • ${etiquetaTexto}` : ""}
      </Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  insignia: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: tema.radius.full,
    maxWidth: "100%",
    flexShrink: 1,
  },
  icono: {
    marginRight: 4,
    flexShrink: 0,
  },
  texto: {
    fontWeight: "700",
    letterSpacing: 0.3,
    flexShrink: 1,
  },
});
