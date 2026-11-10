// Validación del RUT chileno con algoritmo Módulo 11.

export function limpiarRut(rut: string): string {
  return String(rut ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}

export function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDigitoVerificador(cuerpo) === dv;
}

// Devuelve el RUT en formato 12.345.678-K
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}