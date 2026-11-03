import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { obtenerEstilosTono, Tono } from "@/nucleo/estados";
import { tema } from "@/nucleo/tema";

interface BadgeProps {
  label: string;
  tone?: Tono;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

/**
 * Insignia de Estado Responsiva:
 * - Compacta, legible y adaptable a pantallas móviles estrechas (< 480 px).
 * - Nunca desborda su contenedor (`maxWidth: "100%"`, `flexShrink: 1`).
 */
export const Insignia: React.FC<BadgeProps> = ({
  label,
  tone = "mute",
  icon,
  size = "md",
  style,
}) => {
  const { width } = useWindowDimensions();
  const esCompacto = width < 480;
  const tonoEstilos = obtenerEstilosTono(tone);
  const esPeq = size === "sm";
  const esGde = size === "lg";

  const paddingV = esPeq ? 2 : esGde ? 5 : 3;
  const paddingH = esCompacto
    ? esPeq
      ? 6
      : esGde
        ? 10
        : 8
    : esPeq
      ? tema.spacing.sm
      : esGde
        ? tema.spacing.md
        : 10;
  const fontTamano = esCompacto
    ? esPeq
      ? 10
      : esGde
        ? 12
        : 11
    : esPeq
      ? tema.fontSize.caption
      : esGde
        ? tema.fontSize.sm
        : tema.fontSize.xs;
  const iconoTamano = esPeq ? 11 : esGde ? 15 : 13;

  return (
    <View
      style={[
        estilos.insignia,
        {
          backgroundColor: tonoEstilos.bg,
          borderColor: tonoEstilos.border,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={iconoTamano}
          color={tonoEstilos.text}
          style={estilos.icono}
        />
      )}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          estilos.texto,
          {
            color: tonoEstilos.text,
            fontSize: fontTamano,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  insignia: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: tema.borders.thin,
    borderRadius: tema.radius.full,
    maxWidth: "100%",
    flexShrink: 1,
  },
  icono: {
    marginRight: 4,
    flexShrink: 0,
  },
  texto: {
    fontWeight: tema.fontWeight.semibold,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});
