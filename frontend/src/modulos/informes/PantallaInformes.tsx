import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  BotonExportar,
  CampoBusqueda,
  ContenedorEstadoPantalla,
  EncabezadoPagina,
  Insignia,
  NotificacionFlotante,
  Tarjeta,
} from "@/componentes/comunes";
import { Selector, OpcionSelector } from "@/componentes/formularios/Selector";
import { estilos } from "./estilos";
import {
  SeccionInformeGastos,
  SeccionInformeInventario,
  SeccionInformeMateriales,
  SeccionInformeMermas,
  SeccionInformeMovimientos,
  SeccionInformeProyectos,
} from "./componentes";

export type PestanaInforme =
  | "movimientos"
  | "inventario"
  | "proyectos"
  | "materiales"
  | "gastos"
  | "mermas";

type PeriodFilter = "30dias" | "7dias" | "mes_actual" | "todo";

export const PantallaInformes: React.FC = () => {
  const { width } = useWindowDimensions();
  const esMobile = width < 768;

  const {
    productos,
    proyectos,
    cardex,
    solicitudesMaterial,
    facturasCompra,
    registrosMerma,
  } = usarAplicacion();

  const [activoPestana, establecerActivoPestana] = useState<PestanaInforme>("movimientos");

  // Filtros globales y contextuales
  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [period, establecerPeriod] = useState<PeriodFilter>("todo");
  const [seleccionadoProyectoCodigo, establecerSeleccionadoProyectoCodigo] = useState<string>("todos");
  const [seleccionadoMovementTipo, establecerSeleccionadoMovementTipo] = useState<string>("todos");
  const [seleccionadoCategoria, establecerSeleccionadoCategoria] = useState<string>("todas");
  const [seleccionadoExistenciaEstado, establecerSeleccionadoExistenciaEstado] = useState<string>("todos");
  const [seleccionadoMermaMotivo, establecerSeleccionadoMermaMotivo] = useState<string>("todos");

  // Modo de vista: Tarjetas o Tabla
  const [vistaModo, establecerVistaModo] = useState<"auto" | "cards" | "table">("cards");
  const effectiveVistaModo = vistaModo === "auto" ? (esMobile ? "cards" : "table") : vistaModo;

  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // Helper de costo unitario real (PMP con respaldo en unitCost para evitar $0)
  const obtenerCostoUnitarioProducto = (p?: any): number => {
    if (!p) return 0;
    const pmp = Number(p.pmp || 0);
    if (pmp > 0) return pmp;
    return Number(p.unitCost || 0);
  };

  // Helper para validar fechas en períodos
  const esWithinPeriod = (dateStr: string) => {
    if (period === "todo") return true;
    const now = new Date();
    const elementoFecha = new Date(dateStr);
    if (isNaN(elementoFecha.getTime())) return true;

    if (period === "7dias") {
      const diferenciaDias = (now.getTime() - elementoFecha.getTime()) / (1000 * 3600 * 24);
      return diferenciaDias <= 7 && diferenciaDias >= -1;
    }
    if (period === "30dias") {
      const diferenciaDias = (now.getTime() - elementoFecha.getTime()) / (1000 * 3600 * 24);
      return diferenciaDias <= 30 && diferenciaDias >= -1;
    }
    if (period === "mes_actual") {
      return (
        elementoFecha.getMonth() === now.getMonth() &&
        elementoFecha.getFullYear() === now.getFullYear()
      );
    }
    return true;
  };

  // =========================================================================
  // 1. REPORTE DE MOVIMIENTOS (CARDEX TRAZABILIDAD)
  // =========================================================================
  const filtradoCardex = useMemo(() => {
    return cardex.filter((item) => {
      const coincidenciasPeriod = esWithinPeriod(item.date);
      const coincidenciasTipo =
        seleccionadoMovementTipo === "todos" || item.type === seleccionadoMovementTipo;
      const coincidenciasProyecto =
        seleccionadoProyectoCodigo === "todos" ||
        item.projectCode === seleccionadoProyectoCodigo ||
        (item.projectName && item.projectName.includes(seleccionadoProyectoCodigo));
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        item.sku.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        (item.projectName && item.projectName.toLowerCase().includes(q));

      return coincidenciasPeriod && coincidenciasTipo && coincidenciasProyecto && coincidenciasQuery;
    });
  }, [cardex, period, seleccionadoMovementTipo, seleccionadoProyectoCodigo, buscarQuery]);

  const cardexTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalValor = 0;
    let valorEntradas = 0;
    let valorSalidas = 0;
    filtradoCardex.forEach((c) => {
      const qIn = Number(c.qtyIn || 0);
      const qOut = Number(c.qtyOut || 0);
      const val = Number(c.totalValue || 0);
      totalIn += qIn;
      totalOut += qOut;
      totalValor += val;
      if (qIn > 0) valorEntradas += val;
      if (qOut > 0) valorSalidas += val;
    });
    return {
      totalIn,
      totalOut,
      totalValue: totalValor,
      valorEntradas,
      valorSalidas,
      count: filtradoCardex.length,
    };
  }, [filtradoCardex]);

  // =========================================================================
  // 2. INVENTARIO & STOCK VALORIZADO (CON RESPALDO PMP / UNITCOST)
  // =========================================================================
  const filtradoProductos = useMemo(() => {
    return productos.filter((p) => {
      if (p.disabled) return false;
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q);
      const coincidenciasCategoria =
        seleccionadoCategoria === "todas" || p.category === seleccionadoCategoria;

      let coincidenciasExistencia = true;
      if (seleccionadoExistenciaEstado === "bajo") {
        coincidenciasExistencia = p.stock <= p.minStock && p.stock > 0;
      } else if (seleccionadoExistenciaEstado === "agotado") {
        coincidenciasExistencia = p.stock === 0;
      } else if (seleccionadoExistenciaEstado === "normal") {
        coincidenciasExistencia = p.stock > p.minStock;
      }

      return coincidenciasQuery && coincidenciasCategoria && coincidenciasExistencia;
    });
  }, [productos, buscarQuery, seleccionadoCategoria, seleccionadoExistenciaEstado]);

  const inventarioTotals = useMemo(() => {
    let totalUnidades = 0;
    let totalValuation = 0;
    let lowExistenciaConteo = 0;
    let outExistenciaConteo = 0;
    let normalExistenciaConteo = 0;

    filtradoProductos.forEach((p) => {
      const costoUnit = obtenerCostoUnitarioProducto(p);
      totalUnidades += p.stock;
      totalValuation += p.stock * costoUnit;
      if (p.stock === 0) outExistenciaConteo++;
      else if (p.stock <= p.minStock) lowExistenciaConteo++;
      else normalExistenciaConteo++;
    });

    return {
      totalUnits: totalUnidades,
      totalValuation: Math.round(totalValuation),
      lowStockCount: lowExistenciaConteo,
      outStockCount: outExistenciaConteo,
      normalStockCount: normalExistenciaConteo,
      count: filtradoProductos.length,
    };
  }, [filtradoProductos]);

  // =========================================================================
  // 3. ESTADO FINANCIERO DE PROYECTOS Y OBRAS
  // =========================================================================
  const filtradoProyectos = useMemo(() => {
    return proyectos.filter((p) => {
      if (seleccionadoProyectoCodigo !== "todos" && p.code !== seleccionadoProyectoCodigo) {
        return false;
      }
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.client || "").toLowerCase().includes(q);
      return coincidenciasQuery;
    });
  }, [proyectos, buscarQuery, seleccionadoProyectoCodigo]);

  const proyectosTotals = useMemo(() => {
    let totalPresupuesto = 0;
    let totalCostoReal = 0;
    let totalCostoMateriales = 0;
    let totalCostoHoras = 0;
    let conSobrecosto = 0;
    filtradoProyectos.forEach((p) => {
      totalPresupuesto += Number(p.budget || 0);
      totalCostoReal += Number(p.costReal || 0);
      totalCostoMateriales += Number(p.costRealMaterials || 0);
      totalCostoHoras += Number(p.costRealHours || 0);
      if (p.costReal > p.budget && p.budget > 0) conSobrecosto++;
    });
    const totalMargen = totalPresupuesto - totalCostoReal;
    const pctMargen =
      totalPresupuesto > 0 ? Math.round((totalMargen / totalPresupuesto) * 100) : 0;
    return {
      totalBudget: Math.round(totalPresupuesto),
      totalCostReal: Math.round(totalCostoReal),
      totalCostMaterials: Math.round(totalCostoMateriales),
      totalCostHours: Math.round(totalCostoHoras),
      totalMargin: Math.round(totalMargen),
      pctMargen,
      conSobrecosto,
      count: filtradoProyectos.length,
    };
  }, [filtradoProyectos]);

  // =========================================================================
  // 4. MATERIALES ASIGNADOS A PROYECTOS (FAENAS) CON VALORIZACIÓN REAL
  // =========================================================================
  const asignadoMateriales = useMemo(() => {
    const lista: Array<{
      id: string;
      requestId: string;
      projectId: string;
      projectName: string;
      technicianRut: string;
      date: string;
      sku: string;
      productName: string;
      quantityRequested: number;
      quantityDelivered: number;
      estimatedCost: number;
      status: string;
    }> = [];

    solicitudesMaterial.forEach((req) => {
      if (!esWithinPeriod(req.date)) return;
      if (seleccionadoProyectoCodigo !== "todos" && req.projectCode !== seleccionadoProyectoCodigo) {
        return;
      }

      const proyectoNombre = `${req.projectCode} - ${req.projectName}`;

      req.items.forEach((item) => {
        const producto = productos.find((p) => p.sku === item.sku);
        const productoNombre = producto ? producto.name : item.sku;
        const costoUnit = obtenerCostoUnitarioProducto(producto) || 4500;
        const q = buscarQuery.toLowerCase().trim();

        if (
          !q ||
          item.sku.toLowerCase().includes(q) ||
          productoNombre.toLowerCase().includes(q) ||
          proyectoNombre.toLowerCase().includes(q)
        ) {
          const cantBase =
            item.deliveredQuantity && item.deliveredQuantity > 0
              ? item.deliveredQuantity
              : item.quantity;
          lista.push({
            id: `${req.id}_${item.sku}`,
            requestId: req.code || req.id,
            projectId: req.projectId,
            projectName: proyectoNombre,
            technicianRut: req.technicianName || req.technicianRut,
            date: req.date,
            sku: item.sku,
            productName: productoNombre,
            quantityRequested: item.quantity,
            quantityDelivered: item.deliveredQuantity || 0,
            estimatedCost: Math.round(cantBase * costoUnit),
            status: req.status,
          });
        }
      });
    });

    return lista;
  }, [solicitudesMaterial, productos, period, seleccionadoProyectoCodigo, buscarQuery]);

  const asignadoMaterialesTotals = useMemo(() => {
    let totalSolicitud = 0;
    let totalDeliv = 0;
    let totalVal = 0;
    asignadoMateriales.forEach((m) => {
      totalSolicitud += m.quantityRequested;
      totalDeliv += m.quantityDelivered;
      totalVal += m.estimatedCost;
    });
    const tasaCumplimiento =
      totalSolicitud > 0 ? Math.min(100, Math.round((totalDeliv / totalSolicitud) * 100)) : 100;
    return {
      totalReq: totalSolicitud,
      totalDeliv,
      totalVal: Math.round(totalVal),
      tasaCumplimiento,
      count: asignadoMateriales.length,
    };
  }, [asignadoMateriales]);

  // =========================================================================
  // 5. GASTOS Y COMPRAS EN STOCK DEL PERÍODO
  // =========================================================================
  const filtradoPurchases = useMemo(() => {
    return facturasCompra.filter((inv) => {
      const coincidenciasPeriod = esWithinPeriod(inv.date);
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q) ||
        (inv.orderCode || "").toLowerCase().includes(q);

      return coincidenciasPeriod && coincidenciasQuery;
    });
  }, [facturasCompra, period, buscarQuery]);

  const purchasesTotals = useMemo(() => {
    let totalNeto = 0;
    let totalVat = 0;
    let totalFinal = 0;
    let totalDescuentos = 0;
    let conformesCount = 0;
    filtradoPurchases.forEach((inv) => {
      totalNeto += Number(inv.subtotalNet || 0);
      totalVat += Number(inv.iva || 0);
      totalFinal += Number(inv.total || 0);
      totalDescuentos += Number(inv.totalDiscounts || 0);
      if (inv.status === "recepcion_conforme" && !inv.hasReceptionDiscrepancy) {
        conformesCount++;
      }
    });
    return {
      totalNet: Math.round(totalNeto),
      totalVat: Math.round(totalVat),
      totalFinal: Math.round(totalFinal),
      totalDiscounts: Math.round(totalDescuentos),
      conformesCount,
      count: filtradoPurchases.length,
    };
  }, [filtradoPurchases]);

  // =========================================================================
  // 6. MERMAS Y BAJAS DE STOCK
  // =========================================================================
  const filtradoWastes = useMemo(() => {
    return registrosMerma.filter((w) => {
      const coincidenciasPeriod = esWithinPeriod(w.date);
      const producto = productos.find((p) => p.sku === w.sku);
      const productoNombre = producto ? producto.name : w.sku;
      const coincidenciasMotivo =
        seleccionadoMermaMotivo === "todos" ||
        (w.reason || "").toLowerCase().includes(seleccionadoMermaMotivo.toLowerCase());
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        w.sku.toLowerCase().includes(q) ||
        productoNombre.toLowerCase().includes(q) ||
        (w.reason || "").toLowerCase().includes(q);

      return coincidenciasPeriod && coincidenciasMotivo && coincidenciasQuery;
    });
  }, [registrosMerma, productos, period, seleccionadoMermaMotivo, buscarQuery]);

  const mermaTotals = useMemo(() => {
    let totalUnidades = 0;
    let totalCosto = 0;
    filtradoWastes.forEach((w) => {
      totalUnidades += Number(w.quantity || 0);
      totalCosto += Number(w.totalLoss || 0);
    });
    return {
      totalUnits: totalUnidades,
      totalCost: Math.round(totalCosto),
      count: filtradoWastes.length,
    };
  }, [filtradoWastes]);

  // Opciones para selectores desplegables contextuales
  const opcionesTipoMovimiento: OpcionSelector<string>[] = [
    { label: "Todos los movimientos de Cardex", value: "todos", icon: "swap-horizontal-outline" },
    { label: "Entradas por Compra (OC / Factura)", value: "entrada_compra", icon: "arrow-down-circle-outline" },
    { label: "Salidas a Obra / Despachos", value: "salida_obra", icon: "arrow-up-circle-outline" },
    { label: "Devoluciones desde Faena", value: "devolucion", icon: "return-down-back-outline" },
    { label: "Bajas por Merma", value: "merma", icon: "trash-bin-outline" },
    { label: "Ajustes por Conteo Físico", value: "ajuste_conteo", icon: "calculator-outline" },
  ];

  const opcionesEstadoStock: OpcionSelector<string>[] = [
    { label: "Todos los estados de stock", value: "todos", icon: "layers-outline" },
    { label: "Stock Óptimo (Sobre mínimo)", value: "normal", icon: "checkmark-circle-outline" },
    { label: "Stock Crítico (Bajo mínimo)", value: "bajo", icon: "warning-outline" },
    { label: "Agotado (0 unidades)", value: "agotado", icon: "alert-circle-outline" },
  ];

  const opcionesProyectosSelector = useMemo<OpcionSelector<string>[]>(
    () => [
      { label: "Todas las obras y proyectos", value: "todos", icon: "business-outline" },
      ...proyectos.map((p) => ({
        label: `${p.code} • ${p.name}`,
        value: p.code,
        hint: `Cliente: ${p.client}`,
        icon: "construct-outline" as const,
      })),
    ],
    [proyectos]
  );

  const opcionesMotivoMerma: OpcionSelector<string>[] = [
    { label: "Todos los motivos de baja", value: "todos", icon: "trash-bin-outline" },
    { label: "Daño físico o rotura", value: "daño", icon: "construct-outline" },
    { label: "Caducidad / Vencimiento", value: "caducidad", icon: "time-outline" },
    { label: "Pérdida o extravío", value: "pérdida", icon: "help-circle-outline" },
    { label: "Otro motivo", value: "otro", icon: "document-text-outline" },
  ];

  // =========================================================================
  // EXPORTACIÓN A EXCEL (CSV UTF-8) Y VISTA IMPRIMIBLE PDF
  // =========================================================================
  const manejarExportar = (format: "pdf" | "excel") => {
    let headers: string[] = [];
    let filas: any[] = [];
    let tituloReporte = "Informe de Gestión FYAG";
    let filename = `reporte_${activoPestana}`;

    if (activoPestana === "movimientos") {
      tituloReporte = "Trazabilidad de Movimientos Cardex";
      headers = ["Fecha", "Tipo", "SKU", "Insumo", "Referencia", "Entrada", "Salida", "Saldo", "PMP", "Total_CLP"];
      filas = filtradoCardex.map((c) => ({
        Fecha: c.date,
        Tipo: c.typeLabel,
        SKU: c.sku,
        Insumo: c.productName,
        Referencia: c.projectName ? `${c.projectCode} (${c.projectName})` : c.reference,
        Entrada: c.qtyIn,
        Salida: c.qtyOut,
        Saldo: c.balance,
        PMP: c.pmp,
        Total_CLP: c.totalValue,
      }));
    } else if (activoPestana === "inventario") {
      tituloReporte = "Catálogo de Existencias Valorizadas";
      headers = ["SKU", "Nombre", "Categoria", "Unidad", "Stock_Actual", "Stock_Minimo", "Costo_Unit_CLP", "Valor_Total_CLP"];
      filas = filtradoProductos.map((p) => {
        const costoU = obtenerCostoUnitarioProducto(p);
        return {
          SKU: p.sku,
          Nombre: p.name,
          Categoria: p.category,
          Unidad: p.unit,
          Stock_Actual: p.stock,
          Stock_Minimo: p.minStock,
          Costo_Unit_CLP: costoU,
          Valor_Total_CLP: p.stock * costoU,
        };
      });
    } else if (activoPestana === "proyectos") {
      tituloReporte = "Balance Financiero y Rentabilidad de Obras";
      headers = ["Codigo", "Proyecto", "Cliente", "Presupuesto_CLP", "Costo_Real_CLP", "Costo_HH_CLP", "Costo_Materiales_CLP", "Margen_CLP", "Avance_Pct", "Estado"];
      filas = filtradoProyectos.map((p) => ({
        Codigo: p.code,
        Proyecto: p.name,
        Cliente: p.client,
        Presupuesto_CLP: p.budget,
        Costo_Real_CLP: p.costReal,
        Costo_HH_CLP: p.costRealHours || 0,
        Costo_Materiales_CLP: p.costRealMaterials || 0,
        Margen_CLP: p.budget - p.costReal,
        Avance_Pct: `${p.progress}%`,
        Estado: p.status,
      }));
    } else if (activoPestana === "materiales") {
      tituloReporte = "Materiales Despachados e Imputados a Faena";
      headers = ["ID_Solicitud", "Proyecto", "Fecha", "Tecnico", "SKU", "Insumo", "Solicitado", "Entregado", "Costo_Estimado_CLP", "Estado"];
      filas = asignadoMateriales.map((m) => ({
        ID_Solicitud: m.requestId,
        Proyecto: m.projectName,
        Fecha: m.date,
        Tecnico: m.technicianRut,
        SKU: m.sku,
        Insumo: m.productName,
        Solicitado: m.quantityRequested,
        Entregado: m.quantityDelivered,
        Costo_Estimado_CLP: m.estimatedCost,
        Estado: m.status,
      }));
    } else if (activoPestana === "gastos") {
      tituloReporte = "Facturas de Compra y Adquisiciones";
      headers = ["Factura", "Proveedor", "Fecha", "Monto_Neto_CLP", "IVA_CLP", "Total_Facturado_CLP", "Estado"];
      filas = filtradoPurchases.map((inv) => ({
        Factura: inv.number,
        Proveedor: inv.supplierName,
        Fecha: inv.date,
        Monto_Neto_CLP: inv.subtotalNet,
        IVA_CLP: inv.iva,
        Total_Facturado_CLP: inv.total,
        Estado: inv.status,
      }));
    } else if (activoPestana === "mermas") {
      tituloReporte = "Registro Oficial de Mermas y Bajas de Stock";
      headers = ["Fecha", "SKU", "Insumo", "Cantidad", "Motivo", "Responsable", "Perdida_CLP"];
      filas = filtradoWastes.map((w) => {
        const producto = productos.find((p) => p.sku === w.sku);
        return {
          Fecha: w.date,
          SKU: w.sku,
          Insumo: producto ? producto.name : w.sku,
          Cantidad: w.quantity,
          Motivo: w.reason,
          Responsable: w.user,
          Perdida_CLP: w.totalLoss,
        };
      });
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (format === "pdf") {
        const win = window.open("", "_blank", "width=960,height=720");
        if (win) {
          const thHtml = headers
            .map(
              (h) =>
                `<th style="padding:8px 10px;border-bottom:2px solid #4f46e5;text-align:left;font-size:11px;background:#1e1b4b;color:#ffffff;">${h.replace(/_/g, " ")}</th>`
            )
            .join("");
          const trHtml = filas
            .map(
              (r, idx) =>
                `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">${headers
                  .map(
                    (h) =>
                      `<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#0f172a;">${r[h] ?? ""}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("");

          win.document.write(`
            <html>
              <head><title>${tituloReporte} — FYAG</title></head>
              <body style="font-family:sans-serif;padding:24px;color:#0f172a;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px;">
                  <div>
                    <h2 style="margin:0;color:#0f172a;">FYAG MULTISYSTEM SpA — ${tituloReporte}</h2>
                    <p style="margin:4px 0 0;font-size:12px;color:#475569;">Fecha de emisión: ${new Date().toLocaleDateString("es-CL")} • Registros: ${filas.length}</p>
                  </div>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead><tr>${thHtml}</tr></thead>
                  <tbody>${trHtml}</tbody>
                </table>
              </body>
            </html>
          `);
          win.document.close();
          win.focus();
          win.print();
          mostrarAviso(`Vista de impresión PDF generada (${filas.length} registros).`);
          return;
        }
      }

      const csvFilas = [headers.join(",")];
      filas.forEach((r) => {
        csvFilas.push(
          headers
            .map((h) => {
              const valor = r[h] !== undefined ? String(r[h]) : "";
              return `"${valor.replace(/"/g, '""')}"`;
            })
            .join(",")
        );
      });
      const csvContenido =
        "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvFilas.join("\n"));
      const enlace = document.createElement("a");
      enlace.setAttribute("href", csvContenido);
      enlace.setAttribute(
        "download",
        `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      mostrarAviso(`Informe CSV/Excel descargado (${filas.length} registros).`);
    } else {
      mostrarAviso("Exportación generada en formato compatible.");
    }
  };

  const patrimonioOperativoTotal =
    inventarioTotals.totalValuation + asignadoMaterialesTotals.totalVal;

  return (
    <ContenedorEstadoPantalla screenTitle="Informes y Reportes" skeletonType="table">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(avisoMensaje)}
          message={avisoMensaje || ""}
          onDismiss={() => establecerAvisoMensaje(null)}
        />

        <EncabezadoPagina
          title="Centro de Informes y Gestión"
          subtitle="Consolidado ejecutivo en tiempo real de Cardex, inventario valorizado, rentabilidad de obras, compras y mermas"
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.scrollContenido}>
          {/* =====================================================================
              1. CABECERA EJECUTIVA + FILTRO DE PERÍODO + EXPORTACIÓN DIRECTA
              ===================================================================== */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="bar-chart-outline" size={20} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: tema.colors.text }}>
                    Inteligencia Operativa y Financiera
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Capital en Materiales (Bodega + Obras):{" "}
                    <Text style={{ fontWeight: "900", color: tema.colors.primaryDark }}>
                      {formatearCLP(patrimonioOperativoTotal)}
                    </Text>
                    {" • "}Margen Obras:{" "}
                    <Text
                      style={{
                        fontWeight: "900",
                        color:
                          proyectosTotals.totalMargin >= 0 ? tema.colors.okDark : tema.colors.danger,
                      }}
                    >
                      {formatearCLP(proyectosTotals.totalMargin)} ({proyectosTotals.pctMargen}%)
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Selector de Período Compacto + Botón Exportar */}
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "#f1f5f9",
                    borderRadius: 9,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: "#cbd5e1",
                  }}
                >
                  {(
                    [
                      { id: "7dias", label: "7D" },
                      { id: "30dias", label: "30D" },
                      { id: "mes_actual", label: "Mes" },
                      { id: "todo", label: "Todo" },
                    ] as const
                  ).map((p) => {
                    const activo = period === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => establecerPeriod(p.id)}
                        style={{
                          paddingHorizontal: 9,
                          paddingVertical: 5,
                          borderRadius: 7,
                          backgroundColor: activo ? "#0f172a" : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: activo ? "#818cf8" : tema.colors.textSecondary,
                          }}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <BotonExportar
                  onExport={manejarExportar}
                  title="Descargar Informe"
                  variant="primary"
                  size="sm"
                />
              </View>
            </View>
          </Tarjeta>

          {/* =====================================================================
              2. GRILLA BENTO 2x3 DE LOS 6 INFORMES COMO KPIS INTERACTIVOS
              ===================================================================== */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "movimientos" as PestanaInforme,
                titulo: "Movimientos Cardex",
                valor: formatearCLP(cardexTotals.totalValue),
                sub: `+${cardexTotals.totalIn} / -${cardexTotals.totalOut} un (${cardexTotals.count} mov.)`,
                icon: "swap-horizontal-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "inventario" as PestanaInforme,
                titulo: "Stock Valorizado",
                valor: formatearCLP(inventarioTotals.totalValuation),
                sub: `${inventarioTotals.count} SKUs • ${inventarioTotals.lowStockCount + inventarioTotals.outStockCount} críticos`,
                icon: "cube-outline" as const,
                bg: "#f0fdf4",
                border: "#86efac",
                borderActivo: "#16a34a",
                textColor: "#166534",
              },
              {
                id: "proyectos" as PestanaInforme,
                titulo: "Rentabilidad Obras",
                valor: formatearCLP(proyectosTotals.totalMargin),
                sub: `Margen ${proyectosTotals.pctMargen}% • ${proyectosTotals.count} obras`,
                icon: "construct-outline" as const,
                bg: proyectosTotals.totalMargin >= 0 ? "#f0fdf4" : "#fef2f2",
                border: proyectosTotals.totalMargin >= 0 ? "#86efac" : "#fca5a5",
                borderActivo: proyectosTotals.totalMargin >= 0 ? "#16a34a" : "#dc2626",
                textColor: proyectosTotals.totalMargin >= 0 ? "#166534" : "#991b1b",
              },
              {
                id: "materiales" as PestanaInforme,
                titulo: "Materiales en Faena",
                valor: formatearCLP(asignadoMaterialesTotals.totalVal),
                sub: `${asignadoMaterialesTotals.totalDeliv} un despachadas (${asignadoMaterialesTotals.tasaCumplimiento}%)`,
                icon: "layers-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "gastos" as PestanaInforme,
                titulo: "Compras de Stock",
                valor: formatearCLP(purchasesTotals.totalFinal),
                sub: `${purchasesTotals.count} factura(s) • Neto: ${formatearCLP(purchasesTotals.totalNet)}`,
                icon: "receipt-outline" as const,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                borderActivo: "#334155",
                textColor: "#0f172a",
              },
              {
                id: "mermas" as PestanaInforme,
                titulo: "Pérdidas por Merma",
                valor: formatearCLP(mermaTotals.totalCost),
                sub: `${mermaTotals.totalUnits} un de baja (${mermaTotals.count} reg.)`,
                icon: "trash-bin-outline" as const,
                bg: mermaTotals.totalCost > 0 ? "#fef2f2" : "#f1f5f9",
                border: mermaTotals.totalCost > 0 ? "#fca5a5" : "#cbd5e1",
                borderActivo: mermaTotals.totalCost > 0 ? "#dc2626" : "#475569",
                textColor: mermaTotals.totalCost > 0 ? "#991b1b" : "#334155",
              },
            ].map((kpi) => {
              const activo = activoPestana === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.82}
                  onPress={() => establecerActivoPestana(kpi.id)}
                  style={{
                    flexBasis: esMobile ? "48%" : "31.5%",
                    flexGrow: 1,
                    minWidth: 150,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2.5 : 1,
                    borderColor: activo ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 6,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 11,
                    paddingHorizontal: 11,
                    paddingVertical: 9,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                  </View>

                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "900",
                      color: kpi.textColor,
                      marginTop: 3,
                    }}
                    numberOfLines={1}
                  >
                    {kpi.valor}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activo ? "800" : "600",
                        color: kpi.textColor,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {activo ? `● Informe activo • ${kpi.sub}` : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* =====================================================================
              3. PANEL VISUAL DE INTELIGENCIA CONTEXTUAL (BARRAS COMPARATIVAS)
              ===================================================================== */}
          <Tarjeta
            variant="outlined"
            style={{
              padding: 13,
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: "#f8fafc",
              borderColor: tema.colors.borderDark,
            }}
          >
            {activoPestana === "movimientos" && (() => {
              const totalMovUn = Math.max(1, cardexTotals.totalIn + cardexTotals.totalOut);
              const pctIn = Math.round((cardexTotals.totalIn / totalMovUn) * 100);
              const pctOut = 100 - pctIn;
              return (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="pulse-outline" size={16} color={tema.colors.primaryDark} />
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                        Balance de Flujo Físico en Cardex (Entradas vs Salidas)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: tema.colors.primaryDark }}>
                      Volumen Movilizado: {formatearCLP(cardexTotals.totalValue)}
                    </Text>
                  </View>

                  <View style={{ height: 10, borderRadius: 999, backgroundColor: "#fed7aa", flexDirection: "row", overflow: "hidden" }}>
                    <View style={{ width: `${pctIn}%`, backgroundColor: "#16a34a", height: "100%" }} />
                    <View style={{ width: `${pctOut}%`, backgroundColor: "#d97706", height: "100%" }} />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                      ● Entradas a Bodega: +{cardexTotals.totalIn} un ({pctIn}% • {formatearCLP(cardexTotals.valorEntradas)})
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                      ● Salidas y Bajas: -{cardexTotals.totalOut} un ({pctOut}% • {formatearCLP(cardexTotals.valorSalidas)})
                    </Text>
                  </View>
                </View>
              );
            })()}

            {activoPestana === "inventario" && (() => {
              const totalSkus = Math.max(1, inventarioTotals.count);
              const pctNormal = Math.round((inventarioTotals.normalStockCount / totalSkus) * 100);
              const pctLow = Math.round((inventarioTotals.lowStockCount / totalSkus) * 100);
              const pctOut = Math.max(0, 100 - pctNormal - pctLow);
              return (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#16a34a" />
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                        Salud de Cobertura de Stock ({pctNormal}% catálogo en nivel óptimo)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#166534" }}>
                      {inventarioTotals.totalUnits} unidades físicas • {formatearCLP(inventarioTotals.totalValuation)}
                    </Text>
                  </View>

                  <View style={{ height: 10, borderRadius: 999, backgroundColor: "#e2e8f0", flexDirection: "row", overflow: "hidden" }}>
                    <View style={{ width: `${pctNormal}%`, backgroundColor: "#16a34a", height: "100%" }} />
                    <View style={{ width: `${pctLow}%`, backgroundColor: "#d97706", height: "100%" }} />
                    <View style={{ width: `${pctOut}%`, backgroundColor: "#dc2626", height: "100%" }} />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                      ● Óptimo: {inventarioTotals.normalStockCount} SKUs ({pctNormal}%)
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                      ● Bajo Mínimo: {inventarioTotals.lowStockCount} SKUs ({pctLow}%)
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>
                      ● Agotado: {inventarioTotals.outStockCount} SKUs ({pctOut}%)
                    </Text>
                  </View>
                </View>
              );
            })()}

            {activoPestana === "proyectos" && (() => {
              const presupBase = Math.max(1, proyectosTotals.totalBudget);
              const pctMat = Math.min(100, Math.round((proyectosTotals.totalCostMaterials / presupBase) * 100));
              const pctHH = Math.min(100 - pctMat, Math.round((proyectosTotals.totalCostHours / presupBase) * 100));
              const pctEjecutadoTotal = Math.round((proyectosTotals.totalCostReal / presupBase) * 100);
              return (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="trending-up-outline" size={16} color={tema.colors.primaryDark} />
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                        Estructura de Costos vs Presupuesto de Obras ({pctEjecutadoTotal}% consumido)
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "900",
                        color: proyectosTotals.totalMargin >= 0 ? "#166534" : "#991b1b",
                      }}
                    >
                      Margen Consolidado: {formatearCLP(proyectosTotals.totalMargin)} ({proyectosTotals.pctMargen}%)
                    </Text>
                  </View>

                  <View style={{ height: 10, borderRadius: 999, backgroundColor: "#dcfce7", flexDirection: "row", overflow: "hidden" }}>
                    <View style={{ width: `${pctMat}%`, backgroundColor: "#d97706", height: "100%" }} />
                    <View style={{ width: `${pctHH}%`, backgroundColor: "#0284c7", height: "100%" }} />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                      ● Materiales: {formatearCLP(proyectosTotals.totalCostMaterials)} ({pctMat}%)
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#0369a1" }}>
                      ● Mano de Obra (HH): {formatearCLP(proyectosTotals.totalCostHours)} ({pctHH}%)
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                      ● Presupuesto Total: {formatearCLP(proyectosTotals.totalBudget)}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {activoPestana === "materiales" && (
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="checkmark-done-circle-outline" size={16} color={tema.colors.primaryDark} />
                    <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                      Nivel de Cumplimiento de Despacho a Faenas ({asignadoMaterialesTotals.tasaCumplimiento}%)
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: tema.colors.primaryDark }}>
                    Valor Imputado a Obras: {formatearCLP(asignadoMaterialesTotals.totalVal)}
                  </Text>
                </View>

                <View style={{ height: 10, borderRadius: 999, backgroundColor: "#fde68a", overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${asignadoMaterialesTotals.tasaCumplimiento}%`,
                      backgroundColor: "#16a34a",
                      height: "100%",
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                    ● Entregado a Terreno: {asignadoMaterialesTotals.totalDeliv} unidades
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                    ● Total Solicitado: {asignadoMaterialesTotals.totalReq} unidades ({asignadoMaterialesTotals.count} líneas)
                  </Text>
                </View>
              </View>
            )}

            {activoPestana === "gastos" && (
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="receipt-outline" size={16} color={tema.colors.primaryDark} />
                    <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                      Desglose Tributario de Compras ({purchasesTotals.conformesCount}/{purchasesTotals.count} conformes con OC)
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#166534" }}>
                    Ahorro Descuentos Cascada: -{formatearCLP(purchasesTotals.totalDiscounts)}
                  </Text>
                </View>

                <View style={{ height: 10, borderRadius: 999, backgroundColor: "#fde68a", flexDirection: "row", overflow: "hidden" }}>
                  <View style={{ width: "84%", backgroundColor: "#d97706", height: "100%" }} />
                  <View style={{ width: "16%", backgroundColor: "#475569", height: "100%" }} />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                    ● Costo Neto Stock (84%): {formatearCLP(purchasesTotals.totalNet)}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#334155" }}>
                    ● IVA Crédito Fiscal 19% (16%): {formatearCLP(purchasesTotals.totalVat)}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.text }}>
                    Total Bruto Facturado: {formatearCLP(purchasesTotals.totalFinal)}
                  </Text>
                </View>
              </View>
            )}

            {activoPestana === "mermas" && (() => {
              const basePatrimonio = Math.max(1, inventarioTotals.totalValuation + mermaTotals.totalCost);
              const pctMerma = ((mermaTotals.totalCost / basePatrimonio) * 100).toFixed(1);
              return (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                      <Text style={{ fontSize: 12.5, fontWeight: "800", color: tema.colors.text }}>
                        Impacto Patrimonial de Mermas ({pctMerma}% sobre valor de inventario)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#991b1b" }}>
                      Pérdida Acumulada: {formatearCLP(mermaTotals.totalCost)} ({mermaTotals.totalUnits} un)
                    </Text>
                  </View>

                  <View style={{ height: 10, borderRadius: 999, backgroundColor: "#dcfce7", overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${Math.min(100, Math.max(4, Number(pctMerma)))}%`,
                        backgroundColor: "#dc2626",
                        height: "100%",
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>
                      ● Mermas Auditadas: {mermaTotals.count} baja(s) autorizadas
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                      ● Stock Operativo Resguardado: {formatearCLP(inventarioTotals.totalValuation)}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </Tarjeta>

          {/* =====================================================================
              4. BARRA DE FILTROS SIMPLIFICADA CON SELECTOR DESPLEGABLE Y SWITCH VISTA
              ===================================================================== */}
          <Tarjeta variant="outlined" style={{ padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              <View style={{ flex: 1.5, minWidth: 210 }}>
                <CampoBusqueda
                  value={buscarQuery}
                  onChangeText={establecerBuscarQuery}
                  placeholder="Buscar por SKU, insumo, código de obra, factura o proveedor..."
                />
              </View>

              {activoPestana === "movimientos" && (
                <View style={{ flex: 1, minWidth: 190 }}>
                  <Selector
                    label="Tipo de Movimiento"
                    options={opcionesTipoMovimiento}
                    value={seleccionadoMovementTipo}
                    onChange={establecerSeleccionadoMovementTipo}
                    placeholder="Todos los tipos"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              )}

              {activoPestana === "inventario" && (
                <View style={{ flex: 1, minWidth: 190 }}>
                  <Selector
                    label="Estado de Stock"
                    options={opcionesEstadoStock}
                    value={seleccionadoExistenciaEstado}
                    onChange={establecerSeleccionadoExistenciaEstado}
                    placeholder="Todos los estados"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              )}

              {(activoPestana === "proyectos" || activoPestana === "materiales") && (
                <View style={{ flex: 1, minWidth: 190 }}>
                  <Selector
                    label="Filtrar por Obra / Proyecto"
                    options={opcionesProyectosSelector}
                    value={seleccionadoProyectoCodigo}
                    onChange={establecerSeleccionadoProyectoCodigo}
                    placeholder="Todas las obras"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              )}

              {activoPestana === "mermas" && (
                <View style={{ flex: 1, minWidth: 190 }}>
                  <Selector
                    label="Motivo de Baja"
                    options={opcionesMotivoMerma}
                    value={seleccionadoMermaMotivo}
                    onChange={establecerSeleccionadoMermaMotivo}
                    placeholder="Todos los motivos"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              )}

              {/* Selector Tarjetas / Tabla */}
              <View style={[estilos.vistaModoAlternar, { height: 42, alignItems: "center" }]}>
                <TouchableOpacity
                  style={[
                    estilos.vistaModoBoton,
                    effectiveVistaModo === "cards" && estilos.vistaModoBotonActivo,
                  ]}
                  onPress={() => establecerVistaModo("cards")}
                >
                  <Ionicons
                    name="grid-outline"
                    size={14}
                    color={effectiveVistaModo === "cards" ? "#ffffff" : tema.colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      estilos.vistaModoBotonTexto,
                      effectiveVistaModo === "cards" && estilos.vistaModoBotonTextoActivo,
                    ]}
                  >
                    Tarjetas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    estilos.vistaModoBoton,
                    effectiveVistaModo === "table" && estilos.vistaModoBotonActivo,
                  ]}
                  onPress={() => establecerVistaModo("table")}
                >
                  <Ionicons
                    name="list-outline"
                    size={14}
                    color={effectiveVistaModo === "table" ? "#ffffff" : tema.colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      estilos.vistaModoBotonTexto,
                      effectiveVistaModo === "table" && estilos.vistaModoBotonTextoActivo,
                    ]}
                  >
                    Tabla
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Tarjeta>

          {/* =====================================================================
              5. DETALLE DEL REPORTE ACTIVO (TARJETAS CON SEMÁFORO O TABLA)
              ===================================================================== */}
          <Tarjeta style={estilos.contenidoTarjeta}>
            <View style={estilos.tablaTarjetaEncabezado}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.tablaTitulo}>
                  {activoPestana === "movimientos" && "Trazabilidad de Movimientos en Cardex"}
                  {activoPestana === "inventario" && "Catálogo de Existencias Valorizadas"}
                  {activoPestana === "proyectos" && "Balance Financiero y Rentabilidad de Obras"}
                  {activoPestana === "materiales" && "Insumos Despachados e Imputados a Faenas"}
                  {activoPestana === "gastos" && "Facturas de Compra y Adquisiciones"}
                  {activoPestana === "mermas" && "Registro Oficial de Mermas y Bajas de Stock"}
                </Text>
                <Text style={estilos.tablaSubtitulo}>
                  {activoPestana === "movimientos" &&
                    `${filtradoCardex.length} movimientos auditados • Neto movilizado: ${formatearCLP(cardexTotals.totalValue)}`}
                  {activoPestana === "inventario" &&
                    `${filtradoProductos.length} insumos activos • Valorización total: ${formatearCLP(inventarioTotals.totalValuation)}`}
                  {activoPestana === "proyectos" &&
                    `${filtradoProyectos.length} obras analizadas • Margen acumulado: ${formatearCLP(proyectosTotals.totalMargin)}`}
                  {activoPestana === "materiales" &&
                    `${asignadoMateriales.length} entregas a terreno • Valor despachado: ${formatearCLP(asignadoMaterialesTotals.totalVal)}`}
                  {activoPestana === "gastos" &&
                    `${filtradoPurchases.length} facturas registradas • Total c/ IVA: ${formatearCLP(purchasesTotals.totalFinal)}`}
                  {activoPestana === "mermas" &&
                    `${filtradoWastes.length} registros de baja • Pérdida total: ${formatearCLP(mermaTotals.totalCost)}`}
                </Text>
              </View>

              <Insignia
                label={effectiveVistaModo === "cards" ? "Vista Semáforo" : "Vista Tabular"}
                tone="info"
                size="sm"
              />
            </View>

            <SeccionInformeMovimientos
              activoPestana={activoPestana}
              cardexTotals={cardexTotals}
              effectiveVistaModo={effectiveVistaModo}
              filtradoCardex={filtradoCardex}
              width={width}
            />

            <SeccionInformeInventario
              activoPestana={activoPestana}
              effectiveVistaModo={effectiveVistaModo}
              filtradoProductos={filtradoProductos}
              inventarioTotals={inventarioTotals}
              width={width}
            />

            <SeccionInformeProyectos
              activoPestana={activoPestana}
              effectiveVistaModo={effectiveVistaModo}
              filtradoProyectos={filtradoProyectos}
              proyectosTotals={proyectosTotals}
              width={width}
            />

            <SeccionInformeMateriales
              activoPestana={activoPestana}
              asignadoMateriales={asignadoMateriales}
              asignadoMaterialesTotals={asignadoMaterialesTotals}
              effectiveVistaModo={effectiveVistaModo}
              width={width}
            />

            <SeccionInformeGastos
              activoPestana={activoPestana}
              effectiveVistaModo={effectiveVistaModo}
              filtradoPurchases={filtradoPurchases}
              purchasesTotals={purchasesTotals}
              width={width}
            />

            <SeccionInformeMermas
              activoPestana={activoPestana}
              effectiveVistaModo={effectiveVistaModo}
              filtradoWastes={filtradoWastes}
              mermaTotals={mermaTotals}
              productos={productos}
              width={width}
            />
          </Tarjeta>
        </ScrollView>
      </View>
    </ContenedorEstadoPantalla>
  );
};
