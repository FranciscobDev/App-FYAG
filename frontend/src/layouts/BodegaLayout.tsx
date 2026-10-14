import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { DesignSystemScreen } from "@/features/design-system/DesignSystemScreen";

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
  | "conteo"
  | "inventario"
  | "herramientas"
  | "devoluciones";

interface BodegaNavItem {
  id: BodegaRoute;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  highlight?: boolean;
}

const BODEGA_ITEMS: BodegaNavItem[] = [
  { id: "home", label: "Inicio", icon: "cube" },
  { id: "egreso", label: "Egreso", icon: "arrow-up-circle", highlight: true },
  { id: "recepcion", label: "Recepción", icon: "arrow-down-circle", highlight: true },
  { id: "conteo", label: "Conteo", icon: "clipboard", highlight: true },
  { id: "inventario", label: "Cardex", icon: "list-outline" },
  { id: "herramientas", label: "Herram.", icon: "construct-outline" },
  { id: "devoluciones", label: "Devoluc.", icon: "return-down-back-outline" },
];

export interface BodegaLayoutProps {
  onLogout?: () => void;
}

export const BodegaLayout: React.FC<BodegaLayoutProps> = ({ onLogout }) => {
  const { user, currentRole, setRole } = useAuth();
  const { products } = useApp();

  const [activeRoute, setActiveRoute] = useState<BodegaRoute>("home");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Modales
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [designModalOpen, setDesignModalOpen] = useState(false);

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
        return <InventoryScreen initialTab="egreso" />;
      case "conteo":
        return <InventoryScreen initialTab="conteo" />;
      case "inventario":
        return <InventoryScreen initialTab="catalogo" />;
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
      {/* 1. TOPBAR TABLET                                                          */}
      {/* ========================================================================= */}
      <View style={styles.topbar}>
        <View style={styles.topLeft}>
          <View style={styles.brandIconCircle}>
            <Ionicons name="cube" size={20} color={theme.colors.textInverse} />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.brandTitle}>FYAG BODEGA</Text>
              <Badge label="TABLET" tone="warn" size="sm" style={{ marginLeft: 6 }} />
            </View>
            <Text style={styles.warehouseSubtitle}>Bodega Central Santiago • Terminal R-1</Text>
          </View>
        </View>

        {/* Acciones Rápidas Superior */}
        <View style={styles.topRight}>
          <TouchableOpacity
            onPress={() => setDesignModalOpen(true)}
            style={styles.designBtn}
            accessibilityLabel="Ver Catálogo de Componentes"
          >
            <Ionicons name="color-palette-outline" size={16} color={theme.colors.warnDark} />
            <Text style={styles.designBtnText}>Componentes</Text>
          </TouchableOpacity>

          <NotificationBell />

          <TouchableOpacity
            onPress={() => setUserMenuOpen(true)}
            style={styles.userBadgeBtn}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.initials}</Text>
            </View>
            <View style={{ marginHorizontal: 6 }}>
              <Text style={styles.userName}>{user.name.split(" ")[0]}</Text>
              <Text style={styles.userRole}>Bodeguero</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. CUERPO: SIDEBAR COMPACTO TABLET + ÁREA PRINCIPAL                       */}
      {/* ========================================================================= */}
      <View style={styles.bodyWrapper}>
        {/* SIDEBAR COMPACTO CON ICONOS GRANDES (TOUCH TARGETS ≥ 50 PX) */}
        <View style={styles.sidebar}>
          <ScrollView
            contentContainerStyle={styles.sidebarContent}
            showsVerticalScrollIndicator={false}
          >
            {BODEGA_ITEMS.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setActiveRoute(item.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.navItem,
                    item.highlight && styles.navItemHighlight,
                    isActive && styles.navItemActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Ionicons
                    name={item.icon}
                    size={26}
                    color={
                      isActive
                        ? theme.colors.warnDark
                        : item.highlight
                        ? theme.colors.primaryDark
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.navLabel,
                      isActive && styles.navLabelActive,
                      item.highlight && styles.navLabelHighlight,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Botón Escáner dentro del Sidebar para acceso directo */}
          <View style={styles.sidebarScanBox}>
            <TouchableOpacity
              onPress={() => setScannerOpen(true)}
              style={styles.sidebarScanBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="barcode-outline" size={24} color={theme.colors.textInverse} />
              <Text style={styles.sidebarScanText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

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
      {/* 3. BOTÓN FLOTANTE (FAB) DE ESCÁNER QR/BARRAS SIEMPRE VISIBLE              */}
      {/* ========================================================================= */}
      <TouchableOpacity
        onPress={() => setScannerOpen(true)}
        style={styles.floatingScanFab}
        activeOpacity={0.85}
        accessibilityLabel="Escanear código QR o código de barras de material"
        accessibilityRole="button"
      >
        <Ionicons name="barcode-outline" size={28} color={theme.colors.textInverse} />
        <Text style={styles.floatingFabText}>Escanear QR / Barras</Text>
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

      {/* Modal Pantalla Completa Sistema de Diseño */}
      <Modal
        visible={designModalOpen}
        animationType="slide"
        onRequestClose={() => setDesignModalOpen(false)}
      >
        <View style={styles.designModalWrapper}>
          <View style={styles.designModalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="color-palette" size={20} color={theme.colors.warnDark} />
              <Text style={styles.designModalTitle}>Catálogo de Componentes FYAG</Text>
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
  brandIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.warnDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  warehouseSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
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
    flexDirection: "row",
  },
  sidebar: {
    width: 88,
    backgroundColor: theme.colors.card,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sidebarContent: {
    paddingVertical: 10,
    alignItems: "center",
  },
  navItem: {
    width: 72,
    minHeight: 56, // Touch target táctil amplio para tablet
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    paddingVertical: 6,
  },
  navItemHighlight: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navItemActive: {
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1.5,
    borderColor: theme.colors.warn,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginTop: 3,
    textAlign: "center",
  },
  navLabelActive: {
    color: theme.colors.warnDark,
    fontWeight: "bold",
  },
  navLabelHighlight: {
    fontWeight: "bold",
  },
  sidebarScanBox: {
    paddingBottom: 16,
    alignItems: "center",
  },
  sidebarScanBtn: {
    width: 60,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm,
  },
  sidebarScanText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textInverse,
    marginTop: 2,
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
    position: "relative",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 1280,
    flex: 1,
  },
  scannedNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.okLight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.okBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    width: "100%",
  },
  scannedNoticeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.okDark,
    marginLeft: 6,
  },
  floatingScanFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    minHeight: 56, // Botón grande táctil para tablet
    ...theme.shadows.lg,
    zIndex: 99,
  },
  floatingFabText: {
    color: theme.colors.textInverse,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    marginLeft: 8,
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
