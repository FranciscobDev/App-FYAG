import React from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { ParametroSistema, RegistroRespaldo } from "@/nucleo/tipos";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { estilos } from "../estilos";

export interface PropiedadesSeccionParametrosSistema {
  activoPestana: string;
  establecerParametroGrupoFiltrar: (val: "seguridad" | "inventario" | "costos" | "alertas") => void;
  manejarGuardarParametro: (param: ParametroSistema) => void;
  manejarParametroCambiar: (id: string, val: string | number) => void;
  manejarRestablecerParametro: (param: ParametroSistema) => void;
  parametroGrupoFiltrar: "seguridad" | "inventario" | "costos" | "alertas";
  parametroValores: { [id: string]: string | number };
  parametrosSistema: ParametroSistema[];
  // Respaldos integrados
  registrosRespaldo: RegistroRespaldo[];
  tieneRespaldoFailure: boolean;
  manejarEjecutarRespaldo: () => void;
  manejarEjecutarRestauracionTest: () => void;
}

export const SeccionParametrosSistema: React.FC<PropiedadesSeccionParametrosSistema> = ({
  activoPestana,
  establecerParametroGrupoFiltrar,
  manejarGuardarParametro,
  manejarParametroCambiar,
  manejarRestablecerParametro,
  parametroGrupoFiltrar,
  parametroValores,
  parametrosSistema,
  registrosRespaldo,
  tieneRespaldoFailure,
  manejarEjecutarRespaldo,
  manejarEjecutarRestauracionTest,
}) => {
  if (activoPestana !== "parametros") return null;

  return (
    <View style={estilos.seccion}>
      {/* Selector de Grupo de Parámetros */}
      <View style={estilos.parametroGrupoPestanas}>
        {[
          { id: "seguridad", label: "Seguridad y Accesos", icon: "lock-closed-outline" },
          { id: "inventario", label: "Inventario y Stock", icon: "cube-outline" },
          { id: "costos", label: "Costos y Tarifas", icon: "cash-outline" },
          { id: "alertas", label: "Umbrales de Alertas", icon: "notifications-outline" },
        ].map((grp) => {
          const isSelected = parametroGrupoFiltrar === grp.id;
          return (
            <TouchableOpacity
              key={grp.id}
              style={[estilos.parametroGrupoPestana, isSelected && estilos.parametroGrupoPestanaActivo]}
              onPress={() => establecerParametroGrupoFiltrar(grp.id as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={grp.icon as any}
                size={16}
                color={isSelected ? tema.colors.primaryDark : tema.colors.textMuted}
              />
              <Text style={[estilos.parametroGrupoPestanaTexto, isSelected && estilos.parametroGrupoPestanaTextoActivo]}>
                {grp.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Formulario Agrupado con Valores por Defecto y Botón Restablecer */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.grupoEncabezadoFila}>
          <Ionicons name="settings" size={20} color={tema.colors.primary} />
          <Text style={estilos.grupoEncabezadoTitulo}>
            Parámetros Operativos:{" "}
            <Text style={{ color: tema.colors.primaryDark, textTransform: "capitalize" }}>
              {parametroGrupoFiltrar}
            </Text>
          </Text>
        </View>

        {parametrosSistema
          .filter((p) => p.group === parametroGrupoFiltrar)
          .map((param) => {
            const actualValor =
              parametroValores[param.id] !== undefined ? parametroValores[param.id] : param.value;
            const esDifferentDesdePredeterminado = actualValor !== param.defaultValue;

            return (
              <View key={param.id} style={estilos.parametroElementoFila}>
                <View style={estilos.parametroInfoColumna}>
                  <Text style={estilos.parametroTitulo}>{param.name}</Text>
                  <Text style={estilos.parametroDescripcion}>{param.description}</Text>
                  <View style={estilos.parametroMetaFila}>
                    <View style={estilos.predeterminadoValorInsignia}>
                      <Text style={estilos.predeterminadoValorTexto}>
                        Valor de Fábrica: {param.defaultValue} {param.unit || ""}
                      </Text>
                    </View>
                    {param.min !== undefined && param.max !== undefined && (
                      <Text style={estilos.rangoTexto}>
                        Rango: [{param.min} – {param.max} {param.unit || ""}]
                      </Text>
                    )}
                  </View>
                </View>

                <View style={estilos.parametroControlColumna}>
                  <View style={estilos.entradaWithUnidad}>
                    <TextInput
                      style={estilos.parametroEntrada}
                      value={String(actualValor)}
                      onChangeText={(val) => manejarParametroCambiar(param.id, val)}
                      keyboardType={param.type === "number" ? "numeric" : "default"}
                    />
                    {param.unit && <Text style={estilos.unidadSuffix}>{param.unit}</Text>}
                  </View>

                  <View style={estilos.parametroAccionBotones}>
                    <Boton
                      variant="secondary"
                      size="sm"
                      title="Guardar"
                      icon="checkmark"
                      onPress={() => manejarGuardarParametro(param)}
                    />

                    <Boton
                      variant="ghost"
                      size="sm"
                      title="Restablecer"
                      icon="refresh-outline"
                      onPress={() => manejarRestablecerParametro(param)}
                      disabled={!esDifferentDesdePredeterminado}
                    />
                  </View>
                </View>
              </View>
            );
          })}
      </Tarjeta>

      {/* SECCIÓN INTEGRADA DE RESPALDOS Y CONTINUIDAD */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.grupoEncabezadoFila}>
          <Ionicons name="cloud-upload-outline" size={20} color={tema.colors.primary} />
          <Text style={estilos.grupoEncabezadoTitulo}>Respaldos y Continuidad de Base de Datos</Text>
        </View>

        {tieneRespaldoFailure && (
          <View style={[estilos.respaldoFailAlerta, { marginBottom: 12 }]}>
            <Ionicons name="alert-circle" size={22} color="#ffffff" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={estilos.respaldoFailTitulo}>
                Se detectó un fallo en un respaldo automático previo
              </Text>
              <Text style={estilos.respaldoFailDescripcion}>
                Se recomienda ejecutar un respaldo manual de contingencia para asegurar la réplica.
              </Text>
            </View>
          </View>
        )}

        <View style={estilos.respaldoAccionesBarra}>
          <View style={estilos.respaldoStatTarjeta}>
            <Ionicons name="cloud-done-outline" size={24} color={tema.colors.ok} />
            <View style={{ marginLeft: 10 }}>
              <Text style={estilos.respaldoStatEtiqueta}>Último Respaldo Exitoso</Text>
              <Text style={estilos.respaldoStatValor}>
                {registrosRespaldo.find((b) => b.status === "exito")?.timestamp || "Sin datos"}
              </Text>
            </View>
          </View>

          <View style={estilos.respaldoBotonCluster}>
            <Boton
              variant="primary"
              size="sm"
              title="Respaldo Manual"
              icon="save-outline"
              onPress={manejarEjecutarRespaldo}
            />
            <Boton
              variant="secondary"
              size="sm"
              title="Probar Restauración"
              icon="flask-outline"
              onPress={manejarEjecutarRestauracionTest}
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          {registrosRespaldo.slice(0, 4).map((item) => (
            <View
              key={item.id}
              style={[
                estilos.parametroElementoFila,
                item.status === "fallo" && estilos.tablaFilaFallo,
              ]}
            >
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={estilos.respaldoFilename}>{item.filename}</Text>
                <Text style={{ fontSize: 11, color: tema.colors.textMuted, marginTop: 2 }}>
                  {item.timestamp} • {item.type.toUpperCase()} • {item.sizeMb > 0 ? `${item.sizeMb} MB` : "0 MB"}
                </Text>
                {item.errorReason && (
                  <Text style={estilos.respaldoErrorNota}>Motivo: {item.errorReason}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <InsigniaEstado
                  status={item.status === "exito" ? "aprobada" : "rechazada"}
                  label={item.status === "exito" ? "Éxito" : "Fallo"}
                />
              </View>
            </View>
          ))}
        </View>
      </Tarjeta>
    </View>
  );
};
