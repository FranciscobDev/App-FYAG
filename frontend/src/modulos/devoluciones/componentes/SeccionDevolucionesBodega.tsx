import React from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
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

export interface PropiedadesSeccionDevolucionesBodega {
  activoPestana: any;
  establecerTransitBuscar: any;
  filtradoTransitDevoluciones: any;
  inTransitConteo: any;
  manejarAbrirConfirmarDevolucion: any;
  transitBuscar: any;
}

export const SeccionDevolucionesBodega: React.FC<PropiedadesSeccionDevolucionesBodega> = ({
  activoPestana,
  establecerTransitBuscar,
  filtradoTransitDevoluciones,
  inTransitConteo,
  manejarAbrirConfirmarDevolucion,
  transitBuscar,
}) => {
  if (activoPestana !== "bodega") return null;

  const recibidasConteo = filtradoTransitDevoluciones.filter((r: any) => r.status === "recibida").length;
  const totalUnidadesEnTransito = filtradoTransitDevoluciones
    .filter((r: any) => r.status === "en_transito")
    .reduce(
      (acc: number, r: any) =>
        acc + (r.items || []).reduce((sum: number, it: any) => sum + (it.quantityReturned || 0), 0),
      0
    );

  return (
    <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
      {/* 1. FRANJA DE RESUMEN OPERATIVO DE RETORNOS DE OBRA */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
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
            borderColor: tema.colors.primaryBorder,
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
              backgroundColor: tema.colors.warnLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="car-outline" size={20} color={tema.colors.warnDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {inTransitConteo}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              En Tránsito
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
              backgroundColor: tema.colors.primaryLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="cube-outline" size={20} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tema.colors.text }}>
              {totalUnidadesEnTransito}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Unidades por Reingresar
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
              {recibidasConteo}
            </Text>
            <Text style={{ fontSize: 11, color: tema.colors.textMuted, fontWeight: "600" }}>
              Retornos Recibidos
            </Text>
          </View>
        </View>
      </View>

      {/* 2. BUSCADOR RÁPIDO */}
      <View style={estilos.buscarFila}>
        <Ionicons name="search-outline" size={18} color={tema.colors.textMuted} style={estilos.buscarIcono} />
        <TextInput
          value={transitBuscar}
          onChangeText={establecerTransitBuscar}
          placeholder="Buscar por código DEV, proyecto o técnico..."
          placeholderTextColor={tema.colors.textLight}
          style={estilos.buscarEntrada}
        />
        {Boolean(transitBuscar) && (
          <TouchableOpacity onPress={() => establecerTransitBuscar("")} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. LISTADO DE DEVOLUCIONES */}
      {filtradoTransitDevoluciones.length === 0 ? (
        <EstadoVacio
          icon="car-outline"
          title="Sin devoluciones registradas"
          description="No se encontraron retornos de obra para la búsqueda actual."
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        filtradoTransitDevoluciones.map((ret: any) => {
          const esTransit = ret.status === "en_transito";
          return (
            <Tarjeta
              key={ret.id}
              variant={esTransit ? "elevated" : "default"}
              style={[estilos.transitTarjeta, esTransit && estilos.transitTarjetaActivo]}
            >
              <View style={estilos.transitSuperior}>
                <View style={{ flex: 1 }}>
                  <View style={estilos.codigoFila}>
                    <Text style={estilos.transitCodigo}>{ret.code}</Text>
                    <InsigniaEstado status={ret.status} size="sm" />
                  </View>
                  <Text style={estilos.transitProyecto}>
                    {ret.projectName} ({ret.projectCode})
                  </Text>
                  <Text style={estilos.transitTecnico}>
                    Técnico: <Text style={{ fontWeight: "600" }}>{ret.technicianName}</Text> ({ret.technicianRut}) • {formatearFecha(ret.date)}
                  </Text>
                </View>
              </View>

              <View style={estilos.transitElementosCaja}>
                <Text style={estilos.elementosCajaEncabezado}>Insumos Declarados en la Devolución:</Text>
                {ret.items?.map((it: any, idx: any) => (
                  <View key={idx} style={estilos.transitElementoFila}>
                    <Text style={estilos.transitElementoNombre}>• {it.name}</Text>
                    <View style={estilos.transitElementoValores}>
                      <Text style={estilos.transitDeclaredTexto}>
                        Declarado: <Text style={{ fontWeight: "bold" }}>{it.quantityReturned} {it.unit}</Text>
                      </Text>
                      {it.quantityReceivedReal !== undefined && (
                        <Text
                          style={[
                            estilos.transitRealTexto,
                            it.quantityReceivedReal !== it.quantityReturned && estilos.transitDiferenciaTexto,
                          ]}
                        >
                          Real: {it.quantityReceivedReal} {it.unit}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

                {ret.discrepancyNote && (
                  <View style={estilos.discrepancyCajaPequeno}>
                    <Text style={estilos.discrepancyNotaLinea}>
                      ⚠️ Discrepancia registrada: "{ret.discrepancyNote}"
                    </Text>
                  </View>
                )}
              </View>

              {esTransit ? (
                <Boton
                  title="Verificar y Confirmar Ingreso Físico"
                  variant="primary"
                  size="md"
                  icon="checkmark-circle-outline"
                  onPress={() => manejarAbrirConfirmarDevolucion(ret)}
                  style={{ marginTop: 12, height: 46 }}
                />
              ) : (
                <View style={estilos.recibidoConfirmarBanner}>
                  <Ionicons name="checkmark-done" size={16} color={tema.colors.ok} style={{ marginRight: 6 }} />
                  <Text style={estilos.recibidoConfirmarTexto}>
                    Reingreso conforme registrado por {ret.receivedBy || "Bodega Central"}
                  </Text>
                </View>
              )}
            </Tarjeta>
          );
        })
      )}
    </ScrollView>
  );
};
