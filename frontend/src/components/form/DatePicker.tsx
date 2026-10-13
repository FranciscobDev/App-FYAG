import { CalendarDays } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useDismiss } from "@/hooks/useDismiss";
import { formatISO } from "@/lib/utils";
import { Calendar, type DateRange } from "./Calendar";
import { FormField, fieldAria, useFieldIds, type FieldProps } from "./FormField";

interface ShellProps extends FieldProps {
  display: string;
  placeholder: string;
  hasValue: boolean;
  onClear: () => void;
  disabled?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
}

function PickerShell({ display, placeholder, hasValue, onClear, disabled, open, setOpen, children, ...field }: ShellProps) {
  const ids = useFieldIds();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <FormField ids={ids} {...field}>
      <div ref={ref} className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="field flex items-center justify-between gap-2 text-left"
          {...fieldAria(ids, field)}
        >
          <span className={hasValue ? "tabular-nums" : "text-ink-500"}>{hasValue ? display : placeholder}</span>
          <CalendarDays size={18} className="shrink-0 text-ink-700" aria-hidden="true" />
        </button>
        {open && (
          <div role="dialog" aria-label={field.label} className="absolute z-30 mt-1 w-[19.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
            {children}
            <div className="mt-2 flex justify-between border-t border-ink-100 pt-2">
              <Button variant="ghost" onClick={() => { onClear(); setOpen(false); }}>Limpiar</Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </div>
    </FormField>
  );
}

/* ───────────── DatePicker ───────────── */
interface DatePickerProps extends FieldProps {
  value: string | null; // YYYY-MM-DD
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, min, max, placeholder = "dd-mm-aaaa", disabled, ...field }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <PickerShell
      {...field}
      open={open}
      setOpen={setOpen}
      disabled={disabled}
      display={value ? formatISO(value) : ""}
      placeholder={placeholder}
      hasValue={!!value}
      onClear={() => onChange(null)}
    >
      <Calendar selected={value} min={min} max={max} onSelect={(iso) => { onChange(iso); setOpen(false); }} />
    </PickerShell>
  );
}

/* ───────────── DateRangePicker ───────────── */
interface DateRangePickerProps extends FieldProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

export function DateRangePicker({ value, onChange, min, max, disabled, ...field }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // 1er clic = desde · 2º clic = hasta (si es anterior, se invierte)
  const pick = (iso: string) => {
    if (!value.from || (value.from && value.to)) return onChange({ from: iso, to: null });
    const [from, to] = iso < value.from ? [iso, value.from] : [value.from, iso];
    onChange({ from, to });
    setOpen(false);
  };

  const display = value.from ? `${formatISO(value.from)} → ${value.to ? formatISO(value.to) : "…"}` : "";
  return (
    <PickerShell
      {...field}
      open={open}
      setOpen={setOpen}
      disabled={disabled}
      display={display}
      placeholder="Desde → Hasta"
      hasValue={!!value.from}
      onClear={() => onChange({ from: null, to: null })}
    >
      <p className="mb-1 text-caption text-ink-500" aria-live="polite">
        {!value.from || value.to ? "Elige la fecha inicial" : "Ahora elige la fecha final"}
      </p>
      <Calendar range={value} min={min} max={max} onSelect={pick} />
    </PickerShell>
  );
}
