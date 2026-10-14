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
import { ServiceSheet, ServiceSheetChecklistItem, ServiceSheetPhoto } from "@/core/types";

interface TechnicianServiceSheetsViewProps {
  isOffline?: boolean;
}

export const TechnicianServiceSheetsView: React.FC<TechnicianServiceSheetsViewProps> = ({
  isOffline = false,
}) => {
  const {
    projects,
    serviceSheets,
    materialRequests,
    createServiceSheet,
    resolveServiceSheetConflict,
  } = useApp();
  const { user } = useAuth();

  const activeProjects = projects.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(user.rut) || p.technicianRuts.length === 0)
  );

  // Modal para Nueva Hoja de Servicio
  const [newSheetModal, setNewSheetModal] = useState(false);
  const [sheetProjectId, setSheetProjectId] = useState<string>(activeProjects[0]?.id || "");
  const [sheetReceptor, setSheetReceptor] = useState<string>("Carlos Mendoza (Supervisor de Obra)");
  const [sheetNotes, setSheetNotes] = useState<string>("Trabajo ejecutado según especificaciones de planos de ingeniería.");

  // Checklist interactivo
  const [checklist, setChecklist] = useState<ServiceSheetChecklistItem[]>([
    { id: "c1", label: "Verificación de aislamiento eléctrico y continuidad de fases", completed: true },
    { id: "c2", label: "Prueba de hermeticidad y estanqueidad hidrostática/nitrógeno", completed: true },
    { id: "c3", label: "Carga de refrigerante y verificación de presiones de alta y baja", completed: true },
    { id: "c4", label: "Inspección de anclajes mecánicos y soportes antivibratorios", completed: false },
    { id: "c5", label: "Limpieza profunda y retiro de excedentes de obra", completed: true },
  ]);
  const [customTaskLabel, setCustomTaskLabel] = useState("");

  // Fotos adjuntas (Control estricto de máximo 5 MB cada una)
  const [photos, setPhotos] = useState<ServiceSheetPhoto[]>([
    { id: "ph1", name: "tablero_electrico_montado.jpg", sizeMb: 2.1, timestamp: "Hoy 10:15" },
    { id: "ph2", name: "prueba_manometro_digital.jpg", sizeMb: 3.4, timestamp: "Hoy 11:20" },
  ]);
  const [photoError, setPhotoError] = useState("");
  const [formError, setFormError] = useState("");

  const handleToggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  const handleAddCustomTask = () => {
    if (!customTaskLabel.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, label: customTaskLabel.trim(), completed: true },
    ]);
    setCustomTaskLabel("");
  };

  // Simular carga de foto con validación estricta de peso (< 5 MB)
  const handleSimulateAddPhoto = (simulatedSizeMb: number) => {
    setPhotoError("");
    if (simulatedSizeMb > 5.0) {
      setPhotoError(`¡Bloqueo! La fotografía (${simulatedSizeMb} MB) supera el límite máximo permitido de 5 MB por archivo.`);
      return;
    }

    const newPh: ServiceSheetPhoto = {
      id: `photo_${Date.now()}`,
      name: `registro_faena_${photos.length + 1}.jpg`,
      sizeMb: simulatedSizeMb,
      timestamp: "Hace un momento",
    };
    setPhotos((prev) => [...prev, newPh]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveSheet = () => {
    setFormError("");
    const proj = activeProjects.find((p) => p.id === sheetProjectId) || activeProjects[0];
    if (!proj) {
      setFormError("Seleccione un proyecto válido.");
      return;
    }

    const code = `HS-2026-${String(serviceSheets.length + 106).padStart(3, "0")}`;

    createServiceSheet({
      code,
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      date: new Date().toISOString().slice(0, 10),
      technicianRut: user.rut,
      technicianName: user.name,
      checklist,
      photos,
      receptorName: sheetReceptor.trim() || "Supervisor de Terreno",
      syncStatus: isOffline ? "pendiente" : "sincronizado",
      notes: sheetNotes.trim(),
    });

    setNewSheetModal(false);
  };

  // Hojas con conflicto de versiones
  const conflictSheets = serviceSheets.filter((s) => s.hasVersionConflict);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. TOP HEADER CON BOTÓN ACCIÓN */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hojas de Servicio y Faena</Text>
          <Text style={styles.headerSub}>
            Checklist técnico, fotografías de respaldo (máx. 5 MB) y actas de recepción
          </Text>
        </View>

        <Button
          title="+ Nueva Hoja"
          variant="primary"
          size="sm"
          icon="document-attach-outline"
          onPress={() => {
            setFormError("");
            setPhotoError("");
            setNewSheetModal(true);
          }}
          style={{ height: 44 }}
        />
      </View>

      {/* ========================================================================= */}
      {/* 2. BANNER DE CONFLICTO DE VERSIONES (REQUISITO EXPLICITO PASO 10)         */}
      {/* ========================================================================= */}
      {conflictSheets.map((s) => (
        <View key={s.id} style={styles.conflictBanner}>
          <View style={styles.conflictHeader}>
            <Ionicons name="warning" size={22} color={theme.colors.danger} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.conflictTitle}>
                ⚠️ Conflicto de Versiones Detectado en {s.code}
              </Text>
              <Text style={styles.conflictSub}>
                El servidor central recibió cambios concurrentes mientras operabas en modo sin conexión.
              </Text>
            </View>
          </View>

          {s.conflictDetails && (
            <View style={styles.conflictCompareGrid}>
              <View style={styles.compareCol}>
                <Text style={styles.compareColTitle}>Versión en Servidor Central:</Text>
                <Text style={styles.compareColAuthor}>Por: {s.conflictDetails.serverAuthor}</Text>
                <Text style={styles.compareColDate}>Fecha: {s.conflictDetails.serverModifiedAt}</Text>
                <Text style={styles.compareColNotes}>"{s.conflictDetails.serverNotes}"</Text>
              </View>

              <View style={[styles.compareCol, styles.compareColLocal]}>
                <Text style={styles.compareColTitle}>Tu Versión Local (Celular):</Text>
                <Text style={styles.compareColAuthor}>Por: {s.technicianName}</Text>
                <Text style={styles.compareColDate}>Fecha: {s.conflictDetails.localModifiedAt}</Text>
                <Text style={styles.compareColNotes}>"{s.conflictDetails.localNotes}"</Text>
              </View>
            </View>
          )}

          <View style={styles.conflictActionButtons}>
            <Button
              title="Aceptar Versión Servidor"
              variant="outline"
              size="sm"
              onPress={() => resolveServiceSheetConflict(s.id, "server")}
              style={{ flex: 1, marginRight: 8, height: 40 }}
            />
            <Button
              title="Conservar Versión Local"
              variant="primary"
              size="sm"
              onPress={() => resolveServiceSheetConflict(s.id, "local")}
              style={{ flex: 1, height: 40 }}
            />
          </View>
        </View>
      ))}

      {/* 3. LISTADO DE HOJAS DE SERVICIO */}
      <Text style={styles.sectionHeading}>Registros Emitidos en Faena:</Text>

      {serviceSheets.map((sheet) => {
        const completedCount = sheet.checklist.filter((c) => c.completed).length;
        const totalCount = sheet.checklist.length;
        const totalMb = sheet.photos.reduce((acc, p) => acc + p.sizeMb, 0).toFixed(1);
        const isSynced = sheet.syncStatus === "sincronizado";

        return (
          <Card key={sheet.id} variant="elevated" style={styles.sheetCard}>
            <View style={styles.sheetTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.codeRow}>
                  <Text style={styles.sheetCode}>{sheet.code}</Text>
                  <Badge
                    label={isSynced ? "Sincronizado" : "Pendiente de Sincro"}
                    tone={isSynced ? "ok" : "warn"}
                    icon={isSynced ? "cloud-done-outline" : "cloud-upload-outline"}
                    size="sm"
                  />
                </View>
                <Text style={styles.sheetProj}>{sheet.projectName} ({sheet.projectCode})</Text>
                <Text style={styles.sheetDate}>Fecha de ejecución: {formatDate(sheet.date)}</Text>
              </View>
            </View>

            {/* Checklist summary */}
            <View style={styles.sheetMetricsRow}>
              <View style={styles.sheetMetric}>
                <Ionicons name="checkbox-outline" size={16} color={theme.colors.ok} style={{ marginRight: 4 }} />
                <Text style={styles.sheetMetricTxt}>
                  Checklist: <Text style={{ fontWeight: "bold" }}>{completedCount}/{totalCount}</Text>
                </Text>
              </View>

              <View style={styles.sheetMetric}>
                <Ionicons name="camera-outline" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.sheetMetricTxt}>
                  Fotos: <Text style={{ fontWeight: "bold" }}>{sheet.photos.length} ({totalMb} MB)</Text>
                </Text>
              </View>
            </View>

            {/* Receptor y Observaciones */}
            <View style={styles.sheetFooterBox}>
              <Text style={styles.receptorTxt}>
                Receptor en faena: <Text style={{ fontWeight: "600", color: theme.colors.text }}>{sheet.receptorName}</Text>
              </Text>
              {sheet.notes && (
                <Text style={styles.sheetNotesTxt}>"{sheet.notes}"</Text>
              )}
            </View>
          </Card>
        );
      })}

      {/* 4. SECCIÓN DE ALERTAS Y NOTIFICACIONES DE FAENA */}
      <Text style={[styles.sectionHeading, { marginTop: theme.spacing.lg }]}>
        Alertas y Notificaciones de Solicitudes:
      </Text>

      {materialRequests.slice(0, 4).map((req) => (
        <Card key={req.id} variant="default" style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertCode}>{req.code}</Text>
            <Badge
              label={req.status === "aprobada" ? "Aprobada para Retiro" : req.status === "rechazada" ? "Rechazada" : "Pendiente"}
              tone={req.status === "aprobada" ? "ok" : req.status === "rechazada" ? "danger" : "warn"}
              size="sm"
            />
          </View>
          <Text style={styles.alertProj}>Faena: {req.projectName}</Text>
          <Text style={styles.alertSummary}>{req.items.length} insumo(s) • Fecha: {formatDate(req.date)}</Text>
        </Card>
      ))}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA HOJA DE SERVICIO                                             */}
      {/* ========================================================================= */}
      <ModalView
        visible={newSheetModal}
        onClose={() => setNewSheetModal(false)}
        title="Nueva Hoja de Servicio de Faena"
        subtitle="Control de calidad, checklist y registro fotográfico"
      >
        <Text style={styles.fieldLabel}>1. Proyecto / Faena:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {activeProjects.map((p) => {
            const isSelected = p.id === sheetProjectId;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSheetProjectId(p.id)}
                style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
              >
                <Text style={[styles.chipTxt, isSelected && styles.chipTxtActive]}>
                  {p.code} - {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. CHECKLIST INTERACTIVO */}
        <Text style={styles.fieldLabel}>2. Checklist de Inspección y Entrega:</Text>
        {checklist.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => handleToggleChecklistItem(c.id)}
            style={styles.checkItemRow}
            activeOpacity={0.7}
          >
            <Ionicons
              name={c.completed ? "checkbox" : "square-outline"}
              size={22}
              color={c.completed ? theme.colors.ok : theme.colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.checkItemLabel, c.completed && styles.checkItemDone]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Agregar ítem al checklist */}
        <View style={styles.addChecklistRow}>
          <TextInput
            value={customTaskLabel}
            onChangeText={setCustomTaskLabel}
            placeholder="Añadir tarea de inspección personalizada..."
            placeholderTextColor={theme.colors.textLight}
            style={styles.addChecklistInput}
          />
          <TouchableOpacity onPress={handleAddCustomTask} style={styles.addChecklistBtn}>
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* 3. FOTOGRAFÍAS (MÁX 5 MB POR FOTO) */}
        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
          3. Fotografías de Respaldo (Máx. 5 MB por archivo):
        </Text>

        <View style={styles.photosSimulateBar}>
          <Button
            title="+ Foto Cámara (2.2 MB)"
            variant="outline"
            size="sm"
            icon="camera-outline"
            onPress={() => handleSimulateAddPhoto(2.2)}
            style={{ flex: 1, marginRight: 6 }}
          />
          <Button
            title="+ Foto Pesada (5.8 MB)"
            variant="ghost"
            size="sm"
            icon="alert-circle-outline"
            onPress={() => handleSimulateAddPhoto(5.8)}
            style={{ flex: 1 }}
          />
        </View>

        {Boolean(photoError) && (
          <View style={styles.photoErrorBox}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.danger} style={{ marginRight: 6 }} />
            <Text style={styles.photoErrorTxt}>{photoError}</Text>
          </View>
        )}

        {/* Galería de Fotos */}
        {photos.map((ph) => (
          <View key={ph.id} style={styles.photoItemCard}>
            <Ionicons name="image-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.photoName}>{ph.name}</Text>
              <Text style={styles.photoSize}>
                Tamaño: <Text style={{ fontWeight: "bold" }}>{ph.sizeMb} MB</Text> / 5.0 MB máx. • {ph.timestamp}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemovePhoto(ph.id)} style={styles.removePhotoBtn}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        {/* 4. RECEPTOR Y NOTAS */}
        <Input
          label="Nombre del Receptor / Inspector en Faena"
          value={sheetReceptor}
          onChangeText={setSheetReceptor}
          placeholder="Nombre y cargo de quien recibe el trabajo..."
        />

        <Input
          label="Observaciones o Constancias Técnicas"
          value={sheetNotes}
          onChangeText={setSheetNotes}
          placeholder="Aclaraciones sobre parámetros, presiones, circuitos..."
        />

        {Boolean(formError) && <Text style={styles.errorText}>{formError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setNewSheetModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Emitir Hoja de Servicio"
            variant="primary"
            onPress={handleSaveSheet}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    maxWidth: 240,
  },
  conflictBanner: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.danger,
  },
  conflictHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  conflictTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  conflictSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  conflictCompareGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  compareCol: {
    flex: 1,
    backgroundColor: theme.colors.card,
    padding: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 4,
  },
  compareColLocal: {
    marginRight: 0,
    marginLeft: 4,
    borderColor: theme.colors.primary,
  },
  compareColTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  compareColAuthor: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  compareColDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  compareColNotes: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  conflictActionButtons: {
    flexDirection: "row",
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sheetCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  sheetTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  sheetCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 8,
  },
  sheetProj: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  sheetDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  sheetMetricsRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginVertical: 8,
  },
  sheetMetric: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  sheetMetricTxt: {
    fontSize: 11,
    color: theme.colors.text,
  },
  sheetFooterBox: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 6,
  },
  receptorTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sheetNotesTxt: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  alertCard: {
    marginBottom: 6,
    backgroundColor: theme.colors.card,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertCode: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  alertProj: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  alertSummary: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
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
    paddingHorizontal: 12,
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
    fontSize: 11,
    color: theme.colors.text,
  },
  chipTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  checkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
  },
  checkItemLabel: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  checkItemDone: {
    color: theme.colors.okDark,
    fontWeight: "500",
  },
  addChecklistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  addChecklistInput: {
    flex: 1,
    height: 38,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: 10,
    fontSize: 11,
    color: theme.colors.text,
    marginRight: 6,
  },
  addChecklistBtn: {
    width: 38,
    height: 38,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  photosSimulateBar: {
    flexDirection: "row",
    marginBottom: 8,
  },
  photoErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerLight,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 8,
  },
  photoErrorTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.semibold,
    flex: 1,
  },
  photoItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  photoName: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  photoSize: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  removePhotoBtn: {
    padding: 6,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "bold",
    marginTop: 6,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
});
