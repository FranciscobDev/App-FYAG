import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/core/format";
import { theme } from "@/core/theme";
import { Badge } from "@/components/common/Badge";
import { Card } from "@/components/common/Card";

export const TechnicianProfileScreen: React.FC = () => {
  const { user } = useAuth();
  const { projects, tools } = useApp();

  const myProjects = projects.filter((p) => p.technicianRuts.includes(user.rut));
  const myTools = tools.filter((t) => t.currentTechnicianRut === user.rut);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card variant="elevated" style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user.initials}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userRole}>Técnico de Terreno • SEC Clase A</Text>
        <Text style={styles.userRut}>RUT: {user.rut}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </Card>

      <Text style={styles.sectionHeading}>Herramientas Actualmente en mi Poder ({myTools.length})</Text>
      {myTools.length === 0 ? (
        <Card variant="outlined">
          <Text style={styles.emptyNote}>No tienes herramientas prestadas activas en este momento.</Text>
        </Card>
      ) : (
        myTools.map((t) => (
          <Card key={t.id} variant="default" style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View>
                <Text style={styles.toolCode}>{t.code}</Text>
                <Text style={styles.toolName}>{t.name}</Text>
                <Text style={styles.toolMeta}>
                  {t.brand} {t.model} • Préstamo: {formatDate(t.currentLoanDate || "")}
                </Text>
              </View>
              <Badge label="En mi poder" tone="info" size="sm" />
            </View>
          </Card>
        ))
      )}

      <Text style={[styles.sectionHeading, { marginTop: 16 }]}>Obras Asignadas ({myProjects.length})</Text>
      {myProjects.length === 0 ? (
        <Card variant="outlined">
          <Text style={styles.emptyNote}>No tienes obras asignadas actualmente.</Text>
        </Card>
      ) : (
        myProjects.map((p) => (
          <Card key={p.id} variant="default" style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View>
                <Text style={styles.toolCode}>{p.code}</Text>
                <Text style={styles.toolName}>{p.name}</Text>
                <Text style={styles.toolMeta}>Cliente: {p.client}</Text>
              </View>
              <Badge label={`${p.progress}% Avance`} tone="ok" size="sm" />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userName: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  userRole: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    fontWeight: "600",
    marginTop: 2,
  },
  userRut: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  userEmail: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  itemCard: {
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toolCode: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
  },
  toolName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
    marginVertical: 1,
  },
  toolMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  emptyNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 4,
  },
});
