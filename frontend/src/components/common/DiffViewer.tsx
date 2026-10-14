import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface DiffViewerProps {
  oldValue: string | number;
  newValue: string | number;
  label?: string;
  unit?: string;
  showDelta?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldValue,
  newValue,
  label,
  unit = "",
  showDelta = true,
  style,
}) => {
  const isNumeric = typeof oldValue === "number" && typeof newValue === "number";
  const numDiff = isNumeric ? (newValue as number) - (oldValue as number) : 0;
  const hasChanged = oldValue !== newValue;

  const deltaText = isNumeric
    ? numDiff > 0
      ? `+${numDiff} ${unit}`
      : `${numDiff} ${unit}`
    : "";

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}:</Text>}

      <View style={styles.diffRow}>
        {/* Valor Anterior */}
        <View style={styles.oldValBox}>
          <Text style={styles.oldValText}>
            {oldValue} {unit}
          </Text>
        </View>

        <Ionicons
          name="arrow-forward"
          size={14}
          color={theme.colors.textMuted}
          style={styles.arrow}
        />

        {/* Valor Nuevo */}
        <View style={[styles.newValBox, hasChanged && styles.newValBoxChanged]}>
          <Text style={[styles.newValText, hasChanged && styles.newValTextChanged]}>
            {newValue} {unit}
          </Text>
        </View>

        {/* Delta numérico opcional */}
        {showDelta && isNumeric && numDiff !== 0 && (
          <View
            style={[
              styles.deltaBadge,
              numDiff > 0 ? styles.deltaPositive : styles.deltaNegative,
            ]}
          >
            <Text
              style={[
                styles.deltaText,
                numDiff > 0 ? styles.deltaTextPositive : styles.deltaTextNegative,
              ]}
            >
              {deltaText}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  oldValBox: {
    backgroundColor: theme.colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  oldValText: {
    fontSize: 12,
    color: theme.colors.dangerDark,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  arrow: {
    marginHorizontal: 6,
  },
  newValBox: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  newValBoxChanged: {
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
  },
  newValText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "600",
  },
  newValTextChanged: {
    color: theme.colors.okDark,
    fontWeight: "bold",
  },
  deltaBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  deltaPositive: {
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
  },
  deltaNegative: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  deltaTextPositive: {
    color: theme.colors.okDark,
  },
  deltaTextNegative: {
    color: theme.colors.dangerDark,
  },
});
