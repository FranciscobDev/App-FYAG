import React, { useState } from "react";
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
import { estilos } from "./estilos";
import {
  SeccionDevolucionesTecnico,
  SeccionDevolucionesBodega,
  SeccionDevolucionesProveedor,
  ModalesDevoluciones,
} from "./componentes";

interface ReturnItemForm {
  sku: string;
  quantityRetrieved: number;
  quantityUsed: number;
  quantityReturned: number;
}

export const PantallaDevoluciones: React.FC = () => {
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
  // 1. TÉCNICO: FORMULARIO DE DEVOLUCIÓN DE SOBRANTE
  // -------------------------------------------------------------
  const activoProyectos = proyectos.filter((p) => p.status !== "cerrado");
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState(activoProyectos[0]?.id || "");
  const [retElementos, establecerRetElementos] = useState<ReturnItemForm[]>([
    {
      sku: productos[0]?.sku || "GAS-TUB-0020",
      quantityRetrieved: 10,
      quantityUsed: 6,
      quantityReturned: 4,
    },
  ]);
  const [retError, establecerRetError] = useState("");
  const [retExito, establecerRetExito] = useState("");

  const manejarAgregarDevolucionElemento = () => {
    const disponibleProducto = productos.find((p) => !retElementos.some((ri) => ri.sku === p.sku)) || productos[0];
    if (disponibleProducto) {
      establecerRetElementos((prev) => [
        ...prev,
        {
          sku: disponibleProducto.sku,
          quantityRetrieved: 5,
          quantityUsed: 3,
          quantityReturned: 2,
        },
      ]);
    }
  };

  const manejarQuitarDevolucionElemento = (index: number) => {
    if (retElementos.length > 1) {
      establecerRetElementos((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const validationErrores = retElementos.map((item) => {
    const maximoAllowed = Math.max(0, item.quantityRetrieved - item.quantityUsed);
    if (item.quantityReturned > maximoAllowed) {
      return `Excede el sobrante máximo (${maximoAllowed}).`;
    }
    if (item.quantityReturned <= 0) {
      return `La cantidad a devolver debe ser mayor a 0.`;
    }
    return null;
  });

  const tieneFormularioErrores = validationErrores.some((err) => err !== null);

  const manejarGuardarTecnicoDevolucion = () => {
    establecerRetError("");
    establecerRetExito("");

    if (tieneFormularioErrores) {
      establecerRetError("Corrija los valores antes de registrar la devolución.");
      return;
    }

    const elementosHastaEnviar: ItemOrdenDevolucion[] = retElementos.map((i) => {
      const p = productos.find((prod) => prod.sku === i.sku);
      return {
        sku: i.sku,
        name: p ? p.name : i.sku,
        quantityRetrieved: i.quantityRetrieved,
        quantityUsed: i.quantityUsed,
        quantityReturned: i.quantityReturned,
        unit: p ? p.unit : "un",
      };
    });

    const resultado = crearDevolucionTecnico(
      seleccionadoProyectoId,
      usuario.rut,
      usuario.name,
      elementosHastaEnviar
    );

    if (!resultado.success) {
      establecerRetError(resultado.error || "Error al registrar la devolución.");
    } else {
      establecerRetExito("Devolución registrada exitosamente. Se encuentra 'En tránsito' hacia Bodega Central.");
      establecerRetElementos([
        {
          sku: productos[1]?.sku || "ELE-CBL-0012",
          quantityRetrieved: 15,
          quantityUsed: 10,
          quantityReturned: 5,
        },
      ]);
    }
  };

  // -------------------------------------------------------------
  // 2. BODEGA: CONFIRMACIÓN DE CANTIDAD FÍSICA REAL
  // -------------------------------------------------------------
  const [confirmarDevolucionModal, establecerConfirmarDevolucionModal] = useState<OrdenDevolucion | null>(null);
  const [verificadoLista, establecerVerificadoLista] = useState<{ sku: string; quantityReceivedReal: number }[]>([]);
  const [discrepancyNota, establecerDiscrepancyNota] = useState("");

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
    confirmarDevolucionBodega(
      confirmarDevolucionModal.id,
      verificadoLista,
      discrepancyNota.trim() || undefined,
      usuario.name
    );
    establecerConfirmarDevolucionModal(null);
  };

  // -------------------------------------------------------------
  // 3. DEVOLUCIÓN A PROVEEDOR (DEFECTUOSOS EN CUARENTENA)
  // -------------------------------------------------------------
  const [nuevoProveedorDevolucionModal, establecerNuevoProveedorDevolucionModal] = useState(false);
  const [supRetProveedorId, establecerSupRetProveedorId] = useState(proveedores[0]?.id || "");
  const [supRetSku, establecerSupRetSku] = useState(productos[0]?.sku || "");
  const [supRetCantidad, establecerSupRetCantidad] = useState("5");
  const [supRetMotivo, establecerSupRetMotivo] = useState("Bobina magnética defectuosa de fábrica detectada en recepción");
  const [supRetGuia, establecerSupRetGuia] = useState("GD-2026-905");
  const [supRetError, establecerSupRetError] = useState("");

  const [resolverDevolucionModal, establecerResolverDevolucionModal] = useState<DevolucionProveedor | null>(null);
  const [resolverTipo, establecerResolverTipo] = useState<"nota_credito" | "reemplazo_producto" | "reembolso">("nota_credito");
  const [resolverNotas, establecerResolverNotas] = useState("");

  const cuarentenaProductos = productos.filter((p) => (p.quarantine || 0) > 0);

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
  };

  const manejarConfirmarResolution = () => {
    if (!resolverDevolucionModal) return;
    resolverDevolucionProveedor(
      resolverDevolucionModal.id,
      resolverTipo,
      resolverNotas.trim() || "Resolución formal registrada por el proveedor."
    );
    establecerResolverDevolucionModal(null);
  };

  // Filtrado de búsquedas
  const [transitBuscar, establecerTransitBuscar] = useState("");
  const filtradoTransitDevoluciones = ordenesDevolucion.filter((r) => {
    const q = transitBuscar.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.technicianName.toLowerCase().includes(q)
    );
  });

  const inTransitConteo = ordenesDevolucion.filter((r) => r.status === "en_transito").length;
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
        <EncabezadoPagina
          title="Devoluciones de Stock"
          subtitle="Reingreso físico de sobrantes de obra en Cardex y gestión de garantías con proveedores"
        />

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
          ordenesDevolucion={ordenesDevolucion}
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
          establecerTransitBuscar={establecerTransitBuscar}
          filtradoTransitDevoluciones={filtradoTransitDevoluciones}
          inTransitConteo={inTransitConteo}
          manejarAbrirConfirmarDevolucion={manejarAbrirConfirmarDevolucion}
          transitBuscar={transitBuscar}
        />

        <SeccionDevolucionesProveedor
          activoPestana={activoPestana}
          devolucionesProveedor={devolucionesProveedor}
          establecerNuevoProveedorDevolucionModal={establecerNuevoProveedorDevolucionModal}
          establecerResolverDevolucionModal={establecerResolverDevolucionModal}
          establecerResolverNotas={establecerResolverNotas}
          establecerResolverTipo={establecerResolverTipo}
          establecerSupRetError={establecerSupRetError}
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
