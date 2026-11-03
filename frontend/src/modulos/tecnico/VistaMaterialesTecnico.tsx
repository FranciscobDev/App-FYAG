import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";

interface TechnicianMaterialsViewProps {
  initialProjectId?: string;
  onNavigateTab?: (tab: string) => void;
  isOffline?: boolean;
}

export const VistaMaterialesTecnico: React.FC<TechnicianMaterialsViewProps> = ({
  initialProjectId,
  onNavigateTab,
  isOffline = false,
}) => {
  const { proyectos, productos } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  // Filtrar proyectos asignados activos
  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || activoProyectos[0]?.id || ""
  );

  // Fecha y hora de última sincronización
  const [lastSincronizacionTiempo, establecerLastSincronizacionTiempo] = useState<string>("14-10-2026 09:30 h");
  const [esRefreshing, establecerEsRefreshing] = useState(false);

  const manejarRefreshSincronizacion = () => {
    establecerEsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      const fechaPart = now.toISOString().slice(0, 10);
      const tiempoPart = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} h`;
      establecerLastSincronizacionTiempo(`${fechaPart} ${tiempoPart}`);
      establecerEsRefreshing(false);
    }, 600);
  };

  const actualProyecto = activoProyectos.find((p) => p.id === seleccionadoProyectoId) || activoProyectos[0];

  // Generar lista de insumos asignados, retirados y pendientes para este proyecto
  // Combinando despachos reales del proyecto y productos del catálogo
  const asignadoElementos = React.useMemo(() => {
    if (!actualProyecto) return [];

    const despachos = actualProyecto.dispatches || [];
    // Agrupar retirados por SKU
    const retiradoBySku: Record<string, { qty: number; name: string; unit: string; pmp: number }> = {};
    despachos.forEach((d) => {
      if (!retiradoBySku[d.sku]) {
        retiradoBySku[d.sku] = { qty: 0, name: d.productName, unit: d.unit, pmp: d.unitCost };
      }
      retiradoBySku[d.sku].qty += d.quantity;
    });

    // Construir tabla de presupuesto/asignación
    // Tomamos los productos con despacho o productos clave del tipo de obra
    const elementosLista = [
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

    return elementosLista.map((item) => {
      const retirado = retiradoBySku[item.sku]?.qty || (item.sku === "GAS-TUB-0020" ? 60 : item.sku === "CLI-GAS-R410" ? 6 : 2);
      const pendiente = Math.max(0, item.assigned - retirado);
      const fulfillmentPorcentaje = Math.min(100, Math.round((retirado / item.assigned) * 100));

      return {
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        quantityAssigned: item.assigned,
        quantityRetrieved: retirado,
        quantityPending: pendiente,
        fulfillmentPct: fulfillmentPorcentaje,
      };
    });
  }, [actualProyecto]);

  const totalAsignado = asignadoElementos.reduce((acc, i) => acc + i.quantityAssigned, 0);
  const totalRetirado = asignadoElementos.reduce((acc, i) => acc + i.quantityRetrieved, 0);
  const totalPendiente = asignadoElementos.reduce((acc, i) => acc + i.quantityPending, 0);

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {/* 1. SELECTOR DE PROYECTO ASIGNADO */}
      <Text style={estilos.seccionEtiqueta}>Seleccionar Faena Asignada:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.proyectosScroll}>
        {activoProyectos.map((p) => {
          const esSeleccionado = p.id === actualProyecto?.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => establecerSeleccionadoProyectoId(p.id)}
              style={[estilos.proyectoChip, esSeleccionado && estilos.proyectoChipActivo]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="business-outline"
                size={14}
                color={esSeleccionado ? "#ffffff" : tema.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[estilos.proyectoChipTexto, esSeleccionado && estilos.proyectoChipTextoActivo]}>
                {p.code} - {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. ETIQUETA DE ÚLTIMA SINCRONIZACIÓN */}
      <View style={estilos.sincronizacionTarjeta}>
        <View style={estilos.sincronizacionIzquierda}>
          <Ionicons
            name={isOffline ? "cloud-offline-outline" : "sync-circle-outline"}
            size={20}
            color={isOffline ? tema.colors.warnDark : tema.colors.primary}
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={estilos.sincronizacionTitulo}>
              {isOffline ? "Modo Offline (Caché local)" : "Insumos Asignados a la Obra"}
            </Text>
            <Text style={estilos.sincronizacionTimestamp}>
              Última sincronización: <Text style={{ fontWeight: "bold" }}>{lastSincronizacionTiempo}</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={manejarRefreshSincronizacion}
          style={estilos.refreshBoton}
          disabled={esRefreshing}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={tema.colors.primary}
            style={esRefreshing ? { transform: [{ rotate: "45deg" }] } : undefined}
          />
          <Text style={estilos.refreshBotonTexto}>{esRefreshing ? "..." : "Actualizar"}</Text>
        </TouchableOpacity>
      </View>

      {/* 3. RESUMEN GLOBAL DEL PROYECTO */}
      {actualProyecto && (
        <Tarjeta variant="elevated" style={estilos.resumenTarjeta}>
          <View style={estilos.resumenEncabezado}>
            <View>
              <Text style={estilos.proyectoNombre}>{actualProyecto.name}</Text>
              <Text style={estilos.proyectoCliente}>Cliente: {actualProyecto.client} • {actualProyecto.code}</Text>
            </View>
            <Insignia label={actualProyecto.kind.toUpperCase()} tone="info" size="sm" />
          </View>

          {/* Tres cajas de métricas: Asignada, Retirada, Pendiente */}
          <View style={estilos.metricsFila}>
            <View style={estilos.metricCaja}>
              <Text style={estilos.metricValor}>{totalAsignado}</Text>
              <Text style={estilos.metricLbl}>Total Asignado</Text>
            </View>

            <View style={[estilos.metricCaja, { backgroundColor: tema.colors.primaryLight }]}>
              <Text style={[estilos.metricValor, { color: tema.colors.primaryDark }]}>{totalRetirado}</Text>
              <Text style={[estilos.metricLbl, { color: tema.colors.primaryDark }]}>Ya Retirado</Text>
            </View>

            <View style={[estilos.metricCaja, { backgroundColor: tema.colors.warnLight }]}>
              <Text style={[estilos.metricValor, { color: tema.colors.warnDark }]}>{totalPendiente}</Text>
              <Text style={[estilos.metricLbl, { color: tema.colors.warnDark }]}>Pendiente</Text>
            </View>
          </View>

          {/* Barra de progreso de abastecimiento */}
          <View style={estilos.supplyProgresoCaja}>
            <View style={estilos.supplyEncabezado}>
              <Text style={estilos.supplyEtiqueta}>Abastecimiento de faena</Text>
              <Text style={estilos.supplyPorcentaje}>
                {Math.round((totalRetirado / (totalAsignado || 1)) * 100)}% retirado
              </Text>
            </View>
            <BarraProgreso
              value={totalRetirado}
              max={totalAsignado}
              height={8}
              color={tema.colors.ok}
            />
          </View>
        </Tarjeta>
      )}

      {/* 4. LISTADO DETALLADO DE INSUMOS POR PROYECTO */}
      <Text style={estilos.listaEncabezado}>Detalle de Insumos (Asignado vs Retirado):</Text>

      {asignadoElementos.length === 0 ? (
        <EstadoVacio
          icon="cube-outline"
          title="Sin insumos asignados"
          description="Este proyecto no registra insumos asignados ni pendientes en faena."
          actionTitle="Solicitar Insumos"
          onAction={() => onNavigateTab && onNavigateTab("registrar")}
          containerStyle={{ marginVertical: 16 }}
        />
      ) : (
        asignadoElementos.map((item) => (
          <Tarjeta key={item.sku} variant="default" style={estilos.elementoTarjeta}>
            <View style={estilos.elementoSuperiorFila}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.elementoNombre}>{item.name}</Text>
                <Text style={estilos.elementoSku}>SKU: {item.sku} • Unidad: {item.unit}</Text>
              </View>
              <Insignia
                label={item.quantityPending === 0 ? "Completado" : `Faltan ${item.quantityPending} ${item.unit}`}
                tone={item.quantityPending === 0 ? "ok" : "warn"}
                size="sm"
              />
            </View>

            {/* Fila de 3 columnas para cada insumo */}
            <View style={estilos.elementoMetricsFila}>
              <View style={estilos.elementoColumna}>
                <Text style={estilos.elementoColumnaValor}>{item.quantityAssigned} {item.unit}</Text>
                <Text style={estilos.elementoColumnaLbl}>1. Asignado</Text>
              </View>

              <View style={estilos.elementoColumna}>
                <Text style={[estilos.elementoColumnaValor, { color: tema.colors.primaryDark }]}>
                  {item.quantityRetrieved} {item.unit}
                </Text>
                <Text style={estilos.elementoColumnaLbl}>2. Retirado</Text>
              </View>

              <View style={estilos.elementoColumna}>
                <Text style={[estilos.elementoColumnaValor, item.quantityPending > 0 ? { color: tema.colors.warnDark } : {}]}>
                  {item.quantityPending} {item.unit}
                </Text>
                <Text style={estilos.elementoColumnaLbl}>3. Pendiente</Text>
              </View>
            </View>

            {/* Barra individual de cumplimiento */}
            <View style={{ marginTop: 8 }}>
              <BarraProgreso
                value={item.quantityRetrieved}
                max={item.quantityAssigned}
                height={5}
                color={item.quantityPending === 0 ? tema.colors.ok : tema.colors.primary}
              />
            </View>
          </Tarjeta>
        ))
      )}

      {/* 5. BOTONES DE ACCIÓN RÁPIDA (PEDIR / DEVOLVER) */}
      <View style={estilos.inferiorAcciones}>
        <Boton
          title="Devolver Sobrante"
          variant="outline"
          size="md"
          icon="return-down-back-outline"
          onPress={() => onNavigateTab && onNavigateTab("registrar")}
          style={{ flex: 1, marginRight: 8, height: 46, borderColor: tema.colors.transit }}
          textStyle={{ color: tema.colors.transit }}
        />
        <Boton
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

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  seccionEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  proyectosScroll: {
    marginBottom: tema.spacing.md,
  },
  proyectoChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
    minHeight: 40,
  },
  proyectoChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  proyectoChipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    fontWeight: "600",
  },
  proyectoChipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  sincronizacionTarjeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  sincronizacionIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sincronizacionTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  sincronizacionTimestamp: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  refreshBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.primaryLight,
  },
  refreshBotonTexto: {
    fontSize: 11,
    color: tema.colors.primaryDark,
    fontWeight: "bold",
    marginLeft: 4,
  },
  resumenTarjeta: {
    marginBottom: tema.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  resumenEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 6,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  metricsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricCaja: {
    flex: 1,
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    alignItems: "center",
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  metricValor: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  supplyProgresoCaja: {
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  supplyEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  supplyEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  supplyPorcentaje: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  listaEncabezado: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  elementoTarjeta: {
    marginBottom: tema.spacing.sm,
    backgroundColor: tema.colors.card,
  },
  elementoSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  elementoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  elementoSku: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  elementoMetricsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  elementoColumna: {
    flex: 1,
    alignItems: "center",
  },
  elementoColumnaValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  elementoColumnaLbl: {
    fontSize: 9,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  inferiorAcciones: {
    flexDirection: "row",
    marginTop: tema.spacing.md,
    marginBottom: tema.spacing.lg,
    flexWrap: "wrap",
    gap: 8,
  },
});
