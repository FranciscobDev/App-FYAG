// Sección móvil de Cronómetro Automático y Registro de Horas (HH) con soporte offline,
// cálculo en bloques de 0,5 h, dashboard responsivo y edición condicionada a la ventana permitida (H41).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { HoraTrabajoTecnico, Proyecto } from "@/nucleo/tipos";
import {
  calcularBloqueMediaHora,
  evaluarVentanaEdicionHoras,
  formatearMarcaHorasOffline,
  guardarEstadoHorasOffline,
  leerEstadoHorasOffline,
  verificarConexionSincronizacionHoras,
} from "./horasOffline";

export interface PropiedadesSeccionCronometroHorasTecnico {
  activoProyectos: Proyecto[];
  actualProyecto?: Proyecto;
  establecerSeleccionadoProyectoId: (id: string) => void;
  isOffline?: boolean;
  onCambioConexion?: (sinConexion: boolean) => void;
}

const formatearDuracionReloj = (totalSegundos: number): string => {
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const SeccionCronometroHorasTecnico: React.FC<
  PropiedadesSeccionCronometroHorasTecnico
> = ({
  activoProyectos,
  actualProyecto,
  establecerSeleccionadoProyectoId,
  isOffline = false,
  onCambioConexion,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const {
    proyectos,
    horasTecnico,
    parametrosSistema,
    sesionTrabajoActiva,
    iniciarSesionTrabajo,
    detenerSesionTrabajo,
    cancelarSesionTrabajo,
    actualizarHoraTrabajoTecnico,
    sincronizarHorasTrabajoPendientes,
    restaurarEstadoHorasOffline,
  } = usarAplicacion();
  const { usuario, rolActual } = usarAutenticacion();

  const identificadorUsuario = useMemo(() => {
    const idNumerico = (usuario as unknown as { id_usuario?: number })?.id_usuario;
    return idNumerico ? String(idNumerico) : usuario.rut || usuario.email || "tecnico";
  }, [usuario]);

  // Ventana de edición configurable desde parámetros del sistema (por defecto 48 h)
  const plazoMaximoHoras = useMemo(() => {
    const param = parametrosSistema.find((p) => p.id === "hours_edit_deadline");
    return Number(param?.value ?? 48) || 48;
  }, [parametrosSistema]);

  // Estados del cronómetro y conectividad offline
  const [sesionTranscurridoSegundos, establecerSesionTranscurridoSegundos] = useState<number>(0);
  const [automaticoDescripcion, establecerAutomaticoDescripcion] = useState<string>("");
  const [horasError, establecerHorasError] = useState<string>("");
  const [horasExito, establecerHorasExito] = useState<string>("");
  const [sinConexionDetectada, establecerSinConexionDetectada] = useState<boolean>(isOffline);
  const [modoOfflineScrum, establecerModoOfflineScrum] = useState<boolean>(false);
  const [sincronizando, establecerSincronizando] = useState<boolean>(false);
  const [ultimaSincronizacion, establecerUltimaSincronizacion] = useState<string | null>(null);
  const [cacheHidratada, establecerCacheHidratada] = useState<boolean>(false);

  // Estados del modal de edición en bloques de 0,5 h
  const [editandoHora, establecerEditandoHora] = useState<HoraTrabajoTecnico | null>(null);
  const [editarHorasValor, establecerEditarHorasValor] = useState<number>(0.5);
  const [editarDescripcion, establecerEditarDescripcion] = useState<string>("");
  const [editarError, establecerEditarError] = useState<string>("");

  const operaSinConexion = isOffline || modoOfflineScrum || sinConexionDetectada;

  // 1. Hidratación inicial desde almacenamiento offline (restaura cronómetro en curso y horas pendientes)
  useEffect(() => {
    let cancelado = false;
    const hidratar = async () => {
      const cache = await leerEstadoHorasOffline(identificadorUsuario);
      if (!cancelado && cache) {
        establecerUltimaSincronizacion(cache.guardadoEn);
        restaurarEstadoHorasOffline(cache.estado.sesionActiva, cache.estado.horasOffline);
      }
      if (!cancelado) {
        establecerCacheHidratada(true);
      }
    };
    void hidratar();
    return () => {
      cancelado = true;
    };
  }, [identificadorUsuario]);

  // 2. Persistencia automática en caché local cada vez que cambia el cronómetro o el listado de horas
  useEffect(() => {
    if (!cacheHidratada) return;
    const horasPersistir = horasTecnico.filter(
      (h) => h.syncStatus === "pendiente" || h.id.startsWith("twh_")
    );
    void guardarEstadoHorasOffline(identificadorUsuario, {
      sesionActiva: sesionTrabajoActiva,
      horasOffline: horasPersistir,
    }).then((marca) => {
      establecerUltimaSincronizacion(marca);
    });
  }, [cacheHidratada, identificadorUsuario, sesionTrabajoActiva, horasTecnico]);

  // 3. Reloj en vivo del cronómetro
  useEffect(() => {
    if (!sesionTrabajoActiva) {
      establecerSesionTranscurridoSegundos(0);
      return;
    }
    const tick = () => {
      const inicioMs = new Date(sesionTrabajoActiva.startTime).getTime();
      const transcurrido = Math.max(0, Math.floor((Date.now() - inicioMs) / 1000));
      establecerSesionTranscurridoSegundos(transcurrido);
    };
    tick();
    const temporizador = setInterval(tick, 1000);
    return () => clearInterval(temporizador);
  }, [sesionTrabajoActiva]);

  // 4. Sincronización de jornadas pendientes cuando hay conexión
  const ejecutarSincronizacionHoras = useCallback(
    async (forzarOffline?: boolean) => {
      const usarOffline = forzarOffline ?? (isOffline || modoOfflineScrum);
      establecerSincronizando(true);
      establecerHorasError("");

      const conectado = await verificarConexionSincronizacionHoras(usarOffline);
      establecerSinConexionDetectada(!conectado);
      if (onCambioConexion) {
        onCambioConexion(!conectado);
      }

      if (conectado) {
        const cantidadSincronizadas = sincronizarHorasTrabajoPendientes();
        const marca = await guardarEstadoHorasOffline(identificadorUsuario, {
          sesionActiva: sesionTrabajoActiva,
          horasOffline: horasTecnico
            .filter((h) => h.id.startsWith("twh_"))
            .map((h) => ({ ...h, syncStatus: "sincronizado" })),
        });
        establecerUltimaSincronizacion(marca);
        if (cantidadSincronizadas > 0) {
          establecerHorasExito(
            `Se sincronizaron ${cantidadSincronizadas} ${
              cantidadSincronizadas === 1 ? "jornada pendiente" : "jornadas pendientes"
            } con el servidor.`
          );
          setTimeout(() => establecerHorasExito(""), 4500);
        }
      } else {
        establecerHorasError(
          "Sin conexión a internet: tus jornadas quedan respaldadas localmente y se sincronizarán al reconectar."
        );
      }

      establecerSincronizando(false);
    },
    [
      horasTecnico,
      identificadorUsuario,
      isOffline,
      modoOfflineScrum,
      onCambioConexion,
      sesionTrabajoActiva,
      sincronizarHorasTrabajoPendientes,
    ]
  );

  // Escucha automática de eventos online/offline del dispositivo
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const alPerderRed = () => {
      establecerSinConexionDetectada(true);
      if (onCambioConexion) onCambioConexion(true);
    };

    const alRecuperarRed = () => {
      establecerSinConexionDetectada(false);
      if (!modoOfflineScrum && !isOffline) {
        void ejecutarSincronizacionHoras(false);
      }
    };

    window.addEventListener("offline", alPerderRed);
    window.addEventListener("online", alRecuperarRed);
    return () => {
      window.removeEventListener("offline", alPerderRed);
      window.removeEventListener("online", alRecuperarRed);
    };
  }, [ejecutarSincronizacionHoras, isOffline, modoOfflineScrum, onCambioConexion]);

  // Métricas del dashboard de horas
  const resumenDashboard = useMemo(() => {
    const totalHoras = Number(
      horasTecnico.reduce((acc, h) => acc + Number(h.hours || 0), 0).toFixed(1)
    );
    const totalCosto = horasTecnico.reduce((acc, h) => {
      const proj = proyectos.find((p) => p.id === h.projectId);
      const tarifa = proj?.hourlyRate || 18500;
      return acc + Number(h.hours || 0) * tarifa;
    }, 0);
    const pendientesSync = horasTecnico.filter((h) => h.syncStatus === "pendiente").length;
    const editablesAhora = horasTecnico.filter(
      (h) => evaluarVentanaEdicionHoras(h.createdAt, plazoMaximoHoras, rolActual).puedeEditar
    ).length;

    return {
      totalHoras,
      totalCosto: Math.round(totalCosto),
      pendientesSync,
      editablesAhora,
    };
  }, [horasTecnico, proyectos, plazoMaximoHoras, rolActual]);

  const alternarModoOfflineScrum = async () => {
    const siguiente = !modoOfflineScrum;
    establecerModoOfflineScrum(siguiente);
    establecerHorasError("");
    if (siguiente) {
      establecerSinConexionDetectada(true);
      if (onCambioConexion) onCambioConexion(true);
      establecerHorasExito(
        "Modo Offline activado: el cronómetro y el registro de horas siguen funcionando y guardan en caché local."
      );
      setTimeout(() => establecerHorasExito(""), 4000);
    } else {
      await ejecutarSincronizacionHoras(false);
    }
  };

  const manejarIniciarAutomaticoSesion = () => {
    establecerHorasError("");
    establecerHorasExito("");
    if (!actualProyecto) {
      establecerHorasError("Seleccione un proyecto para iniciar la faena.");
      return;
    }
    const resultado = iniciarSesionTrabajo(actualProyecto.id);
    if (!resultado.success) {
      establecerHorasError(resultado.error || "Error al iniciar la jornada automática.");
    } else {
      establecerHorasExito(
        `Jornada iniciada automáticamente en ${actualProyecto.code}${
          operaSinConexion ? " (respaldada offline en este dispositivo)" : ""
        }.`
      );
      setTimeout(() => establecerHorasExito(""), 4000);
    }
  };

  const manejarDetenerAutomaticoSesion = () => {
    establecerHorasError("");
    establecerHorasExito("");
    const resultado = detenerSesionTrabajo(automaticoDescripcion, {
      offline: operaSinConexion,
    });
    if (!resultado.success) {
      establecerHorasError(resultado.error || "Error al finalizar jornada.");
    } else {
      const tarifa = sesionTrabajoActiva?.hourlyRate || actualProyecto?.hourlyRate || 18500;
      const costoReal = (resultado.hours || 0) * tarifa;
      const sufijoSync =
        resultado.syncStatus === "pendiente"
          ? " Guardado OFFLINE (pendiente de sincronización)."
          : " Sincronizado con el servidor central.";
      establecerHorasExito(
        `Jornada registrada: ${(resultado.hours || 0.5).toFixed(1)} HH (${formatearCLP(
          costoReal
        )}).${sufijoSync}`
      );
      establecerAutomaticoDescripcion("");
      setTimeout(() => establecerHorasExito(""), 5500);
    }
  };

  const manejarCancelarAutomaticoSesion = () => {
    if (Platform.OS === "web") {
      if (
        window.confirm(
          "¿Seguro que deseas descartar el cronómetro actual? El tiempo transcurrido no se guardará."
        )
      ) {
        cancelarSesionTrabajo();
        establecerAutomaticoDescripcion("");
      }
    } else {
      cancelarSesionTrabajo();
      establecerAutomaticoDescripcion("");
    }
  };

  const manejarAbrirEditarHora = (h: HoraTrabajoTecnico) => {
    const evaluacion = evaluarVentanaEdicionHoras(h.createdAt, plazoMaximoHoras, rolActual);
    if (!evaluacion.puedeEditar) {
      establecerHorasError(
        `Edición bloqueada: el registro superó la ventana permitida de ${plazoMaximoHoras} h.`
      );
      return;
    }
    establecerHorasError("");
    establecerEditandoHora(h);
    establecerEditarHorasValor(h.hours);
    establecerEditarDescripcion(h.description);
    establecerEditarError("");
  };

  const manejarConfirmarEditarHora = () => {
    if (!editandoHora) return;
    const resultado = actualizarHoraTrabajoTecnico(
      editandoHora.id,
      editarHorasValor,
      editarDescripcion,
      rolActual
    );
    if (!resultado.success) {
      establecerEditarError(resultado.error || "No se pudo actualizar el registro de horas.");
    } else {
      establecerEditandoHora(null);
      establecerHorasExito(
        `Jornada actualizada correctamente a ${editarHorasValor.toFixed(1)} HH (bloques de 0,5 h).`
      );
      setTimeout(() => establecerHorasExito(""), 4000);
    }
  };

  const bloquesEnVivo = calcularBloqueMediaHora(sesionTranscurridoSegundos);
  const costoEnVivo = sesionTrabajoActiva
    ? bloquesEnVivo * sesionTrabajoActiva.hourlyRate
    : 0;

  return (
    <ScrollView
      style={estilos.cuerpoScroll}
      contentContainerStyle={estilos.cuerpoContenido}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.contenedorCentrado}>
        {/* 1. BANNER DE CONECTIVIDAD OFFLINE Y SINCRONIZACIÓN [SCRUM] */}
        <View
          style={[
            estilos.syncBanner,
            operaSinConexion ? estilos.syncBannerOffline : estilos.syncBannerOnline,
          ]}
        >
          <View style={estilos.syncBannerTop}>
            <View style={estilos.syncBannerInfo}>
              <View
                style={[
                  estilos.syncIconoCirculo,
                  operaSinConexion && { backgroundColor: "#fde68a" },
                ]}
              >
                <Ionicons
                  name={operaSinConexion ? "cloud-offline-outline" : "timer-outline"}
                  size={18}
                  color={operaSinConexion ? tema.colors.warnDark : tema.colors.primaryDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estilos.syncTitulo}>
                  {operaSinConexion
                    ? "Registro de Horas Offline Activo (Caché Local)"
                    : "Cronómetro Automático Sincronizado"}
                </Text>
                <Text style={estilos.syncSub}>
                  Último respaldo:{" "}
                  <Text style={{ fontWeight: "bold", color: "#451a03" }}>
                    {formatearMarcaHorasOffline(ultimaSincronizacion)}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={estilos.syncBotonesFila}>
              {resumenDashboard.pendientesSync > 0 && (
                <TouchableOpacity
                  onPress={() => ejecutarSincronizacionHoras(false)}
                  disabled={sincronizando}
                  style={estilos.botonSyncPendientes}
                  activeOpacity={0.8}
                >
                  {sincronizando ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={14} color="#ffffff" />
                  )}
                  <Text style={estilos.botonSyncPendientesTexto}>
                    Sincronizar ({resumenDashboard.pendientesSync})
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={alternarModoOfflineScrum}
                style={[
                  estilos.botonScrumOffline,
                  modoOfflineScrum && estilos.botonScrumOfflineActivo,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={modoOfflineScrum ? "wifi-outline" : "airplane-outline"}
                  size={14}
                  color={modoOfflineScrum ? "#ffffff" : "#92400e"}
                />
                <Text
                  style={[
                    estilos.botonScrumOfflineTexto,
                    modoOfflineScrum && estilos.botonScrumOfflineTextoActivo,
                  ]}
                >
                  {modoOfflineScrum ? "Conectar Red" : "Modo Sin Conexión"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={estilos.scrumNota}>
            Las horas trabajadas se calculan en bloques de 0,5 h, se respaldan en el dispositivo y pueden editarse dentro de las primeras {plazoMaximoHoras} h antes de quedar bloqueadas.
          </Text>
        </View>

        {/* 2. DASHBOARD RESPONSIVO DE 4 KPIs */}
        <View style={estilos.kpiGrilla}>
          <View style={[estilos.kpiCaja, esMovilEstrecho && estilos.kpiCajaMovil]}>
            <Text style={estilos.kpiLbl}>HH Registradas</Text>
            <Text style={estilos.kpiVal}>{resumenDashboard.totalHoras.toFixed(1)} HH</Text>
            <Text style={estilos.kpiSub}>{horasTecnico.length} jornadas totales</Text>
          </View>

          <View
            style={[
              estilos.kpiCaja,
              esMovilEstrecho && estilos.kpiCajaMovil,
              { backgroundColor: tema.colors.primaryLight, borderColor: "#fde68a" },
            ]}
          >
            <Text style={[estilos.kpiLbl, { color: tema.colors.primaryDark }]}>
              Costo Mano de Obra
            </Text>
            <Text style={[estilos.kpiVal, { color: tema.colors.primaryDark }]}>
              {formatearCLP(resumenDashboard.totalCosto)}
            </Text>
            <Text style={[estilos.kpiSub, { color: tema.colors.primaryDark }]}>
              Imputado a obras
            </Text>
          </View>

          <View
            style={[
              estilos.kpiCaja,
              esMovilEstrecho && estilos.kpiCajaMovil,
              resumenDashboard.pendientesSync > 0
                ? { backgroundColor: tema.colors.warnLight, borderColor: tema.colors.warnBorder }
                : { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text
              style={[
                estilos.kpiLbl,
                {
                  color:
                    resumenDashboard.pendientesSync > 0
                      ? tema.colors.warnDark
                      : tema.colors.okDark,
                },
              ]}
            >
              Pendientes Sync
            </Text>
            <Text
              style={[
                estilos.kpiVal,
                {
                  color:
                    resumenDashboard.pendientesSync > 0
                      ? tema.colors.warnDark
                      : tema.colors.okDark,
                },
              ]}
            >
              {resumenDashboard.pendientesSync}
            </Text>
            <Text
              style={[
                estilos.kpiSub,
                {
                  color:
                    resumenDashboard.pendientesSync > 0
                      ? tema.colors.warnDark
                      : tema.colors.okDark,
                },
              ]}
            >
              {resumenDashboard.pendientesSync > 0 ? "En cola offline" : "Todo sincronizado"}
            </Text>
          </View>

          <View style={[estilos.kpiCaja, esMovilEstrecho && estilos.kpiCajaMovil]}>
            <Text style={estilos.kpiLbl}>Ventana Edición</Text>
            <Text style={estilos.kpiVal}>{plazoMaximoHoras} h</Text>
            <Text style={estilos.kpiSub}>
              {resumenDashboard.editablesAhora} editables ahora
            </Text>
          </View>
        </View>

        {/* 3. SELECTOR DE PROYECTO / FAENA */}
        <View style={{ gap: 6 }}>
          <Text style={estilos.campoEtiqueta}>PROYECTO / FAENA A IMPUTAR HH:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.chipsScrollContenido}
          >
            {activoProyectos.map((p) => {
              const esSeleccionado = p.id === actualProyecto?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => establecerSeleccionadoProyectoId(p.id)}
                  style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}
                    numberOfLines={1}
                  >
                    {p.code} • {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. CRONÓMETRO EN CURSO O INICIO AUTOMÁTICO DE JORNADA */}
        {activoProyectos.length === 0 ? (
          <EstadoVacio
            icon="time-outline"
            title="Sin proyectos activos"
            description="No tienes proyectos asignados actualmente para imputar horas hombre."
            containerStyle={{ marginVertical: 24 }}
          />
        ) : sesionTrabajoActiva ? (
          <Tarjeta variant="elevated" style={estilos.activoSesionTarjeta}>
            <View style={estilos.activoSesionEncabezado}>
              <View style={estilos.enVivoInsigniaFila}>
                <View style={estilos.activoPuntoPulsoGrande} />
                <Text style={estilos.enVivoInsigniaTexto}>JORNADA EN CURSO EN FAENA</Text>
              </View>
              <Insignia
                label={operaSinConexion ? "Guardado Offline" : "En Línea"}
                tone={operaSinConexion ? "warn" : "ok"}
                size="sm"
                icon={operaSinConexion ? "cloud-offline-outline" : "cloud-done-outline"}
              />
            </View>

            <Text style={estilos.activoSesionProyecto}>
              {sesionTrabajoActiva.projectCode} • {sesionTrabajoActiva.projectName}
            </Text>
            <Text style={estilos.activoSesionIniciado}>
              Iniciado:{" "}
              {new Date(sesionTrabajoActiva.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              • Tarifa: {formatearCLP(sesionTrabajoActiva.hourlyRate)} / HH
            </Text>

            {/* Reloj digital */}
            <View style={estilos.temporizadorRelojCaja}>
              <Text style={estilos.temporizadorDigits}>
                {formatearDuracionReloj(sesionTranscurridoSegundos)}
              </Text>
              <Text style={estilos.temporizadorSubEtiqueta}>
                Tiempo transcurrido en terreno (persistido en almacenamiento offline)
              </Text>
            </View>

            {/* Cálculo en vivo de bloques de 0,5 h y costo real */}
            <View style={estilos.enVivoCalculoGrilla}>
              <View style={estilos.enVivoCalculoColumna}>
                <Text style={estilos.enVivoCalculoValor}>{bloquesEnVivo.toFixed(1)} HH</Text>
                <Text style={estilos.enVivoCalculoDescripcion}>Bloque 0,5 h</Text>
              </View>
              <View style={estilos.enVivoCalculoDivisor} />
              <View style={estilos.enVivoCalculoColumna}>
                <Text style={estilos.enVivoCalculoValor}>{formatearCLP(costoEnVivo)}</Text>
                <Text style={estilos.enVivoCalculoDescripcion}>Costo Mano de Obra</Text>
              </View>
              <View style={estilos.enVivoCalculoDivisor} />
              <View style={estilos.enVivoCalculoColumna}>
                <Text style={estilos.enVivoCalculoValor}>
                  {operaSinConexion ? "Pendiente" : "Directo"}
                </Text>
                <Text style={estilos.enVivoCalculoDescripcion}>Estado Sync</Text>
              </View>
            </View>

            <CampoTexto
              label="Descripción de la labor ejecutada"
              value={automaticoDescripcion}
              onChangeText={establecerAutomaticoDescripcion}
              placeholder="Ej: Montaje de bandejas, cableado estructurado y pruebas..."
            />

            {Boolean(horasError) && <Text style={estilos.errorTexto}>{horasError}</Text>}
            {Boolean(horasExito) && <Text style={estilos.exitoTexto}>{horasExito}</Text>}

            <View
              style={[
                estilos.activoAccionesFila,
                esMovilEstrecho && estilos.activoAccionesApiladas,
              ]}
            >
              <Boton
                title="Descartar"
                variant="ghost"
                icon="close-outline"
                onPress={manejarCancelarAutomaticoSesion}
                style={[
                  estilos.botonAccionResponsive,
                  esMovilEstrecho && { width: "100%" },
                ]}
              />
              <Boton
                title={
                  operaSinConexion
                    ? "Finalizar y Guardar Offline"
                    : "Finalizar y Registrar HH"
                }
                variant="primary"
                icon="checkmark-circle-outline"
                onPress={manejarDetenerAutomaticoSesion}
                style={[
                  estilos.botonAccionResponsive,
                  { flex: 1.8 },
                  esMovilEstrecho && { width: "100%", flex: 0 },
                ]}
              />
            </View>
          </Tarjeta>
        ) : (
          <Tarjeta variant="elevated" style={estilos.automaticoPromptTarjeta}>
            <View style={estilos.automaticoPromptSuperior}>
              <View style={estilos.automaticoIconoCirculo}>
                <Ionicons name="play" size={24} color={tema.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={estilos.tarjetaEncabezado}>
                  Cronómetro Automático al Iniciar Proyecto
                </Text>
                <Text style={estilos.tarjetaSub}>
                  Al iniciar tu faena el sistema cronometra en segundo plano, redondea
                  automáticamente a bloques de 0,5 h y respalda la jornada sin conexión.
                </Text>
              </View>
            </View>

            <View style={estilos.automaticoPastillasCaja}>
              <View style={estilos.automaticoPastillaElemento}>
                <Ionicons name="speedometer-outline" size={14} color={tema.colors.primary} />
                <Text style={estilos.automaticoPastillaTexto}>Bloques de 0,5 h</Text>
              </View>
              <View style={estilos.automaticoPastillaElemento}>
                <Ionicons name="shield-checkmark-outline" size={14} color={tema.colors.ok} />
                <Text style={estilos.automaticoPastillaTexto}>Máx 24 h / día</Text>
              </View>
              <View style={estilos.automaticoPastillaElemento}>
                <Ionicons name="create-outline" size={14} color={tema.colors.infoDark} />
                <Text style={estilos.automaticoPastillaTexto}>
                  Edición hasta {plazoMaximoHoras} h
                </Text>
              </View>
              <View style={estilos.automaticoPastillaElemento}>
                <Ionicons name="cloud-offline-outline" size={14} color={tema.colors.warnDark} />
                <Text style={estilos.automaticoPastillaTexto}>Soporte Offline</Text>
              </View>
            </View>

            <View style={estilos.resumenProyectoInicio}>
              <View style={estilos.automaticoProyectoTarifaFila}>
                <Text style={estilos.automaticoProyectoTarifaEtiqueta}>Proyecto seleccionado:</Text>
                <Text style={estilos.automaticoProyectoTarifaValor}>
                  {actualProyecto
                    ? `${actualProyecto.code} - ${actualProyecto.name}`
                    : "Seleccione un proyecto"}
                </Text>
              </View>
              <View style={estilos.automaticoProyectoTarifaFila}>
                <Text style={estilos.automaticoProyectoTarifaEtiqueta}>Tarifa M.O. imputable:</Text>
                <Text style={estilos.automaticoProyectoTarifaDestacado}>
                  {formatearCLP(actualProyecto?.hourlyRate || 18500)} / HH
                </Text>
              </View>
            </View>

            {Boolean(horasError) && <Text style={estilos.errorTexto}>{horasError}</Text>}
            {Boolean(horasExito) && <Text style={estilos.exitoTexto}>{horasExito}</Text>}

            <Boton
              title={`Iniciar Faena en ${actualProyecto?.code || "Proyecto"}`}
              variant="primary"
              icon="play-circle"
              onPress={manejarIniciarAutomaticoSesion}
              style={{ marginTop: 12, minHeight: 48 }}
            />
          </Tarjeta>
        )}

        {/* 5. HISTORIAL DE JORNADAS CON EDICIÓN EN BLOQUES DE 0,5 h Y BLOQUEO POR PLAZO */}
        <View style={estilos.historialCabeceraBloque}>
          <View style={estilos.historialTituloFila}>
            <Text style={estilos.historialEncabezado}>
              Mis Jornadas Registradas ({horasTecnico.length})
            </Text>
            <Insignia
              label={`Ventana edición: ${plazoMaximoHoras} h`}
              tone="info"
              size="sm"
            />
          </View>
          <Text style={estilos.historialReglaAviso}>
            Puedes editar en bloques de 0,5 h dentro de las primeras {plazoMaximoHoras} horas desde
            el registro. Vencido el plazo, el registro queda bloqueado automáticamente.
          </Text>
        </View>

        <View
          style={[
            estilos.horasGrilla,
            esPantallaAncha && estilos.horasGrillaAncha,
          ]}
        >
          {horasTecnico.map((h) => {
            const evaluacion = evaluarVentanaEdicionHoras(
              h.createdAt,
              plazoMaximoHoras,
              rolActual
            );
            const proyecto = proyectos.find((p) => p.id === h.projectId);
            const tarifa = proyecto?.hourlyRate || 18500;
            const costoReal = h.hours * tarifa;
            const pendienteSync = h.syncStatus === "pendiente";

            return (
              <Tarjeta
                key={h.id}
                variant="default"
                style={[
                  estilos.horaTarjeta,
                  esPantallaAncha && estilos.horaTarjetaAncha,
                  pendienteSync && estilos.horaTarjetaPendienteSync,
                ]}
              >
                <View style={estilos.horaTarjetaSuperior}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={estilos.horaProyecto}>
                      {h.projectCode} • {h.projectName}
                    </Text>
                    <Text style={estilos.horaFecha}>
                      {formatearFecha(h.date)} • Costo: {formatearCLP(costoReal)}
                    </Text>
                    <Text style={estilos.horaDescripcion}>{h.description}</Text>
                  </View>

                  <View style={estilos.horaBadgesColumna}>
                    <Insignia label={`${h.hours.toFixed(1)} HH`} tone="primary" size="md" />
                    <Insignia
                      label={pendienteSync ? "Pendiente Sync" : "Sincronizado"}
                      tone={pendienteSync ? "warn" : "ok"}
                      icon={pendienteSync ? "cloud-offline-outline" : "cloud-done-outline"}
                      size="sm"
                    />
                    <Insignia
                      label={h.registeredBy === "admin_manual" ? "Manual Admin" : "Cronómetro"}
                      tone={h.registeredBy === "admin_manual" ? "info" : "mute"}
                      size="sm"
                    />
                  </View>
                </View>

                {/* Pie de tarjeta: estado de ventana de edición + botón Editar / Bloqueado */}
                <View style={estilos.horaTarjetaPie}>
                  <View style={estilos.ventanaEstadoFila}>
                    <Ionicons
                      name={evaluacion.puedeEditar ? "time-outline" : "lock-closed"}
                      size={14}
                      color={evaluacion.puedeEditar ? tema.colors.okDark : tema.colors.danger}
                    />
                    <Text
                      style={[
                        estilos.ventanaEstadoTexto,
                        {
                          color: evaluacion.puedeEditar
                            ? tema.colors.okDark
                            : tema.colors.danger,
                        },
                      ]}
                    >
                      {evaluacion.etiquetaEstado}
                    </Text>
                  </View>

                  {evaluacion.puedeEditar ? (
                    <Boton
                      title="Editar (0,5 h)"
                      variant="outline"
                      size="sm"
                      icon="create-outline"
                      onPress={() => manejarAbrirEditarHora(h)}
                      style={{ minHeight: 36 }}
                    />
                  ) : (
                    <View style={estilos.bloqueadoChip}>
                      <Ionicons name="lock-closed" size={13} color={tema.colors.danger} />
                      <Text style={estilos.bloqueadoChipTexto}>Bloqueado</Text>
                    </View>
                  )}
                </View>
              </Tarjeta>
            );
          })}
        </View>
      </View>

      {/* MODAL PARA EDITAR HORAS EN BLOQUES DE 0,5 h DENTRO DE LA VENTANA PERMITIDA */}
      <VistaModal
        visible={Boolean(editandoHora)}
        onClose={() => establecerEditandoHora(null)}
        title="Editar Jornada en Bloques de 0,5 h"
        subtitle={
          editandoHora
            ? `${editandoHora.projectCode} • Registrado el ${formatearFecha(editandoHora.date)}`
            : ""
        }
        maxWidth={500}
      >
        {editandoHora &&
          (() => {
            const evaluacion = evaluarVentanaEdicionHoras(
              editandoHora.createdAt,
              plazoMaximoHoras,
              rolActual
            );
            return (
              <View style={{ marginBottom: 12 }}>
                {evaluacion.vencido ? (
                  <View style={estilos.adminEditarAviso}>
                    <Ionicons
                      name="shield-checkmark"
                      size={16}
                      color={tema.colors.warnDark}
                    />
                    <Text style={estilos.adminEditarAvisoTexto}>
                      Modo Administrador: edición habilitada fuera de la ventana de{" "}
                      {plazoMaximoHoras} h.
                    </Text>
                  </View>
                ) : (
                  <View style={estilos.ventanaActivaAviso}>
                    <Ionicons name="checkmark-circle" size={16} color={tema.colors.ok} />
                    <Text style={estilos.ventanaActivaAvisoTexto}>
                      Dentro de la ventana permitida: {evaluacion.etiquetaEstado}.
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

        <Text style={estilos.horasCampoEtiqueta}>
          Ajustar Horas (bloques de 0,5 h — máx. 24,0 h):
        </Text>
        <View style={estilos.horasAjustadorFila}>
          <TouchableOpacity
            onPress={() =>
              establecerEditarHorasValor((p) => Math.max(0.5, Math.round((p - 0.5) * 2) / 2))
            }
            style={estilos.horaPasoBoton}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={16} color={tema.colors.primaryDark} />
            <Text style={estilos.horaPasoBotonTexto}>0,5 h</Text>
          </TouchableOpacity>

          <View style={estilos.horasDisplay}>
            <Text style={estilos.horasDisplayValor}>{editarHorasValor.toFixed(1)}</Text>
            <Text style={estilos.horasDisplayUnidad}>HH</Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              establecerEditarHorasValor((p) => Math.min(24.0, Math.round((p + 0.5) * 2) / 2))
            }
            style={estilos.horaPasoBoton}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={tema.colors.primaryDark} />
            <Text style={estilos.horaPasoBotonTexto}>0,5 h</Text>
          </TouchableOpacity>
        </View>

        <View style={estilos.rapidoHorasFila}>
          {[0.5, 1.0, 2.0, 4.0, 8.0, 10.0].map((h) => {
            const esActivo = editarHorasValor === h;
            return (
              <TouchableOpacity
                key={`modal-h-${h}`}
                style={[estilos.rapidoHoraChip, esActivo && estilos.rapidoHoraChipActivo]}
                onPress={() => establecerEditarHorasValor(h)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    estilos.rapidoHoraTexto,
                    esActivo && estilos.rapidoHoraTextoActivo,
                  ]}
                >
                  {h.toFixed(1)} h
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ marginTop: 10 }}>
          <CampoTexto
            label="Descripción de las labores"
            value={editarDescripcion}
            onChangeText={establecerEditarDescripcion}
          />
        </View>

        {Boolean(editarError) && <Text style={estilos.errorTexto}>{editarError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerEditandoHora(null)}
            style={{ flex: 1, minWidth: 110 }}
          />
          <Boton
            title="Guardar Cambios"
            variant="primary"
            icon="save-outline"
            onPress={manejarConfirmarEditarHora}
            style={{ flex: 1.5, minWidth: 150, minHeight: 46 }}
          />
        </View>
      </VistaModal>
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  cuerpoScroll: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  cuerpoContenido: {
    padding: tema.spacing.md,
    paddingBottom: 44,
  },
  contenedorCentrado: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: 14,
  },
  syncBanner: {
    borderRadius: tema.radius.md,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  syncBannerOnline: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  syncBannerOffline: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  syncBannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  syncBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 220,
  },
  syncIconoCirculo: {
    width: 36,
    height: 36,
    borderRadius: tema.radius.full,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  syncTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: "#78350f",
  },
  syncSub: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 2,
  },
  syncBotonesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  botonSyncPendientes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: tema.radius.full,
  },
  botonSyncPendientesTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  botonScrumOffline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: tema.radius.full,
  },
  botonScrumOfflineActivo: {
    backgroundColor: "#d97706",
    borderColor: "#b45309",
  },
  botonScrumOfflineTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
  },
  botonScrumOfflineTextoActivo: {
    color: "#ffffff",
  },
  scrumNota: {
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCaja: {
    flex: 1,
    minWidth: 140,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  kpiCajaMovil: {
    minWidth: "46%",
  },
  kpiLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  kpiVal: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  campoEtiqueta: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textSecondary,
    letterSpacing: 0.4,
  },
  chipsScrollContenido: {
    gap: 8,
    paddingVertical: 2,
  },
  chipBoton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
    justifyContent: "center",
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
  },
  chipBotonActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  chipTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  chipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  activoSesionTarjeta: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: tema.colors.primary,
    gap: 10,
  },
  activoSesionEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  enVivoInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activoPuntoPulsoGrande: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tema.colors.danger,
  },
  enVivoInsigniaTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.danger,
    letterSpacing: 0.5,
  },
  activoSesionProyecto: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  activoSesionIniciado: {
    fontSize: 12,
    color: tema.colors.textMuted,
  },
  temporizadorRelojCaja: {
    backgroundColor: "#1c1917",
    borderRadius: tema.radius.md,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  temporizadorDigits: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#f59e0b",
    letterSpacing: 2,
  },
  temporizadorSubEtiqueta: {
    fontSize: 11,
    color: "#d6d3d1",
    marginTop: 4,
    textAlign: "center",
  },
  enVivoCalculoGrilla: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  enVivoCalculoColumna: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  enVivoCalculoDivisor: {
    width: 1,
    height: "80%",
    backgroundColor: tema.colors.border,
  },
  enVivoCalculoValor: {
    fontSize: 14,
    fontWeight: "bold",
    color: tema.colors.text,
    textAlign: "center",
  },
  enVivoCalculoDescripcion: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  activoAccionesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  activoAccionesApiladas: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  botonAccionResponsive: {
    flex: 1,
    minWidth: 140,
    minHeight: 46,
  },
  automaticoPromptTarjeta: {
    padding: 16,
    gap: 12,
  },
  automaticoPromptSuperior: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  automaticoIconoCirculo: {
    width: 48,
    height: 48,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaEncabezado: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  tarjetaSub: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  automaticoPastillasCaja: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  automaticoPastillaElemento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  automaticoPastillaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  resumenProyectoInicio: {
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 10,
    gap: 4,
  },
  automaticoProyectoTarifaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  automaticoProyectoTarifaEtiqueta: {
    fontSize: 12,
    color: tema.colors.textMuted,
  },
  automaticoProyectoTarifaValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  automaticoProyectoTarifaDestacado: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "600",
    marginTop: 4,
  },
  exitoTexto: {
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
    marginTop: 4,
  },
  historialCabeceraBloque: {
    marginTop: 6,
    gap: 4,
  },
  historialTituloFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  historialEncabezado: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  historialReglaAviso: {
    fontSize: 12,
    color: tema.colors.textMuted,
    lineHeight: 17,
  },
  horasGrilla: {
    gap: 10,
  },
  horasGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  horaTarjeta: {
    padding: 14,
    gap: 10,
  },
  horaTarjetaAncha: {
    width: "48.8%",
  },
  horaTarjetaPendienteSync: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.warn,
  },
  horaTarjetaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  horaProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  horaFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  horaDescripcion: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 6,
    lineHeight: 17,
  },
  horaBadgesColumna: {
    alignItems: "flex-end",
    gap: 5,
  },
  horaTarjetaPie: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  ventanaEstadoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 160,
  },
  ventanaEstadoTexto: {
    fontSize: 11,
    fontWeight: "600",
  },
  bloqueadoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.danger,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bloqueadoChipTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.danger,
  },
  adminEditarAviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.warnLight,
    borderRadius: tema.radius.sm,
    padding: 10,
  },
  adminEditarAvisoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.warnDark,
    fontWeight: "600",
  },
  ventanaActivaAviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderRadius: tema.radius.sm,
    padding: 10,
  },
  ventanaActivaAvisoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
  },
  horasCampoEtiqueta: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 8,
  },
  horasAjustadorFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  horaPasoBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: tema.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  horaPasoBotonTexto: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  horasDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    paddingVertical: 8,
  },
  horasDisplayValor: {
    fontSize: 24,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  horasDisplayUnidad: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
  },
  rapidoHorasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  rapidoHoraChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  rapidoHoraChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  rapidoHoraTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  rapidoHoraTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  modalBotonesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
});
