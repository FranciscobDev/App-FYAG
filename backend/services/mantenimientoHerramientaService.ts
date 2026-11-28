/** Utilidades puras para avisos de mantenimiento de herramientas (H40 / H39). */

const pad = (n: number) => String(n).padStart(2, '0');

/** Normaliza un DATE de pg (Date o texto) a 'AAAA-MM-DD' sin desfase horario. */
export const aIsoFecha = (v: string | Date | null | undefined): string | null => {
    if (!v) return null;
    if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return String(v).slice(0, 10);
};

const aUtcDia = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86400000;

export const hoyIso = (ahora: Date = new Date()): string => aIsoFecha(ahora) as string;

/** Días entre hoy y el vencimiento (negativo si ya venció). */
export const diasHastaVencimiento = (fechaMantenimiento: string | Date, hoy: string): number =>
    Math.round(aUtcDia(aIsoFecha(fechaMantenimiento) as string) - aUtcDia(hoy));

export const estaMantenimientoVencido = (
    h: { fecha_proximo_mantenimiento: string | Date | null; estado: string },
    hoy: string
): boolean =>
    !!h.fecha_proximo_mantenimiento &&
    h.estado !== 'dada de baja' &&
    diasHastaVencimiento(h.fecha_proximo_mantenimiento, hoy) < 0;

/**
 * Aviso a enviar: 'final' (≤ N días, p. ej. 1) o 'previo' (≤ M días, p. ej. 7), sin repetir
 * un aviso ya enviado para la misma fecha de mantenimiento.
 */
export const avisoMantenimientoPendiente = (
    dias: number,
    diasPrevio: number,
    diasFinal: number,
    yaEnviado: { previo: boolean; final: boolean }
): 'previo' | 'final' | null => {
    if (dias < 0) return null;
    if (dias <= diasFinal) return yaEnviado.final ? null : 'final';
    if (dias <= diasPrevio) return yaEnviado.previo || yaEnviado.final ? null : 'previo';
    return null;
};
