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

export interface PropiedadesSeccionInformeProyectos {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoProyectos: any;
  proyectosTotals: any;
  width: any;
}

export const SeccionInformeProyectos: React.FC<PropiedadesSeccionInformeProyectos> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoProyectos,
  proyectosTotals,
  width,
}) => {
  return (
    <>
            {activoPestana === "proyectos" && (
              filtradoProyectos.length === 0 ? (
                <EstadoVacio
                  icon="business-outline"
                  title="Sin proyectos coincidentes"
                  description="No hay proyectos que cumplan con la búsqueda."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveVistaModo === "cards" ? (
                <View style={estilos.tarjetasLista}>
                  {filtradoProyectos.map((proj: any) => {
                    const margen = proj.budget - proj.costReal;

                    return (
                      <View key={proj.id} style={estilos.reporteTarjeta}>
                        <View style={estilos.reporteTarjetaSuperior}>
                          <View style={{ flex: 1 }}>
                            <Text style={estilos.tarjetaElementoTitulo}>{proj.name}</Text>
                            <Text style={estilos.tarjetaElementoSub}>
                              {proj.code} • Cliente: {proj.client}
                            </Text>
                          </View>
                          <InsigniaEstado status={proj.status} label={proj.status.toUpperCase()} />
                        </View>

                        <View style={estilos.tarjetaDivisor} />

                        <View style={estilos.tarjetaStatsFila}>
                          <View>
                            <Text style={estilos.tarjetaStatEtiqueta}>PRESUPUESTO APROBADO</Text>
                            <Text style={estilos.tarjetaStatValor}>{formatearCLP(proj.budget)}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={estilos.tarjetaStatEtiqueta}>COSTO REAL H27</Text>
                            <Text style={[estilos.tarjetaStatValor, { color: tema.colors.dangerDark }]}>
                              {formatearCLP(proj.costReal)}
                            </Text>
                          </View>
                        </View>

                        <View style={[estilos.tarjetaStatsFila, { marginTop: 8 }]}>
                          <View>
                            <Text style={estilos.tarjetaStatEtiqueta}>COSTO HH / MATERIALES</Text>
                            <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                              HH: {formatearCLP(proj.costRealHours || 0)} | Mat: {formatearCLP(proj.costRealMaterials || 0)}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={estilos.tarjetaStatEtiqueta}>MARGEN BRUTO</Text>
                            <Text
                              style={[
                                estilos.tarjetaStatValor,
                                {
                                  color: margen >= 0 ? tema.colors.okDark : tema.colors.dangerDark,
                                  fontWeight: "bold",
                                },
                              ]}
                            >
                              {formatearCLP(margen)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 920 }}>
                  <View style={{ minWidth: 920, flex: 1 }}>
                    <View style={estilos.tablaEncabezadoFila}>
                      <Text style={[estilos.thCelda, { width: 90 }]}>Código</Text>
                      <Text style={[estilos.thCelda, { width: 190 }]}>Proyecto & Cliente</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Presupuesto ($)</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Costo Real H27</Text>
                      <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>Costo HH ($)</Text>
                      <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>Costo Mat ($)</Text>
                      <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Margen ($)</Text>
                      <Text style={[estilos.thCelda, { width: 90, textAlign: "center" }]}>Estado</Text>
                    </View>

                    {filtradoProyectos.map((p: any) => {
                      const margen = p.budget - p.costReal;
                      return (
                        <View key={p.id} style={estilos.tablaFila}>
                          <Text style={[estilos.tdCelda, { width: 90, fontWeight: "600" }]}>{p.code}</Text>
                          <View style={{ width: 190 }}>
                            <Text style={estilos.filaPrincipalTexto}>{p.name}</Text>
                            <Text style={estilos.filaSubTexto}>{p.client}</Text>
                          </View>
                          <Text style={[estilos.tdCelda, { width: 110, textAlign: "right" }]}>
                            {formatearCLP(p.budget)}
                          </Text>
                          <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
                            {formatearCLP(p.costReal)}
                          </Text>
                          <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textMuted }]}>
                            {formatearCLP(p.costRealHours || 0)}
                          </Text>
                          <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textMuted }]}>
                            {formatearCLP(p.costRealMaterials || 0)}
                          </Text>
                          <Text
                            style={[
                              estilos.tdCelda,
                              {
                                width: 110,
                                textAlign: "right",
                                fontWeight: "bold",
                                color: margen >= 0 ? tema.colors.okDark : tema.colors.dangerDark,
                              },
                            ]}
                          >
                            {formatearCLP(margen)}
                          </Text>
                          <View style={{ width: 90, alignItems: "center" }}>
                            <InsigniaEstado status={p.status} label={p.status.toUpperCase()} />
                          </View>
                        </View>
                      );
                    })}

                    <View style={estilos.totalsFila}>
                      <View style={{ width: 280 }}>
                        <Text style={estilos.totalsTitulo}>
                          TOTALES CONSOLIDADOS ({proyectosTotals.count} Obras):
                        </Text>
                      </View>
                      <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
                        {formatearCLP(proyectosTotals.totalBudget)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
                        {formatearCLP(proyectosTotals.totalCostReal)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>
                        {formatearCLP(proyectosTotals.totalCostHours)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>
                        {formatearCLP(proyectosTotals.totalCostMaterials)}
                      </Text>
                      <Text
                        style={[
                          estilos.totalsCeldaBold,
                          {
                            width: 110,
                            textAlign: "right",
                            color: proyectosTotals.totalMargin >= 0 ? tema.colors.okDark : tema.colors.dangerDark,
                          },
                        ]}
                      >
                        {formatearCLP(proyectosTotals.totalMargin)}
                      </Text>
                      <Text style={[estilos.totalsCelda, { width: 90, textAlign: "center" }]}>-</Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
    </>
  );
};
