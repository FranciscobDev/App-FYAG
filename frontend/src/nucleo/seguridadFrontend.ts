/**
 * Utilidades de seguridad del Frontend:
 * 1. Escapado y sanitización contra XSS en textos y URLs.
 * 2. Validación de archivos subidos (extensión, tipo MIME, magic bytes reales y tamaño máximo).
 */

export const MAX_BYTES_ARCHIVO_FRONTEND = 10 * 1024 * 1024; // 10 MB para documentos/facturas
export const MAX_BYTES_FOTO_FRONTEND = 5 * 1024 * 1024; // 5 MB para fotos

const EXTENSIONES_PERMITIDAS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const EXTENSIONES_PROHIBIDAS = new Set([
  ".svg",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".py",
]);

/**
 * Escapa caracteres HTML peligrosos (&, <, >, ", ') para prevenir XSS en cualquier contexto.
 */
export const escaparTextoSeguroXss = (valor: unknown): string => {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * Verifica que una URI de imagen o recurso no utilice esquemas ejecutables (javascript:, vbscript:, data:text/html).
 */
export const esUriRecursoSegura = (uri: string | undefined | null): boolean => {
  if (!uri || typeof uri !== "string") return false;
  const limpia = uri.trim();
  if (!limpia) return false;

  const minuscula = limpia.toLowerCase();
  if (
    minuscula.startsWith("javascript:") ||
    minuscula.startsWith("vbscript:") ||
    minuscula.startsWith("data:text/html") ||
    minuscula.startsWith("data:image/svg")
  ) {
    return false;
  }

  return (
    minuscula.startsWith("https://") ||
    minuscula.startsWith("http://") ||
    minuscula.startsWith("file://") ||
    minuscula.startsWith("content://") ||
    minuscula.startsWith("data:image/jpeg;base64,") ||
    minuscula.startsWith("data:image/png;base64,") ||
    minuscula.startsWith("data:image/webp;base64,")
  );
};

/**
 * Detecta el tipo MIME real de un archivo a partir de sus primeros bytes (magic numbers).
 */
export const detectarMimeRealPorBytes = (
  bytes: Uint8Array
): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  ) {
    return "application/pdf";
  }
  return null;
};

export interface EntradaArchivoValidacion {
  nombre: string;
  mimeDeclarado: string;
  tamanoBytes: number;
  maxBytes?: number;
  cabeceraBytes?: Uint8Array;
  uri?: string;
}

export interface ResultadoValidacionArchivo {
  ok: boolean;
  nombreSanitizado?: string;
  mimeReal?: string;
  error?: string;
}

/**
 * Valida un archivo antes de adjuntarlo o enviarlo al backend:
 * - Limpia secuencias de path traversal (../, ..\) del nombre.
 * - Rechaza extensiones ejecutables o susceptibles de XSS (.svg, .html, .js, .exe).
 * - Valida que el tamaño sea > 0 y no supere maxBytes.
 * - Si se incluyen los primeros bytes del archivo (magic numbers), verifica que el tipo real
 *   coincida con el MIME y la extensión declarados.
 */
export const validarArchivoSubidoFrontend = (
  entrada: EntradaArchivoValidacion
): ResultadoValidacionArchivo => {
  const nombreCrudo = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (!nombreCrudo || nombreCrudo.includes("\0")) {
    return { ok: false, error: "El nombre del archivo no es válido" };
  }
  if (nombreCrudo.includes("..") || nombreCrudo.includes("/") || nombreCrudo.includes("\\")) {
    return { ok: false, error: "El nombre del archivo contiene caracteres de ruta no permitidos" };
  }

  const nombreSanitizado = nombreCrudo.replace(/[^a-zA-Z0-9._-]/g, "_");
  const punto = nombreSanitizado.lastIndexOf(".");
  const extension = punto !== -1 ? nombreSanitizado.slice(punto).toLowerCase() : "";

  if (!extension || EXTENSIONES_PROHIBIDAS.has(extension)) {
    return { ok: false, error: `La extensión "${extension || "sin extensión"}" no está permitida por seguridad` };
  }

  const mime = (entrada.mimeDeclarado || "").trim().toLowerCase();
  const extensionesValidas = EXTENSIONES_PERMITIDAS[mime];
  if (!extensionesValidas || !extensionesValidas.includes(extension)) {
    return { ok: false, error: `El tipo de archivo (${mime || "desconocido"}) no coincide con una extensión permitida` };
  }

  const topeBytes = entrada.maxBytes ?? (mime.startsWith("image/") ? MAX_BYTES_FOTO_FRONTEND : MAX_BYTES_ARCHIVO_FRONTEND);
  if (!Number.isFinite(entrada.tamanoBytes) || entrada.tamanoBytes <= 0) {
    return { ok: false, error: "El archivo está vacío" };
  }
  if (entrada.tamanoBytes > topeBytes) {
    const maxMb = (topeBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `El archivo supera el tamaño máximo permitido de ${maxMb} MB` };
  }

  if (entrada.cabeceraBytes && entrada.cabeceraBytes.length > 0) {
    const mimeDetectado = detectarMimeRealPorBytes(entrada.cabeceraBytes);
    if (!mimeDetectado || mimeDetectado !== mime) {
      return {
        ok: false,
        error: "El contenido binario real del archivo no corresponde al formato declarado",
      };
    }
  }

  if (entrada.uri !== undefined && !esUriRecursoSegura(entrada.uri)) {
    return { ok: false, error: "La dirección del archivo contiene un esquema no seguro" };
  }

  return {
    ok: true,
    nombreSanitizado,
    mimeReal: mime,
  };
};
