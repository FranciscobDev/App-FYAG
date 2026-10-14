import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { Button } from "./Button";

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanResult: (code: string) => void;
  title?: string;
  subtitle?: string;
}

/**
 * Escáner de Cámara QR y Código de Barras (Contexto 2: Bodeguero en Tablet)
 * Interfaz con marco visor táctil para lectura rápida en bodega de insumos y herramientas.
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onScanResult,
  title = "Escáner Óptico de Bodega",
  subtitle = "Apunte con la tablet hacia el código QR o código de barras del bulto o herramienta",
}) => {
  const [flashlightOn, setFlashlightOn] = useState(false);

  // Muestras rápidas para simular escaneo en Expo Go
  const sampleCodes = [
    { label: "Cable THHN 12 AWG", code: "ELE-CBL-0012" },
    { label: "Rotomartillo Bosch", code: "HER-001" },
    { label: "Orden de Compra OC-101", code: "OC-2026-101" },
    { label: "Disyuntor 16A", code: "ELE-DIS-0016" },
  ];

  const handleSimulateScan = (code: string) => {
    onScanResult(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleBox}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Cámara / Viewfinder Frame */}
          <View style={styles.cameraViewfinder}>
            <View style={styles.scanTargetBox}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.laserLine} />
              <Ionicons name="qr-code-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={styles.viewfinderHint}>Alinee el código en el recuadro</Text>
            </View>

            <TouchableOpacity
              onPress={() => setFlashlightOn(!flashlightOn)}
              style={[styles.flashBtn, flashlightOn && styles.flashBtnOn]}
            >
              <Ionicons
                name={flashlightOn ? "flashlight" : "flashlight-outline"}
                size={22}
                color={flashlightOn ? "#f59e0b" : "#ffffff"}
              />
              <Text style={styles.flashTxt}>Linterna {flashlightOn ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick scan simulator chips */}
          <View style={styles.simulatorSection}>
            <Text style={styles.simHeading}>Prueba de Lectura Inmediata (Tablet):</Text>
            <View style={styles.chipsRow}>
              {sampleCodes.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={styles.simChip}
                  onPress={() => handleSimulateScan(item.code)}
                >
                  <Ionicons name="barcode-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.simChipTxt}>{item.label} ({item.code})</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Button
            title="Cerrar Escáner"
            variant="secondary"
            size="lg"
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  container: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  titleBox: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  cameraViewfinder: {
    height: 220,
    backgroundColor: "#0f172a",
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  scanTargetBox: {
    width: 170,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: theme.colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laserLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  viewfinderHint: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  flashBtn: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
  },
  flashBtnOn: {
    backgroundColor: "rgba(245, 158, 11, 0.3)",
  },
  flashTxt: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 6,
  },
  simulatorSection: {
    marginVertical: theme.spacing.md,
  },
  simHeading: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  simChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
    marginBottom: 6,
  },
  simChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
    marginLeft: 6,
  },
});
