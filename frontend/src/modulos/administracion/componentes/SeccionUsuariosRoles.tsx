import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { Rol, UsuarioSistema } from "@/nucleo/tipos";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { Insignia } from "@/componentes/base/Insignia";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { CampoContrasena } from "@/componentes/formularios/CampoContrasena";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { estilos } from "../estilos";

export interface CredencialesCreadas {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: Rol;
  esEdicion?: boolean;
}

export interface PropiedadesSeccionUsuariosRoles {
  activoAdministradoresConteo: number;
  activoPestana: string;
  alternarConfirmarAbrir: boolean;
  cargandoUsuariosBd?: boolean;
  correoEntradaReferencia: React.RefObject<any>;
  credencialesRecientes: CredencialesCreadas | null;
  effectiveVistaModo: "cards" | "table";
  establecerAlternarConfirmarAbrir: (val: boolean) => void;
  establecerCredencialesRecientes: (val: CredencialesCreadas | null) => void;
  establecerFormularioApellido: (val: string) => void;
  establecerFormularioApellidoError: (val: string) => void;
  establecerFormularioContrasena: (val: string) => void;
  establecerFormularioContrasenaError: (val: string) => void;
  establecerFormularioCorreo: (val: string) => void;
  establecerFormularioCorreoError: (val: string) => void;
  establecerFormularioEspecializacion: (val: string) => void;
  establecerFormularioNombre: (val: string) => void;
  establecerFormularioNombreError: (val: string) => void;
  establecerFormularioRol: (val: Rol) => void;
  establecerFormularioRut: (val: string) => void;
  establecerFormularioRutError: (val: string) => void;
  establecerNuevoUsuarioModalAbrir: (val: boolean) => void;
  establecerUsuarioBuscar: (val: string) => void;
  establecerUsuarioRolFiltrar: (val: string) => void;
  establecerUsuarioVistaModo: (val: "auto" | "cards" | "table") => void;
  executeAlternarUsuario: () => void;
  filtradoUsuarios: UsuarioSistema[];
  formularioApellido: string;
  formularioApellidoError: string;
  formularioContrasena: string;
  formularioContrasenaError: string;
  formularioCorreo: string;
  formularioCorreoError: string;
  formularioError: string;
  formularioEspecializacion: string;
  formularioNombre: string;
  formularioNombreError: string;
  formularioRol: Rol;
  formularioRut: string;
  formularioRutError: string;
  generarContrasenaSugerida: () => void;
  guardandoUsuario?: boolean;
  manejarAbrirCrearUsuario: () => void;
  manejarAbrirEditarUsuario: (u: UsuarioSistema) => void;
  manejarAlternarUsuario: (u: UsuarioSistema) => void;
  manejarGuardarUsuario: () => void;
  manejarRecargarUsuarios?: () => void;
  mostrarFeedback: (type: "ok" | "error" | "info", msg: string) => void;
  nombreEntradaReferencia: React.RefObject<any>;
  nuevoUsuarioModalAbrir: boolean;
  rutEntradaReferencia: React.RefObject<any>;
  seleccionadoUsuarioHastaAlternar: UsuarioSistema | null;
  usuarioBuscar: string;
  usuarioEditando: UsuarioSistema | null;
  usuarioRolFiltrar: string;
  usuariosSistema: UsuarioSistema[];
  width: number;
  // Anonimización integrada (Ley 19.628)
  usuarioParaAnonimizar: UsuarioSistema | null;
  establecerUsuarioParaAnonimizar: (u: UsuarioSistema | null) => void;
  confirmarPalabraClaveEntrada: string;
  establecerConfirmarPalabraClaveEntrada: (val: string) => void;
  manejarConfirmarAnonimizacion: () => void;
}

const etiquetaRol = (rol: Rol) =>
  rol === "admin"
    ? "Administrador"
    : rol === "warehouse"
      ? "Bodeguero"
      : "Técnico";

export const SeccionUsuariosRoles: React.FC<PropiedadesSeccionUsuariosRoles> = ({
  activoAdministradoresConteo,
  activoPestana,
  alternarConfirmarAbrir,
  cargandoUsuariosBd = false,
  correoEntradaReferencia,
  credencialesRecientes,
  effectiveVistaModo,
  establecerAlternarConfirmarAbrir,
  establecerCredencialesRecientes,
  establecerFormularioApellido,
  establecerFormularioApellidoError,
  establecerFormularioContrasena,
  establecerFormularioContrasenaError,
  establecerFormularioCorreo,
  establecerFormularioCorreoError,
  establecerFormularioEspecializacion,
  establecerFormularioNombre,
  establecerFormularioNombreError,
  establecerFormularioRol,
  establecerFormularioRut,
  establecerFormularioRutError,
  establecerNuevoUsuarioModalAbrir,
  establecerUsuarioBuscar,
  establecerUsuarioRolFiltrar,
  establecerUsuarioVistaModo,
  executeAlternarUsuario,
  filtradoUsuarios,
  formularioApellido,
  formularioApellidoError,
  formularioContrasena,
  formularioContrasenaError,
  formularioCorreo,
  formularioCorreoError,
  formularioError,
  formularioEspecializacion,
  formularioNombre,
  formularioNombreError,
  formularioRol,
  formularioRut,
  formularioRutError,
  generarContrasenaSugerida,
  guardandoUsuario = false,
  manejarAbrirCrearUsuario,
  manejarAbrirEditarUsuario,
  manejarAlternarUsuario,
  manejarGuardarUsuario,
  manejarRecargarUsuarios,
  mostrarFeedback,
  nombreEntradaReferencia,
  nuevoUsuarioModalAbrir,
  rutEntradaReferencia,
  seleccionadoUsuarioHastaAlternar,
  usuarioBuscar,
  usuarioEditando,
  usuarioRolFiltrar,
  usuariosSistema,
  usuarioParaAnonimizar,
  establecerUsuarioParaAnonimizar,
  confirmarPalabraClaveEntrada,
  establecerConfirmarPalabraClaveEntrada,
  manejarConfirmarAnonimizacion,
}) => {
  if (activoPestana !== "usuarios") return null;

  const bodeguerosActivos = usuariosSistema.filter(
    (u) => u.role === "warehouse" && !u.disabled
  ).length;
  const tecnicosActivos = usuariosSistema.filter(
    (u) => u.role === "technician" && !u.disabled
  ).length;
  const usuariosActivosTotal = usuariosSistema.filter((u) => !u.disabled).length;
  const usuariosInactivosTotal = usuariosSistema.filter((u) => u.disabled).length;

  return (
    <View style={estilos.seccion}>
      {/* 1. CABECERA COMPACTA INDUSTRIAL + SINCRONIZACIÓN BD + NUEVO USUARIO */}
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
              <Ionicons name="people-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                  Cuentas de Usuario y Control de Roles
                </Text>
                {manejarRecargarUsuarios && (
                  <TouchableOpacity
                    disabled={cargandoUsuariosBd}
                    onPress={manejarRecargarUsuarios}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "#f0fdf4",
                      borderWidth: 1,
                      borderColor: "#86efac",
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    {cargandoUsuariosBd ? (
                      <ActivityIndicator size="small" color="#166534" />
                    ) : (
                      <Ionicons name="sync-outline" size={11} color="#166534" />
                    )}
                    <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#166534" }}>
                      {cargandoUsuariosBd ? "Sincronizando..." : "PostgreSQL"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                  {usuariosActivosTotal} cuentas activas
                </Text>
                {` • ${usuariosInactivosTotal} deshabilitada(s) • Protección Ley 19.628`}
              </Text>
            </View>
          </View>

          <Boton
            variant="primary"
            size="sm"
            title="Nuevo Usuario"
            icon="person-add-outline"
            onPress={manejarAbrirCrearUsuario}
            style={{ minHeight: 40 }}
          />
        </View>
      </Tarjeta>

      {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS POR ROL (UNIFICA KPIS Y FILTROS) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {[
          {
            id: "admin",
            titulo: "Admins Activos",
            valor: activoAdministradoresConteo,
            sub: activoAdministradoresConteo <= 1 ? "Bloqueo preventivo" : "Redundancia segura",
            icon: "shield-checkmark-outline" as const,
            bg: "#f0fdf4",
            border: "#86efac",
            borderActivo: "#16a34a",
            textColor: "#166534",
          },
          {
            id: "warehouse",
            titulo: "Bodegueros",
            valor: bodeguerosActivos,
            sub: "Control stock y OC",
            icon: "cube-outline" as const,
            bg: "#fffbeb",
            border: "#fcd34d",
            borderActivo: "#d97706",
            textColor: "#92400e",
          },
          {
            id: "technician",
            titulo: "Técnicos Activos",
            valor: tecnicosActivos,
            sub: "Cuadrillas en faena",
            icon: "hammer-outline" as const,
            bg: "#fff7ed",
            border: "#fdba74",
            borderActivo: "#ea580c",
            textColor: "#9a3412",
          },
          {
            id: "todos",
            titulo: "Total Usuarios",
            valor: usuariosSistema.length,
            sub: "Directorio completo",
            icon: "people-outline" as const,
            bg: "#f1f5f9",
            border: "#cbd5e1",
            borderActivo: "#0f172a",
            textColor: "#0f172a",
          },
        ].map((kpi) => {
          const activo = usuarioRolFiltrar === kpi.id;
          return (
            <TouchableOpacity
              key={kpi.id}
              activeOpacity={0.8}
              onPress={() => establecerUsuarioRolFiltrar(kpi.id)}
              style={{
                flexBasis: "48%",
                flexGrow: 1,
                minWidth: 140,
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
                  {activo ? "● Vista activa" : kpi.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. BARRA DE BÚSQUEDA + ALTERNADOR TARJETAS / TABLA */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 210 }}>
          <CampoBusqueda
            value={usuarioBuscar}
            onChangeText={establecerUsuarioBuscar}
            placeholder="Buscar usuario por nombre, correo, RUT o especialidad..."
          />
        </View>

        <View style={estilos.vistaModoAlternarFila}>
          <TouchableOpacity
            style={[estilos.vistaModoBoton, effectiveVistaModo === "cards" && estilos.vistaModoBotonActivo]}
            onPress={() => establecerUsuarioVistaModo("cards")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="grid-outline"
              size={13}
              color={effectiveVistaModo === "cards" ? "#ffffff" : tema.colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[estilos.vistaModoBotonTexto, effectiveVistaModo === "cards" && estilos.vistaModoBotonTextoActivo]}>
              Tarjetas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[estilos.vistaModoBoton, effectiveVistaModo === "table" && estilos.vistaModoBotonActivo]}
            onPress={() => establecerUsuarioVistaModo("table")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-outline"
              size={13}
              color={effectiveVistaModo === "table" ? "#ffffff" : tema.colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[estilos.vistaModoBotonTexto, effectiveVistaModo === "table" && estilos.vistaModoBotonTextoActivo]}>
              Tabla
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. LISTADO DE USUARIOS CON SEMÁFORO DE SUPERFICIE */}
      <View>
        {filtradoUsuarios.length === 0 ? (
          <EstadoVacio
            icon="people-outline"
            title="Sin usuarios coincidentes"
            description="No se encontraron usuarios con los filtros de rol o búsqueda aplicados."
            actionTitle={usuarioRolFiltrar !== "todos" ? "Ver Todos los Usuarios" : "+ Nuevo Usuario"}
            onAction={
              usuarioRolFiltrar !== "todos"
                ? () => establecerUsuarioRolFiltrar("todos")
                : manejarAbrirCrearUsuario
            }
            containerStyle={{ paddingVertical: 24 }}
          />
        ) : effectiveVistaModo === "cards" ? (
          <View style={{ gap: 10 }}>
            {filtradoUsuarios.map((u) => {
              const esOnlyAdmin = !u.disabled && u.role === "admin" && activoAdministradoresConteo <= 1;
              const yaAnonimizado = u.rut.startsWith("XX.");

              const semaforo = u.disabled
                ? {
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  stripe: "#64748b",
                  text: "#334155",
                  divider: "#e2e8f0",
                  rolTone: "mute" as const,
                }
                : u.role === "admin"
                  ? {
                    bg: "#f0fdf4",
                    border: "#86efac",
                    stripe: "#16a34a",
                    text: "#166534",
                    divider: "#bbf7d0",
                    rolTone: "ok" as const,
                  }
                  : {
                    bg: "#fffbeb",
                    border: "#fcd34d",
                    stripe: "#d97706",
                    text: "#92400e",
                    divider: "#fde68a",
                    rolTone: "warn" as const,
                  };

              return (
                <Tarjeta
                  key={u.id}
                  variant="outlined"
                  style={{
                    padding: 12,
                    backgroundColor: semaforo.bg,
                    borderColor: semaforo.border,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.stripe,
                    borderRadius: 12,
                  }}
                >
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
                          {u.name}
                        </Text>
                        <Insignia label={etiquetaRol(u.role)} tone={semaforo.rolTone} size="sm" />
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: semaforo.text, marginTop: 2 }}>
                        {u.email}
                      </Text>
                    </View>

                    <InsigniaEstado
                      status={u.disabled ? "rechazada" : "aprobada"}
                      label={u.disabled ? "Inactivo" : "Activo"}
                    />
                  </View>

                  {/* Ficha Blanca Interna: RUT, Especialidad y Estado de Acceso */}
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
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="card-outline" size={13} color={tema.colors.textMuted} />
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: tema.colors.text }}>
                          RUT: {u.rut || "Sin RUT"}
                        </Text>
                      </View>

                      {u.especializacion ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="construct-outline" size={13} color={tema.colors.primaryDark} />
                          <Text style={{ fontSize: 11.5, fontWeight: "700", color: tema.colors.primaryDark }}>
                            {u.especializacion}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons
                        name={u.disabled ? "lock-closed-outline" : "checkmark-circle-outline"}
                        size={13}
                        color={u.disabled ? tema.colors.danger : tema.colors.okDark}
                      />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.textSecondary }}>
                        {u.disabled ? "Login bloqueado" : "Login habilitado"}
                      </Text>
                    </View>
                  </View>

                  {/* Botonera de Acciones con Fondo Blanco de Alto Contraste */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {!yaAnonimizado && (
                      <Boton
                        variant="outline"
                        size="sm"
                        title="Editar / Clave"
                        icon="key-outline"
                        onPress={() => manejarAbrirEditarUsuario(u)}
                        style={{ flex: 1, minHeight: 36, backgroundColor: "#ffffff" }}
                      />
                    )}
                    {esOnlyAdmin ? (
                      <TouchableOpacity
                        style={[estilos.lockedBoton, { flex: 1, justifyContent: "center", minHeight: 36, backgroundColor: "#ffffff" }]}
                        onPress={() =>
                          mostrarFeedback(
                            "error",
                            "Operación bloqueada: No se puede deshabilitar al último Administrador activo."
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons name="lock-closed" size={14} color="#b45309" style={{ marginRight: 4 }} />
                        <Text style={estilos.lockedBotonTexto}>Último Admin</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        {!yaAnonimizado && (
                          <Boton
                            variant="outline"
                            size="sm"
                            title="Anonimizar"
                            icon="finger-print-outline"
                            onPress={() => {
                              establecerConfirmarPalabraClaveEntrada("");
                              establecerUsuarioParaAnonimizar(u);
                            }}
                            style={{ flex: 1, minHeight: 36, backgroundColor: "#ffffff" }}
                          />
                        )}
                        <Boton
                          variant={u.disabled ? "primary" : "danger"}
                          size="sm"
                          title={u.disabled ? "Habilitar" : "Deshabilitar"}
                          icon={u.disabled ? "checkmark-circle-outline" : "ban-outline"}
                          onPress={() => manejarAlternarUsuario(u)}
                          style={{ flex: 1, minHeight: 36 }}
                        />
                      </>
                    )}
                  </View>
                </Tarjeta>
              );
            })}
          </View>
        ) : (
          /* VISTA ESCRITORIO / TABLA */
          <Tarjeta style={estilos.tarjetaCaja}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 980 }}>
              <View style={{ minWidth: 980, flex: 1 }}>
                <View style={estilos.tablaEncabezadoFila}>
                  <Text style={[estilos.thCelda, { width: 220 }]}>Usuario & Correo Login</Text>
                  <Text style={[estilos.thCelda, { width: 120 }]}>RUT</Text>
                  <Text style={[estilos.thCelda, { width: 150 }]}>Rol Asignado</Text>
                  <Text style={[estilos.thCelda, { width: 100 }]}>Estado</Text>
                  <Text style={[estilos.thCelda, { width: 110 }]}>Especialidad</Text>
                  <Text style={[estilos.thCelda, { width: 280, textAlign: "right" }]}>Acciones de Cuenta y Privacidad</Text>
                </View>

                {filtradoUsuarios.map((u) => {
                  const esOnlyAdmin = !u.disabled && u.role === "admin" && activoAdministradoresConteo <= 1;
                  const yaAnonimizado = u.rut.startsWith("XX.");

                  return (
                    <View key={u.id} style={[estilos.tablaFila, u.disabled && estilos.tablaFilaDeshabilitado]}>
                      <View style={{ width: 220, paddingRight: 8 }}>
                        <Text style={estilos.usuarioNombreTexto}>{u.name}</Text>
                        <Text style={estilos.usuarioCorreoTexto}>{u.email}</Text>
                      </View>

                      <Text style={[estilos.tdCelda, { width: 120, fontWeight: "600" }]}>
                        {u.rut || "Sin RUT"}
                      </Text>

                      <View style={{ width: 150 }}>
                        <View
                          style={[
                            estilos.rolInsignia,
                            u.role === "admin" && estilos.rolInsigniaAdmin,
                            u.role === "warehouse" && estilos.rolInsigniaBodega,
                            u.role === "technician" && estilos.rolInsigniaTecnico,
                          ]}
                        >
                          <Text
                            style={[
                              estilos.rolInsigniaTexto,
                              u.role === "admin" && estilos.rolInsigniaTextoAdmin,
                              u.role === "warehouse" && estilos.rolInsigniaTextoBodega,
                              u.role === "technician" && estilos.rolInsigniaTextoTecnico,
                            ]}
                          >
                            {etiquetaRol(u.role)}
                          </Text>
                        </View>
                      </View>

                      <View style={{ width: 100 }}>
                        <InsigniaEstado
                          status={u.disabled ? "rechazada" : "aprobada"}
                          label={u.disabled ? "Inactivo" : "Activo"}
                        />
                      </View>

                      <Text style={[estilos.tdCelda, { width: 110, color: tema.colors.textMuted }]}>
                        {u.especializacion || "General"}
                      </Text>

                      <View style={{ width: 280, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                        {!yaAnonimizado && (
                          <Boton
                            variant="secondary"
                            size="sm"
                            title="Editar / Clave"
                            icon="key-outline"
                            onPress={() => manejarAbrirEditarUsuario(u)}
                          />
                        )}
                        {esOnlyAdmin ? (
                          <TouchableOpacity
                            style={estilos.lockedBoton}
                            onPress={() =>
                              mostrarFeedback(
                                "error",
                                "Operación bloqueada: No se puede deshabilitar al último Administrador activo."
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Ionicons name="lock-closed" size={14} color="#b45309" style={{ marginRight: 4 }} />
                            <Text style={estilos.lockedBotonTexto}>Último Admin</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            {!yaAnonimizado && (
                              <Boton
                                variant="ghost"
                                size="sm"
                                title="Anonimizar"
                                icon="finger-print-outline"
                                onPress={() => {
                                  establecerConfirmarPalabraClaveEntrada("");
                                  establecerUsuarioParaAnonimizar(u);
                                }}
                              />
                            )}
                            <Boton
                              variant={u.disabled ? "secondary" : "danger"}
                              size="sm"
                              title={u.disabled ? "Habilitar" : "Deshabilitar"}
                              icon={u.disabled ? "checkmark-circle-outline" : "ban-outline"}
                              onPress={() => manejarAlternarUsuario(u)}
                            />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Tarjeta>
        )}
      </View>

      {/* Modal Formulario Crear / Editar Usuario */}
      <VistaModal
        visible={nuevoUsuarioModalAbrir}
        onClose={() => establecerNuevoUsuarioModalAbrir(false)}
        title={
          usuarioEditando
            ? `Editar Cuenta: ${usuarioEditando.name}`
            : "Crear Cuenta de Usuario (Admin / Bodega / Técnico)"
        }
      >
        <View style={estilos.formularioContenedor}>
          <Text style={estilos.formularioSubtitulo}>
            {usuarioEditando
              ? "Actualice los datos de la cuenta, cambie el rol o asigne una nueva contraseña de acceso."
              : "Asigne correo, contraseña y rol para que el usuario pueda autenticarse directamente en el inicio de sesión."}
          </Text>

          {formularioError !== "" && (
            <View style={estilos.errorAlerta}>
              <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
              <Text style={estilos.errorAlertaTexto}>{formularioError}</Text>
            </View>
          )}

          <CampoTexto
            ref={nombreEntradaReferencia as any}
            label="Nombre(s)"
            placeholder="Ej: Marcelo"
            required
            value={formularioNombre}
            onChangeText={(text) => {
              establecerFormularioNombre(text);
              if (formularioNombreError) establecerFormularioNombreError("");
            }}
            error={formularioNombreError}
          />

          <CampoTexto
            label="Apellido(s)"
            placeholder="Ej: Gómez Paredes"
            required
            value={formularioApellido}
            onChangeText={(text) => {
              establecerFormularioApellido(text);
              if (formularioApellidoError) establecerFormularioApellidoError("");
            }}
            error={formularioApellidoError}
          />

          <CampoTexto
            ref={rutEntradaReferencia as any}
            label="RUT del Usuario (con guion y dígito verificador)"
            placeholder="Ej: 15.678.912-3"
            value={formularioRut}
            onChangeText={(text) => {
              establecerFormularioRut(text);
              if (formularioRutError) establecerFormularioRutError("");
            }}
            error={formularioRutError}
          />

          <CampoTexto
            ref={correoEntradaReferencia as any}
            label="Correo Electrónico de Acceso (Login)"
            placeholder="ejemplo@fyag.cl"
            required
            value={formularioCorreo}
            onChangeText={(text) => {
              establecerFormularioCorreo(text);
              if (formularioCorreoError) establecerFormularioCorreoError("");
            }}
            error={formularioCorreoError}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <CampoContrasena
                  label={
                    usuarioEditando
                      ? "Nueva Contraseña (opcional, dejar en blanco para mantener actual)"
                      : "Contraseña de Acceso"
                  }
                  required={!usuarioEditando}
                  placeholder={usuarioEditando ? "Ingresar solo si desea cambiarla" : "Mínimo 4 caracteres"}
                  value={formularioContrasena}
                  onChangeText={(text) => {
                    establecerFormularioContrasena(text);
                    if (formularioContrasenaError) establecerFormularioContrasenaError("");
                  }}
                  error={formularioContrasenaError}
                  helper="El usuario ingresará con su correo y esta contraseña en la pantalla de Login."
                />
              </View>
            </View>
            <View style={{ alignSelf: "flex-end", marginTop: -8, marginBottom: 8 }}>
              <Boton
                variant="secondary"
                size="sm"
                title="Generar contraseña sugerida"
                icon="sparkles-outline"
                onPress={generarContrasenaSugerida}
              />
            </View>
          </View>

          <Text style={estilos.campoEtiqueta}>Rol Asignado en el Sistema:</Text>
          <View style={estilos.rolOpcionesGrilla}>
            {[
              {
                id: "admin" as Rol,
                title: "Administrador",
                desc: "Acceso total: gestión de usuarios, auditoría, configuración, proyectos, compras y finanzas.",
                icon: "shield-checkmark",
              },
              {
                id: "warehouse" as Rol,
                title: "Bodeguero",
                desc: "Acceso a módulo de Bodega: inventario, recepción de compras, despachos, herramientas y cardex.",
                icon: "cube",
              },
              {
                id: "technician" as Rol,
                title: "Técnico en Faena",
                desc: "Acceso a módulo de Terreno: mis obras, solicitud de materiales, registro de horas y hojas de servicio.",
                icon: "hammer",
              },
            ].map((opt) => {
              const esSeleccionado = formularioRol === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[estilos.rolSeleccionarCaja, esSeleccionado && estilos.rolSeleccionarCajaSeleccionado]}
                  onPress={() => establecerFormularioRol(opt.id)}
                  activeOpacity={0.8}
                >
                  <View style={estilos.rolSeleccionarEncabezado}>
                    <Ionicons
                      name={esSeleccionado ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={esSeleccionado ? tema.colors.primary : tema.colors.textMuted}
                    />
                    <Text
                      style={[
                        estilos.rolSeleccionarTitulo,
                        esSeleccionado && estilos.rolSeleccionarTituloSeleccionado,
                      ]}
                    >
                      {opt.title}
                    </Text>
                  </View>
                  <Text style={estilos.rolSeleccionarDescripcion}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {formularioRol === "technician" && (
            <CampoTexto
              label="Especialización Técnica (Opcional)"
              placeholder="Ej: Climatización HVAC, Electricidad Industrial, Redes..."
              value={formularioEspecializacion}
              onChangeText={establecerFormularioEspecializacion}
            />
          )}

          <View style={estilos.modalAccionesFila}>
            <Boton
              variant="secondary"
              title="Cancelar"
              onPress={() => establecerNuevoUsuarioModalAbrir(false)}
              disabled={guardandoUsuario}
            />
            <Boton
              variant="primary"
              title={
                guardandoUsuario
                  ? "Guardando..."
                  : usuarioEditando
                    ? "Guardar Cambios"
                    : "Crear Cuenta"
              }
              icon={usuarioEditando ? "save-outline" : "person-add-outline"}
              onPress={manejarGuardarUsuario}
              disabled={guardandoUsuario}
            />
          </View>
        </View>
      </VistaModal>

      {/* Modal Resumen de Credenciales Asignadas */}
      <VistaModal
        visible={Boolean(credencialesRecientes)}
        onClose={() => establecerCredencialesRecientes(null)}
        title={
          credencialesRecientes?.esEdicion
            ? "Credenciales Actualizadas"
            : "Cuenta Creada Exitosamente"
        }
      >
        {credencialesRecientes && (
          <View style={estilos.confirmarCaja}>
            <Ionicons name="checkmark-circle" size={46} color={tema.colors.ok} />
            <Text style={estilos.confirmarTitulo}>
              {credencialesRecientes.esEdicion
                ? `Se actualizaron los datos de acceso de ${credencialesRecientes.nombre}`
                : `La cuenta de ${credencialesRecientes.nombre} ya está activa`}
            </Text>
            <Text style={estilos.confirmarDescripcion}>
              Comparta estas credenciales con el usuario para que pueda iniciar sesión en la aplicación según su rol asignado:
            </Text>

            <View
              style={{
                width: "100%",
                backgroundColor: tema.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: tema.colors.border,
                borderRadius: tema.radius.md,
                padding: 14,
                gap: 8,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary, fontWeight: "600" }}>
                  Rol asignado:
                </Text>
                <Text style={{ fontSize: 13, color: tema.colors.primaryDark, fontWeight: "bold" }}>
                  {etiquetaRol(credencialesRecientes.rol)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary, fontWeight: "600" }}>
                  Correo de acceso:
                </Text>
                <Text selectable style={{ fontSize: 13, color: tema.colors.text, fontWeight: "bold" }}>
                  {credencialesRecientes.correo}
                </Text>
              </View>
              {credencialesRecientes.contrasena ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: tema.colors.textSecondary, fontWeight: "600" }}>
                    Contraseña:
                  </Text>
                  <Text selectable style={{ fontSize: 14, color: tema.colors.okDark, fontWeight: "bold" }}>
                    {credencialesRecientes.contrasena}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={estilos.modalAccionesFila}>
              <Boton
                variant="primary"
                title="Entendido"
                icon="checkmark-outline"
                onPress={() => establecerCredencialesRecientes(null)}
              />
            </View>
          </View>
        )}
      </VistaModal>

      {/* Modal de Confirmación para Deshabilitar/Habilitar */}
      <VistaModal
        visible={alternarConfirmarAbrir}
        onClose={() => establecerAlternarConfirmarAbrir(false)}
        title={
          seleccionadoUsuarioHastaAlternar?.disabled
            ? "Confirmar Habilitación de Usuario"
            : "Confirmar Deshabilitación de Usuario"
        }
      >
        <View style={estilos.confirmarCaja}>
          <Ionicons
            name={seleccionadoUsuarioHastaAlternar?.disabled ? "checkmark-circle" : "warning"}
            size={42}
            color={seleccionadoUsuarioHastaAlternar?.disabled ? tema.colors.ok : tema.colors.warnDark}
          />
          <Text style={estilos.confirmarTitulo}>
            ¿Está seguro de {seleccionadoUsuarioHastaAlternar?.disabled ? "habilitar" : "deshabilitar"} a{" "}
            <Text style={{ fontWeight: "bold" }}>{seleccionadoUsuarioHastaAlternar?.name}</Text>?
          </Text>
          <Text style={estilos.confirmarDescripcion}>
            {seleccionadoUsuarioHastaAlternar?.disabled
              ? "El usuario volverá a tener acceso al inicio de sesión con las credenciales correspondientes a su rol."
              : "El usuario perderá inmediatamente el acceso al login de la plataforma. Esta acción quedará registrada en PostgreSQL y en la bitácora de auditoría."}
          </Text>

          <View style={estilos.modalAccionesFila}>
            <Boton
              variant="secondary"
              title="Cancelar"
              onPress={() => establecerAlternarConfirmarAbrir(false)}
            />
            <Boton
              variant={seleccionadoUsuarioHastaAlternar?.disabled ? "primary" : "danger"}
              title={seleccionadoUsuarioHastaAlternar?.disabled ? "Confirmar Habilitación" : "Confirmar Deshabilitación"}
              onPress={executeAlternarUsuario}
            />
          </View>
        </View>
      </VistaModal>

      {/* Modal Integrado de Anonimización Definitiva (Ley 19.628) */}
      <VistaModal
        visible={Boolean(usuarioParaAnonimizar)}
        onClose={() => establecerUsuarioParaAnonimizar(null)}
        title="Anonimización de Datos (Ley 19.628)"
      >
        <View style={estilos.confirmarCaja}>
          <View style={estilos.peligroShieldCaja}>
            <Ionicons name="finger-print-outline" size={38} color={tema.colors.danger} />
          </View>
          <Text style={estilos.confirmarTitulo}>
            Anonimizar irreversiblemente a {usuarioParaAnonimizar?.name}
          </Text>
          <Text style={estilos.confirmarDescripcion}>
            El RUT ({usuarioParaAnonimizar?.rut}), nombre y correo serán sustituidos permanentemente por cadenas anónimas y la cuenta quedará deshabilitada. Para confirmar, escriba{" "}
            <Text style={{ fontWeight: "bold", color: tema.colors.dangerDark }}>CONFIRMAR</Text>:
          </Text>

          <TextInput
            style={estilos.palabraClaveEntrada}
            placeholder="Escriba CONFIRMAR"
            placeholderTextColor={tema.colors.textMuted}
            value={confirmarPalabraClaveEntrada}
            onChangeText={establecerConfirmarPalabraClaveEntrada}
            autoCapitalize="characters"
          />

          <View style={estilos.modalAccionesFila}>
            <Boton
              variant="secondary"
              title="Cancelar"
              onPress={() => establecerUsuarioParaAnonimizar(null)}
            />
            <Boton
              variant="danger"
              title="Ejecutar Anonimización"
              icon="trash-bin-outline"
              disabled={confirmarPalabraClaveEntrada.trim().toUpperCase() !== "CONFIRMAR"}
              onPress={manejarConfirmarAnonimizacion}
            />
          </View>
        </View>
      </VistaModal>
    </View>
  );
};
