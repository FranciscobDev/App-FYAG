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
import { theme } from "@/core/theme";
import { EmptyState } from "./EmptyState";
import { SearchInput } from "./SearchInput";

export interface Column<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
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

export function DataTable<T extends Record<string, any>>({
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
}: DataTableProps<T>) {
  const { width } = useWindowDimensions();
  const isMobile = width < 680;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // 1. Filter
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    if (filterPredicate) {
      return data.filter((item) => filterPredicate(item, q));
    }
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchQuery, filterPredicate]);

  // 2. Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const compare = valA > valB ? 1 : -1;
      return sortOrder === "asc" ? compare : -compare;
    });
  }, [filteredData, sortKey, sortOrder]);

  // 3. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(colKey);
      setSortOrder("asc");
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Barra de Búsqueda de la Tabla */}
      {showSearch && (
        <View style={styles.searchBar}>
          <SearchInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
          />
        </View>
      )}

      {/* VERSIÓN MÓVIL: Tarjetas Adaptativas */}
      {isMobile ? (
        <View style={styles.cardList}>
          {paginatedData.length === 0 ? (
            <EmptyState
              icon="file-tray-outline"
              title={emptyText}
              description={searchQuery ? `No hay resultados para "${searchQuery}".` : undefined}
              actionTitle={emptyActionTitle}
              onAction={onEmptyAction}
              containerStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingVertical: 24 }}
            />
          ) : (
            paginatedData.map((item, idx) => {
              const id = keyExtractor(item, idx);
              const isSelected = id === selectedId;

              if (cardRender) {
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => onRowPress && onRowPress(item)}
                    activeOpacity={onRowPress ? 0.7 : 1}
                    style={[styles.mobileCard, isSelected && styles.rowSelected]}
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
                  style={[styles.mobileCard, isSelected && styles.rowSelected]}
                >
                  {columns.map((col) => (
                    <View key={String(col.key)} style={styles.cardFieldRow}>
                      <Text style={styles.cardFieldLabel}>{col.title}:</Text>
                      <View style={styles.cardFieldValue}>
                        {col.render
                          ? col.render(item, idx)
                          : <Text style={styles.cellText}>{String(item[col.key as any] ?? "-")}</Text>}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={styles.table}>
            {/* Header de la Tabla */}
            <View style={styles.tableHeaderRow}>
              {columns.map((col) => {
                const isCurrentSort = sortKey === col.key;
                return (
                  <TouchableOpacity
                    key={String(col.key)}
                    onPress={() => col.sortable !== false && handleSort(String(col.key))}
                    disabled={col.sortable === false}
                    style={[
                      styles.tableHeaderCell,
                      col.width ? { width: col.width } : { flex: 1, minWidth: 120 },
                    ]}
                  >
                    <Text style={styles.tableHeaderText}>{col.title}</Text>
                    {col.sortable !== false && (
                      <Ionicons
                        name={
                          isCurrentSort
                            ? sortOrder === "asc"
                              ? "arrow-up"
                              : "arrow-down"
                            : "swap-vertical"
                        }
                        size={14}
                        color={isCurrentSort ? theme.colors.primary : theme.colors.textMuted}
                        style={styles.sortIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filas */}
            {paginatedData.length === 0 ? (
              <EmptyState
                icon="file-tray-outline"
                title={emptyText}
                description={searchQuery ? `No hay resultados para "${searchQuery}".` : undefined}
                actionTitle={emptyActionTitle}
                onAction={onEmptyAction}
                containerStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingVertical: 28 }}
              />
            ) : (
              paginatedData.map((item, idx) => {
                const id = keyExtractor(item, idx);
                const isSelected = id === selectedId;

                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => onRowPress && onRowPress(item)}
                    activeOpacity={onRowPress ? 0.7 : 1}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && styles.tableRowAlt,
                      isSelected && styles.rowSelected,
                    ]}
                  >
                    {columns.map((col) => (
                      <View
                        key={String(col.key)}
                        style={[
                          styles.tableCell,
                          col.width ? { width: col.width } : { flex: 1, minWidth: 120 },
                        ]}
                      >
                        {col.render ? (
                          col.render(item, idx)
                        ) : (
                          <Text style={styles.cellText} numberOfLines={1}>
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
      <View style={styles.paginationRow}>
        <Text style={styles.paginationInfo}>
          Mostrando {paginatedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length} registros
        </Text>

        <View style={styles.paginationControls}>
          <TouchableOpacity
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            accessibilityLabel="Página anterior"
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={currentPage <= 1 ? theme.colors.textMuted : theme.colors.primaryDark}
            />
          </TouchableOpacity>

          <Text style={styles.pageIndicator}>
            {currentPage} / {totalPages}
          </Text>

          <TouchableOpacity
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            accessibilityLabel="Página siguiente"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={currentPage >= totalPages ? theme.colors.textMuted : theme.colors.primaryDark}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
  },
  searchBar: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableScroll: {
    width: "100%",
  },
  table: {
    minWidth: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceAlt,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  tableHeaderText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
  },
  sortIcon: {
    marginLeft: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    alignItems: "center",
    minHeight: 46,
  },
  tableRowAlt: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  rowSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
  },
  cellText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  cardList: {
    padding: theme.spacing.md,
  },
  mobileCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  cardFieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  cardFieldLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginRight: 8,
  },
  cardFieldValue: {
    alignItems: "flex-end",
    flex: 1,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    flexWrap: "wrap",
  },
  paginationInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  paginationControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  pageBtn: {
    minWidth: theme.touchTargets.minHeight, // Mínimo 44 px accesible
    minHeight: theme.touchTargets.minHeight,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginHorizontal: 12,
  },
});
