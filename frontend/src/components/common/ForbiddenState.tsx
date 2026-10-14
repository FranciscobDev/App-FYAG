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

export interface ForbiddenStateProps {
  title?: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ForbiddenState: React.FC<ForbiddenStateProps> = ({
  title = "Acceso Restringido",
  message = "Tu rol actual no dispone de permisos para visualizar o editar este módulo. Contacta a un Administrador para solicitar acceso.",
  actionTitle = "Cambiar de Rol",
  onAction,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={36} color={theme.colors.warnDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onAction && (
        <Button
          title={actionTitle}
          variant="outline"
          size="sm"
          icon="swap-horizontal-outline"
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
    borderColor: theme.colors.warnBorder,
    marginVertical: theme.spacing.sm,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.warnLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.warnDark,
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
  actionBtn: {
    marginTop: theme.spacing.md,
    minHeight: 44,
  },
});
