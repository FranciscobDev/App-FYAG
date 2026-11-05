import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { Rol } from "@/nucleo/tipos";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { CampoContrasena } from "@/componentes/formularios/CampoContrasena";
import { NotificacionFlotante, TipoNotificacionFlotante } from "@/componentes/retroalimentacion/NotificacionFlotante";

export type VistaAutenticacion = "login" | "forgot" | "reset";
export type EstadoEnlaceRecuperacion = "valid" | "expired" | "used";

export interface PropiedadesPlantillaAutenticacion {
  onSuccessLogin?: (role: Rol) => void;
  initialView?: VistaAutenticacion;
}

export const PlantillaAutenticacion: React.FC<PropiedadesPlantillaAutenticacion> = ({
  initialView = "login",
}) => {
  const { iniciarSesion } = usarAutenticacion();
  const [vista, establecerVista] = useState<VistaAutenticacion>(initialView);

  // 1. LOGIN STATE
  const [correo, establecerCorreo] = useState("");
  const [contrasena, establecerContrasena] = useState("");
  const [cargando, establecerCargando] = useState(false);
  const [failedAttempts, establecerFailedAttempts] = useState(0);
  const [lockoutSegundos, establecerLockoutSegundos] = useState(0); // 15 min = 900s

  // 2. RECUPERAR CONTRASEÑA STATE
  const [recoveryCorreo, establecerRecoveryCorreo] = useState("");
  const [recoveryEnviado, establecerRecoveryEnviado] = useState(false);

  // 3. RESTABLECER CONTRASEÑA STATE
  const [restablecerEnlaceEstado, establecerRestablecerEnlaceEstado] = useState<EstadoEnlaceRecuperacion>("valid");
  const [nuevoContrasena, establecerNuevoContrasena] = useState("");
  const [confirmarContrasena, establecerConfirmarContrasena] = useState("");
  const [restablecerExito, establecerRestablecerExito] = useState(false);

  // TOAST
  const [avisoVisible, establecerAvisoVisible] = useState(false);
  const [avisoMensaje, establecerAvisoMensaje] = useState("");
  const [avisoTipo, establecerAvisoTipo] = useState<TipoNotificacionFlotante>("ok");

  const mostrarAviso = (msg: string, type: TipoNotificacionFlotante = "ok") => {
    establecerAvisoMensaje(msg);
    establecerAvisoTipo(type);
    establecerAvisoVisible(true);
  };

  // Timer regresivo para el bloqueo de 15 minutos (900 seg)
  useEffect(() => {
    if (lockoutSegundos <= 0) return;

    const temporizador = setInterval(() => {
      establecerLockoutSegundos((prev) => {
        if (prev <= 1) {
          clearInterval(temporizador);
          establecerFailedAttempts(0);
          mostrarAviso("El bloqueo temporal ha finalizado. Puedes volver a intentar.", "ok");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(temporizador);
  }, [lockoutSegundos]);

  // Formato MM:SS para el bloqueo
  const formatearTiempo = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Checklist de validación en vivo para restablecer contraseña
  const tieneMinimoLength = nuevoContrasena.length >= 10;
  const tieneUppercase = /[A-Z]/.test(nuevoContrasena);
  const tieneNumero = /[0-9]/.test(nuevoContrasena);
  const passwordsCoincidencia = nuevoContrasena.length > 0 && nuevoContrasena === confirmarContrasena;
  const esRestablecerValido = tieneMinimoLength && tieneUppercase && tieneNumero && passwordsCoincidencia;

  // Manejar Login (con API real)
  const manejarInicioSesion = async () => {
    if (lockoutSegundos > 0) {
      mostrarAviso(`Acceso bloqueado temporalmente. Espera ${formatearTiempo(lockoutSegundos)}`, "danger");
      return;
    }

    if (!correo.trim() || !contrasena) {
      mostrarAviso("Por favor, ingresa tu correo electrónico y contraseña para acceder al sistema.", "warn");
      return;
    }

    establecerCargando(true);
    try {
      const error = await iniciarSesion(correo.trim(), contrasena);

      if (error) {
        const siguienteAttempts = failedAttempts + 1;
        establecerFailedAttempts(siguienteAttempts);

        if (siguienteAttempts >= 3) {
          establecerLockoutSegundos(900); // 15 minutos
          mostrarAviso("Por seguridad de tu cuenta, el acceso se ha bloqueado temporalmente por 15 minutos tras 3 intentos.", "danger");
        } else {
          mostrarAviso(`${error}. Te queda(n) ${3 - siguienteAttempts} intento(s) antes del bloqueo.`, "warn");
        }
        return;
      }

      // Login exitoso: NavegadorRaiz cambia de pantalla automáticamente
      establecerFailedAttempts(0);
      establecerLockoutSegundos(0);
    } catch {
      mostrarAviso("Ocurrió un error inesperado al iniciar sesión.", "danger");
    } finally {
      establecerCargando(false);
    }
  };

  // Manejar Recuperar Contraseña
  const manejarEnviarRecovery = () => {
    if (!recoveryCorreo.trim()) {
      mostrarAviso("Por favor, ingresa tu correo electrónico corporativo para continuar.", "warn");
      return;
    }

    establecerCargando(true);
    setTimeout(() => {
      establecerCargando(false);
      // REGLA ESTRICTA: Siempre el mismo mensaje exista o no la cuenta
      establecerRecoveryEnviado(true);
    }, 700);
  };

  // Manejar Guardar Nueva Contraseña
  const manejarGuardarRestablecerContrasena = () => {
    if (!esRestablecerValido) {
      mostrarAviso("Por favor cumpla con todos los requisitos del checklist", "danger");
      return;
    }

    establecerCargando(true);
    setTimeout(() => {
      establecerCargando(false);
      establecerRestablecerExito(true);
      mostrarAviso("Contraseña restablecida exitosamente. Ahora puedes ingresar.", "ok");
    }, 700);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={estilos.contenedor}
    >
      <ScrollView
        contentContainerStyle={estilos.scrollContenido}
        keyboardShouldPersistTaps="handled"
      >
        {/* LOGO CENTRADO */}
        <View style={estilos.marcaContenedor}>
          <View style={estilos.logoCirculo}>
            <Ionicons name="flash" size={32} color={tema.colors.textInverse} />
          </View>
          <Text style={estilos.marcaTitulo}>FYAG</Text>
          <Text style={estilos.marcaSubtitulo}>MULTISYSTEM</Text>
          <Text style={estilos.marcaTagline}>
            Control Integral de Bodega, Proyectos y Faena
          </Text>
        </View>

        {/* TARJETA CENTRADA */}
        <Tarjeta variant="elevated" style={estilos.tarjeta}>
          {/* VISTA 1: LOGIN */}
          {vista === "login" && (
            <View>
              <Text style={estilos.tarjetaTitulo}>Iniciar Sesión</Text>
              <Text style={estilos.tarjetaDescripcion}>
                Ingrese con sus credenciales de trabajador autorizadas:
              </Text>

              {/* AVISO DE BLOQUEO POR 15 MIN TRAS 3 INTENTOS FALLIDOS */}
              {lockoutSegundos > 0 ? (
                <View style={estilos.lockoutBanner}>
                  <View style={estilos.lockoutSuperiorFila}>
                    <Ionicons name="lock-closed" size={22} color={tema.colors.dangerDark} />
                    <Text style={estilos.lockoutTitulo}>Cuenta Bloqueada por Seguridad</Text>
                  </View>
                  <Text style={estilos.lockoutMensaje}>
                    Has superado los 3 intentos fallidos permitidos. Por protección de la cuenta, el acceso se encuentra suspendido.
                  </Text>
                  <View style={estilos.countdownInsignia}>
                    <Ionicons name="time-outline" size={16} color={tema.colors.dangerDark} />
                    <Text style={estilos.countdownTexto}>
                      Podrás intentar en: {formatearTiempo(lockoutSegundos)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      establecerLockoutSegundos(0);
                      establecerFailedAttempts(0);
                      mostrarAviso("Bloqueo reiniciado para pruebas", "info");
                    }}
                    style={estilos.restablecerLockoutBoton}
                  >
                    <Text style={estilos.restablecerLockoutTexto}>[Prueba: Restablecer bloqueo]</Text>
                  </TouchableOpacity>
                </View>
              ) : failedAttempts > 0 ? (
                <View style={estilos.advertenciaBanner}>
                  <Ionicons name="alert-circle" size={18} color={tema.colors.warnDark} />
                  <Text style={estilos.advertenciaTexto}>
                    Intento fallido {failedAttempts} de 3. Al 3er intento la cuenta se bloqueará por 15 min.
                  </Text>
                </View>
              ) : null}

              {/* Campos */}
              <CampoTexto
                label="Correo Electrónico"
                value={correo}
                onChangeText={establecerCorreo}
                placeholder="ej: usuario@fyag.cl"
                icon="mail-outline"
                required
                disabled={lockoutSegundos > 0}
              />

              <CampoContrasena
                label="Contraseña"
                value={contrasena}
                onChangeText={establecerContrasena}
                placeholder="••••••••"
                required
                disabled={lockoutSegundos > 0}
              />

              <View style={estilos.forgotFila}>
                <TouchableOpacity onPress={() => establecerVista("forgot")}>
                  <Text style={estilos.forgotEnlace}>«Olvidé mi contraseña»</Text>
                </TouchableOpacity>
              </View>

              <Boton
                title={lockoutSegundos > 0 ? `Bloqueado (${formatearTiempo(lockoutSegundos)})` : "Iniciar Sesión"}
                variant="primary"
                size="md"
                loading={cargando}
                disabled={lockoutSegundos > 0}
                onPress={() => manejarInicioSesion()}
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          {/* VISTA 2: RECUPERAR CONTRASEÑA */}
          {vista === "forgot" && (
            <View>
              <Text style={estilos.tarjetaTitulo}>Recuperar Contraseña</Text>
              <Text style={estilos.tarjetaDescripcion}>
                Ingrese su correo electrónico registrado para solicitar el restablecimiento:
              </Text>

              {recoveryEnviado ? (
                /* MENSAJE ESTRICTO DE SEGURIDAD (ANTI-ENUMERACIÓN) */
                <View style={estilos.safeMensajeBanner}>
                  <View style={estilos.safeSuperiorFila}>
                    <Ionicons name="checkmark-circle" size={24} color={tema.colors.okDark} />
                    <Text style={estilos.safeTitulo}>Solicitud Procesada</Text>
                  </View>
                  <Text style={estilos.safeDescripcion}>
                    Si el correo ingresado corresponde a una cuenta activa en nuestros registros, hemos enviado un enlace de recuperación.
                  </Text>
                  <Text style={estilos.safeHint}>
                    Por motivos de seguridad y confidencialidad, el sistema siempre muestra esta misma confirmación exista o no la cuenta.
                  </Text>

                  <View style={estilos.recoveryAcciones}>
                    <Boton
                      title="Simular Clic en Enlace de Correo"
                      variant="primary"
                      size="sm"
                      icon="mail-open-outline"
                      onPress={() => {
                        establecerRestablecerExito(false);
                        establecerVista("reset");
                      }}
                      style={{ marginBottom: 10 }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        establecerRecoveryEnviado(false);
                        establecerVista("login");
                      }}
                      style={{ alignItems: "center" }}
                    >
                      <Text style={estilos.enlaceTextoSub}>← Volver a Iniciar Sesión</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <CampoTexto
                    label="Correo Corporativo"
                    value={recoveryCorreo}
                    onChangeText={establecerRecoveryCorreo}
                    placeholder="usuario@fyag.cl"
                    icon="mail-outline"
                    required
                  />

                  <Boton
                    title="Enviar Enlace de Recuperación"
                    variant="primary"
                    size="md"
                    loading={cargando}
                    onPress={manejarEnviarRecovery}
                    style={{ marginTop: 8 }}
                  />

                  <TouchableOpacity
                    onPress={() => establecerVista("login")}
                    style={estilos.backHastaInicioSesionBoton}
                  >
                    <Text style={estilos.enlaceTextoSub}>← Volver a Iniciar Sesión</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* VISTA 3: RESTABLECER CONTRASEÑA */}
          {vista === "reset" && (
            <View>
              <Text style={estilos.tarjetaTitulo}>Restablecer Contraseña</Text>

              {/* Selector de Estado de Enlace para Pruebas (Válido, Vencido, Ya usado) */}
              <View style={estilos.enlaceEstadoSelector}>
                <Text style={estilos.enlaceEstadoTitulo}>Estado del enlace recibido:</Text>
                <View style={estilos.enlaceEstadoBotones}>
                  <TouchableOpacity
                    style={[
                      estilos.estadoChip,
                      restablecerEnlaceEstado === "valid" && estilos.estadoChipActivo,
                    ]}
                    onPress={() => {
                      establecerRestablecerEnlaceEstado("valid");
                      establecerRestablecerExito(false);
                    }}
                  >
                    <Text style={[estilos.estadoChipTexto, restablecerEnlaceEstado === "valid" && estilos.estadoChipTextoActivo]}>
                      Vigente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      estilos.estadoChip,
                      restablecerEnlaceEstado === "expired" && estilos.estadoChipPeligro,
                    ]}
                    onPress={() => establecerRestablecerEnlaceEstado("expired")}
                  >
                    <Text style={[estilos.estadoChipTexto, restablecerEnlaceEstado === "expired" && estilos.estadoChipTextoPeligro]}>
                      Vencido (24h)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      estilos.estadoChip,
                      restablecerEnlaceEstado === "used" && estilos.estadoChipAdvertencia,
                    ]}
                    onPress={() => establecerRestablecerEnlaceEstado("used")}
                  >
                    <Text style={[estilos.estadoChipTexto, restablecerEnlaceEstado === "used" && estilos.estadoChipTextoAdvertencia]}>
                      Ya usado
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CASO A: ENLACE VENCIDO */}
              {restablecerEnlaceEstado === "expired" ? (
                <View style={estilos.errorEstadoCaja}>
                  <Ionicons name="time-outline" size={40} color={tema.colors.danger} />
                  <Text style={estilos.errorEstadoTitulo}>Enlace de Recuperación Vencido</Text>
                  <Text style={estilos.errorEstadoDescripcion}>
                    Este enlace ha superado las 24 horas de vigencia y ha expirado por seguridad. Debe solicitar un nuevo enlace.
                  </Text>
                  <Boton
                    title="Solicitar Nuevo Enlace"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      establecerRecoveryEnviado(false);
                      establecerVista("forgot");
                    }}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : restablecerEnlaceEstado === "used" ? (
                /* CASO B: ENLACE YA USADO */
                <View style={estilos.errorEstadoCaja}>
                  <Ionicons name="alert-circle-outline" size={40} color={tema.colors.warnDark} />
                  <Text style={[estilos.errorEstadoTitulo, { color: tema.colors.warnDark }]}>
                    Enlace Ya Utilizado
                  </Text>
                  <Text style={estilos.errorEstadoDescripcion}>
                    Este enlace ya fue empleado para actualizar la contraseña anteriormente y ha quedado invalidado.
                  </Text>
                  <Boton
                    title="Ir a Iniciar Sesión"
                    variant="primary"
                    size="sm"
                    onPress={() => establecerVista("login")}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : restablecerExito ? (
                /* ÉXITO TRAS CAMBIO DE CONTRASEÑA */
                <View style={estilos.exitoEstadoCaja}>
                  <Ionicons name="checkmark-circle" size={44} color={tema.colors.ok} />
                  <Text style={estilos.exitoEstadoTitulo}>¡Contraseña Restablecida!</Text>
                  <Text style={estilos.exitoEstadoDescripcion}>
                    Tu clave se ha actualizado correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.
                  </Text>
                  <Boton
                    title="Iniciar Sesión Ahora"
                    variant="primary"
                    size="md"
                    onPress={() => {
                      establecerContrasena("");
                      establecerVista("login");
                    }}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : (
                /* CASO C: ENLACE VÁLIDO CON CHECKLIST EN VIVO */
                <View>
                  <Text style={estilos.tarjetaDescripcion}>
                    Cree una contraseña segura para su cuenta de trabajador:
                  </Text>

                  <CampoContrasena
                    label="Nueva Contraseña"
                    value={nuevoContrasena}
                    onChangeText={establecerNuevoContrasena}
                    placeholder="Mínimo 10 caracteres..."
                    required
                  />

                  <CampoContrasena
                    label="Confirmar Nueva Contraseña"
                    value={confirmarContrasena}
                    onChangeText={establecerConfirmarContrasena}
                    placeholder="Repita la contraseña..."
                    required
                  />

                  {/* CHECKLIST EN VIVO */}
                  <View style={estilos.listaChequeoTarjeta}>
                    <Text style={estilos.listaChequeoEncabezado}>Requisitos de Seguridad de Contraseña:</Text>

                    <View style={estilos.listaChequeoElemento}>
                      <Ionicons
                        name={tieneMinimoLength ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={tieneMinimoLength ? tema.colors.ok : tema.colors.textMuted}
                      />
                      <Text style={[estilos.listaChequeoTexto, tieneMinimoLength && estilos.listaChequeoTextoMet]}>
                        Mínimo 10 caracteres ({nuevoContrasena.length}/10)
                      </Text>
                    </View>

                    <View style={estilos.listaChequeoElemento}>
                      <Ionicons
                        name={tieneUppercase ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={tieneUppercase ? tema.colors.ok : tema.colors.textMuted}
                      />
                      <Text style={[estilos.listaChequeoTexto, tieneUppercase && estilos.listaChequeoTextoMet]}>
                        Al menos una letra mayúscula (A-Z)
                      </Text>
                    </View>

                    <View style={estilos.listaChequeoElemento}>
                      <Ionicons
                        name={tieneNumero ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={tieneNumero ? tema.colors.ok : tema.colors.textMuted}
                      />
                      <Text style={[estilos.listaChequeoTexto, tieneNumero && estilos.listaChequeoTextoMet]}>
                        Al menos un número (0-9)
                      </Text>
                    </View>

                    <View style={estilos.listaChequeoElemento}>
                      <Ionicons
                        name={passwordsCoincidencia ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={passwordsCoincidencia ? tema.colors.ok : tema.colors.textMuted}
                      />
                      <Text style={[estilos.listaChequeoTexto, passwordsCoincidencia && estilos.listaChequeoTextoMet]}>
                        Ambas contraseñas coinciden
                      </Text>
                    </View>
                  </View>

                  <Boton
                    title="Actualizar y Guardar Contraseña"
                    variant="primary"
                    size="md"
                    loading={cargando}
                    disabled={!esRestablecerValido}
                    onPress={manejarGuardarRestablecerContrasena}
                    style={{ marginTop: 14 }}
                  />

                  <TouchableOpacity
                    onPress={() => establecerVista("login")}
                    style={estilos.backHastaInicioSesionBoton}
                  >
                    <Text style={estilos.enlaceTextoSub}>← Cancelar y Volver al Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Tarjeta>

        {/* PIE DE PÁGINA */}
        <Text style={estilos.legalTexto}>
          FYAG MULTISYSTEM v2.0 • Autenticación Segura con Bloqueo Antifuerza Bruta
        </Text>
      </ScrollView>

      {/* TOAST FLOTANTE */}
      <NotificacionFlotante
        visible={avisoVisible}
        message={avisoMensaje}
        type={avisoTipo}
        onDismiss={() => establecerAvisoVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollContenido: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: tema.spacing.lg,
    paddingVertical: 36,
  },
  marcaContenedor: {
    alignItems: "center",
    marginBottom: tema.spacing.lg,
  },
  logoCirculo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...tema.shadows.md,
  },
  marcaTitulo: {
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 1,
    color: tema.colors.text,
  },
  marcaSubtitulo: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: tema.colors.primaryDark,
    marginTop: -2,
  },
  marcaTagline: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  tarjeta: {
    width: "100%",
    maxWidth: 440,
    padding: tema.spacing.xl,
    borderRadius: tema.radius.xl,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderTopWidth: 4,
    borderTopColor: tema.colors.primary,
    ...tema.shadows.md,
  },
  tarjetaTitulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 4,
  },
  tarjetaDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    lineHeight: 18,
    marginBottom: tema.spacing.md,
  },
  lockoutBanner: {
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1.5,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
  },
  lockoutSuperiorFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lockoutTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
    marginLeft: 6,
  },
  lockoutMensaje: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    lineHeight: 18,
    marginBottom: 8,
  },
  countdownInsignia: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    alignSelf: "flex-start",
  },
  countdownTexto: {
    fontSize: 12,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.dangerDark,
    marginLeft: 6,
  },
  restablecerLockoutBoton: {
    marginTop: 8,
  },
  restablecerLockoutTexto: {
    fontSize: 11,
    color: tema.colors.primaryDark,
    fontWeight: "600",
  },
  advertenciaBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: tema.spacing.md,
  },
  advertenciaTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.warnDark,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  forgotFila: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  forgotEnlace: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.primaryDark,
  },
  safeMensajeBanner: {
    backgroundColor: tema.colors.okLight,
    borderWidth: 1.5,
    borderColor: tema.colors.okBorder,
    borderRadius: tema.radius.lg,
    padding: tema.spacing.lg,
    marginVertical: tema.spacing.md,
  },
  safeSuperiorFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  safeTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.okDark,
    marginLeft: 8,
  },
  safeDescripcion: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.okDark,
    lineHeight: 20,
    marginBottom: 8,
  },
  safeHint: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
    marginBottom: 16,
  },
  recoveryAcciones: {
    marginTop: 6,
  },
  backHastaInicioSesionBoton: {
    marginTop: 14,
    alignItems: "center",
  },
  enlaceTextoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  enlaceEstadoSelector: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 14,
  },
  enlaceEstadoTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 6,
  },
  enlaceEstadoBotones: {
    flexDirection: "row",
  },
  estadoChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginRight: 6,
  },
  estadoChipActivo: {
    backgroundColor: tema.colors.primaryLight,
    borderColor: tema.colors.primary,
  },
  estadoChipPeligro: {
    backgroundColor: tema.colors.dangerLight,
    borderColor: tema.colors.danger,
  },
  estadoChipAdvertencia: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warn,
  },
  estadoChipTexto: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  estadoChipTextoActivo: {
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },
  estadoChipTextoPeligro: {
    color: tema.colors.dangerDark,
    fontWeight: "bold",
  },
  estadoChipTextoAdvertencia: {
    color: tema.colors.warnDark,
    fontWeight: "bold",
  },
  errorEstadoCaja: {
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  errorEstadoTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.dangerDark,
    marginTop: 8,
    textAlign: "center",
  },
  errorEstadoDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  exitoEstadoCaja: {
    alignItems: "center",
    padding: tema.spacing.lg,
  },
  exitoEstadoTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.okDark,
    marginTop: 8,
  },
  exitoEstadoDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  listaChequeoTarjeta: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  listaChequeoEncabezado: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 8,
  },
  listaChequeoElemento: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  listaChequeoTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginLeft: 8,
  },
  listaChequeoTextoMet: {
    color: tema.colors.okDark,
    fontWeight: "600",
  },
  legalTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 20,
    textAlign: "center",
  },
});