import React, { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  CampoBusqueda,
} from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionMermas {
  activoPestana: any;
  manejarAbrirMermaModal: any;
  mermaSku: any;
  registrosMerma: any;
  width: any;
}

type FiltroMotivoMerma = "todas" | "dano" | "perdida" | "caducidad";

const normalizarMotivo = (motivo: string) =>
  (motivo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const SeccionMermas: React.FC<PropiedadesSeccionMermas> = ({
  activoPestana,
  manejarAbrirMermaModal,
  registrosMerma = [],
  width,
}) => {
  const esMovilEstrecho = (width || 400) < 440;
  const [busqueda, establecerBusqueda] = useState("");
  const [filtroMotivo, establecerFiltroMotivo] = useState<FiltroMotivoMerma>("todas");

  const metricas = useMemo(() => {
    let dano = 0;
    let perdida = 0;
    let caducidad = 0;
    let totalPerdidaClp = 0;

    registrosMerma.forEach((w: any) => {
      const m = normalizarMotivo(w.reason);
      totalPerdidaClp += Number(w.totalLoss || 0);
      if (m.includes("dano")) dano += 1;
      else if (m.includes("perdida")) perdida += 1;
      else if (m.includes("caduc")) caducidad += 1;
    });

    return {
      total: registrosMerma.length,
      dano,
      perdida,
      caducidad,
      totalPerdidaClp: Math.round(totalPerdidaClp),
    };
  }, [registrosMerma]);

  const mermasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return registrosMerma.filter((w: any) => {
      const m = normalizarMotivo(w.reason);
      if (filtroMotivo === "dano" && !m.includes("dano")) return false;
      if (filtroMotivo === "perdida" && !m.includes("perdida")) return false;
      if (filtroMotivo === "caducidad" && !m.includes("caduc")) return false;

      if (q) {
        const coincideSku = (w.sku || "").toLowerCase().includes(q);
        const coincideNombre = (w.productName || "").toLowerCase().includes(q);
        const coincideUsuario = (w.user || "").toLowerCase().includes(q);
        const coincideObs = (w.observation || "").toLowerCase().includes(q);
        if (!coincideSku && !coincideNombre && !coincideUsuario && !coincideObs) {
          return false;
        }
      }
      return true;
    });
  }, [registrosMerma, filtroMotivo, busqueda]);

  const obtenerEstiloSemaforoMerma = (reason: string) => {
    const m = normalizarMotivo(reason);
    if (m.includes("caduc") || m.includes("venc")) {
      return {
        fondoTarjeta: "#fffbeb",
        bordeTarjeta: "#fcd34d",
        franjaLateral: "#d97706",
        colorTexto: "#92400e",
        tone: "warn" as const,
      };
    }
    return {
      fondoTarjeta: "#fef2f2",
      bordeTarjeta: "#fca5a5",
      franjaLateral: "#dc2626",
      colorTexto: "#991b1b",
      tone: "danger" as const,
    };
  };

  return (
    <>
      {/* =====================================================================
          5. TAB MERMAS (COMPACTO + 2x2 KPIs INTERACTIVOS + TARJETAS CON COLOR)
          ===================================================================== */}
      {activoPestana === "mermas" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* 1. CABECERA COMPACTA INDUSTRIAL + PÉRDIDA VALORIZADA EN VIVO */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: "#fee2e2",
                    borderWidth: 1,
                    borderColor: "#fca5a5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                    Control de Mermas — Baja por PMP
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Pérdida total valorizada:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.danger }}>
                      {formatearCLP(metricas.totalPerdidaClp)}
                    </Text>{" "}
                    ({metricas.total} bajas registradas)
                  </Text>
                </View>
              </View>

              <Boton
                title="Registrar Merma"
                variant="danger"
                size="sm"
                icon="add-circle-outline"
                onPress={manejarAbrirMermaModal}
                style={{ minHeight: 40 }}
                fullWidth={esMovilEstrecho}
              />
            </View>
          </Tarjeta>

          {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS (FILTRAN POR MOTIVO CON 1 TOQUE) */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "todas" as FiltroMotivoMerma,
                titulo: "Total Mermas",
                valor: metricas.total,
                sub: formatearCLP(metricas.totalPerdidaClp),
                icon: "layers-outline" as const,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                borderActivo: "#334155",
                textColor: "#0f172a",
              },
              {
                id: "dano" as FiltroMotivoMerma,
                titulo: "Por Daño",
                valor: metricas.dano,
                sub: "Rotura / Avería",
                icon: "construct-outline" as const,
                bg: "#fef2f2",
                border: "#fca5a5",
                borderActivo: "#dc2626",
                textColor: "#991b1b",
              },
              {
                id: "caducidad" as FiltroMotivoMerma,
                titulo: "Caducidad",
                valor: metricas.caducidad,
                sub: "Vencimiento",
                icon: "time-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "perdida" as FiltroMotivoMerma,
                titulo: "Por Pérdida",
                valor: metricas.perdida,
                sub: "Extravío / Robo",
                icon: "help-circle-outline" as const,
                bg: "#fef2f2",
                border: "#fca5a5",
                borderActivo: "#b91c1c",
                textColor: "#991b1b",
              },
            ].map((kpi) => {
              const activo = filtroMotivo === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.8}
                  onPress={() => establecerFiltroMotivo(kpi.id)}
                  style={{
                    flexBasis: "48%",
                    flexGrow: 1,
                    minWidth: 140,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2 : 1,
                    borderColor: activo ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 5,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                      {kpi.valor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activo ? "800" : "600",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {activo ? "● Vista activa" : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. BUSCADOR COMPACTO */}
          <CampoBusqueda
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar merma por SKU, nombre, responsable u observación..."
            containerStyle={{ marginBottom: 12 }}
          />

          {/* 4. LISTADO COMPACTO DE MERMAS CON SEMÁFORO DE SUPERFICIE */}
          {mermasFiltradas.length === 0 ? (
            <EstadoVacio
              icon="shield-checkmark-outline"
              title="Sin mermas en esta vista"
              description={
                busqueda.trim()
                  ? `No se encontraron registros para "${busqueda.trim()}".`
                  : "No hay bajas de inventario registradas bajo este motivo."
              }
              actionTitle={filtroMotivo !== "todas" ? "Ver Todas las Mermas" : "Registrar Merma"}
              onAction={
                filtroMotivo !== "todas"
                  ? () => establecerFiltroMotivo("todas")
                  : manejarAbrirMermaModal
              }
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            mermasFiltradas.map((w: any) => {
              const semaforo = obtenerEstiloSemaforoMerma(w.reason);
              return (
                <Tarjeta
                  key={w.id}
                  variant="outlined"
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    backgroundColor: semaforo.fondoTarjeta,
                    borderColor: semaforo.bordeTarjeta,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.franjaLateral,
                    borderRadius: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: semaforo.colorTexto,
                          letterSpacing: 0.3,
                        }}
                      >
                        {w.sku}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: tema.colors.text,
                          marginTop: 1,
                        }}
                      >
                        {w.productName}
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 2 }}>
                        👤 {w.user} • 📅 {formatearFecha(w.date)}
                      </Text>
                    </View>
                    <Insignia
                      label={w.reason.toUpperCase()}
                      tone={semaforo.tone}
                      size="sm"
                    />
                  </View>

                  {/* Métricas en 1 sola fila horizontal limpia */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: semaforo.bordeTarjeta,
                      borderRadius: 9,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      marginTop: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "800",
                          color: tema.colors.textMuted,
                          textTransform: "uppercase",
                        }}
                      >
                        Cantidad Baja
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "900",
                          color: tema.colors.danger,
                          marginTop: 1,
                        }}
                      >
                        -{w.quantity} {w.unit}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "800",
                          color: tema.colors.textMuted,
                          textTransform: "uppercase",
                        }}
                      >
                        PMP Unitario
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: tema.colors.text,
                          marginTop: 1,
                        }}
                      >
                        {formatearCLP(w.pmp)}
                      </Text>
                    </View>

                    <View style={{ flex: 1.1, alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "800",
                          color: tema.colors.textMuted,
                          textTransform: "uppercase",
                        }}
                      >
                        Pérdida Total
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "900",
                          color: tema.colors.danger,
                          marginTop: 1,
                        }}
                      >
                        {formatearCLP(w.totalLoss)}
                      </Text>
                    </View>
                  </View>

                  {/* Observación obligatoria compacta */}
                  <Text
                    style={{
                      fontSize: 11,
                      fontStyle: "italic",
                      color: tema.colors.textSecondary,
                      marginTop: 8,
                      lineHeight: 15,
                    }}
                  >
                    💬 <Text style={{ fontWeight: "700", fontStyle: "normal", color: semaforo.colorTexto }}>Justificación:</Text> &ldquo;{w.observation}&rdquo;
                  </Text>
                </Tarjeta>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );
};
