import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckSquare,
  LogOut,
  Package,
  ScanLine,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { ROLES } from "@/core/roles";
import { useAuth } from "@/features/auth/AuthContext";
import { QrScannerModal } from "@/components/shared/QrScannerModal";
import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";
import { useToast } from "@/components/overlay/Toast";
import { PRODUCTS } from "@/data/mock";

/** Tablet: sidebar compacto con íconos grandes, FAB de escáner y barra de atajos rápidos. */
export function WarehouseLayout() {
  const { user, signOut } = useAuth();
  const cfg = ROLES.warehouse;
  const toast = useToast();
  const navigate = useNavigate();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleScanDetect = (code: string) => {
    const found = PRODUCTS.find(
      (p) => p.sku.toLowerCase() === code.toLowerCase() || code.includes(p.sku),
    );
    if (found) {
      toast({
        tone: "ok",
        title: `Producto detectado: ${found.name}`,
        description: `SKU: ${found.sku} · Stock actual: ${found.stock} ${found.unit} · Ubicación: ${found.location}`,
      });
    } else {
      toast({
        tone: "info",
        title: "Código escaneado",
        description: `Lectura: ${code} (No registrado en catálogo demo)`,
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ─── SIDEBAR COMPACTO CON ÍCONOS GRANDES (≥ 56px) ─── */}
      <aside
        data-surface="dark"
        className="sticky top-0 flex h-screen w-24 shrink-0 flex-col items-center justify-between bg-brand-900 py-4 text-white"
      >
        <div className="flex w-full flex-col items-center gap-4">
          {/* Logo Bodega */}
          <div className="grid size-12 place-items-center rounded-2xl bg-white/15 font-black text-lg shadow-inner">
            FY
          </div>

          {/* Navegación vertical para tablet */}
          <nav
            className="flex w-full flex-col gap-2 px-2"
            aria-label="Navegación principal de bodega"
          >
            {cfg.nav.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={label}
                to={`${cfg.basePath}/${to}`}
                end={to === ""}
                title={label}
                className={({ isActive }) =>
                  `relative flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] font-bold transition active:scale-95 ${
                    isActive
                      ? "bg-white text-brand-900 shadow-md"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={26} aria-hidden="true" />
                <span className="truncate max-w-[4.5rem] leading-none">{label}</span>
                {badge !== undefined && (
                  <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-warn text-[0.625rem] font-black text-white">
                    {badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Cierre de sesión táctil accesible */}
        <div className="w-full px-2">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            aria-label="Cerrar sesión de bodeguero"
            title="Cerrar sesión"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <LogOut size={22} aria-hidden="true" />
            <span className="text-[0.625rem] font-semibold">Salir</span>
          </button>
        </div>
      </aside>

      {/* ─── ÁREA DE CONTENIDO TABLET ─── */}
      <div className="flex min-w-0 flex-1 flex-col pb-24">
        {/* Cabecera superior con información y atajos rápidos */}
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 px-6 py-3 backdrop-blur-md shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-ok" aria-hidden="true" />
                <h1 className="text-sm font-bold text-ink-900">Bodega Central · Maipú</h1>
              </div>
              <p className="text-xs text-ink-500">
                Operador: <span className="font-semibold text-ink-700">{user?.name}</span> ({user?.rut})
              </p>
            </div>

            {/* Atajos a Egreso, Recepción y Conteo */}
            <div className="flex items-center gap-2" role="group" aria-label="Atajos rápidos de operación">
              <button
                type="button"
                onClick={() => navigate("/bodega/egreso")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-900 transition hover:bg-ink-100 active:scale-95"
              >
                <ArrowUpFromLine size={16} className="text-brand-600" aria-hidden="true" />
                Egreso
              </button>
              <button
                type="button"
                onClick={() => navigate("/bodega/recepcion")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-900 transition hover:bg-ink-100 active:scale-95"
              >
                <ArrowDownToLine size={16} className="text-brand-600" aria-hidden="true" />
                Recepción
              </button>
              <button
                type="button"
                onClick={() => navigate("/bodega/conteo")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-900 transition hover:bg-ink-100 active:scale-95"
              >
                <CheckSquare size={16} className="text-brand-600" aria-hidden="true" />
                Conteo
              </button>
            </div>
          </div>
        </header>

        {/* Contenido de la vista */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      {/* ─── BOTÓN FLOTANTE DE ESCÁNER (FAB) SIEMPRE VISIBLE ─── */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label="Abrir escáner de códigos QR y barras"
          title="Escanear producto (QR / Barras)"
          className="group flex min-h-16 items-center gap-3 rounded-full bg-brand-600 px-6 py-3 font-bold text-white shadow-xl shadow-brand-600/35 transition hover:bg-brand-700 hover:scale-105 active:scale-95 focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          <ScanLine size={28} className="animate-pulse" aria-hidden="true" />
          <span className="text-base font-bold tracking-wide">Escanear</span>
        </button>
      </div>

      {/* Modal del escáner */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={handleScanDetect}
        title="Escaneo de Bodega"
      />

      {/* Confirmación de salida */}
      <ConfirmDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={signOut}
        tone="danger"
        title="¿Cerrar sesión de Bodega?"
        description="Terminarás la sesión en esta tablet. Cualquier conteo no guardado se perderá."
        confirmLabel="Cerrar sesión"
        cancelLabel="Volver"
      />
    </div>
  );
}
