import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ROLE_ORDER, ROLES } from "@/core/roles";
import type { Role } from "@/core/types";
import { useAuth } from "./AuthContext";
import { AuthLayout } from "@/layouts/AuthLayout";

const accent: Record<Role, string> = {
  admin: "from-brand-600 to-brand-900",
  warehouse: "from-sky-500 to-brand-700",
  technician: "from-indigo-500 to-brand-900",
};

export function RoleSelectPage() {
  const { signInAs } = useAuth();
  const navigate = useNavigate();

  const enter = (role: Role) => {
    signInAs(role);
    navigate(ROLES[role].basePath);
  };

  return (
    <AuthLayout subtitle="Selecciona tu perfil de acceso para ingresar al entorno adaptado a tu dispositivo.">
      <div className="grid gap-4 md:grid-cols-3">
        {ROLE_ORDER.map((role) => {
          const cfg = ROLES[role];
          const Icon = cfg.icon;
          return (
            <button
              key={role}
              type="button"
              onClick={() => enter(role)}
              className="group flex flex-col rounded-3xl border border-ink-200 bg-white p-6 text-left shadow-(--shadow-card) transition hover:-translate-y-1 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-brand-200"
            >
              <div
                className={`mb-5 grid size-12 place-items-center rounded-2xl bg-linear-to-br text-white shadow-md ${accent[role]}`}
              >
                <Icon size={24} aria-hidden="true" />
              </div>
              <p className="text-lg font-bold text-ink-900">{cfg.label}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                {cfg.device}
              </p>
              <p className="mt-2 flex-1 text-sm text-ink-500 leading-relaxed">{cfg.deviceHint}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                Ingresar{" "}
                <ArrowRight size={16} className="transition group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-center">
        <Link
          to="/sistema-diseno"
          className="inline-flex min-h-11 items-center text-body-sm font-semibold text-brand-600 underline-offset-4 hover:underline"
        >
          Ver catálogo y sistema de diseño
        </Link>
      </p>
    </AuthLayout>
  );
}
