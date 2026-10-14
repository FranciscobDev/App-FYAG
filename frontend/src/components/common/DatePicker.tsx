import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface DatePickerProps {
  label: string;
  value?: string; // Formato YYYY-MM-DD o DD/MM/YYYY
  onChangeDate: (dateStr: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChangeDate,
  placeholder = "DD/MM/AAAA",
  error,
  helper,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  containerStyle,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Parse current value or use today
  const parseDate = (val?: string): Date => {
    if (!val) return new Date();
    if (val.includes("/")) {
      const [d, m, y] = val.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const initialDate = parseDate(value);
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Formato chileno DD/MM/AAAA para presentación
  const displayFormatted = (val?: string) => {
    if (!val) return "Seleccione fecha (DD/MM/AAAA)";
    const d = parseDate(val);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const handleConfirm = () => {
    const validDay = Math.min(selectedDay, daysInMonth);
    const y = selectedYear;
    const m = String(selectedMonth + 1).padStart(2, "0");
    const d = String(validDay).padStart(2, "0");
    onChangeDate(`${y}-${m}-${d}`);
    setModalOpen(false);
  };

  const handlePreset = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    onChangeDate(`${y}-${m}-${d}`);
    setModalOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
      </Text>

      {/* Botón trigger táctil (mínimo 44 px) */}
      <TouchableOpacity
        onPress={() => {
          if (!disabled) {
            const current = parseDate(value);
            setSelectedYear(current.getFullYear());
            setSelectedMonth(current.getMonth());
            setSelectedDay(current.getDate());
            setModalOpen(true);
          }
        }}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? displayFormatted(value) : "Sin seleccionar"}`}
        style={[
          styles.trigger,
          Boolean(error) && styles.triggerError,
          disabled && styles.triggerDisabled,
        ]}
      >
        <View style={styles.valueRow}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={theme.colors.primaryDark}
            style={styles.calIcon}
          />
          <Text
            style={[
              styles.valueText,
              !value && styles.placeholderText,
              disabled && styles.textDisabled,
            ]}
          >
            {value ? displayFormatted(value) : placeholder || "DD/MM/AAAA"}
          </Text>
        </View>

        <Ionicons
          name="chevron-down-outline"
          size={18}
          color={disabled ? theme.colors.textMuted : theme.colors.textSecondary}
        />
      </TouchableOpacity>

      {Boolean(error) ? (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}

      {/* Modal Táctil de Fecha */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Accesos Rápidos */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handlePreset(0)}
              >
                <Text style={styles.presetText}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handlePreset(1)}
              >
                <Text style={styles.presetText}>Mañana</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handlePreset(7)}
              >
                <Text style={styles.presetText}>+7 Días</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => handlePreset(30)}
              >
                <Text style={styles.presetText}>+30 Días</Text>
              </TouchableOpacity>
            </View>

            {/* Selectores de Día, Mes y Año con botones táctiles grandes */}
            <View style={styles.pickerCols}>
              {/* Día */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColHeader}>Día</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedDay((prev) => (prev >= daysInMonth ? 1 : prev + 1))}
                >
                  <Ionicons name="chevron-up" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{String(Math.min(selectedDay, daysInMonth)).padStart(2, "0")}</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedDay((prev) => (prev <= 1 ? daysInMonth : prev - 1))}
                >
                  <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Mes */}
              <View style={[styles.pickerCol, { flex: 1.5 }]}>
                <Text style={styles.pickerColHeader}>Mes</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedMonth((prev) => (prev >= 11 ? 0 : prev + 1))}
                >
                  <Ionicons name="chevron-up" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{MONTH_NAMES[selectedMonth]}</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedMonth((prev) => (prev <= 0 ? 11 : prev - 1))}
                >
                  <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Año */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColHeader}>Año</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedYear((prev) => prev + 1)}
                >
                  <Ionicons name="chevron-up" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{selectedYear}</Text>
                <TouchableOpacity
                  style={styles.stepperArrow}
                  onPress={() => setSelectedYear((prev) => prev - 1)}
                >
                  <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botones Acción */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmBtnText}>Confirmar Fecha</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: theme.spacing.md,
  },
  triggerError: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fff5f5",
  },
  triggerDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  calIcon: {
    marginRight: 8,
  },
  valueText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: "500",
  },
  placeholderText: {
    color: theme.colors.textLight,
    fontWeight: "normal",
  },
  textDisabled: {
    color: theme.colors.textMuted,
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  presetsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  presetText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },
  pickerCols: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    marginBottom: 20,
  },
  pickerCol: {
    alignItems: "center",
    flex: 1,
  },
  pickerColHeader: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  stepperArrow: {
    padding: 6,
  },
  pickerValue: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginVertical: 4,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  confirmBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: "#ffffff",
  },
});
