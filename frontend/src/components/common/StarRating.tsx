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

export interface StarRatingProps {
  label?: string;
  rating: number; // 1 a 5
  onChangeRating?: (val: number) => void;
  maxStars?: number;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const RATING_LABELS: Record<number, string> = {
  1: "Deficiente",
  2: "Insuficiente",
  3: "Aceptable",
  4: "Bueno",
  5: "Excelente",
};

export const StarRating: React.FC<StarRatingProps> = ({
  label,
  rating,
  onChangeRating,
  maxStars = 5,
  readOnly = false,
  size = "md",
  showLabel = true,
  containerStyle,
}) => {
  const starIconSize = size === "sm" ? 20 : size === "lg" ? 34 : 26;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.titleLabel}>{label}</Text>}

      <View style={styles.starsRow}>
        {Array.from({ length: maxStars }).map((_, idx) => {
          const starValue = idx + 1;
          const isFilled = starValue <= rating;

          return (
            <TouchableOpacity
              key={starValue}
              onPress={() => !readOnly && onChangeRating && onChangeRating(starValue)}
              disabled={readOnly}
              activeOpacity={0.7}
              style={[
                styles.starTouch,
                !readOnly && styles.starTouchActive,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Calificar con ${starValue} estrellas`}
            >
              <Ionicons
                name={isFilled ? "star" : "star-outline"}
                size={starIconSize}
                color={isFilled ? theme.colors.warn : theme.colors.borderDark}
              />
            </TouchableOpacity>
          );
        })}

        {showLabel && rating > 0 && (
          <View style={styles.labelBadge}>
            <Text style={styles.labelText}>
              {rating} / {maxStars} • {RATING_LABELS[rating] || ""}
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
  titleLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  starTouch: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  starTouchActive: {
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px de target táctil
    minWidth: 40,
  },
  labelBadge: {
    backgroundColor: theme.colors.warnLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: theme.colors.warnBorder,
  },
  labelText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.warnDark,
  },
});
