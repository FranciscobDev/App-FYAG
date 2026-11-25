import React from "react";
import { ScrollView, Text, View } from "react-native";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, Insignia, InsigniaEstado } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeGastos {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoPurchases: any;
  purchasesTotals: any;
  width: any;
}

export const SeccionInformeGastos: React.FC<PropiedadesSeccionInformeGastos> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoPurchases,
  purchasesTotals,
}) => {
  if (activoPestana !== "gastos") return null;

  if (filtradoPurchases.length === 0) {
    return (
      <EstadoVacio
        icon="receipt-outline"
        title="Sin compras ni facturas"
        description="No hay compras registradas en el período seleccionado."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {filtradoPurchases.map((inv: any) => {
          const tieneDiscrepancia = Boolean(inv.hasReceptionDiscrepancy);
          const esConforme = inv.status === "recepcion_conforme" && !tieneDiscrepancia;

          const semaforo = tieneDiscrepancia
            ? {
                bg: "#fef2f2",
                border: "#fca5a5",
                stripe: "#dc2626",
                text: "#991b1b",
                divider: "#fecaca",
                label: "Con Discrepancia",
                tone: "danger" as const,
              }
            : esConforme
              ? {
                  bg: "#f0fdf4",
                  border: "#86efac",
                  stripe: "#16a34a",
                  text: "#166534",
                  divider: "#bbf7d0",
                  label: "Recepción Conforme",
                  tone: "ok" as const,
                }
              : {
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  stripe: "#d97706",
                  text: "#92400e",
                  divider: "#fde68a",
                  label: "Registrada",
                  tone: "warn" as const,
                };

          return (
            <View
              key={inv.id}
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
                    {inv.orderCode && <Insignia label={inv.orderCode} tone="info" size="sm" />}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    Factura N° {inv.number}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                    {inv.supplierName} • Fecha: {formatearFecha(inv.date)}
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
                    Total c/ IVA
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                    {formatearCLP(inv.total)}
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
                <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                  Monto Neto:{" "}
                  <Text style={{ fontWeight: "800", color: tema.colors.text }}>
                    {formatearCLP(inv.subtotalNet)}
                  </Text>
                </Text>

                <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                  IVA (19%):{" "}
                  <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                    {formatearCLP(inv.iva)}
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
          <Text style={[estilos.thCelda, { width: 120 }]}>N° Factura</Text>
          <Text style={[estilos.thCelda, { width: 200 }]}>Proveedor</Text>
          <Text style={[estilos.thCelda, { width: 95 }]}>Fecha</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Monto Neto ($)</Text>
          <Text style={[estilos.thCelda, { width: 100, textAlign: "right" }]}>IVA ($)</Text>
          <Text style={[estilos.thCelda, { width: 120, textAlign: "right" }]}>Total Facturado ($)</Text>
          <Text style={[estilos.thCelda, { width: 85, textAlign: "center" }]}>Estado</Text>
        </View>

        {filtradoPurchases.map((inv: any) => (
          <View key={inv.id} style={estilos.tablaFila}>
            <Text style={[estilos.tdCelda, { width: 120, fontWeight: "bold" }]}>{inv.number}</Text>
            <Text style={[estilos.tdCelda, { width: 200 }]}>{inv.supplierName}</Text>
            <Text style={[estilos.tdCelda, { width: 95, fontSize: 11 }]}>{inv.date}</Text>
            <Text style={[estilos.tdCelda, { width: 110, textAlign: "right" }]}>
              {formatearCLP(inv.subtotalNet)}
            </Text>
            <Text style={[estilos.tdCelda, { width: 100, textAlign: "right", color: tema.colors.textMuted }]}>
              {formatearCLP(inv.iva)}
            </Text>
            <Text style={[estilos.tdCelda, { width: 120, textAlign: "right", fontWeight: "bold" }]}>
              {formatearCLP(inv.total)}
            </Text>
            <View style={{ width: 85, alignItems: "center" }}>
              <InsigniaEstado
                status={inv.status === "recepcion_conforme" ? "aprobada" : "pendiente"}
                label={inv.status === "recepcion_conforme" ? "CONFORME" : "DISCREPANCIA"}
              />
            </View>
          </View>
        ))}

        <View style={estilos.totalsFila}>
          <View style={{ width: 415 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES FACTURAS ({purchasesTotals.count}):
            </Text>
          </View>
          <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
            {formatearCLP(purchasesTotals.totalNet)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 100, textAlign: "right" }]}>
            {formatearCLP(purchasesTotals.totalVat)}
          </Text>
          <Text style={[estilos.totalsCeldaBold, { width: 120, textAlign: "right", color: tema.colors.primaryDark }]}>
            {formatearCLP(purchasesTotals.totalFinal)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 85, textAlign: "center" }]}>-</Text>
        </View>
      </View>
    </ScrollView>
  );
};
