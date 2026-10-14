import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export type ToastType = "ok" | "warn" | "danger" | "info";

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
  title?: string;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = "ok",
  duration = 3500,
  onDismiss,
  title,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  let bg = theme.colors.okLight;
  let border = theme.colors.okBorder;
  let textCol = theme.colors.okDark;
  let iconName: keyof typeof Ionicons.glyphMap = "checkmark-circle";

  if (type === "warn") {
    bg = theme.colors.warnLight;
    border = theme.colors.warnBorder;
    textCol = theme.colors.warnDark;
    iconName = "warning";
  } else if (type === "danger") {
    bg = theme.colors.dangerLight;
    border = theme.colors.dangerBorder;
    textCol = theme.colors.dangerDark;
    iconName = "alert-circle";
  } else if (type === "info") {
    bg = theme.colors.primaryLight;
    border = theme.colors.primaryBorder;
    textCol = theme.colors.primaryDark;
    iconName = "information-circle";
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={iconName} size={22} color={textCol} style={styles.icon} />
      <View style={styles.textContainer}>
        {title && <Text style={[styles.title, { color: textCol }]}>{title}</Text>}
        <Text style={[styles.message, { color: textCol }]}>{message}</Text>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={textCol} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  icon: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    marginBottom: 2,
  },
  message: {
    fontSize: theme.fontSize.xs,
    fontWeight: "500",
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
});
