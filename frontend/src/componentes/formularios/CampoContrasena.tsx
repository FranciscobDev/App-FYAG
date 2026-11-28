import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesCampoContrasena extends Omit<TextInputProps, "secureTextEntry"> {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const CampoContrasena: React.FC<PropiedadesCampoContrasena> = ({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
  style,
  editable,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [mostrarContrasena, establecerMostrarContrasena] = useState(false);
  const [esEnfocado, establecerEsEnfocado] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const esEditable = disabled ? false : (editable !== undefined ? editable : true);

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={estilos.etiqueta}>
        {label}
        {required && <Text style={estilos.requiredMarcar}> *</Text>}
      </Text>

      <Pressable
        onPress={() => {
          if (esEditable) {
            inputRef.current?.focus();
          }
        }}
        style={[
          estilos.entradaContenedor,
          esEnfocado && estilos.entradaEnfocado,
          Boolean(error) && estilos.entradaError,
          !esEditable && { backgroundColor: tema.colors.surfaceAlt, opacity: 0.7 },
        ]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={
            error
              ? tema.colors.danger
              : esEnfocado
              ? tema.colors.primaryDark
              : tema.colors.textMuted
          }
          style={estilos.izquierdaIcono}
        />

        <TextInput
          {...rest}
          ref={inputRef}
          secureTextEntry={!mostrarContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          placeholderTextColor={tema.colors.textMuted}
          onFocus={(e) => {
            establecerEsEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            establecerEsEnfocado(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          editable={esEditable}
          style={[estilos.entrada, style]}
        />

        {/* Botón para alternar visibilidad con mínimo touch target */}
        <TouchableOpacity
          onPress={() => establecerMostrarContrasena((prev) => !prev)}
          style={estilos.eyeBoton}
          activeOpacity={0.7}
          accessibilityLabel={mostrarContrasena ? "Ocultar contraseña" : "Ver contraseña"}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={mostrarContrasena ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={tema.colors.textMuted}
          />
        </TouchableOpacity>
      </Pressable>

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
  etiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 6,
  },
  requiredMarcar: {
    color: tema.colors.danger,
    fontWeight: "bold",
  },
  entradaContenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: tema.spacing.md,
  },
  entradaEnfocado: {
    borderColor: tema.colors.borderFocus,
    borderWidth: tema.borders.focus,
    backgroundColor: tema.colors.primaryLight,
  },
  entradaError: {
    borderColor: tema.colors.danger,
    borderWidth: tema.borders.focus,
    backgroundColor: tema.colors.dangerLight,
  },
  izquierdaIcono: {
    marginRight: 8,
  },
  entrada: {
    flex: 1,
    height: tema.touchTargets.minHeight,
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
  },
  eyeBoton: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
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
