import { parsearFechaLocal } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";

/**
 * [FRONT-2] Parámetros de semaforización de plazos según Historia de Usuario H39:
 * - Rojo: Faltan 48 horas o menos (o ya venció).
 * - Amarillo: Faltan 5 días o menos (y más de 48 horas).
 * - Normal: Faltan más de 5 días.
 */
export const PARAMETROS_SEMAFORO_H39 = {
  DIAS_ALERTA_AMARILLO: 5,
  HORAS_CRITICO_ROJO: 48,
} as const;

export type TonoSemaforoPlazo = "ok" | "warn" | "danger" | "neutro";

export interface EstilosTarjetaSemaforo {
  backgroundColor: string;
  borderColor: string;
  borderLeftColor: string;
  borderLeftWidth: number;
  borderWidth: number;
}

export interface EvaluacionSemaforoPlazo {
  tono: TonoSemaforoPlazo;
  diferenciaMs: number;
  diferenciaHoras: number;
  diferenciaDias: number;
  vencido: boolean;
  critico48h: boolean;
  alerta5dias: boolean;
  tienePlazoValido: boolean;
  etiqueta: string;
  etiquetaCorta: string;
  icono: "alert-circle" | "time-outline" | "calendar-outline" | "help-circle-outline";
  estilosTarjeta: EstilosTarjetaSemaforo;
  colorProgreso: string;
  colorTextoPlazo: string;
}

/**
 * Evalúa el plazo de un proyecto contra la fecha/hora de referencia según H39.
 *
 * @param deadline Cadena de fecha ISO ("2026-12-01" o "2026-12-01T18:00:00")
 * @param ahoraMs Marca de tiempo en milisegundos de referencia (por defecto Date.now())
 */
export function evaluarSemaforoPlazo(
  deadline?: string | null,
  ahoraMs: number = Date.now()
): EvaluacionSemaforoPlazo {
  if (!deadline || !deadline.trim()) {
    return {
      tono: "neutro",
      diferenciaMs: 0,
      diferenciaHoras: 0,
      diferenciaDias: 0,
      vencido: false,
      critico48h: false,
      alerta5dias: false,
      tienePlazoValido: false,
      etiqueta: "Sin fecha límite asignada",
      etiquetaCorta: "Sin plazo",
      icono: "help-circle-outline",
      estilosTarjeta: {
        backgroundColor: tema.colors.card,
        borderColor: tema.colors.border,
        borderLeftColor: tema.colors.borderDark,
        borderLeftWidth: 4,
        borderWidth: 1,
      },
      colorProgreso: tema.colors.primary,
      colorTextoPlazo: tema.colors.textMuted,
    };
  }

  const fechaPlazo = parsearFechaLocal(deadline);
  const plazoMs = fechaPlazo.getTime();

  if (Number.isNaN(plazoMs)) {
    return {
      tono: "neutro",
      diferenciaMs: 0,
      diferenciaHoras: 0,
      diferenciaDias: 0,
      vencido: false,
      critico48h: false,
      alerta5dias: false,
      tienePlazoValido: false,
      etiqueta: "Fecha no válida",
      etiquetaCorta: "Fecha inválida",
      icono: "help-circle-outline",
      estilosTarjeta: {
        backgroundColor: tema.colors.card,
        borderColor: tema.colors.border,
        borderLeftColor: tema.colors.borderDark,
        borderLeftWidth: 4,
        borderWidth: 1,
      },
      colorProgreso: tema.colors.primary,
      colorTextoPlazo: tema.colors.textMuted,
    };
  }

  const diferenciaMs = plazoMs - ahoraMs;
  const diferenciaHoras = Math.floor(diferenciaMs / (1000 * 60 * 60));
  const diferenciaDias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

  const vencido = diferenciaMs <= 0;
  const critico48h = !vencido && diferenciaHoras <= PARAMETROS_SEMAFORO_H39.HORAS_CRITICO_ROJO;
  const alerta5dias =
    !vencido &&
    !critico48h &&
    diferenciaDias <= PARAMETROS_SEMAFORO_H39.DIAS_ALERTA_AMARILLO;

  // 1. ROJO: Vencido o faltan 48 horas o menos
  if (vencido || critico48h) {
    let etiqueta = "¡Plazo Vencido!";
    let etiquetaCorta = "Vencido";

    if (!vencido) {
      if (diferenciaHoras <= 24) {
        etiqueta = `¡Crítico! Falta 1 día (${Math.max(1, diferenciaHoras)}h)`;
        etiquetaCorta = `Crítico: ${Math.max(1, diferenciaHoras)}h`;
      } else {
        etiqueta = `¡Crítico! Faltan ${diferenciaHoras} horas`;
        etiquetaCorta = `Crítico: ${diferenciaHoras}h`;
      }
    }

    return {
      tono: "danger",
      diferenciaMs,
      diferenciaHoras,
      diferenciaDias,
      vencido,
      critico48h,
      alerta5dias: false,
      tienePlazoValido: true,
      etiqueta,
      etiquetaCorta,
      icono: "alert-circle",
      estilosTarjeta: {
        backgroundColor: "#fef2f2", // Red 50/100 suave
        borderColor: "#fca5a5",     // Red 300 perimetral
        borderLeftColor: "#b91c1c", // Red 700 franja
        borderLeftWidth: 5,
        borderWidth: 1.5,
      },
      colorProgreso: tema.colors.danger,
      colorTextoPlazo: tema.colors.dangerDark,
    };
  }

  // 2. AMARILLO: Faltan 5 días o menos (y más de 48 horas)
  if (alerta5dias) {
    const etiqueta = `Atención: Faltan ${diferenciaDias} días`;
    const etiquetaCorta = `${diferenciaDias} días restantes`;

    return {
      tono: "warn",
      diferenciaMs,
      diferenciaHoras,
      diferenciaDias,
      vencido: false,
      critico48h: false,
      alerta5dias: true,
      tienePlazoValido: true,
      etiqueta,
      etiquetaCorta,
      icono: "time-outline",
      estilosTarjeta: {
        backgroundColor: "#fef3c7", // Amber 100 suave
        borderColor: "#fde68a",     // Amber 200 perimetral
        borderLeftColor: "#b45309", // Amber 700 franja
        borderLeftWidth: 5,
        borderWidth: 1.5,
      },
      colorProgreso: tema.colors.warn,
      colorTextoPlazo: tema.colors.warnDark,
    };
  }

  // 3. NORMAL (VERDE / NEUTRO): Faltan más de 5 días
  const etiqueta = `En plazo: Quedan ${diferenciaDias} días`;
  const etiquetaCorta = `${diferenciaDias} días`;

  return {
    tono: "ok",
    diferenciaMs,
    diferenciaHoras,
    diferenciaDias,
    vencido: false,
    critico48h: false,
    alerta5dias: false,
    tienePlazoValido: true,
    etiqueta,
    etiquetaCorta,
    icono: "calendar-outline",
    estilosTarjeta: {
      backgroundColor: tema.colors.card, // Blanco puro
      borderColor: tema.colors.border,    // Borde fino 1px
      borderLeftColor: "#15803d",         // Green 700 franja
      borderLeftWidth: 4,
      borderWidth: 1,
    },
    colorProgreso: "#15803d",
    colorTextoPlazo: tema.colors.textSecondary,
  };
}

/**
 * Genera una fecha límite en formato ISO calculada a N días a partir de la fecha dada.
 */
export function generarFechaPlazoDias(diasRelativos: number, fechaBase: Date = new Date()): string {
  const target = new Date(fechaBase.getTime() + diasRelativos * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}
