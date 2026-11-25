import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { ESTADOS, ClaveEstado } from "@/nucleo/estados";
import { Insignia } from "./Insignia";
import { Tono } from "@/nucleo/tema";
import { Ionicons } from "@expo/vector-icons";

export interface PropiedadesInsigniaEstado {
  status?: ClaveEstado | string;
  label?: string;
  tone?: Tono;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

const normalizarEstadoClave = (valor?: string): string =>
  (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

/**
 * EstadoBadge:
 * Componente unificado que garantiza la regla del PASO 1:
 * Estados SIEMPRE con color + icono + texto accesible en móvil y escritorio.
 */
export const InsigniaEstado: React.FC<PropiedadesInsigniaEstado> = ({
  status,
  label,
  tone,
  icon,
  size = "md",
  style,
}) => {
  const claveNormalizada = normalizarEstadoClave(status);
  const def =
    status && status in ESTADOS
      ? ESTADOS[status as ClaveEstado]
      : claveNormalizada && claveNormalizada in ESTADOS
      ? ESTADOS[claveNormalizada as ClaveEstado]
      : null;

  if (def) {
    return (
      <Insignia
        label={label || def.label}
        tone={tone || def.tone}
        icon={icon || (def.icon as any)}
        size={size}
        style={style}
      />
    );
  }

  return (
    <Insignia
      label={label || String(status || "Sin estado")}
      tone={tone || "mute"}
      icon={icon || "information-circle-outline"}
      size={size}
      style={style}
    />
  );
};
