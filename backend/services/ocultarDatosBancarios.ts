const ROLES_CON_DATOS_BANCARIOS = ['Administrador', 'Contador'];

export function puedeVerDatosBancarios(rol: string | undefined): boolean {
  if (!rol) return false;
  return ROLES_CON_DATOS_BANCARIOS.includes(rol);
}

export function aplicarOcultamientoBancario(
  proveedor: Record<string, unknown>,
  rol: string | undefined
): Record<string, unknown> {
  if (puedeVerDatosBancarios(rol)) return proveedor;
  const copia = { ...proveedor };
  delete copia.datos_bancarios;
  return copia;
}