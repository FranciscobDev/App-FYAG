import React, { useState } from "react";
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
import { EmptyState } from "@/components/common/EmptyState";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";
import { Project } from "@/core/types";

interface TechnicianProjectsViewProps {
  onSelectProject?: (project: Project) => void;
  onNavigateTab?: (tab: string, project?: Project, subTab?: "avance" | "horas" | "sobrante") => void;
  isOffline?: boolean;
}

export const TechnicianProjectsView: React.FC<TechnicianProjectsViewProps> = ({
  onSelectProject,
  onNavigateTab,
  isOffline = false,
}) => {
  const { projects, activeWorkSession, startWorkSession } = useApp();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Regla estricta: Técnico ve proyectos asignados y NUNCA proyectos cerrados
  const technicianProjects = projects.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(user.rut) || p.technicianRuts.length === 0)
  );

  // Orden obligatorio por fecha límite (deadline ascendente: más urgente primero)
  const sortedProjects = [...technicianProjects].sort((a, b) => {
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Filtro por estado en chips
  const filteredProjects = sortedProjects.filter((p) => {
    if (statusFilter === "todos") return true;
    return p.status === statusFilter;
  });

  const now = Date.now();

  return (
    <ScreenStateWrapper screenTitle="Mis Proyectos (Técnico)" skeletonType="cards">
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. HEADER & STATUS OFFLINE / ONLINE */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headingTitle}>Mis Proyectos en Terreno</Text>
          <Text style={styles.headingSub}>
            Ordenados por fecha límite de entrega ({filteredProjects.length} proyectos)
          </Text>
        </View>

        {isOffline ? (
          <View style={styles.offlineChip}>
            <Ionicons name="cloud-offline" size={14} color={theme.colors.warnDark} />
            <Text style={styles.offlineChipTxt}>Modo Offline</Text>
          </View>
        ) : (
          <View style={styles.onlineChip}>
            <Ionicons name="cloud-done" size={14} color="#22c55e" />
            <Text style={styles.onlineChipTxt}>En Línea</Text>
          </View>
        )}
      </View>

      {/* 2. CHIPS DE FILTRO POR ESTADO */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { id: "todos", label: `Todos (${sortedProjects.length})` },
          { id: "activo", label: `Activos (${sortedProjects.filter((p) => p.status === "activo").length})` },
          { id: "planificado", label: `Planificados (${sortedProjects.filter((p) => p.status === "planificado").length})` },
        ].map((f) => {
          const isActive = statusFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setStatusFilter(f.id)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipTxt, isActive && styles.filterChipTxtActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. LISTADO DE TARJETAS DE PROYECTO */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title="Sin proyectos en este estado"
          description="No tienes obras o faenas activas asignadas que coincidan con el filtro."
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        filteredProjects.map((proj) => {
          // Semáforo de fecha límite:
          // Amarillo si faltan <= 5 días, Rojo si faltan <= 48 horas o vencido
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
            semLabel = `Atención: Faltan ${diffDays} días`;
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
              {/* Header de Tarjeta */}
              <View style={styles.cardTopRow}>
                <View style={styles.codeRow}>
                  <Text style={styles.projectCode}>{proj.code}</Text>
                  <Badge
                    label={proj.kind.toUpperCase()}
                    tone={proj.kind === "obra" ? "info" : "warn"}
                    size="sm"
                  />
                  <EstadoBadge status={proj.status} size="sm" style={{ marginLeft: 6 }} />
                </View>

                {/* Semáforo de Plazo */}
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
                  size="sm"
                />
              </View>

              <Text style={styles.projectName}>{proj.name}</Text>
              <Text style={styles.projectClient}>Cliente: {proj.client}</Text>

              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {proj.address}
                </Text>
              </View>

              {/* Barra de Avance Físico 0-100% */}
              <View style={styles.progressContainer}>
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

              {/* Indicador de Disponibilidad Offline */}
              <View style={styles.offlineSyncNotice}>
                <Ionicons name="checkmark-circle" size={13} color={theme.colors.ok} style={{ marginRight: 4 }} />
                <Text style={styles.offlineSyncTxt}>
                  {isOffline ? "Datos guardados en almacenamiento local del celular" : "Sincronizado con base central"}
                </Text>
              </View>

              {/* Footer con Fecha Límite y Botones Táctiles de Acción (≥ 44 px) */}
              <View style={styles.cardFooter}>
                <View style={styles.deadlineContainer}>
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

                <View style={styles.actionsGroup}>
                  {activeWorkSession?.projectId === proj.id ? (
                    <Button
                      title="En Faena (HH)"
                      variant="primary"
                      size="sm"
                      icon="timer"
                      onPress={() => onNavigateTab && onNavigateTab("registrar", proj, "horas")}
                      style={{ marginRight: 6, height: 42 }}
                    />
                  ) : (
                    <Button
                      title="Iniciar Faena"
                      variant="outline"
                      size="sm"
                      icon="play-outline"
                      onPress={() => {
                        if (!activeWorkSession) {
                          startWorkSession(proj.id);
                        }
                        onNavigateTab && onNavigateTab("registrar", proj, "horas");
                      }}
                      style={{ marginRight: 6, height: 42 }}
                    />
                  )}
                  <Button
                    title="Avance"
                    variant="outline"
                    size="sm"
                    icon="trending-up-outline"
                    onPress={() => onNavigateTab && onNavigateTab("registrar", proj, "avance")}
                    style={{ marginRight: 6, height: 42 }}
                  />
                  <Button
                    title="Insumos"
                    variant="primary"
                    size="sm"
                    icon="cube-outline"
                    onPress={() => onNavigateTab && onNavigateTab("insumos", proj)}
                    style={{ height: 42 }}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
    </ScreenStateWrapper>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  headingTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  headingSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  offlineChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.warnBorder,
  },
  offlineChipTxt: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.warnDark,
    marginLeft: 4,
  },
  onlineChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1917", // Dark Titanium chip
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  onlineChipTxt: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#e7e5e4",
    marginLeft: 4,
  },
  filterScroll: {
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
    minHeight: 38,
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: "#1c1917", // Dark Titanium Active Filter
    borderColor: theme.colors.primary,
  },
  filterChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  filterChipTxtActive: {
    color: "#f59e0b", // Amber glowing text
    fontWeight: "bold",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  projectCard: {
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  projectCardDanger: {
    borderLeftColor: theme.colors.danger,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerLight,
  },
  projectCardWarn: {
    borderLeftColor: theme.colors.warn,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
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
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  projectClient: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  addressText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 4,
    flex: 1,
  },
  progressContainer: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  progressPct: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  offlineSyncNotice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  offlineSyncTxt: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  deadlineContainer: {
    flex: 1,
  },
  deadlineLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  deadlineValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 1,
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
});
