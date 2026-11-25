import React, { useEffect } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
} from "@/componentes/comunes";
import { estilos } from "../estilos";
import {
  actualizarLineaChecklistTablet,
  calcularSaldoPendienteLineaOc,
} from "../recepcionChecklistUtils";

export interface PropiedadesSeccionRecepcionBodega {
  activoPestana: any;
  activoRecepcionOrden: any;
  establecerRecepcionListaChequeo: any;
  establecerSeleccionadoFacturaNumero: any;
  establecerSeleccionadoOcCodigo: any;
  facturasCompra: any;
  manejarAbrirEscaner: any;
  manejarConfirmarRecepcion: any;
  ordenesCompra: any;
  productos: any;
  recepcionListaChequeo: any;
  seleccionadoFacturaNumero: any;
  seleccionadoOcCodigo: any;
  tieneRecepcionDiscrepancy: any;
  ultimoEscaneoRecepcion?: {
    tipo: "ok" | "alerta";
    sku?: string;
    nombre?: string;
    tiempoTexto: string;
    mensaje: string;
  } | null;
  onLimpiarUltimoEscaneo?: () => void;
  width: any;
}

export const SeccionRecepcionBodega: React.FC<PropiedadesSeccionRecepcionBodega> = ({
  activoPestana,
  activoRecepcionOrden,
  establecerRecepcionListaChequeo,
  establecerSeleccionadoFacturaNumero,
  establecerSeleccionadoOcCodigo,
  facturasCompra,
  manejarAbrirEscaner,
  manejarConfirmarRecepcion,
  ordenesCompra,
  productos,
  recepcionListaChequeo,
  seleccionadoFacturaNumero,
  seleccionadoOcCodigo,
  tieneRecepcionDiscrepancy,
  ultimoEscaneoRecepcion,
  onLimpiarUltimoEscaneo,
  width,
}) => {
  const ordenesPendientes = ordenesCompra.filter(
    (o: any) => o.status === "enviada" || o.status === "recibida_parcial"
  );
  const ordenesCompletadas = ordenesCompra.filter(
    (o: any) => o.status === "recibida" || o.status === "cerrada"
  );
  const totalLineasPorVerificar = ordenesPendientes.reduce(
    (acc: number, o: any) =>
      acc + o.items.filter((it: any) => (it.receivedQuantity || 0) < it.quantity).length,
    0
  );

  const esMovilEstrecho = (width || 400) < 440;
  const [vistaRecepcion, setVistaRecepcion] = React.useState<"cola" | "recibidas">(
    ordenesPendientes.length > 0 ? "cola" : "cola"
  );

  // Auto-seleccionar la primera OC pendiente si no hay ninguna seleccionada
  useEffect(() => {
    if (
      activoPestana === "recepcion" &&
      ordenesPendientes.length > 0 &&
      !seleccionadoOcCodigo
    ) {
      establecerSeleccionadoOcCodigo(ordenesPendientes[0].code);
    }
  }, [activoPestana, ordenesPendientes, seleccionadoOcCodigo]);

  if (activoPestana !== "recepcion") return null;

  return (
    <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
      {/* 1. CABECERA COMPACTA INDUSTRIAL + ACCIÓN DE ESCANEO */}
      <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
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
              <Ionicons name="checkbox-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                Estación de Recepción — Bodega
              </Text>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                {ordenesPendientes.length > 0 ? (
                  <>
                    <Text style={{ fontWeight: "800", color: tema.colors.warnDark }}>
                      {ordenesPendientes.length} OC por recibir
                    </Text>{" "}
                    ({totalLineasPorVerificar} ítems por verificar)
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                      Recepción al día
                    </Text>{" "}
                    • {ordenesCompletadas.length} OC recibidas en historial
                  </>
                )}
              </Text>
            </View>
          </View>

          <Boton
            title="Escanear QR / Barras"
            variant="primary"
            size="sm"
            icon="qr-code-outline"
            onPress={() => manejarAbrirEscaner()}
            style={{ minHeight: 40 }}
            fullWidth={esMovilEstrecho}
          />
        </View>
      </Tarjeta>

      {/* 2. PESTAÑAS KPI COMPACTAS EN 1 SOLA FILA SIMÉTRICA (SIN TARJETA SUELTA ABAJO) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {[
          {
            id: "cola" as const,
            titulo: "OC por Recibir",
            valor: ordenesPendientes.length,
            sub: `${totalLineasPorVerificar} ítems pend.`,
            icon: "cart-outline" as const,
            bg: ordenesPendientes.length > 0 ? "#fffbeb" : "#f1f5f9",
            border: ordenesPendientes.length > 0 ? "#fcd34d" : "#cbd5e1",
            borderActivo: ordenesPendientes.length > 0 ? "#d97706" : "#475569",
            textColor: ordenesPendientes.length > 0 ? "#92400e" : "#334155",
            clickable: true,
          },
          {
            id: "items" as const,
            titulo: "Por Verificar",
            valor: totalLineasPorVerificar,
            sub: "Líneas de OC",
            icon: "cube-outline" as const,
            bg: "#fffbeb",
            border: "#fcd34d",
            borderActivo: "#d97706",
            textColor: "#92400e",
            clickable: false,
          },
          {
            id: "recibidas" as const,
            titulo: "OC Recibidas",
            valor: ordenesCompletadas.length,
            sub: "Ingresadas OK",
            icon: "checkmark-done-circle-outline" as const,
            bg: "#f0fdf4",
            border: "#86efac",
            borderActivo: "#16a34a",
            textColor: "#166534",
            clickable: true,
          },
        ].map((kpi) => {
          const activo =
            (kpi.id === "cola" && vistaRecepcion === "cola") ||
            (kpi.id === "recibidas" && vistaRecepcion === "recibidas");
          return (
            <TouchableOpacity
              key={kpi.id}
              activeOpacity={kpi.clickable ? 0.8 : 1}
              onPress={() => {
                if (kpi.id === "cola") setVistaRecepcion("cola");
                if (kpi.id === "recibidas") setVistaRecepcion("recibidas");
              }}
              style={{
                flex: 1,
                minWidth: 105,
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
                    fontSize: 10,
                    fontWeight: "800",
                    color: kpi.textColor,
                    textTransform: "uppercase",
                  }}
                  numberOfLines={1}
                >
                  {kpi.titulo}
                </Text>
                <Ionicons name={kpi.icon} size={14} color={kpi.textColor} />
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
                  {activo ? "● Activa" : kpi.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. COLA DE ÓRDENES DE COMPRA PENDIENTES DE RECEPCIÓN */}
      {vistaRecepcion === "cola" && (
        <View style={estilos.ocSeleccionarSeccion}>
          <View style={estilos.ocSeleccionarEncabezado}>
            <Ionicons name="receipt-outline" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
            <Text style={estilos.ocSeleccionarEtiqueta}>
              1. Ordenes de Compra en Cola de Recepción ({ordenesPendientes.length}):
            </Text>
          </View>

          {ordenesPendientes.length === 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: "#f0fdf4",
                borderWidth: 1.5,
                borderColor: "#86efac",
                borderLeftWidth: 6,
                borderLeftColor: "#16a34a",
                borderRadius: 12,
                padding: 14,
                marginVertical: 6,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#dcfce7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="checkmark-done" size={20} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#166534" }}>
                  Sin órdenes pendientes de recepción
                </Text>
                <Text style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                  Todas las órdenes de compra enviadas ya fueron recibidas e ingresadas a bodega.
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {ordenesPendientes.map((o: any) => {
                const esSeleccionado = seleccionadoOcCodigo === o.code;
                const esPartial = o.status === "recibida_parcial";
                const totalPendientesOc = o.items.reduce(
                  (acc: number, it: any) => acc + Math.max(0, it.quantity - (it.receivedQuantity || 0)),
                  0
                );

                return (
                  <TouchableOpacity
                    key={o.code}
                    onPress={() => establecerSeleccionadoOcCodigo(o.code)}
                    style={{
                      flex: 1,
                      minWidth: 250,
                      padding: 12,
                      backgroundColor: "#fffbeb",
                      borderColor: esSeleccionado ? "#d97706" : "#fcd34d",
                      borderWidth: esSeleccionado ? 2 : 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: "#d97706",
                      borderRadius: 12,
                    }}
                    activeOpacity={0.85}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons
                          name={esSeleccionado ? "radio-button-on" : "radio-button-off"}
                          size={16}
                          color={esSeleccionado ? tema.colors.primaryDark : tema.colors.textMuted}
                        />
                        <Text style={{ fontSize: 14, fontWeight: "800", color: "#92400e" }}>
                          {o.code}
                        </Text>
                      </View>
                      <Insignia
                        label={esPartial ? "Parcial" : "En Espera"}
                        tone="warn"
                        size="sm"
                      />
                    </View>

                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        fontWeight: "800",
                        color: tema.colors.text,
                      }}
                    >
                      {o.supplier}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 2 }}>
                      📅 Entrega esperada: {o.expectedDate}
                    </Text>

                    <View
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: "#fde68a",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                        {o.items.length} {o.items.length === 1 ? "insumo" : "insumos"} ({totalPendientesOc} un. pend.)
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: esSeleccionado ? tema.colors.primaryDark : tema.colors.textSecondary,
                        }}
                      >
                        {esSeleccionado ? "● En verificación" : "Tocar para verificar →"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 3. ESTACIÓN DE VERIFICACIÓN Y CONTROL DE CALIDAD */}
      {activoRecepcionOrden && (
        <Tarjeta variant="elevated">
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: tema.colors.borderLight,
            }}
          >
            <View style={{ flex: 1, minWidth: 200 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <Text style={estilos.ocTitulo}>
                  2. Control de Recepción: {activoRecepcionOrden.code}
                </Text>
                <Insignia
                  label={activoRecepcionOrden.status === "recibida_parcial" ? "Parcial" : "Pendiente"}
                  tone={activoRecepcionOrden.status === "recibida_parcial" ? "warn" : "info"}
                  size="sm"
                />
              </View>
              <Text style={[estilos.ordenFecha, { marginTop: 2 }]}>
                Proveedor: {activoRecepcionOrden.supplier} ({activoRecepcionOrden.supplierRut || "76.xxx.xxx-x"}) • Esperada: {activoRecepcionOrden.expectedDate}
              </Text>
            </View>

            <Boton
              variant="primary"
              size="sm"
              title="Escanear QR / Barras"
              icon="qr-code-outline"
              onPress={() => manejarAbrirEscaner()}
              style={{ minHeight: 40 }}
            />
          </View>

          {/* Resultado del último escaneo óptico en Recepción (H33) */}
          {ultimoEscaneoRecepcion && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: tema.radius.md,
                marginBottom: 12,
                backgroundColor:
                  ultimoEscaneoRecepcion.tipo === "ok"
                    ? tema.colors.okLight
                    : tema.colors.dangerLight,
                borderWidth: 1,
                borderColor:
                  ultimoEscaneoRecepcion.tipo === "ok"
                    ? tema.colors.ok
                    : tema.colors.danger,
              }}
            >
              <Ionicons
                name={
                  ultimoEscaneoRecepcion.tipo === "ok"
                    ? "checkmark-circle"
                    : "alert-circle"
                }
                size={20}
                color={
                  ultimoEscaneoRecepcion.tipo === "ok"
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
                      ultimoEscaneoRecepcion.tipo === "ok"
                        ? tema.colors.okDark
                        : tema.colors.danger,
                  }}
                >
                  {ultimoEscaneoRecepcion.tipo === "ok"
                    ? `Lectura óptica exitosa (${ultimoEscaneoRecepcion.tiempoTexto})`
                    : `Lectura bloqueada (${ultimoEscaneoRecepcion.tiempoTexto})`}
                </Text>
                <Text style={{ fontSize: 12, color: tema.colors.text, marginTop: 2 }}>
                  {ultimoEscaneoRecepcion.mensaje}
                </Text>
              </View>
              {onLimpiarUltimoEscaneo && (
                <TouchableOpacity onPress={onLimpiarUltimoEscaneo} style={{ padding: 4 }}>
                  <Ionicons name="close" size={16} color={tema.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Selector de Factura de Compra Vinculada */}
          <View style={estilos.facturaSeleccionarContenedor}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="document-text-outline" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={estilos.facturaSeleccionarTitulo}>Factura Asociada (para recálculo PMP):</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {facturasCompra
                .filter((inv: any) => !inv.orderCode || inv.orderCode === activoRecepcionOrden.code)
                .map((inv: any) => {
                  const esLinked = seleccionadoFacturaNumero === inv.number;
                  return (
                    <TouchableOpacity
                      key={inv.id}
                      onPress={() => establecerSeleccionadoFacturaNumero(esLinked ? "" : inv.number)}
                      style={[estilos.facturaChip, esLinked && estilos.facturaChipActivo]}
                    >
                      <Text style={[estilos.facturaChipTexto, esLinked && estilos.facturaChipTextoActivo]}>
                        {esLinked ? "✓ " : ""}Factura N° {inv.number} ({formatearCLP(inv.subtotalNet)} neto)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            {seleccionadoFacturaNumero ? (
              <Text style={estilos.facturaLinkedAviso}>
                El PMP se recalculará automáticamente con el costo neto de la Factura N° {seleccionadoFacturaNumero}.
              </Text>
            ) : (
              <Text style={estilos.facturaHintAviso}>
                Opcional: seleccione la factura si ya fue registrada para actualizar el PMP exacto.
              </Text>
            )}
          </View>

          {/* Alerta de discrepancia si lo contado no coincide con lo pendiente de la OC o con la factura */}
          {tieneRecepcionDiscrepancy && (
            <View style={estilos.discrepancyBanner}>
              <Ionicons name="warning" size={20} color={tema.colors.warnDark} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.discrepancyBannerTitulo}>
                  Recepción parcial, unidades en cuarentena o diferencia con factura
                </Text>
                <Text style={estilos.discrepancyBannerTexto}>
                  Lo conforme ingresará a stock disponible, lo defectuoso pasará a cuarentena, el faltante quedará como saldo pendiente de la OC y se alertará al Administrador si difiere de lo facturado.
                </Text>
              </View>
            </View>
          )}

          {/* Barra de Progreso Acumulado de la OC en Vista Tablet */}
          {(() => {
            const totalOrdenadoOc = activoRecepcionOrden.items.reduce(
              (acc: number, it: any) => acc + Number(it.quantity || 0),
              0
            );
            const totalRecibidoAntesOc = activoRecepcionOrden.items.reduce(
              (acc: number, it: any) => acc + Number(it.receivedQuantity || 0),
              0
            );
            const totalConformeHoyOc = recepcionListaChequeo.reduce(
              (acc: number, c: any) => acc + Number(c.received || 0),
              0
            );
            const totalDefectuosoHoyOc = recepcionListaChequeo.reduce(
              (acc: number, c: any) => acc + Number(c.defective || 0),
              0
            );
            const saldoPendienteTrasHoy = Math.max(
              0,
              Number((totalOrdenadoOc - (totalRecibidoAntesOc + totalConformeHoyOc)).toFixed(3))
            );
            const pctAntes = totalOrdenadoOc > 0 ? Math.min(100, Math.round((totalRecibidoAntesOc / totalOrdenadoOc) * 100)) : 0;
            const pctConHoy =
              totalOrdenadoOc > 0
                ? Math.min(100, Math.round(((totalRecibidoAntesOc + totalConformeHoyOc) / totalOrdenadoOc) * 100))
                : 0;

            return (
              <View
                style={{
                  backgroundColor: tema.colors.surfaceAlt,
                  borderRadius: tema.radius.md,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: tema.colors.border,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text }}>
                    Avance de Recepción OC ({totalRecibidoAntesOc} recibidos antes + {totalConformeHoyOc} conformes hoy / {totalOrdenadoOc} total)
                  </Text>
                  <Insignia
                    label={
                      saldoPendienteTrasHoy === 0
                        ? `100% Completa tras confirmar`
                        : `${pctConHoy}% • Quedarán ${saldoPendienteTrasHoy} un. pendientes`
                    }
                    tone={saldoPendienteTrasHoy === 0 ? "ok" : "warn"}
                    size="sm"
                  />
                </View>
                <View style={{ height: 8, backgroundColor: tema.colors.borderLight, borderRadius: 4, overflow: "hidden", flexDirection: "row" }}>
                  {pctAntes > 0 && (
                    <View style={{ width: `${pctAntes}%`, backgroundColor: tema.colors.info }} />
                  )}
                  {pctConHoy > pctAntes && (
                    <View style={{ width: `${pctConHoy - pctAntes}%`, backgroundColor: tema.colors.ok }} />
                  )}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: tema.colors.okDark, fontWeight: "700" }}>
                    ✓ A Stock Disponible hoy: +{totalConformeHoyOc} un.
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.danger, fontWeight: "700" }}>
                    ✕ A Cuarentena hoy: +{totalDefectuosoHoyOc} un.
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.warnDark, fontWeight: "700" }}>
                    ! Saldo Pendiente OC tras confirmar: {saldoPendienteTrasHoy} un.
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Checklist interactivo por línea adaptable a Tablet */}
          <Text style={[estilos.ocSeleccionarEtiqueta, { marginTop: 4, marginBottom: 8 }]}>
            3. Checklist Tablet por Línea de la OC ({recepcionListaChequeo.length}):
          </Text>
          {recepcionListaChequeo.map((item: any, idx: any) => {
            const poItem = activoRecepcionOrden.items.find((i: any) => i.sku === item.sku);
            const prod = productos.find((p: any) => p.sku === item.sku);
            const esBulk = Boolean(prod?.isBulk || ["kg", "m", "l"].includes(prod?.unit?.toLowerCase() || ""));
            const facturaActiva = facturasCompra.find(
              (inv: any) =>
                (seleccionadoFacturaNumero && inv.number === seleccionadoFacturaNumero) ||
                inv.orderCode === activoRecepcionOrden.code
            );
            const itemFactura = facturaActiva?.items?.find((fi: any) => fi.sku === item.sku);

            const cantidadOrdered = poItem?.quantity || 0;
            const cantidadAlreadyRecibido = poItem?.receivedQuantity || 0;
            const cantidadCuarentenaPrevia = poItem?.defectiveQuantity || 0;
            const pending = poItem ? calcularSaldoPendienteLineaOc(poItem) : 0;
            const saldoRestanteTrasHoy = Math.max(0, Number((pending - item.received).toFixed(3)));
            const esDiscrepant = item.received + item.defective + item.missing !== pending;
            const difiereDeFactura = Boolean(
              itemFactura && cantidadAlreadyRecibido + item.received !== itemFactura.quantity
            );

            const contenedorCapacity = prod?.containerCapacity || 100;
            const contenedorFreeSpace = Math.max(0, contenedorCapacity - (prod?.stock || 0));
            const exceedsContenedor = esBulk && item.received > contenedorFreeSpace;

            const aplicarCambioLinea = (
              cambio: Partial<{ received: number; defective: number; missing: number; scanned: boolean }>
            ) => {
              establecerRecepcionListaChequeo((prev: any) =>
                prev.map((c: any, i: any) =>
                  i === idx ? actualizarLineaChecklistTablet(c, pending, cambio, esBulk) : c
                )
              );
            };

            const establecerCompletoConforme = () => {
              aplicarCambioLinea({ received: pending, defective: 0, missing: 0 });
            };

            const establecerEntregaParcialMitad = () => {
              const mitad = esBulk ? Number((pending / 2).toFixed(3)) : Math.max(1, Math.floor(pending / 2));
              const faltante = Math.max(0, Number((pending - mitad).toFixed(3)));
              aplicarCambioLinea({ received: mitad, defective: 0, missing: faltante });
            };

            const establecerCompletoFaltante = () => {
              aplicarCambioLinea({ received: 0, defective: 0, missing: pending });
            };

            const establecerCompletoDefectuoso = () => {
              aplicarCambioLinea({ received: 0, defective: pending, missing: 0 });
            };

            const paso = esBulk ? 0.5 : 1;

            return (
              <View key={item.sku} style={[estilos.verificarElementoTarjeta, item.scanned && estilos.verificarElementoTarjetaEscaneado]}>
                {/* Header del ítem */}
                <View style={estilos.verificarElementoSuperiorFila}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <Text style={estilos.verificarElementoNombre}>{poItem?.name || item.sku}</Text>
                      <Insignia label={item.sku} tone="info" size="sm" />
                      {item.scanned && <Insignia label="Escaneado" tone="ok" size="sm" />}
                      {esBulk && <Insignia label="Granel" tone="info" size="sm" />}
                      {saldoRestanteTrasHoy === 0 ? (
                        <Insignia label="Línea Completa" tone="ok" size="sm" />
                      ) : (
                        <Insignia label={`Pendiente tras hoy: ${saldoRestanteTrasHoy} ${poItem?.unit}`} tone="warn" size="sm" />
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => manejarAbrirEscaner(item.sku)}
                    style={estilos.filaEscanearBoton}
                    accessibilityLabel={`Escanear SKU ${item.sku}`}
                  >
                    <Ionicons name="qr-code-outline" size={15} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                    <Text style={estilos.filaEscanearBotonTexto}>Escanear</Text>
                  </TouchableOpacity>
                </View>

                {/* Desglose de cantidades Pedida / Ya Recibida / Cuarentena / Saldo Pendiente OC */}
                <View style={estilos.cantidadMetricFila}>
                  <View style={estilos.cantidadMetricColumna}>
                    <Text style={estilos.cantidadMetricLbl}>Pedido OC</Text>
                    <Text style={estilos.cantidadMetricValor}>{cantidadOrdered} {poItem?.unit}</Text>
                  </View>
                  <View style={estilos.cantidadMetricColumna}>
                    <Text style={estilos.cantidadMetricLbl}>Recibido Antes</Text>
                    <Text style={estilos.cantidadMetricValor}>{cantidadAlreadyRecibido} {poItem?.unit}</Text>
                  </View>
                  {cantidadCuarentenaPrevia > 0 && (
                    <View style={estilos.cantidadMetricColumna}>
                      <Text style={[estilos.cantidadMetricLbl, { color: tema.colors.danger }]}>En Cuarentena</Text>
                      <Text style={[estilos.cantidadMetricValor, { color: tema.colors.danger }]}>
                        {cantidadCuarentenaPrevia} {poItem?.unit}
                      </Text>
                    </View>
                  )}
                  <View style={[estilos.cantidadMetricColumna, estilos.cantidadMetricColumnaDestacado]}>
                    <Text style={[estilos.cantidadMetricLbl, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                      Saldo Pendiente OC
                    </Text>
                    <Text style={[estilos.cantidadMetricValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                      {pending} {poItem?.unit}
                    </Text>
                  </View>
                </View>

                {/* Contraste contra Factura Asociada si existe */}
                {itemFactura && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      backgroundColor: difiereDeFactura ? tema.colors.warnLight : tema.colors.okLight,
                      borderRadius: tema.radius.sm,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: difiereDeFactura ? tema.colors.warnDark : tema.colors.okDark,
                      }}
                    >
                      Factura N° {facturaActiva.number}: Facturado {itemFactura.quantity} {poItem?.unit} vs Recibido Conforme Total {cantidadAlreadyRecibido + item.received} {poItem?.unit}
                    </Text>
                    {difiereDeFactura && (
                      <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.danger }}>
                        ⚠ Alerta al Administrador por diferencia con factura
                      </Text>
                    )}
                  </View>
                )}

                {esBulk && (
                  <View style={[estilos.bulkInfoCaja, exceedsContenedor && estilos.bulkInfoCajaAdvertencia]}>
                    <Ionicons
                      name={exceedsContenedor ? "warning-outline" : "cube-outline"}
                      size={16}
                      color={exceedsContenedor ? tema.colors.warnDark : tema.colors.info}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[estilos.bulkInfoTexto, exceedsContenedor && { color: tema.colors.warnDark }]}>
                      Contenedor: Stock actual {prod?.stock || 0} {prod?.unit} • Capacidad máx: {contenedorCapacity} {prod?.unit} (Libre: {contenedorFreeSpace.toFixed(3)} {prod?.unit})
                    </Text>
                  </View>
                )}

                {/* Botones de acción rápida táctil adaptados a Tablet */}
                <View style={[estilos.rapidoAccionFila, { flexWrap: "wrap", gap: 6 }]}>
                  <TouchableOpacity
                    onPress={establecerCompletoConforme}
                    style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.okLight, minHeight: 38 }]}
                  >
                    <Ionicons name="checkmark" size={14} color={tema.colors.okDark} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.okDark }]}>Todo Conforme</Text>
                  </TouchableOpacity>

                  {pending > 1 && (
                    <TouchableOpacity
                      onPress={establecerEntregaParcialMitad}
                      style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.primaryLight, minHeight: 38 }]}
                    >
                      <Ionicons name="git-branch-outline" size={14} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.primaryDark }]}>
                        Parcial 50%
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={establecerCompletoDefectuoso}
                    style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.dangerLight, minHeight: 38 }]}
                  >
                    <Ionicons name="alert-circle-outline" size={14} color={tema.colors.danger} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.danger }]}>Defectuoso</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={establecerCompletoFaltante}
                    style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.warnLight, minHeight: 38 }]}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={tema.colors.warnDark} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.warnDark }]}>Faltante</Text>
                  </TouchableOpacity>
                </View>

                {/* 3 Columnas de entrada táctil con controles - / + para Tablet: Conforme / Defectuoso / Faltante */}
                <View style={[estilos.verificarEntradaFila, width < 520 && { flexDirection: "column", gap: 8 }]}>
                  {/* COLUMNA 1: CONFORME (A STOCK DISPONIBLE) */}
                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.okDark }]}>✓ Conforme (A Stock)</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ received: Math.max(0, item.received - paso) })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.okLight,
                          borderWidth: 1,
                          borderColor: tema.colors.ok,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Disminuir conforme ${item.sku}`}
                      >
                        <Ionicons name="remove" size={18} color={tema.colors.okDark} />
                      </TouchableOpacity>
                      <TextInput
                        value={String(item.received)}
                        onChangeText={(v: any) => {
                          const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                          aplicarCambioLinea({ received: val });
                        }}
                        keyboardType={esBulk ? "decimal-pad" : "numeric"}
                        style={[estilos.verificarEntrada, { flex: 1, borderColor: tema.colors.ok, backgroundColor: tema.colors.okLight }]}
                      />
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ received: item.received + paso })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.okLight,
                          borderWidth: 1,
                          borderColor: tema.colors.ok,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Aumentar conforme ${item.sku}`}
                      >
                        <Ionicons name="add" size={18} color={tema.colors.okDark} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* COLUMNA 2: DEFECTUOSO (A CUARENTENA) */}
                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.danger }]}>✕ Defectuoso (Cuarentena)</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ defective: Math.max(0, item.defective - paso) })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.dangerLight,
                          borderWidth: 1,
                          borderColor: tema.colors.danger,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Disminuir defectuoso ${item.sku}`}
                      >
                        <Ionicons name="remove" size={18} color={tema.colors.danger} />
                      </TouchableOpacity>
                      <TextInput
                        value={String(item.defective)}
                        onChangeText={(v: any) => {
                          const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                          aplicarCambioLinea({ defective: val });
                        }}
                        keyboardType={esBulk ? "decimal-pad" : "numeric"}
                        style={[estilos.verificarEntrada, { flex: 1, borderColor: tema.colors.danger, backgroundColor: tema.colors.dangerLight }]}
                      />
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ defective: item.defective + paso })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.dangerLight,
                          borderWidth: 1,
                          borderColor: tema.colors.danger,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Aumentar defectuoso ${item.sku}`}
                      >
                        <Ionicons name="add" size={18} color={tema.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* COLUMNA 3: FALTANTE / SALDO PENDIENTE */}
                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.warnDark }]}>! Faltante (Saldo Pend.)</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ missing: Math.max(0, item.missing - paso) })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.warnLight,
                          borderWidth: 1,
                          borderColor: tema.colors.warn,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Disminuir faltante ${item.sku}`}
                      >
                        <Ionicons name="remove" size={18} color={tema.colors.warnDark} />
                      </TouchableOpacity>
                      <TextInput
                        value={String(item.missing)}
                        onChangeText={(v: any) => {
                          const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                          aplicarCambioLinea({ missing: val });
                        }}
                        keyboardType={esBulk ? "decimal-pad" : "numeric"}
                        style={[estilos.verificarEntrada, { flex: 1, borderColor: tema.colors.warn, backgroundColor: tema.colors.warnLight }]}
                      />
                      <TouchableOpacity
                        onPress={() => aplicarCambioLinea({ missing: item.missing + paso })}
                        style={{
                          width: 36,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: tema.colors.warnLight,
                          borderWidth: 1,
                          borderColor: tema.colors.warn,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        accessibilityLabel={`Aumentar faltante ${item.sku}`}
                      >
                        <Ionicons name="add" size={18} color={tema.colors.warnDark} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {item.defective > 0 && <Insignia label={`${item.defective} a Cuarentena`} tone="danger" size="sm" />}
                  {item.missing > 0 && <Insignia label={`${item.missing} Saldo Pendiente`} tone="warn" size="sm" />}
                  {esDiscrepant && <Insignia label="Discrepancia en Conteo" tone="warn" size="sm" />}
                  {difiereDeFactura && <Insignia label="Difiere de Factura" tone="danger" size="sm" />}
                </View>
              </View>
            );
          })}

          <Boton
            title="Confirmar Ingreso a Bodega"
            variant="success"
            size="md"
            icon="checkmark-done-outline"
            onPress={manejarConfirmarRecepcion}
            style={{ marginTop: 14, minHeight: 48 }}
            fullWidth={width < 768}
          />

          <View style={estilos.confirmarExplanatoryPie}>
            <Ionicons name="information-circle-outline" size={16} color={tema.colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={estilos.confirmarExplanatoryTexto}>
              Al confirmar: Lo conforme ingresa a stock disponible en Cardex; lo defectuoso pasa a cuarentena y lo faltante queda pendiente.
            </Text>
          </View>
        </Tarjeta>
      )}

      {/* 4. HISTORIAL DE ÚLTIMAS ÓRDENES RECIBIDAS CON SEMÁFORO VERDE */}
      {ordenesCompletadas.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="checkmark-done-circle-outline" size={16} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={estilos.ocSeleccionarEtiqueta}>
              Órdenes de Compra Recibidas en Bodega ({ordenesCompletadas.length}):
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            {ordenesCompletadas.map((oc: any) => (
              <Tarjeta
                key={oc.id}
                variant="outlined"
                style={{
                  padding: 12,
                  backgroundColor: "#f0fdf4",
                  borderColor: "#86efac",
                  borderWidth: 1.5,
                  borderLeftWidth: 6,
                  borderLeftColor: "#16a34a",
                  borderRadius: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#166534" }}>
                        {oc.code}
                      </Text>
                      {oc.invoiceNumber && (
                        <Insignia label={`FAC-${oc.invoiceNumber}`} tone="info" size="sm" />
                      )}
                      <Insignia label="Recibida OK" tone="ok" icon="checkmark-circle-outline" size="sm" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text, marginTop: 2 }}>
                      {oc.supplier}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 2 }}>
                      📦 {oc.items.length} insumo(s) ingresados • 📅 Fecha OC: {oc.date}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: "#86efac",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      alignItems: "flex-end",
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                      Total OC
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "900", color: "#166534", marginTop: 1 }}>
                      {formatearCLP(oc.total || 0)}
                    </Text>
                  </View>
                </View>

                {/* Resumen compacto de insumos recibidos */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: "#bbf7d0",
                    borderRadius: 8,
                    padding: 8,
                    marginTop: 8,
                  }}
                >
                  {oc.items.map((it: any, idx: number) => (
                    <View
                      key={`${it.sku}_${idx}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: tema.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: tema.colors.border,
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        gap: 5,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#166534" }}>
                        {it.receivedQuantity ?? it.quantity} {it.unit}
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.colors.text }} numberOfLines={1}>
                        {it.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </Tarjeta>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};
