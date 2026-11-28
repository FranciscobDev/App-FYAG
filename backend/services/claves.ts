import { createHash } from 'crypto';

/** Hash SHA-256 de un token: es lo único que se guarda en la BD. */
export const hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

/**
 * Política de contraseña alineada con el formulario del frontend:
 * mínimo 10 caracteres, al menos una mayúscula y un número.
 * Devuelve un mensaje de error, o null si la clave es válida.
 */
export const validarFortalezaClave = (clave: string): string | null => {
    if (clave.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
    if (!/[A-Z]/.test(clave)) return 'La contraseña debe incluir al menos una letra mayúscula';
    if (!/[0-9]/.test(clave)) return 'La contraseña debe incluir al menos un número';
    return null;
};
