import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { Proyecto } from "@/nucleo/tipos";

interface TechnicianProjectsViewProps {
  onSelectProject?: (project: Proyecto) => void;
  onNavigateTab?: (tab: string, project?: Proyecto, subTab?: "avance" | "horas" | "sobrante") => void;
  isOffline?: boolean;
}

export const VistaProyectosTecnico: React.FC<TechnicianProjectsViewProps> = ({
  onSelectProject,
  onNavigateTab,
  isOffline = false,
}) => {
  const { proyectos, sesionTrabajoActiva, iniciarSesionTrabajo } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const [estadoFiltrar, establecerEstadoFiltrar] = useState<string>("todos");

  // Regla estricta: Técnico ve proyectos asignados y NUNCA proyectos cerrados
  const tecnicoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  // Orden obligatorio por fecha límite (deadline ascendente: más urgente primero)
  const ordenadoProyectos = [...tecnicoProyectos].sort((a, b) => {
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Filtro por estado en chips
  const filtradoProyectos = ordenadoProyectos.filter((p) => {
    if (estadoFiltrar === "todos") return true;
    return p.status === estadoFiltrar;
  });

  const now = Date.now();

  return (
    <ContenedorEstadoPantalla screenTitle="Mis Proyectos (Técnico)" skeletonType="cards">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {/* 1. HEADER & STATUS OFFLINE / ONLINE */}
      <View style={estilos.encabezadoFila}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.encabezadoTitulo}>Mis Proyectos en Terreno</Text>
          <Text style={estilos.encabezadoSub}>
            Ordenados por fecha límite de entrega ({filtradoProyectos.length} proyectos)
          </Text>
        </View>

        {isOffline ? (
          <View style={estilos.sinConexionChip}>
            <Ionicons name="cloud-offline" size={14} color={tema.colors.warnDark} />
            <Text style={estilos.sinConexionChipTexto}>Modo Offline</Text>
          </View>
        ) : (
          <View style={estilos.enLineaChip}>
            <Ionicons name="cloud-done" size={14} color="#22c55e" />
            <Text style={estilos.enLineaChipTexto}>En Línea</Text>
          </View>
        )}
      </View>

      {/* 2. CHIPS DE FILTRO POR ESTADO */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.filtrarScroll}>
        {[
          { id: "todos", label: `Todos (${ordenadoProyectos.length})` },
          { id: "activo", label: `Activos (${ordenadoProyectos.filter((p) => p.status === "activo").length})` },
          { id: "planificado", label: `Planificados (${ordenadoProyectos.filter((p) => p.status === "planificado").length})` },
        ].map((f) => {
          const esActivo = estadoFiltrar === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => establecerEstadoFiltrar(f.id)}
              style={[estilos.filtrarChip, esActivo && estilos.filtrarChipActivo]}
              activeOpacity={0.7}
            >
              <Text style={[estilos.filtrarChipTexto, esActivo && estilos.filtrarChipTextoActivo]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. LISTADO DE TARJETAS DE PROYECTO */}
      {filtradoProyectos.length === 0 ? (
        <EstadoVacio
          icon="folder-open-outline"
          title="Sin proyectos en este estado"
          description="No tienes obras o faenas activas asignadas que coincidan con el filtro."
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        filtradoProyectos.map((proj) => {
          // Semáforo de fecha límite:
          // Amarillo si faltan <= 5 días, Rojo si faltan <= 48 horas o vencido
          const plazoMs = new Date(proj.deadline).getTime();
          const diferenciaMs = plazoMs - now;
          const diferenciaHoras = Math.floor(diferenciaMs / (1000 * 60 * 60));
          const diferenciaDias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

          let semTono: "ok" | "warn" | "danger" = "ok";
          let semEtiqueta = `Quedan ${diferenciaDias} días`;

          if (diferenciaMs <= 0) {
            semTono = "danger";
            semEtiqueta = "¡Plazo Vencido!";
          } else if (diferenciaHoras <= 48) {
            semTono = "danger";
            semEtiqueta = `¡Crítico! Faltan ${diferenciaHoras} horas`;
          } else if (diferenciaDias <= 5) {
            semTono = "warn";
            semEtiqueta = `Atención: Faltan ${diferenciaDias} días`;
          }

          return (
            <Tarjeta
              key={proj.id}
              variant="elevated"
              style={[
                estilos.proyectoTarjeta,
                semTono === "danger" && estilos.proyectoTarjetaPeligro,
                semTono === "warn" && estilos.proyectoTarjetaAdvertencia,
              ]}
            >
              {/* Header de Tarjeta */}
              <View style={estilos.tarjetaSuperiorFila}>
                <View style={estilos.codigoFila}>
                  <Text style={estilos.proyectoCodigo}>{proj.code}</Text>
                  <Insignia
                    label={proj.kind.toUpperCase()}
                    tone={proj.kind === "obra" ? "info" : "warn"}
                    size="sm"
                  />
                  <InsigniaEstado status={proj.status} size="sm" style={{ marginLeft: 6 }} />
                </View>

                {/* Semáforo de Plazo */}
                <Insignia
                  label={semEtiqueta}
                  tone={semTono}
                  icon={
                    semTono === "danger"
                      ? "alert-circle"
                      : semTono === "warn"
                      ? "time-outline"
                      : "calendar-outline"
                  }
                  size="sm"
                />
              </View>

              <Text style={estilos.proyectoNombre}>{proj.name}</Text>
              <Text style={estilos.proyectoCliente}>Cliente: {proj.client}</Text>

              <View style={estilos.direccionFila}>
                <Ionicons name="location-outline" size={14} color={tema.colors.textMuted} />
                <Text style={estilos.direccionTexto} numberOfLines={1}>
                  {proj.address}
                </Text>
              </View>

              {/* Barra de Avance Físico 0-100% */}
              <View style={estilos.progresoContenedor}>
                <View style={estilos.progresoEncabezado}>
                  <Text style={estilos.progresoEtiqueta}>Avance físico de la obra</Text>
                  <Text style={estilos.progresoPorcentaje}>{proj.progress}%</Text>
                </View>
                <BarraProgreso
                  value={proj.progress}
                  max={100}
                  height={8}
                  color={
                    semTono === "danger"
                      ? tema.colors.danger
                      : semTono === "warn"
                      ? tema.colors.warn
                      : tema.colors.primary
                  }
                />
              </View>

              {/* Indicador de Disponibilidad Offline */}
              <View style={estilos.sinConexionSincronizacionAviso}>
                <Ionicons name="checkmark-circle" size={13} color={tema.colors.ok} style={{ marginRight: 4 }} />
                <Text style={estilos.sinConexionSincronizacionTexto}>
                  {isOffline ? "Datos guardados en almacenamiento local del celular" : "Sincronizado con base central"}
                </Text>
              </View>

              {/* Footer con Fecha Límite y Botones Táctiles de Acción (≥ 44 px) */}
              <View style={estilos.tarjetaPie}>
                <View style={estilos.plazoContenedor}>
                  <Text style={estilos.plazoEtiqueta}>Fecha Límite:</Text>
                  <Text
                    style={[
                      estilos.plazoValor,
                      semTono === "danger" && { color: tema.colors.danger, fontWeight: "bold" },
                    ]}
                  >
                    {formatearFecha(proj.deadline)}
                  </Text>
                </View>

                <View style={estilos.accionesGrupo}>
                  {sesionTrabajoActiva?.projectId === proj.id ? (
                    <Boton
                      title="En Faena (HH)"
                      variant="primary"
                      size="sm"
                      icon="timer"
                      onPress={() => onNavigateTab && onNavigateTab("registrar", proj, "horas")}
                      style={{ marginRight: 6, height: 42 }}
                    />
                  ) : (
                    <Boton
                      title="Iniciar Faena"
                      variant="outline"
                      size="sm"
                      icon="play-outline"
                      onPress={() => {
                        if (!sesionTrabajoActiva) {
                          iniciarSesionTrabajo(proj.id);
                        }
                        onNavigateTab && onNavigateTab("registrar", proj, "horas");
                      }}
                      style={{ marginRight: 6, height: 42 }}
                    />
                  )}
                  <Boton
                    title="Avance"
                    variant="outline"
                    size="sm"
                    icon="trending-up-outline"
                    onPress={() => onNavigateTab && onNavigateTab("registrar", proj, "avance")}
                    style={{ marginRight: 6, height: 42 }}
                  />
                  <Boton
                    title="Insumos"
                    variant="primary"
                    size="sm"
                    icon="cube-outline"
                    onPress={() => onNavigateTab && onNavigateTab("insumos", proj)}
                    style={{ height: 42 }}
                  />
                </View>
              </View>
            </Tarjeta>
          );
        })
      )}
    </ScrollView>
    </ContenedorEstadoPantalla>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  encabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tema.spacing.sm,
    flexWrap: "wrap",
    gap: 8,
  },
  encabezadoTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  encabezadoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  sinConexionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
  },
  sinConexionChipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: tema.colors.warnDark,
    marginLeft: 4,
  },
  enLineaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1917", // Dark Titanium chip
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tema.radius.full,
    borderWidth: 1,
    borderColor: "#44403c",
  },
  enLineaChipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#e7e5e4",
    marginLeft: 4,
  },
  filtrarScroll: {
    marginBottom: tema.spacing.md,
  },
  filtrarChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
    minHeight: 38,
    justifyContent: "center",
  },
  filtrarChipActivo: {
    backgroundColor: "#1c1917", // Dark Titanium Active Filter
    borderColor: tema.colors.primary,
  },
  filtrarChipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textSecondary,
    fontWeight: "600",
  },
  filtrarChipTextoActivo: {
    color: "#f59e0b", // Amber glowing text
    fontWeight: "bold",
  },
  vacioTarjeta: {
    alignItems: "center",
    paddingVertical: tema.spacing.xl,
    marginTop: tema.spacing.lg,
  },
  vacioTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 8,
  },
  vacioSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  proyectoTarjeta: {
    marginBottom: tema.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  proyectoTarjetaPeligro: {
    borderLeftColor: tema.colors.danger,
    borderWidth: 1.5,
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  proyectoTarjetaAdvertencia: {
    borderLeftColor: tema.colors.warn,
  },
  tarjetaSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  proyectoCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginRight: 6,
  },
  proyectoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  proyectoCliente: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  direccionFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  direccionTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginLeft: 4,
    flex: 1,
  },
  progresoContenedor: {
    marginTop: 10,
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
  },
  progresoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progresoEtiqueta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  progresoPorcentaje: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  sinConexionSincronizacionAviso: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  sinConexionSincronizacionTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  tarjetaPie: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    flexWrap: "wrap",
    gap: 8,
  },
  plazoContenedor: {
    flex: 1,
  },
  plazoEtiqueta: {
    fontSize: 10,
    color: tema.colors.textMuted,
    fontWeight: "500",
  },
  plazoValor: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 1,
  },
  accionesGrupo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
});
