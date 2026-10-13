import type { LucideIcon } from "lucide-react";
import { Ban, CalendarClock, CheckCircle2, Clock, Lock, Truck, XCircle } from "lucide-react";

export type Tone = "ok" | "warn" | "danger" | "transit" | "info" | "mute";

/** Clases por tono (fondo, texto y borde cumplen AA). */
export const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  transit: "bg-transit-soft text-transit border-transit-line",
  info: "bg-info-soft text-info border-info-line",
  mute: "bg-mute-soft text-mute border-mute-line",
};

export type StatusKey =
  | "pendiente"
  | "aprobada"
  | "conforme"
  | "activo"
  | "rechazada"
  | "defectuoso"
  | "vencido"
  | "en_transito"
  | "cerrado"
  | "anulada"
  | "planificado"
  | "recibida"
  | "entregada"
  | "borrador"
  | "enviada"
  | "recibida_parcial"
  | "cerrada"
  | "faltante";

interface StatusDef {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

/** Fuente única de verdad de estados: color + ícono + texto, nunca solo color. */
export const STATUSES: Record<StatusKey, StatusDef> = {
  pendiente: { label: "Pendiente", tone: "warn", icon: Clock },
  aprobada: { label: "Aprobada", tone: "ok", icon: CheckCircle2 },
  conforme: { label: "Conforme", tone: "ok", icon: CheckCircle2 },
  activo: { label: "Activo", tone: "ok", icon: CheckCircle2 },
  rechazada: { label: "Rechazada", tone: "danger", icon: XCircle },
  defectuoso: { label: "Defectuoso", tone: "danger", icon: XCircle },
  vencido: { label: "Vencido", tone: "danger", icon: XCircle },
  en_transito: { label: "En tránsito", tone: "transit", icon: Truck },
  cerrado: { label: "Cerrado", tone: "mute", icon: Lock },
  anulada: { label: "Anulada", tone: "mute", icon: Ban },
  planificado: { label: "Planificado", tone: "info", icon: CalendarClock },
  recibida: { label: "Recibida", tone: "ok", icon: CheckCircle2 },
  entregada: { label: "Entregada", tone: "ok", icon: CheckCircle2 },
  borrador: { label: "Borrador", tone: "mute", icon: Lock },
  enviada: { label: "Enviada", tone: "info", icon: Truck },
  recibida_parcial: { label: "Recibida parcial", tone: "warn", icon: Clock },
  cerrada: { label: "Cerrada", tone: "mute", icon: Lock },
  faltante: { label: "Faltante", tone: "danger", icon: XCircle },
};
