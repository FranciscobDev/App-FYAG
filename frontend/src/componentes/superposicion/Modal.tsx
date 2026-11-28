import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesModal {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  maxHeightPct?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Modal: React.FC<PropiedadesModal> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 540,
  maxHeightPct = 85,
  containerStyle,
}) => {
  const [reducirMovimiento, establecerReducirMovimiento] = useState(false);
  const animValor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(establecerReducirMovimiento)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      establecerReducirMovimiento
    );
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (visible) {
      if (reducirMovimiento) {
        animValor.setValue(1);
      } else {
        animValor.setValue(0);
        Animated.timing(animValor, {
          toValue: 1,
          duration: tema.transitions.normal,
          useNativeDriver: true,
        }).start();
      }
    } else {
      animValor.setValue(0);
    }
  }, [visible, reducirMovimiento]);

  const escala = animValor.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  const desplazamientoY = animValor.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={estilos.backdrop}
      >
        <Pressable style={estilos.outsidePress} onPress={onClose} />
        <Animated.View
          style={[
            estilos.contenedor,
            {
              maxWidth,
              maxHeight: `${maxHeightPct}%`,
              opacity: animValor,
              transform: [{ scale: escala }, { translateY: desplazamientoY }],
            },
            containerStyle,
          ]}
        >
          {/* Encabezado */}
          <View style={estilos.encabezado}>
            <View style={estilos.tituloContenedor}>
              <Text style={estilos.titulo}>{title}</Text>
              {subtitle && <Text style={estilos.subtitulo}>{subtitle}</Text>}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={estilos.cerrarBoton}
              accessibilityLabel="Cerrar modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={tema.colors.textMuted} />
            </Pressable>
          </View>

          {/* Cuerpo */}
          <ScrollView
            style={estilos.cuerpo}
            contentContainerStyle={estilos.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Pie opcional */}
          {footer && <View style={estilos.pie}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const estilos = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.md,
  },
  outsidePress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contenedor: {
    width: "100%",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    overflow: "hidden",
    ...tema.shadows.lg,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.lg,
    paddingTop: tema.spacing.lg,
    paddingBottom: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  tituloContenedor: {
    flex: 1,
    paddingRight: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  cerrarBoton: {
    padding: 4,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
  },
  cuerpo: {
    maxHeight: 520,
    flexGrow: 0,
  },
  cuerpoContenido: {
    padding: tema.spacing.lg,
  },
  pie: {
    paddingHorizontal: tema.spacing.lg,
    paddingVertical: tema.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
  },
});
