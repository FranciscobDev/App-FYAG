import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Send } from "lucide-react";
import { Input } from "@/components/form/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    // Simulación de envío seguro
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <AuthLayout subtitle="Recuperación segura de acceso institucional">
      <div className="mx-auto max-w-md">
        <Card className="p-6 sm:p-8 shadow-xl border-ink-200">
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 mb-3"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Volver al inicio de sesión
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-ink-900">
              Recuperar contraseña
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Ingresa tu correo registrado para recibir las instrucciones de restablecimiento.
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo electrónico corporativo"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@fyag.cl"
                hint="Te enviaremos un enlace de un solo uso con vigencia de 2 horas."
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                loadingText="Procesando solicitud…"
                icon={<Send size={18} aria-hidden="true" />}
              >
                Enviar enlace de recuperación
              </Button>
            </form>
          ) : (
            /* Mensaje universal de seguridad (SIEMPRE EL MISMO EXISTA O NO LA CUENTA) */
            <div className="space-y-5 animate-pop" role="status">
              <div className="flex items-start gap-3 rounded-2xl bg-ok-soft p-4 text-ok border border-ok-line">
                <CheckCircle2 size={24} className="shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-body-sm leading-relaxed">
                  <p className="font-bold text-sm">Instrucciones enviadas</p>
                  <p className="mt-1 text-xs text-ok/90">
                    Si el correo ingresado corresponde a un usuario registrado en el sistema FYAG,
                    recibirás un enlace seguro con instrucciones para restablecer tu contraseña en los
                    próximos minutos.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-ink-100 bg-ink-100/40 p-3.5 text-xs text-ink-500 space-y-1">
                <p className="font-semibold text-ink-700">Por motivos de seguridad:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-caption">
                  <li>No confirmamos si el correo existe en nuestra base de datos.</li>
                  <li>El enlace caduca automáticamente en 2 horas.</li>
                  <li>Revisa tu carpeta de spam o correo no deseado.</li>
                </ul>
              </div>

              <div className="pt-2 space-y-2">
                <Link
                  to="/restablecer-contrasena?estado=valido"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100 text-xs transition"
                >
                  <KeyRound size={15} aria-hidden="true" />
                  Simular apertura del enlace recibido (Demo)
                </Link>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                >
                  Probar con otro correo
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AuthLayout>
  );
}
