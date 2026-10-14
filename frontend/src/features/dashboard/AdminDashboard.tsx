import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { formatCLP, formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Column, DataTable } from "@/components/common/DataTable";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { KpiCard } from "@/components/common/KpiCard";
import { ModalView } from "@/components/common/ModalView";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SemaforoBadge } from "@/components/common/SemaforoBadge";
import { Toast, ToastType } from "@/components/common/Toast";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";
import { MaterialRequest } from "@/core/types";

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const {
    projects,
    products,
    purchaseOrders,
    materialRequests,
    alerts,
    approveMaterialRequest,
    rejectMaterialRequest,
  } = useApp();
  const { user } = useAuth();

  // Metrics
  const pendingRequests = materialRequests.filter((r) => r.status === "pendiente");
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock && !p.disabled);
  const openOrders = purchaseOrders.filter(
    (o) => o.status === "borrador" || o.status === "enviada" || o.status === "recibida_parcial"
  );
  const redProjects = projects.filter(
    (p) => p.status === "activo" && p.budget > 0 && p.costReal / p.budget > 1.0
  );

  // Reject Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaterialRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<ToastType>("ok");

  const showToast = (msg: string, type: ToastType = "ok") => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleOpenReject = (req: MaterialRequest) => {
    setSelectedReq(req);
    setRejectionReason("");
    setRejectError("");
    setRejectModalVisible(true);
  };

  const handleConfirmReject = () => {
    if (!selectedReq) return;
    if (!rejectionReason.trim()) {
      setRejectError("Debe ingresar un motivo para rechazar la solicitud.");
      return;
    }
    const res = rejectMaterialRequest(selectedReq.id, rejectionReason, user.name);
    if (res.success) {
      setRejectModalVisible(false);
      setSelectedReq(null);
      showToast("Solicitud rechazada con motivo informado.", "warn");
    } else if (res.error) {
      setRejectError(res.error);
    }
  };

  // Columnas para la Tabla de Solicitudes Pendientes (Paso 5)
  const requestColumns: Column<MaterialRequest>[] = [
    {
      key: "code",
      title: "CÓDIGO / URGENCIA",
      width: 150,
      render: (req) => (
        <View>
          <Text style={styles.tableCodeText}>{req.code}</Text>
          <Badge
            label={req.urgency.toUpperCase()}
            tone={req.urgency === "urgente" ? "danger" : req.urgency === "alta" ? "warn" : "info"}
            size="sm"
            style={{ marginTop: 4, alignSelf: "flex-start" }}
          />
        </View>
      ),
    },
    {
      key: "projectName",
      title: "PROYECTO",
      width: 190,
      render: (req) => (
        <View>
          <Text style={styles.tableProjectName} numberOfLines={2}>
            {req.projectName}
          </Text>
        </View>
      ),
    },
    {
      key: "technicianName",
      title: "SOLICITA",
      width: 160,
      render: (req) => (
        <View>
          <Text style={styles.tableTechText}>{req.technicianName}</Text>
          <Text style={styles.tableDateText}>{formatDate(req.date)}</Text>
        </View>
      ),
    },
    {
      key: "items",
      title: "MATERIALES",
      render: (req) => (
        <View>
          <Text style={styles.tableItemsText} numberOfLines={2}>
            {req.items.map((it) => `${it.quantity} ${it.unit} ${it.name}`).join(" • ")}
          </Text>
          {req.comment ? (
            <Text style={styles.tableCommentText} numberOfLines={1}>
              Nota: "{req.comment}"
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: "actions",
      title: "ACCIONES",
      width: 190,
      render: (req) => (
        <View style={styles.tableActionsRow}>
          <Button
            title="Rechazar"
            variant="outline"
            size="sm"
            icon="close-outline"
            onPress={() => handleOpenReject(req)}
            style={{ borderColor: theme.colors.danger, marginRight: 6 }}
            textStyle={{ color: theme.colors.danger }}
          />
          <Button
            title="Aprobar"
            variant="success"
            size="sm"
            icon="checkmark-outline"
            onPress={() => {
              approveMaterialRequest(req.id, user.name);
              showToast(`Solicitud ${req.code} aprobada para despacho.`, "ok");
            }}
          />
        </View>
      ),
    },
  ];

  return (
    <ScreenStateWrapper
      screenTitle="Dashboard General"
      skeletonType="kpis"
      emptyProps={{
        title: "No hay actividad reciente en el Dashboard",
        description: "No se registran solicitudes pendientes, proyectos activos ni alertas en el sistema.",
        actionTitle: "Ver Inventario",
        onAction: () => onNavigate && onNavigate("inventario"),
      }}
      errorProps={{
        title: "Error al cargar métricas del Dashboard",
        message: "No fue posible sincronizar los indicadores de gestión con la base de datos.",
      }}
      forbiddenProps={{
        title: "Acceso Restringido al Dashboard Administrativo",
        message: "Solo usuarios con rol Administrador tienen autorización para consultar métricas financieras y aprobar solicitudes.",
      }}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. KPI CARDS */}
      <View style={styles.kpiGrid}>
        <KpiCard
          label="Solicitudes Pendientes"
          value={pendingRequests.length}
          subtitle="Requieren aprobación"
          tone={pendingRequests.length > 0 ? "warn" : "ok"}
          icon="clipboard-outline"
          onPress={() => onNavigate && onNavigate("inventario")}
        />
        <KpiCard
          label="Insumos Bajo Mínimo"
          value={lowStockProducts.length}
          subtitle="Stock crítico bodega"
          tone={lowStockProducts.length > 0 ? "danger" : "ok"}
          icon="warning-outline"
          onPress={() => onNavigate && onNavigate("inventario")}
        />
        <KpiCard
          label="Órdenes de Compra"
          value={openOrders.length}
          subtitle="Abiertas / en curso"
          tone="info"
          icon="cart-outline"
          onPress={() => onNavigate && onNavigate("compras")}
        />
        <KpiCard
          label="Proyectos en Rojo"
          value={redProjects.length}
          subtitle="Sobregiro > 100%"
          tone={redProjects.length > 0 ? "danger" : "ok"}
          icon="trending-down-outline"
          onPress={() => onNavigate && onNavigate("proyectos")}
        />
      </View>

      {/* 2. RECENT ALERTS */}
      <Card variant="outlined">
        <View style={styles.sectionHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="notifications-outline" size={18} color={theme.colors.warn} />
            <Text style={styles.sectionTitle}>Alertas Críticas Recientes</Text>
          </View>
        </View>
        {alerts.slice(0, 3).map((alert) => (
          <View key={alert.id} style={styles.alertRow}>
            <View
              style={[
                styles.alertDot,
                {
                  backgroundColor:
                    alert.severity === "rojo"
                      ? theme.colors.danger
                      : alert.severity === "amarillo"
                      ? theme.colors.warn
                      : theme.colors.info,
                },
              ]}
            />
            <View style={styles.alertTextCol}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDesc}>{alert.description}</Text>
            </View>
            <Text style={styles.alertTime}>{alert.time}</Text>
          </View>
        ))}
      </Card>

      {/* 3. PROYECTOS CON SEMÁFORO DE COSTO */}
      <Card variant="elevated">
        <View style={styles.sectionHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Semáforo de Costos por Proyecto</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("proyectos")}>
            <Text style={styles.linkText}>Ver todos ({projects.length})</Text>
          </TouchableOpacity>
        </View>

        {projects.slice(0, 4).map((proj) => {
          const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
          const pct = Math.round(ratio * 100);

          return (
            <View key={proj.id} style={styles.projectRow}>
              <View style={styles.projInfoCol}>
                <View style={styles.projHeader}>
                  <Text style={styles.projCode}>{proj.code}</Text>
                  <EstadoBadge status={proj.status} size="sm" />
                </View>
                <Text style={styles.projName}>{proj.name}</Text>
                <Text style={styles.projClient}>Cliente: {proj.client}</Text>
              </View>

              <View style={styles.projFinancialCol}>
                <View style={styles.financialNumbers}>
                  <Text style={styles.costRealText}>{formatCLP(proj.costReal)}</Text>
                  <Text style={styles.budgetText}> / {formatCLP(proj.budget)}</Text>
                </View>

                <ProgressBar
                  value={proj.costReal}
                  max={proj.budget}
                  height={8}
                  semaforo
                  containerStyle={{ marginVertical: 6 }}
                />

                <View style={styles.semaphoreRow}>
                  <SemaforoBadge percentage={pct} size="sm" />
                </View>
              </View>
            </View>
          );
        })}
      </Card>

      {/* 4. TABLA DE SOLICITUDES PENDIENTES DE APROBACIÓN */}
      <Card variant="elevated">
        <View style={styles.sectionHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="clipboard-outline" size={18} color={theme.colors.warn} />
            <Text style={styles.sectionTitle}>
              Tabla de Solicitudes Pendientes de Aprobación ({pendingRequests.length})
            </Text>
          </View>
        </View>

        {pendingRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={36} color={theme.colors.ok} />
            <Text style={styles.emptyTitle}>Al día</Text>
            <Text style={styles.emptySub}>No hay solicitudes pendientes de aprobación.</Text>
          </View>
        ) : (
          <DataTable
            columns={requestColumns}
            data={pendingRequests}
            keyExtractor={(r) => r.id}
            pageSize={5}
            showSearch={false}
            cardRender={(req) => (
              <View style={styles.requestCard}>
                <View style={styles.reqTop}>
                  <View>
                    <View style={styles.reqCodeRow}>
                      <Text style={styles.requestCode}>{req.code}</Text>
                      <Badge
                        label={req.urgency.toUpperCase()}
                        tone={req.urgency === "urgente" ? "danger" : req.urgency === "alta" ? "warn" : "info"}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.reqProject}>{req.projectName}</Text>
                    <Text style={styles.reqTech}>
                      Solicita: {req.technicianName} • {formatDate(req.date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.reqItemsBox}>
                  <Text style={styles.reqItemsLabel}>Materiales solicitados:</Text>
                  {req.items.map((it, idx) => (
                    <Text key={idx} style={styles.reqItemLine}>
                      • {it.quantity} {it.unit} - {it.name}
                    </Text>
                  ))}
                  {req.comment && (
                    <Text style={styles.reqCommentText}>
                      Nota: "{req.comment}"
                    </Text>
                  )}
                </View>

                <View style={styles.reqActionRow}>
                  <Button
                    title="Rechazar"
                    variant="outline"
                    size="sm"
                    icon="close-outline"
                    onPress={() => handleOpenReject(req)}
                    style={{ borderColor: theme.colors.danger, marginRight: 8 }}
                    textStyle={{ color: theme.colors.danger }}
                  />
                  <Button
                    title="Aprobar Solicitud"
                    variant="success"
                    size="sm"
                    icon="checkmark-outline"
                    onPress={() => {
                      approveMaterialRequest(req.id, user.name);
                      showToast(`Solicitud ${req.code} aprobada para despacho.`, "ok");
                    }}
                  />
                </View>
              </View>
            )}
          />
        )}
      </Card>

      {/* REJECT MODAL */}
      <ModalView
        visible={rejectModalVisible}
        onClose={() => setRejectModalVisible(false)}
        title="Rechazar Solicitud de Material"
        subtitle={selectedReq ? `${selectedReq.code} • ${selectedReq.projectName}` : ""}
      >
        <Text style={styles.modalInstruction}>
          El rechazo exige motivo obligatorio para informar al técnico en terreno:
        </Text>
        <TextInput
          value={rejectionReason}
          onChangeText={(text) => {
            setRejectionReason(text);
            if (rejectError) setRejectError("");
          }}
          placeholder="Ej: Insumos no contemplados en cubicación o proyecto sin disponibilidad..."
          placeholderTextColor={theme.colors.textLight}
          multiline
          numberOfLines={3}
          style={[styles.reasonInput, Boolean(rejectError) && styles.inputErrorBorder]}
        />
        {Boolean(rejectError) && <Text style={styles.errorText}>{rejectError}</Text>}

        <View style={styles.modalActions}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setRejectModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Confirmar Rechazo"
            variant="danger"
            icon="trash-outline"
            onPress={handleConfirmReject}
          />
        </View>
      </ModalView>

      {/* TOAST FLOTANTE */}
      <Toast
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
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
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginLeft: 6,
  },
  linkText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: theme.spacing.sm,
  },
  alertTextCol: {
    flex: 1,
  },
  alertTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  alertDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginLeft: theme.spacing.sm,
  },
  projectRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  projInfoCol: {
    marginBottom: theme.spacing.xs,
  },
  projHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  projName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 2,
  },
  projClient: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  projFinancialCol: {
    marginTop: theme.spacing.xs,
  },
  financialNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  costRealText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  budgetText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  semaphoreRow: {
    marginTop: 4,
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
  requestCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reqTop: {
    marginBottom: theme.spacing.sm,
  },
  reqCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  reqProject: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  reqTech: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  reqItemsBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  reqItemsLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  reqItemLine: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginVertical: 1,
  },
  reqCommentText: {
    fontSize: theme.fontSize.xs,
    fontStyle: "italic",
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  reqActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalInstruction: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    height: 80,
    textAlignVertical: "top",
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  inputErrorBorder: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fff5f5",
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.lg,
  },
  tableCodeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  tableProjectName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  tableTechText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  tableDateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  tableItemsText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  tableCommentText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  tableActionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
