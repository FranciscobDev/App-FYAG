import { FilterX } from "lucide-react";
import type { ReactNode } from "react";
import { SearchInput } from "@/components/form/Input";
import { Button } from "@/components/ui/Button";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Cantidad de filtros activos (habilita "Limpiar filtros"). */
  activeCount?: number;
  onClear?: () => void;
  /** Selects, rangos de fecha, etc. */
  children?: ReactNode;
  /** Acciones a la derecha (ej. ExportButton). */
  actions?: ReactNode;
}

export function FilterBar({ search, onSearchChange, searchPlaceholder, activeCount = 0, onClear, children, actions }: FilterBarProps) {
  return (
    <div role="search" className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-3 shadow-(--shadow-card) lg:flex-row lg:items-end">
      <div className="lg:w-72">
        <SearchInput value={search} onValueChange={onSearchChange} placeholder={searchPlaceholder} />
      </div>
      {children && <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end [&>*]:lg:min-w-44">{children}</div>}
      <div className="flex items-center gap-2 lg:ml-auto">
        {onClear && (
          <Button variant="ghost" icon={<FilterX size={16} />} onClick={onClear} disabled={activeCount === 0 && !search}>
            Limpiar{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
