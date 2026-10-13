import { CheckCheck, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Banner persistente cuando no hay conexión. `offline` fuerza el estado (demo/pruebas). */
export function OfflineBanner({ offline, pendingCount = 0 }: { offline?: boolean; pendingCount?: number }) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  if (!isOffline) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-warn-line bg-warn-soft p-3 text-warn">
      <CloudOff size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="text-body-sm">
        <p className="font-bold">Sin conexión</p>
        <p>
          Puedes seguir trabajando. Tus cambios se guardan en este equipo y se enviarán al recuperar la señal
          {pendingCount > 0 && ` (${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"})`}.
        </p>
      </div>
    </div>
  );
}

/** Estado de sincronización de un registro creado offline. */
export function SyncStatusChip({ status }: { status: "pendiente" | "sincronizado" }) {
  return status === "pendiente" ? (
    <Badge tone="warn" icon={RefreshCw}>Pendiente</Badge>
  ) : (
    <Badge tone="ok" icon={CheckCheck}>Sincronizado</Badge>
  );
}
