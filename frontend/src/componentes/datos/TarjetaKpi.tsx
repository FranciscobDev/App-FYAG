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
    borderRadius: tema.radius.lg,
    padding: 14,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.border,
    borderLeftWidth: 4,
    ...tema.shadows.subtle,
    flex: 1,
    minWidth: 148,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  etiqueta: {
    fontSize: 10.5,
    fontWeight: tema.fontWeight.bold,
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
    flexShrink: 1,
  },
  iconoContenedor: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  valor: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 28,
    marginVertical: 2,
  },
  subtitulo: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    flexShrink: 1,
  },
  pieFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 6,
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
