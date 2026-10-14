import React, { useEffect, useState } from "react";
import {
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
import { formatCLP, formatDate, isValidRut } from "@/core/format";
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
  NumberInput,
  PageHeader,
  StarRating,
  ScreenStateWrapper,
  Toast,
} from "@/components/common";
import {
  Client,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierRating,
} from "@/core/types";

export type PurchasingTab = "ordenes" | "facturas" | "recepcion" | "terceros";

export interface PurchasingScreenProps {
  initialTab?: PurchasingTab;
}

export const PurchasingScreen: React.FC<PurchasingScreenProps> = ({ initialTab = "ordenes" }) => {
  const {
    purchaseOrders,
    purchaseInvoices,
    suppliers,
    clients,
    products,
    createPurchaseOrder,
    approveAndSendOrder,
    rateSupplier,
    createInvoice,
    confirmOrderReception,
    addSupplier,
    addClient,
    toggleSupplierDisabled,
    toggleClientDisabled,
  } = useApp();
  const { currentRole } = useAuth();

  const [activeTab, setActiveTab] = useState<PurchasingTab>(initialTab);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // =========================================================================
  // 1. ÓRDENES DE COMPRA (OC) STATE
  // =========================================================================
  const [poFilterStatus, setPoFilterStatus] = useState<string>("todas");
  const [poModal, setPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || "");
  const [poItems, setPoItems] = useState<{ sku: string; quantity: number; unitPrice: number }[]>([]);
  const [poNotes, setPoNotes] = useState("");
  const [poExpectedDate, setPoExpectedDate] = useState("2026-10-25");
  const [poIsAutoMin, setPoIsAutoMin] = useState(false);
  const [poError, setPoError] = useState("");

  // Vista Previa PDF de la OC
  const [pdfPreviewOrder, setPdfPreviewOrder] = useState<PurchaseOrder | null>(null);

  // Modal de Calificación de Proveedor al cerrar OC recibida
  const [rateModalOrder, setRateModalOrder] = useState<PurchaseOrder | null>(null);
  const [ratingTime, setRatingTime] = useState(5);
  const [ratingQuality, setRatingQuality] = useState(5);
  const [ratingPrice, setRatingPrice] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const filteredOrders = purchaseOrders.filter((order) => {
    if (poFilterStatus === "todas") return true;
    return order.status === poFilterStatus;
  });

  const handleOpenNewOrder = () => {
    setEditingPo(null);
    setSelectedSupplierId(suppliers[0]?.id || "");
    const firstProd = products[0];
    setPoItems([
      { sku: firstProd?.sku || "", quantity: 10, unitPrice: firstProd?.unitCost || 1000 },
    ]);
    setPoNotes("Entrega en Bodega Central antes de las 16:00 hrs.");
    setPoExpectedDate(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    setPoIsAutoMin(false);
    setPoError("");
    setPoModal(true);
  };

  const handleOpenEditOrder = (order: PurchaseOrder) => {
    setEditingPo(order);
    setSelectedSupplierId(order.supplierId);
    setPoItems(
      order.items.map((i) => ({ sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice }))
    );
    setPoNotes(order.notes || "");
    setPoExpectedDate(order.expectedDate);
    setPoIsAutoMin(Boolean(order.isAutoMinStock));
    setPoError("");
    setPoModal(true);
  };

  const handleSavePurchaseOrder = (asDraft = true) => {
    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    if (!sup) {
      setPoError("Seleccione un proveedor válido.");
      return;
    }
    if (poItems.length === 0) {
      setPoError("Debe incluir al menos un insumo en la orden.");
      return;
    }

    const itemsToSend: PurchaseOrderItem[] = poItems.map((it) => {
      const p = products.find((prod) => prod.sku === it.sku);
      return {
        sku: it.sku,
        name: p ? p.name : it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: p ? p.unit : "un",
      };
    });

    const res = createPurchaseOrder({
      supplierId: sup.id,
      supplier: sup.businessName,
      supplierRut: sup.rut,
      status: asDraft ? "borrador" : "enviada",
      isAutoMinStock: poIsAutoMin,
      items: itemsToSend,
      expectedDate: poExpectedDate,
      notes: poNotes,
    });

    if (res.success) {
      showToast(asDraft ? "Orden de compra guardada en borrador." : "Orden aprobada y enviada a proveedor.");
      setPoModal(false);
    } else {
      setPoError(res.error || "Error al crear la orden de compra.");
    }
  };

  const handleSaveRating = () => {
    if (!rateModalOrder) return;
    const avg = Number(((ratingTime + ratingQuality + ratingPrice) / 3).toFixed(1));
    const rating: SupplierRating = {
      timeRating: ratingTime,
      qualityRating: ratingQuality,
      priceRating: ratingPrice,
      average: avg,
      comment: ratingComment.trim() || undefined,
      ratedAt: new Date().toISOString().slice(0, 10),
    };
    rateSupplier(rateModalOrder.id, rating);
    showToast(`OC ${rateModalOrder.code} cerrada con calificación promedio de ${avg} ⭐`);
    setRateModalOrder(null);
  };

  // =========================================================================
  // 2. FACTURAS DE COMPRA CON CASCADA E IVA STATE
  // =========================================================================
  const [invSupplierId, setInvSupplierId] = useState(suppliers[0]?.id || "");
  const [invNumber, setInvNumber] = useState("");
  const [invOrderCode, setInvOrderCode] = useState("");
  const [invItems, setInvItems] = useState<{
    sku: string;
    quantity: number;
    grossPrice: number;
    disc1: number;
    disc2: number;
    disc3: number;
  }[]>([
    { sku: products[0]?.sku || "", quantity: 10, grossPrice: 5000, disc1: 5, disc2: 0, disc3: 0 },
  ]);
  const [invError, setInvError] = useState("");

  // Cálculo en cascada en vivo para cada ítem:
  // Paso 1: P1 = Bruto * (1 - d1/100)
  // Paso 2: P2 = P1 * (1 - d2/100)
  // Paso 3: Neto = P2 * (1 - d3/100)
  const calculatedInvoiceItems: PurchaseInvoiceItem[] = invItems.map((i) => {
    const p = products.find((prod) => prod.sku === i.sku);
    const step1 = i.grossPrice * (1 - (i.disc1 || 0) / 100);
    const step2 = step1 * (1 - (i.disc2 || 0) / 100);
    const netUnitPrice = Math.round(step2 * (1 - (i.disc3 || 0) / 100));
    const subtotalNet = netUnitPrice * (i.quantity || 0);
    return {
      sku: i.sku,
      name: p ? p.name : i.sku,
      quantity: i.quantity,
      grossPrice: i.grossPrice,
      discount1Pct: i.disc1,
      discount2Pct: i.disc2,
      discount3Pct: i.disc3,
      netUnitPrice,
      subtotalNet,
      unit: p ? p.unit : "un",
    };
  });

  const invoiceSubtotalNet = calculatedInvoiceItems.reduce((acc, i) => acc + i.subtotalNet, 0);
  const invoiceIva = Math.round(invoiceSubtotalNet * 0.19);
  const invoiceTotal = invoiceSubtotalNet + invoiceIva;

  // Validación de duplicado de factura por proveedor
  const selectedInvSupplier = suppliers.find((s) => s.id === invSupplierId);
  const isInvoiceDuplicate = Boolean(
    invNumber.trim() &&
      selectedInvSupplier &&
      purchaseInvoices.some(
        (inv) =>
          inv.supplierRut.replace(/[.\s-]/g, "") === selectedInvSupplier.rut.replace(/[.\s-]/g, "") &&
          inv.number.trim().toLowerCase() === invNumber.trim().toLowerCase()
      )
  );

  const handleSaveInvoice = () => {
    setInvError("");
    if (!invNumber.trim()) {
      setInvError("Ingrese el número de la factura.");
      return;
    }
    if (!selectedInvSupplier) {
      setInvError("Seleccione un proveedor.");
      return;
    }
    if (isInvoiceDuplicate) {
      setInvError(`La factura N° ${invNumber} ya fue ingresada para el proveedor ${selectedInvSupplier.businessName}.`);
      return;
    }

    const newInvoice: PurchaseInvoice = {
      id: `inv_${Date.now()}`,
      number: invNumber.trim(),
      supplierId: selectedInvSupplier.id,
      supplierName: selectedInvSupplier.businessName,
      supplierRut: selectedInvSupplier.rut,
      orderCode: invOrderCode.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
      items: calculatedInvoiceItems,
      subtotalNet: invoiceSubtotalNet,
      totalDiscounts: 0,
      iva: invoiceIva,
      total: invoiceTotal,
      status: "registrada",
    };

    const res = createInvoice(newInvoice);
    if (!res.success) {
      setInvError(res.error || "Error al registrar la factura.");
    } else {
      showToast(`Factura N° ${invNumber} registrada exitosamente.`);
      setInvNumber("");
      setInvOrderCode("");
    }
  };

  // =========================================================================
  // 3. RECEPCIÓN CHECKLIST STATE
  // =========================================================================
  const [selectedOcCode, setSelectedOcCode] = useState(
    purchaseOrders.find((o) => o.status === "enviada" || o.status === "recibida_parcial")?.code || ""
  );
  const activeReceptionOrder = purchaseOrders.find((o) => o.code === selectedOcCode);
  const [receptionChecklist, setReceptionChecklist] = useState<{
    sku: string;
    received: number;
    defective: number;
    missing: number;
  }[]>([]);

  useEffect(() => {
    if (activeReceptionOrder) {
      setReceptionChecklist(
        activeReceptionOrder.items.map((it) => ({
          sku: it.sku,
          received: it.quantity,
          defective: 0,
          missing: 0,
        }))
      );
    }
  }, [selectedOcCode]);

  // Alerta de discrepancia en recepción
  const hasReceptionDiscrepancy = receptionChecklist.some((item) => {
    const poItem = activeReceptionOrder?.items.find((i) => i.sku === item.sku);
    const expected = poItem?.quantity || 0;
    const totalCounted = item.received + item.defective + item.missing;
    return totalCounted !== expected || item.defective > 0 || item.missing > 0;
  });

  const handleConfirmReception = () => {
    if (!selectedOcCode) return;
    confirmOrderReception(selectedOcCode, receptionChecklist);
    showToast(`Recepción confirmada para ${selectedOcCode}. Stock actualizado y cuarentena aplicada.`);
    setSelectedOcCode("");
  };

  // =========================================================================
  // 4. TERCEROS (PROVEEDORES Y CLIENTES) STATE
  // =========================================================================
  const [thirdPartyTab, setThirdPartyTab] = useState<"proveedores" | "clientes">("proveedores");
  const [thirdPartySearch, setThirdPartySearch] = useState("");
  const [thirdPartySort, setThirdPartySort] = useState<"rating_desc" | "rating_asc" | "alpha">("rating_desc");

  const [partyModal, setPartyModal] = useState(false);
  const [partyRut, setPartyRut] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyTradeName, setPartyTradeName] = useState("");
  const [partyCategory, setPartyCategory] = useState("");
  const [partyPhone, setPartyPhone] = useState("+56 9 ");
  const [partyEmail, setPartyEmail] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partyContact, setPartyContact] = useState("");
  const [bankName, setBankName] = useState("Banco de Chile");
  const [accountType, setAccountType] = useState<"corriente" | "vista" | "ahorro">("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [partyError, setPartyError] = useState("");

  const handleOpenPartyModal = () => {
    setPartyRut("");
    setPartyName("");
    setPartyTradeName("");
    setPartyCategory(thirdPartyTab === "proveedores" ? "Materiales Eléctricos" : "Inmobiliaria");
    setPartyPhone("+56 9 ");
    setPartyEmail("");
    setPartyAddress("Santiago, Chile");
    setPartyContact("");
    setBankName("Banco de Chile");
    setAccountType("corriente");
    setAccountNumber("");
    setPartyError("");
    setPartyModal(true);
  };

  const handleSaveParty = () => {
    setPartyError("");
    if (!isValidRut(partyRut)) {
      setPartyError("El RUT ingresado no es válido (verifique formato y dígito verificador módulo 11).");
      return;
    }
    if (!partyName.trim()) {
      setPartyError("La Razón Social es obligatoria.");
      return;
    }

    // Detección de duplicados de RUT
    const cleanRut = partyRut.replace(/[.\s-]/g, "").toUpperCase();
    if (thirdPartyTab === "proveedores") {
      const exists = suppliers.some((s) => s.rut.replace(/[.\s-]/g, "").toUpperCase() === cleanRut);
      if (exists) {
        setPartyError("Ya existe un proveedor registrado con este RUT.");
        return;
      }

      const res = addSupplier({
        id: `sup_${Date.now()}`,
        rut: partyRut.trim(),
        businessName: partyName.trim(),
        tradeName: partyTradeName.trim() || partyName.trim(),
        category: partyCategory,
        phone: partyPhone,
        email: partyEmail,
        address: partyAddress,
        contactName: partyContact || "Contacto Principal",
        contactPhone: partyPhone,
        bankDetails: {
          bank: bankName,
          accountType,
          accountNumber,
          transferEmail: partyEmail,
        },
        ratingAvg: 5.0,
        ratingCount: 1,
      });
      if (!res.success) {
        setPartyError(res.error || "Error al agregar proveedor.");
      } else {
        showToast(`Proveedor ${partyName} registrado exitosamente.`);
        setPartyModal(false);
      }
    } else {
      const exists = clients.some((c) => c.rut.replace(/[.\s-]/g, "").toUpperCase() === cleanRut);
      if (exists) {
        setPartyError("Ya existe un cliente registrado con este RUT.");
        return;
      }

      const res = addClient({
        id: `cli_${Date.now()}`,
        rut: partyRut.trim(),
        businessName: partyName.trim(),
        category: partyCategory,
        phone: partyPhone,
        email: partyEmail,
        address: partyAddress,
        contactName: partyContact || "Contacto Comercial",
        activeProjectsCount: 1,
      });
      if (!res.success) {
        setPartyError(res.error || "Error al agregar cliente.");
      } else {
        showToast(`Cliente ${partyName} registrado exitosamente.`);
        setPartyModal(false);
      }
    }
  };

  // Filtrado y ordenación de proveedores
  const filteredSuppliers = suppliers
    .filter((s) => {
      const q = thirdPartySearch.toLowerCase().trim();
      if (!q) return true;
      return (
        s.businessName.toLowerCase().includes(q) ||
        s.tradeName.toLowerCase().includes(q) ||
        s.rut.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (thirdPartySort === "rating_desc") return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (thirdPartySort === "rating_asc") return (a.ratingAvg || 0) - (b.ratingAvg || 0);
      return a.businessName.localeCompare(b.businessName);
    });

  // Filtrado de clientes
  const filteredClients = clients.filter((c) => {
    const q = thirdPartySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.rut.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================
  return (
    <ScreenStateWrapper screenTitle="Compras y Terceros" skeletonType="table">
    <View style={styles.container}>
      {/* Toast Notification */}
      <Toast
        visible={Boolean(toastMessage)}
        message={toastMessage || ""}
        onDismiss={() => setToastMessage(null)}
      />

      {/* ENCABEZADO CON MIGAS DE PAN Y ACCIÓN PRINCIPAL */}
      <PageHeader
        title="Órdenes de Compra y Proveedores"
        subtitle="Gestión de adquisiciones, recepción física en bodega y conciliación de facturas"
        breadcrumbs={[
          "Inicio",
          "Compras",
          activeTab === "ordenes"
            ? "Órdenes de Compra"
            : activeTab === "facturas"
            ? "Facturas Proveedor"
            : activeTab === "recepcion"
            ? "Recepción Física"
            : "Evaluación Proveedores",
        ]}
        rightAction={
          currentRole !== "technician" ? (
            <Button
              title="+ Nueva Orden"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={handleOpenNewOrder}
            />
          ) : undefined
        }
      />

      {/* TABS DE NAVEGACIÓN SUPERIOR */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "ordenes" && styles.tabItemActive]}
          onPress={() => setActiveTab("ordenes")}
        >
          <Ionicons
            name="cart-outline"
            size={18}
            color={activeTab === "ordenes" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "ordenes" && styles.tabLabelActive]}>
            Órdenes ({purchaseOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "facturas" && styles.tabItemActive]}
          onPress={() => setActiveTab("facturas")}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeTab === "facturas" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "facturas" && styles.tabLabelActive]}>
            Facturas ({purchaseInvoices.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "recepcion" && styles.tabItemActive]}
          onPress={() => setActiveTab("recepcion")}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={activeTab === "recepcion" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "recepcion" && styles.tabLabelActive]}>
            Recepción OC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "terceros" && styles.tabItemActive]}
          onPress={() => setActiveTab("terceros")}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === "terceros" ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === "terceros" && styles.tabLabelActive]}>
            Terceros ({suppliers.length + clients.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* =====================================================================
          1. TAB ÓRDENES DE COMPRA (OC)
          ===================================================================== */}
      {activeTab === "ordenes" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.topActionsRow}>
            <View>
              <Text style={styles.subHeading}>Gestión de Órdenes de Compra</Text>
              <Text style={styles.sectionSubtitle}>
                Flujo: Borrador → Enviada → Recibida parcial → Recibida → Cerrada.
              </Text>
            </View>
            {currentRole === "admin" && (
              <Button
                title="Nueva OC"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={handleOpenNewOrder}
              />
            )}
          </View>

          {/* Filtros de estado para Órdenes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterScroll}>
            {[
              { id: "todas", label: "Todas" },
              { id: "borrador", label: "Borrador" },
              { id: "enviada", label: "Enviada" },
              { id: "recibida_parcial", label: "Recibida Parcial" },
              { id: "recibida", label: "Recibida" },
              { id: "cerrada", label: "Cerrada" },
            ].map((st) => (
              <TouchableOpacity
                key={st.id}
                onPress={() => setPoFilterStatus(st.id)}
                style={[styles.statusChip, poFilterStatus === st.id && styles.statusChipActive]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    poFilterStatus === st.id && styles.statusChipTextActive,
                  ]}
                >
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredOrders.length === 0 ? (
            <EmptyState
              icon="cart-outline"
              title="No se encontraron órdenes de compra"
              description="No hay órdenes registradas bajo el estado seleccionado."
              actionTitle={currentRole === "admin" ? "+ Nueva OC" : undefined}
              onAction={currentRole === "admin" ? handleOpenNewOrder : undefined}
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            filteredOrders.map((order) => {
              const isDraft = order.status === "borrador";
              const isReceived = order.status === "recibida";

              return (
              <Card key={order.id} variant="elevated" style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.codeWithAutoBox}>
                      <Text style={styles.orderCode}>{order.code}</Text>
                      {order.isAutoMinStock && (
                        <Badge
                          label="⚡ Auto Stock Mínimo"
                          tone="warn"
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                    <Text style={styles.orderSupplier}>{order.supplier}</Text>
                    <Text style={styles.orderDate}>
                      Emisión: {formatDate(order.date)} • Entrega: {formatDate(order.expectedDate)}
                    </Text>
                  </View>

                  <Badge
                    label={order.status.replace("_", " ").toUpperCase()}
                    tone={
                      order.status === "recibida"
                        ? "ok"
                        : order.status === "cerrada"
                        ? "mute"
                        : order.status === "enviada"
                        ? "info"
                        : order.status === "recibida_parcial"
                        ? "warn"
                        : order.status === "anulada"
                        ? "danger"
                        : "mute"
                    }
                  />
                </View>

                {/* Resumen de ítems */}
                <View style={styles.orderItemsBox}>
                  {order.items.map((i, idx) => (
                    <Text key={idx} style={styles.orderItemRow}>
                      • {i.quantity} {i.unit} {i.name} - {formatCLP(i.quantity * i.unitPrice)}
                    </Text>
                  ))}
                  {Boolean(order.notes) && (
                    <Text style={styles.orderNotesTxt}>Nota: {order.notes}</Text>
                  )}
                </View>

                {/* Total y botones de acción */}
                <View style={styles.orderBottom}>
                  <View>
                    <Text style={styles.totalLabel}>Total c/ IVA (19%):</Text>
                    <Text style={styles.totalValue}>{formatCLP(order.total)}</Text>
                  </View>

                  <View style={styles.orderBtnRow}>
                    {/* Botón de Vista Previa PDF Oficial */}
                    <Button
                      title="Vista Previa PDF"
                      variant="outline"
                      size="sm"
                      icon="document-text-outline"
                      onPress={() => setPdfPreviewOrder(order)}
                      style={{ marginRight: 6 }}
                    />

                    {/* Editar: SOLO en borrador */}
                    {isDraft && currentRole === "admin" && (
                      <Button
                        title="Editar"
                        variant="secondary"
                        size="sm"
                        icon="create-outline"
                        onPress={() => handleOpenEditOrder(order)}
                        style={{ marginRight: 6 }}
                      />
                    )}

                    {/* Botón Aprobar y Enviar (solo borrador) */}
                    {isDraft && currentRole === "admin" && (
                      <Button
                        title="Aprobar y Enviar"
                        variant="primary"
                        size="sm"
                        icon="paper-plane-outline"
                        onPress={() => {
                          approveAndSendOrder(order.id);
                          showToast(`Orden ${order.code} aprobada y enviada a proveedor.`);
                        }}
                      />
                    )}

                    {/* Botón Calificar y Cerrar (solo recibida) */}
                    {isReceived && !order.rating && (
                      <Button
                        title="Calificar y Cerrar"
                        variant="success"
                        size="sm"
                        icon="star-outline"
                        onPress={() => {
                          setRateModalOrder(order);
                          setRatingTime(5);
                          setRatingQuality(5);
                          setRatingPrice(5);
                          setRatingComment("");
                        }}
                      />
                    )}

                    {order.rating && (
                      <Badge
                        label={`⭐ ${order.rating.average}/5 (${order.rating.comment || "Calificado"})`}
                        tone="ok"
                        size="sm"
                      />
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
        </ScrollView>
      )}

      {/* =====================================================================
          2. TAB FACTURAS CON CASCADA E IVA (BODEGUERO Y ADMIN)
          ===================================================================== */}
      {activeTab === "facturas" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <Card variant="elevated">
            <Text style={styles.sectionTitle}>Ingreso de Factura de Compra (Bodeguero)</Text>
            <Text style={styles.sectionSubtitle}>
              Valida duplicados por proveedor, calcula hasta 3 descuentos en cascada e IVA (19%) en vivo.
            </Text>

            <View style={styles.formRowTwo}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Proveedor:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {suppliers
                    .filter((s) => !s.disabled)
                    .map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setInvSupplierId(s.id)}
                        style={[
                          styles.chipBtn,
                          invSupplierId === s.id && styles.chipBtnActive,
                        ]}
                      >
                        <Text style={[styles.chipTxt, invSupplierId === s.id && styles.chipTxtActive]}>
                          {s.tradeName || s.businessName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.formRowTwo}>
              <Input
                label="Número de Factura"
                value={invNumber}
                onChangeText={setInvNumber}
                placeholder="Ej: FAC-89301"
                containerStyle={{ flex: 1, marginRight: 8 }}
              />
              <Input
                label="OC Relacionada (Opcional)"
                value={invOrderCode}
                onChangeText={setInvOrderCode}
                placeholder="Ej: OC-2026-101"
                containerStyle={{ flex: 1 }}
              />
            </View>

            {/* Aviso de validación de duplicados */}
            {isInvoiceDuplicate && (
              <View style={styles.duplicateNoticeBox}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={styles.duplicateNoticeTxt}>
                  Atención: Ya existe la Factura N° {invNumber} registrada para este proveedor.
                </Text>
              </View>
            )}

            {/* Insumos con hasta 3 descuentos en cascada */}
            <Text style={styles.formSectionLabel}>Ítems con Descuentos en Cascada (%):</Text>
            {invItems.map((item, idx) => {
              const calc = calculatedInvoiceItems[idx];
              const prod = products.find((p) => p.sku === item.sku);

              // Cálculo del PMP resultante en vivo:
              // PMP nuevo = (Stock actual * PMP actual + Cantidad Factura * P. Neto Factura) / (Stock actual + Cantidad Factura)
              const curStock = prod?.stock || 0;
              const curPmp = prod?.pmp || prod?.unitCost || 0;
              const incomingQty = item.quantity || 0;
              const incomingNetUnit = calc?.netUnitPrice || 0;
              const totalNewQty = curStock + incomingQty;
              const projectedPmp =
                totalNewQty > 0
                  ? Math.round((curStock * curPmp + incomingQty * incomingNetUnit) / totalNewQty)
                  : incomingNetUnit;

              return (
                <View key={idx} style={styles.invoiceItemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.itemSkuText}>{calc.name} ({calc.sku})</Text>
                    <Pressable
                      onPress={() => {
                        if (invItems.length > 1) {
                          setInvItems((prev) => prev.filter((_, i) => i !== idx));
                        }
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                    </Pressable>
                  </View>

                  <View style={styles.discountRow}>
                    <View style={styles.discCol}>
                      <Text style={styles.discLabel}>Cantidad</Text>
                      <TextInput
                        value={String(item.quantity)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setInvItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.discInput}
                      />
                    </View>

                    <View style={styles.discCol}>
                      <Text style={styles.discLabel}>P. Bruto ($)</Text>
                      <TextInput
                        value={String(item.grossPrice)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setInvItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, grossPrice: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.discInput}
                      />
                    </View>

                    <View style={styles.discCol}>
                      <Text style={styles.discLabel}>Desc 1 %</Text>
                      <TextInput
                        value={String(item.disc1)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setInvItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, disc1: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.discInput}
                      />
                    </View>

                    <View style={styles.discCol}>
                      <Text style={styles.discLabel}>Desc 2 %</Text>
                      <TextInput
                        value={String(item.disc2)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setInvItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, disc2: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.discInput}
                      />
                    </View>

                    <View style={styles.discCol}>
                      <Text style={styles.discLabel}>Desc 3 %</Text>
                      <TextInput
                        value={String(item.disc3)}
                        onChangeText={(v) => {
                          const val = Number(v) || 0;
                          setInvItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, disc3: val } : it))
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.discInput}
                      />
                    </View>
                  </View>

                  <View style={styles.calculatedItemFooter}>
                    <Text style={styles.calcNetUnit}>
                      P. Neto Unitario (con cascada): {formatCLP(calc.netUnitPrice)}
                    </Text>
                    <Text style={styles.calcSubtotal}>
                      Subtotal Neto: {formatCLP(calc.subtotalNet)}
                    </Text>
                  </View>

                  {/* Tarjeta con el PMP resultante en vivo */}
                  <View style={styles.pmpImpactCard}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="trending-up" size={14} color={theme.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={styles.pmpImpactTitle}>Proyección de PMP en Bodega:</Text>
                    </View>
                    <Text style={styles.pmpImpactTxt}>
                      Stock Actual: {curStock} {prod?.unit} @ {formatCLP(curPmp)} → Nuevo PMP Proyectado:{" "}
                      <Text style={{ fontWeight: "bold", color: theme.colors.primaryDark }}>
                        {formatCLP(projectedPmp)}
                      </Text>
                    </Text>
                  </View>
                </View>
              );
            })}

            <Button
              title="+ Agregar otro ítem"
              variant="outline"
              size="sm"
              onPress={() => {
                const nextP = products.find((p) => !invItems.some((i) => i.sku === p.sku)) || products[0];
                setInvItems((prev) => [
                  ...prev,
                  { sku: nextP.sku, quantity: 1, grossPrice: nextP.unitCost, disc1: 0, disc2: 0, disc3: 0 },
                ]);
              }}
              style={{ marginVertical: 8 }}
            />

            {/* RESUMEN FINANCIERO EN VIVO */}
            <View style={styles.financialSummaryCard}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Subtotal Neto:</Text>
                <Text style={styles.summaryVal}>{formatCLP(invoiceSubtotalNet)}</Text>
              </View>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>IVA (19%):</Text>
                <Text style={styles.summaryVal}>{formatCLP(invoiceIva)}</Text>
              </View>
              <View style={[styles.summaryLine, styles.summaryTotalLine]}>
                <Text style={styles.totalLabelBig}>Total Factura:</Text>
                <Text style={styles.totalValBig}>{formatCLP(invoiceTotal)}</Text>
              </View>

              {/* Aviso explícito del impacto de stock */}
              <View style={styles.stockNoticeBox}>
                <Ionicons name="information-circle" size={18} color={theme.colors.info} style={{ marginRight: 6 }} />
                <Text style={styles.stockNoticeTxt}>
                  Aviso: El stock físico y el PMP se consolidan y actualizan automáticamente en inventario al confirmar la recepción conforme de la mercancía.
                </Text>
              </View>
            </View>

            {Boolean(invError) && <Text style={styles.errorText}>{invError}</Text>}

            <Button
              title="Registrar Factura"
              variant="primary"
              icon="save-outline"
              disabled={isInvoiceDuplicate}
              onPress={handleSaveInvoice}
              style={{ marginTop: 12 }}
            />
          </Card>
        </ScrollView>
      )}

      {/* =====================================================================
          3. TAB RECEPCIÓN CHECKLIST Y CONTROL DE CALIDAD
          ===================================================================== */}
      {activeTab === "recepcion" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <Text style={styles.sectionTitle}>Recepción Conforme y Control de Calidad</Text>
          <Text style={styles.sectionSubtitle}>
            Verifique la mercancía recibida contra la Orden de Compra. Los ítems defectuosos van directo a cuarentena.
          </Text>

          {/* Selector de OC pendientes */}
          <Text style={styles.fieldLabel}>Seleccionar Orden de Compra Pendiente:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {purchaseOrders
              .filter((o) => o.status === "enviada" || o.status === "recibida_parcial")
              .map((o) => (
                <TouchableOpacity
                  key={o.code}
                  onPress={() => setSelectedOcCode(o.code)}
                  style={[
                    styles.chipBtn,
                    selectedOcCode === o.code && styles.chipBtnActive,
                  ]}
                >
                  <Text style={[styles.chipTxt, selectedOcCode === o.code && styles.chipTxtActive]}>
                    {o.code} - {o.supplier}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {activeReceptionOrder ? (
            <Card variant="elevated">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.ocTitle}>{activeReceptionOrder.code} • {activeReceptionOrder.supplier}</Text>
                  <Text style={styles.orderDate}>RUT: {activeReceptionOrder.supplierRut || "76.xxx.xxx-x"}</Text>
                </View>
                <Badge label={activeReceptionOrder.status.toUpperCase()} tone="info" size="sm" />
              </View>

              {/* Alerta de discrepancia si lo contado no coincide con lo pedido */}
              {hasReceptionDiscrepancy && (
                <View style={styles.discrepancyBanner}>
                  <Ionicons name="warning" size={18} color={theme.colors.warnDark} style={{ marginRight: 6 }} />
                  <Text style={styles.discrepancyBannerTxt}>
                    Alerta: Se detectaron discrepancias entre lo físico verificado y lo solicitado/facturado en la OC.
                  </Text>
                </View>
              )}

              {/* Checklist interactivo por línea */}
              {receptionChecklist.map((item, idx) => {
                const poItem = activeReceptionOrder.items.find((i) => i.sku === item.sku);
                const isDiscrepant = item.received + item.defective + item.missing !== (poItem?.quantity || 0);

                return (
                  <View key={item.sku} style={styles.checkItemCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={styles.checkItemName}>
                        {poItem?.name} ({item.sku})
                      </Text>
                      {isDiscrepant && (
                        <Badge label="Discrepancia" tone="danger" size="sm" />
                      )}
                    </View>
                    <Text style={styles.poExpectedTxt}>
                      Esperado en OC: {poItem?.quantity} {poItem?.unit}
                    </Text>

                    <View style={styles.checkInputRow}>
                      <View style={styles.checkCol}>
                        <Text style={[styles.checkLabel, { color: theme.colors.ok }]}>Conforme</Text>
                        <TextInput
                          value={String(item.received)}
                          onChangeText={(v) => {
                            const val = Number(v) || 0;
                            setReceptionChecklist((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, received: val } : c))
                            );
                          }}
                          keyboardType="numeric"
                          style={[styles.checkInput, { borderColor: theme.colors.ok }]}
                        />
                      </View>

                      <View style={styles.checkCol}>
                        <Text style={[styles.checkLabel, { color: theme.colors.danger }]}>Defectuoso</Text>
                        <TextInput
                          value={String(item.defective)}
                          onChangeText={(v) => {
                            const val = Number(v) || 0;
                            setReceptionChecklist((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, defective: val } : c))
                            );
                          }}
                          keyboardType="numeric"
                          style={[styles.checkInput, { borderColor: theme.colors.danger }]}
                        />
                      </View>

                      <View style={styles.checkCol}>
                        <Text style={[styles.checkLabel, { color: theme.colors.warn }]}>Faltante</Text>
                        <TextInput
                          value={String(item.missing)}
                          onChangeText={(v) => {
                            const val = Number(v) || 0;
                            setReceptionChecklist((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, missing: val } : c))
                            );
                          }}
                          keyboardType="numeric"
                          style={[styles.checkInput, { borderColor: theme.colors.warn }]}
                        />
                      </View>
                    </View>

                    {item.defective > 0 && (
                      <Badge
                        label={`A cuarentena: ${item.defective} ${poItem?.unit}`}
                        tone="danger"
                        size="sm"
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </View>
                );
              })}

              <Button
                title="Confirmar Ingreso a Bodega"
                variant="success"
                icon="checkmark-done-outline"
                onPress={handleConfirmReception}
                style={{ marginTop: 12 }}
              />
            </Card>
          ) : (
            <Card variant="outlined" style={{ padding: 24, alignItems: "center" }}>
              <Ionicons name="checkmark-done-circle-outline" size={32} color={theme.colors.ok} />
              <Text style={{ marginTop: 8, color: theme.colors.textMuted }}>
                No hay órdenes de compra esperando recepción o seleccione una arriba.
              </Text>
            </Card>
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          4. TAB TERCEROS (PROVEEDORES Y CLIENTES)
          ===================================================================== */}
      {activeTab === "terceros" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.subTabBar}>
            <TouchableOpacity
              onPress={() => setThirdPartyTab("proveedores")}
              style={[styles.subTabBtn, thirdPartyTab === "proveedores" && styles.subTabBtnActive]}
            >
              <Text
                style={[
                  styles.subTabTxt,
                  thirdPartyTab === "proveedores" && styles.subTabTxtActive,
                ]}
              >
                Proveedores ({suppliers.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setThirdPartyTab("clientes")}
              style={[styles.subTabBtn, thirdPartyTab === "clientes" && styles.subTabBtnActive]}
            >
              <Text
                style={[
                  styles.subTabTxt,
                  thirdPartyTab === "clientes" && styles.subTabTxtActive,
                ]}
              >
                Clientes ({clients.length})
              </Text>
            </TouchableOpacity>

            <Button
              title={`+ Nuevo ${thirdPartyTab === "proveedores" ? "Proveedor" : "Cliente"}`}
              variant="primary"
              size="sm"
              onPress={handleOpenPartyModal}
            />
          </View>

          {/* Barra de búsqueda y ordenación */}
          <View style={styles.partyFilterRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Buscar Terceros"
                value={thirdPartySearch}
                onChangeText={setThirdPartySearch}
                placeholder="Buscar por RUT, Razón Social o Giro..."
              />
            </View>
            {thirdPartyTab === "proveedores" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42 }}>
                {[
                  { id: "rating_desc", label: "Mayor Calificación ⭐" },
                  { id: "rating_asc", label: "Menor Calificación" },
                  { id: "alpha", label: "Alfabético A-Z" },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setThirdPartySort(s.id as any)}
                    style={[styles.sortChip, thirdPartySort === s.id && styles.sortChipActive]}
                  >
                    <Text style={[styles.sortChipTxt, thirdPartySort === s.id && styles.sortChipTxtActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Lista de Proveedores */}
          {thirdPartyTab === "proveedores" ? (
            filteredSuppliers.map((s) => (
              <Card
                key={s.id}
                variant="default"
                style={[styles.partyCard, s.disabled && styles.disabledPartyCard]}
              >
                <View style={styles.partyTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.partyName}>{s.businessName}</Text>
                      {s.disabled && (
                        <Badge label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <Text style={styles.partyRut}>RUT: {s.rut}</Text>
                    <Text style={styles.partyCat}>{s.category}</Text>
                  </View>
                  <Badge
                    label={`⭐ ${s.ratingAvg?.toFixed(1) || "5.0"} (${s.ratingCount || 1} eval)`}
                    tone="warn"
                    size="md"
                  />
                </View>

                <View style={styles.partyContactBox}>
                  <Text style={styles.contactLine}>Contacto: {s.contactName} • {s.phone}</Text>
                  <Text style={styles.contactLine}>Email: {s.email} • Dirección: {s.address}</Text>
                </View>

                {/* Sección de Datos Bancarios (SOLO VISIBLE PARA ADMIN) */}
                {s.bankDetails && currentRole === "admin" ? (
                  <View style={styles.bankBox}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="card-outline" size={14} color={theme.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={styles.bankTitle}>Datos Bancarios (Exclusivo Admin):</Text>
                    </View>
                    <Text style={styles.bankTxt}>
                      {s.bankDetails.bank} • Cta. {s.bankDetails.accountType} N° {s.bankDetails.accountNumber}
                    </Text>
                    <Text style={styles.bankTxt}>Transferencias: {s.bankDetails.transferEmail}</Text>
                  </View>
                ) : (
                  <View style={styles.restrictedBankBox}>
                    <Ionicons name="lock-closed" size={14} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.restrictedBankTxt}>
                      Datos bancarios protegidos (Visible solo para perfil Administrador)
                    </Text>
                  </View>
                )}

                {/* Acción: Deshabilitar en vez de eliminar */}
                <View style={styles.partyActions}>
                  <Button
                    title={s.disabled ? "Habilitar Proveedor" : "Deshabilitar"}
                    variant={s.disabled ? "success" : "secondary"}
                    size="sm"
                    icon={s.disabled ? "checkmark-circle-outline" : "ban-outline"}
                    onPress={() => {
                      toggleSupplierDisabled(s.id);
                      showToast(`Proveedor ${s.businessName} ${s.disabled ? "habilitado" : "deshabilitado"}.`);
                    }}
                  />
                </View>
              </Card>
            ))
          ) : (
            filteredClients.map((c) => (
              <Card
                key={c.id}
                variant="default"
                style={[styles.partyCard, c.disabled && styles.disabledPartyCard]}
              >
                <View style={styles.partyTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.partyName}>{c.businessName}</Text>
                      {c.disabled && (
                        <Badge label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <Text style={styles.partyRut}>RUT: {c.rut}</Text>
                    <Text style={styles.partyCat}>{c.category}</Text>
                  </View>
                  <Badge
                    label={`${c.activeProjectsCount} obras activas`}
                    tone="info"
                    size="sm"
                  />
                </View>

                <View style={styles.partyContactBox}>
                  <Text style={styles.contactLine}>Contacto: {c.contactName} • {c.phone}</Text>
                  <Text style={styles.contactLine}>Email: {c.email} • Dirección: {c.address}</Text>
                </View>

                {/* Acción: Deshabilitar en vez de eliminar */}
                <View style={styles.partyActions}>
                  <Button
                    title={c.disabled ? "Habilitar Cliente" : "Deshabilitar"}
                    variant={c.disabled ? "success" : "secondary"}
                    size="sm"
                    icon={c.disabled ? "checkmark-circle-outline" : "ban-outline"}
                    onPress={() => {
                      toggleClientDisabled(c.id);
                      showToast(`Cliente ${c.businessName} ${c.disabled ? "habilitado" : "deshabilitado"}.`);
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          MODALES DE APOYO
          ===================================================================== */}

      {/* MODAL 1: FORMULARIO DE ORDEN DE COMPRA (SOLO EDITABLE EN BORRADOR) */}
      <ModalView
        visible={poModal}
        onClose={() => setPoModal(false)}
        title={editingPo ? `Editar Orden: ${editingPo.code}` : "Nueva Orden de Compra"}
        subtitle={editingPo && editingPo.status !== "borrador" ? "Solo lectura (ya aprobada)" : "Editable solo en estado Borrador"}
      >
        {/* 1. PROVEEDOR Y PLAZOS */}
        <Text style={styles.formSectionHeading}>1. Proveedor y Plazo de Entrega</Text>
        <Text style={styles.fieldLabel}>Proveedor:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {suppliers
            .filter((s) => !s.disabled)
            .map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelectedSupplierId(s.id)}
                style={[
                  styles.chipBtn,
                  selectedSupplierId === s.id && styles.chipBtnActive,
                ]}
              >
                <Text style={[styles.chipTxt, selectedSupplierId === s.id && styles.chipTxtActive]}>
                  {s.businessName}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <TouchableOpacity
          onPress={() => setPoIsAutoMin(!poIsAutoMin)}
          style={styles.checkboxRow}
        >
          <Ionicons
            name={poIsAutoMin ? "checkbox" : "square-outline"}
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.checkboxTxt}>
            Marcar como generada automáticamente por stock mínimo
          </Text>
        </TouchableOpacity>

        <Input
          label="Fecha Estimada de Entrega Requerida"
          value={poExpectedDate}
          onChangeText={setPoExpectedDate}
          placeholder="YYYY-MM-DD"
        />

        {/* 2. ÍTEMS REQUERIDOS */}
        <Text style={styles.formSectionHeading}>2. Ítems Requeridos en la Orden</Text>
        <Text style={styles.fieldLabel}>Ítems a ordenar:</Text>
        {poItems.map((item, idx) => {
          const prod = products.find((p) => p.sku === item.sku);
          return (
            <View key={idx} style={styles.poItemFormRow}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.itemSkuText}>{prod ? prod.name : item.sku}</Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(v) => {
                  const val = Number(v) || 0;
                  setPoItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                  );
                }}
                keyboardType="numeric"
                style={styles.poNumInput}
                placeholder="Cant"
              />
              <TextInput
                value={String(item.unitPrice)}
                onChangeText={(v) => {
                  const val = Number(v) || 0;
                  setPoItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it))
                  );
                }}
                keyboardType="numeric"
                style={[styles.poNumInput, { width: 80, marginLeft: 6 }]}
                placeholder="Precio"
              />
            </View>
          );
        })}

        <Button
          title="+ Agregar Insumo"
          variant="outline"
          size="sm"
          onPress={() => {
            const nextProd = products.find((p) => !poItems.some((i) => i.sku === p.sku)) || products[0];
            setPoItems((prev) => [
              ...prev,
              { sku: nextProd.sku, quantity: 10, unitPrice: nextProd.unitCost },
            ]);
          }}
          style={{ marginVertical: 8 }}
        />

        <Input
          label="Observaciones o condiciones de despacho"
          value={poNotes}
          onChangeText={setPoNotes}
          placeholder="Ej: Entregar en bodega central antes de las 16:00"
        />

        {Boolean(poError) && <Text style={styles.errorText}>{poError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Guardar Borrador"
            variant="secondary"
            onPress={() => handleSavePurchaseOrder(true)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Aprobar y Enviar"
            variant="primary"
            icon="paper-plane-outline"
            onPress={() => handleSavePurchaseOrder(false)}
          />
        </View>
      </ModalView>

      {/* MODAL 2: VISTA PREVIA OFICIAL DEL PDF DE LA OC */}
      <ModalView
        visible={Boolean(pdfPreviewOrder)}
        onClose={() => setPdfPreviewOrder(null)}
        title="Vista Previa de Orden de Compra (PDF Oficial)"
        subtitle={pdfPreviewOrder ? `${pdfPreviewOrder.code} • ${pdfPreviewOrder.supplier}` : ""}
      >
        {pdfPreviewOrder && (
          <View style={styles.pdfPageContainer}>
            {/* Encabezado Formal Empresa */}
            <View style={styles.pdfHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pdfCompanyName}>FYAG MULTISYSTEM SpA</Text>
                <Text style={styles.pdfCompanyMeta}>RUT: 76.982.341-K • Giro: Obras e Instalaciones</Text>
                <Text style={styles.pdfCompanyMeta}>Av. El Salto 4001, Huechuraba, Santiago</Text>
                <Text style={styles.pdfCompanyMeta}>Fono: +56 2 2890 4100 • compras@fyag.cl</Text>
              </View>
              <View style={styles.pdfDocBox}>
                <Text style={styles.pdfDocTitle}>ORDEN DE COMPRA</Text>
                <Text style={styles.pdfDocNumber}>{pdfPreviewOrder.code}</Text>
                <Badge
                  label={pdfPreviewOrder.status.toUpperCase()}
                  tone={pdfPreviewOrder.status === "recibida" ? "ok" : "info"}
                  size="sm"
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>

            {/* Recuadro Datos Proveedor */}
            <View style={styles.pdfSectionBox}>
              <Text style={styles.pdfSectionBoxTitle}>DATOS DEL PROVEEDOR:</Text>
              <Text style={styles.pdfSectionTxt}>Razón Social: <Text style={{ fontWeight: "bold" }}>{pdfPreviewOrder.supplier}</Text></Text>
              <Text style={styles.pdfSectionTxt}>RUT: {pdfPreviewOrder.supplierRut || "76.xxx.xxx-x"}</Text>
              <Text style={styles.pdfSectionTxt}>Fecha Emisión: {formatDate(pdfPreviewOrder.date)} • Fecha Entrega: {formatDate(pdfPreviewOrder.expectedDate)}</Text>
            </View>

            {/* Tabla de Ítems */}
            <View style={styles.pdfTable}>
              <View style={styles.pdfTableRowHead}>
                <Text style={[styles.pdfTh, { flex: 2 }]}>Insumo / Descripción</Text>
                <Text style={[styles.pdfTh, { width: 50, textAlign: "center" }]}>Cant</Text>
                <Text style={[styles.pdfTh, { width: 40, textAlign: "center" }]}>Un</Text>
                <Text style={[styles.pdfTh, { width: 75, textAlign: "right" }]}>P. Neto</Text>
                <Text style={[styles.pdfTh, { width: 85, textAlign: "right" }]}>Total Neto</Text>
              </View>
              {pdfPreviewOrder.items.map((i, idx) => (
                <View key={idx} style={styles.pdfTableRow}>
                  <Text style={[styles.pdfTd, { flex: 2 }]}>{i.name} ({i.sku})</Text>
                  <Text style={[styles.pdfTd, { width: 50, textAlign: "center" }]}>{i.quantity}</Text>
                  <Text style={[styles.pdfTd, { width: 40, textAlign: "center" }]}>{i.unit}</Text>
                  <Text style={[styles.pdfTd, { width: 75, textAlign: "right" }]}>{formatCLP(i.unitPrice)}</Text>
                  <Text style={[styles.pdfTd, { width: 85, textAlign: "right", fontWeight: "bold" }]}>
                    {formatCLP(i.quantity * i.unitPrice)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totales con IVA */}
            <View style={styles.pdfTotalsContainer}>
              <View style={styles.pdfTotalLine}>
                <Text style={styles.pdfTotalLbl}>Subtotal Neto:</Text>
                <Text style={styles.pdfTotalVal}>{formatCLP(pdfPreviewOrder.subtotal)}</Text>
              </View>
              <View style={styles.pdfTotalLine}>
                <Text style={styles.pdfTotalLbl}>IVA (19%):</Text>
                <Text style={styles.pdfTotalVal}>{formatCLP(pdfPreviewOrder.iva)}</Text>
              </View>
              <View style={[styles.pdfTotalLine, styles.pdfTotalFinalLine]}>
                <Text style={styles.pdfTotalFinalLbl}>Total c/ IVA (CLP):</Text>
                <Text style={styles.pdfTotalFinalVal}>{formatCLP(pdfPreviewOrder.total)}</Text>
              </View>
            </View>

            {/* Recuadro de Firmas */}
            <View style={styles.pdfSignaturesRow}>
              <View style={styles.pdfSignBox}>
                <View style={styles.pdfSignLine} />
                <Text style={styles.pdfSignTxt}>Autorizado por Administración</Text>
                <Text style={styles.pdfSignSub}>FYAG Multisystem SpA</Text>
              </View>
              <View style={styles.pdfSignBox}>
                <View style={styles.pdfSignLine} />
                <Text style={styles.pdfSignTxt}>Recepción Conforme Bodega</Text>
                <Text style={styles.pdfSignSub}>Firma, Fecha y RUT</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cerrar Vista Previa"
            variant="ghost"
            onPress={() => setPdfPreviewOrder(null)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Descargar PDF (Simulado)"
            variant="primary"
            icon="download-outline"
            onPress={() => {
              showToast("Documento PDF de Orden de Compra descargado exitosamente.");
              setPdfPreviewOrder(null);
            }}
          />
        </View>
      </ModalView>

      {/* MODAL 3: CALIFICACIÓN DEL PROVEEDOR (ESTRELLAS TIEMPO, CALIDAD, PRECIO) */}
      <ModalView
        visible={Boolean(rateModalOrder)}
        onClose={() => setRateModalOrder(null)}
        title="Calificar Proveedor y Cerrar OC"
        subtitle={rateModalOrder ? `${rateModalOrder.supplier} • ${rateModalOrder.code}` : ""}
      >
        <Text style={styles.rateInstruct}>
          Evalúe el desempeño del proveedor para cerrar definitivamente la Orden de Compra:
        </Text>

        {/* Cumplimiento de Tiempo */}
        <StarRating
          label="1. Cumplimiento de Plazo y Tiempo:"
          rating={ratingTime}
          onChangeRating={setRatingTime}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Calidad de Materiales */}
        <StarRating
          label="2. Calidad de Materiales y Embalaje:"
          rating={ratingQuality}
          onChangeRating={setRatingQuality}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Condiciones de Precio */}
        <StarRating
          label="3. Condiciones de Precio y Facturación:"
          rating={ratingPrice}
          onChangeRating={setRatingPrice}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Promedio calculado en vivo */}
        <Card variant="outlined" style={styles.avgRatingCard}>
          <Text style={styles.avgRatingLabel}>Promedio General:</Text>
          <Text style={styles.avgRatingScore}>
            ⭐ {((ratingTime + ratingQuality + ratingPrice) / 3).toFixed(1)} / 5.0
          </Text>
        </Card>

        <Input
          label="Comentario sobre el despacho (opcional)"
          value={ratingComment}
          onChangeText={setRatingComment}
          placeholder="Ej: Entrega puntual y embalaje en perfecto estado."
        />

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setRateModalOrder(null)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Confirmar Calificación y Cerrar OC"
            variant="success"
            onPress={handleSaveRating}
          />
        </View>
      </ModalView>

      {/* MODAL 4: ALTA DE PROVEEDOR / CLIENTE */}
      <ModalView
        visible={partyModal}
        onClose={() => setPartyModal(false)}
        title={thirdPartyTab === "proveedores" ? "Nuevo Proveedor" : "Nuevo Cliente"}
        subtitle="Validación de RUT chileno (módulo 11) y detección de duplicados"
      >
        <Input
          label="RUT Chileno (con guión y dígito verificador)"
          value={partyRut}
          onChangeText={setPartyRut}
          placeholder="Ej: 76.543.210-K"
        />
        <Input
          label="Razón Social"
          value={partyName}
          onChangeText={setPartyName}
          placeholder="Ej: ElectroChile SpA"
        />
        <Input
          label="Nombre de Fantasía (opcional)"
          value={partyTradeName}
          onChangeText={setPartyTradeName}
          placeholder="Ej: ElectroChile"
        />
        <Input
          label="Categoría o Giro Comercial"
          value={partyCategory}
          onChangeText={setPartyCategory}
          placeholder="Ej: Ferretería, Climatización, Inmobiliaria"
        />
        <Input
          label="Teléfono de Contacto"
          value={partyPhone}
          onChangeText={setPartyPhone}
          placeholder="+56 9 1234 5678"
        />
        <Input
          label="Correo Electrónico"
          value={partyEmail}
          onChangeText={setPartyEmail}
          placeholder="contacto@empresa.cl"
        />
        <Input
          label="Dirección Comercial"
          value={partyAddress}
          onChangeText={setPartyAddress}
          placeholder="Av. Providencia 123, Santiago"
        />
        <Input
          label="Persona de Contacto"
          value={partyContact}
          onChangeText={setPartyContact}
          placeholder="Ej: Rodrigo Valenzuela"
        />

        {thirdPartyTab === "proveedores" && (
          <View style={styles.bankFieldsContainer}>
            <Text style={styles.formSectionLabel}>Datos Bancarios de Transferencia:</Text>
            <Input
              label="Banco"
              value={bankName}
              onChangeText={setBankName}
              placeholder="Banco de Chile, Santander, BCI..."
            />
            <Text style={styles.fieldLabel}>Tipo de Cuenta:</Text>
            <View style={styles.accountTypeRow}>
              {(["corriente", "vista", "ahorro"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setAccountType(t)}
                  style={[
                    styles.accountTypeBtn,
                    accountType === t && styles.accountTypeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.accountTypeTxt,
                      accountType === t && styles.accountTypeTxtActive,
                    ]}
                  >
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              label="Número de Cuenta"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
              placeholder="00-123456-78"
            />
          </View>
        )}

        {Boolean(partyError) && <Text style={styles.errorText}>{partyError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setPartyModal(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title={`Guardar ${thirdPartyTab === "proveedores" ? "Proveedor" : "Cliente"}`}
            variant="primary"
            onPress={handleSaveParty}
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
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginLeft: 4,
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
    paddingBottom: 48,
  },
  topActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  subHeading: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  statusFilterScroll: {
    marginBottom: theme.spacing.md,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  statusChipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  statusChipTextActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  orderCard: {
    marginBottom: theme.spacing.md,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codeWithAutoBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  orderSupplier: {
    fontSize: theme.fontSize.md,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 2,
  },
  orderDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orderItemsBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  orderItemRow: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginVertical: 1,
  },
  orderNotesTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginTop: 4,
  },
  orderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  totalLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  totalValue: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  orderBtnRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  chipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  chipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  formRowTwo: {
    flexDirection: "row",
  },
  duplicateNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: theme.radius.sm,
    padding: 8,
    marginBottom: theme.spacing.sm,
  },
  duplicateNoticeTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginLeft: 6,
    fontWeight: "600",
  },
  formSectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginVertical: 6,
  },
  invoiceItemCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: 8,
  },
  itemSkuText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  discountRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  discCol: {
    flex: 1,
    marginRight: 4,
  },
  discLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  discInput: {
    height: 34,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  calculatedItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  calcNetUnit: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "600",
  },
  calcSubtotal: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  pmpImpactCard: {
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
    borderWidth: theme.borders.thin,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  pmpImpactTitle: {
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.okDark,
  },
  pmpImpactTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.okDark,
    marginTop: 2,
  },
  financialSummaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  summaryVal: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  summaryTotalLine: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  totalLabelBig: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  totalValBig: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  stockNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: 10,
  },
  stockNoticeTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.primaryDark,
    flex: 1,
  },
  ocTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  discrepancyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.warnBorder,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  discrepancyBannerTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warnDark,
    fontWeight: theme.fontWeight.semibold,
    flex: 1,
  },
  checkItemCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginVertical: 6,
  },
  checkItemName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  poExpectedTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginVertical: 2,
  },
  checkInputRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  checkCol: {
    flex: 1,
    marginRight: 6,
  },
  checkLabel: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  checkInput: {
    height: 36,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  subTabBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  subTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subTabBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  subTabTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  subTabTxtActive: {
    color: "#ffffff",
  },
  partyFilterRow: {
    marginBottom: theme.spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  sortChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  sortChipTxt: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sortChipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  partyCard: {
    marginBottom: theme.spacing.sm,
  },
  disabledPartyCard: {
    opacity: 0.55,
  },
  partyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  partyName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  partyRut: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: "600",
  },
  partyCat: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  partyContactBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginVertical: 6,
  },
  contactLine: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginVertical: 1,
  },
  bankBox: {
    backgroundColor: "#eff6ff",
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginVertical: 4,
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  bankTxt: {
    fontSize: 11,
    color: "#1e40af",
    marginTop: 1,
  },
  restrictedBankBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 6,
    marginVertical: 4,
  },
  restrictedBankTxt: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
  partyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  checkboxTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginLeft: 6,
  },
  poItemFormRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 6,
    marginBottom: 4,
  },
  poNumInput: {
    width: 60,
    height: 34,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginVertical: 4,
  },
  rateInstruct: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  avgRatingCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    padding: 10,
    marginVertical: 8,
  },
  avgRatingLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: "#92400e",
  },
  avgRatingScore: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: "#b45309",
  },
  bankFieldsContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginVertical: theme.spacing.sm,
  },
  accountTypeRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.sm,
  },
  accountTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    marginRight: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountTypeBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  accountTypeTxt: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
  },
  accountTypeTxtActive: {
    color: "#ffffff",
  },
  // --- PDF PREVIEW STYLES ---
  pdfPageContainer: {
    backgroundColor: "#ffffff",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  pdfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primaryDark,
    paddingBottom: 10,
    marginBottom: 10,
  },
  pdfCompanyName: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  pdfCompanyMeta: {
    fontSize: 9,
    color: "#475569",
    marginTop: 1,
  },
  pdfDocBox: {
    borderWidth: 1.5,
    borderColor: theme.colors.primaryDark,
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
    width: 130,
    backgroundColor: "#f8fafc",
  },
  pdfDocTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    letterSpacing: 0.5,
  },
  pdfDocNumber: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0f172a",
    marginVertical: 2,
  },
  pdfSectionBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  pdfSectionBoxTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 2,
  },
  pdfSectionTxt: {
    fontSize: 10,
    color: "#1e293b",
    marginTop: 1,
  },
  pdfTable: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  pdfTableRowHead: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  pdfTh: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
  },
  pdfTableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pdfTd: {
    fontSize: 9,
    color: "#1e293b",
  },
  pdfTotalsContainer: {
    alignItems: "flex-end",
    marginVertical: 6,
  },
  pdfTotalLine: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 180,
    marginVertical: 1,
  },
  pdfTotalLbl: {
    fontSize: 10,
    color: "#475569",
    marginRight: 8,
  },
  pdfTotalVal: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
  },
  pdfTotalFinalLine: {
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    paddingTop: 3,
    marginTop: 2,
  },
  pdfTotalFinalLbl: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginRight: 8,
  },
  pdfTotalFinalVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  pdfSignaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 8,
  },
  pdfSignBox: {
    width: 140,
    alignItems: "center",
  },
  pdfSignLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    marginBottom: 4,
  },
  pdfSignTxt: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
  },
  pdfSignSub: {
    fontSize: 8,
    color: "#64748b",
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
