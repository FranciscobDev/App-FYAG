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
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";

export interface PropiedadesModalExpiracionSesion {
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
export const ModalExpiracionSesion: React.FC<PropiedadesModalExpiracionSesion> = ({
  visible,
  onStayLoggedIn,
  onLogout,
  timeoutSeconds = 60,
}) => {
  const [countdown, establecerCountdown] = useState(timeoutSeconds);

  useEffect(() => {
    if (!visible) {
      establecerCountdown(timeoutSeconds);
      return;
    }

    establecerCountdown(timeoutSeconds);
    const interval = setInterval(() => {
      establecerCountdown((prev) => {
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
      <View style={estilos.backdrop}>
        <View style={estilos.tarjeta}>
          {/* Icono de Alerta de Tiempo */}
          <View style={estilos.iconoCirculo}>
            <Ionicons name="time-outline" size={32} color={tema.colors.warnDark} />
          </View>

          <Text style={estilos.titulo}>¿Sigues ahí?</Text>
          <Text style={estilos.subtitulo}>Aviso por inactividad de sesión (30 minutos)</Text>

          <Text style={estilos.mensaje}>
            Por motivos de seguridad de la empresa y resguardo de datos contables, tu sesión se cerrará automáticamente en:
          </Text>

          {/* Contador Regresivo en Vivo */}
          <View style={estilos.countdownCaja}>
            <Ionicons name="hourglass-outline" size={20} color={tema.colors.danger} />
            <Text style={estilos.countdownTexto}>
              {countdown} segundos
            </Text>
          </View>

          {/* Botones de Acción Accesibles */}
          <View style={estilos.accionesFila}>
            <Boton
              title="Cerrar Sesión Ahora"
              variant="outline"
              size="md"
              onPress={onLogout}
              style={estilos.cerrarSesionBoton}
            />
            <Boton
              title="Mantener Sesión Activa"
              variant="primary"
              size="md"
              icon="checkmark-circle-outline"
              onPress={onStayLoggedIn}
              style={estilos.stayBoton}
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
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  tarjeta: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.xl,
    alignItems: "center",
    ...tema.shadows.lg,
    borderWidth: 1.5,
    borderColor: tema.colors.warnBorder,
  },
  iconoCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tema.colors.warnLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    textAlign: "center",
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.warnDark,
    marginTop: 2,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mensaje: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: tema.spacing.md,
  },
  countdownCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1.5,
    borderColor: tema.colors.dangerBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    marginBottom: tema.spacing.xl,
  },
  countdownTexto: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
    marginLeft: 6,
  },
  accionesFila: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  cerrarSesionBoton: {
    flex: 1,
    marginRight: 8,
  },
  stayBoton: {
    flex: 1.2,
    marginLeft: 8,
  },
});
