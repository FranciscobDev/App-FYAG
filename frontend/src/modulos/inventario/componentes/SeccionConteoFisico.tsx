import React from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
} from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionConteoFisico {
  activoPestana: any;
  aprobarConteoFisico: any;
  conteosFisicos: any;
  manejarAbrirConteoModal: any;
  mermaSku: any;
  mostrarAviso: any;
  productos: any;
  rechazarConteoFisico: any;
  rolActual: any;
  usuario: any;
  width: any;
}

export const SeccionConteoFisico: React.FC<PropiedadesSeccionConteoFisico> = ({
  activoPestana,
  aprobarConteoFisico,
  conteosFisicos,
  manejarAbrirConteoModal,
  mostrarAviso,
  productos,
  rechazarConteoFisico,
  rolActual,
  usuario,
  width,
}) => {
  const esMovil = width < 480;

  return (
    <>
      {/* =====================================================================
          6. TAB CONTEO FISICO
          ===================================================================== */}
      {activoPestana === "conteo" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          {/* HERO CARD INTUITIVO PARA INICIAR CONTEO FÍSICO */}
          <Tarjeta style={estilos.crearConteoHeroTarjeta}>
            <View style={estilos.crearConteoHeroContenido}>
              <View style={estilos.crearConteoHeroIzquierda}>
                <View style={estilos.conteoInsigniaFila}>
                  <Insignia label="Auditoría" tone="primary" size="sm" />
                  <Text style={estilos.conteoInsigniaHint}>Control de Existencias Físicas vs Sistema</Text>
                </View>
                <Text style={estilos.crearConteoHeroTitulo}>Iniciar Nuevo Conteo Físico de Stock</Text>
                <Text style={estilos.crearConteoHeroDescripcion}>
                  Audita existencias reales en estantería ingresando la cantidad contada. Si la discrepancia supera el umbral del 5%, requerirá aprobación del Administrador y bloqueará despachos preventivamente.
                </Text>
              </View>
              <Boton
                title="+ Iniciar Nuevo Conteo Físico"
                variant="primary"
                size="md"
                icon="calculator-outline"
                onPress={manejarAbrirConteoModal}
                style={estilos.botonCrearConteoGrande}
                fullWidth={width < 768}
              />
            </View>
          </Tarjeta>

          {/* Banner de insumos actualmente bloqueados */}
          {productos.some((p: any) => conteosFisicos.some((c: any) => c.sku === p.sku && c.status === "pendiente_aprobacion")) && (
            <View style={estilos.lockedAdvertenciaBanner}>
              <Ionicons name="lock-closed" size={18} color="#991b1b" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.lockedBannerTitulo}>Atención: Insumos Bloqueados en Auditoría</Text>
                <Text style={estilos.lockedBannerTexto}>
                  Los insumos con discrepancias pendientes de aprobación están temporalmente bloqueados para nuevos despachos.
                </Text>
              </View>
            </View>
          )}

          {/* Sección de Conteos Pendientes de Aprobación (Vista Admin) */}
          <Text style={estilos.formularioSeccionEtiqueta}>Conteos Pendientes de Aprobación (Admin):</Text>
          {conteosFisicos.filter((c: any) => c.status === "pendiente_aprobacion").length === 0 ? (
            <Tarjeta variant="outlined" style={{ padding: 16, alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: tema.colors.textMuted }}>No hay conteos físicos pendientes de resolución.</Text>
            </Tarjeta>
          ) : (
            conteosFisicos
              .filter((c: any) => c.status === "pendiente_aprobacion")
              .map((c: any) => (
                <Tarjeta key={c.id} variant="outlined" style={estilos.pendienteConteoTarjeta}>
                  <View style={estilos.productoSuperiorFila}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={estilos.skuTitulo}>{c.sku}</Text>
                      <Text style={estilos.productoNombre}>{c.productName}</Text>
                    </View>
                    <Insignia label="Pendiente" tone="warn" size="sm" />
                  </View>

                  <View style={estilos.conteoDiferenciaGrilla}>
                    <View style={estilos.conteoDiferenciaCelda}>
                      <Text style={estilos.conteoCeldaLbl}>Stock Sistema</Text>
                      <Text style={estilos.conteoCeldaValor}>{c.systemStock}</Text>
                    </View>
                    <View style={estilos.conteoDiferenciaCelda}>
                      <Text style={estilos.conteoCeldaLbl}>Conteo Físico</Text>
                      <Text style={estilos.conteoCeldaValor}>{c.countedStock}</Text>
                    </View>
                    <View style={estilos.conteoDiferenciaCelda}>
                      <Text style={estilos.conteoCeldaLbl}>Diferencia</Text>
                      <Text style={[estilos.conteoCeldaValor, { color: tema.colors.danger }]}>
                        {c.difference > 0 ? `+${c.difference}` : c.difference} ({c.differencePct.toFixed(1)}%)
                      </Text>
                    </View>
                    <View style={estilos.conteoDiferenciaCelda}>
                      <Text style={estilos.conteoCeldaLbl}>Impacto Valorizado</Text>
                      <Text style={[estilos.conteoCeldaValor, { color: tema.colors.danger }]}>
                        {formatearCLP(c.differenceValue)}
                      </Text>
                    </View>
                  </View>

                  {Boolean(c.notes) && (
                    <Text style={estilos.conteoNotasTexto}>Nota de auditoría: {c.notes}</Text>
                  )}

                  {/* Acciones de Administrador */}
                  {rolActual === "admin" && (
                    <View style={estilos.conteoAdminAcciones}>
                      <Boton
                        title="Rechazar Conteo"
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        onPress={() => {
                          rechazarConteoFisico(c.id, usuario.name);
                          mostrarAviso(`Conteo de ${c.sku} rechazado. Insumo desbloqueado.`);
                        }}
                        style={[
                          { borderColor: tema.colors.danger },
                          esMovil && { flexGrow: 1 },
                        ]}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar Ajuste en Cardex"
                        variant="success"
                        size="sm"
                        icon="checkmark-outline"
                        onPress={() => {
                          aprobarConteoFisico(c.id, usuario.name);
                          mostrarAviso(`Ajuste de ${c.sku} aprobado y reflejado en Cardex.`);
                        }}
                        style={esMovil ? { flexGrow: 1 } : undefined}
                      />
                    </View>
                  )}
                </Tarjeta>
              ))
          )}

          {/* Historial general de conteos */}
          <Text style={[estilos.formularioSeccionEtiqueta, { marginTop: 16 }]}>Historial de Conteos Realizados:</Text>
          {conteosFisicos
            .filter((c: any) => c.status !== "pendiente_aprobacion")
            .map((c: any) => (
              <Tarjeta key={c.id} variant="outlined" style={estilos.conteoHistorialTarjeta}>
                <View style={estilos.mermaSuperiorFila}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={estilos.mermaSku}>{c.sku} • {c.productName}</Text>
                    <Text style={estilos.mermaObsTexto}>
                      Realizado por: {c.counterUser} • {formatearFecha(c.date)}
                    </Text>
                  </View>
                  <Insignia
                    label={
                      c.status === "ajustado_directo"
                        ? "Ajustado"
                        : c.status === "aprobado"
                          ? "Aprobado"
                          : "Rechazado"
                    }
                    tone={c.status === "rechazado" ? "danger" : "ok"}
                    size="sm"
                  />
                </View>
                <Text style={estilos.conteoHistorialDiferencia}>
                  Diferencia: {c.difference} un ({c.differencePct.toFixed(1)}%) • Valor: {formatearCLP(c.differenceValue)}
                </Text>
              </Tarjeta>
            ))}
        </ScrollView>
      )}
    </>
  );
};
