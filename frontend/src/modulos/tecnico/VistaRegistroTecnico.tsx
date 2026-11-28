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
import { HoraTrabajoTecnico } from "@/nucleo/tipos";

interface TechnicianRegisterViewProps {
  initialSubTab?: "avance" | "horas" | "sobrante";
  initialProjectId?: string;
}

export const VistaRegistroTecnico: React.FC<TechnicianRegisterViewProps> = ({
  initialSubTab = "avance",
  initialProjectId,
}) => {
  const {
    proyectos,
    productos,
    horasTecnico,
    reportesAvanceTecnico,
    sesionTrabajoActiva,
    iniciarSesionTrabajo,
    detenerSesionTrabajo,
    cancelarSesionTrabajo,
    actualizarHoraTrabajoTecnico,
    crearReporteAvanceTecnico,
  } = usarAplicacion();
  const { usuario, rolActual } = usarAutenticacion();

  const [activoSubPestana, establecerActivoSubPestana] = useState<"avance" | "horas" | "sobrante">(initialSubTab);

  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || activoProyectos[0]?.id || ""
  );

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

  // =========================================================================
  // 2. REGISTRAR HORAS (100% AUTOMÁTICO EN FAENA CON CRONÓMETRO, H27/H28)
  // =========================================================================
  const [sesionTranscurridoSegundos, establecerSesionTranscurridoSegundos] = useState<number>(0);
  const [automaticoDescripcion, establecerAutomaticoDescripcion] = useState<string>("");
  const [horasError, establecerHorasError] = useState<string>("");
  const [horasExito, establecerHorasExito] = useState<string>("");

  // Modal para editar horas si usuario es Administrador
  const [editandoHora, establecerEditandoHora] = useState<HoraTrabajoTecnico | null>(null);
  const [editarHorasValor, establecerEditarHorasValor] = useState<number>(8.0);
  const [editarDescripcion, establecerEditarDescripcion] = useState<string>("");
  const [editarError, establecerEditarError] = useState<string>("");

  // Timer en vivo para sesión activa en faena
  useEffect(() => {
    if (!sesionTrabajoActiva) {
      establecerSesionTranscurridoSegundos(0);
      return;
    }
    const tick = () => {
      const iniciarMs = new Date(sesionTrabajoActiva.startTime).getTime();
      const transcurrido = Math.max(0, Math.floor((Date.now() - iniciarMs) / 1000));
      establecerSesionTranscurridoSegundos(transcurrido);
    };
    tick();
    const temporizador = setInterval(tick, 1000);
    return () => clearInterval(temporizador);
  }, [sesionTrabajoActiva]);

  const formatearDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const manejarIniciarAutomaticoSesion = () => {
    establecerHorasError("");
    establecerHorasExito("");
    if (!actualProyecto) {
      establecerHorasError("Seleccione un proyecto para iniciar la faena.");
      return;
    }
    const resultado = iniciarSesionTrabajo(actualProyecto.id);
    if (!resultado.success) {
      establecerHorasError(resultado.error || "Error al iniciar la jornada automática.");
    } else {
      establecerHorasExito(`✓ Jornada iniciada automáticamente en ${actualProyecto.code}. El sistema cronometra en segundo plano.`);
      setTimeout(() => establecerHorasExito(""), 4000);
    }
  };

  const manejarDetenerAutomaticoSesion = () => {
    establecerHorasError("");
    establecerHorasExito("");
    const resultado = detenerSesionTrabajo(automaticoDescripcion);
    if (!resultado.success) {
      establecerHorasError(resultado.error || "Error al finalizar jornada.");
    } else {
      const tarifa = sesionTrabajoActiva?.hourlyRate || actualProyecto?.hourlyRate || 18500;
      const costoReal = (resultado.hours || 0) * tarifa;
      establecerHorasExito(
        `✓ Jornada registrada con éxito: ${resultado.hours} HH (${formatearCLP(costoReal)}). Alimenta el costo real H27 y rentabilidad H28.`
      );
      establecerAutomaticoDescripcion("");
      setTimeout(() => establecerHorasExito(""), 5000);
    }
  };

  const manejarCancelarAutomaticoSesion = () => {
    if (Platform.OS === "web") {
      if (window.confirm("¿Seguro que deseas cancelar el registro automático? El tiempo cronometrado no se guardará.")) {
        cancelarSesionTrabajo();
        establecerAutomaticoDescripcion("");
      }
    } else {
      cancelarSesionTrabajo();
      establecerAutomaticoDescripcion("");
    }
  };

  const manejarAbrirEditarHora = (h: HoraTrabajoTecnico) => {
    if (rolActual !== "admin") {
      alert("Normativa contable: La edición y ajuste de jornadas fuera del flujo automático está reservada a Administración.");
      return;
    }
    establecerEditandoHora(h);
    establecerEditarHorasValor(h.hours);
    establecerEditarDescripcion(h.description);
    establecerEditarError("");
  };


  const manejarConfirmarEditarHora = () => {
    if (!editandoHora) return;
    const resultado = actualizarHoraTrabajoTecnico(editandoHora.id, editarHorasValor, editarDescripcion, rolActual);
    if (!resultado.success) {
      establecerEditarError(resultado.error || "Error al editar horas.");
    } else {
      establecerEditandoHora(null);
    }
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
        <ScrollView style={estilos.cuerpoScroll} contentContainerStyle={estilos.cuerpoContenido}>
          {/* Selector de Proyecto */}
          <Text style={estilos.campoEtiqueta}>Proyecto / Faena a reportar:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
            {activoProyectos.map((p) => {
              const esSeleccionado = p.id === actualProyecto?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    establecerSeleccionadoProyectoId(p.id);
                    establecerAvancePorcentaje(p.progress);
                  }}
                  style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
                >
                  <Text style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activoProyectos.length === 0 ? (
            <EstadoVacio
              icon="folder-open-outline"
              title="Sin proyectos activos"
              description="No tienes proyectos asignados actualmente para registrar avance de obra."
              containerStyle={{ marginVertical: 32 }}
            />
          ) : actualProyecto ? (
            <Tarjeta variant="elevated">
              <View style={estilos.avanceEncabezadoFila}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={estilos.tarjetaEncabezado}>Reporte de Avance Físico</Text>
                  <Text style={estilos.tarjetaSub}>
                    Porcentaje de avance en obra (Avance previo: {actualProyecto.progress}%)
                  </Text>
                </View>
                <Insignia
                  label={`${avancePorcentaje}%`}
                  tone={avancePorcentaje >= 80 ? "ok" : avancePorcentaje >= 50 ? "info" : "warn"}
                  size="lg"
                />
              </View>

              {/* Slider / Stepper Táctil y Chips Rápidos 0-100% */}
              <View style={estilos.deslizadorCaja}>
                {/* Chips rápidos de porcentaje de avance */}
                <Text style={estilos.subCampoEtiqueta}>Hitos rápidos de avance:</Text>
                <View style={estilos.rapidoPorcentajeFila}>
                  {[10, 25, 50, 75, 90, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => establecerAvancePorcentaje(pct)}
                      style={[estilos.rapidoPorcentajeChip, avancePorcentaje === pct && estilos.rapidoPorcentajeChipActivo]}
                      activeOpacity={0.7}
                    >
                      <Text style={[estilos.rapidoPorcentajeTexto, avancePorcentaje === pct && estilos.rapidoPorcentajeTextoActivo]}>
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={estilos.ajustadorFila}>
                  <TouchableOpacity onPress={() => manejarAjustarPorcentaje(-10)} style={estilos.pasoBoton} activeOpacity={0.7}>
                    <Text style={estilos.pasoBotonTexto}>−10%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => manejarAjustarPorcentaje(-5)} style={estilos.pasoBoton} activeOpacity={0.7}>
                    <Text style={estilos.pasoBotonTexto}>−5%</Text>
                  </TouchableOpacity>

                  <View style={estilos.porcentajeDisplay}>
                    <TextInput
                      value={String(avancePorcentaje)}
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^0-9]/g, "");
                        if (cleaned === "") {
                          establecerAvancePorcentaje(0);
                          return;
                        }
                        const numero = parseInt(cleaned, 10);
                        if (!isNaN(numero)) establecerAvancePorcentaje(Math.max(0, Math.min(100, numero)));
                      }}
                      keyboardType="numeric"
                      maxLength={3}
                      selectTextOnFocus
                      style={estilos.porcentajeEntrada}
                    />
                    <Text style={estilos.porcentajeUnidad}>%</Text>
                  </View>

                  <TouchableOpacity onPress={() => manejarAjustarPorcentaje(+5)} style={estilos.pasoBoton} activeOpacity={0.7}>
                    <Text style={estilos.pasoBotonTexto}>+5%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => manejarAjustarPorcentaje(+10)} style={estilos.pasoBoton} activeOpacity={0.7}>
                    <Text style={estilos.pasoBotonTexto}>+10%</Text>
                  </TouchableOpacity>
                </View>

                {/* Barra visual de progreso */}
                <View style={{ marginTop: 14 }}>
                  <BarraProgreso
                    value={avancePorcentaje}
                    max={100}
                    height={10}
                    color={tema.colors.primary}
                  />
                </View>
              </View>

              {/* Comentarios de Avance */}
              <CampoTexto
                label="Comentarios y descripción del avance"
                value={avanceComentarios}
                onChangeText={establecerAvanceComentarios}
                placeholder="Describa el trabajo realizado, cuadrillas involucradas..."
              />

              {/* MATERIALES USADOS (NO GENERA EGRESO) */}
              <View style={estilos.materialesUsadoSeccion}>
                <View style={estilos.seccionTituloFila}>
                  <Text style={estilos.materialesUsadoTitulo}>Materiales Consumidos en la Jornada:</Text>
                  <Insignia label="Informativo" tone="mute" size="sm" />
                </View>

                {/* BANNER REQUISITO PASO 10: NO GENERA EGRESO */}
                <View style={estilos.noExistenciaDespachoBanner}>
                  <Ionicons name="information-circle" size={18} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={estilos.noExistenciaDespachoTexto}>
                    Nota: El reporte de materiales en faena es informativo y <Text style={{ fontWeight: "bold" }}>NO rebaja stock en bodega</Text> ni genera egreso contable.
                  </Text>
                </View>

                {usadoMateriales.map((m, idx) => (
                  <View key={idx} style={estilos.usadoMaterialFila}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={estilos.usadoMaterialNombre}>• {m.name}</Text>
                      <Text style={estilos.usadoMaterialSku}>SKU: {m.sku}</Text>
                    </View>

                    <View style={estilos.usadoCantidadAjustadorCaja}>
                      <TouchableOpacity
                        onPress={() => manejarAjustarMaterialCantidad(idx, -1)}
                        style={estilos.cantidadPasoBoton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={16} color={tema.colors.primaryDark} />
                      </TouchableOpacity>

                      <View style={estilos.cantidadDisplayCaja}>
                        <Text style={estilos.cantidadDisplayValor}>{m.quantity}</Text>
                        <Text style={estilos.cantidadDisplayUnidad}>{m.unit}</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => manejarAjustarMaterialCantidad(idx, +1)}
                        style={estilos.cantidadPasoBoton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color={tema.colors.primaryDark} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {Boolean(avanceExito) && (
                <Text style={estilos.exitoTexto}>{avanceExito}</Text>
              )}

              <Boton
                title="Guardar Avance de Obra"
                variant="primary"
                icon="save-outline"
                onPress={manejarGuardarAvance}
                style={{ marginTop: 16, height: 48 }}
              />
            </Tarjeta>
          ) : null}

          {/* Historial de Avances Anteriores */}
          <Text style={estilos.historialEncabezado}>Reportes de Avance Anteriores:</Text>
          {reportesAvanceTecnico.map((rep) => (
            <Tarjeta key={rep.id} variant="default" style={estilos.historialTarjeta}>
              <View style={estilos.historyHeader}>
                <View>
                  <Text style={estilos.historialProyecto}>{rep.projectName} ({rep.projectCode})</Text>
                  <Text style={estilos.historialFecha}>Fecha: {formatearFecha(rep.date)}</Text>
                </View>
                <Insignia label={`${rep.progressPct}%`} tone="ok" size="sm" />
              </View>
              <Text style={estilos.historialComentarios}>"{rep.comments}"</Text>
            </Tarjeta>
          ))}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 2. REGISTRAR HORAS (HH)                                                   */}
      {/* ========================================================================= */}
      {activoSubPestana === "horas" && (
        <ScrollView style={estilos.cuerpoScroll} contentContainerStyle={estilos.cuerpoContenido}>
          {/* Selector de Proyecto */}
          <Text style={estilos.campoEtiqueta}>PROYECTO / FAENA A IMPUTAR HH:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
            {activoProyectos.map((p) => {
              const esSeleccionado = p.id === actualProyecto?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => establecerSeleccionadoProyectoId(p.id)}
                  style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
                >
                  <Text style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activoProyectos.length === 0 ? (
            <EstadoVacio
              icon="time-outline"
              title="Sin proyectos activos"
              description="No tienes proyectos asignados actualmente para imputar horas hombre."
              containerStyle={{ marginVertical: 32 }}
            />
          ) : (
            <>
              {/* REGISTRO AUTOMÁTICO AL INICIAR PROYECTO (CRONÓMETRO FAENA) */}
              {sesionTrabajoActiva ? (
                /* SESIÓN EN CURSO (CRONOMETRANDO) */
                <Tarjeta variant="elevated" style={estilos.activoSesionTarjeta}>
                  <View style={estilos.activoSesionEncabezado}>
                    <View style={estilos.enVivoInsigniaFila}>
                      <View style={estilos.activoPuntoPulsoGrande} />
                      <Text style={estilos.enVivoInsigniaTexto}>JORNADA EN CURSO EN FAENA</Text>
                    </View>
                    <Insignia label="Offline" tone="ok" size="sm" icon="cloud-done" />
                  </View>

                  <Text style={estilos.activoSesionProyecto}>
                    {sesionTrabajoActiva.projectCode} • {sesionTrabajoActiva.projectName}
                  </Text>
                  <Text style={estilos.activoSesionIniciado}>
                    Iniciado: {new Date(sesionTrabajoActiva.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} • Tarifa: {formatearCLP(sesionTrabajoActiva.hourlyRate)} / HH
                  </Text>

                  {/* RELOJ DIGITAL */}
                  <View style={estilos.temporizadorRelojCaja}>
                    <Text style={estilos.temporizadorDigits}>{formatearDuration(sesionTranscurridoSegundos)}</Text>
                    <Text style={estilos.temporizadorSubEtiqueta}>Tiempo transcurrido en terreno (segundo plano)</Text>
                  </View>

                  {/* CÁLCULO EN VIVO DE HH Y COSTO REAL (H27 / H28) */}
                  {(() => {
                    const transcurridoH = sesionTranscurridoSegundos / 3600;
                    const bloques = Math.max(0.5, Math.min(24.0, Math.round(transcurridoH * 2) / 2));
                    const costoManoObra = bloques * sesionTrabajoActiva.hourlyRate;
                    return (
                      <View style={estilos.enVivoCalculoGrilla}>
                        <View style={estilos.enVivoCalculoColumna}>
                          <Text style={estilos.enVivoCalculoValor}>{bloques.toFixed(1)} HH</Text>
                          <Text style={estilos.enVivoCalculoDescripcion}>Bloque normativo 0,5 h</Text>
                        </View>
                        <View style={estilos.enVivoCalculoDivisor} />
                        <View style={estilos.enVivoCalculoColumna}>
                          <Text style={estilos.enVivoCalculoValor}>{formatearCLP(costoManoObra)}</Text>
                          <Text style={estilos.enVivoCalculoDescripcion}>Costo M.O. Real (H27)</Text>
                        </View>
                        <View style={estilos.enVivoCalculoDivisor} />
                        <View style={estilos.enVivoCalculoColumna}>
                          <Text style={estilos.enVivoCalculoValor}>H27 / H28</Text>
                          <Text style={estilos.enVivoCalculoDescripcion}>Alimenta Rentabilidad</Text>
                        </View>
                      </View>
                    );
                  })()}

                  <CampoTexto
                    label="Descripción de la labor ejecutada"
                    value={automaticoDescripcion}
                    onChangeText={establecerAutomaticoDescripcion}
                    placeholder="Ej: Montaje de bandejas, cableado estructurado y pruebas..."
                  />

                  {Boolean(horasError) && <Text style={estilos.errorTexto}>{horasError}</Text>}
                  {Boolean(horasExito) && <Text style={estilos.exitoTexto}>{horasExito}</Text>}

                  <View style={estilos.activoAccionesFila}>
                    <Boton
                      title="Descartar"
                      variant="ghost"
                      icon="close-outline"
                      onPress={manejarCancelarAutomaticoSesion}
                      style={{ flex: 1, marginRight: 8, height: 48 }}
                    />
                    <Boton
                      title="Finalizar y Registrar HH"
                      variant="primary"
                      icon="checkmark-circle-outline"
                      onPress={manejarDetenerAutomaticoSesion}
                      style={{ flex: 2, height: 48 }}
                    />
                  </View>
                </Tarjeta>
              ) : (
                /* SIN SESIÓN: INICIAR JORNADA AUTOMÁTICA */
                <Tarjeta variant="elevated" style={estilos.automaticoPromptTarjeta}>
                  <View style={estilos.automaticoPromptSuperior}>
                    <View style={estilos.automaticoIconoCirculo}>
                      <Ionicons name="play" size={26} color={tema.colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={estilos.tarjetaEncabezado}>Registro Automático de Horas</Text>
                      <Text style={estilos.tarjetaSub}>
                        Inicia tu faena al llegar al proyecto. El sistema cronometra y registra automáticamente tus horas trabajadas en bloques de 0,5 h.
                      </Text>
                    </View>
                  </View>

                  <View style={estilos.automaticoPastillasCaja}>
                    <View style={estilos.automaticoPastillaElemento}>
                      <Ionicons name="speedometer-outline" size={14} color={tema.colors.primary} />
                      <Text style={estilos.automaticoPastillaTexto}>Bloques de 0,5 h</Text>
                    </View>
                    <View style={estilos.automaticoPastillaElemento}>
                      <Ionicons name="shield-checkmark-outline" size={14} color={tema.colors.ok} />
                      <Text style={estilos.automaticoPastillaTexto}>Máx 24 h por día</Text>
                    </View>
                    <View style={estilos.automaticoPastillaElemento}>
                      <Ionicons name="flash-outline" size={14} color={tema.colors.infoDark} />
                      <Text style={estilos.automaticoPastillaTexto}>100% Automático</Text>
                    </View>
                    <View style={estilos.automaticoPastillaElemento}>
                      <Ionicons name="cloud-offline-outline" size={14} color={tema.colors.textMuted} />
                      <Text style={estilos.automaticoPastillaTexto}>Funciona Offline</Text>
                    </View>
                  </View>

                  <View style={estilos.automaticoProyectoTarifaFila}>
                    <Text style={estilos.automaticoProyectoTarifaEtiqueta}>Proyecto seleccionado:</Text>
                    <Text style={estilos.automaticoProyectoTarifaValor}>
                      {actualProyecto ? `${actualProyecto.code} - ${actualProyecto.name}` : "Seleccione un proyecto"}
                    </Text>
                  </View>
                  <View style={estilos.automaticoProyectoTarifaFila}>
                    <Text style={estilos.automaticoProyectoTarifaEtiqueta}>Tarifa M.O. imputable:</Text>
                    <Text style={estilos.automaticoProyectoTarifaDestacado}>
                      {formatearCLP(actualProyecto?.hourlyRate || 18500)} / HH → Alimenta H27 y H28
                    </Text>
                  </View>

                  {Boolean(horasError) && <Text style={estilos.errorTexto}>{horasError}</Text>}
                  {Boolean(horasExito) && <Text style={estilos.exitoTexto}>{horasExito}</Text>}

                  <Boton
                    title={`Iniciar Faena en ${actualProyecto?.code || "Proyecto"}`}
                    variant="primary"
                    icon="play-circle"
                    onPress={manejarIniciarAutomaticoSesion}
                    style={{ marginTop: 14, height: 50 }}
                  />
                </Tarjeta>
              )}

              {/* AVISO DE CARGA MANUAL DELEGADA A ADMINISTRACIÓN */}
              <View style={estilos.adminDelegationAvisoTarjeta}>
                <View style={estilos.adminDelegationAvisoEncabezado}>
                  <Ionicons name="information-circle" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                  <Text style={estilos.adminDelegationAvisoTitulo}>
                    Carga Manual de Horas Asignada a Administración
                  </Text>
                </View>
                <Text style={estilos.adminDelegationAvisoDescripcion}>
                  El registro en terreno es estrictamente automático con cronómetro. En caso de que no se haya registrado automáticamente tu jornada (por batería agotada, falla de terminal o falta de señal), contacta a Administración para que seleccione tu perfil e impute manualmente tus horas al proyecto.
                </Text>
              </View>

              {/* BANNER INFORMATIVO: ALIMENTACIÓN H27 Y H28 + REGLA 48 HORAS */}
              <View style={estilos.financialIntegrationBanner}>
                <View style={estilos.financialBannerEncabezado}>
                  <Ionicons name="analytics" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
                  <Text style={estilos.financialBannerTitulo}>
                    Integración Financiera H27 y H28 (Mano de Obra Real)
                  </Text>
                </View>
                <Text style={estilos.financialBannerDescripcion}>
                  • <Text style={{ fontWeight: "bold" }}>H27 (Costo Real):</Text> Cada bloque de 0,5 h suma a los costos reales de mano de obra del proyecto según la tarifa base.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>H28 (Liquidación Financiera):</Text> Actualiza la desviación respecto al presupuesto de HH y rentabilidad.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>Cargas Manuales:</Text> Reservadas exclusivamente a Administración cuando no se registra automáticamente.
                  {"\n"}• <Text style={{ fontWeight: "bold" }}>Offline:</Text> Funciona sin conexión a internet y sincroniza automáticamente al reconectar.
                </Text>
              </View>
            </>
          )}

          {/* LISTADO DE HORAS REGISTRADAS */}
          <Text style={estilos.historialEncabezado}>Mis Jornadas Registradas:</Text>
          <Text style={estilos.historialReglaAviso}>
            Historial de jornadas imputadas a tus proyectos (vía cronómetro en faena o carga autorizada por Administración).
          </Text>

          {horasTecnico.map((h) => {
            const createdTiempo = new Date(h.createdAt).getTime();
            const diferenciaHoras = (Date.now() - createdTiempo) / (1000 * 60 * 60);
            const puedeEditar = rolActual === "admin";
            const proyecto = proyectos.find((p) => p.id === h.projectId);
            const tarifa = proyecto?.hourlyRate || 18500;
            const costoReal = h.hours * tarifa;

            return (
              <Tarjeta key={h.id} variant="default" style={estilos.horaTarjeta}>
                <View style={estilos.horaTarjetaSuperior}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={estilos.horaProyecto}>{h.projectName} ({h.projectCode})</Text>
                    <Text style={estilos.horaFecha}>
                      Fecha trabajada: {formatearFecha(h.date)} • Imputado: {formatearCLP(costoReal)}
                    </Text>
                    <Text style={estilos.horaDescripcion}>{h.description}</Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Insignia label={`${h.hours} HH`} tone="info" size="md" />
                    <View style={{ marginTop: 4 }}>
                      {h.registeredBy === "admin_manual" ? (
                        <Insignia label="Manual" tone="warn" icon="shield-checkmark" size="sm" />
                      ) : (
                        <Insignia label="Cronómetro" tone="ok" icon="timer-outline" size="sm" />
                      )}
                    </View>
                    <Text style={estilos.horaDiferenciaHorasTexto}>
                      {diferenciaHoras < 1
                        ? "Recién registrado"
                        : diferenciaHoras < 24
                        ? `Hace ${Math.floor(diferenciaHoras)} h`
                        : `Hace ${Math.floor(diferenciaHoras / 24)} días`}
                    </Text>
                  </View>
                </View>

                {puedeEditar && (
                  <View style={estilos.horaTarjetaAcciones}>
                    <Boton
                      title="Editar Registro (Admin)"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarHora(h)}
                      style={{ height: 38 }}
                    />
                  </View>
                )}
              </Tarjeta>
            );
          })}

          {/* MODAL PARA EDITAR HORAS DENTRO DE 48H O COMO ADMIN */}
          <VistaModal
            visible={Boolean(editandoHora)}
            onClose={() => establecerEditandoHora(null)}
            title="Editar Jornada de Horas"
            subtitle={editandoHora ? `${editandoHora.projectCode} • Registrado el ${formatearFecha(editandoHora.date)}` : ""}
          >
            {editandoHora && (() => {
              const diferenciaH = (Date.now() - new Date(editandoHora.createdAt).getTime()) / (1000 * 60 * 60);
              const esPast48 = diferenciaH > 48;
              return (
                <View style={{ marginBottom: 12 }}>
                  {esPast48 ? (
                    <View style={estilos.adminEditarAviso}>
                      <Ionicons name="shield-checkmark" size={16} color={tema.colors.warnDark} style={{ marginRight: 6 }} />
                      <Text style={estilos.adminEditarAvisoTexto}>
                        Modo Administrador: Edición autorizada fuera de la ventana de 48 horas.
                      </Text>
                    </View>
                  ) : (
                    <Text style={estilos.modalSub}>
                      Registro dentro de la ventana de 48 horas de gracia del técnico:
                    </Text>
                  )}
                </View>
              );
            })()}

            <Text style={estilos.horasCampoEtiqueta}>Horas (Bloques de 0,5 h, máx 24):</Text>
            <View style={estilos.horasAjustadorFila}>
              <TouchableOpacity
                onPress={() => establecerEditarHorasValor((p) => Math.max(0.5, Math.round((p - 0.5) * 2) / 2))}
                style={estilos.horaPasoBoton}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={tema.colors.primaryDark} />
                <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
              </TouchableOpacity>

              <View style={estilos.horasDisplay}>
                <Text style={estilos.horasDisplayValor}>{editarHorasValor.toFixed(1)}</Text>
                <Text style={estilos.horasDisplayUnidad}>HH</Text>
              </View>

              <TouchableOpacity
                onPress={() => establecerEditarHorasValor((p) => Math.min(24.0, Math.round((p + 0.5) * 2) / 2))}
                style={estilos.horaPasoBoton}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={tema.colors.primaryDark} />
                <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
              </TouchableOpacity>
            </View>

            {/* Chips rápidos en el modal */}
            <View style={estilos.rapidoHorasFila}>
              {[1.0, 2.0, 4.0, 8.0, 10.0].map((h) => {
                const esActivo = editarHorasValor === h;
                return (
                  <TouchableOpacity
                    key={`modal-h-${h}`}
                    style={[estilos.rapidoHoraChip, esActivo && estilos.rapidoHoraChipActivo]}
                    onPress={() => establecerEditarHorasValor(h)}
                    activeOpacity={0.7}
                  >
                    <Text style={[estilos.rapidoHoraTexto, esActivo && estilos.rapidoHoraTextoActivo]}>
                      {h} h
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginTop: 10 }}>
              <CampoTexto
                label="Descripción de las labores"
                value={editarDescripcion}
                onChangeText={establecerEditarDescripcion}
              />
            </View>

            {Boolean(editarError) && <Text style={estilos.errorTexto}>{editarError}</Text>}

            <View style={estilos.modalBotonesFila}>
              <Boton
                title="Cancelar"
                variant="ghost"
                onPress={() => establecerEditandoHora(null)}
                style={{ marginRight: 8, flex: 1 }}
              />
              <Boton
                title="Guardar Cambios (H27/H28)"
                variant="primary"
                onPress={manejarConfirmarEditarHora}
                style={{ flex: 2, height: 46 }}
              />
            </View>
          </VistaModal>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 3. DEVOLVER SOBRANTE (INTEGRA RETURNSSCREEN DEL PASO 9)                    */}
      {/* ========================================================================= */}
      {activoSubPestana === "sobrante" && (
        <View style={{ flex: 1 }}>
          <PantallaDevoluciones />
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
    backgroundColor: "#1c1917", // Dark Titanium Bar
    padding: 4,
    marginHorizontal: tema.spacing.md,
    marginTop: tema.spacing.sm,
    borderRadius: tema.radius.md,
    flexWrap: "wrap",
    gap: 8,
  },
  subPestanaElemento: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: tema.radius.sm,
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
    paddingBottom: 40,
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
