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
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { SyncStatusChip } from "@/components/common/SyncStatusChip";
import { Toast, ToastType } from "@/components/common/Toast";


// Pantallas del Técnico
import { TechnicianProjectsView } from "@/features/technician/TechnicianProjectsView";
import { TechnicianMaterialsView } from "@/features/technician/TechnicianMaterialsView";
import { TechnicianRegisterView } from "@/features/technician/TechnicianRegisterView";
import { TechnicianServiceSheetsView } from "@/features/technician/TechnicianServiceSheetsView";
import { Project } from "@/core/types";

export type TecnicoTab = "proyectos" | "insumos" | "registrar" | "alertas";

export interface TecnicoLayoutProps {
  onLogout?: () => void;
}

export const TecnicoLayout: React.FC<TecnicoLayoutProps> = ({ onLogout }) => {
  const { user, currentRole, setRole } = useAuth();
  const { materialRequests, serviceSheets } = useApp();

  const [activeTab, setActiveTab] = useState<TecnicoTab>("proyectos");
  const [selectedProjectForTab, setSelectedProjectForTab] = useState<Project | null>(null);
  const [registerInitialSubTab, setRegisterInitialSubTab] = useState<"avance" | "horas" | "sobrante">("avance");
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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

  // Conflictos o alertas
  const conflictCount = serviceSheets.filter((s) => s.hasVersionConflict).length;
  const activeAlertsCount = materialRequests.filter((r) => r.status === "aprobada" || r.status === "pendiente").length;

  const renderContent = () => {
    switch (activeTab) {
      case "proyectos":
        return (
          <TechnicianProjectsView
            isOffline={isOffline}
            onNavigateTab={(tab, proj, subTab) => {
              if (proj) setSelectedProjectForTab(proj);
              if (tab === "registrar") {
                setRegisterInitialSubTab(subTab || "horas");
                setActiveTab("registrar");
              } else if (tab === "insumos") {
                setActiveTab("insumos");
              }
            }}
          />
        );
      case "insumos":
        return (
          <TechnicianMaterialsView
            isOffline={isOffline}
            initialProjectId={selectedProjectForTab?.id}
            onNavigateTab={(tab) => {
              if (tab === "registrar") {
                setRegisterInitialSubTab("sobrante");
                setActiveTab("registrar");
              }
            }}
          />
        );
      case "registrar":
        return (
          <TechnicianRegisterView
            initialSubTab={registerInitialSubTab}
            initialProjectId={selectedProjectForTab?.id}
          />
        );
      case "alertas":
        return <TechnicianServiceSheetsView isOffline={isOffline} />;
      default:
        return <TechnicianProjectsView isOffline={isOffline} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR CELULAR MOBILE-FIRST                                            */}
      {/* ========================================================================= */}
      <View style={styles.topbar}>
        <View style={styles.topLeft}>
          <View style={styles.brandCircle}>
            <Ionicons name="hammer" size={16} color={theme.colors.textInverse} />
          </View>
          <View>
            <Text style={styles.brandTitle}>FYAG TÉCNICO</Text>
            <Text style={styles.userName}>{user.name.split(" ")[0]} • Faena</Text>
          </View>
        </View>

        {/* SyncStatusChip y Selector de Usuario */}
        <View style={styles.topRight}>
          <SyncStatusChip
            variant="dark"
            status={isOffline || pendingSyncCount > 0 ? "pendiente" : "sincronizado"}
            pendingCount={pendingSyncCount}
            onPress={() => {
              if (pendingSyncCount > 0) {
                showToast("Sincronizando operaciones pendientes con el servidor...", "ok");
                setPendingSyncCount(0);
              } else {
                showToast(isOffline ? "Operando en modo sin conexión" : "Todos los datos sincronizados", "info");
              }
            }}
          />



          <TouchableOpacity
            onPress={() => setUserMenuOpen(true)}
            style={styles.avatarBtn}
            accessibilityLabel="Menú de usuario"
          >
            <Text style={styles.avatarText}>{user.initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. OFFLINE BANNER FIJO SUPERIOR (FAENAS REMOTAS SIN SEÑAL)                */}
      {/* ========================================================================= */}
      <OfflineBanner
        onToggle={(offline) => {
          setIsOffline(offline);
          if (offline) {
            setPendingSyncCount((c) => c + 1);
            showToast("Modo Offline activado: Los registros se guardarán localmente", "warn");
          } else {
            showToast("Conexión restablecida: Sincronizando con base central...", "ok");
          }
        }}
      />

      {/* ========================================================================= */}
      {/* 3. ÁREA DE CONTENIDO CENTRAL                                              */}
      {/* ========================================================================= */}
      <View style={styles.mainContent}>
        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 4. BOTTOMNAV CON EXACTAMENTE 4 PESTAÑAS (TOUCH TARGET ≥ 52 PX)            */}
      {/* ========================================================================= */}
      <View style={styles.bottomNav}>
        {/* Pestaña 1: Proyectos */}
        <TouchableOpacity
          onPress={() => setActiveTab("proyectos")}
          activeOpacity={0.7}
          style={[
            styles.navTab,
            activeTab === "proyectos" && styles.navTabActive,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Mis Proyectos en faena"
        >
          <Ionicons
            name={activeTab === "proyectos" ? "hammer" : "hammer-outline"}
            size={22}
            color={activeTab === "proyectos" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === "proyectos" && styles.navTabLabelActive,
            ]}
          >
            Proyectos
          </Text>
        </TouchableOpacity>

        {/* Pestaña 2: Insumos */}
        <TouchableOpacity
          onPress={() => setActiveTab("insumos")}
          activeOpacity={0.7}
          style={[
            styles.navTab,
            activeTab === "insumos" && styles.navTabActive,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Catálogo de Insumos y Pedidos"
        >
          <Ionicons
            name={activeTab === "insumos" ? "cube" : "cube-outline"}
            size={22}
            color={activeTab === "insumos" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === "insumos" && styles.navTabLabelActive,
            ]}
          >
            Insumos
          </Text>
        </TouchableOpacity>

        {/* Pestaña 3: Registrar */}
        <TouchableOpacity
          onPress={() => setActiveTab("registrar")}
          activeOpacity={0.7}
          style={[
            styles.navTab,
            activeTab === "registrar" && styles.navTabActive,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Registrar devolución o consumo"
        >
          <Ionicons
            name={activeTab === "registrar" ? "add-circle" : "add-circle-outline"}
            size={24}
            color={activeTab === "registrar" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              styles.navTabLabel,
              activeTab === "registrar" && styles.navTabLabelActive,
            ]}
          >
            Registrar
          </Text>
        </TouchableOpacity>

        {/* Pestaña 4: Alertas */}
        <TouchableOpacity
          onPress={() => setActiveTab("alertas")}
          activeOpacity={0.7}
          style={[
            styles.navTab,
            activeTab === "alertas" && styles.navTabActive,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Alertas y notificaciones"
        >
          <View style={{ position: "relative" }}>
            <Ionicons
              name={activeTab === "alertas" ? "notifications" : "notifications-outline"}
              size={22}
              color={activeTab === "alertas" ? "#f59e0b" : "#78716c"}
            />
            {activeAlertsCount > 0 && (
              <View style={styles.alertBadgeDot}>
                <Text style={styles.alertBadgeText}>{activeAlertsCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === "alertas" && styles.navTabLabelActive,
            ]}
          >
            Alertas
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 5. MODALES: USUARIO Y DISEÑO                                              */}
      {/* ========================================================================= */}
      <Modal
        visible={userMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUserMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setUserMenuOpen(false)}>
          <View style={styles.userMenuCard} onStartShouldSetResponder={() => true}>
            <View style={styles.userMenuHeader}>
              <View style={[styles.avatarLarge, { backgroundColor: "#1c1917", borderWidth: 2, borderColor: theme.colors.primary }]}>
                <Text style={[styles.avatarLargeText, { color: "#f59e0b" }]}>{user.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userMenuName}>{user.name}</Text>
                <Text style={styles.userMenuRut}>{user.rut}</Text>
                <Badge label="Técnico Especialista" tone="warn" size="sm" style={{ marginTop: 4 }} />
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
                  color={r === currentRole ? theme.colors.primaryDark : theme.colors.textMuted}
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
                  <Ionicons name="checkmark" size={16} color={theme.colors.primaryDark} />
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
    height: 60,
    backgroundColor: "#1c1917", // Dark Titanium Technical Bar
    borderBottomWidth: 1.5,
    borderBottomColor: "#292524",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.md,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 10,
    color: "#a8a29e",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBtn: {
    padding: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    marginHorizontal: 8,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#292524",
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  avatarText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: "#f59e0b",
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: 680,
    flex: 1,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#1c1917", // Dark Titanium
    borderTopWidth: 1.5,
    borderTopColor: "#292524",
    paddingBottom: 6,
    paddingTop: 4,
    height: 60,
    ...theme.shadows.md,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  navTabActive: {
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
    marginTop: -4,
    paddingTop: 2,
  },
  navTabLabel: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    color: "#78716c",
    marginTop: 2,
  },
  navTabLabelActive: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  alertBadgeDot: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: theme.colors.danger,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  alertBadgeText: {
    color: theme.colors.textInverse,
    fontSize: 8,
    fontWeight: theme.fontWeight.semibold,
  },
  alertsContainer: {
    flex: 1,
  },
  alertsContent: {
    padding: theme.spacing.md,
  },
  alertsHeading: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  alertCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: 8,
    ...theme.shadows.sm,
  },
  alertTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  alertProject: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  alertItems: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 68,
    paddingRight: 16,
  },
  userMenuCard: {
    width: 270,
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
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textInverse,
  },
  userMenuName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
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
