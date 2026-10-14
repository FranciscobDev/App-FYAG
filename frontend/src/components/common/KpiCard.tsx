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
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    fontWeight: "600",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  value: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "bold",
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 3,
  },
});
