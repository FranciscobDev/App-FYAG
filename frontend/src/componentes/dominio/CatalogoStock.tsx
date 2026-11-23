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
  const [mensajeScrum, setMensajeScrum] = useState<string | null>(null);

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
        (item.categoria && item.categoria.toLowerCase().includes(q));

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
      colorTextoStock: "#15803d",
    };
  };

  // =========================================================================
  // FUNCIONES DE PRUEBA [SCRUM]
  // =========================================================================
  const simularInsumoBajoMinimo = () => {
    setInsumos((prev) => {
      // Tomamos el primer insumo que esté conforme y lo dejamos bajo el mínimo
      const indice = prev.findIndex((i) => i.disponible > i.stockMinimo);
      if (indice >= 0) {
        const itemActual = prev[indice];
        const nuevoDisponible = Math.max(1, Math.floor(itemActual.stockMinimo * 0.4));
        const actualizados = [...prev];
        actualizados[indice] = {
          ...itemActual,
          disponible: nuevoDisponible,
        };
        setMensajeScrum(
          `[SCRUM OK] Insumo "${itemActual.sku} - ${itemActual.nombre}" ajustado a ${nuevoDisponible} ${itemActual.unidad} (Mínimo: ${itemActual.stockMinimo}). ¡Fila resaltada en Amarillo/Ámbar!`
        );
        return actualizados;
      }
      setMensajeScrum("Todos los insumos ya están bajo el mínimo o sin stock.");
      return prev;
    });
  };

  const simularInsumoAgotado = () => {
    setInsumos((prev) => {
      const indice = prev.findIndex((i) => i.disponible > 0);
      if (indice >= 0) {
        const itemActual = prev[indice];
        const actualizados = [...prev];
        actualizados[indice] = {
          ...itemActual,
          disponible: 0,
        };
        setMensajeScrum(
          `[SCRUM OK] Insumo "${itemActual.sku}" ajustado a 0 ${itemActual.unidad}. ¡Fila resaltada en Rojo!`
        );
        return actualizados;
      }
      setMensajeScrum("No hay insumos con stock positivo.");
      return prev;
    });
  };

  const restablecerStockOriginal = () => {
    setInsumos(datosPorDefecto);
    setMensajeScrum("[SCRUM] Catálogo restablecido con los valores estándar del sistema.");
  };

  return (
    <View style={estilos.contenedorPrincipal}>
      {/* =====================================================================
          BARRA SCRUM: Herramienta Interactiva de Verificación [FRONT-1]
          ===================================================================== */}
      {mostrarSimuladorScrum && (
        <View style={estilos.barraScrum}>
          <View style={estilos.scrumHeaderFila}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="flask-outline" size={18} color="#b45309" style={{ marginRight: 6 }} />
              <Text style={estilos.scrumTitulo}>[SCRUM] Verificación de Catálogo de Stock (FRONT-1)</Text>
            </View>
            <View style={estilos.scrumBadgesContenedor}>
              <View style={[estilos.miniBadge, { backgroundColor: "#fee2e2" }]}>
                <Text style={[estilos.miniBadgeTexto, { color: "#991b1b" }]}>
                  {estadisticas.sinStock} Agotados
                </Text>
              </View>
              <View style={[estilos.miniBadge, { backgroundColor: "#fef3c7" }]}>
                <Text style={[estilos.miniBadgeTexto, { color: "#92400e" }]}>
                  {estadisticas.bajoMinimo} Bajo Mínimo
                </Text>
              </View>
              <View style={[estilos.miniBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[estilos.miniBadgeTexto, { color: "#166534" }]}>
                  {estadisticas.conformes} Conformes
                </Text>
              </View>
            </View>
          </View>

          <Text style={estilos.scrumSubtitulo}>
            Comprueba el filtro en vivo al tipear y el resaltado automático en filas donde disponible &lt;= stock_mínimo.
          </Text>

          <View style={estilos.scrumBotonesFila}>
            <TouchableOpacity
              style={[estilos.botonScrumAccion, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}
              onPress={simularInsumoBajoMinimo}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={14} color="#92400e" style={{ marginRight: 4 }} />
              <Text style={[estilos.botonScrumTexto, { color: "#92400e" }]}>
                Dejar 1 insumo bajo el mínimo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[estilos.botonScrumAccion, { backgroundColor: "#fee2e2", borderColor: "#fecaca" }]}
              onPress={simularInsumoAgotado}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle-outline" size={14} color="#991b1b" style={{ marginRight: 4 }} />
              <Text style={[estilos.botonScrumTexto, { color: "#991b1b" }]}>
                Dejar 1 insumo en 0 (Crítico)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[estilos.botonScrumAccion, { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }]}
              onPress={restablecerStockOriginal}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={14} color="#475569" style={{ marginRight: 4 }} />
              <Text style={[estilos.botonScrumTexto, { color: "#475569" }]}>
                Restablecer Stock
              </Text>
            </TouchableOpacity>
          </View>

          {Boolean(mensajeScrum) && (
            <View style={estilos.cajaMensajeScrum}>
              <Ionicons name="information-circle" size={15} color="#1e40af" style={{ marginRight: 6 }} />
              <Text style={estilos.textoMensajeScrum}>{mensajeScrum}</Text>
            </View>
          )}
        </View>
      )}

      {/* =====================================================================
          TARJETA PRINCIPAL: CATÁLOGO DE STOCK
          ===================================================================== */}
      <View style={estilos.tarjetaCatalogo}>
        {/* Encabezado y Barra de Filtro en Vivo */}
        <View style={estilos.encabezadoBarra}>
          <View style={{ flex: 1, minWidth: 200, marginBottom: esDesktop ? 0 : 12 }}>
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
              placeholder="Buscar por SKU o nombre..."
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

        {/* Chips de Filtro Rápido */}
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
              ⚠️ Críticos / Bajo Mínimo ({estadisticas.totalCriticos})
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
            TABLA RESPONSIVA DE INSUMOS CON RESALTADO AUTOMÁTICO
            ===================================================================== */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={estilos.scrollHorizontal}>
          <View style={estilos.contenedorTabla}>
            {/* Cabecera de la Tabla */}
            <View style={estilos.filaCabecera}>
              <Text style={[estilos.textoTh, estilos.colSku]}>SKU</Text>
              <Text style={[estilos.textoTh, estilos.colNombre]}>Insumo / Descripción</Text>
              <Text style={[estilos.textoTh, estilos.colDisponible, { textAlign: "center" }]}>Disponible</Text>
              <Text style={[estilos.textoTh, estilos.colStockMinimo, { textAlign: "center" }]}>Stock Mínimo</Text>
              <Text style={[estilos.textoTh, estilos.colPmp, { textAlign: "right" }]}>PMP ($)</Text>
              <Text style={[estilos.textoTh, estilos.colAlerta, { textAlign: "center" }]}>Estado Alerta</Text>
            </View>

            {/* Filas de la Tabla */}
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
  encabezadoBarra: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  tituloPrincipal: {
    fontSize: 20,
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
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  chipFiltro: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipFiltroActivo: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  chipFiltroTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  chipFiltroTextoActivo: {
    color: "#ffffff",
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
