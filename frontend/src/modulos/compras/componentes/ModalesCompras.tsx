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
  SelectorBuscable,
  OpcionSelectorBuscable,
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
import { descargarPdfOrdenCompra } from "../ordenCompraPdf";

export interface LineaFormularioOrdenCompra {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface PropiedadesModalesCompras {
  aprobarYEnviarOrden: (orderId: string) => void;
  bancoNombre: any;
  calificacionComentario: any;
  calificacionPrecio: any;
  calificacionQuality: any;
  calificacionTiempo: any;
  cuentaNumero: any;
  cuentaTipo: any;
  editandoPo: OrdenCompra | null;
  escanerAbrir: any;
  establecerBancoNombre: any;
  establecerCalificacionComentario: any;
  establecerCalificacionPrecio: any;
  establecerCalificacionQuality: any;
  establecerCalificacionTiempo: any;
  establecerCuentaNumero: any;
  establecerCuentaTipo: any;
  establecerEscanerAbrir: any;
  establecerPartyCategoria: any;
  establecerPartyContacto: any;
  establecerPartyCorreo: any;
  establecerPartyDireccion: any;
  establecerPartyModal: any;
  establecerPartyNombre: any;
  establecerPartyRut: any;
  establecerPartyTelefono: any;
  establecerPartyTradeNombre: any;
  establecerPdfVistaPreviaOrden: React.Dispatch<React.SetStateAction<OrdenCompra | null>>;
  establecerPoElementos: React.Dispatch<React.SetStateAction<LineaFormularioOrdenCompra[]>>;
  establecerPoEsAutomaticoMinimo: React.Dispatch<React.SetStateAction<boolean>>;
  establecerPoEsperadoFecha: React.Dispatch<React.SetStateAction<string>>;
  establecerPoModal: React.Dispatch<React.SetStateAction<boolean>>;
  establecerPoNotas: React.Dispatch<React.SetStateAction<string>>;
  establecerSeleccionadoProveedorId: any;
  establecerTarifaModalOrden: any;
  manejarEscanearCodigo: any;
  manejarGuardarCalificacion: any;
  manejarGuardarCompraOrden: (asDraft?: boolean) => void;
  manejarGuardarParty: any;
  mostrarAviso: (mensaje: string) => void;
  partyCategoria: any;
  partyContacto: any;
  partyCorreo: any;
  partyDireccion: any;
  partyError: any;
  partyModal: any;
  partyNombre: any;
  partyRut: any;
  partyTelefono: any;
  partyTradeNombre: any;
  pdfVistaPreviaOrden: OrdenCompra | null;
  poElementos: LineaFormularioOrdenCompra[];
  poError: string;
  poEsAutomaticoMinimo: boolean;
  poEsperadoFecha: string;
  poModal: boolean;
  poNotas: string;
  productos: any[];
  proveedores: any[];
  scanningTargetSku: any;
  sugerenciaSkusRecepcion?: string[];
  seleccionadoProveedorId: string;
  tarifaModalOrden: any;
  thirdPartyPestana: any;
  width: any;
}

export const ModalesCompras: React.FC<PropiedadesModalesCompras> = ({
  aprobarYEnviarOrden,
  bancoNombre,
  calificacionComentario,
  calificacionPrecio,
  calificacionQuality,
  calificacionTiempo,
  cuentaNumero,
  cuentaTipo,
  editandoPo,
  escanerAbrir,
  establecerBancoNombre,
  establecerCalificacionComentario,
  establecerCalificacionPrecio,
  establecerCalificacionQuality,
  establecerCalificacionTiempo,
  establecerCuentaNumero,
  establecerCuentaTipo,
  establecerEscanerAbrir,
  establecerPartyCategoria,
  establecerPartyContacto,
  establecerPartyCorreo,
  establecerPartyDireccion,
  establecerPartyModal,
  establecerPartyNombre,
  establecerPartyRut,
  establecerPartyTelefono,
  establecerPartyTradeNombre,
  establecerPdfVistaPreviaOrden,
  establecerPoElementos,
  establecerPoEsAutomaticoMinimo,
  establecerPoEsperadoFecha,
  establecerPoModal,
  establecerPoNotas,
  establecerSeleccionadoProveedorId,
  establecerTarifaModalOrden,
  manejarEscanearCodigo,
  manejarGuardarCalificacion,
  manejarGuardarCompraOrden,
  manejarGuardarParty,
  mostrarAviso,
  partyCategoria,
  partyContacto,
  partyCorreo,
  partyDireccion,
  partyError,
  partyModal,
  partyNombre,
  partyRut,
  partyTelefono,
  partyTradeNombre,
  pdfVistaPreviaOrden,
  poElementos,
  poError,
  poEsAutomaticoMinimo,
  poEsperadoFecha,
  poModal,
  poNotas,
  productos,
  proveedores,
  scanningTargetSku,
  sugerenciaSkusRecepcion,
  seleccionadoProveedorId,
  tarifaModalOrden,
  thirdPartyPestana,
  width,
}) => {
  const { rolActual } = usarAutenticacion();
  const [descargandoPdf, establecerDescargandoPdf] = useState(false);

  // Solo las órdenes nuevas o en estado Borrador admiten edición
  const esSoloLectura = Boolean(editandoPo && editandoPo.status !== "borrador");

  // Cálculo financiero en vivo de las líneas ingresadas en el formulario
  const subtotalOrden = poElementos.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );
  const ivaOrden = Math.round(subtotalOrden * 0.19);
  const totalOrden = subtotalOrden + ivaOrden;

  const opcionesProductos: OpcionSelectorBuscable<string>[] = productos.map((p: any) => ({
    label: p.name,
    value: p.sku,
    hint: `SKU: ${p.sku} • Stock: ${p.stock} ${p.unit} • Ref: ${formatearCLP(p.unitCost)}`,
    badge: p.unit,
    icon: "cube-outline",
  }));

  const manejarCambiarProductoLinea = (indice: number, nuevoSku: string) => {
    const productoElegido = productos.find((p: any) => p.sku === nuevoSku);
    establecerPoElementos((prev) =>
      prev.map((it, i) =>
        i === indice
          ? {
              ...it,
              sku: nuevoSku,
              unitPrice: productoElegido ? productoElegido.unitCost : it.unitPrice,
            }
          : it
      )
    );
  };

  const manejarActualizarNumeroLinea = (
    indice: number,
    campo: "quantity" | "unitPrice",
    texto: string
  ) => {
    const limpio = texto.replace(/[^0-9]/g, "");
    const valor = limpio === "" ? 0 : Number(limpio);
    establecerPoElementos((prev) =>
      prev.map((it, i) => (i === indice ? { ...it, [campo]: valor } : it))
    );
  };

  const manejarEliminarLinea = (indice: number) => {
    establecerPoElementos((prev) => prev.filter((_, i) => i !== indice));
  };

  const manejarAgregarLinea = () => {
    const siguienteProducto = productos.find(
      (p: any) => !poElementos.some((i) => i.sku === p.sku)
    );
    if (!siguienteProducto) {
      mostrarAviso("Todos los insumos del catálogo ya están incluidos en esta orden.");
      return;
    }
    establecerPoElementos((prev) => [
      ...prev,
      { sku: siguienteProducto.sku, quantity: 10, unitPrice: siguienteProducto.unitCost },
    ]);
  };

  const manejarDescargarPdf = async () => {
    if (!pdfVistaPreviaOrden || descargandoPdf) return;
    establecerDescargandoPdf(true);
    try {
      const resultado = await descargarPdfOrdenCompra(pdfVistaPreviaOrden);
      mostrarAviso(resultado.mensaje);
    } finally {
      establecerDescargandoPdf(false);
    }
  };

  return (
    <>
      {/* =====================================================================
          MODALES DE APOYO
          ===================================================================== */}

      {/* MODAL 1: FORMULARIO DE ORDEN DE COMPRA (SOLO EDITABLE EN BORRADOR) */}
      <VistaModal
        visible={poModal}
        onClose={() => establecerPoModal(false)}
        title={editandoPo ? `Editar Orden: ${editandoPo.code}` : "Nueva Orden de Compra"}
        subtitle={esSoloLectura ? "Solo lectura (ya aprobada)" : "Editable solo en estado Borrador"}
      >
        {esSoloLectura && (
          <View style={estilos.ocSoloLecturaAviso}>
            <Ionicons name="lock-closed-outline" size={16} color={tema.colors.warnDark} />
            <Text style={estilos.ocSoloLecturaTexto}>
              La orden {editandoPo?.code} ya salió de Borrador y no admite modificaciones.
            </Text>
          </View>
        )}

        {/* 1. PROVEEDOR Y PLAZOS */}
        <Text style={estilos.formularioSeccionEncabezado}>1. Proveedor y Plazo de Entrega</Text>
        <Text style={estilos.campoEtiqueta}>Proveedor:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {proveedores
            .filter((s: any) => !s.disabled)
            .map((s: any) => (
              <TouchableOpacity
                key={s.id}
                disabled={esSoloLectura}
                onPress={() => !esSoloLectura && establecerSeleccionadoProveedorId(s.id)}
                style={[
                  estilos.chipBoton,
                  seleccionadoProveedorId === s.id && estilos.chipBotonActivo,
                  esSoloLectura && { opacity: 0.7 },
                ]}
              >
                <Text style={[estilos.chipTexto, seleccionadoProveedorId === s.id && estilos.chipTextoActivo]}>
                  {s.businessName}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <TouchableOpacity
          disabled={esSoloLectura}
          onPress={() => !esSoloLectura && establecerPoEsAutomaticoMinimo(!poEsAutomaticoMinimo)}
          style={[estilos.checkboxFila, esSoloLectura && { opacity: 0.7 }]}
        >
          <Ionicons
            name={poEsAutomaticoMinimo ? "checkbox" : "square-outline"}
            size={20}
            color={tema.colors.primary}
          />
          <Text style={estilos.checkboxTexto}>
            Marcar como generada automáticamente por stock mínimo
          </Text>
        </TouchableOpacity>

        <CampoTexto
          label="Fecha Estimada de Entrega Requerida"
          value={poEsperadoFecha}
          onChangeText={establecerPoEsperadoFecha}
          placeholder="YYYY-MM-DD"
          disabled={esSoloLectura}
        />

        {/* 2. ÍTEMS REQUERIDOS */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Líneas de Compra e Insumos</Text>
        {poElementos.map((item, idx) => {
          const prod = productos.find((p: any) => p.sku === item.sku);
          const opcionesDisponibles = opcionesProductos.filter(
            (op) => op.value === item.sku || !poElementos.some((el) => el.sku === op.value)
          );
          const totalLinea = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

          return (
            <View key={`${item.sku}_${idx}`} style={estilos.ocLineaTarjeta}>
              <View style={estilos.ocLineaEncabezado}>
                <Text style={estilos.ocLineaTitulo}>Línea #{idx + 1}</Text>
                <View style={estilos.ocLineaAccionesDerecha}>
                  <Text style={estilos.ocLineaTotalTexto}>{formatearCLP(totalLinea)}</Text>
                  {!esSoloLectura && (
                    <TouchableOpacity
                      onPress={() => manejarEliminarLinea(idx)}
                      style={estilos.ocLineaEliminarBoton}
                      accessibilityLabel={`Eliminar línea ${idx + 1}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={tema.colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <SelectorBuscable<string>
                label="Insumo / Material"
                options={opcionesDisponibles}
                value={item.sku}
                onChange={(nuevoSku) => manejarCambiarProductoLinea(idx, nuevoSku)}
                placeholder="Seleccionar insumo..."
                searchPlaceholder="Buscar por nombre o SKU..."
                disabled={esSoloLectura}
              />

              <View style={estilos.ocLineaMontosFila}>
                <View style={estilos.ocLineaCampoCol}>
                  <Text style={estilos.ocLineaMiniEtiqueta}>
                    Cantidad ({prod ? prod.unit : "un"})
                  </Text>
                  <TextInput
                    value={item.quantity === 0 ? "" : String(item.quantity)}
                    onChangeText={(v) => manejarActualizarNumeroLinea(idx, "quantity", v)}
                    keyboardType="numeric"
                    editable={!esSoloLectura}
                    style={[estilos.poNumeroEntrada, { width: "100%" }]}
                    placeholder="Cant."
                  />
                </View>

                <View style={estilos.ocLineaCampoCol}>
                  <Text style={estilos.ocLineaMiniEtiqueta}>Precio Unitario Neto (CLP)</Text>
                  <TextInput
                    value={item.unitPrice === 0 ? "" : String(item.unitPrice)}
                    onChangeText={(v) => manejarActualizarNumeroLinea(idx, "unitPrice", v)}
                    keyboardType="numeric"
                    editable={!esSoloLectura}
                    style={[estilos.poNumeroEntrada, { width: "100%" }]}
                    placeholder="Precio neto"
                  />
                </View>
              </View>
            </View>
          );
        })}

        {!esSoloLectura && (
          <Boton
            title="+ Agregar Línea de Compra"
            variant="outline"
            size="sm"
            onPress={manejarAgregarLinea}
            style={{ marginVertical: 8 }}
          />
        )}

        <CampoTexto
          label="Observaciones o condiciones de despacho"
          value={poNotas}
          onChangeText={establecerPoNotas}
          placeholder="Ej: Entregar en bodega central antes de las 16:00"
          disabled={esSoloLectura}
        />

        {/* Resumen financiero en tiempo real */}
        <View style={estilos.ocResumenVivoCaja}>
          <View style={estilos.ocResumenFila}>
            <Text style={estilos.ocResumenEtiqueta}>Subtotal Neto ({poElementos.length} líneas)</Text>
            <Text style={estilos.ocResumenValor}>{formatearCLP(subtotalOrden)}</Text>
          </View>
          <View style={estilos.ocResumenFila}>
            <Text style={estilos.ocResumenEtiqueta}>IVA (19%)</Text>
            <Text style={estilos.ocResumenValor}>{formatearCLP(ivaOrden)}</Text>
          </View>
          <View style={estilos.ocResumenTotalFila}>
            <Text style={estilos.ocResumenTotalEtiqueta}>Total c/ IVA</Text>
            <Text style={estilos.ocResumenTotalValor}>{formatearCLP(totalOrden)}</Text>
          </View>
        </View>

        {Boolean(poError) && <Text style={estilos.errorTexto}>{poError}</Text>}

        <View style={estilos.modalBotonesFila}>
          {esSoloLectura ? (
            <Boton
              title="Cerrar"
              variant="secondary"
              onPress={() => establecerPoModal(false)}
            />
          ) : (
            <>
              <Boton
                title={editandoPo ? "Guardar Cambios (Borrador)" : "Guardar Borrador"}
                variant="secondary"
                onPress={() => manejarGuardarCompraOrden(true)}
                style={{ marginRight: 8 }}
              />
              <Boton
                title="Aprobar y Enviar"
                variant="primary"
                icon="paper-plane-outline"
                onPress={() => manejarGuardarCompraOrden(false)}
              />
            </>
          )}
        </View>
      </VistaModal>

      {/* MODAL 2: VISTA PREVIA OFICIAL DEL PDF DE LA OC */}
      <VistaModal
        visible={Boolean(pdfVistaPreviaOrden)}
        onClose={() => establecerPdfVistaPreviaOrden(null)}
        title="Vista Previa de Orden de Compra (PDF Oficial)"
        subtitle={pdfVistaPreviaOrden ? `${pdfVistaPreviaOrden.code} • ${pdfVistaPreviaOrden.supplier}` : ""}
      >
        {pdfVistaPreviaOrden && (
          <View style={estilos.pdfPaginaContenedor}>
            {/* Encabezado Formal Empresa */}
            <View style={estilos.pdfEncabezado}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.pdfCompanyNombre}>FYAG MULTISYSTEM SpA</Text>
                <Text style={estilos.pdfCompanyMeta}>RUT: 76.982.341-K • Giro: Obras e Instalaciones</Text>
                <Text style={estilos.pdfCompanyMeta}>Av. El Salto 4001, Huechuraba, Santiago</Text>
                <Text style={estilos.pdfCompanyMeta}>Fono: +56 2 2890 4100 • compras@fyag.cl</Text>
              </View>
              <View style={estilos.pdfDocCaja}>
                <Text style={estilos.pdfDocTitulo}>ORDEN DE COMPRA</Text>
                <Text style={estilos.pdfDocNumero}>{pdfVistaPreviaOrden.code}</Text>
                <Insignia
                  label={pdfVistaPreviaOrden.status.toUpperCase()}
                  tone={
                    pdfVistaPreviaOrden.status === "recibida" || pdfVistaPreviaOrden.status === "cerrada"
                      ? "ok"
                      : pdfVistaPreviaOrden.status === "borrador"
                      ? "warn"
                      : "info"
                  }
                  size="sm"
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>

            {/* Recuadro Datos Proveedor */}
            <View style={estilos.pdfSeccionCaja}>
              <Text style={estilos.pdfSeccionCajaTitulo}>DATOS DEL PROVEEDOR:</Text>
              <Text style={estilos.pdfSeccionTexto}>Razón Social: <Text style={{ fontWeight: "bold" }}>{pdfVistaPreviaOrden.supplier}</Text></Text>
              <Text style={estilos.pdfSeccionTexto}>RUT: {pdfVistaPreviaOrden.supplierRut || "76.xxx.xxx-x"}</Text>
              <Text style={estilos.pdfSeccionTexto}>Fecha Emisión: {formatearFecha(pdfVistaPreviaOrden.date)} • Fecha Entrega: {formatearFecha(pdfVistaPreviaOrden.expectedDate)}</Text>
            </View>

            {Boolean(pdfVistaPreviaOrden.notes) && (
              <View style={estilos.pdfNotasCaja}>
                <Text style={estilos.pdfSeccionCajaTitulo}>OBSERVACIONES DE DESPACHO:</Text>
                <Text style={estilos.pdfNotasTexto}>{pdfVistaPreviaOrden.notes}</Text>
              </View>
            )}

            {/* Tabla de Ítems */}
            <View style={estilos.pdfTabla}>
              <View style={estilos.pdfTablaFilaHead}>
                <Text style={[estilos.pdfTh, { flex: 2 }]}>Insumo / Descripción</Text>
                <Text style={[estilos.pdfTh, { width: 50, textAlign: "center" }]}>Cant</Text>
                <Text style={[estilos.pdfTh, { width: 40, textAlign: "center" }]}>Un</Text>
                <Text style={[estilos.pdfTh, { width: 75, textAlign: "right" }]}>P. Neto</Text>
                <Text style={[estilos.pdfTh, { width: 85, textAlign: "right" }]}>Total Neto</Text>
              </View>
              {pdfVistaPreviaOrden.items.map((i: any, idx: any) => (
                <View key={idx} style={estilos.pdfTablaFila}>
                  <Text style={[estilos.pdfTd, { flex: 2 }]}>{i.name} ({i.sku})</Text>
                  <Text style={[estilos.pdfTd, { width: 50, textAlign: "center" }]}>{i.quantity}</Text>
                  <Text style={[estilos.pdfTd, { width: 40, textAlign: "center" }]}>{i.unit}</Text>
                  <Text style={[estilos.pdfTd, { width: 75, textAlign: "right" }]}>{formatearCLP(i.unitPrice)}</Text>
                  <Text style={[estilos.pdfTd, { width: 85, textAlign: "right", fontWeight: "bold" }]}>
                    {formatearCLP(i.quantity * i.unitPrice)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totales con IVA */}
            <View style={estilos.pdfTotalsContenedor}>
              <View style={estilos.pdfTotalLinea}>
                <Text style={estilos.pdfTotalLbl}>Subtotal Neto:</Text>
                <Text style={estilos.pdfTotalValor}>{formatearCLP(pdfVistaPreviaOrden.subtotal)}</Text>
              </View>
              <View style={estilos.pdfTotalLinea}>
                <Text style={estilos.pdfTotalLbl}>IVA (19%):</Text>
                <Text style={estilos.pdfTotalValor}>{formatearCLP(pdfVistaPreviaOrden.iva)}</Text>
              </View>
              <View style={[estilos.pdfTotalLinea, estilos.pdfTotalFinalLinea]}>
                <Text style={estilos.pdfTotalFinalLbl}>Total c/ IVA (CLP):</Text>
                <Text style={estilos.pdfTotalFinalValor}>{formatearCLP(pdfVistaPreviaOrden.total)}</Text>
              </View>
            </View>

            {/* Recuadro de Firmas */}
            <View style={estilos.pdfSignaturesFila}>
              <View style={estilos.pdfSignCaja}>
                <View style={estilos.pdfSignLinea} />
                <Text style={estilos.pdfSignTexto}>Autorizado por Administración</Text>
                <Text style={estilos.pdfSignSub}>FYAG Multisystem SpA</Text>
              </View>
              <View style={estilos.pdfSignCaja}>
                <View style={estilos.pdfSignLinea} />
                <Text style={estilos.pdfSignTexto}>Recepción Conforme Bodega</Text>
                <Text style={estilos.pdfSignSub}>Firma, Fecha y RUT</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 8 }]}>
          <Boton
            title="Cerrar Vista Previa"
            variant="ghost"
            onPress={() => establecerPdfVistaPreviaOrden(null)}
          />
          {pdfVistaPreviaOrden?.status === "borrador" && rolActual === "admin" && (
            <Boton
              title="Aprobar y Enviar"
              variant="secondary"
              icon="paper-plane-outline"
              onPress={() => {
                aprobarYEnviarOrden(pdfVistaPreviaOrden.id);
                establecerPdfVistaPreviaOrden((prev) =>
                  prev ? { ...prev, status: "enviada" } : null
                );
                mostrarAviso(
                  `Orden ${pdfVistaPreviaOrden.code} aprobada y enviada al proveedor.`
                );
              }}
            />
          )}
          <Boton
            title="Descargar / Imprimir PDF"
            variant="primary"
            icon="download-outline"
            loading={descargandoPdf}
            disabled={descargandoPdf}
            onPress={manejarDescargarPdf}
          />
        </View>
      </VistaModal>

      {/* MODAL 3: CALIFICACIÓN DEL PROVEEDOR (ESTRELLAS TIEMPO, CALIDAD, PRECIO) */}
      <VistaModal
        visible={Boolean(tarifaModalOrden)}
        onClose={() => establecerTarifaModalOrden(null)}
        title="Calificar Proveedor y Cerrar OC"
        subtitle={tarifaModalOrden ? `${tarifaModalOrden.supplier} • ${tarifaModalOrden.code}` : ""}
      >
        <Text style={estilos.tarifaInstruct}>
          Evalúe el desempeño del proveedor para cerrar definitivamente la Orden de Compra:
        </Text>

        {/* Cumplimiento de Tiempo */}
        <CalificacionEstrellas
          label="1. Cumplimiento de Plazo y Tiempo:"
          rating={calificacionTiempo}
          onChangeRating={establecerCalificacionTiempo}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Calidad de Materiales */}
        <CalificacionEstrellas
          label="2. Calidad de Materiales y Embalaje:"
          rating={calificacionQuality}
          onChangeRating={establecerCalificacionQuality}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Condiciones de Precio */}
        <CalificacionEstrellas
          label="3. Condiciones de Precio y Facturación:"
          rating={calificacionPrecio}
          onChangeRating={establecerCalificacionPrecio}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Promedio calculado en vivo */}
        <Tarjeta variant="outlined" style={estilos.promedioCalificacionTarjeta}>
          <Text style={estilos.promedioCalificacionEtiqueta}>Promedio General:</Text>
          <Text style={estilos.promedioCalificacionScore}>
            ⭐ {((calificacionTiempo + calificacionQuality + calificacionPrecio) / 3).toFixed(1)} / 5.0
          </Text>
        </Tarjeta>

        <CampoTexto
          label="Comentario sobre el despacho (opcional)"
          value={calificacionComentario}
          onChangeText={establecerCalificacionComentario}
          placeholder="Ej: Entrega puntual y embalaje en perfecto estado."
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerTarifaModalOrden(null)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Confirmar Calificación y Cerrar OC"
            variant="success"
            onPress={manejarGuardarCalificacion}
          />
        </View>
      </VistaModal>

      {/* MODAL 4: ALTA DE PROVEEDOR / CLIENTE */}
      <VistaModal
        visible={partyModal}
        onClose={() => establecerPartyModal(false)}
        title={thirdPartyPestana === "proveedores" ? "Nuevo Proveedor" : "Nuevo Cliente"}
        subtitle="Validación de RUT chileno (módulo 11) y detección de duplicados"
      >
        <CampoTexto
          label="RUT Chileno (con guión y dígito verificador)"
          value={partyRut}
          onChangeText={establecerPartyRut}
          placeholder="Ej: 76.543.210-K"
        />
        <CampoTexto
          label="Razón Social"
          value={partyNombre}
          onChangeText={establecerPartyNombre}
          placeholder="Ej: ElectroChile SpA"
        />
        <CampoTexto
          label="Nombre de Fantasía (opcional)"
          value={partyTradeNombre}
          onChangeText={establecerPartyTradeNombre}
          placeholder="Ej: ElectroChile"
        />
        <CampoTexto
          label="Categoría o Giro Comercial"
          value={partyCategoria}
          onChangeText={establecerPartyCategoria}
          placeholder="Ej: Ferretería, Climatización, Inmobiliaria"
        />
        <CampoTexto
          label="Teléfono de Contacto"
          value={partyTelefono}
          onChangeText={establecerPartyTelefono}
          placeholder="+56 9 1234 5678"
        />
        <CampoTexto
          label="Correo Electrónico"
          value={partyCorreo}
          onChangeText={establecerPartyCorreo}
          placeholder="contacto@empresa.cl"
        />
        <CampoTexto
          label="Dirección Comercial"
          value={partyDireccion}
          onChangeText={establecerPartyDireccion}
          placeholder="Av. Providencia 123, Santiago"
        />
        <CampoTexto
          label="Persona de Contacto"
          value={partyContacto}
          onChangeText={establecerPartyContacto}
          placeholder="Ej: Rodrigo Valenzuela"
        />

        {thirdPartyPestana === "proveedores" && (
          <View style={estilos.bancoCamposContenedor}>
            <Text style={estilos.formularioSeccionEtiqueta}>Datos Bancarios de Transferencia:</Text>
            <CampoTexto
              label="Banco"
              value={bancoNombre}
              onChangeText={establecerBancoNombre}
              placeholder="Banco de Chile, Santander, BCI..."
            />
            <Text style={estilos.campoEtiqueta}>Tipo de Cuenta:</Text>
            <View style={estilos.cuentaTipoFila}>
              {(["corriente", "vista", "ahorro"] as const).map((t: any) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => establecerCuentaTipo(t)}
                  style={[
                    estilos.cuentaTipoBoton,
                    cuentaTipo === t && estilos.cuentaTipoBotonActivo,
                  ]}
                >
                  <Text
                    style={[
                      estilos.cuentaTipoTexto,
                      cuentaTipo === t && estilos.cuentaTipoTextoActivo,
                    ]}
                  >
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <CampoTexto
              label="Número de Cuenta"
              value={cuentaNumero}
              onChangeText={establecerCuentaNumero}
              keyboardType="numeric"
              placeholder="00-123456-78"
            />
          </View>
        )}

        {Boolean(partyError) && <Text style={estilos.errorTexto}>{partyError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerPartyModal(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title={`Guardar ${thirdPartyPestana === "proveedores" ? "Proveedor" : "Cliente"}`}
            variant="primary"
            onPress={manejarGuardarParty}
          />
        </View>
      </VistaModal>

      {/* Escáner de Cámara Tablet para Recepción (H33) */}
      <ModalEscanerQr
        visible={escanerAbrir}
        onClose={() => establecerEscanerAbrir(false)}
        onScanResult={() => {}}
        onScanMeta={(meta) => {
          if (meta.valido) {
            manejarEscanearCodigo(meta.sku, meta);
          }
        }}
        productos={productos}
        validarExistencia={true}
        moduloOrigen="recepcion"
        sugerenciaSkus={
          scanningTargetSku
            ? [scanningTargetSku, ...(sugerenciaSkusRecepcion || [])]
            : sugerenciaSkusRecepcion
        }
        title={scanningTargetSku ? `Escanear Insumo SKU: ${scanningTargetSku}` : "Escanear Insumo de la OC (H33)"}
        subtitle="Reconoce etiquetas QR de H47 o códigos de barras en menos de 2 s y autocompleta el SKU"
      />
    </>
  );
};
