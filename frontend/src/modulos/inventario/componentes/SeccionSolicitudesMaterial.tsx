import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Rol, SolicitudMaterial, Usuario } from "@/nucleo/tipos";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  CampoBusqueda,
} from "@/componentes/comunes";
import { estilos } from "../estilos";
import { obtenerEstadoAccionesBodegueroSolicitud } from "../solicitudInsumosUtils";

export type FiltroPestanaSolicitud =
  | "todas"
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "anulada";

export interface PropiedadesSeccionSolicitudesMaterial {
  activoPestana: string;
  aprobarSolicitudMaterial: (
    id: string,
    authorName: string
  ) => {
    success: boolean;
    receiptNumber?: string;
    solicitud?: SolicitudMaterial;
    error?: string;
  };
  establecerAnularConfirmarSolicitud: React.Dispatch<
    React.SetStateAction<SolicitudMaterial | null>
  >;
  establecerRechazarModalSolicitud: React.Dispatch<React.SetStateAction<SolicitudMaterial | null>>;
  establecerRechazarMotivo: React.Dispatch<React.SetStateAction<string>>;
  establecerSeleccionadoComprobanteSolicitud: React.Dispatch<
    React.SetStateAction<SolicitudMaterial | null>
  >;
  establecerSeleccionadoTimelineSolicitud: React.Dispatch<
    React.SetStateAction<SolicitudMaterial | null>
  >;
  establecerSolicitudBusqueda: React.Dispatch<React.SetStateAction<string>>;
  establecerSolicitudPestana: React.Dispatch<React.SetStateAction<FiltroPestanaSolicitud>>;
  filtradoSolicitudes: SolicitudMaterial[];
  manejarAbrirEditarSolicitud: (req: SolicitudMaterial) => void;
  manejarAbrirNuevoSolicitud: () => void;
  mostrarAviso: (mensaje: string) => void;
  rolActual: Rol;
  solicitudBusqueda: string;
  solicitudPestana: FiltroPestanaSolicitud;
  todasSolicitudes: SolicitudMaterial[];
  usuario: Usuario;
}

export const SeccionSolicitudesMaterial: React.FC<PropiedadesSeccionSolicitudesMaterial> = ({
  activoPestana,
  aprobarSolicitudMaterial,
  establecerAnularConfirmarSolicitud,
  establecerRechazarModalSolicitud,
  establecerRechazarMotivo,
  establecerSeleccionadoComprobanteSolicitud,
  establecerSeleccionadoTimelineSolicitud,
  establecerSolicitudBusqueda,
  establecerSolicitudPestana,
  filtradoSolicitudes,
  manejarAbrirEditarSolicitud,
  manejarAbrirNuevoSolicitud,
  mostrarAviso,
  rolActual,
  solicitudBusqueda,
  solicitudPestana,
  todasSolicitudes,
  usuario,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 480;

  const conteos = {
    todas: todasSolicitudes.length,
    pendiente: todasSolicitudes.filter((r) => r.status === "pendiente").length,
    aprobada: todasSolicitudes.filter((r) => r.status === "aprobada").length,
    rechazada: todasSolicitudes.filter((r) => r.status === "rechazada").length,
    anulada: todasSolicitudes.filter((r) => r.status === "anulada").length,
  };

  const manejarAprobarSolicitud = (req: SolicitudMaterial) => {
    const resultado = aprobarSolicitudMaterial(req.id, usuario.name);
    if (!resultado.success) {
      mostrarAviso(resultado.error || "No fue posible aprobar la solicitud.");
      return;
    }
    if (resultado.solicitud) {
      establecerSeleccionadoComprobanteSolicitud(resultado.solicitud);
    }
    mostrarAviso(
      `Solicitud ${req.code} aprobada (${resultado.receiptNumber}). Resultado notificado al bodeguero solicitante.`
    );
  };

  const obtenerEstiloSemaforoSolicitud = (
    status: SolicitudMaterial["status"],
    urgency: SolicitudMaterial["urgency"]
  ) => {
    if (status === "aprobada" || status === "entregada") {
      return {
        fondoTarjeta: "#f0fdf4",
        bordeTarjeta: "#86efac",
        franjaLateral: "#16a34a",
        divisorColor: "#bbf7d0",
      };
    }
    if (status === "rechazada") {
      return {
        fondoTarjeta: "#fef2f2",
        bordeTarjeta: "#fca5a5",
        franjaLateral: "#dc2626",
        divisorColor: "#fecaca",
      };
    }
    if (status === "anulada") {
      return {
        fondoTarjeta: "#f1f5f9",
        bordeTarjeta: "#cbd5e1",
        franjaLateral: "#64748b",
        divisorColor: "#e2e8f0",
      };
    }
    // Pendiente (con franja roja si es urgente)
    return {
      fondoTarjeta: "#fffbeb",
      bordeTarjeta: urgency === "urgente" ? "#fca5a5" : "#fcd34d",
      franjaLateral: urgency === "urgente" ? "#dc2626" : "#d97706",
      divisorColor: "#fde68a",
    };
  };

  return (
    <>
      {/* =====================================================================
          3. BANDEJA DE APROBACIÓN Y SOLICITUDES DE MATERIALES
          ===================================================================== */}
      {activoPestana === "solicitudes" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* 1. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS (FILTRAN CON 1 TOQUE, SIN DUPLICAR CHIPS) */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {(
              [
                {
                  id: "pendiente" as const,
                  titulo: "Pendientes",
                  valor: conteos.pendiente,
                  sub: "Por revisar",
                  icon: "time-outline" as const,
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  borderActivo: "#d97706",
                  textColor: "#92400e",
                },
                {
                  id: "aprobada" as const,
                  titulo: "Aprobadas",
                  valor: conteos.aprobada,
                  sub: "Con comprobante",
                  icon: "checkmark-done-circle-outline" as const,
                  bg: "#f0fdf4",
                  border: "#86efac",
                  borderActivo: "#16a34a",
                  textColor: "#166534",
                },
                {
                  id: "rechazada" as const,
                  titulo: "Rechazadas",
                  valor: conteos.rechazada,
                  sub: "Con motivo",
                  icon: "close-circle-outline" as const,
                  bg: "#fef2f2",
                  border: "#fca5a5",
                  borderActivo: "#dc2626",
                  textColor: "#991b1b",
                },
                {
                  id: "todas" as const,
                  titulo: "Todas",
                  valor: conteos.todas,
                  sub: conteos.anulada > 0 ? `${conteos.anulada} anulada(s)` : "Historial total",
                  icon: "layers-outline" as const,
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  borderActivo: "#334155",
                  textColor: "#0f172a",
                },
              ]
            ).map((kpi) => {
              const activa = solicitudPestana === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  onPress={() => establecerSolicitudPestana(kpi.id)}
                  activeOpacity={0.8}
                  style={{
                    flexBasis: "48%",
                    flexGrow: 1,
                    minWidth: 140,
                    backgroundColor: kpi.bg,
                    borderWidth: activa ? 2 : 1,
                    borderColor: activa ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 5,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                      {kpi.valor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activa ? "800" : "600",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {activa ? "● Vista activa" : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 2. BARRA COMPACTA: BUSCADOR + BOTÓN NUEVA SOLICITUD (SIN DOBLE SIGNO +) */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 220 }}>
              <CampoBusqueda
                value={solicitudBusqueda}
                onChangeText={establecerSolicitudBusqueda}
                placeholder="Buscar por código SOL, comprobante, proyecto o solicitante..."
              />
            </View>
            <Boton
              title="Nueva Solicitud"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={manejarAbrirNuevoSolicitud}
              style={[{ minHeight: 42 }, esMovil && { width: "100%" }]}
            />
          </View>

          {/* Chip discreto solo si existen solicitudes anuladas o si está activo el filtro anulada */}
          {(conteos.anulada > 0 || solicitudPestana === "anulada") && (
            <View style={{ flexDirection: "row", marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  establecerSolicitudPestana(
                    solicitudPestana === "anulada" ? "pendiente" : "anulada"
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor:
                    solicitudPestana === "anulada" ? "#0f172a" : tema.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: tema.colors.borderDark,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
              >
                <Ionicons
                  name="ban-outline"
                  size={13}
                  color={solicitudPestana === "anulada" ? "#fde68a" : tema.colors.textSecondary}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: solicitudPestana === "anulada" ? "#fde68a" : tema.colors.textSecondary,
                  }}
                >
                  {solicitudPestana === "anulada"
                    ? `Viendo Anuladas (${conteos.anulada}) • Toca para volver`
                    : `Ver Solicitudes Anuladas (${conteos.anulada})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {filtradoSolicitudes.length === 0 ? (
            <EstadoVacio
              icon="document-text-outline"
              title="Sin solicitudes en esta vista"
              description={
                solicitudBusqueda.trim()
                  ? `No se encontraron resultados para "${solicitudBusqueda.trim()}".`
                  : solicitudPestana === "pendiente"
                    ? "No hay solicitudes pendientes de aprobación en este momento."
                    : `No hay solicitudes con estado "${solicitudPestana}".`
              }
              actionTitle={
                solicitudPestana !== "todas"
                  ? "Ver Todas"
                  : rolActual !== "admin"
                    ? "Nueva Solicitud"
                    : undefined
              }
              onAction={
                solicitudPestana !== "todas"
                  ? () => {
                    establecerSolicitudPestana("todas");
                    establecerSolicitudBusqueda("");
                  }
                  : rolActual !== "admin"
                    ? manejarAbrirNuevoSolicitud
                    : undefined
              }
              containerStyle={{ marginVertical: 32 }}
            />
          ) : (
            filtradoSolicitudes.map((req) => {
              const esPendiente = req.status === "pendiente";
              const semaforo = obtenerEstiloSemaforoSolicitud(req.status, req.urgency);

              return (
                <Tarjeta
                  key={req.id}
                  variant="outlined"
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    backgroundColor: semaforo.fondoTarjeta,
                    borderColor: semaforo.bordeTarjeta,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.franjaLateral,
                    borderRadius: 12,
                  }}
                >
                  <View style={estilos.solicitudElementoSuperior}>
                    <View style={{ flex: 1, minWidth: 180 }}>
                      <View style={estilos.solicitudEncabezadoFila}>
                        <Text style={[estilos.solicitudCodigoTexto, { fontSize: 15, fontWeight: "800" }]}>
                          {req.code}
                        </Text>
                        <Insignia
                          label={req.status.toUpperCase()}
                          tone={
                            req.status === "aprobada" || req.status === "entregada"
                              ? "ok"
                              : req.status === "rechazada"
                                ? "danger"
                                : req.status === "anulada"
                                  ? "mute"
                                  : "warn"
                          }
                          size="sm"
                        />
                        <Insignia
                          label={req.urgency.toUpperCase()}
                          tone={
                            req.urgency === "urgente"
                              ? "danger"
                              : req.urgency === "alta"
                                ? "warn"
                                : "info"
                          }
                          size="sm"
                        />
                        {req.receiptNumber && (
                          <TouchableOpacity
                            onPress={() => establecerSeleccionadoComprobanteSolicitud(req)}
                            activeOpacity={0.75}
                          >
                            <Insignia
                              label={`N° ${req.receiptNumber}`}
                              tone="primary"
                              size="sm"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[estilos.solicitudProyectoNombre, { marginTop: 3 }]}>
                        {req.projectCode} • {req.projectName}
                      </Text>
                      <Text style={estilos.solicitudTecnicoInfo}>
                        👤 {req.technicianName}
                        {req.requesterRole === "warehouse" ? " (Bodeguero)" : ""} • 📅{" "}
                        {formatearFecha(req.date)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => establecerSeleccionadoTimelineSolicitud(req)}
                      style={[
                        estilos.timelineEnlaceBoton,
                        {
                          backgroundColor: "#ffffff",
                          borderWidth: 1,
                          borderColor: semaforo.bordeTarjeta,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        },
                      ]}
                    >
                      <Ionicons name="git-network-outline" size={14} color={tema.colors.primaryDark} />
                      <Text style={[estilos.timelineEnlaceTexto, { color: tema.colors.primaryDark }]}>
                        Flujo
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Ítems solicitados en chips compactos sobre fondo blanco limpio */}
                  <View
                    style={{
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: semaforo.divisorColor,
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 8,
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: tema.colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      Ítems Solicitados ({req.items.length}):
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {req.items.map((it, idx) => (
                        <View
                          key={`${it.sku}_${idx}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: tema.colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: tema.colors.border,
                            borderRadius: 7,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            gap: 6,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: tema.colors.primaryLight,
                              borderWidth: 1,
                              borderColor: tema.colors.primaryBorder,
                              borderRadius: 5,
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: tema.colors.primaryDark,
                              }}
                            >
                              {it.quantity} {it.unit}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: tema.colors.text,
                              flexShrink: 1,
                            }}
                          >
                            {it.name}
                          </Text>
                          {it.deliveredQuantity !== undefined && it.deliveredQuantity > 0 && (
                            <Text style={{ fontSize: 10, fontWeight: "700", color: tema.colors.okDark }}>
                              ({it.deliveredQuantity}/{it.quantity} entreg.)
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>

                    {Boolean(req.comment) && (
                      <Text
                        style={{
                          fontSize: 11,
                          fontStyle: "italic",
                          color: tema.colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        💬 &ldquo;{req.comment}&rdquo;
                      </Text>
                    )}

                    {(req.status === "aprobada" || req.status === "entregada") && req.receiptNumber && (
                      <View style={[estilos.aprobadaAviso, { marginTop: 4 }]}>
                        <Ionicons name="checkmark-circle" size={16} color={tema.colors.okDark} />
                        <Text style={estilos.aprobadaAvisoTexto}>
                          Comprobante N° {req.receiptNumber} emitido y notificado al bodeguero solicitante
                          {req.approvedBy ? ` (Aprobó: ${req.approvedBy})` : ""}.
                        </Text>
                      </View>
                    )}

                    {req.rejectionReason && (
                      <View style={[estilos.rechazarAviso, { marginTop: 4 }]}>
                        <Text style={estilos.rechazarAvisoTitulo}>
                          Motivo de rechazo obligatorio
                          {req.rejectedBy ? ` (${req.rejectedBy})` : ""}:
                        </Text>
                        <Text style={estilos.rechazarAvisoTexto}>{req.rejectionReason}</Text>
                      </View>
                    )}

                    {req.status === "anulada" && (
                      <View style={[estilos.anuladaAviso, { marginTop: 4 }]}>
                        <Ionicons name="ban-outline" size={16} color={tema.colors.textSecondary} />
                        <Text style={estilos.anuladaAvisoTexto}>
                          Solicitud anulada{req.cancelledBy ? ` por ${req.cancelledBy}` : ""}
                          {req.cancelledAt ? ` (${req.cancelledAt})` : ""}. No puede editarse ni enviarse a despacho.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Botones de acción según rol y estado de la solicitud */}
                  <View style={[estilos.solicitudBotonesFila, { marginTop: 10 }]}>
                    {esPendiente && rolActual === "admin" && (
                      <>
                        <Boton
                          title="Rechazar"
                          variant="outline"
                          size="sm"
                          icon="close-outline"
                          onPress={() => {
                            establecerRechazarModalSolicitud(req);
                            establecerRechazarMotivo("");
                          }}
                          style={[
                            { borderColor: tema.colors.danger, minHeight: 38, backgroundColor: "#ffffff" },
                            esMovil && { flex: 1 },
                          ]}
                          textStyle={{ color: tema.colors.danger }}
                        />
                        <Boton
                          title="Aprobar y Comprobante"
                          variant="success"
                          size="sm"
                          icon="checkmark-done-outline"
                          onPress={() => manejarAprobarSolicitud(req)}
                          style={[{ minHeight: 38 }, esMovil && { flex: 1.5 }]}
                        />
                      </>
                    )}

                    {(req.status === "aprobada" || req.status === "entregada") && req.receiptNumber && (
                      <Boton
                        title={`Ver Comprobante (${req.receiptNumber})`}
                        variant="outline"
                        size="sm"
                        icon="receipt-outline"
                        onPress={() => establecerSeleccionadoComprobanteSolicitud(req)}
                        style={[{ backgroundColor: "#ffffff", minHeight: 36 }, esMovil ? { flexGrow: 1 } : undefined]}
                      />
                    )}

                    {/* Bodeguero: acciones Editar y Anular activas únicamente cuando el estado es Pendiente */}
                    {rolActual === "warehouse" && (() => {
                      const estadoAcciones = obtenerEstadoAccionesBodegueroSolicitud(req.status);
                      return (
                        <>
                          {!estadoAcciones.puedeEditar && (
                            <View style={estilos.bloqueadoAccionAviso}>
                              <Ionicons
                                name="lock-closed-outline"
                                size={13}
                                color={tema.colors.textMuted}
                              />
                              <Text style={estilos.bloqueadoAccionTexto}>
                                {estadoAcciones.motivoBloqueo || `Acciones bloqueadas (${req.status})`}
                              </Text>
                            </View>
                          )}
                          <Boton
                            title="Editar"
                            variant="secondary"
                            size="sm"
                            icon={estadoAcciones.puedeEditar ? "create-outline" : "lock-closed-outline"}
                            disabled={!estadoAcciones.puedeEditar}
                            accessibilityHint={
                              estadoAcciones.puedeEditar
                                ? "Editar proyecto, insumos o cantidades de esta solicitud pendiente"
                                : "Bloqueado: solo se pueden editar solicitudes en estado Pendiente"
                            }
                            onPress={() => manejarAbrirEditarSolicitud(req)}
                            style={esMovil ? { flexGrow: 1 } : undefined}
                          />
                          <Boton
                            title="Anular"
                            variant={estadoAcciones.puedeAnular ? "danger" : "outline"}
                            size="sm"
                            icon={estadoAcciones.puedeAnular ? "ban-outline" : "lock-closed-outline"}
                            disabled={!estadoAcciones.puedeAnular}
                            accessibilityHint={
                              estadoAcciones.puedeAnular
                                ? "Anular esta solicitud pendiente"
                                : "Bloqueado: solo se pueden anular solicitudes en estado Pendiente"
                            }
                            onPress={() => establecerAnularConfirmarSolicitud(req)}
                            style={[
                              !estadoAcciones.puedeAnular && { borderColor: tema.colors.borderDark },
                              esMovil && { flexGrow: 1 },
                            ]}
                            textStyle={
                              !estadoAcciones.puedeAnular ? { color: tema.colors.textMuted } : undefined
                            }
                          />
                        </>
                      );
                    })()}
                  </View>
                </Tarjeta>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );
};
