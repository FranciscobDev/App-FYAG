import { AlertTriangle, ArrowLeftRight, FolderKanban, Package } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/form/Select";
import { useToast } from "@/components/overlay/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DiffViewer } from "@/components/shared/DiffViewer";
import { EstadoBadge, SemaforoBadge, type Semaforo } from "@/components/shared/EstadoBadge";
import { ExportButton } from "@/components/shared/ExportButton";
import { FilterBar } from "@/components/shared/FilterBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { NotificationBell, type AppNotification } from "@/components/shared/NotificationBell";
import { OfflineBanner, SyncStatusChip } from "@/components/shared/OfflineBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { QrScannerModal } from "@/components/shared/QrScannerModal";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/States";
import { StockCell } from "@/components/shared/StockCell";
import { formatCLP } from "@/core/format";
import { PRODUCTS } from "@/data/mock";
import type { Product } from "@/core/types";
import { Section } from "./FoundationsTab";

interface Row extends Product {
  committed: number;
  quarantine: number;
  level: Semaforo;
}

const ROWS: Row[] = PRODUCTS.map((p) => ({
  ...p,
  committed: Math.round(p.stock * 0.2),
  quarantine: p.sku.length % 4,
  level: p.stock === 0 ? "rojo" : p.stock < p.minStock ? "amarillo" : "verde",
}));

const COLUMNS: Column<Row>[] = [
  { key: "sku", header: "SKU", sortable: true, render: (r) => <span className="font-mono text-caption">{r.sku}</span> },
  { key: "name", header: "Producto", sortable: true, cardPrimary: true },
  { key: "category", header: "Categoría", sortable: true },
  { key: "stock", header: "Stock", render: (r) => <StockCell available={r.stock} committed={r.committed} quarantine={r.quarantine} />, value: (r) => r.stock, sortable: true },
  { key: "cost", header: "Costo unit.", align: "right", sortable: true, value: (r) => r.unitCost, render: (r) => formatCLP(r.unitCost) },
  { key: "level", header: "Nivel", render: (r) => <SemaforoBadge nivel={r.level} />, value: (r) => r.level },
];

const NOTIFS: AppNotification[] = [
  { id: "1", title: "Solicitud SOL-2026-0412 pendiente", description: "Matías Fuentes pide 6 disyuntores.", time: "hace 5 min", read: false },
  { id: "2", title: "Gas R410A bajo el mínimo", description: "Quedan 6 de 8 cilindros.", time: "hace 1 h", read: false },
  { id: "3", title: "Informe OB-2026-014 aprobado", time: "ayer", read: true },
];

export function DataTab() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [qr, setQr] = useState(false);
  const [notifs, setNotifs] = useState(NOTIFS);

  const rows = ROWS.filter((r) => !category || r.category === category);

  return (
    <>
      <Section title="PageHeader con migas de pan + NotificationBell + QR">
        <Card className="p-5">
          <PageHeader
            title="Inventario"
            subtitle="Productos, stock y ubicaciones"
            breadcrumbs={[{ label: "Inicio", to: "/" }, { label: "Bodega", to: "/" }, { label: "Inventario" }]}
            actions={
              <>
                <NotificationBell
                  notifications={notifs}
                  onMarkAllRead={() => setNotifs((l) => l.map((n) => ({ ...n, read: true })))}
                />
                <Button variant="secondary" onClick={() => setQr(true)}>Escanear</Button>
              </>
            }
          />
          <QrScannerModal
            open={qr}
            onClose={() => setQr(false)}
            onDetect={(code) => toast({ tone: "ok", title: "Código leído", description: code })}
          />
        </Card>
      </Section>

      <Section title="KpiCard · ProgressBar · Semáforo · Sincronización">
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Proyectos activos" value={2} icon={FolderKanban} trend={{ value: 12.5, label: "vs. mes anterior" }} />
          <KpiCard label="Productos" value={6} icon={Package} hint="en 5 categorías" />
          <KpiCard label="Alertas de stock" value={3} icon={AlertTriangle} trend={{ value: 50, label: "vs. mes anterior", goodWhen: "down" }} />
          <KpiCard label="Movimientos hoy" value={48} icon={ArrowLeftRight} trend={{ value: -8, label: "vs. ayer" }} />
        </div>
        <Card className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-4">
            <ProgressBar label="Avance OB-2026-014" value={62} />
            <ProgressBar label="Presupuesto utilizado" value={88} tone="warn" />
            <ProgressBar label="Meta de inventario" value={100} tone="ok" size="sm" />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2"><SemaforoBadge nivel="verde" /><SemaforoBadge nivel="amarillo" /><SemaforoBadge nivel="rojo" /></div>
            <div className="flex flex-wrap gap-2"><SyncStatusChip status="pendiente" /><SyncStatusChip status="sincronizado" /></div>
            <div className="flex flex-wrap gap-2">
              <EstadoBadge estado="pendiente" /><EstadoBadge estado="aprobada" /><EstadoBadge estado="en_transito" /><EstadoBadge estado="anulada" />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="FilterBar + DataTable + ExportButton (tarjetas en celular)">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar producto o SKU…"
          activeCount={category ? 1 : 0}
          onClear={() => { setSearch(""); setCategory(""); }}
          actions={<ExportButton onExport={async (f) => { await new Promise((r) => setTimeout(r, 1200)); toast({ tone: "ok", title: `Exportado a ${f === "pdf" ? "PDF" : "Excel"}` }); }} />}
        >
          <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {[...new Set(PRODUCTS.map((p) => p.category))].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </FilterBar>
        <DataTable
          caption="Inventario de productos"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.sku}
          search={search}
          pageSize={4}
          highlightRow={(r) => r.level === "rojo"}
          onRowClick={(r) => toast({ tone: "info", title: r.name, description: `Ubicación ${r.location}` })}
        />
      </Section>

      <Section title="StockCell · DiffViewer">
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-5"><StockCell variant="full" available={120} committed={30} quarantine={5} unit="un" /></Card>
          <DiffViewer
            rows={[
              { field: "Stock mínimo", before: 30, after: 40 },
              { field: "Ubicación", before: "A-02-01", after: "A-02-04" },
              { field: "Categoría", before: "Eléctrico", after: "Eléctrico" },
            ]}
          />
        </div>
      </Section>

      <Section title="OfflineBanner · estados vacío, error y sin permiso">
        <div className="space-y-4">
          <OfflineBanner offline pendingCount={3} />
          <div className="grid gap-4 lg:grid-cols-3">
            <EmptyState title="Sin movimientos" description="Cuando registres entradas o salidas aparecerán aquí." />
            <ErrorState onRetry={() => toast({ tone: "info", title: "Reintentando…" })} />
            <ForbiddenState />
          </div>
        </div>
      </Section>
    </>
  );
}
