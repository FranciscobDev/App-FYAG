import React, { useEffect, useState } from "react";
import {
  FlatList,
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
import { formatCLP, formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ExportButton,
  Input,
  ModalView,
  NumberInput,
  PageHeader,
  ProgressBar,
  QrScannerModal,
  StockCell,
  ScreenStateWrapper,
  Toast,
} from "@/components/common";
import {
  CardexEntry,
  Kit,
  KitItem,
  MaterialRequest,
  MaterialRequestItem,
  PhysicalCount,
  Product,
  WasteRecord,
} from "@/core/types";

export type InventoryTab =
  | "catalogo"
  | "cardex"
  | "solicitudes"
  | "egreso"
  | "mermas"
  | "conteo"
  | "kits";

export interface InventoryScreenProps {
  initialTab?: InventoryTab;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ initialTab = "catalogo" }) => {
  const {
    products,
    cardex,
    materialRequests,
    projects,
    kits,
    technicians,
    wasteRecords,
    physicalCounts,
    addProduct,
    updateProduct,
    toggleProductDisabled,
    createWasteRecord,
    createPhysicalCount,
    approvePhysicalCount,
    rejectPhysicalCount,
    createKit,
    updateKit,
    createMaterialRequest,
    approveMaterialRequest,
    rejectMaterialRequest,
    modifyMaterialRequest,
    cancelMaterialRequest,
    dispatchMaterialRequest,
  } = useApp();

  const { currentRole, user } = useAuth();

  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- REUSABLE QR SCANNER ---
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerCallback, setScannerCallback] = useState<((code: string) => void) | null>(null);
  const [scannerTitle, setScannerTitle] = useState("Escáner Óptico de Bodega");

  const openScanner = (title: string, onScan: (code: string) => void) => {
    setScannerTitle(title);
    setScannerCallback(() => onScan);
    setScannerVisible(true);
  };

  // =========================================================================
  // 1. CATALOGO STATE
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState("");
  const [newProductModal, setNewProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Electricidad");
  const [formUnit, setFormUnit] = useState<"un" | "kg" | "m" | "l">("un");
  const [formStock, setFormStock] = useState("0");
  const [formMinStock, setFormMinStock] = useState("10");
  const [formRestock, setFormRestock] = useState("50");
  const [formSupplier, setFormSupplier] = useState("ElectroChile SpA");
  const [formBarcode, setFormBarcode] = useState("");
  const [formIsBulk, setFormIsBulk] = useState(false);
  const [formContainerCapacity, setFormContainerCapacity] = useState("100");
  const [formError, setFormError] = useState("");

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setFormSku("");
    setFormName("");
    setFormCategory("Electricidad");
    setFormUnit("un");
    setFormStock("0");
    setFormMinStock("10");
    setFormRestock("50");
    setFormSupplier("ElectroChile SpA");
    setFormBarcode("");
    setFormIsBulk(false);
    setFormContainerCapacity("100");
    setFormError("");
    setNewProductModal(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setFormSku(prod.sku);
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormUnit((prod.unit as any) || "un");
    setFormStock(String(prod.stock));
    setFormMinStock(String(prod.minStock));
    setFormRestock(String(prod.restockQuantity || 50));
    setFormSupplier(prod.defaultSupplier || "");
    setFormBarcode(prod.barcode || "");
    setFormIsBulk(Boolean(prod.isBulk));
    setFormContainerCapacity(String(prod.containerCapacity || 100));
    setFormError("");
    setNewProductModal(true);
  };

  const handleSaveProduct = () => {
    if (!formSku.trim() || !formName.trim()) {
      setFormError("SKU y Nombre son campos requeridos.");
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.sku, {
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        minStock: Number(formMinStock) || 0,
        restockQuantity: Number(formRestock) || 0,
        defaultSupplier: formSupplier.trim(),
        barcode: formBarcode.trim() || undefined,
        isBulk: formIsBulk,
        containerCapacity: formIsBulk ? Number(formContainerCapacity) || 100 : undefined,
      });
      showToast(`Insumo ${editingProduct.sku} actualizado exitosamente.`);
      setNewProductModal(false);
    } else {
      const res = addProduct({
        sku: formSku.trim().toUpperCase(),
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        stock: formIsBulk ? Number(Number(formStock).toFixed(3)) : Number(formStock) || 0,
        minStock: Number(formMinStock) || 0,
        unitCost: 1000,
        pmp: 1000,
        location: "Bodega Principal - Estante B",
        restockQuantity: Number(formRestock) || 0,
        defaultSupplier: formSupplier.trim() || "Proveedor General",
        barcode: formBarcode.trim() || undefined,
        committed: 0,
        quarantine: 0,
        isBulk: formIsBulk,
        containerCapacity: formIsBulk ? Number(formContainerCapacity) || 100 : undefined,
      });
      if (!res.success) {
        setFormError(res.error || "Error al guardar insumo.");
      } else {
        showToast(`Insumo ${formSku.toUpperCase()} creado exitosamente.`);
        setNewProductModal(false);
      }
    }
  };

  // =========================================================================
  // 2. CARDEX STATE
  // =========================================================================
  const [kardexFilterSku, setKardexFilterSku] = useState("");
  const [kardexFilterType, setKardexFilterType] = useState<string>("todos");
  const [kardexFilterProject, setKardexFilterProject] = useState<string>("todos");
  const [kardexDateRange, setKardexDateRange] = useState<"todos" | "7d" | "30d">("todos");

  const filteredCardex = cardex.filter((entry) => {
    if (kardexFilterSku) {
      const q = kardexFilterSku.toLowerCase();
      const matchSku = entry.sku.toLowerCase().includes(q);
      const matchName = entry.productName.toLowerCase().includes(q);
      if (!matchSku && !matchName) return false;
    }
    if (kardexFilterType !== "todos" && entry.type !== kardexFilterType) {
      return false;
    }
    if (kardexFilterProject !== "todos" && entry.projectCode !== kardexFilterProject) {
      return false;
    }
    return true;
  });

  const handleExportCardex = (format: "pdf" | "excel") => {
    showToast(`Cardex exportado exitosamente a formato ${format.toUpperCase()}.`);
  };

  // =========================================================================
  // 3. SOLICITUDES STATE
  // =========================================================================
  const [reqTab, setReqTab] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">("todas");
  const [newRequestModal, setNewRequestModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [reqItems, setReqItems] = useState<{ sku: string; quantity: number }[]>([]);
  const [reqUrgency, setReqUrgency] = useState<"normal" | "alta" | "urgente">("normal");
  const [reqComment, setReqComment] = useState("");
  const [reqError, setReqError] = useState("");
  const [missingStockErrors, setMissingStockErrors] = useState<string[]>([]);

  // Timeline modal
  const [selectedTimelineReq, setSelectedTimelineReq] = useState<MaterialRequest | null>(null);

  // Rejection modal
  const [rejectModalReq, setRejectModalReq] = useState<MaterialRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const activeProjects = projects.filter((p) => p.status !== "cerrado");

  // Validar faltantes de stock en tiempo real
  const calculateMissingStock = (items: { sku: string; quantity: number }[]) => {
    const missing: string[] = [];
    items.forEach((it) => {
      const p = products.find((prod) => prod.sku === it.sku);
      const avail = p ? p.stock : 0;
      if (avail < it.quantity) {
        missing.push(
          `${p ? p.name : it.sku}: Faltan ${Number((it.quantity - avail).toFixed(3))} ${p?.unit || "un"} (Disp: ${avail}, Solicitado: ${it.quantity})`
        );
      }
    });
    return missing;
  };

  const handleOpenNewRequest = () => {
    setSelectedProjectId(activeProjects[0]?.id || "");
    const initialItems = [{ sku: products[0]?.sku || "", quantity: 1 }];
    setReqItems(initialItems);
    setReqUrgency("normal");
    setReqComment("");
    setReqError("");
    setMissingStockErrors(calculateMissingStock(initialItems));
    setNewRequestModal(true);
  };

  const handleSelectKitForRequest = (kit: Kit) => {
    const itemsFromKit = kit.items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
    setReqItems(itemsFromKit);
    setMissingStockErrors(calculateMissingStock(itemsFromKit));
  };

  const handleReqItemChange = (idx: number, sku: string, quantity: number) => {
    const updated = reqItems.map((it, i) => (i === idx ? { sku, quantity } : it));
    setReqItems(updated);
    setMissingStockErrors(calculateMissingStock(updated));
  };

  const handleSubmitRequest = () => {
    if (reqItems.length === 0) {
      setReqError("Debe agregar al menos un insumo.");
      return;
    }

    const currentMissing = calculateMissingStock(reqItems);
    if (currentMissing.length > 0) {
      setMissingStockErrors(currentMissing);
      setReqError("No se puede enviar: hay ítems con stock insuficiente en bodega.");
      return;
    }

    const itemsToSend: MaterialRequestItem[] = reqItems.map((it) => {
      const p = products.find((prod) => prod.sku === it.sku);
      return {
        sku: it.sku,
        name: p ? p.name : it.sku,
        quantity: it.quantity,
        unit: p ? p.unit : "un",
      };
    });

    const res = createMaterialRequest(
      selectedProjectId,
      user.rut,
      itemsToSend,
      reqUrgency,
      reqComment
    );

    if (!res.success) {
      setReqError(res.error || "No se pudo crear la solicitud.");
      setMissingStockErrors(res.missingItems || []);
    } else {
      showToast("Solicitud de materiales enviada con éxito.");
      setNewRequestModal(false);
    }
  };

  const filteredRequests = materialRequests.filter((r) => {
    if (reqTab === "todas") return true;
    return r.status === reqTab;
  });

  // =========================================================================
  // 4. EGRESO (DESPACHO) STATE
  // =========================================================================
  const [selectedDispatchReqId, setSelectedDispatchReqId] = useState<string>("");
  const [dispatchTechRut, setDispatchTechRut] = useState<string>(technicians[0]?.rut || "");
  const [dispatchQuantities, setDispatchQuantities] = useState<{ [sku: string]: number }>({});
  const [confirmDispatchVisible, setConfirmDispatchVisible] = useState(false);
  const [dispatchError, setDispatchError] = useState("");

  const approvedRequests = materialRequests.filter(
    (r) =>
      r.status === "aprobada" &&
      r.items.some((it) => (it.deliveredQuantity || 0) < it.quantity)
  );

  const activeDispatchReq = materialRequests.find((r) => r.id === selectedDispatchReqId);

  const handleSelectDispatchReq = (reqId: string) => {
    setSelectedDispatchReqId(reqId);
    const req = materialRequests.find((r) => r.id === reqId);
    if (req) {
      // Por defecto sugerir la cantidad pendiente
      const initQtys: { [sku: string]: number } = {};
      req.items.forEach((it) => {
        const pending = Math.max(0, it.quantity - (it.deliveredQuantity || 0));
        const prod = products.find((p) => p.sku === it.sku);
        const maxAvail = prod ? prod.stock : 0;
        // Sugerir lo pendiente, pero sin sobrepasar el stock físico
        initQtys[it.sku] = Math.min(pending, maxAvail);
      });
      setDispatchQuantities(initQtys);
      setDispatchError("");
    }
  };

  const handleDispatchQtyChange = (sku: string, val: string) => {
    const num = parseFloat(val) || 0;
    setDispatchQuantities((prev) => ({ ...prev, [sku]: num }));
  };

  const handleInitiateDispatch = () => {
    if (!activeDispatchReq) return;
    setDispatchError("");

    // Validar que al menos un item tenga cantidad > 0
    const hasItems = Object.values(dispatchQuantities).some((qty) => qty > 0);
    if (!hasItems) {
      setDispatchError("Debe indicar una cantidad mayor a 0 para al menos un insumo.");
      return;
    }

    // Validar stock disponible y que no supere lo pendiente
    for (const it of activeDispatchReq.items) {
      const qtyToDispatch = dispatchQuantities[it.sku] || 0;
      if (qtyToDispatch <= 0) continue;

      const prod = products.find((p) => p.sku === it.sku);
      if (!prod || prod.stock < qtyToDispatch) {
        setDispatchError(
          `Stock insuficiente para ${prod?.name || it.sku}. Disponible: ${prod?.stock || 0}, a despachar: ${qtyToDispatch}`
        );
        return;
      }

      const pending = Math.max(0, it.quantity - (it.deliveredQuantity || 0));
      if (qtyToDispatch > pending) {
        setDispatchError(
          `La cantidad a despachar de ${prod?.name || it.sku} (${qtyToDispatch}) excede la pendiente (${pending}).`
        );
        return;
      }
    }

    setConfirmDispatchVisible(true);
  };

  const handleExecuteDispatch = () => {
    if (!activeDispatchReq) return;

    const tech = technicians.find((t) => t.rut === dispatchTechRut);
    const itemsToDispatch = Object.entries(dispatchQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sku, quantity]) => ({ sku, quantity }));

    const res = dispatchMaterialRequest(
      activeDispatchReq.id,
      itemsToDispatch,
      dispatchTechRut,
      tech ? tech.name : "Técnico",
      user.name
    );

    setConfirmDispatchVisible(false);

    if (res.success) {
      showToast("Egreso registrado con éxito en bodega y Cardex.");
      setSelectedDispatchReqId("");
      setDispatchQuantities({});
    } else {
      setDispatchError(res.error || "No se pudo registrar el egreso.");
    }
  };

  // =========================================================================
  // 5. MERMAS STATE
  // =========================================================================
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [wasteSku, setWasteSku] = useState(products[0]?.sku || "");
  const [wasteQty, setWasteQty] = useState("1");
  const [wasteReason, setWasteReason] = useState<"daño" | "caducidad" | "pérdida" | "otro">("daño");
  const [wasteObs, setWasteObs] = useState("");
  const [wasteError, setWasteError] = useState("");

  const selectedWasteProd = products.find((p) => p.sku === wasteSku);
  const wasteQtyNum = parseFloat(wasteQty) || 0;
  const wasteTotalLoss = wasteQtyNum * (selectedWasteProd?.pmp || selectedWasteProd?.unitCost || 0);

  const handleOpenWasteModal = () => {
    const validProd = products.find((p) => !p.disabled && p.stock > 0) || products[0];
    if (validProd) setWasteSku(validProd.sku);
    setWasteQty("1");
    setWasteReason("daño");
    setWasteObs("");
    setWasteError("");
    setWasteModalVisible(true);
  };

  const handleRegisterWaste = () => {
    if (!wasteObs.trim() || wasteObs.trim().length < 5) {
      setWasteError("La observación detallada es obligatoria (mínimo 5 caracteres).");
      return;
    }
    if (wasteQtyNum <= 0) {
      setWasteError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (selectedWasteProd && wasteQtyNum > selectedWasteProd.stock) {
      setWasteError(`La cantidad no puede superar el stock disponible (${selectedWasteProd.stock}).`);
      return;
    }

    const res = createWasteRecord({
      sku: wasteSku,
      productName: selectedWasteProd ? selectedWasteProd.name : wasteSku,
      quantity: selectedWasteProd?.isBulk ? Number(wasteQtyNum.toFixed(3)) : wasteQtyNum,
      unit: selectedWasteProd ? selectedWasteProd.unit : "un",
      pmp: selectedWasteProd?.pmp || selectedWasteProd?.unitCost || 0,
      totalLoss: wasteTotalLoss,
      reason: wasteReason,
      observation: wasteObs.trim(),
      user: user.name,
    });

    if (res.success) {
      showToast("Merma registrada y descontada de inventario.");
      setWasteModalVisible(false);
    } else {
      setWasteError(res.error || "No se pudo registrar la merma.");
    }
  };

  // =========================================================================
  // 6. CONTEO FISICO STATE
  // =========================================================================
  const [countModalVisible, setCountModalVisible] = useState(false);
  const [countSku, setCountSku] = useState(products[0]?.sku || "");
  const [countPhysicalQty, setCountPhysicalQty] = useState("0");
  const [countNotes, setCountNotes] = useState("");
  const [countError, setCountError] = useState("");

  const selectedCountProd = products.find((p) => p.sku === countSku);
  const countQtyNum = parseFloat(countPhysicalQty) || 0;
  const countSysStock = selectedCountProd ? selectedCountProd.stock : 0;
  const countDiff = countQtyNum - countSysStock;
  const countDiffPct = countSysStock > 0 ? (countDiff / countSysStock) * 100 : countQtyNum > 0 ? 100 : 0;
  const countDiffVal = countDiff * (selectedCountProd?.pmp || selectedCountProd?.unitCost || 0);
  const countRequiresApproval = Math.abs(countDiffPct) > 5;

  const handleOpenCountModal = () => {
    const prod = products[0];
    if (prod) {
      setCountSku(prod.sku);
      setCountPhysicalQty(String(prod.stock));
    }
    setCountNotes("");
    setCountError("");
    setCountModalVisible(true);
  };

  const handleRegisterCount = () => {
    if (!countSku) {
      setCountError("Seleccione un insumo.");
      return;
    }

    const res = createPhysicalCount(
      countSku,
      selectedCountProd?.isBulk ? Number(countQtyNum.toFixed(3)) : countQtyNum,
      countNotes.trim() || undefined,
      user.name
    );

    if (res.success) {
      if (res.requiresApproval) {
        showToast("Conteo registrado: Discrepancia > 5% enviada a aprobación de Admin. Insumo bloqueado.");
      } else {
        showToast("Conteo registrado y ajustado directamente en bodega (≤ 5%).");
      }
      setCountModalVisible(false);
    } else {
      setCountError(res.error || "No se pudo registrar el conteo.");
    }
  };

  // =========================================================================
  // 7. KITS STATE
  // =========================================================================
  const [kitModalVisible, setKitModalVisible] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [kitFormId, setKitFormId] = useState("");
  const [kitFormName, setKitFormName] = useState("");
  const [kitFormCategory, setKitFormCategory] = useState("Eléctrico");
  const [kitFormDesc, setKitFormDesc] = useState("");
  const [kitFormItems, setKitFormItems] = useState<KitItem[]>([]);
  const [kitFormError, setKitFormError] = useState("");

  const handleOpenNewKit = () => {
    setEditingKitId(null);
    setKitFormId(`KIT-GEN-0${kits.length + 1}`);
    setKitFormName("");
    setKitFormCategory("General");
    setKitFormDesc("");
    setKitFormItems([
      { sku: products[0]?.sku || "", name: products[0]?.name || "", quantity: 1, unit: products[0]?.unit || "un" },
    ]);
    setKitFormError("");
    setKitModalVisible(true);
  };

  const handleOpenEditKit = (kit: Kit) => {
    setEditingKitId(kit.id);
    setKitFormId(kit.id);
    setKitFormName(kit.name);
    setKitFormCategory(kit.category);
    setKitFormDesc(kit.description);
    setKitFormItems([...kit.items]);
    setKitFormError("");
    setKitModalVisible(true);
  };

  const handleSaveKit = () => {
    if (!kitFormId.trim() || !kitFormName.trim()) {
      setKitFormError("Código ID y Nombre son obligatorios.");
      return;
    }
    if (kitFormItems.length === 0) {
      setKitFormError("El kit debe tener al menos un insumo.");
      return;
    }

    if (editingKitId) {
      updateKit(editingKitId, {
        name: kitFormName.trim(),
        category: kitFormCategory,
        description: kitFormDesc.trim(),
        items: kitFormItems,
      });
      showToast(`Kit ${editingKitId} actualizado.`);
      setKitModalVisible(false);
    } else {
      const res = createKit({
        id: kitFormId.trim().toUpperCase(),
        name: kitFormName.trim(),
        category: kitFormCategory,
        description: kitFormDesc.trim(),
        items: kitFormItems,
      });
      if (res.success) {
        showToast(`Kit ${kitFormId.toUpperCase()} creado exitosamente.`);
        setKitModalVisible(false);
      } else {
        setKitFormError(res.error || "Error al crear kit.");
      }
    }
  };

  // Helper de disponibilidad del kit
  const getKitAvailability = (kit: Kit) => {
    let maxKits = Infinity;
    const missingItems: string[] = [];

    kit.items.forEach((it) => {
      const prod = products.find((p) => p.sku === it.sku);
      const avail = prod ? prod.stock : 0;
      const possible = Math.floor(avail / it.quantity);
      if (possible < maxKits) maxKits = possible;

      if (avail < it.quantity) {
        missingItems.push(`${prod ? prod.name : it.sku} (disp: ${avail}, req: ${it.quantity})`);
      }
    });

    if (maxKits === Infinity) maxKits = 0;
    return {
      availableKits: maxKits,
      isAvailable: maxKits > 0,
      missingItems,
    };
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <ScreenStateWrapper screenTitle="Inventario y Bodega" skeletonType="table">
    <View style={styles.container}>
      {/* Toast Notification */}
      <Toast
        visible={Boolean(toastMessage)}
        message={toastMessage || ""}
        onDismiss={() => setToastMessage(null)}
      />

      {/* ENCABEZADO CON MIGAS DE PAN Y ACCIÓN PRINCIPAL */}
      <PageHeader
        title="Inventario & Cardex"
        subtitle="Control de existencias, kardex físico valorizado y egresos a faena"
        breadcrumbs={["Inicio", "Operación", "Inventario & Cardex"]}
        rightAction={
          currentRole === "admin" ? (
            <Button
              title="+ Nuevo Insumo"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={handleOpenNewProduct}
            />
          ) : undefined
        }
      />

      {/* TOP NAVIGATION TABS (Scroll horizontal para tablet y móvil) */}
      <View style={styles.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {[
            { id: "catalogo", label: `Catálogo (${products.length})`, icon: "cube-outline" },
            { id: "cardex", label: "Cardex", icon: "swap-horizontal-outline" },
            {
              id: "solicitudes",
              label: `Solicitudes (${materialRequests.filter((r) => r.status === "pendiente").length})`,
              icon: "clipboard-outline",
            },
            {
              id: "egreso",
              label: `Egreso (${approvedRequests.length})`,
              icon: "log-out-outline",
            },
            { id: "mermas", label: `Mermas (${wasteRecords.length})`, icon: "trash-outline" },
            {
              id: "conteo",
              label: `Conteo Físico (${physicalCounts.filter((c) => c.status === "pendiente_aprobacion").length})`,
              icon: "checkbox-outline",
            },
            { id: "kits", label: `Kits (${kits.length})`, icon: "layers-outline" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as InventoryTab)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* =====================================================================
          1. TAB CATALOGO
          ===================================================================== */}
      {activeTab === "catalogo" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.topCatalogBar}>
            <View style={styles.searchWrapper}>
              <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por SKU o nombre..."
                placeholderTextColor={theme.colors.textLight}
                style={styles.searchInput}
              />
              {Boolean(searchQuery) && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </View>

            <TouchableOpacity
              onPress={() =>
                openScanner("Escanear SKU para Buscar", (code) => {
                  setSearchQuery(code);
                })
              }
              style={styles.scanQuickBtn}
              accessibilityLabel="Escanear código de barras o QR"
            >
              <Ionicons name="barcode-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>

            {/* Botón «Nuevo insumo» SOLO Admin */}
            {currentRole === "admin" && (
              <Button
                title="Nuevo insumo"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={handleOpenNewProduct}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          {filteredProducts.map((p) => {
            const isLowStock = p.stock <= p.minStock;
            return (
              <Card
                key={p.sku}
                variant={isLowStock ? "outlined" : "default"}
                style={[
                  styles.productCard,
                  isLowStock && styles.lowStockCard,
                  p.disabled && styles.disabledCard,
                ]}
              >
                <View style={styles.productTopRow}>
                  <View style={styles.skuBadgeBox}>
                    <Text style={styles.skuTitle}>{p.sku}</Text>
                    {p.isBulk && (
                      <Badge label="Granel (3 dec)" tone="info" size="sm" style={{ marginLeft: 6 }} />
                    )}
                    {p.disabled && (
                      <Badge label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                    )}
                  </View>
                  {isLowStock ? (
                    <Badge label="Stock Crítico (≤ Mín)" tone="danger" size="sm" />
                  ) : (
                    <Badge label="Stock Normal" tone="ok" size="sm" />
                  )}
                </View>

                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.categoryText}>
                  {p.category} • Ubicación: {p.location} • Prov: {p.defaultSupplier || "No asignado"}
                </Text>

                {/* Stock Cell Component / Grid de disponible, comprometido, cuarentena y mínimo */}
                <StockCell
                  available={p.stock}
                  committed={p.committed || 0}
                  quarantine={p.quarantine || 0}
                  minStock={p.minStock}
                  unit={p.unit}
                />

                {/* Granel - Barra de capacidad restante si aplica */}
                {p.isBulk && p.containerCapacity && (
                  <View style={styles.bulkCapacityBox}>
                    <ProgressBar
                      value={p.stock}
                      max={p.containerCapacity}
                      height={6}
                      showPercentage
                      semaforo
                      label={`Capacidad contenedor (${p.stock.toFixed(3)} / ${p.containerCapacity} ${p.unit})`}
                    />
                  </View>
                )}

                {/* Acciones: Editar y Deshabilitar (NUNCA eliminar) */}
                <View style={styles.productActionsRow}>
                  <View style={styles.pmpBox}>
                    <Text style={styles.pmpLabel}>PMP Unitario:</Text>
                    <Text style={styles.pmpVal}>{formatCLP(p.pmp || p.unitCost)}</Text>
                  </View>

                  <View style={styles.btnRow}>
                    <Button
                      title="Editar"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => handleOpenEditProduct(p)}
                      style={{ marginRight: 6 }}
                    />
                    <Button
                      title={p.disabled ? "Habilitar" : "Deshabilitar"}
                      variant={p.disabled ? "success" : "secondary"}
                      size="sm"
                      icon={p.disabled ? "checkmark-circle-outline" : "ban-outline"}
                      onPress={() => {
                        toggleProductDisabled(p.sku);
                        showToast(`Insumo ${p.sku} ${p.disabled ? "habilitado" : "deshabilitado"}.`);
                      }}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* =====================================================================
          2. TAB CARDEX (Solo lectura con exportar Excel)
          ===================================================================== */}
      {activeTab === "cardex" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.filterSection}>
            <View style={styles.filterHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  value={kardexFilterSku}
                  onChangeText={setKardexFilterSku}
                  placeholder="Filtrar por SKU o nombre..."
                  placeholderTextColor={theme.colors.textLight}
                  style={styles.cardexSearchInput}
                />
              </View>
              <ExportButton onExport={handleExportCardex} title="Excel" size="sm" />
            </View>

            {/* Filtro por tipo de movimiento */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilterScroll}>
              {[
                { id: "todos", label: "Todos los movimientos" },
                { id: "entrada_compra", label: "Entradas Compra" },
                { id: "salida_obra", label: "Salidas a Obra" },
                { id: "devolucion", label: "Devoluciones" },
                { id: "merma", label: "Mermas" },
                { id: "ajuste_conteo", label: "Ajustes Conteo" },
              ].map((tf) => (
                <TouchableOpacity
                  key={tf.id}
                  onPress={() => setKardexFilterType(tf.id)}
                  style={[styles.typeChip, kardexFilterType === tf.id && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipLabel, kardexFilterType === tf.id && styles.typeChipLabelActive]}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filtro por proyecto */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.typeFilterScroll, { marginTop: 4 }]}>
              <TouchableOpacity
                onPress={() => setKardexFilterProject("todos")}
                style={[styles.typeChip, kardexFilterProject === "todos" && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipLabel, kardexFilterProject === "todos" && styles.typeChipLabelActive]}>
                  Todos los proyectos
                </Text>
              </TouchableOpacity>
              {projects.map((pr) => (
                <TouchableOpacity
                  key={pr.id}
                  onPress={() => setKardexFilterProject(pr.code)}
                  style={[styles.typeChip, kardexFilterProject === pr.code && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipLabel, kardexFilterProject === pr.code && styles.typeChipLabelActive]}>
                    {pr.code} ({pr.name})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filteredCardex.length === 0 ? (
            <Card variant="outlined" style={{ padding: 24, alignItems: "center" }}>
              <Ionicons name="document-text-outline" size={32} color={theme.colors.textMuted} />
              <Text style={{ marginTop: 8, color: theme.colors.textMuted }}>No hay movimientos para este filtro.</Text>
            </Card>
          ) : (
            filteredCardex.map((item) => (
              <Card key={item.id} variant="outlined" style={styles.cardexCard}>
                <View style={styles.cardexTop}>
                  <View>
                    <Text style={styles.cardexSku}>{item.sku}</Text>
                    <Text style={styles.cardexName}>{item.productName}</Text>
                  </View>
                  <Badge
                    label={item.typeLabel}
                    tone={
                      item.type === "entrada_compra" || item.type === "devolucion"
                        ? "ok"
                        : item.type === "merma"
                        ? "danger"
                        : item.type === "ajuste_conteo"
                        ? "warn"
                        : "info"
                    }
                    size="sm"
                  />
                </View>

                <View style={styles.cardexDetailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Fecha</Text>
                    <Text style={styles.detailVal}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Referencia</Text>
                    <Text style={styles.detailVal}>{item.reference}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Proyecto</Text>
                    <Text style={styles.detailVal}>{item.projectName || item.projectCode || "Bodega Central"}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Entrada / Salida</Text>
                    <Text
                      style={[
                        styles.detailVal,
                        item.qtyIn > 0 && { color: theme.colors.ok, fontWeight: "bold" },
                        item.qtyOut > 0 && { color: theme.colors.danger, fontWeight: "bold" },
                      ]}
                    >
                      {item.qtyIn > 0 ? `+${item.qtyIn}` : `-${item.qtyOut}`}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Saldo Posterior</Text>
                    <Text style={[styles.detailVal, { fontWeight: "bold" }]}>{item.balance}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>PMP Posterior</Text>
                    <Text style={styles.detailVal}>{formatCLP(item.pmp)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          3. TAB SOLICITUDES
          ===================================================================== */}
      {activeTab === "solicitudes" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.requestTopBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reqTabsScroll}>
              {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setReqTab(t)}
                  style={[styles.reqTabBtn, reqTab === t && styles.reqTabBtnActive]}
                >
                  <Text style={[styles.reqTabTxt, reqTab === t && styles.reqTabTxtActive]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title="Nueva Solicitud"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={handleOpenNewRequest}
            />
          </View>

          {filteredRequests.map((req) => (
            <Card key={req.id} variant="elevated" style={styles.requestItemCard}>
              <View style={styles.reqItemTop}>
                <View>
                  <View style={styles.reqHeaderRow}>
                    <Text style={styles.reqCodeText}>{req.code}</Text>
                    <Badge
                      label={req.status.toUpperCase()}
                      tone={
                        req.status === "aprobada"
                          ? "ok"
                          : req.status === "rechazada"
                          ? "danger"
                          : "warn"
                      }
                      size="sm"
                      style={{ marginLeft: 6 }}
                    />
                    {req.receiptNumber && (
                      <Badge
                        label={`N° ${req.receiptNumber}`}
                        tone="info"
                        size="sm"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>
                  <Text style={styles.reqProjectName}>{req.projectName}</Text>
                  <Text style={styles.reqTechInfo}>
                    Por: {req.technicianName} • {formatDate(req.date)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedTimelineReq(req)}
                  style={styles.timelineLinkBtn}
                >
                  <Ionicons name="git-network-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.timelineLinkTxt}>Línea de tiempo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reqItemsBox}>
                <Text style={styles.itemsBoxTitle}>Ítems Solicitados:</Text>
                {req.items.map((it, idx) => (
                  <View key={idx} style={styles.reqItemSummaryRow}>
                    <Text style={styles.reqItemRow}>
                      • {it.quantity} {it.unit} de {it.name}
                    </Text>
                    {it.deliveredQuantity !== undefined && it.deliveredQuantity > 0 && (
                      <Text style={styles.deliveredSummaryTxt}>
                        (Entregados: {it.deliveredQuantity} / {it.quantity})
                      </Text>
                    )}
                  </View>
                ))}
                {req.rejectionReason && (
                  <View style={styles.rejectNotice}>
                    <Text style={styles.rejectNoticeTitle}>Motivo de rechazo:</Text>
                    <Text style={styles.rejectNoticeTxt}>{req.rejectionReason}</Text>
                  </View>
                )}
              </View>

              {/* Botones de acción según rol */}
              <View style={styles.reqButtonsRow}>
                {/* Admin aprueba o rechaza (con motivo obligatorio) */}
                {req.status === "pendiente" && currentRole === "admin" && (
                  <>
                    <Button
                      title="Rechazar"
                      variant="outline"
                      size="sm"
                      icon="close-outline"
                      onPress={() => {
                        setRejectModalReq(req);
                        setRejectReason("");
                      }}
                      style={{ borderColor: theme.colors.danger, marginRight: 8 }}
                      textStyle={{ color: theme.colors.danger }}
                    />
                    <Button
                      title="Aprobar y Generar Comprobante"
                      variant="success"
                      size="sm"
                      icon="checkmark-outline"
                      onPress={() => {
                        approveMaterialRequest(req.id, user.name);
                        showToast(`Solicitud ${req.code} aprobada. Comprobante generado.`);
                      }}
                    />
                  </>
                )}

                {/* Bodeguero puede Modificar o Anular si está Pendiente */}
                {req.status === "pendiente" && currentRole === "warehouse" && (
                  <>
                    <Button
                      title="Anular Solicitud"
                      variant="danger"
                      size="sm"
                      icon="trash-outline"
                      onPress={() => {
                        cancelMaterialRequest(req.id);
                        showToast(`Solicitud ${req.code} anulada.`);
                      }}
                      style={{ marginRight: 8 }}
                    />
                    <Button
                      title="Modificar Cantidades"
                      variant="secondary"
                      size="sm"
                      icon="create-outline"
                      onPress={() => {
                        const updated = req.items.map((i) => ({
                          ...i,
                          quantity: Math.max(1, i.quantity - 1),
                        }));
                        modifyMaterialRequest(req.id, updated);
                        showToast(`Cantidades de solicitud ${req.code} modificadas.`);
                      }}
                    />
                  </>
                )}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* =====================================================================
          4. TAB EGRESO (DESPACHO DE BODEGA)
          ===================================================================== */}
      {activeTab === "egreso" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.sectionHeaderBanner}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Módulo de Egreso y Despacho Físico</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Despacho parcial o total validado contra stock disponible en bodega.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                openScanner("Escanear SKU para Despacho", (scannedCode) => {
                  // Autocompletar o resaltar insumo escaneado
                  const matchedProd = products.find(
                    (p) => p.sku === scannedCode || p.barcode === scannedCode
                  );
                  if (matchedProd) {
                    showToast(`Insumo escaneado: ${matchedProd.sku} (${matchedProd.name})`);
                  } else {
                    showToast(`Código escaneado: ${scannedCode}`);
                  }
                })
              }
              style={styles.scanActionBtn}
            >
              <Ionicons name="qr-code-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.scanActionBtnTxt}>Escanear SKU</Text>
            </TouchableOpacity>
          </View>

          {/* Selector de Solicitud Aprobada */}
          <Text style={styles.formSectionLabel}>Seleccionar Solicitud Aprobada a Despachar:</Text>
          {approvedRequests.length === 0 ? (
            <Card variant="outlined" style={{ padding: 24, alignItems: "center", marginBottom: 16 }}>
              <Ionicons name="checkmark-done-circle-outline" size={32} color={theme.colors.ok} />
              <Text style={{ marginTop: 8, color: theme.colors.textMuted }}>
                No hay solicitudes pendientes de despacho físico en bodega.
              </Text>
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {approvedRequests.map((r) => {
                const isSelected = selectedDispatchReqId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => handleSelectDispatchReq(r.id)}
                    style={[styles.dispatchReqCard, isSelected && styles.dispatchReqCardActive]}
                  >
                    <View style={styles.dispatchReqTop}>
                      <Text style={[styles.dispatchReqCode, isSelected && { color: theme.colors.primary }]}>
                        {r.code}
                      </Text>
                      {r.receiptNumber && (
                        <Badge label={r.receiptNumber} tone="info" size="sm" />
                      )}
                    </View>
                    <Text style={styles.dispatchReqProject}>{r.projectName}</Text>
                    <Text style={styles.dispatchReqMeta}>Solicitado por: {r.technicianName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Formulario de Despacho para la solicitud seleccionada */}
          {activeDispatchReq && (
            <Card variant="elevated" style={styles.dispatchFormCard}>
              <View style={styles.dispatchFormHeader}>
                <View>
                  <Text style={styles.dispatchFormTitle}>
                    Despacho de Solicitud: {activeDispatchReq.code}
                  </Text>
                  <Text style={styles.dispatchFormSubtitle}>
                    Proyecto: {activeDispatchReq.projectName} ({activeDispatchReq.projectCode})
                  </Text>
                </View>
                <Badge label="Aprobada" tone="ok" size="sm" />
              </View>

              {/* Selector de Técnico que retira */}
              <Text style={styles.formSectionLabel}>Técnico que retira en bodega:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {technicians.map((t) => (
                  <TouchableOpacity
                    key={t.rut}
                    onPress={() => setDispatchTechRut(t.rut)}
                    style={[
                      styles.techSelectChip,
                      dispatchTechRut === t.rut && styles.techSelectChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.techSelectName,
                        dispatchTechRut === t.rut && styles.techSelectNameActive,
                      ]}
                    >
                      {t.name}
                    </Text>
                    <Text style={styles.techSelectRut}>RUT: {t.rut}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Tabla de ítems a despachar */}
              <Text style={styles.formSectionLabel}>Ítems y Cantidades a Entregar Ahora:</Text>
              {activeDispatchReq.items.map((it) => {
                const prod = products.find((p) => p.sku === it.sku);
                const delivered = it.deliveredQuantity || 0;
                const pending = Math.max(0, it.quantity - delivered);
                const currentDispatch = dispatchQuantities[it.sku] || 0;
                const isOverStock = prod ? currentDispatch > prod.stock : false;
                const isOverPending = currentDispatch > pending;

                return (
                  <View key={it.sku} style={styles.dispatchItemRow}>
                    <View style={{ flex: 1.5, marginRight: 8 }}>
                      <Text style={styles.dispatchItemName}>{it.name}</Text>
                      <Text style={styles.dispatchItemSku}>SKU: {it.sku}</Text>
                      <Text style={styles.dispatchItemStock}>
                        Stock disponible: {prod ? prod.stock : 0} {it.unit}
                      </Text>

                      {/* Si es a granel, mostrar barra de capacidad restante */}
                      {prod?.isBulk && prod.containerCapacity && (
                        <View style={{ marginTop: 6 }}>
                          <ProgressBar
                            value={Math.max(0, prod.stock - currentDispatch)}
                            max={prod.containerCapacity}
                            height={5}
                            showPercentage
                            label={`Contenedor restante: ${(Math.max(0, prod.stock - currentDispatch)).toFixed(3)} ${it.unit}`}
                          />
                        </View>
                      )}
                    </View>

                    {/* Columnas solicitada, entregada, pendiente */}
                    <View style={styles.dispatchColStats}>
                      <Text style={styles.statLine}>Sol: {it.quantity} {it.unit}</Text>
                      <Text style={styles.statLine}>Entr: {delivered} {it.unit}</Text>
                      <Text style={[styles.statLine, { color: theme.colors.primary, fontWeight: "bold" }]}>
                        Pend: {pending} {it.unit}
                      </Text>
                    </View>

                    {/* Input de cantidad a entregar ahora */}
                    <View style={styles.dispatchInputBox}>
                      <Text style={styles.dispatchInputLabel}>A entregar:</Text>
                      <TextInput
                        value={String(currentDispatch)}
                        onChangeText={(val) => handleDispatchQtyChange(it.sku, val)}
                        keyboardType="decimal-pad"
                        style={[
                          styles.dispatchQtyInput,
                          (isOverStock || isOverPending) && { borderColor: theme.colors.danger },
                        ]}
                      />
                      <Text style={styles.dispatchUnitLabel}>{it.unit}</Text>
                    </View>
                  </View>
                );
              })}

              {Boolean(dispatchError) && (
                <View style={styles.errorNoticeCard}>
                  <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                  <Text style={styles.errorNoticeTxt}>{dispatchError}</Text>
                </View>
              )}

              {/* Botón de confirmar despacho */}
              <View style={styles.dispatchBtnRow}>
                <Button
                  title="Confirmar y Registrar Egreso"
                  variant="primary"
                  icon="checkmark-done-outline"
                  onPress={handleInitiateDispatch}
                />
              </View>
            </Card>
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          5. TAB MERMAS
          ===================================================================== */}
      {activeTab === "mermas" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.requestTopBar}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Registro y Control de Mermas</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Bajas de inventario por daño, caducidad o pérdida valorizadas a PMP.
              </Text>
            </View>
            <Button
              title="Registrar Merma"
              variant="danger"
              size="sm"
              icon="alert-circle-outline"
              onPress={handleOpenWasteModal}
            />
          </View>

          {/* Historial de Mermas */}
          {wasteRecords.length === 0 ? (
            <Card variant="outlined" style={{ padding: 24, alignItems: "center" }}>
              <Ionicons name="shield-checkmark-outline" size={32} color={theme.colors.ok} />
              <Text style={{ marginTop: 8, color: theme.colors.textMuted }}>No hay registros de merma.</Text>
            </Card>
          ) : (
            wasteRecords.map((w) => (
              <Card key={w.id} variant="outlined" style={styles.wasteCard}>
                <View style={styles.wasteTopRow}>
                  <View>
                    <Text style={styles.wasteSku}>{w.sku}</Text>
                    <Text style={styles.wasteName}>{w.productName}</Text>
                  </View>
                  <Badge
                    label={w.reason.toUpperCase()}
                    tone={w.reason === "daño" || w.reason === "pérdida" ? "danger" : "warn"}
                    size="sm"
                  />
                </View>

                <View style={styles.wasteDetailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Cantidad Baja</Text>
                    <Text style={[styles.detailVal, { color: theme.colors.danger, fontWeight: "bold" }]}>
                      -{w.quantity} {w.unit}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Pérdida Valorizada</Text>
                    <Text style={[styles.detailVal, { color: theme.colors.danger, fontWeight: "bold" }]}>
                      {formatCLP(w.totalLoss)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>PMP al Momento</Text>
                    <Text style={styles.detailVal}>{formatCLP(w.pmp)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLbl}>Fecha y Responsable</Text>
                    <Text style={styles.detailVal}>{formatDate(w.date)} • {w.user}</Text>
                  </View>
                </View>

                <View style={styles.wasteObsBox}>
                  <Text style={styles.wasteObsTitle}>Observación Obligatoria:</Text>
                  <Text style={styles.wasteObsTxt}>{w.observation}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* =====================================================================
          6. TAB CONTEO FISICO
          ===================================================================== */}
      {activeTab === "conteo" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.requestTopBar}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Auditoría y Conteo Físico de Bodega</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Ajuste directo si discrepancia ≤ 5%; aprobación de Admin si &gt; 5%.
              </Text>
            </View>
            <Button
              title="Nuevo Conteo"
              variant="primary"
              size="sm"
              icon="calculator-outline"
              onPress={handleOpenCountModal}
            />
          </View>

          {/* Banner de insumos actualmente bloqueados */}
          {products.some((p) => physicalCounts.some((c) => c.sku === p.sku && c.status === "pendiente_aprobacion")) && (
            <View style={styles.lockedWarningBanner}>
              <Ionicons name="lock-closed" size={18} color="#991b1b" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedBannerTitle}>Atención: Insumos Bloqueados en Auditoría</Text>
                <Text style={styles.lockedBannerTxt}>
                  Los insumos con discrepancias pendientes de aprobación están temporalmente bloqueados para nuevos despachos.
                </Text>
              </View>
            </View>
          )}

          {/* Sección de Conteos Pendientes de Aprobación (Vista Admin) */}
          <Text style={styles.formSectionLabel}>Conteos Pendientes de Aprobación (Admin):</Text>
          {physicalCounts.filter((c) => c.status === "pendiente_aprobacion").length === 0 ? (
            <Card variant="outlined" style={{ padding: 16, alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: theme.colors.textMuted }}>No hay conteos físicos pendientes de resolución.</Text>
            </Card>
          ) : (
            physicalCounts
              .filter((c) => c.status === "pendiente_aprobacion")
              .map((c) => (
                <Card key={c.id} variant="outlined" style={styles.pendingCountCard}>
                  <View style={styles.productTopRow}>
                    <View>
                      <Text style={styles.skuTitle}>{c.sku}</Text>
                      <Text style={styles.productName}>{c.productName}</Text>
                    </View>
                    <Badge label="Pendiente Aprobación (> 5%)" tone="warn" size="sm" />
                  </View>

                  <View style={styles.countDiffGrid}>
                    <View style={styles.countDiffCell}>
                      <Text style={styles.countCellLbl}>Stock Sistema</Text>
                      <Text style={styles.countCellVal}>{c.systemStock}</Text>
                    </View>
                    <View style={styles.countDiffCell}>
                      <Text style={styles.countCellLbl}>Conteo Físico</Text>
                      <Text style={styles.countCellVal}>{c.countedStock}</Text>
                    </View>
                    <View style={styles.countDiffCell}>
                      <Text style={styles.countCellLbl}>Diferencia</Text>
                      <Text style={[styles.countCellVal, { color: theme.colors.danger }]}>
                        {c.difference > 0 ? `+${c.difference}` : c.difference} ({c.differencePct.toFixed(1)}%)
                      </Text>
                    </View>
                    <View style={styles.countDiffCell}>
                      <Text style={styles.countCellLbl}>Impacto Valorizado</Text>
                      <Text style={[styles.countCellVal, { color: theme.colors.danger }]}>
                        {formatCLP(c.differenceValue)}
                      </Text>
                    </View>
                  </View>

                  {Boolean(c.notes) && (
                    <Text style={styles.countNotesText}>Nota de auditoría: {c.notes}</Text>
                  )}

                  {/* Acciones de Administrador */}
                  {currentRole === "admin" && (
                    <View style={styles.countAdminActions}>
                      <Button
                        title="Rechazar Conteo"
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        onPress={() => {
                          rejectPhysicalCount(c.id, user.name);
                          showToast(`Conteo de ${c.sku} rechazado. Insumo desbloqueado.`);
                        }}
                        style={{ marginRight: 8, borderColor: theme.colors.danger }}
                        textStyle={{ color: theme.colors.danger }}
                      />
                      <Button
                        title="Aprobar Ajuste en Cardex"
                        variant="success"
                        size="sm"
                        icon="checkmark-outline"
                        onPress={() => {
                          approvePhysicalCount(c.id, user.name);
                          showToast(`Ajuste de ${c.sku} aprobado y reflejado en Cardex.`);
                        }}
                      />
                    </View>
                  )}
                </Card>
              ))
          )}

          {/* Historial general de conteos */}
          <Text style={[styles.formSectionLabel, { marginTop: 16 }]}>Historial de Conteos Realizados:</Text>
          {physicalCounts
            .filter((c) => c.status !== "pendiente_aprobacion")
            .map((c) => (
              <Card key={c.id} variant="outlined" style={styles.countHistoryCard}>
                <View style={styles.wasteTopRow}>
                  <View>
                    <Text style={styles.wasteSku}>{c.sku} • {c.productName}</Text>
                    <Text style={styles.wasteObsTxt}>
                      Realizado por: {c.counterUser} • {formatDate(c.date)}
                    </Text>
                  </View>
                  <Badge
                    label={c.status === "ajustado_directo" ? "Ajuste Directo (≤5%)" : c.status.toUpperCase()}
                    tone={c.status === "rechazado" ? "danger" : "ok"}
                    size="sm"
                  />
                </View>
                <Text style={styles.countHistoryDiff}>
                  Diferencia: {c.difference} un ({c.differencePct.toFixed(1)}%) • Valor: {formatCLP(c.differenceValue)}
                </Text>
              </Card>
            ))}
        </ScrollView>
      )}

      {/* =====================================================================
          7. TAB KITS
          ===================================================================== */}
      {activeTab === "kits" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollBody}>
          <View style={styles.requestTopBar}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Kits y Agrupaciones Estándar</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Monitoreo de disponibilidad en vivo según stock actual de cada componente.
              </Text>
            </View>
            <Button
              title="Nuevo Kit"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={handleOpenNewKit}
            />
          </View>

          {kits.map((k) => {
            const availability = getKitAvailability(k);
            return (
              <Card key={k.id} variant="elevated" style={styles.kitCard}>
                <View style={styles.kitTopRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.kitId}>{k.id}</Text>
                      <Badge label={k.category} tone="info" size="sm" style={{ marginLeft: 6 }} />
                    </View>
                    <Text style={styles.kitName}>{k.name}</Text>
                    <Text style={styles.kitDesc}>{k.description}</Text>
                  </View>

                  <Button
                    title="Editar"
                    variant="ghost"
                    size="sm"
                    icon="create-outline"
                    onPress={() => handleOpenEditKit(k)}
                  />
                </View>

                {/* Chip de disponibilidad con componentes faltantes */}
                <View style={styles.kitAvailabilityRow}>
                  {availability.isAvailable ? (
                    <Badge
                      label={`Disponible (${availability.availableKits} kits posibles)`}
                      tone="ok"
                      size="md"
                    />
                  ) : (
                    <Badge
                      label="Incompleto: Stock insuficiente"
                      tone="danger"
                      size="md"
                    />
                  )}
                </View>

                {availability.missingItems.length > 0 && (
                  <View style={styles.kitMissingBox}>
                    <Text style={styles.kitMissingTitle}>Componentes Faltantes en Bodega:</Text>
                    {availability.missingItems.map((m, idx) => (
                      <Text key={idx} style={styles.kitMissingLine}>• {m}</Text>
                    ))}
                  </View>
                )}

                {/* Tabla de componentes del kit */}
                <View style={styles.kitItemsTable}>
                  <Text style={styles.kitTableHead}>Componentes Requeridos por Kit:</Text>
                  {k.items.map((it) => {
                    const prod = products.find((p) => p.sku === it.sku);
                    const stock = prod ? prod.stock : 0;
                    const hasEnough = stock >= it.quantity;

                    return (
                      <View key={it.sku} style={styles.kitItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.kitItemName}>{it.name}</Text>
                          <Text style={styles.kitItemSku}>SKU: {it.sku}</Text>
                        </View>
                        <Text style={styles.kitItemQty}>
                          Req: {it.quantity} {it.unit}
                        </Text>
                        <Text
                          style={[
                            styles.kitItemStock,
                            !hasEnough && { color: theme.colors.danger, fontWeight: "bold" },
                          ]}
                        >
                          Disp: {stock} {it.unit}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* =====================================================================
          MODALES DE APOYO
          ===================================================================== */}

      {/* MODAL 1: PRODUCTO (ALTA / EDICIÓN) */}
      <ModalView
        visible={newProductModal}
        onClose={() => setNewProductModal(false)}
        title={editingProduct ? "Editar Insumo" : "Nuevo Insumo (Catálogo)"}
        subtitle="Formulario con SKU único, unidad, mínimos y reposición"
      >
        <View style={styles.inputWithScannerRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Código SKU Único"
              value={formSku}
              onChangeText={setFormSku}
              placeholder="Ej: ELE-CBL-0012"
              editable={!editingProduct}
            />
          </View>
          {!editingProduct && (
            <TouchableOpacity
              onPress={() =>
                openScanner("Escanear Código de Barras o QR", (code) => {
                  setFormSku(code);
                  setFormBarcode(code);
                })
              }
              style={styles.scannerIconBtn}
            >
              <Ionicons name="barcode-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <Input
          label="Nombre del Insumo"
          value={formName}
          onChangeText={setFormName}
          placeholder="Ej: Cable THHN 12 AWG"
        />
        <Input
          label="Categoría"
          value={formCategory}
          onChangeText={setFormCategory}
          placeholder="Ej: Electricidad, Climatización, Ferretería"
        />

        <Text style={styles.formSectionLabel}>Unidad de Medida:</Text>
        <View style={styles.unitButtonsRow}>
          {(["un", "kg", "m", "l"] as const).map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setFormUnit(u)}
              style={[styles.unitBtn, formUnit === u && styles.unitBtnActive]}
            >
              <Text style={[styles.unitBtnTxt, formUnit === u && styles.unitBtnTxtActive]}>
                {u.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Flag de producto a granel */}
        <TouchableOpacity
          onPress={() => setFormIsBulk(!formIsBulk)}
          style={styles.bulkCheckRow}
        >
          <Ionicons
            name={formIsBulk ? "checkbox" : "square-outline"}
            size={20}
            color={formIsBulk ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={styles.bulkCheckTxt}>Insumo a granel (admite 3 decimales y contenedor)</Text>
        </TouchableOpacity>

        {formIsBulk && (
          <Input
            label="Capacidad Nominal del Contenedor / Carrete"
            value={formContainerCapacity}
            onChangeText={setFormContainerCapacity}
            keyboardType="numeric"
            placeholder="100"
          />
        )}

        {!editingProduct && (
          <Input
            label="Stock Inicial Disponible"
            value={formStock}
            onChangeText={setFormStock}
            keyboardType="numeric"
            placeholder="0"
          />
        )}

        <View style={styles.formRowTwo}>
          <Input
            label="Stock Mínimo"
            value={formMinStock}
            onChangeText={setFormMinStock}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <Input
            label="Cantidad Reposición"
            value={formRestock}
            onChangeText={setFormRestock}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Input
          label="Proveedor Predeterminado"
          value={formSupplier}
          onChangeText={setFormSupplier}
          placeholder="Ej: ElectroChile SpA"
        />

        <Input
          label="Código de Barras / QR (Opcional)"
          value={formBarcode}
          onChangeText={setFormBarcode}
          placeholder="Ej: 7801234567890"
        />

        {Boolean(formError) && <Text style={styles.errorText}>{formError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setNewProductModal(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Guardar Insumo"
            variant="primary"
            onPress={handleSaveProduct}
          />
        </View>
      </ModalView>

      {/* MODAL 2: NUEVA SOLICITUD DE MATERIALES */}
      <ModalView
        visible={newRequestModal}
        onClose={() => setNewRequestModal(false)}
        title="Crear Solicitud de Material"
        subtitle="Validada contra stock disponible en bodega"
      >
        <Text style={styles.formSectionLabel}>Seleccionar Proyecto Activo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {activeProjects.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedProjectId(p.id)}
              style={[
                styles.projectChip,
                selectedProjectId === p.id && styles.projectChipActive,
              ]}
            >
              <Text
                style={[
                  styles.projectChipTxt,
                  selectedProjectId === p.id && styles.projectChipTxtActive,
                ]}
              >
                {p.code} - {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Kit Picker */}
        <Text style={styles.formSectionLabel}>O cargar Kit estándar:</Text>
        <View style={styles.kitPillsRow}>
          {kits.map((k) => (
            <TouchableOpacity
              key={k.id}
              onPress={() => handleSelectKitForRequest(k)}
              style={styles.kitPill}
            >
              <Ionicons name="layers-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.kitPillTxt}>{k.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formSectionLabel}>Insumos Solicitados:</Text>
        {reqItems.map((item, idx) => {
          const prod = products.find((p) => p.sku === item.sku);
          const avail = prod ? prod.stock : 0;
          const isLacking = avail < item.quantity;

          return (
            <View key={idx} style={[styles.reqItemFormRow, isLacking && styles.lackingStockFormRow]}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.itemSkuLabel}>{prod ? prod.name : item.sku}</Text>
                <Text style={[styles.itemStockAvailable, isLacking && { color: theme.colors.danger, fontWeight: "bold" }]}>
                  Disponible: {avail} {prod?.unit}
                </Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(val) => {
                  const num = Number(val) || 0;
                  handleReqItemChange(idx, item.sku, num);
                }}
                keyboardType="numeric"
                style={[styles.quantityInput, isLacking && { borderColor: theme.colors.danger }]}
              />
              <Pressable
                onPress={() => {
                  const updated = reqItems.filter((_, i) => i !== idx);
                  setReqItems(updated);
                  setMissingStockErrors(calculateMissingStock(updated));
                }}
                style={{ padding: 4, marginLeft: 6 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          );
        })}

        <Button
          title="+ Agregar otro insumo"
          variant="outline"
          size="sm"
          onPress={() => {
            const nextProd = products.find((p) => !reqItems.some((i) => i.sku === p.sku));
            if (nextProd) {
              const updated = [...reqItems, { sku: nextProd.sku, quantity: 1 }];
              setReqItems(updated);
              setMissingStockErrors(calculateMissingStock(updated));
            }
          }}
          style={{ marginVertical: 8 }}
        />

        <Input
          label="Nota o justificación (opcional)"
          value={reqComment}
          onChangeText={setReqComment}
          placeholder="Ej: Material para partida de iluminación piso 2"
        />

        {/* Bloqueo si falta stock */}
        {missingStockErrors.length > 0 && (
          <View style={styles.missingAlertCard}>
            <View style={styles.titleWithIcon}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.missingAlertTitle}>Bloqueo: Stock Insuficiente en Bodega</Text>
            </View>
            {missingStockErrors.map((m, i) => (
              <Text key={i} style={styles.missingAlertLine}>• {m}</Text>
            ))}
          </View>
        )}

        {Boolean(reqError) && <Text style={styles.errorText}>{reqError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setNewRequestModal(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Enviar Solicitud"
            variant="primary"
            disabled={missingStockErrors.length > 0}
            onPress={handleSubmitRequest}
          />
        </View>
      </ModalView>

      {/* MODAL 3: LINEA DE TIEMPO */}
      <ModalView
        visible={Boolean(selectedTimelineReq)}
        onClose={() => setSelectedTimelineReq(null)}
        title="Línea de Tiempo de Solicitud"
        subtitle={selectedTimelineReq ? `${selectedTimelineReq.code} • ${selectedTimelineReq.projectName}` : ""}
      >
        {selectedTimelineReq?.timeline?.map((step, idx) => (
          <View key={step.id || idx} style={styles.timelineStep}>
            <View style={styles.timelineDotBox}>
              <View style={styles.timelineDot} />
              {idx < (selectedTimelineReq.timeline?.length || 0) - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{step.title}</Text>
              <Text style={styles.timelineDesc}>{step.description}</Text>
              <Text style={styles.timelineMeta}>{step.author} • {step.date}</Text>
            </View>
          </View>
        ))}
      </ModalView>

      {/* MODAL 4: MOTIVO DE RECHAZO DE SOLICITUD */}
      <ModalView
        visible={Boolean(rejectModalReq)}
        onClose={() => setRejectModalReq(null)}
        title="Rechazar Solicitud de Material"
        subtitle={rejectModalReq ? `${rejectModalReq.code}` : ""}
      >
        <Text style={styles.modalInstruction}>
          El rechazo exige motivo obligatorio:
        </Text>
        <TextInput
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Ingrese motivo de rechazo detallado..."
          placeholderTextColor={theme.colors.textLight}
          multiline
          numberOfLines={3}
          style={styles.reasonInput}
        />
        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setRejectModalReq(null)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Confirmar Rechazo"
            variant="danger"
            disabled={!rejectReason.trim()}
            onPress={() => {
              if (rejectModalReq && rejectReason.trim()) {
                rejectMaterialRequest(rejectModalReq.id, rejectReason.trim(), user.name);
                showToast(`Solicitud ${rejectModalReq.code} rechazada.`);
                setRejectModalReq(null);
              }
            }}
          />
        </View>
      </ModalView>

      {/* MODAL 5: REGISTRAR MERMA */}
      <ModalView
        visible={wasteModalVisible}
        onClose={() => setWasteModalVisible(false)}
        title="Registrar Merma de Insumo"
        subtitle="Descuenta stock físico y valoriza a PMP"
      >
        <Text style={styles.formSectionLabel}>Seleccionar Insumo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {products
            .filter((p) => !p.disabled)
            .map((p) => (
              <TouchableOpacity
                key={p.sku}
                onPress={() => setWasteSku(p.sku)}
                style={[styles.productSelectChip, wasteSku === p.sku && styles.productSelectChipActive]}
              >
                <Text style={[styles.productSelectSku, wasteSku === p.sku && { color: theme.colors.primary }]}>
                  {p.sku}
                </Text>
                <Text style={styles.productSelectStock}>Disp: {p.stock} {p.unit}</Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <Input
          label={`Cantidad a dar de baja (${selectedWasteProd?.unit || "un"}):`}
          value={wasteQty}
          onChangeText={setWasteQty}
          keyboardType="decimal-pad"
          placeholder="1"
        />

        <Text style={styles.formSectionLabel}>Motivo de la Merma:</Text>
        <View style={styles.reasonPillsRow}>
          {(["daño", "caducidad", "pérdida", "otro"] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setWasteReason(r)}
              style={[styles.reasonPill, wasteReason === r && styles.reasonPillActive]}
            >
              <Text style={[styles.reasonPillTxt, wasteReason === r && styles.reasonPillTxtActive]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tarjeta con pérdida valorizada a PMP */}
        <Card variant="outlined" style={styles.lossCalculationCard}>
          <View style={styles.lossCardHeader}>
            <Ionicons name="calculator-outline" size={18} color={theme.colors.danger} />
            <Text style={styles.lossCardTitle}>Pérdida Valorizada a PMP:</Text>
          </View>
          <Text style={styles.lossAmountText}>{formatCLP(wasteTotalLoss)}</Text>
          <Text style={styles.lossMetaText}>
            Cálculo: {wasteQtyNum} {selectedWasteProd?.unit} × {formatCLP(selectedWasteProd?.pmp || selectedWasteProd?.unitCost || 0)} (PMP)
          </Text>
        </Card>

        <Input
          label="Observación Obligatoria (Detalle de la merma):"
          value={wasteObs}
          onChangeText={setWasteObs}
          placeholder="Ej: Embalaje roto y terminal partido al maniobrar con traspaleta..."
          multiline
        />

        {Boolean(wasteError) && <Text style={styles.errorText}>{wasteError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setWasteModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Confirmar Merma"
            variant="danger"
            onPress={handleRegisterWaste}
          />
        </View>
      </ModalView>

      {/* MODAL 6: REGISTRAR CONTEO FISICO */}
      <ModalView
        visible={countModalVisible}
        onClose={() => setCountModalVisible(false)}
        title="Registrar Conteo Físico de Bodega"
        subtitle="Regla de tolerancia: ≤ 5% ajuste directo | > 5% aprobación Admin"
      >
        <View style={styles.lockedWarningBanner}>
          <Ionicons name="lock-closed" size={16} color="#991b1b" style={{ marginRight: 6 }} />
          <Text style={styles.lockedBannerTxt}>
            El insumo se bloqueará para movimientos durante el conteo y auditoría.
          </Text>
        </View>

        <View style={styles.inputWithScannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formSectionLabel}>Insumo Auditado:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {products.map((p) => (
                <TouchableOpacity
                  key={p.sku}
                  onPress={() => {
                    setCountSku(p.sku);
                    setCountPhysicalQty(String(p.stock));
                  }}
                  style={[styles.productSelectChip, countSku === p.sku && styles.productSelectChipActive]}
                >
                  <Text style={[styles.productSelectSku, countSku === p.sku && { color: theme.colors.primary }]}>
                    {p.sku}
                  </Text>
                  <Text style={styles.productSelectStock}>Sistema: {p.stock} {p.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            onPress={() =>
              openScanner("Escanear Insumo a Auditar", (code) => {
                const prod = products.find((p) => p.sku === code || p.barcode === code);
                if (prod) {
                  setCountSku(prod.sku);
                  setCountPhysicalQty(String(prod.stock));
                }
              })
            }
            style={styles.scannerIconBtn}
          >
            <Ionicons name="barcode-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <Input
          label={`Cantidad Física Contada en Bodega (${selectedCountProd?.unit || "un"}):`}
          value={countPhysicalQty}
          onChangeText={setCountPhysicalQty}
          keyboardType="decimal-pad"
        />

        {/* Tarjeta de Discrepancia y Regla de Negocio */}
        <Card variant="outlined" style={styles.countDiffCard}>
          <View style={styles.countDiffRow}>
            <View>
              <Text style={styles.countDiffLabel}>Diferencia Física:</Text>
              <Text style={[styles.countDiffVal, countDiff !== 0 && { color: theme.colors.danger }]}>
                {countDiff > 0 ? `+${countDiff}` : countDiff} {selectedCountProd?.unit} ({countDiffPct.toFixed(1)}%)
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.countDiffLabel}>Impacto Valorizado:</Text>
              <Text style={[styles.countDiffVal, countDiff !== 0 && { color: theme.colors.danger }]}>
                {formatCLP(countDiffVal)}
              </Text>
            </View>
          </View>

          <View style={styles.countRuleBadgeBox}>
            {countRequiresApproval ? (
              <Badge
                label="Supera umbral del 5%: Queda pendiente de aprobación por Administración"
                tone="warn"
                size="md"
              />
            ) : (
              <Badge
                label="Dentro de tolerancia (≤ 5%): Se ajusta directamente en bodega"
                tone="ok"
                size="md"
              />
            )}
          </View>
        </Card>

        <Input
          label="Observaciones de Auditoría (opcional):"
          value={countNotes}
          onChangeText={setCountNotes}
          placeholder="Ej: Conteo físico en gaveta A-02. Faltante encontrado."
        />

        {Boolean(countError) && <Text style={styles.errorText}>{countError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setCountModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Guardar Conteo"
            variant="primary"
            onPress={handleRegisterCount}
          />
        </View>
      </ModalView>

      {/* MODAL 7: ALTA / EDICIÓN DE KIT */}
      <ModalView
        visible={kitModalVisible}
        onClose={() => setKitModalVisible(false)}
        title={editingKitId ? "Editar Kit Estándar" : "Nuevo Kit de Insumos"}
        subtitle="ID único, nombre y lista de SKU con cantidad"
      >
        <Input
          label="Código ID del Kit"
          value={kitFormId}
          onChangeText={setKitFormId}
          placeholder="Ej: KIT-ELE-02"
          editable={!editingKitId}
        />
        <Input
          label="Nombre del Kit"
          value={kitFormName}
          onChangeText={setKitFormName}
          placeholder="Ej: Kit Tablero Trifásico Faena"
        />
        <Input
          label="Categoría"
          value={kitFormCategory}
          onChangeText={setKitFormCategory}
          placeholder="Ej: Eléctrico, Climatización, EPP"
        />
        <Input
          label="Descripción"
          value={kitFormDesc}
          onChangeText={setKitFormDesc}
          placeholder="Ej: Conjunto de materiales para acometida..."
        />

        <Text style={styles.formSectionLabel}>Componentes del Kit:</Text>
        {kitFormItems.map((item, idx) => {
          const prod = products.find((p) => p.sku === item.sku);
          return (
            <View key={idx} style={styles.kitItemFormRow}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.kitItemFormName}>{prod ? prod.name : item.sku}</Text>
                <Text style={styles.kitItemFormSku}>SKU: {item.sku}</Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(val) => {
                  const num = Number(val) || 1;
                  setKitFormItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, quantity: num } : it))
                  );
                }}
                keyboardType="numeric"
                style={styles.quantityInput}
              />
              <Text style={{ marginLeft: 4, marginRight: 8, fontSize: 12 }}>{item.unit}</Text>
              <Pressable
                onPress={() => setKitFormItems((prev) => prev.filter((_, i) => i !== idx))}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          );
        })}

        <Button
          title="+ Agregar Insumo al Kit"
          variant="outline"
          size="sm"
          onPress={() => {
            const nextProd = products.find((p) => !kitFormItems.some((i) => i.sku === p.sku));
            if (nextProd) {
              setKitFormItems((prev) => [
                ...prev,
                { sku: nextProd.sku, name: nextProd.name, quantity: 1, unit: nextProd.unit },
              ]);
            }
          }}
          style={{ marginVertical: 8 }}
        />

        {Boolean(kitFormError) && <Text style={styles.errorText}>{kitFormError}</Text>}

        <View style={styles.modalButtonsRow}>
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setKitModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Button
            title="Guardar Kit"
            variant="primary"
            onPress={handleSaveKit}
          />
        </View>
      </ModalView>

      {/* MODAL 8: DIÁLOGO DE CONFIRMACIÓN DE EGRESO (Avisa que no se edita) */}
      <ConfirmDialog
        visible={confirmDispatchVisible}
        title="Confirmar Egreso Físico en Bodega"
        message="Atención: El egreso es definitivo y no se puede editar una vez registrado. Se rebajará el stock físico y se generará movimiento permanente en Cardex. ¿Desea proceder?"
        confirmLabel="Confirmar Despacho"
        cancelLabel="Revisar"
        variant="warning"
        onConfirm={handleExecuteDispatch}
        onCancel={() => setConfirmDispatchVisible(false)}
      />

      {/* MODAL 9: ESCÁNER QR Y CÓDIGO DE BARRAS REUTILIZABLE */}
      <QrScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        title={scannerTitle}
        onScanResult={(code) => {
          if (scannerCallback) scannerCallback(code);
        }}
      />
    </View>
    </ScreenStateWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  tabBarContainer: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabScrollContent: {
    paddingHorizontal: theme.spacing.sm,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
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
    paddingBottom: 48,
  },
  topCatalogBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.md,
    height: 42,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  scanQuickBtn: {
    width: 42,
    height: 42,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  productCard: {
    marginBottom: theme.spacing.md,
  },
  lowStockCard: {
    borderColor: theme.colors.danger,
    borderWidth: 2,
    backgroundColor: "#fffdfd",
  },
  disabledCard: {
    opacity: 0.55,
  },
  productTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skuBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  skuTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  productName: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  categoryText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  bulkCapacityBox: {
    marginVertical: 6,
  },
  productActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  pmpBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  pmpLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginRight: 4,
  },
  pmpVal: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  btnRow: {
    flexDirection: "row",
  },
  filterSection: {
    marginBottom: theme.spacing.md,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  cardexSearchInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.md,
    height: 40,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  typeFilterScroll: {
    paddingVertical: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  typeChipLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  typeChipLabelActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  cardexCard: {
    marginBottom: theme.spacing.sm,
  },
  cardexTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.xs,
  },
  cardexSku: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  cardexName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  cardexDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: 4,
  },
  detailItem: {
    width: "50%",
    paddingVertical: 2,
  },
  detailLbl: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  detailVal: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  requestTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  reqTabsScroll: {
    flex: 1,
    marginRight: 8,
  },
  reqTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reqTabBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  reqTabTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  reqTabTxtActive: {
    color: "#ffffff",
  },
  requestItemCard: {
    marginBottom: theme.spacing.md,
  },
  reqItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reqHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reqCodeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  reqProjectName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  reqTechInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timelineLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  timelineLinkTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  reqItemsBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  itemsBoxTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  reqItemSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 1,
  },
  reqItemRow: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  deliveredSummaryTxt: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  rejectNotice: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#fee2e2",
    borderRadius: 4,
  },
  rejectNoticeTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  rejectNoticeTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
  },
  reqButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.xs,
  },
  sectionHeaderBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionHeaderTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  sectionHeaderSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  scanActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  scanActionBtnTxt: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: theme.fontSize.xs,
  },
  dispatchReqCard: {
    width: 200,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 10,
  },
  dispatchReqCardActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primaryLight,
  },
  dispatchReqTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dispatchReqCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  dispatchReqProject: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 4,
  },
  dispatchReqMeta: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dispatchFormCard: {
    marginBottom: theme.spacing.md,
  },
  dispatchFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  dispatchFormTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  dispatchFormSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  techSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  techSelectChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  techSelectName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  techSelectNameActive: {
    color: theme.colors.primary,
  },
  techSelectRut: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  dispatchItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: 8,
  },
  dispatchItemName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  dispatchItemSku: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  dispatchItemStock: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.ok,
  },
  dispatchColStats: {
    width: 85,
    marginRight: 8,
  },
  statLine: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  dispatchInputBox: {
    width: 90,
    alignItems: "center",
  },
  dispatchInputLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  dispatchQtyInput: {
    width: "100%",
    height: 36,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  dispatchUnitLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  errorNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: theme.radius.sm,
    padding: 8,
    marginVertical: 8,
  },
  errorNoticeTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginLeft: 6,
    flex: 1,
  },
  dispatchBtnRow: {
    marginTop: theme.spacing.md,
  },
  wasteCard: {
    marginBottom: theme.spacing.sm,
  },
  wasteTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  wasteSku: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  wasteName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  wasteDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: 8,
  },
  wasteObsBox: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.sm,
  },
  wasteObsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  wasteObsTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginTop: 2,
  },
  productSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  productSelectChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  productSelectSku: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  productSelectStock: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  reasonPillsRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  reasonPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reasonPillActive: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  reasonPillTxt: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  reasonPillTxtActive: {
    color: "#ffffff",
  },
  lossCalculationCard: {
    backgroundColor: "#fff5f5",
    borderColor: theme.colors.danger,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  lossCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lossCardTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.danger,
    marginLeft: 6,
  },
  lossAmountText: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  lossMetaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  lockedWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  lockedBannerTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.dangerDark,
  },
  lockedBannerTxt: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.dangerDark,
    marginTop: 1,
  },
  pendingCountCard: {
    marginBottom: theme.spacing.md,
    borderColor: theme.colors.warn,
  },
  countDiffGrid: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginVertical: 8,
  },
  countDiffCell: {
    flex: 1,
    alignItems: "center",
  },
  countCellLbl: {
    fontSize: 9,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  countCellVal: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  countNotesText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  countAdminActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  countHistoryCard: {
    marginBottom: theme.spacing.xs,
  },
  countHistoryDiff: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  countDiffCard: {
    backgroundColor: theme.colors.surfaceAlt,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
  },
  countDiffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  countDiffLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  countDiffVal: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  countRuleBadgeBox: {
    marginTop: 8,
  },
  kitCard: {
    marginBottom: theme.spacing.md,
  },
  kitTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  kitId: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  kitName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 2,
  },
  kitDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  kitAvailabilityRow: {
    marginVertical: theme.spacing.xs,
  },
  kitMissingBox: {
    backgroundColor: "#fee2e2",
    borderRadius: theme.radius.sm,
    padding: 8,
    marginVertical: 4,
  },
  kitMissingTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  kitMissingLine: {
    fontSize: 10,
    color: theme.colors.danger,
    marginTop: 1,
  },
  kitItemsTable: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: 8,
  },
  kitTableHead: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kitItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  kitItemName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  kitItemSku: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  kitItemQty: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginRight: 12,
  },
  kitItemStock: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.ok,
  },
  formSectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 6,
  },
  inputWithScannerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  scannerIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    marginBottom: theme.spacing.sm,
  },
  unitButtonsRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  unitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unitBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  unitBtnTxt: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  unitBtnTxtActive: {
    color: "#ffffff",
  },
  bulkCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  bulkCheckTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginLeft: 8,
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
  projectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  projectChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  projectChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  projectChipTxtActive: {
    color: theme.colors.primary,
    fontWeight: "bold",
  },
  kitPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.md,
  },
  kitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kitPillTxt: {
    fontSize: 11,
    color: theme.colors.text,
    marginLeft: 4,
    fontWeight: "500",
  },
  reqItemFormRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
  },
  lackingStockFormRow: {
    backgroundColor: theme.colors.dangerLight,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
  },
  itemSkuLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  itemStockAvailable: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textMuted,
  },
  quantityInput: {
    width: 60,
    height: 36,
    backgroundColor: theme.colors.card,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.sm,
    textAlign: "center",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  missingAlertCard: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: theme.borders.thin,
    borderColor: theme.colors.dangerBorder,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  missingAlertTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.dangerDark,
    marginLeft: 6,
  },
  missingAlertLine: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginTop: 2,
  },
  timelineStep: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
  },
  timelineDotBox: {
    alignItems: "center",
    marginRight: theme.spacing.md,
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  timelineDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timelineMeta: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  modalInstruction: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    height: 80,
    textAlignVertical: "top",
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
  },
  kitItemFormRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
  },
  kitItemFormName: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  kitItemFormSku: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
});
