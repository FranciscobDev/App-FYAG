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

export interface PropiedadesSeccionInformeMateriales {
  activoPestana: any;
  asignadoMateriales: any;
  asignadoMaterialesTotals: any;
  effectiveVistaModo: any;
  width: any;
}

export const SeccionInformeMateriales: React.FC<PropiedadesSeccionInformeMateriales> = ({
  activoPestana,
  asignadoMateriales,
  asignadoMaterialesTotals,
  effectiveVistaModo,
  width,
}) => {
  return (
    <>
            {activoPestana === "materiales" && (
              asignadoMateriales.length === 0 ? (
                <EstadoVacio
                  icon="layers-outline"
                  title="Sin materiales asignados"
                  description="No existen solicitudes de insumos a faenas para los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {asignadoMateriales.map((m: any) => (
                    <View key={m.id} style={estilos.reporteTarjeta}>
                      <View style={estilos.reporteTarjetaSuperior}>
                        <View style={{ flex: 1 }}>
                          <Text style={estilos.tarjetaElementoTitulo}>{m.productName}</Text>
                          <Text style={estilos.tarjetaElementoSub}>
                            SKU: {m.sku} • Faena: {m.projectName}
                          </Text>
                        </View>
                        <InsigniaEstado status={m.status as any} label={m.status.toUpperCase()} />
                      </View>

                      <View style={estilos.tarjetaDivisor} />

                      <View style={estilos.tarjetaStatsFila}>
                        <View>
                          <Text style={estilos.tarjetaStatEtiqueta}>SOLICITADO / ENTREGADO</Text>
                          <Text style={estilos.tarjetaStatValor}>
                            {m.quantityRequested} / {m.quantityDelivered} un
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={estilos.tarjetaStatEtiqueta}>VALORIZACIÓN ESTIMADA</Text>
                          <Text style={[estilos.tarjetaStatValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatearCLP(m.estimatedCost)}
                          </Text>
                        </View>
                      </View>

                      <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                          Técnico: {m.technicianRut}
                        </Text>
                        <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>Fecha: {m.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 880 }}>
                  <View style={{ minWidth: 880, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 90 }]}>Fecha</Text>
                      <Text style={[estilos.thCelda, { width: 170 }]}>Proyecto / Obra</Text>
                      <Text style={[estilos.thCelda, { width: 200 }]}>Insumo (SKU & Nombre)</Text>
                      <Text style={[estilos.thCelda, { width: 120 }]}>Técnico Solicitante</Text>
                      <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Solicitado</Text>
                      <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Entregado</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Valor Total ($)</Text>
                    </View>

                    {asignadoMateriales.map((m: any) => (
                      <View key={m.id} style={estilos.tablaFila}>
                        <Text style={[estilos.tdCelda, { width: 90, fontSize: 11 }]}>{m.date}</Text>
                        <Text style={[estilos.tdCelda, { width: 170, fontSize: 11, fontWeight: "600" }]}>
                          {m.projectName}
                        </Text>
                        <View style={{ width: 200 }}>
                          <Text style={estilos.filaPrincipalTexto}>{m.productName}</Text>
                          <Text style={estilos.filaSubTexto}>{m.sku}</Text>
                        </View>
                        <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{m.technicianRut}</Text>
                        <Text style={[estilos.tdCelda, { width: 75, textAlign: "right" }]}>
                          {m.quantityRequested}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
                          {m.quantityDelivered}
                        </Text>
                        <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
                          {formatearCLP(m.estimatedCost)}
                        </Text>
                      </View>
                    ))}

                    <View style={estilos.totalsFila}>
                      <View style={{ width: 580 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES DE MATERIALES EN FAENA ({asignadoMaterialesTotals.count}):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right" }]}>
                        {asignadoMaterialesTotals.totalReq}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
                        {asignadoMaterialesTotals.totalDeliv}
                      </Text>
                      <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
                        {formatearCLP(asignadoMaterialesTotals.totalVal)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
