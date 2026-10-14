import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/core/theme";
import { useApp } from "@/context/AppContext";
import { NotificationDetail } from "@/core/types";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timeStr: string;
  read: boolean;
  type: "warn" | "ok" | "info" | "danger";
  category?: "costo" | "stock" | "plazo" | "solicitud" | "sistema";
  relatedEntityType?: "proyecto" | "solicitud" | "insumo" | "orden_compra" | "herramienta";
  relatedEntityId?: string;
  relatedEntityLabel?: string;
}

export interface NotificationBellProps {
  notifications?: NotificationItem[];
  onMarkAllRead?: () => void;
  onNavigateToObject?: (entityType: string, entityId: string) => void;
  style?: StyleProp<ViewStyle>;
}

type FilterType = "todas" | "stock" | "costo" | "plazo" | "solicitud" | "sistema";

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications: propNotifications,
  onMarkAllRead: propOnMarkAllRead,
  onNavigateToObject,
  style,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FilterType>("todas");

  // Consume from AppContext if available
  let appContext: ReturnType<typeof useApp> | null = null;
  try {
    appContext = useApp();
  } catch {
    // If rendered outside AppProvider (e.g. standalone test)
    appContext = null;
  }

  const rawNotifications: NotificationDetail[] = appContext
    ? appContext.notificationsList
    : (propNotifications || []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        date: n.timeStr,
        type: n.category || "sistema",
        severity: n.type,
        read: n.read,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
        relatedEntityLabel: n.relatedEntityLabel,
      }));

  const unreadCount = rawNotifications.filter((n) => !n.read).length;

  const filteredNotifications = rawNotifications.filter((item) => {
    if (selectedType === "todas") return true;
    return item.type === selectedType;
  });

  const handleMarkAll = () => {
    if (appContext) {
      appContext.markAllNotificationsRead();
    }
    if (propOnMarkAllRead) {
      propOnMarkAllRead();
    }
  };

  const handleItemPress = (item: NotificationDetail) => {
    if (!item.read && appContext) {
      appContext.markNotificationRead(item.id);
    }
    if (item.relatedEntityType && item.relatedEntityId && onNavigateToObject) {
      setModalOpen(false);
      onNavigateToObject(item.relatedEntityType, item.relatedEntityId);
    }
  };

  const handleEntityLink = (item: NotificationDetail) => {
    if (!item.read && appContext) {
      appContext.markNotificationRead(item.id);
    }
    setModalOpen(false);
    if (item.relatedEntityType && item.relatedEntityId && onNavigateToObject) {
      onNavigateToObject(item.relatedEntityType, item.relatedEntityId);
    }
  };

  const getTypeBadgeConfig = (type: NotificationDetail["type"]) => {
    switch (type) {
      case "stock":
        return { label: "Stock", color: theme.colors.warnDark, bg: theme.colors.warnLight, icon: "cube-outline" as const };
      case "costo":
        return { label: "Costo", color: theme.colors.danger, bg: theme.colors.dangerLight, icon: "cash-outline" as const };
      case "plazo":
        return { label: "Plazos", color: "#b45309", bg: "#fef3c7", icon: "time-outline" as const };
      case "solicitud":
        return { label: "Solicitud", color: theme.colors.primaryDark, bg: theme.colors.primaryLight, icon: "document-text-outline" as const };
      case "sistema":
      default:
        return { label: "Sistema", color: "#475569", bg: "#f1f5f9", icon: "settings-outline" as const };
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        style={[styles.bellBtn, style]}
        activeOpacity={0.7}
        accessibilityLabel={`Notificaciones, ${unreadCount} no leídas`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal de Notificaciones */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            {/* Encabezado */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="notifications" size={20} color={theme.colors.primary} />
                <Text style={styles.headerTitle}>Notificaciones</Text>
                {unreadCount > 0 ? (
                  <View style={styles.counterChip}>
                    <Text style={styles.counterText}>{unreadCount} no leídas</Text>
                  </View>
                ) : (
                  <View style={[styles.counterChip, { backgroundColor: theme.colors.okLight }]}>
                    <Text style={[styles.counterText, { color: theme.colors.ok }]}>Al día</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Filtros por Tipo de Notificación */}
            <View style={styles.filterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {[
                  { id: "todas", label: "Todas" },
                  { id: "stock", label: "Stock" },
                  { id: "solicitud", label: "Solicitudes" },
                  { id: "costo", label: "Costo" },
                  { id: "plazo", label: "Plazos" },
                  { id: "sistema", label: "Sistema" },
                ].map((f) => {
                  const isActive = selectedType === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setSelectedType(f.id as FilterType)}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Lista de Notificaciones */}
            <ScrollView style={styles.list}>
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="notifications-off-outline" size={36} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>No hay notificaciones en esta categoría</Text>
                </View>
              ) : (
                filteredNotifications.map((item) => {
                  const badgeCfg = getTypeBadgeConfig(item.type);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemRow,
                        !item.read && styles.itemRowUnread,
                      ]}
                      onPress={() => handleItemPress(item)}
                      activeOpacity={0.8}
                    >
                      {/* Indicador de no leída */}
                      <View style={styles.unreadIndicatorBox}>
                        {!item.read && <View style={styles.unreadDot} />}
                      </View>

                      {/* Ícono de tipo */}
                      <View style={[styles.itemIconBox, { backgroundColor: badgeCfg.bg }]}>
                        <Ionicons name={badgeCfg.icon} size={18} color={badgeCfg.color} />
                      </View>

                      {/* Información de notificación */}
                      <View style={styles.itemInfo}>
                        <View style={styles.itemTopRow}>
                          <View style={styles.titleWithBadge}>
                            <View style={[styles.typeMiniBadge, { backgroundColor: badgeCfg.bg }]}>
                              <Text style={[styles.typeMiniBadgeText, { color: badgeCfg.color }]}>
                                {badgeCfg.label}
                              </Text>
                            </View>
                            <Text style={styles.itemTime}>{item.date}</Text>
                          </View>
                        </View>

                        <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}>
                          {item.title}
                        </Text>
                        <Text style={styles.itemMessage}>{item.message}</Text>

                        {/* Enlace al objeto relacionado */}
                        {item.relatedEntityType && item.relatedEntityId && (
                          <TouchableOpacity
                            style={styles.relatedLinkBtn}
                            onPress={() => handleEntityLink(item)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="open-outline" size={13} color={theme.colors.primary} />
                            <Text style={styles.relatedLinkText}>
                              {item.relatedEntityLabel || `Ver ${item.relatedEntityType}: ${item.relatedEntityId}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Pie con botón de marcar todas */}
            <View style={styles.footer}>
              {unreadCount > 0 ? (
                <TouchableOpacity
                  onPress={handleMarkAll}
                  style={styles.markAllBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.markAllText}>Marcar todas como leídas</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.allReadText}>Todas las alertas han sido revisadas</Text>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellBtn: {
    padding: 6,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 16,
  },
  modalCard: {
    width: 380,
    maxWidth: "94%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    maxHeight: 520,
    ...theme.shadows.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.text,
    marginLeft: 6,
  },
  counterChip: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginLeft: 8,
  },
  counterText: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  filterBar: {
    backgroundColor: theme.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingVertical: 6,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.sm,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  list: {
    maxHeight: 360,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: "row",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    alignItems: "flex-start",
  },
  itemRowUnread: {
    backgroundColor: "#f0fdfa",
  },
  unreadIndicatorBox: {
    width: 10,
    paddingTop: 8,
    alignItems: "center",
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  itemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    marginBottom: 4,
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeMiniBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  itemTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 2,
  },
  itemTitleUnread: {
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  itemMessage: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  relatedLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
  },
  relatedLinkText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "center",
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  allReadText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: "italic",
  },
});
