import React, { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  DialogoConfirmacion,
  EstadoVacio,
  BotonExportar,
  CampoTexto,
  VistaModal,
  EncabezadoPagina,
  BarraProgreso,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import { Proyecto, TipoProyecto, EstadoProyecto } from "@/nucleo/tipos";
import { estilos } from "../estilos";

export interface PropiedadesVistaListadoProyectos {
  buscarProyecto: any;
  establecerBuscarProyecto: any;
  establecerDetallePestana: any;
  establecerListaEstadoFiltrar: any;
  establecerSeleccionadoProyecto: any;
  filtradoProyectos: any;
  listaEstadoFiltrar: any;
  manejarAbrirNuevoProyecto: any;
  rolActual: any;
}

export const VistaListadoProyectos: React.FC<PropiedadesVistaListadoProyectos> = ({
  buscarProyecto,
  establecerBuscarProyecto,
  establecerDetallePestana,
  establecerListaEstadoFiltrar,
  establecerSeleccionadoProyecto,
  filtradoProyectos,
  listaEstadoFiltrar,
  manejarAbrirNuevoProyecto,
  rolActual,
}) => {
  return (
    <>
        <View style={estilos.vistaEnvoltorio}>
          {/* Encabezado Principal Limpio (Ancho completo edge-to-edge sin recuadro blanco) */}
          <EncabezadoPagina
            title="Control de Obras y Proyectos"
            subtitle="Monitoreo presupuestario en tiempo real con semáforo de costo y margen"
            breadcrumbs={["Inicio", "Proyectos", "Proyectos y Obras"]}
          />

          <ScrollView style={estilos.listaContenedor} contentContainerStyle={estilos.scrollCuerpo}>
            {/* BANNER PROMINENTE PARA CREAR NUEVO PROYECTO */}
            {rolActual === "admin" && (
              <Tarjeta style={estilos.crearProyectoHeroTarjeta}>
                <View style={estilos.crearProyectoHeroContenido}>
                  <View style={estilos.crearProyectoHeroIzquierda}>
                    <View style={estilos.heroInsigniaFila}>
                      <Insignia label="Obras" tone="primary" size="sm" />
                      <Text style={estilos.heroInsigniaHint}>Monitoreo H27 y H28</Text>
                    </View>
                    <Text style={estilos.crearProyectoHeroTitulo}>Registrar Nueva Obra o Proyecto</Text>
                    <Text style={estilos.crearProyectoHeroDescripcion}>
                      Crea una obra o contrato de mantención para imputar HH, compras de insumos y controlar el margen en tiempo real.
                    </Text>
                  </View>
                  <Boton
                    title="+ Crear Nuevo Proyecto"
                    variant="primary"
                    size="md"
                    icon="add-circle-outline"
                    onPress={manejarAbrirNuevoProyecto}
                    style={estilos.botonCrearProyectoGrande}
                  />
                </View>
              </Tarjeta>
            )}

            {/* Buscador de Proyecto */}
            <View style={estilos.buscarCajaEnvoltorio}>
            <Ionicons name="search-outline" size={18} color={tema.colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              value={buscarProyecto}
              onChangeText={establecerBuscarProyecto}
              placeholder="Buscar por código, nombre u obra..."
              placeholderTextColor={tema.colors.textLight}
              style={estilos.buscarEntradaTexto}
            />
            {Boolean(buscarProyecto) && (
              <Pressable onPress={() => establecerBuscarProyecto("")}>
                <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filtros de Estado */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.filtrarScroll}>
            {[
              { id: "todos", label: "Todos los Estados" },
              { id: "activo", label: "Activos" },
              { id: "planificado", label: "Planificados" },
              { id: "cerrado", label: "Cerrados" },
            ].map((f: any) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => establecerListaEstadoFiltrar(f.id)}
                style={[estilos.filtrarChip, listaEstadoFiltrar === f.id && estilos.filtrarChipActivo]}
              >
                <Text style={[estilos.filtrarChipTexto, listaEstadoFiltrar === f.id && estilos.filtrarChipTextoActivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            {(listaEstadoFiltrar !== "todos" || Boolean(buscarProyecto)) && (
              <TouchableOpacity
                onPress={() => {
                  establecerListaEstadoFiltrar("todos");
                  establecerBuscarProyecto("");
                }}
                style={[estilos.filtrarChip, { borderColor: tema.colors.borderDark }]}
              >
                <Ionicons name="close-circle-outline" size={14} color={tema.colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={estilos.filtrarChipTexto}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {filtradoProyectos.length === 0 ? (
            <EstadoVacio
              icon="business-outline"
              title="No se encontraron proyectos"
              description={
                buscarProyecto
                  ? `No existen coincidencias para "${buscarProyecto}".`
                  : "No hay proyectos ni faenas registradas con este filtro."
              }
              actionTitle={rolActual === "admin" ? "+ Crear Nuevo Proyecto" : undefined}
              onAction={rolActual === "admin" ? manejarAbrirNuevoProyecto : undefined}
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            filtradoProyectos.map((proj: any) => {
              const ratio = proj.budget > 0 ? proj.costReal / proj.budget : 0;
            const porcentaje = Math.round(ratio * 100);

            // Semáforo de costo:
            // Verde: < 80%
            // Amarillo: 80-100%
            // Rojo: > 100%
            let semTono: "ok" | "warn" | "danger" = "ok";
            let semTexto = "Verde (< 80%)";
            if (ratio > 1.0) {
              semTono = "danger";
              semTexto = "Rojo (> 100%)";
            } else if (ratio >= 0.8) {
              semTono = "warn";
              semTexto = "Amarillo (80–100%)";
            }

            return (
              <TouchableOpacity
                key={proj.id}
                onPress={() => {
                  establecerSeleccionadoProyecto(proj);
                  establecerDetallePestana("resumen");
                }}
                activeOpacity={0.8}
              >
                <Tarjeta variant="elevated" style={estilos.proyectoListaTarjeta}>
                  <View style={estilos.tarjetaSuperior}>
                    <View style={{ flex: 1 }}>
                      <View style={estilos.codigoFila}>
                        <Text style={estilos.codigoTexto}>{proj.code}</Text>
                        <Insignia
                          label={proj.kind === "obra" ? "OBRA" : "MANTENCIÓN"}
                          tone={proj.kind === "obra" ? "info" : "warn"}
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                      <Text style={estilos.nombreTexto}>{proj.name}</Text>
                      <Text style={estilos.clienteTexto}>Cliente: {proj.client}</Text>
                    </View>

                    <Insignia
                      label={proj.status.toUpperCase()}
                      tone={
                        proj.status === "activo"
                          ? "ok"
                          : proj.status === "cerrado"
                          ? "mute"
                          : "info"
                      }
                    />
                  </View>

                  {/* Semáforo de Costo como indicador pequeño */}
                  <View style={estilos.costoSemaphoreFila}>
                    <View style={estilos.costoSemaphoreIzquierda}>
                      <Text style={estilos.costoEtiqueta}>Costo:</Text>
                      <Text style={estilos.costoValoresTexto}>
                        {formatearCLP(proj.costReal)}{" "}
                        <Text style={{ color: tema.colors.textMuted, fontWeight: "normal" }}>
                          / {formatearCLP(proj.budget)}
                        </Text>
                      </Text>
                    </View>

                    <View style={estilos.semaphoreIndicatorPastilla}>
                      <View
                        style={[
                          estilos.semaphorePunto,
                          {
                            backgroundColor:
                              semTono === "ok"
                                ? tema.colors.ok
                                : semTono === "warn"
                                ? tema.colors.warn
                                : tema.colors.danger,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          estilos.semaphorePorcentajeTexto,
                          {
                            color:
                              semTono === "ok"
                                ? tema.colors.ok
                                : semTono === "warn"
                                ? tema.colors.warnDark
                                : tema.colors.danger,
                          },
                        ]}
                      >
                        {porcentaje}%
                      </Text>
                    </View>
                  </View>

                  <View style={estilos.tarjetaInferiorFila}>
                    <Text style={estilos.fechasTexto}>
                      Plazo: {formatearFecha(proj.deadline)} • Inicio: {formatearFecha(proj.startDate)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={tema.colors.textMuted} />
                  </View>
                </Tarjeta>
              </TouchableOpacity>
            );
          })
        )}
          </ScrollView>
        </View>
    </>
  );
};
