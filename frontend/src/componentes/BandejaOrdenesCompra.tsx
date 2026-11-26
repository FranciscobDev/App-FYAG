import React, { useMemo, useState } from "react";
import {
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
import {
  Boton,
  EstadoVacio,
  Insignia,
  Tarjeta,
} from "@/componentes/comunes";
import { OrdenCompra } from "@/nucleo/tipos";

export type FiltroOrigenOrden =
  | "todos"
  | "borradores_auto"
  | "automatica"
  | "manual";

export interface RegistroAprobacionReciente {
  id: string;
  codigoOc: string;
  proveedor: string;
  esAutomatica: boolean;
  total: number;
  hora: string;
}

export interface PropiedadesBandejaOrdenesCompra {
  ordenes?: OrdenCompra[];
  poFiltrarEstado?: string;
  establecerPoFiltrarEstado?: (estado: string) => void;
  aprobarYEnviarOrden?: (orderId: string) => void;
  manejarAbrirNuevoOrden?: (defaultSupplierId?: string) => void;
  manejarAbrirEditarOrden?: (order: OrdenCompra) => void;
  establecerPdfVistaPreviaOrden?: (order: OrdenCompra | null) => void;
  establecerTarifaModalOrden?: (order: OrdenCompra | null) => void;
  establecerCalificacionTiempo?: (val: number) => void;
  establecerCalificacionQuality?: (val: number) => void;
  establecerCalificacionPrecio?: (val: number) => void;
  establecerCalificacionComentario?: (val: string) => void;
  mostrarAviso?: (msg: string) => void;
  rolActual?: string;
}

/**
 * [FRONT-2] Bandeja de Órdenes de Compra destacando visualmente los borradores
 * generados automáticamente pendientes de aprobación.
 * - El Administrador filtra y distingue órdenes automáticas de manuales.
 * - [SCRUM] Verifica en la lista la etiqueta de OC automática y la aprueba.
 */
export const BandejaOrdenesCompra: React.FC<PropiedadesBandejaOrdenesCompra> = ({
  ordenes: ordenesProp,
  poFiltrarEstado: estadoExterno,
  establecerPoFiltrarEstado: establecerEstadoExterno,
  aprobarYEnviarOrden: aprobarExterno,
  manejarAbrirNuevoOrden,
  manejarAbrirEditarOrden,
  establecerPdfVistaPreviaOrden,
  establecerTarifaModalOrden,
  establecerCalificacionTiempo,
  establecerCalificacionQuality,
  establecerCalificacionPrecio,
  establecerCalificacionComentario,
  mostrarAviso,
  rolActual: rolExterno,
}) => {
  const appCtx = usarAplicacion();
  const authCtx = usarAutenticacion();

  const ordenesTotales = ordenesProp ?? appCtx.ordenesCompra;
  const aprobarOrdenFn = aprobarExterno ?? appCtx.aprobarYEnviarOrden;
  const rol = rolExterno ?? authCtx.rolActual;

  const [estadoInterno, establecerEstadoInterno] = useState<string>("todas");
  const filtroEstado = estadoExterno ?? estadoInterno;
  const cambiarFiltroEstado =
    establecerEstadoExterno ?? establecerEstadoInterno;

  const [filtroOrigen, establecerFiltroOrigen] =
    useState<FiltroOrigenOrden>("todos");
  const [busqueda, establecerBusqueda] = useState<string>("");
  const [aprobacionesRecientes, establecerAprobacionesRecientes] = useState<
    RegistroAprobacionReciente[]
  >([]);

  // Métricas y contadores para el Administrador
  const metricas = useMemo(() => {
    const borradoresAuto = ordenesTotales.filter(
      (o) => o.status === "borrador" && Boolean(o.isAutoMinStock)
    );
    const borradoresManuales = ordenesTotales.filter(
      (o) => o.status === "borrador" && !o.isAutoMinStock
    );
    const totalAutomaticas = ordenesTotales.filter((o) =>
      Boolean(o.isAutoMinStock)
    );
    const totalManuales = ordenesTotales.filter((o) => !o.isAutoMinStock);
    const montoBorradoresAuto = borradoresAuto.reduce(
      (acc, o) => acc + (o.total || 0),
      0
    );

    return {
      borradoresAuto,
      borradoresManuales,
      totalAutomaticas,
      totalManuales,
      montoBorradoresAuto,
    };
  }, [ordenesTotales]);

  // Lista filtrada combinando Origen (Automática / Manual / Borrador Auto), Estado y Búsqueda
  // Además ordena priorizando primero los borradores automáticos pendientes de aprobación
  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    const filtradas = ordenesTotales.filter((order) => {
      // 1. Filtro por estado
      if (filtroEstado !== "todas" && order.status !== filtroEstado) {
        return false;
      }

      // 2. Filtro por origen (Automática vs Manual)
      if (filtroOrigen === "borradores_auto") {
        if (!(order.status === "borrador" && Boolean(order.isAutoMinStock))) {
          return false;
        }
      } else if (filtroOrigen === "automatica") {
        if (!order.isAutoMinStock) return false;
      } else if (filtroOrigen === "manual") {
        if (order.isAutoMinStock) return false;
      }

      // 3. Filtro por texto
      if (q) {
        const coincideCodigo = order.code.toLowerCase().includes(q);
        const coincideProveedor = order.supplier.toLowerCase().includes(q);
        const coincideRut = (order.supplierRut || "").toLowerCase().includes(q);
        const coincideItem = order.items.some(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.sku.toLowerCase().includes(q)
        );
        const coincideOrigen =
          (order.isAutoMinStock && "automatica automático stock minimo".includes(q)) ||
          (!order.isAutoMinStock && "manual".includes(q));
        if (
          !coincideCodigo &&
          !coincideProveedor &&
          !coincideRut &&
          !coincideItem &&
          !coincideOrigen
        ) {
          return false;
        }
      }

      return true;
    });

    // Ordenar destacando en la parte superior los borradores automáticos pendientes de aprobación
    return [...filtradas].sort((a, b) => {
      const aAutoDraft = a.status === "borrador" && Boolean(a.isAutoMinStock) ? 1 : 0;
      const bAutoDraft = b.status === "borrador" && Boolean(b.isAutoMinStock) ? 1 : 0;
      if (aAutoDraft !== bAutoDraft) return bAutoDraft - aAutoDraft;

      const aDraft = a.status === "borrador" ? 1 : 0;
      const bDraft = b.status === "borrador" ? 1 : 0;
      if (aDraft !== bDraft) return bDraft - aDraft;

      return b.code.localeCompare(a.code);
    });
  }, [ordenesTotales, filtroEstado, filtroOrigen, busqueda]);

  // Acción: Aprobar una Orden de Compra en borrador
  const manejarAprobarOrden = (order: OrdenCompra) => {
    aprobarOrdenFn(order.id);
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    establecerAprobacionesRecientes((prev) => [
      {
        id: `${order.id}_${Date.now()}`,
        codigoOc: order.code,
        proveedor: order.supplier,
        esAutomatica: Boolean(order.isAutoMinStock),
        total: order.total,
        hora: horaStr,
      },
      ...prev,
    ]);

    const tipoTexto = order.isAutoMinStock ? "OC Automática" : "OC Manual";
    mostrarAviso?.(
      `✓ ${tipoTexto} ${order.code} aprobada exitosamente y enviada a ${order.supplier}.`
    );
  };

  // Acción: Aprobar todos los borradores automáticos pendientes en un clic
  const manejarAprobarTodosBorradoresAuto = () => {
    if (metricas.borradoresAuto.length === 0) return;
    const cantidad = metricas.borradoresAuto.length;
    metricas.borradoresAuto.forEach((order) => {
      manejarAprobarOrden(order);
    });
    mostrarAviso?.(
      `✓ Se aprobaron y enviaron ${cantidad} órdenes de compra automáticas pendientes.`
    );
  };

  // Acción: Generar borrador automático por quiebre de stock mínimo (para pruebas SCRUM)
  const manejarGenerarBorradorAutoStock = () => {
    const productosCriticos = appCtx.productos.filter(
      (p) => p.stock <= p.minStock && !p.disabled
    );
    const insumoObjetivo = productosCriticos[0] || appCtx.productos[0];
    const proveedorObjetivo =
      appCtx.proveedores.find(
        (s) =>
          insumoObjetivo?.defaultSupplier &&
          s.businessName
            .toLowerCase()
            .includes(insumoObjetivo.defaultSupplier.split(" ")[0].toLowerCase())
      ) || appCtx.proveedores[0];

    if (!insumoObjetivo || !proveedorObjetivo) return;

    const cantidadReponer =
      insumoObjetivo.restockQuantity ||
      Math.max(20, (insumoObjetivo.minStock || 10) * 2);

    const res = appCtx.crearOrdenCompra({
      supplierId: proveedorObjetivo.id,
      supplier: proveedorObjetivo.businessName,
      supplierRut: proveedorObjetivo.rut,
      status: "borrador",
      isAutoMinStock: true,
      items: [
        {
          sku: insumoObjetivo.sku,
          name: insumoObjetivo.name,
          quantity: cantidadReponer,
          unitPrice: insumoObjetivo.unitCost || 4500,
          unit: insumoObjetivo.unit || "un",
        },
      ],
      expectedDate: new Date(Date.now() + 4 * 86400000)
        .toISOString()
        .slice(0, 10),
      notes: `Borrador generado automáticamente por alerta de stock mínimo en ${insumoObjetivo.sku} (Stock actual: ${insumoObjetivo.stock} ${insumoObjetivo.unit} / Mínimo requerido: ${insumoObjetivo.minStock} ${insumoObjetivo.unit}). Pendiente de aprobación por Administración.`,
    });

    if (res.success) {
      cambiarFiltroEstado("todas");
      establecerFiltroOrigen("borradores_auto");
      mostrarAviso?.(
        `⚡ Nuevo borrador de OC Automática generado para ${insumoObjetivo.name} y pendiente de aprobación.`
      );
    }
  };

  const obtenerEstiloSemaforoOrden = (status: string, esAuto?: boolean) => {
    if (status === "recibida" || status === "cerrada") {
      return {
        fondoTarjeta: "#f0fdf4",
        bordeTarjeta: "#86efac",
        franjaLateral: "#16a34a",
        divisorColor: "#bbf7d0",
      };
    }
    if (status === "anulada") {
      return {
        fondoTarjeta: "#fef2f2",
        bordeTarjeta: "#fca5a5",
        franjaLateral: "#dc2626",
        divisorColor: "#fecaca",
      };
    }
    if (status === "borrador") {
      return {
        fondoTarjeta: "#fffbeb",
        bordeTarjeta: esAuto ? "#f59e0b" : "#fcd34d",
        franjaLateral: esAuto ? "#dc2626" : "#d97706",
        divisorColor: "#fde68a",
      };
    }
    // enviada / recibida_parcial
    return {
      fondoTarjeta: "#fffbeb",
      bordeTarjeta: "#fcd34d",
      franjaLateral: "#d97706",
      divisorColor: "#fde68a",
    };
  };

  return (
    <View style={estilosLocales.contenedor}>
      {/* 1. CABECERA COMPACTA INDUSTRIAL + BOTÓN NUEVA OC MANUAL */}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: tema.colors.primaryLight,
                borderWidth: 1,
                borderColor: tema.colors.primaryBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="cart-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                Bandeja de Órdenes de Compra
              </Text>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                {metricas.borradoresAuto.length > 0 ? (
                  <>
                    <Text style={{ fontWeight: "800", color: tema.colors.danger }}>
                      {metricas.borradoresAuto.length} borrador(es) automático(s)
                    </Text>{" "}
                    por aprobar ({formatearCLP(metricas.montoBorradoresAuto)})
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                      Borradores al día
                    </Text>{" "}
                    • {ordenesTotales.length} órdenes registradas
                  </>
                )}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {rol === "admin" && metricas.borradoresAuto.length > 1 && (
              <Boton
                title={`Aprobar Todas (${metricas.borradoresAuto.length})`}
                variant="success"
                size="sm"
                icon="checkmark-done-outline"
                onPress={manejarAprobarTodosBorradoresAuto}
                style={{ minHeight: 40 }}
              />
            )}
            {rol === "admin" && manejarAbrirNuevoOrden && (
              <Boton
                title="Nueva OC Manual"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={() => manejarAbrirNuevoOrden()}
                style={{ minHeight: 40 }}
              />
            )}
          </View>
        </View>
      </Tarjeta>

      {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS (SIN ETIQUETAS AZULES NI EMOJIS) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {[
          {
            id: "borradores_auto" as FiltroOrigenOrden,
            titulo: "Borradores Auto",
            valor: metricas.borradoresAuto.length,
            sub:
              metricas.borradoresAuto.length > 0
                ? formatearCLP(metricas.montoBorradoresAuto)
                : "Al día (0 pend.)",
            icon: "flash-outline" as const,
            bg: metricas.borradoresAuto.length > 0 ? "#fef2f2" : "#fffbeb",
            border: metricas.borradoresAuto.length > 0 ? "#fca5a5" : "#fcd34d",
            borderActivo: metricas.borradoresAuto.length > 0 ? "#dc2626" : "#d97706",
            textColor: metricas.borradoresAuto.length > 0 ? "#991b1b" : "#92400e",
          },
          {
            id: "automatica" as FiltroOrigenOrden,
            titulo: "OC Automáticas",
            valor: metricas.totalAutomaticas.length,
            sub: "Por stock mínimo",
            icon: "hardware-chip-outline" as const,
            bg: "#fffbeb",
            border: "#fcd34d",
            borderActivo: "#d97706",
            textColor: "#92400e",
          },
          {
            id: "manual" as FiltroOrigenOrden,
            titulo: "OC Manuales",
            valor: metricas.totalManuales.length,
            sub: "Emitidas manual",
            icon: "create-outline" as const,
            bg: "#f0fdf4",
            border: "#86efac",
            borderActivo: "#16a34a",
            textColor: "#166534",
          },
          {
            id: "todos" as FiltroOrigenOrden,
            titulo: "Todas las OC",
            valor: ordenesTotales.length,
            sub: "Historial total",
            icon: "layers-outline" as const,
            bg: "#f1f5f9",
            border: "#cbd5e1",
            borderActivo: "#334155",
            textColor: "#0f172a",
          },
        ].map((kpi) => {
          const activo = filtroOrigen === kpi.id;
          return (
            <TouchableOpacity
              key={kpi.id}
              activeOpacity={0.8}
              onPress={() => {
                if (kpi.id === "borradores_auto") {
                  cambiarFiltroEstado("todas");
                }
                establecerFiltroOrigen(kpi.id);
              }}
              style={{
                flexBasis: "48%",
                flexGrow: 1,
                minWidth: 140,
                backgroundColor: kpi.bg,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? kpi.borderActivo : kpi.border,
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
                    fontWeight: activo ? "800" : "600",
                    color: kpi.textColor,
                  }}
                  numberOfLines={1}
                >
                  {activo ? "● Vista activa" : kpi.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. BUSCADOR COMPACTO + CHIPS DE ESTADO DEL CICLO DE VIDA */}
      <View style={{ gap: 8, marginBottom: 12 }}>
        <View style={estilosLocales.buscadorCaja}>
          <Ionicons name="search-outline" size={17} color={tema.colors.textMuted} />
          <TextInput
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar por código OC, proveedor, RUT o insumo..."
            placeholderTextColor={tema.colors.textLight}
            style={estilosLocales.buscadorInput}
          />
          {Boolean(busqueda) && (
            <Pressable onPress={() => establecerBusqueda("")}>
              <Ionicons name="close-circle" size={17} color={tema.colors.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 8 }}
        >
          {[
            { id: "todas", label: `Todos (${ordenesTotales.length})` },
            {
              id: "borrador",
              label: `Borradores (${ordenesTotales.filter((o) => o.status === "borrador").length})`,
            },
            {
              id: "enviada",
              label: `Enviadas (${ordenesTotales.filter((o) => o.status === "enviada").length})`,
            },
            {
              id: "recibida_parcial",
              label: `Parciales (${ordenesTotales.filter((o) => o.status === "recibida_parcial").length})`,
            },
            {
              id: "recibida",
              label: `Recibidas (${ordenesTotales.filter((o) => o.status === "recibida").length})`,
            },
            {
              id: "cerrada",
              label: `Cerradas (${ordenesTotales.filter((o) => o.status === "cerrada").length})`,
            },
          ].map((st) => {
            const activo = filtroEstado === st.id;
            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => cambiarFiltroEstado(st.id)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 7,
                  borderWidth: 1,
                  backgroundColor: activo ? tema.colors.primaryLight : "#ffffff",
                  borderColor: activo ? tema.colors.primary : tema.colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: activo ? "800" : "600",
                    color: activo ? tema.colors.primaryDark : tema.colors.textSecondary,
                  }}
                >
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. LISTADO DE TARJETAS DE ÓRDENES DE COMPRA CON SEMÁFORO DE SUPERFICIE */}
      {ordenesFiltradas.length === 0 ? (
        <EstadoVacio
          icon="cart-outline"
          title="No se encontraron órdenes de compra"
          description="No existen órdenes que coincidan con los filtros seleccionados."
          actionTitle={
            rol === "admin" && manejarAbrirNuevoOrden ? "Nueva OC Manual" : undefined
          }
          onAction={
            rol === "admin" && manejarAbrirNuevoOrden ? () => manejarAbrirNuevoOrden() : undefined
          }
          containerStyle={{ marginVertical: 24 }}
        />
      ) : (
        ordenesFiltradas.map((order) => {
          const esDraft = order.status === "borrador";
          const esAutomatica = Boolean(order.isAutoMinStock);
          const esBorradorAutoDestacado = esDraft && esAutomatica;
          const esRecibido = order.status === "recibida";
          const semaforo = obtenerEstiloSemaforoOrden(order.status, esAutomatica);

          return (
            <Tarjeta
              key={order.id}
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
              {/* ENCABEZADO COMPACTO DE LA ORDEN */}
              <View style={estilosLocales.ordenSuperior}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={estilosLocales.codigoInsigniasFila}>
                    <Text style={[estilosLocales.ordenCodigo, { fontSize: 15, fontWeight: "800" }]}>
                      {order.code}
                    </Text>

                    {esAutomatica ? (
                      <Insignia
                        label="OC Automática (Stock Mín.)"
                        tone="warn"
                        icon="flash-outline"
                        size="sm"
                      />
                    ) : (
                      <Insignia
                        label="OC Manual"
                        tone="mute"
                        icon="create-outline"
                        size="sm"
                      />
                    )}
                  </View>

                  <Text style={[estilosLocales.ordenProveedor, { marginTop: 3 }]}>
                    {order.supplier}
                    {order.supplierRut ? ` • RUT: ${order.supplierRut}` : ""}
                  </Text>
                  <Text style={estilosLocales.ordenFecha}>
                    📅 Emisión: {formatearFecha(order.date)} • Entrega est.:{" "}
                    {formatearFecha(order.expectedDate)}
                  </Text>
                </View>

                <Insignia
                  label={
                    order.status === "borrador"
                      ? "BORRADOR"
                      : order.status === "enviada"
                      ? "ENVIADA"
                      : order.status === "recibida_parcial"
                      ? "PARCIAL"
                      : order.status.toUpperCase()
                  }
                  tone={
                    order.status === "recibida"
                      ? "ok"
                      : order.status === "cerrada"
                      ? "mute"
                      : order.status === "enviada"
                      ? "info"
                      : order.status === "recibida_parcial"
                      ? "warn"
                      : order.status === "anulada"
                      ? "danger"
                      : "warn"
                  }
                  size="sm"
                />
              </View>

              {/* DETALLE COMPACTO DE ÍTEMS EN CAJA BLANCA LIMPIA */}
              <View
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: semaforo.divisorColor,
                  borderRadius: 9,
                  padding: 10,
                  marginTop: 8,
                  gap: 5,
                }}
              >
                {order.items.map((i, idx) => (
                  <View key={idx} style={estilosLocales.itemLineaFila}>
                    <Text style={estilosLocales.itemNombreTexto}>
                      • <Text style={{ fontWeight: "800" }}>{i.quantity} {i.unit}</Text> × {i.name}{" "}
                      <Text style={estilosLocales.itemSkuTexto}>({i.sku})</Text>
                    </Text>
                    <Text style={estilosLocales.itemSubtotalTexto}>
                      {formatearCLP(i.quantity * i.unitPrice)}
                    </Text>
                  </View>
                ))}
                {Boolean(order.notes) && (
                  <View style={[estilosLocales.notaReposicionFila, { marginTop: 2 }]}>
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={esAutomatica ? "#B45309" : "#6B7280"}
                    />
                    <Text
                      style={[
                        estilosLocales.ordenNotasTexto,
                        esAutomatica && {
                          color: "#92400E",
                          fontWeight: "600",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {order.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* PIE COMPACTO: MONTO TOTAL Y ACCIONES */}
              <View
                style={[
                  estilosLocales.ordenInferior,
                  { borderTopColor: semaforo.divisorColor, marginTop: 8, paddingTop: 8 },
                ]}
              >
                <View>
                  <Text style={estilosLocales.totalEtiqueta}>Total c/ IVA (19%):</Text>
                  <Text
                    style={[
                      estilosLocales.totalValor,
                      esBorradorAutoDestacado && { color: "#B45309" },
                    ]}
                  >
                    {formatearCLP(order.total)}
                  </Text>
                </View>

                <View style={estilosLocales.ordenBotonFila}>
                  {establecerPdfVistaPreviaOrden && (
                    <Boton
                      title="Ver PDF"
                      variant="outline"
                      size="sm"
                      icon="document-text-outline"
                      onPress={() => establecerPdfVistaPreviaOrden(order)}
                      style={{ minHeight: 34, backgroundColor: "#ffffff" }}
                    />
                  )}

                  {esDraft && rol === "admin" && manejarAbrirEditarOrden && (
                    <Boton
                      title="Editar"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarOrden(order)}
                      style={{ minHeight: 34, backgroundColor: "#ffffff" }}
                    />
                  )}

                  {esDraft && rol === "admin" && (
                    <Boton
                      title={esAutomatica ? "Aprobar OC Auto" : "Aprobar y Enviar"}
                      variant="success"
                      size="sm"
                      icon="checkmark-done-outline"
                      onPress={() => manejarAprobarOrden(order)}
                      style={{ minHeight: 34 }}
                    />
                  )}

                  {/* Calificar y Cerrar (cuando ya fue recibida) [H15] */}
                  {esRecibido &&
                    !order.rating &&
                    establecerTarifaModalOrden && (
                      <Boton
                        title="Calificar y Cerrar OC"
                        variant="success"
                        size="sm"
                        icon="star"
                        onPress={() => {
                          establecerTarifaModalOrden(order);
                          establecerCalificacionTiempo?.(5);
                          establecerCalificacionQuality?.(5);
                          establecerCalificacionPrecio?.(5);
                          establecerCalificacionComentario?.("");
                        }}
                        style={{ minHeight: 36, backgroundColor: "#15803d" }}
                      />
                    )}

                  {order.rating && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#fef3c7",
                        borderWidth: 1,
                        borderColor: "#fde68a",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Ionicons name="star" size={14} color="#d97706" />
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#92400e" }}>
                        ⭐ {order.rating.average} / 5.0
                      </Text>
                      <Text style={{ fontSize: 10, color: "#78350f" }} numberOfLines={1}>
                        • {order.rating.comment ? `"${order.rating.comment}"` : "Cerrada y evaluada"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Tarjeta>
          );
        })
      )}
    </View>
  );
};

const estilosLocales = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  heroTarjeta: {
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: 12,
    padding: 14,
  },
  heroContenido: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroIzquierda: {
    flex: 1,
    minWidth: 250,
  },
  heroInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  heroSubtexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  heroTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  heroDescripcion: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  heroBotonesGrupo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  botonSimularAuto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 40,
  },
  botonSimularAutoTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  alertaBorradoresAutoCaja: {
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
    borderColor: "#F59E0B",
    borderLeftWidth: 6,
    borderLeftColor: "#D97706",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  alertaBorradoresAutoIzquierda: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  alertaIconoCirculo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  alertaTituloFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  alertaBorradoresAutoTitulo: {
    fontSize: 14,
    fontWeight: "800",
    color: "#78350F",
  },
  badgeUrgente: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeUrgenteTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  alertaBorradoresAutoSub: {
    fontSize: 12,
    color: "#92400E",
  },
  alertaBotonesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  botonVerBorradoresAuto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  botonVerBorradoresAutoActivo: {
    backgroundColor: "#D97706",
    borderColor: "#B45309",
  },
  botonVerBorradoresAutoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  botonAprobarTodasAuto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  botonAprobarTodasAutoTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sinBorradoresAutoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  sinBorradoresAutoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
    flex: 1,
  },
  historialAprobacionCaja: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#16A34A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  historialEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historialTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
  },
  historialLimpiar: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    textDecorationLine: "underline",
  },
  historialFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#DCFCE7",
  },
  historialBadgeTipo: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historialBadgeTipoTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },
  historialDetalleTexto: {
    fontSize: 12,
    color: "#1F2937",
    flex: 1,
  },
  resumenGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  resumenCelda: {
    flex: 1,
    minWidth: 170,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
  },
  resumenCeldaDestacada: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
  },
  resumenCeldaSeleccionadaAuto: {
    borderColor: "#B45309",
    borderWidth: 2,
    backgroundColor: "#FEF3C7",
  },
  resumenCeldaSeleccionada: {
    borderColor: tema.colors.primary,
    borderWidth: 2,
    backgroundColor: "#EFF6FF",
  },
  resumenCeldaTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resumenNumeroDestacado: {
    fontSize: 22,
    fontWeight: "900",
    color: "#B45309",
  },
  resumenNumero: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  etiquetaMiniAuto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FDE68A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  etiquetaMiniAutoTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#92400E",
  },
  etiquetaMiniOrigenAuto: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  etiquetaMiniOrigenAutoTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#92400E",
  },
  etiquetaMiniOrigenManual: {
    backgroundColor: "#DBEAFE",
    borderColor: "#3B82F6",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  etiquetaMiniOrigenManualTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1E40AF",
  },
  resumenLabelDestacado: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78350F",
  },
  resumenLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  panelFiltrosCaja: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  buscadorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 10,
    gap: 8,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  filtroSeccionTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 6,
  },
  chipsFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  origenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
  },
  origenChipDestacado: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
  },
  origenChipActivo: {
    backgroundColor: "#1F2937",
    borderColor: "#111827",
  },
  origenChipDestacadoActivo: {
    backgroundColor: "#D97706",
    borderColor: "#B45309",
  },
  origenChipTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  estadoChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  estadoChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  estadoChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  estadoChipTextoActivo: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  limpiarChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  limpiarChipTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  ordenTarjeta: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderLeftWidth: 4,
    borderLeftColor: "#6B7280",
  },
  ordenTarjetaBorradorAuto: {
    backgroundColor: "#FFFDF5",
    borderWidth: 2,
    borderColor: "#F59E0B",
    borderLeftWidth: 6,
    borderLeftColor: "#D97706",
  },
  ordenTarjetaBorradorManual: {
    borderLeftWidth: 5,
    borderLeftColor: "#3B82F6",
  },
  cintaBorradorAuto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  cintaBorradorAutoIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  cintaBorradorAutoTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#78350F",
    letterSpacing: 0.3,
  },
  cintaPastillaPrioridad: {
    backgroundColor: "#B45309",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cintaPastillaPrioridadTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  ordenSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  codigoInsigniasFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  ordenCodigo: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  etiquetaOcAutomatica: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 3,
  },
  etiquetaOcAutomaticaTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
  },
  subEtiquetaStockMin: {
    backgroundColor: "#D97706",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    marginLeft: 2,
  },
  subEtiquetaStockMinTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  etiquetaOcManual: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DBEAFE",
    borderColor: "#60A5FA",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  etiquetaOcManualTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E40AF",
  },
  etiquetaPendienteAprobacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etiquetaPendienteAprobacionAuto: {
    backgroundColor: "#FEE2E2",
    borderColor: "#F87171",
  },
  etiquetaPendienteAprobacionTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
  },
  ordenProveedor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  ordenFecha: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  ordenElementosCaja: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  ordenElementosCajaAuto: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  itemLineaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    gap: 8,
  },
  itemNombreTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  itemSkuTexto: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  itemSubtotalTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  notaReposicionFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  ordenNotasTexto: {
    fontSize: 11,
    color: "#4B5563",
    flex: 1,
    lineHeight: 16,
  },
  ordenInferior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  totalEtiqueta: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  totalValor: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  ordenBotonFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  botonAprobarPrincipal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 38,
  },
  botonAprobarPrincipalAuto: {
    backgroundColor: "#059669",
    borderWidth: 1.5,
    borderColor: "#047857",
  },
  botonAprobarPrincipalTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

export default BandejaOrdenesCompra;
