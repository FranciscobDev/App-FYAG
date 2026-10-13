import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange">;

/* ───────────── Checkbox ───────────── */
interface CheckboxProps extends NativeInput {
  label: ReactNode;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Checkbox({ label, description, checked, onCheckedChange, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", rest.disabled && "cursor-not-allowed opacity-60", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-brand-600"
        {...rest}
      />
      <span>
        <span className="block text-body-sm font-medium text-ink-900 pointer-coarse:text-body">{label}</span>
        {description && <span className="block text-caption text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

/* ───────────── Radio / RadioGroup ───────────── */
export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  legend: string;
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  error?: string;
  required?: boolean;
}

export function RadioGroup({ legend, options, value, onChange, orientation = "vertical", error, required }: RadioGroupProps) {
  const name = useId();
  return (
    <fieldset aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-err` : undefined}>
      <legend className="mb-1 text-label font-semibold text-ink-900 pointer-coarse:text-body-sm">
        {legend}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </legend>
      <div className={cn("flex gap-x-6", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap")}>
        {options.map((o) => (
          <label key={o.value} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", o.disabled && "cursor-not-allowed opacity-60")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-0.5 size-5 shrink-0 accent-brand-600"
            />
            <span>
              <span className="block text-body-sm font-medium text-ink-900 pointer-coarse:text-body">{o.label}</span>
              {o.description && <span className="block text-caption text-ink-500">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p id={`${name}-err`} role="alert" className="text-caption font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
