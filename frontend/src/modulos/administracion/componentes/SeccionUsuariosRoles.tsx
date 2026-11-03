import React from "react";
import {
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
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { TarjetaKpi } from "@/componentes/datos/TarjetaKpi";
import { estilos } from "../estilos";

export interface PropiedadesSeccionUsuariosRoles {
  activoAdministradoresConteo: number;
  activoPestana: string;
  alternarConfirmarAbrir: boolean;
  correoEntradaReferencia: React.RefObject<TextInput | null>;
  effectiveVistaModo: "cards" | "table";
  establecerAlternarConfirmarAbrir: (val: boolean) => void;
  establecerFormularioCorreo: (val: string) => void;
  establecerFormularioCorreoError: (val: string) => void;
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
  formularioCorreo: string;
  formularioCorreoError: string;
  formularioError: string;
  formularioNombre: string;
  formularioNombreError: string;
  formularioRol: Rol;
  formularioRut: string;
  formularioRutError: string;
  manejarAlternarUsuario: (u: UsuarioSistema) => void;
  manejarCrearUsuario: () => void;
  mostrarFeedback: (type: "ok" | "error" | "info", msg: string) => void;
  nombreEntradaReferencia: React.RefObject<TextInput | null>;
  nuevoUsuarioModalAbrir: boolean;
  rutEntradaReferencia: React.RefObject<TextInput | null>;
  seleccionadoUsuarioHastaAlternar: UsuarioSistema | null;
  usuarioBuscar: string;
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

export const SeccionUsuariosRoles: React.FC<PropiedadesSeccionUsuariosRoles> = ({
  activoAdministradoresConteo,
  activoPestana,
  alternarConfirmarAbrir,
  correoEntradaReferencia,
  effectiveVistaModo,
  establecerAlternarConfirmarAbrir,
  establecerFormularioCorreo,
  establecerFormularioCorreoError,
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
  formularioCorreo,
  formularioCorreoError,
  formularioError,
  formularioNombre,
  formularioNombreError,
  formularioRol,
  formularioRut,
  formularioRutError,
  manejarAlternarUsuario,
  manejarCrearUsuario,
  mostrarFeedback,
  nombreEntradaReferencia,
  nuevoUsuarioModalAbrir,
  rutEntradaReferencia,
  seleccionadoUsuarioHastaAlternar,
  usuarioBuscar,
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

          {/* Botón Nuevo Usuario */}
          <Boton
            variant="primary"
            title="Nuevo Usuario"
            icon="person-add"
            onPress={() => establecerNuevoUsuarioModalAbrir(true)}
          />
        </View>
      </Tarjeta>

      {/* Tabla / Tarjetas de Usuarios Responsiva */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.tablaTarjetaEncabezadoBarra}>
          <Text style={estilos.tablaTarjetaTitulo}>
            Usuarios Registrados ({filtradoUsuarios.length})
          </Text>
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
            onAction={() => establecerNuevoUsuarioModalAbrir(true)}
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
                      <View style={estilos.mobileRutInsignia}>
                        <Ionicons name="card-outline" size={12} color={tema.colors.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={estilos.mobileRutTexto}>{u.rut}</Text>
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
                          {u.role === "admin"
                            ? "Administrador"
                            : u.role === "warehouse"
                            ? "Bodeguero"
                            : "Técnico"}
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
                      <Text style={estilos.mobileInicioSesionEtiqueta}>ÚLTIMO ACCESO</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                        <Ionicons name="time-outline" size={13} color={tema.colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={estilos.mobileInicioSesionValor}>{u.lastLogin || "Nunca"}</Text>
                      </View>
                    </View>

                    <View style={[estilos.mobileAccionCaja, { flexDirection: "row", flexWrap: "wrap", gap: 6 }]}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 920 }}>
            <View style={{ minWidth: 920, flex: 1 }}>
              <View style={estilos.tablaEncabezadoFila}>
                <Text style={[estilos.thCelda, { width: 220 }]}>Usuario & Contacto</Text>
                <Text style={[estilos.thCelda, { width: 120 }]}>RUT</Text>
                <Text style={[estilos.thCelda, { width: 130 }]}>Rol Asignado</Text>
                <Text style={[estilos.thCelda, { width: 100 }]}>Estado</Text>
                <Text style={[estilos.thCelda, { width: 110 }]}>Último Acceso</Text>
                <Text style={[estilos.thCelda, { width: 240, textAlign: "right" }]}>Acciones de Cuenta y Privacidad</Text>
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

                    <Text style={[estilos.tdCelda, { width: 120, fontWeight: "600" }]}>{u.rut}</Text>

                    <View style={{ width: 130 }}>
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
                          {u.role === "admin"
                            ? "Administrador"
                            : u.role === "warehouse"
                            ? "Bodeguero"
                            : "Técnico"}
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
                      {u.lastLogin || "Nunca"}
                    </Text>

                    <View style={{ width: 240, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
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

      {/* Modal Formulario Nuevo Usuario */}
      <VistaModal
        visible={nuevoUsuarioModalAbrir}
        onClose={() => establecerNuevoUsuarioModalAbrir(false)}
        title="Crear Nuevo Usuario de Sistema"
      >
        <View style={estilos.formularioContenedor}>
          <Text style={estilos.formularioSubtitulo}>
            Complete los datos para generar una cuenta con acceso controlado y rol único.
          </Text>

          {formularioError !== "" && (
            <View style={estilos.errorAlerta}>
              <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
              <Text style={estilos.errorAlertaTexto}>{formularioError}</Text>
            </View>
          )}

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
            ref={nombreEntradaReferencia as any}
            label="Nombre Completo"
            placeholder="Ej: Marcelo Gómez Paredes"
            value={formularioNombre}
            onChangeText={(text) => {
              establecerFormularioNombre(text);
              if (formularioNombreError) establecerFormularioNombreError("");
            }}
            error={formularioNombreError}
          />

          <CampoTexto
            ref={correoEntradaReferencia as any}
            label="Correo Electrónico Corporativo"
            placeholder="ejemplo@fyag.cl"
            value={formularioCorreo}
            onChangeText={(text) => {
              establecerFormularioCorreo(text);
              if (formularioCorreoError) establecerFormularioCorreoError("");
            }}
            error={formularioCorreoError}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={estilos.campoEtiqueta}>Rol Asignado (Rol Único Excluyente):</Text>
          <View style={estilos.rolOpcionesGrilla}>
            {[
              {
                id: "admin" as Rol,
                title: "Administrador",
                desc: "Acceso total, auditoría, configuración, proyectos y finanzas.",
                icon: "shield-checkmark",
              },
              {
                id: "warehouse" as Rol,
                title: "Bodeguero",
                desc: "Control de insumos, recepción de compras, egresos y cardex.",
                icon: "cube",
              },
              {
                id: "technician" as Rol,
                title: "Técnico en Faena",
                desc: "Registro de avance, solicitud de materiales, horas y hojas de servicio.",
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

          <View style={estilos.modalAccionesFila}>
            <Boton
              variant="secondary"
              title="Cancelar"
              onPress={() => establecerNuevoUsuarioModalAbrir(false)}
            />
            <Boton
              variant="primary"
              title="Crear Cuenta"
              onPress={manejarCrearUsuario}
            />
          </View>
        </View>
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
              ? "El usuario volverá a tener acceso al sistema con las credenciales correspondientes a su rol."
              : "El usuario perderá inmediatamente el acceso a la plataforma. Esta acción quedará registrada en la bitácora de auditoría."}
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
