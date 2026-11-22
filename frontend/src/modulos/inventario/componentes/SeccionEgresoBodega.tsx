import React, { useEffect } from "react";
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

export const SeccionEgresoBodega: React.FC<PropiedadesSeccionEgresoBodega> = ({
  abrirEscaner,
  activoDespachoSolicitud,
  activoPestana,
  aprobadoSolicitudes,
  despachoElementosEntries,
  despachoError,
  despachoQuantities,
  despachoTecnicoRut,
  esCompletoDespacho,
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
  totalUnidadesHastaDespacho,
}) => {
  const { solicitudesMaterial } = usarAplicacion();

  // Auto-seleccionar la primera solicitud pendiente de despacho para no dejar la pantalla vacía
  useEffect(() => {
    if (
      activoPestana === "egreso" &&
      aprobadoSolicitudes.length > 0 &&
      !seleccionadoDespachoSolicitudId
    ) {
      manejarSeleccionarDespachoSolicitud(aprobadoSolicitudes[0].id);
    }
  }, [activoPestana, aprobadoSolicitudes, seleccionadoDespachoSolicitudId]);

  if (activoPestana !== "egreso") return null;

  const solicitudesEntregadas = solicitudesMaterial.filter((r) => r.status === "entregada");
  const totalLineasPendientes = aprobadoSolicitudes.reduce(
    (acc: number, r: any) =>
      acc + r.items.filter((it: any) => (it.deliveredQuantity || 0) < it.quantity).length,
    0
  );

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
              {aprobadoSolicitudes.length}
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

      {/* 2. COLA DE SOLICITUDES APROBADAS A DESPACHAR */}
      <Text style={estilos.formularioSeccionEtiqueta}>
        1. Seleccionar Pedido Aprobado en Cola ({aprobadoSolicitudes.length}):
      </Text>
      {aprobadoSolicitudes.length === 0 ? (
        <EstadoVacio
          icon="checkmark-done-circle-outline"
          title="Sin solicitudes pendientes de despacho"
          description="Todos los pedidos aprobados ya fueron despachados físicamente."
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
          {aprobadoSolicitudes.map((r: any) => {
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
                  {r.projectName}
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

      {/* 3. ESTACIÓN DE REGISTRO DE SALIDA FÍSICA DEL PEDIDO ACTIVO */}
      {activoDespachoSolicitud && (() => {
        const resumenSolicitudVivo = calcularResumenSolicitudSalidaFisica(
          activoDespachoSolicitud,
          despachoQuantities || {},
          productos || []
        );

        const aplicarPorcentajeSobrePendiente = (factor: number) => {
          activoDespachoSolicitud.items.forEach((it: any) => {
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
                      Registro de Salida Física: {activoDespachoSolicitud.code}
                    </Text>
                    {activoDespachoSolicitud.receiptNumber && (
                      <Insignia label={`Aut. ${activoDespachoSolicitud.receiptNumber}`} tone="ok" size="sm" />
                    )}
                  </View>
                  <Text style={estilos.despachoFormularioSubtitulo}>
                    Proyecto Destino: {activoDespachoSolicitud.projectName} ({activoDespachoSolicitud.projectCode})
                  </Text>
                </View>
                <Boton
                  variant="secondary"
                  size="sm"
                  title="Verificar SKU"
                  icon="qr-code-outline"
                  onPress={() =>
                    abrirEscaner("Verificar SKU para Despacho", (scannedCode: any) => {
                      const matchedProducto = productos.find(
                        (p: any) => p.sku === scannedCode || p.barcode === scannedCode
                      );
                      if (matchedProducto) {
                        mostrarAviso(`SKU verificado: ${matchedProducto.sku} (${matchedProducto.name})`);
                      } else {
                        mostrarAviso(`Código leído: ${scannedCode}`);
                      }
                    })
                  }
                />
              </View>

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
                  <Text style={{ fontWeight: "700" }}>{activoDespachoSolicitud.projectCode}</Text> y al técnico que
                  retira. Las correcciones posteriores se realizan mediante un movimiento de ajuste, nunca editando el
                  registro.
                </Text>
              </View>

              {/* Selector de Técnico que retira en bodega */}
              <Text style={estilos.formularioSeccionEtiqueta}>
                2. Seleccionar Técnico que Retira en Bodega:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {tecnicos.map((t: any) => {
                  const esReceptor = despachoTecnicoRut === t.rut;
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
                  3. Saldo Autorizado vs. Entregado en Tiempo Real:
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
              {activoDespachoSolicitud.items.map((it: any) => {
                const prod = productos.find((p: any) => p.sku === it.sku);
                const actualDespacho = Number(despachoQuantities[it.sku] || 0);
                const resumenLinea = calcularResumenLineaSalidaFisica(it, actualDespacho, prod);
                const esOverExistencia = resumenLinea.superaStockBodega;
                const esOverPendiente = resumenLinea.superaSaldoPendiente;

                return (
                  <View
                    key={it.sku}
                    style={[
                      estilos.despachoElementoFila,
                      { flexDirection: "column", alignItems: "stretch", gap: 10 },
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
                        <Text style={estilos.despachoElementoNombre}>{it.name}</Text>
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
                    {activoDespachoSolicitud.receiptNumber || activoDespachoSolicitud.code}
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Proyecto Destino:</Text>
                  <Text style={estilos.resumenValor}>
                    {activoDespachoSolicitud.projectCode} • {activoDespachoSolicitud.projectName}
                  </Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Solicitado por:</Text>
                  <Text style={estilos.resumenValor}>{activoDespachoSolicitud.technicianName}</Text>
                </View>
                <View style={estilos.resumenFila}>
                  <Text style={estilos.resumenEtiqueta}>Retira en Bodega:</Text>
                  <Text style={[estilos.resumenValor, { fontWeight: "700", color: tema.colors.primary }]}>
                    {seleccionadoDespachoTecnico
                      ? `${seleccionadoDespachoTecnico.name} (${seleccionadoDespachoTecnico.rut})`
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
                  !despachoTecnicoRut ||
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

      {/* 4. HISTORIAL DE ÚLTIMOS DESPACHOS ENTREGADOS */}
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
                    {sol.code} • {sol.projectName}
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
