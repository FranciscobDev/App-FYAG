import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export type TipoNotificacionFlotante = "ok" | "warn" | "danger" | "info";

export interface PropiedadesNotificacionFlotante {
  visible: boolean;
  message: string;
  type?: TipoNotificacionFlotante;
  duration?: number;
  onDismiss: () => void;
  title?: string;
}

export const NotificacionFlotante: React.FC<PropiedadesNotificacionFlotante> = ({
  visible,
  message,
  type = "ok",
  duration = 3500,
  onDismiss,
  title,
}) => {
  const [reduceMotion, establecerReduceMotion] = useState(false);
  const insets = useSafeAreaInsets();
  const superiorInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(establecerReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", establecerReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const animDuration = reduceMotion ? 0 : 200;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: animDuration,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: animDuration,
          useNativeDriver: true,
        }),
      ]).start();

      const temporizador = setTimeout(() => {
        manejarDismiss();
      }, duration);

      return () => clearTimeout(temporizador);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: animDuration,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const manejarDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  let bg = tema.colors.okLight;
  let borde = tema.colors.okBorder;
  let textoColumna = tema.colors.okDark;
  let iconoNombre: keyof typeof Ionicons.glyphMap = "checkmark-circle";

  if (type === "warn") {
    bg = tema.colors.warnLight;
    borde = tema.colors.warnBorder;
    textoColumna = tema.colors.warnDark;
    iconoNombre = "warning";
  } else if (type === "danger") {
    bg = tema.colors.dangerLight;
    borde = tema.colors.dangerBorder;
    textoColumna = tema.colors.dangerDark;
    iconoNombre = "alert-circle";
  } else if (type === "info") {
    bg = tema.colors.primaryLight;
    borde = tema.colors.primaryBorder;
    textoColumna = tema.colors.primaryDark;
    iconoNombre = "information-circle";
  }

  return (
    <Animated.View
      style={[
        estilos.contenedor,
        {
          top: Math.max(superiorInset + 12, 24),
          backgroundColor: bg,
          borderColor: borde,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={iconoNombre} size={22} color={textoColumna} style={estilos.icono} />
      <View style={estilos.textoContenedor}>
        {title && <Text style={[estilos.titulo, { color: textoColumna }]}>{title}</Text>}
        <Text style={[estilos.mensaje, { color: textoColumna }]}>{message}</Text>
      </View>
      <TouchableOpacity
        onPress={manejarDismiss}
        style={estilos.cerrarBoton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={textoColumna} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: tema.borders.thin,
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    ...tema.shadows.md,
  },
  icono: {
    marginRight: 10,
  },
  textoContenedor: {
    flex: 1,
    marginRight: 8,
  },
  titulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.semibold,
    marginBottom: 2,
  },
  mensaje: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.medium,
    lineHeight: 18,
  },
  cerrarBoton: {
    padding: 4,
  },
});
