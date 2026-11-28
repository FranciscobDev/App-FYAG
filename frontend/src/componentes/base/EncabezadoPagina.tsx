import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface ElementoMigasPan {
  label: string;
  onPress?: () => void;
}

export interface PropiedadesEncabezadoPagina {
  title: string;
  subtitle?: string;
  breadcrumbs?: (string | ElementoMigasPan)[];
  onBack?: () => void;
  rightAction?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  variant?: "dark" | "light";
}

export const EncabezadoPagina: React.FC<PropiedadesEncabezadoPagina> = ({
  title,
  subtitle,
  breadcrumbs: _breadcrumbs,
  onBack,
  rightAction,
  containerStyle,
  variant = "dark",
}) => {
  const { width } = useWindowDimensions();
  const esCompacto = width < 540;
  const esOscuro = variant === "dark";

  return (
    <View
      style={[
        estilos.contenedor,
        esOscuro ? estilos.contenedorOscuro : estilos.contenedorClaro,
        esCompacto && (esOscuro ? estilos.contenedorOscuroCompacto : estilos.contenedorCompacto),
        containerStyle,
      ]}
    >
      {/* Fila Principal de Título y Acciones */}
      <View style={[estilos.principalFila, esCompacto && estilos.principalFilaCompacto]}>
        <View style={[estilos.izquierdaColumna, esCompacto && estilos.izquierdaColumnaCompacto]}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={[estilos.backBoton, esOscuro && estilos.backBotonOscuro]}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={esOscuro ? "#ffffff" : tema.colors.primaryDark}
              />
            </TouchableOpacity>
          )}

          <View style={estilos.tituloColumna}>
            <Text
              style={[
                estilos.titulo,
                esOscuro && estilos.tituloOscuro,
                esCompacto && estilos.tituloCompacto,
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={[estilos.subtitulo, esOscuro && estilos.subtituloOscuro]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction && (
          <View style={[estilos.derechaAccionColumna, esCompacto && estilos.derechaAccionColumnaCompacto]}>
            {rightAction}
          </View>
        )}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    paddingHorizontal: tema.spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contenedorOscuro: {
    backgroundColor: "#1c1917", // Dark Titanium Technical Chassis
    borderBottomColor: "#292524",
    marginBottom: 0,
  },
  contenedorOscuroCompacto: {
    paddingHorizontal: tema.spacing.md,
    paddingVertical: 10,
    marginBottom: 0,
  },
  contenedorClaro: {
    backgroundColor: tema.colors.card,
    borderBottomColor: tema.colors.border,
    marginBottom: tema.spacing.sm,
  },
  contenedorCompacto: {
    paddingHorizontal: tema.spacing.md,
    paddingVertical: 8,
    marginBottom: tema.spacing.xs,
  },
  principalFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  principalFilaCompacto: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  izquierdaColumna: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 180,
    marginRight: 8,
  },
  izquierdaColumnaCompacto: {
    marginRight: 4,
  },
  backBoton: {
    marginRight: 10,
    width: 38,
    height: 38,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backBotonOscuro: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  tituloColumna: {
    flex: 1,
  },
  titulo: {
    fontSize: tema.fontSize.md,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    lineHeight: 22,
  },
  tituloOscuro: {
    color: "#ffffff",
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  tituloCompacto: {
    fontSize: tema.fontSize.base,
    lineHeight: 20,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  subtituloOscuro: {
    color: "#a8a29e",
  },
  derechaAccionColumna: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
  },
  derechaAccionColumnaCompacto: {
    alignSelf: "center",
  },
});
