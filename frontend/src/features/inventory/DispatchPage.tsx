import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  Lock,
  Package,
  QrCode,
  ScanLine,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { QrScannerModal } from "@/components/shared/QrScannerModal";
import { formatNumber } from "@/core/format";
import type { MaterialRequest, Product, Technician } from "@/core/types";
import { MATERIAL_REQUESTS, PRODUCTS, TECHNICIANS } from "@/data/mock";

export function DispatchPage() {
  const toast = useToast();

  const [requests, setRequests] = useState<MaterialRequest[]>(
    MATERIAL_REQUESTS.filter((r) => r.status === "aprobada"),
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    requests[0]?.id ?? "",
  );

  // Selector de técnico que retira
  const [selectedTechnicianRut, setSelectedTechnicianRut] = useState<string>(
    TECHNICIANS[0].rut,
  );

  // Escáner QR
  const [qrOpen, setQrOpen] = useState(false);

  // Cantidades a entregar ahora en la solicitud seleccionada: SKU -> número
  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId);
  }, [requests, selectedRequestId]);

  const [deliverQuantities, setDeliverQuantities] = useState<Record<string, number>>({});

  // Inicializar o ajustar cantidades al cambiar de solicitud
  const currentItems = useMemo(() => {
    if (!selectedRequest) return [];
    return selectedRequest.items.map((it) => {
      const delivered = it.deliveredQuantity ?? 0;
      const pending = Math.max(0, it.quantity - delivered);
      const prod = PRODUCTS.find((p) => p.sku === it.sku);
      const available = prod?.stock ?? 0;
      const toDeliver = deliverQuantities[it.sku] ?? pending;

      return {
        ...it,
        delivered,
        pending,
        available,
        toDeliver,
        isBulk: Boolean(prod?.isBulk),
        capacity: prod?.containerCapacity ?? 100,
        exceedsStock: toDeliver > available,
        exceedsPending: toDeliver > pending,
      };
    });
  }, [selectedRequest, deliverQuantities]);

  // Validación de despacho
  const hasErrors = currentItems.some((it) => it.exceedsStock || it.exceedsPending || it.toDeliver < 0);
  const totalToDeliver = currentItems.reduce((s, it) => s + it.toDeliver, 0);

  // Modal de confirmación irreversible
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const handleQuantityChange = (sku: string, val: number) => {
    setDeliverQuantities((prev) => ({
      ...prev,
      [sku]: val,
    }));
  };

  const handleScanDetect = (code: string) => {
    setQrOpen(false);
    const matched = currentItems.find(
      (it) => it.sku.toLowerCase() === code.toLowerCase() || code.includes(it.sku),
    );
    if (matched) {
      toast({
        tone: "ok",
        title: `SKU Detectado en Solicitud: ${matched.sku}`,
        description: `Prellenando entrega de ${matched.name}.`,
      });
      // Prellena con el pendiente
      handleQuantityChange(matched.sku, matched.pending);
    } else {
      toast({
        tone: "warn",
        title: "Insumo no encontrado en esta solicitud",
        description: `Código escaneado: ${code}. No coincide con los ítems aprobados.`,
      });
    }
  };

  const handleConfirmDispatch = () => {
    if (!selectedRequest) return;
    const tech = TECHNICIANS.find((t) => t.rut === selectedTechnicianRut);

    // Actualizar cantidades entregadas en la solicitud
    const updatedItems = selectedRequest.items.map((it) => {
      const deliveredNow = deliverQuantities[it.sku] ?? Math.max(0, it.quantity - (it.deliveredQuantity ?? 0));
      const newDelivered = (it.deliveredQuantity ?? 0) + deliveredNow;
      return {
        ...it,
        deliveredQuantity: newDelivered,
      };
    });

    const isFullyDelivered = updatedItems.every((it) => (it.deliveredQuantity ?? 0) >= it.quantity);

    const updatedReq: MaterialRequest = {
      ...selectedRequest,
      items: updatedItems,
      status: isFullyDelivered ? ("entregada" as const) : ("aprobada" as const),
    };

    setRequests((prev) =>
      prev
        .map((r) => (r.id === selectedRequest.id ? updatedReq : r))
        .filter((r) => r.status === "aprobada"),
    );

    toast({
      tone: "ok",
      title: "Egreso registrado en Cardex",
      description: `Material entregado a ${tech?.name ?? 'Técnico'}. Comprobante emitido.`,
    });

    setConfirmModalOpen(false);
    setDeliverQuantities({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Egreso y Despacho de Materiales"
        subtitle="Entrega física de solicitudes aprobadas, control de saldo pendiente, granel con 3 decimales y contenedor"
        actions={
          <Button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-2 shadow-md"
          >
            <ScanLine size={18} />
            <span>Escanear SKU / Barras</span>
          </Button>
        }
      />

      {requests.length === 0 ? (
        <Card className="p-8 text-center text-body-sm text-ink-500">
          No hay solicitudes aprobadas pendientes de egreso en este momento.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ─── SELECTOR DE SOLICITUD APROBADA (COLUMNA IZQUIERDA) ─── */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-caption font-bold uppercase tracking-wider text-ink-500">
              Solicitudes Aprobadas ({requests.length}):
            </h3>
            <div className="space-y-2.5">
              {requests.map((r) => {
                const isSelected = r.id === selectedRequestId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(r.id);
                      setDeliverQuantities({});
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/50 shadow-sm"
                        : "border-ink-200 bg-white hover:border-brand-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-caption font-bold text-ink-900">{r.code}</span>
                      <EstadoBadge estado={r.status} />
                    </div>
                    <h4 className="mt-1 text-body-sm font-bold text-ink-900">{r.projectName}</h4>
                    <p className="text-caption text-ink-600">
                      Técnico: {r.technicianName}
                    </p>
                    <p className="mt-1 text-caption text-ink-500">
                      {r.items.length} productos solicitados
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── DETALLE DE DESPACHO Y TABLA DE ENTREGA (COLUMNA DERECHA) ─── */}
          <div className="lg:col-span-8">
            {selectedRequest && (
              <Card className="p-5 space-y-5">
                {/* Cabecera de la solicitud seleccionada */}
                <div className="border-b border-ink-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-caption font-bold text-ink-500">
                        {selectedRequest.code}
                      </span>
                      <h2 className="text-body-lg font-bold text-ink-900">
                        Despacho a {selectedRequest.projectName}
                      </h2>
                    </div>
                    <Badge tone="ok">APROBADA PARA ENTREGA</Badge>
                  </div>

                  {/* Selector de técnico que retira */}
                  <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
                    <label className="flex items-center gap-1.5 text-caption font-bold text-ink-900">
                      <UserCheck size={16} className="text-brand-600" />
                      <span>Técnico que retira en mesón:</span>
                    </label>
                    <select
                      value={selectedTechnicianRut}
                      onChange={(e) => setSelectedTechnicianRut(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-ink-200 bg-white p-2 text-body-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
                    >
                      {TECHNICIANS.map((t) => (
                        <option key={t.rut} value={t.rut}>
                          {t.name} (RUT: {t.rut}) · {t.specialty}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tabla de entrega parcial / total */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-body-sm">
                    <thead className="bg-ink-100 text-caption font-semibold uppercase text-ink-500">
                      <tr>
                        <th className="px-3 py-2">Insumo</th>
                        <th className="px-3 py-2 text-center">Solicitado</th>
                        <th className="px-3 py-2 text-center">Ya Entregado</th>
                        <th className="px-3 py-2 text-center">Pendiente</th>
                        <th className="px-3 py-2 text-center">Stock Disp.</th>
                        <th className="px-3 py-2 text-center w-36">A Entregar Ahora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {currentItems.map((it) => (
                        <tr key={it.sku} className="hover:bg-ink-50/60">
                          <td className="px-3 py-3">
                            <p className="font-bold text-ink-900">{it.name}</p>
                            <span className="font-mono text-caption text-ink-500">{it.sku}</span>
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {it.isBulk ? it.quantity.toFixed(3) : it.quantity} {it.unit}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums font-semibold text-ink-600">
                            {it.isBulk ? it.delivered.toFixed(3) : it.delivered} {it.unit}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums font-bold text-ink-900">
                            {it.isBulk ? it.pending.toFixed(3) : it.pending} {it.unit}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums font-semibold text-ok">
                            {it.isBulk ? it.available.toFixed(3) : it.available} {it.unit}
                          </td>

                          {/* Campo cantidad a entregar ahora */}
                          <td className="px-3 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              step={it.isBulk ? "0.001" : "1"}
                              max={it.pending}
                              value={it.toDeliver}
                              onChange={(e) =>
                                handleQuantityChange(
                                  it.sku,
                                  it.isBulk ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0,
                                )
                              }
                              className={`w-28 rounded-lg border p-1.5 text-center text-body-sm font-bold tabular-nums focus:outline-none ${
                                it.exceedsStock || it.exceedsPending
                                  ? "border-danger bg-danger-soft/20 text-danger"
                                  : "border-ink-200 text-ink-900 focus:border-brand-600"
                              }`}
                            />
                            {it.exceedsStock && (
                              <p className="text-[10px] font-bold text-danger">Supera stock</p>
                            )}
                            {it.exceedsPending && (
                              <p className="text-[10px] font-bold text-danger">Supera pendiente</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ─── SECCIÓN PARA PRODUCTOS A GRANEL: 3 DECIMALES & BARRA DE CAPACIDAD ─── */}
                {currentItems.some((it) => it.isBulk) && (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                    <h4 className="flex items-center gap-2 text-body-sm font-bold text-brand-900">
                      <Package size={18} />
                      <span>Monitoreo de Contenedores a Granel (3 Decimales)</span>
                    </h4>

                    {currentItems
                      .filter((it) => it.isBulk)
                      .map((bulkItem) => {
                        const remainingCapacity = Math.max(0, bulkItem.available - bulkItem.toDeliver);
                        const pctRemaining = (remainingCapacity / bulkItem.capacity) * 100;

                        return (
                          <div key={bulkItem.sku} className="rounded-xl border border-ink-200 bg-white p-3">
                            <div className="flex items-center justify-between text-caption font-semibold">
                              <span>
                                {bulkItem.name} ({bulkItem.sku})
                              </span>
                              <span>
                                Capacidad total contenedor: {bulkItem.capacity.toFixed(3)} {bulkItem.unit}
                              </span>
                            </div>

                            <div className="mt-2">
                              <ProgressBar
                                label={`Nivel restante tras entrega: ${remainingCapacity.toFixed(3)} ${bulkItem.unit}`}
                                value={pctRemaining}
                                tone={pctRemaining < 25 ? "danger" : pctRemaining < 50 ? "warn" : "ok"}
                                showValue={true}
                              />
                            </div>

                            <p className="mt-1 text-right text-[11px] text-ink-500">
                              Entrega actual a granel: <strong>{bulkItem.toDeliver.toFixed(3)} {bulkItem.unit}</strong>
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* ─── BOTÓN DE CONFIRMACIÓN ─── */}
                <div className="flex items-center justify-between border-t border-ink-100 pt-4">
                  <div>
                    {hasErrors && (
                      <p className="flex items-center gap-1 text-caption font-bold text-danger">
                        <AlertCircle size={16} />
                        <span>Corrige las cantidades marcadas en rojo para proceder.</span>
                      </p>
                    )}
                  </div>

                  <Button
                    disabled={hasErrors || totalToDeliver <= 0}
                    onClick={() => setConfirmModalOpen(true)}
                    className="flex items-center gap-2 shadow-md"
                  >
                    <ArrowUpFromLine size={18} />
                    <span>Confirmar egreso físico</span>
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMACIÓN CON AVISO IRREVERSIBLE ─── */}
      {confirmModalOpen && (
        <Modal
          open={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="¿Confirmar Egreso de Materiales?"
          description="Atención: Esta acción es definitiva para la trazabilidad de bodega."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmDispatch}>
                Confirmar entrega
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-warn-line bg-warn-soft p-4 text-warn">
              <div className="flex items-start gap-2">
                <AlertTriangle size={22} className="shrink-0 mt-0.5" />
                <div className="text-body-sm">
                  <p className="font-bold">
                    El egreso no se edita tras ser confirmado
                  </p>
                  <p className="mt-0.5 text-ink-700">
                    Al confirmar, se descontarán inmediatamente las existencias del inventario, se generará el asiento de salida en el Cardex y se cerrará la partida correspondiente.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-ink-50 p-3 text-body-sm space-y-1">
              <p>
                Obra destino: <strong>{selectedRequest?.projectName}</strong>
              </p>
              <p>
                Técnico que retira:{" "}
                <strong>
                  {TECHNICIANS.find((t) => t.rut === selectedTechnicianRut)?.name}
                </strong>
              </p>
              <p>
                Ítems a egresar: <strong>{currentItems.filter((i) => i.toDeliver > 0).length} productos</strong>
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL ESCÁNER QR/BARRAS ─── */}
      <QrScannerModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onDetect={handleScanDetect}
        title="Escanear Insumo de Egreso"
      />
    </div>
  );
}
