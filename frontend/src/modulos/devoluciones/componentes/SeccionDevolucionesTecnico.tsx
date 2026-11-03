import React, { useState } from "react";
import {
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
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { OrdenDevolucion, ItemOrdenDevolucion, DevolucionProveedor } from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesSeccionDevolucionesTecnico {
  activoPestana: any;
  activoProyectos: any;
  establecerRetElementos: any;
  establecerSeleccionadoProyectoId: any;
  manejarAgregarDevolucionElemento: any;
  manejarGuardarTecnicoDevolucion: any;
  manejarQuitarDevolucionElemento: any;
  ordenesDevolucion: any;
  productos: any;
  retElementos: any;
  retError: any;
  retExito: any;
  seleccionadoProyectoId: any;
  tieneFormularioErrores: any;
  width: any;
}

export const SeccionDevolucionesTecnico: React.FC<PropiedadesSeccionDevolucionesTecnico> = ({
  activoPestana,
  activoProyectos,
  establecerRetElementos,
  establecerSeleccionadoProyectoId,
  manejarAgregarDevolucionElemento,
  manejarGuardarTecnicoDevolucion,
  manejarQuitarDevolucionElemento,
  ordenesDevolucion,
  productos,
  retElementos,
  retError,
  retExito,
  seleccionadoProyectoId,
  tieneFormularioErrores,
  width,
}) => {
  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TAB TÉCNICO: DEVOLUCIÓN DE SOBRANTE Y SEGUIMIENTO                      */}
      {/* ========================================================================= */}
      {activoPestana === "tecnico" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <Tarjeta variant="elevated">
            <View style={estilos.tarjetaEncabezadoFila}>
              <View>
                <View style={estilos.tecnicoInsigniaFila}>
                  <Insignia label="Terreno" tone="primary" size="sm" />
                  <Text style={estilos.tecnicoInsigniaHint}>Declaración de Sobrante</Text>
                </View>
                <Text style={estilos.seccionTitulo}>Formulario de Devolución de Sobrante</Text>
                <Text style={estilos.seccionSubtitulo}>
                  Fórmula estricta: Sobrante Máximo = Retirado − Usado en Terreno
                </Text>
              </View>
              <View style={estilos.formulaInsignia}>
                <Ionicons name="calculator-outline" size={16} color={tema.colors.primary} />
                <Text style={estilos.formulaTexto}>Máx = Retirado − Usado</Text>
              </View>
            </View>

            {/* Selector de Proyecto Activo */}
            <Text style={estilos.campoEtiqueta}>1. Seleccione Proyecto / Faena de Origen:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
              {activoProyectos.map((p: any) => {
                const esSeleccionado = seleccionadoProyectoId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => establecerSeleccionadoProyectoId(p.id)}
                    style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={14}
                      color={esSeleccionado ? "#ffffff" : tema.colors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}>
                      {p.code} - {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Insumos a Devolver con Cuadratura */}
            <View style={estilos.elementosEncabezadoFila}>
              <Text style={estilos.campoEtiqueta}>2. Insumos y Cuadratura de Material:</Text>
              <TouchableOpacity onPress={manejarAgregarDevolucionElemento} style={estilos.agregarPequenoBoton}>
                <Ionicons name="add" size={14} color={tema.colors.primary} />
                <Text style={estilos.agregarPequenoTexto}>+ Agregar Insumo</Text>
              </TouchableOpacity>
            </View>

            {retElementos.map((item: any, idx: any) => {
              const producto = productos.find((p: any) => p.sku === item.sku);
              const maxAllowed = Math.max(0, item.quantityRetrieved - item.quantityUsed);
              const exceedsMaximo = item.quantityReturned > maxAllowed;
              const esInvalidoZero = item.quantityReturned <= 0;

              return (
                <View key={idx} style={[estilos.devolucionElementoTarjeta, (exceedsMaximo || esInvalidoZero) && estilos.devolucionElementoTarjetaError]}>
                  <View style={estilos.elementoTarjetaSuperior}>
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.elementoNombreTexto}>{producto ? producto.name : item.sku}</Text>
                      <Text style={estilos.elementoSkuTexto}>
                        SKU: {item.sku} • Unidad: {producto ? producto.unit : "un"}
                      </Text>
                    </View>
                    {retElementos.length > 1 && (
                      <TouchableOpacity onPress={() => manejarQuitarDevolucionElemento(idx)} style={estilos.quitarBoton}>
                        <Ionicons name="trash-outline" size={16} color={tema.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Cuadratura: Retirado - Usado = Máx */}
                  <View style={estilos.cantidadInputsFila}>
                    <View style={estilos.cantidadColumna}>
                      <Text style={estilos.cantidadEtiqueta}>1. Retirado</Text>
                      <TextInput
                        value={String(item.quantityRetrieved)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerRetElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, quantityRetrieved: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.cantidadEntrada}
                      />
                    </View>

                    <Text style={estilos.operatorSign}>−</Text>

                    <View style={estilos.cantidadColumna}>
                      <Text style={estilos.cantidadEtiqueta}>2. Usado</Text>
                      <TextInput
                        value={String(item.quantityUsed)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerRetElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, quantityUsed: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.cantidadEntrada}
                      />
                    </View>

                    <Text style={estilos.operatorSign}>=</Text>

                    <View style={estilos.cantidadColumna}>
                      <Text style={estilos.cantidadEtiqueta}>Máx Sobrante</Text>
                      <View style={[estilos.maximoCaja, maxAllowed === 0 && { backgroundColor: tema.colors.dangerLight }]}>
                        <Text style={[estilos.maximoTexto, maxAllowed === 0 && { color: tema.colors.danger }]}>
                          {maxAllowed} {producto ? producto.unit : "un"}
                        </Text>
                      </View>
                    </View>

                    <View style={estilos.cantidadColumnaDestacado}>
                      <Text style={estilos.cantidadEtiquetaDestacado}>Devuelve a Bodega</Text>
                      <TextInput
                        value={String(item.quantityReturned)}
                        onChangeText={(v: any) => {
                          const val = Number(v) || 0;
                          establecerRetElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, quantityReturned: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[
                          estilos.cantidadEntradaDestacado,
                          (exceedsMaximo || esInvalidoZero) && estilos.cantidadEntradaError,
                        ]}
                      />
                    </View>
                  </View>

                  {/* Advertencia si excede el máximo permitido */}
                  {exceedsMaximo && (
                    <View style={estilos.blockAviso}>
                      <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                      <Text style={estilos.exceedsAdvertencia}>
                        ¡Bloqueo! La cantidad a devolver ({item.quantityReturned}) excede el sobrante máximo ({maxAllowed} = {item.quantityRetrieved} retirado − {item.quantityUsed} usado).
                      </Text>
                    </View>
                  )}

                  {esInvalidoZero && (
                    <View style={estilos.blockAviso}>
                      <Ionicons name="information-circle" size={16} color={tema.colors.warn} />
                      <Text style={[estilos.exceedsAdvertencia, { color: tema.colors.warnDark }]}>
                        Debe ingresar una cantidad mayor a 0 para devolver.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {Boolean(retError) && <Text style={estilos.errorTexto}>{retError}</Text>}
            {Boolean(retExito) && <Text style={estilos.exitoTexto}>{retExito}</Text>}

            <Boton
              title="Registrar Devolución (En tránsito)"
              variant="primary"
              size="md"
              icon="car-outline"
              disabled={tieneFormularioErrores}
              onPress={manejarGuardarTecnicoDevolucion}
              style={{ marginTop: 14, minHeight: 48 }}
              fullWidth={width < 768}
            />
          </Tarjeta>

          {/* ========================================================================= */}
          {/* SEGUIMIENTO VISUAL: EN TRÁNSITO → RECIBIDA                                */}
          {/* ========================================================================= */}
          <Text style={estilos.recentSeccionTitulo}>Seguimiento de Devoluciones (Obra → Bodega):</Text>
          <Text style={estilos.recentSeccionSubtitulo}>
            Monitoreo en vivo de materiales devueltos desde faena hacia bodega central.
          </Text>

          {ordenesDevolucion.length === 0 ? (
            <EstadoVacio
              icon="return-down-back-outline"
              title="Sin devoluciones registradas"
              description="No hay devoluciones de materiales registradas desde faenas hacia bodega."
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            ordenesDevolucion.map((ret: any) => {
              const esTransit = ret.status === "en_transito";
            return (
              <Tarjeta key={ret.id} variant="default" style={estilos.historialTarjeta}>
                <View style={estilos.historialSuperior}>
                  <View style={{ flex: 1 }}>
                    <View style={estilos.codigoFila}>
                      <Text style={estilos.historialCodigo}>{ret.code}</Text>
                      <InsigniaEstado status={ret.status} size="sm" />
                    </View>
                    <Text style={estilos.historialProyecto}>{ret.projectName} ({ret.projectCode})</Text>
                    <Text style={estilos.historialTecnico}>
                      Técnico: {ret.technicianName} • Fecha: {formatearFecha(ret.date)}
                    </Text>
                  </View>
                </View>

                {/* STEPPER VISUAL: EN TRÁNSITO → RECIBIDA */}
                <View style={estilos.timelineAjustador}>
                  <View style={estilos.pasoElemento}>
                    <View style={[estilos.pasoCirculo, estilos.pasoCirculoDone]}>
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    </View>
                    <Text style={estilos.pasoEtiqueta}>1. Obra</Text>
                  </View>

                  <View style={[estilos.pasoLinea, esTransit ? estilos.pasoLineaActivo : estilos.pasoLineaDone]} />

                  <View style={estilos.pasoElemento}>
                    <View style={[estilos.pasoCirculo, esTransit ? estilos.pasoCirculoActivo : estilos.pasoCirculoDone]}>
                      <Ionicons name={esTransit ? "car" : "checkmark"} size={12} color="#ffffff" />
                    </View>
                    <Text style={[estilos.pasoEtiqueta, esTransit && estilos.pasoEtiquetaActivoTexto]}>
                      2. En tránsito
                    </Text>
                  </View>

                  <View style={[estilos.pasoLinea, !esTransit && estilos.pasoLineaDone]} />

                  <View style={estilos.pasoElemento}>
                    <View style={[estilos.pasoCirculo, !esTransit ? estilos.pasoCirculoDone : estilos.pasoCirculoPendiente]}>
                      <Ionicons name={!esTransit ? "cube" : "time-outline"} size={12} color={!esTransit ? "#ffffff" : tema.colors.textMuted} />
                    </View>
                    <Text style={[estilos.pasoEtiqueta, !esTransit && estilos.pasoEtiquetaDoneTexto]}>
                      3. Recibida
                    </Text>
                  </View>
                </View>

                {/* Insumos detallados */}
                <View style={estilos.historialElementosLista}>
                  {ret.items?.map((it: any, idx: any) => (
                    <View key={idx} style={estilos.historialElementoLinea}>
                      <Text style={estilos.historialElementoNombre}>• {it.name}:</Text>
                      <Text style={estilos.historialElementoCantidad}>
                        Declarado: {it.quantityReturned} {it.unit}
                        {it.quantityReceivedReal !== undefined && (
                          <Text style={{ color: tema.colors.ok, fontWeight: "bold" }}>
                            {" "}→ Físico Real: {it.quantityReceivedReal} {it.unit}
                          </Text>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Si hubo discrepancia informada por bodega */}
                {ret.discrepancyNote && (
                  <View style={estilos.discrepancyAlerta}>
                    <Ionicons name="alert-circle" size={16} color={tema.colors.warnDark} style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.discrepancyTitulo}>Observación de Bodeguero:</Text>
                      <Text style={estilos.discrepancyTexto}>"{ret.discrepancyNote}"</Text>
                    </View>
                  </View>
                )}

                {!esTransit && ret.receivedBy && (
                  <Text style={estilos.recibidoPieTexto}>
                    ✓ Recibido en bodega por {ret.receivedBy} el {formatearFecha(ret.receivedAt || ret.date)}
                  </Text>
                )}
              </Tarjeta>
            );
          })
        )}
        </ScrollView>
      )}
    </>
  );
};
