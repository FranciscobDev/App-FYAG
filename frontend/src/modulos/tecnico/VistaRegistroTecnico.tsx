import React, { useState, useEffect } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearFecha, formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { PantallaDevoluciones } from "@/modulos/devoluciones/PantallaDevoluciones";
<<<<<<< HEAD
import { HoraTrabajoTecnico } from "@/nucleo/tipos";
import { FormularioReporteAvance } from "@/componentes/FormularioReporteAvance";
=======
import { SeccionCronometroHorasTecnico } from "./SeccionCronometroHorasTecnico";
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec

interface TechnicianRegisterViewProps {
  initialSubTab?: "avance" | "horas" | "sobrante";
  initialProjectId?: string;
  isOffline?: boolean;
  onCambioConexion?: (sinConexion: boolean) => void;
}

export const VistaRegistroTecnico: React.FC<TechnicianRegisterViewProps> = ({
  initialSubTab = "avance",
  initialProjectId,
  isOffline = false,
  onCambioConexion,
}) => {
  const {
    proyectos,
    reportesAvanceTecnico,
    crearReporteAvanceTecnico,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const [activoSubPestana, establecerActivoSubPestana] = useState<"avance" | "horas" | "sobrante">(initialSubTab);

  useEffect(() => {
    establecerActivoSubPestana(initialSubTab);
  }, [initialSubTab]);

  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || activoProyectos[0]?.id || ""
  );

  useEffect(() => {
<<<<<<< HEAD
    if (initialSubTab) {
      establecerActivoSubPestana(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
=======
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
    if (initialProjectId) {
      establecerSeleccionadoProyectoId(initialProjectId);
    }
  }, [initialProjectId]);

  const actualProyecto = activoProyectos.find((p) => p.id === seleccionadoProyectoId) || activoProyectos[0];

  // =========================================================================
  // 1. REGISTRAR AVANCE (0-100%, SLIDER + NÚMERO, COMENTARIOS, MATERIALES SIN EGRESO)
  // =========================================================================
  const [avancePorcentaje, establecerAvancePorcentaje] = useState<number>(actualProyecto?.progress || 50);
  const [avanceComentarios, establecerAvanceComentarios] = useState<string>(
    "Avance en montaje de tuberías y sellado de pasadas en muros cortafuego."
  );
  const [usadoMateriales, establecerUsadoMateriales] = useState<
    { sku: string; name: string; quantity: number; unit: string }[]
  >([
    { sku: "GAS-TUB-0020", name: "Tubo cobre tipo L 3/4\" 6 m", quantity: 6, unit: "un" },
    { sku: "ELE-CBL-0012", name: "Cable THHN 12 AWG", quantity: 1, unit: "rollo" },
  ]);
  const [avanceExito, establecerAvanceExito] = useState<string>("");

  const manejarAjustarPorcentaje = (delta: number) => {
    establecerAvancePorcentaje((prev) => Math.max(0, Math.min(100, prev + delta)));
  };

  const manejarGuardarAvance = () => {
    if (!actualProyecto) return;
    crearReporteAvanceTecnico({
      projectId: actualProyecto.id,
      projectCode: actualProyecto.code,
      projectName: actualProyecto.name,
      date: new Date().toISOString().slice(0, 10),
      progressPct: avancePorcentaje,
      comments: avanceComentarios.trim() || "Reporte de avance en terreno.",
      materialsUsed: usadoMateriales,
    });
    establecerAvanceExito(`✓ Avance del ${avancePorcentaje}% guardado correctamente para ${actualProyecto.code}.`);
    setTimeout(() => establecerAvanceExito(""), 4000);
  };

  const manejarAjustarMaterialCantidad = (idx: number, delta: number) => {
    establecerUsadoMateriales((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it))
    );
  };

  return (
    <View style={estilos.contenedor}>
      {/* ========================================================================= */}
      {/* SELECTOR DE PESTAÑAS SUPERIOR (MOBILE)                                    */}
      {/* ========================================================================= */}
      <View style={estilos.subPestanaBarra}>
        <TouchableOpacity
          onPress={() => establecerActivoSubPestana("avance")}
          style={[estilos.subPestanaElemento, activoSubPestana === "avance" && estilos.subPestanaElementoActivo]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trending-up-outline"
            size={16}
            color={activoSubPestana === "avance" ? "#ffffff" : "#a8a29e"}
          />
          <Text style={[estilos.subPestanaEtiqueta, activoSubPestana === "avance" && estilos.subPestanaEtiquetaActivo]}>
            Avance (0-100%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => establecerActivoSubPestana("horas")}
          style={[estilos.subPestanaElemento, activoSubPestana === "horas" && estilos.subPestanaElementoActivo]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activoSubPestana === "horas" ? "#ffffff" : "#a8a29e"}
          />
          <Text style={[estilos.subPestanaEtiqueta, activoSubPestana === "horas" && estilos.subPestanaEtiquetaActivo]}>
            Horas (HH)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => establecerActivoSubPestana("sobrante")}
          style={[estilos.subPestanaElemento, activoSubPestana === "sobrante" && estilos.subPestanaElementoActivo]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="return-down-back-outline"
            size={16}
            color={activoSubPestana === "sobrante" ? "#ffffff" : "#a8a29e"}
          />
          <Text style={[estilos.subPestanaEtiqueta, activoSubPestana === "sobrante" && estilos.subPestanaEtiquetaActivo]}>
            Devolver Sobrante
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. REGISTRAR AVANCE                                                       */}
      {/* ========================================================================= */}
      {activoSubPestana === "avance" && (
        <FormularioReporteAvance
          proyectoInicialId={seleccionadoProyectoId}
          mostrarHistorial={true}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. REGISTRAR HORAS (CRONÓMETRO AUTOMÁTICO OFFLINE + BLOQUES 0,5 h + H41)  */}
      {/* ========================================================================= */}
      {activoSubPestana === "horas" && (
        <SeccionCronometroHorasTecnico
          activoProyectos={activoProyectos}
          actualProyecto={actualProyecto}
          establecerSeleccionadoProyectoId={establecerSeleccionadoProyectoId}
          isOffline={isOffline}
          onCambioConexion={onCambioConexion}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. DEVOLVER SOBRANTE (INTEGRA RETURNSSCREEN DEL PASO 9)                    */}
      {/* ========================================================================= */}
      {activoSubPestana === "sobrante" && (
        <View style={{ flex: 1 }}>
          <PantallaDevoluciones showHeader={false} />
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  subPestanaBarra: {
    flexDirection: "row",
    backgroundColor: "#292524",
    padding: 3,
    marginHorizontal: tema.spacing.md,
    marginTop: tema.spacing.sm,
    marginBottom: tema.spacing.xs,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  subPestanaElemento: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: tema.radius.full,
  },
  subPestanaElementoActivo: {
    backgroundColor: tema.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  subPestanaEtiqueta: {
    fontSize: tema.fontSize.xs,
    color: "#a8a29e",
    fontWeight: "600",
    marginLeft: 4,
  },
  subPestanaEtiquetaActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  cuerpoScroll: {
    flex: 1,
  },
  cuerpoContenido: {
    padding: tema.spacing.md,
    paddingBottom: 110,
  },
  campoEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipsScroll: {
    marginBottom: tema.spacing.md,
  },
  chipBoton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
  },
  chipBotonActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  chipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    fontWeight: "500",
  },
  chipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  avanceEncabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 6,
  },
  tarjetaEncabezado: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tarjetaSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  deslizadorCaja: {
    backgroundColor: tema.colors.surface,
    padding: 12,
    borderRadius: tema.radius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    overflow: "hidden",
  },
  subCampoEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rapidoPorcentajeFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 12,
  },
  rapidoPorcentajeChip: {
    flex: 1,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    minHeight: 38,
  },
  rapidoPorcentajeChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  rapidoPorcentajeTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.text,
  },
  rapidoPorcentajeTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  ajustadorFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
  },
  pasoBoton: {
    flex: 1,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: tema.radius.md,
    minHeight: 44,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  pasoBotonTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  porcentajeDisplay: {
    flex: 1.35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 2,
    borderColor: tema.colors.primary,
    borderRadius: tema.radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
    minWidth: 72,
    maxWidth: 110,
  },
  porcentajeEntrada: {
    fontSize: 20,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    textAlign: "center",
    width: 44,
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  porcentajeUnidad: {
    fontSize: 15,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginLeft: 2,
  },
  materialesUsadoSeccion: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  seccionTituloFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  materialesUsadoTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  noExistenciaDespachoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.infoLight,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tema.colors.infoBorder,
  },
  noExistenciaDespachoTexto: {
    fontSize: 11,
    color: tema.colors.infoDark,
    flex: 1,
  },
  usadoMaterialFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    padding: 10,
    borderRadius: tema.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  usadoMaterialNombre: {
    fontSize: 13,
    fontWeight: "600",
    color: tema.colors.text,
  },
  usadoMaterialSku: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  usadoCantidadAjustadorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    height: 44,
    paddingHorizontal: 4,
  },
  cantidadPasoBoton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surfaceAlt,
  },
  cantidadDisplayCaja: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cantidadDisplayValor: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  cantidadDisplayUnidad: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  usadoCantidadCaja: {
    flexDirection: "row",
    alignItems: "center",
  },
  usadoCantidadEntrada: {
    width: 50,
    height: 32,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  usadoUnidadTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginLeft: 4,
  },
  exitoTexto: {
    fontSize: 12,
    color: tema.colors.ok,
    fontWeight: "bold",
    marginTop: 8,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "bold",
    marginTop: 8,
  },
  historialEncabezado: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: tema.spacing.lg,
    marginBottom: 6,
  },
  historialReglaAviso: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 10,
  },
  historialTarjeta: {
    marginBottom: tema.spacing.sm,
    backgroundColor: tema.colors.card,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  historialProyecto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  historialFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  historialComentarios: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  fechaSelectorSeccion: {
    marginBottom: 12,
  },
  rapidoFechaFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  rapidoFechaChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    minHeight: 38,
  },
  rapidoFechaChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  rapidoFechaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  rapidoFechaTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  horasEntradaSeccion: {
    marginBottom: 12,
  },
  horasEncabezadoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  formularioFila: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  horasCampoEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 4,
  },
  horasAjustadorFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tema.colors.surfaceAlt,
    padding: 6,
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    minHeight: 52,
  },
  horaPasoBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: tema.radius.sm,
    minHeight: 44,
    minWidth: 64,
    justifyContent: "center",
  },
  horaPasoBotonTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginLeft: 2,
  },
  horasDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 70,
    justifyContent: "center",
  },
  horasDisplayValor: {
    fontSize: 22,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  horasDisplayUnidad: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginLeft: 3,
  },
  rapidoHorasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
    marginTop: 10,
  },
  rapidoHoraChip: {
    flexGrow: 1,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    minHeight: 44,
  },
  rapidoHoraChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  rapidoHoraTexto: {
    fontSize: 11,
    color: tema.colors.text,
    fontWeight: "600",
  },
  rapidoHoraTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  horaTarjeta: {
    marginBottom: tema.spacing.sm,
    backgroundColor: tema.colors.card,
    borderLeftWidth: 3.5,
    borderLeftColor: tema.colors.primary,
    borderColor: tema.colors.border,
    borderWidth: 1,
  },
  horaTarjetaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  horaProyecto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  horaFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  horaDescripcion: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 4,
  },
  horaTarjetaAcciones: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    alignItems: "flex-end",
  },
  modalSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 10,
  },
  modalBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  modoSegment: {
    flexDirection: "row",
    backgroundColor: "#292524", // Stone 800 Dark Titanium Bar
    padding: 4,
    borderRadius: tema.radius.md,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  modoSegmentBoton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: tema.radius.sm,
  },
  modoSegmentBotonActivo: {
    backgroundColor: tema.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  modoSegmentTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: "#a8a29e",
    marginLeft: 6,
  },
  modoSegmentTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  activoPuntoPulso: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginLeft: 6,
  },
  activoPuntoPulsoGrande: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  activoSesionTarjeta: {
    backgroundColor: "#fffbeb",
    borderWidth: 1.5,
    borderColor: "#fde68a",
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
  },
  activoSesionEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  enVivoInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
  },
  enVivoInsigniaTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#b45309",
    letterSpacing: 0.5,
  },
  activoSesionProyecto: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  activoSesionIniciado: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  temporizadorRelojCaja: {
    backgroundColor: "#1c1917",
    borderWidth: 1.5,
    borderColor: "#d97706",
    borderRadius: tema.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  temporizadorDigits: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f59e0b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
  },
  temporizadorSubEtiqueta: {
    fontSize: 11,
    color: "#fde68a",
    fontWeight: "600",
    marginTop: 4,
  },
  enVivoCalculoGrilla: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  enVivoCalculoColumna: {
    flex: 1,
    alignItems: "center",
  },
  enVivoCalculoValor: {
    fontSize: 14,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  enVivoCalculoDescripcion: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  enVivoCalculoDivisor: {
    width: 1,
    backgroundColor: "#fde68a",
    marginVertical: 2,
  },
  activoAccionesFila: {
    flexDirection: "row",
    marginTop: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  automaticoPromptTarjeta: {
    backgroundColor: tema.colors.card,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
    ...tema.shadows.sm,
  },
  automaticoPromptSuperior: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  automaticoIconoCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: tema.colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  automaticoPastillasCaja: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: tema.colors.surfaceAlt,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 12,
    gap: 8,
  },
  automaticoPastillaElemento: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  automaticoPastillaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
    marginLeft: 4,
  },
  automaticoProyectoTarifaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  automaticoProyectoTarifaEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  automaticoProyectoTarifaValor: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  automaticoProyectoTarifaDestacado: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  manualCostoVistaPrevia: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: tema.colors.primaryBorder,
    padding: 12,
    borderRadius: tema.radius.md,
    marginBottom: 14,
  },
  manualCostoIconoCaja: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
  },
  manualCostoFormula: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  manualCostoTotal: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginTop: 2,
  },
  manualCostoFootnote: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
  },
  manualCostoTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    flex: 1,
  },
  financialIntegrationBanner: {
    backgroundColor: "#1c1917", // Dark Titanium Technical Chassis
    borderWidth: 1,
    borderColor: "#292524",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    borderRadius: tema.radius.md,
    padding: 14,
    marginTop: tema.spacing.md,
    marginBottom: tema.spacing.sm,
    ...tema.shadows.md,
  },
  financialBannerEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  financialBannerTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  financialBannerDescripcion: {
    fontSize: 11,
    color: "#d6d3d1",
    lineHeight: 18,
  },
  horaDiferenciaHorasTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
  adminEditarAviso: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  adminEditarAvisoTexto: {
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
    flex: 1,
  },
  adminDelegationAvisoTarjeta: {
    backgroundColor: "#fffbeb",
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderLeftWidth: 4,
    borderLeftColor: "#d97706",
    borderRadius: tema.radius.md,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  adminDelegationAvisoEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  adminDelegationAvisoTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#b45309",
  },
  adminDelegationAvisoDescripcion: {
    fontSize: 11,
    color: "#78350f",
    lineHeight: 17,
  },
});
