import { Star } from "lucide-react";
import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  label: string;
  value: number; // 0 = sin calificar
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

/** Calificación de 1 a 5. Teclado: flechas, Inicio y Fin. Cada estrella mide 44 px. */
export function StarRating({ label, value, onChange, readOnly }: StarRatingProps) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const text = value ? `${value} de 5` : "Sin calificar";

  const move = (e: React.KeyboardEvent, current: number) => {
    const map: Record<string, number> = {
      ArrowRight: Math.min(current + 1, 5), ArrowUp: Math.min(current + 1, 5),
      ArrowLeft: Math.max(current - 1, 1), ArrowDown: Math.max(current - 1, 1),
      Home: 1, End: 5,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onChange?.(map[e.key]);
    refs.current[map[e.key] - 1]?.focus();
  };

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1" role="img" aria-label={`${label}: ${text}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={18} aria-hidden="true" className={n <= value ? "fill-warn-line text-warn" : "text-ink-300"} />
        ))}
        <span className="ml-1 text-caption font-semibold text-ink-700">{text}</span>
      </span>
    );
  }

  return (
    <div>
      <p id={labelId} className="mb-1 text-label font-semibold pointer-coarse:text-body-sm">{label}</p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => { refs.current[n - 1] = el; }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => onChange?.(n)}
            onKeyDown={(e) => move(e, n)}
            className="grid size-11 place-items-center rounded-lg hover:bg-ink-100"
          >
            <Star size={28} aria-hidden="true" className={cn(n <= value ? "fill-warn-line text-warn" : "text-ink-500")} />
          </button>
        ))}
        <span className="ml-2 text-body-sm font-semibold text-ink-700" aria-live="polite">{text}</span>
      </div>
    </div>
  );
}
