export type Rol = "admin" | "warehouse" | "technician";

export type TipoProyecto = "obra" | "mantencion";
export type EstadoProyecto = "planificado" | "activo" | "cerrado" | "en_curso" | "pausado" | "finalizado";

export interface DespachoMaterialProyecto {
  id: string;
  date: string;
  dispatchCode: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number; // PMP
  totalCost: number;
  deliveredTo: string;
}

export interface RegistroManoObraProyecto {
  id: string;
  date: string;
  technicianRut: string;
  technicianName: string;
  hours: number;
  hourlyCost: number;
  totalCost: number;
  description: string;
  registeredBy?: "technician_auto" | "admin_manual";
  reason?: string;
}

export interface RegistroMermaProyecto {
  id: string;
  date: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  reason: string;
}

export interface Proyecto {
  id: string;
  code: string;
  name: string;
  kind: TipoProyecto;
  status: EstadoProyecto;
  client: string;
  address: string;
  progress: number;
  technicianRuts: string[];
  budgetMaterials: number;
  budgetHours: number; // Horas hombre presupuestadas
  hourlyRate?: number; // Costo por HH (default 18500)
  saleValue: number; // Valor de venta
  budget: number; // Presupuesto total
  costReal: number; // Costo real total
  costRealMaterials?: number;
  costRealHours?: number;
  costRealWaste?: number;
  hoursReal?: number;
  startDate: string;
  deadline: string; // ISO string o YYYY-MM-DD
  dispatches?: DespachoMaterialProyecto[];
  laborEntries?: RegistroManoObraProyecto[];
  wasteEntries?: RegistroMermaProyecto[];
  closedAt?: string;
  closedBy?: string;
}

export interface ItemSolicitudMaterial {
  sku: string;
  name: string;
  quantity: number;
  deliveredQuantity?: number;
  unit: string;
}

export interface PasoCronologiaSolicitud {
  id: string;
  title: string;
  description: string;
  date: string;
  author: string;
  status: "completado" | "actual" | "futuro";
}

export interface SolicitudMaterial {
  id: string;
  code: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  technicianRut: string;
  technicianName: string;
  date: string;
  urgency: "normal" | "alta" | "urgente";
  status: "pendiente" | "aprobada" | "rechazada" | "entregada";
  items: ItemSolicitudMaterial[];
  comment?: string;
  timeline?: PasoCronologiaSolicitud[];
  receiptNumber?: string;
  rejectionReason?: string;
}

export type EstadoOrdenCompra =
  | "borrador"
  | "enviada"
  | "recibida_parcial"
  | "recibida"
  | "cerrada"
  | "anulada";

export interface ItemOrdenCompra {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  receivedQuantity?: number;
  defectiveQuantity?: number;
  missingQuantity?: number;
}

export interface CalificacionProveedor {
  timeRating: number; // 1 a 5
  qualityRating: number; // 1 a 5
  priceRating: number; // 1 a 5
  average: number;
  comment?: string;
  ratedAt: string;
}

export interface OrdenCompra {
  id: string;
  code: string; // OC-2026-103
  supplierId: string;
  supplier: string;
  supplierRut?: string;
  status: EstadoOrdenCompra;
  isAutoMinStock?: boolean; // Marca para las generadas automáticamente por stock mínimo
  items: ItemOrdenCompra[];
  subtotal: number;
  iva: number;
  total: number;
  itemsCount: number;
  date: string;
  expectedDate: string;
  notes?: string;
  rating?: CalificacionProveedor;
  invoiceNumber?: string;
}

export interface ItemFacturaCompra {
  sku: string;
  name: string;
  quantity: number;
  grossPrice: number;
  discount1Pct: number; // 0-100
  discount2Pct: number; // 0-100
  discount3Pct: number; // 0-100
  netUnitPrice: number;
  subtotalNet: number;
  unit: string;
}

export interface FacturaCompra {
  id: string;
  number: string; // Número de factura (valida duplicado por proveedor)
  supplierId: string;
  supplierName: string;
  supplierRut: string;
  orderCode?: string; // OC opcional
  date: string;
  items: ItemFacturaCompra[];
  subtotalNet: number;
  totalDiscounts: number;
  iva: number; // 19%
  total: number;
  status: "registrada" | "recepcion_conforme";
}

export interface DatosBancarios {
  bank: string;
  accountType: "corriente" | "vista" | "ahorro";
  accountNumber: string;
  transferEmail: string;
}

export interface Proveedor {
  id: string;
  rut: string;
  businessName: string;
  tradeName: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  contactPhone: string;
  bankDetails: DatosBancarios;
  ratingAvg: number;
  ratingCount: number;
  disabled?: boolean;
}

export interface Cliente {
  id: string;
  rut: string;
  businessName: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  activeProjectsCount: number;
  disabled?: boolean;
}

export interface AlertaPanel {
  id: string;
  title: string;
  description: string;
  type: "costo" | "stock" | "plazo" | "solicitud";
  severity: "rojo" | "amarillo" | "info";
  time: string;
  actionLabel?: string;
}

export interface ItemOrdenDevolucion {
  sku: string;
  name: string;
  quantityRetrieved: number; // Cantidad retirada
  quantityUsed: number; // Cantidad usada en terreno
  quantityReturned: number; // Sobrante devuelto (retirado - usado)
  quantityReceivedReal?: number; // Cantidad física real verificada por bodeguero
  unit: string;
}

export interface OrdenDevolucion {
  id: string;
  code: string;
  projectId?: string;
  projectCode: string;
  projectName: string;
  technicianName: string;
  technicianRut: string;
  itemsCount: number;
  summary: string;
  date: string;
  status: "en_transito" | "recibida";
  items?: ItemOrdenDevolucion[];
  discrepancyNote?: string;
  receivedAt?: string;
  receivedBy?: string;
}

export interface DevolucionProveedor {
  id: string;
  code: string; // DEV-PROV-2026-001
  supplierId: string;
  supplierName: string;
  supplierRut: string;
  productSku: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: string; // Motivo de devolución
  dispatchGuideNumber: string; // N° de guía de despacho
  date: string;
  status: "pendiente_resolucion" | "resuelta";
  resolutionType?: "nota_credito" | "reemplazo_producto" | "reembolso";
  resolutionNotes?: string;
  resolvedAt?: string;
}

export type EstadoHerramienta = "disponible" | "asignada" | "en_mantencion" | "dada_de_baja";

export interface HistorialPrestamoHerramienta {
  id: string;
  toolId: string;
  technicianRut: string;
  technicianName: string;
  projectCode: string;
  projectName: string;
  loanDate: string;
  returnDate?: string;
  initialCondition: string;
  returnCondition?: "bueno" | "danado"; // Bueno / Dañado
  returnNotes?: string;
}

export interface RegistroMantencionHerramienta {
  id: string;
  toolId: string;
  date: string;
  type: "preventiva" | "correctiva";
  workshop: string;
  cost: number;
  description: string;
  nextMaintenanceDate: string;
  performedBy: string;
}

export interface Herramienta {
  id: string;
  code: string; // HER-001
  serialNumber: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  status: EstadoHerramienta;
  currentTechnicianRut?: string;
  currentTechnicianName?: string;
  currentProjectCode?: string;
  currentProjectName?: string;
  currentLoanDate?: string;
  purchaseDate: string;
  maintenanceFrequencyDays: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate: string; // YYYY-MM-DD
  loans?: HistorialPrestamoHerramienta[];
  maintenances?: RegistroMantencionHerramienta[];
}

export interface RecepcionPendiente {
  id: string;
  ocCode: string;
  supplier: string;
  itemsSummary: string;
  packagesCount: number;
  arrivedDate: string;
  status: "por_confirmar" | "conforme" | "discrepancia";
}

export interface Producto {
  /** ID en la base (articulo.id_articulo); se asigna al cargar o crear desde el servidor */
  id?: number;
  sku: string;
  name: string;
  category: string;
  unit: string; // "un" | "kg" | "m" | "l" | "rollo" | "caja" | "cilindro"
  stock: number; // Disponible
  minStock: number;
  unitCost: number;
  location: string;
  committed?: number;
  quarantine?: number;
  restockQuantity?: number;
  defaultSupplier?: string;
  barcode?: string;
  disabled?: boolean;
  pmp?: number; // Precio Medio Ponderado
  isBulk?: boolean;
  containerCapacity?: number;
}

export interface MovimientoCardex {
  id: string;
  sku: string;
  productName: string;
  date: string;
  type: "entrada_compra" | "salida_obra" | "devolucion" | "merma" | "ajuste_conteo";
  typeLabel: string;
  reference: string;
  projectCode?: string;
  projectName?: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  pmp: number;
  totalValue: number;
}


export interface RegistroMerma {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  pmp: number;
  totalLoss: number;
  reason: "daño" | "caducidad" | "pérdida" | "otro";
  observation: string;
  date: string;
  user: string;
}

export interface ConteoFisico {
  id: string;
  sku: string;
  productName: string;
  systemStock: number;
  countedStock: number;
  difference: number;
  differencePct: number;
  pmp: number;
  differenceValue: number;
  status: "ajustado_directo" | "pendiente_aprobacion" | "aprobado" | "rechazado";
  date: string;
  counterUser: string;
  approverUser?: string;
  notes?: string;
  locked?: boolean;
}

export interface Tecnico {
  rut: string;
  name: string;
  phone: string;
  specialty: string;
}

export interface Usuario {
  rut: string;
  name: string;
  email: string;
  initials: string;
  role: Rol;
}

export interface FotoHojaServicio {
  id: string;
  name: string;
  sizeMb: number; // Máximo 5 MB por foto
  uri?: string;
  timestamp: string;
}

export interface ItemListaChequeoServicio {
  id: string;
  label: string;
  completed: boolean;
}

export interface HojaServicio {
  id: string;
  code: string; // HS-2026-001
  projectId: string;
  projectCode: string;
  projectName: string;
  date: string;
  technicianRut: string;
  technicianName: string;
  checklist: ItemListaChequeoServicio[];
  photos: FotoHojaServicio[];
  receptorName: string;
  receptorRut?: string;
  syncStatus: "pendiente" | "sincronizado";
  hasVersionConflict?: boolean;
  conflictDetails?: {
    serverModifiedAt: string;
    serverAuthor: string;
    serverNotes: string;
    localModifiedAt: string;
    localNotes: string;
  };
  notes?: string;
}

export interface ReporteAvanceTecnico {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  date: string;
  progressPct: number; // 0–100
  comments: string;
  materialsUsed: {
    sku: string;
    name: string;
    quantity: number;
    unit: string;
  }[]; // Nota: no genera egreso en inventario
  syncStatus: "pendiente" | "sincronizado";
}

export interface HoraTrabajoTecnico {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  date: string; // YYYY-MM-DD
  hours: number; // En bloques de 0.5 (máx 24 por día)
  description: string;
  createdAt: string; // ISO string
  syncStatus: "pendiente" | "sincronizado";
  technicianRut?: string;
  technicianName?: string;
  registeredBy?: "technician_auto" | "admin_manual";
  reason?: string;
}

export interface SesionTrabajoActiva {
  projectId: string;
  projectCode: string;
  projectName: string;
  startTime: string; // ISO string
  hourlyRate: number;
}

export interface UsuarioSistema {
  id: string;
  id_usuario?: number;
  rut: string;
  name: string;
  nombre?: string;
  apellido?: string;
  email: string;
  role: Rol;
  especializacion?: string | null;
  disabled: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RegistroAuditoria {
  id: string;
  timestamp: string;
  userRut: string;
  userName: string;
  userRole: Rol;
  entity: "Insumos" | "Proyectos" | "OrdenesCompra" | "Facturas" | "Herramientas" | "Usuarios" | "Parametros" | "Respaldos" | "Privacidad";
  action: "creacion" | "modificacion" | "deshabilitacion" | "cierre" | "ajuste" | "anonimizacion";
  fieldChanged: string;
  oldValue: string | number;
  newValue: string | number;
  description: string;
}

export interface ParametroSistema {
  id: string;
  group: "seguridad" | "inventario" | "costos" | "alertas";
  name: string;
  description: string;
  value: string | number;
  defaultValue: string | number;
  min?: number;
  max?: number;
  unit?: string;
  type: "number" | "text" | "boolean";
}

export interface RegistroRespaldo {
  id: string;
  timestamp: string;
  filename: string;
  sizeMb: number;
  status: "exito" | "fallo";
  errorReason?: string;
  type: "automatico" | "manual";
  restorationTestedAt?: string;
  restorationStatus?: "exito" | "pendiente" | "fallo";
}

export interface DetalleNotificacion {
  id: string;
  title: string;
  message: string;
  date: string;
  type: "costo" | "stock" | "plazo" | "solicitud" | "sistema";
  severity: "danger" | "warn" | "info" | "ok";
  read: boolean;
  relatedEntityType?: "proyecto" | "solicitud" | "insumo" | "orden_compra" | "herramienta";
  relatedEntityId?: string;
  relatedEntityLabel?: string;
}


