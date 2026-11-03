import React, { useMemo, useState } from "react";
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
import { CampoBusqueda } from "./CampoBusqueda";

export interface OpcionSelectorBuscable<T = string | number> {
  label: string;
  value: T;
  hint?: string;
  badge?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface PropiedadesSelectorBuscable<T = string | number> {
  label: string;
  options: OpcionSelectorBuscable<T>[];
  value?: T;
  onChange: (val: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SelectorBuscable<T = string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = "Buscar o seleccionar...",
  searchPlaceholder = "Escriba para filtrar...",
  error,
  helper,
  required = false,
  disabled = false,
  containerStyle,
}: PropiedadesSelectorBuscable<T>) {
  const [modalAbrir, establecerModalAbrir] = useState(false);
  const [buscarQuery, establecerBuscarQuery] = useState("");

  const seleccionadoOpcion = options.find((o) => o.value === value);

  const filtradoOpciones = useMemo(() => {
    if (!buscarQuery.trim()) return options;
    const q = buscarQuery.toLowerCase().trim();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, buscarQuery]);

  const manejarSeleccionar = (val: T) => {
    onChange(val);
    establecerModalAbrir(false);
    establecerBuscarQuery("");
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible */}
      <Text style={estilos.etiqueta}>
        {label}
        {required && <Text style={estilos.requiredMarcar}> *</Text>}
      </Text>

      {/* Trigger Táctil */}
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
          name="swap-vertical-outline"
          size={18}
          color={disabled ? tema.colors.textMuted : tema.colors.primaryDark}
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

      {/* Modal con Barra de Búsqueda Integrada */}
      <Modal
        visible={modalAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerModalAbrir(false)}
      >
        <Pressable
          style={estilos.backdrop}
          onPress={() => {
            establecerModalAbrir(false);
            establecerBuscarQuery("");
          }}
        >
          <View style={estilos.modalCaja} onStartShouldSetResponder={() => true}>
            <View style={estilos.modalEncabezado}>
              <Text style={estilos.modalTitulo}>{label}</Text>
              <TouchableOpacity
                onPress={() => {
                  establecerModalAbrir(false);
                  establecerBuscarQuery("");
                }}
                style={estilos.cerrarBoton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Barra de Búsqueda con foco instantáneo */}
            <View style={estilos.buscarContenedor}>
              <CampoBusqueda
                value={buscarQuery}
                onChangeText={establecerBuscarQuery}
                placeholder={searchPlaceholder}
              />
            </View>

            {/* Lista Filtrada */}
            <FlatList
              data={filtradoOpciones}
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
                      <View style={{ flex: 1 }}>
                        <View style={estilos.etiquetaInsigniaFila}>
                          <Text
                            style={[
                              estilos.opcionEtiqueta,
                              esSeleccionado && estilos.opcionEtiquetaSeleccionado,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.badge && (
                            <View style={estilos.insigniaChip}>
                              <Text style={estilos.insigniaTexto}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
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
              ListEmptyComponent={
                <View style={estilos.vacioContenedor}>
                  <Ionicons name="search-outline" size={32} color={tema.colors.textMuted} />
                  <Text style={estilos.vacioTexto}>No se encontraron coincidencias</Text>
                </View>
              }
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
    justifyContent: "center",
    padding: tema.spacing.lg,
  },
  modalCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    maxHeight: "85%",
    ...tema.shadows.lg,
  },
  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.lg,
    paddingVertical: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  modalTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  cerrarBoton: {
    padding: 4,
  },
  buscarContenedor: {
    padding: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  opcionesLista: {
    paddingHorizontal: tema.spacing.md,
    paddingBottom: tema.spacing.md,
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
  etiquetaInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  opcionEtiqueta: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
  },
  opcionEtiquetaSeleccionado: {
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  insigniaChip: {
    backgroundColor: tema.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  insigniaTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: tema.colors.textMuted,
  },
  opcionHint: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  vacioContenedor: {
    alignItems: "center",
    paddingVertical: 32,
  },
  vacioTexto: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textMuted,
    marginTop: 8,
  },
});
