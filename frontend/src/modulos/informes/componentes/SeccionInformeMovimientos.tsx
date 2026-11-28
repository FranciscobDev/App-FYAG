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

export interface PropiedadesSeccionInformeMovimientos {
  activoPestana: any;
  cardexTotals: any;
  effectiveVistaModo: any;
  filtradoCardex: any;
  width: any;
}

export const SeccionInformeMovimientos: React.FC<PropiedadesSeccionInformeMovimientos> = ({
  activoPestana,
  cardexTotals,
  effectiveVistaModo,
  filtradoCardex,
  width,
}) => {
  return (
    <>
            {activoPestana === "movimientos" && (
              filtradoCardex.length === 0 ? (
                <EstadoVacio
                  icon="swap-horizontal-outline"
                  title="Sin movimientos coincidentes"
                  description="No se encontraron registros de Cardex con los filtros aplicados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {filtradoCardex.map((item: any) => (
                    <View key={item.id} style={estilos.reporteTarjeta}>
                      <View style={estilos.reporteTarjetaSuperior}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={estilos.tarjetaElementoTitulo}>{item.productName}</Text>
                          <Text style={estilos.tarjetaElementoSub}>SKU: {item.sku}</Text>
                        </View>
                        <Insignia
                          label={item.typeLabel}
                          tone={
                            item.type === "entrada_compra"
                              ? "ok"
                              : item.type === "salida_obra"
                              ? "primary"
                              : item.type === "devolucion"
                              ? "warn"
                              : item.type === "merma"
                              ? "danger"
                              : "mute"
                          }
                          size="sm"
                        />
                      </View>

                      <View style={estilos.tarjetaDivisor} />

                      <View style={estilos.tarjetaStatsFila}>
                        <View>
                          <Text style={estilos.tarjetaStatEtiqueta}>REFERENCIA / OBRA</Text>
                          <Text style={estilos.tarjetaStatValor}>
                            {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={estilos.tarjetaStatEtiqueta}>TOTAL ($ CLP)</Text>
                          <Text style={[estilos.tarjetaStatValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatearCLP(item.totalValue)}
                          </Text>
                        </View>
                      </View>

                      <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {item.qtyIn > 0 && (
                            <Text style={{ fontSize: 12, color: tema.colors.okDark, fontWeight: "600" }}>
                              +{item.qtyIn} un
                            </Text>
                          )}
                          {item.qtyOut > 0 && (
                            <Text style={{ fontSize: 12, color: tema.colors.dangerDark, fontWeight: "600" }}>
                              -{item.qtyOut} un
                            </Text>
                          )}
                          <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                            Saldo: {item.balance} un
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>{item.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 980 }}>
                  <View style={{ minWidth: 980, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 90 }]}>Fecha</Text>
                      <Text style={[estilos.thCelda, { width: 140 }]}>Tipo</Text>
                      <Text style={[estilos.thCelda, { width: 220 }]}>Insumo (SKU & Nombre)</Text>
                      <Text style={[estilos.thCelda, { width: 150 }]}>Referencia / Obra</Text>
                      <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Entrada</Text>
                      <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Salida</Text>
                      <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Saldo</Text>
                      <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Total ($ CLP)</Text>
                    </View>

                    {filtradoCardex.map((item: any) => (
                      <View key={item.id} style={estilos.tablaFila}>
                        <Text style={[estilos.tdCelda, { width: 90, fontSize: 11 }]}>{item.date}</Text>
                        <View style={{ width: 140 }}>
                          <Insignia
                            label={item.typeLabel}
                            tone={
                              item.type === "entrada_compra"
                                ? "ok"
                                : item.type === "salida_obra"
                                ? "primary"
                                : item.type === "devolucion"
                                ? "warn"
                                : item.type === "merma"
                                ? "danger"
                                : "mute"
                            }
                            size="sm"
                          />
                        </View>
                        <View style={{ width: 220 }}>
                          <Text style={estilos.filaPrincipalTexto}>{item.productName}</Text>
                          <Text style={estilos.filaSubTexto}>{item.sku}</Text>
                        </View>
                        <Text style={[estilos.tdCelda, { width: 150, fontSize: 11 }]}>
                          {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", color: item.qtyIn > 0 ? tema.colors.okDark : tema.colors.textMuted }]}>
                          {item.qtyIn > 0 ? `+${item.qtyIn}` : "-"}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", color: item.qtyOut > 0 ? tema.colors.dangerDark : tema.colors.textMuted }]}>
                          {item.qtyOut > 0 ? `-${item.qtyOut}` : "-"}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", fontWeight: "600" }]}>
                          {item.balance}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textSecondary }]}>
                          {formatearCLP(item.pmp)}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
                          {formatearCLP(item.totalValue)}
                        </Text>
                      </View>
                    ))}

                    {/* Fila de Totales */}
                    <View style={estilos.totalsFila}>
                      <View style={{ width: 600 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES CONSOLIDADOS ({cardexTotals.count} movimientos):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", color: tema.colors.okDark }]}>
                        +{cardexTotals.totalIn}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", color: tema.colors.dangerDark }]}>
                        -{cardexTotals.totalOut}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right" }]}>-</Text>
                      <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>-</Text>
                      <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
                        {formatearCLP(cardexTotals.totalValue)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
