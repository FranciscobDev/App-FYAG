import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface BreadcrumbItem {
  label: string;
  onPress?: () => void;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: (string | BreadcrumbItem)[];
  onBack?: () => void;
  rightAction?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  variant?: "dark" | "light";
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs: _breadcrumbs,
  onBack,
  rightAction,
  containerStyle,
  variant = "dark",
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 540;
  const isDark = variant === "dark";

  return (
    <View
      style={[
        styles.container,
        isDark ? styles.containerDark : styles.containerLight,
        isCompact && (isDark ? styles.containerDarkCompact : styles.containerCompact),
        containerStyle,
      ]}
    >
      {/* Fila Principal de Título y Acciones */}
      <View style={[styles.mainRow, isCompact && styles.mainRowCompact]}>
        <View style={[styles.leftCol, isCompact && styles.leftColCompact]}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.backBtn, isDark && styles.backBtnDark]}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={isDark ? "#ffffff" : theme.colors.primaryDark}
              />
            </TouchableOpacity>
          )}

          <View style={styles.titleCol}>
            <Text
              style={[
                styles.title,
                isDark && styles.titleDark,
                isCompact && styles.titleCompact,
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction && (
          <View style={[styles.rightActionCol, isCompact && styles.rightActionColCompact]}>
            {rightAction}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  containerDark: {
    backgroundColor: "#1c1917", // Dark Titanium Technical Chassis
    borderBottomColor: "#292524",
    marginBottom: 0,
  },
  containerDarkCompact: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginBottom: 0,
  },
  containerLight: {
    backgroundColor: theme.colors.card,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  containerCompact: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    marginBottom: theme.spacing.xs,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mainRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  leftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  leftColCompact: {
    marginRight: 6,
  },
  backBtn: {
    marginRight: 10,
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnDark: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    lineHeight: 22,
  },
  titleDark: {
    color: "#ffffff",
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: theme.fontSize.base,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  subtitleDark: {
    color: "#a8a29e",
  },
  rightActionCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightActionColCompact: {
    alignSelf: "center",
  },
});
