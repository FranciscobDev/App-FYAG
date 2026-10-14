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

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryTitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Ocurrió un problema",
  message = "No fue posible cargar o procesar la información solicitada. Por favor verifique su conexión.",
  onRetry,
  retryTitle = "Reintentar",
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={36} color={theme.colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          title={retryTitle}
          variant="secondary"
          size="sm"
          icon="refresh-outline"
          onPress={onRetry}
          style={styles.retryBtn}
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
    borderColor: theme.colors.dangerBorder,
    marginVertical: theme.spacing.sm,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    textAlign: "center",
  },
  message: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 340,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: theme.spacing.md,
    minHeight: 44,
  },
});
