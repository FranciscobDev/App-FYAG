import React, { createContext, useContext, useState } from "react";
import {
  MovimientoCardex,
  Cliente,
  AlertaPanel,
  SolicitudMaterial,
  ItemSolicitudMaterial,
  RecepcionPendiente,
  Producto,
  Proyecto,
  RegistroManoObraProyecto,
  FacturaCompra,
  OrdenCompra,
  ItemOrdenCompra,
  OrdenDevolucion,
  ItemOrdenDevolucion,
  HojaServicio,
  Proveedor,
  CalificacionProveedor,
  RegistroAuditoria,
  RegistroRespaldo,
  DetalleNotificacion,
  DevolucionProveedor,
  ParametroSistema,
  UsuarioSistema,
  Tecnico,
  ReporteAvanceTecnico,
  HoraTrabajoTecnico,
  Herramienta,
  HistorialPrestamoHerramienta,
  RegistroMantencionHerramienta,
  RegistroMerma,
  ConteoFisico,
  SesionTrabajoActiva,
  Rol,
} from "@/nucleo/tipos";
import {
  REGISTROS_AUDITORIA,
  REGISTROS_RESPALDO,
  MOVIMIENTOS_CARDEX,
  CLIENTES,
  ALERTAS_PANEL,
  SOLICITUDES_MATERIALES,
  DETALLES_NOTIFICACIONES,
  RECEPCIONES_PENDIENTES,
  CONTEOS_FISICOS,
  PRODUCTOS,
  PROYECTOS,
  FACTURAS_COMPRA,
  ORDENES_COMPRA,
  ORDENES_DEVOLUCION,
  HOJAS_SERVICIO,
  DEVOLUCIONES_PROVEEDOR,
  PROVEEDORES,
  PARAMETROS_SISTEMA,
  USUARIOS_SISTEMA,
  REPORTES_AVANCE_TECNICO,
  HORAS_TRABAJO_TECNICO,
  TECNICOS,
  HERRAMIENTAS,
  USUARIOS,
  REGISTROS_MERMAS,
} from "@/datos/datosSimulados";

interface TipoContextoAplicacion {
  // State
  productos: Producto[];
  proyectos: Proyecto[];
  solicitudesMaterial: SolicitudMaterial[];
  ordenesCompra: OrdenCompra[];
  facturasCompra: FacturaCompra[];
  recepcionesPendientes: RecepcionPendiente[];
  proveedores: Proveedor[];
  clientes: Cliente[];
  herramientas: Herramienta[];
  ordenesDevolucion: OrdenDevolucion[];
  devolucionesProveedor: DevolucionProveedor[];
  cardex: MovimientoCardex[];
  tecnicos: Tecnico[];
  alertas: AlertaPanel[];
  registrosMerma: RegistroMerma[];
  conteosFisicos: ConteoFisico[];

  // Inventory actions
  agregarProducto: (product: Producto) => { success: boolean; error?: string };
  actualizarProducto: (sku: string, updates: Partial<Producto>) => void;
  alternarProductoDeshabilitado: (sku: string) => void;
  crearRegistroMerma: (record: Omit<RegistroMerma, "id" | "date">) => { success: boolean; error?: string };
  crearConteoFisico: (
    sku: string,
    countedStock: number,
    notes?: string,
    counterUser?: string
  ) => { success: boolean; requiresApproval: boolean; error?: string };
  aprobarConteoFisico: (id: string, approverName: string) => void;
  rechazarConteoFisico: (id: string, approverName: string) => void;

  // Request & Dispatch actions
  crearSolicitudMaterial: (
    projectId: string,
    technicianRut: string,
    items: ItemSolicitudMaterial[],
    urgency?: "normal" | "alta" | "urgente",
    comment?: string
  ) => { success: boolean; missingItems?: string[]; error?: string };
  aprobarSolicitudMaterial: (id: string, authorName: string) => void;
  rechazarSolicitudMaterial: (id: string, reason: string, authorName: string) => { success: boolean; error?: string };
  modificarSolicitudMaterial: (id: string, items: ItemSolicitudMaterial[]) => void;
  cancelarSolicitudMaterial: (id: string) => void;
  despacharSolicitudMaterial: (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => { success: boolean; error?: string };

  // Purchasing actions
  crearOrdenCompra: (order: Partial<OrdenCompra>) => { success: boolean; orderId?: string; error?: string };
  aprobarYEnviarOrden: (orderId: string) => void;
  calificarProveedor: (orderId: string, rating: CalificacionProveedor) => void;
  crearFactura: (invoice: FacturaCompra) => { success: boolean; error?: string };
  confirmarRecepcionOrden: (
    ocCode: string,
    checklist: { sku: string; received: number; defective: number; missing: number }[],
    invoiceNumber?: string
  ) => void;

  // Third Parties
  agregarProveedor: (supplier: Proveedor) => { success: boolean; error?: string };
  agregarCliente: (client: Cliente) => { success: boolean; error?: string };
  alternarProveedorDeshabilitado: (id: string) => void;
  alternarClienteDeshabilitado: (id: string) => void;

  // Projects actions
  crearProyecto: (project: Proyecto) => { success: boolean; error?: string };
  actualizarProyecto: (id: string, updates: Partial<Proyecto>) => { success: boolean; error?: string };
  asignarTecnicosAProyecto: (projectId: string, technicianRuts: string[]) => void;
  cerrarProyecto: (id: string, closedBy: string) => { success: boolean; blocks?: string[] };

  // Tools actions
  crearHerramienta: (tool: Herramienta) => { success: boolean; error?: string };
  prestarHerramienta: (toolId: string, technicianRut: string, projectCode: string) => void;
  devolverHerramienta: (toolId: string, condition: "bueno" | "danado", notes?: string) => void;
  registrarMantencionHerramienta: (toolId: string, record: Omit<RegistroMantencionHerramienta, "id">) => void;

  // Returns actions
  crearDevolucionTecnico: (
    projectId: string,
    technicianRut: string,
    technicianName: string,
    items: ItemOrdenDevolucion[]
  ) => { success: boolean; error?: string };
  confirmarDevolucionBodega: (
    returnId: string,
    verifiedItems: { sku: string; quantityReceivedReal: number }[],
    discrepancyNote?: string,
    receivedBy?: string
  ) => void;
  crearDevolucionProveedor: (
    supplierId: string,
    sku: string,
    quantity: number,
    reason: string,
    dispatchGuideNumber: string
  ) => void;
  resolverDevolucionProveedor: (
    returnId: string,
    resolutionType: "nota_credito" | "reemplazo_producto" | "reembolso",
    notes: string
  ) => void;

  // Technician module
  hojasServicio: HojaServicio[];
  horasTecnico: HoraTrabajoTecnico[];
  reportesAvanceTecnico: ReporteAvanceTecnico[];
  sesionTrabajoActiva: SesionTrabajoActiva | null;
  iniciarSesionTrabajo: (projectId: string) => { success: boolean; error?: string };
  detenerSesionTrabajo: (description?: string) => { success: boolean; hours?: number; error?: string };
  cancelarSesionTrabajo: () => void;
  crearHojaServicio: (sheet: Omit<HojaServicio, "id">) => { success: boolean; error?: string };
  resolverConflictoHojaServicio: (sheetId: string, choice: "local" | "server") => void;
  crearHoraTrabajoTecnico: (entry: Omit<HoraTrabajoTecnico, "id" | "createdAt" | "syncStatus">) => { success: boolean; error?: string };
  actualizarHoraTrabajoTecnico: (id: string, hours: number, description: string, userRole?: Rol) => { success: boolean; error?: string };
  registrarHorasManualesAdmin: (data: {
    technicianRut: string;
    technicianName: string;
    projectId: string;
    date: string;
    hours: number;
    description: string;
    reason?: string;
  }) => { success: boolean; error?: string };
  crearReporteAvanceTecnico: (report: Omit<ReporteAvanceTecnico, "id" | "syncStatus">) => { success: boolean };

  // Administration module
  usuariosSistema: UsuarioSistema[];
  registrosAuditoria: RegistroAuditoria[];
  parametrosSistema: ParametroSistema[];
  registrosRespaldo: RegistroRespaldo[];
  listaNotificaciones: DetalleNotificacion[];
  sincronizarUsuariosSistema: (usuarios: UsuarioSistema[]) => void;
  registrarEventoAuditoria: (entry: Omit<RegistroAuditoria, "id" | "timestamp">) => void;
  crearUsuarioSistema: (user: Omit<UsuarioSistema, "id" | "createdAt" | "disabled">) => { success: boolean; error?: string };
  alternarUsuarioSistemaDeshabilitado: (userId: string) => { success: boolean; error?: string };
  anonimizarUsuario: (userId: string) => { success: boolean; error?: string };
  actualizarParametroSistema: (id: string, value: string | number) => void;
  restablecerParametroSistema: (id: string) => void;
  ejecutarRespaldoManual: () => { success: boolean; filename: string };
  ejecutarPruebaRestauracion: () => { success: boolean };
  marcarTodasNotificacionesLeidas: () => void;
  marcarNotificacionLeida: (id: string) => void;
}

const ContextoAplicacion = createContext<TipoContextoAplicacion | null>(null);

export const ProveedorAplicacion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [productos, setProducts] = useState<Producto[]>(PRODUCTOS);
  const [proyectos, setProjects] = useState<Proyecto[]>(PROYECTOS);
  const [solicitudesMaterial, setMaterialRequests] = useState<SolicitudMaterial[]>(SOLICITUDES_MATERIALES);
  const [ordenesCompra, setPurchaseOrders] = useState<OrdenCompra[]>(ORDENES_COMPRA);
  const [facturasCompra, setPurchaseInvoices] = useState<FacturaCompra[]>(FACTURAS_COMPRA);
  const [recepcionesPendientes, setPendingReceipts] = useState<RecepcionPendiente[]>(RECEPCIONES_PENDIENTES);
  const [proveedores, setSuppliers] = useState<Proveedor[]>(PROVEEDORES);
  const [clientes, setClients] = useState<Cliente[]>(CLIENTES);
  const [herramientas, setTools] = useState<Herramienta[]>(HERRAMIENTAS);
  const [ordenesDevolucion, setReturnOrders] = useState<OrdenDevolucion[]>(ORDENES_DEVOLUCION);
  const [devolucionesProveedor, setSupplierReturns] = useState<DevolucionProveedor[]>(DEVOLUCIONES_PROVEEDOR);
  const [cardex, setCardex] = useState<MovimientoCardex[]>(MOVIMIENTOS_CARDEX);
  const [tecnicos] = useState<Tecnico[]>(TECNICOS);
  const [alertas, setAlerts] = useState<AlertaPanel[]>(ALERTAS_PANEL);
  const [registrosMerma, setWasteRecords] = useState<RegistroMerma[]>(REGISTROS_MERMAS);
  const [conteosFisicos, setPhysicalCounts] = useState<ConteoFisico[]>(CONTEOS_FISICOS);
  const [hojasServicio, setServiceSheets] = useState<HojaServicio[]>(HOJAS_SERVICIO);
  const [horasTecnico, setTechnicianHours] = useState<HoraTrabajoTecnico[]>(HORAS_TRABAJO_TECNICO);
  const [sesionTrabajoActiva, setActiveWorkSession] = useState<SesionTrabajoActiva | null>(null);
  const [reportesAvanceTecnico, setTechnicianProgressReports] = useState<ReporteAvanceTecnico[]>(REPORTES_AVANCE_TECNICO);
  const [usuariosSistema, setSystemUsers] = useState<UsuarioSistema[]>(USUARIOS_SISTEMA);
  const [registrosAuditoria, setAuditLogs] = useState<RegistroAuditoria[]>(REGISTROS_AUDITORIA);
  const [parametrosSistema, setSystemParameters] = useState<ParametroSistema[]>(PARAMETROS_SISTEMA);
  const [registrosRespaldo, setBackupLogs] = useState<RegistroRespaldo[]>(REGISTROS_RESPALDO);
  const [listaNotificaciones, setNotificationsList] = useState<DetalleNotificacion[]>(DETALLES_NOTIFICACIONES);

  // 1. INVENTORY
  const agregarProducto = (product: Producto) => {
    if (productos.some((p) => p.sku.trim().toUpperCase() === product.sku.trim().toUpperCase())) {
      return { success: false, error: `El SKU ${product.sku} ya está registrado.` };
    }
    setProducts((prev) => [product, ...prev]);
    return { success: true };
  };

  const actualizarProducto = (sku: string, updates: Partial<Producto>) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, ...updates } : p))
    );
  };

  const alternarProductoDeshabilitado = (sku: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, disabled: !p.disabled } : p))
    );
  };

  // Mermas (Paso 6)
  const crearRegistroMerma = (data: Omit<RegistroMerma, "id" | "date">) => {
    const prod = productos.find((p) => p.sku === data.sku);
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

    const newRecord: RegistroMerma = {
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
    const cardexEntry: MovimientoCardex = {
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
  const crearConteoFisico = (
    sku: string,
    countedStock: number,
    notes?: string,
    counterUser: string = "Bodeguero Central"
  ) => {
    const prod = productos.find((p) => p.sku === sku);
    if (!prod) return { success: false, requiresApproval: false, error: "Insumo no encontrado." };

    const systemStock = prod.stock;
    const diff = countedStock - systemStock;
    const diffPct = systemStock > 0 ? (diff / systemStock) * 100 : diff === 0 ? 0 : 100;
    const pmpVal = prod.pmp || prod.unitCost;
    const diffVal = Math.round(diff * pmpVal);
    const requiresApproval = Math.abs(diffPct) > 5;
    const nowStr = new Date().toISOString().slice(0, 10);

    const newCount: ConteoFisico = {
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

      const cardexEntry: MovimientoCardex = {
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

  const aprobarConteoFisico = (id: string, approverName: string) => {
    const count = conteosFisicos.find((c) => c.id === id);
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
    const cardexEntry: MovimientoCardex = {
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

  const rechazarConteoFisico = (id: string, approverName: string) => {
    setPhysicalCounts((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: "rechazado", approverUser: approverName, locked: false }
          : c
      )
    );
  };

  // 2. MATERIAL REQUESTS
  const crearSolicitudMaterial = (
    projectId: string,
    technicianRut: string,
    items: ItemSolicitudMaterial[],
    urgency: "normal" | "alta" | "urgente" = "normal",
    comment?: string
  ) => {
    const proj = proyectos.find((p) => p.id === projectId);
    if (!proj) return { success: false, error: "Proyecto no encontrado." };
    if (proj.status === "cerrado") {
      return { success: false, error: "No se pueden solicitar materiales para un proyecto cerrado." };
    }

    // Check stock
    const missing: string[] = [];
    items.forEach((item) => {
      const prod = productos.find((p) => p.sku === item.sku);
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

    const tech = tecnicos.find((t) => t.rut === technicianRut);
    const newCode = `SOL-2026-${String(solicitudesMaterial.length + 101).padStart(3, "0")}`;
    const newReq: SolicitudMaterial = {
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

  const aprobarSolicitudMaterial = (id: string, authorName: string) => {
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

  const rechazarSolicitudMaterial = (id: string, reason: string, authorName: string) => {
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

  const modificarSolicitudMaterial = (id: string, items: ItemSolicitudMaterial[]) => {
    setMaterialRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, items } : req))
    );
  };

  const cancelarSolicitudMaterial = (id: string) => {
    setMaterialRequests((prev) => prev.filter((r) => r.id !== id));
  };

  // Egreso / Despacho de Materiales (Paso 6)
  const despacharSolicitudMaterial = (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => {
    const req = solicitudesMaterial.find((r) => r.id === requestId);
    if (!req) return { success: false, error: "Solicitud no encontrada." };
    if (req.status !== "aprobada") {
      return { success: false, error: "Solo se pueden despachar solicitudes aprobadas." };
    }

    // Validar disponibilidad de stock
    for (const it of itemsToDispatch) {
      if (it.quantity <= 0) continue;
      const prod = productos.find((p) => p.sku === it.sku);
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
      const prod = productos.find((p) => p.sku === itemD.sku);
      if (!prod) return;
      const newBalance = Math.max(0, prod.stock - itemD.quantity);
      const cardexEntry: MovimientoCardex = {
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
  const crearOrdenCompra = (orderData: Partial<OrdenCompra>) => {
    const code = `OC-2026-${String(ordenesCompra.length + 105).padStart(3, "0")}`;
    const items = orderData.items || [];
    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    const newOrder: OrdenCompra = {
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

  const aprobarYEnviarOrden = (orderId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "enviada" } : o))
    );
  };

  const calificarProveedor = (orderId: string, rating: CalificacionProveedor) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cerrada", rating } : o))
    );

    // Update supplier average
    const order = ordenesCompra.find((o) => o.id === orderId);
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

  const crearFactura = (invoice: FacturaCompra) => {
    // Check duplicate invoice number per supplier
    const exists = facturasCompra.some(
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
      const prod = productos.find((p) => p.sku === item.sku);
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

        actualizarProducto(item.sku, { pmp: newPmp });
      }
    });

    return { success: true };
  };

  const confirmarRecepcionOrden = (
    ocCode: string,
    checklist: { sku: string; received: number; defective: number; missing: number }[],
    invoiceNumber?: string
  ) => {
    const activePo = ordenesCompra.find((o) => o.code === ocCode);
    const linkedInvoice = facturasCompra.find(
      (inv) => (invoiceNumber && inv.number === invoiceNumber) || inv.orderCode === ocCode
    );

    const discrepancyDetails: string[] = [];

    checklist.forEach((item) => {
      const prod = productos.find((p) => p.sku === item.sku);
      const poItem = activePo?.items.find((i) => i.sku === item.sku);
      const invItem = linkedInvoice?.items.find((i) => i.sku === item.sku);

      const pendingBefore = poItem ? Math.max(0, poItem.quantity - (poItem.receivedQuantity || 0)) : 0;
      if (item.defective > 0) {
        discrepancyDetails.push(`${item.sku}: ${item.defective} defectuosos/dañados`);
      }
      if (item.received + item.defective < pendingBefore) {
        discrepancyDetails.push(`${item.sku}: faltante de ${Number((pendingBefore - (item.received + item.defective)).toFixed(3))} ${poItem?.unit || "un"}`);
      }

      if (prod) {
        const prevStock = prod.stock;
        const prevPmp = prod.pmp || prod.unitCost || 0;
        // Costo neto unitario proveniente de la factura (descuentos en cascada aplicados) o de la OC
        const incomingUnitCost = invItem?.netUnitPrice ?? poItem?.unitPrice ?? prod.unitCost;

        const newStock = Number((prevStock + item.received).toFixed(3));
        const newQuarantine = Number(((prod.quarantine || 0) + item.defective).toFixed(3));

        // Recálculo del PMP Ponderado con el costo neto de la factura
        let newPmp = prevPmp;
        if (item.received > 0) {
          const totalPrevValue = prevStock * prevPmp;
          const incomingValue = item.received * incomingUnitCost;
          newPmp = newStock > 0 ? Math.round((totalPrevValue + incomingValue) / newStock) : prevPmp;
        }

        actualizarProducto(item.sku, {
          stock: newStock,
          quarantine: newQuarantine,
          pmp: newPmp,
        });

        // Add Cardex entry for received
        if (item.received > 0) {
          const newCardex: MovimientoCardex = {
            id: `kdx_${Date.now()}_${item.sku}`,
            sku: item.sku,
            productName: prod.name,
            date: new Date().toISOString().slice(0, 10),
            type: "entrada_compra",
            typeLabel: "Entrada por compra",
            reference: linkedInvoice ? `${ocCode} / Fac: ${linkedInvoice.number}` : ocCode,
            qtyIn: item.received,
            qtyOut: 0,
            balance: newStock,
            pmp: newPmp,
            totalValue: Math.round(newStock * newPmp),
          };
          setCardex((prev) => [newCardex, ...prev]);
        }
      }
    });

    // Update OC items with cumulative received quantities
    let allCompleted = true;
    setPurchaseOrders((prev) =>
      prev.map((o) => {
        if (o.code !== ocCode) return o;
        const updatedItems = o.items.map((it) => {
          const check = checklist.find((c) => c.sku === it.sku);
          if (!check) return it;
          const recTotal = Number(((it.receivedQuantity || 0) + check.received).toFixed(3));
          const defTotal = Number(((it.defectiveQuantity || 0) + check.defective).toFixed(3));
          const rem = Math.max(0, it.quantity - recTotal);
          if (rem > 0) {
            allCompleted = false;
          }
          return {
            ...it,
            receivedQuantity: recTotal,
            defectiveQuantity: defTotal,
            missingQuantity: rem,
          };
        });

        const newStatus = allCompleted ? ("recibida" as const) : ("recibida_parcial" as const);
        return {
          ...o,
          status: newStatus,
          items: updatedItems,
          invoiceNumber: invoiceNumber || linkedInvoice?.number || o.invoiceNumber,
        };
      })
    );

    // Remove from pending receipts only if all items have arrived
    if (allCompleted) {
      setPendingReceipts((prev) => prev.filter((r) => r.ocCode !== ocCode));
    }

    // Discrepancy notification & alert to Administrator
    if (discrepancyDetails.length > 0) {
      const alert: AlertaPanel = {
        id: `alert_rec_${Date.now()}`,
        title: `Discrepancia en Recepción ${ocCode}`,
        description: `Recepción física difiere de lo ordenado/facturado: ${discrepancyDetails.join(", ")}.`,
        type: "stock",
        severity: "rojo",
        time: "Ahora mismo",
        actionLabel: "Ver OC",
      };
      setAlerts((prev) => [alert, ...prev]);

      const notif: DetalleNotificacion = {
        id: `notif_rec_${Date.now()}`,
        title: `Discrepancia en Recepción ${ocCode}`,
        message: `El bodeguero registró discrepancias en la OC ${ocCode}: ${discrepancyDetails.join(", ")}.`,
        date: new Date().toISOString().slice(0, 10),
        type: "stock",
        severity: "warn",
        read: false,
        relatedEntityType: "orden_compra",
        relatedEntityId: ocCode,
        relatedEntityLabel: ocCode,
      };
      setNotificationsList((prev) => [notif, ...prev]);
    }
  };

  // 4. THIRD PARTIES
  const agregarProveedor = (supplier: Proveedor) => {
    if (proveedores.some((s) => s.rut === supplier.rut)) {
      return { success: false, error: "Ya existe un proveedor con este RUT." };
    }
    setSuppliers((prev) => [supplier, ...prev]);
    return { success: true };
  };

  const agregarCliente = (client: Cliente) => {
    if (clientes.some((c) => c.rut === client.rut)) {
      return { success: false, error: "Ya existe un cliente con este RUT." };
    }
    setClients((prev) => [client, ...prev]);
    return { success: true };
  };

  const alternarProveedorDeshabilitado = (id: string) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, disabled: !s.disabled } : s))
    );
  };

  const alternarClienteDeshabilitado = (id: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, disabled: !c.disabled } : c))
    );
  };

  // 5. PROJECTS
  const crearProyecto = (project: Proyecto) => {
    if (proyectos.some((p) => p.code.trim().toUpperCase() === project.code.trim().toUpperCase())) {
      return { success: false, error: "El código de proyecto ya existe." };
    }
    setProjects((prev) => [project, ...prev]);
    return { success: true };
  };

  const actualizarProyecto = (id: string, updates: Partial<Proyecto>) => {
    const proj = proyectos.find((p) => p.id === id);
    if (proj && proj.status === "cerrado") {
      return { success: false, error: "No se puede editar un proyecto que ya está cerrado." };
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    return { success: true };
  };

  const asignarTecnicosAProyecto = (projectId: string, technicianRuts: string[]) => {
    // Unique technicians
    const unique = Array.from(new Set(technicianRuts));
    actualizarProyecto(projectId, { technicianRuts: unique });
  };

  const cerrarProyecto = (id: string, closedBy: string) => {
    const proj = proyectos.find((p) => p.id === id);
    if (!proj) return { success: false, blocks: ["Proyecto no encontrado."] };

    const blocks: string[] = [];
    // 1. Check pending requests
    const pendingReqs = solicitudesMaterial.filter(
      (r) => r.projectId === id && (r.status === "pendiente" || r.status === "aprobada")
    );
    if (pendingReqs.length > 0) {
      blocks.push(
        `${pendingReqs.length} solicitud(es) de material en estado Pendiente o Aprobada sin egresar`
      );
    }

    // 2. Check returns in transit
    const transitReturns = ordenesDevolucion.filter(
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
  const crearHerramienta = (tool: Herramienta) => {
    if (herramientas.some((t) => t.code === tool.code)) {
      return { success: false, error: "El código de herramienta ya existe." };
    }
    setTools((prev) => [tool, ...prev]);
    return { success: true };
  };

  const prestarHerramienta = (toolId: string, technicianRut: string, projectCode: string) => {
    const tech = tecnicos.find((t) => t.rut === technicianRut);
    const proj = proyectos.find((p) => p.code === projectCode);

    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const newLoan: HistorialPrestamoHerramienta = {
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

  const devolverHerramienta = (toolId: string, condition: "bueno" | "danado", notes?: string) => {
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

  const registrarMantencionHerramienta = (toolId: string, record: Omit<RegistroMantencionHerramienta, "id">) => {
    setTools((prev) =>
      prev.map((t) => {
        if (t.id !== toolId) return t;
        const newRec: RegistroMantencionHerramienta = {
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
  const crearDevolucionTecnico = (
    projectId: string,
    technicianRut: string,
    technicianName: string,
    items: ItemOrdenDevolucion[]
  ) => {
    const proj = proyectos.find((p) => p.id === projectId);
    const code = `DEV-TEC-2026-${String(ordenesDevolucion.length + 104).padStart(3, "0")}`;

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

    const newRet: OrdenDevolucion = {
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

  const confirmarDevolucionBodega = (
    returnId: string,
    verifiedItems: { sku: string; quantityReceivedReal: number }[],
    discrepancyNote?: string,
    receivedBy = "Camila Vera"
  ) => {
    setReturnOrders((prev) =>
      prev.map((r) => {
        if (r.id !== returnId) return r;
        const returnDiscrepancies: string[] = [];

        const updatedItems = (r.items || []).map((item) => {
          const verified = verifiedItems.find((v) => v.sku === item.sku);
          const realQty = verified ? verified.quantityReceivedReal : item.quantityReturned;
          if (realQty !== item.quantityReturned) {
            returnDiscrepancies.push(
              `${item.sku}: declarado ${item.quantityReturned} ${item.unit}, verificado físico ${realQty} ${item.unit}`
            );
          }
          return {
            ...item,
            quantityReceivedReal: realQty,
          };
        });

        // Re-integrate verified quantities into inventory stock
        let totalReturnedValue = 0;
        updatedItems.forEach((item) => {
          const qty = item.quantityReceivedReal ?? item.quantityReturned;
          const prod = productos.find((p) => p.sku === item.sku);
          if (prod) {
            const itemPmp = prod.pmp || prod.unitCost || 0;
            totalReturnedValue += qty * itemPmp;
            actualizarProducto(item.sku, { stock: Number((prod.stock + qty).toFixed(3)) });
            // Add Cardex
            const newCardex: MovimientoCardex = {
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
              balance: Number((prod.stock + qty).toFixed(3)),
              pmp: itemPmp,
              totalValue: Math.round((prod.stock + qty) * itemPmp),
            };
            setCardex((k) => [newCardex, ...k]);
          }
        });

        // Ajustar costo real del proyecto (se descuenta el sobrante reingresado a bodega)
        if (r.projectCode && totalReturnedValue > 0) {
          setProjects((prevProj) =>
            prevProj.map((p) =>
              p.code === r.projectCode
                ? {
                  ...p,
                  costReal: Math.max(0, p.costReal - totalReturnedValue),
                  costRealMaterials: Math.max(0, (p.costRealMaterials || 0) - totalReturnedValue),
                }
                : p
            )
          );
        }

        // Notificar al Administrador si hubo diferencia entre lo declarado por el técnico y lo recibido
        if (returnDiscrepancies.length > 0) {
          const alert: AlertaPanel = {
            id: `alert_ret_${Date.now()}`,
            title: `Discrepancia en Devolución de Obra: ${r.code}`,
            description: `Técnico ${r.technicianName} entregó cantidades distintas a las declaradas: ${returnDiscrepancies.join("; ")}.`,
            type: "stock",
            severity: "amarillo",
            time: "Ahora mismo",
            actionLabel: "Ver Devolución",
          };
          setAlerts((prevA) => [alert, ...prevA]);

          const notif: DetalleNotificacion = {
            id: `notif_ret_${Date.now()}`,
            title: `Diferencia en Devolución ${r.code}`,
            message: `Bodeguero registró diferencia física en devolución de ${r.technicianName} (${r.projectName}): ${returnDiscrepancies.join("; ")}.`,
            date: new Date().toISOString().slice(0, 10),
            type: "stock",
            severity: "warn",
            read: false,
            relatedEntityType: "proyecto",
            relatedEntityId: r.projectCode,
            relatedEntityLabel: r.code,
          };
          setNotificationsList((prevN) => [notif, ...prevN]);
        }

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

  const crearDevolucionProveedor = (
    supplierId: string,
    sku: string,
    quantity: number,
    reason: string,
    dispatchGuideNumber: string
  ) => {
    const sup = proveedores.find((s) => s.id === supplierId);
    const prod = productos.find((p) => p.sku === sku);
    const code = `DEV-PROV-2026-${String(devolucionesProveedor.length + 101).padStart(3, "0")}`;

    const newRet: DevolucionProveedor = {
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
      actualizarProducto(sku, { quarantine: Math.max(0, (prod.quarantine || 0) - quantity) });

      // Cardex entry for trace of departure from quarantine
      const newCardex: MovimientoCardex = {
        id: `kdx_supret_${Date.now()}_${sku}`,
        sku,
        productName: prod.name,
        date: new Date().toISOString().slice(0, 10),
        type: "devolucion",
        typeLabel: "Salida devolución proveedor (Cuarentena)",
        reference: `Guía: ${dispatchGuideNumber}`,
        qtyIn: 0,
        qtyOut: quantity,
        balance: prod.stock,
        pmp: prod.pmp || prod.unitCost,
        totalValue: Math.round(prod.stock * (prod.pmp || prod.unitCost)),
      };
      setCardex((k) => [newCardex, ...k]);
    }

    // Alerta al Administrador para seguimiento hasta Nota de Crédito o reposición
    const alert: AlertaPanel = {
      id: `alert_supret_${Date.now()}`,
      title: `Devolución a Proveedor: ${sup?.businessName || "Proveedor"}`,
      description: `Se despacharon ${quantity} ${prod?.unit || "un"} de ${prod?.name || sku} por falla (Guía ${dispatchGuideNumber}). Dar seguimiento a reposición o Nota de Crédito.`,
      type: "costo",
      severity: "amarillo",
      time: "Ahora mismo",
      actionLabel: "Ver Devoluciones",
    };
    setAlerts((prevA) => [alert, ...prevA]);

    const notif: DetalleNotificacion = {
      id: `notif_supret_${Date.now()}`,
      title: `Salida de Cuarentena a Proveedor`,
      message: `Bodega despachó ${quantity} ${prod?.unit || "un"} a ${sup?.businessName || "proveedor"} con Guía N° ${dispatchGuideNumber}. Pendiente resolución contable.`,
      date: new Date().toISOString().slice(0, 10),
      type: "stock",
      severity: "info",
      read: false,
      relatedEntityType: "orden_compra",
      relatedEntityId: dispatchGuideNumber,
      relatedEntityLabel: code,
    };
    setNotificationsList((prevN) => [notif, ...prevN]);
  };

  const resolverDevolucionProveedor = (
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
  const crearHojaServicio = (sheet: Omit<HojaServicio, "id">) => {
    const newSheet: HojaServicio = {
      ...sheet,
      id: `hs_${Date.now()}`,
    };
    setServiceSheets((prev) => [newSheet, ...prev]);
    return { success: true };
  };

  const resolverConflictoHojaServicio = (sheetId: string, choice: "local" | "server") => {
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

  const crearHoraTrabajoTecnico = (entry: Omit<HoraTrabajoTecnico, "id" | "createdAt" | "syncStatus">) => {
    if (entry.hours <= 0 || entry.hours > 24) {
      return { success: false, error: "Las horas deben ser mayores a 0 y máximo 24 horas por día." };
    }
    if ((entry.hours * 10) % 5 !== 0) {
      return { success: false, error: "Las horas deben registrarse en bloques de 0,5 h." };
    }

    const newH: HoraTrabajoTecnico = {
      ...entry,
      id: `twh_${Date.now()}`,
      createdAt: new Date().toISOString(),
      syncStatus: "sincronizado",
    };
    setTechnicianHours((prev) => [newH, ...prev]);

    // Impute into project labor entries
    const proj = proyectos.find((p) => p.id === entry.projectId);
    if (proj) {
      const hourlyRate = proj.hourlyRate || 18500;
      const newLaborEntry = {
        id: `hh_${Date.now()}`,
        date: entry.date,
        technicianRut: USUARIOS.technician.rut,
        technicianName: USUARIOS.technician.name,
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

  const iniciarSesionTrabajo = (projectId: string) => {
    const proj = proyectos.find((p) => p.id === projectId);
    if (!proj) {
      return { success: false, error: "Proyecto no encontrado." };
    }
    const session: SesionTrabajoActiva = {
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      startTime: new Date().toISOString(),
      hourlyRate: proj.hourlyRate || 18500,
    };
    setActiveWorkSession(session);
    return { success: true };
  };

  const detenerSesionTrabajo = (description?: string) => {
    if (!sesionTrabajoActiva) {
      return { success: false, error: "No hay una jornada de trabajo activa." };
    }
    const startTimeMs = new Date(sesionTrabajoActiva.startTime).getTime();
    const elapsedHours = (Date.now() - startTimeMs) / (1000 * 60 * 60);
    // Redondeo automático a bloques de 0,5 h (mínimo 0.5, máximo 24)
    const roundedHours = Math.max(0.5, Math.min(24.0, Math.round(elapsedHours * 2) / 2));

    const res = crearHoraTrabajoTecnico({
      projectId: sesionTrabajoActiva.projectId,
      projectCode: sesionTrabajoActiva.projectCode,
      projectName: sesionTrabajoActiva.projectName,
      date: new Date().toISOString().slice(0, 10),
      hours: roundedHours,
      description: description?.trim() || "Jornada registrada automáticamente al finalizar trabajo en faena.",
    });

    if (res.success) {
      setActiveWorkSession(null);
      return { success: true, hours: roundedHours };
    }
    return res;
  };

  const cancelarSesionTrabajo = () => {
    setActiveWorkSession(null);
  };

  const actualizarHoraTrabajoTecnico = (
    id: string,
    hours: number,
    description: string,
    userRole: Rol = "technician"
  ) => {
    const existing = horasTecnico.find((h) => h.id === id);
    if (!existing) {
      return { success: false, error: "Registro de horas no encontrado." };
    }

    // Check 48 hours limit: technician only up to 48h, admin can always edit
    const createdTime = new Date(existing.createdAt).getTime();
    const nowTime = Date.now();
    const diffHours = (nowTime - createdTime) / (1000 * 60 * 60);
    if (diffHours > 48 && userRole === "technician") {
      return {
        success: false,
        error:
          "Este registro supera las 48 horas de antigüedad. Según normativa, solo un Administrador puede editarlo.",
      };
    }

    if (hours <= 0 || hours > 24) {
      return { success: false, error: "Las horas deben ser mayores a 0 y máximo 24 por día." };
    }
    if ((hours * 10) % 5 !== 0) {
      return { success: false, error: "Las horas deben registrarse en bloques de 0,5 h." };
    }

    const hourDiff = hours - existing.hours;
    const proj = proyectos.find((p) => p.id === existing.projectId);
    const hourlyRate = proj?.hourlyRate || 18500;

    setTechnicianHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, hours, description } : h))
    );

    // Sincronizar imputación en el proyecto (alimenta H27 y H28)
    if (proj && hourDiff !== 0) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === existing.projectId
            ? {
              ...p,
              hoursReal: Math.max(0, (p.hoursReal || 0) + hourDiff),
              costRealHours: Math.max(0, (p.costRealHours || 0) + hourDiff * hourlyRate),
              costReal: Math.max(0, p.costReal + hourDiff * hourlyRate),
            }
            : p
        )
      );
    }

    return { success: true };
  };

  const registrarHorasManualesAdmin = (data: {
    technicianRut: string;
    technicianName: string;
    projectId: string;
    date: string;
    hours: number;
    description: string;
    reason?: string;
  }) => {
    if (data.hours <= 0 || data.hours > 24) {
      return { success: false, error: "Las horas deben ser mayores a 0 y máximo 24 horas por día." };
    }
    if ((data.hours * 10) % 5 !== 0) {
      return { success: false, error: "Las horas deben registrarse en bloques de 0,5 h." };
    }
    if (!data.date) {
      return { success: false, error: "Debe ingresar una fecha válida (YYYY-MM-DD)." };
    }

    const proj = proyectos.find((p) => p.id === data.projectId);
    if (!proj) {
      return { success: false, error: "Proyecto no encontrado." };
    }

    // Comprobar tope diario de 24h para ese técnico en esa fecha
    const existingDayHours = horasTecnico
      .filter(
        (h) =>
          (h.technicianRut === data.technicianRut || (!h.technicianRut && USUARIOS.technician.rut === data.technicianRut)) &&
          h.date === data.date
      )
      .reduce((sum, h) => sum + h.hours, 0);

    if (existingDayHours + data.hours > 24) {
      return {
        success: false,
        error: `El técnico ${data.technicianName} ya registra ${existingDayHours} HH el ${data.date}. El total diario no puede exceder las 24 h.`,
      };
    }

    const hourlyRate = proj.hourlyRate || 18500;
    const totalCost = data.hours * hourlyRate;

    const newH: HoraTrabajoTecnico = {
      id: `twh_${Date.now()}`,
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      date: data.date,
      hours: data.hours,
      description: data.description?.trim() || "Carga manual extraordinaria por Administración.",
      createdAt: new Date().toISOString(),
      syncStatus: "sincronizado",
      technicianRut: data.technicianRut,
      technicianName: data.technicianName,
      registeredBy: "admin_manual",
      reason: data.reason || "Carga manual extraordinaria en terreno",
    };

    setTechnicianHours((prev) => [newH, ...prev]);

    // Imputar al proyecto (H27 y H28)
    const newLaborEntry: RegistroManoObraProyecto = {
      id: `hh_${Date.now()}`,
      date: data.date,
      technicianRut: data.technicianRut,
      technicianName: data.technicianName,
      hours: data.hours,
      hourlyCost: hourlyRate,
      totalCost: totalCost,
      description: data.reason
        ? `[Carga Admin: ${data.reason}] ${data.description}`
        : data.description,
      registeredBy: "admin_manual",
      reason: data.reason,
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === data.projectId
          ? {
            ...p,
            hoursReal: (p.hoursReal || 0) + data.hours,
            costRealHours: (p.costRealHours || 0) + totalCost,
            costReal: p.costReal + totalCost,
            laborEntries: [newLaborEntry, ...(p.laborEntries || [])],
          }
          : p
      )
    );

    // Registro de auditoría
    const auditEntry: RegistroAuditoria = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRut: "12.456.789-5",
      userName: "Javier Muñoz Contreras",
      userRole: "admin",
      action: "creacion",
      entity: "Proyectos",
      fieldChanged: "Carga Manual Admin",
      oldValue: "-",
      newValue: `${data.hours} HH - ${data.technicianName} en ${proj.code}`,
      description: `Carga manual de ${data.hours} HH para el técnico ${data.technicianName} en ${proj.code}. Motivo: ${data.reason || "Carga administrativa extraordinaria"}.`,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);

    return { success: true };
  };

  const crearReporteAvanceTecnico = (report: Omit<ReporteAvanceTecnico, "id" | "syncStatus">) => {
    const newRep: ReporteAvanceTecnico = {
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
  const sincronizarUsuariosSistema = (usuarios: UsuarioSistema[]) => {
    setSystemUsers(usuarios);
  };

  const registrarEventoAuditoria = (entry: Omit<RegistroAuditoria, "id" | "timestamp">) => {
    const auditEntry: RegistroAuditoria = {
      ...entry,
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const crearUsuarioSistema = (user: Omit<UsuarioSistema, "id" | "createdAt" | "disabled">) => {
    if (usuariosSistema.some((u) => u.email.trim().toLowerCase() === user.email.trim().toLowerCase())) {
      return { success: false, error: "El correo electrónico ya está registrado." };
    }
    const newId = `usr_${Date.now()}`;
    const newUser: UsuarioSistema = {
      ...user,
      id: newId,
      createdAt: new Date().toISOString(),
      disabled: false,
    };
    setSystemUsers((prev) => [newUser, ...prev]);

    // Audit log
    const auditEntry: RegistroAuditoria = {
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

  const alternarUsuarioSistemaDeshabilitado = (userId: string) => {
    const targetUser = usuariosSistema.find((u) => u.id === userId);
    if (!targetUser) return { success: false, error: "Usuario no encontrado." };

    // Strict Rule: Cannot disable the last active administrator
    if (!targetUser.disabled && targetUser.role === "admin") {
      const activeAdmins = usuariosSistema.filter((u) => u.role === "admin" && !u.disabled);
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
    const auditEntry: RegistroAuditoria = {
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

  const anonimizarUsuario = (userId: string) => {
    const targetUser = usuariosSistema.find((u) => u.id === userId);
    if (!targetUser) return { success: false, error: "Usuario no encontrado." };

    // Cannot anonymize the last active administrator
    if (targetUser.role === "admin" && !targetUser.disabled) {
      const activeAdmins = usuariosSistema.filter((u) => u.role === "admin" && !u.disabled);
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
    const auditEntry: RegistroAuditoria = {
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

  const actualizarParametroSistema = (id: string, value: string | number) => {
    const param = parametrosSistema.find((p) => p.id === id);
    if (!param) return;

    setSystemParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value } : p))
    );

    const auditEntry: RegistroAuditoria = {
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

  const restablecerParametroSistema = (id: string) => {
    const param = parametrosSistema.find((p) => p.id === id);
    if (!param) return;

    setSystemParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value: p.defaultValue } : p))
    );

    const auditEntry: RegistroAuditoria = {
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

  const ejecutarRespaldoManual = () => {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `fyag_backup_${timestampStr}_manual.tar.gz`;
    const newBackup: RegistroRespaldo = {
      id: `bk_${Date.now()}`,
      filename,
      timestamp: new Date().toISOString(),
      sizeMb: 145.2,
      status: "exito",
      type: "manual",
      restorationStatus: "pendiente",
    };
    setBackupLogs((prev) => [newBackup, ...prev]);

    const auditEntry: RegistroAuditoria = {
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

  const ejecutarPruebaRestauracion = () => {
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

    const auditEntry: RegistroAuditoria = {
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

  const marcarTodasNotificacionesLeidas = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const marcarNotificacionLeida = (id: string) => {
    setNotificationsList((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <ContextoAplicacion.Provider
      value={{
        productos,
        proyectos,
        solicitudesMaterial,
        ordenesCompra,
        facturasCompra,
        recepcionesPendientes,
        proveedores,
        clientes,
        herramientas,
        ordenesDevolucion,
        devolucionesProveedor,
        cardex,
        tecnicos,
        alertas,
        registrosMerma,
        conteosFisicos,
        hojasServicio,
        horasTecnico,
        reportesAvanceTecnico,
        sesionTrabajoActiva,
        iniciarSesionTrabajo,
        detenerSesionTrabajo,
        cancelarSesionTrabajo,
        usuariosSistema,
        registrosAuditoria,
        parametrosSistema,
        registrosRespaldo,
        listaNotificaciones,
        agregarProducto,
        actualizarProducto,
        alternarProductoDeshabilitado,
        crearRegistroMerma,
        crearConteoFisico,
        aprobarConteoFisico,
        rechazarConteoFisico,
        crearSolicitudMaterial,
        aprobarSolicitudMaterial,
        rechazarSolicitudMaterial,
        modificarSolicitudMaterial,
        cancelarSolicitudMaterial,
        despacharSolicitudMaterial,
        crearOrdenCompra,
        aprobarYEnviarOrden,
        calificarProveedor,
        crearFactura,
        confirmarRecepcionOrden,
        agregarProveedor,
        agregarCliente,
        alternarProveedorDeshabilitado,
        alternarClienteDeshabilitado,
        crearProyecto,
        actualizarProyecto,
        asignarTecnicosAProyecto,
        cerrarProyecto,
        crearHerramienta,
        prestarHerramienta,
        devolverHerramienta,
        registrarMantencionHerramienta,
        crearDevolucionTecnico,
        confirmarDevolucionBodega,
        crearDevolucionProveedor,
        resolverDevolucionProveedor,
        crearHojaServicio,
        resolverConflictoHojaServicio,
        crearHoraTrabajoTecnico,
        actualizarHoraTrabajoTecnico,
        registrarHorasManualesAdmin,
        crearReporteAvanceTecnico,
        sincronizarUsuariosSistema,
        registrarEventoAuditoria,
        crearUsuarioSistema,
        alternarUsuarioSistemaDeshabilitado,
        anonimizarUsuario,
        actualizarParametroSistema,
        restablecerParametroSistema,
        ejecutarRespaldoManual,
        ejecutarPruebaRestauracion,
        marcarTodasNotificacionesLeidas,
        marcarNotificacionLeida,
      }}
    >
      {children}
    </ContextoAplicacion.Provider>
  );
};

export const usarAplicacion = () => {
  const context = useContext(ContextoAplicacion);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
