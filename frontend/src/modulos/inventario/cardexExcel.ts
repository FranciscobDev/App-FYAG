// Utilidades de cronología, contraste de saldos y exportación a Excel del Cardex (solo lectura)
import { Platform, Share } from "react-native";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { MovimientoCardex, Producto } from "@/nucleo/tipos";

export type RangoFechaCardex = "todos" | "7d" | "30d" | "mes_actual";
export type OrdenCronologicoCardex = "desc" | "asc";

export interface ContrasteSaldoInsumo {
  sku: string;
  nombreInsumo: string;
  unidad: string;
  stockDisponibleCatalogo: number;
  stockComprometidoCatalogo: number;
  existenciaTotalCatalogo: number;
  pmpCatalogo: number;
  ultimoMovimiento: MovimientoCardex;
  saldoUltimaLineaCardex: number;
  pmpUltimaLineaCardex: number;
  diferenciaContraDisponible: number;
  diferenciaContraTotal: number;
  cuadraExacto: boolean;
}

export interface ResultadoExportacionCardex {
  ok: boolean;
  nombreArchivo?: string;
  mensaje: string;
}

/**
 * Parsea fechas del Cardex en formato "DD-MM-YYYY HH:mm", "DD-MM-YYYY" o ISO "YYYY-MM-DD".
 */
export function parsearFechaCardex(fechaTexto?: string | null): Date | null {
  if (!fechaTexto) return null;
  const limpio = fechaTexto.trim();
  if (!limpio) return null;

  // Formato chileno "DD-MM-YYYY" con hora opcional "HH:mm"
  const coincidenciaCl = limpio.match(
    /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (coincidenciaCl) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = coincidenciaCl;
    const fecha = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  // Formato ISO "YYYY-MM-DD" sin hora (interpretado en hora local)
  const coincidenciaIsoDia = limpio.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (coincidenciaIsoDia) {
    const [, yyyy, mm, dd] = coincidenciaIsoDia;
    const fecha = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const fechaGeneral = new Date(limpio);
  return Number.isNaN(fechaGeneral.getTime()) ? null : fechaGeneral;
}

/**
 * Evalúa si un movimiento de Cardex cae dentro del rango de fecha seleccionado.
 */
export function cumpleRangoFechaCardex(
  fechaTexto: string,
  rango: RangoFechaCardex,
  referencia: Date = new Date()
): boolean {
  if (rango === "todos") return true;
  const fechaMov = parsearFechaCardex(fechaTexto);
  if (!fechaMov) return true;

  const inicioHoy = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    23,
    59,
    59,
    999
  );

  if (rango === "mes_actual") {
    return (
      fechaMov.getFullYear() === referencia.getFullYear() &&
      fechaMov.getMonth() === referencia.getMonth()
    );
  }

  const dias = rango === "7d" ? 7 : 30;
  const limiteInferior = new Date(inicioHoy.getTime() - dias * 24 * 60 * 60 * 1000);
  return fechaMov.getTime() >= limiteInferior.getTime();
}

/**
 * Ordena movimientos de Cardex cronológicamente usando la fecha/hora parseada.
 */
export function ordenarCardexCronologico(
  movimientos: MovimientoCardex[],
  direccion: OrdenCronologicoCardex = "desc"
): MovimientoCardex[] {
  return [...movimientos].sort((a, b) => {
    const tiempoA = parsearFechaCardex(a.date)?.getTime() ?? 0;
    const tiempoB = parsearFechaCardex(b.date)?.getTime() ?? 0;
    if (tiempoA === tiempoB) {
      return direccion === "desc"
        ? b.id.localeCompare(a.id)
        : a.id.localeCompare(b.id);
    }
    return direccion === "desc" ? tiempoB - tiempoA : tiempoA - tiempoB;
  });
}

/**
 * Obtiene un mapa SKU -> ID del movimiento más reciente en el Cardex completo.
 */
export function obtenerMapaUltimaLineaPorSku(
  movimientosCompletos: MovimientoCardex[]
): Map<string, MovimientoCardex> {
  const ordenadosDesc = ordenarCardexCronologico(movimientosCompletos, "desc");
  const mapa = new Map<string, MovimientoCardex>();

  for (const mov of ordenadosDesc) {
    const clave = mov.sku.trim().toUpperCase();
    if (!mapa.has(clave)) {
      mapa.set(clave, mov);
    }
  }
  return mapa;
}

/**
 * Contrasta el saldo actual de cada insumo en el catálogo contra la última línea registrada en el Cardex.
 * Permite auditoría SCRUM directa entre existencia actual y trazabilidad cronológica.
 */
export function calcularContrasteSaldoCardex(
  productos: Producto[],
  movimientosCompletos: MovimientoCardex[],
  skusEnVista?: string[]
): ContrasteSaldoInsumo[] {
  const ultimosPorSku = obtenerMapaUltimaLineaPorSku(movimientosCompletos);
  const conjuntoVista = skusEnVista
    ? new Set(skusEnVista.map((s) => s.trim().toUpperCase()))
    : null;

  const resultado: ContrasteSaldoInsumo[] = [];

  ultimosPorSku.forEach((ultimoMov, claveSku) => {
    if (conjuntoVista && !conjuntoVista.has(claveSku)) return;

    const prod = productos.find((p) => p.sku.trim().toUpperCase() === claveSku);
    const disponible = prod ? Number(prod.stock || 0) : 0;
    const comprometido = prod ? Number(prod.committed || 0) : 0;
    const totalFisico = Number((disponible + comprometido).toFixed(3));
    const saldoCardex = Number(ultimoMov.balance || 0);

    const difDisp = Number((disponible - saldoCardex).toFixed(3));
    const difTotal = Number((totalFisico - saldoCardex).toFixed(3));
    // Se considera cuadrado si coincide exactamente con el saldo disponible o con la existencia total (disponible + comprometido)
    const cuadraExacto = Math.abs(difDisp) < 0.001 || Math.abs(difTotal) < 0.001;

    resultado.push({
      sku: prod?.sku || ultimoMov.sku,
      nombreInsumo: prod?.name || ultimoMov.productName,
      unidad: prod?.unit || "un",
      stockDisponibleCatalogo: disponible,
      stockComprometidoCatalogo: comprometido,
      existenciaTotalCatalogo: totalFisico,
      pmpCatalogo: prod ? Number(prod.pmp || prod.unitCost || 0) : Number(ultimoMov.pmp || 0),
      ultimoMovimiento: ultimoMov,
      saldoUltimaLineaCardex: saldoCardex,
      pmpUltimaLineaCardex: Number(ultimoMov.pmp || 0),
      diferenciaContraDisponible: difDisp,
      diferenciaContraTotal: difTotal,
      cuadraExacto,
    });
  });

  return resultado.sort((a, b) => a.sku.localeCompare(b.sku));
}

function escaparHtml(valor: string | number | undefined | null): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Genera el contenido HTML compatible con Microsoft Excel (.xls) incluyendo
 * la tabla cronológica de movimientos y el cuadro de contraste de saldos SCRUM.
 */
function construirContenidoExcelCardex(
  movimientos: MovimientoCardex[],
  contrastes: ContrasteSaldoInsumo[],
  filtrosResumen: string
): string {
  const fechaEmision = new Date().toLocaleString("es-CL", { hour12: false });
  const totalEntradas = movimientos.reduce((acc, m) => acc + Number(m.qtyIn || 0), 0);
  const totalSalidas = movimientos.reduce((acc, m) => acc + Number(m.qtyOut || 0), 0);

  const filasMovimientos = movimientos
    .map(
      (m) => `
      <tr>
        <td>${escaparHtml(m.date)}</td>
        <td><b>${escaparHtml(m.sku)}</b></td>
        <td>${escaparHtml(m.productName)}</td>
        <td>${escaparHtml(m.typeLabel)}</td>
        <td>${escaparHtml(m.reference)}</td>
        <td>${escaparHtml(m.projectName || m.projectCode || "Bodega Central")}</td>
        <td style="text-align:right;color:#15803d;">${m.qtyIn > 0 ? m.qtyIn : 0}</td>
        <td style="text-align:right;color:#b91c1c;">${m.qtyOut > 0 ? m.qtyOut : 0}</td>
        <td style="text-align:right;font-weight:bold;">${m.balance}</td>
        <td style="text-align:right;">${escaparHtml(formatearCLP(m.pmp))}</td>
        <td style="text-align:right;">${escaparHtml(formatearCLP(m.totalValue))}</td>
        <td>${escaparHtml(m.userName || "Sistema")}</td>
        <td>${escaparHtml(m.userRole || "Bodeguero")}</td>
        <td>${escaparHtml(m.userRut || "-")}</td>
      </tr>`
    )
    .join("");

  const filasContraste = contrastes
    .map(
      (c) => `
      <tr>
        <td><b>${escaparHtml(c.sku)}</b></td>
        <td>${escaparHtml(c.nombreInsumo)}</td>
        <td style="text-align:right;">${c.stockDisponibleCatalogo} ${escaparHtml(c.unidad)}</td>
        <td style="text-align:right;">${c.stockComprometidoCatalogo} ${escaparHtml(c.unidad)}</td>
        <td style="text-align:right;"><b>${c.existenciaTotalCatalogo} ${escaparHtml(c.unidad)}</b></td>
        <td style="text-align:right;"><b>${c.saldoUltimaLineaCardex} ${escaparHtml(c.unidad)}</b></td>
        <td>${escaparHtml(c.ultimoMovimiento.date)} (${escaparHtml(c.ultimoMovimiento.reference)})</td>
        <td style="text-align:right;">${escaparHtml(formatearCLP(c.pmpUltimaLineaCardex))}</td>
        <td style="font-weight:bold;color:${c.cuadraExacto ? "#15803d" : "#b91c1c"};">
          ${c.cuadraExacto ? "CUADRA EXACTO" : `DESFASE (${c.diferenciaContraTotal > 0 ? "+" : ""}${c.diferenciaContraTotal})`}
        </td>
      </tr>`
    )
    .join("");

  return `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; }
    h2 { color: #0f172a; margin-bottom: 4px; }
    p { margin: 2px 0 10px 0; color: #475569; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
    th { background-color: #1e1b4b; color: #c7d2fe; font-weight: bold; padding: 6px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 5px 6px; border: 1px solid #cbd5e1; }
    .resumen td { background-color: #eef2ff; font-weight: bold; }
  </style>
</head>
<body>
  <h2>FYAG Servicios Integrales SpA — Cardex de Inventario (Solo Lectura)</h2>
  <p>Emitido el: ${escaparHtml(fechaEmision)} | Filtros aplicados: ${escaparHtml(filtrosResumen)} | Registros: ${movimientos.length}</p>

  <table>
    <thead>
      <tr>
        <th>Fecha / Hora</th>
        <th>SKU</th>
        <th>Insumo</th>
        <th>Tipo de Movimiento</th>
        <th>Referencia</th>
        <th>Proyecto / Destino</th>
        <th>Entrada (+)</th>
        <th>Salida (-)</th>
        <th>Saldo Posterior</th>
        <th>PMP Posterior</th>
        <th>Valor Total</th>
        <th>Responsable</th>
        <th>Rol</th>
        <th>RUT</th>
      </tr>
    </thead>
    <tbody>
      ${filasMovimientos}
      <tr class="resumen">
        <td colspan="6">TOTALES DEL PERÍODO FILTRADO</td>
        <td style="text-align:right;">+${totalEntradas}</td>
        <td style="text-align:right;">-${totalSalidas}</td>
        <td colspan="6">Trazabilidad inmutable de solo lectura</td>
      </tr>
    </tbody>
  </table>

  <h2>Contraste de Saldos: Catálogo Actual vs. Última Línea del Cardex</h2>
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Insumo</th>
        <th>Disponible Catálogo</th>
        <th>Comprometido (H6)</th>
        <th>Existencia Total</th>
        <th>Última Línea Cardex</th>
        <th>Último Movimiento</th>
        <th>PMP Vigente</th>
        <th>Estado Auditoría</th>
      </tr>
    </thead>
    <tbody>
      ${filasContraste}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Exporta los movimientos visibles del Cardex a un archivo Excel (.xls) descargable en Web
 * o compartible en formato tabular en dispositivos móviles.
 */
export async function exportarCardexAExcel(params: {
  movimientos: MovimientoCardex[];
  contrastes: ContrasteSaldoInsumo[];
  filtrosResumen: string;
}): Promise<ResultadoExportacionCardex> {
  const { movimientos, contrastes, filtrosResumen } = params;

  if (movimientos.length === 0) {
    return {
      ok: false,
      mensaje: "No hay movimientos en el Cardex filtrado para exportar a Excel.",
    };
  }

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Cardex_FYAG_${fechaArchivo}.xls`;
  const contenidoExcel = construirContenidoExcelCardex(
    movimientos,
    contrastes,
    filtrosResumen
  );

  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      const blob = new Blob([contenidoExcel], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return {
        ok: true,
        nombreArchivo,
        mensaje: `Archivo Excel "${nombreArchivo}" descargado con ${movimientos.length} movimientos.`,
      };
    } catch {
      return {
        ok: false,
        mensaje: "No fue posible generar la descarga del archivo Excel en el navegador.",
      };
    }
  }

  // Respaldo para plataformas móviles nativas mediante hoja de compartir
  try {
    const lineasCsv = [
      "Fecha;SKU;Insumo;Tipo;Referencia;Proyecto;Entrada;Salida;Saldo Posterior;PMP;Responsable",
      ...movimientos.map(
        (m) =>
          `${formatearFecha(m.date)};${m.sku};${m.productName};${m.typeLabel};${m.reference};${
            m.projectName || m.projectCode || "Bodega Central"
          };${m.qtyIn};${m.qtyOut};${m.balance};${m.pmp};${m.userName || "Sistema"}`
      ),
    ].join("\n");

    await Share.share({
      title: nombreArchivo,
      message: lineasCsv,
    });

    return {
      ok: true,
      nombreArchivo,
      mensaje: `Cardex compartido (${movimientos.length} movimientos) listo para abrir en Excel.`,
    };
  } catch {
    return {
      ok: false,
      mensaje: "Exportación cancelada o no disponible en este dispositivo.",
    };
  }
}
