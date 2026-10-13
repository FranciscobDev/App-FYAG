import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn, normalize } from "@/lib/utils";
import { EmptyState } from "./States";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  /** Valor plano para ordenar y buscar. Por defecto row[key]. */
  value?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  /** En tarjeta (celular): título de la tarjeta. Por defecto, la primera columna. */
  cardPrimary?: boolean;
  /** En tarjeta (celular): ocultar esta columna. */
  cardHidden?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  /** Texto de búsqueda (lo controla un FilterBar externo). */
  search?: string;
  pageSize?: number;
  /** Fila resaltada (ej. stock crítico, solicitud nueva). */
  highlightRow?: (row: T) => boolean;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  columns, rows, rowKey, caption, search = "", pageSize = 8, highlightRow, onRowClick, loading, emptyState, initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const val = (c: Column<T>, row: T): string | number => {
    if (c.value) return c.value(row);
    const v = (row as unknown as Record<string, unknown>)[c.key];
    return typeof v === "number" ? v : String(v ?? "");
  };

  const processed = useMemo(() => {
    const q = normalize(search.trim());
    let out = q ? rows.filter((r) => normalize(columns.map((c) => val(c, r)).join(" ")).includes(q)) : rows;
    const col = columns.find((c) => c.key === sort?.key);
    if (col && sort) {
      out = [...out].sort((a, b) => {
        const [x, y] = [val(col, a), val(col, b)];
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es-CL", { numeric: true, sensitivity: "base" });
        return sort.dir === "asc" ? r : -r;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sort, columns]);

  const pages = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const visible = processed.slice(start, start + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const primary = columns.find((c) => c.cardPrimary) ?? columns[0];
  const cell = (c: Column<T>, row: T) => (c.render ? c.render(row) : val(c, row));

  const rowProps = (row: T) => ({
    tabIndex: onRowClick ? 0 : undefined,
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    onKeyDown: onRowClick ? (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined,
  });

  if (loading) {
    return (
      <div role="status" className="space-y-2 rounded-2xl border border-ink-200 bg-white p-4">
        <span className="sr-only">Cargando datos…</span>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (processed.length === 0) {
    return <>{emptyState ?? <EmptyState title="Sin resultados" description="Prueba con otros filtros o términos de búsqueda." />}</>;
  }

  return (
    <div>
      {/* Escritorio / tablet: tabla */}
      <div className="hidden overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-(--shadow-card) md:block">
        <table className="w-full text-body-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-ink-100 text-left text-caption uppercase tracking-wide text-ink-700">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={c.sortable ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                    className={cn("px-4 py-2 font-semibold", c.align === "right" && "text-right")}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn("inline-flex min-h-9 items-center gap-1 uppercase tracking-wide hover:text-ink-900 pointer-coarse:min-h-11", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.header}
                        {active ? (sort!.dir === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="text-ink-500" />}
                        <span className="sr-only">, ordenar</span>
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const hl = highlightRow?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  {...rowProps(row)}
                  className={cn(
                    "border-t border-ink-100",
                    hl ? "bg-brand-50 shadow-[inset_4px_0_0_var(--color-brand-600)]" : "hover:bg-ink-100/60",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tabular-nums")}>
                      {i === 0 && hl && <span className="sr-only">Fila destacada: </span>}
                      {cell(c, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {visible.map((row) => {
          const hl = highlightRow?.(row);
          return (
            <li
              key={rowKey(row)}
              {...rowProps(row)}
              className={cn(
                "rounded-2xl border bg-white p-4 shadow-(--shadow-card)",
                hl ? "border-brand-600 bg-brand-50" : "border-ink-200",
                onRowClick && "cursor-pointer active:bg-ink-100",
              )}
            >
              <p className="mb-2 font-semibold text-ink-900">
                {hl && <span className="sr-only">Destacada: </span>}
                {cell(primary, row)}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                {columns.filter((c) => c !== primary && !c.cardHidden).map((c) => (
                  <div key={c.key}>
                    <dt className="text-caption text-ink-500">{c.header}</dt>
                    <dd className="text-body-sm text-ink-900">{cell(c, row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      {/* Paginación */}
      <nav aria-label="Paginación" className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-500" aria-live="polite">
          Mostrando {start + 1}–{Math.min(start + pageSize, processed.length)} de {processed.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<ChevronLeft size={16} />} disabled={current === 1} onClick={() => setPage(current - 1)}>
            Anterior
          </Button>
          <span className="px-2 text-body-sm font-medium">Página {current} de {pages}</span>
          <Button variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>
            Siguiente <ChevronRight size={16} />
          </Button>
        </div>
      </nav>
    </div>
  );
}
