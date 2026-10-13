import { Badge, StatusBadge } from "@/components/ui/Badge";
import type { StatusKey, Tone } from "@/core/status";

/** Estado de flujo (Pendiente, Aprobada, En tránsito…). Siempre color + ícono + texto. */
export function EstadoBadge({ estado, label }: { estado: StatusKey; label?: string }) {
  return <StatusBadge status={estado} label={label} />;
}

export type Semaforo = "verde" | "amarillo" | "rojo";

const SEMAFORO: Record<Semaforo, { tone: Tone; label: string; dot: string }> = {
  verde: { tone: "ok", label: "En orden", dot: "bg-ok" },
  amarillo: { tone: "warn", label: "Atención", dot: "bg-warn" },
  rojo: { tone: "danger", label: "Crítico", dot: "bg-danger" },
};

/** Indicador de salud (stock, plazos, calibración). Punto de color + texto. */
export function SemaforoBadge({ nivel, label }: { nivel: Semaforo; label?: string }) {
  const s = SEMAFORO[nivel];
  return (
    <Badge tone={s.tone}>
      <span className={`size-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {label ?? s.label}
    </Badge>
  );
}
