import { cn } from "@/lib/utils";

export interface DiffRow {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

const show = (v: DiffRow["before"]) => (v === null || v === "" ? "—" : String(v));

/** Comparación valor anterior → valor nuevo (ediciones de bodega, solicitudes de cambio). */
export function DiffViewer({ rows, caption = "Cambios solicitados" }: { rows: DiffRow[]; caption?: string }) {
  const changed = rows.filter((r) => r.before !== r.after).length;
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <p className="border-b border-ink-200 bg-ink-100 px-4 py-2 text-caption font-semibold text-ink-700" aria-live="polite">
        {caption}: {changed} {changed === 1 ? "campo modificado" : "campos modificados"}
      </p>
      <table className="w-full text-body-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sr-only md:not-sr-only">
          <tr className="text-left text-caption uppercase tracking-wide text-ink-500">
            <th scope="col" className="px-4 py-2 font-semibold">Campo</th>
            <th scope="col" className="px-4 py-2 font-semibold">Valor anterior</th>
            <th scope="col" className="px-4 py-2 font-semibold">Valor nuevo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.before !== r.after;
            return (
              <tr key={r.field} className="block border-t border-ink-100 md:table-row">
                <th scope="row" className="block px-4 pt-3 text-left font-semibold md:table-cell md:py-3">{r.field}</th>
                <td className="block px-4 py-1 md:table-cell md:py-3">
                  <span className="text-caption text-ink-500 md:hidden">Antes: </span>
                  {diff ? (
                    <del className="rounded bg-danger-soft px-1.5 py-0.5 font-medium text-danger">{show(r.before)}</del>
                  ) : (
                    <span className="text-ink-700">{show(r.before)}</span>
                  )}
                </td>
                <td className="block px-4 pb-3 pt-1 md:table-cell md:py-3">
                  <span className="text-caption text-ink-500 md:hidden">Después: </span>
                  {diff ? (
                    <ins className={cn("rounded bg-ok-soft px-1.5 py-0.5 font-medium text-ok no-underline")}>{show(r.after)}</ins>
                  ) : (
                    <span className="text-ink-500">Sin cambios</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
