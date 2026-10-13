import { useState } from "react";
import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { ROLES } from "@/core/roles";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/features/auth/AuthContext";
import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";
import { OfflineBanner, SyncStatusChip } from "@/components/shared/OfflineBanner";

/** Celular: mobile-first con Topbar (SyncStatusChip + OfflineBanner) y BottomNav de 4 pestañas. */
export function TechnicianLayout() {
  const online = useOnlineStatus();
  const { user, signOut } = useAuth();
  const cfg = ROLES.technician;
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Simulación de registros locales pendientes de sincronizar
  const pendingSyncCount = online ? 0 : 2;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-canvas shadow-lg">
      {/* ─── TOPBAR CELULAR ─── */}
      <header
        data-surface="dark"
        className="sticky top-0 z-30 bg-brand-900 px-4 pt-3 pb-3 text-white shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Info del técnico */}
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] text-white/60 leading-none">Técnico en terreno</p>
            <p className="truncate text-sm font-bold mt-0.5">{user?.name ?? "Alejandro Rojas"}</p>
          </div>

          {/* SyncStatusChip + Salir */}
          <div className="flex items-center gap-2">
            <SyncStatusChip status={online ? "sincronizado" : "pendiente"} />

            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              aria-label="Cerrar sesión de técnico"
              title="Cerrar sesión"
              className="grid size-11 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* OfflineBanner integrado directamente en la topbar cuando no hay red */}
        <div className="mt-2.5">
          <OfflineBanner offline={!online} pendingCount={pendingSyncCount} />
        </div>
      </header>

      {/* ─── CONTENIDO PRINCIPAL (espacio para el BottomNav) ─── */}
      <main className="flex-1 p-4 pb-28">
        <Outlet />
      </main>

      {/* ─── BOTTOMNAV CON 4 PESTAÑAS (Proyectos, Insumos, Registrar, Alertas) ─── */}
      <nav
        aria-label="Navegación inferior del técnico"
        className="safe-bottom fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 border-t border-ink-200 bg-white/95 backdrop-blur-md shadow-2xl"
      >
        {cfg.nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={label}
            to={`${cfg.basePath}/${to}`}
            end={to === ""}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition active:scale-95 ${
                isActive ? "text-brand-600" : "text-ink-500 hover:text-ink-700"
              }`
            }
          >
            <div className="relative">
              <Icon size={24} aria-hidden="true" />
              {badge !== undefined && (
                <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-danger text-[0.625rem] font-bold text-white leading-none">
                  {badge}
                </span>
              )}
            </div>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Confirmación accesible de salida */}
      <ConfirmDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={signOut}
        tone="danger"
        title="¿Cerrar sesión de técnico?"
        description={
          online
            ? "Finalizarás tu sesión actual en este celular. Asegúrate de haber completado tus envíos pendientes."
            : "Estás sin conexión. Tus cambios locales no se perderán, pero deberás identificarte nuevamente al reconectar."
        }
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
      />
    </div>
  );
}
