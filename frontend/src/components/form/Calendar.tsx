import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { cn, parseISO, toISO } from "@/lib/utils";

export interface DateRange {
  from: string | null;
  to: string | null;
}

interface CalendarProps {
  selected?: string | null;
  range?: DateRange;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
}

const WEEKDAYS = [
  ["L", "lunes"], ["M", "martes"], ["M", "miércoles"], ["J", "jueves"], ["V", "viernes"], ["S", "sábado"], ["D", "domingo"],
] as const;
const monthFmt = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const longFmt = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Calendario mensual en español, semana desde lunes. Soporta selección simple y rango. */
export function Calendar({ selected, range, onSelect, min, max }: CalendarProps) {
  const anchor = selected ?? range?.from ?? toISO(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = parseISO(anchor);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const offset = (cursor.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const today = toISO(new Date());
  const title = monthFmt.format(cursor);

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="w-full select-none">
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Mes anterior" onClick={() => shift(-1)}><ChevronLeft size={20} /></IconButton>
        <p className="font-semibold capitalize" aria-live="polite">{title}</p>
        <IconButton label="Mes siguiente" onClick={() => shift(1)}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="grid grid-cols-7 text-center" role="grid" aria-label={title}>
        {WEEKDAYS.map(([short, full], i) => (
          <abbr key={i} title={full} className="py-1 text-caption font-semibold text-ink-500 no-underline">{short}</abbr>
        ))}
        {Array.from({ length: offset }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
          const iso = toISO(date);
          const disabled = (!!min && iso < min) || (!!max && iso > max);
          const isEdge = iso === selected || iso === range?.from || iso === range?.to;
          const inRange = !!range?.from && !!range.to && iso > range.from && iso < range.to;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-label={longFmt.format(date)}
              aria-pressed={isEdge}
              aria-current={iso === today ? "date" : undefined}
              onClick={() => onSelect(iso)}
              className={cn(
                "h-10 text-body-sm font-medium tabular-nums transition pointer-coarse:h-11",
                isEdge ? "rounded-lg bg-brand-600 text-white" : inRange ? "bg-brand-100 text-brand-900" : "rounded-lg text-ink-900 hover:bg-ink-100",
                iso === today && !isEdge && "ring-2 ring-inset ring-brand-600",
                disabled && "cursor-not-allowed text-ink-300 hover:bg-transparent",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
