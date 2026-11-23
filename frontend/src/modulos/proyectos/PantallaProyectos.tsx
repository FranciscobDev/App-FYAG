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
  listarClientes,
} from "./clientesApi";
import { SelectorFecha } from "@/componentes/formularios/SelectorFecha";
import { estilos } from "./estilos";
import { SeccionTecnicos } from "./SeccionTecnicos";
import { AsignacionTecnicos } from "@/componentes/AsignacionTecnicos";
import {
  DistintivoEstadoProyecto,
  IndicadorUltimaSincronizacion,
  LeyendaAccesibilidadEstados,
  obtenerConfiguracionEstadoProyecto,
} from "@/componentes/DistintivoEstadoProyecto";

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

/** Determina si un estado de proyecto corresponde a un cierre definitivo (solo lectura). */
const esEstadoCerrado = (estado?: string | null): boolean =>
  estado === "Completado" || estado === "Cancelado";

export const PantallaProyectos: React.FC = () => {
  const { usuario, idUsuario } = usarAutenticacion();

  const [cargando, establecerCargando] = useState(true);
  const [proyectos, establecerProyectos] = useState<Proyecto[]>([]);
  const [error, establecerError] = useState<string | null>(null);
  const [ultimaSincronizacion, establecerUltimaSincronizacion] =
    useState<Date | null>(() => new Date());

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

  // Kits predeterminados y Clientes
  const [kits, establecerKits] = useState<KitProyecto[]>([]);
  const [clientesLista, establecerClientesLista] = useState<ClienteProyecto[]>([]);
  const [modalKitsVisible, establecerModalKitsVisible] = useState(false);
  const [panelAsignacionVisible, establecerPanelAsignacionVisible] = useState(false);

  const [aviso, establecerAviso] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAviso(msg);
    setTimeout(() => establecerAviso(null), 3500);
  };

  const cargar = useCallback(async () => {
    establecerCargando(true);
    const [resProy, resKits, resCli] = await Promise.all([
      listarProyectos(),
      listarKits(),
      listarClientes(),
    ]);
    if (resProy.ok && resProy.data) {
      establecerProyectos(resProy.data);
      establecerError(null);
      establecerUltimaSincronizacion(new Date());
    } else {
      establecerError(resProy.error ?? "Error al cargar proyectos");
    }
    if (resKits.ok && resKits.data) {
      establecerKits(resKits.data);
    }
    if (resCli.ok && resCli.data) {
      establecerClientesLista(resCli.data);
    }
    establecerCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proyectosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (
        filtroEstado !== "todos" &&
        p.estado_proyecto.toLowerCase() !== filtroEstado.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const coincide =
          p.nombre_proyecto.toLowerCase().includes(q) ||
          (p.cliente ?? "").toLowerCase().includes(q) ||
          p.estado_proyecto.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [proyectos, busqueda, filtroEstado]);

  const conteoPorEstado = useMemo(() => {
    const mapa: Record<string, number> = {
      Planificado: 0,
      "En curso": 0,
      Pausado: 0,
      Finalizado: 0,
    };
    proyectos.forEach((p) => {
      const cfg = obtenerConfiguracionEstadoProyecto(p.estado_proyecto);
      if (cfg.etiqueta in mapa) {
        mapa[cfg.etiqueta] += 1;
      } else {
        mapa[p.estado_proyecto] = (mapa[p.estado_proyecto] || 0) + 1;
      }
    });
    return mapa;
  }, [proyectos]);

  const horaSincCorta = useMemo(() => {
    if (!ultimaSincronizacion) return "--:--:--";
    try {
      return ultimaSincronizacion.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ultimaSincronizacion.toTimeString().slice(0, 8);
    }
  }, [ultimaSincronizacion]);

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

    // Regla de negocio: si el proyecto ya estaba cerrado, no se puede alterar el presupuesto
    if (esEstadoCerrado(editando?.estado_proyecto)) {
      const presupuestoOriginal = Number(editando.presupuesto_inicial) || 0;
      const horasOriginal = Number(editando.presupuesto_horas) || 0;
      const presupuestoNuevo = Number(formulario.presupuesto_inicial) || 0;
      const horasNuevas = Number(formulario.presupuesto_horas) || 0;

      if (presupuestoNuevo !== presupuestoOriginal || horasNuevas !== horasOriginal) {
        establecerErrorFormulario(
          "No se puede modificar el presupuesto de un proyecto que ya está cerrado."
        );
        return;
      }
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
    establecerUltimaSincronizacion(new Date());
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
      establecerUltimaSincronizacion(new Date());
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
        proyectoOriginal={editando}
        formulario={formulario}
        kits={kits}
        clientes={clientesLista}
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
    const cfgEstadoDetalle = obtenerConfiguracionEstadoProyecto(
      seleccionado.estado_proyecto
    );

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

            {/* [FRONT-2] Indicador de última sincronización en vista de detalle */}
            <IndicadorUltimaSincronizacion
              ultimaSincronizacion={ultimaSincronizacion}
              sincronizando={cargando}
              sinConexion={Boolean(error)}
              onSincronizar={cargar}
              compacto
              style={{ marginBottom: 12 }}
            />

            <View
              style={[
                estilos.finalAuditoriaTarjeta,
                {
                  marginTop: 0,
                  borderLeftWidth: 4,
                  borderLeftColor: cfgEstadoDetalle.colorBorde,
                },
              ]}
            >
              <View style={estilos.detalleSuperiorFila}>
                <Text style={estilos.detalleCodigo}>{seleccionado.tipo_proyecto}</Text>
                {/* [FRONT-2] Distintivo de color, icono y etiqueta textual por estado */}
                <DistintivoEstadoProyecto
                  estado={seleccionado.estado_proyecto}
                  tamano="md"
                  mostrarPrefijo
                />
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
                <Text style={estilos.metaElemento}>
                  Última sinc: {horaSincCorta}
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
                style={[styles.boton, esEstadoCerrado(seleccionado.estado_proyecto) && styles.botonSecundario]}
                onPress={() => abrirEditar(seleccionado)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {esEstadoCerrado(seleccionado.estado_proyecto) && (
                    <Ionicons name="lock-closed" size={16} color={tema.colors.text} />
                  )}
                  <Text
                    style={
                      esEstadoCerrado(seleccionado.estado_proyecto)
                        ? styles.botonTextoOscuro
                        : styles.botonTexto
                    }
                  >
                    {esEstadoCerrado(seleccionado.estado_proyecto) ? "Ver (Cerrado)" : "Editar"}
                  </Text>
                </View>
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

<<<<<<< HEAD
        {/* [FRONT-2] Indicador de última sincronización en tiempo real */}
        <IndicadorUltimaSincronizacion
          ultimaSincronizacion={ultimaSincronizacion}
          sincronizando={cargando}
          sinConexion={Boolean(error)}
          onSincronizar={cargar}
          fuenteDatos="Estados de proyectos sincronizados con el servidor central"
          style={{ marginBottom: 12 }}
        />

        {/* [SCRUM] Distintivos de color y texto por cada estado + revisor de accesibilidad móvil */}
        <LeyendaAccesibilidadEstados
          conteoPorEstado={conteoPorEstado}
          estadoSeleccionado={filtroEstado}
          onSeleccionarEstado={establecerFiltroEstado}
        />

        {panelAsignacionVisible && (
          <ScrollView style={{ maxHeight: 540, marginBottom: 12 }} nestedScrollEnabled>
            <AsignacionTecnicos
              proyectosProp={proyectos.length > 0 ? proyectos : undefined}
              onAviso={mostrarAviso}
              onCancel={() => establecerPanelAsignacionVisible(false)}
            />
          </ScrollView>
        )}

        <View style={estilos.buscarCajaEnvoltorio}>
          <Ionicons name="search" size={16} color={tema.colors.textMuted} />
          <TextInput
            style={[estilos.buscarEntradaTexto, { marginLeft: 8 }]}
            placeholder="Buscar por nombre, cliente o estado"
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
=======
          {/* 3. TARJETA HERO CON BORDE ÁMBAR (Igual a Herramientas, OC y Conteos) */}
          <View style={estilos.crearProyectoHeroTarjeta}>
            <View style={estilos.crearProyectoHeroContenido}>
              <View style={estilos.crearProyectoHeroIzquierda}>
                <View style={estilos.heroInsigniaFila}>
                  <Insignia label="Obras y Faenas" tone="warn" size="sm" />
                  <Text style={estilos.heroInsigniaHint}>
                    Control de Ejecución y Presupuesto
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
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
<<<<<<< HEAD
              const cfgEstado = obtenerConfiguracionEstadoProyecto(p.estado_proyecto);

=======
              const esCerrado = esEstadoCerrado(p.estado_proyecto);
              const estEstado = obtenerEstiloEstado(p.estado_proyecto);
              const esMantencion = (p.tipo_proyecto || "").toLowerCase().includes("manten");
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
              return (
                <Pressable
                  key={p.id_proyecto}
                  style={[
<<<<<<< HEAD
                    estilos.finalAuditoriaTarjeta,
                    estilos.proyectoListaTarjeta,
                    {
                      marginTop: 0,
                      borderLeftWidth: 4,
                      borderLeftColor: cfgEstado.colorBorde,
                    },
                  ]}
                  onPress={() => establecerSeleccionado(p)}
                >
                  <View style={estilos.tarjetaSuperior}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Text style={estilos.codigoTexto}>{p.tipo_proyecto}</Text>
                        {/* [FRONT-2] Distintivo visual y textual por estado */}
                        <DistintivoEstadoProyecto
                          estado={p.estado_proyecto}
                          tamano="sm"
                          mostrarPrefijo
                        />
                      </View>
                      <Text style={estilos.nombreTexto} numberOfLines={2}>
                        {p.nombre_proyecto}
                      </Text>
                      <Text style={estilos.clienteTexto}>
                        {p.cliente ?? "Sin cliente"}
=======
                    styles.tarjetaProyectoModerna,
                    esCerrado && { opacity: 0.85, backgroundColor: "#f9fafb" },
                  ]}
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
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
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

<<<<<<< HEAD
                  <View style={estilos.tarjetaInferiorFila}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Ionicons
                        name="cloud-done-outline"
                        size={13}
                        color="#059669"
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: "#065F46",
                        }}
                      >
                        Sincronizado ({horaSincCorta})
                      </Text>
                    </View>
                    <Text style={estilos.fechasTexto}>
                      {p.fecha_inicio ? formatearFecha(p.fecha_inicio) : "—"} ·{" "}
                      {p.fecha_fin ? formatearFecha(p.fecha_fin) : "—"}
                    </Text>
=======
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
                      <Ionicons
                        name={esCerrado ? "lock-closed" : "chevron-forward"}
                        size={16}
                        color={esCerrado ? "#b91c1c" : "#9ca3af"}
                      />
                    </View>
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
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

type ModalProps = {
  visible: boolean;
  editando: boolean;
  proyectoOriginal: Proyecto | null;
  formulario: FormularioProyecto;
  kits: KitProyecto[];
  clientes: ClienteProyecto[];
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
  proyectoOriginal,
  formulario,
  kits,
  clientes,
  onAbrirGestionKits,
  error,
  guardando,
  onCambiar,
  onCancelar,
  onGuardar,
}) => {
  const esCerrado = esEstadoCerrado(formulario.estado_proyecto);
  const yaEstabaCerrado = Boolean(proyectoOriginal && esEstadoCerrado(proyectoOriginal.estado_proyecto));

  const [desplegableClientesAbierto, setDesplegableClientesAbierto] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");

  useEffect(() => {
    if (!visible) {
      setDesplegableClientesAbierto(false);
      setBusquedaCliente("");
    }
  }, [visible]);
  const kitSeleccionado = kits.find((k) => k.id_kit_proyecto === formulario.id_kit_proyecto);

  const clienteSeleccionado = useMemo(() => {
    if (formulario.id_cliente) {
      return clientes.find((c) => c.id_cliente === formulario.id_cliente) ?? null;
    }
    if (formulario.cliente) {
      return (
        clientes.find(
          (c) => c.razon_social.toLowerCase() === (formulario.cliente ?? "").toLowerCase()
        ) ?? null
      );
    }
    return null;
  }, [clientes, formulario.id_cliente, formulario.cliente]);

  const clientesDisponibles = useMemo(() => {
    const activos = clientes.filter((c) => c.activo !== false);
    if (!busquedaCliente.trim()) return activos;
    const q = busquedaCliente.toLowerCase().trim();
    return activos.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        c.rut_cliente.toLowerCase().includes(q) ||
        (c.giro ?? "").toLowerCase().includes(q)
    );
  }, [clientes, busquedaCliente]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancelar}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Encabezado del modal */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalHeaderTag}>
                <Ionicons name="briefcase-outline" size={13} color={tema.colors.primary} />
                <Text style={styles.modalHeaderTagTexto}>
                  {yaEstabaCerrado
                    ? "PROYECTO CERRADO (SOLO LECTURA)"
                    : editando
                    ? "EDICIÓN DE PROYECTO"
                    : "GESTIÓN DE OBRAS"}
                </Text>
              </View>
              <Text style={styles.modalTitulo}>
                {yaEstabaCerrado
                  ? `Ver Proyecto: ${formulario.nombre_proyecto || "Cerrado"}`
                  : editando
                  ? `Editar Proyecto: ${formulario.nombre_proyecto || "Sin nombre"}`
                  : "Crear Nuevo Proyecto"}
              </Text>
              <Text style={styles.modalSubtitulo}>
                {esCerrado
                  ? "Proyecto en modo solo lectura. Los campos se encuentran bloqueados."
                  : "Define la información técnica, plazos, kit de insumos y presupuestos asignados."}
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

          {/* Cuerpo con desplazamiento */}
          <ScrollView
            style={styles.modalScrollCuerpo}
            contentContainerStyle={{ padding: 18, paddingBottom: 28 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Guía visual de control de estados de proyecto */}
            <View style={styles.scrumBanner}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Ionicons name="information-circle" size={16} color="#92400e" />
                <Text style={styles.scrumBannerTitulo}>[SCRUM] Control de Estados de Proyecto</Text>
              </View>
              <Text style={styles.scrumBannerTexto}>
                Flujo: Planificado → Activo → Cerrado. Al pasar a Cerrado los campos se bloquean visualmente y el presupuesto no puede ser modificado.
              </Text>
            </View>

            {/* Aviso de bloqueo cuando está en estado Cerrado */}
            {esCerrado && (
              <View style={styles.bannerCerrado}>
                <Ionicons name="lock-closed" size={18} color="#b91c1c" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerCerradoTitulo}>
                    {yaEstabaCerrado ? "Proyecto Cerrado — Solo Lectura" : "Cambio de Estado: Cerrado"}
                  </Text>
                  <Text style={styles.bannerCerradoTexto}>
                    Los campos se bloquean visualmente. No se permite la alteración del presupuesto inicial ni horas.
                  </Text>
                </View>
              </View>
            )}

            {/* Sección 1: Información general */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="business-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>1. Información General</Text>
              </View>

              <Text style={styles.campoEtiqueta}>Nombre del Proyecto *</Text>
              <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                <Ionicons name="document-text-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                <TextInput
                  editable={!esCerrado}
                  style={styles.inputConIcono}
                  placeholder="Ej: Montaje Tableros Centro Logístico Quilicura"
                  placeholderTextColor={tema.colors.textMuted}
                  value={formulario.nombre_proyecto}
                  onChangeText={(t) => onCambiar("nombre_proyecto", t)}
                />
              </View>

              {/* Selector de Cliente con Listado y Selección Directa */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.campoEtiqueta}>
                  Seleccionar Cliente Registrado (Autocompleta datos y dirección):
                </Text>

                {/* Gatillador del Selector / Dropdown */}
                <TouchableOpacity
                  style={[
                    styles.selectorClienteTrigger,
                    desplegableClientesAbierto && styles.selectorClienteTriggerAbierto,
                    clienteSeleccionado && styles.selectorClienteTriggerSeleccionado,
                  ]}
                  onPress={() => setDesplegableClientesAbierto((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={styles.selectorClienteIconoCaja}>
                    <Ionicons
                      name={clienteSeleccionado ? "business" : "business-outline"}
                      size={18}
                      color={clienteSeleccionado ? tema.colors.primary : "#9ca3af"}
                    />
                  </View>

                  <View style={{ flex: 1, marginRight: 8 }}>
                    {clienteSeleccionado ? (
                      <>
                        <Text style={styles.selectorClienteNombre} numberOfLines={1}>
                          {clienteSeleccionado.razon_social}
                        </Text>
                        <Text style={styles.selectorClienteSub} numberOfLines={1}>
                          RUT: {clienteSeleccionado.rut_cliente}
                          {clienteSeleccionado.giro ? ` • ${clienteSeleccionado.giro}` : ""}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.selectorClientePlaceholder}>
                        Toca aquí para seleccionar un cliente del listado...
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {clienteSeleccionado && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          onCambiar("id_cliente", null);
                          onCambiar("cliente", "");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.selectorClienteBtnLimpiar}
                      >
                        <Ionicons name="close-circle" size={18} color="#9ca3af" />
                      </TouchableOpacity>
                    )}
                    <Ionicons
                      name={desplegableClientesAbierto ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#6b7280"
                    />
                  </View>
                </TouchableOpacity>

                {/* Listado Desplegable con opciones */}
                {desplegableClientesAbierto && (
                  <View style={styles.selectorClienteListaContenedor}>
                    {/* Buscador interno si hay varios clientes */}
                    <View style={styles.selectorClienteBuscadorCaja}>
                      <Ionicons name="search-outline" size={15} color="#9ca3af" />
                      <TextInput
                        style={styles.selectorClienteBuscadorInput}
                        placeholder="Buscar cliente por nombre o RUT..."
                        placeholderTextColor="#9ca3af"
                        value={busquedaCliente}
                        onChangeText={setBusquedaCliente}
                      />
                      {busquedaCliente.length > 0 && (
                        <TouchableOpacity onPress={() => setBusquedaCliente("")}>
                          <Ionicons name="close-circle" size={15} color="#9ca3af" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <ScrollView
                      style={{ maxHeight: 220 }}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {clientesDisponibles.length === 0 ? (
                        <View style={{ padding: 14, alignItems: "center" }}>
                          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                            No se encontraron clientes activos
                          </Text>
                        </View>
                      ) : (
                        clientesDisponibles.map((cli) => {
                          const esSeleccionado =
                            clienteSeleccionado?.id_cliente === cli.id_cliente;
                          return (
                            <TouchableOpacity
                              key={cli.id_cliente}
                              style={[
                                styles.selectorClienteFilaItem,
                                esSeleccionado && styles.selectorClienteFilaItemActivo,
                              ]}
                              onPress={() => {
                                onCambiar("id_cliente", cli.id_cliente);
                                onCambiar("cliente", cli.razon_social);
                                if (cli.direccion) {
                                  onCambiar("direccion", cli.direccion);
                                }
                                setDesplegableClientesAbierto(false);
                              }}
                            >
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.selectorClienteItemTitulo,
                                    esSeleccionado && styles.selectorClienteItemTituloActivo,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {cli.razon_social}
                                </Text>
                                <Text style={styles.selectorClienteItemSub} numberOfLines={1}>
                                  RUT: {cli.rut_cliente}
                                  {cli.direccion ? ` • 📍 ${cli.direccion}` : ""}
                                </Text>
                              </View>

                              {esSeleccionado ? (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={18}
                                  color={tema.colors.primary}
                                />
                              ) : (
                                <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Cliente / Empresa</Text>
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="person-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="location-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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

            {/* Sección 2: Clasificación y estado */}
            <View style={styles.cardSeccion}>
              <View style={styles.cardSeccionEncabezado}>
                <Ionicons name="options-outline" size={16} color={tema.colors.primary} />
                <Text style={styles.cardSeccionTitulo}>2. Clasificación y Estado</Text>
              </View>

              <View style={styles.dosColumnasFila}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={styles.campoEtiqueta}>Tipo de Proyecto</Text>
                  <View style={styles.segmentedRow}>
                    {TIPOS_PROYECTO.map((o) => {
                      const activo = formulario.tipo_proyecto === o;
                      const iconName = o === "Instalacion" ? "construct-outline" : "hammer-outline";
                      return (
                        <TouchableOpacity
                          key={o}
                          disabled={esCerrado}
                          style={[
                            styles.segmentBtn,
                            activo && styles.segmentBtnActivo,
                            esCerrado && !activo && styles.opcionDeshabilitada,
                          ]}
                          onPress={() => !esCerrado && onCambiar("tipo_proyecto", o)}
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

                <View style={{ flex: 1, minWidth: 200 }}>
<<<<<<< HEAD
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <Text style={[styles.campoEtiqueta, { marginBottom: 0 }]}>
                      Estado del Proyecto
                    </Text>
                    <DistintivoEstadoProyecto
                      estado={formulario.estado_proyecto}
                      tamano="sm"
                      mostrarPrefijo
                    />
                  </View>
=======
                  <Text style={styles.campoEtiqueta}>Estado</Text>
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                  <View style={styles.segmentedRow}>
                    {ESTADOS_PROYECTO.map((o) => {
                      const activo = formulario.estado_proyecto === o;
                      return (
                        <TouchableOpacity
                          key={o}
                          disabled={yaEstabaCerrado}
                          style={[
                            styles.segmentBtn,
                            activo && styles.segmentBtnActivo,
                            yaEstabaCerrado && !activo && styles.opcionDeshabilitada,
                          ]}
                          onPress={() => !yaEstabaCerrado && onCambiar("estado_proyecto", o)}
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

            {/* Sección 3: Plazos y fechas */}
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
                    disabled={esCerrado}
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
                    disabled={esCerrado}
                    value={formulario.fecha_fin ?? ""}
                    onChangeDate={(date) => onCambiar("fecha_fin", date)}
                    onClear={() => onCambiar("fecha_fin", null)}
                    minDate={formulario.fecha_inicio ?? undefined}
                    error={
                      formulario.fecha_inicio &&
                      formulario.fecha_fin &&
                      formulario.fecha_fin < formulario.fecha_inicio
                        ? "La fecha de fin no puede ser anterior al inicio"
                        : undefined
                    }
                    placeholder="Sin fecha límite (opcional)"
                    helper="Toca para definir el plazo límite"
                  />
                </View>
              </View>
            </View>

            {/* Sección 4: Asignación de kit predeterminado al crear */}
            {!editando && (
              <View style={[styles.cardSeccion, styles.cardSeccionKit]}>
                <View style={[styles.kitSeccionHeader, !kitSeleccionado && { marginBottom: 0 }]}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="cube-outline" size={16} color="#065f46" />
                    <Text
                      style={[
                        styles.cardSeccionTitulo,
                        { color: "#065f46", borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
                      ]}
                    >
                      4. Asignar Kit Predeterminado (Opcional)
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={esCerrado}
                    style={[styles.btnGestionarKitsMini, esCerrado && styles.opcionDeshabilitada]}
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
                          • {it.cantidad_requerida_kit}x {it.nombre_articulo} (
                          {formatearCLP(it.subtotal ?? it.cantidad_requerida_kit * it.precio_unitario)})
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
                      {!esCerrado && (
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
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Sección 5: Presupuestos y avance */}
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
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="cash-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="time-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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
                  <Text style={styles.campoEtiqueta}>Presupuesto Usado / Valor Venta ($ CLP)</Text>
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="pricetag-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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
                  <View style={[styles.inputContenedorConIcono, esCerrado && styles.inputContenedorBloqueado]}>
                    <Ionicons name="stats-chart-outline" size={17} color={tema.colors.textMuted} style={styles.inputIcono} />
                    <TextInput
                      editable={!esCerrado}
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

            {/* Mensaje de error del formulario */}
            {Boolean(error) && (
              <View style={styles.errorBannerModal}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" />
                <Text style={styles.errorTextoModal}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Pie del modal con botones de acción */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.btnModalCancelar}
              onPress={onCancelar}
              disabled={guardando}
            >
              <Text style={styles.btnModalCancelarTexto}>
                {yaEstabaCerrado ? "Cerrar" : "Cancelar"}
              </Text>
            </TouchableOpacity>

            {!yaEstabaCerrado && (
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
                      {editando
                        ? esCerrado
                          ? "Guardar y Cerrar"
                          : "Guardar Cambios"
                        : "Crear Proyecto"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------- Estilos locales ----------

const styles = StyleSheet.create({
  bannerCerrado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: tema.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  bannerCerradoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "700",
    color: "#b91c1c",
  },
  bannerCerradoTexto: {
    fontSize: tema.fontSize.xs,
    color: "#7f1d1d",
    marginTop: 2,
    lineHeight: 16,
  },
  scrumBanner: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  scrumBannerTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: "#92400e",
  },
  scrumBannerTexto: {
    fontSize: tema.fontSize.xs,
    color: "#92400e",
    lineHeight: 16,
  },
  opcionDeshabilitada: {
    opacity: 0.5,
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
  campoEtiqueta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
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
  inputContenedorBloqueado: {
    backgroundColor: tema.colors.surfaceAlt,
    borderColor: tema.colors.border,
    opacity: 0.8,
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
<<<<<<< HEAD
});
=======
  selectorClienteTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    marginBottom: 4,
  },
  selectorClienteTriggerAbierto: {
    borderColor: tema.colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#fffdfa",
  },
  selectorClienteTriggerSeleccionado: {
    backgroundColor: "#fffdfa",
    borderColor: "#fde68a",
  },
  selectorClienteIconoCaja: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectorClienteNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  selectorClienteSub: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  selectorClientePlaceholder: {
    fontSize: 13,
    color: "#9ca3af",
  },
  selectorClienteBtnLimpiar: {
    padding: 3,
  },
  selectorClienteListaContenedor: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: tema.colors.primary,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  selectorClienteBuscadorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  selectorClienteBuscadorInput: {
    flex: 1,
    fontSize: 12,
    color: "#111827",
    paddingVertical: 0,
  },
  selectorClienteFilaItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  selectorClienteFilaItemActivo: {
    backgroundColor: "#fffbeb",
  },
  selectorClienteItemTitulo: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  selectorClienteItemTituloActivo: {
    color: tema.colors.primaryDark,
    fontWeight: "700",
  },
  selectorClienteItemSub: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
});
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
