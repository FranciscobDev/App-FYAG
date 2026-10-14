const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CL");
const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatCLP = (value: number) => clp.format(value || 0);
export const formatNumber = (value: number) => num.format(value || 0);
export const formatDate = (value: Date | string) => {
  if (!value) return "-";
  try {
    return dateFmt.format(new Date(value));
  } catch {
    return String(value);
  }
};

/** Calcula el dígito verificador (módulo 11) de un RUT chileno. */
export function rutCheckDigit(body: number): string {
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
export function makeRut(body: number): string {
  return `${num.format(body)}-${rutCheckDigit(body)}`;
}

export function isValidRut(rut: string): boolean {
  if (!rut) return false;
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = Number(clean.slice(0, -1));
  return Number.isFinite(body) && rutCheckDigit(body) === clean.slice(-1);
}
