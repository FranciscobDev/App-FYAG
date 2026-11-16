import React, { useState, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { ItemSolicitudMaterial, Producto } from "@/nucleo/tipos";

interface TechnicianMaterialsViewProps {
  initialProjectId?: string;
  onNavigateTab?: (tab: string, subTab?: "avance" | "horas" | "sobrante") => void;
  isOffline?: boolean;
}

interface ItemSolicitudLocal {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  stockBodega: number;
}

export const VistaMaterialesTecnico: React.FC<TechnicianMaterialsViewProps> = ({
  initialProjectId,
  onNavigateTab,
  isOffline = false,
}) => {
  const { proyectos, productos, solicitudesMaterial, crearSolicitudMaterial } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  // Filtrar proyectos asignados activos
  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    initialProjectId || activoProyectos[0]?.id || ""
  );

  // Fecha y hora de última sincronización
  const [lastSincronizacionTiempo, establecerLastSincronizacionTiempo] = useState<string>("14-10-2026 09:30 h");
  const [esRefreshing, establecerEsRefreshing] = useState(false);

  // Estados para Modal de Solicitud de Materiales
  const [modalSolicitudVisible, establecerModalSolicitudVisible] = useState(false);
  const [solicitudUrgencia, establecerSolicitudUrgencia] = useState<"normal" | "alta" | "urgente">("normal");
  const [solicitudComentario, establecerSolicitudComentario] = useState("");
  const [solicitudItems, establecerSolicitudItems] = useState<ItemSolicitudLocal[]>([]);
  const [solicitudError, establecerSolicitudError] = useState("");
  const [enviandoSolicitud, establecerEnviandoSolicitud] = useState(false);
  const [notificacionExito, establecerNotificacionExito] = useState("");
  const [busquedaCatalogo, establecerBusquedaCatalogo] = useState("");
  const [mostrarCatalogoDesplegable, establecerMostrarCatalogoDesplegable] = useState(false);

  const manejarRefreshSincronizacion = () => {
    establecerEsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      const fechaPart = now.toISOString().slice(0, 10);
      const tiempoPart = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} h`;
      establecerLastSincronizacionTiempo(`${fechaPart} ${tiempoPart}`);
      establecerEsRefreshing(false);
    }, 600);
  };

  const actualProyecto = activoProyectos.find((p) => p.id === seleccionadoProyectoId) || activoProyectos[0];

  // Insumos del proyecto basados en despachos reales
  const asignadoElementos = useMemo(() => {
    if (!actualProyecto) return [];

    const despachos = actualProyecto.dispatches || [];
    const retiradoBySku: Record<string, { qty: number; name: string; unit: string; pmp: number }> = {};
    despachos.forEach((d) => {
      if (!retiradoBySku[d.sku]) {
        retiradoBySku[d.sku] = { qty: 0, name: d.productName, unit: d.unit, pmp: d.unitCost };
      }
      retiradoBySku[d.sku].qty += d.quantity;
    });

    const skusConDespacho = Object.keys(retiradoBySku);
    if (skusConDespacho.length > 0) {
      return skusConDespacho.map((sku) => {
        const prod = productos.find((p) => p.sku === sku);
        const ret = retiradoBySku[sku];
        const assigned = Math.max(ret.qty, Math.round(ret.qty * 1.25));
        const pendiente = Math.max(0, assigned - ret.qty);
        const fulfillmentPorcentaje = Math.min(100, Math.round((ret.qty / assigned) * 100));

        return {
          sku,
          name: ret.name || prod?.name || sku,
          unit: ret.unit || prod?.unit || "un",
          quantityAssigned: assigned,
          quantityRetrieved: ret.qty,
          quantityPending: pendiente,
          fulfillmentPct: fulfillmentPorcentaje,
        };
      });
    }

    return [];
  }, [actualProyecto, productos]);

  const totalAsignado = asignadoElementos.reduce((acc, i) => acc + i.quantityAssigned, 0);
  const totalRetirado = asignadoElementos.reduce((acc, i) => acc + i.quantityRetrieved, 0);
  const totalPendiente = asignadoElementos.reduce((acc, i) => acc + i.quantityPending, 0);

  // Solicitudes realizadas para este proyecto
  const solicitudesProyecto = useMemo(() => {
    if (!actualProyecto) return [];
    return solicitudesMaterial.filter((s) => s.projectId === actualProyecto.id);
  }, [solicitudesMaterial, actualProyecto]);

  // Manejo de Modal de Solicitud
  const abrirModalSolicitud = () => {
    establecerSolicitudError("");
    establecerSolicitudUrgencia("normal");
    establecerSolicitudComentario("");
    establecerBusquedaCatalogo("");
    establecerMostrarCatalogoDesplegable(false);

    // Sugerir el primer insumo disponible del catálogo
    const prodDisponible = productos.find((p) => p.stock > 0) || productos[0];
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
      prev.map((item) => {
        if (item.sku === sku) {
          const nuevaCant = Math.max(1, item.quantity + delta);
          return { ...item, quantity: nuevaCant };
        }
        return item;
      })
    );
  };

  const manejarEstablecerCantidad = (sku: string, val: string) => {
    const num = parseInt(val, 10);
    establecerSolicitudItems((prev) =>
      prev.map((item) => {
        if (item.sku === sku) {
          return { ...item, quantity: isNaN(num) || num < 1 ? 1 : num };
        }
        return item;
      })
    );
  };

  const manejarEliminarItem = (sku: string) => {
    establecerSolicitudItems((prev) => prev.filter((i) => i.sku !== sku));
  };

  const manejarAgregarProducto = (prod: Producto) => {
    if (solicitudItems.some((i) => i.sku === prod.sku)) {
      return;
    }
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
      .filter((p) => !solicitudItems.some((i) => i.sku === p.sku))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [productos, solicitudItems, busquedaCatalogo]);

  const manejarEnviarSolicitud = () => {
    if (!actualProyecto) {
      establecerSolicitudError("Debe seleccionar un proyecto válido.");
      return;
    }
    if (solicitudItems.length === 0) {
      establecerSolicitudError("Debe agregar al menos un insumo a la solicitud.");
      return;
    }

    // Validar stock insuficiente en bodega
    const itemsFaltantes = solicitudItems.filter((i) => i.quantity > i.stockBodega);
    if (itemsFaltantes.length > 0) {
      establecerSolicitudError(
        `Stock insuficiente en bodega para: ${itemsFaltantes.map((i) => `${i.name} (quedan ${i.stockBodega} ${i.unit})`).join(", ")}`
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

    const res = crearSolicitudMaterial(
      actualProyecto.id,
      usuario.rut,
      itemsHastaEnviar,
      solicitudUrgencia,
      solicitudComentario.trim() || undefined
    );

    establecerEnviandoSolicitud(false);

    if (!res.success) {
      establecerSolicitudError(res.error || "No se pudo procesar la solicitud.");
    } else {
      establecerModalSolicitudVisible(false);
      establecerNotificacionExito(
        `✓ Solicitud de materiales enviada exitosamente para ${actualProyecto.code}. Estado: Pendiente de despacho por Bodega.`
      );
      establecerSolicitudItems([]);
      establecerSolicitudComentario("");
      establecerSolicitudUrgencia("normal");
      establecerBusquedaCatalogo("");
    }
  };

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {/* ALERTA DE ÉXITO TRAS ENVIAR SOLICITUD */}
      {Boolean(notificacionExito) && (
        <View style={estilos.alertaExito}>
          <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} style={{ marginRight: 8 }} />
          <Text style={estilos.alertaExitoTexto}>{notificacionExito}</Text>
          <TouchableOpacity onPress={() => establecerNotificacionExito("")} style={{ padding: 4 }}>
            <Ionicons name="close" size={18} color={tema.colors.ok} />
          </TouchableOpacity>
        </View>
      )}

      {/* 1. SELECTOR DE PROYECTO ASIGNADO */}
      <Text style={estilos.seccionEtiqueta}>Seleccionar Faena Asignada:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.proyectosScroll}>
        {activoProyectos.map((p) => {
          const esSeleccionado = p.id === actualProyecto?.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => establecerSeleccionadoProyectoId(p.id)}
              style={[estilos.proyectoChip, esSeleccionado && estilos.proyectoChipActivo]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="business-outline"
                size={14}
                color={esSeleccionado ? "#ffffff" : tema.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[estilos.proyectoChipTexto, esSeleccionado && estilos.proyectoChipTextoActivo]}>
                {p.code} - {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. ETIQUETA DE ÚLTIMA SINCRONIZACIÓN */}
      <View style={estilos.sincronizacionTarjeta}>
        <View style={estilos.sincronizacionIzquierda}>
          <Ionicons
            name={isOffline ? "cloud-offline-outline" : "sync-circle-outline"}
            size={20}
            color={isOffline ? tema.colors.warnDark : tema.colors.primary}
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={estilos.sincronizacionTitulo}>
              {isOffline ? "Modo Offline (Caché local)" : "Insumos Asignados a la Obra"}
            </Text>
            <Text style={estilos.sincronizacionTimestamp}>
              Última sincronización: <Text style={{ fontWeight: "bold" }}>{lastSincronizacionTiempo}</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={manejarRefreshSincronizacion}
          style={estilos.refreshBoton}
          disabled={esRefreshing}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={tema.colors.primary}
            style={esRefreshing ? { transform: [{ rotate: "45deg" }] } : undefined}
          />
          <Text style={estilos.refreshBotonTexto}>{esRefreshing ? "..." : "Actualizar"}</Text>
        </TouchableOpacity>
      </View>

      {/* 3. RESUMEN GLOBAL DEL PROYECTO */}
      {actualProyecto && (
        <Tarjeta variant="elevated" style={estilos.resumenTarjeta}>
          <View style={estilos.resumenEncabezado}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={estilos.proyectoNombre}>{actualProyecto.name}</Text>
              <Text style={estilos.proyectoCliente}>Cliente: {actualProyecto.client} • {actualProyecto.code}</Text>
            </View>
            <Insignia label={actualProyecto.kind.toUpperCase()} tone="info" size="sm" />
          </View>

          {/* Tres cajas de métricas: Asignada, Retirada, Pendiente */}
          <View style={estilos.metricsFila}>
            <View style={estilos.metricCaja}>
              <Text style={estilos.metricValor}>{totalAsignado}</Text>
              <Text style={estilos.metricLbl}>Total Asignado</Text>
            </View>

            <View style={[estilos.metricCaja, { backgroundColor: tema.colors.primaryLight }]}>
              <Text style={[estilos.metricValor, { color: tema.colors.primaryDark }]}>{totalRetirado}</Text>
              <Text style={[estilos.metricLbl, { color: tema.colors.primaryDark }]}>Ya Retirado</Text>
            </View>

            <View style={[estilos.metricCaja, { backgroundColor: tema.colors.warnLight }]}>
              <Text style={[estilos.metricValor, { color: tema.colors.warnDark }]}>{totalPendiente}</Text>
              <Text style={[estilos.metricLbl, { color: tema.colors.warnDark }]}>Pendiente</Text>
            </View>
          </View>

          {/* Barra de progreso de abastecimiento */}
          <View style={estilos.supplyProgresoCaja}>
            <View style={estilos.supplyEncabezado}>
              <Text style={estilos.supplyEtiqueta}>Abastecimiento de faena</Text>
              <Text style={estilos.supplyPorcentaje}>
                {Math.round((totalRetirado / (totalAsignado || 1)) * 100)}% retirado
              </Text>
            </View>
            <BarraProgreso
              value={totalRetirado}
              max={totalAsignado}
              height={8}
              color={tema.colors.ok}
            />
          </View>
        </Tarjeta>
      )}

      {/* 4. LISTADO DETALLADO DE INSUMOS POR PROYECTO */}
      <Text style={estilos.listaEncabezado}>Detalle de Insumos (Asignado vs Retirado):</Text>

      {asignadoElementos.length === 0 ? (
        <EstadoVacio
          icon="cube-outline"
          title="Sin insumos asignados"
          description="Este proyecto no registra insumos asignados ni pendientes en faena."
          actionTitle="Solicitar Insumos a Bodega"
          onAction={abrirModalSolicitud}
          containerStyle={{ marginVertical: 16 }}
        />
      ) : (
        asignadoElementos.map((item) => (
          <Tarjeta key={item.sku} variant="default" style={estilos.elementoTarjeta}>
            <View style={estilos.elementoSuperiorFila}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.elementoNombre}>{item.name}</Text>
                <Text style={estilos.elementoSku}>SKU: {item.sku} • Unidad: {item.unit}</Text>
              </View>
              <Insignia
                label={item.quantityPending === 0 ? "Completado" : `Faltan ${item.quantityPending} ${item.unit}`}
                tone={item.quantityPending === 0 ? "ok" : "warn"}
                size="sm"
              />
            </View>

            {/* Fila de 3 columnas para cada insumo */}
            <View style={estilos.elementoMetricsFila}>
              <View style={estilos.elementoColumna}>
                <Text style={estilos.elementoColumnaValor}>{item.quantityAssigned} {item.unit}</Text>
                <Text style={estilos.elementoColumnaLbl}>1. Asignado</Text>
              </View>

              <View style={estilos.elementoColumna}>
                <Text style={[estilos.elementoColumnaValor, { color: tema.colors.primaryDark }]}>
                  {item.quantityRetrieved} {item.unit}
                </Text>
                <Text style={estilos.elementoColumnaLbl}>2. Retirado</Text>
              </View>

              <View style={estilos.elementoColumna}>
                <Text style={[estilos.elementoColumnaValor, item.quantityPending > 0 ? { color: tema.colors.warnDark } : {}]}>
                  {item.quantityPending} {item.unit}
                </Text>
                <Text style={estilos.elementoColumnaLbl}>3. Pendiente</Text>
              </View>
            </View>

            {/* Barra individual de cumplimiento */}
            <View style={{ marginTop: 8 }}>
              <BarraProgreso
                value={item.quantityRetrieved}
                max={item.quantityAssigned}
                height={5}
                color={item.quantityPending === 0 ? tema.colors.ok : tema.colors.primary}
              />
            </View>
          </Tarjeta>
        ))
      )}

      {/* 5. HISTORIAL DE SOLICITUDES A BODEGA */}
      <View style={{ marginTop: 18, marginBottom: 8 }}>
        <View style={estilos.seccionTituloConInsignia}>
          <Text style={estilos.listaEncabezado}>Solicitudes Enviadas a Bodega:</Text>
          {solicitudesProyecto.length > 0 && (
            <Insignia
              label={`${solicitudesProyecto.length} ${solicitudesProyecto.length === 1 ? "solicitud" : "solicitudes"}`}
              tone="info"
              size="sm"
            />
          )}
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
              pendiente: { label: "Pendiente Bodega", tone: "warn" as const, icon: "time-outline" },
              aprobada: { label: "Aprobada", tone: "info" as const, icon: "checkmark-circle-outline" },
              entregada: { label: "Despachada", tone: "ok" as const, icon: "cube-outline" },
              rechazada: { label: "Rechazada", tone: "danger" as const, icon: "close-circle-outline" },
            }[req.status] || { label: req.status, tone: "info" as const, icon: "information-circle-outline" };

            const urgenciaConfig = {
              urgente: { label: "URGENTE", color: tema.colors.danger },
              alta: { label: "ALTA", color: tema.colors.warnDark },
              normal: { label: "NORMAL", color: tema.colors.textMuted },
            }[req.urgency] || { label: req.urgency, color: tema.colors.textMuted };

            return (
              <Tarjeta key={req.id} variant="default" style={estilos.solicitudTarjeta}>
                <View style={estilos.solicitudEncabezado}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name={estadoConfig.icon as any} size={16} color={tema.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={estilos.solicitudCodigo}>{req.code}</Text>
                    <Text style={[estilos.solicitudUrgenciaTag, { color: urgenciaConfig.color }]}>
                      • {urgenciaConfig.label}
                    </Text>
                  </View>
                  <Insignia label={estadoConfig.label} tone={estadoConfig.tone} size="sm" />
                </View>

                <Text style={estilos.solicitudFecha}>Fecha: {req.date} • Técnico: {req.technicianName}</Text>

                <View style={estilos.solicitudItemsList}>
                  {req.items.map((it, idx) => (
                    <Text key={idx} style={estilos.solicitudItemTexto}>
                      • <Text style={{ fontWeight: "600" }}>{it.quantity} {it.unit}</Text> - {it.name}
                    </Text>
                  ))}
                </View>

                {req.comment ? (
                  <Text style={estilos.solicitudNota}>Nota: "{req.comment}"</Text>
                ) : null}

                {req.status === "rechazada" && req.rejectionReason && (
                  <View style={estilos.solicitudRechazoCaja}>
                    <Ionicons name="alert-circle" size={14} color={tema.colors.danger} />
                    <Text style={estilos.solicitudRechazoTexto}>Motivo: {req.rejectionReason}</Text>
                  </View>
                )}
              </Tarjeta>
            );
          })
        )}
      </View>

      {/* 6. BOTONES DE ACCIÓN RÁPIDA (PEDIR / DEVOLVER) */}
      <View style={estilos.inferiorAcciones}>
        <Boton
          title="Devolver Sobrante"
          variant="outline"
          size="md"
          icon="return-down-back-outline"
          onPress={() => onNavigateTab && onNavigateTab("registrar", "sobrante")}
          style={{ flex: 1, marginRight: 8, height: 46, borderColor: tema.colors.transit }}
          textStyle={{ color: tema.colors.transit }}
        />
        <Boton
          title="Pedir Más Insumos"
          variant="primary"
          size="md"
          icon="cart-outline"
          onPress={abrirModalSolicitud}
          style={{ flex: 1, height: 46 }}
        />
      </View>

      {/* ========================================================================= */}
      {/* MODAL: SOLICITAR INSUMOS A BODEGA                                         */}
      {/* ========================================================================= */}
      <VistaModal
        visible={modalSolicitudVisible}
        onClose={() => establecerModalSolicitudVisible(false)}
        title="Solicitar Insumos a Bodega"
        subtitle={`Faena: ${actualProyecto?.code || ""} - ${actualProyecto?.name || ""}`}
        maxWidth={520}
      >
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {/* NIVEL DE URGENCIA */}
          <Text style={estilos.modalCampoTitulo}>Nivel de Prioridad / Urgencia:</Text>
          <View style={estilos.urgenciaSelectorFila}>
            {(
              [
                { id: "normal", label: "Normal (Rutina)", icon: "checkmark-circle-outline", color: tema.colors.primary },
                { id: "alta", label: "Alta (Prioritaria)", icon: "alert-circle-outline", color: tema.colors.warnDark },
                { id: "urgente", label: "Urgente (Faena Detenida)", icon: "flame-outline", color: tema.colors.danger },
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
                  <Ionicons name={opt.icon} size={16} color={activo ? opt.color : tema.colors.textMuted} />
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

          {/* LISTA DE INSUMOS SELECCIONADOS */}
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
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={estilos.modalItemNombre}>{it.name}</Text>
                    <Text style={estilos.modalItemSku}>
                      SKU: {it.sku} • Unidad: {it.unit}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                      <Text
                        style={[
                          estilos.modalItemStock,
                          !stockSuficiente && { color: tema.colors.danger, fontWeight: "bold" },
                        ]}
                      >
                        En Bodega: {it.stockBodega} {it.unit} disponibles
                      </Text>
                      {!stockSuficiente && (
                        <TouchableOpacity
                          onPress={() => manejarEstablecerCantidad(it.sku, String(it.stockBodega))}
                          style={estilos.ajustarStockBoton}
                        >
                          <Text style={estilos.ajustarStockBotonTexto}>Ajustar a {it.stockBodega}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Stepper Cantidad */}
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
                        !stockSuficiente && { borderColor: tema.colors.danger, color: tema.colors.danger },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => manejarCambiarCantidad(it.sku, 1)}
                      style={estilos.stepperBoton}
                    >
                      <Ionicons name="add" size={16} color={tema.colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Eliminar ítem */}
                  <TouchableOpacity
                    onPress={() => manejarEliminarItem(it.sku)}
                    style={estilos.eliminarItemBoton}
                  >
                    <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {/* AGREGAR OTRO INSUMO DEL CATÁLOGO */}
          <View style={estilos.agregarInsumoSeccion}>
            <TouchableOpacity
              onPress={() => establecerMostrarCatalogoDesplegable(!mostrarCatalogoDesplegable)}
              style={estilos.toggleCatalogoBoton}
            >
              <Ionicons
                name={mostrarCatalogoDesplegable ? "chevron-up-circle-outline" : "add-circle-outline"}
                size={18}
                color={tema.colors.primary}
              />
              <Text style={estilos.toggleCatalogoBotonTexto}>
                {mostrarCatalogoDesplegable ? "Ocultar buscador de insumos" : "+ Añadir otro insumo del catálogo"}
              </Text>
            </TouchableOpacity>

            {mostrarCatalogoDesplegable && (
              <View style={estilos.catalogoDesplegableCaja}>
                <TextInput
                  value={busquedaCatalogo}
                  onChangeText={establecerBusquedaCatalogo}
                  placeholder="Buscar insumo por nombre o SKU..."
                  style={estilos.busquedaCatalogoEntrada}
                />
                <View style={estilos.catalogoListaScroll}>
                  {productosFiltradosParaAgregar.length === 0 ? (
                    <Text style={estilos.sinResultadosTexto}>No se encontraron insumos disponibles.</Text>
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

          {/* JUSTIFICACIÓN / NOTA */}
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

          {/* ERROR DISPLAY */}
          {Boolean(solicitudError) && (
            <View style={estilos.errorCaja}>
              <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
              <Text style={estilos.errorTexto}>{solicitudError}</Text>
            </View>
          )}

          {/* BOTONES MODAL */}
          <View style={estilos.modalAccionesFila}>
            <Boton
              title="Cancelar"
              variant="ghost"
              size="md"
              onPress={() => establecerModalSolicitudVisible(false)}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Boton
              title={enviandoSolicitud ? "Enviando..." : "Enviar a Bodega"}
              variant="primary"
              size="md"
              icon="send-outline"
              disabled={enviandoSolicitud || solicitudItems.length === 0}
              onPress={manejarEnviarSolicitud}
              style={{ flex: 1.4 }}
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
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  alertaExito: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  alertaExitoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
  },
  seccionEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  proyectosScroll: {
    marginBottom: tema.spacing.md,
  },
  proyectoChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
    minHeight: 40,
  },
  proyectoChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  proyectoChipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    fontWeight: "600",
  },
  proyectoChipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  sincronizacionTarjeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: tema.spacing.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  sincronizacionIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sincronizacionTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  sincronizacionTimestamp: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  refreshBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.primaryLight,
  },
  refreshBotonTexto: {
    fontSize: 11,
    color: tema.colors.primaryDark,
    fontWeight: "bold",
    marginLeft: 4,
  },
  resumenTarjeta: {
    marginBottom: tema.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  resumenEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 6,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  metricsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricCaja: {
    flex: 1,
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    alignItems: "center",
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  metricValor: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  supplyProgresoCaja: {
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  supplyEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  supplyEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  supplyPorcentaje: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  listaEncabezado: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  seccionTituloConInsignia: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  elementoTarjeta: {
    marginBottom: tema.spacing.sm,
    backgroundColor: tema.colors.card,
  },
  elementoSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  elementoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  elementoSku: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  elementoMetricsFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  elementoColumna: {
    flex: 1,
    alignItems: "center",
  },
  elementoColumnaValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  elementoColumnaLbl: {
    fontSize: 9,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  inferiorAcciones: {
    flexDirection: "row",
    marginTop: tema.spacing.md,
    marginBottom: tema.spacing.lg,
    flexWrap: "wrap",
    gap: 8,
  },
  // ESTILOS DE SOLICITUDES ENVIADAS
  solicitudesVaciaCaja: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  solicitudesVaciaTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  solicitudTarjeta: {
    marginBottom: 8,
    backgroundColor: tema.colors.card,
    borderLeftWidth: 3,
    borderLeftColor: tema.colors.primary,
  },
  solicitudEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  solicitudCodigo: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  solicitudUrgenciaTag: {
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 4,
  },
  solicitudFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 6,
  },
  solicitudItemsList: {
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 6,
  },
  solicitudItemTexto: {
    fontSize: 11,
    color: tema.colors.text,
    marginBottom: 2,
  },
  solicitudNota: {
    fontSize: 11,
    fontStyle: "italic",
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  solicitudRechazoCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    padding: 6,
    borderRadius: tema.radius.sm,
    marginTop: 6,
  },
  solicitudRechazoTexto: {
    fontSize: 11,
    color: tema.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  // ESTILOS DEL MODAL
  modalCampoTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 6,
  },
  urgenciaSelectorFila: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  urgenciaBoton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: tema.colors.surface,
    gap: 4,
  },
  urgenciaBotonTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  sinItemsAviso: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
    marginBottom: 8,
  },
  sinItemsAvisoTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
  modalItemFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  modalItemNombre: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  modalItemSku: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  modalItemStock: {
    fontSize: 10,
    color: tema.colors.okDark,
  },
  ajustarStockBoton: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: tema.colors.primaryLight,
    borderRadius: 4,
  },
  ajustarStockBotonTexto: {
    fontSize: 9,
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },
  stepperContenedor: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    overflow: "hidden",
    marginRight: 6,
  },
  stepperBoton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tema.colors.surfaceAlt,
  },
  stepperEntrada: {
    width: 40,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    paddingVertical: 2,
    backgroundColor: "#ffffff",
  },
  eliminarItemBoton: {
    padding: 6,
  },
  agregarInsumoSeccion: {
    marginTop: 6,
    marginBottom: 6,
  },
  toggleCatalogoBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
    alignSelf: "flex-start",
    gap: 6,
  },
  toggleCatalogoBotonTexto: {
    fontSize: 12,
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },
  catalogoDesplegableCaja: {
    marginTop: 8,
    padding: 10,
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  busquedaCatalogoEntrada: {
    backgroundColor: "#ffffff",
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: tema.colors.text,
    marginBottom: 8,
  },
  catalogoListaScroll: {
    maxHeight: 180,
  },
  sinResultadosTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  catalogoItemOpcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  catalogoItemOpcionNombre: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.text,
  },
  catalogoItemOpcionDetalle: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  agregarChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  agregarChipTexto: {
    fontSize: 10,
    color: "#ffffff",
    fontWeight: "bold",
  },
  errorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginTop: 8,
    gap: 6,
  },
  errorTexto: {
    fontSize: 11,
    color: tema.colors.dangerDark,
    flex: 1,
  },
  modalAccionesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 4,
  },
});
