import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  FileCheck2,
  FileText,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { MaterialRequest, MaterialRequestItem, Product, Project, RequestTimelineStep } from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { KITS, MATERIAL_REQUESTS, PRODUCTS, PROJECTS } from "@/data/mock";

type TabFilter = "pendiente" | "aprobada" | "rechazada" | "todas";

export function RequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isWarehouse = user?.role === "warehouse";
  const toast = useToast();

  const [requests, setRequests] = useState<MaterialRequest[]>(MATERIAL_REQUESTS);
  const [activeTab, setActiveTab] = useState<TabFilter>("pendiente");
  const [search, setSearch] = useState("");

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalRequest, setDetailModalRequest] = useState<MaterialRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<MaterialRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);

  // Formulario Nueva Solicitud
  // Solo proyectos activos
  const activeProjects = useMemo(() => {
    return PROJECTS.filter((p) => p.status === "en_curso");
  }, []);

  const [formProjectId, setFormProjectId] = useState(activeProjects[0]?.id ?? "p1");
  const [formUrgency, setFormUrgency] = useState<"normal" | "alta" | "urgente">("normal");
  const [formComment, setFormComment] = useState("");
  const [formSelectedKit, setFormSelectedKit] = useState<string>("none");
  const [formItems, setFormItems] = useState<MaterialRequestItem[]>([
    { sku: PRODUCTS[1]?.sku ?? "ELE-DIS-0016", name: PRODUCTS[1]?.name ?? "", quantity: 2, unit: "un" },
  ]);

  // Validación de stock en el formulario
  const stockValidation = useMemo(() => {
    const missingItems: { name: string; sku: string; needed: number; available: number; unit: string }[] = [];

    for (const item of formItems) {
      const prod = PRODUCTS.find((p) => p.sku === item.sku);
      const available = prod ? prod.stock : 0;
      if (item.quantity > available) {
        missingItems.push({
          name: item.name || prod?.name || item.sku,
          sku: item.sku,
          needed: item.quantity,
          available,
          unit: item.unit,
        });
      }
    }

    return {
      hasStockDeficit: missingItems.length > 0,
      missingItems,
    };
  }, [formItems]);

  // Filtrado de solicitudes por pestaña y búsqueda
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchTab = activeTab === "todas" ? true : r.status === activeTab;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.technicianName.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [requests, activeTab, search]);

  const counts = {
    pendiente: requests.filter((r) => r.status === "pendiente").length,
    aprobada: requests.filter((r) => r.status === "aprobada").length,
    rechazada: requests.filter((r) => r.status === "rechazada").length,
    todas: requests.length,
  };

  // Manejo de Kits en el formulario
  const handleKitSelect = (kitId: string) => {
    setFormSelectedKit(kitId);
    if (kitId === "none") return;
    const kit = KITS.find((k) => k.id === kitId);
    if (kit) {
      setFormItems(
        kit.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
        })),
      );
      toast({
        tone: "info",
        title: `Kit ${kit.name} cargado`,
        description: `Se precargaron ${kit.items.length} insumos al formulario.`,
      });
    }
  };

  const handleAddItem = () => {
    const first = PRODUCTS[0];
    setFormItems([
      ...formItems,
      { sku: first?.sku ?? "ELE-DIS-0016", name: first?.name ?? "", quantity: 1, unit: first?.unit ?? "un" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemSkuChange = (index: number, newSku: string) => {
    const prod = PRODUCTS.find((p) => p.sku === newSku);
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      sku: newSku,
      name: prod?.name ?? "",
      unit: prod?.unit ?? "un",
    };
    setFormItems(updated);
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      quantity: Math.max(1, qty),
    };
    setFormItems(updated);
  };

  // Guardar nueva solicitud
  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (stockValidation.hasStockDeficit) {
      toast({
        tone: "danger",
        title: "Envío bloqueado por falta de stock",
        description: "Uno o más insumos superan el stock disponible en bodega.",
      });
      return;
    }

    const prj = PROJECTS.find((p) => p.id === formProjectId);
    const reqCode = `SOL-2026-0${413 + requests.length}`;

    const newReq: MaterialRequest = {
      id: `r-${Date.now()}`,
      code: reqCode,
      projectId: formProjectId,
      projectCode: prj?.code ?? "OB-2026-014",
      projectName: prj?.name ?? "Edificio Los Aromos",
      technicianRut: user?.rut ?? "15.321.654-2",
      technicianName: user?.name ?? "Camila Vera Soto",
      date: new Date().toLocaleDateString("es-CL") + " " + new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      urgency: formUrgency,
      status: "pendiente",
      items: formItems,
      comment: formComment.trim() || undefined,
      timeline: [
        {
          id: "t1",
          title: "Solicitud registrada",
          description: `Ingresada por ${user?.name ?? 'Operador'} para ${prj?.name}`,
          date: "Hoy",
          author: user?.name ?? "Operador",
          status: "completado",
        },
        {
          id: "t2",
          title: "En evaluación de Administración",
          description: "Esperando aprobación de Javier Muñoz",
          date: "Pendiente",
          author: "Javier Muñoz",
          status: "actual",
        },
      ],
    };

    setRequests([newReq, ...requests]);
    toast({
      tone: "ok",
      title: "Solicitud enviada a revisión",
      description: `Código ${reqCode} generado con éxito.`,
    });
    setCreateModalOpen(false);
    setFormComment("");
    setFormSelectedKit("none");
  };

  // Admin: Aprobar solicitud
  const handleAdminApprove = (req: MaterialRequest) => {
    const receiptNum = `COMP-${req.code.replace("SOL-", "")}`;
    const updatedReq: MaterialRequest = {
      ...req,
      status: "aprobada",
      receiptNumber: receiptNum,
      timeline: [
        ...(req.timeline ?? []),
        {
          id: `t-apr-${Date.now()}`,
          title: "Aprobada formalmente",
          description: "Autorizada por Administración para entrega en bodega",
          date: "Hoy",
          author: user?.name ?? "Javier Muñoz",
          status: "completado",
        },
      ],
    };

    setRequests((prev) => prev.map((r) => (r.id === req.id ? updatedReq : r)));
    toast({
      tone: "ok",
      title: `Solicitud ${req.code} aprobada`,
      description: `Comprobante numerado ${receiptNum} emitido.`,
    });
    if (detailModalRequest?.id === req.id) setDetailModalRequest(updatedReq);
  };

  // Admin: Rechazar solicitud (exige motivo)
  const handleAdminRejectConfirm = () => {
    if (!rejectingRequest) return;
    if (rejectionReason.trim().length < 6) {
      toast({
        tone: "warn",
        title: "Motivo obligatorio",
        description: "Debes detallar la justificación técnica o presupuestaria del rechazo.",
      });
      return;
    }

    const updatedReq: MaterialRequest = {
      ...rejectingRequest,
      status: "rechazada",
      rejectionReason: rejectionReason.trim(),
      timeline: [
        ...(rejectingRequest.timeline ?? []),
        {
          id: `t-rej-${Date.now()}`,
          title: "Solicitud rechazada",
          description: `Motivo: ${rejectionReason.trim()}`,
          date: "Hoy",
          author: user?.name ?? "Javier Muñoz",
          status: "completado",
        },
      ],
    };

    setRequests((prev) => prev.map((r) => (r.id === rejectingRequest.id ? updatedReq : r)));
    toast({
      tone: "danger",
      title: `Solicitud ${rejectingRequest.code} rechazada`,
      description: `Motivo registrado y notificado al técnico.`,
    });
    setRejectingRequest(null);
    setRejectionReason("");
    if (detailModalRequest?.id === rejectingRequest.id) setDetailModalRequest(updatedReq);
  };

  // Bodeguero: Anular solicitud (solo si pendiente)
  const handleBodegueroAnular = (req: MaterialRequest) => {
    const updatedReq: MaterialRequest = {
      ...req,
      status: "rechazada",
      rejectionReason: "Anulada por Bodega antes del despacho a solicitud de faena.",
    };
    setRequests((prev) => prev.map((r) => (r.id === req.id ? updatedReq : r)));
    toast({
      tone: "warn",
      title: `Solicitud ${req.code} anulada`,
      description: "Quedó cancelada en el sistema.",
    });
    if (detailModalRequest?.id === req.id) setDetailModalRequest(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Solicitudes de Insumos"
        subtitle="Flujo de solicitud, validación de stock, aprobación de administración y comprobantes de despacho"
        actions={
          <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
            <Plus size={18} />
            <span>Nueva Solicitud</span>
          </Button>
        }
      />

      {/* ─── PESTAÑAS: PENDIENTES, APROBADAS, RECHAZADAS, TODAS ─── */}
      <div className="flex flex-col gap-3 border-b border-ink-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "pendiente", label: "Pendientes", count: counts.pendiente, tone: "warn" },
              { id: "aprobada", label: "Aprobadas", count: counts.aprobada, tone: "ok" },
              { id: "rechazada", label: "Rechazadas", count: counts.rechazada, tone: "danger" },
              { id: "todas", label: "Todas", count: counts.todas, tone: "info" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-10 items-center gap-2 rounded-xl px-4 text-body-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-caption font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-white text-ink-800"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por código, técnico, obra..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── LISTA DE SOLICITUDES ─── */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <Card className="p-8 text-center text-body-sm text-ink-500">
            No hay solicitudes en la pestaña seleccionada.
          </Card>
        ) : (
          filteredRequests.map((req) => {
            const isPend = req.status === "pendiente";
            const isApr = req.status === "aprobada";
            const isRej = req.status === "rechazada";

            return (
              <Card key={req.id} className="p-5 transition hover:shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-body-sm font-bold text-ink-900">
                        {req.code}
                      </span>
                      <EstadoBadge estado={req.status} />
                      <Badge tone={req.urgency === "urgente" ? "danger" : req.urgency === "alta" ? "warn" : "info"}>
                        {req.urgency.toUpperCase()}
                      </Badge>
                      <span className="text-caption text-ink-500">{req.date}</span>
                    </div>

                    <h3 className="mt-1.5 text-body font-bold text-ink-900">
                      {req.projectName} <span className="font-mono text-caption text-ink-500">({req.projectCode})</span>
                    </h3>
                    <p className="text-body-sm text-ink-600">
                      Solicitante: <strong>{req.technicianName}</strong> ({req.technicianRut})
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-caption">
                      {req.items.map((it) => (
                        <span key={it.sku} className="rounded-lg bg-ink-100 px-2 py-0.5 text-ink-800">
                          <strong>{it.quantity} {it.unit}</strong> {it.name}
                        </span>
                      ))}
                    </div>

                    {req.rejectionReason && (
                      <p className="mt-2 text-caption font-semibold text-danger">
                        Motivo rechazo: "{req.rejectionReason}"
                      </p>
                    )}
                  </div>

                  {/* Acciones y permisos */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setDetailModalRequest(req)}
                      className="flex items-center gap-1.5"
                    >
                      <Eye size={16} />
                      <span>Ver detalle y línea de tiempo</span>
                    </Button>

                    {/* Acciones Bodeguero si pendiente: Modificar o Anular */}
                    {isWarehouse && isPend && (
                      <>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => {
                            setFormItems([...req.items]);
                            setCreateModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-ink-700"
                        >
                          <Edit2 size={15} />
                          <span>Modificar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleBodegueroAnular(req)}
                          className="flex items-center gap-1 text-danger hover:bg-danger-soft"
                        >
                          <Ban size={15} />
                          <span>Anular</span>
                        </Button>
                      </>
                    )}

                    {/* Acciones Admin: Aprobar o Rechazar */}
                    {isAdmin && isPend && (
                      <>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setRejectingRequest(req)}
                          className="text-danger hover:bg-danger-soft"
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="md"
                          onClick={() => handleAdminApprove(req)}
                        >
                          Aprobar
                        </Button>
                      </>
                    )}

                    {/* Comprobante si aprobada */}
                    {isApr && req.receiptNumber && (
                      <span className="inline-flex items-center gap-1 font-mono text-caption font-bold text-ok">
                        <FileCheck2 size={16} />
                        {req.receiptNumber}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── MODAL NUEVA SOLICITUD (CON VALIDACIÓN STOCK O KIT) ─── */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Generar Solicitud de Materiales"
          description="Selecciona la obra activa, carga insumos directos o un Kit preconfigurado."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={stockValidation.hasStockDeficit || formItems.length === 0}
                onClick={handleCreateRequest}
              >
                <Send size={16} />
                <span>Enviar solicitud</span>
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateRequest} className="space-y-4">
            {/* Proyecto (Solo Activos) */}
            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Proyecto / Obra (Solo obras activas):
              </label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name} ({p.client})
                  </option>
                ))}
              </select>
            </div>

            {/* Urgencia y Selección de Kit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Nivel de urgencia:
                </label>
                <select
                  value={formUrgency}
                  onChange={(e) => setFormUrgency(e.target.value as any)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="normal">Normal (24-48 hrs)</option>
                  <option value="alta">Alta (Mismo día)</option>
                  <option value="urgente">Urgente (Inmediato)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Cargar desde Kit preconfigurado:
                </label>
                <select
                  value={formSelectedKit}
                  onChange={(e) => handleKitSelect(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-brand-700 font-semibold focus:border-brand-600 focus:outline-none"
                >
                  <option value="none">-- Selección manual de insumos --</option>
                  {KITS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.id} · {k.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* AVISO DE STOCK DEFICITARIO & BLOQUEO */}
            {stockValidation.hasStockDeficit && (
              <div
                role="alert"
                className="rounded-2xl border-2 border-danger-line bg-danger-soft p-3 text-danger"
              >
                <div className="flex items-center gap-1.5 font-bold text-body-sm">
                  <AlertTriangle size={18} />
                  <span>Stock insuficiente en bodega (Envío Bloqueado)</span>
                </div>
                <p className="mt-1 text-caption text-ink-700">
                  No se puede enviar la solicitud porque los siguientes insumos superan el disponible actual:
                </p>
                <ul className="mt-1 list-disc pl-5 text-caption font-semibold">
                  {stockValidation.missingItems.map((m, idx) => (
                    <li key={idx}>
                      {m.name}: requerido {m.needed} {m.unit} · solo hay {m.available} {m.unit} en stock.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lista de Insumos */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-caption font-semibold uppercase text-ink-700">
                  Insumos Requeridos:
                </label>
                <Button size="md" variant="secondary" onClick={handleAddItem} className="text-caption">
                  <Plus size={14} />
                  <span>Agregar insumo</span>
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {formItems.map((item, idx) => {
                  const prod = PRODUCTS.find((p) => p.sku === item.sku);
                  const avail = prod?.stock ?? 0;
                  const isMissing = item.quantity > avail;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 rounded-xl border p-2 ${
                        isMissing ? "border-danger bg-danger-soft/20" : "border-ink-200"
                      }`}
                    >
                      <select
                        value={item.sku}
                        onChange={(e) => handleItemSkuChange(idx, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white p-2 text-body-sm focus:border-brand-600 focus:outline-none"
                      >
                        {PRODUCTS.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} · {p.name} (Disp: {p.stock} {p.unit})
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                          className="w-20 rounded-lg border border-ink-200 p-2 text-center text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                        />
                        <span className="font-mono text-caption text-ink-500 w-10">{item.unit}</span>
                      </div>

                      <IconButton
                        label="Eliminar insumo"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={formItems.length <= 1}
                        className="text-danger hover:bg-danger-soft"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Observación / Justificación:
              </label>
              <textarea
                rows={2}
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Indica el frente de trabajo, piso o urgencia técnica..."
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL DETALLE CON LÍNEA DE TIEMPO & COMPROBANTE NUMERADO ─── */}
      {detailModalRequest && (
        <Modal
          open={Boolean(detailModalRequest)}
          onClose={() => setDetailModalRequest(null)}
          title={`Detalle de Solicitud ${detailModalRequest.code}`}
          description={`Destino: ${detailModalRequest.projectName}`}
          footer={
            <div className="flex items-center justify-between w-full">
              {detailModalRequest.receiptNumber ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    toast({
                      tone: "ok",
                      title: "Imprimiendo comprobante oficial",
                      description: `Enviando ${detailModalRequest.receiptNumber} a impresora térmica de bodega.`,
                    });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Printer size={16} />
                  <span>Imprimir comprobante</span>
                </Button>
              ) : <div />}

              <Button variant="secondary" onClick={() => setDetailModalRequest(null)}>
                Cerrar
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* COMPROBANTE NUMERADO SI APROBADA */}
            {detailModalRequest.receiptNumber && (
              <div className="rounded-2xl border-2 border-ok-line bg-ok-soft/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-ok">
                    <FileCheck2 size={24} />
                    <div>
                      <h4 className="text-body-sm font-bold text-ink-900">
                        Comprobante Oficial de Despacho
                      </h4>
                      <p className="font-mono text-body font-bold text-ok">
                        N° {detailModalRequest.receiptNumber}
                      </p>
                    </div>
                  </div>
                  <Badge tone="ok">AUTORIZADO</Badge>
                </div>
              </div>
            )}

            {/* LÍNEA DE TIEMPO */}
            <div>
              <h4 className="mb-3 text-caption font-bold uppercase tracking-wider text-ink-500">
                Línea de Tiempo de la Solicitud:
              </h4>
              <div className="relative pl-6 space-y-4 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-0.5 before:bg-ink-200">
                {(detailModalRequest.timeline ?? [
                  { id: "1", title: "Solicitud registrada", description: "Por técnico en terreno", date: detailModalRequest.date, author: detailModalRequest.technicianName, status: "completado" },
                  { id: "2", title: "Evaluación administrativa", description: "Revisión presupuestaria", date: "Completado", author: "Javier Muñoz", status: "completado" },
                ]).map((step) => {
                  const isDone = step.status === "completado";
                  const isCurrent = step.status === "actual";
                  return (
                    <div key={step.id} className="relative">
                      <span
                        className={`absolute -left-6 top-0.5 grid size-5 place-items-center rounded-full text-white ${
                          isDone ? "bg-ok" : isCurrent ? "bg-brand-600 animate-pulse" : "bg-ink-300"
                        }`}
                      >
                        {isDone ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      </span>
                      <h5 className="text-body-sm font-bold text-ink-900">{step.title}</h5>
                      <p className="text-caption text-ink-600">{step.description}</p>
                      <p className="text-[11px] text-ink-500">{step.date} · {step.author}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE INSUMOS */}
            <div>
              <h4 className="mb-2 text-caption font-bold uppercase tracking-wider text-ink-500">
                Materiales Solicitados:
              </h4>
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <table className="w-full text-left text-body-sm">
                  <thead className="bg-ink-100 text-caption font-semibold uppercase text-ink-500">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2 text-right">Solicitado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {detailModalRequest.items.map((it) => (
                      <tr key={it.sku}>
                        <td className="px-3 py-2 font-mono text-caption text-ink-500">{it.sku}</td>
                        <td className="px-3 py-2 font-medium">{it.name}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {it.quantity} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL RECHAZO CON MOTIVO OBLIGATORIO (ADMIN) ─── */}
      {rejectingRequest && (
        <Modal
          open={Boolean(rejectingRequest)}
          onClose={() => setRejectingRequest(null)}
          title={`Rechazar Solicitud ${rejectingRequest.code}`}
          description="Norma de control: Toda solicitud rechazada exige registrar obligatoriamente la justificación para efectos de auditoría."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectingRequest(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleAdminRejectConfirm}>
                Confirmar rechazo
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block text-body-sm font-semibold text-ink-900">
              Motivo o justificación del rechazo (obligatorio):
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej: Ítems no corresponden al presupuesto aprobado o stock asignado a otra partida crítica..."
              className="w-full rounded-xl border border-ink-200 p-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-danger focus:outline-none"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
