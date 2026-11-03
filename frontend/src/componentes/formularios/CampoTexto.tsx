import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesCampoTexto extends TextInputProps {
  label: string; // Etiqueta obligatoria para cumplir con Paso 1
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Campo de Entrada Accesible (Paso 1):
 * - Etiquetas visibles en TODOS los campos.
 * - Foco visible de 2px con resalte y contraste AA.
 * - Altura táctil mínima de 44 px.
 */
export const CampoTexto = React.forwardRef<TextInput, PropiedadesCampoTexto>(({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  icon,
  containerStyle,
  inputStyle,
  editable,
  ...rest
}, ref) => {
  const [esEnfocado, establecerEsEnfocado] = useState(false);
  const esEditable = disabled ? false : (editable !== undefined ? editable : true);

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible en todo momento */}
      <View style={estilos.etiquetaFila}>
        <Text style={estilos.etiqueta}>
          {label}
          {required && <Text style={estilos.requiredAsterisk}> *</Text>}
        </Text>
      </View>

      <View
        style={[
          estilos.entradaEnvoltorio,
          esEnfocado && estilos.enfocado,
          Boolean(error) && estilos.errorBorde,
          !esEditable && { backgroundColor: tema.colors.surfaceAlt, opacity: 0.7 },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={
              error
                ? tema.colors.danger
                : esEnfocado
                ? tema.colors.primaryDark
                : tema.colors.textMuted
            }
            style={estilos.icono}
          />
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={tema.colors.textMuted}
          onFocus={() => establecerEsEnfocado(true)}
          onBlur={() => establecerEsEnfocado(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          accessibilityHint={error ? `Error: ${error}` : helper}
          editable={esEditable}
          style={[estilos.entrada, inputStyle]}
          {...rest}
        />
      </View>

      {/* Mensaje de error o ayuda con contraste AA */}
      {Boolean(error) ? (
        <View style={estilos.mensajeFila}>
          <Ionicons name="alert-circle" size={14} color={tema.colors.dangerDark} />
          <Text style={estilos.errorTexto}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={estilos.helperTexto}>{helper}</Text>
      ) : null}
    </View>
  );
});

CampoTexto.displayName = "Input";

const estilos = StyleSheet.create({
  contenedor: {
    marginBottom: tema.spacing.md,
  },
  etiquetaFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tema.spacing.xs,
  },
  etiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    letterSpacing: 0.2,
  },
  requiredAsterisk: {
    color: tema.colors.danger,
    fontWeight: tema.fontWeight.semibold,
  },
  entradaEnvoltorio: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    paddingHorizontal: tema.spacing.md,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
  },
  enfocado: {
    borderColor: tema.colors.borderFocus,
    borderWidth: tema.borders.focus,
    backgroundColor: tema.colors.primaryLight,
  },
  errorBorde: {
    borderColor: tema.colors.danger,
    borderWidth: tema.borders.focus,
    backgroundColor: tema.colors.dangerLight,
  },
  icono: {
    marginRight: tema.spacing.sm,
  },
  entrada: {
    flex: 1,
    height: tema.touchTargets.minHeight,
    color: tema.colors.text,
    fontSize: tema.fontSize.base,
  },
  mensajeFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    fontWeight: tema.fontWeight.semibold,
    marginLeft: 4,
  },
  helperTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
});
