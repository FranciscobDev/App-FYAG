import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { DetalleNotificacion } from "@/nucleo/tipos";

export interface ElementoNotificacion {
  id: string;
  title: string;
  message: string;
  timeStr: string;
  read: boolean;
  type: "warn" | "ok" | "info" | "danger";
  category?: "costo" | "stock" | "plazo" | "solicitud" | "sistema";
  relatedEntityType?: "proyecto" | "solicitud" | "insumo" | "orden_compra" | "herramienta";
  relatedEntityId?: string;
  relatedEntityLabel?: string;
}

export interface PropiedadesCampanaNotificaciones {
  notifications?: ElementoNotificacion[];
  onMarkAllRead?: () => void;
  onNavigateToObject?: (entityType: string, entityId: string) => void;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  variant?: "dark" | "light";
}

type FilterType = "todas" | "stock" | "costo" | "plazo" | "solicitud" | "sistema";

export const CampanaNotificaciones: React.FC<PropiedadesCampanaNotificaciones> = ({
  notifications: propNotifications,
  onMarkAllRead: propOnMarkAllRead,
  onNavigateToObject,
  style,
  iconColor,
  variant = "dark",
}) => {
  const [modalAbrir, establecerModalAbrir] = useState(false);
  const [seleccionadoTipo, establecerSeleccionadoTipo] = useState<FilterType>("todas");
  const insets = useSafeAreaInsets();
  const superiorInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0
  );
  const esOscuro = variant === "dark";
  const resueltoColor = iconColor || (esOscuro ? "#ffffff" : tema.colors.text);

  // Consume from AppContext if available
  let appContext: ReturnType<typeof usarAplicacion> | null = null;
  try {
    appContext = usarAplicacion();
  } catch {
    // If rendered outside AppProvider (e.g. standalone test)
    appContext = null;
  }

  const rawNotificaciones: DetalleNotificacion[] = appContext
    ? appContext.listaNotificaciones
    : (propNotifications || []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        date: n.timeStr,
        type: n.category || "sistema",
        severity: n.type,
        read: n.read,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
        relatedEntityLabel: n.relatedEntityLabel,
      }));

  const noLeidoConteo = rawNotificaciones.filter((n) => !n.read).length;

  const filtradoNotificaciones = rawNotificaciones.filter((item) => {
    if (seleccionadoTipo === "todas") return true;
    return item.type === seleccionadoTipo;
  });

  const manejarMarcarTodos = () => {
    if (appContext) {
      appContext.marcarTodasNotificacionesLeidas();
    }
    if (propOnMarkAllRead) {
      propOnMarkAllRead();
    }
  };

  const manejarElementoPress = (item: DetalleNotificacion) => {
    if (!item.read && appContext) {
      appContext.marcarNotificacionLeida(item.id);
    }
    if (item.relatedEntityType && item.relatedEntityId && onNavigateToObject) {
      establecerModalAbrir(false);
      onNavigateToObject(item.relatedEntityType, item.relatedEntityId);
    }
  };

  const manejarEntityEnlace = (item: DetalleNotificacion) => {
    if (!item.read && appContext) {
      appContext.marcarNotificacionLeida(item.id);
    }
    establecerModalAbrir(false);
    if (item.relatedEntityType && item.relatedEntityId && onNavigateToObject) {
      onNavigateToObject(item.relatedEntityType, item.relatedEntityId);
    }
  };

  const obtenerTipoInsigniaConfiguracion = (type: DetalleNotificacion["type"]) => {
    switch (type) {
      case "stock":
        return { label: "Stock", color: tema.colors.warnDark, bg: tema.colors.warnLight, icon: "cube-outline" as const };
      case "costo":
        return { label: "Costo", color: tema.colors.danger, bg: tema.colors.dangerLight, icon: "cash-outline" as const };
      case "plazo":
        return { label: "Plazos", color: "#b45309", bg: "#fef3c7", icon: "time-outline" as const };
      case "solicitud":
        return { label: "Solicitud", color: tema.colors.primaryDark, bg: tema.colors.primaryLight, icon: "document-text-outline" as const };
      case "sistema":
      default:
        return { label: "Sistema", color: "#475569", bg: "#f1f5f9", icon: "settings-outline" as const };
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => establecerModalAbrir(true)}
        style={[
          estilos.bellBoton,
          esOscuro ? estilos.bellBotonOscuro : estilos.bellBotonClaro,
          style,
        ]}
        activeOpacity={0.7}
        accessibilityLabel={`Notificaciones, ${noLeidoConteo} no leídas`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={22} color={resueltoColor} />
        {noLeidoConteo > 0 && (
          <View style={[estilos.insignia, esOscuro && estilos.insigniaOscuro]}>
            <Text style={estilos.insigniaTexto}>
              {noLeidoConteo > 9 ? "9+" : noLeidoConteo}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal de Notificaciones */}
      <Modal
        visible={modalAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerModalAbrir(false)}
      >
        <Pressable
          style={[
            estilos.backdrop,
            {
              paddingTop: superiorInset + 58,
              paddingBottom: Math.max(insets.bottom + 12, 16),
            },
          ]}
          onPress={() => establecerModalAbrir(false)}
        >
          <View style={estilos.modalTarjeta} onStartShouldSetResponder={() => true}>
            {/* Encabezado */}
            <View style={estilos.encabezado}>
              <View style={estilos.encabezadoIzquierda}>
                <Ionicons name="notifications" size={20} color={tema.colors.primary} />
                <Text style={estilos.encabezadoTitulo}>Notificaciones</Text>
                {noLeidoConteo > 0 ? (
                  <View style={estilos.contadorChip}>
                    <Text style={estilos.contadorTexto}>{noLeidoConteo} no leídas</Text>
                  </View>
                ) : (
                  <View style={[estilos.contadorChip, { backgroundColor: tema.colors.okLight }]}>
                    <Text style={[estilos.contadorTexto, { color: tema.colors.ok }]}>Al día</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={() => establecerModalAbrir(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Filtros por Tipo de Notificación */}
            <View style={estilos.filtrarBarra}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtrarScroll}>
                {[
                  { id: "todas", label: "Todas" },
                  { id: "stock", label: "Stock" },
                  { id: "solicitud", label: "Solicitudes" },
                  { id: "costo", label: "Costo" },
                  { id: "plazo", label: "Plazos" },
                  { id: "sistema", label: "Sistema" },
                ].map((f) => {
                  const esActivo = seleccionadoTipo === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[estilos.filtrarChip, esActivo && estilos.filtrarChipActivo]}
                      onPress={() => establecerSeleccionadoTipo(f.id as FilterType)}
                    >
                      <Text style={[estilos.filtrarChipTexto, esActivo && estilos.filtrarChipTextoActivo]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Lista de Notificaciones */}
            <ScrollView style={estilos.lista}>
              {filtradoNotificaciones.length === 0 ? (
                <View style={estilos.vacioContenedor}>
                  <Ionicons name="notifications-off-outline" size={36} color={tema.colors.textMuted} />
                  <Text style={estilos.vacioTexto}>No hay notificaciones en esta categoría</Text>
                </View>
              ) : (
                filtradoNotificaciones.map((item) => {
                  const insigniaCfg = obtenerTipoInsigniaConfiguracion(item.type);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        estilos.elementoFila,
                        !item.read && estilos.elementoFilaNoLeido,
                      ]}
                      onPress={() => manejarElementoPress(item)}
                      activeOpacity={0.8}
                    >
                      {/* Indicador de no leída */}
                      <View style={estilos.noLeidoIndicatorCaja}>
                        {!item.read && <View style={estilos.noLeidoPunto} />}
                      </View>

                      {/* Ícono de tipo */}
                      <View style={[estilos.elementoIconoCaja, { backgroundColor: insigniaCfg.bg }]}>
                        <Ionicons name={insigniaCfg.icon} size={18} color={insigniaCfg.color} />
                      </View>

                      {/* Información de notificación */}
                      <View style={estilos.elementoInfo}>
                        <View style={estilos.elementoSuperiorFila}>
                          <View style={estilos.tituloWithInsignia}>
                            <View style={[estilos.tipoMiniInsignia, { backgroundColor: insigniaCfg.bg }]}>
                              <Text style={[estilos.tipoMiniInsigniaTexto, { color: insigniaCfg.color }]}>
                                {insigniaCfg.label}
                              </Text>
                            </View>
                            <Text style={estilos.elementoTiempo}>{item.date}</Text>
                          </View>
                        </View>

                        <Text style={[estilos.elementoTitulo, !item.read && estilos.elementoTituloNoLeido]}>
                          {item.title}
                        </Text>
                        <Text style={estilos.elementoMensaje}>{item.message}</Text>

                        {/* Enlace al objeto relacionado */}
                        {item.relatedEntityType && item.relatedEntityId && (
                          <TouchableOpacity
                            style={estilos.relatedEnlaceBoton}
                            onPress={() => manejarEntityEnlace(item)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="open-outline" size={13} color={tema.colors.primary} />
                            <Text style={estilos.relatedEnlaceTexto}>
                              {item.relatedEntityLabel || `Ver ${item.relatedEntityType}: ${item.relatedEntityId}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Pie con botón de marcar todas */}
            <View style={estilos.pie}>
              {noLeidoConteo > 0 ? (
                <TouchableOpacity
                  onPress={manejarMarcarTodos}
                  style={estilos.marcarTodosBoton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={16} color={tema.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={estilos.marcarTodosTexto}>Marcar todas como leídas</Text>
                </TouchableOpacity>
              ) : (
                <Text style={estilos.todosLeidoTexto}>Todas las alertas han sido revisadas</Text>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const estilos = StyleSheet.create({
  bellBoton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBotonOscuro: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  bellBotonClaro: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  insignia: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: tema.colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#ffffff",
    zIndex: 10,
  },
  insigniaOscuro: {
    borderColor: "#1c1917",
  },
  insigniaTexto: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 16,
  },
  modalTarjeta: {
    width: 380,
    maxWidth: "94%",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    maxHeight: 520,
    ...tema.shadows.lg,
    overflow: "hidden",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.md,
    paddingVertical: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  encabezadoIzquierda: {
    flexDirection: "row",
    alignItems: "center",
  },
  encabezadoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    marginLeft: 6,
  },
  contadorChip: {
    backgroundColor: tema.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    marginLeft: 8,
  },
  contadorTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.primaryDark,
  },
  filtrarBarra: {
    backgroundColor: tema.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    paddingVertical: 6,
  },
  filtrarScroll: {
    paddingHorizontal: tema.spacing.sm,
    gap: 6,
  },
  filtrarChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    minHeight: tema.touchTargets.minHeight,
    justifyContent: "center",
  },
  filtrarChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  filtrarChipTexto: {
    fontSize: 11,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  filtrarChipTextoActivo: {
    color: tema.colors.textInverse,
    fontWeight: tema.fontWeight.semibold,
  },
  lista: {
    maxHeight: 360,
  },
  vacioContenedor: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  vacioTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 8,
  },
  elementoFila: {
    flexDirection: "row",
    padding: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    alignItems: "flex-start",
  },
  elementoFilaNoLeido: {
    backgroundColor: tema.colors.primaryLight,
  },
  noLeidoIndicatorCaja: {
    width: 10,
    paddingTop: 8,
    alignItems: "center",
  },
  noLeidoPunto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tema.colors.primary,
  },
  elementoIconoCaja: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  elementoInfo: {
    flex: 1,
  },
  elementoSuperiorFila: {
    marginBottom: 4,
  },
  tituloWithInsignia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tipoMiniInsignia: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tipoMiniInsigniaTexto: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  elementoTiempo: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  elementoTitulo: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 2,
  },
  elementoTituloNoLeido: {
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  elementoMensaje: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    lineHeight: 16,
  },
  relatedEnlaceBoton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: tema.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
  },
  relatedEnlaceTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  pie: {
    paddingHorizontal: tema.spacing.md,
    paddingVertical: 10,
    backgroundColor: tema.colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    alignItems: "center",
  },
  marcarTodosBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  marcarTodosTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.primary,
  },
  todosLeidoTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontStyle: "italic",
  },
});
