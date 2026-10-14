import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const isDanger = variant === "danger";
  const isWarn = variant === "warning";

  let iconName: keyof typeof Ionicons.glyphMap = "alert-circle";
  let iconColor = theme.colors.danger;
  let iconBg = theme.colors.dangerLight;

  if (isWarn) {
    iconName = "warning";
    iconColor = theme.colors.warnDark;
    iconBg = theme.colors.warnLight;
  } else if (!isDanger) {
    iconName = "help-circle";
    iconColor = theme.colors.primary;
    iconBg = theme.colors.primaryLight;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.outsidePress} onPress={onCancel} />

        <View style={styles.dialogCard}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={28} color={iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionsRow}>
            <Button
              title={cancelLabel}
              variant="secondary"
              size="md"
              onPress={onCancel}
              disabled={loading}
              style={styles.cancelBtn}
            />
            <Button
              title={confirmLabel}
              variant={isDanger ? "danger" : "primary"}
              size="md"
              loading={loading}
              onPress={onConfirm}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  outsidePress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    ...theme.shadows.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  cancelBtn: {
    flex: 1,
    marginRight: 8,
  },
  confirmBtn: {
    flex: 1,
    marginLeft: 8,
  },
});
