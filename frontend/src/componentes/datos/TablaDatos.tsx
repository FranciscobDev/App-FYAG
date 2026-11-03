import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";

export interface ColumnaTabla<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface PropiedadesTablaDatos<T> {
  columns: ColumnaTabla<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowPress?: (item: T) => void;
  selectedId?: string;
  pageSize?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  filterPredicate?: (item: T, query: string) => boolean;
  cardRender?: (item: T, index: number) => React.ReactNode;
  emptyText?: string;
  emptyActionTitle?: string;
  onEmptyAction?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TablaDatos<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowPress,
  selectedId,
  pageSize = 6,
  showSearch = true,
  searchPlaceholder = "Buscar en la tabla...",
  filterPredicate,
  cardRender,
  emptyText = "No se encontraron registros",
  emptyActionTitle,
  onEmptyAction,
  containerStyle,
}: PropiedadesTablaDatos<T>) {
  const { width } = useWindowDimensions();
  const esMobile = width < 680;

  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [ordenarClave, establecerOrdenarClave] = useState<string | null>(null);
  const [ordenarOrden, establecerOrdenarOrden] = useState<"asc" | "desc">("asc");
  const [pagina, establecerPagina] = useState(1);

  // 1. Filter
  const filtradoDatos = useMemo(() => {
    if (!buscarQuery.trim()) return data;
    const q = buscarQuery.toLowerCase().trim();
    if (filterPredicate) {
      return data.filter((item) => filterPredicate(item, q));
    }
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(q)
      )
    );
  }, [data, buscarQuery, filterPredicate]);

  // 2. Sort
  const ordenadoDatos = useMemo(() => {
    if (!ordenarClave) return filtradoDatos;
    return [...filtradoDatos].sort((a, b) => {
      const valorA = a[ordenarClave];
      const valorB = b[ordenarClave];
      if (valorA === valorB) return 0;
      if (valorA === undefined || valorA === null) return 1;
      if (valorB === undefined || valorB === null) return -1;
      const compare = valorA > valorB ? 1 : -1;
      return ordenarOrden === "asc" ? compare : -compare;
    });
  }, [filtradoDatos, ordenarClave, ordenarOrden]);

  // 3. Pagination
  const totalPages = Math.max(1, Math.ceil(ordenadoDatos.length / pageSize));
  const actualPagina = Math.min(pagina, totalPages);
  const paginatedDatos = useMemo(() => {
    const iniciar = (actualPagina - 1) * pageSize;
    return ordenadoDatos.slice(iniciar, iniciar + pageSize);
  }, [ordenadoDatos, actualPagina, pageSize]);

  const manejarOrdenar = (colKey: string) => {
    if (ordenarClave === colKey) {
      establecerOrdenarOrden(ordenarOrden === "asc" ? "desc" : "asc");
    } else {
      establecerOrdenarClave(colKey);
      establecerOrdenarOrden("asc");
    }
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Barra de Búsqueda de la Tabla */}
      {showSearch && (
        <View style={estilos.buscarBarra}>
          <CampoBusqueda
            value={buscarQuery}
            onChangeText={(text) => {
              establecerBuscarQuery(text);
              establecerPagina(1);
            }}
            placeholder={searchPlaceholder}
          />
        </View>
      )}

      {/* VERSIÓN MÓVIL: Tarjetas Adaptativas */}
      {esMobile ? (
        <View style={estilos.tarjetaLista}>
          {paginatedDatos.length === 0 ? (
            <EstadoVacio
              icon="file-tray-outline"
              title={emptyText}
              description={buscarQuery ? `No hay resultados para "${buscarQuery}".` : undefined}
              actionTitle={emptyActionTitle}
              onAction={onEmptyAction}
              containerStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingVertical: 24 }}
            />
          ) : (
            paginatedDatos.map((item, idx) => {
              const id = keyExtractor(item, idx);
              const esSeleccionado = id === selectedId;

              if (cardRender) {
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => onRowPress && onRowPress(item)}
                    activeOpacity={onRowPress ? 0.7 : 1}
                    style={[estilos.mobileTarjeta, esSeleccionado && estilos.filaSeleccionado]}
                  >
                    {cardRender(item, idx)}
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => onRowPress && onRowPress(item)}
                  activeOpacity={onRowPress ? 0.7 : 1}
                  style={[estilos.mobileTarjeta, esSeleccionado && estilos.filaSeleccionado]}
                >
                  {columns.map((col) => (
                    <View key={String(col.key)} style={estilos.tarjetaCampoFila}>
                      <Text style={estilos.tarjetaCampoEtiqueta}>{col.title}:</Text>
                      <View style={estilos.tarjetaCampoValor}>
                        {col.render
                          ? col.render(item, idx)
                          : <Text style={estilos.celdaTexto}>{String(item[col.key as any] ?? "-")}</Text>}
                      </View>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        /* VERSIÓN ESCRITORIO / TABLET: Tabla Densa */
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={estilos.tablaScroll}>
          <View style={estilos.tabla}>
            {/* Header de la Tabla */}
            <View style={estilos.tablaEncabezadoFila}>
              {columns.map((col) => {
                const esActualOrdenar = ordenarClave === col.key;
                return (
                  <TouchableOpacity
                    key={String(col.key)}
                    onPress={() => col.sortable !== false && manejarOrdenar(String(col.key))}
                    disabled={col.sortable === false}
                    style={[
                      estilos.tablaEncabezadoCelda,
                      col.width ? { width: col.width } : { flex: 1, minWidth: 120 },
                    ]}
                  >
                    <Text style={estilos.tablaEncabezadoTexto}>{col.title}</Text>
                    {col.sortable !== false && (
                      <Ionicons
                        name={
                          esActualOrdenar
                            ? ordenarOrden === "asc"
                              ? "arrow-up"
                              : "arrow-down"
                            : "swap-vertical"
                        }
                        size={14}
                        color={esActualOrdenar ? tema.colors.primary : tema.colors.textMuted}
                        style={estilos.ordenarIcono}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filas */}
            {paginatedDatos.length === 0 ? (
              <EstadoVacio
                icon="file-tray-outline"
                title={emptyText}
                description={buscarQuery ? `No hay resultados para "${buscarQuery}".` : undefined}
                actionTitle={emptyActionTitle}
                onAction={onEmptyAction}
                containerStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingVertical: 28 }}
              />
            ) : (
              paginatedDatos.map((item, idx) => {
                const id = keyExtractor(item, idx);
                const isSelected = id === selectedId;

                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => onRowPress && onRowPress(item)}
                    activeOpacity={onRowPress ? 0.7 : 1}
                    style={[
                      estilos.tablaFila,
                      idx % 2 === 1 && estilos.tablaFilaAlt,
                      isSelected && estilos.filaSeleccionado,
                    ]}
                  >
                    {columns.map((col) => (
                      <View
                        key={String(col.key)}
                        style={[
                          estilos.tablaCelda,
                          col.width ? { width: col.width } : { flex: 1, minWidth: 120 },
                        ]}
                      >
                        {col.render ? (
                          col.render(item, idx)
                        ) : (
                          <Text style={estilos.celdaTexto} numberOfLines={1}>
                            {String(item[col.key as any] ?? "-")}
                          </Text>
                        )}
                      </View>
                    ))}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Paginación */}
      <View style={estilos.paginationFila}>
        <Text style={estilos.paginationInfo}>
          Mostrando {paginatedDatos.length > 0 ? (actualPagina - 1) * pageSize + 1 : 0}–
          {Math.min(actualPagina * pageSize, ordenadoDatos.length)} de {ordenadoDatos.length} registros
        </Text>

        <View style={estilos.paginationControls}>
          <TouchableOpacity
            onPress={() => establecerPagina((p) => Math.max(1, p - 1))}
            disabled={actualPagina <= 1}
            style={[estilos.paginaBoton, actualPagina <= 1 && estilos.paginaBotonDeshabilitado]}
            accessibilityLabel="Página anterior"
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={actualPagina <= 1 ? tema.colors.textMuted : tema.colors.primaryDark}
            />
          </TouchableOpacity>

          <Text style={estilos.paginaIndicator}>
            {actualPagina} / {totalPages}
          </Text>

          <TouchableOpacity
            onPress={() => establecerPagina((p) => Math.min(totalPages, p + 1))}
            disabled={actualPagina >= totalPages}
            style={[estilos.paginaBoton, actualPagina >= totalPages && estilos.paginaBotonDeshabilitado]}
            accessibilityLabel="Página siguiente"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={actualPagina >= totalPages ? tema.colors.textMuted : tema.colors.primaryDark}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
    overflow: "hidden",
    marginBottom: tema.spacing.md,
  },
  buscarBarra: {
    padding: tema.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  tablaScroll: {
    width: "100%",
  },
  tabla: {
    minWidth: "100%",
  },
  tablaEncabezadoFila: {
    flexDirection: "row",
    backgroundColor: tema.colors.surfaceAlt,
    borderBottomWidth: 1.5,
    borderBottomColor: tema.colors.border,
  },
  tablaEncabezadoCelda: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: tema.spacing.md,
  },
  tablaEncabezadoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: tema.colors.textMuted,
  },
  ordenarIcono: {
    marginLeft: 4,
  },
  tablaFila: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    alignItems: "center",
    minHeight: 46,
  },
  tablaFilaAlt: {
    backgroundColor: tema.colors.surfaceAlt,
  },
  filaSeleccionado: {
    backgroundColor: tema.colors.primaryLight,
  },
  tablaCelda: {
    paddingVertical: 10,
    paddingHorizontal: tema.spacing.md,
    justifyContent: "center",
  },
  celdaTexto: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
  },
  tarjetaLista: {
    padding: tema.spacing.md,
  },
  mobileTarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.sm,
    ...tema.shadows.sm,
  },
  tarjetaCampoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  tarjetaCampoEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.textMuted,
    marginRight: 8,
  },
  tarjetaCampoValor: {
    alignItems: "flex-end",
    flex: 1,
  },
  vacioCaja: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  vacioTexto: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textMuted,
    marginTop: 8,
  },
  paginationFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
    flexWrap: "wrap",
  },
  paginationInfo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  paginationControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  paginaBoton: {
    minWidth: tema.touchTargets.minHeight, // Mínimo 44 px accesible
    minHeight: tema.touchTargets.minHeight,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  paginaBotonDeshabilitado: {
    opacity: 0.4,
  },
  paginaIndicator: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    marginHorizontal: 12,
  },
});
