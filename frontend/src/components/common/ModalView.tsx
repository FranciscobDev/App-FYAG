import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

interface ModalViewProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPct?: number;
}

export const ModalView: React.FC<ModalViewProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPct = 85,
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        animValue.setValue(1);
      } else {
        animValue.setValue(0);
        Animated.timing(animValue, {
          toValue: 1,
          duration: theme.transitions.normal, // 200 ms
          useNativeDriver: true,
        }).start();
      }
    } else {
      animValue.setValue(0);
    }
  }, [visible, reduceMotion]);

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.outsidePress} onPress={onClose} />
        <Animated.View
          style={[
            styles.container,
            {
              maxHeight: `${maxHeightPct}%`,
              opacity: animValue,
              transform: [{ scale }, { translateY }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  outsidePress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  titleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: theme.spacing.lg,
  },
});
