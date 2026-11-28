import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
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
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  DialogoConfirmacion,
  EstadoVacio,
  BotonExportar,
  CampoTexto,
  VistaModal,
  CampoNumero,
  EncabezadoPagina,
  BarraProgreso,
  ModalEscanerQr,
  CeldaStock,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  MovimientoCardex,
  SolicitudMaterial,
  ItemSolicitudMaterial,
  ConteoFisico,
  Producto,
  RegistroMerma,
} from "@/nucleo/tipos";
import { estilos, UNIDADES_PRODUCTO } from "../estilos";

export interface PropiedadesSeccionMermas {
  activoPestana: any;
  manejarAbrirMermaModal: any;
  mermaSku: any;
  registrosMerma: any;
  width: any;
}

export const SeccionMermas: React.FC<PropiedadesSeccionMermas> = ({
  activoPestana,
  manejarAbrirMermaModal,
  mermaSku,
  registrosMerma,
  width,
}) => {
  return (
    <>
      {/* =====================================================================
          5. TAB MERMAS
          ===================================================================== */}
      {activoPestana === "mermas" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* HERO CARD INTUITIVO PARA DECLARAR MERMA */}
          <Tarjeta style={estilos.crearMermaHeroTarjeta}>
            <View style={estilos.crearMermaHeroContenido}>
              <View style={estilos.crearMermaHeroIzquierda}>
                <View style={estilos.mermaInsigniaFila}>
                  <Insignia label="Mermas" tone="danger" size="sm" />
                  <Text style={estilos.mermaInsigniaHint}>Baja de Stock Valorizada por PMP</Text>
                </View>
                <Text style={estilos.crearMermaHeroTitulo}>Declarar Merma o Pérdida de Insumo</Text>
                <Text style={estilos.crearMermaHeroDescripcion}>
                  Registra artículos dañados, caducados o pérdidas operacionales. Descuenta automáticamente el stock de bodega y asienta el impacto contable según el PMP vigente con justificación obligatoria.
                </Text>
              </View>
              <Boton
                title="+ Registrar Nueva Merma"
                variant="danger"
                size="md"
                icon="alert-circle-outline"
                onPress={manejarAbrirMermaModal}
                style={estilos.botonCrearMermaGrande}
                fullWidth={width < 768}
              />
            </View>
          </Tarjeta>

          {/* Historial de Mermas */}
          {registrosMerma.length === 0 ? (
            <EstadoVacio
              icon="shield-checkmark-outline"
              title="Sin mermas registradas"
              description="No se han registrado bajas de inventario por daño o pérdida."
              actionTitle="Registrar Merma"
              onAction={manejarAbrirMermaModal}
              containerStyle={{ marginVertical: 20 }}
            />
          ) : (
            registrosMerma.map((w: any) => (
              <Tarjeta key={w.id} variant="outlined" style={estilos.mermaTarjeta}>
                <View style={estilos.mermaSuperiorFila}>
                  <View>
                    <Text style={estilos.mermaSku}>{w.sku}</Text>
                    <Text style={estilos.mermaNombre}>{w.productName}</Text>
                  </View>
                  <Insignia
                    label={w.reason.toUpperCase()}
                    tone={w.reason === "daño" || w.reason === "pérdida" ? "danger" : "warn"}
                    size="sm"
                  />
                </View>

                <View style={estilos.mermaDetallesGrilla}>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>Cantidad Baja</Text>
                    <Text style={[estilos.detalleValor, { color: tema.colors.danger, fontWeight: "bold" }]}>
                      -{w.quantity} {w.unit}
                    </Text>
                  </View>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>Pérdida Valorizada</Text>
                    <Text style={[estilos.detalleValor, { color: tema.colors.danger, fontWeight: "bold" }]}>
                      {formatearCLP(w.totalLoss)}
                    </Text>
                  </View>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>PMP al Momento</Text>
                    <Text style={estilos.detalleValor}>{formatearCLP(w.pmp)}</Text>
                  </View>
                  <View style={estilos.detalleElemento}>
                    <Text style={estilos.detalleLbl}>Fecha y Responsable</Text>
                    <Text style={estilos.detalleValor}>{formatearFecha(w.date)} • {w.user}</Text>
                  </View>
                </View>

                <View style={estilos.mermaObsCaja}>
                  <Text style={estilos.mermaObsTitulo}>Observación Obligatoria:</Text>
                  <Text style={estilos.mermaObsTexto}>{w.observation}</Text>
                </View>
              </Tarjeta>
            ))
          )}
        </ScrollView>
      )}
    </>
  );
};
