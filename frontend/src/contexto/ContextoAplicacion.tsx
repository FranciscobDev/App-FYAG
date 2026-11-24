import React, { createContext, useContext, useEffect, useState } from "react";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { guardarCache, leerCache } from "@/nucleo/cacheLocal";
import {
  listarArticulosApi,
  crearArticuloApi,
  actualizarArticuloApi,
  articuloAProducto,
  productoACuerpoArticulo,
} from "@/modulos/inventario/articulosApi";
import { listarProyectos, proyectoDesdeApi } from "@/modulos/proyectos/proyectosApi";
import {
  crearSolicitudInsumosApi,
  listarSolicitudesApi,
  solicitudDesdeApi,
} from "@/modulos/solicitudes/solicitudesApi";
import {
  aprobarOrdenCompraApi,
  actualizarOrdenCompraApi,
  cambiarEstadoOrdenCompraApi,
  crearOrdenCompraApi,
  listarOrdenesCompraApi,
  mapearEstadoHaciaBd,
  ordenCompraDesdeApi,
  registrarRecepcionOrdenCompraApi,
} from "@/modulos/compras/ordenesCompraApi";
import { aplicarEntregaChecklistEnOrden } from "@/modulos/compras/recepcionChecklistUtils";
import {
  ComprobanteAprobacionSolicitud,
  aplicarReservaComprometidoEnCatalogoH6,
  construirComprobanteYNotificacionAprobacion,
  construirNotificacionRechazoSolicitud,
  ejecutarSalidaFisicaSolicitudEnMemoria,
  esProyectoActivoParaSolicitud,
  liberarReservaComprometidoEnCatalogoH6,
  validarFormularioNuevaSolicitudInsumos,
} from "@/modulos/inventario/solicitudInsumosUtils";
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
  agregarProducto: (product: Producto) => Promise<{ success: boolean; error?: string }>;
  actualizarProducto: (sku: string, updates: Partial<Producto>) => Promise<{ success: boolean; error?: string }>;
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

  // Acciones de solicitudes y despacho de materiales
  crearSolicitudMaterial: (
    projectId: string,
    technicianRut: string,
    items: ItemSolicitudMaterial[],
    urgency?: "normal" | "alta" | "urgente",
    comment?: string,
    requesterInfo?: { name?: string; role?: Rol }
  ) => Promise<{ success: boolean; missingItems?: string[]; error?: string }>;
  aprobarSolicitudMaterial: (
    id: string,
    authorName: string
  ) => {
    success: boolean;
    receiptNumber?: string;
    solicitud?: SolicitudMaterial;
    error?: string;
  };
  rechazarSolicitudMaterial: (id: string, reason: string, authorName: string) => { success: boolean; error?: string };
  modificarSolicitudMaterial: (
    id: string,
    items: ItemSolicitudMaterial[],
    opciones?: {
      projectId?: string;
      urgency?: SolicitudMaterial["urgency"];
      comment?: string;
      authorName?: string;
    }
  ) => { success: boolean; error?: string; missingItems?: string[] };
  cancelarSolicitudMaterial: (
    id: string,
    authorName?: string
  ) => { success: boolean; error?: string };
  despacharSolicitudMaterial: (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => {
    success: boolean;
    error?: string;
    dispatchCode?: string;
    esEntregaCompleta?: boolean;
  };

  // Acciones de compras y órdenes
  crearOrdenCompra: (order: Partial<OrdenCompra>) => {
    success: boolean;
    orderId?: string;
    code?: string;
    error?: string;
  };
  actualizarOrdenCompra: (
    orderId: string,
    updates: Partial<OrdenCompra>
  ) => { success: boolean; error?: string };
  aprobarYEnviarOrden: (orderId: string) => void;
  anularOrdenCompra: (orderId: string) => { success: boolean; error?: string };
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
  actualizarProveedor: (id: string, updates: Partial<Proveedor>) => { success: boolean };
  actualizarCliente: (id: string, updates: Partial<Cliente>) => { success: boolean };
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
  darDeBajaHerramienta: (
    toolId: string,
    motivo: string,
    responsable?: string
  ) => { success: boolean; error?: string };

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

  // Módulo técnico (cronómetro automático, horas y soporte offline)
  hojasServicio: HojaServicio[];
  horasTecnico: HoraTrabajoTecnico[];
  reportesAvanceTecnico: ReporteAvanceTecnico[];
  sesionTrabajoActiva: SesionTrabajoActiva | null;
  iniciarSesionTrabajo: (projectId: string) => { success: boolean; error?: string };
  detenerSesionTrabajo: (
    description?: string,
    opciones?: { offline?: boolean }
  ) => {
    success: boolean;
    hours?: number;
    syncStatus?: "pendiente" | "sincronizado";
    registro?: HoraTrabajoTecnico;
    error?: string;
  };
  cancelarSesionTrabajo: () => void;
  sincronizarHorasTrabajoPendientes: () => number;
  restaurarEstadoHorasOffline: (
    sesion: SesionTrabajoActiva | null,
    horasGuardadas: HoraTrabajoTecnico[]
  ) => void;
  crearHojaServicio: (sheet: Omit<HojaServicio, "id">) => {
    success: boolean;
    hoja?: HojaServicio;
    error?: string;
  };
  resolverConflictoHojaServicio: (sheetId: string, choice: "local" | "server") => void;
  sincronizarHojasServicioPendientes: () => number;
  restaurarHojasServicioOffline: (hojasGuardadas: HojaServicio[]) => void;
  crearHoraTrabajoTecnico: (
    entry: Omit<HoraTrabajoTecnico, "id" | "createdAt" | "syncStatus">,
    syncStatus?: "pendiente" | "sincronizado"
  ) => { success: boolean; registro?: HoraTrabajoTecnico; error?: string };
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
  const [proyectos, setProjects] = useState<Proyecto[]>([]);
  const [solicitudesMaterial, setMaterialRequests] = useState<SolicitudMaterial[]>(SOLICITUDES_MATERIALES);
  const [ordenesCompra, setPurchaseOrders] = useState<OrdenCompra[]>(ORDENES_COMPRA);
  const [facturasCompra, setPurchaseInvoices] = useState<FacturaCompra[]>(FACTURAS_COMPRA);
  const [recepcionesPendientes, setPendingReceipts] = useState<RecepcionPendiente[]>(RECEPCIONES_PENDIENTES);
  const [proveedores, setSuppliers] = useState<Proveedor[]>(PROVEEDORES);
  const [clientes, setClients] = useState<Cliente[]>(CLIENTES);
  const [herramientas, setTools] = useState<Herramienta[]>(HERRAMIENTAS);
  const [ordenesDevolucion, setReturnOrders] = useState<OrdenDevolucion[]>(ORDENES_DEVOLUCION);
  const [devolucionesHidratadas, establecerDevolucionesHidratadas] = useState(false);

  // Sincronización persistente de devoluciones entre Bodeguero y móvil del Técnico
  useEffect(() => {
    let cancelado = false;
    void leerCache<OrdenDevolucion[]>("ordenes_devolucion_compartidas").then((registro) => {
      if (!cancelado && registro && Array.isArray(registro.datos) && registro.datos.length > 0) {
        setReturnOrders(registro.datos);
      }
      if (!cancelado) {
        establecerDevolucionesHidratadas(true);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!devolucionesHidratadas) return;
    void guardarCache<OrdenDevolucion[]>("ordenes_devolucion_compartidas", ordenesDevolucion);
  }, [devolucionesHidratadas, ordenesDevolucion]);
  const [devolucionesProveedor, setSupplierReturns] = useState<DevolucionProveedor[]>(DEVOLUCIONES_PROVEEDOR);
  const [devolucionesProvHidratadas, establecerDevolucionesProvHidratadas] = useState(false);

  // Sincronización persistente de devoluciones a proveedor entre Bodeguero y Administrador
  useEffect(() => {
    let cancelado = false;
    void leerCache<DevolucionProveedor[]>("devoluciones_proveedor_compartidas").then((registro) => {
      if (!cancelado && registro && Array.isArray(registro.datos) && registro.datos.length > 0) {
        setSupplierReturns(registro.datos);
      }
      if (!cancelado) {
        establecerDevolucionesProvHidratadas(true);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!devolucionesProvHidratadas) return;
    void guardarCache<DevolucionProveedor[]>("devoluciones_proveedor_compartidas", devolucionesProveedor);
  }, [devolucionesProvHidratadas, devolucionesProveedor]);
  const [cardex, setCardex] = useState<MovimientoCardex[]>(MOVIMIENTOS_CARDEX);
  const [tecnicos] = useState<Tecnico[]>(TECNICOS);
  const [alertas, setAlerts] = useState<AlertaPanel[]>(ALERTAS_PANEL);
  const [registrosMerma, setWasteRecords] = useState<RegistroMerma[]>(REGISTROS_MERMAS);
  const [conteosFisicos, setPhysicalCounts] = useState<ConteoFisico[]>(CONTEOS_FISICOS);
  const [conteosHidratados, establecerConteosHidratados] = useState(false);

  // Sincronización persistente de conteos físicos entre Bodeguero y bandeja de aprobación del Administrador
  useEffect(() => {
    let cancelado = false;
    void leerCache<ConteoFisico[]>("conteos_fisicos_compartidos").then((registro) => {
      if (!cancelado && registro && Array.isArray(registro.datos) && registro.datos.length > 0) {
        setPhysicalCounts(registro.datos);
      }
      if (!cancelado) {
        establecerConteosHidratados(true);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!conteosHidratados) return;
    void guardarCache<ConteoFisico[]>("conteos_fisicos_compartidos", conteosFisicos);
  }, [conteosHidratados, conteosFisicos]);
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
  // Catálogo desde la API al iniciar sesión. Los campos que la base no guarda se conservan en memoria.
  const { haySesion } = usarAutenticacion();
  useEffect(() => {
    if (!haySesion) return;
    let cancelado = false;
    listarArticulosApi().then((filas) => {
      if (!filas || cancelado) return;
      setProducts((prev) =>
        filas.map((fila) => {
          const producto = articuloAProducto(fila);
          const local = prev.find((p) => p.sku === producto.sku);
          return { ...local, ...producto, unit: local?.unit ?? producto.unit };
        })
      );
    });
    return () => {
      cancelado = true;
    };
  }, [haySesion]);

  // Proyectos desde la API. Para técnicos, el backend devuelve solo sus asignaciones activas.
  useEffect(() => {
    if (!haySesion) return;
    let cancelado = false;
    const cargar = () => {
      listarProyectos().then((r) => {
        if (!r.ok || !r.data || cancelado) return;
        setProjects(r.data.map(proyectoDesdeApi));
      });
    };
    cargar();
    const intervalo = setInterval(cargar, 30000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [haySesion]);

  // Solicitudes de material desde la base de datos al iniciar sesión.
  // Si el servidor no responde, se conserva la lista que ya está en pantalla.
  useEffect(() => {
    if (!haySesion) return;
    let cancelado = false;
    listarSolicitudesApi().then((r) => {
      if (!r.ok || !r.data || cancelado) return;
      setMaterialRequests(
        r.data.map((fila) =>
          solicitudDesdeApi(
            fila,
            proyectos.find((p) => p.id === String(fila.id_proyecto)),
            productos
          )
        )
      );
    });
    return () => {
      cancelado = true;
    };
  }, [haySesion]);

  // Órdenes de Compra desde la API al iniciar sesión
  useEffect(() => {
    if (!haySesion) return;
    let cancelado = false;
    listarOrdenesCompraApi().then((r) => {
      if (!r.ok || !r.data || cancelado || r.data.length === 0) return;
      setPurchaseOrders(r.data.map(ordenCompraDesdeApi));
    });
    return () => {
      cancelado = true;
    };
  }, [haySesion]);

  const agregarProducto = async (product: Producto): Promise<{ success: boolean; error?: string }> => {
    if (productos.some((p) => p.sku.trim().toUpperCase() === product.sku.trim().toUpperCase())) {
      return { success: false, error: `El SKU ${product.sku} ya está registrado.` };
    }
    const respuesta = await crearArticuloApi(productoACuerpoArticulo(product));
    if (respuesta.ok === false) {
      return { success: false, error: (respuesta as { ok: false; mensaje: string }).mensaje };
    }
    const { articulo } = respuesta;
    setProducts((prev) => [
      {
        ...product,
        id: articulo.id_articulo,
        sku: articulo.sku ?? product.sku,
        stock: Number(articulo.cantidad_disponible ?? product.stock),
      },
      ...prev,
    ]);
    return { success: true };
  };

  /** Registra alerta automática cuando un insumo alcanza o baja de su stock mínimo. */
  const verificarYGenerarOcAutomaticaPorStockMinimo = (productoEvaluado: Producto) => {
    if (productoEvaluado.disabled || productoEvaluado.stock > productoEvaluado.minStock) {
      return;
    }
    setAlerts((prev) => {
      const yaExiste = prev.some((a) => a.id === `al_min_${productoEvaluado.sku}`);
      if (yaExiste) return prev;
      return [
        {
          id: `al_min_${productoEvaluado.sku}`,
          title: `Stock Mínimo Alcanzado: ${productoEvaluado.sku}`,
          description: `${productoEvaluado.name} quedó en ${productoEvaluado.stock} ${productoEvaluado.unit} (mínimo: ${productoEvaluado.minStock}).`,
          type: "stock",
          severity: "rojo",
          time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ];
    });
  };

  const actualizarProducto = async (
    sku: string,
    updates: Partial<Producto>
  ): Promise<{ success: boolean; error?: string }> => {
    const previo = productos.find((p) => p.sku === sku);
    if (previo) {
      const candidato = { ...previo, ...updates };
      if (candidato.stock <= candidato.minStock) {
        verificarYGenerarOcAutomaticaPorStockMinimo(candidato);
      }
    }
    // Cambio optimista en pantalla; si el servidor lo rechaza, se revierte
    setProducts((prev) => prev.map((p) => (p.sku === sku ? { ...p, ...updates } : p)));

    const cuerpo = productoACuerpoArticulo(updates);
    if (!previo?.id || Object.keys(cuerpo).length === 0) {
      return { success: true };
    }

    const respuesta = await actualizarArticuloApi(previo.id, cuerpo);
    if (respuesta.ok === false) {
      setProducts((prev) => prev.map((p) => (p.sku === sku ? previo : p)));
      return { success: false, error: (respuesta as { ok: false; mensaje: string }).mensaje };
    }
    return { success: true };
  };

  const alternarProductoDeshabilitado = (sku: string) => {
    const actual = productos.find((p) => p.sku === sku);
    if (!actual) return;
    void actualizarProducto(sku, { disabled: !actual.disabled });
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
    verificarYGenerarOcAutomaticaPorStockMinimo({
      ...prod,
      stock: prod.isBulk ? Number(newStock.toFixed(3)) : newStock,
    });

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
      userName: data.user || "Camila Vera Soto",
      userRole: "Bodeguero",
      userRut: "15.321.654-2",
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
        typeLabel: "Ajuste Conteo Físico (≤ 5%)",
        reference: `CONTEO-${newCount.id.slice(-4)} (Directo)`,
        qtyIn: diff > 0 ? diff : 0,
        qtyOut: diff < 0 ? Math.abs(diff) : 0,
        balance: countedStock,
        pmp: pmpVal,
        totalValue: Math.round(pmpVal * countedStock),
        userName: counterUser || "Camila Vera Soto",
        userRole: "Bodeguero",
        userRut: "15.321.654-2",
      };
      setCardex((prev) => [cardexEntry, ...prev]);
    } else {
      // Notificación al Administrador cuando la diferencia supera el umbral del 5 %
      const notifRetenido: DetalleNotificacion = {
        id: `notif_cnt_ret_${Date.now()}`,
        title: `Conteo Físico Retenido (> 5%): ${sku}`,
        message: `${counterUser} registró diferencia de ${diff > 0 ? `+${diff}` : diff} ${prod.unit} (${diffPct.toFixed(1)}%) en ${prod.name}. Requiere aprobación de Administración.`,
        date: nowStr,
        type: "stock",
        severity: "warn",
        read: false,
        relatedEntityType: "insumo",
        relatedEntityId: sku,
        relatedEntityLabel: prod.name,
      };
      setNotificationsList((prev) => [notifRetenido, ...prev]);
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
      userName: approverName || "Javier Muñoz Contreras",
      userRole: "Administrador",
      userRut: "12.456.789-5",
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

  // 2. GESTIÓN DE SOLICITUDES DE MATERIALES
  const crearSolicitudMaterial = async (
    projectId: string,
    technicianRut: string,
    items: ItemSolicitudMaterial[],
    urgency: "normal" | "alta" | "urgente" = "normal",
    comment?: string,
    requesterInfo?: { name?: string; role?: Rol }
  ): Promise<{ success: boolean; missingItems?: string[]; error?: string }> => {
    const proj = proyectos.find((p) => p.id === projectId) || null;
    if (!proj) return { success: false, error: "Proyecto no encontrado." };
    if (proj.status === "cerrado") {
      return { success: false, error: "No se pueden solicitar materiales para un proyecto cerrado." };
    }

    // La solicitud solo existe si la base de datos la guarda. El servidor valida stock y estado del proyecto.
    const respuesta = await crearSolicitudInsumosApi({
      idProyecto: Number(proj.id),
      items: items.map((it) => ({ sku: it.sku, cantidad: it.quantity })),
      comentario: comment,
      urgencia: urgency,
    });
    if (!respuesta.ok || !respuesta.data) {
      return { success: false, error: respuesta.error ?? "No se pudo guardar la solicitud." };
    }

    const ahoraFecha = new Date().toISOString().slice(0, 10);
    const tech = tecnicos.find((t) => t.rut === technicianRut);
    const idSolicitud = respuesta.data.solicitud.id_solicitud;
    const newCode = `SOL-${ahoraFecha.slice(0, 4)}-${String(idSolicitud).padStart(3, "0")}`;
    const newReq: SolicitudMaterial = {
      id: `sol_${idSolicitud}`,
      code: newCode,
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      technicianRut: technicianRut,
      technicianName: tech ? tech.name : "Técnico de Terreno",
      date: ahoraFecha,
      urgency,
      status: "pendiente",
      items,
      comment,
      timeline: [
        {
          id: `step_${Date.now()}`,
          title: "Solicitud Creada",
          description: "Ingresada por técnico en terreno",
          date: ahoraFecha,
          author: tech ? tech.name : "Técnico",
          status: "completado",
        },
        {
          id: `step_rev_${Date.now()}`,
          title: "En revisión de administración",
          description: "Pendiente de aprobación o rechazo en bandeja administrativa",
          date: ahoraFecha,
          author: "Administración",
          status: "actual",
        },
      ],
    };

    // [FRONT-1 / H6] El stock solicitado pasa inmediatamente de Disponible a Comprometido
    setProducts((prev) => aplicarReservaComprometidoEnCatalogoH6(prev, items));
    setMaterialRequests((prev) => [newReq, ...prev]);

    // Emitir alerta en vivo (H3) para la campana de notificaciones superior (web y móvil)
    const solicitanteNombre = requesterInfo?.name || (tech ? tech.name : "Técnico de Terreno");
    const totalUnidades = items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const nuevaNotifSolicitud: DetalleNotificacion = {
      id: `notif_sol_${Date.now()}`,
      title: `Nueva Solicitud de Material: ${newCode}`,
      message: `${solicitanteNombre} solicitó ${items.length} ítem(s) (${totalUnidades} un.) para ${proj.name} (${proj.code}). Urgencia: ${urgency.toUpperCase()}.`,
      date: ahoraFecha,
      type: "solicitud",
      severity: urgency === "urgente" ? "danger" : "warn",
      read: false,
      relatedEntityType: "solicitud",
      relatedEntityId: newReq.id,
      relatedEntityLabel: `Revisar ${newCode}`,
    };
    setNotificationsList((prev) => [nuevaNotifSolicitud, ...prev]);
    setAlerts((prev) => [
      {
        id: `al_sol_${Date.now()}`,
        type: "solicitud",
        severity: urgency === "urgente" ? "rojo" : "amarillo",
        title: `Nueva solicitud pendiente: ${newCode}`,
        description: `${proj.code} • ${items.length} ítem(s) solicitados por ${solicitanteNombre}.`,
        time: "Ahora mismo",
        actionLabel: "Revisar Solicitud",
      },
      ...prev,
    ]);

    return { success: true };
  };

  const aprobarSolicitudMaterial = (id: string, authorName: string) => {
    const actual = solicitudesMaterial.find((r) => r.id === id);
    if (!actual) {
      return { success: false, error: "Solicitud no encontrada." };
    }
    if (actual.status !== "pendiente") {
      return {
        success: false,
        error: `La solicitud ${actual.code} ya fue procesada (${actual.status.toUpperCase()}).`,
      };
    }

    const ahoraFecha = new Date().toISOString().slice(0, 10);
    const receiptNumber =
      actual.receiptNumber ||
      `COMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const solicitudAprobada: SolicitudMaterial = {
      ...actual,
      status: "aprobada",
      receiptNumber,
      approvedBy: authorName,
      approvedAt: ahoraFecha,
      timeline: [
        ...(actual.timeline || []),
        {
          id: `tl_${Date.now()}`,
          title: "Aprobada por Administración",
          description: `Autorizado para preparación y egreso. Comprobante N° ${receiptNumber}`,
          date: ahoraFecha,
          author: authorName,
          status: "completado",
        },
      ],
    };

    setMaterialRequests((prev) =>
      prev.map((req) => (req.id === id ? solicitudAprobada : req))
    );

    setNotificationsList((prev) => [
      {
        id: `notif_apr_${Date.now()}`,
        title: `Solicitud Aprobada: ${actual.code}`,
        message: `Aprobada por ${authorName}. Comprobante N° ${receiptNumber} listo para egreso en bodega.`,
        date: ahoraFecha,
        type: "solicitud",
        severity: "ok",
        read: false,
        relatedEntityType: "solicitud",
        relatedEntityId: actual.id,
        relatedEntityLabel: actual.code,
      },
      ...prev,
    ]);

    return {
      success: true,
      receiptNumber,
      solicitud: solicitudAprobada,
    };
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

  const modificarSolicitudMaterial = (
    id: string,
    items: ItemSolicitudMaterial[],
    opciones?: {
      projectId?: string;
      urgency?: SolicitudMaterial["urgency"];
      comment?: string;
      authorName?: string;
    }
  ) => {
    const actual = solicitudesMaterial.find((r) => r.id === id);
    if (!actual) {
      return { success: false, error: "Solicitud no encontrada." };
    }
    if (actual.status !== "pendiente") {
      return {
        success: false,
        error: `No es posible editar la solicitud ${actual.code} porque se encuentra en estado ${actual.status.toUpperCase()}.`,
      };
    }

    const proyectoIdDestino = opciones?.projectId || actual.projectId;
    const proyectoDestino = proyectos.find((p) => p.id === proyectoIdDestino) || null;
    const catalogoLiberado = liberarReservaComprometidoEnCatalogoH6(productos, actual.items);
    const validacion = validarFormularioNuevaSolicitudInsumos(
      proyectoDestino,
      items.map((it) => ({ sku: it.sku, quantity: it.quantity })),
      catalogoLiberado
    );

    if (!validacion.esValida) {
      return {
        success: false,
        error: validacion.errorGeneral || "No se pudo actualizar la solicitud.",
        missingItems: validacion.faltantesStock,
      };
    }

    const catalogoReservado = aplicarReservaComprometidoEnCatalogoH6(catalogoLiberado, items);
    setProducts(catalogoReservado);

    const ahoraStr = new Date().toLocaleString("es-CL", { hour12: false });
    const editor = opciones?.authorName || "Bodeguero";
    const totalEstimado = items.reduce((acc, it) => {
      const prod = productos.find((p) => p.sku === it.sku);
      return acc + (prod ? prod.unitCost * it.quantity : 0);
    }, 0);

    setMaterialRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              projectId: proyectoIdDestino,
              projectCode: proyectoDestino?.code || req.projectCode,
              projectName: proyectoDestino?.name || req.projectName,
              items,
              urgency: opciones?.urgency || req.urgency,
              comment: opciones?.comment !== undefined ? opciones.comment : req.comment,
              totalEstimatedValue: totalEstimado,
              timeline: [
                ...(req.timeline || []),
                {
                  id: `tl_edit_${Date.now()}`,
                  title: "Solicitud Editada (Pendiente)",
                  description: "Ítems y reserva de stock comprometido actualizados por el bodeguero.",
                  date: ahoraStr,
                  author: editor,
                  status: "completado",
                },
              ],
            }
          : req
      )
    );
    return { success: true };
  };

  const cancelarSolicitudMaterial = (id: string, authorName?: string) => {
    const actual = solicitudesMaterial.find((r) => r.id === id);
    if (!actual) {
      return { success: false, error: "Solicitud no encontrada." };
    }
    if (actual.status !== "pendiente") {
      return {
        success: false,
        error: `No es posible anular la solicitud ${actual.code} porque se encuentra en estado ${actual.status.toUpperCase()}.`,
      };
    }

    const catalogoLiberado = liberarReservaComprometidoEnCatalogoH6(productos, actual.items);
    setProducts(catalogoLiberado);

    const ahoraStr = new Date().toLocaleString("es-CL", { hour12: false });
    const responsable = authorName || "Bodeguero";

    setMaterialRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              status: "anulada",
              timeline: [
                ...(req.timeline || []),
                {
                  id: `tl_anul_${Date.now()}`,
                  title: "Solicitud Anulada por Bodeguero",
                  description: "Stock reservado liberado al inventario disponible.",
                  date: ahoraStr,
                  author: responsable,
                  status: "completado",
                },
              ],
            }
          : req
      )
    );
    return { success: true };
  };

  // [FRONT-1] Egreso / Registro de Salida Física de Materiales (Paso 6)
  const despacharSolicitudMaterial = (
    requestId: string,
    itemsToDispatch: { sku: string; quantity: number }[],
    technicianRut: string,
    technicianName: string,
    authorName: string
  ) => {
    const req = solicitudesMaterial.find((r) => r.id === requestId);
    if (!req) return { success: false, error: "Solicitud no encontrada." };

    const resultado = ejecutarSalidaFisicaSolicitudEnMemoria({
      solicitud: req,
      itemsToDispatch,
      technicianRut,
      technicianName,
      authorName,
      catalogo: productos,
    });

    if (!resultado.success || !resultado.solicitudActualizada || !resultado.registroEgresoInmutable) {
      return {
        success: false,
        error: resultado.error || "No se pudo registrar la salida física.",
      };
    }

    const nowStr = resultado.registroEgresoInmutable.date;
    const dispatchCode = resultado.registroEgresoInmutable.dispatchCode;

    // 1. Descontar stock en una sola transacción (consumiendo primero de comprometido y luego de disponible)
    setProducts(resultado.catalogoActualizado);

    // 2. Registrar movimientos irreversibles en el Cardex vinculados al proyecto y al técnico que retira
    const nuevosMovimientosCardex: MovimientoCardex[] = resultado.registroEgresoInmutable.items.map((itemD) => {
      const prodActualizado = resultado.catalogoActualizado.find(
        (p) => p.sku.trim().toUpperCase() === itemD.sku.trim().toUpperCase()
      );
      const newBalance = Number(
        ((prodActualizado?.stock || 0) + (prodActualizado?.committed || 0)).toFixed(3)
      );
      const unitPmp = prodActualizado?.pmp || prodActualizado?.unitCost || itemD.unitCost;
      return {
        id: `cdx_${Date.now()}_${itemD.sku}`,
        sku: itemD.sku,
        productName: itemD.name,
        date: nowStr,
        type: "salida_obra",
        typeLabel: `Salida a Obra (Retira: ${technicianName})`,
        reference: `${dispatchCode} / ${req.receiptNumber || req.code}`,
        projectCode: req.projectCode,
        projectName: req.projectName,
        qtyIn: 0,
        qtyOut: itemD.quantityDispatched,
        balance: prodActualizado?.isBulk ? Number(newBalance.toFixed(3)) : newBalance,
        pmp: unitPmp,
        totalValue: unitPmp * newBalance,
        userName: authorName || "Camila Vera Soto",
        userRole: "Bodeguero",
        userRut: technicianRut,
      };
    });
    setCardex((prev) => [...nuevosMovimientosCardex, ...prev]);

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

  // 3. COMPRAS Y ÓRDENES DE COMPRA
  const calcularTotalesOrden = (items: ItemOrdenCompra[]) => {
    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;
    return { subtotal, iva, total };
  };

  const crearOrdenCompra = (orderData: Partial<OrdenCompra>) => {
    const anioActual = new Date().getFullYear();
    const ultimoCorrelativo = ordenesCompra.reduce((max, o) => {
      const partes = o.code.split("-");
      const numero = Number(partes[partes.length - 1]);
      return Number.isFinite(numero) && numero > max ? numero : max;
    }, 104);
    const code = `OC-${anioActual}-${String(ultimoCorrelativo + 1).padStart(3, "0")}`;

    const items = orderData.items || [];
    if (items.length === 0) {
      return { success: false, error: "Debe incluir al menos un insumo en la orden." };
    }

    const { subtotal, iva, total } = calcularTotalesOrden(items);

    const tempId = `oc_${Date.now()}`;
    const newOrder: OrdenCompra = {
      id: tempId,
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

    // Sincronizar con backend (genera numeración correlativa en BD y si se aprueba envía PDF por correo)
    const idProvNum = Number(String(newOrder.supplierId).replace(/\D/g, "")) || 1;
    void crearOrdenCompraApi({
      proveedor_id: idProvNum,
      origen: newOrder.isAutoMinStock ? "Stock Critico" : "Manual",
      fecha_estimada_oc: newOrder.expectedDate,
      observaciones: newOrder.notes,
      aprobar_inmediatamente: newOrder.status === "enviada",
      lineas: items.map((it) => ({
        sku: it.sku,
        cantidad_orden: it.quantity,
        precio_unitario: it.unitPrice,
      })),
    }).then((res) => {
      if (res.ok && res.data?.orden_compra) {
        const desdeBd = ordenCompraDesdeApi(res.data.orden_compra);
        setPurchaseOrders((prev) =>
          prev.map((o) => (o.id === tempId ? desdeBd : o))
        );
      }
    });

    return { success: true, orderId: newOrder.id, code: newOrder.code };
  };

  const actualizarOrdenCompra = (orderId: string, updates: Partial<OrdenCompra>) => {
    const actual = ordenesCompra.find((o) => o.id === orderId);
    if (!actual) {
      return { success: false, error: "Orden de compra no encontrada." };
    }
    if (actual.status !== "borrador") {
      return {
        success: false,
        error: "Solo se pueden editar órdenes de compra mientras estén en estado Borrador.",
      };
    }

    const items = updates.items ?? actual.items;
    if (items.length === 0) {
      return { success: false, error: "La orden de compra debe tener al menos un insumo." };
    }

    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    const actualizada: OrdenCompra = {
      ...actual,
      ...updates,
      items,
      subtotal,
      iva,
      total,
      itemsCount: items.length,
    };

    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? actualizada : o))
    );

    const idOrdenNum = Number(orderId);
    if (Number.isInteger(idOrdenNum) && idOrdenNum > 0) {
      const idProvNum = Number(String(actualizada.supplierId).replace(/\D/g, "")) || 1;
      void actualizarOrdenCompraApi(idOrdenNum, {
        proveedor_id: idProvNum,
        origen: actualizada.isAutoMinStock ? "Stock Critico" : "Manual",
        fecha_estimada_oc: actualizada.expectedDate,
        observaciones: actualizada.notes,
        lineas: items.map((it) => ({
          sku: it.sku,
          cantidad_orden: it.quantity,
          precio_unitario: it.unitPrice,
        })),
      });
    }

    return { success: true };
  };

  const aprobarYEnviarOrden = (orderId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "enviada" } : o))
    );

    const idOrdenNum = Number(orderId);
    if (Number.isInteger(idOrdenNum) && idOrdenNum > 0) {
      void aprobarOrdenCompraApi(idOrdenNum).then((res) => {
        if (res.ok && res.data?.orden_compra) {
          const desdeBd = ordenCompraDesdeApi(res.data.orden_compra);
          setPurchaseOrders((prev) =>
            prev.map((o) => (o.id === orderId ? desdeBd : o))
          );
        }
      });
    }
  };

  const anularOrdenCompra = (orderId: string) => {
    const actual = ordenesCompra.find((o) => o.id === orderId);
    if (!actual) return { success: false, error: "Orden no encontrada." };
    if (actual.status === "cerrada" || actual.status === "recibida") {
      return { success: false, error: "No se puede anular una orden ya recibida o cerrada." };
    }

    setPurchaseOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "anulada" } : o))
    );

    const idOrdenNum = Number(orderId);
    if (Number.isInteger(idOrdenNum) && idOrdenNum > 0) {
      void cambiarEstadoOrdenCompraApi(idOrdenNum, mapearEstadoHaciaBd("anulada"));
    }

    return { success: true };
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

    const linkedOrder = invoice.orderCode
      ? ordenesCompra.find((o) => o.code.trim().toUpperCase() === invoice.orderCode!.trim().toUpperCase())
      : undefined;

    const yaTieneRecepcion =
      !linkedOrder ||
      linkedOrder.status === "recibida" ||
      linkedOrder.status === "recibida_parcial" ||
      linkedOrder.status === "cerrada" ||
      linkedOrder.items.some((it) => Number(it.receivedQuantity || 0) > 0);

    const facturaFinal: FacturaCompra = {
      ...invoice,
      status: yaTieneRecepcion && linkedOrder ? "recepcion_conforme" : invoice.status,
    };

    setPurchaseInvoices((prev) => [facturaFinal, ...prev]);

    if (linkedOrder) {
      setPurchaseOrders((prev) =>
        prev.map((o) => (o.code === linkedOrder.code ? { ...o, invoiceNumber: invoice.number } : o))
      );
    }

    // Si la recepción ya ocurrió (o es factura directa sin OC pendiente), consolida el PMP con el costo neto de la factura.
    // Si la OC aún está en estado Enviada/Borrador sin recepción, el PMP y el stock se actualizan al confirmar la recepción conforme (H33).
    if (yaTieneRecepcion) {
      invoice.items.forEach((item) => {
        const prod = productos.find((p) => p.sku === item.sku);
        if (prod) {
          const poItem = linkedOrder?.items.find((i) => i.sku === item.sku);
          const receivedQty =
            poItem && Number(poItem.receivedQuantity || 0) > 0
              ? Number(poItem.receivedQuantity)
              : item.quantity;
          const currentStock = prod.stock || 0;
          const currentPmp = prod.pmp || prod.unitCost || 0;
          const incomingQty = receivedQty;
          const incomingCost = item.netUnitPrice;
          const totalQty = currentStock + incomingQty;
          const newPmp =
            totalQty > 0
              ? Math.round((currentStock * currentPmp + incomingQty * incomingCost) / totalQty)
              : incomingCost;

          actualizarProducto(item.sku, { pmp: newPmp });
        }
      });
    }

    if (invoice.hasReceptionDiscrepancy && invoice.discrepancyNotes && invoice.discrepancyNotes.length > 0) {
      const nuevaAlerta: AlertaPanel = {
        id: `alt_fac_${Date.now()}`,
        title: `Discrepancia Factura ${invoice.number} vs Recepción ${invoice.orderCode || ""}`.trim(),
        description: `${invoice.supplierName}: ${invoice.discrepancyNotes.join(" | ")}`,
        type: "costo",
        severity: "rojo",
        time: "Ahora",
        actionLabel: "Revisar Factura y Recepción",
      };
      setAlerts((prev) => [nuevaAlerta, ...prev]);
    }

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
            userName: "Camila Vera Soto",
            userRole: "Bodeguero",
            userRut: "15.321.654-2",
          };
          setCardex((prev) => [newCardex, ...prev]);
        }
      }
    });

    if (!activePo) return;

    const resumenEntrega = aplicarEntregaChecklistEnOrden(
      activePo,
      checklist,
      linkedInvoice ?? null,
      invoiceNumber
    );
    const allCompleted = resumenEntrega.esRecepcionCompleta;

    setPurchaseOrders((prev) =>
      prev.map((o) => (o.code === ocCode ? resumenEntrega.ordenActualizada : o))
    );

    // Persistir recepción parcial o completa en el backend si tiene ID numérico
    const idOrdenNum = Number(activePo.id);
    if (Number.isInteger(idOrdenNum) && idOrdenNum > 0) {
      void registrarRecepcionOrdenCompraApi(
        idOrdenNum,
        checklist.map((c) => ({
          sku: c.sku,
          cantidad_recibida: c.received,
          cantidad_defectuosa: c.defective,
          cantidad_faltante: c.missing,
        })),
        invoiceNumber || linkedInvoice?.number
      ).then((res) => {
        if (res.ok && res.data?.orden_compra) {
          const desdeBd = ordenCompraDesdeApi(res.data.orden_compra);
          setPurchaseOrders((prev) =>
            prev.map((o) => (o.code === ocCode ? { ...desdeBd, invoiceNumber: resumenEntrega.ordenActualizada.invoiceNumber } : o))
          );
        }
      });
    }

    // Remove from pending receipts only if all items have arrived
    if (allCompleted) {
      setPendingReceipts((prev) => prev.filter((r) => r.ocCode !== ocCode));
    }

    // Discrepancy notification & alert to Administrator (incluye diferencia con lo facturado)
    const todasDiscrepancias = Array.from(new Set([...discrepancyDetails, ...resumenEntrega.discrepancias]));
    if (todasDiscrepancias.length > 0) {
      const alert: AlertaPanel = {
        id: `alert_rec_${Date.now()}`,
        title: `Discrepancia en Recepción ${ocCode}`,
        description: `Recepción física difiere de lo ordenado/facturado: ${todasDiscrepancias.join(", ")}.`,
        type: "stock",
        severity: "rojo",
        time: "Ahora mismo",
        actionLabel: "Ver OC",
      };
      setAlerts((prev) => [alert, ...prev]);

      const notif: DetalleNotificacion = {
        id: `notif_rec_${Date.now()}`,
        title: `Discrepancia en Recepción ${ocCode}`,
        message: `El bodeguero registró discrepancias en la OC ${ocCode}: ${todasDiscrepancias.join(", ")}.`,
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

  const actualizarProveedor = (id: string, updates: Partial<Proveedor>) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    return { success: true };
  };

  const actualizarCliente = (id: string, updates: Partial<Cliente>) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
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

  // Baja lógica de herramienta / activo fijo (conserva historial de préstamos y mantenciones)
  const darDeBajaHerramienta = (
    toolId: string,
    motivo: string,
    responsable = "Administración Central"
  ): { success: boolean; error?: string } => {
    const herramienta = herramientas.find((t) => t.id === toolId);
    if (!herramienta) {
      return { success: false, error: "Herramienta no encontrada." };
    }
    if (herramienta.status === "asignada") {
      return {
        success: false,
        error: `No se puede dar de baja ${herramienta.code} mientras esté asignada a ${herramienta.currentTechnicianName || "un técnico"}. Registre primero su devolución.`,
      };
    }
    if (herramienta.status === "dada_de_baja") {
      return { success: false, error: "La herramienta ya se encuentra dada de baja." };
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const motivoLimpio = motivo.trim() || "Baja lógica administrativa de activo fijo";
    const registroBaja: RegistroMantencionHerramienta = {
      id: `baja_${Date.now()}`,
      toolId: herramienta.id,
      date: hoy,
      type: "correctiva",
      workshop: "Baja Lógica Patrimonial",
      cost: 0,
      description: `BAJA LÓGICA: ${motivoLimpio}`,
      nextMaintenanceDate: herramienta.nextMaintenanceDate,
      performedBy: responsable,
    };

    setTools((prev) =>
      prev.map((t) =>
        t.id === toolId
          ? {
              ...t,
              status: "dada_de_baja",
              maintenances: [registroBaja, ...(t.maintenances || [])],
            }
          : t
      )
    );

    return { success: true };
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
              userName: "Camila Vera Soto",
              userRole: "Bodeguero",
              userRut: "15.321.654-2",
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
        } else {
          // Notificación de recepción conforme reflejada para el Técnico y trazabilidad
          const notifOk: DetalleNotificacion = {
            id: `notif_ret_ok_${Date.now()}`,
            title: `Devolución Recibida: ${r.code}`,
            message: `${receivedBy} confirmó recepción física conforme de los sobrantes de ${r.projectName}. Stock reingresado a bodega.`,
            date: new Date().toISOString().slice(0, 10),
            type: "stock",
            severity: "ok",
            read: false,
            relatedEntityType: "proyecto",
            relatedEntityId: r.projectCode,
            relatedEntityLabel: r.code,
          };
          setNotificationsList((prevN) => [notifOk, ...prevN]);
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
        userName: "Camila Vera Soto",
        userRole: "Bodeguero",
        userRut: "15.321.654-2",
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
    const objetivo = devolucionesProveedor.find((r) => r.id === returnId);
    const fechaHoy = new Date().toISOString().slice(0, 10);

    setSupplierReturns((prev) =>
      prev.map((r) =>
        r.id === returnId
          ? {
            ...r,
            status: "resuelta",
            resolutionType,
            resolutionNotes: notes,
            resolvedAt: fechaHoy,
          }
          : r
      )
    );

    if (objetivo) {
      // Si el proveedor resuelve mediante reposición física, reingresa al stock disponible y al Cardex
      if (resolutionType === "reemplazo_producto") {
        const prod = productos.find((p) => p.sku === objetivo.productSku);
        if (prod) {
          const nuevoStock = Number((prod.stock + objetivo.quantity).toFixed(3));
          const pmpActual = prod.pmp || prod.unitCost || 0;
          actualizarProducto(prod.sku, { stock: nuevoStock });
          const entradaCardex: MovimientoCardex = {
            id: `kdx_rep_${Date.now()}_${prod.sku}`,
            sku: prod.sku,
            productName: prod.name,
            date: fechaHoy,
            type: "devolucion",
            typeLabel: "Reposición garantía proveedor",
            reference: `${objetivo.code} / Guía ${objetivo.dispatchGuideNumber}`,
            qtyIn: objetivo.quantity,
            qtyOut: 0,
            balance: nuevoStock,
            pmp: pmpActual,
            totalValue: Math.round(nuevoStock * pmpActual),
            userName: "Javier Muñoz Contreras",
            userRole: "Administrador",
            userRut: "12.456.789-5",
          };
          setCardex((k) => [entradaCardex, ...k]);
        }
      }

      const etiquetaVia =
        resolutionType === "nota_credito"
          ? "Nota de Crédito"
          : resolutionType === "reemplazo_producto"
          ? "Reposición de Producto"
          : "Reembolso";

      const notifCierre: DetalleNotificacion = {
        id: `notif_supres_${Date.now()}`,
        title: `Devolución a Proveedor Resuelta: ${objetivo.code}`,
        message: `Cierre administrativo registrado vía ${etiquetaVia} para ${objetivo.supplierName} (${objetivo.quantity} ${objetivo.unit} de ${objetivo.productName}).`,
        date: fechaHoy,
        type: "stock",
        severity: "ok",
        read: false,
        relatedEntityType: "orden_compra",
        relatedEntityId: objetivo.dispatchGuideNumber,
        relatedEntityLabel: objetivo.code,
      };
      setNotificationsList((prevN) => [notifCierre, ...prevN]);
    }
  };

  // 8. TECHNICIAN OPERATIONS
  const crearHojaServicio = (sheet: Omit<HojaServicio, "id">) => {
    const newSheet: HojaServicio = {
      ...sheet,
      id: `hs_${Date.now()}`,
    };
    setServiceSheets((prev) => [newSheet, ...prev]);
    return { success: true, hoja: newSheet };
  };

  const sincronizarHojasServicioPendientes = () => {
    const pendientes = hojasServicio.filter(
      (s) => s.syncStatus === "pendiente" && !s.hasVersionConflict
    ).length;
    if (pendientes === 0) return 0;
    setServiceSheets((prev) =>
      prev.map((s) =>
        s.syncStatus === "pendiente" && !s.hasVersionConflict
          ? { ...s, syncStatus: "sincronizado" }
          : s
      )
    );
    return pendientes;
  };

  const restaurarHojasServicioOffline = (hojasGuardadas: HojaServicio[]) => {
    if (hojasGuardadas.length === 0) return;
    setServiceSheets((prev) => {
      const idsExistentes = new Set(prev.map((s) => s.id));
      const nuevas = hojasGuardadas.filter((s) => !idsExistentes.has(s.id));
      return nuevas.length > 0 ? [...nuevas, ...prev] : prev;
    });
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

  const crearHoraTrabajoTecnico = (
    entry: Omit<HoraTrabajoTecnico, "id" | "createdAt" | "syncStatus">,
    syncStatus: "pendiente" | "sincronizado" = "sincronizado"
  ) => {
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
      syncStatus,
      registeredBy: entry.registeredBy || "technician_auto",
    };
    setTechnicianHours((prev) => [newH, ...prev]);

    // Imputar costo real de mano de obra en el proyecto (H27 / H28)
    const proj = proyectos.find((p) => p.id === entry.projectId);
    if (proj) {
      const hourlyRate = proj.hourlyRate || 18500;
      const newLaborEntry = {
        id: `hh_${Date.now()}`,
        date: entry.date,
        technicianRut: entry.technicianRut || USUARIOS.technician.rut,
        technicianName: entry.technicianName || USUARIOS.technician.name,
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
    return { success: true, registro: newH };
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

  const detenerSesionTrabajo = (
    description?: string,
    opciones?: { offline?: boolean }
  ) => {
    if (!sesionTrabajoActiva) {
      return { success: false, error: "No hay una jornada de trabajo activa." };
    }
    const startTimeMs = new Date(sesionTrabajoActiva.startTime).getTime();
    const elapsedHours = (Date.now() - startTimeMs) / (1000 * 60 * 60);
    // Redondeo automático a bloques de 0,5 h (mínimo 0,5 h y máximo 24,0 h)
    const roundedHours = Math.max(0.5, Math.min(24.0, Math.round(elapsedHours * 2) / 2));
    const estadoSync: "pendiente" | "sincronizado" = opciones?.offline
      ? "pendiente"
      : "sincronizado";

    const res = crearHoraTrabajoTecnico(
      {
        projectId: sesionTrabajoActiva.projectId,
        projectCode: sesionTrabajoActiva.projectCode,
        projectName: sesionTrabajoActiva.projectName,
        date: new Date().toISOString().slice(0, 10),
        hours: roundedHours,
        description:
          description?.trim() ||
          "Jornada registrada automáticamente al finalizar trabajo en faena.",
        registeredBy: "technician_auto",
      },
      estadoSync
    );

    if (res.success) {
      setActiveWorkSession(null);
      return {
        success: true,
        hours: roundedHours,
        syncStatus: estadoSync,
        registro: res.registro,
      };
    }
    return res;
  };

  const cancelarSesionTrabajo = () => {
    setActiveWorkSession(null);
  };

  const sincronizarHorasTrabajoPendientes = () => {
    const pendientes = horasTecnico.filter((h) => h.syncStatus === "pendiente").length;
    if (pendientes === 0) return 0;
    setTechnicianHours((prev) =>
      prev.map((h) =>
        h.syncStatus === "pendiente" ? { ...h, syncStatus: "sincronizado" } : h
      )
    );
    return pendientes;
  };

  const restaurarEstadoHorasOffline = (
    sesion: SesionTrabajoActiva | null,
    horasGuardadas: HoraTrabajoTecnico[]
  ) => {
    if (sesion && !sesionTrabajoActiva) {
      setActiveWorkSession(sesion);
    }
    if (horasGuardadas.length > 0) {
      setTechnicianHours((prev) => {
        const idsExistentes = new Set(prev.map((h) => h.id));
        const nuevas = horasGuardadas.filter((h) => !idsExistentes.has(h.id));
        return nuevas.length > 0 ? [...nuevas, ...prev] : prev;
      });
    }
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

    // Check hours edit limit (H41): technician only up to configurable deadline, admin can always edit
    const createdTime = new Date(existing.createdAt).getTime();
    const nowTime = Date.now();
    const diffHours = (nowTime - createdTime) / (1000 * 60 * 60);
    const paramPlazoHoras = parametrosSistema.find((p) => p.id === "hours_edit_deadline")?.value ?? 48;
    const plazoMaximoHoras = Number(paramPlazoHoras);
    if (diffHours > plazoMaximoHoras && userRole === "technician") {
      return {
        success: false,
        error:
          `Este registro supera el plazo de ${plazoMaximoHoras} horas de antigüedad. Según normativa (H41), solo un Administrador puede editarlo.`,
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
        sincronizarHorasTrabajoPendientes,
        restaurarEstadoHorasOffline,
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
        actualizarOrdenCompra,
        aprobarYEnviarOrden,
        anularOrdenCompra,
        calificarProveedor,
        crearFactura,
        confirmarRecepcionOrden,
        agregarProveedor,
        agregarCliente,
        actualizarProveedor,
        actualizarCliente,
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
        darDeBajaHerramienta,
        crearDevolucionTecnico,
        confirmarDevolucionBodega,
        crearDevolucionProveedor,
        resolverDevolucionProveedor,
        crearHojaServicio,
        resolverConflictoHojaServicio,
        sincronizarHojasServicioPendientes,
        restaurarHojasServicioOffline,
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