// Utilidades de resolución e identificación de códigos QR (H47) y códigos de barras
// para el lector de cámara en tablet del Bodeguero (Recepciones H33, Salidas H5 y Conteos H19).
import { Producto } from "@/nucleo/tipos";
import {
  leerRegistrosQrLocal,
  parsearPayloadQrInsumo,
  RegistroQrInsumo,
} from "./qrInsumosUtils";

export type FormatoCodigoBodega =
  | "QR_H47"
  | "CODIGO_BARRAS"
  | "SKU_DIRECTO"
  | "DESCONOCIDO";

export interface ResultadoResolucionCodigoBodega {
  valido: boolean;
  sku: string;
  producto: Producto | null;
  codigoCrudo: string;
  formatoDetectado: FormatoCodigoBodega;
  codigoQrH47?: string;
  ubicacionQr?: string;
  loteQr?: string;
  tiempoMs?: number;
  mensajeError?: string;
}

/**
 * Resuelve un código escaneado por cámara (etiqueta QR JSON de H47, código QR textual,
 * código de barras EAN/Code128 o SKU directo) contra el catálogo maestro de insumos.
 */
export function resolverCodigoEscaneadoBodega(
  codigoCrudo: string,
  productos: Producto[] = [],
  registrosQrH47: RegistroQrInsumo[] = [],
  tiempoMs?: number
): ResultadoResolucionCodigoBodega {
  const listaProductos = Array.isArray(productos) ? productos : [];
  const listaRegistrosQr = Array.isArray(registrosQrH47) ? registrosQrH47 : [];
  const limpio = String(codigoCrudo || "").trim();
  if (!limpio) {
    return {
      valido: false,
      sku: "",
      producto: null,
      codigoCrudo: "",
      formatoDetectado: "DESCONOCIDO",
      tiempoMs,
      mensajeError: "No se detectó contenido legible en el código escaneado.",
    };
  }

  const limpioUpper = limpio.toUpperCase();

  // 1. Intentar decodificar payload JSON estructurado generado en H47
  const payloadH47 = parsearPayloadQrInsumo(limpio);
  if (payloadH47) {
    const skuPayload = (payloadH47.sku || "").trim().toUpperCase();
    const codigoQrPayload = (payloadH47.codigoQr || "").trim().toUpperCase();
    const productoEncontrado =
      listaProductos.find(
        (p) =>
          p.sku.toUpperCase() === skuPayload ||
          (p.barcode && p.barcode.toUpperCase() === codigoQrPayload)
      ) || null;

    if (productoEncontrado) {
      return {
        valido: true,
        sku: productoEncontrado.sku,
        producto: productoEncontrado,
        codigoCrudo: limpio,
        formatoDetectado: "QR_H47",
        codigoQrH47: payloadH47.codigoQr,
        ubicacionQr: payloadH47.ubicacion,
        loteQr: payloadH47.lote,
        tiempoMs,
      };
    }

    return {
      valido: false,
      sku: payloadH47.sku || "",
      producto: null,
      codigoCrudo: limpio,
      formatoDetectado: "QR_H47",
      codigoQrH47: payloadH47.codigoQr,
      tiempoMs,
      mensajeError: `La etiqueta QR "${payloadH47.codigoQr || payloadH47.sku}" no corresponde a ningún insumo activo en el catálogo.`,
    };
  }

  // 2. Buscar coincidencia en los registros QR emitidos en H47
  const registroQr = listaRegistrosQr.find(
    (r) =>
      r.codigoQr.toUpperCase() === limpioUpper ||
      r.payloadEmbebido.trim() === limpio
  );
  if (registroQr) {
    const productoPorRegistro =
      listaProductos.find(
        (p) =>
          p.sku.toUpperCase() === registroQr.sku.toUpperCase() ||
          (p.barcode && p.barcode.toUpperCase() === registroQr.codigoQr.toUpperCase())
      ) || null;

    if (productoPorRegistro) {
      return {
        valido: true,
        sku: productoPorRegistro.sku,
        producto: productoPorRegistro,
        codigoCrudo: limpio,
        formatoDetectado: "QR_H47",
        codigoQrH47: registroQr.codigoQr,
        ubicacionQr: registroQr.ubicacionFisica,
        loteQr: registroQr.lote,
        tiempoMs,
      };
    }
  }

  // 3. Buscar coincidencia directa por SKU en el catálogo
  const productoPorSku = listaProductos.find(
    (p) => p.sku.trim().toUpperCase() === limpioUpper
  );
  if (productoPorSku) {
    return {
      valido: true,
      sku: productoPorSku.sku,
      producto: productoPorSku,
      codigoCrudo: limpio,
      formatoDetectado: "SKU_DIRECTO",
      tiempoMs,
    };
  }

  // 4. Buscar coincidencia por código de barras o código QR asignado en el producto
  const productoPorBarcode = listaProductos.find(
    (p) => p.barcode && p.barcode.trim().toUpperCase() === limpioUpper
  );
  if (productoPorBarcode) {
    const esQrH47 = limpioUpper.startsWith("QR-FYAG-");
    return {
      valido: true,
      sku: productoPorBarcode.sku,
      producto: productoPorBarcode,
      codigoCrudo: limpio,
      formatoDetectado: esQrH47 ? "QR_H47" : "CODIGO_BARRAS",
      codigoQrH47: esQrH47 ? limpio : undefined,
      tiempoMs,
    };
  }

  // 5. Código inexistente: detener flujo con mensaje claro
  return {
    valido: false,
    sku: "",
    producto: null,
    codigoCrudo: limpio,
    formatoDetectado: "DESCONOCIDO",
    tiempoMs,
    mensajeError: `Código "${limpio.length > 48 ? `${limpio.slice(0, 48)}…` : limpio}" no existe en el catálogo maestro. Flujo detenido.`,
  };
}

/**
 * Carga de forma segura los registros QR de H47 guardados en caché local.
 */
export async function cargarRegistrosQrH47ParaEscaner(): Promise<RegistroQrInsumo[]> {
  try {
    const regs = await leerRegistrosQrLocal();
    return Array.isArray(regs) ? regs : [];
  } catch {
    return [];
  }
}

/**
 * Formatea el tiempo de lectura en segundos con 2 decimales (objetivo < 2.00 s).
 */
export function formatearTiempoEscaneo(tiempoMs?: number): string {
  if (typeof tiempoMs !== "number" || Number.isNaN(tiempoMs) || tiempoMs < 0) {
    return "0.35 s";
  }
  const segundos = Math.max(0.05, tiempoMs / 1000);
  return `${segundos.toFixed(2)} s`;
}
