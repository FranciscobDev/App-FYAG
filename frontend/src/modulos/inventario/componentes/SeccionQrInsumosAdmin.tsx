// Pantalla de generación y visualización de códigos QR dentro del catálogo de insumos
// para el Administrador, con control de estado de asignación física y visor de datos embebidos.
import React, { useEffect, useMemo, useState } from "react";
import {
   ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Boton,
  CampoBusqueda,
  CampoTexto,
  EstadoVacio,
  Insignia,
  Tarjeta,
  VistaModal,
} from "@/componentes/comunes";
import { Producto } from "@/nucleo/tipos";
import {
  EstadoAsignacionFisicaQr,
  RegistroQrInsumo,
  construirPayloadQrInsumo,
  crearRegistroQrParaProducto,
  descargarLoteQrPngWeb,
  exportarLoteQrPdfWeb,
  generarMatrizQrVisual,
  guardarRegistrosQrLocal,
  imprimirEtiquetaQrWeb,
  inicializarRegistrosQrBase,
  leerRegistrosQrLocal,
  parsearPayloadQrInsumo,
} from "../qrInsumosUtils";

export interface PropiedadesSeccionQrInsumosAdmin {
  productos: Producto[];
  mostrarAviso: (mensaje: string) => void;
}

type FiltroVistaQr =
  | "todos"
  | "asignado_estanteria"
  | "por_asignar"
  | "impreso"
  | "pendiente_impresion"
  | "sin_qr";

const CONFIG_ESTADO_QR: Record<
  EstadoAsignacionFisicaQr,
  {
    label: string;
    tone: "ok" | "info" | "warn";
    icon: "checkmark-done-outline" | "print-outline" | "time-outline";
  }
> = {
  asignado_estanteria: {
    label: "Asignado en Estantería",
    tone: "ok",
    icon: "checkmark-done-outline",
  },
  impreso: {
    label: "Impreso (Por pegar)",
    tone: "info",
    icon: "print-outline",
  },
  pendiente_impresion: {
    label: "Pendiente Impresión",
    tone: "warn",
    icon: "time-outline",
  },
};

/**
 * Renderiza el código QR vectorial (SVG) a partir del payload embebido.
 */
const CodigoQrSvg: React.FC<{ contenido: string; tamanoPx?: number }> = ({
  contenido,
  tamanoPx = 104,
}) => {
  const matriz = useMemo(() => generarMatrizQrVisual(contenido, 25), [contenido]);
  const totalModulos = matriz.length + 2;
  const tamanoCelda = tamanoPx / totalModulos;

  return (
    <View
      style={[
        estilosLocales.qrMarco,
        { width: tamanoPx + 8, height: tamanoPx + 8 },
      ]}
    >
      <Svg width={tamanoPx} height={tamanoPx} viewBox={`0 0 ${tamanoPx} ${tamanoPx}`}>
        <Rect x={0} y={0} width={tamanoPx} height={tamanoPx} fill="#ffffff" />
        {matriz.map((fila, r) =>
          fila.map((activo, c) =>
            activo ? (
              <Rect
                key={`${r}_${c}`}
                x={(c + 1) * tamanoCelda}
                y={(r + 1) * tamanoCelda}
                width={tamanoCelda + 0.2}
                height={tamanoCelda + 0.2}
                fill="#111827"
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
};

export const SeccionQrInsumosAdmin: React.FC<PropiedadesSeccionQrInsumosAdmin> = ({
  productos,
  mostrarAviso,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const { actualizarProducto } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const [registrosQr, establecerRegistrosQr] = useState<RegistroQrInsumo[]>([]);
  const [hidratado, establecerHidratado] = useState(false);

  // Filtros dinámicos y selección múltiple para exportación en lote (PDF/PNG)
  // Por defecto inicia en "por_asignar" (Pendientes) para que los ya pegados pasen a la pestaña "Pegados"
  const [busqueda, establecerBusqueda] = useState("");
  const [filtroVista, establecerFiltroVista] = useState<FiltroVistaQr>("por_asignar");
  const [seleccionadosIds, establecerSeleccionadosIds] = useState<string[]>([]);
  const [modalLotePreview, establecerModalLotePreview] = useState<{
    formato: "PDF" | "PNG";
    registros: RegistroQrInsumo[];
  } | null>(null);

  // Modal de generación de nuevo QR
  const [modalGenerarVisible, establecerModalGenerarVisible] = useState(false);
  const [skuSeleccionado, establecerSkuSeleccionado] = useState<string>("");
  const [ubicacionFormulario, establecerUbicacionFormulario] = useState<string>("");
  const [loteFormulario, establecerLoteFormulario] = useState<string>("");
  const [estadoInicialFormulario, establecerEstadoInicialFormulario] =
    useState<EstadoAsignacionFisicaQr>("pendiente_impresion");

  // Modal de detalle / verificación de datos embebidos [SCRUM]
  const [qrInspeccionado, establecerQrInspeccionado] = useState<RegistroQrInsumo | null>(null);

  // 1. Cargar registros QR desde disco local o inicializar base del catálogo
  useEffect(() => {
    let cancelado = false;
    void leerRegistrosQrLocal().then((guardados) => {
      if (cancelado) return;
      if (guardados && guardados.length > 0) {
        establecerRegistrosQr(guardados);
      } else if (productos.length > 0) {
        const iniciales = inicializarRegistrosQrBase(productos);
        establecerRegistrosQr(iniciales);
        void guardarRegistrosQrLocal(iniciales);
      }
      establecerHidratado(true);
    });
    return () => {
      cancelado = true;
    };
  }, [productos.length]);

  // 2. Persistir cada cambio de registros QR en disco local
  useEffect(() => {
    if (!hidratado) return;
    void guardarRegistrosQrLocal(registrosQr);
  }, [hidratado, registrosQr]);

  // Conjunto de SKUs que ya tienen al menos un QR asociado
  const skusConQr = useMemo(
    () => new Set(registrosQr.map((r) => r.sku.trim().toUpperCase())),
    [registrosQr]
  );

  const productosSinQr = useMemo(
    () =>
      productos.filter(
        (p) => !p.disabled && !skusConQr.has(p.sku.trim().toUpperCase())
      ),
    [productos, skusConQr]
  );

  // KPIs del dashboard de códigos QR
  const metricas = useMemo(() => {
    const asignados = registrosQr.filter(
      (r) => r.estadoAsignacion === "asignado_estanteria"
    ).length;
    const impresos = registrosQr.filter((r) => r.estadoAsignacion === "impreso").length;
    const pendientes = registrosQr.filter(
      (r) => r.estadoAsignacion === "pendiente_impresion"
    ).length;

    return {
      totalQr: registrosQr.length,
      asignados,
      impresos,
      pendientes,
      sinQr: productosSinQr.length,
    };
  }, [registrosQr, productosSinQr]);

  // Registros QR filtrados
  const registrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return registrosQr.filter((r) => {
      if (filtroVista === "por_asignar") {
        if (
          r.estadoAsignacion !== "impreso" &&
          r.estadoAsignacion !== "pendiente_impresion"
        ) {
          return false;
        }
      } else if (
        filtroVista !== "todos" &&
        filtroVista !== "sin_qr" &&
        r.estadoAsignacion !== filtroVista
      ) {
        return false;
      }
      if (q) {
        const coincideSku = r.sku.toLowerCase().includes(q);
        const coincideNombre = r.nombreInsumo.toLowerCase().includes(q);
        const coincideCodigo = r.codigoQr.toLowerCase().includes(q);
        const coincideUbicacion = r.ubicacionFisica.toLowerCase().includes(q);
        if (!coincideSku && !coincideNombre && !coincideCodigo && !coincideUbicacion) {
          return false;
        }
      }
      return true;
    });
  }, [registrosQr, filtroVista, busqueda]);

  const sinQrFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productosSinQr.filter((p) => {
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q)
      );
    });
  }, [productosSinQr, busqueda]);

  const abrirModalGenerar = (productoPreseleccionado?: Producto) => {
    const prod =
      productoPreseleccionado || productosSinQr[0] || productos.find((p) => !p.disabled);
    if (!prod) {
      mostrarAviso("No hay insumos activos disponibles en el catálogo.");
      return;
    }
    establecerSkuSeleccionado(prod.sku);
    establecerUbicacionFormulario(prod.location || "Bodega Central - Estante A-01");
    establecerLoteFormulario(`LOTE-${new Date().getFullYear()}-01`);
    establecerEstadoInicialFormulario("pendiente_impresion");
    establecerModalGenerarVisible(true);
  };

  const productoFormulario = useMemo(
    () => productos.find((p) => p.sku === skuSeleccionado) || null,
    [productos, skuSeleccionado]
  );

  // Vista previa en vivo del payload embebido antes de confirmar la generación
  const payloadVistaPrevia = useMemo(() => {
    if (!productoFormulario) return "";
    return construirPayloadQrInsumo({
      codigoQr: `FYAG-QR-${productoFormulario.sku.toUpperCase()}-PREVIEW`,
      sku: productoFormulario.sku.toUpperCase(),
      nombre: productoFormulario.name,
      categoria: productoFormulario.category,
      unidad: productoFormulario.unit,
      ubicacion: ubicacionFormulario.trim() || productoFormulario.location || "Bodega Central",
      lote: loteFormulario,
      generadoEn: new Date().toISOString(),
    });
  }, [productoFormulario, ubicacionFormulario, loteFormulario]);

  const manejarConfirmarGeneracionQr = () => {
    if (!productoFormulario) return;

    const nuevoRegistro = crearRegistroQrParaProducto({
      producto: productoFormulario,
      ubicacionFisica: ubicacionFormulario,
      lote: loteFormulario,
      generadoPor: usuario.name || "Administrador",
      estadoInicial: estadoInicialFormulario,
      correlativo: registrosQr.length + 101,
    });

    establecerRegistrosQr((prev) => [nuevoRegistro, ...prev]);
    // Asocia también el código generado como código de barras/QR del insumo en el catálogo
    void actualizarProducto(productoFormulario.sku, {
      barcode: nuevoRegistro.codigoQr,
      location: nuevoRegistro.ubicacionFisica,
    });

    establecerModalGenerarVisible(false);
    establecerQrInspeccionado(nuevoRegistro);
    mostrarAviso(
      `Código QR ${nuevoRegistro.codigoQr} generado y asociado a ${productoFormulario.sku}.`
    );
  };

  const manejarCambiarEstadoAsignacion = (
    idRegistro: string,
    nuevoEstado: EstadoAsignacionFisicaQr
  ) => {
    const ahora = new Date().toISOString();
    establecerRegistrosQr((prev) =>
      prev.map((r) =>
        r.id === idRegistro
          ? { ...r, estadoAsignacion: nuevoEstado, actualizadoEn: ahora }
          : r
      )
    );
    establecerQrInspeccionado((prev) =>
      prev && prev.id === idRegistro
        ? { ...prev, estadoAsignacion: nuevoEstado, actualizadoEn: ahora }
        : prev
    );
    // Quitar de la selección activa si cambió de bandeja (ej. pasó de Pendientes a Pegados)
    establecerSeleccionadosIds((prev) => prev.filter((id) => id !== idRegistro));
    mostrarAviso(
      nuevoEstado === "asignado_estanteria"
        ? `Etiqueta confirmada y movida a la sección "Pegados".`
        : `Etiqueta movida a la sección "Pendientes" (${CONFIG_ESTADO_QR[nuevoEstado].label}).`
    );
  };

  const manejarImprimirEtiqueta = (registro: RegistroQrInsumo) => {
    const ok = imprimirEtiquetaQrWeb(registro);
    if (ok) {
      if (registro.estadoAsignacion === "pendiente_impresion") {
        manejarCambiarEstadoAsignacion(registro.id, "impreso");
      }
      mostrarAviso(`Etiqueta QR ${registro.codigoQr} enviada a impresión.`);
    } else {
      mostrarAviso(
        `Etiqueta ${registro.codigoQr} lista. En móvil puedes mostrar este QR en pantalla o imprimir desde navegador Web.`
      );
    }
  };

  // Funciones de selección múltiple y exportación en lote (PDF / PNG)
  const alternarSeleccionQr = (id: string) => {
    establecerSeleccionadosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const seleccionarLoteRapido = (cantidad?: number) => {
    const lista = cantidad ? registrosFiltrados.slice(0, cantidad) : registrosFiltrados;
    establecerSeleccionadosIds(lista.map((r) => r.id));
    mostrarAviso(
      `${lista.length} etiqueta(s) QR seleccionadas para exportación o asignación en lote.`
    );
  };

  const limpiarSeleccionQr = () => {
    establecerSeleccionadosIds([]);
  };

  const registrosSeleccionados = useMemo(
    () => registrosQr.filter((r) => seleccionadosIds.includes(r.id)),
    [registrosQr, seleccionadosIds]
  );

  const manejarConfirmarPegadoEnLote = (asignadoEnEstanteria: boolean) => {
    if (registrosSeleccionados.length === 0) return;
    const nuevoEstado: EstadoAsignacionFisicaQr = asignadoEnEstanteria
      ? "asignado_estanteria"
      : "impreso";
    const ahora = new Date().toISOString();
    const setIds = new Set(seleccionadosIds);

    establecerRegistrosQr((prev) =>
      prev.map((r) =>
        setIds.has(r.id)
          ? { ...r, estadoAsignacion: nuevoEstado, actualizadoEn: ahora }
          : r
      )
    );
    establecerSeleccionadosIds([]);
    mostrarAviso(
      asignadoEnEstanteria
        ? `${registrosSeleccionados.length} etiqueta(s) confirmadas y movidas a la pestaña "Pegados".`
        : `${registrosSeleccionados.length} etiqueta(s) movidas a la pestaña "Pendientes".`
    );
  };

  const manejarExportarLote = (formato: "PDF" | "PNG", lista?: RegistroQrInsumo[]) => {
    const lote =
      lista && lista.length > 0
        ? lista
        : registrosSeleccionados.length > 0
        ? registrosSeleccionados
        : registrosFiltrados.slice(0, 5);

    if (lote.length === 0) {
      mostrarAviso("Selecciona al menos un código QR para exportar en lote.");
      return;
    }

    establecerSeleccionadosIds(lote.map((r) => r.id));
    establecerModalLotePreview({ formato, registros: lote });

    if (formato === "PNG") {
      const ok = descargarLoteQrPngWeb(lote);
      if (ok) {
        mostrarAviso(
          `Lote de ${lote.length} etiqueta(s) descargado en un solo archivo PNG imprimible.`
        );
      }
    } else {
      const ok = exportarLoteQrPdfWeb(lote);
      if (ok) {
        mostrarAviso(
          `Plancha PDF imprimible con ${lote.length} etiqueta(s) generada correctamente.`
        );
      }
    }
  };

  const totalInsumosActivos = Math.max(1, skusConQr.size + metricas.sinQr);
  const porcentajeCoberturaQr = Math.min(
    100,
    Math.round((skusConQr.size / totalInsumosActivos) * 100)
  );

  return (
    <View style={estilosLocales.contenedorCentrado}>
      {/* 1. CABECERA COMPACTA INDUSTRIAL + COBERTURA EN VIVO */}
      <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: tema.colors.primaryLight,
                borderWidth: 1,
                borderColor: tema.colors.primaryBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="qr-code-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                Control de Etiquetas QR — Bodega
              </Text>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                Cobertura física:{" "}
                <Text style={{ fontWeight: "700", color: tema.colors.primaryDark }}>
                  {skusConQr.size} de {skusConQr.size + metricas.sinQr} insumos
                </Text>{" "}
                etiquetados ({porcentajeCoberturaQr}%)
              </Text>
            </View>
          </View>

          <Boton
            title="+ Generar Nuevo QR"
            variant="primary"
            size="sm"
            icon="qr-code-outline"
            onPress={() => abrirModalGenerar()}
            style={{ minHeight: 40 }}
            fullWidth={esMovilEstrecho}
          />
        </View>

        {/* Barra de progreso de cobertura de etiquetado */}
        <View
          style={{
            height: 6,
            backgroundColor: tema.colors.surfaceAlt,
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 10,
          }}
        >
          <View
            style={{
              width: `${porcentajeCoberturaQr}%`,
              height: "100%",
              backgroundColor:
                porcentajeCoberturaQr >= 80
                  ? "#16a34a"
                  : porcentajeCoberturaQr >= 40
                  ? tema.colors.primary
                  : "#dc2626",
            }}
          />
        </View>
      </Tarjeta>

      {/* 2. PESTAÑAS DE SECCIÓN QR: PENDIENTES (INICIO) / PEGADOS / SIN QR / TODOS */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          {
            id: "por_asignar" as FiltroVistaQr,
            titulo: "Pendientes",
            valor: metricas.pendientes + metricas.impresos,
            sub: `${metricas.impresos} imp. • ${metricas.pendientes} por imp.`,
            icon: "time-outline" as const,
            bg: "#fffbeb",
            border: "#fcd34d",
            borderActivo: "#d97706",
            textColor: "#92400e",
          },
          {
            id: "asignado_estanteria" as FiltroVistaQr,
            titulo: "Pegados",
            valor: metricas.asignados,
            sub: "En estantería OK",
            icon: "checkmark-done-circle-outline" as const,
            bg: "#f0fdf4",
            border: "#86efac",
            borderActivo: "#16a34a",
            textColor: "#166534",
          },
          {
            id: "sin_qr" as FiltroVistaQr,
            titulo: "Sin QR",
            valor: metricas.sinQr,
            sub: "Por generar",
            icon: "add-circle-outline" as const,
            bg: metricas.sinQr > 0 ? "#fef2f2" : "#f1f5f9",
            border: metricas.sinQr > 0 ? "#fecaca" : "#e2e8f0",
            borderActivo: metricas.sinQr > 0 ? "#dc2626" : "#475569",
            textColor: metricas.sinQr > 0 ? "#991b1b" : "#334155",
          },
          {
            id: "todos" as FiltroVistaQr,
            titulo: "Todos los QR",
            valor: metricas.totalQr,
            sub: "Historial total",
            icon: "qr-code-outline" as const,
            bg: "#f1f5f9",
            border: "#cbd5e1",
            borderActivo: "#334155",
            textColor: "#0f172a",
          },
        ].map((kpi) => {
          const activo = filtroVista === kpi.id;
          return (
            <TouchableOpacity
              key={kpi.id}
              activeOpacity={0.8}
              onPress={() => {
                establecerFiltroVista(kpi.id);
                establecerSeleccionadosIds([]);
              }}
              style={{
                flexBasis: "48%",
                flexGrow: 1,
                minWidth: 140,
                backgroundColor: kpi.bg,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? kpi.borderActivo : kpi.border,
                borderLeftWidth: 5,
                borderLeftColor: kpi.borderActivo,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: kpi.textColor,
                    textTransform: "uppercase",
                  }}
                  numberOfLines={1}
                >
                  {kpi.titulo}
                </Text>
                <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                  {kpi.valor}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: activo ? "800" : "600",
                    color: kpi.textColor,
                  }}
                  numberOfLines={1}
                >
                  {activo ? "● Vista activa" : kpi.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. BUSCADOR COMPACTO + BARRA DE SELECCIÓN MÚLTIPLE MEJORADA */}
      <View style={estilosLocales.filtrosBloque}>
        <CampoBusqueda
          value={busqueda}
          onChangeText={establecerBusqueda}
          placeholder="Buscar por código QR, SKU, nombre o ubicación..."
        />

        {filtroVista !== "sin_qr" && registrosFiltrados.length > 0 && (
          <View
            style={{
              backgroundColor:
                registrosSeleccionados.length > 0 ? "#fffbeb" : tema.colors.card,
              borderWidth: 1.5,
              borderColor:
                registrosSeleccionados.length > 0
                  ? tema.colors.primary
                  : tema.colors.border,
              borderRadius: 12,
              padding: 12,
              gap: 10,
            }}
          >
            {/* Cabecera del Selector Múltiple: Estado + Chips rápidos de selección */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={
                    registrosSeleccionados.length > 0
                      ? "checkbox"
                      : "layers-outline"
                  }
                  size={18}
                  color={tema.colors.primaryDark}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: tema.colors.text,
                  }}
                >
                  {registrosSeleccionados.length > 0
                    ? `${registrosSeleccionados.length} de ${registrosFiltrados.length} etiqueta(s) seleccionada(s)`
                    : `Selección en Lote (${registrosFiltrados.length} en esta pestaña)`}
                </Text>
              </View>

              {/* Chips de selección rápida */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <TouchableOpacity
                  onPress={() =>
                    registrosSeleccionados.length === registrosFiltrados.length
                      ? limpiarSeleccionQr()
                      : seleccionarLoteRapido()
                  }
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor:
                      registrosSeleccionados.length === registrosFiltrados.length &&
                      registrosFiltrados.length > 0
                        ? tema.colors.primary
                        : tema.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor:
                      registrosSeleccionados.length === registrosFiltrados.length &&
                      registrosFiltrados.length > 0
                        ? tema.colors.primary
                        : tema.colors.borderDark,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 7,
                  }}
                >
                  <Ionicons
                    name={
                      registrosSeleccionados.length === registrosFiltrados.length &&
                      registrosFiltrados.length > 0
                        ? "checkmark-done"
                        : "checkbox-outline"
                    }
                    size={14}
                    color={
                      registrosSeleccionados.length === registrosFiltrados.length &&
                      registrosFiltrados.length > 0
                        ? "#ffffff"
                        : tema.colors.text
                    }
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color:
                        registrosSeleccionados.length === registrosFiltrados.length &&
                        registrosFiltrados.length > 0
                          ? "#ffffff"
                          : tema.colors.text,
                    }}
                  >
                    {registrosSeleccionados.length === registrosFiltrados.length &&
                    registrosFiltrados.length > 0
                      ? "Quitar Todas"
                      : `Todas (${registrosFiltrados.length})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => seleccionarLoteRapido(5)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor:
                      registrosSeleccionados.length === 5
                        ? tema.colors.primaryLight
                        : "#ffffff",
                    borderWidth: 1,
                    borderColor:
                      registrosSeleccionados.length === 5
                        ? tema.colors.primary
                        : tema.colors.borderDark,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 7,
                  }}
                >
                  <Ionicons name="sparkles-outline" size={13} color={tema.colors.primaryDark} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.primaryDark }}>
                    Lote de 5
                  </Text>
                </TouchableOpacity>

                {registrosSeleccionados.length > 0 && (
                  <TouchableOpacity
                    onPress={limpiarSeleccionQr}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: "#fee2e2",
                      borderWidth: 1,
                      borderColor: "#fca5a5",
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 7,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>
                      Limpiar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Fila 2: Botones simétricos de Descarga en Lote (PDF / PNG en 1 solo archivo) */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Boton
                title={`Exportar PDF (${
                  registrosSeleccionados.length > 0
                    ? registrosSeleccionados.length
                    : Math.min(5, registrosFiltrados.length)
                })`}
                variant="primary"
                size="sm"
                icon="document-text-outline"
                onPress={() => manejarExportarLote("PDF")}
                style={{ flex: 1, minWidth: 140, minHeight: 38 }}
              />
              <Boton
                title={`Descargar PNG (${
                  registrosSeleccionados.length > 0
                    ? registrosSeleccionados.length
                    : Math.min(5, registrosFiltrados.length)
                })`}
                variant="outline"
                size="sm"
                icon="image-outline"
                onPress={() => manejarExportarLote("PNG")}
                style={{ flex: 1, minWidth: 140, minHeight: 38, backgroundColor: "#ffffff" }}
              />
            </View>

            {/* Fila 3 (Condicional cuando hay selección): Mover lote entre Pendientes y Pegados */}
            {registrosSeleccionados.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#fde68a",
                }}
              >
                <Text style={{ fontSize: 11, color: "#92400e", fontWeight: "700" }}>
                  Mover {registrosSeleccionados.length} seleccionada(s) de sección:
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                  {filtroVista !== "asignado_estanteria" && (
                    <Boton
                      title="Mover a Pegados (Estante)"
                      variant="success"
                      size="sm"
                      icon="checkmark-done-outline"
                      onPress={() => manejarConfirmarPegadoEnLote(true)}
                      style={{ minHeight: 34 }}
                    />
                  )}
                  {filtroVista !== "por_asignar" && (
                    <Boton
                      title="Mover a Pendientes"
                      variant="outline"
                      size="sm"
                      icon="time-outline"
                      onPress={() => manejarConfirmarPegadoEnLote(false)}
                      style={{ minHeight: 34, backgroundColor: "#ffffff" }}
                    />
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 4. LISTADO RESPONSIVO: INSUMOS SIN QR O TARJETAS DE CÓDIGOS QR CON SEMÁFORO */}
      {filtroVista === "sin_qr" ? (
        sinQrFiltrados.length === 0 ? (
          <EstadoVacio
            icon="checkmark-done-outline"
            title="Todos los insumos tienen código QR"
            description="No quedan insumos activos pendientes de generación de código QR."
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          <View
            style={[
              estilosLocales.tarjetasGrilla,
              esPantallaAncha && estilosLocales.tarjetasGrillaAncha,
            ]}
          >
            {sinQrFiltrados.map((prod) => (
              <Tarjeta
                key={prod.sku}
                variant="outlined"
                style={[
                  {
                    padding: 12,
                    backgroundColor: "#fef2f2",
                    borderColor: "#fca5a5",
                    borderWidth: 1.5,
                    borderLeftWidth: 5,
                    borderLeftColor: "#dc2626",
                    borderRadius: 12,
                  },
                  esPantallaAncha && estilosLocales.qrTarjetaAncha,
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#991b1b" }}>
                        {prod.sku}
                      </Text>
                      <Insignia label="Sin Etiqueta QR" tone="danger" size="sm" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text, marginTop: 2 }}>
                      {prod.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 2 }}>
                      📍 {prod.location || "Sin ubicación"} • Stock: {prod.stock} {prod.unit}
                    </Text>
                  </View>

                  <Boton
                    title="+ Emitir QR"
                    variant="primary"
                    size="sm"
                    icon="qr-code-outline"
                    onPress={() => abrirModalGenerar(prod)}
                    style={{ minHeight: 36 }}
                  />
                </View>
              </Tarjeta>
            ))}
          </View>
        )
      ) : registrosFiltrados.length === 0 ? (
        <EstadoVacio
          icon="qr-code-outline"
          title="Sin códigos QR en este filtro"
          description="Genera un nuevo código QR o selecciona otra tarjeta de estado arriba."
          actionTitle="+ Generar Nuevo QR"
          onAction={() => abrirModalGenerar()}
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        <View
          style={[
            estilosLocales.tarjetasGrilla,
            esPantallaAncha && estilosLocales.tarjetasGrillaAncha,
          ]}
        >
          {registrosFiltrados.map((reg) => {
            const cfg = CONFIG_ESTADO_QR[reg.estadoAsignacion];
            const esAsignado = reg.estadoAsignacion === "asignado_estanteria";
            const estaSeleccionado = seleccionadosIds.includes(reg.id);
            const fondoSem = esAsignado ? "#f0fdf4" : "#fffbeb";
            const bordeSem = estaSeleccionado
              ? tema.colors.primary
              : esAsignado
              ? "#86efac"
              : "#fcd34d";
            const franjaSem = esAsignado ? "#16a34a" : "#d97706";
            const divisorSem = esAsignado ? "#bbf7d0" : "#fde68a";

            return (
              <Tarjeta
                key={reg.id}
                variant="outlined"
                style={[
                  {
                    padding: 12,
                    gap: 10,
                    backgroundColor: fondoSem,
                    borderColor: bordeSem,
                    borderWidth: estaSeleccionado ? 2.5 : 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: franjaSem,
                    borderRadius: 12,
                  },
                  esPantallaAncha && estilosLocales.qrTarjetaAncha,
                ]}
              >
                {/* Fila superior de Selección Múltiple + Switch de Confirmación de Pegado Físico */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    paddingBottom: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: divisorSem,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => alternarSeleccionQr(reg.id)}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: estaSeleccionado }}
                  >
                    <Ionicons
                      name={estaSeleccionado ? "checkbox" : "square-outline"}
                      size={20}
                      color={estaSeleccionado ? tema.colors.primaryDark : tema.colors.textSecondary}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: estaSeleccionado ? tema.colors.primaryDark : tema.colors.textSecondary,
                      }}
                    >
                      {estaSeleccionado ? "Seleccionado en lote" : "Seleccionar para lote"}
                    </Text>
                  </TouchableOpacity>

                  {/* Switch de confirmación de pegado/asignación física en estantería */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: esAsignado ? "#166534" : "#92400e",
                      }}
                    >
                      {esAsignado ? "Pegado en Estante" : "Confirmar Pegado"}
                    </Text>
                    <Switch
                      value={esAsignado}
                      onValueChange={(val) =>
                        manejarCambiarEstadoAsignacion(
                          reg.id,
                          val ? "asignado_estanteria" : "impreso"
                        )
                      }
                      trackColor={{ false: "#fde68a", true: "#86efac" }}
                      thumbColor={esAsignado ? "#16a34a" : "#d97706"}
                    />
                  </View>
                </View>

                <View style={estilosLocales.qrTarjetaCuerpo}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => establecerQrInspeccionado(reg)}
                    accessibilityLabel={`Ver QR ${reg.codigoQr}`}
                  >
                    <CodigoQrSvg contenido={reg.payloadEmbebido} tamanoPx={76} />
                  </TouchableOpacity>

                  <View style={{ flex: 1, minWidth: 150, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <Text style={estilosLocales.codigoQrTexto}>{reg.codigoQr}</Text>
                      <Insignia label={cfg.label} tone={cfg.tone} icon={cfg.icon} size="sm" />
                    </View>
                    <Text style={estilosLocales.nombreTexto} numberOfLines={2}>
                      {reg.nombreInsumo}
                    </Text>
                    <Text style={estilosLocales.metaTexto}>
                      SKU: <Text style={{ fontWeight: "800", color: tema.colors.text }}>{reg.sku}</Text> • Unidad: {reg.unidad}
                    </Text>
                    <View style={estilosLocales.ubicacionFila}>
                      <Ionicons name="location-outline" size={13} color={tema.colors.primaryDark} />
                      <Text style={estilosLocales.ubicacionTexto} numberOfLines={1}>
                        {reg.ubicacionFisica}
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    estilosLocales.qrAccionesFila,
                    { borderTopColor: divisorSem, paddingTop: 8 },
                  ]}
                >
                  <Boton
                    title="Datos QR"
                    variant="outline"
                    size="sm"
                    icon="code-slash-outline"
                    onPress={() => establecerQrInspeccionado(reg)}
                    style={{ flex: 1, minHeight: 34, backgroundColor: "#ffffff" }}
                  />
                  <Boton
                    title="Imprimir Individual"
                    variant="outline"
                    size="sm"
                    icon="print-outline"
                    onPress={() => manejarImprimirEtiqueta(reg)}
                    style={{ flex: 1, minHeight: 34, backgroundColor: "#ffffff" }}
                  />
                </View>
              </Tarjeta>
            );
          })}
        </View>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: GENERAR NUEVO CÓDIGO QR DE INSUMO                            */}
      {/* ===================================================================== */}
      <VistaModal
        visible={modalGenerarVisible}
        onClose={() => establecerModalGenerarVisible(false)}
        title="Generar Código QR de Insumo"
        subtitle="Embebido automático de SKU, categoría, unidad, lote y ubicación física"
        maxWidth={560}
      >
        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
          <Text style={estilosLocales.modalEtiqueta}>1. Seleccionar Insumo del Catálogo:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
          >
            {productos
              .filter((p) => !p.disabled)
              .map((p) => {
                const activo = p.sku === skuSeleccionado;
                const yaTiene = skusConQr.has(p.sku.trim().toUpperCase());
                return (
                  <TouchableOpacity
                    key={p.sku}
                    onPress={() => {
                      establecerSkuSeleccionado(p.sku);
                      establecerUbicacionFormulario(
                        p.location || "Bodega Central - Estante A-01"
                      );
                    }}
                    style={[
                      estilosLocales.selectorChip,
                      activo && estilosLocales.selectorChipActivo,
                    ]}
                  >
                    <Text
                      style={[
                        estilosLocales.selectorChipSku,
                        activo && { color: "#818cf8" },
                      ]}
                    >
                      {p.sku} {yaTiene ? "• Con QR" : "• Sin QR"}
                    </Text>
                    <Text
                      style={[
                        estilosLocales.selectorChipNombre,
                        activo && { color: "#ffffff" },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <CampoTexto
            label="2. Ubicación Física en Bodega / Estantería *"
            value={ubicacionFormulario}
            onChangeText={establecerUbicacionFormulario}
            placeholder="Ej: Bodega Central - Pasillo B - Estante 03"
          />

          <CampoTexto
            label="3. Lote / Serie (opcional)"
            value={loteFormulario}
            onChangeText={establecerLoteFormulario}
            placeholder="Ej: LOTE-2026-04"
          />

          <Text style={estilosLocales.modalEtiqueta}>4. Estado Inicial de Asignación Física:</Text>
          <View style={estilosLocales.estadosSelectorFila}>
            {(
              [
                "pendiente_impresion",
                "impreso",
                "asignado_estanteria",
              ] as EstadoAsignacionFisicaQr[]
            ).map((est) => {
              const activo = estadoInicialFormulario === est;
              return (
                <TouchableOpacity
                  key={est}
                  onPress={() => establecerEstadoInicialFormulario(est)}
                  style={[
                    estilosLocales.estadoChip,
                    activo && estilosLocales.estadoChipActivo,
                  ]}
                >
                  <Text
                    style={[
                      estilosLocales.estadoChipTexto,
                      activo && estilosLocales.estadoChipTextoActivo,
                    ]}
                  >
                    {CONFIG_ESTADO_QR[est].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Vista previa en vivo del QR y sus datos embebidos */}
          {productoFormulario && (
            <View style={estilosLocales.previewCaja}>
              <CodigoQrSvg contenido={payloadVistaPrevia} tamanoPx={116} />
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={estilosLocales.previewTitulo}>Vista previa de datos embebidos</Text>
                <Text style={estilosLocales.previewJson}>{payloadVistaPrevia}</Text>
              </View>
            </View>
          )}

          <View style={estilosLocales.modalBotonesFila}>
            <Boton
              title="Cancelar"
              variant="ghost"
              onPress={() => establecerModalGenerarVisible(false)}
              style={{ flex: 1, minWidth: 110, minHeight: 44 }}
            />
            <Boton
              title="Generar y Asociar QR"
              variant="primary"
              icon="qr-code-outline"
              disabled={!productoFormulario || !ubicacionFormulario.trim()}
              onPress={manejarConfirmarGeneracionQr}
              style={{ flex: 1.6, minWidth: 170, minHeight: 46 }}
            />
          </View>
        </ScrollView>
      </VistaModal>

      {/* ===================================================================== */}
      {/* MODAL 2: VISOR DE QR Y VERIFICACIÓN DE DATOS EMBEBIDOS [SCRUM]        */}
      {/* ===================================================================== */}
      <VistaModal
        visible={Boolean(qrInspeccionado)}
        onClose={() => establecerQrInspeccionado(null)}
        title={qrInspeccionado ? `Código QR: ${qrInspeccionado.codigoQr}` : "Detalle de Código QR"}
        subtitle={
          qrInspeccionado
            ? `${qrInspeccionado.sku} • ${qrInspeccionado.nombreInsumo}`
            : ""
        }
        maxWidth={560}
      >
        {qrInspeccionado &&
          (() => {
            const datos = parsearPayloadQrInsumo(qrInspeccionado.payloadEmbebido);
            const cfg = CONFIG_ESTADO_QR[qrInspeccionado.estadoAsignacion];

            return (
              <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                <View style={estilosLocales.visorCentro}>
                  <CodigoQrSvg contenido={qrInspeccionado.payloadEmbebido} tamanoPx={176} />
                  <View style={{ marginTop: 10 }}>
                    <Insignia label={cfg.label} tone={cfg.tone} icon={cfg.icon} size="md" />
                  </View>
                </View>

                {/* Datos embebidos decodificados */}
                <Text style={estilosLocales.modalEtiqueta}>
                  Datos Embebidos Verificados en el QR:
                </Text>
                <View style={estilosLocales.datosGrilla}>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Sistema / Tipo</Text>
                    <Text style={estilosLocales.datoVal}>
                      {datos?.sistema || "FYAG"} • {datos?.tipo || "INSUMO"}
                    </Text>
                  </View>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Código QR</Text>
                    <Text style={estilosLocales.datoVal}>{qrInspeccionado.codigoQr}</Text>
                  </View>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>SKU</Text>
                    <Text style={estilosLocales.datoVal}>{qrInspeccionado.sku}</Text>
                  </View>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Insumo</Text>
                    <Text style={estilosLocales.datoVal}>{qrInspeccionado.nombreInsumo}</Text>
                  </View>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Categoría / Unidad</Text>
                    <Text style={estilosLocales.datoVal}>
                      {qrInspeccionado.categoria} ({qrInspeccionado.unidad})
                    </Text>
                  </View>
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Ubicación Física</Text>
                    <Text style={estilosLocales.datoVal}>{qrInspeccionado.ubicacionFisica}</Text>
                  </View>
                  {qrInspeccionado.lote && (
                    <View style={estilosLocales.datoFila}>
                      <Text style={estilosLocales.datoLbl}>Lote</Text>
                      <Text style={estilosLocales.datoVal}>{qrInspeccionado.lote}</Text>
                    </View>
                  )}
                  <View style={estilosLocales.datoFila}>
                    <Text style={estilosLocales.datoLbl}>Generado por</Text>
                    <Text style={estilosLocales.datoVal}>
                      {qrInspeccionado.generadoPor} • {formatearFecha(qrInspeccionado.generadoEn)}
                    </Text>
                  </View>
                </View>

                <Text style={[estilosLocales.modalEtiqueta, { marginTop: 10 }]}>
                  Carga Útil JSON Embebida (Lectura Escáner):
                </Text>
                <View style={estilosLocales.jsonBox}>
                  <Text style={estilosLocales.jsonTexto}>{qrInspeccionado.payloadEmbebido}</Text>
                </View>

                {/* Control directo de estado de asignación física */}
                <Text style={[estilosLocales.modalEtiqueta, { marginTop: 12 }]}>
                  Actualizar Estado de Asignación Física:
                </Text>
                <View style={estilosLocales.estadosSelectorFila}>
                  {(
                    [
                      "pendiente_impresion",
                      "impreso",
                      "asignado_estanteria",
                    ] as EstadoAsignacionFisicaQr[]
                  ).map((est) => {
                    const activo = qrInspeccionado.estadoAsignacion === est;
                    return (
                      <TouchableOpacity
                        key={est}
                        onPress={() => manejarCambiarEstadoAsignacion(qrInspeccionado.id, est)}
                        style={[
                          estilosLocales.estadoChip,
                          activo && estilosLocales.estadoChipActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilosLocales.estadoChipTexto,
                            activo && estilosLocales.estadoChipTextoActivo,
                          ]}
                        >
                          {CONFIG_ESTADO_QR[est].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={estilosLocales.modalBotonesFila}>
                  <Boton
                    title="Cerrar"
                    variant="ghost"
                    onPress={() => establecerQrInspeccionado(null)}
                    style={{ flex: 1, minWidth: 110, minHeight: 44 }}
                  />
                  <Boton
                    title="Imprimir Etiqueta QR"
                    variant="primary"
                    icon="print-outline"
                    onPress={() => manejarImprimirEtiqueta(qrInspeccionado)}
                    style={{ flex: 1.5, minWidth: 165, minHeight: 46 }}
                  />
                </View>
              </ScrollView>
            );
          })()}
      </VistaModal>

      {/* ===================================================================== */}
      {/* MODAL 3: PLANCHA IMPRIMIBLE DEL LOTE EXPORTADO (PDF / PNG)            */}
      {/* ===================================================================== */}
      <VistaModal
        visible={Boolean(modalLotePreview)}
        onClose={() => establecerModalLotePreview(null)}
        title={
          modalLotePreview
            ? `Lote Imprimible (${modalLotePreview.registros.length} Etiquetas QR • ${modalLotePreview.formato})`
            : "Lote Imprimible de Etiquetas QR"
        }
        subtitle="Vista previa de alta legibilidad del archivo único descargado / listo para imprimir"
        maxWidth={680}
      >
        {modalLotePreview && (
          <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
            <View
              style={{
                backgroundColor: "#f0fdf4",
                borderWidth: 1,
                borderColor: "#86efac",
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={{ fontSize: 12, color: "#166534", fontWeight: "700", flex: 1 }}>
                Archivo único ({modalLotePreview.formato}) generado con {modalLotePreview.registros.length} etiqueta(s). Verifica a continuación la nitidez del código QR y la legibilidad del SKU, nombre y ubicación física:
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {modalLotePreview.registros.map((reg, idx) => {
                const esAsignado = reg.estadoAsignacion === "asignado_estanteria";
                return (
                  <View
                    key={reg.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: "#ffffff",
                      borderWidth: 2,
                      borderColor: "#0f172a",
                      borderLeftWidth: 7,
                      borderLeftColor: esAsignado ? "#16a34a" : "#d97706",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <CodigoQrSvg contenido={reg.payloadEmbebido} tamanoPx={96} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: "#b45309",
                          letterSpacing: 0.6,
                        }}
                      >
                        ETIQUETA #{idx + 1} • FYAG BODEGA
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "900",
                          color: "#0f172a",
                        }}
                      >
                        {reg.sku}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: "#111827",
                        }}
                      >
                        {reg.nombreInsumo}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#334155",
                        }}
                      >
                        Código: {reg.codigoQr}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#0f172a",
                          marginTop: 2,
                        }}
                      >
                        📍 Ubicación: {reg.ubicacionFisica}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#475569" }}>
                        Categoría: {reg.categoria} • Unidad: {reg.unidad.toUpperCase()}
                        {reg.lote ? ` • Lote: ${reg.lote}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={estilosLocales.modalBotonesFila}>
              <Boton
                title="Descargar PNG Único"
                variant="outline"
                size="sm"
                icon="image-outline"
                onPress={() => descargarLoteQrPngWeb(modalLotePreview.registros)}
                style={{ flex: 1, minHeight: 42 }}
              />
              <Boton
                title="Imprimir / Guardar PDF Único"
                variant="primary"
                size="sm"
                icon="document-text-outline"
                onPress={() => exportarLoteQrPdfWeb(modalLotePreview.registros)}
                style={{ flex: 1.2, minHeight: 42 }}
              />
              <Boton
                title="Cerrar"
                variant="ghost"
                size="sm"
                onPress={() => establecerModalLotePreview(null)}
                style={{ minHeight: 42 }}
              />
            </View>
          </ScrollView>
        )}
      </VistaModal>
    </View>
  );
};

const estilosLocales = StyleSheet.create({
  contenedorCentrado: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: 14,
  },
  heroTarjeta: {
    padding: 16,
  },
  heroContenido: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  heroBadgesFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  heroTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  heroSub: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  heroAcciones: {
    minWidth: 200,
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
  filtrosBloque: {
    gap: 10,
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
  tarjetasGrilla: {
    gap: 12,
  },
  tarjetasGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  qrTarjeta: {
    padding: 14,
    gap: 12,
  },
  qrTarjetaAncha: {
    width: "48.8%",
  },
  qrTarjetaCuerpo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  qrMarco: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeFila: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  codigoQrTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  skuTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  nombreTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  metaTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  ubicacionFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ubicacionTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
    flex: 1,
  },
  qrAccionesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  sinQrFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sinQrIconoCaja: {
    width: 48,
    height: 48,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEtiqueta: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 6,
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    maxWidth: 210,
  },
  selectorChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  selectorChipSku: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  selectorChipNombre: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  estadosSelectorFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  estadoChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  estadoChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  estadoChipTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  estadoChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  previewCaja: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  previewTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 4,
  },
  previewJson: {
    fontSize: 10,
    color: tema.colors.textSecondary,
    lineHeight: 15,
  },
  visorCentro: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 10,
  },
  datosGrilla: {
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    gap: 6,
  },
  datoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
  },
  datoLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
  },
  datoVal: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
  },
  jsonBox: {
    backgroundColor: "#0f172a",
    borderRadius: tema.radius.sm,
    padding: 10,
  },
  jsonTexto: {
    fontSize: 11,
    color: "#fde68a",
    lineHeight: 16,
  },
  modalBotonesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
});
