import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { RegistroAuditoria } from "@/nucleo/tipos";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { Insignia } from "@/componentes/base/Insignia";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { Selector, OpcionSelector } from "@/componentes/formularios/Selector";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { VisorDiferencias } from "@/componentes/datos/VisorDiferencias";
import { estilos } from "../estilos";

export interface PropiedadesSeccionAuditoria {
  activoPestana: string;
  auditoriaBuscar: string;
  auditoriaEntityFiltrar: string;
  auditoriaFechaFiltrar: string;
  establecerAuditoriaBuscar: (val: string) => void;
  establecerAuditoriaEntityFiltrar: (val: string) => void;
  establecerAuditoriaFechaFiltrar: (val: "todos" | "hoy" | "7dias" | "30dias") => void;
  filtradoAuditoriaRegistros: RegistroAuditoria[];
  width: number;
}

const OPCIONES_ENTIDAD: OpcionSelector<string>[] = [
  { label: "Todas las entidades del sistema", value: "todas", icon: "layers-outline" },
  { label: "Insumos y Catálogo", value: "Insumos", icon: "cube-outline" },
  { label: "Proyectos y Obras", value: "Proyectos", icon: "construct-outline" },
  { label: "Órdenes de Compra", value: "OrdenesCompra", icon: "cart-outline" },
  { label: "Facturas de Proveedor", value: "Facturas", icon: "receipt-outline" },
  { label: "Herramientas (Activos Fijos)", value: "Herramientas", icon: "build-outline" },
  { label: "Usuarios y Accesos", value: "Usuarios", icon: "people-outline" },
  { label: "Parámetros Operativos", value: "Parametros", icon: "options-outline" },
  { label: "Respaldos de Base de Datos", value: "Respaldos", icon: "cloud-done-outline" },
];

export const SeccionAuditoria: React.FC<PropiedadesSeccionAuditoria> = ({
  activoPestana,
  auditoriaBuscar,
  auditoriaEntityFiltrar,
  auditoriaFechaFiltrar,
  establecerAuditoriaBuscar,
  establecerAuditoriaEntityFiltrar,
  establecerAuditoriaFechaFiltrar,
  filtradoAuditoriaRegistros,
  width,
}) => {
  if (activoPestana !== "auditoria") return null;
  const esCompacto = width < 768;

  return (
    <View style={estilos.seccion}>
      {/* Cabecera Compacta de Auditoría Inmutable */}
      <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: tema.colors.primaryLight,
                borderWidth: 1,
                borderColor: tema.colors.primaryBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={tema.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                Bitácora de Auditoría Inmutable
              </Text>
              <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                {`${filtradoAuditoriaRegistros.length} evento(s) registrados • Trazabilidad antes/después de solo lectura`}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#f1f5f9",
              borderRadius: 9,
              padding: 3,
              borderWidth: 1,
              borderColor: "#cbd5e1",
            }}
          >
            {[
              { id: "todos", label: "Todo" },
              { id: "hoy", label: "Hoy" },
              { id: "7dias", label: "7D" },
            ].map((d) => {
              const activo = auditoriaFechaFiltrar === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => establecerAuditoriaFechaFiltrar(d.id as any)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 7,
                    backgroundColor: activo ? "#0f172a" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: activo ? "#818cf8" : tema.colors.textSecondary,
                    }}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Tarjeta>

      {/* Filtros con Buscador y Selector Desplegable de Entidad */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1.4, minWidth: 210 }}>
          <CampoBusqueda
            value={auditoriaBuscar}
            onChangeText={establecerAuditoriaBuscar}
            placeholder="Buscar evento por usuario, RUT, acción o campo modificado..."
          />
        </View>
        <View style={{ flex: 1, minWidth: 190 }}>
          <Selector
            label="Entidad Afectada"
            options={OPCIONES_ENTIDAD}
            value={auditoriaEntityFiltrar}
            onChange={establecerAuditoriaEntityFiltrar}
            placeholder="Todas las entidades"
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
      </View>

      {/* Registros de Auditoría con Semáforo de Superficie */}
      {filtradoAuditoriaRegistros.length === 0 ? (
        <EstadoVacio
          icon="shield-outline"
          title="Sin registros de auditoría"
          description="No existen eventos de auditoría inmutable para los filtros seleccionados."
          containerStyle={{ paddingVertical: 24 }}
        />
      ) : esCompacto ? (
        <View style={{ gap: 10 }}>
          {filtradoAuditoriaRegistros.map((log) => {
            const esCreacion = log.action === "creacion";
            const esBaja = log.action === "deshabilitacion" || log.action === "anonimizacion";

            const semaforo = esBaja
              ? {
                bg: "#fef2f2",
                border: "#fca5a5",
                stripe: "#dc2626",
                text: "#991b1b",
                divider: "#fecaca",
                tone: "danger" as const,
              }
              : esCreacion
                ? {
                  bg: "#f0fdf4",
                  border: "#86efac",
                  stripe: "#16a34a",
                  text: "#166534",
                  divider: "#bbf7d0",
                  tone: "ok" as const,
                }
                : {
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  stripe: "#d97706",
                  text: "#92400e",
                  divider: "#fde68a",
                  tone: "warn" as const,
                };

            return (
              <Tarjeta
                key={log.id}
                variant="outlined"
                style={{
                  padding: 12,
                  backgroundColor: semaforo.bg,
                  borderColor: semaforo.border,
                  borderWidth: 1.5,
                  borderLeftWidth: 6,
                  borderLeftColor: semaforo.stripe,
                  borderRadius: 12,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text }}>
                      {log.userName}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                      RUT: {log.userRut} • {log.timestamp}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                    <Insignia label={log.entity} tone="info" size="sm" />
                    <Insignia label={log.action.toUpperCase()} tone={semaforo.tone} size="sm" />
                  </View>
                </View>

                <Text style={{ fontSize: 12, fontWeight: "600", color: tema.colors.text, marginVertical: 7 }}>
                  {log.description}
                </Text>

                <View
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: semaforo.divider,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <VisorDiferencias
                    label={log.fieldChanged}
                    oldValue={log.oldValue}
                    newValue={log.newValue}
                    showDelta={typeof log.oldValue === "number" && typeof log.newValue === "number"}
                  />
                </View>
              </Tarjeta>
            );
          })}
        </View>
      ) : (
        <Tarjeta style={estilos.tarjetaCaja}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: 960 }}>
            <View style={{ minWidth: 960, flex: 1 }}>
              <View style={estilos.tablaEncabezadoFila}>
                <Text style={[estilos.thCelda, { width: 140 }]}>Fecha / Hora</Text>
                <Text style={[estilos.thCelda, { width: 180 }]}>Usuario Responsable</Text>
                <Text style={[estilos.thCelda, { width: 110 }]}>Entidad</Text>
                <Text style={[estilos.thCelda, { width: 120 }]}>Acción</Text>
                <Text style={[estilos.thCelda, { width: 220 }]}>Cambio (Antes → Después)</Text>
                <Text style={[estilos.thCelda, { width: 190 }]}>Descripción del Suceso</Text>
              </View>

              {filtradoAuditoriaRegistros.map((log) => (
                <View key={log.id} style={estilos.auditoriaFila}>
                  <Text style={[estilos.tdCelda, { width: 140, fontSize: 11, color: tema.colors.textMuted }]}>
                    {log.timestamp}
                  </Text>

                  <View style={{ width: 180, paddingRight: 8 }}>
                    <Text style={estilos.auditoriaUsuarioNombre}>{log.userName}</Text>
                    <Text style={estilos.auditoriaUsuarioRut}>{log.userRut}</Text>
                  </View>

                  <View style={{ width: 110 }}>
                    <View style={estilos.entityEtiqueta}>
                      <Text style={estilos.entityEtiquetaTexto}>{log.entity}</Text>
                    </View>
                  </View>

                  <View style={{ width: 120 }}>
                    <View
                      style={[
                        estilos.accionInsignia,
                        log.action === "creacion" && estilos.accionInsigniaCrear,
                        log.action === "modificacion" && estilos.accionInsigniaModify,
                        log.action === "deshabilitacion" && estilos.accionInsigniaEliminar,
                        log.action === "anonimizacion" && estilos.accionInsigniaAnon,
                      ]}
                    >
                      <Text
                        style={[
                          estilos.accionInsigniaTexto,
                          log.action === "creacion" && estilos.accionInsigniaTextoCrear,
                          log.action === "modificacion" && estilos.accionInsigniaTextoModify,
                          log.action === "deshabilitacion" && estilos.accionInsigniaTextoEliminar,
                          log.action === "anonimizacion" && estilos.accionInsigniaTextoAnon,
                        ]}
                      >
                        {log.action.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ width: 220, paddingRight: 8 }}>
                    <VisorDiferencias
                      label={log.fieldChanged}
                      oldValue={log.oldValue}
                      newValue={log.newValue}
                      showDelta={typeof log.oldValue === "number" && typeof log.newValue === "number"}
                    />
                  </View>

                  <Text style={[estilos.tdCelda, { width: 190, fontSize: 11, color: tema.colors.textSecondary }]}>
                    {log.description}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Tarjeta>
      )}
    </View>
  );
};
