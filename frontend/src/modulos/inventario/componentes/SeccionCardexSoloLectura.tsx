// Vista de Cardex de solo lectura con filtros dinámicos, tabla cronológica de saldos/PMP,
// contraste SCRUM contra saldo actual del insumo y exportación a Excel.
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Boton,
  CampoBusqueda,
  EstadoVacio,
  Insignia,
  Tarjeta,
} from "@/componentes/comunes";
import { MovimientoCardex, Producto, Proyecto } from "@/nucleo/tipos";
import {
  OrdenCronologicoCardex,
  RangoFechaCardex,
  calcularContrasteSaldoCardex,
  cumpleRangoFechaCardex,
  exportarCardexAExcel,
  obtenerMapaUltimaLineaPorSku,
  ordenarCardexCronologico,
} from "../cardexExcel";

export interface PropiedadesSeccionCardexSoloLectura {
  cardexCompleto: MovimientoCardex[];
  productos: Producto[];
  proyectos: Proyecto[];
  kardexFiltrarSku: string;
  establecerKardexFiltrarSku: (valor: string) => void;
  kardexFiltrarTipo: string;
  establecerKardexFiltrarTipo: (valor: string) => void;
  kardexFiltrarProyecto: string;
  establecerKardexFiltrarProyecto: (valor: string) => void;
  kardexFechaRango: RangoFechaCardex;
  establecerKardexFechaRango: (rango: RangoFechaCardex) => void;
  mostrarAviso: (mensaje: string) => void;
}

const TIPOS_MOVIMIENTO = [
  { id: "todos", label: "Todos" },
  { id: "entrada_compra", label: "Entradas Compra" },
  { id: "salida_obra", label: "Salidas a Obra" },
  { id: "devolucion", label: "Devoluciones" },
  { id: "merma", label: "Mermas" },
  { id: "ajuste_conteo", label: "Ajustes Conteo" },
] as const;

const RANGOS_FECHA: { id: RangoFechaCardex; label: string }[] = [
  { id: "todos", label: "Todas las fechas" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "mes_actual", label: "Este mes" },
];

const obtenerTonoTipo = (
  tipo: MovimientoCardex["type"]
): "ok" | "danger" | "warn" | "info" => {
  if (tipo === "entrada_compra" || tipo === "devolucion") return "ok";
  if (tipo === "merma") return "danger";
  if (tipo === "ajuste_conteo") return "warn";
  return "info";
};

const obtenerTonoRol = (rol?: string): "primary" | "ok" | "warn" => {
  if (rol === "Administrador") return "primary";
  if (rol === "Tecnico" || rol === "Técnico") return "ok";
  return "warn";
};

export const SeccionCardexSoloLectura: React.FC<PropiedadesSeccionCardexSoloLectura> = ({
  cardexCompleto,
  productos,
  proyectos,
  kardexFiltrarSku,
  establecerKardexFiltrarSku,
  kardexFiltrarTipo,
  establecerKardexFiltrarTipo,
  kardexFiltrarProyecto,
  establecerKardexFiltrarProyecto,
  kardexFechaRango,
  establecerKardexFechaRango,
  mostrarAviso,
}) => {
  const [ordenCronologico, establecerOrdenCronologico] =
    useState<OrdenCronologicoCardex>("desc");
  const [modoVista, establecerModoVista] = useState<"tabla" | "tarjetas">("tabla");
  const [exportandoExcel, establecerExportandoExcel] = useState(false);

  // Mapa inmutable con el ID del movimiento más reciente por cada SKU en el historial completo
  const mapaUltimaLineaPorSku = useMemo(
    () => obtenerMapaUltimaLineaPorSku(cardexCompleto),
    [cardexCompleto]
  );

  // Lista única de SKUs presentes en el Cardex para selección rápida de auditoría
  const skusDisponibles = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const m of cardexCompleto) {
      if (!vistos.has(m.sku)) {
        vistos.set(m.sku, m.productName);
      }
    }
    return Array.from(vistos.entries())
      .map(([sku, nombre]) => ({ sku, nombre }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }, [cardexCompleto]);

  // Aplicación de filtros dinámicos y orden cronológico
  const movimientosFiltrados = useMemo(() => {
    const consulta = kardexFiltrarSku.trim().toLowerCase();

    const filtrados = cardexCompleto.filter((entry) => {
      if (consulta) {
        const coincideSku = entry.sku.toLowerCase().includes(consulta);
        const coincideNombre = entry.productName.toLowerCase().includes(consulta);
        const coincideRef = entry.reference.toLowerCase().includes(consulta);
        const coincideResponsable = (entry.userName || "").toLowerCase().includes(consulta);
        if (!coincideSku && !coincideNombre && !coincideRef && !coincideResponsable) {
          return false;
        }
      }

      if (kardexFiltrarTipo !== "todos" && entry.type !== kardexFiltrarTipo) {
        return false;
      }

      if (kardexFiltrarProyecto === "bodega_central") {
        if (entry.projectCode || entry.projectName) return false;
      } else if (
        kardexFiltrarProyecto !== "todos" &&
        entry.projectCode !== kardexFiltrarProyecto
      ) {
        return false;
      }

      if (!cumpleRangoFechaCardex(entry.date, kardexFechaRango)) {
        return false;
      }

      return true;
    });

    return ordenarCardexCronologico(filtrados, ordenCronologico);
  }, [
    cardexCompleto,
    kardexFiltrarSku,
    kardexFiltrarTipo,
    kardexFiltrarProyecto,
    kardexFechaRango,
    ordenCronologico,
  ]);

  // Contraste SCRUM entre el saldo actual del insumo en catálogo y su última línea en el Cardex
  const contrastesSaldos = useMemo(() => {
    const skusEnVista = Array.from(new Set(movimientosFiltrados.map((m) => m.sku)));
    return calcularContrasteSaldoCardex(
      productos,
      cardexCompleto,
      skusEnVista.length > 0 ? skusEnVista : undefined
    );
  }, [productos, cardexCompleto, movimientosFiltrados]);

  // KPIs dinámicos del conjunto filtrado
  const resumenKpi = useMemo(() => {
    const totalEntradas = movimientosFiltrados.reduce(
      (acc, m) => acc + Number(m.qtyIn || 0),
      0
    );
    const totalSalidas = movimientosFiltrados.reduce(
      (acc, m) => acc + Number(m.qtyOut || 0),
      0
    );
    const valorizacionUltimosSaldos = contrastesSaldos.reduce(
      (acc, c) => acc + c.saldoUltimaLineaCardex * c.pmpUltimaLineaCardex,
      0
    );
    const skusCuadrados = contrastesSaldos.filter((c) => c.cuadraExacto).length;

    return {
      cantidadMovimientos: movimientosFiltrados.length,
      totalEntradas: Number(totalEntradas.toFixed(3)),
      totalSalidas: Number(totalSalidas.toFixed(3)),
      valorizacionUltimosSaldos: Math.round(valorizacionUltimosSaldos),
      skusCuadrados,
      totalSkusAuditados: contrastesSaldos.length,
    };
  }, [movimientosFiltrados, contrastesSaldos]);

  const hayFiltrosActivos =
    Boolean(kardexFiltrarSku.trim()) ||
    kardexFiltrarTipo !== "todos" ||
    kardexFiltrarProyecto !== "todos" ||
    kardexFechaRango !== "todos";

  const limpiarTodosLosFiltros = () => {
    establecerKardexFiltrarSku("");
    establecerKardexFiltrarTipo("todos");
    establecerKardexFiltrarProyecto("todos");
    establecerKardexFechaRango("todos");
  };

  const manejarExportarExcel = async () => {
    establecerExportandoExcel(true);
    const resumenFiltros = [
      kardexFiltrarSku.trim() ? `Búsqueda: "${kardexFiltrarSku.trim()}"` : "Todos los insumos",
      kardexFiltrarTipo !== "todos" ? `Tipo: ${kardexFiltrarTipo}` : "Todos los tipos",
      kardexFiltrarProyecto !== "todos"
        ? `Proyecto: ${kardexFiltrarProyecto}`
        : "Todos los proyectos",
      `Rango: ${RANGOS_FECHA.find((r) => r.id === kardexFechaRango)?.label || "Todas"}`,
      `Orden: ${ordenCronologico === "desc" ? "Más recientes primero" : "Cronológico ascendente"}`,
    ].join(" | ");

    const resultado = await exportarCardexAExcel({
      movimientos: movimientosFiltrados,
      contrastes: contrastesSaldos,
      filtrosResumen: resumenFiltros,
    });

    establecerExportandoExcel(false);
    mostrarAviso(resultado.mensaje);
  };

  return (
    <ScrollView
      style={estilosLocales.contenedor}
      contentContainerStyle={estilosLocales.contenido}
    >
      {/* 1. BANNER DE SOLO LECTURA E INMUTABILIDAD */}
      <View style={estilosLocales.bannerSoloLectura}>
        <View style={estilosLocales.bannerIzquierda}>
          <View style={estilosLocales.bannerIconoCaja}>
            <Ionicons name="lock-closed" size={18} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={estilosLocales.bannerTituloFila}>
              <Text style={estilosLocales.bannerTitulo}>
                Cardex de Inventario — Vista de Solo Lectura
              </Text>
              <Insignia label="INMUTABLE" tone="primary" size="sm" />
            </View>
            <Text style={estilosLocales.bannerSubtitulo}>
              Registro cronológico completo de entradas, salidas, devoluciones, mermas, saldos y PMP. Sin opciones de edición ni eliminación.
            </Text>
          </View>
        </View>

        <Boton
          title={exportandoExcel ? "Exportando..." : "Exportar a Excel"}
          variant="primary"
          size="sm"
          icon="download-outline"
          loading={exportandoExcel}
          disabled={exportandoExcel || movimientosFiltrados.length === 0}
          onPress={manejarExportarExcel}
        />
      </View>

      {/* 2. KPIs DINÁMICOS DEL PERÍODO FILTRADO */}
      <View style={estilosLocales.kpiFila}>
        <View style={estilosLocales.kpiTarjeta}>
          <Text style={estilosLocales.kpiEtiqueta}>Movimientos</Text>
          <Text style={estilosLocales.kpiValor}>{resumenKpi.cantidadMovimientos}</Text>
          <Text style={estilosLocales.kpiSub}>de {cardexCompleto.length} totales</Text>
        </View>
        <View style={estilosLocales.kpiTarjeta}>
          <Text style={estilosLocales.kpiEtiqueta}>Total Entradas</Text>
          <Text style={[estilosLocales.kpiValor, { color: tema.colors.ok }]}>
            +{resumenKpi.totalEntradas}
          </Text>
          <Text style={estilosLocales.kpiSub}>Compras / Devoluciones</Text>
        </View>
        <View style={estilosLocales.kpiTarjeta}>
          <Text style={estilosLocales.kpiEtiqueta}>Total Salidas</Text>
          <Text style={[estilosLocales.kpiValor, { color: tema.colors.danger }]}>
            -{resumenKpi.totalSalidas}
          </Text>
          <Text style={estilosLocales.kpiSub}>Obras / Mermas</Text>
        </View>
        <View style={estilosLocales.kpiTarjeta}>
          <Text style={estilosLocales.kpiEtiqueta}>Valorización Últ. Saldo</Text>
          <Text style={[estilosLocales.kpiValor, { color: tema.colors.primaryDark }]}>
            {formatearCLP(resumenKpi.valorizacionUltimosSaldos)}
          </Text>
          <Text style={estilosLocales.kpiSub}>
            Auditoría: {resumenKpi.skusCuadrados}/{resumenKpi.totalSkusAuditados} cuadran
          </Text>
        </View>
      </View>

      {/* 3. PANEL DE CONTRASTE [SCRUM]: SALDO ACTUAL DEL INSUMO VS. ÚLTIMA LÍNEA DEL CARDEX */}
      {contrastesSaldos.length > 0 && (
        <Tarjeta variant="outlined" style={estilosLocales.scrumTarjeta}>
          <View style={estilosLocales.scrumEncabezado}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Ionicons name="checkmark-done-circle" size={18} color={tema.colors.primaryDark} />
              <Text style={estilosLocales.scrumTitulo}>
                Contraste de Saldos: Catálogo Actual vs. Última Línea del Cardex
              </Text>
            </View>
            <Insignia
              label={`${resumenKpi.skusCuadrados}/${resumenKpi.totalSkusAuditados} cuadrados`}
              tone={
                resumenKpi.skusCuadrados === resumenKpi.totalSkusAuditados ? "ok" : "warn"
              }
              size="sm"
            />
          </View>
          <Text style={estilosLocales.scrumSubtitulo}>
            Toca cualquier insumo para filtrar su historial cronológico y verificar su última línea de saldo y PMP.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilosLocales.scrumLista}
          >
            {contrastesSaldos.map((c) => {
              const esSeleccionado =
                kardexFiltrarSku.trim().toUpperCase() === c.sku.trim().toUpperCase();
              return (
                <TouchableOpacity
                  key={c.sku}
                  activeOpacity={0.8}
                  onPress={() =>
                    establecerKardexFiltrarSku(esSeleccionado ? "" : c.sku)
                  }
                  style={[
                    estilosLocales.contrasteItem,
                    esSeleccionado && estilosLocales.contrasteItemActivo,
                    !c.cuadraExacto && estilosLocales.contrasteItemAlerta,
                  ]}
                >
                  <View style={estilosLocales.contrasteItemTop}>
                    <Text style={estilosLocales.contrasteSku}>{c.sku}</Text>
                    <Insignia
                      label={c.cuadraExacto ? "Cuadra" : "Desfase"}
                      tone={c.cuadraExacto ? "ok" : "danger"}
                      size="sm"
                    />
                  </View>
                  <Text style={estilosLocales.contrasteNombre} numberOfLines={1}>
                    {c.nombreInsumo}
                  </Text>

                  <View style={estilosLocales.contrasteNumerosFila}>
                    <View style={estilosLocales.contrasteCol}>
                      <Text style={estilosLocales.contrasteLbl}>Catálogo actual</Text>
                      <Text style={estilosLocales.contrasteVal}>
                        {c.stockDisponibleCatalogo} {c.unidad}
                      </Text>
                      {c.stockComprometidoCatalogo > 0 && (
                        <Text style={estilosLocales.contrasteNota}>
                          +{c.stockComprometidoCatalogo} comp. (Total {c.existenciaTotalCatalogo})
                        </Text>
                      )}
                    </View>

                    <View style={estilosLocales.contrasteDivisor} />

                    <View style={estilosLocales.contrasteCol}>
                      <Text style={estilosLocales.contrasteLbl}>Últ. línea Cardex</Text>
                      <Text
                        style={[
                          estilosLocales.contrasteVal,
                          { color: tema.colors.primaryDark },
                        ]}
                      >
                        {c.saldoUltimaLineaCardex} {c.unidad}
                      </Text>
                      <Text style={estilosLocales.contrasteNota} numberOfLines={1}>
                        PMP {formatearCLP(c.pmpUltimaLineaCardex)}
                      </Text>
                    </View>
                  </View>

                  <Text style={estilosLocales.contrastePie} numberOfLines={1}>
                    Últ. mov: {c.ultimoMovimiento.reference} • {formatearFecha(c.ultimoMovimiento.date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Tarjeta>
      )}

      {/* 4. FILTROS DINÁMICOS */}
      <View style={estilosLocales.filtrosCaja}>
        <View style={estilosLocales.busquedaFila}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <CampoBusqueda
              value={kardexFiltrarSku}
              onChangeText={establecerKardexFiltrarSku}
              placeholder="Buscar por SKU, insumo, referencia (OC/SOL/DEV) o responsable..."
            />
          </View>

          {hayFiltrosActivos && (
            <Boton
              title="Limpiar filtros"
              variant="ghost"
              size="sm"
              icon="close-circle-outline"
              onPress={limpiarTodosLosFiltros}
            />
          )}
        </View>

        {/* Selector rápido de SKU */}
        {skusDisponibles.length > 0 && (
          <View style={estilosLocales.grupoFiltro}>
            <Text style={estilosLocales.grupoFiltroLbl}>Insumo (SKU):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => establecerKardexFiltrarSku("")}
                style={[
                  estilosLocales.chip,
                  !kardexFiltrarSku.trim() && estilosLocales.chipActivo,
                ]}
              >
                <Text
                  style={[
                    estilosLocales.chipTexto,
                    !kardexFiltrarSku.trim() && estilosLocales.chipTextoActivo,
                  ]}
                >
                  Todos los insumos
                </Text>
              </TouchableOpacity>
              {skusDisponibles.map((item) => {
                const activo =
                  kardexFiltrarSku.trim().toUpperCase() === item.sku.toUpperCase();
                return (
                  <TouchableOpacity
                    key={item.sku}
                    onPress={() => establecerKardexFiltrarSku(activo ? "" : item.sku)}
                    style={[estilosLocales.chip, activo && estilosLocales.chipActivo]}
                  >
                    <Text
                      style={[
                        estilosLocales.chipTexto,
                        activo && estilosLocales.chipTextoActivo,
                      ]}
                    >
                      {item.sku}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Filtro por tipo de movimiento */}
        <View style={estilosLocales.grupoFiltro}>
          <Text style={estilosLocales.grupoFiltroLbl}>Tipo de movimiento:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TIPOS_MOVIMIENTO.map((tf) => {
              const activo = kardexFiltrarTipo === tf.id;
              return (
                <TouchableOpacity
                  key={tf.id}
                  onPress={() => establecerKardexFiltrarTipo(tf.id)}
                  style={[estilosLocales.chip, activo && estilosLocales.chipActivo]}
                >
                  <Text
                    style={[
                      estilosLocales.chipTexto,
                      activo && estilosLocales.chipTextoActivo,
                    ]}
                  >
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filtro por proyecto */}
        <View style={estilosLocales.grupoFiltro}>
          <Text style={estilosLocales.grupoFiltroLbl}>Proyecto / Destino:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => establecerKardexFiltrarProyecto("todos")}
              style={[
                estilosLocales.chip,
                kardexFiltrarProyecto === "todos" && estilosLocales.chipActivo,
              ]}
            >
              <Text
                style={[
                  estilosLocales.chipTexto,
                  kardexFiltrarProyecto === "todos" && estilosLocales.chipTextoActivo,
                ]}
              >
                Todos los proyectos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => establecerKardexFiltrarProyecto("bodega_central")}
              style={[
                estilosLocales.chip,
                kardexFiltrarProyecto === "bodega_central" && estilosLocales.chipActivo,
              ]}
            >
              <Text
                style={[
                  estilosLocales.chipTexto,
                  kardexFiltrarProyecto === "bodega_central" &&
                    estilosLocales.chipTextoActivo,
                ]}
              >
                Bodega Central
              </Text>
            </TouchableOpacity>
            {proyectos.map((pr) => {
              const activo = kardexFiltrarProyecto === pr.code;
              return (
                <TouchableOpacity
                  key={pr.id}
                  onPress={() => establecerKardexFiltrarProyecto(pr.code)}
                  style={[estilosLocales.chip, activo && estilosLocales.chipActivo]}
                >
                  <Text
                    style={[
                      estilosLocales.chipTexto,
                      activo && estilosLocales.chipTextoActivo,
                    ]}
                  >
                    {pr.code} ({pr.name})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filtro por rango de fecha + Controles de orden y modo de vista */}
        <View style={estilosLocales.controlesInferioresFila}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {RANGOS_FECHA.map((rf) => {
              const activo = kardexFechaRango === rf.id;
              return (
                <TouchableOpacity
                  key={rf.id}
                  onPress={() => establecerKardexFechaRango(rf.id)}
                  style={[estilosLocales.chip, activo && estilosLocales.chipActivo]}
                >
                  <Text
                    style={[
                      estilosLocales.chipTexto,
                      activo && estilosLocales.chipTextoActivo,
                    ]}
                  >
                    {rf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={estilosLocales.accionesVistaFila}>
            <TouchableOpacity
              onPress={() =>
                establecerOrdenCronologico((prev) => (prev === "desc" ? "asc" : "desc"))
              }
              style={estilosLocales.botonToggle}
            >
              <Ionicons
                name={ordenCronologico === "desc" ? "arrow-down-outline" : "arrow-up-outline"}
                size={14}
                color={tema.colors.primaryDark}
              />
              <Text style={estilosLocales.botonToggleTexto}>
                {ordenCronologico === "desc" ? "Recientes primero" : "Cronológico (A→Z)"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                establecerModoVista((prev) => (prev === "tabla" ? "tarjetas" : "tabla"))
              }
              style={estilosLocales.botonToggle}
            >
              <Ionicons
                name={modoVista === "tabla" ? "list-outline" : "grid-outline"}
                size={14}
                color={tema.colors.primaryDark}
              />
              <Text style={estilosLocales.botonToggleTexto}>
                {modoVista === "tabla" ? "Ver Tarjetas" : "Ver Tabla"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 5. TABLA CRONOLÓGICA DE SALDOS Y PMP (SOLO LECTURA) */}
      {movimientosFiltrados.length === 0 ? (
        <EstadoVacio
          icon="swap-horizontal-outline"
          title="Sin movimientos en el Cardex"
          description="No existen movimientos registrados que coincidan con los filtros seleccionados."
          actionTitle={hayFiltrosActivos ? "Limpiar filtros" : undefined}
          onAction={hayFiltrosActivos ? limpiarTodosLosFiltros : undefined}
          containerStyle={{ marginVertical: 20 }}
        />
      ) : modoVista === "tabla" ? (
        <Tarjeta variant="outlined" style={estilosLocales.tablaContenedor}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ minWidth: 1020 }}>
              {/* Cabecera de la tabla */}
              <View style={estilosLocales.tablaHeader}>
                <Text style={[estilosLocales.th, { width: 120 }]}>Fecha / Hora</Text>
                <Text style={[estilosLocales.th, { width: 190 }]}>SKU / Insumo</Text>
                <Text style={[estilosLocales.th, { width: 135 }]}>Tipo Movimiento</Text>
                <Text style={[estilosLocales.th, { width: 155 }]}>Referencia / Proyecto</Text>
                <Text style={[estilosLocales.th, { width: 78, textAlign: "right" }]}>
                  Entrada
                </Text>
                <Text style={[estilosLocales.th, { width: 78, textAlign: "right" }]}>
                  Salida
                </Text>
                <Text style={[estilosLocales.th, { width: 108, textAlign: "right" }]}>
                  Saldo Post.
                </Text>
                <Text style={[estilosLocales.th, { width: 96, textAlign: "right" }]}>
                  PMP Post.
                </Text>
                <Text style={[estilosLocales.th, { width: 100, textAlign: "right" }]}>
                  Valor Total
                </Text>
                <Text style={[estilosLocales.th, { width: 165 }]}>Responsable</Text>
              </View>

              {/* Filas cronológicas */}
              {movimientosFiltrados.map((item, idx) => {
                const ultimoDeSku = mapaUltimaLineaPorSku.get(item.sku.trim().toUpperCase());
                const esUltimaLinea = ultimoDeSku?.id === item.id;

                return (
                  <View
                    key={item.id}
                    style={[
                      estilosLocales.tablaFila,
                      idx % 2 === 1 && estilosLocales.tablaFilaAlterna,
                      esUltimaLinea && estilosLocales.tablaFilaUltima,
                    ]}
                  >
                    <View style={{ width: 120, paddingRight: 8 }}>
                      <Text style={estilosLocales.tdFecha}>{formatearFecha(item.date)}</Text>
                      {item.date.includes(" ") && (
                        <Text style={estilosLocales.tdSub}>{item.date.split(" ")[1]} h</Text>
                      )}
                    </View>

                    <View style={{ width: 190, paddingRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={estilosLocales.tdSku}>{item.sku}</Text>
                        {esUltimaLinea && (
                          <Insignia label="Última" tone="primary" size="sm" />
                        )}
                      </View>
                      <Text style={estilosLocales.tdNombre} numberOfLines={2}>
                        {item.productName}
                      </Text>
                    </View>

                    <View style={{ width: 135, paddingRight: 8, alignItems: "flex-start" }}>
                      <Insignia
                        label={item.typeLabel}
                        tone={obtenerTonoTipo(item.type)}
                        size="sm"
                      />
                    </View>

                    <View style={{ width: 155, paddingRight: 8 }}>
                      <Text style={estilosLocales.tdReferencia}>{item.reference}</Text>
                      <Text style={estilosLocales.tdSub} numberOfLines={1}>
                        {item.projectName || item.projectCode || "Bodega Central"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        estilosLocales.tdNumero,
                        { width: 78 },
                        item.qtyIn > 0 && { color: tema.colors.ok, fontWeight: "bold" },
                      ]}
                    >
                      {item.qtyIn > 0 ? `+${item.qtyIn}` : "—"}
                    </Text>

                    <Text
                      style={[
                        estilosLocales.tdNumero,
                        { width: 78 },
                        item.qtyOut > 0 && { color: tema.colors.danger, fontWeight: "bold" },
                      ]}
                    >
                      {item.qtyOut > 0 ? `-${item.qtyOut}` : "—"}
                    </Text>

                    <View style={{ width: 108, alignItems: "flex-end", paddingRight: 4 }}>
                      <Text style={estilosLocales.tdSaldo}>{item.balance}</Text>
                      {esUltimaLinea && (
                        <Text style={estilosLocales.tdUltimaNota}>Saldo vigente</Text>
                      )}
                    </View>

                    <Text style={[estilosLocales.tdNumero, { width: 96 }]}>
                      {formatearCLP(item.pmp)}
                    </Text>

                    <Text
                      style={[
                        estilosLocales.tdNumero,
                        { width: 100, fontWeight: "600", color: tema.colors.text },
                      ]}
                    >
                      {formatearCLP(item.totalValue)}
                    </Text>

                    <View style={{ width: 165, paddingLeft: 8 }}>
                      <Text style={estilosLocales.tdResponsable} numberOfLines={1}>
                        {item.userName || "Sistema"}
                      </Text>
                      <Text style={estilosLocales.tdSub} numberOfLines={1}>
                        {item.userRole || "Bodeguero"}
                        {item.userRut ? ` • ${item.userRut}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Tarjeta>
      ) : (
        movimientosFiltrados.map((item) => {
          const ultimoDeSku = mapaUltimaLineaPorSku.get(item.sku.trim().toUpperCase());
          const esUltimaLinea = ultimoDeSku?.id === item.id;

          return (
            <Tarjeta
              key={item.id}
              variant="outlined"
              style={[
                estilosLocales.movimientoTarjeta,
                esUltimaLinea && estilosLocales.movimientoTarjetaUltima,
              ]}
            >
              <View style={estilosLocales.movimientoTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={estilosLocales.tdSku}>{item.sku}</Text>
                    {esUltimaLinea && (
                      <Insignia label="Última línea" tone="primary" size="sm" />
                    )}
                  </View>
                  <Text style={estilosLocales.movimientoNombre}>{item.productName}</Text>
                </View>
                <Insignia
                  label={item.typeLabel}
                  tone={obtenerTonoTipo(item.type)}
                  size="sm"
                />
              </View>

              <View style={estilosLocales.movimientoGrilla}>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>Fecha</Text>
                  <Text style={estilosLocales.celdaVal}>{formatearFecha(item.date)}</Text>
                </View>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>Referencia</Text>
                  <Text style={estilosLocales.celdaVal}>{item.reference}</Text>
                </View>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>Proyecto</Text>
                  <Text style={estilosLocales.celdaVal}>
                    {item.projectName || item.projectCode || "Bodega Central"}
                  </Text>
                </View>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>Entrada / Salida</Text>
                  <Text
                    style={[
                      estilosLocales.celdaVal,
                      item.qtyIn > 0 && { color: tema.colors.ok, fontWeight: "bold" },
                      item.qtyOut > 0 && { color: tema.colors.danger, fontWeight: "bold" },
                    ]}
                  >
                    {item.qtyIn > 0 ? `+${item.qtyIn}` : `-${item.qtyOut}`}
                  </Text>
                </View>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>Saldo Posterior</Text>
                  <Text style={[estilosLocales.celdaVal, { fontWeight: "bold" }]}>
                    {item.balance}
                  </Text>
                </View>
                <View style={estilosLocales.movimientoCelda}>
                  <Text style={estilosLocales.celdaLbl}>PMP Posterior</Text>
                  <Text style={estilosLocales.celdaVal}>{formatearCLP(item.pmp)}</Text>
                </View>
              </View>

              <View style={estilosLocales.trazabilidadPie}>
                <Ionicons name="person-circle-outline" size={16} color={tema.colors.primary} />
                <Text style={estilosLocales.trazabilidadTexto}>
                  Registrado por:{" "}
                  <Text style={{ fontWeight: "bold", color: tema.colors.text }}>
                    {item.userName || "Sistema"}
                  </Text>
                </Text>
                <Insignia
                  label={item.userRole || "Bodeguero"}
                  tone={obtenerTonoRol(item.userRole)}
                  size="sm"
                />
                {item.userRut && (
                  <Text style={estilosLocales.tdSub}>• RUT: {item.userRut}</Text>
                )}
              </View>
            </Tarjeta>
          );
        })
      )}
    </ScrollView>
  );
};

const estilosLocales = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
    gap: tema.spacing.md,
  },
  bannerSoloLectura: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
  },
  bannerIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 240,
  },
  bannerIconoCaja: {
    width: 36,
    height: 36,
    borderRadius: tema.radius.full,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTituloFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
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
  },
  kpiFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiTarjeta: {
    flex: 1,
    minWidth: 145,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 12,
  },
  kpiEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  kpiValor: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  scrumTarjeta: {
    padding: 14,
    backgroundColor: tema.colors.card,
  },
  scrumEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  scrumTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  scrumSubtitulo: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  scrumLista: {
    gap: 10,
    paddingBottom: 2,
  },
  contrasteItem: {
    width: 248,
    backgroundColor: tema.colors.surface,
    borderWidth: 1.5,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
  },
  contrasteItemActivo: {
    borderColor: tema.colors.primary,
    backgroundColor: "#fffbeb",
  },
  contrasteItemAlerta: {
    borderColor: tema.colors.danger,
    backgroundColor: "#fef2f2",
  },
  contrasteItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  contrasteSku: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  contrasteNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
    marginTop: 3,
    marginBottom: 8,
  },
  contrasteNumerosFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  contrasteCol: {
    flex: 1,
  },
  contrasteDivisor: {
    width: 1,
    height: "100%",
    backgroundColor: tema.colors.border,
    marginHorizontal: 8,
  },
  contrasteLbl: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  contrasteVal: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  contrasteNota: {
    fontSize: 10,
    color: tema.colors.textSecondary,
    marginTop: 1,
  },
  contrastePie: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 6,
  },
  filtrosCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 12,
    gap: 10,
  },
  busquedaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  grupoFiltro: {
    gap: 4,
  },
  grupoFiltroLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginRight: 6,
  },
  chipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  chipTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  chipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  controlesInferioresFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  accionesVistaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  botonToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  botonToggleTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tablaContenedor: {
    padding: 0,
    overflow: "hidden",
  },
  tablaHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1917",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  th: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#f59e0b",
    textTransform: "uppercase",
  },
  tablaFila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    backgroundColor: tema.colors.card,
  },
  tablaFilaAlterna: {
    backgroundColor: tema.colors.surface,
  },
  tablaFilaUltima: {
    backgroundColor: "#fffbeb",
  },
  tdFecha: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tdSku: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  tdNombre: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  tdReferencia: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tdSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  tdNumero: {
    fontSize: 12,
    textAlign: "right",
    color: tema.colors.textSecondary,
  },
  tdSaldo: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tdUltimaNota: {
    fontSize: 10,
    color: tema.colors.primaryDark,
    fontWeight: "600",
  },
  tdResponsable: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  movimientoTarjeta: {
    padding: 14,
  },
  movimientoTarjetaUltima: {
    borderColor: tema.colors.primary,
    backgroundColor: "#fffbeb",
  },
  movimientoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  movimientoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  movimientoGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tema.colors.border,
  },
  movimientoCelda: {
    minWidth: 110,
    flex: 1,
  },
  celdaLbl: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  celdaVal: {
    fontSize: 12,
    color: tema.colors.text,
    marginTop: 2,
  },
  trazabilidadPie: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  trazabilidadTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
  },
});
