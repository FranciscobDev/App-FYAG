import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { Button } from "./Button";

export interface SessionTimeoutModalProps {
  visible: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  timeoutSeconds?: number; // Tiempo de gracia antes de desconectar (default 60s)
}

/**
 * Modal de Aviso por Expiración de Sesión (Paso 4):
 * Se activa tras 30 minutos de inactividad (optimizado para escritorio web).
 * Cuenta con advertencia visual, cuenta regresiva en vivo y botones para renovar o salir.
 */
export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  visible,
  onStayLoggedIn,
  onLogout,
  timeoutSeconds = 60,
}) => {
  const [countdown, setCountdown] = useState(timeoutSeconds);

  useEffect(() => {
    if (!visible) {
      setCountdown(timeoutSeconds);
      return;
    }

    setCountdown(timeoutSeconds);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, timeoutSeconds]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onStayLoggedIn}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Icono de Alerta de Tiempo */}
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={32} color={theme.colors.warnDark} />
          </View>

          <Text style={styles.title}>¿Sigues ahí?</Text>
          <Text style={styles.subtitle}>Aviso por inactividad de sesión (30 minutos)</Text>

          <Text style={styles.message}>
            Por motivos de seguridad de la empresa y resguardo de datos contables, tu sesión se cerrará automáticamente en:
          </Text>

          {/* Contador Regresivo en Vivo */}
          <View style={styles.countdownBox}>
            <Ionicons name="hourglass-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.countdownText}>
              {countdown} segundos
            </Text>
          </View>

          {/* Botones de Acción Accesibles */}
          <View style={styles.actionsRow}>
            <Button
              title="Cerrar Sesión Ahora"
              variant="outline"
              size="md"
              onPress={onLogout}
              style={styles.logoutBtn}
            />
            <Button
              title="Mantener Sesión Activa"
              variant="primary"
              size="md"
              icon="checkmark-circle-outline"
              onPress={onStayLoggedIn}
              style={styles.stayBtn}
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
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    ...theme.shadows.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.warnBorder,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.warnLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.warnDark,
    marginTop: 2,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  countdownBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dangerBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.xl,
  },
  countdownText: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    marginLeft: 6,
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  logoutBtn: {
    flex: 1,
    marginRight: 8,
  },
  stayBtn: {
    flex: 1.2,
    marginLeft: 8,
  },
});
