import React, { useState, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { HoraTrabajoTecnico } from "@/nucleo/tipos";

// Common components
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";

export const PantallaHorasManualesAdmin: React.FC = () => {
  const {
    tecnicos,
    proyectos,
    horasTecnico,
    registrarHorasManualesAdmin,
    actualizarHoraTrabajoTecnico,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  // Helper date presets
  const obtenerPresetFecha = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const hoyCadena = obtenerPresetFecha(0);

  // Form state
  const activoProyectos = useMemo(
    () => proyectos.filter((p) => p.status !== "cerrado"),
    [proyectos]
  );

  const [seleccionadoTecnicoRut, establecerSeleccionadoTecnicoRut] = useState<string>(
    tecnicos[0]?.rut || ""
  );
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    activoProyectos[0]?.id || ""
  );
  const [trabajoFecha, establecerTrabajoFecha] = useState<string>(hoyCadena);
  const [horasValor, establecerHorasValor] = useState<number>(8.0);
  const [seleccionadoMotivo, establecerSeleccionadoMotivo] = useState<string>(
    "Falla de Batería en Faena"
  );
  const [trabajoDescripcion, establecerTrabajoDescripcion] = useState<string>(
    "Montaje de circuitos y conexionado de fuerza no cronometrado por falta de batería."
  );

  // Status feedback
  const [formularioError, establecerFormularioError] = useState<string>("");
  const [formularioExito, establecerFormularioExito] = useState<string>("");

  // History filter
  const [filtrarTecnico, establecerFiltrarTecnico] = useState<string>("todos");
  const [filtrarProyecto, establecerFiltrarProyecto] = useState<string>("todos");

  // Edit Modal State
  const [editandoHora, establecerEditandoHora] = useState<HoraTrabajoTecnico | null>(null);
  const [editarHorasValor, establecerEditarHorasValor] = useState<number>(8.0);
  const [editarDescripcion, establecerEditarDescripcion] = useState<string>("");
  const [editarError, establecerEditarError] = useState<string>("");

  const seleccionadoTecnico = tecnicos.find((t) => t.rut === seleccionadoTecnicoRut);
  const seleccionadoProyecto = proyectos.find((p) => p.id === seleccionadoProyectoId);
  const porHoraTarifa = seleccionadoProyecto?.hourlyRate || 18500;
  const costoManoObra = horasValor * porHoraTarifa;

  // Existing daily hours for selected technician on chosen date
  const tecnicoDailyHoras = horasTecnico
    .filter(
      (h) =>
        (h.technicianRut === seleccionadoTecnicoRut ||
          (!h.technicianRut && seleccionadoTecnicoRut === "14.234.567-8")) &&
        h.date === trabajoFecha
    )
    .reduce((sum, h) => sum + h.hours, 0);

  const MOTIVO_PRESETS = [
    "Falla de Batería en Faena",
    "Sin Cobertura / Dispositivo Desconectado",
    "Olvido de Inicio de Cronómetro",
    "Horas Extraordinarias Autorizadas",
    "Reemplazo Operativo en Terreno",
  ];

  const manejarPasoHoras = (delta: number) => {
    establecerHorasValor((prev) => {
      const siguiente = Math.round((prev + delta) * 2) / 2;
      return Math.max(0.5, Math.min(24.0, siguiente));
    });
  };

  const manejarEnviarManualHoras = () => {
    establecerFormularioError("");
    establecerFormularioExito("");

    if (!seleccionadoTecnico) {
      establecerFormularioError("Debe seleccionar un técnico.");
      return;
    }
    if (!seleccionadoProyecto) {
      establecerFormularioError("Debe seleccionar un proyecto.");
      return;
    }
    if (!trabajoFecha.trim()) {
      establecerFormularioError("Ingrese una fecha válida (YYYY-MM-DD).");
      return;
    }
    if (horasValor <= 0 || horasValor > 24) {
      establecerFormularioError("Las horas deben ser entre 0,5 y 24 horas por día.");
      return;
    }

    const resultado = registrarHorasManualesAdmin({
      technicianRut: seleccionadoTecnico.rut,
      technicianName: seleccionadoTecnico.name,
      projectId: seleccionadoProyecto.id,
      date: trabajoFecha,
      hours: horasValor,
      description: trabajoDescripcion.trim() || `Labor registrada manualmente por Administración (${seleccionadoMotivo}).`,
      reason: seleccionadoMotivo,
    });

    if (!resultado.success) {
      establecerFormularioError(resultado.error || "Error al registrar las horas del técnico.");
    } else {
      establecerFormularioExito(
        `✓ ${horasValor} HH asignadas con éxito al técnico ${seleccionadoTecnico.name} en el proyecto ${seleccionadoProyecto.code} (${formatearCLP(costoManoObra)} imputados a H27/H28).`
      );
      setTimeout(() => establecerFormularioExito(""), 5000);
    }
  };

  // Filtered History
  const filtradoHistorial = useMemo(() => {
    return horasTecnico.filter((h) => {
      if (filtrarTecnico !== "todos") {
        const coincidenciasTecnico =
          h.technicianRut === filtrarTecnico ||
          (!h.technicianRut && filtrarTecnico === "14.234.567-8");
        if (!coincidenciasTecnico) return false;
      }
      if (filtrarProyecto !== "todos" && h.projectId !== filtrarProyecto) {
        return false;
      }
      return true;
    });
  }, [horasTecnico, filtrarTecnico, filtrarProyecto]);

  const manejarAbrirEditarHora = (h: HoraTrabajoTecnico) => {
    establecerEditandoHora(h);
    establecerEditarHorasValor(h.hours);
    establecerEditarDescripcion(h.description);
    establecerEditarError("");
  };

  const manejarConfirmarEditarHora = () => {
    if (!editandoHora) return;
    const res = actualizarHoraTrabajoTecnico(editandoHora.id, editarHorasValor, editarDescripcion, "admin");
    if (!res.success) {
      establecerEditarError(res.error || "Error al actualizar horas.");
    } else {
      establecerEditandoHora(null);
    }
  };

  return (
    <ContenedorEstadoPantalla>
      <View style={estilos.contenedor}>
        {/* Encabezado limpio y responsivo (ancho completo edge-to-edge) */}
        <EncabezadoPagina
          title="Carga Manual de Horas (Admin)"
          subtitle="Imputación extraordinaria de horas hombre para técnicos cuando no se haya registrado automáticamente en faena."
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.scrollCuerpo}>

        {/* 1. SELECCIÓN DE TÉCNICO */}
        <Tarjeta variant="elevated" style={estilos.seccionTarjeta}>
          <View style={estilos.seccionEncabezadoFila}>
            <Ionicons name="person-circle-outline" size={20} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.seccionTitulo}>1. Seleccionar Técnico Operativo</Text>
          </View>
          <Text style={estilos.seccionSub}>
            Selecciona el técnico en terreno al cual se le imputará la jornada laboral no cronometrada:
          </Text>

          <View style={estilos.tecnicoListaGrilla}>
            {tecnicos.map((t) => {
              const esSel = t.rut === seleccionadoTecnicoRut;
              return (
                <TouchableOpacity
                  key={t.rut}
                  onPress={() => establecerSeleccionadoTecnicoRut(t.rut)}
                  style={[estilos.tecnicoChip, esSel && estilos.tecnicoChipActivo]}
                  activeOpacity={0.7}
                >
                  <View style={[estilos.tecnicoAvatar, esSel && estilos.tecnicoAvatarActivo]}>
                    <Ionicons
                      name="construct"
                      size={16}
                      color={esSel ? "#ffffff" : tema.colors.primaryDark}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[estilos.tecnicoNombreTexto, esSel && estilos.tecnicoNombreTextoActivo]}>
                      {t.name}
                    </Text>
                    <Text style={[estilos.tecnicoMetaTexto, esSel && estilos.tecnicoMetaTextoActivo]}>
                      {t.specialty} • RUT: {t.rut}
                    </Text>
                  </View>
                  {esSel && (
                    <Ionicons name="checkmark-circle" size={18} color="#f59e0b" style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Tarjeta>

        {/* 2. SELECCIÓN DE PROYECTO / FAENA */}
        <Tarjeta variant="elevated" style={estilos.seccionTarjeta}>
          <View style={estilos.seccionEncabezadoFila}>
            <Ionicons name="business-outline" size={20} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.seccionTitulo}>2. Seleccionar Proyecto o Faena</Text>
          </View>
          <Text style={estilos.seccionSub}>
            Obra activa donde el técnico ejecutó sus labores:
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.horizontalScroll}>
            {activoProyectos.map((p) => {
              const esSel = p.id === seleccionadoProyectoId;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => establecerSeleccionadoProyectoId(p.id)}
                  style={[estilos.proyectoChip, esSel && estilos.proyectoChipActivo]}
                  activeOpacity={0.7}
                >
                  <Text style={[estilos.proyectoChipCodigo, esSel && estilos.proyectoChipCodigoActivo]}>
                    {p.code}
                  </Text>
                  <Text style={[estilos.proyectoChipNombre, esSel && estilos.proyectoChipNombreActivo]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[estilos.proyectoChipTarifa, esSel && estilos.proyectoChipTarifaActivo]}>
                    Tarifa: {formatearCLP(p.hourlyRate || 18500)} / HH
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Tarjeta>

        {/* 3. FECHA Y HORAS HOMBRE */}
        <Tarjeta variant="elevated" style={estilos.seccionTarjeta}>
          <View style={estilos.seccionEncabezadoFila}>
            <Ionicons name="time-outline" size={20} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.seccionTitulo}>3. Fecha de Trabajo y Jornada (HH)</Text>
          </View>

          {/* Selector de Fecha */}
          <Text style={estilos.subCampoEtiqueta}>Fecha de ejecución en faena:</Text>
          <View style={estilos.rapidoFechaFila}>
            {[
              { label: "Hoy", val: obtenerPresetFecha(0), icon: "calendar" as const },
              { label: "Ayer", val: obtenerPresetFecha(1), icon: "time-outline" as const },
              { label: "Anteayer", val: obtenerPresetFecha(2), icon: "play-back-outline" as const },
            ].map((d) => {
              const esSel = trabajoFecha === d.val;
              return (
                <TouchableOpacity
                  key={d.val}
                  onPress={() => establecerTrabajoFecha(d.val)}
                  style={[estilos.rapidoFechaChip, esSel && estilos.rapidoFechaChipActivo]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={d.icon}
                    size={13}
                    color={esSel ? "#ffffff" : tema.colors.primaryDark}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[estilos.rapidoFechaTexto, esSel && estilos.rapidoFechaTextoActivo]}>
                    {d.label} ({d.val.slice(5)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <CampoTexto
            label="Fecha (YYYY-MM-DD)"
            value={trabajoFecha}
            onChangeText={establecerTrabajoFecha}
            placeholder="YYYY-MM-DD"
            icon="calendar-outline"
            containerStyle={{ marginBottom: 14 }}
          />

          {/* Stepper Táctil Bloques 0.5 h */}
          <View style={estilos.horasEncabezadoFila}>
            <Text style={estilos.subCampoEtiqueta}>Horas Hombre a Imputar (Bloques 0,5 h):</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Insignia
                label={`Acumulado día: ${tecnicoDailyHoras.toFixed(1)} / 24h`}
                tone={tecnicoDailyHoras + horasValor > 24 ? "danger" : "warn"}
                size="sm"
              />
            </View>
          </View>

          <View style={estilos.horasAjustadorFila}>
            <TouchableOpacity
              onPress={() => manejarPasoHoras(-0.5)}
              style={estilos.horaPasoBoton}
              activeOpacity={0.7}
              accessibilityLabel="Restar media hora"
            >
              <Ionicons name="remove" size={18} color={tema.colors.primaryDark} />
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
              accessibilityLabel="Sumar media hora"
            >
              <Ionicons name="add" size={18} color={tema.colors.primaryDark} />
              <Text style={estilos.horaPasoBotonTexto}>0.5 h</Text>
            </TouchableOpacity>
          </View>

          {/* Chips Rápidos Horas */}
          <View style={estilos.rapidoHorasFila}>
            {[4.0, 4.5, 8.0, 8.5, 9.0, 9.5].map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => establecerHorasValor(val)}
                style={[estilos.rapidoHoraChip, horasValor === val && estilos.rapidoHoraChipActivo]}
                activeOpacity={0.7}
              >
                <Text style={[estilos.rapidoHoraTexto, horasValor === val && estilos.rapidoHoraTextoActivo]}>
                  {val} h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Tarjeta>

        {/* 4. MOTIVO Y DESCRIPCIÓN */}
        <Tarjeta variant="elevated" style={estilos.seccionTarjeta}>
          <View style={estilos.seccionEncabezadoFila}>
            <Ionicons name="document-text-outline" size={20} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.seccionTitulo}>4. Motivo y Justificación de Carga Extraordinaria</Text>
          </View>
          <Text style={estilos.seccionSub}>
            Indica la razón por la cual no se registró automáticamente mediante cronómetro en faena:
          </Text>

          <View style={estilos.motivoWrap}>
            {MOTIVO_PRESETS.map((r) => {
              const esSel = seleccionadoMotivo === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => establecerSeleccionadoMotivo(r)}
                  style={[estilos.motivoChip, esSel && estilos.motivoChipActivo]}
                  activeOpacity={0.7}
                >
                  <Text style={[estilos.motivoChipTexto, esSel && estilos.motivoChipTextoActivo]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <CampoTexto
            label="Descripción detallada de las labores ejecutadas"
            value={trabajoDescripcion}
            onChangeText={establecerTrabajoDescripcion}
            placeholder="Ej: Montaje de cuadros eléctricos, cableado y canalización en piso 3..."
            containerStyle={{ marginTop: 10 }}
          />
        </Tarjeta>

        {/* 5. PREVISUALIZACIÓN FINANCIERA H27 / H28 */}
        <Tarjeta variant="default" style={estilos.financialVistaPreviaTarjeta}>
          <View style={estilos.manualCostoIconoCaja}>
            <Ionicons name="calculator-outline" size={22} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={estilos.financialFormula}>
              {horasValor.toFixed(1)} HH × {formatearCLP(porHoraTarifa)} / HH
            </Text>
            <Text style={estilos.financialTotal}>
              Costo M.O. Real a Imputar: {formatearCLP(costoManoObra)} CLP
            </Text>
            <Text style={estilos.financialFootnote}>
              Alimenta directamente el Costo Real H27 y la Liquidación Financiera H28 de {seleccionadoProyecto?.code}.
            </Text>
          </View>
        </Tarjeta>

        {Boolean(formularioError) && (
          <View style={estilos.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={tema.colors.danger} style={{ marginRight: 6 }} />
            <Text style={estilos.errorBannerTexto}>{formularioError}</Text>
          </View>
        )}

        {Boolean(formularioExito) && (
          <View style={estilos.exitoBanner}>
            <Ionicons name="checkmark-circle" size={18} color={tema.colors.ok} style={{ marginRight: 6 }} />
            <Text style={estilos.exitoBannerTexto}>{formularioExito}</Text>
          </View>
        )}

        <Boton
          title={`Imputar ${horasValor} HH a ${seleccionadoTecnico?.name || "Técnico"}`}
          variant="primary"
          icon="checkmark-done"
          onPress={manejarEnviarManualHoras}
          style={{ height: 50, marginTop: 4, marginBottom: 24 }}
        />

        {/* ========================================================================= */}
        {/* HISTORIAL GLOBAL DE JORNADAS (CON FILTROS Y EDICIÓN ADMIN)               */}
        {/* ========================================================================= */}
        <Tarjeta variant="elevated" style={estilos.historialTarjetaSeccion}>
          <View style={estilos.seccionEncabezadoFila}>
            <Ionicons name="receipt-outline" size={20} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.seccionTitulo}>Historial Global de Jornadas Registradas</Text>
          </View>
          <Text style={estilos.seccionSub}>
            Auditoría de horas registradas por cronómetro automático o por carga manual administrativa:
          </Text>

          {/* Filtros */}
          <View style={estilos.filtrarFila}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={estilos.filtrarEtiqueta}>Filtrar por Técnico:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => establecerFiltrarTecnico("todos")}
                  style={[estilos.filtrarChip, filtrarTecnico === "todos" && estilos.filtrarChipActivo]}
                >
                  <Text style={[estilos.filtrarChipTexto, filtrarTecnico === "todos" && estilos.filtrarChipTextoActivo]}>
                    Todos ({horasTecnico.length})
                  </Text>
                </TouchableOpacity>
                {tecnicos.map((t) => {
                  const esSel = filtrarTecnico === t.rut;
                  return (
                    <TouchableOpacity
                      key={t.rut}
                      onPress={() => establecerFiltrarTecnico(t.rut)}
                      style={[estilos.filtrarChip, esSel && estilos.filtrarChipActivo]}
                    >
                      <Text style={[estilos.filtrarChipTexto, esSel && estilos.filtrarChipTextoActivo]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {filtradoHistorial.length === 0 ? (
            <EstadoVacio
              icon="time-outline"
              title="Sin registros de horas"
              description="No hay jornadas registradas para los filtros seleccionados."
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            filtradoHistorial.map((h) => {
              const proyecto = proyectos.find((p) => p.id === h.projectId);
              const tarifa = proyecto?.hourlyRate || 18500;
              const costoReal = h.hours * tarifa;
              const tecnicoNombre = h.technicianName || "Alejandro Ramírez";

              return (
                <View key={h.id} style={estilos.historialFilaTarjeta}>
                  <View style={estilos.historialFilaSuperior}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={estilos.historialFilaTecnico}>{tecnicoNombre}</Text>
                      <Text style={estilos.historialFilaProyecto}>
                        {h.projectCode} • {h.projectName}
                      </Text>
                      <Text style={estilos.historialFilaFecha}>
                        Fecha trabajada: {formatearFecha(h.date)} • Imputado: {formatearCLP(costoReal)}
                      </Text>
                      <Text style={estilos.historialFilaDescripcion}>{h.description}</Text>
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
                    </View>
                  </View>

                  <View style={estilos.historialFilaAcciones}>
                    <Boton
                      title="Editar (Permiso Admin)"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarHora(h)}
                      style={{ height: 36 }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Tarjeta>

        {/* MODAL PARA EDITAR HORAS (ADMINISTRADOR) */}
        <VistaModal
          visible={Boolean(editandoHora)}
          onClose={() => establecerEditandoHora(null)}
          title="Ajuste Administrativo de Horas"
          subtitle={editandoHora ? `${editandoHora.projectCode} • ${formatearFecha(editandoHora.date)}` : ""}
        >
          <View style={estilos.adminModalAviso}>
            <Ionicons name="shield-checkmark" size={16} color={tema.colors.warnDark} style={{ marginRight: 6 }} />
            <Text style={estilos.adminModalAvisoTexto}>
              Permiso de Administrador: Los cambios recalcularán automáticamente el Costo Real H27 y Rentabilidad H28 del proyecto.
            </Text>
          </View>

          <Text style={estilos.subCampoEtiqueta}>Horas (Bloques de 0,5 h, máx 24):</Text>
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
              label="Motivo / Justificación del Ajuste"
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
              title="Guardar Ajuste (H27/H28)"
              variant="primary"
              onPress={manejarConfirmarEditarHora}
              style={{ flex: 2, height: 46 }}
            />
          </View>
        </VistaModal>
        </ScrollView>
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
  seccionTarjeta: {
    marginBottom: tema.spacing.md,
    backgroundColor: tema.colors.card,
  },
  seccionEncabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  seccionTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  seccionSub: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 12,
  },
  tecnicoListaGrilla: {
    gap: 8,
  },
  tecnicoChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    minHeight: 52,
  },
  tecnicoChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  tecnicoAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  tecnicoAvatarActivo: {
    backgroundColor: tema.colors.primaryDark,
    borderColor: "#f59e0b",
  },
  tecnicoNombreTexto: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tecnicoNombreTextoActivo: {
    color: "#f59e0b",
  },
  tecnicoMetaTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  tecnicoMetaTextoActivo: {
    color: "#d6d3d1",
  },
  horizontalScroll: {
    flexDirection: "row",
  },
  proyectoChip: {
    padding: 12,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    marginRight: 10,
    minWidth: 170,
  },
  proyectoChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  proyectoChipCodigo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  proyectoChipCodigoActivo: {
    color: "#f59e0b",
  },
  proyectoChipNombre: {
    fontSize: 11,
    color: tema.colors.text,
    marginVertical: 2,
  },
  proyectoChipNombreActivo: {
    color: "#ffffff",
  },
  proyectoChipTarifa: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  proyectoChipTarifaActivo: {
    color: "#fde68a",
  },
  subCampoEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  horasEncabezadoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
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
  motivoWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  motivoChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  motivoChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  motivoChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  motivoChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  financialVistaPreviaTarjeta: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
  },
  financialFormula: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  financialTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginTop: 2,
  },
  financialFootnote: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
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
  exitoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    padding: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: "#86efac",
    marginBottom: 10,
  },
  exitoBannerTexto: {
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
    flex: 1,
  },
  historialTarjetaSeccion: {
    backgroundColor: tema.colors.card,
    marginTop: 10,
  },
  filtrarFila: {
    flexDirection: "row",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  filtrarEtiqueta: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  filtrarChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 6,
  },
  filtrarChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  filtrarChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  filtrarChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  historialFilaTarjeta: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 12,
    marginBottom: 10,
  },
  historialFilaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historialFilaTecnico: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  historialFilaProyecto: {
    fontSize: 11,
    color: tema.colors.primaryDark,
    fontWeight: "600",
    marginTop: 1,
  },
  historialFilaFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  historialFilaDescripcion: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  historialFilaAcciones: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    alignItems: "flex-end",
  },
  adminModalAviso: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 12,
  },
  adminModalAvisoTexto: {
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
    flex: 1,
  },
  modalBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    marginTop: 6,
  },
});
