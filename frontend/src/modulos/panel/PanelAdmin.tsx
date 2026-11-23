import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { TarjetaKpi } from "@/componentes/datos/TarjetaKpi";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { InsigniaSemaforo } from "@/componentes/base/InsigniaSemaforo";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import {
  NotificacionFlotante,
  TipoNotificacionFlotante,
} from "@/componentes/retroalimentacion/NotificacionFlotante";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { ModalComprobanteSolicitud, ModalRechazoSolicitud } from "@/modulos/inventario/componentes";
import { SolicitudMaterial } from "@/nucleo/tipos";

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const PanelAdmin: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const {
    proyectos,
    productos,
    ordenesCompra,
    solicitudesMaterial,
    alertas,
    aprobarSolicitudMaterial,
    rechazarSolicitudMaterial,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  // Indicadores clave
  const pendienteSolicitudes = solicitudesMaterial.filter((r) => r.status === "pendiente");
  const lowExistenciaProductos = productos.filter((p) => p.stock <= p.minStock && !p.disabled);
  const abrirOrdenes = ordenesCompra.filter(
    (o) => o.status === "borrador" || o.status === "enviada" || o.status === "recibida_parcial"
  );
  const redProyectos = proyectos.filter(
    (p) => p.status === "activo" && p.budget > 0 && p.costReal / p.budget > 1.0
  );

  // Estado de modales de rechazo y comprobante numerado
  const [seleccionadoSolicitudRechazar, establecerSeleccionadoSolicitudRechazar] = useState<SolicitudMaterial | null>(null);
  const [comprobanteSolicitud, establecerComprobanteSolicitud] = useState<SolicitudMaterial | null>(null);

  // Estado de notificación flotante
  const [avisoVisible, establecerAvisoVisible] = useState(false);
  const [avisoMensaje, establecerAvisoMensaje] = useState("");
  const [avisoTipo, establecerAvisoTipo] = useState<TipoNotificacionFlotante>("ok");

  const mostrarAviso = (msg: string, type: TipoNotificacionFlotante = "ok") => {
    establecerAvisoMensaje(msg);
    establecerAvisoTipo(type);
    establecerAvisoVisible(true);
  };

  const manejarAbrirRechazar = (req: SolicitudMaterial) => {
    establecerSeleccionadoSolicitudRechazar(req);
  };

  const manejarAprobarSolicitud = (req: SolicitudMaterial) => {
    const resultado = aprobarSolicitudMaterial(req.id, usuario.name);
    if (!resultado.success) {
      mostrarAviso(resultado.error || "No fue posible aprobar la solicitud.", "danger");
      return;
    }
    if (resultado.solicitud) {
      establecerComprobanteSolicitud(resultado.solicitud);
    }
    mostrarAviso(
      `Solicitud ${req.code} aprobada (${resultado.receiptNumber}). Resultado notificado al bodeguero solicitante.`,
      "ok"
    );
  };

  return (
    <ContenedorEstadoPantalla
      screenTitle="Dashboard General"
      skeletonType="kpis"
      emptyProps={{
        title: "No hay actividad reciente en el Dashboard",
        description:
          "No se registran solicitudes pendientes, proyectos activos ni alertas en el sistema.",
        actionTitle: "Ver Inventario",
        onAction: () => onNavigate && onNavigate("inventario"),
      }}
      errorProps={{
        title: "Error al cargar métricas del Dashboard",
        message: "No fue posible sincronizar los indicadores de gestión con la base de datos.",
      }}
      forbiddenProps={{
        title: "Acceso Restringido al Dashboard Administrativo",
        message:
          "Solo usuarios con rol Administrador tienen autorización para consultar métricas financieras y aprobar solicitudes.",
      }}
    >
      <View style={estilos.contenedor}>
        <EncabezadoPagina
          title="Dashboard General"
          subtitle="Resumen ejecutivo de aprobaciones, stock crítico y control de obras"
        />

        <ScrollView style={estilos.scrollArea} contentContainerStyle={estilos.contenido}>
          {/* 1. GRILLA 2x2 SIMÉTRICA DE INDICADORES CLAVE */}
          <View style={estilos.kpiGrilla}>
            <View style={estilos.kpiCelda}>
              <TarjetaKpi
                label="Por Aprobar"
                value={pendienteSolicitudes.length}
                subtitle="Solicitudes faena"
                tone={pendienteSolicitudes.length > 0 ? "warn" : "ok"}
                icon="clipboard-outline"
                onPress={() => onNavigate && onNavigate("solicitudes")}
              />
            </View>
            <View style={estilos.kpiCelda}>
              <TarjetaKpi
                label="Stock Crítico"
                value={lowExistenciaProductos.length}
                subtitle="Bajo mínimo"
                tone={lowExistenciaProductos.length > 0 ? "danger" : "ok"}
                icon="warning-outline"
                onPress={() => onNavigate && onNavigate("inventario")}
              />
            </View>
            <View style={estilos.kpiCelda}>
              <TarjetaKpi
                label="Órdenes Compra"
                value={abrirOrdenes.length}
                subtitle="Abiertas / curso"
                tone="info"
                icon="cart-outline"
                onPress={() => onNavigate && onNavigate("compras")}
              />
            </View>
            <View style={estilos.kpiCelda}>
              <TarjetaKpi
                label="Obras en Rojo"
                value={redProyectos.length}
                subtitle="Sobregiro > 100%"
                tone={redProyectos.length > 0 ? "danger" : "ok"}
                icon="trending-down-outline"
                onPress={() => onNavigate && onNavigate("proyectos")}
              />
            </View>
          </View>

          {/* 2. SOLICITUDES PENDIENTES DE APROBACIÓN (LO ACCIONABLE PRIMERO, COMPACTO) */}
          <Tarjeta variant="elevated" style={estilos.bloqueTarjeta}>
            <View style={estilos.seccionEncabezado}>
              <View style={estilos.tituloWithIcono}>
                <View style={[estilos.iconoSeccionCaja, { backgroundColor: "#fffbeb" }]}>
                  <Ionicons name="clipboard-outline" size={16} color={tema.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={estilos.seccionTitulo}>
                    Solicitudes por Aprobar ({pendienteSolicitudes.length})
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onNavigate && onNavigate("solicitudes")}
                style={estilos.enlaceBoton}
              >
                <Text style={estilos.enlaceTexto}>Ver todas</Text>
                <Ionicons name="chevron-forward" size={14} color={tema.colors.primary} />
              </TouchableOpacity>
            </View>

            {pendienteSolicitudes.length === 0 ? (
              <EstadoVacio
                icon="checkmark-circle-outline"
                title="¡Todo al día!"
                description="No hay solicitudes pendientes de aprobación."
                containerStyle={{ borderWidth: 0, paddingVertical: 16 }}
              />
            ) : (
              pendienteSolicitudes.slice(0, 3).map((req, idx) => (
                <View
                  key={req.id}
                  style={[
                    estilos.solicitudCompactaItem,
                    idx === Math.min(pendienteSolicitudes.length, 3) - 1 && {
                      marginBottom: 0,
                    },
                  ]}
                >
                  <View style={estilos.solicitudCompactaTop}>
                    <View style={estilos.solicitudCodigoFila}>
                      <Text style={estilos.solicitudCodigo}>{req.code}</Text>
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
                    </View>
                    <Text style={estilos.solicitudFecha}>{formatearFecha(req.date)}</Text>
                  </View>

                  <Text numberOfLines={1} style={estilos.solicitudProyecto}>
                    {req.projectName}
                  </Text>
                  <Text numberOfLines={1} style={estilos.solicitudTecnico}>
                    Solicita: {req.technicianName} •{" "}
                    {req.items.map((it) => `${it.quantity} ${it.unit} ${it.name}`).join(", ")}
                  </Text>

                  <View style={estilos.solicitudAccionFila}>
                    <Boton
                      title="Rechazar"
                      variant="outline"
                      size="sm"
                      icon="close-outline"
                      onPress={() => manejarAbrirRechazar(req)}
                      style={{ flex: 1, minHeight: 36, borderColor: tema.colors.danger }}
                      textStyle={{ color: tema.colors.danger }}
                    />
                    <Boton
                      title="Aprobar y Ver Comprobante"
                      variant="success"
                      size="sm"
                      icon="checkmark-outline"
                      style={{ flex: 1.3, minHeight: 36 }}
                      onPress={() => manejarAprobarSolicitud(req)}
                    />
                  </View>
                </View>
              ))
            )}
          </Tarjeta>

          {/* 3. SEMÁFORO EJECUTIVO DE OBRAS (RESUMIDO Y ESCANEABLE) */}
          <Tarjeta variant="elevated" style={estilos.bloqueTarjeta}>
            <View style={estilos.seccionEncabezado}>
              <View style={estilos.tituloWithIcono}>
                <View style={[estilos.iconoSeccionCaja, { backgroundColor: "#eff6ff" }]}>
                  <Ionicons name="business-outline" size={16} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={estilos.seccionTitulo}>
                    Semáforo de Costos en Obra
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onNavigate && onNavigate("proyectos")}
                style={estilos.enlaceBoton}
              >
                <Text style={estilos.enlaceTexto}>Ver obras ({proyectos.length})</Text>
                <Ionicons name="chevron-forward" size={14} color={tema.colors.primary} />
              </TouchableOpacity>
            </View>

            {proyectos.slice(0, 3).map((proj, index) => {
              const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
              const porcentaje = Math.round(ratio * 100);
              const esUltimo = index === Math.min(proyectos.length, 3) - 1;

              return (
                <View
                  key={proj.id}
                  style={[estilos.proyectoFila, esUltimo && { borderBottomWidth: 0, paddingBottom: 0 }]}
                >
                  <View style={estilos.proyectoEncabezado}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text numberOfLines={1} style={estilos.proyectoNombre}>
                        <Text style={estilos.proyectoCodigo}>{proj.code}</Text> · {proj.name}
                      </Text>
                    </View>
                    <InsigniaSemaforo percentage={porcentaje} size="sm" />
                  </View>

                  <BarraProgreso
                    value={proj.costReal}
                    max={proj.budget}
                    height={6}
                    semaforo
                    containerStyle={{ marginVertical: 6 }}
                  />

                  <View style={estilos.proyectoMetaInferior}>
                    <Text numberOfLines={1} style={estilos.proyectoCliente}>
                      {proj.client}
                    </Text>
                    <Text style={estilos.financialNumbersTexto}>
                      <Text style={estilos.costoRealTexto}>{formatearCLP(proj.costReal)}</Text>
                      <Text style={estilos.presupuestoTexto}> / {formatearCLP(proj.budget)}</Text>
                    </Text>
                  </View>
                </View>
              );
            })}
          </Tarjeta>

          {/* 4. ALERTAS RECIENTES (COMPACTAS EN 1 LÍNEA) */}
          {alertas.length > 0 && (
            <Tarjeta variant="outlined" style={estilos.bloqueTarjeta}>
              <View style={[estilos.seccionEncabezado, { marginBottom: 8 }]}>
                <View style={estilos.tituloWithIcono}>
                  <View style={[estilos.iconoSeccionCaja, { backgroundColor: "#fef2f2" }]}>
                    <Ionicons name="notifications-outline" size={16} color={tema.colors.danger} />
                  </View>
                  <Text style={estilos.seccionTitulo}>Avisos Críticos</Text>
                </View>
              </View>

              {alertas.slice(0, 3).map((alert, idx) => (
                <View
                  key={alert.id}
                  style={[
                    estilos.alertaFila,
                    idx === Math.min(alertas.length, 3) - 1 && {
                      borderBottomWidth: 0,
                      paddingBottom: 0,
                    },
                  ]}
                >
                  <View
                    style={[
                      estilos.alertaPunto,
                      {
                        backgroundColor:
                          alert.severity === "rojo"
                            ? tema.colors.danger
                            : alert.severity === "amarillo"
                              ? tema.colors.warn
                              : tema.colors.info,
                      },
                    ]}
                  />
                  <View style={estilos.alertaTextoColumna}>
                    <Text numberOfLines={1} style={estilos.alertaTitulo}>
                      {alert.title}
                    </Text>
                    <Text numberOfLines={1} style={estilos.alertaDescripcion}>
                      {alert.description}
                    </Text>
                  </View>
                  <Text style={estilos.alertaTiempo}>{alert.time}</Text>
                </View>
              ))}
            </Tarjeta>
          )}

          {/* MODAL DE MOTIVO OBLIGATORIO AL RECHAZAR */}
          <ModalRechazoSolicitud
            solicitud={seleccionadoSolicitudRechazar}
            onClose={() => establecerSeleccionadoSolicitudRechazar(null)}
            onConfirmarRechazo={(solicitud, motivo) => {
              const resultado = rechazarSolicitudMaterial(solicitud.id, motivo, usuario.name);
              if (resultado.success) {
                mostrarAviso(
                  `Solicitud ${solicitud.code} rechazada. Motivo notificado al bodeguero solicitante.`,
                  "warn"
                );
                return { success: true };
              }
              return {
                success: false,
                error: resultado.error || "Debe ingresar un motivo obligatorio.",
              };
            }}
          />

          {/* MODAL DE VISTA DE COMPROBANTE NUMERADO AL APROBAR */}
          <ModalComprobanteSolicitud
            solicitud={comprobanteSolicitud}
            onClose={() => establecerComprobanteSolicitud(null)}
            onNotify={(mensaje) => mostrarAviso(mensaje, "ok")}
          />

          <NotificacionFlotante
            visible={avisoVisible}
            message={avisoMensaje}
            type={avisoTipo}
            onDismiss={() => establecerAvisoVisible(false)}
          />
        </ScrollView>
      </View>
    </ContenedorEstadoPantalla>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 36,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: tema.spacing.md,
  },
  kpiCelda: {
    flex: 1,
    minWidth: "46%",
  },
  bloqueTarjeta: {
    marginBottom: tema.spacing.md,
    padding: 14,
  },
  seccionEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  tituloWithIcono: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  iconoSeccionCaja: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seccionTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: tema.colors.text,
  },
  enlaceBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  enlaceTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.primary,
  },
  solicitudCompactaItem: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  solicitudCompactaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  solicitudCodigoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  solicitudCodigo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  solicitudFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  solicitudProyecto: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.colors.primaryDark,
    marginBottom: 2,
  },
  solicitudTecnico: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 10,
  },
  solicitudAccionFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proyectoFila: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  proyectoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  proyectoCodigo: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.primaryDark,
  },
  proyectoNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.colors.text,
  },
  proyectoMetaInferior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  proyectoCliente: {
    fontSize: 11,
    color: tema.colors.textMuted,
    flex: 1,
  },
  financialNumbersTexto: {
    fontSize: 12,
  },
  costoRealTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.text,
  },
  presupuestoTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  alertaFila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  alertaPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  alertaTextoColumna: {
    flex: 1,
  },
  alertaTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
  },
  alertaDescripcion: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  alertaTiempo: {
    fontSize: 10,
    color: tema.colors.textLight,
    marginLeft: 8,
  },
  tablaCodigoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tablaProyectoNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tablaTecnicoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tablaFechaTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  tablaElementosTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    lineHeight: 18,
  },
  tablaComentarioTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  tablaAccionesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  modalInstruction: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
    marginBottom: tema.spacing.sm,
  },
  motivoEntrada: {
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    height: 80,
    textAlignVertical: "top",
    color: tema.colors.text,
    backgroundColor: tema.colors.card,
  },
  entradaErrorBorde: {
    borderColor: tema.colors.danger,
    backgroundColor: "#fff5f5",
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.danger,
    marginTop: 4,
  },
  modalAcciones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: tema.spacing.lg,
    flexWrap: "wrap",
    gap: 8,
  },
});
