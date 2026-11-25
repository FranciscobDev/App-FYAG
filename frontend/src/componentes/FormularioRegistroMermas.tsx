import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Insignia } from "@/componentes/base/Insignia";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { Producto, RegistroMerma } from "@/nucleo/tipos";

export type MotivoMerma = "daño" | "caducidad" | "pérdida" | "otro";

export interface OpcionMotivoMerma {
  id: MotivoMerma;
  etiqueta: string;
  subtitulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  fondo: string;
  borde: string;
}

export const OPCIONES_MOTIVOS_MERMA: OpcionMotivoMerma[] = [
  {
    id: "daño",
    etiqueta: "Daño / Rotura",
    subtitulo: "Avería en traslado, caída o estiba",
    icono: "construct-outline",
    color: tema.colors.danger,
    fondo: tema.colors.dangerLight,
    borde: tema.colors.dangerBorder,
  },
  {
    id: "caducidad",
    etiqueta: "Caducidad",
    subtitulo: "Vencimiento o pérdida de propiedades",
    icono: "time-outline",
    color: tema.colors.warn,
    fondo: tema.colors.warnLight,
    borde: tema.colors.warnBorder,
  },
  {
    id: "pérdida",
    etiqueta: "Pérdida / Extravío",
    subtitulo: "Faltante físico en bodega sin retorno",
    icono: "alert-circle-outline",
    color: "#c2410c", // Orange 700
    fondo: "#ffedd5", // Orange 100
    borde: "#fed7aa", // Orange 200
  },
  {
    id: "otro",
    etiqueta: "Falla / Otro",
    subtitulo: "Defecto de fábrica o merma no clasificada",
    icono: "help-circle-outline",
    color: tema.colors.textSecondary,
    fondo: tema.colors.surfaceAlt,
    borde: tema.colors.borderDark,
  },
];

export interface PropiedadesFormularioRegistroMermas {
  /** SKU del producto preseleccionado al abrir el formulario */
  skuInicial?: string;
  /** Control de visibilidad si se usa como modal */
  visible?: boolean;
  /** Callback para cerrar el modal o formulario */
  onCerrar?: () => void;
  /** Callback opcional al registrar exitosamente una merma */
  onExito?: (registro: RegistroMerma) => void;
  /** Determina si se renderiza con encabezado y overlay de modal */
  modoModal?: boolean;
}

/**
 * [FRONT-2] Construir formulario de registro de mermas con selector de motivo,
 * observación obligatoria y cálculo previo del impacto valorizado.
 * -> Listo: Bloquea envío sin observación o con cantidad excesiva.
 * | [SCRUM] Prueba registrar una merma desde la cuenta del Bodeguero.
 */
export const FormularioRegistroMermas: React.FC<PropiedadesFormularioRegistroMermas> = ({
  skuInicial,
  visible = true,
  onCerrar,
  onExito,
  modoModal = true,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 768;

  const { productos, crearRegistroMerma, registrosMerma } = usarAplicacion();
  const { usuario, rolActual } = usarAutenticacion();

  // Filtrar productos activos disponibles en inventario
  const productosDisponibles = useMemo(() => {
    return productos.filter((p) => !p.disabled);
  }, [productos]);

  // Selección de producto
  const [skuSeleccionado, establecerSkuSeleccionado] = useState<string>(
    skuInicial || productosDisponibles.find((p) => p.stock > 0)?.sku || productosDisponibles[0]?.sku || ""
  );

  const [busquedaProducto, establecerBusquedaProducto] = useState("");
  const [modalBuscadorVisible, establecerModalBuscadorVisible] = useState(false);

  // Sincronizar SKU inicial si cambia desde fuera
  useEffect(() => {
    if (skuInicial) {
      establecerSkuSeleccionado(skuInicial);
    }
  }, [skuInicial]);

  const productoActual = useMemo(() => {
    return productosDisponibles.find((p) => p.sku === skuSeleccionado) || productosDisponibles[0];
  }, [productosDisponibles, skuSeleccionado]);

  // =========================================================================
  // 1. SELECTOR DE MOTIVO DE MERMA
  // =========================================================================
  const [motivo, establecerMotivo] = useState<MotivoMerma>("daño");

  // =========================================================================
  // 2. CONTROLADOR DE CANTIDAD (INPUT NUMÉRICO + STEPPERS + CHIPS)
  // =========================================================================
  const [cantidadTexto, establecerCantidadTexto] = useState<string>("1");

  const cantidadNumero = useMemo(() => {
    const parsed = parseFloat(cantidadTexto.replace(/,/g, "."));
    return isNaN(parsed) ? 0 : parsed;
  }, [cantidadTexto]);

  // =========================================================================
  // 3. CAMPO DE OBSERVACIÓN OBLIGATORIA
  // =========================================================================
  const [observacion, establecerObservacion] = useState<string>("");
  const [observacionTocada, establecerObservacionTocada] = useState(false);

  // Sugerencias rápidas para justificar la merma con 1 toque en móvil
  const sugerenciasObservacion = useMemo(() => {
    switch (motivo) {
      case "daño":
        return [
          "Rotura por caída accidental durante maniobra de estiba en bodega",
          "Terminal partido y embalaje perforado por traspaleta",
          "Daño en aislamiento durante descarga de camión proveedor",
        ];
      case "caducidad":
        return [
          "Fecha de caducidad vencida en estante sin posibilidad de uso",
          "Pérdida de presión en contenedor por tiempo prolongado",
          "Componente químico degradado no apto para instalación",
        ];
      case "pérdida":
        return [
          "Diferencia física no localizada tras auditoría y conteo cíclico",
          "Faltante detectado al preparar despacho a faena",
        ];
      case "otro":
      default:
        return [
          "Defecto de fábrica detectado en inspección visual previa a entrega",
          "Insumo devuelto de faena en condiciones no reutilizables",
        ];
    }
  }, [motivo]);

  // =========================================================================
  // 4. CÁLCULO PREVIO DEL IMPACTO VALORIZADO A PMP
  // =========================================================================
  const pmpUnitario = useMemo(() => {
    if (!productoActual) return 0;
    return productoActual.pmp || productoActual.unitCost || 0;
  }, [productoActual]);

  const impactoValorizadoTotal = useMemo(() => {
    return Math.round(cantidadNumero * pmpUnitario);
  }, [cantidadNumero, pmpUnitario]);

  const stockDisponible = productoActual?.stock ?? 0;
  const stockRemanenteProyectado = Math.max(0, stockDisponible - cantidadNumero);

  // =========================================================================
  // 5. VALIDACIONES Y CONDICIÓN [Listo]: BLOQUEO DE ENVÍO
  // =========================================================================
  const esCantidadMayorAStock = cantidadNumero > stockDisponible;
  const esCantidadInvalida = cantidadNumero <= 0;
  const esObservacionInvalida = observacion.trim().length < 5;

  // Bloquea el envío si no hay observación válida o si la cantidad es excesiva
  const bloqueoEnvio = esCantidadMayorAStock || esCantidadInvalida || esObservacionInvalida;

  const motivoBloqueo = useMemo(() => {
    if (esCantidadInvalida) {
      return "Ingresa una cantidad mayor a 0 para dar de baja.";
    }
    if (esCantidadMayorAStock) {
      return `Cantidad excesiva: No puedes dar de baja ${cantidadNumero} ${productoActual?.unit || "un"}. El stock disponible es ${stockDisponible} ${productoActual?.unit || "un"}.`;
    }
    if (esObservacionInvalida) {
      return "La observación y justificación detallada es obligatoria (mínimo 5 caracteres).";
    }
    return null;
  }, [esCantidadInvalida, esCantidadMayorAStock, esObservacionInvalida, cantidadNumero, stockDisponible, productoActual?.unit]);

  // Manejo de steppers
  const manejarAjustarCantidad = (delta: number) => {
    const nueva = Math.max(0, cantidadNumero + delta);
    establecerCantidadTexto(productoActual?.isBulk ? String(Number(nueva.toFixed(3))) : String(Math.floor(nueva)));
  };

  const manejarFijarCantidad = (valor: number) => {
    establecerCantidadTexto(productoActual?.isBulk ? String(Number(valor.toFixed(3))) : String(Math.floor(valor)));
  };

  // =========================================================================
  // 6. ENVÍO Y GUARDADO DE LA MERMA
  // =========================================================================
  const [guardando, establecerGuardando] = useState(false);
  const [mensajeExito, establecerMensajeExito] = useState<string>("");
  const [mensajeError, establecerMensajeError] = useState<string>("");

  const manejarConfirmarMerma = () => {
    establecerObservacionTocada(true);
    establecerMensajeError("");
    establecerMensajeExito("");

    if (bloqueoEnvio) {
      establecerMensajeError(motivoBloqueo || "Por favor, corrige los campos del formulario.");
      return;
    }

    establecerGuardando(true);

    try {
      const cantidadFinal = productoActual?.isBulk
        ? Number(cantidadNumero.toFixed(3))
        : Math.floor(cantidadNumero);

      const res = crearRegistroMerma({
        sku: productoActual.sku,
        productName: productoActual.name,
        quantity: cantidadFinal,
        unit: productoActual.unit,
        pmp: pmpUnitario,
        totalLoss: impactoValorizadoTotal,
        reason: motivo,
        observation: observacion.trim(),
        user: usuario?.name || "Camila Vera Soto",
      });

      if (!res.success) {
        establecerMensajeError(res.error || "No se pudo registrar la merma.");
        establecerGuardando(false);
        return;
      }

      const textoExito = `✓ Merma de ${cantidadFinal} ${productoActual.unit} (${formatearCLP(impactoValorizadoTotal)}) registrada exitosamente por ${usuario?.name || "Bodeguero"}. Stock rebajado en bodega.`;
      establecerMensajeExito(textoExito);

      if (onExito) {
        const nuevoRegistro: RegistroMerma = {
          id: `wst_${Date.now()}`,
          sku: productoActual.sku,
          productName: productoActual.name,
          quantity: cantidadFinal,
          unit: productoActual.unit,
          pmp: pmpUnitario,
          totalLoss: impactoValorizadoTotal,
          reason: motivo,
          observation: observacion.trim(),
          date: new Date().toISOString().slice(0, 10),
          user: usuario?.name || "Camila Vera Soto",
        };
        onExito(nuevoRegistro);
      }

      // Cerrar modal tras breve pausa para ver la confirmación
      setTimeout(() => {
        if (onCerrar) {
          onCerrar();
        }
      }, 1400);
    } catch (err: any) {
      establecerMensajeError(err?.message || "Ocurrió un error inesperado al registrar la merma.");
    } finally {
      establecerGuardando(false);
    }
  };

  // Productos filtrados para el selector
  const productosFiltradosBusqueda = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return productosDisponibles;
    return productosDisponibles.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [productosDisponibles, busquedaProducto]);

  // Contenido interno del formulario
  const contenidoFormulario = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={estilos.contenedorTeclado}
    >
      <ScrollView
        style={estilos.scroll}
        contentContainerStyle={estilos.scrollContenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO */}
        <View style={estilos.encabezado}>
          <View style={{ flex: 1 }}>
            <View style={estilos.etiquetasTicketFila}>
              <Insignia label="[FRONT-2]" tone="danger" size="sm" />
              <Insignia label="Bodega" tone="info" size="sm" />
              <Insignia label="Baja por PMP" tone="warn" size="sm" />
            </View>
            <Text style={estilos.titulo}>Registro de Merma de Insumo</Text>
            <Text style={estilos.subtitulo}>
              Da de baja insumos dañados, caducados o pérdidas físicas valorizadas a PMP
            </Text>
          </View>

          {modoModal && onCerrar && (
            <TouchableOpacity
              onPress={onCerrar}
              style={estilos.botonCerrar}
              accessibilityLabel="Cerrar formulario"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={tema.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 1. SELECTOR DE INSUMO / PRODUCTO */}
        <View style={estilos.bloque}>
          <View style={estilos.bloqueCabeceraFila}>
            <Text style={estilos.bloqueEtiqueta}>
              1. Insumo a dar de baja:
            </Text>
            <TouchableOpacity
              onPress={() => {
                establecerBusquedaProducto("");
                establecerModalBuscadorVisible(true);
              }}
              style={estilos.botonBuscarCatalogo}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={14} color={tema.colors.primaryDark} />
              <Text style={estilos.botonBuscarCatalogoTexto}>Buscar Insumo</Text>
            </TouchableOpacity>
          </View>

          {/* Carrusel de insumos disponibles */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={estilos.carruselInsumos}
          >
            {productosDisponibles.slice(0, 10).map((prod) => {
              const esActivo = prod.sku === productoActual?.sku;
              return (
                <TouchableOpacity
                  key={prod.sku}
                  onPress={() => establecerSkuSeleccionado(prod.sku)}
                  style={[
                    estilos.chipInsumo,
                    esActivo && estilos.chipInsumoActivo,
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: esActivo }}
                >
                  <View style={estilos.chipInsumoTop}>
                    <Text
                      style={[
                        estilos.chipInsumoSku,
                        esActivo && estilos.chipInsumoSkuActivo,
                      ]}
                    >
                      {prod.sku}
                    </Text>
                    <Insignia
                      label={`${prod.stock} ${prod.unit}`}
                      tone={prod.stock > 0 ? (esActivo ? "danger" : "ok") : "mute"}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={[
                      estilos.chipInsumoNombre,
                      esActivo && estilos.chipInsumoNombreActivo,
                    ]}
                    numberOfLines={1}
                  >
                    {prod.name}
                  </Text>
                  <Text style={estilos.chipInsumoPmp}>
                    PMP: {formatearCLP(prod.pmp || prod.unitCost || 0)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tarjeta del Insumo Seleccionado Actual */}
          {productoActual && (
            <Tarjeta variant="outlined" style={estilos.tarjetaInsumoSeleccionado}>
              <View style={estilos.tarjetaInsumoDetalle}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text style={estilos.tarjetaInsumoSku}>{productoActual.sku}</Text>
                    <Insignia label={productoActual.category} tone="mute" size="sm" />
                    {productoActual.isBulk && (
                      <Insignia label="Granel (3 dec.)" tone="info" size="sm" />
                    )}
                  </View>
                  <Text style={estilos.tarjetaInsumoNombre}>{productoActual.name}</Text>
                  <Text style={estilos.tarjetaInsumoUbicacion}>
                    Ubicación: {productoActual.location || "Bodega Central"}
                  </Text>
                </View>

                <View style={estilos.tarjetaInsumoStockCaja}>
                  <Text style={estilos.tarjetaInsumoStockEtiqueta}>Stock Disponible</Text>
                  <Text style={[estilos.tarjetaInsumoStockValor, stockDisponible <= 0 && { color: tema.colors.danger }]}>
                    {stockDisponible} {productoActual.unit}
                  </Text>
                  <Text style={estilos.tarjetaInsumoPmpValor}>
                    PMP: {formatearCLP(pmpUnitario)}
                  </Text>
                </View>
              </View>
            </Tarjeta>
          )}
        </View>

        {/* 2. CONTROLADOR DE CANTIDAD A DAR DE BAJA */}
        <View style={estilos.bloque}>
          <View style={estilos.bloqueCabeceraFila}>
            <Text style={estilos.bloqueEtiqueta}>
              2. Cantidad a dar de baja ({productoActual?.unit || "un"}):
            </Text>
            {stockDisponible > 0 && (
              <TouchableOpacity
                onPress={() => manejarFijarCantidad(stockDisponible)}
                style={estilos.botonMaxStock}
                activeOpacity={0.7}
              >
                <Text style={estilos.botonMaxStockTexto}>Baja Total (Máx: {stockDisponible})</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Chips de Selección Rápida de Cantidad */}
          <View style={estilos.chipsCantidadFila}>
            {[1, 2, 5, 10].map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => manejarFijarCantidad(num)}
                style={[
                  estilos.chipCantidadRapida,
                  cantidadNumero === num && estilos.chipCantidadRapidaActivo,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    estilos.chipCantidadRapidaTexto,
                    cantidadNumero === num && estilos.chipCantidadRapidaTextoActivo,
                  ]}
                >
                  {num} {productoActual?.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stepper + Input Numérico Directo */}
          <View
            style={[
              estilos.cajaStepper,
              esCantidadMayorAStock && estilos.cajaStepperError,
            ]}
          >
            <TouchableOpacity
              onPress={() => manejarAjustarCantidad(-1)}
              style={estilos.botonStepper}
              activeOpacity={0.7}
              accessibilityLabel="Restar 1"
            >
              <Ionicons name="remove" size={20} color={tema.colors.text} />
            </TouchableOpacity>

            <View style={estilos.inputCantidadCaja}>
              <TextInput
                value={cantidadTexto}
                onChangeText={(val) => {
                  const limpio = val.replace(/[^0-9.,]/g, "");
                  establecerCantidadTexto(limpio);
                }}
                keyboardType={productoActual?.isBulk ? "decimal-pad" : "numeric"}
                style={[
                  estilos.inputCantidad,
                  esCantidadMayorAStock && estilos.inputCantidadError,
                ]}
                selectTextOnFocus
                accessibilityLabel="Cantidad a dar de baja"
              />
              <Text style={estilos.simboloUnidad}>{productoActual?.unit}</Text>
            </View>

            <TouchableOpacity
              onPress={() => manejarAjustarCantidad(+1)}
              style={estilos.botonStepper}
              activeOpacity={0.7}
              accessibilityLabel="Sumar 1"
            >
              <Ionicons name="add" size={20} color={tema.colors.text} />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE VALIDACIÓN: CANTIDAD EXCESIVA */}
          {esCantidadMayorAStock && (
            <View style={estilos.alertaCantidadExcesiva}>
              <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
              <Text style={estilos.alertaCantidadExcesivaTexto}>
                <Text style={{ fontWeight: "800" }}>Cantidad excesiva:</Text> No puedes
                dar de baja {cantidadNumero} {productoActual?.unit}. Supera el stock
                disponible ({stockDisponible} {productoActual?.unit}).
              </Text>
            </View>
          )}

          {esCantidadInvalida && cantidadTexto.trim().length > 0 && (
            <View style={estilos.alertaAdvertencia}>
              <Ionicons name="warning" size={16} color={tema.colors.warnDark} />
              <Text style={estilos.alertaAdvertenciaTexto}>
                La cantidad de merma debe ser un valor positivo mayor a 0.
              </Text>
            </View>
          )}
        </View>

        {/* 3. SELECTOR DE MOTIVO DE MERMA */}
        <View style={estilos.bloque}>
          <Text style={estilos.bloqueEtiqueta}>
            3. Motivo de la Merma (Selecciona una causa):
          </Text>

          <View style={estilos.grillaMotivos}>
            {OPCIONES_MOTIVOS_MERMA.map((opt) => {
              const esSeleccionado = motivo === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => establecerMotivo(opt.id)}
                  style={[
                    estilos.tarjetaMotivo,
                    esSeleccionado && {
                      borderColor: opt.color,
                      backgroundColor: opt.fondo,
                      borderWidth: 2,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: esSeleccionado }}
                >
                  <View style={estilos.tarjetaMotivoHeader}>
                    <View
                      style={[
                        estilos.circuloIconoMotivo,
                        { backgroundColor: esSeleccionado ? opt.color : tema.colors.surfaceAlt },
                      ]}
                    >
                      <Ionicons
                        name={opt.icono}
                        size={18}
                        color={esSeleccionado ? "#ffffff" : tema.colors.textSecondary}
                      />
                    </View>
                    {esSeleccionado && (
                      <Ionicons name="checkmark-circle" size={18} color={opt.color} />
                    )}
                  </View>
                  <Text
                    style={[
                      estilos.tarjetaMotivoTitulo,
                      esSeleccionado && { color: opt.color, fontWeight: "800" },
                    ]}
                  >
                    {opt.etiqueta}
                  </Text>
                  <Text style={estilos.tarjetaMotivoSub}>
                    {opt.subtitulo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. CÁLCULO PREVIO DEL IMPACTO VALORIZADO */}
        <Tarjeta variant="elevated" style={estilos.tarjetaImpacto}>
          <View style={estilos.tarjetaImpactoCabecera}>
            <View style={estilos.iconoCalculadoraCaja}>
              <Ionicons name="calculator" size={20} color={tema.colors.danger} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={estilos.tarjetaImpactoTitulo}>
                Cálculo Previo del Impacto Valorizado (PMP)
              </Text>
              <Text style={estilos.tarjetaImpactoSub}>
                Pérdida monetaria directa reflejada en libros contables
              </Text>
            </View>
          </View>

          {/* Gran monto valorizado */}
          <View style={estilos.montoPerdidaCaja}>
            <Text style={estilos.montoPerdidaValor}>
              {formatearCLP(impactoValorizadoTotal)}
            </Text>
            <Text style={estilos.montoPerdidaMoneda}>CLP</Text>
          </View>

          {/* Desglose matemático claro */}
          <View style={estilos.desgloseMatematicoCaja}>
            <Text style={estilos.desgloseFormulaTexto}>
              Fórmula: <Text style={{ fontWeight: "700" }}>{cantidadNumero} {productoActual?.unit}</Text> a dar de baja
              {" × "}
              <Text style={{ fontWeight: "700" }}>{formatearCLP(pmpUnitario)}</Text> (PMP unitario)
            </Text>
          </View>

          {/* Proyección del Stock Remanente */}
          <View style={estilos.proyeccionStockFila}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.proyeccionStockEtiqueta}>Stock Remanente Proyectado:</Text>
              <Text
                style={[
                  estilos.proyeccionStockValor,
                  esCantidadMayorAStock && { color: tema.colors.danger },
                ]}
              >
                {stockRemanenteProyectado} {productoActual?.unit}{" "}
                <Text style={{ fontSize: 11, fontWeight: "500", color: tema.colors.textMuted }}>
                  (Actual: {stockDisponible} {productoActual?.unit})
                </Text>
              </Text>
            </View>

            <Insignia
              label={
                esCantidadMayorAStock
                  ? "Exceso"
                  : stockRemanenteProyectado === 0
                  ? "Stock Cero"
                  : "Dentro de Stock"
              }
              tone={
                esCantidadMayorAStock
                  ? "danger"
                  : stockRemanenteProyectado === 0
                  ? "warn"
                  : "ok"
              }
              size="md"
            />
          </View>
        </Tarjeta>

        {/* 5. CAMPO DE OBSERVACIÓN OBLIGATORIA */}
        <View style={estilos.bloque}>
          <View style={estilos.bloqueCabeceraFila}>
            <Text style={estilos.bloqueEtiqueta}>
              5. Observación y Justificación <Text style={{ color: tema.colors.danger }}>* (Obligatoria)</Text>:
            </Text>
            <Text
              style={[
                estilos.contadorCaracteres,
                observacion.trim().length < 5 && observacionTocada && { color: tema.colors.danger },
              ]}
            >
              {observacion.trim().length} caracteres (mín. 5)
            </Text>
          </View>

          {/* Sugerencias Rápidas de Faena / Bodega */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={estilos.sugerenciasScroll}
          >
            {sugerenciasObservacion.map((sug, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  establecerObservacion(sug);
                  establecerObservacionTocada(true);
                }}
                style={estilos.chipSugerencia}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={12}
                  color={tema.colors.primaryDark}
                  style={{ marginRight: 4 }}
                />
                <Text style={estilos.chipSugerenciaTexto} numberOfLines={1}>
                  {sug}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={[
              estilos.areaTexto,
              esObservacionInvalida && observacionTocada && estilos.areaTextoError,
            ]}
            multiline
            numberOfLines={3}
            value={observacion}
            onChangeText={(text) => {
              establecerObservacion(text);
              establecerObservacionTocada(true);
            }}
            placeholder="Describe detalladamente qué ocurrió con el insumo, ubicación, causas y responsables..."
            placeholderTextColor={tema.colors.textLight}
            textAlignVertical="top"
          />

          {esObservacionInvalida && observacionTocada && (
            <View style={estilos.alertaObservacionError}>
              <Ionicons name="close-circle" size={14} color={tema.colors.danger} />
              <Text style={estilos.alertaObservacionErrorTexto}>
                La observación es obligatoria para auditoría contable (mínimo 5 caracteres).
              </Text>
            </View>
          )}
        </View>

        {/* 6. AVISOS DE ESTADO Y BLOQUEO */}
        {bloqueoEnvio && motivoBloqueo && (
          <View style={estilos.bannerBloqueo}>
            <Ionicons name="lock-closed" size={18} color={tema.colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.bannerBloqueoTitulo}>
                Envío bloqueado por reglas de auditoría:
              </Text>
              <Text style={estilos.bannerBloqueoTexto}>{motivoBloqueo}</Text>
            </View>
          </View>
        )}

        {Boolean(mensajeError) && (
          <View style={estilos.bannerError}>
            <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
            <Text style={estilos.bannerErrorTexto}>{mensajeError}</Text>
          </View>
        )}

        {Boolean(mensajeExito) && (
          <View style={estilos.bannerExito}>
            <Ionicons name="checkmark-circle" size={18} color={tema.colors.ok} />
            <Text style={estilos.bannerExitoTexto}>{mensajeExito}</Text>
          </View>
        )}

        {/* 7. BOTÓN PRINCIPAL DE CONFIRMACIÓN */}
        <View style={estilos.accionesFila}>
          {modoModal && onCerrar && (
            <Boton
              title="Cancelar"
              variant="outline"
              size="lg"
              onPress={onCerrar}
              style={{ flex: 1, minHeight: 48 }}
            />
          )}
          <Boton
            title={
              guardando
                ? "Registrando Baja..."
                : esCantidadMayorAStock
                ? "Bloqueado: Cantidad Excesiva"
                : esObservacionInvalida
                ? "Bloqueado: Falta Observación"
                : `Confirmar Merma (${formatearCLP(impactoValorizadoTotal)})`
            }
            variant="danger"
            size="lg"
            icon="trash-outline"
            onPress={manejarConfirmarMerma}
            disabled={bloqueoEnvio || guardando}
            style={[
              { flex: 2, minHeight: 48 },
              bloqueoEnvio && { opacity: 0.55 },
            ]}
          />
        </View>
      </ScrollView>

      {/* MODAL DE BÚSQUEDA DE PRODUCTO */}
      <Modal
        visible={modalBuscadorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => establecerModalBuscadorVisible(false)}
      >
        <Pressable
          style={estilos.modalOverlay}
          onPress={() => establecerModalBuscadorVisible(false)}
        >
          <Pressable style={estilos.modalContenido} onPress={(e) => e.stopPropagation()}>
            <View style={estilos.modalCabecera}>
              <View>
                <Text style={estilos.modalTitulo}>Seleccionar Insumo para Merma</Text>
                <Text style={estilos.modalSub}>
                  Elige un insumo del catálogo con stock disponible
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => establecerModalBuscadorVisible(false)}
                style={estilos.botonCerrar}
              >
                <Ionicons name="close" size={20} color={tema.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={estilos.modalBuscarCaja}>
              <Ionicons
                name="search-outline"
                size={18}
                color={tema.colors.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={estilos.modalBuscarInput}
                placeholder="Buscar por SKU, nombre o categoría..."
                placeholderTextColor={tema.colors.textLight}
                value={busquedaProducto}
                onChangeText={establecerBusquedaProducto}
                autoFocus
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {productosFiltradosBusqueda.map((prod) => (
                <TouchableOpacity
                  key={prod.sku}
                  onPress={() => {
                    establecerSkuSeleccionado(prod.sku);
                    establecerModalBuscadorVisible(false);
                  }}
                  style={estilos.productoItemModal}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.productoItemNombre}>{prod.name}</Text>
                    <View style={estilos.productoItemMeta}>
                      <Insignia label={prod.sku} tone="mute" size="sm" />
                      <Text style={estilos.productoItemStock}>
                        Stock: {prod.stock} {prod.unit}
                      </Text>
                      <Text style={estilos.productoItemPmp}>
                        PMP: {formatearCLP(prod.pmp || prod.unitCost || 0)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={prod.sku === skuSeleccionado ? "checkmark-circle" : "chevron-forward"}
                    size={20}
                    color={prod.sku === skuSeleccionado ? tema.colors.danger : tema.colors.textLight}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );

  if (modoModal) {
    return (
      <Modal
        visible={visible}
        animationType={esMovil ? "slide" : "fade"}
        transparent
        onRequestClose={onCerrar}
      >
        <View
          style={[
            estilos.modalRootOverlay,
            !esMovil && {
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            },
          ]}
        >
          <View
            style={[
              estilos.modalCardContenedor,
              !esMovil && {
                width: "100%",
                maxWidth: 680,
                borderRadius: tema.radius.xl,
                maxHeight: "90%",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 10,
              },
            ]}
          >
            {contenidoFormulario}
          </View>
        </View>
      </Modal>
    );
  }

  return contenidoFormulario;
};

const estilos = StyleSheet.create({
  modalRootOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCardContenedor: {
    backgroundColor: tema.colors.card,
    borderTopLeftRadius: tema.radius.xl,
    borderTopRightRadius: tema.radius.xl,
    maxHeight: "92%",
    height: "92%",
    overflow: "hidden",
  },
  contenedorTeclado: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  etiquetasTicketFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  titulo: {
    fontSize: tema.fontSize.xl,
    fontWeight: "800",
    color: tema.colors.text,
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  botonCerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  bloque: {
    marginBottom: tema.spacing.lg,
  },
  bloqueCabeceraFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bloqueEtiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "700",
    color: tema.colors.text,
  },
  botonBuscarCatalogo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    borderRadius: tema.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  botonBuscarCatalogoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  carruselInsumos: {
    flexDirection: "row",
    marginBottom: 8,
  },
  chipInsumo: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    marginRight: 8,
    width: 170,
    minHeight: 74,
  },
  chipInsumoActivo: {
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  chipInsumoTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chipInsumoSku: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
  },
  chipInsumoSkuActivo: {
    color: tema.colors.danger,
  },
  chipInsumoNombre: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 2,
  },
  chipInsumoNombreActivo: {
    color: tema.colors.text,
  },
  chipInsumoPmp: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  tarjetaInsumoSeleccionado: {
    backgroundColor: tema.colors.card,
    padding: 12,
    borderRadius: tema.radius.md,
    borderColor: tema.colors.borderDark,
  },
  tarjetaInsumoDetalle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tarjetaInsumoSku: {
    fontSize: tema.fontSize.xs,
    fontWeight: "800",
    color: tema.colors.danger,
  },
  tarjetaInsumoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "700",
    color: tema.colors.text,
    marginBottom: 2,
  },
  tarjetaInsumoUbicacion: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  tarjetaInsumoStockCaja: {
    alignItems: "flex-end",
    paddingLeft: 12,
  },
  tarjetaInsumoStockEtiqueta: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  tarjetaInsumoStockValor: {
    fontSize: tema.fontSize.base,
    fontWeight: "800",
    color: tema.colors.ok,
  },
  tarjetaInsumoPmpValor: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 1,
  },
  botonMaxStock: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  botonMaxStockTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  chipsCantidadFila: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  chipCantidadRapida: {
    flex: 1,
    height: 36,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCantidadRapidaActivo: {
    backgroundColor: tema.colors.dangerLight,
    borderColor: tema.colors.danger,
  },
  chipCantidadRapidaTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.text,
  },
  chipCantidadRapidaTextoActivo: {
    color: tema.colors.danger,
    fontWeight: "800",
  },
  cajaStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.card,
    height: 52,
    overflow: "hidden",
  },
  cajaStepperError: {
    borderColor: tema.colors.danger,
    backgroundColor: "#fffafa",
  },
  botonStepper: {
    width: 52,
    height: "100%",
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  inputCantidadCaja: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  inputCantidad: {
    fontSize: tema.fontSize.xl,
    fontWeight: "800",
    color: tema.colors.text,
    textAlign: "center",
    minWidth: 70,
  },
  inputCantidadError: {
    color: tema.colors.danger,
  },
  simboloUnidad: {
    fontSize: tema.fontSize.base,
    fontWeight: "700",
    color: tema.colors.textMuted,
    marginLeft: 6,
  },
  alertaCantidadExcesiva: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tema.colors.dangerLight,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.danger,
    borderRadius: tema.radius.sm,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  alertaCantidadExcesivaTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.dangerDark,
    lineHeight: 16,
  },
  alertaAdvertencia: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    borderRadius: tema.radius.sm,
    padding: 8,
    marginTop: 6,
    gap: 6,
  },
  alertaAdvertenciaTexto: {
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
  },
  grillaMotivos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tarjetaMotivo: {
    width: "48.5%",
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    minHeight: 88,
  },
  tarjetaMotivoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  circuloIconoMotivo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaMotivoTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
    marginBottom: 2,
  },
  tarjetaMotivoSub: {
    fontSize: 10,
    color: tema.colors.textMuted,
    lineHeight: 13,
  },
  tarjetaImpacto: {
    padding: tema.spacing.md,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    marginBottom: tema.spacing.lg,
  },
  tarjetaImpactoCabecera: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconoCalculadoraCaja: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: tema.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaImpactoTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "800",
    color: tema.colors.text,
  },
  tarjetaImpactoSub: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  montoPerdidaCaja: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.md,
    marginBottom: 10,
  },
  montoPerdidaValor: {
    fontSize: 26,
    fontWeight: "900",
    color: tema.colors.danger,
    letterSpacing: -0.5,
  },
  montoPerdidaMoneda: {
    fontSize: tema.fontSize.sm,
    fontWeight: "800",
    color: tema.colors.dangerDark,
    marginLeft: 6,
  },
  desgloseMatematicoCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 10,
  },
  desgloseFormulaTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    textAlign: "center",
  },
  proyeccionStockFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
  },
  proyeccionStockEtiqueta: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  proyeccionStockValor: {
    fontSize: tema.fontSize.sm,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 2,
  },
  contadorCaracteres: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  sugerenciasScroll: {
    flexDirection: "row",
    marginBottom: 8,
  },
  chipSugerencia: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    maxWidth: 240,
  },
  chipSugerenciaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.primaryDark,
  },
  areaTexto: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    padding: 12,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
    minHeight: 74,
  },
  areaTextoError: {
    borderColor: tema.colors.danger,
    backgroundColor: "#fffafa",
  },
  alertaObservacionError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  alertaObservacionErrorTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.danger,
  },
  bannerBloqueo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  bannerBloqueoTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.dangerDark,
    marginBottom: 2,
  },
  bannerBloqueoTexto: {
    fontSize: 11,
    color: tema.colors.dangerDark,
    lineHeight: 15,
  },
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  bannerErrorTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.dangerDark,
  },
  bannerExito: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.okBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  bannerExitoTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.okDark,
  },
  accionesFila: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: tema.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContenido: {
    backgroundColor: tema.colors.card,
    borderTopLeftRadius: tema.radius.xl,
    borderTopRightRadius: tema.radius.xl,
    padding: tema.spacing.lg,
    maxHeight: "80%",
  },
  modalCabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  modalTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "800",
    color: tema.colors.text,
  },
  modalSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  modalBuscarCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: tema.spacing.md,
  },
  modalBuscarInput: {
    flex: 1,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
  },
  productoItemModal: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  productoItemNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  productoItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  productoItemStock: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.text,
  },
  productoItemPmp: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
});
