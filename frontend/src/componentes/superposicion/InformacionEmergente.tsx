import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesInformacionEmergente {
  content: string;
  children?: React.ReactNode;
  position?: "top" | "bottom";
  style?: StyleProp<ViewStyle>;
}

/**
 * Componente Tooltip Minimalista:
 * Información contextual accesible bajo demanda.
 * Funciona de forma táctil en móviles/tablets y por click/hover en web.
 */
export const InformacionEmergente: React.FC<PropiedadesInformacionEmergente> = ({
  content,
  children,
  style,
}) => {
  const [visible, establecerVisible] = useState(false);

  return (
    <View style={[estilos.envoltorio, style]}>
      {children ? (
        <TouchableOpacity
          onPress={() => establecerVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityHint={content}
        >
          {children}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => establecerVisible(true)}
          style={estilos.predeterminadoTrigger}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Más información"
          accessibilityHint={content}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={tema.colors.textMuted}
          />
        </TouchableOpacity>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => establecerVisible(false)}
      >
        <Pressable
          style={estilos.backdrop}
          onPress={() => establecerVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje de ayuda"
        >
          <View style={estilos.bubble} onStartShouldSetResponder={() => true}>
            <View style={estilos.bubbleEncabezado}>
              <Ionicons
                name="information-circle"
                size={16}
                color={tema.colors.primaryLight}
                style={estilos.bubbleIcono}
              />
              <Text style={estilos.bubbleTexto}>{content}</Text>
            </View>
            <TouchableOpacity
              onPress={() => establecerVisible(false)}
              style={estilos.bubbleCerrarBoton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={estilos.bubbleCerrarTexto}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const estilos = StyleSheet.create({
  envoltorio: {
    justifyContent: "center",
    alignItems: "center",
  },
  predeterminadoTrigger: {
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px accesible
    minWidth: tema.touchTargets.minHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  bubble: {
    backgroundColor: tema.colors.text,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    maxWidth: 320,
    ...tema.shadows.lg,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.textSecondary,
  },
  bubbleEncabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bubbleIcono: {
    marginRight: 8,
    marginTop: 2,
  },
  bubbleTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textInverse,
    fontWeight: tema.fontWeight.regular,
    lineHeight: 18,
    flex: 1,
  },
  bubbleCerrarBoton: {
    alignSelf: "flex-end",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bubbleCerrarTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.primaryLight,
  },
});
