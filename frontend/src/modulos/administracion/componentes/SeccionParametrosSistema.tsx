import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
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
      {/* Grilla 2x2 de Categorías de Parámetros */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {[
          {
            id: "seguridad" as const,
            label: "Seguridad y Accesos",
            sub: "Políticas de sesión",
            icon: "lock-closed-outline" as const,
            bg: "#f0fdf4",
            border: "#86efac",
            borderActivo: "#16a34a",
            color: "#166534",
          },
          {
            id: "inventario" as const,
            label: "Inventario y Stock",
            sub: "Umbrales de bodega",
            icon: "cube-outline" as const,
            bg: "#fffbeb",
            border: "#fcd34d",
            borderActivo: "#d97706",
            color: "#92400e",
          },
          {
            id: "costos" as const,
            label: "Costos y Tarifas",
            sub: "IVA y mano de obra",
            icon: "cash-outline" as const,
            bg: "#fff7ed",
            border: "#fdba74",
            borderActivo: "#ea580c",
            color: "#9a3412",
          },
          {
            id: "alertas" as const,
            label: "Umbrales de Alertas",
            sub: "Notificaciones SLA",
            icon: "notifications-outline" as const,
            bg: "#f1f5f9",
            border: "#cbd5e1",
            borderActivo: "#334155",
            color: "#0f172a",
          },
        ].map((grp) => {
          const activo = parametroGrupoFiltrar === grp.id;
          const countGrp = parametrosSistema.filter((p) => p.group === grp.id).length;
          return (
            <TouchableOpacity
              key={grp.id}
              activeOpacity={0.8}
              onPress={() => establecerParametroGrupoFiltrar(grp.id)}
              style={{
                flexBasis: "48%",
                flexGrow: 1,
                minWidth: 140,
                backgroundColor: grp.bg,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? grp.borderActivo : grp.border,
                borderLeftWidth: 5,
                borderLeftColor: grp.borderActivo,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: grp.color,
                    textTransform: "uppercase",
                  }}
                  numberOfLines={1}
                >
                  {grp.label}
                </Text>
                <Ionicons name={grp.icon} size={15} color={grp.color} />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900", color: grp.color }}>
                  {countGrp}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: activo ? "800" : "600", color: grp.color }}>
                  {activo ? "● Grupo activo" : grp.sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Formulario Agrupado de Parámetros */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.grupoEncabezadoFila}>
          <Ionicons name="settings-outline" size={20} color={tema.colors.primaryDark} />
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
              <View
                key={param.id}
                style={{
                  backgroundColor: esDifferentDesdePredeterminado ? "#fffbeb" : "#f8fafc",
                  borderWidth: 1,
                  borderColor: esDifferentDesdePredeterminado ? "#fcd34d" : tema.colors.border,
                  borderLeftWidth: 4,
                  borderLeftColor: esDifferentDesdePredeterminado ? "#d97706" : "#16a34a",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <View>
                  <Text style={estilos.parametroTitulo}>{param.name}</Text>
                  <Text style={estilos.parametroDescripcion}>{param.description}</Text>
                  <View style={[estilos.parametroMetaFila, { marginTop: 6 }]}>
                    <View style={[estilos.predeterminadoValorInsignia, { backgroundColor: "#ffffff" }]}>
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

                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View style={[estilos.entradaWithUnidad, { backgroundColor: "#ffffff" }]}>
                    <TextInput
                      style={estilos.parametroEntrada}
                      value={String(actualValor)}
                      onChangeText={(val) => manejarParametroCambiar(param.id, val)}
                      keyboardType={param.type === "number" ? "numeric" : "default"}
                    />
                    {param.unit && <Text style={estilos.unidadSuffix}>{param.unit}</Text>}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Boton
                      variant="primary"
                      size="sm"
                      title="Guardar"
                      icon="checkmark"
                      onPress={() => manejarGuardarParametro(param)}
                      style={{ minHeight: 36 }}
                    />

                    <Boton
                      variant="outline"
                      size="sm"
                      title="Restablecer"
                      icon="refresh-outline"
                      onPress={() => manejarRestablecerParametro(param)}
                      disabled={!esDifferentDesdePredeterminado}
                      style={{ minHeight: 36, backgroundColor: "#ffffff" }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
      </Tarjeta>

      {/* SECCIÓN INTEGRADA DE RESPALDOS Y CONTINUIDAD */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
            <Ionicons name="cloud-done-outline" size={22} color={tema.colors.okDark} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.grupoEncabezadoTitulo}>Respaldos y Continuidad de Base de Datos</Text>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                Último exitoso: {registrosRespaldo.find((b) => b.status === "exito")?.timestamp || "Sin datos"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Boton
              variant="primary"
              size="sm"
              title="Respaldo Manual"
              icon="save-outline"
              onPress={manejarEjecutarRespaldo}
              style={{ minHeight: 38 }}
            />
            <Boton
              variant="outline"
              size="sm"
              title="Probar Restauración"
              icon="flask-outline"
              onPress={manejarEjecutarRestauracionTest}
              style={{ minHeight: 38 }}
            />
          </View>
        </View>

        {tieneRespaldoFailure && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#fef2f2",
              borderWidth: 1.5,
              borderColor: "#fca5a5",
              borderLeftWidth: 5,
              borderLeftColor: "#dc2626",
              borderRadius: 10,
              padding: 10,
              marginBottom: 12,
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#991b1b" }}>
                Fallo detectado en un respaldo automático previo
              </Text>
              <Text style={{ fontSize: 11, color: "#7f1d1d" }}>
                Ejecute un respaldo manual de contingencia para asegurar la réplica.
              </Text>
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          {registrosRespaldo.slice(0, 4).map((item) => {
            const esExito = item.status === "exito";
            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  backgroundColor: esExito ? "#f0fdf4" : "#fef2f2",
                  borderWidth: 1.5,
                  borderColor: esExito ? "#86efac" : "#fca5a5",
                  borderLeftWidth: 5,
                  borderLeftColor: esExito ? "#16a34a" : "#dc2626",
                  borderRadius: 10,
                  padding: 10,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 190 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: tema.colors.text }}>
                    {item.filename}
                  </Text>
                  <Text style={{ fontSize: 11, color: esExito ? "#166534" : "#991b1b", fontWeight: "600", marginTop: 1 }}>
                    {item.timestamp} • {item.type.toUpperCase()} • {item.sizeMb > 0 ? `${item.sizeMb} MB` : "0 MB"}
                  </Text>
                  {item.errorReason && (
                    <Text style={{ fontSize: 11, color: "#991b1b", fontWeight: "700", marginTop: 2 }}>
                      Motivo: {item.errorReason}
                    </Text>
                  )}
                </View>

                <InsigniaEstado
                  status={esExito ? "aprobada" : "rechazada"}
                  label={esExito ? "Éxito" : "Fallo"}
                />
              </View>
            );
          })}
        </View>
      </Tarjeta>
    </View>
  );
};
