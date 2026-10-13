import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Lock,
  Package,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Unlock,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/overlay/Toast";
import { QrScannerModal } from "@/components/shared/QrScannerModal";
import { formatCLP, formatNumber } from "@/core/format";
import type { PhysicalCount, Product } from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { PHYSICAL_COUNTS } from "@/data/mock";

interface PhysicalCountTabProps {
  products: Product[];
  onProductStockChange?: (sku: string, newStock: number) => void;
}

export function PhysicalCountTab({ products, onProductStockChange }: PhysicalCountTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const toast = useToast();

  const [counts, setCounts] = useState<PhysicalCount[]>(PHYSICAL_COUNTS);

  // Formulario de conteo
  const [selectedSku, setSelectedSku] = useState(products[1]?.sku ?? "ELE-DIS-0016");
  const [countedQty, setCountedQty] = useState(10);
  const [countNotes, setCountNotes] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const currentProduct = useMemo(() => {
    return products.find((p) => p.sku === selectedSku);
  }, [products, selectedSku]);

  const systemStock = currentProduct?.stock ?? 0;
  const pmp = currentProduct?.pmp ?? currentProduct?.unitCost ?? 0;

  // Diferencia calculada
  const diffQty = countedQty - systemStock;
  const diffPct = systemStock > 0 ? (diffQty / systemStock) * 100 : 0;
  const diffVal = diffQty * pmp;

  // Umbral 5%
  const exceedsThreshold = Math.abs(diffPct) > 5;

  // Insumo bloqueado si tiene un conteo pendiente de aprobación
  const isSkuLocked = counts.some(
    (c) => c.sku === selectedSku && c.status === "pendiente_aprobacion" && c.locked,
  );

  const handleRegisterCount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    const status: PhysicalCount["status"] = exceedsThreshold
      ? "pendiente_aprobacion"
      : "ajustado_directo";

    const newCount: PhysicalCount = {
      id: `cnt-${Date.now().toString().slice(-4)}`,
      sku: currentProduct.sku,
      productName: currentProduct.name,
      systemStock,
      countedStock: countedQty,
      difference: diffQty,
      differencePct: diffPct,
      pmp,
      differenceValue: diffVal,
      status,
      date: new Date().toLocaleDateString("es-CL") + " " + new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      counterUser: user?.name ?? "Camila Vera Soto",
      notes: countNotes.trim() || (exceedsThreshold ? "Superó umbral 5%. Espera visto bueno." : "Ajuste directo dentro de margen."),
      locked: exceedsThreshold,
    };

    setCounts([newCount, ...counts]);

    if (!exceedsThreshold) {
      onProductStockChange?.(currentProduct.sku, countedQty);
      toast({
        tone: "ok",
        title: "Conteo ajustado directo",
        description: `Diferencia de ${diffQty} ${currentProduct.unit} (≤ 5%). Stock actualizado a ${countedQty}.`,
      });
    } else {
      toast({
        tone: "warn",
        title: "Diferencia supera el 5% (Bloqueado)",
        description: `Desviación de ${diffPct.toFixed(1)}%. Queda pendiente de aprobación por Administración.`,
      });
    }

    setCountNotes("");
  };

  // Acciones de Administrador sobre conteos pendientes
  const handleAdminApprove = (c: PhysicalCount) => {
    setCounts((prev) =>
      prev.map((item) =>
        item.id === c.id ? { ...item, status: "aprobado", locked: false, approverUser: user?.name } : item,
      ),
    );
    onProductStockChange?.(c.sku, c.countedStock);
    toast({
      tone: "ok",
      title: `Ajuste aprobado por Administración`,
      description: `Stock de ${c.productName} ajustado a ${c.countedStock} ${currentProduct?.unit ?? 'un'}. Insumo desbloqueado.`,
    });
  };

  const handleAdminReject = (c: PhysicalCount) => {
    setCounts((prev) =>
      prev.map((item) =>
        item.id === c.id ? { ...item, status: "rechazado", locked: false, approverUser: user?.name } : item,
      ),
    );
    toast({
      tone: "danger",
      title: `Ajuste rechazado`,
      description: `Se solicitó re-conteo físico ciego para ${c.sku}.`,
    });
  };

  const handleScanDetect = (code: string) => {
    setQrOpen(false);
    const found = products.find(
      (p) => p.sku.toLowerCase() === code.toLowerCase() || (p.barcode && p.barcode.includes(code)),
    );
    if (found) {
      setSelectedSku(found.sku);
      setCountedQty(found.stock);
      toast({
        tone: "ok",
        title: `Insumo detectado: ${found.name}`,
        description: `SKU ${found.sku} seleccionado para conteo. Stock sistema: ${found.stock} ${found.unit}.`,
      });
    } else {
      toast({ tone: "warn", title: "Insumo no encontrado", description: `Código leído: ${code}` });
    }
  };

  const pendingAdminCounts = counts.filter((c) => c.status === "pendiente_aprobacion");

  return (
    <div className="space-y-6">
      {/* ─── BANNER DE INSUMO BLOQUEADO DURANTE EL CONTEO ─── */}
      {isSkuLocked && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger-line bg-danger-soft p-4 text-danger animate-pulse"
        >
          <Lock size={22} className="mt-0.5 shrink-0" />
          <div className="text-body-sm">
            <h4 className="font-bold text-danger">
              INVENTARIO CONGELADO: Insumo {selectedSku} Bloqueado
            </h4>
            <p className="mt-0.5 text-ink-700">
              Este insumo tiene una auditoría física abierta con desviación superior al 5%. Los movimientos de egreso, solicitud y traspasos para este SKU permanecen temporalmente bloqueados hasta la resolución de Administración.
            </p>
          </div>
        </div>
      )}

      {/* ─── GRID DE 2 COLUMNAS: FORMULARIO Y VISTA ADMIN/HISTORIAL ─── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* FORMULARIO DE CONTEO FÍSICO */}
        <div className="lg:col-span-5">
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} className="text-brand-600" />
                <h3 className="text-body font-bold text-ink-900">
                  Registro de Conteo Físico
                </h3>
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setQrOpen(true)}
                className="flex items-center gap-1.5 text-caption"
              >
                <ScanLine size={15} />
                <span>Escanear</span>
              </Button>
            </div>

            <form onSubmit={handleRegisterCount} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Seleccionar insumo a auditar:
                </label>
                <select
                  value={selectedSku}
                  onChange={(e) => {
                    setSelectedSku(e.target.value);
                    const p = products.find((pr) => pr.sku === e.target.value);
                    if (p) setCountedQty(p.stock);
                  }}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} · {p.name} (Sistema: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Comparador Sistema vs Conteo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-ink-100/70 p-3">
                  <span className="text-caption text-ink-500">Stock en sistema:</span>
                  <p className="mt-1 text-h2 font-bold tabular-nums text-ink-900">
                    {systemStock} <span className="text-body-sm font-normal text-ink-500">{currentProduct?.unit}</span>
                  </p>
                </div>

                <div className="rounded-xl border-2 border-brand-500 bg-brand-50/50 p-3">
                  <label className="block text-caption font-bold text-brand-900">
                    Cantidad contada física:
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={currentProduct?.isBulk ? "0.001" : "1"}
                    value={countedQty}
                    onChange={(e) => setCountedQty(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-brand-300 bg-white p-1 text-h2 font-bold tabular-nums text-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* ─── TARJETA DE DIFERENCIA EN CANTIDAD Y EN VALOR ─── */}
              <div
                className={`rounded-2xl border p-4 ${
                  exceedsThreshold
                    ? "border-danger-line bg-danger-soft/30 text-danger"
                    : Math.abs(diffQty) > 0
                      ? "border-warn-line bg-warn-soft/30 text-warn"
                      : "border-ok-line bg-ok-soft/30 text-ok"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-caption font-bold uppercase tracking-wider">
                    Diferencia detectada
                  </span>
                  <span className="text-caption font-semibold">
                    Desviación: {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(1)}%
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-h2 font-bold tabular-nums">
                      {diffQty >= 0 ? `+${diffQty}` : diffQty} {currentProduct?.unit}
                    </span>
                    <span className="ml-2 text-caption text-ink-600">
                      Impacto monetario: <strong>{diffVal >= 0 ? "+" : ""}{formatCLP(diffVal)}</strong>
                    </span>
                  </div>
                </div>

                {/* Mensaje de regla de umbral */}
                <div className="mt-3 border-t border-ink-200/50 pt-2 text-caption font-medium">
                  {exceedsThreshold ? (
                    <div className="flex items-center gap-1.5 text-danger font-bold">
                      <AlertTriangle size={15} />
                      <span>Supera umbral del 5%: Queda pendiente de aprobación por Admin.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-ok font-semibold">
                      <CheckCircle2 size={15} />
                      <span>Dentro del margen permitido (≤ 5%): Se ajusta directo al stock.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas de conteo */}
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Notas / Observaciones del conteo:
                </label>
                <textarea
                  rows={2}
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  placeholder="Ej: Conteo físico verificado en gaveta superior..."
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <Button type="submit" className="w-full">
                Registrar conteo físico
              </Button>
            </form>
          </Card>
        </div>

        {/* VISTA ADMIN CON CONTEOS PENDIENTES & HISTORIAL (DERECHA) */}
        <div className="space-y-5 lg:col-span-7">
          {/* SECCIÓN ADMIN: CONTEOS PENDIENTES DE APROBACIÓN */}
          <Card className="overflow-hidden border-2 border-warn-line">
            <div className="flex items-center justify-between border-b border-ink-100 bg-warn-soft/30 p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-warn" />
                <h3 className="text-body font-bold text-ink-900">
                  Vista Admin: Conteos Pendientes de Aprobación
                </h3>
              </div>
              <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-caption font-bold text-danger">
                {pendingAdminCounts.length} pendientes
              </span>
            </div>

            <div className="divide-y divide-ink-100">
              {pendingAdminCounts.length === 0 ? (
                <div className="p-6 text-center text-body-sm text-ink-500">
                  No hay conteos pendientes que superen el umbral de tolerancia.
                </div>
              ) : (
                pendingAdminCounts.map((c) => (
                  <div key={c.id} className="p-4 transition hover:bg-ink-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-caption font-bold text-ink-900">{c.sku}</span>
                          <Badge tone="danger">Desviación: {c.differencePct.toFixed(1)}%</Badge>
                          <span className="text-caption text-ink-500">{c.date}</span>
                        </div>
                        <h4 className="mt-1 text-body-sm font-bold text-ink-900">{c.productName}</h4>
                        <p className="mt-0.5 text-caption text-ink-600">
                          Sistema: <strong>{c.systemStock}</strong> · Físico: <strong>{c.countedStock}</strong> · Diferencia: <strong className="text-danger">{c.difference}</strong>
                        </p>
                        <p className="text-caption font-semibold text-danger">
                          Pérdida/Descuadre: {formatCLP(c.differenceValue)}
                        </p>
                      </div>

                      {/* Botones Admin */}
                      {isAdmin ? (
                        <div className="flex flex-col gap-1.5 sm:flex-row">
                          <Button
                            variant="secondary"
                            onClick={() => handleAdminReject(c)}
                            className="text-danger hover:bg-danger-soft"
                          >
                            Rechazar
                          </Button>
                          <Button
                            onClick={() => handleAdminApprove(c)}
                          >
                            Aprobar ajuste
                          </Button>
                        </div>
                      ) : (
                        <span className="rounded-lg bg-warn-soft px-2 py-1 text-caption font-semibold text-warn">
                          Requiere visto bueno de Admin
                        </span>
                      )}
                    </div>

                    {c.notes && (
                      <div className="mt-2 rounded-lg bg-ink-50 p-2 text-caption text-ink-700">
                        <span className="font-semibold text-ink-900">Nota del auditor:</span> {c.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* HISTORIAL GENERAL DE AUDITORÍAS */}
          <Card className="overflow-hidden">
            <div className="border-b border-ink-100 p-4">
              <h3 className="text-body font-bold text-ink-900">
                Historial de Conteos y Ajustes
              </h3>
            </div>
            <div className="divide-y divide-ink-100 max-h-72 overflow-y-auto">
              {counts.map((c) => (
                <div key={c.id} className="p-3.5 text-body-sm transition hover:bg-ink-50/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-caption font-bold text-ink-900">{c.sku}</span>
                      <span className="ml-2 font-medium text-ink-800">{c.productName}</span>
                    </div>
                    <Badge
                      tone={
                        c.status === "aprobado" || c.status === "ajustado_directo"
                          ? "ok"
                          : c.status === "rechazado"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {c.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-caption text-ink-500">
                    <span>
                      Físico: <strong>{c.countedStock}</strong> (dif: {c.difference >= 0 ? "+" : ""}{c.difference})
                    </span>
                    <span>{c.date} · {c.counterUser}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ESCÁNER QR/BARRAS */}
      <QrScannerModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onDetect={handleScanDetect}
        title="Escanear Insumo para Conteo Físico"
      />
    </div>
  );
}
