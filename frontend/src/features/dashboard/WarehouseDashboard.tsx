import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { EstadoBadge } from "@/components/common/EstadoBadge";
import { QrScannerModal } from "@/components/common/QrScannerModal";
import { ScreenStateWrapper } from "@/components/common/ScreenStateWrapper";

interface WarehouseDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ onNavigate }) => {
  const {
    products,
    materialRequests,
    returnOrders,
    pendingReceipts,
  } = useApp();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const criticalStock = products.filter((p) => p.stock <= p.minStock && !p.disabled);
  const approvedForDispatch = materialRequests.filter((r) => r.status === "aprobada");
  const inTransitReturns = returnOrders.filter((r) => r.status === "en_transito");
  const pendingToConfirm = pendingReceipts.filter((p) => p.status === "por_confirmar");

  return (
    <ScreenStateWrapper screenTitle="Dashboard Bodega" skeletonType="cards">
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 0. HERO BOTÓN ESCÁNER QR/BARRAS (TABLET BODEGUERO) */}
      <TouchableOpacity
        style={styles.scannerHeroBtn}
        onPress={() => setScannerOpen(true)}
        activeOpacity={0.85}
      >
        <View style={styles.scannerHeroIcon}>
          <Ionicons name="barcode-outline" size={26} color="#ffffff" />
        </View>
        <View style={styles.scannerHeroTextCol}>
          <Text style={styles.scannerHeroTitle}>Escanear Código QR / Barras</Text>
          <Text style={styles.scannerHeroSub}>
            Cámara táctil para tablet • Búsqueda instantánea de insumo o bulto
          </Text>
        </View>
        <Ionicons name="camera-outline" size={22} color={theme.colors.primaryDark} />
      </TouchableOpacity>

      {/* BANNER RESULTADO ESCANEADO */}
      {scannedCode && (
        <View style={styles.scannedAlert}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.ok} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.scannedTitle}>Código escaneado: {scannedCode}</Text>
            <Text style={styles.scannedSub}>
              {products.find((p) => p.sku === scannedCode)?.name || "Insumo / Bulto identificado con éxito"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setScannedCode(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* 1. ACCESOS RÁPIDOS */}
      <Text style={styles.sectionHeading}>Accesos Rápidos</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: "#e0f2fe" }]}
          onPress={() => onNavigate && onNavigate("inventario")}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionTopRow}>
            <Ionicons name="arrow-up-circle-outline" size={26} color={theme.colors.primary} />
            {approvedForDispatch.length > 0 && (
              <Badge label={String(approvedForDispatch.length)} tone="primary" size="sm" />
            )}
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.primaryDark }]}>
            Egreso / Despacho
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: "#dcfce7" }]}
          onPress={() => onNavigate && onNavigate("recepcion")}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionTopRow}>
            <Ionicons name="arrow-down-circle-outline" size={26} color={theme.colors.ok} />
            {pendingToConfirm.length > 0 && (
              <Badge label={String(pendingToConfirm.length)} tone="ok" size="sm" />
            )}
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.ok }]}>
            Recepción OC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: "#fef3c7" }]}
          onPress={() => onNavigate && onNavigate("conteo")}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionTopRow}>
            <Ionicons name="clipboard-outline" size={26} color={theme.colors.warn} />
            {criticalStock.length > 0 && (
              <Badge label={String(criticalStock.length)} tone="warn" size="sm" />
            )}
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.warn }]}>
            Conteo Cíclico
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: "#ede9fe" }]}
          onPress={() => onNavigate && onNavigate("devoluciones")}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionTopRow}>
            <Ionicons name="return-down-back-outline" size={26} color={theme.colors.transit} />
            {inTransitReturns.length > 0 && (
              <Badge label={String(inTransitReturns.length)} tone="transit" size="sm" />
            )}
          </View>
          <Text style={[styles.quickActionLabel, { color: theme.colors.transit }]}>
            Devoluciones Faena
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. STOCK CRÍTICO */}
      <Card variant="elevated">
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.cardTitle}>Insumos con Stock Crítico ({criticalStock.length})</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("inventario")}>
            <Text style={styles.linkText}>Ver inventario</Text>
          </TouchableOpacity>
        </View>

        {criticalStock.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title="Stock en niveles óptimos"
            description="Todos los insumos se encuentran por sobre el umbral mínimo de seguridad."
            containerStyle={{ borderWidth: 0, paddingVertical: 16 }}
          />
        ) : (
          criticalStock.slice(0, 4).map((p) => (
            <View key={p.sku} style={styles.criticalItemRow}>
              <View style={styles.itemInfoCol}>
                <Text style={styles.skuText}>{p.sku}</Text>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.locationText}>Ubicación: {p.location}</Text>
              </View>
              <View style={styles.stockCol}>
                <View style={styles.stockNumbers}>
                  <Text style={styles.stockAlertText}>{p.stock} {p.unit}</Text>
                  <Text style={styles.minStockText}> (mín {p.minStock})</Text>
                </View>
                <Badge label="Bajo Mínimo" tone="danger" size="sm" />
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 3. APROBADAS PENDIENTES DE EGRESO */}
      <Card variant="elevated">
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={theme.colors.ok} />
            <Text style={styles.cardTitle}>
              Aprobadas Pendientes de Egreso ({approvedForDispatch.length})
            </Text>
          </View>
        </View>

        {approvedForDispatch.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Sin despachos pendientes"
            description="No hay solicitudes aprobadas esperando retiro en este momento."
            containerStyle={{ borderWidth: 0, paddingVertical: 16 }}
          />
        ) : (
          approvedForDispatch.map((req) => (
            <View key={req.id} style={styles.approvedCard}>
              <View style={styles.approvedTop}>
                <Text style={styles.approvedCode}>{req.code}</Text>
                <Badge label="Lista para despacho" tone="ok" size="sm" />
              </View>
              <Text style={styles.approvedProject}>{req.projectName}</Text>
              <Text style={styles.approvedTech}>Retira: {req.technicianName}</Text>
              <View style={styles.approvedItemsSummary}>
                <Text style={styles.itemsSummaryText}>
                  {req.items.length} insumo(s): {req.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}
                </Text>
              </View>
              <Button
                title="Generar Salida de Bodega"
                variant="primary"
                size="sm"
                icon="arrow-up-circle-outline"
                onPress={() => onNavigate && onNavigate("inventario")}
                style={{ marginTop: 8 }}
              />
            </View>
          ))
        )}
      </Card>

      {/* 4. DEVOLUCIONES EN TRÁNSITO */}
      <Card variant="outlined">
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="car-outline" size={20} color={theme.colors.transit} />
            <Text style={styles.cardTitle}>
              Devoluciones en Tránsito ({inTransitReturns.length})
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("devoluciones")}>
            <Text style={styles.linkText}>Gestionar</Text>
          </TouchableOpacity>
        </View>

        {inTransitReturns.length === 0 ? (
          <Text style={styles.emptyNote}>No hay devoluciones en camino desde terreno.</Text>
        ) : (
          inTransitReturns.map((ret) => (
            <View key={ret.id} style={styles.returnRow}>
              <View style={styles.returnInfo}>
                <Text style={styles.returnCode}>{ret.code}</Text>
                <Text style={styles.returnProject}>{ret.projectName}</Text>
                <Text style={styles.returnSummary}>
                  {ret.technicianName} devuelve: {ret.summary}
                </Text>
              </View>
              <EstadoBadge status="en_transito" size="sm" />
            </View>
          ))
        )}
      </Card>

      {/* 5. RECEPCIONES POR CONFIRMAR */}
      <Card variant="outlined">
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="cube-outline" size={20} color={theme.colors.info} />
            <Text style={styles.cardTitle}>
              Recepciones de Proveedor por Confirmar ({pendingToConfirm.length})
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("recepcion")}>
            <Text style={styles.linkText}>Ver checklist</Text>
          </TouchableOpacity>
        </View>

        {pendingToConfirm.length === 0 ? (
          <Text style={styles.emptyNote}>No hay bultos pendientes de ingreso.</Text>
        ) : (
          pendingToConfirm.map((rec) => (
            <View key={rec.id} style={styles.receiptRow}>
              <View style={styles.receiptInfo}>
                <Text style={styles.receiptOc}>{rec.ocCode} • {rec.supplier}</Text>
                <Text style={styles.receiptSummary}>{rec.itemsSummary}</Text>
                <Text style={styles.receiptPackages}>{rec.packagesCount} bulto(s) arribados</Text>
              </View>
              <EstadoBadge status="pendiente" size="sm" />
            </View>
          ))
        )}
      </Card>

      {/* MODAL ESCÁNER QR/BARRAS TABLET */}
      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanResult={(val) => {
          setScannedCode(val);
          setScannerOpen(false);
        }}
      />
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
  scannerHeroBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    ...theme.shadows.md,
    minHeight: 64,
  },
  scannerHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  scannerHeroTextCol: {
    flex: 1,
  },
  scannerHeroTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  scannerHeroSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  scannedAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.okLight,
    borderColor: theme.colors.okBorder,
    borderWidth: 1.5,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  scannedTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.okDark,
  },
  scannedSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.okDark,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: theme.spacing.lg,
  },
  quickActionBtn: {
    width: "48%",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  quickActionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  quickActionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginLeft: 6,
  },
  linkText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  emptyNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: theme.spacing.sm,
  },
  criticalItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemInfoCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  skuText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  productName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "500",
    color: theme.colors.text,
  },
  locationText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  stockCol: {
    alignItems: "flex-end",
  },
  stockNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  stockAlertText: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.danger,
  },
  minStockText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  approvedCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  approvedTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvedCode: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  approvedProject: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  approvedTech: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  approvedItemsSummary: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: 6,
  },
  itemsSummaryText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
  },
  returnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  returnInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  returnCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.transit,
  },
  returnProject: {
    fontSize: theme.fontSize.sm,
    fontWeight: "500",
    color: theme.colors.text,
  },
  returnSummary: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  receiptInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  receiptOc: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  receiptSummary: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  receiptPackages: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
});
