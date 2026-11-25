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
    "impreso",
    "pendiente_impresion",
    "asignado_estanteria",
  ];

  return productos
    .filter((p) => !p.disabled)
    .slice(0, 6)
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
    .etiqueta { border: 2px solid #0f172a; border-radius: 10px; padding: 18px; width: 320px; background: #fff; text-align: center; }
    .marca { font-size: 11px; font-weight: bold; color: #4338ca; letter-spacing: 1px; margin-bottom: 6px; }
    .codigo { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 8px; }
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

/**
 * Exporta o imprime en lote un conjunto de etiquetas QR seleccionadas en una sola hoja PDF imprimible
 * con código QR de alta resolución y texto legible (SKU, nombre, ubicación, unidad y lote).
 */
export function exportarLoteQrPdfWeb(registros: RegistroQrInsumo[]): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined" || registros.length === 0) {
    return false;
  }

  const tarjetasHtml = registros
    .map((reg) => {
      const matriz = generarMatrizQrVisual(reg.payloadEmbebido, 25);
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

      return `
      <div class="etiqueta">
        <div class="cabecera">
          <span class="marca">FYAG BODEGA</span>
          <span class="estado">${reg.estadoAsignacion === "asignado_estanteria" ? "ASIGNADO EN ESTANTE" : "ETIQUETA FÍSICA"}</span>
        </div>
        <div class="cuerpo">
          <div class="qr-box">
            <svg width="${tamanoSvg}" height="${tamanoSvg}" viewBox="0 0 ${tamanoSvg} ${tamanoSvg}" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#ffffff"/>
              ${rectangulos}
            </svg>
          </div>
          <div class="info">
            <div class="sku">${reg.sku}</div>
            <div class="nombre">${reg.nombreInsumo}</div>
            <div class="codigo">${reg.codigoQr}</div>
            <div class="meta"><b>Ubicación:</b> ${reg.ubicacionFisica}</div>
            <div class="meta"><b>Categoría:</b> ${reg.categoria} • <b>Unidad:</b> ${reg.unidad.toUpperCase()}</div>
            ${reg.lote ? `<div class="meta"><b>Lote:</b> ${reg.lote}</div>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  const fechaHoy = new Date().toLocaleDateString("es-CL");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Lote_Etiquetas_QR_FYAG_${registros.length}_items</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; background: #ffffff; color: #0f172a; }
    .encabezado-hoja { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
    .titulo-hoja { font-size: 16px; font-weight: 800; color: #0f172a; }
    .sub-hoja { font-size: 12px; color: #475569; }
    .grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .etiqueta { border: 2px solid #0f172a; border-radius: 10px; padding: 12px; page-break-inside: avoid; background: #ffffff; }
    .cabecera { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
    .marca { font-size: 10px; font-weight: 800; color: #4338ca; letter-spacing: 0.8px; }
    .estado { font-size: 9px; font-weight: 700; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; }
    .cuerpo { display: flex; align-items: center; gap: 12px; }
    .qr-box { border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 4px; background: #fff; flex-shrink: 0; }
    .info { flex: 1; min-width: 0; }
    .sku { font-size: 15px; font-weight: 900; color: #4338ca; font-family: monospace; }
    .nombre { font-size: 13px; font-weight: 800; color: #111827; margin: 3px 0; line-height: 1.25; }
    .codigo { font-size: 10px; font-weight: 700; color: #334155; font-family: monospace; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #1e293b; margin: 2px 0; line-height: 1.3; }
  </style>
</head>
<body>
  <div class="encabezado-hoja">
    <div>
      <div class="titulo-hoja">PLANCHA IMPRIMIBLE DE ETIQUETAS QR — FYAG BODEGA</div>
      <div class="sub-hoja">Lote exportado: ${registros.length} etiqueta(s) • Fecha: ${fechaHoy}</div>
    </div>
  </div>
  <div class="grilla">
    ${tarjetasHtml}
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const ventana = window.open("", "_blank", "width=880,height=760");
  if (!ventana) return false;
  ventana.document.write(html);
  ventana.document.close();
  return true;
}

/**
 * Genera y descarga un único archivo PNG de alta resolución (lámina imprimible en lote)
 * con todas las etiquetas QR seleccionadas y su texto legible usando HTML5 Canvas.
 */
export function descargarLoteQrPngWeb(registros: RegistroQrInsumo[]): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined" || registros.length === 0) {
    return false;
  }

  try {
    const cols = registros.length === 1 ? 1 : 2;
    const rows = Math.ceil(registros.length / cols);
    const cardW = 540;
    const cardH = 250;
    const pad = 24;
    const headerH = 72;

    const canvasW = pad * 2 + cols * cardW + (cols - 1) * pad;
    const canvasH = headerH + pad * 2 + rows * cardH + (rows - 1) * pad;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    // Fondo blanco general de la lámina imprimible
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Encabezado de la lámina
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.fillText(
      `FYAG BODEGA — LOTE DE ${registros.length} ETIQUETA(S) QR IMPRIMIBLES`,
      pad,
      36
    );
    ctx.fillStyle = "#475569";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(
      `Generado el ${new Date().toLocaleDateString("es-CL")} • Alta legibilidad para estantería`,
      pad,
      58
    );
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, headerH);
    ctx.lineTo(canvasW - pad, headerH);
    ctx.stroke();

    registros.forEach((reg, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = pad + col * (cardW + pad);
      const y = headerH + pad + row * (cardH + pad);

      // Marco de la etiqueta
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, cardW, cardH);

      // Franja lateral semántica
      ctx.fillStyle =
        reg.estadoAsignacion === "asignado_estanteria" ? "#16a34a" : "#d97706";
      ctx.fillRect(x, y, 8, cardH);

      // Dibujar matriz QR nítida
      const matriz = generarMatrizQrVisual(reg.payloadEmbebido, 25);
      const modSize = 7;
      const qrBoxSize = (matriz.length + 2) * modSize;
      const qrX = x + 22;
      const qrY = y + Math.floor((cardH - qrBoxSize) / 2);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX, qrY, qrBoxSize, qrBoxSize);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(qrX, qrY, qrBoxSize, qrBoxSize);

      ctx.fillStyle = "#111827";
      for (let r = 0; r < matriz.length; r++) {
        for (let c = 0; c < matriz[r].length; c++) {
          if (matriz[r][c]) {
            ctx.fillRect(
              qrX + (c + 1) * modSize,
              qrY + (r + 1) * modSize,
              modSize,
              modSize
            );
          }
        }
      }

      // Textos de alta legibilidad a la derecha del QR
      const textX = qrX + qrBoxSize + 18;
      const maxTextW = cardW - (textX - x) - 16;

      ctx.fillStyle = "#b45309";
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.fillText("FYAG SERVICIOS INTEGRALES • BODEGA", textX, y + 32, maxTextW);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px monospace";
      ctx.fillText(reg.sku, textX, y + 60, maxTextW);

      ctx.fillStyle = "#111827";
      ctx.font = "bold 16px Arial, sans-serif";
      const nombreCorto =
        reg.nombreInsumo.length > 34
          ? reg.nombreInsumo.slice(0, 34) + "..."
          : reg.nombreInsumo;
      ctx.fillText(nombreCorto, textX, y + 88, maxTextW);

      ctx.fillStyle = "#334155";
      ctx.font = "bold 12px monospace";
      ctx.fillText(reg.codigoQr, textX, y + 114, maxTextW);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px Arial, sans-serif";
      ctx.fillText(`Ubicación: ${reg.ubicacionFisica}`, textX, y + 146, maxTextW);

      ctx.fillStyle = "#334155";
      ctx.font = "13px Arial, sans-serif";
      ctx.fillText(
        `Categoría: ${reg.categoria} • Unidad: ${reg.unidad.toUpperCase()}`,
        textX,
        y + 174,
        maxTextW
      );

      if (reg.lote) {
        ctx.fillText(`Lote: ${reg.lote}`, textX, y + 198, maxTextW);
      }

      ctx.fillStyle =
        reg.estadoAsignacion === "asignado_estanteria" ? "#166534" : "#92400e";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillText(
        reg.estadoAsignacion === "asignado_estanteria"
          ? "✔ PEGADO / ASIGNADO EN ESTANTERÍA"
          : "● PENDIENTE DE PEGADO EN ESTANTERÍA",
        textX,
        y + 226,
        maxTextW
      );
    });

    const dataUrl = canvas.toDataURL("image/png");
    const enlace = document.createElement("a");
    enlace.href = dataUrl;
    enlace.download = `Lote_Etiquetas_QR_FYAG_${registros.length}_items.png`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    return true;
  } catch {
    return false;
  }
}
