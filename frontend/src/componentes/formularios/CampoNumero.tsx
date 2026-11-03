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
import { tema } from "@/nucleo/tema";

export interface PropiedadesCampoNumero {
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

export const CampoNumero: React.FC<PropiedadesCampoNumero> = ({
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
  const [esEnfocado, establecerEsEnfocado] = useState(false);
  // Internal string state to allow natural typing like "12," or "0.00"
  const [rawTexto, establecerRawTexto] = useState<string>(
    value !== undefined && value !== null ? String(value) : ""
  );

  // Sync if external value changed significantly
  React.useEffect(() => {
    if (value === undefined || value === null) {
      if (rawTexto !== "") establecerRawTexto("");
    } else {
      const parsed = parseFloat(rawTexto.replace(",", "."));
      if (isNaN(parsed) || parsed !== value) {
        establecerRawTexto(String(value));
      }
    }
  }, [value]);

  const manejarCambiarTexto = (text: string) => {
    // Replace comma with dot for validation
    let sanitized = text.replace(/[^0-9.,-]/g, "");
    // Keep only one decimal separator
    const firstSepIndice = sanitized.search(/[.,]/);
    if (firstSepIndice !== -1) {
      const before = sanitized.slice(0, firstSepIndice);
      const after = sanitized.slice(firstSepIndice + 1).replace(/[.,]/g, "");
      // Limit to maxDecimals
      const limitedAfter = after.slice(0, maxDecimals);
      sanitized = before + "." + limitedAfter;
    }

    establecerRawTexto(sanitized);

    if (sanitized === "" || sanitized === "-" || sanitized === ".") {
      onChangeNumber(undefined);
      return;
    }

    const numero = parseFloat(sanitized);
    if (!isNaN(numero)) {
      if (min !== undefined && numero < min) return;
      if (max !== undefined && numero > max) return;
      onChangeNumber(numero);
    }
  };

  const manejarPaso = (direction: "up" | "down") => {
    if (disabled) return;
    const actual = value ?? 0;
    const delta = direction === "up" ? step : -step;
    let siguiente = actual + delta;
    if (min !== undefined && siguiente < min) siguiente = min;
    if (max !== undefined && siguiente > max) siguiente = max;
    // Round to maxDecimals
    const rounded = parseFloat(siguiente.toFixed(maxDecimals));
    establecerRawTexto(String(rounded));
    onChangeNumber(rounded);
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible obligatoria */}
      <View style={estilos.etiquetaFila}>
        <Text style={estilos.etiqueta}>
          {label}
          {required && <Text style={estilos.requiredMarcar}> *</Text>}
        </Text>
        {unit && <Text style={estilos.unidadInsignia}>({unit})</Text>}
      </View>

      <View
        style={[
          estilos.entradaContenedor,
          esEnfocado && estilos.entradaEnfocado,
          Boolean(error) && estilos.entradaError,
          disabled && estilos.entradaDeshabilitado,
        ]}
      >
        <TextInput
          value={rawTexto}
          onChangeText={manejarCambiarTexto}
          keyboardType="numeric"
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={tema.colors.textLight}
          onFocus={() => establecerEsEnfocado(true)}
          onBlur={() => establecerEsEnfocado(false)}
          accessibilityLabel={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          style={[estilos.entrada, disabled && estilos.entradaTextoDeshabilitado]}
        />

        {/* Step buttons (+ / -) con touch targets grandes */}
        <View style={estilos.ajustadorContenedor}>
          <TouchableOpacity
            style={estilos.pasoBoton}
            onPress={() => manejarPaso("down")}
            disabled={disabled || (min !== undefined && (value ?? 0) <= min)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="remove" size={16} color={tema.colors.textSecondary} />
          </TouchableOpacity>
          <View style={estilos.pasoDivisor} />
          <TouchableOpacity
            style={estilos.pasoBoton}
            onPress={() => manejarPaso("up")}
            disabled={disabled || (max !== undefined && (value ?? 0) >= max)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="add" size={16} color={tema.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Helper o Error */}
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
  etiquetaFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
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
  unidadInsignia: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginLeft: 6,
  },
  entradaContenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingLeft: tema.spacing.md,
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
  entradaDeshabilitado: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
  },
  entrada: {
    flex: 1,
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    paddingVertical: 10,
  },
  entradaTextoDeshabilitado: {
    color: tema.colors.textMuted,
  },
  ajustadorContenedor: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    borderLeftWidth: 1,
    borderLeftColor: tema.colors.border,
  },
  pasoBoton: {
    width: 36,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  pasoDivisor: {
    width: 1,
    height: "60%",
    backgroundColor: tema.colors.border,
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
