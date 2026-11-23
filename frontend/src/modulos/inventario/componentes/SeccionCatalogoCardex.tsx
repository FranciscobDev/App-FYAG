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
import { contrastarSaldoInsumoConUltimaLineaCardex } from "../solicitudInsumosUtils";
import { estilos, UNIDADES_PRODUCTO } from "../estilos";

export interface PropiedadesSeccionCatalogoCardex {
  abrirEscaner: any;
  activoPestana: any;
  alternarProductoDeshabilitado: any;
  buscarQuery: any;
  cardexCompleto?: any;
  establecerBuscarQuery: any;
  establecerKardexFechaRango?: any;
  establecerKardexFiltrarProyecto?: any;
  establecerKardexFiltrarSku: any;
  establecerKardexFiltrarTipo: any;
  filtradoCardex: any;
  filtradoProductos: any;
  kardexFechaRango?: any;
  kardexFiltrarProyecto?: any;
  kardexFiltrarSku: any;
  kardexFiltrarTipo: any;
  manejarAbrirCardexProducto?: any;
  manejarAbrirEditarProducto: any;
  manejarAbrirNuevoProducto: any;
  manejarExportarCardex: any;
  mostrarAviso: any;
  productos?: any;
  proyectos?: any;
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
  manejarAbrirNuevoProducto,
  manejarExportarCardex,
  mostrarAviso,
  productos = [],
  proyectos,
  rolActual,
}) => {
  return (
    <>
      {/* =====================================================================
          1. TAB CATALOGO
          ===================================================================== */}
      {activoPestana === "catalogo" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <View style={estilos.superiorCatalogBarra}>
            <View style={{ flex: 1, minWidth: 260, flexDirection: "row", alignItems: "center" }}>
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

            {/* Botón «Nuevo insumo» SOLO Admin */}
            {rolActual === "admin" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexGrow: 1, minWidth: 160 }}>
                <Boton
                  title="Nuevo insumo"
                  variant="primary"
                  size="sm"
                  icon="add-outline"
                  onPress={manejarAbrirNuevoProducto}
                  style={{ flex: 1, minHeight: 40 }}
                />
              </View>
            )}
          </View>

          {filtradoProductos.length === 0 ? (
            <EstadoVacio
              icon="cube-outline"
              title="No se encontraron insumos"
              description={
                buscarQuery
                  ? `No existen coincidencias para "${buscarQuery}".`
                  : "No hay insumos registrados en el inventario."
              }
              actionTitle={rolActual === "admin" ? "Nuevo Insumo" : undefined}
              onAction={rolActual === "admin" ? manejarAbrirNuevoProducto : undefined}
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            filtradoProductos.map((p: any) => {
              const esLowExistencia = p.stock <= p.minStock;
              return (
                <Tarjeta
                  key={p.sku}
                  variant={esLowExistencia ? "outlined" : "default"}
                  style={[
                    estilos.productoTarjeta,
                    esLowExistencia && estilos.lowExistenciaTarjeta,
                    p.disabled && estilos.deshabilitadoTarjeta,
                  ]}
                >
                  <View style={estilos.productoSuperiorFila}>
                    <View style={estilos.skuInsigniaCaja}>
                      <Text style={estilos.skuTitulo}>{p.sku}</Text>
                      {p.isBulk && (
                        <Insignia label="Granel" tone="info" size="sm" style={{ marginLeft: 6 }} />
                      )}
                      {p.disabled && (
                        <Insignia label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <View style={estilos.existenciaEstadoIndicator}>
                      <View
                        style={[
                          estilos.existenciaEstadoPunto,
                          { backgroundColor: esLowExistencia ? tema.colors.danger : tema.colors.ok },
                        ]}
                      />
                      <Text
                        style={[
                          estilos.existenciaEstadoNumero,
                          { color: esLowExistencia ? tema.colors.danger : tema.colors.okDark },
                        ]}
                      >
                        {p.stock} {p.unit}
                      </Text>
                      {esLowExistencia && (
                        <Text style={estilos.existenciaEstadoMinimo}>(mín {p.minStock})</Text>
                      )}
                    </View>
                  </View>

                  <Text style={estilos.productoNombre}>{p.name}</Text>
                  <Text style={estilos.categoriaTexto}>
                    {p.category} • Ubicación: {p.location} • Prov: {p.defaultSupplier || "No asignado"}
                  </Text>

                  {/* Stock Cell Component / Grid de disponible, comprometido, cuarentena y mínimo */}
                  <CeldaStock
                    available={p.stock}
                    committed={p.committed || 0}
                    quarantine={p.quarantine || 0}
                    minStock={p.minStock}
                    unit={p.unit}
                  />

                  {/* Granel - Barra de capacidad restante si aplica */}
                  {p.isBulk && p.containerCapacity && (
                    <View style={estilos.bulkCapacityCaja}>
                      <BarraProgreso
                        value={p.stock}
                        max={p.containerCapacity}
                        height={6}
                        showPercentage
                        semaforo
                        label={`Capacidad contenedor (${p.stock.toFixed(3)} / ${p.containerCapacity} ${p.unit})`}
                      />
                    </View>
                  )}

                  {/* Acciones: Editar y Deshabilitar y Costos (Exclusivo Admin) */}
                  {rolActual === "admin" ? (
                    <View style={estilos.productoAccionesFila}>
                      <View style={estilos.pmpCaja}>
                        <Text style={estilos.pmpEtiqueta}>PMP Unitario:</Text>
                        <Text style={estilos.pmpValor}>{formatearCLP(p.pmp || p.unitCost)}</Text>
                      </View>

                      <View style={estilos.botonFila}>
                        <Boton
                          title="Cardex"
                          variant="outline"
                          size="sm"
                          icon="swap-horizontal-outline"
                          onPress={() => manejarAbrirCardexProducto && manejarAbrirCardexProducto(p)}
                          style={{ flex: 1, minHeight: 36 }}
                        />
                        <Boton
                          title="Editar"
                          variant="outline"
                          size="sm"
                          icon="create-outline"
                          onPress={() => manejarAbrirEditarProducto(p)}
                          style={{ flex: 1, minHeight: 36 }}
                        />
                        <Boton
                          title={p.disabled ? "Habilitar" : "Deshabilitar"}
                          variant={p.disabled ? "success" : "secondary"}
                          size="sm"
                          icon={p.disabled ? "checkmark-circle-outline" : "ban-outline"}
                          style={{ flex: 1.15, minHeight: 36 }}
                          onPress={() => {
                            alternarProductoDeshabilitado(p.sku);
                            mostrarAviso(`Insumo ${p.sku} ${p.disabled ? "habilitado" : "deshabilitado"}.`);
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={estilos.productoBodegaFila}>
                      <Text style={estilos.bodegaUbicacionNota}>
                        📍 Ubicación asignada: <Text style={{ fontWeight: "bold", color: tema.colors.text }}>{p.location}</Text>
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
        </ScrollView>
      )}

      {/* =====================================================================
          2. TAB CARDEX (Vista de solo lectura, tabla cronológica de saldos/PMP y exportar Excel)
          ===================================================================== */}
      {activoPestana === "cardex" && (() => {
        const skusEnVista: string[] = Array.from(
          new Set(filtradoCardex.map((m: any) => String(m.sku || "")))
        );
        const insumoUnicoSeleccionado =
          skusEnVista.length === 1
            ? productos.find(
              (p: any) => p.sku.trim().toUpperCase() === skusEnVista[0].trim().toUpperCase()
            )
            : kardexFiltrarSku
              ? productos.find(
                (p: any) =>
                  p.sku.trim().toUpperCase() === String(kardexFiltrarSku).trim().toUpperCase()
              )
              : null;

        const contrasteInsumo = insumoUnicoSeleccionado
          ? contrastarSaldoInsumoConUltimaLineaCardex(
            insumoUnicoSeleccionado,
            cardexCompleto || filtradoCardex
          )
          : null;

        return (
          <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
            <View style={estilos.filtrarSeccion}>
              {/* FILA 1: Buscador libre + Selector desplegable de Insumo + Selector desplegable de Período + Exportar */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <View style={{ flex: 1.4, minWidth: 210 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: tema.colors.textSecondary,
                      marginBottom: 6,
                    }}
                  >
                    Buscar movimiento
                  </Text>
                  <TextInput
                    value={kardexFiltrarSku}
                    onChangeText={establecerKardexFiltrarSku}
                    placeholder="SKU, nombre de insumo o referencia..."
                    placeholderTextColor={tema.colors.textLight}
                    style={[estilos.cardexBuscarEntrada, { minHeight: 44 }]}
                  />
                </View>

                {productos.length > 0 && (
                  <View style={{ flex: 1.4, minWidth: 220 }}>
                    <Selector
                      label="Insumo"
                      value={
                        productos.some(
                          (p: any) =>
                            p.sku.trim().toUpperCase() ===
                            String(kardexFiltrarSku || "").trim().toUpperCase()
                        )
                          ? productos.find(
                            (p: any) =>
                              p.sku.trim().toUpperCase() ===
                              String(kardexFiltrarSku || "").trim().toUpperCase()
                          ).sku
                          : ""
                      }
                      onChange={(val) => establecerKardexFiltrarSku(String(val))}
                      options={[
                        {
                          label: `Todos los insumos (${productos.length})`,
                          value: "",
                          hint: "Ver movimientos de todo el catálogo",
                          icon: "cube-outline",
                        },
                        ...productos.map((prod: any) => ({
                          label: `${prod.sku} — ${prod.name}`,
                          value: prod.sku,
                          hint: `Saldo actual: ${prod.stock} ${prod.unit} • PMP: ${formatearCLP(
                            prod.pmp || prod.unitCost
                          )}`,
                          icon: "pricetag-outline" as const,
                        })),
                      ]}
                      placeholder="Todos los insumos"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                )}

                {establecerKardexFechaRango && (
                  <View style={{ flex: 0.9, minWidth: 165 }}>
                    <Selector
                      label="Período"
                      value={kardexFechaRango}
                      onChange={(val) => establecerKardexFechaRango(val)}
                      options={[
                        {
                          label: "Todo el período",
                          value: "todos",
                          hint: "Historial completo de movimientos",
                          icon: "calendar-outline",
                        },
                        {
                          label: "Últimos 30 días",
                          value: "30d",
                          hint: "Movimientos del último mes",
                          icon: "time-outline",
                        },
                        {
                          label: "Últimos 7 días",
                          value: "7d",
                          hint: "Movimientos de la última semana",
                          icon: "today-outline",
                        },
                      ]}
                      placeholder="Todo el período"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingBottom: 2,
                  }}
                >
                  {(Boolean(kardexFiltrarSku) ||
                    kardexFiltrarTipo !== "todos" ||
                    kardexFechaRango !== "todos") && (
                      <Boton
                        title="Limpiar"
                        variant="ghost"
                        size="sm"
                        icon="close-circle-outline"
                        onPress={() => {
                          establecerKardexFiltrarSku("");
                          establecerKardexFiltrarTipo("todos");
                          if (establecerKardexFechaRango) establecerKardexFechaRango("todos");
                          if (establecerKardexFiltrarProyecto) establecerKardexFiltrarProyecto("todos");
                        }}
                      />
                    )}
                  <BotonExportar
                    onExport={manejarExportarCardex}
                    title="Exportar a Excel"
                    size="sm"
                  />
                </View>
              </View>

              {/* FILA 2 (100% del ancho, sin cortarse): Chips de Tipo de movimiento */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={estilos.tipoFiltrarScroll}
              >
                {[
                  { id: "todos", label: "Todos los movimientos" },
                  { id: "entrada_compra", label: "Entradas Compra" },
                  { id: "salida_obra", label: "Salidas a Obra" },
                  { id: "devolucion", label: "Devoluciones" },
                  { id: "merma", label: "Mermas" },
                  { id: "ajuste_conteo", label: "Ajustes Conteo" },
                ].map((tf: any) => (
                  <TouchableOpacity
                    key={tf.id}
                    onPress={() => establecerKardexFiltrarTipo(tf.id)}
                    style={[estilos.tipoChip, kardexFiltrarTipo === tf.id && estilos.tipoChipActivo]}
                  >
                    <Text
                      style={[
                        estilos.tipoChipEtiqueta,
                        kardexFiltrarTipo === tf.id && estilos.tipoChipEtiquetaActivo,
                      ]}
                    >
                      {tf.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* [SCRUM] Panel de contraste entre el saldo actual del insumo y la última línea del Cardex */}
            {contrasteInsumo && (
              <Tarjeta
                variant="outlined"
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderColor: contrasteInsumo.coincideSaldoConUltimaLinea
                    ? tema.colors.ok
                    : tema.colors.warn,
                  backgroundColor: contrasteInsumo.coincideSaldoConUltimaLinea
                    ? tema.colors.okLight
                    : tema.colors.warnLight,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons
                      name={
                        contrasteInsumo.coincideSaldoConUltimaLinea
                          ? "checkmark-circle"
                          : "alert-circle"
                      }
                      size={18}
                      color={
                        contrasteInsumo.coincideSaldoConUltimaLinea
                          ? tema.colors.okDark
                          : tema.colors.warnDark
                      }
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: tema.colors.text,
                      }}
                    >
                      Contraste de Saldo Actual vs. Última Línea del Cardex ({contrasteInsumo.sku})
                    </Text>
                  </View>
                  <Insignia
                    label={
                      contrasteInsumo.coincideSaldoConUltimaLinea
                        ? "Saldo Conciliado ✓"
                        : "Revisar Diferencia"
                    }
                    tone={contrasteInsumo.coincideSaldoConUltimaLinea ? "ok" : "warn"}
                    size="sm"
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 16,
                    marginBottom: 6,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                      Saldo Actual del Insumo (Catálogo)
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text }}>
                      {contrasteInsumo.saldoActualInsumo} {contrasteInsumo.unit} • PMP:{" "}
                      {formatearCLP(contrasteInsumo.pmpActualInsumo)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                      Última Línea del Cardex (
                      {contrasteInsumo.ultimaLineaCardex
                        ? `${contrasteInsumo.ultimaLineaCardex.reference} • ${contrasteInsumo.ultimaLineaCardex.date}`
                        : "Sin movimientos"}
                      )
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: tema.colors.primaryDark,
                      }}
                    >
                      {contrasteInsumo.saldoUltimaLineaCardex !== null
                        ? `${contrasteInsumo.saldoUltimaLineaCardex} ${contrasteInsumo.unit} • PMP: ${formatearCLP(
                          contrasteInsumo.pmpUltimaLineaCardex || 0
                        )}`
                        : "N/A"}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                  {contrasteInsumo.mensajeVerificacion}
                </Text>
              </Tarjeta>
            )}

            {filtradoCardex.length === 0 ? (
              <EstadoVacio
                icon="swap-horizontal-outline"
                title="Sin movimientos registrados"
                description="No se registran movimientos de cardex para los filtros seleccionados."
                containerStyle={{ marginVertical: 20 }}
              />
            ) : (
              filtradoCardex.map((item: any, idx: number) => {
                const esUltimaLineaCronologica = idx === filtradoCardex.length - 1;
                return (
                  <Tarjeta
                    key={item.id}
                    variant="outlined"
                    style={[
                      estilos.cardexTarjeta,
                      esUltimaLineaCronologica && {
                        borderColor: tema.colors.primary,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View style={estilos.cardexSuperior}>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={estilos.cardexSku}>
                            #{idx + 1} • {item.sku}
                          </Text>
                          {esUltimaLineaCronologica && (
                            <Insignia label="Última línea Cardex" tone="primary" size="sm" />
                          )}
                        </View>
                        <Text style={estilos.cardexNombre}>{item.productName}</Text>
                      </View>
                      <Insignia
                        label={item.typeLabel}
                        tone={
                          item.type === "entrada_compra" || item.type === "devolucion"
                            ? "ok"
                            : item.type === "merma"
                              ? "danger"
                              : item.type === "ajuste_conteo"
                                ? "warn"
                                : "info"
                        }
                        size="sm"
                      />
                    </View>

                    <View style={estilos.cardexDetallesGrilla}>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>Fecha</Text>
                        <Text style={estilos.detalleValor}>{formatearFecha(item.date)}</Text>
                      </View>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>Referencia</Text>
                        <Text style={estilos.detalleValor}>{item.reference}</Text>
                      </View>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>Proyecto / Destino</Text>
                        <Text style={estilos.detalleValor}>
                          {item.projectName || item.projectCode || "Bodega Central"}
                        </Text>
                      </View>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>Entrada / Salida</Text>
                        <Text
                          style={[
                            estilos.detalleValor,
                            item.qtyIn > 0 && { color: tema.colors.ok, fontWeight: "bold" },
                            item.qtyOut > 0 && { color: tema.colors.danger, fontWeight: "bold" },
                          ]}
                        >
                          {item.qtyIn > 0
                            ? `+${item.qtyIn}`
                            : item.qtyOut > 0
                              ? `-${item.qtyOut}`
                              : "0"}
                        </Text>
                      </View>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>Saldo Posterior</Text>
                        <Text style={[estilos.detalleValor, { fontWeight: "bold" }]}>
                          {item.balance}
                        </Text>
                      </View>
                      <View style={estilos.detalleElemento}>
                        <Text style={estilos.detalleLbl}>PMP Posterior</Text>
                        <Text style={estilos.detalleValor}>{formatearCLP(item.pmp)}</Text>
                      </View>
                    </View>

                    {/* Trazabilidad: Quién realizó el movimiento (Solo lectura) */}
                    <View style={estilos.cardexUsuarioFila}>
                      <Ionicons name="person-circle-outline" size={16} color={tema.colors.primary} />
                      <Text style={estilos.cardexUsuarioTexto}>
                        Registrado por:{" "}
                        <Text style={{ fontWeight: "bold", color: tema.colors.text }}>
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
                        <Text style={estilos.cardexUsuarioRut}>• RUT: {item.userRut}</Text>
                      )}
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
