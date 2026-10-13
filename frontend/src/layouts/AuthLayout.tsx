import type { ReactNode } from "react";
import { Link, Outlet } from "react-router";

interface AuthLayoutProps {
  children?: ReactNode;
  subtitle?: string;
}

export function AuthLayout({
  children,
  subtitle = "Gestión integral de inventario, obras y mantenciones",
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-linear-to-br from-brand-50 via-white to-brand-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-3xl">
        <header className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2 group transition focus-visible:ring-2 focus-visible:ring-brand-600 rounded-2xl p-1"
          >
            <div className="grid size-14 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-lg shadow-brand-600/30 group-hover:scale-105 transition-transform">
              FY
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-ink-900 block leading-tight">
                FYAG
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                Operaciones & Bodega
              </span>
            </div>
          </Link>
          <p className="mt-2 text-sm text-ink-500 max-w-md mx-auto">{subtitle}</p>
        </header>

        <main className="w-full">
          {children ?? <Outlet />}
        </main>

        <footer className="mt-10 text-center text-xs text-ink-500 space-y-2">
          <p>© {new Date().getFullYear()} FYAG Chile · Sistema de Gestión de Terreno y Bodega.</p>
          <p className="text-caption text-ink-500/80">Cumple normativa de contraste WCAG AA · Modo offline seguro</p>
        </footer>
      </div>
    </div>
  );
}
