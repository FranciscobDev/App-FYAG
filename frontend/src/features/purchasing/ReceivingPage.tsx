import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  CheckCircle2,
  DollarSign,
  FileCheck,
  FileText,
  Info,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { formatCLP, formatNumber } from "@/core/format";
import type {
  Product,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseOrder,
  PurchaseOrderItem,
} from "@/core/types";
import { PRODUCTS, PURCHASE_INVOICES, PURCHASE_ORDERS, SUPPLIERS } from "@/data/mock";

interface ReceivingChecklistState {
  receivedConforme: number;
  defective: number;
  missing: number;
}

export function ReceivingPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("recepcion");

  // Órdenes de compra e inventario
  const [orders, setOrders] = useState<PurchaseOrder[]>(PURCHASE_ORDERS);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(PURCHASE_INVOICES);

  // ─── ESTADOS PARA RECEPCIÓN CON CHECKLIST ───
  const receivableOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status === "enviada" || o.status === "recibida_parcial",
    );
  }, [orders]);

  const [selectedReceivingOcCode, setSelectedReceivingOcCode] = useState<string>(
    receivableOrders[0]?.code ?? "OC-2026-103",
  );

  const selectedReceivingOrder = useMemo(() => {
    return orders.find((o) => o.code === selectedReceivingOcCode);
  }, [orders, selectedReceivingOcCode]);

  // Estado del checklist por cada SKU de la OC seleccionada
  const [checklist, setChecklist] = useState<Record<string, ReceivingChecklistState>>({});

  // Inicializar o sincronizar el checklist al cambiar de OC
  const currentChecklistItems = useMemo(() => {
    if (!selectedReceivingOrder) return [];
    return selectedReceivingOrder.items.map((it) => {
      const state = checklist[it.sku] ?? {
        receivedConforme: it.quantity - (it.receivedQuantity ?? 0),
        defective: 0,
        missing: 0,
      };
      return {
        ...it,
        ...state,
      };
    });
  }, [selectedReceivingOrder, checklist]);

  const handleChecklistChange = (
    sku: string,
    field: keyof ReceivingChecklistState,
    value: number,
  ) => {
    setChecklist((prev) => {
      const existing = prev[sku] ?? {
        receivedConforme: 0,
        defective: 0,
        missing: 0,
      };
      return {
        ...prev,
        [sku]: {
          ...existing,
          [field]: Math.max(0, value),
        },
      };
    });
  };

  // Comparación con factura vinculada (Alerta si no coincide lo recibido con lo facturado)
  const linkedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.orderCode === selectedReceivingOcCode);
  }, [invoices, selectedReceivingOcCode]);

  const discrepancyAlert = useMemo(() => {
    if (!linkedInvoice || !selectedReceivingOrder) return null;
    const discrepancies: string[] = [];

    for (const item of currentChecklistItems) {
      const invItem = linkedInvoice.items.find((i) => i.sku === item.sku);
      if (invItem) {
        if (item.receivedConforme !== invItem.quantity) {
          discrepancies.push(
            `${item.name} (${item.sku}): Facturado ${invItem.quantity} ${item.unit} vs Recibido conforme ${item.receivedConforme} ${item.unit} (Defectuoso: ${item.defective}, Faltante: ${item.missing})`,
          );
        }
      }
    }

    return discrepancies.length > 0 ? discrepancies : null;
  }, [linkedInvoice, selectedReceivingOrder, currentChecklistItems]);

  // Procesar recepción física
  const handleProcessReceiving = () => {
    if (!selectedReceivingOrder) return;

    let totalConforme = 0;
    let totalDefective = 0;
    let totalMissing = 0;

    // Actualizar productos (stock disponible y cuarentena para defectuosos)
    const updatedProducts = products.map((prod) => {
      const receivedItem = currentChecklistItems.find((it) => it.sku === prod.sku);
      if (receivedItem) {
        totalConforme += receivedItem.receivedConforme;
        totalDefective += receivedItem.defective;
        totalMissing += receivedItem.missing;

        return {
          ...prod,
          stock: prod.stock + receivedItem.receivedConforme,
          quarantine: (prod.quarantine ?? 0) + receivedItem.defective,
        };
      }
      return prod;
    });

    setProducts(updatedProducts);

    // Determinar nuevo estado de la OC
    const allItemsComplete = currentChecklistItems.every(
      (it) => (it.receivedQuantity ?? 0) + it.receivedConforme >= it.quantity,
    );
    const newStatus: PurchaseOrder["status"] = allItemsComplete ? "recibida" : "recibida_parcial";

    const updatedOrder: PurchaseOrder = {
      ...selectedReceivingOrder,
      status: newStatus,
      items: selectedReceivingOrder.items.map((it) => {
        const itemState = currentChecklistItems.find((ci) => ci.sku === it.sku);
        return {
          ...it,
          receivedQuantity: (it.receivedQuantity ?? 0) + (itemState?.receivedConforme ?? 0),
          defectiveQuantity: (it.defectiveQuantity ?? 0) + (itemState?.defective ?? 0),
          missingQuantity: (it.missingQuantity ?? 0) + (itemState?.missing ?? 0),
        };
      }),
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === selectedReceivingOrder.id ? updatedOrder : o)),
    );

    toast({
      tone: totalDefective > 0 ? "warn" : "ok",
      title: allItemsComplete ? "Recepción conforme completada" : "Recepción parcial registrada",
      description: `${totalConforme} unidades a stock disponible. ${totalDefective > 0 ? `${totalDefective} a cuarentena.` : ''}`,
    });

    setChecklist({});
  };

  // ─── ESTADOS PARA FACTURAS DE COMPRA (BODEGUERO) ───
  const [invoiceSupplierId, setInvoiceSupplierId] = useState(SUPPLIERS[0]?.id ?? "sup1");
  const [invoiceNumber, setInvoiceNumber] = useState("FAC-84920");
  const [invoiceOrderCode, setInvoiceOrderCode] = useState<string>("OC-2026-103");
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([
    {
      sku: "ELE-DIS-0016",
      name: "Disyuntor termomagnético 16 A",
      quantity: 50,
      grossPrice: 4500,
      discount1Pct: 10,
      discount2Pct: 5,
      discount3Pct: 2,
      netUnitPrice: 3770.1,
      subtotalNet: 188505,
      unit: "un",
    },
  ]);

  // Validación de número de factura duplicado por proveedor
  const isInvoiceNumberDuplicate = useMemo(() => {
    return invoices.some(
      (inv) =>
        inv.supplierId === invoiceSupplierId &&
        inv.number.trim().toLowerCase() === invoiceNumber.trim().toLowerCase(),
    );
  }, [invoices, invoiceSupplierId, invoiceNumber]);

  // Cálculo de cascada de descuentos
  const calculateCascadedPrice = (gross: number, d1: number, d2: number, d3: number) => {
    const f1 = 1 - d1 / 100;
    const f2 = 1 - d2 / 100;
    const f3 = 1 - d3 / 100;
    return gross * f1 * f2 * f3;
  };

  const handleInvoiceItemChange = (
    idx: number,
    field: keyof PurchaseInvoiceItem,
    val: number,
  ) => {
    const updated = [...invoiceItems];
    const it = { ...updated[idx], [field]: val };

    const net = calculateCascadedPrice(it.grossPrice, it.discount1Pct, it.discount2Pct, it.discount3Pct);
    it.netUnitPrice = Number(net.toFixed(2));
    it.subtotalNet = Math.round(it.netUnitPrice * it.quantity);

    updated[idx] = it;
    setInvoiceItems(updated);
  };

  const handleAddInvoiceItem = () => {
    const p = products[0];
    setInvoiceItems([
      ...invoiceItems,
      {
        sku: p?.sku ?? "ELE-DIS-0016",
        name: p?.name ?? "",
        quantity: 10,
        grossPrice: p?.unitCost ?? 5000,
        discount1Pct: 0,
        discount2Pct: 0,
        discount3Pct: 0,
        netUnitPrice: p?.unitCost ?? 5000,
        subtotalNet: (p?.unitCost ?? 5000) * 10,
        unit: p?.unit ?? "un",
      },
    ]);
  };

  const handleRemoveInvoiceItem = (idx: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
  };

  // Resumen en vivo de la factura
  const invoiceSubtotalNet = invoiceItems.reduce((s, it) => s + it.subtotalNet, 0);
  const invoiceGrossTotal = invoiceItems.reduce((s, it) => s + it.grossPrice * it.quantity, 0);
  const invoiceTotalDiscounts = invoiceGrossTotal - invoiceSubtotalNet;
  const invoiceIva = Math.round(invoiceSubtotalNet * 0.19);
  const invoiceTotal = invoiceSubtotalNet + invoiceIva;

  // Tarjeta con el PMP resultante proyectado
  const pmpSimulations = useMemo(() => {
    return invoiceItems.map((it) => {
      const prod = products.find((p) => p.sku === it.sku);
      const currentStock = prod?.stock ?? 0;
      const currentPmp = prod?.pmp ?? prod?.unitCost ?? 0;

      const newQty = it.quantity;
      const newCost = it.netUnitPrice;

      const totalStock = currentStock + newQty;
      const newPmp =
        totalStock > 0
          ? ((currentStock * currentPmp) + (newQty * newCost)) / totalStock
          : newCost;

      return {
        sku: it.sku,
        name: it.name,
        currentStock,
        currentPmp,
        incomingQty: newQty,
        incomingCost: newCost,
        projectedPmp: Math.round(newPmp),
        diff: Math.round(newPmp - currentPmp),
      };
    });
  }, [invoiceItems, products]);

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvoiceNumberDuplicate) {
      toast({
        tone: "danger",
        title: "Factura duplicada",
        description: `El número ${invoiceNumber} ya existe para este proveedor.`,
      });
      return;
    }

    const sup = SUPPLIERS.find((s) => s.id === invoiceSupplierId);

    const newInvoice: PurchaseInvoice = {
      id: `fac-${Date.now()}`,
      number: invoiceNumber.trim().toUpperCase(),
      supplierId: invoiceSupplierId,
      supplierName: sup?.businessName ?? "Proveedor",
      supplierRut: sup?.rut ?? "76.432.890-K",
      orderCode: invoiceOrderCode !== "none" ? invoiceOrderCode : undefined,
      date: new Date().toLocaleDateString("es-CL"),
      items: invoiceItems,
      subtotalNet: invoiceSubtotalNet,
      totalDiscounts: invoiceTotalDiscounts,
      iva: invoiceIva,
      total: invoiceTotal,
      status: "registrada",
    };

    setInvoices([newInvoice, ...invoices]);
    toast({
      tone: "ok",
      title: `Factura ${newInvoice.number} registrada`,
      description: "Documento tributario ingresado. Recuerda recepcionar físicamente en bodega.",
    });

    setInvoiceNumber(`FAC-${Math.floor(10000 + Math.random() * 90000)}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepción de Mercadería y Facturas de Compra"
        subtitle="Checklist por línea en bodega, cuarentena para defectuosos, descuentos en cascada y PMP resultante"
      />

      <Tabs
        label="Vistas de Recepción"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: "recepcion",
            label: "Recepción de OC (Checklist en Andén)",
            content: (
              <div className="space-y-6">
                {/* Selector de OC en andén */}
                <Card className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-4">
                    <div>
                      <h3 className="text-body font-bold text-ink-900">
                        Seleccionar Orden de Compra Arribada:
                      </h3>
                      <p className="text-caption text-ink-500">
                        Solo órdenes en estado Enviada o Recibida Parcial listas para inspección física.
                      </p>
                    </div>

                    <div className="w-full sm:w-80">
                      <select
                        value={selectedReceivingOcCode}
                        onChange={(e) => {
                          setSelectedReceivingOcCode(e.target.value);
                          setChecklist({});
                        }}
                        className="w-full rounded-xl border border-brand-300 bg-white p-2.5 text-body-sm font-bold text-brand-900 focus:border-brand-600 focus:outline-none"
                      >
                        {receivableOrders.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.code} · {o.supplier} ({o.items.length} ítems)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ─── ALERTA SI NO COINCIDE LO RECIBIDO CON LO FACTURADO ─── */}
                  {discrepancyAlert && (
                    <div
                      role="alert"
                      className="mt-4 rounded-2xl border-2 border-danger-line bg-danger-soft p-4 text-danger animate-pulse"
                    >
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-body-sm">
                            ALERTA: Discrepancia entre Factura ({linkedInvoice?.number}) y Recepción Física
                          </h4>
                          <p className="mt-1 text-caption text-ink-700">
                            Lo ingresado en el checklist no cuadra con las cantidades de la factura electrónica del proveedor:
                          </p>
                          <ul className="mt-1.5 list-disc pl-5 text-caption font-semibold">
                            {discrepancyAlert.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detalle y checklist por línea */}
                  {selectedReceivingOrder ? (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between text-body-sm">
                        <span>
                          Proveedor: <strong>{selectedReceivingOrder.supplier}</strong>
                        </span>
                        <span>
                          Estado actual: <EstadoBadge estado={selectedReceivingOrder.status as any} />
                        </span>
                      </div>

                      {/* TABLA CHECKLIST POR LÍNEA: CONFORME, DEFECTUOSO, FALTANTE */}
                      <div className="overflow-x-auto rounded-xl border border-ink-200">
                        <table className="w-full text-left text-body-sm">
                          <thead className="bg-ink-100 text-caption font-semibold uppercase text-ink-600">
                            <tr>
                              <th className="px-3 py-2.5">Insumo</th>
                              <th className="px-3 py-2.5 text-center">Esperado</th>
                              <th className="px-3 py-2.5 text-center bg-ok-soft/30 text-ok">Conforme (Stock)</th>
                              <th className="px-3 py-2.5 text-center bg-danger-soft/30 text-danger">Defectuoso (Cuarentena)</th>
                              <th className="px-3 py-2.5 text-center bg-warn-soft/30 text-warn">Faltante</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {currentChecklistItems.map((item) => (
                              <tr key={item.sku} className="hover:bg-ink-50/50">
                                <td className="px-3 py-3">
                                  <p className="font-bold text-ink-900">{item.name}</p>
                                  <span className="font-mono text-caption text-ink-500">{item.sku}</span>
                                </td>

                                <td className="px-3 py-3 text-center font-bold tabular-nums">
                                  {item.quantity - (item.receivedQuantity ?? 0)} {item.unit}
                                </td>

                                {/* Input Conforme */}
                                <td className="px-3 py-3 text-center bg-ok-soft/10">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.receivedConforme}
                                    onChange={(e) =>
                                      handleChecklistChange(
                                        item.sku,
                                        "receivedConforme",
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="w-20 rounded-lg border border-ok-line p-1.5 text-center font-bold tabular-nums text-ok focus:outline-none"
                                  />
                                </td>

                                {/* Input Defectuoso (VA A CUARENTENA) */}
                                <td className="px-3 py-3 text-center bg-danger-soft/10">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.defective}
                                    onChange={(e) =>
                                      handleChecklistChange(
                                        item.sku,
                                        "defective",
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="w-20 rounded-lg border border-danger-line p-1.5 text-center font-bold tabular-nums text-danger focus:outline-none"
                                  />
                                </td>

                                {/* Input Faltante */}
                                <td className="px-3 py-3 text-center bg-warn-soft/10">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.missing}
                                    onChange={(e) =>
                                      handleChecklistChange(
                                        item.sku,
                                        "missing",
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="w-20 rounded-lg border border-warn-line p-1.5 text-center font-bold tabular-nums text-warn focus:outline-none"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Botón Confirmar Recepción */}
                      <div className="flex justify-end pt-3">
                        <Button
                          onClick={handleProcessReceiving}
                          className="flex items-center gap-2 shadow-md"
                        >
                          <CheckCircle2 size={18} />
                          <span>Confirmar Recepción Física</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-body-sm text-ink-500">
                      No hay órdenes de compra pendientes de recepción.
                    </p>
                  )}
                </Card>
              </div>
            ),
          },
          {
            id: "facturas",
            label: "Facturas de Compra (Bodeguero)",
            content: (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* ─── FORMULARIO DE FACTURA (IZQUIERDA) ─── */}
                <div className="lg:col-span-8">
                  <Card className="p-5">
                    <div className="border-b border-ink-100 pb-3">
                      <h3 className="text-body font-bold text-ink-900">
                        Ingreso de Factura de Compra
                      </h3>
                      <p className="text-caption text-ink-500">
                        Valida número duplicado, hasta 3 descuentos en cascada e IVA del 19%.
                      </p>
                    </div>

                    <form onSubmit={handleSaveInvoice} className="mt-4 space-y-4">
                      {/* Proveedor y Número de Factura */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-caption font-semibold text-ink-900">
                            Proveedor:
                          </label>
                          <select
                            value={invoiceSupplierId}
                            onChange={(e) => setInvoiceSupplierId(e.target.value)}
                            className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
                          >
                            {SUPPLIERS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.businessName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Número con validación de duplicados */}
                        <div>
                          <label className="mb-1 block text-caption font-semibold text-ink-900">
                            N° Factura:
                          </label>
                          <input
                            type="text"
                            required
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            placeholder="Ej: FAC-98421"
                            className={`w-full rounded-xl border p-2.5 font-mono text-body-sm uppercase focus:outline-none ${
                              isInvoiceNumberDuplicate
                                ? "border-danger bg-danger-soft/20 text-danger"
                                : "border-ink-200 focus:border-brand-600"
                            }`}
                          />
                          {isInvoiceNumberDuplicate && (
                            <p className="mt-1 text-[11px] font-bold text-danger">
                              ⚠️ Factura ya registrada para este proveedor.
                            </p>
                          )}
                        </div>

                        {/* OC Opcional */}
                        <div>
                          <label className="mb-1 block text-caption font-semibold text-ink-900">
                            OC Asociada (opcional):
                          </label>
                          <select
                            value={invoiceOrderCode}
                            onChange={(e) => setInvoiceOrderCode(e.target.value)}
                            className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                          >
                            <option value="none">Sin OC asociada</option>
                            {orders.map((o) => (
                              <option key={o.code} value={o.code}>
                                {o.code} ({o.supplier})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* TABLA DE ÍTEMS CON DESCUENTOS EN CASCADA */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-caption font-bold uppercase text-ink-700">
                            Líneas de Factura (Descuentos en Cascada):
                          </label>
                          <Button size="md" variant="secondary" onClick={handleAddInvoiceItem} className="text-caption">
                            <Plus size={14} />
                            <span>Agregar insumo</span>
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {invoiceItems.map((it, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-ink-200 bg-ink-50/50 p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <select
                                  value={it.sku}
                                  onChange={(e) => {
                                    const p = products.find((pr) => pr.sku === e.target.value);
                                    const updated = [...invoiceItems];
                                    updated[idx] = {
                                      ...updated[idx],
                                      sku: e.target.value,
                                      name: p?.name ?? "",
                                      unit: p?.unit ?? "un",
                                    };
                                    setInvoiceItems(updated);
                                  }}
                                  className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white p-2 text-body-sm font-semibold focus:border-brand-600 focus:outline-none"
                                >
                                  {products.map((p) => (
                                    <option key={p.sku} value={p.sku}>
                                      {p.sku} · {p.name}
                                    </option>
                                  ))}
                                </select>

                                <IconButton
                                  label="Eliminar línea"
                                  onClick={() => handleRemoveInvoiceItem(idx)}
                                  disabled={invoiceItems.length <= 1}
                                  className="text-danger hover:bg-danger-soft"
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </div>

                              {/* Parámetros numéricos: Cantidad, Bruto, Descuento 1, Descuento 2, Descuento 3 */}
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 text-caption">
                                <div>
                                  <span className="text-ink-600 font-medium">Cantidad:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.quantity}
                                    onChange={(e) =>
                                      handleInvoiceItemChange(idx, "quantity", parseFloat(e.target.value) || 1)
                                    }
                                    className="mt-0.5 w-full rounded border border-ink-200 p-1.5 text-center font-bold tabular-nums"
                                  />
                                </div>

                                <div>
                                  <span className="text-ink-600 font-medium">Precio Bruto:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={it.grossPrice}
                                    onChange={(e) =>
                                      handleInvoiceItemChange(idx, "grossPrice", parseFloat(e.target.value) || 0)
                                    }
                                    className="mt-0.5 w-full rounded border border-ink-200 p-1.5 text-right font-bold tabular-nums"
                                  />
                                </div>

                                <div>
                                  <span className="text-ink-600 font-medium">Desc. 1 (%):</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={it.discount1Pct}
                                    onChange={(e) =>
                                      handleInvoiceItemChange(idx, "discount1Pct", parseFloat(e.target.value) || 0)
                                    }
                                    className="mt-0.5 w-full rounded border border-ink-200 p-1.5 text-center tabular-nums"
                                  />
                                </div>

                                <div>
                                  <span className="text-ink-600 font-medium">Desc. 2 (%):</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={it.discount2Pct}
                                    onChange={(e) =>
                                      handleInvoiceItemChange(idx, "discount2Pct", parseFloat(e.target.value) || 0)
                                    }
                                    className="mt-0.5 w-full rounded border border-ink-200 p-1.5 text-center tabular-nums"
                                  />
                                </div>

                                <div>
                                  <span className="text-ink-600 font-medium">Desc. 3 (%):</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={it.discount3Pct}
                                    onChange={(e) =>
                                      handleInvoiceItemChange(idx, "discount3Pct", parseFloat(e.target.value) || 0)
                                    }
                                    className="mt-0.5 w-full rounded border border-ink-200 p-1.5 text-center tabular-nums"
                                  />
                                </div>

                                <div>
                                  <span className="text-ink-600 font-medium">Neto Unit.:</span>
                                  <p className="mt-2 text-right font-bold tabular-nums text-ink-900">
                                    {formatCLP(it.netUnitPrice)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Resumen de costos en vivo */}
                      <div className="rounded-2xl bg-ink-100/60 p-4 space-y-1.5 text-body-sm">
                        <div className="flex justify-between text-ink-600">
                          <span>Subtotal Neto:</span>
                          <span className="font-bold tabular-nums">{formatCLP(invoiceSubtotalNet)}</span>
                        </div>
                        <div className="flex justify-between text-ok">
                          <span>Descuentos en cascada acumulados:</span>
                          <span className="font-bold tabular-nums">-{formatCLP(invoiceTotalDiscounts)}</span>
                        </div>
                        <div className="flex justify-between text-ink-600">
                          <span>IVA (19%):</span>
                          <span className="font-bold tabular-nums">{formatCLP(invoiceIva)}</span>
                        </div>
                        <div className="flex justify-between text-body font-black text-ink-900 border-t border-ink-200 pt-1">
                          <span>TOTAL FACTURADO:</span>
                          <span className="text-brand-700 tabular-nums">{formatCLP(invoiceTotal)}</span>
                        </div>
                      </div>

                      {/* AVISO EXPLÍCITO DE ACTUALIZACIÓN DE STOCK */}
                      <div className="rounded-xl border border-info-line bg-info-soft p-3 text-info text-body-sm flex items-start gap-2">
                        <Info size={18} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Aviso Operacional de Bodega:</p>
                          <p className="text-ink-700 text-caption">
                            El stock del inventario físico se actualiza únicamente al confirmar la recepción conforme en el andén de bodega, protegiendo las existencias reales contra descuadres contables.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isInvoiceNumberDuplicate || invoiceItems.length === 0}
                        className="w-full"
                      >
                        Registrar Factura de Compra
                      </Button>
                    </form>
                  </Card>
                </div>

                {/* ─── TARJETA CON EL PMP RESULTANTE EN VIVO (DERECHA) ─── */}
                <div className="lg:col-span-4 space-y-4">
                  <Card className="p-5 border-2 border-brand-200">
                    <div className="flex items-center gap-2 border-b border-ink-100 pb-3 text-brand-700">
                      <TrendingUp size={20} />
                      <h3 className="text-body font-bold text-ink-900">
                        PMP Resultante en Vivo
                      </h3>
                    </div>

                    <p className="mt-2 text-caption text-ink-500">
                      Simulación del Precio Medio Ponderado tras la incorporación del costo neto de esta factura:
                    </p>

                    <div className="mt-4 space-y-3">
                      {pmpSimulations.map((sim) => (
                        <div key={sim.sku} className="rounded-xl border border-ink-200 bg-white p-3 space-y-1.5">
                          <p className="text-body-sm font-bold text-ink-900 truncate">{sim.name}</p>
                          <span className="font-mono text-caption text-ink-500">{sim.sku}</span>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-caption">
                            <div>
                              <span className="text-ink-500">PMP Actual:</span>
                              <p className="font-bold tabular-nums text-ink-700">{formatCLP(sim.currentPmp)}</p>
                            </div>
                            <div>
                              <span className="text-ink-500">Nuevo PMP:</span>
                              <p className="font-bold tabular-nums text-brand-600">{formatCLP(sim.projectedPmp)}</p>
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500 border-t border-ink-100 pt-1">
                            <span>Variación unitaria:</span>
                            <span className={sim.diff > 0 ? "text-danger font-bold" : sim.diff < 0 ? "text-ok font-bold" : "text-ink-600"}>
                              {sim.diff > 0 ? `+${formatCLP(sim.diff)}` : formatCLP(sim.diff)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
