import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
// CAMBIO: parsearFechaLocal evita el desfase de un día por UTC
import { formatearFecha, parsearFechaLocal } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import {
  DistintivoEstadoProyecto,
} from "@/componentes/DistintivoEstadoProyecto";
import { FormularioReporteAvance } from "@/componentes/FormularioReporteAvance";
import { Proyecto } from "@/nucleo/tipos";
import {
  guardarMisProyectosCacheLocal,
  leerMisProyectosCacheLocal,
  obtenerMisProyectosConCache,
} from "./misProyectosApi";
import {
  evaluarSemaforoPlazo,
  generarFechaPlazoDias,
  PARAMETROS_SEMAFORO_H39,
} from "./semaforoPlazosUtils";

interface PropiedadesVistaProyectosTecnico {
  onSelectProject?: (project: Proyecto) => void;
  onNavigateTab?: (
    tab: string,
    project?: Proyecto,
    subTab?: "avance" | "sobrante"
  ) => void;
  isOffline?: boolean;
  onCambioConexion?: (sinConexion: boolean) => void;
}

type FiltroEstadoProyecto = "todos" | "activo" | "planificado" | "pausado";

/**
 * Formatea una fecha ISO de guardado en caché a un texto legible (dd-mm-aaaa HH:mm h).
 */
const formatearMarcaCache = (iso: string | null): string => {
  if (!iso) return "Sin registro previo";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia}-${mes}-${anio} ${horas}:${minutos} h`;
};

/**
 * Obtiene el valor numérico de la fecha límite para ordenar de forma segura.
 * Los proyectos sin fecha límite válida quedan siempre al final.
 */
const obtenerTiempoPlazo = (plazo?: string | null): number => {
  if (!plazo || !plazo.trim()) return Number.MAX_SAFE_INTEGER;
  const ms = parsearFechaLocal(plazo).getTime();
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
};

export const VistaProyectosTecnico: React.FC<PropiedadesVistaProyectosTecnico> = ({
  onNavigateTab,
  isOffline = false,
  onCambioConexion,
}) => {
  const { proyectos: proyectosContexto } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const [modalAvanceProyecto, establecerModalAvanceProyecto] = useState<Proyecto | null>(null);
  const [avisoExito, establecerAvisoExito] = useState<string>("");

  const identificadorUsuario = useMemo(() => {
    const idNumerico = (usuario as unknown as { id_usuario?: number })?.id_usuario;
    return idNumerico ? String(idNumerico) : usuario.rut || usuario.email || "tecnico";
  }, [usuario]);

  const [estadoFiltrar, establecerEstadoFiltrar] = useState<FiltroEstadoProyecto>("todos");
  const [filtroSemaforo, establecerFiltroSemaforo] = useState<"todos" | "ok" | "warn" | "danger">("todos");
  const [overridePlazoScrum, establecerOverridePlazoScrum] = useState<{
    proyectoId: string;
    dias: number;
    etiqueta: string;
  } | null>(null);
  const [ordenPlazoAscendente, establecerOrdenPlazoAscendente] = useState<boolean>(true);
  const [proyectosCargados, establecerProyectosCargados] = useState<Proyecto[]>([]);
  const [origenDatos, establecerOrigenDatos] = useState<"red" | "cache">("cache");
  const [guardadoEn, establecerGuardadoEn] = useState<string | null>(null);
  const [sinConexionDetectada, establecerSinConexionDetectada] = useState<boolean>(isOffline);
  const [modoAvionScrum, establecerModoAvionScrum] = useState<boolean>(false);
  const [cargando, establecerCargando] = useState<boolean>(true);
  const [sincronizando, establecerSincronizando] = useState<boolean>(false);

  const operaSinConexion = isOffline || modoAvionScrum || sinConexionDetectada;

  // Carga inicial inmediata desde la caché local y posterior sincronización con el servidor
  const cargarProyectos = useCallback(
    async (forzarOffline?: boolean) => {
      const usarOffline = forzarOffline ?? (isOffline || modoAvionScrum);
      establecerSincronizando(true);

      // 1. Lectura instantánea de la caché local para que en modo avión no exista demora ni error
      const cachePrevia = await leerMisProyectosCacheLocal(identificadorUsuario);
      if (cachePrevia && cachePrevia.proyectos.length > 0) {
        establecerProyectosCargados(cachePrevia.proyectos);
        establecerGuardadoEn(cachePrevia.guardadoEn);
        establecerCargando(false);
      }

      // 2. Consulta con respaldo automático en caché local
      const resultado = await obtenerMisProyectosConCache({
        identificadorUsuario,
        rutTecnico: usuario.rut,
        proyectosContexto,
        forzarSinConexion: usarOffline,
      });

      establecerProyectosCargados(resultado.proyectos);
      establecerOrigenDatos(resultado.origen);
      establecerGuardadoEn(resultado.guardadoEn);
      establecerSinConexionDetectada(resultado.sinConexion);
      establecerCargando(false);
      establecerSincronizando(false);

      if (onCambioConexion) {
        onCambioConexion(resultado.sinConexion);
      }
    },
    [identificadorUsuario, isOffline, modoAvionScrum, onCambioConexion, proyectosContexto, usuario.rut]
  );

  useEffect(() => {
    cargarProyectos();
  }, [cargarProyectos]);

  // Si cambian los proyectos en el contexto (por ejemplo, avance reportado en terreno),
  // actualizamos la copia en caché local para que persista en modo avión
  useEffect(() => {
    if (proyectosCargados.length === 0) return;
    const actualizados = proyectosCargados.map((p) => {
      const enContexto = proyectosContexto.find((c) => c.id === p.id);
      if (!enContexto) return p;
      return {
        ...p,
        progress: enContexto.progress,
        status: enContexto.status,
      };
    });
    guardarMisProyectosCacheLocal(identificadorUsuario, actualizados).then((marca) => {
      establecerGuardadoEn(marca);
    });
  }, [proyectosContexto]);

  // Regla estricta: el técnico visualiza sus proyectos asignados y nunca proyectos cerrados
  const tecnicoProyectos = useMemo(() => {
    return proyectosCargados.filter(
      (p) =>
        p.status !== "cerrado" &&
        p.status !== "finalizado" &&
        (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
    );
  }, [proyectosCargados, usuario.rut]);

  // Orden por fecha límite (por defecto ascendente: más urgente primero; los sin fecha van al final)
  const ordenadoProyectos = useMemo(() => {
    return [...tecnicoProyectos].sort((a, b) => {
      const tiempoA = obtenerTiempoPlazo(a.deadline);
      const tiempoB = obtenerTiempoPlazo(b.deadline);
      if (tiempoA === tiempoB) {
        return a.name.localeCompare(b.name);
      }
      if (tiempoA === Number.MAX_SAFE_INTEGER) return 1;
      if (tiempoB === Number.MAX_SAFE_INTEGER) return -1;
      return ordenPlazoAscendente ? tiempoA - tiempoB : tiempoB - tiempoA;
    });
  }, [tecnicoProyectos, ordenPlazoAscendente]);

  // Contadores por estado para los chips de filtro
  const conteosEstado = useMemo(() => {
    const activos = ordenadoProyectos.filter(
      (p) => p.status === "activo" || p.status === "en_curso"
    ).length;
    const planificados = ordenadoProyectos.filter((p) => p.status === "planificado").length;
    const pausados = ordenadoProyectos.filter((p) => p.status === "pausado").length;
    return {
      todos: ordenadoProyectos.length,
      activo: activos,
      planificado: planificados,
      pausado: pausados,
    };
  }, [ordenadoProyectos]);

  // Filtro por estado seleccionado
  const filtradoProyectos = useMemo(() => {
    return ordenadoProyectos.filter((p) => {
      if (estadoFiltrar === "todos") return true;
      if (estadoFiltrar === "activo") {
        return p.status === "activo" || p.status === "en_curso";
      }
      return p.status === estadoFiltrar;
    });
  }, [ordenadoProyectos, estadoFiltrar]);

  // Alternar verificación SCRUM de modo avión / lectura exclusiva de caché local
  const alternarModoAvionScrum = async () => {
    const siguiente = !modoAvionScrum;
    establecerModoAvionScrum(siguiente);
    await cargarProyectos(siguiente || isOffline);
  };

  const ahoraMs = Date.now();

  // Métricas globales del semáforo H39 (Normal > 5d, Amarillo ≤ 5d, Rojo ≤ 48h o vencido)
  const metricasSemaforo = useMemo(() => {
    let normales = 0;
    let amarillos = 0;
    let rojos = 0;

    ordenadoProyectos.forEach((proj) => {
      const deadlineEfectivo =
        overridePlazoScrum && overridePlazoScrum.proyectoId === proj.id
          ? generarFechaPlazoDias(overridePlazoScrum.dias)
          : proj.deadline;
      const evalSem = evaluarSemaforoPlazo(deadlineEfectivo, ahoraMs);
      if (evalSem.tono === "danger") rojos += 1;
      else if (evalSem.tono === "warn") amarillos += 1;
      else if (evalSem.tono === "ok") normales += 1;
    });

    return {
      todos: ordenadoProyectos.length,
      normales,
      amarillos,
      rojos,
    };
  }, [ordenadoProyectos, overridePlazoScrum, ahoraMs]);

  // Filtro compuesto por estado y por nivel de urgencia del semáforo H39
  const filtradoProyectosSemaforo = useMemo(() => {
    return filtradoProyectos.filter((proj) => {
      if (filtroSemaforo === "todos") return true;
      const deadlineEfectivo =
        overridePlazoScrum && overridePlazoScrum.proyectoId === proj.id
          ? generarFechaPlazoDias(overridePlazoScrum.dias)
          : proj.deadline;
      const evalSem = evaluarSemaforoPlazo(deadlineEfectivo, ahoraMs);
      return evalSem.tono === filtroSemaforo;
    });
  }, [filtradoProyectos, filtroSemaforo, overridePlazoScrum, ahoraMs]);

  const chipsFiltro: { id: FiltroEstadoProyecto; label: string }[] = [
    { id: "todos", label: `Todos (${conteosEstado.todos})` },
    { id: "activo", label: `Activos (${conteosEstado.activo})` },
    { id: "planificado", label: `Planificados (${conteosEstado.planificado})` },
    ...(conteosEstado.pausado > 0
      ? [{ id: "pausado" as FiltroEstadoProyecto, label: `Pausados (${conteosEstado.pausado})` }]
      : []),
  ];

  return (
    <ContenedorEstadoPantalla screenTitle="Mis Proyectos (Técnico)" skeletonType="cards">
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
        {/* 1. ENCABEZADO Y ESTADO DE CONEXIÓN / CACHÉ LOCAL */}
        <View style={estilos.encabezadoFila}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.encabezadoTitulo}>Mis Proyectos</Text>
            <Text style={estilos.encabezadoSub}>
              Ordenados por fecha límite ({filtradoProyectos.length} de {ordenadoProyectos.length}{" "}
              proyectos)
            </Text>
          </View>

          <View style={estilos.encabezadoDerecha}>
            {operaSinConexion ? (
              <View style={estilos.sinConexionChip}>
                <Ionicons name="airplane" size={14} color={tema.colors.warnDark} />
                <Text style={estilos.sinConexionChipTexto}>Caché Local (Offline)</Text>
              </View>
            ) : (
              <View style={estilos.enLineaChip}>
                <Ionicons name="cloud-done" size={14} color="#22c55e" />
                <Text style={estilos.enLineaChipTexto}>En Línea</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => cargarProyectos()}
              disabled={sincronizando}
              style={estilos.botonRecargar}
              accessibilityLabel="Actualizar lista de proyectos"
            >
              {sincronizando ? (
                <ActivityIndicator size="small" color={tema.colors.primaryDark} />
              ) : (
                <Ionicons name="refresh" size={16} color={tema.colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {Boolean(avisoExito) && (
          <View style={estilos.avisoExitoContenedor}>
            <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} style={{ marginRight: 8 }} />
            <Text style={estilos.avisoExitoTexto}>{avisoExito}</Text>
          </View>
        )}

        {/* 2. BANNER DE CACHÉ LOCAL Y VERIFICACIÓN [SCRUM] */}
        <View
          style={[
            estilos.cacheBanner,
            operaSinConexion ? estilos.cacheBannerOffline : estilos.cacheBannerOnline,
          ]}
        >
          <View style={estilos.cacheBannerSuperior}>
            <View style={estilos.cacheBannerIconoTexto}>
              <Ionicons
                name={operaSinConexion ? "cloud-offline-outline" : "save-outline"}
                size={18}
                color={operaSinConexion ? tema.colors.warnDark : tema.colors.okDark}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={estilos.cacheBannerTitulo}>
                  {operaSinConexion
                    ? "Modo Avión / Sin Conexión — Cargado desde caché local"
                    : `Caché local lista (${ordenadoProyectos.length} proyectos respaldados en el dispositivo)`}
                </Text>
                <Text style={estilos.cacheBannerSub}>
                  {origenDatos === "cache"
                    ? `Mostrando copia local guardada el ${formatearMarcaCache(guardadoEn)}`
                    : `Sincronizado con el servidor y guardado localmente (${formatearMarcaCache(guardadoEn)})`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. BARRA DE AUDITORÍA Y SIMULADOR DE PLAZOS [SCRUM H39]                  */}
        {/* ========================================================================= */}
        <View style={estilos.scrumSemaforoBarra}>
          <View style={estilos.scrumSemaforoEncabezado}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Ionicons name="speedometer-outline" size={17} color={tema.colors.primaryDark} />
              <Text style={estilos.scrumSemaforoTitulo}>Semáforo de Plazos [H39]</Text>
            </View>
            <Insignia label="Caso SCRUM" tone="info" size="sm" />
          </View>

          <Text style={estilos.scrumSemaforoDescripcion}>
            Reglas H39: Amarillo si faltan ≤ 5 días • Rojo si faltan ≤ 48 h o vencido • Normal si faltan &gt; 5 días.
          </Text>

          {/* Chips de métricas y filtro rápido por semáforo */}
          <View style={estilos.kpiSemaforoFila}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => establecerFiltroSemaforo("todos")}
              style={[
                estilos.kpiSemaforoChip,
                filtroSemaforo === "todos" && estilos.kpiSemaforoChipActivo,
              ]}
            >
              <Text
                style={[
                  estilos.kpiSemaforoChipTexto,
                  filtroSemaforo === "todos" && { color: "#ffffff" },
                ]}
              >
                Todos ({metricasSemaforo.todos})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => establecerFiltroSemaforo("ok")}
              style={[
                estilos.kpiSemaforoChip,
                {
                  borderColor: "#86efac",
                  backgroundColor: filtroSemaforo === "ok" ? "#15803d" : "#f0fdf4",
                },
              ]}
            >
              <View style={[estilos.puntoSemaforo, { backgroundColor: "#15803d" }]} />
              <Text
                style={[
                  estilos.kpiSemaforoChipTexto,
                  { color: filtroSemaforo === "ok" ? "#ffffff" : "#166534" },
                ]}
              >
                Normal &gt; 5d ({metricasSemaforo.normales})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => establecerFiltroSemaforo("warn")}
              style={[
                estilos.kpiSemaforoChip,
                {
                  borderColor: "#fde68a",
                  backgroundColor: filtroSemaforo === "warn" ? "#b45309" : "#fffbeb",
                },
              ]}
            >
              <View style={[estilos.puntoSemaforo, { backgroundColor: "#b45309" }]} />
              <Text
                style={[
                  estilos.kpiSemaforoChipTexto,
                  { color: filtroSemaforo === "warn" ? "#ffffff" : "#92400e" },
                ]}
              >
                Amarillo ≤ 5d ({metricasSemaforo.amarillos})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => establecerFiltroSemaforo("danger")}
              style={[
                estilos.kpiSemaforoChip,
                {
                  borderColor: "#fca5a5",
                  backgroundColor: filtroSemaforo === "danger" ? "#b91c1c" : "#fef2f2",
                },
              ]}
            >
              <View style={[estilos.puntoSemaforo, { backgroundColor: "#b91c1c" }]} />
              <Text
                style={[
                  estilos.kpiSemaforoChipTexto,
                  { color: filtroSemaforo === "danger" ? "#ffffff" : "#991b1b" },
                ]}
              >
                Rojo ≤ 48h ({metricasSemaforo.rojos})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selector de prueba rápida SCRUM */}
          <View style={estilos.simuladorBotonesFila}>
            <Text style={estilos.simuladorEtiqueta}>Probar proyectos caso [SCRUM]:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  const target = filtradoProyectos[0] || ordenadoProyectos[0];
                  if (target) {
                    establecerOverridePlazoScrum({
                      proyectoId: target.id,
                      dias: 6,
                      etiqueta: "6 días (Normal / Verde)",
                    });
                    establecerAvisoExito(
                      `✓ [SCRUM] Proyecto ${target.code} configurado a 6 días restantes: Tarjeta Normal.`
                    );
                  }
                }}
                style={[
                  estilos.simuladorBoton,
                  overridePlazoScrum?.dias === 6 && estilos.simuladorBotonActivoNormal,
                ]}
              >
                <Text
                  style={[
                    estilos.simuladorBotonTexto,
                    overridePlazoScrum?.dias === 6 && { color: "#ffffff" },
                  ]}
                >
                  ● 6 días (Normal)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const target = filtradoProyectos[0] || ordenadoProyectos[0];
                  if (target) {
                    establecerOverridePlazoScrum({
                      proyectoId: target.id,
                      dias: 4,
                      etiqueta: "4 días (Amarillo / Alerta)",
                    });
                    establecerAvisoExito(
                      `✓ [SCRUM] Proyecto ${target.code} configurado a 4 días restantes: Tarjeta Amarilla.`
                    );
                  }
                }}
                style={[
                  estilos.simuladorBoton,
                  overridePlazoScrum?.dias === 4 && estilos.simuladorBotonActivoAmarillo,
                ]}
              >
                <Text
                  style={[
                    estilos.simuladorBotonTexto,
                    overridePlazoScrum?.dias === 4 && { color: "#ffffff" },
                  ]}
                >
                  ● 4 días (Amarillo)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const target = filtradoProyectos[0] || ordenadoProyectos[0];
                  if (target) {
                    establecerOverridePlazoScrum({
                      proyectoId: target.id,
                      dias: 1,
                      etiqueta: "1 día (Rojo / Crítico)",
                    });
                    establecerAvisoExito(
                      `✓ [SCRUM] Proyecto ${target.code} configurado a 1 día restante (24h): Tarjeta Roja.`
                    );
                  }
                }}
                style={[
                  estilos.simuladorBoton,
                  overridePlazoScrum?.dias === 1 && estilos.simuladorBotonActivoRojo,
                ]}
              >
                <Text
                  style={[
                    estilos.simuladorBotonTexto,
                    overridePlazoScrum?.dias === 1 && { color: "#ffffff" },
                  ]}
                >
                  ● 1 día (Rojo)
                </Text>
              </TouchableOpacity>

              {overridePlazoScrum && (
                <TouchableOpacity
                  onPress={() => {
                    establecerOverridePlazoScrum(null);
                    establecerAvisoExito("✓ Simulación restablecida a los plazos predeterminados.");
                  }}
                  style={estilos.simuladorBotonReset}
                >
                  <Ionicons name="refresh-outline" size={13} color={tema.colors.textSecondary} />
                  <Text style={estilos.simuladorBotonResetTexto}>Restablecer</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>

        {/* 4. BARRA DE FILTROS POR ESTADO Y CONTROL DE ORDEN POR FECHA LÍMITE */}
        <View style={estilos.controlesFila}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={estilos.filtrarScroll}
          >
            {chipsFiltro.map((f) => {
              const esActivo = estadoFiltrar === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => establecerEstadoFiltrar(f.id)}
                  style={[estilos.filtrarChip, esActivo && estilos.filtrarChipActivo]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      estilos.filtrarChipTexto,
                      esActivo && estilos.filtrarChipTextoActivo,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => establecerOrdenPlazoAscendente((prev) => !prev)}
            style={estilos.ordenBoton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={ordenPlazoAscendente ? "arrow-up-outline" : "arrow-down-outline"}
              size={14}
              color={tema.colors.primaryDark}
            />
            <Text style={estilos.ordenBotonTexto}>
              {ordenPlazoAscendente
                ? "Fecha límite: más urgentes primero"
                : "Fecha límite: más lejanos primero"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. LISTADO DE TARJETAS DE PROYECTO */}
        {cargando ? (
          <View style={estilos.cargandoContenedor}>
            <ActivityIndicator size="large" color={tema.colors.primary} />
            <Text style={estilos.cargandoTexto}>Cargando proyectos desde caché local...</Text>
          </View>
        ) : filtradoProyectosSemaforo.length === 0 ? (
          <EstadoVacio
            icon="folder-open-outline"
            title="Sin proyectos en este estado o semáforo"
            description="No hay proyectos que coincidan con los filtros seleccionados."
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          filtradoProyectosSemaforo.map((proj) => {
            const deadlineEfectivo =
              overridePlazoScrum && overridePlazoScrum.proyectoId === proj.id
                ? generarFechaPlazoDias(overridePlazoScrum.dias)
                : proj.deadline;

            const semaforo = evaluarSemaforoPlazo(deadlineEfectivo, ahoraMs);
            const esOverrideActivo = overridePlazoScrum?.proyectoId === proj.id;

            return (
              <Tarjeta
                key={proj.id}
                variant="elevated"
                style={[
                  estilos.proyectoTarjeta,
                  semaforo.estilosTarjeta,
                ]}
              >
                {/* Encabezado de la tarjeta con distintivo de estado accesible */}
                <View style={estilos.tarjetaSuperiorFila}>
                  <View style={estilos.codigoFila}>
                    <Text style={estilos.proyectoCodigo}>{proj.code}</Text>
                    <Insignia
                      label={proj.kind.toUpperCase()}
                      tone={proj.kind === "obra" ? "info" : "warn"}
                      size="sm"
                    />
                    <DistintivoEstadoProyecto
                      estado={proj.status}
                      tamano="sm"
                      mostrarPrefijo
                      forzarModoMovil
                    />
                  </View>

                  {/* Semáforo de plazo según H39 */}
                  <Insignia
                    label={semaforo.etiqueta}
                    tone={semaforo.tono === "neutro" ? "mute" : semaforo.tono}
                    icon={semaforo.icono}
                    size="sm"
                  />
                </View>

                <Text style={estilos.proyectoNombre}>{proj.name}</Text>
                <Text style={estilos.proyectoCliente}>Cliente: {proj.client}</Text>

                <View style={estilos.direccionFila}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={tema.colors.textMuted}
                  />
                  <Text style={estilos.direccionTexto} numberOfLines={1}>
                    {proj.address}
                  </Text>
                </View>

                {/* Banner de explicación del semáforo H39 en cada tarjeta */}
                {semaforo.tono !== "neutro" && (
                  <View
                    style={[
                      estilos.semaforoH39AvisoCaja,
                      {
                        backgroundColor:
                          semaforo.tono === "danger"
                            ? "#fee2e2"
                            : semaforo.tono === "warn"
                            ? "#fef3c7"
                            : "#dcfce7",
                        borderColor:
                          semaforo.tono === "danger"
                            ? "#fca5a5"
                            : semaforo.tono === "warn"
                            ? "#fde68a"
                            : "#bbf7d0",
                      },
                    ]}
                  >
                    <Ionicons
                      name={semaforo.icono}
                      size={15}
                      color={
                        semaforo.tono === "danger"
                          ? "#b91c1c"
                          : semaforo.tono === "warn"
                          ? "#b45309"
                          : "#15803d"
                      }
                    />
                    <Text
                      style={[
                        estilos.semaforoH39AvisoTexto,
                        {
                          color:
                            semaforo.tono === "danger"
                              ? "#991b1b"
                              : semaforo.tono === "warn"
                              ? "#92400e"
                              : "#166534",
                        },
                      ]}
                    >
                      {semaforo.tono === "danger"
                        ? "Semáforo Rojo [H39]: Plazo crítico (≤ 48 h o vencido)"
                        : semaforo.tono === "warn"
                        ? "Semáforo Amarillo [H39]: En alerta (≤ 5 días restantes)"
                        : "Semáforo Normal [H39]: En plazo (> 5 días restantes)"}
                      {esOverrideActivo ? ` • ${overridePlazoScrum?.etiqueta}` : ""}
                    </Text>
                  </View>
                )}

                {/* Barra de avance físico 0-100% teñida según el semáforo */}
                <View style={estilos.progresoContenedor}>
                  <View style={estilos.progresoEncabezado}>
                    <Text style={estilos.progresoEtiqueta}>Avance físico de la obra</Text>
                    <Text style={estilos.progresoPorcentaje}>{proj.progress}%</Text>
                  </View>
                  <BarraProgreso
                    value={proj.progress}
                    max={100}
                    height={8}
                    color={semaforo.colorProgreso}
                  />
                </View>

                {/* Indicador de disponibilidad en caché local */}
                <View style={estilos.sinConexionSincronizacionAviso}>
                  <Ionicons
                    name={operaSinConexion ? "phone-portrait-outline" : "checkmark-circle"}
                    size={13}
                    color={operaSinConexion ? tema.colors.warnDark : tema.colors.ok}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={estilos.sinConexionSincronizacionTexto}>
                    {operaSinConexion
                      ? "Disponible sin conexión desde la caché local del dispositivo"
                      : "Sincronizado y respaldado en caché local del celular"}
                  </Text>
                </View>

                {/* Pie de tarjeta con fecha límite y botones táctiles de acción */}
                <View style={estilos.tarjetaPie}>
                  <View style={estilos.plazoContenedor}>
                    <Text style={estilos.plazoEtiqueta}>Fecha Límite:</Text>
                    <Text
                      style={[
                        estilos.plazoValor,
                        {
                          color: semaforo.colorTextoPlazo,
                          fontWeight: semaforo.tono !== "neutro" ? "800" : "600",
                        },
                      ]}
                    >
                      {semaforo.tienePlazoValido
                        ? formatearFecha(deadlineEfectivo)
                        : "Por definir"}
                    </Text>
                  </View>

                  <View style={estilos.accionesGrupo}>
                    <Boton
                      title="Avance"
                      variant="outline"
                      size="sm"
                      icon="trending-up-outline"
                      onPress={() => establecerModalAvanceProyecto(proj)}
                      style={{ marginRight: 6, minHeight: 42 }}
                    />
                    <Boton
                      title="Insumos"
                      variant="primary"
                      size="sm"
                      icon="cube-outline"
                      onPress={() => onNavigateTab && onNavigateTab("insumos", proj)}
                      style={{ minHeight: 42 }}
                    />
                  </View>
                </View>
              </Tarjeta>
            );
          })
        )}
      </ScrollView>

      {/* MODAL MÓVIL DE REPORTE DE AVANCE RÁPIDO */}
      {modalAvanceProyecto && (
        <Modal
          visible={true}
          animationType="slide"
          transparent
          onRequestClose={() => establecerModalAvanceProyecto(null)}
        >
          <View style={estilos.modalOverlay}>
            <View style={estilos.modalCardContenedor}>
              <FormularioReporteAvance
                proyectoInicialId={modalAvanceProyecto.id}
                avanceInicial={50}
                modoModal={true}
                onCerrar={() => establecerModalAvanceProyecto(null)}
                onExito={(nuevoPct, codigo) => {
                  establecerAvisoExito(
                    `✓ Avance del ${nuevoPct}% verificado y actualizado exitosamente en el proyecto ${codigo}.`
                  );
                  setTimeout(() => establecerAvisoExito(""), 5000);
                  establecerModalAvanceProyecto(null);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </ContenedorEstadoPantalla>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  encabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tema.spacing.sm,
    flexWrap: "wrap",
    gap: 8,
  },
  encabezadoDerecha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  encabezadoTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  encabezadoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  botonRecargar: {
    width: 34,
    height: 34,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sinConexionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
  },
  sinConexionChipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: tema.colors.warnDark,
    marginLeft: 4,
  },
  enLineaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: "#334155",
  },
  enLineaChipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#e2e8f0",
    marginLeft: 4,
  },
  cacheBanner: {
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
  },
  cacheBannerOnline: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  cacheBannerOffline: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  cacheBannerSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  cacheBannerIconoTexto: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 200,
  },
  cacheBannerTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: "#78350f",
  },
  cacheBannerSub: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 2,
  },
  botonScrumAvion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  botonScrumAvionActivo: {
    backgroundColor: "#d97706",
    borderColor: "#b45309",
  },
  botonScrumAvionTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#92400e",
  },
  botonScrumAvionTextoActivo: {
    color: "#ffffff",
  },
  scrumNota: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 8,
    lineHeight: 15,
  },
  controlesFila: {
    marginBottom: tema.spacing.md,
    gap: 8,
  },
  filtrarScroll: {
    marginBottom: 4,
  },
  filtrarChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
    minHeight: 38,
    justifyContent: "center",
  },
  filtrarChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  filtrarChipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  filtrarChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  ordenBoton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  ordenBotonTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  cargandoContenedor: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  cargandoTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  proyectoTarjeta: {
    marginBottom: tema.spacing.md,
    borderRadius: tema.radius.lg,
    overflow: "hidden",
  },
  proyectoTarjetaPeligro: {
    borderLeftColor: tema.colors.danger,
    borderLeftWidth: 5,
    borderWidth: 1.5,
    borderColor: tema.colors.dangerBorder,
    backgroundColor: tema.colors.dangerLight,
  },
  proyectoTarjetaAdvertencia: {
    borderLeftColor: tema.colors.warn,
    borderLeftWidth: 5,
    borderWidth: 1.5,
    borderColor: tema.colors.warnBorder,
    backgroundColor: tema.colors.warnLight,
  },
  scrumSemaforoBarra: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    padding: 12,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    ...tema.shadows.subtle,
  },
  scrumSemaforoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  scrumSemaforoTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  scrumSemaforoDescripcion: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 15,
  },
  kpiSemaforoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  kpiSemaforoChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.surfaceAlt,
    gap: 4,
    minHeight: 28,
  },
  kpiSemaforoChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  kpiSemaforoChipTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  puntoSemaforo: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  simuladorBotonesFila: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    gap: 6,
  },
  simuladorEtiqueta: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  simuladorBoton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.surfaceAlt,
    minHeight: 30,
    justifyContent: "center",
  },
  simuladorBotonActivoNormal: {
    backgroundColor: "#15803d",
    borderColor: "#166534",
  },
  simuladorBotonActivoAmarillo: {
    backgroundColor: "#b45309",
    borderColor: "#92400e",
  },
  simuladorBotonActivoRojo: {
    backgroundColor: "#b91c1c",
    borderColor: "#991b1b",
  },
  simuladorBotonTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  simuladorBotonReset: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    gap: 4,
    minHeight: 30,
  },
  simuladorBotonResetTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  semaforoH39AvisoCaja: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: tema.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    gap: 6,
  },
  semaforoH39AvisoTexto: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  tarjetaSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  proyectoCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginRight: 4,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  direccionFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  direccionTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginLeft: 4,
    flex: 1,
  },
  progresoContenedor: {
    marginTop: 10,
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  progresoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progresoEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  progresoPorcentaje: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  sinConexionSincronizacionAviso: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  sinConexionSincronizacionTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  tarjetaPie: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    flexWrap: "wrap",
    gap: 8,
  },
  plazoContenedor: {
    flex: 1,
  },
  plazoEtiqueta: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  plazoValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 1,
  },
  accionesGrupo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  avisoExitoContenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.okBorder,
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  avisoExitoTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.okDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCardContenedor: {
    backgroundColor: tema.colors.card,
    borderTopLeftRadius: tema.radius.xl,
    borderTopRightRadius: tema.radius.xl,
    height: "90%",
    paddingTop: tema.spacing.sm,
  },
});