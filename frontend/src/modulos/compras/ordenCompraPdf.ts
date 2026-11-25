import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { EstadoOrdenCompra, OrdenCompra } from "@/nucleo/tipos";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";

export interface ResultadoPdfOrdenCompra {
  ok: boolean;
  mensaje: string;
  modo: "impresion" | "archivo" | "error";
}

const ETIQUETAS_ESTADO_OC: Record<EstadoOrdenCompra, string> = {
  borrador: "BORRADOR",
  enviada: "APROBADA Y ENVIADA",
  recibida_parcial: "RECEPCIÓN PARCIAL",
  recibida: "RECIBIDA COMPLETA",
  cerrada: "CERRADA",
  anulada: "ANULADA",
};

/**
 * Escapa caracteres especiales HTML para evitar rupturas de formato al insertar textos dinámicos.
 */
const escaparHtml = (valor: string): string =>
  valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Construye el documento HTML corporativo de la Orden de Compra listo para imprimir o guardar como PDF.
 */
export const generarHtmlOrdenCompra = (orden: OrdenCompra): string => {
  const filasItems = orden.items
    .map((item) => {
      const totalLinea = item.quantity * item.unitPrice;
      return `
        <tr>
          <td class="mono">${escaparHtml(item.sku)}</td>
          <td>${escaparHtml(item.name)}</td>
          <td class="centro">${escaparHtml(item.unit)}</td>
          <td class="derecha">${item.quantity}</td>
          <td class="derecha">${escaparHtml(formatearCLP(item.unitPrice))}</td>
          <td class="derecha negrita">${escaparHtml(formatearCLP(totalLinea))}</td>
        </tr>
      `;
    })
    .join("");

  const etiquetaEstado = ETIQUETAS_ESTADO_OC[orden.status] || orden.status.toUpperCase();
  const bloqueObservaciones = orden.notes
    ? `<div class="caja-notas">
        <span class="etiqueta-seccion">OBSERVACIONES / CONDICIONES DE DESPACHO</span>
        <p>${escaparHtml(orden.notes)}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orden de Compra ${escaparHtml(orden.code)} - FYAG MULTISYSTEM SpA</title>
  <style>
    @page {
      size: A4;
      margin: 16mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background-color: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .hoja {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 28px;
    }
    .encabezado {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    .empresa-titulo {
      font-size: 18px;
      font-weight: 900;
      color: #4338ca;
      margin: 0 0 4px 0;
    }
    .empresa-sub {
      font-size: 12px;
      color: #334155;
      margin: 2px 0;
    }
    .folio-bloque {
      text-align: right;
    }
    .doc-tipo {
      font-size: 14px;
      font-weight: 800;
      color: #1e1b4b;
      letter-spacing: 0.5px;
    }
    .doc-codigo {
      font-size: 17px;
      font-weight: 900;
      color: #4f46e5;
      margin: 4px 0;
    }
    .estado-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background-color: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
    }
    .caja-proveedor {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .etiqueta-seccion {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
    }
    .proveedor-nombre {
      font-size: 15px;
      font-weight: 700;
      color: #1e1b4b;
      margin: 0;
    }
    .proveedor-meta {
      font-size: 12px;
      color: #334155;
      margin: 3px 0 0 0;
    }
    .caja-notas {
      background-color: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .caja-notas p {
      margin: 0;
      font-size: 12px;
      color: #312e81;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 18px;
    }
    th {
      background-color: #1e1b4b;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
    }
    td {
      font-size: 12px;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #334155;
      font-size: 11px;
    }
    .centro { text-align: center; }
    .derecha { text-align: right; }
    .negrita { font-weight: 700; }
    .totales-contenedor {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .totales-tabla {
      width: 280px;
      border-top: 2px solid #cbd5e1;
      padding-top: 10px;
    }
    .total-fila {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #334155;
      margin-bottom: 6px;
    }
    .total-final {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 6px;
      font-size: 15px;
      font-weight: 900;
      color: #4338ca;
    }
    .firmas {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-top: 44px;
      padding-top: 10px;
    }
    .firma-bloque {
      flex: 1;
      border-top: 1px solid #6b7280;
      padding-top: 6px;
      text-align: center;
      font-size: 11px;
      color: #4b5563;
    }
    @media print {
      body { padding: 0; }
      .hoja { border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="hoja">
    <div class="encabezado">
      <div>
        <h1 class="empresa-titulo">FYAG MULTISYSTEM SpA</h1>
        <p class="empresa-sub">RUT: 76.982.341-K · Giro: Obras e Instalaciones</p>
        <p class="empresa-sub">Av. El Salto 4001, Huechuraba, Santiago</p>
        <p class="empresa-sub">Fono: +56 2 2890 4100 · compras@fyag.cl</p>
      </div>
      <div class="folio-bloque">
        <div class="doc-tipo">ORDEN DE COMPRA</div>
        <div class="doc-codigo">${escaparHtml(orden.code)}</div>
        <div class="empresa-sub">Emisión: ${escaparHtml(formatearFecha(orden.date))}</div>
        <div class="empresa-sub">Entrega Esperada: ${escaparHtml(formatearFecha(orden.expectedDate))}</div>
        <span class="estado-pill">${escaparHtml(etiquetaEstado)}</span>
      </div>
    </div>

    <div class="caja-proveedor">
      <span class="etiqueta-seccion">PROVEEDOR ADJUDICADO</span>
      <p class="proveedor-nombre">${escaparHtml(orden.supplier)}</p>
      <p class="proveedor-meta">RUT: ${escaparHtml(orden.supplierRut || "Por confirmar")} · Ítems: ${orden.itemsCount}</p>
    </div>

    ${bloqueObservaciones}

    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Insumo / Descripción</th>
          <th class="centro">Unidad</th>
          <th class="derecha">Cant.</th>
          <th class="derecha">Unitario</th>
          <th class="derecha">Total Línea</th>
        </tr>
      </thead>
      <tbody>
        ${filasItems}
      </tbody>
    </table>

    <div class="totales-contenedor">
      <div class="totales-tabla">
        <div class="total-fila">
          <span>Subtotal Neto</span>
          <span>${escaparHtml(formatearCLP(orden.subtotal))}</span>
        </div>
        <div class="total-fila">
          <span>IVA (19%)</span>
          <span>${escaparHtml(formatearCLP(orden.iva))}</span>
        </div>
        <div class="total-fila total-final">
          <span>TOTAL ORDEN</span>
          <span>${escaparHtml(formatearCLP(orden.total))}</span>
        </div>
      </div>
    </div>

    <div class="firmas">
      <div class="firma-bloque">Autorizado por Administración · FYAG Multisystem SpA</div>
      <div class="firma-bloque">Recepción Conforme Bodega · Firma, Fecha y RUT</div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Abre la vista de impresión/PDF corporativo en navegador web o guarda el documento en el dispositivo móvil.
 */
export async function descargarPdfOrdenCompra(
  orden: OrdenCompra
): Promise<ResultadoPdfOrdenCompra> {
  const html = generarHtmlOrdenCompra(orden);
  const nombreArchivo = `${orden.code.replace(/[^a-zA-Z0-9_-]/g, "_")}_FYAG.html`;

  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined") {
        const ventana = window.open("", "_blank", "width=920,height=740");
        if (ventana) {
          ventana.document.open();
          ventana.document.write(html);
          ventana.document.close();
          setTimeout(() => {
            ventana.focus();
            ventana.print();
          }, 250);
          return {
            ok: true,
            mensaje: `Documento corporativo ${orden.code} listo para imprimir o guardar como PDF.`,
            modo: "impresion",
          };
        }

        // Respaldo si el navegador bloqueó ventanas emergentes: descarga archivo HTML imprimible
        if (typeof document !== "undefined" && typeof Blob !== "undefined") {
          const blob = new Blob([html], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement("a");
          enlace.href = url;
          enlace.download = nombreArchivo;
          document.body.appendChild(enlace);
          enlace.click();
          document.body.removeChild(enlace);
          URL.revokeObjectURL(url);
          return {
            ok: true,
            mensaje: `Documento corporativo ${orden.code} descargado como respaldo HTML imprimible.`,
            modo: "archivo",
          };
        }
      }
    } catch {
      return {
        ok: false,
        mensaje: `No fue posible generar la descarga de ${orden.code} en este navegador.`,
        modo: "error",
      };
    }
  }

  // En dispositivos móviles guarda el documento corporativo en la carpeta local de documentos
  try {
    const archivo = new File(Paths.document, nombreArchivo);
    await archivo.write(html);
    return {
      ok: true,
      mensaje: `Documento corporativo ${orden.code} guardado localmente (${nombreArchivo}).`,
      modo: "archivo",
    };
  } catch {
    return {
      ok: false,
      mensaje: `No se pudo guardar el documento de la orden ${orden.code} en el dispositivo.`,
      modo: "error",
    };
  }
}
