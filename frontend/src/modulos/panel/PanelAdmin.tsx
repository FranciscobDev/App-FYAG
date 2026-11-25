import React, { useMemo, useState } from "react";
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
  const pendienteSolicitudes = useMemo(
    () => solicitudesMaterial.filter((r) => r.status === "pendiente"),
    [solicitudesMaterial]
  );
  const lowExistenciaProductos = useMemo(
    () => productos.filter((p) => p.stock <= p.minStock && !p.disabled),
    [productos]
  );
  const abrirOrdenes = useMemo(
    () =>
      ordenesCompra.filter(
        (o) =>
          o.status === "borrador" ||
          o.status === "enviada" ||
          o.status === "recibida_parcial"
      ),
    [ordenesCompra]
  );
  const redProyectos = useMemo(
    () =>
      proyectos.filter(
        (p) => p.status === "activo" && p.budget > 0 && p.costReal / p.budget > 1.0
      ),
    [proyectos]
  );

  // Pulso financiero consolidado en tiempo real
  const pulsoFinanciero = useMemo(() => {
    let stockValorizado = 0;
    productos.forEach((p) => {
      if (p.disabled) return;
      const costoUnit = Number(p.pmp || 0) > 0 ? Number(p.pmp) : Number(p.unitCost || 0);
      stockValorizado += p.stock * costoUnit;
    });

    let presupuestoTotalObras = 0;
    let costoRealTotalObras = 0;
    proyectos.forEach((pr) => {
      presupuestoTotalObras += Number(pr.budget || 0);
      costoRealTotalObras += Number(pr.costReal || 0);
    });

    const margenObras = presupuestoTotalObras - costoRealTotalObras;
    const pctMargen =
      presupuestoTotalObras > 0 ? Math.round((margenObras / presupuestoTotalObras) * 100) : 0;

    return {
      stockValorizado: Math.round(stockValorizado),
      presupuestoTotalObras: Math.round(presupuestoTotalObras),
      costoRealTotalObras: Math.round(costoRealTotalObras),
      margenObras: Math.round(margenObras),
      pctMargen,
    };
  }, [productos, proyectos]);

  // Estado de modales de rechazo y comprobante numerado
  const [seleccionadoSolicitudRechazar, establecerSeleccionadoSolicitudRechazar] =
    useState<SolicitudMaterial | null>(null);
  const [comprobanteSolicitud, establecerComprobanteSolicitud] =
    useState<SolicitudMaterial | null>(null);

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
          subtitle="Resumen ejecutivo de aprobaciones, stock crítico y control presupuestario de obras"
        />

        <ScrollView style={estilos.scrollArea} contentContainerStyle={estilos.contenido}>
          {/* 1. CABECERA EJECUTIVA DE PULSO FINANCIERO + ACCESOS RÁPIDOS */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="speedometer-outline" size={21} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: tema.colors.text }}>
                    Centro de Mando Operativo
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Cartera Obras:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                      {formatearCLP(pulsoFinanciero.presupuestoTotalObras)}
                    </Text>{" "}
                    (Margen{" "}
                    <Text
                      style={{
                        fontWeight: "800",
                        color: pulsoFinanciero.margenObras >= 0 ? tema.colors.okDark : tema.colors.danger,
                      }}
                    >
                      {pulsoFinanciero.pctMargen}%
                    </Text>
                    ) • Stock:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.text }}>
                      {formatearCLP(pulsoFinanciero.stockValorizado)}
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Pastillas de Acceso Directo en 1 Toque */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[
                  { id: "compras", label: "Órdenes OC", icon: "cart-outline" as const },
                  { id: "facturas", label: "Facturas", icon: "receipt-outline" as const },
                  { id: "proyectos", label: "Obras", icon: "construct-outline" as const },
                  { id: "informes", label: "Informes", icon: "bar-chart-outline" as const },
                ].map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    activeOpacity={0.8}
                    onPress={() => onNavigate && onNavigate(acc.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "#f8fafc",
                      borderWidth: 1,
                      borderColor: tema.colors.borderDark,
                      borderRadius: 8,
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                    }}
                  >
                    <Ionicons name={acc.icon} size={13} color={tema.colors.primaryDark} />
                    <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.text }}>
                      {acc.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Tarjeta>

          {/* 2. GRILLA 2x2 COMPACTA DE TARJETAS KPI INTERACTIVAS CON SEMÁFORO DE SUPERFICIE */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "solicitudes",
                titulo: "Por Aprobar",
                valor: pendienteSolicitudes.length,
                sub: "Solicitudes faena",
                icon: "clipboard-outline" as const,
                bg: pendienteSolicitudes.length > 0 ? "#fffbeb" : "#f0fdf4",
                border: pendienteSolicitudes.length > 0 ? "#fcd34d" : "#86efac",
                borderActivo: pendienteSolicitudes.length > 0 ? "#d97706" : "#16a34a",
                textColor: pendienteSolicitudes.length > 0 ? "#92400e" : "#166534",
              },
              {
                id: "inventario",
                titulo: "Stock Crítico",
                valor: lowExistenciaProductos.length,
                sub: "Bajo mínimo",
                icon: "warning-outline" as const,
                bg: lowExistenciaProductos.length > 0 ? "#fef2f2" : "#f0fdf4",
                border: lowExistenciaProductos.length > 0 ? "#fca5a5" : "#86efac",
                borderActivo: lowExistenciaProductos.length > 0 ? "#dc2626" : "#16a34a",
                textColor: lowExistenciaProductos.length > 0 ? "#991b1b" : "#166534",
              },
              {
                id: "compras",
                titulo: "Órdenes Compra",
                valor: abrirOrdenes.length,
                sub: "Abiertas / curso",
                icon: "cart-outline" as const,
                bg: "#fff7ed",
                border: "#fdba74",
                borderActivo: "#ea580c",
                textColor: "#9a3412",
              },
              {
                id: "proyectos",
                titulo: "Obras en Rojo",
                valor: redProyectos.length,
                sub: redProyectos.length > 0 ? "Sobregiro > 100%" : `${proyectos.length} obras en regla`,
                icon:
                  redProyectos.length > 0
                    ? ("trending-down-outline" as const)
                    : ("checkmark-done-circle-outline" as const),
                bg: redProyectos.length > 0 ? "#fef2f2" : "#f0fdf4",
                border: redProyectos.length > 0 ? "#fca5a5" : "#86efac",
                borderActivo: redProyectos.length > 0 ? "#dc2626" : "#16a34a",
                textColor: redProyectos.length > 0 ? "#991b1b" : "#166534",
              },
            ].map((kpi) => (
              <TouchableOpacity
                key={kpi.id}
                activeOpacity={0.82}
                onPress={() => onNavigate && onNavigate(kpi.id)}
                style={{
                  flexBasis: "48%",
                  flexGrow: 1,
                  minWidth: 140,
                  backgroundColor: kpi.bg,
                  borderWidth: 1.5,
                  borderColor: kpi.border,
                  borderLeftWidth: 5,
                  borderLeftColor: kpi.borderActivo,
                  borderRadius: 11,
                  paddingHorizontal: 11,
                  paddingVertical: 9,
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
                  <Ionicons name={kpi.icon} size={16} color={kpi.textColor} />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginTop: 3,
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "900", color: kpi.textColor }}>
                    {kpi.valor}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "700",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {kpi.sub}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={kpi.textColor} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 3. SOLICITUDES PENDIENTES DE APROBACIÓN (CON SEMÁFORO DE URGENCIA Y FICHA DE ÍTEMS) */}
          <Tarjeta variant="outlined" style={estilos.bloqueTarjeta}>
            <View style={estilos.seccionEncabezado}>
              <View style={estilos.tituloWithIcono}>
                <View
                  style={[
                    estilos.iconoSeccionCaja,
                    {
                      backgroundColor: tema.colors.primaryLight,
                      borderWidth: 1,
                      borderColor: tema.colors.primaryBorder,
                    },
                  ]}
                >
                  <Ionicons name="clipboard-outline" size={16} color={tema.colors.primaryDark} />
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
              pendienteSolicitudes.slice(0, 3).map((req, idx) => {
                const esUrgente = req.urgency === "urgente";
                const semaforoSol = esUrgente
                  ? {
                      bg: "#fef2f2",
                      border: "#fca5a5",
                      stripe: "#dc2626",
                      text: "#991b1b",
                      divider: "#fecaca",
                    }
                  : {
                      bg: "#fffbeb",
                      border: "#fcd34d",
                      stripe: "#d97706",
                      text: "#92400e",
                      divider: "#fde68a",
                    };

                return (
                  <View
                    key={req.id}
                    style={{
                      backgroundColor: semaforoSol.bg,
                      borderColor: semaforoSol.border,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: semaforoSol.stripe,
                      borderRadius: 11,
                      padding: 12,
                      marginBottom: idx === Math.min(pendienteSolicitudes.length, 3) - 1 ? 0 : 10,
                    }}
                  >
                    <View style={estilos.solicitudCompactaTop}>
                      <View style={estilos.solicitudCodigoFila}>
                        <Text style={[estilos.solicitudCodigo, { color: semaforoSol.text }]}>
                          {req.code}
                        </Text>
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
                      <Text style={{ fontSize: 11, fontWeight: "700", color: semaforoSol.text }}>
                        {formatearFecha(req.date)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text }}>
                      {req.projectName}
                    </Text>
                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: semaforoSol.text, marginTop: 1 }}>
                      Solicitante: {req.technicianName}
                    </Text>

                    {/* Ficha Blanca Interna con el Detalle Completo de Insumos Pedidos */}
                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforoSol.divider,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        marginVertical: 8,
                        gap: 4,
                      }}
                    >
                      {req.items.map((it, itemIdx) => {
                        const prodCat = productos.find((p) => p.sku === it.sku);
                        const stockDisp = prodCat ? prodCat.stock : null;
                        return (
                          <View
                            key={`${req.id}_${it.sku}_${itemIdx}`}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text
                              style={{ fontSize: 11.5, color: tema.colors.text, flex: 1 }}
                              numberOfLines={1}
                            >
                              <Text style={{ fontWeight: "900", color: semaforoSol.text }}>
                                {it.quantity} {it.unit}
                              </Text>{" "}
                              {it.name}
                            </Text>
                            {stockDisp !== null && (
                              <Text
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: "700",
                                  color:
                                    stockDisp >= it.quantity
                                      ? tema.colors.okDark
                                      : tema.colors.danger,
                                }}
                              >
                                Stock: {stockDisp} {it.unit}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    <View style={estilos.solicitudAccionFila}>
                      <Boton
                        title="Rechazar"
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        onPress={() => manejarAbrirRechazar(req)}
                        style={{
                          flex: 1,
                          minHeight: 36,
                          borderColor: tema.colors.danger,
                          backgroundColor: "#ffffff",
                        }}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar y Ver Comprobante"
                        variant="success"
                        size="sm"
                        icon="checkmark-outline"
                        style={{ flex: 1.4, minHeight: 36 }}
                        onPress={() => manejarAprobarSolicitud(req)}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </Tarjeta>

          {/* 4. PANEL RÁPIDO DE STOCK CRÍTICO ACCIONABLE */}
          {lowExistenciaProductos.length > 0 && (
            <Tarjeta variant="outlined" style={estilos.bloqueTarjeta}>
              <View style={estilos.seccionEncabezado}>
                <View style={estilos.tituloWithIcono}>
                  <View
                    style={[
                      estilos.iconoSeccionCaja,
                      {
                        backgroundColor: "#fef2f2",
                        borderWidth: 1,
                        borderColor: "#fca5a5",
                      },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={16} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={estilos.seccionTitulo}>
                      Insumos en Stock Crítico ({lowExistenciaProductos.length})
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => onNavigate && onNavigate("compras")}
                  style={estilos.enlaceBoton}
                >
                  <Text style={estilos.enlaceTexto}>Reponer con OC</Text>
                  <Ionicons name="chevron-forward" size={14} color={tema.colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8 }}>
                {lowExistenciaProductos.slice(0, 3).map((prod) => {
                  const agotado = prod.stock === 0;
                  return (
                    <TouchableOpacity
                      key={prod.sku}
                      activeOpacity={0.82}
                      onPress={() => onNavigate && onNavigate("inventario")}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        backgroundColor: agotado ? "#fef2f2" : "#fffbeb",
                        borderWidth: 1.5,
                        borderColor: agotado ? "#fca5a5" : "#fcd34d",
                        borderLeftWidth: 5,
                        borderLeftColor: agotado ? "#dc2626" : "#d97706",
                        borderRadius: 10,
                        paddingHorizontal: 11,
                        paddingVertical: 8,
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 170 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: tema.colors.text }} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: agotado ? "#991b1b" : "#92400e",
                            marginTop: 1,
                          }}
                        >
                          {prod.sku} • {prod.category}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: "#ffffff",
                          borderWidth: 1,
                          borderColor: agotado ? "#fecaca" : "#fde68a",
                          borderRadius: 8,
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          alignItems: "flex-end",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color: agotado ? "#dc2626" : "#d97706",
                          }}
                        >
                          {prod.stock} / {prod.minStock} {prod.unit}
                        </Text>
                        <Text style={{ fontSize: 9.5, fontWeight: "700", color: tema.colors.textMuted }}>
                          {agotado ? "AGOTADO" : "BAJO MÍNIMO"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Tarjeta>
          )}

          {/* 5. SEMÁFORO EJECUTIVO DE COSTOS EN OBRA (CON SUPERFICIE COLOREADA) */}
          <Tarjeta variant="outlined" style={estilos.bloqueTarjeta}>
            <View style={estilos.seccionEncabezado}>
              <View style={estilos.tituloWithIcono}>
                <View
                  style={[
                    estilos.iconoSeccionCaja,
                    {
                      backgroundColor: tema.colors.primaryLight,
                      borderWidth: 1,
                      borderColor: tema.colors.primaryBorder,
                    },
                  ]}
                >
                  <Ionicons name="construct-outline" size={16} color={tema.colors.primaryDark} />
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

            <View style={{ gap: 10 }}>
              {proyectos.slice(0, 3).map((proj) => {
                const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
                const porcentaje = Math.round(ratio * 100);
                const margen = proj.budget - proj.costReal;

                const semaforoObra =
                  porcentaje > 100
                    ? {
                        bg: "#fef2f2",
                        border: "#fca5a5",
                        stripe: "#dc2626",
                        text: "#991b1b",
                        divider: "#fecaca",
                      }
                    : porcentaje >= 80
                      ? {
                          bg: "#fffbeb",
                          border: "#fcd34d",
                          stripe: "#d97706",
                          text: "#92400e",
                          divider: "#fde68a",
                        }
                      : {
                          bg: "#f0fdf4",
                          border: "#86efac",
                          stripe: "#16a34a",
                          text: "#166534",
                          divider: "#bbf7d0",
                        };

                return (
                  <TouchableOpacity
                    key={proj.id}
                    activeOpacity={0.85}
                    onPress={() => onNavigate && onNavigate("proyectos")}
                    style={{
                      backgroundColor: semaforoObra.bg,
                      borderColor: semaforoObra.border,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: semaforoObra.stripe,
                      borderRadius: 11,
                      padding: 11,
                    }}
                  >
                    <View style={estilos.proyectoEncabezado}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text numberOfLines={1} style={estilos.proyectoNombre}>
                          <Text style={[estilos.proyectoCodigo, { color: semaforoObra.text }]}>
                            {proj.code}
                          </Text>{" "}
                          · {proj.name}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: semaforoObra.text, marginTop: 1 }}>
                          Cliente: {proj.client}
                        </Text>
                      </View>
                      <InsigniaSemaforo percentage={porcentaje} size="sm" />
                    </View>

                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforoObra.divider,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        marginTop: 7,
                      }}
                    >
                      <BarraProgreso
                        value={proj.costReal}
                        max={proj.budget}
                        height={6}
                        semaforo
                        containerStyle={{ marginBottom: 6 }}
                      />

                      <View style={estilos.proyectoMetaInferior}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: semaforoObra.text }}>
                          Margen: {formatearCLP(margen)}
                        </Text>
                        <Text style={estilos.financialNumbersTexto}>
                          <Text style={estilos.costoRealTexto}>{formatearCLP(proj.costReal)}</Text>
                          <Text style={estilos.presupuestoTexto}> / {formatearCLP(proj.budget)}</Text>
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Tarjeta>

          {/* 6. ALERTAS RECIENTES INTERACTIVAS */}
          {alertas.length > 0 && (
            <Tarjeta variant="outlined" style={estilos.bloqueTarjeta}>
              <View style={[estilos.seccionEncabezado, { marginBottom: 10 }]}>
                <View style={estilos.tituloWithIcono}>
                  <View
                    style={[
                      estilos.iconoSeccionCaja,
                      {
                        backgroundColor: "#fef2f2",
                        borderWidth: 1,
                        borderColor: "#fca5a5",
                      },
                    ]}
                  >
                    <Ionicons name="notifications-outline" size={16} color={tema.colors.danger} />
                  </View>
                  <Text style={estilos.seccionTitulo}>Avisos Críticos ({alertas.length})</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {alertas.slice(0, 3).map((alert) => {
                  const esRoja = alert.severity === "rojo";
                  const esAmarilla = alert.severity === "amarillo";
                  return (
                    <TouchableOpacity
                      key={alert.id}
                      activeOpacity={0.8}
                      onPress={() => onNavigate && onNavigate(esRoja ? "inventario" : "compras")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: esRoja ? "#fef2f2" : esAmarilla ? "#fffbeb" : "#f1f5f9",
                        borderWidth: 1,
                        borderColor: esRoja ? "#fca5a5" : esAmarilla ? "#fcd34d" : "#cbd5e1",
                        borderLeftWidth: 4,
                        borderLeftColor: esRoja ? "#dc2626" : esAmarilla ? "#d97706" : "#475569",
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <View style={estilos.alertaTextoColumna}>
                        <Text numberOfLines={1} style={estilos.alertaTitulo}>
                          {alert.title}
                        </Text>
                        <Text numberOfLines={1} style={estilos.alertaDescripcion}>
                          {alert.description}
                        </Text>
                      </View>
                      <Text style={estilos.alertaTiempo}>{alert.time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
  bloqueTarjeta: {
    marginBottom: tema.spacing.md,
    padding: 14,
    borderRadius: 12,
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
  solicitudAccionFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    fontSize: 13.5,
    fontWeight: "800",
    color: tema.colors.text,
  },
  proyectoMetaInferior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
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
  alertaTextoColumna: {
    flex: 1,
  },
  alertaTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.text,
  },
  alertaDescripcion: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 1,
  },
  alertaTiempo: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textMuted,
    marginLeft: 8,
  },
});
