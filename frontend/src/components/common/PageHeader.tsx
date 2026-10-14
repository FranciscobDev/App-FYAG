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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  onBack,
  rightAction,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Migas de pan (Breadcrumbs) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <View style={styles.breadcrumbRow}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const label = typeof crumb === "string" ? crumb : crumb.label;
            const onPress = typeof crumb === "string" ? undefined : crumb.onPress;

            return (
              <View key={idx} style={styles.crumbItem}>
                {idx > 0 && (
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={theme.colors.textMuted}
                    style={styles.crumbSeparator}
                  />
                )}
                {onPress && !isLast ? (
                  <TouchableOpacity onPress={onPress}>
                    <Text style={styles.crumbLink}>{label}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.crumbText, isLast && styles.crumbLast]}>
                    {label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Fila Principal de Título y Acciones */}
      <View style={styles.mainRow}>
        <View style={styles.leftCol}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              accessibilityLabel="Volver atrás"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.primaryDark} />
            </TouchableOpacity>
          )}

          <View style={styles.titleCol}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        {rightAction && <View style={styles.rightActionCol}>{rightAction}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  crumbItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  crumbSeparator: {
    marginHorizontal: 5,
  },
  crumbText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  crumbLink: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: "600",
  },
  crumbLast: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  backBtn: {
    marginRight: 10,
    padding: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  rightActionCol: {
    flexDirection: "row",
    alignItems: "center",
  },
});
