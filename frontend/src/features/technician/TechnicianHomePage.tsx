import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  MapPin,
  Package,
  Phone,
  Plus,
  Send,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { EstadoBadge, SemaforoBadge, type Semaforo } from "@/components/shared/EstadoBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { SyncStatusChip } from "@/components/shared/OfflineBanner";
import type { Project } from "@/core/types";
import { PRODUCTS, PROJECTS, USERS } from "@/data/mock";

/**
 * Fecha actual simulada en el sistema para cómputo de plazos:
 * 12 de Octubre de 2026, 22:47 hrs.
 */
const SYSTEM_NOW = new Date("2026-10-12T22:47:27").getTime();

interface DeadlineInfo {
  nivel: Semaforo;
  label: string;
  sublabel: string;
  isUrgent: boolean;
  hoursLeft: number;
}

/**
 * Calcula el semáforo de plazo según los requerimientos:
 * - Rojo: <= 48 horas restantes o ya vencido
 * - Amarillo: <= 5 días restantes (y > 48 horas)
 * - Verde: > 5 días restantes
 */
function getDeadlineStatus(deadlineStr: string): DeadlineInfo {
  const deadlineTime = new Date(deadlineStr).getTime();
  const diffMs = deadlineTime - SYSTEM_NOW;
  const hoursLeft = diffMs / (1000 * 60 * 60);
  const daysLeft = hoursLeft / 24;

  if (hoursLeft <= 0) {
    const daysOver = Math.abs(Math.round(daysLeft));
    return {
      nivel: "rojo",
      label: "¡Vencido!",
      sublabel: daysOver === 0 ? "Venció hoy" : `Vencido hace ${daysOver} d`,
      isUrgent: true,
      hoursLeft,
    };
  }

  if (hoursLeft <= 48) {
    const h = Math.round(hoursLeft);
    return {
      nivel: "rojo",
      label: `Vence en ${h} h`,
      sublabel: `Plazo crítico (≤ 48 hrs)`,
      isUrgent: true,
      hoursLeft,
    };
  }

  if (daysLeft <= 5) {
    const d = Math.ceil(daysLeft);
    return {
      nivel: "amarillo",
      label: `Vence en ${d} días`,
      sublabel: `Próximo a vencer (≤ 5 días)`,
      isUrgent: false,
      hoursLeft,
    };
  }

  const d = Math.ceil(daysLeft);
  return {
    nivel: "verde",
    label: `Faltan ${d} días`,
    sublabel: `Plazo en orden`,
    isUrgent: false,
    hoursLeft,
  };
}

export function TechnicianHomePage() {
  const toast = useToast();

  // Filtrar proyectos asignados al técnico actual Y EXCLUIR PROYECTOS CERRADOS/FINALIZADOS
  const initialProjects = useMemo(() => {
    return PROJECTS.filter(
      (p) =>
        p.technicianRuts.includes(USERS.technician.rut) &&
        p.status !== "finalizado" &&
        p.status !== "cerrado" &&
        p.status !== "pausado", // sin proyectos cerrados
    );
  }, []);

  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects);

  // Estados para modales
  const [requestModalProject, setRequestModalProject] = useState<Project | null>(null);
  const [selectedSku, setSelectedSku] = useState(PRODUCTS[0].sku);
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<"normal" | "alta" | "urgente">("alta");
  const [requestComment, setRequestComment] = useState("");

  const [progressModalProject, setProgressModalProject] = useState<Project | null>(null);
  const [newProgress, setNewProgress] = useState(0);
  const [progressNote, setProgressNote] = useState("");

  // Manejo de solicitud de insumos
  const handleSendRequest = () => {
    if (!requestModalProject) return;
    const prod = PRODUCTS.find((p) => p.sku === selectedSku);
    toast({
      tone: "ok",
      title: "Solicitud enviada a Bodega",
      description: `Pedido de ${quantity}x ${prod?.name ?? "Insumo"} para ${requestModalProject.name}.`,
    });
    setRequestModalProject(null);
    setQuantity(1);
    setRequestComment("");
  };

  // Manejo de actualización de avance
  const handleSaveProgress = () => {
    if (!progressModalProject) return;
    setProjectsList((prev) =>
      prev.map((p) => (p.id === progressModalProject.id ? { ...p, progress: newProgress } : p)),
    );
    toast({
      tone: "ok",
      title: "Avance actualizado",
      description: `Se registró ${newProgress}% de avance en ${progressModalProject.code}.`,
    });
    setProgressModalProject(null);
    setProgressNote("");
  };

  return (
    <div className="space-y-6">
      {/* ─── ENCABEZADO MOBILE-FIRST ─── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-h2 font-bold tracking-tight text-ink-900">
              Mis Proyectos en Terreno
            </h1>
            <SyncStatusChip status="sincronizado" />
          </div>
          <p className="mt-0.5 text-body-sm text-ink-500">
            {projectsList.length} obras activas asignadas · Semáforo de plazos en vivo
          </p>
        </div>

        {/* Resumen de semáforo */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-xl bg-danger-soft px-2.5 py-1 text-caption font-bold text-danger">
            <span className="size-2 rounded-full bg-danger animate-pulse" />
            {projectsList.filter((p) => getDeadlineStatus(p.deadline).nivel === "rojo").length} urgentes (≤48h)
          </span>
          <span className="flex items-center gap-1 rounded-xl bg-warn-soft px-2.5 py-1 text-caption font-bold text-warn">
            <span className="size-2 rounded-full bg-warn" />
            {projectsList.filter((p) => getDeadlineStatus(p.deadline).nivel === "amarillo").length} por vencer (≤5d)
          </span>
        </div>
      </div>

      {/* ─── LISTA DE TARJETAS DE PROYECTO ─── */}
      <div className="space-y-4" role="feed" aria-label="Tarjetas de obras y mantenciones activas">
        {projectsList.length === 0 ? (
          <Card className="p-8 text-center text-body-sm text-ink-500">
            No tienes obras pendientes asignadas actualmente.
          </Card>
        ) : (
          projectsList.map((p) => {
            const dl = getDeadlineStatus(p.deadline);
            const isRed = dl.nivel === "rojo";
            const isYellow = dl.nivel === "amarillo";

            const borderHighlight = isRed
              ? "border-danger-line shadow-(--shadow-card) bg-danger-soft/10"
              : isYellow
                ? "border-warn-line/80 shadow-(--shadow-card) bg-warn-soft/10"
                : "border-ink-200 bg-white shadow-(--shadow-card)";

            return (
              <Card
                key={p.id}
                className={`overflow-hidden border-2 p-5 transition active:scale-[0.99] ${borderHighlight}`}
              >
                {/* Cabecera de la tarjeta: Código, Tipo y Semáforo de Plazo */}
                <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-body-sm font-bold text-ink-900">
                      {p.code}
                    </span>
                    <Badge tone={p.kind === "obra" ? "info" : "mute"}>
                      {p.kind === "obra" ? "Obra" : "Mantención"}
                    </Badge>
                  </div>

                  {/* SEMÁFORO DE PLAZO DESTACADO */}
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-caption font-bold shadow-sm ${
                        isRed
                          ? "bg-danger text-white animate-pulse"
                          : isYellow
                            ? "bg-warn text-white"
                            : "bg-ok text-white"
                      }`}
                    >
                      <Clock size={14} />
                      <span>{dl.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-ink-500">
                      {dl.sublabel}
                    </p>
                  </div>
                </div>

                {/* Cuerpo de la tarjeta: Título, Cliente, Dirección */}
                <div className="pt-3">
                  <h2 className="text-body-lg font-bold leading-snug text-ink-900">
                    {p.name}
                  </h2>
                  <p className="mt-1 text-body-sm text-ink-500">
                    Cliente: <strong className="text-ink-700">{p.client}</strong>
                  </p>

                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(p.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 inline-flex items-start gap-1.5 text-body-sm text-brand-700 hover:underline"
                  >
                    <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{p.address}</span>
                  </a>

                  {/* Barra de progreso de obra */}
                  <div className="mt-4">
                    <ProgressBar
                      label="Avance de obra"
                      value={p.progress}
                      tone={p.progress >= 70 ? "ok" : p.progress >= 40 ? "brand" : "warn"}
                      showValue={true}
                    />
                  </div>
                </div>

                {/* Acciones táctiles para celular (mínimo 44px de alto táctil) */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-ink-100 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRequestModalProject(p);
                    }}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl"
                  >
                    <Package size={18} />
                    <span>Pedir insumos</span>
                  </Button>

                  <Button
                    onClick={() => {
                      setProgressModalProject(p);
                      setNewProgress(p.progress);
                    }}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl"
                  >
                    <FileText size={18} />
                    <span>Registrar avance</span>
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ─── MODAL PEDIR INSUMOS DESDE TERRENO ─── */}
      {requestModalProject && (
        <Modal
          open={Boolean(requestModalProject)}
          onClose={() => setRequestModalProject(null)}
          title={`Pedir Insumos para ${requestModalProject.code}`}
          description={`Solicitud de despacho para ${requestModalProject.name}`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setRequestModalProject(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSendRequest}>
                <Send size={16} />
                <span>Enviar a bodega</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="sku-select" className="mb-1 block text-body-sm font-semibold text-ink-900">
                Seleccionar insumo del catálogo:
              </label>
              <select
                id="sku-select"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white p-3 text-body-sm font-medium text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {PRODUCTS.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name} ({p.unit}) · Disp: {p.stock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qty-input" className="mb-1 block text-body-sm font-semibold text-ink-900">
                  Cantidad requerida:
                </label>
                <input
                  id="qty-input"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-xl border border-ink-200 p-3 text-body-sm font-bold tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="urgency-select" className="mb-1 block text-body-sm font-semibold text-ink-900">
                  Nivel de urgencia:
                </label>
                <select
                  id="urgency-select"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as "normal" | "alta" | "urgente")}
                  className="w-full rounded-xl border border-ink-200 bg-white p-3 text-body-sm font-medium text-ink-900 focus:border-brand-600 focus:outline-none"
                >
                  <option value="normal">Normal (24-48 hrs)</option>
                  <option value="alta">Alta (Mismo día)</option>
                  <option value="urgente">Urgente (Inmediato)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="comment-input" className="mb-1 block text-body-sm font-semibold text-ink-900">
                Observación / Piso o sector de aplicación:
              </label>
              <textarea
                id="comment-input"
                rows={2}
                value={requestComment}
                onChange={(e) => setRequestComment(e.target.value)}
                placeholder="Ej: Material necesario para terminar cableado sala de tableros piso 3."
                className="w-full rounded-xl border border-ink-200 p-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL REGISTRAR AVANCE DE OBRA ─── */}
      {progressModalProject && (
        <Modal
          open={Boolean(progressModalProject)}
          onClose={() => setProgressModalProject(null)}
          title={`Registrar Avance: ${progressModalProject.code}`}
          description={`Actualiza el progreso en terreno de ${progressModalProject.name}`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setProgressModalProject(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProgress}>
                <CheckCircle2 size={16} />
                <span>Guardar avance</span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="progress-slider" className="text-body-sm font-semibold text-ink-900">
                  Porcentaje de avance completado:
                </label>
                <span className="text-h3 font-bold tabular-nums text-brand-600">
                  {newProgress} %
                </span>
              </div>
              <input
                id="progress-slider"
                type="range"
                min={0}
                max={100}
                step={5}
                value={newProgress}
                onChange={(e) => setNewProgress(Number(e.target.value))}
                className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-ink-200 accent-brand-600"
              />
              <div className="mt-1 flex justify-between text-caption text-ink-500">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label htmlFor="progress-notes" className="mb-1 block text-body-sm font-semibold text-ink-900">
                Bitácora / Notas de la jornada en terreno:
              </label>
              <textarea
                id="progress-notes"
                rows={3}
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="Ej: Se finalizó el tendido de tuberías en ala norte. Pendiente conexión de tableros."
                className="w-full rounded-xl border border-ink-200 p-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
