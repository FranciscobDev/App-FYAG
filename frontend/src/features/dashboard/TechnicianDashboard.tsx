import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { ProgressBar } from "@/components/common/ProgressBar";

interface TechnicianDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ onNavigate }) => {
  const { projects } = useApp();
  const { user } = useAuth();

  // Filter projects assigned to this technician and EXCLUDE closed projects
  const assignedProjects = projects.filter(
    (p) => p.status !== "cerrado" && (p.technicianRuts.includes(user.rut) || p.technicianRuts.length === 0)
  );

  const now = new Date().getTime();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 0. OFFLINE / ONLINE STATUS BANNER */}
      <View style={{ marginBottom: theme.spacing.sm, marginHorizontal: -theme.spacing.md }}>
        <OfflineBanner />
      </View>

      {/* 1. WELCOME CARD */}
      <View style={styles.welcomeBanner}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user.initials}</Text>
        </View>
        <View style={styles.welcomeTextCol}>
          <Text style={styles.welcomeTitle}>Hola, {user.name.split(" ")[0]}</Text>
          <Text style={styles.welcomeSub}>
            Tienes {assignedProjects.length} proyecto(s) activo(s) en terreno
          </Text>
        </View>
      </View>

      {/* 2. QUICK ACTION BAR */}
      <View style={styles.quickBar}>
        <Button
          title="Devolver Sobrante"
          variant="outline"
          size="sm"
          icon="return-down-back-outline"
          onPress={() => onNavigate && onNavigate("devolucion")}
          style={{ flex: 1, marginRight: 8, borderColor: theme.colors.transit }}
          textStyle={{ color: theme.colors.transit }}
        />
        <Button
          title="Pedir Material"
          variant="primary"
          size="sm"
          icon="add-circle-outline"
          onPress={() => onNavigate && onNavigate("solicitudes")}
          style={{ flex: 1 }}
        />
      </View>

      {/* 3. ASSIGNED PROJECTS CARDS WITH DAYS SEMAPHORE */}
      <Text style={styles.sectionHeading}>Mis Proyectos Asignados</Text>

      {assignedProjects.length === 0 ? (
        <Card variant="outlined">
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={40} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>Sin proyectos asignados</Text>
            <Text style={styles.emptySub}>No tienes obras o mantenciones activas en este momento.</Text>
          </View>
        </Card>
      ) : (
        assignedProjects.map((proj) => {
          // Calculate remaining hours and days
          const deadlineMs = new Date(proj.deadline).getTime();
          const diffMs = deadlineMs - now;
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let semTone: "ok" | "warn" | "danger" = "ok";
          let semLabel = `Quedan ${diffDays} días`;

          if (diffMs <= 0) {
            semTone = "danger";
            semLabel = "¡Plazo Vencido!";
          } else if (diffHours <= 48) {
            semTone = "danger";
            semLabel = `¡Crítico! Faltan ${diffHours} horas`;
          } else if (diffDays <= 5) {
            semTone = "warn";
            semLabel = `Atención: Quedan ${diffDays} días`;
          }

          return (
            <Card
              key={proj.id}
              variant="elevated"
              style={[
                styles.projectCard,
                semTone === "danger" && styles.projectCardDanger,
                semTone === "warn" && styles.projectCardWarn,
              ]}
            >
              <View style={styles.projectTop}>
                <View style={styles.codeRow}>
                  <Text style={styles.projectCode}>{proj.code}</Text>
                  <Badge
                    label={proj.kind.toUpperCase()}
                    tone={proj.kind === "obra" ? "info" : "warn"}
                    size="sm"
                  />
                </View>
                <Badge
                  label={semLabel}
                  tone={semTone}
                  icon={
                    semTone === "danger"
                      ? "alert-circle"
                      : semTone === "warn"
                      ? "time-outline"
                      : "calendar-outline"
                  }
                />
              </View>

              <Text style={styles.projectName}>{proj.name}</Text>
              <Text style={styles.projectClient}>Cliente: {proj.client}</Text>

              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.addressText} numberOfLines={1}>{proj.address}</Text>
              </View>

              {/* Avance físico con componente ProgressBar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Avance físico de la obra</Text>
                  <Text style={styles.progressPct}>{proj.progress}%</Text>
                </View>
                <ProgressBar
                  value={proj.progress}
                  max={100}
                  height={8}
                  color={
                    semTone === "danger"
                      ? theme.colors.danger
                      : semTone === "warn"
                      ? theme.colors.warn
                      : theme.colors.primary
                  }
                />
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.deadlineCol}>
                  <Text style={styles.deadlineLabel}>Fecha Límite:</Text>
                  <Text
                    style={[
                      styles.deadlineValue,
                      semTone === "danger" && { color: theme.colors.danger, fontWeight: "bold" },
                    ]}
                  >
                    {formatDate(proj.deadline)}
                  </Text>
                </View>
                <View style={styles.footerActions}>
                  <Button
                    title="Devolver"
                    variant="outline"
                    size="sm"
                    icon="return-down-back-outline"
                    onPress={() => onNavigate && onNavigate("devolucion")}
                    style={{ marginRight: 6, borderColor: theme.colors.transit }}
                    textStyle={{ color: theme.colors.transit }}
                  />
                  <Button
                    title="Pedir Material"
                    variant="primary"
                    size="sm"
                    icon="cart-outline"
                    onPress={() => onNavigate && onNavigate("solicitudes")}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: theme.fontSize.md,
  },
  welcomeTextCol: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  welcomeSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  quickBar: {
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  sectionHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  projectCard: {
    marginBottom: theme.spacing.md,
  },
  projectTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 6,
  },
  projectName: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginVertical: 2,
  },
  projectClient: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  addressText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginLeft: 4,
    flex: 1,
  },
  progressSection: {
    marginVertical: theme.spacing.xs,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  progressPct: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  deadlineCol: {},
  deadlineLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  deadlineValue: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  projectCardDanger: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
    borderColor: theme.colors.dangerBorder,
  },
  projectCardWarn: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warn,
    borderColor: theme.colors.warnBorder,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
});
