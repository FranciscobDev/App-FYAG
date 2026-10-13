import { Eye, EyeOff, Search, X } from "lucide-react";
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FormField, fieldAria, useFieldIds, type FieldProps } from "./FormField";

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "required">;

/* ───────────── Input ───────────── */
export type InputProps = FieldProps & NativeInput & { leading?: ReactNode; trailing?: ReactNode };

export function Input({
  label, hint, error, required, hideLabel, leading, trailing, className, ...rest
}: InputProps) {
  const ids = useFieldIds();
  return (
    <FormField ids={ids} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel}>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-500">{leading}</span>
        )}
        <input
          className={cn("field", !!leading && "pl-10", !!trailing && "pr-12", className)}
          {...fieldAria(ids, { hint, error, required })}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
    </FormField>
  );
}

/* ───────────── NumberInput (hasta 3 decimales, coma chilena) ───────────── */
interface NumberInputProps extends FieldProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Máximo de decimales permitidos (por defecto 3). */
  decimals?: number;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

const toText = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const parseText = (t: string) => {
  const n = parseFloat(t.replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

export function NumberInput({
  value, onValueChange, decimals = 3, min, max, unit, ...field
}: NumberInputProps) {
  const [text, setText] = useState(toText(value));

  // Sincroniza cambios externos sin pisar lo que el usuario está tipeando ("1," == 1)
  useEffect(() => {
    if (parseText(text) !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const allowNegative = min === undefined || min < 0;
  const pattern = new RegExp(
    `^${allowNegative ? "-?" : ""}\\d*${decimals > 0 ? `(,\\d{0,${decimals}})?` : ""}$`,
  );

  return (
    <Input
      {...field}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      className={unit ? "pr-16 tabular-nums" : "tabular-nums"}
      trailing={unit ? <span className="pr-3 text-body-sm text-ink-500">{unit}</span> : undefined}
      onChange={(e) => {
        const t = e.target.value.replace(/\./g, ",");
        if (!pattern.test(t)) return;
        setText(t);
        onValueChange(parseText(t));
      }}
      onBlur={() => {
        let n = parseText(text);
        if (n !== null) {
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          onValueChange(n);
        }
        setText(toText(n));
      }}
    />
  );
}

/* ───────────── PasswordInput (mostrar/ocultar) ───────────── */
export function PasswordInput(props: Omit<InputProps, "type" | "trailing" | "leading">) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      autoComplete="current-password"
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="grid size-9 place-items-center rounded-lg text-ink-700 hover:bg-ink-100 pointer-coarse:size-11"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}

/* ───────────── SearchInput ───────────── */
interface SearchInputProps extends Omit<NativeInput, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
}

export function SearchInput({ value, onValueChange, label = "Buscar", placeholder = "Buscar…", ...rest }: SearchInputProps) {
  return (
    <Input
      {...rest}
      label={label}
      hideLabel
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      leading={<Search size={18} aria-hidden="true" />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label="Limpiar búsqueda"
            className="grid size-9 place-items-center rounded-lg text-ink-700 hover:bg-ink-100 pointer-coarse:size-11"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : undefined
      }
    />
  );
}
