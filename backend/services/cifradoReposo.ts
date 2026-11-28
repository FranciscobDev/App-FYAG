import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { obtenerJwtSecret } from '../config/entorno';

const PREFIJO_CIFRADO = 'enc:v1:';
const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12;

/**
 * Deriva una clave de 256 bits (32 bytes) para cifrado en reposo a partir de
 * DATA_ENCRYPTION_KEY (si está definida) o JWT_SECRET con separación de dominio SHA-256.
 */
const obtenerClaveCifradoReposo = (claveExplicita?: string): Buffer => {
    const material = (claveExplicita ?? process.env.DATA_ENCRYPTION_KEY ?? obtenerJwtSecret()).trim();
    if (!material || material.length < 32) {
        throw new Error('La clave para cifrado en reposo debe tener al menos 32 caracteres');
    }
    return createHash('sha256').update(`fyag-at-rest-v1:${material}`).digest();
};

export const estaCifradoEnReposo = (valor: unknown): boolean =>
    typeof valor === 'string' && valor.startsWith(PREFIJO_CIFRADO);

/**
 * Cifra un dato sensible (p. ej. datos bancarios/contacto de proveedor o facturación)
 * usando AES-256-GCM autenticado (IV aleatorio de 12 bytes + Auth Tag de 16 bytes).
 * Si el valor ya está cifrado, lo devuelve intacto (idempotente).
 */
export const cifrarDatoSensible = (textoPlano: string, claveExplicita?: string): string => {
    if (estaCifradoEnReposo(textoPlano)) return textoPlano;

    const clave = obtenerClaveCifradoReposo(claveExplicita);
    const iv = randomBytes(BYTES_IV);
    const cipher = createCipheriv(ALGORITMO, clave, iv);

    const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIJO_CIFRADO}${iv.toString('base64url')}.${tag.toString('base64url')}.${cifrado.toString('base64url')}`;
};

/**
 * Descifra un valor previamente cifrado con `cifrarDatoSensible`.
 * Si el valor no tiene el prefijo `enc:v1:` (dato histórico en texto plano), lo devuelve tal cual.
 * Lanza excepción si el texto cifrado o su etiqueta de autenticación GCM fueron alterados.
 */
export const descifrarDatoSensible = (valorAlmacenado: string, claveExplicita?: string): string => {
    if (!estaCifradoEnReposo(valorAlmacenado)) return valorAlmacenado;

    const sinPrefijo = valorAlmacenado.slice(PREFIJO_CIFRADO.length);
    const partes = sinPrefijo.split('.');
    if (partes.length !== 3) {
        throw new Error('Formato de dato cifrado en reposo inválido');
    }

    const [ivB64, tagB64, datosB64] = partes;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const datos = Buffer.from(datosB64, 'base64url');

    if (iv.length !== BYTES_IV || tag.length !== 16) {
        throw new Error('Parámetros criptográficos GCM inválidos en dato cifrado');
    }

    const clave = obtenerClaveCifradoReposo(claveExplicita);
    const decipher = createDecipheriv(ALGORITMO, clave, iv);
    decipher.setAuthTag(tag);

    const descifrado = Buffer.concat([decipher.update(datos), decipher.final()]);
    return descifrado.toString('utf8');
};
