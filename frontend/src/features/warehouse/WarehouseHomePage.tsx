import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  ScanLine,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { QrScannerModal } from "@/components/shared/QrScannerModal";
import type { MaterialRequest, PendingReceipt, Product, ReturnOrder } from "@/core/types";
import {
  MATERIAL_REQUESTS,
  PENDING_RECEIPTS,
  PRODUCTS,
  RETURN_ORDERS,
  STOCK_STATUS,
} from "@/data/mock";

export function WarehouseHomePage() {
  const toast = useToast();

  // Escáner QR/barras
  const [qrOpen, setQrOpen] = useState(false);

  // Estados interactivos
  const [approvedRequests, setApprovedRequests] = useState<MaterialRequest[]>(
    MATERIAL_REQUESTS.filter((r) => r.status === "aprobada"),
  );
  const [returns, setReturns] = useState<ReturnOrder[]>(RETURN_ORDERS);
  const [receipts, setReceipts] = useState<PendingReceipt[]>(PENDING_RECEIPTS);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  // Modal para detalle de egreso
  const [egresoModal, setEgresoModal] = useState<MaterialRequest | null>(null);

  // Productos con stock crítico
  const criticalProducts = products.filter((p) => STOCK_STATUS(p) !== "ok");

  // Acciones interactivas
  const handleDeliverRequest = (req: MaterialRequest) => {
    setApprovedRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast({
      tone: "ok",
      title: `Egreso registrado: ${req.code}`,
      description: `Insumos entregados a ${req.technicianName} para obra ${req.projectName}.`,
    });
    setEgresoModal(null);
  };

  const handleConfirmReturn = (ret: ReturnOrder) => {
    setReturns((prev) =>
      prev.map((r) => (r.id === ret.id ? { ...r, status: "recibida" as const } : r)),
    );
    toast({
      tone: "ok",
      title: `Devolución ${ret.code} recibida`,
      description: `Materiales reingresados a inventario desde ${ret.projectName}.`,
    });
  };

  const handleConfirmReceipt = (rec: PendingReceipt) => {
    setReceipts((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, status: "conforme" as const } : r)),
    );
    toast({
      tone: "ok",
      title: `Recepción ${rec.ocCode} conforme`,
      description: `${rec.packagesCount} bultos de ${rec.supplier} registrados en inventario.`,
    });
  };

  const handleReplenish = (p: Product) => {
    toast({
      tone: "info",
      title: `Solicitud de compra generada`,
      description: `Se notificó a Administración para reponer ${p.name} (SKU: ${p.sku}).`,
    });
  };

  const handleQrDetect = (code: string) => {
    setQrOpen(false);
    const found = products.find(
      (p) => p.sku.toLowerCase() === code.toLowerCase() || code.includes(p.sku),
    );
    if (found) {
      toast({
        tone: "ok",
        title: `Producto detectado: ${found.name}`,
        description: `SKU: ${found.sku} · Ubicación: Pasillo ${found.location} · Stock: ${found.stock} ${found.unit}`,
      });
    } else {
      toast({
        tone: "info",
        title: `Código escaneado: ${code}`,
        description: "Buscando coincidencias en el catálogo de insumos...",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* ─── ENCABEZADO ─── */}
      <PageHeader
        title="Gestión de Bodega"
        subtitle="Panel operativo de recepción, despacho de materiales, devoluciones y stock crítico"
        actions={
          <Button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-2 shadow-md"
          >
            <ScanLine size={18} />
            <span>Escanear QR / Barra</span>
          </Button>
        }
      />

      {/* ─── 1. ACCESOS RÁPIDOS (ERGONOMÍA TABLET) ─── */}
      <section aria-label="Accesos rápidos de bodega">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {/* 1. Registrar Egreso */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("seccion-egresos");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group relative flex min-h-36 flex-col justify-between rounded-3xl border border-ink-200 bg-white p-5 text-left shadow-(--shadow-card) transition hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:scale-105">
                <ArrowUpFromLine size={24} />
              </span>
              {approvedRequests.length > 0 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-caption font-bold text-white shadow-sm">
                  {approvedRequests.length}
                </span>
              )}
            </div>
            <div>
              <p className="text-body font-bold text-ink-900">Registrar egreso</p>
              <p className="text-caption text-ink-500">Salida a técnico/obra</p>
            </div>
          </button>

          {/* 2. Recepción de Compras */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("seccion-recepciones");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group relative flex min-h-36 flex-col justify-between rounded-3xl border border-ink-200 bg-white p-5 text-left shadow-(--shadow-card) transition hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-ok-soft text-ok transition group-hover:scale-105">
                <ArrowDownToLine size={24} />
              </span>
              {receipts.filter((r) => r.status === "por_confirmar").length > 0 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-ok text-caption font-bold text-white shadow-sm">
                  {receipts.filter((r) => r.status === "por_confirmar").length}
                </span>
              )}
            </div>
            <div>
              <p className="text-body font-bold text-ink-900">Recepción compras</p>
              <p className="text-caption text-ink-500">Verificar OC arribadas</p>
            </div>
          </button>

          {/* 3. Devoluciones */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("seccion-devoluciones");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="group relative flex min-h-36 flex-col justify-between rounded-3xl border border-ink-200 bg-white p-5 text-left shadow-(--shadow-card) transition hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-transit-soft text-transit transition group-hover:scale-105">
                <RotateCcw size={24} />
              </span>
              {returns.filter((r) => r.status === "en_transito").length > 0 && (
                <span className="flex size-7 items-center justify-center rounded-full bg-transit text-caption font-bold text-white shadow-sm">
                  {returns.filter((r) => r.status === "en_transito").length}
                </span>
              )}
            </div>
            <div>
              <p className="text-body font-bold text-ink-900">Devoluciones</p>
              <p className="text-caption text-ink-500">Material desde obras</p>
            </div>
          </button>

          {/* 4. Conteo Cíclico */}
          <Link
            to="/bodega/conteo"
            className="group flex min-h-36 flex-col justify-between rounded-3xl border border-ink-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-info-soft text-info transition group-hover:scale-105">
              <ClipboardCheck size={24} />
            </span>
            <div>
              <p className="text-body font-bold text-ink-900">Conteo cíclico</p>
              <p className="text-caption text-ink-500">Auditoría física</p>
            </div>
          </Link>

          {/* 5. Escanear Producto */}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group flex min-h-36 flex-col justify-between rounded-3xl bg-brand-600 p-5 text-left text-white shadow-lg transition hover:bg-brand-700 active:scale-[0.98]"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-white/20 text-white transition group-hover:scale-105">
              <ScanLine size={26} />
            </span>
            <div>
              <p className="text-body font-bold text-white">Escanear producto</p>
              <p className="text-caption text-white/80">Cámara QR / Barras</p>
            </div>
          </button>
        </div>
      </section>

      {/* ─── 2. STOCK CRÍTICO (UBICACIONES DE PASILLO Y REPOSICIÓN) ─── */}
      <section aria-labelledby="stock-critico-heading">
        <Card className="overflow-hidden border-warn-line/70">
          <div className="flex items-center justify-between border-b border-ink-100 bg-warn-soft/20 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-danger" size={22} />
              <h2 id="stock-critico-heading" className="text-h3 font-bold text-ink-900">
                Stock Crítico en Bodega
              </h2>
            </div>
            <span className="rounded-full bg-danger-soft px-3 py-1 text-caption font-bold text-danger">
              {criticalProducts.length} insumos requieren atención
            </span>
          </div>

          <div className="divide-y divide-ink-100">
            {criticalProducts.map((p) => {
              const isZero = p.stock === 0;
              return (
                <div
                  key={p.sku}
                  className="p-5 transition hover:bg-ink-50/70 sm:flex sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-caption font-semibold text-ink-500">
                        {p.sku}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-caption font-bold text-brand-700">
                        <MapPin size={12} />
                        Ubicación: {p.location}
                      </span>
                      <Badge tone={isZero ? "danger" : "warn"}>
                        {isZero ? "Sin stock (0)" : `Bajo mínimo (${p.stock})`}
                      </Badge>
                    </div>

                    <h3 className="mt-1.5 text-body-lg font-bold text-ink-900">{p.name}</h3>
                    <p className="text-body-sm text-ink-500">Categoría: {p.category}</p>

                    <div className="mt-2 flex items-center gap-4 text-body-sm">
                      <span className="text-ink-600">
                        Stock actual: <strong className={isZero ? "text-danger" : "text-warn"}>{p.stock} {p.unit}</strong>
                      </span>
                      <span className="text-ink-400">·</span>
                      <span className="text-ink-500">
                        Mínimo requerido: <strong className="text-ink-900">{p.minStock} {p.unit}</strong>
                      </span>
                      <span className="text-ink-400">·</span>
                      <span className="text-ink-500">
                        Faltante: <strong className="text-danger">{Math.max(0, p.minStock - p.stock)} {p.unit}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 sm:mt-0">
                    <Button
                      variant="secondary"
                      onClick={() => handleReplenish(p)}
                      className="whitespace-nowrap"
                    >
                      <Plus size={16} />
                      <span>Solicitar compra</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* ─── 3. APROBADAS PENDIENTES DE EGRESO ─── */}
      <section id="seccion-egresos" aria-labelledby="aprobadas-egreso-heading">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 p-5">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="text-brand-600" size={22} />
              <div>
                <h2 id="aprobadas-egreso-heading" className="text-h3 font-bold text-ink-900">
                  Aprobadas Pendientes de Egreso
                </h2>
                <p className="mt-0.5 text-body-sm text-ink-500">
                  Solicitudes aprobadas por Administración listas para entrega física a técnicos
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-caption font-bold text-brand-700">
              {approvedRequests.length} listas para retiro
            </span>
          </div>

          <div className="divide-y divide-ink-100">
            {approvedRequests.length === 0 ? (
              <div className="p-8 text-center text-body-sm text-ink-500">
                No hay solicitudes pendientes de despacho en este momento.
              </div>
            ) : (
              approvedRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-5 transition hover:bg-ink-50/70 sm:flex sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-caption font-bold text-ink-900">{req.code}</span>
                      <EstadoBadge estado="aprobada" />
                      <Badge tone={req.urgency === "alta" ? "warn" : "info"}>
                        {req.urgency.toUpperCase()}
                      </Badge>
                      <span className="text-caption text-ink-500">{req.date}</span>
                    </div>

                    <h3 className="mt-1 text-body-lg font-bold text-ink-900">
                      Retira: {req.technicianName}
                    </h3>
                    <p className="text-body-sm text-ink-600">
                      Destino: <strong>{req.projectName}</strong> ({req.projectCode})
                    </p>

                    <div className="mt-3 rounded-xl bg-ink-50 p-3">
                      <p className="mb-1 text-caption font-semibold text-ink-500 uppercase">
                        Materiales a entregar:
                      </p>
                      <ul className="flex flex-wrap gap-2 text-body-sm">
                        {req.items.map((it) => (
                          <li
                            key={it.sku}
                            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-ink-900"
                          >
                            <span className="font-semibold">{it.quantity} {it.unit}</span> {it.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 sm:mt-0 sm:flex-col sm:items-end">
                    <Button
                      onClick={() => handleDeliverRequest(req)}
                      className="w-full sm:w-auto"
                    >
                      <CheckCircle2 size={18} />
                      <span>Registrar egreso</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {/* ─── 4. DEVOLUCIONES EN TRÁNSITO & 5. RECEPCIONES POR CONFIRMAR (GRID 2 COLUMNAS) ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. DEVOLUCIONES EN TRÁNSITO */}
        <section id="seccion-devoluciones" aria-labelledby="devoluciones-heading">
          <Card className="h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 p-5">
              <div className="flex items-center gap-2">
                <Truck className="text-transit" size={20} />
                <h2 id="devoluciones-heading" className="text-body-lg font-bold text-ink-900">
                  Devoluciones en Tránsito
                </h2>
              </div>
              <span className="rounded-full bg-transit-soft px-2.5 py-0.5 text-caption font-bold text-transit">
                {returns.filter((r) => r.status === "en_transito").length} en camino
              </span>
            </div>

            <div className="divide-y divide-ink-100">
              {returns.map((ret) => {
                const isTransit = ret.status === "en_transito";
                return (
                  <div key={ret.id} className="p-4 transition hover:bg-ink-50/70">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-caption font-bold text-ink-900">{ret.code}</span>
                      <EstadoBadge estado={ret.status} />
                    </div>

                    <h4 className="mt-1 text-body-sm font-bold text-ink-900">
                      Desde: {ret.projectName}
                    </h4>
                    <p className="text-caption text-ink-500">
                      Responsable: {ret.technicianName} · Enviado: {ret.date}
                    </p>

                    <div className="mt-2 rounded-lg bg-ink-50 p-2 text-body-sm text-ink-700">
                      <span className="font-semibold text-ink-900">Contenido:</span> {ret.summary}
                    </div>

                    {isTransit && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => handleConfirmReturn(ret)}
                        >
                          <CheckCircle2 size={16} />
                          <span>Confirmar ingreso</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* 5. RECEPCIONES POR CONFIRMAR */}
        <section id="seccion-recepciones" aria-labelledby="recepciones-heading">
          <Card className="h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 p-5">
              <div className="flex items-center gap-2">
                <Boxes className="text-ok" size={20} />
                <h2 id="recepciones-heading" className="text-body-lg font-bold text-ink-900">
                  Recepciones por Confirmar
                </h2>
              </div>
              <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-caption font-bold text-ok">
                {receipts.filter((r) => r.status === "por_confirmar").length} en muelle
              </span>
            </div>

            <div className="divide-y divide-ink-100">
              {receipts.map((rec) => {
                const isPending = rec.status === "por_confirmar";
                return (
                  <div key={rec.id} className="p-4 transition hover:bg-ink-50/70">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-caption font-bold text-ink-900">{rec.ocCode}</span>
                      <Badge tone={isPending ? "warn" : "ok"}>
                        {isPending ? "Por confirmar" : "Conforme"}
                      </Badge>
                    </div>

                    <h4 className="mt-1 text-body-sm font-bold text-ink-900">
                      Proveedor: {rec.supplier}
                    </h4>
                    <p className="text-caption text-ink-500">
                      Arribó: {rec.arrivedDate} · Bultos: <strong>{rec.packagesCount} cajas/cilindros</strong>
                    </p>

                    <div className="mt-2 rounded-lg bg-ink-50 p-2 text-body-sm text-ink-700">
                      <span className="font-semibold text-ink-900">Detalle de carga:</span> {rec.itemsSummary}
                    </div>

                    {isPending && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => handleConfirmReceipt(rec)}
                        >
                          <ClipboardCheck size={16} />
                          <span>Inspeccionar y recibir</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </div>

      {/* ─── MODAL DEL ESCÁNER QR/BARRAS ─── */}
      <QrScannerModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onDetect={handleQrDetect}
        title="Escanear Producto o Código de Bodega"
      />
    </div>
  );
}
