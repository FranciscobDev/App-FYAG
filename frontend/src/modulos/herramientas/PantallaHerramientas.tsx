import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { NotificacionFlotante } from "@/componentes/retroalimentacion/NotificacionFlotante";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { Selector } from "@/componentes/formularios/Selector";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { Herramienta, EstadoHerramienta } from "@/nucleo/tipos";
import { generarMatrizQrVisual } from "@/modulos/inventario/qrInsumosUtils";

/**
 * Construye el payload JSON embebido dentro del código QR de un activo fijo (herramienta).
 */
function construirPayloadQrHerramienta(t: Herramienta): string {
  return JSON.stringify({
    sistema: "FYAG",
    tipo: "ACTIVO_FIJO",
    codigoQr: `QR-HER-${t.code}`,
    codigo: t.code,
    serie: t.serialNumber,
    nombre: t.name,
    categoria: t.category,
    marca: t.brand,
    modelo: t.model,
    estado: t.status,
    proximaMantencion: t.nextMaintenanceDate,
  });
}

/**
 * Renderiza el código QR de una herramienta en formato vectorial SVG.
 */
const CodigoQrHerramientaSvg: React.FC<{ contenido: string; tamano?: number }> = ({
  contenido,
  tamano = 176,
}) => {
  const matriz = generarMatrizQrVisual(contenido, 25);
  const modulos = matriz.length;
  const celda = tamano / modulos;

  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tema.colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`}>
        <Rect x={0} y={0} width={tamano} height={tamano} fill="#ffffff" />
        {matriz.map((fila, r) =>
          fila.map((activo, c) =>
            activo ? (
              <Rect
                key={`${r}-${c}`}
                x={c * celda}
                y={r * celda}
                width={celda + 0.25}
                height={celda + 0.25}
                fill="#0f172a"
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
};

export const PantallaHerramientas: React.FC = () => {
  const {
    herramientas,
    tecnicos,
    proyectos,
    crearHerramienta,
    prestarHerramienta,
    devolverHerramienta,
    registrarMantencionHerramienta,
    darDeBajaHerramienta,
  } = usarAplicacion();
  const { rolActual, usuario } = usarAutenticacion();

  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [filtrarEstado, establecerFiltrarEstado] = useState<string>("todos");
  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);

  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // Herramienta seleccionada para ver Historial (Préstamos y Mantenciones)
  const [seleccionadoHerramientaHistorial, establecerSeleccionadoHerramientaHistorial] = useState<Herramienta | null>(null);
  const [historialPestana, establecerHistorialPestana] = useState<"prestamos" | "mantenciones">("prestamos");

  // Modal de Visualización de Código QR del activo fijo
  const [qrModalHerramienta, establecerQrModalHerramienta] = useState<Herramienta | null>(null);

  // Modal de Baja Lógica Patrimonial
  const [bajaModalHerramienta, establecerBajaModalHerramienta] = useState<Herramienta | null>(null);
  const [bajaMotivo, establecerBajaMotivo] = useState("");
  const [bajaError, establecerBajaError] = useState("");

  // 1. Alta de Herramienta Modal
  const [nuevoHerramientaModal, establecerNuevoHerramientaModal] = useState(false);
  const [herramientaCodigo, establecerHerramientaCodigo] = useState("");
  const [herramientaSerie, establecerHerramientaSerie] = useState("");
  const [herramientaNombre, establecerHerramientaNombre] = useState("");
  const [herramientaCategoria, establecerHerramientaCategoria] = useState("Herramientas Eléctricas");
  const [herramientaMarca, establecerHerramientaMarca] = useState("Bosch");
  const [herramientaModelo, establecerHerramientaModelo] = useState("");
  const [herramientaDiasFreq, establecerHerramientaDiasFreq] = useState("90");
  const [herramientaProximaMantencion, establecerHerramientaProximaMantencion] = useState("");
  const [herramientaError, establecerHerramientaError] = useState("");

  // 2. Préstamo a Técnico Modal
  const [prestamoModalHerramienta, establecerPrestamoModalHerramienta] = useState<Herramienta | null>(null);
  const [prestamoTecnicoRut, establecerPrestamoTecnicoRut] = useState(tecnicos[0]?.rut || "");
  const [prestamoProyectoCodigo, establecerPrestamoProyectoCodigo] = useState(proyectos[0]?.code || "");

  // 3. Devolución de Herramienta (Bueno -> disponible / Dañado -> en_mantencion)
  const [devolucionModalHerramienta, establecerDevolucionModalHerramienta] = useState<Herramienta | null>(null);
  const [devolucionCondicion, establecerDevolucionCondicion] = useState<"bueno" | "danado">("bueno");
  const [devolucionNotas, establecerDevolucionNotas] = useState("");

  // 4. Registro de Mantención Modal
  const [maintModalHerramienta, establecerMaintModalHerramienta] = useState<Herramienta | null>(null);
  const [maintTipo, establecerMaintTipo] = useState<"preventiva" | "correctiva">("preventiva");
  const [maintTaller, establecerMaintTaller] = useState("Servicio Técnico Oficial Bosch");
  const [maintCosto, establecerMaintCosto] = useState("35000");
  const [maintDescripcion, establecerMaintDescripcion] = useState("Limpieza interna, cambio de carbones y lubricación de engranajes");
  const [maintSiguienteFecha, establecerMaintSiguienteFecha] = useState("");
  const [maintError, establecerMaintError] = useState("");

  const hoyCadena = new Date().toISOString().slice(0, 10);

  // Función para calcular días restantes hasta la mantención
  const obtenerDiasUntilMantencion = (dateStr: string) => {
    if (!dateStr) return 999;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return 999;
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diferenciaTiempo = target.getTime() - hoy.getTime();
    return Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
  };

  // KPIs de inventario de activos fijos (herramientas y maquinaria)
  const totalConteo = herramientas.length;
  const disponibleConteo = herramientas.filter((t) => t.status === "disponible").length;
  const asignadoConteo = herramientas.filter((t) => t.status === "asignada").length;
  const mantencionConteo = herramientas.filter((t) => t.status === "en_mantencion").length;
  const bajaConteo = herramientas.filter((t) => t.status === "dada_de_baja").length;
  const overdueConteo = herramientas.filter((t) => {
    if (t.status === "dada_de_baja") return false;
    return obtenerDiasUntilMantencion(t.nextMaintenanceDate) <= 0;
  }).length;
  const nearDueConteo = herramientas.filter((t) => {
    if (t.status === "dada_de_baja") return false;
    const dias = obtenerDiasUntilMantencion(t.nextMaintenanceDate);
    return dias > 0 && dias <= 15;
  }).length;

  // Filtrado y priorización visual: las herramientas con mantención vencida o próxima destacan primero
  const filtradoHerramientas = herramientas
    .filter((t) => {
      const q = buscarQuery.toLowerCase();
      const coincidenciaQuery =
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.serialNumber.toLowerCase().includes(q) ||
        t.brand.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q);

      if (filtrarEstado === "vencidas") {
        return coincidenciaQuery && t.status !== "dada_de_baja" && obtenerDiasUntilMantencion(t.nextMaintenanceDate) <= 0;
      }
      if (filtrarEstado === "proximas") {
        const dias = obtenerDiasUntilMantencion(t.nextMaintenanceDate);
        return coincidenciaQuery && t.status !== "dada_de_baja" && dias > 0 && dias <= 15;
      }

      if (filtrarEstado !== "todos" && t.status !== filtrarEstado) {
        return false;
      }
      return coincidenciaQuery;
    })
    .sort((a, b) => {
      const prioridad = (h: Herramienta) => {
        if (h.status === "dada_de_baja") return 4;
        const d = obtenerDiasUntilMantencion(h.nextMaintenanceDate);
        if (d <= 0) return 0; // Vencidas primero
        if (d <= 15) return 1; // Próximas segundo
        if (h.status === "en_mantencion") return 2;
        return 3;
      };
      const pa = prioridad(a);
      const pb = prioridad(b);
      if (pa !== pb) return pa - pb;
      return obtenerDiasUntilMantencion(a.nextMaintenanceDate) - obtenerDiasUntilMantencion(b.nextMaintenanceDate);
    });

  // Guardar nueva herramienta con fecha explícita de próximo mantenimiento
  const manejarAbrirNuevoHerramientaModal = () => {
    establecerHerramientaCodigo(`HER-${String(herramientas.length + 1).padStart(3, "0")}`);
    establecerHerramientaSerie("");
    establecerHerramientaNombre("");
    establecerHerramientaModelo("");
    establecerHerramientaDiasFreq("90");
    establecerHerramientaProximaMantencion(
      new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    );
    establecerHerramientaError("");
    establecerNuevoHerramientaModal(true);
  };

  const manejarCambioFrecuenciaDias = (valor: string) => {
    establecerHerramientaDiasFreq(valor);
    const dias = Number(valor);
    if (!Number.isNaN(dias) && dias > 0) {
      establecerHerramientaProximaMantencion(
        new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
      );
    }
  };

  const manejarGuardarNuevoHerramienta = () => {
    if (!herramientaCodigo.trim() || !herramientaNombre.trim() || !herramientaSerie.trim()) {
      establecerHerramientaError("Código, Nombre y N° de Serie son obligatorios.");
      return;
    }

    const freqDias = Number(herramientaDiasFreq) || 90;
    const fechaProximaLimpia = herramientaProximaMantencion.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaProximaLimpia)) {
      establecerHerramientaError(
        "La fecha de próximo mantenimiento debe tener formato YYYY-MM-DD (ej: 2026-12-30)."
      );
      return;
    }

    const nuevoT: Herramienta = {
      id: `tool_${Date.now()}`,
      code: herramientaCodigo.trim().toUpperCase(),
      serialNumber: herramientaSerie.trim(),
      name: herramientaNombre.trim(),
      category: herramientaCategoria,
      brand: herramientaMarca,
      model: herramientaModelo.trim() || "Estándar",
      status: "disponible",
      purchaseDate: hoyCadena,
      maintenanceFrequencyDays: freqDias,
      nextMaintenanceDate: fechaProximaLimpia,
      loans: [],
      maintenances: [],
    };

    const resultado = crearHerramienta(nuevoT);
    if (!resultado.success) {
      establecerHerramientaError(resultado.error || "Error al crear herramienta.");
    } else {
      establecerNuevoHerramientaModal(false);
      mostrarAviso(
        `Activo fijo ${nuevoT.code} registrado con próximo mantenimiento el ${formatearFecha(nuevoT.nextMaintenanceDate)}.`
      );
    }
  };

  // Confirmar baja lógica de herramienta
  const manejarConfirmarBajaLogica = () => {
    if (!bajaModalHerramienta) return;
    if (bajaMotivo.trim().length < 5) {
      establecerBajaError("Ingresa un motivo de baja de al menos 5 caracteres.");
      return;
    }
    const res = darDeBajaHerramienta(
      bajaModalHerramienta.id,
      bajaMotivo.trim(),
      usuario?.name || usuarioRolDisplay(rolActual)
    );
    if (!res.success) {
      establecerBajaError(res.error || "No se pudo realizar la baja lógica.");
      return;
    }
    mostrarAviso(
      `Baja lógica aplicada a ${bajaModalHerramienta.code}. Historial patrimonial conservado.`
    );
    establecerBajaModalHerramienta(null);
    establecerBajaMotivo("");
    establecerBajaError("");
  };

  // Imprimir etiqueta QR de herramienta en Web
  const manejarImprimirQrWeb = (t: Herramienta) => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      mostrarAviso(`Código QR ${t.code} listo para etiquetado físico.`);
      return;
    }
    const win = window.open("", "_blank", "width=460,height=520");
    if (!win) {
      mostrarAviso("Permite ventanas emergentes para imprimir la etiqueta QR.");
      return;
    }
    const payload = construirPayloadQrHerramienta(t);
    win.document.write(`
      <html><head><title>Etiqueta QR ${t.code}</title></head>
      <body style="font-family:sans-serif;padding:24px;text-align:center;">
        <h2 style="margin:0 0 6px;">FYAG • Activo Fijo</h2>
        <p style="margin:0 0 12px;font-weight:bold;font-size:18px;">${t.code} — ${t.name}</p>
        <p style="margin:0 0 8px;font-size:13px;">Serie: ${t.serialNumber} • ${t.brand} ${t.model}</p>
        <p style="margin:0 0 16px;font-size:12px;">Próxima mantención: ${t.nextMaintenanceDate}</p>
        <pre style="text-align:left;background:#f8fafc;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:11px;white-space:pre-wrap;">${payload}</pre>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  // Confirmar préstamo a técnico
  const manejarConfirmarPrestamo = () => {
    if (!prestamoModalHerramienta) return;
    prestarHerramienta(prestamoModalHerramienta.id, prestamoTecnicoRut, prestamoProyectoCodigo);
    establecerPrestamoModalHerramienta(null);
  };

  // Confirmar devolución de herramienta (Bueno / Dañado)
  const manejarConfirmarDevolucion = () => {
    if (!devolucionModalHerramienta) return;
    devolverHerramienta(devolucionModalHerramienta.id, devolucionCondicion, devolucionNotas.trim() || undefined);
    establecerDevolucionModalHerramienta(null);
  };

  // Confirmar registro de mantención / calibración ejecutada y pasar herramienta a Disponible
  const manejarConfirmarMantencion = () => {
    if (!maintModalHerramienta) return;
    if (!maintTaller.trim()) {
      establecerMaintError("Ingresa el taller o servicio técnico que ejecutó la mantención.");
      return;
    }
    const fechaProximaLimpia = maintSiguienteFecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaProximaLimpia) || fechaProximaLimpia <= hoyCadena) {
      establecerMaintError(
        `La próxima fecha de mantención debe ser posterior a hoy (${hoyCadena}) en formato YYYY-MM-DD.`
      );
      return;
    }
    establecerMaintError("");
    const codigoHerramienta = maintModalHerramienta.code;
    registrarMantencionHerramienta(maintModalHerramienta.id, {
      toolId: maintModalHerramienta.id,
      date: hoyCadena,
      type: maintTipo,
      workshop: maintTaller.trim(),
      cost: Number(maintCosto) || 0,
      description: maintDescripcion.trim() || "Mantención y calibración preventiva completada",
      nextMaintenanceDate: fechaProximaLimpia,
      performedBy: usuario?.name || usuarioRolDisplay(rolActual),
    });
    establecerMaintModalHerramienta(null);
    mostrarAviso(
      `✓ Mantención completada en ${codigoHerramienta}: estado DISPONIBLE con nueva fecha ${formatearFecha(fechaProximaLimpia)}.`
    );
  };

  const usuarioRolDisplay = (role: string) => {
    if (role === "admin") return "Administración Central";
    if (role === "warehouse") return "Bodega Central";
    return "Técnico en Terreno";
  };

  return (
    <ContenedorEstadoPantalla screenTitle="Control de Herramientas" skeletonType="table">
      <View style={estilos.contenedor}>
        <NotificacionFlotante
          visible={Boolean(avisoMensaje)}
          message={avisoMensaje || ""}
          onDismiss={() => establecerAvisoMensaje(null)}
        />

        {/* ========================================================================= */}
        {/* HEADER LIMPIO Y RESPONSIVO (ANCHO COMPLETO EDGE-TO-EDGE)                   */}
        {/* ========================================================================= */}
        <EncabezadoPagina
          title="Mantenedor de Herramientas (Activos Fijos)"
          subtitle={
            rolActual === "warehouse"
              ? "Inventario de activos fijos separado de insumos consumibles"
              : "Activos fijos, códigos QR, asignaciones a faena, mantención preventiva y baja lógica"
          }
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.contenido}>
          {/* ========================================================================= */}
          {/* KPIS DE RESUMEN INTERACTIVOS (MANTIENE ESENCIA CON SEMÁFORO DE SUPERFICIE) */}
          {/* ========================================================================= */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "todos",
                label: "Total Equipos",
                valor: totalConteo,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                activeBorder: "#0f172a",
                color: "#0f172a",
              },
              {
                id: "disponible",
                label: "Disponibles",
                valor: disponibleConteo,
                bg: "#f0fdf4",
                border: "#86efac",
                activeBorder: "#16a34a",
                color: "#166534",
              },
              {
                id: "asignada",
                label: "Asignadas",
                valor: asignadoConteo,
                bg: "#fffbeb",
                border: "#fcd34d",
                activeBorder: "#d97706",
                color: "#92400e",
              },
              {
                id: "en_mantencion",
                label: "En Mantención",
                valor: mantencionConteo,
                bg: "#fff7ed",
                border: "#fdba74",
                activeBorder: "#ea580c",
                color: "#9a3412",
              },
              {
                id: "dada_de_baja",
                label: "Dadas de Baja",
                valor: bajaConteo,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                activeBorder: "#64748b",
                color: "#475569",
              },
              ...(overdueConteo > 0
                ? [
                    {
                      id: "vencidas",
                      label: "¡Vencidas!",
                      valor: overdueConteo,
                      bg: "#fef2f2",
                      border: "#fca5a5",
                      activeBorder: "#dc2626",
                      color: "#991b1b",
                    },
                  ]
                : []),
              ...(nearDueConteo > 0
                ? [
                    {
                      id: "proximas",
                      label: "Próx. Mant.",
                      valor: nearDueConteo,
                      bg: "#fffbeb",
                      border: "#fcd34d",
                      activeBorder: "#d97706",
                      color: "#b45309",
                    },
                  ]
                : []),
            ].map((kpi) => {
              const activo = filtrarEstado === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    establecerFiltrarEstado(filtrarEstado === kpi.id && kpi.id !== "todos" ? "todos" : kpi.id)
                  }
                  style={{
                    flexGrow: 1,
                    flexBasis: "30%",
                    minWidth: 96,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2 : 1.5,
                    borderColor: activo ? kpi.activeBorder : kpi.border,
                    borderLeftWidth: 4,
                    borderLeftColor: kpi.activeBorder,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 19, fontWeight: "900", color: kpi.color }}>
                    {kpi.valor}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: activo ? "800" : "700",
                      color: kpi.color,
                      marginTop: 2,
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {activo ? `● ${kpi.label}` : kpi.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* BANNER DESTACADO DE ALERTAS DE MANTENCIÓN VENCIDA O PRÓXIMA */}
          {(overdueConteo > 0 || nearDueConteo > 0) && (
            <View
              style={{
                backgroundColor: overdueConteo > 0 ? "#fef2f2" : "#fffbeb",
                borderWidth: 1.5,
                borderColor: overdueConteo > 0 ? "#fca5a5" : "#fcd34d",
                borderLeftWidth: 5,
                borderLeftColor: overdueConteo > 0 ? "#dc2626" : "#d97706",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
                <Ionicons
                  name={overdueConteo > 0 ? "alert-circle" : "time"}
                  size={22}
                  color={overdueConteo > 0 ? tema.colors.danger : tema.colors.warnDark}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: overdueConteo > 0 ? "#991b1b" : tema.colors.warnDark,
                    }}
                  >
                    {overdueConteo > 0
                      ? `${overdueConteo} herramienta(s) con mantención VENCIDA`
                      : `${nearDueConteo} herramienta(s) con mantención PRÓXIMA (≤ 15 días)`}
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    {overdueConteo > 0 && nearDueConteo > 0
                      ? `Además hay ${nearDueConteo} equipo(s) próximos a calibración. Se muestran primero en el listado.`
                      : "Registra la mantención o calibración ejecutada para habilitarlas nuevamente como Disponibles."}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {overdueConteo > 0 && (
                  <Boton
                    title={filtrarEstado === "vencidas" ? "Ver Todas" : `Ver Vencidas (${overdueConteo})`}
                    variant="danger"
                    size="sm"
                    onPress={() =>
                      establecerFiltrarEstado(filtrarEstado === "vencidas" ? "todos" : "vencidas")
                    }
                    style={{ minHeight: 36 }}
                  />
                )}
                {nearDueConteo > 0 && (
                  <Boton
                    title={`Ver Próximas (${nearDueConteo})`}
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      establecerFiltrarEstado(filtrarEstado === "proximas" ? "todos" : "proximas")
                    }
                    style={{ minHeight: 36, backgroundColor: "#ffffff" }}
                  />
                )}
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* TARJETA HERO COMPACTA PARA REGISTRAR NUEVA HERRAMIENTA O EQUIPO           */}
          {/* ========================================================================= */}
          {rolActual !== "technician" && (
            <Tarjeta
              style={[
                estilos.crearHerramientaHeroTarjeta,
                { padding: 14, marginBottom: 12 },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, minWidth: 220 }}>
                  <View style={[estilos.herramientaInsigniaFila, { marginBottom: 4 }]}>
                    <Insignia label="Activos Fijos" tone="primary" size="sm" />
                    <Insignia label="Separado de Insumos" tone="info" size="sm" />
                  </View>
                  <Text style={[estilos.crearHerramientaHeroTitulo, { fontSize: 15 }]}>
                    Registrar Nueva Herramienta o Equipo
                  </Text>
                  <Text style={[estilos.crearHerramientaHeroDescripcion, { fontSize: 11.5, marginTop: 2 }]}>
                    Control patrimonial con código QR, N° de serie, mantención preventiva y baja lógica.
                  </Text>
                </View>
                <Boton
                  title="+ Registrar Nueva Herramienta"
                  variant="primary"
                  size="sm"
                  icon="add-circle-outline"
                  onPress={manejarAbrirNuevoHerramientaModal}
                  style={{ minHeight: 40 }}
                />
              </View>
            </Tarjeta>
          )}

      {/* ========================================================================= */}
      {/* BUSCADOR Y FILTROS POR ESTADO                                             */}
      {/* ========================================================================= */}
      <View style={estilos.buscarFila}>
        <Ionicons name="search-outline" size={18} color={tema.colors.textMuted} style={estilos.buscarIcono} />
        <TextInput
          value={buscarQuery}
          onChangeText={establecerBuscarQuery}
          placeholder="Buscar por código, serie, marca o nombre..."
          placeholderTextColor={tema.colors.textLight}
          style={estilos.buscarEntrada}
        />
        {Boolean(buscarQuery) && (
          <TouchableOpacity onPress={() => establecerBuscarQuery("")} style={estilos.limpiarBuscarBoton}>
            <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.filtrarScroll}>
        {[
          { id: "todos", label: `Todas (${totalConteo})` },
          { id: "disponible", label: `Disponibles (${disponibleConteo})` },
          { id: "asignada", label: `Asignadas en Faena (${asignadoConteo})` },
          { id: "en_mantencion", label: `En Mantención (${mantencionConteo})` },
          { id: "vencidas", label: `⚠️ Mantención Vencida (${overdueConteo})` },
          { id: "proximas", label: `⏰ Próx. Mantención (${nearDueConteo})` },
          { id: "dada_de_baja", label: `Dadas de Baja (${bajaConteo})` },
        ].map((f) => {
          const esActivo = filtrarEstado === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => establecerFiltrarEstado(f.id)}
              style={[
                estilos.filtrarChip,
                esActivo && estilos.filtrarChipActivo,
                f.id === "vencidas" && overdueConteo > 0 && estilos.filtrarChipPeligro,
              ]}
            >
              <Text
                style={[
                  estilos.filtrarChipTexto,
                  esActivo && estilos.filtrarChipTextoActivo,
                  f.id === "vencidas" && overdueConteo > 0 && !esActivo && { color: tema.colors.danger, fontWeight: "bold" },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {(filtrarEstado !== "todos" || Boolean(buscarQuery)) && (
          <TouchableOpacity
            onPress={() => {
              establecerFiltrarEstado("todos");
              establecerBuscarQuery("");
            }}
            style={[estilos.filtrarChip, { borderColor: tema.colors.borderDark }]}
          >
            <Ionicons name="close-circle-outline" size={14} color={tema.colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={estilos.filtrarChipTexto}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* LISTA DE HERRAMIENTAS Y RESALTADO DE MANTENCIÓN VENCIDA                  */}
      {/* ========================================================================= */}
      {filtradoHerramientas.length === 0 ? (
        <EstadoVacio
          icon="construct-outline"
          title="No se encontraron herramientas"
          description={
            buscarQuery
              ? `No existen coincidencias para "${buscarQuery}".`
              : "No hay herramientas ni maquinarias registradas en este estado."
          }
          actionTitle={rolActual !== "technician" ? "+ Registrar Nueva Herramienta" : undefined}
          onAction={rolActual !== "technician" ? manejarAbrirNuevoHerramientaModal : undefined}
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        filtradoHerramientas.map((t) => {
          const diasIzquierda = obtenerDiasUntilMantencion(t.nextMaintenanceDate);
          const esRetired = t.status === "dada_de_baja";
          const esOverdue = !esRetired && diasIzquierda <= 0;
          const esNearDue = !esRetired && diasIzquierda > 0 && diasIzquierda <= 15;
          const esAsignado = t.status === "asignada";
          const esDisponible = t.status === "disponible";

          const semaforoTarjeta = esRetired
            ? {
                bg: "#f1f5f9",
                border: "#cbd5e1",
                stripe: "#64748b",
                innerBorder: "#e2e8f0",
              }
            : esOverdue
              ? {
                  bg: "#fef2f2",
                  border: "#fca5a5",
                  stripe: "#dc2626",
                  innerBorder: "#fecaca",
                }
              : esNearDue || t.status === "en_mantencion" || esAsignado
                ? {
                    bg: "#fffbeb",
                    border: "#fcd34d",
                    stripe: "#d97706",
                    innerBorder: "#fde68a",
                  }
                : {
                    bg: "#f0fdf4",
                    border: "#86efac",
                    stripe: "#16a34a",
                    innerBorder: "#bbf7d0",
                  };

          return (
            <Tarjeta
              key={t.id}
              variant="outlined"
              style={[
                estilos.herramientaTarjeta,
                {
                  backgroundColor: semaforoTarjeta.bg,
                  borderColor: semaforoTarjeta.border,
                  borderWidth: 1.5,
                  borderLeftWidth: 6,
                  borderLeftColor: semaforoTarjeta.stripe,
                },
              ]}
            >
              {/* Franja superior de alerta visual inmediata si tiene mantención vencida o próxima */}
              {(esOverdue || esNearDue) && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#ffffff",
                    borderRadius: tema.radius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: esOverdue ? tema.colors.danger : tema.colors.warn,
                  }}
                >
                  <Ionicons
                    name={esOverdue ? "warning" : "time"}
                    size={15}
                    color={esOverdue ? tema.colors.danger : tema.colors.warnDark}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 11.5,
                      fontWeight: "800",
                      color: esOverdue ? tema.colors.danger : tema.colors.warnDark,
                    }}
                  >
                    {esOverdue
                      ? `MANTENCIÓN VENCIDA (${Math.abs(diasIzquierda)} día(s) de atraso) — Registrar calibración/mantención`
                      : `MANTENCIÓN PRÓXIMA (vence en ${diasIzquierda} día(s) • ${formatearFecha(t.nextMaintenanceDate)})`}
                  </Text>
                </View>
              )}
              {/* Top row: Código, S/N, Nombre y EstadoBadge */}
              <View style={estilos.herramientaSuperior}>
                <View style={{ flex: 1 }}>
                  <View style={estilos.herramientaCodigoFila}>
                    <Text style={estilos.herramientaCodigo}>{t.code}</Text>
                    <Text style={[estilos.herramientaSerie, { backgroundColor: "#ffffff" }]}>
                      S/N: {t.serialNumber}
                    </Text>
                    {esOverdue && (
                      <View style={estilos.peligroPastilla}>
                        <Ionicons name="alert-circle" size={12} color="#ffffff" />
                        <Text style={estilos.peligroPastillaTexto}>VENCIDA</Text>
                      </View>
                    )}
                  </View>
                  <Text style={estilos.herramientaNombre}>{t.name}</Text>
                  <Text style={estilos.herramientaMarcaModelo}>
                    {t.brand} {t.model} • Categoría: <Text style={{ color: tema.colors.text, fontWeight: "700" }}>{t.category}</Text>
                  </Text>
                </View>

                <InsigniaEstado status={t.status} size="md" />
              </View>

              {/* Ficha de Asignación si está en Faena */}
              {esAsignado && (
                <View style={[estilos.asignadoCaja, { backgroundColor: "#ffffff" }]}>
                  <Ionicons name="person" size={16} color={tema.colors.primaryDark} style={{ marginTop: 2 }} />
                  <View style={estilos.asignadoInfo}>
                    <Text style={estilos.asignadoTecnico}>
                      Asignada a Técnico: <Text style={{ fontWeight: "bold" }}>{t.currentTechnicianName}</Text>
                    </Text>
                    <Text style={estilos.asignadoProyecto}>
                      Faena: {t.currentProjectName} ({t.currentProjectCode}) • Desde el {formatearFecha(t.currentLoanDate || "")}
                    </Text>
                  </View>
                </View>
              )}

              {/* Control de Próxima Mantención (En caja blanca limpia sobre la superficie de semáforo) */}
              <View
                style={[
                  estilos.mantencionFila,
                  {
                    backgroundColor: "#ffffff",
                    borderColor: semaforoTarjeta.innerBorder,
                  },
                ]}
              >
                <View style={estilos.maintColumna}>
                  <Text style={estilos.maintFechaEtiqueta}>Próxima Mantención Preventiva:</Text>
                  <Text
                    style={[
                      estilos.maintFechaValor,
                      esOverdue && estilos.overdueFechaValor,
                      esNearDue && estilos.nearDueFechaValor,
                    ]}
                  >
                    {formatearFecha(t.nextMaintenanceDate)}
                  </Text>
                  <Text style={estilos.maintFreqTexto}>
                    Frecuencia de calibración: cada {t.maintenanceFrequencyDays} días
                  </Text>
                </View>

                <View style={estilos.maintInsigniaEnvoltorio}>
                  {esRetired ? (
                    <Insignia label="Baja" tone="mute" size="sm" />
                  ) : esOverdue ? (
                    <Insignia label="Vencida" tone="danger" icon="alert-circle" size="sm" />
                  ) : esNearDue ? (
                    <Insignia label="Próxima" tone="warn" icon="time-outline" size="sm" />
                  ) : (
                    <Insignia label="Vigente" tone="ok" icon="checkmark-circle-outline" size="sm" />
                  )}
                </View>
              </View>

              {/* BOTONES DE ACCIÓN */}
              <View style={[estilos.herramientaAccionesFila, { flexWrap: "wrap", gap: 8, borderTopColor: semaforoTarjeta.innerBorder }]}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {/* Botón Ver Código QR del Activo Fijo */}
                  <TouchableOpacity
                    onPress={() => establecerQrModalHerramienta(t)}
                    style={[estilos.historialBoton, { backgroundColor: "#ffffff" }]}
                    accessibilityLabel={`Ver código QR de ${t.code}`}
                  >
                    <Ionicons name="qr-code-outline" size={16} color={tema.colors.primaryDark} />
                    <Text style={estilos.historialBotonTexto}>Ver QR</Text>
                  </TouchableOpacity>

                  {/* Botón Historial de Préstamos y Mantenciones */}
                  <TouchableOpacity
                    onPress={() => {
                      establecerSeleccionadoHerramientaHistorial(t);
                      establecerHistorialPestana("prestamos");
                    }}
                    style={[estilos.historialBoton, { backgroundColor: "#ffffff" }]}
                  >
                    <Ionicons name="time-outline" size={16} color={tema.colors.primary} />
                    <Text style={estilos.historialBotonTexto}>
                      Historial ({t.loans?.length || 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[estilos.accionBtnsGrupo, { flexWrap: "wrap", gap: 6 }]}>
                  {/* 1. Prestar a Técnico (Disponible) */}
                  {esDisponible && rolActual !== "technician" && (
                    <Boton
                      title="Prestar a Técnico"
                      variant="primary"
                      size="sm"
                      icon="arrow-forward-outline"
                      onPress={() => {
                        establecerPrestamoModalHerramienta(t);
                        establecerPrestamoTecnicoRut(tecnicos[0]?.rut || "");
                        establecerPrestamoProyectoCodigo(proyectos[0]?.code || "");
                      }}
                      style={{ minHeight: 38 }}
                    />
                  )}

                  {/* 2. Devolución de Herramienta (Asignada) */}
                  {esAsignado && rolActual !== "technician" && (
                    <Boton
                      title="Devolver (Bueno/Dañado)"
                      variant="outline"
                      size="sm"
                      icon="return-down-back-outline"
                      onPress={() => {
                        establecerDevolucionModalHerramienta(t);
                        establecerDevolucionCondicion("bueno");
                        establecerDevolucionNotas("");
                      }}
                      style={{ minHeight: 38, backgroundColor: "#ffffff" }}
                    />
                  )}

                  {/* 3. Registrar Mantención */}
                  {!esRetired && rolActual !== "technician" && (
                    <Boton
                      title={t.status === "en_mantencion" ? "Completar Mantención" : "Mantención"}
                      variant={esOverdue ? "danger" : t.status === "en_mantencion" ? "success" : "outline"}
                      size="sm"
                      icon="build-outline"
                      onPress={() => {
                        establecerMaintModalHerramienta(t);
                        establecerMaintError("");
                        establecerMaintTipo(t.status === "en_mantencion" ? "correctiva" : "preventiva");
                        establecerMaintTaller("Servicio Técnico Oficial Bosch");
                        establecerMaintCosto("35000");
                        establecerMaintDescripcion(
                          t.status === "en_mantencion"
                            ? "Reparación y cambio de piezas averiadas"
                            : "Limpieza, calibración y engrase general"
                        );
                        const calculoSiguiente = new Date(Date.now() + t.maintenanceFrequencyDays * 86400000)
                          .toISOString()
                          .slice(0, 10);
                        establecerMaintSiguienteFecha(calculoSiguiente);
                      }}
                      style={[
                        { minHeight: 38 },
                        !esOverdue && t.status !== "en_mantencion" && { backgroundColor: "#ffffff" },
                      ]}
                    />
                  )}

                  {/* 4. Baja Lógica Patrimonial (Admin / Bodeguero, conserva historial) */}
                  {!esRetired && rolActual !== "technician" && (
                    <Boton
                      title="Dar de Baja"
                      variant="danger"
                      size="sm"
                      icon="archive-outline"
                      onPress={() => {
                        if (esAsignado) {
                          mostrarAviso(
                            `Primero registra la devolución de ${t.code} antes de darle baja lógica.`
                          );
                          return;
                        }
                        establecerBajaModalHerramienta(t);
                        establecerBajaMotivo("");
                        establecerBajaError("");
                      }}
                      style={{ minHeight: 38 }}
                    />
                  )}
                </View>
              </View>
            </Tarjeta>
          );
        })
    )}

      {/* ========================================================================= */}
      {/* 1. MODAL: ALTA DE NUEVA HERRAMIENTA                                       */}
      {/* ========================================================================= */}
      <VistaModal
        visible={nuevoHerramientaModal}
        onClose={() => establecerNuevoHerramientaModal(false)}
        title="Alta de Herramienta / Maquinaria"
        subtitle="Registro de equipo patrimonial y control de mantención preventiva"
      >
        {/* 1. IDENTIFICACIÓN DEL EQUIPO */}
        <Text style={estilos.formularioSeccionEncabezado}>1. Identificación del Equipo</Text>
        <CampoTexto
          label="Código Interno Único"
          value={herramientaCodigo}
          onChangeText={establecerHerramientaCodigo}
          placeholder="Ej: HER-015"
        />
        <CampoTexto
          label="Número de Serie de Fábrica"
          value={herramientaSerie}
          onChangeText={establecerHerramientaSerie}
          placeholder="Ej: SN-98234-BOSCH"
        />
        <CampoTexto
          label="Nombre del Equipo o Herramienta"
          value={herramientaNombre}
          onChangeText={establecerHerramientaNombre}
          placeholder="Ej: Rotomartillo SDS Plus 800W"
        />
        <CampoTexto
          label="Categoría"
          value={herramientaCategoria}
          onChangeText={establecerHerramientaCategoria}
          placeholder="Herramientas Eléctricas, Medición, Soldadura..."
        />
        <View style={estilos.formularioFilaTwo}>
          <CampoTexto
            label="Marca"
            value={herramientaMarca}
            onChangeText={establecerHerramientaMarca}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <CampoTexto
            label="Modelo"
            value={herramientaModelo}
            onChangeText={establecerHerramientaModelo}
            placeholder="GBH 2-26 DRE"
            containerStyle={{ flex: 1 }}
          />
        </View>

        {/* 2. CONTROL DE MANTENCIÓN */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Control de Mantención Preventiva</Text>
        <View style={estilos.formularioFilaTwo}>
          <CampoTexto
            label="Frecuencia (Días)"
            value={herramientaDiasFreq}
            onChangeText={manejarCambioFrecuenciaDias}
            keyboardType="numeric"
            placeholder="90"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <CampoTexto
            label="Fecha Próximo Mantenimiento"
            value={herramientaProximaMantencion}
            onChangeText={establecerHerramientaProximaMantencion}
            placeholder="YYYY-MM-DD"
            containerStyle={{ flex: 1.3 }}
          />
        </View>

        <View style={estilos.calculatedSiguienteCaja}>
          <Ionicons name="calendar-outline" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={estilos.calculatedSiguienteTexto}>
            Próximo mantenimiento programado:{" "}
            <Text style={{ fontWeight: "bold" }}>
              {herramientaProximaMantencion || "Sin definir"}
            </Text>{" "}
            (puedes editar la fecha directamente en formato AAAA-MM-DD).
          </Text>
        </View>

        {Boolean(herramientaError) && <Text style={estilos.errorTexto}>{herramientaError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerNuevoHerramientaModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Guardar Herramienta"
            variant="primary"
            onPress={manejarGuardarNuevoHerramienta}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* 2. MODAL: PRÉSTAMO A TÉCNICO                                              */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(prestamoModalHerramienta)}
        onClose={() => establecerPrestamoModalHerramienta(null)}
        title="Prestar Herramienta a Técnico"
        subtitle={prestamoModalHerramienta ? `${prestamoModalHerramienta.code} • ${prestamoModalHerramienta.name}` : ""}
      >
        <Selector
          label="1. Técnico Responsable en Terreno"
          required
          options={tecnicos.map((t) => ({
            label: t.name,
            value: t.rut,
            hint: `${t.specialty} • RUT: ${t.rut}`,
            icon: "person-outline",
          }))}
          value={prestamoTecnicoRut}
          onChange={establecerPrestamoTecnicoRut}
          placeholder="Seleccionar técnico..."
        />

        <Selector
          label="2. Proyecto / Faena de Destino"
          required
          options={proyectos
            .filter((p) => p.status !== "cerrado")
            .map((p) => ({
              label: `${p.code} • ${p.name}`,
              value: p.code,
              hint: `Cliente: ${p.client || "Asignado"}`,
              icon: "business-outline",
            }))}
          value={prestamoProyectoCodigo}
          onChange={establecerPrestamoProyectoCodigo}
          placeholder="Seleccionar proyecto de destino..."
        />

        <View style={estilos.infoResumenCaja}>
          <Text style={estilos.infoResumenLinea}>
            Fecha de entrega: <Text style={{ fontWeight: "bold" }}>{formatearFecha(hoyCadena)}</Text>
          </Text>
          <Text style={estilos.infoResumenLinea}>
            Condición de salida: <Text style={{ fontWeight: "bold" }}>Operativo y verificado en bodega</Text>
          </Text>
        </View>

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="outline"
            onPress={() => establecerPrestamoModalHerramienta(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Confirmar Préstamo"
            variant="primary"
            onPress={manejarConfirmarPrestamo}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* 3. MODAL: DEVOLUCIÓN DE HERRAMIENTA (BUENO / DAÑADO)                      */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(devolucionModalHerramienta)}
        onClose={() => establecerDevolucionModalHerramienta(null)}
        title="Recepción de Herramienta desde Faena"
        subtitle={devolucionModalHerramienta ? `${devolucionModalHerramienta.code} • En poder de ${devolucionModalHerramienta.currentTechnicianName}` : ""}
      >
        <Text style={estilos.campoEtiqueta}>Estado Físico al Momento del Retorno:</Text>
        <Text style={estilos.modalInstruction}>
          Seleccione la condición operativa del equipo. Si retorna "Dañado", pasará automáticamente a estado "En mantención":
        </Text>

        <View style={estilos.condicionFila}>
          <TouchableOpacity
            onPress={() => establecerDevolucionCondicion("bueno")}
            style={[
              estilos.condicionBoton,
              devolucionCondicion === "bueno" && estilos.condicionBotonBueno,
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={devolucionCondicion === "bueno" ? tema.colors.ok : tema.colors.textMuted}
            />
            <Text
              style={[
                estilos.condicionTitulo,
                devolucionCondicion === "bueno" && { color: tema.colors.ok, fontWeight: "bold" },
              ]}
            >
              BUENO
            </Text>
            <Text style={estilos.condicionSubtitulo}>Retorna a Disponible</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => establecerDevolucionCondicion("danado")}
            style={[
              estilos.condicionBoton,
              devolucionCondicion === "danado" && estilos.condicionBotonDanado,
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={22}
              color={devolucionCondicion === "danado" ? tema.colors.danger : tema.colors.textMuted}
            />
            <Text
              style={[
                estilos.condicionTitulo,
                devolucionCondicion === "danado" && { color: tema.colors.danger, fontWeight: "bold" },
              ]}
            >
              DAÑADO
            </Text>
            <Text style={estilos.condicionSubtitulo}>Pasa a En Mantención</Text>
          </TouchableOpacity>
        </View>

        <CampoTexto
          label="Observaciones sobre desgaste o falla reportada"
          value={devolucionNotas}
          onChangeText={establecerDevolucionNotas}
          placeholder="Ej: Mandril con holgura, cable pelado o chisporroteo..."
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerDevolucionModalHerramienta(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Confirmar Devolución"
            variant={devolucionCondicion === "danado" ? "danger" : "success"}
            onPress={manejarConfirmarDevolucion}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* 4. MODAL: REGISTRO DE MANTENCIÓN                                          */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(maintModalHerramienta)}
        onClose={() => establecerMaintModalHerramienta(null)}
        title="Registrar Mantención de Maquinaria"
        subtitle={maintModalHerramienta ? `${maintModalHerramienta.code} • ${maintModalHerramienta.name}` : ""}
      >
        <Text style={estilos.campoEtiqueta}>Tipo de Servicio Técnico:</Text>
        <View style={estilos.condicionFila}>
          <TouchableOpacity
            onPress={() => establecerMaintTipo("preventiva")}
            style={[
              estilos.condicionBoton,
              maintTipo === "preventiva" && estilos.condicionBotonBueno,
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={maintTipo === "preventiva" ? tema.colors.ok : tema.colors.textMuted}
            />
            <Text
              style={[
                estilos.condicionTitulo,
                maintTipo === "preventiva" && { color: tema.colors.ok, fontWeight: "bold" },
              ]}
            >
              PREVENTIVA
            </Text>
            <Text style={estilos.condicionSubtitulo}>Limpieza y engrase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => establecerMaintTipo("correctiva")}
            style={[
              estilos.condicionBoton,
              maintTipo === "correctiva" && estilos.condicionBotonDanado,
            ]}
          >
            <Ionicons
              name="build-outline"
              size={20}
              color={maintTipo === "correctiva" ? tema.colors.warn : tema.colors.textMuted}
            />
            <Text
              style={[
                estilos.condicionTitulo,
                maintTipo === "correctiva" && { color: tema.colors.warn, fontWeight: "bold" },
              ]}
            >
              CORRECTIVA
            </Text>
            <Text style={estilos.condicionSubtitulo}>Reparación por falla</Text>
          </TouchableOpacity>
        </View>

        <CampoTexto
          label="Taller o Servicio Técnico Oficial"
          value={maintTaller}
          onChangeText={establecerMaintTaller}
          placeholder="Ej: Servicio Técnico Autorizado Bosch"
        />

        <View style={estilos.formularioFilaTwo}>
          <CampoTexto
            label="Costo ($ CLP)"
            value={maintCosto}
            onChangeText={establecerMaintCosto}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <CampoTexto
            label="Próxima Mantención (YYYY-MM-DD)"
            value={maintSiguienteFecha}
            onChangeText={establecerMaintSiguienteFecha}
            placeholder="YYYY-MM-DD"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={estilos.calculatedSiguienteCaja}>
          <Ionicons name="calculator-outline" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={estilos.calculatedSiguienteTexto}>
            Cálculo automático: Fecha mantención + {maintModalHerramienta?.maintenanceFrequencyDays || 90} días de frecuencia.
          </Text>
        </View>

        <CampoTexto
          label="Descripción de Trabajos y Calibración Ejecutada"
          value={maintDescripcion}
          onChangeText={establecerMaintDescripcion}
          placeholder="Ej: Cambio de carbones, calibración de torque, ajuste de rodamientos y prueba de aislamiento..."
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: tema.colors.okLight,
            borderWidth: 1,
            borderColor: tema.colors.ok,
            borderRadius: tema.radius.md,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color={tema.colors.okDark} />
          <Text style={{ flex: 1, fontSize: 11.5, fontWeight: "700", color: tema.colors.okDark }}>
            Al guardar, la herramienta pasará automáticamente a estado DISPONIBLE con nueva fecha de mantención{" "}
            {maintSiguienteFecha || "(ingresar fecha futura)"}.
          </Text>
        </View>

        {Boolean(maintError) && <Text style={estilos.errorTexto}>{maintError}</Text>}

        <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 8 }]}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => {
              establecerMaintError("");
              establecerMaintModalHerramienta(null);
            }}
            style={{ flex: 1, minWidth: 110, minHeight: 44 }}
          />
          <Boton
            title="Completar Mantención"
            variant="success"
            icon="checkmark-done-outline"
            onPress={manejarConfirmarMantencion}
            style={{ flex: 1.8, minWidth: 170, minHeight: 46 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* 5. MODAL: HISTORIAL DE PRÉSTAMOS Y MANTENCIONES                           */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(seleccionadoHerramientaHistorial)}
        onClose={() => establecerSeleccionadoHerramientaHistorial(null)}
        title="Historial de Herramienta"
        subtitle={seleccionadoHerramientaHistorial ? `${seleccionadoHerramientaHistorial.code} • ${seleccionadoHerramientaHistorial.name}` : ""}
      >
        {/* Pestañas internas del historial */}
        <View style={estilos.historialSubPestanas}>
          <TouchableOpacity
            onPress={() => establecerHistorialPestana("prestamos")}
            style={[estilos.historialSubPestana, historialPestana === "prestamos" && estilos.historialSubPestanaActivo]}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={historialPestana === "prestamos" ? tema.colors.primary : tema.colors.textMuted}
            />
            <Text style={[estilos.historialSubPestanaTexto, historialPestana === "prestamos" && estilos.historialSubPestanaTextoActivo]}>
              Préstamos ({seleccionadoHerramientaHistorial?.loans?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => establecerHistorialPestana("mantenciones")}
            style={[estilos.historialSubPestana, historialPestana === "mantenciones" && estilos.historialSubPestanaActivo]}
          >
            <Ionicons
              name="build-outline"
              size={16}
              color={historialPestana === "mantenciones" ? tema.colors.primary : tema.colors.textMuted}
            />
            <Text style={[estilos.historialSubPestanaTexto, historialPestana === "mantenciones" && estilos.historialSubPestanaTextoActivo]}>
              Mantenciones ({seleccionadoHerramientaHistorial?.maintenances?.length || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5.A. Historial de Préstamos */}
        {historialPestana === "prestamos" && (
          <ScrollView style={{ maxHeight: 380 }}>
            {seleccionadoHerramientaHistorial?.loans && seleccionadoHerramientaHistorial.loans.length > 0 ? (
              seleccionadoHerramientaHistorial.loans.map((ln) => {
                const esDevuelto = Boolean(ln.returnDate);
                const esDanado = ln.returnCondition === "danado";
                return (
                  <View key={ln.id} style={estilos.historialElementoTarjeta}>
                    <View style={estilos.historialElementoEncabezado}>
                      <View style={{ flex: 1 }}>
                        <Text style={estilos.historialElementoTecnico}>{ln.technicianName}</Text>
                        <Text style={estilos.historialElementoRut}>{ln.technicianRut}</Text>
                      </View>
                      <Insignia
                        label={esDevuelto ? (esDanado ? "Dañado" : "Bueno") : "Terreno"}
                        tone={!esDevuelto ? "info" : esDanado ? "danger" : "ok"}
                        size="sm"
                      />
                    </View>

                    <Text style={estilos.historialElementoProyecto}>
                      Faena: {ln.projectName} ({ln.projectCode})
                    </Text>

                    <View style={estilos.historialFechasFila}>
                      <Text style={estilos.historialFechaTexto}>
                        Salida: <Text style={{ fontWeight: "bold" }}>{formatearFecha(ln.loanDate)}</Text>
                      </Text>
                      <Text style={estilos.historialFechaTexto}>
                        Retorno: <Text style={{ fontWeight: "bold" }}>{ln.returnDate ? formatearFecha(ln.returnDate) : "En uso"}</Text>
                      </Text>
                    </View>

                    {ln.returnNotes && (
                      <View style={estilos.historialNotasCaja}>
                        <Text style={estilos.historialNotasTexto}>Obs: "{ln.returnNotes}"</Text>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={estilos.vacioNota}>Sin registros de préstamos en el historial.</Text>
            )}
          </ScrollView>
        )}

        {/* 5.B. Historial de Mantenciones */}
        {historialPestana === "mantenciones" && (
          <ScrollView style={{ maxHeight: 380 }}>
            {seleccionadoHerramientaHistorial?.maintenances && seleccionadoHerramientaHistorial.maintenances.length > 0 ? (
              seleccionadoHerramientaHistorial.maintenances.map((mn) => (
                <View key={mn.id} style={estilos.historialElementoTarjeta}>
                  <View style={estilos.historialElementoEncabezado}>
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.historialElementoTecnico}>
                        {mn.type.toUpperCase()} • {mn.workshop}
                      </Text>
                      <Text style={estilos.historialElementoRut}>Fecha: {formatearFecha(mn.date)}</Text>
                    </View>
                    <Insignia label={formatearCLP(mn.cost)} tone="mute" size="sm" />
                  </View>

                  <Text style={estilos.historialElementoProyecto}>{mn.description}</Text>

                  <View style={estilos.historialFechasFila}>
                    <Text style={estilos.historialFechaTexto}>
                      Próxima programada: <Text style={{ fontWeight: "bold" }}>{formatearFecha(mn.nextMaintenanceDate)}</Text>
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={estilos.vacioNota}>Sin registros de mantenciones realizadas.</Text>
            )}
          </ScrollView>
        )}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cerrar Historial"
            variant="ghost"
            onPress={() => establecerSeleccionadoHerramientaHistorial(null)}
            style={{ width: "100%", height: 44 }}
          />
        </View>
      </VistaModal>

      {/* ========================================================================= */}
      {/* 6. MODAL: VISUALIZACIÓN DE CÓDIGO QR DE ACTIVO FIJO                       */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(qrModalHerramienta)}
        onClose={() => establecerQrModalHerramienta(null)}
        title={qrModalHerramienta ? `Código QR — ${qrModalHerramienta.code}` : "Código QR"}
        subtitle={
          qrModalHerramienta
            ? `${qrModalHerramienta.name} • Serie: ${qrModalHerramienta.serialNumber}`
            : ""
        }
      >
        {qrModalHerramienta && (() => {
          const payloadQr = construirPayloadQrHerramienta(qrModalHerramienta);
          return (
            <View style={{ gap: 14 }}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <CodigoQrHerramientaSvg contenido={payloadQr} tamano={196} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  <Insignia label={`QR-HER-${qrModalHerramienta.code}`} tone="primary" size="sm" />
                  <InsigniaEstado status={qrModalHerramienta.status} size="sm" />
                </View>
              </View>

              <View
                style={{
                  backgroundColor: tema.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: tema.colors.border,
                  borderRadius: tema.radius.md,
                  padding: 12,
                  gap: 5,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: tema.colors.text }}>
                  Datos Embebidos del Activo Fijo:
                </Text>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                  • Código Interno: <Text style={{ fontWeight: "700" }}>{qrModalHerramienta.code}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                  • N° Serie: <Text style={{ fontWeight: "700" }}>{qrModalHerramienta.serialNumber}</Text>
                </Text>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                  • Marca / Modelo:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {qrModalHerramienta.brand} {qrModalHerramienta.model}
                  </Text>
                </Text>
                <Text style={{ fontSize: 12, color: tema.colors.textSecondary }}>
                  • Próximo Mantenimiento:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {formatearFecha(qrModalHerramienta.nextMaintenanceDate)}
                  </Text>
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: "#0f172a",
                  borderRadius: tema.radius.md,
                  padding: 10,
                }}
              >
                <Text style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: "700", marginBottom: 4 }}>
                  PAYLOAD JSON EMBEBIDO:
                </Text>
                <Text style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "monospace" }}>
                  {payloadQr}
                </Text>
              </View>

              <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 8 }]}>
                <Boton
                  title="Imprimir Etiqueta QR"
                  variant="primary"
                  size="sm"
                  icon="print-outline"
                  onPress={() => manejarImprimirQrWeb(qrModalHerramienta)}
                  style={{ flex: 1, minWidth: 150, minHeight: 42 }}
                />
                <Boton
                  title="Cerrar"
                  variant="ghost"
                  size="sm"
                  onPress={() => establecerQrModalHerramienta(null)}
                  style={{ flex: 1, minWidth: 110, minHeight: 42 }}
                />
              </View>
            </View>
          );
        })()}
      </VistaModal>

      {/* ========================================================================= */}
      {/* 7. MODAL: BAJA LÓGICA DE HERRAMIENTA (CONSERVA HISTORIAL PATRIMONIAL)     */}
      {/* ========================================================================= */}
      <VistaModal
        visible={Boolean(bajaModalHerramienta)}
        onClose={() => establecerBajaModalHerramienta(null)}
        title="Confirmar Baja Lógica de Herramienta"
        subtitle={
          bajaModalHerramienta
            ? `${bajaModalHerramienta.code} • ${bajaModalHerramienta.name}`
            : ""
        }
      >
        <View
          style={{
            backgroundColor: tema.colors.dangerLight,
            borderWidth: 1,
            borderColor: tema.colors.danger,
            borderRadius: tema.radius.md,
            padding: 12,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <Ionicons name="alert-circle" size={20} color={tema.colors.danger} />
          <Text style={{ flex: 1, fontSize: 12, color: tema.colors.text, lineHeight: 17 }}>
            La baja es <Text style={{ fontWeight: "800" }}>lógica</Text>: el activo pasará a estado{" "}
            <Text style={{ fontWeight: "800" }}>Dada de Baja</Text>, no podrá volver a prestarse y
            se conservará íntegro su historial de préstamos y mantenciones para auditoría.
          </Text>
        </View>

        <CampoTexto
          label="Motivo Obligatorio de la Baja Lógica"
          value={bajaMotivo}
          onChangeText={(txt) => {
            establecerBajaMotivo(txt);
            if (bajaError) establecerBajaError("");
          }}
          placeholder="Ej: Daño irreparable en motor / Vida útil cumplida / Extravío confirmado"
          multiline
        />

        {Boolean(bajaError) && <Text style={estilos.errorTexto}>{bajaError}</Text>}

        <View style={[estilos.modalBotonesFila, { flexWrap: "wrap", gap: 8 }]}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerBajaModalHerramienta(null)}
            style={{ flex: 1, minWidth: 110, minHeight: 44 }}
          />
          <Boton
            title="Confirmar Baja Lógica"
            variant="danger"
            icon="archive-outline"
            onPress={manejarConfirmarBajaLogica}
            style={{ flex: 1.5, minWidth: 160, minHeight: 44 }}
          />
        </View>
      </VistaModal>
      </ScrollView>
      </View>
    </ContenedorEstadoPantalla>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollContenedor: {
    flex: 1,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  crearHerramientaHeroTarjeta: {
    marginBottom: tema.spacing.md,
    backgroundColor: tema.colors.card,
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  crearHerramientaHeroContenido: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  crearHerramientaHeroIzquierda: {
    flex: 1,
    minWidth: 260,
  },
  herramientaInsigniaFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  herramientaInsigniaHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
    marginLeft: 8,
  },
  crearHerramientaHeroTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 2,
  },
  crearHerramientaHeroDescripcion: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    lineHeight: 18,
  },
  botonCrearHerramientaGrande: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: tema.radius.md,
    alignSelf: "flex-start",
  },
  superiorBarra: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tema.spacing.md,
    flexWrap: "wrap",
    gap: 8,
  },
  encabezado: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  subEncabezado: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
    maxWidth: 260,
  },
  kpisFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: tema.spacing.md,
  },
  kpiTarjeta: {
    flex: 1,
    minWidth: 64,
    backgroundColor: tema.colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  kpiTarjetaPeligro: {
    backgroundColor: tema.colors.dangerLight,
    borderColor: tema.colors.dangerBorder,
  },
  kpiValor: {
    fontSize: tema.fontSize.md,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
  },
  kpiLbl: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  buscarFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: tema.spacing.md,
    height: 42,
    marginBottom: tema.spacing.xs,
  },
  buscarIcono: {
    marginRight: 6,
  },
  buscarEntrada: {
    flex: 1,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
  },
  limpiarBuscarBoton: {
    padding: 4,
  },
  filtrarScroll: {
    marginBottom: tema.spacing.md,
  },
  filtrarChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 8,
  },
  filtrarChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  filtrarChipPeligro: {
    borderColor: tema.colors.danger,
  },
  filtrarChipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    fontWeight: "500",
  },
  filtrarChipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  herramientaTarjeta: {
    marginBottom: tema.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
  },
  overdueTarjeta: {
    borderLeftColor: tema.colors.danger,
    borderWidth: tema.borders.thin,
    borderColor: tema.colors.dangerBorder,
    backgroundColor: tema.colors.dangerLight,
  },
  nearDueTarjeta: {
    borderLeftColor: tema.colors.warn,
    borderWidth: 1.5,
    borderColor: tema.colors.warn,
  },
  herramientaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 6,
  },
  herramientaCodigoFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  herramientaCodigo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginRight: 8,
  },
  herramientaSerie: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  peligroPastilla: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tema.radius.full,
    marginLeft: 8,
  },
  peligroPastillaTexto: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    marginLeft: 2,
  },
  herramientaNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  herramientaMarcaModelo: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  asignadoCaja: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  asignadoInfo: {
    marginLeft: 8,
    flex: 1,
  },
  asignadoTecnico: {
    fontSize: 12,
    color: tema.colors.text,
  },
  asignadoProyecto: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  mantencionFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginTop: 8,
  },
  mantencionFilaOverdue: {
    backgroundColor: tema.colors.dangerLight,
  },
  mantencionFilaNearDue: {
    backgroundColor: tema.colors.warnLight,
  },
  maintColumna: {
    flex: 1,
  },
  maintFechaEtiqueta: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textMuted,
  },
  maintFechaValor: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    marginTop: 1,
  },
  overdueFechaValor: {
    color: tema.colors.danger,
    fontWeight: "900",
  },
  nearDueFechaValor: {
    color: tema.colors.warnDark,
    fontWeight: "bold",
  },
  maintFreqTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  maintInsigniaEnvoltorio: {
    alignItems: "flex-end",
  },
  herramientaAccionesFila: {
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
  historialBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  historialBotonTexto: {
    fontSize: 12,
    color: tema.colors.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  accionBtnsGrupo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  formularioFilaTwo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calculatedSiguienteCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 10,
  },
  calculatedSiguienteTexto: {
    fontSize: 11,
    color: tema.colors.primaryDark,
    flex: 1,
  },
  errorTexto: {
    color: tema.colors.danger,
    fontSize: tema.fontSize.xs,
    marginTop: 4,
    marginBottom: 8,
    fontWeight: "bold",
  },
  modalBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  campoEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 10,
  },
  chipBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 6,
  },
  chipBotonActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  chipTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    fontWeight: "500",
  },
  chipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  infoResumenCaja: {
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginVertical: 8,
  },
  infoResumenLinea: {
    fontSize: 12,
    color: tema.colors.text,
    marginVertical: 2,
  },
  modalInstruction: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginBottom: 10,
  },
  condicionFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  condicionBoton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: tema.radius.md,
    borderWidth: 1.5,
    borderColor: tema.colors.borderDark,
    backgroundColor: tema.colors.surface,
    marginHorizontal: 4,
  },
  condicionBotonBueno: {
    borderColor: tema.colors.ok,
    backgroundColor: tema.colors.okLight,
  },
  condicionBotonDanado: {
    borderColor: tema.colors.danger,
    backgroundColor: tema.colors.dangerLight,
  },
  condicionTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    marginTop: 4,
  },
  condicionSubtitulo: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  historialSubPestanas: {
    flexDirection: "row",
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.md,
    padding: 3,
    marginBottom: 12,
  },
  historialSubPestana: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: tema.radius.sm,
  },
  historialSubPestanaActivo: {
    backgroundColor: tema.colors.card,
    elevation: 1,
    shadowColor: tema.colors.text,
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  historialSubPestanaTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textMuted,
    marginLeft: 6,
  },
  historialSubPestanaTextoActivo: {
    color: tema.colors.primary,
    fontWeight: tema.fontWeight.semibold,
  },
  historialElementoTarjeta: {
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  historialElementoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 6,
  },
  historialElementoTecnico: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
  },
  historialElementoRut: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
  },
  historialElementoProyecto: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.primaryDark,
    fontWeight: tema.fontWeight.semibold,
    marginTop: 2,
  },
  historialFechasFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    flexWrap: "wrap",
    gap: 6,
  },
  historialFechaTexto: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.textMuted,
  },
  historialNotasCaja: {
    backgroundColor: tema.colors.warnLight,
    padding: 6,
    borderRadius: tema.radius.sm,
    marginTop: 6,
  },
  historialNotasTexto: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.warnDark,
    fontStyle: "italic",
  },
  vacioNota: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
  formularioSeccionEncabezado: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.primaryDark,
    marginTop: tema.spacing.md,
    marginBottom: tema.spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
