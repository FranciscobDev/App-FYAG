import React from "react";
import { ScrollView, Text, View } from "react-native";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, InsigniaEstado } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeMateriales {
  activoPestana: any;
  asignadoMateriales: any;
  asignadoMaterialesTotals: any;
  effectiveVistaModo: any;
  width: any;
}

export const SeccionInformeMateriales: React.FC<PropiedadesSeccionInformeMateriales> = ({
  activoPestana,
  asignadoMateriales,
  asignadoMaterialesTotals,
  effectiveVistaModo,
}) => {
  if (activoPestana !== "materiales") return null;

  if (asignadoMateriales.length === 0) {
    return (
      <EstadoVacio
        icon="layers-outline"
        title="Sin materiales asignados"
        description="No existen solicitudes de insumos a faenas para los filtros seleccionados."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {asignadoMateriales.map((m: any) => {
          const entregadoCompleto =
            m.quantityDelivered >= m.quantityRequested && m.quantityRequested > 0;
          const semaforo = entregadoCompleto
            ? {
                bg: "#f0fdf4",
                border: "#86efac",
                stripe: "#16a34a",
                text: "#166534",
                divider: "#bbf7d0",
              }
            : {
                bg: "#fffbeb",
                border: "#fcd34d",
                stripe: "#d97706",
                text: "#92400e",
                divider: "#fde68a",
              };

          return (
            <View
              key={m.id}
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
                    <InsigniaEstado status={m.status as any} label={m.status.toUpperCase()} />
                    <Text style={{ fontSize: 11, fontWeight: "800", color: semaforo.text }}>
                      {m.requestId}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    {m.productName}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                    SKU: {m.sku} • Faena: {m.projectName}
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
                    Costo Imputado
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                    {formatearCLP(m.estimatedCost)}
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
                  Despacho:{" "}
                  <Text style={{ fontWeight: "900", color: semaforo.text }}>
                    {m.quantityDelivered} / {m.quantityRequested} un
                  </Text>
                </Text>

                <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                  Solicitante: <Text style={{ fontWeight: "700", color: tema.colors.text }}>{m.technicianRut}</Text>
                  {" • "}{formatearFecha(m.date)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 880 }}>
      <View style={{ minWidth: 880, flex: 1 }}>
        <View style={estilos.tablaEncabezadoFila}>
          <Text style={[estilos.thCelda, { width: 90 }]}>Fecha</Text>
          <Text style={[estilos.thCelda, { width: 170 }]}>Proyecto / Obra</Text>
          <Text style={[estilos.thCelda, { width: 200 }]}>Insumo (SKU & Nombre)</Text>
          <Text style={[estilos.thCelda, { width: 120 }]}>Técnico Solicitante</Text>
          <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Solicitado</Text>
          <Text style={[estilos.thCelda, { width: 75, textAlign: "right" }]}>Entregado</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Valor Total ($)</Text>
        </View>

        {asignadoMateriales.map((m: any) => (
          <View key={m.id} style={estilos.tablaFila}>
            <Text style={[estilos.tdCelda, { width: 90, fontSize: 11 }]}>{m.date}</Text>
            <Text style={[estilos.tdCelda, { width: 170, fontSize: 11, fontWeight: "600" }]}>
              {m.projectName}
            </Text>
            <View style={{ width: 200 }}>
              <Text style={estilos.filaPrincipalTexto}>{m.productName}</Text>
              <Text style={estilos.filaSubTexto}>{m.sku}</Text>
            </View>
            <Text style={[estilos.tdCelda, { width: 120, fontSize: 11 }]}>{m.technicianRut}</Text>
            <Text style={[estilos.tdCelda, { width: 75, textAlign: "right" }]}>
              {m.quantityRequested}
            </Text>
            <Text style={[estilos.tdCelda, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
              {m.quantityDelivered}
            </Text>
            <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", fontWeight: "bold" }]}>
              {formatearCLP(m.estimatedCost)}
            </Text>
          </View>
        ))}

        <View style={estilos.totalsFila}>
          <View style={{ width: 580 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES DE MATERIALES EN FAENA ({asignadoMaterialesTotals.count}):
            </Text>
          </View>
          <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right" }]}>
            {asignadoMaterialesTotals.totalReq}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 75, textAlign: "right", fontWeight: "bold" }]}>
            {asignadoMaterialesTotals.totalDeliv}
          </Text>
          <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
            {formatearCLP(asignadoMaterialesTotals.totalVal)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
