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
import { tema } from "@/nucleo/tema";

export interface PropiedadesSelectorFecha {
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

const MES_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const SelectorFecha: React.FC<PropiedadesSelectorFecha> = ({
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
  const [modalAbrir, establecerModalAbrir] = useState(false);

  // Parse current value or use today
  const parseFecha = (val?: string): Date => {
    if (!val) return new Date();
    if (val.includes("/")) {
      const [d, m, y] = val.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const inicialFecha = parseFecha(value);
  const [seleccionadoAno, establecerSeleccionadoAno] = useState(inicialFecha.getFullYear());
  const [seleccionadoMes, establecerSeleccionadoMes] = useState(inicialFecha.getMonth());
  const [seleccionadoDia, establecerSeleccionadoDia] = useState(inicialFecha.getDate());

  // Formato chileno DD/MM/AAAA para presentación
  const displayFormateado = (val?: string) => {
    if (!val) return "Seleccione fecha (DD/MM/AAAA)";
    const d = parseFecha(val);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const diasInMes = new Date(seleccionadoAno, seleccionadoMes + 1, 0).getDate();

  const manejarConfirmar = () => {
    const validoDia = Math.min(seleccionadoDia, diasInMes);
    const y = seleccionadoAno;
    const m = String(seleccionadoMes + 1).padStart(2, "0");
    const d = String(validoDia).padStart(2, "0");
    onChangeDate(`${y}-${m}-${d}`);
    establecerModalAbrir(false);
  };

  const manejarPreset = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    onChangeDate(`${y}-${m}-${d}`);
    establecerModalAbrir(false);
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={estilos.etiqueta}>
        {label}
        {required && <Text style={estilos.requiredMarcar}> *</Text>}
      </Text>

      {/* Botón trigger táctil (mínimo 44 px) */}
      <TouchableOpacity
        onPress={() => {
          if (!disabled) {
            const actual = parseFecha(value);
            establecerSeleccionadoAno(actual.getFullYear());
            establecerSeleccionadoMes(actual.getMonth());
            establecerSeleccionadoDia(actual.getDate());
            establecerModalAbrir(true);
          }
        }}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? displayFormateado(value) : "Sin seleccionar"}`}
        style={[
          estilos.trigger,
          Boolean(error) && estilos.triggerError,
          disabled && estilos.triggerDeshabilitado,
        ]}
      >
        <View style={estilos.valorFila}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={tema.colors.primaryDark}
            style={estilos.calIcono}
          />
          <Text
            style={[
              estilos.valorTexto,
              !value && estilos.placeholderTexto,
              disabled && estilos.textoDeshabilitado,
            ]}
          >
            {value ? displayFormateado(value) : placeholder || "DD/MM/AAAA"}
          </Text>
        </View>

        <Ionicons
          name="chevron-down-outline"
          size={18}
          color={disabled ? tema.colors.textMuted : tema.colors.textSecondary}
        />
      </TouchableOpacity>

      {Boolean(error) ? (
        <View style={estilos.mensajeFila}>
          <Ionicons name="alert-circle" size={14} color={tema.colors.dangerDark} />
          <Text style={estilos.errorTexto}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={estilos.helperTexto}>{helper}</Text>
      ) : null}

      {/* Modal Táctil de Fecha */}
      <Modal
        visible={modalAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerModalAbrir(false)}
      >
        <Pressable style={estilos.backdrop} onPress={() => establecerModalAbrir(false)}>
          <View style={estilos.modalCaja} onStartShouldSetResponder={() => true}>
            <View style={estilos.modalEncabezado}>
              <Text style={estilos.modalTitulo}>{label}</Text>
              <TouchableOpacity
                onPress={() => establecerModalAbrir(false)}
                style={estilos.cerrarBoton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Accesos Rápidos */}
            <View style={estilos.presetsFila}>
              <TouchableOpacity
                style={estilos.presetChip}
                onPress={() => manejarPreset(0)}
              >
                <Text style={estilos.presetTexto}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={estilos.presetChip}
                onPress={() => manejarPreset(1)}
              >
                <Text style={estilos.presetTexto}>Mañana</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={estilos.presetChip}
                onPress={() => manejarPreset(7)}
              >
                <Text style={estilos.presetTexto}>+7 Días</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={estilos.presetChip}
                onPress={() => manejarPreset(30)}
              >
                <Text style={estilos.presetTexto}>+30 Días</Text>
              </TouchableOpacity>
            </View>

            {/* Selectores de Día, Mes y Año con botones táctiles grandes */}
            <View style={estilos.pickerColumnas}>
              {/* Día */}
              <View style={estilos.pickerColumna}>
                <Text style={estilos.pickerColumnaEncabezado}>Día</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoDia((prev) => (prev >= diasInMes ? 1 : prev + 1))}
                >
                  <Ionicons name="chevron-up" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
                <Text style={estilos.pickerValor}>{String(Math.min(seleccionadoDia, diasInMes)).padStart(2, "0")}</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoDia((prev) => (prev <= 1 ? diasInMes : prev - 1))}
                >
                  <Ionicons name="chevron-down" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Mes */}
              <View style={[estilos.pickerColumna, { flex: 1.5 }]}>
                <Text style={estilos.pickerColumnaEncabezado}>Mes</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoMes((prev) => (prev >= 11 ? 0 : prev + 1))}
                >
                  <Ionicons name="chevron-up" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
                <Text style={estilos.pickerValor}>{MES_NAMES[seleccionadoMes]}</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoMes((prev) => (prev <= 0 ? 11 : prev - 1))}
                >
                  <Ionicons name="chevron-down" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Año */}
              <View style={estilos.pickerColumna}>
                <Text style={estilos.pickerColumnaEncabezado}>Año</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoAno((prev) => prev + 1)}
                >
                  <Ionicons name="chevron-up" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
                <Text style={estilos.pickerValor}>{seleccionadoAno}</Text>
                <TouchableOpacity
                  style={estilos.ajustadorArrow}
                  onPress={() => establecerSeleccionadoAno((prev) => prev - 1)}
                >
                  <Ionicons name="chevron-down" size={20} color={tema.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botones Acción */}
            <View style={estilos.accionesFila}>
              <TouchableOpacity
                style={estilos.cancelarBoton}
                onPress={() => establecerModalAbrir(false)}
              >
                <Text style={estilos.cancelarBotonTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={estilos.confirmarBoton}
                onPress={manejarConfirmar}
              >
                <Text style={estilos.confirmarBotonTexto}>Confirmar Fecha</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: tema.spacing.md,
  },
  triggerError: {
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  triggerDeshabilitado: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
  },
  valorFila: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  calIcono: {
    marginRight: 8,
  },
  valorTexto: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    fontWeight: "500",
  },
  placeholderTexto: {
    color: tema.colors.textLight,
    fontWeight: "normal",
  },
  textoDeshabilitado: {
    color: tema.colors.textMuted,
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: tema.spacing.lg,
  },
  modalCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    ...tema.shadows.lg,
  },
  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  cerrarBoton: {
    padding: 4,
  },
  presetsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 6,
  },
  presetChip: {
    backgroundColor: tema.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
  },
  presetTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.primaryDark,
  },
  pickerColumnas: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    paddingVertical: 12,
    marginBottom: 20,
  },
  pickerColumna: {
    alignItems: "center",
    flex: 1,
  },
  pickerColumnaEncabezado: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: tema.colors.textMuted,
    marginBottom: 6,
  },
  ajustadorArrow: {
    padding: 6,
  },
  pickerValor: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
    marginVertical: 4,
  },
  accionesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  cancelarBoton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelarBotonTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.textMuted,
  },
  confirmarBoton: {
    backgroundColor: tema.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: tema.radius.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmarBotonTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: "#ffffff",
  },
});
