import { FormEvent, useMemo, useState } from "react";

type Role = "admin" | "warehouse" | "technician";
type IconName =
  | "archive"
  | "arrow"
  | "bell"
  | "box"
  | "chart"
  | "check"
  | "clipboard"
  | "clock"
  | "eye"
  | "folder"
  | "grid"
  | "lock"
  | "logout"
  | "menu"
  | "people"
  | "plus"
  | "report"
  | "search"
  | "settings"
  | "spark"
  | "trend"
  | "user";

const roleDetails = {
  admin: {
    label: "Administración / Jefatura",
    shortLabel: "Admin / Jefe",
    description: "Control total de datos, insumos y proyectos",
    initials: "JM",
    name: "Javier Muñoz",
  },
  warehouse: {
    label: "Bodeguero",
    shortLabel: "Bodeguero",
    description: "Consulta de datos y edición mediante solicitud",
    initials: "CV",
    name: "Camila Vera",
  },
  technician: {
    label: "Técnico",
    shortLabel: "Técnico",
    description: "Solo lectura y envío de informes a administración",
    initials: "AR",
    name: "Alejandro Rojas",
  },
};

const navByRole: Record<Role, { label: string; icon: IconName }[]> = {
  admin: [
    { label: "Vista general", icon: "grid" },
    { label: "Proyectos", icon: "folder" },
    { label: "Productos", icon: "box" },
    { label: "Movimientos", icon: "trend" },
    { label: "Solicitudes", icon: "clipboard" },
    { label: "Técnicos", icon: "people" },
    { label: "Informes", icon: "report" },
  ],
  warehouse: [
    { label: "Vista general", icon: "grid" },
    { label: "Catálogo de insumos", icon: "box" },
    { label: "Proyectos", icon: "folder" },
    { label: "Movimientos", icon: "trend" },
    { label: "Solicitudes de edición", icon: "clipboard" },
    { label: "Informes", icon: "report" },
  ],
  technician: [
    { label: "Vista general", icon: "grid" },
    { label: "Mis proyectos", icon: "folder" },
    { label: "Insumos asignados", icon: "box" },
    { label: "Informes enviados", icon: "report" },
  ],
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    archive: <><path d="M4 7h16v13H4z" /><path d="M3 3h18v4H3zM9 11h6" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="m3 8 9 5 9-5v9l-9 5-9-5Z" /><path d="M12 13v9" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clipboard: <><path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3" /><path d="M9 3h6v4H9zM8 12h8M8 16h5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    people: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M17 11a4 4 0 0 0 0-8M22 20v-2a4 4 0 0 0-3-3.7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    report: <><path d="M5 3h11l3 3v15H5z" /><path d="M14 3v5h5M9 17v-4M12 17V9M15 17v-6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 14.5a2 2 0 0 0 .4 2.2l.1.1-2.7 2.7-.1-.1a2 2 0 0 0-2.2-.4 2 2 0 0 0-1.3 1.8V21H9v-.2A2 2 0 0 0 7.7 19a2 2 0 0 0-2.2.4l-.1.1-2.7-2.7.1-.1a2 2 0 0 0 .4-2.2A2 2 0 0 0 1.4 13H1V9h.4a2 2 0 0 0 1.8-1.5 2 2 0 0 0-.4-2.2l-.1-.1 2.7-2.7.1.1a2 2 0 0 0 2.2.4A2 2 0 0 0 9 1.2V1h4v.2A2 2 0 0 0 14.3 3a2 2 0 0 0 2.2-.4l.1-.1 2.7 2.7-.1.1a2 2 0 0 0-.4 2.2A2 2 0 0 0 20.6 9h.4v4h-.4a2 2 0 0 0-1.6 1.5Z" /></>,
    spark: <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Logo({ light = false, sidebar = false }: { light?: boolean; sidebar?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {!sidebar && (
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${light ? "bg-white text-slate-950" : "bg-slate-950 text-white"}`}>
          <Icon name="archive" size={21} />
        </div>
      )}
      <div>
        <div className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-slate-950"}`}>{sidebar ? "Frío" : "Nexo Frío"}</div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${light ? "text-slate-400" : "text-slate-500"}`}>Agroindustria</div>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("admin");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    onLogin(role);
  }

  return (
    <main className="min-h-screen bg-[#f2f4f3] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#0b1d33] p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-36 -top-36 h-[440px] w-[440px] rounded-full border border-blue-300/10" />
          <div className="absolute -right-20 -top-20 h-[310px] w-[310px] rounded-full border border-blue-300/10" />
          <div className="absolute bottom-[-15%] left-[-10%] h-[420px] w-[420px] rounded-full bg-blue-400/5 blur-3xl" />
          <Logo light />

          <div className="relative max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
              <Icon name="spark" size={14} />
              Refrigeración agroindustrial
            </div>
            <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.04em] text-white">
              Frío confiable, proyectos bajo control.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              Controla los insumos y la ejecución de cada instalación de refrigeración desde un solo lugar.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-3">
              {[
                ["24", "Instalaciones activas"],
                ["1.248 kg", "Refrigerante"],
                ["684 m", "Tubería de cobre"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                  <div className="text-2xl font-semibold text-white">{value}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between text-xs text-slate-500">
            <span>Cadena de frío segura y trazable</span>
            <span>v2.4</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-[470px]">
            <div className="mb-12 lg:hidden"><Logo /></div>
            <div className="mb-8">
              <span className="text-sm font-semibold text-blue-700">Bienvenido a Nexo Frío</span>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                {mode === "login" ? "Accede a tu espacio" : "Crea tu cuenta"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login" ? "Ingresa tus credenciales para continuar." : "Completa tus datos para solicitar acceso."}
              </p>
            </div>

            <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button onClick={() => setMode("login")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Iniciar sesión</button>
              <button onClick={() => setMode("register")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === "register" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Registrarse</button>
            </div>

            <form onSubmit={submit} className="space-y-5">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Nombre completo</span>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-slate-400"><Icon name="user" size={18} /></span>
                    <input required placeholder="Nombre y apellido" className="field pl-11" />
                  </div>
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Correo corporativo</span>
                <input required type="email" defaultValue={mode === "login" ? "javier@nexofrio.cl" : ""} placeholder="nombre@empresa.cl" className="field" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                  Contraseña
                  {mode === "login" && <button type="button" className="font-medium text-blue-700">¿La olvidaste?</button>}
                </span>
                <div className="relative">
                  <input required type={showPassword ? "text" : "password"} defaultValue={mode === "login" ? "operaciones" : ""} placeholder="Mínimo 8 caracteres" className="field pr-11" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 text-slate-400 hover:text-slate-700" aria-label="Mostrar contraseña">
                    <Icon name="eye" size={18} />
                  </button>
                </div>
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Perfil de acceso</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(roleDetails) as Role[]).map((item) => (
                    <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-xl border p-3 text-left transition ${role === item ? "border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      <Icon name={item === "admin" ? "settings" : item === "warehouse" ? "archive" : "user"} size={18} />
                      <span className="mt-2 block truncate text-xs font-semibold">{roleDetails[item].shortLabel}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-blue-800">
                {mode === "login" ? "Ingresar a Nexo Frío" : "Solicitar acceso"}
                <Icon name="arrow" size={17} />
              </button>
            </form>
            <p className="mt-7 text-center text-xs leading-5 text-slate-400">
              Al continuar, aceptas las políticas de seguridad y tratamiento de datos.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "slate" | "blue" }) {
  const tones = {
    green: "bg-blue-50 text-blue-700 ring-blue-600/15",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

type StatusTone = "green" | "amber" | "slate" | "blue";
type Project = { id: string; name: string; type: string; owner: string; progress: number; status: string; date: string; tone: StatusTone };
type Supply = { id: string; name: string; category: string; stock: string; reserved: string; status: string; tone: StatusTone };
type Report = { id: string; name: string; type: string; author: string; date: string; status: string; tone: StatusTone };
type Technician = {
  id: string;
  initials: string;
  name: string;
  specialty: string;
  status: string;
  load: string;
  tone: StatusTone;
  email: string;
  phone: string;
  location: string;
  joined: string;
  certifications: string[];
  projects: { id: string; name: string; progress: number; status: string }[];
};

const initialProjects: Project[] = [
  { id: "PR-0248", name: "Cámara de frío — Planta Frutícola Norte", type: "Frío industrial", owner: "Alejandro Rojas", progress: 68, status: "En ejecución", date: "24 Jun", tone: "green" },
  { id: "PR-0243", name: "Túnel de congelado — Centro de Proceso", type: "Congelación rápida", owner: "Camila Vera", progress: 92, status: "Por finalizar", date: "19 Jun", tone: "blue" },
  { id: "PR-0239", name: "Packing refrigerado — Agrícola Sur", type: "Climatización", owner: "Matías Soto", progress: 35, status: "En revisión", date: "28 Jun", tone: "amber" },
  { id: "PR-0236", name: "Sistema de amoníaco — Bodega Central", type: "Refrigeración NH₃", owner: "Jorge Pérez", progress: 100, status: "Completado", date: "14 Jun", tone: "slate" },
  { id: "PR-0231", name: "Prefrío de cerezas — Fundo El Maitén", type: "Hidroenfriado", owner: "Sofía Núñez", progress: 48, status: "En ejecución", date: "02 Jul", tone: "green" },
];

const initialSupplies: Supply[] = [
  { id: "INS-0018", name: "Refrigerante R404A", category: "Refrigerantes", stock: "1.248 kg", reserved: "320 kg", status: "Disponible", tone: "blue" },
  { id: "INS-0042", name: "Tubería cobre 7/8”", category: "Tuberías", stock: "684 m", reserved: "124 m", status: "Disponible", tone: "green" },
  { id: "INS-0071", name: "Válvula de expansión electrónica", category: "Control", stock: "96 un.", reserved: "22 un.", status: "Stock bajo", tone: "amber" },
  { id: "INS-0034", name: "Compresor semihermético 15 HP", category: "Equipos", stock: "18 un.", reserved: "5 un.", status: "Disponible", tone: "green" },
  { id: "INS-0093", name: "Unidad condensadora 10 HP", category: "Equipos", stock: "12 un.", reserved: "8 un.", status: "Stock bajo", tone: "amber" },
  { id: "INS-0112", name: "Panel aislado PIR 100 mm", category: "Aislación", stock: "860 m²", reserved: "240 m²", status: "Disponible", tone: "blue" },
];

const initialReports: Report[] = [
  { id: "INF-0284", name: "Avance semanal — Cámara Frutícola Norte", type: "Proyecto", author: "Alejandro Rojas", date: "18 Jun", status: "Recibido", tone: "green" },
  { id: "INF-0281", name: "Consumo de insumos — Mayo", type: "Inventario", author: "Camila Vera", date: "16 Jun", status: "Revisado", tone: "blue" },
  { id: "INF-0278", name: "Puesta en marcha — Túnel de congelado", type: "Técnico", author: "Matías Soto", date: "14 Jun", status: "Pendiente", tone: "amber" },
  { id: "INF-0272", name: "Movimientos de stock — Semana 23", type: "Inventario", author: "Jorge Pérez", date: "10 Jun", status: "Revisado", tone: "slate" },
];

function ModuleHeader({ eyebrow, title, description, action, actionIcon = "plus", onAction }: { eyebrow: string; title: string; description: string; action: string; actionIcon?: IconName; onAction?: () => void }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold text-blue-700">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <button onClick={onAction} className="flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 sm:self-auto">
        <Icon name={actionIcon} size={17} /> {action}
      </button>
    </div>
  );
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-700">
        {label}{required && <span className="ml-1 text-blue-700">*</span>}
      </span>
      {children}
    </label>
  );
}

function ActionModal({ title, description, submitLabel, onClose, onSubmit, children }: { title: string; description: string; submitLabel: string; onClose: () => void; onSubmit?: (data: FormData) => void; children: React.ReactNode }) {
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <button aria-label="Cerrar formulario" onClick={() => setShowCloseConfirmation(true)} className="absolute inset-0" />
      <section className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div><h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
          <button type="button" onClick={() => setShowCloseConfirmation(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">×</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(new FormData(event.currentTarget)); onClose(); }} className="p-6">
          {children}
          <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => setShowCloseConfirmation(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">{submitLabel}</button>
          </div>
        </form>
      </section>
      {showCloseConfirmation && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/55 p-4">
          <button aria-label="Continuar editando" onClick={() => setShowCloseConfirmation(false)} className="absolute inset-0" />
          <section role="alertdialog" aria-modal="true" aria-labelledby="close-confirmation-title" aria-describedby="close-confirmation-description" className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-xl font-semibold text-amber-700">!</div>
            <h2 id="close-confirmation-title" className="mt-5 text-xl font-semibold tracking-tight text-slate-950">¿Cerrar este formulario?</h2>
            <p id="close-confirmation-description" className="mt-2 text-sm leading-6 text-slate-500">Los datos que hayas ingresado no se guardarán. Puedes continuar editando o descartar los cambios.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowCloseConfirmation(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Continuar editando</button>
              <button type="button" onClick={onClose} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">Descartar y cerrar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function TableTools({ placeholder, filter = "Todos los estados" }: { placeholder: string; filter?: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" size={16} /></span>
        <input className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500" placeholder={placeholder} />
      </div>
      <button className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
        {filter}<span className="text-slate-400">⌄</span>
      </button>
    </div>
  );
}

function ProjectView({ role, items, setItems }: { role: Role; items: Project[]; setItems: React.Dispatch<React.SetStateAction<Project[]>> }) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const openCreate = () => { setEditing(null); setShowForm(true); };
  const saveProject = (data: FormData) => {
    const progress = Number(data.get("progress") || 0);
    const status = String(data.get("status"));
    const project: Project = {
      id: editing?.id || `PR-${String(250 + items.length).padStart(4, "0")}`,
      name: String(data.get("name")),
      type: String(data.get("type")),
      owner: String(data.get("owner")),
      progress,
      status,
      date: String(data.get("date")),
      tone: status === "Completado" ? "slate" : status === "En revisión" ? "amber" : progress > 85 ? "blue" : "green",
    };
    setItems((current) => editing ? current.map((item) => item.id === editing.id ? project : item) : [project, ...current]);
  };
  return (
    <>
      <ModuleHeader eyebrow="Operaciones en terreno" title={role === "technician" ? "Mis proyectos asignados" : "Proyectos de refrigeración"} description="Planificación, avance e insumos comprometidos en cada instalación." action={role === "technician" ? "Enviar informe" : role === "warehouse" ? "Solicitar actualización" : "Nuevo proyecto"} actionIcon={role === "technician" ? "report" : "plus"} onAction={role === "admin" ? openCreate : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[["24", "Proyectos activos", "folder"], ["7", "En etapa de montaje", "settings"], ["4", "Próximas entregas", "clock"]].map(([value, label, icon]) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name={icon as IconName} size={18} /></div>
            <div><div className="text-xl font-semibold text-slate-950">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <TableTools placeholder="Buscar proyecto o cliente..." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Proyecto</th><th className="px-4 py-3">Especialidad</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Avance</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><div className="font-semibold text-slate-800">{project.name}</div><div className="mt-1 text-[11px] text-slate-400">{project.id}</div></td>
                  <td className="px-4 py-4 text-xs text-slate-500">{project.type}</td><td className="px-4 py-4 text-xs font-medium text-slate-600">{project.owner}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${project.progress}%` }} /></div><span className="text-xs font-semibold">{project.progress}%</span></div></td>
                  <td className="px-4 py-4"><StatusBadge tone={project.tone}>{project.status}</StatusBadge></td><td className="px-4 py-4 text-xs text-slate-500">{project.date}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2">{role === "admin" ? <><button onClick={() => { setEditing(project); setShowForm(true); }} className="text-xs font-semibold text-blue-700">Editar</button><button onClick={() => setItems((current) => current.filter((item) => item.id !== project.id))} className="text-xs font-semibold text-rose-600">Eliminar</button></> : <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-700"><Icon name="eye" size={17} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && (
        <ActionModal title={editing ? "Editar proyecto" : "Crear nuevo proyecto"} description="Completa los datos operativos de la instalación de refrigeración." submitLabel={editing ? "Guardar cambios" : "Crear proyecto"} onClose={() => setShowForm(false)} onSubmit={saveProject}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label="Nombre del proyecto" required><input name="name" required defaultValue={editing?.name} className="field" placeholder="Ej: Cámara de frío — Planta Norte" /></FormField></div>
            <FormField label="Especialidad" required><select name="type" required defaultValue={editing?.type || ""} className="field"><option value="">Seleccionar especialidad</option><option>Frío industrial</option><option>Congelación rápida</option><option>Climatización</option><option>Refrigeración NH₃</option><option>Hidroenfriado</option></select></FormField>
            <FormField label="Técnico responsable" required><select name="owner" required defaultValue={editing?.owner || ""} className="field"><option value="">Seleccionar técnico</option><option>Alejandro Rojas</option><option>Matías Soto</option><option>Sofía Núñez</option><option>Jorge Pérez</option><option>Camila Vera</option></select></FormField>
            <FormField label="Estado" required><select name="status" required defaultValue={editing?.status || "En ejecución"} className="field"><option>En ejecución</option><option>En revisión</option><option>Por finalizar</option><option>Completado</option></select></FormField>
            <FormField label="Fecha de entrega" required><input name="date" required defaultValue={editing?.date} className="field" placeholder="Ej: 24 Jun" /></FormField>
            <div className="sm:col-span-2"><FormField label="Porcentaje de avance" required><input name="progress" required type="number" min="0" max="100" defaultValue={editing?.progress || 0} className="field" /></FormField></div>
          </div>
        </ActionModal>
      )}
    </>
  );
}

function ProductsView({ role, items, setItems }: { role: Role; items: Supply[]; setItems: React.Dispatch<React.SetStateAction<Supply[]>> }) {
  const [editing, setEditing] = useState<Supply | null>(null);
  const [showForm, setShowForm] = useState(false);
  const saveSupply = (data: FormData) => {
    const status = String(data.get("status"));
    const supply: Supply = { id: editing?.id || `INS-${String(120 + items.length).padStart(4, "0")}`, name: String(data.get("name")), category: String(data.get("category")), stock: String(data.get("stock")), reserved: String(data.get("reserved")), status, tone: status === "Stock bajo" ? "amber" : status === "Sin stock" ? "slate" : "green" };
    setItems((current) => editing ? current.map((item) => item.id === editing.id ? supply : item) : [supply, ...current]);
  };
  return (
    <>
      <ModuleHeader eyebrow="Inventario técnico" title="Insumos y equipos" description="Disponibilidad, reservas y niveles críticos para instalaciones de refrigeración." action={role === "admin" ? "Nuevo insumo" : role === "warehouse" ? "Solicitar edición" : "Ver mis asignaciones"} actionIcon={role === "technician" ? "eye" : "plus"} onAction={role === "admin" ? () => { setEditing(null); setShowForm(true); } : undefined} />
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <TableTools placeholder="Buscar código o insumo..." filter="Todas las categorías" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Insumo</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Stock actual</th><th className="px-4 py-3">Comprometido</th><th className="px-4 py-3">Disponibilidad</th><th className="px-4 py-3">Acción</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((supply) => (
                <tr key={supply.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon name="box" size={17} /></div><div><div className="font-semibold text-slate-800">{supply.name}</div><div className="text-[11px] text-slate-400">{supply.id}</div></div></div></td>
                  <td className="px-4 py-4 text-xs text-slate-500">{supply.category}</td><td className="px-4 py-4 font-semibold text-slate-700">{supply.stock}</td><td className="px-4 py-4 text-xs text-slate-500">{supply.reserved}</td><td className="px-4 py-4"><StatusBadge tone={supply.tone}>{supply.status}</StatusBadge></td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2">{role === "admin" ? <><button onClick={() => { setEditing(supply); setShowForm(true); }} className="text-xs font-semibold text-blue-700">Editar</button><button onClick={() => setItems((current) => current.filter((item) => item.id !== supply.id))} className="text-xs font-semibold text-rose-600">Eliminar</button></> : <button className="text-xs font-semibold text-blue-700">{role === "warehouse" ? "Solicitar cambio" : "Ver detalle"}</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && (
        <ActionModal title={editing ? "Editar insumo" : "Crear nuevo insumo"} description="Registra el producto y sus niveles de inventario." submitLabel={editing ? "Guardar cambios" : "Crear insumo"} onClose={() => setShowForm(false)} onSubmit={saveSupply}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label="Nombre del insumo o equipo" required><input name="name" required defaultValue={editing?.name} className="field" placeholder="Ej: Refrigerante R404A" /></FormField></div>
            <FormField label="Categoría" required><select name="category" required defaultValue={editing?.category || ""} className="field"><option value="">Seleccionar categoría</option><option>Refrigerantes</option><option>Tuberías</option><option>Control</option><option>Equipos</option><option>Aislación</option></select></FormField>
            <FormField label="Estado" required><select name="status" required defaultValue={editing?.status || "Disponible"} className="field"><option>Disponible</option><option>Stock bajo</option><option>Sin stock</option></select></FormField>
            <FormField label="Stock actual" required><input name="stock" required defaultValue={editing?.stock} className="field" placeholder="Ej: 240 kg" /></FormField>
            <FormField label="Cantidad comprometida" required><input name="reserved" required defaultValue={editing?.reserved || "0 un."} className="field" placeholder="Ej: 40 kg" /></FormField>
          </div>
        </ActionModal>
      )}
    </>
  );
}

function MovementsView({ role }: { role: Role }) {
  const movements = [
    ["MOV-3892", "Entrada", "Refrigerante R404A", "+240 kg", "OC-1842", "Camila Vera", "Hoy, 09:42", "green"],
    ["MOV-3891", "Salida a proyecto", "Tubería cobre 7/8”", "−42 m", "PR-0248", "Jorge Pérez", "Hoy, 08:15", "blue"],
    ["MOV-3888", "Reserva", "Unidad condensadora 10 HP", "−2 un.", "PR-0239", "Javier Muñoz", "Ayer, 16:28", "amber"],
    ["MOV-3884", "Devolución", "Panel aislado PIR 100 mm", "+18 m²", "PR-0236", "Alejandro Rojas", "Ayer, 12:04", "slate"],
  ];
  return (
    <>
      <ModuleHeader eyebrow="Trazabilidad de inventario" title="Movimientos de insumos" description="Registro consolidado de entradas, salidas, reservas y devoluciones." action={role === "admin" ? "Registrar movimiento" : "Solicitar movimiento"} />
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <TableTools placeholder="Buscar movimiento, insumo..." filter="Últimos 30 días" />
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Movimiento</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Insumo</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Referencia</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Fecha</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">{movements.map(([id, type, item, amount, reference, owner, date, tone]) => <tr key={id} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-700">{id}</td><td className="px-4 py-4"><StatusBadge tone={tone as "green" | "amber" | "slate" | "blue"}>{type}</StatusBadge></td><td className="px-4 py-4 font-medium text-slate-700">{item}</td><td className="px-4 py-4 font-semibold text-slate-800">{amount}</td><td className="px-4 py-4 text-xs text-blue-700">{reference}</td><td className="px-4 py-4 text-xs text-slate-500">{owner}</td><td className="px-4 py-4 text-xs text-slate-500">{date}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}

function RequestsView({ role }: { role: Role }) {
  const [showForm, setShowForm] = useState(false);
  const columns = [
    ["Pendientes", "3", "amber", [["SOL-1847", "Ajustar stock de R404A", "Camila Vera", "Hace 18 min"], ["SOL-1845", "Crear insumo: sensor PT100", "Camila Vera", "Hace 2 h"]]],
    ["En revisión", "2", "blue", [["SOL-1842", "Ingreso de 240 kg de R404A", "Jorge Pérez", "Hoy, 09:10"], ["SOL-1839", "Actualizar costo compresor 15 HP", "Camila Vera", "Ayer"]]],
    ["Resueltas", "12", "green", [["SOL-1836", "Corregir reserva proyecto PR-0243", "Jorge Pérez", "Ayer"], ["SOL-1831", "Alta de panel PIR 100 mm", "Camila Vera", "12 Jun"]]],
  ] as const;
  return (
    <>
      <ModuleHeader eyebrow="Flujo de autorizaciones" title="Solicitudes de edición" description={role === "admin" ? "Revisa y autoriza cambios propuestos por el equipo de bodega." : "Solicita cambios de productos y movimientos para aprobación de administración."} action="Nueva solicitud" onAction={() => setShowForm(true)} />
      <div className="grid gap-5 lg:grid-cols-3">
        {columns.map(([title, count, tone, cards]) => <section key={title} className="rounded-2xl bg-slate-100/80 p-3"><div className="flex items-center justify-between px-2 py-2"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-700">{title}</h2><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{count}</span></div><button className="text-slate-400">•••</button></div><div className="mt-2 space-y-3">{cards.map(([id, name, owner, date]) => <article key={id} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><span className="text-[10px] font-bold text-blue-700">{id}</span><StatusBadge tone={tone}>{title === "Resueltas" ? "Aprobada" : title}</StatusBadge></div><h3 className="mt-3 text-sm font-semibold leading-5 text-slate-800">{name}</h3><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400"><span>{owner}</span><span>{date}</span></div></article>)}</div></section>)}
      </div>
      {showForm && (
        <ActionModal title="Crear solicitud de edición" description="La solicitud será enviada a administración para su revisión." submitLabel="Enviar solicitud" onClose={() => setShowForm(false)}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Tipo de modificación" required><select required className="field"><option value="">Seleccionar tipo</option><option>Actualizar stock</option><option>Editar información de insumo</option><option>Crear nuevo insumo</option><option>Corregir movimiento</option></select></FormField>
            <FormField label="Insumo o equipo" required><select required className="field"><option value="">Seleccionar insumo</option><option>Refrigerante R404A</option><option>Tubería cobre 7/8”</option><option>Compresor semihermético 15 HP</option><option>Unidad condensadora 10 HP</option></select></FormField>
            <FormField label="Valor actual"><input className="field" placeholder="Ej: 1.248 kg" /></FormField>
            <FormField label="Nuevo valor" required><input required className="field" placeholder="Ej: 1.488 kg" /></FormField>
            <FormField label="Proyecto relacionado"><select className="field"><option>Sin proyecto relacionado</option><option>PR-0248 — Cámara de frío</option><option>PR-0243 — Túnel de congelado</option><option>PR-0239 — Packing refrigerado</option></select></FormField>
            <FormField label="Prioridad" required><select required className="field"><option>Normal</option><option>Alta</option><option>Urgente</option></select></FormField>
          </div>
          <div className="mt-5"><FormField label="Motivo de la solicitud" required><textarea required rows={4} className="field resize-none" placeholder="Describe el cambio solicitado y adjunta el contexto necesario para su aprobación." /></FormField></div>
        </ActionModal>
      )}
    </>
  );
}

const technicians: Technician[] = [
  { id: "TEC-001", initials: "AR", name: "Alejandro Rojas", specialty: "Refrigeración industrial", status: "Disponible", load: "2 proyectos", tone: "green", email: "alejandro.rojas@nexofrio.cl", phone: "+56 9 6123 4580", location: "Región del Maule", joined: "12 Mar 2021", certifications: ["Manejo de refrigerantes", "Trabajo en altura", "Prevención de riesgos"], projects: [{ id: "PR-0248", name: "Cámara de frío — Planta Frutícola Norte", progress: 68, status: "En ejecución" }, { id: "PR-0231", name: "Prefrío de cerezas — Fundo El Maitén", progress: 48, status: "En ejecución" }] },
  { id: "TEC-002", initials: "MS", name: "Matías Soto", specialty: "Control y automatización", status: "En terreno", load: "3 proyectos", tone: "blue", email: "matias.soto@nexofrio.cl", phone: "+56 9 7234 5192", location: "Región de O’Higgins", joined: "08 Ago 2020", certifications: ["Automatización PLC", "Electricidad industrial", "Trabajo en altura"], projects: [{ id: "PR-0239", name: "Packing refrigerado — Agrícola Sur", progress: 35, status: "En revisión" }, { id: "PR-0243", name: "Túnel de congelado — Centro de Proceso", progress: 92, status: "Por finalizar" }] },
  { id: "TEC-003", initials: "SN", name: "Sofía Núñez", specialty: "Montaje frigorífico", status: "En terreno", load: "2 proyectos", tone: "blue", email: "sofia.nunez@nexofrio.cl", phone: "+56 9 8345 6204", location: "Región Metropolitana", joined: "21 Ene 2022", certifications: ["Soldadura de cobre", "Montaje industrial"], projects: [{ id: "PR-0231", name: "Prefrío de cerezas — Fundo El Maitén", progress: 48, status: "En ejecución" }] },
  { id: "TEC-004", initials: "JP", name: "Jorge Pérez", specialty: "Amoníaco industrial", status: "No disponible", load: "1 proyecto", tone: "slate", email: "jorge.perez@nexofrio.cl", phone: "+56 9 9456 7316", location: "Región del Biobío", joined: "04 Nov 2019", certifications: ["Operación de NH₃", "Respuesta a emergencias", "Prevención de riesgos"], projects: [{ id: "PR-0236", name: "Sistema de amoníaco — Bodega Central", progress: 100, status: "Completado" }] },
  { id: "TEC-005", initials: "FC", name: "Felipe Castro", specialty: "Electricidad y control", status: "Disponible", load: "1 proyecto", tone: "green", email: "felipe.castro@nexofrio.cl", phone: "+56 9 5567 8428", location: "Región de Ñuble", joined: "17 May 2023", certifications: ["Electricidad SEC", "Automatización PLC"], projects: [{ id: "PR-0248", name: "Cámara de frío — Planta Frutícola Norte", progress: 68, status: "En ejecución" }] },
  { id: "TEC-006", initials: "LP", name: "Laura Pino", specialty: "Puesta en marcha", status: "En terreno", load: "2 proyectos", tone: "amber", email: "laura.pino@nexofrio.cl", phone: "+56 9 6678 9530", location: "Región de La Araucanía", joined: "29 Sep 2022", certifications: ["Comisionamiento", "Manejo de refrigerantes"], projects: [{ id: "PR-0243", name: "Túnel de congelado — Centro de Proceso", progress: 92, status: "Por finalizar" }] },
];

function TechniciansView() {
  const [selected, setSelected] = useState<Technician | null>(null);
  const [profileTab, setProfileTab] = useState<"datos" | "proyectos" | "actividad">("datos");

  if (selected) {
    return (
      <>
        <button onClick={() => setSelected(null)} className="mb-5 flex items-center gap-2 text-sm font-semibold text-blue-700">
          <span className="rotate-180"><Icon name="arrow" size={16} /></span> Volver a técnicos
        </button>
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="bg-[#0c2038] px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-900">{selected.initials}</div>
                <div><div className="text-xs font-semibold text-blue-300">{selected.id}</div><h1 className="mt-1 text-2xl font-semibold">{selected.name}</h1><p className="mt-1 text-sm text-slate-300">{selected.specialty}</p></div>
              </div>
              <StatusBadge tone={selected.tone}>{selected.status}</StatusBadge>
            </div>
          </div>
          <div className="border-b border-slate-200 px-5 sm:px-8">
            <div className="flex gap-6 overflow-x-auto">
              {([["datos", "Datos generales"], ["proyectos", "Proyectos asignados"], ["actividad", "Actividad reciente"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setProfileTab(id)} className={`whitespace-nowrap border-b-2 py-4 text-sm font-semibold ${profileTab === id ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="p-5 sm:p-8">
            {profileTab === "datos" && (
              <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr]">
                <div><h2 className="font-semibold text-slate-900">Información de contacto</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[["Correo corporativo", selected.email], ["Teléfono", selected.phone], ["Zona de operación", selected.location], ["Fecha de ingreso", selected.joined]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-medium text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{value}</dd></div>)}</dl></div>
                <div><h2 className="font-semibold text-slate-900">Certificaciones vigentes</h2><div className="mt-4 space-y-3">{selected.certifications.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700"><span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon name="check" size={14} /></span>{item}</div>)}</div></div>
              </div>
            )}
            {profileTab === "proyectos" && (
              <div className="space-y-4">{selected.projects.map((project) => <article key={project.id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="text-xs font-bold text-blue-700">{project.id}</div><h2 className="mt-1 font-semibold text-slate-800">{project.name}</h2></div><StatusBadge tone={project.progress === 100 ? "slate" : project.progress > 85 ? "blue" : "green"}>{project.status}</StatusBadge></div><div className="mt-5 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${project.progress}%` }} /></div><span className="text-xs font-semibold text-slate-600">{project.progress}%</span></div></article>)}</div>
            )}
            {profileTab === "actividad" && (
              <div className="space-y-1">{[["Informe técnico enviado", "Avance semanal registrado para administración", "Hoy, 09:24"], ["Material recibido en terreno", "Tubería de cobre y válvulas de expansión", "Ayer, 16:40"], ["Avance de proyecto actualizado", "Progreso de montaje actualizado en el sistema", "17 Jun, 11:15"]].map(([title, detail, date]) => <div key={title} className="flex gap-4 border-b border-slate-100 py-4 last:border-0"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="clock" size={16} /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-800">{title}</h2><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className="shrink-0 text-[11px] text-slate-400">{date}</span></div>)}</div>
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <ModuleHeader eyebrow="Equipo técnico" title="Disponibilidad de técnicos" description="Consulta la carga de trabajo, especialidad y ficha completa del personal en terreno." action="Añadir técnico" />
      <div className="mb-5 flex flex-wrap gap-3">{[["12", "Disponibles"], ["5", "En terreno"], ["1", "No disponible"]].map(([value, label]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="font-semibold text-slate-900">{value}</span><span className="ml-2 text-xs text-slate-500">{label}</span></div>)}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{technicians.map((person) => <article key={person.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{person.initials}</div><StatusBadge tone={person.tone}>{person.status}</StatusBadge></div><h3 className="mt-4 font-semibold text-slate-900">{person.name}</h3><p className="mt-1 text-xs text-slate-500">{person.specialty}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">{person.load}</span><button onClick={() => { setSelected(person); setProfileTab("datos"); }} className="flex items-center gap-1 text-xs font-semibold text-blue-700">Ver perfil <Icon name="arrow" size={13} /></button></div></article>)}</div>
    </>
  );
}

function ReportsView({ role, items, setItems }: { role: Role; items: Report[]; setItems: React.Dispatch<React.SetStateAction<Report[]>> }) {
  const [showForm, setShowForm] = useState(false);
  const saveReport = (data: FormData) => {
    const type = String(data.get("type"));
    const project = String(data.get("project"));
    const report: Report = {
      id: `INF-${String(285 + items.length).padStart(4, "0")}`,
      name: `${type} — ${project.split(" — ")[1] || project}`,
      type,
      author: roleDetails[role].name,
      date: String(data.get("date") || "Hoy"),
      status: role === "technician" ? "Recibido" : "Generado",
      tone: role === "technician" ? "green" : "blue",
    };
    setItems((current) => [report, ...current]);
  };
  return (
    <>
      <ModuleHeader eyebrow="Documentación y control" title="Informes" description={role === "technician" ? "Envía avances, evidencias y cierres de tus proyectos a administración." : "Centraliza informes de proyectos, técnicos y movimientos de inventario."} action={role === "technician" ? "Enviar informe" : "Generar informe"} actionIcon="report" onAction={() => setShowForm(true)} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">{[["report", "Informe de proyecto", "Avance, evidencias y cierre"], ["archive", "Movimientos de stock", "Entradas, salidas y reservas"], ["chart", "Consumo por proyecto", "Uso real versus planificado"]].map(([icon, title, text]) => <button key={title} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name={icon as IconName} size={18} /></div><div><div className="text-sm font-semibold text-slate-800">{title}</div><div className="mt-0.5 text-[11px] text-slate-500">{text}</div></div></button>)}</div>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-800">Informes recientes</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Informe</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Autor</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{items.map((report) => <tr key={report.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="font-semibold text-slate-800">{report.name}</div><div className="mt-1 text-[11px] text-slate-400">{report.id}</div></td><td className="px-4 py-4 text-xs text-slate-500">{report.type}</td><td className="px-4 py-4 text-xs text-slate-600">{report.author}</td><td className="px-4 py-4 text-xs text-slate-500">{report.date}</td><td className="px-4 py-4"><StatusBadge tone={report.tone}>{report.status}</StatusBadge></td><td className="px-4 py-4"><button className="text-blue-700"><Icon name="eye" size={17} /></button></td></tr>)}</tbody></table></div></section>
      {showForm && (
        <ActionModal title={role === "technician" ? "Enviar informe técnico" : "Generar nuevo informe"} description="Completa la información para registrar el avance y notificar a administración." submitLabel={role === "technician" ? "Enviar a administración" : "Generar informe"} onClose={() => setShowForm(false)} onSubmit={saveReport}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Tipo de informe" required><select name="type" required className="field"><option value="">Seleccionar tipo</option><option>Avance de proyecto</option><option>Cierre de instalación</option><option>Movimientos de inventario</option><option>Consumo de insumos</option><option>Incidencia técnica</option></select></FormField>
            <FormField label="Proyecto" required><select name="project" required className="field"><option value="">Seleccionar proyecto</option><option>PR-0248 — Cámara de frío</option><option>PR-0243 — Túnel de congelado</option><option>PR-0239 — Packing refrigerado</option></select></FormField>
            <FormField label="Etapa del proyecto" required><select name="stage" required className="field"><option>Levantamiento</option><option>Montaje</option><option>Puesta en marcha</option><option>Entrega</option></select></FormField>
            <FormField label="Fecha del informe" required><input name="date" required type="date" className="field" /></FormField>
            <FormField label="Porcentaje de avance"><input name="progress" type="number" min="0" max="100" className="field" placeholder="Ej: 68" /></FormField>
            <FormField label="Horas trabajadas"><input name="hours" type="number" min="0" className="field" placeholder="Ej: 24" /></FormField>
          </div>
          <div className="mt-5"><FormField label="Resumen del trabajo realizado" required><textarea required rows={4} className="field resize-none" placeholder="Detalla actividades realizadas, insumos utilizados y resultados obtenidos." /></FormField></div>
          <div className="mt-5"><FormField label="Observaciones o incidencias"><textarea rows={3} className="field resize-none" placeholder="Registra desviaciones, pendientes o recomendaciones para administración." /></FormField></div>
          <div className="mt-5"><FormField label="Evidencias y documentos"><input type="file" multiple className="field text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700" /></FormField></div>
        </ActionModal>
      )}
    </>
  );
}

function ModuleView({ active, role, projects, setProjects, supplies, setSupplies, reports, setReports }: { active: string; role: Role; projects: Project[]; setProjects: React.Dispatch<React.SetStateAction<Project[]>>; supplies: Supply[]; setSupplies: React.Dispatch<React.SetStateAction<Supply[]>>; reports: Report[]; setReports: React.Dispatch<React.SetStateAction<Report[]>> }) {
  if (active.includes("proyecto") || active.includes("Proyecto")) return <ProjectView role={role} items={projects} setItems={setProjects} />;
  if (active === "Productos" || active.includes("insumos") || active.includes("Catálogo")) return <ProductsView role={role} items={supplies} setItems={setSupplies} />;
  if (active.includes("Movimientos")) return <MovementsView role={role} />;
  if (active.includes("Solicitudes")) return <RequestsView role={role} />;
  if (active.includes("Técnicos")) return <TechniciansView />;
  return <ReportsView role={role} items={reports} setItems={setReports} />;
}

function Dashboard({ role, onLogout }: { role: Role; onLogout: () => void }) {
  const [active, setActive] = useState("Vista general");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [supplies, setSupplies] = useState(initialSupplies);
  const [reports, setReports] = useState(initialReports);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Informe técnico recibido", detail: "Alejandro Rojas envió un avance de PR-0248.", time: "Hace 12 min", module: "Informes", icon: "report" as IconName, read: false },
    { id: 2, title: "Solicitud pendiente de revisión", detail: "Se solicitó ajustar el stock de R404A.", time: "Hace 38 min", module: "Solicitudes", icon: "clipboard" as IconName, read: false },
    { id: 3, title: "Stock bajo detectado", detail: "Quedan 12 unidades condensadoras de 10 HP.", time: "Hace 2 h", module: "Productos", icon: "box" as IconName, read: false },
    { id: 4, title: "Proyecto próximo a finalizar", detail: "PR-0243 alcanzó un 92% de avance.", time: "Ayer", module: "Proyectos", icon: "folder" as IconName, read: true },
  ]);
  const details = roleDetails[role];
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const workspaceItems = useMemo(() => {
    const productModule = role === "admin" ? "Productos" : role === "warehouse" ? "Catálogo de insumos" : "Insumos asignados";
    const projectModule = role === "technician" ? "Mis proyectos" : "Proyectos";
    const reportModule = role === "technician" ? "Informes enviados" : "Informes";
    const items = [
      ...projects.map((item) => ({ id: item.id, name: item.name, type: "Proyecto", module: projectModule, icon: "folder" as IconName })),
      ...supplies.map((item) => ({ id: item.id, name: item.name, type: "Producto", module: productModule, icon: "box" as IconName })),
      ...[
        ["MOV-3892", "Entrada de refrigerante R404A"],
        ["MOV-3891", "Salida de tubería cobre 7/8”"],
        ["MOV-3888", "Reserva de unidad condensadora 10 HP"],
        ["MOV-3884", "Devolución de panel aislado PIR 100 mm"],
      ].map(([id, name]) => ({ id, name, type: "Movimiento", module: "Movimientos", icon: "trend" as IconName })),
      ...[
        ["SOL-1847", "Ajustar stock de R404A"],
        ["SOL-1845", "Crear insumo: sensor PT100"],
        ["SOL-1842", "Ingreso de 240 kg de R404A"],
        ["SOL-1839", "Actualizar costo compresor 15 HP"],
        ["SOL-1836", "Corregir reserva proyecto PR-0243"],
        ["SOL-1831", "Alta de panel PIR 100 mm"],
      ].map(([id, name]) => ({ id, name, type: "Solicitud", module: role === "warehouse" ? "Solicitudes de edición" : "Solicitudes", icon: "clipboard" as IconName })),
      ...[
        ["TEC-001", "Alejandro Rojas"],
        ["TEC-002", "Matías Soto"],
        ["TEC-003", "Sofía Núñez"],
        ["TEC-004", "Jorge Pérez"],
        ["TEC-005", "Felipe Castro"],
        ["TEC-006", "Laura Pino"],
      ].map(([id, name]) => ({ id, name, type: "Técnico", module: "Técnicos", icon: "user" as IconName })),
      ...reports.map((item) => ({ id: item.id, name: item.name, type: "Informe", module: reportModule, icon: "report" as IconName })),
    ];
    return items;
  }, [projects, supplies, reports, role]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!query) return workspaceItems;
    return workspaceItems.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query));
  }, [searchQuery, workspaceItems]);
  const typeStyles: Record<string, string> = {
    Proyecto: "bg-blue-50 text-blue-700",
    Producto: "bg-cyan-50 text-cyan-700",
    Movimiento: "bg-violet-50 text-violet-700",
    Solicitud: "bg-amber-50 text-amber-700",
    Técnico: "bg-slate-100 text-slate-600",
    Informe: "bg-indigo-50 text-indigo-700",
  };
  const metrics = useMemo(() => {
    if (role === "technician") return [
      ["Refrigerante asignado", "286 kg", "Para 4 proyectos", "archive"],
      ["Tubería de cobre", "184 m", "42 m instalados", "trend"],
      ["Válvulas de expansión", "12 un.", "8 por instalar", "box"],
      ["Evaporadores", "06 un.", "Según ficha técnica", "clipboard"],
    ];
    if (role === "warehouse") return [
      ["Refrigerante R404A", "1.248 kg", "68% disponible", "archive"],
      ["Tubería de cobre", "684 m", "124 m reservados", "trend"],
      ["Válvulas y controles", "96 un.", "7 bajo solicitud", "box"],
      ["Compresores", "18 un.", "5 comprometidos", "chart"],
    ];
    return [
      ["Refrigerante total", "1.248 kg", "18 proyectos", "archive"],
      ["Tubería de cobre", "684 m", "124 m reservados", "trend"],
      ["Unidades condensadoras", "18 un.", "5 comprometidas", "box"],
      ["Kits de control", "32 un.", "86% disponible", "chart"],
    ];
  }, [role]);

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0c2038] px-4 py-6 text-white transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-2"><Logo light sidebar /></div>
        <div className="mt-10 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Espacio de trabajo</div>
        <nav className="mt-3 space-y-1">
          {navByRole[role].map((item) => (
            <button key={item.label} onClick={() => { setActive(item.label); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === item.label ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon name={item.icon} size={18} />
              {item.label}
              {item.label.includes("Solicitudes") && <span className="ml-auto rounded-full bg-blue-400 px-2 py-0.5 text-[10px] font-bold text-blue-950">7</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <Icon name="logout" size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {menuOpen && <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Icon name="menu" /></button>
            <div className="relative hidden md:block">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" size={17} /></span>
              <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)} className="w-80 rounded-xl bg-slate-100 py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/20" placeholder="Buscar en todo el espacio..." />
              {searchQuery && <button onMouseDown={(event) => event.preventDefault()} onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-3 text-lg text-slate-400 hover:text-slate-700" aria-label="Limpiar búsqueda">×</button>}
              {searchOpen && (
                <div className="absolute left-0 top-[calc(100%+0.6rem)] w-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-700">{searchQuery ? "Resultados de búsqueda" : "Todos los elementos"}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{searchResults.length} elementos</span>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {searchResults.length > 0 ? searchResults.map((item) => (
                      <button key={`${item.type}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setActive(item.module); setSearchQuery(""); setSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon name={item.icon} size={17} /></div>
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-700">{item.name}</div><div className="mt-0.5 text-[10px] text-slate-400">{item.id}</div></div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${typeStyles[item.type]}`}>{item.type}</span>
                      </button>
                    )) : (
                      <div className="px-4 py-10 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400"><Icon name="search" size={18} /></div><p className="mt-3 text-sm font-semibold text-slate-700">No encontramos resultados</p><p className="mt-1 text-xs text-slate-400">Prueba buscando otro nombre o código.</p></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {notificationOpen && <button aria-label="Cerrar notificaciones" onClick={() => setNotificationOpen(false)} className="fixed inset-0 z-10 cursor-default" />}
            <div className="relative z-20">
              <button onClick={() => setNotificationOpen((current) => !current)} aria-label={`Notificaciones${unreadNotifications ? `, ${unreadNotifications} sin leer` : ""}`} aria-expanded={notificationOpen} className={`relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 ${notificationOpen ? "bg-slate-100 text-blue-700" : ""}`}>
                <Icon name="bell" size={19} />
                {unreadNotifications > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unreadNotifications}</span>}
              </button>
              {notificationOpen && (
                <section className="absolute right-0 top-[calc(100%+0.65rem)] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div><h2 className="font-semibold text-slate-900">Notificaciones</h2><p className="mt-0.5 text-[11px] text-slate-400">{unreadNotifications ? `${unreadNotifications} pendientes de revisar` : "Todo está al día"}</p></div>
                    {unreadNotifications > 0 && <button onClick={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))} className="text-xs font-semibold text-blue-700">Marcar todas como leídas</button>}
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {notifications.map((notification) => (
                      <button key={notification.id} onClick={() => { setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item)); setActive(notification.module); setNotificationOpen(false); }} className={`flex w-full gap-3 rounded-xl p-3 text-left hover:bg-slate-50 ${notification.read ? "" : "bg-blue-50/70"}`}>
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${notification.read ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-700"}`}><Icon name={notification.icon} size={16} /></div>
                        <div className="min-w-0 flex-1"><div className="flex items-start gap-2"><h3 className="flex-1 text-sm font-semibold text-slate-800">{notification.title}</h3>{!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}</div><p className="mt-1 text-xs leading-5 text-slate-500">{notification.detail}</p><span className="mt-1.5 block text-[10px] font-medium text-slate-400">{notification.time}</span></div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{details.initials}</div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">{details.name}</div>
                <div className="text-[11px] text-slate-500">{details.label}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
          {active === "Vista general" ? (
          <>
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-700">Martes, 18 de junio</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Buenos días, {details.name.split(" ")[0]}</h1>
              <p className="mt-2 text-sm text-slate-500">{details.description}.</p>
            </div>
            <button onClick={() => setActive(role === "technician" ? "Informes enviados" : role === "warehouse" ? "Solicitudes de edición" : "Proyectos")} className="flex items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 sm:self-auto">
              <Icon name="plus" size={17} />
              {role === "technician" ? "Enviar informe" : role === "warehouse" ? "Solicitar edición" : "Nuevo proyecto"}
            </button>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([label, value, note, icon], index) => (
              <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30">
                <div className="flex items-start justify-between">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${index === 1 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                    <Icon name={icon as IconName} size={19} />
                  </div>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">{label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">{value}</span>
                  <span className={`mb-1 text-[11px] font-semibold ${index === 1 ? "text-amber-700" : "text-blue-700"}`}>{note}</span>
                </div>
              </article>
            ))}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="font-semibold text-slate-900">{role === "technician" ? "Proyectos asignados" : "Proyectos recientes"}</h2>
                  <p className="mt-1 text-xs text-slate-500">Estado y avance de operaciones activas</p>
                </div>
                <button className="flex items-center gap-1 text-xs font-semibold text-blue-700">Ver todos <Icon name="arrow" size={14} /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[660px] text-left">
                  <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr><th className="px-6 py-3">Proyecto</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Avance</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Entrega</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[
                      ["PR-0248", "Cámara de frío — Planta Frutícola Norte", "AR", "68%", "En ejecución", "24 Jun", "green"],
                      ["PR-0243", "Túnel de congelado — Centro de Proceso", "CV", "92%", "Por finalizar", "19 Jun", "blue"],
                      ["PR-0239", "Sala de packing refrigerada — Agrícola Sur", "MS", "35%", "En revisión", "28 Jun", "amber"],
                      ["PR-0236", "Sistema de amoníaco — Bodega Central", "JP", "100%", "Completado", "14 Jun", "slate"],
                    ].map(([id, project, owner, progress, status, date, tone]) => (
                      <tr key={id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4"><div className="font-semibold text-slate-800">{project}</div><div className="mt-1 text-[11px] text-slate-400">{id}</div></td>
                        <td className="px-4 py-4"><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{owner}</div></td>
                        <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: progress }} /></div><span className="text-xs font-semibold text-slate-600">{progress}</span></div></td>
                        <td className="px-4 py-4"><StatusBadge tone={tone as "green" | "amber" | "slate" | "blue"}>{status}</StatusBadge></td>
                        <td className="px-4 py-4 text-xs font-medium text-slate-500">{date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{role === "technician" ? "Próximas tareas" : "Actividad reciente"}</h2>
                  <p className="mt-1 text-xs text-slate-500">Últimos movimientos del equipo</p>
                </div>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Icon name="settings" size={17} /></button>
              </div>
              <div className="mt-6 space-y-5">
                {[
                  ["check", "Edición de insumo aprobada", "Solicitud #SOL-1842", "Hace 12 min", "green"],
                  ["box", "Refrigerante ingresado", "R404A · +240 kg", "Hace 38 min", "blue"],
                  ["user", "Técnico asignado a proyecto", "Alejandro R. · PR-0248", "Hace 1 h", "amber"],
                  ["report", "Informe técnico recibido", "Proyecto PR-0243", "Hace 3 h", "slate"],
                ].map(([icon, title, detail, time, tone]) => (
                  <div key={title} className="flex gap-3">
                    <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "green" ? "bg-blue-50 text-blue-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "blue" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      <Icon name={icon as IconName} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700">{title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">{time}</span>
                  </div>
                ))}
              </div>
              <button className="mt-6 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Ver historial completo</button>
            </section>
          </div>
          </>
          ) : (
            <ModuleView active={active} role={role} projects={projects} setProjects={setProjects} supplies={supplies} setSupplies={setSupplies} reports={reports} setReports={setReports} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Role | null>(null);
  return session ? <Dashboard role={session} onLogout={() => setSession(null)} /> : <Login onLogin={setSession} />;
}
