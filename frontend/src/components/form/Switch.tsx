import { useId } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Interruptor. El estado se comunica con texto ("Activado"/"Desactivado"), no solo con color. */
export function Switch({ label, description, checked, onCheckedChange, disabled }: SwitchProps) {
  const labelId = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1">
      <div>
        <p id={labelId} className="text-body-sm font-medium text-ink-900 pointer-coarse:text-body">{label}</p>
        {description && <p className="text-caption text-ink-500">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 text-right text-caption font-semibold text-ink-700" aria-hidden="true">
          {checked ? "Activado" : "Desactivado"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            checked ? "bg-brand-600" : "bg-ink-500",
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform",
              checked && "translate-x-5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
