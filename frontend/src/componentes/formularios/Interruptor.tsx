import React from "react";
import {
  StyleProp,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { tema } from "@/nucleo/tema";

export interface PropiedadesInterruptor {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  description?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Interruptor: React.FC<PropiedadesInterruptor> = ({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
  containerStyle,
}) => {
  return (
    <TouchableOpacity
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={`${label}${description ? `: ${description}` : ""}`}
      style={[
        estilos.contenedor,
        disabled && estilos.contenedorDeshabilitado,
        containerStyle,
      ]}
    >
      <View style={estilos.textoColumna}>
        <Text style={[estilos.etiqueta, disabled && estilos.textoDeshabilitado]}>
          {label}
        </Text>
        {description && (
          <Text style={[estilos.descripcion, disabled && estilos.textoDeshabilitado]}>
            {description}
          </Text>
        )}
      </View>

      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: tema.colors.borderDark,
          true: tema.colors.primary,
        }}
        thumbColor={value ? tema.colors.textInverse : tema.colors.background}
        ios_backgroundColor={tema.colors.borderDark}
      />
    </TouchableOpacity>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingVertical: 8,
    marginBottom: tema.spacing.sm,
  },
  contenedorDeshabilitado: {
    opacity: 0.6,
  },
  textoColumna: {
    flex: 1,
    marginRight: 16,
  },
  etiqueta: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    fontWeight: tema.fontWeight.medium,
  },
  descripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  textoDeshabilitado: {
    color: tema.colors.textMuted,
  },
});
