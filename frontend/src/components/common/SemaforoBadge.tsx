import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface SemaforoBadgeProps {
  percentage: number; // e.g. 75, 92, 115
  showLabel?: boolean;
  labelPrefix?: string;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

/**
 * SemaforoBadge:
 * Semáforo estricto de costo y presupuesto:
 * - Verde: < 80 % (Holgado)
 * - Amarillo/Ámbar: 80 % – 100 % (Alerta límite)
 * - Rojo: > 100 % (Sobregiro presupuestario)
 */
export const SemaforoBadge: React.FC<SemaforoBadgeProps> = ({
  percentage,
  showLabel = true,
  labelPrefix = "",
  size = "md",
  style,
}) => {
  const rounded = Math.round(percentage);

  let tone: "ok" | "warn" | "danger" = "ok";
  let labelText = "Bajo control";
  let iconName: keyof typeof Ionicons.glyphMap = "shield-checkmark-outline";

  if (rounded > 100) {
    tone = "danger";
    labelText = "Sobregiro";
    iconName = "alert-circle";
  } else if (rounded >= 80) {
    tone = "warn";
    labelText = "En límite";
    iconName = "warning-outline";
  }

  let bg = theme.colors.okLight;
  let textCol = theme.colors.okDark;
  let border = theme.colors.okBorder;

  if (tone === "warn") {
    bg = theme.colors.warnLight;
    textCol = theme.colors.warnDark;
    border = theme.colors.warnBorder;
  } else if (tone === "danger") {
    bg = theme.colors.dangerLight;
    textCol = theme.colors.dangerDark;
    border = theme.colors.dangerBorder;
  }

  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 8 : 10,
        },
        style,
      ]}
    >
      <Ionicons
        name={iconName}
        size={isSm ? 12 : 14}
        color={textCol}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          { color: textCol, fontSize: isSm ? 11 : 12 },
        ]}
      >
        {labelPrefix ? `${labelPrefix} ` : ""}{rounded}%
        {showLabel ? ` • ${labelText}` : ""}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: theme.radius.full,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
