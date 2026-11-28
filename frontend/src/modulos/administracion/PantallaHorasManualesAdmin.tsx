import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { HoraTrabajoTecnico } from "@/nucleo/tipos";
import {
  Boton,
  CampoBusqueda,
  CampoTexto,
  ContenedorEstadoPantalla,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  NotificacionFlotante,
  Tarjeta,
  VistaModal,
} from "@/componentes/comunes";
import { Selector, OpcionSelector } from "@/componentes/formularios/Selector";

type FiltroOrigenHora = "todos" | "cronometro" | "manual";

const MOTIVO_PRESETS = [
  "Falla de Batería en Faena",
  "Sin Cobertura / Dispositivo Desconectado",
  "Olvido de Inicio de Cronómetro",
  "Horas Extraordinarias Autorizadas",
  "Reemplazo Operativo en Terreno",
];

export const PantallaHorasManualesAdmin: React.FC = () => {
  const {
    tecnicos,
    proyectos,
    horasTecnico,
    registrarHorasManualesAdmin,
    actualizarHoraTrabajoTecnico,
  } = usarAplicacion();
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;

  const obtenerPresetFecha = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const hoyCadena = obtenerPresetFecha(0);

  const activoProyectos = useMemo(
    () => proyectos.filter((p) => p.status !== "cerrado"),
    [proyectos]
  );

  // Estado de vista / filtros del dashboard
  const [modalImputarVisible, establecerModalImputarVisible] = useState<boolean>(false);
  const [filtroOrigen, establecerFiltroOrigen] = useState<FiltroOrigenHora>("todos");
  const [filtrarTecnico, establecerFiltrarTecnico] = useState<string>("todos");
  const [busquedaHistorial, establecerBusquedaHistorial] = useState<string>("");
  const [avisoExito, establecerAvisoExito] = useState<string | null>(null);

  // Estado del formulario de imputación manual
  const [seleccionadoTecnicoRut, establecerSeleccionadoTecnicoRut] = useState<string>(
    tecnicos[0]?.rut || ""
  );
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    activoProyectos[0]?.id || ""
  );
  const [trabajoFecha, establecerTrabajoFecha] = useState<string>(hoyCadena);
  const [horasValor, establecerHorasValor] = useState<number>(8.0);
  const [seleccionadoMotivo, establecerSeleccionadoMotivo] = useState<string>(
    MOTIVO_PRESETS[0]
  );
  const [trabajoDescripcion, establecerTrabajoDescripcion] = useState<string>(
    "Montaje de circuitos y conexionado de fuerza en terreno."
  );
  const [formularioError, establecerFormularioError] = useState<string>("");

  // Estado del modal de edición de jornada
  const [editandoHora, establecerEditandoHora] = useState<HoraTrabajoTecnico | null>(null);
  const [editarHorasValor, establecerEditarHorasValor] = useState<number>(8.0);
  const [editarDescripcion, establecerEditarDescripcion] = useState<string>("");
  const [editarError, establecerEditarError] = useState<string>("");

  const seleccionadoTecnico = tecnicos.find((t) => t.rut === seleccionadoTecnicoRut);
  const seleccionadoProyecto = proyectos.find((p) => p.id === seleccionadoProyectoId);
  const porHoraTarifa = seleccionadoProyecto?.hourlyRate || 18500;
  const costoManoObra = horasValor * porHoraTarifa;

  // Horas ya registradas por el técnico en la fecha elegida
  const tecnicoDailyHoras = useMemo(
    () =>
      horasTecnico
        .filter(
          (h) =>
            (h.technicianRut === seleccionadoTecnicoRut ||
              (!h.technicianRut && seleccionadoTecnicoRut === "14.234.567-8")) &&
            h.date === trabajoFecha
        )
        .reduce((sum, h) => sum + h.hours, 0),
    [horasTecnico, seleccionadoTecnicoRut, trabajoFecha]
  );

  // Métricas globales de jornadas
  const metricasHoras = useMemo(() => {
    let cronometroCount = 0;
    let manualCount = 0;
    let horasCronometro = 0;
    let horasManual = 0;
    let costoTotal = 0;

    horasTecnico.forEach((h) => {
      const proy = proyectos.find((p) => p.id === h.projectId);
      const tarifa = proy?.hourlyRate || 18500;
      const hh = Number(h.hours || 0);
      costoTotal += hh * tarifa;

      if (h.registeredBy === "admin_manual") {
        manualCount++;
        horasManual += hh;
      } else {
        cronometroCount++;
        horasCronometro += hh;
      }
    });

    return {
      totalRegistros: horasTecnico.length,
      cronometroCount,
      manualCount,
      horasCronometro,
      horasManual,
      totalHoras: horasCronometro + horasManual,
      costoTotal: Math.round(costoTotal),
    };
  }, [horasTecnico, proyectos]);

  // Opciones para selectores desplegables
  const opcionesTecnicosForm = useMemo<OpcionSelector<string>[]>(
    () =>
      tecnicos.map((t) => ({
        label: t.name,
        value: t.rut,
        hint: `${t.specialty} • RUT: ${t.rut}`,
        icon: "person-outline",
      })),
    [tecnicos]
  );

  const opcionesProyectosForm = useMemo<OpcionSelector<string>[]>(
    () =>
      activoProyectos.map((p) => ({
        label: `${p.code} • ${p.name}`,
        value: p.id,
        hint: `Tarifa M.O.: ${formatearCLP(p.hourlyRate || 18500)} / HH`,
        icon: "construct-outline",
      })),
    [activoProyectos]
  );

  const opcionesMotivosForm = useMemo<OpcionSelector<string>[]>(
    () =>
      MOTIVO_PRESETS.map((m) => ({
        label: m,
        value: m,
        icon: "alert-circle-outline",
      })),
    []
  );

  const opcionesFiltroTecnico = useMemo<OpcionSelector<string>[]>(
    () => [
      {
        label: `Todos los técnicos (${horasTecnico.length} jornadas)`,
        value: "todos",
        icon: "people-outline",
      },
      ...tecnicos.map((t) => ({
        label: t.name,
        value: t.rut,
        hint: `${t.specialty} • RUT: ${t.rut}`,
        icon: "person-outline" as const,
      })),
    ],
    [tecnicos, horasTecnico.length]
  );

  // Historial filtrado
  const filtradoHistorial = useMemo(() => {
    const q = busquedaHistorial.trim().toLowerCase();
    return horasTecnico.filter((h) => {
      const esManual = h.registeredBy === "admin_manual";
      if (filtroOrigen === "manual" && !esManual) return false;
      if (filtroOrigen === "cronometro" && esManual) return false;

      if (filtrarTecnico !== "todos") {
        const coincideTecnico =
          h.technicianRut === filtrarTecnico ||
          (!h.technicianRut && filtrarTecnico === "14.234.567-8");
        if (!coincideTecnico) return false;
      }

      if (q) {
        const nombreTec = (h.technicianName || "Alejandro Ramírez").toLowerCase();
        const proyCodigo = (h.projectCode || "").toLowerCase();
        const proyNombre = (h.projectName || "").toLowerCase();
        const desc = (h.description || "").toLowerCase();
        if (
          !nombreTec.includes(q) &&
          !proyCodigo.includes(q) &&
          !proyNombre.includes(q) &&
          !desc.includes(q) &&
          !(h.date || "").includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [horasTecnico, filtroOrigen, filtrarTecnico, busquedaHistorial]);

  const manejarPasoHoras = (delta: number) => {
    establecerHorasValor((prev) => {
      const siguiente = Math.round((prev + delta) * 2) / 2;
      return Math.max(0.5, Math.min(24.0, siguiente));
    });
  };

  const abrirModalImputar = () => {
    establecerFormularioError("");
    establecerModalImputarVisible(true);
  };

  const manejarEnviarManualHoras = () => {
    establecerFormularioError("");

    if (!seleccionadoTecnico) {
      establecerFormularioError("Debe seleccionar un técnico operativo.");
      return;
    }
    if (!seleccionadoProyecto) {
      establecerFormularioError("Debe seleccionar un proyecto o faena.");
      return;
    }
    if (!trabajoFecha.trim()) {
      establecerFormularioError("Ingrese una fecha válida (YYYY-MM-DD).");
      return;
    }
    if (horasValor <= 0 || horasValor > 24) {
      establecerFormularioError("Las horas deben estar entre 0,5 y 24 HH por día.");
      return;
    }

    const resultado = registrarHorasManualesAdmin({
      technicianRut: seleccionadoTecnico.rut,
      technicianName: seleccionadoTecnico.name,
      projectId: seleccionadoProyecto.id,
      date: trabajoFecha,
      hours: horasValor,
      description:
        trabajoDescripcion.trim() ||
        `Jornada registrada manualmente por Administración (${seleccionadoMotivo}).`,
      reason: seleccionadoMotivo,
    });

    if (!resultado.success) {
      establecerFormularioError(
        resultado.error || "Error al registrar las horas del técnico."
      );
      return;
    }

    establecerModalImputarVisible(false);
    establecerAvisoExito(
      `${horasValor} HH imputadas a ${seleccionadoTecnico.name} en ${seleccionadoProyecto.code} (${formatearCLP(costoManoObra)}).`
    );
    setTimeout(() => establecerAvisoExito(null), 4000);
  };

  const manejarAbrirEditarHora = (h: HoraTrabajoTecnico) => {
    establecerEditandoHora(h);
    establecerEditarHorasValor(h.hours);
    establecerEditarDescripcion(h.description);
    establecerEditarError("");
  };

  const manejarConfirmarEditarHora = () => {
    if (!editandoHora) return;
    const res = actualizarHoraTrabajoTecnico(
      editandoHora.id,
      editarHorasValor,
      editarDescripcion,
      "admin"
    );
    if (!res.success) {
      establecerEditarError(res.error || "Error al actualizar horas.");
    } else {
      establecerEditandoHora(null);
      establecerAvisoExito("Jornada actualizada correctamente.");
      setTimeout(() => establecerAvisoExito(null), 3500);
    }
  };

  return (
    <ContenedorEstadoPantalla>
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(avisoExito)}
          message={avisoExito || ""}
          type="ok"
          onDismiss={() => establecerAvisoExito(null)}
        />

        <EncabezadoPagina
          title="Carga y Control de Horas Hombre"
          subtitle="Auditoría de jornadas en terreno e imputación extraordinaria de horas por Administración"
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.scrollCuerpo}>
          {/* 1. CABECERA COMPACTA INDUSTRIAL + BOTÓN IMPUTAR HORAS */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="timer-outline" size={20} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                    Jornadas e Imputación de Horas (HH)
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    Total acumulado:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                      {metricasHoras.totalHoras.toFixed(1)} HH
                    </Text>
                    {` • Costo M.O.: ${formatearCLP(metricasHoras.costoTotal)}`}
                  </Text>
                </View>
              </View>

              <Boton
                title="Imputar Horas"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={abrirModalImputar}
                style={{ minHeight: 40 }}
                fullWidth={esMovilEstrecho}
              />
            </View>
          </Tarjeta>

          {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "cronometro" as FiltroOrigenHora,
                titulo: "Cronómetro",
                valor: metricasHoras.cronometroCount,
                sub: `${metricasHoras.horasCronometro.toFixed(1)} HH en faena`,
                icon: "timer-outline" as const,
                bg: "#f0fdf4",
                border: "#86efac",
                borderActivo: "#16a34a",
                textColor: "#166534",
              },
              {
                id: "manual" as FiltroOrigenHora,
                titulo: "Carga Manual",
                valor: metricasHoras.manualCount,
                sub: `${metricasHoras.horasManual.toFixed(1)} HH admin`,
                icon: "create-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "todos" as FiltroOrigenHora,
                titulo: "Todas las Jornadas",
                valor: metricasHoras.totalRegistros,
                sub: `${metricasHoras.totalHoras.toFixed(1)} HH totales`,
                icon: "layers-outline" as const,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                borderActivo: "#0f172a",
                textColor: "#0f172a",
              },
            ].map((kpi) => {
              const activo = filtroOrigen === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.8}
                  onPress={() => establecerFiltroOrigen(kpi.id)}
                  style={{
                    flexBasis: "31%",
                    flexGrow: 1,
                    minWidth: 135,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2 : 1,
                    borderColor: activo ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 5,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                      {kpi.valor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activo ? "800" : "600",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {activo ? "● Activo" : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. BARRA SIMPLIFICADA DE BÚSQUEDA Y FILTRO POR TÉCNICO */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
              alignItems: "flex-end",
            }}
          >
            <View style={{ flex: 1.4, minWidth: 210 }}>
              <CampoBusqueda
                value={busquedaHistorial}
                onChangeText={establecerBusquedaHistorial}
                placeholder="Buscar jornada por técnico, obra, fecha o labor..."
              />
            </View>
            <View style={{ flex: 1, minWidth: 190 }}>
              <Selector
                label="Filtrar por Técnico"
                options={opcionesFiltroTecnico}
                value={filtrarTecnico}
                onChange={establecerFiltrarTecnico}
                placeholder="Todos los técnicos"
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          </View>

          {/* 4. LISTADO DE JORNADAS CON SEMÁFORO DE SUPERFICIE */}
          {filtradoHistorial.length === 0 ? (
            <EstadoVacio
              icon="time-outline"
              title="Sin jornadas en esta vista"
              description={
                busquedaHistorial.trim()
                  ? `No hay registros que coincidan con "${busquedaHistorial.trim()}".`
                  : "No hay jornadas registradas para los filtros seleccionados."
              }
              actionTitle={
                filtroOrigen !== "todos" || filtrarTecnico !== "todos"
                  ? "Ver Todas las Jornadas"
                  : "Imputar Horas"
              }
              onAction={
                filtroOrigen !== "todos" || filtrarTecnico !== "todos"
                  ? () => {
                      establecerFiltroOrigen("todos");
                      establecerFiltrarTecnico("todos");
                    }
                  : abrirModalImputar
              }
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            filtradoHistorial.map((h) => {
              const proyecto = proyectos.find((p) => p.id === h.projectId);
              const tarifa = proyecto?.hourlyRate || 18500;
              const costoReal = h.hours * tarifa;
              const tecnicoNombre = h.technicianName || "Alejandro Ramírez";
              const esManual = h.registeredBy === "admin_manual";

              const semaforo = esManual
                ? {
                    bg: "#fffbeb",
                    border: "#fcd34d",
                    stripe: "#d97706",
                    text: "#92400e",
                    divider: "#fde68a",
                    etiqueta: "Carga Manual",
                    tone: "warn" as const,
                    icon: "shield-checkmark-outline" as const,
                  }
                : {
                    bg: "#f0fdf4",
                    border: "#86efac",
                    stripe: "#16a34a",
                    text: "#166534",
                    divider: "#bbf7d0",
                    etiqueta: "Cronómetro",
                    tone: "ok" as const,
                    icon: "timer-outline" as const,
                  };

              return (
                <Tarjeta
                  key={h.id}
                  variant="outlined"
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    backgroundColor: semaforo.bg,
                    borderColor: semaforo.border,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.stripe,
                    borderRadius: 12,
                  }}
                >
                  {/* Nivel Superior: Técnico + Proyecto + Fecha vs Caja de HH y Costo */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 185 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text }}>
                          {tecnicoNombre}
                        </Text>
                        <Insignia
                          label={semaforo.etiqueta}
                          tone={semaforo.tone}
                          icon={semaforo.icon}
                          size="sm"
                        />
                      </View>

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: semaforo.text,
                          marginTop: 2,
                        }}
                      >
                        {h.projectCode} • {h.projectName}
                      </Text>

                      <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                        Fecha trabajada: {formatearFecha(h.date)} • Tarifa: {formatearCLP(tarifa)}/HH
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforo.divider,
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        alignItems: "flex-end",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "900", color: semaforo.text }}>
                        {h.hours} HH
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.textSecondary }}>
                        {formatearCLP(costoReal)}
                      </Text>
                    </View>
                  </View>

                  {/* Ficha Blanca Interna: Descripción de la labor + Botón Editar */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: semaforo.divider,
                      borderRadius: 9,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      marginTop: 8,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 170 }}>
                      <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }} numberOfLines={2}>
                        {h.description || "Jornada operativa en terreno"}
                      </Text>
                    </View>

                    <Boton
                      title="Editar"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarHora(h)}
                      style={{ minHeight: 32, paddingHorizontal: 10 }}
                    />
                  </View>
                </Tarjeta>
              );
            })
          )}
        </ScrollView>

        {/* =====================================================================
            MODAL 1: IMPUTAR HORAS MANUALES (SIMPLIFICADO EN 2 BLOQUES)
            ===================================================================== */}
        <VistaModal
          visible={modalImputarVisible}
          onClose={() => establecerModalImputarVisible(false)}
          title="Imputar Horas Hombre (Manual)"
          subtitle="Registro rápido de jornada para técnico en obra activa"
          maxWidth={600}
        >
          {/* BLOQUE 1: TÉCNICO, PROYECTO Y FECHA */}
          <View
            style={{
              backgroundColor: "#f8fafc",
              borderWidth: 1,
              borderColor: tema.colors.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Ionicons name="person-circle-outline" size={17} color={tema.colors.primaryDark} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: tema.colors.text,
                  textTransform: "uppercase",
                }}
              >
                1. Técnico, Obra y Fecha
              </Text>
            </View>

            <Selector
              label="Técnico Operativo"
              required
              options={opcionesTecnicosForm}
              value={seleccionadoTecnicoRut}
              onChange={establecerSeleccionadoTecnicoRut}
              placeholder="Seleccionar técnico..."
            />

            <Selector
              label="Proyecto o Faena"
              required
              options={opcionesProyectosForm}
              value={seleccionadoProyectoId}
              onChange={establecerSeleccionadoProyectoId}
              placeholder="Seleccionar proyecto activo..."
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <CampoTexto
                  label="Fecha Trabajada"
                  required
                  icon="calendar-outline"
                  value={trabajoFecha}
                  onChangeText={establecerTrabajoFecha}
                  placeholder="YYYY-MM-DD"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 6, paddingBottom: 2 }}>
                {[
                  { label: "Hoy", val: obtenerPresetFecha(0) },
                  { label: "Ayer", val: obtenerPresetFecha(1) },
                  { label: "Anteayer", val: obtenerPresetFecha(2) },
                ].map((d) => {
                  const esSel = trabajoFecha === d.val;
                  return (
                    <TouchableOpacity
                      key={d.label}
                      onPress={() => establecerTrabajoFecha(d.val)}
                      style={{
                        paddingHorizontal: 10,
                        height: 40,
                        borderRadius: 8,
                        borderWidth: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: esSel ? "#0f172a" : "#ffffff",
                        borderColor: esSel ? tema.colors.primary : tema.colors.borderDark,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: esSel ? "#818cf8" : tema.colors.textSecondary,
                        }}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* BLOQUE 2: HORAS HOMBRE Y MOTIVO */}
          <View
            style={{
              backgroundColor: "#f8fafc",
              borderWidth: 1,
              borderColor: tema.colors.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="time-outline" size={17} color={tema.colors.primaryDark} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: tema.colors.text,
                    textTransform: "uppercase",
                  }}
                >
                  2. Horas Hombre (HH) y Motivo
                </Text>
              </View>

              <Insignia
                label={`Acumulado día: ${tecnicoDailyHoras.toFixed(1)} / 24h`}
                tone={tecnicoDailyHoras + horasValor > 24 ? "danger" : "warn"}
                size="sm"
              />
            </View>

            {/* Stepper compacto + botones rápidos */}
            <View style={estilos.horasAjustadorFila}>
              <TouchableOpacity
                onPress={() => manejarPasoHoras(-0.5)}
                style={estilos.horaPasoBoton}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={tema.colors.primaryDark} />
                <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
              </TouchableOpacity>

              <View style={estilos.horasDisplay}>
                <Text style={estilos.horasDisplayValor}>{horasValor.toFixed(1)}</Text>
                <Text style={estilos.horasDisplayUnidad}>HH</Text>
              </View>

              <TouchableOpacity
                onPress={() => manejarPasoHoras(+0.5)}
                style={estilos.horaPasoBoton}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={tema.colors.primaryDark} />
                <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
              </TouchableOpacity>
            </View>

            <View style={[estilos.rapidoHorasFila, { marginBottom: 10 }]}>
              {[4.0, 4.5, 8.0, 8.5, 9.0, 10.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => establecerHorasValor(val)}
                  style={[
                    estilos.rapidoHoraChip,
                    horasValor === val && estilos.rapidoHoraChipActivo,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      estilos.rapidoHoraTexto,
                      horasValor === val && estilos.rapidoHoraTextoActivo,
                    ]}
                  >
                    {val} h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Selector
              label="Motivo de Carga Manual"
              options={opcionesMotivosForm}
              value={seleccionadoMotivo}
              onChange={establecerSeleccionadoMotivo}
              placeholder="Seleccionar motivo..."
            />

            <CampoTexto
              label="Labor Ejecutada en Terreno"
              icon="document-text-outline"
              value={trabajoDescripcion}
              onChangeText={establecerTrabajoDescripcion}
              placeholder="Ej: Montaje de tableros y canalización..."
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          {/* RESUMEN DE COSTO A IMPUTAR EN 1 BARRA LIMPIA */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              backgroundColor: tema.colors.primaryLight,
              borderWidth: 1.5,
              borderColor: tema.colors.primaryBorder,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 10,
              gap: 8,
            }}
          >
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.textSecondary }}>
                Cálculo Mano de Obra ({horasValor.toFixed(1)} HH × {formatearCLP(porHoraTarifa)}/HH)
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: tema.colors.primaryDark }}>
                Costo M.O. a Imputar: {formatearCLP(costoManoObra)}
              </Text>
            </View>
            <Insignia label={seleccionadoProyecto?.code || "Obra"} tone="warn" size="sm" />
          </View>

          {Boolean(formularioError) && (
            <View style={estilos.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={tema.colors.danger} style={{ marginRight: 6 }} />
              <Text style={estilos.errorBannerTexto}>{formularioError}</Text>
            </View>
          )}

          <View style={estilos.modalBotonesFila}>
            <Boton
              title="Cancelar"
              variant="outline"
              size="sm"
              onPress={() => establecerModalImputarVisible(false)}
              style={{ flex: 1, minHeight: 40 }}
            />
            <Boton
              title={`Imputar ${horasValor} HH`}
              variant="primary"
              size="sm"
              icon="checkmark-done-outline"
              onPress={manejarEnviarManualHoras}
              style={{ flex: 1.5, minHeight: 40 }}
            />
          </View>
        </VistaModal>

        {/* =====================================================================
            MODAL 2: EDITAR HORAS DE JORNADA REGISTRADA
            ===================================================================== */}
        <VistaModal
          visible={Boolean(editandoHora)}
          onClose={() => establecerEditandoHora(null)}
          title="Editar Jornada Registrada"
          subtitle={
            editandoHora
              ? `${editandoHora.technicianName || "Técnico"} • ${editandoHora.projectCode} (${formatearFecha(editandoHora.date)})`
              : ""
          }
          maxWidth={500}
        >
          <Text style={estilos.subCampoEtiqueta}>Horas Hombre (Bloques de 0,5 h):</Text>
          <View style={estilos.horasAjustadorFila}>
            <TouchableOpacity
              onPress={() =>
                establecerEditarHorasValor((p) => Math.max(0.5, Math.round((p - 0.5) * 2) / 2))
              }
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
              onPress={() =>
                establecerEditarHorasValor((p) => Math.min(24.0, Math.round((p + 0.5) * 2) / 2))
              }
              style={estilos.horaPasoBoton}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color={tema.colors.primaryDark} />
              <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
            </TouchableOpacity>
          </View>

          <View style={[estilos.rapidoHorasFila, { marginBottom: 12 }]}>
            {[2.0, 4.0, 6.0, 8.0, 9.0, 10.0].map((h) => {
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

          <CampoTexto
            label="Descripción / Motivo del Ajuste"
            icon="document-text-outline"
            value={editarDescripcion}
            onChangeText={establecerEditarDescripcion}
            containerStyle={{ marginBottom: 6 }}
          />

          {Boolean(editarError) && <Text style={estilos.errorTexto}>{editarError}</Text>}

          <View style={estilos.modalBotonesFila}>
            <Boton
              title="Cancelar"
              variant="outline"
              size="sm"
              onPress={() => establecerEditandoHora(null)}
              style={{ flex: 1, minHeight: 40 }}
            />
            <Boton
              title="Guardar Cambios"
              variant="primary"
              size="sm"
              icon="save-outline"
              onPress={manejarConfirmarEditarHora}
              style={{ flex: 1.4, minHeight: 40 }}
            />
          </View>
        </VistaModal>
      </View>
    </ContenedorEstadoPantalla>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollContenedor: {
    flex: 1,
  },
  scrollCuerpo: {
    padding: tema.spacing.md,
    paddingBottom: 48,
  },
  subCampoEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  horasAjustadorFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 6,
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    minHeight: 48,
  },
  horaPasoBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.sm,
    minHeight: 38,
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
    fontSize: 20,
    fontWeight: "900",
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
    marginTop: 8,
  },
  rapidoHoraChip: {
    flexGrow: 1,
    minWidth: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    minHeight: 34,
  },
  rapidoHoraChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  rapidoHoraTexto: {
    fontSize: 11,
    color: tema.colors.text,
    fontWeight: "700",
  },
  rapidoHoraTextoActivo: {
    color: "#ffffff",
    fontWeight: "800",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    padding: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: "#fca5a5",
    marginBottom: 10,
  },
  errorBannerTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "600",
    flex: 1,
  },
  modalBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 8,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    marginTop: 6,
  },
});
