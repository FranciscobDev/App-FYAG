import React, { useState, useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  InsigniaEstado,
  BotonExportar,
  TarjetaKpi,
  EncabezadoPagina,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import { MovimientoCardex, Producto, Proyecto, RegistroMerma } from "@/nucleo/tipos";
import { estilos } from "./estilos";
import { SeccionInformeMovimientos, SeccionInformeInventario, SeccionInformeProyectos, SeccionInformeMateriales, SeccionInformeGastos, SeccionInformeMermas } from "./componentes";

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
    proveedores,
  } = usarAplicacion();

  // Subcategoría activa
  const [activoPestana, establecerActivoPestana] = useState<PestanaInforme>("movimientos");

  // Filtros globales y locales
  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [period, establecerPeriod] = useState<PeriodFilter>("30dias");
  const [seleccionadoProyectoCodigo, establecerSeleccionadoProyectoCodigo] = useState<string>("todos");
  const [seleccionadoMovementTipo, establecerSeleccionadoMovementTipo] = useState<string>("todos");
  const [seleccionadoCategoria, establecerSeleccionadoCategoria] = useState<string>("todas");
  const [seleccionadoExistenciaEstado, establecerSeleccionadoExistenciaEstado] = useState<string>("todos");
  const [seleccionadoMermaMotivo, establecerSeleccionadoMermaMotivo] = useState<string>("todos");

  // Modo de vista: Tarjetas o Tabla
  const [vistaModo, establecerVistaModo] = useState<"auto" | "cards" | "table">("auto");
  const effectiveVistaModo = vistaModo === "auto" ? (esMobile ? "cards" : "table") : vistaModo;

  // Notificaciones Toast
  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // Helper para validar fechas en períodos
  const esWithinPeriod = (dateStr: string) => {
    if (period === "todo") return true;
    const now = new Date();
    const elementoFecha = new Date(dateStr);
    if (isNaN(elementoFecha.getTime())) return true;

    if (period === "7dias") {
      const diferenciaDias = (now.getTime() - elementoFecha.getTime()) / (1000 * 3600 * 24);
      return diferenciaDias <= 7 && diferenciaDias >= 0;
    }
    if (period === "30dias") {
      const diferenciaDias = (now.getTime() - elementoFecha.getTime()) / (1000 * 3600 * 24);
      return diferenciaDias <= 30 && diferenciaDias >= 0;
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
    filtradoCardex.forEach((c) => {
      totalIn += c.qtyIn || 0;
      totalOut += c.qtyOut || 0;
      totalValor += c.totalValue || 0;
    });
    return { totalIn, totalOut, totalValue: totalValor, count: filtradoCardex.length };
  }, [filtradoCardex]);

  // =========================================================================
  // 2. INVENTARIO & STOCK VALORIZADO
  // =========================================================================
  const filtradoProductos = useMemo(() => {
    return productos.filter((p) => {
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
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
    filtradoProductos.forEach((p) => {
      totalUnidades += p.stock;
      totalValuation += p.stock * (p.pmp ?? 0);
      if (p.stock <= p.minStock) lowExistenciaConteo++;
    });
    return { totalUnits: totalUnidades, totalValuation, lowStockCount: lowExistenciaConteo, count: filtradoProductos.length };
  }, [filtradoProductos]);

  // =========================================================================
  // 3. ESTADO FINANCIERO DE PROYECTOS Y OBRAS
  // =========================================================================
  const filtradoProyectos = useMemo(() => {
    return proyectos.filter((p) => {
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q);
      return coincidenciasQuery;
    });
  }, [proyectos, buscarQuery]);

  const proyectosTotals = useMemo(() => {
    let totalPresupuesto = 0;
    let totalCostoReal = 0;
    let totalCostoMateriales = 0;
    let totalCostoHoras = 0;
    filtradoProyectos.forEach((p) => {
      totalPresupuesto += p.budget;
      totalCostoReal += p.costReal;
      totalCostoMateriales += p.costRealMaterials || 0;
      totalCostoHoras += p.costRealHours || 0;
    });
    const totalMargen = totalPresupuesto - totalCostoReal;
    return {
      totalBudget: totalPresupuesto,
      totalCostReal: totalCostoReal,
      totalCostMaterials: totalCostoMateriales,
      totalCostHours: totalCostoHoras,
      totalMargin: totalMargen,
      count: filtradoProyectos.length,
    };
  }, [filtradoProyectos]);

  // =========================================================================
  // 4. MATERIALES ASIGNADOS A PROYECTOS (FAENAS)
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
      if (seleccionadoProyectoCodigo !== "todos" && req.projectCode !== seleccionadoProyectoCodigo) return;

      const proyectoNombre = `${req.projectCode} - ${req.projectName}`;

      req.items.forEach((item) => {
        const producto = productos.find((p) => p.sku === item.sku);
        const productoNombre = producto ? producto.name : item.sku;
        const pmp = producto ? producto.pmp ?? 0 : 0;
        const q = buscarQuery.toLowerCase().trim();

        if (
          !q ||
          item.sku.toLowerCase().includes(q) ||
          productoNombre.toLowerCase().includes(q) ||
          proyectoNombre.toLowerCase().includes(q)
        ) {
          lista.push({
            id: `${req.id}_${item.sku}`,
            requestId: req.code || req.id,
            projectId: req.projectId,
            projectName: proyectoNombre,
            technicianRut: req.technicianRut,
            date: req.date,
            sku: item.sku,
            productName: productoNombre,
            quantityRequested: item.quantity,
            quantityDelivered: item.deliveredQuantity || 0,
            estimatedCost: (item.deliveredQuantity || item.quantity) * pmp,
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
    return { totalReq: totalSolicitud, totalDeliv, totalVal, count: asignadoMateriales.length };
  }, [asignadoMateriales]);

  // =========================================================================
  // 5. GASTOS Y COMPRAS EN STOCK DEL MES
  // =========================================================================
  const filtradoPurchases = useMemo(() => {
    return facturasCompra.filter((inv) => {
      const coincidenciasPeriod = esWithinPeriod(inv.date);
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q);

      return coincidenciasPeriod && coincidenciasQuery;
    });
  }, [facturasCompra, period, buscarQuery]);

  const purchasesTotals = useMemo(() => {
    let totalNeto = 0;
    let totalVat = 0;
    let totalFinal = 0;
    filtradoPurchases.forEach((inv) => {
      totalNeto += inv.subtotalNet;
      totalVat += inv.iva;
      totalFinal += inv.total;
    });
    return { totalNet: totalNeto, totalVat, totalFinal, count: filtradoPurchases.length };
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
        seleccionadoMermaMotivo === "todos" || w.reason === seleccionadoMermaMotivo;
      const q = buscarQuery.toLowerCase().trim();
      const coincidenciasQuery =
        !q || w.sku.toLowerCase().includes(q) || productoNombre.toLowerCase().includes(q);

      return coincidenciasPeriod && coincidenciasMotivo && coincidenciasQuery;
    });
  }, [registrosMerma, productos, period, seleccionadoMermaMotivo, buscarQuery]);

  const mermaTotals = useMemo(() => {
    let totalUnidades = 0;
    let totalCosto = 0;
    filtradoWastes.forEach((w) => {
      totalUnidades += w.quantity;
      totalCosto += w.totalLoss || 0;
    });
    return { totalUnits: totalUnidades, totalCost: totalCosto, count: filtradoWastes.length };
  }, [filtradoWastes]);

  // =========================================================================
  // EXPORTACIÓN A EXCEL / CSV
  // =========================================================================
  const manejarExportar = (format: "pdf" | "excel") => {
    let headers: string[] = [];
    let filas: any[] = [];
    let filename = `reporte_${activoPestana}`;

    if (activoPestana === "movimientos") {
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
      headers = ["SKU", "Nombre", "Categoria", "Unidad", "Stock_Actual", "Stock_Minimo", "PMP_CLP", "Valor_Total_CLP"];
      filas = filtradoProductos.map((p) => ({
        SKU: p.sku,
        Nombre: p.name,
        Categoria: p.category,
        Unidad: p.unit,
        Stock_Actual: p.stock,
        Stock_Minimo: p.minStock,
        PMP_CLP: p.pmp ?? 0,
        Valor_Total_CLP: p.stock * (p.pmp ?? 0),
      }));
    } else if (activoPestana === "proyectos") {
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
      headers = ["ID_Solicitud", "Proyecto", "Fecha", "Tecnico_RUT", "SKU", "Insumo", "Solicitado", "Entregado", "Costo_Estimado_CLP", "Estado"];
      filas = asignadoMateriales.map((m) => ({
        ID_Solicitud: m.requestId,
        Proyecto: m.projectName,
        Fecha: m.date,
        Tecnico_RUT: m.technicianRut,
        SKU: m.sku,
        Insumo: m.productName,
        Solicitado: m.quantityRequested,
        Entregado: m.quantityDelivered,
        Costo_Estimado_CLP: m.estimatedCost,
        Estado: m.status,
      }));
    } else if (activoPestana === "gastos") {
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

    if (format === "excel" || format === "pdf") {
      if (Platform.OS === "web" && typeof window !== "undefined") {
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
        mostrarAviso(
          `Reporte exportado exitosamente (${filas.length} registros incluidos).`
        );
      } else {
        mostrarAviso("Exportación generada en formato compatible.");
      }
    }
  };

  return (
    <ContenedorEstadoPantalla screenTitle="Informes y Reportes" skeletonType="table">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(avisoMensaje)}
          message={avisoMensaje || ""}
          onDismiss={() => establecerAvisoMensaje(null)}
        />

        {/* Encabezado sin recuadro blanco */}
        <EncabezadoPagina
          title="Centro de Informes y Gestión"
          subtitle="Consolidado integral de movimientos de Cardex, inventario, proyectos, compras y mermas"
          breadcrumbs={[
            { label: "Inicio" },
            { label: "Activos y Gobernanza" },
            { label: "Informes" },
          ]}
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.scrollContenido}>
          {/* =====================================================================
              1. RESUMEN EJECUTIVO (KPIS DINÁMICOS GLOBALES)
              ===================================================================== */}
          <View style={estilos.kpiGrilla}>
            <View style={estilos.kpiColumna}>
              <TarjetaKpi
                label="Stock Valorizado Total"
                value={formatearCLP(inventarioTotals.totalValuation)}
                subtitle={`${productos.length} SKUs activos en catálogo`}
                icon="cube-outline"
                tone="primary"
              />
            </View>
            <View style={estilos.kpiColumna}>
              <TarjetaKpi
                label="Compras de Stock (Mes)"
                value={formatearCLP(purchasesTotals.totalFinal)}
                subtitle={`${filtradoPurchases.length} facturas registradas`}
                icon="receipt-outline"
                tone="info"
              />
            </View>
            <View style={estilos.kpiColumna}>
              <TarjetaKpi
                label="Materiales en Faenas"
                value={formatearCLP(asignadoMaterialesTotals.totalVal)}
                subtitle={`${asignadoMaterialesTotals.totalDeliv} unidades despachadas`}
                icon="business-outline"
                tone="warn"
              />
            </View>
            <View style={estilos.kpiColumna}>
              <TarjetaKpi
                label="Pérdidas por Merma"
                value={formatearCLP(mermaTotals.totalCost)}
                subtitle={`${mermaTotals.totalUnits} unidades de baja`}
                icon="trash-bin-outline"
                tone="danger"
              />
            </View>
          </View>

          {/* =====================================================================
              2. SELECTOR DE SUBCATEGORÍAS (PESTAÑAS ERGONÓMICAS DE REPORTE)
              ===================================================================== */}
          <View style={estilos.pestanaScrollCaja}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={estilos.pestanaBarraContenido}
            >
              {[
                {
                  id: "movimientos",
                  label: "Reporte de Movimientos",
                  icon: "swap-horizontal-outline",
                  badge: `${filtradoCardex.length}`,
                },
                {
                  id: "inventario",
                  label: "Inventario y Stock",
                  icon: "cube-outline",
                  badge: `${filtradoProductos.length}`,
                },
                {
                  id: "proyectos",
                  label: "Proyectos y Obras",
                  icon: "business-outline",
                  badge: `${filtradoProyectos.length}`,
                },
                {
                  id: "materiales",
                  label: "Materiales en Faena",
                  icon: "layers-outline",
                  badge: `${asignadoMateriales.length}`,
                },
                {
                  id: "gastos",
                  label: "Gastos en Stock",
                  icon: "receipt-outline",
                  badge: `${filtradoPurchases.length}`,
                },
                {
                  id: "mermas",
                  label: "Control de Mermas",
                  icon: "trash-bin-outline",
                  badge: `${filtradoWastes.length}`,
                },
              ].map((tab) => {
                const esActivo = activoPestana === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => establecerActivoPestana(tab.id as PestanaInforme)}
                    activeOpacity={0.7}
                    style={[estilos.pestanaBoton, esActivo && estilos.pestanaBotonActivo]}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={esActivo ? "#ffffff" : tema.colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        estilos.pestanaBotonTexto,
                        esActivo && estilos.pestanaBotonTextoActivo,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        estilos.pestanaInsignia,
                        esActivo && estilos.pestanaInsigniaActivo,
                      ]}
                    >
                      <Text
                        style={[
                          estilos.pestanaInsigniaTexto,
                          esActivo && estilos.pestanaInsigniaTextoActivo,
                        ]}
                      >
                        {tab.badge}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* =====================================================================
              3. BARRA DE FILTROS AVANZADA Y RECOPILACIÓN
              ===================================================================== */}
          <Tarjeta style={estilos.filtrarTarjeta}>
            <View style={estilos.filtrarEncabezadoFila}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="filter" size={16} color={tema.colors.primary} />
                <Text style={estilos.filtrarTarjetaTitulo}>Parámetros de Recopilación</Text>
              </View>

              {/* Botón de Exportación */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <BotonExportar
                  onExport={manejarExportar}
                  title="Descargar Informe"
                  variant="primary"
                  size="sm"
                />
              </View>
            </View>

            <View style={estilos.filtrarCamposFila}>
              {/* Buscador Dinámico */}
              <View style={estilos.buscarCaja}>
                <Ionicons name="search-outline" size={16} color={tema.colors.textMuted} />
                <TextInput
                  style={estilos.buscarEntrada}
                  placeholder="Buscar por SKU, insumo, código, proyecto o proveedor..."
                  value={buscarQuery}
                  onChangeText={establecerBuscarQuery}
                  placeholderTextColor={tema.colors.textMuted}
                />
                {buscarQuery !== "" && (
                  <TouchableOpacity onPress={() => establecerBuscarQuery("")}>
                    <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Selector de Período de Tiempo */}
              <View style={estilos.periodFila}>
                {[
                  { id: "30dias", label: "30 Días" },
                  { id: "7dias", label: "7 Días" },
                  { id: "mes_actual", label: "Mes Actual" },
                  { id: "todo", label: "Todo" },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => establecerPeriod(p.id as PeriodFilter)}
                    style={[
                      estilos.periodChip,
                      period === p.id && estilos.periodChipActivo,
                    ]}
                  >
                    <Text
                      style={[
                        estilos.periodChipTexto,
                        period === p.id && estilos.periodChipTextoActivo,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filtros Contextuales Específicos según Subcategoría */}
            <View style={estilos.secundarioFiltrarFila}>
              {activoPestana === "movimientos" && (
                <View style={estilos.chipsScrollEnvoltorio}>
                  <Text style={estilos.filtrarSubtitulo}>Tipo de Movimiento:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {[
                      { id: "todos", label: "Todos los Tipos" },
                      { id: "entrada_compra", label: "Entradas Compra" },
                      { id: "salida_obra", label: "Salidas a Obra" },
                      { id: "devolucion", label: "Devoluciones" },
                      { id: "merma", label: "Mermas" },
                      { id: "ajuste_conteo", label: "Ajustes de Conteo" },
                    ].map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => establecerSeleccionadoMovementTipo(m.id)}
                        style={[
                          estilos.subChip,
                          seleccionadoMovementTipo === m.id && estilos.subChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.subChipTexto,
                            seleccionadoMovementTipo === m.id && estilos.subChipTextoActivo,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {activoPestana === "inventario" && (
                <View style={estilos.chipsScrollEnvoltorio}>
                  <Text style={estilos.filtrarSubtitulo}>Estado de Stock:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { id: "todos", label: "Todos" },
                      { id: "bajo", label: "Bajo Stock Mínimo" },
                      { id: "normal", label: "Normal" },
                      { id: "agotado", label: "Agotado (0)" },
                    ].map((st) => (
                      <TouchableOpacity
                        key={st.id}
                        onPress={() => establecerSeleccionadoExistenciaEstado(st.id)}
                        style={[
                          estilos.subChip,
                          seleccionadoExistenciaEstado === st.id && estilos.subChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.subChipTexto,
                            seleccionadoExistenciaEstado === st.id && estilos.subChipTextoActivo,
                          ]}
                        >
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {activoPestana === "mermas" && (
                <View style={estilos.chipsScrollEnvoltorio}>
                  <Text style={estilos.filtrarSubtitulo}>Motivo de Baja:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { id: "todos", label: "Todos los Motivos" },
                      { id: "daño", label: "Daño" },
                      { id: "caducidad", label: "Caducidad" },
                      { id: "pérdida", label: "Pérdida" },
                      { id: "otro", label: "Otro" },
                    ].map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => establecerSeleccionadoMermaMotivo(r.id)}
                        style={[
                          estilos.subChip,
                          seleccionadoMermaMotivo === r.id && estilos.subChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.subChipTexto,
                            seleccionadoMermaMotivo === r.id && estilos.subChipTextoActivo,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Tarjeta>

          {/* =====================================================================
              4. CONTENIDO TABULAR Y RESPONSIVO SEGÚN SUBCATEGORÍA
              ===================================================================== */}
          <Tarjeta style={estilos.contenidoTarjeta}>
            {/* Cabecera de la tabla con Selector de Vista */}
            <View style={estilos.tablaTarjetaEncabezado}>
              <View>
                <Text style={estilos.tablaTitulo}>
                  {activoPestana === "movimientos" && "Trazabilidad de Cardex"}
                  {activoPestana === "inventario" && "Catálogo de Existencias Valorizadas"}
                  {activoPestana === "proyectos" && "Balance Financiero de Faenas"}
                  {activoPestana === "materiales" && "Insumos Asignados a Faenas"}
                  {activoPestana === "gastos" && "Facturas y Adquisiciones del Período"}
                  {activoPestana === "mermas" && "Registro Oficial de Mermas y Bajas"}
                </Text>
                <Text style={estilos.tablaSubtitulo}>
                  {activoPestana === "movimientos" &&
                    `${filtradoCardex.length} movimientos registrados en el período`}
                  {activoPestana === "inventario" &&
                    `${filtradoProductos.length} insumos listados`}
                  {activoPestana === "proyectos" &&
                    `${filtradoProyectos.length} proyectos analizados`}
                  {activoPestana === "materiales" &&
                    `${asignadoMateriales.length} asignaciones de materiales`}
                  {activoPestana === "gastos" &&
                    `${filtradoPurchases.length} compras y facturas contabilizadas`}
                  {activoPestana === "mermas" &&
                    `${filtradoWastes.length} registros de merma autorizados`}
                </Text>
              </View>

              {/* Selector Tarjetas / Tabla */}
              <View style={estilos.vistaModoAlternar}>
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

            {/* TAB 1: MOVIMIENTOS */}
      <SeccionInformeMovimientos
        activoPestana={activoPestana}
        cardexTotals={cardexTotals}
        effectiveVistaModo={effectiveVistaModo}
        filtradoCardex={filtradoCardex}
        width={width}
      />

            {/* TAB 2: INVENTARIO */}
      <SeccionInformeInventario
        activoPestana={activoPestana}
        effectiveVistaModo={effectiveVistaModo}
        filtradoProductos={filtradoProductos}
        inventarioTotals={inventarioTotals}
        width={width}
      />

            {/* TAB 3: PROYECTOS */}
      <SeccionInformeProyectos
        activoPestana={activoPestana}
        effectiveVistaModo={effectiveVistaModo}
        filtradoProyectos={filtradoProyectos}
        proyectosTotals={proyectosTotals}
        width={width}
      />

            {/* TAB 4: MATERIALES EN PROYECTOS */}
      <SeccionInformeMateriales
        activoPestana={activoPestana}
        asignadoMateriales={asignadoMateriales}
        asignadoMaterialesTotals={asignadoMaterialesTotals}
        effectiveVistaModo={effectiveVistaModo}
        width={width}
      />

            {/* TAB 5: GASTOS Y COMPRAS DEL MES */}
      <SeccionInformeGastos
        activoPestana={activoPestana}
        effectiveVistaModo={effectiveVistaModo}
        filtradoPurchases={filtradoPurchases}
        purchasesTotals={purchasesTotals}
        width={width}
      />

            {/* TAB 6: MERMAS */}
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

