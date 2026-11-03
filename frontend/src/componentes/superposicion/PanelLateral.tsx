import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesPanelLateral {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  position?: "left" | "right";
  widthPct?: number; // e.g. 80% on mobile, 45% on tablet
  footer?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const PanelLateral: React.FC<PropiedadesPanelLateral> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  position = "right",
  widthPct = 82,
  footer,
  containerStyle,
}) => {
  const esDerecha = position === "right";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[estilos.backdrop, esDerecha ? estilos.alignDerecha : estilos.alignIzquierda]}>
        <Pressable style={estilos.outsidePress} onPress={onClose} />

        <View
          style={[
            estilos.panel,
            { width: `${widthPct}%` },
            esDerecha ? estilos.panelDerecha : estilos.panelIzquierda,
            containerStyle,
          ]}
        >
          {/* Header del Drawer */}
          <View style={estilos.encabezado}>
            <View style={estilos.tituloColumna}>
              <Text style={estilos.titulo}>{title}</Text>
              {subtitle && <Text style={estilos.subtitulo}>{subtitle}</Text>}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={estilos.cerrarBoton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Cerrar panel lateral"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={tema.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Contenido scrolleable */}
          <ScrollView
            style={estilos.cuerpo}
            contentContainerStyle={estilos.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer opcional */}
          {footer && <View style={estilos.pie}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    flexDirection: "row",
  },
  alignDerecha: {
    justifyContent: "flex-end",
  },
  alignIzquierda: {
    justifyContent: "flex-start",
  },
  outsidePress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    maxWidth: 480,
    height: "100%",
    backgroundColor: tema.colors.card,
    ...tema.shadows.lg,
  },
  panelDerecha: {
    borderTopLeftRadius: tema.radius.lg,
    borderBottomLeftRadius: tema.radius.lg,
  },
  panelIzquierda: {
    borderTopRightRadius: tema.radius.lg,
    borderBottomRightRadius: tema.radius.lg,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.lg,
    paddingTop: 48,
    paddingBottom: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    backgroundColor: tema.colors.card,
  },
  tituloColumna: {
    flex: 1,
    marginRight: 8,
  },
  titulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  cerrarBoton: {
    padding: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
  },
  cuerpo: {
    flex: 1,
  },
  cuerpoContenido: {
    padding: tema.spacing.lg,
  },
  pie: {
    padding: tema.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
  },
});
