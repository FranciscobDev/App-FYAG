import { AlertCircle } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Oculta la etiqueta visualmente pero la mantiene para lectores de pantalla. */
  hideLabel?: boolean;
}

export interface FieldIds {
  id: string;
  hintId: string;
  errorId: string;
}

export function useFieldIds(): FieldIds {
  const id = useId();
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

/** Atributos ARIA estándar para el control de un campo. */
export function fieldAria(ids: FieldIds, { hint, error, required }: Pick<FieldProps, "hint" | "error" | "required">) {
  return {
    id: ids.id,
    required,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? ids.errorId : hint ? ids.hintId : undefined,
  };
}

/** Envoltorio de campo: etiqueta SIEMPRE asociada, ayuda y error enlazados. */
export function FormField({
  ids,
  label,
  hint,
  error,
  required,
  hideLabel,
  children,
}: FieldProps & { ids: FieldIds; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={ids.id}
        className={cn("text-label font-semibold text-ink-900 pointer-coarse:text-body-sm", hideLabel && "sr-only")}
      >
        {label}
        {required && (
          <>
            <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={ids.hintId} className="text-caption text-ink-500">{hint}</p>
      )}
      {error && (
        <p id={ids.errorId} role="alert" className="flex items-center gap-1 text-caption font-medium text-danger">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
