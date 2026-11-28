import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesVisorDiferencias {
  oldValue: string | number;
  newValue: string | number;
  label?: string;
  unit?: string;
  showDelta?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const VisorDiferencias: React.FC<PropiedadesVisorDiferencias> = ({
  oldValue,
  newValue,
  label,
  unit = "",
  showDelta = true,
  style,
}) => {
  const esNumeric = typeof oldValue === "number" && typeof newValue === "number";
  const numeroDiferencia = esNumeric ? (newValue as number) - (oldValue as number) : 0;
  const tieneCambiado = oldValue !== newValue;

  const deltaTexto = esNumeric
    ? numeroDiferencia > 0
      ? `+${numeroDiferencia} ${unit}`
      : `${numeroDiferencia} ${unit}`
    : "";

  return (
    <View style={[estilos.contenedor, style]}>
      {label && <Text style={estilos.etiqueta}>{label}:</Text>}

      <View style={estilos.diferenciaFila}>
        {/* Valor Anterior */}
        <View style={estilos.antiguoValorCaja}>
          <Text style={estilos.antiguoValorTexto}>
            {oldValue} {unit}
          </Text>
        </View>

        <Ionicons
          name="arrow-forward"
          size={14}
          color={tema.colors.textMuted}
          style={estilos.arrow}
        />

        {/* Valor Nuevo */}
        <View style={[estilos.nuevoValorCaja, tieneCambiado && estilos.nuevoValorCajaCambiado]}>
          <Text style={[estilos.nuevoValorTexto, tieneCambiado && estilos.nuevoValorTextoCambiado]}>
            {newValue} {unit}
          </Text>
        </View>

        {/* Delta numérico opcional */}
        {showDelta && esNumeric && numeroDiferencia !== 0 && (
          <View
            style={[
              estilos.deltaInsignia,
              numeroDiferencia > 0 ? estilos.deltaPositive : estilos.deltaNegative,
            ]}
          >
            <Text
              style={[
                estilos.deltaTexto,
                numeroDiferencia > 0 ? estilos.deltaTextoPositive : estilos.deltaTextoNegative,
              ]}
            >
              {deltaTexto}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    marginVertical: 4,
  },
  etiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.textMuted,
    marginBottom: 2,
  },
  diferenciaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  antiguoValorCaja: {
    backgroundColor: tema.colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
  },
  antiguoValorTexto: {
    fontSize: 12,
    color: tema.colors.dangerDark,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  arrow: {
    marginHorizontal: 6,
  },
  nuevoValorCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  nuevoValorCajaCambiado: {
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.okBorder,
  },
  nuevoValorTexto: {
    fontSize: 12,
    color: tema.colors.text,
    fontWeight: "600",
  },
  nuevoValorTextoCambiado: {
    color: tema.colors.okDark,
    fontWeight: "bold",
  },
  deltaInsignia: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    borderWidth: 1,
  },
  deltaPositive: {
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.okBorder,
  },
  deltaNegative: {
    backgroundColor: tema.colors.dangerLight,
    borderColor: tema.colors.dangerBorder,
  },
  deltaTexto: {
    fontSize: 11,
    fontWeight: "bold",
  },
  deltaTextoPositive: {
    color: tema.colors.okDark,
  },
  deltaTextoNegative: {
    color: tema.colors.dangerDark,
  },
});
