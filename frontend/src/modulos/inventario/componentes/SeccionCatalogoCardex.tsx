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
import { estilos, UNIDADES_PRODUCTO } from "../estilos";

export interface PropiedadesSeccionCatalogoCardex {
  abrirEscaner: any;
  activoPestana: any;
  alternarProductoDeshabilitado: any;
  buscarQuery: any;
  establecerBuscarQuery: any;
  establecerKardexFiltrarProyecto: any;
  establecerKardexFiltrarSku: any;
  establecerKardexFiltrarTipo: any;
  filtradoCardex: any;
  filtradoProductos: any;
  kardexFiltrarProyecto: any;
  kardexFiltrarSku: any;
  kardexFiltrarTipo: any;
  manejarAbrirEditarProducto: any;
  manejarAbrirNuevoProducto: any;
  manejarExportarCardex: any;
  mostrarAviso: any;
  proyectos: any;
  rolActual: any;
}

export const SeccionCatalogoCardex: React.FC<PropiedadesSeccionCatalogoCardex> = ({
  abrirEscaner,
  activoPestana,
  alternarProductoDeshabilitado,
  buscarQuery,
  establecerBuscarQuery,
  establecerKardexFiltrarProyecto,
  establecerKardexFiltrarSku,
  establecerKardexFiltrarTipo,
  filtradoCardex,
  filtradoProductos,
  kardexFiltrarProyecto,
  kardexFiltrarSku,
  kardexFiltrarTipo,
  manejarAbrirEditarProducto,
  manejarAbrirNuevoProducto,
  manejarExportarCardex,
  mostrarAviso,
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
                        title="Editar"
                        variant="outline"
                        size="sm"
                        icon="create-outline"
                        onPress={() => manejarAbrirEditarProducto(p)}
                        style={{ marginRight: 6 }}
                      />
                      <Boton
                        title={p.disabled ? "Habilitar" : "Deshabilitar"}
                        variant={p.disabled ? "success" : "secondary"}
                        size="sm"
                        icon={p.disabled ? "checkmark-circle-outline" : "ban-outline"}
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
                  </View>
                )}
              </Tarjeta>
            );
          })
        )}
        </ScrollView>
      )}

      {/* =====================================================================
          2. TAB CARDEX (Solo lectura con exportar Excel)
          ===================================================================== */}
      {activoPestana === "cardex" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <View style={estilos.filtrarSeccion}>
            <View style={estilos.filtrarEncabezadoFila}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  value={kardexFiltrarSku}
                  onChangeText={establecerKardexFiltrarSku}
                  placeholder="Filtrar por SKU o nombre..."
                  placeholderTextColor={tema.colors.textLight}
                  style={estilos.cardexBuscarEntrada}
                />
              </View>
              {(Boolean(kardexFiltrarSku) || kardexFiltrarTipo !== "todos" || kardexFiltrarProyecto !== "todos") && (
                <Boton
                  title="Limpiar filtros"
                  variant="ghost"
                  size="sm"
                  icon="close-circle-outline"
                  onPress={() => {
                    establecerKardexFiltrarSku("");
                    establecerKardexFiltrarTipo("todos");
                    establecerKardexFiltrarProyecto("todos");
                  }}
                  style={{ marginRight: 8 }}
                />
              )}
              <BotonExportar onExport={manejarExportarCardex} title="Excel" size="sm" />
            </View>

            {/* Filtro por tipo de movimiento */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.tipoFiltrarScroll}>
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
                  <Text style={[estilos.tipoChipEtiqueta, kardexFiltrarTipo === tf.id && estilos.tipoChipEtiquetaActivo]}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filtro por proyecto */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[estilos.tipoFiltrarScroll, { marginTop: 4 }]}>
              <TouchableOpacity
                onPress={() => establecerKardexFiltrarProyecto("todos")}
                style={[estilos.tipoChip, kardexFiltrarProyecto === "todos" && estilos.tipoChipActivo]}
              >
                <Text style={[estilos.tipoChipEtiqueta, kardexFiltrarProyecto === "todos" && estilos.tipoChipEtiquetaActivo]}>
                  Todos los proyectos
                </Text>
              </TouchableOpacity>
              {proyectos.map((pr: any) => (
                <TouchableOpacity
                  key={pr.id}
                  onPress={() => establecerKardexFiltrarProyecto(pr.code)}
                  style={[estilos.tipoChip, kardexFiltrarProyecto === pr.code && estilos.tipoChipActivo]}
                >
                  <Text style={[estilos.tipoChipEtiqueta, kardexFiltrarProyecto === pr.code && estilos.tipoChipEtiquetaActivo]}>
                    {pr.code} ({pr.name})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filtradoCardex.length === 0 ? (
            <EstadoVacio
              icon="swap-horizontal-outline"
              title="Sin movimientos registrados"
              description="No se registran movimientos de cardex para los filtros seleccionados."
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            filtradoCardex.map((item: any) => (
              <Tarjeta key={item.id} variant="outlined" style={estilos.cardexTarjeta}>
                <View style={estilos.cardexSuperior}>
                  <View>
                    <Text style={estilos.cardexSku}>{item.sku}</Text>
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
                    <Text style={estilos.detalleLbl}>Proyecto</Text>
                    <Text style={estilos.detalleValor}>{item.projectName || item.projectCode || "Bodega Central"}</Text>
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
                      {item.qtyIn > 0 ? `+${item.qtyIn}` : `-${item.qtyOut}`}
                    </Text>
                  </View>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>Saldo Posterior</Text>
                    <Text style={[estilos.detalleValor, { fontWeight: "bold" }]}>{item.balance}</Text>
                  </View>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>PMP Posterior</Text>
                    <Text style={estilos.detalleValor}>{formatearCLP(item.pmp)}</Text>
                  </View>
                </View>
              </Tarjeta>
            ))
          )}
        </ScrollView>
      )}
    </>
  );
};
