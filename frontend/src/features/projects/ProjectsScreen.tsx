import React, { useRef, useState } from "react";
import {
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
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ExportButton,
  Input,
  ModalView,
  PageHeader,
  ProgressBar,
  ScreenStateWrapper,
  Toast,
} from "@/components/common";
import { Project, ProjectKind, ProjectStatus } from "@/core/types";

export const ProjectsScreen: React.FC = () => {
  const {
    projects,
    technicians,
    clients,
    materialRequests,
    returnOrders,
    createProject,
    updateProject,
    assignTechniciansToProject,
    closeProject,
    logAdminManualHours,
  } = useApp();
  const { currentRole, user } = useAuth();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Selected project for detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<
    "resumen" | "tecnicos" | "insumos" | "horas" | "rentabilidad"
  >("resumen");

  // Filter list
  const [listStatusFilter, setListStatusFilter] = useState<string>("todos");
  const [listKindFilter, setListKindFilter] = useState<string>("todos");
  const [searchProject, setSearchProject] = useState("");

  // Project form modal state
  const projectNameInputRef = useRef<TextInput>(null);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formName, setFormName] = useState("");
  const [formNameError, setFormNameError] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formClientError, setFormClientError] = useState("");
  const [formKind, setFormKind] = useState<ProjectKind>("obra");
  const [formAddress, setFormAddress] = useState("");
  const [formStartDate, setFormStartDate] = useState("2026-10-01");
  const [formDeadline, setFormDeadline] = useState("2026-11-30");
  const [formBudgetMaterials, setFormBudgetMaterials] = useState("6000000");
  const [formBudgetHours, setFormBudgetHours] = useState("250");
  const [formSaleValue, setFormSaleValue] = useState("15000000");
  const [formStatus, setFormStatus] = useState<ProjectStatus>("activo");
  const [formError, setFormError] = useState("");

  // Close modal state (lists active blocking reasons)
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeProjectTarget, setCloseProjectTarget] = useState<Project | null>(null);
  const [closeBlocks, setCloseBlocks] = useState<string[]>([]);

  // Admin manual hours modal state
  const [adminManualModalOpen, setAdminManualModalOpen] = useState(false);
  const [adminManualTechRut, setAdminManualTechRut] = useState(technicians[0]?.rut || "");
  const [adminManualDate, setAdminManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [adminManualHours, setAdminManualHours] = useState(8.0);
  const [adminManualReason, setAdminManualReason] = useState("Falla de Batería en Faena");
  const [adminManualDesc, setAdminManualDesc] = useState("");
  const [adminManualError, setAdminManualError] = useState("");

  const handleConfirmAdminManualHours = () => {
    if (!selectedProject) return;
    const tech = technicians.find((t) => t.rut === adminManualTechRut) || technicians[0];
    if (!tech) {
      setAdminManualError("Seleccione un técnico.");
      return;
    }
    const res = logAdminManualHours({
      technicianRut: tech.rut,
      technicianName: tech.name,
      projectId: selectedProject.id,
      date: adminManualDate,
      hours: adminManualHours,
      description: adminManualDesc.trim() || `Carga manual extraordinaria por Administración (${adminManualReason}).`,
      reason: adminManualReason,
    });
    if (!res.success) {
      setAdminManualError(res.error || "Error al imputar horas.");
    } else {
      setAdminManualModalOpen(false);
      setAdminManualDesc("");
      showToast(`✓ ${adminManualHours} HH imputadas a ${tech.name} en ${selectedProject.code}.`);
      const updatedProj = projects.find((p) => p.id === selectedProject.id);
      if (updatedProj) {
        setSelectedProject({ ...updatedProj });
      }
    }
  };

  // Filtering projects list
  const filteredProjects = projects.filter((proj) => {
    if (listStatusFilter !== "todos" && proj.status !== listStatusFilter) return false;
    if (listKindFilter !== "todos" && proj.kind !== listKindFilter) return false;
    if (searchProject.trim()) {
      const q = searchProject.toLowerCase().trim();
      const matchName = proj.name.toLowerCase().includes(q);
      const matchCode = proj.code.toLowerCase().includes(q);
      const matchClient = proj.client.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchClient) return false;
    }
    return true;
  });

  const handleOpenNewProject = () => {
    setEditingProject(null);
    setFormName("");
    setFormNameError("");
    setFormClient(clients[0]?.businessName || "Inmobiliaria Central SpA");
    setFormClientError("");
    setFormKind("obra");
    setFormAddress("Av. Apoquindo 4500, Las Condes");
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormDeadline(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
    setFormBudgetMaterials("6000000");
    setFormBudgetHours("250");
    setFormSaleValue("15000000");
    setFormStatus("planificado");
    setFormError("");
    setFormModalVisible(true);
  };

  const handleOpenEditProject = (proj: Project) => {
    if (proj.status === "cerrado") {
      showToast("No es posible editar un proyecto en estado Cerrado.");
      return;
    }
    setEditingProject(proj);
    setFormName(proj.name);
    setFormNameError("");
    setFormClient(proj.client);
    setFormClientError("");
    setFormKind(proj.kind);
    setFormAddress(proj.address);
    setFormStartDate(proj.startDate);
    setFormDeadline(proj.deadline);
    setFormBudgetMaterials(String(proj.budgetMaterials));
    setFormBudgetHours(String(proj.budgetHours));
    setFormSaleValue(String(proj.saleValue));
    setFormStatus(proj.status);
    setFormError("");
    setFormModalVisible(true);
  };

  const handleSaveProject = () => {
    setFormNameError("");
    setFormClientError("");
    setFormError("");

    if (!formName.trim()) {
      setFormNameError("El nombre del proyecto es obligatorio.");
      setFormError("El nombre del proyecto es obligatorio.");
      projectNameInputRef.current?.focus();
      return;
    }

    if (!formClient.trim()) {
      setFormClientError("Debe seleccionar un cliente.");
      setFormError("Debe seleccionar un cliente.");
      return;
    }

    const bMat = Number(formBudgetMaterials) || 0;
    const bHrs = Number(formBudgetHours) || 0;
    const sVal = Number(formSaleValue) || 0;
    const totalBudget = bMat + bHrs * 18750;

    if (editingProject) {
      const res = updateProject(editingProject.id, {
        name: formName.trim(),
        client: formClient.trim(),
        kind: formKind,
        address: formAddress.trim(),
        startDate: formStartDate,
        deadline: formDeadline,
        budgetMaterials: bMat,
        budgetHours: bHrs,
        saleValue: sVal,
        budget: totalBudget,
        status: formStatus,
      });
      if (res.success) {
        showToast(`Proyecto ${editingProject.code} actualizado.`);
        setFormModalVisible(false);
        if (selectedProject?.id === editingProject.id) {
          setSelectedProject({
            ...selectedProject,
            name: formName.trim(),
            client: formClient.trim(),
            kind: formKind,
            address: formAddress.trim(),
            startDate: formStartDate,
            deadline: formDeadline,
            budgetMaterials: bMat,
            budgetHours: bHrs,
            saleValue: sVal,
            budget: totalBudget,
            status: formStatus,
          });
        }
      } else {
        setFormError(res.error || "Error al actualizar proyecto.");
      }
    } else {
      const code = `OB-2026-${String(projects.length + 15).padStart(3, "0")}`;
      const newProj: Project = {
        id: `p_${Date.now()}`,
        code,
        name: formName.trim(),
        client: formClient.trim(),
        kind: formKind,
        address: formAddress.trim(),
        progress: 0,
        technicianRuts: [],
        budgetMaterials: bMat,
        budgetHours: bHrs,
        hourlyRate: 18750,
        saleValue: sVal,
        budget: totalBudget,
        costReal: 0,
        startDate: formStartDate,
        deadline: formDeadline,
        status: formStatus,
        dispatches: [],
        laborEntries: [],
        wasteEntries: [],
      };
      const res = createProject(newProj);
      if (res.success) {
        showToast(`Proyecto ${code} creado exitosamente.`);
        setFormModalVisible(false);
      } else {
        setFormError(res.error || "Error al crear proyecto.");
      }
    }
  };

  // Cálculo de bloqueos activos para el cierre de proyecto
  const handleOpenCloseModal = (proj: Project) => {
    setCloseProjectTarget(proj);
    const blocks: string[] = [];

    // 1. Solicitudes de material pendientes o aprobadas sin despachar
    const pendingReqs = materialRequests.filter(
      (r) =>
        r.projectId === proj.id &&
        (r.status === "pendiente" ||
          (r.status === "aprobada" && r.items.some((it) => (it.deliveredQuantity || 0) < it.quantity)))
    );
    if (pendingReqs.length > 0) {
      blocks.push(
        `${pendingReqs.length} solicitud(es) de material pendientes o con despacho parcial sin liquidar (${pendingReqs.map((r) => r.code).join(", ")})`
      );
    }

    // 2. Devoluciones de sobrantes en tránsito de terreno a bodega
    const transitReturns = returnOrders.filter(
      (r) =>
        (r.projectId === proj.id || r.projectCode === proj.code) &&
        r.status === "en_transito"
    );
    if (transitReturns.length > 0) {
      blocks.push(
        `${transitReturns.length} devolución(es) de insumos en tránsito sin confirmar en bodega (${transitReturns.map((r) => r.code).join(", ")})`
      );
    }

    setCloseBlocks(blocks);
    setCloseModalVisible(true);
  };

  const handleConfirmClose = () => {
    if (!closeProjectTarget) return;
    const res = closeProject(closeProjectTarget.id, user.name);
    if (res.success) {
      showToast(`Proyecto ${closeProjectTarget.code} cerrado contablemente por ${user.name}.`);
      setCloseModalVisible(false);
      if (selectedProject?.id === closeProjectTarget.id) {
        setSelectedProject({
          ...closeProjectTarget,
          status: "cerrado",
          closedAt: new Date().toISOString(),
          closedBy: user.name,
        });
      }
    } else {
      setCloseBlocks(res.blocks || ["Error al cerrar el proyecto."]);
    }
  };

  return (
    <ScreenStateWrapper screenTitle="Proyectos y Obras" skeletonType="cards">
    <View style={styles.container}>
      {/* Toast Notification */}
      <Toast
        visible={Boolean(toastMessage)}
        message={toastMessage || ""}
        onDismiss={() => setToastMessage(null)}
      />

      {/* =====================================================================
          1. VISTA DE DETALLE CON PESTAÑAS (SI HAY PROYECTO SELECCIONADO)
          ===================================================================== */}
      {selectedProject ? (
        <View style={styles.viewWrapper}>
          {/* Encabezado con Migas de Pan y Botón Volver (Ancho completo edge-to-edge) */}
          <PageHeader
            title={`${selectedProject.code} - ${selectedProject.name}`}
            subtitle={`Cliente: ${selectedProject.client} • Dirección: ${selectedProject.address}`}
            breadcrumbs={[
              { label: "Inicio" },
              { label: "Proyectos", onPress: () => setSelectedProject(null) },
              { label: selectedProject.code },
            ]}
            onBack={() => setSelectedProject(null)}
          />

          <ScrollView style={styles.detailContainer} contentContainerStyle={styles.detailScroll}>
            {/* Encabezado del Proyecto */}
            <Card variant="elevated" style={styles.detailHeaderCard}>
            <View style={styles.detailTopRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.detailCode}>{selectedProject.code}</Text>
                  <Badge
                    label={selectedProject.kind === "obra" ? "OBRA" : "MANTENCIÓN"}
                    tone={selectedProject.kind === "obra" ? "info" : "warn"}
                    size="sm"
                    style={{ marginLeft: 6 }}
                  />
                </View>
                <Text style={styles.detailName}>{selectedProject.name}</Text>
                <Text style={styles.detailClient}>Cliente: {selectedProject.client}</Text>
              </View>

              <Badge
                label={selectedProject.status.toUpperCase()}
                tone={
                  selectedProject.status === "activo"
                    ? "ok"
                    : selectedProject.status === "cerrado"
                    ? "mute"
                    : "info"
                }
              />
            </View>

            <View style={styles.detailMetaRow}>
              <Text style={styles.metaItem}>Dirección: {selectedProject.address}</Text>
              <Text style={styles.metaItem}>Inicio: {formatDate(selectedProject.startDate)}</Text>
              <Text style={styles.metaItem}>Límite: {formatDate(selectedProject.deadline)}</Text>
              {selectedProject.closedBy && (
                <Text style={[styles.metaItem, { color: theme.colors.primaryDark, fontWeight: "bold" }]}>
                  Cerrado por: {selectedProject.closedBy} ({formatDate(selectedProject.closedAt || "")})
                </Text>
              )}
            </View>

            {/* Acciones de Cabecera: Editar (no editable si cerrado) y Cerrar Proyecto */}
            <View style={styles.detailActionsRow}>
              {currentRole === "admin" && (
                <>
                  {selectedProject.status !== "cerrado" ? (
                    <>
                      <Button
                        title="Editar Proyecto"
                        variant="outline"
                        size="sm"
                        icon="create-outline"
                        onPress={() => handleOpenEditProject(selectedProject)}
                        style={{ marginRight: 8 }}
                      />
                      <Button
                        title="Cerrar Proyecto"
                        variant="danger"
                        size="sm"
                        icon="lock-closed-outline"
                        onPress={() => handleOpenCloseModal(selectedProject)}
                      />
                    </>
                  ) : (
                    <Badge
                      label="🔒 Proyecto Cerrado (Solo Lectura - No Editable)"
                      tone="mute"
                      size="md"
                    />
                  )}
                </>
              )}
            </View>
          </Card>

          {/* PESTAÑAS DEL DETALLE */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailTabsScroll}>
            {[
              { id: "resumen", label: "Resumen y Margen" },
              { id: "tecnicos", label: `Técnicos (${selectedProject.technicianRuts.length})` },
              { id: "insumos", label: `Insumos y Egresos (${selectedProject.dispatches?.length || 0})` },
              { id: "horas", label: `Horas Hombre (${selectedProject.laborEntries?.length || 0})` },
              { id: "rentabilidad", label: "Rentabilidad (Cerrado)" },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setDetailTab(t.id as any)}
                style={[styles.detailTabChip, detailTab === t.id && styles.detailTabChipActive]}
              >
                <Text
                  style={[
                    styles.detailTabChipTxt,
                    detailTab === t.id && styles.detailTabChipTxtActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ---------------- 1. PESTAÑA RESUMEN (SEMÁFORO Y MARGEN) ---------------- */}
          {detailTab === "resumen" && (
            <Card variant="default">
              <Text style={styles.subTitle}>Semáforo de Costo y Margen Estimado</Text>

              {(() => {
                const ratio = selectedProject.budget > 0 ? selectedProject.costReal / selectedProject.budget : 0;
                const pct = Math.round(ratio * 100);
                const estimatedProfit = selectedProject.saleValue - selectedProject.costReal;
                const marginPct =
                  selectedProject.saleValue > 0
                    ? Math.round((estimatedProfit / selectedProject.saleValue) * 100)
                    : 0;

                // Regla del semáforo:
                // Verde: < 80 %
                // Amarillo: 80 - 100 %
                // Rojo: > 100 %
                let semTone: "ok" | "warn" | "danger" = "ok";
                let semText = "Verde: < 80% (Bajo control)";
                if (ratio > 1.0) {
                  semTone = "danger";
                  semText = "Rojo: > 100% (Sobregiro Presupuestario)";
                } else if (ratio >= 0.8) {
                  semTone = "warn";
                  semText = "Amarillo: 80–100% (Cerca del límite presupuestado)";
                }

                return (
                  <View style={styles.financialSummaryBlock}>
                    <View style={styles.detailSemaphoreRow}>
                      <Text style={styles.subTitle}>Ejecución y Margen Estimado</Text>
                      <View style={styles.semaphoreIndicatorPill}>
                        <View
                          style={[
                            styles.semaphoreDot,
                            {
                              backgroundColor:
                                semTone === "ok"
                                  ? theme.colors.ok
                                  : semTone === "warn"
                                  ? theme.colors.warn
                                  : theme.colors.danger,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.semaphorePctText,
                            {
                              color:
                                semTone === "ok"
                                  ? theme.colors.ok
                                  : semTone === "warn"
                                  ? theme.colors.warnDark
                                  : theme.colors.danger,
                            },
                          ]}
                        >
                          {pct}% ejecutado
                        </Text>
                      </View>
                    </View>

                    <ProgressBar
                      value={selectedProject.costReal}
                      max={selectedProject.budget}
                      height={4}
                      semaforo
                    />

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLbl}>Presupuesto Total</Text>
                        <Text style={styles.metricVal}>{formatCLP(selectedProject.budget)}</Text>
                      </View>
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLbl}>Costo Real Acumulado</Text>
                        <Text style={[styles.metricVal, semTone === "danger" && { color: theme.colors.danger }]}>
                          {formatCLP(selectedProject.costReal)}
                        </Text>
                      </View>
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLbl}>Valor de Venta</Text>
                        <Text style={styles.metricVal}>{formatCLP(selectedProject.saleValue)}</Text>
                      </View>
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLbl}>Margen Estimado de Obra</Text>
                        <Text
                          style={[
                            styles.metricVal,
                            { color: estimatedProfit >= 0 ? theme.colors.ok : theme.colors.danger },
                          ]}
                        >
                          {formatCLP(estimatedProfit)} ({marginPct}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </Card>
          )}

          {/* ---------------- 2. PESTAÑA TÉCNICOS (SIN DUPLICADOS) ---------------- */}
          {detailTab === "tecnicos" && (
            <Card variant="default">
              <Text style={styles.subTitle}>Equipo Técnico Asignado a la Faena</Text>
              <Text style={styles.subDesc}>
                Asignación de personal operativo en terreno (validación estricta sin duplicados):
              </Text>

              {technicians.map((t) => {
                const isAssigned = selectedProject.technicianRuts.includes(t.rut);
                return (
                  <View key={t.rut} style={styles.techRow}>
                    <View style={styles.techAvatar}>
                      <Ionicons name="person" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.techInfoCol}>
                      <Text style={styles.techName}>{t.name}</Text>
                      <Text style={styles.techSpecialty}>{t.specialty} • RUT: {t.rut}</Text>
                    </View>

                    {/* Botón Asignar / Desasignar (bloqueado si cerrado) */}
                    {selectedProject.status !== "cerrado" && currentRole === "admin" && (
                      <Button
                        title={isAssigned ? "Desasignar" : "Asignar"}
                        variant={isAssigned ? "danger" : "outline"}
                        size="sm"
                        onPress={() => {
                          const currentRuts = selectedProject.technicianRuts;
                          const nextRuts = isAssigned
                            ? currentRuts.filter((r) => r !== t.rut)
                            : Array.from(new Set([...currentRuts, t.rut])); // Garantiza sin duplicados
                          assignTechniciansToProject(selectedProject.id, nextRuts);
                          setSelectedProject({ ...selectedProject, technicianRuts: nextRuts });
                          showToast(
                            isAssigned
                              ? `Técnico ${t.name} desasignado.`
                              : `Técnico ${t.name} asignado al proyecto.`
                          );
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </Card>
          )}

          {/* ---------------- 3. PESTAÑA INSUMOS Y EGRESOS ---------------- */}
          {detailTab === "insumos" && (
            <Card variant="default">
              <Text style={styles.subTitle}>Egresos de Materiales a Obra</Text>
              <Text style={styles.subDesc}>
                Detalle de despachos físicos retirados en bodega e imputados al costo del proyecto:
              </Text>

              {selectedProject.dispatches && selectedProject.dispatches.length > 0 ? (
                <>
                  {selectedProject.dispatches.map((dsp) => (
                    <View key={dsp.id} style={styles.dispatchRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.dspProduct}>{dsp.productName}</Text>
                        <Text style={styles.dspMeta}>
                          {dsp.dispatchCode} • {dsp.date} • Retiró: {dsp.deliveredTo}
                        </Text>
                        <Text style={styles.dspMeta}>SKU: {dsp.sku} @ PMP: {formatCLP(dsp.unitCost)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.dspQty}>{dsp.quantity} {dsp.unit}</Text>
                        <Text style={styles.dspTotal}>{formatCLP(dsp.totalCost)}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.accumulatedBox}>
                    <Text style={styles.accumulatedLabel}>Total Materiales Consumidos:</Text>
                    <Text style={styles.accumulatedVal}>
                      {formatCLP(
                        selectedProject.dispatches.reduce((acc, d) => acc + d.totalCost, 0)
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <EmptyState
                  icon="cube-outline"
                  title="Sin egresos de material"
                  description="No hay egresos de material registrados para este proyecto."
                  containerStyle={{ marginVertical: 16 }}
                />
              )}
            </Card>
          )}

          {/* ---------------- 4. PESTAÑA HORAS HOMBRE ---------------- */}
          {detailTab === "horas" && (
            <Card variant="default">
              <View style={styles.hhTabHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.subTitle}>Horas Hombre (HH) Trabajadas en Terreno</Text>
                  <Text style={styles.subDesc}>
                    Jornadas laborales ejecutadas por el equipo técnico en faena:
                  </Text>
                </View>
                {selectedProject.status !== "cerrado" && (
                  <Button
                    title="+ Carga Manual (Admin)"
                    size="sm"
                    variant="primary"
                    icon="time-outline"
                    onPress={() => {
                      setAdminManualError("");
                      setAdminManualHours(8.0);
                      setAdminManualDate(new Date().toISOString().slice(0, 10));
                      setAdminManualModalOpen(true);
                    }}
                  />
                )}
              </View>

              {selectedProject.laborEntries && selectedProject.laborEntries.length > 0 ? (
                <>
                  {selectedProject.laborEntries.map((hh) => (
                    <View key={hh.id} style={styles.laborRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <Text style={styles.laborTech}>{hh.technicianName}</Text>
                          {hh.registeredBy === "admin_manual" && (
                            <Badge label="CARGA MANUAL ADMIN" tone="warn" size="sm" />
                          )}
                        </View>
                        <Text style={styles.laborDesc}>{hh.description}</Text>
                        <Text style={styles.laborDate}>Fecha: {hh.date} • Costo HH: {formatCLP(hh.hourlyCost)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.laborHours}>{hh.hours} HH</Text>
                        <Text style={styles.laborCost}>{formatCLP(hh.totalCost)}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.accumulatedBox}>
                    <Text style={styles.accumulatedLabel}>Total Mano de Obra Acumulada:</Text>
                    <Text style={styles.accumulatedVal}>
                      {formatCLP(
                        selectedProject.laborEntries.reduce((acc, h) => acc + h.totalCost, 0)
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <EmptyState
                  icon="time-outline"
                  title="Sin jornadas registradas"
                  description="No hay jornadas laborales registradas para este proyecto."
                  containerStyle={{ marginVertical: 16 }}
                />
              )}
            </Card>
          )}

          {/* ---------------- 5. PESTAÑA RENTABILIDAD (SOLO SI ESTÁ CERRADO) ---------------- */}
          {detailTab === "rentabilidad" && (
            <Card variant="default">
              <Text style={styles.subTitle}>Liquidación y Rentabilidad Final del Proyecto</Text>

              {selectedProject.status !== "cerrado" ? (
                <View style={styles.lockBox}>
                  <Ionicons name="lock-closed" size={36} color={theme.colors.textMuted} />
                  <Text style={styles.lockTitle}>Rentabilidad No Disponible</Text>
                  <Text style={styles.lockSub}>
                    El informe final de rentabilidad, balance y composición de costos se activa exclusivamente cuando el proyecto ha sido CERRADO contablemente.
                  </Text>
                </View>
              ) : (
                <View style={styles.rentabilityContent}>
                  <View style={styles.auditClosedNotice}>
                    <Ionicons name="checkmark-done-circle" size={20} color={theme.colors.ok} style={{ marginRight: 6 }} />
                    <Text style={styles.closedAtNote}>
                      Proyecto liquidado y cerrado por: <Text style={{ fontWeight: "bold" }}>{selectedProject.closedBy || "Administración"}</Text> el {formatDate(selectedProject.closedAt || "")}
                    </Text>
                  </View>

                  {/* Barras Comparativas Planificado vs Real por Materiales, Mermas y Horas */}
                  <Text style={styles.compSectionTitle}>Comparativo Planificado vs Real por Categoría:</Text>

                  {/* 1. Materiales */}
                  <View style={styles.comparisonCategoryBox}>
                    <View style={styles.catHeaderRow}>
                      <Text style={styles.catHeaderTitle}>1. Insumos y Materiales</Text>
                      <Text style={styles.catHeaderVal}>
                        Real: {formatCLP(selectedProject.costRealMaterials || 0)} / Plan: {formatCLP(selectedProject.budgetMaterials)}
                      </Text>
                    </View>
                    <ProgressBar
                      value={selectedProject.costRealMaterials || 0}
                      max={selectedProject.budgetMaterials}
                      height={6}
                      showPercentage
                      semaforo
                    />
                    <Text style={styles.catDesviationTxt}>
                      Desviación: {formatCLP((selectedProject.costRealMaterials || 0) - selectedProject.budgetMaterials)} (
                      {selectedProject.budgetMaterials > 0
                        ? ((((selectedProject.costRealMaterials || 0) - selectedProject.budgetMaterials) / selectedProject.budgetMaterials) * 100).toFixed(1)
                        : "0"}%)
                    </Text>
                  </View>

                  {/* 2. Horas Hombre */}
                  <View style={styles.comparisonCategoryBox}>
                    <View style={styles.catHeaderRow}>
                      <Text style={styles.catHeaderTitle}>2. Mano de Obra (Horas Hombre)</Text>
                      <Text style={styles.catHeaderVal}>
                        Real: {formatCLP(selectedProject.costRealHours || 0)} / Plan: {formatCLP(selectedProject.budgetHours * 18750)}
                      </Text>
                    </View>
                    <ProgressBar
                      value={selectedProject.costRealHours || 0}
                      max={selectedProject.budgetHours * 18750}
                      height={6}
                      showPercentage
                      semaforo
                    />
                    <Text style={styles.catDesviationTxt}>
                      Desviación: {formatCLP((selectedProject.costRealHours || 0) - selectedProject.budgetHours * 18750)} (
                      {selectedProject.budgetHours > 0
                        ? ((((selectedProject.costRealHours || 0) - selectedProject.budgetHours * 18750) / (selectedProject.budgetHours * 18750)) * 100).toFixed(1)
                        : "0"}%)
                    </Text>
                  </View>

                  {/* 3. Mermas y Daños */}
                  <View style={styles.comparisonCategoryBox}>
                    <View style={styles.catHeaderRow}>
                      <Text style={styles.catHeaderTitle}>3. Mermas y Daños Imputados a Obra</Text>
                      <Text style={[styles.catHeaderVal, { color: theme.colors.danger }]}>
                        {formatCLP(selectedProject.costRealWaste || 0)}
                      </Text>
                    </View>
                    <Text style={styles.catDesviationTxt}>
                      Pérdida neta de materiales en faena absorbida por el margen del proyecto.
                    </Text>
                  </View>

                  {/* Torta / Composición Gráfica de Costos */}
                  <Text style={[styles.compSectionTitle, { marginTop: 16 }]}>Composición del Costo Real Total:</Text>
                  {(() => {
                    const totalCost = selectedProject.costReal || 1;
                    const matCost = selectedProject.costRealMaterials || 0;
                    const hrsCost = selectedProject.costRealHours || 0;
                    const wstCost = selectedProject.costRealWaste || 0;

                    const matPct = Math.round((matCost / totalCost) * 100);
                    const hrsPct = Math.round((hrsCost / totalCost) * 100);
                    const wstPct = Math.round((wstCost / totalCost) * 100);

                    return (
                      <View style={styles.pieContainer}>
                        {/* Barra segmentada representativa */}
                        <View style={styles.pieSegmentedBar}>
                          <View style={[styles.pieSegment, { flex: matPct, backgroundColor: "#2563eb" }]} />
                          <View style={[styles.pieSegment, { flex: hrsPct, backgroundColor: "#7c3aed" }]} />
                          <View style={[styles.pieSegment, { flex: wstPct, backgroundColor: "#dc2626" }]} />
                        </View>

                        <View style={styles.pieLegendRow}>
                          <View style={styles.pieLegendItem}>
                            <View style={[styles.pieDot, { backgroundColor: "#2563eb" }]} />
                            <Text style={styles.pieLegendTxt}>Materiales: {matPct}% ({formatCLP(matCost)})</Text>
                          </View>
                          <View style={styles.pieLegendItem}>
                            <View style={[styles.pieDot, { backgroundColor: "#7c3aed" }]} />
                            <Text style={styles.pieLegendTxt}>Horas: {hrsPct}% ({formatCLP(hrsCost)})</Text>
                          </View>
                          <View style={styles.pieLegendItem}>
                            <View style={[styles.pieDot, { backgroundColor: "#dc2626" }]} />
                            <Text style={styles.pieLegendTxt}>Mermas: {wstPct}% ({formatCLP(wstCost)})</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Desviación Total en Monto y % */}
                  {(() => {
                    const totalDev = selectedProject.costReal - selectedProject.budget;
                    const totalDevPct =
                      selectedProject.budget > 0
                        ? ((totalDev / selectedProject.budget) * 100).toFixed(1)
                        : "0";
                    const netProfit = selectedProject.saleValue - selectedProject.costReal;
                    const profitMarginPct =
                      selectedProject.saleValue > 0
                        ? ((netProfit / selectedProject.saleValue) * 100).toFixed(1)
                        : "0";

                    return (
                      <View style={styles.finalAuditCard}>
                        <View style={styles.auditLine}>
                          <Text style={styles.auditLbl}>Presupuesto Total Contratado:</Text>
                          <Text style={styles.auditVal}>{formatCLP(selectedProject.budget)}</Text>
                        </View>
                        <View style={styles.auditLine}>
                          <Text style={styles.auditLbl}>Costo Real Final Auditado:</Text>
                          <Text style={styles.auditVal}>{formatCLP(selectedProject.costReal)}</Text>
                        </View>
                        <View style={styles.auditLine}>
                          <Text style={styles.auditLbl}>Desviación Presupuestaria Total:</Text>
                          <Text style={[styles.auditVal, totalDev > 0 ? { color: theme.colors.danger } : { color: theme.colors.ok }]}>
                            {totalDev > 0 ? `+${formatCLP(totalDev)}` : formatCLP(totalDev)} ({totalDevPct}%)
                          </Text>
                        </View>
                        <View style={[styles.auditLine, styles.auditFinalLine]}>
                          <Text style={styles.auditFinalLbl}>Utilidad Neta del Proyecto:</Text>
                          <Text
                            style={[
                              styles.auditFinalVal,
                              netProfit >= 0 ? { color: theme.colors.ok } : { color: theme.colors.danger },
                            ]}
                          >
                            {formatCLP(netProfit)} (Margen: {profitMarginPct}%)
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}
            </Card>
          )}
          </ScrollView>
        </View>
      ) : (
        /* =====================================================================
            2. VISTA DE LISTADO GENERAL DE PROYECTOS
            ===================================================================== */
        <View style={styles.viewWrapper}>
          {/* Encabezado Principal Limpio (Ancho completo edge-to-edge sin recuadro blanco) */}
          <PageHeader
            title="Control de Obras y Proyectos"
            subtitle="Monitoreo presupuestario en tiempo real con semáforo de costo y margen"
            breadcrumbs={["Inicio", "Proyectos", "Proyectos y Obras"]}
          />

          <ScrollView style={styles.listContainer} contentContainerStyle={styles.scrollBody}>
            {/* BANNER PROMINENTE PARA CREAR NUEVO PROYECTO */}
            {currentRole === "admin" && (
              <Card style={styles.createProjectHeroCard}>
                <View style={styles.createProjectHeroContent}>
                  <View style={styles.createProjectHeroLeft}>
                    <View style={styles.heroBadgeRow}>
                      <Badge label="Gestión de Obras" tone="primary" size="sm" />
                      <Text style={styles.heroBadgeHint}>Monitoreo H27 y H28</Text>
                    </View>
                    <Text style={styles.createProjectHeroTitle}>Registrar Nueva Obra o Proyecto</Text>
                    <Text style={styles.createProjectHeroDesc}>
                      Crea una obra o contrato de mantención para imputar HH, compras de insumos y controlar el margen en tiempo real.
                    </Text>
                  </View>
                  <Button
                    title="+ Crear Nuevo Proyecto"
                    variant="primary"
                    size="md"
                    icon="add-circle-outline"
                    onPress={handleOpenNewProject}
                    style={styles.btnCreateProjectLarge}
                  />
                </View>
              </Card>
            )}

            {/* Buscador de Proyecto */}
            <View style={styles.searchBoxWrapper}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              value={searchProject}
              onChangeText={setSearchProject}
              placeholder="Buscar por código, nombre u obra..."
              placeholderTextColor={theme.colors.textLight}
              style={styles.searchInputTxt}
            />
            {Boolean(searchProject) && (
              <Pressable onPress={() => setSearchProject("")}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filtros de Estado */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {[
              { id: "todos", label: "Todos los Estados" },
              { id: "activo", label: "Activos" },
              { id: "planificado", label: "Planificados" },
              { id: "cerrado", label: "Cerrados" },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setListStatusFilter(f.id)}
                style={[styles.filterChip, listStatusFilter === f.id && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipTxt, listStatusFilter === f.id && styles.filterChipTxtActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            {(listStatusFilter !== "todos" || Boolean(searchProject)) && (
              <TouchableOpacity
                onPress={() => {
                  setListStatusFilter("todos");
                  setSearchProject("");
                }}
                style={[styles.filterChip, { borderColor: theme.colors.borderDark }]}
              >
                <Ionicons name="close-circle-outline" size={14} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.filterChipTxt}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {filteredProjects.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="No se encontraron proyectos"
              description={
                searchProject
                  ? `No existen coincidencias para "${searchProject}".`
                  : "No hay proyectos ni faenas registradas con este filtro."
              }
              actionTitle={currentRole === "admin" ? "+ Crear Nuevo Proyecto" : undefined}
              onAction={currentRole === "admin" ? handleOpenNewProject : undefined}
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            filteredProjects.map((proj) => {
              const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
            const pct = Math.round(ratio * 100);

            // Semáforo de costo:
            // Verde: < 80%
            // Amarillo: 80-100%
            // Rojo: > 100%
            let semTone: "ok" | "warn" | "danger" = "ok";
            let semText = "Verde (< 80%)";
            if (ratio > 1.0) {
              semTone = "danger";
              semText = "Rojo (> 100%)";
            } else if (ratio >= 0.8) {
              semTone = "warn";
              semText = "Amarillo (80–100%)";
            }

            return (
              <TouchableOpacity
                key={proj.id}
                onPress={() => {
                  setSelectedProject(proj);
                  setDetailTab("resumen");
                }}
                activeOpacity={0.8}
              >
                <Card variant="elevated" style={styles.projectListCard}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.codeRow}>
                        <Text style={styles.codeTxt}>{proj.code}</Text>
                        <Badge
                          label={proj.kind === "obra" ? "OBRA" : "MANTENCIÓN"}
                          tone={proj.kind === "obra" ? "info" : "warn"}
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                      <Text style={styles.nameTxt}>{proj.name}</Text>
                      <Text style={styles.clientTxt}>Cliente: {proj.client}</Text>
                    </View>

                    <Badge
                      label={proj.status.toUpperCase()}
                      tone={
                        proj.status === "activo"
                          ? "ok"
                          : proj.status === "cerrado"
                          ? "mute"
                          : "info"
                      }
                    />
                  </View>

                  {/* Semáforo de Costo como indicador pequeño */}
                  <View style={styles.costSemaphoreRow}>
                    <View style={styles.costSemaphoreLeft}>
                      <Text style={styles.costLabel}>Costo:</Text>
                      <Text style={styles.costValuesTxt}>
                        {formatCLP(proj.costReal)}{" "}
                        <Text style={{ color: theme.colors.textMuted, fontWeight: "normal" }}>
                          / {formatCLP(proj.budget)}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.semaphoreIndicatorPill}>
                      <View
                        style={[
                          styles.semaphoreDot,
                          {
                            backgroundColor:
                              semTone === "ok"
                                ? theme.colors.ok
                                : semTone === "warn"
                                ? theme.colors.warn
                                : theme.colors.danger,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.semaphorePctText,
                          {
                            color:
                              semTone === "ok"
                                ? theme.colors.ok
                                : semTone === "warn"
                                ? theme.colors.warnDark
                                : theme.colors.danger,
                          },
                        ]}
                      >
                        {pct}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.datesTxt}>
                      Plazo: {formatDate(proj.deadline)} • Inicio: {formatDate(proj.startDate)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
          </ScrollView>
        </View>
      )}

      {/* =====================================================================
          3. FORMULARIO DE PROYECTO (NO EDITABLE SI ESTÁ CERRADO, NUNCA ELIMINAR)
          ===================================================================== */}
      <ModalView
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        title={editingProject ? `Editar Proyecto: ${editingProject.code}` : "Nuevo Proyecto / Obra"}
        subtitle="Nombre, cliente, fechas, presupuestos de materiales y HH, valor de venta"
      >
        {/* 1. INFORMACIÓN GENERAL */}
        <Text style={styles.formSectionHeading}>1. Información General del Proyecto</Text>
        <Input
          ref={projectNameInputRef}
          label="Nombre del Proyecto"
          value={formName}
          onChangeText={(text) => {
            setFormName(text);
            if (formNameError) setFormNameError("");
          }}
          error={formNameError}
          placeholder="Ej: Montaje Tableros Centro Logístico"
        />

        {/* Selector de Cliente */}
        <Text style={styles.fieldLabel}>Cliente:</Text>
        {Boolean(formClientError) && (
          <Text style={[styles.errorText, { marginBottom: 4 }]}>{formClientError}</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {clients.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => {
                setFormClient(c.businessName);
                if (formClientError) setFormClientError("");
              }}
              style={[styles.clientChip, formClient === c.businessName && styles.clientChipActive]}
            >
              <Text style={[styles.clientChipTxt, formClient === c.businessName && styles.clientChipTxtActive]}>
                {c.businessName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Input
          label="Dirección de la Obra / Faena"
          value={formAddress}
          onChangeText={setFormAddress}
          placeholder="Ej: Camino El Alba 1200, Quilicura"
        />

        <Text style={styles.fieldLabel}>Tipo de Proyecto:</Text>
        <View style={styles.btnGroupRow}>
          <TouchableOpacity
            onPress={() => setFormKind("obra")}
            style={[styles.groupBtn, formKind === "obra" && styles.groupBtnActive]}
          >
            <Text style={[styles.groupBtnTxt, formKind === "obra" && styles.groupBtnTxtActive]}>
              OBRA NUEVA
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFormKind("mantencion")}
            style={[styles.groupBtn, formKind === "mantencion" && styles.groupBtnActive]}
          >
            <Text style={[styles.groupBtnTxt, formKind === "mantencion" && styles.groupBtnTxtActive]}>
              MANTENCIÓN
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. PRESUPUESTOS Y PLAZOS */}
        <Text style={styles.formSectionHeading}>2. Presupuestos, Plazos y Estado</Text>
        <View style={styles.formRowTwo}>
          <Input
            label="Fecha Inicio"
            value={formStartDate}
            onChangeText={setFormStartDate}
            placeholder="YYYY-MM-DD"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Fecha Límite"
            value={formDeadline}
            onChangeText={setFormDeadline}
            placeholder="YYYY-MM-DD"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={styles.formRowTwo}>
          <Input
            label="Presupuesto Materiales ($ CLP)"
            value={formBudgetMaterials}
            onChangeText={setFormBudgetMaterials}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Presupuesto Horas (HH)"
            value={formBudgetHours}
            onChangeText={setFormBudgetHours}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Input
          label="Valor de Venta del Proyecto ($ CLP)"
          value={formSaleValue}
          onChangeText={setFormSaleValue}
          keyboardType="numeric"
          placeholder="Ej: 18000000"
        />

        <Text style={styles.fieldLabel}>Estado Inicial / Actual:</Text>
        <View style={styles.btnGroupRow}>
          {(["planificado", "activo"] as const).map((st) => (
            <TouchableOpacity
              key={st}
              onPress={() => setFormStatus(st)}
              style={[styles.groupBtn, formStatus === st && styles.groupBtnActive]}
            >
              <Text style={[styles.groupBtnTxt, formStatus === st && styles.groupBtnTxtActive]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {Boolean(formError) && <Text style={styles.errorText}>{formError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setFormModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title={editingProject ? "Guardar Cambios" : "Crear Proyecto"}
            variant="primary"
            onPress={handleSaveProject}
          />
        </View>
      </ModalView>

      {/* =====================================================================
          4. MODAL DE CIERRE QUE LISTA BLOQUEOS (SOLICITUDES Y MATERIAL EN TRÁNSITO)
          ===================================================================== */}
      <ModalView
        visible={closeModalVisible}
        onClose={() => setCloseModalVisible(false)}
        title="Cierre Contable de Proyecto"
        subtitle={closeProjectTarget ? `${closeProjectTarget.code} • ${closeProjectTarget.name}` : ""}
      >
        {closeBlocks.length > 0 ? (
          <View style={styles.blockNoticeBox}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={24} color={theme.colors.danger} />
              <Text style={styles.blockNoticeTitle}>
                Bloqueo Activo: No es posible cerrar el proyecto
              </Text>
            </View>

            <Text style={styles.blockNoticeSub}>
              Se detectaron solicitudes de insumos o materiales pendientes de liquidar:
            </Text>

            {closeBlocks.map((blk, idx) => (
              <View key={idx} style={styles.blockItemRow}>
                <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
                <Text style={styles.blockItemTxt}>{blk}</Text>
              </View>
            ))}

            <Text style={styles.blockAdvice}>
              Debe liquidar o despachar todas las solicitudes pendientes y recepcionar las devoluciones en tránsito en bodega antes de autorizar el cierre contable.
            </Text>

            <Button
              title="Entendido"
              variant="secondary"
              onPress={() => setCloseModalVisible(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={styles.confirmCloseBox}>
            <Ionicons name="checkmark-done-circle" size={40} color={theme.colors.ok} style={{ alignSelf: "center", marginBottom: 8 }} />
            <Text style={styles.confirmCloseTitle}>Sin Bloqueos Pendientes</Text>
            <Text style={styles.confirmCloseTxt}>
              Todas las solicitudes y devoluciones de este proyecto están liquidadas y recibidas en bodega.
            </Text>

            <View style={styles.closeAuditDataBox}>
              <Text style={styles.closeAuditLine}>
                Responsable de Cierre: <Text style={{ fontWeight: "bold" }}>{user.name}</Text>
              </Text>
              <Text style={styles.closeAuditLine}>
                Fecha de Cierre: <Text style={{ fontWeight: "bold" }}>{new Date().toISOString().slice(0, 10)}</Text>
              </Text>
            </View>

            <Text style={styles.closeWarningTxt}>
              Atención: Al cerrar el proyecto, este pasará a modo Solo Lectura (no editable) y se activará el informe final de rentabilidad.
            </Text>

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setCloseModalVisible(false)}
                style={{ marginRight: 8 }}
              />
              <Button
                title="Confirmar Cierre Definitivo"
                variant="danger"
                icon="lock-closed"
                onPress={handleConfirmClose}
              />
            </View>
          </View>
        )}
      </ModalView>

      {/* =====================================================================
          5. MODAL DE CARGA MANUAL DE HORAS POR ADMINISTRADOR (H27 / H28)
          ===================================================================== */}
      <ModalView
        visible={adminManualModalOpen}
        onClose={() => setAdminManualModalOpen(false)}
        title="Carga Manual de Horas (Admin)"
        subtitle={`Imputación contable directa para ${selectedProject?.code || "Proyecto"}`}
      >
        <Text style={styles.formSectionHeading}>1. Seleccionar Técnico</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {technicians.map((t) => {
            const isSelected = adminManualTechRut === t.rut;
            return (
              <TouchableOpacity
                key={t.rut}
                onPress={() => setAdminManualTechRut(t.rut)}
                style={[
                  styles.adminTechChip,
                  isSelected && styles.adminTechChipActive,
                ]}
                activeOpacity={0.8}
              >
                <View style={[styles.adminTechAvatar, isSelected && styles.adminTechAvatarActive]}>
                  <Ionicons
                    name="person"
                    size={16}
                    color={isSelected ? "#ffffff" : theme.colors.primary}
                  />
                </View>
                <View>
                  <Text style={[styles.adminTechName, isSelected && styles.adminTechNameActive]}>
                    {t.name}
                  </Text>
                  <Text style={styles.adminTechRut}>{t.rut} • {t.specialty || "Técnico"}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.formSectionHeading}>2. Fecha de la Jornada Laboral</Text>
        <View style={styles.quickDateRow}>
          {[
            { label: "Hoy", val: new Date().toISOString().slice(0, 10) },
            {
              label: "Ayer",
              val: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            },
            {
              label: "Anteayer",
              val: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
            },
          ].map((d) => (
            <TouchableOpacity
              key={d.label}
              onPress={() => setAdminManualDate(d.val)}
              style={[
                styles.quickDateBtn,
                adminManualDate === d.val && styles.quickDateBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.quickDateTxt,
                  adminManualDate === d.val && styles.quickDateTxtActive,
                ]}
              >
                {d.label} ({d.val.slice(5)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Fecha de Ejecución (YYYY-MM-DD)"
          value={adminManualDate}
          onChangeText={setAdminManualDate}
          placeholder="2026-10-16"
          containerStyle={{ marginBottom: 12 }}
        />

        <Text style={styles.formSectionHeading}>3. Cantidad de Horas (Bloques de 0,5 h - Máx 24h)</Text>
        <View style={styles.hoursStepperRow}>
          <TouchableOpacity
            onPress={() => setAdminManualHours((prev) => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
            style={styles.stepperBtn}
            accessibilityLabel="Restar 0.5 horas"
          >
            <Ionicons name="remove" size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.stepperValBox}>
            <Text style={styles.stepperValNum}>{adminManualHours.toFixed(1)}</Text>
            <Text style={styles.stepperValUnit}>HH</Text>
          </View>

          <TouchableOpacity
            onPress={() => setAdminManualHours((prev) => Math.min(24.0, Number((prev + 0.5).toFixed(1))))}
            style={styles.stepperBtn}
            accessibilityLabel="Sumar 0.5 horas"
          >
            <Ionicons name="add" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickHoursRow}>
          {[4.0, 8.0, 9.0, 10.0].map((h) => (
            <TouchableOpacity
              key={h}
              onPress={() => setAdminManualHours(h)}
              style={[
                styles.quickHourChip,
                adminManualHours === h && styles.quickHourChipActive,
              ]}
            >
              <Text
                style={[
                  styles.quickHourChipTxt,
                  adminManualHours === h && styles.quickHourChipTxtActive,
                ]}
              >
                {h.toFixed(1)} h
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formSectionHeading}>4. Causa del No Registro Automático</Text>
        <View style={styles.reasonWrap}>
          {[
            "Falla de Batería en Faena",
            "Zona Rural Sin Cobertura",
            "Olvido de Marcaje de Inicio",
            "Corte Eléctrico en Terreno",
            "Jornada Extraordinaria / Urgencia",
          ].map((r) => {
            const isSel = adminManualReason === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setAdminManualReason(r)}
                style={[styles.reasonChip, isSel && styles.reasonChipActive]}
              >
                <Text style={[styles.reasonChipTxt, isSel && styles.reasonChipTxtActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Detalles o Justificación Adicional"
          value={adminManualDesc}
          onChangeText={setAdminManualDesc}
          placeholder="Ej: Faena de empalme subterráneo sin acceso a red móvil durante toda la jornada."
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: 10, marginBottom: 14 }}
        />

        {/* Live Cost Impact Box */}
        {selectedProject && (
          <View style={styles.costPreviewBox}>
            <View style={styles.costPreviewRow}>
              <Text style={styles.costPreviewLabel}>Tasa Horaria Proyecto:</Text>
              <Text style={styles.costPreviewVal}>{formatCLP(selectedProject.hourlyRate || 18500)} / HH</Text>
            </View>
            <View style={styles.costPreviewRow}>
              <Text style={styles.costPreviewLabel}>Costo Total a Imputar (H27):</Text>
              <Text style={styles.costPreviewTotal}>
                {formatCLP(adminManualHours * (selectedProject.hourlyRate || 18500))}
              </Text>
            </View>
            <Text style={styles.costPreviewNote}>
              * Se recalcula inmediatamente el balance H28 y se genera registro de auditoría administrativa.
            </Text>
          </View>
        )}

        {Boolean(adminManualError) && (
          <View style={styles.errorBannerBox}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
            <Text style={styles.errorBannerTxt}>{adminManualError}</Text>
          </View>
        )}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setAdminManualModalOpen(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Confirmar e Imputar HH"
            variant="primary"
            icon="checkmark-circle"
            onPress={handleConfirmAdminManualHours}
          />
        </View>
      </ModalView>
    </View>
    </ScreenStateWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  viewWrapper: {
    flex: 1,
  },
  createProjectHeroCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  createProjectHeroContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  createProjectHeroLeft: {
    flex: 1,
    minWidth: 260,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  heroBadgeHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
    marginLeft: 8,
  },
  createProjectHeroTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 2,
  },
  createProjectHeroDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  btnCreateProjectLarge: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    alignSelf: "flex-start",
  },
  toastCard: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: "#065f46",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  toastText: {
    color: "#ffffff",
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  scrollBody: {
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  heading: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  searchBoxWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.md,
    height: 40,
    marginBottom: theme.spacing.sm,
  },
  searchInputTxt: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  filterScroll: {
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  filterChipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  projectListCard: {
    marginBottom: theme.spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  codeTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  nameTxt: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginVertical: 2,
  },
  clientTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  costSemaphoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  costSemaphoreLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  costLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  costValuesTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  semaphoreIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  semaphoreDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  semaphorePctText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
  },
  detailSemaphoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  datesTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  detailContainer: {
    flex: 1,
  },
  detailScroll: {
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  backTxt: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: "600",
    marginLeft: 6,
  },
  detailHeaderCard: {
    marginBottom: theme.spacing.md,
  },
  detailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  detailCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  detailName: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    marginVertical: 2,
  },
  detailClient: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  detailMetaRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  metaItem: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginVertical: 1,
  },
  detailActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.md,
  },
  detailTabsScroll: {
    marginBottom: theme.spacing.md,
  },
  detailTabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailTabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  detailTabChipTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  detailTabChipTxtActive: {
    color: "#ffffff",
  },
  subTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  subDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  financialSummaryBlock: {},
  semaphoreBanner: {
    marginBottom: theme.spacing.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  metricCell: {
    width: "50%",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  metricLbl: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  techAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  techInfoCol: {
    flex: 1,
  },
  techName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  techSpecialty: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  dispatchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  dspProduct: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  dspMeta: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  dspQty: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  dspTotal: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  accumulatedBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  accumulatedLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  accumulatedVal: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  laborRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  laborTech: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  laborDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  laborDate: {
    fontSize: 10,
    color: theme.colors.textLight,
  },
  laborHours: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  laborCost: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  emptyNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: theme.spacing.sm,
  },
  lockBox: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  lockTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 8,
  },
  lockSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 320,
  },
  rentabilityContent: {},
  auditClosedNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.okLight,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.okBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  closedAtNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.okDark,
    flex: 1,
  },
  compSectionTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  comparisonCategoryBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: 8,
  },
  catHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  catHeaderTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  catHeaderVal: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  catDesviationTxt: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  pieContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  pieSegmentedBar: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    marginBottom: 10,
  },
  pieSegment: {
    height: "100%",
  },
  pieLegendRow: {
    marginTop: 4,
  },
  pieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  pieDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pieLegendTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  finalAuditCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  auditLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  auditLbl: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  auditVal: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  auditFinalLine: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 6,
    marginTop: 4,
  },
  auditFinalLbl: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  auditFinalVal: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  clientChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clientChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  clientChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  clientChipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  btnGroupRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  groupBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  groupBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  groupBtnTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
  },
  groupBtnTxtActive: {
    color: "#ffffff",
  },
  formRowTwo: {
    flexDirection: "row",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginVertical: 4,
  },
  blockNoticeBox: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
  },
  blockNoticeTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.dangerDark,
    marginLeft: 8,
    flex: 1,
  },
  blockNoticeSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginBottom: 8,
  },
  blockItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: 6,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
  },
  blockItemTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginLeft: 6,
    flex: 1,
    fontWeight: theme.fontWeight.semibold,
  },
  blockAdvice: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.dangerDark,
    marginTop: 6,
    lineHeight: 16,
  },
  confirmCloseBox: {
    padding: theme.spacing.sm,
  },
  confirmCloseTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  confirmCloseTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  closeAuditDataBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  closeAuditLine: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginVertical: 2,
  },
  closeWarningTxt: {
    fontSize: 11,
    color: theme.colors.warnDark,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  formSectionHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hhTabHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  adminTechChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  adminTechChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: theme.colors.primary,
  },
  adminTechAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  adminTechAvatarActive: {
    backgroundColor: theme.colors.primary,
  },
  adminTechName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  adminTechNameActive: {
    color: theme.colors.primaryDark,
  },
  adminTechRut: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  quickDateBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  quickDateTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  quickDateTxtActive: {
    color: "#ffffff",
  },
  hoursStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginVertical: 10,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValBox: {
    minWidth: 110,
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  stepperValNum: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  stepperValUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  quickHoursRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  quickHourChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickHourChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  quickHourChipTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  quickHourChipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reasonChipActive: {
    backgroundColor: "#fef3c7",
    borderColor: theme.colors.warn,
  },
  reasonChipTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  reasonChipTxtActive: {
    color: theme.colors.warnDark,
    fontWeight: "bold",
  },
  costPreviewBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  costPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  costPreviewLabel: {
    fontSize: 12,
    color: "#166534",
  },
  costPreviewVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#166534",
  },
  costPreviewTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#15803d",
  },
  costPreviewNote: {
    fontSize: 10,
    color: "#166534",
    fontStyle: "italic",
    marginTop: 4,
  },
  errorBannerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerTxt: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "600",
  },
});
