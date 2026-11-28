import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { tema } from "@/nucleo/tema";

export interface PropiedadesEsqueletoCarga {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const EsqueletoCarga: React.FC<PropiedadesEsqueletoCarga> = ({
  width = "100%",
  height = 20,
  borderRadius = 6,
  style,
}) => {
  const pulsoAnim = useRef(new Animated.Value(0.3)).current;
  const [reduceMotion, establecerReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) establecerReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulsoAnim.setValue(0.5);
      return;
    }

    const pulso = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsoAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulsoAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulso.start();

    return () => pulso.stop();
  }, [pulsoAnim, reduceMotion]);

  return (
    <Animated.View
      style={[
        estilos.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity: pulsoAnim,
        },
        style,
      ]}
    />
  );
};

const estilos = StyleSheet.create({
  skeleton: {
    backgroundColor: tema.colors.borderDark,
    marginVertical: 4,
  },
});
