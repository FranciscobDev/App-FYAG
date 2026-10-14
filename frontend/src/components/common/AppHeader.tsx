import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { ROLES, ROLE_ORDER } from "@/core/roles";
import { theme } from "@/core/theme";
import { Badge } from "./Badge";
import { NotificationBell } from "./NotificationBell";
import { DesignSystemScreen } from "@/features/design-system/DesignSystemScreen";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  rightAction,
}) => {
  const { currentRole, user, setRole } = useAuth();
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [designModalVisible, setDesignModalVisible] = useState(false);
  const roleConfig = ROLES[currentRole];

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={16} color="#ffffff" />
          </View>
          <Text style={styles.brandText}>FYAG</Text>
          <Text style={styles.brandSub}>MULTISYSTEM</Text>
        </View>

        <View style={styles.topActionsRow}>
          <TouchableOpacity
            onPress={() => setDesignModalVisible(true)}
            style={styles.designSystemBtn}
            activeOpacity={0.7}
            accessibilityLabel="Ver Catálogo de Componentes y Sistema de Diseño"
          >
            <Ionicons name="color-palette-outline" size={16} color={theme.colors.primaryDark} />
            <Text style={styles.designSystemBtnText}>Componentes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRoleModalVisible(true)}
            style={styles.rolePickerBtn}
            activeOpacity={0.7}
          >
            <Badge
              label={roleConfig.label}
              tone={
                currentRole === "admin"
                  ? ("primary" as any)
                  : currentRole === "warehouse"
                  ? "warn"
                  : "ok"
              }
              size="sm"
              icon="swap-horizontal-outline"
            />
          </TouchableOpacity>

          <View style={{ marginLeft: 8 }}>
            <NotificationBell />
          </View>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.pageTitle}>{title}</Text>
          {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
        </View>
        {rightAction && <View style={styles.actionCol}>{rightAction}</View>}
      </View>

      {/* Role Switcher Modal */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRoleModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar Perfil / Rol</Text>
            <Text style={styles.modalDesc}>
              Seleccione un perfil para simular su interfaz y permisos específicos:
            </Text>

            {ROLE_ORDER.map((r) => {
              const cfg = ROLES[r];
              const isSelected = r === currentRole;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleOption,
                    isSelected && styles.roleOptionSelected,
                  ]}
                  onPress={() => {
                    setRole(r);
                    setRoleModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.roleIconBox,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primaryLight
                          : theme.colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        r === "admin"
                          ? "briefcase"
                          : r === "warehouse"
                          ? "cube"
                          : "hammer"
                      }
                      size={20}
                      color={
                        isSelected ? theme.colors.primary : theme.colors.textMuted
                      }
                    />
                  </View>
                  <View style={styles.roleTextBox}>
                    <Text
                      style={[
                        styles.roleName,
                        isSelected && { color: theme.colors.primary },
                      ]}
                    >
                      {cfg.label}
                    </Text>
                    <Text style={styles.roleHint}>{cfg.deviceHint}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Modal Pantalla Completa Sistema de Diseño (Paso 1) */}
      <Modal
        visible={designModalVisible}
        animationType="slide"
        onRequestClose={() => setDesignModalVisible(false)}
      >
        <View style={styles.designModalContainer}>
          <View style={styles.designModalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="color-palette" size={20} color={theme.colors.primary} />
              <Text style={styles.designModalTitle}>Sistema de Diseño • FYAG Paso 1</Text>
            </View>
            <TouchableOpacity
              onPress={() => setDesignModalVisible(false)}
              style={styles.closeDesignBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <DesignSystemScreen />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  brandText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginLeft: 4,
  },
  topActionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  designSystemBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    marginRight: 8,
  },
  designSystemBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primaryDark,
    marginLeft: 4,
  },
  designModalContainer: {
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
  rolePickerBtn: {
    paddingVertical: 2,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2,
  },
  titleCol: {
    flex: 1,
  },
  pageTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  pageSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  actionCol: {
    marginLeft: theme.spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  roleOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#f0f9ff",
  },
  roleIconBox: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  roleTextBox: {
    flex: 1,
  },
  roleName: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: theme.colors.text,
  },
  roleHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
