import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Filter,
  FolderKanban,
  HardHat,
  Info,
  Lock,
  Package,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatCLP, formatDate, formatNumber } from "@/core/format";
import type {
  Client,
  MaterialRequest,
  Project,
  ProjectKind,
  ProjectLaborEntry,
  ProjectMaterialDispatch,
  ProjectStatus,
  ProjectWasteEntry,
  ReturnOrder,
  Technician,
} from "@/core/types";
import {
  CLIENTS,
  MATERIAL_REQUESTS,
  PROJECTS,
  RETURN_ORDERS,
  TECHNICIANS,
} from "@/data/mock";

// Helper para calcular semáforo de costo
function getCostSemaforo(budget: number, costReal: number) {
  if (budget <= 0) return { nivel: "verde" as const, ratio: 0, pct: 0, label: "0%" };
  const ratio = costReal / budget;
  const pct = Math.round(ratio * 100);
  if (ratio > 1.0) {
    return { nivel: "rojo" as const, ratio, pct, label: `Sobrecosto (${pct}%)` };
  }
  if (ratio >= 0.8) {
    return { nivel: "amarillo" as const, ratio, pct, label: `Alerta (${pct}%)` };
  }
  return { nivel: "verde" as const, ratio, pct, label: `En orden (${pct}%)` };
}

export function ProjectsPage() {
  const { user } = useAuth();
  const toast = useToast();

  // Estados principales de proyectos y entidades relacionadas
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [requests, setRequests] = useState<MaterialRequest[]>(MATERIAL_REQUESTS);
  const [returns, setReturns] = useState<ReturnOrder[]>(RETURN_ORDERS);
  const [technicians] = useState<Technician[]>(TECHNICIANS);
  const [clients] = useState<Client[]>(CLIENTS);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "activo" | "planificado" | "cerrado">("todos");
  const [kindFilter, setKindFilter] = useState<"todos" | ProjectKind>("todos");
  const [costFilter, setCostFilter] = useState<"todos" | "verde" | "amarillo" | "rojo">("todos");

  // Proyecto seleccionado para ver Detalle con Pestañas
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<"resumen" | "tecnicos" | "insumos" | "horas" | "rentabilidad">("resumen");

  // Modal de Crear / Editar
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formKind, setFormKind] = useState<ProjectKind>("obra");
  const [formStartDate, setFormStartDate] = useState("2026-10-15");
  const [formDeadline, setFormDeadline] = useState("2026-11-30");
  const [formBudgetMaterials, setFormBudgetMaterials] = useState(10000000);
  const [formBudgetHours, setFormBudgetHours] = useState(250);
  const [formHourlyRate, setFormHourlyRate] = useState(18500);
  const [formSaleValue, setFormSaleValue] = useState(22000000);
  const [formStatus, setFormStatus] = useState<"planificado" | "activo" | "cerrado">("planificado");

  // Modal de Asignar Técnico (dentro de Detalle)
  const [selectedTechToAssign, setSelectedTechToAssign] = useState<string>("");

  // Modal de Cierre de Proyecto
  const [closingProject, setClosingProject] = useState<Project | null>(null);

  // Formulario de Imputar Horas (dentro de Detalle)
  const [laborTechRut, setLaborTechRut] = useState(technicians[0]?.rut || "");
  const [laborHours, setLaborHours] = useState(8);
  const [laborDesc, setLaborDesc] = useState("");

  // ─── FILTRADO DE PROYECTOS ───
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Estado normalizado
      const normStatus: "activo" | "planificado" | "cerrado" =
        p.status === "cerrado" || p.status === "finalizado"
          ? "cerrado"
          : p.status === "planificado"
          ? "planificado"
          : "activo";

      if (statusFilter !== "todos" && normStatus !== statusFilter) return false;
      if (kindFilter !== "todos" && p.kind !== kindFilter) return false;

      const semaforo = getCostSemaforo(p.budget, p.costReal);
      if (costFilter !== "todos" && semaforo.nivel !== costFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = p.code.toLowerCase().includes(q);
        const matchName = p.name.toLowerCase().includes(q);
        const matchClient = p.client.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchClient) return false;
      }

      return true;
    });
  }, [projects, statusFilter, kindFilter, costFilter, search]);

  // ─── KPIs SUPERIORES ───
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "activo" || p.status === "en_curso").length;
    const red = projects.filter((p) => {
      const s = getCostSemaforo(p.budget, p.costReal);
      return s.nivel === "rojo";
    }).length;
    const totalBudget = projects.reduce((acc, p) => acc + p.budget, 0);
    const totalCost = projects.reduce((acc, p) => acc + p.costReal, 0);
    const totalSale = projects.reduce((acc, p) => acc + p.saleValue, 0);

    return { total, active, red, totalBudget, totalCost, totalSale };
  }, [projects]);

  // ─── ABRIR FORMULARIO CREAR ───
  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormName("");
    setFormClient(clients[0]?.businessName || "");
    setFormKind("obra");
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormDeadline(new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10));
    setFormBudgetMaterials(12000000);
    setFormBudgetHours(300);
    setFormHourlyRate(18500);
    setFormSaleValue(25000000);
    setFormStatus("planificado");
    setFormModalOpen(true);
  };

  // ─── ABRIR FORMULARIO EDITAR ───
  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setFormName(p.name);
    setFormClient(p.client);
    setFormKind(p.kind);
    setFormStartDate(p.startDate.slice(0, 10));
    setFormDeadline(p.deadline.slice(0, 10));
    setFormBudgetMaterials(p.budgetMaterials || Math.round(p.budget * 0.6));
    setFormBudgetHours(p.budgetHours || Math.round((p.budget * 0.4) / 18500));
    setFormHourlyRate(p.hourlyRate || 18500);
    setFormSaleValue(p.saleValue || Math.round(p.budget * 1.35));
    const currentNorm =
      p.status === "cerrado" || p.status === "finalizado"
        ? "cerrado"
        : p.status === "planificado"
        ? "planificado"
        : "activo";
    setFormStatus(currentNorm);
    setFormModalOpen(true);
  };

  // ─── GUARDAR PROYECTO ───
  const handleSaveProject = () => {
    if (!formName.trim() || !formClient.trim()) {
      toast({
        tone: "warn",
        title: "Campos incompletos",
        description: "Por favor indica el nombre de la obra y el cliente.",
      });
      return;
    }

    const calculatedHoursBudget = formBudgetHours * formHourlyRate;
    const totalCalculatedBudget = formBudgetMaterials + calculatedHoursBudget;

    if (editingProject) {
      // Bloqueo de edición si está cerrado
      if (editingProject.status === "cerrado" || editingProject.status === "finalizado") {
        toast({
          tone: "danger",
          title: "Acción bloqueada",
          description: "Un proyecto cerrado no puede ser modificado.",
        });
        return;
      }

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === editingProject.id) {
            const updated: Project = {
              ...p,
              name: formName.trim(),
              client: formClient.trim(),
              kind: formKind,
              startDate: formStartDate,
              deadline: formDeadline,
              budgetMaterials: formBudgetMaterials,
              budgetHours: formBudgetHours,
              hourlyRate: formHourlyRate,
              saleValue: formSaleValue,
              budget: totalCalculatedBudget,
              status: formStatus,
            };
            if (detailProject && detailProject.id === p.id) {
              setDetailProject(updated);
            }
            return updated;
          }
          return p;
        }),
      );

      toast({
        tone: "ok",
        title: "Proyecto actualizado",
        description: `Los datos del proyecto ${editingProject.code} han sido actualizados.`,
      });
    } else {
      // Crear nuevo proyecto
      const newId = `p${Date.now()}`;
      const prefix = formKind === "obra" ? "OB" : "MT";
      const year = new Date().getFullYear();
      const code = `${prefix}-${year}-${String(projects.length + 1).padStart(3, "0")}`;

      const newProj: Project = {
        id: newId,
        code,
        name: formName.trim(),
        client: formClient.trim(),
        kind: formKind,
        status: formStatus,
        address: "Por definir en terreno",
        progress: 0,
        technicianRuts: [],
        budgetMaterials: formBudgetMaterials,
        budgetHours: formBudgetHours,
        hourlyRate: formHourlyRate,
        saleValue: formSaleValue,
        budget: totalCalculatedBudget,
        costReal: 0,
        costRealMaterials: 0,
        costRealHours: 0,
        costRealWaste: 0,
        hoursReal: 0,
        startDate: formStartDate,
        deadline: formDeadline,
        dispatches: [],
        laborEntries: [],
        wasteEntries: [],
      };

      setProjects((prev) => [newProj, ...prev]);

      toast({
        tone: "ok",
        title: "Proyecto creado exitosamente",
        description: `Se registró ${code} con presupuesto total de ${formatCLP(totalCalculatedBudget)}.`,
      });
    }

    setFormModalOpen(false);
  };

  // ─── ABRIR DETALLE ───
  const handleOpenDetail = (p: Project, initialTab?: "resumen" | "tecnicos" | "insumos" | "horas" | "rentabilidad") => {
    setDetailProject(p);
    setDetailTab(initialTab || "resumen");
  };

  // ─── TÉCNICOS: ASIGNAR Y DESASIGNAR (SIN DUPLICADOS) ───
  const handleAssignTechnician = () => {
    if (!detailProject || !selectedTechToAssign) return;

    if (detailProject.status === "cerrado" || detailProject.status === "finalizado") {
      toast({ tone: "warn", title: "Proyecto cerrado", description: "No se pueden asignar técnicos a un proyecto cerrado." });
      return;
    }

    if (detailProject.technicianRuts.includes(selectedTechToAssign)) {
      toast({ tone: "warn", title: "Técnico ya asignado", description: "Este técnico ya forma parte de la obra." });
      return;
    }

    const techObj = technicians.find((t) => t.rut === selectedTechToAssign);
    const updatedRuts = [...detailProject.technicianRuts, selectedTechToAssign];

    setProjects((prev) =>
      prev.map((p) => (p.id === detailProject.id ? { ...p, technicianRuts: updatedRuts } : p)),
    );
    setDetailProject((prev) => (prev ? { ...prev, technicianRuts: updatedRuts } : null));
    setSelectedTechToAssign("");

    toast({
      tone: "ok",
      title: "Técnico asignado",
      description: `${techObj?.name || "Técnico"} fue incorporado al proyecto ${detailProject.code}.`,
    });
  };

  const handleUnassignTechnician = (rut: string) => {
    if (!detailProject) return;

    if (detailProject.status === "cerrado" || detailProject.status === "finalizado") {
      toast({ tone: "warn", title: "Proyecto cerrado", description: "No se pueden modificar técnicos de un proyecto cerrado." });
      return;
    }

    const techObj = technicians.find((t) => t.rut === rut);
    const updatedRuts = detailProject.technicianRuts.filter((r) => r !== rut);

    setProjects((prev) =>
      prev.map((p) => (p.id === detailProject.id ? { ...p, technicianRuts: updatedRuts } : p)),
    );
    setDetailProject((prev) => (prev ? { ...prev, technicianRuts: updatedRuts } : null));

    toast({
      tone: "info",
      title: "Técnico desasignado",
      description: `${techObj?.name || "Técnico"} fue removido del proyecto.`,
    });
  };

  // ─── HORAS: REGISTRAR JORNADA ───
  const handleAddLabor = () => {
    if (!detailProject || laborHours <= 0) return;

    if (detailProject.status === "cerrado" || detailProject.status === "finalizado") {
      toast({ tone: "warn", title: "Proyecto cerrado", description: "No se pueden imputar horas a un proyecto cerrado." });
      return;
    }

    const techObj = technicians.find((t) => t.rut === laborTechRut);
    const hourlyCost = detailProject.hourlyRate || 18500;
    const subtotal = laborHours * hourlyCost;

    const newEntry: ProjectLaborEntry = {
      id: `hh_${Date.now()}`,
      date: new Date().toLocaleDateString("es-CL"),
      technicianRut: laborTechRut,
      technicianName: techObj?.name || "Técnico Especialista",
      hours: laborHours,
      hourlyCost,
      totalCost: subtotal,
      description: laborDesc.trim() || "Jornada de avance en terreno",
    };

    const updatedLabor = [newEntry, ...(detailProject.laborEntries || [])];
    const newHoursReal = (detailProject.hoursReal || 0) + laborHours;
    const newCostRealHours = (detailProject.costRealHours || 0) + subtotal;
    const newCostReal = detailProject.costReal + subtotal;

    const updatedProj: Project = {
      ...detailProject,
      laborEntries: updatedLabor,
      hoursReal: newHoursReal,
      costRealHours: newCostRealHours,
      costReal: newCostReal,
    };

    setProjects((prev) => prev.map((p) => (p.id === detailProject.id ? updatedProj : p)));
    setDetailProject(updatedProj);
    setLaborDesc("");

    toast({
      tone: "ok",
      title: "Jornada registrada",
      description: `Se imputaron ${laborHours} horas (${formatCLP(subtotal)}) a ${detailProject.code}.`,
    });
  };

  // ─── MODAL DE CIERRE Y DETECCIÓN DE BLOQUEOS ───
  const handleOpenCloseModal = (p: Project) => {
    setClosingProject(p);
  };

  // Analizar bloqueos para el proyecto a cerrar
  const closingBlockers = useMemo(() => {
    if (!closingProject) return { pendingRequests: [], inTransitReturns: [], hasBlockers: false };

    // 1. Solicitudes de material pendientes o aprobadas pendientes de egreso
    const pendingReqs = requests.filter(
      (r) =>
        (r.projectId === closingProject.id || r.projectCode === closingProject.code) &&
        (r.status === "pendiente" || r.status === "aprobada"),
    );

    // 2. Devoluciones o materiales en tránsito
    const inTransit = returns.filter(
      (ret) =>
        (ret.projectCode === closingProject.code || ret.projectName.includes(closingProject.name)) &&
        ret.status === "en_transito",
    );

    return {
      pendingRequests: pendingReqs,
      inTransitReturns: inTransit,
      hasBlockers: pendingReqs.length > 0 || inTransit.length > 0,
    };
  }, [closingProject, requests, returns]);

  // Simulación de resolución de bloqueos
  const handleResolveAllBlockers = () => {
    if (!closingProject) return;

    // Marcar solicitudes como entregadas/rechazadas
    setRequests((prev) =>
      prev.map((r) => {
        if (r.projectId === closingProject.id || r.projectCode === closingProject.code) {
          return { ...r, status: "entregada" as const };
        }
        return r;
      }),
    );

    // Marcar devoluciones como recibidas en bodega
    setReturns((prev) =>
      prev.map((ret) => {
        if (ret.projectCode === closingProject.code || ret.projectName.includes(closingProject.name)) {
          return { ...ret, status: "recibida" as const };
        }
        return ret;
      }),
    );

    toast({
      tone: "ok",
      title: "Bloqueos resueltos",
      description: "Las solicitudes y despachos en tránsito fueron completados.",
    });
  };

  // Confirmar Cierre Oficial del Proyecto
  const handleConfirmCloseProject = () => {
    if (!closingProject || closingBlockers.hasBlockers) return;

    const closedDate = new Date().toLocaleDateString("es-CL") + " " + new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const userName = user?.name || "Administrador FYAG";

    const updatedProj: Project = {
      ...closingProject,
      status: "cerrado",
      progress: 100,
      closedAt: closedDate,
      closedBy: userName,
    };

    setProjects((prev) => prev.map((p) => (p.id === closingProject.id ? updatedProj : p)));
    if (detailProject && detailProject.id === closingProject.id) {
      setDetailProject(updatedProj);
      setDetailTab("rentabilidad"); // Abrir automáticamente pestaña de rentabilidad
    }

    setClosingProject(null);

    toast({
      tone: "ok",
      title: `Proyecto ${closingProject.code} cerrado`,
      description: "El proyecto ha sido finalizado. Pestaña de Rentabilidad auditada desbloqueada.",
    });
  };

  // ─── CÁLCULOS DE RENTABILIDAD PARA PROYECTO SELECCIONADO ───
  const profitabilityData = useMemo(() => {
    if (!detailProject) return null;

    const budgetMat = detailProject.budgetMaterials || Math.round(detailProject.budget * 0.6);
    const realMat = detailProject.costRealMaterials || (detailProject.dispatches?.reduce((a, b) => a + b.totalCost, 0) ?? Math.round(detailProject.costReal * 0.6));

    const budgetHrs = (detailProject.budgetHours || 250) * (detailProject.hourlyRate || 18500);
    const realHrs = detailProject.costRealHours || (detailProject.laborEntries?.reduce((a, b) => a + b.totalCost, 0) ?? Math.round(detailProject.costReal * 0.37));

    const budgetWaste = Math.round(budgetMat * 0.03); // 3% tolerancia estimada en presupuesto
    const realWaste = detailProject.costRealWaste || (detailProject.wasteEntries?.reduce((a, b) => a + b.cost, 0) ?? Math.round(detailProject.costReal * 0.03));

    const totalPlanned = budgetMat + budgetHrs + budgetWaste;
    const totalReal = realMat + realHrs + realWaste;

    const devMat = realMat - budgetMat;
    const devMatPct = budgetMat > 0 ? (devMat / budgetMat) * 100 : 0;

    const devHrs = realHrs - budgetHrs;
    const devHrsPct = budgetHrs > 0 ? (devHrs / budgetHrs) * 100 : 0;

    const devWaste = realWaste - budgetWaste;
    const devWastePct = budgetWaste > 0 ? (devWaste / budgetWaste) * 100 : 0;

    const totalDev = totalReal - totalPlanned;
    const totalDevPct = totalPlanned > 0 ? (totalDev / totalPlanned) * 100 : 0;

    const saleValue = detailProject.saleValue || Math.round(totalPlanned * 1.35);
    const finalMarginAmount = saleValue - totalReal;
    const finalMarginPct = saleValue > 0 ? (finalMarginAmount / saleValue) * 100 : 0;

    // Composición de costo real en %
    const pctMat = totalReal > 0 ? Math.round((realMat / totalReal) * 100) : 60;
    const pctHrs = totalReal > 0 ? Math.round((realHrs / totalReal) * 100) : 35;
    const pctWaste = totalReal > 0 ? 100 - pctMat - pctHrs : 5;

    return {
      budgetMat,
      realMat,
      devMat,
      devMatPct,
      budgetHrs,
      realHrs,
      devHrs,
      devHrsPct,
      budgetWaste,
      realWaste,
      devWaste,
      devWastePct,
      totalPlanned,
      totalReal,
      totalDev,
      totalDevPct,
      saleValue,
      finalMarginAmount,
      finalMarginPct,
      pctMat,
      pctHrs,
      pctWaste,
    };
  }, [detailProject]);

  return (
    <div className="space-y-6">
      {/* ─── ENCABEZADO Y ACCIÓN NUEVO PROYECTO ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FolderKanban size={22} />
            </span>
            <div>
              <h1 className="text-h1 font-bold text-ink-900">Proyectos y Obras</h1>
              <p className="text-body-sm text-ink-500">
                Control financiero, semáforo de costo, asignación técnica y auditoría de rentabilidad.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleOpenCreate} className="gap-2">
            <Plus size={18} />
            <span>Nuevo Proyecto</span>
          </Button>
        </div>
      </div>

      {/* ─── TARJETAS KPI RESUMEN ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-4 border border-ink-200/80 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FolderKanban size={24} />
          </div>
          <div>
            <p className="text-caption font-medium text-ink-500">Total Proyectos</p>
            <p className="text-h2 font-black text-ink-900">{stats.total}</p>
            <p className="text-caption text-ink-500">{stats.active} en ejecución activa</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-ink-200/80 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-caption font-medium text-ink-500">Sobrecosto ({">"}100%)</p>
            <p className="text-h2 font-black text-danger">{stats.red}</p>
            <p className="text-caption text-danger-soft font-semibold text-danger">Requiere revisión inmediata</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-ink-200/80 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-caption font-medium text-ink-500">Presupuesto Global</p>
            <p className="text-body-md font-bold text-ink-900">{formatCLP(stats.totalBudget)}</p>
            <p className="text-caption text-ink-500">Ventas: {formatCLP(stats.totalSale)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4 border border-ink-200/80 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <BarChart2 size={24} />
          </div>
          <div>
            <p className="text-caption font-medium text-ink-500">Costo Real Acumulado</p>
            <p className="text-body-md font-bold text-ink-900">{formatCLP(stats.totalCost)}</p>
            <p className="text-caption text-ink-500">
              {stats.totalBudget > 0 ? Math.round((stats.totalCost / stats.totalBudget) * 100) : 0}% ejecutado
            </p>
          </div>
        </Card>
      </div>

      {/* ─── BARRA DE FILTROS Y BÚSQUEDA ─── */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 border border-ink-200/80 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código (OB-2026-...) o cliente..."
            className="w-full rounded-xl border border-ink-200 py-2.5 pl-10 pr-4 text-body-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Estado */}
          <div className="flex items-center rounded-xl border border-ink-200 bg-ink-50 p-1 text-caption font-medium">
            {(["todos", "activo", "planificado", "cerrado"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 transition capitalize ${
                  statusFilter === st ? "bg-white font-bold text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
                }`}
              >
                {st === "todos" ? "Todos" : st === "activo" ? "Activos" : st === "planificado" ? "Planificados" : "Cerrados"}
              </button>
            ))}
          </div>

          {/* Filtro Tipo */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="todos">Todos los tipos</option>
            <option value="obra">Solo Obras</option>
            <option value="mantencion">Solo Mantenciones</option>
          </select>

          {/* Filtro Semáforo */}
          <select
            value={costFilter}
            onChange={(e) => setCostFilter(e.target.value as any)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="todos">Semáforo: Todos</option>
            <option value="verde">🟢 Verde (&lt;80%)</option>
            <option value="amarillo">🟡 Amarillo (80–100%)</option>
            <option value="rojo">🔴 Rojo (&gt;100%)</option>
          </select>
        </div>
      </div>

      {/* ─── LISTA DE PROYECTOS (TABLA MODERNA) ─── */}
      <Card className="overflow-hidden border border-ink-200/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-body-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-caption font-bold text-ink-600">
                <th className="py-3.5 pl-4 pr-3">PROYECTO</th>
                <th className="px-3 py-3.5">CLIENTE</th>
                <th className="px-3 py-3.5">TIPO</th>
                <th className="px-3 py-3.5">FECHAS</th>
                <th className="px-3 py-3.5">ESTADO</th>
                <th className="px-3 py-3.5">SEMÁFORO DE COSTO</th>
                <th className="py-3.5 pl-3 pr-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-400">
                    <FolderKanban size={40} className="mx-auto mb-2 text-ink-300" />
                    <p className="font-medium">No se encontraron proyectos con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const semaforo = getCostSemaforo(p.budget, p.costReal);
                  const isClosed = p.status === "cerrado" || p.status === "finalizado";
                  const isPlanned = p.status === "planificado";

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-ink-50/60">
                      {/* Nombre y código */}
                      <td className="py-3.5 pl-4 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(p)}
                            className="text-left font-bold text-ink-900 hover:text-brand-600 transition"
                          >
                            <span className="block">{p.name}</span>
                            <span className="font-mono text-caption text-ink-500">{p.code}</span>
                          </button>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-3 py-3.5 font-medium text-ink-700">{p.client}</td>

                      {/* Tipo */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-semibold ${
                            p.kind === "obra"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {p.kind === "obra" ? "Obra" : "Mantención"}
                        </span>
                      </td>

                      {/* Fechas */}
                      <td className="px-3 py-3.5 text-caption text-ink-600">
                        <div className="flex flex-col">
                          <span>Inic: {p.startDate ? formatDate(p.startDate) : "Por iniciar"}</span>
                          <span className="font-semibold text-ink-800">
                            Límite: {p.deadline ? formatDate(p.deadline) : "Sin definir"}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-3.5">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-caption font-bold text-ink-700 border border-ink-300">
                            <Lock size={12} />
                            Cerrado
                          </span>
                        ) : isPlanned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-caption font-bold text-blue-700 border border-blue-200">
                            <Clock size={12} />
                            Planificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-caption font-bold text-ok border border-ok-line">
                            <CheckCircle2 size={12} />
                            Activo
                          </span>
                        )}
                      </td>

                      {/* Semáforo de costo */}
                      <td className="px-3 py-3.5 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-caption">
                            <span
                              className={`font-bold flex items-center gap-1 ${
                                semaforo.nivel === "verde"
                                  ? "text-ok"
                                  : semaforo.nivel === "amarillo"
                                  ? "text-warn"
                                  : "text-danger"
                              }`}
                            >
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  semaforo.nivel === "verde"
                                    ? "bg-ok"
                                    : semaforo.nivel === "amarillo"
                                    ? "bg-warn"
                                    : "bg-danger"
                                }`}
                              />
                              {semaforo.label}
                            </span>
                            <span className="font-mono text-ink-500">
                              {formatCLP(p.costReal)} / {formatCLP(p.budget)}
                            </span>
                          </div>

                          {/* Barra de progreso */}
                          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                semaforo.nivel === "verde"
                                  ? "bg-ok"
                                  : semaforo.nivel === "amarillo"
                                  ? "bg-warn"
                                  : "bg-danger"
                              }`}
                              style={{ width: `${Math.min(semaforo.pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 pl-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenDetail(p)}
                            className="px-2.5 py-1 text-caption font-semibold"
                          >
                            Detalle
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => handleOpenEdit(p)}
                            className={`px-2.5 py-1 text-caption font-semibold ${
                              isClosed ? "opacity-60" : ""
                            }`}
                          >
                            {isClosed ? "Ver" : "Editar"}
                          </Button>

                          {!isClosed && (
                            <Button
                              variant="danger"
                              onClick={() => handleOpenCloseModal(p)}
                              className="px-2.5 py-1 text-caption font-semibold"
                            >
                              Cerrar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── MODAL DETALLE CON PESTAÑAS (COMPLETO) ─── */}
      {detailProject && (
        <Modal
          size="lg"
          open={Boolean(detailProject)}
          onClose={() => setDetailProject(null)}
          title={`${detailProject.name}`}
          description={`Código: ${detailProject.code} · Cliente: ${detailProject.client}`}
        >
          <div className="space-y-5">
            {/* Cabecera del detalle con selector de pestañas */}
            <div className="flex flex-wrap items-center justify-between border-b border-ink-200 pb-3 gap-2">
              <div className="flex flex-wrap items-center gap-1 bg-ink-100 p-1 rounded-xl text-body-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setDetailTab("resumen")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    detailTab === "resumen" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Resumen
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("tecnicos")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    detailTab === "tecnicos" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Técnicos ({detailProject.technicianRuts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("insumos")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    detailTab === "insumos" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Insumos y Egresos ({detailProject.dispatches?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("horas")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    detailTab === "horas" ? "bg-white text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Horas ({detailProject.hoursReal || 0}h)
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("rentabilidad")}
                  className={`rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 ${
                    detailTab === "rentabilidad"
                      ? "bg-brand-600 text-white shadow-xs font-bold"
                      : detailProject.status === "cerrado" || detailProject.status === "finalizado"
                      ? "text-brand-700 font-bold hover:bg-brand-50"
                      : "text-ink-400"
                  }`}
                >
                  <BarChart2 size={16} />
                  <span>Rentabilidad</span>
                  {!(detailProject.status === "cerrado" || detailProject.status === "finalizado") && (
                    <Lock size={12} className="text-ink-400" />
                  )}
                </button>
              </div>

              {/* Botón de cierre si no está cerrado */}
              {!(detailProject.status === "cerrado" || detailProject.status === "finalizado") && (
                <Button
                  variant="danger"
                  onClick={() => handleOpenCloseModal(detailProject)}
                  className="gap-1.5 text-body-sm font-bold"
                >
                  <Lock size={16} />
                  <span>Cerrar Proyecto</span>
                </Button>
              )}
            </div>

            {/* ─── PESTAÑA 1: RESUMEN ─── */}
            {detailTab === "resumen" && (
              <div className="space-y-4">
                {/* Semáforo de costo destacado */}
                {(() => {
                  const s = getCostSemaforo(detailProject.budget, detailProject.costReal);
                  const marginAmount = (detailProject.saleValue || 0) - detailProject.costReal;
                  const marginPct =
                    detailProject.saleValue > 0
                      ? Math.round((marginAmount / detailProject.saleValue) * 100)
                      : 0;

                  return (
                    <div
                      className={`rounded-2xl p-4 border ${
                        s.nivel === "verde"
                          ? "bg-ok-soft/30 border-ok-line"
                          : s.nivel === "amarillo"
                          ? "bg-warn-soft/30 border-warn-line"
                          : "bg-danger-soft/30 border-danger-line"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-3.5 w-3.5 rounded-full ${
                                s.nivel === "verde" ? "bg-ok" : s.nivel === "amarillo" ? "bg-warn" : "bg-danger"
                              }`}
                            />
                            <h3 className="text-body-md font-bold text-ink-900">
                              Semáforo de Costo:{" "}
                              <span
                                className={
                                  s.nivel === "verde" ? "text-ok" : s.nivel === "amarillo" ? "text-warn" : "text-danger"
                                }
                              >
                                {s.label}
                              </span>
                            </h3>
                          </div>
                          <p className="mt-1 text-caption text-ink-600">
                            Verde: &lt;80% · Amarillo: 80–100% · Rojo: &gt;100% (Sobrecosto financiero)
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-caption font-semibold text-ink-500">Margen Estimado en Vivo</p>
                          <p
                            className={`text-h3 font-black tabular-nums ${
                              marginAmount >= 0 ? "text-ok" : "text-danger"
                            }`}
                          >
                            {formatCLP(marginAmount)} ({marginPct}%)
                          </p>
                        </div>
                      </div>

                      {/* Barra de progreso financiero */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-caption font-bold text-ink-700">
                          <span>Ejecutado: {formatCLP(detailProject.costReal)}</span>
                          <span>Presupuesto Total: {formatCLP(detailProject.budget)}</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-white/80 border border-ink-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              s.nivel === "verde" ? "bg-ok" : s.nivel === "amarillo" ? "bg-warn" : "bg-danger"
                            }`}
                            style={{ width: `${Math.min(s.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Desglose de Presupuestos vs Real */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Materiales</p>
                    <p className="text-body-md font-bold text-ink-900">
                      {formatCLP(
                        detailProject.costRealMaterials ||
                          detailProject.dispatches?.reduce((a, b) => a + b.totalCost, 0) ||
                          0,
                      )}
                    </p>
                    <p className="text-caption text-ink-500">
                      Presupuesto: {formatCLP(detailProject.budgetMaterials || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Mano de Obra (Horas)</p>
                    <p className="text-body-md font-bold text-ink-900">
                      {formatCLP(
                        detailProject.costRealHours ||
                          detailProject.laborEntries?.reduce((a, b) => a + b.totalCost, 0) ||
                          0,
                      )}
                    </p>
                    <p className="text-caption text-ink-500">
                      Presupuesto: {formatCLP((detailProject.budgetHours || 0) * (detailProject.hourlyRate || 18500))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Valor de Venta Contratado</p>
                    <p className="text-body-md font-bold text-brand-600">
                      {formatCLP(detailProject.saleValue || 0)}
                    </p>
                    <p className="text-caption text-ink-500">Cliente: {detailProject.client}</p>
                  </div>
                </div>

                {/* Datos generales de la obra */}
                <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4 space-y-2 text-body-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Dirección de faena:</span>
                    <span className="font-semibold text-ink-800">{detailProject.address || "No especificada"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Plazo de ejecución:</span>
                    <span className="font-semibold text-ink-800">
                      {formatDate(detailProject.startDate)} al {formatDate(detailProject.deadline)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Avance físico reportado:</span>
                    <span className="font-bold text-brand-600">{detailProject.progress}% completado</span>
                  </div>
                  {detailProject.closedAt && (
                    <div className="flex justify-between border-t border-ink-200 pt-2 text-ok font-semibold">
                      <span>Cerrado oficialmente el:</span>
                      <span>{detailProject.closedAt} ({detailProject.closedBy})</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── PESTAÑA 2: TÉCNICOS (SIN DUPLICADOS) ─── */}
            {detailTab === "tecnicos" && (
              <div className="space-y-4">
                {/* Formulario Asignar Técnico (Solo disponibles para evitar duplicados) */}
                {!(detailProject.status === "cerrado" || detailProject.status === "finalizado") && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
                    <h4 className="text-body-sm font-bold text-ink-900 mb-2">Asignar Técnico a la Obra</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedTechToAssign}
                        onChange={(e) => setSelectedTechToAssign(e.target.value)}
                        className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                      >
                        <option value="">Selecciona un técnico disponible...</option>
                        {technicians
                          .filter((t) => !detailProject.technicianRuts.includes(t.rut))
                          .map((t) => (
                            <option key={t.rut} value={t.rut}>
                              {t.name} · {t.specialty} ({t.rut})
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="primary"
                        onClick={handleAssignTechnician}
                        disabled={!selectedTechToAssign}
                        className="gap-1.5"
                      >
                        <UserPlus size={16} />
                        <span>Asignar</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista de técnicos asignados */}
                <div className="space-y-2">
                  <h4 className="text-caption font-bold uppercase tracking-wider text-ink-500">
                    Equipo Asignado ({detailProject.technicianRuts.length})
                  </h4>

                  {detailProject.technicianRuts.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-body-sm text-ink-400">
                      No hay técnicos asignados actualmente a este proyecto.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {detailProject.technicianRuts.map((rut) => {
                        const tech = technicians.find((t) => t.rut === rut);
                        const isClosed = detailProject.status === "cerrado" || detailProject.status === "finalizado";

                        return (
                          <div
                            key={rut}
                            className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-3 shadow-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 font-bold text-ink-700">
                                {tech ? tech.name.slice(0, 2).toUpperCase() : "TE"}
                              </div>
                              <div>
                                <p className="font-bold text-ink-900">{tech ? tech.name : rut}</p>
                                <p className="text-caption text-ink-500">{tech?.specialty} · {tech?.phone}</p>
                              </div>
                            </div>

                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => handleUnassignTechnician(rut)}
                                title="Desasignar técnico"
                                className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-soft hover:text-danger transition"
                              >
                                <UserMinus size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── PESTAÑA 3: INSUMOS Y EGRESOS ─── */}
            {detailTab === "insumos" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-xl bg-ink-50 p-3 text-body-sm border border-ink-200">
                  <div>
                    <span className="font-bold text-ink-800">Total Materiales Egresados: </span>
                    <span className="font-black text-brand-600">
                      {formatCLP(
                        detailProject.dispatches?.reduce((a, b) => a + b.totalCost, 0) ||
                          detailProject.costRealMaterials ||
                          0,
                      )}
                    </span>
                  </div>
                  <div className="text-caption text-ink-500">
                    Presupuesto Materiales: {formatCLP(detailProject.budgetMaterials || 0)}
                  </div>
                </div>

                {/* Tabla de despachos */}
                <div className="overflow-x-auto rounded-xl border border-ink-200">
                  <table className="w-full text-left text-body-sm">
                    <thead>
                      <tr className="bg-ink-100/70 text-caption font-bold text-ink-600 border-b border-ink-200">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">N° Despacho</th>
                        <th className="py-2.5 px-3">Insumo / SKU</th>
                        <th className="py-2.5 px-3 text-right">Cantidad</th>
                        <th className="py-2.5 px-3 text-right">PMP Unit.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Receptor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {!detailProject.dispatches || detailProject.dispatches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-ink-400">
                            Aún no se registran egresos o despachos para este proyecto.
                          </td>
                        </tr>
                      ) : (
                        detailProject.dispatches.map((dsp) => (
                          <tr key={dsp.id} className="hover:bg-ink-50/50">
                            <td className="py-2.5 px-3 font-mono text-caption text-ink-600">{dsp.date}</td>
                            <td className="py-2.5 px-3 font-bold text-ink-900">{dsp.dispatchCode}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-ink-900">{dsp.productName}</span>
                              <span className="block font-mono text-caption text-ink-400">{dsp.sku}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-ink-800">
                              {dsp.quantity} {dsp.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-ink-600">
                              {formatCLP(dsp.unitCost)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-brand-600">
                              {formatCLP(dsp.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-ink-700">{dsp.deliveredTo}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── PESTAÑA 4: HORAS (HH) ─── */}
            {detailTab === "horas" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Horas Reales Ejecutadas</p>
                    <p className="text-h3 font-black text-ink-900">{detailProject.hoursReal || 0} HH</p>
                    <p className="text-caption text-ink-500">
                      Presupuestadas: {detailProject.budgetHours || 0} HH
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Costo Horas Hombre</p>
                    <p className="text-h3 font-black text-ink-900">
                      {formatCLP(
                        detailProject.costRealHours ||
                          detailProject.laborEntries?.reduce((a, b) => a + b.totalCost, 0) ||
                          0,
                      )}
                    </p>
                    <p className="text-caption text-ink-500">
                      Tarifa: {formatCLP(detailProject.hourlyRate || 18500)} / HH
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-caption font-semibold text-ink-500">Saldo HH Presupuestadas</p>
                    <p
                      className={`text-h3 font-black ${
                        (detailProject.budgetHours || 0) >= (detailProject.hoursReal || 0)
                          ? "text-ok"
                          : "text-danger"
                      }`}
                    >
                      {(detailProject.budgetHours || 0) - (detailProject.hoursReal || 0)} HH
                    </p>
                    <p className="text-caption text-ink-500">Disponibles</p>
                  </div>
                </div>

                {/* Formulario para registrar horas (si no está cerrado) */}
                {!(detailProject.status === "cerrado" || detailProject.status === "finalizado") && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 space-y-3">
                    <h4 className="text-body-sm font-bold text-ink-900">Registrar Jornada de Trabajo</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={laborTechRut}
                        onChange={(e) => setLaborTechRut(e.target.value)}
                        className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-900"
                      >
                        {technicians.map((t) => (
                          <option key={t.rut} value={t.rut}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={laborHours}
                        onChange={(e) => setLaborHours(Number(e.target.value))}
                        placeholder="Horas trabajadas"
                        className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-900"
                      />
                      <input
                        type="text"
                        value={laborDesc}
                        onChange={(e) => setLaborDesc(e.target.value)}
                        placeholder="Descripción de la tarea ejecutada..."
                        className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-900"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="primary" onClick={handleAddLabor} className="text-body-sm font-semibold">
                        Imputar Horas al Proyecto
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tabla de jornadas */}
                <div className="overflow-x-auto rounded-xl border border-ink-200">
                  <table className="w-full text-left text-body-sm">
                    <thead>
                      <tr className="bg-ink-100/70 text-caption font-bold text-ink-600 border-b border-ink-200">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Técnico</th>
                        <th className="py-2.5 px-3 text-right">Horas</th>
                        <th className="py-2.5 px-3 text-right">Tarifa / HH</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3">Tarea / Descripción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {!detailProject.laborEntries || detailProject.laborEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-ink-400">
                            No hay jornadas de mano de obra registradas.
                          </td>
                        </tr>
                      ) : (
                        detailProject.laborEntries.map((l) => (
                          <tr key={l.id} className="hover:bg-ink-50/50">
                            <td className="py-2.5 px-3 font-mono text-caption text-ink-600">{l.date}</td>
                            <td className="py-2.5 px-3 font-bold text-ink-900">{l.technicianName}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-ink-800">{l.hours} h</td>
                            <td className="py-2.5 px-3 text-right font-mono text-ink-600">{formatCLP(l.hourlyCost)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-brand-600">
                              {formatCLP(l.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-ink-700">{l.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── PESTAÑA 5: RENTABILIDAD (SOLO SI ESTÁ CERRADO) ─── */}
            {detailTab === "rentabilidad" && (
              <div>
                {!(detailProject.status === "cerrado" || detailProject.status === "finalizado") ? (
                  // ESTADO BLOQUEADO SI NO ESTÁ CERRADO
                  <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-ink-50/60 p-8 text-center space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-200 text-ink-600">
                      <Lock size={32} />
                    </div>
                    <div>
                      <h3 className="text-h3 font-bold text-ink-900">
                        Pestaña Bloqueada: Auditoría de Rentabilidad
                      </h3>
                      <p className="mt-1 text-body-sm text-ink-600 max-w-lg mx-auto">
                        El informe de rentabilidad definitiva, comparación de barras planificado vs real,
                        composición de costos y cálculo de desviaciones se desbloquea <strong>exclusivamente cuando el proyecto está Cerrado</strong>.
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        onClick={() => handleOpenCloseModal(detailProject)}
                        className="gap-2"
                      >
                        <Lock size={16} />
                        <span>Iniciar proceso de Cierre de Proyecto</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  // AUDITORÍA DE RENTABILIDAD COMPLETA (PROYECTO CERRADO)
                  profitabilityData && (
                    <div className="space-y-6">
                      {/* Banner de Proyecto Auditado y Cerrado */}
                      <div className="flex items-center justify-between rounded-xl bg-ok-soft border border-ok-line p-3.5 text-ok">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 size={22} />
                          <div>
                            <p className="font-bold">Proyecto Auditado y Cerrado Definitivamente</p>
                            <p className="text-caption text-ink-600">
                              Cierre registrado: {detailProject.closedAt || "Septiembre 2026"} por {detailProject.closedBy || "Administrador"}
                            </p>
                          </div>
                        </div>
                        <Badge tone="ok">Liquidación Oficial</Badge>
                      </div>

                      {/* Tarjetas de Desviación y Margen Auditado */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card className="p-4 border border-ink-200">
                          <p className="text-caption font-semibold text-ink-500">Desviación Total en Monto</p>
                          <p
                            className={`text-h2 font-black tabular-nums ${
                              profitabilityData.totalDev <= 0 ? "text-ok" : "text-danger"
                            }`}
                          >
                            {profitabilityData.totalDev <= 0 ? "-" : "+"}
                            {formatCLP(Math.abs(profitabilityData.totalDev))}
                          </p>
                          <p className="text-caption font-bold text-ink-600">
                            {profitabilityData.totalDev <= 0 ? "Ahorro presupuestario favorable" : "Sobrecosto respecto a presupuesto"}
                          </p>
                        </Card>

                        <Card className="p-4 border border-ink-200">
                          <p className="text-caption font-semibold text-ink-500">Desviación en Porcentaje (%)</p>
                          <p
                            className={`text-h2 font-black tabular-nums ${
                              profitabilityData.totalDevPct <= 0 ? "text-ok" : "text-danger"
                            }`}
                          >
                            {profitabilityData.totalDevPct.toFixed(1)}%
                          </p>
                          <p className="text-caption font-bold text-ink-600">
                            Variación real acumulada
                          </p>
                        </Card>

                        <Card className="p-4 border border-ink-200 bg-brand-50/40">
                          <p className="text-caption font-semibold text-brand-800">Margen Real Final Auditado</p>
                          <p className="text-h2 font-black text-brand-700 tabular-nums">
                            {formatCLP(profitabilityData.finalMarginAmount)}
                          </p>
                          <p className="text-caption font-bold text-brand-600">
                            {profitabilityData.finalMarginPct.toFixed(1)}% margen neto s/venta ({formatCLP(profitabilityData.saleValue)})
                          </p>
                        </Card>
                      </div>

                      {/* ─── 1. BARRAS: PLANIFICADO VS REAL POR PARTIDA ─── */}
                      <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-ink-200 pb-2">
                          <h4 className="text-body-md font-bold text-ink-900">
                            Comparativa: Planificado vs Real por Partida
                          </h4>
                          <span className="text-caption text-ink-500">Cifras en CLP</span>
                        </div>

                        <div className="space-y-4">
                          {/* Partida 1: Materiales */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-body-sm">
                              <span className="font-bold text-ink-900">1. Insumos y Materiales</span>
                              <span className="font-mono text-ink-700">
                                Planificado: {formatCLP(profitabilityData.budgetMat)} · Real:{" "}
                                <strong className="text-ink-900">{formatCLP(profitabilityData.realMat)}</strong> (
                                <span className={profitabilityData.devMat <= 0 ? "text-ok font-bold" : "text-danger font-bold"}>
                                  {profitabilityData.devMatPct >= 0 ? "+" : ""}
                                  {profitabilityData.devMatPct.toFixed(1)}%
                                </span>
                                )
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Planificado</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-md" style={{ width: "100%" }} />
                                </div>
                              </div>
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Real Ejecutado</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-md ${
                                      profitabilityData.devMat <= 0 ? "bg-ok" : "bg-danger"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        (profitabilityData.realMat / (profitabilityData.budgetMat || 1)) * 100,
                                        120,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Partida 2: Mermas y Desperdicios */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-body-sm">
                              <span className="font-bold text-ink-900">2. Mermas y Pérdidas</span>
                              <span className="font-mono text-ink-700">
                                Planificado: {formatCLP(profitabilityData.budgetWaste)} · Real:{" "}
                                <strong className="text-ink-900">{formatCLP(profitabilityData.realWaste)}</strong> (
                                <span className={profitabilityData.devWaste <= 0 ? "text-ok font-bold" : "text-danger font-bold"}>
                                  {profitabilityData.devWastePct >= 0 ? "+" : ""}
                                  {profitabilityData.devWastePct.toFixed(1)}%
                                </span>
                                )
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Planificado (3% estim.)</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-md" style={{ width: "100%" }} />
                                </div>
                              </div>
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Real Imputado</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-md ${
                                      profitabilityData.devWaste <= 0 ? "bg-ok" : "bg-danger"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        (profitabilityData.realWaste / (profitabilityData.budgetWaste || 1)) * 100,
                                        120,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Partida 3: Horas Hombre */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-body-sm">
                              <span className="font-bold text-ink-900">3. Mano de Obra (Horas)</span>
                              <span className="font-mono text-ink-700">
                                Planificado: {formatCLP(profitabilityData.budgetHrs)} · Real:{" "}
                                <strong className="text-ink-900">{formatCLP(profitabilityData.realHrs)}</strong> (
                                <span className={profitabilityData.devHrs <= 0 ? "text-ok font-bold" : "text-danger font-bold"}>
                                  {profitabilityData.devHrsPct >= 0 ? "+" : ""}
                                  {profitabilityData.devHrsPct.toFixed(1)}%
                                </span>
                                )
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Planificado</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-md" style={{ width: "100%" }} />
                                </div>
                              </div>
                              <div>
                                <div className="text-caption text-ink-500 mb-0.5">Real Ejecutado</div>
                                <div className="h-4 w-full rounded-md bg-ink-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-md ${
                                      profitabilityData.devHrs <= 0 ? "bg-ok" : "bg-danger"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        (profitabilityData.realHrs / (profitabilityData.budgetHrs || 1)) * 100,
                                        120,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ─── 2. TORTA DE COMPOSICIÓN (DONUT SVG) ─── */}
                      <div className="rounded-2xl border border-ink-200 bg-white p-5">
                        <h4 className="text-body-md font-bold text-ink-900 mb-4">
                          Torta de Composición del Costo Real Total
                        </h4>

                        <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                          {/* Gráfico circular Donut SVG */}
                          <div className="relative flex items-center justify-center">
                            <svg width="180" height="180" viewBox="0 0 100 100" className="-rotate-90">
                              {/* Círculo base */}
                              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e5e7eb" strokeWidth="20" />
                              {/* Segmento Materiales */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#0284c7" // sky-600
                                strokeWidth="20"
                                strokeDasharray={`${profitabilityData.pctMat * 2.51} 251`}
                                strokeDashoffset="0"
                              />
                              {/* Segmento Horas */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#16a34a" // green-600
                                strokeWidth="20"
                                strokeDasharray={`${profitabilityData.pctHrs * 2.51} 251`}
                                strokeDashoffset={`-${profitabilityData.pctMat * 2.51}`}
                              />
                              {/* Segmento Mermas */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#dc2626" // red-600
                                strokeWidth="20"
                                strokeDasharray={`${profitabilityData.pctWaste * 2.51} 251`}
                                strokeDashoffset={`-${(profitabilityData.pctMat + profitabilityData.pctHrs) * 2.51}`}
                              />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                              <span className="text-caption font-bold text-ink-500">Costo Real</span>
                              <span className="text-body-sm font-black text-ink-900">
                                {formatCLP(profitabilityData.totalReal)}
                              </span>
                            </div>
                          </div>

                          {/* Leyenda y Desglose */}
                          <div className="space-y-3 flex-1 max-w-sm">
                            <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-200 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-sky-600" />
                                <span className="text-body-sm font-bold text-sky-900">Insumos y Materiales</span>
                              </div>
                              <span className="font-mono text-body-sm font-black text-sky-900">
                                {profitabilityData.pctMat}% ({formatCLP(profitabilityData.realMat)})
                              </span>
                            </div>

                            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-600" />
                                <span className="text-body-sm font-bold text-emerald-900">Mano de Obra (Horas)</span>
                              </div>
                              <span className="font-mono text-body-sm font-black text-emerald-900">
                                {profitabilityData.pctHrs}% ({formatCLP(profitabilityData.realHrs)})
                              </span>
                            </div>

                            <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-rose-600" />
                                <span className="text-body-sm font-bold text-rose-900">Mermas y Pérdidas</span>
                              </div>
                              <span className="font-mono text-body-sm font-black text-rose-900">
                                {profitabilityData.pctWaste}% ({formatCLP(profitabilityData.realWaste)})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── MODAL FORMULARIO: CREAR / EDITAR PROYECTO ─── */}
      {formModalOpen && (
        <Modal
          size="lg"
          open={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          title={editingProject ? `Editar Proyecto: ${editingProject.code}` : "Nuevo Proyecto"}
          description={
            editingProject
              ? "Actualiza los parámetros financieros y plazos de la obra."
              : "Registra una nueva obra o contrato de mantención."
          }
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => setFormModalOpen(false)}>
                Cancelar
              </Button>
              {!(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado")) && (
                <Button variant="primary" onClick={handleSaveProject}>
                  {editingProject ? "Guardar Cambios" : "Crear Proyecto"}
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {/* Aviso si está cerrado (no editable) */}
            {editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado") && (
              <div className="rounded-xl bg-ink-100 border border-ink-300 p-3 text-ink-800 flex items-center gap-2 font-semibold text-body-sm">
                <Lock size={18} className="text-ink-600" />
                <span>Este proyecto se encuentra CERRADO y auditado. No permite modificaciones.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-caption font-bold text-ink-900 mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Edificio Los Aromos – Instalación eléctrica"
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">Cliente</label>
                <input
                  type="text"
                  list="clients-list"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formClient}
                  onChange={(e) => setFormClient(e.target.value)}
                  placeholder="Selecciona o escribe el cliente..."
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
                <datalist id="clients-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.businessName} />
                  ))}
                </datalist>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">Tipo de Proyecto</label>
                <select
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as ProjectKind)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                >
                  <option value="obra">Obra (Instalación nueva / Remodelación)</option>
                  <option value="mantencion">Mantención (Preventiva / Correctiva)</option>
                </select>
              </div>

              {/* Fecha Inicio */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Fecha Límite */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">Fecha Límite (Deadline)</label>
                <input
                  type="date"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Presupuesto Materiales */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">
                  Presupuesto de Materiales ($ CLP)
                </label>
                <input
                  type="number"
                  step="50000"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formBudgetMaterials}
                  onChange={(e) => setFormBudgetMaterials(Number(e.target.value))}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 font-mono disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Presupuesto de Horas */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">
                  Presupuesto de Horas Hombre (HH)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="10"
                    disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                    value={formBudgetHours}
                    onChange={(e) => setFormBudgetHours(Number(e.target.value))}
                    className="w-1/2 rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 font-mono disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="500"
                    title="Tarifa por HH"
                    disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                    value={formHourlyRate}
                    onChange={(e) => setFormHourlyRate(Number(e.target.value))}
                    className="w-1/2 rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 font-mono disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                  />
                </div>
                <span className="text-caption text-ink-500 mt-1 block">
                  Total HH: {formatCLP(formBudgetHours * formHourlyRate)}
                </span>
              </div>

              {/* Valor de Venta */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">
                  Valor de Venta Contratado ($ CLP)
                </label>
                <input
                  type="number"
                  step="100000"
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formSaleValue}
                  onChange={(e) => setFormSaleValue(Number(e.target.value))}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 font-mono font-bold text-brand-600 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-caption font-bold text-ink-900 mb-1">Estado</label>
                <select
                  disabled={Boolean(editingProject && (editingProject.status === "cerrado" || editingProject.status === "finalizado"))}
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm text-ink-900 disabled:bg-ink-100 disabled:text-ink-500 focus:border-brand-600 focus:outline-none"
                >
                  <option value="planificado">Planificado</option>
                  <option value="activo">Activo</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
            </div>

            {/* Resumen Total Calculado */}
            <div className="rounded-xl bg-ink-50 p-3.5 border border-ink-200 flex flex-col sm:flex-row justify-between items-center text-body-sm">
              <div>
                <span className="text-ink-600">Presupuesto de Costos Calculado: </span>
                <span className="font-bold text-ink-900">
                  {formatCLP(formBudgetMaterials + formBudgetHours * formHourlyRate)}
                </span>
              </div>
              <div>
                <span className="text-ink-600">Margen Presupuestado: </span>
                <span className="font-black text-ok">
                  {formatCLP(
                    formSaleValue - (formBudgetMaterials + formBudgetHours * formHourlyRate),
                  )}{" "}
                  (
                  {formSaleValue > 0
                    ? Math.round(
                        ((formSaleValue - (formBudgetMaterials + formBudgetHours * formHourlyRate)) /
                          formSaleValue) *
                          100,
                      )
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL DE CIERRE CON LISTA DE BLOQUEOS ─── */}
      {closingProject && (
        <Modal
          size="lg"
          open={Boolean(closingProject)}
          onClose={() => setClosingProject(null)}
          title={`Cierre de Proyecto: ${closingProject.code}`}
          description={`Verificación de auditoría previa al cierre de «${closingProject.name}»`}
          footer={
            <div className="flex items-center justify-between w-full">
              {closingBlockers.hasBlockers ? (
                <Button variant="secondary" onClick={handleResolveAllBlockers} className="gap-1.5 text-caption">
                  <RefreshCw size={14} />
                  <span>Simular Resolución de Bloqueos</span>
                </Button>
              ) : (
                <span className="text-caption text-ok font-bold flex items-center gap-1">
                  <CheckCircle2 size={16} /> Listo para cierre
                </span>
              )}

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setClosingProject(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirmCloseProject}
                  disabled={closingBlockers.hasBlockers}
                  className="gap-2"
                >
                  <Lock size={16} />
                  <span>Confirmar y Cerrar Proyecto</span>
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {closingBlockers.hasBlockers ? (
              // CASO CON BLOQUEOS DETECTADOS
              <div className="space-y-3">
                <div className="rounded-xl bg-danger-soft border border-danger-line p-4 text-danger flex items-start gap-3">
                  <AlertCircle size={22} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-body-md">No es posible cerrar el proyecto</h4>
                    <p className="text-body-sm mt-0.5">
                      Se han detectado operaciones pendientes en bodega y faena. Para garantizar la trazabilidad de costos, debes resolver las solicitudes y recibir los materiales en tránsito antes de proceder al cierre definitivo.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-body-sm font-bold text-ink-900 uppercase tracking-wider text-caption">
                    Lista de Bloqueos Activos ({closingBlockers.pendingRequests.length + closingBlockers.inTransitReturns.length})
                  </h4>

                  {/* 1. Solicitudes de material pendientes */}
                  {closingBlockers.pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-warn-line bg-warn-soft/40 p-3 flex items-start justify-between gap-3 text-body-sm"
                    >
                      <div className="flex items-start gap-2.5">
                        <Clock size={18} className="text-warn shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-ink-900">
                            Solicitud Pendiente: <span className="font-mono">{req.code}</span>
                          </p>
                          <p className="text-caption text-ink-600">
                            Solicitada por {req.technicianName} el {req.date} · Urgencia: {req.urgency}
                          </p>
                          <p className="text-caption text-ink-700 mt-1">
                            {req.items.length} ítems: {req.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                          </p>
                        </div>
                      </div>
                      <Badge tone="warn">Solicitud en trámite</Badge>
                    </div>
                  ))}

                  {/* 2. Devoluciones o materiales en tránsito */}
                  {closingBlockers.inTransitReturns.map((ret) => (
                    <div
                      key={ret.id}
                      className="rounded-xl border border-transit-line bg-transit-soft/40 p-3 flex items-start justify-between gap-3 text-body-sm"
                    >
                      <div className="flex items-start gap-2.5">
                        <Truck size={18} className="text-transit shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-ink-900">
                            Material en Tránsito: <span className="font-mono">{ret.code}</span>
                          </p>
                          <p className="text-caption text-ink-600">
                            Devolución enviada por {ret.technicianName} el {ret.date}
                          </p>
                          <p className="text-caption text-ink-700 mt-1">{ret.summary}</p>
                        </div>
                      </div>
                      <Badge tone="transit">En tránsito a bodega</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // CASO SIN BLOQUEOS: LISTO PARA CERRAR
              <div className="space-y-4">
                <div className="rounded-xl bg-ok-soft border border-ok-line p-4 text-ok flex items-start gap-3">
                  <CheckCircle2 size={24} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-body-md">Auditoría Aprobada: 0 Bloqueos</h4>
                    <p className="text-body-sm mt-0.5 text-ink-700">
                      No existen solicitudes de material pendientes ni despachos en tránsito asociados a este proyecto.
                      Todas las partidas han sido despachadas o devueltas conforme a bodega.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 space-y-2 text-body-sm">
                  <h5 className="font-bold text-ink-900 mb-1">Resumen de Liquidación Final</h5>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Costo Real Acumulado:</span>
                    <span className="font-mono font-bold text-ink-900">{formatCLP(closingProject.costReal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Presupuesto Inicial:</span>
                    <span className="font-mono text-ink-900">{formatCLP(closingProject.budget)}</span>
                  </div>
                  <div className="flex justify-between border-t border-ink-200 pt-1.5">
                    <span className="text-ink-600">Valor de Venta:</span>
                    <span className="font-mono font-bold text-brand-600">{formatCLP(closingProject.saleValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Margen Final Proyectado:</span>
                    <span className="font-mono font-black text-ok">
                      {formatCLP(closingProject.saleValue - closingProject.costReal)} (
                      {closingProject.saleValue > 0
                        ? Math.round(((closingProject.saleValue - closingProject.costReal) / closingProject.saleValue) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                </div>

                <p className="text-caption text-ink-500">
                  Al confirmar el cierre, el proyecto pasará a estado <strong>Cerrado</strong> de forma irreversible,
                  se bloqueará toda edición futura y se habilitará la auditoría definitiva en la pestaña de <strong>Rentabilidad</strong>.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
