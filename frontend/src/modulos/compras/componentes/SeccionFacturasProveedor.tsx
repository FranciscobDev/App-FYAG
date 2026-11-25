import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
  CampoTexto,
} from "@/componentes/comunes";
import {
  FacturaCompra,
  ItemFacturaCompra,
  OrdenCompra,
} from "@/nucleo/tipos";
import {
  ResultadoDiscrepanciaFacturaRecepcion,
  calcularLineaFacturaCascada,
} from "../facturaCalculoUtils";
import { estilos } from "../estilos";

export interface PropiedadesSeccionFacturasProveedor {
  activoPestana: any;
  calculatedFacturaElementos: ItemFacturaCompra[];
  discrepanciaFacturaRecepcion?: ResultadoDiscrepanciaFacturaRecepcion;
  esFacturaDuplicate: boolean;
  establecerInvElementos: any;
  establecerInvNumero: any;
  establecerInvOrdenCodigo: any;
  establecerInvProveedorId: any;
  facturaIva: number;
  facturaSubtotalBruto?: number;
  facturaSubtotalNeto: number;
  facturaTotal: number;
  facturaTotalDescuentos?: number;
  facturasCompra?: FacturaCompra[];
  invElementos: any[];
  invError: string;
  invNumero: string;
  invOrdenCodigo: string;
  invProveedorId: string;
  manejarGuardarFactura: () => void;
  ordenCompraVinculadaFactura?: OrdenCompra | null;
  ordenesCompra?: OrdenCompra[];
  productos: any[];
  proveedores: any[];
}

export const SeccionFacturasProveedor: React.FC<PropiedadesSeccionFacturasProveedor> = ({
  activoPestana,
  calculatedFacturaElementos,
  discrepanciaFacturaRecepcion,
  esFacturaDuplicate,
  establecerInvElementos,
  establecerInvNumero,
  establecerInvOrdenCodigo,
  establecerInvProveedorId,
  facturaIva,
  facturaSubtotalBruto = 0,
  facturaSubtotalNeto,
  facturaTotal,
  facturaTotalDescuentos = 0,
  facturasCompra = [],
  invElementos,
  invError,
  invNumero,
  invOrdenCodigo,
  invProveedorId,
  manejarGuardarFactura,
  ordenCompraVinculadaFactura,
  ordenesCompra = [],
  productos,
  proveedores,
}) => {
  const ordenesDelProveedor = ordenesCompra.filter(
    (oc) =>
      oc.status !== "anulada" &&
      (oc.supplierId === invProveedorId ||
        oc.supplierRut?.replace(/[.\s-]/g, "") ===
          proveedores.find((p: any) => p.id === invProveedorId)?.rut?.replace(/[.\s-]/g, ""))
  );

  const cargarLineasDesdeOc = (oc: OrdenCompra, usarCantidadRecibida: boolean) => {
    establecerInvOrdenCodigo(oc.code);
    if (oc.items && oc.items.length > 0) {
      establecerInvElementos(
        oc.items.map((it) => {
          const cantRecibida = Number(it.receivedQuantity || 0);
          const cantidadBase =
            usarCantidadRecibida && cantRecibida > 0 ? cantRecibida : Number(it.quantity || 1);
          return {
            sku: it.sku,
            quantity: cantidadBase,
            grossPrice: Number(it.unitPrice || 0),
            disc1: 0,
            disc2: 0,
            disc3: 0,
          };
        })
      );
    }
  };

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
              Valida duplicados por proveedor, calcula hasta 3 descuentos sucesivos en cascada, Neto, IVA (19%), PMP y detecta discrepancias con la recepción en vivo.
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

            {/* Selector rápido de Órdenes de Compra del proveedor seleccionado */}
            {ordenesDelProveedor.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={estilos.campoEtiqueta}>
                  Vincular con OC del proveedor (clic para asociar y cargar líneas):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {ordenesDelProveedor.map((oc) => {
                    const esOcActiva =
                      invOrdenCodigo.trim().toUpperCase() === oc.code.trim().toUpperCase();
                    const totalRecibido = oc.items.reduce(
                      (acc, it) => acc + Number(it.receivedQuantity || 0),
                      0
                    );
                    const totalPedido = oc.items.reduce(
                      (acc, it) => acc + Number(it.quantity || 0),
                      0
                    );
                    return (
                      <TouchableOpacity
                        key={oc.id}
                        onPress={() => cargarLineasDesdeOc(oc, false)}
                        style={[
                          estilos.ocSeleccionarChip,
                          esOcActiva && estilos.ocSeleccionarChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.ocSeleccionarCodigo,
                            esOcActiva && estilos.ocSeleccionarCodigoActivo,
                          ]}
                        >
                          {oc.code} ({oc.status.replace("_", " ").toUpperCase()})
                        </Text>
                        <Text
                          style={[
                            estilos.ocSeleccionarProveedor,
                            esOcActiva && estilos.ocSeleccionarProveedorActivo,
                          ]}
                        >
                          Recibido: {totalRecibido}/{totalPedido} un • Neto OC: {formatearCLP(oc.subtotal)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Aviso de validación de duplicados */}
            {esFacturaDuplicate && (
              <View style={estilos.duplicateAvisoCaja}>
                <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                <Text style={estilos.duplicateAvisoTexto}>
                  Atención: Ya existe la Factura N° {invNumero} registrada para este proveedor.
                </Text>
              </View>
            )}

            {/* AVISO EN VIVO DE DISCREPANCIA CON LA RECEPCIÓN DE LA OC */}
            {ordenCompraVinculadaFactura && discrepanciaFacturaRecepcion?.tieneDiscrepancia && (
              <View
                style={[
                  estilos.discrepancyBanner,
                  {
                    flexDirection: "column",
                    alignItems: "flex-start",
                    backgroundColor: "#FEF2F2",
                    borderColor: "#EF4444",
                    borderWidth: 1.5,
                    padding: 12,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Ionicons
                    name="warning"
                    size={18}
                    color={tema.colors.danger}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      estilos.discrepancyBannerTexto,
                      { color: tema.colors.danger, fontWeight: "bold", fontSize: 13 },
                    ]}
                  >
                    Aviso de Discrepancia con la Recepción ({ordenCompraVinculadaFactura.code})
                  </Text>
                </View>
                {discrepanciaFacturaRecepcion.detalles.map((det, dIdx) => (
                  <Text
                    key={dIdx}
                    style={{
                      fontSize: 12,
                      color: "#991B1B",
                      marginBottom: 3,
                      lineHeight: 17,
                    }}
                  >
                    • {det.mensaje}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", marginTop: 6, gap: 8, flexWrap: "wrap" }}>
                  <Boton
                    title="Ajustar cantidades a Recepción Conforme"
                    variant="outline"
                    size="sm"
                    onPress={() => cargarLineasDesdeOc(ordenCompraVinculadaFactura, true)}
                  />
                </View>
              </View>
            )}

            {/* Banner verde cuando la factura coincide exactamente con la recepción */}
            {ordenCompraVinculadaFactura && !discrepanciaFacturaRecepcion?.tieneDiscrepancia && (
              <View
                style={[
                  estilos.pmpImpactTarjeta,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                    padding: 10,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={tema.colors.okDark}
                  style={{ marginRight: 6 }}
                />
                <Text style={[estilos.pmpImpactTexto, { flex: 1, fontWeight: "600" }]}>
                  Conciliación conforme con {ordenCompraVinculadaFactura.code}: las cantidades e insumos facturados coinciden con la recepción en bodega.
                </Text>
              </View>
            )}

            {/* Insumos con hasta 3 descuentos en cascada */}
            <Text style={estilos.formularioSeccionEtiqueta}>
              Ítems con Desglose en Vivo de 3 Descuentos en Cascada (%):
            </Text>
            {invElementos.map((item: any, idx: number) => {
              const producto = productos.find((p: any) => p.sku === item.sku);
              const desglose = calcularLineaFacturaCascada({
                sku: item.sku,
                name: producto ? producto.name : item.sku,
                unit: producto ? producto.unit : "un",
                quantity: item.quantity,
                grossPrice: item.grossPrice,
                disc1: item.disc1,
                disc2: item.disc2,
                disc3: item.disc3,
                stockActual: producto?.stock || 0,
                pmpActual: producto?.pmp || producto?.unitCost || item.grossPrice,
              });
              const calculo = calculatedFacturaElementos[idx] || desglose;
              const curExistencia = producto?.stock || 0;
              const curPmp = producto?.pmp || producto?.unitCost || 0;
              const itemOcVinculado = ordenCompraVinculadaFactura?.items.find(
                (i) => i.sku.trim().toUpperCase() === String(item.sku || "").trim().toUpperCase()
              );

              return (
                <View key={idx} style={estilos.facturaElementoTarjeta}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={estilos.elementoSkuTexto}>
                      Ítem #{idx + 1}: {desglose.name} ({desglose.sku})
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (invElementos.length > 1) {
                          establecerInvElementos((prev: any[]) => prev.filter((_: any, i: number) => i !== idx));
                        }
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                    </Pressable>
                  </View>

                  {/* Selector de insumo del catálogo */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginVertical: 6 }}
                  >
                    {productos.map((p: any) => {
                      const activoSku = p.sku === item.sku;
                      return (
                        <TouchableOpacity
                          key={p.sku}
                          onPress={() =>
                            establecerInvElementos((prev: any[]) =>
                              prev.map((it: any, i: number) =>
                                i === idx
                                  ? { ...it, sku: p.sku, grossPrice: it.grossPrice || p.unitCost }
                                  : it
                              )
                            )
                          }
                          style={[
                            estilos.estadoChip,
                            activoSku && estilos.estadoChipActivo,
                            { paddingVertical: 4, paddingHorizontal: 10 },
                          ]}
                        >
                          <Text
                            style={[
                              estilos.estadoChipTexto,
                              activoSku && estilos.estadoChipTextoActivo,
                              { fontSize: 11 },
                            ]}
                          >
                            {p.sku} • {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {itemOcVinculado && (
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginBottom: 4 }}>
                      Referencia {ordenCompraVinculadaFactura?.code}: Solicitado {itemOcVinculado.quantity} {itemOcVinculado.unit} | Recibido Conforme:{" "}
                      <Text style={{ fontWeight: "bold", color: tema.colors.okDark }}>
                        {itemOcVinculado.receivedQuantity ?? 0} {itemOcVinculado.unit}
                      </Text>
                      {(itemOcVinculado.defectiveQuantity ?? 0) > 0
                        ? ` | En Cuarentena: ${itemOcVinculado.defectiveQuantity} ${itemOcVinculado.unit}`
                        : ""}
                    </Text>
                  )}

                  <View style={[estilos.descuentoFila, { marginBottom: 6 }]}>
                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Cantidad ({desglose.unit})</Text>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) => (i === idx ? { ...it, quantity: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 38 }]}
                      />
                    </View>

                    <View style={[estilos.discColumna, { marginRight: 0 }]}>
                      <Text style={estilos.discEtiqueta}>Precio Bruto Unitario ($ CLP)</Text>
                      <TextInput
                        value={String(item.grossPrice)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) => (i === idx ? { ...it, grossPrice: valor } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 38 }]}
                      />
                    </View>
                  </View>

                  <View style={estilos.descuentoFila}>
                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Desc. 1 (%)</Text>
                      <TextInput
                        value={String(item.disc1)}
                        onChangeText={(v: any) => {
                          const val = Math.min(100, Math.max(0, Number(v) || 0));
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) => (i === idx ? { ...it, disc1: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 36 }]}
                      />
                    </View>

                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Desc. 2 (% sobre Paso 1)</Text>
                      <TextInput
                        value={String(item.disc2)}
                        onChangeText={(v: any) => {
                          const val = Math.min(100, Math.max(0, Number(v) || 0));
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) => (i === idx ? { ...it, disc2: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 36 }]}
                      />
                    </View>

                    <View style={[estilos.discColumna, { marginRight: 0 }]}>
                      <Text style={estilos.discEtiqueta}>Desc. 3 (% sobre Paso 2)</Text>
                      <TextInput
                        value={String(item.disc3)}
                        onChangeText={(v: any) => {
                          const val = Math.min(100, Math.max(0, Number(v) || 0));
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) => (i === idx ? { ...it, disc3: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 36 }]}
                      />
                    </View>
                  </View>

                  {/* DESGLOSE EN VIVO PASO A PASO DE LOS 3 DESCUENTOS EN CASCADA */}
                  <View
                    style={{
                      backgroundColor: tema.colors.card,
                      borderWidth: 1,
                      borderColor: tema.colors.borderLight,
                      borderRadius: tema.radius.sm,
                      padding: 8,
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: tema.colors.text,
                        marginBottom: 4,
                      }}
                    >
                      Desglose en Vivo de Cascada Unitaria (Efectivo acumulado: {desglose.effectiveDiscountPct}%):
                    </Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                        0. P. Bruto: <Text style={{ fontWeight: "600", color: tema.colors.text }}>{formatearCLP(desglose.grossPrice)}</Text>
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                        1. Tras D1 ({desglose.discount1Pct}% / -{formatearCLP(desglose.discount1UnitAmount)}):{" "}
                        <Text style={{ fontWeight: "600", color: tema.colors.text }}>{formatearCLP(desglose.priceAfterDisc1)}</Text>
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                        2. Tras D2 ({desglose.discount2Pct}% / -{formatearCLP(desglose.discount2UnitAmount)}):{" "}
                        <Text style={{ fontWeight: "600", color: tema.colors.text }}>{formatearCLP(desglose.priceAfterDisc2)}</Text>
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.primaryDark }}>
                        3. Tras D3 ({desglose.discount3Pct}% / -{formatearCLP(desglose.discount3UnitAmount)}):{" "}
                        <Text style={{ fontWeight: "bold" }}>{formatearCLP(desglose.netUnitPrice)}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={[estilos.calculatedElementoPie, { flexWrap: "wrap", gap: 6 }]}>
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                      Subtotal Bruto: {formatearCLP(desglose.subtotalGross)}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.okDark, fontWeight: "600" }}>
                      Ahorro Cascada: -{formatearCLP(desglose.totalDiscountLine)}
                    </Text>
                    <Text style={estilos.calculoNetoUnidad}>
                      P. Neto Unitario: {formatearCLP(calculo.netUnitPrice)}
                    </Text>
                    <Text style={estilos.calculoSubtotal}>
                      Subtotal Neto: {formatearCLP(calculo.subtotalNet)}
                    </Text>
                  </View>

                  {/* Tarjeta con el PMP resultante en vivo */}
                  <View style={estilos.pmpImpactTarjeta}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="trending-up" size={14} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={estilos.pmpImpactTitulo}>Proyección de PMP en Bodega (Fórmula Ponderada):</Text>
                    </View>
                    <Text style={estilos.pmpImpactTexto}>
                      Stock Actual: {curExistencia} {producto?.unit || "un"} @ {formatearCLP(curPmp)} + Ingreso: {desglose.quantity} {desglose.unit} @ {formatearCLP(desglose.netUnitPrice)} → Nuevo PMP:{" "}
                      <Text style={{ fontWeight: "bold", color: tema.colors.primaryDark }}>
                        {formatearCLP(desglose.projectedPmp)}
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
                const siguienteP =
                  productos.find((p: any) => !invElementos.some((i: any) => i.sku === p.sku)) ||
                  productos[0];
                if (!siguienteP) return;
                establecerInvElementos((prev: any[]) => [
                  ...prev,
                  {
                    sku: siguienteP.sku,
                    quantity: 1,
                    grossPrice: siguienteP.unitCost,
                    disc1: 0,
                    disc2: 0,
                    disc3: 0,
                  },
                ]);
              }}
              style={{ marginVertical: 8 }}
            />

            {/* RESUMEN FINANCIERO EN VIVO (COINCIDE 1:1 CON EL BACKEND) */}
            <View style={estilos.financialResumenTarjeta}>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>Total Bruto (sin descuentos):</Text>
                <Text style={estilos.resumenValor}>{formatearCLP(facturaSubtotalBruto)}</Text>
              </View>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>Descuentos en Cascada Aplicados (D1 → D2 → D3):</Text>
                <Text style={[estilos.resumenValor, { color: tema.colors.okDark }]}>
                  -{formatearCLP(facturaTotalDescuentos)}
                </Text>
              </View>
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
                  Aviso: El stock físico disponible y el PMP se consolidan al confirmar la recepción conforme de la mercancía usando el costo neto unitario de la factura.
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

          {/* HISTORIAL DE FACTURAS REGISTRADAS */}
          {facturasCompra.length > 0 && (
            <Tarjeta variant="outlined" style={{ marginTop: 16 }}>
              <Text style={estilos.seccionTitulo}>
                Facturas de Compra Registradas ({facturasCompra.length})
              </Text>
              <Text style={estilos.seccionSubtitulo}>
                Trazabilidad de costos reales con descuentos en cascada, IVA y estado de recepción.
              </Text>
              {facturasCompra.map((fac) => (
                <View
                  key={fac.id}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: tema.colors.borderLight,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontWeight: "bold", fontSize: 13, color: tema.colors.text }}>
                        {fac.number}
                      </Text>
                      {fac.orderCode && <Insignia label={fac.orderCode} tone="info" size="sm" />}
                      <Insignia
                        label={
                          fac.hasReceptionDiscrepancy
                            ? "Con Discrepancia Recepción"
                            : fac.status === "recepcion_conforme"
                              ? "Recepción Conforme"
                              : "Registrada"
                        }
                        tone={
                          fac.hasReceptionDiscrepancy
                            ? "danger"
                            : fac.status === "recepcion_conforme"
                              ? "ok"
                              : "warn"
                        }
                        size="sm"
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: tema.colors.textMuted }}>
                      {fac.supplierName} ({fac.supplierRut}) • {formatearFecha(fac.date)}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 6,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: tema.colors.textMuted }}>
                      Descuentos Cascada: -{formatearCLP(fac.totalDiscounts || 0)}
                    </Text>
                    <Text style={{ fontSize: 12, color: tema.colors.text }}>
                      Neto: <Text style={{ fontWeight: "600" }}>{formatearCLP(fac.subtotalNet)}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: tema.colors.text }}>
                      IVA (19%): <Text style={{ fontWeight: "600" }}>{formatearCLP(fac.iva)}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "bold", color: tema.colors.primaryDark }}>
                      Total: {formatearCLP(fac.total)}
                    </Text>
                  </View>
                </View>
              ))}
            </Tarjeta>
          )}
        </ScrollView>
      )}
    </>
  );
};
