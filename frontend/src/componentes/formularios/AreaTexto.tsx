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

export interface PropiedadesAreaTexto extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const AreaTexto: React.FC<PropiedadesAreaTexto> = ({
  label,
  value,
  onChangeText,
  error,
  helper,
  required = false,
  maxLength,
  rows = 4,
  containerStyle,
  inputStyle,
  placeholder = "Escriba observaciones o detalles...",
  ...rest
}) => {
  const [esEnfocado, establecerEsEnfocado] = useState(false);
  const actualLength = value ? String(value).length : 0;

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible y contador de caracteres opcional */}
      <View style={estilos.encabezadoFila}>
        <Text style={estilos.etiqueta}>
          {label}
          {required && <Text style={estilos.requiredMarcar}> *</Text>}
        </Text>
        {maxLength && (
          <Text style={[estilos.contador, actualLength >= maxLength && estilos.contadorMaximo]}>
            {actualLength} / {maxLength}
          </Text>
        )}
      </View>

      <View
        style={[
          estilos.entradaContenedor,
          esEnfocado && estilos.entradaEnfocado,
          Boolean(error) && estilos.entradaError,
          { minHeight: rows * 24 + 20 },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tema.colors.textLight}
          multiline
          numberOfLines={rows}
          maxLength={maxLength}
          textAlignVertical="top"
          onFocus={() => establecerEsEnfocado(true)}
          onBlur={() => establecerEsEnfocado(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          style={[estilos.entrada, inputStyle]}
          {...rest}
        />
      </View>

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
};

const estilos = StyleSheet.create({
  contenedor: {
    marginBottom: tema.spacing.md,
  },
  encabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 8,
  },
  etiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  requiredMarcar: {
    color: tema.colors.danger,
    fontWeight: "bold",
  },
  contador: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  contadorMaximo: {
    color: tema.colors.danger,
    fontWeight: "bold",
  },
  entradaContenedor: {
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
  },
  entradaEnfocado: {
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
    ...tema.shadows.sm,
  },
  entradaError: {
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  entrada: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    minHeight: 60,
  },
  mensajeFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  helperTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
});
