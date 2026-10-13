import { Plus, ScanLine, Trash2, X } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STATUSES, type StatusKey, type Tone } from "@/core/status";

/* ───── utilidades de contraste (WCAG 2.1) ───── */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BRAND = [
  ["50", "#eff5ff"], ["100", "#dbe7ff"], ["200", "#bdd0ff"], ["500", "#3b6cf0"],
  ["600", "#2450c8"], ["700", "#1d41a3"], ["900", "#14275f"],
] as const;

const NEUTRALS = [
  ["ink-900", "#0f172a"], ["ink-700", "#334155"], ["ink-500", "#505d70"],
  ["ink-300", "#cbd5e1"], ["ink-200", "#dfe5ee"], ["ink-100", "#f1f5f9"], ["canvas", "#f4f7fb"],
] as const;

const SEMANTIC: { name: string; tone: Tone; role: string; fg: string; bg: string }[] = [
  { name: "Éxito", tone: "ok", role: "Aprobada · Conforme · Activo", fg: "#14602f", bg: "#dcf5e4" },
  { name: "Advertencia", tone: "warn", role: "Pendiente", fg: "#8a3c06", bg: "#fdf0c8" },
  { name: "Peligro", tone: "danger", role: "Rechazada · Defectuoso · Vencido", fg: "#a91b1b", bg: "#fde4e4" },
  { name: "Azul (tránsito)", tone: "transit", role: "En tránsito", fg: "#1a43b0", bg: "#dde8ff" },
  { name: "Info (celeste)", tone: "info", role: "Planificado", fg: "#045a83", bg: "#def2fd" },
  { name: "Gris", tone: "mute", role: "Cerrado · Anulada", fg: "#374151", bg: "#e8ebf0" },
];

const TYPE_SCALE = [
  ["text-display", "Display · 32 px", "Control de inventario"],
  ["text-h1", "H1 · 24 px", "Proyectos de obra y mantención"],
  ["text-h2", "H2 · 20 px", "Solicitudes de bodega"],
  ["text-h3", "H3 · 17 px", "Edificio Los Aromos – Instalación eléctrica"],
  ["text-body", "Cuerpo · 16 px", "Se entregaron 12 disyuntores a la obra OB-2026-014."],
  ["text-body-sm", "Cuerpo pequeño · 14 px", "Cable THHN 12 AWG rollo 100 m · SKU ELE-CBL-0012"],
  ["text-label", "Etiqueta · 13 px", "RUT del técnico"],
  ["text-caption", "Nota · 12 px", "Última sincronización: hoy 21:48"],
] as const;

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b border-ink-200 pb-2 text-h2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function FoundationsTab() {
  return (
    <div>

      <Section title="Paleta">
        <h3 className="mb-2 text-h3 font-semibold">Primario · azul profesional</h3>
        <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-7">
          {BRAND.map(([n, hex]) => (
            <div key={n}>
              <div className="h-14 rounded-xl border border-ink-200" style={{ background: hex }} />
              <p className="mt-1 text-label font-semibold">brand-{n}</p>
              <p className="font-mono text-caption text-ink-500">{hex}</p>
            </div>
          ))}
        </div>
        <h3 className="mb-2 text-h3 font-semibold">Neutros · grises</h3>
        <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-7">
          {NEUTRALS.map(([n, hex]) => (
            <div key={n}>
              <div className="h-14 rounded-xl border border-ink-200" style={{ background: hex }} />
              <p className="mt-1 text-label font-semibold">{n}</p>
              <p className="font-mono text-caption text-ink-500">{hex}</p>
            </div>
          ))}
        </div>
        <h3 className="mb-2 text-h3 font-semibold">Semánticos (texto sobre fondo suave)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEMANTIC.map((s) => {
            const r = ratio(s.fg, s.bg);
            return (
              <Card key={s.name} className="overflow-hidden">
                <div className="p-4" style={{ background: s.bg, color: s.fg }}>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-body-sm">{s.role}</p>
                </div>
                <p className="flex justify-between px-4 py-2 text-caption text-ink-500">
                  <span className="font-mono">{s.fg} / {s.bg}</span>
                  <span className="font-semibold text-ok">{r.toFixed(1)}:1 {r >= 7 ? "AAA" : "AA"}</span>
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Tipografía · Inter">
        <Card className="divide-y divide-ink-100">
          {TYPE_SCALE.map(([cls, name, sample]) => (
            <div key={cls} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr] sm:items-baseline">
              <div>
                <p className="text-label font-semibold">{name}</p>
                <p className="font-mono text-caption text-ink-500">{cls}</p>
              </div>
              <p className={`${cls} ${cls.match(/display|h1|h2|h3/) ? "font-bold" : ""}`}>{sample}</p>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Estados · siempre color + ícono + texto">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(STATUSES) as StatusKey[]).map((k) => (
            <Card key={k} className="flex items-center justify-between p-4">
              <StatusBadge status={k} />
              <span className="font-mono text-caption text-ink-500">{k}</span>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-body-sm text-ink-500">
          Para valores que no son estados de flujo existe <code className="font-mono">Badge</code>:{" "}
          <Badge tone="ok">Stock normal</Badge> <Badge tone="warn">Stock bajo</Badge> <Badge tone="danger">Sin stock</Badge>
        </p>
      </Section>

      <Section title="Botones · mínimo 44 px en tablet y celular">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={<Plus size={18} />}>Nuevo proyecto</Button>
            <Button variant="secondary">Cancelar</Button>
            <Button variant="ghost">Ver detalle</Button>
            <Button variant="danger" icon={<Trash2 size={18} />}>Anular</Button>
            <Button disabled>Deshabilitado</Button>
            <Button loading loadingText="Guardando…">Guardar</Button>
            <IconButton label="Cerrar"><X size={20} /></IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" icon={<ScanLine size={22} />}>Escanear (56 px · tablet)</Button>
            <Button size="xl" fullWidth className="sm:w-auto">Enviar informe (64 px · celular)</Button>
          </div>
        </Card>
      </Section>

    </div>
  );
}
