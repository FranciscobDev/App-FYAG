import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { tema } from "@/nucleo/tema";

export interface OpcionRadio<T = string | number> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

export interface PropiedadesGrupoRadio<T = string | number> {
  label?: string;
  options: OpcionRadio<T>[];
  value: T;
  onChange: (val: T) => void;
  required?: boolean;
  error?: string;
  horizontal?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function GrupoRadio<T = string | number>({
  label,
  options,
  value,
  onChange,
  required = false,
  error,
  horizontal = false,
  containerStyle,
}: PropiedadesGrupoRadio<T>) {
  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {label && (
        <Text style={estilos.grupoEtiqueta}>
          {label}
          {required && <Text style={estilos.requiredMarcar}> *</Text>}
        </Text>
      )}

      <View style={[estilos.opcionesEnvoltorio, horizontal && estilos.opcionesHorizontal]}>
        {options.map((opt, idx) => {
          const esSeleccionado = opt.value === value;
          const esDeshabilitado = opt.disabled;

          return (
            <TouchableOpacity
              key={String(opt.value) + idx}
              onPress={() => !esDeshabilitado && onChange(opt.value)}
              disabled={esDeshabilitado}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: esSeleccionado, disabled: esDeshabilitado }}
              accessibilityLabel={`${opt.label}${opt.description ? `: ${opt.description}` : ""}`}
              style={[
                estilos.radioFila,
                horizontal && estilos.radioFilaHorizontal,
                esDeshabilitado && estilos.radioDeshabilitado,
              ]}
            >
              <View
                style={[
                  estilos.outerCirculo,
                  esSeleccionado && estilos.outerCirculoSeleccionado,
                  Boolean(error) && estilos.outerCirculoError,
                  esDeshabilitado && estilos.outerCirculoDeshabilitado,
                ]}
              >
                {esSeleccionado && <View style={estilos.innerPunto} />}
              </View>

              <View style={estilos.textoColumna}>
                <Text
                  style={[
                    estilos.opcionEtiqueta,
                    esSeleccionado && estilos.opcionEtiquetaSeleccionado,
                    esDeshabilitado && estilos.textoDeshabilitado,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.description && (
                  <Text style={[estilos.opcionDescripcion, esDeshabilitado && estilos.textoDeshabilitado]}>
                    {opt.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {Boolean(error) && <Text style={estilos.errorTexto}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    marginBottom: tema.spacing.md,
  },
  grupoEtiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 8,
  },
  requiredMarcar: {
    color: tema.colors.danger,
    fontWeight: "bold",
  },
  opcionesEnvoltorio: {
    flexDirection: "column",
  },
  opcionesHorizontal: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  radioFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingVertical: 8,
    marginRight: 16,
  },
  radioFilaHorizontal: {
    marginRight: 20,
  },
  radioDeshabilitado: {
    opacity: 0.6,
  },
  outerCirculo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 10,
  },
  outerCirculoSeleccionado: {
    borderColor: tema.colors.primary,
  },
  outerCirculoError: {
    borderColor: tema.colors.danger,
  },
  outerCirculoDeshabilitado: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
  },
  innerPunto: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tema.colors.primary,
  },
  textoColumna: {
    flex: 1,
    justifyContent: "center",
  },
  opcionEtiqueta: {
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    fontWeight: tema.fontWeight.medium,
  },
  opcionEtiquetaSeleccionado: {
    color: tema.colors.primaryDark,
    fontWeight: tema.fontWeight.semibold,
  },
  opcionDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  textoDeshabilitado: {
    color: tema.colors.textMuted,
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    marginTop: 4,
    fontWeight: tema.fontWeight.medium,
  },
});
