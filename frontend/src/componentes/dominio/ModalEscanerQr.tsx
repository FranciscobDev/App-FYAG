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
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";

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
export const ModalEscanerQr: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onScanResult,
  title = "Escáner Óptico de Bodega",
  subtitle = "Apunte con la tablet hacia el código QR o código de barras del bulto o herramienta",
}) => {
  const [flashlightAl, establecerFlashlightAl] = useState(false);

  // Muestras rápidas para simular escaneo en Expo Go
  const sampleCodes = [
    { label: "Cable THHN 12 AWG", code: "ELE-CBL-0012" },
    { label: "Rotomartillo Bosch", code: "HER-001" },
    { label: "Orden de Compra OC-101", code: "OC-2026-101" },
    { label: "Disyuntor 16A", code: "ELE-DIS-0016" },
  ];

  const manejarSimulateEscanear = (code: string) => {
    onScanResult(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={estilos.backdrop}>
        <View style={estilos.contenedor}>
          {/* Header */}
          <View style={estilos.encabezado}>
            <View style={estilos.tituloCaja}>
              <Text style={estilos.titulo}>{title}</Text>
              <Text style={estilos.subtitulo}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={estilos.cerrarBoton} hitSlop={8}>
              <Ionicons name="close" size={24} color={tema.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Cámara / Viewfinder Frame */}
          <View style={estilos.cameraViewfinder}>
            <View style={estilos.escanearTargetCaja}>
              <View style={[estilos.corner, estilos.cornerTL]} />
              <View style={[estilos.corner, estilos.cornerTR]} />
              <View style={[estilos.corner, estilos.cornerBL]} />
              <View style={[estilos.corner, estilos.cornerBR]} />
              <View style={estilos.laserLinea} />
              <Ionicons name="qr-code-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={estilos.viewfinderHint}>Alinee el código en el recuadro</Text>
            </View>

            <TouchableOpacity
              onPress={() => establecerFlashlightAl(!flashlightAl)}
              style={[estilos.flashBoton, flashlightAl && estilos.flashBotonAl]}
            >
              <Ionicons
                name={flashlightAl ? "flashlight" : "flashlight-outline"}
                size={22}
                color={flashlightAl ? "#f59e0b" : "#ffffff"}
              />
              <Text style={estilos.flashTexto}>Linterna {flashlightAl ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick scan simulator chips */}
          <View style={estilos.simulatorSeccion}>
            <Text style={estilos.simEncabezado}>Prueba de Lectura Inmediata (Tablet):</Text>
            <View style={estilos.chipsFila}>
              {sampleCodes.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={estilos.simChip}
                  onPress={() => manejarSimulateEscanear(item.code)}
                >
                  <Ionicons name="barcode-outline" size={16} color={tema.colors.primary} />
                  <Text style={estilos.simChipTexto}>{item.label} ({item.code})</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Boton
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

const estilos = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.md,
  },
  contenedor: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    padding: tema.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tema.spacing.md,
  },
  tituloCaja: {
    flex: 1,
    marginRight: 8,
  },
  titulo: {
    fontSize: tema.typography.h3.fontSize,
    fontWeight: tema.typography.h3.fontWeight,
    color: tema.colors.text,
  },
  subtitulo: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  cerrarBoton: {
    padding: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
  },
  cameraViewfinder: {
    height: 220,
    backgroundColor: "#0f172a",
    borderRadius: tema.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  escanearTargetCaja: {
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
    borderColor: tema.colors.primary,
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
  laserLinea: {
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
  flashBoton: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: tema.radius.full,
  },
  flashBotonAl: {
    backgroundColor: "rgba(245, 158, 11, 0.3)",
  },
  flashTexto: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 6,
  },
  simulatorSeccion: {
    marginVertical: tema.spacing.md,
  },
  simEncabezado: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: tema.colors.textMuted,
    marginBottom: 6,
  },
  chipsFila: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  simChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginRight: 6,
    marginBottom: 6,
  },
  simChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
    marginLeft: 6,
  },
});
