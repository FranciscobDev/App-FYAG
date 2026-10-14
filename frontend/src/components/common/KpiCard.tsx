import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { getToneStyles, Tone } from "@/core/status";

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  tone?: Tone;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtitle,
  trend,
  tone = "info",
  icon,
  onPress,
}) => {
  const toneStyle = getToneStyles(tone);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderLeftColor: toneStyle.text,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.iconContainer, { backgroundColor: toneStyle.bg }]}>
          <Ionicons name={icon} size={18} color={toneStyle.text} />
        </View>
      </View>
      <Text style={[styles.value, { color: toneStyle.text }]}>{value}</Text>
      
      <View style={styles.footerRow}>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {trend && (
          <View
            style={[
              styles.trendBadge,
              { backgroundColor: trend.positive ? theme.colors.okLight : theme.colors.dangerLight },
            ]}
          >
            <Ionicons
              name={trend.positive ? "trending-up" : "trending-down"}
              size={12}
              color={trend.positive ? theme.colors.okDark : theme.colors.dangerDark}
            />
            <Text
              style={[
                styles.trendText,
                { color: trend.positive ? theme.colors.okDark : theme.colors.dangerDark },
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    ...theme.shadows.subtle,
    flex: 1,
    minWidth: 140,
    margin: theme.spacing.xs,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  value: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    marginVertical: 2,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  trendText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    marginLeft: 3,
  },
});
