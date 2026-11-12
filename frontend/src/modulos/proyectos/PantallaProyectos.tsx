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

  const [aviso, establecerAviso] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAviso(msg);
    setTimeout(() => establecerAviso(null), 3500);
  };

  const cargar = useCallback(async () => {
    establecerCargando(true);
    const res = await listarProyectos();
    if (res.ok && res.data) {
      establecerProyectos(res.data);
      establecerError(null);
    } else {
      establecerError(res.error ?? "Error al cargar proyectos");
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

    // Regla de negocio: Si el proyecto ya estaba Cerrado, no se puede alterar el presupuesto
    if (editando?.estado_proyecto === "Cerrado") {
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
    <ModalFormulario
      visible={modalVisible}
      editando={Boolean(editando)}
      proyectoOriginal={editando}
      formulario={formulario}
      error={errorFormulario}
      guardando={guardando}
      onCambiar={actualizarCampo}
      onCancelar={() => establecerModalVisible(false)}
      onGuardar={guardar}
    />
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
                style={[styles.boton, seleccionado.estado_proyecto === "Cerrado" && styles.botonSecundario]}
                onPress={() => abrirEditar(seleccionado)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {seleccionado.estado_proyecto === "Cerrado" && (
                    <Ionicons name="lock-closed" size={16} color={tema.colors.text} />
                  )}
                  <Text
                    style={
                      seleccionado.estado_proyecto === "Cerrado"
                        ? styles.botonTextoOscuro
                        : styles.botonTexto
                    }
                  >
                    {seleccionado.estado_proyecto === "Cerrado" ? "Ver (Cerrado)" : "Editar"}
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
          <TouchableOpacity
            style={[estilos.botonCrearProyectoGrande, styles.boton]}
            onPress={abrirNuevo}
          >
            <Text style={styles.botonTexto}>+ Nuevo</Text>
          </TouchableOpacity>
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
              const esCerrado = p.estado_proyecto === "Cerrado";
              return (
                <Pressable
                  key={p.id_proyecto}
                  style={[
                    estilos.finalAuditoriaTarjeta,
                    estilos.proyectoListaTarjeta,
                    { marginTop: 0 },
                    esCerrado && { opacity: 0.82, backgroundColor: "#f9fafb" },
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      {esCerrado && (
                        <Ionicons name="lock-closed" size={13} color="#b91c1c" />
                      )}
                      <Text
                        style={[
                          estilos.costoEtiqueta,
                          esCerrado && { color: "#b91c1c", fontWeight: "700" },
                        ]}
                      >
                        {p.estado_proyecto}
                      </Text>
                    </View>
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
  proyectoOriginal: Proyecto | null;
  formulario: FormularioProyecto;
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
  error,
  guardando,
  onCambiar,
  onCancelar,
  onGuardar,
}) => {
  const esCerrado = formulario.estado_proyecto === "Cerrado";
  const yaEstabaCerrado = Boolean(proyectoOriginal && proyectoOriginal.estado_proyecto === "Cerrado");

  const campoNumerico = (campo: CampoNumerico, etiqueta: string) => (
    <>
      <Text style={estilos.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        editable={!esCerrado}
        style={esCerrado ? styles.inputBloqueado : styles.input}
        keyboardType="numeric"
        value={String(formulario[campo] ?? "")}
        onChangeText={(t) => onCambiar(campo, Number(t) || 0)}
      />
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
      <View style={estilos.contenedor}>
        <ScrollView contentContainerStyle={estilos.detalleScroll}>
          <Text style={estilos.subTitulo}>
            {yaEstabaCerrado
              ? "Ver proyecto (Cerrado)"
              : editando
              ? "Editar proyecto"
              : "Nuevo proyecto"}
          </Text>
          <Text style={estilos.subDescripcion}>
            {esCerrado
              ? "Proyecto en modo solo lectura. Los campos se encuentran bloqueados."
              : "Los campos marcados con * son obligatorios."}
          </Text>

          {/* Banner SCRUM de control de estados */}
          <View style={styles.scrumBanner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Ionicons name="information-circle" size={16} color="#92400e" />
              <Text style={styles.scrumBannerTitulo}>[SCRUM] Control de Estados de Proyecto</Text>
            </View>
            <Text style={styles.scrumBannerTexto}>
              Flujo: Planificado → Activo → Cerrado. Al pasar a Cerrado los campos se bloquean visualmente y el presupuesto no puede ser modificado.
            </Text>
          </View>

          {/* Banner de bloqueo cuando está cerrado */}
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

          <Text style={estilos.campoEtiqueta}>Nombre del proyecto *</Text>
          <TextInput
            editable={!esCerrado}
            style={esCerrado ? styles.inputBloqueado : styles.input}
            value={formulario.nombre_proyecto}
            onChangeText={(t) => onCambiar("nombre_proyecto", t)}
          />

          <Text style={estilos.campoEtiqueta}>Tipo</Text>
          <View style={estilos.botonGrupoFila}>
            {TIPOS_PROYECTO.map((o) => (
              <Opcion
                key={o}
                texto={o}
                activo={formulario.tipo_proyecto === o}
                deshabilitado={esCerrado}
                onPress={() => onCambiar("tipo_proyecto", o)}
              />
            ))}
          </View>

          <Text style={estilos.campoEtiqueta}>Estado</Text>
          <View style={estilos.botonGrupoFila}>
            {ESTADOS_PROYECTO.map((o) => (
              <Opcion
                key={o}
                texto={o}
                activo={formulario.estado_proyecto === o}
                deshabilitado={yaEstabaCerrado}
                onPress={() => onCambiar("estado_proyecto", o)}
              />
            ))}
          </View>

          <Text style={estilos.campoEtiqueta}>Cliente</Text>
          <TextInput
            editable={!esCerrado}
            style={esCerrado ? styles.inputBloqueado : styles.input}
            value={formulario.cliente ?? ""}
            onChangeText={(t) => onCambiar("cliente", t)}
          />

          <Text style={estilos.campoEtiqueta}>Dirección</Text>
          <TextInput
            editable={!esCerrado}
            style={esCerrado ? styles.inputBloqueado : styles.input}
            value={formulario.direccion ?? ""}
            onChangeText={(t) => onCambiar("direccion", t)}
          />

          <Text style={estilos.campoEtiqueta}>Fecha de inicio (AAAA-MM-DD)</Text>
          <TextInput
            editable={!esCerrado}
            style={esCerrado ? styles.inputBloqueado : styles.input}
            value={formulario.fecha_inicio ?? ""}
            onChangeText={(t) => onCambiar("fecha_inicio", t)}
          />

          <Text style={estilos.campoEtiqueta}>Fecha de fin (AAAA-MM-DD)</Text>
          <TextInput
            editable={!esCerrado}
            style={esCerrado ? styles.inputBloqueado : styles.input}
            value={formulario.fecha_fin ?? ""}
            onChangeText={(t) => onCambiar("fecha_fin", t || null)}
          />

          {campoNumerico("presupuesto_inicial", "Presupuesto inicial")}
          {campoNumerico("presupuesto_horas", "Presupuesto horas (HH)")}
          {campoNumerico("valor_venta", "Presupuesto usado")}
          {campoNumerico("porcentaje_avance", "Porcentaje de avance")}

          {error ? <Text style={estilos.errorTexto}>{error}</Text> : null}

          <View style={estilos.modalBotonesFila}>
            <TouchableOpacity
              style={[styles.boton, styles.botonSecundario]}
              onPress={onCancelar}
            >
              <Text style={styles.botonTextoOscuro}>
                {yaEstabaCerrado ? "Cerrar" : "Cancelar"}
              </Text>
            </TouchableOpacity>

            {!yaEstabaCerrado && (
              <TouchableOpacity style={styles.boton} onPress={onGuardar} disabled={guardando}>
                <Text style={styles.botonTexto}>
                  {guardando ? "Guardando..." : esCerrado ? "Guardar y Cerrar" : "Guardar"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const Opcion: React.FC<{
  texto: string;
  activo: boolean;
  deshabilitado?: boolean;
  onPress: () => void;
}> = ({ texto, activo, deshabilitado, onPress }) => (
  <Pressable
    onPress={deshabilitado ? undefined : onPress}
    disabled={deshabilitado}
    style={[
      estilos.grupoBoton,
      activo && estilos.grupoBotonActivo,
      deshabilitado && !activo && styles.opcionDeshabilitada,
    ]}
  >
    <Text
      style={[
        estilos.grupoBotonTexto,
        activo && estilos.grupoBotonTextoActivo,
        deshabilitado && !activo && styles.opcionTextoDeshabilitado,
      ]}
    >
      {texto}
    </Text>
  </Pressable>
);

// ---------- Estilos locales ----------

const styles = StyleSheet.create({
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
  inputBloqueado: {
    height: 44,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    fontSize: tema.fontSize.sm,
    color: tema.colors.textMuted,
    backgroundColor: tema.colors.surfaceAlt,
    marginBottom: 8,
  },
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
  opcionTextoDeshabilitado: {
    color: tema.colors.textMuted,
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
});