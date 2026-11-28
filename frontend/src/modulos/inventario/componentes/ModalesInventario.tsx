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

export interface PropiedadesModalesInventario {
  abrirEscaner: any;
  activoDespachoSolicitud: any;
  activoProyectos: any;
  calcularFaltanteExistencia: any;
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
  escanerCallback: any;
  escanerTitulo: any;
  escanerVisible: any;
  establecerConfirmarDespachoVisible: any;
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
  establecerSeleccionadoProyectoId: any;
  establecerSeleccionadoTimelineSolicitud: any;
  establecerSolicitudComentario: any;
  establecerSolicitudElementos: any;
  faltanteExistenciaErrores: any;
  formularioBarcode: any;
  formularioCategoria: any;
  formularioContenedorCapacity: any;
  formularioError: any;
  formularioEsBulk: any;
  formularioExistencia: any;
  formularioMinimoExistencia: any;
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
  seleccionadoMermaProducto: any;
  seleccionadoProyectoId: any;
  seleccionadoTimelineSolicitud: any;
  skuEntradaReferencia: any;
  solicitudComentario: any;
  solicitudElementos: any;
  solicitudError: any;
  totalUnidadesHastaDespacho: any;
  usuario: any;
}

export const ModalesInventario: React.FC<PropiedadesModalesInventario> = ({
  abrirEscaner,
  activoDespachoSolicitud,
  activoProyectos,
  calcularFaltanteExistencia,
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
  editandoProducto,
  escanerCallback,
  escanerTitulo,
  escanerVisible,
  establecerConfirmarDespachoVisible,
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
  establecerSeleccionadoProyectoId,
  establecerSeleccionadoTimelineSolicitud,
  establecerSolicitudComentario,
  establecerSolicitudElementos,
  faltanteExistenciaErrores,
  formularioBarcode,
  formularioCategoria,
  formularioContenedorCapacity,
  formularioError,
  formularioEsBulk,
  formularioExistencia,
  formularioMinimoExistencia,
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
  seleccionadoMermaProducto,
  seleccionadoProyectoId,
  seleccionadoTimelineSolicitud,
  skuEntradaReferencia,
  solicitudComentario,
  solicitudElementos,
  solicitudError,
  totalUnidadesHastaDespacho,
  usuario,
}) => {
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
                abrirEscaner("Escanear Código de Barras o QR", (code: any) => {
                  establecerFormularioSku(code);
                  establecerFormularioBarcode(code);
                })
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
        <Text style={estilos.formularioSeccionSubEtiqueta}>
          Especifica la magnitud física o presentación para el control de existencias, kardex y compras:
        </Text>

        <View style={estilos.unidadGrilla}>
          {UNIDADES_PRODUCTO.map((u: any) => {
            const isSelected = formularioUnidad === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => establecerFormularioUnidad(u.id)}
                style={[estilos.unidadTarjeta, isSelected && estilos.unidadTarjetaActivo]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${u.name} (${u.code}): ${u.desc}`}
              >
                <View style={estilos.unidadTarjetaEncabezado}>
                  <View style={[estilos.unidadCodigoInsignia, isSelected && estilos.unidadCodigoInsigniaActivo]}>
                    <Text style={[estilos.unidadCodigoInsigniaTexto, isSelected && estilos.unidadCodigoInsigniaTextoActivo]}>
                      {u.code}
                    </Text>
                  </View>
                  <Text style={[estilos.unidadTarjetaTitulo, isSelected && estilos.unidadTarjetaTituloActivo]}>
                    {u.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color={tema.colors.primary} style={{ marginLeft: "auto" }} />
                  )}
                </View>
                <Text style={[estilos.unidadTarjetaDescripcion, isSelected && estilos.unidadTarjetaDescripcionActivo]}>
                  {u.desc}
                </Text>
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

        {/* 2. CONTROL DE EXISTENCIAS */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Control de Existencias</Text>
        {!editandoProducto && (
          <CampoTexto
            label="Stock Inicial Disponible"
            value={formularioExistencia}
            onChangeText={establecerFormularioExistencia}
            keyboardType="numeric"
            placeholder="0"
          />
        )}
        <CampoTexto
          label="Stock Mínimo de Alerta"
          value={formularioMinimoExistencia}
          onChangeText={establecerFormularioMinimoExistencia}
          keyboardType="numeric"
          placeholder="10"
        />

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

      {/* MODAL 2: NUEVA SOLICITUD DE MATERIALES */}
      <VistaModal
        visible={nuevoSolicitudModal}
        onClose={() => establecerNuevoSolicitudModal(false)}
        title="Crear Solicitud de Material"
        subtitle="Validada contra stock disponible en bodega"
      >
        <Text style={estilos.formularioSeccionEtiqueta}>Seleccionar Proyecto Activo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {activoProyectos.map((p: any) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => establecerSeleccionadoProyectoId(p.id)}
              style={[
                estilos.proyectoChip,
                seleccionadoProyectoId === p.id && estilos.proyectoChipActivo,
              ]}
            >
              <Text
                style={[
                  estilos.proyectoChipTexto,
                  seleccionadoProyectoId === p.id && estilos.proyectoChipTextoActivo,
                ]}
              >
                {p.code} - {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={estilos.formularioSeccionEtiqueta}>Insumos Solicitados:</Text>
        {solicitudElementos.map((item: any, idx: any) => {
          const prod = productos.find((p: any) => p.sku === item.sku);
          const avail = prod ? prod.stock : 0;
          const esLacking = avail < item.quantity;

          return (
            <View key={idx} style={[estilos.solicitudElementoFormularioFila, esLacking && estilos.lackingExistenciaFormularioFila]}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={estilos.elementoSkuEtiqueta}>{prod ? prod.name : item.sku}</Text>
                <Text style={[estilos.elementoExistenciaDisponible, esLacking && { color: tema.colors.danger, fontWeight: "bold" }]}>
                  Disponible: {avail} {prod?.unit}
                </Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(val: any) => {
                  const numero = Number(val) || 0;
                  manejarSolicitudElementoCambiar(idx, item.sku, numero);
                }}
                keyboardType="numeric"
                style={[estilos.cantidadEntrada, esLacking && { borderColor: tema.colors.danger }]}
              />
              <Pressable
                onPress={() => {
                  const updated = solicitudElementos.filter((_: any, i: any) => i !== idx);
                  establecerSolicitudElementos(updated);
                  establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(updated));
                }}
                style={{ padding: 4, marginLeft: 6 }}
              >
                <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
              </Pressable>
            </View>
          );
        })}

        <Boton
          title="+ Agregar otro insumo"
          variant="outline"
          size="sm"
          onPress={() => {
            const siguienteProducto = productos.find((p: any) => !solicitudElementos.some((i: any) => i.sku === p.sku));
            if (siguienteProducto) {
              const updated = [...solicitudElementos, { sku: siguienteProducto.sku, quantity: 1 }];
              establecerSolicitudElementos(updated);
              establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(updated));
            }
          }}
          style={{ marginVertical: 8 }}
        />

        <CampoTexto
          label="Nota o justificación (opcional)"
          value={solicitudComentario}
          onChangeText={establecerSolicitudComentario}
          placeholder="Ej: Material para partida de iluminación piso 2"
        />

        {/* Bloqueo si falta stock */}
        {faltanteExistenciaErrores.length > 0 && (
          <View style={estilos.faltanteAlertaTarjeta}>
            <View style={estilos.tituloWithIcono}>
              <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
              <Text style={estilos.faltanteAlertaTitulo}>Bloqueo: Stock Insuficiente en Bodega</Text>
            </View>
            {faltanteExistenciaErrores.map((m: any, i: any) => (
              <Text key={i} style={estilos.faltanteAlertaLinea}>• {m}</Text>
            ))}
          </View>
        )}

        {Boolean(solicitudError) && <Text style={estilos.errorTexto}>{solicitudError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerNuevoSolicitudModal(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Enviar Solicitud"
            variant="primary"
            disabled={faltanteExistenciaErrores.length > 0}
            onPress={manejarEnviarSolicitud}
          />
        </View>
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

      {/* MODAL 4: MOTIVO DE RECHAZO DE SOLICITUD */}
      <VistaModal
        visible={Boolean(rechazarModalSolicitud)}
        onClose={() => establecerRechazarModalSolicitud(null)}
        title="Rechazar Solicitud de Material"
        subtitle={rechazarModalSolicitud ? `${rechazarModalSolicitud.code}` : ""}
      >
        <Text style={estilos.modalInstruction}>
          El rechazo exige motivo obligatorio:
        </Text>
        <TextInput
          value={rechazarMotivo}
          onChangeText={establecerRechazarMotivo}
          placeholder="Ingrese motivo de rechazo detallado..."
          placeholderTextColor={tema.colors.textLight}
          multiline
          numberOfLines={3}
          style={estilos.motivoEntrada}
        />
        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerRechazarModalSolicitud(null)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Confirmar Rechazo"
            variant="danger"
            disabled={!rechazarMotivo.trim()}
            onPress={() => {
              if (rechazarModalSolicitud && rechazarMotivo.trim()) {
                rechazarSolicitudMaterial(rechazarModalSolicitud.id, rechazarMotivo.trim(), usuario.name);
                mostrarAviso(`Solicitud ${rechazarModalSolicitud.code} rechazada.`);
                establecerRechazarModalSolicitud(null);
              }
            }}
          />
        </View>
      </VistaModal>

      {/* MODAL 5: REGISTRAR MERMA */}
      <VistaModal
        visible={mermaModalVisible}
        onClose={() => establecerMermaModalVisible(false)}
        title="Registrar Merma de Insumo"
        subtitle="Descuenta stock físico y valoriza a PMP"
      >
        <Text style={estilos.formularioSeccionEtiqueta}>Seleccionar Insumo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {productos
            .filter((p: any) => !p.disabled)
            .map((p: any) => (
              <TouchableOpacity
                key={p.sku}
                onPress={() => establecerMermaSku(p.sku)}
                style={[estilos.productoSeleccionarChip, mermaSku === p.sku && estilos.productoSeleccionarChipActivo]}
              >
                <Text style={[estilos.productoSeleccionarSku, mermaSku === p.sku && { color: tema.colors.primary }]}>
                  {p.sku}
                </Text>
                <Text style={estilos.productoSeleccionarExistencia}>Disp: {p.stock} {p.unit}</Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <CampoTexto
          label={`Cantidad a dar de baja (${seleccionadoMermaProducto?.unit || "un"}):`}
          value={mermaCantidad}
          onChangeText={establecerMermaCantidad}
          keyboardType="decimal-pad"
          placeholder="1"
        />

        <Text style={estilos.formularioSeccionEtiqueta}>Motivo de la Merma:</Text>
        <View style={estilos.motivoPastillasFila}>
          {(["daño", "caducidad", "pérdida", "otro"] as const).map((r: any) => (
            <TouchableOpacity
              key={r}
              onPress={() => establecerMermaMotivo(r)}
              style={[estilos.motivoPastilla, mermaMotivo === r && estilos.motivoPastillaActivo]}
            >
              <Text style={[estilos.motivoPastillaTexto, mermaMotivo === r && estilos.motivoPastillaTextoActivo]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tarjeta con pérdida valorizada a PMP */}
        <Tarjeta variant="outlined" style={estilos.perdidaCalculationTarjeta}>
          <View style={estilos.perdidaTarjetaEncabezado}>
            <Ionicons name="calculator-outline" size={18} color={tema.colors.danger} />
            <Text style={estilos.perdidaTarjetaTitulo}>Pérdida Valorizada a PMP:</Text>
          </View>
          <Text style={estilos.perdidaAmountTexto}>{formatearCLP(mermaTotalPerdida)}</Text>
          <Text style={estilos.perdidaMetaTexto}>
            Cálculo: {mermaCantidadNumero} {seleccionadoMermaProducto?.unit} × {formatearCLP(seleccionadoMermaProducto?.pmp || seleccionadoMermaProducto?.unitCost || 0)} (PMP)
          </Text>
        </Tarjeta>

        <CampoTexto
          label="Observación Obligatoria (Detalle de la merma):"
          value={mermaObs}
          onChangeText={establecerMermaObs}
          placeholder="Ej: Embalaje roto y terminal partido al maniobrar con traspaleta..."
          multiline
        />

        {Boolean(mermaError) && <Text style={estilos.errorTexto}>{mermaError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerMermaModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Confirmar Merma"
            variant="danger"
            onPress={manejarRegisterMerma}
          />
        </View>
      </VistaModal>

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
              abrirEscaner("Escanear Insumo a Auditar", (code: any) => {
                const prod = productos.find((p: any) => p.sku === code || p.barcode === code);
                if (prod) {
                  establecerConteoSku(prod.sku);
                  establecerConteoPhysicalCantidad(String(prod.stock));
                }
              })
            }
            style={estilos.escanerIconoBoton}
          >
            <Ionicons name="barcode-outline" size={20} color={tema.colors.primary} />
          </TouchableOpacity>
        </View>

        <CampoTexto
          label={`Cantidad Física Contada en Bodega (${seleccionadoConteoProducto?.unit || "un"}):`}
          value={conteoPhysicalCantidad}
          onChangeText={establecerConteoPhysicalCantidad}
          keyboardType="decimal-pad"
        />

        {/* Tarjeta de Discrepancia y Regla de Negocio */}
        <Tarjeta variant="outlined" style={estilos.conteoDiferenciaTarjeta}>
          <View style={estilos.conteoDiferenciaFila}>
            <View>
              <Text style={estilos.conteoDiferenciaEtiqueta}>Diferencia Física:</Text>
              <Text style={[estilos.conteoDiferenciaValor, conteoDiferencia !== 0 && { color: tema.colors.danger }]}>
                {conteoDiferencia > 0 ? `+${conteoDiferencia}` : conteoDiferencia} {seleccionadoConteoProducto?.unit} ({conteoDiferenciaPorcentaje.toFixed(1)}%)
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={estilos.conteoDiferenciaEtiqueta}>Impacto Valorizado:</Text>
              <Text style={[estilos.conteoDiferenciaValor, conteoDiferencia !== 0 && { color: tema.colors.danger }]}>
                {formatearCLP(conteoDiferenciaValor)}
              </Text>
            </View>
          </View>

          <View style={estilos.conteoReglaInsigniaCaja}>
            {conteoRequiresApproval ? (
              <Insignia
                label="Pendiente"
                tone="warn"
                size="md"
              />
            ) : (
              <Insignia
                label="Directo"
                tone="ok"
                size="md"
              />
            )}
          </View>
        </Tarjeta>

        <CampoTexto
          label="Observaciones de Auditoría (opcional):"
          value={conteoNotas}
          onChangeText={establecerConteoNotas}
          placeholder="Ej: Conteo físico en gaveta A-02. Faltante encontrado."
        />

        {Boolean(conteoError) && <Text style={estilos.errorTexto}>{conteoError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerConteoModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Guardar Conteo"
            variant="primary"
            onPress={manejarRegisterConteo}
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

      {/* MODAL 9: ESCÁNER QR Y CÓDIGO DE BARRAS REUTILIZABLE */}
      <ModalEscanerQr
        visible={escanerVisible}
        onClose={() => establecerEscanerVisible(false)}
        title={escanerTitulo}
        onScanResult={(code: any) => {
          if (escanerCallback) escanerCallback(code);
        }}
      />

      {/* MODAL 10: CARDEX DE MOVIMIENTOS POR INSUMO (CON RESPONSABLE "¿QUIÉN LO HIZO?") */}
      <VistaModal
        visible={Boolean(productoCardexSeleccionado)}
        onClose={() => establecerProductoCardexSeleccionado && establecerProductoCardexSeleccionado(null)}
        title={productoCardexSeleccionado ? `Cardex: ${productoCardexSeleccionado.sku}` : "Cardex"}
        subtitle={productoCardexSeleccionado?.name || ""}
      >
        {productoCardexSeleccionado && (
          <View style={estilos.modalCardexContenido}>
            {/* Cabecera Resumen Insumo */}
            <View style={estilos.modalCardexCabecera}>
              <View style={estilos.modalCardexCol}>
                <Text style={estilos.modalCardexEtiqueta}>Stock Físico</Text>
                <Text style={estilos.modalCardexValor}>
                  {productoCardexSeleccionado.stock} {productoCardexSeleccionado.unit}
                </Text>
              </View>
              <View style={estilos.modalCardexCol}>
                <Text style={estilos.modalCardexEtiqueta}>PMP Unitario</Text>
                <Text style={[estilos.modalCardexValor, { color: tema.colors.primaryDark }]}>
                  {formatearCLP(productoCardexSeleccionado.pmp || productoCardexSeleccionado.unitCost)}
                </Text>
              </View>
              <View style={estilos.modalCardexCol}>
                <Text style={estilos.modalCardexEtiqueta}>Ubicación</Text>
                <Text style={estilos.modalCardexValor}>{productoCardexSeleccionado.location || "Central"}</Text>
              </View>
            </View>

            {/* Listado de Movimientos del Insumo */}
            <Text style={estilos.modalCardexSubtitulo}>
              Historial de Movimientos y Responsables:
            </Text>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              {cardex.filter((m: MovimientoCardex) => m.sku === productoCardexSeleccionado.sku).length === 0 ? (
                <EstadoVacio
                  icon="swap-horizontal-outline"
                  title="Sin movimientos previos"
                  description={`No se han registrado movimientos en Cardex para ${productoCardexSeleccionado.sku}.`}
                  containerStyle={{ marginVertical: 16, borderWidth: 0 }}
                />
              ) : (
                cardex
                  .filter((m: MovimientoCardex) => m.sku === productoCardexSeleccionado.sku)
                  .map((item: MovimientoCardex) => {
                    const esEntrada = item.qtyIn > 0;
                    return (
                      <View key={item.id} style={estilos.modalCardexItem}>
                        {/* Cabecera del Movimiento */}
                        <View style={estilos.modalCardexItemSuperior}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={estilos.modalCardexFecha}>{formatearFecha(item.date)}</Text>
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
                              {esEntrada ? `+${item.qtyIn}` : `-${item.qtyOut}`} {productoCardexSeleccionado.unit}
                            </Text>
                          </View>
                          <View style={estilos.modalCardexCifraCol}>
                            <Text style={estilos.modalCardexCifraLbl}>Saldo Resultante</Text>
                            <Text style={[estilos.modalCardexCifraVal, { fontWeight: "bold" }]}>
                              {item.balance} {productoCardexSeleccionado.unit}
                            </Text>
                          </View>
                          <View style={estilos.modalCardexCifraCol}>
                            <Text style={estilos.modalCardexCifraLbl}>PMP Movimiento</Text>
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
        )}
      </VistaModal>
    </>
  );
};
