import type { Role } from "./types";

export interface NavItem {
  key: string;
  label: string;
  icon: string; // Ionicons name
  badge?: string | number;
}

export interface RoleConfig {
  label: string;
  device: "escritorio" | "tablet" | "celular";
  deviceHint: string;
  icon: string; // Ionicons name
  nav: NavItem[];
}

export const ROLES: Record<Role, RoleConfig> = {
  admin: {
    label: "Administrador",
    device: "escritorio",
    deviceHint: "Gestión global, proyectos, KPIs y aprobaciones",
    icon: "briefcase-outline",
    nav: [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
      { key: "proyectos", label: "Proyectos", icon: "business-outline" },
      { key: "inventario", label: "Inventario", icon: "cube-outline" },
      { key: "compras", label: "Compras", icon: "cart-outline" },
      { key: "terceros", label: "Terceros", icon: "people-outline" },
      { key: "herramientas", label: "Herramientas", icon: "construct-outline" },
      { key: "devoluciones", label: "Devoluciones", icon: "return-down-back-outline" },
    ],
  },
  warehouse: {
    label: "Bodeguero",
    device: "tablet",
    deviceHint: "Recepción de OC, egresos, conteo y devoluciones físicas",
    icon: "cube-outline",
    nav: [
      { key: "dashboard", label: "Bodega", icon: "grid-outline" },
      { key: "inventario", label: "Inventario", icon: "cube-outline" },
      { key: "recepcion", label: "Recepciones", icon: "arrow-down-circle-outline" },
      { key: "facturas", label: "Facturas", icon: "receipt-outline" },
      { key: "herramientas", label: "Herramientas", icon: "construct-outline" },
      { key: "devoluciones", label: "Devoluciones", icon: "return-down-back-outline" },
    ],
  },
  technician: {
    label: "Técnico",
    device: "celular",
    deviceHint: "Proyectos asignados, solicitudes y devolución de sobrantes",
    icon: "hammer-outline",
    nav: [
      { key: "proyectos", label: "Mis Proyectos", icon: "business-outline" },
      { key: "devolucion", label: "Devolver Sobrante", icon: "return-down-back-outline" },
      { key: "solicitudes", label: "Solicitudes", icon: "document-text-outline" },
      { key: "perfil", label: "Mi Perfil", icon: "person-outline" },
    ],
  },
};

export const ROLE_ORDER: Role[] = ["admin", "warehouse", "technician"];
