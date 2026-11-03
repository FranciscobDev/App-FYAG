import React, { useEffect, useState } from "react";
import {
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
import { formatearCLP, formatearFecha, esRutValido } from "@/nucleo/formato";
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
  ModalEscanerQr,
  CalificacionEstrellas,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  Cliente,
  FacturaCompra,
  ItemFacturaCompra,
  OrdenCompra,
  ItemOrdenCompra,
  Proveedor,
  CalificacionProveedor,
} from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesSeccionOrdenesCompra {
  activoPestana: any;
  aprobarYEnviarOrden: any;
  establecerCalificacionComentario: any;
  establecerCalificacionPrecio: any;
  establecerCalificacionQuality: any;
  establecerCalificacionTiempo: any;
  establecerPdfVistaPreviaOrden: any;
  establecerPoFiltrarEstado: any;
  establecerTarifaModalOrden: any;
  filtradoOrdenes: any;
  manejarAbrirEditarOrden: any;
  manejarAbrirNuevoOrden: any;
  mostrarAviso: any;
  poFiltrarEstado: any;
  rolActual: any;
}

export const SeccionOrdenesCompra: React.FC<PropiedadesSeccionOrdenesCompra> = ({
  activoPestana,
  aprobarYEnviarOrden,
  establecerCalificacionComentario,
  establecerCalificacionPrecio,
  establecerCalificacionQuality,
  establecerCalificacionTiempo,
  establecerPdfVistaPreviaOrden,
  establecerPoFiltrarEstado,
  establecerTarifaModalOrden,
  filtradoOrdenes,
  manejarAbrirEditarOrden,
  manejarAbrirNuevoOrden,
  mostrarAviso,
  poFiltrarEstado,
  rolActual,
}) => {
  return (
    <>
      {/* =====================================================================
          2. TAB ÓRDENES DE COMPRA (OC)
          ===================================================================== */}
      {activoPestana === "ordenes" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* BANNER PROMINENTE PARA CREAR NUEVA ORDEN DE COMPRA */}
          {rolActual === "admin" && (
            <Tarjeta style={estilos.crearOrdenHeroTarjeta}>
              <View style={estilos.crearOrdenHeroContenido}>
                <View style={estilos.crearOrdenHeroIzquierda}>
                  <View style={estilos.pasoPastillaFila}>
                    <Insignia label="Compras" tone="warn" size="sm" />
                    <Text style={estilos.pasoPastillaHint}>Flujo de Adquisición</Text>
                  </View>
                  <Text style={estilos.crearOrdenHeroTitulo}>Emitir Orden de Compra</Text>
                  <Text style={estilos.crearOrdenHeroDescripcion}>
                    Crea una orden formal para solicitar materiales e insumos al proveedor seleccionado con precios y fecha acordada.
                  </Text>
                </View>
                <Boton
                  title="+ Crear Nueva Orden de Compra"
                  variant="primary"
                  size="md"
                  icon="add-circle-outline"
                  onPress={() => manejarAbrirNuevoOrden()}
                  style={estilos.botonCrearOrdenGrande}
                />
              </View>
            </Tarjeta>
          )}

          {/* Filtros de estado para Órdenes */}
          <View style={estilos.estadoFiltrarContenedor}>
            <Text style={estilos.estadoFiltrarEtiqueta}>Filtrar por estado del pedido:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.estadoFiltrarScroll}>
            {[
              { id: "todas", label: "Todas" },
              { id: "borrador", label: "Borrador" },
              { id: "enviada", label: "Enviada" },
              { id: "recibida_parcial", label: "Recibida Parcial" },
              { id: "recibida", label: "Recibida" },
              { id: "cerrada", label: "Cerrada" },
            ].map((st: any) => (
              <TouchableOpacity
                key={st.id}
                onPress={() => establecerPoFiltrarEstado(st.id)}
                style={[estilos.estadoChip, poFiltrarEstado === st.id && estilos.estadoChipActivo]}
              >
                <Text
                  style={[
                    estilos.estadoChipTexto,
                    poFiltrarEstado === st.id && estilos.estadoChipTextoActivo,
                  ]}
                >
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
            {poFiltrarEstado !== "todas" && (
              <TouchableOpacity
                onPress={() => establecerPoFiltrarEstado("todas")}
                style={[estilos.estadoChip, { borderColor: tema.colors.borderDark }]}
              >
                <Ionicons name="close-circle-outline" size={14} color={tema.colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={estilos.estadoChipTexto}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {filtradoOrdenes.length === 0 ? (
            <EstadoVacio
              icon="cart-outline"
              title="No se encontraron órdenes de compra"
              description="No hay órdenes registradas bajo el estado seleccionado."
              actionTitle={rolActual === "admin" ? "+ Crear Nueva Orden de Compra" : undefined}
              onAction={rolActual === "admin" ? manejarAbrirNuevoOrden : undefined}
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            filtradoOrdenes.map((order: any) => {
              const esDraft = order.status === "borrador";
              const esRecibido = order.status === "recibida";

              return (
              <Tarjeta key={order.id} variant="elevated" style={estilos.ordenTarjeta}>
                <View style={estilos.ordenSuperior}>
                  <View style={{ flex: 1 }}>
                    <View style={estilos.codigoWithAutomaticoCaja}>
                      <Text style={estilos.ordenCodigo}>{order.code}</Text>
                      {order.isAutoMinStock && (
                        <Insignia
                          label="Automática"
                          tone="warn"
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                    <Text style={estilos.ordenProveedor}>{order.supplier}</Text>
                    <Text style={estilos.ordenFecha}>
                      Emisión: {formatearFecha(order.date)} • Entrega: {formatearFecha(order.expectedDate)}
                    </Text>
                  </View>

                  <Insignia
                    label={order.status === "recibida_parcial" ? "PARCIAL" : order.status.toUpperCase()}
                    tone={
                      order.status === "recibida"
                        ? "ok"
                        : order.status === "cerrada"
                        ? "mute"
                        : order.status === "enviada"
                        ? "info"
                        : order.status === "recibida_parcial"
                        ? "warn"
                        : order.status === "anulada"
                        ? "danger"
                        : "mute"
                    }
                  />
                </View>

                {/* Resumen de ítems */}
                <View style={estilos.ordenElementosCaja}>
                  {order.items.map((i: any, idx: any) => (
                    <Text key={idx} style={estilos.ordenElementoFila}>
                      • {i.quantity} {i.unit} {i.name} - {formatearCLP(i.quantity * i.unitPrice)}
                    </Text>
                  ))}
                  {Boolean(order.notes) && (
                    <Text style={estilos.ordenNotasTexto}>Nota: {order.notes}</Text>
                  )}
                </View>

                {/* Total y botones de acción */}
                <View style={estilos.ordenInferior}>
                  <View>
                    <Text style={estilos.totalEtiqueta}>Total c/ IVA (19%):</Text>
                    <Text style={estilos.totalValor}>{formatearCLP(order.total)}</Text>
                  </View>

                  <View style={estilos.ordenBotonFila}>
                    {/* Botón de Vista Previa PDF Oficial */}
                    <Boton
                      title="Vista Previa PDF"
                      variant="outline"
                      size="sm"
                      icon="document-text-outline"
                      onPress={() => establecerPdfVistaPreviaOrden(order)}
                      style={{ marginRight: 6 }}
                    />

                    {/* Editar: SOLO en borrador */}
                    {esDraft && rolActual === "admin" && (
                      <Boton
                        title="Editar"
                        variant="secondary"
                        size="sm"
                        icon="create-outline"
                        onPress={() => manejarAbrirEditarOrden(order)}
                        style={{ marginRight: 6 }}
                      />
                    )}

                    {/* Botón Aprobar y Enviar (solo borrador) */}
                    {esDraft && rolActual === "admin" && (
                      <Boton
                        title="Aprobar y Enviar"
                        variant="primary"
                        size="sm"
                        icon="paper-plane-outline"
                        onPress={() => {
                          aprobarYEnviarOrden(order.id);
                          mostrarAviso(`Orden ${order.code} aprobada y enviada a proveedor.`);
                        }}
                      />
                    )}

                    {/* Botón Calificar y Cerrar (solo recibida) */}
                    {esRecibido && !order.rating && (
                      <Boton
                        title="Calificar y Cerrar"
                        variant="success"
                        size="sm"
                        icon="star-outline"
                        onPress={() => {
                          establecerTarifaModalOrden(order);
                          establecerCalificacionTiempo(5);
                          establecerCalificacionQuality(5);
                          establecerCalificacionPrecio(5);
                          establecerCalificacionComentario("");
                        }}
                      />
                    )}

                    {order.rating && (
                      <Insignia
                        label={`⭐ ${order.rating.average}/5 (${order.rating.comment || "Calificado"})`}
                        tone="ok"
                        size="sm"
                      />
                    )}
                  </View>
                </View>
              </Tarjeta>
            );
          })
        )}
        </ScrollView>
      )}
    </>
  );
};
