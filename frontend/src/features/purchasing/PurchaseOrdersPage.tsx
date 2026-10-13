import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Star,
  Trash2,
  Truck,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCLP, formatNumber } from "@/core/format";
import type {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Supplier,
  SupplierRating,
} from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { PRODUCTS, PURCHASE_ORDERS, SUPPLIERS } from "@/data/mock";

type OrderTab = "todas" | "borrador" | "enviada" | "recibida_parcial" | "recibida" | "cerrada" | "anulada";

export function PurchaseOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const toast = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>(PURCHASE_ORDERS);
  const [activeTab, setActiveTab] = useState<OrderTab>("todas");
  const [search, setSearch] = useState("");

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pdfPreviewOrder, setPdfPreviewOrder] = useState<PurchaseOrder | null>(null);
  const [ratingOrder, setRatingOrder] = useState<PurchaseOrder | null>(null);

  // Calificación del proveedor
  const [timeStars, setTimeStars] = useState(5);
  const [qualityStars, setQualityStars] = useState(5);
  const [priceStars, setPriceStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  // Formulario de nueva OC (o edición de borrador)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [formSupplierId, setFormSupplierId] = useState(SUPPLIERS[0]?.id ?? "sup1");
  const [formExpectedDate, setFormExpectedDate] = useState("2026-10-18");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<PurchaseOrderItem[]>([
    { sku: PRODUCTS[1]?.sku ?? "ELE-DIS-0016", name: PRODUCTS[1]?.name ?? "", quantity: 20, unitPrice: 3800, unit: "un" },
  ]);

  // Filtrado de OCs
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchTab = activeTab === "todas" ? true : o.status === activeTab;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        o.code.toLowerCase().includes(q) ||
        o.supplier.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [orders, activeTab, search]);

  const counts: Record<OrderTab, number> = {
    todas: orders.length,
    borrador: orders.filter((o) => o.status === "borrador").length,
    enviada: orders.filter((o) => o.status === "enviada").length,
    recibida_parcial: orders.filter((o) => o.status === "recibida_parcial").length,
    recibida: orders.filter((o) => o.status === "recibida").length,
    cerrada: orders.filter((o) => o.status === "cerrada").length,
    anulada: orders.filter((o) => o.status === "anulada").length,
  };

  // Manejo de ítems en el formulario
  const handleAddItem = () => {
    const first = PRODUCTS[0];
    setFormItems([
      ...formItems,
      { sku: first?.sku ?? "ELE-DIS-0016", name: first?.name ?? "", quantity: 10, unitPrice: first?.unitCost ?? 4000, unit: first?.unit ?? "un" },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleItemSkuChange = (idx: number, sku: string) => {
    const p = PRODUCTS.find((pr) => pr.sku === sku);
    const updated = [...formItems];
    updated[idx] = {
      ...updated[idx],
      sku,
      name: p?.name ?? "",
      unit: p?.unit ?? "un",
      unitPrice: p?.unitCost ?? 3000,
    };
    setFormItems(updated);
  };

  const handleItemQtyChange = (idx: number, quantity: number) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, quantity) };
    setFormItems(updated);
  };

  const handleItemPriceChange = (idx: number, unitPrice: number) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], unitPrice: Math.max(0, unitPrice) };
    setFormItems(updated);
  };

  // Cálculos en vivo del formulario
  const formSubtotal = formItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const formIva = Math.round(formSubtotal * 0.19);
  const formTotal = formSubtotal + formIva;

  // Abrir creación
  const openCreateModal = () => {
    setEditingOrder(null);
    setFormSupplierId(SUPPLIERS[0]?.id ?? "sup1");
    setFormExpectedDate("2026-10-18");
    setFormNotes("");
    setFormItems([
      { sku: PRODUCTS[1]?.sku ?? "ELE-DIS-0016", name: PRODUCTS[1]?.name ?? "", quantity: 20, unitPrice: 3800, unit: "un" },
    ]);
    setCreateModalOpen(true);
  };

  // Abrir edición (solo permitido en borrador)
  const openEditModal = (order: PurchaseOrder) => {
    if (order.status !== "borrador") {
      toast({
        tone: "warn",
        title: "Edición no permitida",
        description: "Las órdenes de compra solo pueden ser editadas en estado Borrador.",
      });
      return;
    }
    setEditingOrder(order);
    setFormSupplierId(order.supplierId);
    setFormExpectedDate(order.expectedDate);
    setFormNotes(order.notes ?? "");
    setFormItems([...order.items]);
    setCreateModalOpen(true);
  };

  // Guardar como Borrador
  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = SUPPLIERS.find((s) => s.id === formSupplierId);
    const newCode = editingOrder ? editingOrder.code : `OC-2026-0${104 + orders.length}`;

    const newOrder: PurchaseOrder = {
      id: editingOrder ? editingOrder.id : `oc-${Date.now()}`,
      code: newCode,
      supplierId: formSupplierId,
      supplier: sup?.businessName ?? "Proveedor",
      supplierRut: sup?.rut,
      status: "borrador",
      isAutoMinStock: false,
      items: formItems,
      subtotal: formSubtotal,
      iva: formIva,
      total: formTotal,
      itemsCount: formItems.length,
      date: new Date().toLocaleDateString("es-CL"),
      expectedDate: formExpectedDate,
      notes: formNotes.trim() || undefined,
    };

    if (editingOrder) {
      setOrders(orders.map((o) => (o.id === editingOrder.id ? newOrder : o)));
      toast({ tone: "ok", title: "Borrador actualizado", description: `${newCode} guardado como borrador.` });
    } else {
      setOrders([newOrder, ...orders]);
      toast({ tone: "ok", title: "Borrador de OC creado", description: `${newCode} guardado exitosamente.` });
    }

    setCreateModalOpen(false);
  };

  // Aprobar y Enviar (de Borrador a Enviada)
  const handleApproveAndSend = (order: PurchaseOrder) => {
    const updated: PurchaseOrder = {
      ...order,
      status: "enviada",
    };
    setOrders(orders.map((o) => (o.id === order.id ? updated : o)));
    toast({
      tone: "ok",
      title: `OC ${order.code} aprobada y enviada`,
      description: `Notificación y orden oficial despachada a ${order.supplier}.`,
    });
    if (pdfPreviewOrder?.id === order.id) setPdfPreviewOrder(updated);
  };

  // Abrir modal de calificación al cerrar una OC recibida
  const handleOpenCloseRating = (order: PurchaseOrder) => {
    setRatingOrder(order);
    setTimeStars(5);
    setQualityStars(5);
    setPriceStars(5);
    setRatingComment("");
  };

  // Confirmar cierre de OC y guardar calificación de proveedor
  const handleSaveRatingAndClose = () => {
    if (!ratingOrder) return;
    const avg = Number(((timeStars + qualityStars + priceStars) / 3).toFixed(1));

    const rating: SupplierRating = {
      timeRating: timeStars,
      qualityRating: qualityStars,
      priceRating: priceStars,
      average: avg,
      comment: ratingComment.trim() || undefined,
      ratedAt: new Date().toLocaleDateString("es-CL"),
    };

    const updated: PurchaseOrder = {
      ...ratingOrder,
      status: "cerrada",
      rating,
    };

    setOrders(orders.map((o) => (o.id === ratingOrder.id ? updated : o)));

    toast({
      tone: "ok",
      title: `OC ${ratingOrder.code} cerrada exitosamente`,
      description: `Evaluación registrada para ${ratingOrder.supplier} con promedio de ${avg} estrellas.`,
    });

    setRatingOrder(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Órdenes de Compra (OC)"
        subtitle="Emisión, vista previa de PDF, estados Borrador a Cerrada y calificación de proveedores"
        actions={
          isAdmin && (
            <Button onClick={openCreateModal} className="flex items-center gap-2">
              <Plus size={18} />
              <span>Nueva Orden de Compra</span>
            </Button>
          )
        }
      />

      {/* ─── PESTAÑAS POR ESTADO ─── */}
      <div className="flex flex-col gap-3 border-b border-ink-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "borrador", label: "Borrador" },
              { id: "enviada", label: "Enviadas" },
              { id: "recibida_parcial", label: "Recibidas Parcial" },
              { id: "recibida", label: "Recibidas" },
              { id: "cerrada", label: "Cerradas" },
              { id: "anulada", label: "Anuladas" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-caption font-semibold transition ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-white text-ink-800"
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por código, proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── TABLA DE ÓRDENES DE COMPRA ─── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-ink-100/70 text-caption font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3">Código OC</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Fecha Emisión</th>
                <th className="px-4 py-3">Fecha Esperada</th>
                <th className="px-4 py-3 text-center">Ítems</th>
                <th className="px-4 py-3 text-right">Monto Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-body-sm text-ink-500">
                    No hay órdenes de compra para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isDraft = o.status === "borrador";
                  const isSent = o.status === "enviada";
                  const isRec = o.status === "recibida";
                  const isClosed = o.status === "cerrada";

                  return (
                    <tr key={o.id} className="transition hover:bg-ink-50/70">
                      {/* Código OC con MARCA AUTOMÁTICA POR STOCK MÍNIMO */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-body-sm font-bold text-ink-900">
                            {o.code}
                          </span>
                          {o.isAutoMinStock && (
                            <span
                              title="Generada automáticamente por quiebre de stock mínimo"
                              className="inline-flex items-center gap-0.5 rounded-full bg-warn-soft px-2 py-0.5 font-sans text-[11px] font-bold text-warn"
                            >
                              <Zap size={11} className="fill-warn" />
                              Auto stock mín.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Proveedor */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-ink-900">{o.supplier}</p>
                        {o.supplierRut && (
                          <span className="font-mono text-caption text-ink-500">{o.supplierRut}</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-caption text-ink-600">{o.date}</td>
                      <td className="px-4 py-3.5 text-caption text-ink-600">{o.expectedDate}</td>

                      <td className="px-4 py-3.5 text-center font-bold tabular-nums">
                        {o.items.length} {o.items.length === 1 ? "ítem" : "ítems"}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-ink-900">
                        {formatCLP(o.total)}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <EstadoBadge estado={o.status as any} />
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Vista previa PDF */}
                          <IconButton
                            label="Vista previa PDF"
                            onClick={() => setPdfPreviewOrder(o)}
                          >
                            <FileText size={17} />
                          </IconButton>

                          {/* Editar solo en borrador */}
                          {isDraft && (
                            <IconButton
                              label="Editar borrador"
                              onClick={() => openEditModal(o)}
                            >
                              <Edit2 size={16} />
                            </IconButton>
                          )}

                          {/* Aprobar y enviar si está en borrador */}
                          {isDraft && (
                            <Button
                              size="md"
                              onClick={() => handleApproveAndSend(o)}
                              className="flex items-center gap-1 text-caption"
                            >
                              <Send size={14} />
                              <span>Aprobar y enviar</span>
                            </Button>
                          )}

                          {/* Modal de calificación al cerrar una OC recibida */}
                          {isRec && (
                            <Button
                              size="md"
                              onClick={() => handleOpenCloseRating(o)}
                              className="flex items-center gap-1 text-caption bg-ok hover:bg-ok/90"
                            >
                              <Star size={14} className="fill-white" />
                              <span>Cerrar y Calificar</span>
                            </Button>
                          )}

                          {/* Mostrar estrellas si ya está cerrada */}
                          {isClosed && o.rating && (
                            <span
                              title={`Calificación: ${o.rating.average} ⭐ (${o.rating.comment || 'Sin comentario'})`}
                              className="inline-flex items-center gap-1 rounded-lg bg-ink-100 px-2 py-1 text-caption font-bold text-ink-800"
                            >
                              <Star size={13} className="fill-amber-400 text-amber-500" />
                              {o.rating.average}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── MODAL FORMULARIO DE OC (EDITABLE SOLO EN BORRADOR) ─── */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title={editingOrder ? `Editar Borrador ${editingOrder.code}` : "Nueva Orden de Compra"}
          description="Formulario editable solo en estado Borrador. Previsualiza el PDF antes de emitir."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveDraft}>
                {editingOrder ? "Guardar Borrador" : "Crear Borrador"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveDraft} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Proveedor:
                </label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
                >
                  {SUPPLIERS.filter((s) => !s.disabled).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.businessName} (RUT: {s.rut})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Fecha estimada de entrega:
                </label>
                <input
                  type="date"
                  required
                  value={formExpectedDate}
                  onChange={(e) => setFormExpectedDate(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Ítems de la orden */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-caption font-semibold uppercase text-ink-700">
                  Ítems a Ordenar:
                </label>
                <Button size="md" variant="secondary" onClick={handleAddItem} className="text-caption">
                  <Plus size={14} />
                  <span>Agregar ítem</span>
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-ink-200 p-2">
                    <select
                      value={item.sku}
                      onChange={(e) => handleItemSkuChange(idx, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white p-2 text-body-sm focus:border-brand-600 focus:outline-none"
                    >
                      {PRODUCTS.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 w-24">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                        className="w-16 rounded-lg border border-ink-200 p-2 text-center text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                      />
                      <span className="font-mono text-caption text-ink-500">{item.unit}</span>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => handleItemPriceChange(idx, parseInt(e.target.value) || 0)}
                        placeholder="Precio unit."
                        className="w-full rounded-lg border border-ink-200 p-2 text-right text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                      />
                    </div>

                    <IconButton
                      label="Eliminar ítem"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={formItems.length <= 1}
                      className="text-danger hover:bg-danger-soft"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen monetario */}
            <div className="rounded-xl bg-ink-50 p-3 text-body-sm space-y-1">
              <div className="flex justify-between text-ink-600">
                <span>Subtotal neto:</span>
                <span className="font-semibold tabular-nums">{formatCLP(formSubtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>IVA (19%):</span>
                <span className="font-semibold tabular-nums">{formatCLP(formIva)}</span>
              </div>
              <div className="flex justify-between text-body font-bold text-ink-900 border-t border-ink-200/60 pt-1">
                <span>Total OC:</span>
                <span className="text-brand-600 tabular-nums">{formatCLP(formTotal)}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Notas y condiciones de entrega:
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ej: Despacho a Bodega Central. Acompañar con guía de despacho y factura electrónica."
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL VISTA PREVIA DEL PDF DE LA OC ─── */}
      {pdfPreviewOrder && (
        <Modal
          open={Boolean(pdfPreviewOrder)}
          onClose={() => setPdfPreviewOrder(null)}
          title={`Vista Previa de Orden de Compra: ${pdfPreviewOrder.code}`}
          description="Formato oficial imprimible y exportable para proveedor."
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                onClick={() => {
                  toast({
                    tone: "ok",
                    title: "Descargando documento PDF",
                    description: `Generando archivo ${pdfPreviewOrder.code}.pdf oficial.`,
                  });
                }}
                className="flex items-center gap-1.5"
              >
                <Download size={16} />
                <span>Descargar PDF</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setPdfPreviewOrder(null)}>
                  Cerrar
                </Button>
                {pdfPreviewOrder.status === "borrador" && (
                  <Button onClick={() => handleApproveAndSend(pdfPreviewOrder)}>
                    <Send size={16} />
                    <span>Aprobar y enviar</span>
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {/* FORMATO TIPO DOCUMENTO PDF */}
          <div className="rounded-2xl border-2 border-ink-200 bg-white p-6 shadow-sm space-y-6">
            {/* Membrete FYAG */}
            <div className="flex items-start justify-between border-b-2 border-brand-600 pb-4">
              <div>
                <h2 className="text-h2 font-black tracking-tight text-brand-700">FYAG SpA</h2>
                <p className="text-caption font-bold text-ink-700">RUT: 76.890.123-4 · Giro: Montajes y Servicios Eléctricos</p>
                <p className="text-caption text-ink-500">Av. Providencia 2450, Santiago · contacto@fyag.cl</p>
              </div>

              <div className="text-right">
                <span className="rounded-lg bg-brand-50 px-3 py-1 font-mono text-body font-bold text-brand-700 border border-brand-200">
                  {pdfPreviewOrder.code}
                </span>
                <p className="mt-1 text-caption text-ink-500">Fecha: {pdfPreviewOrder.date}</p>
                <EstadoBadge estado={pdfPreviewOrder.status as any} />
              </div>
            </div>

            {/* Datos del Proveedor */}
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-ink-50 p-4 text-body-sm">
              <div>
                <span className="text-caption font-bold uppercase text-ink-500">Proveedor Adjudicado:</span>
                <p className="font-bold text-ink-900">{pdfPreviewOrder.supplier}</p>
                <p className="text-caption text-ink-600">RUT: {pdfPreviewOrder.supplierRut || "76.432.890-K"}</p>
              </div>
              <div>
                <span className="text-caption font-bold uppercase text-ink-500">Condiciones de Despacho:</span>
                <p className="text-ink-800">Fecha límite de entrega: <strong>{pdfPreviewOrder.expectedDate}</strong></p>
                <p className="text-caption text-ink-500">Lugar: Bodega Central FYAG</p>
              </div>
            </div>

            {/* Tabla de ítems del documento */}
            <div className="overflow-hidden rounded-xl border border-ink-200">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-ink-100 text-caption font-semibold uppercase text-ink-700">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio Unit.</th>
                    <th className="px-3 py-2 text-right">Total Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 font-mono text-body-sm">
                  {pdfPreviewOrder.items.map((it) => (
                    <tr key={it.sku}>
                      <td className="px-3 py-2.5 text-caption font-bold text-ink-700">{it.sku}</td>
                      <td className="px-3 py-2.5 font-sans font-medium text-ink-900">{it.name}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCLP(it.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {formatCLP(it.quantity * it.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales del documento */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-body-sm">
                <div className="flex justify-between text-ink-600">
                  <span>Subtotal Neto:</span>
                  <span className="font-bold tabular-nums">{formatCLP(pdfPreviewOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-ink-600">
                  <span>IVA (19%):</span>
                  <span className="font-bold tabular-nums">{formatCLP(pdfPreviewOrder.iva)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-ink-900 pt-1 text-body font-black text-ink-900">
                  <span>TOTAL FACTURABLE:</span>
                  <span className="text-brand-700 tabular-nums">{formatCLP(pdfPreviewOrder.total)}</span>
                </div>
              </div>
            </div>

            {pdfPreviewOrder.notes && (
              <div className="border-t border-ink-100 pt-3 text-caption text-ink-600">
                <strong>Observaciones de la OC:</strong> {pdfPreviewOrder.notes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── MODAL DE CALIFICACIÓN DEL PROVEEDOR (AL CERRAR OC RECIBIDA) ─── */}
      {ratingOrder && (
        <Modal
          open={Boolean(ratingOrder)}
          onClose={() => setRatingOrder(null)}
          title={`Cerrar OC y Calificar a ${ratingOrder.supplier}`}
          description={`Orden ${ratingOrder.code}. Evalúa el desempeño del proveedor para alimentar el ranking histórico.`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setRatingOrder(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRatingAndClose} className="bg-ok hover:bg-ok/90">
                Guardar Evaluación y Cerrar OC
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* 3 Criterios de Calificación con Estrellas */}
            <div className="rounded-2xl border border-ink-200 bg-ink-50/70 p-4 space-y-4">
              {/* 1. Tiempo de Entrega */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-body-sm font-bold text-ink-900">1. Tiempo de Entrega (Puntualidad)</h4>
                  <p className="text-caption text-ink-500">¿Cumplió con la fecha acordada?</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setTimeStars(star)}
                      className="p-1 transition hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={22}
                        className={
                          star <= timeStars
                            ? "fill-amber-400 text-amber-500"
                            : "text-ink-300"
                        }
                      />
                    </button>
                  ))}
                  <span className="font-mono text-body-sm font-bold text-ink-800 ml-1">{timeStars}/5</span>
                </div>
              </div>

              {/* 2. Calidad de los Insumos */}
              <div className="flex items-center justify-between border-t border-ink-200/60 pt-3">
                <div>
                  <h4 className="text-body-sm font-bold text-ink-900">2. Calidad de los Insumos</h4>
                  <p className="text-caption text-ink-500">Embalaje, conformidad y cero defectos.</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setQualityStars(star)}
                      className="p-1 transition hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={22}
                        className={
                          star <= qualityStars
                            ? "fill-amber-400 text-amber-500"
                            : "text-ink-300"
                        }
                      />
                    </button>
                  ))}
                  <span className="font-mono text-body-sm font-bold text-ink-800 ml-1">{qualityStars}/5</span>
                </div>
              </div>

              {/* 3. Cumplimiento de Precio */}
              <div className="flex items-center justify-between border-t border-ink-200/60 pt-3">
                <div>
                  <h4 className="text-body-sm font-bold text-ink-900">3. Cumplimiento de Precio</h4>
                  <p className="text-caption text-ink-500">Respeto a cotización sin cobros imprevistos.</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setPriceStars(star)}
                      className="p-1 transition hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={22}
                        className={
                          star <= priceStars
                            ? "fill-amber-400 text-amber-500"
                            : "text-ink-300"
                        }
                      />
                    </button>
                  ))}
                  <span className="font-mono text-body-sm font-bold text-ink-800 ml-1">{priceStars}/5</span>
                </div>
              </div>
            </div>

            {/* Promedio resultante */}
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900">
              <span className="text-body-sm font-bold">Calificación Promedio Resultante:</span>
              <span className="flex items-center gap-1 text-h3 font-black text-amber-600">
                <Star size={20} className="fill-amber-500 text-amber-600" />
                {((timeStars + qualityStars + priceStars) / 3).toFixed(1)} / 5.0
              </span>
            </div>

            {/* Comentario opcional */}
            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Comentario u observaciones de desempeño:
              </label>
              <textarea
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Ej: Cumplieron con el despacho en 24h, empaque original sellado."
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
