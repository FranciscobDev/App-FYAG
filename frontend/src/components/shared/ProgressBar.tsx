import { cn } from "@/lib/utils";

type BarTone = "brand" | "ok" | "warn" | "danger";

const FILL: Record<BarTone, string> = {
  brand: "bg-brand-600",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

interface ProgressBarProps {
  label: string;
  value: number; // 0–100
  tone?: BarTone;
  showValue?: boolean;
  size?: "sm" | "md";
}

export function ProgressBar({ label, value, tone = "brand", showValue = true, size = "md" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-caption">
        <span className="font-medium text-ink-700">{label}</span>
        {showValue && <span className="font-semibold tabular-nums text-ink-900">{pct.toLocaleString("es-CL")} %</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn("overflow-hidden rounded-full bg-ink-200", size === "sm" ? "h-1.5" : "h-2.5")}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
