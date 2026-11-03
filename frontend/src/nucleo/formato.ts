const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const numero = new Intl.NumberFormat("es-CL");
const fechaFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatearCLP = (value: number) => clp.format(value || 0);
export const formatearNumero = (value: number) => numero.format(value || 0);
export const formatearFecha = (value: Date | string) => {
  if (!value) return "-";
  try {
    return fechaFmt.format(new Date(value));
  } catch {
    return String(value);
  }
};

/** Calcula el dígito verificador (módulo 11) de un RUT chileno. */
export function digitoVerificadorRut(body: number): string {
  let sum = 0;
  let mul = 2;
  for (const d of String(body).split("").reverse()) {
    sum += Number(d) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** Devuelve el RUT con puntos y guion: 12.345.678-5 */
export function construirRut(body: number): string {
  return `${numero.format(body)}-${digitoVerificadorRut(body)}`;
}

export function esRutValido(rut: string): boolean {
  if (!rut) return false;
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const cuerpo = Number(clean.slice(0, -1));
  return Number.isFinite(cuerpo) && digitoVerificadorRut(cuerpo) === clean.slice(-1);
}
