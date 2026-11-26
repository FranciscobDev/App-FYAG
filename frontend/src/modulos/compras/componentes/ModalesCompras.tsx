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

  const opcionesProveedores: OpcionSelectorBuscable<string>[] = proveedores
    .filter((s: any) => !s.disabled)
    .map((s: any) => ({
      label: s.tradeName || s.businessName,
      value: String(s.id),
      hint: `RUT: ${s.rut || "Sin RUT"}${s.category ? ` • ${s.category}` : ""}`,
      badge: s.ratingAvg ? `★ ${Number(s.ratingAvg).toFixed(1)}` : undefined,
      icon: "business-outline",
    }));

  const opcionesProductos: OpcionSelectorBuscable<string>[] = productos
    .filter((p: any) => !p.disabled)
    .map((p: any) => ({
      label: `${p.sku} • ${p.name}`,
      value: String(p.sku),
      hint: `Stock: ${p.stock} ${p.unit} (Mín: ${p.minStock ?? 0}) • Costo ref: ${formatearCLP(p.unitCost)}`,
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

      {/* MODAL 1: FORMULARIO DE ORDEN DE COMPRA (DISEÑO INDUSTRIAL HOMOLOGADO CON FACTURAS) */}
      <VistaModal
        visible={poModal}
        onClose={() => establecerPoModal(false)}
        title={editandoPo ? `Editar Orden: ${editandoPo.code}` : "Nueva Orden de Compra"}
        subtitle={
          esSoloLectura
            ? "Modo solo lectura (la orden ya fue aprobada y enviada)"
            : "Emisión a proveedor homologado, cálculo automático de Neto, IVA (19%) y proyección de stock"
        }
        maxWidth={640}
      >
        {esSoloLectura && (
          <View style={[estilos.ocSoloLecturaAviso, { marginBottom: 12 }]}>
            <Ionicons name="lock-closed-outline" size={16} color={tema.colors.warnDark} />
            <Text style={estilos.ocSoloLecturaTexto}>
              La orden {editandoPo?.code} ya salió de estado Borrador y no admite modificaciones.
            </Text>
          </View>
        )}

        {/* SECCIÓN 1: DATOS DEL PROVEEDOR Y CONDICIONES DE ENTREGA */}
        <View
          style={{
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: tema.colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Ionicons name="business-outline" size={16} color={tema.colors.primaryDark} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: tema.colors.text,
                textTransform: "uppercase",
              }}
            >
              1. Proveedor y Plazo de Entrega
            </Text>
          </View>

          <SelectorBuscable<string>
            label="Proveedor Homologado"
            required
            options={opcionesProveedores}
            value={String(seleccionadoProveedorId || "")}
            onChange={(nuevoId) => !esSoloLectura && establecerSeleccionadoProveedorId(nuevoId)}
            placeholder="Seleccionar proveedor..."
            searchPlaceholder="Buscar proveedor por nombre, RUT o rubro..."
            disabled={esSoloLectura}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <CampoTexto
                label="Fecha Estimada de Entrega"
                required
                value={poEsperadoFecha}
                onChangeText={establecerPoEsperadoFecha}
                placeholder="YYYY-MM-DD"
                disabled={esSoloLectura}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>

            <View style={{ flex: 1.2, minWidth: 190 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: tema.colors.textSecondary,
                  marginBottom: 5,
                }}
              >
                Origen de la Orden
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={esSoloLectura}
                onPress={() => !esSoloLectura && establecerPoEsAutomaticoMinimo(!poEsAutomaticoMinimo)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 42,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  backgroundColor: poEsAutomaticoMinimo ? "#fffbeb" : "#ffffff",
                  borderColor: poEsAutomaticoMinimo ? "#f59e0b" : tema.colors.borderDark,
                  opacity: esSoloLectura ? 0.7 : 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons
                    name={poEsAutomaticoMinimo ? "flash" : "create-outline"}
                    size={16}
                    color={poEsAutomaticoMinimo ? "#b45309" : tema.colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: poEsAutomaticoMinimo ? "#92400e" : tema.colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {poEsAutomaticoMinimo ? "Automática (Stock Mín.)" : "Emisión Manual"}
                  </Text>
                </View>
                <Ionicons
                  name={poEsAutomaticoMinimo ? "checkbox" : "square-outline"}
                  size={18}
                  color={poEsAutomaticoMinimo ? tema.colors.primary : tema.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SECCIÓN 2: LÍNEAS DE COMPRA E INSUMOS */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="cube-outline" size={16} color={tema.colors.primaryDark} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: tema.colors.text,
                textTransform: "uppercase",
              }}
            >
              2. Ítems Solicitados ({poElementos.length})
            </Text>
          </View>

          {!esSoloLectura && (
            <Boton
              title="Agregar Ítem"
              variant="outline"
              size="sm"
              icon="add-outline"
              onPress={manejarAgregarLinea}
              style={{ minHeight: 32, paddingHorizontal: 10 }}
            />
          )}
        </View>

        {poElementos.map((item, idx) => {
          const prod = productos.find((p: any) => p.sku === item.sku);
          const opcionesDisponibles = opcionesProductos.filter(
            (op) => op.value === item.sku || !poElementos.some((el) => el.sku === op.value)
          );
          const totalLinea = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
          const stockActual = Number(prod?.stock ?? 0);
          const stockMinimo = Number(prod?.minStock ?? 0);
          const bajoMinimo = prod && stockActual <= stockMinimo;
          const stockProyectado = stockActual + (Number(item.quantity) || 0);

          return (
            <View
              key={`${item.sku}_${idx}`}
              style={{
                backgroundColor: "#f8fafc",
                borderWidth: 1,
                borderColor: tema.colors.borderDark,
                borderLeftWidth: 4,
                borderLeftColor: bajoMinimo ? "#d97706" : tema.colors.primary,
                borderRadius: 10,
                padding: 10,
                marginBottom: 10,
              }}
            >
              {/* Fila Superior: N° Ítem + Selector Buscable de Insumo + Eliminar */}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                <View
                  style={{
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: tema.colors.primaryDark }}>
                    #{idx + 1}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <SelectorBuscable<string>
                    label={`Insumo / Material Línea #${idx + 1}`}
                    options={opcionesDisponibles}
                    value={item.sku}
                    onChange={(nuevoSku) => manejarCambiarProductoLinea(idx, nuevoSku)}
                    placeholder="Seleccionar insumo del catálogo..."
                    searchPlaceholder="Buscar por nombre o SKU..."
                    disabled={esSoloLectura}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>

                {!esSoloLectura && poElementos.length > 1 && (
                  <Pressable
                    onPress={() => manejarEliminarLinea(idx)}
                    hitSlop={8}
                    accessibilityLabel={`Eliminar línea ${idx + 1}`}
                    style={{
                      width: 38,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: "#fef2f2",
                      borderWidth: 1,
                      borderColor: "#fca5a5",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={tema.colors.danger} />
                  </Pressable>
                )}
              </View>

              {/* Fila de Cantidad y Precio Unitario Neto */}
              <View style={[estilos.descuentoFila, { marginBottom: 6 }]}>
                <View style={estilos.discColumna}>
                  <Text style={estilos.discEtiqueta}>
                    Cantidad ({prod ? prod.unit : "un"})
                  </Text>
                  <TextInput
                    value={item.quantity === 0 ? "" : String(item.quantity)}
                    onChangeText={(v) => manejarActualizarNumeroLinea(idx, "quantity", v)}
                    keyboardType="numeric"
                    editable={!esSoloLectura}
                    style={[estilos.discEntrada, { height: 36, backgroundColor: "#ffffff" }]}
                    placeholder="0"
                  />
                </View>

                <View style={[estilos.discColumna, { marginRight: 0 }]}>
                  <Text style={estilos.discEtiqueta}>Precio Unitario Neto ($ CLP)</Text>
                  <TextInput
                    value={item.unitPrice === 0 ? "" : String(item.unitPrice)}
                    onChangeText={(v) => manejarActualizarNumeroLinea(idx, "unitPrice", v)}
                    keyboardType="numeric"
                    editable={!esSoloLectura}
                    style={[estilos.discEntrada, { height: 36, backgroundColor: "#ffffff" }]}
                    placeholder="0"
                  />
                </View>
              </View>

              {/* Barra compacta de Stock actual/proyectado y Subtotal de Línea */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: bajoMinimo ? "#fcd34d" : tema.colors.primaryBorder,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginTop: 2,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons
                    name={bajoMinimo ? "alert-circle" : "layers-outline"}
                    size={13}
                    color={bajoMinimo ? "#d97706" : tema.colors.primaryDark}
                  />
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                    Stock bodega:{" "}
                    <Text
                      style={{
                        fontWeight: "800",
                        color: bajoMinimo ? "#b45309" : tema.colors.text,
                      }}
                    >
                      {stockActual} {prod?.unit || "un"}
                    </Text>{" "}
                    → Tras recibir:{" "}
                    <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                      {stockProyectado} {prod?.unit || "un"}
                    </Text>
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "900", color: tema.colors.primaryDark }}>
                  Subtotal: {formatearCLP(totalLinea)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* OBSERVACIONES DE DESPACHO */}
        <CampoTexto
          label="Observaciones o Condiciones de Despacho"
          value={poNotas}
          onChangeText={establecerPoNotas}
          placeholder="Ej: Entregar en bodega central antes de las 16:00 hrs."
          disabled={esSoloLectura}
          containerStyle={{ marginTop: 2, marginBottom: 8 }}
        />

        {/* RESUMEN FINANCIERO EN VIVO COMPACTO (TICKET CONTABLE) */}
        <View style={[estilos.financialResumenTarjeta, { padding: 12, marginTop: 2 }]}>
          <View style={estilos.resumenLinea}>
            <Text style={estilos.resumenEtiqueta}>
              Subtotal Neto ({poElementos.length} {poElementos.length === 1 ? "ítem" : "ítems"}):
            </Text>
            <Text style={estilos.resumenValor}>{formatearCLP(subtotalOrden)}</Text>
          </View>
          <View style={estilos.resumenLinea}>
            <Text style={estilos.resumenEtiqueta}>IVA (19%):</Text>
            <Text style={estilos.resumenValor}>{formatearCLP(ivaOrden)}</Text>
          </View>
          <View style={[estilos.resumenLinea, estilos.resumenTotalLinea]}>
            <Text style={estilos.totalEtiquetaBig}>Total Orden c/ IVA:</Text>
            <Text style={estilos.totalValorBig}>{formatearCLP(totalOrden)}</Text>
          </View>
        </View>

        {Boolean(poError) && <Text style={estilos.errorTexto}>{poError}</Text>}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 12,
          }}
        >
          {esSoloLectura ? (
            <Boton
              title="Cerrar"
              variant="outline"
              size="sm"
              onPress={() => establecerPoModal(false)}
              style={{ minHeight: 40, minWidth: 120 }}
            />
          ) : (
            <>
              <Boton
                title={editandoPo ? "Guardar Borrador" : "Guardar Borrador"}
                variant="outline"
                size="sm"
                icon="save-outline"
                onPress={() => manejarGuardarCompraOrden(true)}
                style={{ minHeight: 40, flex: 1 }}
              />
              <Boton
                title="Aprobar y Enviar OC"
                variant="primary"
                size="sm"
                icon="paper-plane-outline"
                onPress={() => manejarGuardarCompraOrden(false)}
                style={{ minHeight: 40, flex: 1.4 }}
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

      {/* MODAL 3: CALIFICACIÓN DEL PROVEEDOR CON ESTRELLAS AL CERRAR OC (H15) */}
      <VistaModal
        visible={Boolean(tarifaModalOrden)}
        onClose={() => establecerTarifaModalOrden(null)}
        title="Calificar Proveedor y Cerrar OC"
        subtitle={tarifaModalOrden ? `${tarifaModalOrden.supplier} • ${tarifaModalOrden.code}` : ""}
        maxWidth={420}
        containerStyle={{ width: "90%", alignSelf: "center" }}
      >
        {/* Banner Informativo H15 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f0fdf4",
            borderWidth: 1,
            borderColor: "#86efac",
            borderLeftWidth: 5,
            borderLeftColor: "#16a34a",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
            gap: 8,
          }}
        >
          <Ionicons name="information-circle" size={20} color="#16a34a" />
          <Text style={{ flex: 1, flexShrink: 1, fontSize: 12, color: "#166534", lineHeight: 16 }}>
            Evalúe el desempeño del proveedor para cerrar definitivamente la Orden de Compra. El promedio obtenido actualizará el ranking del proveedor en el directorio comercial.
          </Text>
        </View>

        {/* 1. Cumplimiento de Plazo y Tiempos */}
        <CalificacionEstrellas
          label="1. Cumplimiento de Plazo y Tiempos de Entrega:"
          rating={calificacionTiempo}
          onChangeRating={establecerCalificacionTiempo}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* 2. Calidad de Materiales y Embalaje */}
        <CalificacionEstrellas
          label="2. Calidad de Materiales y Embalaje:"
          rating={calificacionQuality}
          onChangeRating={establecerCalificacionQuality}
          size="md"
          containerStyle={{ marginBottom: 12 }}
        />

        {/* 3. Condiciones de Precio y Facturación */}
        <CalificacionEstrellas
          label="3. Condiciones de Precio y Facturación:"
          rating={calificacionPrecio}
          onChangeRating={establecerCalificacionPrecio}
          size="md"
          containerStyle={{ marginBottom: 14 }}
        />

        {/* Promedio calculado en vivo con visualización de estrellas */}
        {(() => {
          const liveAvg = Number(((calificacionTiempo + calificacionQuality + calificacionPrecio) / 3).toFixed(1));
          const etiquetaRendimiento =
            liveAvg >= 4.5 ? "Excelente Desempeño" : liveAvg >= 3.8 ? "Buen Desempeño" : liveAvg >= 3.0 ? "Aceptable" : "Bajo Rendimiento";
          return (
            <Tarjeta
              variant="outlined"
              style={{
                backgroundColor: "#fffbeb",
                borderColor: "#fcd34d",
                borderWidth: 1.5,
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>
                  Promedio Calculado en Vivo [H15]:
                </Text>
                <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#fde68a" }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#b45309" }}>
                    {etiquetaRendimiento}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= Math.round(liveAvg) ? "star" : "star-outline"}
                      size={20}
                      color={star <= Math.round(liveAvg) ? "#f59e0b" : "#cbd5e1"}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#b45309" }}>
                  ⭐ {liveAvg.toFixed(1)} <Text style={{ fontSize: 12, fontWeight: "600", color: "#92400e" }}>/ 5.0</Text>
                </Text>
              </View>
            </Tarjeta>
          );
        })()}

        <CampoTexto
          label="Comentario sobre el despacho / proveedor (opcional)"
          value={calificacionComentario}
          onChangeText={establecerCalificacionComentario}
          placeholder="Ej: Entrega puntual y embalaje en perfecto estado."
          containerStyle={{ marginBottom: 16 }}
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerTarifaModalOrden(null)}
            style={{ marginRight: 8, minHeight: 44, flex: 1 }}
          />
          <Boton
            title="Confirmar y Cerrar OC"
            variant="success"
            icon="checkmark-circle-outline"
            onPress={manejarGuardarCalificacion}
            style={{ minHeight: 44, flex: 1.5, backgroundColor: "#15803d" }}
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
        title={scanningTargetSku ? `Escanear Insumo SKU: ${scanningTargetSku}` : "Escanear Insumo de la Orden de Compra"}
        subtitle="Reconoce etiquetas QR o códigos de barras y autocompleta el SKU automáticamente"
      />
    </>
  );
};
