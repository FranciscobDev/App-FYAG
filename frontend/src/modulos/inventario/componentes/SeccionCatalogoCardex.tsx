import React, { useEffect, useRef, useState } from "react";
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
import { CatalogoStock } from "@/componentes/dominio/CatalogoStock";
import { SeccionQrInsumosAdmin } from "./SeccionQrInsumosAdmin";
import { estilos, UNIDADES_PRODUCTO } from "../estilos";
import { RangoFechaCardex } from "../cardexExcel";
import { SeccionCardexSoloLectura } from "./SeccionCardexSoloLectura";

export interface PropiedadesSeccionCatalogoCardex {
  abrirEscaner: any;
  activoPestana: any;
  alternarProductoDeshabilitado: any;
  buscarQuery: any;
  cardexCompleto?: MovimientoCardex[];
  establecerBuscarQuery: any;
  establecerKardexFechaRango?: (rango: RangoFechaCardex) => void;
  establecerKardexFiltrarProyecto: any;
  establecerKardexFiltrarSku: any;
  establecerKardexFiltrarTipo: any;
  filtradoCardex: any;
  filtradoProductos: any;
  kardexFechaRango?: RangoFechaCardex;
  kardexFiltrarProyecto: any;
  kardexFiltrarSku: any;
  kardexFiltrarTipo: any;
  manejarAbrirCardexProducto?: any;
  manejarAbrirEditarProducto: any;
  manejarAbrirNuevoProducto: any;
  manejarAbrirInsumoForm?: any;
  manejarExportarCardex: any;
  mostrarAviso: any;
  productos?: Producto[];
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
  manejarAbrirNuevoProducto,
  manejarAbrirInsumoForm,
  manejarExportarCardex,
  mostrarAviso,
  productos,
  proyectos,
  rolActual,
}) => {
  const [modoVista, setModoVista] = useState<"tabla" | "tarjetas" | "qr">("tabla");

  return (
    <>
      {/* =====================================================================
          1. TAB CATALOGO
          ===================================================================== */}
      {activoPestana === "catalogo" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* Barra de alternancia de vista: Tabla / Tarjetas / Códigos QR (Admin) */}
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
                onPress={() => setModoVista("tabla")}
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: modoVista === "tabla" ? tema.colors.primary : "#cbd5e1",
                    backgroundColor: modoVista === "tabla" ? tema.colors.primaryLight : "#ffffff",
                  },
                ]}
              >
                <Ionicons
                  name="list-outline"
                  size={16}
                  color={modoVista === "tabla" ? tema.colors.primaryDark : "#64748b"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: modoVista === "tabla" ? tema.colors.primaryDark : "#475569",
                  }}
                >
                  Tabla Catálogo de Stock
                </Text>
              </TouchableOpacity>

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
            {rolActual === "admin" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexGrow: 1, minWidth: 260 }}>
                <Boton
                  title="Nuevo insumo"
                  variant="primary"
                  size="sm"
                  icon="add-outline"
                  onPress={manejarAbrirNuevoProducto}
                  style={{ flex: 1, minHeight: 40 }}
                />
                {Boolean(manejarAbrirInsumoForm) && (
                  <Boton
                    title="Registro Rápido"
                    variant="outline"
                    size="sm"
                    icon="document-text-outline"
                    onPress={manejarAbrirInsumoForm}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                )}
              </View>
            )}
          </View>

          {modoVista === "tabla" ? (
            <CatalogoStock
              mostrarSimuladorScrum={true}
              onSelectInsumo={(insumo) => {
                const prod = filtradoProductos.find((p: any) => p.sku === insumo.sku);
                if (prod && manejarAbrirCardexProducto) {
                  manejarAbrirCardexProducto(prod);
                }
              }}
            />
          ) : modoVista === "qr" && rolActual === "admin" ? (
            <SeccionQrInsumosAdmin
              productos={productos || filtradoProductos || []}
              mostrarAviso={mostrarAviso}
            />
          ) : (
            <>
              <View style={estilos.superiorCatalogBarra}>
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

                {/* Botón «Nuevo insumo» SOLO Admin */}
                {rolActual === "admin" && (
                  <Boton
                    title="Nuevo insumo"
                    variant="primary"
                    size="sm"
                    icon="add-outline"
                    onPress={manejarAbrirNuevoProducto}
                    style={{ marginLeft: 8 }}
                  />
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
            </>
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          2. PESTAÑA CARDEX (Solo lectura, filtros dinámicos, saldos/PMP y Excel)
          ===================================================================== */}
      {activoPestana === "cardex" && (
        <SeccionCardexSoloLectura
          cardexCompleto={cardexCompleto || filtradoCardex || []}
          productos={productos || filtradoProductos || []}
          proyectos={proyectos || []}
          kardexFiltrarSku={kardexFiltrarSku}
          establecerKardexFiltrarSku={establecerKardexFiltrarSku}
          kardexFiltrarTipo={kardexFiltrarTipo}
          establecerKardexFiltrarTipo={establecerKardexFiltrarTipo}
          kardexFiltrarProyecto={kardexFiltrarProyecto}
          establecerKardexFiltrarProyecto={establecerKardexFiltrarProyecto}
          kardexFechaRango={kardexFechaRango}
          establecerKardexFechaRango={establecerKardexFechaRango || (() => {})}
          mostrarAviso={mostrarAviso}
        />
      )}
    </>
  );
};
