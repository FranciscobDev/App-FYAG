// Campana de notificaciones en la barra superior (web y móvil) con insignia numérica
// de no leídas en vivo, bandeja central filtrable por estado/categoría/texto y vista de detalle.
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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

type FiltroCategoria = "todas" | "solicitud" | "stock" | "costo" | "plazo" | "sistema";
type FiltroLectura = "todas" | "no_leidas" | "leidas";

export const CampanaNotificaciones: React.FC<PropiedadesCampanaNotificaciones> = ({
  notifications: propNotifications,
  onMarkAllRead: propOnMarkAllRead,
  onNavigateToObject,
  style,
  iconColor,
  variant = "dark",
}) => {
  const { width, height } = useWindowDimensions();
  const esMovil = width < 560;
  const insets = useSafeAreaInsets();
  const superiorInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0
  );
  const esOscuro = variant === "dark";
  const resueltoColor = iconColor || (esOscuro ? "#ffffff" : tema.colors.text);

  const [modalAbrir, establecerModalAbrir] = useState(false);
  const [seleccionadoTipo, establecerSeleccionadoTipo] = useState<FiltroCategoria>("todas");
  const [filtroLectura, establecerFiltroLectura] = useState<FiltroLectura>("todas");
  const [busqueda, establecerBusqueda] = useState("");
  const [alertaAbiertaId, establecerAlertaAbiertaId] = useState<string | null>(null);
  const [leidasLocalesIds, establecerLeidasLocalesIds] = useState<Record<string, boolean>>({});

  // Consumir estado global de notificaciones desde ContextoAplicacion
  let appContext: ReturnType<typeof usarAplicacion> | null = null;
  try {
    appContext = usarAplicacion();
  } catch {
    appContext = null;
  }

  const rawNotificaciones: DetalleNotificacion[] = useMemo(() => {
    const base = appContext
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

    return base.map((n) => ({
      ...n,
      read: n.read || Boolean(leidasLocalesIds[n.id]),
    }));
  }, [appContext, propNotifications, leidasLocalesIds]);

  // Métricas en vivo para la insignia superior y mini dashboard de la bandeja
  const metricas = useMemo(() => {
    const noLeidas = rawNotificaciones.filter((n) => !n.read).length;
    const leidas = rawNotificaciones.length - noLeidas;
    const solicitudesNoLeidas = rawNotificaciones.filter(
      (n) => !n.read && n.type === "solicitud"
    ).length;
    const criticasNoLeidas = rawNotificaciones.filter(
      (n) => !n.read && (n.severity === "danger" || n.severity === "warn")
    ).length;
    return {
      total: rawNotificaciones.length,
      noLeidas,
      leidas,
      solicitudesNoLeidas,
      criticasNoLeidas,
    };
  }, [rawNotificaciones]);

  const noLeidoConteo = metricas.noLeidas;

  // Listado filtrado por estado de lectura, categoría y texto
  const filtradoNotificaciones = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rawNotificaciones.filter((item) => {
      if (filtroLectura === "no_leidas" && item.read) return false;
      if (filtroLectura === "leidas" && !item.read) return false;
      if (seleccionadoTipo !== "todas" && item.type !== seleccionadoTipo) return false;
      if (q) {
        const coincideTitulo = item.title.toLowerCase().includes(q);
        const coincideMensaje = item.message.toLowerCase().includes(q);
        const coincideRef = (item.relatedEntityLabel || "").toLowerCase().includes(q);
        if (!coincideTitulo && !coincideMensaje && !coincideRef) return false;
      }
      return true;
    });
  }, [rawNotificaciones, filtroLectura, seleccionadoTipo, busqueda]);

  const alertaAbierta = useMemo(
    () => rawNotificaciones.find((n) => n.id === alertaAbiertaId) || null,
    [rawNotificaciones, alertaAbiertaId]
  );

  // Marcar una alerta individual como leída al instante
  const marcarUnaComoLeida = (id: string) => {
    establecerLeidasLocalesIds((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    if (appContext) {
      appContext.marcarNotificacionLeida(id);
    }
  };

  // Marcar todas las alertas como leídas
  const manejarMarcarTodos = () => {
    const mapaTodas: Record<string, boolean> = {};
    rawNotificaciones.forEach((n) => {
      mapaTodas[n.id] = true;
    });
    establecerLeidasLocalesIds((prev) => ({ ...prev, ...mapaTodas }));
    if (appContext) {
      appContext.marcarTodasNotificacionesLeidas();
    }
    if (propOnMarkAllRead) {
      propOnMarkAllRead();
    }
  };

  // Abrir una alerta: disminuye el contador de no leídas al instante y muestra su detalle
  const manejarAbrirAlerta = (item: DetalleNotificacion) => {
    if (!item.read) {
      marcarUnaComoLeida(item.id);
    }
    establecerAlertaAbiertaId((prev) => (prev === item.id ? null : item.id));
  };

  // Navegar al módulo u objeto relacionado y cerrar la bandeja
  const manejarIrAObjeto = (item: DetalleNotificacion) => {
    if (!item.read) {
      marcarUnaComoLeida(item.id);
    }
    establecerAlertaAbiertaId(null);
    establecerModalAbrir(false);
    if (item.relatedEntityType && item.relatedEntityId && onNavigateToObject) {
      onNavigateToObject(item.relatedEntityType, item.relatedEntityId);
    }
  };

  const obtenerTipoInsigniaConfiguracion = (type: DetalleNotificacion["type"]) => {
    switch (type) {
      case "stock":
        return {
          label: "Stock",
          color: tema.colors.warnDark,
          bg: tema.colors.warnLight,
          icon: "cube-outline" as const,
        };
      case "costo":
        return {
          label: "Costo",
          color: tema.colors.danger,
          bg: tema.colors.dangerLight,
          icon: "cash-outline" as const,
        };
      case "plazo":
        return {
          label: "Plazos",
          color: "#b45309",
          bg: "#fef3c7",
          icon: "time-outline" as const,
        };
      case "solicitud":
        return {
          label: "Solicitud",
          color: tema.colors.primaryDark,
          bg: tema.colors.primaryLight,
          icon: "document-text-outline" as const,
        };
      case "sistema":
      default:
        return {
          label: "Sistema",
          color: "#475569",
          bg: "#f1f5f9",
          icon: "settings-outline" as const,
        };
    }
  };

  const categoriasFiltro: { id: FiltroCategoria; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "solicitud", label: "Solicitudes" },
    { id: "stock", label: "Stock" },
    { id: "costo", label: "Costo" },
    { id: "plazo", label: "Plazos" },
    { id: "sistema", label: "Sistema" },
  ];

  const contarNoLeidasCategoria = (cat: FiltroCategoria) => {
    if (cat === "todas") return noLeidoConteo;
    return rawNotificaciones.filter((n) => !n.read && n.type === cat).length;
  };

  return (
    <>
      {/* Botón Campana en Barra Superior (Web y Móvil) con Insignia Numérica en Vivo */}
      <TouchableOpacity
        onPress={() => {
          establecerAlertaAbiertaId(null);
          establecerModalAbrir(true);
        }}
        style={[
          estilos.bellBoton,
          esOscuro ? estilos.bellBotonOscuro : estilos.bellBotonClaro,
          noLeidoConteo > 0 && estilos.bellBotonConAlertas,
          style,
        ]}
        activeOpacity={0.75}
        accessibilityLabel={`Notificaciones, ${noLeidoConteo} no leídas`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={noLeidoConteo > 0 ? "notifications" : "notifications-outline"}
          size={21}
          color={noLeidoConteo > 0 && esOscuro ? "#fbbf24" : resueltoColor}
        />
        {noLeidoConteo > 0 && (
          <View style={[estilos.insignia, esOscuro && estilos.insigniaOscuro]}>
            <Text style={estilos.insigniaTexto}>
              {noLeidoConteo > 99 ? "99+" : noLeidoConteo}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Bandeja Central Filtrable de Notificaciones (Responsiva Web y Móvil) */}
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
              paddingTop: superiorInset + (esMovil ? 14 : 56),
              paddingBottom: Math.max(insets.bottom + 12, 16),
              paddingHorizontal: esMovil ? 10 : 16,
              alignItems: esMovil ? "center" : "flex-end",
            },
          ]}
          onPress={() => establecerModalAbrir(false)}
        >
          <View
            style={[
              estilos.modalTarjeta,
              {
                width: esMovil ? "100%" : 460,
                maxHeight: Math.min(height * 0.86, 680),
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* 1. Encabezado con contador de no leídas en vivo */}
            <View style={estilos.encabezado}>
              <View style={estilos.encabezadoIzquierda}>
                <View style={estilos.encabezadoIconoCaja}>
                  <Ionicons name="notifications" size={18} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text style={estilos.encabezadoTitulo}>Bandeja de Notificaciones</Text>
                  <Text style={estilos.encabezadoSub}>
                    Alertas operativas en tiempo real
                  </Text>
                </View>
              </View>

              <View style={estilos.encabezadoDerecha}>
                {noLeidoConteo > 0 ? (
                  <View style={estilos.contadorChip}>
                    <Text style={estilos.contadorTexto}>
                      {noLeidoConteo} {noLeidoConteo === 1 ? "no leída" : "no leídas"}
                    </Text>
                  </View>
                ) : (
                  <View style={[estilos.contadorChip, { backgroundColor: tema.colors.okLight }]}>
                    <Text style={[estilos.contadorTexto, { color: tema.colors.okDark }]}>
                      Al día ✓
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => establecerModalAbrir(false)}
                  style={estilos.cerrarBoton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Cerrar bandeja de notificaciones"
                >
                  <Ionicons name="close" size={20} color={tema.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Mini Dashboard KPI de la Bandeja */}
            <View style={estilos.kpiFranja}>
              <View
                style={[
                  estilos.kpiCaja,
                  noLeidoConteo > 0 && {
                    backgroundColor: tema.colors.dangerLight,
                    borderColor: tema.colors.danger,
                  },
                ]}
              >
                <Text
                  style={[
                    estilos.kpiValor,
                    noLeidoConteo > 0 && { color: tema.colors.danger },
                  ]}
                >
                  {metricas.noLeidas}
                </Text>
                <Text style={estilos.kpiLbl}>No leídas</Text>
              </View>

              <View style={estilos.kpiCaja}>
                <Text style={[estilos.kpiValor, { color: tema.colors.primaryDark }]}>
                  {metricas.solicitudesNoLeidas}
                </Text>
                <Text style={estilos.kpiLbl}>Solicitudes</Text>
              </View>

              <View style={estilos.kpiCaja}>
                <Text style={[estilos.kpiValor, { color: tema.colors.warnDark }]}>
                  {metricas.criticasNoLeidas}
                </Text>
                <Text style={estilos.kpiLbl}>Prioritarias</Text>
              </View>

              <View style={estilos.kpiCaja}>
                <Text style={estilos.kpiValor}>{metricas.total}</Text>
                <Text style={estilos.kpiLbl}>Total</Text>
              </View>
            </View>

            {/* 3. Barra de búsqueda y filtro por estado de lectura */}
            <View style={estilos.controlesCaja}>
              <View style={estilos.buscarCaja}>
                <Ionicons name="search-outline" size={16} color={tema.colors.textMuted} />
                <TextInput
                  value={busqueda}
                  onChangeText={establecerBusqueda}
                  placeholder="Buscar alerta, código SOL, SKU o proyecto..."
                  placeholderTextColor={tema.colors.textLight}
                  style={estilos.buscarInput}
                />
                {Boolean(busqueda) && (
                  <TouchableOpacity onPress={() => establecerBusqueda("")} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={estilos.estadoFila}>
                {(
                  [
                    { id: "todas", label: `Todas (${metricas.total})` },
                    { id: "no_leidas", label: `No leídas (${metricas.noLeidas})` },
                    { id: "leidas", label: `Leídas (${metricas.leidas})` },
                  ] as { id: FiltroLectura; label: string }[]
                ).map((est) => {
                  const activo = filtroLectura === est.id;
                  return (
                    <TouchableOpacity
                      key={est.id}
                      onPress={() => establecerFiltroLectura(est.id)}
                      style={[estilos.estadoPill, activo && estilos.estadoPillActivo]}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          estilos.estadoPillTexto,
                          activo && estilos.estadoPillTextoActivo,
                        ]}
                      >
                        {est.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Filtros horizontales por categoría con contador de no leídas */}
            <View style={estilos.filtrarBarra}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={estilos.filtrarScroll}
              >
                {categoriasFiltro.map((f) => {
                  const esActivo = seleccionadoTipo === f.id;
                  const pendientesCat = contarNoLeidasCategoria(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[estilos.filtrarChip, esActivo && estilos.filtrarChipActivo]}
                      onPress={() => establecerSeleccionadoTipo(f.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          estilos.filtrarChipTexto,
                          esActivo && estilos.filtrarChipTextoActivo,
                        ]}
                      >
                        {f.label}
                        {pendientesCat > 0 ? ` (${pendientesCat})` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 5. Panel de detalle de alerta abierta (confirmación visual de lectura) */}
            {alertaAbierta && (
              <View style={estilos.detallePanel}>
                <View style={estilos.detalleHeader}>
                  <View style={estilos.detalleBadges}>
                    <View
                      style={[
                        estilos.tipoMiniInsignia,
                        {
                          backgroundColor: obtenerTipoInsigniaConfiguracion(
                            alertaAbierta.type
                          ).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          estilos.tipoMiniInsigniaTexto,
                          {
                            color: obtenerTipoInsigniaConfiguracion(alertaAbierta.type).color,
                          },
                        ]}
                      >
                        {obtenerTipoInsigniaConfiguracion(alertaAbierta.type).label}
                      </Text>
                    </View>
                    <View style={estilos.leidaBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={tema.colors.okDark} />
                      <Text style={estilos.leidaBadgeTexto}>Marcada como leída</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => establecerAlertaAbiertaId(null)}
                    hitSlop={6}
                  >
                    <Ionicons name="chevron-up" size={18} color={tema.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={estilos.detalleTitulo}>{alertaAbierta.title}</Text>
                <Text style={estilos.detalleMensaje}>{alertaAbierta.message}</Text>

                <View style={estilos.detalleFooter}>
                  <Text style={estilos.detalleFecha}>Fecha: {alertaAbierta.date}</Text>
                  {alertaAbierta.relatedEntityType &&
                    alertaAbierta.relatedEntityId &&
                    onNavigateToObject && (
                      <TouchableOpacity
                        style={estilos.detalleIrBoton}
                        onPress={() => manejarIrAObjeto(alertaAbierta)}
                        activeOpacity={0.8}
                      >
                        <Text style={estilos.detalleIrTexto}>
                          {alertaAbierta.relatedEntityLabel || "Abrir módulo"}
                        </Text>
                        <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                </View>
              </View>
            )}

            {/* 6. Listado de Alertas */}
            <ScrollView style={estilos.lista} showsVerticalScrollIndicator={true}>
              {filtradoNotificaciones.length === 0 ? (
                <View style={estilos.vacioContenedor}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={34}
                    color={tema.colors.textMuted}
                  />
                  <Text style={estilos.vacioTitulo}>Sin alertas para este filtro</Text>
                  <Text style={estilos.vacioTexto}>
                    Prueba cambiando el filtro de lectura, categoría o término de búsqueda.
                  </Text>
                </View>
              ) : (
                filtradoNotificaciones.map((item) => {
                  const insigniaCfg = obtenerTipoInsigniaConfiguracion(item.type);
                  const esAbierta = alertaAbiertaId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        estilos.elementoFila,
                        !item.read && estilos.elementoFilaNoLeido,
                        esAbierta && estilos.elementoFilaAbierta,
                      ]}
                      onPress={() => manejarAbrirAlerta(item)}
                      activeOpacity={0.8}
                    >
                      {/* Indicador de no leída */}
                      <View style={estilos.noLeidoIndicatorCaja}>
                        {!item.read ? (
                          <View style={estilos.noLeidoPunto} />
                        ) : (
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color={tema.colors.textLight}
                          />
                        )}
                      </View>

                      {/* Ícono de categoría */}
                      <View
                        style={[estilos.elementoIconoCaja, { backgroundColor: insigniaCfg.bg }]}
                      >
                        <Ionicons name={insigniaCfg.icon} size={17} color={insigniaCfg.color} />
                      </View>

                      {/* Contenido de la alerta */}
                      <View style={estilos.elementoInfo}>
                        <View style={estilos.elementoSuperiorFila}>
                          <View style={estilos.tituloWithInsignia}>
                            <View
                              style={[
                                estilos.tipoMiniInsignia,
                                { backgroundColor: insigniaCfg.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  estilos.tipoMiniInsigniaTexto,
                                  { color: insigniaCfg.color },
                                ]}
                              >
                                {insigniaCfg.label}
                              </Text>
                            </View>
                            <Text style={estilos.elementoTiempo}>{item.date}</Text>
                          </View>
                          {!item.read && (
                            <Text style={estilos.etiquetaNueva}>NUEVA</Text>
                          )}
                        </View>

                        <Text
                          style={[
                            estilos.elementoTitulo,
                            !item.read && estilos.elementoTituloNoLeido,
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text style={estilos.elementoMensaje} numberOfLines={esAbierta ? 6 : 2}>
                          {item.message}
                        </Text>

                        {/* Acción directa al objeto relacionado */}
                        {item.relatedEntityType && item.relatedEntityId && onNavigateToObject && (
                          <TouchableOpacity
                            style={estilos.relatedEnlaceBoton}
                            onPress={() => manejarIrAObjeto(item)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="open-outline" size={13} color={tema.colors.primaryDark} />
                            <Text style={estilos.relatedEnlaceTexto}>
                              {item.relatedEntityLabel ||
                                `Ir a ${item.relatedEntityType}: ${item.relatedEntityId}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* 7. Pie de la bandeja */}
            <View style={estilos.pie}>
              {noLeidoConteo > 0 ? (
                <TouchableOpacity
                  onPress={manejarMarcarTodos}
                  style={estilos.marcarTodosBoton}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={16}
                    color={tema.colors.primaryDark}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={estilos.marcarTodosTexto}>
                    Marcar todas como leídas ({noLeidoConteo})
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={estilos.todosLeidoFila}>
                  <Ionicons name="checkmark-done-circle" size={16} color={tema.colors.okDark} />
                  <Text style={estilos.todosLeidoTexto}>
                    Todas las alertas han sido revisadas
                  </Text>
                </View>
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
    width: 40,
    height: 40,
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
  bellBotonConAlertas: {
    borderColor: "rgba(245, 158, 11, 0.55)",
  },
  insignia: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: tema.colors.danger,
    borderRadius: 10,
    minWidth: 19,
    height: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#ffffff",
    zIndex: 10,
  },
  insigniaOscuro: {
    borderColor: "#0f172a",
  },
  insigniaTexto: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-start",
  },
  modalTarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.xl,
    borderWidth: 1,
    borderColor: tema.colors.border,
    ...tema.shadows.lg,
    overflow: "hidden",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    gap: 8,
  },
  encabezadoIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  encabezadoIconoCaja: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: tema.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  encabezadoTitulo: {
    fontSize: 14,
    fontWeight: "800",
    color: tema.colors.text,
  },
  encabezadoSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  encabezadoDerecha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contadorChip: {
    backgroundColor: tema.colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tema.radius.full,
  },
  contadorTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.danger,
  },
  cerrarBoton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiFranja: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: tema.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  kpiCaja: {
    flex: 1,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  kpiValor: {
    fontSize: 15,
    fontWeight: "800",
    color: tema.colors.text,
  },
  kpiLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  controlesCaja: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  buscarCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingHorizontal: 10,
    minHeight: 38,
  },
  buscarInput: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.text,
    paddingVertical: 6,
  },
  estadoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  estadoPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  estadoPillActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  estadoPillTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
  },
  estadoPillTextoActivo: {
    color: tema.colors.primaryDark,
    fontWeight: "700",
  },
  filtrarBarra: {
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    paddingBottom: 8,
  },
  filtrarScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  filtrarChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  filtrarChipActivo: {
    backgroundColor: tema.colors.text,
    borderColor: tema.colors.text,
  },
  filtrarChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  filtrarChipTextoActivo: {
    color: "#ffffff",
    fontWeight: "700",
  },
  detallePanel: {
    backgroundColor: tema.colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.primaryBorder,
    padding: 12,
    gap: 6,
  },
  detalleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  detalleBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  leidaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tema.colors.okLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
  },
  leidaBadgeTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.okDark,
  },
  detalleTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  detalleMensaje: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    lineHeight: 17,
  },
  detalleFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  detalleFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  detalleIrBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.md,
  },
  detalleIrTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  lista: {
    maxHeight: 340,
  },
  vacioContenedor: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 6,
  },
  vacioTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.colors.text,
  },
  vacioTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    textAlign: "center",
  },
  elementoFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    backgroundColor: tema.colors.card,
  },
  elementoFilaNoLeido: {
    backgroundColor: "#fffbeb",
  },
  elementoFilaAbierta: {
    backgroundColor: tema.colors.surfaceAlt,
  },
  noLeidoIndicatorCaja: {
    width: 14,
    alignItems: "center",
    paddingTop: 10,
    marginRight: 4,
  },
  noLeidoPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tema.colors.primary,
  },
  elementoIconoCaja: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  elementoInfo: {
    flex: 1,
  },
  elementoSuperiorFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
    gap: 6,
  },
  tituloWithInsignia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tipoMiniInsignia: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tipoMiniInsigniaTexto: {
    fontSize: 10,
    fontWeight: "700",
  },
  elementoTiempo: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  etiquetaNueva: {
    fontSize: 9,
    fontWeight: "800",
    color: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  elementoTitulo: {
    fontSize: 12.5,
    fontWeight: "600",
    color: tema.colors.text,
  },
  elementoTituloNoLeido: {
    fontWeight: "800",
  },
  elementoMensaje: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  relatedEnlaceBoton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: tema.colors.primaryLight,
  },
  relatedEnlaceTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  pie: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
  },
  marcarTodosBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
  },
  marcarTodosTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  todosLeidoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  todosLeidoTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.okDark,
  },
});
