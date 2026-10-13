import { AlertTriangle, Lock, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

function StateShell({
  icon: Icon, tone, title, description, children, role,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  description?: string;
  children?: ReactNode;
  role?: "alert";
}) {
  return (
    <div role={role} className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-10 text-center">
      <span className={`grid size-14 place-items-center rounded-full ${tone}`}>
        <Icon size={26} aria-hidden="true" />
      </span>
      <h2 className="text-h3 font-bold">{title}</h2>
      {description && <p className="max-w-md text-body-sm text-ink-500">{description}</p>}
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

interface BaseProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** Sin datos (listas vacías, búsquedas sin resultados). */
export function EmptyState({ title = "Aún no hay datos", description, action, icon }: BaseProps & { icon?: LucideIcon }) {
  return (
    <StateShell icon={icon ?? SearchX} tone="bg-ink-100 text-ink-700" title={title} description={description}>
      {action}
    </StateShell>
  );
}

/** Falló una carga. Ofrece reintentar. */
export function ErrorState({
  title = "No pudimos cargar la información",
  description = "Revisa tu conexión e inténtalo nuevamente.",
  onRetry,
}: BaseProps & { onRetry?: () => void }) {
  return (
    <StateShell role="alert" icon={AlertTriangle} tone="bg-danger-soft text-danger" title={title} description={description}>
      {onRetry && <Button onClick={onRetry}>Reintentar</Button>}
    </StateShell>
  );
}

/** El rol actual no tiene permiso. */
export function ForbiddenState({
  title = "No tienes permiso para ver esta sección",
  description = "Tu rol no incluye acceso a esta pantalla. Si crees que es un error, contacta a un administrador.",
  action,
}: BaseProps) {
  return (
    <StateShell icon={Lock} tone="bg-warn-soft text-warn" title={title} description={description}>
      {action}
    </StateShell>
  );
}
