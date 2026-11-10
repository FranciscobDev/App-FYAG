import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { esRutValido } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Rol, UsuarioSistema, ParametroSistema } from "@/nucleo/tipos";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  Usuario as UsuarioBd,
} from "@/modulos/usuarios/usuariosApi";
import { estilos } from "./estilos";
import {
  SeccionUsuariosRoles,
  SeccionAuditoria,
  SeccionParametrosSistema,
} from "./componentes";
import { CredencialesCreadas } from "./componentes/SeccionUsuariosRoles";

type AdminTab = "usuarios" | "auditoria" | "parametros";

function mapearRolDesdeNombreBd(nombreRol: string | null | undefined, idRol?: number): Rol {
  const normalizado = (nombreRol ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (normalizado.includes("admin")) return "admin";
  if (normalizado.includes("bodeg") || normalizado.includes("warehouse") || normalizado.includes("almacen")) {
    return "warehouse";
  }
  if (normalizado.includes("tecnic") || normalizado.includes("technician") || normalizado.includes("terreno")) {
    return "technician";
  }
  if (idRol === 1) return "admin";
  if (idRol === 2) return "warehouse";
  return "technician";
}

function mapearUsuarioBdASistema(u: UsuarioBd): UsuarioSistema {
  const nombreCompleto = `${u.nombre_usuario || ""} ${u.apellido_usuario || ""}`.trim();
  const ultimoAccesoStr = u.ultimo_acceso
    ? new Date(u.ultimo_acceso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Nunca";
  return {
    id: `db_${u.id_usuario}`,
    id_usuario: u.id_usuario,
    rut: u.rut || "Sin RUT",
    name: nombreCompleto || u.correo_usuario,
    nombre: u.nombre_usuario,
    apellido: u.apellido_usuario,
    email: u.correo_usuario,
    role: mapearRolDesdeNombreBd(u.nombre_rol, u.id_rol),
    especializacion: u.especializacion,
    disabled: !u.activo,
    createdAt: new Date().toISOString(),
    lastLogin: ultimoAccesoStr,
  };
}

export const PantallaAdministracion: React.FC = () => {
  const { width } = useWindowDimensions();
  const esMobile = width < 768;
  const [usuarioVistaModo, establecerUsuarioVistaModo] = useState<"auto" | "cards" | "table">("auto");
  const effectiveVistaModo = usuarioVistaModo === "auto" ? (esMobile ? "cards" : "table") : usuarioVistaModo;

  const { usuario: usuarioActual } = usarAutenticacion();
  const {
    usuariosSistema,
    registrosAuditoria,
    parametrosSistema,
    registrosRespaldo,
    sincronizarUsuariosSistema,
    registrarEventoAuditoria,
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
  const [cargandoUsuariosBd, establecerCargandoUsuariosBd] = useState(false);
  const [guardandoUsuario, establecerGuardandoUsuario] = useState(false);

  const mostrarFeedback = (type: "ok" | "error" | "info", message: string) => {
    establecerFeedback({ type, message });
    setTimeout(() => establecerFeedback(null), 5000);
  };

  // =========================================================================
  // 1. USUARIOS Y PRIVACIDAD (CONECTADO A POSTGRESQL + LEY 19.628)
  // =========================================================================
  const cargarUsuariosDesdeBd = useCallback(async (silencioso = false) => {
    establecerCargandoUsuariosBd(true);
    const res = await listarUsuarios();
    establecerCargandoUsuariosBd(false);

    if (res.ok && res.data) {
      const mapeados = res.data.map(mapearUsuarioBdASistema);
      sincronizarUsuariosSistema(mapeados);
      if (!silencioso) {
        mostrarFeedback("info", `Sincronizados ${mapeados.length} usuarios desde PostgreSQL.`);
      }
    } else if (!silencioso) {
      mostrarFeedback("error", res.error || "No se pudo sincronizar la lista de usuarios con el servidor.");
    }
  }, [sincronizarUsuariosSistema]);

  useEffect(() => {
    cargarUsuariosDesdeBd(true);
  }, [cargarUsuariosDesdeBd]);

  const [usuarioBuscar, establecerUsuarioBuscar] = useState("");
  const [usuarioRolFiltrar, establecerUsuarioRolFiltrar] = useState<string>("todos");
  const [nuevoUsuarioModalAbrir, establecerNuevoUsuarioModalAbrir] = useState(false);
  const [usuarioEditando, establecerUsuarioEditando] = useState<UsuarioSistema | null>(null);
  const [credencialesRecientes, establecerCredencialesRecientes] = useState<CredencialesCreadas | null>(null);
  const [seleccionadoUsuarioHastaAlternar, establecerSeleccionadoUsuarioHastaAlternar] = useState<UsuarioSistema | null>(null);
  const [alternarConfirmarAbrir, establecerAlternarConfirmarAbrir] = useState(false);

  // Anonimización integrada en Usuarios
  const [usuarioParaAnonimizar, establecerUsuarioParaAnonimizar] = useState<UsuarioSistema | null>(null);
  const [confirmarPalabraClaveEntrada, establecerConfirmarPalabraClaveEntrada] = useState("");

  // Formulario crear / editar usuario
  const rutEntradaReferencia = useRef<React.ComponentRef<typeof TextInput>>(null);
  const nombreEntradaReferencia = useRef<React.ComponentRef<typeof TextInput>>(null);
  const correoEntradaReferencia = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [formularioRut, establecerFormularioRut] = useState("");
  const [formularioRutError, establecerFormularioRutError] = useState("");
  const [formularioNombre, establecerFormularioNombre] = useState("");
  const [formularioNombreError, establecerFormularioNombreError] = useState("");
  const [formularioApellido, establecerFormularioApellido] = useState("");
  const [formularioApellidoError, establecerFormularioApellidoError] = useState("");
  const [formularioCorreo, establecerFormularioCorreo] = useState("");
  const [formularioCorreoError, establecerFormularioCorreoError] = useState("");
  const [formularioContrasena, establecerFormularioContrasena] = useState("");
  const [formularioContrasenaError, establecerFormularioContrasenaError] = useState("");
  const [formularioRol, establecerFormularioRol] = useState<Rol>("technician");
  const [formularioEspecializacion, establecerFormularioEspecializacion] = useState("");
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

  const limpiarErroresFormulario = () => {
    establecerFormularioRutError("");
    establecerFormularioNombreError("");
    establecerFormularioApellidoError("");
    establecerFormularioCorreoError("");
    establecerFormularioContrasenaError("");
    establecerFormularioError("");
  };

  const manejarAbrirCrearUsuario = () => {
    limpiarErroresFormulario();
    establecerUsuarioEditando(null);
    establecerFormularioNombre("");
    establecerFormularioApellido("");
    establecerFormularioRut("");
    establecerFormularioCorreo("");
    establecerFormularioContrasena("");
    establecerFormularioRol("technician");
    establecerFormularioEspecializacion("");
    establecerNuevoUsuarioModalAbrir(true);
  };

  const manejarAbrirEditarUsuario = (u: UsuarioSistema) => {
    limpiarErroresFormulario();
    establecerUsuarioEditando(u);

    let nombreInicial = u.nombre || "";
    let apellidoInicial = u.apellido || "";
    if (!nombreInicial && u.name) {
      const partes = u.name.trim().split(/\s+/);
      nombreInicial = partes[0] || "";
      apellidoInicial = partes.slice(1).join(" ") || "";
    }

    establecerFormularioNombre(nombreInicial);
    establecerFormularioApellido(apellidoInicial);
    establecerFormularioRut(u.rut && u.rut !== "Sin RUT" ? u.rut : "");
    establecerFormularioCorreo(u.email);
    establecerFormularioContrasena("");
    establecerFormularioRol(u.role);
    establecerFormularioEspecializacion(u.especializacion || "");
    establecerNuevoUsuarioModalAbrir(true);
  };

  const generarContrasenaSugerida = () => {
    const sufijo = Math.floor(1000 + Math.random() * 9000);
    const prefijoRol =
      formularioRol === "admin"
        ? "Admin"
        : formularioRol === "warehouse"
          ? "Bodega"
          : "Tecnico";
    establecerFormularioContrasena(`${prefijoRol}.${sufijo}`);
    establecerFormularioContrasenaError("");
  };

  const manejarGuardarUsuario = async () => {
    limpiarErroresFormulario();

    if (!formularioNombre.trim()) {
      establecerFormularioNombreError("El nombre es obligatorio.");
      establecerFormularioError("El nombre del usuario es obligatorio.");
      nombreEntradaReferencia.current?.focus();
      return;
    }

    if (!formularioApellido.trim()) {
      establecerFormularioApellidoError("El apellido es obligatorio.");
      establecerFormularioError("El apellido del usuario es obligatorio.");
      return;
    }

    if (formularioRut.trim() && !esRutValido(formularioRut.trim())) {
      establecerFormularioRutError("RUT inválido. Formato esperado: 12.345.678-5");
      establecerFormularioError("El RUT ingresado no es válido. Formato esperado: 12.345.678-5");
      rutEntradaReferencia.current?.focus();
      return;
    }

    if (!formularioCorreo.trim() || !formularioCorreo.includes("@") || !formularioCorreo.includes(".")) {
      establecerFormularioCorreoError("Ingrese un correo electrónico válido.");
      establecerFormularioError("Ingrese un correo electrónico válido para el inicio de sesión.");
      correoEntradaReferencia.current?.focus();
      return;
    }

    if (!usuarioEditando && formularioContrasena.trim().length < 4) {
      establecerFormularioContrasenaError("La contraseña debe tener al menos 4 caracteres.");
      establecerFormularioError("Debe asignar una contraseña de al menos 4 caracteres para que el usuario pueda iniciar sesión.");
      return;
    }

    if (usuarioEditando && formularioContrasena.trim().length > 0 && formularioContrasena.trim().length < 4) {
      establecerFormularioContrasenaError("La nueva contraseña debe tener al menos 4 caracteres.");
      establecerFormularioError("Si desea cambiar la contraseña, debe tener al menos 4 caracteres.");
      return;
    }

    const nombreLimpio = formularioNombre.trim();
    const apellidoLimpio = formularioApellido.trim();
    const nombreCompleto = `${nombreLimpio} ${apellidoLimpio}`.trim();
    const correoLimpio = formularioCorreo.trim().toLowerCase();
    const rutLimpio = formularioRut.trim() ? formularioRut.trim() : null;
    const contrasenaLimpia = formularioContrasena.trim();
    const especializacionLimpia =
      formularioRol === "technician" && formularioEspecializacion.trim()
        ? formularioEspecializacion.trim()
        : null;

    establecerGuardandoUsuario(true);

    // MODO EDICIÓN
    if (usuarioEditando && usuarioEditando.id_usuario) {
      const res = await actualizarUsuario(usuarioEditando.id_usuario, {
        nombre_usuario: nombreLimpio,
        apellido_usuario: apellidoLimpio,
        correo_usuario: correoLimpio,
        rut: rutLimpio,
        rol_codigo: formularioRol,
        especializacion: especializacionLimpia,
        contrasena: contrasenaLimpia || undefined,
        activo: !usuarioEditando.disabled,
      });

      establecerGuardandoUsuario(false);

      if (!res.ok) {
        establecerFormularioError(res.error || "No se pudo actualizar el usuario en PostgreSQL.");
        return;
      }

      await cargarUsuariosDesdeBd(true);
      establecerNuevoUsuarioModalAbrir(false);

      registrarEventoAuditoria({
        userRut: usuarioActual?.rut || "12.456.789-5",
        userName: usuarioActual?.name || "Administrador",
        userRole: "admin",
        entity: "Usuarios",
        action: "modificacion",
        fieldChanged: contrasenaLimpia ? "Datos y Contraseña" : "Datos de Cuenta",
        oldValue: `${usuarioEditando.name} (${usuarioEditando.email} - ${usuarioEditando.role})`,
        newValue: `${nombreCompleto} (${correoLimpio} - ${formularioRol})`,
        description: `Actualización de cuenta de usuario en PostgreSQL${contrasenaLimpia ? " (incluye cambio de contraseña)" : ""}`,
      });

      mostrarFeedback("ok", `Cuenta de ${nombreCompleto} actualizada exitosamente.`);
      if (contrasenaLimpia) {
        establecerCredencialesRecientes({
          nombre: nombreCompleto,
          correo: correoLimpio,
          contrasena: contrasenaLimpia,
          rol: formularioRol,
          esEdicion: true,
        });
      }
      return;
    }

    // MODO CREACIÓN EN POSTGRESQL
    const res = await crearUsuario({
      nombre_usuario: nombreLimpio,
      apellido_usuario: apellidoLimpio,
      correo_usuario: correoLimpio,
      rut: rutLimpio,
      rol_codigo: formularioRol,
      especializacion: especializacionLimpia,
      contrasena: contrasenaLimpia,
      activo: true,
    });

    establecerGuardandoUsuario(false);

    if (res.ok && res.data?.usuario) {
      await cargarUsuariosDesdeBd(true);
      establecerNuevoUsuarioModalAbrir(false);

      registrarEventoAuditoria({
        userRut: usuarioActual?.rut || "12.456.789-5",
        userName: usuarioActual?.name || "Administrador",
        userRole: "admin",
        entity: "Usuarios",
        action: "creacion",
        fieldChanged: "Nuevo Usuario BD",
        oldValue: "-",
        newValue: `${nombreCompleto} (${formularioRol}) - ${correoLimpio}`,
        description: `Creación de cuenta en PostgreSQL con rol ${formularioRol} y correo ${correoLimpio}`,
      });

      mostrarFeedback("ok", `Cuenta creada para ${nombreCompleto}. Ya puede iniciar sesión.`);
      establecerCredencialesRecientes({
        nombre: nombreCompleto,
        correo: correoLimpio,
        contrasena: contrasenaLimpia,
        rol: formularioRol,
        esEdicion: false,
      });
    } else {
      // Si el backend devuelve un error de validación (ej. correo o RUT duplicado), mostrarlo en el formulario
      if (res.error && res.error !== "No se pudo conectar con el servidor") {
        establecerFormularioError(res.error);
        return;
      }

      // Fallback local solo si no hay conexión al servidor
      const resultadoLocal = crearUsuarioSistema({
        rut: rutLimpio || "Sin RUT",
        name: nombreCompleto,
        email: correoLimpio,
        role: formularioRol,
        lastLogin: "Nunca",
      });

      if (resultadoLocal.success) {
        establecerNuevoUsuarioModalAbrir(false);
        mostrarFeedback("info", `Usuario ${nombreCompleto} registrado en modo local (sin conexión al servidor).`);
      } else {
        establecerFormularioError(res.error || resultadoLocal.error || "Error al crear usuario.");
      }
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

  const executeAlternarUsuario = async () => {
    if (!seleccionadoUsuarioHastaAlternar) return;
    const usuarioObjetivo = seleccionadoUsuarioHastaAlternar;
    establecerAlternarConfirmarAbrir(false);

    if (usuarioObjetivo.id_usuario) {
      const partesNombre = usuarioObjetivo.name.trim().split(/\s+/);
      const nombre = usuarioObjetivo.nombre || partesNombre[0] || "Usuario";
      const apellido = usuarioObjetivo.apellido || partesNombre.slice(1).join(" ") || "-";
      const nuevoActivo = usuarioObjetivo.disabled; // si estaba disabled, pasa a activo=true

      const res = await actualizarUsuario(usuarioObjetivo.id_usuario, {
        nombre_usuario: nombre,
        apellido_usuario: apellido,
        correo_usuario: usuarioObjetivo.email,
        rut: usuarioObjetivo.rut !== "Sin RUT" ? usuarioObjetivo.rut : null,
        rol_codigo: usuarioObjetivo.role,
        especializacion: usuarioObjetivo.especializacion || null,
        activo: nuevoActivo,
      });

      if (res.ok) {
        await cargarUsuariosDesdeBd(true);
        registrarEventoAuditoria({
          userRut: usuarioActual?.rut || "12.456.789-5",
          userName: usuarioActual?.name || "Administrador",
          userRole: "admin",
          entity: "Usuarios",
          action: nuevoActivo ? "modificacion" : "deshabilitacion",
          fieldChanged: `Estado ${usuarioObjetivo.name}`,
          oldValue: usuarioObjetivo.disabled ? "deshabilitado" : "activo",
          newValue: nuevoActivo ? "activo" : "deshabilitado",
          description: `Cambio de estado de acceso en PostgreSQL para ${usuarioObjetivo.email}`,
        });
        mostrarFeedback(
          "ok",
          `Usuario ${usuarioObjetivo.name} ${nuevoActivo ? "habilitado" : "deshabilitado"} correctamente.`
        );
      } else {
        mostrarFeedback("error", res.error || "No fue posible modificar el estado del usuario.");
      }
      establecerSeleccionadoUsuarioHastaAlternar(null);
      return;
    }

    const res = alternarUsuarioSistemaDeshabilitado(usuarioObjetivo.id);
    if (res.success) {
      mostrarFeedback(
        "ok",
        `Usuario ${usuarioObjetivo.name} ${usuarioObjetivo.disabled ? "habilitado" : "deshabilitado"
        } correctamente.`
      );
    } else {
      mostrarFeedback("error", res.error || "No fue posible modificar el estado del usuario.");
    }
    establecerSeleccionadoUsuarioHastaAlternar(null);
  };

  const manejarConfirmarAnonimizacion = async () => {
    if (!usuarioParaAnonimizar) return;
    if (confirmarPalabraClaveEntrada.trim().toUpperCase() !== "CONFIRMAR") {
      mostrarFeedback("error", 'Debe escribir exactamente "CONFIRMAR" para autorizar la acción.');
      return;
    }

    const objetivo = usuarioParaAnonimizar;
    establecerUsuarioParaAnonimizar(null);
    establecerConfirmarPalabraClaveEntrada("");

    if (objetivo.id_usuario) {
      const shortId = String(objetivo.id_usuario).padStart(4, "0");
      const res = await actualizarUsuario(objetivo.id_usuario, {
        nombre_usuario: "Usuario",
        apellido_usuario: `Anonimizado #${shortId}`,
        correo_usuario: `anonimo_${shortId}@privacidad.local`,
        rut: null,
        rol_codigo: objetivo.role,
        especializacion: null,
        activo: false,
      });

      if (res.ok) {
        await cargarUsuariosDesdeBd(true);
        registrarEventoAuditoria({
          userRut: usuarioActual?.rut || "12.456.789-5",
          userName: usuarioActual?.name || "Administrador",
          userRole: "admin",
          entity: "Privacidad",
          action: "anonimizacion",
          fieldChanged: "Datos Personales",
          oldValue: `${objetivo.name} (${objetivo.rut})`,
          newValue: "[DATOS ANONIMIZADOS IRREVERSIBLEMENTE - LEY 19.628]",
          description: `Ejercicio de derecho al olvido y anonimización de titular en PostgreSQL para ID ${objetivo.id_usuario}`,
        });
        mostrarFeedback("ok", "Datos personales del usuario anonimizados conforme a la Ley 19.628.");
      } else {
        mostrarFeedback("error", res.error || "No se pudo anonimizar al usuario.");
      }
      return;
    }

    const res = anonimizarUsuario(objetivo.id);
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
        const hoyIso = new Date().toISOString().slice(0, 10);
        coincidenciaFecha =
          log.timestamp.includes(hoyIso) ||
          log.timestamp.includes("14-10-2026") ||
          log.timestamp.includes("Hoy");
      } else if (auditoriaFechaFiltrar === "7dias") {
        const hoyIso = new Date().toISOString().slice(0, 10);
        const parseLogDate = (str: string) => {
          if (str.includes("-") && str.length >= 10) {
            const parts = str.slice(0, 10).split("-");
            if (parts[0].length === 4) return new Date(str).getTime();
            if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
          }
          return new Date(str).getTime();
        };
        const logTime = parseLogDate(log.timestamp);
        const hace7Dias = Date.now() - 7 * 24 * 60 * 60 * 1000;
        coincidenciaFecha =
          log.timestamp.includes(hoyIso) ||
          log.timestamp.includes("14-10-2026") ||
          (!isNaN(logTime) && logTime >= hace7Dias);
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
          subtitle="Gestión de cuentas de usuario (Admin, Bodeguero y Técnico), bitácora de auditoría y respaldos"
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
            cargandoUsuariosBd={cargandoUsuariosBd}
            correoEntradaReferencia={correoEntradaReferencia}
            credencialesRecientes={credencialesRecientes}
            effectiveVistaModo={effectiveVistaModo}
            establecerAlternarConfirmarAbrir={establecerAlternarConfirmarAbrir}
            establecerCredencialesRecientes={establecerCredencialesRecientes}
            establecerFormularioApellido={establecerFormularioApellido}
            establecerFormularioApellidoError={establecerFormularioApellidoError}
            establecerFormularioContrasena={establecerFormularioContrasena}
            establecerFormularioContrasenaError={establecerFormularioContrasenaError}
            establecerFormularioCorreo={establecerFormularioCorreo}
            establecerFormularioCorreoError={establecerFormularioCorreoError}
            establecerFormularioEspecializacion={establecerFormularioEspecializacion}
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
            formularioApellido={formularioApellido}
            formularioApellidoError={formularioApellidoError}
            formularioContrasena={formularioContrasena}
            formularioContrasenaError={formularioContrasenaError}
            formularioCorreo={formularioCorreo}
            formularioCorreoError={formularioCorreoError}
            formularioError={formularioError}
            formularioEspecializacion={formularioEspecializacion}
            formularioNombre={formularioNombre}
            formularioNombreError={formularioNombreError}
            formularioRol={formularioRol}
            formularioRut={formularioRut}
            formularioRutError={formularioRutError}
            generarContrasenaSugerida={generarContrasenaSugerida}
            guardandoUsuario={guardandoUsuario}
            manejarAbrirCrearUsuario={manejarAbrirCrearUsuario}
            manejarAbrirEditarUsuario={manejarAbrirEditarUsuario}
            manejarAlternarUsuario={manejarAlternarUsuario}
            manejarGuardarUsuario={manejarGuardarUsuario}
            manejarRecargarUsuarios={() => cargarUsuariosDesdeBd(false)}
            mostrarFeedback={mostrarFeedback}
            nombreEntradaReferencia={nombreEntradaReferencia}
            nuevoUsuarioModalAbrir={nuevoUsuarioModalAbrir}
            rutEntradaReferencia={rutEntradaReferencia}
            seleccionadoUsuarioHastaAlternar={seleccionadoUsuarioHastaAlternar}
            usuarioBuscar={usuarioBuscar}
            usuarioEditando={usuarioEditando}
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
