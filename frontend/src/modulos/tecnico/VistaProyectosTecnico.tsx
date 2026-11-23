<<<<<<< HEAD
import React, { useMemo, useState } from "react";
import {
  Modal,
=======
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
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
  IndicadorUltimaSincronizacion,
  LeyendaAccesibilidadEstados,
} from "@/componentes/DistintivoEstadoProyecto";
import { FormularioReporteAvance } from "@/componentes/FormularioReporteAvance";
import { Proyecto } from "@/nucleo/tipos";
import {
  guardarMisProyectosCacheLocal,
  leerMisProyectosCacheLocal,
  obtenerMisProyectosConCache,
} from "./misProyectosApi";

interface PropiedadesVistaProyectosTecnico {
  onSelectProject?: (project: Proyecto) => void;
  onNavigateTab?: (
    tab: string,
    project?: Proyecto,
    subTab?: "avance" | "horas" | "sobrante"
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
  const { proyectos: proyectosContexto, sesionTrabajoActiva, iniciarSesionTrabajo } =
    usarAplicacion();
  const { usuario } = usarAutenticacion();

<<<<<<< HEAD
  const [estadoFiltrar, establecerEstadoFiltrar] = useState<string>("todos");
  const [modalAvanceProyecto, establecerModalAvanceProyecto] = useState<Proyecto | null>(null);
  const [avisoExito, establecerAvisoExito] = useState<string>("");
  const [ultimaSincronizacion, establecerUltimaSincronizacion] = useState<Date>(
    () => new Date()
  );
  const [sincronizando, establecerSincronizando] = useState(false);

  const manejarSincronizarManual = () => {
    establecerSincronizando(true);
    setTimeout(() => {
      establecerUltimaSincronizacion(new Date());
      establecerSincronizando(false);
    }, 350);
  };
=======
  const identificadorUsuario = useMemo(() => {
    const idNumerico = (usuario as unknown as { id_usuario?: number })?.id_usuario;
    return idNumerico ? String(idNumerico) : usuario.rut || usuario.email || "tecnico";
  }, [usuario]);
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec

  const [estadoFiltrar, establecerEstadoFiltrar] = useState<FiltroEstadoProyecto>("todos");
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

<<<<<<< HEAD
  // Filtro por estado en chips
  const filtradoProyectos = ordenadoProyectos.filter((p) => {
    if (estadoFiltrar === "todos") return true;
    const estNorm = (p.status || "").toLowerCase();
    const filNorm = estadoFiltrar.toLowerCase();
    if (filNorm === "en curso" || filNorm === "activo") {
      return estNorm === "activo" || estNorm === "en curso" || estNorm === "en_curso";
    }
    return estNorm === filNorm;
  });

  const conteoPorEstado = useMemo(() => {
    return {
      Planificado: ordenadoProyectos.filter(
        (p) => p.status.toLowerCase() === "planificado"
      ).length,
      "En curso": ordenadoProyectos.filter(
        (p) =>
          p.status.toLowerCase() === "activo" ||
          p.status.toLowerCase() === "en curso"
      ).length,
      Pausado: ordenadoProyectos.filter(
        (p) => p.status.toLowerCase() === "pausado"
      ).length,
      Finalizado: ordenadoProyectos.filter(
        (p) => p.status.toLowerCase() === "finalizado"
      ).length,
    };
  }, [ordenadoProyectos]);

  const horaSincFormateada = useMemo(() => {
    try {
      return ultimaSincronizacion.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ultimaSincronizacion.toTimeString().slice(0, 8);
    }
  }, [ultimaSincronizacion]);

  const now = Date.now();
=======
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

  const chipsFiltro: { id: FiltroEstadoProyecto; label: string }[] = [
    { id: "todos", label: `Todos (${conteosEstado.todos})` },
    { id: "activo", label: `Activos (${conteosEstado.activo})` },
    { id: "planificado", label: `Planificados (${conteosEstado.planificado})` },
    ...(conteosEstado.pausado > 0
      ? [{ id: "pausado" as FiltroEstadoProyecto, label: `Pausados (${conteosEstado.pausado})` }]
      : []),
  ];
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec

  return (
    <ContenedorEstadoPantalla screenTitle="Mis Proyectos (Técnico)" skeletonType="cards">
      <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
<<<<<<< HEAD
        {/* 1. HEADER & STATUS OFFLINE / ONLINE */}
        <View style={estilos.encabezadoFila}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.encabezadoTitulo}>Mis Proyectos en Terreno</Text>
            <Text style={estilos.encabezadoSub}>
              Ordenados por fecha límite de entrega ({filtradoProyectos.length} proyectos)
            </Text>
          </View>

          {isOffline ? (
            <View style={estilos.sinConexionChip}>
              <Ionicons name="cloud-offline" size={14} color={tema.colors.warnDark} />
              <Text style={estilos.sinConexionChipTexto}>Modo Offline</Text>
            </View>
          ) : (
            <View style={estilos.enLineaChip}>
              <Ionicons name="cloud-done" size={14} color="#22c55e" />
              <Text style={estilos.enLineaChipTexto}>En Línea</Text>
            </View>
          )}
        </View>

        {Boolean(avisoExito) && (
          <View style={estilos.avisoExitoContenedor}>
            <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} style={{ marginRight: 8 }} />
            <Text style={estilos.avisoExitoTexto}>{avisoExito}</Text>
          </View>
        )}

        {/* [FRONT-2] Indicador de última sincronización accesible en móvil */}
        <IndicadorUltimaSincronizacion
          ultimaSincronizacion={ultimaSincronizacion}
          sincronizando={sincronizando}
          sinConexion={isOffline}
          onSincronizar={manejarSincronizarManual}
          fuenteDatos={
            isOffline
              ? "Almacenamiento local del dispositivo móvil activo"
              : "Sincronizado con servidor central de obras"
          }
          style={{ marginBottom: 12 }}
        />

        {/* [SCRUM] Leyenda y revisor de accesibilidad visual de estados en pantalla móvil */}
        <LeyendaAccesibilidadEstados
          conteoPorEstado={conteoPorEstado}
          estadoSeleccionado={estadoFiltrar}
          onSeleccionarEstado={(est) => establecerEstadoFiltrar(est)}
        />

        {/* 2. CHIPS DE FILTRO POR ESTADO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.filtrarScroll}>
          {[
            { id: "todos", label: `Todos (${ordenadoProyectos.length})` },
            {
              id: "activo",
              label: `Activos / En curso (${ordenadoProyectos.filter((p) => p.status === "activo").length})`,
            },
            {
              id: "planificado",
              label: `Planificados (${ordenadoProyectos.filter((p) => p.status === "planificado").length})`,
            },
          ].map((f) => {
            const esActivo = estadoFiltrar.toLowerCase() === f.id.toLowerCase();
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => establecerEstadoFiltrar(f.id)}
                style={[estilos.filtrarChip, esActivo && estilos.filtrarChipActivo]}
                activeOpacity={0.7}
              >
                <Text style={[estilos.filtrarChipTexto, esActivo && estilos.filtrarChipTextoActivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. LISTADO DE TARJETAS DE PROYECTO */}
        {filtradoProyectos.length === 0 ? (
          <EstadoVacio
            icon="folder-open-outline"
            title="Sin proyectos en este estado"
            description="No tienes obras o faenas activas asignadas que coincidan con el filtro."
=======
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

            <TouchableOpacity
              onPress={alternarModoAvionScrum}
              style={[
                estilos.botonScrumAvion,
                modoAvionScrum && estilos.botonScrumAvionActivo,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={modoAvionScrum ? "airplane" : "airplane-outline"}
                size={14}
                color={modoAvionScrum ? "#ffffff" : "#92400e"}
              />
              <Text
                style={[
                  estilos.botonScrumAvionTexto,
                  modoAvionScrum && estilos.botonScrumAvionTextoActivo,
                ]}
              >
                {modoAvionScrum ? "Salir Modo Avión" : "Probar Modo Avión"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={estilos.scrumNota}>
            [SCRUM] Activa modo avión en el celular (o usa el botón de prueba) para comprobar que la
            lista guardada localmente carga sin errores y permite filtrar por estado y ordenar por
            fecha límite.
          </Text>
        </View>

        {/* 3. BARRA DE FILTROS POR ESTADO Y CONTROL DE ORDEN POR FECHA LÍMITE */}
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

        {/* 4. LISTADO DE TARJETAS DE PROYECTO */}
        {cargando ? (
          <View style={estilos.cargandoContenedor}>
            <ActivityIndicator size="large" color={tema.colors.primary} />
            <Text style={estilos.cargandoTexto}>Cargando proyectos desde caché local...</Text>
          </View>
        ) : filtradoProyectos.length === 0 ? (
          <EstadoVacio
            icon="folder-open-outline"
            title="Sin proyectos en este estado"
            description="No tienes obras o mantenciones asignadas que coincidan con el filtro seleccionado."
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          filtradoProyectos.map((proj) => {
            // Semáforo de fecha límite:
            // Amarillo si faltan <= 5 días, Rojo si faltan <= 48 horas o vencido
<<<<<<< HEAD
            const plazoMs = new Date(proj.deadline).getTime();
            const diferenciaMs = plazoMs - now;
=======
            const plazoMs = obtenerTiempoPlazo(proj.deadline);
            const tienePlazoValido = plazoMs !== Number.MAX_SAFE_INTEGER;
            const diferenciaMs = tienePlazoValido ? plazoMs - ahoraMs : 0;
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
            const diferenciaHoras = Math.floor(diferenciaMs / (1000 * 60 * 60));
            const diferenciaDias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

            let semTono: "ok" | "warn" | "danger" = "ok";
<<<<<<< HEAD
            let semEtiqueta = `Quedan ${diferenciaDias} días`;

            if (diferenciaMs <= 0) {
              semTono = "danger";
              semEtiqueta = "¡Plazo Vencido!";
            } else if (diferenciaHoras <= 48) {
              semTono = "danger";
              semEtiqueta = `¡Crítico! Faltan ${diferenciaHoras} horas`;
            } else if (diferenciaDias <= 5) {
              semTono = "warn";
              semEtiqueta = `Atención: Faltan ${diferenciaDias} días`;
=======
            let semEtiqueta = tienePlazoValido
              ? `Quedan ${diferenciaDias} días`
              : "Sin fecha límite";

            if (tienePlazoValido) {
              if (diferenciaMs <= 0) {
                semTono = "danger";
                semEtiqueta = "¡Plazo Vencido!";
              } else if (diferenciaHoras <= 48) {
                semTono = "danger";
                semEtiqueta = `¡Crítico! Faltan ${diferenciaHoras} horas`;
              } else if (diferenciaDias <= 5) {
                semTono = "warn";
                semEtiqueta = `Atención: Faltan ${diferenciaDias} días`;
              }
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
            }

            return (
              <Tarjeta
                key={proj.id}
                variant="elevated"
                style={[
                  estilos.proyectoTarjeta,
                  semTono === "danger" && estilos.proyectoTarjetaPeligro,
                  semTono === "warn" && estilos.proyectoTarjetaAdvertencia,
                ]}
              >
<<<<<<< HEAD
                {/* Header de Tarjeta con distintivo de estado accesible en móvil */}
=======
                {/* Encabezado de la tarjeta */}
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                <View style={estilos.tarjetaSuperiorFila}>
                  <View style={estilos.codigoFila}>
                    <Text style={estilos.proyectoCodigo}>{proj.code}</Text>
                    <Insignia
                      label={proj.kind.toUpperCase()}
                      tone={proj.kind === "obra" ? "info" : "warn"}
                      size="sm"
                    />
<<<<<<< HEAD
                    <DistintivoEstadoProyecto
                      estado={proj.status}
                      tamano="sm"
                      mostrarPrefijo
                      forzarModoMovil
                    />
                  </View>

                  {/* Semáforo de Plazo */}
=======
                    <InsigniaEstado
                      status={proj.status}
                      size="sm"
                      style={{ marginLeft: 6 }}
                    />
                  </View>

                  {/* Semáforo de plazo */}
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                  <Insignia
                    label={semEtiqueta}
                    tone={semTono}
                    icon={
                      semTono === "danger"
                        ? "alert-circle"
                        : semTono === "warn"
                        ? "time-outline"
                        : "calendar-outline"
                    }
                    size="sm"
                  />
                </View>

                <Text style={estilos.proyectoNombre}>{proj.name}</Text>
                <Text style={estilos.proyectoCliente}>Cliente: {proj.client}</Text>

                <View style={estilos.direccionFila}>
<<<<<<< HEAD
                  <Ionicons name="location-outline" size={14} color={tema.colors.textMuted} />
=======
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={tema.colors.textMuted}
                  />
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                  <Text style={estilos.direccionTexto} numberOfLines={1}>
                    {proj.address}
                  </Text>
                </View>

<<<<<<< HEAD
                {/* Barra de Avance Físico 0-100% */}
=======
                {/* Barra de avance físico 0-100% */}
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                <View style={estilos.progresoContenedor}>
                  <View style={estilos.progresoEncabezado}>
                    <Text style={estilos.progresoEtiqueta}>Avance físico de la obra</Text>
                    <Text style={estilos.progresoPorcentaje}>{proj.progress}%</Text>
                  </View>
                  <BarraProgreso
                    value={proj.progress}
                    max={100}
                    height={8}
                    color={
                      semTono === "danger"
                        ? tema.colors.danger
                        : semTono === "warn"
                        ? tema.colors.warn
                        : tema.colors.primary
                    }
                  />
                </View>

<<<<<<< HEAD
                {/* Indicador de Última Sincronización por Tarjeta */}
                <View style={estilos.sinConexionSincronizacionAviso}>
                  <Ionicons
                    name={isOffline ? "cloud-offline-outline" : "checkmark-circle"}
                    size={14}
                    color={isOffline ? tema.colors.warnDark : tema.colors.okDark}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={estilos.sinConexionSincronizacionTexto}>
                    {isOffline
                      ? `Guardado en móvil • Última sinc: ${horaSincFormateada}`
                      : `Sincronizado con base central • Última sinc: ${horaSincFormateada}`}
                  </Text>
                </View>

                {/* Footer con Fecha Límite y Botones Táctiles de Acción (≥ 44 px) */}
=======
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
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                <View style={estilos.tarjetaPie}>
                  <View style={estilos.plazoContenedor}>
                    <Text style={estilos.plazoEtiqueta}>Fecha Límite:</Text>
                    <Text
                      style={[
                        estilos.plazoValor,
<<<<<<< HEAD
                        semTono === "danger" && { color: tema.colors.danger, fontWeight: "bold" },
                      ]}
                    >
                      {formatearFecha(proj.deadline)}
=======
                        semTono === "danger" && {
                          color: tema.colors.danger,
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {tienePlazoValido ? formatearFecha(proj.deadline) : "Por definir"}
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                    </Text>
                  </View>

                  <View style={estilos.accionesGrupo}>
                    {sesionTrabajoActiva?.projectId === proj.id ? (
                      <Boton
                        title="En Faena (HH)"
                        variant="primary"
                        size="sm"
                        icon="timer"
<<<<<<< HEAD
                        onPress={() => onNavigateTab && onNavigateTab("registrar", proj, "horas")}
=======
                        onPress={() =>
                          onNavigateTab && onNavigateTab("registrar", proj, "horas")
                        }
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                        style={{ marginRight: 6, height: 42 }}
                      />
                    ) : (
                      <Boton
                        title="Iniciar Faena"
                        variant="outline"
                        size="sm"
                        icon="play-outline"
                        onPress={() => {
                          if (!sesionTrabajoActiva) {
                            iniciarSesionTrabajo(proj.id);
                          }
<<<<<<< HEAD
                          onNavigateTab && onNavigateTab("registrar", proj, "horas");
=======
                          if (onNavigateTab) {
                            onNavigateTab("registrar", proj, "horas");
                          }
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                        }}
                        style={{ marginRight: 6, height: 42 }}
                      />
                    )}
                    <Boton
                      title="Avance"
                      variant="outline"
                      size="sm"
                      icon="trending-up-outline"
<<<<<<< HEAD
                      onPress={() => establecerModalAvanceProyecto(proj)}
=======
                      onPress={() =>
                        onNavigateTab && onNavigateTab("registrar", proj, "avance")
                      }
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
                      style={{ marginRight: 6, height: 42 }}
                    />
                    <Boton
                      title="Insumos"
                      variant="primary"
                      size="sm"
                      icon="cube-outline"
                      onPress={() => onNavigateTab && onNavigateTab("insumos", proj)}
                      style={{ height: 42 }}
                    />
                  </View>
                </View>
              </Tarjeta>
            );
          })
        )}
      </ScrollView>
<<<<<<< HEAD

      {/* MODAL MÓVIL DE REPORTE DE AVANCE RÁPIDO [FRONT-2] */}
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
                    `✓ [SCRUM] Avance del ${nuevoPct}% verificado y actualizado exitosamente en el proyecto ${codigo}.`
                  );
                  setTimeout(() => establecerAvisoExito(""), 5000);
                  establecerModalAvanceProyecto(null);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
=======
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
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
    backgroundColor: "#1c1917",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  enLineaChipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#e7e5e4",
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
    backgroundColor: "#1c1917",
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
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  proyectoTarjetaPeligro: {
    borderLeftColor: tema.colors.danger,
    borderWidth: 1.5,
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  proyectoTarjetaAdvertencia: {
    borderLeftColor: tema.colors.warn,
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
<<<<<<< HEAD
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
=======
});
>>>>>>> 404a57fb7429f75b177a46e0688ec6b54d849fec
