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
import { estilos } from "./estilos";
import { VistaDetalleProyecto, VistaListadoProyectos, ModalesProyectos } from "./componentes";

export const PantallaProyectos: React.FC = () => {
  const {
    proyectos,
    tecnicos,
    clientes,
    solicitudesMaterial,
    ordenesDevolucion,
    crearProyecto,
    actualizarProyecto,
    asignarTecnicosAProyecto,
    cerrarProyecto,
    registrarHorasManualesAdmin,
  } = usarAplicacion();
  const { rolActual, usuario } = usarAutenticacion();

  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);

  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // Selected project for detail view
  const [seleccionadoProyecto, establecerSeleccionadoProyecto] = useState<Proyecto | null>(null);
  const [detallePestana, establecerDetallePestana] = useState<
    "resumen" | "tecnicos" | "insumos" | "horas" | "rentabilidad"
  >("resumen");

  // Filter list
  const [listaEstadoFiltrar, establecerListaEstadoFiltrar] = useState<string>("todos");
  const [listaClaseFiltrar, establecerListaClaseFiltrar] = useState<string>("todos");
  const [buscarProyecto, establecerBuscarProyecto] = useState("");

  // Project form modal state
  const proyectoNombreEntradaReferencia = useRef<TextInput>(null);
  const [formularioModalVisible, establecerFormularioModalVisible] = useState(false);
  const [editandoProyecto, establecerEditandoProyecto] = useState<Proyecto | null>(null);
  const [formularioNombre, establecerFormularioNombre] = useState("");
  const [formularioNombreError, establecerFormularioNombreError] = useState("");
  const [formularioCliente, establecerFormularioCliente] = useState("");
  const [formularioClienteError, establecerFormularioClienteError] = useState("");
  const [formularioClase, establecerFormularioClase] = useState<TipoProyecto>("obra");
  const [formularioDireccion, establecerFormularioDireccion] = useState("");
  const [formularioIniciarFecha, establecerFormularioIniciarFecha] = useState("2026-10-01");
  const [formularioPlazo, establecerFormularioPlazo] = useState("2026-11-30");
  const [formularioPresupuestoMateriales, establecerFormularioPresupuestoMateriales] = useState("6000000");
  const [formularioPresupuestoHoras, establecerFormularioPresupuestoHoras] = useState("250");
  const [formularioVentaValor, establecerFormularioVentaValor] = useState("15000000");
  const [formularioEstado, establecerFormularioEstado] = useState<EstadoProyecto>("activo");
  const [formularioError, establecerFormularioError] = useState("");

  // Close modal state (lists active blocking reasons)
  const [cerrarModalVisible, establecerCerrarModalVisible] = useState(false);
  const [cerrarProyectoTarget, establecerCerrarProyectoTarget] = useState<Proyecto | null>(null);
  const [cerrarBloques, establecerCerrarBloques] = useState<string[]>([]);

  // Admin manual hours modal state
  const [adminManualModalAbrir, establecerAdminManualModalAbrir] = useState(false);
  const [adminManualTecnicoRut, establecerAdminManualTecnicoRut] = useState(tecnicos[0]?.rut || "");
  const [adminManualFecha, establecerAdminManualFecha] = useState(new Date().toISOString().slice(0, 10));
  const [adminManualHoras, establecerAdminManualHoras] = useState(8.0);
  const [adminManualMotivo, establecerAdminManualMotivo] = useState("Falla de Batería en Faena");
  const [adminManualDescripcion, establecerAdminManualDescripcion] = useState("");
  const [adminManualError, establecerAdminManualError] = useState("");

  const manejarConfirmarAdminManualHoras = () => {
    if (!seleccionadoProyecto) return;
    const tecnico = tecnicos.find((t) => t.rut === adminManualTecnicoRut) || tecnicos[0];
    if (!tecnico) {
      establecerAdminManualError("Seleccione un técnico.");
      return;
    }
    const resultado = registrarHorasManualesAdmin({
      technicianRut: tecnico.rut,
      technicianName: tecnico.name,
      projectId: seleccionadoProyecto.id,
      date: adminManualFecha,
      hours: adminManualHoras,
      description: adminManualDescripcion.trim() || `Carga manual extraordinaria por Administración (${adminManualMotivo}).`,
      reason: adminManualMotivo,
    });
    if (!resultado.success) {
      establecerAdminManualError(resultado.error || "Error al imputar horas.");
    } else {
      establecerAdminManualModalAbrir(false);
      establecerAdminManualDescripcion("");
      mostrarAviso(`✓ ${adminManualHoras} HH imputadas a ${tecnico.name} en ${seleccionadoProyecto.code}.`);
      const updatedProyecto = proyectos.find((p) => p.id === seleccionadoProyecto.id);
      if (updatedProyecto) {
        establecerSeleccionadoProyecto({ ...updatedProyecto });
      }
    }
  };

  // Filtering projects list
  const filtradoProyectos = proyectos.filter((proj) => {
    if (listaEstadoFiltrar !== "todos" && proj.status !== listaEstadoFiltrar) return false;
    if (listaClaseFiltrar !== "todos" && proj.kind !== listaClaseFiltrar) return false;
    if (buscarProyecto.trim()) {
      const q = buscarProyecto.toLowerCase().trim();
      const coincidenciaNombre = proj.name.toLowerCase().includes(q);
      const coincidenciaCodigo = proj.code.toLowerCase().includes(q);
      const coincidenciaCliente = proj.client.toLowerCase().includes(q);
      if (!coincidenciaNombre && !coincidenciaCodigo && !coincidenciaCliente) return false;
    }
    return true;
  });

  const manejarAbrirNuevoProyecto = () => {
    establecerEditandoProyecto(null);
    establecerFormularioNombre("");
    establecerFormularioNombreError("");
    establecerFormularioCliente(clientes[0]?.businessName || "Inmobiliaria Central SpA");
    establecerFormularioClienteError("");
    establecerFormularioClase("obra");
    establecerFormularioDireccion("Av. Apoquindo 4500, Las Condes");
    establecerFormularioIniciarFecha(new Date().toISOString().slice(0, 10));
    establecerFormularioPlazo(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
    establecerFormularioPresupuestoMateriales("6000000");
    establecerFormularioPresupuestoHoras("250");
    establecerFormularioVentaValor("15000000");
    establecerFormularioEstado("planificado");
    establecerFormularioError("");
    establecerFormularioModalVisible(true);
  };

  const manejarAbrirEditarProyecto = (proj: Proyecto) => {
    if (proj.status === "cerrado") {
      mostrarAviso("No es posible editar un proyecto en estado Cerrado.");
      return;
    }
    establecerEditandoProyecto(proj);
    establecerFormularioNombre(proj.name);
    establecerFormularioNombreError("");
    establecerFormularioCliente(proj.client);
    establecerFormularioClienteError("");
    establecerFormularioClase(proj.kind);
    establecerFormularioDireccion(proj.address);
    establecerFormularioIniciarFecha(proj.startDate);
    establecerFormularioPlazo(proj.deadline);
    establecerFormularioPresupuestoMateriales(String(proj.budgetMaterials));
    establecerFormularioPresupuestoHoras(String(proj.budgetHours));
    establecerFormularioVentaValor(String(proj.saleValue));
    establecerFormularioEstado(proj.status);
    establecerFormularioError("");
    establecerFormularioModalVisible(true);
  };

  const manejarGuardarProyecto = () => {
    establecerFormularioNombreError("");
    establecerFormularioClienteError("");
    establecerFormularioError("");

    if (!formularioNombre.trim()) {
      establecerFormularioNombreError("El nombre del proyecto es obligatorio.");
      establecerFormularioError("El nombre del proyecto es obligatorio.");
      proyectoNombreEntradaReferencia.current?.focus();
      return;
    }

    if (!formularioCliente.trim()) {
      establecerFormularioClienteError("Debe seleccionar un cliente.");
      establecerFormularioError("Debe seleccionar un cliente.");
      return;
    }

    const bMaterial = Number(formularioPresupuestoMateriales) || 0;
    const bHrs = Number(formularioPresupuestoHoras) || 0;
    const sValor = Number(formularioVentaValor) || 0;
    const totalPresupuesto = bMaterial + bHrs * 18750;

    if (editandoProyecto) {
      const resultado = actualizarProyecto(editandoProyecto.id, {
        name: formularioNombre.trim(),
        client: formularioCliente.trim(),
        kind: formularioClase,
        address: formularioDireccion.trim(),
        startDate: formularioIniciarFecha,
        deadline: formularioPlazo,
        budgetMaterials: bMaterial,
        budgetHours: bHrs,
        saleValue: sValor,
        budget: totalPresupuesto,
        status: formularioEstado,
      });
      if (resultado.success) {
        mostrarAviso(`Proyecto ${editandoProyecto.code} actualizado.`);
        establecerFormularioModalVisible(false);
        if (seleccionadoProyecto?.id === editandoProyecto.id) {
          establecerSeleccionadoProyecto({
            ...seleccionadoProyecto,
            name: formularioNombre.trim(),
            client: formularioCliente.trim(),
            kind: formularioClase,
            address: formularioDireccion.trim(),
            startDate: formularioIniciarFecha,
            deadline: formularioPlazo,
            budgetMaterials: bMaterial,
            budgetHours: bHrs,
            saleValue: sValor,
            budget: totalPresupuesto,
            status: formularioEstado,
          });
        }
      } else {
        establecerFormularioError(resultado.error || "Error al actualizar proyecto.");
      }
    } else {
      const codigo = `OB-2026-${String(proyectos.length + 15).padStart(3, "0")}`;
      const nuevoProyecto: Proyecto = {
        id: `p_${Date.now()}`,
        code: codigo,
        name: formularioNombre.trim(),
        client: formularioCliente.trim(),
        kind: formularioClase,
        address: formularioDireccion.trim(),
        progress: 0,
        technicianRuts: [],
        budgetMaterials: bMaterial,
        budgetHours: bHrs,
        hourlyRate: 18750,
        saleValue: sValor,
        budget: totalPresupuesto,
        costReal: 0,
        startDate: formularioIniciarFecha,
        deadline: formularioPlazo,
        status: formularioEstado,
        dispatches: [],
        laborEntries: [],
        wasteEntries: [],
      };
      const resultado = crearProyecto(nuevoProyecto);
      if (resultado.success) {
        mostrarAviso(`Proyecto ${codigo} creado exitosamente.`);
        establecerFormularioModalVisible(false);
      } else {
        establecerFormularioError(resultado.error || "Error al crear proyecto.");
      }
    }
  };

  // Cálculo de bloqueos activos para el cierre de proyecto
  const manejarAbrirCerrarModal = (proj: Proyecto) => {
    establecerCerrarProyectoTarget(proj);
    const bloques: string[] = [];

    // 1. Solicitudes de material pendientes o aprobadas sin despachar
    const pendienteReqs = solicitudesMaterial.filter(
      (r) =>
        r.projectId === proj.id &&
        (r.status === "pendiente" ||
          (r.status === "aprobada" && r.items.some((it) => (it.deliveredQuantity || 0) < it.quantity)))
    );
    if (pendienteReqs.length > 0) {
      bloques.push(
        `${pendienteReqs.length} solicitud(es) de material pendientes o con despacho parcial sin liquidar (${pendienteReqs.map((r) => r.code).join(", ")})`
      );
    }

    // 2. Devoluciones de sobrantes en tránsito de terreno a bodega
    const transitDevoluciones = ordenesDevolucion.filter(
      (r) =>
        (r.projectId === proj.id || r.projectCode === proj.code) &&
        r.status === "en_transito"
    );
    if (transitDevoluciones.length > 0) {
      bloques.push(
        `${transitDevoluciones.length} devolución(es) de insumos en tránsito sin confirmar en bodega (${transitDevoluciones.map((r) => r.code).join(", ")})`
      );
    }

    establecerCerrarBloques(bloques);
    establecerCerrarModalVisible(true);
  };

  const manejarConfirmarCerrar = () => {
    if (!cerrarProyectoTarget) return;
    const resultado = cerrarProyecto(cerrarProyectoTarget.id, usuario.name);
    if (resultado.success) {
      mostrarAviso(`Proyecto ${cerrarProyectoTarget.code} cerrado contablemente por ${usuario.name}.`);
      establecerCerrarModalVisible(false);
      if (seleccionadoProyecto?.id === cerrarProyectoTarget.id) {
        establecerSeleccionadoProyecto({
          ...cerrarProyectoTarget,
          status: "cerrado",
          closedAt: new Date().toISOString(),
          closedBy: usuario.name,
        });
      }
    } else {
      establecerCerrarBloques(resultado.blocks || ["Error al cerrar el proyecto."]);
    }
  };

  return (
    <ContenedorEstadoPantalla screenTitle="Proyectos y Obras" skeletonType="cards">
    <View style={estilos.contenedor}>
      {/* Toast Notification */}
      <NotificacionFlotante
        visible={Boolean(avisoMensaje)}
        message={avisoMensaje || ""}
        onDismiss={() => establecerAvisoMensaje(null)}
      />

      {/* =====================================================================
          1. VISTA DE DETALLE CON PESTAÑAS (SI HAY PROYECTO SELECCIONADO)
          ===================================================================== */}
      {seleccionadoProyecto ? (
      <VistaDetalleProyecto
        asignarTecnicosAProyecto={asignarTecnicosAProyecto}
        detallePestana={detallePestana}
        establecerAdminManualError={establecerAdminManualError}
        establecerAdminManualFecha={establecerAdminManualFecha}
        establecerAdminManualHoras={establecerAdminManualHoras}
        establecerAdminManualModalAbrir={establecerAdminManualModalAbrir}
        establecerDetallePestana={establecerDetallePestana}
        establecerSeleccionadoProyecto={establecerSeleccionadoProyecto}
        manejarAbrirCerrarModal={manejarAbrirCerrarModal}
        manejarAbrirEditarProyecto={manejarAbrirEditarProyecto}
        mostrarAviso={mostrarAviso}
        rolActual={rolActual}
        seleccionadoProyecto={seleccionadoProyecto}
        tecnicos={tecnicos}
      />
      ) : (
        /* =====================================================================
            2. VISTA DE LISTADO GENERAL DE PROYECTOS
            ===================================================================== */
      <VistaListadoProyectos
        buscarProyecto={buscarProyecto}
        establecerBuscarProyecto={establecerBuscarProyecto}
        establecerDetallePestana={establecerDetallePestana}
        establecerListaEstadoFiltrar={establecerListaEstadoFiltrar}
        establecerSeleccionadoProyecto={establecerSeleccionadoProyecto}
        filtradoProyectos={filtradoProyectos}
        listaEstadoFiltrar={listaEstadoFiltrar}
        manejarAbrirNuevoProyecto={manejarAbrirNuevoProyecto}
        rolActual={rolActual}
      />
      )}

      <ModalesProyectos
        adminManualDescripcion={adminManualDescripcion}
        adminManualError={adminManualError}
        adminManualFecha={adminManualFecha}
        adminManualHoras={adminManualHoras}
        adminManualModalAbrir={adminManualModalAbrir}
        adminManualMotivo={adminManualMotivo}
        adminManualTecnicoRut={adminManualTecnicoRut}
        cerrarBloques={cerrarBloques}
        cerrarModalVisible={cerrarModalVisible}
        cerrarProyectoTarget={cerrarProyectoTarget}
        clientes={clientes}
        editandoProyecto={editandoProyecto}
        establecerAdminManualDescripcion={establecerAdminManualDescripcion}
        establecerAdminManualFecha={establecerAdminManualFecha}
        establecerAdminManualHoras={establecerAdminManualHoras}
        establecerAdminManualModalAbrir={establecerAdminManualModalAbrir}
        establecerAdminManualMotivo={establecerAdminManualMotivo}
        establecerAdminManualTecnicoRut={establecerAdminManualTecnicoRut}
        establecerCerrarModalVisible={establecerCerrarModalVisible}
        establecerFormularioClase={establecerFormularioClase}
        establecerFormularioCliente={establecerFormularioCliente}
        establecerFormularioClienteError={establecerFormularioClienteError}
        establecerFormularioDireccion={establecerFormularioDireccion}
        establecerFormularioEstado={establecerFormularioEstado}
        establecerFormularioIniciarFecha={establecerFormularioIniciarFecha}
        establecerFormularioModalVisible={establecerFormularioModalVisible}
        establecerFormularioNombre={establecerFormularioNombre}
        establecerFormularioNombreError={establecerFormularioNombreError}
        establecerFormularioPlazo={establecerFormularioPlazo}
        establecerFormularioPresupuestoHoras={establecerFormularioPresupuestoHoras}
        establecerFormularioPresupuestoMateriales={establecerFormularioPresupuestoMateriales}
        establecerFormularioVentaValor={establecerFormularioVentaValor}
        formularioClase={formularioClase}
        formularioCliente={formularioCliente}
        formularioClienteError={formularioClienteError}
        formularioDireccion={formularioDireccion}
        formularioError={formularioError}
        formularioEstado={formularioEstado}
        formularioIniciarFecha={formularioIniciarFecha}
        formularioModalVisible={formularioModalVisible}
        formularioNombre={formularioNombre}
        formularioNombreError={formularioNombreError}
        formularioPlazo={formularioPlazo}
        formularioPresupuestoHoras={formularioPresupuestoHoras}
        formularioPresupuestoMateriales={formularioPresupuestoMateriales}
        formularioVentaValor={formularioVentaValor}
        manejarConfirmarAdminManualHoras={manejarConfirmarAdminManualHoras}
        manejarConfirmarCerrar={manejarConfirmarCerrar}
        manejarGuardarProyecto={manejarGuardarProyecto}
        proyectoNombreEntradaReferencia={proyectoNombreEntradaReferencia}
        seleccionadoProyecto={seleccionadoProyecto}
        tecnicos={tecnicos}
        usuario={usuario}
      />
    </View>
    </ContenedorEstadoPantalla>
  );
};

