import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { SolicitudMaterial } from "@/nucleo/tipos";
import { formatearFecha } from "@/nucleo/formato";

export interface ResultadoPdfComprobante {
  ok: boolean;
  mensaje: string;
  modo: "impresion" | "archivo" | "error";
}

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
 * Construye el documento HTML corporativo del comprobante numerado de solicitud aprobada.
 */
export const generarHtmlComprobanteSolicitud = (solicitud: SolicitudMaterial): string => {
  const numeroComprobante = solicitud.receiptNumber || solicitud.code;
  const filasItems = solicitud.items
    .map(
      (item, indice) => `
      <tr>
        <td class="centro">${indice + 1}</td>
        <td class="mono">${escaparHtml(item.sku)}</td>
        <td>${escaparHtml(item.name)}</td>
        <td class="derecha negrita">${item.quantity}</td>
        <td class="derecha">${item.deliveredQuantity ?? 0}</td>
        <td class="centro">${escaparHtml(item.unit)}</td>
      </tr>
    `
    )
    .join("");

  const bloqueNota = solicitud.comment
    ? `<div class="caja-notas">
        <span class="etiqueta-seccion">OBSERVACIONES DE LA SOLICITUD</span>
        <p>${escaparHtml(solicitud.comment)}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comprobante ${escaparHtml(numeroComprobante)} - FYAG MULTISYSTEM SpA</title>
  <style>
    @page {
      size: A4;
      margin: 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1c1917;
      background-color: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .hoja {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #d6d3d1;
      border-radius: 8px;
      padding: 28px;
    }
    .encabezado {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #d97706;
      padding-bottom: 16px;
      margin-bottom: 18px;
      gap: 16px;
    }
    .empresa-titulo {
      font-size: 18px;
      font-weight: 900;
      color: #b45309;
      margin: 0 0 4px 0;
    }
    .empresa-sub {
      font-size: 12px;
      color: #44403c;
      margin: 2px 0;
    }
    .folio-bloque {
      text-align: right;
      border: 1.5px solid #d97706;
      background-color: #fef3c7;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .doc-tipo {
      font-size: 11px;
      font-weight: 800;
      color: #78350f;
      letter-spacing: 0.5px;
    }
    .doc-numero {
      font-size: 18px;
      font-weight: 900;
      color: #b45309;
      margin: 4px 0;
    }
    .estado-pill {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background-color: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .grilla-datos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .caja-dato {
      background-color: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .etiqueta-seccion {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #78716c;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .valor-principal {
      font-size: 13px;
      font-weight: 700;
      color: #1c1917;
      margin: 0;
    }
    .valor-secundario {
      font-size: 12px;
      color: #44403c;
      margin: 2px 0 0 0;
    }
    .caja-notas {
      background-color: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .caja-notas p {
      margin: 0;
      font-size: 12px;
      color: #78350f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 18px;
    }
    th {
      background-color: #1c1917;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
    }
    td {
      font-size: 12px;
      padding: 8px 10px;
      border-bottom: 1px solid #e7e5e4;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #44403c;
      font-size: 11px;
    }
    .centro { text-align: center; }
    .derecha { text-align: right; }
    .negrita { font-weight: 700; }
    .aviso-notificacion {
      background-color: #dcfce7;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      color: #166534;
      font-weight: 600;
      margin-bottom: 18px;
    }
    .firmas {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 40px;
      padding-top: 10px;
    }
    .firma-bloque {
      flex: 1;
      border-top: 1px solid #78716c;
      padding-top: 6px;
      text-align: center;
      font-size: 11px;
      color: #44403c;
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
        <p class="empresa-sub">Solicitud Asociada: ${escaparHtml(solicitud.code)}</p>
      </div>
      <div class="folio-bloque">
        <div class="doc-tipo">COMPROBANTE DE APROBACIÓN</div>
        <div class="doc-numero">N° ${escaparHtml(numeroComprobante)}</div>
        <span class="estado-pill">${escaparHtml(solicitud.status.toUpperCase())}</span>
      </div>
    </div>

    <div class="grilla-datos">
      <div class="caja-dato">
        <span class="etiqueta-seccion">PROYECTO / OBRA DESTINO</span>
        <p class="valor-principal">${escaparHtml(solicitud.projectName)}</p>
        <p class="valor-secundario">Código: ${escaparHtml(solicitud.projectCode)} · Urgencia: ${escaparHtml(solicitud.urgency.toUpperCase())}</p>
      </div>
      <div class="caja-dato">
        <span class="etiqueta-seccion">SOLICITANTE EN BODEGA / FAENA</span>
        <p class="valor-principal">${escaparHtml(solicitud.technicianName)}</p>
        <p class="valor-secundario">Fecha Solicitud: ${escaparHtml(formatearFecha(solicitud.date))}</p>
      </div>
      <div class="caja-dato">
        <span class="etiqueta-seccion">APROBADO POR ADMINISTRACIÓN</span>
        <p class="valor-principal">${escaparHtml(solicitud.approvedBy || "Administración FYAG")}</p>
        <p class="valor-secundario">Fecha Resolución: ${escaparHtml(solicitud.approvedAt || formatearFecha(solicitud.date))}</p>
      </div>
      <div class="caja-dato">
        <span class="etiqueta-seccion">RESUMEN DE ENTREGA</span>
        <p class="valor-principal">${solicitud.items.length} ítem(s) autorizados</p>
        <p class="valor-secundario">Válido para egreso físico en Bodega Central</p>
      </div>
    </div>

    ${bloqueNota}

    <table>
      <thead>
        <tr>
          <th class="centro">#</th>
          <th>SKU</th>
          <th>Insumo / Material</th>
          <th class="derecha">Cant. Aprobada</th>
          <th class="derecha">Entregado</th>
          <th class="centro">Unidad</th>
        </tr>
      </thead>
      <tbody>
        ${filasItems}
      </tbody>
    </table>

    <div class="aviso-notificacion">
      Resultado notificado al solicitante (${escaparHtml(solicitud.technicianName)}) con comprobante N° ${escaparHtml(numeroComprobante)}.
    </div>

    <div class="firmas">
      <div class="firma-bloque">Autoriza Administración · ${escaparHtml(solicitud.approvedBy || "FYAG")}</div>
      <div class="firma-bloque">Despacho Bodega Central · Firma y Hora</div>
      <div class="firma-bloque">Recibe Conforme · ${escaparHtml(solicitud.technicianName)}</div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Abre la vista de impresión/PDF del comprobante en navegador web o guarda el archivo en dispositivo móvil.
 */
export async function descargarComprobanteSolicitud(
  solicitud: SolicitudMaterial
): Promise<ResultadoPdfComprobante> {
  const html = generarHtmlComprobanteSolicitud(solicitud);
  const numeroComprobante = (solicitud.receiptNumber || solicitud.code).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  const nombreArchivo = `${numeroComprobante}_FYAG.html`;

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
            mensaje: `Comprobante ${solicitud.receiptNumber || solicitud.code} abierto para imprimir o guardar en PDF.`,
            modo: "impresion",
          };
        }

        // Respaldo si el navegador bloqueó ventanas emergentes
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
            mensaje: `Comprobante ${solicitud.receiptNumber || solicitud.code} descargado como archivo HTML imprimible.`,
            modo: "archivo",
          };
        }
      }
    } catch {
      return {
        ok: false,
        mensaje: "No fue posible imprimir o descargar el comprobante en este navegador.",
        modo: "error",
      };
    }
  }

  // En dispositivos móviles persiste el comprobante en la carpeta local de documentos
  try {
    const archivo = new File(Paths.document, nombreArchivo);
    await archivo.write(html);
    return {
      ok: true,
      mensaje: `Comprobante ${solicitud.receiptNumber || solicitud.code} guardado localmente (${nombreArchivo}).`,
      modo: "archivo",
    };
  } catch {
    return {
      ok: false,
      mensaje: "No se pudo guardar el comprobante en el dispositivo.",
      modo: "error",
    };
  }
}
