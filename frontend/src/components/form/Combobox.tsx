import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";
import { cn, normalize } from "@/lib/utils";
import { FormField, fieldAria, useFieldIds, type FieldProps } from "./FormField";

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps extends FieldProps {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

/** Select con búsqueda. Patrón ARIA combobox + listbox, navegable con teclado. */
export function Combobox({
  options, value, onChange, placeholder = "Buscar y seleccionar…", emptyText = "Sin resultados", disabled, ...field
}: ComboboxProps) {
  const ids = useFieldIds();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  useDismiss(wrapRef, open, () => setOpen(false));

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(`${o.label} ${o.description ?? ""}`).includes(q)) : options;
  }, [options, query]);

  const listId = `${ids.id}-list`;
  const optId = (i: number) => `${ids.id}-opt-${i}`;

  const choose = (o: ComboOption) => {
    onChange(o.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    }
  };

  return (
    <FormField ids={ids} {...field}>
      <div ref={wrapRef} className="relative">
        <input
          {...fieldAria(ids, field)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? optId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={selected ? undefined : placeholder}
          className="field pr-20"
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="absolute inset-y-0 right-1 flex items-center">
          {selected && !disabled && (
            <button
              type="button"
              aria-label="Quitar selección"
              onClick={() => onChange(null)}
              className="grid size-9 place-items-center rounded-lg text-ink-700 hover:bg-ink-100 pointer-coarse:size-11"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <ChevronsUpDown size={16} aria-hidden="true" className="mx-2 text-ink-500" />
        </span>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={field.label}
            className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white p-1 shadow-xl"
          >
            {filtered.length === 0 && <li className="px-3 py-3 text-body-sm text-ink-500">{emptyText}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={optId(i)}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2",
                  i === active && "bg-brand-50",
                )}
              >
                <span>
                  <span className="block text-body-sm font-medium">{o.label}</span>
                  {o.description && <span className="block text-caption text-ink-500">{o.description}</span>}
                </span>
                {o.value === value && <Check size={16} className="text-brand-600" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormField>
  );
}
