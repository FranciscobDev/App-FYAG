import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
  BarraProgreso,
} from "@/componentes/comunes";
import {
  calcularResumenLineaSalidaFisica,
  calcularResumenSolicitudSalidaFisica,
} from "@/modulos/inventario/solicitudInsumosUtils";
import {
  formatearTiempoEscaneo,
  resolverCodigoEscaneadoBodega,
} from "@/modulos/inventario/escanerBodegaUtils";
import { listarTecnicosDeProyecto } from "@/modulos/proyectos/proyectosApi";
import { repararTextoUtf8 } from "@/modulos/solicitudes/solicitudesApi";
import { estilos } from "../estilos";

export interface PropiedadesSeccionEgresoBodega {
  abrirEscaner: any;
  activoDespachoSolicitud: any;
  activoPestana: any;
  aprobadoSolicitudes: any;
  despachoElementosEntries: any;
  despachoError: any;
  despachoQuantities: any;
  despachoTecnicoRut: any;
  esCompletoDespacho: any;
  esDesktop: any;
  establecerDespachoTecnicoRut: any;
  manejarDespachoCantidadCambiar: any;
  manejarInitiateDespacho: any;
  manejarSeleccionarDespachoSolicitud: any;
  mostrarAviso: any;
  productos: any;
  seleccionadoDespachoSolicitudId: any;
  seleccionadoDespachoTecnico: any;
  tecnicos: any;
  totalUnidadesHastaDespacho: any;
}

const normalizarRut = (rut?: string | null) =>
  String(rut || "").replace(/[.\-\s]/g, "").toUpperCase();

const extraerNumeroIdProyecto = (valor?: string | number | null) => {
  const num = Number(String(valor || "").replace(/\D/g, ""));
  return Number.isInteger(num) && num > 0 ? num : 0;
};

export const SeccionEgresoBodega: React.FC<PropiedadesSeccionEgresoBodega> = ({
  abrirEscaner,
  activoDespachoSolicitud,
  activoPestana,
  aprobadoSolicitudes,
  despachoError,
  despachoQuantities,
  despachoTecnicoRut,
  esDesktop,
  establecerDespachoTecnicoRut,
  manejarDespachoCantidadCambiar,
  manejarInitiateDespacho,
  manejarSeleccionarDespachoSolicitud,
  mostrarAviso,
  productos,
  seleccionadoDespachoSolicitudId,
  seleccionadoDespachoTecnico,
  tecnicos,
}) => {
  const { solicitudesMaterial, proyectos } = usarAplicacion();

// Fuente viva de solicitudes aprobadas listas para despachar
  const solicitudesListasDespacho = useMemo(() => {
    const desdeContexto = solicitudesMaterial.filter(
      (r) => r.status === "aprobada"
    );
    if (desdeContexto.length > 0) return desdeContexto;
    return Array.isArray(aprobadoSolicitudes) ? aprobadoSolicitudes : [];
  }, [solicitudesMaterial, aprobadoSolicitudes]);
  // Filtro por proyecto en la cola de despacho
  const [proyectoFiltroCodigo, establecerProyectoFiltroCodigo] = useState<string>("TODOS");

  // Técnicos reales obtenidos desde la BD para el proyecto de la solicitud activa
  const [tecnicosProyectoBd, establecerTecnicosProyectoBd] = useState<
    { rut: string; name: string; id_usuario?: number }[]
  >([]);
  const [cargandoTecnicosProyecto, establecerCargandoTecnicosProyecto] = useState(false);
  const [errorConsultaTecnicos, establecerErrorConsultaTecnicos] = useState<string | null>(null);

  // Estado visual de lectura óptica QR/Barras en Salidas (H5)
  const [ultimoEscaneoSalida, establecerUltimoEscaneoSalida] = useState<{
    tipo: "ok" | "alerta";
    sku?: string;
    tiempoTexto: string;
    mensaje: string;
  } | null>(null);
  const [skusEscaneadosSalida, establecerSkusEscaneadosSalida] = useState<Record<string, boolean>>({});

  useEffect(() => {
    establecerUltimoEscaneoSalida(null);
    establecerSkusEscaneadosSalida({});
  }, [seleccionadoDespachoSolicitudId]);

  // Agrupar proyectos que tienen solicitudes (aprobadas para despacho o pendientes de aprobación)
  const proyectosConSolicitudes = useMemo(() => {
    const mapa = new Map<
      string,
      {
        projectCode: string;
        projectName: string;
        aprobadasCount: number;
        pendientesAprobacionCount: number;
        entregadasCount: number;
      }
    >();

    solicitudesMaterial.forEach((sol: any) => {
      const code = sol.projectCode || "SIN-PROY";
      const numCode = extraerNumeroIdProyecto(code);
      const proyInfo = proyectos?.find(
        (p: any) =>
          p.code === code ||
          String(p.id) === String(sol.projectId) ||
          (numCode > 0 && Number(p.id) === numCode)
      );
      const actual = mapa.get(code) || {
        projectCode: code,
        projectName: repararTextoUtf8(sol.projectName || proyInfo?.name || code),
        aprobadasCount: 0,
        pendientesAprobacionCount: 0,
        entregadasCount: 0,
      };

      if (sol.status === "aprobada" || sol.status === "parcial") {
        actual.aprobadasCount += 1;
      } else if (sol.status === "pendiente") {
        actual.pendientesAprobacionCount += 1;
      } else if (sol.status === "entregada") {
        actual.entregadasCount += 1;
      }

      mapa.set(code, actual);
    });

    return Array.from(mapa.values()).filter(
      (item) => item.aprobadasCount > 0 || item.pendientesAprobacionCount > 0 || item.entregadasCount > 0
    );
  }, [solicitudesMaterial, proyectos]);

  // Solicitudes aprobadas filtradas por el proyecto seleccionado
  const solicitudesFiltradasPorProyecto = useMemo(() => {
    if (proyectoFiltroCodigo === "TODOS") return solicitudesListasDespacho;
    return solicitudesListasDespacho.filter((r: any) => r.projectCode === proyectoFiltroCodigo);
  }, [solicitudesListasDespacho, proyectoFiltroCodigo]);

  // Auto-seleccionar la primera solicitud pendiente cuando cambia el filtro o se completa una entrega
  useEffect(() => {
    if (activoPestana !== "egreso") return;

    if (solicitudesFiltradasPorProyecto.length === 0) {
      if (seleccionadoDespachoSolicitudId) {
        manejarSeleccionarDespachoSolicitud("");
      }
      return;
    }

    const sigueEnCola = solicitudesFiltradasPorProyecto.some(
      (s: any) => s.id === seleccionadoDespachoSolicitudId
    );
    if (!sigueEnCola) {
      manejarSeleccionarDespachoSolicitud(solicitudesFiltradasPorProyecto[0].id);
    }
  }, [activoPestana, solicitudesFiltradasPorProyecto, seleccionadoDespachoSolicitudId]);

  // Evita que la estación inferior quede "pegada" si la solicitud ya fue despachada al 100%
  const solicitudActivaValida =
    solicitudesListasDespacho.find((r: any) => r.id === seleccionadoDespachoSolicitudId) ||
    (activoDespachoSolicitud &&
    solicitudesListasDespacho.some((r: any) => r.id === activoDespachoSolicitud.id)
      ? activoDespachoSolicitud
      : null);

  // Consultar en PostgreSQL los técnicos asignados al proyecto de la solicitud activa
  useEffect(() => {
    if (activoPestana !== "egreso" || !solicitudActivaValida) {
      establecerTecnicosProyectoBd([]);
      establecerErrorConsultaTecnicos(null);
      return;
    }

    const numDesdeCodigo = extraerNumeroIdProyecto(solicitudActivaValida.projectCode);
    const numDesdeId = extraerNumeroIdProyecto(solicitudActivaValida.projectId);

    const proyectoMatch = proyectos?.find(
      (p: any) =>
        String(p.id) === String(solicitudActivaValida.projectId) ||
        p.code === solicitudActivaValida.projectCode ||
        (numDesdeCodigo > 0 && Number(p.id) === numDesdeCodigo)
    );

    const idProyectoNum =
      (proyectoMatch && extraerNumeroIdProyecto(proyectoMatch.id)) ||
      (numDesdeId > 0 ? numDesdeId : numDesdeCodigo);

    if (!idProyectoNum) {
      establecerTecnicosProyectoBd([]);
      establecerErrorConsultaTecnicos(null);
      return;
    }

    let cancelado = false;
    establecerCargandoTecnicosProyecto(true);
    establecerErrorConsultaTecnicos(null);

    listarTecnicosDeProyecto(idProyectoNum)
      .then((res) => {
        if (cancelado) return;
        if (res.ok && Array.isArray(res.data)) {
          const mapeados = res.data.map((t) => ({
            id_usuario: t.id_usuario,
            rut: t.rut && t.rut.trim() ? t.rut.trim() : `USR-${t.id_usuario}`,
            name: t.nombre,
          }));
          establecerTecnicosProyectoBd(mapeados);
          establecerErrorConsultaTecnicos(null);
        } else {
          establecerTecnicosProyectoBd([]);
          establecerErrorConsultaTecnicos(res.error || "No se pudo consultar técnicos asignados");
        }
      })
      .finally(() => {
        if (!cancelado) {
          establecerCargandoTecnicosProyecto(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [
    activoPestana,
    solicitudActivaValida?.id,
    solicitudActivaValida?.projectId,
    solicitudActivaValida?.projectCode,
    proyectos,
  ]);

  // Técnicos asociados exclusivamente al proyecto destino (desde BD + respaldo en memoria)
  const tecnicosAsociadosProyecto = useMemo(() => {
    if (!solicitudActivaValida) return [];

    // 1. Prioridad: técnicos reales asignados al proyecto en PostgreSQL
    if (tecnicosProyectoBd.length > 0) {
      return tecnicosProyectoBd.map((tBd) => {
        const coincidenciaLocal = (tecnicos || []).find(
          (tl: any) =>
            normalizarRut(tl.rut) === normalizarRut(tBd.rut) ||
            tl.name?.trim().toLowerCase() === tBd.name?.trim().toLowerCase()
        );
        const esSolicitante =
          solicitudActivaValida.technicianName?.trim().toLowerCase() ===
          tBd.name?.trim().toLowerCase();

        const rutFinal =
          !tBd.rut.startsWith("USR-")
            ? tBd.rut
            : coincidenciaLocal?.rut ||
              (esSolicitante && solicitudActivaValida.technicianRut) ||
              tBd.rut;

        return {
          rut: rutFinal,
          name: tBd.name,
        };
      });
    }

    // 2. Fallback: revisar technicianRuts en memoria local si existieran
    const numDesdeCodigo = extraerNumeroIdProyecto(solicitudActivaValida.projectCode);
    const proyectoDestino = proyectos?.find(
      (p: any) =>
        String(p.id) === String(solicitudActivaValida.projectId) ||
        p.code === solicitudActivaValida.projectCode ||
        (numDesdeCodigo > 0 && Number(p.id) === numDesdeCodigo)
    );

    const rutsAsignados = new Set(
      (proyectoDestino?.technicianRuts ?? []).map(normalizarRut)
    );

    if (rutsAsignados.size > 0) {
      const base = [...(tecnicos || [])];
      if (
        solicitudActivaValida.technicianRut &&
        !base.some(
          (t: any) => normalizarRut(t.rut) === normalizarRut(solicitudActivaValida.technicianRut)
        )
      ) {
        base.unshift({
          rut: solicitudActivaValida.technicianRut,
          name: solicitudActivaValida.technicianName || "Técnico Solicitante",
        });
      }

      const filtradosLocal = base.filter((t: any) => rutsAsignados.has(normalizarRut(t.rut)));
      if (filtradosLocal.length > 0) return filtradosLocal;
    }

    // 3. Respaldo si el endpoint de técnicos del proyecto está restringido por rol (ej. 403)
    if (errorConsultaTecnicos && solicitudActivaValida.technicianName) {
      const coincidenciaSolicitante = (tecnicos || []).find(
        (tl: any) =>
          (solicitudActivaValida.technicianRut &&
            normalizarRut(tl.rut) === normalizarRut(solicitudActivaValida.technicianRut)) ||
          tl.name?.trim().toLowerCase() ===
            solicitudActivaValida.technicianName?.trim().toLowerCase()
      );
      return [
        {
          rut:
            solicitudActivaValida.technicianRut ||
            coincidenciaSolicitante?.rut ||
            "SOLICITANTE",
          name: solicitudActivaValida.technicianName,
        },
      ];
    }

    return [];
  }, [solicitudActivaValida, tecnicosProyectoBd, proyectos, tecnicos, errorConsultaTecnicos]);

  // Mantener coherente el técnico receptor seleccionado con los técnicos asignados al proyecto
  useEffect(() => {
    if (activoPestana !== "egreso" || !solicitudActivaValida || cargandoTecnicosProyecto) return;

    if (tecnicosAsociadosProyecto.length === 0) {
      if (despachoTecnicoRut) {
        establecerDespachoTecnicoRut("");
      }
      return;
    }

    const sigueValido = tecnicosAsociadosProyecto.some(
      (t: any) => normalizarRut(t.rut) === normalizarRut(despachoTecnicoRut)
    );

    if (!sigueValido) {
      const solicitanteAsignado = tecnicosAsociadosProyecto.find(
        (t: any) =>
          normalizarRut(t.rut) === normalizarRut(solicitudActivaValida.technicianRut) ||
          t.name?.trim().toLowerCase() ===
            solicitudActivaValida.technicianName?.trim().toLowerCase()
      );
      establecerDespachoTecnicoRut(
        solicitanteAsignado ? solicitanteAsignado.rut : tecnicosAsociadosProyecto[0].rut
      );
    }
  }, [
    activoPestana,
    solicitudActivaValida,
    cargandoTecnicosProyecto,
    tecnicosAsociadosProyecto,
    despachoTecnicoRut,
  ]);

  if (activoPestana !== "egreso") return null;

  const solicitudesEntregadas = solicitudesMaterial.filter((r) => r.status === "entregada");
  const totalLineasPendientes = solicitudesListasDespacho.reduce(
    (acc: number, r: any) =>
      acc + r.items.filter((it: any) => (it.deliveredQuantity || 0) < it.quantity).length,
    0
  );

  const proyectoSeleccionadoInfo = proyectosConSolicitudes.find(
    (p) => p.projectCode === proyectoFiltroCodigo
  );

  const receptorActivoValido =
    tecnicosAsociadosProyecto.find(
      (t: any) => normalizarRut(t.rut) === normalizarRut(despachoTecnicoRut)
    ) ||
    (seleccionadoDespachoTecnico &&
    tecnicosAsociadosProyecto.some(
      (t: any) => normalizarRut(t.rut) === normalizarRut(seleccionadoDespachoTecnico.rut)
    )
      ? seleccionadoDespachoTecnico
      : null);

  return (
    <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
      {/* 1. FRANJA DE RESUMEN OPERATIVO DE DESPACHO */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 140,
            backgroundColor: tema.colors.card,
            borderRadius: tema.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: tema.colors.primaryBorder,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: tema.colors.primaryLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="cube-outline" size={20} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {solicitudesListasDespacho.length}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Por Despachar
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 140,
            backgroundColor: tema.colors.card,
            borderRadius: tema.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: tema.colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: tema.colors.warnLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="layers-outline" size={20} color={tema.colors.warnDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {totalLineasPendientes}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Ítems por Entregar
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 140,
            backgroundColor: tema.colors.card,
            borderRadius: tema.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: tema.colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: tema.colors.okLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark-done-outline" size={20} color={tema.colors.okDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {solicitudesEntregadas.length}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Guías Entregadas
            </Text>
          </View>
        </View>
      </View>

      {/* 2. PROYECTOS CON SOLICITUDES DE MATERIAL */}
      <Text style={estilos.formularioSeccionEtiqueta}>
1. Proyectos con Solicitudes ({proyectosConSolicitudes.length}):
      </Text>

      {proyectosConSolicitudes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 14 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <TouchableOpacity
            onPress={() => establecerProyectoFiltroCodigo("TODOS")}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: tema.radius.md,
              backgroundColor:
                proyectoFiltroCodigo === "TODOS" ? "#1c1917" : tema.colors.card,
              borderWidth: 1.5,
              borderColor:
                proyectoFiltroCodigo === "TODOS"
                  ? tema.colors.primary
                  : tema.colors.borderDark,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color:
                  proyectoFiltroCodigo === "TODOS" ? "#f59e0b" : tema.colors.text,
              }}
            >
              Todos los Proyectos ({solicitudesListasDespacho.length} listos)
            </Text>
          </TouchableOpacity>

          {proyectosConSolicitudes.map((proy) => {
            const activo = proyectoFiltroCodigo === proy.projectCode;
            return (
              <TouchableOpacity
                key={proy.projectCode}
                onPress={() => establecerProyectoFiltroCodigo(proy.projectCode)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: tema.radius.md,
                  backgroundColor: activo ? "#1c1917" : tema.colors.card,
                  borderWidth: 1.5,
                  borderColor: activo ? tema.colors.primary : tema.colors.borderDark,
                  minWidth: 210,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name="folder-open-outline"
                    size={14}
                    color={activo ? "#f59e0b" : tema.colors.primaryDark}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: activo ? "#f59e0b" : tema.colors.primaryDark,
                    }}
                  >
                    {proy.projectCode}
                  </Text>
                  {proy.aprobadasCount > 0 ? (
                    <Insignia label={`${proy.aprobadasCount} por despachar`} tone="ok" size="sm" />
                  ) : proy.pendientesAprobacionCount > 0 ? (
                    <Insignia
                      label={`${proy.pendientesAprobacionCount} sin aprobar`}
                      tone="warn"
                      size="sm"
                    />
                  ) : (
                    <Insignia label="Despachado" tone="mute" size="sm" />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: activo ? "#ffffff" : tema.colors.text,
                    marginTop: 3,
                  }}
                >
                  {repararTextoUtf8(proy.projectName)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 3. COLA DE SOLICITUDES APROBADAS A DESPACHAR */}
      <Text style={estilos.formularioSeccionEtiqueta}>
2. Seleccionar Pedido Aprobado en Cola ({solicitudesFiltradasPorProyecto.length}):
      </Text>

      {solicitudesFiltradasPorProyecto.length === 0 ? (
        <EstadoVacio
          icon="checkmark-done-circle-outline"
          title={
            proyectoSeleccionadoInfo && proyectoSeleccionadoInfo.pendientesAprobacionCount > 0
              ? `El proyecto ${proyectoSeleccionadoInfo.projectCode} tiene ${proyectoSeleccionadoInfo.pendientesAprobacionCount} solicitud(es) pendiente(s) de aprobación`
              : "Sin solicitudes pendientes de despacho"
          }
          description={
            proyectoSeleccionadoInfo && proyectoSeleccionadoInfo.pendientesAprobacionCount > 0
              ? "Aprueba la solicitud en la pestaña 'Solicitudes' para habilitar su salida física en bodega."
              : "Todos los pedidos aprobados para este filtro ya fueron despachados físicamente."
          }
          containerStyle={{ marginVertical: 16 }}
        />
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {solicitudesFiltradasPorProyecto.map((r: any) => {
            const esSeleccionado = seleccionadoDespachoSolicitudId === r.id;
            const totalUnidadesPedido = r.items.reduce(
              (acc: number, it: any) => acc + Math.max(0, it.quantity - (it.deliveredQuantity || 0)),
              0
            );
            const tonoUrgencia =
              r.urgency === "urgente" ? "danger" : r.urgency === "alta" ? "warn" : "info";
            const etiquetaUrgencia =
              r.urgency === "urgente" ? "Urgente" : r.urgency === "alta" ? "Alta" : "Normal";

            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => manejarSeleccionarDespachoSolicitud(r.id)}
                activeOpacity={0.85}
                style={[
                  estilos.despachoSolicitudTarjeta,
                  {
                    flex: 1,
                    minWidth: 250,
                    marginRight: 0,
                  },
                  esSeleccionado && estilos.despachoSolicitudTarjetaActivo,
                ]}
              >
                <View style={estilos.despachoSolicitudSuperior}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons
                      name={esSeleccionado ? "radio-button-on" : "radio-button-off"}
                      size={16}
                      color={esSeleccionado ? tema.colors.primary : tema.colors.textMuted}
                    />
                    <Text
                      style={[
                        estilos.despachoSolicitudCodigo,
                        esSeleccionado && { color: tema.colors.primaryDark },
                      ]}
                    >
                      {r.code}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    <Insignia label={etiquetaUrgencia} tone={tonoUrgencia} size="sm" />
                    {r.receiptNumber && (
                      <Insignia label={r.receiptNumber} tone="mute" size="sm" />
                    )}
                  </View>
                </View>

                <Text style={[estilos.despachoSolicitudProyecto, { marginTop: 4 }]}>
                  {r.projectCode} • {repararTextoUtf8(r.projectName)}
                </Text>
                <Text style={estilos.despachoSolicitudMeta}>
                  Solicita: {r.technicianName} • {r.date}
                </Text>

                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: tema.colors.borderLight,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.textSecondary }}>
                    {r.items.length} {r.items.length === 1 ? "insumo" : "insumos"} ({totalUnidadesPedido} un. pend.)
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: esSeleccionado ? tema.colors.primaryDark : tema.colors.textMuted,
                    }}
                  >
                    {esSeleccionado ? "En preparación ✓" : "Tocar para preparar →"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 4. ESTACIÓN DE REGISTRO DE SALIDA FÍSICA DEL PEDIDO ACTIVO */}
      {solicitudActivaValida && (() => {
        const resumenSolicitudVivo = calcularResumenSolicitudSalidaFisica(
          solicitudActivaValida,
          despachoQuantities || {},
          productos || []
        );

        const aplicarPorcentajeSobrePendiente = (factor: number) => {
          solicitudActivaValida.items.forEach((it: any) => {
            const prod = productos.find((p: any) => p.sku === it.sku);
            const resLin = calcularResumenLineaSalidaFisica(it, 0, prod);
            const maxPosible = Math.min(resLin.saldoPendienteAntes, resLin.stockRespaldoParaEgreso);
            if (maxPosible <= 0) {
              manejarDespachoCantidadCambiar(it.sku, "0");
              return;
            }
            const sugerido =
              factor >= 1
                ? maxPosible
                : prod?.isBulk
                  ? Number((maxPosible * factor).toFixed(2))
                  : Math.max(1, Math.floor(maxPosible * factor));
            manejarDespachoCantidadCambiar(it.sku, String(Math.min(maxPosible, sugerido)));
          });
        };

        return (
          <View style={[estilos.despachoLayoutContenedor, esDesktop && estilos.despachoLayoutDesktop]}>
            <Tarjeta
              variant="elevated"
              style={[estilos.despachoFormularioTarjeta, esDesktop && estilos.despachoFormularioTarjetaDesktop]}
            >
              <View style={estilos.despachoFormularioEncabezado}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Text style={estilos.despachoFormularioTitulo}>
                      Registro de Salida Física: {solicitudActivaValida.code}
                    </Text>
                    {solicitudActivaValida.receiptNumber && (
                      <Insignia label={`Aut. ${solicitudActivaValida.receiptNumber}`} tone="ok" size="sm" />
                    )}
                  </View>
                  <Text style={estilos.despachoFormularioSubtitulo}>
                    Proyecto Destino: {repararTextoUtf8(solicitudActivaValida.projectName)} ({solicitudActivaValida.projectCode})
                  </Text>
                </View>
                <Boton
                  variant="primary"
                  size="sm"
                  title="Escanear QR / Barras"
                  icon="qr-code-outline"
                  onPress={() =>
                    abrirEscaner(
                      "Escanear SKU para Salida Física (H5)",
                      (scannedCode: any, meta: any) => {
                        const resolucion =
                          meta && meta.valido && meta.producto
                            ? meta
                            : resolverCodigoEscaneadoBodega(scannedCode, productos);
                        const tiempoTexto = formatearTiempoEscaneo(resolucion.tiempoMs);

                        if (!resolucion.valido || !resolucion.producto) {
                          const msg =
                            resolucion.mensajeError ||
                            `Código "${scannedCode}" no existe en el catálogo maestro. Flujo detenido.`;
                          establecerUltimoEscaneoSalida({
                            tipo: "alerta",
                            tiempoTexto,
                            mensaje: msg,
                          });
                          mostrarAviso(msg);
                          return;
                        }

                        const matchedProducto = resolucion.producto;
                        const itemSolicitud = solicitudActivaValida.items.find(
                          (it: any) => it.sku === matchedProducto.sku
                        );

                        if (!itemSolicitud) {
                          const msg = `Flujo detenido: el insumo ${matchedProducto.name} (${matchedProducto.sku}) no pertenece a la solicitud ${solicitudActivaValida.code}.`;
                          establecerUltimoEscaneoSalida({
                            tipo: "alerta",
                            sku: matchedProducto.sku,
                            tiempoTexto,
                            mensaje: msg,
                          });
                          mostrarAviso(msg);
                          return;
                        }

                        const resLinea = calcularResumenLineaSalidaFisica(
                          itemSolicitud,
                          0,
                          matchedProducto
                        );
                        const maxPosible = Math.min(
                          resLinea.saldoPendienteAntes,
                          resLinea.stockRespaldoParaEgreso
                        );
                        const actual = Number(despachoQuantities[matchedProducto.sku] || 0);
                        const nuevaCantidad =
                          actual <= 0
                            ? maxPosible
                            : Math.min(maxPosible, actual + (matchedProducto.isBulk ? 0.5 : 1));

                        if (maxPosible > 0) {
                          manejarDespachoCantidadCambiar(
                            matchedProducto.sku,
                            String(nuevaCantidad)
                          );
                        }

                        establecerSkusEscaneadosSalida((prev) => ({
                          ...prev,
                          [matchedProducto.sku]: true,
                        }));

                        const etiquetaFormato =
                          resolucion.formatoDetectado === "QR_H47" ? "QR H47" : "Código";
                        const msgOk = `SKU ${matchedProducto.sku} autocompletado (${matchedProducto.name}) vía ${etiquetaFormato} en ${tiempoTexto} • Retiro: ${nuevaCantidad} ${itemSolicitud.unit}.`;
                        establecerUltimoEscaneoSalida({
                          tipo: "ok",
                          sku: matchedProducto.sku,
                          tiempoTexto,
                          mensaje: msgOk,
                        });
                        mostrarAviso(`✓ ${msgOk}`);
                      },
                      {
                        moduloOrigen: "salida",
                        validarExistencia: true,
                        sugerenciaSkus: solicitudActivaValida.items.map((it: any) => it.sku),
                      }
                    )
                  }
                  style={{ minHeight: 40 }}
                />
              </View>

              {/* Feedback visual inmediato del escaneo óptico en Salidas (H5) */}
              {ultimoEscaneoSalida && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: tema.radius.md,
                    marginBottom: 12,
                    backgroundColor:
                      ultimoEscaneoSalida.tipo === "ok"
                        ? tema.colors.okLight
                        : tema.colors.dangerLight,
                    borderWidth: 1,
                    borderColor:
                      ultimoEscaneoSalida.tipo === "ok"
                        ? tema.colors.ok
                        : tema.colors.danger,
                  }}
                >
                  <Ionicons
                    name={
                      ultimoEscaneoSalida.tipo === "ok"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={20}
                    color={
                      ultimoEscaneoSalida.tipo === "ok"
                        ? tema.colors.okDark
                        : tema.colors.danger
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color:
                          ultimoEscaneoSalida.tipo === "ok"
                            ? tema.colors.okDark
                            : tema.colors.danger,
                      }}
                    >
                      {ultimoEscaneoSalida.tipo === "ok"
                        ? `Lectura óptica exitosa (${ultimoEscaneoSalida.tiempoTexto})`
                        : `Lectura bloqueada (${ultimoEscaneoSalida.tiempoTexto})`}
                    </Text>
                    <Text style={{ fontSize: 12, color: tema.colors.text, marginTop: 2 }}>
                      {ultimoEscaneoSalida.mensaje}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => establecerUltimoEscaneoSalida(null)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={16} color={tema.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Aviso de trazabilidad e inmutabilidad del registro en Cardex */}
              <View
                style={{
                  backgroundColor: tema.colors.primaryLight,
                  borderWidth: 1,
                  borderColor: tema.colors.primaryBorder,
                  borderRadius: tema.radius.sm,
                  padding: 10,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={tema.colors.primaryDark} />
                <Text style={{ flex: 1, fontSize: 11, color: tema.colors.textSecondary, lineHeight: 16 }}>
                  <Text style={{ fontWeight: "700", color: tema.colors.primaryDark }}>
                    Trazabilidad irreversible en Cardex:{" "}
                  </Text>
                  El egreso queda vinculado de forma permanente al proyecto{" "}
                  <Text style={{ fontWeight: "700" }}>{solicitudActivaValida.projectCode}</Text> y al técnico que
                  retira. Las correcciones posteriores se realizan mediante un movimiento de ajuste, nunca editando el
                  registro.
                </Text>
              </View>

              {/* Selector de Técnico asociado al proyecto que retira en bodega */}
              <Text style={estilos.formularioSeccionEtiqueta}>
3. Seleccionar Técnico que Retira en Bodega (
                {cargandoTecnicosProyecto
                  ? "cargando..."
                  : `${tecnicosAsociadosProyecto.length} asignados a ${solicitudActivaValida.projectCode}`}
                ):
              </Text>
              {cargandoTecnicosProyecto ? (
                <Text style={{ fontSize: 12, color: tema.colors.textMuted, marginBottom: 14 }}>
                  Consultando técnicos asignados al proyecto...
                </Text>
              ) : tecnicosAsociadosProyecto.length === 0 ? (
                <View
                  style={{
                    backgroundColor: tema.colors.warnLight,
                    borderWidth: 1,
                    borderColor: tema.colors.warn,
                    borderRadius: tema.radius.sm,
                    padding: 10,
                    marginBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="warning-outline" size={18} color={tema.colors.warnDark} />
                  <Text style={{ flex: 1, fontSize: 12, color: tema.colors.warnDark, fontWeight: "600" }}>
                    El proyecto {solicitudActivaValida.projectCode} no tiene técnicos asignados. Asigna al menos un técnico en el módulo de Proyectos para registrar el retiro.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {tecnicosAsociadosProyecto.map((t: any) => {
                    const esReceptor = normalizarRut(despachoTecnicoRut) === normalizarRut(t.rut);
                    return (
                      <TouchableOpacity
                        key={t.rut}
                        onPress={() => establecerDespachoTecnicoRut(t.rut)}
                        style={[
                          estilos.tecnicoSeleccionarChip,
                          esReceptor && estilos.tecnicoSeleccionarChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.tecnicoSeleccionarNombre,
                            esReceptor && estilos.tecnicoSeleccionarNombreActivo,
                          ]}
                        >
                          {t.name}
                        </Text>
                        <Text style={estilos.tecnicoSeleccionarRut}>RUT: {t.rut}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Controles rápidos de entrega parcial vs completar saldo restante */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Text style={[estilos.formularioSeccionEtiqueta, { marginBottom: 0 }]}>
4. Saldo Autorizado vs. Entregado en Tiempo Real:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Boton
                    variant="secondary"
                    size="sm"
                    title="Entrega Parcial (50%)"
                    icon="pie-chart-outline"
                    onPress={() => aplicarPorcentajeSobrePendiente(0.5)}
                  />
                  <Boton
                    variant="secondary"
                    size="sm"
                    title="Completar Saldo Restante"
                    icon="checkmark-done-outline"
                    onPress={() => aplicarPorcentajeSobrePendiente(1)}
                  />
                </View>
              </View>

              {/* Tabla de ítems a despachar con comparativa Autorizado vs Entregado en vivo */}
              {solicitudActivaValida.items.map((it: any) => {
                const prod = productos.find((p: any) => p.sku === it.sku);
                const actualDespacho = Number(despachoQuantities[it.sku] || 0);
                const resumenLinea = calcularResumenLineaSalidaFisica(it, actualDespacho, prod);
                const esOverExistencia = resumenLinea.superaStockBodega;
                const esOverPendiente = resumenLinea.superaSaldoPendiente;
                const fueEscaneado = Boolean(skusEscaneadosSalida[it.sku]);

                return (
                  <View
                    key={it.sku}
                    style={[
                      estilos.despachoElementoFila,
                      { flexDirection: "column", alignItems: "stretch", gap: 10 },
                      fueEscaneado && {
                        borderColor: tema.colors.ok,
                        backgroundColor: tema.colors.okLight,
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1.5, minWidth: 180, marginRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <Text style={estilos.despachoElementoNombre}>{repararTextoUtf8(it.name)}</Text>
                          {fueEscaneado && <Insignia label="Escaneado ✓" tone="ok" size="sm" />}
                        </View>
                        <Text style={estilos.despachoElementoSku}>
                          SKU: {it.sku} {prod?.location ? `• ${prod.location}` : ""}
                        </Text>
                        <Text style={estilos.despachoElementoExistencia}>
                          Respaldo en bodega: {resumenLinea.stockRespaldoParaEgreso} {it.unit}{" "}
                          {resumenLinea.stockComprometidoBodega > 0
                            ? `(Disp: ${resumenLinea.stockDisponibleBodega} + Comp: ${resumenLinea.stockComprometidoBodega})`
                            : `(Disp: ${resumenLinea.stockDisponibleBodega})`}
                        </Text>
                      </View>

                      <View style={estilos.despachoColumnaStats}>
                        <Text style={estilos.statLinea}>
                          Autorizado: <Text style={{ fontWeight: "700" }}>{resumenLinea.saldoAutorizado} {it.unit}</Text>
                        </Text>
                        <Text style={estilos.statLinea}>
                          Entregado previo: <Text style={{ fontWeight: "700" }}>{resumenLinea.entregadoPrevio} {it.unit}</Text>
                        </Text>
                        <Text style={[estilos.statLinea, { color: tema.colors.primary, fontWeight: "700" }]}>
                          Pendiente actual: {resumenLinea.saldoPendienteAntes} {it.unit}
                        </Text>
                      </View>

                      <View style={estilos.despachoEntradaCaja}>
                        <Text style={estilos.despachoEntradaEtiqueta}>Retira ahora:</Text>
                        <TextInput
                          value={String(actualDespacho)}
                          onChangeText={(val: any) => manejarDespachoCantidadCambiar(it.sku, val)}
                          keyboardType="decimal-pad"
                          style={[
                            estilos.despachoCantidadEntrada,
                            (esOverExistencia || esOverPendiente) && { borderColor: tema.colors.danger },
                          ]}
                        />
                        <Text style={estilos.despachoUnidadEtiqueta}>{it.unit}</Text>
                      </View>
                    </View>

                    {/* Barra y franja en vivo de Autorizado vs Entregado resultante */}
                    <View
                      style={{
                        backgroundColor: tema.colors.surfaceAlt,
                        borderRadius: tema.radius.sm,
                        padding: 8,
                        borderWidth: 1,
                        borderColor:
                          esOverExistencia || esOverPendiente
                            ? tema.colors.danger
                            : tema.colors.borderLight,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.text }}>
                          Entregado acumulado en vivo:{" "}
                          <Text style={{ color: tema.colors.okDark }}>
                            {resumenLinea.entregadoAcumulado} / {resumenLinea.saldoAutorizado} {it.unit}
                          </Text>{" "}
                          ({resumenLinea.porcentajeAvanceEntrega}%)
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color:
                              resumenLinea.saldoPendienteRestante === 0
                                ? tema.colors.okDark
                                : tema.colors.warnDark,
                          }}
                        >
                          Saldo pendiente resultante: {resumenLinea.saldoPendienteRestante} {it.unit}
                        </Text>
                      </View>
                      <BarraProgreso
                        value={resumenLinea.entregadoAcumulado}
                        max={Math.max(1, resumenLinea.saldoAutorizado)}
                        height={6}
                      />
                      {resumenLinea.mensajeAlerta && (
                        <Text
                          style={{
                            fontSize: 11,
                            color: tema.colors.danger,
                            fontWeight: "600",
                            marginTop: 6,
                          }}
                        >
                          {resumenLinea.mensajeAlerta}
                        </Text>
                      )}
                    </View>

                    {prod?.isBulk && prod.containerCapacity && (
                      <View style={{ marginTop: 2 }}>
                        <BarraProgreso
                          value={Math.max(0, resumenLinea.stockRespaldoParaEgreso - actualDespacho)}
                          max={prod.containerCapacity}
                          height={5}
                          showPercentage
                          label={`Contenedor restante: ${Math.max(
                            0,
                            resumenLinea.stockRespaldoParaEgreso - actualDespacho
                          ).toFixed(3)} ${it.unit}`}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </Tarjeta>

            {/* Resumen lateral (en desktop) o inferior (en móvil) de Registro de Salida Física */}
            <Tarjeta
              variant="outlined"
              style={[estilos.despachoResumenTarjeta, esDesktop && estilos.despachoResumenTarjetaDesktop]}
            >
              <View style={estilos.resumenTarjetaEncabezado}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="receipt-outline" size={18} color={tema.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={estilos.resumenTarjetaTitulo}>Guía de Salida Física</Text>
                </View>
                <Insignia
                  label={
                    resumenSolicitudVivo.esEntregaCompleta
                      ? "Entrega Total"
                      : resumenSolicitudVivo.esEntregaParcial
                        ? "Entrega Parcial"
                        : "Sin Cantidad"
                  }
                  tone={
                    resumenSolicitudVivo.esEntregaCompleta
                      ? "ok"
                      : resumenSolicitudVivo.esEntregaParcial
                        ? "warn"
                        : "mute"
                  }
                  size="sm"
                />
              </View>

              <View style={estilos.resumenTarjetaCuerpo}>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Comprobante Aut.:</Text>
                  <Text style={estilos.resumenValor}>
                    {solicitudActivaValida.receiptNumber || solicitudActivaValida.code}
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Proyecto Destino:</Text>
                  <Text style={estilos.resumenValor}>
                    {solicitudActivaValida.projectCode} • {repararTextoUtf8(solicitudActivaValida.projectName)}
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Solicitado por:</Text>
                  <Text style={estilos.resumenValor}>{solicitudActivaValida.technicianName}</Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Retira en Bodega:</Text>
                  <Text style={[estilos.resumenValor, { fontWeight: "700", color: tema.colors.primary }]}>
                    {receptorActivoValido
                      ? `${receptorActivoValido.name} (${receptorActivoValido.rut})`
                      : "Seleccionar técnico..."}
                  </Text>
                </View>
                <View style={estilos.resumenDivisor} />
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Total Autorizado:</Text>
                  <Text style={estilos.resumenValor}>{resumenSolicitudVivo.totalAutorizadoUnidades} un.</Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Entregado Previo:</Text>
                  <Text style={estilos.resumenValor}>{resumenSolicitudVivo.totalEntregadoPrevioUnidades} un.</Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={[estilos.resumenEtiqueta, { fontWeight: "700", color: tema.colors.primaryDark }]}>
                    Entregando Ahora:
                  </Text>
                  <Text style={[estilos.resumenValor, { fontWeight: "800", fontSize: 15, color: tema.colors.primary }]}>
                    {resumenSolicitudVivo.totalEntregandoAhoraUnidades} un.
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={[estilos.resumenEtiqueta, { fontWeight: "700", color: tema.colors.okDark }]}>
                    Total Entregado Final:
                  </Text>
                  <Text style={[estilos.resumenValor, { fontWeight: "700", color: tema.colors.okDark }]}>
                    {resumenSolicitudVivo.totalEntregadoAcumuladoUnidades} / {resumenSolicitudVivo.totalAutorizadoUnidades} un.
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={[estilos.resumenEtiqueta, { fontWeight: "700", color: tema.colors.text }]}>
                    Saldo Pendiente Restante:
                  </Text>
                  <Text
                    style={[
                      estilos.resumenValor,
                      {
                        fontWeight: "800",
                        color:
                          resumenSolicitudVivo.totalSaldoPendienteRestanteUnidades === 0
                            ? tema.colors.okDark
                            : tema.colors.warnDark,
                      },
                    ]}
                  >
                    {resumenSolicitudVivo.totalSaldoPendienteRestanteUnidades} un.
                  </Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <BarraProgreso
                    value={resumenSolicitudVivo.totalEntregadoAcumuladoUnidades}
                    max={Math.max(1, resumenSolicitudVivo.totalAutorizadoUnidades)}
                    height={7}
                    showPercentage
                    label={`Avance de entrega autorizada: ${resumenSolicitudVivo.porcentajeAvanceTotal}%`}
                  />
                </View>
              </View>

              {(Boolean(despachoError) || resumenSolicitudVivo.tieneErroresLinea) && (
                <View style={estilos.errorAvisoTarjeta}>
                  <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                  <Text style={estilos.errorAvisoTexto}>
                    {despachoError || resumenSolicitudVivo.errores[0]}
                  </Text>
                </View>
              )}

              <Boton
                title={
                  resumenSolicitudVivo.esEntregaCompleta
                    ? "Confirmar Salida Total y Emitir Guía"
                    : "Confirmar Salida Parcial y Conservar Saldo"
                }
                variant="primary"
                icon="checkmark-done-outline"
                size="md"
                disabled={
                  resumenSolicitudVivo.totalEntregandoAhoraUnidades === 0 ||
                  !receptorActivoValido ||
                  resumenSolicitudVivo.tieneErroresLinea
                }
                onPress={manejarInitiateDespacho}
                style={{ marginTop: 14 }}
                fullWidth
              />
            </Tarjeta>
          </View>
        );
      })()}

      {/* 5. HISTORIAL DE ÚLTIMOS DESPACHOS ENTREGADOS */}
      {solicitudesEntregadas.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={estilos.formularioSeccionEtiqueta}>
            Últimas Guías Despachadas ({solicitudesEntregadas.length}):
          </Text>
          {solicitudesEntregadas.slice(0, 4).map((sol) => (
            <Tarjeta key={sol.id} variant="outlined" style={{ marginBottom: 8, padding: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: tema.colors.text }}>
                    {sol.code} • {repararTextoUtf8(sol.projectName)}
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginTop: 2 }}>
                    Retirado por: {sol.technicianName} • {sol.date}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {sol.receiptNumber && <Insignia label={sol.receiptNumber} tone="info" size="sm" />}
                  <Insignia label="Entregada" tone="ok" size="sm" />
                </View>
              </View>
            </Tarjeta>
          ))}
        </View>
      )}
    </ScrollView>
  );
};