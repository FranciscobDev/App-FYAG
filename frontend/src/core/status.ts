import { theme, Tone } from "./theme";
export type { Tone };

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
  | "faltante"
  | "disponible"
  | "asignada"
  | "en_mantencion"
  | "dada_de_baja"
  | "pendiente_resolucion"
  | "resuelta";

export interface StatusDef {
  label: string;
  tone: Tone;
  icon: string; // Ionicons name
  colorName: string; // "ámbar" | "verde" | "rojo" | "azul" | "gris" | "celeste"
}

/**
 * REGLA ESTRICTA PASO 1:
 * Estados SIEMPRE con color + texto:
 * - Pendiente = ámbar
 * - Aprobada / Conforme / Activo = verde
 * - Rechazada / Defectuoso / Vencido = rojo
 * - En tránsito = azul
 * - Cerrado / Anulada = gris
 * - Planificado = celeste
 */
export const STATUSES: Record<StatusKey, StatusDef> = {
  // 1. ÁMBAR
  pendiente: { label: "Pendiente", tone: "warn", icon: "time-outline", colorName: "ámbar" },
  recibida_parcial: { label: "Recibida parcial", tone: "warn", icon: "pie-chart-outline", colorName: "ámbar" },
  en_mantencion: { label: "En mantención", tone: "warn", icon: "build-outline", colorName: "ámbar" },
  pendiente_resolucion: { label: "Pendiente resolución", tone: "warn", icon: "time-outline", colorName: "ámbar" },

  // 2. VERDE
  aprobada: { label: "Aprobada", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },
  conforme: { label: "Conforme", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },
  activo: { label: "Activo", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },
  recibida: { label: "Recibida", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },
  entregada: { label: "Entregada", tone: "ok", icon: "checkmark-done-outline", colorName: "verde" },
  disponible: { label: "Disponible", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },
  resuelta: { label: "Resuelta", tone: "ok", icon: "checkmark-circle-outline", colorName: "verde" },

  // 3. ROJO
  rechazada: { label: "Rechazada", tone: "danger", icon: "close-circle-outline", colorName: "rojo" },
  defectuoso: { label: "Defectuoso", tone: "danger", icon: "alert-circle-outline", colorName: "rojo" },
  vencido: { label: "Vencido", tone: "danger", icon: "alert-circle-outline", colorName: "rojo" },
  faltante: { label: "Faltante", tone: "danger", icon: "warning-outline", colorName: "rojo" },

  // 4. AZUL
  en_transito: { label: "En tránsito", tone: "transit", icon: "car-outline", colorName: "azul" },
  enviada: { label: "Enviada", tone: "transit", icon: "paper-plane-outline", colorName: "azul" },

  // 5. CELESTE
  planificado: { label: "Planificado", tone: "celeste", icon: "calendar-outline", colorName: "celeste" },
  asignada: { label: "Asignada", tone: "celeste", icon: "person-outline", colorName: "celeste" },

  // 6. GRIS
  cerrado: { label: "Cerrado", tone: "mute", icon: "lock-closed-outline", colorName: "gris" },
  cerrada: { label: "Cerrada", tone: "mute", icon: "lock-closed-outline", colorName: "gris" },
  anulada: { label: "Anulada", tone: "mute", icon: "ban-outline", colorName: "gris" },
  borrador: { label: "Borrador", tone: "mute", icon: "document-text-outline", colorName: "gris" },
  dada_de_baja: { label: "Dada de baja", tone: "mute", icon: "trash-outline", colorName: "gris" },
};

export function getToneStyles(tone: Tone) {
  switch (tone) {
    case "ok":
      return {
        bg: theme.colors.okLight,
        text: theme.colors.okDark,
        border: theme.colors.okBorder,
      };
    case "warn":
      return {
        bg: theme.colors.warnLight,
        text: theme.colors.warnDark,
        border: theme.colors.warnBorder,
      };
    case "danger":
      return {
        bg: theme.colors.dangerLight,
        text: theme.colors.dangerDark,
        border: theme.colors.dangerBorder,
      };
    case "transit":
      return {
        bg: theme.colors.transitLight,
        text: theme.colors.transitDark,
        border: theme.colors.transitBorder,
      };
    case "celeste":
      return {
        bg: theme.colors.celesteLight,
        text: theme.colors.celesteDark,
        border: theme.colors.celesteBorder,
      };
    case "info":
    case "primary":
      return {
        bg: theme.colors.primaryLight,
        text: theme.colors.primaryDark,
        border: theme.colors.primaryBorder,
      };
    case "mute":
    default:
      return {
        bg: theme.colors.muteLight,
        text: theme.colors.muteDark,
        border: theme.colors.muteBorder,
      };
  }
}
