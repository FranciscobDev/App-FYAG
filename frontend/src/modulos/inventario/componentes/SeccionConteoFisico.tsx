// Pantallas de inicio/ingreso de Conteo Físico para Bodeguero y Bandeja de Aprobación
// de ajustes mayores al umbral del 5 % para el Administrador, con acceso directo al Cardex.
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Boton,
  CampoBusqueda,
  EstadoVacio,
  Insignia,
  Tarjeta,
} from "@/componentes/comunes";
import { ConteoFisico, Producto, Rol } from "@/nucleo/tipos";

export interface UltimoResultadoConteo {
  sku: string;
  productName: string;
  diferencia: number;
  diferenciaPct: number;
  requiereAprobacion: boolean;
}

export interface PropiedadesSeccionConteoFisico {
  activoPestana: string;
  aprobarConteoFisico: (id: string, approverName: string) => void;
  conteosFisicos: ConteoFisico[];
  manejarAbrirConteoModal: () => void;
  manejarEscanearParaConteo?: () => void;
  mermaSku?: string;
  mostrarAviso: (mensaje: string) => void;
  onIrACardex?: (sku: string) => void;
  productos: Producto[];
  rechazarConteoFisico: (id: string, approverName: string) => void;
  rolActual: Rol;
  ultimoResultadoConteo?: UltimoResultadoConteo | null;
  onCerrarUltimoResultado?: () => void;
  usuario: { name: string };
  width?: number;
}

type FiltroEstadoConteo =
  | "pendiente_aprobacion"
  | "todos"
  | "ajustado_directo"
  | "aprobado"
  | "rechazado";

export const SeccionConteoFisico: React.FC<PropiedadesSeccionConteoFisico> = ({
  activoPestana,
  aprobarConteoFisico,
  conteosFisicos,
  manejarAbrirConteoModal,
  manejarEscanearParaConteo,
  mostrarAviso,
  onIrACardex,
  productos,
  rechazarConteoFisico,
  rolActual,
  ultimoResultadoConteo,
  onCerrarUltimoResultado,
  usuario,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const [busqueda, establecerBusqueda] = useState("");
  const [filtroEstado, establecerFiltroEstado] = useState<FiltroEstadoConteo>(
    rolActual === "admin" ? "pendiente_aprobacion" : "todos"
  );

  // Métricas del dashboard de conteos físicos
  const metricas = useMemo(() => {
    const pendientes = conteosFisicos.filter((c) => c.status === "pendiente_aprobacion");
    const directos = conteosFisicos.filter((c) => c.status === "ajustado_directo");
    const aprobados = conteosFisicos.filter((c) => c.status === "aprobado");
    const rechazados = conteosFisicos.filter((c) => c.status === "rechazado");
    const impactoPendiente = pendientes.reduce(
      (acc, c) => acc + Math.abs(Number(c.differenceValue || 0)),
      0
    );

    return {
      pendientesConteo: pendientes.length,
      directosConteo: directos.length,
      aprobadosConteo: aprobados.length,
      rechazadosConteo: rechazados.length,
      impactoPendiente: Math.round(impactoPendiente),
    };
  }, [conteosFisicos]);

  // Listado filtrado de conteos físicos
  const conteosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conteosFisicos.filter((c) => {
      if (filtroEstado !== "todos" && c.status !== filtroEstado) return false;
      if (q) {
        const coincideSku = c.sku.toLowerCase().includes(q);
        const coincideNombre = c.productName.toLowerCase().includes(q);
        const coincideUsuario = (c.counterUser || "").toLowerCase().includes(q);
        if (!coincideSku && !coincideNombre && !coincideUsuario) return false;
      }
      return true;
    });
  }, [conteosFisicos, filtroEstado, busqueda]);

  const hayInsumosBloqueados = useMemo(
    () =>
      productos.some((p) =>
        conteosFisicos.some((c) => c.sku === p.sku && c.status === "pendiente_aprobacion")
      ),
    [productos, conteosFisicos]
  );

  if (activoPestana !== "conteo") return null;

  return (
    <ScrollView
      style={estilosLocales.contenedor}
      contentContainerStyle={estilosLocales.contenidoScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilosLocales.contenedorCentrado}>
        {/* 1. BANNER VISUAL INMEDIATO DEL RESULTADO DEL ÚLTIMO CONTEO (DIRECTO ≤ 5% VS RETENIDO > 5%) */}
        {ultimoResultadoConteo && (
          <View
            style={[
              estilosLocales.resultadoBanner,
              ultimoResultadoConteo.requiereAprobacion
                ? estilosLocales.resultadoBannerRetenido
                : estilosLocales.resultadoBannerDirecto,
            ]}
          >
            <View style={estilosLocales.resultadoTop}>
              <Ionicons
                name={
                  ultimoResultadoConteo.requiereAprobacion
                    ? "lock-closed"
                    : "checkmark-circle"
                }
                size={22}
                color={
                  ultimoResultadoConteo.requiereAprobacion
                    ? tema.colors.warnDark
                    : tema.colors.ok
                }
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    estilosLocales.resultadoTitulo,
                    {
                      color: ultimoResultadoConteo.requiereAprobacion
                        ? tema.colors.warnDark
                        : tema.colors.okDark,
                    },
                  ]}
                >
                  {ultimoResultadoConteo.requiereAprobacion
                    ? `Ajuste RETENIDO por superar el umbral del 5 % (${ultimoResultadoConteo.diferenciaPct.toFixed(1)}%)`
                    : `Ajuste DIRECTO aplicado en bodega (≤ 5 %: ${ultimoResultadoConteo.diferenciaPct.toFixed(1)}%)`}
                </Text>
                <Text style={estilosLocales.resultadoSub}>
                  {ultimoResultadoConteo.requiereAprobacion
                    ? `${ultimoResultadoConteo.sku} (${ultimoResultadoConteo.productName}) quedó bloqueado preventivamente y enviado a la bandeja de aprobación del Administrador.`
                    : `${ultimoResultadoConteo.sku} (${ultimoResultadoConteo.productName}) ajustado automáticamente en stock y registrado en el Cardex.`}
                </Text>
              </View>
              {onCerrarUltimoResultado && (
                <TouchableOpacity onPress={onCerrarUltimoResultado} style={{ padding: 4 }}>
                  <Ionicons name="close" size={16} color={tema.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {!ultimoResultadoConteo.requiereAprobacion && onIrACardex && (
              <View style={{ alignItems: "flex-start" }}>
                <Boton
                  title="Ver movimiento de ajuste en Cardex"
                  variant="outline"
                  size="sm"
                  icon="swap-horizontal-outline"
                  onPress={() => onIrACardex(ultimoResultadoConteo.sku)}
                />
              </View>
            )}
          </View>
        )}

        {/* 2. CABECERA COMPACTA INDUSTRIAL + IMPACTO RETENIDO EN VIVO */}
        <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
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
                <Ionicons name="calculator-outline" size={20} color={tema.colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                  {rolActual === "admin"
                    ? "Auditoría de Conteos (Umbral 5 %)"
                    : "Conteo Físico de Bodega"}
                </Text>
                <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                  Impacto retenido (&gt; 5%):{" "}
                  <Text
                    style={{
                      fontWeight: "800",
                      color:
                        metricas.impactoPendiente > 0
                          ? tema.colors.danger
                          : tema.colors.okDark,
                    }}
                  >
                    {formatearCLP(metricas.impactoPendiente)}
                  </Text>{" "}
                  ({metricas.pendientesConteo} por aprobar)
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", width: esMovilEstrecho ? "100%" : undefined }}>
              {manejarEscanearParaConteo && (
                <Boton
                  title="Escanear QR"
                  variant="outline"
                  size="sm"
                  icon="qr-code-outline"
                  onPress={manejarEscanearParaConteo}
                  style={[{ minHeight: 40, backgroundColor: "#ffffff" }, esMovilEstrecho && { flex: 1 }]}
                />
              )}
              <Boton
                title="Nuevo Conteo"
                variant="primary"
                size="sm"
                icon="calculator-outline"
                onPress={manejarAbrirConteoModal}
                style={[{ minHeight: 40 }, esMovilEstrecho && { flex: 1.2 }]}
              />
            </View>
          </View>

          {hayInsumosBloqueados && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#fef2f2",
                borderWidth: 1,
                borderColor: "#fca5a5",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginTop: 10,
              }}
            >
              <Ionicons name="lock-closed" size={14} color="#dc2626" />
              <Text style={{ fontSize: 11, color: "#991b1b", fontWeight: "600", flex: 1 }}>
                Insumos con diferencia &gt; 5 % permanecen bloqueados para despacho hasta resolución de Admin.
              </Text>
            </View>
          )}
        </Tarjeta>

        {/* 3. GRILLA 2x2 DE PESTAÑAS KPI INTERACTIVAS (FILTRAN CON 1 TOQUE, SIN CHIPS DUPLICADOS) */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            {
              id: "pendiente_aprobacion" as FiltroEstadoConteo,
              titulo: "Retenidos (> 5%)",
              valor: metricas.pendientesConteo,
              sub: "Pendientes Admin",
              icon: "lock-closed-outline" as const,
              bg: "#fffbeb",
              border: "#fcd34d",
              borderActivo: "#d97706",
              textColor: "#92400e",
            },
            {
              id: "ajustado_directo" as FiltroEstadoConteo,
              titulo: "Directos (≤ 5%)",
              valor: metricas.directosConteo,
              sub: "Aplicados OK",
              icon: "flash-outline" as const,
              bg: "#f0fdf4",
              border: "#86efac",
              borderActivo: "#16a34a",
              textColor: "#166534",
            },
            {
              id: "aprobado" as FiltroEstadoConteo,
              titulo: "Aprobados Admin",
              valor: metricas.aprobadosConteo,
              sub: "En Cardex",
              icon: "checkmark-done-circle-outline" as const,
              bg: "#f0fdf4",
              border: "#86efac",
              borderActivo: "#15803d",
              textColor: "#166534",
            },
            {
              id: "todos" as FiltroEstadoConteo,
              titulo: "Todos",
              valor: conteosFisicos.length,
              sub:
                metricas.rechazadosConteo > 0
                  ? `${metricas.rechazadosConteo} rechazado(s)`
                  : "Historial total",
              icon: "layers-outline" as const,
              bg: "#f1f5f9",
              border: "#cbd5e1",
              borderActivo: "#334155",
              textColor: "#0f172a",
            },
          ].map((kpi) => {
            const activo = filtroEstado === kpi.id;
            return (
              <TouchableOpacity
                key={kpi.id}
                activeOpacity={0.8}
                onPress={() => establecerFiltroEstado(kpi.id)}
                style={{
                  flexBasis: "48%",
                  flexGrow: 1,
                  minWidth: 140,
                  backgroundColor: kpi.bg,
                  borderWidth: activo ? 2 : 1,
                  borderColor: activo ? kpi.borderActivo : kpi.border,
                  borderLeftWidth: 5,
                  borderLeftColor: kpi.borderActivo,
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
                      color: kpi.textColor,
                      textTransform: "uppercase",
                    }}
                    numberOfLines={1}
                  >
                    {kpi.titulo}
                  </Text>
                  <Ionicons name={kpi.icon} size={15} color={kpi.textColor} />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginTop: 2,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                    {kpi.valor}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: activo ? "800" : "600",
                      color: kpi.textColor,
                    }}
                    numberOfLines={1}
                  >
                    {activo ? "● Vista activa" : kpi.sub}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. BUSCADOR COMPACTO */}
        <View style={estilosLocales.filtrosBloque}>
          <CampoBusqueda
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar por SKU, nombre de insumo o auditor..."
          />

          {(metricas.rechazadosConteo > 0 || filtroEstado === "rechazado") && (
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                onPress={() =>
                  establecerFiltroEstado(
                    filtroEstado === "rechazado" ? "pendiente_aprobacion" : "rechazado"
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: filtroEstado === "rechazado" ? "#fef2f2" : "#ffffff",
                  borderWidth: 1,
                  borderColor: "#fca5a5",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>
                  {filtroEstado === "rechazado"
                    ? `Viendo Rechazados (${metricas.rechazadosConteo}) • Toca para volver`
                    : `Ver Conteos Rechazados (${metricas.rechazadosConteo})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. LISTADO / BANDEJA RESPONSIVA DE CONTEOS FÍSICOS CON SEMÁFORO DE SUPERFICIE */}
        {conteosFiltrados.length === 0 ? (
          <EstadoVacio
            icon="checkbox-outline"
            title="Sin conteos en esta vista"
            description={
              filtroEstado === "pendiente_aprobacion"
                ? "No hay ajustes mayores al 5 % pendientes de aprobación por el Administrador."
                : "No se encontraron registros de conteo físico para los filtros actuales."
            }
            actionTitle={filtroEstado !== "todos" ? "Ver todos los conteos" : undefined}
            onAction={filtroEstado !== "todos" ? () => establecerFiltroEstado("todos") : undefined}
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          <View
            style={[
              estilosLocales.tarjetasGrilla,
              esPantallaAncha && estilosLocales.tarjetasGrillaAncha,
            ]}
          >
            {conteosFiltrados.map((c) => {
              const esPendiente = c.status === "pendiente_aprobacion";
              const esDirecto = c.status === "ajustado_directo";
              const esAprobado = c.status === "aprobado";
              const esRechazado = c.status === "rechazado";
              const superoUmbral = Math.abs(c.differencePct) > 5;

              const fondoSem = esPendiente
                ? "#fffbeb"
                : esRechazado
                ? "#fef2f2"
                : "#f0fdf4";
              const bordeSem = esPendiente
                ? "#fcd34d"
                : esRechazado
                ? "#fca5a5"
                : "#86efac";
              const franjaSem = esPendiente
                ? "#d97706"
                : esRechazado
                ? "#dc2626"
                : "#16a34a";

              return (
                <Tarjeta
                  key={c.id}
                  variant="outlined"
                  style={[
                    {
                      padding: 12,
                      gap: 10,
                      backgroundColor: fondoSem,
                      borderColor: bordeSem,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: franjaSem,
                      borderRadius: 12,
                    },
                    esPantallaAncha && estilosLocales.conteoTarjetaAncha,
                  ]}
                >
                  <View style={estilosLocales.tarjetaTop}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={estilosLocales.skuTexto}>{c.sku}</Text>
                      <Text style={[estilosLocales.nombreTexto, { fontSize: 15 }]}>
                        {c.productName}
                      </Text>
                      <Text style={estilosLocales.metaTexto}>
                        👤 Auditor: {c.counterUser} • 📅 {formatearFecha(c.date)}
                      </Text>
                    </View>

                    <Insignia
                      label={
                        esPendiente
                          ? "Retenido > 5%"
                          : esDirecto
                          ? "Directo ≤ 5%"
                          : esAprobado
                          ? "Aprobado Admin"
                          : "Rechazado"
                      }
                      tone={
                        esPendiente
                          ? "warn"
                          : esRechazado
                          ? "danger"
                          : "ok"
                      }
                      icon={
                        esPendiente
                          ? "lock-closed-outline"
                          : esRechazado
                          ? "close-circle-outline"
                          : "checkmark-circle-outline"
                      }
                      size="sm"
                    />
                  </View>

                  {/* Grilla comparativa compacta en 1 sola fila de 4 columnas */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: bordeSem,
                      borderRadius: 9,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Sistema
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text, marginTop: 1 }}>
                        {c.systemStock}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Físico
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: tema.colors.text, marginTop: 1 }}>
                        {c.countedStock}
                      </Text>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Diferencia
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "900",
                          color: superoUmbral ? tema.colors.danger : tema.colors.okDark,
                          marginTop: 1,
                        }}
                      >
                        {c.difference > 0 ? `+${c.difference}` : c.difference} ({c.differencePct.toFixed(1)}%)
                      </Text>
                    </View>

                    <View style={{ flex: 1.1, alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: tema.colors.textMuted, textTransform: "uppercase" }}>
                        Impacto CLP
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "900",
                          color: c.differenceValue !== 0 ? tema.colors.danger : tema.colors.text,
                          marginTop: 1,
                        }}
                      >
                        {formatearCLP(c.differenceValue)}
                      </Text>
                    </View>
                  </View>

                  {Boolean(c.notes) && (
                    <Text style={[estilosLocales.notasTexto, { marginTop: -2 }]}>
                      💬 &ldquo;{c.notes}&rdquo;
                    </Text>
                  )}

                  {Boolean(c.approverUser) && (
                    <Text style={estilosLocales.aprobadorTexto}>
                      Resuelto por: <Text style={{ fontWeight: "700" }}>{c.approverUser}</Text>
                    </Text>
                  )}

                  {/* Acciones de Administrador en bandeja de pendientes (> 5%) */}
                  {esPendiente && rolActual === "admin" && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        marginTop: 2,
                      }}
                    >
                      <Boton
                        title="Rechazar"
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        onPress={() => {
                          rechazarConteoFisico(c.id, usuario.name);
                          mostrarAviso(`Conteo de ${c.sku} rechazado. Insumo desbloqueado.`);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 38,
                          borderColor: tema.colors.danger,
                          backgroundColor: "#ffffff",
                        }}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar en Cardex"
                        variant="success"
                        size="sm"
                        icon="checkmark-done-outline"
                        onPress={() => {
                          aprobarConteoFisico(c.id, usuario.name);
                          mostrarAviso(
                            `Ajuste de ${c.sku} aprobado por ${usuario.name} y registrado en el Cardex.`
                          );
                        }}
                        style={{ flex: 1.5, minHeight: 38 }}
                      />
                    </View>
                  )}

                  {/* Aviso para Bodeguero cuando el conteo está retenido esperando Admin */}
                  {esPendiente && rolActual !== "admin" && (
                    <View style={estilosLocales.esperaAdminBanner}>
                      <Ionicons name="time-outline" size={15} color={tema.colors.warnDark} />
                      <Text style={estilosLocales.esperaAdminTexto}>
                        Retenido por superar el 5 % — Esperando aprobación del Administrador.
                      </Text>
                    </View>
                  )}

                  {(esDirecto || esAprobado) && onIrACardex && (
                    <View style={estilosLocales.pieCardexFila}>
                      <Boton
                        title="Verificar ajuste en Cardex"
                        variant="outline"
                        size="sm"
                        icon="swap-horizontal-outline"
                        onPress={() => onIrACardex(c.sku)}
                        style={{ minHeight: 34, backgroundColor: "#ffffff" }}
                      />
                    </View>
                  )}
                </Tarjeta>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const estilosLocales = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenidoScroll: {
    padding: tema.spacing.md,
    paddingBottom: 44,
  },
  contenedorCentrado: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    gap: 14,
  },
  resultadoBanner: {
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  resultadoBannerDirecto: {
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.ok,
  },
  resultadoBannerRetenido: {
    backgroundColor: tema.colors.warnLight,
    borderColor: tema.colors.warn,
  },
  resultadoTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  resultadoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
  },
  resultadoSub: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  heroTarjeta: {
    padding: 16,
  },
  heroContenido: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  heroInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  heroTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  heroDescripcion: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  heroAcciones: {
    minWidth: 210,
  },
  kpiGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCaja: {
    flex: 1,
    minWidth: 140,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  kpiCajaMovil: {
    minWidth: "46%",
  },
  kpiLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  kpiVal: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  bloqueoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: tema.radius.md,
    padding: 12,
  },
  bloqueoTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#991b1b",
  },
  bloqueoTexto: {
    fontSize: 11,
    color: "#7f1d1d",
    marginTop: 2,
    lineHeight: 16,
  },
  filtrosBloque: {
    gap: 10,
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
  },
  filtroChipActivo: {
    backgroundColor: "#0f172a",
    borderColor: tema.colors.primary,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.textSecondary,
  },
  filtroChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  tarjetasGrilla: {
    gap: 12,
  },
  tarjetasGrillaAncha: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  conteoTarjeta: {
    padding: 14,
    gap: 10,
  },
  conteoTarjetaAncha: {
    width: "48.8%",
  },
  conteoTarjetaPendiente: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.warn,
  },
  tarjetaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  skuTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  nombreTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  metaTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  comparativaGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.sm,
    padding: 10,
  },
  comparativaCelda: {
    flex: 1,
    minWidth: 95,
  },
  celdaLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  celdaVal: {
    fontSize: 13,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  notasTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontStyle: "italic",
  },
  aprobadorTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  accionesFila: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
  esperaAdminBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.warnLight,
    borderRadius: tema.radius.sm,
    padding: 8,
  },
  esperaAdminTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
  },
  pieCardexFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
  },
});
