import React from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { RegistroAuditoria } from "@/nucleo/tipos";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
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
      {/* Banner de Inmutabilidad Regulatoria */}
      <View style={estilos.leidoOnlyAvisoBanner}>
        <Ionicons name="lock-closed" size={20} color="#1e293b" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={estilos.leidoOnlyAvisoTitulo}>Bitácora de Auditoría de Solo Lectura</Text>
          <Text style={estilos.leidoOnlyAvisoDescripcion}>
            Registro permanente e inmutable de cambios de estado, aprobaciones, parámetros y cuentas.
          </Text>
        </View>
      </View>

      {/* Filtros Combinables de Auditoría */}
      <Tarjeta style={estilos.tarjetaCaja}>
        <View style={estilos.auditoriaFiltrarGrilla}>
          <View style={{ flex: 1.5, minWidth: 220 }}>
            <Text style={estilos.filtrarCampoEtiqueta}>Búsqueda Libre:</Text>
            <TextInput
              style={estilos.textoEntradaCaja}
              placeholder="Buscar acción, usuario, campo..."
              placeholderTextColor={tema.colors.textMuted}
              value={auditoriaBuscar}
              onChangeText={establecerAuditoriaBuscar}
            />
          </View>

          <View style={{ flex: 1.2, minWidth: 220 }}>
            <Text style={estilos.filtrarCampoEtiqueta}>Entidad Afectada:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.entityScroll}>
              {[
                "todas",
                "Insumos",
                "Proyectos",
                "OrdenesCompra",
                "Facturas",
                "Herramientas",
                "Usuarios",
                "Parametros",
                "Respaldos",
              ].map((ent) => (
                <TouchableOpacity
                  key={ent}
                  style={[
                    estilos.entityChip,
                    auditoriaEntityFiltrar === ent && estilos.entityChipActivo,
                  ]}
                  onPress={() => establecerAuditoriaEntityFiltrar(ent)}
                >
                  <Text
                    style={[
                      estilos.entityChipTexto,
                      auditoriaEntityFiltrar === ent && estilos.entityChipTextoActivo,
                    ]}
                  >
                    {ent === "todas" ? "Todas" : ent}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={estilos.filtrarCampoEtiqueta}>Rango de Fecha:</Text>
            <View style={estilos.fechaChipFila}>
              {[
                { id: "todos", label: "Todo" },
                { id: "hoy", label: "Hoy" },
                { id: "7dias", label: "7 Días" },
              ].map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[estilos.pequenoChip, auditoriaFechaFiltrar === d.id && estilos.pequenoChipActivo]}
                  onPress={() => establecerAuditoriaFechaFiltrar(d.id as any)}
                >
                  <Text
                    style={[
                      estilos.pequenoChipTexto,
                      auditoriaFechaFiltrar === d.id && estilos.pequenoChipTextoActivo,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {(Boolean(auditoriaBuscar) || auditoriaEntityFiltrar !== "todas" || auditoriaFechaFiltrar !== "todos") && (
            <View style={{ justifyContent: "flex-end", paddingBottom: 2 }}>
              <Boton
                variant="ghost"
                size="sm"
                title="Limpiar"
                icon="close-circle-outline"
                onPress={() => {
                  establecerAuditoriaBuscar("");
                  establecerAuditoriaEntityFiltrar("todas");
                  establecerAuditoriaFechaFiltrar("todos");
                }}
              />
            </View>
          )}
        </View>
      </Tarjeta>

      {/* Registros de Auditoría: Tarjetas en móvil / Tabla en escritorio */}
      <Tarjeta style={estilos.tarjetaCaja}>
        {filtradoAuditoriaRegistros.length === 0 ? (
          <EstadoVacio
            icon="shield-outline"
            title="Sin registros de auditoría"
            description="No existen eventos de auditoría inmutable para los filtros seleccionados."
            containerStyle={{ borderWidth: 0, paddingVertical: 24 }}
          />
        ) : esCompacto ? (
          <View style={estilos.mobileTarjetasContenedor}>
            {filtradoAuditoriaRegistros.map((log) => (
              <View key={log.id} style={estilos.mobileUsuarioTarjeta}>
                <View style={estilos.mobileUsuarioTarjetaEncabezado}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.auditoriaUsuarioNombre}>{log.userName}</Text>
                    <Text style={estilos.auditoriaUsuarioRut}>
                      {log.userRut} • {log.timestamp}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <View style={estilos.entityEtiqueta}>
                      <Text style={estilos.entityEtiquetaTexto}>{log.entity}</Text>
                    </View>
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
                </View>

                <Text style={{ fontSize: 12, color: tema.colors.textSecondary, marginVertical: 8 }}>
                  {log.description}
                </Text>

                <VisorDiferencias
                  label={log.fieldChanged}
                  oldValue={log.oldValue}
                  newValue={log.newValue}
                  showDelta={typeof log.oldValue === "number" && typeof log.newValue === "number"}
                />
              </View>
            ))}
          </View>
        ) : (
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
        )}
      </Tarjeta>
    </View>
  );
};
