import React from "react";
import { ScrollView, Text, View } from "react-native";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, Insignia } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeMermas {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoWastes: any;
  mermaTotals: any;
  productos: any;
  width: any;
}

export const SeccionInformeMermas: React.FC<PropiedadesSeccionInformeMermas> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoWastes,
  mermaTotals,
  productos,
}) => {
  if (activoPestana !== "mermas") return null;

  if (filtradoWastes.length === 0) {
    return (
      <EstadoVacio
        icon="trash-bin-outline"
        title="Sin mermas registradas"
        description="No existen mermas para los filtros seleccionados."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {filtradoWastes.map((w: any) => {
          const producto = productos.find((p: any) => p.sku === w.sku);

          return (
            <View
              key={w.id}
              style={{
                backgroundColor: "#fef2f2",
                borderColor: "#fca5a5",
                borderWidth: 1.5,
                borderLeftWidth: 6,
                borderLeftColor: "#dc2626",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Insignia label="Baja Auditada" tone="danger" size="sm" />
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#991b1b" }}>
                      {w.sku}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    {producto ? producto.name : w.sku}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#991b1b", marginTop: 1 }}>
                    Motivo: {w.reason}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    borderRadius: 9,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    alignItems: "flex-end",
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                    Pérdida Valorizada
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: "#991b1b" }}>
                    -{formatearCLP(w.totalLoss)}
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
                  borderColor: "#fecaca",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  marginTop: 8,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                  Cantidad dada de baja:{" "}
                  <Text style={{ fontWeight: "900", color: "#991b1b" }}>
                    -{w.quantity} {w.unit || producto?.unit || "un"}
                  </Text>
                </Text>

                <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                  Responsable: <Text style={{ fontWeight: "700", color: tema.colors.text }}>{w.user}</Text>
                  {" • "}{formatearFecha(w.date)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 800 }}>
      <View style={{ minWidth: 800, flex: 1 }}>
        <View style={estilos.tablaEncabezadoFila}>
          <Text style={[estilos.thCelda, { width: 95 }]}>Fecha</Text>
          <Text style={[estilos.thCelda, { width: 110 }]}>SKU</Text>
          <Text style={[estilos.thCelda, { width: 200 }]}>Insumo</Text>
          <Text style={[estilos.thCelda, { width: 80, textAlign: "right" }]}>Cantidad</Text>
          <Text style={[estilos.thCelda, { width: 130 }]}>Motivo</Text>
          <Text style={[estilos.thCelda, { width: 120 }]}>Responsable</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Pérdida ($ CLP)</Text>
        </View>

        {filtradoWastes.map((w: any) => {
          const producto = productos.find((p: any) => p.sku === w.sku);
          return (
            <View key={w.id} style={estilos.tablaFila}>
              <Text style={[estilos.tdCelda, { width: 95, fontSize: 11 }]}>{w.date}</Text>
              <Text style={[estilos.tdCelda, { width: 110, fontWeight: "600" }]}>{w.sku}</Text>
              <Text style={[estilos.tdCelda, { width: 200 }]}>{producto ? producto.name : w.sku}</Text>
              <Text style={[estilos.tdCelda, { width: 80, textAlign: "right", color: tema.colors.dangerDark, fontWeight: "bold" }]}>
                {w.quantity}
              </Text>
              <Text style={[estilos.tdCelda, { width: 130, fontSize: 11 }]}>{w.reason}</Text>
              <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{w.user}</Text>
              <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold", color: tema.colors.dangerDark }]}>
                {formatearCLP(w.totalLoss)}
              </Text>
            </View>
          );
        })}

        <View style={estilos.totalsFila}>
          <View style={{ width: 405 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES MERMAS ({mermaTotals.count}):
            </Text>
          </View>
          <Text style={[estilos.totalsCeldaBold, { width: 80, textAlign: "right", color: tema.colors.dangerDark }]}>
            {mermaTotals.totalUnits} un
          </Text>
          <Text style={[estilos.totalsCelda, { width: 130 }]}>-</Text>
          <Text style={[estilos.totalsCelda, { width: 120 }]}>-</Text>
          <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
            {formatearCLP(mermaTotals.totalCost)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
