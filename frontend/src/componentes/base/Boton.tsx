import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export type VarianteBoton =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "outline"
  | "ghost";

export type TamanoBoton = "sm" | "md" | "lg";

export interface PropiedadesBoton {
  title: string;
  onPress: () => void;
  variant?: VarianteBoton;
  size?: TamanoBoton;
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
 * Botón Táctil Accesible y Responsivo:
 * - Altura mínima garantizada de 44 px en celular y tablet.
 * - Ajuste automático de padding, tipografía y ajuste de línea en pantallas pequeñas (< 480 px).
 * - Nunca desborda el contenedor padre (`maxWidth: "100%"`, `flexShrink: 1`).
 */
export const Boton: React.FC<PropiedadesBoton> = ({
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
  const { width } = useWindowDimensions();
  const esCompacto = width < 480;
  const [esEnfocado, establecerEsEnfocado] = useState(false);
  const [reduceMotion, establecerReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) establecerReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const esOutline = variant === "outline";
  const esGhost = variant === "ghost";

  let bg = tema.colors.primary;
  let textoColor = tema.colors.textInverse;
  let bordeColor = "transparent";

  if (variant === "secondary") {
    bg = tema.colors.surfaceAlt;
    textoColor = tema.colors.text;
    bordeColor = tema.colors.borderDark;
  } else if (variant === "danger") {
    bg = tema.colors.danger;
    textoColor = tema.colors.textInverse;
  } else if (variant === "success") {
    bg = tema.colors.ok;
    textoColor = tema.colors.textInverse;
  } else if (esOutline) {
    bg = "transparent";
    textoColor = tema.colors.primaryDark;
    bordeColor = tema.colors.primary;
  } else if (esGhost) {
    bg = "transparent";
    textoColor = tema.colors.text;
  }

  // Altura mínima garantizada de 44 px (mínimo touch target AA en tablet y celular)
  const minimoAlto =
    size === "lg"
      ? tema.touchTargets.largeHeight
      : size === "sm"
      ? tema.touchTargets.minHeight
      : tema.touchTargets.tabletHeight;

  const paddingH = esCompacto
    ? size === "sm"
      ? 10
      : size === "lg"
      ? 16
      : 12
    : size === "sm"
    ? tema.spacing.md
    : size === "lg"
    ? tema.spacing.xxl
    : tema.spacing.lg;

  const fontTamano = esCompacto
    ? size === "sm"
      ? 11
      : size === "lg"
      ? 14
      : 12
    : size === "sm"
    ? tema.fontSize.xs
    : size === "lg"
    ? tema.fontSize.base
    : tema.fontSize.sm;

  const iconoTamano = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onFocus={() => establecerEsEnfocado(true)}
      onBlur={() => establecerEsEnfocado(false)}
      style={({ pressed }) => [
        estilos.base,
        {
          backgroundColor: bg,
          borderColor: esEnfocado ? tema.colors.primaryDeep : bordeColor,
          borderWidth: esOutline || variant === "secondary" || esEnfocado ? tema.borders.focus : 0,
          minHeight: minimoAlto,
          paddingHorizontal: paddingH,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !reduceMotion ? 0.985 : 1 }],
        },
        Platform.select({
          web: {
            transition: reduceMotion ? "none" : `all ${tema.transitions.fast}ms ease`,
            cursor: disabled || loading ? "not-allowed" : "pointer",
          } as any,
          default: {},
        }),
        esEnfocado && estilos.focusRing,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={esOutline || esGhost ? tema.colors.primary : tema.colors.textInverse}
        />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons
              name={icon}
              size={iconoTamano}
              color={textoColor}
              style={estilos.iconoIzquierda}
            />
          )}
          <Text
            style={[
              estilos.texto,
              { color: textoColor, fontSize: fontTamano },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons
              name={icon}
              size={iconoTamano}
              color={textoColor}
              style={estilos.iconoDerecha}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

const estilos = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radius.md,
    marginVertical: 2,
    paddingVertical: 6,
    maxWidth: "100%",
    flexShrink: 1,
  },
  focusRing: {
    shadowColor: tema.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  texto: {
    fontWeight: tema.fontWeight.semibold,
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: "center",
  },
  iconoIzquierda: {
    marginRight: 6,
    flexShrink: 0,
  },
  iconoDerecha: {
    marginLeft: 6,
    flexShrink: 0,
  },
});
