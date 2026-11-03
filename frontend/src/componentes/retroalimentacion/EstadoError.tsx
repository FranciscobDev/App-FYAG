import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";

export interface PropiedadesEstadoError {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryTitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const EstadoError: React.FC<PropiedadesEstadoError> = ({
  title = "Ocurrió un problema",
  message = "No fue posible cargar o procesar la información solicitada. Por favor verifique su conexión.",
  onRetry,
  retryTitle = "Reintentar",
  containerStyle,
}) => {
  return (
    <View style={[estilos.contenedor, containerStyle]}>
      <View style={estilos.iconoCirculo}>
        <Ionicons name="alert-circle-outline" size={36} color={tema.colors.danger} />
      </View>
      <Text style={estilos.titulo}>{title}</Text>
      <Text style={estilos.mensaje}>{message}</Text>
      {onRetry && (
        <Boton
          title={retryTitle}
          variant="secondary"
          size="sm"
          icon="refresh-outline"
          onPress={onRetry}
          style={estilos.retryBoton}
        />
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    justifyContent: "center",
    padding: tema.spacing.xl,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    marginVertical: tema.spacing.sm,
  },
  iconoCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tema.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
    textAlign: "center",
  },
  mensaje: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 340,
    lineHeight: 18,
  },
  retryBoton: {
    marginTop: tema.spacing.md,
    minHeight: 44,
  },
});
