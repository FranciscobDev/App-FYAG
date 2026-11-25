import React, { useEffect, useRef, useState } from "react";
import { Selector } from "@/componentes/formularios/Selector";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  DialogoConfirmacion,
  EstadoVacio,
  BotonExportar,
  CampoTexto,
  VistaModal,
  CampoNumero,
  EncabezadoPagina,
  BarraProgreso,
  ModalEscanerQr,
  CeldaStock,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  MovimientoCardex,
  SolicitudMaterial,
  ItemSolicitudMaterial,
  ConteoFisico,
  Producto,
  RegistroMerma,
} from "@/nucleo/tipos";
import { estilos, UNIDADES_PRODUCTO } from "../estilos";
import { RangoFechaCardex } from "../cardexExcel";
import { SeccionCardexSoloLectura } from "./SeccionCardexSoloLectura";
import { SeccionQrInsumosAdmin } from "./SeccionQrInsumosAdmin";

export interface PropiedadesSeccionCatalogoCardex {
  abrirEscaner: any;
  activoPestana: any;
  alternarProductoDeshabilitado: any;
  buscarQuery: any;
  cardexCompleto?: any;
  establecerBuscarQuery: any;
  establecerKardexFechaRango?: any;
  establecerKardexFiltrarProyecto: any;
  establecerKardexFiltrarSku: any;
  establecerKardexFiltrarTipo: any;
  filtradoCardex: any;
  filtradoProductos: any;
  kardexFechaRango?: any;
  kardexFiltrarProyecto: any;
  kardexFiltrarSku: any;
  kardexFiltrarTipo: any;
  manejarAbrirCardexProducto?: any;
  manejarAbrirEditarProducto: any;
  manejarAbrirInsumoForm?: any;
  manejarAbrirNuevoProducto: any;
  manejarExportarCardex: any;
  mostrarAviso: any;
  productos?: any;
  proyectos: any;
  rolActual: any;
}

export const SeccionCatalogoCardex: React.FC<PropiedadesSeccionCatalogoCardex> = ({
  abrirEscaner,
  activoPestana,
  alternarProductoDeshabilitado,
  buscarQuery,
  cardexCompleto,
  establecerBuscarQuery,
  establecerKardexFechaRango,
  establecerKardexFiltrarProyecto,
  establecerKardexFiltrarSku,
  establecerKardexFiltrarTipo,
  filtradoCardex,
  filtradoProductos,
  kardexFechaRango = "todos",
  kardexFiltrarProyecto,
  kardexFiltrarSku,
  kardexFiltrarTipo,
  manejarAbrirCardexProducto,
  manejarAbrirEditarProducto,
  manejarAbrirInsumoForm,
  manejarAbrirNuevoProducto,
  manejarExportarCardex,
  mostrarAviso,
  productos = [],
  proyectos,
  rolActual,
}) => {
  const [modoVista, setModoVista] = useState<"tarjetas" | "qr">("tarjetas");
  const [filtroSemaforo, setFiltroSemaforo] = useState<
    "todos" | "en_stock" | "por_acabar" | "sin_stock" | "archivados"
  >("todos");

  const conteoSemaforo = React.useMemo(() => {
    const base = filtradoProductos || [];
    let activosTotal = 0;
    let enStock = 0;
    let porAcabar = 0;
    let sinStock = 0;
    let archivados = 0;
    base.forEach((p: any) => {
      if (p.disabled) {
        archivados += 1;
        return;
      }
      activosTotal += 1;
      if (p.stock <= 0) sinStock += 1;
      else if (p.stock <= p.minStock) porAcabar += 1;
      else enStock += 1;
    });
    return { total: activosTotal, enStock, porAcabar, sinStock, archivados };
  }, [filtradoProductos]);

  const productosFiltradosSemaforo = React.useMemo(() => {
    const base = filtradoProductos || [];
    if (filtroSemaforo === "archivados") {
      return base.filter((p: any) => Boolean(p.disabled));
    }
    const activos = base.filter((p: any) => !p.disabled);
    if (filtroSemaforo === "sin_stock") return activos.filter((p: any) => p.stock <= 0);
    if (filtroSemaforo === "por_acabar") return activos.filter((p: any) => p.stock > 0 && p.stock <= p.minStock);
    if (filtroSemaforo === "en_stock") return activos.filter((p: any) => p.stock > p.minStock);
    return activos;
  }, [filtradoProductos, filtroSemaforo]);

  const obtenerEstiloSemaforoTarjeta = (stock: number, minStock: number, disabled?: boolean) => {
    if (disabled) {
      return {
        fondoTarjeta: "#f1f5f9",
        bordeTarjeta: "#cbd5e1",
        franjaLateral: "#64748b",
        badgeFondo: "#e2e8f0",
        badgeBorde: "#94a3b8",
        colorTexto: "#334155",
        colorPunto: "#64748b",
        etiquetaEstado: "Archivado",
        divisorColor: "#e2e8f0",
      };
    }
    if (stock <= 0) {
      return {
        fondoTarjeta: "#fef2f2",
        bordeTarjeta: "#fca5a5",
        franjaLateral: "#dc2626",
        badgeFondo: "#fee2e2",
        badgeBorde: "#f87171",
        colorTexto: "#991b1b",
        colorPunto: "#dc2626",
        etiquetaEstado: "Sin Stock",
        divisorColor: "#fecaca",
      };
    }
    if (stock <= minStock) {
      return {
        fondoTarjeta: "#fffbeb",
        bordeTarjeta: "#fcd34d",
        franjaLateral: "#d97706",
        badgeFondo: "#fef3c7",
        badgeBorde: "#f59e0b",
        colorTexto: "#92400e",
        colorPunto: "#d97706",
        etiquetaEstado: "Por Acabar",
        divisorColor: "#fde68a",
      };
    }
    return {
      fondoTarjeta: "#f0fdf4",
      bordeTarjeta: "#86efac",
      franjaLateral: "#16a34a",
      badgeFondo: "#dcfce7",
      badgeBorde: "#4ade80",
      colorTexto: "#166534",
      colorPunto: "#16a34a",
      etiquetaEstado: "En Stock",
      divisorColor: "#bbf7d0",
    };
  };

  return (
    <>
      {/* =====================================================================
          1. TAB CATALOGO
          ===================================================================== */}
      {activoPestana === "catalogo" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* Barra de alternancia de vista: Vista Tarjetas / Códigos QR */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModoVista("tarjetas")}
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: modoVista === "tarjetas" ? tema.colors.primary : "#cbd5e1",
                    backgroundColor: modoVista === "tarjetas" ? tema.colors.primaryLight : "#ffffff",
                  },
                ]}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={modoVista === "tarjetas" ? tema.colors.primaryDark : "#64748b"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: modoVista === "tarjetas" ? tema.colors.primaryDark : "#475569",
                  }}
                >
                  Vista Tarjetas
                </Text>
              </TouchableOpacity>

              {rolActual === "admin" && (
                <TouchableOpacity
                  onPress={() => setModoVista("qr")}
                  style={[
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: modoVista === "qr" ? tema.colors.primary : "#cbd5e1",
                      backgroundColor: modoVista === "qr" ? tema.colors.primaryLight : "#ffffff",
                    },
                  ]}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={modoVista === "qr" ? tema.colors.primaryDark : "#64748b"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: modoVista === "qr" ? tema.colors.primaryDark : "#475569",
                    }}
                  >
                    Códigos QR
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {modoVista === "qr" && rolActual === "admin" ? (
            <SeccionQrInsumosAdmin
              productos={productos || filtradoProductos || []}
              mostrarAviso={mostrarAviso}
            />
          ) : (
            <>
              <View style={estilos.superiorCatalogBarra}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 220 }}>
                  <View style={estilos.buscarEnvoltorio}>
                    <Ionicons name="search-outline" size={18} color={tema.colors.textMuted} style={estilos.buscarIcono} />
                    <TextInput
                      value={buscarQuery}
                      onChangeText={establecerBuscarQuery}
                      placeholder="Buscar por SKU o nombre..."
                      placeholderTextColor={tema.colors.textLight}
                      style={estilos.buscarEntrada}
                    />
                    {Boolean(buscarQuery) && (
                      <Pressable onPress={() => establecerBuscarQuery("")} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
                      </Pressable>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      abrirEscaner("Escanear SKU para Buscar", (code: any) => {
                        establecerBuscarQuery(code);
                      })
                    }
                    style={estilos.escanearRapidoBoton}
                    accessibilityLabel="Escanear código de barras o QR"
                  >
                    <Ionicons name="barcode-outline" size={20} color={tema.colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Botón «Nuevo insumo» y «Registro Rápido» SOLO Admin */}
                {rolActual === "admin" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: "100%", flexGrow: 1 }}>
                    <Boton
                      title="Nuevo insumo"
                      variant="primary"
                      size="sm"
                      icon="add-outline"
                      onPress={manejarAbrirNuevoProducto}
                      style={{ flex: 1, minHeight: 42 }}
                    />
                    {Boolean(manejarAbrirInsumoForm) && (
                      <Boton
                        title="Registro Rápido"
                        variant="outline"
                        size="sm"
                        icon="document-text-outline"
                        onPress={manejarAbrirInsumoForm}
                        style={{ flex: 1, minHeight: 42 }}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Barra rápida de filtro por Semáforo de Stock */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {[
                  {
                    id: "todos" as const,
                    label: `Todos (${conteoSemaforo.total})`,
                    dotColor: tema.colors.text,
                    bgActive: tema.colors.surfaceAlt,
                    borderActive: tema.colors.textSecondary,
                    textActive: tema.colors.text,
                  },
                  {
                    id: "en_stock" as const,
                    label: `En Stock (${conteoSemaforo.enStock})`,
                    dotColor: "#16a34a",
                    bgActive: "#dcfce7",
                    borderActive: "#16a34a",
                    textActive: "#166534",
                  },
                  {
                    id: "por_acabar" as const,
                    label: `Por Acabar (${conteoSemaforo.porAcabar})`,
                    dotColor: "#d97706",
                    bgActive: "#fef3c7",
                    borderActive: "#d97706",
                    textActive: "#92400e",
                  },
                  {
                    id: "sin_stock" as const,
                    label: `Sin Stock (${conteoSemaforo.sinStock})`,
                    dotColor: "#dc2626",
                    bgActive: "#fee2e2",
                    borderActive: "#dc2626",
                    textActive: "#991b1b",
                  },
                  {
                    id: "archivados" as const,
                    label: `Archivados (${conteoSemaforo.archivados})`,
                    dotColor: "#64748b",
                    bgActive: "#e2e8f0",
                    borderActive: "#475569",
                    textActive: "#0f172a",
                  },
                ].map((chip) => {
                  const activo = filtroSemaforo === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      onPress={() => setFiltroSemaforo(chip.id)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        backgroundColor: activo ? chip.bgActive : "#ffffff",
                        borderColor: activo ? chip.borderActive : tema.colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: chip.dotColor,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: activo ? "700" : "600",
                          color: activo ? chip.textActive : tema.colors.textSecondary,
                        }}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {productosFiltradosSemaforo.length === 0 ? (
                <EstadoVacio
                  icon={filtroSemaforo === "archivados" ? "archive-outline" : "cube-outline"}
                  title={
                    filtroSemaforo === "archivados"
                      ? "No hay insumos archivados"
                      : "No se encontraron insumos"
                  }
                  description={
                    buscarQuery
                      ? `No existen coincidencias para "${buscarQuery}".`
                      : filtroSemaforo === "archivados"
                      ? "Los insumos que deshabilites o archives se moverán automáticamente a esta bandeja."
                      : "No hay insumos activos en este estado del semáforo."
                  }
                  actionTitle={rolActual === "admin" && filtroSemaforo !== "archivados" ? "Nuevo Insumo" : undefined}
                  onAction={rolActual === "admin" && filtroSemaforo !== "archivados" ? manejarAbrirNuevoProducto : undefined}
                  containerStyle={{ marginVertical: 20 }}
                />
              ) : (
                productosFiltradosSemaforo.map((p: any) => {
                  const semaforo = obtenerEstiloSemaforoTarjeta(p.stock, p.minStock, p.disabled);
                  const tieneComprometidoOCuarentena =
                    Number(p.committed || 0) > 0 || Number(p.quarantine || 0) > 0;

                  return (
                    <Tarjeta
                      key={p.sku}
                      variant="outlined"
                      style={[
                        {
                          marginBottom: 10,
                          padding: 12,
                          backgroundColor: semaforo.fondoTarjeta,
                          borderColor: semaforo.bordeTarjeta,
                          borderWidth: 1.5,
                          borderLeftWidth: 6,
                          borderLeftColor: semaforo.franjaLateral,
                          borderRadius: 12,
                        },
                      ]}
                    >
                      {/* FILA 1: Cabecera Compacta (SKU + Nombre a la izquierda / Bloque Semáforo + PMP a la derecha) */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: semaforo.colorTexto,
                                letterSpacing: 0.3,
                              }}
                            >
                              {p.sku}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: semaforo.badgeFondo,
                                borderColor: semaforo.badgeBorde,
                                borderWidth: 1,
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 999,
                                gap: 4,
                              }}
                            >
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: semaforo.colorPunto,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "800",
                                  color: semaforo.colorTexto,
                                }}
                              >
                                {semaforo.etiquetaEstado}
                              </Text>
                            </View>
                            {p.isBulk && (
                              <Insignia label="Granel" tone="info" size="sm" />
                            )}
                            {p.disabled && (
                              <Insignia label="Deshabilitado" tone="mute" size="sm" />
                            )}
                          </View>

                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: tema.colors.text,
                              marginTop: 3,
                              lineHeight: 19,
                            }}
                            numberOfLines={2}
                          >
                            {p.name}
                          </Text>

                          <Text
                            style={{
                              fontSize: 11,
                              color: tema.colors.textSecondary,
                              marginTop: 2,
                            }}
                            numberOfLines={1}
                          >
                            📍 {p.location} • {p.category}
                            {p.defaultSupplier ? ` • ${p.defaultSupplier}` : ""}
                          </Text>
                        </View>

                        {/* Caja derecha del Semáforo: Stock grande + Mínimo + PMP en un solo bloque compacto */}
                        <View
                          style={{
                            alignItems: "flex-end",
                            backgroundColor: "#ffffff",
                            borderWidth: 1,
                            borderColor: semaforo.bordeTarjeta,
                            borderRadius: 9,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            minWidth: 104,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "900",
                              color: semaforo.colorTexto,
                            }}
                          >
                            {p.stock} {p.unit}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "600",
                              color: tema.colors.textMuted,
                              marginTop: 1,
                            }}
                          >
                            Mín: {p.minStock} {p.unit}
                            {tieneComprometidoOCuarentena
                              ? ` • Comp: ${p.committed || 0}`
                              : ""}
                          </Text>
                          {rolActual === "admin" && (
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: tema.colors.text,
                                marginTop: 3,
                              }}
                            >
                              PMP: {formatearCLP(p.pmp || p.unitCost)}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Granel - Barra ultra compacta de capacidad restante si aplica */}
                      {p.isBulk && p.containerCapacity && (
                        <View style={{ marginTop: 6 }}>
                          <BarraProgreso
                            value={p.stock}
                            max={p.containerCapacity}
                            height={5}
                            showPercentage
                            semaforo
                            label={`Contenedor (${p.stock.toFixed(1)} / ${p.containerCapacity} ${p.unit})`}
                          />
                        </View>
                      )}

                      {/* FILA 2: Acciones compactas en 1 sola línea */}
                      {rolActual === "admin" ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: semaforo.divisorColor,
                          }}
                        >
                          <Boton
                            title="Cardex"
                            variant="outline"
                            size="sm"
                            icon="swap-horizontal-outline"
                            onPress={() => manejarAbrirCardexProducto && manejarAbrirCardexProducto(p)}
                            style={{ flex: 1, minHeight: 32, paddingVertical: 4, backgroundColor: "#ffffff" }}
                          />
                          <Boton
                            title="Editar"
                            variant="outline"
                            size="sm"
                            icon="create-outline"
                            onPress={() => manejarAbrirEditarProducto(p)}
                            style={{ flex: 1, minHeight: 32, paddingVertical: 4, backgroundColor: "#ffffff" }}
                          />
                          <Boton
                            title={p.disabled ? "Restaurar" : "Archivar"}
                            variant={p.disabled ? "success" : "outline"}
                            size="sm"
                            icon={p.disabled ? "refresh-outline" : "archive-outline"}
                            style={{
                              flex: 1.1,
                              minHeight: 32,
                              paddingVertical: 4,
                              backgroundColor: p.disabled ? undefined : "#ffffff",
                            }}
                            onPress={() => {
                              alternarProductoDeshabilitado(p.sku);
                              mostrarAviso(
                                `Insumo ${p.sku} ${
                                  p.disabled
                                    ? "restaurado al catálogo activo."
                                    : "movido a Archivados."
                                }`
                              );
                            }}
                          />
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 8,
                            paddingTop: 6,
                            borderTopWidth: 1,
                            borderTopColor: semaforo.divisorColor,
                          }}
                        >
                          <Text style={estilos.bodegaUbicacionNota}>
                            📍 <Text style={{ fontWeight: "bold", color: tema.colors.text }}>{p.location}</Text>
                          </Text>
                          <Boton
                            title="Ver Cardex"
                            variant="ghost"
                            size="sm"
                            icon="swap-horizontal-outline"
                            onPress={() => manejarAbrirCardexProducto && manejarAbrirCardexProducto(p)}
                          />
                        </View>
                      )}
                    </Tarjeta>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          2. TAB CARDEX (REDISEÑADO CON KPIS INTERACTIVOS, SELECTORES Y SEMÁFORO)
          ===================================================================== */}
      {activoPestana === "cardex" && (() => {
        const baseCardex = Array.isArray(cardexCompleto) && cardexCompleto.length > 0
          ? cardexCompleto
          : filtradoCardex;

        let entradasCount = 0;
        let salidasCount = 0;
        let mermasCount = 0;
        let unidadesEntrada = 0;
        let unidadesSalida = 0;
        let valorTotalMovilizado = 0;

        baseCardex.forEach((m: any) => {
          const qIn = Number(m.qtyIn || 0);
          const qOut = Number(m.qtyOut || 0);
          const pmpVal = Number(m.pmp || 0);
          const valMov = Number(m.totalValue || (qIn + qOut) * pmpVal || 0);
          valorTotalMovilizado += valMov;
          unidadesEntrada += qIn;
          unidadesSalida += qOut;

          if (m.type === "entrada_compra" || m.type === "devolucion") {
            entradasCount++;
          } else if (m.type === "salida_obra") {
            salidasCount++;
          } else if (m.type === "merma" || m.type === "ajuste_conteo") {
            mermasCount++;
          }
        });

        const opcionesTipoCardex = [
          { label: "Todos los movimientos", value: "todos", icon: "swap-horizontal-outline" as const },
          { label: "Entradas por Compra", value: "entrada_compra", icon: "arrow-down-circle-outline" as const },
          { label: "Salidas a Obra / Faena", value: "salida_obra", icon: "arrow-up-circle-outline" as const },
          { label: "Devoluciones a Bodega", value: "devolucion", icon: "return-down-back-outline" as const },
          { label: "Bajas por Merma", value: "merma", icon: "trash-bin-outline" as const },
          { label: "Ajustes por Conteo Físico", value: "ajuste_conteo", icon: "calculator-outline" as const },
        ];

        const opcionesProyectoCardex = [
          { label: "Todos los proyectos y Bodega Central", value: "todos", icon: "layers-outline" as const },
          ...(Array.isArray(proyectos)
            ? proyectos.map((pr: any) => ({
                label: `${pr.code} • ${pr.name}`,
                value: String(pr.code),
                hint: pr.client ? `Cliente: ${pr.client}` : undefined,
                icon: "construct-outline" as const,
              }))
            : []),
        ];

        return (
          <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
            {/* 1. CABECERA COMPACTA INDUSTRIAL + BOTÓN EXPORTAR EXCEL */}
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
                    <Ionicons name="swap-horizontal-outline" size={20} color={tema.colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                      Trazabilidad de Cardex Valorizado
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                      Movilizado:{" "}
                      <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                        {formatearCLP(valorTotalMovilizado)}
                      </Text>
                      {" • "}
                      <Text style={{ fontWeight: "700", color: "#166534" }}>+{unidadesEntrada} un</Text>
                      {" / "}
                      <Text style={{ fontWeight: "700", color: "#991b1b" }}>-{unidadesSalida} un</Text>
                    </Text>
                  </View>
                </View>

                <BotonExportar onExport={manejarExportarCardex} title="Exportar Excel" size="sm" />
              </View>
            </Tarjeta>

            {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS CON SEMÁFORO */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {[
                {
                  id: "entrada_compra",
                  titulo: "Entradas",
                  valor: entradasCount,
                  sub: `+${unidadesEntrada} un ingresadas`,
                  icon: "arrow-down-circle-outline" as const,
                  bg: "#f0fdf4",
                  border: "#86efac",
                  borderActivo: "#16a34a",
                  textColor: "#166534",
                },
                {
                  id: "salida_obra",
                  titulo: "Salidas a Obra",
                  valor: salidasCount,
                  sub: "Despachos a terreno",
                  icon: "arrow-up-circle-outline" as const,
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  borderActivo: "#d97706",
                  textColor: "#92400e",
                },
                {
                  id: "merma",
                  titulo: "Mermas / Ajustes",
                  valor: mermasCount,
                  sub: "Bajas y cuadres",
                  icon: "alert-circle-outline" as const,
                  bg: mermasCount > 0 ? "#fef2f2" : "#f1f5f9",
                  border: mermasCount > 0 ? "#fca5a5" : "#cbd5e1",
                  borderActivo: mermasCount > 0 ? "#dc2626" : "#475569",
                  textColor: mermasCount > 0 ? "#991b1b" : "#334155",
                },
                {
                  id: "todos",
                  titulo: "Todos",
                  valor: baseCardex.length,
                  sub: "Historial completo",
                  icon: "layers-outline" as const,
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  borderActivo: "#0f172a",
                  textColor: "#0f172a",
                },
              ].map((kpi) => {
                const activo = kardexFiltrarTipo === kpi.id;
                return (
                  <TouchableOpacity
                    key={kpi.id}
                    activeOpacity={0.82}
                    onPress={() => establecerKardexFiltrarTipo(kpi.id)}
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

            {/* 3. BARRA DE BÚSQUEDA + SELECTORES DESPLEGABLES (SIN CHIPS CORTADOS) */}
            <Tarjeta variant="outlined" style={{ padding: 12, borderRadius: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: tema.colors.borderDark,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  height: 42,
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Ionicons name="search-outline" size={17} color={tema.colors.textMuted} />
                <TextInput
                  value={kardexFiltrarSku}
                  onChangeText={establecerKardexFiltrarSku}
                  placeholder="Buscar en Cardex por SKU, nombre de insumo o documento..."
                  placeholderTextColor={tema.colors.textMuted}
                  style={{ flex: 1, fontSize: 13, color: tema.colors.text, minWidth: 0 }}
                />
                {Boolean(kardexFiltrarSku) && (
                  <TouchableOpacity onPress={() => establecerKardexFiltrarSku("")}>
                    <Ionicons name="close-circle" size={17} color={tema.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Selector
                    label="Tipo de Movimiento"
                    options={opcionesTipoCardex}
                    value={kardexFiltrarTipo}
                    onChange={establecerKardexFiltrarTipo}
                    placeholder="Todos los movimientos"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>

                <View style={{ flex: 1.2, minWidth: 200 }}>
                  <Selector
                    label="Proyecto / Obra"
                    options={opcionesProyectoCardex}
                    value={kardexFiltrarProyecto}
                    onChange={establecerKardexFiltrarProyecto}
                    placeholder="Todos los proyectos"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>

                {(Boolean(kardexFiltrarSku) ||
                  kardexFiltrarTipo !== "todos" ||
                  kardexFiltrarProyecto !== "todos") && (
                  <Boton
                    title="Limpiar"
                    variant="outline"
                    size="sm"
                    icon="close-circle-outline"
                    onPress={() => {
                      establecerKardexFiltrarSku("");
                      establecerKardexFiltrarTipo("todos");
                      establecerKardexFiltrarProyecto("todos");
                    }}
                    style={{ minHeight: 40 }}
                  />
                )}
              </View>
            </Tarjeta>

            {/* 4. LISTADO DE MOVIMIENTOS CON SEMÁFORO DE SUPERFICIE COMPLETA */}
            {filtradoCardex.length === 0 ? (
              <EstadoVacio
                icon="swap-horizontal-outline"
                title="Sin movimientos en esta vista"
                description="No se registran movimientos de Cardex para los filtros seleccionados."
                actionTitle={
                  kardexFiltrarTipo !== "todos" || kardexFiltrarProyecto !== "todos"
                    ? "Ver Todo el Cardex"
                    : undefined
                }
                onAction={
                  kardexFiltrarTipo !== "todos" || kardexFiltrarProyecto !== "todos"
                    ? () => {
                        establecerKardexFiltrarTipo("todos");
                        establecerKardexFiltrarProyecto("todos");
                        establecerKardexFiltrarSku("");
                      }
                    : undefined
                }
                containerStyle={{ marginVertical: 20 }}
              />
            ) : (
              filtradoCardex.map((item: any) => {
                const esEntrada =
                  item.type === "entrada_compra" ||
                  item.type === "devolucion" ||
                  Number(item.qtyIn || 0) > 0;
                const esMerma = item.type === "merma";
                const cantMov = Number(item.qtyIn || 0) > 0 ? Number(item.qtyIn) : Number(item.qtyOut || 0);
                const valorMovimiento =
                  Number(item.totalValue || 0) > 0
                    ? Number(item.totalValue)
                    : Math.round(cantMov * Number(item.pmp || 0));

                const semaforoCardex = esMerma
                  ? {
                      bg: "#fef2f2",
                      border: "#fca5a5",
                      stripe: "#dc2626",
                      text: "#991b1b",
                      divider: "#fecaca",
                      tone: "danger" as const,
                    }
                  : esEntrada
                    ? {
                        bg: "#f0fdf4",
                        border: "#86efac",
                        stripe: "#16a34a",
                        text: "#166534",
                        divider: "#bbf7d0",
                        tone: "ok" as const,
                      }
                    : {
                        bg: "#fffbeb",
                        border: "#fcd34d",
                        stripe: "#d97706",
                        text: "#92400e",
                        divider: "#fde68a",
                        tone: "warn" as const,
                      };

                return (
                  <Tarjeta
                    key={item.id}
                    variant="outlined"
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      backgroundColor: semaforoCardex.bg,
                      borderColor: semaforoCardex.border,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: semaforoCardex.stripe,
                      borderRadius: 12,
                    }}
                  >
                    {/* Cabecera: Insignia + SKU + Nombre vs Caja Blanca de Cantidad y Valor */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 185 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <Insignia label={item.typeLabel} tone={semaforoCardex.tone} size="sm" />
                          <Text style={{ fontSize: 12, fontWeight: "800", color: semaforoCardex.text }}>
                            {item.sku}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: tema.colors.text,
                            marginTop: 4,
                          }}
                        >
                          {item.productName}
                        </Text>
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: semaforoCardex.text, marginTop: 1 }}>
                          Doc. Ref: {item.reference} • Fecha: {formatearFecha(item.date)}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: "#ffffff",
                          borderWidth: 1,
                          borderColor: semaforoCardex.divider,
                          borderRadius: 9,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignItems: "flex-end",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "900",
                            color: item.qtyIn > 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {item.qtyIn > 0 ? `+${item.qtyIn} un` : `-${item.qtyOut} un`}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.textSecondary }}>
                          {formatearCLP(valorMovimiento)}
                        </Text>
                      </View>
                    </View>

                    {/* Ficha Blanca Interna: Proyecto, Saldo Posterior, PMP y Auditoría de Usuario */}
                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforoCardex.divider,
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        marginTop: 8,
                        gap: 7,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <View style={{ flex: 1.3, minWidth: 140 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                            Destino / Proyecto
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: tema.colors.text, marginTop: 1 }} numberOfLines={1}>
                            {item.projectName || item.projectCode || "Bodega Central"}
                          </Text>
                        </View>

                        <View style={{ flex: 0.8, minWidth: 85 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                            Saldo Posterior
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: "900", color: tema.colors.primaryDark, marginTop: 1 }}>
                            {item.balance} un
                          </Text>
                        </View>

                        <View style={{ flex: 0.8, minWidth: 85, alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 9.5, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                            PMP Posterior
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: tema.colors.text, marginTop: 1 }}>
                            {formatearCLP(item.pmp)}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                          borderTopWidth: 1,
                          borderTopColor: "#f3f4f6",
                          paddingTop: 6,
                          gap: 6,
                        }}
                      >
                        <Ionicons name="person-circle-outline" size={15} color={tema.colors.primaryDark} />
                        <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                          Registrado por:{" "}
                          <Text style={{ fontWeight: "800", color: tema.colors.text }}>
                            {item.userName || "Camila Vera Soto"}
                          </Text>
                        </Text>
                        <Insignia
                          label={item.userRole || "Bodeguero"}
                          tone={
                            item.userRole === "Administrador"
                              ? "primary"
                              : item.userRole === "Tecnico"
                                ? "ok"
                                : "warn"
                          }
                          size="sm"
                        />
                        {item.userRut && (
                          <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                            • RUT: {item.userRut}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Tarjeta>
                );
              })
            )}
          </ScrollView>
        );
      })()}
    </>
  );
};
