import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Clock, KeyRound, Lock, ShieldAlert, Sparkles, UserCheck } from "lucide-react";
import { Input, PasswordInput } from "@/components/form/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAuth } from "./AuthContext";
import { ROLES } from "@/core/roles";
import { USERS } from "@/data/mock";
import type { Role } from "@/core/types";

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 3;

const STORAGE_ATTEMPTS_KEY = "fyag.login.attempts";
const STORAGE_LOCK_KEY = "fyag.login.lockedUntil";

export function LoginPage() {
  const { signInAs } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("javier.munoz@fyag.cl");
  const [password, setPassword] = useState("Fyag2026!Demo");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de bloqueo por 3 intentos
  const [attempts, setAttempts] = useState<number>(() => {
    return parseInt(localStorage.getItem(STORAGE_ATTEMPTS_KEY) || "0", 10);
  });

  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_LOCK_KEY);
    if (!saved) return null;
    const ts = parseInt(saved, 10);
    return ts > Date.now() ? ts : null;
  });

  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  // Verificar aviso de sesión expirada
  useEffect(() => {
    if (sessionStorage.getItem("fyag.session_expired") === "true") {
      setSessionExpiredNotice(true);
      sessionStorage.removeItem("fyag.session_expired");
    }
  }, []);

  // Manejo de la cuenta regresiva de 15 minutos
  useEffect(() => {
    if (!lockedUntil) {
      setCountdownRemaining(0);
      return;
    }

    const checkLock = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdownRemaining(remaining);

      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        localStorage.removeItem(STORAGE_LOCK_KEY);
        localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
        setErrorMsg(null);
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && countdownRemaining > 0;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setErrorMsg(null);
    setLoading(true);

    // Simulación de validación
    await new Promise((resolve) => setTimeout(resolve, 750));

    // Buscar si corresponde a algún usuario conocido
    const normalizedEmail = email.trim().toLowerCase();
    const userRole = (Object.keys(USERS) as Role[]).find(
      (role) => USERS[role].email.toLowerCase() === normalizedEmail,
    );

    // Contraseña válida en demo: "Fyag2026!Demo" o cualquier contraseña >= 10 con mayúscula y número
    const isPasswordValid =
      password === "Fyag2026!Demo" ||
      (password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password));

    if (userRole && isPasswordValid) {
      // Login exitoso
      setAttempts(0);
      localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
      localStorage.removeItem(STORAGE_LOCK_KEY);
      signInAs(userRole);
      navigate(ROLES[userRole].basePath);
    } else {
      // Intento fallido
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, newAttempts.toString());

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockTime = Date.now() + LOCK_DURATION_MS;
        setLockedUntil(lockTime);
        localStorage.setItem(STORAGE_LOCK_KEY, lockTime.toString());
        setErrorMsg("Cuenta temporalmente bloqueada por 3 intentos fallidos consecutivos.");
      } else {
        const remainingAttempts = MAX_ATTEMPTS - newAttempts;
        setErrorMsg(
          `Correo o contraseña incorrectos. Te queda ${remainingAttempts} intento${
            remainingAttempts === 1 ? "" : "s"
          } antes del bloqueo temporal por 15 minutos.`,
        );
      }
      setLoading(false);
    }
  };

  // Relleno rápido con perfiles demo
  const selectQuickUser = (role: Role) => {
    const u = USERS[role];
    setEmail(u.email);
    setPassword("Fyag2026!Demo");
    setErrorMsg(null);
  };

  return (
    <AuthLayout subtitle="Ingresa con tu correo corporativo y contraseña autorizada">
      <div className="mx-auto max-w-md">
        <Card className="p-6 sm:p-8 shadow-xl border-ink-200">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-ink-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-ink-500">
              Accede a la plataforma de gestión operativa FYAG
            </p>
          </div>

          {/* Aviso de sesión expirada */}
          {sessionExpiredNotice && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-warn-line bg-warn-soft p-3 text-xs text-warn"
            >
              <Clock size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Sesión cerrada por inactividad</p>
                <p>Tu sesión anterior expiró tras 30 minutos sin uso. Por favor vuelve a identificarte.</p>
              </div>
            </div>
          )}

          {/* Banner de BLOQUEO TEMPORAL tras 3 intentos (15 min con cuenta regresiva) */}
          {isLocked && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border-2 border-danger bg-danger-soft p-4 text-danger animate-pop"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert size={24} className="shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold">Acceso temporalmente bloqueado</h3>
                  <p className="text-xs mt-1 text-danger/90">
                    Se han superado los 3 intentos fallidos permitidos. Por motivos de seguridad bancaria
                    e institucional, el acceso ha sido suspendido durante 15 minutos.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 font-mono text-sm font-bold text-danger shadow-xs">
                    <Clock size={16} className="animate-spin" aria-hidden="true" />
                    <span>Tiempo restante: {formatCountdown(countdownRemaining)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error de intento fallido (intentos 1 y 2) */}
          {!isLocked && errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft p-3 text-xs text-danger"
            >
              <AlertCircle size={17} className="shrink-0 mt-0.5" aria-hidden="true" />
              <p className="font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              disabled={isLocked || loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@fyag.cl"
              hint="Usa tu correo corporativo asignado"
            />

            <div>
              <PasswordInput
                label="Contraseña"
                required
                disabled={isLocked || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
              <div className="mt-1.5 flex justify-end">
                <Link
                  to="/recuperar-contrasena"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-600 rounded-sm"
                >
                  Olvidé mi contraseña
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              loadingText="Verificando credenciales…"
              disabled={isLocked}
              icon={<Lock size={18} aria-hidden="true" />}
            >
              {isLocked ? `Bloqueado (${formatCountdown(countdownRemaining)})` : "Ingresar a FYAG"}
            </Button>
          </form>

          {/* Accesos rápidos con cuentas demo de prueba */}
          <div className="mt-6 border-t border-ink-100 pt-5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
              <Sparkles size={14} className="text-brand-600" aria-hidden="true" />
              Perfiles demo (1 clic para rellenar)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => selectQuickUser("admin")}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-ink-200 text-center hover:bg-brand-50 hover:border-brand-200 transition text-xs"
              >
                <span className="font-bold text-ink-900">Admin</span>
                <span className="text-[0.625rem] text-ink-500">Javier M.</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => selectQuickUser("warehouse")}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-ink-200 text-center hover:bg-brand-50 hover:border-brand-200 transition text-xs"
              >
                <span className="font-bold text-ink-900">Bodega</span>
                <span className="text-[0.625rem] text-ink-500">Camila V.</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => selectQuickUser("technician")}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-ink-200 text-center hover:bg-brand-50 hover:border-brand-200 transition text-xs"
              >
                <span className="font-bold text-ink-900">Técnico</span>
                <span className="text-[0.625rem] text-ink-500">Alejandro R.</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Acceso a selección de roles visual directa */}
        <p className="mt-5 text-center text-xs text-ink-500">
          ¿Prefieres entrar por selector visual de dispositivos?{" "}
          <Link
            to="/selector-roles"
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            Ir a selector de perfiles
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
