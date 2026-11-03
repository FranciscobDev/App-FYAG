import { tema, Tono } from "./tema";
export type { Tono };

export type ClaveEstado =
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

export interface DefinicionEstado {
  label: string;
  tone: Tono;
  icon: string; // Ionicons name
  colorName: string; // "ámbar" | "verde" | "rojo" | "azul" | "gris" | "celeste"
}

/**
 * REGLA ESTRICTA DE INSIGNIAS DE ESTADO:
 * Estados SIEMPRE con color + icono + etiqueta concisa de una sola palabra:
 * - Pendiente / Parcial / Mantención = ámbar
 * - Aprobada / Conforme / Activo / Disponible = verde
 * - Rechazada / Defectuoso / Vencido / Faltante = rojo
 * - Tránsito / Enviada = azul
 * - Cerrado / Anulada / Borrador / Baja = gris
 * - Planificado / Asignada = celeste
 */
export const ESTADOS: Record<ClaveEstado, DefinicionEstado> = {
  // 1. ÁMBAR
  pendiente: { label: "Pendiente", tone: "warn", icon: "time-outline", colorName: "ámbar" },
  recibida_parcial: { label: "Parcial", tone: "warn", icon: "pie-chart-outline", colorName: "ámbar" },
  en_mantencion: { label: "Mantención", tone: "warn", icon: "build-outline", colorName: "ámbar" },
  pendiente_resolucion: { label: "Pendiente", tone: "warn", icon: "time-outline", colorName: "ámbar" },

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
  en_transito: { label: "Tránsito", tone: "transit", icon: "car-outline", colorName: "azul" },
  enviada: { label: "Enviada", tone: "transit", icon: "paper-plane-outline", colorName: "azul" },

  // 5. CELESTE
  planificado: { label: "Planificado", tone: "celeste", icon: "calendar-outline", colorName: "celeste" },
  asignada: { label: "Asignada", tone: "celeste", icon: "person-outline", colorName: "celeste" },

  // 6. GRIS
  cerrado: { label: "Cerrado", tone: "mute", icon: "lock-closed-outline", colorName: "gris" },
  cerrada: { label: "Cerrada", tone: "mute", icon: "lock-closed-outline", colorName: "gris" },
  anulada: { label: "Anulada", tone: "mute", icon: "ban-outline", colorName: "gris" },
  borrador: { label: "Borrador", tone: "mute", icon: "document-text-outline", colorName: "gris" },
  dada_de_baja: { label: "Baja", tone: "mute", icon: "trash-outline", colorName: "gris" },
};

export function obtenerEstilosTono(tone: Tono) {
  switch (tone) {
    case "ok":
      return {
        bg: tema.colors.okLight,
        text: tema.colors.okDark,
        border: tema.colors.okBorder,
      };
    case "warn":
      return {
        bg: tema.colors.warnLight,
        text: tema.colors.warnDark,
        border: tema.colors.warnBorder,
      };
    case "danger":
      return {
        bg: tema.colors.dangerLight,
        text: tema.colors.dangerDark,
        border: tema.colors.dangerBorder,
      };
    case "transit":
      return {
        bg: tema.colors.transitLight,
        text: tema.colors.transitDark,
        border: tema.colors.transitBorder,
      };
    case "celeste":
      return {
        bg: tema.colors.celesteLight,
        text: tema.colors.celesteDark,
        border: tema.colors.celesteBorder,
      };
    case "info":
    case "primary":
      return {
        bg: tema.colors.primaryLight,
        text: tema.colors.primaryDark,
        border: tema.colors.primaryBorder,
      };
    case "mute":
    default:
      return {
        bg: tema.colors.muteLight,
        text: tema.colors.muteDark,
        border: tema.colors.muteBorder,
      };
  }
}
