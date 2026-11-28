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

/**
 * EstadoBadge:
 * Componente unificado que garantiza la regla del PASO 1:
 * Estados SIEMPRE con color + icono + texto.
 */
export const InsigniaEstado: React.FC<PropiedadesInsigniaEstado> = ({
  status,
  label,
  tone,
  icon,
  size = "md",
  style,
}) => {
  // If status is a known StatusKey, resolve from STATUSES
  if (status && (status in ESTADOS)) {
    const def = ESTADOS[status as ClaveEstado];
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

  // Fallback for custom or unknown status
  return (
    <Insignia
      label={label || String(status || "Sin estado")}
      tone={tone || "mute"}
      icon={icon}
      size={size}
      style={style}
    />
  );
};
