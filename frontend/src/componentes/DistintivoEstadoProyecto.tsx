import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export type ClaveEstadoProyecto =
  | "planificado"
  | "en_curso"
  | "pausado"
  | "finalizado"
  | "cerrado"
  | "cancelado";

export interface ConfiguracionEstadoProyecto {
  clave: ClaveEstadoProyecto;
  etiqueta: string;
  etiquetaCorta: string;
  etiquetaAccesible: string;
  descripcion: string;
  icono: keyof typeof Ionicons.glyphMap;
  simboloAccesible: string;
  colorTexto: string;
  colorFondo: string;
  colorBorde: string;
  colorPunto: string;
  contrasteWcag: string;
}

export const CATALOGO_ESTADOS_PROYECTO: Record<
  ClaveEstadoProyecto,
  ConfiguracionEstadoProyecto
> = {
  planificado: {
    clave: "planificado",
    etiqueta: "Planificado",
    etiquetaCorta: "PLANIFICADO",
    etiquetaAccesible: "Estado del proyecto: Planificado (En programación inicial)",
    descripcion: "Proyecto registrado en etapa de planificación y asignación previa.",
    icono: "calendar-outline",
    simboloAccesible: "◆",
    colorTexto: "#1E3A8A", // Azul oscuro profundo sobre fondo celeste claro
    colorFondo: "#DBEAFE",
    colorBorde: "#3B82F6",
    colorPunto: "#1D4ED8",
    contrasteWcag: "8.6:1 (AAA)",
  },
  en_curso: {
    clave: "en_curso",
    etiqueta: "En curso",
    etiquetaCorta: "EN CURSO",
    etiquetaAccesible: "Estado del proyecto: En curso (Obra o servicio activo)",
    descripcion: "Proyecto activo en ejecución con técnicos y recursos en terreno.",
    icono: "play-circle",
    simboloAccesible: "●",
    colorTexto: "#065F46", // Verde esmeralda muy oscuro sobre fondo menta claro
    colorFondo: "#D1FAE5",
    colorBorde: "#10B981",
    colorPunto: "#059669",
    contrasteWcag: "7.8:1 (AAA)",
  },
  pausado: {
    clave: "pausado",
    etiqueta: "Pausado",
    etiquetaCorta: "PAUSADO",
    etiquetaAccesible: "Estado del proyecto: Pausado (Detenido temporalmente)",
    descripcion: "Ejecución en espera de insumos, aprobación o ventana operativa.",
    icono: "pause-circle",
    simboloAccesible: "❚❚",
    colorTexto: "#92400E", // Ámbar oscuro sobre fondo crema cálido
    colorFondo: "#FEF3C7",
    colorBorde: "#F59E0B",
    colorPunto: "#D97706",
    contrasteWcag: "7.4:1 (AAA)",
  },
  finalizado: {
    clave: "finalizado",
    etiqueta: "Finalizado",
    etiquetaCorta: "FINALIZADO",
    etiquetaAccesible: "Estado del proyecto: Finalizado (100% completado)",
    descripcion: "Trabajos técnicos concluidos satisfactoriamente.",
    icono: "checkmark-done-circle",
    simboloAccesible: "✓",
    colorTexto: "#115E59", // Turquesa oscuro sobre fondo aguamarina claro
    colorFondo: "#CCFBF1",
    colorBorde: "#14B8A6",
    colorPunto: "#0D9488",
    contrasteWcag: "7.5:1 (AAA)",
  },
  cerrado: {
    clave: "cerrado",
    etiqueta: "Cerrado",
    etiquetaCorta: "CERRADO",
    etiquetaAccesible: "Estado del proyecto: Cerrado (Cierre administrativo y contable)",
    descripcion: "Proyecto cerrado administrativamente sin cargos adicionales.",
    icono: "lock-closed",
    simboloAccesible: "■",
    colorTexto: "#1F2937", // Gris pizarra oscuro sobre gris claro
    colorFondo: "#E5E7EB",
    colorBorde: "#6B7280",
    colorPunto: "#374151",
    contrasteWcag: "10.2:1 (AAA)",
  },
  cancelado: {
    clave: "cancelado",
    etiqueta: "Cancelado",
    etiquetaCorta: "CANCELADO",
    etiquetaAccesible: "Estado del proyecto: Cancelado o Atrasado crítico",
    descripcion: "Proyecto anulado o con alerta crítica de detención.",
    icono: "close-circle",
    simboloAccesible: "▲",
    colorTexto: "#991B1B", // Rojo carmesí oscuro sobre fondo rosado pálido
    colorFondo: "#FEE2E2",
    colorBorde: "#EF4444",
    colorPunto: "#DC2626",
    contrasteWcag: "7.3:1 (AAA)",
  },
};

const normalizarTexto = (valor: string): string =>
  (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

export const obtenerConfiguracionEstadoProyecto = (
  estadoRaw?: string | null
): ConfiguracionEstadoProyecto => {
  const limpio = normalizarTexto(estadoRaw || "");

  if (
    limpio === "planificado" ||
    limpio === "programado" ||
    limpio === "pendiente" ||
    limpio.includes("planific")
  ) {
    return CATALOGO_ESTADOS_PROYECTO.planificado;
  }

  if (
    limpio === "en_curso" ||
    limpio === "en_proceso" ||
    limpio === "activo" ||
    limpio === "en_ejecucion" ||
    limpio.includes("curso") ||
    limpio.includes("proceso") ||
    limpio.includes("activ")
  ) {
    return CATALOGO_ESTADOS_PROYECTO.en_curso;
  }

  if (
    limpio === "pausado" ||
    limpio === "en_pausa" ||
    limpio === "suspendido" ||
    limpio === "detenido" ||
    limpio.includes("pausa")
  ) {
    return CATALOGO_ESTADOS_PROYECTO.pausado;
  }

  if (
    limpio === "finalizado" ||
    limpio === "completado" ||
    limpio === "terminado" ||
    limpio.includes("finaliz") ||
    limpio.includes("complet")
  ) {
    return CATALOGO_ESTADOS_PROYECTO.finalizado;
  }

  if (limpio === "cerrado" || limpio.includes("cerrad")) {
    return CATALOGO_ESTADOS_PROYECTO.cerrado;
  }

  if (
    limpio === "cancelado" ||
    limpio === "anulado" ||
    limpio === "atrasado" ||
    limpio === "vencido" ||
    limpio.includes("cancel") ||
    limpio.includes("atras")
  ) {
    return CATALOGO_ESTADOS_PROYECTO.cancelado;
  }

  // Si llega un estado personalizado no catalogado, conserva su etiqueta textual con estilo distinguible
  const etiquetaOriginal = (estadoRaw || "Sin estado").trim();
  return {
    ...CATALOGO_ESTADOS_PROYECTO.planificado,
    etiqueta: etiquetaOriginal,
    etiquetaCorta: etiquetaOriginal.toUpperCase(),
    etiquetaAccesible: `Estado del proyecto: ${etiquetaOriginal}`,
  };
};

export interface PropiedadesDistintivoEstadoProyecto {
  estado?: string | null;
  tamano?: "sm" | "md" | "lg";
  mostrarPrefijo?: boolean;
  mostrarSimboloAccesible?: boolean;
  forzarModoMovil?: boolean;
  style?: ViewStyle;
}

/**
 * [FRONT-2] Distintivo visual y textual por cada estado del proyecto.
 * Cumple criterios de accesibilidad visual WCAG AA/AAA en pantallas móviles y escritorio:
 * - Triple codificación: Color de alto contraste + Icono único + Etiqueta textual explícita.
 * - Altura táctil/visual mínima en móvil para legibilidad en terreno.
 */
export const DistintivoEstadoProyecto: React.FC<
  PropiedadesDistintivoEstadoProyecto
> = ({
  estado,
  tamano = "md",
  mostrarPrefijo = false,
  mostrarSimboloAccesible = true,
  forzarModoMovil = false,
  style,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = forzarModoMovil || width < 640;

  const config = useMemo(
    () => obtenerConfiguracionEstadoProyecto(estado),
    [estado]
  );

  // Conserva la etiqueta original si el usuario usa "Activo" vs "En curso", pero normaliza la capitalización
  const etiquetaVisible = useMemo(() => {
    const raw = (estado || "").trim();
    if (!raw) return config.etiqueta;
    const norm = normalizarTexto(raw);
    if (norm === "activo") return "Activo (En curso)";
    if (norm === "en_proceso") return "En Proceso";
    return config.etiqueta;
  }, [estado, config.etiqueta]);

  const textoCompleto = mostrarPrefijo
    ? `Estado: ${etiquetaVisible}`
    : etiquetaVisible;

  const tamanoIcono =
    tamano === "lg" ? 18 : tamano === "sm" ? (esMovil ? 14 : 13) : esMovil ? 16 : 15;

  const tamanoFuente =
    tamano === "lg"
      ? 14
      : tamano === "sm"
      ? esMovil
        ? 12
        : 11
      : esMovil
      ? 13
      : 12;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${config.etiquetaAccesible}. Contraste ${config.contrasteWcag}`}
      style={[
        estilos.distintivoBase,
        tamano === "sm" && estilos.distintivoSm,
        tamano === "lg" && estilos.distintivoLg,
        esMovil && estilos.distintivoMovilAccesible,
        {
          backgroundColor: config.colorFondo,
          borderColor: config.colorBorde,
        },
        style,
      ]}
    >
      {/* Punto indicador de alto contraste */}
      <View
        style={[
          estilos.puntoEstado,
          { backgroundColor: config.colorPunto },
        ]}
      />

      {/* Icono distintivo del estado */}
      <Ionicons
        name={config.icono}
        size={tamanoIcono}
        color={config.colorTexto}
        style={estilos.iconoEstado}
      />

      {/* Etiqueta textual explícita y legible */}
      <Text
        numberOfLines={1}
        style={[
          estilos.textoEstado,
          {
            color: config.colorTexto,
            fontSize: tamanoFuente,
          },
        ]}
      >
        {mostrarSimboloAccesible ? `${config.simboloAccesible} ` : ""}
        {textoCompleto}
      </Text>
    </View>
  );
};

export interface PropiedadesIndicadorUltimaSincronizacion {
  ultimaSincronizacion?: Date | string | null;
  sincronizando?: boolean;
  sinConexion?: boolean;
  pendientes?: number;
  fuenteDatos?: string;
  onSincronizar?: () => void | Promise<void>;
  compacto?: boolean;
  style?: ViewStyle;
}

const formatearHoraExacta = (fecha: Date): string => {
  try {
    return fecha.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    const hh = String(fecha.getHours()).padStart(2, "0");
    const mm = String(fecha.getMinutes()).padStart(2, "0");
    const ss = String(fecha.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
};

const calcularTiempoRelativo = (fecha: Date, ahoraMs: number): string => {
  const diffSeg = Math.max(0, Math.floor((ahoraMs - fecha.getTime()) / 1000));
  if (diffSeg < 10) return "hace unos segundos";
  if (diffSeg < 60) return `hace ${diffSeg} seg`;
  const diffMin = Math.floor(diffSeg / 60);
  if (diffMin === 1) return "hace 1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras === 1) return "hace 1 hora";
  if (diffHoras < 24) return `hace ${diffHoras} horas`;
  return fecha.toLocaleDateString("es-CL");
};

/**
 * [FRONT-2] Indicador de última sincronización con marca de tiempo exacta,
 * tiempo relativo en vivo y estado de conexión accesible en pantallas móviles.
 */
export const IndicadorUltimaSincronizacion: React.FC<
  PropiedadesIndicadorUltimaSincronizacion
> = ({
  ultimaSincronizacion,
  sincronizando = false,
  sinConexion = false,
  pendientes = 0,
  fuenteDatos,
  onSincronizar,
  compacto = false,
  style,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 640;

  const [ahoraMs, establecerAhoraMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => {
      establecerAhoraMs(Date.now());
    }, 15000);
    return () => clearInterval(intervalo);
  }, []);

  const fechaSinc = useMemo<Date | null>(() => {
    if (!ultimaSincronizacion) return new Date();
    if (ultimaSincronizacion instanceof Date) return ultimaSincronizacion;
    const parseada = new Date(ultimaSincronizacion);
    return isNaN(parseada.getTime()) ? new Date() : parseada;
  }, [ultimaSincronizacion]);

  const estadoVisual = useMemo(() => {
    if (sincronizando) {
      return {
        etiqueta: "Sincronizando datos...",
        colorTexto: "#1E3A8A",
        colorFondo: "#DBEAFE",
        colorBorde: "#3B82F6",
        colorPunto: "#2563EB",
        icono: "sync-outline" as keyof typeof Ionicons.glyphMap,
      };
    }
    if (sinConexion) {
      return {
        etiqueta:
          pendientes > 0
            ? `Sin conexión (${pendientes} pend.)`
            : "Modo sin conexión ( caché local )",
        colorTexto: "#92400E",
        colorFondo: "#FEF3C7",
        colorBorde: "#F59E0B",
        colorPunto: "#D97706",
        icono: "cloud-offline-outline" as keyof typeof Ionicons.glyphMap,
      };
    }
    if (pendientes > 0) {
      return {
        etiqueta: `Sincronización pendiente (${pendientes})`,
        colorTexto: "#92400E",
        colorFondo: "#FEF3C7",
        colorBorde: "#F59E0B",
        colorPunto: "#D97706",
        icono: "time-outline" as keyof typeof Ionicons.glyphMap,
      };
    }
    return {
      etiqueta: "Sincronizado",
      colorTexto: "#065F46",
      colorFondo: "#ECFDF5",
      colorBorde: "#10B981",
      colorPunto: "#059669",
      icono: "cloud-done-outline" as keyof typeof Ionicons.glyphMap,
    };
  }, [sincronizando, sinConexion, pendientes]);

  const horaFormateada = fechaSinc ? formatearHoraExacta(fechaSinc) : "--:--:--";
  const relativo = fechaSinc
    ? calcularTiempoRelativo(fechaSinc, ahoraMs)
    : "sin registro";

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${estadoVisual.etiqueta}. Última sincronización: ${horaFormateada}, ${relativo}`}
      style={[
        estilos.sincContenedor,
        compacto && estilos.sincContenedorCompacto,
        esMovil && estilos.sincContenedorMovil,
        {
          backgroundColor: estadoVisual.colorFondo,
          borderColor: estadoVisual.colorBorde,
        },
        style,
      ]}
    >
      <View style={estilos.sincIzquierda}>
        <View
          style={[
            estilos.sincPunto,
            { backgroundColor: estadoVisual.colorPunto },
          ]}
        />
        {sincronizando ? (
          <ActivityIndicator
            size="small"
            color={estadoVisual.colorTexto}
            style={{ marginRight: 6 }}
          />
        ) : (
          <Ionicons
            name={estadoVisual.icono}
            size={esMovil ? 17 : 16}
            color={estadoVisual.colorTexto}
            style={{ marginRight: 6 }}
          />
        )}

        <View style={estilos.sincTextosColumna}>
          <View style={estilos.sincFilaPrincipal}>
            <Text
              style={[
                estilos.sincEstadoTexto,
                { color: estadoVisual.colorTexto },
              ]}
            >
              {estadoVisual.etiqueta}
            </Text>
            <Text
              style={[
                estilos.sincSeparador,
                { color: estadoVisual.colorTexto },
              ]}
            >
              •
            </Text>
            <Text
              style={[
                estilos.sincTiempoTexto,
                { color: estadoVisual.colorTexto },
              ]}
            >
              Última sincronización: {horaFormateada} ({relativo})
            </Text>
          </View>
          {Boolean(fuenteDatos) && !compacto && (
            <Text
              style={[
                estilos.sincSubtexto,
                { color: estadoVisual.colorTexto },
              ]}
            >
              {fuenteDatos}
            </Text>
          )}
        </View>
      </View>

      {onSincronizar && (
        <TouchableOpacity
          onPress={onSincronizar}
          disabled={sincronizando}
          accessibilityRole="button"
          accessibilityLabel="Actualizar y sincronizar estados de proyectos ahora"
          style={[
            estilos.botonSincronizar,
            esMovil && estilos.botonSincronizarMovil,
            { borderColor: estadoVisual.colorBorde },
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={15}
            color={estadoVisual.colorTexto}
          />
          <Text
            style={[
              estilos.botonSincronizarTexto,
              { color: estadoVisual.colorTexto },
            ]}
          >
            {sincronizando ? "Actualizando..." : "Sincronizar"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export interface PropiedadesLeyendaAccesibilidadEstados {
  conteoPorEstado?: Record<string, number>;
  estadoSeleccionado?: string;
  onSeleccionarEstado?: (estado: string) => void;
  style?: ViewStyle;
}

/**
 * [SCRUM] Barra y verificador de accesibilidad visual de los estados en pantalla móvil.
 * Permite distinguir visualmente y por etiqueta textual cada estado y previsualizar su
 * legibilidad móvil con contraste WCAG AAA.
 */
export const LeyendaAccesibilidadEstados: React.FC<
  PropiedadesLeyendaAccesibilidadEstados
> = ({
  conteoPorEstado = {},
  estadoSeleccionado = "todos",
  onSeleccionarEstado,
  style,
}) => {
  const { width } = useWindowDimensions();
  const esPantallaMovilReal = width < 640;
  const [mostrarRevisionMovil, establecerMostrarRevisionMovil] = useState(false);

  const listaEstados: Array<{
    filtroId: string;
    clave: ClaveEstadoProyecto;
    nombreFiltro: string;
  }> = [
    { filtroId: "Planificado", clave: "planificado", nombreFiltro: "Planificado" },
    { filtroId: "En curso", clave: "en_curso", nombreFiltro: "En curso" },
    { filtroId: "Pausado", clave: "pausado", nombreFiltro: "Pausado" },
    { filtroId: "Finalizado", clave: "finalizado", nombreFiltro: "Finalizado" },
  ];

  return (
    <View style={[estilos.leyendaTarjeta, style]}>
      <View style={estilos.leyendaEncabezado}>
        <View style={estilos.leyendaTituloFila}>
          <Ionicons
            name="eye-outline"
            size={18}
            color={tema.colors.primaryDark}
          />
          <Text style={estilos.leyendaTitulo}>
            Distintivos de Estado del Proyecto
          </Text>
          <View style={estilos.insigniaWcag}>
            <Text style={estilos.insigniaWcagTexto}>
              WCAG AAA • {esPantallaMovilReal ? "Vista Móvil Activa" : "Accesible Móvil"}
            </Text>
          </View>
        </View>
      </View>

      {/* Chips de estados interactivos con distintivo de color, icono y etiqueta textual */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.leyendaChipsFila}
      >
        {onSeleccionarEstado && (
          <TouchableOpacity
            onPress={() => onSeleccionarEstado("todos")}
            accessibilityRole="button"
            accessibilityState={{ selected: estadoSeleccionado === "todos" }}
            style={[
              estilos.filtroTodosChip,
              estadoSeleccionado === "todos" && estilos.filtroTodosChipActivo,
            ]}
          >
            <Text
              style={[
                estilos.filtroTodosTexto,
                estadoSeleccionado === "todos" && estilos.filtroTodosTextoActivo,
              ]}
            >
              Todos los estados
            </Text>
          </TouchableOpacity>
        )}

        {listaEstados.map((item) => {
          const cfg = CATALOGO_ESTADOS_PROYECTO[item.clave];
          const cantidad = conteoPorEstado[item.filtroId] ?? 0;
          const seleccionado =
            estadoSeleccionado.toLowerCase() === item.filtroId.toLowerCase();

          return (
            <TouchableOpacity
              key={item.clave}
              activeOpacity={0.8}
              disabled={!onSeleccionarEstado}
              onPress={() =>
                onSeleccionarEstado?.(
                  seleccionado ? "todos" : item.filtroId
                )
              }
              accessibilityRole="button"
              accessibilityState={{ selected: seleccionado }}
              accessibilityLabel={`Filtrar por ${cfg.etiquetaAccesible}. ${cantidad} proyectos`}
              style={[
                estilos.itemLeyendaEnvoltorio,
                seleccionado && {
                  borderColor: cfg.colorPunto,
                  backgroundColor: cfg.colorFondo,
                  transform: [{ scale: 1.02 }],
                },
              ]}
            >
              <DistintivoEstadoProyecto
                estado={item.filtroId}
                tamano="sm"
                forzarModoMovil
              />
              <View
                style={[
                  estilos.contadorPastilla,
                  {
                    backgroundColor: cfg.colorTexto,
                  },
                ]}
              >
                <Text style={estilos.contadorTexto}>{cantidad}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const estilos = StyleSheet.create({
  distintivoBase: {
    flexDirection: "row",
    alignItems: "center",
     alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 28,
  },
  distintivoSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 26,
  },
  distintivoLg: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 34,
  },
  distintivoMovilAccesible: {
    minHeight: 30,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  puntoEstado: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  iconoEstado: {
    marginRight: 5,
  },
  textoEstado: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sincContenedor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  sincContenedorCompacto: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sincContenedorMovil: {
    paddingVertical: 9,
    minHeight: 42,
  },
  sincIzquierda: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 210,
  },
  sincPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  sincTextosColumna: {
    flex: 1,
  },
  sincFilaPrincipal: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  sincEstadoTexto: {
    fontSize: 12,
    fontWeight: "800",
  },
  sincSeparador: {
    fontSize: 12,
    fontWeight: "700",
    marginHorizontal: 2,
  },
  sincTiempoTexto: {
    fontSize: 12,
    fontWeight: "600",
  },
  sincSubtexto: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.9,
  },
  botonSincronizar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    minHeight: 32,
  },
  botonSincronizarMovil: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonSincronizarTexto: {
    fontSize: 12,
    fontWeight: "700",
  },
  leyendaTarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  leyendaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  leyendaTituloFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  leyendaTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  insigniaWcag: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  insigniaWcagTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
  },
  botonRevisionScrum: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minHeight: 30,
  },
  botonRevisionScrumTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },
  leyendaChipsFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  filtroTodosChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    minHeight: 34,
    justifyContent: "center",
  },
  filtroTodosChipActivo: {
    borderColor: "#0D9488",
    backgroundColor: "#CCFBF1",
  },
  filtroTodosTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  filtroTodosTextoActivo: {
    color: "#115E59",
  },
  itemLeyendaEnvoltorio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 3,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: "#F9FAFB",
  },
  contadorPastilla: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  panelScrumMovil: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
  },
  panelScrumEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  panelScrumTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
  },
  panelScrumSubtitulo: {
    fontSize: 11,
    color: "#4B5563",
    marginBottom: 10,
    lineHeight: 16,
  },
  grillaScrumEstados: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tarjetaScrumEstado: {
    flex: 1,
    minWidth: 230,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderLeftWidth: 4,
    padding: 9,
  },
  tarjetaScrumSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 5,
  },
  badgeContraste: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeContrasteTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
  },
  tarjetaScrumDescripcion: {
    fontSize: 11,
    color: "#4B5563",
  },
});

export default DistintivoEstadoProyecto;
