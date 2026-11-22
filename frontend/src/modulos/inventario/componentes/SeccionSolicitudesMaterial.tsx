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
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  VistaModal,
} from "@/componentes/comunes";
import { estilos } from "../estilos";
import {
  ComprobanteAprobacionSolicitud,
  construirComprobanteYNotificacionAprobacion,
  obtenerEstadoAccionesBodegueroSolicitud,
} from "../solicitudInsumosUtils";

export interface PropiedadesSeccionSolicitudesMaterial {
  activoPestana: any;
  aprobarSolicitudMaterial: any;
  cancelarSolicitudMaterial: any;
  establecerRechazarModalSolicitud: any;
  establecerRechazarMotivo: any;
  establecerSeleccionadoTimelineSolicitud: any;
  establecerSolicitudPestana: any;
  filtradoSolicitudes: any;
  manejarAbrirEditarSolicitud?: any;
  manejarAbrirNuevoSolicitud: any;
  modificarSolicitudMaterial: any;
  mostrarAviso: any;
  rolActual: any;
  solicitudPestana: any;
  usuario: any;
}

export const SeccionSolicitudesMaterial: React.FC<PropiedadesSeccionSolicitudesMaterial> = ({
  activoPestana,
  aprobarSolicitudMaterial,
  cancelarSolicitudMaterial,
  establecerRechazarModalSolicitud,
  establecerRechazarMotivo,
  establecerSeleccionadoTimelineSolicitud,
  establecerSolicitudPestana,
  filtradoSolicitudes,
  manejarAbrirEditarSolicitud,
  manejarAbrirNuevoSolicitud,
  modificarSolicitudMaterial,
  mostrarAviso,
  rolActual,
  solicitudPestana,
  usuario,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 480;
  const [comprobanteSeleccionado, establecerComprobanteSeleccionado] =
    React.useState<ComprobanteAprobacionSolicitud | null>(null);

  const abrirVistaComprobante = (req: any, comprobanteDirecto?: ComprobanteAprobacionSolicitud) => {
    if (comprobanteDirecto) {
      establecerComprobanteSeleccionado(comprobanteDirecto);
      return;
    }
    const comp = construirComprobanteYNotificacionAprobacion(
      req,
      usuario?.name || "Administrador",
      [],
      req.date
    );
    establecerComprobanteSeleccionado(comp);
  };

  return (
    <>
      {/* =====================================================================
          3. TAB SOLICITUDES
          ===================================================================== */}
      {activoPestana === "solicitudes" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
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
              {(["todas", "pendiente", "aprobada", "rechazada", "anulada"] as const).map((t: any) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => establecerSolicitudPestana(t)}
                  style={[estilos.solicitudPestanaBoton, solicitudPestana === t && estilos.solicitudPestanaBotonActivo]}
                >
                  <Text style={[estilos.solicitudPestanaTexto, solicitudPestana === t && estilos.solicitudPestanaTextoActivo]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filtradoSolicitudes.length === 0 ? (
            <EstadoVacio
              icon="document-text-outline"
              title="Sin solicitudes"
              description={
                solicitudPestana === "todas"
                  ? "No se registran solicitudes de materiales en el sistema."
                  : `No hay solicitudes con estado "${solicitudPestana}".`
              }
              actionTitle="Nueva Solicitud de Insumos"
              onAction={manejarAbrirNuevoSolicitud}
              containerStyle={{ marginVertical: 32 }}
            />
          ) : (
            filtradoSolicitudes.map((req: any) => (
              <Tarjeta key={req.id} variant="elevated" style={estilos.solicitudElementoTarjeta}>
                <View style={estilos.solicitudElementoSuperior}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <View style={estilos.solicitudEncabezadoFila}>
                      <Text style={estilos.solicitudCodigoTexto}>{req.code}</Text>
                      <Insignia
                        label={req.status.toUpperCase()}
                        tone={
                          req.status === "aprobada"
                            ? "ok"
                            : req.status === "rechazada"
                              ? "danger"
                              : req.status === "anulada"
                                ? "mute"
                                : "warn"
                        }
                        size="sm"
                      />
                      {req.receiptNumber && (
                        <TouchableOpacity
                          onPress={() => abrirVistaComprobante(req)}
                          activeOpacity={0.75}
                        >
                          <Insignia
                            label={`Comprobante N° ${req.receiptNumber}`}
                            tone="info"
                            size="sm"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={estilos.solicitudProyectoNombre}>{req.projectName}</Text>
                    <Text style={estilos.solicitudTecnicoInfo}>
                      Por: {req.technicianName} • {formatearFecha(req.date)}
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
                  {req.items.map((it: any, idx: any) => (
                    <View key={idx} style={estilos.solicitudElementoResumenFila}>
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
                  {req.rejectionReason && (
                    <View style={estilos.rechazarAviso}>
                      <Text style={estilos.rechazarAvisoTitulo}>Motivo de rechazo:</Text>
                      <Text style={estilos.rechazarAvisoTexto}>{req.rejectionReason}</Text>
                    </View>
                  )}
                </View>

                {/* Botones de acción según rol */}
                <View style={estilos.solicitudBotonesFila}>
                  {/* Admin aprueba o rechaza (con motivo obligatorio) */}
                  {req.status === "pendiente" && rolActual === "admin" && (
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
                        title="Aprobar y Generar Comprobante"
                        variant="success"
                        size="sm"
                        icon="checkmark-outline"
                        onPress={() => {
                          const resultado = aprobarSolicitudMaterial(req.id, usuario.name);
                          const numComp = resultado?.receiptNumber || req.receiptNumber || "";
                          mostrarAviso(
                            `Solicitud ${req.code} aprobada. Comprobante N° ${numComp} generado y notificado a ${req.technicianName}.`
                          );
                          abrirVistaComprobante(
                            { ...req, status: "aprobada", receiptNumber: numComp },
                            resultado?.comprobante
                          );
                        }}
                        style={[{ minHeight: 42 }, esMovil && { flex: 1.6 }]}
                      />
                    </>
                  )}

                  {/* Vista de comprobante numerado disponible para solicitudes aprobadas */}
                  {req.status === "aprobada" && req.receiptNumber && (
                    <Boton
                      title={`Ver Comprobante Numerado (${req.receiptNumber})`}
                      variant="outline"
                      size="sm"
                      icon="receipt-outline"
                      onPress={() => abrirVistaComprobante(req)}
                      style={esMovil ? { flexGrow: 1 } : undefined}
                    />
                  )}

                  {/* [FRONT-2] Bodeguero: acciones "Editar" y "Anular" en el listado de solicitudes,
                      activas únicamente cuando el estado es Pendiente y bloqueadas en Aprobada / Rechazada / Anulada */}
                  {rolActual === "warehouse" && (() => {
                    const estadoAcciones = obtenerEstadoAccionesBodegueroSolicitud(req.status);
                    return (
                      <View style={{ width: "100%" }}>
                        <View style={[estilos.solicitudBotonesFila, { marginTop: 4 }]}>
                          <Boton
                            title="Editar"
                            variant="secondary"
                            size="sm"
                            icon="create-outline"
                            disabled={!estadoAcciones.puedeEditar}
                            onPress={() => {
                              if (!estadoAcciones.puedeEditar) return;
                              if (manejarAbrirEditarSolicitud) {
                                manejarAbrirEditarSolicitud(req);
                              } else {
                                const updated = req.items.map((i: any) => ({
                                  ...i,
                                  quantity: Math.max(1, i.quantity - 1),
                                }));
                                modificarSolicitudMaterial(req.id, updated);
                                mostrarAviso(`Cantidades de solicitud ${req.code} modificadas.`);
                              }
                            }}
                            style={esMovil ? { flexGrow: 1 } : undefined}
                          />
                          <Boton
                            title="Anular"
                            variant="danger"
                            size="sm"
                            icon="trash-outline"
                            disabled={!estadoAcciones.puedeAnular}
                            onPress={() => {
                              if (!estadoAcciones.puedeAnular) return;
                              const res = cancelarSolicitudMaterial(req.id, usuario?.name);
                              if (res && res.success === false) {
                                mostrarAviso(res.error || "No se pudo anular la solicitud.");
                              } else {
                                mostrarAviso(
                                  `Solicitud ${req.code} anulada. El stock comprometido regresó a disponible en H6.`
                                );
                              }
                            }}
                            style={esMovil ? { flexGrow: 1 } : undefined}
                          />
                        </View>
                        {!estadoAcciones.puedeEditar && estadoAcciones.motivoBloqueo && (
                          <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginTop: 6 }}>
                            🔒 {estadoAcciones.motivoBloqueo}
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </Tarjeta>
            ))
          )}

          {/* MODAL DE VISTA DE COMPROBANTE NUMERADO AL APROBAR ([FRONT-1]) */}
          <VistaModal
            visible={Boolean(comprobanteSeleccionado)}
            onClose={() => establecerComprobanteSeleccionado(null)}
            title={
              comprobanteSeleccionado
                ? `Comprobante de Autorización N° ${comprobanteSeleccionado.receiptNumber}`
                : "Comprobante de Autorización"
            }
            subtitle="Documento oficial de aprobación de solicitud de insumos para retiro/egreso en bodega"
          >
            {comprobanteSeleccionado && (
              <View style={{ gap: 10 }}>
                <View
                  style={{
                    backgroundColor: "#ECFDF5",
                    borderColor: "#10B981",
                    borderWidth: 1,
                    borderRadius: tema.radius.md,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "bold", color: "#065F46" }}>
                      N° {comprobanteSeleccionado.receiptNumber}
                    </Text>
                    <Insignia label="APROBADA" tone="ok" size="sm" />
                  </View>
                  <Text style={{ fontSize: 12, color: "#047857", marginTop: 4 }}>
                    Solicitud: {comprobanteSeleccionado.requestCode} • Fecha de aprobación:{" "}
                    {formatearFecha(comprobanteSeleccionado.approvedAt)}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: tema.colors.surfaceAlt,
                    borderRadius: tema.radius.md,
                    padding: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: tema.colors.text }}>
                    <Text style={{ fontWeight: "bold" }}>Proyecto Destino:</Text>{" "}
                    {comprobanteSeleccionado.projectCode} - {comprobanteSeleccionado.projectName}
                  </Text>
                  <Text style={{ fontSize: 12, color: tema.colors.text }}>
                    <Text style={{ fontWeight: "bold" }}>Solicitante Notificado:</Text>{" "}
                    {comprobanteSeleccionado.requesterName} ({comprobanteSeleccionado.requesterRut})
                  </Text>
                  <Text style={{ fontSize: 12, color: tema.colors.text }}>
                    <Text style={{ fontWeight: "bold" }}>Autorizado por Administrador:</Text>{" "}
                    {comprobanteSeleccionado.approvedBy}
                  </Text>
                </View>

                <View
                  style={{
                    borderWidth: 1,
                    borderColor: tema.colors.border,
                    borderRadius: tema.radius.md,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: tema.colors.text, marginBottom: 6 }}>
                    Insumos Autorizados ({comprobanteSeleccionado.totalItemsCount} ítem(s) /{" "}
                    {comprobanteSeleccionado.totalUnitsCount} un totales):
                  </Text>
                  {comprobanteSeleccionado.items.map((it, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                        borderTopWidth: idx > 0 ? 1 : 0,
                        borderTopColor: tema.colors.borderLight,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: tema.colors.text, flex: 1 }}>
                        {it.sku} • {it.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "bold", color: tema.colors.primaryDark }}>
                        {it.quantity} {it.unit}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: tema.colors.primaryLight,
                    borderRadius: tema.radius.sm,
                    padding: 10,
                  }}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={tema.colors.primaryDark}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 11, color: tema.colors.primaryDark, flex: 1 }}>
                    Notificación enviada a {comprobanteSeleccionado.notificationToRequester.recipientName}:{" "}
                    {comprobanteSeleccionado.notificationToRequester.title}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                  <Boton
                    title="Cerrar Vista de Comprobante"
                    variant="primary"
                    size="sm"
                    onPress={() => establecerComprobanteSeleccionado(null)}
                  />
                </View>
              </View>
            )}
          </VistaModal>
        </ScrollView>
      )}
    </>
  );
};
