import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
  EstadoVacio,
  CampoBusqueda,
  VistaModal,
} from "@/componentes/comunes";
import { Selector, OpcionSelector } from "@/componentes/formularios/Selector";
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

type FiltroEstadoFactura = "todas" | "conformes" | "registradas" | "discrepancias";

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
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;

  const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);
  const [filtroFactura, setFiltroFactura] = useState<FiltroEstadoFactura>("todas");
  const [busquedaFactura, setBusquedaFactura] = useState<string>("");
  const [descuentosExpandidos, setDescuentosExpandidos] = useState<Record<number, boolean>>({});
  const prevTotalFacturasRef = useRef<number>(facturasCompra.length);

  useEffect(() => {
    if (facturasCompra.length > prevTotalFacturasRef.current) {
      setMostrarFormulario(false);
      setDescuentosExpandidos({});
    }
    prevTotalFacturasRef.current = facturasCompra.length;
  }, [facturasCompra.length]);

  const opcionesProveedor = useMemo<OpcionSelector<string>[]>(
    () =>
      proveedores
        .filter((s: any) => !s.disabled)
        .map((s: any) => ({
          label: s.tradeName || s.businessName,
          value: String(s.id),
          hint: `RUT: ${s.rut || "Sin RUT"}${s.category ? ` • ${s.category}` : ""}`,
          icon: "business-outline",
        })),
    [proveedores]
  );

  const opcionesProductos = useMemo<OpcionSelector<string>[]>(
    () =>
      productos
        .filter((p: any) => !p.disabled)
        .map((p: any) => ({
          label: `${p.sku} • ${p.name}`,
          value: String(p.sku),
          hint: `Stock: ${p.stock} ${p.unit} • Costo ref: ${formatearCLP(p.unitCost)}`,
          icon: "cube-outline",
        })),
    [productos]
  );

  const metricasFacturas = useMemo(() => {
    let conformes = 0;
    let registradas = 0;
    let discrepancias = 0;
    let montoTotal = 0;
    let ahorroTotal = 0;

    facturasCompra.forEach((f) => {
      montoTotal += Number(f.total || 0);
      ahorroTotal += Number(f.totalDiscounts || 0);
      if (f.hasReceptionDiscrepancy) {
        discrepancias += 1;
      } else if (f.status === "recepcion_conforme") {
        conformes += 1;
      } else {
        registradas += 1;
      }
    });

    return {
      total: facturasCompra.length,
      conformes,
      registradas,
      discrepancias,
      montoTotal: Math.round(montoTotal),
      ahorroTotal: Math.round(ahorroTotal),
    };
  }, [facturasCompra]);

  const facturasFiltradas = useMemo(() => {
    const q = busquedaFactura.trim().toLowerCase();
    return facturasCompra.filter((f) => {
      if (filtroFactura === "discrepancias" && !f.hasReceptionDiscrepancy) return false;
      if (
        filtroFactura === "conformes" &&
        (f.hasReceptionDiscrepancy || f.status !== "recepcion_conforme")
      ) {
        return false;
      }
      if (
        filtroFactura === "registradas" &&
        (f.hasReceptionDiscrepancy || f.status === "recepcion_conforme")
      ) {
        return false;
      }

      if (q) {
        const coincideNum = (f.number || "").toLowerCase().includes(q);
        const coincideOc = (f.orderCode || "").toLowerCase().includes(q);
        const coincideProv =
          (f.supplierName || "").toLowerCase().includes(q) ||
          (f.supplierRut || "").toLowerCase().includes(q);
        if (!coincideNum && !coincideOc && !coincideProv) return false;
      }
      return true;
    });
  }, [facturasCompra, filtroFactura, busquedaFactura]);

  const obtenerEstiloSemaforoFactura = (fac: FacturaCompra) => {
    if (fac.hasReceptionDiscrepancy) {
      return {
        fondoTarjeta: "#fef2f2",
        bordeTarjeta: "#fca5a5",
        franjaLateral: "#dc2626",
        colorTexto: "#991b1b",
        divisorColor: "#fecaca",
        etiqueta: "Con Discrepancia",
        tone: "danger" as const,
      };
    }
    if (fac.status === "recepcion_conforme") {
      return {
        fondoTarjeta: "#f0fdf4",
        bordeTarjeta: "#86efac",
        franjaLateral: "#16a34a",
        colorTexto: "#166534",
        divisorColor: "#bbf7d0",
        etiqueta: "Recepción Conforme",
        tone: "ok" as const,
      };
    }
    return {
      fondoTarjeta: "#fffbeb",
      bordeTarjeta: "#fcd34d",
      franjaLateral: "#d97706",
      colorTexto: "#92400e",
      divisorColor: "#fde68a",
      etiqueta: "Registrada",
      tone: "warn" as const,
    };
  };

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

  const opcionesOcProveedor = useMemo<OpcionSelector<string>[]>(
    () => [
      {
        label: "Sin OC (Factura directa)",
        value: "",
        hint: "Ingreso manual sin vínculo a orden de compra",
        icon: "document-text-outline",
      },
      ...ordenesDelProveedor.map((oc) => {
        const totalRecibido = oc.items.reduce(
          (acc, it) => acc + Number(it.receivedQuantity || 0),
          0
        );
        const totalPedido = oc.items.reduce(
          (acc, it) => acc + Number(it.quantity || 0),
          0
        );
        return {
          label: `${oc.code} (${oc.status.replace("_", " ").toUpperCase()})`,
          value: oc.code,
          hint: `Recibido: ${totalRecibido}/${totalPedido} un • Neto OC: ${formatearCLP(oc.subtotal)}`,
          icon: "receipt-outline" as const,
        };
      }),
    ],
    [ordenesDelProveedor]
  );

  return (
    <>
      {/* =====================================================================
          2. TAB FACTURAS CON CASCADA E IVA (DASHBOARD COMPACTO + SEMÁFORO)
          ===================================================================== */}
      {activoPestana === "facturas" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* 1. CABECERA COMPACTA INDUSTRIAL + BOTÓN DESPLEGAR FORMULARIO */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="receipt-outline" size={20} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                    Facturas de Proveedor — Conciliación OC
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Total facturado:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                      {formatearCLP(metricasFacturas.montoTotal)}
                    </Text>
                    {metricasFacturas.ahorroTotal > 0
                      ? ` • Ahorro cascada: -${formatearCLP(metricasFacturas.ahorroTotal)}`
                      : ` • ${metricasFacturas.total} factura(s)`}
                  </Text>
                </View>
              </View>

              <Boton
                title="Ingresar Factura"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={() => setMostrarFormulario(true)}
                style={{ minHeight: 40 }}
                fullWidth={esMovilEstrecho}
              />
            </View>
          </Tarjeta>

          {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "conformes" as FiltroEstadoFactura,
                titulo: "Conformes",
                valor: metricasFacturas.conformes,
                sub: "Conciliadas OC",
                icon: "checkmark-done-circle-outline" as const,
                bg: "#f0fdf4",
                border: "#86efac",
                borderActivo: "#16a34a",
                textColor: "#166534",
              },
              {
                id: "registradas" as FiltroEstadoFactura,
                titulo: "Registradas",
                valor: metricasFacturas.registradas,
                sub: "Por conciliar",
                icon: "time-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "discrepancias" as FiltroEstadoFactura,
                titulo: "Discrepancias",
                valor: metricasFacturas.discrepancias,
                sub: "Diferencia OC",
                icon: "alert-circle-outline" as const,
                bg: metricasFacturas.discrepancias > 0 ? "#fef2f2" : "#f1f5f9",
                border: metricasFacturas.discrepancias > 0 ? "#fca5a5" : "#cbd5e1",
                borderActivo: metricasFacturas.discrepancias > 0 ? "#dc2626" : "#475569",
                textColor: metricasFacturas.discrepancias > 0 ? "#991b1b" : "#334155",
              },
              {
                id: "todas" as FiltroEstadoFactura,
                titulo: "Todas",
                valor: metricasFacturas.total,
                sub: "Historial total",
                icon: "layers-outline" as const,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                borderActivo: "#334155",
                textColor: "#0f172a",
              },
            ].map((kpi) => {
              const activo = filtroFactura === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.8}
                  onPress={() => setFiltroFactura(kpi.id)}
                  style={{
                    flexBasis: "48%",
                    flexGrow: 1,
                    minWidth: 140,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2 : 1,
                    borderColor: activo ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 5,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                      {kpi.valor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activo ? "800" : "600",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {activo ? "● Vista activa" : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. MODAL DEDICADO DE INGRESO DE FACTURA CON SELECTORES DESPLEGABLES Y CASCADA ACORDEÓN */}
          <VistaModal
            visible={mostrarFormulario}
            onClose={() => setMostrarFormulario(false)}
            title="Nuevo Ingreso de Factura de Compra"
            subtitle="Conciliación con OC, descuentos en cascada (D1 → D2 → D3), IVA (19%) y recálculo de PMP"
            maxWidth={640}
          >
            {/* SECCIÓN 1: DATOS DEL DOCUMENTO Y PROVEEDOR */}
            <View
              style={{
                backgroundColor: "#f8fafc",
                borderWidth: 1,
                borderColor: tema.colors.border,
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Ionicons name="document-text-outline" size={16} color={tema.colors.primaryDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: tema.colors.text,
                    textTransform: "uppercase",
                  }}
                >
                  1. Datos del Documento
                </Text>
              </View>

              <Selector
                label="Proveedor Emisor"
                required
                options={opcionesProveedor}
                value={String(invProveedorId || "")}
                onChange={(nuevoId) => {
                  establecerInvProveedorId(nuevoId);
                  establecerInvOrdenCodigo("");
                }}
                placeholder="Seleccionar proveedor homologado..."
              />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <CampoTexto
                    label="Número de Factura"
                    required
                    value={invNumero}
                    onChangeText={establecerInvNumero}
                    placeholder="Ej: FAC-89301"
                    containerStyle={{ marginBottom: 4 }}
                  />
                </View>

                <View style={{ flex: 1.2, minWidth: 190 }}>
                  <Selector
                    label="Vincular OC (Autocompleta)"
                    options={opcionesOcProveedor}
                    value={
                      ordenesDelProveedor.find(
                        (oc) => oc.code.trim().toUpperCase() === invOrdenCodigo.trim().toUpperCase()
                      )?.code || ""
                    }
                    onChange={(codigoSeleccionado) => {
                      if (!codigoSeleccionado) {
                        establecerInvOrdenCodigo("");
                        return;
                      }
                      const ocElegida = ordenesDelProveedor.find((o) => o.code === codigoSeleccionado);
                      if (ocElegida) {
                        cargarLineasDesdeOc(ocElegida, false);
                      } else {
                        establecerInvOrdenCodigo(codigoSeleccionado);
                      }
                    }}
                    placeholder="Sin OC (Factura directa)"
                    containerStyle={{ marginBottom: 4 }}
                  />
                </View>
              </View>
            </View>

            {/* AVISO DE VALIDACIÓN DE DUPLICADOS */}
            {esFacturaDuplicate && (
              <View style={[estilos.duplicateAvisoCaja, { marginBottom: 10 }]}>
                <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                <Text style={estilos.duplicateAvisoTexto}>
                  Atención: Ya existe la Factura N° {invNumero} registrada para este proveedor.
                </Text>
              </View>
            )}

            {/* AVISO EN VIVO DE DISCREPANCIA CON LA RECEPCIÓN DE LA OC */}
            {ordenCompraVinculadaFactura && discrepanciaFacturaRecepcion?.tieneDiscrepancia && (
              <View
                style={{
                  backgroundColor: "#fef2f2",
                  borderColor: "#fca5a5",
                  borderWidth: 1.5,
                  borderLeftWidth: 5,
                  borderLeftColor: "#dc2626",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 12,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="warning" size={16} color={tema.colors.danger} />
                  <Text style={{ color: tema.colors.danger, fontWeight: "800", fontSize: 12 }}>
                    Discrepancia con Recepción ({ordenCompraVinculadaFactura.code})
                  </Text>
                </View>
                {discrepanciaFacturaRecepcion.detalles.map((det, dIdx) => (
                  <Text key={dIdx} style={{ fontSize: 11, color: "#991B1B" }}>
                    • {det.mensaje}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Boton
                    title="Ajustar a Recepción Conforme"
                    variant="outline"
                    size="sm"
                    onPress={() => cargarLineasDesdeOc(ordenCompraVinculadaFactura, true)}
                    style={{ backgroundColor: "#ffffff", minHeight: 32 }}
                  />
                </View>
              </View>
            )}

            {/* BANNER VERDE CUANDO LA FACTURA COINCIDE CON LA RECEPCIÓN */}
            {ordenCompraVinculadaFactura && !discrepanciaFacturaRecepcion?.tieneDiscrepancia && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f0fdf4",
                  borderWidth: 1,
                  borderColor: "#86efac",
                  borderLeftWidth: 4,
                  borderLeftColor: "#16a34a",
                  borderRadius: 8,
                  marginBottom: 12,
                  padding: 9,
                  gap: 6,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color={tema.colors.okDark} />
                <Text style={{ fontSize: 11, color: "#166534", flex: 1, fontWeight: "700" }}>
                  Conciliación conforme con {ordenCompraVinculadaFactura.code}: cantidades coinciden con bodega.
                </Text>
              </View>
            )}

            {/* SECCIÓN 2: ÍTEMS FACTURADOS CON SELECTOR Y DESCUENTOS EN CASCADA PLEGABLES */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="cube-outline" size={16} color={tema.colors.primaryDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: tema.colors.text,
                    textTransform: "uppercase",
                  }}
                >
                  2. Ítems Facturados ({invElementos.length})
                </Text>
              </View>

              <Boton
                title="Agregar Ítem"
                variant="outline"
                size="sm"
                icon="add-outline"
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
                style={{ minHeight: 32, paddingHorizontal: 10 }}
              />
            </View>

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
              const itemOcVinculado = ordenCompraVinculadaFactura?.items.find(
                (i) => i.sku.trim().toUpperCase() === String(item.sku || "").trim().toUpperCase()
              );
              const tieneDescuentos =
                Number(item.disc1) > 0 || Number(item.disc2) > 0 || Number(item.disc3) > 0;
              const mostrarCascada = Boolean(descuentosExpandidos[idx]) || tieneDescuentos;

              return (
                <View
                  key={idx}
                  style={{
                    backgroundColor: "#f8fafc",
                    borderWidth: 1,
                    borderColor: tema.colors.borderDark,
                    borderLeftWidth: 4,
                    borderLeftColor: tema.colors.primary,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 10,
                  }}
                >
                  {/* Fila Superior: N° Ítem + Selector desplegable de Insumo + Eliminar */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View
                      style={{
                        backgroundColor: tema.colors.primaryLight,
                        borderWidth: 1,
                        borderColor: tema.colors.primaryBorder,
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.primaryDark }}>
                        #{idx + 1}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Selector
                        label={`Insumo Ítem #${idx + 1}`}
                        options={opcionesProductos}
                        value={String(item.sku || "")}
                        onChange={(nuevoSku) => {
                          const prod = productos.find((p: any) => p.sku === nuevoSku);
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) =>
                              i === idx
                                ? {
                                  ...it,
                                  sku: nuevoSku,
                                  grossPrice: prod ? prod.unitCost : it.grossPrice,
                                }
                                : it
                            )
                          );
                        }}
                        placeholder="Seleccionar insumo del catálogo..."
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>

                    {invElementos.length > 1 && (
                      <Pressable
                        onPress={() =>
                          establecerInvElementos((prev: any[]) =>
                            prev.filter((_: any, i: number) => i !== idx)
                          )
                        }
                        hitSlop={8}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          backgroundColor: "#fef2f2",
                          borderWidth: 1,
                          borderColor: "#fca5a5",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color={tema.colors.danger} />
                      </Pressable>
                    )}
                  </View>

                  {itemOcVinculado && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: tema.colors.border,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        marginBottom: 8,
                      }}
                    >
                      <Ionicons name="checkmark-done-outline" size={13} color={tema.colors.okDark} />
                      <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                        Ref. {ordenCompraVinculadaFactura?.code}: Pedido {itemOcVinculado.quantity}{" "}
                        {itemOcVinculado.unit} • Recibido en bodega:{" "}
                        <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                          {itemOcVinculado.receivedQuantity ?? 0} {itemOcVinculado.unit}
                        </Text>
                      </Text>
                    </View>
                  )}

                  {/* Fila de Cantidad y Precio Bruto Unitario */}
                  <View style={[estilos.descuentoFila, { marginBottom: 6 }]}>
                    <View style={estilos.discColumna}>
                      <Text style={estilos.discEtiqueta}>Cantidad ({desglose.unit})</Text>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) =>
                              i === idx ? { ...it, quantity: valor } : it
                            )
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 36, backgroundColor: "#ffffff" }]}
                      />
                    </View>

                    <View style={[estilos.discColumna, { marginRight: 0 }]}>
                      <Text style={estilos.discEtiqueta}>Precio Bruto Unit. ($)</Text>
                      <TextInput
                        value={String(item.grossPrice)}
                        onChangeText={(v: any) => {
                          const valor = Number(v) || 0;
                          establecerInvElementos((prev: any[]) =>
                            prev.map((it: any, i: number) =>
                              i === idx ? { ...it, grossPrice: valor } : it
                            )
                          );
                        }}
                        keyboardType="numeric"
                        style={[estilos.discEntrada, { height: 36, backgroundColor: "#ffffff" }]}
                      />
                    </View>
                  </View>

                  {/* Botón Acordeón para Descuentos en Cascada (D1 → D2 → D3) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setDescuentosExpandidos((prev) => ({
                        ...prev,
                        [idx]: !mostrarCascada,
                      }))
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: tieneDescuentos ? "#f0fdf4" : "#ffffff",
                      borderWidth: 1,
                      borderColor: tieneDescuentos ? "#86efac" : tema.colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginBottom: mostrarCascada ? 6 : 0,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name="pricetag-outline"
                        size={14}
                        color={tieneDescuentos ? tema.colors.okDark : tema.colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: tieneDescuentos ? "#166534" : tema.colors.textSecondary,
                        }}
                      >
                        Descuentos en Cascada (D1 → D2 → D3)
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {desglose.effectiveDiscountPct > 0 ? (
                        <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.okDark }}>
                          -{desglose.effectiveDiscountPct}% (-{formatearCLP(desglose.totalDiscountLine)})
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: tema.colors.textMuted }}>
                          Sin descuento
                        </Text>
                      )}
                      <Ionicons
                        name={mostrarCascada ? "chevron-up-outline" : "chevron-down-outline"}
                        size={14}
                        color={tema.colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Inputs de 3 Descuentos (solo visibles cuando se expanden o tienen valor > 0) */}
                  {mostrarCascada && (
                    <View style={[estilos.descuentoFila, { marginTop: 2 }]}>
                      <View style={estilos.discColumna}>
                        <Text style={estilos.discEtiqueta} numberOfLines={1}>
                          D1 (%)
                        </Text>
                        <TextInput
                          value={String(item.disc1)}
                          onChangeText={(v: any) => {
                            const val = Math.min(100, Math.max(0, Number(v) || 0));
                            establecerInvElementos((prev: any[]) =>
                              prev.map((it: any, i: number) =>
                                i === idx ? { ...it, disc1: val } : it
                              )
                            );
                          }}
                          keyboardType="numeric"
                          style={[estilos.discEntrada, { height: 34, backgroundColor: "#ffffff" }]}
                        />
                      </View>

                      <View style={estilos.discColumna}>
                        <Text style={estilos.discEtiqueta} numberOfLines={1}>
                          D2 (%)
                        </Text>
                        <TextInput
                          value={String(item.disc2)}
                          onChangeText={(v: any) => {
                            const val = Math.min(100, Math.max(0, Number(v) || 0));
                            establecerInvElementos((prev: any[]) =>
                              prev.map((it: any, i: number) =>
                                i === idx ? { ...it, disc2: val } : it
                              )
                            );
                          }}
                          keyboardType="numeric"
                          style={[estilos.discEntrada, { height: 34, backgroundColor: "#ffffff" }]}
                        />
                      </View>

                      <View style={[estilos.discColumna, { marginRight: 0 }]}>
                        <Text style={estilos.discEtiqueta} numberOfLines={1}>
                          D3 (%)
                        </Text>
                        <TextInput
                          value={String(item.disc3)}
                          onChangeText={(v: any) => {
                            const val = Math.min(100, Math.max(0, Number(v) || 0));
                            establecerInvElementos((prev: any[]) =>
                              prev.map((it: any, i: number) =>
                                i === idx ? { ...it, disc3: val } : it
                              )
                            );
                          }}
                          keyboardType="numeric"
                          style={[estilos.discEntrada, { height: 34, backgroundColor: "#ffffff" }]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Barra compacta de Subtotal Neto y PMP proyectado */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: tema.colors.primaryBorder,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginTop: 8,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="trending-up" size={13} color={tema.colors.primaryDark} />
                      <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                        Neto Unit:{" "}
                        <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                          {formatearCLP(calculo.netUnitPrice)}
                        </Text>{" "}
                        • PMP:{" "}
                        <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                          {formatearCLP(desglose.projectedPmp)}
                        </Text>
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: tema.colors.primaryDark }}>
                      Subtotal: {formatearCLP(calculo.subtotalNet)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* RESUMEN FINANCIERO EN VIVO COMPACTO (TICKET CONTABLE) */}
            <View style={[estilos.financialResumenTarjeta, { padding: 12, marginTop: 4 }]}>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>Total Bruto:</Text>
                <Text style={estilos.resumenValor}>{formatearCLP(facturaSubtotalBruto)}</Text>
              </View>
              <View style={estilos.resumenLinea}>
                <Text style={estilos.resumenEtiqueta}>Descuentos Cascada (D1 → D2 → D3):</Text>
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
            </View>

            {Boolean(invError) && <Text style={estilos.errorTexto}>{invError}</Text>}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 12,
              }}
            >
              <Boton
                title="Cancelar"
                variant="outline"
                size="sm"
                onPress={() => setMostrarFormulario(false)}
                style={{ minHeight: 40, flex: 1 }}
              />
              <Boton
                title="Registrar Factura"
                variant="primary"
                size="sm"
                icon="save-outline"
                disabled={esFacturaDuplicate}
                onPress={manejarGuardarFactura}
                style={{ minHeight: 40, flex: 1.5 }}
              />
            </View>
          </VistaModal>

          {/* 4. BUSCADOR Y LISTADO DE FACTURAS REGISTRADAS CON SEMÁFORO DE SUPERFICIE */}
          <CampoBusqueda
            value={busquedaFactura}
            onChangeText={setBusquedaFactura}
            placeholder="Buscar factura por N° FAC, código OC, proveedor o RUT..."
            containerStyle={{ marginBottom: 12 }}
          />

          {facturasFiltradas.length === 0 ? (
            <EstadoVacio
              icon="receipt-outline"
              title="Sin facturas en esta vista"
              description={
                busquedaFactura.trim()
                  ? `No hay facturas que coincidan con "${busquedaFactura.trim()}".`
                  : "No hay facturas registradas bajo este filtro del semáforo."
              }
              actionTitle={filtroFactura !== "todas" ? "Ver Todas las Facturas" : "Ingresar Factura"}
              onAction={
                filtroFactura !== "todas"
                  ? () => setFiltroFactura("todas")
                  : () => setMostrarFormulario(true)
              }
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            facturasFiltradas.map((fac) => {
              const semaforo = obtenerEstiloSemaforoFactura(fac);
              return (
                <Tarjeta
                  key={fac.id}
                  variant="outlined"
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    backgroundColor: semaforo.fondoTarjeta,
                    borderColor: semaforo.bordeTarjeta,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.franjaLateral,
                    borderRadius: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 180 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: semaforo.colorTexto }}>
                          {fac.number}
                        </Text>
                        {fac.orderCode && (
                          <Insignia label={fac.orderCode} tone="info" size="sm" />
                        )}
                        <Insignia label={semaforo.etiqueta} tone={semaforo.tone} size="sm" />
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: tema.colors.text,
                          marginTop: 2,
                        }}
                      >
                        {fac.supplierName}
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                        RUT: {fac.supplierRut} • 📅 Fecha: {formatearFecha(fac.date)}
                      </Text>
                    </View>
                  </View>

                  {/* Métricas financieras de la factura en 1 sola fila horizontal limpia */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: semaforo.divisorColor,
                      borderRadius: 9,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      marginTop: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Desc. Cascada
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: tema.colors.okDark, marginTop: 1 }}>
                        -{formatearCLP(fac.totalDiscounts || 0)}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Neto
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text, marginTop: 1 }}>
                        {formatearCLP(fac.subtotalNet)}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        IVA (19%)
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text, marginTop: 1 }}>
                        {formatearCLP(fac.iva)}
                      </Text>
                    </View>

                    <View style={{ flex: 1.1, alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Total Factura
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.colorTexto, marginTop: 1 }}>
                        {formatearCLP(fac.total)}
                      </Text>
                    </View>
                  </View>
                </Tarjeta>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );
};
