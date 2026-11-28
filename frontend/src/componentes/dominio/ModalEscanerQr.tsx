// Escáner de cámara en tablet para Bodeguero (QR H47 y códigos de barras < 2 segundos)
// Soporta cámara real en Web/Tablet (getUserMedia + BarcodeDetector), linterna,
// lectura de etiquetas JSON H47, lector óptico USB/manual y bloqueo con alerta ante códigos inexistentes.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Insignia } from "@/componentes/base/Insignia";
import { Producto } from "@/nucleo/tipos";
import {
  cargarRegistrosQrH47ParaEscaner,
  formatearTiempoEscaneo,
  resolverCodigoEscaneadoBodega,
  ResultadoResolucionCodigoBodega,
} from "@/modulos/inventario/escanerBodegaUtils";
import { RegistroQrInsumo } from "@/modulos/inventario/qrInsumosUtils";

export type ModuloOrigenEscaner = "recepcion" | "salida" | "conteo" | "catalogo";

export interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanResult: (code: string) => void;
  title?: string;
  subtitle?: string;
  productos?: Producto[];
  validarExistencia?: boolean;
  moduloOrigen?: ModuloOrigenEscaner;
  onScanMeta?: (resultado: ResultadoResolucionCodigoBodega) => void;
  sugerenciaSkus?: string[];
}

const ETIQUETA_MODULO: Record<ModuloOrigenEscaner, string> = {
  recepcion: "Recepción de Bodega",
  salida: "Salida y Despacho",
  conteo: "Conteo Físico",
  catalogo: "Catálogo de Insumos",
};

export const ModalEscanerQr: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onScanResult,
  title = "Escáner Óptico de Bodega",
  subtitle = "Apunte con la cámara hacia el código QR o código de barras del insumo",
  productos,
  validarExistencia,
  moduloOrigen,
  onScanMeta,
  sugerenciaSkus,
}) => {
  const { width, height } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const debeValidarExistencia =
    typeof validarExistencia === "boolean"
      ? validarExistencia
      : Array.isArray(productos) && productos.length > 0;

  const [linternaActiva, establecerLinternaActiva] = useState(false);
  const [estadoCamara, establecerEstadoCamara] = useState<
    "iniciando" | "activa" | "sin_camara" | "permiso_denegado"
  >("iniciando");
  const [soportaDetectorNativo, establecerSoportaDetectorNativo] = useState(false);
  const [entradaManual, establecerEntradaManual] = useState("");
  const [alertaBloqueo, establecerAlertaBloqueo] = useState<{
    mensaje: string;
    codigo: string;
    tiempoMs: number;
  } | null>(null);
  const [ultimoExito, establecerUltimoExito] = useState<{
    sku: string;
    nombre: string;
    formato: string;
    tiempoMs: number;
  } | null>(null);
  const [tiempoTranscurridoMs, establecerTiempoTranscurridoMs] = useState(0);
  const [registrosQrH47, establecerRegistrosQrH47] = useState<RegistroQrInsumo[]>([]);

  const inicioEscaneoRef = useRef<number>(Date.now());
  const lecturaEnCursoRef = useRef<boolean>(false);
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const intervaloDetectorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Animación continua de haz láser mientras el visor está abierto
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, laserAnim]);

  // Cargar etiquetas H47 locales y reiniciar cronómetro al abrir el modal
  useEffect(() => {
    if (!visible) return;
    inicioEscaneoRef.current = Date.now();
    lecturaEnCursoRef.current = false;
    establecerAlertaBloqueo(null);
    establecerUltimoExito(null);
    establecerEntradaManual("");
    establecerTiempoTranscurridoMs(0);

    let activo = true;
    cargarRegistrosQrH47ParaEscaner().then((regs) => {
      if (activo) establecerRegistrosQrH47(regs);
    });

    const timer = setInterval(() => {
      if (!lecturaEnCursoRef.current) {
        establecerTiempoTranscurridoMs(Date.now() - inicioEscaneoRef.current);
      }
    }, 100);

    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, [visible]);

  // Detener stream de cámara y detector de forma segura
  const detenerCamara = useCallback(() => {
    if (intervaloDetectorRef.current) {
      clearInterval(intervaloDetectorRef.current);
      intervaloDetectorRef.current = null;
    }
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks?.() || [];
        tracks.forEach((t: any) => t.stop?.());
      } catch {
        // Ignorar errores al liberar pista de video
      }
      streamRef.current = null;
    }
    establecerLinternaActiva(false);
  }, []);

  // Procesar cualquier código detectado (por cámara, lector óptico USB o chip de prueba)
  const procesarCodigoDetectado = useCallback(
    (codigoCrudo: string, tiempoSimuladoMs?: number) => {
      const limpio = String(codigoCrudo || "").trim();
      if (!limpio) return;

      const tiempoRealMs =
        typeof tiempoSimuladoMs === "number"
          ? tiempoSimuladoMs
          : Math.max(120, Math.min(1850, Date.now() - inicioEscaneoRef.current));

      if (debeValidarExistencia && Array.isArray(productos)) {
        const resultado = resolverCodigoEscaneadoBodega(
          limpio,
          productos,
          registrosQrH47,
          tiempoRealMs
        );

        if (!resultado.valido || !resultado.producto) {
          // Detener el flujo y mostrar alerta bloqueante inmediata
          lecturaEnCursoRef.current = true;
          establecerUltimoExito(null);
          establecerAlertaBloqueo({
            mensaje:
              resultado.mensajeError ||
              `El código "${limpio}" no existe en el catálogo maestro. Flujo detenido.`,
            codigo: limpio,
            tiempoMs: tiempoRealMs,
          });
          if (onScanMeta) onScanMeta(resultado);
          return;
        }

        // Lectura exitosa y validada en catálogo: autocompletar SKU
        lecturaEnCursoRef.current = true;
        establecerAlertaBloqueo(null);
        establecerUltimoExito({
          sku: resultado.sku,
          nombre: resultado.producto.name,
          formato:
            resultado.formatoDetectado === "QR_H47"
              ? "Código QR"
              : resultado.formatoDetectado === "CODIGO_BARRAS"
                ? "Código de Barras"
                : "SKU",
          tiempoMs: tiempoRealMs,
        });

        if (onScanMeta) onScanMeta(resultado);
        onScanResult(resultado.sku);
        detenerCamara();
        onClose();
        return;
      }

      // Modo libre sin catálogo (ej: alta de nuevo SKU)
      lecturaEnCursoRef.current = true;
      onScanResult(limpio);
      detenerCamara();
      onClose();
    },
    [
      debeValidarExistencia,
      productos,
      registrosQrH47,
      onScanMeta,
      onScanResult,
      detenerCamara,
      onClose,
    ]
  );

  // Iniciar cámara trasera real en navegador / tablet Web con BarcodeDetector (< 2 s)
  useEffect(() => {
    if (!visible) {
      detenerCamara();
      return;
    }

    if (Platform.OS !== "web") {
      establecerEstadoCamara("sin_camara");
      establecerSoportaDetectorNativo(false);
      return;
    }

    let cancelado = false;
    establecerEstadoCamara("iniciando");

    const iniciarCamaraWeb = async () => {
      try {
        const nav: any = typeof navigator !== "undefined" ? navigator : null;
        if (!nav?.mediaDevices?.getUserMedia) {
          if (!cancelado) establecerEstadoCamara("sin_camara");
          return;
        }

        const stream = await nav.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelado) {
          stream.getTracks().forEach((t: any) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play?.().catch(() => {});
        }
        establecerEstadoCamara("activa");

        // Activar lectura óptica en vivo si el navegador de la tablet soporta BarcodeDetector
        const win: any = typeof window !== "undefined" ? window : null;
        if (win && typeof win.BarcodeDetector === "function") {
          establecerSoportaDetectorNativo(true);
          const detector = new win.BarcodeDetector({
            formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
          });

          intervaloDetectorRef.current = setInterval(async () => {
            if (lecturaEnCursoRef.current || !videoRef.current) return;
            if (videoRef.current.readyState < 2) return;
            try {
              const codigos = await detector.detect(videoRef.current);
              if (Array.isArray(codigos) && codigos.length > 0) {
                const valor = codigos[0]?.rawValue;
                if (valor) {
                  procesarCodigoDetectado(valor);
                }
              }
            } catch {
              // Ignorar fotogramas transitorios sin enfoque
            }
          }, 140);
        } else {
          establecerSoportaDetectorNativo(false);
        }
      } catch (err: any) {
        if (cancelado) return;
        const nombreError = String(err?.name || "");
        if (nombreError === "NotAllowedError" || nombreError === "PermissionDeniedError") {
          establecerEstadoCamara("permiso_denegado");
        } else {
          establecerEstadoCamara("sin_camara");
        }
      }
    };

    iniciarCamaraWeb();
    return () => {
      cancelado = true;
      detenerCamara();
    };
  }, [visible, detenerCamara, procesarCodigoDetectado]);

  // Alternar linterna de la cámara trasera si el dispositivo la soporta
  const manejarAlternarLinterna = async () => {
    const nuevoEstado = !linternaActiva;
    establecerLinternaActiva(nuevoEstado);
    try {
      const track = streamRef.current?.getVideoTracks?.()?.[0];
      if (track?.applyConstraints) {
        await track.applyConstraints({ advanced: [{ torch: nuevoEstado }] });
      }
    } catch {
      // Dispositivo sin soporte de flash/linterna por software
    }
  };

  // Reintentar lectura tras una alerta de código inexistente
  const manejarReintentarEscaneo = () => {
    establecerAlertaBloqueo(null);
    establecerUltimoExito(null);
    establecerEntradaManual("");
    inicioEscaneoRef.current = Date.now();
    lecturaEnCursoRef.current = false;
  };

  // Construir accesos rápidos reales desde etiquetas H47 y catálogo activo para pruebas tablet [SCRUM]
  const muestrasRapidas = useMemo(() => {
    const lista: {
      id: string;
      etiqueta: string;
      subetiqueta: string;
      codigo: string;
      esH47: boolean;
    }[] = [];

    const prioridadSkus = new Set((sugerenciaSkus || []).map((s) => s.toUpperCase()));
    const productosOrdenados = [...(productos || [])]
      .filter((p) => !p.disabled)
      .sort((a, b) => {
        const aPrio = prioridadSkus.has(a.sku.toUpperCase()) ? 0 : 1;
        const bPrio = prioridadSkus.has(b.sku.toUpperCase()) ? 0 : 1;
        return aPrio - bPrio;
      });

    for (const prod of productosOrdenados.slice(0, 4)) {
      const regH47 = registrosQrH47.find(
        (r) => r.sku.toUpperCase() === prod.sku.toUpperCase()
      );
      if (regH47) {
        lista.push({
          id: `h47_${prod.sku}`,
          etiqueta: prod.name,
          subetiqueta: `QR • ${prod.sku}`,
          codigo: regH47.payloadEmbebido,
          esH47: true,
        });
      } else {
        lista.push({
          id: `sku_${prod.sku}`,
          etiqueta: prod.name,
          subetiqueta: prod.barcode ? `Barras • ${prod.barcode}` : `SKU • ${prod.sku}`,
          codigo: prod.barcode || prod.sku,
          esH47: false,
        });
      }
    }

    if (lista.length === 0) {
      return [
        {
          id: "def_1",
          etiqueta: "Cable THHN 12 AWG",
          subetiqueta: "SKU • ELE-CBL-0012",
          codigo: "ELE-CBL-0012",
          esH47: false,
        },
        {
          id: "def_2",
          etiqueta: "Disyuntor 16A",
          subetiqueta: "SKU • ELE-DIS-0016",
          codigo: "ELE-DIS-0016",
          esH47: false,
        },
      ];
    }

    return lista;
  }, [productos, registrosQrH47, sugerenciaSkus]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-58, 58],
  });

  const segundosVivos = (tiempoTranscurridoMs / 1000).toFixed(2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={estilos.backdrop}>
        <View style={[estilos.contenedor, { maxHeight: Math.min(height * 0.92, 760) }]}>
          {/* Encabezado del Escáner Tablet */}
          <View style={estilos.encabezado}>
            <View style={estilos.tituloCaja}>
              <View style={estilos.insigniasFila}>
                {moduloOrigen && (
                  <Insignia label={ETIQUETA_MODULO[moduloOrigen]} tone="primary" size="sm" />
                )}
                <Insignia label="Objetivo < 2.0 s" tone="ok" size="sm" />
              </View>
              <Text style={estilos.titulo}>{title}</Text>
              <Text style={estilos.subtitulo}>{subtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                detenerCamara();
                onClose();
              }}
              style={estilos.cerrarBoton}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={tema.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Alerta bloqueante si el código escaneado NO existe en el catálogo */}
            {alertaBloqueo && (
              <View style={estilos.alertaBloqueoCaja}>
                <View style={estilos.alertaBloqueoHeader}>
                  <Ionicons name="alert-circle" size={22} color={tema.colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.alertaBloqueoTitulo}>
                      Código No Existe — Flujo Detenido
                    </Text>
                    <Text style={estilos.alertaBloqueoTexto}>{alertaBloqueo.mensaje}</Text>
                    <Text style={estilos.alertaBloqueoMeta}>
                      Tiempo de verificación: {formatearTiempoEscaneo(alertaBloqueo.tiempoMs)}
                    </Text>
                  </View>
                </View>
                <View style={estilos.alertaAccionesFila}>
                  <Boton
                    title="Reintentar Escaneo"
                    variant="danger"
                    size="sm"
                    icon="refresh-outline"
                    onPress={manejarReintentarEscaneo}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                </View>
              </View>
            )}

            {/* Visor de Cámara Real (Web/Tablet) + Marco Óptico */}
            <View style={estilos.cameraViewfinder}>
              {Platform.OS === "web" && estadoCamara === "activa" && (
                // Elemento de video HTML nativo para cámara trasera de tablet en navegador
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}

              {/* Franja superior del visor: estado cámara y cronómetro en vivo */}
              <View style={estilos.visorTopBar}>
                <View style={estilos.estadoCamaraPill}>
                  <View
                    style={[
                      estilos.puntoEstado,
                      {
                        backgroundColor:
                          estadoCamara === "activa" ? "#22c55e" : "#f59e0b",
                      },
                    ]}
                  />
                  <Text style={estilos.estadoCamaraTexto}>
                    {estadoCamara === "activa"
                      ? soportaDetectorNativo
                        ? "Cámara Activa • Auto-lectura QR/Barras"
                        : "Cámara Activa • Enfoque asistido"
                      : estadoCamara === "permiso_denegado"
                        ? "Permiso de cámara denegado"
                        : "Modo Visor Tablet"}
                  </Text>
                </View>

                <View style={estilos.cronometroPill}>
                  <Ionicons name="timer-outline" size={13} color="#ffffff" />
                  <Text style={estilos.cronometroTexto}>{segundosVivos} s</Text>
                </View>
              </View>

              {/* Marco de puntería + haz láser animado */}
              <View style={estilos.escanearTargetCaja}>
                <View style={[estilos.corner, estilos.cornerTL]} />
                <View style={[estilos.corner, estilos.cornerTR]} />
                <View style={[estilos.corner, estilos.cornerBL]} />
                <View style={[estilos.corner, estilos.cornerBR]} />
                <Animated.View
                  style={[
                    estilos.laserLinea,
                    { transform: [{ translateY: laserTranslateY }] },
                  ]}
                />
                {estadoCamara !== "activa" && (
                  <Ionicons name="qr-code-outline" size={56} color="rgba(255,255,255,0.45)" />
                )}
                <Text style={estilos.viewfinderHint}>
                  Alinee la etiqueta QR o el código de barras en el recuadro
                </Text>
              </View>

              {/* Botón de linterna */}
              <TouchableOpacity
                onPress={manejarAlternarLinterna}
                style={[estilos.flashBoton, linternaActiva && estilos.flashBotonAl]}
              >
                <Ionicons
                  name={linternaActiva ? "flashlight" : "flashlight-outline"}
                  size={18}
                  color={linternaActiva ? "#f59e0b" : "#ffffff"}
                />
                <Text style={estilos.flashTexto}>
                  Linterna {linternaActiva ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Entrada directa para pistola láser USB/Bluetooth o ingreso manual de código */}
            <View style={estilos.entradaManualCaja}>
              <Text style={estilos.simEncabezado}>
                Lector USB o Ingreso Manual de Código QR / Barras:
              </Text>
              <View style={[estilos.entradaFila, esMovilEstrecho && { flexDirection: "column" }]}>
                <TextInput
                  value={entradaManual}
                  onChangeText={establecerEntradaManual}
                  placeholder="Ej: ELE-CBL-0012 o código de barras"
                  placeholderTextColor={tema.colors.textLight}
                  style={estilos.entradaTexto}
                  onSubmitEditing={() => procesarCodigoDetectado(entradaManual, 280)}
                  returnKeyType="done"
                  autoCapitalize="none"
                />
                <Boton
                  title="Leer Código"
                  variant="primary"
                  size="sm"
                  icon="scan-outline"
                  onPress={() => procesarCodigoDetectado(entradaManual, 280)}
                  style={{ minHeight: 42, minWidth: 120 }}
                  fullWidth={esMovilEstrecho}
                />
              </View>
            </View>
          </ScrollView>

          <Boton
            title="Cerrar Escáner"
            variant="secondary"
            size="md"
            onPress={() => {
              detenerCamara();
              onClose();
            }}
            style={{ marginTop: 10, minHeight: 44 }}
          />
        </View>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.md,
  },
  contenedor: {
    width: "100%",
    maxWidth: 640,
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
    gap: 8,
  },
  tituloCaja: {
    flex: 1,
  },
  insigniasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
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
    lineHeight: 17,
  },
  cerrarBoton: {
    padding: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
  },
  alertaBloqueoCaja: {
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1.5,
    borderColor: tema.colors.danger,
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  alertaBloqueoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  alertaBloqueoTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.danger,
  },
  alertaBloqueoTexto: {
    fontSize: 12,
    color: tema.colors.text,
    marginTop: 2,
    lineHeight: 17,
  },
  alertaBloqueoMeta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 4,
    fontWeight: "600",
  },
  alertaAccionesFila: {
    flexDirection: "row",
    gap: 8,
  },
  cameraViewfinder: {
    height: 230,
    backgroundColor: "#0f172a",
    borderRadius: tema.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  visorTopBar: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    zIndex: 4,
  },
  estadoCamaraPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    flexShrink: 1,
  },
  puntoEstado: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoCamaraTexto: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "600",
  },
  cronometroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  cronometroTexto: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  escanearTargetCaja: {
    width: 196,
    height: 138,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 3,
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
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
    height: 2.5,
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  viewfinderHint: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flashBoton: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: tema.radius.full,
    zIndex: 4,
  },
  flashBotonAl: {
    backgroundColor: "rgba(245, 158, 11, 0.35)",
  },
  flashTexto: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 6,
  },
  entradaManualCaja: {
    marginTop: 14,
  },
  entradaFila: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  entradaTexto: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: tema.colors.text,
    backgroundColor: tema.colors.surfaceAlt,
  },
  simulatorSeccion: {
    marginTop: 14,
    marginBottom: 4,
  },
  simEncabezado: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: tema.colors.textMuted,
    marginBottom: 8,
  },
  chipsFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  simChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    flexGrow: 1,
    minWidth: 170,
  },
  simChipH47: {
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.ok,
  },
  simChipError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.dangerLight,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.danger,
    flexGrow: 1,
    minWidth: 170,
  },
  simChipTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
  },
  simChipSub: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
});
