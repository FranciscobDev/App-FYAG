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
import { tema } from "@/nucleo/tema";

export interface PropiedadesCampoBusqueda {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const CampoBusqueda: React.FC<PropiedadesCampoBusqueda> = ({
  value,
  onChangeText,
  placeholder = "Buscar por SKU, nombre, RUT, proyecto...",
  onClear,
  containerStyle,
  accessibilityLabel = "Buscar",
}) => {
  const [esEnfocado, establecerEsEnfocado] = useState(false);

  const manejarLimpiar = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View
      style={[
        estilos.contenedor,
        esEnfocado && estilos.contenedorEnfocado,
        containerStyle,
      ]}
    >
      <Ionicons
        name="search-outline"
        size={18}
        color={esEnfocado ? tema.colors.primaryDark : tema.colors.textMuted}
        style={estilos.buscarIcono}
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tema.colors.textLight}
        onFocus={() => establecerEsEnfocado(true)}
        onBlur={() => establecerEsEnfocado(false)}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="search"
        style={estilos.entrada}
        returnKeyType="search"
        clearButtonMode="never" // Usamos nuestro botón personalizado para consistencia Android/iOS
      />

      {Boolean(value) && (
        <TouchableOpacity
          onPress={manejarLimpiar}
          style={estilos.limpiarBoton}
          accessibilityLabel="Limpiar búsqueda"
          accessibilityRole="button"
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color={tema.colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: tema.spacing.md,
  },
  contenedorEnfocado: {
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
    ...tema.shadows.sm,
  },
  buscarIcono: {
    marginRight: 8,
  },
  entrada: {
    flex: 1,
    fontSize: tema.fontSize.base,
    color: tema.colors.text,
    paddingVertical: 10,
  },
  limpiarBoton: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
