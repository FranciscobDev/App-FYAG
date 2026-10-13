import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { FormField, fieldAria, useFieldIds, type FieldProps } from "./FormField";

/* ───────────── Select (nativo: mejor UX en celular/tablet) ───────────── */
export function Select({
  label, hint, error, required, hideLabel, className, children, ...rest
}: FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required">) {
  const ids = useFieldIds();
  return (
    <FormField ids={ids} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <div className="relative">
        <select className={cn("field appearance-none pr-10", className)} {...fieldAria(ids, { hint, error, required })} {...rest}>
          {children}
        </select>
        <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-700" />
      </div>
    </FormField>
  );
}

/* ───────────── Textarea (contador opcional) ───────────── */
export function Textarea({
  label, hint, error, required, hideLabel, className, ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required">) {
  const ids = useFieldIds();
  const length = typeof rest.value === "string" ? rest.value.length : undefined;
  return (
    <FormField ids={ids} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <textarea rows={4} className={cn("field resize-y", className)} {...fieldAria(ids, { hint, error, required })} {...rest} />
      {rest.maxLength && length !== undefined && (
        <p className="text-right text-caption text-ink-500" aria-live="polite">
          {length} / {rest.maxLength}
        </p>
      )}
    </FormField>
  );
}
