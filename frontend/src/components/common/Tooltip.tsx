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
import { theme } from "@/core/theme";

export interface TooltipProps {
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
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  style,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {children ? (
        <TouchableOpacity
          onPress={() => setVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityHint={content}
        >
          {children}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => setVisible(true)}
          style={styles.defaultTrigger}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Más información"
          accessibilityHint={content}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje de ayuda"
        >
          <View style={styles.bubble} onStartShouldSetResponder={() => true}>
            <View style={styles.bubbleHeader}>
              <Ionicons
                name="information-circle"
                size={16}
                color={theme.colors.primaryLight}
                style={styles.bubbleIcon}
              />
              <Text style={styles.bubbleText}>{content}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.bubbleCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.bubbleCloseText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  defaultTrigger: {
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px accesible
    minWidth: theme.touchTargets.minHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  bubble: {
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    maxWidth: 320,
    ...theme.shadows.lg,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.textSecondary,
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bubbleIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  bubbleText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textInverse,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 18,
    flex: 1,
  },
  bubbleCloseBtn: {
    alignSelf: "flex-end",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bubbleCloseText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryLight,
  },
});
