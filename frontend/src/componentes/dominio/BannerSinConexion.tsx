import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

interface OfflineBannerProps {
  onToggle?: (isOffline: boolean) => void;
  onlyWhenOffline?: boolean;
}

/**
 * Banner de Modo Sin Conexión para Técnico en Terreno (Contexto 3: Celular)
 * Permite simular y operar sin conexión cuando se está en faenas remotas.
 */
export const BannerSinConexion: React.FC<OfflineBannerProps> = ({
  onToggle,
  onlyWhenOffline = false,
}) => {
  const [esSinConexion, establecerEsSinConexion] = useState(false);

  const manejarAlternar = () => {
    const siguiente = !esSinConexion;
    establecerEsSinConexion(siguiente);
    if (onToggle) onToggle(siguiente);
  };

  if (onlyWhenOffline && !esSinConexion) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={manejarAlternar}
      style={[
        estilos.banner,
        esSinConexion ? estilos.bannerSinConexion : estilos.bannerEnLinea,
      ]}
    >
      <View style={estilos.izquierdaColumna}>
        <Ionicons
          name={esSinConexion ? "cloud-offline" : "cloud-done"}
          size={18}
          color={esSinConexion ? tema.colors.primaryDark : tema.colors.ok}
        />
        <View style={estilos.textoColumna}>
          <Text
            style={[
              estilos.titulo,
              { color: esSinConexion ? tema.colors.primaryDark : tema.colors.text },
            ]}
          >
            {esSinConexion ? "Modo Sin Conexión (Offline Faena)" : "En Línea (Sincronizado)"}
          </Text>
          <Text style={estilos.subtitulo}>
            {esSinConexion
              ? "Tus solicitudes y jornadas se guardan localmente y se enviarán al recuperar señal."
              : "Conexión activa con el servidor central FYAG. Toca para simular modo offline."}
          </Text>
        </View>
      </View>

      <View
        style={[
          estilos.insigniaIndicator,
          { backgroundColor: esSinConexion ? tema.colors.primary : tema.colors.transit },
        ]}
      >
        <Text style={estilos.insigniaTexto}>
          {esSinConexion ? "OFFLINE" : "ONLINE"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const estilos = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: tema.touchTargets.minHeight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tema.radius.md,
    marginHorizontal: tema.spacing.md,
    marginTop: tema.spacing.sm,
    marginBottom: tema.spacing.xs,
    borderWidth: tema.borders.thin,
    borderLeftWidth: 4,
  },
  bannerEnLinea: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
    borderLeftColor: tema.colors.ok,
  },
  bannerSinConexion: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primaryBorder,
    borderLeftColor: tema.colors.primary,
  },
  izquierdaColumna: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  textoColumna: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  titulo: {
    fontSize: 12.5,
    fontWeight: tema.fontWeight.bold,
  },
  subtitulo: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  insigniaIndicator: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: tema.radius.full,
    flexShrink: 0,
  },
  insigniaTexto: {
    color: tema.colors.textInverse,
    fontSize: 10,
    fontWeight: tema.fontWeight.bold,
    letterSpacing: 0.5,
  },
});
