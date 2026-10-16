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


import { useApp } from "@/context/AppContext";

// Pantallas administradas
import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { InventoryScreen } from "@/features/inventory/InventoryScreen";
import { PurchasingScreen } from "@/features/purchasing/PurchasingScreen";
import { ProjectsScreen } from "@/features/projects/ProjectsScreen";
import { ToolsScreen } from "@/features/tools/ToolsScreen";
import { ReturnsScreen } from "@/features/returns/ReturnsScreen";
import { AdministrationScreen } from "@/features/admin/AdministrationScreen";
import { AdminManualHoursScreen } from "@/features/admin/AdminManualHoursScreen";

export type AdminRoute =
  | "dashboard"
  | "inventario"
  | "solicitudes"
  | "mermas"
  | "conteo"
  | "kits"
  | "devoluciones"
  | "compras"
  | "facturas"
  | "proyectos"
  | "horas_tecnicos"
  | "herramientas"
  | "administracion";

export interface NavItem {
  id: AdminRoute;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeTone?: "primary" | "ok" | "warn" | "danger" | "info" | "mute";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface AdminLayoutProps {
  onLogout?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onLogout }) => {
  const { user, currentRole, setRole } = useAuth();
  const { materialRequests, physicalCounts } = useApp();
  const { width } = useWindowDimensions();

  // Menú Drawer lateral desplegable desde las 3 líneas
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<AdminRoute>("dashboard");

  // Contadores dinámicos para badges de gestión
  const pendingRequestsCount = materialRequests.filter((r) => r.status === "pendiente").length;
  const pendingCountsCount = physicalCounts.filter((c) => c.status === "pendiente_aprobacion").length;

  const adminGroups: NavGroup[] = [
    {
      title: "RESUMEN Y MONITOREO",
      items: [
        {
          id: "dashboard",
          label: "Dashboard General",
          description: "Métricas ejecutivas, alertas de faena, compras y KPIs",
          icon: "grid-outline",
        },
      ],
    },
    {
      title: "INVENTARIO Y BODEGA",
      items: [
        {
          id: "inventario",
          label: "Inventario & Cardex",
          description: "Control de existencias, PMP valorizado y trazabilidad",
          icon: "cube-outline",
        },
        {
          id: "solicitudes",
          label: "Aprobación de Solicitudes",
          description: "Aprobar, rechazar o ajustar pedidos de materiales en faena",
          icon: "clipboard-outline",
          badge: pendingRequestsCount > 0 ? String(pendingRequestsCount) : undefined,
          badgeTone: "warn",
        },
        {
          id: "mermas",
          label: "Control de Mermas",
          description: "Autorizar bajas por daño, pérdida o caducidad en Cardex",
          icon: "trash-outline",
        },
        {
          id: "conteo",
          label: "Auditoría de Conteos Físicos",
          description: "Validar y aprobar cuadres de stock reportados por bodega",
          icon: "checkbox-outline",
          badge: pendingCountsCount > 0 ? String(pendingCountsCount) : undefined,
          badgeTone: "info",
        },
        {
          id: "kits",
          label: "Kits de Materiales",
          description: "Configurar paquetes estándar de insumos para obras",
          icon: "layers-outline",
        },
        {
          id: "devoluciones",
          label: "Devoluciones de Faena",
          description: "Supervisar sobrantes retornados y su reintegro físico a bodega",
          icon: "return-down-back-outline",
        },
      ],
    },
    {
      title: "COMPRAS Y PROVEEDORES",
      items: [
        {
          id: "compras",
          label: "Órdenes de Compra",
          description: "Emisión, aprobación a proveedores y control de recepción",
          icon: "cart-outline",
        },
        {
          id: "facturas",
          label: "Facturas de Proveedor",
          description: "Validación contable con hasta 3 descuentos sucesivos",
          icon: "receipt-outline",
        },
      ],
    },
    {
      title: "PROYECTOS Y MANO DE OBRA",
      items: [
        {
          id: "proyectos",
          label: "Proyectos y Obras",
          description: "Presupuestos, costos reales H27/H28 y liquidación final",
          icon: "business-outline",
        },
        {
          id: "horas_tecnicos",
          label: "Carga Horas Técnicos",
          description: "Imputar HH en bloques de 0,5 h con motivo justificado",
          icon: "time-outline",
        },
      ],
    },
    {
      title: "ACTIVOS Y GOBERNANZA",
      items: [
        {
          id: "herramientas",
          label: "Control de Herramientas",
          description: "Préstamos a técnicos, estados y mantenciones preventivas",
          icon: "construct-outline",
        },
        {
          id: "administracion",
          label: "Sistema y Auditoría",
          description: "Usuarios, roles, parámetros del sistema y logs de auditoría",
          icon: "settings-outline",
        },
      ],
    },
  ];

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
        return <InventoryScreen key="inventario" initialTab="catalogo" />;
      case "solicitudes":
        return <InventoryScreen key="solicitudes" initialTab="solicitudes" hideTabBar={true} />;
      case "mermas":
        return <InventoryScreen key="mermas" initialTab="mermas" hideTabBar={true} />;
      case "conteo":
        return <InventoryScreen key="conteo" initialTab="conteo" hideTabBar={true} />;
      case "kits":
        return <InventoryScreen key="kits" initialTab="kits" hideTabBar={true} />;
      case "compras":
        return <PurchasingScreen initialTab="ordenes" />;
      case "facturas":
        return <PurchasingScreen initialTab="facturas" />;
      case "proyectos":
        return <ProjectsScreen />;
      case "horas_tecnicos":
        return <AdminManualHoursScreen />;
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
              if (entityType === "insumo") {
                setActiveRoute("inventario");
              } else if (entityType === "solicitud") {
                setActiveRoute("solicitudes");
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

            {/* Lista de navegación con Título y Descripción de cada categoría */}
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {adminGroups.map((group) => (
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
                        accessibilityLabel={`${item.label}: ${item.description}`}
                      >
                        <View style={[styles.navIconBox, isActive && styles.navIconBoxActive]}>
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={isActive ? theme.colors.primaryDark : theme.colors.textSecondary}
                          />
                        </View>
                        <View style={styles.navTextCol}>
                          <View style={styles.navLabelRow}>
                            <Text
                              style={[
                                styles.navLabel,
                                isActive && styles.navLabelActive,
                              ]}
                              numberOfLines={1}
                            >
                              {item.label}
                            </Text>
                            {Boolean(item.badge) && (
                              <Badge
                                label={item.badge!}
                                tone={item.badgeTone || "warn"}
                                size="sm"
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.navDescription,
                              isActive && styles.navDescriptionActive,
                            ]}
                            numberOfLines={2}
                          >
                            {item.description}
                          </Text>
                        </View>
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
    backgroundColor: "#1c1917", // Dark Titanium Bar
    borderBottomWidth: 1.5,
    borderBottomColor: "#292524",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
    ...theme.shadows.md,
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
    backgroundColor: "#292524",
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
    color: "#ffffff",
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
    width: 325,
    maxWidth: "88%",
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
    padding: 6,
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
    textTransform: "uppercase",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    marginBottom: 4,
    backgroundColor: "transparent",
    minHeight: 48,
  },
  navItemActive: {
    backgroundColor: "#fff7ed",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  navIconBox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  navIconBoxActive: {
    backgroundColor: "#fed7aa",
  },
  navTextCol: {
    flex: 1,
  },
  navLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  navLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  navLabelActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  navDescription: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  navDescriptionActive: {
    color: theme.colors.textSecondary,
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
