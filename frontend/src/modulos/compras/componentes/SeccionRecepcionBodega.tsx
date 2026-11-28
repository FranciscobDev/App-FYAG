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
      {/* 1. FRANJA DE RESUMEN OPERATIVO DE RECEPCIÓN */}
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
            <Ionicons name="cart-outline" size={20} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {ordenesPendientes.length}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              OC por Recibir
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
            <Ionicons name="cube-outline" size={20} color={tema.colors.warnDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {totalLineasPorVerificar}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Ítems por Verificar
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
              {ordenesCompletadas.length}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              OC Recibidas
            </Text>
          </View>
        </View>
      </View>

      {/* 2. COLA DE ÓRDENES DE COMPRA PENDIENTES DE RECEPCIÓN */}
      <View style={estilos.ocSeleccionarSeccion}>
        <View style={estilos.ocSeleccionarEncabezado}>
          <Ionicons name="receipt-outline" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={estilos.ocSeleccionarEtiqueta}>
            1. Seleccionar Orden de Compra en Cola ({ordenesPendientes.length}):
          </Text>
        </View>

        {ordenesPendientes.length === 0 ? (
          <EstadoVacio
            icon="checkmark-done-circle-outline"
            title="Sin órdenes pendientes de recepción"
            description="Todas las órdenes de compra enviadas ya fueron recibidas e ingresadas a bodega."
            containerStyle={{ marginVertical: 16 }}
          />
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
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
                  style={[
                    estilos.ocSeleccionarChip,
                    {
                      flex: 1,
                      minWidth: 250,
                      marginRight: 0,
                      padding: 12,
                    },
                    esSeleccionado && estilos.ocSeleccionarChipActivo,
                  ]}
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
                        color={esSeleccionado ? tema.colors.primary : tema.colors.textMuted}
                      />
                      <Text
                        style={[
                          estilos.ocSeleccionarCodigo,
                          esSeleccionado && estilos.ocSeleccionarCodigoActivo,
                        ]}
                      >
                        {o.code}
                      </Text>
                    </View>
                    <Insignia
                      label={esPartial ? "Parcial" : "Enviada"}
                      tone={esPartial ? "warn" : "info"}
                      size="sm"
                    />
                  </View>

                  <Text
                    style={[
                      estilos.ocSeleccionarProveedor,
                      { marginTop: 4, fontWeight: "700" },
                      esSeleccionado && estilos.ocSeleccionarProveedorActivo,
                    ]}
                  >
                    {o.supplier}
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginTop: 2 }}>
                    Entrega esperada: {o.expectedDate}
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
                      {o.items.length} {o.items.length === 1 ? "insumo" : "insumos"} ({totalPendientesOc} un. pend.)
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: esSeleccionado ? tema.colors.primaryDark : tema.colors.textMuted,
                      }}
                    >
                      {esSeleccionado ? "En verificación ✓" : "Tocar para verificar →"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

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
              variant="secondary"
              size="sm"
              title="Verificar Bulto"
              icon="qr-code-outline"
              onPress={() => manejarAbrirEscaner()}
            />
          </View>

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

          {/* Alerta de discrepancia si lo contado no coincide con lo pendiente de la OC */}
          {tieneRecepcionDiscrepancy && (
            <View style={estilos.discrepancyBanner}>
              <Ionicons name="warning" size={20} color={tema.colors.warnDark} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.discrepancyBannerTitulo}>Discrepancia detectada en el conteo</Text>
                <Text style={estilos.discrepancyBannerTexto}>
                  Hay diferencias, mermas defectuosas o faltantes respecto a lo pedido. Al confirmar, se notificará al Administrador.
                </Text>
              </View>
            </View>
          )}

          {/* Checklist interactivo por línea */}
          <Text style={[estilos.ocSeleccionarEtiqueta, { marginTop: 8, marginBottom: 8 }]}>
            3. Verificar Cantidades Físicas por Ítem ({recepcionListaChequeo.length}):
          </Text>
          {recepcionListaChequeo.map((item: any, idx: any) => {
            const poItem = activoRecepcionOrden.items.find((i: any) => i.sku === item.sku);
            const prod = productos.find((p: any) => p.sku === item.sku);
            const esBulk = Boolean(prod?.isBulk || ["kg", "m", "l"].includes(prod?.unit?.toLowerCase() || ""));

            const cantidadOrdered = poItem?.quantity || 0;
            const cantidadAlreadyRecibido = poItem?.receivedQuantity || 0;
            const pending = Math.max(0, cantidadOrdered - cantidadAlreadyRecibido);
            const esDiscrepant = item.received + item.defective + item.missing !== pending;

            const contenedorCapacity = prod?.containerCapacity || 100;
            const contenedorFreeSpace = Math.max(0, contenedorCapacity - (prod?.stock || 0));
            const exceedsContenedor = esBulk && item.received > contenedorFreeSpace;

            const establecerCompletoConforme = () => {
              establecerRecepcionListaChequeo((prev: any) =>
                prev.map((c: any, i: any) => (i === idx ? { ...c, received: pending, defective: 0, missing: 0 } : c))
              );
            };

            const establecerCompletoFaltante = () => {
              establecerRecepcionListaChequeo((prev: any) =>
                prev.map((c: any, i: any) => (i === idx ? { ...c, received: 0, defective: 0, missing: pending } : c))
              );
            };

            const establecerCompletoDefectuoso = () => {
              establecerRecepcionListaChequeo((prev: any) =>
                prev.map((c: any, i: any) => (i === idx ? { ...c, received: 0, defective: pending, missing: 0 } : c))
              );
            };

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

                {/* Desglose de cantidades Pedida / Ya Recibida / Pendiente */}
                <View style={estilos.cantidadMetricFila}>
                  <View style={estilos.cantidadMetricColumna}>
                    <Text style={estilos.cantidadMetricLbl}>Pedido OC</Text>
                    <Text style={estilos.cantidadMetricValor}>{cantidadOrdered} {poItem?.unit}</Text>
                  </View>
                  <View style={estilos.cantidadMetricColumna}>
                    <Text style={estilos.cantidadMetricLbl}>Recibido Antes</Text>
                    <Text style={estilos.cantidadMetricValor}>{cantidadAlreadyRecibido} {poItem?.unit}</Text>
                  </View>
                  <View style={[estilos.cantidadMetricColumna, estilos.cantidadMetricColumnaDestacado]}>
                    <Text style={[estilos.cantidadMetricLbl, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                      Por Recibir Hoy
                    </Text>
                    <Text style={[estilos.cantidadMetricValor, { color: tema.colors.primaryDark, fontWeight: "bold" }]}>
                      {pending} {poItem?.unit}
                    </Text>
                  </View>
                </View>

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

                {/* Botones de acción rápida táctil */}
                <View style={estilos.rapidoAccionFila}>
                  <TouchableOpacity onPress={establecerCompletoConforme} style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.okLight }]}>
                    <Ionicons name="checkmark" size={14} color={tema.colors.okDark} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.okDark }]}>Todo Conforme</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={establecerCompletoDefectuoso} style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.dangerLight }]}>
                    <Ionicons name="alert-circle-outline" size={14} color={tema.colors.danger} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.danger }]}>Defectuoso</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={establecerCompletoFaltante} style={[estilos.rapidoAccionBoton, { backgroundColor: tema.colors.warnLight }]}>
                    <Ionicons name="close-circle-outline" size={14} color={tema.colors.warnDark} style={{ marginRight: 4 }} />
                    <Text style={[estilos.rapidoAccionTexto, { color: tema.colors.warnDark }]}>Faltante</Text>
                  </TouchableOpacity>
                </View>

                {/* 3 Columnas de entrada: Conforme / Defectuoso / Faltante */}
                <View style={estilos.verificarEntradaFila}>
                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.okDark }]}>✓ Conforme (A Stock)</Text>
                    <TextInput
                      value={String(item.received)}
                      onChangeText={(v: any) => {
                        const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                        establecerRecepcionListaChequeo((prev: any) =>
                          prev.map((c: any, i: any) => (i === idx ? { ...c, received: val } : c))
                        );
                      }}
                      keyboardType={esBulk ? "decimal-pad" : "numeric"}
                      style={[estilos.verificarEntrada, { borderColor: tema.colors.ok, backgroundColor: tema.colors.okLight }]}
                    />
                  </View>

                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.danger }]}>✕ Defectuoso (Cuarentena)</Text>
                    <TextInput
                      value={String(item.defective)}
                      onChangeText={(v: any) => {
                        const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                        establecerRecepcionListaChequeo((prev: any) =>
                          prev.map((c: any, i: any) => (i === idx ? { ...c, defective: val } : c))
                        );
                      }}
                      keyboardType={esBulk ? "decimal-pad" : "numeric"}
                      style={[estilos.verificarEntrada, { borderColor: tema.colors.danger, backgroundColor: tema.colors.dangerLight }]}
                    />
                  </View>

                  <View style={estilos.verificarColumna}>
                    <Text style={[estilos.verificarEtiqueta, { color: tema.colors.warnDark }]}>! Faltante (Pendiente)</Text>
                    <TextInput
                      value={String(item.missing)}
                      onChangeText={(v: any) => {
                        const val = esBulk ? (parseFloat(v) || 0) : (parseInt(v, 10) || 0);
                        establecerRecepcionListaChequeo((prev: any) =>
                          prev.map((c: any, i: any) => (i === idx ? { ...c, missing: val } : c))
                        );
                      }}
                      keyboardType={esBulk ? "decimal-pad" : "numeric"}
                      style={[estilos.verificarEntrada, { borderColor: tema.colors.warn, backgroundColor: tema.colors.warnLight }]}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {item.defective > 0 && <Insignia label="Cuarentena" tone="danger" size="sm" />}
                  {esDiscrepant && <Insignia label="Discrepancia" tone="warn" size="sm" />}
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

      {/* 4. HISTORIAL DE ÚLTIMAS ÓRDENES RECIBIDAS */}
      {ordenesCompletadas.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={estilos.ocSeleccionarEtiqueta}>
            Últimas Órdenes Recibidas ({ordenesCompletadas.length}):
          </Text>
          <View style={{ marginTop: 8 }}>
            {ordenesCompletadas.slice(0, 4).map((oc: any) => (
              <Tarjeta key={oc.id} variant="outlined" style={{ marginBottom: 8, padding: 12 }}>
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
                      {oc.code} • {oc.supplier}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginTop: 2 }}>
                      {oc.items.length} insumos • Fecha OC: {oc.date}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {oc.invoiceNumber && <Insignia label={`FAC-${oc.invoiceNumber}`} tone="info" size="sm" />}
                    <Insignia label="Recibida" tone="ok" size="sm" />
                  </View>
                </View>
              </Tarjeta>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};
