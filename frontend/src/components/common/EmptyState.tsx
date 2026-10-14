import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "file-tray-outline",
  title,
  description,
  actionTitle,
  onAction,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          variant="primary"
          size="sm"
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
  },
  description: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 320,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: theme.spacing.md,
    minHeight: 44,
  },
});
