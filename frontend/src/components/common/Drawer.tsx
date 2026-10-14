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
import { theme } from "@/core/theme";

export interface DrawerProps {
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

export const Drawer: React.FC<DrawerProps> = ({
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
  const isRight = position === "right";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isRight ? styles.alignRight : styles.alignLeft]}>
        <Pressable style={styles.outsidePress} onPress={onClose} />

        <View
          style={[
            styles.panel,
            { width: `${widthPct}%` },
            isRight ? styles.panelRight : styles.panelLeft,
            containerStyle,
          ]}
        >
          {/* Header del Drawer */}
          <View style={styles.header}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Cerrar panel lateral"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Contenido scrolleable */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer opcional */}
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    flexDirection: "row",
  },
  alignRight: {
    justifyContent: "flex-end",
  },
  alignLeft: {
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
    backgroundColor: theme.colors.card,
    ...theme.shadows.lg,
  },
  panelRight: {
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  panelLeft: {
    borderTopRightRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 48,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: theme.spacing.lg,
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
});
