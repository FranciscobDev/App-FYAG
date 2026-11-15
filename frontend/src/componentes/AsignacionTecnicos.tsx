import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { tema } from "@/nucleo/tema";
import {
  Proyecto as ProyectoApi,
  Tecnico as TecnicoApi,
  asignarTecnico as asignarTecnicoApi,
  listarProyectos as listarProyectosApi,
  listarTecnicos as listarTecnicosApi,
  listarTecnicosDeProyecto as listarTecnicosDeProyectoApi,
  quitarTecnico as quitarTecnicoApi,
} from "@/modulos/proyectos/proyectosApi";

// ============================================================================
// TIPOS DE DATOS PARA LA INTERFAZ DE ASIGNACIÓN [FRONT-2]
// ============================================================================

export interface TecnicoAsignable {
  id: string;
  id_usuario?: number;
  rut?: string;
  nombre: string;
  especialidad?: string;
  activo: boolean;
}

export interface ProyectoAsignable {
  id: string;
  id_proyecto?: number;
  codigo?: string;
  nombre: string;
  cliente?: string | null;
  estado: string;
  activo: boolean;
}

export interface AsignacionActiva {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  proyectoCodigo?: string;
  tecnicoId: string;
  tecnicoIdUsuario?: number;
  tecnicoRut?: string;
  tecnicoNombre: string;
  tecnicoEspecialidad?: string;
  fechaAsignacion: string;
}

export interface RegistroHistorialAsignacion {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  proyectoCodigo?: string;
  tecnicoId: string;
  tecnicoNombre: string;
  tecnicoRut?: string;
  tecnicoEspecialidad?: string;
  accion: "asignado" | "desasignado";
  estadoActual: "activo" | "desasignado";
  fechaAsignacion: string;
  fechaDesasignacion?: string;
  detalle: string;
}

export interface PropiedadesAsignacionTecnicos {
  /** ID de proyecto preseleccionado (ej. al abrir desde el detalle de un proyecto) */
  proyectoIdInicial?: number | string;
  /** Lista opcional de proyectos (si se pasa desde un padre o test) */
  proyectosProp?: ProyectoAsignable[] | ProyectoApi[];
  /** Lista opcional de técnicos (si se pasa desde un padre o test) */
  tecnicosProp?: TecnicoAsignable[];
  /** Callback para mostrar notificaciones flotantes en la pantalla padre */
  onAviso?: (mensaje: string) => void;
  /** Callback opcional al cerrar cuando se muestra en modal */
  onCancel?: () => void;
  /** Callback opcional cuando cambia la lista de asignados */
  onCambioAsignacion?: (asignaciones: AsignacionActiva[]) => void;
  /** Título personalizado */
  titulo?: string;
}

// ============================================================================
// DATOS POR DEFECTO (FALLBACK SI NO HAY CONEXIÓN AL BACKEND)
// Incluye técnicos y proyectos tanto activos como inactivos/cerrados para
// demostrar que las listas desplegables filtran SOLO los activos.
// ============================================================================

export const TECNICOS_FALLBACK: TecnicoAsignable[] = [
  {
    id: "tec-1",
    id_usuario: 101,
    rut: "17.894.562-3",
    nombre: "Alejandro Rojas Pino",
    especialidad: "Electricidad SEC Clase A",
    activo: true,
  },
  {
    id: "tec-2",
    id_usuario: 102,
    rut: "16.783.421-5",
    nombre: "Matías Fuentes Araya",
    especialidad: "Climatización Industrial",
    activo: true,
  },
  {
    id: "tec-3",
    id_usuario: 103,
    rut: "18.234.905-K",
    nombre: "Constanza Leiva Núñez",
    especialidad: "Gasfitería y Redes Húmedas",
    activo: true,
  },
  {
    id: "tec-4",
    id_usuario: 104,
    rut: "14.567.832-1",
    nombre: "Pedro Aguilera Mora",
    especialidad: "Soldadura y Estructuras",
    activo: true,
  },
  {
    id: "tec-inactivo-5",
    id_usuario: 105,
    rut: "13.111.222-4",
    nombre: "Roberto Soto (Inactivo)",
    especialidad: "Obras Civiles",
    activo: false,
  },
];

export const PROYECTOS_FALLBACK: ProyectoAsignable[] = [
  {
    id: "p1",
    id_proyecto: 1,
    codigo: "OB-2026-014",
    nombre: "Edificio Los Aromos – Instalación eléctrica",
    cliente: "Inmobiliaria Pacífico SpA",
    estado: "En curso",
    activo: true,
  },
  {
    id: "p2",
    id_proyecto: 2,
    codigo: "MT-2026-087",
    nombre: "Mantención preventiva climatización – Clínica Andes",
    cliente: "Clínica Andes S.A.",
    estado: "Activo",
    activo: true,
  },
  {
    id: "p3",
    id_proyecto: 3,
    codigo: "OB-2026-009",
    nombre: "Bodega Logística Quilicura – Red de incendio",
    cliente: "Logística Norte Ltda.",
    estado: "En curso",
    activo: true,
  },
  {
    id: "p6-cerrado",
    id_proyecto: 6,
    codigo: "OB-2026-003",
    nombre: "Centro Médico San Lucas – Fuerza y tableros (Cerrado)",
    cliente: "Red Salud San Lucas",
    estado: "Finalizado",
    activo: false,
  },
];

// ============================================================================
// MEMORIA COMPARTIDA EN SESIÓN PARA CONSERVAR HISTORIAL EN PANTALLA
// ============================================================================

let memoriaHistorialSesion: RegistroHistorialAsignacion[] = [];
let memoriaAsignacionesSesion: Record<string, AsignacionActiva[]> = {};

const formatearHoraFecha = (fecha: Date = new Date()): string => {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  const segundos = String(fecha.getSeconds()).padStart(2, "0");
  return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
};

/** Determina si un estado de proyecto corresponde a un proyecto ACTIVO */
export const esEstadoProyectoActivo = (estado?: string | null, flagActivo?: boolean): boolean => {
  if (flagActivo === false) return false;
  if (!estado) return true;
  const norm = estado.trim().toLowerCase();
  const inactivos = [
    "cerrado",
    "finalizado",
    "completado",
    "cancelado",
    "pausado",
    "inactivo",
    "baja",
  ];
  return !inactivos.includes(norm);
};

const normalizarProyecto = (raw: any): ProyectoAsignable => {
  const idNum =
    typeof raw.id_proyecto === "number"
      ? raw.id_proyecto
      : typeof raw.id === "number"
      ? raw.id
      : Number.isFinite(Number(raw.id))
      ? Number(raw.id)
      : undefined;
  const idStr = String(raw.id_proyecto ?? raw.id ?? raw.code ?? raw.nombre_proyecto ?? "");
  const estadoStr = String(raw.estado_proyecto ?? raw.status ?? raw.estado ?? "Activo");
  const activo = esEstadoProyectoActivo(estadoStr, raw.activo);

  return {
    id: idStr,
    id_proyecto: idNum,
    codigo: raw.codigo ?? raw.codigo_proyecto ?? raw.code ?? (idNum ? `PRY-${idNum}` : undefined),
    nombre: raw.nombre ?? raw.nombre_proyecto ?? raw.name ?? "Proyecto sin nombre",
    cliente: raw.cliente ?? raw.client ?? null,
    estado: estadoStr,
    activo,
  };
};

const normalizarTecnico = (raw: any): TecnicoAsignable => {
  const idUsuario =
    typeof raw.id_usuario === "number"
      ? raw.id_usuario
      : typeof raw.id === "number"
      ? raw.id
      : undefined;
  const rut = raw.rut ?? undefined;
  const idStr = String(raw.id_usuario ?? raw.id ?? raw.rut ?? raw.nombre ?? "");
  const nombre =
    raw.nombre ??
    raw.name ??
    `${raw.nombre_usuario ?? ""} ${raw.apellido_usuario ?? ""}`.trim() ??
    "Técnico";
  const especialidad = raw.especialidad ?? raw.especializacion ?? raw.specialty ?? "Técnico Operativo";
  const activo = raw.activo !== false && raw.disabled !== true;

  return {
    id: idStr,
    id_usuario: idUsuario,
    rut,
    nombre,
    especialidad,
    activo,
  };
};

const coincidenTecnicos = (
  a: { tecnicoId?: string; tecnicoIdUsuario?: number; tecnicoRut?: string; tecnicoNombre?: string },
  b: TecnicoAsignable
): boolean => {
  if (a.tecnicoIdUsuario !== undefined && b.id_usuario !== undefined) {
    return Number(a.tecnicoIdUsuario) === Number(b.id_usuario);
  }
  if (a.tecnicoRut && b.rut) {
    return a.tecnicoRut.trim().toLowerCase() === b.rut.trim().toLowerCase();
  }
  if (a.tecnicoId && b.id && a.tecnicoId === b.id) {
    return true;
  }
  return (
    Boolean(a.tecnicoNombre && b.nombre) &&
    a.tecnicoNombre!.trim().toLowerCase() === b.nombre.trim().toLowerCase()
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL: AsignacionTecnicos
// ============================================================================

export const AsignacionTecnicos: React.FC<PropiedadesAsignacionTecnicos> = ({
  proyectoIdInicial,
  proyectosProp,
  tecnicosProp,
  onAviso,
  onCancel,
  onCambioAsignacion,
  titulo = "Asignación de Técnicos a Proyectos Activos",
}) => {
  // Contexto opcional de la aplicación (para sincronizar en modo simulado o híbrido)
  let contextoApp: ReturnType<typeof usarAplicacion> | null = null;
  try {
    contextoApp = usarAplicacion();
  } catch {
    contextoApp = null;
  }

  const [cargandoDatos, establecerCargandoDatos] = useState(false);
  const [procesandoAccion, establecerProcesandoAccion] = useState(false);

  // Catálogos completos (incluyen activos e inactivos para filtrar estrictamente activos)
  const [todosProyectos, establecerTodosProyectos] = useState<ProyectoAsignable[]>([]);
  const [todosTecnicos, establecerTodosTecnicos] = useState<TecnicoAsignable[]>([]);

  // Selecciones actuales en las listas desplegables
  const [proyectoSeleccionadoId, establecerProyectoSeleccionadoId] = useState<string>(
    proyectoIdInicial !== undefined ? String(proyectoIdInicial) : ""
  );
  const [tecnicoSeleccionadoId, establecerTecnicoSeleccionadoId] = useState<string>("");

  // Control de apertura de las listas desplegables (Dropdowns)
  const [dropdownProyectoAbierto, establecerDropdownProyectoAbierto] = useState(false);
  const [dropdownTecnicoAbierto, establecerDropdownTecnicoAbierto] = useState(false);

  // Estado de asignaciones activas por ID de proyecto: Record<proyectoId, AsignacionActiva[]>
  const [asignadosPorProyecto, establecerAsignadosPorProyecto] = useState<
    Record<string, AsignacionActiva[]>
  >(() => ({ ...memoriaAsignacionesSesion }));

  // Historial en pantalla (conserva asignaciones y desasignaciones)
  const [historial, establecerHistorial] = useState<RegistroHistorialAsignacion[]>(() => [
    ...memoriaHistorialSesion,
  ]);
  const [filtroHistorial, establecerFiltroHistorial] = useState<"proyecto" | "todos">("proyecto");

  // Mensajes de retroalimentación inmediata en pantalla
  const [mensajeExito, establecerMensajeExito] = useState<string | null>(null);
  const [mensajeError, establecerMensajeError] = useState<string | null>(null);

  const notificarExito = (msg: string) => {
    establecerMensajeExito(msg);
    establecerMensajeError(null);
    onAviso?.(msg);
  };

  // --------------------------------------------------------------------------
  // 1. CARGA Y SINCRONIZACIÓN DE PROYECTOS Y TÉCNICOS
  // --------------------------------------------------------------------------
  const cargarCatalogos = useCallback(async () => {
    establecerCargandoDatos(true);

    // 1.1 Resolver lista de proyectos
    let listaProyectos: ProyectoAsignable[] = [];
    if (proyectosProp && proyectosProp.length > 0) {
      listaProyectos = proyectosProp.map(normalizarProyecto);
    } else {
      const resProy = await listarProyectosApi();
      if (resProy.ok && resProy.data && resProy.data.length > 0) {
        listaProyectos = resProy.data.map(normalizarProyecto);
      } else if (contextoApp?.proyectos && contextoApp.proyectos.length > 0) {
        listaProyectos = contextoApp.proyectos.map(normalizarProyecto);
      } else {
        listaProyectos = PROYECTOS_FALLBACK;
      }
    }
    establecerTodosProyectos(listaProyectos);

    // 1.2 Resolver lista de técnicos
    let listaTecnicos: TecnicoAsignable[] = [];
    if (tecnicosProp && tecnicosProp.length > 0) {
      listaTecnicos = tecnicosProp.map(normalizarTecnico);
    } else {
      const resTec = await listarTecnicosApi();
      if (resTec.ok && resTec.data && resTec.data.length > 0) {
        listaTecnicos = resTec.data.map((t: TecnicoApi) =>
          normalizarTecnico({ ...t, activo: true })
        );
      } else if (contextoApp?.usuariosSistema && contextoApp.usuariosSistema.length > 0) {
        const tecnicosDeUsuarios = contextoApp.usuariosSistema
          .filter((u) => u.role === "technician")
          .map((u) =>
            normalizarTecnico({
              id: u.id_usuario ?? u.id,
              id_usuario: u.id_usuario,
              rut: u.rut,
              nombre: u.name,
              especialidad: u.especializacion ?? "Técnico en Terreno",
              activo: !u.disabled,
            })
          );
        listaTecnicos =
          tecnicosDeUsuarios.length > 0
            ? tecnicosDeUsuarios
            : (contextoApp.tecnicos || []).map(normalizarTecnico);
      } else if (contextoApp?.tecnicos && contextoApp.tecnicos.length > 0) {
        listaTecnicos = contextoApp.tecnicos.map(normalizarTecnico);
      } else {
        listaTecnicos = TECNICOS_FALLBACK;
      }
    }
    establecerTodosTecnicos(listaTecnicos);

    // 1.3 Seleccionar proyecto activo inicial si no hay uno seleccionado
    const activosProy = listaProyectos.filter((p) => p.activo);
    const idInicialStr = proyectoIdInicial !== undefined ? String(proyectoIdInicial) : "";
    const proyectoInicialValido =
      activosProy.find(
        (p) => p.id === idInicialStr || String(p.id_proyecto ?? "") === idInicialStr
      ) ?? activosProy[0];

    if (proyectoInicialValido) {
      establecerProyectoSeleccionadoId((prev) => {
        if (prev && activosProy.some((p) => p.id === prev)) return prev;
        return proyectoInicialValido.id;
      });
    }

    establecerCargandoDatos(false);
  }, [proyectosProp, tecnicosProp, proyectoIdInicial]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // Si cambia proyectoIdInicial desde las props, sincronizar selección
  useEffect(() => {
    if (proyectoIdInicial !== undefined) {
      const buscado = String(proyectoIdInicial);
      const encontrado = todosProyectos.find(
        (p) => p.id === buscado || String(p.id_proyecto ?? "") === buscado
      );
      if (encontrado && encontrado.activo) {
        establecerProyectoSeleccionadoId(encontrado.id);
      } else if (!proyectoSeleccionadoId) {
        establecerProyectoSeleccionadoId(buscado);
      }
    }
  }, [proyectoIdInicial, todosProyectos]);

  // --------------------------------------------------------------------------
  // 2. FILTRADO ESTRICTO: SOLO PROYECTOS ACTIVOS Y TÉCNICOS ACTIVOS
  // --------------------------------------------------------------------------
  const proyectosActivos = useMemo(
    () => todosProyectos.filter((p) => p.activo),
    [todosProyectos]
  );

  const proyectosInactivosOmitidos = useMemo(
    () => Math.max(0, todosProyectos.length - proyectosActivos.length),
    [todosProyectos, proyectosActivos]
  );

  const tecnicosActivos = useMemo(
    () => todosTecnicos.filter((t) => t.activo),
    [todosTecnicos]
  );

  const proyectoActual = useMemo(
    () =>
      proyectosActivos.find(
        (p) =>
          p.id === proyectoSeleccionadoId ||
          String(p.id_proyecto ?? "") === proyectoSeleccionadoId
      ) ??
      todosProyectos.find(
        (p) =>
          p.id === proyectoSeleccionadoId ||
          String(p.id_proyecto ?? "") === proyectoSeleccionadoId
      ) ??
      null,
    [proyectosActivos, todosProyectos, proyectoSeleccionadoId]
  );

  const claveProyectoActual = proyectoActual?.id ?? proyectoSeleccionadoId;

  // --------------------------------------------------------------------------
  // 3. CARGAR ASIGNADOS DEL PROYECTO SELECCIONADO (API O CONTEXTO)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!claveProyectoActual) return;

    let cancelado = false;

    const cargarAsignadosProyecto = async () => {
      // Si ya tenemos estado en memoria de sesión para este proyecto, lo respetamos y sincronizamos con API si aplica
      const idNumerico = proyectoActual?.id_proyecto ?? Number(claveProyectoActual);

      if (Number.isFinite(idNumerico) && idNumerico > 0 && !proyectosProp) {
        const res = await listarTecnicosDeProyectoApi(idNumerico);
        if (!cancelado && res.ok && res.data) {
          const ahora = formatearHoraFecha();
          const mapeados: AsignacionActiva[] = res.data.map((t: TecnicoApi) => {
            const infoExtra = todosTecnicos.find((x) => x.id_usuario === t.id_usuario);
            return {
              id: `asig-${claveProyectoActual}-${t.id_usuario}`,
              proyectoId: claveProyectoActual,
              proyectoNombre: proyectoActual?.nombre ?? `Proyecto #${claveProyectoActual}`,
              proyectoCodigo: proyectoActual?.codigo,
              tecnicoId: String(t.id_usuario),
              tecnicoIdUsuario: t.id_usuario,
              tecnicoRut: infoExtra?.rut,
              tecnicoNombre: t.nombre,
              tecnicoEspecialidad: infoExtra?.especialidad ?? "Técnico Operativo",
              fechaAsignacion: ahora,
            };
          });

          memoriaAsignacionesSesion[claveProyectoActual] = mapeados;
          establecerAsignadosPorProyecto((prev) => ({
            ...prev,
            [claveProyectoActual]: mapeados,
          }));

          // Asegurar que las asignaciones iniciales figuren en el historial en pantalla
          if (mapeados.length > 0) {
            establecerHistorial((prevHist) => {
              let nuevoHist = [...prevHist];
              mapeados.forEach((asig) => {
                const yaExiste = nuevoHist.some(
                  (h) =>
                    h.proyectoId === claveProyectoActual &&
                    (h.tecnicoId === asig.tecnicoId || h.tecnicoNombre === asig.tecnicoNombre)
                );
                if (!yaExiste) {
                  const itemHist: RegistroHistorialAsignacion = {
                    id: `hist-init-${claveProyectoActual}-${asig.tecnicoId}`,
                    proyectoId: claveProyectoActual,
                    proyectoNombre: asig.proyectoNombre,
                    proyectoCodigo: asig.proyectoCodigo,
                    tecnicoId: asig.tecnicoId,
                    tecnicoNombre: asig.tecnicoNombre,
                    tecnicoRut: asig.tecnicoRut,
                    tecnicoEspecialidad: asig.tecnicoEspecialidad,
                    accion: "asignado",
                    estadoActual: "activo",
                    fechaAsignacion: asig.fechaAsignacion,
                    detalle: "Asignación activa en el proyecto",
                  };
                  nuevoHist = [itemHist, ...nuevoHist];
                }
              });
              memoriaHistorialSesion = nuevoHist;
              return nuevoHist;
            });
          }
          return;
        }
      }

      // Fallback desde ContextoAplicacion si no se cargó desde el backend
      if (!cancelado && !memoriaAsignacionesSesion[claveProyectoActual] && contextoApp?.proyectos) {
        const proyCtx = contextoApp.proyectos.find(
          (p) => p.id === claveProyectoActual || p.code === proyectoActual?.codigo
        );
        if (proyCtx && proyCtx.technicianRuts.length > 0) {
          const ahora = formatearHoraFecha();
          const desdeCtx: AsignacionActiva[] = proyCtx.technicianRuts
            .map((rut) => {
              const tec = todosTecnicos.find((t) => t.rut === rut);
              if (!tec) return null;
              return {
                id: `asig-${claveProyectoActual}-${tec.id}`,
                proyectoId: claveProyectoActual,
                proyectoNombre: proyCtx.name,
                proyectoCodigo: proyCtx.code,
                tecnicoId: tec.id,
                tecnicoIdUsuario: tec.id_usuario,
                tecnicoRut: tec.rut,
                tecnicoNombre: tec.nombre,
                tecnicoEspecialidad: tec.especialidad,
                fechaAsignacion: ahora,
              };
            })
            .filter(Boolean) as AsignacionActiva[];

          memoriaAsignacionesSesion[claveProyectoActual] = desdeCtx;
          establecerAsignadosPorProyecto((prev) => ({
            ...prev,
            [claveProyectoActual]: desdeCtx,
          }));
        }
      }
    };

    cargarAsignadosProyecto();
    return () => {
      cancelado = true;
    };
  }, [claveProyectoActual, proyectoActual?.id_proyecto, proyectoActual?.nombre, todosTecnicos.length]);

  // --------------------------------------------------------------------------
  // 4. [SCRUM] TÉCNICOS DISPONIBLES EN EL DROPDOWN (SIN DUPLICADOS)
  // Cuando se asigna un técnico al proyecto actual, desaparece de inmediato
  // de las opciones de la lista desplegable para evitar reasignación duplicada.
  // --------------------------------------------------------------------------
  const asignadosProyectoActual = useMemo(
    () => asignadosPorProyecto[claveProyectoActual] ?? [],
    [asignadosPorProyecto, claveProyectoActual]
  );

  const tecnicosDisponiblesDropdown = useMemo(
    () =>
      tecnicosActivos.filter(
        (t) => !asignadosProyectoActual.some((asig) => coincidenTecnicos(asig, t))
      ),
    [tecnicosActivos, asignadosProyectoActual]
  );

  // Mantener sincronizada la selección del dropdown de técnicos:
  // Si el técnico seleccionado ya fue asignado (y por ende desapareció del dropdown),
  // limpiar o pasar automáticamente al primer técnico disponible.
  useEffect(() => {
    if (
      tecnicoSeleccionadoId &&
      !tecnicosDisponiblesDropdown.some((t) => t.id === tecnicoSeleccionadoId)
    ) {
      establecerTecnicoSeleccionadoId(tecnicosDisponiblesDropdown[0]?.id ?? "");
    } else if (!tecnicoSeleccionadoId && tecnicosDisponiblesDropdown.length > 0) {
      establecerTecnicoSeleccionadoId(tecnicosDisponiblesDropdown[0].id);
    }
  }, [tecnicosDisponiblesDropdown, tecnicoSeleccionadoId]);

  const tecnicoSeleccionadoObj = useMemo(
    () => tecnicosDisponiblesDropdown.find((t) => t.id === tecnicoSeleccionadoId) ?? null,
    [tecnicosDisponiblesDropdown, tecnicoSeleccionadoId]
  );

  // --------------------------------------------------------------------------
  // 5. ACCIÓN: ASIGNAR TÉCNICO (CAMBIO AL INSTANTE + HISTORIAL EN PANTALLA)
  // --------------------------------------------------------------------------
  const manejarAsignarTecnico = async (tecnicoExplicito?: TecnicoAsignable) => {
    establecerMensajeError(null);
    establecerMensajeExito(null);

    if (!proyectoActual || !proyectoActual.activo) {
      establecerMensajeError("Debe seleccionar un proyecto activo válido.");
      return;
    }

    const tecnicoAAsignar = tecnicoExplicito ?? tecnicoSeleccionadoObj;
    if (!tecnicoAAsignar) {
      establecerMensajeError(
        tecnicosDisponiblesDropdown.length === 0
          ? "Todos los técnicos activos ya están asignados a este proyecto."
          : "Debe seleccionar un técnico activo de la lista desplegable."
      );
      return;
    }

    // Validación estricta contra duplicados
    const yaAsignado = asignadosProyectoActual.some((a) =>
      coincidenTecnicos(a, tecnicoAAsignar)
    );
    if (yaAsignado) {
      establecerMensajeError(
        `El técnico ${tecnicoAAsignar.nombre} ya se encuentra asignado a este proyecto.`
      );
      return;
    }

    const fechaAhora = formatearHoraFecha();
    const nuevaAsignacion: AsignacionActiva = {
      id: `asig-${claveProyectoActual}-${tecnicoAAsignar.id}-${Date.now()}`,
      proyectoId: claveProyectoActual,
      proyectoNombre: proyectoActual.nombre,
      proyectoCodigo: proyectoActual.codigo,
      tecnicoId: tecnicoAAsignar.id,
      tecnicoIdUsuario: tecnicoAAsignar.id_usuario,
      tecnicoRut: tecnicoAAsignar.rut,
      tecnicoNombre: tecnicoAAsignar.nombre,
      tecnicoEspecialidad: tecnicoAAsignar.especialidad,
      fechaAsignacion: fechaAhora,
    };

    const nuevoRegistroHistorial: RegistroHistorialAsignacion = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      proyectoId: claveProyectoActual,
      proyectoNombre: proyectoActual.nombre,
      proyectoCodigo: proyectoActual.codigo,
      tecnicoId: tecnicoAAsignar.id,
      tecnicoNombre: tecnicoAAsignar.nombre,
      tecnicoRut: tecnicoAAsignar.rut,
      tecnicoEspecialidad: tecnicoAAsignar.especialidad,
      accion: "asignado",
      estadoActual: "activo",
      fechaAsignacion: fechaAhora,
      detalle: `Asignado a "${proyectoActual.nombre}"`,
    };

    // 1) Reflejar cambios AL INSTANTE en la interfaz (estado optimista inmediato)
    const nuevasAsignacionesProyecto = [...asignadosProyectoActual, nuevaAsignacion];
    memoriaAsignacionesSesion[claveProyectoActual] = nuevasAsignacionesProyecto;
    establecerAsignadosPorProyecto((prev) => ({
      ...prev,
      [claveProyectoActual]: nuevasAsignacionesProyecto,
    }));

    const nuevoHistorial = [nuevoRegistroHistorial, ...historial];
    memoriaHistorialSesion = nuevoHistorial;
    establecerHistorial(nuevoHistorial);

    // Cerrar dropdown si estaba abierto
    establecerDropdownTecnicoAbierto(false);

    // Sincronizar con ContextoAplicacion si existe el proyecto por RUT
    if (contextoApp?.asignarTecnicosAProyecto && tecnicoAAsignar.rut) {
      const proyCtx = contextoApp.proyectos.find(
        (p) => p.id === claveProyectoActual || p.code === proyectoActual.codigo
      );
      if (proyCtx) {
        const siguientesRuts = Array.from(
          new Set([...proyCtx.technicianRuts, tecnicoAAsignar.rut])
        );
        contextoApp.asignarTecnicosAProyecto(proyCtx.id, siguientesRuts);
      }
    }

    onCambioAsignacion?.(nuevasAsignacionesProyecto);
    notificarExito(
      `Técnico "${tecnicoAAsignar.nombre}" asignado a "${proyectoActual.nombre}". Ya no aparece en la opción de reasignación duplicada.`
    );

    // 2) Persistir en el backend si tenemos IDs numéricos de BD
    const idProyectoNum = proyectoActual.id_proyecto ?? Number(claveProyectoActual);
    const idUsuarioNum = tecnicoAAsignar.id_usuario ?? Number(tecnicoAAsignar.id);
    if (Number.isFinite(idProyectoNum) && idProyectoNum > 0 && Number.isFinite(idUsuarioNum) && idUsuarioNum > 0) {
      establecerProcesandoAccion(true);
      const resApi = await asignarTecnicoApi(idProyectoNum, idUsuarioNum);
      establecerProcesandoAccion(false);

      // Si el backend responde 409 (ya asignado) o 201 (creado), mantenemos el estado sincronizado
      if (!resApi.ok && resApi.error && !resApi.error.includes("No se pudo conectar")) {
        // Solo revertir si el servidor rechazó por regla de negocio distinta a offline
        if (!resApi.error.toLowerCase().includes("ya está asignado")) {
          establecerMensajeError(resApi.error);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // 6. ACCIÓN: DESASIGNAR TÉCNICO (CONSERVANDO EL HISTORIAL EN PANTALLA)
  // --------------------------------------------------------------------------
  const manejarDesasignarTecnico = async (asignacion: AsignacionActiva) => {
    establecerMensajeError(null);
    establecerMensajeExito(null);

    const fechaDesasignacion = formatearHoraFecha();
    const proyId = asignacion.proyectoId;

    // 1) Quitar al instante de las asignaciones activas del proyecto
    const actuales = asignadosPorProyecto[proyId] ?? [];
    const restantes = actuales.filter((a) => a.id !== asignacion.id && a.tecnicoId !== asignacion.tecnicoId);

    memoriaAsignacionesSesion[proyId] = restantes;
    establecerAsignadosPorProyecto((prev) => ({
      ...prev,
      [proyId]: restantes,
    }));

    // 2) CONSERVAR EL HISTORIAL EN PANTALLA:
    // - Los registros previos de asignación se marcan como "desasignado" con su fecha de término
    // - Y se agrega el evento de desasignación al historial visible en pantalla
    const eventoDesasignacion: RegistroHistorialAsignacion = {
      id: `hist-des-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      proyectoId: asignacion.proyectoId,
      proyectoNombre: asignacion.proyectoNombre,
      proyectoCodigo: asignacion.proyectoCodigo,
      tecnicoId: asignacion.tecnicoId,
      tecnicoNombre: asignacion.tecnicoNombre,
      tecnicoRut: asignacion.tecnicoRut,
      tecnicoEspecialidad: asignacion.tecnicoEspecialidad,
      accion: "desasignado",
      estadoActual: "desasignado",
      fechaAsignacion: asignacion.fechaAsignacion,
      fechaDesasignacion,
      detalle: `Desasignado de "${asignacion.proyectoNombre}" (historial conservado)`,
    };

    const historialActualizado = [
      eventoDesasignacion,
      ...historial.map((h) =>
        h.proyectoId === proyId &&
        (h.tecnicoId === asignacion.tecnicoId || h.tecnicoNombre === asignacion.tecnicoNombre) &&
        h.estadoActual === "activo"
          ? {
              ...h,
              estadoActual: "desasignado" as const,
              fechaDesasignacion,
            }
          : h
      ),
    ];

    memoriaHistorialSesion = historialActualizado;
    establecerHistorial(historialActualizado);

    // Sincronizar con ContextoAplicacion si existe
    if (contextoApp?.asignarTecnicosAProyecto && asignacion.tecnicoRut) {
      const proyCtx = contextoApp.proyectos.find(
        (p) => p.id === proyId || p.code === asignacion.proyectoCodigo
      );
      if (proyCtx) {
        const siguientesRuts = proyCtx.technicianRuts.filter((r) => r !== asignacion.tecnicoRut);
        contextoApp.asignarTecnicosAProyecto(proyCtx.id, siguientesRuts);
      }
    }

    onCambioAsignacion?.(restantes);
    notificarExito(
      `Técnico "${asignacion.tecnicoNombre}" desasignado de "${asignacion.proyectoNombre}". El registro se conserva en el historial en pantalla.`
    );

    // 3) Persistir en el backend si tiene IDs numéricos
    const idProyectoNum = proyectoActual?.id_proyecto ?? Number(proyId);
    const idUsuarioNum = asignacion.tecnicoIdUsuario ?? Number(asignacion.tecnicoId);
    if (Number.isFinite(idProyectoNum) && idProyectoNum > 0 && Number.isFinite(idUsuarioNum) && idUsuarioNum > 0) {
      establecerProcesandoAccion(true);
      await quitarTecnicoApi(idProyectoNum, idUsuarioNum);
      establecerProcesandoAccion(false);
    }
  };

  // Historial filtrado según pestaña ("proyecto" o "todos")
  const historialVisible = useMemo(() => {
    if (filtroHistorial === "todos" || !claveProyectoActual) return historial;
    return historial.filter((h) => h.proyectoId === claveProyectoActual);
  }, [historial, filtroHistorial, claveProyectoActual]);

  const inicialNombre = (nombre: string) =>
    (nombre || "T").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.contenedorTarjeta}>
      {/* =================================================================== */}
      {/* ENCABEZADO DEL PANEL DE ASIGNACIÓN                                  */}
      {/* =================================================================== */}
      <View style={styles.encabezado}>
        <View style={{ flex: 1 }}>
          <View style={styles.insigniaSuperiorFila}>
            <View style={styles.insigniaActiva}>
              <Ionicons name="flash-outline" size={12} color="#1d4ed8" />
              <Text style={styles.insigniaActivaTexto}>TIEMPO REAL • SIN DUPLICADOS</Text>
            </View>
            <View style={styles.insigniaFiltroActivo}>
              <Ionicons name="checkmark-circle" size={12} color="#047857" />
              <Text style={styles.insigniaFiltroActivoTexto}>
                Solo Técnicos y Proyectos Activos
              </Text>
            </View>
          </View>

          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.subtitulo}>
            Selecciona un proyecto activo y un técnico activo disponible. Los cambios se reflejan al instante y el historial se conserva en pantalla.
          </Text>
        </View>

        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            style={styles.botonCerrar}
            accessibilityLabel="Cerrar panel de asignación"
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {/* =================================================================== */}
      {/* BANNERS DE RETROALIMENTACIÓN INSTANTÁNEA                            */}
      {/* =================================================================== */}
      {mensajeExito && (
        <View style={styles.bannerExito}>
          <Ionicons name="checkmark-circle" size={18} color="#15803d" />
          <Text style={styles.bannerExitoTexto}>{mensajeExito}</Text>
          <TouchableOpacity onPress={() => establecerMensajeExito(null)}>
            <Ionicons name="close" size={16} color="#15803d" />
          </TouchableOpacity>
        </View>
      )}

      {mensajeError && (
        <View style={styles.bannerError}>
          <Ionicons name="alert-circle" size={18} color="#b91c1c" />
          <Text style={styles.bannerErrorTexto}>{mensajeError}</Text>
          <TouchableOpacity onPress={() => establecerMensajeError(null)}>
            <Ionicons name="close" size={16} color="#b91c1c" />
          </TouchableOpacity>
        </View>
      )}

      {cargandoDatos ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator color={tema.colors.primary} size="small" />
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
            Sincronizando técnicos y proyectos activos...
          </Text>
        </View>
      ) : (
        <>
          {/* =============================================================== */}
          {/* SECCIÓN 1: LISTAS DESPLEGABLES (PROYECTOS Y TÉCNICOS ACTIVOS)   */}
          {/* =============================================================== */}
          <View style={styles.formularioCaja}>
            <View style={styles.selectoresGrilla}>
              {/* 1.1 LISTA DESPLEGABLE DE PROYECTOS ACTIVOS */}
              <View style={styles.columnaSelector}>
                <View style={styles.etiquetaFila}>
                  <Text style={styles.etiquetaCampo}>
                    1. Proyecto Activo <Text style={styles.asterisco}>*</Text>
                  </Text>
                  <Text style={styles.contadorOpciones}>
                    {proyectosActivos.length} activo(s)
                    {proyectosInactivosOmitidos > 0
                      ? ` • ${proyectosInactivosOmitidos} cerrado(s) oculto(s)`
                      : ""}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dropdownTrigger,
                    dropdownProyectoAbierto && styles.dropdownTriggerAbierto,
                  ]}
                  onPress={() => {
                    establecerDropdownProyectoAbierto((prev) => !prev);
                    establecerDropdownTecnicoAbierto(false);
                  }}
                  accessibilityRole="combobox"
                  accessibilityLabel="Lista desplegable de proyectos activos"
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="business-outline"
                    size={18}
                    color={tema.colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownValorTexto} numberOfLines={1}>
                      {proyectoActual
                        ? `${proyectoActual.codigo ? `${proyectoActual.codigo} • ` : ""}${proyectoActual.nombre}`
                        : "Seleccione un proyecto activo..."}
                    </Text>
                    {proyectoActual && (
                      <Text style={styles.dropdownSubtexto} numberOfLines={1}>
                        Estado: {proyectoActual.estado} • Cliente:{" "}
                        {proyectoActual.cliente || "General"}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={dropdownProyectoAbierto ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#475569"
                  />
                </TouchableOpacity>

                {/* MENÚ DESPLEGABLE DE PROYECTOS ACTIVOS */}
                {dropdownProyectoAbierto && (
                  <View style={styles.dropdownMenu}>
                    <View style={styles.dropdownMenuHeader}>
                      <Text style={styles.dropdownMenuHeaderTexto}>
                        PROYECTOS ACTIVOS DISPONIBLES ({proyectosActivos.length})
                      </Text>
                    </View>
                    {proyectosActivos.length === 0 ? (
                      <View style={styles.dropdownVacio}>
                        <Text style={styles.dropdownVacioTexto}>
                          No hay proyectos activos registrados en este momento.
                        </Text>
                      </View>
                    ) : (
                      <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled>
                        {proyectosActivos.map((proy) => {
                          const seleccionado = proy.id === claveProyectoActual;
                          const cantAsignados = (asignadosPorProyecto[proy.id] ?? []).length;
                          return (
                            <TouchableOpacity
                              key={proy.id}
                              style={[
                                styles.dropdownOpcion,
                                seleccionado && styles.dropdownOpcionSeleccionada,
                              ]}
                              onPress={() => {
                                establecerProyectoSeleccionadoId(proy.id);
                                establecerDropdownProyectoAbierto(false);
                                establecerMensajeError(null);
                              }}
                            >
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.dropdownOpcionTitulo,
                                    seleccionado && styles.dropdownOpcionTituloSel,
                                  ]}
                                >
                                  {proy.codigo ? `${proy.codigo} — ` : ""}
                                  {proy.nombre}
                                </Text>
                                <Text style={styles.dropdownOpcionMeta}>
                                  {proy.cliente || "Sin cliente"} • Estado: {proy.estado} •{" "}
                                  {cantAsignados} técnico(s) asignado(s)
                                </Text>
                              </View>
                              <View style={styles.chipEstadoActivo}>
                                <Text style={styles.chipEstadoActivoTexto}>ACTIVO</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              {/* 1.2 LISTA DESPLEGABLE DE TÉCNICOS ACTIVOS (EXCLUYE YA ASIGNADOS) */}
              <View style={styles.columnaSelector}>
                <View style={styles.etiquetaFila}>
                  <Text style={styles.etiquetaCampo}>
                    2. Técnico Activo Disponible <Text style={styles.asterisco}>*</Text>
                  </Text>
                  <Text style={styles.contadorOpciones}>
                    {tecnicosDisponiblesDropdown.length} disponible(s) de {tecnicosActivos.length} activo(s)
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dropdownTrigger,
                    dropdownTecnicoAbierto && styles.dropdownTriggerAbierto,
                    tecnicosDisponiblesDropdown.length === 0 && styles.dropdownTriggerDeshabilitado,
                  ]}
                  onPress={() => {
                    establecerDropdownTecnicoAbierto((prev) => !prev);
                    establecerDropdownProyectoAbierto(false);
                  }}
                  accessibilityRole="combobox"
                  accessibilityLabel="Lista desplegable de técnicos activos disponibles"
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={18}
                    color={
                      tecnicosDisponiblesDropdown.length === 0
                        ? "#94a3b8"
                        : tema.colors.primary
                    }
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.dropdownValorTexto,
                        !tecnicoSeleccionadoObj && { color: "#64748b" },
                      ]}
                      numberOfLines={1}
                    >
                      {tecnicoSeleccionadoObj
                        ? tecnicoSeleccionadoObj.nombre
                        : tecnicosDisponiblesDropdown.length === 0
                        ? "Sin técnicos disponibles (todos asignados)"
                        : "Seleccione un técnico activo..."}
                    </Text>
                    {tecnicoSeleccionadoObj ? (
                      <Text style={styles.dropdownSubtexto} numberOfLines={1}>
                        {tecnicoSeleccionadoObj.especialidad || "Técnico"}
                        {tecnicoSeleccionadoObj.rut ? ` • RUT: ${tecnicoSeleccionadoObj.rut}` : ""}
                      </Text>
                    ) : (
                      <Text style={styles.dropdownSubtexto} numberOfLines={1}>
                        Los técnicos ya asignados se ocultan automáticamente
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={dropdownTecnicoAbierto ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#475569"
                  />
                </TouchableOpacity>

                {/* MENÚ DESPLEGABLE DE TÉCNICOS ACTIVOS (SIN DUPLICADOS) */}
                {dropdownTecnicoAbierto && (
                  <View style={styles.dropdownMenu}>
                    <View style={styles.dropdownMenuHeader}>
                      <Text style={styles.dropdownMenuHeaderTexto}>
                        TÉCNICOS ACTIVOS SIN ASIGNAR EN ESTE PROYECTO (
                        {tecnicosDisponiblesDropdown.length})
                      </Text>
                    </View>
                    {tecnicosActivos.length === 0 ? (
                      <View style={styles.dropdownVacio}>
                        <Text style={styles.dropdownVacioTexto}>
                          No existen usuarios con rol Técnico en estado activo.
                        </Text>
                      </View>
                    ) : tecnicosDisponiblesDropdown.length === 0 ? (
                      <View style={styles.dropdownVacio}>
                        <Ionicons name="checkmark-done-circle" size={22} color="#059669" />
                        <Text style={styles.dropdownVacioTexto}>
                          Todos los técnicos activos ya están asignados a este proyecto (protección contra reasignación duplicada activa).
                        </Text>
                      </View>
                    ) : (
                      <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled>
                        {tecnicosDisponiblesDropdown.map((tec) => {
                          const seleccionado = tec.id === tecnicoSeleccionadoId;
                          return (
                            <TouchableOpacity
                              key={tec.id}
                              style={[
                                styles.dropdownOpcion,
                                seleccionado && styles.dropdownOpcionSeleccionada,
                              ]}
                              onPress={() => {
                                establecerTecnicoSeleccionadoId(tec.id);
                                establecerDropdownTecnicoAbierto(false);
                                establecerMensajeError(null);
                              }}
                            >
                              <View style={styles.avatarMini}>
                                <Text style={styles.avatarMiniTexto}>
                                  {inicialNombre(tec.nombre)}
                                </Text>
                              </View>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.dropdownOpcionTitulo,
                                    seleccionado && styles.dropdownOpcionTituloSel,
                                  ]}
                                >
                                  {tec.nombre}
                                </Text>
                                <Text style={styles.dropdownOpcionMeta}>
                                  {tec.especialidad || "Técnico Operativo"}
                                  {tec.rut ? ` • RUT: ${tec.rut}` : ""}
                                </Text>
                              </View>
                              <View style={styles.chipEstadoActivo}>
                                <Text style={styles.chipEstadoActivoTexto}>DISPONIBLE</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {asignadosProyectoActual.length > 0 && (
                      <View style={styles.dropdownFooterNota}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#047857" />
                        <Text style={styles.dropdownFooterNotaTexto}>
                          {asignadosProyectoActual.length} técnico(s) ya asignado(s) omitido(s) de esta lista para impedir duplicados:
                          {" "}
                          {asignadosProyectoActual.map((a) => a.tecnicoNombre).join(", ")}.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* FILA INFERIOR DEL FORMULARIO: NOTA DE REGLA DE NEGOCIO Y BOTÓN ASIGNAR */}
            <View style={styles.barraAccionAsignar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notaPrevencionDuplicados}>
                  ✓ Regla activa: Al asignar un técnico, desaparece inmediatamente de la lista desplegable de reasignación para este proyecto.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.botonAsignarPrincipal,
                  (!tecnicoSeleccionadoObj || !proyectoActual || procesandoAccion) &&
                    styles.botonAsignarDeshabilitado,
                ]}
                onPress={() => manejarAsignarTecnico()}
                disabled={!tecnicoSeleccionadoObj || !proyectoActual || procesandoAccion}
                accessibilityRole="button"
                accessibilityLabel="Asignar técnico seleccionado al proyecto"
              >
                {procesandoAccion ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={16} color="#ffffff" />
                    <Text style={styles.botonAsignarPrincipalTexto}>Asignar Técnico</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* =============================================================== */}
          {/* SECCIÓN 2: TÉCNICOS ASIGNADOS ACTUALMENTE AL PROYECTO           */}
          {/* =============================================================== */}
          <View style={styles.seccionCaja}>
            <View style={styles.seccionEncabezado}>
              <View style={{ flex: 1 }}>
                <Text style={styles.seccionTitulo}>
                  Técnicos Asignados en "{proyectoActual?.nombre ?? "Proyecto"}"
                </Text>
                <Text style={styles.seccionSubtitulo}>
                  {asignadosProyectoActual.length} técnico(s) activo(s) en faena • Puedes desasignar en cualquier momento conservando el historial
                </Text>
              </View>
              <View style={styles.contadorPastilla}>
                <Text style={styles.contadorPastillaTexto}>
                  {asignadosProyectoActual.length} Asignado(s)
                </Text>
              </View>
            </View>

            {asignadosProyectoActual.length === 0 ? (
              <View style={styles.estadoVacioCaja}>
                <Ionicons name="people-outline" size={26} color="#94a3b8" />
                <Text style={styles.estadoVacioTitulo}>
                  Sin técnicos asignados actualmente
                </Text>
                <Text style={styles.estadoVacioSub}>
                  Utiliza la lista desplegable superior para asignar un técnico activo a este proyecto.
                </Text>
              </View>
            ) : (
              <View style={styles.listaAsignados}>
                {asignadosProyectoActual.map((asig) => (
                  <View key={asig.id} style={styles.filaAsignado}>
                    <View style={styles.avatarGrande}>
                      <Text style={styles.avatarGrandeTexto}>
                        {inicialNombre(asig.tecnicoNombre)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginRight: 10 }}>
                      <View style={styles.nombreInsigniaFila}>
                        <Text style={styles.asignadoNombre}>{asig.tecnicoNombre}</Text>
                        <View style={styles.pastillaEnFaena}>
                          <Text style={styles.pastillaEnFaenaTexto}>ASIGNADO</Text>
                        </View>
                      </View>
                      <Text style={styles.asignadoMeta}>
                        {asig.tecnicoEspecialidad || "Técnico Operativo"}
                        {asig.tecnicoRut ? ` • RUT: ${asig.tecnicoRut}` : ""}
                      </Text>
                      <Text style={styles.asignadoFecha}>
                        Asignado el {asig.fechaAsignacion}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.botonDesasignar}
                      onPress={() => manejarDesasignarTecnico(asig)}
                      accessibilityRole="button"
                      accessibilityLabel={`Desasignar a ${asig.tecnicoNombre}`}
                    >
                      <Ionicons name="person-remove-outline" size={15} color="#dc2626" />
                      <Text style={styles.botonDesasignarTexto}>Desasignar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* =============================================================== */}
          {/* SECCIÓN 3: HISTORIAL DE ASIGNACIONES CONSERVADO EN PANTALLA     */}
          {/* =============================================================== */}
          <View style={styles.seccionHistorialCaja}>
            <View style={styles.seccionEncabezado}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="time-outline" size={18} color="#1e40af" />
                  <Text style={styles.seccionTitulo}>
                    Historial de Asignaciones en Pantalla
                  </Text>
                </View>
                <Text style={styles.seccionSubtitulo}>
                  Registro inmutable en pantalla: conserva tanto las asignaciones vigentes como las desasignaciones realizadas
                </Text>
              </View>

              <View style={styles.filtrosHistorialGrupo}>
                <Pressable
                  style={[
                    styles.chipFiltroHist,
                    filtroHistorial === "proyecto" && styles.chipFiltroHistActivo,
                  ]}
                  onPress={() => establecerFiltroHistorial("proyecto")}
                >
                  <Text
                    style={[
                      styles.chipFiltroHistTexto,
                      filtroHistorial === "proyecto" && styles.chipFiltroHistTextoActivo,
                    ]}
                  >
                    Este proyecto
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chipFiltroHist,
                    filtroHistorial === "todos" && styles.chipFiltroHistActivo,
                  ]}
                  onPress={() => establecerFiltroHistorial("todos")}
                >
                  <Text
                    style={[
                      styles.chipFiltroHistTexto,
                      filtroHistorial === "todos" && styles.chipFiltroHistTextoActivo,
                    ]}
                  >
                    Todos ({historial.length})
                  </Text>
                </Pressable>
              </View>
            </View>

            {historialVisible.length === 0 ? (
              <View style={styles.estadoVacioCaja}>
                <Ionicons name="document-text-outline" size={24} color="#94a3b8" />
                <Text style={styles.estadoVacioSub}>
                  Aún no hay movimientos en el historial para esta vista. Al asignar o desasignar técnicos, quedarán registrados aquí.
                </Text>
              </View>
            ) : (
              <View style={styles.listaHistorial}>
                {historialVisible.map((item) => {
                  const esEventoAsignacion = item.accion === "asignado";
                  const sigueActivo = item.estadoActual === "activo";
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.filaHistorial,
                        !esEventoAsignacion && styles.filaHistorialDesasignado,
                      ]}
                    >
                      <View
                        style={[
                          styles.iconoHistorialCirculo,
                          esEventoAsignacion
                            ? styles.iconoHistorialAsignado
                            : styles.iconoHistorialDesasignado,
                        ]}
                      >
                        <Ionicons
                          name={
                            esEventoAsignacion
                              ? "checkmark-circle-outline"
                              : "return-up-back-outline"
                          }
                          size={16}
                          color={esEventoAsignacion ? "#15803d" : "#b45309"}
                        />
                      </View>

                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.nombreInsigniaFila}>
                          <Text style={styles.historialTecnicoNombre}>
                            {item.tecnicoNombre}
                          </Text>
                          <View
                            style={[
                              styles.insigniaAccionHist,
                              esEventoAsignacion
                                ? styles.insigniaAccionAsignado
                                : styles.insigniaAccionDesasignado,
                            ]}
                          >
                            <Text
                              style={[
                                styles.insigniaAccionHistTexto,
                                esEventoAsignacion
                                  ? { color: "#15803d" }
                                  : { color: "#b45309" },
                              ]}
                            >
                              {esEventoAsignacion ? "ASIGNACIÓN" : "DESASIGNACIÓN"}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.insigniaEstadoHist,
                              sigueActivo
                                ? styles.insigniaEstadoVigente
                                : styles.insigniaEstadoFinalizado,
                            ]}
                          >
                            <Text
                              style={[
                                styles.insigniaEstadoHistTexto,
                                sigueActivo
                                  ? { color: "#1d4ed8" }
                                  : { color: "#475569" },
                              ]}
                            >
                              {sigueActivo ? "Vigente en proyecto" : "Desasignado (Histórico)"}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.historialProyectoTexto}>
                          Proyecto: {item.proyectoCodigo ? `${item.proyectoCodigo} • ` : ""}
                          {item.proyectoNombre}
                        </Text>

                        <View style={styles.historialFechasFila}>
                          <Text style={styles.historialFechaTexto}>
                            Asignado: {item.fechaAsignacion}
                          </Text>
                          {item.fechaDesasignacion && (
                            <Text style={styles.historialFechaDesasignacionTexto}>
                              • Desasignado: {item.fechaDesasignacion}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
};

export default AsignacionTecnicos;

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  contenedorTarjeta: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    marginVertical: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  insigniaSuperiorFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  insigniaActiva: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  insigniaActivaTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
    letterSpacing: 0.3,
  },
  insigniaFiltroActivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  insigniaFiltroActivoTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  titulo: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitulo: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 3,
    lineHeight: 17,
  },
  botonCerrar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  bannerExito: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerExitoTexto: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
  },
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerErrorTexto: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#b91c1c",
  },
  formularioCaja: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  selectoresGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  columnaSelector: {
    flex: 1,
    minWidth: 250,
  },
  etiquetaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  etiquetaCampo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  asterisco: {
    color: "#dc2626",
  },
  contadorOpciones: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  dropdownTriggerAbierto: {
    borderColor: tema.colors.primary,
    backgroundColor: "#eff6ff",
  },
  dropdownTriggerDeshabilitado: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  dropdownValorTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  dropdownSubtexto: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownMenuHeader: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  dropdownMenuHeaderTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1e40af",
    letterSpacing: 0.4,
  },
  dropdownOpcion: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownOpcionSeleccionada: {
    backgroundColor: "#eff6ff",
  },
  dropdownOpcionTitulo: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  dropdownOpcionTituloSel: {
    fontWeight: "700",
    color: "#1d4ed8",
  },
  dropdownOpcionMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  dropdownVacio: {
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  dropdownVacioTexto: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  dropdownFooterNota: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#bbf7d0",
  },
  dropdownFooterNotaTexto: {
    flex: 1,
    fontSize: 11,
    color: "#065f46",
    fontWeight: "500",
  },
  chipEstadoActivo: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipEstadoActivoTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803d",
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarMiniTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e40af",
  },
  barraAccionAsignar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  notaPrevencionDuplicados: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "600",
  },
  botonAsignarPrincipal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    minHeight: 42,
  },
  botonAsignarDeshabilitado: {
    backgroundColor: "#94a3b8",
    opacity: 0.7,
  },
  botonAsignarPrincipalTexto: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  seccionCaja: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  seccionHistorialCaja: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#f8fafc",
  },
  seccionEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  seccionSubtitulo: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  contadorPastilla: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  contadorPastillaTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  estadoVacioCaja: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
  },
  estadoVacioTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 6,
  },
  estadoVacioSub: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 3,
  },
  listaAsignados: {
    gap: 8,
  },
  filaAsignado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatarGrande: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarGrandeTexto: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e40af",
  },
  nombreInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  asignadoNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  pastillaEnFaena: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pastillaEnFaenaTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803d",
  },
  asignadoMeta: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  asignadoFecha: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  botonDesasignar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  botonDesasignarTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
  },
  filtrosHistorialGrupo: {
    flexDirection: "row",
    gap: 6,
  },
  chipFiltroHist: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  chipFiltroHistActivo: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  chipFiltroHistTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  chipFiltroHistTextoActivo: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listaHistorial: {
    gap: 8,
  },
  filaHistorial: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filaHistorialDesasignado: {
    borderLeftColor: "#f59e0b",
    backgroundColor: "#fffbeb",
  },
  iconoHistorialCirculo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  iconoHistorialAsignado: {
    backgroundColor: "#dcfce7",
  },
  iconoHistorialDesasignado: {
    backgroundColor: "#fef3c7",
  },
  historialTecnicoNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  insigniaAccionHist: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  insigniaAccionAsignado: {
    backgroundColor: "#dcfce7",
  },
  insigniaAccionDesasignado: {
    backgroundColor: "#fef3c7",
  },
  insigniaAccionHistTexto: {
    fontSize: 9,
    fontWeight: "800",
  },
  insigniaEstadoHist: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  insigniaEstadoVigente: {
    backgroundColor: "#dbeafe",
  },
  insigniaEstadoFinalizado: {
    backgroundColor: "#e2e8f0",
  },
  insigniaEstadoHistTexto: {
    fontSize: 9,
    fontWeight: "700",
  },
  historialProyectoTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    marginTop: 3,
  },
  historialFechasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 3,
  },
  historialFechaTexto: {
    fontSize: 10,
    color: "#64748b",
  },
  historialFechaDesasignacionTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
  },
});
