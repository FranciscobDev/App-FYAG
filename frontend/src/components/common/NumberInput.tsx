import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface NumberInputProps {
  label: string;
  value?: number;
  onChangeNumber: (val: number | undefined) => void;
  maxDecimals?: number; // Hasta 3 decimales
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChangeNumber,
  maxDecimals = 3,
  step = 1,
  min,
  max,
  unit,
  error,
  helper,
  required = false,
  disabled = false,
  placeholder = "0.000",
  containerStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  // Internal string state to allow natural typing like "12," or "0.00"
  const [rawText, setRawText] = useState<string>(
    value !== undefined && value !== null ? String(value) : ""
  );

  // Sync if external value changed significantly
  React.useEffect(() => {
    if (value === undefined || value === null) {
      if (rawText !== "") setRawText("");
    } else {
      const parsed = parseFloat(rawText.replace(",", "."));
      if (isNaN(parsed) || parsed !== value) {
        setRawText(String(value));
      }
    }
  }, [value]);

  const handleChangeText = (text: string) => {
    // Replace comma with dot for validation
    let sanitized = text.replace(/[^0-9.,-]/g, "");
    // Keep only one decimal separator
    const firstSepIndex = sanitized.search(/[.,]/);
    if (firstSepIndex !== -1) {
      const before = sanitized.slice(0, firstSepIndex);
      const after = sanitized.slice(firstSepIndex + 1).replace(/[.,]/g, "");
      // Limit to maxDecimals
      const limitedAfter = after.slice(0, maxDecimals);
      sanitized = before + "." + limitedAfter;
    }

    setRawText(sanitized);

    if (sanitized === "" || sanitized === "-" || sanitized === ".") {
      onChangeNumber(undefined);
      return;
    }

    const num = parseFloat(sanitized);
    if (!isNaN(num)) {
      if (min !== undefined && num < min) return;
      if (max !== undefined && num > max) return;
      onChangeNumber(num);
    }
  };

  const handleStep = (direction: "up" | "down") => {
    if (disabled) return;
    const current = value ?? 0;
    const delta = direction === "up" ? step : -step;
    let next = current + delta;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    // Round to maxDecimals
    const rounded = parseFloat(next.toFixed(maxDecimals));
    setRawText(String(rounded));
    onChangeNumber(rounded);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible obligatoria */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
        {unit && <Text style={styles.unitBadge}>({unit})</Text>}
      </View>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      >
        <TextInput
          value={rawText}
          onChangeText={handleChangeText}
          keyboardType="numeric"
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textLight}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          style={[styles.input, disabled && styles.inputTextDisabled]}
        />

        {/* Step buttons (+ / -) con touch targets grandes */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleStep("down")}
            disabled={disabled || (min !== undefined && (value ?? 0) <= min)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="remove" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.stepDivider} />
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleStep("up")}
            disabled={disabled || (max !== undefined && (value ?? 0) >= max)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="add" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Helper o Error */}
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
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
  unitBadge: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingLeft: theme.spacing.md,
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
  inputDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  inputTextDisabled: {
    color: theme.colors.textMuted,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  stepBtn: {
    width: 36,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDivider: {
    width: 1,
    height: "60%",
    backgroundColor: theme.colors.border,
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
