import React, { useState, useMemo, useRef } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { esRutValido } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Rol, UsuarioSistema, ParametroSistema } from "@/nucleo/tipos";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { estilos } from "./estilos";
import {
  SeccionUsuariosRoles,
  SeccionAuditoria,
  SeccionParametrosSistema,
} from "./componentes";

type AdminTab = "usuarios" | "auditoria" | "parametros";

export const PantallaAdministracion: React.FC = () => {
  const { width } = useWindowDimensions();
  const esMobile = width < 768;
  const [usuarioVistaModo, establecerUsuarioVistaModo] = useState<"auto" | "cards" | "table">("auto");
  const effectiveVistaModo = usuarioVistaModo === "auto" ? (esMobile ? "cards" : "table") : usuarioVistaModo;

  const {
    usuariosSistema,
    registrosAuditoria,
    parametrosSistema,
    registrosRespaldo,
    crearUsuarioSistema,
    alternarUsuarioSistemaDeshabilitado,
    anonimizarUsuario,
    actualizarParametroSistema,
    restablecerParametroSistema,
    ejecutarRespaldoManual,
    ejecutarPruebaRestauracion,
  } = usarAplicacion();

  const [activoPestana, establecerActivoPestana] = useState<AdminTab>("usuarios");
  const [feedback, establecerFeedback] = useState<{ type: "ok" | "error" | "info"; message: string } | null>(null);

  const mostrarFeedback = (type: "ok" | "error" | "info", message: string) => {
    establecerFeedback({ type, message });
    setTimeout(() => establecerFeedback(null), 5000);
  };

  // =========================================================================
  // 1. USUARIOS Y PRIVACIDAD (LEY 19.628 INTEGRADA)
  // =========================================================================
  const [usuarioBuscar, establecerUsuarioBuscar] = useState("");
  const [usuarioRolFiltrar, establecerUsuarioRolFiltrar] = useState<string>("todos");
  const [nuevoUsuarioModalAbrir, establecerNuevoUsuarioModalAbrir] = useState(false);
  const [seleccionadoUsuarioHastaAlternar, establecerSeleccionadoUsuarioHastaAlternar] = useState<UsuarioSistema | null>(null);
  const [alternarConfirmarAbrir, establecerAlternarConfirmarAbrir] = useState(false);

  // Anonimización integrada en Usuarios
  const [usuarioParaAnonimizar, establecerUsuarioParaAnonimizar] = useState<UsuarioSistema | null>(null);
  const [confirmarPalabraClaveEntrada, establecerConfirmarPalabraClaveEntrada] = useState("");

  // Formulario nuevo usuario
  const rutEntradaReferencia = useRef<TextInput>(null);
  const nombreEntradaReferencia = useRef<TextInput>(null);
  const correoEntradaReferencia = useRef<TextInput>(null);
  const [formularioRut, establecerFormularioRut] = useState("");
  const [formularioRutError, establecerFormularioRutError] = useState("");
  const [formularioNombre, establecerFormularioNombre] = useState("");
  const [formularioNombreError, establecerFormularioNombreError] = useState("");
  const [formularioCorreo, establecerFormularioCorreo] = useState("");
  const [formularioCorreoError, establecerFormularioCorreoError] = useState("");
  const [formularioRol, establecerFormularioRol] = useState<Rol>("technician");
  const [formularioError, establecerFormularioError] = useState("");

  const activoAdministradoresConteo = usuariosSistema.filter((u) => u.role === "admin" && !u.disabled).length;

  const filtradoUsuarios = useMemo(() => {
    return usuariosSistema.filter((u) => {
      const coincidenciaBuscar =
        u.name.toLowerCase().includes(usuarioBuscar.toLowerCase()) ||
        u.email.toLowerCase().includes(usuarioBuscar.toLowerCase()) ||
        u.rut.toLowerCase().includes(usuarioBuscar.toLowerCase());
      const coincidenciaRol = usuarioRolFiltrar === "todos" || u.role === usuarioRolFiltrar;
      return coincidenciaBuscar && coincidenciaRol;
    });
  }, [usuariosSistema, usuarioBuscar, usuarioRolFiltrar]);

  const manejarCrearUsuario = () => {
    establecerFormularioRutError("");
    establecerFormularioNombreError("");
    establecerFormularioCorreoError("");
    establecerFormularioError("");

    if (!formularioRut.trim()) {
      establecerFormularioRutError("El RUT es obligatorio.");
      establecerFormularioError("El RUT es obligatorio.");
      rutEntradaReferencia.current?.focus();
      return;
    }
    if (!esRutValido(formularioRut)) {
      establecerFormularioRutError("RUT inválido. Formato esperado: 12.345.678-5");
      establecerFormularioError("El RUT ingresado no es válido. Formato esperado: 12.345.678-5");
      rutEntradaReferencia.current?.focus();
      return;
    }
    if (!formularioNombre.trim()) {
      establecerFormularioNombreError("El nombre completo es obligatorio.");
      establecerFormularioError("El nombre completo es obligatorio.");
      nombreEntradaReferencia.current?.focus();
      return;
    }
    if (!formularioCorreo.trim() || !formularioCorreo.includes("@") || !formularioCorreo.includes(".")) {
      establecerFormularioCorreoError("Ingrese un correo corporativo válido.");
      establecerFormularioError("Ingrese un correo electrónico institucional válido.");
      correoEntradaReferencia.current?.focus();
      return;
    }

    const resultado = crearUsuarioSistema({
      rut: formularioRut.trim(),
      name: formularioNombre.trim(),
      email: formularioCorreo.trim().toLowerCase(),
      role: formularioRol,
      lastLogin: "Nunca",
    });

    if (resultado.success) {
      establecerNuevoUsuarioModalAbrir(false);
      establecerFormularioRut("");
      establecerFormularioRutError("");
      establecerFormularioNombre("");
      establecerFormularioNombreError("");
      establecerFormularioCorreo("");
      establecerFormularioCorreoError("");
      establecerFormularioRol("technician");
      mostrarFeedback("ok", `Usuario ${formularioNombre} creado exitosamente.`);
    } else {
      establecerFormularioError(resultado.error || "Error al crear usuario.");
    }
  };

  const manejarAlternarUsuario = (targetUser: UsuarioSistema) => {
    if (!targetUser.disabled && targetUser.role === "admin" && activoAdministradoresConteo <= 1) {
      mostrarFeedback(
        "error",
        "Operación bloqueada: No se puede deshabilitar al único Administrador activo del sistema."
      );
      return;
    }
    establecerSeleccionadoUsuarioHastaAlternar(targetUser);
    establecerAlternarConfirmarAbrir(true);
  };

  const executeAlternarUsuario = () => {
    if (!seleccionadoUsuarioHastaAlternar) return;
    const res = alternarUsuarioSistemaDeshabilitado(seleccionadoUsuarioHastaAlternar.id);
    establecerAlternarConfirmarAbrir(false);
    if (res.success) {
      mostrarFeedback(
        "ok",
        `Usuario ${seleccionadoUsuarioHastaAlternar.name} ${
          seleccionadoUsuarioHastaAlternar.disabled ? "habilitado" : "deshabilitado"
        } correctamente.`
      );
    } else {
      mostrarFeedback("error", res.error || "No fue posible modificar el estado del usuario.");
    }
    establecerSeleccionadoUsuarioHastaAlternar(null);
  };

  const manejarConfirmarAnonimizacion = () => {
    if (!usuarioParaAnonimizar) return;
    if (confirmarPalabraClaveEntrada.trim().toUpperCase() !== "CONFIRMAR") {
      mostrarFeedback("error", 'Debe escribir exactamente "CONFIRMAR" para autorizar la acción.');
      return;
    }
    const res = anonimizarUsuario(usuarioParaAnonimizar.id);
    establecerUsuarioParaAnonimizar(null);
    establecerConfirmarPalabraClaveEntrada("");

    if (res.success) {
      mostrarFeedback("ok", "Datos personales del usuario anonimizados conforme a la Ley 19.628.");
    } else {
      mostrarFeedback("error", res.error || "No se pudo anonimizar al usuario.");
    }
  };

  // =========================================================================
  // 2. AUDITORÍA INMUTABLE
  // =========================================================================
  const [auditoriaBuscar, establecerAuditoriaBuscar] = useState("");
  const [auditoriaEntityFiltrar, establecerAuditoriaEntityFiltrar] = useState<string>("todas");
  const [auditoriaFechaFiltrar, establecerAuditoriaFechaFiltrar] = useState<"todos" | "hoy" | "7dias" | "30dias">("todos");

  const filtradoAuditoriaRegistros = useMemo(() => {
    return registrosAuditoria.filter((log) => {
      const matchSearch =
        log.description.toLowerCase().includes(auditoriaBuscar.toLowerCase()) ||
        log.fieldChanged.toLowerCase().includes(auditoriaBuscar.toLowerCase()) ||
        log.userName.toLowerCase().includes(auditoriaBuscar.toLowerCase()) ||
        log.userRut.toLowerCase().includes(auditoriaBuscar.toLowerCase());

      const coincidenciaEntity = auditoriaEntityFiltrar === "todas" || log.entity === auditoriaEntityFiltrar;

      let coincidenciaFecha = true;
      if (auditoriaFechaFiltrar === "hoy") {
        coincidenciaFecha = log.timestamp.includes("14-10-2026") || log.timestamp.includes("Hoy");
      }
      return matchSearch && coincidenciaEntity && coincidenciaFecha;
    });
  }, [registrosAuditoria, auditoriaBuscar, auditoriaEntityFiltrar, auditoriaFechaFiltrar]);

  // =========================================================================
  // 3. PARÁMETROS Y RESPALDOS
  // =========================================================================
  const [parametroGrupoFiltrar, establecerParametroGrupoFiltrar] = useState<"seguridad" | "inventario" | "costos" | "alertas">("seguridad");
  const [parametroValores, establecerParametroValores] = useState<{ [id: string]: string | number }>({});

  const manejarParametroCambiar = (id: string, val: string | number) => {
    establecerParametroValores((prev) => ({ ...prev, [id]: val }));
  };

  const manejarGuardarParametro = (param: ParametroSistema) => {
    const entered = parametroValores[param.id] !== undefined ? parametroValores[param.id] : param.value;
    const numeroValor = Number(entered);

    if (param.type === "number") {
      if (isNaN(numeroValor)) {
        mostrarFeedback("error", `El valor para ${param.name} debe ser un número válido.`);
        return;
      }
      if (param.min !== undefined && numeroValor < param.min) {
        mostrarFeedback("error", `El valor mínimo permitido para ${param.name} es ${param.min} ${param.unit || ""}.`);
        return;
      }
      if (param.max !== undefined && numeroValor > param.max) {
        mostrarFeedback("error", `El valor máximo permitido para ${param.name} es ${param.max} ${param.unit || ""}.`);
        return;
      }
      actualizarParametroSistema(param.id, numeroValor);
    } else {
      actualizarParametroSistema(param.id, entered);
    }
    mostrarFeedback("ok", `Parámetro "${param.name}" actualizado exitosamente.`);
  };

  const manejarRestablecerParametro = (param: ParametroSistema) => {
    restablecerParametroSistema(param.id);
    establecerParametroValores((prev) => ({ ...prev, [param.id]: param.defaultValue }));
    mostrarFeedback("ok", `Parámetro "${param.name}" restablecido a su valor de fábrica (${param.defaultValue} ${param.unit || ""}).`);
  };

  const tieneRespaldoFailure = registrosRespaldo.some((b) => b.status === "fallo");

  const manejarEjecutarRespaldo = () => {
    const res = ejecutarRespaldoManual();
    if (res.success) {
      mostrarFeedback("ok", `Respaldo manual completado exitosamente: ${res.filename}`);
    }
  };

  const manejarEjecutarRestauracionTest = () => {
    const res = ejecutarPruebaRestauracion();
    if (res.success) {
      mostrarFeedback("ok", "Prueba de restauración en sandbox ejecutada con éxito. Integridad verificada al 100%.");
    }
  };

  return (
    <ContenedorEstadoPantalla screenTitle="Sistema y Auditoría" skeletonType="table">
      <View style={estilos.contenedor}>
        <EncabezadoPagina
          title="Sistema y Auditoría"
          subtitle="Gestión de usuarios, bitácora de auditoría inmutable, parámetros operativos y respaldos"
          breadcrumbs={["Inicio", "Administración", "Sistema y Auditoría"]}
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.contenidoContenedor}>
          {/* Banner de Feedback Global */}
          {feedback && (
            <View
              style={[
                estilos.feedbackBanner,
                feedback.type === "ok" && estilos.feedbackBannerExito,
                feedback.type === "error" && estilos.feedbackBannerError,
                feedback.type === "info" && estilos.feedbackBannerInfo,
              ]}
            >
              <Ionicons
                name={
                  feedback.type === "ok"
                    ? "checkmark-circle"
                    : feedback.type === "error"
                    ? "alert-circle"
                    : "information-circle"
                }
                size={20}
                color={
                  feedback.type === "ok"
                    ? tema.colors.ok
                    : feedback.type === "error"
                    ? tema.colors.danger
                    : tema.colors.primaryDark
                }
              />
              <Text
                style={[
                  estilos.feedbackTexto,
                  feedback.type === "ok" && estilos.feedbackTextoExito,
                  feedback.type === "error" && estilos.feedbackTextoError,
                  feedback.type === "info" && estilos.feedbackTextoInfo,
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          )}

          {/* Selector Simplificado de 3 Pestañas */}
          <View style={estilos.pestanaBarra}>
            {[
              { id: "usuarios", label: "Usuarios y Roles", icon: "people-outline" },
              { id: "auditoria", label: "Bitácora de Auditoría", icon: "shield-checkmark-outline" },
              { id: "parametros", label: "Parámetros y Respaldos", icon: "options-outline" },
            ].map((tab) => {
              const esActivo = activoPestana === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[estilos.pestanaBoton, esActivo && estilos.pestanaBotonActivo]}
                  onPress={() => establecerActivoPestana(tab.id as AdminTab)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={esActivo ? tema.colors.primaryDark : tema.colors.textSecondary}
                  />
                  <Text style={[estilos.pestanaBotonTexto, esActivo && estilos.pestanaBotonTextoActivo]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <SeccionUsuariosRoles
            activoAdministradoresConteo={activoAdministradoresConteo}
            activoPestana={activoPestana}
            alternarConfirmarAbrir={alternarConfirmarAbrir}
            correoEntradaReferencia={correoEntradaReferencia}
            effectiveVistaModo={effectiveVistaModo}
            establecerAlternarConfirmarAbrir={establecerAlternarConfirmarAbrir}
            establecerFormularioCorreo={establecerFormularioCorreo}
            establecerFormularioCorreoError={establecerFormularioCorreoError}
            establecerFormularioNombre={establecerFormularioNombre}
            establecerFormularioNombreError={establecerFormularioNombreError}
            establecerFormularioRol={establecerFormularioRol}
            establecerFormularioRut={establecerFormularioRut}
            establecerFormularioRutError={establecerFormularioRutError}
            establecerNuevoUsuarioModalAbrir={establecerNuevoUsuarioModalAbrir}
            establecerUsuarioBuscar={establecerUsuarioBuscar}
            establecerUsuarioRolFiltrar={establecerUsuarioRolFiltrar}
            establecerUsuarioVistaModo={establecerUsuarioVistaModo}
            executeAlternarUsuario={executeAlternarUsuario}
            filtradoUsuarios={filtradoUsuarios}
            formularioCorreo={formularioCorreo}
            formularioCorreoError={formularioCorreoError}
            formularioError={formularioError}
            formularioNombre={formularioNombre}
            formularioNombreError={formularioNombreError}
            formularioRol={formularioRol}
            formularioRut={formularioRut}
            formularioRutError={formularioRutError}
            manejarAlternarUsuario={manejarAlternarUsuario}
            manejarCrearUsuario={manejarCrearUsuario}
            mostrarFeedback={mostrarFeedback}
            nombreEntradaReferencia={nombreEntradaReferencia}
            nuevoUsuarioModalAbrir={nuevoUsuarioModalAbrir}
            rutEntradaReferencia={rutEntradaReferencia}
            seleccionadoUsuarioHastaAlternar={seleccionadoUsuarioHastaAlternar}
            usuarioBuscar={usuarioBuscar}
            usuarioRolFiltrar={usuarioRolFiltrar}
            usuariosSistema={usuariosSistema}
            width={width}
            usuarioParaAnonimizar={usuarioParaAnonimizar}
            establecerUsuarioParaAnonimizar={establecerUsuarioParaAnonimizar}
            confirmarPalabraClaveEntrada={confirmarPalabraClaveEntrada}
            establecerConfirmarPalabraClaveEntrada={establecerConfirmarPalabraClaveEntrada}
            manejarConfirmarAnonimizacion={manejarConfirmarAnonimizacion}
          />

          <SeccionAuditoria
            activoPestana={activoPestana}
            auditoriaBuscar={auditoriaBuscar}
            auditoriaEntityFiltrar={auditoriaEntityFiltrar}
            auditoriaFechaFiltrar={auditoriaFechaFiltrar}
            establecerAuditoriaBuscar={establecerAuditoriaBuscar}
            establecerAuditoriaEntityFiltrar={establecerAuditoriaEntityFiltrar}
            establecerAuditoriaFechaFiltrar={establecerAuditoriaFechaFiltrar}
            filtradoAuditoriaRegistros={filtradoAuditoriaRegistros}
            width={width}
          />

          <SeccionParametrosSistema
            activoPestana={activoPestana}
            establecerParametroGrupoFiltrar={establecerParametroGrupoFiltrar}
            manejarGuardarParametro={manejarGuardarParametro}
            manejarParametroCambiar={manejarParametroCambiar}
            manejarRestablecerParametro={manejarRestablecerParametro}
            parametroGrupoFiltrar={parametroGrupoFiltrar}
            parametroValores={parametroValores}
            parametrosSistema={parametrosSistema}
            registrosRespaldo={registrosRespaldo}
            tieneRespaldoFailure={tieneRespaldoFailure}
            manejarEjecutarRespaldo={manejarEjecutarRespaldo}
            manejarEjecutarRestauracionTest={manejarEjecutarRestauracionTest}
          />
        </ScrollView>
      </View>
    </ContenedorEstadoPantalla>
  );
};
