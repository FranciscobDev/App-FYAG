import { Selector } from "@/componentes/formularios/Selector";
import { CATEGORIAS_ARTICULO } from "@/nucleo/categoriasArticulo";
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
  SelectorBuscable,
  OpcionSelectorBuscable,
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
import {
  formatearTiempoEscaneo,
  resolverCodigoEscaneadoBodega,
} from "../escanerBodegaUtils";
import { ModalComprobanteSolicitud } from "./ModalComprobanteSolicitud";
import { ModalRechazoSolicitud } from "./ModalRechazoSolicitud";
import { FormularioRegistroMermas } from "@/componentes/FormularioRegistroMermas";
import {
  calcularRemanenteContenedorGranel,
  contrastarSaldoInsumoConUltimaLineaCardex,
  esProyectoActivoParaSolicitud,
  filtrarYOrdenarCardexSoloLectura,
  formatearCantidadMovimientoBodega,
  liberarReservaComprometidoEnCatalogoH6,
  sanitizarEntradaCantidadBodega,
  validarFormularioNuevaSolicitudInsumos,
} from "../solicitudInsumosUtils";

export interface PropiedadesModalesInventario {
  abrirEscaner: any;
  activoDespachoSolicitud: any;
  activoProyectos: any;
  anularConfirmarSolicitud?: SolicitudMaterial | null;
  calcularFaltanteExistencia: any;
  cancelarSolicitudMaterial?: (
    id: string,
    authorName?: string
  ) => { success: boolean; error?: string };
  cardex?: any;
  productoCardexSeleccionado?: any;
  establecerProductoCardexSeleccionado?: any;
  confirmarDespachoVisible: any;
  conteoDiferencia: any;
  conteoDiferenciaPorcentaje: any;
  conteoDiferenciaValor: any;
  conteoError: any;
  conteoModalVisible: any;
  conteoNotas: any;
  conteoPhysicalCantidad: any;
  conteoRequiresApproval: any;
  conteoSku: any;
  editandoProducto: any;
  editandoSolicitud?: SolicitudMaterial | null;
  conteoEscaneoInfo?: string | null;
  establecerConteoEscaneoInfo?: (val: string | null) => void;
  escanerCallback: any;
  escanerModuloOrigen?: any;
  escanerSugerenciaSkus?: string[];
  escanerTitulo: any;
  escanerValidarExistencia?: boolean;
  escanerVisible: any;
  establecerAnularConfirmarSolicitud?: React.Dispatch<
    React.SetStateAction<SolicitudMaterial | null>
  >;
  establecerConfirmarDespachoVisible: any;
  establecerEditandoSolicitud?: React.Dispatch<React.SetStateAction<SolicitudMaterial | null>>;
  establecerConteoModalVisible: any;
  establecerConteoNotas: any;
  establecerConteoPhysicalCantidad: any;
  establecerConteoSku: any;
  establecerEscanerVisible: any;
  establecerFaltanteExistenciaErrores: any;
  establecerFormularioBarcode: any;
  establecerFormularioCategoria: any;
  establecerFormularioContenedorCapacity: any;
  establecerFormularioEsBulk: any;
  establecerFormularioExistencia: any;
  establecerFormularioMinimoExistencia: any;
  establecerFormularioPmp?: any;
  establecerFormularioPasillo?: any;
  establecerFormularioEstanteria?: any;
  establecerFormularioNombre: any;
  establecerFormularioNombreError: any;
  establecerFormularioProveedor: any;
  establecerFormularioRestock: any;
  establecerFormularioSku: any;
  establecerFormularioSkuError: any;
  establecerFormularioUnidad: any;
  establecerMermaCantidad: any;
  establecerMermaModalVisible: any;
  establecerMermaMotivo: any;
  establecerMermaObs: any;
  establecerMermaSku: any;
  establecerMostrarAdvancedProductoOpciones: any;
  establecerNuevoProductoModal: any;
  establecerNuevoSolicitudModal: any;
  establecerRechazarModalSolicitud: any;
  establecerRechazarMotivo: any;
  establecerSeleccionadoComprobanteSolicitud: React.Dispatch<
    React.SetStateAction<SolicitudMaterial | null>
  >;
  establecerSeleccionadoProyectoId: any;
  establecerSeleccionadoTimelineSolicitud: any;
  establecerSolicitudComentario: any;
  establecerSolicitudElementos: any;
  establecerSolicitudUrgencia?: React.Dispatch<React.SetStateAction<"normal" | "alta" | "urgente">>;
  faltanteExistenciaErrores: any;
  formularioBarcode: any;
  formularioCategoria: any;
  formularioContenedorCapacity: any;
  formularioError: any;
  formularioEsBulk: any;
  formularioExistencia: any;
  formularioMinimoExistencia: any;
  formularioPmp?: any;
  formularioPasillo?: any;
  formularioEstanteria?: any;
  formularioNombre: any;
  formularioNombreError: any;
  formularioProveedor: any;
  formularioRestock: any;
  formularioSku: any;
  formularioSkuError: any;
  formularioUnidad: any;
  manejarEnviarSolicitud: any;
  manejarExecuteDespacho: any;
  manejarGuardarProducto: any;
  manejarRegisterConteo: any;
  manejarRegisterMerma: any;
  manejarSolicitudElementoCambiar: any;
  mermaCantidad: any;
  mermaCantidadNumero: any;
  mermaError: any;
  mermaModalVisible: any;
  mermaMotivo: any;
  mermaObs: any;
  mermaSku: any;
  mermaTotalPerdida: any;
  mostrarAdvancedProductoOpciones: any;
  mostrarAviso: any;
  nombreEntradaReferencia: any;
  nuevoProductoModal: any;
  nuevoSolicitudModal: any;
  productos: any;
  rechazarModalSolicitud: any;
  rechazarMotivo: any;
  rechazarSolicitudMaterial: any;
  seleccionadoConteoProducto: any;
  seleccionadoComprobanteSolicitud: SolicitudMaterial | null;
  seleccionadoMermaProducto: any;
  seleccionadoProyectoId: any;
  seleccionadoTimelineSolicitud: any;
  skuEntradaReferencia: any;
  solicitudComentario: any;
  solicitudElementos: any;
  solicitudError: any;
  solicitudUrgencia?: "normal" | "alta" | "urgente";
  totalUnidadesHastaDespacho: any;
  usuario: any;
}

export const ModalesInventario: React.FC<PropiedadesModalesInventario> = ({
  abrirEscaner,
  activoDespachoSolicitud,
  activoProyectos,
  anularConfirmarSolicitud = null,
  calcularFaltanteExistencia,
  cancelarSolicitudMaterial,
  cardex = [],
  productoCardexSeleccionado = null,
  establecerProductoCardexSeleccionado,
  confirmarDespachoVisible,
  conteoDiferencia,
  conteoDiferenciaPorcentaje,
  conteoDiferenciaValor,
  conteoError,
  conteoModalVisible,
  conteoNotas,
  conteoPhysicalCantidad,
  conteoRequiresApproval,
  conteoSku,
  conteoEscaneoInfo,
  establecerConteoEscaneoInfo,
  editandoProducto,
  editandoSolicitud = null,
  escanerCallback,
  escanerModuloOrigen,
  escanerSugerenciaSkus,
  escanerTitulo,
  escanerValidarExistencia = true,
  escanerVisible,
  establecerAnularConfirmarSolicitud,
  establecerConfirmarDespachoVisible,
  establecerEditandoSolicitud,
  establecerConteoModalVisible,
  establecerConteoNotas,
  establecerConteoPhysicalCantidad,
  establecerConteoSku,
  establecerEscanerVisible,
  establecerFaltanteExistenciaErrores,
  establecerFormularioBarcode,
  establecerFormularioCategoria,
  establecerFormularioContenedorCapacity,
  establecerFormularioEsBulk,
  establecerFormularioExistencia,
  establecerFormularioMinimoExistencia,
  establecerFormularioPmp,
  establecerFormularioPasillo,
  establecerFormularioEstanteria,
  establecerFormularioNombre,
  establecerFormularioNombreError,
  establecerFormularioProveedor,
  establecerFormularioRestock,
  establecerFormularioSku,
  establecerFormularioSkuError,
  establecerFormularioUnidad,
  establecerMermaCantidad,
  establecerMermaModalVisible,
  establecerMermaMotivo,
  establecerMermaObs,
  establecerMermaSku,
  establecerMostrarAdvancedProductoOpciones,
  establecerNuevoProductoModal,
  establecerNuevoSolicitudModal,
  establecerRechazarModalSolicitud,
  establecerRechazarMotivo,
  establecerSeleccionadoComprobanteSolicitud,
  establecerSeleccionadoProyectoId,
  establecerSeleccionadoTimelineSolicitud,
  establecerSolicitudComentario,
  establecerSolicitudElementos,
  establecerSolicitudUrgencia,
  faltanteExistenciaErrores,
  formularioBarcode,
  formularioCategoria,
  formularioContenedorCapacity,
  formularioError,
  formularioEsBulk,
  formularioExistencia,
  formularioMinimoExistencia,
  formularioPmp = "1000",
  formularioPasillo = "Pasillo A",
  formularioEstanteria = "Estante 1",
  formularioNombre,
  formularioNombreError,
  formularioProveedor,
  formularioRestock,
  formularioSku,
  formularioSkuError,
  formularioUnidad,
  manejarEnviarSolicitud,
  manejarExecuteDespacho,
  manejarGuardarProducto,
  manejarRegisterConteo,
  manejarRegisterMerma,
  manejarSolicitudElementoCambiar,
  mermaCantidad,
  mermaCantidadNumero,
  mermaError,
  mermaModalVisible,
  mermaMotivo,
  mermaObs,
  mermaSku,
  mermaTotalPerdida,
  mostrarAdvancedProductoOpciones,
  mostrarAviso,
  nombreEntradaReferencia,
  nuevoProductoModal,
  nuevoSolicitudModal,
  productos,
  rechazarModalSolicitud,
  rechazarMotivo,
  rechazarSolicitudMaterial,
  seleccionadoConteoProducto,
  seleccionadoComprobanteSolicitud,
  seleccionadoMermaProducto,
  seleccionadoProyectoId,
  seleccionadoTimelineSolicitud,
  skuEntradaReferencia,
  solicitudComentario,
  solicitudElementos,
  solicitudError,
  solicitudUrgencia = "normal",
  totalUnidadesHastaDespacho,
  usuario,
}) => {
  const { proyectos: todosProyectos = [] } = usarAplicacion();
  const [textosCantidadSolicitud, establecerTextosCantidadSolicitud] = useState<Record<string, string>>({});

  useEffect(() => {
    establecerTextosCantidadSolicitud({});
  }, [nuevoSolicitudModal]);

  return (
    <>
      {/* =====================================================================
          MODALES DE APOYO
          ===================================================================== */}

      {/* MODAL 1: PRODUCTO (ALTA / EDICIÓN) */}
      <VistaModal
        visible={nuevoProductoModal}
        onClose={() => establecerNuevoProductoModal(false)}
        title={editandoProducto ? "Editar Insumo" : "Nuevo Insumo (Inventario)"}
        subtitle="Formulario con SKU único, unidad, mínimos y reposición"
      >
        <View style={estilos.entradaWithEscanerFila}>
          <View style={{ flex: 1 }}>
            <CampoTexto
              ref={skuEntradaReferencia}
              label="Código SKU Único"
              value={formularioSku}
              onChangeText={(text: any) => {
                establecerFormularioSku(text);
                if (formularioSkuError) establecerFormularioSkuError("");
              }}
              error={formularioSkuError}
              placeholder="Ej: ELE-CBL-0012"
              editable={!editandoProducto}
            />
          </View>
          {!editandoProducto && (
            <TouchableOpacity
              onPress={() =>
                abrirEscaner(
                  "Escanear Código de Barras o QR",
                  (code: any) => {
                    establecerFormularioSku(code);
                    establecerFormularioBarcode(code);
                  },
                  { moduloOrigen: "catalogo", validarExistencia: false }
                )
              }
              style={estilos.escanerIconoBoton}
            >
              <Ionicons name="barcode-outline" size={20} color={tema.colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 1. INFORMACIÓN BÁSICA */}
        <Text style={estilos.formularioSeccionEncabezado}>1. Información Básica</Text>
        <CampoTexto
          ref={nombreEntradaReferencia}
          label="Nombre del Insumo"
          value={formularioNombre}
          onChangeText={(text: any) => {
            establecerFormularioNombre(text);
            if (formularioNombreError) establecerFormularioNombreError("");
          }}
          error={formularioNombreError}
          placeholder="Ej: Cable THHN 12 AWG"
        />
        <Selector
          label="Categoría"
          value={formularioCategoria}
          onChange={establecerFormularioCategoria}
          options={CATEGORIAS_ARTICULO.map((c) => ({ label: c, value: c }))}
          placeholder="Selecciona una categoría"
          required
        />

        <Text style={estilos.formularioSeccionEtiqueta}>Unidad de Medida:</Text>

        <View style={estilos.unidadGrilla}>
          {UNIDADES_PRODUCTO.map((u: any) => {
            const isSelected = formularioUnidad === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => establecerFormularioUnidad(u.id)}
                style={[
                  estilos.unidadTarjeta,
                  { paddingVertical: 8, paddingHorizontal: 10, minWidth: 110, flexBasis: "23%" },
                  isSelected && estilos.unidadTarjetaActivo,
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${u.name} (${u.code}): ${u.desc}`}
              >
                <View style={[estilos.unidadTarjetaEncabezado, { marginBottom: 0 }]}>
                  <View style={[estilos.unidadCodigoInsignia, isSelected && estilos.unidadCodigoInsigniaActivo]}>
                    <Text style={[estilos.unidadCodigoInsigniaTexto, isSelected && estilos.unidadCodigoInsigniaTextoActivo]}>
                      {u.code}
                    </Text>
                  </View>
                  <Text
                    style={[estilos.unidadTarjetaTitulo, isSelected && estilos.unidadTarjetaTituloActivo]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={15} color={tema.colors.primary} style={{ marginLeft: "auto" }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {(() => {
          const seleccionadoUnidadObj = UNIDADES_PRODUCTO.find((u: any) => u.id === formularioUnidad) || UNIDADES_PRODUCTO[0];
          return (
            <View style={estilos.unidadActivoResumen}>
              <Ionicons name="information-circle-outline" size={16} color={tema.colors.primary} style={{ marginRight: 6 }} />
              <Text style={estilos.unidadActivoResumenTexto}>
                Unidad activa: <Text style={{ fontWeight: "bold", color: tema.colors.primaryDark }}>{seleccionadoUnidadObj.name} ({seleccionadoUnidadObj.code})</Text> — {seleccionadoUnidadObj.desc}
              </Text>
            </View>
          );
        })()}

        {/* 2. UBICACIÓN FÍSICA EN BODEGA */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Ubicación en Bodega</Text>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <CampoTexto
              label="Pasillo / Zona"
              value={formularioPasillo}
              onChangeText={(val: string) => establecerFormularioPasillo?.(val)}
              placeholder="Ej: Pasillo A"
            />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <CampoTexto
              label="Estantería / Gabinete"
              value={formularioEstanteria}
              onChangeText={(val: string) => establecerFormularioEstanteria?.(val)}
              placeholder="Ej: Estante 1"
            />
          </View>
        </View>

        {/* Chips rápidos de Pasillo y Estantería + Vista previa */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tema.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: tema.colors.border,
            borderRadius: tema.radius.sm,
            paddingHorizontal: 10,
            paddingVertical: 7,
            marginBottom: tema.spacing.md,
          }}
        >
          <Ionicons name="location-outline" size={15} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 11, color: tema.colors.textSecondary, flex: 1 }}>
            Ubicación asignada:{" "}
            <Text style={{ fontWeight: "700", color: tema.colors.text }}>
              {(formularioPasillo || "Bodega Principal").trim()}
              {(formularioEstanteria || "").trim() ? ` - ${formularioEstanteria.trim()}` : ""}
            </Text>
          </Text>
        </View>

        {/* 3. EXISTENCIAS Y VALORIZACIÓN (PMP) */}
        <Text style={estilos.formularioSeccionEncabezado}>3. Existencias y Valorización (PMP)</Text>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {!editandoProducto && (
            <View style={{ flex: 1, minWidth: 135 }}>
              <CampoTexto
                label="Stock Inicial Disponible"
                value={formularioExistencia}
                onChangeText={establecerFormularioExistencia}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 135 }}>
            <CampoTexto
              label="Stock Mínimo de Alerta"
              value={formularioMinimoExistencia}
              onChangeText={establecerFormularioMinimoExistencia}
              keyboardType="numeric"
              placeholder="10"
            />
          </View>
        </View>

        <CampoTexto
          label="Costo Unitario / PMP ($ CLP)"
          value={formularioPmp}
          onChangeText={(val: string) => establecerFormularioPmp?.(val.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholder="Ej: 635"
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: tema.colors.primaryLight,
            borderWidth: 1,
            borderColor: tema.colors.primaryBorder,
            borderRadius: tema.radius.sm,
            paddingHorizontal: 10,
            paddingVertical: 7,
            marginBottom: tema.spacing.sm,
          }}
        >
          <Text style={{ fontSize: 11, color: tema.colors.primaryDeep, fontWeight: "600" }}>
            PMP Unitario Registrado: {formatearCLP(Number(formularioPmp) || 0)}
          </Text>
          {!editandoProducto && (
            <Text style={{ fontSize: 11, color: tema.colors.primaryDark, fontWeight: "700" }}>
              Total Inicial:{" "}
              {formatearCLP((Number(formularioExistencia) || 0) * (Number(formularioPmp) || 0))}
            </Text>
          )}
        </View>

        {/* 3. MÁS OPCIONES (PLEGABLE) */}
        <TouchableOpacity
          onPress={() => establecerMostrarAdvancedProductoOpciones(!mostrarAdvancedProductoOpciones)}
          style={estilos.advancedOpcionesAlternar}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name={mostrarAdvancedProductoOpciones ? "chevron-up" : "chevron-down"}
              size={16}
              color={tema.colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={estilos.advancedOpcionesAlternarTexto}>
              {mostrarAdvancedProductoOpciones
                ? "Ocultar opciones avanzadas"
                : "Más opciones (Proveedor, Reposición, Granel, Código de barras)"}
            </Text>
          </View>
        </TouchableOpacity>

        {mostrarAdvancedProductoOpciones && (
          <View style={estilos.advancedOpcionesCaja}>
            <CampoTexto
              label="Cantidad Sugerida de Reposición"
              value={formularioRestock}
              onChangeText={establecerFormularioRestock}
              keyboardType="numeric"
              placeholder="50"
            />
            <CampoTexto
              label="Proveedor Predeterminado"
              value={formularioProveedor}
              onChangeText={establecerFormularioProveedor}
              placeholder="Ej: ElectroChile SpA"
            />
            <CampoTexto
              label="Código de Barras / QR (Opcional)"
              value={formularioBarcode}
              onChangeText={establecerFormularioBarcode}
              placeholder="Ej: 7801234567890"
            />

            <TouchableOpacity
              onPress={() => establecerFormularioEsBulk(!formularioEsBulk)}
              style={estilos.bulkVerificarFila}
            >
              <Ionicons
                name={formularioEsBulk ? "checkbox" : "square-outline"}
                size={20}
                color={formularioEsBulk ? tema.colors.primary : tema.colors.textMuted}
              />
              <Text style={estilos.bulkVerificarTexto}>Insumo a granel (admite 3 decimales y contenedor)</Text>
            </TouchableOpacity>

            {formularioEsBulk && (
              <CampoTexto
                label="Capacidad Nominal del Contenedor / Carrete"
                value={formularioContenedorCapacity}
                onChangeText={establecerFormularioContenedorCapacity}
                keyboardType="numeric"
                placeholder="100"
              />
            )}
          </View>
        )}

        {Boolean(formularioError) && <Text style={estilos.errorTexto}>{formularioError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerNuevoProductoModal(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Guardar Insumo"
            variant="primary"
            onPress={manejarGuardarProducto}
          />
        </View>
      </VistaModal>

      {/* MODAL 2: CREAR O EDITAR SOLICITUD DE INSUMOS (H6 / H36 / FRONT-2) */}
      <VistaModal
        visible={nuevoSolicitudModal}
        onClose={() => {
          establecerNuevoSolicitudModal(false);
          establecerEditandoSolicitud?.(null);
        }}
        title={
          editandoSolicitud
            ? `Editar Solicitud: ${editandoSolicitud.code}`
            : "Nueva Solicitud de Insumos"
        }
        subtitle={
          editandoSolicitud
            ? "Editable únicamente mientras permanezca en estado Pendiente • Valida stock disponible en tiempo real"
            : "Muestra stock disponible en tiempo real, valida existencias y proyecto activo, y reserva el stock en Comprometido"
        }
      >
        {(() => {
          const proyectoSeleccionado =
            todosProyectos.find((p: any) => p.id === seleccionadoProyectoId) ||
            activoProyectos.find((p: any) => p.id === seleccionadoProyectoId) ||
            null;
          const catalogoEfectivo =
            editandoSolicitud && editandoSolicitud.status === "pendiente"
              ? liberarReservaComprometidoEnCatalogoH6(productos, editandoSolicitud.items)
              : productos;
          const validacionEnVivo = validarFormularioNuevaSolicitudInsumos(
            proyectoSeleccionado,
            solicitudElementos,
            catalogoEfectivo
          );
          const proyectosMostrados =
            todosProyectos.length > 0 ? todosProyectos : activoProyectos;

          return (
            <>
              <Text style={estilos.formularioSeccionEtiqueta}>
                1. Proyecto Destino (Obligatorio — Solo Proyectos Activos):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {proyectosMostrados.map((p: any) => {
                  const esActivoProy = esProyectoActivoParaSolicitud(p);
                  const esSeleccionado = seleccionadoProyectoId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => establecerSeleccionadoProyectoId(p.id)}
                      style={[
                        estilos.proyectoChip,
                        esSeleccionado && estilos.proyectoChipActivo,
                        !esActivoProy && {
                          borderColor: tema.colors.danger,
                          opacity: 0.75,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          estilos.proyectoChipTexto,
                          esSeleccionado && estilos.proyectoChipTextoActivo,
                        ]}
                      >
                        {p.code} - {p.name} ({String(p.status || "").toUpperCase()})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {validacionEnVivo.errorProyecto && (
                <View style={[estilos.faltanteAlertaTarjeta, { marginBottom: 10 }]}>
                  <View style={estilos.tituloWithIcono}>
                    <Ionicons name="lock-closed" size={18} color={tema.colors.danger} />
                    <Text style={estilos.faltanteAlertaTitulo}>Proyecto Inactivo o No Seleccionado</Text>
                  </View>
                  <Text style={estilos.faltanteAlertaLinea}>{validacionEnVivo.errorProyecto}</Text>
                </View>
              )}

              <Text style={estilos.formularioSeccionEtiqueta}>
                2. Insumos y Cantidades Solicitadas (Stock Disponible en Vivo):
              </Text>
              {solicitudElementos.map((item: any, idx: number) => {
                const evalLinea = validacionEnVivo.lineasEvaluadas[idx];
                const prod = productos.find((p: any) => p.sku === item.sku);
                const esGranel = Boolean(prod?.isBulk);
                const avail = evalLinea ? evalLinea.stockDisponibleActual : prod ? prod.stock : 0;
                const comprometidoActual = evalLinea
                  ? evalLinea.stockComprometidoActual
                  : prod?.committed || 0;
                const superaDisp = Boolean(evalLinea?.superaDisponible);
                const invalida = Boolean(evalLinea?.cantidadInvalida || evalLinea?.insumoInactivo);
                const claveInput = `${idx}_${item.sku}`;
                const textoInputSolicitud =
                  textosCantidadSolicitud[claveInput] !== undefined
                    ? textosCantidadSolicitud[claveInput]
                    : String(item.quantity);
                const remanenteGranelSolicitud = prod
                  ? calcularRemanenteContenedorGranel(prod, {
                    cantidadMovimiento: Number(item.quantity || 0),
                    tipoMovimiento: "solicitud",
                    stockBaseOverride: avail,
                  })
                  : null;

                return (
                  <View
                    key={`${item.sku}_${idx}`}
                    style={[
                      estilos.solicitudLineaTarjeta,
                      (superaDisp || invalida) && estilos.lackingExistenciaFormularioFila,
                    ]}
                  >
                    {/* Selector de Insumo del Catálogo con Stock Disponible en Vivo */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 8 }}
                    >
                      {productos
                        .filter((p: any) => !p.disabled)
                        .map((p: any) => {
                          const activoSku = p.sku === item.sku;
                          return (
                            <TouchableOpacity
                              key={p.sku}
                              onPress={() =>
                                manejarSolicitudElementoCambiar(idx, p.sku, item.quantity)
                              }
                              style={[
                                estilos.productoSeleccionarChip,
                                activoSku && estilos.productoSeleccionarChipActivo,
                                { paddingVertical: 4, paddingHorizontal: 10, marginRight: 6 },
                              ]}
                            >
                              <Text
                                style={[
                                  estilos.productoSeleccionarSku,
                                  activoSku && { color: tema.colors.primary },
                                ]}
                              >
                                {p.sku} • {p.name}
                              </Text>
                              <Text style={estilos.productoSeleccionarExistencia}>
                                Disp: {p.stock} {p.unit} | Comp: {p.committed || 0} {p.unit}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 2, marginRight: 8 }}>
                        <Text style={estilos.elementoSkuEtiqueta}>
                          {prod ? `${prod.name} (${prod.sku})` : item.sku}
                        </Text>
                        <Text
                          style={[
                            estilos.elementoExistenciaDisponible,
                            superaDisp && { color: tema.colors.danger, fontWeight: "bold" },
                          ]}
                        >
                          Stock Disponible en Vivo: {avail} {prod?.unit || "un"} • Comprometido Actual: {comprometidoActual} {prod?.unit || "un"}
                        </Text>
                        {!superaDisp && !invalida && evalLinea && (
                          <Text style={{ fontSize: 11, color: tema.colors.okDark, marginTop: 2 }}>
                            Reserva tras confirmar → Remanente disponible:{" "}
                            {formatearCantidadMovimientoBodega(
                              evalLinea.stockDisponibleRestanteH6,
                              esGranel,
                              evalLinea.unit
                            )}{" "}
                            | Comprometido:{" "}
                            <Text style={{ fontWeight: "bold" }}>
                              {formatearCantidadMovimientoBodega(
                                evalLinea.stockComprometidoNuevoH6,
                                esGranel,
                                evalLinea.unit
                              )}
                            </Text>
                          </Text>
                        )}
                        {evalLinea?.mensajeAlerta && (
                          <Text style={{ fontSize: 11, color: tema.colors.danger, fontWeight: "600", marginTop: 2 }}>
                            ⚠ {evalLinea.mensajeAlerta}
                          </Text>
                        )}
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <TextInput
                          value={textoInputSolicitud}
                          onChangeText={(val: any) => {
                            const san = sanitizarEntradaCantidadBodega(val, esGranel, 3);
                            establecerTextosCantidadSolicitud((prev) => ({
                              ...prev,
                              [claveInput]: san.textoSanitizado,
                            }));
                            manejarSolicitudElementoCambiar(idx, item.sku, san.valorNumerico);
                          }}
                          placeholder={esGranel ? "0.000" : "1"}
                          keyboardType="decimal-pad"
                          style={[
                            estilos.cantidadEntrada,
                            (superaDisp || invalida) && { borderColor: tema.colors.danger, borderWidth: 1.5 },
                          ]}
                        />
                        <Text style={estilos.despachoUnidadEtiqueta}>{prod?.unit || "un"}</Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          const updated = solicitudElementos.filter((_: any, i: number) => i !== idx);
                          establecerSolicitudElementos(updated);
                          establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(updated));
                        }}
                        style={{ padding: 4, marginLeft: 6 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
                      </Pressable>
                    </View>

                    {/* [FRONT-2] Capacidad restante del contenedor para insumos a granel */}
                    {esGranel && remanenteGranelSolicitud && prod?.containerCapacity && (
                      <View
                        style={{
                          marginTop: 8,
                          backgroundColor: tema.colors.primaryLight,
                          borderRadius: tema.radius.sm,
                          padding: 8,
                          borderWidth: 1,
                          borderColor: tema.colors.primaryBorder,
                        }}
                      >
                        <BarraProgreso
                          value={remanenteGranelSolicitud.remanenteEnContenedorActual}
                          max={prod.containerCapacity}
                          height={6}
                          showPercentage
                          semaforo
                          label={
                            remanenteGranelSolicitud.etiquetaCapacidadContenedor ||
                            `Capacidad restante del contenedor: ${remanenteGranelSolicitud.remanenteEnContenedorActual.toFixed(
                              3
                            )} / ${prod.containerCapacity} ${prod.unit}`
                          }
                        />
                      </View>
                    )}
                  </View>
                );
              })}

              <Boton
                title="+ Agregar otro insumo"
                variant="outline"
                size="sm"
                onPress={() => {
                  const siguienteProducto = productos.find(
                    (p: any) => !p.disabled && !solicitudElementos.some((i: any) => i.sku === p.sku)
                  );
                  if (!siguienteProducto) {
                    mostrarAviso("Todos los insumos disponibles ya están agregados en esta solicitud.");
                    return;
                  }
                  const updated = [...solicitudElementos, { sku: siguienteProducto.sku, quantity: 1 }];
                  establecerSolicitudElementos(updated);
                  establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(updated));
                }}
                style={{ marginVertical: 8 }}
              />

              {establecerSolicitudUrgencia && (
                <>
                  <Text style={estilos.formularioSeccionEtiqueta}>Nivel de Prioridad:</Text>
                  <View style={estilos.motivoPastillasFila}>
                    {(["normal", "alta", "urgente"] as const).map((nivel) => (
                      <TouchableOpacity
                        key={nivel}
                        onPress={() => establecerSolicitudUrgencia(nivel)}
                        style={[
                          estilos.motivoPastilla,
                          solicitudUrgencia === nivel && estilos.motivoPastillaActivo,
                        ]}
                      >
                        <Text
                          style={[
                            estilos.motivoPastillaTexto,
                            solicitudUrgencia === nivel && estilos.motivoPastillaTextoActivo,
                          ]}
                        >
                          {nivel.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <CampoTexto
                label="Nota o justificación (opcional)"
                value={solicitudComentario}
                onChangeText={establecerSolicitudComentario}
                placeholder="Ej: Material reservado para montaje de tablero en faena"
              />

              {/* Alerta en vivo si alguna cantidad supera el stock disponible */}
              {validacionEnVivo.faltantesStock.length > 0 && (
                <View style={estilos.faltanteAlertaTarjeta}>
                  <View style={estilos.tituloWithIcono}>
                    <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
                    <Text style={estilos.faltanteAlertaTitulo}>
                      Alerta: Cantidad Supera el Stock Disponible en Bodega
                    </Text>
                  </View>
                  {validacionEnVivo.faltantesStock.map((m: string, i: number) => (
                    <Text key={i} style={estilos.faltanteAlertaLinea}>
                      • {m}
                    </Text>
                  ))}
                </View>
              )}

              {Boolean(solicitudError) && <Text style={estilos.errorTexto}>{solicitudError}</Text>}

              <View style={estilos.modalBotonesFila}>
                <Boton
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => {
                    establecerNuevoSolicitudModal(false);
                    establecerEditandoSolicitud?.(null);
                  }}
                  style={{ marginRight: 8 }}
                />
                <Boton
                  title={editandoSolicitud ? "Guardar Cambios en Solicitud" : "Crear Solicitud (Reservar Stock)"}
                  variant="primary"
                  disabled={!validacionEnVivo.esValida}
                  onPress={manejarEnviarSolicitud}
                />
              </View>
            </>
          );
        })()}
      </VistaModal>

      {/* MODAL 3: LINEA DE TIEMPO */}
      <VistaModal
        visible={Boolean(seleccionadoTimelineSolicitud)}
        onClose={() => establecerSeleccionadoTimelineSolicitud(null)}
        title="Línea de Tiempo de Solicitud"
        subtitle={seleccionadoTimelineSolicitud ? `${seleccionadoTimelineSolicitud.code} • ${seleccionadoTimelineSolicitud.projectName}` : ""}
      >
        {seleccionadoTimelineSolicitud?.timeline?.map((step: any, idx: any) => (
          <View key={step.id || idx} style={estilos.timelinePaso}>
            <View style={estilos.timelinePuntoCaja}>
              <View style={estilos.timelinePunto} />
              {idx < (seleccionadoTimelineSolicitud.timeline?.length || 0) - 1 && <View style={estilos.timelineLinea} />}
            </View>
            <View style={estilos.timelineContenido}>
              <Text style={estilos.timelineTitulo}>{step.title}</Text>
              <Text style={estilos.timelineDescripcion}>{step.description}</Text>
              <Text style={estilos.timelineMeta}>{step.author} • {step.date}</Text>
            </View>
          </View>
        ))}
      </VistaModal>

      {/* MODAL 4: MOTIVO OBLIGATORIO DE RECHAZO DE SOLICITUD */}
      <ModalRechazoSolicitud
        solicitud={rechazarModalSolicitud}
        motivoInicial={rechazarMotivo}
        onClose={() => establecerRechazarModalSolicitud(null)}
        onConfirmarRechazo={(solicitud, motivo) => {
          const resultado = rechazarSolicitudMaterial(solicitud.id, motivo, usuario.name);
          if (resultado?.success) {
            mostrarAviso(
              `Solicitud ${solicitud.code} rechazada. Motivo informado al bodeguero solicitante.`
            );
            return { success: true };
          }
          return {
            success: false,
            error: resultado?.error || "Debe ingresar un motivo obligatorio.",
          };
        }}
      />

      {/* MODAL 11: VISTA DE COMPROBANTE NUMERADO AL APROBAR */}
      <ModalComprobanteSolicitud
        solicitud={seleccionadoComprobanteSolicitud}
        onClose={() => establecerSeleccionadoComprobanteSolicitud(null)}
        onNotify={mostrarAviso}
      />

      {/* MODAL 12: CONFIRMACIÓN PARA ANULAR SOLICITUD PENDIENTE */}
      <DialogoConfirmacion
        visible={Boolean(anularConfirmarSolicitud)}
        title={`Anular Solicitud ${anularConfirmarSolicitud?.code || ""}`}
        message={`¿Confirmas anular la solicitud ${anularConfirmarSolicitud?.code || ""} para el proyecto ${anularConfirmarSolicitud?.projectName || ""}? Pasará a estado Anulada y sus acciones quedarán bloqueadas.`}
        confirmLabel="Sí, Anular Solicitud"
        cancelLabel="Volver"
        variant="danger"
        onConfirm={() => {
          if (anularConfirmarSolicitud && cancelarSolicitudMaterial) {
            const res = cancelarSolicitudMaterial(anularConfirmarSolicitud.id, usuario.name);
            if (res.success) {
              mostrarAviso(
                `Solicitud ${anularConfirmarSolicitud.code} anulada correctamente.`
              );
            } else {
              mostrarAviso(res.error || "No fue posible anular la solicitud.");
            }
          }
          establecerAnularConfirmarSolicitud?.(null);
        }}
        onCancel={() => establecerAnularConfirmarSolicitud?.(null)}
      />

      {/* MODAL 5: REGISTRAR MERMA - [FRONT-2] Formulario de registro de mermas */}
      <FormularioRegistroMermas
        visible={mermaModalVisible}
        skuInicial={mermaSku}
        onCerrar={() => establecerMermaModalVisible(false)}
        onExito={() => {
          establecerMermaModalVisible(false);
          mostrarAviso("Merma registrada y descontada de inventario.");
        }}
        modoModal={true}
      />

      {/* MODAL 6: REGISTRAR CONTEO FISICO */}
      <VistaModal
        visible={conteoModalVisible}
        onClose={() => establecerConteoModalVisible(false)}
        title="Registrar Conteo Físico de Bodega"
        subtitle="Regla de tolerancia: ≤ 5% ajuste directo | > 5% aprobación Admin"
      >
        <View style={estilos.lockedAdvertenciaBanner}>
          <Ionicons name="lock-closed" size={16} color="#991b1b" style={{ marginRight: 6 }} />
          <Text style={estilos.lockedBannerTexto}>
            El insumo se bloqueará para movimientos durante el conteo y auditoría.
          </Text>
        </View>

        <View style={estilos.entradaWithEscanerFila}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.formularioSeccionEtiqueta}>Insumo Auditado:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {productos.map((p: any) => (
                <TouchableOpacity
                  key={p.sku}
                  onPress={() => {
                    establecerConteoSku(p.sku);
                    establecerConteoPhysicalCantidad(String(p.stock));
                    if (establecerConteoEscaneoInfo) establecerConteoEscaneoInfo(null);
                  }}
                  style={[estilos.productoSeleccionarChip, conteoSku === p.sku && estilos.productoSeleccionarChipActivo]}
                >
                  <Text style={[estilos.productoSeleccionarSku, conteoSku === p.sku && { color: tema.colors.primary }]}>
                    {p.sku}
                  </Text>
                  <Text style={estilos.productoSeleccionarExistencia}>Sistema: {p.stock} {p.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            onPress={() =>
              abrirEscaner(
                "Escanear Insumo para Conteo Físico",
                (code: any, meta: any) => {
                  const res =
                    meta && meta.valido && meta.producto
                      ? meta
                      : resolverCodigoEscaneadoBodega(code, productos);
                  if (!res.valido || !res.producto) {
                    mostrarAviso(
                      res.mensajeError || `Código "${code}" no existe en el catálogo. Flujo detenido.`
                    );
                    return;
                  }
                  establecerConteoSku(res.producto.sku);
                  establecerConteoPhysicalCantidad(String(res.producto.stock));
                  const tiempoTexto = formatearTiempoEscaneo(res.tiempoMs);
                  const info = `SKU ${res.producto.sku} autocompletado en ${tiempoTexto}`;
                  if (establecerConteoEscaneoInfo) establecerConteoEscaneoInfo(info);
                  mostrarAviso(`✓ ${info} (${res.producto.name})`);
                },
                { moduloOrigen: "conteo", validarExistencia: true }
              )
            }
            style={[estilos.escanerIconoBoton, { flexDirection: "row", gap: 4, paddingHorizontal: 10, width: "auto" }]}
            accessibilityLabel="Escanear QR o código de barras para conteo físico"
          >
            <Ionicons name="qr-code-outline" size={18} color={tema.colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.primaryDark }}>QR / Barras</Text>
          </TouchableOpacity>
        </View>

        {Boolean(conteoEscaneoInfo) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: tema.colors.okLight,
              borderWidth: 1,
              borderColor: tema.colors.ok,
              borderRadius: tema.radius.sm,
              paddingHorizontal: 10,
              paddingVertical: 7,
              marginBottom: 10,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={tema.colors.okDark} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: tema.colors.okDark }}>
              {conteoEscaneoInfo}
            </Text>
          </View>
        )}

        <CampoTexto
          label={`Cantidad Física Contada en Bodega (${seleccionadoConteoProducto?.unit || "un"}${seleccionadoConteoProducto?.isBulk ? " • Granel hasta 3 decimales" : ""
            }):`}
          value={conteoPhysicalCantidad}
          onChangeText={(val: any) => {
            const san = sanitizarEntradaCantidadBodega(
              val,
              Boolean(seleccionadoConteoProducto?.isBulk),
              3
            );
            establecerConteoPhysicalCantidad(san.textoSanitizado);
          }}
          placeholder={seleccionadoConteoProducto?.isBulk ? "0.000" : "0"}
          keyboardType="decimal-pad"
        />

        {seleccionadoConteoProducto && (() => {
          const remanenteConteo = calcularRemanenteContenedorGranel(seleccionadoConteoProducto, {
            tipoMovimiento: "conteo",
            cantidadContadaFisica: parseFloat(String(conteoPhysicalCantidad || "0").replace(",", ".")) || 0,
          });
          return (
            <View
              style={{
                backgroundColor: tema.colors.surfaceAlt,
                borderRadius: tema.radius.sm,
                padding: 10,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: tema.colors.borderLight,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text }}>
                  {remanenteConteo.etiquetaUnidadYRemanente}
                </Text>
                <Insignia
                  label={`UM: ${seleccionadoConteoProducto.unit.toUpperCase()}${seleccionadoConteoProducto.isBulk ? " (Granel • 3 dec.)" : ""
                    }`}
                  tone="info"
                  size="sm"
                />
              </View>
              {seleccionadoConteoProducto.isBulk && seleccionadoConteoProducto.containerCapacity && (
                <BarraProgreso
                  value={remanenteConteo.remanenteEnContenedorActual}
                  max={seleccionadoConteoProducto.containerCapacity}
                  height={6}
                  showPercentage
                  semaforo
                  label={
                    remanenteConteo.etiquetaCapacidadContenedor ||
                    `Capacidad restante del contenedor: ${remanenteConteo.remanenteEnContenedorActual.toFixed(
                      3
                    )} / ${seleccionadoConteoProducto.containerCapacity} ${seleccionadoConteoProducto.unit}`
                  }
                />
              )}
            </View>
          );
        })()}

        {/* Tarjeta de Discrepancia y Regla de Umbral del 5 % */}
        <Tarjeta variant="outlined" style={estilos.conteoDiferenciaTarjeta}>
          <View style={[estilos.conteoDiferenciaFila, { flexWrap: "wrap", gap: 8 }]}>
            <View>
              <Text style={estilos.conteoDiferenciaEtiqueta}>Diferencia Física:</Text>
              <Text
                style={[
                  estilos.conteoDiferenciaValor,
                  conteoDiferencia !== 0 && {
                    color: conteoRequiresApproval ? tema.colors.danger : tema.colors.okDark,
                  },
                ]}
              >
                {conteoDiferencia > 0 ? `+${conteoDiferencia}` : conteoDiferencia}{" "}
                {seleccionadoConteoProducto?.unit} ({conteoDiferenciaPorcentaje.toFixed(1)}%)
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={estilos.conteoDiferenciaEtiqueta}>Impacto Valorizado:</Text>
              <Text
                style={[
                  estilos.conteoDiferenciaValor,
                  conteoDiferencia !== 0 && { color: tema.colors.danger },
                ]}
              >
                {formatearCLP(conteoDiferenciaValor)}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: tema.radius.sm,
              backgroundColor: conteoRequiresApproval
                ? tema.colors.warnLight
                : tema.colors.okLight,
              borderWidth: 1,
              borderColor: conteoRequiresApproval ? tema.colors.warn : tema.colors.ok,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons
              name={conteoRequiresApproval ? "lock-closed" : "checkmark-circle"}
              size={18}
              color={conteoRequiresApproval ? tema.colors.warnDark : tema.colors.ok}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: "600",
                color: conteoRequiresApproval ? tema.colors.warnDark : tema.colors.okDark,
              }}
            >
              {conteoRequiresApproval
                ? "Supera el umbral del 5 %: el ajuste quedará RETENIDO para aprobación del Administrador."
                : "Dentro del umbral (≤ 5 %): el ajuste se aplicará DIRECTO al stock y al Cardex."}
            </Text>
          </View>
        </Tarjeta>

        <CampoTexto
          label="Observaciones de Auditoría (opcional):"
          value={conteoNotas}
          onChangeText={establecerConteoNotas}
          placeholder="Ej: Conteo físico en gaveta A-02. Faltante encontrado."
        />

        {Boolean(conteoError) && <Text style={estilos.errorTexto}>{conteoError}</Text>}

        <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 8 }]}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerConteoModalVisible(false)}
            style={{ flex: 1, minWidth: 110, minHeight: 44 }}
          />
          <Boton
            title={
              conteoRequiresApproval
                ? "Enviar a Aprobación (> 5%)"
                : "Aplicar Ajuste Directo (≤ 5%)"
            }
            variant={conteoRequiresApproval ? "secondary" : "primary"}
            icon={conteoRequiresApproval ? "lock-closed-outline" : "checkmark-circle-outline"}
            onPress={manejarRegisterConteo}
            style={{ flex: 1.6, minWidth: 170, minHeight: 46 }}
          />
        </View>
      </VistaModal>

      {/* MODAL 8: DIÁLOGO DE CONFIRMACIÓN DE EGRESO (Avisa que no se edita) */}
      <DialogoConfirmacion
        visible={confirmarDespachoVisible}
        title="Confirmar Egreso Físico en Bodega"
        message={`¿Confirmar el despacho de ${totalUnidadesHastaDespacho} unidades para el proyecto ${activoDespachoSolicitud?.projectName || ""}? El egreso es definitivo y rebajará el stock físico en Cardex.`}
        confirmLabel="Confirmar Despacho"
        cancelLabel="Revisar"
        variant="warning"
        onConfirm={manejarExecuteDespacho}
        onCancel={() => establecerConfirmarDespachoVisible(false)}
      />

      {/* MODAL 9: ESCÁNER QR Y CÓDIGO DE BARRAS REUTILIZABLE (TABLET) */}
      <ModalEscanerQr
        visible={escanerVisible}
        onClose={() => establecerEscanerVisible(false)}
        title={escanerTitulo}
        productos={productos}
        validarExistencia={escanerValidarExistencia}
        moduloOrigen={escanerModuloOrigen}
        sugerenciaSkus={escanerSugerenciaSkus}
        onScanResult={(code: any) => {
          if (!escanerValidarExistencia && escanerCallback) {
            escanerCallback(code);
          }
        }}
        onScanMeta={(meta) => {
          if (escanerValidarExistencia && meta.valido && escanerCallback) {
            escanerCallback(meta.sku, meta);
          }
        }}
      />

      {/* MODAL 10: CARDEX DE MOVIMIENTOS POR INSUMO (CON RESPONSABLE "¿QUIÉN LO HIZO?" Y CONTRASTE DE SALDO ACTUAL VS ÚLTIMA LÍNEA) */}
      <VistaModal
        visible={Boolean(productoCardexSeleccionado)}
        onClose={() => establecerProductoCardexSeleccionado && establecerProductoCardexSeleccionado(null)}
        title={productoCardexSeleccionado ? `Cardex de Solo Lectura: ${productoCardexSeleccionado.sku}` : "Cardex"}
        subtitle={productoCardexSeleccionado?.name || ""}
      >
        {productoCardexSeleccionado && (() => {
          const { movimientosCronologicoAsc } = filtrarYOrdenarCardexSoloLectura(cardex, {
            skuExacto: productoCardexSeleccionado.sku,
            ordenCronologico: "asc",
          });
          const contrasteModal = contrastarSaldoInsumoConUltimaLineaCardex(
            productoCardexSeleccionado,
            cardex
          );

          return (
            <View style={estilos.modalCardexContenido}>
              {/* Cabecera Resumen Insumo */}
              <View style={estilos.modalCardexCabecera}>
                <View style={estilos.modalCardexCol}>
                  <Text style={estilos.modalCardexEtiqueta}>Saldo Actual</Text>
                  <Text style={estilos.modalCardexValor}>
                    {productoCardexSeleccionado.stock} {productoCardexSeleccionado.unit}
                  </Text>
                </View>
                <View style={estilos.modalCardexCol}>
                  <Text style={estilos.modalCardexEtiqueta}>Última Línea Cardex</Text>
                  <Text style={[estilos.modalCardexValor, { color: tema.colors.okDark }]}>
                    {contrasteModal.saldoUltimaLineaCardex !== null
                      ? `${contrasteModal.saldoUltimaLineaCardex} ${productoCardexSeleccionado.unit}`
                      : "Sin mov."}
                  </Text>
                </View>
                <View style={estilos.modalCardexCol}>
                  <Text style={estilos.modalCardexEtiqueta}>PMP Unitario</Text>
                  <Text style={[estilos.modalCardexValor, { color: tema.colors.primaryDark }]}>
                    {formatearCLP(productoCardexSeleccionado.pmp || productoCardexSeleccionado.unitCost)}
                  </Text>
                </View>
              </View>

              {/* [SCRUM] Aviso de contraste entre saldo actual y última línea del Cardex */}
              <View
                style={{
                  backgroundColor: contrasteModal.coincideSaldoConUltimaLinea
                    ? tema.colors.okLight
                    : tema.colors.warnLight,
                  borderWidth: 1,
                  borderColor: contrasteModal.coincideSaldoConUltimaLinea
                    ? tema.colors.ok
                    : tema.colors.warn,
                  borderRadius: tema.radius.sm,
                  padding: 8,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                  {contrasteModal.mensajeVerificacion}
                </Text>
              </View>

              {/* Listado Cronológico de Movimientos del Insumo */}
              <Text style={estilos.modalCardexSubtitulo}>
                Tabla Cronológica de Movimientos, Saldos y PMP (Solo Lectura):
              </Text>

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
                {movimientosCronologicoAsc.length === 0 ? (
                  <EstadoVacio
                    icon="swap-horizontal-outline"
                    title="Sin movimientos previos"
                    description={`No se han registrado movimientos en Cardex para ${productoCardexSeleccionado.sku}.`}
                    containerStyle={{ marginVertical: 16, borderWidth: 0 }}
                  />
                ) : (
                  movimientosCronologicoAsc.map((item: MovimientoCardex, idx: number) => {
                    const esEntrada = item.qtyIn > 0;
                    const esUltimaLinea = idx === movimientosCronologicoAsc.length - 1;
                    return (
                      <View
                        key={item.id}
                        style={[
                          estilos.modalCardexItem,
                          esUltimaLinea && {
                            borderColor: tema.colors.primary,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        {/* Cabecera del Movimiento */}
                        <View style={estilos.modalCardexItemSuperior}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={estilos.modalCardexFecha}>
                                #{idx + 1} • {formatearFecha(item.date)}
                              </Text>
                              {esUltimaLinea && (
                                <Insignia label="Última línea" tone="primary" size="sm" />
                              )}
                            </View>
                            <Text style={estilos.modalCardexReferencia}>Ref: {item.reference}</Text>
                            {item.projectName && (
                              <Text style={estilos.modalCardexProyecto}>Obra: {item.projectName}</Text>
                            )}
                          </View>
                          <Insignia
                            label={item.typeLabel}
                            tone={
                              item.type === "entrada_compra" || item.type === "devolucion"
                                ? "ok"
                                : item.type === "merma"
                                  ? "danger"
                                  : item.type === "ajuste_conteo"
                                    ? "warn"
                                    : "info"
                            }
                            size="sm"
                          />
                        </View>

                        {/* Cantidades y Saldo */}
                        <View style={estilos.modalCardexCifrasFila}>
                          <View style={estilos.modalCardexCifraCol}>
                            <Text style={estilos.modalCardexCifraLbl}>Cantidad</Text>
                            <Text
                              style={[
                                estilos.modalCardexCifraVal,
                                { color: esEntrada ? tema.colors.okDark : tema.colors.danger, fontWeight: "bold" },
                              ]}
                            >
                              {esEntrada ? `+${item.qtyIn}` : item.qtyOut > 0 ? `-${item.qtyOut}` : "0"}{" "}
                              {productoCardexSeleccionado.unit}
                            </Text>
                          </View>
                          <View style={estilos.modalCardexCifraCol}>
                            <Text style={estilos.modalCardexCifraLbl}>Saldo Posterior</Text>
                            <Text style={[estilos.modalCardexCifraVal, { fontWeight: "bold" }]}>
                              {item.balance} {productoCardexSeleccionado.unit}
                            </Text>
                          </View>
                          <View style={estilos.modalCardexCifraCol}>
                            <Text style={estilos.modalCardexCifraLbl}>PMP Posterior</Text>
                            <Text style={estilos.modalCardexCifraVal}>{formatearCLP(item.pmp)}</Text>
                          </View>
                        </View>

                        {/* Bloque: ¿QUIÉN LO HIZO? (Trazabilidad y Responsable) */}
                        <View style={estilos.modalCardexUsuarioCaja}>
                          <View style={estilos.modalCardexUsuarioFila}>
                            <Ionicons name="person-circle-outline" size={20} color={tema.colors.primary} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={estilos.modalCardexUsuarioTitulo}>
                                Registrado por:{" "}
                                <Text style={estilos.modalCardexUsuarioNombre}>
                                  {item.userName || "Camila Vera Soto"}
                                </Text>
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                                <Insignia
                                  label={item.userRole || "Bodeguero"}
                                  tone={
                                    item.userRole === "Administrador"
                                      ? "primary"
                                      : item.userRole === "Tecnico"
                                        ? "ok"
                                        : "warn"
                                  }
                                  size="sm"
                                />
                                {item.userRut && (
                                  <Text style={estilos.modalCardexUsuarioRut}>• RUT: {item.userRut}</Text>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={[estilos.modalBotonesFila, { marginTop: 16 }]}>
                <Boton
                  title="Cerrar Cardex"
                  variant="outline"
                  size="md"
                  onPress={() => establecerProductoCardexSeleccionado && establecerProductoCardexSeleccionado(null)}
                  style={{ width: "100%" }}
                />
              </View>
            </View>
          );
        })()}
      </VistaModal>
    </>
  );
};
