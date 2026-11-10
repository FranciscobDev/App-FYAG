import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  ContenedorEstadoPantalla,
  EstadoVacio,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  ESTADOS_PROYECTO,
  FormularioProyecto,
  Proyecto,
  TIPOS_PROYECTO,
  actualizarProyecto,
  crearProyecto,
  eliminarProyecto,
  listarProyectos,
} from "./proyectosApi";
import { KitProyecto } from "@/nucleo/tipos";
import { listarKits } from "./kitsApi";
import { ModalGestionKits } from "./ModalGestionKits";
import { SelectorFecha } from "@/componentes/formularios/SelectorFecha";
import { estilos } from "./estilos";
import { SeccionTecnicos } from "./SeccionTecnicos";

const formularioVacio = (idUsuario: number | null): FormularioProyecto => ({
  nombre_proyecto: "",
  tipo_proyecto: TIPOS_PROYECTO[0],
  cliente: "",
  direccion: "",
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_fin: null,
  presupuesto_inicial: 0,
  presupuesto_horas: 0,
  valor_venta: 0,
  porcentaje_avance: 0,
  estado_proyecto: ESTADOS_PROYECTO[0],
  id_usuario: idUsuario,
});

const colorAvance = (porcentaje: number) => {
  if (porcentaje >= 100) return "#16a34a";
  if (porcentaje > 0) return tema.colors.primary;
  return "#9ca3af";
};

export const PantallaProyectos: React.FC = () => {
  const { usuario } = usarAutenticacion();
  const idUsuario: number | null =
    (usuario as unknown as { id_usuario?: number })?.id_usuario ?? null;

  const [cargando, establecerCargando] = useState(true);
  const [proyectos, establecerProyectos] = useState<Proyecto[]>([]);
  const [error, establecerError] = useState<string | null>(null);

  const [busqueda, establecerBusqueda] = useState("");
  const [filtroEstado, establecerFiltroEstado] = useState<string>("todos");

  const [seleccionado, establecerSeleccionado] = useState<Proyecto | null>(null);

  const [modalVisible, establecerModalVisible] = useState(false);
  const [editando, establecerEditando] = useState<Proyecto | null>(null);
  const [formulario, establecerFormulario] = useState<FormularioProyecto>(
    formularioVacio(idUsuario)
  );
  const [errorFormulario, establecerErrorFormulario] = useState("");
  const [guardando, establecerGuardando] = useState(false);

  // Kits predeterminados
  const [kits, establecerKits] = useState<KitProyecto[]>([]);
  const [modalKitsVisible, establecerModalKitsVisible] = useState(false);

  const [aviso, establecerAviso] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAviso(msg);
    setTimeout(() => establecerAviso(null), 3500);
  };

  const cargar = useCallback(async () => {
    establecerCargando(true);
    const [resProy, resKits] = await Promise.all([listarProyectos(), listarKits()]);
    if (resProy.ok && resProy.data) {
      establecerProyectos(resProy.data);
      establecerError(null);
    } else {
      establecerError(resProy.error ?? "Error al cargar proyectos");
    }
    if (resKits.ok && resKits.data) {
      establecerKits(resKits.data);
    }
    establecerCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proyectosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (filtroEstado !== "todos" && p.estado_proyecto !== filtroEstado) return false;
      if (q) {
        const coincide =
          p.nombre_proyecto.toLowerCase().includes(q) ||
          (p.cliente ?? "").toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [proyectos, busqueda, filtroEstado]);

  const abrirNuevo = () => {
    establecerEditando(null);
    establecerFormulario(formularioVacio(idUsuario));
    establecerErrorFormulario("");
    establecerModalVisible(true);
  };

  const manejarKitSeleccionadoDesdeGestion = (kit: KitProyecto) => {
    establecerFormulario((prev) => ({
      ...prev,
      presupuesto_inicial: kit.costo_total ?? 0,
      id_kit_proyecto: kit.id_kit_proyecto,
    }));
    establecerModalVisible(true);
  };

  const abrirEditar = (p: Proyecto) => {
    establecerEditando(p);
    establecerFormulario({
      nombre_proyecto: p.nombre_proyecto,
      tipo_proyecto: p.tipo_proyecto,
      cliente: p.cliente ?? "",
      direccion: p.direccion ?? "",
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      presupuesto_inicial: p.presupuesto_inicial,
      presupuesto_horas: p.presupuesto_horas,
      valor_venta: p.valor_venta,
      porcentaje_avance: p.porcentaje_avance,
      estado_proyecto: p.estado_proyecto,
      id_usuario: p.id_usuario,
    });
    establecerErrorFormulario("");
    establecerModalVisible(true);
  };

  const actualizarCampo = <K extends keyof FormularioProyecto>(
    campo: K,
    valor: FormularioProyecto[K]
  ) => establecerFormulario((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    if (!formulario.nombre_proyecto.trim()) {
      establecerErrorFormulario("El nombre del proyecto es obligatorio.");
      return;
    }

    if (
      formulario.fecha_inicio &&
      formulario.fecha_fin &&
      formulario.fecha_fin < formulario.fecha_inicio
    ) {
      establecerErrorFormulario("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    const payload: FormularioProyecto = {
      ...formulario,
      nombre_proyecto: formulario.nombre_proyecto.trim(),
      cliente: formulario.cliente?.trim() || null,
      direccion: formulario.direccion?.trim() || null,
      presupuesto_inicial: Number(formulario.presupuesto_inicial) || 0,
      presupuesto_horas: Number(formulario.presupuesto_horas) || 0,
      valor_venta: Number(formulario.valor_venta) || 0,
      porcentaje_avance: Number(formulario.porcentaje_avance) || 0,
    };

    establecerGuardando(true);
    const res = editando
      ? await actualizarProyecto(editando.id_proyecto, payload)
      : await crearProyecto(payload);
    establecerGuardando(false);

    if (!res.ok || !res.data) {
      establecerErrorFormulario(res.error ?? "Error al guardar el proyecto");
      return;
    }

    const guardado = res.data.proyecto;
    establecerProyectos((prev) =>
      editando
        ? prev.map((p) => (p.id_proyecto === guardado.id_proyecto ? guardado : p))
        : [...prev, guardado]
    );
    if (seleccionado?.id_proyecto === guardado.id_proyecto) {
      establecerSeleccionado(guardado);
    }
    establecerModalVisible(false);
    mostrarAviso(res.data.mensaje);
  };

  const confirmarEliminar = (p: Proyecto) => {
    const ejecutar = async () => {
      const res = await eliminarProyecto(p.id_proyecto);
      if (!res.ok || !res.data) {
        mostrarAviso(res.error ?? "Error al eliminar");
        return;
      }
      establecerProyectos((prev) => prev.filter((x) => x.id_proyecto !== p.id_proyecto));
      establecerSeleccionado(null);
      mostrarAviso(res.data.mensaje);
    };

    const mensaje = `¿Eliminar "${p.nombre_proyecto}"? Esta acción no se puede deshacer.`;

    if (Platform.OS === "web") {
      if (window.confirm(mensaje)) ejecutar();
      return;
    }

    Alert.alert("Eliminar proyecto", mensaje, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: ejecutar },
    ]);
  };

  const modal = (
    <>
      <ModalFormulario
        visible={modalVisible}
        editando={Boolean(editando)}
        formulario={formulario}
        kits={kits}
        onAbrirGestionKits={() => establecerModalKitsVisible(true)}
        error={errorFormulario}
        guardando={guardando}
        onCambiar={actualizarCampo}
        onCancelar={() => establecerModalVisible(false)}
        onGuardar={guardar}
      />
      <ModalGestionKits
        visible={modalKitsVisible}
        onClose={() => establecerModalKitsVisible(false)}
        onKitSeleccionadoParaProyecto={manejarKitSeleccionadoDesdeGestion}
        onKitsActualizados={cargar}
      />
    </>
  );

  // ---------- Vista de detalle ----------
  if (seleccionado) {
    const porcentaje = Math.min(Math.max(seleccionado.porcentaje_avance, 0), 100);
    return (
      <ContenedorEstadoPantalla screenTitle="Detalle de proyecto" skeletonType="cards">
        <View style={estilos.detalleContenedor}>
          <NotificacionFlotante
            visible={Boolean(aviso)}
            message={aviso ?? ""}
            onDismiss={() => establecerAviso(null)}
          />
          <ScrollView contentContainerStyle={estilos.detalleScroll}>
            <TouchableOpacity
              style={estilos.backBoton}
              onPress={() => establecerSeleccionado(null)}
            >
              <Ionicons name="chevron-back" size={20} color={tema.colors.primary} />
              <Text style={estilos.backTexto}>Volver al listado</Text>
            </TouchableOpacity>

            <View style={[estilos.finalAuditoriaTarjeta, { marginTop: 0 }]}>
              <View style={estilos.detalleSuperiorFila}>
                <Text style={estilos.detalleCodigo}>{seleccionado.tipo_proyecto}</Text>
                <View style={estilos.semaphoreIndicatorPastilla}>
                  <Text
                    style={[
                      estilos.semaphorePorcentajeTexto,
                      { color: colorAvance(porcentaje) },
                    ]}
                  >
                    {seleccionado.estado_proyecto}
                  </Text>
                </View>
              </View>

              <Text style={estilos.detalleNombre}>{seleccionado.nombre_proyecto}</Text>
              <Text style={estilos.detalleCliente}>
                {seleccionado.cliente ?? "Sin cliente"}
              </Text>

              <View style={estilos.detalleMetaFila}>
                <Text style={estilos.metaElemento}>
                  Dirección: {seleccionado.direccion ?? "—"}
                </Text>
                <Text style={estilos.metaElemento}>
                  Inicio:{" "}
                  {seleccionado.fecha_inicio ? formatearFecha(seleccionado.fecha_inicio) : "—"}
                </Text>
                <Text style={estilos.metaElemento}>
                  Fin: {seleccionado.fecha_fin ? formatearFecha(seleccionado.fecha_fin) : "—"}
                </Text>
              </View>

              <View style={estilos.metricsGrilla}>
                <Metrica
                  etiqueta="Presupuesto inicial"
                  valor={formatearCLP(seleccionado.presupuesto_inicial)}
                />
                <Metrica
                  etiqueta="Presupuesto horas"
                  valor={`${seleccionado.presupuesto_horas} HH`}
                />
                <Metrica
                  etiqueta="Presupuesto usado"
                  valor={formatearCLP(seleccionado.valor_venta)}
                />
                <Metrica etiqueta="Avance" valor={`${porcentaje}%`} />
              </View>

              <View style={styles.barra}>
                <View
                  style={[
                    styles.barraRelleno,
                    { width: `${porcentaje}%`, backgroundColor: colorAvance(porcentaje) },
                  ]}
                />
              </View>
            </View>

            <SeccionTecnicos
              proyectoId={seleccionado.id_proyecto}
              onAviso={mostrarAviso}
            />

            <View style={estilos.detalleAccionesFila}>
              <TouchableOpacity
                style={styles.boton}
                onPress={() => abrirEditar(seleccionado)}
              >
                <Text style={styles.botonTexto}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.boton, styles.botonPeligro]}
                onPress={() => confirmarEliminar(seleccionado)}
              >
                <Text style={styles.botonTexto}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        {modal}
      </ContenedorEstadoPantalla>
    );
  }

  // ---------- Listado ----------
  return (
    <ContenedorEstadoPantalla screenTitle="Proyectos y Obras" skeletonType="cards">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(aviso)}
          message={aviso ?? ""}
          onDismiss={() => establecerAviso(null)}
        />

        <View style={estilos.superiorBarra}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.encabezado}>Proyectos</Text>
            <Text style={estilos.seccionSubtitulo}>
              {proyectosFiltrados.length} de {proyectos.length} proyectos
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={[styles.boton, styles.botonKits]}
              onPress={() => establecerModalKitsVisible(true)}
            >
              <Ionicons name="cube-outline" size={16} color={tema.colors.primary} />
              <Text style={styles.botonKitsTexto}>Gestionar Kits</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.botonCrearProyectoGrande, styles.boton]}
              onPress={abrirNuevo}
            >
              <Text style={styles.botonTexto}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={estilos.buscarCajaEnvoltorio}>
          <Ionicons name="search" size={16} color={tema.colors.textMuted} />
          <TextInput
            style={[estilos.buscarEntradaTexto, { marginLeft: 8 }]}
            placeholder="Buscar por nombre o cliente"
            placeholderTextColor={tema.colors.textMuted}
            value={busqueda}
            onChangeText={establecerBusqueda}
          />
        </View>

        <View style={styles.filtrosWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtrosContenido}
            style={styles.filtrosScroll}
          >
            {["todos", ...ESTADOS_PROYECTO].map((e) => {
              const activo = filtroEstado === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => establecerFiltroEstado(e)}
                  style={[styles.chip, activo && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                    {e === "todos" ? "Todos" : e}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {cargando ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : error ? (
          <EstadoVacio title="No se pudieron cargar los proyectos" description={error} />
        ) : proyectosFiltrados.length === 0 ? (
          <EstadoVacio title="Sin proyectos" description="No hay proyectos que coincidan." />
        ) : (
          <ScrollView contentContainerStyle={estilos.scrollCuerpo}>
            {proyectosFiltrados.map((p) => {
              const porcentaje = Math.min(Math.max(p.porcentaje_avance, 0), 100);
              const color = colorAvance(porcentaje);
              return (
                <Pressable
                  key={p.id_proyecto}
                  style={[
                    estilos.finalAuditoriaTarjeta,
                    estilos.proyectoListaTarjeta,
                    { marginTop: 0 },
                  ]}
                  onPress={() => establecerSeleccionado(p)}
                >
                  <View style={estilos.tarjetaSuperior}>
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.codigoTexto}>{p.tipo_proyecto}</Text>
                      <Text style={estilos.nombreTexto} numberOfLines={2}>
                        {p.nombre_proyecto}
                      </Text>
                      <Text style={estilos.clienteTexto}>
                        {p.cliente ?? "Sin cliente"}
                      </Text>
                    </View>
                    <View style={estilos.semaphoreIndicatorPastilla}>
                      <View style={[estilos.semaphorePunto, { backgroundColor: color }]} />
                      <Text style={[estilos.semaphorePorcentajeTexto, { color }]}>
                        {porcentaje}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.barra}>
                    <View
                      style={[
                        styles.barraRelleno,
                        { width: `${porcentaje}%`, backgroundColor: color },
                      ]}
                    />
                  </View>

                  <View style={estilos.costoSemaphoreFila}>
                    <Text style={estilos.costoEtiqueta}>Presupuesto usado</Text>
                    <Text style={estilos.costoValoresTexto}>
                      {formatearCLP(p.valor_venta)}
                    </Text>
                  </View>

                  <View style={estilos.tarjetaInferiorFila}>
                    <Text style={estilos.costoEtiqueta}>{p.estado_proyecto}</Text>
                    <Text style={estilos.fechasTexto}>
                      {p.fecha_inicio ? formatearFecha(p.fecha_inicio) : "—"} ·{" "}
                      {p.fecha_fin ? formatearFecha(p.fecha_fin) : "—"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
      {modal}
    </ContenedorEstadoPantalla>
  );
};

// ---------- Subcomponentes ----------

const Metrica: React.FC<{ etiqueta: string; valor: string }> = ({ etiqueta, valor }) => (
  <View style={estilos.metricCelda}>
    <Text style={estilos.metricLbl}>{etiqueta}</Text>
    <Text style={estilos.metricValor}>{valor}</Text>
  </View>
);

type CampoNumerico =
  | "presupuesto_inicial"
  | "presupuesto_horas"
  | "valor_venta"
  | "porcentaje_avance";

type ModalProps = {
  visible: boolean;
  editando: boolean;
  formulario: FormularioProyecto;
  kits: KitProyecto[];
  onAbrirGestionKits: () => void;
  error: string;
  guardando: boolean;
  onCambiar: <K extends keyof FormularioProyecto>(c: K, v: FormularioProyecto[K]) => void;
  onCancelar: () => void;
  onGuardar: () => void;
};

const ModalFormulario: React.FC<ModalProps> = ({
  visible,
  editando,
  formulario,
  kits,
  onAbrirGestionKits,
  error,
  guardando,
  onCambiar,
  onCancelar,
  onGuardar,
}) => {
  const kitSeleccionado = kits.find((k) => k.id_kit_proyecto === formulario.id_kit_proyecto);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancelar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* HEADER MODAL */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeaderTag}>
                <Ionicons name="briefcase-outline" size={13} color={tema.colors.primary} />
                <Text style={styles.modalHeaderTagTexto}>
                  {editando ? "EDICIÓN DE PROYECTO" : "GESTIÓN DE OBRAS"}
                </Text>
              </View>
              <Text style={styles.modalTitulo}>
                {editando ? `Editar Proyecto: ${formulario.nombre_proyecto || "Sin nombre"}` : "Crear Nuevo Proyecto"}
              </Text>
              <Text style={styles.modalSubtitulo}>
                Define la información técnica, plazos, kit de insumos y presupuestos asignados.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.btnCerrarModal}
              onPress={onCancelar}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={tema.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* CUERPO CON SCROLL */}
          <ScrollView
            style={styles.modalScrollCuerpo}
            contentContainerStyle={{ padding: 18, paddingBottom: 28 }}
            showsVerticalScrollIndicator={true}
          >
            {/* SECCIÓN 1: INFORMACIÓN GENERAL */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="business-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>1. Información General</Text>
              </View>

              <Text style={styles.campoEtiqueta}>Nombre del Proyecto *</Text>
              <View style={styles.inputContenedorConIcono}>
                <Ionicons name="document-text-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                <TextInput
                  style={styles.inputConIcono}
                  placeholder="Ej: Montaje Tableros Centro Logístico Quilicura"
                  placeholderTextColor={tema.colors.textMuted}
                  value={formulario.nombre_proyecto}
                  onChangeText={(t) => onCambiar("nombre_proyecto", t)}
                />
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Cliente / Empresa</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="person-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      placeholder="Ej: Retail & Logística S.A."
                      placeholderTextColor={tema.colors.textMuted}
                      value={formulario.cliente ?? ""}
                      onChangeText={(t) => onCambiar("cliente", t)}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Dirección de la Faena</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="location-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      placeholder="Ej: Camino El Alba 1200, Quilicura"
                      placeholderTextColor={tema.colors.textMuted}
                      value={formulario.direccion ?? ""}
                      onChangeText={(t) => onCambiar("direccion", t)}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* SECCIÓN 2: CLASIFICACIÓN Y ESTADO */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="options-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>2. Clasificación y Estado</Text>
              </View>

              <View style={styles.dosColumnasFila}>
                {/* Tipo de proyecto */}
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Tipo de Proyecto</Text>
                  <View style={styles.segmentedRow}>
                    {TIPOS_PROYECTO.map((o) => {
                      const activo = formulario.tipo_proyecto === o;
                      const iconName = o === "Instalacion" ? "construct-outline" : "hammer-outline";
                      return (
                        <TouchableOpacity
                          key={o}
                          style={[styles.segmentBtn, activo && styles.segmentBtnActivo]}
                          onPress={() => onCambiar("tipo_proyecto", o)}
                        >
                          <Ionicons
                            name={iconName}
                            size={14}
                            color={activo ? "#ffffff" : "#4b5563"}
                          />
                          <Text style={[styles.segmentBtnTexto, activo && styles.segmentBtnTextoActivo]}>
                            {o === "Instalacion" ? "Instalación" : "Mantención"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Estado inicial */}
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Estado Inicial</Text>
                  <View style={styles.segmentedRow}>
                    {ESTADOS_PROYECTO.map((o) => {
                      const activo = formulario.estado_proyecto === o;
                      return (
                        <TouchableOpacity
                          key={o}
                          style={[styles.segmentBtn, activo && styles.segmentBtnActivo]}
                          onPress={() => onCambiar("estado_proyecto", o)}
                        >
                          <Text style={[styles.segmentBtnTexto, activo && styles.segmentBtnTextoActivo]}>
                            {o}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* SECCIÓN 3: PLAZOS Y FECHAS */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="calendar-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>3. Plazos de Ejecución</Text>
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <SelectorFecha
                    label="Fecha de Inicio"
                    required
                    value={formulario.fecha_inicio ?? ""}
                    onChangeDate={(date) => {
                      onCambiar("fecha_inicio", date);
                      if (formulario.fecha_fin && formulario.fecha_fin < date) {
                        onCambiar("fecha_fin", date);
                      }
                    }}
                    placeholder="Seleccionar inicio"
                  />
                </View>

                <View style={{ flex: 1, minWidth: 200 }}>
                  <SelectorFecha
                    label="Fecha de Fin"
                    value={formulario.fecha_fin ?? ""}
                    onChangeDate={(date) => onCambiar("fecha_fin", date)}
                    onClear={() => onCambiar("fecha_fin", null)}
                    minDate={formulario.fecha_inicio ?? undefined}
                    error={
                      formulario.fecha_inicio && formulario.fecha_fin && formulario.fecha_fin < formulario.fecha_inicio
                        ? "La fecha de fin no puede ser anterior al inicio"
                        : undefined
                    }
                    placeholder="Sin fecha límite (opcional)"
                    helper="Toca para definir el plazo límite"
                  />
                </View>
              </View>
            </View>

            {/* SECCIÓN 4: ASIGNACIÓN DE KIT PREDETERMINADO */}
            {!editando && (
              <View style={[styles.cardSeccion, styles.cardSeccionKit]}>
                <View style={[styles.kitSeccionHeader, !kitSeleccionado && { marginBottom: 0 }]}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="cube-outline" size={16} color="#065f46" />
                    <Text style={[styles.cardSeccionTitulo, { color: "#065f46", borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
                      4. Asignar Kit Predeterminado (Opcional)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnGestionarKitsMini}
                    onPress={onAbrirGestionKits}
                  >
                    <Ionicons name="settings-outline" size={13} color={tema.colors.primary} />
                    <Text style={styles.btnGestionarKitsMiniTexto}>Kits</Text>
                  </TouchableOpacity>
                </View>

                {kitSeleccionado && (
                  <View style={styles.kitResumenCaja}>
                    <View style={styles.kitResumenTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#059669" />
                          <Text style={styles.kitResumenNombre}>{kitSeleccionado.nombre_kit}</Text>
                        </View>
                        <Text style={styles.kitResumenDesc}>
                          {kitSeleccionado.items.length} insumos vinculados · Categoría: {kitSeleccionado.categoria ?? "General"}
                        </Text>
                      </View>
                      <View style={styles.kitResumenCosto}>
                        <Text style={styles.kitResumenCostoLabel}>Presupuesto Kit:</Text>
                        <Text style={styles.kitResumenCostoValor}>
                          {formatearCLP(kitSeleccionado.costo_total ?? 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.kitItemsPreview}>
                      {kitSeleccionado.items.slice(0, 4).map((it, idx) => (
                        <Text key={idx} style={styles.kitItemPreviewTexto}>
                          • {it.cantidad_requerida_kit}x {it.nombre_articulo} ({formatearCLP(it.subtotal ?? it.cantidad_requerida_kit * it.precio_unitario)})
                        </Text>
                      ))}
                      {kitSeleccionado.items.length > 4 && (
                        <Text style={styles.kitItemPreviewMas}>
                          + {kitSeleccionado.items.length - 4} insumos adicionales...
                        </Text>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <Text style={styles.kitAutoPresupuestoNota}>
                        ✓ Presupuesto asignado automáticamente.
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          backgroundColor: "#fef2f2",
                          borderWidth: 1,
                          borderColor: "#fecaca",
                        }}
                        onPress={() => onCambiar("id_kit_proyecto", null)}
                      >
                        <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#dc2626" }}>Quitar kit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* SECCIÓN 5: PRESUPUESTOS Y VALOR DE VENTA */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="cash-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>
                  {!editando ? "5. Presupuestos y Avance" : "4. Presupuestos y Avance"}
                </Text>
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Presupuesto Materiales ($ CLP)</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="cash-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={tema.colors.textMuted}
                      value={String(formulario.presupuesto_inicial || "")}
                      onChangeText={(t) => onCambiar("presupuesto_inicial", Number(t) || 0)}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Presupuesto Horas (HH)</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="time-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={tema.colors.textMuted}
                      value={String(formulario.presupuesto_horas || "")}
                      onChangeText={(t) => onCambiar("presupuesto_horas", Number(t) || 0)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Valor de Venta ($ CLP)</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="pricetag-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={tema.colors.textMuted}
                      value={String(formulario.valor_venta || "")}
                      onChangeText={(t) => onCambiar("valor_venta", Number(t) || 0)}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Porcentaje de Avance (%)</Text>
                  <View style={styles.inputContenedorConIcono}>
                    <Ionicons name="stats-chart-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      style={styles.inputConIcono}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={tema.colors.textMuted}
                      value={String(formulario.porcentaje_avance ?? 0)}
                      onChangeText={(t) => onCambiar("porcentaje_avance", Number(t) || 0)}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* ERROR */}
            {Boolean(error) && (
              <View style={styles.errorBannerModal}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" />
                <Text style={styles.errorTextoModal}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* FOOTER ACCIONES */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.btnModalCancelar}
              onPress={onCancelar}
              disabled={guardando}
            >
              <Text style={styles.btnModalCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnModalGuardar, guardando && { opacity: 0.7 }]}
              onPress={onGuardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#ffffff" />
                  <Text style={styles.btnModalGuardarTexto}>
                    {editando ? "Guardar Cambios" : "Crear Proyecto"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------- Estilos locales ----------

const styles = StyleSheet.create({
  campoEtiqueta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
    backgroundColor: tema.colors.card,
    marginBottom: 8,
  },
  barra: {
    height: 6,
    backgroundColor: tema.colors.borderLight,
    borderRadius: 999,
    marginTop: 12,
    overflow: "hidden",
  },
  barraRelleno: {
    height: 6,
    borderRadius: 999,
  },
  filtrosWrapper: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
  },
  filtrosScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filtrosContenido: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  chipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  chipTextoActivo: {
    color: tema.colors.primary,
    fontWeight: "bold",
  },
  boton: {
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tema.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  botonSecundario: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  botonPeligro: {
    backgroundColor: tema.colors.danger,
  },
  botonTexto: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
  botonTextoOscuro: {
    color: tema.colors.text,
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
  botonKits: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  botonKitsTexto: {
    color: tema.colors.primary,
    fontWeight: "700",
    fontSize: tema.fontSize.sm,
  },
  filaFechas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  kitSeccionCaja: {
    marginVertical: 12,
    padding: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: tema.radius.lg,
  },
  kitSeccionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  kitSeccionTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  kitSeccionSub: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  btnGestionarKitsMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  btnGestionarKitsMiniTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.primary,
  },
  kitChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  kitChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  kitChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  kitChipTextoActivo: {
    color: "#fff",
  },
  kitResumenCaja: {
    marginTop: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    padding: 12,
  },
  kitResumenTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  kitResumenNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
  kitResumenDesc: {
    fontSize: 11,
    color: "#047857",
    marginTop: 2,
  },
  kitResumenCosto: {
    alignItems: "flex-end",
  },
  kitResumenCostoLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#065f46",
  },
  kitResumenCostoValor: {
    fontSize: 14,
    fontWeight: "800",
    color: "#047857",
  },
  kitItemsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d1fae5",
  },
  kitItemPreviewTexto: {
    fontSize: 11,
    color: "#065f46",
    marginBottom: 2,
  },
  kitItemPreviewMas: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#047857",
    marginTop: 2,
  },
  kitAutoPresupuestoNota: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  modalHeaderTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  modalHeaderTagTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primary,
    letterSpacing: 0.6,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitulo: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  btnCerrarModal: {
    padding: 6,
    borderRadius: 8,
  },
  modalScrollCuerpo: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  cardSeccion: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSeccionKit: {
    borderColor: "#a7f3d0",
    backgroundColor: "#f0fdf4",
  },
  cardSeccionEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cardSeccionTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dosColumnasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  inputContenedorConIcono: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: tema.radius.md,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  inputIcono: {
    marginRight: 8,
  },
  inputConIcono: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    height: "100%",
  },
  segmentedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  segmentBtnActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  segmentBtnTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  segmentBtnTextoActivo: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorBannerModal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorTextoModal: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
    flex: 1,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  btnModalCancelar: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  btnModalCancelarTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  btnModalGuardar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: tema.colors.primary,
    justifyContent: "center",
  },
  btnModalGuardarTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});