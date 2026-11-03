import { Platform, StyleSheet } from "react-native";
import { tema } from "@/nucleo/tema";

export const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollContenedor: {
    flex: 1,
  },
  scrollContenido: {
    padding: tema.spacing.lg,
    paddingBottom: 40,
  },

  // KPI Grid
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: tema.spacing.md,
  },
  kpiColumna: {
    flex: 1,
    minWidth: 220,
  },

  // Subcategory Tabs
  pestanaScrollCaja: {
    marginBottom: tema.spacing.md,
  },
  pestanaBarraContenido: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  pestanaBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    minHeight: 44,
  },
  pestanaBotonActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  pestanaBotonTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  pestanaBotonTextoActivo: {
    color: "#ffffff",
    fontWeight: tema.fontWeight.bold,
  },
  pestanaInsignia: {
    marginLeft: 8,
    backgroundColor: tema.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
  },
  pestanaInsigniaActivo: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  pestanaInsigniaTexto: {
    fontSize: 10,
    fontWeight: tema.fontWeight.bold,
    color: tema.colors.textMuted,
  },
  pestanaInsigniaTextoActivo: {
    color: "#ffffff",
  },

  // Filters Card
  filtrarTarjeta: {
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
  },
  filtrarEncabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  filtrarTarjetaTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.bold,
    color: tema.colors.text,
  },
  filtrarCamposFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  buscarCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    height: 44,
    flex: 1,
    minWidth: 260,
  },
  buscarEntrada: {
    flex: 1,
    marginLeft: 8,
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
  },
  periodFila: {
    flexDirection: "row",
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: tema.colors.border,
    gap: 4,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.xs,
  },
  periodChipActivo: {
    backgroundColor: tema.colors.primary,
  },
  periodChipTexto: {
    fontSize: 11,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  periodChipTextoActivo: {
    color: "#ffffff",
    fontWeight: tema.fontWeight.bold,
  },
  secundarioFiltrarFila: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    paddingTop: 10,
  },
  chipsScrollEnvoltorio: {
    gap: 6,
  },
  filtrarSubtitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 4,
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.xs,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginRight: 6,
  },
  subChipActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  subChipTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  subChipTextoActivo: {
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },

  // Content Card
  contenidoTarjeta: {
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
  },
  tablaTarjetaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  tablaTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: tema.fontWeight.bold,
    color: tema.colors.text,
  },
  tablaSubtitulo: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  vistaModoAlternar: {
    flexDirection: "row",
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  vistaModoBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.xs,
  },
  vistaModoBotonActivo: {
    backgroundColor: tema.colors.primary,
  },
  vistaModoBotonTexto: {
    fontSize: 11,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textSecondary,
  },
  vistaModoBotonTextoActivo: {
    color: "#ffffff",
    fontWeight: tema.fontWeight.bold,
  },

  // Responsive Cards View
  tarjetasLista: {
    gap: 12,
  },
  reporteTarjeta: {
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 14,
    ...tema.shadows.sm,
  },
  reporteTarjetaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 6,
  },
  tarjetaElementoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.bold,
    color: tema.colors.text,
  },
  tarjetaElementoSub: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  tarjetaDivisor: {
    height: 1,
    backgroundColor: tema.colors.borderLight,
    marginVertical: 10,
  },
  tarjetaStatsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tarjetaStatEtiqueta: {
    fontSize: 10,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  tarjetaStatValor: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    marginTop: 2,
  },

  // Table View
  tablaEncabezadoFila: {
    flexDirection: "row",
    backgroundColor: tema.colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tema.radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    alignItems: "center",
  },
  thCelda: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textSecondary,
    textTransform: "uppercase",
  },
  tablaFila: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    alignItems: "center",
  },
  tdCelda: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
  },
  filaPrincipalTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  filaSubTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  totalsFila: {
    flexDirection: "row",
    backgroundColor: tema.colors.surfaceAlt,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 2,
    borderTopColor: tema.colors.border,
    alignItems: "center",
    marginTop: 4,
    borderRadius: tema.radius.xs,
  },
  totalsTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
    textTransform: "uppercase",
  },
  totalsCelda: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  totalsCeldaBold: {
    fontSize: 12,
    color: tema.colors.text,
    fontWeight: "bold",
  },
});

