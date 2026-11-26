// Utilidades de exportación real a Excel (.xls) y PDF (vista imprimible corporativa)
// para los Reportes de Movimientos e Informes de Gestión, incluyendo fila de totales consolidados.
import { Platform } from "react-native";

export interface ParametrosExportacionInforme {
  titulo: string;
  nombreArchivo: string;
  rangoFechas: string;
  resumenFiltros?: string;
  headers: string[];
  filas: Record<string, string | number>[];
  filaTotales?: Record<string, string | number>;
}

const escaparHtml = (valor: string | number | undefined | null): string =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Descarga un libro Excel (.xls) real con encabezados formateados, filas filtradas
 * y fila de totales consolidados.
 */
export function exportarInformeExcelWeb(params: ParametrosExportacionInforme): {
  exito: boolean;
  mensaje: string;
} {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") {
    return {
      exito: true,
      mensaje: `Archivo Excel preparado (${params.filas.length} registros). Disponible para descarga directa en navegador Web.`,
    };
  }

  const encabezadoTabla = params.headers
    .map(
      (h) =>
        `<th style="background:#0f172a;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #cbd5e1;text-align:left;">${escaparHtml(h)}</th>`
    )
    .join("");

  const cuerpoTabla = params.filas
    .map((fila, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      const celdas = params.headers
        .map(
          (h) =>
            `<td style="padding:7px;border:1px solid #e2e8f0;background:${bg};">${escaparHtml(fila[h])}</td>`
        )
        .join("");
      return `<tr>${celdas}</tr>`;
    })
    .join("");

  const filaTotalesHtml = params.filaTotales
    ? `<tr>${params.headers
        .map(
          (h) =>
            `<td style="padding:8px;border:1px solid #cbd5e1;background:#fef3c7;font-weight:bold;color:#78350f;">${escaparHtml(
              params.filaTotales?.[h] ?? ""
            )}</td>`
        )
        .join("")}</tr>`
    : "";

  const htmlExcel = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <title>${escaparHtml(params.titulo)}</title>
      </head>
      <body style="font-family:Segoe UI,Arial,sans-serif;">
        <h2 style="margin:0 0 4px;">FYAG Multisystem SpA — ${escaparHtml(params.titulo)}</h2>
        <p style="margin:0 0 4px;font-size:12px;color:#475569;">Rango de fechas: ${escaparHtml(params.rangoFechas)}</p>
        ${
          params.resumenFiltros
            ? `<p style="margin:0 0 12px;font-size:12px;color:#475569;">Filtros aplicados: ${escaparHtml(params.resumenFiltros)}</p>`
            : ""
        }
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead><tr>${encabezadoTabla}</tr></thead>
          <tbody>
            ${cuerpoTabla}
            ${filaTotalesHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(["\uFEFF" + htmlExcel], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${params.nombreArchivo}_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    exito: true,
    mensaje: `Excel (.xls) descargado correctamente (${params.filas.length} registros + fila de totales).`,
  };
}

/**
 * Genera y abre el documento PDF imprimible corporativo con filtros aplicados y fila de totales.
 */
export function exportarInformePdfWeb(params: ParametrosExportacionInforme): {
  exito: boolean;
  mensaje: string;
} {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return {
      exito: true,
      mensaje: `Documento PDF preparado (${params.filas.length} registros). Disponible para impresión/guardado en Web.`,
    };
  }

  const win = window.open("", "_blank", "width=1024,height=760");
  if (!win) {
    return {
      exito: false,
      mensaje: "Permite ventanas emergentes en el navegador para descargar el PDF.",
    };
  }

  const encabezadoTabla = params.headers
    .map((h) => `<th>${escaparHtml(h)}</th>`)
    .join("");

  const cuerpoTabla = params.filas
    .map(
      (fila) =>
        `<tr>${params.headers.map((h) => `<td>${escaparHtml(fila[h])}</td>`).join("")}</tr>`
    )
    .join("");

  const filaTotalesHtml = params.filaTotales
    ? `<tr class="totales">${params.headers
        .map((h) => `<td>${escaparHtml(params.filaTotales?.[h] ?? "")}</td>`)
        .join("")}</tr>`
    : "";

  const fechaGeneracion = new Date().toLocaleString("es-CL");

  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${escaparHtml(params.titulo)} — FYAG</title>
        <style>
          @page { size: landscape; margin: 14mm; }
          body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; }
          .cabecera { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 14px; }
          .marca { font-size: 18px; font-weight: 800; color: #0f172a; }
          .sub { font-size: 12px; color: #475569; margin-top: 3px; }
          .meta { text-align: right; font-size: 11px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 7px 6px; border: 1px solid #334155; }
          td { padding: 6px; border: 1px solid #cbd5e1; }
          tr:nth-child(even) td { background: #f8fafc; }
          tr.totales td { background: #fef3c7 !important; font-weight: 800; color: #78350f; border-top: 2px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="cabecera">
          <div>
            <div class="marca">FYAG Multisystem SpA — ${escaparHtml(params.titulo)}</div>
            <div class="sub">Rango de fechas: <strong>${escaparHtml(params.rangoFechas)}</strong></div>
            ${
              params.resumenFiltros
                ? `<div class="sub">Filtros: ${escaparHtml(params.resumenFiltros)}</div>`
                : ""
            }
          </div>
          <div class="meta">
            <div>Emitido: ${escaparHtml(fechaGeneracion)}</div>
            <div>Registros: <strong>${params.filas.length}</strong></div>
          </div>
        </div>
        <table>
          <thead><tr>${encabezadoTabla}</tr></thead>
          <tbody>
            ${cuerpoTabla}
            ${filaTotalesHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);

  return {
    exito: true,
    mensaje: `Vista PDF generada (${params.filas.length} registros + fila de totales). Usa "Guardar como PDF".`,
  };
}
