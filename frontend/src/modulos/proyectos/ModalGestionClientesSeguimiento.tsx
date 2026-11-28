import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { esRutValido, formatearCLP, formatearFecha } from "@/nucleo/formato";
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
import {
  Boton,
  CampoBusqueda,
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  Insignia,
  Tarjeta,
  VistaModal,
} from "@/componentes/comunes";
import { Selector, OpcionSelector } from "@/componentes/formularios/Selector";
import { Proyecto, actualizarProyecto, crearProyecto } from "./proyectosApi";

interface PropiedadesModalClientesSeguimiento {
  visible: boolean;
  modoPagina?: boolean;
  initialTab?: "clientes" | "seguimiento";
  proyectos: Proyecto[];
  kits: KitProyecto[];
  onClose: () => void;
  onSeleccionarClienteParaProyecto?: (cliente: ClienteProyecto) => void;
  onDatosActualizados?: () => void;
  onAviso?: (msg: string) => void;
}

const FRECUENCIAS_PRESET = [3, 6, 10, 12];
const GIROS_SUGERIDOS = [
  "Constructora e Inmobiliaria",
  "Salud e Infraestructura Médica",
  "Industrial y Bodegaje",
  "Comercial y Retail",
  "Condominio / Edificio Corporativo",
] as const;
const CANALES_CONTACTO = ["Teléfono", "WhatsApp", "Correo", "Visita"] as const;
const RESULTADOS_CONTACTO = [
  "Cliente Contactado",
  "Visita Confirmada",
  "Pospuesto por Cliente",
  "Pendiente Contacto",
] as const;

export const ModalGestionClientesSeguimiento: React.FC<PropiedadesModalClientesSeguimiento> = ({
  visible,
  modoPagina = false,
  initialTab = "clientes",
  proyectos,
  kits,
  onClose,
  onSeleccionarClienteParaProyecto,
  onDatosActualizados,
  onAviso,
}) => {
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;

  const [pestanaActiva, establecerPestanaActiva] = useState<"clientes" | "seguimiento">(initialTab);
  const [cargando, establecerCargando] = useState(true);
  const [clientes, establecerClientes] = useState<ClienteProyecto[]>([]);
  const [planes, establecerPlanes] = useState<PlanMantencionCliente[]>([]);

  // Filtros
  const [busquedaCliente, establecerBusquedaCliente] = useState("");
  const [filtroEstadoCliente, establecerFiltroEstadoCliente] = useState<
    "todos" | "activos" | "con_mantencion" | "inactivos"
  >("todos");
  const [busquedaPlan, establecerBusquedaPlan] = useState("");
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
  const [cliProyectoVincularId, establecerCliProyectoVincularId] = useState<string>("");
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
  const [clienteAsignandoObraId, establecerClienteAsignandoObraId] = useState<number | null>(null);
  const [asignandoObraEnCurso, establecerAsignandoObraEnCurso] = useState(false);

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
    if (visible || modoPagina) {
      establecerPestanaActiva(initialTab);
      establecerModoFormCliente(false);
      establecerModoFormPlan(false);
      establecerPlanContactando(null);
      establecerClienteAsignandoObraId(null);
      cargarTodo();
    }
  }, [visible, modoPagina, initialTab]);

  const asignarClienteAObraExistente = async (cliente: ClienteProyecto, proy: Proyecto) => {
    establecerAsignandoObraEnCurso(true);
    const res = await actualizarProyecto(proy.id_proyecto, {
      nombre_proyecto: proy.nombre_proyecto,
      tipo_proyecto: proy.tipo_proyecto,
      cliente: cliente.razon_social,
      id_cliente: cliente.id_cliente,
      direccion: proy.direccion || cliente.direccion || null,
      fecha_inicio: proy.fecha_inicio,
      fecha_fin: proy.fecha_fin,
      presupuesto_inicial: proy.presupuesto_inicial,
      presupuesto_horas: proy.presupuesto_horas,
      valor_venta: proy.valor_venta,
      porcentaje_avance: proy.porcentaje_avance,
      estado_proyecto: proy.estado_proyecto,
      id_usuario: proy.id_usuario,
    });
    establecerAsignandoObraEnCurso(false);
    establecerClienteAsignandoObraId(null);
    if (res.ok) {
      await cargarTodo();
      onDatosActualizados?.();
      onAviso?.(`Cliente ${cliente.razon_social} asignado a "${proy.nombre_proyecto}"`);
    } else {
      onAviso?.(res.error ?? "No se pudo asignar el cliente al proyecto");
    }
  };

  // Calcular próxima fecha sugerida en formulario de plan
  const fechaProximaCalculada = useMemo(() => {
    const meses = Math.max(1, Math.min(60, Number(planFrecuenciaMeses) || 3));
    return sumarMesesFecha(planFechaBase, meses);
  }, [planFechaBase, planFrecuenciaMeses]);

  // Contadores y filtrado de clientes
  const contadoresClientes = useMemo(() => {
    let activos = 0;
    let conMantencion = 0;
    let inactivos = 0;

    clientes.forEach((c) => {
      const tienePlan = planes.some((pl) => pl.id_cliente === c.id_cliente);
      if (!c.activo) {
        inactivos++;
      } else {
        activos++;
      }
      if (c.activo && tienePlan) {
        conMantencion++;
      }
    });

    return {
      activos,
      conMantencion,
      inactivos,
      total: clientes.length,
    };
  }, [clientes, planes]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    return clientes.filter((c) => {
      const tienePlan = planes.some((pl) => pl.id_cliente === c.id_cliente);
      if (filtroEstadoCliente === "activos" && !c.activo) return false;
      if (filtroEstadoCliente === "con_mantencion" && (!c.activo || !tienePlan)) return false;
      if (filtroEstadoCliente === "inactivos" && c.activo) return false;

      if (!q) return true;
      return (
        c.razon_social.toLowerCase().includes(q) ||
        c.rut_cliente.toLowerCase().includes(q) ||
        (c.giro ?? "").toLowerCase().includes(q) ||
        (c.nombre_contacto ?? "").toLowerCase().includes(q)
      );
    });
  }, [clientes, planes, busquedaCliente, filtroEstadoCliente]);

  // Clasificación semáforo de planes
  const contadoresPlanes = useMemo(() => {
    let vencidos = 0;
    let proximos = 0;
    let alDia = 0;
    let montoTotalPactado = 0;
    planes.forEach((p) => {
      const dias = p.dias_restantes ?? 30;
      montoTotalPactado += Number(p.costo_pactado || 0);
      if (dias < 0) vencidos++;
      else if (dias <= 30) proximos++;
      else alDia++;
    });
    return {
      vencidos,
      proximos,
      alDia,
      total: planes.length,
      montoTotalPactado: Math.round(montoTotalPactado),
    };
  }, [planes]);

  const planesFiltrados = useMemo(() => {
    const q = busquedaPlan.trim().toLowerCase();
    return planes.filter((p) => {
      const dias = p.dias_restantes ?? 30;
      if (filtroSemaforoPlan === "vencidos" && dias >= 0) return false;
      if (filtroSemaforoPlan === "proximos" && (dias < 0 || dias > 30)) return false;
      if (filtroSemaforoPlan === "al_dia" && dias <= 30) return false;

      if (q) {
        const coincideTitulo = (p.titulo_plan || "").toLowerCase().includes(q);
        const coincideCliente =
          (p.razon_social || "").toLowerCase().includes(q) ||
          (p.rut_cliente || "").toLowerCase().includes(q);
        const coincideObra = (p.nombre_proyecto_origen || "").toLowerCase().includes(q);
        const coincideKit =
          (p.nombre_kit || "").toLowerCase().includes(q) ||
          (p.codigo_contrato || "").toLowerCase().includes(q);
        if (!coincideTitulo && !coincideCliente && !coincideObra && !coincideKit) return false;
      }
      return true;
    });
  }, [planes, filtroSemaforoPlan, busquedaPlan]);

  const opcionesSelectorClientes = useMemo<OpcionSelector<string>[]>(
    () =>
      clientes
        .filter((c) => c.activo)
        .map((c) => ({
          label: c.razon_social,
          value: String(c.id_cliente),
          hint: `RUT: ${c.rut_cliente}${c.giro ? ` • ${c.giro}` : ""}`,
          icon: "business-outline",
        })),
    [clientes]
  );

  const opcionesSelectorProyectos = useMemo<OpcionSelector<string>[]>(
    () => [
      {
        label: "General por Cliente (Sin obra específica)",
        value: "",
        hint: "Aplica a todas las instalaciones del cliente",
        icon: "layers-outline",
      },
      ...proyectos.map((p) => ({
        label: p.nombre_proyecto,
        value: String(p.id_proyecto),
        hint: `${p.cliente || "Sin cliente"} • Estado: ${p.estado_proyecto}`,
        icon: "construct-outline" as const,
      })),
    ],
    [proyectos]
  );

  const opcionesSelectorKits = useMemo<OpcionSelector<string>[]>(
    () =>
      kits.map((k) => ({
        label: k.nombre_kit,
        value: String(k.id_kit_proyecto),
        hint: `${k.items?.length || 0} insumos • Valor ref: ${formatearCLP(k.costo_total || 0)}`,
        icon: "cube-outline",
      })),
    [kits]
  );

  const opcionesVincularProyectoCliente = useMemo<OpcionSelector<string>[]>(
    () => [
      {
        label: "Sin vincular a obra por ahora",
        value: "",
        hint: "Solo registrar ficha en el directorio de clientes",
        icon: "layers-outline",
      },
      ...proyectos.map((p) => ({
        label: p.nombre_proyecto,
        value: String(p.id_proyecto),
        hint: `Cliente actual: ${p.cliente || "Sin asignar"} • Estado: ${p.estado_proyecto}`,
        icon: "construct-outline" as const,
      })),
    ],
    [proyectos]
  );

  const estadoValidacionRutCliente = useMemo(() => {
    const limpio = cliRut.replace(/[.\s-]/g, "").toUpperCase();
    if (!limpio) return { estado: "vacio" as const, mensaje: "" };
    const duplicado = clientes.find(
      (c) =>
        c.id_cliente !== editandoClienteId &&
        c.rut_cliente.replace(/[.\s-]/g, "").toUpperCase() === limpio
    );
    if (duplicado) {
      return {
        estado: "duplicado" as const,
        mensaje: `RUT ya registrado para ${duplicado.razon_social}`,
      };
    }
    if (limpio.length >= 7 && esRutValido(cliRut)) {
      return { estado: "valido" as const, mensaje: "RUT válido (Módulo 11)" };
    }
    if (limpio.length >= 8 && !esRutValido(cliRut)) {
      return { estado: "invalido" as const, mensaje: "Dígito verificador no coincide" };
    }
    return { estado: "escribiendo" as const, mensaje: "" };
  }, [cliRut, clientes, editandoClienteId]);

  // ===========================================================================
  // HANDLERS CLIENTE
  // ===========================================================================
  const abrirNuevoCliente = () => {
    establecerEditandoClienteId(null);
    establecerCliRut("");
    establecerCliRazonSocial("");
    establecerCliGiro("");
    establecerCliContacto("");
    establecerCliTelefono("+56 9 ");
    establecerCliCorreo("");
    establecerCliDireccion("");
    establecerCliProyectoVincularId("");
    establecerErrorFormCliente("");
    establecerModoFormCliente(true);
  };

  const abrirEditarCliente = (c: ClienteProyecto) => {
    const proyActual = proyectos.find(
      (p) =>
        p.id_cliente === c.id_cliente ||
        (p.cliente ?? "").toLowerCase() === c.razon_social.toLowerCase()
    );
    establecerEditandoClienteId(c.id_cliente);
    establecerCliRut(c.rut_cliente);
    establecerCliRazonSocial(c.razon_social);
    establecerCliGiro(c.giro ?? "");
    establecerCliContacto(c.nombre_contacto ?? "");
    establecerCliTelefono(c.telefono ?? "");
    establecerCliCorreo(c.correo_contacto ?? "");
    establecerCliDireccion(c.direccion ?? "");
    establecerCliProyectoVincularId(proyActual ? String(proyActual.id_proyecto) : "");
    establecerErrorFormCliente("");
    establecerModoFormCliente(true);
  };

  const guardarCliente = async () => {
    if (!cliRut.trim() || !cliRazonSocial.trim()) {
      establecerErrorFormCliente("El RUT y la Razón Social del cliente son obligatorios.");
      return;
    }
    if (estadoValidacionRutCliente.estado === "duplicado") {
      establecerErrorFormCliente(estadoValidacionRutCliente.mensaje);
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
    };

    const res = editandoClienteId
      ? await actualizarClienteApi(editandoClienteId, payload)
      : await crearClienteApi(payload);

    if (!res.ok) {
      establecerGuardandoCliente(false);
      establecerErrorFormCliente(res.error ?? "No se pudo guardar el cliente.");
      return;
    }

    // Si se seleccionó vincular a una obra existente, actualizar el proyecto en un solo paso
    if (cliProyectoVincularId) {
      const proyElegido = proyectos.find((p) => String(p.id_proyecto) === cliProyectoVincularId);
      const idClienteFinal = editandoClienteId ?? res.data?.cliente?.id_cliente;
      if (proyElegido) {
        await actualizarProyecto(proyElegido.id_proyecto, {
          nombre_proyecto: proyElegido.nombre_proyecto,
          tipo_proyecto: proyElegido.tipo_proyecto,
          cliente: cliRazonSocial.trim(),
          id_cliente: idClienteFinal ?? proyElegido.id_cliente,
          direccion: proyElegido.direccion || cliDireccion.trim() || null,
          fecha_inicio: proyElegido.fecha_inicio,
          fecha_fin: proyElegido.fecha_fin,
          presupuesto_inicial: proyElegido.presupuesto_inicial,
          presupuesto_horas: proyElegido.presupuesto_horas,
          valor_venta: proyElegido.valor_venta,
          porcentaje_avance: proyElegido.porcentaje_avance,
          estado_proyecto: proyElegido.estado_proyecto,
          id_usuario: proyElegido.id_usuario,
        }).catch(() => undefined);
      }
    }

    establecerGuardandoCliente(false);
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

  const obtenerDatosContactoPlan = (plan: PlanMantencionCliente | null) => {
    if (!plan) {
      return {
        nombreContacto: "Sin contacto registrado",
        telefono: "",
        correo: "",
        direccion: "",
        rut: "",
      };
    }
    const cli = clientes.find(
      (c) =>
        c.id_cliente === plan.id_cliente ||
        (c.razon_social &&
          plan.razon_social &&
          c.razon_social.toLowerCase() === plan.razon_social.toLowerCase())
    );
    return {
      nombreContacto:
        plan.nombre_contacto || cli?.nombre_contacto || "Encargado de Mantención",
      telefono: plan.telefono_cliente || cli?.telefono || "",
      correo: cli?.correo_contacto || "",
      direccion: cli?.direccion || "",
      rut: plan.rut_cliente || cli?.rut_cliente || "",
    };
  };

  const abrirModalContacto = (
    plan: PlanMantencionCliente,
    canalInicial: (typeof CANALES_CONTACTO)[number] = "Teléfono"
  ) => {
    const infoContacto = obtenerDatosContactoPlan(plan);
    establecerPlanContactando(plan);
    establecerSegCanal(canalInicial);
    establecerSegResultado("Visita Confirmada");
    establecerSegObservaciones(
      `Contacto con ${infoContacto.nombreContacto} (${plan.razon_social}) por mantención cada ${plan.frecuencia_meses} meses.`
    );
    establecerSegGenerarFaena(true);
  };

  const lanzarAccionComunicacionDirecta = (
    plan: PlanMantencionCliente,
    tipo: "llamar" | "whatsapp" | "correo"
  ) => {
    const info = obtenerDatosContactoPlan(plan);
    if (tipo === "llamar") {
      establecerSegCanal("Teléfono");
      if (info.telefono) {
        const telLimpio = info.telefono.replace(/[^+\d]/g, "");
        Linking.openURL(`tel:${telLimpio}`).catch(() => undefined);
      } else {
        onAviso?.("Este cliente no tiene un número telefónico registrado en su ficha.");
      }
      return;
    }
    if (tipo === "whatsapp") {
      establecerSegCanal("WhatsApp");
      if (info.telefono) {
        const numWa = info.telefono.replace(/[^\d]/g, "");
        const msg = encodeURIComponent(
          `Hola ${info.nombreContacto}, le escribimos de FYAG por la programación de "${plan.titulo_plan}" (${plan.razon_social}) correspondiente al ${formatearFecha(plan.fecha_proxima_mantencion)}.`
        );
        Linking.openURL(`https://wa.me/${numWa}?text=${msg}`).catch(() => undefined);
      } else {
        onAviso?.("Este cliente no tiene un número de teléfono/WhatsApp registrado.");
      }
      return;
    }
    if (tipo === "correo") {
      establecerSegCanal("Correo");
      if (info.correo) {
        const subject = encodeURIComponent(
          `Coordinación ${plan.titulo_plan} - ${plan.razon_social}`
        );
        const body = encodeURIComponent(
          `Estimado/a ${info.nombreContacto},\n\nJunto con saludar, nos ponemos en contacto desde FYAG para coordinar la mantención periódica "${plan.titulo_plan}" programada para el ${formatearFecha(plan.fecha_proxima_mantencion)}.\n\nQuedamos atentos a su confirmación.`
        );
        Linking.openURL(`mailto:${info.correo}?subject=${subject}&body=${body}`).catch(
          () => undefined
        );
      } else {
        onAviso?.("Este cliente no tiene un correo electrónico registrado.");
      }
    }
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

  const contenidoPrincipal = (
    <>
      {modoPagina ? (
        <EncabezadoPagina
          title="Directorio de Clientes"
          subtitle="Registro de clientes, asignación a proyectos y planes de mantención periódica (cada 3, 6, 10 o 12 meses)"
        />
      ) : (
        /* CABECERA OSCURA EJECUTIVA */
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
            <Ionicons name="close" size={22} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      )}

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
             PESTAÑA 1: DIRECTORIO DE CLIENTES (DASHBOARD COMPACTO + SEMÁFORO)
             ============================================================== */
          <>
            {/* 1. CABECERA COMPACTA INDUSTRIAL + BOTÓN NUEVO CLIENTE */}
            <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
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
                    <Ionicons name="business-outline" size={20} color={tema.colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                      Directorio de Clientes y Obras
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                      <Text style={{ fontWeight: "800", color: tema.colors.okDark }}>
                        {contadoresClientes.activos} activos
                      </Text>
                      {` • ${contadoresClientes.conMantencion} con mantención periódica • ${proyectos.length} obras`}
                    </Text>
                  </View>
                </View>

                <Boton
                  title="Nuevo Cliente"
                  variant="primary"
                  size="sm"
                  icon="person-add-outline"
                  onPress={abrirNuevoCliente}
                  style={{ minHeight: 40 }}
                  fullWidth={esMovilEstrecho}
                />
              </View>
            </Tarjeta>

            {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {[
                {
                  id: "activos" as const,
                  titulo: "Activos",
                  valor: contadoresClientes.activos,
                  sub: "Clientes operativos",
                  icon: "checkmark-circle-outline" as const,
                  bg: "#f0fdf4",
                  border: "#86efac",
                  borderActivo: "#16a34a",
                  textColor: "#166534",
                },
                {
                  id: "con_mantencion" as const,
                  titulo: "Con Mantención",
                  valor: contadoresClientes.conMantencion,
                  sub: "Planes periódicos",
                  icon: "calendar-outline" as const,
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  borderActivo: "#d97706",
                  textColor: "#92400e",
                },
                {
                  id: "inactivos" as const,
                  titulo: "Inactivos",
                  valor: contadoresClientes.inactivos,
                  sub: "Deshabilitados",
                  icon: "ban-outline" as const,
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  borderActivo: "#64748b",
                  textColor: "#334155",
                },
                {
                  id: "todos" as const,
                  titulo: "Todos",
                  valor: contadoresClientes.total,
                  sub: "Directorio total",
                  icon: "layers-outline" as const,
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  borderActivo: "#334155",
                  textColor: "#0f172a",
                },
              ].map((kpi) => {
                const activo = filtroEstadoCliente === kpi.id;
                return (
                  <TouchableOpacity
                    key={kpi.id}
                    activeOpacity={0.8}
                    onPress={() => establecerFiltroEstadoCliente(kpi.id)}
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

            {/* 3. BUSCADOR DE ANCHO COMPLETO */}
            <CampoBusqueda
              value={busquedaCliente}
              onChangeText={establecerBusquedaCliente}
              placeholder="Buscar cliente por RUT, razón social, giro o contacto..."
              containerStyle={{ marginBottom: 12 }}
            />

            {/* 4. LISTADO DE TARJETAS DE CLIENTES CON SEMÁFORO DE SUPERFICIE */}
            {clientesFiltrados.length === 0 ? (
              <EstadoVacio
                icon="business-outline"
                title="Sin clientes en esta vista"
                description={
                  busquedaCliente.trim()
                    ? `No se encontraron clientes que coincidan con "${busquedaCliente.trim()}".`
                    : "No hay clientes registrados bajo el filtro seleccionado."
                }
                actionTitle={filtroEstadoCliente !== "todos" ? "Ver Todos los Clientes" : "Nuevo Cliente"}
                onAction={
                  filtroEstadoCliente !== "todos"
                    ? () => establecerFiltroEstadoCliente("todos")
                    : abrirNuevoCliente
                }
                containerStyle={{ marginVertical: 16 }}
              />
            ) : (
              clientesFiltrados.map((c) => {
                const proyectosDelCliente = proyectos.filter(
                  (p) =>
                    p.id_cliente === c.id_cliente ||
                    (p.cliente ?? "").toLowerCase() === c.razon_social.toLowerCase()
                );
                const planesDelCliente = planes.filter((pl) => pl.id_cliente === c.id_cliente);
                const tienePlanUrgente = planesDelCliente.some((pl) => (pl.dias_restantes ?? 30) <= 30);
                const tienePlanVencido = planesDelCliente.some((pl) => (pl.dias_restantes ?? 30) < 0);

                const semaforo = !c.activo
                  ? {
                      bg: "#f1f5f9",
                      border: "#cbd5e1",
                      stripe: "#64748b",
                      text: "#334155",
                      divider: "#e2e8f0",
                      label: "Inactivo",
                      tone: "mute" as const,
                    }
                  : tienePlanVencido
                    ? {
                        bg: "#fef2f2",
                        border: "#fca5a5",
                        stripe: "#dc2626",
                        text: "#991b1b",
                        divider: "#fecaca",
                        label: "Mantención Vencida",
                        tone: "danger" as const,
                      }
                    : tienePlanUrgente
                      ? {
                          bg: "#fffbeb",
                          border: "#fcd34d",
                          stripe: "#d97706",
                          text: "#92400e",
                          divider: "#fde68a",
                          label: "Mantención Próxima",
                          tone: "warn" as const,
                        }
                      : {
                          bg: "#f0fdf4",
                          border: "#86efac",
                          stripe: "#16a34a",
                          text: "#166534",
                          divider: "#bbf7d0",
                          label: "Activo",
                          tone: "ok" as const,
                        };

                return (
                  <Tarjeta
                    key={c.id_cliente}
                    variant="outlined"
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      backgroundColor: semaforo.bg,
                      borderColor: semaforo.border,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: semaforo.stripe,
                      borderRadius: 12,
                      opacity: c.activo ? 1 : 0.85,
                    }}
                  >
                    {/* Cabecera de la ficha del cliente */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 190 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: tema.colors.text }}>
                          {c.razon_social}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: semaforo.text, marginTop: 1 }}>
                          RUT: {c.rut_cliente}
                          {c.giro ? ` • ${c.giro}` : ""}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {proyectosDelCliente.length > 0 && (
                          <Insignia
                            label={`${proyectosDelCliente.length} obra${proyectosDelCliente.length > 1 ? "s" : ""}`}
                            tone="info"
                            size="sm"
                          />
                        )}
                        <Insignia label={semaforo.label} tone={semaforo.tone} size="sm" />
                      </View>
                    </View>

                    {/* Caja blanca interna con Contacto, Correo, Dirección y Planes */}
                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforo.divider,
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        marginTop: 8,
                        gap: 5,
                      }}
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, minWidth: 140 }}>
                          <Ionicons name="person-outline" size={13} color={tema.colors.textMuted} />
                          <Text style={{ fontSize: 12, fontWeight: "600", color: tema.colors.text }} numberOfLines={1}>
                            {c.nombre_contacto || "Sin contacto asignado"}
                          </Text>
                        </View>
                        {c.telefono ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Ionicons name="call-outline" size={13} color={tema.colors.primaryDark} />
                            <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text }}>
                              {c.telefono}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {(c.correo_contacto || c.direccion) && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                          {c.correo_contacto ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, minWidth: 150 }}>
                              <Ionicons name="mail-outline" size={13} color={tema.colors.textMuted} />
                              <Text style={{ fontSize: 11, color: tema.colors.textSecondary }} numberOfLines={1}>
                                {c.correo_contacto}
                              </Text>
                            </View>
                          ) : null}
                          {c.direccion ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 160 }}>
                              <Ionicons name="location-outline" size={13} color={tema.colors.textMuted} />
                              <Text style={{ fontSize: 11, color: tema.colors.textSecondary }} numberOfLines={1}>
                                {c.direccion}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {planesDelCliente.length > 0 && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => establecerPestanaActiva("seguimiento")}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "#fffbeb",
                            borderWidth: 1,
                            borderColor: "#fde68a",
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            marginTop: 2,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Ionicons name="calendar-outline" size={13} color="#b45309" />
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#b45309" }}>
                              {planesDelCliente.length} plan{planesDelCliente.length > 1 ? "es" : ""} de mantención periódico programado
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={13} color="#b45309" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Fila de acciones con contraste limpio sobre tarjeta coloreada */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {onSeleccionarClienteParaProyecto && c.activo ? (
                        <Boton
                          title="Seleccionar"
                          variant="primary"
                          size="sm"
                          icon="checkmark-circle-outline"
                          onPress={() => {
                            onSeleccionarClienteParaProyecto(c);
                            onClose();
                          }}
                          style={{ flex: 1, minHeight: 36 }}
                        />
                      ) : null}

                      {c.activo && (
                        <Boton
                          title="Mantención"
                          variant="outline"
                          size="sm"
                          icon="calendar-outline"
                          onPress={() => abrirNuevoPlan(c)}
                          style={{ flex: 1, minHeight: 36, backgroundColor: "#ffffff" }}
                        />
                      )}

                      <Boton
                        title="Editar"
                        variant="outline"
                        size="sm"
                        icon="create-outline"
                        onPress={() => abrirEditarCliente(c)}
                        style={{ flex: 1, minHeight: 36, backgroundColor: "#ffffff" }}
                      />

                      <Boton
                        title={c.activo ? "Deshabilitar" : "Habilitar"}
                        variant="outline"
                        size="sm"
                        icon={c.activo ? "ban-outline" : "checkmark-circle-outline"}
                        onPress={() => toggleEstadoCliente(c)}
                        style={{ flex: 1, minHeight: 36, backgroundColor: "#ffffff" }}
                      />
                    </View>
                  </Tarjeta>
                );
              })
            )}
          </>
        ) : (
          /* ==============================================================
             PESTAÑA 2: PLANES DE MANTENCIÓN (DASHBOARD COMPACTO + SEMÁFORO)
             ============================================================== */
          <>
            {/* 1. CABECERA COMPACTA INDUSTRIAL DE MANTENCIONES */}
            <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
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
                    <Ionicons name="calendar-outline" size={20} color={tema.colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                      Planes y Seguimiento de Mantención
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                      Cartera pactada:{" "}
                      <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                        {formatearCLP(contadoresPlanes.montoTotalPactado)}
                      </Text>
                      {` • ${contadoresPlanes.total} plan(es) activos (3, 6, 10 o 12 meses)`}
                    </Text>
                  </View>
                </View>

                <Boton
                  title="Nuevo Plan"
                  variant="primary"
                  size="sm"
                  icon="add-outline"
                  onPress={() => abrirNuevoPlan()}
                  style={{ minHeight: 40 }}
                  fullWidth={esMovilEstrecho}
                />
              </View>
            </Tarjeta>

            {/* 2. GRILLA 2x2 DE TARJETAS KPI INTERACTIVAS CON SEMÁFORO */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {[
                {
                  id: "vencidos" as const,
                  titulo: "Vencidas",
                  valor: contadoresPlanes.vencidos,
                  sub: "Prioridad llamado",
                  icon: "alert-circle-outline" as const,
                  bg: contadoresPlanes.vencidos > 0 ? "#fef2f2" : "#f1f5f9",
                  border: contadoresPlanes.vencidos > 0 ? "#fca5a5" : "#cbd5e1",
                  borderActivo: contadoresPlanes.vencidos > 0 ? "#dc2626" : "#475569",
                  textColor: contadoresPlanes.vencidos > 0 ? "#991b1b" : "#334155",
                },
                {
                  id: "proximos" as const,
                  titulo: "Próximas (≤30d)",
                  valor: contadoresPlanes.proximos,
                  sub: "Agendar este mes",
                  icon: "time-outline" as const,
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  borderActivo: "#d97706",
                  textColor: "#92400e",
                },
                {
                  id: "al_dia" as const,
                  titulo: "Al Día (>30d)",
                  valor: contadoresPlanes.alDia,
                  sub: "Ciclo vigente",
                  icon: "checkmark-done-circle-outline" as const,
                  bg: "#f0fdf4",
                  border: "#86efac",
                  borderActivo: "#16a34a",
                  textColor: "#166534",
                },
                {
                  id: "todos" as const,
                  titulo: "Todos los Planes",
                  valor: contadoresPlanes.total,
                  sub: "Cartera completa",
                  icon: "layers-outline" as const,
                  bg: "#f1f5f9",
                  border: "#cbd5e1",
                  borderActivo: "#334155",
                  textColor: "#0f172a",
                },
              ].map((kpi) => {
                const activo = filtroSemaforoPlan === kpi.id;
                return (
                  <TouchableOpacity
                    key={kpi.id}
                    activeOpacity={0.8}
                    onPress={() => establecerFiltroSemaforoPlan(kpi.id)}
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

            {/* 3. BUSCADOR DE PLANES */}
            <CampoBusqueda
              value={busquedaPlan}
              onChangeText={establecerBusquedaPlan}
              placeholder="Buscar plan por servicio, cliente, obra, kit o contrato..."
              containerStyle={{ marginBottom: 12 }}
            />

            {/* 4. LISTADO DE PLANES DE MANTENCIÓN CON SEMÁFORO DE SUPERFICIE */}
            {planesFiltrados.length === 0 ? (
              <EstadoVacio
                icon="calendar-outline"
                title="Sin planes de mantención en esta vista"
                description={
                  busquedaPlan.trim()
                    ? `No hay planes que coincidan con "${busquedaPlan.trim()}".`
                    : "No hay planes registrados bajo este estado del semáforo."
                }
                actionTitle={filtroSemaforoPlan !== "todos" ? "Ver Todos los Planes" : "Nuevo Plan"}
                onAction={
                  filtroSemaforoPlan !== "todos"
                    ? () => establecerFiltroSemaforoPlan("todos")
                    : () => abrirNuevoPlan()
                }
                containerStyle={{ marginVertical: 16 }}
              />
            ) : (
              planesFiltrados.map((pl) => {
                const dias = pl.dias_restantes ?? 30;
                const esVencido = dias < 0;
                const esProximo = dias >= 0 && dias <= 30;
                const datosContactoPlan = obtenerDatosContactoPlan(pl);

                const semaforoPlan = esVencido
                  ? {
                      bg: "#fef2f2",
                      border: "#fca5a5",
                      stripe: "#dc2626",
                      text: "#991b1b",
                      divider: "#fecaca",
                      badgeBg: "#fee2e2",
                      texto: `Vencida hace ${Math.abs(dias)}d`,
                    }
                  : esProximo
                    ? {
                        bg: "#fffbeb",
                        border: "#fcd34d",
                        stripe: "#d97706",
                        text: "#92400e",
                        divider: "#fde68a",
                        badgeBg: "#fef3c7",
                        texto: dias === 0 ? "Vence Hoy" : `Próxima en ${dias}d`,
                      }
                    : {
                        bg: "#f0fdf4",
                        border: "#86efac",
                        stripe: "#16a34a",
                        text: "#166534",
                        divider: "#bbf7d0",
                        badgeBg: "#dcfce7",
                        texto: `Al día (${dias}d)`,
                      };

                const expandido = Boolean(planesExpandidos[pl.id_plan]);

                return (
                  <Tarjeta
                    key={pl.id_plan}
                    variant="outlined"
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      backgroundColor: semaforoPlan.bg,
                      borderColor: semaforoPlan.border,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      borderLeftColor: semaforoPlan.stripe,
                      borderRadius: 12,
                    }}
                  >
                    {/* Cabecera: Título + Cliente/Obra + Caja de Valor Pactado */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 190 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              backgroundColor: "#ffffff",
                              borderWidth: 1,
                              borderColor: semaforoPlan.border,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 4,
                                backgroundColor: semaforoPlan.stripe,
                              }}
                            />
                            <Text style={{ fontSize: 10, fontWeight: "800", color: semaforoPlan.text }}>
                              {semaforoPlan.texto}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: "#ffffff",
                              borderWidth: 1,
                              borderColor: tema.colors.primaryBorder,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Ionicons name="repeat-outline" size={11} color="#b45309" />
                            <Text style={{ fontSize: 10, fontWeight: "800", color: "#b45309" }}>
                              Cada {pl.frecuencia_meses} meses
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: tema.colors.text,
                            marginTop: 5,
                          }}
                        >
                          {pl.titulo_plan}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: semaforoPlan.text, marginTop: 1 }}>
                          {pl.razon_social}
                          {pl.nombre_proyecto_origen ? ` • ${pl.nombre_proyecto_origen}` : ""}
                        </Text>
                      </View>

                      {pl.costo_pactado > 0 && (
                        <View
                          style={{
                            backgroundColor: "#ffffff",
                            borderWidth: 1,
                            borderColor: semaforoPlan.divider,
                            borderRadius: 9,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            alignItems: "flex-end",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: tema.colors.textMuted,
                              textTransform: "uppercase",
                            }}
                          >
                            Valor Pactado
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: "900", color: semaforoPlan.text }}>
                            {formatearCLP(pl.costo_pactado)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Ficha blanca interna: Contacto Directo + Fechas + Kit/Contrato + Stock */}
                    <View
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: semaforoPlan.divider,
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        marginTop: 8,
                        gap: 7,
                      }}
                    >
                      {/* Fila destacada con los datos de contacto del cliente para llamar/escribir */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          backgroundColor: "#f8fafc",
                          borderWidth: 1,
                          borderColor: "#e2e8f0",
                          borderRadius: 7,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="person-circle-outline" size={15} color={tema.colors.primaryDark} />
                            <Text style={{ fontSize: 11.5, fontWeight: "800", color: tema.colors.text }}>
                              {datosContactoPlan.nombreContacto}
                            </Text>
                          </View>

                          {datosContactoPlan.telefono ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Ionicons name="call-outline" size={13} color="#16a34a" />
                              <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#166534" }}>
                                {datosContactoPlan.telefono}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, color: tema.colors.textMuted }}>
                              Sin teléfono
                            </Text>
                          )}

                          {datosContactoPlan.correo ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Ionicons name="mail-outline" size={13} color={tema.colors.textMuted} />
                              <Text style={{ fontSize: 11, color: tema.colors.textSecondary }} numberOfLines={1}>
                                {datosContactoPlan.correo}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Botones rápidos de llamada / WhatsApp / Correo directo desde la tarjeta */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          {Boolean(datosContactoPlan.telefono) && (
                            <>
                              <TouchableOpacity
                                onPress={() => {
                                  abrirModalContacto(pl, "Teléfono");
                                  lanzarAccionComunicacionDirecta(pl, "llamar");
                                }}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#f0fdf4",
                                  borderWidth: 1,
                                  borderColor: "#86efac",
                                  borderRadius: 6,
                                  paddingHorizontal: 7,
                                  paddingVertical: 3,
                                }}
                              >
                                <Ionicons name="call" size={11} color="#16a34a" />
                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#166534" }}>
                                  Llamar
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => {
                                  abrirModalContacto(pl, "WhatsApp");
                                  lanzarAccionComunicacionDirecta(pl, "whatsapp");
                                }}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#f0fdf4",
                                  borderWidth: 1,
                                  borderColor: "#86efac",
                                  borderRadius: 6,
                                  paddingHorizontal: 7,
                                  paddingVertical: 3,
                                }}
                              >
                                <Ionicons name="logo-whatsapp" size={11} color="#16a34a" />
                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#166534" }}>
                                  WhatsApp
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Ionicons name="calendar-outline" size={13} color={tema.colors.textMuted} />
                          <Text style={{ fontSize: 11, color: tema.colors.textSecondary }}>
                            Última:{" "}
                            <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                              {pl.fecha_ultima_mantencion ? formatearFecha(pl.fecha_ultima_mantencion) : "—"}
                            </Text>
                          </Text>
                          <Ionicons name="arrow-forward-outline" size={12} color={tema.colors.textMuted} />
                          <Text style={{ fontSize: 11, fontWeight: "800", color: semaforoPlan.text }}>
                            Próxima: {formatearFecha(pl.fecha_proxima_mantencion)}
                          </Text>
                        </View>

                        <View
                          style={{
                            backgroundColor: "#f1f5f9",
                            borderWidth: 1,
                            borderColor: "#e2e8f0",
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#334155" }}>
                            {pl.modalidad === "POR_KIT"
                              ? `Kit: ${pl.nombre_kit || "Asignado"}`
                              : pl.modalidad === "POR_CONTRATO"
                                ? `Contrato: ${pl.codigo_contrato || "SLA"}`
                                : `Mixto (${pl.codigo_contrato || "SLA"})`}
                          </Text>
                        </View>
                      </View>

                      {(pl.modalidad === "POR_KIT" || pl.modalidad === "MIXTO") && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons
                            name={pl.kit_stock_ok !== false ? "checkmark-circle" : "alert-circle"}
                            size={13}
                            color={pl.kit_stock_ok !== false ? "#16a34a" : "#d97706"}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              color: pl.kit_stock_ok !== false ? "#166534" : "#b45309",
                              fontWeight: "700",
                            }}
                          >
                            {pl.kit_stock_ok !== false
                              ? "Stock de kit disponible en bodega"
                              : "Verificar stock de kit antes de agendar"}
                          </Text>
                        </View>
                      )}

                      {/* Bitácora expandible de seguimientos */}
                      {pl.seguimientos && pl.seguimientos.length > 0 && (
                        <View style={{ borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 4 }}>
                          <TouchableOpacity
                            onPress={() =>
                              establecerPlanesExpandidos((prev) => ({
                                ...prev,
                                [pl.id_plan]: !prev[pl.id_plan],
                              }))
                            }
                          >
                            <Text style={styles.linkHistorial}>
                              {expandido ? "▼ Ocultar" : "▶ Ver"} bitácora ({pl.seguimientos.length} contacto
                              {pl.seguimientos.length > 1 ? "s" : ""})
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
                    </View>

                    {/* Botón de acción principal */}
                    <View style={{ marginTop: 10 }}>
                      <Boton
                        title="Contactar Cliente / Agendar Mantención"
                        variant="primary"
                        size="sm"
                        icon="call-outline"
                        onPress={() => abrirModalContacto(pl)}
                        style={{ minHeight: 38 }}
                        fullWidth
                      />
                    </View>
                  </Tarjeta>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* =====================================================================
          MODAL 1: REGISTRAR / EDITAR FICHA DE CLIENTE (DISEÑO POR BLOQUES SIN BANCO)
          ===================================================================== */}
      <VistaModal
        visible={modoFormCliente}
        onClose={() => establecerModoFormCliente(false)}
        title={editandoClienteId ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
        subtitle="Identificación tributaria (RUT), rubro comercial y contacto principal de obra o faena"
        maxWidth={620}
      >
        {/* BLOQUE 1: IDENTIFICACIÓN DE LA EMPRESA */}
        <View
          style={{
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: tema.colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="business-outline" size={16} color={tema.colors.primaryDark} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: tema.colors.text,
                  textTransform: "uppercase",
                }}
              >
                1. Identificación de la Empresa
              </Text>
            </View>

            {estadoValidacionRutCliente.estado === "valido" && (
              <Insignia label="RUT Válido" tone="ok" size="sm" />
            )}
            {estadoValidacionRutCliente.estado === "duplicado" && (
              <Insignia label="RUT Duplicado" tone="danger" size="sm" />
            )}
            {estadoValidacionRutCliente.estado === "invalido" && (
              <Insignia label="Revisar DV de RUT" tone="warn" size="sm" />
            )}
          </View>

          <View style={styles.filaDosCol}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <CampoTexto
                label="RUT Cliente"
                required
                icon="card-outline"
                placeholder="Ej: 76.123.456-7"
                value={cliRut}
                onChangeText={establecerCliRut}
                error={
                  estadoValidacionRutCliente.estado === "duplicado"
                    ? estadoValidacionRutCliente.mensaje
                    : undefined
                }
                helper={
                  estadoValidacionRutCliente.estado === "invalido"
                    ? estadoValidacionRutCliente.mensaje
                    : undefined
                }
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
            <View style={{ flex: 1.5, minWidth: 200 }}>
              <CampoTexto
                label="Razón Social / Empresa"
                required
                icon="business-outline"
                placeholder="Ej: Inmobiliaria Pacífico SpA"
                value={cliRazonSocial}
                onChangeText={establecerCliRazonSocial}
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
          </View>

          <CampoTexto
            label="Giro o Rubro Comercial"
            icon="briefcase-outline"
            placeholder="Ej: Construcción e Ingeniería Civil"
            value={cliGiro}
            onChangeText={establecerCliGiro}
            containerStyle={{ marginBottom: 6 }}
          />

          {/* Sugerencias rápidas de 1 toque para el Giro Comercial */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GIROS_SUGERIDOS.map((giroSug) => {
              const esSeleccionado = cliGiro.trim().toLowerCase() === giroSug.toLowerCase();
              return (
                <TouchableOpacity
                  key={giroSug}
                  activeOpacity={0.8}
                  onPress={() => establecerCliGiro(giroSug)}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    backgroundColor: esSeleccionado ? tema.colors.primaryLight : "#ffffff",
                    borderColor: esSeleccionado ? tema.colors.primary : tema.colors.borderDark,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: esSeleccionado ? "800" : "600",
                      color: esSeleccionado ? tema.colors.primaryDark : tema.colors.textSecondary,
                    }}
                  >
                    {giroSug}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* BLOQUE 2: CONTACTO OPERATIVO, UBICACIÓN Y VINCULACIÓN A OBRA */}
        <View
          style={{
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: tema.colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Ionicons name="person-circle-outline" size={17} color={tema.colors.primaryDark} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: tema.colors.text,
                textTransform: "uppercase",
              }}
            >
              2. Contacto Operativo y Ubicación
            </Text>
          </View>

          <View style={styles.filaDosCol}>
            <View style={{ flex: 1, minWidth: 170 }}>
              <CampoTexto
                label="Nombre de Contacto"
                icon="person-outline"
                placeholder="Ej: Rodrigo Sepúlveda"
                value={cliContacto}
                onChangeText={establecerCliContacto}
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <CampoTexto
                label="Teléfono / WhatsApp"
                icon="call-outline"
                placeholder="Ej: +56 9 8765 4321"
                value={cliTelefono}
                onChangeText={establecerCliTelefono}
                keyboardType="phone-pad"
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
          </View>

          <View style={styles.filaDosCol}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <CampoTexto
                label="Correo Electrónico"
                icon="mail-outline"
                placeholder="operaciones@empresa.cl"
                value={cliCorreo}
                onChangeText={establecerCliCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
            <View style={{ flex: 1.3, minWidth: 200 }}>
              <CampoTexto
                label="Dirección Principal / Faena"
                icon="location-outline"
                placeholder="Av. Las Condes 9100, Las Condes"
                value={cliDireccion}
                onChangeText={establecerCliDireccion}
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
          </View>

          {proyectos.length > 0 && (
            <Selector
              label="Vincular a Proyecto / Obra Existente (Opcional)"
              options={opcionesVincularProyectoCliente}
              value={cliProyectoVincularId}
              onChange={establecerCliProyectoVincularId}
              placeholder="Sin vincular a obra por ahora"
              containerStyle={{ marginBottom: 0 }}
            />
          )}
        </View>

        {errorFormCliente ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorBannerTexto}>{errorFormCliente}</Text>
          </View>
        ) : null}

        <View style={styles.formBotonesRow}>
          <Boton
            title="Cancelar"
            variant="outline"
            size="sm"
            onPress={() => establecerModoFormCliente(false)}
            style={{ flex: 1, minHeight: 40 }}
          />
          <Boton
            title={
              guardandoCliente
                ? "Guardando..."
                : editandoClienteId
                  ? "Guardar Cambios"
                  : "Registrar Cliente"
            }
            variant="primary"
            size="sm"
            icon="save-outline"
            disabled={guardandoCliente || estadoValidacionRutCliente.estado === "duplicado"}
            onPress={guardarCliente}
            style={{ flex: 1.4, minHeight: 40 }}
          />
        </View>
      </VistaModal>

      {/* =====================================================================
          MODAL 2: PROGRAMAR NUEVO PLAN DE MANTENCIÓN PERIÓDICA
          ===================================================================== */}
      <VistaModal
        visible={modoFormPlan}
        onClose={() => establecerModoFormPlan(false)}
        title="Programar Plan de Mantención Periódica"
        subtitle="Frecuencia automática cada 3, 6, 10 o 12 meses vinculada a Kit o Contrato SLA"
        maxWidth={620}
      >
        <View
          style={{
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: tema.colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Selector
            label="1. Cliente Asociado"
            required
            options={opcionesSelectorClientes}
            value={planClienteId ? String(planClienteId) : ""}
            onChange={(val) => {
              const idNum = Number(val);
              establecerPlanClienteId(idNum);
              const cliElegido = clientes.find((c) => c.id_cliente === idNum);
              if (cliElegido && (!planTitulo || planTitulo.startsWith("Mantención Preventiva"))) {
                establecerPlanTitulo(`Mantención Preventiva – ${cliElegido.razon_social}`);
              }
            }}
            placeholder="Seleccionar cliente activo..."
          />

          <Selector
            label="2. Proyecto u Obra Relacionada (Opcional)"
            options={opcionesSelectorProyectos}
            value={planProyectoOrigenId ? String(planProyectoOrigenId) : ""}
            onChange={(val) => establecerPlanProyectoOrigenId(val ? Number(val) : null)}
            placeholder="General por Cliente (Sin obra específica)"
            containerStyle={{ marginBottom: 4 }}
          />
        </View>

        <Text style={styles.label}>3. Nombre del Plan o Servicio de Mantención *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Mantención Trimestral Climatización y Tableros"
          placeholderTextColor="#9ca3af"
          value={planTitulo}
          onChangeText={establecerPlanTitulo}
        />

        <Text style={styles.label}>4. Frecuencia de Mantención (Meses) *</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
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
                <Text style={[styles.frecuenciaChipTexto, esActivo && styles.frecuenciaChipTextoActivo]}>
                  Cada {m} meses
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12, color: "#4b5563", fontWeight: "600" }}>Otro:</Text>
            <TextInput
              style={[styles.input, { width: 60, marginBottom: 0, textAlign: "center", height: 36 }]}
              keyboardType="numeric"
              value={planFrecuenciaMeses}
              onChangeText={establecerPlanFrecuenciaMeses}
            />
          </View>
        </View>

        <Text style={styles.label}>5. Modalidad de Asignación *</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {(
            [
              { id: "POR_KIT", label: "Por Kit de Insumos", icon: "cube-outline" as const },
              { id: "POR_CONTRATO", label: "Por Contrato / SLA", icon: "document-text-outline" as const },
              { id: "MIXTO", label: "Mixto (Kit + SLA)", icon: "flash-outline" as const },
            ] as const
          ).map((mod) => {
            const sel = planModalidad === mod.id;
            return (
              <TouchableOpacity
                key={mod.id}
                style={[
                  styles.modalidadBtn,
                  sel && styles.modalidadBtnActivo,
                  { flexDirection: "row", justifyContent: "center", gap: 5 },
                ]}
                onPress={() => establecerPlanModalidad(mod.id)}
              >
                <Ionicons
                  name={mod.icon}
                  size={14}
                  color={sel ? tema.colors.primaryDark : "#4b5563"}
                />
                <Text style={[styles.modalidadBtnTexto, sel && styles.modalidadBtnTextoActivo]}>
                  {mod.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(planModalidad === "POR_KIT" || planModalidad === "MIXTO") && (
          <Selector
            label="Kit Predeterminado para la Mantención"
            required
            options={opcionesSelectorKits}
            value={planKitId ? String(planKitId) : ""}
            onChange={(val) => {
              const kitElegido = kits.find((k) => String(k.id_kit_proyecto) === val);
              if (kitElegido) seleccionarKitEnPlan(kitElegido);
            }}
            placeholder="Seleccionar kit de materiales..."
          />
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
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={styles.label}>Costo / Valor Pactado ($ CLP)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={planCostoPactado}
              onChangeText={establecerPlanCostoPactado}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160 }}>
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
          <Boton
            title="Cancelar"
            variant="outline"
            size="sm"
            onPress={() => establecerModoFormPlan(false)}
            style={{ flex: 1, minHeight: 40 }}
          />
          <Boton
            title={guardandoPlan ? "Programando..." : "Activar Plan"}
            variant="primary"
            size="sm"
            icon="checkmark-circle-outline"
            disabled={guardandoPlan}
            onPress={guardarPlanMantencion}
            style={{ flex: 1.4, minHeight: 40 }}
          />
        </View>
      </VistaModal>

      {/* =====================================================================
          MODAL 3: CONTACTAR CLIENTE Y AGENDAR FAENA DE MANTENCIÓN (REDISEÑADO)
          ===================================================================== */}
      <VistaModal
        visible={Boolean(planContactando)}
        onClose={() => establecerPlanContactando(null)}
        title="Contactar Cliente y Agendar Mantención"
        subtitle={
          planContactando
            ? `${planContactando.razon_social} • ${planContactando.titulo_plan}`
            : ""
        }
        maxWidth={600}
      >
        {planContactando && (() => {
          const infoContacto = obtenerDatosContactoPlan(planContactando);
          const diasPlan = planContactando.dias_restantes ?? 30;
          const esPlanVencido = diasPlan < 0;

          return (
            <>
              {/* BLOQUE 1: FICHA DE CONTACTO DIRECTO DEL CLIENTE + BOTONES DE LLAMADA / WHATSAPP / CORREO */}
              <View
                style={{
                  backgroundColor: esPlanVencido ? "#fef2f2" : "#fffbeb",
                  borderWidth: 1.5,
                  borderColor: esPlanVencido ? "#fca5a5" : "#fcd34d",
                  borderLeftWidth: 5,
                  borderLeftColor: esPlanVencido ? "#dc2626" : "#d97706",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name="person-circle"
                        size={18}
                        color={esPlanVencido ? "#991b1b" : "#92400e"}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: tema.colors.text,
                        }}
                      >
                        {infoContacto.nombreContacto}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "700",
                        color: esPlanVencido ? "#991b1b" : "#92400e",
                        marginTop: 1,
                      }}
                    >
                      {planContactando.razon_social}
                      {infoContacto.rut ? ` • RUT: ${infoContacto.rut}` : ""}
                    </Text>
                  </View>

                  <Insignia
                    label={
                      esPlanVencido
                        ? `Vencida hace ${Math.abs(diasPlan)}d`
                        : diasPlan === 0
                          ? "Vence Hoy"
                          : `Próxima en ${diasPlan}d`
                    }
                    tone={esPlanVencido ? "danger" : "warn"}
                    size="sm"
                  />
                </View>

                {/* Datos de Teléfono, Correo y Dirección en caja blanca limpia */}
                <View
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: esPlanVencido ? "#fecaca" : "#fde68a",
                    borderRadius: 9,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    gap: 5,
                  }}
                >
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="call" size={14} color="#16a34a" />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: tema.colors.text }}>
                        {infoContacto.telefono || "Sin teléfono registrado"}
                      </Text>
                    </View>

                    {infoContacto.correo ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Ionicons name="mail" size={14} color={tema.colors.primaryDark} />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: tema.colors.textSecondary }}>
                          {infoContacto.correo}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {infoContacto.direccion ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="location-outline" size={14} color={tema.colors.textMuted} />
                      <Text style={{ fontSize: 11.5, color: tema.colors.textSecondary }} numberOfLines={1}>
                        {infoContacto.direccion}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Botones de Acción de Comunicación en 1 Toque */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => lanzarAccionComunicacionDirecta(planContactando, "llamar")}
                    style={{
                      flex: 1,
                      minWidth: 110,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#ffffff",
                      borderWidth: 1.5,
                      borderColor: "#16a34a",
                      borderRadius: 8,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Ionicons name="call-outline" size={15} color="#16a34a" />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#166534" }}>
                      Llamar Ahora
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => lanzarAccionComunicacionDirecta(planContactando, "whatsapp")}
                    style={{
                      flex: 1,
                      minWidth: 115,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#f0fdf4",
                      borderWidth: 1.5,
                      borderColor: "#16a34a",
                      borderRadius: 8,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#166534" }}>
                      Abrir WhatsApp
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => lanzarAccionComunicacionDirecta(planContactando, "correo")}
                    style={{
                      flex: 1,
                      minWidth: 110,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: tema.colors.borderDark,
                      borderRadius: 8,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Ionicons name="mail-outline" size={15} color={tema.colors.primaryDark} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: tema.colors.text }}>
                      Enviar Correo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* BLOQUE 2: REGISTRO DE LA GESTIÓN Y AGENDAMIENTO */}
              <View
                style={{
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: tema.colors.border,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Text style={styles.label}>1. Canal de Contacto Utilizado:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {(
                    [
                      { id: "Teléfono", icon: "call-outline" as const },
                      { id: "WhatsApp", icon: "logo-whatsapp" as const },
                      { id: "Correo", icon: "mail-outline" as const },
                      { id: "Visita", icon: "walk-outline" as const },
                    ] as const
                  ).map((c) => {
                    const activo = segCanal === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.selectorChip,
                          activo && styles.selectorChipActivo,
                          { flexDirection: "row", alignItems: "center", gap: 5 },
                        ]}
                        onPress={() => establecerSegCanal(c.id)}
                      >
                        <Ionicons
                          name={c.icon}
                          size={13}
                          color={activo ? "#818cf8" : "#4b5563"}
                        />
                        <Text
                          style={[
                            styles.selectorChipTexto,
                            activo && styles.selectorChipTextoActivo,
                          ]}
                        >
                          {c.id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>2. Resultado de la Gestión:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {RESULTADOS_CONTACTO.map((r) => {
                    const activo = segResultado === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.selectorChip, activo && styles.selectorChipActivo]}
                        onPress={() => {
                          establecerSegResultado(r);
                          if (r === "Visita Confirmada") establecerSegGenerarFaena(true);
                          if (r === "Pospuesto por Cliente" || r === "Pendiente Contacto") {
                            establecerSegGenerarFaena(false);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.selectorChipTexto,
                            activo && styles.selectorChipTextoActivo,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Pressable
                  style={[
                    styles.toggleGenerarFaenaCaja,
                    segGenerarFaena && styles.toggleGenerarFaenaCajaActivo,
                  ]}
                  onPress={() => establecerSegGenerarFaena((prev) => !prev)}
                >
                  <Ionicons
                    name={segGenerarFaena ? "checkbox" : "square-outline"}
                    size={18}
                    color={segGenerarFaena ? tema.colors.primary : "#9ca3af"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleGenerarTitulo}>
                      Crear Faena de Mantención y avanzar ciclo (+{planContactando.frecuencia_meses} meses)
                    </Text>
                    <Text style={styles.toggleGenerarSub}>
                      Fecha actual: {formatearFecha(planContactando.fecha_proxima_mantencion)} → Próximo ciclo:{" "}
                      <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                        {formatearFecha(
                          sumarMesesFecha(
                            planContactando.fecha_proxima_mantencion,
                            planContactando.frecuencia_meses
                          )
                        )}
                      </Text>
                    </Text>
                  </View>
                </Pressable>

                <CampoTexto
                  label="3. Observaciones / Acuerdos con el Cliente"
                  icon="chatbubble-ellipses-outline"
                  value={segObservaciones}
                  onChangeText={establecerSegObservaciones}
                  placeholder="Ej: Cliente confirma visita para el viernes a las 09:00 hrs..."
                  containerStyle={{ marginBottom: 6 }}
                />

                {/* Plantillas rápidas de respuesta en 1 toque */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {[
                    `Confirma visita técnica con ${infoContacto.nombreContacto}`,
                    "Solicita reagendar para la próxima semana",
                    "Sin respuesta telefónica, se envía mensaje por WhatsApp",
                  ].map((plantilla) => (
                    <TouchableOpacity
                      key={plantilla}
                      onPress={() => establecerSegObservaciones(plantilla)}
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: tema.colors.borderDark,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "600", color: tema.colors.textSecondary }}>
                        + {plantilla}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formBotonesRow}>
                <Boton
                  title="Cancelar"
                  variant="outline"
                  size="sm"
                  onPress={() => establecerPlanContactando(null)}
                  style={{ flex: 1, minHeight: 40 }}
                />
                <Boton
                  title={
                    guardandoSeguimiento
                      ? "Procesando..."
                      : segGenerarFaena
                        ? "Confirmar y Generar Faena"
                        : "Guardar Contacto"
                  }
                  variant="primary"
                  size="sm"
                  icon="checkmark-circle-outline"
                  disabled={guardandoSeguimiento}
                  onPress={confirmarSeguimientoContacto}
                  style={{ flex: 1.5, minHeight: 40 }}
                />
              </View>
            </>
          );
        })()}
      </VistaModal>
    </>
  );

  if (modoPagina) {
    return <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>{contenidoPrincipal}</View>;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>{contenidoPrincipal}</View>
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
    backgroundColor: "#0f172a",
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
    color: "#94a3b8",
    marginTop: 2,
  },
  btnCerrar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1e293b",
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
  tarjetaItemInactiva: {
    opacity: 0.6,
    backgroundColor: "#f9fafb",
  },
  tarjetaItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  clienteTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  clienteSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  badgeEstadoActivo: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeEstadoActivoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
  },
  badgeInactivo: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeInactivoTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  clienteDetalleCaja: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
    marginTop: 4,
    gap: 6,
  },
  clienteDetalleFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  clienteDetalleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 140,
  },
  clienteDetalleTexto: {
    fontSize: 12,
    color: "#4b5563",
  },
  clientePlanesAvisoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  clientePlanesAvisoTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
  },
  accionesTarjetaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  btnAccionPrincipal: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  btnAccionPrincipalTexto: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  btnAccionSecundario: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  btnAccionSecundarioTexto: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "600",
  },
  btnAccionNeutro: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  btnAccionNeutroTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  clienteGiro: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
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
  btnAccionAmbar: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: tema.colors.primary,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  btnAccionAmbarTexto: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
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
    backgroundColor: "#0f172a",
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
    backgroundColor: "#0f172a",
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
  planMetaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    marginBottom: 6,
  },
  planMetaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planMetaTagTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
  },
  planMetaTagNeutro: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planMetaTagNeutroTexto: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4b5563",
  },
  planValorPactadoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginLeft: "auto",
  },
  panelContactoCaja: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  panelContactoTag: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.primary,
    marginBottom: 2,
    letterSpacing: 0.5,
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
