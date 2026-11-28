// Módulo móvil de Hojas de Servicio y Checklists con persistencia inmediata en disco local
// (a prueba de cierres inesperados), indicador Pendiente/Sincronizado y subida automática al reconectar.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import {
  FotoHojaServicio,
  HojaServicio,
  ItemListaChequeoServicio,
} from "@/nucleo/tipos";
import {
  BorradorHojaServicio,
  CHECKLIST_BASE_FAENA,
  formatearMarcaDiscoHojas,
  guardarEstadoDiscoHojas,
  leerEstadoDiscoHojas,
  verificarConexionSubidaHojas,
} from "./hojasServicioOffline";

interface PropiedadesVistaHojasServicioTecnico {
  isOffline?: boolean;
  onCambioConexion?: (sinConexion: boolean) => void;
}

type FiltroEstadoHoja = "todas" | "pendiente" | "sincronizado" | "conflicto";

const crearChecklistInicial = (): ItemListaChequeoServicio[] =>
  CHECKLIST_BASE_FAENA.map((item) => ({ ...item }));

export const VistaHojasServicioTecnico: React.FC<PropiedadesVistaHojasServicioTecnico> = ({
  isOffline = false,
  onCambioConexion,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const {
    proyectos,
    hojasServicio,
    solicitudesMaterial,
    crearHojaServicio,
    resolverConflictoHojaServicio,
    sincronizarHojasServicioPendientes,
    restaurarHojasServicioOffline,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const identificadorUsuario = useMemo(() => {
    const idNumerico = (usuario as unknown as { id_usuario?: number })?.id_usuario;
    return idNumerico ? String(idNumerico) : usuario.rut || usuario.email || "tecnico";
  }, [usuario]);

  const activoProyectos = useMemo(
    () =>
      proyectos.filter(
        (p) =>
          p.status !== "cerrado" &&
          p.status !== "finalizado" &&
          (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
      ),
    [proyectos, usuario.rut]
  );

  // Estados de conectividad, persistencia en disco y sincronización automática
  const [sinConexionDetectada, establecerSinConexionDetectada] = useState<boolean>(isOffline);
  const [modoAvionScrum, establecerModoAvionScrum] = useState<boolean>(false);
  const [sincronizando, establecerSincronizando] = useState<boolean>(false);
  const [ultimaMarcaDisco, establecerUltimaMarcaDisco] = useState<string | null>(null);
  const [discoHidratado, establecerDiscoHidratado] = useState<boolean>(false);
  const [borradorEnDisco, establecerBorradorEnDisco] = useState<BorradorHojaServicio | null>(null);
  const [avisoSistema, establecerAvisoSistema] = useState<string>("");

  // Filtros dinámicos del dashboard de hojas
  const [busquedaHoja, establecerBusquedaHoja] = useState<string>("");
  const [filtroEstado, establecerFiltroEstado] = useState<FiltroEstadoHoja>("todas");

  // Estados del modal de Nueva Hoja / Borrador en curso
  const [nuevoHojaModal, establecerNuevoHojaModal] = useState(false);
  const [hojaProyectoId, establecerHojaProyectoId] = useState<string>(
    activoProyectos[0]?.id || ""
  );
  const [hojaReceptor, establecerHojaReceptor] = useState<string>("");
  const [hojaNotas, establecerHojaNotas] = useState<string>("");
  const [listaChequeo, establecerListaChequeo] = useState<ItemListaChequeoServicio[]>(
    crearChecklistInicial
  );
  const [personalizadoTareaEtiqueta, establecerPersonalizadoTareaEtiqueta] = useState("");
  const [fotos, establecerFotos] = useState<FotoHojaServicio[]>([]);
  const [fotoError, establecerFotoError] = useState("");
  const [formularioError, establecerFormularioError] = useState("");

  const operaSinConexion = isOffline || modoAvionScrum || sinConexionDetectada;

  // 1. Recuperación inmediata desde disco local al abrir la app (a prueba de cierres forzados)
  useEffect(() => {
    let cancelado = false;
    const hidratarDesdeDisco = async () => {
      const recuperado = await leerEstadoDiscoHojas(identificadorUsuario);
      if (!cancelado && recuperado) {
        establecerUltimaMarcaDisco(recuperado.guardadoEn);
        if (recuperado.estado.hojasLocales.length > 0) {
          restaurarHojasServicioOffline(recuperado.estado.hojasLocales);
        }
        if (recuperado.estado.borrador) {
          const b = recuperado.estado.borrador;
          establecerBorradorEnDisco(b);
          establecerHojaProyectoId(b.proyectoId || activoProyectos[0]?.id || "");
          establecerHojaReceptor(b.receptor || "");
          establecerHojaNotas(b.notas || "");
          establecerListaChequeo(
            b.checklist && b.checklist.length > 0 ? b.checklist : crearChecklistInicial()
          );
          establecerFotos(Array.isArray(b.fotos) ? b.fotos : []);
        }
      }
      if (!cancelado) {
        establecerDiscoHidratado(true);
      }
    };
    void hidratarDesdeDisco();
    return () => {
      cancelado = true;
    };
  }, [identificadorUsuario]);

  // 2. Persistencia inmediata en disco local cada vez que cambian las hojas o el borrador
  const persistirEnDiscoInmediato = useCallback(
    async (hojasActuales: HojaServicio[], borradorActual: BorradorHojaServicio | null) => {
      const hojasLocales = hojasActuales.filter(
        (h) => h.syncStatus === "pendiente" || h.id.startsWith("hs_")
      );
      const marca = await guardarEstadoDiscoHojas(identificadorUsuario, {
        hojasLocales,
        borrador: borradorActual,
      });
      establecerUltimaMarcaDisco(marca);
    },
    [identificadorUsuario]
  );

  // Guarda automáticamente en disco cualquier cambio de hojas emitidas
  useEffect(() => {
    if (!discoHidratado) return;
    void persistirEnDiscoInmediato(hojasServicio, borradorEnDisco);
  }, [discoHidratado, hojasServicio, borradorEnDisco, persistirEnDiscoInmediato]);

  // Guarda automáticamente el borrador en disco ante cada cambio dentro del modal
  useEffect(() => {
    if (!discoHidratado || !nuevoHojaModal) return;
    const borradorActualizado: BorradorHojaServicio = {
      proyectoId: hojaProyectoId || activoProyectos[0]?.id || "",
      receptor: hojaReceptor,
      notas: hojaNotas,
      checklist: listaChequeo,
      fotos,
      actualizadoEn: new Date().toISOString(),
    };
    establecerBorradorEnDisco(borradorActualizado);
  }, [
    discoHidratado,
    nuevoHojaModal,
    hojaProyectoId,
    hojaReceptor,
    hojaNotas,
    listaChequeo,
    fotos,
    activoProyectos,
  ]);

  // 3. Subida automática al recuperar internet
  const ejecutarSubidaAutomatica = useCallback(
    async (forzarOffline?: boolean, silencioso = false) => {
      const usarOffline = forzarOffline ?? (isOffline || modoAvionScrum);
      establecerSincronizando(true);

      const conectado = await verificarConexionSubidaHojas(usarOffline);
      establecerSinConexionDetectada(!conectado);
      if (onCambioConexion) {
        onCambioConexion(!conectado);
      }

      if (conectado) {
        const subidas = sincronizarHojasServicioPendientes();
        if (subidas > 0) {
          establecerAvisoSistema(
            `Subida automática completada: ${subidas} ${
              subidas === 1 ? "hoja de servicio sincronizada" : "hojas de servicio sincronizadas"
            } con el servidor.`
          );
          setTimeout(() => establecerAvisoSistema(""), 5000);
        } else if (!silencioso) {
          establecerAvisoSistema("Todas las hojas de servicio se encuentran sincronizadas.");
          setTimeout(() => establecerAvisoSistema(""), 3500);
        }
      } else if (!silencioso) {
        establecerAvisoSistema(
          "Sin internet: tus checklists y fotografías permanecen intactos en disco local y subirán solos al reconectar."
        );
        setTimeout(() => establecerAvisoSistema(""), 4500);
      }

      establecerSincronizando(false);
    },
    [isOffline, modoAvionScrum, onCambioConexion, sincronizarHojasServicioPendientes]
  );

  // Escucha automática de reconexión del dispositivo / navegador
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const alPerderRed = () => {
      establecerSinConexionDetectada(true);
      if (onCambioConexion) onCambioConexion(true);
    };

    const alRecuperarRed = () => {
      establecerSinConexionDetectada(false);
      if (!modoAvionScrum && !isOffline) {
        void ejecutarSubidaAutomatica(false, false);
      }
    };

    window.addEventListener("offline", alPerderRed);
    window.addEventListener("online", alRecuperarRed);
    return () => {
      window.removeEventListener("offline", alPerderRed);
      window.removeEventListener("online", alRecuperarRed);
    };
  }, [ejecutarSubidaAutomatica, isOffline, modoAvionScrum, onCambioConexion]);

  // Sondeo automático ligero cada 8 s si hay hojas pendientes y no está forzado el modo avión
  const cantidadPendientes = useMemo(
    () => hojasServicio.filter((s) => s.syncStatus === "pendiente" && !s.hasVersionConflict).length,
    [hojasServicio]
  );

  useEffect(() => {
    if (!discoHidratado || cantidadPendientes === 0 || modoAvionScrum || isOffline) return;
    const intervalo = setInterval(() => {
      void ejecutarSubidaAutomatica(false, true);
    }, 8000);
    return () => clearInterval(intervalo);
  }, [discoHidratado, cantidadPendientes, modoAvionScrum, isOffline, ejecutarSubidaAutomatica]);

  // Alternar verificación SCRUM de Modo Avión
  const alternarModoAvionScrum = async () => {
    const siguiente = !modoAvionScrum;
    establecerModoAvionScrum(siguiente);
    if (siguiente) {
      establecerSinConexionDetectada(true);
      if (onCambioConexion) onCambioConexion(true);
      establecerAvisoSistema(
        "Modo sin conexión activo: los checklists y fotografías se guardarán en el dispositivo y se sincronizarán automáticamente al reconectar."
      );
      setTimeout(() => establecerAvisoSistema(""), 5000);
    } else {
      await ejecutarSubidaAutomatica(false, false);
    }
  };

  // Acciones del checklist y fotos
  const abrirModalNuevaHoja = (usarBorradorExistente: boolean) => {
    establecerFormularioError("");
    establecerFotoError("");

    if (usarBorradorExistente && borradorEnDisco) {
      establecerHojaProyectoId(borradorEnDisco.proyectoId || activoProyectos[0]?.id || "");
      establecerHojaReceptor(borradorEnDisco.receptor || "");
      establecerHojaNotas(borradorEnDisco.notas || "");
      establecerListaChequeo(
        borradorEnDisco.checklist.length > 0
          ? borradorEnDisco.checklist
          : crearChecklistInicial()
      );
      establecerFotos(borradorEnDisco.fotos || []);
    } else {
      establecerHojaProyectoId(activoProyectos[0]?.id || "");
      establecerHojaReceptor("Carlos Mendoza (Supervisor de Obra)");
      establecerHojaNotas("Trabajo ejecutado según especificaciones técnicas en terreno.");
      establecerListaChequeo(crearChecklistInicial());
      establecerFotos([]);
    }

    establecerNuevoHojaModal(true);
  };

  const descartarBorradorDisco = () => {
    establecerBorradorEnDisco(null);
    establecerAvisoSistema("Borrador local descartado.");
    setTimeout(() => establecerAvisoSistema(""), 3000);
  };

  const manejarAlternarListaChequeoElemento = (id: string) => {
    establecerListaChequeo((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  const manejarAgregarPersonalizadoTarea = () => {
    if (!personalizadoTareaEtiqueta.trim()) return;
    establecerListaChequeo((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        label: personalizadoTareaEtiqueta.trim(),
        completed: true,
      },
    ]);
    establecerPersonalizadoTareaEtiqueta("");
  };

  // Validación estricta de peso (máx 5 MB) y guardado inmediato en disco
  const manejarSimulateAgregarFoto = (simulatedSizeMb: number) => {
    establecerFotoError("");
    if (simulatedSizeMb > 5.0) {
      establecerFotoError(
        `Bloqueo: la fotografía (${simulatedSizeMb} MB) supera el límite máximo permitido de 5,0 MB por archivo.`
      );
      return;
    }

    const ahoraHora = new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const nuevaFoto: FotoHojaServicio = {
      id: `photo_${Date.now()}`,
      name: `evidencia_faena_${fotos.length + 1}.jpg`,
      sizeMb: simulatedSizeMb,
      timestamp: `Hoy ${ahoraHora}`,
    };
    establecerFotos((prev) => [...prev, nuevaFoto]);
  };

  // Selector real de imagen desde el dispositivo/navegador con persistencia en Data URL
  const manejarAdjuntarFotoReal = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      manejarSimulateAgregarFoto(1.8);
      return;
    }

    establecerFotoError("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const archivo = input.files?.[0];
      if (!archivo) return;

      const tamanoMb = Number((archivo.size / (1024 * 1024)).toFixed(2));
      if (tamanoMb > 5.0) {
        establecerFotoError(
          `Bloqueo: "${archivo.name}" pesa ${tamanoMb} MB y supera el máximo permitido de 5,0 MB.`
        );
        return;
      }

      const lector = new FileReader();
      lector.onload = () => {
        const uriBase64 = typeof lector.result === "string" ? lector.result : undefined;
        const ahoraHora = new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const nuevaFoto: FotoHojaServicio = {
          id: `photo_${Date.now()}`,
          name: archivo.name,
          sizeMb: Math.max(0.1, tamanoMb),
          uri: uriBase64,
          timestamp: `Hoy ${ahoraHora}`,
        };
        establecerFotos((prev) => [...prev, nuevaFoto]);
      };
      lector.readAsDataURL(archivo);
    };
    input.click();
  };

  const manejarQuitarFoto = (id: string) => {
    establecerFotos((prev) => prev.filter((p) => p.id !== id));
  };

  const manejarGuardarHoja = () => {
    establecerFormularioError("");
    const proyecto =
      activoProyectos.find((p) => p.id === hojaProyectoId) || activoProyectos[0];
    if (!proyecto) {
      establecerFormularioError("Seleccione un proyecto válido.");
      return;
    }

    const tareasCompletadas = listaChequeo.filter((c) => c.completed).length;
    if (tareasCompletadas === 0) {
      establecerFormularioError(
        "Debe marcar al menos una tarea completada en el checklist antes de emitir la hoja."
      );
      return;
    }

    const codigo = `HS-${new Date().getFullYear()}-${String(hojasServicio.length + 106).padStart(
      3,
      "0"
    )}`;
    const estadoInicialSync: "pendiente" | "sincronizado" = operaSinConexion
      ? "pendiente"
      : "sincronizado";

    crearHojaServicio({
      code: codigo,
      projectId: proyecto.id,
      projectCode: proyecto.code,
      projectName: proyecto.name,
      date: new Date().toISOString().slice(0, 10),
      technicianRut: usuario.rut,
      technicianName: usuario.name,
      checklist: listaChequeo,
      photos: fotos,
      receptorName: hojaReceptor.trim() || "Supervisor de Terreno",
      syncStatus: estadoInicialSync,
      notes: hojaNotas.trim(),
    });

    // Limpia el borrador porque la hoja ya quedó emitida y persistida en la cola/listado
    establecerBorradorEnDisco(null);
    establecerNuevoHojaModal(false);
    establecerAvisoSistema(
      estadoInicialSync === "pendiente"
        ? `Hoja ${codigo} guardada en disco local (Pendiente). Subirá automáticamente al recuperar internet.`
        : `Hoja ${codigo} emitida y sincronizada correctamente con el servidor.`
    );
    setTimeout(() => establecerAvisoSistema(""), 5000);
  };

  // Métricas del dashboard de hojas de servicio
  const resumenKpi = useMemo(() => {
    const total = hojasServicio.length;
    const pendientes = hojasServicio.filter((s) => s.syncStatus === "pendiente").length;
    const sincronizadas = hojasServicio.filter((s) => s.syncStatus === "sincronizado").length;
    const totalFotos = hojasServicio.reduce((acc, s) => acc + s.photos.length, 0);
    const conflictos = hojasServicio.filter((s) => s.hasVersionConflict).length;
    return { total, pendientes, sincronizadas, totalFotos, conflictos };
  }, [hojasServicio]);

  // Hojas con conflicto de versiones
  const conflictoHojas = useMemo(
    () => hojasServicio.filter((s) => s.hasVersionConflict),
    [hojasServicio]
  );

  // Filtrado de hojas
  const hojasFiltradas = useMemo(() => {
    const q = busquedaHoja.trim().toLowerCase();
    return hojasServicio.filter((sheet) => {
      if (filtroEstado === "pendiente" && sheet.syncStatus !== "pendiente") return false;
      if (filtroEstado === "sincronizado" && sheet.syncStatus !== "sincronizado") return false;
      if (filtroEstado === "conflicto" && !sheet.hasVersionConflict) return false;
      if (q) {
        const coincideCodigo = sheet.code.toLowerCase().includes(q);
        const coincideProy =
          sheet.projectName.toLowerCase().includes(q) ||
          sheet.projectCode.toLowerCase().includes(q);
        const coincideReceptor = sheet.receptorName.toLowerCase().includes(q);
        if (!coincideCodigo && !coincideProy && !coincideReceptor) return false;
      }
      return true;
    });
  }, [hojasServicio, filtroEstado, busquedaHoja]);

  return (
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenidoScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.contenedorCentrado}>
        {/* AVISO DE SINCRONIZACIÓN / RESPALDO */}
        {Boolean(avisoSistema) && (
          <View style={estilos.avisoBanner}>
            <Ionicons name="checkmark-circle" size={18} color={tema.colors.ok} />
            <Text style={estilos.avisoBannerTexto}>{avisoSistema}</Text>
            <TouchableOpacity onPress={() => establecerAvisoSistema("")} style={{ padding: 4 }}>
              <Ionicons name="close" size={16} color={tema.colors.okDark} />
            </TouchableOpacity>
          </View>
        )}

        {/* 1. ENCABEZADO DEL DASHBOARD Y BOTÓN NUEVA HOJA */}
        <View style={estilos.encabezadoFila}>
          <View style={{ flex: 1, minWidth: 210 }}>
            <Text style={estilos.encabezadoTitulo}>Hojas de Servicio y Checklists</Text>
            <Text style={estilos.encabezadoSub}>
              Persistencia inmediata en disco local (a prueba de cierres) y subida automática al
              reconectar
            </Text>
          </View>

          <Boton
            title={borradorEnDisco ? "Continuar Borrador" : "+ Nueva Hoja"}
            variant="primary"
            size="sm"
            icon={borradorEnDisco ? "document-text-outline" : "document-attach-outline"}
            onPress={() => abrirModalNuevaHoja(Boolean(borradorEnDisco))}
            style={{ minHeight: 44 }}
          />
        </View>

        {/* 2. BANNER DE PERSISTENCIA EN DISCO Y SUBIDA AUTOMÁTICA [SCRUM] */}
        <View
          style={[
            estilos.discoBanner,
            operaSinConexion ? estilos.discoBannerOffline : estilos.discoBannerOnline,
          ]}
        >
          <View style={estilos.discoBannerTop}>
            <View style={estilos.discoBannerInfo}>
              <View
                style={[
                  estilos.discoIconoCaja,
                  operaSinConexion && { backgroundColor: "#fde68a" },
                ]}
              >
                <Ionicons
                  name={operaSinConexion ? "airplane" : "save-outline"}
                  size={18}
                  color={operaSinConexion ? tema.colors.warnDark : tema.colors.primaryDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estilos.discoTitulo}>
                  {operaSinConexion
                    ? "Sin conexión — Respaldo local activo"
                    : "Almacenamiento local respaldado y sincronización automática activa"}
                </Text>
                <Text style={estilos.discoSub}>
                  Último guardado en disco:{" "}
                  <Text style={{ fontWeight: "bold", color: "#451a03" }}>
                    {formatearMarcaDiscoHojas(ultimaMarcaDisco)}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={estilos.discoAccionesFila}>
              {cantidadPendientes > 0 && (
                <TouchableOpacity
                  onPress={() => ejecutarSubidaAutomatica(false, false)}
                  disabled={sincronizando}
                  style={estilos.botonSubirPendientes}
                  activeOpacity={0.8}
                >
                  {sincronizando ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={14} color="#ffffff" />
                  )}
                  <Text style={estilos.botonSubirPendientesTexto}>
                    Subir ({cantidadPendientes})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 3. BANNER DE BORRADOR RECUPERADO DEL DISCO LOCAL (SI SE CERRÓ LA APP A MEDIAS) */}
        {borradorEnDisco && (
          <View style={estilos.borradorBanner}>
            <View style={estilos.borradorBannerInfo}>
              <Ionicons name="shield-checkmark" size={20} color={tema.colors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.borradorTitulo}>
                  Borrador recuperado desde disco local
                </Text>
                <Text style={estilos.borradorSub}>
                  Checklist ({borradorEnDisco.checklist.filter((c) => c.completed).length}/
                  {borradorEnDisco.checklist.length} tareas) • {borradorEnDisco.fotos.length}{" "}
                  foto(s) • Guardado el {formatearMarcaDiscoHojas(borradorEnDisco.actualizadoEn)}
                </Text>
              </View>
            </View>
            <View style={estilos.borradorAcciones}>
              <Boton
                title="Descartar"
                variant="ghost"
                size="sm"
                onPress={descartarBorradorDisco}
              />
              <Boton
                title="Reanudar Checklist"
                variant="primary"
                size="sm"
                icon="open-outline"
                onPress={() => abrirModalNuevaHoja(true)}
              />
            </View>
          </View>
        )}

        {/* 4. DASHBOARD RESPONSIVO DE 4 KPIs */}
        <View style={estilos.kpiGrilla}>
          <View style={[estilos.kpiCaja, esMovilEstrecho && estilos.kpiCajaMovil]}>
            <Text style={estilos.kpiLbl}>Total Hojas</Text>
            <Text style={estilos.kpiVal}>{resumenKpi.total}</Text>
            <Text style={estilos.kpiSub}>Reportes emitidos</Text>
          </View>

          <View
            style={[
              estilos.kpiCaja,
              esMovilEstrecho && estilos.kpiCajaMovil,
              resumenKpi.pendientes > 0
                ? { backgroundColor: tema.colors.warnLight, borderColor: tema.colors.warnBorder }
                : { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text
              style={[
                estilos.kpiLbl,
                {
                  color:
                    resumenKpi.pendientes > 0 ? tema.colors.warnDark : tema.colors.okDark,
                },
              ]}
            >
              Pendientes
            </Text>
            <Text
              style={[
                estilos.kpiVal,
                {
                  color:
                    resumenKpi.pendientes > 0 ? tema.colors.warnDark : tema.colors.okDark,
                },
              ]}
            >
              {resumenKpi.pendientes}
            </Text>
            <Text
              style={[
                estilos.kpiSub,
                {
                  color:
                    resumenKpi.pendientes > 0 ? tema.colors.warnDark : tema.colors.okDark,
                },
              ]}
            >
              {resumenKpi.pendientes > 0 ? "En cola offline" : "Sin cola pendiente"}
            </Text>
          </View>

          <View
            style={[
              estilos.kpiCaja,
              esMovilEstrecho && estilos.kpiCajaMovil,
              { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text style={[estilos.kpiLbl, { color: tema.colors.okDark }]}>Sincronizadas</Text>
            <Text style={[estilos.kpiVal, { color: tema.colors.okDark }]}>
              {resumenKpi.sincronizadas}
            </Text>
            <Text style={[estilos.kpiSub, { color: tema.colors.okDark }]}>
              Respaldadas en nube
            </Text>
          </View>

          <View
            style={[
              estilos.kpiCaja,
              esMovilEstrecho && estilos.kpiCajaMovil,
              { backgroundColor: tema.colors.primaryLight, borderColor: tema.colors.primaryBorder },
            ]}
          >
            <Text style={[estilos.kpiLbl, { color: tema.colors.primaryDark }]}>
              Fotos Adjuntas
            </Text>
            <Text style={[estilos.kpiVal, { color: tema.colors.primaryDark }]}>
              {resumenKpi.totalFotos}
            </Text>
            <Text style={[estilos.kpiSub, { color: tema.colors.primaryDark }]}>
              Máx. 5 MB c/u
            </Text>
          </View>
        </View>

        {/* 5. BANNER DE CONFLICTO DE VERSIONES (SI EXISTE) */}
        {conflictoHojas.map((s) => (
          <View key={s.id} style={estilos.conflictoBanner}>
            <View style={estilos.conflictoEncabezado}>
              <Ionicons name="warning" size={22} color={tema.colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.conflictoTitulo}>
                  Conflicto de Versiones Detectado en {s.code}
                </Text>
                <Text style={estilos.conflictoSub}>
                  El servidor central recibió cambios concurrentes mientras operabas sin conexión.
                </Text>
              </View>
            </View>

            {s.conflictDetails && (
              <View style={estilos.conflictoCompareGrilla}>
                <View style={estilos.compareColumna}>
                  <Text style={estilos.compareColumnaTitulo}>Versión Servidor Central:</Text>
                  <Text style={estilos.compareColumnaAutor}>
                    Por: {s.conflictDetails.serverAuthor}
                  </Text>
                  <Text style={estilos.compareColumnaFecha}>
                    Fecha: {s.conflictDetails.serverModifiedAt}
                  </Text>
                  <Text style={estilos.compareColumnaNotas}>
                    "{s.conflictDetails.serverNotes}"
                  </Text>
                </View>

                <View style={[estilos.compareColumna, estilos.compareColumnaLocal]}>
                  <Text style={estilos.compareColumnaTitulo}>Tu Versión Local (Celular):</Text>
                  <Text style={estilos.compareColumnaAutor}>Por: {s.technicianName}</Text>
                  <Text style={estilos.compareColumnaFecha}>
                    Fecha: {s.conflictDetails.localModifiedAt}
                  </Text>
                  <Text style={estilos.compareColumnaNotas}>
                    "{s.conflictDetails.localNotes}"
                  </Text>
                </View>
              </View>
            )}

            <View
              style={[
                estilos.conflictoAccionBotones,
                esMovilEstrecho && { flexDirection: "column" },
              ]}
            >
              <Boton
                title="Aceptar Servidor"
                variant="outline"
                size="sm"
                onPress={() => resolverConflictoHojaServicio(s.id, "server")}
                style={{ flex: 1, minHeight: 42 }}
              />
              <Boton
                title="Conservar Local"
                variant="primary"
                size="sm"
                onPress={() => resolverConflictoHojaServicio(s.id, "local")}
                style={{ flex: 1, minHeight: 42 }}
              />
            </View>
          </View>
        ))}

        {/* 6. FILTROS Y BÚSQUEDA DE HOJAS DE SERVICIO */}
        <View style={estilos.filtrosBloque}>
          <Text style={estilos.seccionEncabezado}>
            Registros Emitidos en Faena ({hojasFiltradas.length})
          </Text>
          <CampoBusqueda
            value={busquedaHoja}
            onChangeText={establecerBusquedaHoja}
            placeholder="Buscar por código (HS-), proyecto o receptor..."
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(
              [
                { id: "todas", label: `Todas (${resumenKpi.total})` },
                { id: "pendiente", label: `Pendientes (${resumenKpi.pendientes})` },
                { id: "sincronizado", label: `Sincronizadas (${resumenKpi.sincronizadas})` },
                ...(resumenKpi.conflictos > 0
                  ? [
                      {
                        id: "conflicto" as FiltroEstadoHoja,
                        label: `Conflictos (${resumenKpi.conflictos})`,
                      },
                    ]
                  : []),
              ] as const
            ).map((f) => {
              const activo = filtroEstado === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => establecerFiltroEstado(f.id)}
                  style={[estilos.filtroChip, activo && estilos.filtroChipActivo]}
                >
                  <Text
                    style={[estilos.filtroChipTexto, activo && estilos.filtroChipTextoActivo]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 7. GRILLA RESPONSIVA DE HOJAS DE SERVICIO */}
        {hojasFiltradas.length === 0 ? (
          <EstadoVacio
            icon="document-text-outline"
            title="Sin hojas de servicio"
            description="No hay hojas que coincidan con el filtro seleccionado."
            actionTitle="+ Nueva Hoja"
            onAction={() => abrirModalNuevaHoja(false)}
            containerStyle={{ marginVertical: 16 }}
          />
        ) : (
          <View
            style={[estilos.hojasGrilla, esPantallaAncha && estilos.hojasGrillaAncha]}
          >
            {hojasFiltradas.map((sheet) => {
              const completadoConteo = sheet.checklist.filter((c) => c.completed).length;
              const totalConteo = sheet.checklist.length;
              const pctChecklist =
                totalConteo > 0 ? Math.round((completadoConteo / totalConteo) * 100) : 0;
              const totalMb = sheet.photos
                .reduce((acc, p) => acc + Number(p.sizeMb || 0), 0)
                .toFixed(1);
              const esSynced = sheet.syncStatus === "sincronizado";

              return (
                <Tarjeta
                  key={sheet.id}
                  variant="elevated"
                  style={[
                    estilos.hojaTarjeta,
                    esPantallaAncha && estilos.hojaTarjetaAncha,
                    !esSynced && estilos.hojaTarjetaPendiente,
                  ]}
                >
                  <View style={estilos.hojaSuperiorFila}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <View style={estilos.codigoFila}>
                        <Text style={estilos.hojaCodigo}>{sheet.code}</Text>
                        <Insignia
                          label={esSynced ? "Sincronizado" : "Pendiente"}
                          tone={esSynced ? "ok" : "warn"}
                          icon={esSynced ? "cloud-done-outline" : "cloud-upload-outline"}
                          size="sm"
                        />
                      </View>
                      <Text style={estilos.hojaProyecto}>
                        {sheet.projectCode} • {sheet.projectName}
                      </Text>
                      <Text style={estilos.hojaFecha}>
                        Ejecución: {formatearFecha(sheet.date)}
                      </Text>
                    </View>
                  </View>

                  {/* Progreso del checklist */}
                  <View style={estilos.checklistResumenCaja}>
                    <View style={estilos.hojaMetricsFila}>
                      <View style={estilos.hojaMetric}>
                        <Ionicons name="checkbox-outline" size={15} color={tema.colors.ok} />
                        <Text style={estilos.hojaMetricTexto}>
                          Checklist:{" "}
                          <Text style={{ fontWeight: "bold" }}>
                            {completadoConteo}/{totalConteo} ({pctChecklist}%)
                          </Text>
                        </Text>
                      </View>

                      <View style={estilos.hojaMetric}>
                        <Ionicons name="camera-outline" size={15} color={tema.colors.primary} />
                        <Text style={estilos.hojaMetricTexto}>
                          Fotos:{" "}
                          <Text style={{ fontWeight: "bold" }}>
                            {sheet.photos.length} ({totalMb} MB)
                          </Text>
                        </Text>
                      </View>
                    </View>
                    <BarraProgreso
                      value={completadoConteo}
                      max={totalConteo || 1}
                      height={6}
                      color={pctChecklist === 100 ? tema.colors.ok : tema.colors.primary}
                    />
                  </View>

                  {/* Miniaturas de fotos respaldadas en disco si contienen URI */}
                  {sheet.photos.some((p) => Boolean(p.uri)) && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {sheet.photos
                        .filter((p) => Boolean(p.uri))
                        .map((p) => (
                          <Image
                            key={p.id}
                            source={{ uri: p.uri }}
                            style={estilos.miniaturaFoto}
                          />
                        ))}
                    </ScrollView>
                  )}

                  {/* Receptor y observaciones */}
                  <View style={estilos.hojaPieCaja}>
                    <Text style={estilos.receptorTexto}>
                      Receptor:{" "}
                      <Text style={{ fontWeight: "600", color: tema.colors.text }}>
                        {sheet.receptorName}
                      </Text>
                    </Text>
                    {sheet.notes ? (
                      <Text style={estilos.hojaNotasTexto}>"{sheet.notes}"</Text>
                    ) : null}
                  </View>
                </Tarjeta>
              );
            })}
          </View>
        )}

        {/* 8. ALERTAS Y NOTIFICACIONES DE SOLICITUDES */}
        <View style={{ gap: 10, marginTop: 6 }}>
          <Text style={estilos.seccionEncabezado}>
            Alertas y Notificaciones de Solicitudes
          </Text>
          {solicitudesMaterial.slice(0, 4).map((req) => (
            <Tarjeta key={req.id} variant="default" style={estilos.alertaTarjeta}>
              <View style={estilos.alertaEncabezado}>
                <Text style={estilos.alertaCodigo}>{req.code}</Text>
                <Insignia
                  label={
                    req.status === "aprobada"
                      ? "Aprobada"
                      : req.status === "rechazada"
                      ? "Rechazada"
                      : req.status === "anulada"
                      ? "Anulada"
                      : req.status === "entregada"
                      ? "Entregada"
                      : "Pendiente"
                  }
                  tone={
                    req.status === "aprobada" || req.status === "entregada"
                      ? "ok"
                      : req.status === "rechazada"
                      ? "danger"
                      : req.status === "anulada"
                      ? "mute"
                      : "warn"
                  }
                  size="sm"
                />
              </View>
              <Text style={estilos.alertaProyecto}>Faena: {req.projectName}</Text>
              <Text style={estilos.alertaResumen}>
                {req.items.length} insumo(s) • Fecha: {formatearFecha(req.date)}
              </Text>
            </Tarjeta>
          ))}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* MODAL: NUEVA HOJA DE SERVICIO (AUTOGUARDADO INMEDIATO EN DISCO LOCAL)     */}
      {/* ========================================================================= */}
      <VistaModal
        visible={nuevoHojaModal}
        onClose={() => establecerNuevoHojaModal(false)}
        title="Hoja de Servicio y Checklist"
        subtitle="Autoguardado inmediato en disco local • Resiste cierres sin internet"
        maxWidth={560}
      >
        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
          <View style={estilos.autoGuardadoPill}>
            <Ionicons name="save-outline" size={14} color={tema.colors.okDark} />
            <Text style={estilos.autoGuardadoPillTexto}>
              Autoguardado en disco activo ({operaSinConexion ? "Modo Offline" : "En Línea"})
            </Text>
          </View>

          <Text style={estilos.campoEtiqueta}>1. Proyecto / Faena:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {activoProyectos.map((p) => {
              const esSeleccionado = p.id === hojaProyectoId;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => establecerHojaProyectoId(p.id)}
                  style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
                >
                  <Text
                    style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}
                  >
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 2. Checklist interactivo */}
          <Text style={estilos.campoEtiqueta}>
            2. Checklist de Inspección ({listaChequeo.filter((c) => c.completed).length}/
            {listaChequeo.length}):
          </Text>
          {listaChequeo.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => manejarAlternarListaChequeoElemento(c.id)}
              style={estilos.verificarElementoFila}
              activeOpacity={0.7}
            >
              <Ionicons
                name={c.completed ? "checkbox" : "square-outline"}
                size={22}
                color={c.completed ? tema.colors.ok : tema.colors.textMuted}
              />
              <Text
                style={[
                  estilos.verificarElementoEtiqueta,
                  c.completed && estilos.verificarElementoDone,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Agregar ítem personalizado */}
          <View style={estilos.agregarListaChequeoFila}>
            <TextInput
              value={personalizadoTareaEtiqueta}
              onChangeText={establecerPersonalizadoTareaEtiqueta}
              placeholder="Añadir tarea de inspección..."
              placeholderTextColor={tema.colors.textLight}
              style={estilos.agregarListaChequeoEntrada}
            />
            <TouchableOpacity
              onPress={manejarAgregarPersonalizadoTarea}
              style={estilos.agregarListaChequeoBoton}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* 3. Fotografías de respaldo (máx. 5 MB) */}
          <Text style={[estilos.campoEtiqueta, { marginTop: 12 }]}>
            3. Fotografías de Respaldo (Máx. 5,0 MB — guardadas en disco):
          </Text>

          <View style={estilos.fotosAccionesBarra}>
            <Boton
              title="Adjuntar Foto Real"
              variant="primary"
              size="sm"
              icon="image-outline"
              onPress={manejarAdjuntarFotoReal}
              style={{ flex: 1, minWidth: 135 }}
            />
            <Boton
              title="+ Cámara (2.2 MB)"
              variant="outline"
              size="sm"
              icon="camera-outline"
              onPress={() => manejarSimulateAgregarFoto(2.2)}
              style={{ flex: 1, minWidth: 135 }}
            />
            <Boton
              title="+ Pesada (5.8 MB)"
              variant="ghost"
              size="sm"
              icon="alert-circle-outline"
              onPress={() => manejarSimulateAgregarFoto(5.8)}
              style={{ flex: 1, minWidth: 135 }}
            />
          </View>

          {Boolean(fotoError) && (
            <View style={estilos.fotoErrorCaja}>
              <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
              <Text style={estilos.fotoErrorTexto}>{fotoError}</Text>
            </View>
          )}

          {fotos.length === 0 ? (
            <Text style={estilos.sinFotosNota}>
              Aún no hay fotografías adjuntas. Las fotos que agregues se respaldan de inmediato en
              disco local.
            </Text>
          ) : (
            fotos.map((ph) => (
              <View key={ph.id} style={estilos.fotoElementoTarjeta}>
                {ph.uri ? (
                  <Image source={{ uri: ph.uri }} style={estilos.fotoPreviewMini} />
                ) : (
                  <Ionicons name="image-outline" size={22} color={tema.colors.primary} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={estilos.fotoNombre} numberOfLines={1}>
                    {ph.name}
                  </Text>
                  <Text style={estilos.fotoTamano}>
                    {ph.sizeMb} MB / 5,0 MB máx. • {ph.timestamp}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => manejarQuitarFoto(ph.id)}
                  style={estilos.quitarFotoBoton}
                >
                  <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* 4. Receptor y observaciones */}
          <View style={{ marginTop: 10 }}>
            <CampoTexto
              label="Nombre del Receptor / Inspector en Faena"
              value={hojaReceptor}
              onChangeText={establecerHojaReceptor}
              placeholder="Nombre y cargo de quien recibe el trabajo..."
            />
          </View>

          <CampoTexto
            label="Observaciones Técnicas"
            value={hojaNotas}
            onChangeText={establecerHojaNotas}
            placeholder="Aclaraciones sobre parámetros, presiones, circuitos..."
            multiline
            numberOfLines={2}
          />

          {Boolean(formularioError) && (
            <Text style={estilos.errorTexto}>{formularioError}</Text>
          )}

          <View style={estilos.modalBotonesFila}>
            <Boton
              title="Guardar Borrador"
              variant="outline"
              onPress={() => {
                establecerNuevoHojaModal(false);
                establecerAvisoSistema(
                  "Borrador guardado en disco local. Puedes cerrar la app y reanudar después."
                );
                setTimeout(() => establecerAvisoSistema(""), 4000);
              }}
              style={{ flex: 1, minWidth: 130, minHeight: 44 }}
            />
            <Boton
              title={operaSinConexion ? "Emitir (Guardar Offline)" : "Emitir Hoja"}
              variant="primary"
              icon={operaSinConexion ? "cloud-upload-outline" : "checkmark-circle-outline"}
              onPress={manejarGuardarHoja}
              style={{ flex: 1.4, minWidth: 150, minHeight: 44 }}
            />
          </View>
        </ScrollView>
      </VistaModal>
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenidoScroll: {
    padding: tema.spacing.md,
    paddingBottom: 44,
  },
  contenedorCentrado: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: 14,
  },
  avisoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  avisoBannerTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
    lineHeight: 17,
  },
  encabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  encabezadoTitulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  encabezadoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  discoBanner: {
    borderRadius: tema.radius.md,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  discoBannerOnline: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  discoBannerOffline: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  discoBannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  discoBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 220,
  },
  discoIconoCaja: {
    width: 36,
    height: 36,
    borderRadius: tema.radius.full,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  discoTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: "#78350f",
  },
  discoSub: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 2,
  },
  discoAccionesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  botonSubirPendientes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: tema.radius.full,
  },
  botonSubirPendientesTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  botonScrumAvion: {
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
  botonScrumAvionActivo: {
    backgroundColor: "#d97706",
    borderColor: "#b45309",
  },
  botonScrumAvionTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
  },
  botonScrumAvionTextoActivo: {
    color: "#ffffff",
  },
  scrumNota: {
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
  },
  borradorBanner: {
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: tema.colors.primary,
    borderRadius: tema.radius.md,
    padding: 12,
    gap: 10,
  },
  borradorBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  borradorTitulo: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  borradorSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  borradorAcciones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
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
  conflictoBanner: {
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: tema.colors.danger,
    gap: 10,
  },
  conflictoEncabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  conflictoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.danger,
  },
  conflictoSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  conflictoCompareGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compareColumna: {
    flex: 1,
    minWidth: 190,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  compareColumnaLocal: {
    borderColor: tema.colors.primary,
    backgroundColor: "#fffbeb",
  },
  compareColumnaTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  compareColumnaAutor: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  compareColumnaFecha: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  compareColumnaNotas: {
    fontSize: 11,
    fontStyle: "italic",
    color: tema.colors.text,
    marginTop: 4,
  },
  conflictoAccionBotones: {
    flexDirection: "row",
    gap: 8,
  },
  filtrosBloque: {
    gap: 10,
  },
  seccionEncabezado: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
  },
  filtroChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  filtroChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  hojasGrilla: {
    gap: 10,
  },
  hojasGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  hojaTarjeta: {
    padding: 14,
    gap: 10,
  },
  hojaTarjetaAncha: {
    width: "48.8%",
  },
  hojaTarjetaPendiente: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.warn,
  },
  hojaSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  hojaCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  hojaProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  hojaFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  checklistResumenCaja: {
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: 10,
    gap: 8,
  },
  hojaMetricsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  hojaMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hojaMetricTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
  },
  miniaturaFoto: {
    width: 56,
    height: 56,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  hojaPieCaja: {
    gap: 3,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  receptorTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
  },
  hojaNotasTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontStyle: "italic",
  },
  alertaTarjeta: {
    padding: 12,
    gap: 4,
  },
  alertaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  alertaCodigo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  alertaProyecto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
  },
  alertaResumen: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  autoGuardadoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.okLight,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  autoGuardadoPillTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  campoEtiqueta: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 6,
  },
  chipBoton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  chipBotonActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  chipTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  chipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  verificarElementoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  verificarElementoEtiqueta: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.text,
    lineHeight: 17,
  },
  verificarElementoDone: {
    color: tema.colors.textMuted,
    textDecorationLine: "line-through",
  },
  agregarListaChequeoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  agregarListaChequeoEntrada: {
    flex: 1,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: tema.colors.text,
    backgroundColor: tema.colors.surface,
  },
  agregarListaChequeoBoton: {
    width: 38,
    height: 38,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fotosAccionesBarra: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  fotoErrorCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.sm,
    padding: 8,
    marginBottom: 8,
  },
  fotoErrorTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.danger,
    fontWeight: "600",
  },
  sinFotosNota: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  fotoElementoTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginBottom: 6,
  },
  fotoPreviewMini: {
    width: 40,
    height: 40,
    borderRadius: tema.radius.sm,
  },
  fotoNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  fotoTamano: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  quitarFotoBoton: {
    padding: 6,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "600",
    marginTop: 4,
  },
  modalBotonesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
});
