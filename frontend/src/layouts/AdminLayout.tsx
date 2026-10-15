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

  // Menú Drawer lateral desplegable desde las 3 líneas
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<AdminRoute>("dashboard");

  // Modales
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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

  // Atajo de teclado global: Ctrl+K / Cmd+K para abrir buscador global en web
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setGlobalSearchOpen((prev) => !prev);
        }
      };
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }
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
      {/* 1. TOPBAR RESPONSIVA                                                      */}
      {/* ========================================================================= */}
      <View style={[styles.topbar, width < 600 && styles.topbarCompact]}>
        {/* Lado Izquierdo: Botón Menú + Logo */}
        <View style={styles.topLeft}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.toggleBtn}
            accessibilityLabel="Abrir menú de navegación"
            accessibilityRole="button"
          >
            <Ionicons
              name="menu-outline"
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <View style={styles.brandLogoBox}>
              <Ionicons name="flash" size={16} color={theme.colors.textInverse} />
            </View>
            <Text style={styles.brandName}>FYAG</Text>
            {width >= 480 && (
              <Badge label="ADMIN" tone="primary" size="sm" style={styles.roleBadge} />
            )}
          </View>
        </View>

        {/* Centro: Buscador Global (visible en pantallas medianas y grandes, o botón en pantallas chicas) */}
        {width >= 700 ? (
          <View style={styles.topCenter}>
            <SearchInput
              value={globalSearch}
              onChangeText={(t) => {
                setGlobalSearch(t);
                if (t.trim().length > 1) setGlobalSearchOpen(true);
              }}
              placeholder="Buscar SKU, RUT, OC, Proyecto... (Ctrl+K)"
              containerStyle={styles.globalSearchBox}
            />
          </View>
        ) : (
          <View style={styles.topCenterCompact}>
            <TouchableOpacity
              onPress={() => setGlobalSearchOpen(true)}
              style={styles.compactSearchBtn}
              accessibilityLabel="Buscar global"
              accessibilityRole="button"
            >
              <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Lado Derecho: Notificaciones */}
        <View style={styles.topRight}>
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
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. LAYOUT: CONTENIDO A PANTALLA COMPLETA (SIN MENÚ LATERAL FIJO)          */}
      {/* ========================================================================= */}
      <View style={styles.bodyWrapper}>
        <View style={styles.mainContent}>
          <View style={styles.contentContainer}>
            {renderContent()}
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2.1 MENÚ DRAWER (ABRE CON EL BOTÓN DE 3 LÍNEAS)                           */}
      {/* ========================================================================= */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />

          <View style={styles.drawerContent} onStartShouldSetResponder={() => true}>
            {/* Header del Drawer */}
            <View style={styles.drawerHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandLogoBox}>
                  <Ionicons name="flash" size={16} color={theme.colors.textInverse} />
                </View>
                <Text style={styles.brandName}>FYAG</Text>
                <Badge label="ADMIN" tone="primary" size="sm" style={styles.roleBadge} />
              </View>

              <TouchableOpacity
                onPress={() => setDrawerOpen(false)}
                style={styles.drawerCloseBtn}
                accessibilityLabel="Cerrar menú"
                accessibilityRole="button"
              >
                <Ionicons name="close-outline" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Lista de navegación */}
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {ADMIN_GROUPS.map((group) => (
                <View key={group.title} style={styles.navGroup}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map((item) => {
                    const isActive = activeRoute === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          setActiveRoute(item.id);
                          setDrawerOpen(false);
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.navItem,
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
                        <Text
                          style={[
                            styles.navLabel,
                            isActive && styles.navLabelActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* SECCIÓN FIJA ABAJO A LA IZQUIERDA: LOGIN / PERFIL DE USUARIO */}
            <View style={styles.drawerUserFooter}>
              <TouchableOpacity
                onPress={() => {
                  setUserMenuOpen(true);
                }}
                style={styles.drawerUserTrigger}
                activeOpacity={0.8}
                accessibilityLabel="Menú de usuario y sesión"
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user.initials}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                  <Text style={styles.userRoleText}>Administrador</Text>
                </View>
                <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  topbarCompact: {
    paddingHorizontal: theme.spacing.md,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleBtn: {
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 10,
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
  topCenterCompact: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 8,
  },
  compactSearchBtn: {
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
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
  floatingUserTrigger: {
    position: "absolute",
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
    zIndex: 90,
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
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textInverse,
  },
  userInfo: {
    marginHorizontal: 8,
  },
  userName: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    maxWidth: 120,
  },
  userRoleText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  bodyWrapper: {
    flex: 1,
    width: "100%",
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
    width: "100%",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 1280,
    flex: 1,
    alignSelf: "center",
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  drawerBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  drawerContent: {
    width: 290,
    maxWidth: "85%",
    height: "100%",
    backgroundColor: theme.colors.card,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    justifyContent: "space-between",
    ...theme.shadows.lg,
    zIndex: 10,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  drawerCloseBtn: {
    padding: 4,
    borderRadius: theme.radius.sm,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
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
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: theme.colors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  drawerUserFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceAlt,
  },
  drawerUserTrigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingBottom: 76,
    paddingLeft: 16,
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
