import React, { useState, useEffect } from "react";
import {
  Platform,
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
import { formatDate, formatCLP } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
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
    activeWorkSession,
    startWorkSession,
    stopWorkSession,
    cancelWorkSession,
    updateTechnicianWorkHour,
    createTechnicianProgressReport,
  } = useApp();
  const { user, currentRole } = useAuth();

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

  const handleAdjustMaterialQty = (idx: number, delta: number) => {
    setUsedMaterials((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it))
    );
  };

  // =========================================================================
  // 2. REGISTRAR HORAS (100% AUTOMÁTICO EN FAENA CON CRONÓMETRO, H27/H28)
  // =========================================================================
  const [sessionElapsedSecs, setSessionElapsedSecs] = useState<number>(0);
  const [autoDesc, setAutoDesc] = useState<string>("");
  const [hoursError, setHoursError] = useState<string>("");
  const [hoursSuccess, setHoursSuccess] = useState<string>("");

  // Modal para editar horas si usuario es Administrador
  const [editingHour, setEditingHour] = useState<TechnicianWorkHour | null>(null);
  const [editHoursVal, setEditHoursVal] = useState<number>(8.0);
  const [editDesc, setEditDesc] = useState<string>("");
  const [editError, setEditError] = useState<string>("");

  // Timer en vivo para sesión activa en faena
  useEffect(() => {
    if (!activeWorkSession) {
      setSessionElapsedSecs(0);
      return;
    }
    const tick = () => {
      const startMs = new Date(activeWorkSession.startTime).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setSessionElapsedSecs(elapsed);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeWorkSession]);

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleStartAutoSession = () => {
    setHoursError("");
    setHoursSuccess("");
    if (!currentProject) {
      setHoursError("Seleccione un proyecto para iniciar la faena.");
      return;
    }
    const res = startWorkSession(currentProject.id);
    if (!res.success) {
      setHoursError(res.error || "Error al iniciar la jornada automática.");
    } else {
      setHoursSuccess(`✓ Jornada iniciada automáticamente en ${currentProject.code}. El sistema cronometra en segundo plano.`);
      setTimeout(() => setHoursSuccess(""), 4000);
    }
  };

  const handleStopAutoSession = () => {
    setHoursError("");
    setHoursSuccess("");
    const res = stopWorkSession(autoDesc);
    if (!res.success) {
      setHoursError(res.error || "Error al finalizar jornada.");
    } else {
      const rate = activeWorkSession?.hourlyRate || currentProject?.hourlyRate || 18500;
      const costReal = (res.hours || 0) * rate;
      setHoursSuccess(
        `✓ Jornada registrada con éxito: ${res.hours} HH (${formatCLP(costReal)}). Alimenta el costo real H27 y rentabilidad H28.`
      );
      setAutoDesc("");
      setTimeout(() => setHoursSuccess(""), 5000);
    }
  };

  const handleCancelAutoSession = () => {
    if (Platform.OS === "web") {
      if (window.confirm("¿Seguro que deseas cancelar el registro automático? El tiempo cronometrado no se guardará.")) {
        cancelWorkSession();
        setAutoDesc("");
      }
    } else {
      cancelWorkSession();
      setAutoDesc("");
    }
  };

  const handleOpenEditHour = (h: TechnicianWorkHour) => {
    if (currentRole !== "admin") {
      alert("Normativa contable: La edición y ajuste de jornadas fuera del flujo automático está reservada a Administración.");
      return;
    }
    setEditingHour(h);
    setEditHoursVal(h.hours);
    setEditDesc(h.description);
    setEditError("");
  };


  const handleConfirmEditHour = () => {
    if (!editingHour) return;
    const res = updateTechnicianWorkHour(editingHour.id, editHoursVal, editDesc, currentRole);
    if (!res.success) {
      setEditError(res.error || "Error al editar horas.");
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
            color={activeSubTab === "avance" ? "#ffffff" : "#a8a29e"}
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
            color={activeSubTab === "horas" ? "#ffffff" : "#a8a29e"}
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
            color={activeSubTab === "sobrante" ? "#ffffff" : "#a8a29e"}
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

          {activeProjects.length === 0 ? (
            <EmptyState
              icon="folder-open-outline"
              title="Sin proyectos activos"
              description="No tienes proyectos asignados actualmente para registrar avance de obra."
              containerStyle={{ marginVertical: 32 }}
            />
          ) : currentProject ? (
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

              {/* Slider / Stepper Táctil y Chips Rápidos 0-100% */}
              <View style={styles.sliderBox}>
                {/* Chips rápidos de porcentaje de avance */}
                <Text style={styles.subFieldLabel}>Hitos rápidos de avance:</Text>
                <View style={styles.quickPctRow}>
                  {[10, 25, 50, 75, 90, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => setAdvancePct(pct)}
                      style={[styles.quickPctChip, advancePct === pct && styles.quickPctChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.quickPctTxt, advancePct === pct && styles.quickPctTxtActive]}>
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.stepperRow}>
                  <TouchableOpacity onPress={() => handleAdjustPct(-10)} style={styles.stepBtn} activeOpacity={0.7}>
                    <Text style={styles.stepBtnTxt}>−10%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdjustPct(-5)} style={styles.stepBtn} activeOpacity={0.7}>
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

                  <TouchableOpacity onPress={() => handleAdjustPct(+5)} style={styles.stepBtn} activeOpacity={0.7}>
                    <Text style={styles.stepBtnTxt}>+5%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdjustPct(+10)} style={styles.stepBtn} activeOpacity={0.7}>
                    <Text style={styles.stepBtnTxt}>+10%</Text>
                  </TouchableOpacity>
                </View>

                {/* Barra visual de progreso */}
                <View style={{ marginTop: 14 }}>
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
                  <Ionicons name="information-circle" size={18} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={styles.noStockDispatchTxt}>
                    Nota: El reporte de materiales en faena es informativo y <Text style={{ fontWeight: "bold" }}>NO rebaja stock en bodega</Text> ni genera egreso contable.
                  </Text>
                </View>

                {usedMaterials.map((m, idx) => (
                  <View key={idx} style={styles.usedMaterialRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.usedMaterialName}>• {m.name}</Text>
                      <Text style={styles.usedMaterialSku}>SKU: {m.sku}</Text>
                    </View>

                    <View style={styles.usedQtyStepperBox}>
                      <TouchableOpacity
                        onPress={() => handleAdjustMaterialQty(idx, -1)}
                        style={styles.qtyStepBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={16} color={theme.colors.primaryDark} />
                      </TouchableOpacity>

                      <View style={styles.qtyDisplayBox}>
                        <Text style={styles.qtyDisplayVal}>{m.quantity}</Text>
                        <Text style={styles.qtyDisplayUnit}>{m.unit}</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleAdjustMaterialQty(idx, +1)}
                        style={styles.qtyStepBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
                      </TouchableOpacity>
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
          ) : null}

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
          <Text style={styles.fieldLabel}>PROYECTO / FAENA A IMPUTAR HH:</Text>
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

          {activeProjects.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Sin proyectos activos"
              description="No tienes proyectos asignados actualmente para imputar horas hombre."
              containerStyle={{ marginVertical: 32 }}
            />
          ) : (
            <>
              {/* REGISTRO AUTOMÁTICO AL INICIAR PROYECTO (CRONÓMETRO FAENA) */}
              {activeWorkSession ? (
                /* SESIÓN EN CURSO (CRONOMETRANDO) */
                <Card variant="elevated" style={styles.activeSessionCard}>
                  <View style={styles.activeSessionHeader}>
                    <View style={styles.liveBadgeRow}>
                      <View style={styles.activeDotPulseLarge} />
                      <Text style={styles.liveBadgeTxt}>JORNADA EN CURSO EN FAENA</Text>
                    </View>
                    <Badge label="100% Offline OK" tone="ok" size="sm" icon="cloud-done" />
                  </View>

                  <Text style={styles.activeSessionProject}>
                    {activeWorkSession.projectCode} • {activeWorkSession.projectName}
                  </Text>
                  <Text style={styles.activeSessionStarted}>
                    Iniciado: {new Date(activeWorkSession.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} • Tarifa: {formatCLP(activeWorkSession.hourlyRate)} / HH
                  </Text>

                  {/* RELOJ DIGITAL */}
                  <View style={styles.timerClockBox}>
                    <Text style={styles.timerDigits}>{formatDuration(sessionElapsedSecs)}</Text>
                    <Text style={styles.timerSubLabel}>Tiempo transcurrido en terreno (segundo plano)</Text>
                  </View>

                  {/* CÁLCULO EN VIVO DE HH Y COSTO REAL (H27 / H28) */}
                  {(() => {
                    const elapsedH = sessionElapsedSecs / 3600;
                    const blocks = Math.max(0.5, Math.min(24.0, Math.round(elapsedH * 2) / 2));
                    const costManoObra = blocks * activeWorkSession.hourlyRate;
                    return (
                      <View style={styles.liveCalcGrid}>
                        <View style={styles.liveCalcCol}>
                          <Text style={styles.liveCalcVal}>{blocks.toFixed(1)} HH</Text>
                          <Text style={styles.liveCalcDesc}>Bloque normativo 0,5 h</Text>
                        </View>
                        <View style={styles.liveCalcDivider} />
                        <View style={styles.liveCalcCol}>
                          <Text style={styles.liveCalcVal}>{formatCLP(costManoObra)}</Text>
                          <Text style={styles.liveCalcDesc}>Costo M.O. Real (H27)</Text>
                        </View>
                        <View style={styles.liveCalcDivider} />
                        <View style={styles.liveCalcCol}>
                          <Text style={styles.liveCalcVal}>H27 / H28</Text>
                          <Text style={styles.liveCalcDesc}>Alimenta Rentabilidad</Text>
                        </View>
                      </View>
                    );
                  })()}

                  <Input
                    label="Descripción de la labor ejecutada"
                    value={autoDesc}
                    onChangeText={setAutoDesc}
                    placeholder="Ej: Montaje de bandejas, cableado estructurado y pruebas..."
                  />

                  {Boolean(hoursError) && <Text style={styles.errorText}>{hoursError}</Text>}
                  {Boolean(hoursSuccess) && <Text style={styles.successText}>{hoursSuccess}</Text>}

                  <View style={styles.activeActionsRow}>
                    <Button
                      title="Descartar"
                      variant="ghost"
                      icon="close-outline"
                      onPress={handleCancelAutoSession}
                      style={{ flex: 1, marginRight: 8, height: 48 }}
                    />
                    <Button
                      title="Finalizar y Registrar HH"
                      variant="primary"
                      icon="checkmark-circle-outline"
                      onPress={handleStopAutoSession}
                      style={{ flex: 2, height: 48 }}
                    />
                  </View>
                </Card>
              ) : (
                /* SIN SESIÓN: INICIAR JORNADA AUTOMÁTICA */
                <Card variant="elevated" style={styles.autoPromptCard}>
                  <View style={styles.autoPromptTop}>
                    <View style={styles.autoIconCircle}>
                      <Ionicons name="play" size={26} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cardHeading}>Registro Automático de Horas</Text>
                      <Text style={styles.cardSub}>
                        Inicia tu faena al llegar al proyecto. El sistema cronometra y registra automáticamente tus horas trabajadas en bloques de 0,5 h.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.autoPillsBox}>
                    <View style={styles.autoPillItem}>
                      <Ionicons name="speedometer-outline" size={14} color={theme.colors.primary} />
                      <Text style={styles.autoPillText}>Bloques de 0,5 h</Text>
                    </View>
                    <View style={styles.autoPillItem}>
                      <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.ok} />
                      <Text style={styles.autoPillText}>Máx 24 h por día</Text>
                    </View>
                    <View style={styles.autoPillItem}>
                      <Ionicons name="flash-outline" size={14} color={theme.colors.infoDark} />
                      <Text style={styles.autoPillText}>100% Automático</Text>
                    </View>
                    <View style={styles.autoPillItem}>
                      <Ionicons name="cloud-offline-outline" size={14} color={theme.colors.textMuted} />
                      <Text style={styles.autoPillText}>Funciona Offline</Text>
                    </View>
                  </View>

                  <View style={styles.autoProjectRateRow}>
                    <Text style={styles.autoProjectRateLabel}>Proyecto seleccionado:</Text>
                    <Text style={styles.autoProjectRateVal}>
                      {currentProject ? `${currentProject.code} - ${currentProject.name}` : "Seleccione un proyecto"}
                    </Text>
                  </View>
                  <View style={styles.autoProjectRateRow}>
                    <Text style={styles.autoProjectRateLabel}>Tarifa M.O. imputable:</Text>
                    <Text style={styles.autoProjectRateHighlight}>
                      {formatCLP(currentProject?.hourlyRate || 18500)} / HH → Alimenta H27 y H28
                    </Text>
                  </View>

                  {Boolean(hoursError) && <Text style={styles.errorText}>{hoursError}</Text>}
                  {Boolean(hoursSuccess) && <Text style={styles.successText}>{hoursSuccess}</Text>}

                  <Button
                    title={`Iniciar Faena en ${currentProject?.code || "Proyecto"}`}
                    variant="primary"
                    icon="play-circle"
                    onPress={handleStartAutoSession}
                    style={{ marginTop: 14, height: 50 }}
                  />
                </Card>
              )}

              {/* AVISO DE CARGA MANUAL DELEGADA A ADMINISTRACIÓN */}
              <View style={styles.adminDelegationNoticeCard}>
                <View style={styles.adminDelegationNoticeHeader}>
                  <Ionicons name="information-circle" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                  <Text style={styles.adminDelegationNoticeTitle}>
                    Carga Manual de Horas Asignada a Administración
                  </Text>
                </View>
                <Text style={styles.adminDelegationNoticeDesc}>
                  El registro en terreno es estrictamente automático con cronómetro. En caso de que no se haya registrado automáticamente tu jornada (por batería agotada, falla de terminal o falta de señal), contacta a Administración para que seleccione tu perfil e impute manualmente tus horas al proyecto.
                </Text>
              </View>

              {/* BANNER INFORMATIVO: ALIMENTACIÓN H27 Y H28 + REGLA 48 HORAS */}
              <View style={styles.financialIntegrationBanner}>
                <View style={styles.financialBannerHeader}>
                  <Ionicons name="analytics" size={16} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={styles.financialBannerTitle}>
                    Integración Financiera H27 y H28 (Mano de Obra Real)
                  </Text>
                </View>
                <Text style={styles.financialBannerDesc}>
                  • <Text style={{ fontWeight: "bold" }}>H27 (Costo Real):</Text> Cada bloque de 0,5 h suma a los costos reales de mano de obra del proyecto según la tarifa base.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>H28 (Liquidación Financiera):</Text> Actualiza la desviación respecto al presupuesto de HH y rentabilidad.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>Cargas Manuales:</Text> Reservadas exclusivamente a Administración cuando no se registra automáticamente.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>Offline:</Text> Funciona sin conexión a internet y sincroniza automáticamente al reconectar.
                </Text>
              </View>
            </>
          )}

          {/* LISTADO DE HORAS REGISTRADAS */}
          <Text style={styles.historyHeading}>Mis Jornadas Registradas:</Text>
          <Text style={styles.historyRuleNotice}>
            Historial de jornadas imputadas a tus proyectos (vía cronómetro en faena o carga autorizada por Administración).
          </Text>

          {technicianHours.map((h) => {
            const createdTime = new Date(h.createdAt).getTime();
            const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60);
            const canEdit = currentRole === "admin";
            const proj = projects.find((p) => p.id === h.projectId);
            const rate = proj?.hourlyRate || 18500;
            const costReal = h.hours * rate;

            return (
              <Card key={h.id} variant="default" style={styles.hourCard}>
                <View style={styles.hourCardTop}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.hourProj}>{h.projectName} ({h.projectCode})</Text>
                    <Text style={styles.hourDate}>
                      Fecha trabajada: {formatDate(h.date)} • Imputado: {formatCLP(costReal)}
                    </Text>
                    <Text style={styles.hourDesc}>{h.description}</Text>
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
                    <Text style={styles.hourDiffHoursTxt}>
                      {diffHours < 1
                        ? "Recién registrado"
                        : diffHours < 24
                        ? `Hace ${Math.floor(diffHours)} h`
                        : `Hace ${Math.floor(diffHours / 24)} días`}
                    </Text>
                  </View>
                </View>

                {canEdit && (
                  <View style={styles.hourCardActions}>
                    <Button
                      title="Editar Registro (Admin)"
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

          {/* MODAL PARA EDITAR HORAS DENTRO DE 48H O COMO ADMIN */}
          <ModalView
            visible={Boolean(editingHour)}
            onClose={() => setEditingHour(null)}
            title="Editar Jornada de Horas"
            subtitle={editingHour ? `${editingHour.projectCode} • Registrado el ${formatDate(editingHour.date)}` : ""}
          >
            {editingHour && (() => {
              const diffH = (Date.now() - new Date(editingHour.createdAt).getTime()) / (1000 * 60 * 60);
              const isPast48 = diffH > 48;
              return (
                <View style={{ marginBottom: 12 }}>
                  {isPast48 ? (
                    <View style={styles.adminEditNotice}>
                      <Ionicons name="shield-checkmark" size={16} color={theme.colors.warnDark} style={{ marginRight: 6 }} />
                      <Text style={styles.adminEditNoticeTxt}>
                        Modo Administrador: Edición autorizada fuera de la ventana de 48 horas.
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.modalSub}>
                      Registro dentro de la ventana de 48 horas de gracia del técnico:
                    </Text>
                  )}
                </View>
              );
            })()}

            <Text style={styles.hoursFieldLabel}>Horas (Bloques de 0,5 h, máx 24):</Text>
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

            {/* Chips rápidos en el modal */}
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
                label="Descripción de las labores"
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
                title="Guardar Cambios (H27/H28)"
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
    backgroundColor: "#1c1917", // Dark Titanium Bar
    padding: 4,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  subTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  subTabItemActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  subTabLabel: {
    fontSize: theme.fontSize.xs,
    color: "#a8a29e",
    fontWeight: "600",
    marginLeft: 4,
  },
  subTabLabelActive: {
    color: "#ffffff",
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
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
  },
  chipBtnActive: {
    backgroundColor: "#1c1917",
    borderColor: theme.colors.primary,
  },
  chipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  chipTxtActive: {
    color: "#f59e0b",
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
  subFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickPctRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickPctChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    minHeight: 38,
  },
  quickPctChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  quickPctTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.text,
  },
  quickPctTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepBtn: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    minHeight: 44,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 44,
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
    backgroundColor: theme.colors.surfaceAlt,
    padding: 10,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  usedMaterialName: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },
  usedMaterialSku: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  usedQtyStepperBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    height: 44,
    paddingHorizontal: 4,
  },
  qtyStepBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  qtyDisplayBox: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  qtyDisplayVal: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  qtyDisplayUnit: {
    fontSize: 10,
    color: theme.colors.textMuted,
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
  dateSelectorSection: {
    marginBottom: 12,
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
  hoursInputSection: {
    marginBottom: 12,
  },
  hoursHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
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
  hourCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderLeftWidth: 3.5,
    borderLeftColor: theme.colors.primary,
    borderColor: theme.colors.border,
    borderWidth: 1,
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
  modeSegment: {
    flexDirection: "row",
    backgroundColor: "#292524", // Stone 800 Dark Titanium Bar
    padding: 4,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  modeSegmentBtnActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  modeSegmentTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: "#a8a29e",
    marginLeft: 6,
  },
  modeSegmentTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  activeDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginLeft: 6,
  },
  activeDotPulseLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  activeSessionCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1.5,
    borderColor: "#fde68a",
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  activeSessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  liveBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveBadgeTxt: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#b45309",
    letterSpacing: 0.5,
  },
  activeSessionProject: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 4,
  },
  activeSessionStarted: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  timerClockBox: {
    backgroundColor: "#1c1917",
    borderWidth: 1.5,
    borderColor: "#d97706",
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  timerDigits: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f59e0b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
  },
  timerSubLabel: {
    fontSize: 11,
    color: "#fde68a",
    fontWeight: "600",
    marginTop: 4,
  },
  liveCalcGrid: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  liveCalcCol: {
    flex: 1,
    alignItems: "center",
  },
  liveCalcVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  liveCalcDesc: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  liveCalcDivider: {
    width: 1,
    backgroundColor: "#fde68a",
    marginVertical: 2,
  },
  activeActionsRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  autoPromptCard: {
    backgroundColor: theme.colors.card,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  autoPromptTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  autoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  autoPillsBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.colors.surfaceAlt,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 12,
    gap: 8,
  },
  autoPillItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  autoPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  autoProjectRateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  autoProjectRateLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  autoProjectRateVal: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  autoProjectRateHighlight: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  manualCostPreview: {
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  manualCostFormula: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  manualCostTotal: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  manualCostFootnote: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
  },
  manualCostTxt: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  financialIntegrationBanner: {
    backgroundColor: "#1c1917", // Dark Titanium Technical Chassis
    borderWidth: 1,
    borderColor: "#292524",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    borderRadius: theme.radius.md,
    padding: 14,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
  },
  financialBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  financialBannerTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  financialBannerDesc: {
    fontSize: 11,
    color: "#d6d3d1",
    lineHeight: 18,
  },
  hourDiffHoursTxt: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  adminEditNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 8,
    borderRadius: theme.radius.sm,
  },
  adminEditNoticeTxt: {
    fontSize: 11,
    color: theme.colors.warnDark,
    fontWeight: "600",
    flex: 1,
  },
  adminDelegationNoticeCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderLeftWidth: 4,
    borderLeftColor: "#d97706",
    borderRadius: theme.radius.md,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  adminDelegationNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  adminDelegationNoticeTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#b45309",
  },
  adminDelegationNoticeDesc: {
    fontSize: 11,
    color: "#78350f",
    lineHeight: 17,
  },
});
