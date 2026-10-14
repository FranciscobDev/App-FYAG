import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "@/core/theme";

export interface ProgressBarProps {
  value: number; // 0 to 100+
  max?: number;
  height?: number;
  showPercentage?: boolean;
  semaforo?: boolean;
  color?: string;
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 8,
  showPercentage = false,
  semaforo = false,
  color,
  label,
  containerStyle,
}) => {
  const percentage = Math.max(0, Math.round((value / max) * 100));
  const clampedWidth = Math.min(100, percentage);

  let barColor = color || theme.colors.primary;

  if (semaforo) {
    if (percentage > 100) {
      barColor = theme.colors.danger;
    } else if (percentage >= 80) {
      barColor = theme.colors.warn;
    } else {
      barColor = theme.colors.ok;
    }
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {(label || showPercentage) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.labelText}>{label}</Text>}
          {showPercentage && (
            <Text style={[styles.percentText, { color: barColor }]}>
              {percentage}%
            </Text>
          )}
        </View>
      )}

      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedWidth}%`,
              backgroundColor: barColor,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  labelText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  percentText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
  },
  track: {
    width: "100%",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.full,
    overflow: "hidden",
  },
  fill: {
    borderRadius: theme.radius.full,
  },
});
