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
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { Input } from "@/components/common/Input";
import { ModalView } from "@/components/common/ModalView";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";
import { ReturnOrder, ReturnOrderItem, SupplierReturn } from "@/core/types";

interface ReturnItemForm {
  sku: string;
  quantityRetrieved: number;
  quantityUsed: number;
  quantityReturned: number;
}

export const ReturnsScreen: React.FC = () => {
  const {
    projects,
    products,
    suppliers,
    returnOrders,
    supplierReturns,
    createTechnicianReturn,
    confirmWarehouseReturn,
    createSupplierReturn,
    resolveSupplierReturn,
  } = useApp();
  const { currentRole, user } = useAuth();

  // Tab activo según rol inicial
  const [activeTab, setActiveTab] = useState<"tecnico" | "bodega" | "proveedores">(
    currentRole === "technician" ? "tecnico" : "bodega"
  );

  // -------------------------------------------------------------
  // 1. TÉCNICO: FORMULARIO DE DEVOLUCIÓN DE SOBRANTE
  // -------------------------------------------------------------
  const activeProjects = projects.filter((p) => p.status !== "cerrado");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjects[0]?.id || "");
  const [retItems, setRetItems] = useState<ReturnItemForm[]>([
    {
      sku: products[0]?.sku || "GAS-TUB-0020",
      quantityRetrieved: 10,
      quantityUsed: 6,
      quantityReturned: 4, // max = 10 - 6 = 4
    },
  ]);
  const [retError, setRetError] = useState("");
  const [retSuccess, setRetSuccess] = useState("");

  // Agregar insumo adicional al formulario de devolución
  const handleAddReturnItem = () => {
    const availableProd = products.find((p) => !retItems.some((ri) => ri.sku === p.sku)) || products[0];
    if (availableProd) {
      setRetItems((prev) => [
        ...prev,
        {
          sku: availableProd.sku,
          quantityRetrieved: 5,
          quantityUsed: 3,
          quantityReturned: 2,
        },
      ]);
    }
  };

  const handleRemoveReturnItem = (index: number) => {
    if (retItems.length > 1) {
      setRetItems((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  // Validaciones del formulario de sobrante:
  // Bloqueo estricto si:
  // - Algún ítem tiene returned > (retrieved - used)
  // - Algún ítem tiene returned <= 0
  const validationErrors = retItems.map((item) => {
    const maxAllowed = Math.max(0, item.quantityRetrieved - item.quantityUsed);
    if (item.quantityReturned > maxAllowed) {
      return `Excede el sobrante máximo (${maxAllowed}).`;
    }
    if (item.quantityReturned <= 0) {
      return `La cantidad a devolver debe ser mayor a 0.`;
    }
    return null;
  });

  const hasFormErrors = validationErrors.some((err) => err !== null);

  const handleSaveTechnicianReturn = () => {
    setRetError("");
    setRetSuccess("");

    if (hasFormErrors) {
      setRetError("Corrija los valores antes de registrar la devolución.");
      return;
    }

    const itemsToSend: ReturnOrderItem[] = retItems.map((i) => {
      const p = products.find((prod) => prod.sku === i.sku);
      return {
        sku: i.sku,
        name: p ? p.name : i.sku,
        quantityRetrieved: i.quantityRetrieved,
        quantityUsed: i.quantityUsed,
        quantityReturned: i.quantityReturned,
        unit: p ? p.unit : "un",
      };
    });

    const res = createTechnicianReturn(
      selectedProjectId,
      user.rut,
      user.name,
      itemsToSend
    );

    if (!res.success) {
      setRetError(res.error || "Error al registrar la devolución.");
    } else {
      setRetSuccess("Devolución registrada exitosamente. Se encuentra 'En tránsito' hacia Bodega Central.");
      // Reiniciar con valores de ejemplo
      setRetItems([
        {
          sku: products[1]?.sku || "ELE-CBL-0012",
          quantityRetrieved: 15,
          quantityUsed: 10,
          quantityReturned: 5,
        },
      ]);
    }
  };

  // -------------------------------------------------------------
  // 2. BODEGA: CONFIRMACIÓN DE CANTIDAD FÍSICA REAL
  // -------------------------------------------------------------
  const [confirmReturnModal, setConfirmReturnModal] = useState<ReturnOrder | null>(null);
  const [verifiedList, setVerifiedList] = useState<{ sku: string; quantityReceivedReal: number }[]>([]);
  const [discrepancyNote, setDiscrepancyNote] = useState("");

  const handleOpenConfirmReturn = (ret: ReturnOrder) => {
    setConfirmReturnModal(ret);
    setVerifiedList(
      (ret.items || []).map((i) => ({
        sku: i.sku,
        quantityReceivedReal: i.quantityReturned, // Por defecto la declarada
      }))
    );
    setDiscrepancyNote("");
  };

  const handleSetExactMatch = (sku: string, declaredQty: number) => {
    setVerifiedList((prev) =>
      prev.map((v) => (v.sku === sku ? { ...v, quantityReceivedReal: declaredQty } : v))
    );
  };

  const handleConfirmWarehouseReceipt = () => {
    if (!confirmReturnModal) return;
    confirmWarehouseReturn(
      confirmReturnModal.id,
      verifiedList,
      discrepancyNote.trim() || undefined,
      user.name
    );
    setConfirmReturnModal(null);
  };

  // -------------------------------------------------------------
  // 3. DEVOLUCIÓN A PROVEEDOR (DEFECTUOSOS EN CUARENTENA)
  // -------------------------------------------------------------
  const [newSupplierReturnModal, setNewSupplierReturnModal] = useState(false);
  const [supRetSupplierId, setSupRetSupplierId] = useState(suppliers[0]?.id || "");
  const [supRetSku, setSupRetSku] = useState(products[0]?.sku || "");
  const [supRetQty, setSupRetQty] = useState("5");
  const [supRetReason, setSupRetReason] = useState("Bobina magnética defectuosa de fábrica detectada en recepción");
  const [supRetGuide, setSupRetGuide] = useState("GD-2026-905");
  const [supRetError, setSupRetError] = useState("");

  // Modal para Resolver Devolución a Proveedor
  const [resolveReturnModal, setResolveReturnModal] = useState<SupplierReturn | null>(null);
  const [resolveType, setResolveType] = useState<"nota_credito" | "reemplazo_producto" | "reembolso">("nota_credito");
  const [resolveNotes, setResolveNotes] = useState("");

  const handleSaveSupplierReturn = () => {
    if (!supRetSku || !supRetQty || !supRetReason.trim() || !supRetGuide.trim()) {
      setSupRetError("Todos los campos y el N° de Guía de Despacho son requeridos.");
      return;
    }
    createSupplierReturn(
      supRetSupplierId,
      supRetSku,
      Number(supRetQty) || 1,
      supRetReason.trim(),
      supRetGuide.trim()
    );
    setNewSupplierReturnModal(false);
  };

  const handleConfirmResolution = () => {
    if (!resolveReturnModal) return;
    resolveSupplierReturn(
      resolveReturnModal.id,
      resolveType,
      resolveNotes.trim() || "Resolución formal registrada por el proveedor."
    );
    setResolveReturnModal(null);
  };

  // Filtrado de búsquedas
  const [transitSearch, setTransitSearch] = useState("");
  const filteredTransitReturns = returnOrders.filter((r) => {
    const q = transitSearch.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.technicianName.toLowerCase().includes(q)
    );
  });

  const inTransitCount = returnOrders.filter((r) => r.status === "en_transito").length;
  const supplierPendingCount = supplierReturns.filter((s) => s.status === "pendiente_resolucion").length;

  return (
    <ScreenStateWrapper screenTitle="Devoluciones y Faena" skeletonType="cards">
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* BARRA DE PESTAÑAS                                                         */}
      {/* ========================================================================= */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "tecnico" && styles.tabItemActive]}
          onPress={() => setActiveTab("tecnico")}
        >
          <Ionicons
            name="arrow-undo-outline"
            size={18}
            color={activeTab === "tecnico" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "tecnico" && styles.tabLabelActive]}>
            Devolución Sobrante
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "bodega" && styles.tabItemActive]}
          onPress={() => setActiveTab("bodega")}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={activeTab === "bodega" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "bodega" && styles.tabLabelActive]}>
            En Tránsito ({inTransitCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "proveedores" && styles.tabItemActive]}
          onPress={() => setActiveTab("proveedores")}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={activeTab === "proveedores" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "proveedores" && styles.tabLabelActive]}>
            A Proveedores ({supplierPendingCount} pend.)
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. TAB TÉCNICO: DEVOLUCIÓN DE SOBRANTE Y SEGUIMIENTO                      */}
      {/* ========================================================================= */}
      {activeTab === "tecnico" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <Card variant="elevated">
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Formulario de Devolución de Sobrante</Text>
                <Text style={styles.sectionSubtitle}>
                  Fórmula estricta: Sobrante Máximo = Retirado − Usado en Terreno
                </Text>
              </View>
              <View style={styles.formulaBadge}>
                <Ionicons name="calculator-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.formulaTxt}>Máx = Retirado − Usado</Text>
              </View>
            </View>

            {/* Selector de Proyecto Activo */}
            <Text style={styles.fieldLabel}>1. Seleccione Proyecto / Faena de Origen:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {activeProjects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedProjectId(p.id)}
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

            {/* Insumos a Devolver con Cuadratura */}
            <View style={styles.itemsHeaderRow}>
              <Text style={styles.fieldLabel}>2. Insumos y Cuadratura de Material:</Text>
              <TouchableOpacity onPress={handleAddReturnItem} style={styles.addSmallBtn}>
                <Ionicons name="add" size={14} color={theme.colors.primary} />
                <Text style={styles.addSmallTxt}>+ Agregar Insumo</Text>
              </TouchableOpacity>
            </View>

            {retItems.map((item, idx) => {
              const prod = products.find((p) => p.sku === item.sku);
              const maxAllowed = Math.max(0, item.quantityRetrieved - item.quantityUsed);
              const exceedsMax = item.quantityReturned > maxAllowed;
              const isInvalidZero = item.quantityReturned <= 0;

              return (
                <View key={idx} style={[styles.returnItemCard, (exceedsMax || isInvalidZero) && styles.returnItemCardError]}>
                  <View style={styles.itemCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemNameText}>{prod ? prod.name : item.sku}</Text>
                      <Text style={styles.itemSkuText}>
                        SKU: {item.sku} • Unidad: {prod ? prod.unit : "un"}
                      </Text>
                    </View>
                    {retItems.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveReturnItem(idx)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Cuadratura: Retirado - Usado = Máx */}
                  <View style={styles.qtyInputsRow}>
                    <View style={styles.qtyCol}>
                      <Text style={styles.qtyLabel}>1. Retirado</Text>
                      <TextInput
                        value={String(item.quantityRetrieved)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setRetItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantityRetrieved: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.qtyInput}
                      />
                    </View>

                    <Text style={styles.operatorSign}>−</Text>

                    <View style={styles.qtyCol}>
                      <Text style={styles.qtyLabel}>2. Usado</Text>
                      <TextInput
                        value={String(item.quantityUsed)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setRetItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantityUsed: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.qtyInput}
                      />
                    </View>

                    <Text style={styles.operatorSign}>=</Text>

                    <View style={styles.qtyCol}>
                      <Text style={styles.qtyLabel}>Máx Sobrante</Text>
                      <View style={[styles.maxBox, maxAllowed === 0 && { backgroundColor: "#fee2e2" }]}>
                        <Text style={[styles.maxTxt, maxAllowed === 0 && { color: theme.colors.danger }]}>
                          {maxAllowed} {prod ? prod.unit : "un"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.qtyColHighlight}>
                      <Text style={styles.qtyLabelHighlight}>Devuelve a Bodega</Text>
                      <TextInput
                        value={String(item.quantityReturned)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setRetItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantityReturned: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={[
                          styles.qtyInputHighlight,
                          (exceedsMax || isInvalidZero) && styles.qtyInputError,
                        ]}
                      />
                    </View>
                  </View>

                  {/* Advertencia si excede el máximo permitido */}
                  {exceedsMax && (
                    <View style={styles.blockNotice}>
                      <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                      <Text style={styles.exceedsWarning}>
                        ¡Bloqueo! La cantidad a devolver ({item.quantityReturned}) excede el sobrante máximo ({maxAllowed} = {item.quantityRetrieved} retirado − {item.quantityUsed} usado).
                      </Text>
                    </View>
                  )}

                  {isInvalidZero && (
                    <View style={styles.blockNotice}>
                      <Ionicons name="information-circle" size={16} color={theme.colors.warn} />
                      <Text style={[styles.exceedsWarning, { color: theme.colors.warnDark }]}>
                        Debe ingresar una cantidad mayor a 0 para devolver.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {Boolean(retError) && <Text style={styles.errorText}>{retError}</Text>}
            {Boolean(retSuccess) && <Text style={styles.successText}>{retSuccess}</Text>}

            <Button
              title="Registrar Devolución (En tránsito)"
              variant="primary"
              icon="car-outline"
              disabled={hasFormErrors}
              onPress={handleSaveTechnicianReturn}
              style={{ marginTop: 12, height: 48 }}
            />
          </Card>

          {/* ========================================================================= */}
          {/* SEGUIMIENTO VISUAL: EN TRÁNSITO → RECIBIDA                                */}
          {/* ========================================================================= */}
          <Text style={styles.recentSectionTitle}>Seguimiento de Devoluciones (Obra → Bodega):</Text>
          <Text style={styles.recentSectionSubtitle}>
            Monitoreo en vivo de materiales devueltos desde faena hacia bodega central.
          </Text>

          {returnOrders.map((ret) => {
            const isTransit = ret.status === "en_transito";
            return (
              <Card key={ret.id} variant="default" style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeRow}>
                      <Text style={styles.historyCode}>{ret.code}</Text>
                      <EstadoBadge status={ret.status} size="sm" />
                    </View>
                    <Text style={styles.historyProj}>{ret.projectName} ({ret.projectCode})</Text>
                    <Text style={styles.historyTech}>
                      Técnico: {ret.technicianName} • Fecha: {formatDate(ret.date)}
                    </Text>
                  </View>
                </View>

                {/* STEPPER VISUAL: EN TRÁNSITO → RECIBIDA */}
                <View style={styles.timelineStepper}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, styles.stepCircleDone]}>
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    </View>
                    <Text style={styles.stepLabel}>1. Obra</Text>
                  </View>

                  <View style={[styles.stepLine, isTransit ? styles.stepLineActive : styles.stepLineDone]} />

                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, isTransit ? styles.stepCircleActive : styles.stepCircleDone]}>
                      <Ionicons name={isTransit ? "car" : "checkmark"} size={12} color="#ffffff" />
                    </View>
                    <Text style={[styles.stepLabel, isTransit && styles.stepLabelActiveTxt]}>
                      2. En tránsito
                    </Text>
                  </View>

                  <View style={[styles.stepLine, !isTransit && styles.stepLineDone]} />

                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, !isTransit ? styles.stepCircleDone : styles.stepCirclePending]}>
                      <Ionicons name={!isTransit ? "cube" : "time-outline"} size={12} color={!isTransit ? "#ffffff" : theme.colors.textMuted} />
                    </View>
                    <Text style={[styles.stepLabel, !isTransit && styles.stepLabelDoneTxt]}>
                      3. Recibida
                    </Text>
                  </View>
                </View>

                {/* Insumos detallados */}
                <View style={styles.historyItemsList}>
                  {ret.items?.map((it, idx) => (
                    <View key={idx} style={styles.historyItemLine}>
                      <Text style={styles.historyItemName}>• {it.name}:</Text>
                      <Text style={styles.historyItemQty}>
                        Declarado: {it.quantityReturned} {it.unit}
                        {it.quantityReceivedReal !== undefined && (
                          <Text style={{ color: theme.colors.ok, fontWeight: "bold" }}>
                            {" "}→ Físico Real: {it.quantityReceivedReal} {it.unit}
                          </Text>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Si hubo discrepancia informada por bodega */}
                {ret.discrepancyNote && (
                  <View style={styles.discrepancyAlert}>
                    <Ionicons name="alert-circle" size={16} color={theme.colors.warnDark} style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.discrepancyTitle}>Observación de Bodeguero:</Text>
                      <Text style={styles.discrepancyTxt}>"{ret.discrepancyNote}"</Text>
                    </View>
                  </View>
                )}

                {!isTransit && ret.receivedBy && (
                  <Text style={styles.receivedFooterText}>
                    ✓ Recibido en bodega por {ret.receivedBy} el {formatDate(ret.receivedAt || ret.date)}
                  </Text>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB BODEGA: EN TRÁNSITO Y CONFIRMACIÓN DE CANTIDAD REAL FÍSICA         */}
      {/* ========================================================================= */}
      {activeTab === "bodega" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>Devoluciones en Tránsito desde Obra</Text>
              <Text style={styles.sectionSubtitle}>
                Verifique la carga física real al llegar a bodega y confirme el reingreso al inventario.
              </Text>
            </View>
          </View>

          {/* Buscador de Devoluciones */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              value={transitSearch}
              onChangeText={setTransitSearch}
              placeholder="Buscar por código, proyecto o técnico..."
              placeholderTextColor={theme.colors.textLight}
              style={styles.searchInput}
            />
          </View>

          {filteredTransitReturns.map((ret) => {
            const isTransit = ret.status === "en_transito";
            return (
              <Card
                key={ret.id}
                variant={isTransit ? "elevated" : "default"}
                style={[styles.transitCard, isTransit && styles.transitCardActive]}
              >
                <View style={styles.transitTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeRow}>
                      <Text style={styles.transitCode}>{ret.code}</Text>
                      <EstadoBadge status={ret.status} size="sm" />
                    </View>
                    <Text style={styles.transitProject}>{ret.projectName} ({ret.projectCode})</Text>
                    <Text style={styles.transitTech}>
                      Técnico: <Text style={{ fontWeight: "600" }}>{ret.technicianName}</Text> ({ret.technicianRut})
                    </Text>
                    <Text style={styles.transitDate}>Fecha reporte: {formatDate(ret.date)}</Text>
                  </View>
                </View>

                {/* Items Box */}
                <View style={styles.transitItemsBox}>
                  <Text style={styles.itemsBoxHeading}>Insumos Declarados en la Devolución:</Text>
                  {ret.items?.map((it, idx) => (
                    <View key={idx} style={styles.transitItemRow}>
                      <Text style={styles.transitItemName}>• {it.name}</Text>
                      <View style={styles.transitItemValues}>
                        <Text style={styles.transitDeclaredTxt}>
                          Declarado: <Text style={{ fontWeight: "bold" }}>{it.quantityReturned} {it.unit}</Text>
                        </Text>
                        {it.quantityReceivedReal !== undefined && (
                          <Text style={[styles.transitRealTxt, it.quantityReceivedReal !== it.quantityReturned && styles.transitDiffTxt]}>
                            Real: {it.quantityReceivedReal} {it.unit}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}

                  {ret.discrepancyNote && (
                    <View style={styles.discrepancyBoxSmall}>
                      <Text style={styles.discrepancyNoteLine}>
                        ⚠️ Discrepancia registrada: "{ret.discrepancyNote}"
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botón de Confirmación para Bodeguero */}
                {isTransit ? (
                  <Button
                    title="Verificar y Confirmar Ingreso Físico"
                    variant="primary"
                    size="md"
                    icon="checkmark-circle-outline"
                    onPress={() => handleOpenConfirmReturn(ret)}
                    style={{ marginTop: 12, height: 46 }}
                  />
                ) : (
                  <View style={styles.receivedConfirmBanner}>
                    <Ionicons name="checkmark-done" size={16} color={theme.colors.ok} style={{ marginRight: 6 }} />
                    <Text style={styles.receivedConfirmTxt}>
                      Ingreso conforme completado por {ret.receivedBy || "Bodega Central"}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB DEVOLUCIÓN A PROVEEDORES (DEFECTUOSOS EN CUARENTENA)               */}
      {/* ========================================================================= */}
      {activeTab === "proveedores" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.topActionsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Devoluciones a Proveedores (Defectuosos)</Text>
              <Text style={styles.sectionSubtitle}>
                Egresos de productos con falla desde cuarentena con N° de Guía de Despacho.
              </Text>
            </View>

            {currentRole !== "technician" && (
              <Button
                title="+ Devolver a Proveedor"
                variant="danger"
                size="sm"
                icon="add-outline"
                onPress={() => {
                  setSupRetError("");
                  setNewSupplierReturnModal(true);
                }}
              />
            )}
          </View>

          {supplierReturns.map((sRet) => {
            const isResolved = sRet.status === "resuelta";
            return (
              <Card key={sRet.id} variant="default" style={styles.supplierRetCard}>
                <View style={styles.supRetTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeRow}>
                      <Text style={styles.supRetCode}>{sRet.code}</Text>
                      <EstadoBadge status={sRet.status} size="sm" />
                    </View>
                    <Text style={styles.supRetSupplier}>
                      Proveedor: <Text style={{ fontWeight: "bold" }}>{sRet.supplierName}</Text> ({sRet.supplierRut})
                    </Text>
                    <Text style={styles.supRetProduct}>
                      {sRet.quantity} {sRet.unit} de {sRet.productName} ({sRet.productSku})
                    </Text>
                  </View>
                </View>

                <View style={styles.supRetDetails}>
                  <View style={styles.detailItemRow}>
                    <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.supRetText}>
                      Guía de Despacho N°: <Text style={{ fontWeight: "bold", color: theme.colors.text }}>{sRet.dispatchGuideNumber}</Text>
                    </Text>
                  </View>

                  <View style={styles.detailItemRow}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.colors.danger} />
                    <Text style={styles.supRetText}>
                      Motivo: <Text style={{ color: theme.colors.text }}>{sRet.reason}</Text>
                    </Text>
                  </View>

                  <View style={styles.detailItemRow}>
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
                    <Text style={styles.supRetText}>Fecha de egreso: {formatDate(sRet.date)}</Text>
                  </View>

                  {/* Detalle si ya fue resuelta */}
                  {sRet.resolutionType && (
                    <View style={styles.resolutionBox}>
                      <View style={styles.resolutionHeader}>
                        <Ionicons name="checkmark-circle" size={18} color={theme.colors.ok} style={{ marginRight: 6 }} />
                        <Text style={styles.resolutionTitle}>
                          Resolución: {sRet.resolutionType === "nota_credito" ? "Nota de Crédito" : sRet.resolutionType === "reemplazo_producto" ? "Reemplazo de Producto" : "Reembolso en Dinero"}
                        </Text>
                      </View>
                      {sRet.resolutionNotes && (
                        <Text style={styles.resolutionTxt}>"{sRet.resolutionNotes}"</Text>
                      )}
                      {sRet.resolvedAt && (
                        <Text style={styles.resolutionDate}>Cerrada el {formatDate(sRet.resolvedAt)}</Text>
                      )}
                    </View>
                  )}
                </View>

                {!isResolved && currentRole !== "technician" && (
                  <View style={styles.supRetActions}>
                    <Button
                      title="Resolver Devolución"
                      variant="success"
                      size="sm"
                      icon="checkmark-outline"
                      onPress={() => {
                        setResolveReturnModal(sRet);
                        setResolveType("nota_credito");
                        setResolveNotes("Emisión de Nota de Crédito por el proveedor.");
                      }}
                      style={{ height: 42 }}
                    />
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BODEGA - CONFIRMAR CANTIDAD REAL FÍSICA                          */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(confirmReturnModal)}
        onClose={() => setConfirmReturnModal(null)}
        title="Confirmar Cantidad Física en Bodega"
        subtitle={confirmReturnModal ? `${confirmReturnModal.code} • ${confirmReturnModal.technicianName}` : ""}
      >
        <Text style={styles.modalInstruction}>
          Realice el conteo físico de los insumos recepcionados. Si la cantidad difiere de lo declarado por el técnico, el sistema emitirá una alerta y registrará la nota de discrepancia:
        </Text>

        {confirmReturnModal?.items?.map((it) => {
          const verified = verifiedList.find((v) => v.sku === it.sku);
          const currentRealVal = verified?.quantityReceivedReal ?? it.quantityReturned;
          const hasDiff = currentRealVal !== it.quantityReturned;

          return (
            <View key={it.sku} style={[styles.verifyItemCard, hasDiff && styles.verifyItemCardDiff]}>
              <View style={styles.verifyItemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifyItemTitle}>{it.name}</Text>
                  <Text style={styles.verifyItemExpected}>
                    Declarado por técnico en terreno: <Text style={{ fontWeight: "bold" }}>{it.quantityReturned} {it.unit}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleSetExactMatch(it.sku, it.quantityReturned)}
                  style={styles.matchBtn}
                >
                  <Text style={styles.matchBtnTxt}>Coincide ({it.quantityReturned})</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.verifyInputRow}>
                <Text style={styles.verifyInputLabel}>Cantidad Física Real Recibida:</Text>
                <TextInput
                  value={String(currentRealVal)}
                  onChangeText={(v) => {
                    const num = Number(v) || 0;
                    setVerifiedList((prev) =>
                      prev.map((x) => (x.sku === it.sku ? { ...x, quantityReceivedReal: num } : x))
                    );
                  }}
                  keyboardType="numeric"
                  style={[
                    styles.verifyTextInput,
                    hasDiff && { borderColor: theme.colors.warn, backgroundColor: "#fffbeb" },
                  ]}
                />
              </View>

              {/* Advertencia obligatoria si difiere */}
              {hasDiff && (
                <View style={styles.diffWarningBox}>
                  <Ionicons name="warning" size={16} color={theme.colors.warnDark} style={{ marginRight: 6 }} />
                  <Text style={styles.diffWarning}>
                    ⚠️ ¡Discrepancia detectada! El técnico declaró {it.quantityReturned} {it.unit}, pero se están recibiendo {currentRealVal} {it.unit}. (Diferencia: {currentRealVal - it.quantityReturned > 0 ? `+${currentRealVal - it.quantityReturned}` : currentRealVal - it.quantityReturned} {it.unit}).
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <Input
          label="Observación o justificación de la discrepancia"
          value={discrepancyNote}
          onChangeText={setDiscrepancyNote}
          placeholder="Ej: Faltaron 2 metros por merma en corte de terreno..."
        />

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setConfirmReturnModal(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Confirmar e Ingresar a Stock"
            variant="success"
            onPress={handleConfirmWarehouseReceipt}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* MODAL 2: NUEVA DEVOLUCIÓN A PROVEEDOR (DEFECTUOSOS)                       */}
      {/* ========================================================================= */}
      <ModalView
        visible={newSupplierReturnModal}
        onClose={() => setNewSupplierReturnModal(false)}
        title="Devolver Insumo a Proveedor"
        subtitle="Egreso de insumo defectuoso desde cuarentena con Guía de Despacho"
      >
        <Text style={styles.fieldLabel}>1. Proveedor Destino:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {suppliers.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSupRetSupplierId(s.id)}
              style={[
                styles.chipBtn,
                supRetSupplierId === s.id && styles.chipBtnActive,
              ]}
            >
              <Text style={[styles.chipTxt, supRetSupplierId === s.id && styles.chipTxtActive]}>
                {s.businessName} ({s.rut})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>2. Insumo Defectuoso (en Cuarentena):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {products.map((p) => (
            <TouchableOpacity
              key={p.sku}
              onPress={() => setSupRetSku(p.sku)}
              style={[
                styles.chipBtn,
                supRetSku === p.sku && styles.chipBtnActive,
              ]}
            >
              <Text style={[styles.chipTxt, supRetSku === p.sku && styles.chipTxtActive]}>
                {p.name} ({p.quarantine || 0} en cuarentena)
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Input
          label="Cantidad a Devolver"
          value={supRetQty}
          onChangeText={setSupRetQty}
          keyboardType="numeric"
        />

        <Input
          label="N° de Guía de Despacho de Salida"
          value={supRetGuide}
          onChangeText={setSupRetGuide}
          placeholder="Ej: GD-2026-905"
        />

        <Input
          label="Motivo Detallado del Defecto / Falla"
          value={supRetReason}
          onChangeText={setSupRetReason}
          placeholder="Ej: Aislación deficiente, microfuga o daño de empaque..."
        />

        {Boolean(supRetError) && <Text style={styles.errorText}>{supRetError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setNewSupplierReturnModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Generar Devolución"
            variant="danger"
            onPress={handleSaveSupplierReturn}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </ModalView>

      {/* ========================================================================= */}
      {/* MODAL 3: RESOLVER DEVOLUCIÓN DE PROVEEDOR                                 */}
      {/* ========================================================================= */}
      <ModalView
        visible={Boolean(resolveReturnModal)}
        onClose={() => setResolveReturnModal(null)}
        title="Resolver Devolución a Proveedor"
        subtitle={resolveReturnModal ? `${resolveReturnModal.code} • ${resolveReturnModal.supplierName}` : ""}
      >
        <Text style={styles.modalInstruction}>
          Seleccione la vía formal acordada con el proveedor para cerrar esta devolución:
        </Text>

        <View style={styles.resolutionOptionsGrid}>
          <TouchableOpacity
            onPress={() => setResolveType("nota_credito")}
            style={[
              styles.resolutionOptionCard,
              resolveType === "nota_credito" && styles.resolutionOptionActive,
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={resolveType === "nota_credito" ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.resolutionOptionTitle, resolveType === "nota_credito" && styles.resolutionOptionTitleActive]}>
              Nota de Crédito
            </Text>
            <Text style={styles.resolutionOptionDesc}>Ajuste contable en cuenta corriente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setResolveType("reemplazo_producto")}
            style={[
              styles.resolutionOptionCard,
              resolveType === "reemplazo_producto" && styles.resolutionOptionActive,
            ]}
          >
            <Ionicons
              name="repeat-outline"
              size={24}
              color={resolveType === "reemplazo_producto" ? theme.colors.ok : theme.colors.textMuted}
            />
            <Text style={[styles.resolutionOptionTitle, resolveType === "reemplazo_producto" && styles.resolutionOptionTitleActive]}>
              Reemplazo
            </Text>
            <Text style={styles.resolutionOptionDesc}>Entrega de producto nuevo conforme</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setResolveType("reembolso")}
            style={[
              styles.resolutionOptionCard,
              resolveType === "reembolso" && styles.resolutionOptionActive,
            ]}
          >
            <Ionicons
              name="cash-outline"
              size={24}
              color={resolveType === "reembolso" ? theme.colors.info : theme.colors.textMuted}
            />
            <Text style={[styles.resolutionOptionTitle, resolveType === "reemplazo_producto" && styles.resolutionOptionTitleActive]}>
              Reembolso
            </Text>
            <Text style={styles.resolutionOptionDesc}>Devolución de fondos bancarios</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="N° de Documento y Notas de Respaldo"
          value={resolveNotes}
          onChangeText={setResolveNotes}
          placeholder="Ej: Nota de Crédito N° 4519 recibida y conciliada..."
        />

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setResolveReturnModal(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Button
            title="Confirmar Resolución"
            variant="success"
            onPress={handleConfirmResolution}
            style={{ flex: 2, height: 46 }}
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: "600",
    marginLeft: 6,
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  tabContent: {
    flex: 1,
  },
  scrollBody: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  formulaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  formulaTxt: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginLeft: 4,
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 12,
  },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
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
  itemsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  addSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addSmallTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginLeft: 2,
  },
  returnItemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  returnItemCardError: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fff1f2",
  },
  itemCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemNameText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  itemSkuText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  removeBtn: {
    padding: 6,
  },
  qtyInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyCol: {
    flex: 1,
    alignItems: "center",
  },
  qtyColHighlight: {
    flex: 1.2,
    alignItems: "center",
    marginLeft: 6,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
    textAlign: "center",
  },
  qtyLabelHighlight: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginBottom: 4,
    textAlign: "center",
  },
  qtyInput: {
    width: "100%",
    height: 38,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  qtyInputHighlight: {
    width: "100%",
    height: 38,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  qtyInputError: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fee2e2",
    color: theme.colors.danger,
  },
  operatorSign: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginHorizontal: 4,
    marginTop: 14,
  },
  maxBox: {
    width: "100%",
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  maxTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  blockNotice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#fee2e2",
    padding: 6,
    borderRadius: theme.radius.sm,
  },
  exceedsWarning: {
    fontSize: 11,
    color: theme.colors.danger,
    fontWeight: "bold",
    marginLeft: 4,
    flex: 1,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.xs,
    marginTop: 8,
    fontWeight: "600",
  },
  successText: {
    color: theme.colors.ok,
    fontSize: theme.fontSize.xs,
    marginTop: 8,
    fontWeight: "bold",
  },
  recentSectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  recentSectionSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  historyCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  historyCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 8,
  },
  historyProj: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  historyTech: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timelineStepper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: "center",
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleDone: {
    backgroundColor: theme.colors.ok,
  },
  stepCircleActive: {
    backgroundColor: theme.colors.primary,
  },
  stepCirclePending: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.borderDark,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary,
  },
  stepLineDone: {
    backgroundColor: theme.colors.ok,
  },
  stepLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  stepLabelActiveTxt: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  stepLabelDoneTxt: {
    color: theme.colors.ok,
    fontWeight: "bold",
  },
  historyItemsList: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 4,
  },
  historyItemLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  historyItemName: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  historyItemQty: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  discrepancyAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  discrepancyTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.warnDark,
  },
  discrepancyTxt: {
    fontSize: 11,
    color: theme.colors.text,
    fontStyle: "italic",
  },
  receivedFooterText: {
    fontSize: 11,
    color: theme.colors.ok,
    fontWeight: "600",
    marginTop: 8,
  },
  sectionHeadingRow: {
    marginBottom: theme.spacing.sm,
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
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  transitCard: {
    marginBottom: theme.spacing.sm,
  },
  transitCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  transitTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  transitCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 8,
  },
  transitProject: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  transitTech: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  transitDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  transitItemsBox: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 8,
  },
  itemsBoxHeading: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  transitItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  transitItemName: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  transitItemValues: {
    alignItems: "flex-end",
  },
  transitDeclaredTxt: {
    fontSize: 12,
    color: theme.colors.text,
  },
  transitRealTxt: {
    fontSize: 11,
    color: theme.colors.ok,
    fontWeight: "bold",
  },
  transitDiffTxt: {
    color: theme.colors.danger,
  },
  discrepancyBoxSmall: {
    backgroundColor: "#fffbeb",
    padding: 6,
    borderRadius: theme.radius.sm,
    marginTop: 6,
  },
  discrepancyNoteLine: {
    fontSize: 11,
    color: theme.colors.warnDark,
    fontStyle: "italic",
  },
  receivedConfirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 10,
  },
  receivedConfirmTxt: {
    fontSize: 11,
    color: theme.colors.ok,
    fontWeight: "bold",
  },
  topActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  supplierRetCard: {
    marginBottom: theme.spacing.sm,
  },
  supRetTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  supRetCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.danger,
    marginRight: 8,
  },
  supRetSupplier: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginTop: 2,
  },
  supRetProduct: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  supRetDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  supRetText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  resolutionBox: {
    backgroundColor: "#f0fdf4",
    padding: 8,
    borderRadius: theme.radius.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  resolutionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.ok,
  },
  resolutionTxt: {
    fontSize: 11,
    color: theme.colors.text,
    fontStyle: "italic",
    marginTop: 2,
  },
  resolutionDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  supRetActions: {
    marginTop: 10,
  },
  modalInstruction: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  verifyItemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: 10,
    marginBottom: 10,
  },
  verifyItemCardDiff: {
    borderColor: theme.colors.warn,
    backgroundColor: "#fffbeb",
  },
  verifyItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  verifyItemTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  verifyItemExpected: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  matchBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  matchBtnTxt: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  verifyInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  verifyInputLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  verifyTextInput: {
    width: 90,
    height: 38,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  diffWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  diffWarning: {
    fontSize: 11,
    color: theme.colors.warnDark,
    fontWeight: "bold",
    flex: 1,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 16,
  },
  resolutionOptionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  resolutionOptionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    backgroundColor: theme.colors.surface,
    marginHorizontal: 3,
  },
  resolutionOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  resolutionOptionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 4,
    textAlign: "center",
  },
  resolutionOptionTitleActive: {
    color: theme.colors.primaryDark,
  },
  resolutionOptionDesc: {
    fontSize: 9,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
});
