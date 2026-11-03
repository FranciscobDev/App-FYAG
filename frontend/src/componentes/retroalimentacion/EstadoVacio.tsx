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

export interface PropiedadesEstadoVacio {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const EstadoVacio: React.FC<PropiedadesEstadoVacio> = ({
  icon = "file-tray-outline",
  title,
  description,
  actionTitle,
  onAction,
  containerStyle,
}) => {
  return (
    <View style={[estilos.contenedor, containerStyle]}>
      <View style={estilos.iconoCirculo}>
        <Ionicons name={icon} size={36} color={tema.colors.textMuted} />
      </View>
      <Text style={estilos.titulo}>{title}</Text>
      {description && <Text style={estilos.descripcion}>{description}</Text>}
      {actionTitle && onAction && (
        <Boton
          title={actionTitle}
          variant="primary"
          size="sm"
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
    borderColor: tema.colors.border,
    marginVertical: tema.spacing.sm,
  },
  iconoCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.md,
  },
  titulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
    textAlign: "center",
  },
  descripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 320,
    lineHeight: 18,
  },
  accionBoton: {
    marginTop: tema.spacing.md,
    minHeight: 44,
  },
});
