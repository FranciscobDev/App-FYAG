// Pantalla de generación y visualización de códigos QR dentro del catálogo de insumos
// para el Administrador, con control de estado de asignación física y visor de datos embebidos.
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
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

  // Filtros dinámicos
  const [busqueda, establecerBusqueda] = useState("");
  const [filtroVista, establecerFiltroVista] = useState<FiltroVistaQr>("todos");

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
      if (
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
    mostrarAviso(
      `Estado físico actualizado a "${CONFIG_ESTADO_QR[nuevoEstado].label}".`
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

  return (
    <View style={estilosLocales.contenedorCentrado}>
      {/* 1. HERO CARD ADMINISTRADOR: GENERACIÓN DE CÓDIGOS QR */}
      <Tarjeta variant="elevated" style={estilosLocales.heroTarjeta}>
        <View style={estilosLocales.heroContenido}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <View style={estilosLocales.heroBadgesFila}>
              <Insignia label="Catálogo QR — Administrador" tone="primary" size="sm" />
              <Insignia label="Asignación Física en Bodega" tone="info" size="sm" />
            </View>
            <Text style={estilosLocales.heroTitulo}>
              Generación y Visualización de Códigos QR de Insumos
            </Text>
            <Text style={estilosLocales.heroSub}>
              Genera etiquetas QR con datos embebidos (SKU, nombre, categoría, unidad, lote y
              ubicación) y controla su estado de asignación física en estantería.
            </Text>
          </View>

          <View style={estilosLocales.heroAcciones}>
            <Boton
              title="+ Generar Nuevo QR"
              variant="primary"
              size="md"
              icon="qr-code-outline"
              onPress={() => abrirModalGenerar()}
              style={{ minHeight: 46 }}
              fullWidth={esMovilEstrecho}
            />
          </View>
        </View>
      </Tarjeta>

      {/* 2. DASHBOARD RESPONSIVO DE 4 KPIs */}
      <View style={estilosLocales.kpiGrilla}>
        <View
          style={[
            estilosLocales.kpiCaja,
            esMovilEstrecho && estilosLocales.kpiCajaMovil,
            { backgroundColor: tema.colors.primaryLight, borderColor: "#fde68a" },
          ]}
        >
          <Text style={[estilosLocales.kpiLbl, { color: tema.colors.primaryDark }]}>
            QR Generados
          </Text>
          <Text style={[estilosLocales.kpiVal, { color: tema.colors.primaryDark }]}>
            {metricas.totalQr}
          </Text>
          <Text style={[estilosLocales.kpiSub, { color: tema.colors.primaryDark }]}>
            Etiquetas activas
          </Text>
        </View>

        <View
          style={[
            estilosLocales.kpiCaja,
            esMovilEstrecho && estilosLocales.kpiCajaMovil,
            { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
          ]}
        >
          <Text style={[estilosLocales.kpiLbl, { color: tema.colors.okDark }]}>
            En Estantería
          </Text>
          <Text style={[estilosLocales.kpiVal, { color: tema.colors.okDark }]}>
            {metricas.asignados}
          </Text>
          <Text style={[estilosLocales.kpiSub, { color: tema.colors.okDark }]}>
            Asignación física OK
          </Text>
        </View>

        <View
          style={[
            estilosLocales.kpiCaja,
            esMovilEstrecho && estilosLocales.kpiCajaMovil,
            metricas.pendientes + metricas.impresos > 0 && {
              backgroundColor: tema.colors.warnLight,
              borderColor: tema.colors.warnBorder,
            },
          ]}
        >
          <Text
            style={[
              estilosLocales.kpiLbl,
              metricas.pendientes + metricas.impresos > 0 && { color: tema.colors.warnDark },
            ]}
          >
            Por Asignar
          </Text>
          <Text
            style={[
              estilosLocales.kpiVal,
              metricas.pendientes + metricas.impresos > 0 && { color: tema.colors.warnDark },
            ]}
          >
            {metricas.pendientes + metricas.impresos}
          </Text>
          <Text
            style={[
              estilosLocales.kpiSub,
              metricas.pendientes + metricas.impresos > 0 && { color: tema.colors.warnDark },
            ]}
          >
            {metricas.impresos} impresos • {metricas.pendientes} pend.
          </Text>
        </View>

        <View style={[estilosLocales.kpiCaja, esMovilEstrecho && estilosLocales.kpiCajaMovil]}>
          <Text style={estilosLocales.kpiLbl}>Insumos Sin QR</Text>
          <Text style={estilosLocales.kpiVal}>{metricas.sinQr}</Text>
          <Text style={estilosLocales.kpiSub}>Disponibles para emitir</Text>
        </View>
      </View>

      {/* 3. BUSCADOR Y FILTROS DE ESTADO DE ASIGNACIÓN FÍSICA */}
      <View style={estilosLocales.filtrosBloque}>
        <CampoBusqueda
          value={busqueda}
          onChangeText={establecerBusqueda}
          placeholder="Buscar por código QR, SKU, nombre de insumo o ubicación..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(
            [
              { id: "todos", label: `Todos los QR (${metricas.totalQr})` },
              {
                id: "asignado_estanteria",
                label: `Asignado en Estantería (${metricas.asignados})`,
              },
              { id: "impreso", label: `Impreso (${metricas.impresos})` },
              {
                id: "pendiente_impresion",
                label: `Pendiente Impresión (${metricas.pendientes})`,
              },
              { id: "sin_qr", label: `Insumos Sin QR (${metricas.sinQr})` },
            ] as const
          ).map((chip) => {
            const activo = filtroVista === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => establecerFiltroVista(chip.id)}
                style={[estilosLocales.filtroChip, activo && estilosLocales.filtroChipActivo]}
              >
                <Text
                  style={[
                    estilosLocales.filtroChipTexto,
                    activo && estilosLocales.filtroChipTextoActivo,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. LISTADO RESPONSIVO: INSUMOS SIN QR O TARJETAS DE CÓDIGOS QR */}
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
                  estilosLocales.qrTarjeta,
                  esPantallaAncha && estilosLocales.qrTarjetaAncha,
                ]}
              >
                <View style={estilosLocales.sinQrFila}>
                  <View style={estilosLocales.sinQrIconoCaja}>
                    <Ionicons name="qr-code-outline" size={26} color={tema.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={estilosLocales.skuTexto}>{prod.sku}</Text>
                    <Text style={estilosLocales.nombreTexto}>{prod.name}</Text>
                    <Text style={estilosLocales.metaTexto}>
                      {prod.category} • Stock: {prod.stock} {prod.unit} •{" "}
                      {prod.location || "Sin ubicación"}
                    </Text>
                  </View>
                </View>

                <Boton
                  title="Generar QR para este Insumo"
                  variant="primary"
                  size="sm"
                  icon="add-circle-outline"
                  onPress={() => abrirModalGenerar(prod)}
                  style={{ minHeight: 40 }}
                />
              </Tarjeta>
            ))}
          </View>
        )
      ) : registrosFiltrados.length === 0 ? (
        <EstadoVacio
          icon="qr-code-outline"
          title="Sin códigos QR en este filtro"
          description="Genera un nuevo código QR o cambia el filtro de estado de asignación física."
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
            return (
              <Tarjeta
                key={reg.id}
                variant="elevated"
                style={[
                  estilosLocales.qrTarjeta,
                  esPantallaAncha && estilosLocales.qrTarjetaAncha,
                ]}
              >
                <View style={estilosLocales.qrTarjetaCuerpo}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => establecerQrInspeccionado(reg)}
                    accessibilityLabel={`Ver QR ${reg.codigoQr}`}
                  >
                    <CodigoQrSvg contenido={reg.payloadEmbebido} tamanoPx={94} />
                  </TouchableOpacity>

                  <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
                    <View style={estilosLocales.badgeFila}>
                      <Insignia label={cfg.label} tone={cfg.tone} icon={cfg.icon} size="sm" />
                    </View>
                    <Text style={estilosLocales.codigoQrTexto}>{reg.codigoQr}</Text>
                    <Text style={estilosLocales.nombreTexto} numberOfLines={2}>
                      {reg.nombreInsumo}
                    </Text>
                    <Text style={estilosLocales.metaTexto}>
                      SKU: <Text style={{ fontWeight: "700" }}>{reg.sku}</Text> • {reg.unidad}
                    </Text>
                    <View style={estilosLocales.ubicacionFila}>
                      <Ionicons name="location-outline" size={13} color={tema.colors.primaryDark} />
                      <Text style={estilosLocales.ubicacionTexto} numberOfLines={1}>
                        {reg.ubicacionFisica}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={estilosLocales.qrAccionesFila}>
                  <Boton
                    title="Ver Datos Embebidos"
                    variant="outline"
                    size="sm"
                    icon="code-slash-outline"
                    onPress={() => establecerQrInspeccionado(reg)}
                    style={{ flex: 1, minWidth: 135, minHeight: 38 }}
                  />

                  {reg.estadoAsignacion === "pendiente_impresion" && (
                    <Boton
                      title="Marcar Impreso"
                      variant="secondary"
                      size="sm"
                      icon="print-outline"
                      onPress={() => manejarCambiarEstadoAsignacion(reg.id, "impreso")}
                      style={{ flex: 1, minWidth: 130, minHeight: 38 }}
                    />
                  )}

                  {reg.estadoAsignacion === "impreso" && (
                    <Boton
                      title="Asignar en Estantería"
                      variant="success"
                      size="sm"
                      icon="checkmark-done-outline"
                      onPress={() =>
                        manejarCambiarEstadoAsignacion(reg.id, "asignado_estanteria")
                      }
                      style={{ flex: 1, minWidth: 145, minHeight: 38 }}
                    />
                  )}
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
                        activo && { color: "#f59e0b" },
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
    backgroundColor: "#1c1917",
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
    backgroundColor: "#1c1917",
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
    backgroundColor: "#1c1917",
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
