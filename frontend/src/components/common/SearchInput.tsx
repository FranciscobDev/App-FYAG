import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = "Buscar por SKU, nombre, RUT, proyecto...",
  onClear,
  containerStyle,
  accessibilityLabel = "Buscar",
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <Ionicons
        name="search-outline"
        size={18}
        color={isFocused ? theme.colors.primaryDark : theme.colors.textMuted}
        style={styles.searchIcon}
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textLight}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="search"
        style={styles.input}
        returnKeyType="search"
        clearButtonMode="never" // Usamos nuestro botón personalizado para consistencia Android/iOS
      />

      {Boolean(value) && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearBtn}
          accessibilityLabel="Limpiar búsqueda"
          accessibilityRole="button"
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.md,
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: theme.spacing.md,
  },
  containerFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    ...theme.shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
