import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { TONE_CLASSES, type Tone } from "@/core/status";

type ToastTone = Extract<Tone, "ok" | "warn" | "danger" | "info">;

interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** ms; 0 = no se cierra solo. Por defecto 5 s (8 s en errores). */
  duration?: number;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ICONS = { ok: CheckCircle2, warn: AlertTriangle, danger: XCircle, info: Info } as const;
const Ctx = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((l) => [...l, { ...t, id }]);
      const ms = t.duration ?? (t.tone === "danger" ? 8000 : 5000);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-100 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end"
      >
        {items.map((t) => {
          const tone = t.tone ?? "info";
          const Icon = ICONS[tone];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-sm animate-pop items-start gap-3 rounded-xl border p-3 shadow-lg ${TONE_CLASSES[tone]}`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-bold">{t.title}</p>
                {t.description && <p className="text-body-sm">{t.description}</p>}
              </div>
              <IconButton label="Cerrar notificación" onClick={() => dismiss(t.id)} className="-m-1 text-current hover:bg-black/5">
                <X size={18} />
              </IconButton>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx.toast;
}
