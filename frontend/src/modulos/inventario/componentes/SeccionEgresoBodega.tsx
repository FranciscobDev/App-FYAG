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

      {/* 3. ESTACIÓN DE PREPARACIÓN Y ENTREGA DEL PEDIDO ACTIVO */}
      {activoDespachoSolicitud && (
        <View style={[estilos.despachoLayoutContenedor, esDesktop && estilos.despachoLayoutDesktop]}>
          <Tarjeta
            variant="elevated"
            style={[estilos.despachoFormularioTarjeta, esDesktop && estilos.despachoFormularioTarjetaDesktop]}
          >
            <View style={estilos.despachoFormularioEncabezado}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={estilos.despachoFormularioTitulo}>
                  Preparación de Guía: {activoDespachoSolicitud.code}
                </Text>
                <Text style={estilos.despachoFormularioSubtitulo}>
                  Destino: {activoDespachoSolicitud.projectName} ({activoDespachoSolicitud.projectCode})
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

            {/* Selector de Técnico que retira */}
            <Text style={estilos.formularioSeccionEtiqueta}>2. Técnico que retira en mesón:</Text>
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

            {/* Tabla de ítems a despachar */}
            <Text style={estilos.formularioSeccionEtiqueta}>3. Insumos y Cantidades a Entregar:</Text>
            {activoDespachoSolicitud.items.map((it: any) => {
              const prod = productos.find((p: any) => p.sku === it.sku);
              const entregado = it.deliveredQuantity || 0;
              const pending = Math.max(0, it.quantity - entregado);
              const actualDespacho = despachoQuantities[it.sku] || 0;
              const esOverExistencia = prod ? actualDespacho > prod.stock : false;
              const esOverPendiente = actualDespacho > pending;

              return (
                <View key={it.sku} style={estilos.despachoElementoFila}>
                  <View style={{ flex: 1.5, minWidth: 160, marginRight: 8 }}>
                    <Text style={estilos.despachoElementoNombre}>{it.name}</Text>
                    <Text style={estilos.despachoElementoSku}>
                      SKU: {it.sku} {prod?.location ? `• ${prod.location}` : ""}
                    </Text>
                    <Text style={estilos.despachoElementoExistencia}>
                      Stock bodega: {prod ? prod.stock : 0} {it.unit}
                    </Text>

                    {prod?.isBulk && prod.containerCapacity && (
                      <View style={{ marginTop: 6 }}>
                        <BarraProgreso
                          value={Math.max(0, prod.stock - actualDespacho)}
                          max={prod.containerCapacity}
                          height={5}
                          showPercentage
                          label={`Contenedor restante: ${Math.max(0, prod.stock - actualDespacho).toFixed(3)} ${it.unit}`}
                        />
                      </View>
                    )}
                  </View>

                  <View style={estilos.despachoColumnaStats}>
                    <Text style={estilos.statLinea}>Pedido: {it.quantity} {it.unit}</Text>
                    <Text style={estilos.statLinea}>Previo: {entregado} {it.unit}</Text>
                    <Text style={[estilos.statLinea, { color: tema.colors.primary, fontWeight: "bold" }]}>
                      Pend.: {pending} {it.unit}
                    </Text>
                  </View>

                  <View style={estilos.despachoEntradaCaja}>
                    <Text style={estilos.despachoEntradaEtiqueta}>Entregar:</Text>
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
              );
            })}
          </Tarjeta>

          {/* Resumen lateral (en desktop) o inferior (en móvil) de Despacho */}
          <Tarjeta
            variant="outlined"
            style={[estilos.despachoResumenTarjeta, esDesktop && estilos.despachoResumenTarjetaDesktop]}
          >
            <View style={estilos.resumenTarjetaEncabezado}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="receipt-outline" size={18} color={tema.colors.primary} style={{ marginRight: 6 }} />
                <Text style={estilos.resumenTarjetaTitulo}>Guía de Salida</Text>
              </View>
              <Insignia
                label={esCompletoDespacho ? "Completa" : totalUnidadesHastaDespacho > 0 ? "Parcial" : "Vacía"}
                tone={esCompletoDespacho ? "ok" : totalUnidadesHastaDespacho > 0 ? "info" : "mute"}
                size="sm"
              />
            </View>

            <View style={estilos.resumenTarjetaCuerpo}>
              <View style={estilos.resumenFila}>
                <Text style={estilos.resumenEtiqueta}>Comprobante:</Text>
                <Text style={estilos.resumenValor}>
                  {activoDespachoSolicitud.receiptNumber || activoDespachoSolicitud.code}
                </Text>
              </View>
              <View style={estilos.resumenFila}>
                <Text style={estilos.resumenEtiqueta}>Proyecto Destino:</Text>
                <Text style={estilos.resumenValor}>{activoDespachoSolicitud.projectName}</Text>
              </View>
              <View style={estilos.resumenFila}>
                <Text style={estilos.resumenEtiqueta}>Solicitado por:</Text>
                <Text style={estilos.resumenValor}>{activoDespachoSolicitud.technicianName}</Text>
              </View>
              <View style={estilos.resumenFila}>
                <Text style={estilos.resumenEtiqueta}>Retira en Bodega:</Text>
                <Text style={[estilos.resumenValor, { fontWeight: "600", color: tema.colors.primary }]}>
                  {seleccionadoDespachoTecnico?.name || "Seleccionar técnico..."}
                </Text>
              </View>
              <View style={estilos.resumenDivisor} />
              <View style={estilos.resumenFila}>
                <Text style={estilos.resumenEtiqueta}>Líneas con entrega:</Text>
                <Text style={estilos.resumenValor}>
                  {despachoElementosEntries.length} de {activoDespachoSolicitud.items.length}
                </Text>
              </View>
              <View style={estilos.resumenFila}>
                <Text style={[estilos.resumenEtiqueta, { fontWeight: "bold", color: tema.colors.text }]}>
                  Total a Despachar:
                </Text>
                <Text style={[estilos.resumenValor, { fontWeight: "bold", fontSize: 16, color: tema.colors.primary }]}>
                  {totalUnidadesHastaDespacho} un.
                </Text>
              </View>
            </View>

            {Boolean(despachoError) && (
              <View style={estilos.errorAvisoTarjeta}>
                <Ionicons name="alert-circle" size={16} color={tema.colors.danger} />
                <Text style={estilos.errorAvisoTexto}>{despachoError}</Text>
              </View>
            )}

            <Boton
              title="Confirmar y Emitir Guía"
              variant="primary"
              icon="checkmark-done-outline"
              size="md"
              disabled={totalUnidadesHastaDespacho === 0 || !despachoTecnicoRut}
              onPress={manejarInitiateDespacho}
              style={{ marginTop: 14 }}
              fullWidth
            />
          </Tarjeta>
        </View>
      )}

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
