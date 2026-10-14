import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { STATUSES, StatusKey } from "@/core/status";
import { Badge } from "./Badge";
import { Tone } from "@/core/theme";
import { Ionicons } from "@expo/vector-icons";

export interface EstadoBadgeProps {
  status?: StatusKey | string;
  label?: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

/**
 * EstadoBadge:
 * Componente unificado que garantiza la regla del PASO 1:
 * Estados SIEMPRE con color + icono + texto.
 */
export const EstadoBadge: React.FC<EstadoBadgeProps> = ({
  status,
  label,
  tone,
  icon,
  size = "md",
  style,
}) => {
  // If status is a known StatusKey, resolve from STATUSES
  if (status && (status in STATUSES)) {
    const def = STATUSES[status as StatusKey];
    return (
      <Badge
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
    <Badge
      label={label || String(status || "Sin estado")}
      tone={tone || "mute"}
      icon={icon}
      size={size}
      style={style}
    />
  );
};
