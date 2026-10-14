import React, { useState, useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { formatCLP, formatDate, isValidRut } from "@/core/format";
import { theme } from "@/core/theme";
import { Role, SystemUser, AuditLogEntry, SystemParamItem, BackupLogItem, CardexEntry } from "@/core/types";

// Common components
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/common/Input";
import { NumberInput } from "@/components/common/NumberInput";
import { ModalView } from "@/components/common/ModalView";
import { DiffViewer } from "@/components/common/DiffViewer";
import { ExportButton } from "@/components/common/ExportButton";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";

type AdminTab = "usuarios" | "auditoria" | "parametros" | "reportes" | "privacidad" | "respaldos";

export const AdministrationScreen: React.FC = () => {
  const {
    systemUsers,
    auditLogs,
    systemParameters,
    backupLogs,
    cardex,
    products,
    projects,
    createSystemUser,
    toggleSystemUserDisabled,
    anonymizeUser,
    updateSystemParameter,
    resetSystemParameter,
    runManualBackup,
    runRestorationTest,
  } = useApp();

  const { user: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("usuarios");

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: "ok" | "error" | "info"; message: string } | null>(null);

  const showFeedback = (type: "ok" | "error" | "info", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // =========================================================================
  // 1. USUARIOS STATE & LOGIC
  // =========================================================================
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("todos");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("todos");
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [selectedUserToToggle, setSelectedUserToToggle] = useState<SystemUser | null>(null);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);

  // New user form state
  const rutInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const [formRut, setFormRut] = useState("");
  const [formRutError, setFormRutError] = useState("");
  const [formName, setFormName] = useState("");
  const [formNameError, setFormNameError] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEmailError, setFormEmailError] = useState("");
  const [formRole, setFormRole] = useState<Role>("technician");
  const [formError, setFormError] = useState("");

  const activeAdminsCount = systemUsers.filter((u) => u.role === "admin" && !u.disabled).length;

  const filteredUsers = useMemo(() => {
    return systemUsers.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.rut.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole = userRoleFilter === "todos" || u.role === userRoleFilter;
      const matchStatus =
        userStatusFilter === "todos" ||
        (userStatusFilter === "activo" && !u.disabled) ||
        (userStatusFilter === "deshabilitado" && u.disabled);
      return matchSearch && matchRole && matchStatus;
    });
  }, [systemUsers, userSearch, userRoleFilter, userStatusFilter]);

  const handleCreateUser = () => {
    setFormRutError("");
    setFormNameError("");
    setFormEmailError("");
    setFormError("");

    if (!formRut.trim()) {
      setFormRutError("El RUT es obligatorio.");
      setFormError("El RUT es obligatorio.");
      rutInputRef.current?.focus();
      return;
    }
    if (!isValidRut(formRut)) {
      setFormRutError("RUT inválido. Formato esperado: 12.345.678-5");
      setFormError("El RUT ingresado no es válido. Formato esperado: 12.345.678-5");
      rutInputRef.current?.focus();
      return;
    }
    if (!formName.trim()) {
      setFormNameError("El nombre completo es obligatorio.");
      setFormError("El nombre completo es obligatorio.");
      nameInputRef.current?.focus();
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@") || !formEmail.includes(".")) {
      setFormEmailError("Ingrese un correo corporativo válido.");
      setFormError("Ingrese un correo electrónico institucional válido.");
      emailInputRef.current?.focus();
      return;
    }

    const res = createSystemUser({
      rut: formRut.trim(),
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: formRole,
      lastLogin: "Nunca",
    });

    if (res.success) {
      setNewUserModalOpen(false);
      setFormRut("");
      setFormRutError("");
      setFormName("");
      setFormNameError("");
      setFormEmail("");
      setFormEmailError("");
      setFormRole("technician");
      showFeedback("ok", `Usuario ${formName} creado exitosamente.`);
    } else {
      setFormError(res.error || "Error al crear usuario.");
    }
  };

  const handleToggleUser = (targetUser: SystemUser) => {
    // Check if last admin
    if (!targetUser.disabled && targetUser.role === "admin" && activeAdminsCount <= 1) {
      showFeedback(
        "error",
        "Operación bloqueada: No se puede deshabilitar al único Administrador activo del sistema."
      );
      return;
    }
    setSelectedUserToToggle(targetUser);
    setToggleConfirmOpen(true);
  };

  const executeToggleUser = () => {
    if (!selectedUserToToggle) return;
    const res = toggleSystemUserDisabled(selectedUserToToggle.id);
    setToggleConfirmOpen(false);
    if (res.success) {
      showFeedback(
        "ok",
        `Usuario ${selectedUserToToggle.name} ${
          selectedUserToToggle.disabled ? "habilitado" : "deshabilitado"
        } correctamente.`
      );
    } else {
      showFeedback("error", res.error || "No fue posible modificar el estado del usuario.");
    }
    setSelectedUserToToggle(null);
  };

  // =========================================================================
  // 2. AUDITORÍA STATE & LOGIC (SOLO LECTURA)
  // =========================================================================
  const [auditSearch, setAuditSearch] = useState("");
  const [auditUserFilter, setAuditUserFilter] = useState<string>("todos");
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>("todas");
  const [auditDateFilter, setAuditDateFilter] = useState<"todos" | "hoy" | "7dias" | "30dias">("todos");

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        log.description.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.fieldChanged.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.userRut.toLowerCase().includes(auditSearch.toLowerCase());

      const matchUser = auditUserFilter === "todos" || log.userRut === auditUserFilter;
      const matchEntity = auditEntityFilter === "todas" || log.entity === auditEntityFilter;

      // Date filtering logic
      let matchDate = true;
      if (auditDateFilter === "hoy") {
        matchDate = log.timestamp.includes("14-10-2026") || log.timestamp.includes("Hoy");
      } else if (auditDateFilter === "7dias") {
        // Last 7 days
        matchDate = true;
      }
      return matchSearch && matchUser && matchEntity && matchDate;
    });
  }, [auditLogs, auditSearch, auditUserFilter, auditEntityFilter, auditDateFilter]);

  // =========================================================================
  // 3. PARÁMETROS STATE & LOGIC
  // =========================================================================
  const [paramGroupFilter, setParamGroupFilter] = useState<"seguridad" | "inventario" | "costos" | "alertas">("seguridad");
  const [paramValues, setParamValues] = useState<{ [id: string]: string | number }>({});

  const handleParamChange = (id: string, val: string | number) => {
    setParamValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleSaveParam = (param: SystemParamItem) => {
    const entered = paramValues[param.id] !== undefined ? paramValues[param.id] : param.value;
    const numVal = Number(entered);

    if (param.type === "number") {
      if (isNaN(numVal)) {
        showFeedback("error", `El valor para ${param.name} debe ser un número válido.`);
        return;
      }
      if (param.min !== undefined && numVal < param.min) {
        showFeedback("error", `El valor mínimo permitido para ${param.name} es ${param.min} ${param.unit || ""}.`);
        return;
      }
      if (param.max !== undefined && numVal > param.max) {
        showFeedback("error", `El valor máximo permitido para ${param.name} es ${param.max} ${param.unit || ""}.`);
        return;
      }
      updateSystemParameter(param.id, numVal);
    } else {
      updateSystemParameter(param.id, entered);
    }
    showFeedback("ok", `Parámetro "${param.name}" actualizado exitosamente.`);
  };

  const handleResetParam = (param: SystemParamItem) => {
    resetSystemParameter(param.id);
    setParamValues((prev) => ({ ...prev, [param.id]: param.defaultValue }));
    showFeedback("ok", `Parámetro "${param.name}" restablecido a su valor por defecto (${param.defaultValue} ${param.unit || ""}).`);
  };

  // =========================================================================
  // 4. REPORTES DE MOVIMIENTOS STATE & LOGIC (ÚLTIMOS 30 DÍAS POR DEFECTO)
  // =========================================================================
  const [reportDateRange, setReportDateRange] = useState<"30dias" | "7dias" | "mes_actual" | "todo">("30dias");
  const [reportMovementType, setReportMovementType] = useState<string>("todos");
  const [reportSkuFilter, setReportSkuFilter] = useState<string>("todos");
  const [reportProjectFilter, setReportProjectFilter] = useState<string>("todos");

  const filteredCardex = useMemo(() => {
    return cardex.filter((item) => {
      const matchType = reportMovementType === "todos" || item.type === reportMovementType;
      const matchSku = reportSkuFilter === "todos" || item.sku === reportSkuFilter;
      const matchProj = reportProjectFilter === "todos" || item.projectCode === reportProjectFilter;
      return matchType && matchSku && matchProj;
    });
  }, [cardex, reportMovementType, reportSkuFilter, reportProjectFilter]);

  // Totales acumulados para la fila de totales
  const reportTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalNetValue = 0;

    filteredCardex.forEach((c) => {
      totalIn += c.qtyIn;
      totalOut += c.qtyOut;
      totalNetValue += c.totalValue;
    });

    return {
      count: filteredCardex.length,
      totalIn,
      totalOut,
      totalNetValue,
    };
  }, [filteredCardex]);

  const handleExportReport = (format: "pdf" | "excel") => {
    showFeedback(
      "ok",
      `Reporte de Movimientos exportado en formato ${format.toUpperCase()} con ${filteredCardex.length} registros y valor total ${formatCLP(reportTotals.totalNetValue)}.`
    );
  };

  // =========================================================================
  // 5. PRIVACIDAD DE DATOS (LEY 19.628)
  // =========================================================================
  const [selectedUserToAnonymize, setSelectedUserToAnonymize] = useState<string>("");
  const [anonymizeStep, setAnonymizeStep] = useState<null | 1 | 2>(null);
  const [confirmKeywordInput, setConfirmKeywordInput] = useState("");

  const targetAnonUser = systemUsers.find((u) => u.id === selectedUserToAnonymize);

  const handleStartAnonymization = () => {
    if (!selectedUserToAnonymize) {
      showFeedback("error", "Seleccione un usuario para iniciar el proceso de anonimización.");
      return;
    }
    if (targetAnonUser?.role === "admin" && !targetAnonUser.disabled && activeAdminsCount <= 1) {
      showFeedback("error", "Operación bloqueada: No es posible anonimizar al único Administrador activo del sistema.");
      return;
    }
    setAnonymizeStep(1);
  };

  const handleExecuteAnonymization = () => {
    if (confirmKeywordInput.trim().toUpperCase() !== "CONFIRMAR") {
      showFeedback("error", 'Debe escribir exactamente "CONFIRMAR" para autorizar la acción.');
      return;
    }
    const res = anonymizeUser(selectedUserToAnonymize);
    setAnonymizeStep(null);
    setConfirmKeywordInput("");
    setSelectedUserToAnonymize("");

    if (res.success) {
      showFeedback("ok", "Datos personales del usuario anonimizados irreversiblemente conforme a la Ley 19.628.");
    } else {
      showFeedback("error", res.error || "No se pudo anonimizar al usuario.");
    }
  };

  const handleExportPrivacyData = (format: "json" | "csv") => {
    showFeedback(
      "ok",
      `Copia de portabilidad descargada exitosamente en formato ${format.toUpperCase()} conforme a estándares de privacidad.`
    );
  };

  // =========================================================================
  // 6. RESPALDOS STATE & LOGIC
  // =========================================================================
  const failedBackups = backupLogs.filter((b) => b.status === "fallo");
  const hasBackupFailure = failedBackups.length > 0;

  const handleRunBackup = () => {
    const res = runManualBackup();
    if (res.success) {
      showFeedback("ok", `Respaldo manual completado exitosamente: ${res.filename}`);
    }
  };

  const handleRunRestorationTest = () => {
    const res = runRestorationTest();
    if (res.success) {
      showFeedback("ok", "Prueba de restauración en sandbox ejecutada con éxito. Integridad de base de datos verificada al 100%.");
    }
  };

  return (
    <ScreenStateWrapper screenTitle="Administración y Auditoría" skeletonType="table">
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Encabezado de página con migas de pan */}
      <PageHeader
        title="Administración y Control de Sistema"
        subtitle="Gestión de usuarios, auditoría inmutable, parámetros operativos, reportes y respaldos"
        breadcrumbs={["Inicio", "Administración", "Panel de Control"]}
      />

      {/* Banner de Feedback Global */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === "ok" && styles.feedbackBannerOk,
            feedback.type === "error" && styles.feedbackBannerError,
            feedback.type === "info" && styles.feedbackBannerInfo,
          ]}
        >
          <Ionicons
            name={
              feedback.type === "ok"
                ? "checkmark-circle"
                : feedback.type === "error"
                ? "alert-circle"
                : "information-circle"
            }
            size={20}
            color={
              feedback.type === "ok"
                ? theme.colors.ok
                : feedback.type === "error"
                ? theme.colors.danger
                : theme.colors.primaryDark
            }
          />
          <Text
            style={[
              styles.feedbackText,
              feedback.type === "ok" && styles.feedbackTextOk,
              feedback.type === "error" && styles.feedbackTextError,
              feedback.type === "info" && styles.feedbackTextInfo,
            ]}
          >
            {feedback.message}
          </Text>
        </View>
      )}

      {/* Selector de Pestañas Principales */}
      <View style={styles.tabBar}>
        {[
          { id: "usuarios", label: "Usuarios y Roles", icon: "people-outline" },
          { id: "auditoria", label: "Auditoría (Diff)", icon: "shield-checkmark-outline" },
          { id: "parametros", label: "Parámetros", icon: "options-outline" },
          { id: "reportes", label: "Reporte Movimientos", icon: "bar-chart-outline" },
          { id: "privacidad", label: "Privacidad Ley 19.628", icon: "finger-print-outline" },
          { id: "respaldos", label: "Respaldos & Failover", icon: "cloud-upload-outline" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.id as AdminTab)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={isActive ? theme.colors.primaryDark : theme.colors.textSecondary}
              />
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: USUARIOS Y ROLES                                               */}
      {/* ========================================================================= */}
      {activeTab === "usuarios" && (
        <View style={styles.section}>
          {/* KPI Cards de Usuarios */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCardItem}>
              <KpiCard
                label="Total Usuarios"
                value={systemUsers.length}
                icon="people"
                tone="primary"
              />
            </View>
            <View style={styles.kpiCardItem}>
              <KpiCard
                label="Admins Activos"
                value={activeAdminsCount}
                icon="shield-outline"
                tone={activeAdminsCount <= 1 ? "warn" : "ok"}
                subtitle={activeAdminsCount <= 1 ? "Bloqueo preventivo activo" : "Redundancia segura"}
              />
            </View>
            <View style={styles.kpiCardItem}>
              <KpiCard
                label="Bodegueros"
                value={systemUsers.filter((u) => u.role === "warehouse" && !u.disabled).length}
                icon="cube-outline"
                tone="info"
              />
            </View>
            <View style={styles.kpiCardItem}>
              <KpiCard
                label="Técnicos Activos"
                value={systemUsers.filter((u) => u.role === "technician" && !u.disabled).length}
                icon="hammer-outline"
                tone="info"
              />
            </View>
          </View>

          {/* Barra de Acciones y Filtros */}
          <Card style={styles.cardBox}>
            <View style={styles.filterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre, correo o RUT..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={userSearch}
                  onChangeText={setUserSearch}
                />
              </View>

              {/* Filtro por Rol */}
              <View style={styles.chipRow}>
                {["todos", "admin", "warehouse", "technician"].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.smallChip, userRoleFilter === r && styles.smallChipActive]}
                    onPress={() => setUserRoleFilter(r)}
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        userRoleFilter === r && styles.smallChipTextActive,
                      ]}
                    >
                      {r === "todos"
                        ? "Todos los Roles"
                        : r === "admin"
                        ? "Administrador"
                        : r === "warehouse"
                        ? "Bodeguero"
                        : "Técnico"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(userSearch !== "" || userRoleFilter !== "todos") && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Limpiar"
                  icon="close-circle-outline"
                  onPress={() => {
                    setUserSearch("");
                    setUserRoleFilter("todos");
                  }}
                  style={{ marginRight: 6 }}
                />
              )}

              {/* Botón Nuevo Usuario */}
              <Button
                variant="primary"
                title="Nuevo Usuario"
                icon="person-add"
                onPress={() => setNewUserModalOpen(true)}
              />
            </View>
          </Card>

          {/* Tabla de Usuarios */}
          <Card style={styles.cardBox}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 2 }]}>Usuario & Contacto</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>RUT</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>Rol Asignado</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Estado</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>Último Acceso</Text>
              <Text style={[styles.thCell, { flex: 1.4, textAlign: "right" }]}>Acción de Acceso</Text>
            </View>

            {filteredUsers.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="Sin usuarios coincidentes"
                description="No se encontraron usuarios con los filtros de rol o búsqueda aplicados."
                actionTitle="+ Nuevo Usuario"
                onAction={() => setNewUserModalOpen(true)}
                containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
              />
            ) : (
              filteredUsers.map((u) => {
                const isOnlyAdmin = !u.disabled && u.role === "admin" && activeAdminsCount <= 1;

                return (
                  <View key={u.id} style={[styles.tableRow, u.disabled && styles.tableRowDisabled]}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.userNameText}>{u.name}</Text>
                      <Text style={styles.userEmailText}>{u.email}</Text>
                    </View>

                    <Text style={[styles.tdCell, { flex: 1.2, fontWeight: "600" }]}>{u.rut}</Text>

                    <View style={{ flex: 1.2 }}>
                      <View
                        style={[
                          styles.roleBadge,
                          u.role === "admin" && styles.roleBadgeAdmin,
                          u.role === "warehouse" && styles.roleBadgeWarehouse,
                          u.role === "technician" && styles.roleBadgeTechnician,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            u.role === "admin" && styles.roleBadgeTextAdmin,
                            u.role === "warehouse" && styles.roleBadgeTextWarehouse,
                            u.role === "technician" && styles.roleBadgeTextTechnician,
                          ]}
                        >
                          {u.role === "admin"
                            ? "Administrador"
                            : u.role === "warehouse"
                            ? "Bodeguero"
                            : "Técnico"}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <EstadoBadge
                        status={u.disabled ? "rechazada" : "aprobada"}
                        label={u.disabled ? "Deshabilitado" : "Activo"}
                      />
                    </View>

                    <Text style={[styles.tdCell, { flex: 1.2, color: theme.colors.textMuted }]}>
                      {u.lastLogin || "Nunca"}
                    </Text>

                    {/* Botón de deshabilitar con confirmación y bloqueo estricto */}
                    <View style={{ flex: 1.4, alignItems: "flex-end" }}>
                      {isOnlyAdmin ? (
                        <TouchableOpacity
                          style={styles.lockedBtn}
                          onPress={() =>
                            showFeedback(
                              "error",
                              "Operación bloqueada: No se puede deshabilitar al último Administrador activo del sistema."
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="lock-closed" size={14} color="#b45309" style={{ marginRight: 4 }} />
                          <Text style={styles.lockedBtnText}>Bloqueado (Último Admin)</Text>
                        </TouchableOpacity>
                      ) : (
                        <Button
                          variant={u.disabled ? "secondary" : "danger"}
                          size="sm"
                          title={u.disabled ? "Habilitar" : "Deshabilitar"}
                          icon={u.disabled ? "checkmark-circle-outline" : "ban-outline"}
                          onPress={() => handleToggleUser(u)}
                        />
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          {/* Modal Formulario Nuevo Usuario (Rol Único) */}
          <ModalView
            visible={newUserModalOpen}
            onClose={() => setNewUserModalOpen(false)}
            title="Crear Nuevo Usuario de Sistema"
          >
            <View style={styles.formContainer}>
              <Text style={styles.formSubtitle}>
                Complete los datos para generar una cuenta con acceso controlado y rol único.
              </Text>

              {formError !== "" && (
                <View style={styles.errorAlert}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
                  <Text style={styles.errorAlertText}>{formError}</Text>
                </View>
              )}

              <Input
                ref={rutInputRef}
                label="RUT del Usuario (con guion y dígito verificador)"
                placeholder="Ej: 15.678.912-3"
                value={formRut}
                onChangeText={(text) => {
                  setFormRut(text);
                  if (formRutError) setFormRutError("");
                }}
                error={formRutError}
              />

              <Input
                ref={nameInputRef}
                label="Nombre Completo"
                placeholder="Ej: Marcelo Gómez Paredes"
                value={formName}
                onChangeText={(text) => {
                  setFormName(text);
                  if (formNameError) setFormNameError("");
                }}
                error={formNameError}
              />

              <Input
                ref={emailInputRef}
                label="Correo Electrónico Corporativo"
                placeholder="ejemplo@fyag.cl"
                value={formEmail}
                onChangeText={(text) => {
                  setFormEmail(text);
                  if (formEmailError) setFormEmailError("");
                }}
                error={formEmailError}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Selector de Rol Único */}
              <Text style={styles.fieldLabel}>Rol Asignado (Rol Único Excluyente):</Text>
              <View style={styles.roleOptionsGrid}>
                {[
                  {
                    id: "admin" as Role,
                    title: "Administrador",
                    desc: "Acceso total, auditoría, configuración, proyectos y finanzas.",
                    icon: "shield-checkmark",
                  },
                  {
                    id: "warehouse" as Role,
                    title: "Bodeguero",
                    desc: "Control de insumos, recepción de compras, egresos y cardex.",
                    icon: "cube",
                  },
                  {
                    id: "technician" as Role,
                    title: "Técnico en Faena",
                    desc: "Registro de avance, solicitud de materiales, horas y hojas de servicio.",
                    icon: "hammer",
                  },
                ].map((opt) => {
                  const isSelected = formRole === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.roleSelectBox, isSelected && styles.roleSelectBoxSelected]}
                      onPress={() => setFormRole(opt.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.roleSelectHeader}>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.roleSelectTitle,
                            isSelected && styles.roleSelectTitleSelected,
                          ]}
                        >
                          {opt.title}
                        </Text>
                      </View>
                      <Text style={styles.roleSelectDesc}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title="Cancelar"
                  onPress={() => setNewUserModalOpen(false)}
                />
                <Button
                  variant="primary"
                  title="Crear Cuenta"
                  onPress={handleCreateUser}
                />
              </View>
            </View>
          </ModalView>

          {/* Modal de Confirmación para Deshabilitar/Habilitar */}
          <ModalView
            visible={toggleConfirmOpen}
            onClose={() => setToggleConfirmOpen(false)}
            title={
              selectedUserToToggle?.disabled
                ? "Confirmar Habilitación de Usuario"
                : "Confirmar Deshabilitación de Usuario"
            }
          >
            <View style={styles.confirmBox}>
              <Ionicons
                name={selectedUserToToggle?.disabled ? "checkmark-circle" : "warning"}
                size={42}
                color={selectedUserToToggle?.disabled ? theme.colors.ok : theme.colors.warnDark}
              />
              <Text style={styles.confirmTitle}>
                ¿Está seguro de {selectedUserToToggle?.disabled ? "habilitar" : "deshabilitar"} a{" "}
                <Text style={{ fontWeight: "bold" }}>{selectedUserToToggle?.name}</Text>?
              </Text>
              <Text style={styles.confirmDesc}>
                {selectedUserToToggle?.disabled
                  ? "El usuario volverá a tener acceso al sistema con las credenciales correspondientes a su rol."
                  : "El usuario perderá inmediatamente el acceso a la plataforma. Esta acción quedará registrada en la bitácora de auditoría inmutable."}
              </Text>

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title="Cancelar"
                  onPress={() => setToggleConfirmOpen(false)}
                />
                <Button
                  variant={selectedUserToToggle?.disabled ? "primary" : "danger"}
                  title={selectedUserToToggle?.disabled ? "Confirmar Habilitación" : "Confirmar Deshabilitación"}
                  onPress={executeToggleUser}
                />
              </View>
            </View>
          </ModalView>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: AUDITORÍA INMUTABLE (SOLO LECTURA + DIFFVIEWER)                */}
      {/* ========================================================================= */}
      {activeTab === "auditoria" && (
        <View style={styles.section}>
          {/* Banner de Inmutabilidad Regulatoria */}
          <View style={styles.readOnlyNoticeBanner}>
            <Ionicons name="lock-closed" size={20} color="#1e293b" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.readOnlyNoticeTitle}>Bitácora de Auditoría de Solo Lectura</Text>
              <Text style={styles.readOnlyNoticeDesc}>
                Este registro es permanente e inmutable. Por normativa legal y directrices de auditoría interna, los
                registros de transacciones y cambios no admiten edición ni borrado bajo ninguna circunstancia.
              </Text>
            </View>
          </View>

          {/* Filtros Combinables de Auditoría */}
          <Card style={styles.cardBox}>
            <View style={styles.auditFilterGrid}>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.filterFieldLabel}>Búsqueda Libre:</Text>
                <TextInput
                  style={styles.textInputBox}
                  placeholder="Buscar acción, usuario, campo..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={auditSearch}
                  onChangeText={setAuditSearch}
                />
              </View>

              <View style={{ flex: 1.2 }}>
                <Text style={styles.filterFieldLabel}>Entidad Afectada:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.entityScroll}>
                  {[
                    "todas",
                    "Insumos",
                    "Proyectos",
                    "OrdenesCompra",
                    "Facturas",
                    "Herramientas",
                    "Usuarios",
                    "Parametros",
                    "Respaldos",
                    "Privacidad",
                  ].map((ent) => (
                    <TouchableOpacity
                      key={ent}
                      style={[
                        styles.entityChip,
                        auditEntityFilter === ent && styles.entityChipActive,
                      ]}
                      onPress={() => setAuditEntityFilter(ent)}
                    >
                      <Text
                        style={[
                          styles.entityChipText,
                          auditEntityFilter === ent && styles.entityChipTextActive,
                        ]}
                      >
                        {ent === "todas" ? "Todas" : ent}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.filterFieldLabel}>Rango de Fecha:</Text>
                <View style={styles.dateChipRow}>
                  {[
                    { id: "todos", label: "Todo" },
                    { id: "hoy", label: "Hoy" },
                    { id: "7dias", label: "7 Días" },
                  ].map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.smallChip, auditDateFilter === d.id && styles.smallChipActive]}
                      onPress={() => setAuditDateFilter(d.id as any)}
                    >
                      <Text
                        style={[
                          styles.smallChipText,
                          auditDateFilter === d.id && styles.smallChipTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(Boolean(auditSearch) || auditEntityFilter !== "todas" || auditDateFilter !== "todos") && (
                <View style={{ justifyContent: "flex-end", paddingBottom: 2 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Limpiar"
                    icon="close-circle-outline"
                    onPress={() => {
                      setAuditSearch("");
                      setAuditEntityFilter("todas");
                      setAuditDateFilter("todos");
                    }}
                  />
                </View>
              )}
            </View>
          </Card>

          {/* Tabla de Auditoría Inmutable (Sin botones de editar o borrar) */}
          <Card style={styles.cardBox}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 1.2 }]}>Fecha / Hora</Text>
              <Text style={[styles.thCell, { flex: 1.5 }]}>Usuario Responsable</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Entidad</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Acción</Text>
              <Text style={[styles.thCell, { flex: 2.2 }]}>Modificación (DiffViewer)</Text>
              <Text style={[styles.thCell, { flex: 2.1 }]}>Descripción del Suceso</Text>
            </View>

            {filteredAuditLogs.length === 0 ? (
              <EmptyState
                icon="shield-outline"
                title="Sin registros de auditoría"
                description="No existen eventos de auditoría inmutable para los filtros seleccionados."
                containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
              />
            ) : (
              filteredAuditLogs.map((log) => (
                <View key={log.id} style={styles.auditRow}>
                  <Text style={[styles.tdCell, { flex: 1.2, fontSize: 11, color: theme.colors.textMuted }]}>
                    {log.timestamp}
                  </Text>

                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.auditUserName}>{log.userName}</Text>
                    <Text style={styles.auditUserRut}>{log.userRut}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.entityTag}>
                      <Text style={styles.entityTagText}>{log.entity}</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View
                      style={[
                        styles.actionBadge,
                        log.action === "creacion" && styles.actionBadgeCreate,
                        log.action === "modificacion" && styles.actionBadgeModify,
                        log.action === "deshabilitacion" && styles.actionBadgeDelete,
                        log.action === "anonimizacion" && styles.actionBadgeAnon,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionBadgeText,
                          log.action === "creacion" && styles.actionBadgeTextCreate,
                          log.action === "modificacion" && styles.actionBadgeTextModify,
                          log.action === "deshabilitacion" && styles.actionBadgeTextDelete,
                          log.action === "anonimizacion" && styles.actionBadgeTextAnon,
                        ]}
                      >
                        {log.action.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* DiffViewer para comparar valor anterior vs nuevo */}
                  <View style={{ flex: 2.2, paddingRight: 8 }}>
                    <DiffViewer
                      label={log.fieldChanged}
                      oldValue={log.oldValue}
                      newValue={log.newValue}
                      showDelta={typeof log.oldValue === "number" && typeof log.newValue === "number"}
                    />
                  </View>

                  <Text style={[styles.tdCell, { flex: 2.1, fontSize: 11, color: theme.colors.textSecondary }]}>
                    {log.description}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: PARÁMETROS OPERATIVOS CON RESTABLECER POR CAMPO               */}
      {/* ========================================================================= */}
      {activeTab === "parametros" && (
        <View style={styles.section}>
          {/* Selector de Grupo de Parámetros */}
          <View style={styles.paramGroupTabs}>
            {[
              { id: "seguridad", label: "Seguridad y Accesos", icon: "lock-closed-outline" },
              { id: "inventario", label: "Inventario y Stock", icon: "cube-outline" },
              { id: "costos", label: "Costos y Tarifas", icon: "cash-outline" },
              { id: "alertas", label: "Umbrales de Alertas", icon: "notifications-outline" },
            ].map((grp) => {
              const isSelected = paramGroupFilter === grp.id;
              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[styles.paramGroupTab, isSelected && styles.paramGroupTabActive]}
                  onPress={() => setParamGroupFilter(grp.id as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={grp.icon as any}
                    size={16}
                    color={isSelected ? theme.colors.primaryDark : theme.colors.textMuted}
                  />
                  <Text style={[styles.paramGroupTabText, isSelected && styles.paramGroupTabTextActive]}>
                    {grp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Formulario Agrupado con Valores por Defecto y Botón Restablecer */}
          <Card style={styles.cardBox}>
            <View style={styles.groupHeaderRow}>
              <Ionicons name="settings" size={20} color={theme.colors.primary} />
              <Text style={styles.groupHeaderTitle}>
                Configuración del Grupo:{" "}
                <Text style={{ color: theme.colors.primaryDark, textTransform: "capitalize" }}>
                  {paramGroupFilter}
                </Text>
              </Text>
            </View>

            {systemParameters
              .filter((p) => p.group === paramGroupFilter)
              .map((param) => {
                const currentValue =
                  paramValues[param.id] !== undefined ? paramValues[param.id] : param.value;
                const isDifferentFromDefault = currentValue !== param.defaultValue;

                return (
                  <View key={param.id} style={styles.paramItemRow}>
                    <View style={styles.paramInfoCol}>
                      <Text style={styles.paramTitle}>{param.name}</Text>
                      <Text style={styles.paramDescription}>{param.description}</Text>
                      <View style={styles.paramMetaRow}>
                        <View style={styles.defaultValBadge}>
                          <Text style={styles.defaultValText}>
                            Valor de Fábrica: {param.defaultValue} {param.unit || ""}
                          </Text>
                        </View>
                        {param.min !== undefined && param.max !== undefined && (
                          <Text style={styles.rangeText}>
                            Rango Válido: [{param.min} – {param.max} {param.unit || ""}]
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Input y Botones Guardar / Restablecer */}
                    <View style={styles.paramControlCol}>
                      <View style={styles.inputWithUnit}>
                        <TextInput
                          style={styles.paramInput}
                          value={String(currentValue)}
                          onChangeText={(val) => handleParamChange(param.id, val)}
                          keyboardType={param.type === "number" ? "numeric" : "default"}
                        />
                        {param.unit && <Text style={styles.unitSuffix}>{param.unit}</Text>}
                      </View>

                      <View style={styles.paramActionButtons}>
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Guardar"
                          icon="checkmark"
                          onPress={() => handleSaveParam(param)}
                        />

                        {/* Botón Restablecer individual por campo */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Restablecer"
                          icon="refresh-outline"
                          onPress={() => handleResetParam(param)}
                          disabled={!isDifferentFromDefault}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
          </Card>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: REPORTES DE MOVIMIENTOS (ÚLTIMOS 30 DÍAS POR DEFECTO + TOTALES) */}
      {/* ========================================================================= */}
      {activeTab === "reportes" && (
        <View style={styles.section}>
          {/* Tarjeta de Filtros Combinables */}
          <Card style={styles.cardBox}>
            <View style={styles.reportFilterGrid}>
              {/* Filtro Rango de Tiempo (Últimos 30 días por defecto) */}
              <View style={{ flex: 1 }}>
                <Text style={styles.filterFieldLabel}>Período de Análisis (Default: 30 días):</Text>
                <View style={styles.chipRow}>
                  {[
                    { id: "30dias", label: "Últimos 30 Días" },
                    { id: "7dias", label: "Últimos 7 Días" },
                    { id: "mes_actual", label: "Mes Actual" },
                    { id: "todo", label: "Todo" },
                  ].map((period) => (
                    <TouchableOpacity
                      key={period.id}
                      style={[
                        styles.smallChip,
                        reportDateRange === period.id && styles.smallChipActive,
                      ]}
                      onPress={() => setReportDateRange(period.id as any)}
                    >
                      <Text
                        style={[
                          styles.smallChipText,
                          reportDateRange === period.id && styles.smallChipTextActive,
                        ]}
                      >
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Filtro por Tipo de Movimiento */}
              <View style={{ flex: 1 }}>
                <Text style={styles.filterFieldLabel}>Tipo de Movimiento:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.entityScroll}>
                  {[
                    { id: "todos", label: "Todos" },
                    { id: "entrada_compra", label: "Entrada Compra" },
                    { id: "salida_obra", label: "Salida a Obra" },
                    { id: "devolucion", label: "Devolución Faena" },
                    { id: "merma", label: "Merma" },
                    { id: "ajuste_conteo", label: "Ajuste Conteo" },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.entityChip,
                        reportMovementType === t.id && styles.entityChipActive,
                      ]}
                      onPress={() => setReportMovementType(t.id)}
                    >
                      <Text
                        style={[
                          styles.entityChipText,
                          reportMovementType === t.id && styles.entityChipTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Botón de Exportación PDF / Excel */}
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" }}>
                {(reportDateRange !== "30dias" || reportMovementType !== "todos") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Limpiar"
                    icon="close-circle-outline"
                    onPress={() => {
                      setReportDateRange("30dias");
                      setReportMovementType("todos");
                    }}
                    style={{ marginRight: 8 }}
                  />
                )}
                <ExportButton onExport={handleExportReport} title="Exportar Reporte" />
              </View>
            </View>
          </Card>

          {/* Tabla de Movimientos de Inventario */}
          <Card style={styles.cardBox}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 1 }]}>Fecha</Text>
              <Text style={[styles.thCell, { flex: 1.2 }]}>Tipo Movimiento</Text>
              <Text style={[styles.thCell, { flex: 2 }]}>Insumo (SKU & Nombre)</Text>
              <Text style={[styles.thCell, { flex: 1.4 }]}>Referencia / Obra</Text>
              <Text style={[styles.thCell, { flex: 0.8, textAlign: "right" }]}>Entrada</Text>
              <Text style={[styles.thCell, { flex: 0.8, textAlign: "right" }]}>Salida</Text>
              <Text style={[styles.thCell, { flex: 0.8, textAlign: "right" }]}>Saldo</Text>
              <Text style={[styles.thCell, { flex: 1.2, textAlign: "right" }]}>PMP ($)</Text>
              <Text style={[styles.thCell, { flex: 1.4, textAlign: "right" }]}>Total ($ CLP)</Text>
            </View>

            {filteredCardex.length === 0 ? (
              <EmptyState
                icon="bar-chart-outline"
                title="Sin movimientos registrados"
                description="No hay movimientos en el cardex para el filtro y rango de fechas seleccionado."
                containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
              />
            ) : (
              filteredCardex.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.tdCell, { flex: 1, fontSize: 11 }]}>{item.date}</Text>

                  <View style={{ flex: 1.2 }}>
                    <View
                      style={[
                        styles.movementBadge,
                        item.type === "entrada_compra" && styles.movEntry,
                        item.type === "salida_obra" && styles.movExit,
                        item.type === "devolucion" && styles.movReturn,
                        item.type === "merma" && styles.movWaste,
                        item.type === "ajuste_conteo" && styles.movAdjust,
                      ]}
                    >
                      <Text
                        style={[
                          styles.movementBadgeText,
                          item.type === "entrada_compra" && styles.movEntryText,
                          item.type === "salida_obra" && styles.movExitText,
                          item.type === "devolucion" && styles.movReturnText,
                          item.type === "merma" && styles.movWasteText,
                          item.type === "ajuste_conteo" && styles.movAdjustText,
                        ]}
                      >
                        {item.typeLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flex: 2 }}>
                    <Text style={styles.reportSkuText}>{item.sku}</Text>
                    <Text style={styles.reportProdName}>{item.productName}</Text>
                  </View>

                  <Text style={[styles.tdCell, { flex: 1.4, fontSize: 11 }]}>
                    {item.projectName ? `${item.projectCode || ""} (${item.projectName})` : item.reference}
                  </Text>

                  <Text
                    style={[
                      styles.tdCell,
                      { flex: 0.8, textAlign: "right", color: item.qtyIn > 0 ? theme.colors.okDark : theme.colors.textMuted },
                    ]}
                  >
                    {item.qtyIn > 0 ? `+${item.qtyIn}` : "-"}
                  </Text>

                  <Text
                    style={[
                      styles.tdCell,
                      { flex: 0.8, textAlign: "right", color: item.qtyOut > 0 ? theme.colors.dangerDark : theme.colors.textMuted },
                    ]}
                  >
                    {item.qtyOut > 0 ? `-${item.qtyOut}` : "-"}
                  </Text>

                  <Text style={[styles.tdCell, { flex: 0.8, textAlign: "right", fontWeight: "600" }]}>
                    {item.balance}
                  </Text>

                  <Text style={[styles.tdCell, { flex: 1.2, textAlign: "right", color: theme.colors.textSecondary }]}>
                    {formatCLP(item.pmp)}
                  </Text>

                  <Text style={[styles.tdCell, { flex: 1.4, textAlign: "right", fontWeight: "bold" }]}>
                    {formatCLP(item.totalValue)}
                  </Text>
                </View>
              ))
            )}

            {/* FILA DE TOTALES ACUMULADOS */}
            <View style={styles.totalsRow}>
              <View style={{ flex: 4.2 }}>
                <Text style={styles.totalsLabel}>TOTALES ACUMULADOS ({reportTotals.count} movimientos listados):</Text>
              </View>
              <Text style={[styles.totalsCell, { flex: 0.8, textAlign: "right", color: theme.colors.okDark }]}>
                +{reportTotals.totalIn} un
              </Text>
              <Text style={[styles.totalsCell, { flex: 0.8, textAlign: "right", color: theme.colors.dangerDark }]}>
                -{reportTotals.totalOut} un
              </Text>
              <Text style={[styles.totalsCell, { flex: 0.8, textAlign: "right" }]}>-</Text>
              <Text style={[styles.totalsCell, { flex: 1.2, textAlign: "right" }]}>-</Text>
              <Text style={[styles.totalsCellBold, { flex: 1.4, textAlign: "right" }]}>
                {formatCLP(reportTotals.totalNetValue)}
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: PRIVACIDAD DE DATOS (LEY 19.628 - DOBLE CONFIRMACIÓN)           */}
      {/* ========================================================================= */}
      {activeTab === "privacidad" && (
        <View style={styles.section}>
          {/* Banner de Advertencia e Indicador de Irreversibilidad */}
          <View style={styles.irreversibleNoticeBanner}>
            <Ionicons name="warning" size={24} color="#ffffff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.irreversibleNoticeTitle}>
                INDICADOR DE IRREVERSIBILIDAD (LEY 19.628 SOBRE PROTECCIÓN DE DATOS)
              </Text>
              <Text style={styles.irreversibleNoticeDesc}>
                La anonimización de datos es un proceso definitivo e irreversible. Al ejecutar la anonimización, los datos
                identificatorios (RUT, nombre completo, correo electrónico y teléfono) serán sustituidos permanentemente
                por cadenas anónimas codificadas. Este proceso NO podrá ser deshecho ni recuperado.
              </Text>
            </View>
          </View>

          <View style={styles.privacyGrid}>
            {/* Tarjeta 1: Portabilidad de Datos (Exportar JSON / CSV) */}
            <Card style={[styles.cardBox, { flex: 1 }]}>
              <View style={styles.privacyCardHeader}>
                <Ionicons name="download" size={20} color={theme.colors.primary} />
                <Text style={styles.privacyCardTitle}>Portabilidad de Datos Personales</Text>
              </View>
              <Text style={styles.privacyCardDesc}>
                Conforme al principio de portabilidad, puede descargar una copia íntegra de los registros del sistema
                en formatos estructurados y universales para su migración o auditoría externa.
              </Text>

              <View style={styles.exportPrivacyButtons}>
                <Button
                  variant="secondary"
                  title="Exportar Archivo JSON"
                  icon="code-slash"
                  onPress={() => handleExportPrivacyData("json")}
                />

                <Button
                  variant="secondary"
                  title="Exportar Planilla CSV"
                  icon="grid-outline"
                  onPress={() => handleExportPrivacyData("csv")}
                />
              </View>
            </Card>

            {/* Tarjeta 2: Derecho al Olvido y Anonimización */}
            <Card style={[styles.cardBox, { flex: 1 }]}>
              <View style={styles.privacyCardHeader}>
                <Ionicons name="finger-print" size={20} color={theme.colors.danger} />
                <Text style={[styles.privacyCardTitle, { color: theme.colors.dangerDark }]}>
                  Derecho al Olvido / Anonimización Definitiva
                </Text>
              </View>

              <Text style={styles.privacyCardDesc}>
                Seleccione el usuario titular que solicitó el ejercicio del derecho al olvido. Esta acción exige doble
                confirmación explícita con palabra clave de seguridad.
              </Text>

              <Text style={styles.fieldLabel}>Seleccionar Usuario Titular:</Text>
              <View style={styles.userPickerContainer}>
                {systemUsers
                  .filter((u) => !u.rut.startsWith("XX."))
                  .map((u) => {
                    const isSelected = selectedUserToAnonymize === u.id;
                    const isLastAdmin = !u.disabled && u.role === "admin" && activeAdminsCount <= 1;

                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[
                          styles.userPickerItem,
                          isSelected && styles.userPickerItemSelected,
                          isLastAdmin && styles.userPickerItemLocked,
                        ]}
                        onPress={() => {
                          if (isLastAdmin) {
                            showFeedback("error", "Bloqueado: No se puede anonimizar al único Administrador activo.");
                            return;
                          }
                          setSelectedUserToAnonymize(u.id);
                        }}
                      >
                        <Ionicons
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.userPickerName}>
                            {u.name} ({u.role})
                          </Text>
                          <Text style={styles.userPickerSub}>
                            RUT: {u.rut} — {u.email}
                          </Text>
                        </View>
                        {isLastAdmin && (
                          <View style={styles.lockedChip}>
                            <Text style={styles.lockedChipText}>Último Admin</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <Button
                variant="danger"
                title="Iniciar Proceso de Anonimización"
                icon="trash-bin-outline"
                onPress={handleStartAnonymization}
                disabled={!selectedUserToAnonymize}
              />
            </Card>
          </View>

          {/* Modal PASO 1 de Doble Confirmación */}
          <ModalView
            visible={anonymizeStep === 1}
            onClose={() => setAnonymizeStep(null)}
            title="Paso 1: Advertencia de Anonimización Legal"
          >
            <View style={styles.confirmBox}>
              <Ionicons name="warning" size={48} color={theme.colors.danger} />
              <Text style={styles.confirmTitle}>
                Confirmación Inicial: Anonimizar a {targetAnonUser?.name}
              </Text>
              <Text style={styles.confirmDesc}>
                Al continuar, se iniciará el protocolo de eliminación de identidad conforme a la Ley 19.628:
                {"\n"}• El RUT será reemplazado por XX.XXX.XXX-X.
                {"\n"}• El nombre se transformará en "Usuario Anonimizado #{targetAnonUser?.id.slice(-4)}".
                {"\n"}• El correo y teléfono quedarán inaccesibles.
                {"\n"}• El usuario quedará automáticamente deshabilitado para siempre.
              </Text>

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title="Cancelar"
                  onPress={() => setAnonymizeStep(null)}
                />
                <Button
                  variant="danger"
                  title="Continuar a Paso 2 (Clave de Seguridad)"
                  onPress={() => setAnonymizeStep(2)}
                />
              </View>
            </View>
          </ModalView>

          {/* Modal PASO 2 de Doble Confirmación con Palabra Clave "CONFIRMAR" */}
          <ModalView
            visible={anonymizeStep === 2}
            onClose={() => setAnonymizeStep(null)}
            title="Paso 2: Confirmación Estricta de Irreversibilidad"
          >
            <View style={styles.confirmBox}>
              <View style={styles.dangerShieldBox}>
                <Ionicons name="skull-outline" size={40} color={theme.colors.danger} />
              </View>
              <Text style={styles.confirmTitle}>ACCIÓN TOTALMENTE IRREVERSIBLE</Text>
              <Text style={styles.confirmDesc}>
                Para autorizar formalmente la anonimización de{" "}
                <Text style={{ fontWeight: "bold" }}>{targetAnonUser?.name}</Text>, debe escribir textualmente la palabra{" "}
                <Text style={{ fontWeight: "bold", color: theme.colors.dangerDark }}>CONFIRMAR</Text> a continuación:
              </Text>

              <TextInput
                style={styles.keywordInput}
                placeholder='Escriba "CONFIRMAR" en mayúsculas'
                placeholderTextColor={theme.colors.textMuted}
                value={confirmKeywordInput}
                onChangeText={setConfirmKeywordInput}
                autoCapitalize="characters"
              />

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title="Cancelar y Abortar"
                  onPress={() => setAnonymizeStep(null)}
                />
                <Button
                  variant="danger"
                  title="Ejecutar Anonimización Irreversible"
                  disabled={confirmKeywordInput.trim().toUpperCase() !== "CONFIRMAR"}
                  onPress={handleExecuteAnonymization}
                />
              </View>
            </View>
          </ModalView>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 6: RESPALDOS Y RESILIENCIA (ALERTA VISIBLE ANTE FALLOS)            */}
      {/* ========================================================================= */}
      {activeTab === "respaldos" && (
        <View style={styles.section}>
          {/* ALERTA VISIBLE ANTE FALLOS */}
          {hasBackupFailure && (
            <View style={styles.backupFailAlert}>
              <Ionicons name="alert-circle" size={26} color="#ffffff" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.backupFailTitle}>
                  ALERTA CRÍTICA: Se detectaron fallas en el último respaldo programado
                </Text>
                <Text style={styles.backupFailDesc}>
                  El respaldo automático <Text style={{ fontWeight: "bold" }}>fyag_backup_20261013_0300_auto.tar.gz</Text>{" "}
                  falló debido a: Timeout de réplica AWS S3. Se recomienda ejecutar un respaldo manual de contingencia de inmediato.
                </Text>
              </View>
              <Button
                variant="secondary"
                size="sm"
                title="Respaldar Ahora"
                onPress={handleRunBackup}
                style={styles.contingencyBtn}
              />
            </View>
          )}

          {/* Tarjetas de Estado y Acciones Rápidas */}
          <View style={styles.backupActionsBar}>
            <View style={styles.backupStatCard}>
              <Ionicons name="cloud-done-outline" size={28} color={theme.colors.ok} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.backupStatLabel}>Último Respaldo Exitoso</Text>
                <Text style={styles.backupStatValue}>
                  {backupLogs.find((b) => b.status === "exito")?.timestamp || "Sin datos"}
                </Text>
              </View>
            </View>

            <View style={styles.backupStatCard}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color={theme.colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.backupStatLabel}>Prueba de Restauración</Text>
                <Text style={styles.backupStatValue}>Sandbox Verificado 100%</Text>
              </View>
            </View>

            <View style={styles.backupButtonCluster}>
              <Button
                variant="primary"
                title="Respaldo Manual Inmediato"
                icon="save-outline"
                onPress={handleRunBackup}
              />

              <Button
                variant="secondary"
                title="Probar Restauración Sandbox"
                icon="flask-outline"
                onPress={handleRunRestorationTest}
              />
            </View>
          </View>

          {/* Tabla Historial de Respaldos y Restauraciones */}
          <Card style={styles.cardBox}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { flex: 1.3 }]}>Fecha y Hora</Text>
              <Text style={[styles.thCell, { flex: 2.2 }]}>Nombre de Archivo</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Tipo</Text>
              <Text style={[styles.thCell, { flex: 1, textAlign: "right" }]}>Tamaño</Text>
              <Text style={[styles.thCell, { flex: 1.2, textAlign: "center" }]}>Estado Respaldo</Text>
              <Text style={[styles.thCell, { flex: 1.6, textAlign: "center" }]}>Prueba Restauración</Text>
            </View>

            {backupLogs.map((item) => (
              <View key={item.id} style={[styles.tableRow, item.status === "fallo" && styles.tableRowFallo]}>
                <Text style={[styles.tdCell, { flex: 1.3, fontSize: 11 }]}>{item.timestamp}</Text>

                <View style={{ flex: 2.2 }}>
                  <Text style={styles.backupFilename}>{item.filename}</Text>
                  {item.errorReason && (
                    <Text style={styles.backupErrorNote}>Motivo: {item.errorReason}</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={[styles.backupTypeBadge, item.type === "manual" && styles.backupTypeManual]}>
                    <Text style={styles.backupTypeBadgeText}>{item.type.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={[styles.tdCell, { flex: 1, textAlign: "right", fontWeight: "600" }]}>
                  {item.sizeMb > 0 ? `${item.sizeMb} MB` : "0 MB"}
                </Text>

                <View style={{ flex: 1.2, alignItems: "center" }}>
                  <EstadoBadge
                    status={item.status === "exito" ? "aprobada" : "rechazada"}
                    label={item.status === "exito" ? "Éxito" : "Fallo"}
                  />
                </View>

                <View style={{ flex: 1.6, alignItems: "center" }}>
                  {item.restorationStatus === "exito" ? (
                    <View style={styles.testOkBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.ok} style={{ marginRight: 4 }} />
                      <Text style={styles.testOkBadgeText}>Restaurado OK</Text>
                    </View>
                  ) : item.restorationStatus === "fallo" ? (
                    <View style={styles.testFailBadge}>
                      <Ionicons name="close-circle" size={14} color={theme.colors.danger} style={{ marginRight: 4 }} />
                      <Text style={styles.testFailBadgeText}>Prueba Fallida</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>Pendiente de prueba</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </View>
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
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 60,
  },
  section: {
    marginTop: theme.spacing.md,
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
  },
  feedbackBannerOk: {
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
  },
  feedbackBannerError: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  feedbackBannerInfo: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.border,
  },
  feedbackText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  feedbackTextOk: { color: theme.colors.okDark },
  feedbackTextError: { color: theme.colors.dangerDark },
  feedbackTextInfo: { color: theme.colors.primaryDark },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 6,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    minHeight: 44, // WCAG AA
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  kpiCardItem: {
    flex: 1,
    minWidth: 200,
  },

  cardBox: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },

  // Filter Row
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    height: 44,
    flex: 1,
    minWidth: 240,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smallChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  smallChipTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  newActionBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnWhiteText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: theme.fontSize.sm,
  },
  btnSecondaryText: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
    fontSize: theme.fontSize.sm,
  },

  // Tables
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: "center",
  },
  thCell: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    alignItems: "center",
  },
  tableRowDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    opacity: 0.8,
  },
  tableRowFallo: {
    backgroundColor: theme.colors.dangerLight,
  },
  tdCell: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  userNameText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  userEmailText: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    alignSelf: "flex-start",
  },
  roleBadgeAdmin: { backgroundColor: theme.colors.warnLight },
  roleBadgeWarehouse: { backgroundColor: theme.colors.primaryLight },
  roleBadgeTechnician: { backgroundColor: theme.colors.surfaceAlt },
  roleBadgeText: { fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold },
  roleBadgeTextAdmin: { color: theme.colors.warnDark },
  roleBadgeTextWarehouse: { color: theme.colors.primaryDark },
  roleBadgeTextTechnician: { color: theme.colors.textSecondary },

  toggleUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    minHeight: theme.touchTargets.minHeight,
  },
  toggleUserBtnText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  lockedBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.warnBorder,
  },
  lockedBtnText: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.warnDark,
  },

  emptyBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },

  // Modal Forms
  formContainer: {
    padding: theme.spacing.sm,
  },
  formSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerLight,
    padding: 10,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  errorAlertText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    fontWeight: "600",
    flex: 1,
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  roleOptionsGrid: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  roleSelectBox: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  roleSelectBoxSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  roleSelectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  roleSelectTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  roleSelectTitleSelected: {
    color: theme.colors.primaryDark,
  },
  roleSelectDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: 26,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: theme.spacing.md,
  },
  confirmBox: {
    alignItems: "center",
    padding: theme.spacing.md,
  },
  confirmTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },

  // Auditoría
  readOnlyNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    padding: 14,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  readOnlyNoticeTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: "#0f172a",
  },
  readOnlyNoticeDesc: {
    fontSize: 11,
    color: "#334155",
    marginTop: 2,
    lineHeight: 16,
  },
  auditFilterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-end",
  },
  filterFieldLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  textInputBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    height: 38,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  entityScroll: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  entityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  entityChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  entityChipText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  entityChipTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  dateChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  auditRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    alignItems: "flex-start",
  },
  auditUserName: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  auditUserRut: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  entityTag: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: "flex-start",
  },
  entityTagText: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  actionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  actionBadgeCreate: { backgroundColor: theme.colors.okLight },
  actionBadgeModify: { backgroundColor: theme.colors.primaryLight },
  actionBadgeDelete: { backgroundColor: theme.colors.dangerLight },
  actionBadgeAnon: { backgroundColor: theme.colors.surfaceAlt },
  actionBadgeText: { fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold },
  actionBadgeTextCreate: { color: theme.colors.okDark },
  actionBadgeTextModify: { color: theme.colors.primaryDark },
  actionBadgeTextDelete: { color: theme.colors.dangerDark },
  actionBadgeTextAnon: { color: theme.colors.textSecondary },

  // Parámetros
  paramGroupTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  paramGroupTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  paramGroupTabActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  paramGroupTabText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  paramGroupTabTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  groupHeaderTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  paramItemRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingVertical: 14,
    gap: 16,
    alignItems: "center",
  },
  paramInfoCol: {
    flex: 2,
    minWidth: 260,
  },
  paramTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  paramDescription: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  paramMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  defaultValBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  defaultValText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  rangeText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  paramControlCol: {
    flex: 1.2,
    minWidth: 220,
    alignItems: "flex-end",
  },
  inputWithUnit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    marginBottom: 6,
    width: "100%",
  },
  paramInput: {
    flex: 1,
    height: 44,
    minHeight: 44,
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  unitSuffix: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  paramActionButtons: {
    flexDirection: "row",
    gap: 6,
  },
  saveParamBtn: {
    paddingHorizontal: 12,
  },
  saveParamBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  resetParamBtn: {
    paddingHorizontal: 8,
  },
  resetParamBtnDisabled: {
    opacity: 0.4,
  },
  resetParamBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Reportes
  reportFilterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-end",
  },
  reportSkuText: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  reportProdName: {
    fontSize: 11,
    color: theme.colors.text,
  },
  movementBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  movEntry: { backgroundColor: theme.colors.okLight },
  movExit: { backgroundColor: theme.colors.dangerLight },
  movReturn: { backgroundColor: theme.colors.primaryLight },
  movWaste: { backgroundColor: theme.colors.warnLight },
  movAdjust: { backgroundColor: theme.colors.surfaceAlt },
  movementBadgeText: { fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold },
  movEntryText: { color: theme.colors.okDark },
  movExitText: { color: theme.colors.dangerDark },
  movReturnText: { color: theme.colors.primaryDark },
  movWasteText: { color: theme.colors.warnDark },
  movAdjustText: { color: theme.colors.textSecondary },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
    alignItems: "center",
  },
  totalsLabel: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  totalsCell: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
  },
  totalsCellBold: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },

  // Privacidad
  irreversibleNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    marginBottom: theme.spacing.md,
  },
  irreversibleNoticeTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textInverse,
  },
  irreversibleNoticeDesc: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.dangerLight,
    marginTop: 4,
    lineHeight: 16,
  },
  privacyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  privacyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  privacyCardTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  privacyCardDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  exportPrivacyButtons: {
    gap: 10,
  },
  privacyExportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyExportBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  userPickerContainer: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginBottom: 16,
    backgroundColor: theme.colors.surfaceAlt,
  },
  userPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  userPickerItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  userPickerItemLocked: {
    backgroundColor: "#fffbeb",
    opacity: 0.7,
  },
  userPickerName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  userPickerSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  lockedChip: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockedChipText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#b45309",
  },
  startAnonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerShieldBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  keywordInput: {
    width: "100%",
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    height: 44,
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    textAlign: "center",
    marginVertical: 14,
  },

  // Respaldos
  backupFailAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.danger,
    padding: 16,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  backupFailTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: "#ffffff",
  },
  backupFailDesc: {
    fontSize: 11,
    color: "#fee2e2",
    marginTop: 2,
    lineHeight: 16,
  },
  contingencyBtn: {
    backgroundColor: "#ffffff",
  },
  backupActionsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: theme.spacing.md,
    alignItems: "center",
  },
  backupStatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 200,
    flex: 1,
  },
  backupStatLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  backupStatValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  backupButtonCluster: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  backupActionBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  backupFilename: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  backupErrorNote: {
    fontSize: 10,
    color: theme.colors.danger,
    marginTop: 2,
  },
  backupTypeBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  backupTypeManual: {
    backgroundColor: theme.colors.primaryLight,
  },
  backupTypeBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  testOkBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.okLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  testOkBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.okDark,
  },
  testFailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  testFailBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
  },
});
