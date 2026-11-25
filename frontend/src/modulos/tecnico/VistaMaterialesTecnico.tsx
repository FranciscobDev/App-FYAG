// Vista móvil "Insumos de mis Proyectos" con almacenamiento offline,
// fecha/hora real de última sincronización, dashboard responsivo y control de material pendiente por retirar.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { ItemSolicitudMaterial, Producto } from "@/nucleo/tipos";
import {
  SnapshotInsumosProyecto,
  construirSnapshotsInsumosTecnico,
  formatearMarcaSincronizacion,
  guardarInsumosProyectosCacheLocal,
  leerInsumosProyectosCacheLocal,
  sincronizarInsumosProyectosConCache,
} from "./insumosProyectosOffline";

interface PropiedadesVistaMaterialesTecnico {
  initialProjectId?: string;
  onNavigateTab?: (tab: string, subTab?: "avance" | "horas" | "sobrante") => void;
  isOffline?: boolean;
  onCambioConexion?: (sinConexion: boolean) => void;
}

interface ItemSolicitudLocal {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  stockBodega: number;
}

type FiltroEstadoInsumo = "todos" | "pendientes" | "completados";

export const VistaMaterialesTecnico: React.FC<PropiedadesVistaMaterialesTecnico> = ({
  initialProjectId,
  onNavigateTab,
  isOffline = false,
  onCambioConexion,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const {
    proyectos,
    productos,
    solicitudesMaterial,
    crearSolicitudMaterial,
    confirmarRetiroSolicitudTecnico,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const identificadorUsuario = useMemo(() => {
    const idNumerico = (usuario as unknown as { id_usuario?: number })?.id_usuario;
    return idNumerico ? String(idNumerico) : usuario.rut || usuario.email || "tecnico";
  }, [usuario]);

  // Estado offline y de sincronización
  const [snapshotsProyectos, establecerSnapshotsProyectos] = useState<SnapshotInsumosProyecto[]>(
    []
  );
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || ""
  );
  const [guardadoEn, establecerGuardadoEn] = useState<string | null>(null);
  const [origenDatos, establecerOrigenDatos] = useState<"red" | "cache">("cache");
  const [sinConexionDetectada, establecerSinConexionDetectada] = useState<boolean>(isOffline);
  const [modoOfflineScrum, establecerModoOfflineScrum] = useState<boolean>(false);
  const [cargandoInicial, establecerCargandoInicial] = useState<boolean>(true);
  const [sincronizando, establecerSincronizando] = useState<boolean>(false);

  // Filtros responsivos del listado de insumos
  const [busquedaInsumo, establecerBusquedaInsumo] = useState<string>("");
  const [filtroEstadoInsumo, establecerFiltroEstadoInsumo] =
    useState<FiltroEstadoInsumo>("todos");

  // Estados para Modal de Solicitud de Materiales
  const [modalSolicitudVisible, establecerModalSolicitudVisible] = useState(false);
  const [solicitudUrgencia, establecerSolicitudUrgencia] = useState<
    "normal" | "alta" | "urgente"
  >("normal");
  const [solicitudComentario, establecerSolicitudComentario] = useState("");
  const [solicitudItems, establecerSolicitudItems] = useState<ItemSolicitudLocal[]>([]);
  const [solicitudError, establecerSolicitudError] = useState("");
  const [enviandoSolicitud, establecerEnviandoSolicitud] = useState(false);
  const [confirmandoRetiroId, establecerConfirmandoRetiroId] = useState<string | null>(null);
  const [notificacionExito, establecerNotificacionExito] = useState("");
  const [avisoOfflineAccion, establecerAvisoOfflineAccion] = useState("");
  const [busquedaCatalogo, establecerBusquedaCatalogo] = useState("");
  const [mostrarCatalogoDesplegable, establecerMostrarCatalogoDesplegable] = useState(false);

  const operaSinConexion = isOffline || modoOfflineScrum || sinConexionDetectada;

  // Sincronización inicial instantánea desde caché local + actualización desde servidor si hay red
  const ejecutarSincronizacion = useCallback(
    async (forzarOffline?: boolean) => {
      const usarOffline = forzarOffline ?? (isOffline || modoOfflineScrum);
      establecerSincronizando(true);

      const cachePrevia = await leerInsumosProyectosCacheLocal(identificadorUsuario);
      if (cachePrevia && cachePrevia.proyectos.length > 0) {
        establecerSnapshotsProyectos(cachePrevia.proyectos);
        establecerGuardadoEn(cachePrevia.guardadoEn);
        establecerCargandoInicial(false);
      }

      const resultado = await sincronizarInsumosProyectosConCache({
        identificadorUsuario,
        rutTecnico: usuario.rut,
        proyectosContexto: proyectos,
        productosContexto: productos,
        solicitudesContexto: solicitudesMaterial,
        forzarSinConexion: usarOffline,
      });

      establecerSnapshotsProyectos(resultado.proyectos);
      establecerOrigenDatos(resultado.origen);
      establecerGuardadoEn(resultado.guardadoEn);
      establecerSinConexionDetectada(resultado.sinConexion);
      establecerCargandoInicial(false);
      establecerSincronizando(false);

      if (onCambioConexion) {
        onCambioConexion(resultado.sinConexion);
      }
    },
    [
      identificadorUsuario,
      isOffline,
      modoOfflineScrum,
      onCambioConexion,
      productos,
      proyectos,
      solicitudesMaterial,
      usuario.rut,
    ]
  );

  useEffect(() => {
    ejecutarSincronizacion();
  }, [ejecutarSincronizacion]);

  // Escucha real de desconexión/reconexión del navegador o dispositivo WebView
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const alPerderRed = () => {
      establecerSinConexionDetectada(true);
      establecerOrigenDatos("cache");
      if (onCambioConexion) onCambioConexion(true);
    };

    const alRecuperarRed = () => {
      establecerSinConexionDetectada(false);
      if (!modoOfflineScrum && !isOffline) {
        void ejecutarSincronizacion(false);
      }
    };

    window.addEventListener("offline", alPerderRed);
    window.addEventListener("online", alRecuperarRed);
    return () => {
      window.removeEventListener("offline", alPerderRed);
      window.removeEventListener("online", alRecuperarRed);
    };
  }, [ejecutarSincronizacion, isOffline, modoOfflineScrum, onCambioConexion]);

  useEffect(() => {
    if (initialProjectId) {
      establecerSeleccionadoProyectoId(initialProjectId);
    }
  }, [initialProjectId]);

  const snapshotActual = useMemo(() => {
    if (snapshotsProyectos.length === 0) return null;
    return (
      snapshotsProyectos.find((s) => s.proyecto.id === seleccionadoProyectoId) ||
      snapshotsProyectos[0]
    );
  }, [snapshotsProyectos, seleccionadoProyectoId]);

  const actualProyecto = snapshotActual?.proyecto || null;
  const asignadoElementos = snapshotActual?.insumos || [];
  const solicitudesProyecto = snapshotActual?.solicitudes || [];

  const totalAsignado = snapshotActual?.totalAsignado || 0;
  const totalRetirado = snapshotActual?.totalRetirado || 0;
  const totalPendiente = snapshotActual?.totalPendiente || 0;
  const porcentajeAbastecimiento = snapshotActual?.porcentajeAbastecimiento || 0;

  const totalPendienteGlobal = useMemo(
    () =>
      Number(
        snapshotsProyectos.reduce((acc, s) => acc + s.totalPendiente, 0).toFixed(3)
      ),
    [snapshotsProyectos]
  );

  const insumosFiltrados = useMemo(() => {
    const q = busquedaInsumo.trim().toLowerCase();
    return asignadoElementos.filter((item) => {
      if (filtroEstadoInsumo === "pendientes" && item.quantityPending <= 0) return false;
      if (filtroEstadoInsumo === "completados" && item.quantityPending > 0) return false;
      if (q) {
        const coincideNombre = item.name.toLowerCase().includes(q);
        const coincideSku = item.sku.toLowerCase().includes(q);
        if (!coincideNombre && !coincideSku) return false;
      }
      return true;
    });
  }, [asignadoElementos, busquedaInsumo, filtroEstadoInsumo]);

  const conteosInsumos = useMemo(() => {
    const pendientes = asignadoElementos.filter((i) => i.quantityPending > 0).length;
    const completados = asignadoElementos.filter((i) => i.quantityPending <= 0).length;
    return {
      todos: asignadoElementos.length,
      pendientes,
      completados,
    };
  }, [asignadoElementos]);

  const alternarModoOfflineScrum = async () => {
    const siguiente = !modoOfflineScrum;
    establecerModoOfflineScrum(siguiente);
    establecerAvisoOfflineAccion("");
    await ejecutarSincronizacion(siguiente || isOffline);
  };

  // Confirmar retiro de una solicitud aprobada y sumar automáticamente al proyecto
  const manejarConfirmarRetiro = async (requestId: string, requestCode: string) => {
    establecerConfirmandoRetiroId(requestId);
    establecerAvisoOfflineAccion("");

    const res = confirmarRetiroSolicitudTecnico(
      requestId,
      usuario.rut,
      usuario.name || "Técnico de Terreno"
    );

    if (!res.success) {
      establecerAvisoOfflineAccion(res.error || "No se pudo confirmar el retiro.");
      establecerConfirmandoRetiroId(null);
      return;
    }

    const resumenItems = (res.itemsConfirmados || [])
      .map((it) => `${it.quantity} ${it.unit} de ${it.name}`)
      .join(", ");

    establecerNotificacionExito(
      `Retiro confirmado para ${requestCode}. Se incorporaron automáticamente: ${resumenItems}.`
    );

    // Actualizar snapshot en pantalla y caché offline al instante
    const actualizados = construirSnapshotsInsumosTecnico(
      proyectos,
      usuario.rut,
      productos,
      solicitudesMaterial
    );
    establecerSnapshotsProyectos(actualizados);
    const nuevaMarca = await guardarInsumosProyectosCacheLocal(
      identificadorUsuario,
      actualizados
    );
    establecerGuardadoEn(nuevaMarca);
    establecerConfirmandoRetiroId(null);
  };

  // Manejo de Modal de Solicitud de Materiales
  const abrirModalSolicitud = () => {
    if (operaSinConexion) {
      establecerAvisoOfflineAccion(
        "Estás sin conexión: puedes consultar todos los saldos y pendientes por retirar desde la caché local. Conéctate a internet para enviar nuevas solicitudes a bodega."
      );
      return;
    }

    establecerAvisoOfflineAccion("");
    establecerSolicitudError("");
    establecerSolicitudUrgencia("normal");
    establecerSolicitudComentario("");
    establecerBusquedaCatalogo("");
    establecerMostrarCatalogoDesplegable(false);

    const prodDisponible = productos.find((p) => !p.disabled && p.stock > 0) || productos[0];
    if (prodDisponible) {
      establecerSolicitudItems([
        {
          sku: prodDisponible.sku,
          name: prodDisponible.name,
          quantity: 1,
          unit: prodDisponible.unit,
          stockBodega: prodDisponible.stock,
        },
      ]);
    } else {
      establecerSolicitudItems([]);
    }

    establecerModalSolicitudVisible(true);
  };

  const manejarCambiarCantidad = (sku: string, delta: number) => {
    establecerSolicitudItems((prev) =>
      prev.map((item) =>
        item.sku === sku ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const manejarEstablecerCantidad = (sku: string, val: string) => {
    const num = parseInt(val, 10);
    establecerSolicitudItems((prev) =>
      prev.map((item) =>
        item.sku === sku ? { ...item, quantity: isNaN(num) || num < 1 ? 1 : num } : item
      )
    );
  };

  const manejarEliminarItem = (sku: string) => {
    establecerSolicitudItems((prev) => prev.filter((i) => i.sku !== sku));
  };

  const manejarAgregarProducto = (prod: Producto) => {
    if (solicitudItems.some((i) => i.sku === prod.sku)) return;
    establecerSolicitudItems((prev) => [
      ...prev,
      {
        sku: prod.sku,
        name: prod.name,
        quantity: 1,
        unit: prod.unit,
        stockBodega: prod.stock,
      },
    ]);
    establecerBusquedaCatalogo("");
    establecerMostrarCatalogoDesplegable(false);
  };

  const productosFiltradosParaAgregar = useMemo(() => {
    const q = busquedaCatalogo.toLowerCase().trim();
    return productos
      .filter((p) => !p.disabled && !solicitudItems.some((i) => i.sku === p.sku))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [productos, solicitudItems, busquedaCatalogo]);

  const manejarEnviarSolicitud = async () => {
    if (!actualProyecto) {
      establecerSolicitudError("Debe seleccionar un proyecto válido.");
      return;
    }
    if (solicitudItems.length === 0) {
      establecerSolicitudError("Debe agregar al menos un insumo a la solicitud.");
      return;
    }

    const itemsFaltantes = solicitudItems.filter((i) => i.quantity > i.stockBodega);
    if (itemsFaltantes.length > 0) {
      establecerSolicitudError(
        `Stock insuficiente en bodega para: ${itemsFaltantes
          .map((i) => `${i.name} (quedan ${i.stockBodega} ${i.unit})`)
          .join(", ")}`
      );
      return;
    }

    establecerEnviandoSolicitud(true);
    establecerSolicitudError("");

    const itemsHastaEnviar: ItemSolicitudMaterial[] = solicitudItems.map((it) => ({
      sku: it.sku,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
    }));

    const res = await crearSolicitudMaterial(
      actualProyecto.id,
      usuario.rut,
      itemsHastaEnviar,
      solicitudUrgencia,
      solicitudComentario.trim() || undefined,
      { name: usuario.name, role: usuario.role }
    );

    establecerEnviandoSolicitud(false);

    if (!res.success) {
      establecerSolicitudError(res.error || "No se pudo procesar la solicitud.");
    } else {
      establecerModalSolicitudVisible(false);
      establecerNotificacionExito(
        `Solicitud enviada para ${actualProyecto.code}. Los saldos pendientes y la caché offline fueron actualizados.`
      );
      establecerSolicitudItems([]);
      establecerSolicitudComentario("");
      establecerSolicitudUrgencia("normal");
      establecerBusquedaCatalogo("");

      const actualizados = construirSnapshotsInsumosTecnico(
        proyectos,
        usuario.rut,
        productos,
        solicitudesMaterial
      );
      const nuevaMarca = await guardarInsumosProyectosCacheLocal(
        identificadorUsuario,
        actualizados
      );
      establecerGuardadoEn(nuevaMarca);
    }
  };

  return (
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenidoScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.contenedorCentrado}>
        {/* ALERTAS DE ÉXITO O AVISO OFFLINE */}
        {Boolean(notificacionExito) && (
          <View style={estilos.alertaExito}>
            <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} />
            <Text style={estilos.alertaExitoTexto}>{notificacionExito}</Text>
            <TouchableOpacity onPress={() => establecerNotificacionExito("")} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color={tema.colors.ok} />
            </TouchableOpacity>
          </View>
        )}

        {Boolean(avisoOfflineAccion) && (
          <View style={estilos.alertaOffline}>
            <Ionicons name="cloud-offline-outline" size={20} color={tema.colors.warnDark} />
            <Text style={estilos.alertaOfflineTexto}>{avisoOfflineAccion}</Text>
            <TouchableOpacity onPress={() => establecerAvisoOfflineAccion("")} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color={tema.colors.warnDark} />
            </TouchableOpacity>
          </View>
        )}

        {/* 1. ENCABEZADO DEL DASHBOARD Y ESTADO DE SINCRONIZACIÓN OFFLINE */}
        <View style={estilos.encabezadoDashboard}>
          <View style={{ flex: 1, minWidth: 210 }}>
            <Text style={estilos.tituloPrincipal}>Insumos de mis Proyectos</Text>
            <Text style={estilos.subtituloPrincipal}>
              Control de materiales asignados, retirados y pendientes por retirar de bodega
            </Text>
          </View>

          <View style={estilos.badgesEstadoFila}>
            {operaSinConexion ? (
              <View style={estilos.chipOffline}>
                <Ionicons name="cloud-offline" size={14} color={tema.colors.warnDark} />
                <Text style={estilos.chipOfflineTexto}>Sin Internet (Offline)</Text>
              </View>
            ) : (
              <View style={estilos.chipOnline}>
                <Ionicons name="cloud-done" size={14} color="#22c55e" />
                <Text style={estilos.chipOnlineTexto}>En Línea</Text>
              </View>
            )}

            <View style={estilos.chipPendienteGlobal}>
              <Ionicons name="cube-outline" size={13} color={tema.colors.primaryDark} />
              <Text style={estilos.chipPendienteGlobalTexto}>
                {totalPendienteGlobal > 0
                  ? `${totalPendienteGlobal} un. por retirar`
                  : "Todo retirado"}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. TARJETA DE ÚLTIMA SINCRONIZACIÓN + MODO OFFLINE [SCRUM] */}
        <View
          style={[
            estilos.sincronizacionBanner,
            operaSinConexion
              ? estilos.sincronizacionBannerOffline
              : estilos.sincronizacionBannerOnline,
          ]}
        >
          <View style={estilos.sincronizacionFilaSuperior}>
            <View style={estilos.sincronizacionInfo}>
              <View
                style={[
                  estilos.sincronizacionIconoCirculo,
                  operaSinConexion && { backgroundColor: "#fde68a" },
                ]}
              >
                <Ionicons
                  name={operaSinConexion ? "phone-portrait-outline" : "sync-outline"}
                  size={18}
                  color={operaSinConexion ? tema.colors.warnDark : tema.colors.primaryDark}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estilos.sincronizacionTitulo}>
                  {operaSinConexion
                    ? "Consulta Offline Activa — Datos desde caché local"
                    : "Almacenamiento Offline Sincronizado"}
                </Text>
                <Text style={estilos.sincronizacionMarca}>
                  Última sincronización:{" "}
                  <Text style={estilos.sincronizacionFechaNegrita}>
                    {formatearMarcaSincronizacion(guardadoEn)}
                  </Text>
                </Text>
                <Text style={estilos.sincronizacionOrigen}>
                  {origenDatos === "cache"
                    ? "Mostrando respaldo local guardado en el dispositivo"
                    : "Actualizado con el servidor y respaldado para uso sin internet"}
                </Text>
              </View>
            </View>

            <View style={estilos.sincronizacionAcciones}>
              <TouchableOpacity
                onPress={() => ejecutarSincronizacion()}
                disabled={sincronizando}
                style={estilos.botonSincronizar}
                activeOpacity={0.8}
              >
                {sincronizando ? (
                  <ActivityIndicator size="small" color={tema.colors.primaryDark} />
                ) : (
                  <Ionicons name="refresh" size={15} color={tema.colors.primaryDark} />
                )}
                <Text style={estilos.botonSincronizarTexto}>
                  {sincronizando ? "Sincronizando..." : "Sincronizar"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={alternarModoOfflineScrum}
                style={[
                  estilos.botonModoOffline,
                  modoOfflineScrum && estilos.botonModoOfflineActivo,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={modoOfflineScrum ? "wifi-outline" : "airplane-outline"}
                  size={15}
                  color={modoOfflineScrum ? "#ffffff" : "#92400e"}
                />
                <Text
                  style={[
                    estilos.botonModoOfflineTexto,
                    modoOfflineScrum && estilos.botonModoOfflineTextoActivo,
                  ]}
                >
                  {modoOfflineScrum ? "Salir Offline" : "Probar Offline"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={estilos.scrumGuiaTexto}>
            [SCRUM] Desconecta el internet del celular (o usa "Probar Offline") para verificar los
            saldos asignados y cuánto material falta retirar de bodega sin perder información.
          </Text>
        </View>

        {/* 3. SELECTOR RESPONSIVO DE PROYECTOS ASIGNADOS */}
        <View style={estilos.bloqueSeccion}>
          <Text style={estilos.seccionEtiqueta}>
            Faenas Asignadas ({snapshotsProyectos.length}):
          </Text>
          {cargandoInicial ? (
            <View style={estilos.cargandoCaja}>
              <ActivityIndicator size="large" color={tema.colors.primary} />
              <Text style={estilos.cargandoTexto}>Cargando insumos desde almacenamiento local...</Text>
            </View>
          ) : snapshotsProyectos.length === 0 ? (
            <EstadoVacio
              icon="folder-open-outline"
              title="Sin proyectos activos asignados"
              description="Cuando se te asigne una obra o mantención, sus materiales aparecerán aquí y quedarán respaldados offline."
              containerStyle={{ marginVertical: 16 }}
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={estilos.proyectosScrollContenido}
              >
                {snapshotsProyectos.map((snap) => {
                  const p = snap.proyecto;
                  const esSeleccionado = p.id === actualProyecto?.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => establecerSeleccionadoProyectoId(p.id)}
                      style={[
                        estilos.proyectoChip,
                        esSeleccionado && estilos.proyectoChipActivo,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color={esSeleccionado ? "#f59e0b" : tema.colors.textMuted}
                      />
                      <Text
                        style={[
                          estilos.proyectoChipTexto,
                          esSeleccionado && estilos.proyectoChipTextoActivo,
                        ]}
                        numberOfLines={1}
                      >
                        {p.code} • {p.name}
                      </Text>
                      <View
                        style={[
                          estilos.proyectoChipContador,
                          snap.totalPendiente > 0
                            ? estilos.proyectoChipContadorPendiente
                            : estilos.proyectoChipContadorOk,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.proyectoChipContadorTexto,
                            snap.totalPendiente > 0
                              ? { color: "#92400e" }
                              : { color: "#15803d" },
                          ]}
                        >
                          {snap.totalPendiente > 0
                            ? `${snap.totalPendiente} pend.`
                            : "Al día"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 4. DASHBOARD DE MÉTRICAS DEL PROYECTO SELECCIONADO */}
              {actualProyecto && (
                <Tarjeta variant="elevated" style={estilos.dashboardTarjeta}>
                  <View style={estilos.dashboardCabecera}>
                    <View style={{ flex: 1, minWidth: 190 }}>
                      <View style={estilos.dashboardCodigoFila}>
                        <Text style={estilos.dashboardCodigo}>{actualProyecto.code}</Text>
                        <Insignia
                          label={actualProyecto.kind.toUpperCase()}
                          tone={actualProyecto.kind === "obra" ? "info" : "warn"}
                          size="sm"
                        />
                      </View>
                      <Text style={estilos.proyectoNombre}>{actualProyecto.name}</Text>
                      <Text style={estilos.proyectoCliente}>
                        Cliente: {actualProyecto.client}
                        {actualProyecto.address ? ` • ${actualProyecto.address}` : ""}
                      </Text>
                    </View>

                    <View
                      style={[
                        estilos.resumenRetiroPill,
                        totalPendiente > 0
                          ? estilos.resumenRetiroPillPendiente
                          : estilos.resumenRetiroPillOk,
                      ]}
                    >
                      <Ionicons
                        name={totalPendiente > 0 ? "time-outline" : "checkmark-circle"}
                        size={16}
                        color={totalPendiente > 0 ? tema.colors.warnDark : tema.colors.ok}
                      />
                      <Text
                        style={[
                          estilos.resumenRetiroPillTexto,
                          { color: totalPendiente > 0 ? tema.colors.warnDark : tema.colors.ok },
                        ]}
                      >
                        {totalPendiente > 0
                          ? `Faltan ${totalPendiente} un. por retirar`
                          : "Sin retiros pendientes"}
                      </Text>
                    </View>
                  </View>

                  <View style={estilos.kpiGrilla}>
                    <View
                      style={[
                        estilos.kpiCaja,
                        esMovilEstrecho && estilos.kpiCajaMovil,
                      ]}
                    >
                      <Text style={estilos.kpiEtiqueta}>Total Asignado</Text>
                      <Text style={estilos.kpiValor}>{totalAsignado}</Text>
                      <Text style={estilos.kpiSub}>Unidades en faena</Text>
                    </View>

                    <View
                      style={[
                        estilos.kpiCaja,
                        esMovilEstrecho && estilos.kpiCajaMovil,
                        { backgroundColor: tema.colors.primaryLight, borderColor: "#fde68a" },
                      ]}
                    >
                      <Text style={[estilos.kpiEtiqueta, { color: tema.colors.primaryDark }]}>
                        Retirado Bodega
                      </Text>
                      <Text style={[estilos.kpiValor, { color: tema.colors.primaryDark }]}>
                        {totalRetirado}
                      </Text>
                      <Text style={[estilos.kpiSub, { color: tema.colors.primaryDark }]}>
                        Ya despachado
                      </Text>
                    </View>

                    <View
                      style={[
                        estilos.kpiCaja,
                        esMovilEstrecho && estilos.kpiCajaMovil,
                        totalPendiente > 0
                          ? { backgroundColor: tema.colors.warnLight, borderColor: tema.colors.warnBorder }
                          : { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
                      ]}
                    >
                      <Text
                        style={[
                          estilos.kpiEtiqueta,
                          { color: totalPendiente > 0 ? tema.colors.warnDark : tema.colors.okDark },
                        ]}
                      >
                        Falta Retirar
                      </Text>
                      <Text
                        style={[
                          estilos.kpiValor,
                          { color: totalPendiente > 0 ? tema.colors.warnDark : tema.colors.okDark },
                        ]}
                      >
                        {totalPendiente}
                      </Text>
                      <Text
                        style={[
                          estilos.kpiSub,
                          { color: totalPendiente > 0 ? tema.colors.warnDark : tema.colors.okDark },
                        ]}
                      >
                        {totalPendiente > 0 ? "Disponible en bodega" : "Abastecimiento 100%"}
                      </Text>
                    </View>

                    <View
                      style={[
                        estilos.kpiCaja,
                        esMovilEstrecho && estilos.kpiCajaMovil,
                      ]}
                    >
                      <Text style={estilos.kpiEtiqueta}>Abastecimiento</Text>
                      <Text style={[estilos.kpiValor, { color: tema.colors.ok }]}>
                        {porcentajeAbastecimiento}%
                      </Text>
                      <Text style={estilos.kpiSub}>
                        {conteosInsumos.completados}/{conteosInsumos.todos} ítems listos
                      </Text>
                    </View>
                  </View>

                  <View style={estilos.supplyProgresoCaja}>
                    <View style={estilos.supplyEncabezado}>
                      <Text style={estilos.supplyEtiqueta}>Progreso de retiro en bodega</Text>
                      <Text style={estilos.supplyPorcentaje}>
                        {porcentajeAbastecimiento}% retirado
                      </Text>
                    </View>
                    <BarraProgreso
                      value={totalRetirado}
                      max={totalAsignado || 1}
                      height={8}
                      color={totalPendiente === 0 ? tema.colors.ok : tema.colors.primary}
                    />
                  </View>
                </Tarjeta>
              )}

              {/* 5. BARRA DE BÚSQUEDA Y FILTRO DE INSUMOS */}
              <View style={estilos.filtrosInsumosCaja}>
                <View style={estilos.seccionTituloConInsignia}>
                  <Text style={estilos.listaEncabezado}>
                    Detalle de Materiales (Cuánto Falta Retirar de Bodega)
                  </Text>
                  <Insignia
                    label={`${insumosFiltrados.length} ${insumosFiltrados.length === 1 ? "ítem" : "ítems"}`}
                    tone="info"
                    size="sm"
                  />
                </View>

                <CampoBusqueda
                  value={busquedaInsumo}
                  onChangeText={establecerBusquedaInsumo}
                  placeholder="Buscar material por nombre o SKU..."
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(
                    [
                      { id: "todos", label: `Todos (${conteosInsumos.todos})` },
                      { id: "pendientes", label: `Falta retirar (${conteosInsumos.pendientes})` },
                      { id: "completados", label: `Completados (${conteosInsumos.completados})` },
                    ] as const
                  ).map((chip) => {
                    const activo = filtroEstadoInsumo === chip.id;
                    return (
                      <TouchableOpacity
                        key={chip.id}
                        onPress={() => establecerFiltroEstadoInsumo(chip.id)}
                        style={[estilos.filtroChip, activo && estilos.filtroChipActivo]}
                      >
                        <Text
                          style={[
                            estilos.filtroChipTexto,
                            activo && estilos.filtroChipTextoActivo,
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 6. LISTADO RESPONSIVO DE INSUMOS */}
              {insumosFiltrados.length === 0 ? (
                <EstadoVacio
                  icon="cube-outline"
                  title={
                    asignadoElementos.length === 0
                      ? "Sin insumos asignados en esta faena"
                      : "Sin coincidencias en el filtro"
                  }
                  description={
                    asignadoElementos.length === 0
                      ? "Este proyecto todavía no registra materiales asignados ni retiros pendientes en bodega."
                      : "Prueba limpiar la búsqueda o cambiar el filtro de estado."
                  }
                  actionTitle={
                    asignadoElementos.length === 0 && !operaSinConexion
                      ? "Solicitar Insumos a Bodega"
                      : undefined
                  }
                  onAction={
                    asignadoElementos.length === 0 && !operaSinConexion
                      ? abrirModalSolicitud
                      : undefined
                  }
                  containerStyle={{ marginVertical: 14 }}
                />
              ) : (
                <View
                  style={[
                    estilos.insumosGrilla,
                    esPantallaAncha && estilos.insumosGrillaAncha,
                  ]}
                >
                  {insumosFiltrados.map((item) => {
                    const tienePendiente = item.quantityPending > 0;
                    return (
                      <Tarjeta
                        key={item.sku}
                        variant="default"
                        style={[
                          estilos.elementoTarjeta,
                          esPantallaAncha && estilos.elementoTarjetaAncha,
                          tienePendiente && estilos.elementoTarjetaPendiente,
                        ]}
                      >
                        <View style={estilos.elementoSuperiorFila}>
                          <View style={{ flex: 1, minWidth: 140 }}>
                            <Text style={estilos.elementoNombre}>{item.name}</Text>
                            <Text style={estilos.elementoSku}>
                              SKU: {item.sku} • Unidad: {item.unit}
                            </Text>
                          </View>
                          <Insignia
                            label={
                              tienePendiente
                                ? `Faltan ${item.quantityPending} ${item.unit}`
                                : "Retiro completo"
                            }
                            tone={tienePendiente ? "warn" : "ok"}
                            size="sm"
                          />
                        </View>

                        <View style={estilos.elementoMetricsFila}>
                          <View style={estilos.elementoColumna}>
                            <Text style={estilos.elementoColumnaLbl}>Asignado</Text>
                            <Text style={estilos.elementoColumnaValor}>
                              {item.quantityAssigned} {item.unit}
                            </Text>
                          </View>

                          <View style={estilos.elementoDivisor} />

                          <View style={estilos.elementoColumna}>
                            <Text style={estilos.elementoColumnaLbl}>Retirado</Text>
                            <Text
                              style={[
                                estilos.elementoColumnaValor,
                                { color: tema.colors.primaryDark },
                              ]}
                            >
                              {item.quantityRetrieved} {item.unit}
                            </Text>
                          </View>

                          <View style={estilos.elementoDivisor} />

                          <View style={estilos.elementoColumna}>
                            <Text style={estilos.elementoColumnaLbl}>Falta retirar</Text>
                            <Text
                              style={[
                                estilos.elementoColumnaValor,
                                tienePendiente
                                  ? { color: tema.colors.warnDark }
                                  : { color: tema.colors.ok },
                              ]}
                            >
                              {item.quantityPending} {item.unit}
                            </Text>
                          </View>
                        </View>

                        <View style={estilos.barraIndividualCaja}>
                          <BarraProgreso
                            value={item.quantityRetrieved}
                            max={item.quantityAssigned || 1}
                            height={6}
                            color={tienePendiente ? tema.colors.primary : tema.colors.ok}
                          />
                          <Text style={estilos.barraIndividualPorcentaje}>
                            {item.fulfillmentPct}% retirado
                          </Text>
                        </View>
                      </Tarjeta>
                    );
                  })}
                </View>
              )}

              {/* 7. HISTORIAL DE SOLICITUDES A BODEGA CON CONFIRMACIÓN DE RETIRO */}
              <View style={estilos.bloqueSolicitudes}>
                <View style={estilos.seccionTituloConInsignia}>
                  <Text style={estilos.listaEncabezado}>Solicitudes Enviadas a Bodega</Text>
                  <Insignia
                    label={`${solicitudesProyecto.length} ${
                      solicitudesProyecto.length === 1 ? "solicitud" : "solicitudes"
                    }`}
                    tone="info"
                    size="sm"
                  />
                </View>

                {solicitudesProyecto.length === 0 ? (
                  <View style={estilos.solicitudesVaciaCaja}>
                    <Ionicons name="clipboard-outline" size={20} color={tema.colors.textMuted} />
                    <Text style={estilos.solicitudesVaciaTexto}>
                      No hay solicitudes de insumos registradas para esta faena.
                    </Text>
                  </View>
                ) : (
                  solicitudesProyecto.map((req) => {
                    const estadoConfig = {
                      pendiente: {
                        label: "Pendiente Bodega",
                        tone: "warn" as const,
                        icon: "time-outline",
                      },
                      aprobada: {
                        label: "Aprobada (Listo retiro)",
                        tone: "info" as const,
                        icon: "checkmark-circle-outline",
                      },
                      entregada: {
                        label: "Retiro Confirmado",
                        tone: "ok" as const,
                        icon: "cube-outline",
                      },
                      rechazada: {
                        label: "Rechazada",
                        tone: "danger" as const,
                        icon: "close-circle-outline",
                      },
                      anulada: {
                        label: "Anulada",
                        tone: "mute" as const,
                        icon: "ban-outline",
                      },
                    }[req.status] || {
                      label: req.status,
                      tone: "info" as const,
                      icon: "information-circle-outline",
                    };

                    const urgenciaConfig = {
                      urgente: { label: "URGENTE", color: tema.colors.danger },
                      alta: { label: "ALTA", color: tema.colors.warnDark },
                      normal: { label: "NORMAL", color: tema.colors.textMuted },
                    }[req.urgency] || { label: req.urgency, color: tema.colors.textMuted };

                    const tienePendienteRetiro =
                      req.status === "aprobada" &&
                      req.items.some((it) => it.quantity - Number(it.deliveredQuantity || 0) > 0);

                    return (
                      <Tarjeta key={req.id} variant="default" style={estilos.solicitudTarjeta}>
                        <View style={estilos.solicitudEncabezado}>
                          <View style={estilos.solicitudCodigoGrupo}>
                            <Ionicons
                              name={estadoConfig.icon as any}
                              size={16}
                              color={tema.colors.primary}
                            />
                            <Text style={estilos.solicitudCodigo}>{req.code}</Text>
                            <Text
                              style={[
                                estilos.solicitudUrgenciaTag,
                                { color: urgenciaConfig.color },
                              ]}
                            >
                              • {urgenciaConfig.label}
                            </Text>
                          </View>
                          <Insignia label={estadoConfig.label} tone={estadoConfig.tone} size="sm" />
                        </View>

                        <Text style={estilos.solicitudFecha}>
                          Fecha: {req.date} • Solicitante: {req.technicianName}
                        </Text>

                        <View style={estilos.solicitudItemsList}>
                          {req.items.map((it, idx) => {
                            const entregado = Number(it.deliveredQuantity || 0);
                            const falta = Math.max(0, it.quantity - entregado);
                            return (
                              <Text key={idx} style={estilos.solicitudItemTexto}>
                                •{" "}
                                <Text style={{ fontWeight: "700" }}>
                                  {it.quantity} {it.unit}
                                </Text>{" "}
                                — {it.name}
                                {req.status === "aprobada" && falta > 0
                                  ? ` (Faltan ${falta} ${it.unit} por retirar)`
                                  : req.status === "entregada"
                                  ? " (Incorporado a faena)"
                                  : ""}
                              </Text>
                            );
                          })}
                        </View>

                        {req.comment ? (
                          <Text style={estilos.solicitudNota}>Nota: "{req.comment}"</Text>
                        ) : null}

                        {tienePendienteRetiro && (
                          <View style={estilos.confirmarRetiroCaja}>
                            <View style={estilos.confirmarRetiroInfo}>
                              <Ionicons
                                name="checkmark-done-circle-outline"
                                size={18}
                                color={tema.colors.okDark}
                              />
                              <Text style={estilos.confirmarRetiroTexto}>
                                Pedido aprobado en bodega. Confirma el retiro para sumar estos
                                insumos automáticamente a tu faena.
                              </Text>
                            </View>
                            <Boton
                              title={
                                confirmandoRetiroId === req.id
                                  ? "Confirmando..."
                                  : "Confirmar Retiro"
                              }
                              variant="primary"
                              size="sm"
                              icon="bag-check-outline"
                              disabled={confirmandoRetiroId === req.id}
                              onPress={() => manejarConfirmarRetiro(req.id, req.code)}
                              style={estilos.botonConfirmarRetiro}
                            />
                          </View>
                        )}

                        {req.status === "rechazada" && req.rejectionReason && (
                          <View style={estilos.solicitudRechazoCaja}>
                            <Ionicons name="alert-circle" size={14} color={tema.colors.danger} />
                            <Text style={estilos.solicitudRechazoTexto}>
                              Motivo: {req.rejectionReason}
                            </Text>
                          </View>
                        )}
                      </Tarjeta>
                    );
                  })
                )}
              </View>

              {/* 8. BOTONES DE ACCIÓN RÁPIDA RESPONSIVOS */}
              <View
                style={[
                  estilos.inferiorAcciones,
                  esMovilEstrecho && estilos.inferiorAccionesApiladas,
                ]}
              >
                <Boton
                  title="Devolver Sobrante"
                  variant="outline"
                  size="md"
                  icon="return-down-back-outline"
                  onPress={() => onNavigateTab && onNavigateTab("registrar", "sobrante")}
                  style={[
                    estilos.accionBotonBase,
                    { borderColor: tema.colors.transit },
                    esMovilEstrecho && { width: "100%" },
                  ]}
                  textStyle={{ color: tema.colors.transit }}
                />
                <Boton
                  title={operaSinConexion ? "Pedir Insumos (Requiere Red)" : "Pedir Más Insumos"}
                  variant="primary"
                  size="md"
                  icon={operaSinConexion ? "cloud-offline-outline" : "cart-outline"}
                  onPress={abrirModalSolicitud}
                  style={[
                    estilos.accionBotonBase,
                    operaSinConexion && { opacity: 0.75 },
                    esMovilEstrecho && { width: "100%" },
                  ]}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* MODAL: SOLICITAR INSUMOS A BODEGA                                         */}
      {/* ========================================================================= */}
      <VistaModal
        visible={modalSolicitudVisible}
        onClose={() => establecerModalSolicitudVisible(false)}
        title="Solicitar Insumos a Bodega"
        subtitle={`Faena: ${actualProyecto?.code || ""} - ${actualProyecto?.name || ""}`}
        maxWidth={540}
      >
        <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
          <Text style={estilos.modalCampoTitulo}>Nivel de Prioridad / Urgencia:</Text>
          <View style={estilos.urgenciaSelectorFila}>
            {(
              [
                {
                  id: "normal",
                  label: "Normal",
                  icon: "checkmark-circle-outline",
                  color: tema.colors.primary,
                },
                {
                  id: "alta",
                  label: "Alta",
                  icon: "alert-circle-outline",
                  color: tema.colors.warnDark,
                },
                {
                  id: "urgente",
                  label: "Urgente",
                  icon: "flame-outline",
                  color: tema.colors.danger,
                },
              ] as const
            ).map((opt) => {
              const activo = solicitudUrgencia === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => establecerSolicitudUrgencia(opt.id)}
                  style={[
                    estilos.urgenciaBoton,
                    activo && { borderColor: opt.color, backgroundColor: tema.colors.surfaceAlt },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={activo ? opt.color : tema.colors.textMuted}
                  />
                  <Text
                    style={[
                      estilos.urgenciaBotonTexto,
                      activo && { color: opt.color, fontWeight: "bold" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[estilos.modalCampoTitulo, { marginTop: 14 }]}>
            Insumos a Pedir ({solicitudItems.length}):
          </Text>

          {solicitudItems.length === 0 ? (
            <View style={estilos.sinItemsAviso}>
              <Ionicons name="cart-outline" size={24} color={tema.colors.textMuted} />
              <Text style={estilos.sinItemsAvisoTexto}>No has añadido insumos a este pedido.</Text>
            </View>
          ) : (
            solicitudItems.map((it) => {
              const stockSuficiente = it.stockBodega >= it.quantity;
              return (
                <View key={it.sku} style={estilos.modalItemFila}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={estilos.modalItemNombre}>{it.name}</Text>
                    <Text style={estilos.modalItemSku}>
                      SKU: {it.sku} • Unidad: {it.unit}
                    </Text>
                    <View style={estilos.modalStockFila}>
                      <Text
                        style={[
                          estilos.modalItemStock,
                          !stockSuficiente && { color: tema.colors.danger, fontWeight: "bold" },
                        ]}
                      >
                        En Bodega: {it.stockBodega} {it.unit}
                      </Text>
                      {!stockSuficiente && (
                        <TouchableOpacity
                          onPress={() => manejarEstablecerCantidad(it.sku, String(it.stockBodega))}
                          style={estilos.ajustarStockBoton}
                        >
                          <Text style={estilos.ajustarStockBotonTexto}>
                            Ajustar a {it.stockBodega}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={estilos.modalItemControles}>
                    <View style={estilos.stepperContenedor}>
                      <TouchableOpacity
                        onPress={() => manejarCambiarCantidad(it.sku, -1)}
                        style={estilos.stepperBoton}
                      >
                        <Ionicons name="remove" size={16} color={tema.colors.text} />
                      </TouchableOpacity>
                      <TextInput
                        value={String(it.quantity)}
                        onChangeText={(val) => manejarEstablecerCantidad(it.sku, val)}
                        keyboardType="numeric"
                        style={[
                          estilos.stepperEntrada,
                          !stockSuficiente && {
                            borderColor: tema.colors.danger,
                            color: tema.colors.danger,
                          },
                        ]}
                      />
                      <TouchableOpacity
                        onPress={() => manejarCambiarCantidad(it.sku, 1)}
                        style={estilos.stepperBoton}
                      >
                        <Ionicons name="add" size={16} color={tema.colors.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => manejarEliminarItem(it.sku)}
                      style={estilos.eliminarItemBoton}
                    >
                      <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <View style={estilos.agregarInsumoSeccion}>
            <TouchableOpacity
              onPress={() => establecerMostrarCatalogoDesplegable(!mostrarCatalogoDesplegable)}
              style={estilos.toggleCatalogoBoton}
            >
              <Ionicons
                name={
                  mostrarCatalogoDesplegable
                    ? "chevron-up-circle-outline"
                    : "add-circle-outline"
                }
                size={18}
                color={tema.colors.primary}
              />
              <Text style={estilos.toggleCatalogoBotonTexto}>
                {mostrarCatalogoDesplegable
                  ? "Ocultar buscador de insumos"
                  : "+ Añadir otro insumo del catálogo"}
              </Text>
            </TouchableOpacity>

            {mostrarCatalogoDesplegable && (
              <View style={estilos.catalogoDesplegableCaja}>
                <TextInput
                  value={busquedaCatalogo}
                  onChangeText={establecerBusquedaCatalogo}
                  placeholder="Buscar insumo por nombre o SKU..."
                  placeholderTextColor={tema.colors.textLight}
                  style={estilos.busquedaCatalogoEntrada}
                />
                <View style={estilos.catalogoListaScroll}>
                  {productosFiltradosParaAgregar.length === 0 ? (
                    <Text style={estilos.sinResultadosTexto}>
                      No se encontraron insumos disponibles.
                    </Text>
                  ) : (
                    productosFiltradosParaAgregar.map((prod) => (
                      <TouchableOpacity
                        key={prod.sku}
                        onPress={() => manejarAgregarProducto(prod)}
                        style={estilos.catalogoItemOpcion}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={estilos.catalogoItemOpcionNombre}>{prod.name}</Text>
                          <Text style={estilos.catalogoItemOpcionDetalle}>
                            {prod.sku} • Stock bodega: {prod.stock} {prod.unit}
                          </Text>
                        </View>
                        <View style={estilos.agregarChip}>
                          <Ionicons name="add" size={14} color="#ffffff" />
                          <Text style={estilos.agregarChipTexto}>Agregar</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={{ marginTop: 12 }}>
            <CampoTexto
              label="Motivo o Justificación del Pedido (opcional)"
              value={solicitudComentario}
              onChangeText={establecerSolicitudComentario}
              placeholder="Ej: Insumos adicionales para remate de sector B o reposición..."
              multiline
              numberOfLines={2}
            />
          </View>

          {Boolean(solicitudError) && (
            <View style={estilos.errorCaja}>
              <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
              <Text style={estilos.errorTexto}>{solicitudError}</Text>
            </View>
          )}

          <View style={estilos.modalAccionesFila}>
            <Boton
              title="Cancelar"
              variant="ghost"
              size="md"
              onPress={() => establecerModalSolicitudVisible(false)}
              style={{ flex: 1, minWidth: 110 }}
            />
            <Boton
              title={enviandoSolicitud ? "Enviando..." : "Enviar a Bodega"}
              variant="primary"
              size="md"
              icon="send-outline"
              disabled={enviandoSolicitud || solicitudItems.length === 0}
              onPress={manejarEnviarSolicitud}
              style={{ flex: 1.4, minWidth: 150 }}
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
  alertaExito: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  alertaExitoTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    color: tema.colors.okDark,
    fontWeight: "600",
    lineHeight: 17,
  },
  alertaOffline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  alertaOfflineTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    color: tema.colors.warnDark,
    fontWeight: "600",
    lineHeight: 17,
  },
  encabezadoDashboard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  tituloPrincipal: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  subtituloPrincipal: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  badgesEstadoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  chipOffline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  chipOfflineTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.warnDark,
  },
  chipOnline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1c1917",
    borderWidth: 1,
    borderColor: "#44403c",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  chipOnlineTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#e7e5e4",
  },
  chipPendienteGlobal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  chipPendienteGlobalTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  sincronizacionBanner: {
    borderRadius: tema.radius.md,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  sincronizacionBannerOnline: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  sincronizacionBannerOffline: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  sincronizacionFilaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  sincronizacionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 230,
  },
  sincronizacionIconoCirculo: {
    width: 36,
    height: 36,
    borderRadius: tema.radius.full,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  sincronizacionTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: "#78350f",
  },
  sincronizacionMarca: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 2,
  },
  sincronizacionFechaNegrita: {
    fontWeight: "bold",
    color: "#451a03",
  },
  sincronizacionOrigen: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 1,
  },
  sincronizacionAcciones: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  botonSincronizar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: tema.radius.full,
  },
  botonSincronizarTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  botonModoOffline: {
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
  botonModoOfflineActivo: {
    backgroundColor: "#d97706",
    borderColor: "#b45309",
  },
  botonModoOfflineTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
  },
  botonModoOfflineTextoActivo: {
    color: "#ffffff",
  },
  scrumGuiaTexto: {
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
  },
  bloqueSeccion: {
    gap: 12,
  },
  seccionEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cargandoCaja: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  cargandoTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  proyectosScrollContenido: {
    gap: 8,
    paddingVertical: 2,
  },
  proyectoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
  },
  proyectoChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  proyectoChipTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    maxWidth: 210,
  },
  proyectoChipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  proyectoChipContador: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
  },
  proyectoChipContadorPendiente: {
    backgroundColor: "#fef3c7",
  },
  proyectoChipContadorOk: {
    backgroundColor: "#dcfce7",
  },
  proyectoChipContadorTexto: {
    fontSize: 10,
    fontWeight: "bold",
  },
  dashboardTarjeta: {
    padding: 16,
    gap: 14,
  },
  dashboardCabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  dashboardCodigoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dashboardCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  resumenRetiroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    borderWidth: 1,
  },
  resumenRetiroPillPendiente: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warnBorder,
  },
  resumenRetiroPillOk: {
    backgroundColor: tema.colors.okLight,
    borderColor: "#bbf7d0",
  },
  resumenRetiroPillTexto: {
    fontSize: 12,
    fontWeight: "bold",
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCaja: {
    flex: 1,
    minWidth: 140,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  kpiCajaMovil: {
    minWidth: "46%",
  },
  kpiEtiqueta: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  kpiValor: {
    fontSize: tema.fontSize.xl,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  supplyProgresoCaja: {
    gap: 6,
  },
  supplyEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  supplyEtiqueta: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  supplyPorcentaje: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  filtrosInsumosCaja: {
    gap: 10,
  },
  seccionTituloConInsignia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  listaEncabezado: {
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
    backgroundColor: "#1c1917",
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
  insumosGrilla: {
    gap: 10,
  },
  insumosGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  elementoTarjeta: {
    padding: 14,
    gap: 10,
  },
  elementoTarjetaAncha: {
    width: "48.8%",
  },
  elementoTarjetaPendiente: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.warn,
  },
  elementoSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  elementoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  elementoSku: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  elementoMetricsFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  elementoColumna: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  elementoDivisor: {
    width: 1,
    height: "80%",
    backgroundColor: tema.colors.border,
  },
  elementoColumnaLbl: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  elementoColumnaValor: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 3,
    textAlign: "center",
  },
  barraIndividualCaja: {
    gap: 4,
  },
  barraIndividualPorcentaje: {
    fontSize: 11,
    color: tema.colors.textMuted,
    textAlign: "right",
    fontWeight: "600",
  },
  bloqueSolicitudes: {
    marginTop: 6,
    gap: 10,
  },
  solicitudesVaciaCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 14,
  },
  solicitudesVaciaTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  solicitudTarjeta: {
    padding: 14,
    gap: 6,
  },
  solicitudEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  solicitudCodigoGrupo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  solicitudCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  solicitudUrgenciaTag: {
    fontSize: 11,
    fontWeight: "bold",
  },
  solicitudFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  solicitudItemsList: {
    gap: 3,
    marginTop: 4,
  },
  solicitudItemTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    lineHeight: 17,
  },
  solicitudNota: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  confirmarRetiroCaja: {
    marginTop: 8,
    padding: 10,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  confirmarRetiroInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 200,
  },
  confirmarRetiroTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.okDark,
    fontWeight: "600",
    lineHeight: 16,
  },
  botonConfirmarRetiro: {
    minHeight: 38,
    paddingHorizontal: 14,
  },
  solicitudRechazoCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.sm,
    padding: 8,
    marginTop: 4,
  },
  solicitudRechazoTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.danger,
    fontWeight: "600",
  },
  inferiorAcciones: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  inferiorAccionesApiladas: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  accionBotonBase: {
    flex: 1,
    minWidth: 180,
    minHeight: 46,
  },
  modalCampoTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 8,
  },
  urgenciaSelectorFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  urgenciaBoton: {
    flex: 1,
    minWidth: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.card,
  },
  urgenciaBotonTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  sinItemsAviso: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.md,
    gap: 6,
  },
  sinItemsAvisoTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
  },
  modalItemFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surface,
    marginBottom: 8,
  },
  modalItemNombre: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  modalItemSku: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  modalStockFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 3,
  },
  modalItemStock: {
    fontSize: 11,
    color: tema.colors.okDark,
    fontWeight: "600",
  },
  ajustarStockBoton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.danger,
  },
  ajustarStockBotonTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: tema.colors.danger,
  },
  modalItemControles: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperContenedor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepperBoton: {
    width: 32,
    height: 32,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperEntrada: {
    width: 48,
    height: 32,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  eliminarItemBoton: {
    padding: 6,
  },
  agregarInsumoSeccion: {
    marginTop: 6,
    gap: 8,
  },
  toggleCatalogoBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  toggleCatalogoBotonTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  catalogoDesplegableCaja: {
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.card,
    padding: 10,
    gap: 8,
  },
  busquedaCatalogoEntrada: {
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: tema.colors.text,
    backgroundColor: tema.colors.surface,
  },
  catalogoListaScroll: {
    gap: 6,
  },
  sinResultadosTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  catalogoItemOpcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 8,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  catalogoItemOpcionNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  catalogoItemOpcionDetalle: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  agregarChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
  },
  agregarChipTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
  },
  errorCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.sm,
    padding: 10,
    marginTop: 8,
  },
  errorTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "600",
  },
  modalAccionesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
});