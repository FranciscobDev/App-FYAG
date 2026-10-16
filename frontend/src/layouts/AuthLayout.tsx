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
import { useAuth } from "@/context/AuthContext";
import { ROLES, ROLE_ORDER } from "@/core/roles";
import { theme } from "@/core/theme";
import { Role } from "@/core/types";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { PasswordInput } from "@/components/common/PasswordInput";
import { Toast, ToastType } from "@/components/common/Toast";

export type AuthView = "login" | "forgot" | "reset";
export type ResetLinkState = "valid" | "expired" | "used";

export interface AuthLayoutProps {
  onSuccessLogin?: (role: Role) => void;
  initialView?: AuthView;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  onSuccessLogin,
  initialView = "login",
}) => {
  const { setRole } = useAuth();
  const [view, setView] = useState<AuthView>(initialView);

  // 1. LOGIN STATE
  const [email, setEmail] = useState("admin@fyag.cl");
  const [password, setPassword] = useState("Fyag2026*");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0); // 15 min = 900s

  // 2. RECUPERAR CONTRASEÑA STATE
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  // 3. RESTABLECER CONTRASEÑA STATE
  const [resetLinkState, setResetLinkState] = useState<ResetLinkState>("valid");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // TOAST
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<ToastType>("ok");

  const showToast = (msg: string, type: ToastType = "ok") => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Timer regresivo para el bloqueo de 15 minutos (900 seg)
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFailedAttempts(0);
          showToast("El bloqueo temporal ha finalizado. Puedes volver a intentar.", "ok");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Formato MM:SS para el bloqueo
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Checklist de validación en vivo para restablecer contraseña
  const hasMinLength = newPassword.length >= 10;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isResetValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  // Manejar Login
  const handleLogin = (forcedRole?: Role) => {
    if (lockoutSeconds > 0) {
      showToast(`Acceso bloqueado temporalmente. Espera ${formatTime(lockoutSeconds)}`, "danger");
      return;
    }

    if (!forcedRole && (!email.trim() || !password.trim())) {
      showToast("Por favor, ingresa tu correo electrónico y contraseña para acceder al sistema.", "warn");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      // Simulación de credenciales correctas o rol forzado
      let targetRole: Role = forcedRole || "admin";

      if (!forcedRole) {
        const lower = email.toLowerCase().trim();
        if (lower.includes("bodega")) {
          targetRole = "warehouse";
        } else if (lower.includes("tecnico")) {
          targetRole = "technician";
        } else if (lower.includes("admin")) {
          targetRole = "admin";
        } else if (password !== "Fyag2026*" && password !== "123456") {
          // Intento fallido
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);

          if (nextAttempts >= 3) {
            setLockoutSeconds(900); // 15 minutos
            showToast("Por seguridad de tu cuenta, el acceso se ha bloqueado temporalmente por 15 minutos tras 3 intentos.", "danger");
          } else {
            showToast(`Las credenciales no coinciden. Te queda(n) ${3 - nextAttempts} intento(s) antes del bloqueo preventivo.`, "warn");
          }
          return;
        }
      }

      // Login exitoso
      setFailedAttempts(0);
      setLockoutSeconds(0);
      setRole(targetRole);

      const pathMap = {
        admin: "/admin (Escritorio Web)",
        warehouse: "/bodega (Tablet)",
        technician: "/tecnico (Celular Mobile-First)",
      };

      showToast(`Inicio exitoso. Redirigiendo a ${pathMap[targetRole]}`, "ok");
      if (onSuccessLogin) onSuccessLogin(targetRole);
    }, 600);
  };

  // Simular fallo intencional para verificar bloqueo
  const simulateFailedAttempt = () => {
    if (lockoutSeconds > 0) return;
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    if (nextAttempts >= 3) {
      setLockoutSeconds(900); // 15 min
      showToast("3 intentos fallidos simulados: Cuenta bloqueada durante 15 min.", "danger");
    } else {
      showToast(`Intento fallido ${nextAttempts} de 3 registrado.`, "warn");
    }
  };

  // Manejar Recuperar Contraseña
  const handleSendRecovery = () => {
    if (!recoveryEmail.trim()) {
      showToast("Por favor, ingresa tu correo electrónico corporativo para continuar.", "warn");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // REGLA ESTRICTA: Siempre el mismo mensaje exista o no la cuenta
      setRecoverySent(true);
    }, 700);
  };

  // Manejar Guardar Nueva Contraseña
  const handleSaveResetPassword = () => {
    if (!isResetValid) {
      showToast("Por favor cumpla con todos los requisitos del checklist", "danger");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResetSuccess(true);
      showToast("Contraseña restablecida exitosamente. Ahora puedes ingresar.", "ok");
    }, 700);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* LOGO CENTRADO CON ESTÉTICA PROFESIONAL */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={32} color={theme.colors.textInverse} />
          </View>
          <Text style={styles.brandTitle}>FYAG</Text>
          <Text style={styles.brandSubtitle}>MULTISYSTEM</Text>
          <Text style={styles.brandTagline}>
            Control Integral de Bodega, Proyectos y Faena
          </Text>
        </View>

        {/* TARJETA CENTRADA */}
        <Card variant="elevated" style={styles.card}>
          {/* ========================================================================= */}
          {/* VISTA 1: LOGIN                                                            */}
          {/* ========================================================================= */}
          {view === "login" && (
            <View>
              <Text style={styles.cardTitle}>Iniciar Sesión</Text>
              <Text style={styles.cardDesc}>
                Ingrese con sus credenciales de trabajador autorizadas:
              </Text>

              {/* AVISO DE BLOQUEO POR 15 MIN TRAS 3 INTENTOS FALLIDOS */}
              {lockoutSeconds > 0 ? (
                <View style={styles.lockoutBanner}>
                  <View style={styles.lockoutTopRow}>
                    <Ionicons name="lock-closed" size={22} color={theme.colors.dangerDark} />
                    <Text style={styles.lockoutTitle}>Cuenta Bloqueada por Seguridad</Text>
                  </View>
                  <Text style={styles.lockoutMessage}>
                    Has superado los 3 intentos fallidos permitidos. Por protección de la cuenta, el acceso se encuentra suspendido.
                  </Text>
                  <View style={styles.countdownBadge}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.dangerDark} />
                    <Text style={styles.countdownText}>
                      Podrás intentar en: {formatTime(lockoutSeconds)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setLockoutSeconds(0);
                      setFailedAttempts(0);
                      showToast("Bloqueo reiniciado para pruebas", "info");
                    }}
                    style={styles.resetLockoutBtn}
                  >
                    <Text style={styles.resetLockoutText}>[Prueba: Restablecer bloqueo]</Text>
                  </TouchableOpacity>
                </View>
              ) : failedAttempts > 0 ? (
                <View style={styles.warningBanner}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.warnDark} />
                  <Text style={styles.warningText}>
                    Intento fallido {failedAttempts} de 3. Al 3er intento la cuenta se bloqueará por 15 min.
                  </Text>
                </View>
              ) : null}

              {/* Campos */}
              <Input
                label="Correo Electrónico o RUT"
                value={email}
                onChangeText={setEmail}
                placeholder="ej: usuario@fyag.cl"
                icon="mail-outline"
                required
                disabled={lockoutSeconds > 0}
              />

              <PasswordInput
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                required
                disabled={lockoutSeconds > 0}
              />

              <View style={styles.forgotRow}>
                <TouchableOpacity onPress={() => setView("forgot")}>
                  <Text style={styles.forgotLink}>«Olvidé mi contraseña»</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={lockoutSeconds > 0 ? `Bloqueado (${formatTime(lockoutSeconds)})` : "Iniciar Sesión"}
                variant="primary"
                size="md"
                loading={loading}
                disabled={lockoutSeconds > 0}
                onPress={() => handleLogin()}
                style={{ marginTop: 6 }}
              />

              {/* Atajos Rápidos por Rol para Redirección */}
              <View style={styles.roleShortcutsBox}>
                <Text style={styles.shortcutsTitle}>Redirección directa según rol:</Text>
                <View style={styles.shortcutsRow}>
                  <TouchableOpacity
                    style={styles.shortcutChip}
                    onPress={() => {
                      setEmail("admin@fyag.cl");
                      handleLogin("admin");
                    }}
                  >
                    <Ionicons name="desktop-outline" size={14} color={theme.colors.primaryDark} />
                    <Text style={styles.shortcutText}>/admin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shortcutChip, { borderColor: theme.colors.warnBorder, backgroundColor: theme.colors.warnLight }]}
                    onPress={() => {
                      setEmail("bodega@fyag.cl");
                      handleLogin("warehouse");
                    }}
                  >
                    <Ionicons name="tablet-portrait-outline" size={14} color={theme.colors.warnDark} />
                    <Text style={[styles.shortcutText, { color: theme.colors.warnDark }]}>/bodega</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shortcutChip, { borderColor: theme.colors.primary, backgroundColor: "#1c1917" }]}
                    onPress={() => {
                      setEmail("tecnico@fyag.cl");
                      handleLogin("technician");
                    }}
                  >
                    <Ionicons name="phone-portrait-outline" size={14} color="#f59e0b" />
                    <Text style={[styles.shortcutText, { color: "#f59e0b" }]}>/tecnico</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botón de Test: Simular Fallo */}
              {lockoutSeconds === 0 && (
                <TouchableOpacity
                  onPress={simulateFailedAttempt}
                  style={styles.testFailBtn}
                >
                  <Text style={styles.testFailText}>
                    ⚡ Simular intento fallido ({failedAttempts}/3)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* VISTA 2: RECUPERAR CONTRASEÑA (REGLA: SIEMPRE EL MISMO MENSAJE)          */}
          {/* ========================================================================= */}
          {view === "forgot" && (
            <View>
              <Text style={styles.cardTitle}>Recuperar Contraseña</Text>
              <Text style={styles.cardDesc}>
                Ingrese su correo electrónico registrado para solicitar el restablecimiento:
              </Text>

              {recoverySent ? (
                /* MENSAJE ESTRICTO DE SEGURIDAD (ANTI-ENUMERACIÓN) */
                <View style={styles.safeMessageBanner}>
                  <View style={styles.safeTopRow}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.okDark} />
                    <Text style={styles.safeTitle}>Solicitud Procesada</Text>
                  </View>
                  <Text style={styles.safeDesc}>
                    Si el correo ingresado corresponde a una cuenta activa en nuestros registros, hemos enviado un enlace de recuperación.
                  </Text>
                  <Text style={styles.safeHint}>
                    Por motivos de seguridad y confidencialidad, el sistema siempre muestra esta misma confirmación exista o no la cuenta.
                  </Text>

                  {/* Acciones para continuar el test */}
                  <View style={styles.recoveryActions}>
                    <Button
                      title="Simular Clic en Enlace de Correo"
                      variant="primary"
                      size="sm"
                      icon="mail-open-outline"
                      onPress={() => {
                        setResetSuccess(false);
                        setView("reset");
                      }}
                      style={{ marginBottom: 10 }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setRecoverySent(false);
                        setView("login");
                      }}
                      style={{ alignItems: "center" }}
                    >
                      <Text style={styles.linkTextSub}>← Volver a Iniciar Sesión</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Input
                    label="Correo Corporativo"
                    value={recoveryEmail}
                    onChangeText={setRecoveryEmail}
                    placeholder="usuario@fyag.cl"
                    icon="mail-outline"
                    required
                  />

                  <Button
                    title="Enviar Enlace de Recuperación"
                    variant="primary"
                    size="md"
                    loading={loading}
                    onPress={handleSendRecovery}
                    style={{ marginTop: 8 }}
                  />

                  <TouchableOpacity
                    onPress={() => setView("login")}
                    style={styles.backToLoginBtn}
                  >
                    <Text style={styles.linkTextSub}>← Volver a Iniciar Sesión</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* VISTA 3: RESTABLECER CONTRASEÑA (CHECKLIST EN VIVO Y ESTADOS DE ENLACE)   */}
          {/* ========================================================================= */}
          {view === "reset" && (
            <View>
              <Text style={styles.cardTitle}>Restablecer Contraseña</Text>

              {/* Selector de Estado de Enlace para Pruebas (Válido, Vencido, Ya usado) */}
              <View style={styles.linkStateSelector}>
                <Text style={styles.linkStateTitle}>Estado del enlace recibido:</Text>
                <View style={styles.linkStateButtons}>
                  <TouchableOpacity
                    style={[
                      styles.stateChip,
                      resetLinkState === "valid" && styles.stateChipActive,
                    ]}
                    onPress={() => {
                      setResetLinkState("valid");
                      setResetSuccess(false);
                    }}
                  >
                    <Text style={[styles.stateChipText, resetLinkState === "valid" && styles.stateChipTextActive]}>
                      Vigente
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.stateChip,
                      resetLinkState === "expired" && styles.stateChipDanger,
                    ]}
                    onPress={() => setResetLinkState("expired")}
                  >
                    <Text style={[styles.stateChipText, resetLinkState === "expired" && styles.stateChipTextDanger]}>
                      Vencido (24h)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.stateChip,
                      resetLinkState === "used" && styles.stateChipWarn,
                    ]}
                    onPress={() => setResetLinkState("used")}
                  >
                    <Text style={[styles.stateChipText, resetLinkState === "used" && styles.stateChipTextWarn]}>
                      Ya usado
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CASO A: ENLACE VENCIDO */}
              {resetLinkState === "expired" ? (
                <View style={styles.errorStateBox}>
                  <Ionicons name="time-outline" size={40} color={theme.colors.danger} />
                  <Text style={styles.errorStateTitle}>Enlace de Recuperación Vencido</Text>
                  <Text style={styles.errorStateDesc}>
                    Este enlace ha superado las 24 horas de vigencia y ha expirado por seguridad. Debe solicitar un nuevo enlace.
                  </Text>
                  <Button
                    title="Solicitar Nuevo Enlace"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setRecoverySent(false);
                      setView("forgot");
                    }}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : resetLinkState === "used" ? (
                /* CASO B: ENLACE YA USADO */
                <View style={styles.errorStateBox}>
                  <Ionicons name="alert-circle-outline" size={40} color={theme.colors.warnDark} />
                  <Text style={[styles.errorStateTitle, { color: theme.colors.warnDark }]}>
                    Enlace Ya Utilizado
                  </Text>
                  <Text style={styles.errorStateDesc}>
                    Este enlace ya fue empleado para actualizar la contraseña anteriormente y ha quedado invalidado.
                  </Text>
                  <Button
                    title="Ir a Iniciar Sesión"
                    variant="primary"
                    size="sm"
                    onPress={() => setView("login")}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : resetSuccess ? (
                /* ÉXITO TRAS CAMBIO DE CONTRASEÑA */
                <View style={styles.successStateBox}>
                  <Ionicons name="checkmark-circle" size={44} color={theme.colors.ok} />
                  <Text style={styles.successStateTitle}>¡Contraseña Restablecida!</Text>
                  <Text style={styles.successStateDesc}>
                    Tu clave se ha actualizado correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.
                  </Text>
                  <Button
                    title="Iniciar Sesión Ahora"
                    variant="primary"
                    size="md"
                    onPress={() => {
                      setPassword(newPassword);
                      setView("login");
                    }}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : (
                /* CASO C: ENLACE VÁLIDO CON CHECKLIST EN VIVO */
                <View>
                  <Text style={styles.cardDesc}>
                    Cree una contraseña segura para su cuenta de trabajador:
                  </Text>

                  <PasswordInput
                    label="Nueva Contraseña"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Mínimo 10 caracteres..."
                    required
                  />

                  <PasswordInput
                    label="Confirmar Nueva Contraseña"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita la contraseña..."
                    required
                  />

                  {/* CHECKLIST EN VIVO */}
                  <View style={styles.checklistCard}>
                    <Text style={styles.checklistHeader}>Requisitos de Seguridad de Contraseña:</Text>

                    {/* Regla 1: Mínimo 10 caracteres */}
                    <View style={styles.checklistItem}>
                      <Ionicons
                        name={hasMinLength ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={hasMinLength ? theme.colors.ok : theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.checklistText,
                          hasMinLength && styles.checklistTextMet,
                        ]}
                      >
                        Mínimo 10 caracteres ({newPassword.length}/10)
                      </Text>
                    </View>

                    {/* Regla 2: Una letra mayúscula */}
                    <View style={styles.checklistItem}>
                      <Ionicons
                        name={hasUppercase ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={hasUppercase ? theme.colors.ok : theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.checklistText,
                          hasUppercase && styles.checklistTextMet,
                        ]}
                      >
                        Al menos una letra mayúscula (A-Z)
                      </Text>
                    </View>

                    {/* Regla 3: Un número */}
                    <View style={styles.checklistItem}>
                      <Ionicons
                        name={hasNumber ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={hasNumber ? theme.colors.ok : theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.checklistText,
                          hasNumber && styles.checklistTextMet,
                        ]}
                      >
                        Al menos un número (0-9)
                      </Text>
                    </View>

                    {/* Regla 4: Coincidencia */}
                    <View style={styles.checklistItem}>
                      <Ionicons
                        name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                        size={18}
                        color={passwordsMatch ? theme.colors.ok : theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.checklistText,
                          passwordsMatch && styles.checklistTextMet,
                        ]}
                      >
                        Ambas contraseñas coinciden
                      </Text>
                    </View>
                  </View>

                  <Button
                    title="Actualizar y Guardar Contraseña"
                    variant="primary"
                    size="md"
                    loading={loading}
                    disabled={!isResetValid}
                    onPress={handleSaveResetPassword}
                    style={{ marginTop: 14 }}
                  />

                  <TouchableOpacity
                    onPress={() => setView("login")}
                    style={styles.backToLoginBtn}
                  >
                    <Text style={styles.linkTextSub}>← Cancelar y Volver al Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* PIE DE PÁGINA */}
        <Text style={styles.legalText}>
          FYAG MULTISYSTEM v2.0 • Autenticación Segura con Bloqueo Antifuerza Bruta
        </Text>
      </ScrollView>

      {/* TOAST FLOTANTE */}
      <Toast
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    paddingVertical: 36,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...theme.shadows.md,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 1,
    color: theme.colors.text,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: theme.colors.primaryDark,
    marginTop: -2,
  },
  brandTagline: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderTopWidth: 4,
    borderTopColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  lockoutBanner: {
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dangerBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  lockoutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lockoutTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    marginLeft: 6,
  },
  lockoutMessage: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    lineHeight: 18,
    marginBottom: 8,
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    alignSelf: "flex-start",
  },
  countdownText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.dangerDark,
    marginLeft: 6,
  },
  resetLockoutBtn: {
    marginTop: 8,
  },
  resetLockoutText: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.warnLight,
    borderWidth: 1,
    borderColor: theme.colors.warnBorder,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: theme.spacing.md,
  },
  warningText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warnDark,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  forgotLink: {
    fontSize: theme.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.primaryDark,
  },
  roleShortcutsBox: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  shortcutsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  shortcutsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    flex: 1,
    marginHorizontal: 3,
    justifyContent: "center",
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.primaryDark,
    marginLeft: 4,
  },
  testFailBtn: {
    marginTop: 12,
    alignItems: "center",
  },
  testFailText: {
    fontSize: 11,
    color: theme.colors.dangerDark,
    fontWeight: "600",
  },
  safeMessageBanner: {
    backgroundColor: theme.colors.okLight,
    borderWidth: 1.5,
    borderColor: theme.colors.okBorder,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.md,
  },
  safeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  safeTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.okDark,
    marginLeft: 8,
  },
  safeDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.okDark,
    lineHeight: 20,
    marginBottom: 8,
  },
  safeHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
    marginBottom: 16,
  },
  recoveryActions: {
    marginTop: 6,
  },
  backToLoginBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  linkTextSub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: "600",
  },
  linkStateSelector: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 14,
  },
  linkStateTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  linkStateButtons: {
    flexDirection: "row",
  },
  stateChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
  },
  stateChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  stateChipDanger: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.danger,
  },
  stateChipWarn: {
    backgroundColor: theme.colors.warnLight,
    borderColor: theme.colors.warn,
  },
  stateChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  stateChipTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: "bold",
  },
  stateChipTextDanger: {
    color: theme.colors.dangerDark,
    fontWeight: "bold",
  },
  stateChipTextWarn: {
    color: theme.colors.warnDark,
    fontWeight: "bold",
  },
  errorStateBox: {
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  errorStateTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.dangerDark,
    marginTop: 8,
    textAlign: "center",
  },
  errorStateDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  successStateBox: {
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  successStateTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.okDark,
    marginTop: 8,
  },
  successStateDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  checklistCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checklistHeader: {
    fontSize: theme.fontSize.xs,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 8,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  checklistText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  checklistTextMet: {
    color: theme.colors.okDark,
    fontWeight: "600",
  },
  legalText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 20,
    textAlign: "center",
  },
});
