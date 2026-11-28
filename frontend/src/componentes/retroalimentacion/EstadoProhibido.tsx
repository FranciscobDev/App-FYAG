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

export interface PropiedadesEstadoProhibido {
  title?: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const EstadoProhibido: React.FC<PropiedadesEstadoProhibido> = ({
  title = "Acceso Restringido",
  message = "Tu rol actual no dispone de permisos para visualizar o editar este módulo. Contacta a un Administrador para solicitar acceso.",
  actionTitle = "Cambiar de Rol",
  onAction,
  containerStyle,
}) => {
  return (
    <View style={[estilos.contenedor, containerStyle]}>
      <View style={estilos.iconoCirculo}>
        <Ionicons name="lock-closed" size={36} color={tema.colors.warnDark} />
      </View>
      <Text style={estilos.titulo}>{title}</Text>
      <Text style={estilos.mensaje}>{message}</Text>
      {onAction && (
        <Boton
          title={actionTitle}
          variant="secondary"
          size="sm"
          icon="swap-horizontal-outline"
          onPress={onAction}
          style={estilos.accionBoton}
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
    borderColor: tema.colors.warnBorder,
    marginVertical: tema.spacing.sm,
  },
  iconoCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tema.colors.warnLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.base,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.warnDark,
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
  accionBoton: {
    marginTop: tema.spacing.md,
    minHeight: 44,
  },
});
