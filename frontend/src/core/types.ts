export type Role = "admin" | "warehouse" | "technician";

export type ProjectKind = "obra" | "mantencion";
export type ProjectStatus = "planificado" | "activo" | "cerrado" | "en_curso" | "pausado" | "finalizado";

export interface ProjectMaterialDispatch {
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

export interface ProjectLaborEntry {
  id: string;
  date: string;
  technicianRut: string;
  technicianName: string;
  hours: number;
  hourlyCost: number;
  totalCost: number;
  description: string;
}

export interface ProjectWasteEntry {
  id: string;
  date: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  reason: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
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
  dispatches?: ProjectMaterialDispatch[];
  laborEntries?: ProjectLaborEntry[];
  wasteEntries?: ProjectWasteEntry[];
  closedAt?: string;
  closedBy?: string;
}

export interface MaterialRequestItem {
  sku: string;
  name: string;
  quantity: number;
  deliveredQuantity?: number;
  unit: string;
}

export interface RequestTimelineStep {
  id: string;
  title: string;
  description: string;
  date: string;
  author: string;
  status: "completado" | "actual" | "futuro";
}

export interface MaterialRequest {
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
  items: MaterialRequestItem[];
  comment?: string;
  timeline?: RequestTimelineStep[];
  receiptNumber?: string;
  rejectionReason?: string;
}

export type PurchaseOrderStatus =
  | "borrador"
  | "enviada"
  | "recibida_parcial"
  | "recibida"
  | "cerrada"
  | "anulada";

export interface PurchaseOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  receivedQuantity?: number;
  defectiveQuantity?: number;
  missingQuantity?: number;
}

export interface SupplierRating {
  timeRating: number; // 1 a 5
  qualityRating: number; // 1 a 5
  priceRating: number; // 1 a 5
  average: number;
  comment?: string;
  ratedAt: string;
}

export interface PurchaseOrder {
  id: string;
  code: string; // OC-2026-103
  supplierId: string;
  supplier: string;
  supplierRut?: string;
  status: PurchaseOrderStatus;
  isAutoMinStock?: boolean; // Marca para las generadas automáticamente por stock mínimo
  items: PurchaseOrderItem[];
  subtotal: number;
  iva: number;
  total: number;
  itemsCount: number;
  date: string;
  expectedDate: string;
  notes?: string;
  rating?: SupplierRating;
  invoiceNumber?: string;
}

export interface PurchaseInvoiceItem {
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

export interface PurchaseInvoice {
  id: string;
  number: string; // Número de factura (valida duplicado por proveedor)
  supplierId: string;
  supplierName: string;
  supplierRut: string;
  orderCode?: string; // OC opcional
  date: string;
  items: PurchaseInvoiceItem[];
  subtotalNet: number;
  totalDiscounts: number;
  iva: number; // 19%
  total: number;
  status: "registrada" | "recepcion_conforme";
}

export interface BankDetails {
  bank: string;
  accountType: "corriente" | "vista" | "ahorro";
  accountNumber: string;
  transferEmail: string;
}

export interface Supplier {
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
  bankDetails: BankDetails;
  ratingAvg: number;
  ratingCount: number;
  disabled?: boolean;
}

export interface Client {
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

export interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  type: "costo" | "stock" | "plazo" | "solicitud";
  severity: "rojo" | "amarillo" | "info";
  time: string;
  actionLabel?: string;
}

export interface ReturnOrder {
  id: string;
  code: string;
  projectCode: string;
  projectName: string;
  technicianName: string;
  technicianRut: string;
  itemsCount: number;
  summary: string;
  date: string;
  status: "en_transito" | "recibida";
}

export interface PendingReceipt {
  id: string;
  ocCode: string;
  supplier: string;
  itemsSummary: string;
  packagesCount: number;
  arrivedDate: string;
  status: "por_confirmar" | "conforme" | "discrepancia";
}

export interface Product {
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

export interface CardexEntry {
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

export interface KitItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface Kit {
  id: string;
  name: string;
  description: string;
  category: string;
  items: KitItem[];
}

export interface WasteRecord {
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

export interface PhysicalCount {
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

export interface Technician {
  rut: string;
  name: string;
  phone: string;
  specialty: string;
}

export interface User {
  rut: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
}


