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
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { CampoContrasena } from "@/componentes/formularios/CampoContrasena";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { TarjetaKpi } from "@/componentes/datos/TarjetaKpi";
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

  return (
    <View style={estilos.seccion}>
      {/* KPI Cards de Usuarios */}
      <View style={estilos.kpiGrilla}>
        <View style={estilos.kpiTarjetaElemento}>
          <TarjetaKpi
            label="Total Usuarios"
            value={usuariosSistema.length}
            icon="people"
            tone="primary"
          />
        </View>
        <View style={estilos.kpiTarjetaElemento}>
          <TarjetaKpi
            label="Admins Activos"
            value={activoAdministradoresConteo}
            icon="shield-outline"
            tone={activoAdministradoresConteo <= 1 ? "warn" : "ok"}
            subtitle={activoAdministradoresConteo <= 1 ? "Bloqueo preventivo activo" : "Redundancia segura"}
          />
        </View>
        <View style={estilos.kpiTarjetaElemento}>
          <TarjetaKpi
            label="Bodegueros"
            value={usuariosSistema.filter((u) => u.role === "warehouse" && !u.disabled).length}
            icon="cube-outline"
            tone="info"
          />
        </View>
        <View style={estilos.kpiTarjetaElemento}>
          <TarjetaKpi
            label="Técnicos Activos"
            value={usuariosSistema.filter((u) => u.role === "technician" && !u.disabled).length}
            icon="hammer-outline"
            tone="info"
          />
        </View>
      </View>

      {/* Barra de Acciones y Filtros */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.filtrarFila}>
          <View style={estilos.buscarCaja}>
            <Ionicons name="search" size={18} color={tema.colors.textMuted} />
            <TextInput
              style={estilos.buscarEntrada}
              placeholder="Buscar por nombre, correo o RUT..."
              placeholderTextColor={tema.colors.textMuted}
              value={usuarioBuscar}
              onChangeText={establecerUsuarioBuscar}
            />
          </View>

          {/* Filtro por Rol */}
          <View style={estilos.chipFila}>
            {["todos", "admin", "warehouse", "technician"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[estilos.pequenoChip, usuarioRolFiltrar === r && estilos.pequenoChipActivo]}
                onPress={() => establecerUsuarioRolFiltrar(r)}
              >
                <Text
                  style={[
                    estilos.pequenoChipTexto,
                    usuarioRolFiltrar === r && estilos.pequenoChipTextoActivo,
                  ]}
                >
                  {r === "todos"
                    ? "Todos"
                    : r === "admin"
                    ? "Administrador"
                    : r === "warehouse"
                    ? "Bodeguero"
                    : "Técnico"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(usuarioBuscar !== "" || usuarioRolFiltrar !== "todos") && (
            <Boton
              variant="ghost"
              size="sm"
              title="Limpiar"
              icon="close-circle-outline"
              onPress={() => {
                establecerUsuarioBuscar("");
                establecerUsuarioRolFiltrar("todos");
              }}
            />
          )}

          {manejarRecargarUsuarios && (
            <Boton
              variant="secondary"
              size="sm"
              title={cargandoUsuariosBd ? "Sincronizando..." : "Sincronizar BD"}
              icon="refresh-outline"
              onPress={manejarRecargarUsuarios}
              disabled={cargandoUsuariosBd}
            />
          )}

          {/* Botón Nuevo Usuario */}
          <Boton
            variant="primary"
            title="Nuevo Usuario"
            icon="person-add"
            onPress={manejarAbrirCrearUsuario}
          />
        </View>
      </Tarjeta>

      {/* Tabla / Tarjetas de Usuarios Responsiva */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.tablaTarjetaEncabezadoBarra}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={estilos.tablaTarjetaTitulo}>
              Usuarios Registrados ({filtradoUsuarios.length})
            </Text>
            {cargandoUsuariosBd && (
              <ActivityIndicator size="small" color={tema.colors.primary} />
            )}
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

        {filtradoUsuarios.length === 0 ? (
          <EstadoVacio
            icon="people-outline"
            title="Sin usuarios coincidentes"
            description="No se encontraron usuarios con los filtros de rol o búsqueda aplicados."
            actionTitle="+ Nuevo Usuario"
            onAction={manejarAbrirCrearUsuario}
            containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
          />
        ) : effectiveVistaModo === "cards" ? (
          /* VISTA RESPONSIVA MÓVIL: TARJETAS ERGONÓMICAS */
          <View style={estilos.mobileTarjetasContenedor}>
            {filtradoUsuarios.map((u) => {
              const esOnlyAdmin = !u.disabled && u.role === "admin" && activoAdministradoresConteo <= 1;
              const yaAnonimizado = u.rut.startsWith("XX.");

              return (
                <View key={u.id} style={[estilos.mobileUsuarioTarjeta, u.disabled && estilos.mobileUsuarioTarjetaDeshabilitado]}>
                  <View style={estilos.mobileUsuarioTarjetaEncabezado}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={estilos.mobileUsuarioNombre}>{u.name}</Text>
                      <Text style={estilos.mobileUsuarioCorreo}>{u.email}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <View style={[estilos.mobileRutInsignia, { marginTop: 0 }]}>
                          <Ionicons name="card-outline" size={12} color={tema.colors.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={estilos.mobileRutTexto}>{u.rut || "Sin RUT"}</Text>
                        </View>
                        {u.especializacion ? (
                          <View style={[estilos.mobileRutInsignia, { marginTop: 0 }]}>
                            <Ionicons name="construct-outline" size={12} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                            <Text style={[estilos.mobileRutTexto, { color: tema.colors.primaryDark }]}>
                              {u.especializacion}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={estilos.mobileBadgesColumna}>
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

                      <View style={{ marginTop: 6, alignSelf: "flex-end" }}>
                        <InsigniaEstado
                          status={u.disabled ? "rechazada" : "aprobada"}
                          label={u.disabled ? "Inactivo" : "Activo"}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={estilos.mobileUsuarioTarjetaDivisor} />

                  <View style={estilos.mobileUsuarioTarjetaPie}>
                    <View style={estilos.mobileInicioSesionInfo}>
                      <Text style={estilos.mobileInicioSesionEtiqueta}>ACCESO LOGIN</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                        <Ionicons
                          name={u.disabled ? "lock-closed-outline" : "checkmark-circle-outline"}
                          size={13}
                          color={u.disabled ? tema.colors.danger : tema.colors.ok}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={estilos.mobileInicioSesionValor}>
                          {u.disabled ? "Bloqueado" : "Habilitado en BD"}
                        </Text>
                      </View>
                    </View>

                    <View style={[estilos.mobileAccionCaja, { flexDirection: "row", flexWrap: "wrap", gap: 6 }]}>
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
                </View>
              );
            })}
          </View>
        ) : (
          /* VISTA ESCRITORIO / TABLA */
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
        )}
      </Tarjeta>

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
