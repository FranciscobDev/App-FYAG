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
import { formatCLP, formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/common/Input";
import { ModalView } from "@/components/common/ModalView";
import { PageHeader } from "@/components/common/PageHeader";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";
import { Tool, ToolStatus } from "@/core/types";

export const ToolsScreen: React.FC = () => {
  const {
    tools,
    technicians,
    projects,
    createTool,
    loanTool,
    returnTool,
    registerToolMaintenance,
  } = useApp();
  const { currentRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Herramienta seleccionada para ver Historial (Préstamos y Mantenciones)
  const [selectedToolHistory, setSelectedToolHistory] = useState<Tool | null>(null);
  const [historyTab, setHistoryTab] = useState<"prestamos" | "mantenciones">("prestamos");

  // 1. Alta de Herramienta Modal
  const [newToolModal, setNewToolModal] = useState(false);
  const [toolCode, setToolCode] = useState("");
  const [toolSerial, setToolSerial] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolCategory, setToolCategory] = useState("Herramientas Eléctricas");
  const [toolBrand, setToolBrand] = useState("Bosch");
  const [toolModel, setToolModel] = useState("");
  const [toolDaysFreq, setToolDaysFreq] = useState("90");
  const [toolError, setToolError] = useState("");

  // 2. Préstamo a Técnico Modal
  const [loanModalTool, setLoanModalTool] = useState<Tool | null>(null);
  const [loanTechRut, setLoanTechRut] = useState(technicians[0]?.rut || "");
  const [loanProjectCode, setLoanProjectCode] = useState(projects[0]?.code || "");

  // 3. Devolución de Herramienta (Bueno -> disponible / Dañado -> en_mantencion)
  const [returnModalTool, setReturnModalTool] = useState<Tool | null>(null);
  const [returnCondition, setReturnCondition] = useState<"bueno" | "danado">("bueno");
  const [returnNotes, setReturnNotes] = useState("");

  // 4. Registro de Mantención Modal
  const [maintModalTool, setMaintModalTool] = useState<Tool | null>(null);
  const [maintType, setMaintType] = useState<"preventiva" | "correctiva">("preventiva");
  const [maintWorkshop, setMaintWorkshop] = useState("Servicio Técnico Oficial Bosch");
  const [maintCost, setMaintCost] = useState("35000");
  const [maintDesc, setMaintDesc] = useState("Limpieza interna, cambio de carbones y lubricación de engranajes");
  const [maintNextDate, setMaintNextDate] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);

  // Función para calcular días restantes hasta la mantención
  const getDaysUntilMaintenance = (dateStr: string) => {
    if (!dateStr) return 999;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return 999;
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // KPIs de inventario de maquinaria
  const totalCount = tools.length;
  const availableCount = tools.filter((t) => t.status === "disponible").length;
  const assignedCount = tools.filter((t) => t.status === "asignada").length;
  const maintenanceCount = tools.filter((t) => t.status === "en_mantencion").length;
  const overdueCount = tools.filter((t) => {
    if (t.status === "dada_de_baja") return false;
    return getDaysUntilMaintenance(t.nextMaintenanceDate) <= 0;
  }).length;

  // Filtrado de herramientas
  const filteredTools = tools.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.serialNumber.toLowerCase().includes(q) ||
      t.brand.toLowerCase().includes(q) ||
      t.model.toLowerCase().includes(q);

    if (filterStatus === "vencidas") {
      return matchQuery && t.status !== "dada_de_baja" && getDaysUntilMaintenance(t.nextMaintenanceDate) <= 0;
    }

    if (filterStatus !== "todos" && t.status !== filterStatus) {
      return false;
    }
    return matchQuery;
  });

  // Guardar nueva herramienta
  const handleSaveNewTool = () => {
    if (!toolCode.trim() || !toolName.trim() || !toolSerial.trim()) {
      setToolError("Código, Nombre y N° de Serie son obligatorios.");
      return;
    }

    const freqDays = Number(toolDaysFreq) || 90;
    const nextMaint = new Date(Date.now() + freqDays * 86400000)
      .toISOString()
      .slice(0, 10);

    const newT: Tool = {
      id: `tool_${Date.now()}`,
      code: toolCode.trim().toUpperCase(),
      serialNumber: toolSerial.trim(),
      name: toolName.trim(),
      category: toolCategory,
      brand: toolBrand,
      model: toolModel.trim() || "Estándar",
      status: "disponible",
      purchaseDate: todayStr,
      maintenanceFrequencyDays: freqDays,
      nextMaintenanceDate: nextMaint,
      loans: [],
      maintenances: [],
    };

    const res = createTool(newT);
    if (!res.success) {
      setToolError(res.error || "Error al crear herramienta.");
    } else {
      setNewToolModal(false);
    }
  };

  // Confirmar préstamo a técnico
  const handleConfirmLoan = () => {
    if (!loanModalTool) return;
    loanTool(loanModalTool.id, loanTechRut, loanProjectCode);
    setLoanModalTool(null);
  };

  // Confirmar devolución de herramienta (Bueno / Dañado)
  const handleConfirmReturn = () => {
    if (!returnModalTool) return;
    returnTool(returnModalTool.id, returnCondition, returnNotes.trim() || undefined);
    setReturnModalTool(null);
  };

  // Confirmar registro de mantención
  const handleConfirmMaintenance = () => {
    if (!maintModalTool) return;
    registerToolMaintenance(maintModalTool.id, {
      toolId: maintModalTool.id,
      date: todayStr,
      type: maintType,
      workshop: maintWorkshop,
      cost: Number(maintCost) || 0,
      description: maintDesc,
      nextMaintenanceDate: maintNextDate,
      performedBy: userRoleDisplay(currentRole),
    });
    setMaintModalTool(null);
  };

  const userRoleDisplay = (role: string) => {
    if (role === "admin") return "Administración Central";
    if (role === "warehouse") return "Bodega Central";
    return "Técnico en Terreno";
  };

  return (
    <ScreenStateWrapper screenTitle="Control de Herramientas" skeletonType="table">
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ========================================================================= */}
      {/* HEADER & BARRA DE ACCIÓN PRINCIPAL (PAGEHEADER)                           */}
      {/* ========================================================================= */}
      <PageHeader
        title="Control de Herramientas y Maquinaria"
        subtitle="Asignaciones a faena, control de mantenciones preventivas y calibración"
        breadcrumbs={["Inicio", "Administración", "Control Herramientas"]}
        rightAction={
          currentRole !== "technician" ? (
            <Button
              title="+ Alta Herramienta"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={() => {
                setToolCode(`HER-${String(tools.length + 1).padStart(3, "0")}`);
                setToolSerial("");
                setToolName("");
                setToolModel("");
                setToolError("");
                setNewToolModal(true);
              }}
            />
          ) : undefined
        }
      />

      {/* ========================================================================= */}
      {/* KPIS DE RESUMEN                                                           */}
      {/* ========================================================================= */}
      <View style={styles.kpisRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{totalCount}</Text>
          <Text style={styles.kpiLbl}>Total Equipos</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: theme.colors.ok }]}>
          <Text style={[styles.kpiVal, { color: theme.colors.ok }]}>{availableCount}</Text>
          <Text style={styles.kpiLbl}>Disponibles</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: theme.colors.info }]}>
          <Text style={[styles.kpiVal, { color: theme.colors.info }]}>{assignedCount}</Text>
          <Text style={styles.kpiLbl}>Asignadas</Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: theme.colors.warn }]}>
          <Text style={[styles.kpiVal, { color: theme.colors.warn }]}>{maintenanceCount}</Text>
          <Text style={styles.kpiLbl}>En Mantención</Text>
        </View>

        {overdueCount > 0 && (
          <View style={[styles.kpiCard, styles.kpiCardDanger]}>
            <Text style={[styles.kpiVal, { color: theme.colors.danger }]}>{overdueCount}</Text>
            <Text style={[styles.kpiLbl, { color: theme.colors.danger }]}>¡Vencidas!</Text>
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* BUSCADOR Y FILTROS POR ESTADO                                             */}
      {/* ========================================================================= */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por código, serie, marca o nombre..."
          placeholderTextColor={theme.colors.textLight}
          style={styles.searchInput}
        />
        {Boolean(searchQuery) && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { id: "todos", label: `Todas (${totalCount})` },
          { id: "disponible", label: `Disponibles (${availableCount})` },
          { id: "asignada", label: `Asignadas en Faena (${assignedCount})` },
          { id: "en_mantencion", label: `En Mantención (${maintenanceCount})` },
          { id: "vencidas", label: `⚠️ Mantención Vencida (${overdueCount})` },
          { id: "dada_de_baja", label: "Dadas de Baja" },
        ].map((f) => {
          const isActive = filterStatus === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilterStatus(f.id)}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
                f.id === "vencidas" && overdueCount > 0 && styles.filterChipDanger,
              ]}
            >
              <Text
                style={[
                  styles.filterChipTxt,
                  isActive && styles.filterChipTxtActive,
                  f.id === "vencidas" && overdueCount > 0 && !isActive && { color: theme.colors.danger, fontWeight: "bold" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ========================================================================= */}
      {/* LISTA DE HERRAMIENTAS Y RESALTADO DE MANTENCIÓN VENCIDA                  */}
      {/* ========================================================================= */}
      {filteredTools.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="No se encontraron herramientas"
          description={
            searchQuery
              ? `No existen coincidencias para "${searchQuery}".`
              : "No hay herramientas ni maquinarias registradas en este estado."
          }
          actionTitle={currentRole !== "technician" ? "+ Alta Herramienta" : undefined}
          onAction={
            currentRole !== "technician"
              ? () => {
                  setToolCode(`HER-${String(tools.length + 1).padStart(3, "0")}`);
                  setToolSerial("");
                  setToolName("");
                  setToolModel("");
                  setToolError("");
                  setNewToolModal(true);
                }
              : undefined
          }
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        filteredTools.map((t) => {
          const daysLeft = getDaysUntilMaintenance(t.nextMaintenanceDate);
        const isRetired = t.status === "dada_de_baja";
        const isOverdue = !isRetired && daysLeft <= 0;
        const isNearDue = !isRetired && daysLeft > 0 && daysLeft <= 5;
        const isAssigned = t.status === "asignada";
        const isAvailable = t.status === "disponible";

        return (
          <Card
            key={t.id}
            variant="elevated"
            style={[
              styles.toolCard,
              isOverdue && styles.overdueCard,
              isNearDue && styles.nearDueCard,
            ]}
          >
            {/* Top row: Código, S/N, Nombre y EstadoBadge */}
            <View style={styles.toolTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.toolCodeRow}>
                  <Text style={styles.toolCode}>{t.code}</Text>
                  <Text style={styles.toolSerial}>S/N: {t.serialNumber}</Text>
                  {isOverdue && (
                    <View style={styles.dangerPill}>
                      <Ionicons name="alert-circle" size={12} color="#ffffff" />
                      <Text style={styles.dangerPillTxt}>VENCIDA</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toolName}>{t.name}</Text>
                <Text style={styles.toolBrandModel}>
                  {t.brand} {t.model} • Categoría: <Text style={{ color: theme.colors.text }}>{t.category}</Text>
                </Text>
              </View>

              <EstadoBadge status={t.status} size="md" />
            </View>

            {/* Ficha de Asignación si está en Faena */}
            {isAssigned && (
              <View style={styles.assignedBox}>
                <Ionicons name="person" size={16} color={theme.colors.info} style={{ marginTop: 2 }} />
                <View style={styles.assignedInfo}>
                  <Text style={styles.assignedTech}>
                    Asignada a Técnico: <Text style={{ fontWeight: "bold" }}>{t.currentTechnicianName}</Text>
                  </Text>
                  <Text style={styles.assignedProj}>
                    Faena: {t.currentProjectName} ({t.currentProjectCode}) • Desde el {formatDate(t.currentLoanDate || "")}
                  </Text>
                </View>
              </View>
            )}

            {/* Control de Próxima Mantención (Resaltado si vencida) */}
            <View style={[
              styles.maintenanceRow,
              isOverdue && styles.maintenanceRowOverdue,
              isNearDue && styles.maintenanceRowNearDue,
            ]}>
              <View style={styles.maintCol}>
                <Text style={styles.maintDateLabel}>Próxima Mantención Preventiva:</Text>
                <Text style={[
                  styles.maintDateVal,
                  isOverdue && styles.overdueDateVal,
                  isNearDue && styles.nearDueDateVal,
                ]}>
                  {formatDate(t.nextMaintenanceDate)}
                </Text>
                <Text style={styles.maintFreqText}>
                  Frecuencia de calibración: cada {t.maintenanceFrequencyDays} días
                </Text>
              </View>

              <View style={styles.maintBadgeWrapper}>
                {isRetired ? (
                  <Badge label="Dada de Baja" tone="mute" size="sm" />
                ) : isOverdue ? (
                  <Badge
                    label={`¡Vencida! (${Math.abs(daysLeft)} días atrasada)`}
                    tone="danger"
                    icon="alert-circle"
                    size="sm"
                  />
                ) : isNearDue ? (
                  <Badge
                    label={`Próxima (vence en ${daysLeft} días)`}
                    tone="warn"
                    icon="time-outline"
                    size="sm"
                  />
                ) : (
                  <Badge
                    label={`Al día (en ${daysLeft} días)`}
                    tone="ok"
                    icon="checkmark-circle-outline"
                    size="sm"
                  />
                )}
              </View>
            </View>

            {/* BOTONES DE ACCIÓN */}
            <View style={styles.toolActionsRow}>
              {/* Botón Historial de Préstamos */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedToolHistory(t);
                  setHistoryTab("prestamos");
                }}
                style={styles.historyBtn}
              >
                <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.historyBtnTxt}>
                  Historial ({t.loans?.length || 0})
                </Text>
              </TouchableOpacity>

              <View style={styles.actionBtnsGroup}>
                {/* 1. Prestar a Técnico (Disponible) */}
                {isAvailable && currentRole !== "technician" && (
                  <Button
                    title="Prestar a Técnico"
                    variant="primary"
                    size="sm"
                    icon="arrow-forward-outline"
                    onPress={() => {
                      setLoanModalTool(t);
                      setLoanTechRut(technicians[0]?.rut || "");
                      setLoanProjectCode(projects[0]?.code || "");
                    }}
                    style={{ marginRight: 6, height: 38 }}
                  />
                )}

                {/* 2. Devolución de Herramienta (Asignada) */}
                {isAssigned && currentRole !== "technician" && (
                  <Button
                    title="Devolver (Bueno/Dañado)"
                    variant="secondary"
                    size="sm"
                    icon="return-down-back-outline"
                    onPress={() => {
                      setReturnModalTool(t);
                      setReturnCondition("bueno");
                      setReturnNotes("");
                    }}
                    style={{ marginRight: 6, height: 38 }}
                  />
                )}

                {/* 3. Registrar Mantención */}
                {!isRetired && currentRole !== "technician" && (
                  <Button
                    title={t.status === "en_mantencion" ? "Completar Mantención" : "Mantención"}
                    variant={isOverdue ? "danger" : t.status === "en_mantencion" ? "success" : "outline"}
                    size="sm"
                    icon="build-outline"
                    onPress={() => {
                      setMaintModalTool(t);
                      setMaintType(t.status === "en_mantencion" ? "correctiva" : "preventiva");
                      setMaintWorkshop("Servicio Técnico Oficial Bosch");
                      setMaintCost("35000");
                      setMaintDesc(t.status === "en_mantencion" ? "Reparación y cambio de piezas averiadas" : "Limpieza, calibración y engrase general");
                      // Próxima fecha calculada automáticamente
                      const calcNext = new Date(Date.now() + t.maintenanceFrequencyDays * 86400000)
                        .toISOString()
                        .slice(0, 10);
                      setMaintNextDate(calcNext);
                    }}
                    style={{ height: 38 }}
                  />
                )}
              </View>
            </View>
          </Card>
        );
      })
    )}

      {/* ========================================================================= */}
      {/* 1. MODAL: ALTA DE NUEVA HERRAMIENTA                                       */}
      {/* ========================================================================= */}
      <ModalView
        visible={newToolModal}
        onClose={() => setNewToolModal(false)}
        title="Alta de Herramienta / Maquinaria"
        subtitle="Registro de equipo patrimonial y control de mantención preventiva"
      >
        {/* 1. IDENTIFICACIÓN DEL EQUIPO */}
        <Text style={styles.formSectionHeading}>1. Identificación del Equipo</Text>
        <Input
          label="Código Interno Único"
          value={toolCode}
          onChangeText={setToolCode}
          placeholder="Ej: HER-015"
        />
        <Input
          label="Número de Serie de Fábrica"
          value={toolSerial}
          onChangeText={setToolSerial}
          placeholder="Ej: SN-98234-BOSCH"
        />
        <Input
          label="Nombre del Equipo o Herramienta"
          value={toolName}
          onChangeText={setToolName}
          placeholder="Ej: Rotomartillo SDS Plus 800W"
        />
        <Input
          label="Categoría"
          value={toolCategory}
          onChangeText={setToolCategory}
          placeholder="Herramientas Eléctricas, Medición, Soldadura..."
        />
        <View style={styles.formRowTwo}>
          <Input
            label="Marca"
            value={toolBrand}
            onChangeText={setToolBrand}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Modelo"
            value={toolModel}
            onChangeText={setToolModel}
            placeholder="GBH 2-26 DRE"
            containerStyle={{ flex: 1 }}
          />
        </View>

        {/* 2. CONTROL DE MANTENCIÓN */}
        <Text style={styles.formSectionHeading}>2. Control de Mantención Preventiva</Text>
        <Input
          label="Frecuencia Mantención Preventiva (Días)"
          value={toolDaysFreq}
          onChangeText={setToolDaysFreq}
          keyboardType="numeric"
          placeholder="90"
        />

        <View style={styles.calculatedNextBox}>
          <Ionicons name="information-circle" size={16} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={styles.calculatedNextTxt}>
            Próxima mantención calculada:{" "}
            <Text style={{ fontWeight: "bold" }}>
              {new Date(Date.now() + (Number(toolDaysFreq) || 90) * 86400000).toISOString().slice(0, 10)}
            </Text>{" "}
            (en {Number(toolDaysFreq) || 90} días).
          </Text>
        </View>

        {Boolean(toolError) && <Text style={styles.errorText}>{toolError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setNewToolModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Guardar Herramienta"
            variant="primary"
            onPress={handleSaveNewTool}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* 2. MODAL: PRÉSTAMO A TÉCNICO                                              */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(loanModalTool)}
        onClose={() => setLoanModalTool(null)}
        title="Prestar Herramienta a Técnico"
        subtitle={loanModalTool ? `${loanModalTool.code} • ${loanModalTool.name}` : ""}
      >
        <Text style={styles.fieldLabel}>1. Técnico Responsable en Terreno:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {technicians.map((t) => {
            const isSelected = loanTechRut === t.rut;
            return (
              <TouchableOpacity
                key={t.rut}
                onPress={() => setLoanTechRut(t.rut)}
                style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={isSelected ? "#ffffff" : theme.colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.chipTxt, isSelected && styles.chipTxtActive]}>
                  {t.name} ({t.rut})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>2. Proyecto / Faena de Destino:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {projects
            .filter((p) => p.status !== "cerrado")
            .map((p) => {
              const isSelected = loanProjectCode === p.code;
              return (
                <TouchableOpacity
                  key={p.code}
                  onPress={() => setLoanProjectCode(p.code)}
                  style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
                >
                  <Ionicons
                    name="business-outline"
                    size={14}
                    color={isSelected ? "#ffffff" : theme.colors.textMuted}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.chipTxt, isSelected && styles.chipTxtActive]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        <View style={styles.infoSummaryBox}>
          <Text style={styles.infoSummaryLine}>
            Fecha de entrega: <Text style={{ fontWeight: "bold" }}>{formatDate(todayStr)}</Text>
          </Text>
          <Text style={styles.infoSummaryLine}>
            Condición de salida: <Text style={{ fontWeight: "bold" }}>Operativo y verificado en bodega</Text>
          </Text>
        </View>

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setLoanModalTool(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Confirmar Préstamo"
            variant="primary"
            onPress={handleConfirmLoan}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* 3. MODAL: DEVOLUCIÓN DE HERRAMIENTA (BUENO / DAÑADO)                      */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(returnModalTool)}
        onClose={() => setReturnModalTool(null)}
        title="Recepción de Herramienta desde Faena"
        subtitle={returnModalTool ? `${returnModalTool.code} • En poder de ${returnModalTool.currentTechnicianName}` : ""}
      >
        <Text style={styles.fieldLabel}>Estado Físico al Momento del Retorno:</Text>
        <Text style={styles.modalInstruction}>
          Seleccione la condición operativa del equipo. Si retorna "Dañado", pasará automáticamente a estado "En mantención":
        </Text>

        <View style={styles.conditionRow}>
          <TouchableOpacity
            onPress={() => setReturnCondition("bueno")}
            style={[
              styles.conditionBtn,
              returnCondition === "bueno" && styles.conditionBtnBueno,
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={returnCondition === "bueno" ? theme.colors.ok : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.conditionTitle,
                returnCondition === "bueno" && { color: theme.colors.ok, fontWeight: "bold" },
              ]}
            >
              BUENO
            </Text>
            <Text style={styles.conditionSubtitle}>Retorna a Disponible</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setReturnCondition("danado")}
            style={[
              styles.conditionBtn,
              returnCondition === "danado" && styles.conditionBtnDanado,
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={22}
              color={returnCondition === "danado" ? theme.colors.danger : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.conditionTitle,
                returnCondition === "danado" && { color: theme.colors.danger, fontWeight: "bold" },
              ]}
            >
              DAÑADO
            </Text>
            <Text style={styles.conditionSubtitle}>Pasa a En Mantención</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Observaciones sobre desgaste o falla reportada"
          value={returnNotes}
          onChangeText={setReturnNotes}
          placeholder="Ej: Mandril con holgura, cable pelado o chisporroteo..."
        />

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setReturnModalTool(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Confirmar Devolución"
            variant={returnCondition === "danado" ? "danger" : "success"}
            onPress={handleConfirmReturn}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* 4. MODAL: REGISTRO DE MANTENCIÓN                                          */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(maintModalTool)}
        onClose={() => setMaintModalTool(null)}
        title="Registrar Mantención de Maquinaria"
        subtitle={maintModalTool ? `${maintModalTool.code} • ${maintModalTool.name}` : ""}
      >
        <Text style={styles.fieldLabel}>Tipo de Servicio Técnico:</Text>
        <View style={styles.conditionRow}>
          <TouchableOpacity
            onPress={() => setMaintType("preventiva")}
            style={[
              styles.conditionBtn,
              maintType === "preventiva" && styles.conditionBtnBueno,
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={maintType === "preventiva" ? theme.colors.ok : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.conditionTitle,
                maintType === "preventiva" && { color: theme.colors.ok, fontWeight: "bold" },
              ]}
            >
              PREVENTIVA
            </Text>
            <Text style={styles.conditionSubtitle}>Limpieza y engrase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMaintType("correctiva")}
            style={[
              styles.conditionBtn,
              maintType === "correctiva" && styles.conditionBtnDanado,
            ]}
          >
            <Ionicons
              name="build-outline"
              size={20}
              color={maintType === "correctiva" ? theme.colors.warn : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.conditionTitle,
                maintType === "correctiva" && { color: theme.colors.warn, fontWeight: "bold" },
              ]}
            >
              CORRECTIVA
            </Text>
            <Text style={styles.conditionSubtitle}>Reparación por falla</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Taller o Servicio Técnico Oficial"
          value={maintWorkshop}
          onChangeText={setMaintWorkshop}
          placeholder="Ej: Servicio Técnico Autorizado Bosch"
        />

        <View style={styles.formRowTwo}>
          <Input
            label="Costo ($ CLP)"
            value={maintCost}
            onChangeText={setMaintCost}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Próxima Mantención (YYYY-MM-DD)"
            value={maintNextDate}
            onChangeText={setMaintNextDate}
            placeholder="YYYY-MM-DD"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={styles.calculatedNextBox}>
          <Ionicons name="calculator-outline" size={16} color={theme.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={styles.calculatedNextTxt}>
            Cálculo automático: Fecha mantención + {maintModalTool?.maintenanceFrequencyDays || 90} días de frecuencia.
          </Text>
        </View>

        <Input
          label="Descripción de Trabajos Realizados"
          value={maintDesc}
          onChangeText={setMaintDesc}
          placeholder="Ej: Cambio de carbones, ajuste de rodamientos y prueba de aislamiento..."
        />

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setMaintModalTool(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Guardar Mantención"
            variant="success"
            onPress={handleConfirmMaintenance}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* 5. MODAL: HISTORIAL DE PRÉSTAMOS Y MANTENCIONES                           */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(selectedToolHistory)}
        onClose={() => setSelectedToolHistory(null)}
        title="Historial de Herramienta"
        subtitle={selectedToolHistory ? `${selectedToolHistory.code} • ${selectedToolHistory.name}` : ""}
      >
        {/* Pestañas internas del historial */}
        <View style={styles.historySubTabs}>
          <TouchableOpacity
            onPress={() => setHistoryTab("prestamos")}
            style={[styles.historySubTab, historyTab === "prestamos" && styles.historySubTabActive]}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={historyTab === "prestamos" ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.historySubTabTxt, historyTab === "prestamos" && styles.historySubTabTxtActive]}>
              Préstamos ({selectedToolHistory?.loans?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setHistoryTab("mantenciones")}
            style={[styles.historySubTab, historyTab === "mantenciones" && styles.historySubTabActive]}
          >
            <Ionicons
              name="build-outline"
              size={16}
              color={historyTab === "mantenciones" ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.historySubTabTxt, historyTab === "mantenciones" && styles.historySubTabTxtActive]}>
              Mantenciones ({selectedToolHistory?.maintenances?.length || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5.A. Historial de Préstamos */}
        {historyTab === "prestamos" && (
          <ScrollView style={{ maxHeight: 380 }}>
            {selectedToolHistory?.loans && selectedToolHistory.loans.length > 0 ? (
              selectedToolHistory.loans.map((ln) => {
                const isReturned = Boolean(ln.returnDate);
                const isDamaged = ln.returnCondition === "danado";
                return (
                  <View key={ln.id} style={styles.historyItemCard}>
                    <View style={styles.historyItemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyItemTech}>{ln.technicianName}</Text>
                        <Text style={styles.historyItemRut}>{ln.technicianRut}</Text>
                      </View>
                      <Badge
                        label={isReturned ? (isDamaged ? "Dañado al Retornar" : "Bueno") : "En Terreno"}
                        tone={!isReturned ? "info" : isDamaged ? "danger" : "ok"}
                        size="sm"
                      />
                    </View>

                    <Text style={styles.historyItemProj}>
                      Faena: {ln.projectName} ({ln.projectCode})
                    </Text>

                    <View style={styles.historyDatesRow}>
                      <Text style={styles.historyDateTxt}>
                        Salida: <Text style={{ fontWeight: "bold" }}>{formatDate(ln.loanDate)}</Text>
                      </Text>
                      <Text style={styles.historyDateTxt}>
                        Retorno: <Text style={{ fontWeight: "bold" }}>{ln.returnDate ? formatDate(ln.returnDate) : "En uso"}</Text>
                      </Text>
                    </View>

                    {ln.returnNotes && (
                      <View style={styles.historyNotesBox}>
                        <Text style={styles.historyNotesTxt}>Obs: "{ln.returnNotes}"</Text>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyNote}>Sin registros de préstamos en el historial.</Text>
            )}
          </ScrollView>
        )}

        {/* 5.B. Historial de Mantenciones */}
        {historyTab === "mantenciones" && (
          <ScrollView style={{ maxHeight: 380 }}>
            {selectedToolHistory?.maintenances && selectedToolHistory.maintenances.length > 0 ? (
              selectedToolHistory.maintenances.map((mn) => (
                <View key={mn.id} style={styles.historyItemCard}>
                  <View style={styles.historyItemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyItemTech}>
                        {mn.type.toUpperCase()} • {mn.workshop}
                      </Text>
                      <Text style={styles.historyItemRut}>Fecha: {formatDate(mn.date)}</Text>
                    </View>
                    <Badge label={formatCLP(mn.cost)} tone="mute" size="sm" />
                  </View>

                  <Text style={styles.historyItemProj}>{mn.description}</Text>

                  <View style={styles.historyDatesRow}>
                    <Text style={styles.historyDateTxt}>
                      Próxima programada: <Text style={{ fontWeight: "bold" }}>{formatDate(mn.nextMaintenanceDate)}</Text>
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyNote}>Sin registros de mantenciones realizadas.</Text>
            )}
          </ScrollView>
        )}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cerrar Historial"
            variant="ghost"
            onPress={() => setSelectedToolHistory(null)}
            style={{ width: "100%", height: 44 }}
          />
        </View>
      </ModalView>
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
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  heading: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  subHeading: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    maxWidth: 260,
  },
  kpisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  kpiCardDanger: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  kpiVal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  kpiLbl: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.md,
    height: 42,
    marginBottom: theme.spacing.xs,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  filterChipDanger: {
    borderColor: theme.colors.danger,
  },
  filterChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    fontWeight: "500",
  },
  filterChipTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  toolCard: {
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  overdueCard: {
    borderLeftColor: theme.colors.danger,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
    backgroundColor: theme.colors.dangerLight,
  },
  nearDueCard: {
    borderLeftColor: theme.colors.warn,
    borderWidth: 1.5,
    borderColor: theme.colors.warn,
  },
  toolTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  toolCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  toolCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 8,
  },
  toolSerial: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  dangerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginLeft: 8,
  },
  dangerPillTxt: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    marginLeft: 2,
  },
  toolName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  toolBrandModel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  assignedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  assignedInfo: {
    marginLeft: 8,
    flex: 1,
  },
  assignedTech: {
    fontSize: 12,
    color: theme.colors.text,
  },
  assignedProj: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  maintenanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 8,
  },
  maintenanceRowOverdue: {
    backgroundColor: theme.colors.dangerLight,
  },
  maintenanceRowNearDue: {
    backgroundColor: theme.colors.warnLight,
  },
  maintCol: {
    flex: 1,
  },
  maintDateLabel: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
  },
  maintDateVal: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: 1,
  },
  overdueDateVal: {
    color: theme.colors.danger,
    fontWeight: "900",
  },
  nearDueDateVal: {
    color: theme.colors.warnDark,
    fontWeight: "bold",
  },
  maintFreqText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  maintBadgeWrapper: {
    alignItems: "flex-end",
  },
  toolActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  historyBtnTxt: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  actionBtnsGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  formRowTwo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calculatedNextBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 10,
  },
  calculatedNextTxt: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    flex: 1,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.xs,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: "bold",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 10,
  },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 6,
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
  infoSummaryBox: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginVertical: 8,
  },
  infoSummaryLine: {
    fontSize: 12,
    color: theme.colors.text,
    marginVertical: 2,
  },
  modalInstruction: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  conditionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  conditionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.surface,
    marginHorizontal: 4,
  },
  conditionBtnBueno: {
    borderColor: theme.colors.ok,
    backgroundColor: theme.colors.okLight,
  },
  conditionBtnDanado: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerLight,
  },
  conditionTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: 4,
  },
  conditionSubtitle: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  historySubTabs: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: 12,
  },
  historySubTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  historySubTabActive: {
    backgroundColor: theme.colors.card,
    elevation: 1,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  historySubTabTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  historySubTabTxtActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  historyItemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyItemTech: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  historyItemRut: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
  },
  historyItemProj: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
    marginTop: 2,
  },
  historyDatesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  historyDateTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
  },
  historyNotesBox: {
    backgroundColor: theme.colors.warnLight,
    padding: 6,
    borderRadius: theme.radius.sm,
    marginTop: 6,
  },
  historyNotesTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.warnDark,
    fontStyle: "italic",
  },
  emptyNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
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
});
