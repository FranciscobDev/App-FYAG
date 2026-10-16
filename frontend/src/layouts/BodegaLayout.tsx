import React, { useState } from "react";
import {
  Modal,
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
import { useApp } from "@/context/AppContext";
import { ROLES, ROLE_ORDER } from "@/core/roles";
import { theme } from "@/core/theme";

// Componentes
import { Badge } from "@/components/common/Badge";
import { NotificationBell } from "@/components/common/NotificationBell";
import { QrScannerModal } from "@/components/common/QrScannerModal";
import { Toast, ToastType } from "@/components/common/Toast";


// Pantallas de Bodega
import { WarehouseDashboard } from "@/features/dashboard/WarehouseDashboard";
import { InventoryScreen } from "@/features/inventory/InventoryScreen";
import { PurchasingScreen } from "@/features/purchasing/PurchasingScreen";
import { ToolsScreen } from "@/features/tools/ToolsScreen";
import { ReturnsScreen } from "@/features/returns/ReturnsScreen";

export type BodegaRoute =
  | "home"
  | "egreso"
  | "recepcion"
  | "devoluciones"
  | "inventario"
  | "conteo"
  | "mermas"
  | "herramientas";

export interface BodegaNavItem {
  id: BodegaRoute;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeTone?: "primary" | "ok" | "warn" | "danger" | "info" | "mute";
}

export interface BodegaNavGroup {
  title: string;
  items: BodegaNavItem[];
}

export interface BodegaLayoutProps {
  onLogout?: () => void;
}

export const BodegaLayout: React.FC<BodegaLayoutProps> = ({ onLogout }) => {
  const { user, currentRole, setRole } = useAuth();
  const { products, materialRequests, pendingReceipts, returnOrders } = useApp();
  const { width } = useWindowDimensions();

  const [activeRoute, setActiveRoute] = useState<BodegaRoute>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Contadores dinámicos para badges de bodega
  const pendingEgressCount = materialRequests.filter((r) => r.status === "aprobada").length;
  const pendingReceiptsCount = pendingReceipts.filter((p) => p.status === "por_confirmar").length;
  const pendingReturnsCount = returnOrders.filter((r) => r.status === "en_transito").length;

  const bodegaGroups: BodegaNavGroup[] = [
    {
      title: "OPERACIÓN Y MOVIMIENTOS",
      items: [
        {
          id: "home",
          label: "Panel Principal",
          description: "Resumen de pendientes del día, accesos rápidos y alertas",
          icon: "grid-outline",
        },
        {
          id: "egreso",
          label: "Egreso y Despacho",
          description: "Entrega física de materiales a técnicos con guía de salida",
          icon: "arrow-up-circle-outline",
          badge: pendingEgressCount > 0 ? String(pendingEgressCount) : undefined,
          badgeTone: "primary",
        },
        {
          id: "recepcion",
          label: "Recepción de Compras",
          description: "Verificar bultos, guías de proveedor y dar conformidad a OC",
          icon: "arrow-down-circle-outline",
          badge: pendingReceiptsCount > 0 ? String(pendingReceiptsCount) : undefined,
          badgeTone: "warn",
        },
        {
          id: "devoluciones",
          label: "Devoluciones de Faena",
          description: "Recibir sobrantes de obra, verificar cantidades y reingresar",
          icon: "return-down-back-outline",
          badge: pendingReturnsCount > 0 ? String(pendingReturnsCount) : undefined,
          badgeTone: "info",
        },
      ],
    },
    {
      title: "CONTROL DE EXISTENCIAS",
      items: [
        {
          id: "inventario",
          label: "Inventario de Bodega",
          description: "Consultar stock disponible, pasillo, estante y PMP",
          icon: "cube-outline",
        },
        {
          id: "conteo",
          label: "Conteo Físico Cíclico",
          description: "Escanear insumos, cuadrar stock físico y reportar diferencias",
          icon: "checkbox-outline",
        },
        {
          id: "mermas",
          label: "Registro de Mermas",
          description: "Reportar insumos dañados, caducados o pérdidas para baja",
          icon: "trash-outline",
        },
      ],
    },
    {
      title: "EQUIPOS Y HERRAMIENTAS",
      items: [
        {
          id: "herramientas",
          label: "Préstamo de Herramientas",
          description: "Asignar herramientas a técnicos y verificar estado al retorno",
          icon: "construct-outline",
        },
      ],
    },
  ];

  // Modales
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<ToastType>("ok");

  const showToast = (msg: string, type: ToastType = "ok") => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleScanResult = (code: string) => {
    setScannedCode(code);
    setScannerOpen(false);
    const prod = products.find((p) => p.sku === code);
    if (prod) {
      showToast(`SKU Identificado: ${prod.name} (${prod.stock} ${prod.unit} en stock)`, "ok");
    } else {
      showToast(`Código escaneado: ${code}`, "info");
    }
  };

  const renderContent = () => {
    switch (activeRoute) {
      case "home":
        return <WarehouseDashboard onNavigate={(tab) => setActiveRoute(tab as BodegaRoute)} />;
      case "egreso":
        return <InventoryScreen key="egreso" initialTab="egreso" hideTabBar={true} />;
      case "conteo":
        return <InventoryScreen key="conteo" initialTab="conteo" hideTabBar={true} />;
      case "mermas":
        return <InventoryScreen key="mermas" initialTab="mermas" hideTabBar={true} />;
      case "inventario":
        return <InventoryScreen key="inventario" initialTab="catalogo" hideTabBar={true} />;
      case "recepcion":
        return <PurchasingScreen initialTab="recepcion" />;
      case "herramientas":
        return <ToolsScreen />;
      case "devoluciones":
        return <ReturnsScreen />;
      default:
        return <WarehouseDashboard onNavigate={(tab) => setActiveRoute(tab as BodegaRoute)} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR RESPONSIVA                                                      */}
      {/* ========================================================================= */}
      <View style={[styles.topbar, width < 560 && styles.topbarCompact]}>
        <View style={styles.topLeft}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.toggleBtn}
            accessibilityLabel="Abrir menú de navegación"
            accessibilityRole="button"
          >
            <Ionicons name="menu-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.brandIconCircle}>
            <Ionicons name="cube" size={20} color={theme.colors.textInverse} />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.brandTitle}>FYAG BODEGA</Text>
              {width >= 480 && (
                <Badge label="TABLET" tone="warn" size="sm" style={{ marginLeft: 6 }} />
              )}
            </View>
            {width >= 600 && (
              <Text style={styles.warehouseSubtitle}>Bodega Central Santiago • Terminal R-1</Text>
            )}
          </View>
        </View>

        {/* Acciones Rápidas Superior: Campana en la esquina */}
        <View style={styles.topRight}>
          <NotificationBell />
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. CUERPO: ÁREA PRINCIPAL A PANTALLA COMPLETA                             */}
      {/* ========================================================================= */}
      <View style={styles.bodyWrapper}>
        {/* ÁREA DE CONTENIDO */}
        <View style={styles.mainContent}>
          {/* Banner de código escaneado si existe */}
          {scannedCode && (
            <View style={styles.scannedNotice}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.ok} />
              <Text style={styles.scannedNoticeText}>
                Última lectura: <Text style={{ fontWeight: theme.fontWeight.semibold }}>{scannedCode}</Text>
              </Text>
              <TouchableOpacity onPress={() => setScannedCode(null)} style={{ marginLeft: "auto" }}>
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.brandIconCircle}>
                  <Ionicons name="cube" size={20} color={theme.colors.textInverse} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.brandTitle}>FYAG BODEGA</Text>
                  <Badge label="TABLET" tone="warn" size="sm" style={{ alignSelf: "flex-start", marginTop: 2 }} />
                </View>
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
              {bodegaGroups.map((group) => (
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
                            color={isActive ? theme.colors.warnDark : theme.colors.textSecondary}
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
                  <Text style={styles.userRole}>Bodeguero</Text>
                </View>
                <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. BOTÓN FLOTANTE: ESCÁNER QR/BARRAS                                      */}
      {/* ========================================================================= */}
      <TouchableOpacity
        onPress={() => setScannerOpen(true)}
        style={styles.floatingScanFab}
        activeOpacity={0.85}
        accessibilityLabel="Escanear código QR o código de barras de material"
        accessibilityRole="button"
      >
        <Ionicons name="barcode-outline" size={24} color={theme.colors.textInverse} />
        <Text style={styles.floatingFabText}>Escanear</Text>
      </TouchableOpacity>

      {/* ========================================================================= */}
      {/* 4. MODALES: ESCÁNER, USUARIO Y DISEÑO                                     */}
      {/* ========================================================================= */}
      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanResult={handleScanResult}
      />

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
              <View style={[styles.avatarLarge, { backgroundColor: theme.colors.warnDark }]}>
                <Text style={styles.avatarLargeText}>{user.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userMenuName}>{user.name}</Text>
                <Text style={styles.userMenuRut}>{user.rut}</Text>
                <Badge label="Bodeguero Central" tone="warn" size="sm" style={{ marginTop: 4 }} />
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
                  color={r === currentRole ? theme.colors.warnDark : theme.colors.textMuted}
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
                  <Ionicons name="checkmark" size={16} color={theme.colors.warnDark} />
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.userMenuDivider} />

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



      {/* TOAST FLOTANTE */}
      <Toast
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
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
    marginRight: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: "#292524",
  },
  brandIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: "#ffffff",
  },
  warehouseSubtitle: {
    fontSize: 11,
    color: "#a8a29e",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1,
    borderColor: theme.colors.warnBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginRight: 12,
  },
  designBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.warnDark,
    marginLeft: 4,
  },
  userBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.warnDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  userRole: {
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
    position: "relative",
    width: "100%",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 1280,
    flex: 1,
    alignSelf: "center",
  },
  scannedNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primaryBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    width: "100%",
  },
  scannedNoticeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    marginLeft: 6,
  },
  floatingScanFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.full,
    minHeight: 48,
    ...theme.shadows.md,
    zIndex: 90,
  },
  floatingFabText: {
    color: theme.colors.textInverse,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    marginLeft: 8,
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
    backgroundColor: "#fffbeb",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warnDark,
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
    backgroundColor: "#fde68a",
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
    color: theme.colors.warnDark,
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
  userInfo: {
    marginHorizontal: 8,
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
    backgroundColor: theme.colors.warnLight,
  },
  roleSwitchText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  roleSwitchTextCurrent: {
    color: theme.colors.warnDark,
    fontWeight: "bold",
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
