import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismiss } from "@/hooks/useDismiss";

export type ExportFormat = "pdf" | "excel";

interface ExportButtonProps {
  /** Puede devolver una promesa: el botón muestra "cargando" mientras se genera. */
  onExport: (format: ExportFormat) => void | Promise<void>;
  label?: string;
  disabled?: boolean;
}

const OPTIONS = [
  { format: "pdf" as const, label: "PDF", hint: "Documento para imprimir", icon: FileText },
  { format: "excel" as const, label: "Excel", hint: "Planilla .xlsx editable", icon: FileSpreadsheet },
];

export function ExportButton({ onExport, label = "Exportar", disabled }: ExportButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useDismiss(ref, open, () => setOpen(false));

  const run = async (f: ExportFormat) => {
    setOpen(false);
    setBusy(true);
    try {
      await onExport(f);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        icon={<Download size={16} />}
        loading={busy}
        loadingText="Generando…"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label} <ChevronDown size={14} aria-hidden="true" />
      </Button>
      {open && (
        <ul role="menu" aria-label="Formato de exportación" className="absolute right-0 z-30 mt-1 w-60 rounded-xl border border-ink-200 bg-white p-1 shadow-xl">
          {OPTIONS.map(({ format, label: l, hint, icon: Icon }) => (
            <li key={format} role="none">
              <button
                role="menuitem"
                type="button"
                onClick={() => run(format)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-ink-100"
              >
                <Icon size={20} className="text-brand-600" aria-hidden="true" />
                <span>
                  <span className="block text-body-sm font-semibold">{l}</span>
                  <span className="block text-caption text-ink-500">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
