import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { ROLES, ROLE_ORDER } from "@/core/roles";
import { theme } from "@/core/theme";
import { Role } from "@/core/types";

// Componentes
import { Badge } from "@/components/common/Badge";
import { NotificationBell } from "@/components/common/NotificationBell";
import { SearchInput } from "@/components/common/SearchInput";
import { SessionTimeoutModal } from "@/components/common/SessionTimeoutModal";
import { DesignSystemScreen } from "@/features/design-system/DesignSystemScreen";

// Pantallas administradas
import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { InventoryScreen } from "@/features/inventory/InventoryScreen";
import { PurchasingScreen } from "@/features/purchasing/PurchasingScreen";
import { ProjectsScreen } from "@/features/projects/ProjectsScreen";
import { ToolsScreen } from "@/features/tools/ToolsScreen";
import { ReturnsScreen } from "@/features/returns/ReturnsScreen";
import { AdministrationScreen } from "@/features/admin/AdministrationScreen";

export type AdminRoute =
  | "dashboard"
  | "inventario"
  | "devoluciones"
  | "compras"
  | "facturas"
  | "proyectos"
  | "herramientas"
  | "administracion";

interface NavGroup {
  title: string;
  items: {
    id: AdminRoute;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[];
}

const ADMIN_GROUPS: NavGroup[] = [
  {
    title: "OPERACIÓN",
    items: [
      { id: "dashboard", label: "Dashboard General", icon: "grid-outline" },
      { id: "inventario", label: "Inventario & Cardex", icon: "cube-outline" },
      { id: "devoluciones", label: "Devoluciones Faena", icon: "return-down-back-outline" },
    ],
  },
  {
    title: "COMPRAS",
    items: [
      { id: "compras", label: "Órdenes de Compra", icon: "cart-outline" },
      { id: "facturas", label: "Facturas Proveedor", icon: "receipt-outline" },
    ],
  },
  {
    title: "PROYECTOS",
    items: [
      { id: "proyectos", label: "Proyectos y Obras", icon: "business-outline" },
    ],
  },
  {
    title: "ADMINISTRACIÓN",
    items: [
      { id: "herramientas", label: "Control Herramientas", icon: "construct-outline" },
      { id: "administracion", label: "Sistema & Auditoría", icon: "settings-outline" },
    ],
  },
];

export interface AdminLayoutProps {
  onLogout?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onLogout }) => {
  const { user, currentRole, setRole } = useAuth();
  const { width } = useWindowDimensions();

  // En pantallas medianas o escritorio se inicia expandido, en pantallas angostas colapsado
  const [collapsed, setCollapsed] = useState(width < 900);
  const [activeRoute, setActiveRoute] = useState<AdminRoute>("dashboard");

  // Modales
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // Modal de Aviso por Expiración de Sesión (30 min de inactividad, solo web)
  const [sessionTimeoutOpen, setSessionTimeoutOpen] = useState(false);

  // Temporizador de inactividad (30 min = 1.800.000 ms) en web
  useEffect(() => {
    const INACTIVITY_MS = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSessionTimeoutOpen(true);
      }, INACTIVITY_MS);
    };

    resetTimer();

    // Solo para navegador web: escuchar actividad del usuario
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
      events.forEach((evt) => {
        window.addEventListener(evt, resetTimer, { passive: true });
      });

      return () => {
        clearTimeout(timer);
        events.forEach((evt) => {
          window.removeEventListener(evt, resetTimer);
        });
      };
    }

    return () => clearTimeout(timer);
  }, []);

  // Renderizar la pantalla correspondiente
  const renderContent = () => {
    switch (activeRoute) {
      case "dashboard":
        return <AdminDashboard onNavigate={(tab) => setActiveRoute(tab as AdminRoute)} />;
      case "inventario":
        return <InventoryScreen />;
      case "compras":
        return <PurchasingScreen initialTab="ordenes" />;
      case "facturas":
        return <PurchasingScreen initialTab="facturas" />;
      case "proyectos":
        return <ProjectsScreen />;
      case "herramientas":
        return <ToolsScreen />;
      case "devoluciones":
        return <ReturnsScreen />;
      case "administracion":
        return <AdministrationScreen />;
      default:
        return <AdminDashboard onNavigate={(tab) => setActiveRoute(tab as AdminRoute)} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR ESCRITORIO                                                      */}
      {/* ========================================================================= */}
      <View style={styles.topbar}>
        {/* Lado Izquierdo: Toggle Sidebar + Logo */}
        <View style={styles.topLeft}>
          <TouchableOpacity
            onPress={() => setCollapsed(!collapsed)}
            style={styles.toggleBtn}
            accessibilityLabel={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            accessibilityRole="button"
          >
            <Ionicons
              name={collapsed ? "menu-outline" : "chevron-back-outline"}
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <View style={styles.brandLogoBox}>
              <Ionicons name="flash" size={16} color="#ffffff" />
            </View>
            <Text style={styles.brandName}>FYAG</Text>
            <Badge label="ADMIN" tone="primary" size="sm" style={styles.roleBadge} />
          </View>
        </View>

        {/* Centro: Buscador Global */}
        <View style={styles.topCenter}>
          <SearchInput
            value={globalSearch}
            onChangeText={(t) => {
              setGlobalSearch(t);
              if (t.trim().length > 1) setGlobalSearchOpen(true);
            }}
            placeholder="Buscar global por SKU, RUT, OC, Proyecto..."
            containerStyle={styles.globalSearchBox}
          />
        </View>

        {/* Lado Derecho: Acceso Catálogo, Notificaciones y Menú Usuario */}
        <View style={styles.topRight}>
          <TouchableOpacity
            onPress={() => setDesignModalOpen(true)}
            style={styles.designBtn}
            accessibilityLabel="Ver Catálogo de Componentes"
          >
            <Ionicons name="color-palette-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.designBtnText}>Componentes</Text>
          </TouchableOpacity>

          <NotificationBell
            onNavigateToObject={(entityType) => {
              if (entityType === "insumo" || entityType === "solicitud") {
                setActiveRoute("inventario");
              } else if (entityType === "proyecto") {
                setActiveRoute("proyectos");
              } else if (entityType === "orden_compra") {
                setActiveRoute("compras");
              } else if (entityType === "herramienta") {
                setActiveRoute("herramientas");
              } else {
                setActiveRoute("administracion");
              }
            }}
          />

          {/* Menú de Usuario */}
          <TouchableOpacity
            onPress={() => setUserMenuOpen(true)}
            style={styles.userMenuTrigger}
            activeOpacity={0.8}
            accessibilityLabel="Menú de usuario"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
              <Text style={styles.userRoleText}>Administrador</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. LAYOUT INFERIOR: SIDEBAR + ÁREA DE CONTENIDO                           */}
      {/* ========================================================================= */}
      <View style={styles.bodyWrapper}>
        {/* SIDEBAR COLAPSABLE */}
        <View
          style={[
            styles.sidebar,
            collapsed ? styles.sidebarCollapsed : styles.sidebarExpanded,
          ]}
        >
          <ScrollView
            style={styles.sidebarScroll}
            contentContainerStyle={styles.sidebarContent}
            showsVerticalScrollIndicator={false}
          >
            {ADMIN_GROUPS.map((group) => (
              <View key={group.title} style={styles.navGroup}>
                {!collapsed && (
                  <Text style={styles.groupTitle}>{group.title}</Text>
                )}

                {group.items.map((item) => {
                  const isActive = activeRoute === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setActiveRoute(item.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.navItem,
                        collapsed && styles.navItemCollapsed,
                        isActive && styles.navItemActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                        style={styles.navIcon}
                      />
                      {!collapsed && (
                        <Text
                          style={[
                            styles.navLabel,
                            isActive && styles.navLabelActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Footer del Sidebar con info de sistema */}
          {!collapsed && (
            <View style={styles.sidebarFooter}>
              <Text style={styles.footerVersion}>FYAG Sistema v2.0</Text>
              <Text style={styles.footerStatus}>● Conectado a Servidor Central</Text>
            </View>
          )}
        </View>

        {/* CONTENIDO PRINCIPAL */}
        <View style={styles.mainContent}>
          {renderContent()}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 3. MODALES DE APOYO: USUARIO Y CATÁLOGO DE DISEÑO                         */}
      {/* ========================================================================= */}
      {/* Modal Menú de Usuario */}
      <Modal
        visible={userMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUserMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUserMenuOpen(false)}>
          <View style={styles.userMenuCard} onStartShouldSetResponder={() => true}>
            <View style={styles.userMenuHeader}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{user.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userMenuName}>{user.name}</Text>
                <Text style={styles.userMenuRut}>{user.rut}</Text>
                <Badge label="Administrador General" tone="primary" size="sm" style={{ marginTop: 4 }} />
              </View>
            </View>

            <View style={styles.userMenuDivider} />

            <Text style={styles.userMenuSectionTitle}>Cambiar a otro rol:</Text>
            {ROLE_ORDER.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleSwitchBtn,
                  r === currentRole && styles.roleSwitchBtnCurrent,
                ]}
                onPress={() => {
                  setRole(r);
                  setUserMenuOpen(false);
                }}
              >
                <Ionicons
                  name={r === "admin" ? "briefcase" : r === "warehouse" ? "cube" : "hammer"}
                  size={18}
                  color={r === currentRole ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.roleSwitchText,
                    r === currentRole && styles.roleSwitchTextCurrent,
                  ]}
                >
                  {ROLES[r].label}
                </Text>
                {r === currentRole && (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.userMenuDivider} />

            {/* Test Rápido Aviso Expiración 30 min (Requerimiento Paso 4) */}
            <TouchableOpacity
              onPress={() => {
                setUserMenuOpen(false);
                setSessionTimeoutOpen(true);
              }}
              style={styles.testSessionBtn}
            >
              <Ionicons name="time-outline" size={18} color={theme.colors.warnDark} />
              <Text style={styles.testSessionText}>Aviso 30 min Inactividad (Test)</Text>
            </TouchableOpacity>

            {/* Cerrar Sesión */}
            <TouchableOpacity
              onPress={() => {
                setUserMenuOpen(false);
                if (onLogout) onLogout();
              }}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
              <Text style={styles.logoutText}>Cerrar Sesión / Salir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal Pantalla Completa Sistema de Diseño */}
      <Modal
        visible={designModalOpen}
        animationType="slide"
        onRequestClose={() => setDesignModalOpen(false)}
      >
        <View style={styles.designModalWrapper}>
          <View style={styles.designModalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="color-palette" size={20} color={theme.colors.primary} />
              <Text style={styles.designModalTitle}>Catálogo de Componentes FYAG (Paso 1 & 2)</Text>
            </View>
            <TouchableOpacity
              onPress={() => setDesignModalOpen(false)}
              style={styles.closeDesignBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <DesignSystemScreen />
        </View>
      </Modal>

      {/* Modal de Aviso por Expiración de Sesión (30 min de inactividad, solo web) */}
      <SessionTimeoutModal
        visible={sessionTimeoutOpen}
        timeoutSeconds={60}
        onStayLoggedIn={() => setSessionTimeoutOpen(false)}
        onLogout={() => {
          setSessionTimeoutOpen(false);
          if (onLogout) onLogout();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topbar: {
    height: 64,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
    ...theme.shadows.sm,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleBtn: {
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandName: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    letterSpacing: 0.5,
    color: theme.colors.text,
  },
  roleBadge: {
    marginLeft: 8,
  },
  topCenter: {
    flex: 1,
    maxWidth: 420,
    marginHorizontal: 16,
  },
  globalSearchBox: {
    marginBottom: 0,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginRight: 12,
  },
  designBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primaryDark,
    marginLeft: 4,
  },
  userMenuTrigger: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userInfo: {
    marginHorizontal: 8,
  },
  userName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    maxWidth: 120,
  },
  userRoleText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    backgroundColor: theme.colors.card,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    justifyContent: "space-between",
  },
  sidebarExpanded: {
    width: 240,
  },
  sidebarCollapsed: {
    width: 68,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    paddingVertical: 12,
  },
  navGroup: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    marginBottom: 2,
    minHeight: 44, // Accesibilidad táctil
  },
  navItemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  sidebarFooter: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceAlt,
  },
  footerVersion: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  footerStatus: {
    fontSize: 10,
    color: theme.colors.okDark,
    marginTop: 2,
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 68,
    paddingRight: 20,
  },
  userMenuCard: {
    width: 280,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userMenuName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  userMenuRut: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  userMenuDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 12,
  },
  userMenuSectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  roleSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 4,
  },
  roleSwitchBtnCurrent: {
    backgroundColor: theme.colors.primaryLight,
  },
  roleSwitchText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  roleSwitchTextCurrent: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  testSessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1,
    borderColor: theme.colors.warnBorder,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
  },
  testSessionText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.warnDark,
    marginLeft: 8,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  logoutText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.danger,
    marginLeft: 8,
  },
  designModalWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  designModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingTop: 50,
  },
  designModalTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginLeft: 8,
  },
  closeDesignBtn: {
    padding: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
});
