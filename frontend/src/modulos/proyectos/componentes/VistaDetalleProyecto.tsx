import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  EncabezadoPagina,
  BarraProgreso,
} from "@/componentes/comunes";
import { AsignacionTecnicos } from "@/componentes/AsignacionTecnicos";
import {
  DistintivoEstadoProyecto,
  IndicadorUltimaSincronizacion,
} from "@/componentes/DistintivoEstadoProyecto";
import { estilos } from "../estilos";
import { PanelGraficosRentabilidadProyecto } from "./SeccionRentabilidadFinalAdmin";

export interface PropiedadesVistaDetalleProyecto {
  asignarTecnicosAProyecto: any;
  detallePestana: any;
  establecerAdminManualError: any;
  establecerAdminManualFecha: any;
  establecerAdminManualHoras: any;
  establecerAdminManualModalAbrir: any;
  establecerDetallePestana: any;
  establecerSeleccionadoProyecto: any;
  manejarAbrirCerrarModal: any;
  manejarAbrirEditarProyecto: any;
  mostrarAviso: any;
  rolActual: any;
  seleccionadoProyecto: any;
  tecnicos: any;
}

export const VistaDetalleProyecto: React.FC<PropiedadesVistaDetalleProyecto> = ({
  asignarTecnicosAProyecto,
  detallePestana,
  establecerAdminManualError,
  establecerAdminManualFecha,
  establecerAdminManualHoras,
  establecerAdminManualModalAbrir,
  establecerDetallePestana,
  establecerSeleccionadoProyecto,
  manejarAbrirCerrarModal,
  manejarAbrirEditarProyecto,
  mostrarAviso,
  rolActual,
  seleccionadoProyecto,
  tecnicos,
}) => {
  const [ultimaSincronizacion, establecerUltimaSincronizacion] = useState<Date>(
    () => new Date()
  );

  return (
    <>
      <View style={estilos.vistaEnvoltorio}>
        {/* Encabezado con Migas de Pan y Botón Volver (Ancho completo edge-to-edge) */}
        <EncabezadoPagina
          title={`${seleccionadoProyecto.code} - ${seleccionadoProyecto.name}`}
          subtitle={`Cliente: ${seleccionadoProyecto.client} • Dirección: ${seleccionadoProyecto.address}`}
          breadcrumbs={[
            { label: "Inicio" },
            { label: "Proyectos", onPress: () => establecerSeleccionadoProyecto(null) },
            { label: seleccionadoProyecto.code },
          ]}
          onBack={() => establecerSeleccionadoProyecto(null)}
        />

        <ScrollView style={estilos.detalleContenedor} contentContainerStyle={estilos.detalleScroll}>
          {/* [FRONT-2] Indicador de última sincronización */}
          <IndicadorUltimaSincronizacion
            ultimaSincronizacion={ultimaSincronizacion}
            onSincronizar={() => establecerUltimaSincronizacion(new Date())}
            compacto
            style={{ marginBottom: 12 }}
          />

          {/* Encabezado del Proyecto */}
          <Tarjeta variant="elevated" style={estilos.detalleEncabezadoTarjeta}>
            <View style={estilos.detalleSuperiorFila}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={estilos.detalleCodigo}>{seleccionadoProyecto.code}</Text>
                  <Insignia
                    label={seleccionadoProyecto.kind === "obra" ? "OBRA" : "MANTENCIÓN"}
                    tone={seleccionadoProyecto.kind === "obra" ? "info" : "warn"}
                    size="sm"
                    style={{ marginLeft: 6 }}
                  />
                </View>
                <Text style={estilos.detalleNombre}>{seleccionadoProyecto.name}</Text>
                <Text style={estilos.detalleCliente}>Cliente: {seleccionadoProyecto.client}</Text>
              </View>

              <DistintivoEstadoProyecto
                estado={seleccionadoProyecto.status}
                tamano="md"
                mostrarPrefijo
              />
            </View>

            <View style={estilos.detalleMetaFila}>
              <Text style={estilos.metaElemento}>Dirección: {seleccionadoProyecto.address}</Text>
              <Text style={estilos.metaElemento}>Inicio: {formatearFecha(seleccionadoProyecto.startDate)}</Text>
              <Text style={estilos.metaElemento}>Límite: {formatearFecha(seleccionadoProyecto.deadline)}</Text>
              {seleccionadoProyecto.closedBy && (
                <Text style={[estilos.metaElemento, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                  Cerrado por: {seleccionadoProyecto.closedBy} ({formatearFecha(seleccionadoProyecto.closedAt || "")})
                </Text>
              )}
            </View>

            {/* Acciones de Cabecera: Editar (no editable si cerrado) y Cerrar Proyecto */}
            <View style={estilos.detalleAccionesFila}>
              {rolActual === "admin" && (
                <>
                  {seleccionadoProyecto.status !== "cerrado" ? (
                    <>
                      <Boton
                        title="Editar Proyecto"
                        variant="outline"
                        size="sm"
                        icon="create-outline"
                        onPress={() => manejarAbrirEditarProyecto(seleccionadoProyecto)}
                        style={{ marginRight: 8 }}
                      />
                      <Boton
                        title="Cerrar Proyecto"
                        variant="danger"
                        size="sm"
                        icon="lock-closed-outline"
                        onPress={() => manejarAbrirCerrarModal(seleccionadoProyecto)}
                      />
                    </>
                  ) : (
                    <DistintivoEstadoProyecto
                      estado="Cerrado"
                      tamano="md"
                      mostrarPrefijo
                    />
                  )}
                </>
              )}
            </View>
          </Tarjeta>

          {/* PESTAÑAS DEL DETALLE */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.detallePestanasScroll}>
            {[
              { id: "resumen", label: "Resumen y Margen" },
              { id: "tecnicos", label: `Técnicos (${seleccionadoProyecto.technicianRuts.length})` },
              { id: "insumos", label: `Insumos y Egresos (${seleccionadoProyecto.dispatches?.length || 0})` },
              { id: "horas", label: `Horas Hombre (${seleccionadoProyecto.laborEntries?.length || 0})` },
              { id: "rentabilidad", label: "Rentabilidad (Cerrado)" },
            ].map((t: any) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => establecerDetallePestana(t.id as any)}
                style={[estilos.detallePestanaChip, detallePestana === t.id && estilos.detallePestanaChipActivo]}
              >
                <Text
                  style={[
                    estilos.detallePestanaChipTexto,
                    detallePestana === t.id && estilos.detallePestanaChipTextoActivo,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ---------------- 1. PESTAÑA RESUMEN (SEMÁFORO Y MARGEN) ---------------- */}
          {detallePestana === "resumen" && (
            <Tarjeta variant="default">
              <Text style={estilos.subTitulo}>Semáforo de Costo y Margen Estimado</Text>

              {(() => {
                const ratio = seleccionadoProyecto.budget > 0 ? seleccionadoProyecto.costReal / seleccionadoProyecto.budget : 0;
                const porcentaje = Math.round(ratio * 100);
                const estimatedRentabilidad = seleccionadoProyecto.saleValue - seleccionadoProyecto.costReal;
                const margenPorcentaje =
                  seleccionadoProyecto.saleValue > 0
                    ? Math.round((estimatedRentabilidad / seleccionadoProyecto.saleValue) * 100)
                    : 0;

                let semTono: "ok" | "warn" | "danger" = "ok";
                if (ratio > 1.0) {
                  semTono = "danger";
                } else if (ratio >= 0.8) {
                  semTono = "warn";
                }

                return (
                  <View style={estilos.financialResumenBlock}>
                    <View style={estilos.detalleSemaphoreFila}>
                      <Text style={estilos.subTitulo}>Ejecución y Margen Estimado</Text>
                      <View style={estilos.semaphoreIndicatorPastilla}>
                        <View
                          style={[
                            estilos.semaphorePunto,
                            {
                              backgroundColor:
                                semTono === "ok"
                                  ? tema.colors.ok
                                  : semTono === "warn"
                                  ? tema.colors.warn
                                  : tema.colors.danger,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            estilos.semaphorePorcentajeTexto,
                            {
                              color:
                                semTono === "ok"
                                  ? tema.colors.ok
                                  : semTono === "warn"
                                  ? tema.colors.warnDark
                                  : tema.colors.danger,
                            },
                          ]}
                        >
                          {porcentaje}% ejecutado
                        </Text>
                      </View>
                    </View>

                    <BarraProgreso
                      value={seleccionadoProyecto.costReal}
                      max={seleccionadoProyecto.budget}
                      height={4}
                      semaforo
                    />

                    <View style={estilos.metricsGrilla}>
                      <View style={estilos.metricCelda}>
                        <Text style={estilos.metricLbl}>Presupuesto Total</Text>
                        <Text style={estilos.metricValor}>{formatearCLP(seleccionadoProyecto.budget)}</Text>
                      </View>
                      <View style={estilos.metricCelda}>
                        <Text style={estilos.metricLbl}>Costo Real Acumulado</Text>
                        <Text style={[estilos.metricValor, semTono === "danger" && { color: tema.colors.danger }]}>
                          {formatearCLP(seleccionadoProyecto.costReal)}
                        </Text>
                      </View>
                      <View style={estilos.metricCelda}>
                        <Text style={estilos.metricLbl}>Valor de Venta</Text>
                        <Text style={estilos.metricValor}>{formatearCLP(seleccionadoProyecto.saleValue)}</Text>
                      </View>
                      <View style={estilos.metricCelda}>
                        <Text style={estilos.metricLbl}>Margen Estimado de Obra</Text>
                        <Text
                          style={[
                            estilos.metricValor,
                            { color: estimatedRentabilidad >= 0 ? tema.colors.ok : tema.colors.danger },
                          ]}
                        >
                          {formatearCLP(estimatedRentabilidad)} ({margenPorcentaje}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </Tarjeta>
          )}

          {/* ---------------- 2. PESTAÑA TÉCNICOS (SIN DUPLICADOS) ---------------- */}
          {detallePestana === "tecnicos" && (
            <AsignacionTecnicos
              proyectoIdInicial={seleccionadoProyecto.id}
              onAviso={mostrarAviso}
              titulo={`Asignación de Técnicos — ${seleccionadoProyecto.code}`}
            />
          )}

          {/* ---------------- 3. PESTAÑA INSUMOS Y EGRESOS ---------------- */}
          {detallePestana === "insumos" && (
            <Tarjeta variant="default">
              <Text style={estilos.subTitulo}>Egresos de Materiales a Obra</Text>
              <Text style={estilos.subDescripcion}>
                Detalle de despachos físicos retirados en bodega e imputados al costo del proyecto:
              </Text>

              {seleccionadoProyecto.dispatches && seleccionadoProyecto.dispatches.length > 0 ? (
                <>
                  {seleccionadoProyecto.dispatches.map((dsp: any) => (
                    <View key={dsp.id} style={estilos.despachoFila}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={estilos.dspProducto}>{dsp.productName}</Text>
                        <Text style={estilos.dspMeta}>
                          {dsp.dispatchCode} • {dsp.date} • Retiró: {dsp.deliveredTo}
                        </Text>
                        <Text style={estilos.dspMeta}>SKU: {dsp.sku} @ PMP: {formatearCLP(dsp.unitCost)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={estilos.dspCantidad}>{dsp.quantity} {dsp.unit}</Text>
                        <Text style={estilos.dspTotal}>{formatearCLP(dsp.totalCost)}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={estilos.accumulatedCaja}>
                    <Text style={estilos.accumulatedEtiqueta}>Total Materiales Consumidos:</Text>
                    <Text style={estilos.accumulatedValor}>
                      {formatearCLP(
                        seleccionadoProyecto.dispatches.reduce((acc: any, d: any) => acc + d.totalCost, 0)
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <EstadoVacio
                  icon="cube-outline"
                  title="Sin egresos de material"
                  description="No hay egresos de material registrados para este proyecto."
                  containerStyle={{ marginVertical: 16 }}
                />
              )}
            </Tarjeta>
          )}

          {/* ---------------- 4. PESTAÑA HORAS HOMBRE ---------------- */}
          {detallePestana === "horas" && (
            <Tarjeta variant="default">
              <View style={estilos.hhPestanaEncabezadoFila}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={estilos.subTitulo}>Horas Hombre (HH) Trabajadas en Terreno</Text>
                  <Text style={estilos.subDescripcion}>
                    Jornadas laborales ejecutadas por el equipo técnico en faena:
                  </Text>
                </View>
                {seleccionadoProyecto.status !== "cerrado" && (
                  <Boton
                    title="+ Carga Manual (Admin)"
                    size="sm"
                    variant="primary"
                    icon="time-outline"
                    onPress={() => {
                      establecerAdminManualError("");
                      establecerAdminManualHoras(8.0);
                      establecerAdminManualFecha(new Date().toISOString().slice(0, 10));
                      establecerAdminManualModalAbrir(true);
                    }}
                  />
                )}
              </View>

              {seleccionadoProyecto.laborEntries && seleccionadoProyecto.laborEntries.length > 0 ? (
                <>
                  {seleccionadoProyecto.laborEntries.map((hh: any) => (
                    <View key={hh.id} style={estilos.laborFila}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <Text style={estilos.laborTecnico}>{hh.technicianName}</Text>
                          {hh.registeredBy === "admin_manual" && (
                            <Insignia label="MANUAL" tone="warn" size="sm" />
                          )}
                        </View>
                        <Text style={estilos.laborDescripcion}>{hh.description}</Text>
                        <Text style={estilos.laborFecha}>Fecha: {hh.date} • Costo HH: {formatearCLP(hh.hourlyCost)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={estilos.laborHoras}>{hh.hours} HH</Text>
                        <Text style={estilos.laborCosto}>{formatearCLP(hh.totalCost)}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={estilos.accumulatedCaja}>
                    <Text style={estilos.accumulatedEtiqueta}>Total Mano de Obra Acumulada:</Text>
                    <Text style={estilos.accumulatedValor}>
                      {formatearCLP(
                        seleccionadoProyecto.laborEntries.reduce((acc: any, h: any) => acc + h.totalCost, 0)
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <EstadoVacio
                  icon="time-outline"
                  title="Sin jornadas registradas"
                  description="No hay jornadas laborales registradas para este proyecto."
                  containerStyle={{ marginVertical: 16 }}
                />
              )}
            </Tarjeta>
          )}

          {/* ---------------- 5. PESTAÑA RENTABILIDAD (SOLO SI ESTÁ CERRADO) ---------------- */}
          {detallePestana === "rentabilidad" && (
            <Tarjeta variant="default">
              <Text style={estilos.subTitulo}>Liquidación y Rentabilidad Final del Proyecto</Text>

              {seleccionadoProyecto.status !== "cerrado" ? (
                <View style={estilos.lockCaja}>
                  <Ionicons name="lock-closed" size={36} color={tema.colors.textMuted} />
                  <Text style={estilos.lockTitulo}>Rentabilidad No Disponible</Text>
                  <Text style={estilos.lockSub}>
                    El informe final de rentabilidad, balance y composición de costos se activa exclusivamente cuando el proyecto ha sido CERRADO contablemente.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <PanelGraficosRentabilidadProyecto proyecto={seleccionadoProyecto} />
                </View>
              )}
            </Tarjeta>
          )}
        </ScrollView>
      </View>
    </>
  );
};
