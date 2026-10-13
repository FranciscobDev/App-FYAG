import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Briefcase,
  Building2,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  HardHat,
  Home,
  LayoutDashboard,
  Package,
  PenSquare,
  Receipt,
  ScanLine,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  to: string; // relativo a basePath ("" = índice)
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

export interface NavGroup {
  name: string;
  items: NavItem[];
}

export interface RoleConfig {
  label: string;
  device: "escritorio" | "tablet" | "celular";
  deviceHint: string;
  basePath: string;
  icon: LucideIcon;
  nav: NavItem[];
  groups?: NavGroup[];
}

export const ROLES: Record<Role, RoleConfig> = {
  admin: {
    label: "Administrador",
    device: "escritorio",
    deviceHint: "Tablas densas, formularios largos y gráficos",
    basePath: "/admin",
    icon: Briefcase,
    nav: [
      { to: "", label: "Resumen", icon: LayoutDashboard },
      { to: "inventario", label: "Inventario", icon: Package },
      { to: "movimientos", label: "Movimientos", icon: ArrowLeftRight },
      { to: "solicitudes", label: "Solicitudes", icon: ClipboardList, badge: 3 },
      { to: "ordenes-compra", label: "Órdenes de compra", icon: Receipt },
      { to: "proveedores", label: "Proveedores", icon: Building2 },
      { to: "recepciones", label: "Recepciones", icon: ArrowDownToLine },
      { to: "proyectos", label: "Proyectos y obras", icon: FolderKanban },
      { to: "asignaciones", label: "Asignaciones", icon: CheckSquare },
      { to: "tecnicos", label: "Técnicos y equipo", icon: Users },
      { to: "informes", label: "Informes y KPIs", icon: BarChart3 },
      { to: "configuracion", label: "Configuración", icon: Settings },
    ],
    groups: [
      {
        name: "Operación",
        items: [
          { to: "inventario", label: "Inventario", icon: Package },
          { to: "movimientos", label: "Movimientos", icon: ArrowLeftRight },
          { to: "solicitudes", label: "Solicitudes", icon: ClipboardList, badge: 3 },
        ],
      },
      {
        name: "Compras",
        items: [
          { to: "ordenes-compra", label: "Órdenes de compra", icon: Receipt },
          { to: "proveedores", label: "Proveedores", icon: Building2 },
          { to: "recepciones", label: "Recepciones", icon: ArrowDownToLine },
        ],
      },
      {
        name: "Proyectos",
        items: [
          { to: "proyectos", label: "Proyectos y obras", icon: FolderKanban },
          { to: "asignaciones", label: "Asignaciones", icon: CheckSquare },
        ],
      },
      {
        name: "Administración",
        items: [
          { to: "", label: "Resumen general", icon: LayoutDashboard },
          { to: "tecnicos", label: "Técnicos y equipo", icon: Users },
          { to: "informes", label: "Informes y KPIs", icon: BarChart3 },
          { to: "configuracion", label: "Configuración", icon: Settings },
        ],
      },
    ],
  },
  warehouse: {
    label: "Bodeguero",
    device: "tablet",
    deviceHint: "Botones grandes y escáner de cámara QR/barras",
    basePath: "/bodega",
    icon: Package,
    nav: [
      { to: "", label: "Inicio", icon: Home },
      { to: "egreso", label: "Egreso", icon: ArrowUpFromLine },
      { to: "recepcion", label: "Recepción", icon: ArrowDownToLine },
      { to: "conteo", label: "Conteo", icon: CheckSquare },
      { to: "inventario", label: "Inventario", icon: Package },
      { to: "solicitudes", label: "Solicitudes", icon: ClipboardList, badge: 3 },
    ],
  },
  technician: {
    label: "Técnico",
    device: "celular",
    deviceHint: "Mobile-first y funciona sin conexión",
    basePath: "/tecnico",
    icon: HardHat,
    nav: [
      { to: "", label: "Proyectos", icon: FolderKanban },
      { to: "insumos", label: "Insumos", icon: Package },
      { to: "registrar", label: "Registrar", icon: PenSquare },
      { to: "alertas", label: "Alertas", icon: AlertTriangle, badge: 2 },
    ],
  },
};

export const ROLE_ORDER: Role[] = ["admin", "warehouse", "technician"];
