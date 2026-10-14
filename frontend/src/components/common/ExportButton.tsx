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
import { theme } from "@/core/theme";

export interface ExportButtonProps {
  onExport: (format: "pdf" | "excel") => void;
  title?: string;
  variant?: "outline" | "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  title = "Exportar",
  variant = "outline",
  size = "md",
  disabled = false,
  style,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelect = (format: "pdf" | "excel") => {
    setModalOpen(false);
    onExport(format);
  };

  const isOutline = variant === "outline";

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setModalOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Exportar datos a PDF o Excel"
        style={[
          styles.btn,
          isOutline ? styles.btnOutline : styles.btnPrimary,
          size === "sm" ? styles.btnSm : styles.btnMd,
          disabled && styles.btnDisabled,
          style,
        ]}
      >
        <Ionicons
          name="download-outline"
          size={size === "sm" ? 16 : 18}
          color={isOutline ? theme.colors.primaryDark : "#ffffff"}
          style={styles.btnIcon}
        />
        <Text
          style={[
            styles.btnText,
            isOutline ? styles.btnTextOutline : styles.btnTextPrimary,
            size === "sm" && styles.btnTextSm,
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>

      {/* Modal Selector de Formato */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.sheetCard} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Exportar Reporte</Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetDesc}>
              Seleccione el formato deseado para generar el archivo:
            </Text>

            {/* Opción PDF */}
            <TouchableOpacity
              style={styles.formatOption}
              onPress={() => handleSelect("pdf")}
              activeOpacity={0.7}
            >
              <View style={[styles.formatIconBox, { backgroundColor: theme.colors.dangerLight }]}>
                <Ionicons name="document-text" size={24} color={theme.colors.danger} />
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatTitle}>Documento PDF (.pdf)</Text>
                <Text style={styles.formatSub}>
                  Diseño formal listo para impresión o firma digital
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Opción Excel */}
            <TouchableOpacity
              style={styles.formatOption}
              onPress={() => handleSelect("excel")}
              activeOpacity={0.7}
            >
              <View style={[styles.formatIconBox, { backgroundColor: theme.colors.okLight }]}>
                <Ionicons name="grid" size={24} color={theme.colors.ok} />
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatTitle}>Planilla Excel (.xlsx)</Text>
                <Text style={styles.formatSub}>
                  Datos tabulados para análisis y fórmulas contables
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
  },
  btnMd: {
    minHeight: theme.touchTargets.minHeight, // Mínimo 44 px
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnSm: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnIcon: {
    marginRight: 6,
  },
  btnText: {
    fontWeight: "bold",
    fontSize: theme.fontSize.sm,
  },
  btnTextSm: {
    fontSize: theme.fontSize.xs,
  },
  btnTextOutline: {
    color: theme.colors.primaryDark,
  },
  btnTextPrimary: {
    color: "#ffffff",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  sheetCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sheetDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  formatOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: 10,
  },
  formatIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  formatInfo: {
    flex: 1,
    marginRight: 8,
  },
  formatTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  formatSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
