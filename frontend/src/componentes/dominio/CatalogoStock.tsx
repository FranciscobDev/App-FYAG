import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP } from "@/nucleo/formato";

/**
 * 1. Interfaces alineadas con el catálogo de insumos y Cardex del proyecto FYAG [FRONT-1]
 */
export interface InsumoStock {
  id: string;
  sku: string;
  nombre: string;
  disponible: number;
  stockMinimo: number;
  unidad: string;
  pmp: number; // Precio Medio Ponderado
  categoria?: string;
  ubicacion?: string;
}

export interface CatalogoStockProps {
  insumosIniciales?: InsumoStock[];
  mostrarSimuladorScrum?: boolean;
  onSelectInsumo?: (insumo: InsumoStock) => void;
}

/**
 * Componente Vista de Catálogo de Stock para Bodeguero [FRONT-1]
 *
 * Criterios de Aceptación:
 * 1. Filtro en vivo optimizado mientras el bodeguero escribe (busca por SKU o nombre).
 * 2. Resaltado visual automático en filas donde disponible <= stock_minimo:
 *    - Rojo intenso / suave para disponible === 0 (Sin stock / Crítico).
 *    - Amarillo / Ámbar para disponible <= stockMinimo (Bajo mínimo).
 *    - Verde / Blanco para disponible > stockMinimo (Conforme).
 * 3. [SCRUM] Herramienta interactiva para dejar insumos bajo el mínimo y verificar
 *    el resaltado visual y el buscador en tiempo real.
 */
export const CatalogoStock: React.FC<CatalogoStockProps> = ({
  insumosIniciales,
  mostrarSimuladorScrum = true,
  onSelectInsumo,
}) => {
  const { productos } = usarAplicacion();
  const { width } = useWindowDimensions();
  const esDesktop = width >= 768;

  // Si no se suministran insumosIniciales vía prop, se mapean desde el contexto global de la app
  const datosPorDefecto = useMemo<InsumoStock[]>(() => {
    if (insumosIniciales && insumosIniciales.length > 0) {
      return insumosIniciales;
    }
    if (productos && productos.length > 0) {
      return productos.map((p) => ({
        id: p.sku,
        sku: p.sku,
        nombre: p.name,
        disponible: p.stock,
        stockMinimo: p.minStock,
        unidad: p.unit,
        pmp: p.pmp || p.unitCost || 0,
        categoria: p.category,
        ubicacion: p.location,
      }));
    }
    // Datos de respaldo en caso de inicialización temprana
    return [
      {
        id: "ELE-CBL-0012",
        sku: "ELE-CBL-0012",
        nombre: "Cable THHN 12 AWG rollo 100 m",
        disponible: 185.45,
        stockMinimo: 50,
        unidad: "m",
        pmp: 635,
      },
      {
        id: "ELE-DIS-0016",
        sku: "ELE-DIS-0016",
        nombre: "Disyuntor Termomagnético 1P 16A",
        disponible: 8,
        stockMinimo: 20, // Insumo bajo mínimo por defecto para comprobación visual
        unidad: "un",
        pmp: 3850,
      },
      {
        id: "CLI-GAS-0410",
        sku: "CLI-GAS-0410",
        nombre: "Gas Refrigerante R410A cilindro 11.3 kg",
        disponible: 0, // Insumo crítico sin stock
        stockMinimo: 3,
        unidad: "cilindro",
        pmp: 82000,
      },
      {
        id: "FER-TRN-0001",
        sku: "FER-TRN-0001",
        nombre: "Tornillo Autoperforante 8x1/2 caja 1000 un",
        disponible: 45,
        stockMinimo: 10,
        unidad: "caja",
        pmp: 6500,
      },
    ];
  }, [insumosIniciales, productos]);

  const [insumos, setInsumos] = useState<InsumoStock[]>(datosPorDefecto);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroAlerta, setFiltroAlerta] = useState<"todos" | "criticos" | "conformes">("todos");
  const [filaExpandidaId, setFilaExpandidaId] = useState<string | null>(null);

  // Sincronizar si cambian los datos de origen
  useEffect(() => {
    setInsumos(datosPorDefecto);
  }, [datosPorDefecto]);

  // 2. Filtro en vivo optimizado mientras el bodeguero escribe
  const insumosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return insumos.filter((item) => {
      const coincideTexto =
        !q ||
        item.nombre.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.categoria && item.categoria.toLowerCase().includes(q)) ||
        (item.ubicacion && item.ubicacion.toLowerCase().includes(q));

      if (!coincideTexto) return false;

      if (filtroAlerta === "criticos") {
        return item.disponible <= item.stockMinimo;
      }
      if (filtroAlerta === "conformes") {
        return item.disponible > item.stockMinimo;
      }
      return true;
    });
  }, [insumos, busqueda, filtroAlerta]);

  // Estadísticas rápidas para supervisión en bodega
  const estadisticas = useMemo(() => {
    const total = insumos.length;
    const sinStock = insumos.filter((i) => i.disponible === 0).length;
    const bajoMinimo = insumos.filter((i) => i.disponible > 0 && i.disponible <= i.stockMinimo).length;
    const conformes = insumos.filter((i) => i.disponible > i.stockMinimo).length;
    return { total, sinStock, bajoMinimo, conformes, totalCriticos: sinStock + bajoMinimo };
  }, [insumos]);

  // 3. Determinar estilos semánticos automáticos según stock disponible vs mínimo
  const obtenerEstiloFila = (disponible: number, stockMinimo: number) => {
    if (disponible === 0) {
      return {
        filaEstilo: estilos.filaSinStock,
        bordeIzquierdo: estilos.bordeSinStock,
        badgeBg: "#fee2e2",
        badgeText: "#991b1b",
        badgeBorder: "#fecaca",
        badgeLabel: "🔴 Agotado",
        badgeLabelCorto: "● Agotado",
        colorTextoStock: "#b91c1c",
      };
    }
    if (disponible <= stockMinimo) {
      return {
        filaEstilo: estilos.filaBajoMinimo,
        bordeIzquierdo: estilos.bordeBajoMinimo,
        badgeBg: "#fef3c7",
        badgeText: "#92400e",
        badgeBorder: "#fde68a",
        badgeLabel: "⚠️ Bajo Mínimo",
        badgeLabelCorto: "▲ Bajo Mín",
        colorTextoStock: "#b45309",
      };
    }
    return {
      filaEstilo: estilos.filaConforme,
      bordeIzquierdo: estilos.bordeConforme,
      badgeBg: "#dcfce7",
      badgeText: "#166534",
      badgeBorder: "#bbf7d0",
      badgeLabel: "✅ Conforme",
      badgeLabelCorto: "● Conforme",
      colorTextoStock: "#15803d",
    };
  };

  return (
    <View style={estilos.contenedorPrincipal}>
      {/* =====================================================================
          TARJETA PRINCIPAL: CATÁLOGO DE STOCK
          ===================================================================== */}
      <View style={[estilos.tarjetaCatalogo, !esDesktop && estilos.tarjetaCatalogoMovil]}>
        {/* Encabezado y Barra de Filtro en Vivo */}
        <View style={estilos.encabezadoBarra}>
          <View style={{ flex: 1, minWidth: 200, marginBottom: esDesktop ? 0 : 10 }}>
            <Text style={estilos.tituloPrincipal}>Catálogo de Stock - Bodega</Text>
            <Text style={estilos.subtituloPrincipal}>
              Control y supervisión de insumos en tiempo real con alerta visual de reposición
            </Text>
          </View>

          {/* Buscador en Vivo con Icono y Botón de Limpiar */}
          <View style={[estilos.buscadorCaja, esDesktop && { width: 320 }]}>
            <Ionicons name="search-outline" size={18} color="#64748b" style={estilos.iconoBuscador} />
            <TextInput
              style={estilos.inputBuscador}
              placeholder="Buscar por SKU, nombre o ubicación..."
              placeholderTextColor="#94a3b8"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {Boolean(busqueda) && (
              <TouchableOpacity onPress={() => setBusqueda("")} hitSlop={8} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Chips de Filtro Rápido Responsivos */}
        <View style={estilos.filtrosFila}>
          <TouchableOpacity
            style={[estilos.chipFiltro, filtroAlerta === "todos" && estilos.chipFiltroActivo]}
            onPress={() => setFiltroAlerta("todos")}
          >
            <Text style={[estilos.chipFiltroTexto, filtroAlerta === "todos" && estilos.chipFiltroTextoActivo]}>
              Todos ({insumos.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              estilos.chipFiltro,
              filtroAlerta === "criticos" && estilos.chipFiltroCriticoActivo,
            ]}
            onPress={() => setFiltroAlerta("criticos")}
          >
            <Text
              style={[
                estilos.chipFiltroTexto,
                filtroAlerta === "criticos" && estilos.chipFiltroCriticoTextoActivo,
              ]}
            >
              ⚠️ Críticos ({estadisticas.totalCriticos})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              estilos.chipFiltro,
              filtroAlerta === "conformes" && estilos.chipFiltroConformeActivo,
            ]}
            onPress={() => setFiltroAlerta("conformes")}
          >
            <Text
              style={[
                estilos.chipFiltroTexto,
                filtroAlerta === "conformes" && estilos.chipFiltroConformeTextoActivo,
              ]}
            >
              ✅ Conformes ({estadisticas.conformes})
            </Text>
          </TouchableOpacity>
        </View>

        {/* =====================================================================
            TABLA RESPONSIVA DE INSUMOS (3 COLUMNAS EN MÓVIL / 6 EN DESKTOP)
            ===================================================================== */}
        {!esDesktop ? (
          <View style={estilos.contenedorTablaMovil}>
            {/* Cabecera Compacta de 3 Columnas para Celular */}
            <View style={estilos.filaCabeceraMovil}>
              <Text style={[estilos.textoTh, estilos.colMovilInsumo]}>Insumo / SKU</Text>
              <Text style={[estilos.textoTh, estilos.colMovilStock]}>Stock / Mín.</Text>
              <Text style={[estilos.textoTh, estilos.colMovilPmp]}>PMP / Estado</Text>
            </View>

            {/* Filas Compactas sin Scroll Horizontal + Detalle Desplegable en 1 toque */}
            {insumosFiltrados.length > 0 ? (
              insumosFiltrados.map((item) => {
                const keyId = item.id || item.sku;
                const infoAlerta = obtenerEstiloFila(item.disponible, item.stockMinimo);
                const expandida = filaExpandidaId === keyId;

                return (
                  <View
                    key={keyId}
                    style={[estilos.bloqueFilaMovil, infoAlerta.filaEstilo, infoAlerta.bordeIzquierdo]}
                  >
                    <TouchableOpacity
                      style={estilos.filaDatosMovil}
                      activeOpacity={0.75}
                      onPress={() =>
                        setFilaExpandidaId((prev) => (prev === keyId ? null : keyId))
                      }
                    >
                      {/* Columna 1: Nombre + SKU + Ubicación */}
                      <View style={estilos.colMovilInsumo}>
                        <Text style={estilos.nombreInsumoMovil} numberOfLines={2}>
                          {item.nombre}
                        </Text>
                        <View style={estilos.subLineaMovil}>
                          <Text style={estilos.skuBadgeMovil}>{item.sku}</Text>
                          {Boolean(item.ubicacion || item.categoria) && (
                            <Text style={estilos.ubicacionTextoMovil} numberOfLines={1}>
                              • {item.ubicacion || item.categoria}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Columna 2: Disponible vs Stock Mínimo */}
                      <View style={estilos.colMovilStock}>
                        <Text
                          style={[
                            estilos.stockPrincipalMovil,
                            { color: infoAlerta.colorTextoStock },
                          ]}
                        >
                          {item.disponible} {item.unidad}
                        </Text>
                        <Text style={estilos.stockMinimoMovil}>
                          Mín: {item.stockMinimo} {item.unidad}
                        </Text>
                      </View>

                      {/* Columna 3: PMP + Pill compacto de estado */}
                      <View style={estilos.colMovilPmp}>
                        <Text style={estilos.pmpPrincipalMovil}>{formatearCLP(item.pmp)}</Text>
                        <View
                          style={[
                            estilos.badgeAlertaMovil,
                            {
                              backgroundColor: infoAlerta.badgeBg,
                              borderColor: infoAlerta.badgeBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              estilos.badgeAlertaTextoMovil,
                              { color: infoAlerta.badgeText },
                            ]}
                            numberOfLines={1}
                          >
                            {infoAlerta.badgeLabelCorto}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Franja desplegable (Accordion sin modales) */}
                    {expandida && (
                      <View style={estilos.franjaDetalleMovil}>
                        <View style={estilos.franjaDetalleInfo}>
                          <Text style={estilos.franjaDetalleTexto}>
                            <Text style={estilos.franjaDetalleLabel}>Categoría: </Text>
                            {item.categoria || "General"}
                            {"  •  "}
                            <Text style={estilos.franjaDetalleLabel}>Ubicación: </Text>
                            {item.ubicacion || "Bodega Central"}
                          </Text>
                        </View>
                        {onSelectInsumo && (
                          <TouchableOpacity
                            style={estilos.botonVerCardexMovil}
                            onPress={() => onSelectInsumo(item)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="swap-horizontal-outline"
                              size={13}
                              color={tema.colors.primaryDark}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={estilos.botonVerCardexTexto}>Ver Cardex</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={estilos.filaVacia}>
                <Ionicons name="search-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={estilos.textoVacio}>
                  No se encontraron insumos coincidentes con "{busqueda}".
                </Text>
                <TouchableOpacity onPress={() => setBusqueda("")} style={estilos.botonLimpiarBusqueda}>
                  <Text style={estilos.botonLimpiarBusquedaTexto}>Limpiar búsqueda</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={estilos.scrollHorizontal}>
            <View style={estilos.contenedorTabla}>
              {/* Cabecera de la Tabla Desktop */}
              <View style={estilos.filaCabecera}>
                <Text style={[estilos.textoTh, estilos.colSku]}>SKU</Text>
                <Text style={[estilos.textoTh, estilos.colNombre]}>Insumo / Descripción</Text>
                <Text style={[estilos.textoTh, estilos.colDisponible, { textAlign: "center" }]}>Disponible</Text>
                <Text style={[estilos.textoTh, estilos.colStockMinimo, { textAlign: "center" }]}>Stock Mínimo</Text>
                <Text style={[estilos.textoTh, estilos.colPmp, { textAlign: "right" }]}>PMP ($)</Text>
                <Text style={[estilos.textoTh, estilos.colAlerta, { textAlign: "center" }]}>Estado Alerta</Text>
              </View>

              {/* Filas de la Tabla Desktop */}
              {insumosFiltrados.length > 0 ? (
                insumosFiltrados.map((item) => {
                  const infoAlerta = obtenerEstiloFila(item.disponible, item.stockMinimo);
                  return (
                    <TouchableOpacity
                      key={item.id || item.sku}
                      style={[estilos.filaDatos, infoAlerta.filaEstilo, infoAlerta.bordeIzquierdo]}
                      activeOpacity={onSelectInsumo ? 0.7 : 1}
                      onPress={() => onSelectInsumo && onSelectInsumo(item)}
                    >
                      <Text style={[estilos.textoTd, estilos.colSku, estilos.textoMono]}>{item.sku}</Text>
                      <View style={estilos.colNombre}>
                        <Text style={estilos.nombreInsumoTexto} numberOfLines={2}>
                          {item.nombre}
                        </Text>
                        {Boolean(item.categoria) && (
                          <Text style={estilos.categoriaInsumoTexto}>
                            {item.categoria} {item.ubicacion ? `• Ubic: ${item.ubicacion}` : ""}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          estilos.textoTd,
                          estilos.colDisponible,
                          { textAlign: "center", fontWeight: "700", color: infoAlerta.colorTextoStock },
                        ]}
                      >
                        {item.disponible} {item.unidad}
                      </Text>
                      <Text style={[estilos.textoTd, estilos.colStockMinimo, { textAlign: "center", color: "#64748b" }]}>
                        {item.stockMinimo} {item.unidad}
                      </Text>
                      <Text style={[estilos.textoTd, estilos.colPmp, { textAlign: "right", fontWeight: "600" }]}>
                        {formatearCLP(item.pmp)}
                      </Text>
                      <View style={[estilos.colAlerta, { alignItems: "center", justifyContent: "center" }]}>
                        <View
                          style={[
                            estilos.badgeAlerta,
                            {
                              backgroundColor: infoAlerta.badgeBg,
                              borderColor: infoAlerta.badgeBorder,
                            },
                          ]}
                        >
                          <Text style={[estilos.badgeAlertaTexto, { color: infoAlerta.badgeText }]}>
                            {infoAlerta.badgeLabel}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={estilos.filaVacia}>
                  <Ionicons name="search-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <Text style={estilos.textoVacio}>
                    No se encontraron insumos coincidentes con "{busqueda}".
                  </Text>
                  <TouchableOpacity onPress={() => setBusqueda("")} style={estilos.botonLimpiarBusqueda}>
                    <Text style={estilos.botonLimpiarBusquedaTexto}>Limpiar búsqueda</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default CatalogoStock;

const estilos = StyleSheet.create({
  contenedorPrincipal: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  barraScrum: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scrumHeaderFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  scrumTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  scrumBadgesContenedor: {
    flexDirection: "row",
    gap: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrumSubtitulo: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
    lineHeight: 16,
  },
  scrumBotonesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  botonScrumAccion: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  botonScrumTexto: {
    fontSize: 12,
    fontWeight: "600",
  },
  cajaMensajeScrum: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  textoMensajeScrum: {
    fontSize: 11,
    color: "#1e40af",
    flex: 1,
    fontWeight: "500",
  },
  tarjetaCatalogo: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tarjetaCatalogoMovil: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
  },
  encabezadoBarra: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  tituloPrincipal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subtituloPrincipal: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  buscadorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    width: "100%",
  },
  iconoBuscador: {
    marginRight: 6,
  },
  inputBuscador: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    height: "100%",
  },
  filtrosFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  chipFiltro: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipFiltroActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  chipFiltroTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  chipFiltroTextoActivo: {
    color: tema.colors.primaryDark,
  },
  chipFiltroCriticoActivo: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  chipFiltroCriticoTextoActivo: {
    color: "#92400e",
  },
  chipFiltroConformeActivo: {
    backgroundColor: "#dcfce7",
    borderColor: "#22c55e",
  },
  chipFiltroConformeTextoActivo: {
    color: "#166534",
  },
  // =========================================================================
  // ESTILOS DE TABLA COMPACTA MÓVIL (100% ANCHO, 3 COLUMNAS, SIN RECORTES)
  // =========================================================================
  contenedorTablaMovil: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  filaCabeceraMovil: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  bloqueFilaMovil: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filaDatosMovil: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  colMovilInsumo: {
    flex: 1,
    paddingRight: 4,
  },
  colMovilStock: {
    width: 82,
    alignItems: "flex-end",
    textAlign: "right",
  },
  colMovilPmp: {
    width: 88,
    alignItems: "flex-end",
    textAlign: "right",
  },
  nombreInsumoMovil: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 17,
  },
  subLineaMovil: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
  },
  skuBadgeMovil: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primaryDark,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ubicacionTextoMovil: {
    fontSize: 11,
    color: "#64748b",
    flexShrink: 1,
  },
  stockPrincipalMovil: {
    fontSize: 13,
    fontWeight: "800",
  },
  stockMinimoMovil: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  pmpPrincipalMovil: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  badgeAlertaMovil: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeAlertaTextoMovil: {
    fontSize: 10,
    fontWeight: "700",
  },
  franjaDetalleMovil: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  franjaDetalleInfo: {
    flex: 1,
    minWidth: 160,
  },
  franjaDetalleTexto: {
    fontSize: 11,
    color: "#475569",
  },
  franjaDetalleLabel: {
    fontWeight: "700",
    color: "#1e293b",
  },
  botonVerCardexMovil: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  botonVerCardexTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  // =========================================================================
  // ESTILOS DE TABLA DESKTOP
  // =========================================================================
  scrollHorizontal: {
    width: "100%",
  },
  contenedorTabla: {
    minWidth: 840,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  filaCabecera: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  textoTh: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filaDatos: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  // Resaltado visual condicional [FRONT-1]
  filaSinStock: {
    backgroundColor: "#fef2f2",
  },
  bordeSinStock: {
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  filaBajoMinimo: {
    backgroundColor: "#fffbeb",
  },
  bordeBajoMinimo: {
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  filaConforme: {
    backgroundColor: "#ffffff",
  },
  bordeConforme: {
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
  },
  // Columnas fijas
  colSku: {
    width: 140,
  },
  colNombre: {
    flex: 1,
    paddingRight: 10,
  },
  colDisponible: {
    width: 110,
  },
  colStockMinimo: {
    width: 110,
  },
  colPmp: {
    width: 110,
  },
  colAlerta: {
    width: 130,
  },
  textoTd: {
    fontSize: 13,
    color: "#1e293b",
  },
  textoMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: "#0f172a",
  },
  nombreInsumoTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  categoriaInsumoTexto: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  badgeAlerta: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeAlertaTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
  filaVacia: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  textoVacio: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    marginBottom: 8,
  },
  botonLimpiarBusqueda: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  botonLimpiarBusquedaTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
});
