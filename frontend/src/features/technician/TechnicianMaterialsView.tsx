import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ProgressBar } from "@/components/common/ProgressBar";

interface TechnicianMaterialsViewProps {
  initialProjectId?: string;
  onNavigateTab?: (tab: string) => void;
  isOffline?: boolean;
}

export const TechnicianMaterialsView: React.FC<TechnicianMaterialsViewProps> = ({
  initialProjectId,
  onNavigateTab,
  isOffline = false,
}) => {
  const { projects, products } = useApp();
  const { user } = useAuth();

  // Filtrar proyectos asignados activos
  const activeProjects = projects.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(user.rut) || p.technicianRuts.length === 0)
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || activeProjects[0]?.id || ""
  );

  // Fecha y hora de última sincronización
  const [lastSyncTime, setLastSyncTime] = useState<string>("14-10-2026 09:30 h");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshSync = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} h`;
      setLastSyncTime(`${datePart} ${timePart}`);
      setIsRefreshing(false);
    }, 600);
  };

  const currentProject = activeProjects.find((p) => p.id === selectedProjectId) || activeProjects[0];

  // Generar lista de insumos asignados, retirados y pendientes para este proyecto
  // Combinando despachos reales del proyecto y productos del catálogo
  const assignedItems = React.useMemo(() => {
    if (!currentProject) return [];

    const dispatches = currentProject.dispatches || [];
    // Agrupar retirados por SKU
    const retrievedBySku: Record<string, { qty: number; name: string; unit: string; pmp: number }> = {};
    dispatches.forEach((d) => {
      if (!retrievedBySku[d.sku]) {
        retrievedBySku[d.sku] = { qty: 0, name: d.productName, unit: d.unit, pmp: d.unitCost };
      }
      retrievedBySku[d.sku].qty += d.quantity;
    });

    // Construir tabla de presupuesto/asignación
    // Tomamos los productos con despacho o productos clave del tipo de obra
    const itemsList = [
      {
        sku: "GAS-TUB-0020",
        name: "Tubo cobre tipo L 3/4\" 6 m",
        assigned: 80,
        unit: "un",
      },
      {
        sku: "CLI-GAS-R410",
        name: "Gas refrigerante R410A 11,3 kg",
        assigned: 12,
        unit: "cilindro",
      },
      {
        sku: "ELE-CBL-0012",
        name: "Cable THHN 12 AWG rollo 100 m",
        assigned: 6,
        unit: "rollo",
      },
      {
        sku: "FER-PER-0008",
        name: "Perno anclaje 8 mm x 80",
        assigned: 10,
        unit: "caja",
      },
      {
        sku: "ELE-DIS-0016",
        name: "Disyuntor termomagnético 16 A",
        assigned: 25,
        unit: "un",
      },
    ];

    return itemsList.map((item) => {
      const retrieved = retrievedBySku[item.sku]?.qty || (item.sku === "GAS-TUB-0020" ? 60 : item.sku === "CLI-GAS-R410" ? 6 : 2);
      const pending = Math.max(0, item.assigned - retrieved);
      const fulfillmentPct = Math.min(100, Math.round((retrieved / item.assigned) * 100));

      return {
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        quantityAssigned: item.assigned,
        quantityRetrieved: retrieved,
        quantityPending: pending,
        fulfillmentPct,
      };
    });
  }, [currentProject]);

  const totalAssigned = assignedItems.reduce((acc, i) => acc + i.quantityAssigned, 0);
  const totalRetrieved = assignedItems.reduce((acc, i) => acc + i.quantityRetrieved, 0);
  const totalPending = assignedItems.reduce((acc, i) => acc + i.quantityPending, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. SELECTOR DE PROYECTO ASIGNADO */}
      <Text style={styles.sectionLabel}>Seleccionar Faena Asignada:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectsScroll}>
        {activeProjects.map((p) => {
          const isSelected = p.id === currentProject?.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedProjectId(p.id)}
              style={[styles.projChip, isSelected && styles.projChipActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="business-outline"
                size={14}
                color={isSelected ? "#ffffff" : theme.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.projChipTxt, isSelected && styles.projChipTxtActive]}>
                {p.code} - {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. ETIQUETA DE ÚLTIMA SINCRONIZACIÓN */}
      <View style={styles.syncCard}>
        <View style={styles.syncLeft}>
          <Ionicons
            name={isOffline ? "cloud-offline-outline" : "sync-circle-outline"}
            size={20}
            color={isOffline ? theme.colors.warnDark : theme.colors.primary}
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.syncTitle}>
              {isOffline ? "Modo Offline (Caché local)" : "Insumos Asignados a la Obra"}
            </Text>
            <Text style={styles.syncTimestamp}>
              Última sincronización: <Text style={{ fontWeight: "bold" }}>{lastSyncTime}</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleRefreshSync}
          style={styles.refreshBtn}
          disabled={isRefreshing}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={theme.colors.primary}
            style={isRefreshing ? { transform: [{ rotate: "45deg" }] } : undefined}
          />
          <Text style={styles.refreshBtnTxt}>{isRefreshing ? "..." : "Actualizar"}</Text>
        </TouchableOpacity>
      </View>

      {/* 3. RESUMEN GLOBAL DEL PROYECTO */}
      {currentProject && (
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.projName}>{currentProject.name}</Text>
              <Text style={styles.projClient}>Cliente: {currentProject.client} • {currentProject.code}</Text>
            </View>
            <Badge label={currentProject.kind.toUpperCase()} tone="info" size="sm" />
          </View>

          {/* Tres cajas de métricas: Asignada, Retirada, Pendiente */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{totalAssigned}</Text>
              <Text style={styles.metricLbl}>Total Asignado</Text>
            </View>

            <View style={[styles.metricBox, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={[styles.metricVal, { color: theme.colors.primaryDark }]}>{totalRetrieved}</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.primaryDark }]}>Ya Retirado</Text>
            </View>

            <View style={[styles.metricBox, { backgroundColor: theme.colors.warnLight }]}>
              <Text style={[styles.metricVal, { color: theme.colors.warnDark }]}>{totalPending}</Text>
              <Text style={[styles.metricLbl, { color: theme.colors.warnDark }]}>Pendiente</Text>
            </View>
          </View>

          {/* Barra de progreso de abastecimiento */}
          <View style={styles.supplyProgressBox}>
            <View style={styles.supplyHeader}>
              <Text style={styles.supplyLabel}>Abastecimiento de faena</Text>
              <Text style={styles.supplyPct}>
                {Math.round((totalRetrieved / (totalAssigned || 1)) * 100)}% retirado
              </Text>
            </View>
            <ProgressBar
              value={totalRetrieved}
              max={totalAssigned}
              height={8}
              color={theme.colors.ok}
            />
          </View>
        </Card>
      )}

      {/* 4. LISTADO DETALLADO DE INSUMOS POR PROYECTO */}
      <Text style={styles.listHeading}>Detalle de Insumos (Asignado vs Retirado):</Text>

      {assignedItems.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="Sin insumos asignados"
          description="Este proyecto no registra insumos asignados ni pendientes en faena."
          actionTitle="Solicitar Insumos"
          onAction={() => onNavigateTab && onNavigateTab("registrar")}
          containerStyle={{ marginVertical: 16 }}
        />
      ) : (
        assignedItems.map((item) => (
          <Card key={item.sku} variant="default" style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSku}>SKU: {item.sku} • Unidad: {item.unit}</Text>
              </View>
              <Badge
                label={item.quantityPending === 0 ? "Completado" : `Faltan ${item.quantityPending} ${item.unit}`}
                tone={item.quantityPending === 0 ? "ok" : "warn"}
                size="sm"
              />
            </View>

            {/* Fila de 3 columnas para cada insumo */}
            <View style={styles.itemMetricsRow}>
              <View style={styles.itemCol}>
                <Text style={styles.itemColVal}>{item.quantityAssigned} {item.unit}</Text>
                <Text style={styles.itemColLbl}>1. Asignado</Text>
              </View>

              <View style={styles.itemCol}>
                <Text style={[styles.itemColVal, { color: theme.colors.primaryDark }]}>
                  {item.quantityRetrieved} {item.unit}
                </Text>
                <Text style={styles.itemColLbl}>2. Retirado</Text>
              </View>

              <View style={styles.itemCol}>
                <Text style={[styles.itemColVal, item.quantityPending > 0 ? { color: theme.colors.warnDark } : {}]}>
                  {item.quantityPending} {item.unit}
                </Text>
                <Text style={styles.itemColLbl}>3. Pendiente</Text>
              </View>
            </View>

            {/* Barra individual de cumplimiento */}
            <View style={{ marginTop: 8 }}>
              <ProgressBar
                value={item.quantityRetrieved}
                max={item.quantityAssigned}
                height={5}
                color={item.quantityPending === 0 ? theme.colors.ok : theme.colors.primary}
              />
            </View>
          </Card>
        ))
      )}

      {/* 5. BOTONES DE ACCIÓN RÁPIDA (PEDIR / DEVOLVER) */}
      <View style={styles.bottomActions}>
        <Button
          title="Devolver Sobrante"
          variant="outline"
          size="md"
          icon="return-down-back-outline"
          onPress={() => onNavigateTab && onNavigateTab("registrar")}
          style={{ flex: 1, marginRight: 8, height: 46, borderColor: theme.colors.transit }}
          textStyle={{ color: theme.colors.transit }}
        />
        <Button
          title="Pedir Más Insumos"
          variant="primary"
          size="md"
          icon="cart-outline"
          onPress={() => onNavigateTab && onNavigateTab("registrar")}
          style={{ flex: 1, height: 46 }}
        />
      </View>
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
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  projectsScroll: {
    marginBottom: theme.spacing.md,
  },
  projChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginRight: 8,
    minHeight: 40,
  },
  projChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  projChipTxt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    fontWeight: "600",
  },
  projChipTxtActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  syncCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  syncTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  syncTimestamp: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
  },
  refreshBtnTxt: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "bold",
    marginLeft: 4,
  },
  summaryCard: {
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  projName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  projClient: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  metricVal: {
    fontSize: theme.fontSize.md,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  supplyProgressBox: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
  },
  supplyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  supplyLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  supplyPct: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  listHeading: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  itemCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  itemSku: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  itemMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
  },
  itemCol: {
    flex: 1,
    alignItems: "center",
  },
  itemColVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  itemColLbl: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  bottomActions: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
});
