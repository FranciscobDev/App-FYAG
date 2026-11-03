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

export interface PropiedadesSeccionInformeMermas {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoWastes: any;
  mermaTotals: any;
  productos: any;
  width: any;
}

export const SeccionInformeMermas: React.FC<PropiedadesSeccionInformeMermas> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoWastes,
  mermaTotals,
  productos,
  width,
}) => {
  return (
    <>
            {activoPestana === "mermas" && (
              filtradoWastes.length === 0 ? (
                <EstadoVacio
                  icon="trash-bin-outline"
                  title="Sin mermas registradas"
                  description="No existen mermas para los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {filtradoWastes.map((w: any) => {
                    const producto = productos.find((p: any) => p.sku === w.sku);

                    return (
                      <View key={w.id} style={estilos.reporteTarjeta}>
                        <View style={estilos.reporteTarjetaSuperior}>
                          <View style={{ flex: 1 }}>
                            <Text style={estilos.tarjetaElementoTitulo}>{producto ? producto.name : w.sku}</Text>
                            <Text style={estilos.tarjetaElementoSub}>
                              SKU: {w.sku} • Motivo: {w.reason}
                            </Text>
                          </View>
                          <Insignia label="Aprobada" tone="danger" size="sm" />
                        </View>

                        <View style={estilos.tarjetaDivisor} />

                        <View style={estilos.tarjetaStatsFila}>
                          <View>
                            <Text style={estilos.tarjetaStatEtiqueta}>CANTIDAD DADA DE BAJA</Text>
                            <Text style={[estilos.tarjetaStatValor, { color: tema.colors.dangerDark }]}>
                              {w.quantity} {w.unit}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={estilos.tarjetaStatEtiqueta}>COSTO DE LA PÉRDIDA</Text>
                            <Text style={[estilos.tarjetaStatValor, { color: tema.colors.dangerDark, fontWeight: "bold" }]}>
                              {formatearCLP(w.totalLoss)}
                            </Text>
                          </View>
                        </View>

                        <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                          <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                            Responsable: {w.user}
                          </Text>
                          <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>Fecha: {w.date}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 800 }}>
                  <View style={{ minWidth: 800, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 95 }]}>Fecha</Text>
                      <Text style={[estilos.thCelda, { width: 110 }]}>SKU</Text>
                      <Text style={[estilos.thCelda, { width: 200 }]}>Insumo</Text>
                      <Text style={[estilos.thCelda, { width: 80, textAlign: "right" }]}>Cantidad</Text>
                      <Text style={[estilos.thCelda, { width: 130 }]}>Motivo</Text>
                      <Text style={[estilos.thCelda, { width: 120 }]}>Responsable</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Pérdida ($ CLP)</Text>
                    </View>

                    {filtradoWastes.map((w: any) => {
                      const producto = productos.find((p: any) => p.sku === w.sku);
                      return (
                        <View key={w.id} style={estilos.tablaFila}>
                          <Text style={[estilos.tdCelda, { width: 95, fontSize: 11 }]}>{w.date}</Text>
                          <Text style={[estilos.tdCelda, { width: 110, fontWeight: "600" }]}>{w.sku}</Text>
                          <Text style={[estilos.tdCelda, { width: 200 }]}>{producto ? producto.name : w.sku}</Text>
                          <Text style={[estilos.tdCelda, { width: 80, textAlign: "right", color: tema.colors.dangerDark, fontWeight: "bold" }]}>
                            {w.quantity}
                          </Text>
                          <Text style={[estilos.tdCelda, { width: 130, fontSize: 11 }]}>{w.reason}</Text>
                          <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{w.user}</Text>
                          <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold", color: tema.colors.dangerDark }]}>
                            {formatearCLP(w.totalLoss)}
                          </Text>
                        </View>
                      );
                    })}

                    <View style={estilos.totalsFila}>
                      <View style={{ width: 405 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES MERMAS ({mermaTotals.count}):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCeldaBold, { width: 80, textAlign: "right", color: tema.colors.dangerDark }]}>
                        {mermaTotals.totalUnits} un
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 130 }]}>-</Text>
                      <Text style={[estilos.totalsCelda, { width: 120 }]}>-</Text>
                      <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
                        {formatearCLP(mermaTotals.totalCost)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
