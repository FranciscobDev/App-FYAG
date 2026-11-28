import React from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { estilos } from "../estilos";

export interface PropiedadesSeccionDevolucionesProveedor {
  activoPestana: any;
  devolucionesProveedor: any;
  establecerNuevoProveedorDevolucionModal: any;
  establecerResolverDevolucionModal: any;
  establecerResolverNotas: any;
  establecerResolverTipo: any;
  establecerSupRetError: any;
  rolActual: any;
  width: any;
}

export const SeccionDevolucionesProveedor: React.FC<PropiedadesSeccionDevolucionesProveedor> = ({
  activoPestana,
  devolucionesProveedor,
  establecerNuevoProveedorDevolucionModal,
  establecerResolverDevolucionModal,
  establecerResolverNotas,
  establecerResolverTipo,
  establecerSupRetError,
  rolActual,
}) => {
  if (activoPestana !== "proveedores") return null;

  const pendientesConteo = devolucionesProveedor.filter((s: any) => s.status === "pendiente_resolucion").length;
  const resueltasConteo = devolucionesProveedor.filter((s: any) => s.status === "resuelta").length;

  return (
    <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
      {/* 1. FRANJA DE RESUMEN Y ACCIÓN RÁPIDA DE GARANTÍAS A PROVEEDOR */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
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
            borderColor: tema.colors.dangerBorder,
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
              backgroundColor: tema.colors.dangerLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="alert-circle-outline" size={20} color={tema.colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {pendientesConteo}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Por Resolver
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
              {resueltasConteo}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Resueltas
            </Text>
          </View>
        </View>

        {rolActual !== "technician" && (
          <Boton
            title="Devolver a Proveedor"
            variant="danger"
            size="md"
            icon="add-circle-outline"
            onPress={() => {
              establecerSupRetError("");
              establecerNuevoProveedorDevolucionModal(true);
            }}
          />
        )}
      </View>

      {devolucionesProveedor.length === 0 ? (
        <EstadoVacio
          icon="cube-outline"
          title="Sin devoluciones a proveedores"
          description="No se registran devoluciones activas a proveedores por garantías o fallas."
          actionTitle={rolActual !== "technician" ? "Devolver a Proveedor" : undefined}
          onAction={
            rolActual !== "technician"
              ? () => {
                  establecerSupRetError("");
                  establecerNuevoProveedorDevolucionModal(true);
                }
              : undefined
          }
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        devolucionesProveedor.map((sRet: any) => {
          const esResuelto = sRet.status === "resuelta";
          return (
            <Tarjeta key={sRet.id} variant="default" style={estilos.proveedorRetTarjeta}>
              <View style={estilos.supRetSuperior}>
                <View style={{ flex: 1 }}>
                  <View style={estilos.codigoFila}>
                    <Text style={estilos.supRetCodigo}>{sRet.code}</Text>
                    <InsigniaEstado status={sRet.status} size="sm" />
                  </View>
                  <Text style={estilos.supRetProveedor}>
                    Proveedor: <Text style={{ fontWeight: "bold" }}>{sRet.supplierName}</Text> ({sRet.supplierRut})
                  </Text>
                  <Text style={estilos.supRetProducto}>
                    {sRet.quantity} {sRet.unit} de {sRet.productName} ({sRet.productSku})
                  </Text>
                </View>
              </View>

              <View style={estilos.supRetDetalles}>
                <View style={estilos.detalleElementoFila}>
                  <Ionicons name="document-text-outline" size={16} color={tema.colors.primary} />
                  <Text style={estilos.supRetTexto}>
                    Guía de Despacho N°: <Text style={{ fontWeight: "bold", color: tema.colors.text }}>{sRet.dispatchGuideNumber}</Text>
                  </Text>
                </View>

                <View style={estilos.detalleElementoFila}>
                  <Ionicons name="chatbox-ellipses-outline" size={16} color={tema.colors.danger} />
                  <Text style={estilos.supRetTexto}>
                    Motivo: <Text style={{ color: tema.colors.text }}>{sRet.reason}</Text>
                  </Text>
                </View>

                <View style={estilos.detalleElementoFila}>
                  <Ionicons name="calendar-outline" size={16} color={tema.colors.textMuted} />
                  <Text style={estilos.supRetTexto}>Fecha de egreso: {formatearFecha(sRet.date)}</Text>
                </View>

                {sRet.resolutionType && (
                  <View style={estilos.resolutionCaja}>
                    <View style={estilos.resolutionEncabezado}>
                      <Ionicons name="checkmark-circle" size={18} color={tema.colors.ok} style={{ marginRight: 6 }} />
                      <Text style={estilos.resolutionTitulo}>
                        Resolución:{" "}
                        {sRet.resolutionType === "nota_credito"
                          ? "Nota de Crédito"
                          : sRet.resolutionType === "reemplazo_producto"
                          ? "Reemplazo de Producto"
                          : "Reembolso en Dinero"}
                      </Text>
                    </View>
                    {sRet.resolutionNotes && (
                      <Text style={estilos.resolutionTexto}>"{sRet.resolutionNotes}"</Text>
                    )}
                    {sRet.resolvedAt && (
                      <Text style={estilos.resolutionFecha}>Cerrada el {formatearFecha(sRet.resolvedAt)}</Text>
                    )}
                  </View>
                )}
              </View>

              {!esResuelto && rolActual !== "technician" && (
                <View style={estilos.supRetAcciones}>
                  <Boton
                    title="Resolver Devolución"
                    variant="success"
                    size="sm"
                    icon="checkmark-outline"
                    onPress={() => {
                      establecerResolverDevolucionModal(sRet);
                      establecerResolverTipo("nota_credito");
                      establecerResolverNotas("Emisión de Nota de Crédito por el proveedor.");
                    }}
                    style={{ height: 42 }}
                  />
                </View>
              )}
            </Tarjeta>
          );
        })
      )}
    </ScrollView>
  );
};
