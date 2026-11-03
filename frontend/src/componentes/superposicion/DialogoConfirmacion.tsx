import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";

export interface PropiedadesDialogoConfirmacion {
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

export const DialogoConfirmacion: React.FC<PropiedadesDialogoConfirmacion> = ({
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
  const esPeligro = variant === "danger";
  const esAdvertencia = variant === "warning";

  let iconoNombre: keyof typeof Ionicons.glyphMap = "alert-circle";
  let iconoColor = tema.colors.danger;
  let iconoFondo = tema.colors.dangerLight;

  if (esAdvertencia) {
    iconoNombre = "warning";
    iconoColor = tema.colors.warnDark;
    iconoFondo = tema.colors.warnLight;
  } else if (!esPeligro) {
    iconoNombre = "help-circle";
    iconoColor = tema.colors.primary;
    iconoFondo = tema.colors.primaryLight;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={estilos.backdrop}>
        <Pressable style={estilos.outsidePress} onPress={onCancel} />

        <View style={estilos.dialogoTarjeta}>
          <View style={[estilos.iconoCirculo, { backgroundColor: iconoFondo }]}>
            <Ionicons name={iconoNombre} size={28} color={iconoColor} />
          </View>

          <Text style={estilos.titulo}>{title}</Text>
          <Text style={estilos.mensaje}>{message}</Text>

          <View style={estilos.accionesFila}>
            <Boton
              title={cancelLabel}
              variant="secondary"
              size="md"
              onPress={onCancel}
              disabled={loading}
              style={estilos.cancelarBoton}
            />
            <Boton
              title={confirmLabel}
              variant={esPeligro ? "danger" : "primary"}
              size="md"
              loading={loading}
              onPress={onConfirm}
              style={estilos.confirmarBoton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  outsidePress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogoTarjeta: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.xl,
    alignItems: "center",
    ...tema.shadows.lg,
  },
  iconoCirculo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  mensaje: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: tema.spacing.xl,
  },
  accionesFila: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  cancelarBoton: {
    flex: 1,
    marginRight: 8,
  },
  confirmarBoton: {
    flex: 1,
    marginLeft: 8,
  },
});
