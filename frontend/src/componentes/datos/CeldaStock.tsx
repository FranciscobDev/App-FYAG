import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { tema } from "@/nucleo/tema";

export interface PropiedadesCeldaStock {
  available: number;
  committed?: number;
  quarantine?: number;
  minStock?: number;
  unit?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const CeldaStock: React.FC<PropiedadesCeldaStock> = ({
  available,
  committed = 0,
  quarantine = 0,
  minStock,
  unit = "u",
  compact = false,
  style,
}) => {
  if (compact) {
    return (
      <View style={[estilos.compactoContenedor, style]}>
        <Text style={estilos.disponibleCompacto}>
          {available} <Text style={estilos.unidadTexto}>{unit}</Text>
        </Text>
        {(committed > 0 || quarantine > 0) && (
          <View style={estilos.subValoresFila}>
            {committed > 0 && (
              <Text style={estilos.comprometidoTexto}>
                Compr: {committed}
              </Text>
            )}
            {quarantine > 0 && (
              <Text style={estilos.cuarentenaTexto}>
                Cuar: {quarantine}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[estilos.contenedor, style]}>
      {/* 1. Disponible (Verde) */}
      <View style={[estilos.pastilla, estilos.pastillaDisponible]}>
        <View style={[estilos.punto, { backgroundColor: tema.colors.ok }]} />
        <Text style={estilos.pastillaEtiqueta}>Disp:</Text>
        <Text style={estilos.pastillaValorDisponible}>
          {available} {unit}
        </Text>
      </View>

      {/* 2. Comprometido (Ámbar) */}
      {committed > 0 && (
        <View style={[estilos.pastilla, estilos.pastillaComprometido]}>
          <View style={[estilos.punto, { backgroundColor: tema.colors.warn }]} />
          <Text style={estilos.pastillaEtiqueta}>Compr:</Text>
          <Text style={estilos.pastillaValorComprometido}>
            {committed} {unit}
          </Text>
        </View>
      )}

      {/* 3. Cuarentena (Rojo) */}
      {quarantine > 0 && (
        <View style={[estilos.pastilla, estilos.pastillaCuarentena]}>
          <View style={[estilos.punto, { backgroundColor: tema.colors.danger }]} />
          <Text style={estilos.pastillaEtiqueta}>Cuar:</Text>
          <Text style={estilos.pastillaValorCuarentena}>
            {quarantine} {unit}
          </Text>
        </View>
      )}

      {/* 4. Mínimo (Neutro) */}
      {minStock !== undefined && (
        <View style={[estilos.pastilla, estilos.pastillaMinimo]}>
          <Text style={estilos.pastillaEtiqueta}>Mín:</Text>
          <Text style={estilos.pastillaValorMinimo}>
            {minStock} {unit}
          </Text>
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  pastilla: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    marginRight: 6,
    marginVertical: 2,
  },
  punto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  pastillaDisponible: {
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.okBorder,
  },
  pastillaComprometido: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  pastillaCuarentena: {
    backgroundColor: tema.colors.dangerLight,
    borderColor: tema.colors.dangerBorder,
  },
  pastillaMinimo: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.borderDark,
  },
  pastillaEtiqueta: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginRight: 3,
    fontWeight: "600",
  },
  pastillaValorDisponible: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  pastillaValorComprometido: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.warnDark,
  },
  pastillaValorCuarentena: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
  },
  pastillaValorMinimo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  compactoContenedor: {
    justifyContent: "center",
  },
  disponibleCompacto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  unidadTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "normal",
  },
  subValoresFila: {
    flexDirection: "row",
    marginTop: 2,
  },
  comprometidoTexto: {
    fontSize: 10,
    color: tema.colors.warnDark,
    fontWeight: "600",
    marginRight: 6,
  },
  cuarentenaTexto: {
    fontSize: 10,
    color: tema.colors.dangerDark,
    fontWeight: "600",
  },
});
