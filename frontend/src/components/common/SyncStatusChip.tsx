import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface SyncStatusChipProps {
  status: "pendiente" | "sincronizado";
  pendingCount?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "light" | "dark";
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({
  status,
  pendingCount,
  onPress,
  style,
  variant = "light",
}) => {
  const isPending = status === "pendiente";
  const isDark = variant === "dark";

  let bg = isPending ? theme.colors.primaryLight : theme.colors.surfaceAlt;
  let border = isPending ? theme.colors.primaryBorder : theme.colors.borderDark;
  let textCol = isPending ? theme.colors.primaryDark : theme.colors.text;
  let iconCol = isPending ? theme.colors.primaryDark : theme.colors.ok;

  if (isDark) {
    bg = isPending ? "rgba(217, 119, 6, 0.25)" : "#292524";
    border = isPending ? "#d97706" : "#44403c";
    textCol = isPending ? "#f59e0b" : "#e7e5e4";
    iconCol = isPending ? "#f59e0b" : "#22c55e";
  }

  const iconName: keyof typeof Ionicons.glyphMap = isPending
    ? "cloud-upload-outline"
    : "cloud-done";

  const label = isPending
    ? pendingCount && pendingCount > 0
      ? `${pendingCount} pend.`
      : "Pendiente"
    : "Sincronizado";

  const Content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
        },
        style,
      ]}
    >
      <Ionicons name={iconName} size={13} color={iconCol} style={styles.icon} />
      <Text style={[styles.text, { color: textCol }]}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderRadius: theme.radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 28,
  },
  icon: {
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
