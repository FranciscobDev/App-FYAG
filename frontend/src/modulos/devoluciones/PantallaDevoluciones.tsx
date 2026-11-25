import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { OrdenDevolucion, ItemOrdenDevolucion, DevolucionProveedor } from "@/nucleo/tipos";
import {
  DevolucionServidor,
  SobranteInsumoServidor,
  declararDevolucionTecnico,
  listarMisDevoluciones,
  obtenerSobranteProyecto,
} from "./devolucionesApi";
import { estilos } from "./estilos";
import {
  SeccionDevolucionesTecnico,
  SeccionDevolucionesBodega,
  SeccionDevolucionesProveedor,
  ModalesDevoluciones,
} from "./componentes";

interface ReturnItemForm {
  id_articulo: number;
  sku: string;
  name: string;
  unit: string;
  quantityRetrieved: number;
  quantityUsed: number;
  /** Máximo devolvible calculado por el servidor (retirado − usado − ya declarado). */
  maximo: number;
  quantityReturned: number;
}

/** Convierte una devolución del servidor al modelo que usa el seguimiento. */
const aOrdenDevolucion = (d: DevolucionServidor): OrdenDevolucion => ({
  id: String(d.id_devolucion),
  code: d.codigo_devolucion ?? `DEV-${d.id_devolucion}`,
  projectId: String(d.proyecto_id),
  projectCode: d.codigo_proyecto ?? "PROJ",
  projectName: d.nombre_proyecto,
  technicianName: d.tecnico_nombre,
  technicianRut: d.tecnico_rut,
  itemsCount: d.lineas.length,
  summary: d.lineas.map((l) => `${l.cantidad_declarada} ${l.unidad} ${l.nombre_articulo}`).join(", "),
  date: d.fecha_declaracion,
  status: d.estado === "Recibida" ? "recibida" : "en_transito",
  items: d.lineas.map((l) => ({
    sku: l.sku ?? "",
    name: l.nombre_articulo,
    quantityRetrieved: l.cantidad_retirada,
    quantityUsed: l.cantidad_utilizada,
    quantityReturned: l.cantidad_declarada,
    quantityReceivedReal: l.cantidad_recibida ?? undefined,
    unit: l.unidad,
  })),
});

const aItemFormulario = (s: SobranteInsumoServidor): ReturnItemForm => ({
  id_articulo: s.id_articulo,
  sku: s.sku,
  name: s.nombre_articulo,
  unit: s.unidad,
  quantityRetrieved: s.cantidad_retirada,
  quantityUsed: s.cantidad_utilizada,
  maximo: s.cantidad_maxima_devolvible,
  quantityReturned: Math.max(0, s.cantidad_maxima_devolvible),
});

export interface PropiedadesPantallaDevoluciones {
  showHeader?: boolean;
}

export const PantallaDevoluciones: React.FC<PropiedadesPantallaDevoluciones> = ({
  showHeader = true,
}) => {
  const {
    proyectos,
    productos,
    proveedores,
    ordenesDevolucion,
    devolucionesProveedor,
    crearDevolucionTecnico,
    confirmarDevolucionBodega,
    crearDevolucionProveedor,
    resolverDevolucionProveedor,
  } = usarAplicacion();
  const { rolActual, usuario } = usarAutenticacion();
  const { width } = useWindowDimensions();

  // Tab activo según rol inicial
  const [activoPestana, establecerActivoPestana] = useState<"tecnico" | "bodega" | "proveedores">(
    rolActual === "technician" ? "tecnico" : "bodega"
  );

  // -------------------------------------------------------------
  // 1. TÉCNICO: FORMULARIO DE DEVOLUCIÓN DE SOBRANTE (datos reales del servidor)
  // -------------------------------------------------------------
  const esTecnico = rolActual === "technician";
  const activoProyectos = proyectos.filter((p) => p.status !== "cerrado");
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState(activoProyectos[0]?.id || "");
  const [sobranteProyecto, establecerSobranteProyecto] = useState<SobranteInsumoServidor[]>([]);
  const [cargandoSobrante, establecerCargandoSobrante] = useState(false);
  const [misDevoluciones, establecerMisDevoluciones] = useState<OrdenDevolucion[]>([]);
  const [retElementos, establecerRetElementos] = useState<ReturnItemForm[]>([]);
  const [retError, establecerRetError] = useState("");
  const [retExito, establecerRetExito] = useState("");

  const cargarSobrante = async (idProyecto: string) => {
    if (!idProyecto) {
      establecerSobranteProyecto([]);
      return;
    }
    establecerCargandoSobrante(true);
    const res = await obtenerSobranteProyecto(idProyecto);
    establecerCargandoSobrante(false);
    if (res.ok && res.data) {
      establecerSobranteProyecto(res.data.items);
    } else {
      establecerSobranteProyecto([]);
      establecerRetError(res.error ?? "No se pudo cargar el sobrante del proyecto");
    }
  };

  const cargarMisDevoluciones = async () => {
    const res = await listarMisDevoluciones();
    if (res.ok && res.data) {
      establecerMisDevoluciones(res.data.map(aOrdenDevolucion));
    }
  };

  // Al elegir proyecto (o al entrar), se cargan sus insumos con sobrante real y se limpia el formulario
  useEffect(() => {
    if (!esTecnico) return;
    if (!seleccionadoProyectoId && activoProyectos.length > 0) {
      establecerSeleccionadoProyectoId(activoProyectos[0].id);
      return;
    }
    establecerRetElementos([]);
    establecerRetError("");
    establecerRetExito("");
    cargarSobrante(seleccionadoProyectoId);
  }, [seleccionadoProyectoId, esTecnico, activoProyectos.length]);

  useEffect(() => {
    if (esTecnico) cargarMisDevoluciones();
  }, [esTecnico]);

  const manejarAgregarDevolucionElemento = () => {
    const agregados = new Set(retElementos.map((r) => r.id_articulo));
    const siguiente =
      sobranteProyecto.find((s) => !agregados.has(s.id_articulo) && s.cantidad_maxima_devolvible > 0) ??
      sobranteProyecto.find((s) => !agregados.has(s.id_articulo));
    if (!siguiente) {
      establecerRetError("No hay más insumos con sobrante en este proyecto.");
      return;
    }
    establecerRetError("");
    establecerRetElementos((prev) => [...prev, aItemFormulario(siguiente)]);
  };

  const manejarQuitarDevolucionElemento = (index: number) => {
    establecerRetElementos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validationErrores = retElementos.map((item) => {
    if (item.quantityReturned <= 0) {
      return "La cantidad a devolver debe ser mayor a 0.";
    }
    if (item.quantityReturned > item.maximo) {
      return `Excede el sobrante máximo (${item.maximo}).`;
    }
    return null;
  });

  const tieneFormularioErrores =
    cargandoSobrante || retElementos.length === 0 || validationErrores.some((err) => err !== null);

  const manejarGuardarTecnicoDevolucion = async () => {
    establecerRetError("");
    establecerRetExito("");

    if (tieneFormularioErrores) {
      establecerRetError("Corrija los valores antes de registrar la devolución.");
      return;
    }

    // El servidor vuelve a validar el sobrante; el formulario solo envía cantidades
    const res = await declararDevolucionTecnico(
      seleccionadoProyectoId,
      retElementos.map((i) => ({ id_articulo: i.id_articulo, cantidad_declarada: i.quantityReturned }))
    );

    if (!res.ok || !res.data) {
      establecerRetError(res.error ?? "No se pudo registrar la devolución");
      await cargarSobrante(seleccionadoProyectoId);
      return;
    }

    establecerRetExito(
      `Devolución ${res.data.devolucion.codigo_devolucion} registrada. Se encuentra 'En tránsito' hacia Bodega Central.`
    );
    establecerRetElementos([]);
    await Promise.all([cargarSobrante(seleccionadoProyectoId), cargarMisDevoluciones()]);
  };

  // -------------------------------------------------------------
  // 2. BODEGA: CONFIRMACIÓN DE CANTIDAD FÍSICA REAL
  // -------------------------------------------------------------
  const [confirmarDevolucionModal, establecerConfirmarDevolucionModal] = useState<OrdenDevolucion | null>(null);
  const [verificadoLista, establecerVerificadoLista] = useState<{ sku: string; quantityReceivedReal: number }[]>([]);
  const [discrepancyNota, establecerDiscrepancyNota] = useState("");
  const [avisoBodega, establecerAvisoBodega] = useState("");

  const manejarAbrirConfirmarDevolucion = (ret: OrdenDevolucion) => {
    establecerConfirmarDevolucionModal(ret);
    establecerVerificadoLista(
      (ret.items || []).map((i) => ({
        sku: i.sku,
        quantityReceivedReal: i.quantityReturned,
      }))
    );
    establecerDiscrepancyNota("");
  };

  const manejarEstablecerExactCoincidencia = (sku: string, declaredQty: number) => {
    establecerVerificadoLista((prev) =>
      prev.map((v) => (v.sku === sku ? { ...v, quantityReceivedReal: declaredQty } : v))
    );
  };

  const manejarConfirmarBodegaRecepcion = () => {
    if (!confirmarDevolucionModal) return;
    const codigoConfirmado = confirmarDevolucionModal.code;
    const tecnicoConfirmado = confirmarDevolucionModal.technicianName;
    confirmarDevolucionBodega(
      confirmarDevolucionModal.id,
      verificadoLista,
      discrepancyNota.trim() || undefined,
      usuario.name
    );
    establecerConfirmarDevolucionModal(null);
    establecerAvisoBodega(
      `Devolución ${codigoConfirmado} marcada como Recibida. Stock y Cardex actualizados, y estado reflejado en el móvil de ${tecnicoConfirmado}.`
    );
  };

  // -------------------------------------------------------------
  // 3. DEVOLUCIÓN A PROVEEDOR (DEFECTUOSOS EN CUARENTENA)
  // -------------------------------------------------------------
  const [nuevoProveedorDevolucionModal, establecerNuevoProveedorDevolucionModal] = useState(false);
  const [supRetProveedorId, establecerSupRetProveedorId] = useState(proveedores[0]?.id || "");
  const [supRetSku, establecerSupRetSku] = useState(productos[0]?.sku || "");
  const [supRetCantidad, establecerSupRetCantidad] = useState("1");
  const [supRetMotivo, establecerSupRetMotivo] = useState("Bobina magnética defectuosa de fábrica detectada en recepción");
  const [supRetGuia, establecerSupRetGuia] = useState("GD-2026-905");
  const [supRetError, establecerSupRetError] = useState("");
  const [avisoProveedor, establecerAvisoProveedor] = useState("");

  const [resolverDevolucionModal, establecerResolverDevolucionModal] = useState<DevolucionProveedor | null>(null);
  const [resolverTipo, establecerResolverTipo] = useState<"nota_credito" | "reemplazo_producto" | "reembolso">("nota_credito");
  const [resolverNotas, establecerResolverNotas] = useState("");

  const cuarentenaProductos = productos.filter((p) => (p.quarantine || 0) > 0);

  const manejarAbrirModalNuevaDevolucionProveedor = () => {
    establecerSupRetError("");
    if (cuarentenaProductos.length > 0) {
      establecerSupRetSku(cuarentenaProductos[0].sku);
      establecerSupRetCantidad(String(Math.min(1, cuarentenaProductos[0].quarantine || 1)));
    }
    establecerNuevoProveedorDevolucionModal(true);
  };

  const manejarGuardarProveedorDevolucion = () => {
    establecerSupRetError("");
    const seleccionadoProducto = productos.find((p) => p.sku === supRetSku);
    const cantidadNumero = Number(supRetCantidad) || 0;
    if (!supRetSku || cantidadNumero <= 0 || !supRetMotivo.trim() || !supRetGuia.trim()) {
      establecerSupRetError("Todos los campos y el N° de Guía de Despacho son requeridos.");
      return;
    }
    if ((seleccionadoProducto?.quarantine || 0) < cantidadNumero) {
      establecerSupRetError(
        `No puede devolver más cantidad de la que existe en cuarentena (${seleccionadoProducto?.quarantine || 0} ${seleccionadoProducto?.unit || "un"}).`
      );
      return;
    }
    crearDevolucionProveedor(
      supRetProveedorId,
      supRetSku,
      cantidadNumero,
      supRetMotivo.trim(),
      supRetGuia.trim()
    );
    establecerNuevoProveedorDevolucionModal(false);
    establecerAvisoProveedor(
      `Devolución emitida con Guía N° ${supRetGuia.trim()}. Quedó en estado Pendiente de resolución para seguimiento del Administrador.`
    );
  };

  const manejarConfirmarResolution = () => {
    if (!resolverDevolucionModal) return;
    const codigoCerrado = resolverDevolucionModal.code;
    const viaTexto =
      resolverTipo === "nota_credito"
        ? "Nota de Crédito"
        : resolverTipo === "reemplazo_producto"
        ? "Reposición de Producto (stock reingresado al Cardex)"
        : "Reembolso";
    resolverDevolucionProveedor(
      resolverDevolucionModal.id,
      resolverTipo,
      resolverNotas.trim() || "Resolución formal registrada por Administración."
    );
    establecerResolverDevolucionModal(null);
    establecerAvisoProveedor(
      `Devolución ${codigoCerrado} cambiada a estado Resuelta mediante ${viaTexto}.`
    );
  };

  // Filtrado de búsquedas
  const [transitBuscar, establecerTransitBuscar] = useState("");
  const ordenesSeguimiento = esTecnico ? misDevoluciones : ordenesDevolucion;
  const filtradoTransitDevoluciones = ordenesSeguimiento.filter((r) => {
    const q = transitBuscar.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.technicianName.toLowerCase().includes(q)
    );
  });

  const inTransitConteo = ordenesSeguimiento.filter((r) => r.status === "en_transito").length;
  const proveedorPendienteConteo = devolucionesProveedor.filter((s) => s.status === "pendiente_resolucion").length;

  const pestanas =
    rolActual === "technician"
      ? [
          {
            id: "tecnico" as const,
            title: "Declarar Sobrante",
            icon: "create-outline",
            badge: undefined,
            badgeTone: "neutral",
          },
          {
            id: "bodega" as const,
            title: "Seguimiento en Tránsito",
            icon: "car-outline",
            badge: inTransitConteo > 0 ? String(inTransitConteo) : undefined,
            badgeTone: inTransitConteo > 0 ? "warn" : "neutral",
          },
        ]
      : [
          {
            id: "bodega" as const,
            title: "Retornos de Obra",
            icon: "cube-outline",
            badge: inTransitConteo > 0 ? String(inTransitConteo) : undefined,
            badgeTone: inTransitConteo > 0 ? "warn" : "neutral",
          },
          {
            id: "proveedores" as const,
            title: "Garantías a Proveedor",
            icon: "alert-circle-outline",
            badge: proveedorPendienteConteo > 0 ? String(proveedorPendienteConteo) : undefined,
            badgeTone: proveedorPendienteConteo > 0 ? "danger" : "neutral",
          },
          {
            id: "tecnico" as const,
            title: "Registrar Sobrante",
            icon: "calculator-outline",
            badge: undefined,
            badgeTone: "neutral",
          },
        ];

  return (
    <ContenedorEstadoPantalla screenTitle="Devoluciones de Stock" skeletonType="cards">
      <View style={estilos.contenedor}>
        {showHeader && (
          <EncabezadoPagina
            title="Devoluciones de Stock"
            subtitle="Reingreso físico de sobrantes de obra en Cardex y gestión de garantías con proveedores"
          />
        )}

        {/* BARRA ÚNICA DE PESTAÑAS LIMPIA (Sin barra duplicada de Paso 1, 2, 3) */}
        <View style={estilos.pestanaBarraEnvoltorio}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.pestanaBarraScroll}
          >
            {pestanas.map((tab) => {
              const esActivo = activoPestana === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[estilos.pestanaElemento, esActivo && estilos.pestanaElementoActivo]}
                  onPress={() => establecerActivoPestana(tab.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={esActivo ? tema.colors.primary : tema.colors.textMuted}
                  />
                  <Text style={[estilos.pestanaEtiqueta, esActivo && estilos.pestanaEtiquetaActivo]}>
                    {tab.title}
                  </Text>
                  {Boolean(tab.badge) && (
                    <Insignia
                      label={tab.badge!}
                      tone={tab.badgeTone as any}
                      size="sm"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <SeccionDevolucionesTecnico
          activoPestana={activoPestana}
          activoProyectos={activoProyectos}
          establecerRetElementos={establecerRetElementos}
          establecerSeleccionadoProyectoId={establecerSeleccionadoProyectoId}
          manejarAgregarDevolucionElemento={manejarAgregarDevolucionElemento}
          manejarGuardarTecnicoDevolucion={manejarGuardarTecnicoDevolucion}
          manejarQuitarDevolucionElemento={manejarQuitarDevolucionElemento}
          ordenesDevolucion={misDevoluciones}
          productos={productos}
          retElementos={retElementos}
          retError={retError}
          retExito={retExito}
          seleccionadoProyectoId={seleccionadoProyectoId}
          tieneFormularioErrores={tieneFormularioErrores}
          width={width}
        />

        <SeccionDevolucionesBodega
          activoPestana={activoPestana}
          avisoBodega={avisoBodega}
          establecerTransitBuscar={establecerTransitBuscar}
          filtradoTransitDevoluciones={filtradoTransitDevoluciones}
          inTransitConteo={inTransitConteo}
          manejarAbrirConfirmarDevolucion={manejarAbrirConfirmarDevolucion}
          onCerrarAvisoBodega={() => establecerAvisoBodega("")}
          transitBuscar={transitBuscar}
        />

        <SeccionDevolucionesProveedor
          activoPestana={activoPestana}
          avisoProveedor={avisoProveedor}
          cuarentenaConteo={cuarentenaProductos.length}
          devolucionesProveedor={devolucionesProveedor}
          establecerNuevoProveedorDevolucionModal={establecerNuevoProveedorDevolucionModal}
          establecerResolverDevolucionModal={establecerResolverDevolucionModal}
          establecerResolverNotas={establecerResolverNotas}
          establecerResolverTipo={establecerResolverTipo}
          establecerSupRetError={establecerSupRetError}
          onAbrirModalNuevaDevolucion={manejarAbrirModalNuevaDevolucionProveedor}
          onCerrarAvisoProveedor={() => establecerAvisoProveedor("")}
          rolActual={rolActual}
          width={width}
        />

        <ModalesDevoluciones
          confirmarDevolucionModal={confirmarDevolucionModal}
          cuarentenaProductos={cuarentenaProductos}
          discrepancyNota={discrepancyNota}
          establecerConfirmarDevolucionModal={establecerConfirmarDevolucionModal}
          establecerDiscrepancyNota={establecerDiscrepancyNota}
          establecerNuevoProveedorDevolucionModal={establecerNuevoProveedorDevolucionModal}
          establecerResolverDevolucionModal={establecerResolverDevolucionModal}
          establecerResolverNotas={establecerResolverNotas}
          establecerResolverTipo={establecerResolverTipo}
          establecerSupRetCantidad={establecerSupRetCantidad}
          establecerSupRetGuia={establecerSupRetGuia}
          establecerSupRetMotivo={establecerSupRetMotivo}
          establecerSupRetProveedorId={establecerSupRetProveedorId}
          establecerSupRetSku={establecerSupRetSku}
          establecerVerificadoLista={establecerVerificadoLista}
          manejarConfirmarBodegaRecepcion={manejarConfirmarBodegaRecepcion}
          manejarConfirmarResolution={manejarConfirmarResolution}
          manejarEstablecerExactCoincidencia={manejarEstablecerExactCoincidencia}
          manejarGuardarProveedorDevolucion={manejarGuardarProveedorDevolucion}
          nuevoProveedorDevolucionModal={nuevoProveedorDevolucionModal}
          proveedores={proveedores}
          resolverDevolucionModal={resolverDevolucionModal}
          resolverNotas={resolverNotas}
          resolverTipo={resolverTipo}
          supRetCantidad={supRetCantidad}
          supRetError={supRetError}
          supRetGuia={supRetGuia}
          supRetMotivo={supRetMotivo}
          supRetProveedorId={supRetProveedorId}
          supRetSku={supRetSku}
          verificadoLista={verificadoLista}
        />
      </View>
    </ContenedorEstadoPantalla>
  );
};
