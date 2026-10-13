import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Variación respecto al período anterior, en %. */
  trend?: { value: number; label?: string; goodWhen?: "up" | "down" };
}

export function KpiCard({ label, value, icon: Icon, hint, trend }: KpiCardProps) {
  const up = (trend?.value ?? 0) >= 0;
  const good = trend ? (trend.goodWhen ?? "up") === (up ? "up" : "down") : true;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm text-ink-500">{label}</p>
          <p className="mt-1 truncate text-h1 font-bold tabular-nums">{value}</p>
        </div>
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={22} aria-hidden="true" />
          </span>
        )}
      </div>
      {(trend || hint) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-caption">
          {trend && (
            <span className={cn("inline-flex items-center gap-1 font-semibold", good ? "text-ok" : "text-danger")}>
              <TrendIcon size={14} aria-hidden="true" />
              {up ? "+" : ""}{trend.value.toLocaleString("es-CL")} %
              <span className="sr-only">{good ? " (favorable)" : " (desfavorable)"}</span>
            </span>
          )}
          <span className="text-ink-500">{trend?.label ?? hint}</span>
        </p>
      )}
    </Card>
  );
}
