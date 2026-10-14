import React, { createContext, useContext, useState } from "react";
import {
  CardexEntry,
  Client,
  DashboardAlert,
  Kit,
  MaterialRequest,
  MaterialRequestItem,
  PendingReceipt,
  Product,
  Project,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseOrderItem,
  ReturnOrder,
  ReturnOrderItem,
  ServiceSheet,
  Supplier,
  SupplierRating,
  AuditLogEntry,
  BackupLogItem,
  NotificationDetail,
  SupplierReturn,
  SystemParamItem,
  SystemUser,
  Technician,
  TechnicianProgressReport,
  TechnicianWorkHour,
  Tool,
  ToolLoanHistory,
  ToolMaintenanceRecord,
  WasteRecord,
  PhysicalCount,
} from "@/core/types";
import {
  AUDIT_LOG_ENTRIES,
  BACKUP_LOG_ITEMS,
  CARDEX_ENTRIES,
  CLIENTS,
  DASHBOARD_ALERTS,
  KITS,
  MATERIAL_REQUESTS,
  NOTIFICATION_DETAILS,
  PENDING_RECEIPTS,
  PHYSICAL_COUNTS,
  PRODUCTS,
  PROJECTS,
  PURCHASE_INVOICES,
  PURCHASE_ORDERS,
  RETURN_ORDERS,
  SERVICE_SHEETS,
  SUPPLIER_RETURNS,
  SUPPLIERS,
  SYSTEM_PARAMETERS,
  SYSTEM_USERS,
  TECHNICIAN_PROGRESS_REPORTS,
  TECHNICIAN_WORK_HOURS,
  TECHNICIANS,
  TOOLS,
  USERS,
  WASTE_RECORDS,
} from "@/data/mock";

interface AppContextType {
  // State
  products: Product[];
  projects: Project[];
  materialRequests: MaterialRequest[];
  purchaseOrders: PurchaseOrder[];
  purchaseInvoices: PurchaseInvoice[];
  pendingReceipts: PendingReceipt[];
  suppliers: Supplier[];
  clients: Client[];
  tools: Tool[];
  returnOrders: ReturnOrder[];
  supplierReturns: SupplierReturn[];
  cardex: CardexEntry[];
  kits: Kit[];
  technicians: Technician[];
  alerts: DashboardAlert[];
  wasteRecords: WasteRecord[];
  physicalCounts: PhysicalCount[];

  // Inventory actions
  addProduct: (product: Product) => { success: boolean; error?: string };
  updateProduct: (sku: string, updates: Partial<Product>) => void;
  toggleProductDisabled: (sku: string) => void;
  createWasteRecord: (record: Omit<WasteRecord, "id" | "date">) => { success: boolean; error?: string };
  createPhysicalCount: (
    sku: string,
    countedStock: number,
    notes?: string,
    counterUser?: string
  ) => { success: boolean; requiresApproval: boolean; error?: string };
  approvePhysicalCount: (id: string, approverName: string) => void;
  rejectPhysicalCount: (id: string, approverName: string) => void;
  createKit: (kit: Kit) => { success: boolean; error?: string };
  updateKit: (id: string, updates: Partial<Kit>) => void;

  // Request & Dispatch actions
  createMaterialRequest: (
    projectId: string,
    technicianRut: string,
    items: MaterialRequestItem[],
    urgency?: "normal" | "alta" | "urgente",
    comment?: string
  ) => { success: boolean; missingItems?: string[]; error?: string };
  approveMaterialRequest: (id: string, authorName: string) => void;
  rejectMaterialRequest: (id: string, reason: string, authorName: string) => { success: boolean; error?: string };
  modifyMaterialRequest: (id: string, items: MaterialRequestItem[]) => void;
  cancelMaterialRequest: (id: string) => void;
  dispatchMaterialRequest: (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => { success: boolean; error?: string };

  // Purchasing actions
  createPurchaseOrder: (order: Partial<PurchaseOrder>) => { success: boolean; orderId?: string; error?: string };
  approveAndSendOrder: (orderId: string) => void;
  rateSupplier: (orderId: string, rating: SupplierRating) => void;
  createInvoice: (invoice: PurchaseInvoice) => { success: boolean; error?: string };
  confirmOrderReception: (
    ocCode: string,
    checklist: { sku: string; received: number; defective: number; missing: number }[]
  ) => void;

  // Third Parties
  addSupplier: (supplier: Supplier) => { success: boolean; error?: string };
  addClient: (client: Client) => { success: boolean; error?: string };
  toggleSupplierDisabled: (id: string) => void;
  toggleClientDisabled: (id: string) => void;

  // Projects actions
  createProject: (project: Project) => { success: boolean; error?: string };
  updateProject: (id: string, updates: Partial<Project>) => { success: boolean; error?: string };
  assignTechniciansToProject: (projectId: string, technicianRuts: string[]) => void;
  closeProject: (id: string, closedBy: string) => { success: boolean; blocks?: string[] };

  // Tools actions
  createTool: (tool: Tool) => { success: boolean; error?: string };
  loanTool: (toolId: string, technicianRut: string, projectCode: string) => void;
  returnTool: (toolId: string, condition: "bueno" | "danado", notes?: string) => void;
  registerToolMaintenance: (toolId: string, record: Omit<ToolMaintenanceRecord, "id">) => void;

  // Returns actions
  createTechnicianReturn: (
    projectId: string,
    technicianRut: string,
    technicianName: string,
    items: ReturnOrderItem[]
  ) => { success: boolean; error?: string };
  confirmWarehouseReturn: (
    returnId: string,
    verifiedItems: { sku: string; quantityReceivedReal: number }[],
    discrepancyNote?: string,
    receivedBy?: string
  ) => void;
  createSupplierReturn: (
    supplierId: string,
    sku: string,
    quantity: number,
    reason: string,
    dispatchGuideNumber: string
  ) => void;
  resolveSupplierReturn: (
    returnId: string,
    resolutionType: "nota_credito" | "reemplazo_producto" | "reembolso",
    notes: string
  ) => void;

  // Technician module
  serviceSheets: ServiceSheet[];
  technicianHours: TechnicianWorkHour[];
  technicianProgressReports: TechnicianProgressReport[];
  createServiceSheet: (sheet: Omit<ServiceSheet, "id">) => { success: boolean; error?: string };
  resolveServiceSheetConflict: (sheetId: string, choice: "local" | "server") => void;
  createTechnicianWorkHour: (entry: Omit<TechnicianWorkHour, "id" | "createdAt" | "syncStatus">) => { success: boolean; error?: string };
  updateTechnicianWorkHour: (id: string, hours: number, description: string) => { success: boolean; error?: string };
  createTechnicianProgressReport: (report: Omit<TechnicianProgressReport, "id" | "syncStatus">) => { success: boolean };

  // Administration module
  systemUsers: SystemUser[];
  auditLogs: AuditLogEntry[];
  systemParameters: SystemParamItem[];
  backupLogs: BackupLogItem[];
  notificationsList: NotificationDetail[];
  createSystemUser: (user: Omit<SystemUser, "id" | "createdAt" | "disabled">) => { success: boolean; error?: string };
  toggleSystemUserDisabled: (userId: string) => { success: boolean; error?: string };
  anonymizeUser: (userId: string) => { success: boolean; error?: string };
  updateSystemParameter: (id: string, value: string | number) => void;
  resetSystemParameter: (id: string) => void;
  runManualBackup: () => { success: boolean; filename: string };
  runRestorationTest: () => { success: boolean };
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(MATERIAL_REQUESTS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(PURCHASE_ORDERS);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(PURCHASE_INVOICES);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>(PENDING_RECEIPTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS);
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [tools, setTools] = useState<Tool[]>(TOOLS);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>(RETURN_ORDERS);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(SUPPLIER_RETURNS);
  const [cardex, setCardex] = useState<CardexEntry[]>(CARDEX_ENTRIES);
  const [kits, setKits] = useState<Kit[]>(KITS);
  const [technicians] = useState<Technician[]>(TECHNICIANS);
  const [alerts, setAlerts] = useState<DashboardAlert[]>(DASHBOARD_ALERTS);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>(WASTE_RECORDS);
  const [physicalCounts, setPhysicalCounts] = useState<PhysicalCount[]>(PHYSICAL_COUNTS);
  const [serviceSheets, setServiceSheets] = useState<ServiceSheet[]>(SERVICE_SHEETS);
  const [technicianHours, setTechnicianHours] = useState<TechnicianWorkHour[]>(TECHNICIAN_WORK_HOURS);
  const [technicianProgressReports, setTechnicianProgressReports] = useState<TechnicianProgressReport[]>(TECHNICIAN_PROGRESS_REPORTS);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(SYSTEM_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(AUDIT_LOG_ENTRIES);
  const [systemParameters, setSystemParameters] = useState<SystemParamItem[]>(SYSTEM_PARAMETERS);
  const [backupLogs, setBackupLogs] = useState<BackupLogItem[]>(BACKUP_LOG_ITEMS);
  const [notificationsList, setNotificationsList] = useState<NotificationDetail[]>(NOTIFICATION_DETAILS);

  // 1. INVENTORY
  const addProduct = (product: Product) => {
    if (products.some((p) => p.sku.trim().toUpperCase() === product.sku.trim().toUpperCase())) {
      return { success: false, error: `El SKU ${product.sku} ya está registrado.` };
    }
    setProducts((prev) => [product, ...prev]);
    return { success: true };
  };

  const updateProduct = (sku: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, ...updates } : p))
    );
  };

  const toggleProductDisabled = (sku: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, disabled: !p.disabled } : p))
    );
  };

  // Mermas (Paso 6)
  const createWasteRecord = (data: Omit<WasteRecord, "id" | "date">) => {
    const prod = products.find((p) => p.sku === data.sku);
    if (!prod) return { success: false, error: "Insumo no encontrado." };
    if (data.quantity > prod.stock) {
      return {
        success: false,
        error: `La cantidad de merma (${data.quantity}) no puede ser mayor al stock disponible (${prod.stock}).`,
      };
    }
    if (!data.observation || data.observation.trim().length === 0) {
      return { success: false, error: "La observación o justificación es obligatoria." };
    }

    const nowStr = new Date().toISOString().slice(0, 10);
    const newStock = Math.max(0, prod.stock - data.quantity);
    const pmpVal = prod.pmp || prod.unitCost;
    const totalLoss = Math.round(data.quantity * pmpVal);

    const newRecord: WasteRecord = {
      id: `wst_${Date.now()}`,
      sku: data.sku,
      productName: prod.name,
      quantity: data.quantity,
      unit: prod.unit,
      pmp: pmpVal,
      totalLoss,
      reason: data.reason,
      observation: data.observation.trim(),
      date: nowStr,
      user: data.user,
    };

    setWasteRecords((prev) => [newRecord, ...prev]);

    // Descontar del stock
    setProducts((prev) =>
      prev.map((p) =>
        p.sku === data.sku
          ? { ...p, stock: p.isBulk ? Number(newStock.toFixed(3)) : newStock }
          : p
      )
    );

    // Movimiento en Cardex
    const cardexEntry: CardexEntry = {
      id: `cdx_${Date.now()}`,
      sku: data.sku,
      productName: prod.name,
      date: nowStr,
      type: "merma",
      typeLabel: "Merma / Pérdida",
      reference: `MERMA-${newRecord.id.slice(-4)} (${data.reason})`,
      qtyIn: 0,
      qtyOut: data.quantity,
      balance: prod.isBulk ? Number(newStock.toFixed(3)) : newStock,
      pmp: pmpVal,
      totalValue: pmpVal * newStock,
    };
    setCardex((prev) => [cardexEntry, ...prev]);

    return { success: true };
  };

  // Conteo Físico (Paso 6)
  const createPhysicalCount = (
    sku: string,
    countedStock: number,
    notes?: string,
    counterUser: string = "Bodeguero Central"
  ) => {
    const prod = products.find((p) => p.sku === sku);
    if (!prod) return { success: false, requiresApproval: false, error: "Insumo no encontrado." };

    const systemStock = prod.stock;
    const diff = countedStock - systemStock;
    const diffPct = systemStock > 0 ? (diff / systemStock) * 100 : diff === 0 ? 0 : 100;
    const pmpVal = prod.pmp || prod.unitCost;
    const diffVal = Math.round(diff * pmpVal);
    const requiresApproval = Math.abs(diffPct) > 5;
    const nowStr = new Date().toISOString().slice(0, 10);

    const newCount: PhysicalCount = {
      id: `cnt_${Date.now()}`,
      sku,
      productName: prod.name,
      systemStock,
      countedStock,
      difference: diff,
      differencePct: Number(diffPct.toFixed(2)),
      pmp: pmpVal,
      differenceValue: diffVal,
      status: requiresApproval ? "pendiente_aprobacion" : "ajustado_directo",
      date: nowStr,
      counterUser,
      notes,
      locked: requiresApproval,
    };

    setPhysicalCounts((prev) => [newCount, ...prev]);

    // Si diferencia <= 5%, se ajusta directo
    if (!requiresApproval) {
      setProducts((prev) =>
        prev.map((p) => (p.sku === sku ? { ...p, stock: countedStock } : p))
      );

      const cardexEntry: CardexEntry = {
        id: `cdx_${Date.now()}`,
        sku,
        productName: prod.name,
        date: nowStr,
        type: "ajuste_conteo",
        typeLabel: "Ajuste Conteo Físico",
        reference: `CONTEO-${newCount.id.slice(-4)} (Directo)`,
        qtyIn: diff > 0 ? diff : 0,
        qtyOut: diff < 0 ? Math.abs(diff) : 0,
        balance: countedStock,
        pmp: pmpVal,
        totalValue: pmpVal * countedStock,
      };
      setCardex((prev) => [cardexEntry, ...prev]);
    }

    return { success: true, requiresApproval };
  };

  const approvePhysicalCount = (id: string, approverName: string) => {
    const count = physicalCounts.find((c) => c.id === id);
    if (!count) return;

    setPhysicalCounts((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: "aprobado", approverUser: approverName, locked: false }
          : c
      )
    );

    setProducts((prev) =>
      prev.map((p) => (p.sku === count.sku ? { ...p, stock: count.countedStock } : p))
    );

    const nowStr = new Date().toISOString().slice(0, 10);
    const cardexEntry: CardexEntry = {
      id: `cdx_${Date.now()}`,
      sku: count.sku,
      productName: count.productName,
      date: nowStr,
      type: "ajuste_conteo",
      typeLabel: "Ajuste Conteo Aprobado",
      reference: `CONTEO-${count.id.slice(-4)} (Aprobado por ${approverName})`,
      qtyIn: count.difference > 0 ? count.difference : 0,
      qtyOut: count.difference < 0 ? Math.abs(count.difference) : 0,
      balance: count.countedStock,
      pmp: count.pmp,
      totalValue: count.pmp * count.countedStock,
    };
    setCardex((prev) => [cardexEntry, ...prev]);
  };

  const rejectPhysicalCount = (id: string, approverName: string) => {
    setPhysicalCounts((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: "rechazado", approverUser: approverName, locked: false }
          : c
      )
    );
  };

  // Kits (Paso 6)
  const createKit = (kit: Kit) => {
    if (kits.some((k) => k.id.toLowerCase() === kit.id.toLowerCase())) {
      return { success: false, error: `Ya existe un kit con el código ${kit.id}.` };
    }
    setKits((prev) => [kit, ...prev]);
    return { success: true };
  };

  const updateKit = (id: string, updates: Partial<Kit>) => {
    setKits((prev) => prev.map((k) => (k.id === id ? { ...k, ...updates } : k)));
  };

  // 2. MATERIAL REQUESTS
  const createMaterialRequest = (
    projectId: string,
    technicianRut: string,
    items: MaterialRequestItem[],
    urgency: "normal" | "alta" | "urgente" = "normal",
    comment?: string
  ) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return { success: false, error: "Proyecto no encontrado." };
    if (proj.status === "cerrado") {
      return { success: false, error: "No se pueden solicitar materiales para un proyecto cerrado." };
    }

    // Check stock
    const missing: string[] = [];
    items.forEach((item) => {
      const prod = products.find((p) => p.sku === item.sku);
      if (!prod || prod.stock < item.quantity) {
        missing.push(
          `${item.name} (${prod ? prod.stock : 0} disponibles vs ${item.quantity} solicitados)`
        );
      }
    });

    if (missing.length > 0) {
      return {
        success: false,
        missingItems: missing,
        error: "Stock insuficiente en bodega para uno o más ítems.",
      };
    }

    const tech = technicians.find((t) => t.rut === technicianRut);
    const newCode = `SOL-2026-${String(materialRequests.length + 101).padStart(3, "0")}`;
    const newReq: MaterialRequest = {
      id: `sol_${Date.now()}`,
      code: newCode,
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      technicianRut: technicianRut,
      technicianName: tech ? tech.name : "Técnico de Terreno",
      date: new Date().toISOString().slice(0, 10),
      urgency,
      status: "pendiente",
      items,
      comment,
      timeline: [
        {
          id: `step_${Date.now()}`,
          title: "Solicitud Creada",
          description: "Ingresada por técnico en terreno",
          date: new Date().toISOString().slice(0, 10),
          author: tech ? tech.name : "Técnico",
          status: "completado",
        },
      ],
    };

    setMaterialRequests((prev) => [newReq, ...prev]);
    return { success: true };
  };

  const approveMaterialRequest = (id: string, authorName: string) => {
    setMaterialRequests((prev) =>
      prev.map((req) => {
        if (req.id !== id) return req;
        const timeline = req.timeline || [];
        const receiptNumber = req.receiptNumber || `COMP-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
        return {
          ...req,
          status: "aprobada",
          receiptNumber,
          timeline: [
            ...timeline,
            {
              id: `tl_${Date.now()}`,
              title: "Aprobada por Administración",
              description: `Autorizado para preparación y egreso. Comprobante N° ${receiptNumber}`,
              date: new Date().toISOString().slice(0, 10),
              author: authorName,
              status: "completado",
            },
          ],
        };
      })
    );
  };

  const rejectMaterialRequest = (id: string, reason: string, authorName: string) => {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "El rechazo exige motivo obligatorio." };
    }
    setMaterialRequests((prev) =>
      prev.map((req) => {
        if (req.id !== id) return req;
        const timeline = req.timeline || [];
        return {
          ...req,
          status: "rechazada",
          rejectionReason: reason,
          timeline: [
            ...timeline,
            {
              id: `tl_${Date.now()}`,
              title: "Rechazada por Administración",
              description: `Motivo: ${reason}`,
              date: new Date().toISOString().slice(0, 10),
              author: authorName,
              status: "completado",
            },
          ],
        };
      })
    );
    return { success: true };
  };

  const modifyMaterialRequest = (id: string, items: MaterialRequestItem[]) => {
    setMaterialRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, items } : req))
    );
  };

  const cancelMaterialRequest = (id: string) => {
    setMaterialRequests((prev) => prev.filter((r) => r.id !== id));
  };

  // Egreso / Despacho de Materiales (Paso 6)
  const dispatchMaterialRequest = (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => {
    const req = materialRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: "Solicitud no encontrada." };
    if (req.status !== "aprobada") {
      return { success: false, error: "Solo se pueden despachar solicitudes aprobadas." };
    }

    // Validar disponibilidad de stock
    for (const it of itemsToDispatch) {
      if (it.quantity <= 0) continue;
      const prod = products.find((p) => p.sku === it.sku);
      if (!prod || prod.stock < it.quantity) {
        return {
          success: false,
          error: `Stock insuficiente para ${prod?.name || it.sku}. Disponible: ${prod?.stock || 0}, a despachar: ${it.quantity}`,
        };
      }
    }

    const nowStr = new Date().toISOString().slice(0, 10);
    const dispatchCode = `DESP-2026-${String(Math.floor(Math.random() * 900) + 100)}`;

    // Descontar stock
    setProducts((prev) =>
      prev.map((p) => {
        const itemD = itemsToDispatch.find((i) => i.sku === p.sku);
        if (!itemD || itemD.quantity <= 0) return p;
        const newStock = Math.max(0, p.stock - itemD.quantity);
        return { ...p, stock: p.isBulk ? Number(newStock.toFixed(3)) : newStock };
      })
    );

    // Agregar movimientos al Cardex
    itemsToDispatch.forEach((itemD) => {
      if (itemD.quantity <= 0) return;
      const prod = products.find((p) => p.sku === itemD.sku);
      if (!prod) return;
      const newBalance = Math.max(0, prod.stock - itemD.quantity);
      const cardexEntry: CardexEntry = {
        id: `cdx_${Date.now()}_${itemD.sku}`,
        sku: itemD.sku,
        productName: prod.name,
        date: nowStr,
        type: "salida_obra",
        typeLabel: "Salida a Obra",
        reference: `${dispatchCode} / ${req.code}`,
        projectCode: req.projectCode,
        projectName: req.projectName,
        qtyIn: 0,
        qtyOut: itemD.quantity,
        balance: prod.isBulk ? Number(newBalance.toFixed(3)) : newBalance,
        pmp: prod.pmp || prod.unitCost,
        totalValue: (prod.pmp || prod.unitCost) * newBalance,
      };
      setCardex((prev) => [cardexEntry, ...prev]);
    });

    // Actualizar cantidades entregadas en la solicitud
    setMaterialRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        const updatedItems = r.items.map((it) => {
          const itemD = itemsToDispatch.find((d) => d.sku === it.sku);
          const addQty = itemD ? itemD.quantity : 0;
          return {
            ...it,
            deliveredQuantity: (it.deliveredQuantity || 0) + addQty,
          };
        });

        const isFullyDelivered = updatedItems.every(
          (it) => (it.deliveredQuantity || 0) >= it.quantity
        );

        const currentTimeline = r.timeline || [];
        const newTimelineStep = {
          id: `step_${Date.now()}`,
          title: isFullyDelivered ? "Egreso Completo en Bodega" : "Egreso Parcial en Bodega",
          description: `Despachado a ${technicianName} (${technicianRut}) bajo comprobante ${dispatchCode}`,
          date: nowStr,
          author: authorName,
          status: "completado" as const,
        };

        return {
          ...r,
          status: isFullyDelivered ? ("entregada" as const) : ("aprobada" as const),
          items: updatedItems,
          timeline: [...currentTimeline, newTimelineStep],
        };
      })
    );

    return { success: true };
  };

  // 3. PURCHASING
  const createPurchaseOrder = (orderData: Partial<PurchaseOrder>) => {
    const code = `OC-2026-${String(purchaseOrders.length + 105).padStart(3, "0")}`;
    const items = orderData.items || [];
    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    const newOrder: PurchaseOrder = {
      id: `oc_${Date.now()}`,
      code,
      supplierId: orderData.supplierId || "sup1",
      supplier: orderData.supplier || "Proveedor Principal",
      supplierRut: orderData.supplierRut,
      status: orderData.status || "borrador",
      isAutoMinStock: Boolean(orderData.isAutoMinStock),
      items,
      subtotal,
      iva,
      total,
      itemsCount: items.length,
      date: new Date().toISOString().slice(0, 10),
      expectedDate:
        orderData.expectedDate ||
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: orderData.notes,
    };

    setPurchaseOrders((prev) => [newOrder, ...prev]);
    return { success: true, orderId: newOrder.id };
  };

  const approveAndSendOrder = (orderId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "enviada" } : o))
    );
  };

  const rateSupplier = (orderId: string, rating: SupplierRating) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cerrada", rating } : o))
    );

    // Update supplier average
    const order = purchaseOrders.find((o) => o.id === orderId);
    if (order && order.supplierId) {
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id !== order.supplierId) return s;
          const newCount = (s.ratingCount || 0) + 1;
          const newAvg = Number(
            (((s.ratingAvg || 0) * (s.ratingCount || 0) + rating.average) / newCount).toFixed(1)
          );
          return { ...s, ratingAvg: newAvg, ratingCount: newCount };
        })
      );
    }
  };

  const createInvoice = (invoice: PurchaseInvoice) => {
    // Check duplicate invoice number per supplier
    const exists = purchaseInvoices.some(
      (inv) =>
        inv.supplierRut.replace(/[.\s-]/g, "") === invoice.supplierRut.replace(/[.\s-]/g, "") &&
        inv.number.trim().toLowerCase() === invoice.number.trim().toLowerCase()
    );
    if (exists) {
      return {
        success: false,
        error: `La factura N° ${invoice.number} ya fue ingresada para este proveedor.`,
      };
    }

    setPurchaseInvoices((prev) => [invoice, ...prev]);

    // Recalculate PMP and update products
    invoice.items.forEach((item) => {
      const prod = products.find((p) => p.sku === item.sku);
      if (prod) {
        const currentStock = prod.stock || 0;
        const currentPmp = prod.pmp || prod.unitCost || 0;
        const incomingQty = item.quantity;
        const incomingCost = item.netUnitPrice;
        const totalQty = currentStock + incomingQty;
        const newPmp =
          totalQty > 0
            ? Math.round((currentStock * currentPmp + incomingQty * incomingCost) / totalQty)
            : incomingCost;

        updateProduct(item.sku, { pmp: newPmp });
      }
    });

    return { success: true };
  };

  const confirmOrderReception = (
    ocCode: string,
    checklist: { sku: string; received: number; defective: number; missing: number }[]
  ) => {
    let hasDefective = false;
    let hasMissing = false;

    checklist.forEach((item) => {
      if (item.defective > 0) hasDefective = true;
      if (item.missing > 0) hasMissing = true;

      // Update product stock and quarantine
      const prod = products.find((p) => p.sku === item.sku);
      if (prod) {
        const newStock = prod.stock + item.received;
        const newQuarantine = (prod.quarantine || 0) + item.defective;
        updateProduct(item.sku, { stock: newStock, quarantine: newQuarantine });

        // Add Cardex entry for received
        if (item.received > 0) {
          const newCardex: CardexEntry = {
            id: `kdx_${Date.now()}_${item.sku}`,
            sku: item.sku,
            productName: prod.name,
            date: new Date().toISOString().slice(0, 10),
            type: "entrada_compra",
            typeLabel: "Entrada por compra",
            reference: ocCode,
            qtyIn: item.received,
            qtyOut: 0,
            balance: newStock,
            pmp: prod.pmp || prod.unitCost,
            totalValue: newStock * (prod.pmp || prod.unitCost),
          };
          setCardex((prev) => [newCardex, ...prev]);
        }
      }
    });

    // Update OC status
    const newStatus = hasMissing ? "recibida_parcial" : "recibida";
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.code === ocCode ? { ...o, status: newStatus } : o))
    );

    // Remove from pending receipts
    setPendingReceipts((prev) => prev.filter((r) => r.ocCode !== ocCode));
  };

  // 4. THIRD PARTIES
  const addSupplier = (supplier: Supplier) => {
    if (suppliers.some((s) => s.rut === supplier.rut)) {
      return { success: false, error: "Ya existe un proveedor con este RUT." };
    }
    setSuppliers((prev) => [supplier, ...prev]);
    return { success: true };
  };

  const addClient = (client: Client) => {
    if (clients.some((c) => c.rut === client.rut)) {
      return { success: false, error: "Ya existe un cliente con este RUT." };
    }
    setClients((prev) => [client, ...prev]);
    return { success: true };
  };

  const toggleSupplierDisabled = (id: string) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, disabled: !s.disabled } : s))
    );
  };

  const toggleClientDisabled = (id: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, disabled: !c.disabled } : c))
    );
  };

  // 5. PROJECTS
  const createProject = (project: Project) => {
    if (projects.some((p) => p.code.trim().toUpperCase() === project.code.trim().toUpperCase())) {
      return { success: false, error: "El código de proyecto ya existe." };
    }
    setProjects((prev) => [project, ...prev]);
    return { success: true };
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    const proj = projects.find((p) => p.id === id);
    if (proj && proj.status === "cerrado") {
      return { success: false, error: "No se puede editar un proyecto que ya está cerrado." };
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    return { success: true };
  };

  const assignTechniciansToProject = (projectId: string, technicianRuts: string[]) => {
    // Unique technicians
    const unique = Array.from(new Set(technicianRuts));
    updateProject(projectId, { technicianRuts: unique });
  };

  const closeProject = (id: string, closedBy: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return { success: false, blocks: ["Proyecto no encontrado."] };

    const blocks: string[] = [];
    // 1. Check pending requests
    const pendingReqs = materialRequests.filter(
      (r) => r.projectId === id && (r.status === "pendiente" || r.status === "aprobada")
    );
    if (pendingReqs.length > 0) {
      blocks.push(
        `${pendingReqs.length} solicitud(es) de material en estado Pendiente o Aprobada sin egresar`
      );
    }

    // 2. Check returns in transit
    const transitReturns = returnOrders.filter(
      (r) => (r.projectId === id || r.projectCode === proj.code) && r.status === "en_transito"
    );
    if (transitReturns.length > 0) {
      blocks.push(
        `${transitReturns.length} devolución(es) de sobrante en tránsito sin confirmar en bodega`
      );
    }

    if (blocks.length > 0) {
      return { success: false, blocks };
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "cerrado",
              closedAt: new Date().toISOString(),
              closedBy,
            }
          : p
      )
    );
    return { success: true };
  };

  // 6. TOOLS
  const createTool = (tool: Tool) => {
    if (tools.some((t) => t.code === tool.code)) {
      return { success: false, error: "El código de herramienta ya existe." };
    }
    setTools((prev) => [tool, ...prev]);
    return { success: true };
  };

  const loanTool = (toolId: string, technicianRut: string, projectCode: string) => {
    const tech = technicians.find((t) => t.rut === technicianRut);
    const proj = projects.find((p) => p.code === projectCode);

    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const newLoan: ToolLoanHistory = {
          id: `loan_${Date.now()}`,
          toolId,
          technicianRut,
          technicianName: tech ? tech.name : "Técnico",
          projectCode,
          projectName: proj ? proj.name : projectCode,
          loanDate: new Date().toISOString().slice(0, 10),
          initialCondition: "Operativo",
        };
        return {
          ...t,
          status: "asignada",
          currentTechnicianRut: technicianRut,
          currentTechnicianName: tech ? tech.name : "Técnico",
          currentProjectCode: projectCode,
          currentProjectName: proj ? proj.name : projectCode,
          currentLoanDate: new Date().toISOString().slice(0, 10),
          loans: [newLoan, ...(t.loans || [])],
        };
      })
    );
  };

  const returnTool = (toolId: string, condition: "bueno" | "danado", notes?: string) => {
    const newStatus = condition === "danado" ? "en_mantencion" : "disponible";
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const loans = (t.loans || []).map((l, idx) =>
          idx === 0
            ? {
                ...l,
                returnDate: new Date().toISOString().slice(0, 10),
                returnCondition: condition,
                returnNotes: notes,
              }
            : l
        );
        return {
          ...t,
          status: newStatus,
          currentTechnicianRut: undefined,
          currentTechnicianName: undefined,
          currentProjectCode: undefined,
          currentProjectName: undefined,
          currentLoanDate: undefined,
          loans,
        };
      })
    );
  };

  const registerToolMaintenance = (toolId: string, record: Omit<ToolMaintenanceRecord, "id">) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const newRec: ToolMaintenanceRecord = {
          ...record,
          id: `mnt_${Date.now()}`,
        };
        return {
          ...t,
          status: "disponible",
          lastMaintenanceDate: record.date,
          nextMaintenanceDate: record.nextMaintenanceDate,
          maintenances: [newRec, ...(t.maintenances || [])],
        };
      })
    );
  };

  // 7. RETURNS
  const createTechnicianReturn = (
    projectId: string,
    technicianRut: string,
    technicianName: string,
    items: ReturnOrderItem[]
  ) => {
    const proj = projects.find((p) => p.id === projectId);
    const code = `DEV-TEC-2026-${String(returnOrders.length + 104).padStart(3, "0")}`;

    // Validate quantityReturned <= quantityRetrieved - quantityUsed
    for (const item of items) {
      const maxAllowed = item.quantityRetrieved - item.quantityUsed;
      if (item.quantityReturned > maxAllowed) {
        return {
          success: false,
          error: `Para ${item.name}, la devolución (${item.quantityReturned}) excede el máximo permitido (${maxAllowed} = ${item.quantityRetrieved} retirado - ${item.quantityUsed} usado).`,
        };
      }
    }

    const newRet: ReturnOrder = {
      id: `dev_${Date.now()}`,
      code,
      projectId,
      projectCode: proj ? proj.code : "PROJ",
      projectName: proj ? proj.name : "Proyecto",
      technicianName,
      technicianRut,
      itemsCount: items.length,
      summary: items.map((i) => `${i.quantityReturned} ${i.unit} ${i.name}`).join(", "),
      date: new Date().toISOString().slice(0, 10),
      status: "en_transito",
      items,
    };

    setReturnOrders((prev) => [newRet, ...prev]);
    return { success: true };
  };

  const confirmWarehouseReturn = (
    returnId: string,
    verifiedItems: { sku: string; quantityReceivedReal: number }[],
    discrepancyNote?: string,
    receivedBy = "Camila Vera"
  ) => {
    setReturnOrders((prev) =>
      prev.map((r) => {
        if (r.id !== returnId) return r;
        const updatedItems = (r.items || []).map((item) => {
          const verified = verifiedItems.find((v) => v.sku === item.sku);
          return {
            ...item,
            quantityReceivedReal: verified ? verified.quantityReceivedReal : item.quantityReturned,
          };
        });

        // Re-integrate verified quantities into inventory stock
        updatedItems.forEach((item) => {
          const qty = item.quantityReceivedReal ?? item.quantityReturned;
          const prod = products.find((p) => p.sku === item.sku);
          if (prod) {
            updateProduct(item.sku, { stock: prod.stock + qty });
            // Add Cardex
            const newCardex: CardexEntry = {
              id: `kdx_ret_${Date.now()}_${item.sku}`,
              sku: item.sku,
              productName: prod.name,
              date: new Date().toISOString().slice(0, 10),
              type: "devolucion",
              typeLabel: "Devolución de obra",
              reference: r.code,
              projectCode: r.projectCode,
              projectName: r.projectName,
              qtyIn: qty,
              qtyOut: 0,
              balance: prod.stock + qty,
              pmp: prod.pmp || prod.unitCost,
              totalValue: (prod.stock + qty) * (prod.pmp || prod.unitCost),
            };
            setCardex((k) => [newCardex, ...k]);
          }
        });

        return {
          ...r,
          status: "recibida",
          items: updatedItems,
          discrepancyNote,
          receivedAt: new Date().toISOString().slice(0, 10),
          receivedBy,
        };
      })
    );
  };

  const createSupplierReturn = (
    supplierId: string,
    sku: string,
    quantity: number,
    reason: string,
    dispatchGuideNumber: string
  ) => {
    const sup = suppliers.find((s) => s.id === supplierId);
    const prod = products.find((p) => p.sku === sku);
    const code = `DEV-PROV-2026-${String(supplierReturns.length + 101).padStart(3, "0")}`;

    const newRet: SupplierReturn = {
      id: `dev_sup_${Date.now()}`,
      code,
      supplierId,
      supplierName: sup ? sup.businessName : "Proveedor",
      supplierRut: sup ? sup.rut : "",
      productSku: sku,
      productName: prod ? prod.name : sku,
      quantity,
      unit: prod ? prod.unit : "un",
      reason,
      dispatchGuideNumber,
      date: new Date().toISOString().slice(0, 10),
      status: "pendiente_resolucion",
    };

    setSupplierReturns((prev) => [newRet, ...prev]);

    // Deduct from quarantine
    if (prod && (prod.quarantine || 0) >= quantity) {
      updateProduct(sku, { quarantine: (prod.quarantine || 0) - quantity });
    }
  };

  const resolveSupplierReturn = (
    returnId: string,
    resolutionType: "nota_credito" | "reemplazo_producto" | "reembolso",
    notes: string
  ) => {
    setSupplierReturns((prev) =>
      prev.map((r) =>
        r.id === returnId
          ? {
              ...r,
              status: "resuelta",
              resolutionType,
              resolutionNotes: notes,
              resolvedAt: new Date().toISOString().slice(0, 10),
            }
          : r
      )
    );
  };

  // 8. TECHNICIAN OPERATIONS
  const createServiceSheet = (sheet: Omit<ServiceSheet, "id">) => {
    const newSheet: ServiceSheet = {
      ...sheet,
      id: `hs_${Date.now()}`,
    };
    setServiceSheets((prev) => [newSheet, ...prev]);
    return { success: true };
  };

  const resolveServiceSheetConflict = (sheetId: string, choice: "local" | "server") => {
    setServiceSheets((prev) =>
      prev.map((s) => {
        if (s.id !== sheetId) return s;
        if (choice === "server" && s.conflictDetails) {
          return {
            ...s,
            hasVersionConflict: false,
            notes: `${s.notes ? s.notes + "\n" : ""}[Actualizado desde Servidor por ${s.conflictDetails.serverAuthor}]: ${s.conflictDetails.serverNotes}`,
            syncStatus: "sincronizado",
          };
        }
        return {
          ...s,
          hasVersionConflict: false,
          syncStatus: "sincronizado",
        };
      })
    );
  };

  const createTechnicianWorkHour = (entry: Omit<TechnicianWorkHour, "id" | "createdAt" | "syncStatus">) => {
    if (entry.hours <= 0 || entry.hours > 24) {
      return { success: false, error: "Las horas deben ser mayores a 0 y máximo 24 horas por día." };
    }
    if ((entry.hours * 10) % 5 !== 0) {
      return { success: false, error: "Las horas deben registrarse en bloques de 0,5 h." };
    }

    const newH: TechnicianWorkHour = {
      ...entry,
      id: `twh_${Date.now()}`,
      createdAt: new Date().toISOString(),
      syncStatus: "sincronizado",
    };
    setTechnicianHours((prev) => [newH, ...prev]);

    // Impute into project labor entries
    const proj = projects.find((p) => p.id === entry.projectId);
    if (proj) {
      const hourlyRate = proj.hourlyRate || 18500;
      const newLaborEntry = {
        id: `hh_${Date.now()}`,
        date: entry.date,
        technicianRut: USERS.technician.rut,
        technicianName: USERS.technician.name,
        hours: entry.hours,
        hourlyCost: hourlyRate,
        totalCost: entry.hours * hourlyRate,
        description: entry.description,
      };
      setProjects((prev) =>
        prev.map((p) =>
          p.id === entry.projectId
            ? {
                ...p,
                hoursReal: (p.hoursReal || 0) + entry.hours,
                costRealHours: (p.costRealHours || 0) + entry.hours * hourlyRate,
                costReal: p.costReal + entry.hours * hourlyRate,
                laborEntries: [newLaborEntry, ...(p.laborEntries || [])],
              }
            : p
        )
      );
    }
    return { success: true };
  };

  const updateTechnicianWorkHour = (id: string, hours: number, description: string) => {
    const existing = technicianHours.find((h) => h.id === id);
    if (!existing) {
      return { success: false, error: "Registro de horas no encontrado." };
    }

    // Check 48 hours limit
    const createdTime = new Date(existing.createdAt).getTime();
    const nowTime = Date.now();
    const diffHours = (nowTime - createdTime) / (1000 * 60 * 60);
    if (diffHours > 48) {
      return { success: false, error: "Este registro supera las 48 horas de antigüedad y está cerrado para edición según normativa contable." };
    }

    if (hours <= 0 || hours > 24) {
      return { success: false, error: "Las horas deben ser mayores a 0 y máximo 24 por día." };
    }
    if ((hours * 10) % 5 !== 0) {
      return { success: false, error: "Las horas deben registrarse en bloques de 0,5 h." };
    }

    setTechnicianHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, hours, description } : h))
    );
    return { success: true };
  };

  const createTechnicianProgressReport = (report: Omit<TechnicianProgressReport, "id" | "syncStatus">) => {
    const newRep: TechnicianProgressReport = {
      ...report,
      id: `tpr_${Date.now()}`,
      syncStatus: "sincronizado",
    };
    setTechnicianProgressReports((prev) => [newRep, ...prev]);

    // Update project progress percentage (does NOT generate inventory dispatch)
    setProjects((prev) =>
      prev.map((p) =>
        p.id === report.projectId ? { ...p, progress: report.progressPct } : p
      )
    );
    return { success: true };
  };

  // 9. ADMINISTRATION & NOTIFICATIONS
  const createSystemUser = (user: Omit<SystemUser, "id" | "createdAt" | "disabled">) => {
    if (systemUsers.some((u) => u.email.trim().toLowerCase() === user.email.trim().toLowerCase())) {
      return { success: false, error: "El correo electrónico ya está registrado." };
    }
    const newId = `usr_${Date.now()}`;
    const newUser: SystemUser = {
      ...user,
      id: newId,
      createdAt: new Date().toISOString(),
      disabled: false,
    };
    setSystemUsers((prev) => [newUser, ...prev]);

    // Audit log
    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "creacion",
      entity: "Usuarios",
      fieldChanged: "Nuevo Usuario",
      oldValue: "-",
      newValue: `${user.name} (${user.role}) - RUT: ${user.rut}`,
      description: `Creación de cuenta con rol ${user.role} y correo ${user.email}`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
    return { success: true };
  };

  const toggleSystemUserDisabled = (userId: string) => {
    const targetUser = systemUsers.find((u) => u.id === userId);
    if (!targetUser) return { success: false, error: "Usuario no encontrado." };

    // Strict Rule: Cannot disable the last active administrator
    if (!targetUser.disabled && targetUser.role === "admin") {
      const activeAdmins = systemUsers.filter((u) => u.role === "admin" && !u.disabled);
      if (activeAdmins.length <= 1) {
        return {
          success: false,
          error: "Operación bloqueada: No es posible deshabilitar al último Administrador activo del sistema.",
        };
      }
    }

    const nextState = !targetUser.disabled;
    setSystemUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, disabled: nextState } : u))
    );

    // Audit log
    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: nextState ? "deshabilitacion" : "modificacion",
      entity: "Usuarios",
      fieldChanged: `Estado ${targetUser.name}`,
      oldValue: targetUser.disabled ? "deshabilitado" : "activo",
      newValue: nextState ? "deshabilitado" : "activo",
      description: `Cambio de estado de acceso para ${targetUser.email}`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
    return { success: true };
  };

  const anonymizeUser = (userId: string) => {
    const targetUser = systemUsers.find((u) => u.id === userId);
    if (!targetUser) return { success: false, error: "Usuario no encontrado." };

    // Cannot anonymize the last active administrator
    if (targetUser.role === "admin" && !targetUser.disabled) {
      const activeAdmins = systemUsers.filter((u) => u.role === "admin" && !u.disabled);
      if (activeAdmins.length <= 1) {
        return {
          success: false,
          error: "Operación bloqueada: No es posible anonimizar al único Administrador activo del sistema.",
        };
      }
    }

    const shortId = targetUser.id.replace(/[^0-9]/g, "").slice(-4) || "0001";
    setSystemUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              rut: "XX.XXX.XXX-X",
              name: `Usuario Anonimizado #${shortId}`,
              email: `anonimo_${shortId}@privacidad.local`,
              phone: "+56 9 0000 0000",
              disabled: true,
            }
          : u
      )
    );

    // Audit log (immutable record of privacy exercise)
    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "anonimizacion",
      entity: "Privacidad",
      fieldChanged: "Datos Personales",
      oldValue: `${targetUser.name} (${targetUser.rut})`,
      newValue: "[DATOS ANONIMIZADOS IRREVERSIBLEMENTE - LEY 19.628]",
      description: `Ejercicio de derecho al olvido y anonimización de titular para ID ${userId}`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
    return { success: true };
  };

  const updateSystemParameter = (id: string, value: string | number) => {
    const param = systemParameters.find((p) => p.id === id);
    if (!param) return;

    setSystemParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value } : p))
    );

    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "modificacion",
      entity: "Parametros",
      fieldChanged: param.name,
      oldValue: param.value,
      newValue: value,
      description: `Actualización de parámetro en módulo ${param.group}`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const resetSystemParameter = (id: string) => {
    const param = systemParameters.find((p) => p.id === id);
    if (!param) return;

    setSystemParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value: p.defaultValue } : p))
    );

    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "modificacion",
      entity: "Parametros",
      fieldChanged: `${param.name} (Restablecido)`,
      oldValue: param.value,
      newValue: param.defaultValue,
      description: `Restablecimiento al valor de fábrica en módulo ${param.group}`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const runManualBackup = () => {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `fyag_backup_${timestampStr}_manual.tar.gz`;
    const newBackup: BackupLogItem = {
      id: `bk_${Date.now()}`,
      filename,
      timestamp: new Date().toISOString(),
      sizeMb: 145.2,
      status: "exito",
      type: "manual",
      restorationStatus: "pendiente",
    };
    setBackupLogs((prev) => [newBackup, ...prev]);

    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "creacion",
      entity: "Respaldos",
      fieldChanged: "Respaldo Manual",
      oldValue: "-",
      newValue: filename,
      description: `Generación manual de copia de seguridad integral (${newBackup.sizeMb} MB)`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
    return { success: true, filename };
  };

  const runRestorationTest = () => {
    // Mark latest backup as tested
    setBackupLogs((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return [
        {
          ...first,
          restorationTestedAt: new Date().toISOString(),
          restorationStatus: "exito",
        },
        ...rest,
      ];
    });

    const auditEntry: AuditLogEntry = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "modificacion",
      entity: "Respaldos",
      fieldChanged: "Prueba de Restauración",
      oldValue: "pendiente",
      newValue: "exito",
      description: "Verificación de integridad y restauración en entorno sandbox de pruebas.",
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
    return { success: true };
  };

  const markAllNotificationsRead = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markNotificationRead = (id: string) => {
    setNotificationsList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <AppContext.Provider
      value={{
        products,
        projects,
        materialRequests,
        purchaseOrders,
        purchaseInvoices,
        pendingReceipts,
        suppliers,
        clients,
        tools,
        returnOrders,
        supplierReturns,
        cardex,
        kits,
        technicians,
        alerts,
        wasteRecords,
        physicalCounts,
        serviceSheets,
        technicianHours,
        technicianProgressReports,
        systemUsers,
        auditLogs,
        systemParameters,
        backupLogs,
        notificationsList,
        addProduct,
        updateProduct,
        toggleProductDisabled,
        createWasteRecord,
        createPhysicalCount,
        approvePhysicalCount,
        rejectPhysicalCount,
        createKit,
        updateKit,
        createMaterialRequest,
        approveMaterialRequest,
        rejectMaterialRequest,
        modifyMaterialRequest,
        cancelMaterialRequest,
        dispatchMaterialRequest,
        createPurchaseOrder,
        approveAndSendOrder,
        rateSupplier,
        createInvoice,
        confirmOrderReception,
        addSupplier,
        addClient,
        toggleSupplierDisabled,
        toggleClientDisabled,
        createProject,
        updateProject,
        assignTechniciansToProject,
        closeProject,
        createTool,
        loanTool,
        returnTool,
        registerToolMaintenance,
        createTechnicianReturn,
        confirmWarehouseReturn,
        createSupplierReturn,
        resolveSupplierReturn,
        createServiceSheet,
        resolveServiceSheetConflict,
        createTechnicianWorkHour,
        updateTechnicianWorkHour,
        createTechnicianProgressReport,
        createSystemUser,
        toggleSystemUserDisabled,
        anonymizeUser,
        updateSystemParameter,
        resetSystemParameter,
        runManualBackup,
        runRestorationTest,
        markAllNotificationsRead,
        markNotificationRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
