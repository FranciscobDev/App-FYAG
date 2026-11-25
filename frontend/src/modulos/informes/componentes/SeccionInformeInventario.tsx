import React from "react";
import { ScrollView, Text, View } from "react-native";
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, Insignia } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeInventario {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoProductos: any;
  inventarioTotals: any;
  width: any;
}

export const SeccionInformeInventario: React.FC<PropiedadesSeccionInformeInventario> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoProductos,
  inventarioTotals,
}) => {
  if (activoPestana !== "inventario") return null;

  if (filtradoProductos.length === 0) {
    return (
      <EstadoVacio
        icon="cube-outline"
        title="Sin insumos coincidentes"
        description="No hay insumos que cumplan los filtros seleccionados."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  const obtenerCostoUnitario = (p: any) => {
    const pmp = Number(p.pmp || 0);
    return pmp > 0 ? pmp : Number(p.unitCost || 0);
  };

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {filtradoProductos.map((p: any) => {
          const esOut = p.stock === 0;
          const esLow = p.stock <= p.minStock && p.stock > 0;
          const costoU = obtenerCostoUnitario(p);
          const valorTotal = p.stock * costoU;

          const semaforo = esOut
            ? {
                bg: "#fef2f2",
                border: "#fca5a5",
                stripe: "#dc2626",
                text: "#991b1b",
                divider: "#fecaca",
                label: "Agotado",
                tone: "danger" as const,
              }
            : esLow
              ? {
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  stripe: "#d97706",
                  text: "#92400e",
                  divider: "#fde68a",
                  label: "Bajo Mínimo",
                  tone: "warn" as const,
                }
              : {
                  bg: "#f0fdf4",
                  border: "#86efac",
                  stripe: "#16a34a",
                  text: "#166534",
                  divider: "#bbf7d0",
                  label: "Stock Óptimo",
                  tone: "ok" as const,
                };

          return (
            <View
              key={p.sku}
              style={{
                backgroundColor: semaforo.bg,
                borderColor: semaforo.border,
                borderWidth: 1.5,
                borderLeftWidth: 6,
                borderLeftColor: semaforo.stripe,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Insignia label={semaforo.label} tone={semaforo.tone} size="sm" />
                    <Text style={{ fontSize: 11, fontWeight: "800", color: semaforo.text }}>
                      {p.sku}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Categoría: <Text style={{ fontWeight: "700", color: semaforo.text }}>{p.category}</Text>
                    {p.location ? ` • Ubicación: ${p.location}` : ""}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: semaforo.divider,
                    borderRadius: 9,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    alignItems: "flex-end",
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                    Valorización
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                    {formatearCLP(valorTotal)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: semaforo.divider,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  marginTop: 8,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                  Existencia:{" "}
                  <Text style={{ fontWeight: "900", color: semaforo.text }}>
                    {p.stock} {p.unit}
                  </Text>{" "}
                  (Mínimo: {p.minStock} {p.unit})
                </Text>

                <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                  Costo / PMP Unit.:{" "}
                  <Text style={{ fontWeight: "800", color: tema.colors.text }}>
                    {formatearCLP(costoU)}
                  </Text>
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 840 }}>
      <View style={{ minWidth: 840, flex: 1 }}>
        <View style={estilos.tablaEncabezadoFila}>
          <Text style={[estilos.thCelda, { width: 110 }]}>SKU</Text>
          <Text style={[estilos.thCelda, { width: 220 }]}>Nombre del Insumo</Text>
          <Text style={[estilos.thCelda, { width: 120 }]}>Categoría</Text>
          <Text style={[estilos.thCelda, { width: 70, textAlign: "right" }]}>Stock</Text>
          <Text style={[estilos.thCelda, { width: 70, textAlign: "right" }]}>Mínimo</Text>
          <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
          <Text style={[estilos.thCelda, { width: 120, textAlign: "right" }]}>Total ($ CLP)</Text>
        </View>

        {filtradoProductos.map((p: any) => {
          const costoU = obtenerCostoUnitario(p);
          return (
            <View key={p.sku} style={estilos.tablaFila}>
              <Text style={[estilos.tdCelda, { width: 110, fontWeight: "600" }]}>{p.sku}</Text>
              <View style={{ width: 220 }}>
                <Text style={estilos.filaPrincipalTexto}>{p.name}</Text>
                <Text style={estilos.filaSubTexto}>{p.unit}</Text>
              </View>
              <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{p.category}</Text>
              <Text
                style={[
                  estilos.tdCelda,
                  {
                    width: 70,
                    textAlign: "right",
                    fontWeight: "bold",
                    color: p.stock <= p.minStock ? tema.colors.dangerDark : tema.colors.text,
                  },
                ]}
              >
                {p.stock}
              </Text>
              <Text style={[estilos.tdCelda, { width: 70, textAlign: "right", color: tema.colors.textMuted }]}>
                {p.minStock}
              </Text>
              <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textSecondary }]}>
                {formatearCLP(costoU)}
              </Text>
              <Text style={[estilos.tdCelda, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
                {formatearCLP(p.stock * costoU)}
              </Text>
            </View>
          );
        })}

        <View style={estilos.totalsFila}>
          <View style={{ width: 450 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES DE EXISTENCIAS ({inventarioTotals.count} SKUs):
            </Text>
          </View>
          <Text style={[estilos.totalsCelda, { width: 70, textAlign: "right", fontWeight: "bold" }]}>
            {inventarioTotals.totalUnits} un
          </Text>
          <Text style={[estilos.totalsCelda, { width: 70, textAlign: "right" }]}>-</Text>
          <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>-</Text>
          <Text style={[estilos.totalsCeldaBold, { width: 120, textAlign: "right" }]}>
            {formatearCLP(inventarioTotals.totalValuation)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
