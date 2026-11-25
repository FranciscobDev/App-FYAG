import React from "react";
import { ScrollView, Text, View } from "react-native";
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { EstadoVacio, Insignia, InsigniaEstado } from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionInformeProyectos {
  activoPestana: any;
  effectiveVistaModo: any;
  filtradoProyectos: any;
  proyectosTotals: any;
  width: any;
}

export const SeccionInformeProyectos: React.FC<PropiedadesSeccionInformeProyectos> = ({
  activoPestana,
  effectiveVistaModo,
  filtradoProyectos,
  proyectosTotals,
}) => {
  if (activoPestana !== "proyectos") return null;

  if (filtradoProyectos.length === 0) {
    return (
      <EstadoVacio
        icon="business-outline"
        title="Sin proyectos coincidentes"
        description="No hay proyectos que cumplan con la búsqueda."
        containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
      />
    );
  }

  if (effectiveVistaModo === "cards") {
    return (
      <View style={estilos.tarjetasLista}>
        {filtradoProyectos.map((proj: any) => {
          const margen = Number(proj.budget || 0) - Number(proj.costReal || 0);
          const pctMargen =
            proj.budget > 0 ? Math.round((margen / proj.budget) * 100) : 0;
          const pctConsumo =
            proj.budget > 0 ? Math.min(100, Math.round((proj.costReal / proj.budget) * 100)) : 0;

          const semaforo =
            margen < 0
              ? {
                  bg: "#fef2f2",
                  border: "#fca5a5",
                  stripe: "#dc2626",
                  text: "#991b1b",
                  divider: "#fecaca",
                }
              : pctMargen < 20
                ? {
                    bg: "#fffbeb",
                    border: "#fcd34d",
                    stripe: "#d97706",
                    text: "#92400e",
                    divider: "#fde68a",
                  }
                : {
                    bg: "#f0fdf4",
                    border: "#86efac",
                    stripe: "#16a34a",
                    text: "#166534",
                    divider: "#bbf7d0",
                  };

          return (
            <View
              key={proj.id}
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
                    <Insignia label={proj.code} tone="info" size="sm" />
                    <InsigniaEstado status={proj.status} label={proj.status.toUpperCase()} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text, marginTop: 4 }}>
                    {proj.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                    Cliente: {proj.client} • Avance físico: {proj.progress ?? 0}%
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
                    Margen ({pctMargen}%)
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                    {formatearCLP(margen)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: semaforo.divider,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  marginTop: 8,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                    Presupuesto:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.text }}>
                      {formatearCLP(proj.budget)}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }}>
                    Costo Real Ejecutado:{" "}
                    <Text style={{ fontWeight: "900", color: semaforo.text }}>
                      {formatearCLP(proj.costReal)} ({pctConsumo}%)
                    </Text>
                  </Text>
                </View>

                <View style={{ height: 6, borderRadius: 999, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${pctConsumo}%`,
                      height: "100%",
                      backgroundColor: semaforo.stripe,
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                    Mano de Obra (HH):{" "}
                    <Text style={{ fontWeight: "700", color: tema.colors.textSecondary }}>
                      {formatearCLP(proj.costRealHours || 0)}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                    Materiales:{" "}
                    <Text style={{ fontWeight: "700", color: tema.colors.textSecondary }}>
                      {formatearCLP(proj.costRealMaterials || 0)}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 920 }}>
      <View style={{ minWidth: 920, flex: 1 }}>
        <View style={estilos.tablaEncabezadoFila}>
          <Text style={[estilos.thCelda, { width: 90 }]}>Código</Text>
          <Text style={[estilos.thCelda, { width: 190 }]}>Proyecto & Cliente</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Presupuesto ($)</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Costo Ejecutado</Text>
          <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>Costo HH ($)</Text>
          <Text style={[estilos.thCelda, { width: 95, textAlign: "right" }]}>Costo Mat ($)</Text>
          <Text style={[estilos.thCelda, { width: 110, textAlign: "right" }]}>Margen ($)</Text>
          <Text style={[estilos.thCelda, { width: 90, textAlign: "center" }]}>Estado</Text>
        </View>

        {filtradoProyectos.map((p: any) => {
          const margen = p.budget - p.costReal;
          return (
            <View key={p.id} style={estilos.tablaFila}>
              <Text style={[estilos.tdCelda, { width: 90, fontWeight: "600" }]}>{p.code}</Text>
              <View style={{ width: 190 }}>
                <Text style={estilos.filaPrincipalTexto}>{p.name}</Text>
                <Text style={estilos.filaSubTexto}>{p.client}</Text>
              </View>
              <Text style={[estilos.tdCelda, { width: 110, textAlign: "right" }]}>
                {formatearCLP(p.budget)}
              </Text>
              <Text style={[estilos.tdCelda, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
                {formatearCLP(p.costReal)}
              </Text>
              <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textMuted }]}>
                {formatearCLP(p.costRealHours || 0)}
              </Text>
              <Text style={[estilos.tdCelda, { width: 95, textAlign: "right", color: tema.colors.textMuted }]}>
                {formatearCLP(p.costRealMaterials || 0)}
              </Text>
              <Text
                style={[
                  estilos.tdCelda,
                  {
                    width: 110,
                    textAlign: "right",
                    fontWeight: "bold",
                    color: margen >= 0 ? tema.colors.okDark : tema.colors.dangerDark,
                  },
                ]}
              >
                {formatearCLP(margen)}
              </Text>
              <View style={{ width: 90, alignItems: "center" }}>
                <InsigniaEstado status={p.status} label={p.status.toUpperCase()} />
              </View>
            </View>
          );
        })}

        <View style={estilos.totalsFila}>
          <View style={{ width: 280 }}>
            <Text style={estilos.totalsTitulo}>
              TOTALES CONSOLIDADOS ({proyectosTotals.count} Obras):
            </Text>
          </View>
          <Text style={[estilos.totalsCeldaBold, { width: 110, textAlign: "right" }]}>
            {formatearCLP(proyectosTotals.totalBudget)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 110, textAlign: "right", color: tema.colors.dangerDark }]}>
            {formatearCLP(proyectosTotals.totalCostReal)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>
            {formatearCLP(proyectosTotals.totalCostHours)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 95, textAlign: "right" }]}>
            {formatearCLP(proyectosTotals.totalCostMaterials)}
          </Text>
          <Text
            style={[
              estilos.totalsCeldaBold,
              {
                width: 110,
                textAlign: "right",
                color: proyectosTotals.totalMargin >= 0 ? tema.colors.okDark : tema.colors.dangerDark,
              },
            ]}
          >
            {formatearCLP(proyectosTotals.totalMargin)}
          </Text>
          <Text style={[estilos.totalsCelda, { width: 90, textAlign: "center" }]}>-</Text>
        </View>
      </View>
    </ScrollView>
  );
};
