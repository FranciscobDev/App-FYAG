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

export interface PropiedadesSeccionInformeGastos {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoPurchases: any;
  purchasesTotals: any;
  width: any;
}

export const SeccionInformeGastos: React.FC<PropiedadesSeccionInformeGastos> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoPurchases,
  purchasesTotals,
  width,
}) => {
  return (
    <>
            {activoPestana === "gastos" && (
              filtradoPurchases.length === 0 ? (
                <EstadoVacio
                  icon="receipt-outline"
                  title="Sin compras ni facturas"
                  description="No hay compras registradas en el período seleccionado."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {filtradoPurchases.map((inv: any) => (
                    <View key={inv.id} style={estilos.reporteTarjeta}>
                      <View style={estilos.reporteTarjetaSuperior}>
                        <View style={{ flex: 1 }}>
                          <Text style={estilos.tarjetaElementoTitulo}>Factura N° {inv.number}</Text>
                          <Text style={estilos.tarjetaElementoSub}>
                            Proveedor: {inv.supplierName}
                          </Text>
                        </View>
                        <InsigniaEstado status={inv.status === "recepcion_conforme" ? "aprobada" : "pendiente"} label={inv.status === "recepcion_conforme" ? "CONFORME" : "DISCREPANCIA"} />
                      </View>

                      <View style={estilos.tarjetaDivisor} />

                      <View style={estilos.tarjetaStatsFila}>
                        <View>
                          <Text style={estilos.tarjetaStatEtiqueta}>MONTO NETO</Text>
                          <Text style={estilos.tarjetaStatValor}>{formatearCLP(inv.subtotalNet)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={estilos.tarjetaStatEtiqueta}>TOTAL FACTURADO CON IVA</Text>
                          <Text style={[estilos.tarjetaStatValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatearCLP(inv.total)}
                          </Text>
                        </View>
                      </View>

                      <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                          IVA (19%): {formatearCLP(inv.iva)}
                        </Text>
                        <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>Fecha: {inv.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 840 }}>
                  <View style={{ minWidth: 840, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 120 }]}>N° Factura</Text>
                      <Text style={[estilos.thCelda, { width: 200 }]}>Proveedor</Text>
                      <Text style={[estilos.thCelda, { width: 95 }]}>Fecha</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Monto Neto ($)</Text>
                      <Text style={[estilos.thCelda, { width: 100, textAlign: "right" }]}>IVA ($)</Text>
                      <Text style={[estilos.thCelda, { width: 120, textAlign: "right" }]}>Total Facturado ($)</Text>
                      <Text style={[estilos.thCelda, { width: 85, textAlign: "center" }]}>Estado</Text>
                    </View>

                    {filtradoPurchases.map((inv: any) => (
                      <View key={inv.id} style={estilos.tablaFila}>
                        <Text style={[estilos.tdCelda, { width: 120, fontWeight: "bold" }]}>
                          {inv.number}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 200 }]}>{inv.supplierName}</Text>
                        <Text style={[estilos.tdCelda, { width: 95, fontSize: 11 }]}>{inv.date}</Text>
                        <Text style={[estilos.tdCelda, { width: 110, textAlign: "right" }]}>
                          {formatearCLP(inv.subtotalNet)}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 100, textAlign: "right", color: tema.colors.textMuted }]}>
                          {formatearCLP(inv.iva)}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
                          {formatearCLP(inv.total)}
                        </Text>
                        <View style={{ width: 85, alignItems: "center" }}>
                          <InsigniaEstado status={inv.status === "recepcion_conforme" ? "aprobada" : "pendiente"} label={inv.status === "recepcion_conforme" ? "CONFORME" : "DISCREPANCIA"} />
                        </View>
                      </View>
                    ))}

                    <View style={estilos.totalsFila}>
                      <View style={{ width: 415 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES FACTURAS ({purchasesTotals.count}):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
                        {formatearCLP(purchasesTotals.totalNet)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 100, textAlign: "right" }]}>
                        {formatearCLP(purchasesTotals.totalVat)}
                      </Text>
                      <Text style={[estilos.totalsCeldaBold, { width: 120, textAlign: "right", color: tema.colors.primaryDark }]}>
                        {formatearCLP(purchasesTotals.totalFinal)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 85, textAlign: "center" }]}>-</Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
