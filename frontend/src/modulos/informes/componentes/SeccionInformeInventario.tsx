import React, { useState, useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  InsigniaEstado,
  BotonExportar,
  TarjetaKpi,
  EncabezadoPagina,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import { MovimientoCardex, Producto, Proyecto, RegistroMerma } from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeInventario {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoProductos: any;
  inventarioTotals: any;
  width: any;
}

export const SeccionInformeInventario: React.FC<PropiedadesSeccionInformeInventario> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoProductos,
  inventarioTotals,
  width,
}) => {
  return (
    <>
            {activoPestana === "inventario" && (
              filtradoProductos.length === 0 ? (
                <EstadoVacio
                  icon="cube-outline"
                  title="Sin insumos coincidentes"
                  description="No hay insumos que cumplan los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {filtradoProductos.map((p: any) => {
                    const esLow = p.stock <= p.minStock && p.stock > 0;
                    const esOut = p.stock === 0;

                    return (
                      <View key={p.sku} style={estilos.reporteTarjeta}>
                        <View style={estilos.reporteTarjetaSuperior}>
                          <View style={{ flex: 1 }}>
                            <Text style={estilos.tarjetaElementoTitulo}>{p.name}</Text>
                            <Text style={estilos.tarjetaElementoSub}>
                              SKU: {p.sku} • {p.category}
                            </Text>
                          </View>
                          <Insignia
                            label={esOut ? "Agotado" : esLow ? "Crítico" : "Óptimo"}
                            tone={esOut ? "danger" : esLow ? "warn" : "ok"}
                            size="sm"
                          />
                        </View>

                        <View style={estilos.tarjetaDivisor} />

                        <View style={estilos.tarjetaStatsFila}>
                          <View>
                            <Text style={estilos.tarjetaStatEtiqueta}>EXISTENCIA / MÍNIMO</Text>
                            <Text style={estilos.tarjetaStatValor}>
                              {p.stock} / {p.minStock} {p.unit}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={estilos.tarjetaStatEtiqueta}>PMP UNITARIO</Text>
                            <Text style={estilos.tarjetaStatValor}>{formatearCLP(p.pmp ?? 0)}</Text>
                          </View>
                        </View>

                        <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                          <View>
                            <Text style={estilos.tarjetaStatEtiqueta}>VALORIZACIÓN TOTAL</Text>
                            <Text style={[estilos.tarjetaStatValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                              {formatearCLP(p.stock * (p.pmp ?? 0))}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 840 }}>
                  <View style={{ minWidth: 840, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 110 }]}>SKU</Text>
                      <Text style={[estilos.thCelda, { width: 220 }]}>Nombre del Insumo</Text>
                      <Text style={[estilos.thCelda, { width: 120 }]}>Categoría</Text>
                      <Text style={[estilos.thCelda, { width: 70, textAlign: "right" }]}>Stock</Text>
                      <Text style={[estilos.thCelda, { width: 70, textAlign: "right" }]}>Mínimo</Text>
                      <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
                      <Text style={[estilos.thCelda, { width: 120, textAlign: "right" }]}>Total ($ CLP)</Text>
                    </View>

                    {filtradoProductos.map((p: any) => (
                      <View key={p.sku} style={estilos.tablaFila}>
                        <Text style={[estilos.tdCelda, { width: 110, fontWeight: "600" }]}>{p.sku}</Text>
                        <View style={{ width: 220 }}>
                          <Text style={estilos.filaPrincipalTexto}>{p.name}</Text>
                          <Text style={estilos.filaSubTexto}>{p.unit}</Text>
                        </View>
                        <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{p.category}</Text>
                        <Text
                          style={[
                            estilos.tdCelda,
                            {
                              width: 70,
                              textAlign: "right",
                              fontWeight: "bold",
                              color: p.stock <= p.minStock ? tema.colors.dangerDark : tema.colors.text,
                            },
                          ]}
                        >
                          {p.stock}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 70, textAlign: "right", color: tema.colors.textMuted }]}>
                          {p.minStock}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textSecondary }]}>
                          {formatearCLP(p.pmp ?? 0)}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
                          {formatearCLP(p.stock * (p.pmp ?? 0))}
                        </Text>
                      </View>
                    ))}

                    <View style={estilos.totalsFila}>
                      <View style={{ width: 450 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES DE EXISTENCIAS ({inventarioTotals.count} SKUs):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCelda, { width: 70, textAlign: "right", fontWeight: "bold" }]}>
                        {inventarioTotals.totalUnits} un
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 70, textAlign: "right" }]}>-</Text>
                      <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>-</Text>
                      <Text style={[estilos.totalsCeldaBold, { width: 120, textAlign: "right" }]}>
                        {formatearCLP(inventarioTotals.totalValuation)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
