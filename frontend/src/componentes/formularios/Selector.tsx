import React, { useState } from "react";
import {
  FlatList,
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

export interface OpcionSelector<T = string | number> {
  label: string;
  value: T;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface PropiedadesSelector<T = string | number> {
  label: string;
  options: OpcionSelector<T>[];
  value?: T;
  onChange: (val: T) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Selector<T = string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = "Seleccione una opción...",
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
}: PropiedadesSelector<T>) {
  const [modalAbrir, establecerModalAbrir] = useState(false);

  const seleccionadoOpcion = options.find((o) => o.value === value);

  const manejarSeleccionar = (val: T) => {
    onChange(val);
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
        onPress={() => !disabled && establecerModalAbrir(true)}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${seleccionadoOpcion ? seleccionadoOpcion.label : placeholder}`}
        style={[
          estilos.trigger,
          Boolean(error) && estilos.triggerError,
          disabled && estilos.triggerDeshabilitado,
        ]}
      >
        <View style={estilos.valorFila}>
          {seleccionadoOpcion?.icon && (
            <Ionicons
              name={seleccionadoOpcion.icon}
              size={18}
              color={tema.colors.primaryDark}
              style={estilos.seleccionadoIcono}
            />
          )}
          <Text
            style={[
              estilos.valorTexto,
              !seleccionadoOpcion && estilos.placeholderTexto,
              disabled && estilos.textoDeshabilitado,
            ]}
            numberOfLines={1}
          >
            {seleccionadoOpcion ? seleccionadoOpcion.label : placeholder}
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

      {/* Modal Bottom Sheet Selector */}
      <Modal
        visible={modalAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerModalAbrir(false)}
      >
        <Pressable style={estilos.backdrop} onPress={() => establecerModalAbrir(false)}>
          <View style={estilos.hojaContenedor} onStartShouldSetResponder={() => true}>
            <View style={estilos.hojaEncabezado}>
              <Text style={estilos.hojaTitulo}>{label}</Text>
              <TouchableOpacity
                onPress={() => establecerModalAbrir(false)}
                style={estilos.cerrarBoton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item, index) => String(item.value) + index}
              renderItem={({ item }) => {
                const esSeleccionado = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      estilos.opcionFila,
                      esSeleccionado && estilos.opcionFilaSeleccionado,
                    ]}
                    onPress={() => manejarSeleccionar(item.value)}
                    activeOpacity={0.7}
                  >
                    <View style={estilos.opcionInfo}>
                      {item.icon && (
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={esSeleccionado ? tema.colors.primary : tema.colors.textMuted}
                          style={estilos.opcionIcono}
                        />
                      )}
                      <View>
                        <Text
                          style={[
                            estilos.opcionEtiqueta,
                            esSeleccionado && estilos.opcionEtiquetaSeleccionado,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.hint && (
                          <Text style={estilos.opcionHint}>{item.hint}</Text>
                        )}
                      </View>
                    </View>

                    {esSeleccionado && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={tema.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={estilos.opcionesLista}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

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
    marginRight: 8,
  },
  seleccionadoIcono: {
    marginRight: 8,
  },
  valorTexto: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
  },
  placeholderTexto: {
    color: tema.colors.textLight,
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
    justifyContent: "flex-end",
  },
  hojaContenedor: {
    backgroundColor: tema.colors.card,
    borderTopLeftRadius: tema.radius.xl,
    borderTopRightRadius: tema.radius.xl,
    maxHeight: "75%",
    paddingBottom: 24,
    ...tema.shadows.lg,
  },
  hojaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.lg,
    paddingVertical: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  hojaTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  cerrarBoton: {
    padding: 4,
  },
  opcionesLista: {
    paddingHorizontal: tema.spacing.md,
  },
  opcionFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: tema.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    minHeight: 48,
  },
  opcionFilaSeleccionado: {
    backgroundColor: tema.colors.primaryLight,
    borderRadius: tema.radius.md,
  },
  opcionInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  opcionIcono: {
    marginRight: 10,
  },
  opcionEtiqueta: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
  },
  opcionEtiquetaSeleccionado: {
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  opcionHint: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
});
