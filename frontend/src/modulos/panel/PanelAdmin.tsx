import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { ColumnaTabla, TablaDatos } from "@/componentes/datos/TablaDatos";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { TarjetaKpi } from "@/componentes/datos/TarjetaKpi";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { InsigniaSemaforo } from "@/componentes/base/InsigniaSemaforo";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { NotificacionFlotante, TipoNotificacionFlotante } from "@/componentes/retroalimentacion/NotificacionFlotante";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
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

  // Metrics
  const pendienteSolicitudes = solicitudesMaterial.filter((r) => r.status === "pendiente");
  const lowExistenciaProductos = productos.filter((p) => p.stock <= p.minStock && !p.disabled);
  const abrirOrdenes = ordenesCompra.filter(
    (o) => o.status === "borrador" || o.status === "enviada" || o.status === "recibida_parcial"
  );
  const redProyectos = proyectos.filter(
    (p) => p.status === "activo" && p.budget > 0 && p.costReal / p.budget > 1.0
  );

  // Reject Modal State
  const [rechazarModalVisible, establecerRechazarModalVisible] = useState(false);
  const [seleccionadoSolicitud, establecerSeleccionadoSolicitud] = useState<SolicitudMaterial | null>(null);
  const [rejectionMotivo, establecerRejectionMotivo] = useState("");
  const [rechazarError, establecerRechazarError] = useState("");

  // Toast State
  const [avisoVisible, establecerAvisoVisible] = useState(false);
  const [avisoMensaje, establecerAvisoMensaje] = useState("");
  const [avisoTipo, establecerAvisoTipo] = useState<TipoNotificacionFlotante>("ok");

  const mostrarAviso = (msg: string, type: TipoNotificacionFlotante = "ok") => {
    establecerAvisoMensaje(msg);
    establecerAvisoTipo(type);
    establecerAvisoVisible(true);
  };

  const manejarAbrirRechazar = (req: SolicitudMaterial) => {
    establecerSeleccionadoSolicitud(req);
    establecerRejectionMotivo("");
    establecerRechazarError("");
    establecerRechazarModalVisible(true);
  };

  const manejarConfirmarRechazar = () => {
    if (!seleccionadoSolicitud) return;
    if (!rejectionMotivo.trim()) {
      establecerRechazarError("Debe ingresar un motivo para rechazar la solicitud.");
      return;
    }
    const resultado = rechazarSolicitudMaterial(seleccionadoSolicitud.id, rejectionMotivo, usuario.name);
    if (resultado.success) {
      establecerRechazarModalVisible(false);
      establecerSeleccionadoSolicitud(null);
      mostrarAviso("Solicitud rechazada con motivo informado.", "warn");
    } else if (resultado.error) {
      establecerRechazarError(resultado.error);
    }
  };

  // Columnas para la Tabla de Solicitudes Pendientes (Paso 5)
  const solicitudColumnas: ColumnaTabla<SolicitudMaterial>[] = [
    {
      key: "code",
      title: "CÓDIGO / URGENCIA",
      width: 150,
      render: (req) => (
        <View>
          <Text style={estilos.tablaCodigoTexto}>{req.code}</Text>
          <Insignia
            label={req.urgency.toUpperCase()}
            tone={req.urgency === "urgente" ? "danger" : req.urgency === "alta" ? "warn" : "info"}
            size="sm"
            style={{ marginTop: 4, alignSelf: "flex-start" }}
          />
        </View>
      ),
    },
    {
      key: "projectName",
      title: "PROYECTO",
      width: 190,
      render: (req) => (
        <View>
          <Text style={estilos.tablaProyectoNombre} numberOfLines={2}>
            {req.projectName}
          </Text>
        </View>
      ),
    },
    {
      key: "technicianName",
      title: "SOLICITA",
      width: 160,
      render: (req) => (
        <View>
          <Text style={estilos.tablaTecnicoTexto}>{req.technicianName}</Text>
          <Text style={estilos.tablaFechaTexto}>{formatearFecha(req.date)}</Text>
        </View>
      ),
    },
    {
      key: "items",
      title: "MATERIALES",
      render: (req) => (
        <View>
          <Text style={estilos.tablaElementosTexto} numberOfLines={2}>
            {req.items.map((it) => `${it.quantity} ${it.unit} ${it.name}`).join(" • ")}
          </Text>
          {req.comment ? (
            <Text style={estilos.tablaComentarioTexto} numberOfLines={1}>
              Nota: "{req.comment}"
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: "actions",
      title: "ACCIONES",
      width: 190,
      render: (req) => (
        <View style={estilos.tablaAccionesFila}>
          <Boton
            title="Rechazar"
            variant="outline"
            size="sm"
            icon="close-outline"
            onPress={() => manejarAbrirRechazar(req)}
            style={{ borderColor: tema.colors.danger, marginRight: 6 }}
            textStyle={{ color: tema.colors.danger }}
          />
          <Boton
            title="Aprobar"
            variant="success"
            size="sm"
            icon="checkmark-outline"
            onPress={() => {
              aprobarSolicitudMaterial(req.id, usuario.name);
              mostrarAviso(`Solicitud ${req.code} aprobada para despacho.`, "ok");
            }}
          />
        </View>
      ),
    },
  ];

  return (
    <ContenedorEstadoPantalla
      screenTitle="Dashboard General"
      skeletonType="kpis"
      emptyProps={{
        title: "No hay actividad reciente en el Dashboard",
        description: "No se registran solicitudes pendientes, proyectos activos ni alertas en el sistema.",
        actionTitle: "Ver Inventario",
        onAction: () => onNavigate && onNavigate("inventario"),
      }}
      errorProps={{
        title: "Error al cargar métricas del Dashboard",
        message: "No fue posible sincronizar los indicadores de gestión con la base de datos.",
      }}
      forbiddenProps={{
        title: "Acceso Restringido al Dashboard Administrativo",
        message: "Solo usuarios con rol Administrador tienen autorización para consultar métricas financieras y aprobar solicitudes.",
      }}
    >
      <View style={estilos.contenedor}>
        {/* ENCABEZADO EJECUTIVO INTEGRADO EN FONDO OSCURO */}
        <EncabezadoPagina
          title="Dashboard General"
          subtitle="Monitoreo ejecutivo de bodega, compras y estados de obra en tiempo real"
        />

        <ScrollView style={estilos.scrollArea} contentContainerStyle={estilos.contenido}>
          {/* 1. KPI CARDS */}
        <View style={estilos.kpiGrilla}>
        <TarjetaKpi
          label="Solicitudes Pendientes"
          value={pendienteSolicitudes.length}
          subtitle="Requieren aprobación"
          tone={pendienteSolicitudes.length > 0 ? "warn" : "ok"}
          icon="clipboard-outline"
          onPress={() => onNavigate && onNavigate("inventario")}
        />
        <TarjetaKpi
          label="Insumos Bajo Mínimo"
          value={lowExistenciaProductos.length}
          subtitle="Stock crítico bodega"
          tone={lowExistenciaProductos.length > 0 ? "danger" : "ok"}
          icon="warning-outline"
          onPress={() => onNavigate && onNavigate("inventario")}
        />
        <TarjetaKpi
          label="Órdenes de Compra"
          value={abrirOrdenes.length}
          subtitle="Abiertas / en curso"
          tone="info"
          icon="cart-outline"
          onPress={() => onNavigate && onNavigate("compras")}
        />
        <TarjetaKpi
          label="Proyectos en Rojo"
          value={redProyectos.length}
          subtitle="Sobregiro > 100%"
          tone={redProyectos.length > 0 ? "danger" : "ok"}
          icon="trending-down-outline"
          onPress={() => onNavigate && onNavigate("proyectos")}
        />
      </View>

      {/* 2. RECENT ALERTS */}
      <Tarjeta variant="outlined">
        <View style={estilos.seccionEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="notifications-outline" size={18} color={tema.colors.warn} />
            <Text style={estilos.seccionTitulo}>Alertas Críticas Recientes</Text>
          </View>
        </View>
        {alertas.slice(0, 3).map((alert) => (
          <View key={alert.id} style={estilos.alertaFila}>
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
              <Text style={estilos.alertaTitulo}>{alert.title}</Text>
              <Text style={estilos.alertaDescripcion}>{alert.description}</Text>
            </View>
            <Text style={estilos.alertaTiempo}>{alert.time}</Text>
          </View>
        ))}
      </Tarjeta>

      {/* 3. PROYECTOS CON SEMÁFORO DE COSTO */}
      <Tarjeta variant="elevated">
        <View style={estilos.seccionEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="business-outline" size={18} color={tema.colors.primary} />
            <Text style={estilos.seccionTitulo}>Semáforo de Costos por Proyecto</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("proyectos")}>
            <Text style={estilos.enlaceTexto}>Ver todos ({proyectos.length})</Text>
          </TouchableOpacity>
        </View>

        {proyectos.slice(0, 4).map((proj) => {
          const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
          const porcentaje = Math.round(ratio * 100);

          return (
            <View key={proj.id} style={estilos.proyectoFila}>
              <View style={estilos.proyectoInfoColumna}>
                <View style={estilos.proyectoEncabezado}>
                  <Text style={estilos.proyectoCodigo}>{proj.code}</Text>
                  <InsigniaEstado status={proj.status} size="sm" />
                </View>
                <Text style={estilos.proyectoNombre}>{proj.name}</Text>
                <Text style={estilos.proyectoCliente}>Cliente: {proj.client}</Text>
              </View>

              <View style={estilos.proyectoFinancialColumna}>
                <View style={estilos.financialNumbers}>
                  <Text style={estilos.costoRealTexto}>{formatearCLP(proj.costReal)}</Text>
                  <Text style={estilos.presupuestoTexto}> / {formatearCLP(proj.budget)}</Text>
                </View>

                <BarraProgreso
                  value={proj.costReal}
                  max={proj.budget}
                  height={8}
                  semaforo
                  containerStyle={{ marginVertical: 6 }}
                />

                <View style={estilos.semaphoreFila}>
                  <InsigniaSemaforo percentage={porcentaje} size="sm" />
                </View>
              </View>
            </View>
          );
        })}
      </Tarjeta>

      {/* 4. TABLA DE SOLICITUDES PENDIENTES DE APROBACIÓN */}
      <Tarjeta variant="elevated">
        <View style={estilos.seccionEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="clipboard-outline" size={18} color={tema.colors.warn} />
            <Text style={estilos.seccionTitulo}>
              Tabla de Solicitudes Pendientes de Aprobación ({pendienteSolicitudes.length})
            </Text>
          </View>
        </View>

        {pendienteSolicitudes.length === 0 ? (
          <EstadoVacio
            icon="checkmark-circle-outline"
            title="¡Todo al día!"
            description="No hay solicitudes pendientes de aprobación en este momento."
            actionTitle="Ver Inventario"
            onAction={() => onNavigate && onNavigate("inventario")}
            containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
          />
        ) : (
          <TablaDatos
            columns={solicitudColumnas}
            data={pendienteSolicitudes}
            keyExtractor={(r) => r.id}
            pageSize={5}
            showSearch={false}
            cardRender={(req) => (
              <View style={estilos.solicitudTarjeta}>
                <View style={estilos.solicitudSuperior}>
                  <View>
                    <View style={estilos.solicitudCodigoFila}>
                      <Text style={estilos.solicitudCodigo}>{req.code}</Text>
                      <Insignia
                        label={req.urgency.toUpperCase()}
                        tone={req.urgency === "urgente" ? "danger" : req.urgency === "alta" ? "warn" : "info"}
                        size="sm"
                      />
                    </View>
                    <Text style={estilos.solicitudProyecto}>{req.projectName}</Text>
                    <Text style={estilos.solicitudTecnico}>
                      Solicita: {req.technicianName} • {formatearFecha(req.date)}
                    </Text>
                  </View>
                </View>

                <View style={estilos.solicitudElementosCaja}>
                  <Text style={estilos.solicitudElementosEtiqueta}>Materiales solicitados:</Text>
                  {req.items.map((it, idx) => (
                    <Text key={idx} style={estilos.solicitudElementoLinea}>
                      • {it.quantity} {it.unit} - {it.name}
                    </Text>
                  ))}
                  {req.comment && (
                    <Text style={estilos.solicitudComentarioTexto}>
                      Nota: "{req.comment}"
                    </Text>
                  )}
                </View>

                <View style={estilos.solicitudAccionFila}>
                  <Boton
                    title="Rechazar"
                    variant="outline"
                    size="sm"
                    icon="close-outline"
                    onPress={() => manejarAbrirRechazar(req)}
                    style={{ borderColor: tema.colors.danger, marginRight: 8 }}
                    textStyle={{ color: tema.colors.danger }}
                  />
                  <Boton
                    title="Aprobar Solicitud"
                    variant="success"
                    size="sm"
                    icon="checkmark-outline"
                    onPress={() => {
                      aprobarSolicitudMaterial(req.id, usuario.name);
                      mostrarAviso(`Solicitud ${req.code} aprobada para despacho.`, "ok");
                    }}
                  />
                </View>
              </View>
            )}
          />
        )}
      </Tarjeta>

      {/* REJECT MODAL */}
      <VistaModal
        visible={rechazarModalVisible}
        onClose={() => establecerRechazarModalVisible(false)}
        title="Rechazar Solicitud de Material"
        subtitle={seleccionadoSolicitud ? `${seleccionadoSolicitud.code} • ${seleccionadoSolicitud.projectName}` : ""}
      >
        <Text style={estilos.modalInstruction}>
          El rechazo exige motivo obligatorio para informar al técnico en terreno:
        </Text>
        <TextInput
          value={rejectionMotivo}
          onChangeText={(text) => {
            establecerRejectionMotivo(text);
            if (rechazarError) establecerRechazarError("");
          }}
          placeholder="Ej: Insumos no contemplados en cubicación o proyecto sin disponibilidad..."
          placeholderTextColor={tema.colors.textLight}
          multiline
          numberOfLines={3}
          style={[estilos.motivoEntrada, Boolean(rechazarError) && estilos.entradaErrorBorde]}
        />
        {Boolean(rechazarError) && <Text style={estilos.errorTexto}>{rechazarError}</Text>}

        <View style={estilos.modalAcciones}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerRechazarModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Confirmar Rechazo"
            variant="danger"
            icon="trash-outline"
            onPress={manejarConfirmarRechazar}
          />
        </View>
      </VistaModal>

      {/* TOAST FLOTANTE */}
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
    paddingBottom: 40,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -tema.spacing.xs,
    marginBottom: tema.spacing.md,
  },
  seccionEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tema.spacing.md,
  },
  tituloWithIcono: {
    flexDirection: "row",
    alignItems: "center",
  },
  seccionTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
    marginLeft: 6,
  },
  enlaceTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.primary,
  },
  alertaFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: tema.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  alertaPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: tema.spacing.sm,
  },
  alertaTextoColumna: {
    flex: 1,
  },
  alertaTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  alertaDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  alertaTiempo: {
    fontSize: 10,
    color: tema.colors.textLight,
    marginLeft: tema.spacing.sm,
  },
  proyectoFila: {
    paddingVertical: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  proyectoInfoColumna: {
    marginBottom: tema.spacing.xs,
  },
  proyectoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  proyectoCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
    marginTop: 2,
  },
  proyectoCliente: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  proyectoFinancialColumna: {
    marginTop: tema.spacing.xs,
  },
  financialNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  costoRealTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  presupuestoTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  progresoBarraFondo: {
    height: 6,
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 4,
  },
  progresoBarraFill: {
    height: "100%",
    borderRadius: 3,
  },
  semaphoreFila: {
    marginTop: 4,
  },
  vacioCaja: {
    alignItems: "center",
    paddingVertical: tema.spacing.xl,
  },
  vacioTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 8,
  },
  vacioSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  solicitudTarjeta: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  solicitudSuperior: {
    marginBottom: tema.spacing.sm,
  },
  solicitudCodigoFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  solicitudCodigo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  solicitudProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.primaryDark,
    marginTop: 2,
  },
  solicitudTecnico: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  solicitudElementosCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.sm,
    padding: tema.spacing.sm,
    marginBottom: tema.spacing.md,
  },
  solicitudElementosEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 4,
  },
  solicitudElementoLinea: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    marginVertical: 1,
  },
  solicitudComentarioTexto: {
    fontSize: tema.fontSize.xs,
    fontStyle: "italic",
    color: tema.colors.textMuted,
    marginTop: 4,
  },
  solicitudAccionFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
});
