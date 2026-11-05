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
import { tema } from "@/nucleo/tema";
import {
  ContenedorEstadoPantalla,
  EstadoVacio,
  NotificacionFlotante,
} from "@/componentes/comunes";
import { estilos } from "@/modulos/proyectos/estilos";
import {
  FormularioUsuario,
  Rol,
  Usuario,
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  listarRoles,
  listarUsuarios,
} from "./usuariosApi";

const formularioVacio = (): FormularioUsuario => ({
  nombre_usuario: "",
  apellido_usuario: "",
  correo_usuario: "",
  rut: "",
  id_rol: null,
  especializacion: "",
  contrasena: "",
  activo: true,
});

const nombreCompleto = (u: Usuario) => `${u.nombre_usuario} ${u.apellido_usuario}`;

// Alert.alert no funciona en web, así que se usa window.confirm
const confirmar = (
  titulo: string,
  mensaje: string,
  textoAceptar: string,
  onAceptar: () => void
) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onAceptar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: "Cancelar", style: "cancel" },
    { text: textoAceptar, style: "destructive", onPress: onAceptar },
  ]);
};

export const PantallaUsuarios: React.FC = () => {
  const [cargando, establecerCargando] = useState(true);
  const [usuarios, establecerUsuarios] = useState<Usuario[]>([]);
  const [roles, establecerRoles] = useState<Rol[]>([]);
  const [error, establecerError] = useState<string | null>(null);

  const [busqueda, establecerBusqueda] = useState("");
  const [filtroRol, establecerFiltroRol] = useState<number | null>(null);

  const [seleccionado, establecerSeleccionado] = useState<Usuario | null>(null);

  const [modalVisible, establecerModalVisible] = useState(false);
  const [editando, establecerEditando] = useState<Usuario | null>(null);
  const [formulario, establecerFormulario] = useState<FormularioUsuario>(formularioVacio());
  const [errorFormulario, establecerErrorFormulario] = useState("");
  const [guardando, establecerGuardando] = useState(false);

  const [aviso, establecerAviso] = useState<string | null>(null);
  const mostrarAviso = (msg: string) => {
    establecerAviso(msg);
    setTimeout(() => establecerAviso(null), 3500);
  };

  const cargar = useCallback(async () => {
    establecerCargando(true);
    const [resUsuarios, resRoles] = await Promise.all([listarUsuarios(), listarRoles()]);
    if (resUsuarios.ok && resUsuarios.data) {
      establecerUsuarios(resUsuarios.data);
      establecerError(null);
    } else {
      establecerError(resUsuarios.error ?? "Error al cargar usuarios");
    }
    if (resRoles.ok && resRoles.data) {
      establecerRoles(resRoles.data);
    }
    establecerCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroRol !== null && u.id_rol !== filtroRol) return false;
      if (q) {
        const coincide =
          nombreCompleto(u).toLowerCase().includes(q) ||
          u.correo_usuario.toLowerCase().includes(q) ||
          (u.rut ?? "").toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [usuarios, busqueda, filtroRol]);

  const abrirNuevo = () => {
    establecerEditando(null);
    establecerFormulario(formularioVacio());
    establecerErrorFormulario("");
    establecerModalVisible(true);
  };

  const abrirEditar = (u: Usuario) => {
    establecerEditando(u);
    establecerFormulario({
      nombre_usuario: u.nombre_usuario,
      apellido_usuario: u.apellido_usuario,
      correo_usuario: u.correo_usuario,
      rut: u.rut ?? "",
      id_rol: u.id_rol,
      especializacion: u.especializacion ?? "",
      contrasena: "",
      activo: u.activo,
    });
    establecerErrorFormulario("");
    establecerModalVisible(true);
  };

  const actualizarCampo = <K extends keyof FormularioUsuario>(
    campo: K,
    valor: FormularioUsuario[K]
  ) => establecerFormulario((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    if (!formulario.nombre_usuario.trim() || !formulario.apellido_usuario.trim()) {
      establecerErrorFormulario("El nombre y el apellido son obligatorios.");
      return;
    }
    if (!formulario.correo_usuario.trim()) {
      establecerErrorFormulario("El correo es obligatorio.");
      return;
    }
    if (!formulario.id_rol) {
      establecerErrorFormulario("Debes seleccionar un rol.");
      return;
    }
    if (!editando && !formulario.contrasena) {
      establecerErrorFormulario("La contraseña es obligatoria.");
      return;
    }

    const payload: FormularioUsuario = {
      ...formulario,
      nombre_usuario: formulario.nombre_usuario.trim(),
      apellido_usuario: formulario.apellido_usuario.trim(),
      correo_usuario: formulario.correo_usuario.trim(),
      rut: formulario.rut?.trim() || null,
      especializacion: formulario.especializacion?.trim() || null,
    };
    // Si se edita y no se escribió contraseña, no se envía
    if (editando && !payload.contrasena) {
      delete payload.contrasena;
    }

    establecerGuardando(true);
    const res = editando
      ? await actualizarUsuario(editando.id_usuario, payload)
      : await crearUsuario(payload);
    establecerGuardando(false);

    if (!res.ok || !res.data) {
      establecerErrorFormulario(res.error ?? "Error al guardar el usuario");
      return;
    }

    const guardado = res.data.usuario;
    establecerUsuarios((prev) =>
      editando
        ? prev.map((u) => (u.id_usuario === guardado.id_usuario ? guardado : u))
        : [...prev, guardado]
    );
    if (seleccionado?.id_usuario === guardado.id_usuario) {
      establecerSeleccionado(guardado);
    }
    establecerModalVisible(false);
    mostrarAviso(res.data.mensaje);
  };

  const confirmarEliminar = (u: Usuario) => {
    confirmar(
      "Eliminar usuario",
      `¿Eliminar a ${nombreCompleto(u)}? Esta acción no se puede deshacer.`,
      "Eliminar",
      async () => {
        const res = await eliminarUsuario(u.id_usuario);
        if (!res.ok || !res.data) {
          mostrarAviso(res.error ?? "Error al eliminar");
          return;
        }
        establecerUsuarios((prev) => prev.filter((x) => x.id_usuario !== u.id_usuario));
        establecerSeleccionado(null);
        mostrarAviso(res.data.mensaje);
      }
    );
  };

  const modal = (
    <ModalFormulario
      visible={modalVisible}
      editando={Boolean(editando)}
      formulario={formulario}
      roles={roles}
      error={errorFormulario}
      guardando={guardando}
      onCambiar={actualizarCampo}
      onCancelar={() => establecerModalVisible(false)}
      onGuardar={guardar}
    />
  );

  // ---------- Vista de detalle ----------
  if (seleccionado) {
    return (
      <ContenedorEstadoPantalla screenTitle="Detalle de usuario" skeletonType="cards">
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
                <Text style={estilos.detalleCodigo}>
                  {seleccionado.nombre_rol ?? "Sin rol"}
                </Text>
                <View style={[styles.badge, !seleccionado.activo && styles.badgeInactivo]}>
                  <Text
                    style={[
                      styles.badgeTexto,
                      !seleccionado.activo && styles.badgeTextoInactivo,
                    ]}
                  >
                    {seleccionado.activo ? "Activo" : "Inactivo"}
                  </Text>
                </View>
              </View>

              <Text style={estilos.detalleNombre}>{nombreCompleto(seleccionado)}</Text>
              <Text style={estilos.detalleCliente}>{seleccionado.correo_usuario}</Text>

              <View style={estilos.detalleMetaFila}>
                <Text style={estilos.metaElemento}>RUT: {seleccionado.rut ?? "—"}</Text>
                <Text style={estilos.metaElemento}>
                  Especialización: {seleccionado.especializacion ?? "—"}
                </Text>
              </View>
            </View>

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
    <ContenedorEstadoPantalla screenTitle="Usuarios" skeletonType="cards">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(aviso)}
          message={aviso ?? ""}
          onDismiss={() => establecerAviso(null)}
        />

        <View style={estilos.superiorBarra}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.encabezado}>Usuarios</Text>
            <Text style={estilos.seccionSubtitulo}>
              {usuariosFiltrados.length} de {usuarios.length} usuarios
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
            placeholder="Buscar por nombre, correo o RUT"
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
            <Pressable
              onPress={() => establecerFiltroRol(null)}
              style={[styles.chip, filtroRol === null && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, filtroRol === null && styles.chipTextoActivo]}>
                Todos
              </Text>
            </Pressable>
            {roles.map((r) => {
              const activo = filtroRol === r.id_rol;
              return (
                <Pressable
                  key={r.id_rol}
                  onPress={() => establecerFiltroRol(r.id_rol)}
                  style={[styles.chip, activo && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                    {r.nombre_rol}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {cargando ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={tema.colors.primary} />
        ) : error ? (
          <EstadoVacio title="No se pudieron cargar los usuarios" description={error} />
        ) : usuariosFiltrados.length === 0 ? (
          <EstadoVacio title="Sin usuarios" description="No hay usuarios que coincidan." />
        ) : (
          <ScrollView contentContainerStyle={estilos.scrollCuerpo}>
            {usuariosFiltrados.map((u) => (
              <Pressable
                key={u.id_usuario}
                style={[
                  estilos.finalAuditoriaTarjeta,
                  estilos.proyectoListaTarjeta,
                  { marginTop: 0 },
                ]}
                onPress={() => establecerSeleccionado(u)}
              >
                <View style={estilos.tarjetaSuperior}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.codigoTexto}>{u.nombre_rol ?? "Sin rol"}</Text>
                    <Text style={estilos.nombreTexto} numberOfLines={1}>
                      {nombreCompleto(u)}
                    </Text>
                    <Text style={estilos.clienteTexto}>{u.correo_usuario}</Text>
                  </View>
                  <View style={[styles.badge, !u.activo && styles.badgeInactivo]}>
                    <Text style={[styles.badgeTexto, !u.activo && styles.badgeTextoInactivo]}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                </View>

                <View style={estilos.tarjetaInferiorFila}>
                  <Text style={estilos.costoEtiqueta}>
                    {u.especializacion ?? "Sin especialización"}
                  </Text>
                  <Text style={estilos.fechasTexto}>{u.rut ?? "Sin RUT"}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      {modal}
    </ContenedorEstadoPantalla>
  );
};

// ---------- Modal de formulario ----------

type ModalProps = {
  visible: boolean;
  editando: boolean;
  formulario: FormularioUsuario;
  roles: Rol[];
  error: string;
  guardando: boolean;
  onCambiar: <K extends keyof FormularioUsuario>(c: K, v: FormularioUsuario[K]) => void;
  onCancelar: () => void;
  onGuardar: () => void;
};

const ModalFormulario: React.FC<ModalProps> = ({
  visible,
  editando,
  formulario,
  roles,
  error,
  guardando,
  onCambiar,
  onCancelar,
  onGuardar,
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onCancelar}>
    <View style={estilos.contenedor}>
      <ScrollView contentContainerStyle={estilos.detalleScroll}>
        <Text style={estilos.subTitulo}>{editando ? "Editar usuario" : "Nuevo usuario"}</Text>
        <Text style={estilos.subDescripcion}>Los campos marcados con * son obligatorios.</Text>

        <Text style={estilos.campoEtiqueta}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={formulario.nombre_usuario}
          onChangeText={(t) => onCambiar("nombre_usuario", t)}
        />

        <Text style={estilos.campoEtiqueta}>Apellido *</Text>
        <TextInput
          style={styles.input}
          value={formulario.apellido_usuario}
          onChangeText={(t) => onCambiar("apellido_usuario", t)}
        />

        <Text style={estilos.campoEtiqueta}>Correo *</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={formulario.correo_usuario}
          onChangeText={(t) => onCambiar("correo_usuario", t)}
        />

        <Text style={estilos.campoEtiqueta}>RUT</Text>
        <TextInput
          style={styles.input}
          value={formulario.rut ?? ""}
          onChangeText={(t) => onCambiar("rut", t)}
        />

        <Text style={estilos.campoEtiqueta}>Rol *</Text>
        <View style={estilos.botonGrupoFila}>
          {roles.map((r) => {
            const activo = formulario.id_rol === r.id_rol;
            return (
              <Pressable
                key={r.id_rol}
                onPress={() => onCambiar("id_rol", r.id_rol)}
                style={[estilos.grupoBoton, activo && estilos.grupoBotonActivo]}
              >
                <Text style={[estilos.grupoBotonTexto, activo && estilos.grupoBotonTextoActivo]}>
                  {r.nombre_rol}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={estilos.campoEtiqueta}>Estado</Text>
        <View style={estilos.botonGrupoFila}>
          <Pressable
            onPress={() => onCambiar("activo", true)}
            style={[estilos.grupoBoton, formulario.activo && estilos.grupoBotonActivo]}
          >
            <Text
              style={[
                estilos.grupoBotonTexto,
                formulario.activo && estilos.grupoBotonTextoActivo,
              ]}
            >
              Activo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onCambiar("activo", false)}
            style={[estilos.grupoBoton, !formulario.activo && estilos.grupoBotonActivo]}
          >
            <Text
              style={[
                estilos.grupoBotonTexto,
                !formulario.activo && estilos.grupoBotonTextoActivo,
              ]}
            >
              Inactivo
            </Text>
          </Pressable>
        </View>

        <Text style={estilos.campoEtiqueta}>Especialización</Text>
        <TextInput
          style={styles.input}
          value={formulario.especializacion ?? ""}
          onChangeText={(t) => onCambiar("especializacion", t)}
        />

        <Text style={estilos.campoEtiqueta}>
          {editando ? "Nueva contraseña (dejar vacío para no cambiarla)" : "Contraseña *"}
        </Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={formulario.contrasena ?? ""}
          onChangeText={(t) => onCambiar("contrasena", t)}
        />

        {error ? <Text style={estilos.errorTexto}>{error}</Text> : null}

        <View style={estilos.modalBotonesFila}>
          <TouchableOpacity
            style={[styles.boton, styles.botonSecundario]}
            onPress={onCancelar}
          >
            <Text style={styles.botonTextoOscuro}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boton} onPress={onGuardar} disabled={guardando}>
            <Text style={styles.botonTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </Modal>
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
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeInactivo: {
    backgroundColor: tema.colors.surfaceAlt,
  },
  badgeTexto: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "bold",
  },
  badgeTextoInactivo: {
    color: tema.colors.textMuted,
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