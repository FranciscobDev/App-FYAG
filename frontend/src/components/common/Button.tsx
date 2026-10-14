import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "outline"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * Botón Táctil Accesible (Paso 1):
 * - Altura mínima garantizada de 44 px en celular y tablet.
 * - Foco visible con borde de alto contraste.
 * - Feedback táctil inmediato.
 */
export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";

  let bg = theme.colors.primary;
  let textColor = theme.colors.textInverse;
  let borderColor = "transparent";

  if (variant === "secondary") {
    bg = theme.colors.surfaceAlt;
    textColor = theme.colors.text;
    borderColor = theme.colors.borderDark;
  } else if (variant === "danger") {
    bg = theme.colors.danger;
    textColor = theme.colors.textInverse;
  } else if (variant === "success") {
    bg = theme.colors.ok;
    textColor = theme.colors.textInverse;
  } else if (isOutline) {
    bg = "transparent";
    textColor = theme.colors.primaryDark;
    borderColor = theme.colors.primary;
  } else if (isGhost) {
    bg = "transparent";
    textColor = theme.colors.text;
  }

  // Altura mínima garantizada de 44 px (mínimo touch target AA en tablet y celular)
  const minHeight =
    size === "lg"
      ? theme.touchTargets.largeHeight
      : size === "sm"
      ? theme.touchTargets.minHeight
      : theme.touchTargets.tabletHeight;

  const paddingH = size === "sm" ? theme.spacing.md : size === "lg" ? theme.spacing.xxl : theme.spacing.lg;
  const fontSize = size === "sm" ? theme.fontSize.xs : size === "lg" ? theme.fontSize.base : theme.fontSize.sm;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: isFocused ? theme.colors.primaryDeep : borderColor,
          borderWidth: isOutline || variant === "secondary" || isFocused ? theme.borders.focus : 0,
          minHeight,
          paddingHorizontal: paddingH,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !reduceMotion ? 0.985 : 1 }],
        },
        Platform.select({
          web: {
            transition: reduceMotion ? "none" : `all ${theme.transitions.fast}ms ease`,
            cursor: disabled || loading ? "not-allowed" : "pointer",
          } as any,
          default: {},
        }),
        isFocused && styles.focusRing,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline || isGhost ? theme.colors.primary : theme.colors.textInverse}
        />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={textColor}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: textColor, fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={textColor}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    marginVertical: 2,
  },
  focusRing: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.2,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
