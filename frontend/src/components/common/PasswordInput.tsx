import React, { useState } from "react";
import {
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
import { theme } from "@/core/theme";

export interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
  style,
  editable,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isEditable = disabled ? false : (editable !== undefined ? editable : true);

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
      </Text>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
          !isEditable && { backgroundColor: theme.colors.surfaceAlt, opacity: 0.7 },
        ]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={
            error
              ? theme.colors.danger
              : isFocused
              ? theme.colors.primaryDark
              : theme.colors.textMuted
          }
          style={styles.leftIcon}
        />

        <TextInput
          secureTextEntry={!showPassword}
          placeholderTextColor={theme.colors.textLight}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          editable={isEditable}
          style={[styles.input, style]}
          {...rest}
        />

        {/* Botón para alternar visibilidad con mínimo touch target */}
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeBtn}
          activeOpacity={0.7}
          accessibilityLabel={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {Boolean(error) ? (
        <View style={styles.msgRow}>
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
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  requiredMark: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: theme.spacing.md,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: "#f0f9ff",
    ...theme.shadows.sm,
  },
  inputError: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fff5f5",
  },
  leftIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  eyeBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  helperText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
