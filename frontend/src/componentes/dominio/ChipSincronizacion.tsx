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
  lastSyncTime?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "light" | "dark";
  compact?: boolean;
}

export const ChipSincronizacion: React.FC<PropiedadesChipSincronizacion> = ({
  status,
  pendingCount,
  lastSyncTime,
  onPress,
  style,
  variant = "light",
  compact = false,
}) => {
  const esPendiente = status === "pendiente";
  const esOscuro = variant === "dark";

  let bg = esPendiente ? tema.colors.primaryLight : tema.colors.surfaceAlt;
  let borde = esPendiente ? tema.colors.primaryBorder : tema.colors.borderDark;
  let textoColumna = esPendiente ? tema.colors.primaryDark : tema.colors.text;
  let iconoColumna = esPendiente ? tema.colors.primaryDark : tema.colors.ok;

  if (esOscuro) {
    bg = esPendiente ? "rgba(217, 119, 6, 0.25)" : "#1e293b";
    borde = esPendiente ? "#d97706" : "#334155";
    textoColumna = esPendiente ? "#f59e0b" : "#e2e8f0";
    iconoColumna = esPendiente ? "#f59e0b" : "#22c55e";
  }

  const iconoNombre: keyof typeof Ionicons.glyphMap = esPendiente
    ? "cloud-upload-outline"
    : "cloud-done";

  const horaSinc =
    lastSyncTime ||
    new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const etiqueta = compact
    ? esPendiente
      ? pendingCount && pendingCount > 0
        ? `${pendingCount} pend.`
        : "Pendiente"
      : "En línea"
    : esPendiente
      ? pendingCount && pendingCount > 0
        ? `${pendingCount} pend. • Últ. sinc: ${horaSinc}`
        : `Pendiente • Últ. sinc: ${horaSinc}`
      : `Sincronizado • ${horaSinc}`;

  const Contenido = (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Estado de sincronización: ${etiqueta}`}
      style={[
        estilos.chip,
        compact && estilos.chipCompacto,
        {
          backgroundColor: bg,
          borderColor: borde,
        },
        style,
      ]}
    >
      <Ionicons name={iconoNombre} size={14} color={iconoColumna} style={estilos.icono} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[estilos.texto, compact && estilos.textoCompacto, { color: textoColumna }]}
      >
        {etiqueta}
      </Text>
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    minHeight: 30,
  },
  chipCompacto: {
    paddingVertical: 4,
    paddingHorizontal: 8,
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
  textoCompacto: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
