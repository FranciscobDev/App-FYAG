import React, { useState } from "react";
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
import { SelectorFecha } from "./SelectorFecha";

export interface PropiedadesSelectorRangoFechas {
  label?: string;
  startDate?: string;
  endDate?: string;
  onChangeRange: (startDate: string, endDate: string) => void;
  required?: boolean;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SelectorRangoFechas: React.FC<PropiedadesSelectorRangoFechas> = ({
  label = "Rango de Fechas",
  startDate = "",
  endDate = "",
  onChangeRange,
  required = false,
  error,
  helper,
  containerStyle,
}) => {
  const [rangoError, establecerRangoError] = useState<string | null>(null);

  const manejarIniciarCambiar = (newStart: string) => {
    if (endDate && newStart > endDate) {
      establecerRangoError("La fecha inicial no puede ser posterior a la fecha final");
    } else {
      establecerRangoError(null);
    }
    onChangeRange(newStart, endDate);
  };

  const manejarFinCambiar = (newEnd: string) => {
    if (startDate && newEnd < startDate) {
      establecerRangoError("La fecha final no puede ser anterior a la fecha inicial");
    } else {
      establecerRangoError(null);
    }
    onChangeRange(startDate, newEnd);
  };

  const aplicarPreset = (preset: "last7" | "thisMonth" | "next30") => {
    const hoy = new Date();
    const formatearYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dia}`;
    };

    if (preset === "last7") {
      const past = new Date();
      past.setDate(hoy.getDate() - 7);
      establecerRangoError(null);
      onChangeRange(formatearYMD(past), formatearYMD(hoy));
    } else if (preset === "thisMonth") {
      const firstDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const lastDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      establecerRangoError(null);
      onChangeRange(formatearYMD(firstDia), formatearYMD(lastDia));
    } else if (preset === "next30") {
      const future = new Date();
      future.setDate(hoy.getDate() + 30);
      establecerRangoError(null);
      onChangeRange(formatearYMD(hoy), formatearYMD(future));
    }
  };

  const activoError = error || rangoError;

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {label && (
        <View style={estilos.etiquetaFila}>
          <Text style={estilos.etiqueta}>
            {label}
            {required && <Text style={estilos.requiredMarcar}> *</Text>}
          </Text>
        </View>
      )}

      {/* Chips Rápidos de Rango */}
      <View style={estilos.presetsBarra}>
        <TouchableOpacity
          style={estilos.presetChip}
          onPress={() => aplicarPreset("last7")}
          activeOpacity={0.7}
        >
          <Text style={estilos.presetTexto}>Últimos 7 días</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={estilos.presetChip}
          onPress={() => aplicarPreset("thisMonth")}
          activeOpacity={0.7}
        >
          <Text style={estilos.presetTexto}>Este mes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={estilos.presetChip}
          onPress={() => aplicarPreset("next30")}
          activeOpacity={0.7}
        >
          <Text style={estilos.presetTexto}>Próximos 30 días</Text>
        </TouchableOpacity>
      </View>

      {/* Entradas Desde / Hasta */}
      <View style={estilos.pickersFila}>
        <View style={estilos.pickerEnvoltorio}>
          <SelectorFecha
            label="Desde"
            value={startDate}
            onChangeDate={manejarIniciarCambiar}
            placeholder="DD/MM/AAAA"
          />
        </View>

        <View style={estilos.arrowColumna}>
          <Ionicons name="arrow-forward" size={16} color={tema.colors.textMuted} />
        </View>

        <View style={estilos.pickerEnvoltorio}>
          <SelectorFecha
            label="Hasta"
            value={endDate}
            onChangeDate={manejarFinCambiar}
            placeholder="DD/MM/AAAA"
          />
        </View>
      </View>

      {/* Error o Helper */}
      {Boolean(activoError) ? (
        <View style={estilos.mensajeFila}>
          <Ionicons name="alert-circle" size={14} color={tema.colors.dangerDark} />
          <Text style={estilos.errorTexto}>{activoError}</Text>
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
  presetsBarra: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    marginRight: 6,
    marginBottom: 4,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px accesible
    justifyContent: "center",
  },
  presetTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  pickersFila: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  pickerEnvoltorio: {
    flex: 1,
  },
  arrowColumna: {
    paddingHorizontal: 8,
    paddingBottom: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mensajeFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
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
