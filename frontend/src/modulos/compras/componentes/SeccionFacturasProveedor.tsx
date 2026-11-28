import React, { useEffect, useState } from "react";
import {
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
import { formatearCLP, formatearFecha, esRutValido } from "@/nucleo/formato";
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
  ModalEscanerQr,
  CalificacionEstrellas,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  Cliente,
  FacturaCompra,
  ItemFacturaCompra,
  OrdenCompra,
  ItemOrdenCompra,
  Proveedor,
  CalificacionProveedor,
} from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesSeccionFacturasProveedor {
  activoPestana: any;
  calculatedFacturaElementos: any;
  esFacturaDuplicate: any;
  establecerInvElementos: any;
  establecerInvNumero: any;
  establecerInvOrdenCodigo: any;
  establecerInvProveedorId: any;
  facturaIva: any;
  facturaSubtotalNeto: any;
  facturaTotal: any;
  invElementos: any;
  invError: any;
  invNumero: any;
  invOrdenCodigo: any;
  invProveedorId: any;
  manejarGuardarFactura: any;
  productos: any;
  proveedores: any;
}

export const SeccionFacturasProveedor: React.FC<PropiedadesSeccionFacturasProveedor> = ({
  activoPestana,
  calculatedFacturaElementos,
  esFacturaDuplicate,
  establecerInvElementos,
  establecerInvNumero,
  establecerInvOrdenCodigo,
  establecerInvProveedorId,
  facturaIva,
  facturaSubtotalNeto,
  facturaTotal,
  invElementos,
  invError,
  invNumero,
  invOrdenCodigo,
  invProveedorId,
  manejarGuardarFactura,
  productos,
  proveedores,
}) => {
  return (
    <>
      {/* =====================================================================
          2. TAB FACTURAS CON CASCADA E IVA (BODEGUERO Y ADMIN)
          ===================================================================== */}
      {activoPestana === "facturas" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <Tarjeta variant="elevated">
            <Text style={estilos.seccionTitulo}>Ingreso de Factura de Compra (Bodeguero)</Text>
            <Text style={estilos.seccionSubtitulo}>
              Valida duplicados por proveedor, calcula hasta 3 descuentos en cascada e IVA (19%) en vivo.
            </Text>

            <View style={estilos.formularioFilaTwo}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={estilos.campoEtiqueta}>Proveedor:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {proveedores
                    .filter((s: any) => !s.disabled)
                    .map((s: any) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => establecerInvProveedorId(s.id)}
                        style={[
                          estilos.chipBoton,
                          invProveedorId === s.id && estilos.chipBotonActivo,
                        ]}
                      >
                        <Text style={[estilos.chipTexto, invProveedorId === s.id && estilos.chipTextoActivo]}>
                          {s.tradeName || s.businessName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>

            <View style={estilos.formularioFilaTwo}>
              <CampoTexto
                label="Número de Factura"
                value={invNumero}
                onChangeText={establecerInvNumero}
                placeholder="Ej: FAC-89301"
                containerStyle={{ flex: 1, marginRight: 8 }}
              />
              <CampoTexto
                label="OC Relacionada (Opcional)"
                value={invOrdenCodigo}
                onChangeText={establecerInvOrdenCodigo}
                placeholder="Ej: OC-2026-101"
                containerStyle={{ flex: 1 }}
              />
            </View>

            {/* Aviso de validación de duplicados */}
            {esFacturaDuplicate && (
              <View style={estilos.duplicateAvisoCaja}>
                <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                <Text style={estilos.duplicateAvisoTexto}>
                  Atención: Ya existe la Factura N° {invNumero} registrada para este proveedor.
                </Text>
              </View>
            )}

            {/* Insumos con hasta 3 descuentos en cascada */}
            <Text style={estilos.formularioSeccionEtiqueta}>Ítems con Descuentos en Cascada (%):</Text>
            {invElementos.map((item: any, idx: any) => {
              const calculo = calculatedFacturaElementos[idx];
              const producto = productos.find((p: any) => p.sku === item.sku);

              // Cálculo del PMP resultante en vivo:
              // PMP nuevo = (Stock actual * PMP actual + Cantidad Factura * P. Neto Factura) / (Stock actual + Cantidad Factura)
              const curExistencia = producto?.stock || 0;
              const curPmp = producto?.pmp || producto?.unitCost || 0;
              const incomingCantidad = item.quantity || 0;
              const incomingNetoUnidad = calculo?.netUnitPrice || 0;
              const totalNuevoCantidad = curExistencia + incomingCantidad;
              const projectedPmp =
                totalNuevoCantidad > 0
                  ? Math.round((curExistencia * curPmp + incomingCantidad * incomingNetoUnidad) / totalNuevoCantidad)
                  : incomingNetoUnidad;

              return (
                <View key={idx} style={estilos.facturaElementoTarjeta}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={estilos.elementoSkuTexto}>{calculo.name} ({calculo.sku})</Text>
                    <Pressable
                      onPress={() => {
                        if (invElementos.length > 1) {
                          establecerInvElementos((prev: any) => prev.filter((_: any, i: any) => i !== idx));
                        }
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                    </Pressable>
                  </View>

                  <View style={estilos.descuentoFila}>
                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Cantidad</Text>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, quantity: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.discEntrada}
                      />
                    </View>

                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>P. Bruto ($)</Text>
                      <TextInput
                        value={String(item.grossPrice)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, grossPrice: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.discEntrada}
                      />
                    </View>

                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Desc 1 %</Text>
                      <TextInput
                        value={String(item.disc1)}
                        onChangeText={(v: any) => {
                          const val = Number(v) || 0;
                          establecerInvElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, disc1: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.discEntrada}
                      />
                    </View>

                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Desc 2 %</Text>
                      <TextInput
                        value={String(item.disc2)}
                        onChangeText={(v: any) => {
                          const val = Number(v) || 0;
                          establecerInvElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, disc2: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.discEntrada}
                      />
                    </View>

                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Desc 3 %</Text>
                      <TextInput
                        value={String(item.disc3)}
                        onChangeText={(v: any) => {
                          const val = Number(v) || 0;
                          establecerInvElementos((prev: any) =>
                            prev.map((it: any, i: any) => (i === idx ? { ...it, disc3: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={estilos.discEntrada}
                      />
                    </View>
                  </View>

                  <View style={estilos.calculatedElementoPie}>
                    <Text style={estilos.calculoNetoUnidad}>
                      P. Neto Unitario (con cascada): {formatearCLP(calculo.netUnitPrice)}
                    </Text>
                    <Text style={estilos.calculoSubtotal}>
                      Subtotal Neto: {formatearCLP(calculo.subtotalNet)}
                    </Text>
                  </View>

                  {/* Tarjeta con el PMP resultante en vivo */}
                  <View style={estilos.pmpImpactTarjeta}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="trending-up" size={14} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={estilos.pmpImpactTitulo}>Proyección de PMP en Bodega:</Text>
                    </View>
                    <Text style={estilos.pmpImpactTexto}>
                      Stock Actual: {curExistencia} {producto?.unit} @ {formatearCLP(curPmp)} → Nuevo PMP Proyectado:{" "}
                      <Text style={{ fontWeight: "bold", color: tema.colors.primaryDark }}>
                        {formatearCLP(projectedPmp)}
                      </Text>
                    </Text>
                  </View>
                </View>
              );
            })}

            <Boton
              title="+ Agregar otro ítem"
              variant="outline"
              size="sm"
              onPress={() => {
                const siguienteP = productos.find((p: any) => !invElementos.some((i: any) => i.sku === p.sku)) || productos[0];
                establecerInvElementos((prev: any) => [
                  ...prev,
                  { sku: siguienteP.sku, quantity: 1, grossPrice: siguienteP.unitCost, disc1: 0, disc2: 0, disc3: 0 },
                ]);
              }}
              style={{ marginVertical: 8 }}
            />

            {/* RESUMEN FINANCIERO EN VIVO */}
            <View style={estilos.financialResumenTarjeta}>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>Subtotal Neto:</Text>
                <Text style={estilos.resumenValor}>{formatearCLP(facturaSubtotalNeto)}</Text>
              </View>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>IVA (19%):</Text>
                <Text style={estilos.resumenValor}>{formatearCLP(facturaIva)}</Text>
              </View>
              <View style={[estilos.resumenLinea, estilos.resumenTotalLinea]}>
                <Text style={estilos.totalEtiquetaBig}>Total Factura:</Text>
                <Text style={estilos.totalValorBig}>{formatearCLP(facturaTotal)}</Text>
              </View>

              {/* Aviso explícito del impacto de stock */}
              <View style={estilos.existenciaAvisoCaja}>
                <Ionicons name="information-circle" size={18} color={tema.colors.info} style={{ marginRight: 6 }} />
                <Text style={estilos.existenciaAvisoTexto}>
                  Aviso: El stock físico y el PMP se consolidan y actualizan automáticamente en inventario al confirmar la recepción conforme de la mercancía.
                </Text>
              </View>
            </View>

            {Boolean(invError) && <Text style={estilos.errorTexto}>{invError}</Text>}

            <Boton
              title="Registrar Factura"
              variant="primary"
              icon="save-outline"
              disabled={esFacturaDuplicate}
              onPress={manejarGuardarFactura}
              style={{ marginTop: 12 }}
            />
          </Tarjeta>
        </ScrollView>
      )}
    </>
  );
};
