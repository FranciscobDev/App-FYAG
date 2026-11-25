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

  return (
    <>
      {/* =====================================================================
          3. BANDEJA DE APROBACIÓN Y SOLICITUDES DE MATERIALES
          ===================================================================== */}
      {activoPestana === "solicitudes" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* Guía visual del flujo SCRUM según el rol activo */}
          {rolActual === "admin" ? (
            <View style={estilos.scrumBandejaBanner}>
              <Insignia label="Guía" tone="info" size="sm" />
              <Text style={estilos.scrumBandejaTexto}>
                Bandeja de Aprobación: revisa las solicitudes pendientes, ingresa un motivo al rechazar o aprueba para emitir el comprobante numerado y notificar al bodeguero.
              </Text>
            </View>
          ) : rolActual === "warehouse" ? (
            <View style={estilos.scrumBandejaBanner}>
              <Insignia label="Guía" tone="info" size="sm" />
              <Text style={estilos.scrumBandejaTexto}>
                Solicitudes de Bodega: puedes editar o anular únicamente solicitudes en estado Pendiente; las Aprobadas, Rechazadas o Anuladas quedan en solo lectura.
              </Text>
            </View>
          ) : null}

          {/* Contadores rápidos interactivos por estado */}
          <View style={estilos.solicitudContadoresFila}>
            {(
              [
                { id: "pendiente", label: "Pendientes", count: conteos.pendiente, color: tema.colors.warnDark },
                { id: "aprobada", label: "Aprobadas", count: conteos.aprobada, color: tema.colors.okDark },
                { id: "rechazada", label: "Rechazadas", count: conteos.rechazada, color: tema.colors.danger },
                { id: "todas", label: "Totales", count: conteos.todas, color: tema.colors.text },
              ] as const
            ).map((kpi) => {
              const activa = solicitudPestana === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  onPress={() => establecerSolicitudPestana(kpi.id)}
                  style={[
                    estilos.solicitudContadorTarjeta,
                    activa && estilos.solicitudContadorTarjetaActiva,
                  ]}
                  activeOpacity={0.75}
                >
                  <Text style={[estilos.solicitudContadorValor, { color: kpi.color }]}>
                    {kpi.count}
                  </Text>
                  <Text style={estilos.solicitudContadorEtiqueta}>{kpi.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Barra de búsqueda por código, proyecto, solicitante o comprobante */}
          <CampoBusqueda
            value={solicitudBusqueda}
            onChangeText={establecerSolicitudBusqueda}
            placeholder="Buscar por código SOL, comprobante COMP, proyecto o solicitante..."
            containerStyle={{ marginBottom: 12 }}
          />

          <View style={estilos.solicitudSuperiorBarra}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: tema.colors.textSecondary }}>
                Filtrar por estado ({filtradoSolicitudes.length})
              </Text>
              <Boton
                title="+ Nueva Solicitud"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={manejarAbrirNuevoSolicitud}
                style={{ minHeight: 38 }}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: "100%" }}
              contentContainerStyle={{ gap: 6, paddingRight: 8 }}
            >
              {(["pendiente", "aprobada", "rechazada", "anulada", "todas"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => establecerSolicitudPestana(t)}
                  style={[
                    estilos.solicitudPestanaBoton,
                    solicitudPestana === t && estilos.solicitudPestanaBotonActivo,
                  ]}
                >
                  <Text
                    style={[
                      estilos.solicitudPestanaTexto,
                      solicitudPestana === t && estilos.solicitudPestanaTextoActivo,
                    ]}
                  >
                    {t.toUpperCase()} ({conteos[t]})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

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
              return (
              <Tarjeta key={req.id} variant="elevated" style={estilos.solicitudElementoTarjeta}>
                <View style={estilos.solicitudElementoSuperior}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <View style={estilos.solicitudEncabezadoFila}>
                      <Text style={estilos.solicitudCodigoTexto}>{req.code}</Text>
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
                    <Text style={estilos.solicitudProyectoNombre}>
                      {req.projectCode} • {req.projectName}
                    </Text>
                    <Text style={estilos.solicitudTecnicoInfo}>
                      Solicitante: {req.technicianName}
                      {req.requesterRole === "warehouse" ? " (Bodeguero)" : ""} •{" "}
                      {formatearFecha(req.date)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => establecerSeleccionadoTimelineSolicitud(req)}
                    style={estilos.timelineEnlaceBoton}
                  >
                    <Ionicons name="git-network-outline" size={16} color={tema.colors.primary} />
                    <Text style={estilos.timelineEnlaceTexto}>Línea de tiempo</Text>
                  </TouchableOpacity>
                </View>

                <View style={estilos.solicitudElementosCaja}>
                  <Text style={estilos.elementosCajaTitulo}>Ítems Solicitados:</Text>
                  {req.items.map((it, idx) => (
                    <View key={`${it.sku}_${idx}`} style={estilos.solicitudElementoResumenFila}>
                      <Text style={estilos.solicitudElementoFila}>
                        • {it.quantity} {it.unit} de {it.name}
                      </Text>
                      {it.deliveredQuantity !== undefined && it.deliveredQuantity > 0 && (
                        <Text style={estilos.entregadoResumenTexto}>
                          (Entregados: {it.deliveredQuantity} / {it.quantity})
                        </Text>
                      )}
                    </View>
                  ))}

                  {Boolean(req.comment) && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontStyle: "italic",
                        color: tema.colors.textMuted,
                        marginTop: 6,
                      }}
                    >
                      Observación: &ldquo;{req.comment}&rdquo;
                    </Text>
                  )}

                  {(req.status === "aprobada" || req.status === "entregada") && req.receiptNumber && (
                    <View style={estilos.aprobadaAviso}>
                      <Ionicons name="checkmark-circle" size={16} color={tema.colors.okDark} />
                      <Text style={estilos.aprobadaAvisoTexto}>
                        Comprobante N° {req.receiptNumber} emitido y notificado al bodeguero solicitante
                        {req.approvedBy ? ` (Aprobó: ${req.approvedBy})` : ""}.
                      </Text>
                    </View>
                  )}

                  {req.rejectionReason && (
                    <View style={estilos.rechazarAviso}>
                      <Text style={estilos.rechazarAvisoTitulo}>
                        Motivo de rechazo obligatorio
                        {req.rejectedBy ? ` (${req.rejectedBy})` : ""}:
                      </Text>
                      <Text style={estilos.rechazarAvisoTexto}>{req.rejectionReason}</Text>
                    </View>
                  )}

                  {req.status === "anulada" && (
                    <View style={estilos.anuladaAviso}>
                      <Ionicons name="ban-outline" size={16} color={tema.colors.textSecondary} />
                      <Text style={estilos.anuladaAvisoTexto}>
                        Solicitud anulada{req.cancelledBy ? ` por ${req.cancelledBy}` : ""}
                        {req.cancelledAt ? ` (${req.cancelledAt})` : ""}. No puede editarse ni enviarse a despacho.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botones de acción según rol y estado de la solicitud */}
                <View style={estilos.solicitudBotonesFila}>
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
                          { borderColor: tema.colors.danger, minHeight: 42 },
                          esMovil && { flex: 1 },
                        ]}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar y Ver Comprobante"
                        variant="success"
                        size="sm"
                        icon="checkmark-done-outline"
                        onPress={() => manejarAprobarSolicitud(req)}
                        style={[{ minHeight: 42 }, esMovil && { flex: 1.6 }]}
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
                      style={esMovil ? { flexGrow: 1 } : undefined}
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
