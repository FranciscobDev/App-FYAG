import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STATUSES, StatusKey } from "@/core/status";
import { theme } from "@/core/theme";

// Componentes Base (Paso 2)
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { NumberInput } from "@/components/common/NumberInput";
import { PasswordInput } from "@/components/common/PasswordInput";
import { SearchInput } from "@/components/common/SearchInput";
import { Select } from "@/components/common/Select";
import { Combobox } from "@/components/common/Combobox";
import { DatePicker } from "@/components/common/DatePicker";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Textarea } from "@/components/common/Textarea";
import { Checkbox } from "@/components/common/Checkbox";
import { RadioGroup } from "@/components/common/Radio";
import { Switch } from "@/components/common/Switch";
import { FileUpload, UploadedFile } from "@/components/common/FileUpload";
import { StarRating } from "@/components/common/StarRating";
import { Modal } from "@/components/common/Modal";
import { Drawer } from "@/components/common/Drawer";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Toast, ToastType } from "@/components/common/Toast";
import { Tabs } from "@/components/common/Tabs";
import { Skeleton } from "@/components/common/Skeleton";

// Componentes Compartidos (Paso 2)
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { KpiCard } from "@/components/common/KpiCard";
import { SemaforoBadge } from "@/components/common/SemaforoBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ForbiddenState } from "@/components/common/ForbiddenState";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { SyncStatusChip } from "@/components/common/SyncStatusChip";
import { ExportButton } from "@/components/common/ExportButton";
import { QrScannerModal } from "@/components/common/QrScannerModal";
import { StockCell } from "@/components/common/StockCell";
import { DiffViewer } from "@/components/common/DiffViewer";
import { NotificationBell } from "@/components/common/NotificationBell";

export const DesignSystemScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "base" | "compartidos" | "estados" | "paleta" | "contextos"
  >("base");

  // Form State Demo
  const [inputVal, setInputVal] = useState("12.345.678-5");
  const [numberVal, setNumberVal] = useState<number | undefined>(14.525);
  const [passwordVal, setPasswordVal] = useState("ClaveSegura2026");
  const [searchVal, setSearchVal] = useState("");
  const [selectVal, setSelectVal] = useState<string>("obra_vial");
  const [comboboxVal, setComboboxVal] = useState<string>("PROV-001");
  const [dateVal, setDateVal] = useState("2026-10-20");
  const [rangeStart, setRangeStart] = useState("2026-10-01");
  const [rangeEnd, setRangeEnd] = useState("2026-10-31");
  const [textareaVal, setTextareaVal] = useState(
    "Revisión conforme de materiales eléctricos en terreno. Pendiente recepción de conectores."
  );
  const [checkedVal, setCheckedVal] = useState(true);
  const [radioVal, setRadioVal] = useState("estandar");
  const [switchVal, setSwitchVal] = useState(true);
  const [ratingVal, setRatingVal] = useState(4);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
    {
      id: "f1",
      name: "Guia_Despacho_5420.pdf",
      sizeStr: "1.2 MB",
      type: "pdf",
    },
  ]);

  // Overlay Demos
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  // Toast Demo
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("Operación guardada exitosamente en el servidor.");
  const [toastType, setToastType] = useState<ToastType>("ok");

  const triggerToast = (msg: string, type: ToastType) => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // FilterBar State Demo
  const [filterQuery, setFilterQuery] = useState("");
  const [filterChip, setFilterChip] = useState("todos");

  // Sample Data for DataTable
  const sampleTableData = [
    {
      id: "1",
      sku: "ELEC-CAB-001",
      name: "Cable Cobre 2.5mm THHN",
      category: "Electricidad",
      stock: 45,
      unit: "m",
      status: "activo",
      budgetPct: 72,
    },
    {
      id: "2",
      sku: "SOLD-IND-002",
      name: "Soldadura Arco 6011 1/8",
      category: "Ferretería",
      stock: 8,
      unit: "kg",
      status: "pendiente",
      budgetPct: 88,
    },
    {
      id: "3",
      sku: "PINT-ANT-004",
      name: "Esmalte Anticorrosivo Gris",
      category: "Pinturas",
      stock: 0,
      unit: "gl",
      status: "defectuoso",
      budgetPct: 118,
    },
    {
      id: "4",
      sku: "HERR-TAL-008",
      name: "Taladro Percutor 850W",
      category: "Herramientas",
      stock: 3,
      unit: "u",
      status: "en_transito",
      budgetPct: 95,
    },
    {
      id: "5",
      sku: "EPP-CAS-010",
      name: "Casco de Seguridad Blanco",
      category: "Seguridad",
      stock: 24,
      unit: "u",
      status: "conforme",
      budgetPct: 45,
    },
    {
      id: "6",
      sku: "TUB-PVC-012",
      name: "Tubo PVC Conduit 20mm",
      category: "Tuberías",
      stock: 120,
      unit: "tira",
      status: "planificado",
      budgetPct: 65,
    },
  ];

  return (
    <View style={styles.mainWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ENCABEZADO DE CATÁLOGO */}
        <PageHeader
          title="Catálogo de Componentes FYAG"
          subtitle="PASO 1 & 2: Sistema de diseño, tokens de accesibilidad y 38 componentes base/compartidos"
          breadcrumbs={[
            { label: "FYAG MultiSystem" },
            { label: "Diseño & Front" },
            { label: "Paso 2 Componentes" },
          ]}
          rightAction={
            <NotificationBell variant="light" />
          }
        />

        {/* PESTAÑAS PRINCIPALES DEL SISTEMA */}
        <Tabs
          tabs={[
            { id: "base", label: "Componentes Base (21)" },
            { id: "compartidos", label: "Compartidos (17)" },
            { id: "estados", label: "Estados (Color + Texto)" },
            { id: "paleta", label: "Paleta & Tipografía" },
            { id: "contextos", label: "3 Roles & Contextos" },
          ]}
          activeTab={activeTab}
          onChangeTab={(id) => setActiveTab(id as any)}
          scrollable
        />

        {/* ========================================================================= */}
        {/* 1. COMPONENTES BASE                                                       */}
        {/* ========================================================================= */}
        {activeTab === "base" && (
          <View>
            {/* BOTONES */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>1. Botones Táctiles (Mínimo ≥ 44 px)</Text>
              <Text style={styles.cardSub}>
                Variantes: primary, secondary, danger, ghost, outline con estado loading y soporte táctil accesible.
              </Text>

              <View style={styles.buttonGrid}>
                <Button
                  title="Primary (≥ 44 px)"
                  variant="primary"
                  icon="checkmark-circle-outline"
                  onPress={() => triggerToast("Botón Primario presionado", "ok")}
                  style={styles.gridBtn}
                />
                <Button
                  title="Secondary"
                  variant="secondary"
                  icon="copy-outline"
                  onPress={() => triggerToast("Botón Secundario presionado", "info")}
                  style={styles.gridBtn}
                />
                <Button
                  title="Danger"
                  variant="danger"
                  icon="trash-outline"
                  onPress={() => triggerToast("Acción de peligro ejecutada", "danger")}
                  style={styles.gridBtn}
                />
                <Button
                  title="Ghost"
                  variant="ghost"
                  icon="share-outline"
                  onPress={() => triggerToast("Botón Ghost presionado", "warn")}
                  style={styles.gridBtn}
                />
                <Button
                  title="Cargando..."
                  variant="primary"
                  loading={true}
                  onPress={() => {}}
                  style={styles.gridBtn}
                />
                <Button
                  title="Deshabilitado"
                  variant="primary"
                  disabled={true}
                  onPress={() => {}}
                  style={styles.gridBtn}
                />
              </View>
            </Card>

            {/* FORMULARIOS: INPUTS Y CAMPOS NUMÉRICOS */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>2. Campos de Entrada (Foco Visible & Contraste AA)</Text>

              {/* Input Estándar */}
              <Input
                label="RUT Cliente / Técnico"
                value={inputVal}
                onChangeText={setInputVal}
                required
                icon="card-outline"
                helper="Formato con puntos y guion (ej: 12.345.678-5)"
              />

              {/* NumberInput con hasta 3 decimales */}
              <NumberInput
                label="Cantidad / Cubicaje (Hasta 3 decimales)"
                value={numberVal}
                onChangeNumber={setNumberVal}
                maxDecimals={3}
                step={0.125}
                unit="kg"
                required
                helper="Permite incremento/decremento táctil con botones (+ / -)"
              />

              {/* PasswordInput con toggle de visualización */}
              <PasswordInput
                label="Contraseña de Acceso"
                value={passwordVal}
                onChangeText={setPasswordVal}
                required
                helper="Presione el icono del ojo para alternar visibilidad segura"
              />

              {/* SearchInput con botón limpiar */}
              <View style={{ marginBottom: theme.spacing.md }}>
                <Text style={styles.fieldHeading}>SearchInput con Limpieza Rápida:</Text>
                <SearchInput
                  value={searchVal}
                  onChangeText={setSearchVal}
                  placeholder="Buscar insumos por SKU o nombre..."
                />
              </View>

              {/* Textarea multilínea con contador */}
              <Textarea
                label="Observaciones Técnicas de Faena"
                value={textareaVal}
                onChangeText={setTextareaVal}
                maxLength={200}
                rows={3}
                helper="Campo multilínea con indicador automático de límite de caracteres"
              />
            </Card>

            {/* SELECTORES: SELECT, COMBOBOX, DATEPICKERS */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>3. Selectores, Fechas y Rangos</Text>

              {/* Select */}
              <Select
                label="Tipo de Proyecto"
                value={selectVal}
                onChange={setSelectVal}
                required
                options={[
                  { label: "Obra Vial (Infraestructura)", value: "obra_vial", icon: "car-outline" },
                  { label: "Mantención Electromecánica", value: "mantencion_electro", icon: "flash-outline" },
                  { label: "Instalación Eléctrica Industrial", value: "instalacion", icon: "construct-outline" },
                ]}
              />

              {/* Combobox con búsqueda reactiva */}
              <Combobox
                label="Proveedor Asociado (Combobox con filtro)"
                value={comboboxVal}
                onChange={setComboboxVal}
                required
                options={[
                  { label: "DISVAL Ferretería Industrial", value: "PROV-001", badge: "RUT 76.432.109-K", hint: "Materiales y fijaciones" },
                  { label: "ELECTROCOM Chile SpA", value: "PROV-002", badge: "RUT 77.892.401-2", hint: "Conductores y tableros" },
                  { label: "SODIMAC Constructor", value: "PROV-003", badge: "RUT 96.792.120-4", hint: "Ferretería mayorista" },
                  { label: "PINTURAS TRICOLOR", value: "PROV-004", badge: "RUT 81.340.500-1", hint: "Anticorrosivos y sellantes" },
                ]}
                searchPlaceholder="Escriba razón social o RUT..."
              />

              {/* DatePicker Chileno */}
              <DatePicker
                label="Fecha de Entrega en Bodega"
                value={dateVal}
                onChangeDate={setDateVal}
                required
                helper="Selector táctil con accesos rápidos (Hoy, Mañana, +7 Días) en formato DD/MM/AAAA"
              />

              {/* DateRangePicker */}
              <DateRangePicker
                label="Período de Ejecución de Obra"
                startDate={rangeStart}
                endDate={rangeEnd}
                onChangeRange={(s, e) => {
                  setRangeStart(s);
                  setRangeEnd(e);
                }}
                required
                helper="Valida coherencia de fechas Desde / Hasta y ofrece presets inteligentes"
              />
            </Card>

            {/* CONTROLES BOOLEANOS, RATING Y SUBIDA */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>4. Controles Táctiles, Rating y Adjuntos</Text>

              <Checkbox
                label="Confirmar verificación visual de calidad"
                description="Marca obligatoria antes de autorizar el ingreso al cardex"
                checked={checkedVal}
                onChange={setCheckedVal}
              />

              <RadioGroup
                label="Nivel de Prioridad de Despacho"
                value={radioVal}
                onChange={setRadioVal}
                options={[
                  { label: "Estándar (Despacho en 48 hrs)", value: "estandar" },
                  { label: "Urgente (Faena detenida)", value: "urgente", description: "Requiere autorización de jefatura" },
                ]}
              />

              <Switch
                label="Notificar al Técnico por WhatsApp / SMS"
                description="Envía guía de despacho al celular al confirmar egreso"
                value={switchVal}
                onValueChange={setSwitchVal}
              />

              {/* StarRating 1 a 5 */}
              <View style={{ marginVertical: theme.spacing.sm }}>
                <Text style={styles.fieldHeading}>Calificación de Proveedor (1 a 5 estrellas):</Text>
                <StarRating
                  rating={ratingVal}
                  onChangeRating={setRatingVal}
                  size="md"
                />
              </View>

              {/* FileUpload con vista previa */}
              <FileUpload
                label="Adjuntar Evidencia / Factura / Guía de Despacho"
                files={uploadedFiles}
                onAddFile={(f) => setUploadedFiles([...uploadedFiles, f])}
                onRemoveFile={(id) => setUploadedFiles(uploadedFiles.filter((x) => x.id !== id))}
                helper="Simula carga de PDF o imagen fotográfica con preview y botón eliminar"
              />
            </Card>

            {/* OVERLAYS: MODAL, DRAWER, CONFIRMDIALOG, SKELETON */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>5. Diálogos, Paneles y Placeholders (Skeleton)</Text>

              <View style={styles.buttonGrid}>
                <Button
                  title="Abrir Modal"
                  variant="outline"
                  icon="browsers-outline"
                  onPress={() => setModalOpen(true)}
                  style={styles.gridBtn}
                />
                <Button
                  title="Abrir Drawer"
                  variant="outline"
                  icon="menu-outline"
                  onPress={() => setDrawerOpen(true)}
                  style={styles.gridBtn}
                />
                <Button
                  title="Confirm Dialog"
                  variant="danger"
                  icon="alert-circle-outline"
                  onPress={() => setConfirmOpen(true)}
                  style={styles.gridBtn}
                />
                <Button
                  title="Probar Toast"
                  variant="secondary"
                  icon="notifications-outline"
                  onPress={() => triggerToast("Notificación flotante con auto-dismiss", "ok")}
                  style={styles.gridBtn}
                />
              </View>

              <Text style={[styles.fieldHeading, { marginTop: 16 }]}>Skeleton (Efecto Shimmer de Carga):</Text>
              <Skeleton width="100%" height={20} borderRadius={6} />
              <Skeleton width="80%" height={16} borderRadius={4} />
              <Skeleton width="50%" height={14} borderRadius={4} />
            </Card>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. COMPONENTES COMPARTIDOS                                                */}
        {/* ========================================================================= */}
        {activeTab === "compartidos" && (
          <View>
            {/* KPI CARDS */}
            <Text style={styles.sectionTitle}>Tarjetas de Indicador KPI (KpiCard)</Text>
            <View style={styles.kpiRow}>
              <KpiCard
                label="Stock Disponible"
                value="1.840 u"
                subtitle="14 categorías"
                trend={{ value: "+12.4%", positive: true }}
                tone="ok"
                icon="cube"
              />
              <KpiCard
                label="Presupuesto"
                value="$18.4M"
                subtitle="84% ejecutado"
                trend={{ value: "+4.1%", positive: false }}
                tone="warn"
                icon="cash"
              />
              <KpiCard
                label="Stock Crítico"
                value="3 SKUs"
                subtitle="Bajo reposición"
                tone="danger"
                icon="alert-circle"
              />
            </View>

            {/* FILTERBAR */}
            <Text style={styles.sectionTitle}>Barra de Filtros (FilterBar)</Text>
            <FilterBar
              searchQuery={filterQuery}
              onSearchChange={setFilterQuery}
              searchPlaceholder="Filtrar insumos o proyectos..."
              chips={[
                { id: "todos", label: "Todos", count: 24 },
                { id: "activos", label: "Activos", count: 18, color: theme.colors.ok },
                { id: "pendientes", label: "Pendientes", count: 4, color: theme.colors.warn },
                { id: "criticos", label: "Críticos", count: 2, color: theme.colors.danger },
              ]}
              selectedChip={filterChip}
              onSelectChip={setFilterChip}
              hasActiveFilters={Boolean(filterQuery) || filterChip !== "todos"}
              onClearFilters={() => {
                setFilterQuery("");
                setFilterChip("todos");
              }}
            />

            {/* DATA TABLE (RESPONSIVA CON TARJETAS EN MÓVIL) */}
            <Text style={styles.sectionTitle}>DataTable (Ordenable, Paginada y Adaptativa en Celular)</Text>
            <DataTable
              data={sampleTableData}
              keyExtractor={(item) => item.id}
              columns={[
                { key: "sku", title: "SKU", width: 140, sortable: true },
                { key: "name", title: "Insumo", width: 220, sortable: true },
                {
                  key: "stock",
                  title: "Stock Disponible",
                  width: 140,
                  render: (item) => (
                    <StockCell available={item.stock} unit={item.unit} compact={true} />
                  ),
                },
                {
                  key: "status",
                  title: "Estado",
                  width: 150,
                  render: (item) => <EstadoBadge status={item.status} size="sm" />,
                },
                {
                  key: "budgetPct",
                  title: "Costo / Semáforo",
                  width: 160,
                  render: (item) => (
                    <SemaforoBadge percentage={item.budgetPct} size="sm" />
                  ),
                },
              ]}
              onRowPress={(item) => triggerToast(`Seleccionado: ${item.name}`, "info")}
            />

            {/* SEMÁFORO Y PROGRESS BAR */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>Semáforo y Barras de Progreso</Text>
              <Text style={styles.cardSub}>
                Semáforo estricto: Verde &lt; 80%, Amarillo 80–100%, Rojo &gt; 100%.
              </Text>

              <View style={styles.semaforoRow}>
                <SemaforoBadge percentage={68} labelPrefix="Obra Vial:" />
                <SemaforoBadge percentage={92} labelPrefix="Mantención:" />
                <SemaforoBadge percentage={118} labelPrefix="Sobrecosto:" />
              </View>

              <View style={{ marginTop: 12 }}>
                <ProgressBar
                  label="Avance Físico Proyecto"
                  value={75}
                  showPercentage={true}
                  semaforo={true}
                  height={10}
                />
                <ProgressBar
                  label="Ejecución Presupuesto Horas (Sobregirado)"
                  value={112}
                  showPercentage={true}
                  semaforo={true}
                  height={10}
                />
              </View>
            </Card>

            {/* STOCKCELL & DIFFVIEWER */}
            <Card variant="elevated" style={styles.sectionCard}>
              <Text style={styles.cardHeading}>StockCell y DiffViewer (Auditoría y Diferencias)</Text>

              <Text style={styles.fieldHeading}>StockCell Desglosado:</Text>
              <StockCell available={120} committed={25} quarantine={4} unit="u" />

              <Text style={[styles.fieldHeading, { marginTop: 14 }]}>DiffViewer (Valor Anterior vs Nuevo):</Text>
              <DiffViewer
                label="Ajuste de Inventario Físico"
                oldValue={45}
                newValue={50}
                unit="unidades"
                showDelta={true}
              />
              <DiffViewer
                label="Cantidad Recibida vs Facturada"
                oldValue={100}
                newValue={92}
                unit="kg"
                showDelta={true}
              />
            </Card>

            {/* ESTADOS DE RETROALIMENTACIÓN */}
            <Text style={styles.sectionTitle}>Estados de Sistema (Empty, Error, Forbidden, Sync)</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <SyncStatusChip status="pendiente" pendingCount={3} style={{ marginRight: 8 }} />
              <SyncStatusChip status="sincronizado" />
              <View style={{ marginLeft: "auto" }}>
                <ExportButton onExport={(fmt) => triggerToast(`Generando reporte ${fmt.toUpperCase()}`, "ok")} />
              </View>
            </View>

            <EmptyState
              icon="search-outline"
              title="No hay solicitudes pendientes"
              description="Todas las solicitudes de material de los técnicos han sido procesadas."
              actionTitle="Crear Nueva Solicitud"
              onAction={() => triggerToast("Nueva solicitud", "info")}
            />

            <ErrorState
              title="Error al contactar API central"
              message="Ocurrió un error 500 al consultar el balance de bodega. Los datos locales se mantienen intactos."
              onRetry={() => triggerToast("Reintentando consulta...", "info")}
            />

            <ForbiddenState
              title="Módulo Reservado para Administrador"
              message="El cierre contable y cálculo de rentabilidad solo puede ser ejecutado con perfil Administrador."
              onAction={() => triggerToast("Abriendo selector de perfil...", "info")}
            />
          </View>
        )}

        {/* ========================================================================= */}
        {/* 3. ESTADOS ESTRICTOS (COLOR + TEXTO)                                      */}
        {/* ========================================================================= */}
        {activeTab === "estados" && (
          <Card variant="elevated" style={styles.sectionCard}>
            <Text style={styles.cardHeading}>Matriz de Estados (SIEMPRE Color + Icono + Texto)</Text>
            <Text style={styles.cardSub}>
              Cumplimiento estricto de la regla del Paso 1: cada estado tiene color cromático reservado, texto explícito y contraste AA.
            </Text>

            <View style={styles.statesMatrix}>
              {(Object.keys(STATUSES) as StatusKey[]).map((key) => {
                const s = STATUSES[key];
                return (
                  <View key={key} style={styles.stateItemRow}>
                    <View style={styles.stateLabelCol}>
                      <Text style={styles.stateCodeText}>{key}</Text>
                      <Text style={styles.stateGroupName}>Grupo: {s.colorName.toUpperCase()}</Text>
                    </View>
                    <EstadoBadge status={key} size="md" />
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* 4. PALETA & TIPOGRAFÍA                                                    */}
        {/* ========================================================================= */}
        {activeTab === "paleta" && (
          <Card variant="elevated" style={styles.sectionCard}>
            <Text style={styles.cardHeading}>Paleta Cromática con Contraste WCAG AA</Text>
            
            <Text style={styles.groupLabel}>Primario Azul Profesional</Text>
            <View style={styles.swatchGrid}>
              <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.swatchTextLight}>Primario</Text>
                <Text style={styles.swatchHex}>#0284c7</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.primaryDark }]}>
                <Text style={styles.swatchTextLight}>Primario Dark (AA)</Text>
                <Text style={styles.swatchHex}>#0369a1</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={styles.swatchTextDark}>Fondo Suave</Text>
                <Text style={styles.swatchHexDark}>#e0f2fe</Text>
              </View>
            </View>

            <Text style={[styles.groupLabel, { marginTop: 14 }]}>Estados Semánticos</Text>
            <View style={styles.swatchGrid}>
              <View style={[styles.swatch, { backgroundColor: theme.colors.okDark }]}>
                <Text style={styles.swatchTextLight}>Verde Éxito</Text>
                <Text style={styles.swatchHex}>#166534</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.warnDark }]}>
                <Text style={styles.swatchTextLight}>Ámbar Alerta</Text>
                <Text style={styles.swatchHex}>#92400e</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.dangerDark }]}>
                <Text style={styles.swatchTextLight}>Rojo Peligro</Text>
                <Text style={styles.swatchHex}>#991b1b</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.transitDark }]}>
                <Text style={styles.swatchTextLight}>Azul Tránsito</Text>
                <Text style={styles.swatchHex}>#1e40af</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.celesteDark }]}>
                <Text style={styles.swatchTextLight}>Celeste</Text>
                <Text style={styles.swatchHex}>#0369a1</Text>
              </View>
              <View style={[styles.swatch, { backgroundColor: theme.colors.muteDark }]}>
                <Text style={styles.swatchTextLight}>Gris Neutro</Text>
                <Text style={styles.swatchHex}>#334155</Text>
              </View>
            </View>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* 5. CONTEXTOS DE ROL                                                       */}
        {/* ========================================================================= */}
        {activeTab === "contextos" && (
          <View>
            <Card variant="elevated" style={styles.sectionCard}>
              <View style={styles.roleHeaderRow}>
                <Ionicons name="desktop-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.roleTitle}>1. Administrador • Escritorio Web</Text>
              </View>
              <Text style={styles.roleDesc}>
                Diseñado para pantallas grandes: tablas con alta densidad de datos, gráficos de costos y rentabilidad, validaciones de aprobación y formularios extensos.
              </Text>
            </Card>

            <Card variant="elevated" style={styles.sectionCard}>
              <View style={styles.roleHeaderRow}>
                <Ionicons name="tablet-portrait-outline" size={24} color={theme.colors.warnDark} />
                <Text style={styles.roleTitle}>2. Bodeguero • Tablet</Text>
              </View>
              <Text style={styles.roleDesc}>
                Botones táctiles grandes (≥ 50 px), escaneo rápido con cámara integrada de códigos QR y de barras, checklists de recepción rápida por bulto.
              </Text>
              <Button
                title="Probar Escáner de Bodega"
                variant="primary"
                icon="barcode-outline"
                onPress={() => setScannerOpen(true)}
                style={{ marginTop: 10 }}
              />
            </Card>

            <Card variant="elevated" style={styles.sectionCard}>
              <View style={styles.roleHeaderRow}>
                <Ionicons name="phone-portrait-outline" size={24} color={theme.colors.okDark} />
                <Text style={styles.roleTitle}>3. Técnico • Celular (Mobile-First & Offline)</Text>
              </View>
              <Text style={styles.roleDesc}>
                Operación en terreno sin cobertura de red: las devoluciones y solicitudes se almacenan localmente y se sincronizan al recuperar señal.
              </Text>
              <View style={{ marginTop: 10 }}>
                <OfflineBanner />
              </View>
            </Card>
          </View>
        )}

        {/* ESPACIADOR FINAL */}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODALES Y OVERLAYS ACTIVABLES                                            */}
      {/* ========================================================================= */}
      <Modal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal Accesible de Ejemplo"
        subtitle="Demostración de componente Modal con cabecera y pie de acciones"
        footer={
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Button
              title="Cancelar"
              variant="outline"
              size="sm"
              onPress={() => setModalOpen(false)}
              style={{ marginRight: 8 }}
            />
            <Button
              title="Entendido"
              variant="primary"
              size="sm"
              onPress={() => setModalOpen(false)}
            />
          </View>
        }
      >
        <Text style={styles.modalBodyText}>
          Este modal cuenta con oscurecimiento de fondo (backdrop con desenfoque suave), cierre al tocar afuera, soporte para teclado y área scrolleable con altura máxima controlada.
        </Text>
      </Modal>

      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Panel Lateral (Drawer)"
        subtitle="Detalles rápidos de inspección"
      >
        <Text style={styles.modalBodyText}>
          Panel lateral táctil ideal para inspeccionar fichas de insumo, historiales de mantención o checklists sin perder el contexto principal.
        </Text>
        <Button
          title="Cerrar Panel"
          variant="outline"
          size="sm"
          onPress={() => setDrawerOpen(false)}
          style={{ marginTop: 20 }}
        />
      </Drawer>

      <ConfirmDialog
        visible={confirmOpen}
        title="¿Dar de baja herramienta?"
        message="Esta acción cambiará el estado de la herramienta a 'Dada de baja'. No podrá volver a ser prestada a técnicos en faena."
        confirmLabel="Sí, dar de baja"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          triggerToast("Herramienta dada de baja", "danger");
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanResult={(val) => {
          setScannedResult(val);
          setScannerOpen(false);
          triggerToast(`Código escaneado: ${val}`, "ok");
        }}
      />

      {/* TOAST FLOTANTE */}
      <Toast
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  cardHeading: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginVertical: theme.spacing.sm,
  },
  fieldHeading: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridBtn: {
    width: "48%",
    marginBottom: 10,
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  semaforoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  statesMatrix: {
    marginTop: 8,
  },
  stateItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  stateLabelCol: {
    flex: 1,
  },
  stateCodeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  stateGroupName: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  groupLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  swatch: {
    padding: 10,
    borderRadius: theme.radius.md,
    minWidth: 100,
    flex: 1,
  },
  swatchTextLight: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
  },
  swatchHex: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
  },
  swatchTextDark: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "bold",
  },
  swatchHexDark: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  roleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  roleTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginLeft: 8,
  },
  roleDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  modalBodyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 22,
  },
});
