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
import { tema } from "@/nucleo/tema";

export interface PropiedadesChipSincronizacion {
  status: "pendiente" | "sincronizado";
  pendingCount?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "light" | "dark";
}

export const ChipSincronizacion: React.FC<PropiedadesChipSincronizacion> = ({
  status,
  pendingCount,
  onPress,
  style,
  variant = "light",
}) => {
  const esPendiente = status === "pendiente";
  const esOscuro = variant === "dark";

  let bg = esPendiente ? tema.colors.primaryLight : tema.colors.surfaceAlt;
  let borde = esPendiente ? tema.colors.primaryBorder : tema.colors.borderDark;
  let textoColumna = esPendiente ? tema.colors.primaryDark : tema.colors.text;
  let iconoColumna = esPendiente ? tema.colors.primaryDark : tema.colors.ok;

  if (esOscuro) {
    bg = esPendiente ? "rgba(217, 119, 6, 0.25)" : "#292524";
    borde = esPendiente ? "#d97706" : "#44403c";
    textoColumna = esPendiente ? "#f59e0b" : "#e7e5e4";
    iconoColumna = esPendiente ? "#f59e0b" : "#22c55e";
  }

  const iconoNombre: keyof typeof Ionicons.glyphMap = esPendiente
    ? "cloud-upload-outline"
    : "cloud-done";

  const etiqueta = esPendiente
    ? pendingCount && pendingCount > 0
      ? `${pendingCount} pend.`
      : "Pendiente"
    : "Sincronizado";

  const Contenido = (
    <View
      style={[
        estilos.chip,
        {
          backgroundColor: bg,
          borderColor: borde,
        },
        style,
      ]}
    >
      <Ionicons name={iconoNombre} size={13} color={iconoColumna} style={estilos.icono} />
      <Text style={[estilos.texto, { color: textoColumna }]}>{etiqueta}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Contenido}
      </TouchableOpacity>
    );
  }

  return Contenido;
};

const estilos = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: tema.radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 28,
  },
  icono: {
    marginRight: 5,
  },
  texto: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
