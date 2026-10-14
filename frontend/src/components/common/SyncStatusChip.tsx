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
}

export const SyncStatusChip: React.FC<SyncStatusChipProps> = ({
  status,
  pendingCount,
  onPress,
  style,
}) => {
  const isPending = status === "pendiente";

  const bg = isPending ? theme.colors.warnLight : theme.colors.okLight;
  const border = isPending ? theme.colors.warnBorder : theme.colors.okBorder;
  const textCol = isPending ? theme.colors.warnDark : theme.colors.okDark;
  const iconName: keyof typeof Ionicons.glyphMap = isPending
    ? "cloud-upload-outline"
    : "cloud-done";

  const label = isPending
    ? pendingCount && pendingCount > 0
      ? `${pendingCount} pendiente(s)`
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
      <Ionicons name={iconName} size={14} color={textCol} style={styles.icon} />
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
