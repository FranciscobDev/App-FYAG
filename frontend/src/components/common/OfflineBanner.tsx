import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

interface OfflineBannerProps {
  onToggle?: (isOffline: boolean) => void;
}

/**
 * Banner de Modo Sin Conexión para Técnico en Terreno (Contexto 3: Celular)
 * Permite simular y operar sin conexión cuando se está en faenas remotas.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onToggle }) => {
  const [isOffline, setIsOffline] = useState(false);

  const handleToggle = () => {
    const next = !isOffline;
    setIsOffline(next);
    if (onToggle) onToggle(next);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleToggle}
      style={[
        styles.banner,
        isOffline ? styles.bannerOffline : styles.bannerOnline,
      ]}
    >
      <View style={styles.leftCol}>
        <Ionicons
          name={isOffline ? "cloud-offline" : "cloud-done"}
          size={18}
          color={isOffline ? theme.colors.primaryDark : theme.colors.ok}
        />
        <View style={styles.textCol}>
          <Text
            style={[
              styles.title,
              { color: isOffline ? theme.colors.primaryDark : theme.colors.text },
            ]}
          >
            {isOffline ? "Modo Sin Conexión (Offline Faena)" : "En Línea (Sincronizado)"}
          </Text>
          <Text style={styles.subtitle}>
            {isOffline
              ? "Tus solicitudes y jornadas se guardan localmente y se enviarán al recuperar señal."
              : "Conexión activa con el servidor central FYAG. Toca para simular modo offline."}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.badgeIndicator,
          { backgroundColor: isOffline ? theme.colors.primary : theme.colors.transit },
        ]}
      >
        <Text style={[styles.badgeText, !isOffline && { color: "#f59e0b" }]}>
          {isOffline ? "OFFLINE" : "ONLINE"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.touchTargets.minHeight,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderWidth: theme.borders.thin,
  },
  bannerOnline: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  bannerOffline: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  leftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  textCol: {
    marginLeft: 8,
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  subtitle: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  badgeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  badgeText: {
    color: theme.colors.textInverse,
    fontSize: 9,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.5,
  },
});
