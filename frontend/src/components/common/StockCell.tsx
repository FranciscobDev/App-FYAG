import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "@/core/theme";

export interface StockCellProps {
  available: number;
  committed?: number;
  quarantine?: number;
  minStock?: number;
  unit?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const StockCell: React.FC<StockCellProps> = ({
  available,
  committed = 0,
  quarantine = 0,
  minStock,
  unit = "u",
  compact = false,
  style,
}) => {
  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <Text style={styles.availableCompact}>
          {available} <Text style={styles.unitText}>{unit}</Text>
        </Text>
        {(committed > 0 || quarantine > 0) && (
          <View style={styles.subValuesRow}>
            {committed > 0 && (
              <Text style={styles.committedText}>
                Compr: {committed}
              </Text>
            )}
            {quarantine > 0 && (
              <Text style={styles.quarantineText}>
                Cuar: {quarantine}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* 1. Disponible (Verde) */}
      <View style={[styles.pill, styles.pillAvailable]}>
        <View style={[styles.dot, { backgroundColor: theme.colors.ok }]} />
        <Text style={styles.pillLabel}>Disp:</Text>
        <Text style={styles.pillValueAvailable}>
          {available} {unit}
        </Text>
      </View>

      {/* 2. Comprometido (Ámbar) */}
      {committed > 0 && (
        <View style={[styles.pill, styles.pillCommitted]}>
          <View style={[styles.dot, { backgroundColor: theme.colors.warn }]} />
          <Text style={styles.pillLabel}>Compr:</Text>
          <Text style={styles.pillValueCommitted}>
            {committed} {unit}
          </Text>
        </View>
      )}

      {/* 3. Cuarentena (Rojo) */}
      {quarantine > 0 && (
        <View style={[styles.pill, styles.pillQuarantine]}>
          <View style={[styles.dot, { backgroundColor: theme.colors.danger }]} />
          <Text style={styles.pillLabel}>Cuar:</Text>
          <Text style={styles.pillValueQuarantine}>
            {quarantine} {unit}
          </Text>
        </View>
      )}

      {/* 4. Mínimo (Neutro) */}
      {minStock !== undefined && (
        <View style={[styles.pill, styles.pillMin]}>
          <Text style={styles.pillLabel}>Mín:</Text>
          <Text style={styles.pillValueMin}>
            {minStock} {unit}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginRight: 6,
    marginVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  pillAvailable: {
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
  },
  pillCommitted: {
    backgroundColor: theme.colors.warnLight,
    borderColor: theme.colors.warnBorder,
  },
  pillQuarantine: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  pillMin: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.borderDark,
  },
  pillLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginRight: 3,
    fontWeight: "600",
  },
  pillValueAvailable: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.okDark,
  },
  pillValueCommitted: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.warnDark,
  },
  pillValueQuarantine: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
  },
  pillValueMin: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  compactContainer: {
    justifyContent: "center",
  },
  availableCompact: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.okDark,
  },
  unitText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: "normal",
  },
  subValuesRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  committedText: {
    fontSize: 10,
    color: theme.colors.warnDark,
    fontWeight: "600",
    marginRight: 6,
  },
  quarantineText: {
    fontSize: 10,
    color: theme.colors.dangerDark,
    fontWeight: "600",
  },
});
