import type { LucideIcon } from "lucide-react";
import { STATUSES, TONE_CLASSES, type StatusKey, type Tone } from "@/core/status";

interface BadgeProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
}

/** Badge genérico (para valores que no son un estado de flujo, ej. nivel de stock). */
export function Badge({ tone = "mute", icon: Icon, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label font-semibold ${TONE_CLASSES[tone]}`}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Estado de flujo estandarizado: color + ícono + texto. */
export function StatusBadge({ status, label }: { status: StatusKey; label?: string }) {
  const def = STATUSES[status];
  return (
    <Badge tone={def.tone} icon={def.icon}>
      {label ?? def.label}
    </Badge>
  );
}
