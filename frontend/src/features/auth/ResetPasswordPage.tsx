import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PasswordInput } from "@/components/form/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useToast } from "@/components/overlay/Toast";

type TokenStatus = "valido" | "vencido" | "usado";

export function ResetPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  // El estado puede venir por query param: ?estado=valido | vencido | usado
  const currentStatus = (searchParams.get("estado") as TokenStatus) || "valido";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validación de checklist en vivo
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const allRequirementsMet = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet) return;

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLoading(false);
    setSuccess(true);
    toast({
      tone: "ok",
      title: "Contraseña actualizada",
      description: "Tu nueva clave ha sido guardada. Ya puedes ingresar con tus credenciales.",
    });
  };

  const switchStatus = (status: TokenStatus) => {
    setSearchParams({ estado: status });
    setPassword("");
    setConfirmPassword("");
    setSuccess(false);
  };

  return (
    <AuthLayout subtitle="Actualización segura de credenciales de acceso">
      <div className="mx-auto max-w-md">
        {/* Selector de estados demo para revisión de requerimientos */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-ink-200 bg-white p-2 text-xs shadow-xs">
          <span className="font-semibold text-ink-700 pl-2">Estado del enlace (Demo):</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => switchStatus("valido")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                currentStatus === "valido"
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              Válido
            </button>
            <button
              type="button"
              onClick={() => switchStatus("vencido")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                currentStatus === "vencido"
                  ? "bg-warn text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              Vencido
            </button>
            <button
              type="button"
              onClick={() => switchStatus("usado")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                currentStatus === "usado"
                  ? "bg-danger text-white"
                  : "text-ink-700 hover:bg-ink-100"
              }`}
            >
              Ya usado
            </button>
          </div>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-ink-200">
          {/* ─── ESTADO: ENLACE VENCIDO ─── */}
          {currentStatus === "vencido" && (
            <div className="text-center py-4 space-y-4 animate-pop">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-warn-soft text-warn border border-warn-line">
                <Clock size={32} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink-900">Enlace de recuperación vencido</h2>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                  Este enlace de restablecimiento ha caducado por superar el tiempo límite de vigencia
                  (2 horas). Por motivos de seguridad, los enlaces temporales se invalidan automáticamente.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => navigate("/recuperar-contrasena")}
                  icon={<RefreshCw size={18} aria-hidden="true" />}
                >
                  Solicitar un nuevo enlace
                </Button>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 w-full items-center justify-center text-xs font-semibold text-brand-600 hover:underline"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          )}

          {/* ─── ESTADO: ENLACE YA USADO ─── */}
          {currentStatus === "usado" && (
            <div className="text-center py-4 space-y-4 animate-pop">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-danger-soft text-danger border border-danger-line">
                <XCircle size={32} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink-900">Enlace ya utilizado</h2>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                  Este enlace de seguridad ya fue empleado anteriormente para actualizar la contraseña.
                  Cada enlace generado es de un solo uso para proteger tu cuenta de accesos duplicados.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <Button fullWidth size="lg" onClick={() => navigate("/login")}>
                  Ir al inicio de sesión
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate("/recuperar-contrasena")}
                >
                  Generar otra solicitud
                </Button>
              </div>
            </div>
          )}

          {/* ─── ESTADO: ENLACE VÁLIDO ─── */}
          {currentStatus === "valido" && !success && (
            <div>
              <div className="mb-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 mb-3"
                >
                  <ArrowLeft size={14} aria-hidden="true" /> Volver al inicio de sesión
                </Link>
                <h2 className="text-xl font-bold tracking-tight text-ink-900">
                  Crear nueva contraseña
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Ingresa tu nueva clave respetando los requisitos de seguridad corporativa.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordInput
                  label="Nueva contraseña"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 10 caracteres"
                />

                <PasswordInput
                  label="Confirmar nueva contraseña"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                />

                {/* ─── CHECKLIST EN VIVO ─── */}
                <div
                  className="rounded-2xl border border-ink-200 bg-ink-100/50 p-4 space-y-2.5"
                  aria-label="Requisitos de seguridad de la contraseña"
                >
                  <p className="text-xs font-bold text-ink-700">Requisitos de la contraseña:</p>

                  <ul className="space-y-2 text-xs">
                    {/* Regla 1: Mínimo 10 caracteres */}
                    <li className="flex items-center gap-2">
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
                          hasMinLength
                            ? "bg-ok text-white"
                            : "bg-ink-200 text-ink-500"
                        }`}
                        aria-hidden="true"
                      >
                        {hasMinLength ? <Check size={12} strokeWidth={3} /> : "•"}
                      </span>
                      <span
                        className={
                          hasMinLength
                            ? "font-semibold text-ok"
                            : "text-ink-700"
                        }
                      >
                        Mínimo 10 caracteres
                      </span>
                    </li>

                    {/* Regla 2: Una letra mayúscula */}
                    <li className="flex items-center gap-2">
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
                          hasUppercase
                            ? "bg-ok text-white"
                            : "bg-ink-200 text-ink-500"
                        }`}
                        aria-hidden="true"
                      >
                        {hasUppercase ? <Check size={12} strokeWidth={3} /> : "•"}
                      </span>
                      <span
                        className={
                          hasUppercase
                            ? "font-semibold text-ok"
                            : "text-ink-700"
                        }
                      >
                        Al menos una letra mayúscula (A-Z)
                      </span>
                    </li>

                    {/* Regla 3: Un número */}
                    <li className="flex items-center gap-2">
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
                          hasNumber
                            ? "bg-ok text-white"
                            : "bg-ink-200 text-ink-500"
                        }`}
                        aria-hidden="true"
                      >
                        {hasNumber ? <Check size={12} strokeWidth={3} /> : "•"}
                      </span>
                      <span
                        className={
                          hasNumber
                            ? "font-semibold text-ok"
                            : "text-ink-700"
                        }
                      >
                        Al menos un número (0-9)
                      </span>
                    </li>

                    {/* Coincidencia de contraseñas */}
                    {confirmPassword.length > 0 && (
                      <li className="flex items-center gap-2 border-t border-ink-200/60 pt-2">
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
                            passwordsMatch
                              ? "bg-ok text-white"
                              : "bg-danger text-white"
                          }`}
                          aria-hidden="true"
                        >
                          {passwordsMatch ? <Check size={12} strokeWidth={3} /> : "✕"}
                        </span>
                        <span
                          className={
                            passwordsMatch
                              ? "font-semibold text-ok"
                              : "font-semibold text-danger"
                          }
                        >
                          {passwordsMatch
                            ? "Las contraseñas coinciden"
                            : "Las contraseñas no coinciden"}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  loadingText="Actualizando contraseña…"
                  disabled={!allRequirementsMet}
                  icon={<ShieldCheck size={18} aria-hidden="true" />}
                >
                  Guardar nueva contraseña
                </Button>
              </form>
            </div>
          )}

          {/* Éxito al restablecer */}
          {currentStatus === "valido" && success && (
            <div className="text-center py-4 space-y-4 animate-pop">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok-soft text-ok border border-ok-line">
                <CheckCircle2 size={32} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink-900">¡Contraseña restablecida!</h2>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                  Tu nueva clave ha sido registrada correctamente en el sistema. Ya puedes iniciar
                  sesión con tu correo y nueva contraseña.
                </p>
              </div>
              <div className="pt-2">
                <Button fullWidth size="lg" onClick={() => navigate("/login")}>
                  Iniciar sesión ahora
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AuthLayout>
  );
}
