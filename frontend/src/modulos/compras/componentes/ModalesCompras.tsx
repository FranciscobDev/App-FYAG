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

export interface PropiedadesModalesCompras {
  bancoNombre: any;
  calificacionComentario: any;
  calificacionPrecio: any;
  calificacionQuality: any;
  calificacionTiempo: any;
  cuentaNumero: any;
  cuentaTipo: any;
  editandoPo: any;
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
  establecerPdfVistaPreviaOrden: any;
  establecerPoElementos: any;
  establecerPoEsAutomaticoMinimo: any;
  establecerPoEsperadoFecha: any;
  establecerPoModal: any;
  establecerPoNotas: any;
  establecerSeleccionadoProveedorId: any;
  establecerTarifaModalOrden: any;
  manejarEscanearCodigo: any;
  manejarGuardarCalificacion: any;
  manejarGuardarCompraOrden: any;
  manejarGuardarParty: any;
  mostrarAviso: any;
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
  pdfVistaPreviaOrden: any;
  poElementos: any;
  poError: any;
  poEsAutomaticoMinimo: any;
  poEsperadoFecha: any;
  poModal: any;
  poNotas: any;
  productos: any;
  proveedores: any;
  scanningTargetSku: any;
  seleccionadoProveedorId: any;
  tarifaModalOrden: any;
  thirdPartyPestana: any;
  width: any;
}

export const ModalesCompras: React.FC<PropiedadesModalesCompras> = ({
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
  seleccionadoProveedorId,
  tarifaModalOrden,
  thirdPartyPestana,
  width,
}) => {
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
        subtitle={editandoPo && editandoPo.status !== "borrador" ? "Solo lectura (ya aprobada)" : "Editable solo en estado Borrador"}
      >
        {/* 1. PROVEEDOR Y PLAZOS */}
        <Text style={estilos.formularioSeccionEncabezado}>1. Proveedor y Plazo de Entrega</Text>
        <Text style={estilos.campoEtiqueta}>Proveedor:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {proveedores
            .filter((s: any) => !s.disabled)
            .map((s: any) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => establecerSeleccionadoProveedorId(s.id)}
                style={[
                  estilos.chipBoton,
                  seleccionadoProveedorId === s.id && estilos.chipBotonActivo,
                ]}
              >
                <Text style={[estilos.chipTexto, seleccionadoProveedorId === s.id && estilos.chipTextoActivo]}>
                  {s.businessName}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <TouchableOpacity
          onPress={() => establecerPoEsAutomaticoMinimo(!poEsAutomaticoMinimo)}
          style={estilos.checkboxFila}
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
        />

        {/* 2. ÍTEMS REQUERIDOS */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Ítems Requeridos en la Orden</Text>
        <Text style={estilos.campoEtiqueta}>Ítems a ordenar:</Text>
        {poElementos.map((item: any, idx: any) => {
          const prod = productos.find((p: any) => p.sku === item.sku);
          return (
            <View key={idx} style={estilos.poElementoFormularioFila}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={estilos.elementoSkuTexto}>{prod ? prod.name : item.sku}</Text>
              </View>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(v: any) => {
                  const val = Number(v) || 0;
                  establecerPoElementos((prev: any) =>
                    prev.map((it: any, i: any) => (i === idx ? { ...it, quantity: val } : it))
                  );
                }}
                keyboardType="numeric"
                style={estilos.poNumeroEntrada}
                placeholder="Cant"
              />
              <TextInput
                value={String(item.unitPrice)}
                onChangeText={(v: any) => {
                  const val = Number(v) || 0;
                  establecerPoElementos((prev: any) =>
                    prev.map((it: any, i: any) => (i === idx ? { ...it, unitPrice: val } : it))
                  );
                }}
                keyboardType="numeric"
                style={[estilos.poNumeroEntrada, { width: 80, marginLeft: 6 }]}
                placeholder="Precio"
              />
            </View>
          );
        })}

        <Boton
          title="+ Agregar Insumo"
          variant="outline"
          size="sm"
          onPress={() => {
            const siguienteProducto = productos.find((p: any) => !poElementos.some((i: any) => i.sku === p.sku)) || productos[0];
            establecerPoElementos((prev: any) => [
              ...prev,
              { sku: siguienteProducto.sku, quantity: 10, unitPrice: siguienteProducto.unitCost },
            ]);
          }}
          style={{ marginVertical: 8 }}
        />

        <CampoTexto
          label="Observaciones o condiciones de despacho"
          value={poNotas}
          onChangeText={establecerPoNotas}
          placeholder="Ej: Entregar en bodega central antes de las 16:00"
        />

        {Boolean(poError) && <Text style={estilos.errorTexto}>{poError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Guardar Borrador"
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
                  tone={pdfVistaPreviaOrden.status === "recibida" ? "ok" : "info"}
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

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cerrar Vista Previa"
            variant="ghost"
            onPress={() => establecerPdfVistaPreviaOrden(null)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Descargar PDF (Simulado)"
            variant="primary"
            icon="download-outline"
            onPress={() => {
              mostrarAviso("Documento PDF de Orden de Compra descargado exitosamente.");
              establecerPdfVistaPreviaOrden(null);
            }}
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

      {/* Escáner de Cámara Tablet para Recepción */}
      <ModalEscanerQr
        visible={escanerAbrir}
        onClose={() => establecerEscanerAbrir(false)}
        onScanResult={manejarEscanearCodigo}
        title={scanningTargetSku ? `Escanear Insumo SKU: ${scanningTargetSku}` : "Escanear Insumo de la OC"}
      />
    </>
  );
};
