import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Boton, Insignia, VistaModal } from "@/componentes/comunes";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { SolicitudMaterial } from "@/nucleo/tipos";
import { descargarComprobanteSolicitud } from "../comprobanteSolicitudPdf";

export interface PropiedadesModalComprobanteSolicitud {
  solicitud: SolicitudMaterial | null;
  onClose: () => void;
  onNotify?: (mensaje: string) => void;
}

/**
 * Modal de vista formal del comprobante numerado emitido al aprobar una solicitud de material.
 */
export const ModalComprobanteSolicitud: React.FC<PropiedadesModalComprobanteSolicitud> = ({
  solicitud,
  onClose,
  onNotify,
}) => {
  const [exportando, establecerExportando] = useState(false);

  const manejarDescargar = async () => {
    if (!solicitud || exportando) return;
    establecerExportando(true);
    try {
      const resultado = await descargarComprobanteSolicitud(solicitud);
      onNotify?.(resultado.mensaje);
    } finally {
      establecerExportando(false);
    }
  };

  const numeroComprobante = solicitud?.receiptNumber || solicitud?.code || "";

  return (
    <VistaModal
      visible={Boolean(solicitud)}
      onClose={onClose}
      title="Comprobante de Aprobación de Materiales"
      subtitle={
        solicitud
          ? `Folio N° ${numeroComprobante} • Solicitud ${solicitud.code}`
          : ""
      }
    >
      {solicitud && (
        <View style={estilos.hojaContenedor}>
          {/* Encabezado corporativo y folio numerado */}
          <View style={estilos.encabezadoFila}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.empresaTitulo}>FYAG MULTISYSTEM SpA</Text>
              <Text style={estilos.empresaMeta}>RUT: 76.982.341-K • Bodega Central</Text>
              <Text style={estilos.empresaMeta}>Solicitud Origen: {solicitud.code}</Text>
            </View>

            <View style={estilos.folioCaja}>
              <Text style={estilos.folioEtiqueta}>COMPROBANTE N°</Text>
              <Text style={estilos.folioNumero}>{numeroComprobante}</Text>
              <Insignia
                label={solicitud.status === "entregada" ? "ENTREGADA" : "APROBADA"}
                tone="ok"
                size="sm"
                style={{ marginTop: 4 }}
              />
            </View>
          </View>

          {/* Aviso de notificación automática al bodeguero solicitante */}
          <View style={estilos.notificadoBanner}>
            <Ionicons name="notifications-circle-outline" size={18} color={tema.colors.okDark} />
            <Text style={estilos.notificadoTexto}>
              Resultado notificado al bodeguero / solicitante ({solicitud.technicianName}) con folio{" "}
              <Text style={{ fontWeight: "800" }}>{numeroComprobante}</Text>.
            </Text>
          </View>

          {/* Datos del proyecto, solicitante y autorizador */}
          <View style={estilos.datosCaja}>
            <View style={estilos.datoFila}>
              <Text style={estilos.datoEtiqueta}>Proyecto / Obra:</Text>
              <Text style={estilos.datoValor}>
                {solicitud.projectCode} • {solicitud.projectName}
              </Text>
            </View>
            <View style={estilos.datoFila}>
              <Text style={estilos.datoEtiqueta}>Solicitante:</Text>
              <Text style={estilos.datoValor}>
                {solicitud.technicianName}
                {solicitud.requesterRole === "warehouse" ? " (Bodeguero)" : ""}
              </Text>
            </View>
            <View style={estilos.datoFila}>
              <Text style={estilos.datoEtiqueta}>Fecha Solicitud:</Text>
              <Text style={estilos.datoValor}>{formatearFecha(solicitud.date)}</Text>
            </View>
            <View style={estilos.datoFila}>
              <Text style={estilos.datoEtiqueta}>Aprobado por:</Text>
              <Text style={[estilos.datoValor, { color: tema.colors.primaryDark }]}>
                {solicitud.approvedBy || "Administración FYAG"}
              </Text>
            </View>
            <View style={estilos.datoFila}>
              <Text style={estilos.datoEtiqueta}>Fecha Emisión:</Text>
              <Text style={estilos.datoValor}>
                {solicitud.approvedAt || formatearFecha(solicitud.date)}
              </Text>
            </View>
          </View>

          {Boolean(solicitud.comment) && (
            <View style={estilos.notaCaja}>
              <Text style={estilos.notaTitulo}>OBSERVACIONES DE LA SOLICITUD:</Text>
              <Text style={estilos.notaTexto}>{solicitud.comment}</Text>
            </View>
          )}

          {/* Tabla de ítems autorizados para egreso */}
          <View style={estilos.tabla}>
            <View style={estilos.tablaCabecera}>
              <Text style={[estilos.th, { flex: 2 }]}>Insumo / SKU</Text>
              <Text style={[estilos.th, { width: 58, textAlign: "right" }]}>Aprob.</Text>
              <Text style={[estilos.th, { width: 58, textAlign: "right" }]}>Entreg.</Text>
              <Text style={[estilos.th, { width: 52, textAlign: "center" }]}>Unid.</Text>
            </View>
            {solicitud.items.map((item, indice) => (
              <View key={`${item.sku}_${indice}`} style={estilos.tablaFila}>
                <View style={{ flex: 2, paddingRight: 6 }}>
                  <Text style={estilos.tdPrincipal}>{item.name}</Text>
                  <Text style={estilos.tdSecundario}>{item.sku}</Text>
                </View>
                <Text style={[estilos.tdNumero, { width: 58 }]}>{item.quantity}</Text>
                <Text style={[estilos.tdNumero, { width: 58, color: tema.colors.textMuted }]}>
                  {item.deliveredQuantity ?? 0}
                </Text>
                <Text style={[estilos.tdUnidad, { width: 52 }]}>{item.unit}</Text>
              </View>
            ))}
          </View>

          {/* Pie de validación */}
          <View style={estilos.firmasFila}>
            <View style={estilos.firmaBloque}>
              <View style={estilos.firmaLinea} />
              <Text style={estilos.firmaTitulo}>Autoriza Administración</Text>
              <Text style={estilos.firmaSub}>
                {solicitud.approvedBy || "Javier Muñoz Contreras"}
              </Text>
            </View>
            <View style={estilos.firmaBloque}>
              <View style={estilos.firmaLinea} />
              <Text style={estilos.firmaTitulo}>Despacho / Recepción Bodega</Text>
              <Text style={estilos.firmaSub}>Presentar N° {numeroComprobante}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={estilos.botonesPie}>
        <Boton title="Cerrar" variant="ghost" onPress={onClose} />
        <Boton
          title="Imprimir / Descargar Comprobante"
          variant="primary"
          icon="print-outline"
          loading={exportando}
          disabled={exportando}
          onPress={manejarDescargar}
        />
      </View>
    </VistaModal>
  );
};

const estilos = StyleSheet.create({
  hojaContenedor: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    padding: 14,
  },
  encabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: tema.colors.primary,
    paddingBottom: 12,
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 10,
  },
  empresaTitulo: {
    fontSize: 15,
    fontWeight: "900",
    color: tema.colors.primaryDark,
  },
  empresaMeta: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  folioCaja: {
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  folioEtiqueta: {
    fontSize: 10,
    fontWeight: "800",
    color: tema.colors.primaryDeep,
  },
  folioNumero: {
    fontSize: 15,
    fontWeight: "900",
    color: tema.colors.primaryDark,
    marginTop: 2,
  },
  notificadoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.okBorder,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  notificadoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    lineHeight: 16,
  },
  datosCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.sm,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  datoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 6,
  },
  datoEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
  },
  datoValor: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  notaCaja: {
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    borderRadius: tema.radius.sm,
    padding: 8,
    marginBottom: 12,
  },
  notaTitulo: {
    fontSize: 10,
    fontWeight: "800",
    color: tema.colors.warnDark,
  },
  notaTexto: {
    fontSize: 12,
    color: tema.colors.primaryDeep,
    marginTop: 2,
  },
  tabla: {
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.sm,
    overflow: "hidden",
    marginBottom: 14,
  },
  tablaCabecera: {
    flexDirection: "row",
    backgroundColor: tema.colors.transitDark,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  th: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  tablaFila: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    backgroundColor: tema.colors.card,
  },
  tdPrincipal: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.text,
  },
  tdSecundario: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  tdNumero: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
    textAlign: "right",
  },
  tdUnidad: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    textAlign: "center",
  },
  firmasFila: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    paddingTop: 6,
  },
  firmaBloque: {
    flex: 1,
    alignItems: "center",
  },
  firmaLinea: {
    width: "100%",
    height: 1,
    backgroundColor: tema.colors.textMuted,
    marginBottom: 4,
    marginTop: 16,
  },
  firmaTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.text,
    textAlign: "center",
  },
  firmaSub: {
    fontSize: 10,
    color: tema.colors.textMuted,
    textAlign: "center",
  },
  botonesPie: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
});
