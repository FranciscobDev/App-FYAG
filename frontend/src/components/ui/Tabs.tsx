import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

interface TabsProps {
  label: string;
  tabs: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
}

/** Pestañas accesibles: flechas, Inicio y Fin; panel enlazado por aria. */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const base = useId();
  const [internal, setInternal] = useState(tabs[0].id);
  const current = value ?? internal;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    setInternal(id);
    onChange?.(id);
  };

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[next].id);
    refs.current[next]?.focus();
  };

  const active = tabs.find((t) => t.id === current) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-ink-200">
        {tabs.map((t, i) => {
          const selected = t.id === active.id;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-body-sm font-semibold transition",
                selected ? "border-brand-600 text-brand-600" : "border-transparent text-ink-700 hover:text-ink-900",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-full px-2 py-0.5 text-caption", selected ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-700")}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-${active.id}`}
        aria-labelledby={`${base}-tab-${active.id}`}
        tabIndex={0}
        className="pt-5"
      >
        {active.content}
      </div>
    </div>
  );
}
