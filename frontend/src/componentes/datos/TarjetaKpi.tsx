import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { obtenerEstilosTono, Tono } from "@/nucleo/estados";

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  tone?: Tono;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export const TarjetaKpi: React.FC<KpiCardProps> = ({
  label,
  value,
  subtitle,
  trend,
  tone = "info",
  icon,
  onPress,
}) => {
  const tonoEstilo = obtenerEstilosTono(tone);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        estilos.tarjeta,
        {
          borderLeftColor: tonoEstilo.text,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={estilos.encabezado}>
        <Text style={estilos.etiqueta}>{label}</Text>
        <View style={[estilos.iconoContenedor, { backgroundColor: tonoEstilo.bg }]}>
          <Ionicons name={icon} size={18} color={tonoEstilo.text} />
        </View>
      </View>
      <Text style={[estilos.valor, { color: tonoEstilo.text }]}>{value}</Text>
      
      <View style={estilos.pieFila}>
        {subtitle && <Text style={estilos.subtitulo}>{subtitle}</Text>}
        {trend && (
          <View
            style={[
              estilos.trendInsignia,
              { backgroundColor: trend.positive ? tema.colors.okLight : tema.colors.dangerLight },
            ]}
          >
            <Ionicons
              name={trend.positive ? "trending-up" : "trending-down"}
              size={12}
              color={trend.positive ? tema.colors.okDark : tema.colors.dangerDark}
            />
            <Text
              style={[
                estilos.trendTexto,
                { color: trend.positive ? tema.colors.okDark : tema.colors.dangerDark },
              ]}
            >
              {trend.value}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.md,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.border,
    borderLeftWidth: 4,
    ...tema.shadows.subtle,
    flex: 1,
    minWidth: 140,
    margin: tema.spacing.xs,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tema.spacing.xs,
  },
  etiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  iconoContenedor: {
    width: 32,
    height: 32,
    borderRadius: tema.radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  valor: {
    fontSize: tema.fontSize.xl,
    fontWeight: tema.fontWeight.semibold,
    marginVertical: 2,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  pieFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  trendInsignia: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tema.spacing.xs,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
  },
  trendTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    marginLeft: 3,
  },
});
