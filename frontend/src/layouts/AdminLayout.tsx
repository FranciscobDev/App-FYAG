import { useState, useRef } from "react";
import {
  ChevronDown,
  Clock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldAlert,
  User as UserIcon,
  X,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { ROLES } from "@/core/roles";
import { useAuth } from "@/features/auth/AuthContext";
import { useSessionTimeout } from "@/features/auth/SessionTimeoutProvider";
import { NotificationBell, type AppNotification } from "@/components/shared/NotificationBell";
import { useDismiss } from "@/hooks/useDismiss";
import { useToast } from "@/components/overlay/Toast";
import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";
import { PRODUCTS, PROJECTS, TECHNICIANS } from "@/data/mock";

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    title: "Stock crítico: Gas R410A",
    description: "Quedan 6 cilindros en Bodega Central (mínimo 8).",
    time: "hace 12 min",
    read: false,
  },
  {
    id: "notif-2",
    title: "Nueva solicitud de materiales",
    description: "Alejandro Rojas solicita 12 disyuntores para OB-2026-014.",
    time: "hace 45 min",
    read: false,
  },
  {
    id: "notif-3",
    title: "Avance reportado: 62 %",
    description: "Edificio Los Aromos finalizó cableado en piso 4.",
    time: "hace 2 h",
    read: true,
  },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const { simulateTimeoutWarning } = useSessionTimeout();
  const cfg = ROLES.admin;
  const navigate = useNavigate();
  const toast = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useDismiss(userMenuRef, userMenuOpen, () => setUserMenuOpen(false));
  useDismiss(searchRef, searchOpen, () => setSearchOpen(false));

  // Resultados de búsqueda global
  const searchResults = searchQuery.trim()
    ? {
        products: PRODUCTS.filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase()),
        ).slice(0, 3),
        projects: PROJECTS.filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.code.toLowerCase().includes(searchQuery.toLowerCase()),
        ).slice(0, 3),
        technicians: TECHNICIANS.filter((t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ).slice(0, 2),
      }
    : null;

  const totalResultsCount =
    (searchResults?.products.length ?? 0) +
    (searchResults?.projects.length ?? 0) +
    (searchResults?.technicians.length ?? 0);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ─── SIDEBAR COLAPSABLE ─── */}
      <aside
        data-surface="dark"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-900 text-white transition-all duration-300 lg:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Encabezado del sidebar */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 font-bold shadow-xs">
              FY
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold leading-none tracking-tight">FYAG</p>
                <p className="text-xs text-white/60 truncate">Administración</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            title={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navegación por grupos */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
          aria-label="Menú principal de administración"
        >
          {cfg.groups?.map((group) => (
            <div key={group.name} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white/45">
                  {group.name}
                </p>
              )}
              {collapsed && <div className="my-2 border-t border-white/10" />}

              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <NavLink
                  key={to}
                  to={`${cfg.basePath}/${to}`}
                  end={to === ""}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition ${
                      collapsed ? "justify-center px-0" : "px-3"
                    } ${
                      isActive
                        ? "bg-white text-brand-900 shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <Icon size={19} className="shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  {!collapsed && badge !== undefined && (
                    <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-white leading-none">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Pie del sidebar con mini usuario */}
        <div className="border-t border-white/10 p-3">
          <div
            className={`flex items-center gap-3 rounded-xl bg-white/5 p-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-900">
              {user?.initials ?? "JM"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{user?.name}</p>
                <p className="truncate text-[0.6875rem] text-white/60">{user?.rut}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── ÁREA PRINCIPAL ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ─── TOPBAR ─── */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-ink-200 bg-white px-4 lg:px-8 shadow-xs">
          {/* Buscador global */}
          <div ref={searchRef} className="relative flex-1 max-w-md">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar SKU, producto, obra o técnico… (Ctrl+K)"
                className="field pl-9 pr-8 h-10 text-body-sm"
                aria-label="Búsqueda global"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Menú de resultados de búsqueda */}
            {searchOpen && searchQuery.trim() && (
              <div
                role="region"
                aria-label="Resultados de búsqueda global"
                className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-ink-200 bg-white p-2 shadow-xl z-50 max-h-96 overflow-y-auto"
              >
                {totalResultsCount === 0 ? (
                  <p className="p-4 text-center text-body-sm text-ink-500">
                    No se encontraron coincidencias para "{searchQuery}"
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults?.products && searchResults.products.length > 0 && (
                      <div>
                        <p className="px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
                          Productos en Inventario
                        </p>
                        {searchResults.products.map((p) => (
                          <button
                            key={p.sku}
                            type="button"
                            onClick={() => {
                              navigate("/admin/inventario");
                              setSearchOpen(false);
                              toast({
                                tone: "info",
                                title: p.name,
                                description: `SKU: ${p.sku} · Stock: ${p.stock} ${p.unit}`,
                              });
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-body-sm hover:bg-ink-100"
                          >
                            <span className="font-medium text-ink-900">{p.name}</span>
                            <span className="font-mono text-xs text-ink-500">{p.sku}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults?.projects && searchResults.projects.length > 0 && (
                      <div>
                        <p className="px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
                          Proyectos y Obras
                        </p>
                        {searchResults.projects.map((pr) => (
                          <button
                            key={pr.id}
                            type="button"
                            onClick={() => {
                              navigate("/admin/proyectos");
                              setSearchOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-body-sm hover:bg-ink-100"
                          >
                            <span className="font-medium text-ink-900">{pr.name}</span>
                            <span className="font-mono text-xs text-brand-600">{pr.code}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults?.technicians && searchResults.technicians.length > 0 && (
                      <div>
                        <p className="px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">
                          Personal y Técnicos
                        </p>
                        {searchResults.technicians.map((t) => (
                          <button
                            key={t.rut}
                            type="button"
                            onClick={() => {
                              navigate("/admin/tecnicos");
                              setSearchOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-body-sm hover:bg-ink-100"
                          >
                            <span className="font-medium text-ink-900">{t.name}</span>
                            <span className="text-xs text-ink-500">{t.specialty}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Acciones derechas: Notificaciones + Menú de usuario */}
          <div className="flex items-center gap-3">
            <NotificationBell
              notifications={notifications}
              onMarkAllRead={() =>
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }
              onSelect={(n) => {
                toast({ tone: "info", title: n.title, description: n.description });
              }}
            />

            {/* Menú de usuario (Dropdown accesible) */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Abrir menú de usuario"
                className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white py-1.5 pl-2 pr-3 transition hover:bg-ink-100 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <div className="grid size-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  {user?.initials ?? "JM"}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold text-ink-900 leading-tight">
                    {user?.name ?? "Javier Muñoz"}
                  </p>
                  <p className="text-[0.6875rem] text-ink-500">Administrador</p>
                </div>
                <ChevronDown size={14} className="text-ink-500" aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Opciones de usuario"
                  className="absolute right-0 mt-2 w-64 rounded-2xl border border-ink-200 bg-white p-2 shadow-xl z-50 animate-pop"
                >
                  <div className="border-b border-ink-100 px-3 py-2.5">
                    <p className="text-sm font-bold text-ink-900">{user?.name}</p>
                    <p className="font-mono text-xs text-ink-500">{user?.rut}</p>
                    <span className="mt-1.5 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-700">
                      Rol: Administración General
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/admin/configuracion");
                      }}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-sm text-ink-700 hover:bg-ink-100"
                    >
                      <UserIcon size={16} className="text-ink-500" />
                      <span>Preferencias de cuenta</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/sistema-diseno");
                      }}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-sm text-ink-700 hover:bg-ink-100"
                    >
                      <ShieldAlert size={16} className="text-ink-500" />
                      <span>Sistema de diseño</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        simulateTimeoutWarning();
                      }}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-sm text-warn hover:bg-warn-soft/40"
                    >
                      <Clock size={16} />
                      <span>Simular aviso inactividad (30 min)</span>
                    </button>
                  </div>

                  <div className="border-t border-ink-100 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-body-sm font-semibold text-danger hover:bg-danger-soft/40"
                    >
                      <LogOut size={16} />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="min-w-0 flex-1 p-6 xl:p-8">
          <Outlet />
        </main>
      </div>

      {/* ConfirmDialog de salida */}
      <ConfirmDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={signOut}
        tone="danger"
        title="¿Deseas cerrar tu sesión?"
        description="Se cerrará tu sesión de administrador y regresarás al selector de acceso."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
      />
    </div>
  );
}
