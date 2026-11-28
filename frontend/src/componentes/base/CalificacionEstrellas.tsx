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
import { tema } from "@/nucleo/tema";

export interface PropiedadesCalificacionEstrellas {
  label?: string;
  rating: number; // 1 a 5
  onChangeRating?: (val: number) => void;
  maxStars?: number;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const CALIFICACION_LABELS: Record<number, string> = {
  1: "Deficiente",
  2: "Insuficiente",
  3: "Aceptable",
  4: "Bueno",
  5: "Excelente",
};

export const CalificacionEstrellas: React.FC<PropiedadesCalificacionEstrellas> = ({
  label,
  rating,
  onChangeRating,
  maxStars = 5,
  readOnly = false,
  size = "md",
  showLabel = true,
  containerStyle,
}) => {
  const starIconoTamano = size === "sm" ? 20 : size === "lg" ? 34 : 26;

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {label && <Text style={estilos.tituloEtiqueta}>{label}</Text>}

      <View style={estilos.starsFila}>
        {Array.from({ length: maxStars }).map((_, idx) => {
          const starValor = idx + 1;
          const esFilled = starValor <= rating;

          return (
            <TouchableOpacity
              key={starValor}
              onPress={() => !readOnly && onChangeRating && onChangeRating(starValor)}
              disabled={readOnly}
              activeOpacity={0.7}
              style={[
                estilos.starTouch,
                !readOnly && estilos.starTouchActivo,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Calificar con ${starValor} estrellas`}
            >
              <Ionicons
                name={esFilled ? "star" : "star-outline"}
                size={starIconoTamano}
                color={esFilled ? tema.colors.warn : tema.colors.borderDark}
              />
            </TouchableOpacity>
          );
        })}

        {showLabel && rating > 0 && (
          <View style={estilos.etiquetaInsignia}>
            <Text style={estilos.etiquetaTexto}>
              {rating} / {maxStars} • {CALIFICACION_LABELS[rating] || ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    marginVertical: 4,
  },
  tituloEtiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 6,
  },
  starsFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  starTouch: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  starTouchActivo: {
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px de target táctil
    minWidth: 40,
  },
  etiquetaInsignia: {
    backgroundColor: tema.colors.warnLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.sm,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
  },
  etiquetaTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.warnDark,
  },
});
