import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  Package,
  RotateCcw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/overlay/Toast";
import { formatCLP, formatNumber } from "@/core/format";
import type { CardexEntry, Product, Project } from "@/core/types";
import { CARDEX_ENTRIES, PROJECTS } from "@/data/mock";

interface CardexTabProps {
  products: Product[];
  entries?: CardexEntry[];
}

export function CardexTab({ products, entries = CARDEX_ENTRIES }: CardexTabProps) {
  const toast = useToast();

  const [selectedSku, setSelectedSku] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchSku = selectedSku === "all" || e.sku === selectedSku;
      const matchType = selectedType === "all" || e.type === selectedType;
      const matchProj = selectedProject === "all" || e.projectCode === selectedProject;

      // Filtro de fechas si están definidas
      let matchDate = true;
      if (startDate || endDate) {
        // e.date formato DD-MM-YYYY HH:mm
        const parts = e.date.split(" ")[0].split("-");
        if (parts.length === 3) {
          const entryIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (startDate && entryIso < startDate) matchDate = false;
          if (endDate && entryIso > endDate) matchDate = false;
        }
      }

      return matchSku && matchType && matchProj && matchDate;
    });
  }, [entries, selectedSku, selectedType, selectedProject, startDate, endDate]);

  const handleExportExcel = () => {
    const headers = [
      "Fecha",
      "SKU",
      "Insumo",
      "Tipo Movimiento",
      "Referencia",
      "Proyecto",
      "Entrada",
      "Salida",
      "Saldo",
      "PMP (CLP)",
      "Total Valorizado (CLP)",
    ];

    const rows = filteredEntries.map((e) => [
      `"${e.date}"`,
      `"${e.sku}"`,
      `"${e.productName}"`,
      `"${e.typeLabel}"`,
      `"${e.reference}"`,
      `"${e.projectName || 'Bodega Central'}"`,
      e.qtyIn,
      e.qtyOut,
      e.balance,
      e.pmp,
      e.totalValue,
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Cardex_Inventario_FYAG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      tone: "ok",
      title: "Cardex exportado con éxito",
      description: `Se descargó el archivo con ${filteredEntries.length} movimientos en formato CSV para Excel.`,
    });
  };

  return (
    <div className="space-y-5">
      {/* ─── FILTROS DEL CARDEX (SOLO LECTURA) ─── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-brand-600" />
            <h3 className="text-body-sm font-bold text-ink-900">
              Filtros de Trazabilidad Cardex
            </h3>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-caption font-semibold text-ink-600">
              Solo lectura · {filteredEntries.length} registros
            </span>
          </div>

          <Button variant="secondary" onClick={handleExportExcel} className="flex items-center gap-2">
            <FileSpreadsheet size={16} />
            <span>Exportar a Excel</span>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Insumo */}
          <div>
            <label className="mb-1 block text-caption font-semibold text-ink-700">
              Insumo:
            </label>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white p-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            >
              <option value="all">Todos los insumos</option>
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de movimiento */}
          <div>
            <label className="mb-1 block text-caption font-semibold text-ink-700">
              Tipo de movimiento:
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white p-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="entrada_compra">Entrada por compra</option>
              <option value="salida_obra">Salida a obra / mantención</option>
              <option value="devolucion">Devolución de obra</option>
              <option value="merma">Merma o baja</option>
              <option value="ajuste_conteo">Ajuste por conteo físico</option>
            </select>
          </div>

          {/* Proyecto */}
          <div>
            <label className="mb-1 block text-caption font-semibold text-ink-700">
              Proyecto / Obra:
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white p-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            >
              <option value="all">Todos los proyectos</option>
              {PROJECTS.map((prj) => (
                <option key={prj.code} value={prj.code}>
                  {prj.code} · {prj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rango fecha desde */}
          <div>
            <label className="mb-1 block text-caption font-semibold text-ink-700">
              Desde:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white p-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>

          {/* Rango fecha hasta */}
          <div>
            <label className="mb-1 block text-caption font-semibold text-ink-700">
              Hasta:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white p-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* ─── TABLA DE CARDEX ─── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-ink-100/70 text-caption font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Tipo de Movimiento</th>
                <th className="px-4 py-3">Referencia / Doc.</th>
                <th className="px-4 py-3">Proyecto / Obra</th>
                <th className="px-4 py-3 text-right">Entrada</th>
                <th className="px-4 py-3 text-right">Salida</th>
                <th className="px-4 py-3 text-right">Saldo Posterior</th>
                <th className="px-4 py-3 text-right">PMP Posterior</th>
                <th className="px-4 py-3 text-right">Total Valorizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-mono text-body-sm">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="font-sans p-8 text-center text-body-sm text-ink-500">
                    No hay movimientos en el Cardex para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const isEntry = e.qtyIn > 0;
                  const isExit = e.qtyOut > 0;
                  return (
                    <tr key={e.id} className="transition hover:bg-ink-50/70">
                      <td className="px-4 py-3 text-caption text-ink-600">{e.date}</td>
                      <td className="px-4 py-3 font-sans">
                        <span className="font-mono text-caption font-bold text-ink-900">{e.sku}</span>
                        <p className="text-caption text-ink-500">{e.productName}</p>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <Badge
                          tone={
                            e.type === "entrada_compra" || e.type === "devolucion"
                              ? "ok"
                              : e.type === "merma"
                                ? "danger"
                                : "info"
                          }
                        >
                          {e.typeLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-caption font-bold text-ink-800">{e.reference}</td>
                      <td className="px-4 py-3 font-sans text-caption text-ink-700">
                        {e.projectName ? (
                          <>
                            <strong>{e.projectCode}</strong>
                            <p className="text-ink-500">{e.projectName}</p>
                          </>
                        ) : (
                          <span className="italic text-ink-400">Bodega Central</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ok">
                        {isEntry ? `+${formatNumber(e.qtyIn)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-danger">
                        {isExit ? `-${formatNumber(e.qtyOut)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink-900">
                        {formatNumber(e.balance)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink-700">
                        {formatCLP(e.pmp)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink-900">
                        {formatCLP(e.totalValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
