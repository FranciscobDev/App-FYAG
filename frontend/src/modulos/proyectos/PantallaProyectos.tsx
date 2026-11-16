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
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
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
import {
  ClienteProyecto,
  PlanMantencionCliente,
  listarClientes,
  listarPlanesMantencion,
} from "./clientesApi";
import { ModalGestionClientesSeguimiento } from "./ModalGestionClientesSeguimiento";
import { SelectorFecha } from "@/componentes/formularios/SelectorFecha";
import { estilos } from "./estilos";
import { SeccionTecnicos } from "./SeccionTecnicos";
import { AsignacionTecnicos } from "@/componentes/AsignacionTecnicos";

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

const obtenerEstiloEstado = (estado: string) => {
  const norm = estado.toLowerCase();
  if (norm.includes("complet") || norm.includes("finaliz")) {
    return { bg: "#dcfce7", border: "#bbf7d0", text: "#15803d", dot: "#16a34a" };
  }
  if (norm.includes("proceso") || norm.includes("curso") || norm.includes("activ")) {
    return { bg: "#fef3c7", border: "#fde68a", text: "#b45309", dot: "#d97706" };
  }
  if (norm.includes("pausad")) {
    return { bg: "#f3e8ff", border: "#e9d5ff", text: "#7e22ce", dot: "#9333ea" };
  }
  if (norm.includes("cancel")) {
    return { bg: "#fee2e2", border: "#fecaca", text: "#b91c1c", dot: "#dc2626" };
  }
  return { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" };
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

  // Kits predeterminados y Clientes / Planes de Mantención
  const [kits, establecerKits] = useState<KitProyecto[]>([]);
  const [clientesLista, establecerClientesLista] = useState<ClienteProyecto[]>([]);
  const [planesMantencion, establecerPlanesMantencion] = useState<PlanMantencionCliente[]>([]);
  const [modalKitsVisible, establecerModalKitsVisible] = useState(false);
  const [modalClientesVisible, establecerModalClientesVisible] = useState(false);
  const [pestanaInicialClientes, establecerPestanaInicialClientes] = useState<
    "clientes" | "seguimiento"
  >("clientes");
  const [panelAsignacionVisible, establecerPanelAsignacionVisible] = useState(false);

  const [aviso, establecerAviso] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAviso(msg);
    setTimeout(() => establecerAviso(null), 3500);
  };

  const cargar = useCallback(async () => {
    establecerCargando(true);
    const [resProy, resKits, resCli, resPlanes] = await Promise.all([
      listarProyectos(),
      listarKits(),
      listarClientes(),
      listarPlanesMantencion(),
    ]);
    if (resProy.ok && resProy.data) {
      establecerProyectos(resProy.data);
      establecerError(null);
    } else {
      establecerError(resProy.error ?? "Error al cargar proyectos");
    }
    if (resKits.ok && resKits.data) {
      establecerKits(resKits.data);
    }
    if (resCli.ok && resCli.data) {
      establecerClientesLista(resCli.data);
    }
    if (resPlanes.ok && resPlanes.data) {
      establecerPlanesMantencion(resPlanes.data);
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

  const manejarClienteSeleccionadoDesdeCRM = (cli: ClienteProyecto) => {
    establecerFormulario((prev) => ({
      ...prev,
      id_cliente: cli.id_cliente,
      cliente: cli.razon_social,
      direccion: cli.direccion || prev.direccion,
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
        clientes={clientesLista}
        onAbrirGestionKits={() => establecerModalKitsVisible(true)}
        onAbrirGestionClientes={() => {
          establecerPestanaInicialClientes("clientes");
          establecerModalClientesVisible(true);
        }}
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
      <ModalGestionClientesSeguimiento
        visible={modalClientesVisible}
        initialTab={pestanaInicialClientes}
        proyectos={proyectos}
        kits={kits}
        onClose={() => establecerModalClientesVisible(false)}
        onSeleccionarClienteParaProyecto={manejarClienteSeleccionadoDesdeCRM}
        onDatosActualizados={cargar}
        onAviso={mostrarAviso}
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
              proyectos={proyectos.length > 0 ? proyectos : undefined}
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
  const totalPlanificados = proyectos.filter((p) =>
    p.estado_proyecto.toLowerCase().includes("planific")
  ).length;
  const totalEnCurso = proyectos.filter((p) => {
    const s = p.estado_proyecto.toLowerCase();
    return s.includes("curso") || s.includes("proceso") || s.includes("activ");
  }).length;
  const totalFinalizados = proyectos.filter((p) => {
    const s = p.estado_proyecto.toLowerCase();
    return s.includes("finaliz") || s.includes("complet");
  }).length;

  return (
    <ContenedorEstadoPantalla screenTitle="Proyectos y Obras" skeletonType="cards">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(aviso)}
          message={aviso ?? ""}
          onDismiss={() => establecerAviso(null)}
        />

        {/* 1. ENCABEZADO OSCURO ESTÁNDAR (Igual al resto de módulos FYAG) */}
        <EncabezadoPagina
          title="Proyectos y Obras"
          subtitle="Planificación de faenas, asignación de técnicos, kits predeterminados y control presupuestario"
        />

        <ScrollView contentContainerStyle={estilos.scrollCuerpo}>
          {/* 2. KPIs DE RESUMEN SUPERIOR (Estilo Control de Herramientas) */}
          <View style={styles.kpisProyectosFila}>
            <View style={styles.kpiProyectoCaja}>
              <Text style={styles.kpiProyectoValor}>{proyectos.length}</Text>
              <Text style={styles.kpiProyectoLbl}>Total Obras</Text>
            </View>
            <View style={[styles.kpiProyectoCaja, { borderColor: "#bfdbfe" }]}>
              <Text style={[styles.kpiProyectoValor, { color: "#1d4ed8" }]}>
                {totalPlanificados}
              </Text>
              <Text style={styles.kpiProyectoLbl}>Planificados</Text>
            </View>
            <View style={[styles.kpiProyectoCaja, { borderColor: "#fde68a" }]}>
              <Text style={[styles.kpiProyectoValor, { color: tema.colors.primaryDark }]}>
                {totalEnCurso}
              </Text>
              <Text style={styles.kpiProyectoLbl}>En Curso</Text>
            </View>
            <View style={[styles.kpiProyectoCaja, { borderColor: "#bbf7d0" }]}>
              <Text style={[styles.kpiProyectoValor, { color: "#15803d" }]}>
                {totalFinalizados}
              </Text>
              <Text style={styles.kpiProyectoLbl}>Finalizados</Text>
            </View>
          </View>

          {/* 3. TARJETA HERO CON BORDE ÁMBAR (Igual a Herramientas, OC y Conteos) */}
          <View style={estilos.crearProyectoHeroTarjeta}>
            <View style={estilos.crearProyectoHeroContenido}>
              <View style={estilos.crearProyectoHeroIzquierda}>
                <View style={estilos.heroInsigniaFila}>
                  <Insignia label="Obras y Faenas" tone="warn" size="sm" />
                  <Text style={estilos.heroInsigniaHint}>
                    Control de Ejecución y Presupuesto
                  </Text>
                </View>
                <Text style={estilos.crearProyectoHeroTitulo}>
                  Registrar Nuevo Proyecto o Faena
                </Text>
                <Text style={estilos.crearProyectoHeroDescripcion}>
                  Crea una obra o mantención definiendo cliente, plazos, kit predeterminado de materiales y presupuesto inicial.
                </Text>
              </View>

              <View style={{ width: "100%", gap: 8 }}>
                <TouchableOpacity
                  style={styles.botonHeroPrimario}
                  onPress={abrirNuevo}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
                  <Text style={styles.botonNuevoPrimarioTexto}>
                    + Registrar Nuevo Proyecto
                  </Text>
                </TouchableOpacity>

                <View style={styles.herramientasRapidasFila}>
                  <TouchableOpacity
                    style={[
                      styles.botonHerramientaSecundario,
                      panelAsignacionVisible && styles.botonHerramientaSecundarioActivo,
                    ]}
                    onPress={() => establecerPanelAsignacionVisible((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.iconoHerramientaCirculo,
                        panelAsignacionVisible && styles.iconoHerramientaCirculoActivo,
                      ]}
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={15}
                        color={panelAsignacionVisible ? "#ffffff" : tema.colors.primary}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.botonHerramientaTexto,
                        panelAsignacionVisible && styles.botonHerramientaTextoActivo,
                      ]}
                    >
                      {panelAsignacionVisible ? "Ocultar Asignación" : "Asignar Técnicos"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.botonHerramientaSecundario}
                    onPress={() => establecerModalKitsVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.iconoHerramientaCirculo}>
                      <Ionicons name="cube-outline" size={15} color={tema.colors.primary} />
                    </View>
                    <Text numberOfLines={1} style={styles.botonHerramientaTexto}>
                      Gestionar Kits
                    </Text>
                    {kits.length > 0 && (
                      <View style={styles.badgeContadorKits}>
                        <Text style={styles.badgeContadorKitsTexto}>{kits.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Fila adicional: Directorio de Clientes y Planes de Mantención (3, 6, 10, 12m) */}
                <View style={[styles.herramientasRapidasFila, { marginBottom: 0 }]}>
                  <TouchableOpacity
                    style={styles.botonHerramientaSecundario}
                    onPress={() => {
                      establecerPestanaInicialClientes("clientes");
                      establecerModalClientesVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.iconoHerramientaCirculo}>
                      <Ionicons name="business-outline" size={15} color={tema.colors.primary} />
                    </View>
                    <Text numberOfLines={1} style={styles.botonHerramientaTexto}>
                      Clientes
                    </Text>
                    {clientesLista.length > 0 && (
                      <View style={styles.badgeContadorKits}>
                        <Text style={styles.badgeContadorKitsTexto}>{clientesLista.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.botonHerramientaSecundario}
                    onPress={() => {
                      establecerPestanaInicialClientes("seguimiento");
                      establecerModalClientesVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.iconoHerramientaCirculo}>
                      <Ionicons name="calendar-outline" size={15} color={tema.colors.primary} />
                    </View>
                    <Text numberOfLines={1} style={styles.botonHerramientaTexto}>
                      Mantenciones (3/6/10m)
                    </Text>
                    {planesMantencion.length > 0 && (
                      <View style={styles.badgeContadorKits}>
                        <Text style={styles.badgeContadorKitsTexto}>
                          {planesMantencion.length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {panelAsignacionVisible && (
            <ScrollView style={{ maxHeight: 500, marginBottom: 12 }} nestedScrollEnabled>
              <AsignacionTecnicos
                proyectosProp={proyectos.length > 0 ? proyectos : undefined}
                onAviso={mostrarAviso}
                onCancel={() => establecerPanelAsignacionVisible(false)}
              />
            </ScrollView>
          )}

          {/* 4. BUSCADOR Y FILTROS DE ESTADO */}
          <View style={styles.buscadorModernoCaja}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              style={styles.buscadorModernoInput}
              placeholder="Buscar por código, nombre o cliente..."
              placeholderTextColor="#9ca3af"
              value={busqueda}
              onChangeText={establecerBusqueda}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => establecerBusqueda("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.filtrosWrapper, { marginBottom: 14 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtrosContenido}
              style={styles.filtrosScroll}
            >
              {["todos", ...ESTADOS_PROYECTO].map((e) => {
                const activo = filtroEstado === e;
                const cantidadEstado =
                  e === "todos"
                    ? proyectos.length
                    : proyectos.filter((p) => p.estado_proyecto === e).length;
                return (
                  <Pressable
                    key={e}
                    onPress={() => establecerFiltroEstado(e)}
                    style={[styles.chip, activo && styles.chipActivo]}
                  >
                    <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                      {e === "todos" ? `Todos (${cantidadEstado})` : `${e} (${cantidadEstado})`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. LISTADO DE PROYECTOS */}
          {cargando ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={tema.colors.primary} size="large" />
          ) : error ? (
            <EstadoVacio title="No se pudieron cargar los proyectos" description={error} />
          ) : proyectosFiltrados.length === 0 ? (
            <EstadoVacio title="Sin proyectos" description="No hay proyectos que coincidan." />
          ) : (
            proyectosFiltrados.map((p) => {
              const porcentaje = Math.min(Math.max(p.porcentaje_avance, 0), 100);
              const color = colorAvance(porcentaje);
              const estEstado = obtenerEstiloEstado(p.estado_proyecto);
              const esMantencion = (p.tipo_proyecto || "").toLowerCase().includes("manten");
              return (
                <Pressable
                  key={p.id_proyecto}
                  style={styles.tarjetaProyectoModerna}
                  onPress={() => establecerSeleccionado(p)}
                >
                  {/* Fila superior de insignias: Tipo + Estado */}
                  <View style={styles.tarjetaTopInsignias}>
                    <View style={styles.badgeTipoProyecto}>
                      <Ionicons
                        name={esMantencion ? "build-outline" : "construct-outline"}
                        size={12}
                        color={tema.colors.primary}
                      />
                      <Text style={styles.badgeTipoProyectoTexto}>{p.tipo_proyecto}</Text>
                    </View>

                    <View
                      style={[
                        styles.badgeEstadoProyecto,
                        { backgroundColor: estEstado.bg, borderColor: estEstado.border },
                      ]}
                    >
                      <View
                        style={[styles.puntoEstadoProyecto, { backgroundColor: estEstado.dot }]}
                      />
                      <Text style={[styles.badgeEstadoProyectoTexto, { color: estEstado.text }]}>
                        {p.estado_proyecto}
                      </Text>
                    </View>
                  </View>

                  {/* Nombre y Cliente */}
                  <Text style={styles.nombreProyectoModerna} numberOfLines={2}>
                    {p.nombre_proyecto}
                  </Text>

                  <View style={styles.clienteProyectoFila}>
                    <Ionicons name="business-outline" size={14} color="#6b7280" />
                    <Text style={styles.clienteProyectoTexto} numberOfLines={1}>
                      {p.cliente && p.cliente.trim().length > 0 ? p.cliente : "Sin cliente asignado"}
                    </Text>
                  </View>

                  {p.direccion ? (
                    <View style={[styles.clienteProyectoFila, { marginTop: 3 }]}>
                      <Ionicons name="location-outline" size={14} color="#9ca3af" />
                      <Text style={styles.direccionProyectoTexto} numberOfLines={1}>
                        {p.direccion}
                      </Text>
                    </View>
                  ) : null}

                  {/* Barra de progreso con etiqueta */}
                  <View style={styles.bloqueProgresoModerna}>
                    <View style={styles.progresoEncabezadoFila}>
                      <Text style={styles.progresoEtiqueta}>Avance de obra</Text>
                      <Text style={[styles.progresoPorcentajeValor, { color }]}>
                        {porcentaje}%
                      </Text>
                    </View>
                    <View style={styles.barraModernaFondo}>
                      <View
                        style={[
                          styles.barraModernaRelleno,
                          { width: `${porcentaje}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Pie de tarjeta con métricas y fechas */}
                  <View style={styles.pieTarjetaModerna}>
                    <View style={styles.metricaPieBloque}>
                      <Text style={styles.metricaPieEtiqueta}>Presupuesto usado</Text>
                      <Text style={styles.metricaPieValor}>{formatearCLP(p.valor_venta)}</Text>
                    </View>

                    <View style={styles.divisorVerticalPie} />

                    <View style={[styles.metricaPieBloque, { flex: 1.2 }]}>
                      <Text style={styles.metricaPieEtiqueta}>Plazo estimado</Text>
                      <View style={styles.fechasPieFila}>
                        <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                        <Text style={styles.fechasPieTexto} numberOfLines={1}>
                          {p.fecha_inicio ? formatearFecha(p.fecha_inicio) : "—"} →{" "}
                          {p.fecha_fin ? formatearFecha(p.fecha_fin) : "—"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.flechaDetalleCaja}>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
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
  clientes: ClienteProyecto[];
  onAbrirGestionKits: () => void;
  onAbrirGestionClientes: () => void;
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
  clientes,
  onAbrirGestionKits,
  onAbrirGestionClientes,
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

              {/* Selector Rápido de Clientes Registrados */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Text style={[styles.campoEtiqueta, { marginBottom: 0 }]}>
                  Asignar Cliente Registrado (Autocompleta datos y dirección):
                </Text>
                <TouchableOpacity onPress={onAbrirGestionClientes}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: tema.colors.primary,
                    }}
                  >
                    + Nuevo / Gestionar Clientes
                  </Text>
                </TouchableOpacity>
              </View>

              {clientes.filter((c) => c.activo).length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 10 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {clientes
                    .filter((c) => c.activo)
                    .map((c) => {
                      const seleccionadoCli =
                        formulario.id_cliente === c.id_cliente ||
                        (formulario.cliente ?? "").toLowerCase() ===
                          c.razon_social.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={c.id_cliente}
                          style={[
                            styles.chip,
                            seleccionadoCli && styles.chipActivo,
                          ]}
                          onPress={() => {
                            onCambiar("id_cliente", c.id_cliente);
                            onCambiar("cliente", c.razon_social);
                            if (c.direccion && !formulario.direccion) {
                              onCambiar("direccion", c.direccion);
                            }
                          }}
                        >
                          <Ionicons
                            name="business-outline"
                            size={12}
                            color={seleccionadoCli ? "#ffffff" : tema.colors.primary}
                          />
                          <Text
                            style={[
                              styles.chipTexto,
                              seleccionadoCli && styles.chipTextoActivo,
                            ]}
                          >
                            {c.razon_social} ({c.rut_cliente})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              )}

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
    marginTop: 2,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.card,
    justifyContent: "center",
  },
  chipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  chipTexto: {
    fontSize: 12,
    color: tema.colors.text,
    fontWeight: "600",
  },
  chipTextoActivo: {
    color: "#ffffff",
    fontWeight: "700",
  },
  kpisProyectosFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: tema.spacing.md,
  },
  kpiProyectoCaja: {
    flex: 1,
    minWidth: 72,
    backgroundColor: tema.colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  kpiProyectoValor: {
    fontSize: tema.fontSize.md,
    fontWeight: "700",
    color: tema.colors.text,
  },
  kpiProyectoLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  botonHeroPrimario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.primary,
  },
  chipContador: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  chipContadorActivo: {
    backgroundColor: tema.colors.primary,
  },
  chipContadorTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4b5563",
  },
  chipContadorTextoActivo: {
    color: "#ffffff",
  },
  cabeceraFijaContenedor: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  encabezadoFilaPrincipal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  tituloConIconoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 180,
  },
  iconoTituloCaja: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
  },
  tituloPaginaTexto: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.2,
  },
  subtituloPaginaTexto: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
  },
  botonNuevoPrimario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: tema.colors.primary,
    shadowColor: tema.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  botonNuevoPrimarioTexto: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  herramientasRapidasFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  botonHerramientaSecundario: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  botonHerramientaSecundarioActivo: {
    backgroundColor: "#fffbeb",
    borderColor: tema.colors.primary,
  },
  iconoHerramientaCirculo: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
  },
  iconoHerramientaCirculoActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  botonHerramientaTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    flexShrink: 1,
  },
  botonHerramientaTextoActivo: {
    color: tema.colors.primary,
  },
  badgeContadorKits: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeContadorKitsTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
  },
  buscadorModernoCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    gap: 8,
  },
  buscadorModernoInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  tarjetaProyectoModerna: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  tarjetaTopInsignias: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  badgeTipoProyecto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  badgeTipoProyectoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  badgeEstadoProyecto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  puntoEstadoProyecto: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  badgeEstadoProyectoTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
  nombreProyectoModerna: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 22,
  },
  clienteProyectoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clienteProyectoTexto: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4b5563",
    flex: 1,
  },
  direccionProyectoTexto: {
    fontSize: 12,
    color: "#6b7280",
    flex: 1,
  },
  bloqueProgresoModerna: {
    marginTop: 14,
    marginBottom: 14,
  },
  progresoEncabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progresoEtiqueta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  progresoPorcentajeValor: {
    fontSize: 12,
    fontWeight: "800",
  },
  barraModernaFondo: {
    height: 7,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    overflow: "hidden",
  },
  barraModernaRelleno: {
    height: 7,
    borderRadius: 999,
  },
  pieTarjetaModerna: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    gap: 10,
  },
  metricaPieBloque: {
    flex: 1,
  },
  metricaPieEtiqueta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  metricaPieValor: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  divisorVerticalPie: {
    width: 1,
    height: 26,
    backgroundColor: "#e5e7eb",
  },
  fechasPieFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  fechasPieTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  flechaDetalleCaja: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
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
  tituloEncabezadoBloque: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 150,
  },
  accionesEncabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  botonAccionEncabezado: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  botonNuevoEncabezado: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
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