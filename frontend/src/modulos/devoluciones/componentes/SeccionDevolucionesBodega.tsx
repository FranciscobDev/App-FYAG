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

        {/* 1. ENCABEZADO DE BANDEJA DE DEVOLUCIONES EN TRÁNSITO */}
        <View style={estilosLocales.bannerCabecera}>
          <View style={estilosLocales.bannerIzquierda}>
            <View style={estilosLocales.bannerIcono}>
              <Ionicons name="car-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={estilosLocales.bannerTitulo}>
                Bandeja de Devoluciones en Tránsito (Bodega)
              </Text>
              <Text style={estilosLocales.bannerSubtitulo}>
                Verifica físicamente la cantidad real recibida de cada sobrante de obra. Al
                confirmar, cambia a Recibida, reingresa al stock/Cardex y se refleja en el móvil
                del técnico.
              </Text>
            </View>
          </View>

          <Insignia
            label={
              inTransitConteo > 0
                ? `${inTransitConteo} pendiente${inTransitConteo === 1 ? "" : "s"}`
                : "Bandeja al día"
            }
            tone={inTransitConteo > 0 ? "warn" : "ok"}
            size="md"
          />
        </View>

        {/* 2. DASHBOARD DE 4 KPIs RESPONSIVOS */}
        <View style={estilosLocales.kpiGrilla}>
          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              metricas.enTransitoConteo > 0 && {
                backgroundColor: tema.colors.warnLight,
                borderColor: tema.colors.warnBorder,
              },
            ]}
          >
            <Text
              style={[
                estilosLocales.kpiLbl,
                metricas.enTransitoConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              En Tránsito
            </Text>
            <Text
              style={[
                estilosLocales.kpiVal,
                metricas.enTransitoConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              {metricas.enTransitoConteo}
            </Text>
            <Text
              style={[
                estilosLocales.kpiSub,
                metricas.enTransitoConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              Esperando conteo físico
            </Text>
          </View>

          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              { backgroundColor: tema.colors.primaryLight, borderColor: "#fde68a" },
            ]}
          >
            <Text style={[estilosLocales.kpiLbl, { color: tema.colors.primaryDark }]}>
              Por Reingresar
            </Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.primaryDark }]}>
              {metricas.totalUnidadesPorReingresar}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.primaryDark }]}>
              Unidades declaradas
            </Text>
          </View>

          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text style={[estilosLocales.kpiLbl, { color: tema.colors.okDark }]}>Recibidas</Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.okDark }]}>
              {metricas.recibidasConteo}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.okDark }]}>
              Reingresadas a stock
            </Text>
          </View>

          <View style={[estilosLocales.kpiCaja, esMovilEstrecho && estilosLocales.kpiCajaMovil]}>
            <Text style={estilosLocales.kpiLbl}>Discrepancias</Text>
            <Text
              style={[
                estilosLocales.kpiVal,
                metricas.conDiscrepanciaConteo > 0 && { color: tema.colors.danger },
              ]}
            >
              {metricas.conDiscrepanciaConteo}
            </Text>
            <Text style={estilosLocales.kpiSub}>Con alerta a Admin</Text>
          </View>
        </View>

        {/* 3. BUSCADOR Y CHIPS DE FILTRO DINÁMICO */}
        <View style={estilosLocales.filtrosCaja}>
          <CampoBusqueda
            value={transitBuscar}
            onChangeText={establecerTransitBuscar}
            placeholder="Buscar por código DEV, proyecto, técnico o RUT..."
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(
              [
                {
                  id: "en_transito",
                  label: `En Tránsito (${metricas.enTransitoConteo})`,
                },
                {
                  id: "todas",
                  label: `Todas (${filtradoTransitDevoluciones.length})`,
                },
                {
                  id: "recibida",
                  label: `Recibidas (${metricas.recibidasConteo})`,
                },
                {
                  id: "con_discrepancia",
                  label: `Con Discrepancia (${metricas.conDiscrepanciaConteo})`,
                },
              ] as const
            ).map((chip) => {
              const activo = filtroEstado === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  onPress={() => establecerFiltroEstado(chip.id)}
                  style={[estilosLocales.filtroChip, activo && estilosLocales.filtroChipActivo]}
                >
                  <Text
                    style={[
                      estilosLocales.filtroChipTexto,
                      activo && estilosLocales.filtroChipTextoActivo,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. LISTADO RESPONSIVO DE DEVOLUCIONES (1 COL MÓVIL / 2 COLS PANTALLA ANCHA) */}
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

              return (
                <Tarjeta
                  key={ret.id}
                  variant={esTransit ? "elevated" : "default"}
                  style={[
                    estilosLocales.devolucionTarjeta,
                    esPantallaAncha && estilosLocales.devolucionTarjetaAncha,
                    esTransit && estilosLocales.devolucionTarjetaTransito,
                  ]}
                >
                  <View style={estilosLocales.tarjetaSuperior}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <View style={estilosLocales.codigoFila}>
                        <Text style={estilosLocales.codigoTexto}>{ret.code}</Text>
                        <InsigniaEstado status={ret.status} size="sm" />
                        {conDiferencia && (
                          <Insignia label="Discrepancia" tone="danger" size="sm" />
                        )}
                      </View>
                      <Text style={estilosLocales.proyectoTexto}>
                        {ret.projectCode} • {ret.projectName}
                      </Text>
                      <Text style={estilosLocales.tecnicoTexto}>
                        Técnico:{" "}
                        <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                          {ret.technicianName}
                        </Text>{" "}
                        ({ret.technicianRut}) • {formatearFecha(ret.date)}
                      </Text>
                    </View>
                  </View>

                  {/* Detalle de insumos declarados vs recibidos reales */}
                  <View style={estilosLocales.elementosCaja}>
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
                      size="md"
                      icon="checkmark-circle-outline"
                      onPress={() => manejarAbrirConfirmarDevolucion(ret)}
                      style={{ minHeight: 46 }}
                    />
                  ) : (
                    <View style={estilosLocales.recibidaBanner}>
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
    backgroundColor: "#1c1917",
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
