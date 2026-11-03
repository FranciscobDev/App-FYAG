import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { tema } from "@/nucleo/tema";

export interface ElementoPestana<T = string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface PropiedadesPestanas<T = string> {
  tabs: ElementoPestana<T>[];
  activeTab: T;
  onChangeTab: (tabId: T) => void;
  scrollable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Pestanas<T = string>({
  tabs,
  activeTab,
  onChangeTab,
  scrollable = false,
  containerStyle,
}: PropiedadesPestanas<T>) {
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

  const contenido = (
    <View style={[estilos.pestanasFila, !scrollable && estilos.pestanasFilaFlex]}>
      {tabs.map((tab) => {
        const esActivo = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={String(tab.id)}
            onPress={() => onChangeTab(tab.id)}
            activeOpacity={0.7}
            style={[
              estilos.pestanaBoton,
              esActivo && estilos.pestanaBotonActivo,
              !scrollable && estilos.pestanaBotonFlex,
              Platform.select({
                web: {
                  transition: reduceMotion ? "none" : `all ${tema.transitions.fast}ms ease`,
                  cursor: "pointer",
                } as any,
                default: {},
              }),
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: esActivo }}
          >
            {tab.icon && <View style={estilos.iconoWrap}>{tab.icon}</View>}
            <Text style={[estilos.pestanaTexto, esActivo && estilos.pestanaTextoActivo]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && (
              <View
                style={[
                  estilos.insignia,
                  esActivo ? estilos.insigniaActivo : estilos.insigniaInactivo,
                ]}
              >
                <Text
                  style={[
                    estilos.insigniaTexto,
                    esActivo ? estilos.insigniaTextoActivo : estilos.insigniaTextoInactivo,
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
        style={[estilos.scrollEnvoltorio, containerStyle]}
      >
        {contenido}
      </ScrollView>
    );
  }

  return <View style={[estilos.envoltorio, containerStyle]}>{contenido}</View>;
}

const estilos = StyleSheet.create({
  envoltorio: {
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    marginBottom: tema.spacing.md,
  },
  scrollEnvoltorio: {
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    marginBottom: tema.spacing.md,
  },
  pestanasFila: {
    flexDirection: "row",
    alignItems: "center",
  },
  pestanasFilaFlex: {
    width: "100%",
  },
  pestanaBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px de alto
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  pestanaBotonFlex: {
    flex: 1,
  },
  pestanaBotonActivo: {
    borderBottomColor: tema.colors.primary,
  },
  iconoWrap: {
    marginRight: 6,
  },
  pestanaTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.textMuted,
  },
  pestanaTextoActivo: {
    color: tema.colors.primaryDark,
    fontWeight: tema.fontWeight.semibold,
  },
  insignia: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    marginLeft: 6,
  },
  insigniaActivo: {
    backgroundColor: tema.colors.primaryLight,
  },
  insigniaInactivo: {
    backgroundColor: tema.colors.surfaceAlt,
  },
  insigniaTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
  },
  insigniaTextoActivo: {
    color: tema.colors.primaryDark,
  },
  insigniaTextoInactivo: {
    color: tema.colors.textMuted,
  },
});
