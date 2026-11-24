// Interfaz responsiva de Devoluciones a Proveedor:
// - Bodeguero: emisión de devolución desde cuarentena con Guía de Despacho.
// - Administrador: panel de seguimiento y cierre administrativo (Nota de Crédito / Reposición / Reembolso).
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
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Insignia } from "@/componentes/base/Insignia";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { DevolucionProveedor, Rol } from "@/nucleo/tipos";

export interface PropiedadesSeccionDevolucionesProveedor {
  activoPestana: string;
  avisoProveedor?: string;
  cuarentenaConteo?: number;
  devolucionesProveedor: DevolucionProveedor[];
  establecerNuevoProveedorDevolucionModal: (visible: boolean) => void;
  establecerResolverDevolucionModal: (dev: DevolucionProveedor | null) => void;
  establecerResolverNotas: (notas: string) => void;
  establecerResolverTipo: (tipo: "nota_credito" | "reemplazo_producto" | "reembolso") => void;
  establecerSupRetError: (err: string) => void;
  onCerrarAvisoProveedor?: () => void;
  onAbrirModalNuevaDevolucion?: () => void;
  rolActual: Rol;
  width?: number;
}

type FiltroEstadoProveedor = "pendiente_resolucion" | "todas" | "resuelta";

export const SeccionDevolucionesProveedor: React.FC<
  PropiedadesSeccionDevolucionesProveedor
> = ({
  activoPestana,
  avisoProveedor,
  cuarentenaConteo = 0,
  devolucionesProveedor,
  establecerNuevoProveedorDevolucionModal,
  establecerResolverDevolucionModal,
  establecerResolverNotas,
  establecerResolverTipo,
  establecerSupRetError,
  onCerrarAvisoProveedor,
  onAbrirModalNuevaDevolucion,
  rolActual,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const esPantallaAncha = width >= 840;

  const [busqueda, establecerBusqueda] = useState("");
  const [filtroEstado, establecerFiltroEstado] = useState<FiltroEstadoProveedor>(
    rolActual === "admin" ? "pendiente_resolucion" : "todas"
  );

  // Métricas del dashboard de garantías y devoluciones a proveedor
  const metricas = useMemo(() => {
    const pendientes = devolucionesProveedor.filter((s) => s.status === "pendiente_resolucion");
    const resueltas = devolucionesProveedor.filter((s) => s.status === "resuelta");
    const porNotaCredito = resueltas.filter((s) => s.resolutionType === "nota_credito").length;
    const porReposicion = resueltas.filter(
      (s) => s.resolutionType === "reemplazo_producto" || s.resolutionType === "reembolso"
    ).length;

    return {
      pendientesConteo: pendientes.length,
      resueltasConteo: resueltas.length,
      porNotaCredito,
      porReposicion,
    };
  }, [devolucionesProveedor]);

  // Filtrado dinámico priorizando las pendientes de resolución
  const devolucionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = devolucionesProveedor.filter((s) => {
      if (filtroEstado !== "todas" && s.status !== filtroEstado) return false;
      if (q) {
        const coincideCodigo = s.code.toLowerCase().includes(q);
        const coincideProveedor =
          s.supplierName.toLowerCase().includes(q) ||
          (s.supplierRut || "").toLowerCase().includes(q);
        const coincideGuia = s.dispatchGuideNumber.toLowerCase().includes(q);
        const coincideProducto =
          s.productName.toLowerCase().includes(q) || s.productSku.toLowerCase().includes(q);
        if (!coincideCodigo && !coincideProveedor && !coincideGuia && !coincideProducto) {
          return false;
        }
      }
      return true;
    });

    return [...lista].sort((a, b) => {
      if (a.status === "pendiente_resolucion" && b.status !== "pendiente_resolucion") return -1;
      if (a.status !== "pendiente_resolucion" && b.status === "pendiente_resolucion") return 1;
      return b.date.localeCompare(a.date);
    });
  }, [devolucionesProveedor, filtroEstado, busqueda]);

  const abrirEmision = () => {
    if (onAbrirModalNuevaDevolucion) {
      onAbrirModalNuevaDevolucion();
    } else {
      establecerSupRetError("");
      establecerNuevoProveedorDevolucionModal(true);
    }
  };

  if (activoPestana !== "proveedores") return null;

  return (
    <ScrollView
      style={estilosLocales.contenedor}
      contentContainerStyle={estilosLocales.contenidoScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilosLocales.contenedorCentrado}>
        {/* AVISO DE EMISIÓN O CIERRE EXITOSO */}
        {Boolean(avisoProveedor) && (
          <View style={estilosLocales.avisoExitoBanner}>
            <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} />
            <Text style={estilosLocales.avisoExitoTexto}>{avisoProveedor}</Text>
            {onCerrarAvisoProveedor && (
              <TouchableOpacity onPress={onCerrarAvisoProveedor} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={tema.colors.okDark} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 1. HERO CARD ADAPTADO POR ROL (BODEGUERO VS ADMINISTRADOR) */}
        <Tarjeta variant="elevated" style={estilosLocales.heroTarjeta}>
          <View style={estilosLocales.heroContenido}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <View style={estilosLocales.heroBadgesFila}>
                <Insignia
                  label={
                    rolActual === "admin"
                      ? "Panel de Seguimiento Admin"
                      : "Emisión con Guía (Bodeguero)"
                  }
                  tone={rolActual === "admin" ? "primary" : "danger"}
                  size="sm"
                />
                {cuarentenaConteo > 0 && (
                  <Insignia
                    label={`${cuarentenaConteo} SKU en cuarentena`}
                    tone="warn"
                    size="sm"
                  />
                )}
              </View>

              <Text style={estilosLocales.heroTitulo}>
                {rolActual === "admin"
                  ? "Seguimiento y Cierre de Devoluciones a Proveedor"
                  : "Emitir Devolución a Proveedor con Guía de Despacho"}
              </Text>
              <Text style={estilosLocales.heroSubtitulo}>
                {rolActual === "admin"
                  ? "Controla las garantías despachadas desde bodega y registra el cierre administrativo por Nota de Crédito, Reposición de Producto o Reembolso para pasar de Pendiente de resolución a Resuelta."
                  : "Despacha insumos defectuosos desde cuarentena ingresando N° de Guía de Despacho y motivo. El caso queda en estado Pendiente de resolución para seguimiento y cierre por Administración."}
              </Text>
            </View>

            {rolActual !== "technician" && (
              <View style={estilosLocales.heroAcciones}>
                <Boton
                  title="+ Emitir Devolución con Guía"
                  variant={rolActual === "warehouse" ? "danger" : "primary"}
                  size="md"
                  icon="document-text-outline"
                  onPress={abrirEmision}
                  style={{ minHeight: 46 }}
                  fullWidth={esMovilEstrecho}
                />
              </View>
            )}
          </View>
        </Tarjeta>

        {/* 2. DASHBOARD RESPONSIVO DE 4 KPIs */}
        <View style={estilosLocales.kpiGrilla}>
          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              metricas.pendientesConteo > 0 && {
                backgroundColor: tema.colors.dangerLight,
                borderColor: tema.colors.dangerBorder,
              },
            ]}
          >
            <Text
              style={[
                estilosLocales.kpiLbl,
                metricas.pendientesConteo > 0 && { color: tema.colors.danger },
              ]}
            >
              Pendientes
            </Text>
            <Text
              style={[
                estilosLocales.kpiVal,
                metricas.pendientesConteo > 0 && { color: tema.colors.danger },
              ]}
            >
              {metricas.pendientesConteo}
            </Text>
            <Text
              style={[
                estilosLocales.kpiSub,
                metricas.pendientesConteo > 0 && { color: tema.colors.danger },
              ]}
            >
              Pendiente de resolución
            </Text>
          </View>

          <View
            style={[
              estilosLocales.kpiCaja,
              esMovilEstrecho && estilosLocales.kpiCajaMovil,
              { backgroundColor: tema.colors.okLight, borderColor: "#bbf7d0" },
            ]}
          >
            <Text style={[estilosLocales.kpiLbl, { color: tema.colors.okDark }]}>Resueltas</Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.okDark }]}>
              {metricas.resueltasConteo}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.okDark }]}>
              Cierre administrativo
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
              Nota de Crédito
            </Text>
            <Text style={[estilosLocales.kpiVal, { color: tema.colors.primaryDark }]}>
              {metricas.porNotaCredito}
            </Text>
            <Text style={[estilosLocales.kpiSub, { color: tema.colors.primaryDark }]}>
              Ajuste contable
            </Text>
          </View>

          <View style={[estilosLocales.kpiCaja, esMovilEstrecho && estilosLocales.kpiCajaMovil]}>
            <Text style={estilosLocales.kpiLbl}>Reposición / Otros</Text>
            <Text style={estilosLocales.kpiVal}>{metricas.porReposicion}</Text>
            <Text style={estilosLocales.kpiSub}>Reemplazo o reembolso</Text>
          </View>
        </View>

        {/* 3. BUSCADOR Y FILTROS DINÁMICOS */}
        <View style={estilosLocales.filtrosCaja}>
          <CampoBusqueda
            value={busqueda}
            onChangeText={establecerBusqueda}
            placeholder="Buscar por código DEV-PROV, proveedor, SKU o N° de Guía..."
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(
              [
                {
                  id: "pendiente_resolucion",
                  label: `Pendientes de resolución (${metricas.pendientesConteo})`,
                },
                { id: "todas", label: `Todas (${devolucionesProveedor.length})` },
                { id: "resuelta", label: `Resueltas (${metricas.resueltasConteo})` },
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

        {/* 4. GRILLA RESPONSIVA DE DEVOLUCIONES A PROVEEDOR */}
        {devolucionesFiltradas.length === 0 ? (
          <EstadoVacio
            icon="cube-outline"
            title={
              filtroEstado === "pendiente_resolucion"
                ? "Sin devoluciones pendientes de resolución"
                : "Sin devoluciones a proveedores"
            }
            description={
              filtroEstado === "pendiente_resolucion"
                ? "Todas las devoluciones despachadas con guía ya cuentan con cierre administrativo."
                : "No se encontraron devoluciones a proveedores para los filtros seleccionados."
            }
            actionTitle={
              filtroEstado !== "todas"
                ? "Ver todas las devoluciones"
                : rolActual !== "technician"
                ? "+ Emitir Devolución con Guía"
                : undefined
            }
            onAction={
              filtroEstado !== "todas"
                ? () => establecerFiltroEstado("todas")
                : rolActual !== "technician"
                ? abrirEmision
                : undefined
            }
            containerStyle={{ marginVertical: 20 }}
          />
        ) : (
          <View
            style={[
              estilosLocales.tarjetasGrilla,
              esPantallaAncha && estilosLocales.tarjetasGrillaAncha,
            ]}
          >
            {devolucionesFiltradas.map((sRet) => {
              const esResuelta = sRet.status === "resuelta";
              const etiquetaResolucion =
                sRet.resolutionType === "nota_credito"
                  ? "Nota de Crédito"
                  : sRet.resolutionType === "reemplazo_producto"
                  ? "Reposición de Producto"
                  : "Reembolso en Dinero";

              return (
                <Tarjeta
                  key={sRet.id}
                  variant={esResuelta ? "default" : "elevated"}
                  style={[
                    estilosLocales.devTarjeta,
                    esPantallaAncha && estilosLocales.devTarjetaAncha,
                    !esResuelta && estilosLocales.devTarjetaPendiente,
                  ]}
                >
                  <View style={estilosLocales.tarjetaTop}>
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <View style={estilosLocales.codigoFila}>
                        <Text style={estilosLocales.codigoTexto}>{sRet.code}</Text>
                        <Insignia
                          label={esResuelta ? "Resuelta" : "Pendiente de resolución"}
                          tone={esResuelta ? "ok" : "warn"}
                          icon={esResuelta ? "checkmark-done-outline" : "time-outline"}
                          size="sm"
                        />
                      </View>
                      <Text style={estilosLocales.proveedorTexto}>
                        {sRet.supplierName}
                        {sRet.supplierRut ? ` (${sRet.supplierRut})` : ""}
                      </Text>
                      <Text style={estilosLocales.productoTexto}>
                        {sRet.quantity} {sRet.unit} • {sRet.productName} ({sRet.productSku})
                      </Text>
                    </View>
                  </View>

                  {/* Detalles de la guía y motivo */}
                  <View style={estilosLocales.detallesCaja}>
                    <View style={estilosLocales.detalleFila}>
                      <Ionicons
                        name="document-text-outline"
                        size={15}
                        color={tema.colors.primaryDark}
                      />
                      <Text style={estilosLocales.detalleTexto}>
                        Guía de Despacho N°:{" "}
                        <Text style={{ fontWeight: "bold", color: tema.colors.text }}>
                          {sRet.dispatchGuideNumber}
                        </Text>
                      </Text>
                    </View>

                    <View style={estilosLocales.detalleFila}>
                      <Ionicons
                        name="chatbox-ellipses-outline"
                        size={15}
                        color={tema.colors.danger}
                      />
                      <Text style={estilosLocales.detalleTexto}>
                        Motivo: <Text style={{ color: tema.colors.text }}>{sRet.reason}</Text>
                      </Text>
                    </View>

                    <View style={estilosLocales.detalleFila}>
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={tema.colors.textMuted}
                      />
                      <Text style={estilosLocales.detalleTexto}>
                        Fecha de despacho: {formatearFecha(sRet.date)}
                      </Text>
                    </View>
                  </View>

                  {/* Resolución registrada */}
                  {esResuelta && sRet.resolutionType && (
                    <View style={estilosLocales.resolucionCaja}>
                      <View style={estilosLocales.resolucionHeader}>
                        <Ionicons name="checkmark-circle" size={17} color={tema.colors.ok} />
                        <Text style={estilosLocales.resolucionTitulo}>
                          Cierre por {etiquetaResolucion}
                        </Text>
                      </View>
                      {Boolean(sRet.resolutionNotes) && (
                        <Text style={estilosLocales.resolucionNotas}>
                          "{sRet.resolutionNotes}"
                        </Text>
                      )}
                      {Boolean(sRet.resolvedAt) && (
                        <Text style={estilosLocales.resolucionFecha}>
                          Resuelta el {formatearFecha(sRet.resolvedAt)}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Acción de cierre administrativo (Admin) o estado en espera (Bodeguero) */}
                  {!esResuelta && rolActual === "admin" && (
                    <Boton
                      title="Cerrar por Nota de Crédito / Reposición"
                      variant="success"
                      size="md"
                      icon="checkmark-done-outline"
                      onPress={() => {
                        establecerResolverDevolucionModal(sRet);
                        establecerResolverTipo("nota_credito");
                        establecerResolverNotas("");
                      }}
                      style={{ minHeight: 44 }}
                    />
                  )}

                  {!esResuelta && rolActual === "warehouse" && (
                    <View style={estilosLocales.esperaAdminStrip}>
                      <Ionicons name="time-outline" size={15} color={tema.colors.warnDark} />
                      <Text style={estilosLocales.esperaAdminTexto}>
                        Emitida con Guía {sRet.dispatchGuideNumber} — Pendiente de cierre
                        administrativo (Nota de Crédito / Reposición).
                      </Text>
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
  avisoExitoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.ok,
    borderRadius: tema.radius.md,
    padding: 12,
  },
  avisoExitoTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.okDark,
    fontWeight: "600",
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
  heroBadgesFila: {
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
  heroSubtitulo: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  heroAcciones: {
    minWidth: 220,
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
  filtrosCaja: {
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
  devTarjeta: {
    padding: 14,
    gap: 12,
  },
  devTarjetaAncha: {
    width: "48.8%",
  },
  devTarjetaPendiente: {
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.danger,
  },
  tarjetaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  codigoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  proveedorTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  productoTexto: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  detallesCaja: {
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.sm,
    padding: 10,
    gap: 6,
  },
  detalleFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  detalleTexto: {
    flex: 1,
    fontSize: 12,
    color: tema.colors.textSecondary,
    lineHeight: 17,
  },
  resolucionCaja: {
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: tema.radius.sm,
    padding: 10,
    gap: 4,
  },
  resolucionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resolucionTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  resolucionNotas: {
    fontSize: 12,
    color: tema.colors.text,
    fontStyle: "italic",
  },
  resolucionFecha: {
    fontSize: 11,
    color: tema.colors.okDark,
    fontWeight: "600",
  },
  esperaAdminStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.warnLight,
    borderRadius: tema.radius.sm,
    padding: 9,
  },
  esperaAdminTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.warnDark,
    fontWeight: "600",
    lineHeight: 16,
  },
});
