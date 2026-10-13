import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileSpreadsheet,
  FolderKanban,
  Package,
  PackageX,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge, SemaforoBadge, type Semaforo } from "@/components/shared/EstadoBadge";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { formatCLP, formatNumber } from "@/core/format";
import type { DashboardAlert, MaterialRequest, Project } from "@/core/types";
import {
  DASHBOARD_ALERTS,
  MATERIAL_REQUESTS,
  PRODUCTS,
  PROJECTS,
  PURCHASE_ORDERS,
  STOCK_STATUS,
} from "@/data/mock";

type CostFilter = "all" | "rojo" | "amarillo" | "verde";

export function AdminDashboardPage() {
  const toast = useToast();

  // Estados interactivos para solicitudes
  const [requests, setRequests] = useState<MaterialRequest[]>(MATERIAL_REQUESTS);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<MaterialRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [searchRequest, setSearchRequest] = useState("");

  // Estado para alertas
  const [alerts, setAlerts] = useState<DashboardAlert[]>(DASHBOARD_ALERTS);

  // Filtro de semáforo de costo
  const [costFilter, setCostFilter] = useState<CostFilter>("all");

  // Métricas calculadas para proyectos
  const projectMetrics = useMemo(() => {
    return PROJECTS.filter((p) => p.status !== "finalizado" && p.status !== "cerrado").map((p) => {
      const ratio = p.budget > 0 ? p.costReal / p.budget : 0;
      let semaforo: Semaforo = "verde";
      let statusLabel = "En orden";
      let tone: "ok" | "warn" | "danger" = "ok";

      if (p.costReal > p.budget) {
        semaforo = "rojo";
        const overPct = ((ratio - 1) * 100).toFixed(1);
        statusLabel = `Sobrecosto (+${overPct}%)`;
        tone = "danger";
      } else if (ratio >= 0.85) {
        semaforo = "amarillo";
        statusLabel = `Alerta (${(ratio * 100).toFixed(0)}%)`;
        tone = "warn";
      } else {
        semaforo = "verde";
        statusLabel = `En orden (${(ratio * 100).toFixed(0)}%)`;
        tone = "ok";
      }

      return {
        ...p,
        ratio,
        semaforo,
        statusLabel,
        tone,
        percentSpent: Math.min(Math.round(ratio * 100), 100),
      };
    });
  }, []);

  const redProjectsCount = projectMetrics.filter((p) => p.semaforo === "rojo").length;
  const filteredProjects = projectMetrics.filter((p) =>
    costFilter === "all" ? true : p.semaforo === costFilter,
  );

  // Métricas de KPIs
  const pendingRequests = requests.filter((r) => r.status === "pendiente");
  const lowStockCount = PRODUCTS.filter((p) => STOCK_STATUS(p) !== "ok").length;
  const openOrdersCount = PURCHASE_ORDERS.filter((o) => o.status !== "cerrada" && o.status !== "anulada").length;

  // Filtrado de solicitudes pendientes
  const filteredRequests = pendingRequests.filter((r) => {
    const q = searchRequest.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.technicianName.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q)
    );
  });

  // Acciones sobre solicitudes
  const handleApprove = (req: MaterialRequest) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "aprobada" as const } : r)),
    );
    toast({
      tone: "ok",
      title: `Solicitud ${req.code} aprobada`,
      description: `Notificación enviada a bodega y a ${req.technicianName}.`,
    });
    if (selectedRequest?.id === req.id) setSelectedRequest(null);
  };

  const handleRejectConfirm = () => {
    if (!rejectingRequest) return;
    setRequests((prev) =>
      prev.map((r) => (r.id === rejectingRequest.id ? { ...r, status: "rechazada" as const } : r)),
    );
    toast({
      tone: "danger",
      title: `Solicitud ${rejectingRequest.code} rechazada`,
      description: rejectReason
        ? `Motivo registrado: "${rejectReason}"`
        : "Se notificó el rechazo al técnico solicitante.",
    });
    setRejectingRequest(null);
    setRejectReason("");
    if (selectedRequest?.id === rejectingRequest.id) setSelectedRequest(null);
  };

  const handleDismissAlert = (id: string, title: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast({
      tone: "info",
      title: "Alerta atendida",
      description: `La alerta "${title}" fue procesada.`,
    });
  };

  return (
    <div className="space-y-8">
      {/* ─── ENCABEZADO PRINCIPAL ─── */}
      <PageHeader
        title="Dashboard de Administración"
        subtitle="Control ejecutivo de presupuestos, inventario crítico, órdenes de compra y solicitudes"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  tone: "ok",
                  title: "Exportando resumen ejecutivo",
                  description: "Se ha generado el archivo XLSX con los indicadores y costos del día.",
                });
              }}
            >
              <FileSpreadsheet size={16} />
              <span>Exportar informe</span>
            </Button>
          </div>
        }
      />

      {/* ─── 1. KPI CARDS (SOLICITUDES PENDIENTES, INSUMOS BAJO MÍNIMO, OC ABIERTAS, PROYECTOS EN ROJO) ─── */}
      <section aria-label="Indicadores clave de desempeño">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Solicitudes pendientes"
            value={pendingRequests.length}
            icon={ClipboardList}
            hint="Esperan aprobación de administración"
            trend={{ value: 25, label: "vs semana ant.", goodWhen: "down" }}
          />
          <KpiCard
            label="Insumos bajo mínimo"
            value={lowStockCount}
            icon={AlertTriangle}
            hint="1 en stock cero · 2 en reposición"
            trend={{ value: 12, label: "quiebre crítico", goodWhen: "down" }}
          />
          <KpiCard
            label="OC abiertas"
            value={openOrdersCount}
            icon={Receipt}
            hint="Total comprometido: $12.670.000"
          />
          <KpiCard
            label="Proyectos en rojo"
            value={redProjectsCount}
            icon={TrendingDown}
            hint="Superaron el 100% del presupuesto"
            trend={{ value: 50, label: "desviación activa", goodWhen: "down" }}
          />
        </div>
      </section>

      {/* ─── 2. LISTA DE PROYECTOS CON SEMÁFORO DE COSTO ─── */}
      <section aria-labelledby="cost-semaphore-heading">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-5 sm:flex sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FolderKanban className="text-brand-600" size={20} />
                <h2 id="cost-semaphore-heading" className="text-h3 font-bold text-ink-900">
                  Control de Costos de Proyectos
                </h2>
              </div>
              <p className="mt-1 text-body-sm text-ink-500">
                Semáforo financiero: verde (≤ 85%), amarillo (85% a 100%), rojo (&gt; 100% de sobrecosto).
              </p>
            </div>

            {/* Filtros de semáforo */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:mt-0">
              <span className="mr-1 text-caption font-semibold text-ink-500">Filtrar:</span>
              <button
                type="button"
                onClick={() => setCostFilter("all")}
                className={`rounded-lg px-2.5 py-1 text-caption font-semibold transition ${
                  costFilter === "all"
                    ? "bg-brand-600 text-white"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                Todos ({projectMetrics.length})
              </button>
              <button
                type="button"
                onClick={() => setCostFilter("rojo")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-caption font-semibold transition ${
                  costFilter === "rojo"
                    ? "bg-danger text-white"
                    : "bg-danger-soft text-danger hover:bg-danger-soft/80"
                }`}
              >
                <span className="size-1.5 rounded-full bg-danger" />
                Sobrecosto ({projectMetrics.filter((p) => p.semaforo === "rojo").length})
              </button>
              <button
                type="button"
                onClick={() => setCostFilter("amarillo")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-caption font-semibold transition ${
                  costFilter === "amarillo"
                    ? "bg-warn text-white"
                    : "bg-warn-soft text-warn hover:bg-warn-soft/80"
                }`}
              >
                <span className="size-1.5 rounded-full bg-warn" />
                En alerta ({projectMetrics.filter((p) => p.semaforo === "amarillo").length})
              </button>
              <button
                type="button"
                onClick={() => setCostFilter("verde")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-caption font-semibold transition ${
                  costFilter === "verde"
                    ? "bg-ok text-white"
                    : "bg-ok-soft text-ok hover:bg-ok-soft/80"
                }`}
              >
                <span className="size-1.5 rounded-full bg-ok" />
                En orden ({projectMetrics.filter((p) => p.semaforo === "verde").length})
              </button>
            </div>
          </div>

          <div className="divide-y divide-ink-100">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="p-5 transition hover:bg-ink-50/70 sm:flex sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption font-semibold text-ink-500">
                      {p.code}
                    </span>
                    <Badge tone={p.kind === "obra" ? "info" : "mute"}>
                      {p.kind === "obra" ? "Obra" : "Mantención"}
                    </Badge>
                    <SemaforoBadge nivel={p.semaforo} label={p.statusLabel} />
                  </div>
                  <h3 className="mt-1.5 text-body-lg font-bold text-ink-900">{p.name}</h3>
                  <p className="text-body-sm text-ink-500">{p.client} · {p.address}</p>

                  <div className="mt-3 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-caption text-ink-500">Presupuesto</p>
                      <p className="font-semibold tabular-nums text-ink-900">{formatCLP(p.budget)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-ink-500">Costo real acumulado</p>
                      <p
                        className={`font-semibold tabular-nums ${
                          p.semaforo === "rojo"
                            ? "text-danger"
                            : p.semaforo === "amarillo"
                              ? "text-warn"
                              : "text-ink-900"
                        }`}
                      >
                        {formatCLP(p.costReal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption text-ink-500">Avance físico obra</p>
                      <p className="font-semibold tabular-nums text-ink-900">{p.progress}%</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 w-full sm:mt-0 sm:w-64 sm:shrink-0">
                  <ProgressBar
                    label="Consumo presupuestario"
                    value={p.percentSpent}
                    tone={p.tone}
                    showValue={true}
                  />
                  <div className="mt-2 flex items-center justify-between text-caption text-ink-500">
                    <span>
                      {p.costReal > p.budget
                        ? `Excedido en ${formatCLP(p.costReal - p.budget)}`
                        : `Disponible: ${formatCLP(p.budget - p.costReal)}`}
                    </span>
                    <span className="font-bold tabular-nums">{(p.ratio * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ─── 3. ALERTAS RECIENTES ─── */}
      <section aria-labelledby="alerts-heading">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-warn" size={20} />
              <h2 id="alerts-heading" className="text-h3 font-bold text-ink-900">
                Alertas Recientes
              </h2>
            </div>
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-caption font-semibold text-warn">
              {alerts.length} activas
            </span>
          </div>

          <div className="divide-y divide-ink-100">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-body-sm text-ink-500">
                No hay alertas operacionales pendientes en este momento.
              </div>
            ) : (
              alerts.map((alert) => {
                const isRed = alert.severity === "rojo";
                return (
                  <div
                    key={alert.id}
                    className="flex flex-col gap-3 p-4 transition hover:bg-ink-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                          isRed
                            ? "bg-danger-soft text-danger"
                            : "bg-warn-soft text-warn"
                        }`}
                      >
                        {alert.type === "stock" && <PackageX size={18} />}
                        {alert.type === "costo" && <TrendingDown size={18} />}
                        {alert.type === "plazo" && <Clock size={18} />}
                        {alert.type === "solicitud" && <ClipboardList size={18} />}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-body-sm font-bold text-ink-900">{alert.title}</h4>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isRed
                                ? "bg-danger text-white"
                                : "bg-warn-soft text-warn"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-0.5 text-body-sm text-ink-600">{alert.description}</p>
                        <p className="mt-1 text-caption text-ink-500">{alert.time}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {alert.actionLabel && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            toast({
                              tone: "info",
                              title: `Acción: ${alert.actionLabel}`,
                              description: `Redirigiendo a gestión de "${alert.title}".`,
                            });
                          }}
                        >
                          {alert.actionLabel}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => handleDismissAlert(alert.id, alert.title)}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      {/* ─── 4. TABLA DE SOLICITUDES PENDIENTES ─── */}
      <section aria-labelledby="pending-requests-heading">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-5 sm:flex sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="text-brand-600" size={20} />
                <h2 id="pending-requests-heading" className="text-h3 font-bold text-ink-900">
                  Solicitudes Pendientes de Aprobación
                </h2>
              </div>
              <p className="mt-1 text-body-sm text-ink-500">
                Autoriza o rechaza los insumos pedidos por técnicos en terreno para retiro en bodega.
              </p>
            </div>

            {/* Buscador de solicitudes */}
            <div className="mt-3 sm:mt-0 sm:w-64">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
                <input
                  type="text"
                  placeholder="Buscar solicitud, técnico..."
                  value={searchRequest}
                  onChange={(e) => setSearchRequest(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-ink-100/70 text-caption font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Técnico solicitante</th>
                  <th className="px-5 py-3">Obra / Proyecto</th>
                  <th className="px-5 py-3">Fecha y hora</th>
                  <th className="px-5 py-3">Urgencia</th>
                  <th className="px-5 py-3">Ítems pedidos</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-body-sm text-ink-500">
                      No hay solicitudes pendientes que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const urgencyTone =
                      req.urgency === "urgente"
                        ? "danger"
                        : req.urgency === "alta"
                          ? "warn"
                          : "info";
                    const totalQty = req.items.reduce((s, it) => s + it.quantity, 0);

                    return (
                      <tr key={req.id} className="transition hover:bg-ink-50/70">
                        <td className="px-5 py-3.5 font-mono text-caption font-bold text-ink-900">
                          {req.code}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-ink-900">{req.technicianName}</p>
                          <p className="font-mono text-caption text-ink-500">{req.technicianRut}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-ink-900">{req.projectName}</p>
                          <p className="font-mono text-caption text-ink-500">{req.projectCode}</p>
                        </td>
                        <td className="px-5 py-3.5 text-caption text-ink-500">
                          {req.date}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={urgencyTone}>
                            {req.urgency.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-ink-900">{req.items.length} productos</span>
                          <span className="text-caption text-ink-500"> ({totalQty} unidades)</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <EstadoBadge estado="pendiente" />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton
                              label="Ver detalle de insumos"
                              onClick={() => setSelectedRequest(req)}
                            >
                              <Eye size={18} />
                            </IconButton>
                            <Button
                              variant="secondary"
                              onClick={() => setRejectingRequest(req)}
                              className="text-danger hover:bg-danger-soft/50"
                            >
                              Rechazar
                            </Button>
                            <Button
                              onClick={() => handleApprove(req)}
                            >
                              Aprobar
                            </Button>
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
      </section>

      {/* ─── MODAL DETALLE DE SOLICITUD ─── */}
      {selectedRequest && (
        <Modal
          open={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          title={`Detalle de Solicitud ${selectedRequest.code}`}
          description={`Solicitada por ${selectedRequest.technicianName} para ${selectedRequest.projectName}`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                Cerrar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const req = selectedRequest;
                  setSelectedRequest(null);
                  setRejectingRequest(req);
                }}
              >
                Rechazar
              </Button>
              <Button onClick={() => handleApprove(selectedRequest)}>
                Aprobar solicitud
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-ink-50 p-4">
              <div className="grid grid-cols-2 gap-2 text-body-sm sm:grid-cols-4">
                <div>
                  <span className="text-caption text-ink-500">Obra:</span>
                  <p className="font-semibold">{selectedRequest.projectName}</p>
                </div>
                <div>
                  <span className="text-caption text-ink-500">Técnico:</span>
                  <p className="font-semibold">{selectedRequest.technicianName}</p>
                </div>
                <div>
                  <span className="text-caption text-ink-500">Urgencia:</span>
                  <p className="font-semibold capitalize">{selectedRequest.urgency}</p>
                </div>
                <div>
                  <span className="text-caption text-ink-500">Fecha:</span>
                  <p className="font-semibold">{selectedRequest.date}</p>
                </div>
              </div>
              {selectedRequest.comment && (
                <div className="mt-3 border-t border-ink-200/60 pt-2 text-body-sm">
                  <span className="text-caption font-semibold text-ink-500">Motivo / Comentario:</span>
                  <p className="mt-0.5 italic text-ink-700">"{selectedRequest.comment}"</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-body-sm font-bold text-ink-900">
                Insumos requeridos ({selectedRequest.items.length})
              </h4>
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <table className="w-full text-left text-body-sm">
                  <thead className="bg-ink-100 text-caption font-semibold uppercase text-ink-500">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {selectedRequest.items.map((it) => (
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

      {/* ─── MODAL RECHAZO DE SOLICITUD ─── */}
      {rejectingRequest && (
        <Modal
          open={Boolean(rejectingRequest)}
          onClose={() => setRejectingRequest(null)}
          title={`Rechazar Solicitud ${rejectingRequest.code}`}
          description={`Indica el motivo del rechazo para informar a ${rejectingRequest.technicianName}.`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectingRequest(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRejectConfirm}>
                Confirmar rechazo
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label htmlFor="reject-reason" className="block text-body-sm font-semibold text-ink-900">
              Motivo del rechazo:
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: Insumos no contemplados en presupuesto de obra o stock insuficiente en bodega..."
              className="w-full rounded-xl border border-ink-200 p-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
