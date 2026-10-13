import { cn } from "@/lib/utils";

interface StockCellProps {
  available: number;
  committed: number;
  quarantine: number;
  unit?: string;
  /** "full": tres columnas con etiqueta (detalle). "compact": una línea (tablas). */
  variant?: "full" | "compact";
}

const n = (v: number) => v.toLocaleString("es-CL");

/** Stock desglosado: disponible · comprometido · cuarentena. Cada valor lleva su etiqueta. */
export function StockCell({ available, committed, quarantine, unit, variant = "compact" }: StockCellProps) {
  const total = available + committed + quarantine;
  const parts = [
    { label: "Disponible", short: "Disp.", value: available, cls: available === 0 ? "text-danger" : "text-ok" },
    { label: "Comprometido", short: "Comp.", value: committed, cls: "text-warn" },
    { label: "Cuarentena", short: "Cuar.", value: quarantine, cls: quarantine > 0 ? "text-info" : "text-ink-500" },
  ];

  if (variant === "compact") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-body-sm tabular-nums">
        {parts.map((p) => (
          <span key={p.label} title={p.label}>
            <span className="text-caption text-ink-500">{p.short} </span>
            <span className={cn("font-semibold", p.cls)}>{n(p.value)}</span>
          </span>
        ))}
        <span className="sr-only">Total {n(total)} {unit}</span>
      </span>
    );
  }

  return (
    <div>
      <dl className="grid grid-cols-3 divide-x divide-ink-200 rounded-xl border border-ink-200 bg-white text-center">
        {parts.map((p) => (
          <div key={p.label} className="px-2 py-3">
            <dt className="text-caption text-ink-500">{p.label}</dt>
            <dd className={cn("text-h2 font-bold tabular-nums", p.cls)}>{n(p.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-right text-caption text-ink-500">Total físico: {n(total)} {unit}</p>
    </div>
  );
}
