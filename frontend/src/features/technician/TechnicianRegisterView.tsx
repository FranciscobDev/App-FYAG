import React, { useState } from "react";
import {
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
import { formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { ModalView } from "@/components/common/ModalView";
import { ProgressBar } from "@/components/common/ProgressBar";
import { ReturnsScreen } from "@/features/returns/ReturnsScreen";
import { TechnicianWorkHour } from "@/core/types";

interface TechnicianRegisterViewProps {
  initialSubTab?: "avance" | "horas" | "sobrante";
  initialProjectId?: string;
}

export const TechnicianRegisterView: React.FC<TechnicianRegisterViewProps> = ({
  initialSubTab = "avance",
  initialProjectId,
}) => {
  const {
    projects,
    products,
    technicianHours,
    technicianProgressReports,
    createTechnicianWorkHour,
    updateTechnicianWorkHour,
    createTechnicianProgressReport,
  } = useApp();
  const { user } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<"avance" | "horas" | "sobrante">(initialSubTab);

  const activeProjects = projects.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(user.rut) || p.technicianRuts.length === 0)
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || activeProjects[0]?.id || ""
  );

  const currentProject = activeProjects.find((p) => p.id === selectedProjectId) || activeProjects[0];

  // =========================================================================
  // 1. REGISTRAR AVANCE (0-100%, SLIDER + NÚMERO, COMENTARIOS, MATERIALES SIN EGRESO)
  // =========================================================================
  const [advancePct, setAdvancePct] = useState<number>(currentProject?.progress || 50);
  const [advanceComments, setAdvanceComments] = useState<string>(
    "Avance en montaje de tuberías y sellado de pasadas en muros cortafuego."
  );
  const [usedMaterials, setUsedMaterials] = useState<
    { sku: string; name: string; quantity: number; unit: string }[]
  >([
    { sku: "GAS-TUB-0020", name: "Tubo cobre tipo L 3/4\" 6 m", quantity: 6, unit: "un" },
    { sku: "ELE-CBL-0012", name: "Cable THHN 12 AWG", quantity: 1, unit: "rollo" },
  ]);
  const [advanceSuccess, setAdvanceSuccess] = useState<string>("");

  const handleAdjustPct = (delta: number) => {
    setAdvancePct((prev) => Math.max(0, Math.min(100, prev + delta)));
  };

  const handleSaveAdvance = () => {
    if (!currentProject) return;
    createTechnicianProgressReport({
      projectId: currentProject.id,
      projectCode: currentProject.code,
      projectName: currentProject.name,
      date: new Date().toISOString().slice(0, 10),
      progressPct: advancePct,
      comments: advanceComments.trim() || "Reporte de avance en terreno.",
      materialsUsed: usedMaterials,
    });
    setAdvanceSuccess(`✓ Avance del ${advancePct}% guardado correctamente para ${currentProject.code}.`);
    setTimeout(() => setAdvanceSuccess(""), 4000);
  };

  // =========================================================================
  // 2. REGISTRAR HORAS (BLOQUES 0.5, MÁX 24 POR DÍA, EDITABLE < 48H)
  // =========================================================================
  const todayStr = new Date().toISOString().slice(0, 10);
  const [workDate, setWorkDate] = useState<string>(todayStr);
  const [hoursVal, setHoursVal] = useState<number>(8.0);
  const [workDesc, setWorkDesc] = useState<string>("Montaje de circuitos y conexionado de fuerza");
  const [hoursError, setHoursError] = useState<string>("");
  const [hoursSuccess, setHoursSuccess] = useState<string>("");

  // Modal para editar horas existentes dentro de 48h
  const [editingHour, setEditingHour] = useState<TechnicianWorkHour | null>(null);
  const [editHoursVal, setEditHoursVal] = useState<number>(8.0);
  const [editDesc, setEditDesc] = useState<string>("");
  const [editError, setEditError] = useState<string>("");

  const handleStepHours = (delta: number) => {
    setHoursVal((prev) => {
      const next = Math.round((prev + delta) * 2) / 2;
      return Math.max(0.5, Math.min(24.0, next));
    });
  };

  const handleSaveHours = () => {
    setHoursError("");
    setHoursSuccess("");

    if (!currentProject) {
      setHoursError("Seleccione un proyecto.");
      return;
    }

    if (hoursVal <= 0 || hoursVal > 24) {
      setHoursError("Las horas deben ser entre 0,5 y 24 horas por día.");
      return;
    }

    const res = createTechnicianWorkHour({
      projectId: currentProject.id,
      projectCode: currentProject.code,
      projectName: currentProject.name,
      date: workDate,
      hours: hoursVal,
      description: workDesc.trim() || "Jornada laboral en terreno.",
    });

    if (!res.success) {
      setHoursError(res.error || "Error al registrar horas.");
    } else {
      setHoursSuccess(`✓ ${hoursVal} HH registradas con éxito para ${currentProject.code}.`);
      setWorkDesc("");
      setTimeout(() => setHoursSuccess(""), 4000);
    }
  };

  const handleOpenEditHour = (h: TechnicianWorkHour) => {
    // Validar si tiene más de 48 horas de antigüedad
    const createdTime = new Date(h.createdAt).getTime();
    const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60);

    if (diffHours > 48) {
      alert("Este registro tiene más de 48 horas de antigüedad y está cerrado para edición según normativa contable.");
      return;
    }

    setEditingHour(h);
    setEditHoursVal(h.hours);
    setEditDesc(h.description);
    setEditError("");
  };

  const handleConfirmEditHour = () => {
    if (!editingHour) return;
    const res = updateTechnicianWorkHour(editingHour.id, editHoursVal, editDesc);
    if (!res.success) {
      setEditError(res.error || "Error al editar.");
    } else {
      setEditingHour(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* SELECTOR DE PESTAÑAS SUPERIOR (MOBILE)                                    */}
      {/* ========================================================================= */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          onPress={() => setActiveSubTab("avance")}
          style={[styles.subTabItem, activeSubTab === "avance" && styles.subTabItemActive]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trending-up-outline"
            size={16}
            color={activeSubTab === "avance" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.subTabLabel, activeSubTab === "avance" && styles.subTabLabelActive]}>
            Avance (0-100%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveSubTab("horas")}
          style={[styles.subTabItem, activeSubTab === "horas" && styles.subTabItemActive]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeSubTab === "horas" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.subTabLabel, activeSubTab === "horas" && styles.subTabLabelActive]}>
            Horas (HH)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveSubTab("sobrante")}
          style={[styles.subTabItem, activeSubTab === "sobrante" && styles.subTabItemActive]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="return-down-back-outline"
            size={16}
            color={activeSubTab === "sobrante" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.subTabLabel, activeSubTab === "sobrante" && styles.subTabLabelActive]}>
            Devolver Sobrante
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. REGISTRAR AVANCE                                                       */}
      {/* ========================================================================= */}
      {activeSubTab === "avance" && (
        <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
          {/* Selector de Proyecto */}
          <Text style={styles.fieldLabel}>Proyecto / Faena a reportar:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {activeProjects.map((p) => {
              const isSelected = p.id === currentProject?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setSelectedProjectId(p.id);
                    setAdvancePct(p.progress);
                  }}
                  style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
                >
                  <Text style={[styles.chipTxt, isSelected && styles.chipTxtActive]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {currentProject && (
            <Card variant="elevated">
              <View style={styles.advanceHeaderRow}>
                <View>
                  <Text style={styles.cardHeading}>Reporte de Avance Físico</Text>
                  <Text style={styles.cardSub}>
                    Porcentaje de avance en obra (Avance previo: {currentProject.progress}%)
                  </Text>
                </View>
                <Badge
                  label={`${advancePct}%`}
                  tone={advancePct >= 80 ? "ok" : advancePct >= 50 ? "info" : "warn"}
                  size="lg"
                />
              </View>

              {/* Slider / Stepper Táctil 0-100% */}
              <View style={styles.sliderBox}>
                <View style={styles.stepperRow}>
                  <TouchableOpacity onPress={() => handleAdjustPct(-10)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnTxt}>−10%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdjustPct(-5)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnTxt}>−5%</Text>
                  </TouchableOpacity>

                  <View style={styles.pctDisplay}>
                    <TextInput
                      value={String(advancePct)}
                      onChangeText={(v) => {
                        const num = Number(v);
                        if (!isNaN(num)) setAdvancePct(Math.max(0, Math.min(100, num)));
                      }}
                      keyboardType="numeric"
                      style={styles.pctInput}
                    />
                    <Text style={styles.pctUnit}>%</Text>
                  </View>

                  <TouchableOpacity onPress={() => handleAdjustPct(+5)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnTxt}>+5%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdjustPct(+10)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnTxt}>+10%</Text>
                  </TouchableOpacity>
                </View>

                {/* Barra visual de progreso */}
                <View style={{ marginTop: 12 }}>
                  <ProgressBar
                    value={advancePct}
                    max={100}
                    height={10}
                    color={theme.colors.primary}
                  />
                </View>
              </View>

              {/* Comentarios de Avance */}
              <Input
                label="Comentarios y descripción del avance"
                value={advanceComments}
                onChangeText={setAdvanceComments}
                placeholder="Describa el trabajo realizado, cuadrillas involucradas..."
              />

              {/* MATERIALES USADOS (NO GENERA EGRESO) */}
              <View style={styles.materialsUsedSection}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.materialsUsedTitle}>Materiales Consumidos en la Jornada:</Text>
                  <Badge label="Informativo" tone="mute" size="sm" />
                </View>

                {/* BANNER REQUISITO PASO 10: NO GENERA EGRESO */}
                <View style={styles.noStockDispatchBanner}>
                  <Ionicons name="information-circle" size={18} color={theme.colors.infoDark} style={{ marginRight: 6 }} />
                  <Text style={styles.noStockDispatchTxt}>
                    Nota: El registro de materiales usados es un reporte técnico de faena y <Text style={{ fontWeight: "bold" }}>NO genera egreso en inventario</Text> ni rebaja stock en bodega.
                  </Text>
                </View>

                {usedMaterials.map((m, idx) => (
                  <View key={idx} style={styles.usedMaterialRow}>
                    <Text style={styles.usedMaterialName}>• {m.name}</Text>
                    <View style={styles.usedQtyBox}>
                      <TextInput
                        value={String(m.quantity)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setUsedMaterials((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.usedQtyInput}
                      />
                      <Text style={styles.usedUnitTxt}>{m.unit}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {Boolean(advanceSuccess) && (
                <Text style={styles.successText}>{advanceSuccess}</Text>
              )}

              <Button
                title="Guardar Avance de Obra"
                variant="primary"
                icon="save-outline"
                onPress={handleSaveAdvance}
                style={{ marginTop: 16, height: 48 }}
              />
            </Card>
          )}

          {/* Historial de Avances Anteriores */}
          <Text style={styles.historyHeading}>Reportes de Avance Anteriores:</Text>
          {technicianProgressReports.map((rep) => (
            <Card key={rep.id} variant="default" style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyProj}>{rep.projectName} ({rep.projectCode})</Text>
                  <Text style={styles.historyDate}>Fecha: {formatDate(rep.date)}</Text>
                </View>
                <Badge label={`${rep.progressPct}%`} tone="ok" size="sm" />
              </View>
              <Text style={styles.historyComments}>"{rep.comments}"</Text>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 2. REGISTRAR HORAS (HH)                                                   */}
      {/* ========================================================================= */}
      {activeSubTab === "horas" && (
        <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
          {/* Selector de Proyecto */}
          <Text style={styles.fieldLabel}>Proyecto / Faena a imputar HH:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {activeProjects.map((p) => {
              const isSelected = p.id === currentProject?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedProjectId(p.id)}
                  style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
                >
                  <Text style={[styles.chipTxt, isSelected && styles.chipTxtActive]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Card variant="elevated">
            <Text style={styles.cardHeading}>Ingreso de Horas Hombre (HH)</Text>
            <Text style={styles.cardSub}>
              Bloques de 0,5 horas (máximo 24 h por día). Editable dentro de 48 horas.
            </Text>

            {/* Fecha y Bloques de Horas */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="Fecha (YYYY-MM-DD)"
                  value={workDate}
                  onChangeText={setWorkDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ flex: 1.2 }}>
                <Text style={styles.hoursFieldLabel}>Horas (Bloques de 0,5 h):</Text>
                <View style={styles.hoursStepperRow}>
                  <TouchableOpacity onPress={() => handleStepHours(-0.5)} style={styles.hourStepBtn}>
                    <Text style={styles.hourStepBtnTxt}>−0.5</Text>
                  </TouchableOpacity>

                  <View style={styles.hoursDisplay}>
                    <Text style={styles.hoursDisplayVal}>{hoursVal.toFixed(1)}</Text>
                    <Text style={styles.hoursDisplayUnit}>HH</Text>
                  </View>

                  <TouchableOpacity onPress={() => handleStepHours(+0.5)} style={styles.hourStepBtn}>
                    <Text style={styles.hourStepBtnTxt}>+0.5</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Chips rápidos de horas estándar */}
            <View style={styles.quickHoursRow}>
              {[4.0, 4.5, 8.0, 8.5, 9.0, 9.5].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setHoursVal(val)}
                  style={[styles.quickHourChip, hoursVal === val && styles.quickHourChipActive]}
                >
                  <Text style={[styles.quickHourTxt, hoursVal === val && styles.quickHourTxtActive]}>
                    {val} h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Descripción de la Labor Ejecutada"
              value={workDesc}
              onChangeText={setWorkDesc}
              placeholder="Ej: Montaje y canalización de shaft eléctrico..."
            />

            {Boolean(hoursError) && <Text style={styles.errorText}>{hoursError}</Text>}
            {Boolean(hoursSuccess) && <Text style={styles.successText}>{hoursSuccess}</Text>}

            <Button
              title="Registrar Jornada de Horas"
              variant="primary"
              icon="time-outline"
              onPress={handleSaveHours}
              style={{ marginTop: 12, height: 48 }}
            />
          </Card>

          {/* LISTADO DE HORAS REGISTRADAS (REGLA 48 HORAS EDITABLE) */}
          <Text style={styles.historyHeading}>Mis Jornadas Registradas:</Text>
          <Text style={styles.historyRuleNotice}>
            Normativa contable: Los registros solo son editables dentro de 48 horas tras su emisión.
          </Text>

          {technicianHours.map((h) => {
            const createdTime = new Date(h.createdAt).getTime();
            const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60);
            const isEditable = diffHours <= 48;

            return (
              <Card key={h.id} variant="default" style={styles.hourCard}>
                <View style={styles.hourCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hourProj}>{h.projectName} ({h.projectCode})</Text>
                    <Text style={styles.hourDate}>Fecha trabajada: {formatDate(h.date)}</Text>
                    <Text style={styles.hourDesc}>{h.description}</Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Badge label={`${h.hours} HH`} tone="info" size="md" />
                    <View style={{ marginTop: 4 }}>
                      {isEditable ? (
                        <Badge label="Editable (< 48h)" tone="ok" size="sm" />
                      ) : (
                        <Badge label="Bloqueado (> 48h)" tone="mute" icon="lock-closed" size="sm" />
                      )}
                    </View>
                  </View>
                </View>

                {isEditable && (
                  <View style={styles.hourCardActions}>
                    <Button
                      title="Editar Registro"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => handleOpenEditHour(h)}
                      style={{ height: 38 }}
                    />
                  </View>
                )}
              </Card>
            );
          })}

          {/* MODAL PARA EDITAR HORAS DENTRO DE 48H */}
          <ModalView
            visible={Boolean(editingHour)}
            onClose={() => setEditingHour(null)}
            title="Editar Jornada de Horas"
            subtitle={editingHour ? `${editingHour.projectCode} • Registrado el ${formatDate(editingHour.date)}` : ""}
          >
            <Text style={styles.modalSub}>
              Registro dentro de la ventana de 48 horas de gracia:
            </Text>

            <View style={styles.hoursStepperRow}>
              <TouchableOpacity
                onPress={() => setEditHoursVal((p) => Math.max(0.5, Math.round((p - 0.5) * 2) / 2))}
                style={styles.hourStepBtn}
              >
                <Text style={styles.hourStepBtnTxt}>−0.5</Text>
              </TouchableOpacity>

              <View style={styles.hoursDisplay}>
                <Text style={styles.hoursDisplayVal}>{editHoursVal.toFixed(1)}</Text>
                <Text style={styles.hoursDisplayUnit}>HH</Text>
              </View>

              <TouchableOpacity
                onPress={() => setEditHoursVal((p) => Math.min(24.0, Math.round((p + 0.5) * 2) / 2))}
                style={styles.hourStepBtn}
              >
                <Text style={styles.hourStepBtnTxt}>+0.5</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Descripción de las labores"
              value={editDesc}
              onChangeText={setEditDesc}
            />

            {Boolean(editError) && <Text style={styles.errorText}>{editError}</Text>}

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setEditingHour(null)}
                style={{ marginRight: 8, flex: 1 }}
              />
              <Button
                title="Guardar Cambios"
                variant="primary"
                onPress={handleConfirmEditHour}
                style={{ flex: 2, height: 46 }}
              />
            </View>
          </ModalView>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 3. DEVOLVER SOBRANTE (INTEGRA RETURNSSCREEN DEL PASO 9)                    */}
      {/* ========================================================================= */}
      {activeSubTab === "sobrante" && (
        <View style={{ flex: 1 }}>
          <ReturnsScreen />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  subTabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  subTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabItemActive: {
    borderBottomColor: theme.colors.primary,
  },
  subTabLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: "600",
    marginLeft: 4,
  },
  subTabLabelActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipsScroll: {
    marginBottom: theme.spacing.md,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
  },
  chipBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  chipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    fontWeight: "500",
  },
  chipTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  advanceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  cardSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sliderBox: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  stepBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  pctDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  pctInput: {
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    textAlign: "center",
    minWidth: 44,
  },
  pctUnit: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginLeft: 2,
  },
  materialsUsedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  materialsUsedTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  noStockDispatchBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.infoLight,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.infoBorder,
  },
  noStockDispatchTxt: {
    fontSize: 11,
    color: theme.colors.infoDark,
    flex: 1,
  },
  usedMaterialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
  },
  usedMaterialName: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  usedQtyBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  usedQtyInput: {
    width: 50,
    height: 32,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  usedUnitTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 4,
  },
  successText: {
    fontSize: 12,
    color: theme.colors.ok,
    fontWeight: "bold",
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "bold",
    marginTop: 8,
  },
  historyHeading: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: theme.spacing.lg,
    marginBottom: 6,
  },
  historyRuleNotice: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  historyCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  historyProj: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  historyDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  historyComments: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  formRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hoursFieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  hoursStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    height: 44,
  },
  hourStepBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  hourStepBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  hoursDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  hoursDisplayVal: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  hoursDisplayUnit: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 2,
  },
  quickHoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  quickHourChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
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
  hourCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  hourCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hourProj: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  hourDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  hourDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  hourCardActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
  },
  modalSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
});
