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

        {/* 2. HERO CARD ADAPTADO POR ROL (BODEGUERO VS ADMINISTRADOR) */}
        <Tarjeta variant="elevated" style={estilosLocales.heroTarjeta}>
          <View style={estilosLocales.heroContenido}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <View style={estilosLocales.heroInsigniaFila}>
                <Insignia
                  label={
                    rolActual === "admin"
                      ? "Bandeja de Aprobación Admin"
                      : "Conteo Físico Bodeguero"
                  }
                  tone="primary"
                  size="sm"
                />
                <Insignia label="Umbral: 5 %" tone="info" size="sm" />
              </View>

              <Text style={estilosLocales.heroTitulo}>
                {rolActual === "admin"
                  ? "Aprobación de Ajustes Mayores al 5 %"
                  : "Iniciar e Ingresar Conteo Físico de Stock"}
              </Text>
              <Text style={estilosLocales.heroDescripcion}>
                {rolActual === "admin"
                  ? "Revisa y aprueba o rechaza las diferencias de inventario retenidas por superar el umbral del 5 %. Al aprobar, el ajuste impacta el stock y genera el movimiento en el Cardex."
                  : "Audita existencias reales en estantería. Si la diferencia es ≤ 5 % el ajuste se aplica directo al stock y Cardex; si supera el 5 % queda retenido para aprobación del Administrador."}
              </Text>
            </View>

            <View style={[estilosLocales.heroAcciones, { flexDirection: "row", flexWrap: "wrap", gap: 8 }]}>
              {manejarEscanearParaConteo && (
                <Boton
                  title="Escanear QR / Barras"
                  variant="secondary"
                  size="md"
                  icon="qr-code-outline"
                  onPress={manejarEscanearParaConteo}
                  style={{ minHeight: 46 }}
                  fullWidth={esMovilEstrecho}
                />
              )}
              <Boton
                title="+ Iniciar Nuevo Conteo Físico"
                variant="primary"
                size="md"
                icon="calculator-outline"
                onPress={manejarAbrirConteoModal}
                style={{ minHeight: 46 }}
                fullWidth={esMovilEstrecho}
              />
            </View>
          </View>
        </Tarjeta>

        {/* 3. DASHBOARD RESPONSIVO DE 4 KPIs */}
        <View style={estilosLocales.kpiGrilla}>
          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              metricas.pendientesConteo > 0 && {
                backgroundColor: tema.colors.warnLight,
                borderColor: tema.colors.warnBorder,
              },
            ]}
          >
            <Text
              style={[
                estilosLocales.kpiLbl,
                metricas.pendientesConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              Retenidos (&gt; 5 %)
            </Text>
            <Text
              style={[
                estilosLocales.kpiVal,
                metricas.pendientesConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              {metricas.pendientesConteo}
            </Text>
            <Text
              style={[
                estilosLocales.kpiSub,
                metricas.pendientesConteo > 0 && { color: tema.colors.warnDark },
              ]}
            >
              Pendientes de Admin
            </Text>
          </View>

          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text style={[estilosLocales.kpiLbl, { color: tema.colors.okDark }]}>
              Ajuste Directo (≤ 5 %)
            </Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.okDark }]}>
              {metricas.directosConteo}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.okDark }]}>
              Aplicados en Cardex
            </Text>
          </View>

          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              { backgroundColor: tema.colors.primaryLight, borderColor: "#fde68a" },
            ]}
          >
            <Text style={[estilosLocales.kpiLbl, { color: tema.colors.primaryDark }]}>
              Aprobados Admin
            </Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.primaryDark }]}>
              {metricas.aprobadosConteo}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.primaryDark }]}>
              Ajustados en Cardex
            </Text>
          </View>

          <View style={[estilosLocales.kpiCaja, esMovilEstrecho && estilosLocales.kpiCajaMovil]}>
            <Text style={estilosLocales.kpiLbl}>Impacto Pendiente</Text>
            <Text
              style={[
                estilosLocales.kpiVal,
                metricas.impactoPendiente > 0 && { color: tema.colors.danger },
              ]}
            >
              {formatearCLP(metricas.impactoPendiente)}
            </Text>
            <Text style={estilosLocales.kpiSub}>Valorización retenida</Text>
          </View>
        </View>

        {/* 4. ALERTA DE INSUMOS BLOQUEADOS EN AUDITORÍA */}
        {hayInsumosBloqueados && (
          <View style={estilosLocales.bloqueoBanner}>
            <Ionicons name="lock-closed" size={18} color="#991b1b" />
            <View style={{ flex: 1 }}>
              <Text style={estilosLocales.bloqueoTitulo}>
                Insumos retenidos y bloqueados preventivamente (&gt; 5 %)
              </Text>
              <Text style={estilosLocales.bloqueoTexto}>
                Los insumos con conteos pendientes de aprobación administrativa permanecen
                bloqueados para despachos hasta ser aprobados o rechazados.
              </Text>
            </View>
          </View>
        )}

        {/* 5. BUSCADOR Y FILTROS DINÁMICOS */}
        <View style={estilosLocales.filtrosBloque}>
          <CampoBusqueda
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar por SKU, nombre de insumo o auditor..."
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(
              [
                {
                  id: "pendiente_aprobacion",
                  label: `Retenidos > 5% (${metricas.pendientesConteo})`,
                },
                { id: "todos", label: `Todos (${conteosFisicos.length})` },
                {
                  id: "ajustado_directo",
                  label: `Ajuste Directo ≤ 5% (${metricas.directosConteo})`,
                },
                { id: "aprobado", label: `Aprobados (${metricas.aprobadosConteo})` },
                { id: "rechazado", label: `Rechazados (${metricas.rechazadosConteo})` },
              ] as const
            ).map((chip) => {
              const activo = filtroEstado === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  onPress={() => establecerFiltroEstado(chip.id)}
                  style={[estilosLocales.filtroChip, activo && estilosLocales.filtroChipActivo]}
                >
                  <Text
                    style={[
                      estilosLocales.filtroChipTexto,
                      activo && estilosLocales.filtroChipTextoActivo,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 6. LISTADO / BANDEJA RESPONSIVA DE CONTEOS FÍSICOS */}
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

              return (
                <Tarjeta
                  key={c.id}
                  variant={esPendiente ? "elevated" : "outlined"}
                  style={[
                    estilosLocales.conteoTarjeta,
                    esPantallaAncha && estilosLocales.conteoTarjetaAncha,
                    esPendiente && estilosLocales.conteoTarjetaPendiente,
                  ]}
                >
                  <View style={estilosLocales.tarjetaTop}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={estilosLocales.skuTexto}>{c.sku}</Text>
                      <Text style={estilosLocales.nombreTexto}>{c.productName}</Text>
                      <Text style={estilosLocales.metaTexto}>
                        Auditor: {c.counterUser} • {formatearFecha(c.date)}
                      </Text>
                    </View>

                    <Insignia
                      label={
                        esPendiente
                          ? "Retenido > 5%"
                          : esDirecto
                          ? "Ajuste Directo ≤ 5%"
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

                  {/* Grilla comparativa: Sistema vs Conteo Físico vs Diferencia vs Valor */}
                  <View style={estilosLocales.comparativaGrilla}>
                    <View style={estilosLocales.comparativaCelda}>
                      <Text style={estilosLocales.celdaLbl}>Stock Sistema</Text>
                      <Text style={estilosLocales.celdaVal}>{c.systemStock}</Text>
                    </View>
                    <View style={estilosLocales.comparativaCelda}>
                      <Text style={estilosLocales.celdaLbl}>Conteo Físico</Text>
                      <Text style={estilosLocales.celdaVal}>{c.countedStock}</Text>
                    </View>
                    <View style={estilosLocales.comparativaCelda}>
                      <Text style={estilosLocales.celdaLbl}>Diferencia</Text>
                      <Text
                        style={[
                          estilosLocales.celdaVal,
                          {
                            color: superoUmbral ? tema.colors.danger : tema.colors.okDark,
                          },
                        ]}
                      >
                        {c.difference > 0 ? `+${c.difference}` : c.difference} (
                        {c.differencePct.toFixed(1)}%)
                      </Text>
                    </View>
                    <View style={estilosLocales.comparativaCelda}>
                      <Text style={estilosLocales.celdaLbl}>Impacto CLP</Text>
                      <Text
                        style={[
                          estilosLocales.celdaVal,
                          {
                            color:
                              c.differenceValue !== 0 ? tema.colors.danger : tema.colors.text,
                          },
                        ]}
                      >
                        {formatearCLP(c.differenceValue)}
                      </Text>
                    </View>
                  </View>

                  {Boolean(c.notes) && (
                    <Text style={estilosLocales.notasTexto}>Nota: "{c.notes}"</Text>
                  )}

                  {Boolean(c.approverUser) && (
                    <Text style={estilosLocales.aprobadorTexto}>
                      Resuelto por: <Text style={{ fontWeight: "700" }}>{c.approverUser}</Text>
                    </Text>
                  )}

                  {/* Acciones de Administrador en bandeja de pendientes (> 5%) */}
                  {esPendiente && rolActual === "admin" && (
                    <View
                      style={[
                        estilosLocales.accionesFila,
                        esMovilEstrecho && { flexDirection: "column" },
                      ]}
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
                          minHeight: 42,
                          borderColor: tema.colors.danger,
                        }}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar Ajuste en Cardex"
                        variant="success"
                        size="sm"
                        icon="checkmark-done-outline"
                        onPress={() => {
                          aprobarConteoFisico(c.id, usuario.name);
                          mostrarAviso(
                            `Ajuste de ${c.sku} aprobado por ${usuario.name} y registrado en el Cardex.`
                          );
                        }}
                        style={{ flex: 1.5, minHeight: 42 }}
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

                  {/* Botón rápido para verificar el movimiento de ajuste en el Cardex [SCRUM] */}
                  {(esDirecto || esAprobado) && onIrACardex && (
                    <View style={estilosLocales.pieCardexFila}>
                      <Boton
                        title="Verificar ajuste en Cardex"
                        variant="outline"
                        size="sm"
                        icon="swap-horizontal-outline"
                        onPress={() => onIrACardex(c.sku)}
                        style={{ minHeight: 38 }}
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
    backgroundColor: "#1c1917",
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
