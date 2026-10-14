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
import { theme } from "@/core/theme";

export interface InputProps extends TextInputProps {
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
export const Input: React.FC<InputProps> = ({
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
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isEditable = disabled ? false : (editable !== undefined ? editable : true);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible en todo momento */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>
      </View>

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
          !isEditable && { backgroundColor: theme.colors.surfaceAlt, opacity: 0.7 },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={
              error
                ? theme.colors.danger
                : isFocused
                ? theme.colors.primaryDark
                : theme.colors.textMuted
            }
            style={styles.icon}
          />
        )}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          accessibilityHint={error ? `Error: ${error}` : helper}
          editable={isEditable}
          style={[styles.input, inputStyle]}
          {...rest}
        />
      </View>

      {/* Mensaje de error o ayuda con contraste AA */}
      {Boolean(error) ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  requiredAsterisk: {
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.semibold,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
  },
  focused: {
    borderColor: theme.colors.borderFocus,
    borderWidth: theme.borders.focus,
    backgroundColor: theme.colors.primaryLight,
  },
  errorBorder: {
    borderColor: theme.colors.danger,
    borderWidth: theme.borders.focus,
    backgroundColor: theme.colors.dangerLight,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: theme.touchTargets.minHeight,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    fontWeight: theme.fontWeight.semibold,
    marginLeft: 4,
  },
  helperText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
