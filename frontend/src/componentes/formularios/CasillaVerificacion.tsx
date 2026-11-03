import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesCasillaVerificacion {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const CasillaVerificacion: React.FC<PropiedadesCasillaVerificacion> = ({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  error,
  containerStyle,
}) => {
  return (
    <View style={[estilos.envoltorio, containerStyle]}>
      <TouchableOpacity
        onPress={() => !disabled && onChange(!checked)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={`${label}${description ? `: ${description}` : ""}`}
        style={[
          estilos.contenedor,
          disabled && estilos.contenedorDeshabilitado,
        ]}
      >
        <View
          style={[
            estilos.checkboxCaja,
            checked && estilos.checkboxVerificado,
            Boolean(error) && estilos.checkboxError,
            disabled && estilos.checkboxCajaDeshabilitado,
          ]}
        >
          {checked && (
            <Ionicons name="checkmark" size={16} color={tema.colors.textInverse} />
          )}
        </View>

        <View style={estilos.textoColumna}>
          <Text
            style={[
              estilos.etiqueta,
              disabled && estilos.textoDeshabilitado,
              checked && estilos.etiquetaVerificado,
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text style={[estilos.descripcion, disabled && estilos.textoDeshabilitado]}>
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {Boolean(error) && (
        <View style={estilos.mensajeFila}>
          <Ionicons name="alert-circle" size={14} color={tema.colors.dangerDark} />
          <Text style={estilos.errorTexto}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  envoltorio: {
    marginBottom: tema.spacing.sm,
  },
  contenedor: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px de alto táctil
    paddingVertical: 8,
  },
  contenedorDeshabilitado: {
    opacity: 0.6,
  },
  checkboxCaja: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 10,
  },
  checkboxVerificado: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  checkboxError: {
    borderColor: tema.colors.danger,
  },
  checkboxCajaDeshabilitado: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
  },
  textoColumna: {
    flex: 1,
    justifyContent: "center",
  },
  etiqueta: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    fontWeight: tema.fontWeight.medium,
  },
  etiquetaVerificado: {
    color: tema.colors.primaryDark,
    fontWeight: tema.fontWeight.semibold,
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
  mensajeFila: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 32,
    marginTop: 2,
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    marginLeft: 4,
  },
});
