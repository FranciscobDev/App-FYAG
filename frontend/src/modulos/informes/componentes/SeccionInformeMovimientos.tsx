import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, Insignia } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeMovimientos {
  activoPestana: any;
  cardexTotals: any;
  effectiveVistaModo: any;
  filtradoCardex: any;
  width: any;
}

export const SeccionInformeMovimientos: React.FC<PropiedadesSeccionInformeMovimientos> = ({
  activoPestana,
  cardexTotals,
  effectiveVistaModo,
  filtradoCardex,
}) => {
  if (activoPestana !== "movimientos") return null;

  if (filtradoCardex.length === 0) {
    return (
      <EstadoVacio
        icon="swap-horizontal-outline"
        title="Sin movimientos coincidentes"
        description="No se encontraron registros de Cardex con los filtros aplicados."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {filtradoCardex.map((item: any) => {
          const esEntrada = item.type === "entrada_compra" || item.qtyIn > 0;
          const esMerma = item.type === "merma";

          const semaforo = esMerma
            ? {
                bg: "#fef2f2",
                border: "#fca5a5",
                stripe: "#dc2626",
                text: "#991b1b",
                divider: "#fecaca",
                tone: "danger" as const,
              }
            : esEntrada
              ? {
                  bg: "#f0fdf4",
                  border: "#86efac",
                  stripe: "#16a34a",
                  text: "#166534",
                  divider: "#bbf7d0",
                  tone: "ok" as const,
                }
              : {
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  stripe: "#d97706",
                  text: "#92400e",
                  divider: "#fde68a",
                  tone: "warn" as const,
                };

          return (
            <View
              key={item.id}
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
                    <Insignia label={item.typeLabel} tone={semaforo.tone} size="sm" />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: semaforo.text }}>
                      {formatearFecha(item.date)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    {item.productName}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                    SKU: {item.sku} • Ref:{" "}
                    {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
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
                    Valor Movimiento
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                    {formatearCLP(item.totalValue)}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {item.qtyIn > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="arrow-down-circle" size={14} color="#16a34a" />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#166534" }}>
                        +{item.qtyIn} un (Entrada)
                      </Text>
                    </View>
                  )}
                  {item.qtyOut > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="arrow-up-circle" size={14} color="#dc2626" />
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#991b1b" }}>
                        -{item.qtyOut} un (Salida)
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                  PMP: <Text style={{ fontWeight: "700", color: tema.colors.text }}>{formatearCLP(item.pmp)}</Text>
                  {" • "}Saldo Stock:{" "}
                  <Text style={{ fontWeight: "900", color: tema.colors.primaryDark }}>{item.balance} un</Text>
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 980 }}>
      <View style={{ minWidth: 980, flex: 1 }}>
        <View style={estilos.tablaEncabezadoFila}>
          <Text style={[estilos.thCelda, { width: 90 }]}>Fecha</Text>
          <Text style={[estilos.thCelda, { width: 140 }]}>Tipo</Text>
          <Text style={[estilos.thCelda, { width: 220 }]}>Insumo (SKU & Nombre)</Text>
          <Text style={[estilos.thCelda, { width: 150 }]}>Referencia / Obra</Text>
          <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Entrada</Text>
          <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Salida</Text>
          <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Saldo</Text>
          <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>PMP ($)</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Total ($ CLP)</Text>
        </View>

        {filtradoCardex.map((item: any) => (
          <View key={item.id} style={estilos.tablaFila}>
            <Text style={[estilos.tdCelda, { width: 90, fontSize: 11 }]}>{item.date}</Text>
            <View style={{ width: 140 }}>
              <Insignia
                label={item.typeLabel}
                tone={
                  item.type === "entrada_compra"
                    ? "ok"
                    : item.type === "salida_obra"
                      ? "primary"
                      : item.type === "devolucion"
                        ? "warn"
                        : item.type === "merma"
                          ? "danger"
                          : "mute"
                }
                size="sm"
              />
            </View>
            <View style={{ width: 220 }}>
              <Text style={estilos.filaPrincipalTexto}>{item.productName}</Text>
              <Text style={estilos.filaSubTexto}>{item.sku}</Text>
            </View>
            <Text style={[estilos.tdCelda, { width: 150, fontSize: 11 }]}>
              {item.projectName ? `${item.projectCode} (${item.projectName})` : item.reference}
            </Text>
            <Text
              style={[
                estilos.tdCelda,
                { width: 75, textAlign: "right", color: item.qtyIn > 0 ? tema.colors.okDark : tema.colors.textMuted },
              ]}
            >
              {item.qtyIn > 0 ? `+${item.qtyIn}` : "-"}
            </Text>
            <Text
              style={[
                estilos.tdCelda,
                { width: 75, textAlign: "right", color: item.qtyOut > 0 ? tema.colors.dangerDark : tema.colors.textMuted },
              ]}
            >
              {item.qtyOut > 0 ? `-${item.qtyOut}` : "-"}
            </Text>
            <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", fontWeight: "600" }]}>
              {item.balance}
            </Text>
            <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textSecondary }]}>
              {formatearCLP(item.pmp)}
            </Text>
            <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
              {formatearCLP(item.totalValue)}
            </Text>
          </View>
        ))}

        <View style={estilos.totalsFila}>
          <View style={{ width: 600 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES CONSOLIDADOS ({cardexTotals.count} movimientos):
            </Text>
          </View>
          <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", color: tema.colors.okDark }]}>
            +{cardexTotals.totalIn}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", color: tema.colors.dangerDark }]}>
            -{cardexTotals.totalOut}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right" }]}>-</Text>
          <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>-</Text>
          <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
            {formatearCLP(cardexTotals.totalValue)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
