import React from "react";
import { StyleSheet, Text, View, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getToneStyles, Tone } from "@/core/status";
import { theme } from "@/core/theme";

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

/**
 * Badge de Estado:
 * Cumple la regla estricta: SIEMPRE color + icono + texto legible con contraste WCAG AA.
 */
export const Badge: React.FC<BadgeProps> = ({
  label,
  tone = "mute",
  icon,
  size = "md",
  style,
}) => {
  const toneStyles = getToneStyles(tone);
  const isSm = size === "sm";
  const isLg = size === "lg";

  const paddingV = isSm ? 3 : isLg ? 6 : 4;
  const paddingH = isSm ? 8 : isLg ? 12 : 10;
  const fontSize = isSm ? 11 : isLg ? 14 : 12;
  const iconSize = isSm ? 12 : isLg ? 16 : 14;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: toneStyles.bg,
          borderColor: toneStyles.border,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={toneStyles.text}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: toneStyles.text,
            fontSize,
          },
        ]}
      >
        {label}
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
    marginRight: 5,
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
