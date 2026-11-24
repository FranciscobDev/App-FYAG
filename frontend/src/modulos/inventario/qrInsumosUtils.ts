// Utilidades de generación, visualización SVG, persistencia local e impresión de códigos QR
// asociados a los insumos del catálogo (gestión de asignación física para el Administrador).
import { Platform } from "react-native";
import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import { Producto } from "@/nucleo/tipos";

export type EstadoAsignacionFisicaQr =
  | "pendiente_impresion"
  | "impreso"
  | "asignado_estanteria";

export interface DatosEmbebidosQrInsumo {
  sistema: "FYAG";
  tipo: "INSUMO";
  codigoQr: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: string;
  ubicacion: string;
  lote?: string;
  generadoEn: string;
}

export interface RegistroQrInsumo {
  id: string;
  codigoQr: string;
  sku: string;
  nombreInsumo: string;
  unidad: string;
  categoria: string;
  ubicacionFisica: string;
  lote?: string;
  estadoAsignacion: EstadoAsignacionFisicaQr;
  generadoEn: string;
  generadoPor: string;
  actualizadoEn: string;
  payloadEmbebido: string;
}

const CLAVE_CACHE_QR = "codigos_qr_insumos_fyag";

/**
 * Construye el JSON estructurado que se embebe dentro del código QR de un insumo.
 */
export function construirPayloadQrInsumo(params: {
  codigoQr: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: string;
  ubicacion: string;
  lote?: string;
  generadoEn: string;
}): string {
  const datos: DatosEmbebidosQrInsumo = {
    sistema: "FYAG",
    tipo: "INSUMO",
    codigoQr: params.codigoQr,
    sku: params.sku,
    nombre: params.nombre,
    categoria: params.categoria,
    unidad: params.unidad,
    ubicacion: params.ubicacion,
    ...(params.lote && params.lote.trim() ? { lote: params.lote.trim() } : {}),
    generadoEn: params.generadoEn,
  };
  return JSON.stringify(datos);
}

/**
 * Parsea de forma segura los datos embebidos dentro de un registro QR.
 */
export function parsearPayloadQrInsumo(payload: string): DatosEmbebidosQrInsumo | null {
  try {
    const obj = JSON.parse(payload);
    if (obj && obj.sistema === "FYAG" && obj.sku) {
      return obj as DatosEmbebidosQrInsumo;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Crea un registro QR completo para un insumo del catálogo.
 */
export function crearRegistroQrParaProducto(params: {
  producto: Producto;
  ubicacionFisica: string;
  lote?: string;
  generadoPor: string;
  estadoInicial?: EstadoAsignacionFisicaQr;
  correlativo?: number;
}): RegistroQrInsumo {
  const {
    producto,
    ubicacionFisica,
    lote,
    generadoPor,
    estadoInicial = "pendiente_impresion",
    correlativo = Math.floor(100 + Math.random() * 899),
  } = params;

  const ahoraIso = new Date().toISOString();
  const skuLimpio = producto.sku.trim().toUpperCase();
  const codigoQr = `FYAG-QR-${skuLimpio}-${String(correlativo).padStart(3, "0")}`;
  const ubicacionFinal = ubicacionFisica.trim() || producto.location || "Bodega Central";

  const payloadEmbebido = construirPayloadQrInsumo({
    codigoQr,
    sku: skuLimpio,
    nombre: producto.name,
    categoria: producto.category,
    unidad: producto.unit,
    ubicacion: ubicacionFinal,
    lote,
    generadoEn: ahoraIso,
  });

  return {
    id: `qr_${Date.now()}_${skuLimpio}`,
    codigoQr,
    sku: skuLimpio,
    nombreInsumo: producto.name,
    unidad: producto.unit,
    categoria: producto.category,
    ubicacionFisica: ubicacionFinal,
    lote: lote?.trim() || undefined,
    estadoAsignacion: estadoInicial,
    generadoEn: ahoraIso,
    generadoPor,
    actualizadoEn: ahoraIso,
    payloadEmbebido,
  };
}

/**
 * Genera registros QR iniciales para los primeros insumos del catálogo que ya poseen código físico,
 * dejando otros sin QR para facilitar la demostración de generación en vivo.
 */
export function inicializarRegistrosQrBase(productos: Producto[]): RegistroQrInsumo[] {
  const estadosCiclo: EstadoAsignacionFisicaQr[] = [
    "asignado_estanteria",
    "asignado_estanteria",
    "impreso",
    "pendiente_impresion",
  ];

  return productos
    .filter((p) => !p.disabled)
    .slice(0, 4)
    .map((prod, idx) =>
      crearRegistroQrParaProducto({
        producto: prod,
        ubicacionFisica: prod.location || `Estante ${String.fromCharCode(65 + idx)}-0${idx + 1}`,
        lote: `LOTE-2026-0${idx + 1}`,
        generadoPor: "Javier Muñoz Contreras",
        estadoInicial: estadosCiclo[idx % estadosCiclo.length],
        correlativo: 101 + idx,
      })
    );
}

/**
 * Guarda los registros QR en caché local del dispositivo.
 */
export async function guardarRegistrosQrLocal(registros: RegistroQrInsumo[]): Promise<void> {
  await guardarCache<RegistroQrInsumo[]>(CLAVE_CACHE_QR, registros);
}

/**
 * Lee los registros QR previamente guardados en caché local.
 */
export async function leerRegistrosQrLocal(): Promise<RegistroQrInsumo[] | null> {
  const res = await leerCache<RegistroQrInsumo[]>(CLAVE_CACHE_QR);
  if (!res || !Array.isArray(res.datos)) return null;
  return res.datos;
}

/**
 * Genera una matriz booleana determinista de 25×25 con patrones de localización QR estándar
 * (3 buscadores 7×7, separadores, patrones de sincronización y patrón de alineación)
 * y módulos de datos derivados del contenido embebido.
 */
export function generarMatrizQrVisual(contenido: string, tamano = 25): boolean[][] {
  const matriz: boolean[][] = Array.from({ length: tamano }, () =>
    Array.from({ length: tamano }, () => false)
  );
  const reservado: boolean[][] = Array.from({ length: tamano }, () =>
    Array.from({ length: tamano }, () => false)
  );

  // Dibuja un patrón buscador estándar 7×7 más su separador blanco de 1 módulo
  const dibujarBuscador = (filaBase: number, colBase: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = filaBase + r;
        const cc = colBase + c;
        if (rr < 0 || rr >= tamano || cc < 0 || cc >= tamano) continue;
        reservado[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matriz[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matriz[rr][cc] = true;
        } else {
          matriz[rr][cc] = false;
        }
      }
    }
  };

  dibujarBuscador(0, 0);
  dibujarBuscador(0, tamano - 7);
  dibujarBuscador(tamano - 7, 0);

  // Patrones de sincronización (fila 6 y columna 6)
  for (let i = 8; i < tamano - 8; i++) {
    reservado[6][i] = true;
    matriz[6][i] = i % 2 === 0;
    reservado[i][6] = true;
    matriz[i][6] = i % 2 === 0;
  }

  // Patrón de alineación 5×5 en (tamano - 7, tamano - 7)
  const centroAlineacion = tamano - 7;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centroAlineacion + r;
      const cc = centroAlineacion + c;
      reservado[rr][cc] = true;
      matriz[rr][cc] =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }

  // Generador pseudoaleatorio determinista sembrado con el contenido embebido del QR
  let semilla = 2166136261;
  for (let i = 0; i < contenido.length; i++) {
    semilla ^= contenido.charCodeAt(i);
    semilla = Math.imul(semilla, 16777619);
  }
  const siguienteBit = (): boolean => {
    semilla ^= semilla << 13;
    semilla ^= semilla >>> 17;
    semilla ^= semilla << 5;
    return (semilla & 1) === 1;
  };

  for (let r = 0; r < tamano; r++) {
    for (let c = 0; c < tamano; c++) {
      if (!reservado[r][c]) {
        matriz[r][c] = siguienteBit();
      }
    }
  }

  return matriz;
}

/**
 * Genera un documento imprimible con la etiqueta física del código QR (solo navegador Web).
 */
export function imprimirEtiquetaQrWeb(registro: RegistroQrInsumo): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return false;
  }

  const matriz = generarMatrizQrVisual(registro.payloadEmbebido, 25);
  const escala = 6;
  const tamanoSvg = (matriz.length + 2) * escala;
  const rectangulos = matriz
    .flatMap((fila, r) =>
      fila.map((activo, c) =>
        activo
          ? `<rect x="${(c + 1) * escala}" y="${(r + 1) * escala}" width="${escala}" height="${escala}" fill="#111827"/>`
          : ""
      )
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta QR ${registro.codigoQr}</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; padding: 24px; background: #f8fafc; }
    .etiqueta { border: 2px solid #1c1917; border-radius: 10px; padding: 18px; width: 320px; background: #fff; text-align: center; }
    .marca { font-size: 11px; font-weight: bold; color: #b45309; letter-spacing: 1px; margin-bottom: 6px; }
    .codigo { font-size: 13px; font-weight: bold; color: #1c1917; margin-top: 8px; }
    .nombre { font-size: 14px; font-weight: bold; color: #111827; margin: 4px 0; }
    .meta { font-size: 11px; color: #475569; margin: 2px 0; }
    .payload { font-size: 9px; font-family: monospace; color: #64748b; background: #f1f5f9; padding: 6px; border-radius: 6px; margin-top: 10px; word-break: break-all; text-align: left; }
  </style>
</head>
<body>
  <div class="etiqueta">
    <div class="marca">FYAG SERVICIOS INTEGRALES — ETIQUETA BODEGA</div>
    <svg width="${tamanoSvg}" height="${tamanoSvg}" viewBox="0 0 ${tamanoSvg} ${tamanoSvg}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      ${rectangulos}
    </svg>
    <div class="codigo">${registro.codigoQr}</div>
    <div class="nombre">${registro.nombreInsumo}</div>
    <div class="meta"><b>SKU:</b> ${registro.sku} • <b>Unidad:</b> ${registro.unidad}</div>
    <div class="meta"><b>Ubicación Física:</b> ${registro.ubicacionFisica}</div>
    ${registro.lote ? `<div class="meta"><b>Lote:</b> ${registro.lote}</div>` : ""}
    <div class="payload">${registro.payloadEmbebido.replace(/</g, "&lt;")}</div>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const ventana = window.open("", "_blank", "width=460,height=620");
  if (!ventana) return false;
  ventana.document.write(html);
  ventana.document.close();
  return true;
}
