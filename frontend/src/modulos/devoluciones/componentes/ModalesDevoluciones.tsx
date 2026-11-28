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
      {/* MODAL 1: BODEGA - CONFIRMAR CANTIDAD REAL FÍSICA RECIBIDA                 */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(confirmarDevolucionModal)}
        onClose={() => establecerConfirmarDevolucionModal(null)}
        title="Confirmar Cantidad Real Recibida"
        subtitle={
          confirmarDevolucionModal
            ? `${confirmarDevolucionModal.code} • ${confirmarDevolucionModal.projectCode} • ${confirmarDevolucionModal.technicianName}`
            : ""
        }
        maxWidth={560}
      >
        {(() => {
          const itemsModal = confirmarDevolucionModal?.items || [];
          const totalDeclarado = itemsModal.reduce(
            (acc: number, it: any) => acc + Number(it.quantityReturned || 0),
            0
          );
          const totalReal = itemsModal.reduce((acc: number, it: any) => {
            const verif = verificadoLista.find((v: any) => v.sku === it.sku);
            return acc + Number(verif?.quantityReceivedReal ?? it.quantityReturned ?? 0);
          }, 0);
          const hayDiscrepancia = itemsModal.some((it: any) => {
            const verif = verificadoLista.find((v: any) => v.sku === it.sku);
            const realVal = verif?.quantityReceivedReal ?? it.quantityReturned;
            return Number(realVal) !== Number(it.quantityReturned);
          });
          const faltaJustificacion = hayDiscrepancia && !String(discrepancyNota || "").trim();

          return (
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={estilos.modalInstruction}>
                Verifica físicamente cada insumo retornado de obra. Al confirmar, el estado cambia a{" "}
                <Text style={{ fontWeight: "bold" }}>Recibida</Text>, reingresa al stock/Cardex y se
                refleja en el móvil del técnico.
              </Text>

              {/* Resumen comparativo en vivo */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 130,
                    backgroundColor: tema.colors.surface,
                    borderWidth: 1,
                    borderColor: tema.colors.border,
                    borderRadius: tema.radius.sm,
                    padding: 10,
                  }}
                >
                  <Text style={{ fontSize: 10, color: tema.colors.textMuted, fontWeight: "600" }}>
                    TOTAL DECLARADO
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: "bold", color: tema.colors.text, marginTop: 2 }}>
                    {totalDeclarado} un.
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 130,
                    backgroundColor: hayDiscrepancia ? tema.colors.warnLight : tema.colors.okLight,
                    borderWidth: 1,
                    borderColor: hayDiscrepancia ? tema.colors.warnBorder : "#bbf7d0",
                    borderRadius: tema.radius.sm,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: hayDiscrepancia ? tema.colors.warnDark : tema.colors.okDark,
                      fontWeight: "600",
                    }}
                  >
                    REAL A REINGRESAR
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: hayDiscrepancia ? tema.colors.warnDark : tema.colors.okDark,
                      marginTop: 2,
                    }}
                  >
                    {totalReal} un.
                  </Text>
                </View>
              </View>

              {itemsModal.map((it: any) => {
                const verificado = verificadoLista.find((v: any) => v.sku === it.sku);
                const actualRealValor = verificado?.quantityReceivedReal ?? it.quantityReturned;
                const tieneDiferencia = Number(actualRealValor) !== Number(it.quantityReturned);

                const actualizarValorReal = (nuevoValor: number) => {
                  const seguro = Math.max(0, Number(nuevoValor.toFixed(3)));
                  establecerVerificadoLista((prev: any) =>
                    prev.map((x: any) =>
                      x.sku === it.sku ? { ...x, quantityReceivedReal: seguro } : x
                    )
                  );
                };

                return (
                  <View
                    key={it.sku}
                    style={[
                      estilos.verificarElementoTarjeta,
                      tieneDiferencia && estilos.verificarElementoTarjetaDiferencia,
                    ]}
                  >
                    <View style={[estilos.verificarElementoSuperior, { flexWrap: "wrap", gap: 8 }]}>
                      <View style={{ flex: 1, minWidth: 160 }}>
                        <Text style={estilos.verificarElementoTitulo}>{it.name}</Text>
                        <Text style={estilos.verificarElementoEsperado}>
                          SKU: {it.sku} • Declarado:{" "}
                          <Text style={{ fontWeight: "bold" }}>
                            {it.quantityReturned} {it.unit}
                          </Text>
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => manejarEstablecerExactCoincidencia(it.sku, it.quantityReturned)}
                        style={estilos.coincidenciaBoton}
                      >
                        <Text style={estilos.coincidenciaBotonTexto}>
                          Coincide ({it.quantityReturned})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        estilos.verificarEntradaFila,
                        { flexWrap: "wrap", gap: 8, marginTop: 8 },
                      ]}
                    >
                      <Text style={estilos.verificarEntradaEtiqueta}>
                        Cantidad Real Recibida ({it.unit}):
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => actualizarValorReal(Number(actualRealValor) - 1)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: tema.radius.sm,
                            borderWidth: 1,
                            borderColor: tema.colors.borderDark,
                            backgroundColor: tema.colors.card,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="remove" size={16} color={tema.colors.text} />
                        </TouchableOpacity>

                        <TextInput
                          value={String(actualRealValor)}
                          onChangeText={(v: string) => {
                            const limpio = v.replace(/[^0-9.]/g, "");
                            const numero = limpio === "" ? 0 : Number(limpio);
                            actualizarValorReal(Number.isFinite(numero) ? numero : 0);
                          }}
                          keyboardType="numeric"
                          style={[
                            estilos.verificarTextoEntrada,
                            { minWidth: 64, textAlign: "center" },
                            tieneDiferencia && {
                              borderColor: tema.colors.warn,
                              backgroundColor: tema.colors.warnLight,
                            },
                          ]}
                        />

                        <TouchableOpacity
                          onPress={() => actualizarValorReal(Number(actualRealValor) + 1)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: tema.radius.sm,
                            borderWidth: 1,
                            borderColor: tema.colors.borderDark,
                            backgroundColor: tema.colors.card,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="add" size={16} color={tema.colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {tieneDiferencia && (
                      <View style={estilos.diferenciaAdvertenciaCaja}>
                        <Ionicons
                          name="warning"
                          size={16}
                          color={tema.colors.warnDark}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={estilos.diferenciaAdvertencia}>
                          Discrepancia detectada: técnico declaró {it.quantityReturned} {it.unit},
                          recibido físico {actualRealValor} {it.unit} (
                          {actualRealValor - it.quantityReturned > 0
                            ? `+${Number((actualRealValor - it.quantityReturned).toFixed(3))}`
                            : Number((actualRealValor - it.quantityReturned).toFixed(3))}{" "}
                          {it.unit}).
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              <CampoTexto
                label={
                  hayDiscrepancia
                    ? "Justificación obligatoria de la discrepancia *"
                    : "Observación de recepción (opcional)"
                }
                value={discrepancyNota}
                onChangeText={establecerDiscrepancyNota}
                placeholder="Ej: Faltaron 2 metros por merma en corte de terreno..."
              />

              {faltaJustificacion && (
                <Text
                  style={{
                    fontSize: 12,
                    color: tema.colors.danger,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Debe indicar el motivo de la diferencia antes de confirmar el ingreso.
                </Text>
              )}

              <View
                style={[
                  estilos.modalBotonesFila,
                  { flexWrap: "wrap", gap: 10, marginTop: 12 },
                ]}
              >
                <Boton
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => establecerConfirmarDevolucionModal(null)}
                  style={{ flex: 1, minWidth: 110, minHeight: 44 }}
                />
                <Boton
                  title="Confirmar Ingreso (Recibida)"
                  variant="success"
                  icon="checkmark-done-outline"
                  disabled={faltaJustificacion}
                  onPress={manejarConfirmarBodegaRecepcion}
                  style={{ flex: 1.6, minWidth: 180, minHeight: 46 }}
                />
              </View>
            </ScrollView>
          );
        })()}
      </VistaModal>

      {/* ========================================================================= */}
      {/* MODAL 2: BODEGUERO - EMITIR DEVOLUCIÓN A PROVEEDOR CON GUÍA               */}
      {/* ========================================================================= */}
      <VistaModal
        visible={nuevoProveedorDevolucionModal}
        onClose={() => establecerNuevoProveedorDevolucionModal(false)}
        title="Emitir Devolución a Proveedor con Guía"
        subtitle="Despacho de insumo defectuoso desde cuarentena • Estado inicial: Pendiente de resolución"
        maxWidth={560}
      >
        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
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
                <Text
                  style={[
                    estilos.chipTexto,
                    supRetProveedorId === s.id && estilos.chipTextoActivo,
                  ]}
                >
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
                  onPress={() => {
                    establecerSupRetSku(p.sku);
                    establecerSupRetCantidad(String(Math.min(Number(supRetCantidad) || 1, p.quarantine || 1)));
                  }}
                  style={[
                    estilos.chipBoton,
                    supRetSku === p.sku && estilos.chipBotonActivo,
                  ]}
                >
                  <Text
                    style={[
                      estilos.chipTexto,
                      supRetSku === p.sku && estilos.chipTextoActivo,
                    ]}
                  >
                    {p.name} ({p.quarantine} {p.unit} en cuarentena)
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <CampoTexto
            label="3. Cantidad a Devolver"
            value={supRetCantidad}
            onChangeText={establecerSupRetCantidad}
            keyboardType="numeric"
          />

          <CampoTexto
            label="4. N° de Guía de Despacho de Salida *"
            value={supRetGuia}
            onChangeText={establecerSupRetGuia}
            placeholder="Ej: GD-2026-905"
          />

          <CampoTexto
            label="5. Motivo Detallado del Defecto / Falla *"
            value={supRetMotivo}
            onChangeText={establecerSupRetMotivo}
            placeholder="Ej: Aislación deficiente, microfuga o daño de empaque..."
            multiline
            numberOfLines={2}
          />

          {Boolean(supRetError) && <Text style={estilos.errorTexto}>{supRetError}</Text>}

          <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 10, marginTop: 12 }]}>
            <Boton
              title="Cancelar"
              variant="ghost"
              onPress={() => establecerNuevoProveedorDevolucionModal(false)}
              style={{ flex: 1, minWidth: 110, minHeight: 44 }}
            />
            <Boton
              title="Emitir Devolución con Guía"
              variant="danger"
              icon="document-text-outline"
              onPress={manejarGuardarProveedorDevolucion}
              style={{ flex: 1.6, minWidth: 170, minHeight: 46 }}
            />
          </View>
        </ScrollView>
      </VistaModal>

      {/* ========================================================================= */}
      {/* MODAL 3: ADMINISTRADOR - CIERRE ADMINISTRATIVO DE DEVOLUCIÓN              */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(resolverDevolucionModal)}
        onClose={() => establecerResolverDevolucionModal(null)}
        title="Cierre Administrativo de Devolución"
        subtitle={
          resolverDevolucionModal
            ? `${resolverDevolucionModal.code} • ${resolverDevolucionModal.supplierName} • Guía ${resolverDevolucionModal.dispatchGuideNumber}`
            : ""
        }
        maxWidth={560}
      >
        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
          <Text style={estilos.modalInstruction}>
            Selecciona la vía formal de cierre acordada con el proveedor para cambiar el estado de{" "}
            <Text style={{ fontWeight: "bold" }}>Pendiente de resolución</Text> a{" "}
            <Text style={{ fontWeight: "bold" }}>Resuelta</Text>:
          </Text>

          <View style={[estilos.resolutionOpcionesGrilla, { flexWrap: "wrap", gap: 8 }]}>
            <TouchableOpacity
              onPress={() => establecerResolverTipo("nota_credito")}
              style={[
                estilos.resolutionOpcionTarjeta,
                { minWidth: 130 },
                resolverTipo === "nota_credito" && estilos.resolutionOpcionActivo,
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={24}
                color={resolverTipo === "nota_credito" ? tema.colors.primary : tema.colors.textMuted}
              />
              <Text
                style={[
                  estilos.resolutionOpcionTitulo,
                  resolverTipo === "nota_credito" && estilos.resolutionOpcionTituloActivo,
                ]}
              >
                Nota de Crédito
              </Text>
              <Text style={estilos.resolutionOpcionDescripcion}>
                Ajuste contable en cuenta corriente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => establecerResolverTipo("reemplazo_producto")}
              style={[
                estilos.resolutionOpcionTarjeta,
                { minWidth: 130 },
                resolverTipo === "reemplazo_producto" && estilos.resolutionOpcionActivo,
              ]}
            >
              <Ionicons
                name="repeat-outline"
                size={24}
                color={
                  resolverTipo === "reemplazo_producto" ? tema.colors.ok : tema.colors.textMuted
                }
              />
              <Text
                style={[
                  estilos.resolutionOpcionTitulo,
                  resolverTipo === "reemplazo_producto" && estilos.resolutionOpcionTituloActivo,
                ]}
              >
                Reposición
              </Text>
              <Text style={estilos.resolutionOpcionDescripcion}>
                Reingresa stock nuevo al Cardex
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => establecerResolverTipo("reembolso")}
              style={[
                estilos.resolutionOpcionTarjeta,
                { minWidth: 130 },
                resolverTipo === "reembolso" && estilos.resolutionOpcionActivo,
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={24}
                color={resolverTipo === "reembolso" ? tema.colors.info : tema.colors.textMuted}
              />
              <Text
                style={[
                  estilos.resolutionOpcionTitulo,
                  resolverTipo === "reembolso" && estilos.resolutionOpcionTituloActivo,
                ]}
              >
                Reembolso
              </Text>
              <Text style={estilos.resolutionOpcionDescripcion}>
                Devolución de fondos bancarios
              </Text>
            </TouchableOpacity>
          </View>

          <CampoTexto
            label="N° de Documento (NC / Guía Reposición) y Notas de Cierre *"
            value={resolverNotas}
            onChangeText={establecerResolverNotas}
            placeholder={
              resolverTipo === "nota_credito"
                ? "Ej: Nota de Crédito N° 4519 recibida y conciliada en contabilidad..."
                : resolverTipo === "reemplazo_producto"
                ? "Ej: Reposición conforme recibida en bodega bajo Guía N° 8842..."
                : "Ej: Transferencia de reembolso confirmada en cartola bancaria..."
            }
            multiline
            numberOfLines={2}
          />

          <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 10, marginTop: 12 }]}>
            <Boton
              title="Cancelar"
              variant="ghost"
              onPress={() => establecerResolverDevolucionModal(null)}
              style={{ flex: 1, minWidth: 110, minHeight: 44 }}
            />
            <Boton
              title="Marcar como Resuelta"
              variant="success"
              icon="checkmark-done-outline"
              disabled={!String(resolverNotas || "").trim()}
              onPress={manejarConfirmarResolution}
              style={{ flex: 1.6, minWidth: 170, minHeight: 46 }}
            />
          </View>
        </ScrollView>
      </VistaModal>
    </>
  );
};
