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

export interface TextareaProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const Textarea: React.FC<TextareaProps> = ({
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
  const [isFocused, setIsFocused] = useState(false);
  const currentLength = value ? String(value).length : 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible y contador de caracteres opcional */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
        {maxLength && (
          <Text style={[styles.counter, currentLength >= maxLength && styles.counterMax]}>
            {currentLength} / {maxLength}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
          { minHeight: rows * 24 + 20 },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textLight}
          multiline
          numberOfLines={rows}
          maxLength={maxLength}
          textAlignVertical="top"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          style={[styles.input, inputStyle]}
          {...rest}
        />
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  requiredMark: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  counter: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  counterMax: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  inputContainer: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
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
  input: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    minHeight: 60,
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
