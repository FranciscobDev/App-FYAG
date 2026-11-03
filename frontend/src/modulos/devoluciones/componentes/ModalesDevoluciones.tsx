import React, { useState } from "react";
import {
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
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { OrdenDevolucion, ItemOrdenDevolucion, DevolucionProveedor } from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesModalesDevoluciones {
  confirmarDevolucionModal: any;
  cuarentenaProductos: any;
  discrepancyNota: any;
  establecerConfirmarDevolucionModal: any;
  establecerDiscrepancyNota: any;
  establecerNuevoProveedorDevolucionModal: any;
  establecerResolverDevolucionModal: any;
  establecerResolverNotas: any;
  establecerResolverTipo: any;
  establecerSupRetCantidad: any;
  establecerSupRetGuia: any;
  establecerSupRetMotivo: any;
  establecerSupRetProveedorId: any;
  establecerSupRetSku: any;
  establecerVerificadoLista: any;
  manejarConfirmarBodegaRecepcion: any;
  manejarConfirmarResolution: any;
  manejarEstablecerExactCoincidencia: any;
  manejarGuardarProveedorDevolucion: any;
  nuevoProveedorDevolucionModal: any;
  proveedores: any;
  resolverDevolucionModal: any;
  resolverNotas: any;
  resolverTipo: any;
  supRetCantidad: any;
  supRetError: any;
  supRetGuia: any;
  supRetMotivo: any;
  supRetProveedorId: any;
  supRetSku: any;
  verificadoLista: any;
}

export const ModalesDevoluciones: React.FC<PropiedadesModalesDevoluciones> = ({
  confirmarDevolucionModal,
  cuarentenaProductos,
  discrepancyNota,
  establecerConfirmarDevolucionModal,
  establecerDiscrepancyNota,
  establecerNuevoProveedorDevolucionModal,
  establecerResolverDevolucionModal,
  establecerResolverNotas,
  establecerResolverTipo,
  establecerSupRetCantidad,
  establecerSupRetGuia,
  establecerSupRetMotivo,
  establecerSupRetProveedorId,
  establecerSupRetSku,
  establecerVerificadoLista,
  manejarConfirmarBodegaRecepcion,
  manejarConfirmarResolution,
  manejarEstablecerExactCoincidencia,
  manejarGuardarProveedorDevolucion,
  nuevoProveedorDevolucionModal,
  proveedores,
  resolverDevolucionModal,
  resolverNotas,
  resolverTipo,
  supRetCantidad,
  supRetError,
  supRetGuia,
  supRetMotivo,
  supRetProveedorId,
  supRetSku,
  verificadoLista,
}) => {
  return (
    <>
      {/* ========================================================================= */}
      {/* MODAL 1: BODEGA - CONFIRMAR CANTIDAD REAL FÍSICA                          */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(confirmarDevolucionModal)}
        onClose={() => establecerConfirmarDevolucionModal(null)}
        title="Confirmar Cantidad Física en Bodega"
        subtitle={confirmarDevolucionModal ? `${confirmarDevolucionModal.code} • ${confirmarDevolucionModal.technicianName}` : ""}
      >
        <Text style={estilos.modalInstruction}>
          Realice el conteo físico de los insumos recepcionados. Si la cantidad difiere de lo declarado por el técnico, el sistema emitirá una alerta y registrará la nota de discrepancia:
        </Text>

        {confirmarDevolucionModal?.items?.map((it: any) => {
          const verificado = verificadoLista.find((v: any) => v.sku === it.sku);
          const actualRealValor = verificado?.quantityReceivedReal ?? it.quantityReturned;
          const tieneDiferencia = actualRealValor !== it.quantityReturned;

          return (
            <View key={it.sku} style={[estilos.verificarElementoTarjeta, tieneDiferencia && estilos.verificarElementoTarjetaDiferencia]}>
              <View style={estilos.verificarElementoSuperior}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.verificarElementoTitulo}>{it.name}</Text>
                  <Text style={estilos.verificarElementoEsperado}>
                    Declarado por técnico en terreno: <Text style={{ fontWeight: "bold" }}>{it.quantityReturned} {it.unit}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => manejarEstablecerExactCoincidencia(it.sku, it.quantityReturned)}
                  style={estilos.coincidenciaBoton}
                >
                  <Text style={estilos.coincidenciaBotonTexto}>Coincide ({it.quantityReturned})</Text>
                </TouchableOpacity>
              </View>

              <View style={estilos.verificarEntradaFila}>
                <Text style={estilos.verificarEntradaEtiqueta}>Cantidad Física Real Recibida:</Text>
                <TextInput
                  value={String(actualRealValor)}
                  onChangeText={(v: any) => {
                    const numero = Number(v) || 0;
                    establecerVerificadoLista((prev: any) =>
                      prev.map((x: any) => (x.sku === it.sku ? { ...x, quantityReceivedReal: numero } : x))
                    );
                  }}
                  keyboardType="numeric"
                  style={[
                    estilos.verificarTextoEntrada,
                    tieneDiferencia && { borderColor: tema.colors.warn, backgroundColor: tema.colors.warnLight },
                  ]}
                />
              </View>

              {/* Advertencia obligatoria si difiere */}
              {tieneDiferencia && (
                <View style={estilos.diferenciaAdvertenciaCaja}>
                  <Ionicons name="warning" size={16} color={tema.colors.warnDark} style={{ marginRight: 6 }} />
                  <Text style={estilos.diferenciaAdvertencia}>
                    ⚠️ ¡Discrepancia detectada! El técnico declaró {it.quantityReturned} {it.unit}, pero se están recibiendo {actualRealValor} {it.unit}. (Diferencia: {actualRealValor - it.quantityReturned > 0 ? `+${actualRealValor - it.quantityReturned}` : actualRealValor - it.quantityReturned} {it.unit}).
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <CampoTexto
          label="Observación o justificación de la discrepancia"
          value={discrepancyNota}
          onChangeText={establecerDiscrepancyNota}
          placeholder="Ej: Faltaron 2 metros por merma en corte de terreno..."
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerConfirmarDevolucionModal(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Confirmar e Ingresar a Stock"
            variant="success"
            onPress={manejarConfirmarBodegaRecepcion}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* MODAL 2: NUEVA DEVOLUCIÓN A PROVEEDOR (DEFECTUOSOS)                       */}
      {/* ========================================================================= */}
      <VistaModal
        visible={nuevoProveedorDevolucionModal}
        onClose={() => establecerNuevoProveedorDevolucionModal(false)}
        title="Devolver Insumo a Proveedor"
        subtitle="Egreso de insumo defectuoso desde cuarentena con Guía de Despacho"
      >
        <Text style={estilos.campoEtiqueta}>1. Proveedor Destino:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
          {proveedores.map((s: any) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => establecerSupRetProveedorId(s.id)}
              style={[
                estilos.chipBoton,
                supRetProveedorId === s.id && estilos.chipBotonActivo,
              ]}
            >
              <Text style={[estilos.chipTexto, supRetProveedorId === s.id && estilos.chipTextoActivo]}>
                {s.businessName} ({s.rut})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={estilos.campoEtiqueta}>2. Insumo Defectuoso (en Cuarentena):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
          {cuarentenaProductos.length === 0 ? (
            <View style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 12, color: tema.colors.textMuted }}>
                No hay insumos registrados en cuarentena actualmente.
              </Text>
            </View>
          ) : (
            cuarentenaProductos.map((p: any) => (
              <TouchableOpacity
                key={p.sku}
                onPress={() => establecerSupRetSku(p.sku)}
                style={[
                  estilos.chipBoton,
                  supRetSku === p.sku && estilos.chipBotonActivo,
                ]}
              >
                <Text style={[estilos.chipTexto, supRetSku === p.sku && estilos.chipTextoActivo]}>
                  {p.name} ({p.quarantine} {p.unit} en cuarentena)
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <CampoTexto
          label="Cantidad a Devolver"
          value={supRetCantidad}
          onChangeText={establecerSupRetCantidad}
          keyboardType="numeric"
        />

        <CampoTexto
          label="N° de Guía de Despacho de Salida"
          value={supRetGuia}
          onChangeText={establecerSupRetGuia}
          placeholder="Ej: GD-2026-905"
        />

        <CampoTexto
          label="Motivo Detallado del Defecto / Falla"
          value={supRetMotivo}
          onChangeText={establecerSupRetMotivo}
          placeholder="Ej: Aislación deficiente, microfuga o daño de empaque..."
        />

        {Boolean(supRetError) && <Text style={estilos.errorTexto}>{supRetError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerNuevoProveedorDevolucionModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Generar Devolución"
            variant="danger"
            onPress={manejarGuardarProveedorDevolucion}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* MODAL 3: RESOLVER DEVOLUCIÓN DE PROVEEDOR                                 */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(resolverDevolucionModal)}
        onClose={() => establecerResolverDevolucionModal(null)}
        title="Resolver Devolución a Proveedor"
        subtitle={resolverDevolucionModal ? `${resolverDevolucionModal.code} • ${resolverDevolucionModal.supplierName}` : ""}
      >
        <Text style={estilos.modalInstruction}>
          Seleccione la vía formal acordada con el proveedor para cerrar esta devolución:
        </Text>

        <View style={estilos.resolutionOpcionesGrilla}>
          <TouchableOpacity
            onPress={() => establecerResolverTipo("nota_credito")}
            style={[
              estilos.resolutionOpcionTarjeta,
              resolverTipo === "nota_credito" && estilos.resolutionOpcionActivo,
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={resolverTipo === "nota_credito" ? tema.colors.primary : tema.colors.textMuted}
            />
            <Text style={[estilos.resolutionOpcionTitulo, resolverTipo === "nota_credito" && estilos.resolutionOpcionTituloActivo]}>
              Nota de Crédito
            </Text>
            <Text style={estilos.resolutionOpcionDescripcion}>Ajuste contable en cuenta corriente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => establecerResolverTipo("reemplazo_producto")}
            style={[
              estilos.resolutionOpcionTarjeta,
              resolverTipo === "reemplazo_producto" && estilos.resolutionOpcionActivo,
            ]}
          >
            <Ionicons
              name="repeat-outline"
              size={24}
              color={resolverTipo === "reemplazo_producto" ? tema.colors.ok : tema.colors.textMuted}
            />
            <Text style={[estilos.resolutionOpcionTitulo, resolverTipo === "reemplazo_producto" && estilos.resolutionOpcionTituloActivo]}>
              Reemplazo
            </Text>
            <Text style={estilos.resolutionOpcionDescripcion}>Entrega de producto nuevo conforme</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => establecerResolverTipo("reembolso")}
            style={[
              estilos.resolutionOpcionTarjeta,
              resolverTipo === "reembolso" && estilos.resolutionOpcionActivo,
            ]}
          >
            <Ionicons
              name="cash-outline"
              size={24}
              color={resolverTipo === "reembolso" ? tema.colors.info : tema.colors.textMuted}
            />
            <Text style={[estilos.resolutionOpcionTitulo, resolverTipo === "reemplazo_producto" && estilos.resolutionOpcionTituloActivo]}>
              Reembolso
            </Text>
            <Text style={estilos.resolutionOpcionDescripcion}>Devolución de fondos bancarios</Text>
          </TouchableOpacity>
        </View>

        <CampoTexto
          label="N° de Documento y Notas de Respaldo"
          value={resolverNotas}
          onChangeText={establecerResolverNotas}
          placeholder="Ej: Nota de Crédito N° 4519 recibida y conciliada..."
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerResolverDevolucionModal(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Confirmar Resolución"
            variant="success"
            onPress={manejarConfirmarResolution}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>
    </>
  );
};
