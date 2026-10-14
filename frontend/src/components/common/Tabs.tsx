import React from "react";
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/core/theme";

export interface TabItem<T = string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface TabsProps<T = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChangeTab: (tabId: T) => void;
  scrollable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Tabs<T = string>({
  tabs,
  activeTab,
  onChangeTab,
  scrollable = false,
  containerStyle,
}: TabsProps<T>) {
  const content = (
    <View style={[styles.tabsRow, !scrollable && styles.tabsRowFlex]}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={String(tab.id)}
            onPress={() => onChangeTab(tab.id)}
            activeOpacity={0.7}
            style={[
              styles.tabBtn,
              isActive && styles.tabBtnActive,
              !scrollable && styles.tabBtnFlex,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {tab.icon && <View style={styles.iconWrap}>{tab.icon}</View>}
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && (
              <View
                style={[
                  styles.badge,
                  isActive ? styles.badgeActive : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                  ]}
                >
                  {tab.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.scrollWrapper, containerStyle]}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.wrapper, containerStyle]}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  scrollWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabsRowFlex: {
    width: "100%",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px de alto
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnFlex: {
    flex: 1,
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  iconWrap: {
    marginRight: 6,
  },
  tabText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginLeft: 6,
  },
  badgeActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  badgeInactive: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  badgeText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
  },
  badgeTextActive: {
    color: theme.colors.primaryDark,
  },
  badgeTextInactive: {
    color: theme.colors.textMuted,
  },
});
