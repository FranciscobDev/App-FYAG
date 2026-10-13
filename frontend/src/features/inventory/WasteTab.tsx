import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/overlay/Toast";
import { formatCLP, formatNumber } from "@/core/format";
import type { Product, WasteRecord } from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { WASTE_RECORDS } from "@/data/mock";

interface WasteTabProps {
  products: Product[];
  onProductStockChange?: (sku: string, newStock: number) => void;
}

export function WasteTab({ products, onProductStockChange }: WasteTabProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState<WasteRecord[]>(WASTE_RECORDS);

  // Formulario de merma
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku ?? "ELE-DIS-0016");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<"daño" | "caducidad" | "pérdida" | "otro">("daño");
  const [observation, setObservation] = useState("");

  const currentProduct = useMemo(() => {
    return products.find((p) => p.sku === selectedSku);
  }, [products, selectedSku]);

  const pmp = currentProduct?.pmp ?? currentProduct?.unitCost ?? 0;
  const availableStock = currentProduct?.stock ?? 0;

  // Validación: cantidad no mayor al disponible
  const isOverAvailable = quantity > availableStock;
  const isInvalid = isOverAvailable || quantity <= 0 || observation.trim().length < 8;

  // Pérdida valorizada a PMP
  const calculatedLoss = quantity * pmp;

  const handleRegisterWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;

    if (quantity > availableStock) {
      toast({
        tone: "danger",
        title: "Cantidad excede stock disponible",
        description: `Solo hay ${availableStock} ${currentProduct.unit} disponibles en bodega.`,
      });
      return;
    }

    if (observation.trim().length < 8) {
      toast({
        tone: "warn",
        title: "Observación obligatoria",
        description: "Describe detalladamente la causa de la merma para efectos de auditoría.",
      });
      return;
    }

    const newRecord: WasteRecord = {
      id: `wst-${Date.now().toString().slice(-4)}`,
      sku: currentProduct.sku,
      productName: currentProduct.name,
      quantity,
      unit: currentProduct.unit,
      pmp,
      totalLoss: calculatedLoss,
      reason,
      observation: observation.trim(),
      date: new Date().toLocaleDateString("es-CL") + " " + new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      user: user?.name ?? "Camila Vera Soto",
    };

    setRecords([newRecord, ...records]);
    onProductStockChange?.(currentProduct.sku, Math.max(0, availableStock - quantity));

    toast({
      tone: "ok",
      title: "Merma registrada en Cardex",
      description: `Se dio de baja ${quantity} ${currentProduct.unit} de ${currentProduct.name} (-${formatCLP(calculatedLoss)}).`,
    });

    setQuantity(1);
    setObservation("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* ─── FORMULARIO DE REGISTRO DE MERMA (IZQUIERDA) ─── */}
      <div className="lg:col-span-5">
        <Card className="p-5">
          <div className="border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2 text-danger">
              <AlertOctagon size={20} />
              <h3 className="text-body font-bold text-ink-900">
                Registrar Baja o Merma de Insumo
              </h3>
            </div>
            <p className="mt-0.5 text-caption text-ink-500">
              Descuenta stock por rotura, caducidad o merma justificada. Se registra en Cardex valorizado.
            </p>
          </div>

          <form onSubmit={handleRegisterWaste} className="mt-4 space-y-4">
            {/* Selector de Insumo */}
            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Insumo a mermar:
              </label>
              <select
                value={selectedSku}
                onChange={(e) => {
                  setSelectedSku(e.target.value);
                  setQuantity(1);
                }}
                className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} · {p.name} (Disp: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Datos de stock y PMP del insumo seleccionado */}
            {currentProduct && (
              <div className="rounded-xl bg-ink-50 p-3 text-body-sm">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-ink-500">Stock disponible:</span>
                  <strong className={availableStock === 0 ? "text-danger" : "text-ink-900"}>
                    {currentProduct.isBulk ? availableStock.toFixed(3) : availableStock} {currentProduct.unit}
                  </strong>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-caption text-ink-500">Precio Medio Ponderado (PMP):</span>
                  <strong className="text-ink-900">{formatCLP(pmp)}</strong>
                </div>
              </div>
            )}

            {/* Cantidad y Motivo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Cantidad a mermar:
                </label>
                <input
                  type="number"
                  step={currentProduct?.isBulk ? "0.001" : "1"}
                  min={currentProduct?.isBulk ? 0.001 : 1}
                  max={availableStock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className={`w-full rounded-xl border p-2.5 text-body-sm font-bold tabular-nums focus:outline-none ${
                    isOverAvailable
                      ? "border-danger bg-danger-soft/20 text-danger"
                      : "border-ink-200 text-ink-900 focus:border-brand-600"
                  }`}
                />
                {isOverAvailable && (
                  <p className="mt-1 text-[11px] font-bold text-danger">
                    No puede superar el disponible ({availableStock})
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Motivo de la merma:
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                >
                  <option value="daño">Daño / Rotura</option>
                  <option value="caducidad">Caducidad / Vencimiento</option>
                  <option value="pérdida">Pérdida / Extravío</option>
                  <option value="otro">Otro motivo técnico</option>
                </select>
              </div>
            </div>

            {/* Observación obligatoria */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-caption font-semibold text-ink-900">
                  Observación técnica obligatoria:
                </label>
                <span className={`text-[11px] ${observation.trim().length < 8 ? "text-warn" : "text-ok"}`}>
                  {observation.trim().length}/8 mín.
                </span>
              </div>
              <textarea
                required
                rows={3}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Indica el motivo exacto, sector de bodega o circunstancias del daño..."
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
              />
            </div>

            {/* ─── TARJETA CON PÉRDIDA VALORIZADA A PMP ─── */}
            <div className="rounded-2xl border border-danger-line/60 bg-danger-soft/30 p-4">
              <div className="flex items-center gap-2 text-danger">
                <DollarSign size={18} />
                <span className="text-caption font-bold uppercase tracking-wider">
                  Pérdida Valorizada a PMP
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-h2 font-bold tabular-nums text-danger">
                    {formatCLP(calculatedLoss)}
                  </span>
                  <span className="ml-2 text-caption text-ink-600">
                    ({quantity} {currentProduct?.unit} × {formatCLP(pmp)})
                  </span>
                </div>
              </div>
            </div>

            {/* Botón Registrar */}
            <Button
              type="submit"
              disabled={isInvalid || availableStock === 0}
              variant="danger"
              className="w-full"
            >
              Confirmar y descontar merma
            </Button>
          </form>
        </Card>
      </div>

      {/* ─── HISTÓRICO DE MERMAS REGISTRADAS (DERECHA) ─── */}
      <div className="lg:col-span-7">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-ink-600" />
              <h3 className="text-body font-bold text-ink-900">
                Histórico de Mermas Registradas
              </h3>
            </div>
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption font-semibold text-ink-700">
              {records.length} registros
            </span>
          </div>

          <div className="divide-y divide-ink-100 max-h-[560px] overflow-y-auto">
            {records.map((r) => (
              <div key={r.id} className="p-4 transition hover:bg-ink-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-caption font-bold text-ink-900">
                        {r.sku}
                      </span>
                      <Badge tone={r.reason === "daño" ? "danger" : "warn"}>
                        {r.reason.toUpperCase()}
                      </Badge>
                      <span className="text-caption text-ink-500">{r.date}</span>
                    </div>
                    <h4 className="mt-1 text-body-sm font-bold text-ink-900">
                      {r.productName}
                    </h4>
                  </div>

                  <div className="text-right">
                    <span className="text-body-sm font-bold tabular-nums text-danger">
                      -{formatCLP(r.totalLoss)}
                    </span>
                    <p className="text-caption text-ink-500">
                      {r.quantity} {r.unit} mermadas
                    </p>
                  </div>
                </div>

                <div className="mt-2 rounded-lg bg-ink-50 p-2 text-caption text-ink-700">
                  <span className="font-semibold text-ink-900">Observación:</span> {r.observation}
                </div>

                <p className="mt-1 text-right text-[11px] text-ink-500">
                  Registrado por: <strong>{r.user}</strong>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
