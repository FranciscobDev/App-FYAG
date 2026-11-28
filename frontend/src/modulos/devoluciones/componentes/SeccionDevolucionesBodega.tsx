// Bandeja responsiva de "Devoluciones en Tránsito" para el Bodeguero con KPIs,
// filtros dinámicos y acceso directo al formulario de confirmación de cantidad real recibida.
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Insignia } from "@/componentes/base/Insignia";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { OrdenDevolucion } from "@/nucleo/tipos";

export interface PropiedadesSeccionDevolucionesBodega {
  activoPestana: string;
  establecerTransitBuscar: (valor: string) => void;
  filtradoTransitDevoluciones: OrdenDevolucion[];
  inTransitConteo: number;
  manejarAbrirConfirmarDevolucion: (ret: OrdenDevolucion) => void;
  transitBuscar: string;
  avisoBodega?: string;
  onCerrarAvisoBodega?: () => void;
}

type FiltroEstadoBodega = "en_transito" | "todas" | "recibida" | "con_discrepancia";

const tieneDiscrepanciaDevolucion = (ret: OrdenDevolucion): boolean =>
  Boolean(ret.discrepancyNote) ||
  (ret.items || []).some(
    (it) =>
      it.quantityReceivedReal !== undefined &&
      it.quantityReceivedReal !== it.quantityReturned
  );

export const SeccionDevolucionesBodega: React.FC<PropiedadesSeccionDevolucionesBodega> = ({
  activoPestana,
  establecerTransitBuscar,
  filtradoTransitDevoluciones,
  inTransitConteo,
  manejarAbrirConfirmarDevolucion,
  transitBuscar,
  avisoBodega,
  onCerrarAvisoBodega,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const [filtroEstado, establecerFiltroEstado] = useState<FiltroEstadoBodega>(
    inTransitConteo > 0 ? "en_transito" : "todas"
  );

  // Métricas del dashboard operativo de retornos de obra
  const metricas = useMemo(() => {
    const enTransito = filtradoTransitDevoluciones.filter((r) => r.status === "en_transito");
    const recibidas = filtradoTransitDevoluciones.filter((r) => r.status === "recibida");
    const conDiscrepancia = filtradoTransitDevoluciones.filter(tieneDiscrepanciaDevolucion);
    const totalUnidadesPorReingresar = enTransito.reduce(
      (acc, r) =>
        acc + (r.items || []).reduce((sum, it) => sum + Number(it.quantityReturned || 0), 0),
      0
    );

    return {
      enTransitoConteo: enTransito.length,
      recibidasConteo: recibidas.length,
      conDiscrepanciaConteo: conDiscrepancia.length,
      totalUnidadesPorReingresar: Number(totalUnidadesPorReingresar.toFixed(3)),
    };
  }, [filtradoTransitDevoluciones]);

  // Listado filtrado por estado priorizando siempre las devoluciones en tránsito
  const devolucionesVisibles = useMemo(() => {
    const lista = filtradoTransitDevoluciones.filter((r) => {
      if (filtroEstado === "en_transito") return r.status === "en_transito";
      if (filtroEstado === "recibida") return r.status === "recibida";
      if (filtroEstado === "con_discrepancia") return tieneDiscrepanciaDevolucion(r);
      return true;
    });

    return [...lista].sort((a, b) => {
      if (a.status === "en_transito" && b.status !== "en_transito") return -1;
      if (a.status !== "en_transito" && b.status === "en_transito") return 1;
      return b.date.localeCompare(a.date);
    });
  }, [filtradoTransitDevoluciones, filtroEstado]);

  if (activoPestana !== "bodega") return null;

  return (
    <ScrollView
      style={estilosLocales.contenedor}
      contentContainerStyle={estilosLocales.contenidoScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilosLocales.contenedorCentrado}>
        {/* AVISO DE CONFIRMACIÓN EXITOSA */}
        {Boolean(avisoBodega) && (
          <View style={estilosLocales.avisoExitoBanner}>
            <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} />
            <Text style={estilosLocales.avisoExitoTexto}>{avisoBodega}</Text>
            {onCerrarAvisoBodega && (
              <TouchableOpacity onPress={onCerrarAvisoBodega} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={tema.colors.okDark} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 1. CABECERA COMPACTA INDUSTRIAL + UNIDADES POR REINGRESAR EN VIVO */}
        <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12 }}>
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
                  backgroundColor: tema.colors.primaryLight,
                  borderWidth: 1,
                  borderColor: tema.colors.primaryBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="car-outline" size={20} color={tema.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                  Retornos de Obra — Bodega
                </Text>
                <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                  Por reingresar:{" "}
                  <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                    {metricas.totalUnidadesPorReingresar} unidades
                  </Text>{" "}
                  en {metricas.enTransitoConteo} envío(s) en tránsito
                </Text>
              </View>
            </View>

            <Insignia
              label={
                inTransitConteo > 0
                  ? `${inTransitConteo} en tránsito`
                  : "Bandeja al día"
              }
              tone={inTransitConteo > 0 ? "warn" : "ok"}
              size="md"
            />
          </View>
        </Tarjeta>

        {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS (FILTRAN CON 1 TOQUE, SIN CHIPS DUPLICADOS) */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            {
              id: "en_transito" as FiltroEstadoBodega,
              titulo: "En Tránsito",
              valor: metricas.enTransitoConteo,
              sub: `${metricas.totalUnidadesPorReingresar} u. por contar`,
              icon: "car-outline" as const,
              bg: "#fffbeb",
              border: "#fcd34d",
              borderActivo: "#d97706",
              textColor: "#92400e",
            },
            {
              id: "recibida" as FiltroEstadoBodega,
              titulo: "Recibidas",
              valor: metricas.recibidasConteo,
              sub: "Reingresadas OK",
              icon: "checkmark-done-circle-outline" as const,
              bg: "#f0fdf4",
              border: "#86efac",
              borderActivo: "#16a34a",
              textColor: "#166534",
            },
            {
              id: "con_discrepancia" as FiltroEstadoBodega,
              titulo: "Discrepancias",
              valor: metricas.conDiscrepanciaConteo,
              sub: "Con diferencia",
              icon: "alert-circle-outline" as const,
              bg: metricas.conDiscrepanciaConteo > 0 ? "#fef2f2" : "#f1f5f9",
              border: metricas.conDiscrepanciaConteo > 0 ? "#fca5a5" : "#cbd5e1",
              borderActivo: metricas.conDiscrepanciaConteo > 0 ? "#dc2626" : "#475569",
              textColor: metricas.conDiscrepanciaConteo > 0 ? "#991b1b" : "#334155",
            },
            {
              id: "todas" as FiltroEstadoBodega,
              titulo: "Todas",
              valor: filtradoTransitDevoluciones.length,
              sub: "Historial total",
              icon: "layers-outline" as const,
              bg: "#f1f5f9",
              border: "#cbd5e1",
              borderActivo: "#334155",
              textColor: "#0f172a",
            },
          ].map((kpi) => {
            const activo = filtroEstado === kpi.id;
            return (
              <TouchableOpacity
                key={kpi.id}
                activeOpacity={0.8}
                onPress={() => establecerFiltroEstado(kpi.id)}
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
        <View style={estilosLocales.filtrosCaja}>
          <CampoBusqueda
            value={transitBuscar}
            onChangeText={establecerTransitBuscar}
            placeholder="Buscar por código DEV, proyecto, técnico o RUT..."
          />
        </View>

        {/* 4. LISTADO RESPONSIVO DE DEVOLUCIONES CON SEMÁFORO DE SUPERFICIE */}
        {devolucionesVisibles.length === 0 ? (
          <EstadoVacio
            icon="car-outline"
            title={
              filtroEstado === "en_transito"
                ? "Sin devoluciones en tránsito"
                : "Sin devoluciones en este filtro"
            }
            description={
              filtroEstado === "en_transito"
                ? "Todas las devoluciones declaradas por los técnicos ya fueron recibidas y confirmadas en bodega."
                : "No se encontraron retornos de obra que coincidan con la búsqueda o filtro activo."
            }
            actionTitle={filtroEstado !== "todas" ? "Ver todas las devoluciones" : undefined}
            onAction={filtroEstado !== "todas" ? () => establecerFiltroEstado("todas") : undefined}
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          <View
            style={[
              estilosLocales.tarjetasGrilla,
              esPantallaAncha && estilosLocales.tarjetasGrillaAncha,
            ]}
          >
            {devolucionesVisibles.map((ret) => {
              const esTransit = ret.status === "en_transito";
              const conDiferencia = tieneDiscrepanciaDevolucion(ret);

              const fondoSem = esTransit
                ? "#fffbeb"
                : conDiferencia
                ? "#fef2f2"
                : "#f0fdf4";
              const bordeSem = esTransit
                ? "#fcd34d"
                : conDiferencia
                ? "#fca5a5"
                : "#86efac";
              const franjaSem = esTransit
                ? "#d97706"
                : conDiferencia
                ? "#dc2626"
                : "#16a34a";

              return (
                <Tarjeta
                  key={ret.id}
                  variant="outlined"
                  style={[
                    {
                      padding: 12,
                      gap: 10,
                      backgroundColor: fondoSem,
                      borderColor: bordeSem,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: franjaSem,
                      borderRadius: 12,
                    },
                    esPantallaAncha && estilosLocales.devolucionTarjetaAncha,
                  ]}
                >
                  <View style={estilosLocales.tarjetaSuperior}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <View style={estilosLocales.codigoFila}>
                        <Text style={[estilosLocales.codigoTexto, { fontSize: 15, fontWeight: "800" }]}>
                          {ret.code}
                        </Text>
                        <InsigniaEstado status={ret.status} size="sm" />
                        {conDiferencia && (
                          <Insignia label="Discrepancia" tone="danger" size="sm" />
                        )}
                      </View>
                      <Text style={estilosLocales.proyectoTexto}>
                        {ret.projectCode} • {ret.projectName}
                      </Text>
                      <Text style={estilosLocales.tecnicoTexto}>
                        👤{" "}
                        <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                          {ret.technicianName}
                        </Text>{" "}
                        ({ret.technicianRut}) • 📅 {formatearFecha(ret.date)}
                      </Text>
                    </View>
                  </View>

                  {/* Detalle compacto de insumos declarados vs recibidos reales */}
                  <View
                    style={{
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: bordeSem,
                      borderRadius: 9,
                      padding: 10,
                      gap: 6,
                    }}
                  >
                    <Text style={estilosLocales.elementosTitulo}>
                      Insumos en Devolución ({ret.items?.length || 0}):
                    </Text>
                    {(ret.items || []).map((it, idx) => {
                      const difiere =
                        it.quantityReceivedReal !== undefined &&
                        it.quantityReceivedReal !== it.quantityReturned;
                      return (
                        <View key={`${it.sku}_${idx}`} style={estilosLocales.elementoFila}>
                          <View style={{ flex: 1, minWidth: 130 }}>
                            <Text style={estilosLocales.elementoNombre}>{it.name}</Text>
                            <Text style={estilosLocales.elementoSku}>SKU: {it.sku}</Text>
                          </View>
                          <View style={estilosLocales.elementoValoresCol}>
                            <Text style={estilosLocales.valorDeclarado}>
                              Declarado:{" "}
                              <Text style={{ fontWeight: "bold" }}>
                                {it.quantityReturned} {it.unit}
                              </Text>
                            </Text>
                            {it.quantityReceivedReal !== undefined && (
                              <Text
                                style={[
                                  estilosLocales.valorReal,
                                  difiere && { color: tema.colors.danger },
                                ]}
                              >
                                Real recibido: {it.quantityReceivedReal} {it.unit}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {Boolean(ret.discrepancyNote) && (
                      <View style={estilosLocales.discrepanciaNotaCaja}>
                        <Ionicons name="warning" size={14} color={tema.colors.warnDark} />
                        <Text style={estilosLocales.discrepanciaNotaTexto}>
                          Nota discrepancia: "{ret.discrepancyNote}"
                        </Text>
                      </View>
                    )}
                  </View>

                  {esTransit ? (
                    <Boton
                      title="Confirmar Cantidad Real Recibida"
                      variant="primary"
                      size="sm"
                      icon="checkmark-circle-outline"
                      onPress={() => manejarAbrirConfirmarDevolucion(ret)}
                      style={{ minHeight: 40 }}
                    />
                  ) : (
                    <View style={[estilosLocales.recibidaBanner, { backgroundColor: "#ffffff" }]}>
                      <Ionicons name="checkmark-done" size={16} color={tema.colors.ok} />
                      <Text style={estilosLocales.recibidaTexto}>
                        Recibida por {ret.receivedBy || "Bodega Central"}
                        {ret.receivedAt ? ` el ${formatearFecha(ret.receivedAt)}` : ""} • Reflejado
                        en móvil del técnico
                      </Text>
                    </View>
                  )}
                </Tarjeta>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const estilosLocales = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenidoScroll: {
    padding: tema.spacing.md,
    paddingBottom: 44,
  },
  contenedorCentrado: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: 14,
  },
  avisoExitoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  avisoExitoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
    lineHeight: 17,
  },
  bannerCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: tema.radius.md,
    padding: 14,
  },
  bannerIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 230,
  },
  bannerIcono: {
    width: 38,
    height: 38,
    borderRadius: tema.radius.full,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  bannerSubtitulo: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCaja: {
    flex: 1,
    minWidth: 140,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  kpiCajaMovil: {
    minWidth: "46%",
  },
  kpiLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  kpiVal: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  filtrosCaja: {
    gap: 10,
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
  },
  filtroChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  filtroChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  tarjetasGrilla: {
    gap: 12,
  },
  tarjetasGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  devolucionTarjeta: {
    padding: 14,
    gap: 12,
  },
  devolucionTarjetaAncha: {
    width: "48.8%",
  },
  devolucionTarjetaTransito: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.warn,
  },
  tarjetaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  codigoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  proyectoTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tecnicoTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  elementosCaja: {
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.sm,
    padding: 10,
    gap: 8,
  },
  elementosTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textSecondary,
    textTransform: "uppercase",
  },
  elementoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  elementoNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  elementoSku: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  elementoValoresCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  valorDeclarado: {
    fontSize: 11,
    color: tema.colors.textSecondary,
  },
  valorReal: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  discrepanciaNotaCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.warnLight,
    borderRadius: tema.radius.sm,
    padding: 8,
    marginTop: 2,
  },
  discrepanciaNotaTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
  },
  recibidaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.okLight,
    borderRadius: tema.radius.sm,
    padding: 10,
  },
  recibidaTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.okDark,
    fontWeight: "600",
    lineHeight: 16,
  },
});
