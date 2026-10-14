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
import { theme } from "@/core/theme";
import { DatePicker } from "./DatePicker";

export interface DateRangePickerProps {
  label?: string;
  startDate?: string;
  endDate?: string;
  onChangeRange: (startDate: string, endDate: string) => void;
  required?: boolean;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label = "Rango de Fechas",
  startDate = "",
  endDate = "",
  onChangeRange,
  required = false,
  error,
  helper,
  containerStyle,
}) => {
  const [rangeError, setRangeError] = useState<string | null>(null);

  const handleStartChange = (newStart: string) => {
    if (endDate && newStart > endDate) {
      setRangeError("La fecha inicial no puede ser posterior a la fecha final");
    } else {
      setRangeError(null);
    }
    onChangeRange(newStart, endDate);
  };

  const handleEndChange = (newEnd: string) => {
    if (startDate && newEnd < startDate) {
      setRangeError("La fecha final no puede ser anterior a la fecha inicial");
    } else {
      setRangeError(null);
    }
    onChangeRange(startDate, newEnd);
  };

  const applyPreset = (preset: "last7" | "thisMonth" | "next30") => {
    const today = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (preset === "last7") {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setRangeError(null);
      onChangeRange(formatYMD(past), formatYMD(today));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setRangeError(null);
      onChangeRange(formatYMD(firstDay), formatYMD(lastDay));
    } else if (preset === "next30") {
      const future = new Date();
      future.setDate(today.getDate() + 30);
      setRangeError(null);
      onChangeRange(formatYMD(today), formatYMD(future));
    }
  };

  const activeError = error || rangeError;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredMark}> *</Text>}
          </Text>
        </View>
      )}

      {/* Chips Rápidos de Rango */}
      <View style={styles.presetsBar}>
        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => applyPreset("last7")}
          activeOpacity={0.7}
        >
          <Text style={styles.presetText}>Últimos 7 días</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => applyPreset("thisMonth")}
          activeOpacity={0.7}
        >
          <Text style={styles.presetText}>Este mes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => applyPreset("next30")}
          activeOpacity={0.7}
        >
          <Text style={styles.presetText}>Próximos 30 días</Text>
        </TouchableOpacity>
      </View>

      {/* Entradas Desde / Hasta */}
      <View style={styles.pickersRow}>
        <View style={styles.pickerWrapper}>
          <DatePicker
            label="Desde"
            value={startDate}
            onChangeDate={handleStartChange}
            placeholder="DD/MM/AAAA"
          />
        </View>

        <View style={styles.arrowCol}>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
        </View>

        <View style={styles.pickerWrapper}>
          <DatePicker
            label="Hasta"
            value={endDate}
            onChangeDate={handleEndChange}
            placeholder="DD/MM/AAAA"
          />
        </View>
      </View>

      {/* Error o Helper */}
      {Boolean(activeError) ? (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{activeError}</Text>
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
  presetsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginRight: 6,
    marginBottom: 4,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px accesible
    justifyContent: "center",
  },
  presetText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  pickersRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  pickerWrapper: {
    flex: 1,
  },
  arrowCol: {
    paddingHorizontal: 8,
    paddingBottom: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
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
