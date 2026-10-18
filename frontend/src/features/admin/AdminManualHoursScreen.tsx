import React, { useState, useMemo } from "react";
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
import { formatCLP, formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { TechnicianWorkHour } from "@/core/types";

// Common components
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/common/Input";
import { ModalView } from "@/components/common/ModalView";
import { PageHeader } from "@/components/common/PageHeader";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";

export const AdminManualHoursScreen: React.FC = () => {
  const {
    technicians,
    projects,
    technicianHours,
    logAdminManualHours,
    updateTechnicianWorkHour,
  } = useApp();
  const { user } = useAuth();

  // Helper date presets
  const getPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const todayStr = getPresetDate(0);

  // Form state
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "cerrado"),
    [projects]
  );

  const [selectedTechRut, setSelectedTechRut] = useState<string>(
    technicians[0]?.rut || ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    activeProjects[0]?.id || ""
  );
  const [workDate, setWorkDate] = useState<string>(todayStr);
  const [hoursVal, setHoursVal] = useState<number>(8.0);
  const [selectedReason, setSelectedReason] = useState<string>(
    "Falla de Batería en Faena"
  );
  const [workDesc, setWorkDesc] = useState<string>(
    "Montaje de circuitos y conexionado de fuerza no cronometrado por falta de batería."
  );

  // Status feedback
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  // History filter
  const [filterTech, setFilterTech] = useState<string>("todos");
  const [filterProject, setFilterProject] = useState<string>("todos");

  // Edit Modal State
  const [editingHour, setEditingHour] = useState<TechnicianWorkHour | null>(null);
  const [editHoursVal, setEditHoursVal] = useState<number>(8.0);
  const [editDesc, setEditDesc] = useState<string>("");
  const [editError, setEditError] = useState<string>("");

  const selectedTechnician = technicians.find((t) => t.rut === selectedTechRut);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const hourlyRate = selectedProject?.hourlyRate || 18500;
  const costManoObra = hoursVal * hourlyRate;

  // Existing daily hours for selected technician on chosen date
  const techDailyHours = technicianHours
    .filter(
      (h) =>
        (h.technicianRut === selectedTechRut ||
          (!h.technicianRut && selectedTechRut === "14.234.567-8")) &&
        h.date === workDate
    )
    .reduce((sum, h) => sum + h.hours, 0);

  const REASON_PRESETS = [
    "Falla de Batería en Faena",
    "Sin Cobertura / Dispositivo Desconectado",
    "Olvido de Inicio de Cronómetro",
    "Horas Extraordinarias Autorizadas",
    "Reemplazo Operativo en Terreno",
  ];

  const handleStepHours = (delta: number) => {
    setHoursVal((prev) => {
      const next = Math.round((prev + delta) * 2) / 2;
      return Math.max(0.5, Math.min(24.0, next));
    });
  };

  const handleSubmitManualHours = () => {
    setFormError("");
    setFormSuccess("");

    if (!selectedTechnician) {
      setFormError("Debe seleccionar un técnico.");
      return;
    }
    if (!selectedProject) {
      setFormError("Debe seleccionar un proyecto.");
      return;
    }
    if (!workDate.trim()) {
      setFormError("Ingrese una fecha válida (YYYY-MM-DD).");
      return;
    }
    if (hoursVal <= 0 || hoursVal > 24) {
      setFormError("Las horas deben ser entre 0,5 y 24 horas por día.");
      return;
    }

    const res = logAdminManualHours({
      technicianRut: selectedTechnician.rut,
      technicianName: selectedTechnician.name,
      projectId: selectedProject.id,
      date: workDate,
      hours: hoursVal,
      description: workDesc.trim() || `Labor registrada manualmente por Administración (${selectedReason}).`,
      reason: selectedReason,
    });

    if (!res.success) {
      setFormError(res.error || "Error al registrar las horas del técnico.");
    } else {
      setFormSuccess(
        `✓ ${hoursVal} HH asignadas con éxito al técnico ${selectedTechnician.name} en el proyecto ${selectedProject.code} (${formatCLP(costManoObra)} imputados a H27/H28).`
      );
      setTimeout(() => setFormSuccess(""), 5000);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return technicianHours.filter((h) => {
      if (filterTech !== "todos") {
        const matchesTech =
          h.technicianRut === filterTech ||
          (!h.technicianRut && filterTech === "14.234.567-8");
        if (!matchesTech) return false;
      }
      if (filterProject !== "todos" && h.projectId !== filterProject) {
        return false;
      }
      return true;
    });
  }, [technicianHours, filterTech, filterProject]);

  const handleOpenEditHour = (h: TechnicianWorkHour) => {
    setEditingHour(h);
    setEditHoursVal(h.hours);
    setEditDesc(h.description);
    setEditError("");
  };

  const handleConfirmEditHour = () => {
    if (!editingHour) return;
    const res = updateTechnicianWorkHour(editingHour.id, editHoursVal, editDesc, "admin");
    if (!res.success) {
      setEditError(res.error || "Error al actualizar horas.");
    } else {
      setEditingHour(null);
    }
  };

  return (
    <ScreenStateWrapper>
      <View style={styles.container}>
        {/* Encabezado limpio y responsivo (ancho completo edge-to-edge) */}
        <PageHeader
          title="Carga Manual de Horas (Admin)"
          subtitle="Imputación extraordinaria de horas hombre para técnicos cuando no se haya registrado automáticamente en faena."
        />

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollBody}>

        {/* 1. SELECCIÓN DE TÉCNICO */}
        <Card variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>1. Seleccionar Técnico Operativo</Text>
          </View>
          <Text style={styles.sectionSub}>
            Selecciona el técnico en terreno al cual se le imputará la jornada laboral no cronometrada:
          </Text>

          <View style={styles.techListGrid}>
            {technicians.map((t) => {
              const isSel = t.rut === selectedTechRut;
              return (
                <TouchableOpacity
                  key={t.rut}
                  onPress={() => setSelectedTechRut(t.rut)}
                  style={[styles.techChip, isSel && styles.techChipActive]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.techAvatar, isSel && styles.techAvatarActive]}>
                    <Ionicons
                      name="construct"
                      size={16}
                      color={isSel ? "#ffffff" : theme.colors.primaryDark}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.techNameTxt, isSel && styles.techNameTxtActive]}>
                      {t.name}
                    </Text>
                    <Text style={[styles.techMetaTxt, isSel && styles.techMetaTxtActive]}>
                      {t.specialty} • RUT: {t.rut}
                    </Text>
                  </View>
                  {isSel && (
                    <Ionicons name="checkmark-circle" size={18} color="#f59e0b" style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* 2. SELECCIÓN DE PROYECTO / FAENA */}
        <Card variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="business-outline" size={20} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>2. Seleccionar Proyecto o Faena</Text>
          </View>
          <Text style={styles.sectionSub}>
            Obra activa donde el técnico ejecutó sus labores:
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {activeProjects.map((p) => {
              const isSel = p.id === selectedProjectId;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedProjectId(p.id)}
                  style={[styles.projectChip, isSel && styles.projectChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.projectChipCode, isSel && styles.projectChipCodeActive]}>
                    {p.code}
                  </Text>
                  <Text style={[styles.projectChipName, isSel && styles.projectChipNameActive]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.projectChipRate, isSel && styles.projectChipRateActive]}>
                    Tarifa: {formatCLP(p.hourlyRate || 18500)} / HH
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* 3. FECHA Y HORAS HOMBRE */}
        <Card variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>3. Fecha de Trabajo y Jornada (HH)</Text>
          </View>

          {/* Selector de Fecha */}
          <Text style={styles.subFieldLabel}>Fecha de ejecución en faena:</Text>
          <View style={styles.quickDateRow}>
            {[
              { label: "Hoy", val: getPresetDate(0), icon: "calendar" as const },
              { label: "Ayer", val: getPresetDate(1), icon: "time-outline" as const },
              { label: "Anteayer", val: getPresetDate(2), icon: "play-back-outline" as const },
            ].map((d) => {
              const isSel = workDate === d.val;
              return (
                <TouchableOpacity
                  key={d.val}
                  onPress={() => setWorkDate(d.val)}
                  style={[styles.quickDateChip, isSel && styles.quickDateChipActive]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={d.icon}
                    size={13}
                    color={isSel ? "#ffffff" : theme.colors.primaryDark}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.quickDateTxt, isSel && styles.quickDateTxtActive]}>
                    {d.label} ({d.val.slice(5)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Fecha (YYYY-MM-DD)"
            value={workDate}
            onChangeText={setWorkDate}
            placeholder="YYYY-MM-DD"
            icon="calendar-outline"
            containerStyle={{ marginBottom: 14 }}
          />

          {/* Stepper Táctil Bloques 0.5 h */}
          <View style={styles.hoursHeaderRow}>
            <Text style={styles.subFieldLabel}>Horas Hombre a Imputar (Bloques 0,5 h):</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Badge
                label={`Acumulado día: ${techDailyHours.toFixed(1)} / 24h`}
                tone={techDailyHours + hoursVal > 24 ? "danger" : "warn"}
                size="sm"
              />
            </View>
          </View>

          <View style={styles.hoursStepperRow}>
            <TouchableOpacity
              onPress={() => handleStepHours(-0.5)}
              style={styles.hourStepBtn}
              activeOpacity={0.7}
              accessibilityLabel="Restar media hora"
            >
              <Ionicons name="remove" size={18} color={theme.colors.primaryDark} />
              <Text style={styles.hourStepBtnTxt}>0.5 h</Text>
            </TouchableOpacity>

            <View style={styles.hoursDisplay}>
              <Text style={styles.hoursDisplayVal}>{hoursVal.toFixed(1)}</Text>
              <Text style={styles.hoursDisplayUnit}>HH</Text>
            </View>

            <TouchableOpacity
              onPress={() => handleStepHours(+0.5)}
              style={styles.hourStepBtn}
              activeOpacity={0.7}
              accessibilityLabel="Sumar media hora"
            >
              <Ionicons name="add" size={18} color={theme.colors.primaryDark} />
              <Text style={styles.hourStepBtnTxt}>0.5 h</Text>
            </TouchableOpacity>
          </View>

          {/* Chips Rápidos Horas */}
          <View style={styles.quickHoursRow}>
            {[4.0, 4.5, 8.0, 8.5, 9.0, 9.5].map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setHoursVal(val)}
                style={[styles.quickHourChip, hoursVal === val && styles.quickHourChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickHourTxt, hoursVal === val && styles.quickHourTxtActive]}>
                  {val} h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* 4. MOTIVO Y DESCRIPCIÓN */}
        <Card variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>4. Motivo y Justificación de Carga Extraordinaria</Text>
          </View>
          <Text style={styles.sectionSub}>
            Indica la razón por la cual no se registró automáticamente mediante cronómetro en faena:
          </Text>

          <View style={styles.reasonWrap}>
            {REASON_PRESETS.map((r) => {
              const isSel = selectedReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelectedReason(r)}
                  style={[styles.reasonChip, isSel && styles.reasonChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.reasonChipTxt, isSel && styles.reasonChipTxtActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Descripción detallada de las labores ejecutadas"
            value={workDesc}
            onChangeText={setWorkDesc}
            placeholder="Ej: Montaje de cuadros eléctricos, cableado y canalización en piso 3..."
            containerStyle={{ marginTop: 10 }}
          />
        </Card>

        {/* 5. PREVISUALIZACIÓN FINANCIERA H27 / H28 */}
        <Card variant="default" style={styles.financialPreviewCard}>
          <View style={styles.manualCostIconBox}>
            <Ionicons name="calculator-outline" size={22} color={theme.colors.primaryDark} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.financialFormula}>
              {hoursVal.toFixed(1)} HH × {formatCLP(hourlyRate)} / HH
            </Text>
            <Text style={styles.financialTotal}>
              Costo M.O. Real a Imputar: {formatCLP(costManoObra)} CLP
            </Text>
            <Text style={styles.financialFootnote}>
              Alimenta directamente el Costo Real H27 y la Liquidación Financiera H28 de {selectedProject?.code}.
            </Text>
          </View>
        </Card>

        {Boolean(formError) && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} style={{ marginRight: 6 }} />
            <Text style={styles.errorBannerTxt}>{formError}</Text>
          </View>
        )}

        {Boolean(formSuccess) && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.ok} style={{ marginRight: 6 }} />
            <Text style={styles.successBannerTxt}>{formSuccess}</Text>
          </View>
        )}

        <Button
          title={`Imputar ${hoursVal} HH a ${selectedTechnician?.name || "Técnico"}`}
          variant="primary"
          icon="checkmark-done"
          onPress={handleSubmitManualHours}
          style={{ height: 50, marginTop: 4, marginBottom: 24 }}
        />

        {/* ========================================================================= */}
        {/* HISTORIAL GLOBAL DE JORNADAS (CON FILTROS Y EDICIÓN ADMIN)               */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.historyCardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="receipt-outline" size={20} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Historial Global de Jornadas Registradas</Text>
          </View>
          <Text style={styles.sectionSub}>
            Auditoría de horas registradas por cronómetro automático o por carga manual administrativa:
          </Text>

          {/* Filtros */}
          <View style={styles.filterRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.filterLabel}>Filtrar por Técnico:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setFilterTech("todos")}
                  style={[styles.filterChip, filterTech === "todos" && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipTxt, filterTech === "todos" && styles.filterChipTxtActive]}>
                    Todos ({technicianHours.length})
                  </Text>
                </TouchableOpacity>
                {technicians.map((t) => {
                  const isSel = filterTech === t.rut;
                  return (
                    <TouchableOpacity
                      key={t.rut}
                      onPress={() => setFilterTech(t.rut)}
                      style={[styles.filterChip, isSel && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipTxt, isSel && styles.filterChipTxtActive]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {filteredHistory.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Sin registros de horas"
              description="No hay jornadas registradas para los filtros seleccionados."
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            filteredHistory.map((h) => {
              const proj = projects.find((p) => p.id === h.projectId);
              const rate = proj?.hourlyRate || 18500;
              const costReal = h.hours * rate;
              const techName = h.technicianName || "Alejandro Ramírez";

              return (
                <View key={h.id} style={styles.historyRowCard}>
                  <View style={styles.historyRowTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.historyRowTech}>{techName}</Text>
                      <Text style={styles.historyRowProj}>
                        {h.projectCode} • {h.projectName}
                      </Text>
                      <Text style={styles.historyRowDate}>
                        Fecha trabajada: {formatDate(h.date)} • Imputado: {formatCLP(costReal)}
                      </Text>
                      <Text style={styles.historyRowDesc}>{h.description}</Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Badge label={`${h.hours} HH`} tone="info" size="md" />
                      <View style={{ marginTop: 4 }}>
                        {h.registeredBy === "admin_manual" ? (
                          <Badge label="Carga Manual Admin" tone="warn" icon="shield-checkmark" size="sm" />
                        ) : (
                          <Badge label="Cronómetro Faena" tone="ok" icon="timer-outline" size="sm" />
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.historyRowActions}>
                    <Button
                      title="Editar (Permiso Admin)"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => handleOpenEditHour(h)}
                      style={{ height: 36 }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* MODAL PARA EDITAR HORAS (ADMINISTRADOR) */}
        <ModalView
          visible={Boolean(editingHour)}
          onClose={() => setEditingHour(null)}
          title="Ajuste Administrativo de Horas"
          subtitle={editingHour ? `${editingHour.projectCode} • ${formatDate(editingHour.date)}` : ""}
        >
          <View style={styles.adminModalNotice}>
            <Ionicons name="shield-checkmark" size={16} color={theme.colors.warnDark} style={{ marginRight: 6 }} />
            <Text style={styles.adminModalNoticeTxt}>
              Permiso de Administrador: Los cambios recalcularán automáticamente el Costo Real H27 y Rentabilidad H28 del proyecto.
            </Text>
          </View>

          <Text style={styles.subFieldLabel}>Horas (Bloques de 0,5 h, máx 24):</Text>
          <View style={styles.hoursStepperRow}>
            <TouchableOpacity
              onPress={() => setEditHoursVal((p) => Math.max(0.5, Math.round((p - 0.5) * 2) / 2))}
              style={styles.hourStepBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.hourStepBtnTxt}>0.5 h</Text>
            </TouchableOpacity>

            <View style={styles.hoursDisplay}>
              <Text style={styles.hoursDisplayVal}>{editHoursVal.toFixed(1)}</Text>
              <Text style={styles.hoursDisplayUnit}>HH</Text>
            </View>

            <TouchableOpacity
              onPress={() => setEditHoursVal((p) => Math.min(24.0, Math.round((p + 0.5) * 2) / 2))}
              style={styles.hourStepBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.hourStepBtnTxt}>0.5 h</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickHoursRow}>
            {[1.0, 2.0, 4.0, 8.0, 10.0].map((h) => {
              const isActive = editHoursVal === h;
              return (
                <TouchableOpacity
                  key={`modal-h-${h}`}
                  style={[styles.quickHourChip, isActive && styles.quickHourChipActive]}
                  onPress={() => setEditHoursVal(h)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickHourTxt, isActive && styles.quickHourTxtActive]}>
                    {h} h
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: 10 }}>
            <Input
              label="Motivo / Justificación del Ajuste"
              value={editDesc}
              onChangeText={setEditDesc}
            />
          </View>

          {Boolean(editError) && <Text style={styles.errorText}>{editError}</Text>}

          <View style={styles.modalButtonsRow}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setEditingHour(null)}
              style={{ marginRight: 8, flex: 1 }}
            />
            <Button
              title="Guardar Ajuste (H27/H28)"
              variant="primary"
              onPress={handleConfirmEditHour}
              style={{ flex: 2, height: 46 }}
            />
          </View>
        </ModalView>
        </ScrollView>
      </View>
    </ScreenStateWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollBody: {
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sectionSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  techListGrid: {
    gap: 8,
  },
  techChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    minHeight: 52,
  },
  techChipActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  techAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  techAvatarActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: "#f59e0b",
  },
  techNameTxt: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  techNameTxtActive: {
    color: "#f59e0b",
  },
  techMetaTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  techMetaTxtActive: {
    color: "#d6d3d1",
  },
  horizontalScroll: {
    flexDirection: "row",
  },
  projectChip: {
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    marginRight: 10,
    minWidth: 170,
  },
  projectChipActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  projectChipCode: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  projectChipCodeActive: {
    color: "#f59e0b",
  },
  projectChipName: {
    fontSize: 11,
    color: theme.colors.text,
    marginVertical: 2,
  },
  projectChipNameActive: {
    color: "#ffffff",
  },
  projectChipRate: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  projectChipRateActive: {
    color: "#fde68a",
  },
  subFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickDateRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  quickDateChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
    minHeight: 38,
  },
  quickDateChipActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  quickDateTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  quickDateTxtActive: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  hoursHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  hoursStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceAlt,
    padding: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    minHeight: 52,
  },
  hourStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    minHeight: 44,
    minWidth: 64,
    justifyContent: "center",
  },
  hourStepBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginLeft: 2,
  },
  hoursDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 70,
    justifyContent: "center",
  },
  hoursDisplayVal: {
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  hoursDisplayUnit: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginLeft: 3,
  },
  quickHoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  quickHourChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginHorizontal: 2,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    minHeight: 44,
  },
  quickHourChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  quickHourTxt: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: "600",
  },
  quickHourTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  reasonChipActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  reasonChipTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  reasonChipTxtActive: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  financialPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryBorder,
    padding: 12,
    borderRadius: theme.radius.md,
    marginBottom: 14,
  },
  manualCostIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  financialFormula: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  financialTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  financialFootnote: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#fca5a5",
    marginBottom: 10,
  },
  errorBannerTxt: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "600",
    flex: 1,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#86efac",
    marginBottom: 10,
  },
  successBannerTxt: {
    fontSize: 12,
    color: theme.colors.okDark,
    fontWeight: "600",
    flex: 1,
  },
  historyCardSection: {
    backgroundColor: theme.colors.card,
    marginTop: 10,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  filterChipTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  filterChipTxtActive: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  historyRowCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 10,
  },
  historyRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyRowTech: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  historyRowProj: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "600",
    marginTop: 1,
  },
  historyRowDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  historyRowDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  historyRowActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
  },
  adminModalNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 12,
  },
  adminModalNoticeTxt: {
    fontSize: 11,
    color: theme.colors.warnDark,
    fontWeight: "600",
    flex: 1,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: 6,
  },
});
