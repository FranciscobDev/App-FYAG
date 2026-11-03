import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

interface OfflineBannerProps {
  onToggle?: (isOffline: boolean) => void;
}

/**
 * Banner de Modo Sin Conexión para Técnico en Terreno (Contexto 3: Celular)
 * Permite simular y operar sin conexión cuando se está en faenas remotas.
 */
export const BannerSinConexion: React.FC<OfflineBannerProps> = ({ onToggle }) => {
  const [esSinConexion, establecerEsSinConexion] = useState(false);

  const manejarAlternar = () => {
    const siguiente = !esSinConexion;
    establecerEsSinConexion(siguiente);
    if (onToggle) onToggle(siguiente);
  };

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
        <Text style={[estilos.insigniaTexto, !esSinConexion && { color: "#f59e0b" }]}>
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
    minHeight: tema.touchTargets.minHeight,
    paddingVertical: 8,
    paddingHorizontal: tema.spacing.md,
    borderRadius: tema.radius.md,
    marginHorizontal: tema.spacing.md,
    marginTop: tema.spacing.sm,
    marginBottom: tema.spacing.xs,
    borderWidth: tema.borders.thin,
  },
  bannerEnLinea: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
  },
  bannerSinConexion: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primaryBorder,
  },
  izquierdaColumna: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  textoColumna: {
    marginLeft: 8,
    flex: 1,
  },
  titulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
  },
  subtitulo: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  insigniaIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.full,
  },
  insigniaTexto: {
    color: tema.colors.textInverse,
    fontSize: 9,
    fontWeight: tema.fontWeight.semibold,
    letterSpacing: 0.5,
  },
});
