import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { KitProyecto } from "@/nucleo/tipos";
import {
  ClienteProyecto,
  FormularioCliente,
  ModalidadPlanMantencion,
  PlanMantencionCliente,
  actualizarClienteApi,
  alternarEstadoClienteApi,
  crearClienteApi,
  crearPlanMantencionApi,
  listarClientes,
  listarPlanesMantencion,
  registrarSeguimientoContactoApi,
  sumarMesesFecha,
} from "./clientesApi";
import { Proyecto, crearProyecto } from "./proyectosApi";

interface PropiedadesModalClientesSeguimiento {
  visible: boolean;
  initialTab?: "clientes" | "seguimiento";
  proyectos: Proyecto[];
  kits: KitProyecto[];
  onClose: () => void;
  onSeleccionarClienteParaProyecto?: (cliente: ClienteProyecto) => void;
  onDatosActualizados?: () => void;
  onAviso?: (msg: string) => void;
}

const FRECUENCIAS_PRESET = [3, 6, 10, 12];
const CANALES_CONTACTO = ["Teléfono", "WhatsApp", "Correo", "Visita"] as const;
const RESULTADOS_CONTACTO = [
  "Cliente Contactado",
  "Visita Confirmada",
  "Pospuesto por Cliente",
  "Pendiente Contacto",
] as const;

export const ModalGestionClientesSeguimiento: React.FC<PropiedadesModalClientesSeguimiento> = ({
  visible,
  initialTab = "clientes",
  proyectos,
  kits,
  onClose,
  onSeleccionarClienteParaProyecto,
  onDatosActualizados,
  onAviso,
}) => {
  const [pestanaActiva, establecerPestanaActiva] = useState<"clientes" | "seguimiento">(initialTab);
  const [cargando, establecerCargando] = useState(true);
  const [clientes, establecerClientes] = useState<ClienteProyecto[]>([]);
  const [planes, establecerPlanes] = useState<PlanMantencionCliente[]>([]);

  // Filtros
  const [busquedaCliente, establecerBusquedaCliente] = useState("");
  const [filtroSemaforoPlan, establecerFiltroSemaforoPlan] = useState<
    "todos" | "vencidos" | "proximos" | "al_dia"
  >("todos");

  // Estado formulario Cliente (Crear / Editar)
  const [modoFormCliente, establecerModoFormCliente] = useState(false);
  const [editandoClienteId, establecerEditandoClienteId] = useState<number | null>(null);
  const [cliRut, establecerCliRut] = useState("");
  const [cliRazonSocial, establecerCliRazonSocial] = useState("");
  const [cliGiro, establecerCliGiro] = useState("");
  const [cliContacto, establecerCliContacto] = useState("");
  const [cliTelefono, establecerCliTelefono] = useState("");
  const [cliCorreo, establecerCliCorreo] = useState("");
  const [cliDireccion, establecerCliDireccion] = useState("");
  const [cliBanco, establecerCliBanco] = useState("");
  const [cliNumeroCuenta, establecerCliNumeroCuenta] = useState("");
  const [errorFormCliente, establecerErrorFormCliente] = useState("");
  const [guardandoCliente, establecerGuardandoCliente] = useState(false);

  // Estado formulario Nuevo Plan de Mantención
  const [modoFormPlan, establecerModoFormPlan] = useState(false);
  const [planClienteId, establecerPlanClienteId] = useState<number | null>(null);
  const [planProyectoOrigenId, establecerPlanProyectoOrigenId] = useState<number | null>(null);
  const [planTitulo, establecerPlanTitulo] = useState("");
  const [planModalidad, establecerPlanModalidad] = useState<ModalidadPlanMantencion>("POR_KIT");
  const [planKitId, establecerPlanKitId] = useState<number | null>(null);
  const [planCodigoContrato, establecerPlanCodigoContrato] = useState("");
  const [planFrecuenciaMeses, establecerPlanFrecuenciaMeses] = useState<string>("3");
  const [planFechaBase, establecerPlanFechaBase] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [planCostoPactado, establecerPlanCostoPactado] = useState<string>("0");
  const [planNotas, establecerPlanNotas] = useState("");
  const [errorFormPlan, establecerErrorFormPlan] = useState("");
  const [guardandoPlan, establecerGuardandoPlan] = useState(false);

  // Estado Modal / Panel de Contacto y Seguimiento
  const [planContactando, establecerPlanContactando] = useState<PlanMantencionCliente | null>(null);
  const [segCanal, establecerSegCanal] = useState<(typeof CANALES_CONTACTO)[number]>("Teléfono");
  const [segResultado, establecerSegResultado] = useState<(typeof RESULTADOS_CONTACTO)[number]>(
    "Visita Confirmada"
  );
  const [segObservaciones, establecerSegObservaciones] = useState("");
  const [segGenerarFaena, establecerSegGenerarFaena] = useState(true);
  const [guardandoSeguimiento, establecerGuardandoSeguimiento] = useState(false);

  // Historial expandido por plan
  const [planesExpandidos, establecerPlanesExpandidos] = useState<Record<number, boolean>>({});

  const cargarTodo = async () => {
    establecerCargando(true);
    const [resCli, resPlanes] = await Promise.all([listarClientes(), listarPlanesMantencion()]);
    if (resCli.ok && resCli.data) {
      establecerClientes(resCli.data);
    }
    if (resPlanes.ok && resPlanes.data) {
      establecerPlanes(resPlanes.data);
    }
    establecerCargando(false);
  };

  useEffect(() => {
    if (visible) {
      establecerPestanaActiva(initialTab);
      establecerModoFormCliente(false);
      establecerModoFormPlan(false);
      establecerPlanContactando(null);
      cargarTodo();
    }
  }, [visible, initialTab]);

  // Calcular próxima fecha sugerida en formulario de plan
  const fechaProximaCalculada = useMemo(() => {
    const meses = Math.max(1, Math.min(60, Number(planFrecuenciaMeses) || 3));
    return sumarMesesFecha(planFechaBase, meses);
  }, [planFechaBase, planFrecuenciaMeses]);

  // Filtrado de clientes
  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        c.rut_cliente.toLowerCase().includes(q) ||
        (c.giro ?? "").toLowerCase().includes(q) ||
        (c.nombre_contacto ?? "").toLowerCase().includes(q)
    );
  }, [clientes, busquedaCliente]);

  // Clasificación semáforo de planes
  const contadoresPlanes = useMemo(() => {
    let vencidos = 0;
    let proximos = 0;
    let alDia = 0;
    planes.forEach((p) => {
      const dias = p.dias_restantes ?? 30;
      if (dias < 0) vencidos++;
      else if (dias <= 30) proximos++;
      else alDia++;
    });
    return { vencidos, proximos, alDia, total: planes.length };
  }, [planes]);

  const planesFiltrados = useMemo(() => {
    return planes.filter((p) => {
      const dias = p.dias_restantes ?? 30;
      if (filtroSemaforoPlan === "vencidos") return dias < 0;
      if (filtroSemaforoPlan === "proximos") return dias >= 0 && dias <= 30;
      if (filtroSemaforoPlan === "al_dia") return dias > 30;
      return true;
    });
  }, [planes, filtroSemaforoPlan]);

  // ===========================================================================
  // HANDLERS CLIENTE
  // ===========================================================================
  const abrirNuevoCliente = () => {
    establecerEditandoClienteId(null);
    establecerCliRut("");
    establecerCliRazonSocial("");
    establecerCliGiro("");
    establecerCliContacto("");
    establecerCliTelefono("");
    establecerCliCorreo("");
    establecerCliDireccion("");
    establecerCliBanco("");
    establecerCliNumeroCuenta("");
    establecerErrorFormCliente("");
    establecerModoFormCliente(true);
  };

  const abrirEditarCliente = (c: ClienteProyecto) => {
    establecerEditandoClienteId(c.id_cliente);
    establecerCliRut(c.rut_cliente);
    establecerCliRazonSocial(c.razon_social);
    establecerCliGiro(c.giro ?? "");
    establecerCliContacto(c.nombre_contacto ?? "");
    establecerCliTelefono(c.telefono ?? "");
    establecerCliCorreo(c.correo_contacto ?? "");
    establecerCliDireccion(c.direccion ?? "");
    establecerCliBanco(c.banco ?? "");
    establecerCliNumeroCuenta(c.numero_cuenta ?? "");
    establecerErrorFormCliente("");
    establecerModoFormCliente(true);
  };

  const guardarCliente = async () => {
    if (!cliRut.trim() || !cliRazonSocial.trim()) {
      establecerErrorFormCliente("El RUT y la Razón Social del cliente son obligatorios.");
      return;
    }
    establecerGuardandoCliente(true);
    const payload: FormularioCliente = {
      rut_cliente: cliRut.trim(),
      razon_social: cliRazonSocial.trim(),
      giro: cliGiro.trim() || undefined,
      nombre_contacto: cliContacto.trim() || undefined,
      telefono: cliTelefono.trim() || undefined,
      correo_contacto: cliCorreo.trim() || undefined,
      direccion: cliDireccion.trim() || undefined,
      banco: cliBanco.trim() || undefined,
      tipo_cuenta: cliBanco.trim() ? "Cuenta Corriente" : undefined,
      numero_cuenta: cliNumeroCuenta.trim() || undefined,
    };

    const res = editandoClienteId
      ? await actualizarClienteApi(editandoClienteId, payload)
      : await crearClienteApi(payload);
    establecerGuardandoCliente(false);

    if (!res.ok) {
      establecerErrorFormCliente(res.error ?? "No se pudo guardar el cliente.");
      return;
    }

    establecerModoFormCliente(false);
    await cargarTodo();
    onDatosActualizados?.();
    onAviso?.(res.data?.mensaje ?? "Cliente guardado correctamente");
  };

  const toggleEstadoCliente = async (c: ClienteProyecto) => {
    const res = await alternarEstadoClienteApi(c.id_cliente, !c.activo);
    if (res.ok) {
      await cargarTodo();
      onDatosActualizados?.();
      onAviso?.(res.data?.mensaje ?? "Estado del cliente actualizado");
    }
  };

  // ===========================================================================
  // HANDLERS PLAN DE MANTENCIÓN Y SEGUIMIENTO
  // ===========================================================================
  const abrirNuevoPlan = (clientePreseleccionado?: ClienteProyecto) => {
    const cliInicial =
      clientePreseleccionado ?? clientes.find((c) => c.activo) ?? clientes[0] ?? null;
    const kitInicial = kits[0] ?? null;
    establecerPlanClienteId(cliInicial?.id_cliente ?? null);
    establecerPlanProyectoOrigenId(proyectos[0]?.id_proyecto ?? null);
    establecerPlanTitulo(
      cliInicial ? `Mantención Preventiva – ${cliInicial.razon_social}` : "Mantención Preventiva Periódica"
    );
    establecerPlanModalidad("POR_KIT");
    establecerPlanKitId(kitInicial?.id_kit_proyecto ?? null);
    establecerPlanCodigoContrato("");
    establecerPlanFrecuenciaMeses("3");
    establecerPlanFechaBase(new Date().toISOString().slice(0, 10));
    establecerPlanCostoPactado(String(kitInicial?.costo_total ?? 650000));
    establecerPlanNotas("");
    establecerErrorFormPlan("");
    establecerPestanaActiva("seguimiento");
    establecerModoFormPlan(true);
  };

  const seleccionarKitEnPlan = (kit: KitProyecto) => {
    establecerPlanKitId(kit.id_kit_proyecto);
    if (kit.costo_total && kit.costo_total > 0) {
      establecerPlanCostoPactado(String(kit.costo_total));
    }
  };

  const guardarPlanMantencion = async () => {
    if (!planClienteId) {
      establecerErrorFormPlan("Debe seleccionar un cliente para el plan de mantención.");
      return;
    }
    if (!planTitulo.trim()) {
      establecerErrorFormPlan("Ingrese un título descriptivo para la mantención programada.");
      return;
    }
    const freq = Math.max(1, Math.min(60, Number(planFrecuenciaMeses) || 3));
    if ((planModalidad === "POR_KIT" || planModalidad === "MIXTO") && !planKitId) {
      establecerErrorFormPlan("Seleccione el Kit predeterminado que se utilizará en la mantención.");
      return;
    }

    establecerGuardandoPlan(true);
    const cliObj = clientes.find((c) => c.id_cliente === planClienteId);
    const proyObj = proyectos.find((p) => p.id_proyecto === planProyectoOrigenId);
    const kitObj = kits.find((k) => k.id_kit_proyecto === planKitId);

    const res = await crearPlanMantencionApi({
      id_cliente: planClienteId,
      id_proyecto_origen: planProyectoOrigenId,
      titulo_plan: planTitulo.trim(),
      modalidad: planModalidad,
      id_kit_proyecto:
        planModalidad === "POR_KIT" || planModalidad === "MIXTO" ? planKitId : null,
      codigo_contrato:
        planModalidad === "POR_CONTRATO" || planModalidad === "MIXTO"
          ? planCodigoContrato.trim() || "SLA-VIGENTE"
          : null,
      frecuencia_meses: freq,
      fecha_ultima_mantencion: planFechaBase,
      fecha_proxima_mantencion: fechaProximaCalculada,
      costo_pactado: Number(planCostoPactado) || 0,
      notas_plan: planNotas.trim() || null,
      razon_social: cliObj?.razon_social,
      rut_cliente: cliObj?.rut_cliente,
      nombre_proyecto_origen: proyObj?.nombre_proyecto ?? null,
      nombre_kit: kitObj?.nombre_kit ?? null,
    });
    establecerGuardandoPlan(false);

    if (!res.ok) {
      establecerErrorFormPlan(res.error ?? "Error al programar el plan de mantención.");
      return;
    }

    establecerModoFormPlan(false);
    await cargarTodo();
    onDatosActualizados?.();
    onAviso?.(res.data?.mensaje ?? "Plan de mantención creado exitosamente");
  };

  const abrirModalContacto = (plan: PlanMantencionCliente) => {
    establecerPlanContactando(plan);
    establecerSegCanal("Teléfono");
    establecerSegResultado("Visita Confirmada");
    establecerSegObservaciones(
      `Contacto con ${plan.nombre_contacto || plan.razon_social} por mantención cada ${plan.frecuencia_meses} meses.`
    );
    establecerSegGenerarFaena(true);
  };

  const confirmarSeguimientoContacto = async () => {
    if (!planContactando) return;
    establecerGuardandoSeguimiento(true);

    const res = await registrarSeguimientoContactoApi(planContactando.id_plan, {
      canal_contacto: segCanal,
      resultado_contacto: segResultado,
      observaciones: segObservaciones.trim() || undefined,
      generar_faena: segGenerarFaena,
    });

    // Si estamos en modo fallback o no se creó proyecto en backend pero se pidió generar_faena,
    // también intentamos crear el proyecto vía API de proyectos para asegurar consistencia total
    if (segGenerarFaena && (!res.data?.proyecto_generado)) {
      const cli = clientes.find((c) => c.id_cliente === planContactando.id_cliente);
      await crearProyecto({
        nombre_proyecto: `${planContactando.titulo_plan} (${planContactando.frecuencia_meses}M)`,
        tipo_proyecto: "Mantencion",
        cliente: planContactando.razon_social ?? cli?.razon_social ?? "Cliente",
        id_cliente: planContactando.id_cliente,
        direccion: cli?.direccion ?? null,
        fecha_inicio: planContactando.fecha_proxima_mantencion,
        fecha_fin: null,
        presupuesto_inicial: planContactando.costo_pactado || 0,
        presupuesto_horas: 16,
        valor_venta: planContactando.costo_pactado || 0,
        porcentaje_avance: 0,
        estado_proyecto: "Planificado",
        id_usuario: 1,
        id_kit_proyecto: planContactando.id_kit_proyecto,
      }).catch(() => undefined);
    }

    establecerGuardandoSeguimiento(false);
    establecerPlanContactando(null);
    await cargarTodo();
    onDatosActualizados?.();
    onAviso?.(res.data?.mensaje ?? "Seguimiento registrado correctamente");
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* CABECERA OSCURA EJECUTIVA */}
          <View style={styles.headerOscuro}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTagFila}>
                <View style={styles.headerTagPastilla}>
                  <Ionicons name="people-outline" size={12} color="#f59e0b" />
                  <Text style={styles.headerTagTexto}>CRM & POST-VENTA FYAG</Text>
                </View>
              </View>
              <Text style={styles.headerTitulo}>
                Directorio de Clientes y Seguimiento de Mantenciones
              </Text>
              <Text style={styles.headerSubtitulo}>
                Asigna clientes a proyectos y programa mantenciones periódicas (cada 3, 6, 10 o 12 meses) por Kit o Contrato.
              </Text>
            </View>
            <TouchableOpacity style={styles.btnCerrar} onPress={onClose}>
              <Ionicons name="close" size={22} color="#d6d3d1" />
            </TouchableOpacity>
          </View>

          {/* BARRA DE PESTAÑAS INTERNAS */}
          <View style={styles.tabsBarra}>
            <TouchableOpacity
              style={[styles.tabBtn, pestanaActiva === "clientes" && styles.tabBtnActivo]}
              onPress={() => {
                establecerPestanaActiva("clientes");
                establecerModoFormPlan(false);
              }}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color={pestanaActiva === "clientes" ? tema.colors.primary : "#6b7280"}
              />
              <Text
                style={[styles.tabTexto, pestanaActiva === "clientes" && styles.tabTextoActivo]}
              >
                Clientes ({clientes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, pestanaActiva === "seguimiento" && styles.tabBtnActivo]}
              onPress={() => {
                establecerPestanaActiva("seguimiento");
                establecerModoFormCliente(false);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={pestanaActiva === "seguimiento" ? tema.colors.primary : "#6b7280"}
              />
              <Text
                style={[styles.tabTexto, pestanaActiva === "seguimiento" && styles.tabTextoActivo]}
              >
                Planes y Seguimiento ({planes.length})
              </Text>
              {contadoresPlanes.vencidos + contadoresPlanes.proximos > 0 && (
                <View style={styles.tabBadgeAlerta}>
                  <Text style={styles.tabBadgeAlertaTexto}>
                    {contadoresPlanes.vencidos + contadoresPlanes.proximos}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* CUERPO PRINCIPAL */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
            showsVerticalScrollIndicator
          >
            {cargando ? (
              <ActivityIndicator
                size="large"
                color={tema.colors.primary}
                style={{ marginVertical: 40 }}
              />
            ) : pestanaActiva === "clientes" ? (
              /* ==============================================================
                 PESTAÑA 1: CRUD DE CLIENTES Y ASIGNACIÓN A PROYECTO
                 ============================================================== */
              modoFormCliente ? (
                <View style={styles.formCaja}>
                  <View style={styles.formHeaderRow}>
                    <Text style={styles.formTitulo}>
                      {editandoClienteId ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
                    </Text>
                    <TouchableOpacity onPress={() => establecerModoFormCliente(false)}>
                      <Text style={styles.linkCancelar}>← Volver al listado</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.filaDosCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>RUT Cliente *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: 76.123.456-7"
                        placeholderTextColor="#9ca3af"
                        value={cliRut}
                        onChangeText={establecerCliRut}
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.label}>Razón Social / Empresa *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Inmobiliaria Pacífico SpA"
                        placeholderTextColor="#9ca3af"
                        value={cliRazonSocial}
                        onChangeText={establecerCliRazonSocial}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>Giro Comercial</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Construcción e Ingeniería Civil"
                    placeholderTextColor="#9ca3af"
                    value={cliGiro}
                    onChangeText={establecerCliGiro}
                  />

                  <View style={styles.filaDosCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Nombre de Contacto</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Rodrigo Sepúlveda"
                        placeholderTextColor="#9ca3af"
                        value={cliContacto}
                        onChangeText={establecerCliContacto}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Teléfono</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: +56 9 8765 4321"
                        placeholderTextColor="#9ca3af"
                        value={cliTelefono}
                        onChangeText={establecerCliTelefono}
                      />
                    </View>
                  </View>

                  <View style={styles.filaDosCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Correo Electrónico</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="contacto@empresa.cl"
                        placeholderTextColor="#9ca3af"
                        value={cliCorreo}
                        onChangeText={establecerCliCorreo}
                      />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.label}>Dirección Principal / Faena</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Av. Providencia 2450, Santiago"
                        placeholderTextColor="#9ca3af"
                        value={cliDireccion}
                        onChangeText={establecerCliDireccion}
                      />
                    </View>
                  </View>

                  <View style={styles.filaDosCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Banco (Opcional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Banco de Chile"
                        placeholderTextColor="#9ca3af"
                        value={cliBanco}
                        onChangeText={establecerCliBanco}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>N° Cuenta Corriente</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: 00-12345678-01"
                        placeholderTextColor="#9ca3af"
                        value={cliNumeroCuenta}
                        onChangeText={establecerCliNumeroCuenta}
                      />
                    </View>
                  </View>

                  {errorFormCliente ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#dc2626" />
                      <Text style={styles.errorBannerTexto}>{errorFormCliente}</Text>
                    </View>
                  ) : null}

                  <View style={styles.formBotonesRow}>
                    <TouchableOpacity
                      style={styles.btnSecundario}
                      onPress={() => establecerModoFormCliente(false)}
                    >
                      <Text style={styles.btnSecundarioTexto}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnPrimario}
                      onPress={guardarCliente}
                      disabled={guardandoCliente}
                    >
                      <Ionicons name="save-outline" size={16} color="#ffffff" />
                      <Text style={styles.btnPrimarioTexto}>
                        {guardandoCliente
                          ? "Guardando..."
                          : editandoClienteId
                          ? "Guardar Cambios"
                          : "Registrar Cliente"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* Barra de búsqueda y botón Nuevo Cliente */}
                  <View style={styles.barraAccionTop}>
                    <View style={styles.buscadorCaja}>
                      <Ionicons name="search-outline" size={16} color="#9ca3af" />
                      <TextInput
                        style={styles.buscadorInput}
                        placeholder="Buscar por RUT, razón social o contacto..."
                        placeholderTextColor="#9ca3af"
                        value={busquedaCliente}
                        onChangeText={establecerBusquedaCliente}
                      />
                      {busquedaCliente.length > 0 && (
                        <TouchableOpacity onPress={() => establecerBusquedaCliente("")}>
                          <Ionicons name="close-circle" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity style={styles.btnPrimario} onPress={abrirNuevoCliente}>
                      <Ionicons name="person-add-outline" size={16} color="#ffffff" />
                      <Text style={styles.btnPrimarioTexto}>+ Nuevo Cliente</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tarjetas de Clientes */}
                  {clientesFiltrados.map((c) => {
                    const proyectosDelCliente = proyectos.filter(
                      (p) =>
                        p.id_cliente === c.id_cliente ||
                        (p.cliente ?? "").toLowerCase() === c.razon_social.toLowerCase()
                    );
                    const planesDelCliente = planes.filter((pl) => pl.id_cliente === c.id_cliente);

                    return (
                      <View
                        key={c.id_cliente}
                        style={[styles.tarjetaItem, !c.activo && { opacity: 0.6 }]}
                      >
                        <View style={styles.tarjetaItemTop}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text style={styles.clienteTitulo}>{c.razon_social}</Text>
                              <View style={styles.badgeRut}>
                                <Text style={styles.badgeRutTexto}>RUT: {c.rut_cliente}</Text>
                              </View>
                              {!c.activo && (
                                <View style={styles.badgeInactivo}>
                                  <Text style={styles.badgeInactivoTexto}>Inactivo</Text>
                                </View>
                              )}
                            </View>
                            {c.giro ? <Text style={styles.clienteGiro}>{c.giro}</Text> : null}
                          </View>

                          <View style={styles.badgeEstrella}>
                            <Text style={styles.badgeEstrellaTexto}>
                              ⭐ {(c.calificacion_promedio || 5.0).toFixed(1)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.infoGrisCaja}>
                          <Text style={styles.infoLineaTexto}>
                            👤 Contacto: <Text style={{ fontWeight: "700" }}>{c.nombre_contacto || "No especificado"}</Text> • 📞 {c.telefono || "—"}
                          </Text>
                          <Text style={styles.infoLineaTexto}>
                            ✉️ {c.correo_contacto || "—"} • 📍 {c.direccion || "Sin dirección"}
                          </Text>
                        </View>

                        {/* Resumen de Proyectos y Planes del Cliente */}
                        <View style={styles.resumenVinculosFila}>
                          <View style={styles.chipVinculo}>
                            <Ionicons name="briefcase-outline" size={13} color="#1d4ed8" />
                            <Text style={styles.chipVinculoTexto}>
                              {proyectosDelCliente.length} Proyecto(s)
                            </Text>
                          </View>
                          <View style={[styles.chipVinculo, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                            <Ionicons name="calendar-outline" size={13} color="#b45309" />
                            <Text style={[styles.chipVinculoTexto, { color: "#b45309" }]}>
                              {planesDelCliente.length} Plan(es) de Mantención
                            </Text>
                          </View>
                        </View>

                        {/* Acciones del Cliente */}
                        <View style={styles.accionesTarjetaFila}>
                          {c.activo && onSeleccionarClienteParaProyecto && (
                            <TouchableOpacity
                              style={styles.btnAccionAmbar}
                              onPress={() => {
                                onSeleccionarClienteParaProyecto(c);
                                onClose();
                              }}
                            >
                              <Ionicons name="add-circle-outline" size={15} color="#ffffff" />
                              <Text style={styles.btnAccionAmbarTexto}>Asignar a Proyecto</Text>
                            </TouchableOpacity>
                          )}

                          {c.activo && (
                            <TouchableOpacity
                              style={styles.btnAccionOutlineAmbar}
                              onPress={() => abrirNuevoPlan(c)}
                            >
                              <Ionicons name="construct-outline" size={14} color={tema.colors.primary} />
                              <Text style={styles.btnAccionOutlineAmbarTexto}>
                                + Mantención (3/6/10m)
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.btnAccionGris}
                            onPress={() => abrirEditarCliente(c)}
                          >
                            <Ionicons name="create-outline" size={14} color="#374151" />
                            <Text style={styles.btnAccionGrisTexto}>Editar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.btnAccionGris}
                            onPress={() => toggleEstadoCliente(c)}
                          >
                            <Ionicons
                              name={c.activo ? "ban-outline" : "checkmark-circle-outline"}
                              size={14}
                              color={c.activo ? "#dc2626" : "#16a34a"}
                            />
                            <Text
                              style={[
                                styles.btnAccionGrisTexto,
                                { color: c.activo ? "#dc2626" : "#16a34a" },
                              ]}
                            >
                              {c.activo ? "Deshabilitar" : "Habilitar"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </>
              )
            ) : (
              /* ==============================================================
                 PESTAÑA 2: PLANES DE MANTENCIÓN (3, 6, 10, 12 MESES) Y SEGUIMIENTO
                 ============================================================== */
              modoFormPlan ? (
                <View style={styles.formCaja}>
                  <View style={styles.formHeaderRow}>
                    <Text style={styles.formTitulo}>
                      Programar Plan de Seguimiento y Mantención Periódica
                    </Text>
                    <TouchableOpacity onPress={() => establecerModoFormPlan(false)}>
                      <Text style={styles.linkCancelar}>← Volver a planes</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 1. Selección de Cliente */}
                  <Text style={styles.label}>1. Seleccione Cliente *</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {clientes
                      .filter((c) => c.activo)
                      .map((c) => {
                        const sel = planClienteId === c.id_cliente;
                        return (
                          <TouchableOpacity
                            key={c.id_cliente}
                            style={[styles.selectorChip, sel && styles.selectorChipActivo]}
                            onPress={() => {
                              establecerPlanClienteId(c.id_cliente);
                              if (!planTitulo || planTitulo.startsWith("Mantención Preventiva")) {
                                establecerPlanTitulo(`Mantención Preventiva – ${c.razon_social}`);
                              }
                            }}
                          >
                            <Text style={[styles.selectorChipTexto, sel && styles.selectorChipTextoActivo]}>
                              {c.razon_social} ({c.rut_cliente})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>

                  {/* 2. Proyecto u Obra de Origen */}
                  <Text style={styles.label}>2. Proyecto u Obra Relacionada (Opcional)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.selectorChip,
                        planProyectoOrigenId === null && styles.selectorChipActivo,
                      ]}
                      onPress={() => establecerPlanProyectoOrigenId(null)}
                    >
                      <Text
                        style={[
                          styles.selectorChipTexto,
                          planProyectoOrigenId === null && styles.selectorChipTextoActivo,
                        ]}
                      >
                        General por Cliente
                      </Text>
                    </TouchableOpacity>
                    {proyectos.map((p) => {
                      const sel = planProyectoOrigenId === p.id_proyecto;
                      return (
                        <TouchableOpacity
                          key={p.id_proyecto}
                          style={[styles.selectorChip, sel && styles.selectorChipActivo]}
                          onPress={() => establecerPlanProyectoOrigenId(p.id_proyecto)}
                        >
                          <Text style={[styles.selectorChipTexto, sel && styles.selectorChipTextoActivo]}>
                            {p.nombre_proyecto}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* 3. Título y Frecuencia en Meses (3, 6, 10, 12m...) */}
                  <Text style={styles.label}>3. Nombre del Plan o Servicio de Mantención *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Mantención Trimestral Climatización y Tableros"
                    placeholderTextColor="#9ca3af"
                    value={planTitulo}
                    onChangeText={establecerPlanTitulo}
                  />

                  <Text style={styles.label}>
                    4. Frecuencia de Mantención (Cada cuántos meses se contacta al cliente) *
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {FRECUENCIAS_PRESET.map((m) => {
                      const esActivo = Number(planFrecuenciaMeses) === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.frecuenciaChip, esActivo && styles.frecuenciaChipActivo]}
                          onPress={() => establecerPlanFrecuenciaMeses(String(m))}
                        >
                          <Ionicons
                            name="repeat-outline"
                            size={14}
                            color={esActivo ? "#ffffff" : tema.colors.primary}
                          />
                          <Text
                            style={[
                              styles.frecuenciaChipTexto,
                              esActivo && styles.frecuenciaChipTextoActivo,
                            ]}
                          >
                            Cada {m} meses
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 12, color: "#4b5563", fontWeight: "600" }}>
                        Otro (meses):
                      </Text>
                      <TextInput
                        style={[styles.input, { width: 64, marginBottom: 0, textAlign: "center" }]}
                        keyboardType="numeric"
                        value={planFrecuenciaMeses}
                        onChangeText={establecerPlanFrecuenciaMeses}
                      />
                    </View>
                  </View>

                  {/* 5. Modalidad: Por Kit Predeterminado vs Por Contrato */}
                  <Text style={styles.label}>5. Modalidad de Asignación *</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {(
                      [
                        { id: "POR_KIT", label: "📦 Por Kit de Insumos" },
                        { id: "POR_CONTRATO", label: "📄 Por Contrato / SLA" },
                        { id: "MIXTO", label: "⚡ Mixto (Kit + Contrato)" },
                      ] as const
                    ).map((mod) => {
                      const sel = planModalidad === mod.id;
                      return (
                        <TouchableOpacity
                          key={mod.id}
                          style={[styles.modalidadBtn, sel && styles.modalidadBtnActivo]}
                          onPress={() => establecerPlanModalidad(mod.id)}
                        >
                          <Text
                            style={[
                              styles.modalidadBtnTexto,
                              sel && styles.modalidadBtnTextoActivo,
                            ]}
                          >
                            {mod.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {(planModalidad === "POR_KIT" || planModalidad === "MIXTO") && (
                    <View style={styles.subCajaConfig}>
                      <Text style={styles.label}>Seleccione el Kit Predeterminado para la Mantención:</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {kits.map((k) => {
                          const sel = planKitId === k.id_kit_proyecto;
                          return (
                            <TouchableOpacity
                              key={k.id_kit_proyecto}
                              style={[styles.kitCardChip, sel && styles.kitCardChipActivo]}
                              onPress={() => seleccionarKitEnPlan(k)}
                            >
                              <Text
                                style={[
                                  styles.kitCardChipTitulo,
                                  sel && { color: "#ffffff" },
                                ]}
                              >
                                {k.nombre_kit}
                              </Text>
                              <Text
                                style={[
                                  styles.kitCardChipSub,
                                  sel && { color: "#fde68a" },
                                ]}
                              >
                                {k.items?.length || 0} insumos • {formatearCLP(k.costo_total || 0)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {(planModalidad === "POR_CONTRATO" || planModalidad === "MIXTO") && (
                    <View style={styles.subCajaConfig}>
                      <Text style={styles.label}>Código / N° de Contrato o SLA:</Text>
                      <TextInput
                        style={[styles.input, { marginBottom: 0 }]}
                        placeholder="Ej: CTR-MANT-2026-014"
                        placeholderTextColor="#9ca3af"
                        value={planCodigoContrato}
                        onChangeText={establecerPlanCodigoContrato}
                      />
                    </View>
                  )}

                  <View style={styles.filaDosCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Costo / Valor Pactado ($ CLP)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={planCostoPactado}
                        onChangeText={establecerPlanCostoPactado}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Próxima Mantención Calculada</Text>
                      <View style={styles.fechaCalculadaCaja}>
                        <Ionicons name="calendar" size={16} color={tema.colors.primary} />
                        <Text style={styles.fechaCalculadaTexto}>
                          {formatearFecha(fechaProximaCalculada)} (+{planFrecuenciaMeses || 3}m)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>Notas o Alcance Técnico del Seguimiento</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Incluye limpieza de serpentines, reapriete de bornes y medición de carga..."
                    placeholderTextColor="#9ca3af"
                    value={planNotas}
                    onChangeText={establecerPlanNotas}
                  />

                  {errorFormPlan ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#dc2626" />
                      <Text style={styles.errorBannerTexto}>{errorFormPlan}</Text>
                    </View>
                  ) : null}

                  <View style={styles.formBotonesRow}>
                    <TouchableOpacity
                      style={styles.btnSecundario}
                      onPress={() => establecerModoFormPlan(false)}
                    >
                      <Text style={styles.btnSecundarioTexto}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnPrimario}
                      onPress={guardarPlanMantencion}
                      disabled={guardandoPlan}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                      <Text style={styles.btnPrimarioTexto}>
                        {guardandoPlan ? "Programando..." : "Activar Plan de Mantención"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* FRANJA DE KPIs DE SEGUIMIENTO */}
                  <View style={styles.kpisPlanesFila}>
                    <TouchableOpacity
                      style={[
                        styles.kpiPlanCaja,
                        filtroSemaforoPlan === "vencidos" && { borderColor: "#dc2626", borderWidth: 2 },
                      ]}
                      onPress={() =>
                        establecerFiltroSemaforoPlan(
                          filtroSemaforoPlan === "vencidos" ? "todos" : "vencidos"
                        )
                      }
                    >
                      <Text style={[styles.kpiPlanValor, { color: "#dc2626" }]}>
                        {contadoresPlanes.vencidos}
                      </Text>
                      <Text style={styles.kpiPlanLabel}>Vencidas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.kpiPlanCaja,
                        filtroSemaforoPlan === "proximos" && { borderColor: "#d97706", borderWidth: 2 },
                      ]}
                      onPress={() =>
                        establecerFiltroSemaforoPlan(
                          filtroSemaforoPlan === "proximos" ? "todos" : "proximos"
                        )
                      }
                    >
                      <Text style={[styles.kpiPlanValor, { color: "#d97706" }]}>
                        {contadoresPlanes.proximos}
                      </Text>
                      <Text style={styles.kpiPlanLabel}>Próximas (≤30d)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.kpiPlanCaja,
                        filtroSemaforoPlan === "al_dia" && { borderColor: "#16a34a", borderWidth: 2 },
                      ]}
                      onPress={() =>
                        establecerFiltroSemaforoPlan(
                          filtroSemaforoPlan === "al_dia" ? "todos" : "al_dia"
                        )
                      }
                    >
                      <Text style={[styles.kpiPlanValor, { color: "#16a34a" }]}>
                        {contadoresPlanes.alDia}
                      </Text>
                      <Text style={styles.kpiPlanLabel}>Al Día (&gt;30d)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnPrimario}
                      onPress={() => abrirNuevoPlan()}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
                      <Text style={styles.btnPrimarioTexto}>+ Nuevo Plan</Text>
                    </TouchableOpacity>
                  </View>

                  {/* PANEL DE CONTACTO ACTIVO SI SE SELECCIONÓ UN PLAN */}
                  {planContactando && (
                    <View style={styles.panelContactoCaja}>
                      <View style={styles.formHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.panelContactoTag}>
                            REGISTRO DE CONTACTO Y AGENDAMIENTO
                          </Text>
                          <Text style={styles.formTitulo}>
                            {planContactando.razon_social} • {planContactando.titulo_plan}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => establecerPlanContactando(null)}>
                          <Ionicons name="close-circle" size={22} color="#6b7280" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.label}>Canal de Contacto Utilizado:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {CANALES_CONTACTO.map((c) => (
                          <TouchableOpacity
                            key={c}
                            style={[
                              styles.selectorChip,
                              segCanal === c && styles.selectorChipActivo,
                            ]}
                            onPress={() => establecerSegCanal(c)}
                          >
                            <Text
                              style={[
                                styles.selectorChipTexto,
                                segCanal === c && styles.selectorChipTextoActivo,
                              ]}
                            >
                              {c}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.label}>Resultado de la Gestión con el Cliente:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {RESULTADOS_CONTACTO.map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[
                              styles.selectorChip,
                              segResultado === r && styles.selectorChipActivo,
                            ]}
                            onPress={() => {
                              establecerSegResultado(r);
                              if (r === "Visita Confirmada") establecerSegGenerarFaena(true);
                            }}
                          >
                            <Text
                              style={[
                                styles.selectorChipTexto,
                                segResultado === r && styles.selectorChipTextoActivo,
                              ]}
                            >
                              {r}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Toggle Conversión en 1 Clic */}
                      <Pressable
                        style={[
                          styles.toggleGenerarFaenaCaja,
                          segGenerarFaena && styles.toggleGenerarFaenaCajaActivo,
                        ]}
                        onPress={() => establecerSegGenerarFaena((prev) => !prev)}
                      >
                        <Ionicons
                          name={segGenerarFaena ? "checkbox" : "square-outline"}
                          size={20}
                          color={segGenerarFaena ? tema.colors.primary : "#6b7280"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toggleGenerarTitulo}>
                            ⚡ Crear automáticamente Faena de Mantención y avanzar ciclo (+
                            {planContactando.frecuencia_meses} meses)
                          </Text>
                          <Text style={styles.toggleGenerarSub}>
                            Crea el proyecto tipo Mantención con el cliente
                            {planContactando.nombre_kit
                              ? `, asigna el "${planContactando.nombre_kit}"`
                              : ""}{" "}
                            y programa la siguiente fecha para{" "}
                            {formatearFecha(
                              sumarMesesFecha(
                                planContactando.fecha_proxima_mantencion,
                                planContactando.frecuencia_meses
                              )
                            )}
                            .
                          </Text>
                        </View>
                      </Pressable>

                      <Text style={styles.label}>Observaciones / Acuerdos con el Cliente:</Text>
                      <TextInput
                        style={styles.input}
                        value={segObservaciones}
                        onChangeText={establecerSegObservaciones}
                        placeholder="Ej: Cliente confirma ingreso para el viernes a las 09:00 hrs..."
                        placeholderTextColor="#9ca3af"
                      />

                      <View style={styles.formBotonesRow}>
                        <TouchableOpacity
                          style={styles.btnSecundario}
                          onPress={() => establecerPlanContactando(null)}
                        >
                          <Text style={styles.btnSecundarioTexto}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnPrimario}
                          onPress={confirmarSeguimientoContacto}
                          disabled={guardandoSeguimiento}
                        >
                          <Ionicons name="checkmark-done-outline" size={16} color="#ffffff" />
                          <Text style={styles.btnPrimarioTexto}>
                            {guardandoSeguimiento
                              ? "Procesando..."
                              : segGenerarFaena
                              ? "Confirmar y Generar Faena"
                              : "Guardar Contacto"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* LISTADO DE PLANES DE MANTENCIÓN */}
                  {planesFiltrados.map((pl) => {
                    const dias = pl.dias_restantes ?? 30;
                    const esVencido = dias < 0;
                    const esProximo = dias >= 0 && dias <= 30;
                    const colorSem = esVencido ? "#dc2626" : esProximo ? "#d97706" : "#16a34a";
                    const bgSem = esVencido ? "#fee2e2" : esProximo ? "#fef3c7" : "#dcfce7";
                    const textoSem = esVencido
                      ? `Vencida hace ${Math.abs(dias)}d`
                      : dias === 0
                      ? "Vence Hoy"
                      : `Próxima en ${dias}d`;
                    const expandido = Boolean(planesExpandidos[pl.id_plan]);

                    return (
                      <View key={pl.id_plan} style={styles.tarjetaItem}>
                        {/* Cabecera del Plan */}
                        <View style={styles.tarjetaItemTop}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                            <View style={styles.badgeFrecuencia}>
                              <Ionicons name="repeat" size={12} color="#b45309" />
                              <Text style={styles.badgeFrecuenciaTexto}>
                                CADA {pl.frecuencia_meses} MESES
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.badgeModalidad,
                                pl.modalidad === "POR_CONTRATO" && {
                                  backgroundColor: "#eff6ff",
                                  borderColor: "#bfdbfe",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.badgeModalidadTexto,
                                  pl.modalidad === "POR_CONTRATO" && { color: "#1d4ed8" },
                                ]}
                              >
                                {pl.modalidad === "POR_KIT"
                                  ? `📦 Kit: ${pl.nombre_kit || "Asignado"}`
                                  : pl.modalidad === "POR_CONTRATO"
                                  ? `📄 Contrato: ${pl.codigo_contrato || "SLA"}`
                                  : `⚡ Mixto (${pl.codigo_contrato || "SLA"} + Kit)`}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.badgeSemaforoFecha, { backgroundColor: bgSem }]}>
                            <View style={[styles.puntoSemaforo, { backgroundColor: colorSem }]} />
                            <Text style={[styles.badgeSemaforoTexto, { color: colorSem }]}>
                              {textoSem}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.clienteTitulo}>{pl.titulo_plan}</Text>
                        <Text style={styles.clienteSub}>
                          🏢 Cliente: <Text style={{ fontWeight: "700", color: "#111827" }}>{pl.razon_social}</Text>{" "}
                          {pl.nombre_contacto ? `(${pl.nombre_contacto} • ${pl.telefono_cliente || ""})` : ""}
                        </Text>

                        {pl.nombre_proyecto_origen ? (
                          <Text style={styles.clienteGiro}>
                            🔗 Obra origen: {pl.nombre_proyecto_origen}
                          </Text>
                        ) : null}

                        {/* Resumen de fechas, costo y stock de Kit */}
                        <View style={styles.infoGrisCaja}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <Text style={styles.infoLineaTexto}>
                              📅 Última:{" "}
                              <Text style={{ fontWeight: "700" }}>
                                {pl.fecha_ultima_mantencion
                                  ? formatearFecha(pl.fecha_ultima_mantencion)
                                  : "—"}
                              </Text>{" "}
                              → Próxima:{" "}
                              <Text style={{ fontWeight: "800", color: colorSem }}>
                                {formatearFecha(pl.fecha_proxima_mantencion)}
                              </Text>
                            </Text>
                            <Text style={styles.infoLineaTexto}>
                              💰 Valor pactado:{" "}
                              <Text style={{ fontWeight: "800", color: "#111827" }}>
                                {formatearCLP(pl.costo_pactado)}
                              </Text>
                            </Text>
                          </View>

                          {(pl.modalidad === "POR_KIT" || pl.modalidad === "MIXTO") && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                              <Ionicons
                                name={pl.kit_stock_ok !== false ? "checkmark-circle" : "warning"}
                                size={14}
                                color={pl.kit_stock_ok !== false ? "#16a34a" : "#d97706"}
                              />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: pl.kit_stock_ok !== false ? "#15803d" : "#b45309",
                                }}
                              >
                                {pl.kit_stock_ok !== false
                                  ? "Stock de Kit verificado y disponible en bodega para esta mantención"
                                  : "Atención: Verificar stock de insumos del Kit antes de agendar visita"}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Bitácora expandible de seguimientos */}
                        {pl.seguimientos && pl.seguimientos.length > 0 && (
                          <View style={{ marginTop: 6 }}>
                            <TouchableOpacity
                              onPress={() =>
                                establecerPlanesExpandidos((prev) => ({
                                  ...prev,
                                  [pl.id_plan]: !prev[pl.id_plan],
                                }))
                              }
                            >
                              <Text style={styles.linkHistorial}>
                                {expandido ? "▼ Ocultar" : "▶ Ver"} bitácora de contactos (
                                {pl.seguimientos.length})
                              </Text>
                            </TouchableOpacity>
                            {expandido &&
                              pl.seguimientos.map((s) => (
                                <View key={s.id_seguimiento} style={styles.itemSeguimiento}>
                                  <Text style={styles.itemSeguimientoTop}>
                                    {s.canal_contacto} •{" "}
                                    <Text style={{ fontWeight: "700", color: tema.colors.primaryDark }}>
                                      {s.resultado_contacto}
                                    </Text>{" "}
                                    ({formatearFecha(s.fecha_contacto)})
                                  </Text>
                                  {s.observaciones ? (
                                    <Text style={styles.itemSeguimientoObs}>{s.observaciones}</Text>
                                  ) : null}
                                </View>
                              ))}
                          </View>
                        )}

                        {/* Botón Contactar Cliente / Agendar */}
                        <View style={styles.accionesTarjetaFila}>
                          <TouchableOpacity
                            style={styles.btnAccionAmbar}
                            onPress={() => abrirModalContacto(pl)}
                          >
                            <Ionicons name="call-outline" size={15} color="#ffffff" />
                            <Text style={styles.btnAccionAmbarTexto}>
                              Contactar Cliente / Agendar Mantención
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </>
              )
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  modalCard: {
    width: "100%",
    maxWidth: 780,
    maxHeight: "92%",
    minHeight: "75%",
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  headerOscuro: {
    backgroundColor: "#1c1917",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTagFila: {
    flexDirection: "row",
    marginBottom: 4,
  },
  headerTagPastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerTagTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f59e0b",
    letterSpacing: 0.5,
  },
  headerTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerSubtitulo: {
    fontSize: 11,
    color: "#a8a29e",
    marginTop: 2,
  },
  btnCerrar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#292524",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsBarra: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabBtnActivo: {
    borderBottomColor: tema.colors.primary,
  },
  tabTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabTextoActivo: {
    color: tema.colors.primary,
    fontWeight: "800",
  },
  tabBadgeAlerta: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tabBadgeAlertaTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#dc2626",
  },
  barraAccionTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  buscadorCaja: {
    flex: 1,
    minWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  btnPrimario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
  },
  btnPrimarioTexto: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  btnSecundario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  btnSecundarioTexto: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  tarjetaItem: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tarjetaItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  clienteTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  clienteSub: {
    fontSize: 12,
    color: "#4b5563",
    marginTop: 2,
  },
  clienteGiro: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  badgeRut: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeRutTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
  },
  badgeInactivo: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeInactivoTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
  },
  badgeEstrella: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeEstrellaTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400e",
  },
  infoGrisCaja: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 9,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  infoLineaTexto: {
    fontSize: 11,
    color: "#374151",
    marginVertical: 1,
  },
  resumenVinculosFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chipVinculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipVinculoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  accionesTarjetaFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  btnAccionAmbar: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnAccionAmbarTexto: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  btnAccionOutlineAmbar: {
    flex: 1,
    minWidth: 130,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: tema.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnAccionOutlineAmbarTexto: {
    color: tema.colors.primaryDark,
    fontSize: 11,
    fontWeight: "700",
  },
  btnAccionGris: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnAccionGrisTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  formCaja: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  formHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  formTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },
  linkCancelar: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.primary,
  },
  filaDosCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  formBotonesRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorBannerTexto: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
    flex: 1,
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  selectorChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  selectorChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  selectorChipTextoActivo: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  frecuenciaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
  },
  frecuenciaChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  frecuenciaChipTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
  },
  frecuenciaChipTextoActivo: {
    color: "#ffffff",
  },
  modalidadBtn: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    alignItems: "center",
  },
  modalidadBtnActivo: {
    backgroundColor: "#fffbeb",
    borderColor: tema.colors.primary,
  },
  modalidadBtnTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  modalidadBtnTextoActivo: {
    color: tema.colors.primaryDark,
  },
  subCajaConfig: {
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  kitCardChip: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    minWidth: 180,
  },
  kitCardChipActivo: {
    backgroundColor: "#1c1917",
    borderColor: tema.colors.primary,
  },
  kitCardChipTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  kitCardChipSub: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  fechaCalculadaCaja: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 10,
  },
  fechaCalculadaTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: "#b45309",
  },
  kpisPlanesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  kpiPlanCaja: {
    flex: 1,
    minWidth: 85,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  kpiPlanValor: {
    fontSize: 16,
    fontWeight: "800",
  },
  kpiPlanLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
  },
  badgeFrecuencia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeFrecuenciaTexto: {
    fontSize: 10,
    fontWeight: "800",
    color: "#b45309",
  },
  badgeModalidad: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeModalidadTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
  },
  badgeSemaforoFecha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  puntoSemaforo: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeSemaforoTexto: {
    fontSize: 11,
    fontWeight: "800",
  },
  panelContactoCaja: {
    backgroundColor: "#fffbeb",
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  panelContactoTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#b45309",
    marginBottom: 2,
  },
  toggleGenerarFaenaCaja: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  toggleGenerarFaenaCajaActivo: {
    borderColor: tema.colors.primary,
    backgroundColor: "#fff7ed",
  },
  toggleGenerarTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  toggleGenerarSub: {
    fontSize: 11,
    color: "#4b5563",
    marginTop: 2,
  },
  linkHistorial: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primary,
    marginVertical: 4,
  },
  itemSeguimiento: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  itemSeguimientoTop: {
    fontSize: 11,
    color: "#374151",
  },
  itemSeguimientoObs: {
    fontSize: 11,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 2,
  },
});
