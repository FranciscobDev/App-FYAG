import React, { useState } from "react";
import {
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
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { EncabezadoPagina } from "@/componentes/base/EncabezadoPagina";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";
import { Herramienta, EstadoHerramienta } from "@/nucleo/tipos";

export const PantallaHerramientas: React.FC = () => {
  const {
    herramientas,
    tecnicos,
    proyectos,
    crearHerramienta,
    prestarHerramienta,
    devolverHerramienta,
    registrarMantencionHerramienta,
  } = usarAplicacion();
  const { rolActual } = usarAutenticacion();

  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [filtrarEstado, establecerFiltrarEstado] = useState<string>("todos");

  // Herramienta seleccionada para ver Historial (Préstamos y Mantenciones)
  const [seleccionadoHerramientaHistorial, establecerSeleccionadoHerramientaHistorial] = useState<Herramienta | null>(null);
  const [historialPestana, establecerHistorialPestana] = useState<"prestamos" | "mantenciones">("prestamos");

  // 1. Alta de Herramienta Modal
  const [nuevoHerramientaModal, establecerNuevoHerramientaModal] = useState(false);
  const [herramientaCodigo, establecerHerramientaCodigo] = useState("");
  const [herramientaSerie, establecerHerramientaSerie] = useState("");
  const [herramientaNombre, establecerHerramientaNombre] = useState("");
  const [herramientaCategoria, establecerHerramientaCategoria] = useState("Herramientas Eléctricas");
  const [herramientaMarca, establecerHerramientaMarca] = useState("Bosch");
  const [herramientaModelo, establecerHerramientaModelo] = useState("");
  const [herramientaDiasFreq, establecerHerramientaDiasFreq] = useState("90");
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

  // KPIs de inventario de maquinaria
  const totalConteo = herramientas.length;
  const disponibleConteo = herramientas.filter((t) => t.status === "disponible").length;
  const asignadoConteo = herramientas.filter((t) => t.status === "asignada").length;
  const mantencionConteo = herramientas.filter((t) => t.status === "en_mantencion").length;
  const overdueConteo = herramientas.filter((t) => {
    if (t.status === "dada_de_baja") return false;
    return obtenerDiasUntilMantencion(t.nextMaintenanceDate) <= 0;
  }).length;

  // Filtrado de herramientas
  const filtradoHerramientas = herramientas.filter((t) => {
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

    if (filtrarEstado !== "todos" && t.status !== filtrarEstado) {
      return false;
    }
    return coincidenciaQuery;
  });

  // Guardar nueva herramienta
  const manejarAbrirNuevoHerramientaModal = () => {
    establecerHerramientaCodigo(`HER-${String(herramientas.length + 1).padStart(3, "0")}`);
    establecerHerramientaSerie("");
    establecerHerramientaNombre("");
    establecerHerramientaModelo("");
    establecerHerramientaError("");
    establecerNuevoHerramientaModal(true);
  };

  const manejarGuardarNuevoHerramienta = () => {
    if (!herramientaCodigo.trim() || !herramientaNombre.trim() || !herramientaSerie.trim()) {
      establecerHerramientaError("Código, Nombre y N° de Serie son obligatorios.");
      return;
    }

    const freqDias = Number(herramientaDiasFreq) || 90;
    const siguienteMaint = new Date(Date.now() + freqDias * 86400000)
      .toISOString()
      .slice(0, 10);

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
      nextMaintenanceDate: siguienteMaint,
      loans: [],
      maintenances: [],
    };

    const resultado = crearHerramienta(nuevoT);
    if (!resultado.success) {
      establecerHerramientaError(resultado.error || "Error al crear herramienta.");
    } else {
      establecerNuevoHerramientaModal(false);
    }
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

  // Confirmar registro de mantención
  const manejarConfirmarMantencion = () => {
    if (!maintModalHerramienta) return;
    registrarMantencionHerramienta(maintModalHerramienta.id, {
      toolId: maintModalHerramienta.id,
      date: hoyCadena,
      type: maintTipo,
      workshop: maintTaller,
      cost: Number(maintCosto) || 0,
      description: maintDescripcion,
      nextMaintenanceDate: maintSiguienteFecha,
      performedBy: usuarioRolDisplay(rolActual),
    });
    establecerMaintModalHerramienta(null);
  };

  const usuarioRolDisplay = (role: string) => {
    if (role === "admin") return "Administración Central";
    if (role === "warehouse") return "Bodega Central";
    return "Técnico en Terreno";
  };

  return (
    <ContenedorEstadoPantalla screenTitle="Control de Herramientas" skeletonType="table">
      <View style={estilos.contenedor}>
        {/* ========================================================================= */}
        {/* HEADER LIMPIO Y RESPONSIVO (ANCHO COMPLETO EDGE-TO-EDGE)                   */}
        {/* ========================================================================= */}
        <EncabezadoPagina
          title="Control de Herramientas"
          subtitle={
            rolActual === "warehouse"
              ? undefined
              : "Asignaciones a faena, control de mantenciones preventivas y calibración"
          }
        />

        <ScrollView style={estilos.scrollContenedor} contentContainerStyle={estilos.contenido}>
          {/* ========================================================================= */}
          {/* KPIS DE RESUMEN                                                           */}
          {/* ========================================================================= */}
          <View style={estilos.kpisFila}>
        <View style={estilos.kpiTarjeta}>
          <Text style={estilos.kpiValor}>{totalConteo}</Text>
          <Text style={estilos.kpiLbl}>Total Equipos</Text>
        </View>

        <View style={[estilos.kpiTarjeta, { borderColor: tema.colors.ok }]}>
          <Text style={[estilos.kpiValor, { color: tema.colors.ok }]}>{disponibleConteo}</Text>
          <Text style={estilos.kpiLbl}>Disponibles</Text>
        </View>

        <View style={[estilos.kpiTarjeta, { borderColor: tema.colors.info }]}>
          <Text style={[estilos.kpiValor, { color: tema.colors.info }]}>{asignadoConteo}</Text>
          <Text style={estilos.kpiLbl}>Asignadas</Text>
        </View>

        <View style={[estilos.kpiTarjeta, { borderColor: tema.colors.warn }]}>
          <Text style={[estilos.kpiValor, { color: tema.colors.warn }]}>{mantencionConteo}</Text>
          <Text style={estilos.kpiLbl}>En Mantención</Text>
        </View>

        {overdueConteo > 0 && (
          <View style={[estilos.kpiTarjeta, estilos.kpiTarjetaPeligro]}>
            <Text style={[estilos.kpiValor, { color: tema.colors.danger }]}>{overdueConteo}</Text>
            <Text style={[estilos.kpiLbl, { color: tema.colors.danger }]}>¡Vencidas!</Text>
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* BOTÓN PROMINENTE PARA REGISTRAR NUEVA HERRAMIENTA O EQUIPO                */}
      {/* ========================================================================= */}
      {rolActual !== "technician" && (
        <Tarjeta style={estilos.crearHerramientaHeroTarjeta}>
          <View style={estilos.crearHerramientaHeroContenido}>
            <View style={estilos.crearHerramientaHeroIzquierda}>
              <View style={estilos.herramientaInsigniaFila}>
                <Insignia label="Activos" tone="primary" size="sm" />
                <Text style={estilos.herramientaInsigniaHint}>Control de Equipos y Maquinarias</Text>
              </View>
              <Text style={estilos.crearHerramientaHeroTitulo}>Registrar Nueva Herramienta o Equipo</Text>
              <Text style={estilos.crearHerramientaHeroDescripcion}>
                Ingresa maquinaria o herramientas con código interno, serie, marca y periodicidad de mantención para faena.
              </Text>
            </View>
            <Boton
              title="+ Registrar Nueva Herramienta"
              variant="primary"
              size="md"
              icon="add-circle-outline"
              onPress={manejarAbrirNuevoHerramientaModal}
              style={estilos.botonCrearHerramientaGrande}
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
          { id: "dada_de_baja", label: "Dadas de Baja" },
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
        const esNearDue = !esRetired && diasIzquierda > 0 && diasIzquierda <= 5;
        const esAsignado = t.status === "asignada";
        const esDisponible = t.status === "disponible";

        return (
          <Tarjeta
            key={t.id}
            variant="elevated"
            style={[
              estilos.herramientaTarjeta,
              esOverdue && estilos.overdueTarjeta,
              esNearDue && estilos.nearDueTarjeta,
            ]}
          >
            {/* Top row: Código, S/N, Nombre y EstadoBadge */}
            <View style={estilos.herramientaSuperior}>
              <View style={{ flex: 1 }}>
                <View style={estilos.herramientaCodigoFila}>
                  <Text style={estilos.herramientaCodigo}>{t.code}</Text>
                  <Text style={estilos.herramientaSerie}>S/N: {t.serialNumber}</Text>
                  {esOverdue && (
                    <View style={estilos.peligroPastilla}>
                      <Ionicons name="alert-circle" size={12} color="#ffffff" />
                      <Text style={estilos.peligroPastillaTexto}>VENCIDA</Text>
                    </View>
                  )}
                </View>
                <Text style={estilos.herramientaNombre}>{t.name}</Text>
                <Text style={estilos.herramientaMarcaModelo}>
                  {t.brand} {t.model} • Categoría: <Text style={{ color: tema.colors.text }}>{t.category}</Text>
                </Text>
              </View>

              <InsigniaEstado status={t.status} size="md" />
            </View>

            {/* Ficha de Asignación si está en Faena */}
            {esAsignado && (
              <View style={estilos.asignadoCaja}>
                <Ionicons name="person" size={16} color={tema.colors.info} style={{ marginTop: 2 }} />
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

            {/* Control de Próxima Mantención (Resaltado si vencida) */}
            <View style={[
              estilos.mantencionFila,
              esOverdue && estilos.mantencionFilaOverdue,
              esNearDue && estilos.mantencionFilaNearDue,
            ]}>
              <View style={estilos.maintColumna}>
                <Text style={estilos.maintFechaEtiqueta}>Próxima Mantención Preventiva:</Text>
                <Text style={[
                  estilos.maintFechaValor,
                  esOverdue && estilos.overdueFechaValor,
                  esNearDue && estilos.nearDueFechaValor,
                ]}>
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
                  <Insignia
                    label="Vencida"
                    tone="danger"
                    icon="alert-circle"
                    size="sm"
                  />
                ) : esNearDue ? (
                  <Insignia
                    label="Próxima"
                    tone="warn"
                    icon="time-outline"
                    size="sm"
                  />
                ) : (
                  <Insignia
                    label="Vigente"
                    tone="ok"
                    icon="checkmark-circle-outline"
                    size="sm"
                  />
                )}
              </View>
            </View>

            {/* BOTONES DE ACCIÓN */}
            <View style={estilos.herramientaAccionesFila}>
              {/* Botón Historial de Préstamos */}
              <TouchableOpacity
                onPress={() => {
                  establecerSeleccionadoHerramientaHistorial(t);
                  establecerHistorialPestana("prestamos");
                }}
                style={estilos.historialBoton}
              >
                <Ionicons name="time-outline" size={16} color={tema.colors.primary} />
                <Text style={estilos.historialBotonTexto}>
                  Historial ({t.loans?.length || 0})
                </Text>
              </TouchableOpacity>

              <View style={estilos.accionBtnsGrupo}>
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
                    style={{ marginRight: 6, height: 38 }}
                  />
                )}

                {/* 2. Devolución de Herramienta (Asignada) */}
                {esAsignado && rolActual !== "technician" && (
                  <Boton
                    title="Devolver (Bueno/Dañado)"
                    variant="secondary"
                    size="sm"
                    icon="return-down-back-outline"
                    onPress={() => {
                      establecerDevolucionModalHerramienta(t);
                      establecerDevolucionCondicion("bueno");
                      establecerDevolucionNotas("");
                    }}
                    style={{ marginRight: 6, height: 38 }}
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
                      establecerMaintTipo(t.status === "en_mantencion" ? "correctiva" : "preventiva");
                      establecerMaintTaller("Servicio Técnico Oficial Bosch");
                      establecerMaintCosto("35000");
                      establecerMaintDescripcion(t.status === "en_mantencion" ? "Reparación y cambio de piezas averiadas" : "Limpieza, calibración y engrase general");
                      // Próxima fecha calculada automáticamente
                      const calculoSiguiente = new Date(Date.now() + t.maintenanceFrequencyDays * 86400000)
                        .toISOString()
                        .slice(0, 10);
                      establecerMaintSiguienteFecha(calculoSiguiente);
                    }}
                    style={{ height: 38 }}
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
        <CampoTexto
          label="Frecuencia Mantención Preventiva (Días)"
          value={herramientaDiasFreq}
          onChangeText={establecerHerramientaDiasFreq}
          keyboardType="numeric"
          placeholder="90"
        />

        <View style={estilos.calculatedSiguienteCaja}>
          <Ionicons name="information-circle" size={16} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
          <Text style={estilos.calculatedSiguienteTexto}>
            Próxima mantención calculada:{" "}
            <Text style={{ fontWeight: "bold" }}>
              {new Date(Date.now() + (Number(herramientaDiasFreq) || 90) * 86400000).toISOString().slice(0, 10)}
            </Text>{" "}
            (en {Number(herramientaDiasFreq) || 90} días).
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
        <Text style={estilos.campoEtiqueta}>1. Técnico Responsable en Terreno:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
          {tecnicos.map((t) => {
            const esSeleccionado = prestamoTecnicoRut === t.rut;
            return (
              <TouchableOpacity
                key={t.rut}
                onPress={() => establecerPrestamoTecnicoRut(t.rut)}
                style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={esSeleccionado ? "#ffffff" : tema.colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}>
                  {t.name} ({t.rut})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={estilos.campoEtiqueta}>2. Proyecto / Faena de Destino:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
          {proyectos
            .filter((p) => p.status !== "cerrado")
            .map((p) => {
              const isSelected = prestamoProyectoCodigo === p.code;
              return (
                <TouchableOpacity
                  key={p.code}
                  onPress={() => establecerPrestamoProyectoCodigo(p.code)}
                  style={[estilos.chipBoton, isSelected && estilos.chipBotonActivo]}
                >
                  <Ionicons
                    name="business-outline"
                    size={14}
                    color={isSelected ? "#ffffff" : tema.colors.textMuted}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[estilos.chipTexto, isSelected && estilos.chipTextoActivo]}>
                    {p.code} - {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

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
            variant="ghost"
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
          label="Descripción de Trabajos Realizados"
          value={maintDescripcion}
          onChangeText={establecerMaintDescripcion}
          placeholder="Ej: Cambio de carbones, ajuste de rodamientos y prueba de aislamiento..."
        />

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerMaintModalHerramienta(null)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Guardar Mantención"
            variant="success"
            onPress={manejarConfirmarMantencion}
            style={{ flex: 2, height: 46 }}
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
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  kpiTarjeta: {
    flex: 1,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
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
