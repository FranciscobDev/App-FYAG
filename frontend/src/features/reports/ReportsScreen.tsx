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
import { useApp } from "@/context/AppContext";
import { formatCLP, formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EstadoBadge,
  ExportButton,
  KpiCard,
  PageHeader,
  ScreenStateWrapper,
  Toast,
} from "@/components/common";
import { CardexEntry, Product, Project, WasteRecord } from "@/core/types";

export type ReportTab =
  | "movimientos"
  | "inventario"
  | "proyectos"
  | "materiales"
  | "gastos"
  | "mermas";

type PeriodFilter = "30dias" | "7dias" | "mes_actual" | "todo";

export const ReportsScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const {
    products,
    projects,
    cardex,
    materialRequests,
    purchaseInvoices,
    wasteRecords,
    suppliers,
  } = useApp();

  // Subcategoría activa
  const [activeTab, setActiveTab] = useState<ReportTab>("movimientos");

  // Filtros globales y locales
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("30dias");
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>("todos");
  const [selectedMovementType, setSelectedMovementType] = useState<string>("todos");
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>("todos");
  const [selectedWasteReason, setSelectedWasteReason] = useState<string>("todos");

  // Modo de vista: Tarjetas o Tabla
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");
  const effectiveViewMode = viewMode === "auto" ? (isMobile ? "cards" : "table") : viewMode;

  // Notificaciones Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper para validar fechas en períodos
  const isWithinPeriod = (dateStr: string) => {
    if (period === "todo") return true;
    const now = new Date();
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return true;

    if (period === "7dias") {
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7 && diffDays >= 0;
    }
    if (period === "30dias") {
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30 && diffDays >= 0;
    }
    if (period === "mes_actual") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  };

  // =========================================================================
  // 1. REPORTE DE MOVIMIENTOS (CARDEX TRAZABILIDAD)
  // =========================================================================
  const filteredCardex = useMemo(() => {
    return cardex.filter((item) => {
      const matchesPeriod = isWithinPeriod(item.date);
      const matchesType =
        selectedMovementType === "todos" || item.type === selectedMovementType;
      const matchesProject =
        selectedProjectCode === "todos" ||
        item.projectCode === selectedProjectCode ||
        (item.projectName && item.projectName.includes(selectedProjectCode));
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.sku.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        (item.projectName && item.projectName.toLowerCase().includes(q));

      return matchesPeriod && matchesType && matchesProject && matchesQuery;
    });
  }, [cardex, period, selectedMovementType, selectedProjectCode, searchQuery]);

  const cardexTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalValue = 0;
    filteredCardex.forEach((c) => {
      totalIn += c.qtyIn || 0;
      totalOut += c.qtyOut || 0;
      totalValue += c.totalValue || 0;
    });
    return { totalIn, totalOut, totalValue, count: filteredCardex.length };
  }, [filteredCardex]);

  // =========================================================================
  // 2. INVENTARIO & STOCK VALORIZADO
  // =========================================================================
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "todas" || p.category === selectedCategory;

      let matchesStock = true;
      if (selectedStockStatus === "bajo") {
        matchesStock = p.stock <= p.minStock && p.stock > 0;
      } else if (selectedStockStatus === "agotado") {
        matchesStock = p.stock === 0;
      } else if (selectedStockStatus === "normal") {
        matchesStock = p.stock > p.minStock;
      }

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, selectedStockStatus]);

  const inventoryTotals = useMemo(() => {
    let totalUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    filteredProducts.forEach((p) => {
      totalUnits += p.stock;
      totalValuation += p.stock * (p.pmp ?? 0);
      if (p.stock <= p.minStock) lowStockCount++;
    });
    return { totalUnits, totalValuation, lowStockCount, count: filteredProducts.length };
  }, [filteredProducts]);

  // =========================================================================
  // 3. ESTADO FINANCIERO DE PROYECTOS Y OBRAS
  // =========================================================================
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q);
      return matchesQuery;
    });
  }, [projects, searchQuery]);

  const projectsTotals = useMemo(() => {
    let totalBudget = 0;
    let totalCostReal = 0;
    let totalCostMaterials = 0;
    let totalCostHours = 0;
    filteredProjects.forEach((p) => {
      totalBudget += p.budget;
      totalCostReal += p.costReal;
      totalCostMaterials += p.costRealMaterials || 0;
      totalCostHours += p.costRealHours || 0;
    });
    const totalMargin = totalBudget - totalCostReal;
    return {
      totalBudget,
      totalCostReal,
      totalCostMaterials,
      totalCostHours,
      totalMargin,
      count: filteredProjects.length,
    };
  }, [filteredProjects]);

  // =========================================================================
  // 4. MATERIALES ASIGNADOS A PROYECTOS (FAENAS)
  // =========================================================================
  const assignedMaterials = useMemo(() => {
    const list: Array<{
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

    materialRequests.forEach((req) => {
      if (!isWithinPeriod(req.date)) return;
      if (selectedProjectCode !== "todos" && req.projectCode !== selectedProjectCode) return;

      const projName = `${req.projectCode} - ${req.projectName}`;

      req.items.forEach((item) => {
        const prod = products.find((p) => p.sku === item.sku);
        const prodName = prod ? prod.name : item.sku;
        const pmp = prod ? prod.pmp ?? 0 : 0;
        const q = searchQuery.toLowerCase().trim();

        if (
          !q ||
          item.sku.toLowerCase().includes(q) ||
          prodName.toLowerCase().includes(q) ||
          projName.toLowerCase().includes(q)
        ) {
          list.push({
            id: `${req.id}_${item.sku}`,
            requestId: req.code || req.id,
            projectId: req.projectId,
            projectName: projName,
            technicianRut: req.technicianRut,
            date: req.date,
            sku: item.sku,
            productName: prodName,
            quantityRequested: item.quantity,
            quantityDelivered: item.deliveredQuantity || 0,
            estimatedCost: (item.deliveredQuantity || item.quantity) * pmp,
            status: req.status,
          });
        }
      });
    });

    return list;
  }, [materialRequests, products, period, selectedProjectCode, searchQuery]);

  const assignedMaterialsTotals = useMemo(() => {
    let totalReq = 0;
    let totalDeliv = 0;
    let totalVal = 0;
    assignedMaterials.forEach((m) => {
      totalReq += m.quantityRequested;
      totalDeliv += m.quantityDelivered;
      totalVal += m.estimatedCost;
    });
    return { totalReq, totalDeliv, totalVal, count: assignedMaterials.length };
  }, [assignedMaterials]);

  // =========================================================================
  // 5. GASTOS Y COMPRAS EN STOCK DEL MES
  // =========================================================================
  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter((inv) => {
      const matchesPeriod = isWithinPeriod(inv.date);
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q);

      return matchesPeriod && matchesQuery;
    });
  }, [purchaseInvoices, period, searchQuery]);

  const purchasesTotals = useMemo(() => {
    let totalNet = 0;
    let totalVat = 0;
    let totalFinal = 0;
    filteredPurchases.forEach((inv) => {
      totalNet += inv.subtotalNet;
      totalVat += inv.iva;
      totalFinal += inv.total;
    });
    return { totalNet, totalVat, totalFinal, count: filteredPurchases.length };
  }, [filteredPurchases]);

  // =========================================================================
  // 6. MERMAS Y BAJAS DE STOCK
  // =========================================================================
  const filteredWastes = useMemo(() => {
    return wasteRecords.filter((w) => {
      const matchesPeriod = isWithinPeriod(w.date);
      const prod = products.find((p) => p.sku === w.sku);
      const prodName = prod ? prod.name : w.sku;
      const matchesReason =
        selectedWasteReason === "todos" || w.reason === selectedWasteReason;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q || w.sku.toLowerCase().includes(q) || prodName.toLowerCase().includes(q);

      return matchesPeriod && matchesReason && matchesQuery;
    });
  }, [wasteRecords, products, period, selectedWasteReason, searchQuery]);

  const wasteTotals = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    filteredWastes.forEach((w) => {
      totalUnits += w.quantity;
      totalCost += w.totalLoss || 0;
    });
    return { totalUnits, totalCost, count: filteredWastes.length };
  }, [filteredWastes]);

  // =========================================================================
  // EXPORTACIÓN A EXCEL / CSV
  // =========================================================================
  const handleExport = (format: "pdf" | "excel") => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `reporte_${activeTab}`;

    if (activeTab === "movimientos") {
      headers = ["Fecha", "Tipo", "SKU", "Insumo", "Referencia", "Entrada", "Salida", "Saldo", "PMP", "Total_CLP"];
      rows = filteredCardex.map((c) => ({
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
    } else if (activeTab === "inventario") {
      headers = ["SKU", "Nombre", "Categoria", "Unidad", "Stock_Actual", "Stock_Minimo", "PMP_CLP", "Valor_Total_CLP"];
      rows = filteredProducts.map((p) => ({
        SKU: p.sku,
        Nombre: p.name,
        Categoria: p.category,
        Unidad: p.unit,
        Stock_Actual: p.stock,
        Stock_Minimo: p.minStock,
        PMP_CLP: p.pmp ?? 0,
        Valor_Total_CLP: p.stock * (p.pmp ?? 0),
      }));
    } else if (activeTab === "proyectos") {
      headers = ["Codigo", "Proyecto", "Cliente", "Presupuesto_CLP", "Costo_Real_CLP", "Costo_HH_CLP", "Costo_Materiales_CLP", "Margen_CLP", "Avance_Pct", "Estado"];
      rows = filteredProjects.map((p) => ({
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
    } else if (activeTab === "materiales") {
      headers = ["ID_Solicitud", "Proyecto", "Fecha", "Tecnico_RUT", "SKU", "Insumo", "Solicitado", "Entregado", "Costo_Estimado_CLP", "Estado"];
      rows = assignedMaterials.map((m) => ({
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
    } else if (activeTab === "gastos") {
      headers = ["Factura", "Proveedor", "Fecha", "Monto_Neto_CLP", "IVA_CLP", "Total_Facturado_CLP", "Estado"];
      rows = filteredPurchases.map((inv) => ({
        Factura: inv.number,
        Proveedor: inv.supplierName,
        Fecha: inv.date,
        Monto_Neto_CLP: inv.subtotalNet,
        IVA_CLP: inv.iva,
        Total_Facturado_CLP: inv.total,
        Estado: inv.status,
      }));
    } else if (activeTab === "mermas") {
      headers = ["Fecha", "SKU", "Insumo", "Cantidad", "Motivo", "Responsable", "Perdida_CLP"];
      rows = filteredWastes.map((w) => {
        const prod = products.find((p) => p.sku === w.sku);
        return {
          Fecha: w.date,
          SKU: w.sku,
          Insumo: prod ? prod.name : w.sku,
          Cantidad: w.quantity,
          Motivo: w.reason,
          Responsable: w.user,
          Perdida_CLP: w.totalLoss,
        };
      });
    }

    if (format === "excel" || format === "pdf") {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const csvRows = [headers.join(",")];
        rows.forEach((r) => {
          csvRows.push(
            headers
              .map((h) => {
                const val = r[h] !== undefined ? String(r[h]) : "";
                return `"${val.replace(/"/g, '""')}"`;
              })
              .join(",")
          );
        });
        const csvContent =
          "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvRows.join("\n"));
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute(
          "download",
          `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(
          `Reporte exportado exitosamente (${rows.length} registros incluidos).`
        );
      } else {
        showToast("Exportación generada en formato compatible.");
      }
    }
  };

  return (
    <ScreenStateWrapper screenTitle="Informes y Reportes" skeletonType="table">
      <View style={styles.container}>
        <Toast
          visible={Boolean(toastMessage)}
          message={toastMessage || ""}
          onDismiss={() => setToastMessage(null)}
        />

        {/* Encabezado sin recuadro blanco */}
        <PageHeader
          title="Centro de Informes y Gestión"
          subtitle="Consolidado integral de movimientos de Cardex, inventario, proyectos, compras y mermas"
          breadcrumbs={[
            { label: "Inicio" },
            { label: "Activos y Gobernanza" },
            { label: "Informes" },
          ]}
        />

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {/* =====================================================================
              1. RESUMEN EJECUTIVO (KPIS DINÁMICOS GLOBALES)
              ===================================================================== */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCol}>
              <KpiCard
                label="Stock Valorizado Total"
                value={formatCLP(inventoryTotals.totalValuation)}
                subtitle={`${products.length} SKUs activos en catálogo`}
                icon="cube-outline"
                tone="primary"
              />
            </View>
            <View style={styles.kpiCol}>
              <KpiCard
                label="Compras de Stock (Mes)"
                value={formatCLP(purchasesTotals.totalFinal)}
                subtitle={`${filteredPurchases.length} facturas registradas`}
                icon="receipt-outline"
                tone="info"
              />
            </View>
            <View style={styles.kpiCol}>
              <KpiCard
                label="Materiales en Faenas"
                value={formatCLP(assignedMaterialsTotals.totalVal)}
                subtitle={`${assignedMaterialsTotals.totalDeliv} unidades despachadas`}
                icon="business-outline"
                tone="warn"
              />
            </View>
            <View style={styles.kpiCol}>
              <KpiCard
                label="Pérdidas por Merma"
                value={formatCLP(wasteTotals.totalCost)}
                subtitle={`${wasteTotals.totalUnits} unidades de baja`}
                icon="trash-bin-outline"
                tone="danger"
              />
            </View>
          </View>

          {/* =====================================================================
              2. SELECTOR DE SUBCATEGORÍAS (PESTAÑAS ERGONÓMICAS DE REPORTE)
              ===================================================================== */}
          <View style={styles.tabScrollBox}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarContent}
            >
              {[
                {
                  id: "movimientos",
                  label: "Reporte de Movimientos",
                  icon: "swap-horizontal-outline",
                  badge: `${filteredCardex.length}`,
                },
                {
                  id: "inventario",
                  label: "Inventario y Stock",
                  icon: "cube-outline",
                  badge: `${filteredProducts.length}`,
                },
                {
                  id: "proyectos",
                  label: "Proyectos y Obras",
                  icon: "business-outline",
                  badge: `${filteredProjects.length}`,
                },
                {
                  id: "materiales",
                  label: "Materiales en Faena",
                  icon: "layers-outline",
                  badge: `${assignedMaterials.length}`,
                },
                {
                  id: "gastos",
                  label: "Gastos en Stock",
                  icon: "receipt-outline",
                  badge: `${filteredPurchases.length}`,
                },
                {
                  id: "mermas",
                  label: "Control de Mermas",
                  icon: "trash-bin-outline",
                  badge: `${filteredWastes.length}`,
                },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id as ReportTab)}
                    activeOpacity={0.7}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={isActive ? "#ffffff" : theme.colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabButtonText,
                        isActive && styles.tabButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.tabBadge,
                        isActive && styles.tabBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabBadgeText,
                          isActive && styles.tabBadgeTextActive,
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
          <Card style={styles.filterCard}>
            <View style={styles.filterHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="filter" size={16} color={theme.colors.primary} />
                <Text style={styles.filterCardTitle}>Parámetros de Recopilación</Text>
              </View>

              {/* Botón de Exportación */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ExportButton
                  onExport={handleExport}
                  title="Descargar Informe"
                  variant="primary"
                  size="sm"
                />
              </View>
            </View>

            <View style={styles.filterFieldsRow}>
              {/* Buscador Dinámico */}
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por SKU, insumo, código, proyecto o proveedor..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={theme.colors.textMuted}
                />
                {searchQuery !== "" && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Selector de Período de Tiempo */}
              <View style={styles.periodRow}>
                {[
                  { id: "30dias", label: "30 Días" },
                  { id: "7dias", label: "7 Días" },
                  { id: "mes_actual", label: "Mes Actual" },
                  { id: "todo", label: "Todo" },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setPeriod(p.id as PeriodFilter)}
                    style={[
                      styles.periodChip,
                      period === p.id && styles.periodChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodChipText,
                        period === p.id && styles.periodChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filtros Contextuales Específicos según Subcategoría */}
            <View style={styles.secondaryFilterRow}>
              {activeTab === "movimientos" && (
                <View style={styles.chipsScrollWrapper}>
                  <Text style={styles.filterSubtitle}>Tipo de Movimiento:</Text>
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
                        onPress={() => setSelectedMovementType(m.id)}
                        style={[
                          styles.subChip,
                          selectedMovementType === m.id && styles.subChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subChipText,
                            selectedMovementType === m.id && styles.subChipTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {activeTab === "inventario" && (
                <View style={styles.chipsScrollWrapper}>
                  <Text style={styles.filterSubtitle}>Estado de Stock:</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { id: "todos", label: "Todos" },
                      { id: "bajo", label: "Bajo Stock Mínimo" },
                      { id: "normal", label: "Normal" },
                      { id: "agotado", label: "Agotado (0)" },
                    ].map((st) => (
                      <TouchableOpacity
                        key={st.id}
                        onPress={() => setSelectedStockStatus(st.id)}
                        style={[
                          styles.subChip,
                          selectedStockStatus === st.id && styles.subChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subChipText,
                            selectedStockStatus === st.id && styles.subChipTextActive,
                          ]}
                        >
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {activeTab === "mermas" && (
                <View style={styles.chipsScrollWrapper}>
                  <Text style={styles.filterSubtitle}>Motivo de Baja:</Text>
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
                        onPress={() => setSelectedWasteReason(r.id)}
                        style={[
                          styles.subChip,
                          selectedWasteReason === r.id && styles.subChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subChipText,
                            selectedWasteReason === r.id && styles.subChipTextActive,
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
          </Card>

          {/* =====================================================================
              4. CONTENIDO TABULAR Y RESPONSIVO SEGÚN SUBCATEGORÍA
              ===================================================================== */}
          <Card style={styles.contentCard}>
            {/* Cabecera de la tabla con Selector de Vista */}
            <View style={styles.tableCardHeader}>
              <View>
                <Text style={styles.tableTitle}>
                  {activeTab === "movimientos" && "Trazabilidad de Cardex"}
                  {activeTab === "inventario" && "Catálogo de Existencias Valorizadas"}
                  {activeTab === "proyectos" && "Balance Financiero de Faenas"}
                  {activeTab === "materiales" && "Insumos Asignados a Faenas"}
                  {activeTab === "gastos" && "Facturas y Adquisiciones del Período"}
                  {activeTab === "mermas" && "Registro Oficial de Mermas y Bajas"}
                </Text>
                <Text style={styles.tableSubtitle}>
                  {activeTab === "movimientos" &&
                    `${filteredCardex.length} movimientos registrados en el período`}
                  {activeTab === "inventario" &&
                    `${filteredProducts.length} insumos listados`}
                  {activeTab === "proyectos" &&
                    `${filteredProjects.length} proyectos analizados`}
                  {activeTab === "materiales" &&
                    `${assignedMaterials.length} asignaciones de materiales`}
                  {activeTab === "gastos" &&
                    `${filteredPurchases.length} compras y facturas contabilizadas`}
                  {activeTab === "mermas" &&
                    `${filteredWastes.length} registros de merma autorizados`}
                </Text>
              </View>

              {/* Selector Tarjetas / Tabla */}
              <View style={styles.viewModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.viewModeBtn,
                    effectiveViewMode === "cards" && styles.viewModeBtnActive,
                  ]}
                  onPress={() => setViewMode("cards")}
                >
                  <Ionicons
                    name="grid-outline"
                    size={14}
                    color={effectiveViewMode === "cards" ? "#ffffff" : theme.colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.viewModeBtnText,
                      effectiveViewMode === "cards" && styles.viewModeBtnTextActive,
                    ]}
                  >
                    Tarjetas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.viewModeBtn,
                    effectiveViewMode === "table" && styles.viewModeBtnActive,
                  ]}
                  onPress={() => setViewMode("table")}
                >
                  <Ionicons
                    name="list-outline"
                    size={14}
                    color={effectiveViewMode === "table" ? "#ffffff" : theme.colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.viewModeBtnText,
                      effectiveViewMode === "table" && styles.viewModeBtnTextActive,
                    ]}
                  >
                    Tabla
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TAB 1: MOVIMIENTOS */}
            {activeTab === "movimientos" && (
              filteredCardex.length === 0 ? (
                <EmptyState
                  icon="swap-horizontal-outline"
                  title="Sin movimientos coincidentes"
                  description="No se encontraron registros de Cardex con los filtros aplicados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {filteredCardex.map((item) => (
                    <View key={item.id} style={styles.reportCard}>
                      <View style={styles.reportCardTop}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.cardItemTitle}>{item.productName}</Text>
                          <Text style={styles.cardItemSub}>SKU: {item.sku}</Text>
                        </View>
                        <Badge
                          label={item.typeLabel}
                          tone={
                            item.type === "entrada_compra"
                              ? "ok"
                              : item.type === "salida_obra"
                              ? "primary"
                              : item.type === "devolucion"
                              ? "warn"
                              : item.type === "merma"
                              ? "danger"
                              : "mute"
                          }
                          size="sm"
                        />
                      </View>

                      <View style={styles.cardDivider} />

                      <View style={styles.cardStatsRow}>
                        <View>
                          <Text style={styles.cardStatLabel}>REFERENCIA / OBRA</Text>
                          <Text style={styles.cardStatValue}>
                            {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.cardStatLabel}>TOTAL ($ CLP)</Text>
                          <Text style={[styles.cardStatValue, { color: theme.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatCLP(item.totalValue)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {item.qtyIn > 0 && (
                            <Text style={{ fontSize: 12, color: theme.colors.okDark, fontWeight: "600" }}>
                              +{item.qtyIn} un
                            </Text>
                          )}
                          {item.qtyOut > 0 && (
                            <Text style={{ fontSize: 12, color: theme.colors.dangerDark, fontWeight: "600" }}>
                              -{item.qtyOut} un
                            </Text>
                          )}
                          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Saldo: {item.balance} un
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>{item.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 980 }}>
                  <View style={{ minWidth: 980, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 90 }]}>Fecha</Text>
                      <Text style={[styles.thCell, { width: 140 }]}>Tipo</Text>
                      <Text style={[styles.thCell, { width: 220 }]}>Insumo (SKU & Nombre)</Text>
                      <Text style={[styles.thCell, { width: 150 }]}>Referencia / Obra</Text>
                      <Text style={[styles.thCell, { width: 75, textAlign: "right" }]}>Entrada</Text>
                      <Text style={[styles.thCell, { width: 75, textAlign: "right" }]}>Salida</Text>
                      <Text style={[styles.thCell, { width: 75, textAlign: "right" }]}>Saldo</Text>
                      <Text style={[styles.thCell, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Total ($ CLP)</Text>
                    </View>

                    {filteredCardex.map((item) => (
                      <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.tdCell, { width: 90, fontSize: 11 }]}>{item.date}</Text>
                        <View style={{ width: 140 }}>
                          <Badge
                            label={item.typeLabel}
                            tone={
                              item.type === "entrada_compra"
                                ? "ok"
                                : item.type === "salida_obra"
                                ? "primary"
                                : item.type === "devolucion"
                                ? "warn"
                                : item.type === "merma"
                                ? "danger"
                                : "mute"
                            }
                            size="sm"
                          />
                        </View>
                        <View style={{ width: 220 }}>
                          <Text style={styles.rowMainText}>{item.productName}</Text>
                          <Text style={styles.rowSubText}>{item.sku}</Text>
                        </View>
                        <Text style={[styles.tdCell, { width: 150, fontSize: 11 }]}>
                          {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
                        </Text>
                        <Text style={[styles.tdCell, { width: 75, textAlign: "right", color: item.qtyIn > 0 ? theme.colors.okDark : theme.colors.textMuted }]}>
                          {item.qtyIn > 0 ? `+${item.qtyIn}` : "-"}
                        </Text>
                        <Text style={[styles.tdCell, { width: 75, textAlign: "right", color: item.qtyOut > 0 ? theme.colors.dangerDark : theme.colors.textMuted }]}>
                          {item.qtyOut > 0 ? `-${item.qtyOut}` : "-"}
                        </Text>
                        <Text style={[styles.tdCell, { width: 75, textAlign: "right", fontWeight: "600" }]}>
                          {item.balance}
                        </Text>
                        <Text style={[styles.tdCell, { width: 95, textAlign: "right", color: theme.colors.textSecondary }]}>
                          {formatCLP(item.pmp)}
                        </Text>
                        <Text style={[styles.tdCell, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
                          {formatCLP(item.totalValue)}
                        </Text>
                      </View>
                    ))}

                    {/* Fila de Totales */}
                    <View style={styles.totalsRow}>
                      <View style={{ width: 600 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES CONSOLIDADOS ({cardexTotals.count} movimientos):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCell, { width: 75, textAlign: "right", color: theme.colors.okDark }]}>
                        +{cardexTotals.totalIn}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 75, textAlign: "right", color: theme.colors.dangerDark }]}>
                        -{cardexTotals.totalOut}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 75, textAlign: "right" }]}>-</Text>
                      <Text style={[styles.totalsCell, { width: 95, textAlign: "right" }]}>-</Text>
                      <Text style={[styles.totalsCellBold, { width: 110, textAlign: "right" }]}>
                        {formatCLP(cardexTotals.totalValue)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}

            {/* TAB 2: INVENTARIO */}
            {activeTab === "inventario" && (
              filteredProducts.length === 0 ? (
                <EmptyState
                  icon="cube-outline"
                  title="Sin insumos coincidentes"
                  description="No hay insumos que cumplan los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {filteredProducts.map((p) => {
                    const isLow = p.stock <= p.minStock && p.stock > 0;
                    const isOut = p.stock === 0;

                    return (
                      <View key={p.sku} style={styles.reportCard}>
                        <View style={styles.reportCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardItemTitle}>{p.name}</Text>
                            <Text style={styles.cardItemSub}>
                              SKU: {p.sku} • {p.category}
                            </Text>
                          </View>
                          <Badge
                            label={isOut ? "Agotado" : isLow ? "Bajo Stock" : "Óptimo"}
                            tone={isOut ? "danger" : isLow ? "warn" : "ok"}
                            size="sm"
                          />
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.cardStatsRow}>
                          <View>
                            <Text style={styles.cardStatLabel}>EXISTENCIA / MÍNIMO</Text>
                            <Text style={styles.cardStatValue}>
                              {p.stock} / {p.minStock} {p.unit}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.cardStatLabel}>PMP UNITARIO</Text>
                            <Text style={styles.cardStatValue}>{formatCLP(p.pmp ?? 0)}</Text>
                          </View>
                        </View>

                        <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                          <View>
                            <Text style={styles.cardStatLabel}>VALORIZACIÓN TOTAL</Text>
                            <Text style={[styles.cardStatValue, { color: theme.colors.primaryDark, fontWeight: "bold" }]}>
                              {formatCLP(p.stock * (p.pmp ?? 0))}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 840 }}>
                  <View style={{ minWidth: 840, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 110 }]}>SKU</Text>
                      <Text style={[styles.thCell, { width: 220 }]}>Nombre del Insumo</Text>
                      <Text style={[styles.thCell, { width: 120 }]}>Categoría</Text>
                      <Text style={[styles.thCell, { width: 70, textAlign: "right" }]}>Stock</Text>
                      <Text style={[styles.thCell, { width: 70, textAlign: "right" }]}>Mínimo</Text>
                      <Text style={[styles.thCell, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
                      <Text style={[styles.thCell, { width: 120, textAlign: "right" }]}>Total ($ CLP)</Text>
                    </View>

                    {filteredProducts.map((p) => (
                      <View key={p.sku} style={styles.tableRow}>
                        <Text style={[styles.tdCell, { width: 110, fontWeight: "600" }]}>{p.sku}</Text>
                        <View style={{ width: 220 }}>
                          <Text style={styles.rowMainText}>{p.name}</Text>
                          <Text style={styles.rowSubText}>{p.unit}</Text>
                        </View>
                        <Text style={[styles.tdCell, { width: 120, fontSize: 11 }]}>{p.category}</Text>
                        <Text
                          style={[
                            styles.tdCell,
                            {
                              width: 70,
                              textAlign: "right",
                              fontWeight: "bold",
                              color: p.stock <= p.minStock ? theme.colors.dangerDark : theme.colors.text,
                            },
                          ]}
                        >
                          {p.stock}
                        </Text>
                        <Text style={[styles.tdCell, { width: 70, textAlign: "right", color: theme.colors.textMuted }]}>
                          {p.minStock}
                        </Text>
                        <Text style={[styles.tdCell, { width: 95, textAlign: "right", color: theme.colors.textSecondary }]}>
                          {formatCLP(p.pmp ?? 0)}
                        </Text>
                        <Text style={[styles.tdCell, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
                          {formatCLP(p.stock * (p.pmp ?? 0))}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.totalsRow}>
                      <View style={{ width: 450 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES DE EXISTENCIAS ({inventoryTotals.count} SKUs):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCell, { width: 70, textAlign: "right", fontWeight: "bold" }]}>
                        {inventoryTotals.totalUnits} un
                      </Text>
                      <Text style={[styles.totalsCell, { width: 70, textAlign: "right" }]}>-</Text>
                      <Text style={[styles.totalsCell, { width: 95, textAlign: "right" }]}>-</Text>
                      <Text style={[styles.totalsCellBold, { width: 120, textAlign: "right" }]}>
                        {formatCLP(inventoryTotals.totalValuation)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}

            {/* TAB 3: PROYECTOS */}
            {activeTab === "proyectos" && (
              filteredProjects.length === 0 ? (
                <EmptyState
                  icon="business-outline"
                  title="Sin proyectos coincidentes"
                  description="No hay proyectos que cumplan con la búsqueda."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {filteredProjects.map((proj) => {
                    const margin = proj.budget - proj.costReal;

                    return (
                      <View key={proj.id} style={styles.reportCard}>
                        <View style={styles.reportCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardItemTitle}>{proj.name}</Text>
                            <Text style={styles.cardItemSub}>
                              {proj.code} • Cliente: {proj.client}
                            </Text>
                          </View>
                          <EstadoBadge status={proj.status} label={proj.status.toUpperCase()} />
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.cardStatsRow}>
                          <View>
                            <Text style={styles.cardStatLabel}>PRESUPUESTO APROBADO</Text>
                            <Text style={styles.cardStatValue}>{formatCLP(proj.budget)}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.cardStatLabel}>COSTO REAL H27</Text>
                            <Text style={[styles.cardStatValue, { color: theme.colors.dangerDark }]}>
                              {formatCLP(proj.costReal)}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                          <View>
                            <Text style={styles.cardStatLabel}>COSTO HH / MATERIALES</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                              HH: {formatCLP(proj.costRealHours || 0)} | Mat: {formatCLP(proj.costRealMaterials || 0)}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.cardStatLabel}>MARGEN BRUTO</Text>
                            <Text
                              style={[
                                styles.cardStatValue,
                                {
                                  color: margin >= 0 ? theme.colors.okDark : theme.colors.dangerDark,
                                  fontWeight: "bold",
                                },
                              ]}
                            >
                              {formatCLP(margin)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 920 }}>
                  <View style={{ minWidth: 920, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 90 }]}>Código</Text>
                      <Text style={[styles.thCell, { width: 190 }]}>Proyecto & Cliente</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Presupuesto ($)</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Costo Real H27</Text>
                      <Text style={[styles.thCell, { width: 95, textAlign: "right" }]}>Costo HH ($)</Text>
                      <Text style={[styles.thCell, { width: 95, textAlign: "right" }]}>Costo Mat ($)</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Margen ($)</Text>
                      <Text style={[styles.thCell, { width: 90, textAlign: "center" }]}>Estado</Text>
                    </View>

                    {filteredProjects.map((p) => {
                      const margin = p.budget - p.costReal;
                      return (
                        <View key={p.id} style={styles.tableRow}>
                          <Text style={[styles.tdCell, { width: 90, fontWeight: "600" }]}>{p.code}</Text>
                          <View style={{ width: 190 }}>
                            <Text style={styles.rowMainText}>{p.name}</Text>
                            <Text style={styles.rowSubText}>{p.client}</Text>
                          </View>
                          <Text style={[styles.tdCell, { width: 110, textAlign: "right" }]}>
                            {formatCLP(p.budget)}
                          </Text>
                          <Text style={[styles.tdCell, { width: 110, textAlign: "right", color: theme.colors.dangerDark }]}>
                            {formatCLP(p.costReal)}
                          </Text>
                          <Text style={[styles.tdCell, { width: 95, textAlign: "right", color: theme.colors.textMuted }]}>
                            {formatCLP(p.costRealHours || 0)}
                          </Text>
                          <Text style={[styles.tdCell, { width: 95, textAlign: "right", color: theme.colors.textMuted }]}>
                            {formatCLP(p.costRealMaterials || 0)}
                          </Text>
                          <Text
                            style={[
                              styles.tdCell,
                              {
                                width: 110,
                                textAlign: "right",
                                fontWeight: "bold",
                                color: margin >= 0 ? theme.colors.okDark : theme.colors.dangerDark,
                              },
                            ]}
                          >
                            {formatCLP(margin)}
                          </Text>
                          <View style={{ width: 90, alignItems: "center" }}>
                            <EstadoBadge status={p.status} label={p.status.toUpperCase()} />
                          </View>
                        </View>
                      );
                    })}

                    <View style={styles.totalsRow}>
                      <View style={{ width: 280 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES CONSOLIDADOS ({projectsTotals.count} Obras):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCellBold, { width: 110, textAlign: "right" }]}>
                        {formatCLP(projectsTotals.totalBudget)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 110, textAlign: "right", color: theme.colors.dangerDark }]}>
                        {formatCLP(projectsTotals.totalCostReal)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 95, textAlign: "right" }]}>
                        {formatCLP(projectsTotals.totalCostHours)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 95, textAlign: "right" }]}>
                        {formatCLP(projectsTotals.totalCostMaterials)}
                      </Text>
                      <Text
                        style={[
                          styles.totalsCellBold,
                          {
                            width: 110,
                            textAlign: "right",
                            color: projectsTotals.totalMargin >= 0 ? theme.colors.okDark : theme.colors.dangerDark,
                          },
                        ]}
                      >
                        {formatCLP(projectsTotals.totalMargin)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 90, textAlign: "center" }]}>-</Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}

            {/* TAB 4: MATERIALES EN PROYECTOS */}
            {activeTab === "materiales" && (
              assignedMaterials.length === 0 ? (
                <EmptyState
                  icon="layers-outline"
                  title="Sin materiales asignados"
                  description="No existen solicitudes de insumos a faenas para los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {assignedMaterials.map((m) => (
                    <View key={m.id} style={styles.reportCard}>
                      <View style={styles.reportCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardItemTitle}>{m.productName}</Text>
                          <Text style={styles.cardItemSub}>
                            SKU: {m.sku} • Faena: {m.projectName}
                          </Text>
                        </View>
                        <EstadoBadge status={m.status as any} label={m.status.toUpperCase()} />
                      </View>

                      <View style={styles.cardDivider} />

                      <View style={styles.cardStatsRow}>
                        <View>
                          <Text style={styles.cardStatLabel}>SOLICITADO / ENTREGADO</Text>
                          <Text style={styles.cardStatValue}>
                            {m.quantityRequested} / {m.quantityDelivered} un
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.cardStatLabel}>VALORIZACIÓN ESTIMADA</Text>
                          <Text style={[styles.cardStatValue, { color: theme.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatCLP(m.estimatedCost)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                          Técnico: {m.technicianRut}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>Fecha: {m.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 880 }}>
                  <View style={{ minWidth: 880, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 90 }]}>Fecha</Text>
                      <Text style={[styles.thCell, { width: 170 }]}>Proyecto / Obra</Text>
                      <Text style={[styles.thCell, { width: 200 }]}>Insumo (SKU & Nombre)</Text>
                      <Text style={[styles.thCell, { width: 120 }]}>Técnico Solicitante</Text>
                      <Text style={[styles.thCell, { width: 75, textAlign: "right" }]}>Solicitado</Text>
                      <Text style={[styles.thCell, { width: 75, textAlign: "right" }]}>Entregado</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Valor Total ($)</Text>
                    </View>

                    {assignedMaterials.map((m) => (
                      <View key={m.id} style={styles.tableRow}>
                        <Text style={[styles.tdCell, { width: 90, fontSize: 11 }]}>{m.date}</Text>
                        <Text style={[styles.tdCell, { width: 170, fontSize: 11, fontWeight: "600" }]}>
                          {m.projectName}
                        </Text>
                        <View style={{ width: 200 }}>
                          <Text style={styles.rowMainText}>{m.productName}</Text>
                          <Text style={styles.rowSubText}>{m.sku}</Text>
                        </View>
                        <Text style={[styles.tdCell, { width: 120, fontSize: 11 }]}>{m.technicianRut}</Text>
                        <Text style={[styles.tdCell, { width: 75, textAlign: "right" }]}>
                          {m.quantityRequested}
                        </Text>
                        <Text style={[styles.tdCell, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
                          {m.quantityDelivered}
                        </Text>
                        <Text style={[styles.tdCell, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
                          {formatCLP(m.estimatedCost)}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.totalsRow}>
                      <View style={{ width: 580 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES DE MATERIALES EN FAENA ({assignedMaterialsTotals.count}):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCell, { width: 75, textAlign: "right" }]}>
                        {assignedMaterialsTotals.totalReq}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
                        {assignedMaterialsTotals.totalDeliv}
                      </Text>
                      <Text style={[styles.totalsCellBold, { width: 110, textAlign: "right" }]}>
                        {formatCLP(assignedMaterialsTotals.totalVal)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}

            {/* TAB 5: GASTOS Y COMPRAS DEL MES */}
            {activeTab === "gastos" && (
              filteredPurchases.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="Sin compras ni facturas"
                  description="No hay compras registradas en el período seleccionado."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {filteredPurchases.map((inv) => (
                    <View key={inv.id} style={styles.reportCard}>
                      <View style={styles.reportCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardItemTitle}>Factura N° {inv.number}</Text>
                          <Text style={styles.cardItemSub}>
                            Proveedor: {inv.supplierName}
                          </Text>
                        </View>
                        <EstadoBadge status={inv.status === "recepcion_conforme" ? "aprobada" : "pendiente"} label={inv.status.toUpperCase()} />
                      </View>

                      <View style={styles.cardDivider} />

                      <View style={styles.cardStatsRow}>
                        <View>
                          <Text style={styles.cardStatLabel}>MONTO NETO</Text>
                          <Text style={styles.cardStatValue}>{formatCLP(inv.subtotalNet)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.cardStatLabel}>TOTAL FACTURADO CON IVA</Text>
                          <Text style={[styles.cardStatValue, { color: theme.colors.primaryDark, fontWeight: "bold" }]}>
                            {formatCLP(inv.total)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                          IVA (19%): {formatCLP(inv.iva)}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>Fecha: {inv.date}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 840 }}>
                  <View style={{ minWidth: 840, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 120 }]}>N° Factura</Text>
                      <Text style={[styles.thCell, { width: 200 }]}>Proveedor</Text>
                      <Text style={[styles.thCell, { width: 95 }]}>Fecha</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Monto Neto ($)</Text>
                      <Text style={[styles.thCell, { width: 100, textAlign: "right" }]}>IVA ($)</Text>
                      <Text style={[styles.thCell, { width: 120, textAlign: "right" }]}>Total Facturado ($)</Text>
                      <Text style={[styles.thCell, { width: 85, textAlign: "center" }]}>Estado</Text>
                    </View>

                    {filteredPurchases.map((inv) => (
                      <View key={inv.id} style={styles.tableRow}>
                        <Text style={[styles.tdCell, { width: 120, fontWeight: "bold" }]}>
                          {inv.number}
                        </Text>
                        <Text style={[styles.tdCell, { width: 200 }]}>{inv.supplierName}</Text>
                        <Text style={[styles.tdCell, { width: 95, fontSize: 11 }]}>{inv.date}</Text>
                        <Text style={[styles.tdCell, { width: 110, textAlign: "right" }]}>
                          {formatCLP(inv.subtotalNet)}
                        </Text>
                        <Text style={[styles.tdCell, { width: 100, textAlign: "right", color: theme.colors.textMuted }]}>
                          {formatCLP(inv.iva)}
                        </Text>
                        <Text style={[styles.tdCell, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
                          {formatCLP(inv.total)}
                        </Text>
                        <View style={{ width: 85, alignItems: "center" }}>
                          <EstadoBadge status={inv.status === "recepcion_conforme" ? "aprobada" : "pendiente"} label={inv.status.toUpperCase()} />
                        </View>
                      </View>
                    ))}

                    <View style={styles.totalsRow}>
                      <View style={{ width: 415 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES FACTURAS ({purchasesTotals.count}):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCellBold, { width: 110, textAlign: "right" }]}>
                        {formatCLP(purchasesTotals.totalNet)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 100, textAlign: "right" }]}>
                        {formatCLP(purchasesTotals.totalVat)}
                      </Text>
                      <Text style={[styles.totalsCellBold, { width: 120, textAlign: "right", color: theme.colors.primaryDark }]}>
                        {formatCLP(purchasesTotals.totalFinal)}
                      </Text>
                      <Text style={[styles.totalsCell, { width: 85, textAlign: "center" }]}>-</Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}

            {/* TAB 6: MERMAS */}
            {activeTab === "mermas" && (
              filteredWastes.length === 0 ? (
                <EmptyState
                  icon="trash-bin-outline"
                  title="Sin mermas registradas"
                  description="No existen mermas para los filtros seleccionados."
                  containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
                />
              ) : effectiveViewMode === "cards" ? (
                <View style={styles.cardsList}>
                  {filteredWastes.map((w) => {
                    const prod = products.find((p) => p.sku === w.sku);

                    return (
                      <View key={w.id} style={styles.reportCard}>
                        <View style={styles.reportCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardItemTitle}>{prod ? prod.name : w.sku}</Text>
                            <Text style={styles.cardItemSub}>
                              SKU: {w.sku} • Motivo: {w.reason}
                            </Text>
                          </View>
                          <Badge label="Merma Aprobada" tone="danger" size="sm" />
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.cardStatsRow}>
                          <View>
                            <Text style={styles.cardStatLabel}>CANTIDAD DADA DE BAJA</Text>
                            <Text style={[styles.cardStatValue, { color: theme.colors.dangerDark }]}>
                              {w.quantity} {w.unit}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.cardStatLabel}>COSTO DE LA PÉRDIDA</Text>
                            <Text style={[styles.cardStatValue, { color: theme.colors.dangerDark, fontWeight: "bold" }]}>
                              {formatCLP(w.totalLoss)}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.cardStatsRow, { marginTop: 8 }]}>
                          <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                            Responsable: {w.user}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>Fecha: {w.date}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 800 }}>
                  <View style={{ minWidth: 800, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 95 }]}>Fecha</Text>
                      <Text style={[styles.thCell, { width: 110 }]}>SKU</Text>
                      <Text style={[styles.thCell, { width: 200 }]}>Insumo</Text>
                      <Text style={[styles.thCell, { width: 80, textAlign: "right" }]}>Cantidad</Text>
                      <Text style={[styles.thCell, { width: 130 }]}>Motivo</Text>
                      <Text style={[styles.thCell, { width: 120 }]}>Responsable</Text>
                      <Text style={[styles.thCell, { width: 110, textAlign: "right" }]}>Pérdida ($ CLP)</Text>
                    </View>

                    {filteredWastes.map((w) => {
                      const prod = products.find((p) => p.sku === w.sku);
                      return (
                        <View key={w.id} style={styles.tableRow}>
                          <Text style={[styles.tdCell, { width: 95, fontSize: 11 }]}>{w.date}</Text>
                          <Text style={[styles.tdCell, { width: 110, fontWeight: "600" }]}>{w.sku}</Text>
                          <Text style={[styles.tdCell, { width: 200 }]}>{prod ? prod.name : w.sku}</Text>
                          <Text style={[styles.tdCell, { width: 80, textAlign: "right", color: theme.colors.dangerDark, fontWeight: "bold" }]}>
                            {w.quantity}
                          </Text>
                          <Text style={[styles.tdCell, { width: 130, fontSize: 11 }]}>{w.reason}</Text>
                          <Text style={[styles.tdCell, { width: 120, fontSize: 11 }]}>{w.user}</Text>
                          <Text style={[styles.tdCell, { width: 110, textAlign: "right", fontWeight: "bold", color: theme.colors.dangerDark }]}>
                            {formatCLP(w.totalLoss)}
                          </Text>
                        </View>
                      );
                    })}

                    <View style={styles.totalsRow}>
                      <View style={{ width: 405 }}>
                        <Text style={styles.totalsTitle}>
                          TOTALES MERMAS ({wasteTotals.count}):
                        </Text>
                      </View>
                      <Text style={[styles.totalsCellBold, { width: 80, textAlign: "right", color: theme.colors.dangerDark }]}>
                        {wasteTotals.totalUnits} un
                      </Text>
                      <Text style={[styles.totalsCell, { width: 130 }]}>-</Text>
                      <Text style={[styles.totalsCell, { width: 120 }]}>-</Text>
                      <Text style={[styles.totalsCellBold, { width: 110, textAlign: "right", color: theme.colors.dangerDark }]}>
                        {formatCLP(wasteTotals.totalCost)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              )
            )}
          </Card>
        </ScrollView>
      </View>
    </ScreenStateWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  kpiCol: {
    flex: 1,
    minWidth: 220,
  },

  // Subcategory Tabs
  tabScrollBox: {
    marginBottom: theme.spacing.md,
  },
  tabBarContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 44,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  tabButtonTextActive: {
    color: "#ffffff",
    fontWeight: theme.fontWeight.bold,
  },
  tabBadge: {
    marginLeft: 8,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
  },
  tabBadgeTextActive: {
    color: "#ffffff",
  },

  // Filters Card
  filterCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  filterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  filterCardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  filterFieldsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    height: 44,
    flex: 1,
    minWidth: 260,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  periodRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
  },
  periodChipActive: {
    backgroundColor: theme.colors.primary,
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  periodChipTextActive: {
    color: "#ffffff",
    fontWeight: theme.fontWeight.bold,
  },
  secondaryFilterRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 10,
  },
  chipsScrollWrapper: {
    gap: 6,
  },
  filterSubtitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  subChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  subChipText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  subChipTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },

  // Content Card
  contentCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  tableCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  tableTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  tableSubtitle: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  viewModeToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  viewModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
  },
  viewModeBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  viewModeBtnTextActive: {
    color: "#ffffff",
    fontWeight: theme.fontWeight.bold,
  },

  // Responsive Cards View
  cardsList: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    ...theme.shadows.sm,
  },
  reportCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardItemTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  cardItemSub: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 10,
  },
  cardStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardStatLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  cardStatValue: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 2,
  },

  // Table View
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: "center",
  },
  thCell: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    alignItems: "center",
  },
  tdCell: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  rowMainText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  rowSubText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    alignItems: "center",
    marginTop: 4,
    borderRadius: theme.radius.xs,
  },
  totalsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
    textTransform: "uppercase",
  },
  totalsCell: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  totalsCellBold: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "bold",
  },
});
