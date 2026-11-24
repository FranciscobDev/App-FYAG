// Vista de Control Presupuestario en Vivo (H27) para el Administrador:
// indicador de semáforo (verde, amarillo, rojo), barra de consumo, desglose de materiales y mano de obra
// y verificación transparente del margen de ganancia estimado en tiempo real.
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  BarraProgreso,
  Boton,
  CampoBusqueda,
  EstadoVacio,
  Insignia,
  Tarjeta,
  VistaModal,
} from "@/componentes/comunes";
import {
  AjusteSimuladoH27,
  calcularControlPresupuestarioH27,
  NivelSemaforoPresupuesto,
  ResumenPresupuestoProyectoH27,
} from "../controlPresupuestarioUtils";

export interface PropiedadesSeccionControlPresupuestarioAdmin {
  mostrarAviso?: (mensaje: string) => void;
}

type FiltroSemaforo = "todos" | NivelSemaforoPresupuesto;

const COLORES_SEMAFORO: Record<
  NivelSemaforoPresupuesto,
  { principal: string; fondo: string; borde: string; texto: string }
> = {
  verde: {
    principal: "#16a34a",
    fondo: "#dcfce7",
    borde: "#86efac",
    texto: "#15803d",
  },
  amarillo: {
    principal: "#d97706",
    fondo: "#fef3c7",
    borde: "#fcd34d",
    texto: "#b45309",
  },
  rojo: {
    principal: "#dc2626",
    fondo: "#fee2e2",
    borde: "#fca5a5",
    texto: "#b91c1c",
  },
};

/**
 * Indicador visual de semáforo de 3 luces (verde, amarillo, rojo) con etiqueta accesible.
 */
const IndicadorSemaforoLuces: React.FC<{
  nivel: NivelSemaforoPresupuesto;
  porcentaje: number;
  compacto?: boolean;
}> = ({ nivel, porcentaje, compacto = false }) => {
  const palette = COLORES_SEMAFORO[nivel];
  return (
    <View
      style={[
        estilos.semaforoPastilla,
        {
          backgroundColor: palette.fondo,
          borderColor: palette.borde,
          paddingHorizontal: compacto ? 8 : 10,
          paddingVertical: compacto ? 4 : 6,
        },
      ]}
    >
      <View style={estilos.semaforoLucesGrupo}>
        <View
          style={[
            estilos.semaforoLuz,
            {
              backgroundColor: nivel === "verde" ? "#16a34a" : "#cbd5e1",
              opacity: nivel === "verde" ? 1 : 0.45,
            },
          ]}
        />
        <View
          style={[
            estilos.semaforoLuz,
            {
              backgroundColor: nivel === "amarillo" ? "#f59e0b" : "#cbd5e1",
              opacity: nivel === "amarillo" ? 1 : 0.45,
            },
          ]}
        />
        <View
          style={[
            estilos.semaforoLuz,
            {
              backgroundColor: nivel === "rojo" ? "#dc2626" : "#cbd5e1",
              opacity: nivel === "rojo" ? 1 : 0.45,
            },
          ]}
        />
      </View>
      <Text style={[estilos.semaforoPorcentaje, { color: palette.texto }]}>
        {porcentaje.toFixed(1)}%
      </Text>
    </View>
  );
};

export const SeccionControlPresupuestarioAdmin: React.FC<
  PropiedadesSeccionControlPresupuestarioAdmin
> = ({ mostrarAviso }) => {
  const { proyectos } = usarAplicacion();
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esDosColumnas = width >= 880;

  const [busqueda, establecerBusqueda] = useState("");
  const [filtroSemaforo, establecerFiltroSemaforo] = useState<FiltroSemaforo>("todos");
  const [ajustesSimulados, establecerAjustesSimulados] = useState<
    Record<string, AjusteSimuladoH27>
  >({});
  const [proyectoDetalleId, establecerProyectoDetalleId] = useState<string | null>(null);
  const [inputMaterialExtra, establecerInputMaterialExtra] = useState("");
  const [inputHorasExtra, establecerInputHorasExtra] = useState("");

  // Cálculo H27 en vivo para todos los proyectos de la cartera
  const resumenesProyectos: ResumenPresupuestoProyectoH27[] = useMemo(
    () =>
      proyectos.map((p) =>
        calcularControlPresupuestarioH27(p, ajustesSimulados[p.id])
      ),
    [proyectos, ajustesSimulados]
  );

  // KPIs ejecutivos agregados de la cartera
  const kpisCartera = useMemo(() => {
    const presupuestoTotal = resumenesProyectos.reduce(
      (acc, r) => acc + r.presupuestoTotal,
      0
    );
    const costoRealTotal = resumenesProyectos.reduce(
      (acc, r) => acc + r.costoRealTotal,
      0
    );
    const valorVentaTotal = resumenesProyectos.reduce(
      (acc, r) => acc + r.valorVenta,
      0
    );
    const margenTotal = valorVentaTotal - costoRealTotal;
    const margenPctGlobal =
      valorVentaTotal > 0 ? Number(((margenTotal / valorVentaTotal) * 100).toFixed(1)) : 0;

    const verdes = resumenesProyectos.filter((r) => r.semaforo === "verde").length;
    const amarillos = resumenesProyectos.filter((r) => r.semaforo === "amarillo").length;
    const rojos = resumenesProyectos.filter((r) => r.semaforo === "rojo").length;

    return {
      presupuestoTotal,
      costoRealTotal,
      valorVentaTotal,
      margenTotal,
      margenPctGlobal,
      verdes,
      amarillos,
      rojos,
    };
  }, [resumenesProyectos]);

  // Proyectos filtrados por semáforo y búsqueda
  const proyectosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return resumenesProyectos.filter((r) => {
      if (filtroSemaforo !== "todos" && r.semaforo !== filtroSemaforo) return false;
      if (q) {
        const coincideCodigo = r.proyecto.code.toLowerCase().includes(q);
        const coincideNombre = r.proyecto.name.toLowerCase().includes(q);
        const coincideCliente = r.proyecto.client.toLowerCase().includes(q);
        if (!coincideCodigo && !coincideNombre && !coincideCliente) return false;
      }
      return true;
    });
  }, [resumenesProyectos, filtroSemaforo, busqueda]);

  const resumenDetalle = useMemo(
    () => resumenesProyectos.find((r) => r.proyecto.id === proyectoDetalleId) || null,
    [resumenesProyectos, proyectoDetalleId]
  );

  // Aplicar impacto instantáneo de materiales o mano de obra para verificación en vivo
  const aplicarImpactoEnVivo = (
    projectId: string,
    deltaMaterialesClp: number,
    deltaHorasHh: number
  ) => {
    establecerAjustesSimulados((prev) => {
      const actual = prev[projectId] || { materialesExtraClp: 0, horasExtraHh: 0 };
      return {
        ...prev,
        [projectId]: {
          materialesExtraClp: Math.max(0, actual.materialesExtraClp + deltaMaterialesClp),
          horasExtraHh: Math.max(0, Number((actual.horasExtraHh + deltaHorasHh).toFixed(1))),
        },
      };
    });
  };

  const restablecerSimulacionProyecto = (projectId: string) => {
    establecerAjustesSimulados((prev) => {
      const copia = { ...prev };
      delete copia[projectId];
      return copia;
    });
    establecerInputMaterialExtra("");
    establecerInputHorasExtra("");
    if (mostrarAviso) {
      mostrarAviso("Simulación restablecida a los registros reales de obra.");
    }
  };

  const aplicarInputsPersonalizados = () => {
    if (!resumenDetalle) return;
    const mat = parseFloat(inputMaterialExtra) || 0;
    const hh = parseFloat(inputHorasExtra) || 0;
    if (mat <= 0 && hh <= 0) return;
    aplicarImpactoEnVivo(resumenDetalle.proyecto.id, mat, hh);
    establecerInputMaterialExtra("");
    establecerInputHorasExtra("");
    if (mostrarAviso) {
      mostrarAviso("Impacto financiero aplicado en vivo al semáforo y margen H27.");
    }
  };

  return (
    <View style={estilos.contenedor}>
      {/* 1. TARJETA HERO DE CONTROL PRESUPUESTARIO H27 */}
      <Tarjeta variant="elevated" style={estilos.heroTarjeta}>
        <View style={estilos.heroFila}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <View style={estilos.insigniasFila}>
              <Insignia label="Control Presupuestario H27" tone="primary" size="sm" />
              <Insignia label="Cálculo en Vivo" tone="ok" size="sm" />
            </View>
            <Text style={estilos.heroTitulo}>
              Semáforo de Presupuesto y Margen de Ganancia Estimado
            </Text>
            <Text style={estilos.heroSub}>
              Monitorea en tiempo real el impacto financiero de egresos de materiales (PMP) y
              mano de obra (HH × tasa horaria) sobre cada obra. Verde &lt; 80 % • Amarillo
              80 %-100 % • Rojo &gt; 100 %.
            </Text>
          </View>

          <View style={estilos.leyendaSemaforoCaja}>
            <View style={estilos.leyendaFila}>
              <View style={[estilos.puntoLeyenda, { backgroundColor: "#16a34a" }]} />
              <Text style={estilos.leyendaTexto}>Verde: {kpisCartera.verdes} obra(s)</Text>
            </View>
            <View style={estilos.leyendaFila}>
              <View style={[estilos.puntoLeyenda, { backgroundColor: "#f59e0b" }]} />
              <Text style={estilos.leyendaTexto}>Amarillo: {kpisCartera.amarillos} obra(s)</Text>
            </View>
            <View style={estilos.leyendaFila}>
              <View style={[estilos.puntoLeyenda, { backgroundColor: "#dc2626" }]} />
              <Text style={estilos.leyendaTexto}>Rojo: {kpisCartera.rojos} obra(s)</Text>
            </View>
          </View>
        </View>
      </Tarjeta>

      {/* 2. DASHBOARD DE 4 KPIs FINANCIEROS RESPONSIVOS */}
      <View style={estilos.kpiGrilla}>
        <View style={[estilos.kpiCaja, esMovilEstrecho && estilos.kpiCajaMovil]}>
          <Text style={estilos.kpiEtiqueta}>Presupuesto Cartera</Text>
          <Text style={estilos.kpiValor}>{formatearCLP(kpisCartera.presupuestoTotal)}</Text>
          <Text style={estilos.kpiMeta}>{resumenesProyectos.length} proyectos monitoreados</Text>
        </View>

        <View style={[estilos.kpiCaja, esMovilEstrecho && estilos.kpiCajaMovil]}>
          <Text style={estilos.kpiEtiqueta}>Costo Real Acumulado</Text>
          <Text style={[estilos.kpiValor, { color: tema.colors.primaryDark }]}>
            {formatearCLP(kpisCartera.costoRealTotal)}
          </Text>
          <Text style={estilos.kpiMeta}>Materiales PMP + Mano de Obra</Text>
        </View>

        <View
          style={[
            estilos.kpiCaja,
            esMovilEstrecho && estilos.kpiCajaMovil,
            {
              backgroundColor:
                kpisCartera.margenTotal >= 0 ? tema.colors.okLight : tema.colors.dangerLight,
              borderColor:
                kpisCartera.margenTotal >= 0 ? tema.colors.ok : tema.colors.danger,
            },
          ]}
        >
          <Text style={estilos.kpiEtiqueta}>Margen Estimado (H27)</Text>
          <Text
            style={[
              estilos.kpiValor,
              {
                color:
                  kpisCartera.margenTotal >= 0 ? tema.colors.okDark : tema.colors.danger,
              },
            ]}
          >
            {formatearCLP(kpisCartera.margenTotal)}
          </Text>
          <Text
            style={[
              estilos.kpiMeta,
              {
                fontWeight: "700",
                color:
                  kpisCartera.margenTotal >= 0 ? tema.colors.okDark : tema.colors.danger,
              },
            ]}
          >
            Margen neto global: {kpisCartera.margenPctGlobal.toFixed(1)}%
          </Text>
        </View>

        <View
          style={[
            estilos.kpiCaja,
            esMovilEstrecho && estilos.kpiCajaMovil,
            kpisCartera.rojos > 0 && {
              backgroundColor: tema.colors.dangerLight,
              borderColor: tema.colors.danger,
            },
          ]}
        >
          <Text style={estilos.kpiEtiqueta}>Obras en Sobrecosto</Text>
          <Text
            style={[
              estilos.kpiValor,
              { color: kpisCartera.rojos > 0 ? tema.colors.danger : tema.colors.okDark },
            ]}
          >
            {kpisCartera.rojos}
          </Text>
          <Text style={estilos.kpiMeta}>
            {kpisCartera.amarillos} en alerta preventiva (80-100%)
          </Text>
        </View>
      </View>

      {/* 3. BÚSQUEDA Y FILTROS DE SEMÁFORO */}
      <View style={estilos.barraFiltros}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <CampoBusqueda
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar proyecto por código, nombre o cliente..."
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.chipsFila}
        >
          {(
            [
              { id: "todos", label: `Todos (${resumenesProyectos.length})` },
              { id: "verde", label: `Verde (${kpisCartera.verdes})` },
              { id: "amarillo", label: `Amarillo (${kpisCartera.amarillos})` },
              { id: "rojo", label: `Rojo (${kpisCartera.rojos})` },
            ] as { id: FiltroSemaforo; label: string }[]
          ).map((chip) => {
            const activo = filtroSemaforo === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => establecerFiltroSemaforo(chip.id)}
                style={[estilos.filtroChip, activo && estilos.filtroChipActivo]}
                activeOpacity={0.8}
              >
                <Text style={[estilos.filtroChipTexto, activo && estilos.filtroChipTextoActivo]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. GRILLA RESPONSIVA DE PROYECTOS CON SEMÁFORO, BARRA DE CONSUMO Y MARGEN H27 */}
      {proyectosFiltrados.length === 0 ? (
        <EstadoVacio
          icon="analytics-outline"
          title="Sin proyectos para este filtro"
          description="Ajusta el filtro de semáforo o la búsqueda para revisar el control presupuestario."
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        <View style={[estilos.grillaTarjetas, esDosColumnas && estilos.grillaDosColumnas]}>
          {proyectosFiltrados.map((r) => {
            const palette = COLORES_SEMAFORO[r.semaforo];
            const tieneSimulacion = Boolean(
              ajustesSimulados[r.proyecto.id] &&
                (ajustesSimulados[r.proyecto.id].materialesExtraClp > 0 ||
                  ajustesSimulados[r.proyecto.id].horasExtraHh > 0)
            );

            return (
              <View
                key={r.proyecto.id}
                style={[
                  estilos.tarjetaEnvoltorio,
                  esDosColumnas && estilos.tarjetaEnvoltorioDosCol,
                ]}
              >
                <Tarjeta
                  variant="elevated"
                  style={[
                    estilos.proyectoTarjeta,
                    { borderLeftWidth: 4, borderLeftColor: palette.principal },
                  ]}
                >
                  {/* Encabezado de tarjeta + Semáforo 3 luces */}
                  <View style={estilos.tarjetaTop}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={estilos.codigoFila}>
                        <Text style={estilos.proyectoCodigo}>{r.proyecto.code}</Text>
                        <Insignia
                          label={r.etiquetaSemaforo}
                          tone={
                            r.semaforo === "verde"
                              ? "ok"
                              : r.semaforo === "amarillo"
                                ? "warn"
                                : "danger"
                          }
                          size="sm"
                        />
                        {tieneSimulacion && (
                          <Insignia label="Simulado en vivo" tone="info" size="sm" />
                        )}
                      </View>
                      <Text style={estilos.proyectoNombre}>{r.proyecto.name}</Text>
                      <Text style={estilos.proyectoCliente}>Cliente: {r.proyecto.client}</Text>
                    </View>

                    <IndicadorSemaforoLuces
                      nivel={r.semaforo}
                      porcentaje={r.porcentajeConsumo}
                    />
                  </View>

                  {/* Barra de Consumo Presupuestario */}
                  <View style={estilos.barraBloque}>
                    <View style={estilos.barraHeader}>
                      <Text style={estilos.barraEtiqueta}>
                        Consumo de Presupuesto ({formatearCLP(r.costoRealTotal)} /{" "}
                        {formatearCLP(r.presupuestoTotal)})
                      </Text>
                      <Text style={[estilos.barraPct, { color: palette.texto }]}>
                        {r.porcentajeConsumo.toFixed(1)}%
                      </Text>
                    </View>
                    <BarraProgreso
                      value={Math.min(r.costoRealTotal, Math.max(1, r.presupuestoTotal))}
                      max={Math.max(1, r.presupuestoTotal)}
                      height={9}
                      color={palette.principal}
                    />
                    <Text style={estilos.saldoTexto}>
                      {r.saldoPresupuesto >= 0
                        ? `Saldo disponible en presupuesto: ${formatearCLP(r.saldoPresupuesto)}`
                        : `Exceso sobre presupuesto: ${formatearCLP(Math.abs(r.saldoPresupuesto))}`}
                    </Text>
                  </View>

                  {/* Desglose Financiero en Vivo (Materiales + Mano de Obra + Margen H27) */}
                  <View style={estilos.metricasGrid}>
                    <View style={estilos.metricaCelda}>
                      <Text style={estilos.metricaLbl}>Materiales (PMP)</Text>
                      <Text style={estilos.metricaVal}>
                        {formatearCLP(r.costoMaterialesReal)}
                      </Text>
                      <Text style={estilos.metricaSub}>
                        {r.cantidadDespachos} egreso(s) a obra
                      </Text>
                    </View>

                    <View style={estilos.metricaCelda}>
                      <Text style={estilos.metricaLbl}>Mano de Obra (HH)</Text>
                      <Text style={estilos.metricaVal}>
                        {formatearCLP(r.costoManoObraReal)}
                      </Text>
                      <Text style={estilos.metricaSub}>
                        {r.horasReales} h × {formatearCLP(r.tasaHoraria)}/h
                      </Text>
                    </View>

                    <View style={estilos.metricaCelda}>
                      <Text style={estilos.metricaLbl}>Valor de Venta</Text>
                      <Text style={estilos.metricaVal}>{formatearCLP(r.valorVenta)}</Text>
                      <Text style={estilos.metricaSub}>Ingreso contratado</Text>
                    </View>

                    <View
                      style={[
                        estilos.metricaCelda,
                        {
                          backgroundColor:
                            r.margenEstimadoClp >= 0
                              ? tema.colors.okLight
                              : tema.colors.dangerLight,
                          borderColor:
                            r.margenEstimadoClp >= 0
                              ? tema.colors.ok
                              : tema.colors.danger,
                        },
                      ]}
                    >
                      <Text style={estilos.metricaLbl}>Margen Estimado H27</Text>
                      <Text
                        style={[
                          estilos.metricaVal,
                          {
                            color:
                              r.margenEstimadoClp >= 0
                                ? tema.colors.okDark
                                : tema.colors.danger,
                          },
                        ]}
                      >
                        {formatearCLP(r.margenEstimadoClp)}
                      </Text>
                      <Text
                        style={[
                          estilos.metricaSub,
                          {
                            fontWeight: "700",
                            color:
                              r.margenEstimadoClp >= 0
                                ? tema.colors.okDark
                                : tema.colors.danger,
                          },
                        ]}
                      >
                        Rentabilidad: {r.margenEstimadoPct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {/* Acciones de Auditoría H27 e Impacto en Vivo */}
                  <View style={estilos.accionesFila}>
                    <Boton
                      title="Ver Fórmula H27 e Impacto en Vivo"
                      variant="primary"
                      size="sm"
                      icon="calculator-outline"
                      onPress={() => {
                        establecerProyectoDetalleId(r.proyecto.id);
                        establecerInputMaterialExtra("");
                        establecerInputHorasExtra("");
                      }}
                      style={{ flex: 1, minHeight: 40 }}
                    />
                    {tieneSimulacion && (
                      <Boton
                        title="Restablecer"
                        variant="outline"
                        size="sm"
                        icon="refresh-outline"
                        onPress={() => restablecerSimulacionProyecto(r.proyecto.id)}
                        style={{ minHeight: 40 }}
                      />
                    )}
                  </View>
                </Tarjeta>
              </View>
            );
          })}
        </View>
      )}

      {/* 5. MODAL DE AUDITORÍA FÓRMULA H27 Y SIMULADOR DE IMPACTO EN VIVO */}
      <VistaModal
        visible={Boolean(resumenDetalle)}
        onClose={() => establecerProyectoDetalleId(null)}
        title={
          resumenDetalle
            ? `Control Presupuestario H27 — ${resumenDetalle.proyecto.code}`
            : "Control Presupuestario H27"
        }
        subtitle={resumenDetalle ? resumenDetalle.proyecto.name : ""}
      >
        {resumenDetalle && (() => {
          const palette = COLORES_SEMAFORO[resumenDetalle.semaforo];
          return (
            <View style={{ gap: 14 }}>
              {/* Semáforo activo + Barra de consumo */}
              <View
                style={[
                  estilos.modalSemaforoCaja,
                  { backgroundColor: palette.fondo, borderColor: palette.borde },
                ]}
              >
                <View style={estilos.modalSemaforoTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[estilos.modalSemaforoTitulo, { color: palette.texto }]}>
                      Semáforo: {resumenDetalle.etiquetaSemaforo}
                    </Text>
                    <Text style={estilos.modalSemaforoSub}>
                      {resumenDetalle.descripcionSemaforo}
                    </Text>
                  </View>
                  <IndicadorSemaforoLuces
                    nivel={resumenDetalle.semaforo}
                    porcentaje={resumenDetalle.porcentajeConsumo}
                  />
                </View>

                <BarraProgreso
                  value={Math.min(
                    resumenDetalle.costoRealTotal,
                    Math.max(1, resumenDetalle.presupuestoTotal)
                  )}
                  max={Math.max(1, resumenDetalle.presupuestoTotal)}
                  height={10}
                  color={palette.principal}
                />
              </View>

              {/* Verificación manual de la Fórmula H27 [SCRUM] */}
              <View style={estilos.formulaCaja}>
                <View style={estilos.formulaEncabezado}>
                  <Ionicons name="calculator" size={16} color={tema.colors.primaryDark} />
                  <Text style={estilos.formulaTitulo}>
                    Desglose Auditable — Fórmula de Margen H27
                  </Text>
                </View>

                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLbl}>1. Valor de Venta del Proyecto</Text>
                  <Text style={estilos.formulaVal}>
                    {formatearCLP(resumenDetalle.valorVenta)}
                  </Text>
                </View>
                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLbl}>
                    2. Costo Real Materiales (PMP • {resumenDetalle.cantidadDespachos} desp.)
                  </Text>
                  <Text style={estilos.formulaVal}>
                    - {formatearCLP(resumenDetalle.costoMaterialesReal)}
                  </Text>
                </View>
                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLbl}>
                    3. Costo Real Mano de Obra ({resumenDetalle.horasReales} h ×{" "}
                    {formatearCLP(resumenDetalle.tasaHoraria)}/h)
                  </Text>
                  <Text style={estilos.formulaVal}>
                    - {formatearCLP(resumenDetalle.costoManoObraReal)}
                  </Text>
                </View>
                {resumenDetalle.costoOtrosBase > 0 && (
                  <View style={estilos.formulaFila}>
                    <Text style={estilos.formulaLbl}>4. Costos Base Acumulados Previos</Text>
                    <Text style={estilos.formulaVal}>
                      - {formatearCLP(resumenDetalle.costoOtrosBase)}
                    </Text>
                  </View>
                )}

                <View style={estilos.formulaDivisor} />

                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLblNegrita}>Costo Real Total Acumulado</Text>
                  <Text style={estilos.formulaValNegrita}>
                    {formatearCLP(resumenDetalle.costoRealTotal)}
                  </Text>
                </View>
                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLblNegrita}>
                    Consumo = Costo Real ÷ Presupuesto ({formatearCLP(resumenDetalle.presupuestoTotal)})
                  </Text>
                  <Text style={[estilos.formulaValNegrita, { color: palette.texto }]}>
                    {resumenDetalle.porcentajeConsumo.toFixed(1)}%
                  </Text>
                </View>
                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLblNegrita}>
                    Margen Estimado ($) = Venta − Costo Real
                  </Text>
                  <Text
                    style={[
                      estilos.formulaValNegrita,
                      {
                        color:
                          resumenDetalle.margenEstimadoClp >= 0
                            ? tema.colors.okDark
                            : tema.colors.danger,
                      },
                    ]}
                  >
                    {formatearCLP(resumenDetalle.margenEstimadoClp)}
                  </Text>
                </View>
                <View style={estilos.formulaFila}>
                  <Text style={estilos.formulaLblNegrita}>
                    Margen Estimado (%) = (Margen ÷ Venta) × 100
                  </Text>
                  <Text
                    style={[
                      estilos.formulaValNegrita,
                      {
                        color:
                          resumenDetalle.margenEstimadoPct >= 0
                            ? tema.colors.okDark
                            : tema.colors.danger,
                      },
                    ]}
                  >
                    {resumenDetalle.margenEstimadoPct.toFixed(1)}%
                  </Text>
                </View>
              </View>

              {/* Simulador de Impacto en Vivo (Materiales + Mano de Obra) */}
              <View style={estilos.simuladorCaja}>
                <Text style={estilos.simuladorTitulo}>
                  Probar Impacto Financiero en Vivo (Materiales y Mano de Obra)
                </Text>
                <Text style={estilos.simuladorSub}>
                  Suma un egreso de materiales o nuevas horas hombre para ver cómo cambia al
                  instante el semáforo, la barra de consumo y el margen H27:
                </Text>

                <View style={estilos.simBotonesRapidos}>
                  <Boton
                    title="+ $500.000 Materiales"
                    variant="outline"
                    size="sm"
                    icon="cube-outline"
                    onPress={() =>
                      aplicarImpactoEnVivo(resumenDetalle.proyecto.id, 500000, 0)
                    }
                    style={{ flexGrow: 1, minHeight: 38 }}
                  />
                  <Boton
                    title="+ $2.000.000 Materiales"
                    variant="outline"
                    size="sm"
                    icon="layers-outline"
                    onPress={() =>
                      aplicarImpactoEnVivo(resumenDetalle.proyecto.id, 2000000, 0)
                    }
                    style={{ flexGrow: 1, minHeight: 38 }}
                  />
                  <Boton
                    title="+ 8 h Mano de Obra"
                    variant="outline"
                    size="sm"
                    icon="time-outline"
                    onPress={() => aplicarImpactoEnVivo(resumenDetalle.proyecto.id, 0, 8)}
                    style={{ flexGrow: 1, minHeight: 38 }}
                  />
                </View>

                <View style={[estilos.simInputsFila, esMovilEstrecho && { flexDirection: "column" }]}>
                  <TextInput
                    value={inputMaterialExtra}
                    onChangeText={establecerInputMaterialExtra}
                    placeholder="Materiales extra ($ CLP)"
                    placeholderTextColor={tema.colors.textLight}
                    keyboardType="numeric"
                    style={estilos.simInput}
                  />
                  <TextInput
                    value={inputHorasExtra}
                    onChangeText={establecerInputHorasExtra}
                    placeholder="Horas extra (HH)"
                    placeholderTextColor={tema.colors.textLight}
                    keyboardType="decimal-pad"
                    style={estilos.simInput}
                  />
                  <Boton
                    title="Aplicar"
                    variant="primary"
                    size="sm"
                    onPress={aplicarInputsPersonalizados}
                    style={{ minHeight: 40, minWidth: 92 }}
                  />
                </View>

                <View style={estilos.modalPieAcciones}>
                  <Boton
                    title="Restablecer Valores Reales"
                    variant="ghost"
                    size="sm"
                    icon="refresh-outline"
                    onPress={() => restablecerSimulacionProyecto(resumenDetalle.proyecto.id)}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                  <Boton
                    title="Cerrar"
                    variant="secondary"
                    size="sm"
                    onPress={() => establecerProyectoDetalleId(null)}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                </View>
              </View>
            </View>
          );
        })()}
      </VistaModal>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    gap: 14,
  },
  heroTarjeta: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  heroFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  insigniasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  heroTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: tema.colors.text,
  },
  heroSub: {
    fontSize: 12.5,
    color: tema.colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  leyendaSemaforoCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    minWidth: 170,
  },
  leyendaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  puntoLeyenda: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  leyendaTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCaja: {
    flex: 1,
    minWidth: 180,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 12,
  },
  kpiCajaMovil: {
    minWidth: "46%",
  },
  kpiEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kpiValor: {
    fontSize: 18,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiMeta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  barraFiltros: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  chipsFila: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filtroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  filtroChipActivo: {
    backgroundColor: tema.colors.text,
    borderColor: tema.colors.text,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  filtroChipTextoActivo: {
    color: "#ffffff",
  },
  grillaTarjetas: {
    gap: 12,
  },
  grillaDosColumnas: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  tarjetaEnvoltorio: {
    width: "100%",
  },
  tarjetaEnvoltorioDosCol: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  proyectoTarjeta: {
    gap: 12,
  },
  tarjetaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  codigoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  proyectoCodigo: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.primaryDark,
  },
  proyectoNombre: {
    fontSize: 15,
    fontWeight: "800",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  semaforoPastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tema.radius.full,
    borderWidth: 1,
  },
  semaforoLucesGrupo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  semaforoLuz: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  semaforoPorcentaje: {
    fontSize: 12,
    fontWeight: "800",
  },
  barraBloque: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: tema.colors.borderLight,
    gap: 6,
  },
  barraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  barraEtiqueta: {
    fontSize: 11.5,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  barraPct: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  saldoTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  metricasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricaCelda: {
    flex: 1,
    minWidth: 130,
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.borderLight,
    padding: 9,
  },
  metricaLbl: {
    fontSize: 10.5,
    fontWeight: "700",
    color: tema.colors.textMuted,
  },
  metricaVal: {
    fontSize: 14,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 2,
  },
  metricaSub: {
    fontSize: 10.5,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  accionesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalSemaforoCaja: {
    borderWidth: 1,
    borderRadius: tema.radius.md,
    padding: 12,
    gap: 10,
  },
  modalSemaforoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  modalSemaforoTitulo: {
    fontSize: 14,
    fontWeight: "800",
  },
  modalSemaforoSub: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  formulaCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 12,
    gap: 7,
  },
  formulaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  formulaTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  formulaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  formulaLbl: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    flex: 1,
  },
  formulaVal: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
  },
  formulaDivisor: {
    height: 1,
    backgroundColor: tema.colors.border,
    marginVertical: 4,
  },
  formulaLblNegrita: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.text,
    flex: 1,
  },
  formulaValNegrita: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  simuladorCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    padding: 12,
    gap: 10,
  },
  simuladorTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.primaryDark,
  },
  simuladorSub: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    lineHeight: 16,
  },
  simBotonesRapidos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  simInputsFila: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  simInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: tema.colors.text,
    backgroundColor: tema.colors.surfaceAlt,
  },
  modalPieAcciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
});
