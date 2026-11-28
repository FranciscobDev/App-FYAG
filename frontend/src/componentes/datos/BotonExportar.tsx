import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface PropiedadesBotonExportar {
  onExport: (format: "pdf" | "excel") => void;
  title?: string;
  variant?: "outline" | "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const BotonExportar: React.FC<PropiedadesBotonExportar> = ({
  onExport,
  title = "Exportar",
  variant = "outline",
  size = "md",
  disabled = false,
  style,
}) => {
  const [modalAbrir, establecerModalAbrir] = useState(false);

  const manejarSeleccionar = (format: "pdf" | "excel") => {
    establecerModalAbrir(false);
    onExport(format);
  };

  const esOutline = variant === "outline";

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && establecerModalAbrir(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Exportar datos a PDF o Excel"
        style={[
          estilos.boton,
          esOutline ? estilos.botonOutline : estilos.botonPrimario,
          size === "sm" ? estilos.botonPeq : estilos.botonMed,
          disabled && estilos.botonDeshabilitado,
          style,
        ]}
      >
        <Ionicons
          name="download-outline"
          size={size === "sm" ? 16 : 18}
          color={esOutline ? tema.colors.primaryDark : "#ffffff"}
          style={estilos.botonIcono}
        />
        <Text
          style={[
            estilos.botonTexto,
            esOutline ? estilos.botonTextoOutline : estilos.botonTextoPrimario,
            size === "sm" && estilos.botonTextoPeq,
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>

      {/* Modal Selector de Formato */}
      <Modal
        visible={modalAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerModalAbrir(false)}
      >
        <Pressable style={estilos.backdrop} onPress={() => establecerModalAbrir(false)}>
          <View style={estilos.hojaTarjeta} onStartShouldSetResponder={() => true}>
            <View style={estilos.hojaEncabezado}>
              <Text style={estilos.hojaTitulo}>Exportar Reporte</Text>
              <TouchableOpacity
                onPress={() => establecerModalAbrir(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={estilos.hojaDescripcion}>
              Seleccione el formato deseado para generar el archivo:
            </Text>

            {/* Opción PDF */}
            <TouchableOpacity
              style={estilos.formatearOpcion}
              onPress={() => manejarSeleccionar("pdf")}
              activeOpacity={0.7}
            >
              <View style={[estilos.formatearIconoCaja, { backgroundColor: tema.colors.dangerLight }]}>
                <Ionicons name="document-text" size={24} color={tema.colors.danger} />
              </View>
              <View style={estilos.formatearInfo}>
                <Text style={estilos.formatearTitulo}>Documento PDF (.pdf)</Text>
                <Text style={estilos.formatearSub}>
                  Diseño formal listo para impresión o firma digital
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.colors.textMuted} />
            </TouchableOpacity>

            {/* Opción Excel */}
            <TouchableOpacity
              style={estilos.formatearOpcion}
              onPress={() => manejarSeleccionar("excel")}
              activeOpacity={0.7}
            >
              <View style={[estilos.formatearIconoCaja, { backgroundColor: tema.colors.okLight }]}>
                <Ionicons name="grid" size={24} color={tema.colors.ok} />
              </View>
              <View style={estilos.formatearInfo}>
                <Text style={estilos.formatearTitulo}>Planilla Excel (.xlsx)</Text>
                <Text style={estilos.formatearSub}>
                  Datos tabulados para análisis y fórmulas contables
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const estilos = StyleSheet.create({
  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radius.md,
  },
  botonMed: {
    minHeight: tema.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  botonPeq: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  botonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: tema.colors.primary,
  },
  botonPrimario: {
    backgroundColor: tema.colors.primary,
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  botonIcono: {
    marginRight: 6,
  },
  botonTexto: {
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
  botonTextoPeq: {
    fontSize: tema.fontSize.xs,
  },
  botonTextoOutline: {
    color: tema.colors.primaryDark,
  },
  botonTextoPrimario: {
    color: "#ffffff",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  hojaTarjeta: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.lg,
    ...tema.shadows.lg,
  },
  hojaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    paddingBottom: 10,
    marginBottom: 8,
  },
  hojaTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  hojaDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginBottom: 16,
  },
  formatearOpcion: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
    marginBottom: 10,
  },
  formatearIconoCaja: {
    width: 44,
    height: 44,
    borderRadius: tema.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  formatearInfo: {
    flex: 1,
    marginRight: 8,
  },
  formatearTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  formatearSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
});
