// Dashboard de Rentabilidad Final (H34) para el Administrador:
// gráfico de barras SVG (planificado vs. real por categoría: materiales, horas, mermas),
// gráfico de torta SVG (composición del costo real) y tarjetas de desviación ($ y %).
// Se habilita automáticamente al cerrar un proyecto en H34.
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton, EstadoVacio, Insignia, Tarjeta } from "@/componentes/comunes";
import { Proyecto } from "@/nucleo/tipos";

interface MetricasRentabilidadFinal {
  planMateriales: number;
  realMateriales: number;
  desvMaterialesClp: number;
  desvMaterialesPct: number;
  planHoras: number;
  realHoras: number;
  desvHorasClp: number;
  desvHorasPct: number;
  planMermas: number;
  realMermas: number;
  desvMermasPctSobreReal: number;
  presupuestoTotal: number;
  costoRealTotal: number;
  desvTotalClp: number;
  desvTotalPct: number;
  valorVenta: number;
  utilidadNeta: number;
  margenNetoPct: number;
}

/**
 * Calcula métricas consolidadas de rentabilidad final y desviaciones ($ y %) de un proyecto cerrado.
 */
export function calcularMetricasRentabilidadFinal(
  proyecto: Proyecto
): MetricasRentabilidadFinal {
  const tasaHoraria = Number(proyecto.hourlyRate || 18500);
  const planMateriales = Number(proyecto.budgetMaterials || 0);
  const planHoras = Math.round(Number(proyecto.budgetHours || 0) * tasaHoraria);
  const planMermas = 0;

  const despachosSuma = (proyecto.dispatches || []).reduce(
    (acc, d) => acc + Number(d.totalCost ?? Number(d.quantity || 0) * Number(d.unitCost || 0)),
    0
  );
  const realMateriales =
    Number(proyecto.costRealMaterials || 0) > 0
      ? Number(proyecto.costRealMaterials)
      : despachosSuma;

  const horasSuma = (proyecto.laborEntries || []).reduce(
    (acc, h) => acc + Number(h.totalCost ?? Number(h.hours || 0) * Number(h.hourlyCost || tasaHoraria)),
    0
  );
  const realHoras =
    Number(proyecto.costRealHours || 0) > 0 ? Number(proyecto.costRealHours) : horasSuma;

  const mermasSuma = (proyecto.wasteEntries || []).reduce(
    (acc, w) => acc + Number(w.cost || 0),
    0
  );
  const realMermas =
    Number(proyecto.costRealWaste || 0) > 0 ? Number(proyecto.costRealWaste) : mermasSuma;

  const sumaRealCategorias = realMateriales + realHoras + realMermas;
  const costoRealTotal =
    Number(proyecto.costReal || 0) > sumaRealCategorias
      ? Number(proyecto.costReal)
      : sumaRealCategorias;

  const presupuestoTotal =
    Number(proyecto.budget || 0) > 0 ? Number(proyecto.budget) : planMateriales + planHoras;

  const desvMaterialesClp = realMateriales - planMateriales;
  const desvMaterialesPct =
    planMateriales > 0 ? Number(((desvMaterialesClp / planMateriales) * 100).toFixed(1)) : 0;

  const desvHorasClp = realHoras - planHoras;
  const desvHorasPct =
    planHoras > 0 ? Number(((desvHorasClp / planHoras) * 100).toFixed(1)) : 0;

  const desvMermasPctSobreReal =
    costoRealTotal > 0 ? Number(((realMermas / costoRealTotal) * 100).toFixed(1)) : 0;

  const desvTotalClp = costoRealTotal - presupuestoTotal;
  const desvTotalPct =
    presupuestoTotal > 0 ? Number(((desvTotalClp / presupuestoTotal) * 100).toFixed(1)) : 0;

  const valorVenta = Number(proyecto.saleValue || 0);
  const utilidadNeta = valorVenta - costoRealTotal;
  const margenNetoPct =
    valorVenta > 0 ? Number(((utilidadNeta / valorVenta) * 100).toFixed(1)) : 0;

  return {
    planMateriales,
    realMateriales,
    desvMaterialesClp,
    desvMaterialesPct,
    planHoras,
    realHoras,
    desvHorasClp,
    desvHorasPct,
    planMermas,
    realMermas,
    desvMermasPctSobreReal,
    presupuestoTotal,
    costoRealTotal,
    desvTotalClp,
    desvTotalPct,
    valorVenta,
    utilidadNeta,
    margenNetoPct,
  };
}

const formatearMontoCorto = (valor: number): string => {
  const abs = Math.abs(valor);
  if (abs >= 1000000) return `$${(valor / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `$${Math.round(valor / 1000)}k`;
  return `$${valor}`;
};

/**
 * Gráfico de barras vectorial SVG: Planificado vs. Real por categoría (Materiales, Horas, Mermas).
 */
const GraficoBarrasPlanificadoVsRealSvg: React.FC<{
  metricas: MetricasRentabilidadFinal;
  anchoContenedor: number;
}> = ({ metricas, anchoContenedor }) => {
  const anchoSvg = Math.max(280, Math.min(520, anchoContenedor));
  const altoSvg = 230;
  const padIzq = 48;
  const padDer = 18;
  const padSup = 26;
  const padInf = 42;
  const altoGrafico = altoSvg - padSup - padInf;
  const anchoGrafico = anchoSvg - padIzq - padDer;

  const categorias = [
    {
      nombre: "Materiales",
      plan: metricas.planMateriales,
      real: metricas.realMateriales,
      colorReal: metricas.realMateriales > metricas.planMateriales ? "#dc2626" : "#2563eb",
    },
    {
      nombre: "Horas HH",
      plan: metricas.planHoras,
      real: metricas.realHoras,
      colorReal: metricas.realHoras > metricas.planHoras ? "#dc2626" : "#7c3aed",
    },
    {
      nombre: "Mermas",
      plan: metricas.planMermas,
      real: metricas.realMermas,
      colorReal: "#dc2626",
    },
  ];

  const maximo = Math.max(
    1,
    ...categorias.flatMap((c) => [c.plan, c.real])
  );
  const pasosGrilla = [0, 0.25, 0.5, 0.75, 1];
  const anchoGrupo = anchoGrafico / categorias.length;
  const anchoBarra = Math.min(34, Math.max(18, anchoGrupo * 0.28));
  const separacionBarras = 6;

  return (
    <View style={estilos.graficoBloque}>
      <View style={estilos.graficoLeyendaFila}>
        <View style={estilos.leyendaItem}>
          <View style={[estilos.leyendaCuadro, { backgroundColor: "#94a3b8" }]} />
          <Text style={estilos.leyendaTexto}>Planificado</Text>
        </View>
        <View style={estilos.leyendaItem}>
          <View style={[estilos.leyendaCuadro, { backgroundColor: "#2563eb" }]} />
          <Text style={estilos.leyendaTexto}>Real (en meta)</Text>
        </View>
        <View style={estilos.leyendaItem}>
          <View style={[estilos.leyendaCuadro, { backgroundColor: "#dc2626" }]} />
          <Text style={estilos.leyendaTexto}>Real (sobrecosto / merma)</Text>
        </View>
      </View>

      <View style={{ alignItems: "center" }}>
        <Svg width={anchoSvg} height={altoSvg}>
          {/* Líneas horizontales de grilla y escala eje Y */}
          {pasosGrilla.map((p) => {
            const y = padSup + altoGrafico * (1 - p);
            const valorEscala = Math.round(maximo * p);
            return (
              <G key={p}>
                <Line
                  x1={padIzq}
                  y1={y}
                  x2={anchoSvg - padDer}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <SvgText
                  x={padIzq - 6}
                  y={y + 3}
                  fontSize="9"
                  fill="#64748b"
                  textAnchor="end"
                >
                  {formatearMontoCorto(valorEscala)}
                </SvgText>
              </G>
            );
          })}

          {/* Barras agrupadas Planificado vs Real por categoría */}
          {categorias.map((cat, idx) => {
            const centroX = padIzq + anchoGrupo * idx + anchoGrupo / 2;
            const xPlan = centroX - anchoBarra - separacionBarras / 2;
            const xReal = centroX + separacionBarras / 2;

            const hPlan = Math.max(cat.plan > 0 ? 4 : 0, (cat.plan / maximo) * altoGrafico);
            const hReal = Math.max(cat.real > 0 ? 4 : 0, (cat.real / maximo) * altoGrafico);

            const yPlan = padSup + altoGrafico - hPlan;
            const yReal = padSup + altoGrafico - hReal;

            return (
              <G key={cat.nombre}>
                {/* Barra Planificado */}
                <Rect
                  x={xPlan}
                  y={yPlan}
                  width={anchoBarra}
                  height={hPlan}
                  rx={4}
                  fill="#94a3b8"
                />
                {cat.plan > 0 && (
                  <SvgText
                    x={xPlan + anchoBarra / 2}
                    y={Math.max(12, yPlan - 5)}
                    fontSize="8.5"
                    fontWeight="bold"
                    fill="#475569"
                    textAnchor="middle"
                  >
                    {formatearMontoCorto(cat.plan)}
                  </SvgText>
                )}

                {/* Barra Real */}
                <Rect
                  x={xReal}
                  y={yReal}
                  width={anchoBarra}
                  height={hReal}
                  rx={4}
                  fill={cat.colorReal}
                />
                <SvgText
                  x={xReal + anchoBarra / 2}
                  y={Math.max(12, yReal - 5)}
                  fontSize="8.5"
                  fontWeight="bold"
                  fill={cat.colorReal}
                  textAnchor="middle"
                >
                  {formatearMontoCorto(cat.real)}
                </SvgText>

                {/* Etiqueta de categoría */}
                <SvgText
                  x={centroX}
                  y={altoSvg - 16}
                  fontSize="11"
                  fontWeight="bold"
                  fill="#0f172a"
                  textAnchor="middle"
                >
                  {cat.nombre}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
};

/**
 * Gráfico de torta / dona vectorial SVG: Composición del Costo Real (Materiales, Horas, Mermas).
 */
const GraficoTortaComposicionCostoSvg: React.FC<{
  metricas: MetricasRentabilidadFinal;
}> = ({ metricas }) => {
  const totalBase = Math.max(1, metricas.realMateriales + metricas.realHoras + metricas.realMermas);
  const segmentos = [
    {
      nombre: "Materiales (PMP)",
      valor: metricas.realMateriales,
      pct: (metricas.realMateriales / totalBase) * 100,
      color: "#2563eb",
    },
    {
      nombre: "Horas Hombre (HH)",
      valor: metricas.realHoras,
      pct: (metricas.realHoras / totalBase) * 100,
      color: "#7c3aed",
    },
    {
      nombre: "Mermas y Daños",
      valor: metricas.realMermas,
      pct: (metricas.realMermas / totalBase) * 100,
      color: "#dc2626",
    },
  ];

  const tamano = 188;
  const radio = 66;
  const grosor = 28;
  const circunferencia = 2 * Math.PI * radio;
  let acumuladoPct = 0;

  return (
    <View style={estilos.tortaLayout}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`}>
          <Circle
            cx={tamano / 2}
            cy={tamano / 2}
            r={radio}
            stroke="#e2e8f0"
            strokeWidth={grosor}
            fill="none"
          />
          {segmentos.map((seg) => {
            if (seg.pct <= 0) return null;
            const longitud = (seg.pct / 100) * circunferencia;
            const offset = circunferencia - (acumuladoPct / 100) * circunferencia;
            acumuladoPct += seg.pct;

            return (
              <Circle
                key={seg.nombre}
                cx={tamano / 2}
                cy={tamano / 2}
                r={radio}
                stroke={seg.color}
                strokeWidth={grosor}
                strokeDasharray={`${longitud} ${circunferencia - longitud}`}
                strokeDashoffset={offset}
                fill="none"
                rotation={-90}
                origin={`${tamano / 2}, ${tamano / 2}`}
              />
            );
          })}
          <SvgText
            x={tamano / 2}
            y={tamano / 2 - 4}
            fontSize="10"
            fill="#64748b"
            textAnchor="middle"
          >
            Costo Real
          </SvgText>
          <SvgText
            x={tamano / 2}
            y={tamano / 2 + 13}
            fontSize="13"
            fontWeight="bold"
            fill="#0f172a"
            textAnchor="middle"
          >
            {formatearMontoCorto(metricas.costoRealTotal)}
          </SvgText>
        </Svg>
      </View>

      <View style={estilos.tortaLeyendaColumna}>
        {segmentos.map((seg) => (
          <View key={seg.nombre} style={estilos.tortaLeyendaFila}>
            <View style={[estilos.tortaPunto, { backgroundColor: seg.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.tortaNombre}>{seg.nombre}</Text>
              <Text style={estilos.tortaValor}>
                {formatearCLP(seg.valor)} ({seg.pct.toFixed(1)}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

/**
 * Panel reutilizable con Tarjetas de Desviación ($ y %), Gráfico de Barras SVG y Gráfico de Torta SVG.
 */
export const PanelGraficosRentabilidadProyecto: React.FC<{
  proyecto: Proyecto;
}> = ({ proyecto }) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 920;

  const metricas = useMemo(
    () => calcularMetricasRentabilidadFinal(proyecto),
    [proyecto]
  );

  const anchoBarras = esPantallaAncha ? Math.min(460, width * 0.42) : Math.min(480, width - 64);

  return (
    <View style={{ gap: 14 }}>
      {/* Banner de cierre auditado (H34) */}
      <View style={estilos.cierreAuditadoBanner}>
        <Ionicons name="checkmark-done-circle" size={20} color={tema.colors.okDark} />
        <View style={{ flex: 1 }}>
          <Text style={estilos.cierreAuditadoTitulo}>
            Proyecto Cerrado — Dashboard de Rentabilidad Final Habilitado
          </Text>
          <Text style={estilos.cierreAuditadoSub}>
            {proyecto.code} • {proyecto.name}
            {proyecto.closedAt ? ` • Cerrado el ${formatearFecha(proyecto.closedAt)}` : ""}
            {proyecto.closedBy ? ` por ${proyecto.closedBy}` : ""}
          </Text>
        </View>
      </View>

      {/* 1. TARJETAS DE DESVIACIÓN ($ y %) */}
      <View style={estilos.desviacionGrid}>
        {/* Desviación Materiales */}
        <View
          style={[
            estilos.desvTarjeta,
            esMovilEstrecho && estilos.desvTarjetaMovil,
            {
              borderColor:
                metricas.desvMaterialesClp > 0 ? tema.colors.danger : tema.colors.ok,
            },
          ]}
        >
          <Text style={estilos.desvEtiqueta}>Desviación Materiales</Text>
          <Text
            style={[
              estilos.desvValor,
              {
                color:
                  metricas.desvMaterialesClp > 0 ? tema.colors.danger : tema.colors.okDark,
              },
            ]}
          >
            {metricas.desvMaterialesClp > 0 ? "+" : ""}
            {formatearCLP(metricas.desvMaterialesClp)}
          </Text>
          <Text style={estilos.desvSub}>
            {metricas.desvMaterialesPct > 0 ? "+" : ""}
            {metricas.desvMaterialesPct.toFixed(1)}% vs plan ({formatearCLP(metricas.planMateriales)})
          </Text>
        </View>

        {/* Desviación Horas Hombre */}
        <View
          style={[
            estilos.desvTarjeta,
            esMovilEstrecho && estilos.desvTarjetaMovil,
            {
              borderColor:
                metricas.desvHorasClp > 0 ? tema.colors.danger : tema.colors.ok,
            },
          ]}
        >
          <Text style={estilos.desvEtiqueta}>Desviación Horas (HH)</Text>
          <Text
            style={[
              estilos.desvValor,
              {
                color: metricas.desvHorasClp > 0 ? tema.colors.danger : tema.colors.okDark,
              },
            ]}
          >
            {metricas.desvHorasClp > 0 ? "+" : ""}
            {formatearCLP(metricas.desvHorasClp)}
          </Text>
          <Text style={estilos.desvSub}>
            {metricas.desvHorasPct > 0 ? "+" : ""}
            {metricas.desvHorasPct.toFixed(1)}% vs plan ({formatearCLP(metricas.planHoras)})
          </Text>
        </View>

        {/* Impacto Mermas y Daños */}
        <View
          style={[
            estilos.desvTarjeta,
            esMovilEstrecho && estilos.desvTarjetaMovil,
            {
              borderColor: metricas.realMermas > 0 ? tema.colors.danger : tema.colors.ok,
            },
          ]}
        >
          <Text style={estilos.desvEtiqueta}>Desviación por Mermas</Text>
          <Text
            style={[
              estilos.desvValor,
              { color: metricas.realMermas > 0 ? tema.colors.danger : tema.colors.okDark },
            ]}
          >
            {metricas.realMermas > 0 ? "+" : ""}
            {formatearCLP(metricas.realMermas)}
          </Text>
          <Text style={estilos.desvSub}>
            {metricas.desvMermasPctSobreReal.toFixed(1)}% del costo real total
          </Text>
        </View>

        {/* Desviación Presupuestaria Total y Utilidad Neta */}
        <View
          style={[
            estilos.desvTarjeta,
            esMovilEstrecho && estilos.desvTarjetaMovil,
            {
              backgroundColor:
                metricas.utilidadNeta >= 0 ? tema.colors.okLight : tema.colors.dangerLight,
              borderColor:
                metricas.utilidadNeta >= 0 ? tema.colors.ok : tema.colors.danger,
            },
          ]}
        >
          <Text style={estilos.desvEtiqueta}>Utilidad Neta Final</Text>
          <Text
            style={[
              estilos.desvValor,
              {
                color:
                  metricas.utilidadNeta >= 0 ? tema.colors.okDark : tema.colors.danger,
              },
            ]}
          >
            {formatearCLP(metricas.utilidadNeta)}
          </Text>
          <Text
            style={[
              estilos.desvSub,
              {
                fontWeight: "700",
                color:
                  metricas.utilidadNeta >= 0 ? tema.colors.okDark : tema.colors.danger,
              },
            ]}
          >
            Margen: {metricas.margenNetoPct.toFixed(1)}% • Desv. Ppto:{" "}
            {metricas.desvTotalPct > 0 ? "+" : ""}
            {metricas.desvTotalPct.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* 2. GRÁFICOS DE BARRAS Y TORTA LADO A LADO EN DESKTOP / APILADOS EN MÓVIL */}
      <View style={[estilos.graficosGrid, esPantallaAncha && estilos.graficosGridAncho]}>
        <Tarjeta
          variant="elevated"
          style={[estilos.graficoTarjeta, esPantallaAncha && { flex: 1.2 }]}
        >
          <View style={estilos.graficoHeader}>
            <Ionicons name="bar-chart-outline" size={18} color={tema.colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.graficoTitulo}>Planificado vs. Real por Categoría</Text>
              <Text style={estilos.graficoSub}>
                Comparativo financiero de Materiales, Horas Hombre y Mermas ($ CLP)
              </Text>
            </View>
          </View>
          <GraficoBarrasPlanificadoVsRealSvg
            metricas={metricas}
            anchoContenedor={anchoBarras}
          />
        </Tarjeta>

        <Tarjeta
          variant="elevated"
          style={[estilos.graficoTarjeta, esPantallaAncha && { flex: 1 }]}
        >
          <View style={estilos.graficoHeader}>
            <Ionicons name="pie-chart-outline" size={18} color="#7c3aed" />
            <View style={{ flex: 1 }}>
              <Text style={estilos.graficoTitulo}>Composición del Costo Real</Text>
              <Text style={estilos.graficoSub}>
                Distribución porcentual del costo real final auditado
              </Text>
            </View>
          </View>
          <GraficoTortaComposicionCostoSvg metricas={metricas} />
        </Tarjeta>
      </View>

      {/* 3. RESUMEN DE LIQUIDACIÓN FINAL AUDITADA */}
      <Tarjeta variant="outlined" style={estilos.resumenAuditadoTarjeta}>
        <View style={estilos.lineaResumen}>
          <Text style={estilos.lineaLbl}>Valor de Venta Contratado:</Text>
          <Text style={estilos.lineaVal}>{formatearCLP(metricas.valorVenta)}</Text>
        </View>
        <View style={estilos.lineaResumen}>
          <Text style={estilos.lineaLbl}>Presupuesto Total Planificado:</Text>
          <Text style={estilos.lineaVal}>{formatearCLP(metricas.presupuestoTotal)}</Text>
        </View>
        <View style={estilos.lineaResumen}>
          <Text style={estilos.lineaLbl}>Costo Real Final Consolidado:</Text>
          <Text style={estilos.lineaVal}>{formatearCLP(metricas.costoRealTotal)}</Text>
        </View>
        <View style={estilos.lineaResumen}>
          <Text style={estilos.lineaLbl}>Desviación Presupuestaria Total ($ y %):</Text>
          <Text
            style={[
              estilos.lineaVal,
              {
                color:
                  metricas.desvTotalClp > 0 ? tema.colors.danger : tema.colors.okDark,
              },
            ]}
          >
            {metricas.desvTotalClp > 0 ? "+" : ""}
            {formatearCLP(metricas.desvTotalClp)} ({metricas.desvTotalPct > 0 ? "+" : ""}
            {metricas.desvTotalPct.toFixed(1)}%)
          </Text>
        </View>
      </Tarjeta>
    </View>
  );
};

export interface PropiedadesSeccionRentabilidadFinalAdmin {
  mostrarAviso?: (mensaje: string) => void;
}

/**
 * Vista completa del Dashboard de Rentabilidad Final para Administrador en Proyectos y Obras.
 * Permite revisar proyectos cerrados (H34) o cerrar un proyecto activo para habilitarlo automáticamente.
 */
export const SeccionRentabilidadFinalAdmin: React.FC<
  PropiedadesSeccionRentabilidadFinalAdmin
> = ({ mostrarAviso }) => {
  const { proyectos, cerrarProyecto } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const proyectosCerrados = useMemo(
    () => proyectos.filter((p) => p.status === "cerrado"),
    [proyectos]
  );
  const proyectosAbiertos = useMemo(
    () => proyectos.filter((p) => p.status !== "cerrado"),
    [proyectos]
  );

  const [proyectoSeleccionadoId, establecerProyectoSeleccionadoId] = useState<string>(
    () => proyectosCerrados[0]?.id || ""
  );
  const [bloqueosCierre, establecerBloqueosCierre] = useState<{
    proyectoCodigo: string;
    bloqueos: string[];
  } | null>(null);

  const proyectoActivoCerrado = useMemo(() => {
    const porId = proyectosCerrados.find((p) => p.id === proyectoSeleccionadoId);
    return porId || proyectosCerrados[0] || null;
  }, [proyectosCerrados, proyectoSeleccionadoId]);

  const manejarCerrarProyectoH34 = (p: Proyecto) => {
    establecerBloqueosCierre(null);
    const res = cerrarProyecto(p.id, usuario?.name || "Administrador");
    if (!res.success) {
      establecerBloqueosCierre({
        proyectoCodigo: p.code,
        bloqueos: res.blocks || ["Existen pendientes que impiden cerrar el proyecto."],
      });
      if (mostrarAviso) {
        mostrarAviso(`No se pudo cerrar ${p.code}: existen pendientes operativos.`);
      }
      return;
    }
    establecerProyectoSeleccionadoId(p.id);
    if (mostrarAviso) {
      mostrarAviso(
        `✓ Proyecto ${p.code} cerrado correctamente. Dashboard de Rentabilidad Final habilitado.`
      );
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Selector de Proyectos Cerrados (Habilitados) */}
      <Tarjeta variant="elevated" style={estilos.selectorTarjeta}>
        <View style={estilos.selectorHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              <Insignia label="Rentabilidad Final" tone="primary" size="sm" />
              <Insignia
                label={`${proyectosCerrados.length} cerrado(s) habilitado(s)`}
                tone="ok"
                size="sm"
              />
            </View>
            <Text style={estilos.selectorTitulo}>
              Dashboard de Rentabilidad Final por Proyecto Cerrado
            </Text>
            <Text style={estilos.selectorSub}>
              Se habilita automáticamente al cerrar contablemente un proyecto. Selecciona una obra
              cerrada para revisar sus gráficos de barras, composición de costos y desviaciones ($ y %).
            </Text>
          </View>
        </View>

        {proyectosCerrados.length > 0 && (
          <View style={estilos.chipsCerradosFila}>
            {proyectosCerrados.map((p) => {
              const activo = proyectoActivoCerrado?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => establecerProyectoSeleccionadoId(p.id)}
                  style={[estilos.chipProyecto, activo && estilos.chipProyectoActivo]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={activo ? "checkmark-circle" : "lock-closed-outline"}
                    size={15}
                    color={activo ? tema.colors.primaryDark : tema.colors.textMuted}
                  />
                  <Text
                    style={[
                      estilos.chipProyectoTexto,
                      activo && estilos.chipProyectoTextoActivo,
                    ]}
                  >
                    {p.code} — {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Tarjeta>

      {/* Panel de Dashboard de Rentabilidad Final del Proyecto Cerrado Seleccionado */}
      {proyectoActivoCerrado ? (
        <PanelGraficosRentabilidadProyecto proyecto={proyectoActivoCerrado} />
      ) : (
        <EstadoVacio
          icon="lock-closed-outline"
          title="Aún no hay proyectos cerrados"
          description="Cierra un proyecto desde la lista inferior o desde su ficha para habilitar automáticamente su Dashboard de Rentabilidad Final."
          containerStyle={{ marginVertical: 12 }}
        />
      )}

      {/* Bloqueo de cierre H34 si el proyecto tiene solicitudes/devoluciones/herramientas pendientes */}
      {bloqueosCierre && (
        <View style={estilos.bloqueosBanner}>
          <Ionicons name="warning" size={20} color={tema.colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={estilos.bloqueosTitulo}>
              Cierre bloqueado para {bloqueosCierre.proyectoCodigo}:
            </Text>
            {bloqueosCierre.bloqueos.map((b, i) => (
              <Text key={i} style={estilos.bloqueosItem}>
                • {b}
              </Text>
            ))}
          </View>
          <TouchableOpacity onPress={() => establecerBloqueosCierre(null)} style={{ padding: 4 }}>
            <Ionicons name="close" size={16} color={tema.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Proyectos Activos disponibles para cierre H34 */}
      {proyectosAbiertos.length > 0 && (
        <Tarjeta variant="outlined" style={{ gap: 10 }}>
          <Text style={estilos.abiertosTitulo}>
            Proyectos Activos / En Curso (Cerrar proyecto para habilitar Rentabilidad Final):
          </Text>
          {proyectosAbiertos.map((p) => (
            <View key={p.id} style={estilos.abiertoFila}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={estilos.abiertoNombre}>
                  {p.code} — {p.name}
                </Text>
                <Text style={estilos.abiertoMeta}>
                  Cliente: {p.client} • Avance: {p.progress}% • Costo real:{" "}
                  {formatearCLP(p.costReal)}
                </Text>
              </View>
              <Boton
                title="Cerrar Proyecto"
                variant="secondary"
                size="sm"
                icon="lock-closed-outline"
                onPress={() => manejarCerrarProyectoH34(p)}
                style={{ minHeight: 38 }}
              />
            </View>
          ))}
        </Tarjeta>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  selectorTarjeta: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
    gap: 12,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  selectorTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: tema.colors.text,
  },
  selectorSub: {
    fontSize: 12.5,
    color: tema.colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  chipsCerradosFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipProyecto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
  },
  chipProyectoActivo: {
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
  },
  chipProyectoTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  chipProyectoTextoActivo: {
    fontWeight: "800",
    color: tema.colors.primaryDark,
  },
  cierreAuditadoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  cierreAuditadoTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.okDark,
  },
  cierreAuditadoSub: {
    fontSize: 11.5,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  desviacionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  desvTarjeta: {
    flex: 1,
    minWidth: 175,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  desvTarjetaMovil: {
    minWidth: "46%",
  },
  desvEtiqueta: {
    fontSize: 10.5,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  desvValor: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  desvSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  graficosGrid: {
    gap: 12,
  },
  graficosGridAncho: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  graficoTarjeta: {
    gap: 12,
  },
  graficoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  graficoTitulo: {
    fontSize: 14,
    fontWeight: "800",
    color: tema.colors.text,
  },
  graficoSub: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  graficoBloque: {
    gap: 8,
  },
  graficoLeyendaFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  leyendaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  leyendaCuadro: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  leyendaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  tortaLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 14,
    paddingVertical: 4,
  },
  tortaLeyendaColumna: {
    flex: 1,
    minWidth: 165,
    gap: 10,
  },
  tortaLeyendaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tortaPunto: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  tortaNombre: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
  },
  tortaValor: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  resumenAuditadoTarjeta: {
    gap: 8,
  },
  lineaResumen: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  lineaLbl: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  lineaVal: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  bloqueosBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.danger,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  bloqueosTitulo: {
    fontSize: 12.5,
    fontWeight: "800",
    color: tema.colors.danger,
  },
  bloqueosItem: {
    fontSize: 12,
    color: tema.colors.text,
    marginTop: 2,
  },
  abiertosTitulo: {
    fontSize: 12.5,
    fontWeight: "800",
    color: tema.colors.text,
  },
  abiertoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
  },
  abiertoNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.colors.text,
  },
  abiertoMeta: {
    fontSize: 11.5,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
});
