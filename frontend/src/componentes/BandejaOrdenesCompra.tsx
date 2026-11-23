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

  return (
    <View style={estilosLocales.contenedor}>
      {/* 1. BANNER EJECUTIVO DE CREACIÓN Y GENERACIÓN AUTOMÁTICA */}
      {rol === "admin" && (
        <Tarjeta style={estilosLocales.heroTarjeta}>
          <View style={estilosLocales.heroContenido}>
            <View style={estilosLocales.heroIzquierda}>
              <View style={estilosLocales.heroInsigniaFila}>
                <Insignia label="Bandeja OC" tone="warn" size="sm" />
                <Text style={estilosLocales.heroSubtexto}>
                  Control de Órdenes Automáticas (Stock Mínimo) y Manuales
                </Text>
              </View>
              <Text style={estilosLocales.heroTitulo}>
                Bandeja de Órdenes de Compra y Aprobación de Borradores
              </Text>
              <Text style={estilosLocales.heroDescripcion}>
                Revisa y aprueba prioritariamente los borradores generados de forma automática por quiebre de stock mínimo, o emite órdenes manuales a proveedores.
              </Text>
            </View>

            <View style={estilosLocales.heroBotonesGrupo}>
              <TouchableOpacity
                onPress={manejarGenerarBorradorAutoStock}
                style={estilosLocales.botonSimularAuto}
                accessibilityRole="button"
                accessibilityLabel="Generar borrador automático por stock mínimo"
              >
                <Ionicons name="flash" size={16} color="#92400E" />
                <Text style={estilosLocales.botonSimularAutoTexto}>
                  + Generar Borrador OC Automática
                </Text>
              </TouchableOpacity>

              {manejarAbrirNuevoOrden && (
                <Boton
                  title="+ Nueva OC Manual"
                  variant="primary"
                  size="md"
                  icon="add-circle-outline"
                  onPress={() => manejarAbrirNuevoOrden()}
                />
              )}
            </View>
          </View>
        </Tarjeta>
      )}

      {/* 2. ALERTA DESTACADA DE BORRADORES AUTOMÁTICOS PENDIENTES DE APROBACIÓN */}
      {metricas.borradoresAuto.length > 0 ? (
        <View style={estilosLocales.alertaBorradoresAutoCaja}>
          <View style={estilosLocales.alertaBorradoresAutoIzquierda}>
            <View style={estilosLocales.alertaIconoCirculo}>
              <Ionicons name="flash" size={20} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={estilosLocales.alertaTituloFila}>
                <Text style={estilosLocales.alertaBorradoresAutoTitulo}>
                  ⚡ {metricas.borradoresAuto.length}{" "}
                  {metricas.borradoresAuto.length === 1
                    ? "Borrador de OC Automática pendiente de aprobación"
                    : "Borradores de OC Automáticas pendientes de aprobación"}
                </Text>
                <View style={estilosLocales.badgeUrgente}>
                  <Text style={estilosLocales.badgeUrgenteTexto}>
                    ACCIÓN REQUERIDA
                  </Text>
                </View>
              </View>
              <Text style={estilosLocales.alertaBorradoresAutoSub}>
                Generados automáticamente por alerta de stock mínimo • Monto total por aprobar:{" "}
                <Text style={{ fontWeight: "800", color: "#78350F" }}>
                  {formatearCLP(metricas.montoBorradoresAuto)}
                </Text>
              </Text>
            </View>
          </View>

          <View style={estilosLocales.alertaBotonesFila}>
            <TouchableOpacity
              onPress={() => {
                if (filtroOrigen === "borradores_auto") {
                  establecerFiltroOrigen("todos");
                } else {
                  cambiarFiltroEstado("todas");
                  establecerFiltroOrigen("borradores_auto");
                }
              }}
              style={[
                estilosLocales.botonVerBorradoresAuto,
                filtroOrigen === "borradores_auto" &&
                  estilosLocales.botonVerBorradoresAutoActivo,
              ]}
            >
              <Ionicons
                name="funnel-outline"
                size={14}
                color={filtroOrigen === "borradores_auto" ? "#FFFFFF" : "#92400E"}
              />
              <Text
                style={[
                  estilosLocales.botonVerBorradoresAutoTexto,
                  filtroOrigen === "borradores_auto" && { color: "#FFFFFF" },
                ]}
              >
                {filtroOrigen === "borradores_auto"
                  ? "Mostrando solo borradores auto (Ver todas)"
                  : "Filtrar Borradores Automáticos"}
              </Text>
            </TouchableOpacity>

            {rol === "admin" && metricas.borradoresAuto.length > 1 && (
              <TouchableOpacity
                onPress={manejarAprobarTodosBorradoresAuto}
                style={estilosLocales.botonAprobarTodasAuto}
              >
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={estilosLocales.botonAprobarTodasAutoTexto}>
                  Aprobar Todas ({metricas.borradoresAuto.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={estilosLocales.sinBorradoresAutoBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={estilosLocales.sinBorradoresAutoTexto}>
            Al día: Todos los borradores de Órdenes de Compra automáticas han sido aprobados y enviados.
          </Text>
        </View>
      )}

      {/* 3. HISTORIAL EN PANTALLA DE ÓRDENES APROBADAS EN ESTA SESIÓN ([SCRUM]) */}
      {aprobacionesRecientes.length > 0 && (
        <View style={estilosLocales.historialAprobacionCaja}>
          <View style={estilosLocales.historialEncabezado}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="checkmark-done-circle" size={17} color="#065F46" />
              <Text style={estilosLocales.historialTitulo}>
                Órdenes Aprobadas Recientemente en Pantalla ({aprobacionesRecientes.length})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => establecerAprobacionesRecientes([])}
            >
              <Text style={estilosLocales.historialLimpiar}>Ocultar</Text>
            </TouchableOpacity>
          </View>
          {aprobacionesRecientes.slice(0, 4).map((reg) => (
            <View key={reg.id} style={estilosLocales.historialFila}>
              <View style={estilosLocales.historialBadgeTipo}>
                <Text style={estilosLocales.historialBadgeTipoTexto}>
                  {reg.esAutomatica ? "⚡ OC AUTOMÁTICA" : "✍️ OC MANUAL"}
                </Text>
              </View>
              <Text style={estilosLocales.historialDetalleTexto}>
                <Text style={{ fontWeight: "800" }}>{reg.codigoOc}</Text> •{" "}
                {reg.proveedor} ({formatearCLP(reg.total)}) →{" "}
                <Text style={{ color: "#059669", fontWeight: "800" }}>
                  APROBADA Y ENVIADA ({reg.hora})
                </Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 4. TARJETAS RESUMEN DE DISTINCIÓN: AUTOMÁTICAS VS MANUALES */}
      <View style={estilosLocales.resumenGrilla}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            cambiarFiltroEstado("todas");
            establecerFiltroOrigen(
              filtroOrigen === "borradores_auto" ? "todos" : "borradores_auto"
            );
          }}
          style={[
            estilosLocales.resumenCelda,
            estilosLocales.resumenCeldaDestacada,
            filtroOrigen === "borradores_auto" &&
              estilosLocales.resumenCeldaSeleccionadaAuto,
          ]}
        >
          <View style={estilosLocales.resumenCeldaTop}>
            <Text style={estilosLocales.resumenNumeroDestacado}>
              {metricas.borradoresAuto.length}
            </Text>
            <View style={estilosLocales.etiquetaMiniAuto}>
              <Ionicons name="flash" size={11} color="#92400E" />
              <Text style={estilosLocales.etiquetaMiniAutoTexto}>
                PENDIENTE APROBACIÓN
              </Text>
            </View>
          </View>
          <Text style={estilosLocales.resumenLabelDestacado}>
            Borradores OC Automáticas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            establecerFiltroOrigen(
              filtroOrigen === "automatica" ? "todos" : "automatica"
            )
          }
          style={[
            estilosLocales.resumenCelda,
            filtroOrigen === "automatica" &&
              estilosLocales.resumenCeldaSeleccionada,
          ]}
        >
          <View style={estilosLocales.resumenCeldaTop}>
            <Text style={estilosLocales.resumenNumero}>
              {metricas.totalAutomaticas.length}
            </Text>
            <View style={estilosLocales.etiquetaMiniOrigenAuto}>
              <Text style={estilosLocales.etiquetaMiniOrigenAutoTexto}>
                ⚡ AUTOMÁTICAS
              </Text>
            </View>
          </View>
          <Text style={estilosLocales.resumenLabel}>
            Total OC por Stock Mínimo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            establecerFiltroOrigen(
              filtroOrigen === "manual" ? "todos" : "manual"
            )
          }
          style={[
            estilosLocales.resumenCelda,
            filtroOrigen === "manual" &&
              estilosLocales.resumenCeldaSeleccionada,
          ]}
        >
          <View style={estilosLocales.resumenCeldaTop}>
            <Text style={estilosLocales.resumenNumero}>
              {metricas.totalManuales.length}
            </Text>
            <View style={estilosLocales.etiquetaMiniOrigenManual}>
              <Text style={estilosLocales.etiquetaMiniOrigenManualTexto}>
                ✍️ MANUALES
              </Text>
            </View>
          </View>
          <Text style={estilosLocales.resumenLabel}>
            Total OC Emitidas Manualmente
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. BARRA DE BÚSQUEDA Y FILTROS DE ORIGEN Y ESTADO */}
      <View style={estilosLocales.panelFiltrosCaja}>
        {/* Buscador */}
        <View style={estilosLocales.buscadorCaja}>
          <Ionicons name="search-outline" size={17} color="#6B7280" />
          <TextInput
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar por código OC (ej. OC-2026-105), proveedor, insumo o etiqueta 'automática' / 'manual'..."
            placeholderTextColor="#9CA3AF"
            style={estilosLocales.buscadorInput}
          />
          {Boolean(busqueda) && (
            <Pressable onPress={() => establecerBusqueda("")}>
              <Ionicons name="close-circle" size={17} color="#6B7280" />
            </Pressable>
          )}
        </View>

        {/* Filtro 1: Origen de la Orden (Automática vs Manual) */}
        <View style={{ marginBottom: 8 }}>
          <Text style={estilosLocales.filtroSeccionTitulo}>
            1. Filtrar por origen de generación (Automática vs Manual):
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilosLocales.chipsFila}
          >
            {[
              {
                id: "todos" as FiltroOrigenOrden,
                label: `Todas (${ordenesTotales.length})`,
                icon: "layers-outline",
              },
              {
                id: "borradores_auto" as FiltroOrigenOrden,
                label: `⚡ Borradores Automáticos Pendientes (${metricas.borradoresAuto.length})`,
                icon: "flash",
                destacado: true,
              },
              {
                id: "automatica" as FiltroOrigenOrden,
                label: `⚡ OC Automáticas (${metricas.totalAutomaticas.length})`,
                icon: "hardware-chip-outline",
              },
              {
                id: "manual" as FiltroOrigenOrden,
                label: `✍️ OC Manuales (${metricas.totalManuales.length})`,
                icon: "create-outline",
              },
            ].map((item) => {
              const activo = filtroOrigen === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => establecerFiltroOrigen(item.id)}
                  style={[
                    estilosLocales.origenChip,
                    item.destacado && estilosLocales.origenChipDestacado,
                    activo &&
                      (item.destacado
                        ? estilosLocales.origenChipDestacadoActivo
                        : estilosLocales.origenChipActivo),
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={14}
                    color={
                      activo
                        ? "#FFFFFF"
                        : item.destacado
                        ? "#B45309"
                        : "#374151"
                    }
                  />
                  <Text
                    style={[
                      estilosLocales.origenChipTexto,
                      item.destacado && { color: "#92400E", fontWeight: "800" },
                      activo && { color: "#FFFFFF", fontWeight: "800" },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filtro 2: Estado de la Orden */}
        <View>
          <Text style={estilosLocales.filtroSeccionTitulo}>
            2. Filtrar por estado del pedido:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilosLocales.chipsFila}
          >
            {[
              { id: "todas", label: "Todos los estados" },
              {
                id: "borrador",
                label: `Borradores / Pendientes (${
                  ordenesTotales.filter((o) => o.status === "borrador").length
                })`,
              },
              {
                id: "enviada",
                label: `Aprobadas / Enviadas (${
                  ordenesTotales.filter((o) => o.status === "enviada").length
                })`,
              },
              {
                id: "recibida_parcial",
                label: "Recibida Parcial",
              },
              {
                id: "recibida",
                label: "Recibida Conforme",
              },
              {
                id: "cerrada",
                label: "Cerrada",
              },
            ].map((st) => {
              const activo = filtroEstado === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => cambiarFiltroEstado(st.id)}
                  style={[
                    estilosLocales.estadoChip,
                    activo && estilosLocales.estadoChipActivo,
                  ]}
                >
                  <Text
                    style={[
                      estilosLocales.estadoChipTexto,
                      activo && estilosLocales.estadoChipTextoActivo,
                    ]}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {(filtroEstado !== "todas" ||
              filtroOrigen !== "todos" ||
              Boolean(busqueda)) && (
              <TouchableOpacity
                onPress={() => {
                  cambiarFiltroEstado("todas");
                  establecerFiltroOrigen("todos");
                  establecerBusqueda("");
                }}
                style={estilosLocales.limpiarChip}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={14}
                  color="#DC2626"
                />
                <Text style={estilosLocales.limpiarChipTexto}>
                  Restablecer filtros
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>

      {/* 6. LISTADO DE TARJETAS DE ÓRDENES DE COMPRA */}
      {ordenesFiltradas.length === 0 ? (
        <EstadoVacio
          icon="cart-outline"
          title="No se encontraron órdenes de compra"
          description="No existen órdenes que coincidan con los filtros seleccionados."
          actionTitle={
            rol === "admin" ? "+ Generar Borrador OC Automática" : undefined
          }
          onAction={
            rol === "admin" ? manejarGenerarBorradorAutoStock : undefined
          }
          containerStyle={{ marginVertical: 24 }}
        />
      ) : (
        ordenesFiltradas.map((order) => {
          const esDraft = order.status === "borrador";
          const esAutomatica = Boolean(order.isAutoMinStock);
          const esBorradorAutoDestacado = esDraft && esAutomatica;
          const esRecibido = order.status === "recibida";

          return (
            <Tarjeta
              key={order.id}
              variant="elevated"
              style={[
                estilosLocales.ordenTarjeta,
                esBorradorAutoDestacado &&
                  estilosLocales.ordenTarjetaBorradorAuto,
                esDraft && !esAutomatica && estilosLocales.ordenTarjetaBorradorManual,
              ]}
            >
              {/* CINTA SUPERIOR EXCLUSIVA PARA BORRADORES AUTOMÁTICOS PENDIENTES DE APROBACIÓN */}
              {esBorradorAutoDestacado && (
                <View style={estilosLocales.cintaBorradorAuto}>
                  <View style={estilosLocales.cintaBorradorAutoIzquierda}>
                    <Ionicons name="flash" size={15} color="#78350F" />
                    <Text style={estilosLocales.cintaBorradorAutoTexto}>
                      BORRADOR GENERADO AUTOMÁTICAMENTE POR STOCK MÍNIMO • PENDIENTE DE APROBACIÓN
                    </Text>
                  </View>
                  <View style={estilosLocales.cintaPastillaPrioridad}>
                    <Text style={estilosLocales.cintaPastillaPrioridadTexto}>
                      PRIORITARIO
                    </Text>
                  </View>
                </View>
              )}

              {/* ENCABEZADO DE LA ORDEN CON ETIQUETAS EXPLÍCITAS DE ORIGEN Y ESTADO */}
              <View style={estilosLocales.ordenSuperior}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={estilosLocales.codigoInsigniasFila}>
                    <Text style={estilosLocales.ordenCodigo}>{order.code}</Text>

                    {/* [SCRUM] ETIQUETA EXPLÍCITA DE OC AUTOMÁTICA VS OC MANUAL */}
                    {esAutomatica ? (
                      <View
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel="Etiqueta: OC Automática generada por stock mínimo"
                        style={estilosLocales.etiquetaOcAutomatica}
                      >
                        <Ionicons name="flash" size={13} color="#92400E" />
                        <Text style={estilosLocales.etiquetaOcAutomaticaTexto}>
                          OC Automática
                        </Text>
                        <View style={estilosLocales.subEtiquetaStockMin}>
                          <Text style={estilosLocales.subEtiquetaStockMinTexto}>
                            Stock Mínimo
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel="Etiqueta: OC Manual emitida por usuario"
                        style={estilosLocales.etiquetaOcManual}
                      >
                        <Ionicons
                          name="create-outline"
                          size={13}
                          color="#1E40AF"
                        />
                        <Text style={estilosLocales.etiquetaOcManualTexto}>
                          OC Manual
                        </Text>
                      </View>
                    )}

                    {/* Insignia adicional cuando está pendiente de aprobación */}
                    {esDraft && (
                      <View
                        style={[
                          estilosLocales.etiquetaPendienteAprobacion,
                          esAutomatica &&
                            estilosLocales.etiquetaPendienteAprobacionAuto,
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={esAutomatica ? "#991B1B" : "#374151"}
                        />
                        <Text
                          style={[
                            estilosLocales.etiquetaPendienteAprobacionTexto,
                            esAutomatica && { color: "#991B1B" },
                          ]}
                        >
                          Pendiente de Aprobación
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={estilosLocales.ordenProveedor}>
                    {order.supplier}
                    {order.supplierRut ? ` • RUT: ${order.supplierRut}` : ""}
                  </Text>
                  <Text style={estilosLocales.ordenFecha}>
                    Emisión: {formatearFecha(order.date)} • Entrega estimada:{" "}
                    {formatearFecha(order.expectedDate)}
                  </Text>
                </View>

                {/* Insignia de estado del ciclo de vida */}
                <Insignia
                  label={
                    order.status === "borrador"
                      ? "BORRADOR"
                      : order.status === "enviada"
                      ? "APROBADA Y ENVIADA"
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
                      : esAutomatica
                      ? "warn"
                      : "mute"
                  }
                />
              </View>

              {/* DETALLE DE ÍTEMS Y NOTAS DE REPOSICIÓN */}
              <View
                style={[
                  estilosLocales.ordenElementosCaja,
                  esBorradorAutoDestacado &&
                    estilosLocales.ordenElementosCajaAuto,
                ]}
              >
                {order.items.map((i, idx) => (
                  <View key={idx} style={estilosLocales.itemLineaFila}>
                    <Text style={estilosLocales.itemNombreTexto}>
                      • {i.quantity} {i.unit} × {i.name}{" "}
                      <Text style={estilosLocales.itemSkuTexto}>({i.sku})</Text>
                    </Text>
                    <Text style={estilosLocales.itemSubtotalTexto}>
                      {formatearCLP(i.quantity * i.unitPrice)}
                    </Text>
                  </View>
                ))}
                {Boolean(order.notes) && (
                  <View style={estilosLocales.notaReposicionFila}>
                    <Ionicons
                      name={
                        esAutomatica
                          ? "information-circle"
                          : "document-text-outline"
                      }
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
                    >
                      {order.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* PIE DE TARJETA: MONTO TOTAL Y BOTONES DE ACCIÓN ([SCRUM] APRUEBA LA OC) */}
              <View style={estilosLocales.ordenInferior}>
                <View>
                  <Text style={estilosLocales.totalEtiqueta}>
                    Total c/ IVA (19%):
                  </Text>
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
                  {/* Vista Previa PDF */}
                  {establecerPdfVistaPreviaOrden && (
                    <Boton
                      title="Vista Previa PDF"
                      variant="outline"
                      size="sm"
                      icon="document-text-outline"
                      onPress={() => establecerPdfVistaPreviaOrden(order)}
                    />
                  )}

                  {/* Editar: disponible en borrador para Admin */}
                  {esDraft && rol === "admin" && manejarAbrirEditarOrden && (
                    <Boton
                      title="Editar Borrador"
                      variant="secondary"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarOrden(order)}
                    />
                  )}

                  {/* [SCRUM] Botón Aprobar OC Automática / Manual y Enviar */}
                  {esDraft && rol === "admin" && (
                    <TouchableOpacity
                      onPress={() => manejarAprobarOrden(order)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        esAutomatica
                          ? `Aprobar OC Automática ${order.code} y enviar a proveedor`
                          : `Aprobar OC Manual ${order.code} y enviar a proveedor`
                      }
                      style={[
                        estilosLocales.botonAprobarPrincipal,
                        esAutomatica &&
                          estilosLocales.botonAprobarPrincipalAuto,
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text style={estilosLocales.botonAprobarPrincipalTexto}>
                        {esAutomatica
                          ? "Aprobar OC Automática y Enviar"
                          : "Aprobar y Enviar"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Calificar y Cerrar (cuando ya fue recibida) */}
                  {esRecibido &&
                    !order.rating &&
                    establecerTarifaModalOrden && (
                      <Boton
                        title="Calificar y Cerrar"
                        variant="success"
                        size="sm"
                        icon="star-outline"
                        onPress={() => {
                          establecerTarifaModalOrden(order);
                          establecerCalificacionTiempo?.(5);
                          establecerCalificacionQuality?.(5);
                          establecerCalificacionPrecio?.(5);
                          establecerCalificacionComentario?.("");
                        }}
                      />
                    )}

                  {order.rating && (
                    <Insignia
                      label={`⭐ ${order.rating.average}/5 (${
                        order.rating.comment || "Calificado"
                      })`}
                      tone="ok"
                      size="sm"
                    />
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
