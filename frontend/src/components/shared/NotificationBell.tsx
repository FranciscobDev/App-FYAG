import { Bell, CheckCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismiss } from "@/hooks/useDismiss";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  time: string; // ej. "hace 5 min"
  read: boolean;
}

interface NotificationBellProps {
  notifications: AppNotification[];
  onSelect?: (n: AppNotification) => void;
  onMarkAllRead?: () => void;
}

export function NotificationBell({ notifications, onSelect, onMarkAllRead }: NotificationBellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismiss(ref, open, () => setOpen(false));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones: sin novedades"}
        onClick={() => setOpen(!open)}
        className="relative grid size-11 place-items-center rounded-xl text-ink-700 hover:bg-ink-100"
      >
        <Bell size={22} aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold leading-5 text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notificaciones" className="absolute right-0 z-30 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-ink-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2">
            <h2 className="text-body-sm font-bold">Notificaciones</h2>
            {unread > 0 && (
              <Button variant="ghost" icon={<CheckCheck size={16} />} onClick={onMarkAllRead}>Marcar leídas</Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-ink-500">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect?.(n); setOpen(false); }}
                    className={cn("flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink-100", !n.read && "bg-brand-50")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-body-sm font-semibold">
                        {!n.read && <span className="sr-only">Sin leer: </span>}{n.title}
                      </span>
                      {n.description && <span className="block text-body-sm text-ink-700">{n.description}</span>}
                      <span className="block text-caption text-ink-500">{n.time}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
