import { CATEGORIA_POR_DEFECTO } from "@/nucleo/categoriasArticulo";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
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
  CampoNumero,
  EncabezadoPagina,
  BarraProgreso,
  ModalEscanerQr,
  CeldaStock,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  MovimientoCardex,
  SolicitudMaterial,
  ItemSolicitudMaterial,
  ConteoFisico,
  Producto,
  RegistroMerma,
} from "@/nucleo/tipos";
import { estilos } from "./estilos";
import { SeccionCatalogoCardex, SeccionSolicitudesMaterial, SeccionEgresoBodega, SeccionMermas, SeccionConteoFisico, ModalesInventario } from "./componentes";

export type PestanaInventario =
  | "catalogo"
  | "cardex"
  | "solicitudes"
  | "egreso"
  | "mermas"
  | "conteo";

export interface PropiedadesPantallaInventario {
  initialTab?: PestanaInventario;
  hideTabBar?: boolean;
  title?: string;
  subtitle?: string;
}

export const UNIDADES_PRODUCTO = [
  { id: "un", code: "UN", name: "Unidad", desc: "Piezas, dispositivos, equipos y accesorios individuales" },
  { id: "kg", code: "KG", name: "Kilogramo", desc: "Peso / masa para granel, soldaduras, perfiles pesados" },
  { id: "m", code: "M", name: "Metro", desc: "Longitud lineal para cables, mangueras y tuberías" },
  { id: "l", code: "L", name: "Litro", desc: "Volumen para líquidos, pinturas, solventes y aceites" },
  { id: "caja", code: "CAJA", name: "Caja", desc: "Envases cerrados de pernos, tornillos y fijaciones" },
  { id: "rollo", code: "ROLLO", name: "Rollo", desc: "Carretes y bobinas de cable UTP, THHN o alambre" },
  { id: "tira", code: "TIRA", name: "Tira", desc: "Barras rígidas de 3 m / 6 m (cobre, PVC, conduit)" },
  { id: "cilindro", code: "CIL", name: "Cilindro", desc: "Balones de gas refrigerante R410A o nitrógeno" },
];

export const PantallaInventario: React.FC<PropiedadesPantallaInventario> = ({
  initialTab = "catalogo",
  hideTabBar = false,
  title: propTitle,
  subtitle: propSubtitle,
}) => {
  const {
    productos,
    cardex,
    solicitudesMaterial,
    proyectos,
    tecnicos,
    registrosMerma,
    conteosFisicos,
    agregarProducto,
    actualizarProducto,
    alternarProductoDeshabilitado,
    crearRegistroMerma,
    crearConteoFisico,
    aprobarConteoFisico,
    rechazarConteoFisico,
    crearSolicitudMaterial,
    aprobarSolicitudMaterial,
    rechazarSolicitudMaterial,
    modificarSolicitudMaterial,
    cancelarSolicitudMaterial,
    despacharSolicitudMaterial,
  } = usarAplicacion();

  const { rolActual, usuario } = usarAutenticacion();
  const { width } = useWindowDimensions();
  const esDesktop = width >= 900;

  const [activoPestana, establecerActivoPestana] = useState<PestanaInventario>(initialTab);

  useEffect(() => {
    if (initialTab) {
      establecerActivoPestana(initialTab);
    }
  }, [initialTab]);

  const obtenerEncabezadoTitulo = () => {
    if (propTitle && hideTabBar) return propTitle;
    switch (activoPestana) {
      case "solicitudes":
        return "Aprobación de Solicitudes";
      case "mermas":
        return rolActual === "warehouse" ? "Registro de Mermas" : "Control de Mermas";
      case "conteo":
        return rolActual === "warehouse" ? "Conteo Físico Cíclico" : "Auditoría de Conteos Físicos";
      case "egreso":
        return "Egreso y Despacho";
      case "cardex":
        return "Cardex de Movimientos";
      case "catalogo":
      default:
        return rolActual === "warehouse" ? "Inventario de Bodega" : "Inventario & Cardex";
    }
  };

  const obtenerEncabezadoSubtitulo = () => {
    if (propSubtitle && hideTabBar) return propSubtitle;
    switch (activoPestana) {
      case "solicitudes":
        return "Aprobar, rechazar o ajustar pedidos de materiales en faena";
      case "mermas":
        return rolActual === "warehouse"
          ? "Reportar insumos dañados, caducados o pérdidas para baja"
          : "Autorizar bajas por daño, pérdida o caducidad en Cardex";
      case "conteo":
        return rolActual === "warehouse"
          ? "Escanear insumos, cuadrar stock físico y reportar diferencias"
          : "Validar y aprobar cuadres de stock reportados por bodega";
      case "egreso":
        return "Entrega física de materiales a técnicos con guía de salida";
      case "cardex":
        return "Trazabilidad de entradas, salidas a faena, mermas y ajustes valorizados";
      case "catalogo":
      default:
        return rolActual === "warehouse"
          ? "Consulta de stock disponible, pasillo, estante y PMP"
          : "Control de existencias y kardex físico valorizado";
    }
  };
  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);

  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // --- REUSABLE QR SCANNER ---
  const [escanerVisible, establecerEscanerVisible] = useState(false);
  const [escanerCallback, establecerEscanerCallback] = useState<((code: string) => void) | null>(null);
  const [escanerTitulo, establecerEscanerTitulo] = useState("Escáner Óptico de Bodega");

  const abrirEscaner = (title: string, onScan: (code: string) => void) => {
    establecerEscanerTitulo(title);
    establecerEscanerCallback(() => onScan);
    establecerEscanerVisible(true);
  };

  // =========================================================================
  // 1. CATALOGO STATE
  // =========================================================================
  const skuEntradaReferencia = useRef<TextInput>(null);
  const nombreEntradaReferencia = useRef<TextInput>(null);
  const [buscarQuery, establecerBuscarQuery] = useState("");
  const [nuevoProductoModal, establecerNuevoProductoModal] = useState(false);
  const [editandoProducto, establecerEditandoProducto] = useState<Producto | null>(null);

  const [formularioSku, establecerFormularioSku] = useState("");
  const [formularioSkuError, establecerFormularioSkuError] = useState("");
  const [formularioNombre, establecerFormularioNombre] = useState("");
  const [formularioNombreError, establecerFormularioNombreError] = useState("");
  const [formularioCategoria, establecerFormularioCategoria] = useState<string>(CATEGORIA_POR_DEFECTO);
  const [formularioUnidad, establecerFormularioUnidad] = useState<string>("un");
  const [formularioExistencia, establecerFormularioExistencia] = useState("0");
  const [formularioMinimoExistencia, establecerFormularioMinimoExistencia] = useState("10");
  const [formularioRestock, establecerFormularioRestock] = useState("50");
  const [formularioProveedor, establecerFormularioProveedor] = useState("ElectroChile SpA");
  const [formularioBarcode, establecerFormularioBarcode] = useState("");
  const [formularioEsBulk, establecerFormularioEsBulk] = useState(false);
  const [formularioContenedorCapacity, establecerFormularioContenedorCapacity] = useState("100");
  const [formularioError, establecerFormularioError] = useState("");
  const [mostrarAdvancedProductoOpciones, establecerMostrarAdvancedProductoOpciones] = useState(false);

  const filtradoProductos = productos.filter((p) => {
    const q = buscarQuery.toLowerCase().trim();
    if (!q) return true;
    return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const manejarAbrirNuevoProducto = () => {
    establecerEditandoProducto(null);
    establecerFormularioSku("");
    establecerFormularioSkuError("");
    establecerFormularioNombre("");
    establecerFormularioNombreError("");
    establecerFormularioCategoria(CATEGORIA_POR_DEFECTO);
    establecerFormularioUnidad("un");
    establecerFormularioExistencia("0");
    establecerFormularioMinimoExistencia("10");
    establecerFormularioRestock("50");
    establecerFormularioProveedor("ElectroChile SpA");
    establecerFormularioBarcode("");
    establecerFormularioEsBulk(false);
    establecerFormularioContenedorCapacity("100");
    establecerFormularioError("");
    establecerMostrarAdvancedProductoOpciones(false);
    establecerNuevoProductoModal(true);
  };

  const manejarAbrirEditarProducto = (prod: Producto) => {
    establecerEditandoProducto(prod);
    establecerFormularioSku(prod.sku);
    establecerFormularioSkuError("");
    establecerFormularioNombre(prod.name);
    establecerFormularioNombreError("");
    establecerFormularioCategoria(prod.category);
    establecerFormularioUnidad((prod.unit as any) || "un");
    establecerFormularioExistencia(String(prod.stock));
    establecerFormularioMinimoExistencia(String(prod.minStock));
    establecerFormularioRestock(String(prod.restockQuantity || 50));
    establecerFormularioProveedor(prod.defaultSupplier || "");
    establecerFormularioBarcode(prod.barcode || "");
    establecerFormularioEsBulk(Boolean(prod.isBulk));
    establecerFormularioContenedorCapacity(String(prod.containerCapacity || 100));
    establecerFormularioError("");
    establecerMostrarAdvancedProductoOpciones(Boolean(prod.isBulk || prod.barcode || prod.defaultSupplier));
    establecerNuevoProductoModal(true);
  };

  const manejarGuardarProducto = async () => {
    establecerFormularioSkuError("");
    establecerFormularioNombreError("");
    establecerFormularioError("");

    if (!formularioSku.trim()) {
      establecerFormularioSkuError("El código SKU es obligatorio.");
      establecerFormularioError("El código SKU es obligatorio.");
      skuEntradaReferencia.current?.focus();
      return;
    }
    if (!formularioNombre.trim()) {
      establecerFormularioNombreError("El nombre del insumo es obligatorio.");
      establecerFormularioError("El nombre del insumo es obligatorio.");
      nombreEntradaReferencia.current?.focus();
      return;
    }

    if (editandoProducto) {
      const resultadoEdicion = await actualizarProducto(editandoProducto.sku, {
        name: formularioNombre.trim(),
        category: formularioCategoria,
        unit: formularioUnidad,
        minStock: Number(formularioMinimoExistencia) || 0,
        restockQuantity: Number(formularioRestock) || 0,
        defaultSupplier: formularioProveedor.trim(),
        barcode: formularioBarcode.trim() || undefined,
        isBulk: formularioEsBulk,
        containerCapacity: formularioEsBulk ? Number(formularioContenedorCapacity) || 100 : undefined,
      });
      if (!resultadoEdicion.success) {
        establecerFormularioError(resultadoEdicion.error || "No se pudo actualizar el insumo.");
        return;
      }
      mostrarAviso(`Insumo ${editandoProducto.sku} actualizado exitosamente.`);
      establecerNuevoProductoModal(false);
    } else {
      const resultado = await agregarProducto({
        sku: formularioSku.trim().toUpperCase(),
        name: formularioNombre.trim(),
        category: formularioCategoria,
        unit: formularioUnidad,
        stock: formularioEsBulk ? Number(Number(formularioExistencia).toFixed(3)) : Number(formularioExistencia) || 0,
        minStock: Number(formularioMinimoExistencia) || 0,
        unitCost: 1000,
        pmp: 1000,
        location: "Bodega Principal - Estante B",
        restockQuantity: Number(formularioRestock) || 0,
        defaultSupplier: formularioProveedor.trim() || "Proveedor General",
        barcode: formularioBarcode.trim() || undefined,
        committed: 0,
        quarantine: 0,
        isBulk: formularioEsBulk,
        containerCapacity: formularioEsBulk ? Number(formularioContenedorCapacity) || 100 : undefined,
      });
      if (!resultado.success) {
        establecerFormularioError(resultado.error || "Error al guardar insumo.");
      } else {
        mostrarAviso(`Insumo ${formularioSku.toUpperCase()} creado exitosamente.`);
        establecerNuevoProductoModal(false);
      }
    }
  };

  // =========================================================================
  // 2. CARDEX STATE
  // =========================================================================
  const [kardexFiltrarSku, establecerKardexFiltrarSku] = useState("");
  const [kardexFiltrarTipo, establecerKardexFiltrarTipo] = useState<string>("todos");
  const [kardexFiltrarProyecto, establecerKardexFiltrarProyecto] = useState<string>("todos");
  const [kardexFechaRango, establecerKardexFechaRango] = useState<"todos" | "7d" | "30d">("todos");

  const filtradoCardex = cardex.filter((entry) => {
    if (kardexFiltrarSku) {
      const q = kardexFiltrarSku.toLowerCase();
      const coincidenciaSku = entry.sku.toLowerCase().includes(q);
      const coincidenciaNombre = entry.productName.toLowerCase().includes(q);
      if (!coincidenciaSku && !coincidenciaNombre) return false;
    }
    if (kardexFiltrarTipo !== "todos" && entry.type !== kardexFiltrarTipo) {
      return false;
    }
    if (kardexFiltrarProyecto !== "todos" && entry.projectCode !== kardexFiltrarProyecto) {
      return false;
    }
    return true;
  });

  const manejarExportarCardex = (format: "pdf" | "excel") => {
    mostrarAviso(`Cardex exportado exitosamente a formato ${format.toUpperCase()}.`);
  };

  // =========================================================================
  // 3. SOLICITUDES STATE
  // =========================================================================
  const [solicitudPestana, establecerSolicitudPestana] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">("todas");
  const [nuevoSolicitudModal, establecerNuevoSolicitudModal] = useState(false);
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState(proyectos[0]?.id || "");
  const [solicitudElementos, establecerSolicitudElementos] = useState<{ sku: string; quantity: number }[]>([]);
  const [solicitudUrgencia, establecerSolicitudUrgencia] = useState<"normal" | "alta" | "urgente">("normal");
  const [solicitudComentario, establecerSolicitudComentario] = useState("");
  const [solicitudError, establecerSolicitudError] = useState("");
  const [faltanteExistenciaErrores, establecerFaltanteExistenciaErrores] = useState<string[]>([]);

  // Timeline modal
  const [seleccionadoTimelineSolicitud, establecerSeleccionadoTimelineSolicitud] = useState<SolicitudMaterial | null>(null);

  // Rejection modal
  const [rechazarModalSolicitud, establecerRechazarModalSolicitud] = useState<SolicitudMaterial | null>(null);
  const [rechazarMotivo, establecerRechazarMotivo] = useState("");

  const activoProyectos = proyectos.filter((p) => p.status !== "cerrado");

  // Validar faltantes de stock en tiempo real
  const calcularFaltanteExistencia = (items: { sku: string; quantity: number }[]) => {
    const faltante: string[] = [];
    items.forEach((it) => {
      const p = productos.find((prod) => prod.sku === it.sku);
      const avail = p ? p.stock : 0;
      if (avail < it.quantity) {
        faltante.push(
          `${p ? p.name : it.sku}: Faltan ${Number((it.quantity - avail).toFixed(3))} ${p?.unit || "un"} (Disp: ${avail}, Solicitado: ${it.quantity})`
        );
      }
    });
    return faltante;
  };

  const manejarAbrirNuevoSolicitud = () => {
    establecerSeleccionadoProyectoId(activoProyectos[0]?.id || "");
    const inicialElementos = [{ sku: productos[0]?.sku || "", quantity: 1 }];
    establecerSolicitudElementos(inicialElementos);
    establecerSolicitudUrgencia("normal");
    establecerSolicitudComentario("");
    establecerSolicitudError("");
    establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(inicialElementos));
    establecerNuevoSolicitudModal(true);
  };

  const manejarSolicitudElementoCambiar = (idx: number, sku: string, quantity: number) => {
    const updated = solicitudElementos.map((it, i) => (i === idx ? { sku, quantity } : it));
    establecerSolicitudElementos(updated);
    establecerFaltanteExistenciaErrores(calcularFaltanteExistencia(updated));
  };

  const manejarEnviarSolicitud = () => {
    if (solicitudElementos.length === 0) {
      establecerSolicitudError("Debe agregar al menos un insumo.");
      return;
    }

    const actualFaltante = calcularFaltanteExistencia(solicitudElementos);
    if (actualFaltante.length > 0) {
      establecerFaltanteExistenciaErrores(actualFaltante);
      establecerSolicitudError("No se puede enviar: hay ítems con stock insuficiente en bodega.");
      return;
    }

    const elementosHastaEnviar: ItemSolicitudMaterial[] = solicitudElementos.map((it) => {
      const p = productos.find((prod) => prod.sku === it.sku);
      return {
        sku: it.sku,
        name: p ? p.name : it.sku,
        quantity: it.quantity,
        unit: p ? p.unit : "un",
      };
    });

    const res = crearSolicitudMaterial(
      seleccionadoProyectoId,
      usuario.rut,
      elementosHastaEnviar,
      solicitudUrgencia,
      solicitudComentario
    );

    if (!res.success) {
      establecerSolicitudError(res.error || "No se pudo crear la solicitud.");
      establecerFaltanteExistenciaErrores(res.missingItems || []);
    } else {
      mostrarAviso("Solicitud de materiales enviada con éxito.");
      establecerNuevoSolicitudModal(false);
    }
  };

  const filtradoSolicitudes = solicitudesMaterial.filter((r) => {
    if (solicitudPestana === "todas") return true;
    return r.status === solicitudPestana;
  });

  // =========================================================================
  // 4. EGRESO (DESPACHO) STATE
  // =========================================================================
  const [seleccionadoDespachoSolicitudId, establecerSeleccionadoDespachoSolicitudId] = useState<string>("");
  const [despachoTecnicoRut, establecerDespachoTecnicoRut] = useState<string>(tecnicos[0]?.rut || "");
  const [despachoQuantities, establecerDespachoQuantities] = useState<{ [sku: string]: number }>({});
  const [confirmarDespachoVisible, establecerConfirmarDespachoVisible] = useState(false);
  const [despachoError, establecerDespachoError] = useState("");

  const aprobadoSolicitudes = solicitudesMaterial.filter(
    (r) =>
      r.status === "aprobada" &&
      r.items.some((it) => (it.deliveredQuantity || 0) < it.quantity)
  );

  const activoDespachoSolicitud = solicitudesMaterial.find((r) => r.id === seleccionadoDespachoSolicitudId);

  const seleccionadoDespachoTecnico = tecnicos.find((t) => t.rut === despachoTecnicoRut);
  const despachoElementosEntries = Object.entries(despachoQuantities).filter(([_, qty]) => qty > 0);
  const totalUnidadesHastaDespacho = despachoElementosEntries.reduce((sum, [_, qty]) => sum + qty, 0);
  const pendienteUnidadesInSolicitud = activoDespachoSolicitud
    ? activoDespachoSolicitud.items.reduce(
        (sum, it) => sum + Math.max(0, it.quantity - (it.deliveredQuantity || 0)),
        0
      )
    : 0;
  const esCompletoDespacho = totalUnidadesHastaDespacho >= pendienteUnidadesInSolicitud && totalUnidadesHastaDespacho > 0;

  const manejarSeleccionarDespachoSolicitud = (reqId: string) => {
    establecerSeleccionadoDespachoSolicitudId(reqId);
    const solicitud = solicitudesMaterial.find((r) => r.id === reqId);
    if (solicitud) {
      // Por defecto sugerir la cantidad pendiente
      const inicialQtys: { [sku: string]: number } = {};
      solicitud.items.forEach((it) => {
        const pendiente = Math.max(0, it.quantity - (it.deliveredQuantity || 0));
        const producto = productos.find((p) => p.sku === it.sku);
        const maximoAvail = producto ? producto.stock : 0;
        // Sugerir lo pendiente, pero sin sobrepasar el stock físico
        inicialQtys[it.sku] = Math.min(pendiente, maximoAvail);
      });
      establecerDespachoQuantities(inicialQtys);
      if (solicitud.technicianRut) establecerDespachoTecnicoRut(solicitud.technicianRut);
      establecerDespachoError("");
    }
  };

  const manejarDespachoCantidadCambiar = (sku: string, val: string) => {
    const numero = parseFloat(val) || 0;
    establecerDespachoQuantities((prev) => ({ ...prev, [sku]: numero }));
  };

  const manejarInitiateDespacho = () => {
    if (!activoDespachoSolicitud) return;
    establecerDespachoError("");

    // Validar que al menos un item tenga cantidad > 0
    const tieneElementos = Object.values(despachoQuantities).some((qty) => qty > 0);
    if (!tieneElementos) {
      establecerDespachoError("Debe indicar una cantidad mayor a 0 para al menos un insumo.");
      return;
    }

    // Validar stock disponible y que no supere lo pendiente
    for (const it of activoDespachoSolicitud.items) {
      const cantidadHastaDespacho = despachoQuantities[it.sku] || 0;
      if (cantidadHastaDespacho <= 0) continue;

      const prod = productos.find((p) => p.sku === it.sku);
      if (!prod || prod.stock < cantidadHastaDespacho) {
        establecerDespachoError(
          `Stock insuficiente para ${prod?.name || it.sku}. Disponible: ${prod?.stock || 0}, a despachar: ${cantidadHastaDespacho}`
        );
        return;
      }

      const pendiente = Math.max(0, it.quantity - (it.deliveredQuantity || 0));
      if (cantidadHastaDespacho > pendiente) {
        establecerDespachoError(
          `La cantidad a despachar de ${prod?.name || it.sku} (${cantidadHastaDespacho}) excede la pendiente (${pendiente}).`
        );
        return;
      }
    }

    establecerConfirmarDespachoVisible(true);
  };

  const manejarExecuteDespacho = () => {
    if (!activoDespachoSolicitud) return;

    const tecnico = tecnicos.find((t) => t.rut === despachoTecnicoRut);
    const elementosHastaDespacho = Object.entries(despachoQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sku, quantity]) => ({ sku, quantity }));

    const res = despacharSolicitudMaterial(
      activoDespachoSolicitud.id,
      elementosHastaDespacho,
      despachoTecnicoRut,
      tecnico ? tecnico.name : "Técnico",
      usuario.name
    );

    establecerConfirmarDespachoVisible(false);

    if (res.success) {
      mostrarAviso("Egreso registrado con éxito en bodega y Cardex.");
      establecerSeleccionadoDespachoSolicitudId("");
      establecerDespachoQuantities({});
    } else {
      establecerDespachoError(res.error || "No se pudo registrar el egreso.");
    }
  };

  // =========================================================================
  // 5. MERMAS STATE
  // =========================================================================
  const [mermaModalVisible, establecerMermaModalVisible] = useState(false);
  const [mermaSku, establecerMermaSku] = useState(productos[0]?.sku || "");
  const [mermaCantidad, establecerMermaCantidad] = useState("1");
  const [mermaMotivo, establecerMermaMotivo] = useState<"daño" | "caducidad" | "pérdida" | "otro">("daño");
  const [mermaObs, establecerMermaObs] = useState("");
  const [mermaError, establecerMermaError] = useState("");

  const seleccionadoMermaProducto = productos.find((p) => p.sku === mermaSku);
  const mermaCantidadNumero = parseFloat(mermaCantidad) || 0;
  const mermaTotalPerdida = mermaCantidadNumero * (seleccionadoMermaProducto?.pmp || seleccionadoMermaProducto?.unitCost || 0);

  const manejarAbrirMermaModal = () => {
    const validoProducto = productos.find((p) => !p.disabled && p.stock > 0) || productos[0];
    if (validoProducto) establecerMermaSku(validoProducto.sku);
    establecerMermaCantidad("1");
    establecerMermaMotivo("daño");
    establecerMermaObs("");
    establecerMermaError("");
    establecerMermaModalVisible(true);
  };

  const manejarRegisterMerma = () => {
    if (!mermaObs.trim() || mermaObs.trim().length < 5) {
      establecerMermaError("La observación detallada es obligatoria (mínimo 5 caracteres).");
      return;
    }
    if (mermaCantidadNumero <= 0) {
      establecerMermaError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (seleccionadoMermaProducto && mermaCantidadNumero > seleccionadoMermaProducto.stock) {
      establecerMermaError(`La cantidad no puede superar el stock disponible (${seleccionadoMermaProducto.stock}).`);
      return;
    }

    const res = crearRegistroMerma({
      sku: mermaSku,
      productName: seleccionadoMermaProducto ? seleccionadoMermaProducto.name : mermaSku,
      quantity: seleccionadoMermaProducto?.isBulk ? Number(mermaCantidadNumero.toFixed(3)) : mermaCantidadNumero,
      unit: seleccionadoMermaProducto ? seleccionadoMermaProducto.unit : "un",
      pmp: seleccionadoMermaProducto?.pmp || seleccionadoMermaProducto?.unitCost || 0,
      totalLoss: mermaTotalPerdida,
      reason: mermaMotivo,
      observation: mermaObs.trim(),
      user: usuario.name,
    });

    if (res.success) {
      mostrarAviso("Merma registrada y descontada de inventario.");
      establecerMermaModalVisible(false);
    } else {
      establecerMermaError(res.error || "No se pudo registrar la merma.");
    }
  };

  // =========================================================================
  // 6. CONTEO FISICO STATE
  // =========================================================================
  const [conteoModalVisible, establecerConteoModalVisible] = useState(false);
  const [conteoSku, establecerConteoSku] = useState(productos[0]?.sku || "");
  const [conteoPhysicalCantidad, establecerConteoPhysicalCantidad] = useState("0");
  const [conteoNotas, establecerConteoNotas] = useState("");
  const [conteoError, establecerConteoError] = useState("");

  const seleccionadoConteoProducto = productos.find((p) => p.sku === conteoSku);
  const conteoCantidadNumero = parseFloat(conteoPhysicalCantidad) || 0;
  const conteoSistemaExistencia = seleccionadoConteoProducto ? seleccionadoConteoProducto.stock : 0;
  const conteoDiferencia = conteoCantidadNumero - conteoSistemaExistencia;
  const conteoDiferenciaPorcentaje = conteoSistemaExistencia > 0 ? (conteoDiferencia / conteoSistemaExistencia) * 100 : conteoCantidadNumero > 0 ? 100 : 0;
  const conteoDiferenciaValor = conteoDiferencia * (seleccionadoConteoProducto?.pmp || seleccionadoConteoProducto?.unitCost || 0);
  const conteoRequiresApproval = Math.abs(conteoDiferenciaPorcentaje) > 5;

  const manejarAbrirConteoModal = () => {
    const prod = productos[0];
    if (prod) {
      establecerConteoSku(prod.sku);
      establecerConteoPhysicalCantidad(String(prod.stock));
    }
    establecerConteoNotas("");
    establecerConteoError("");
    establecerConteoModalVisible(true);
  };

  const manejarRegisterConteo = () => {
    if (!conteoSku) {
      establecerConteoError("Seleccione un insumo.");
      return;
    }

    const res = crearConteoFisico(
      conteoSku,
      seleccionadoConteoProducto?.isBulk ? Number(conteoCantidadNumero.toFixed(3)) : conteoCantidadNumero,
      conteoNotas.trim() || undefined,
      usuario.name
    );

    if (res.success) {
      if (res.requiresApproval) {
        mostrarAviso("Conteo registrado: Discrepancia > 5% enviada a aprobación de Admin. Insumo bloqueado.");
      } else {
        mostrarAviso("Conteo registrado y ajustado directamente en bodega (≤ 5%).");
      }
      establecerConteoModalVisible(false);
    } else {
      establecerConteoError(res.error || "No se pudo registrar el conteo.");
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <ContenedorEstadoPantalla screenTitle="Inventario y Bodega" skeletonType="table">
    <View style={estilos.contenedor}>
      {/* Toast Notification */}
      <NotificacionFlotante
        visible={Boolean(avisoMensaje)}
        message={avisoMensaje || ""}
        onDismiss={() => establecerAvisoMensaje(null)}
      />

      {/* ENCABEZADO Y ACCIÓN PRINCIPAL */}
      <EncabezadoPagina
        title={obtenerEncabezadoTitulo()}
        subtitle={obtenerEncabezadoSubtitulo()}
      />

      {/* TOP NAVIGATION TABS (Oculta en bodeguero egreso porque se accede por el menú principal) */}
      {!hideTabBar && !(rolActual === "warehouse" && activoPestana === "egreso") && (
        <View style={estilos.pestanaBarraContenedor}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.pestanaScrollContenido}>
            {(rolActual === "warehouse"
              ? [
                  { id: "egreso", label: `Egreso (${aprobadoSolicitudes.length})`, icon: "log-out-outline" },
                  { id: "catalogo", label: `Inventario (${productos.length})`, icon: "cube-outline" },
                  {
                    id: "conteo",
                    label: `Conteo Físico (${conteosFisicos.filter((c) => c.status === "pendiente_aprobacion").length})`,
                    icon: "checkbox-outline",
                  },
                  { id: "mermas", label: `Mermas (${registrosMerma.length})`, icon: "trash-outline" },
                ]
              : [
                  { id: "catalogo", label: `Inventario (${productos.length})`, icon: "cube-outline" },
                  { id: "cardex", label: "Cardex", icon: "swap-horizontal-outline" },
                ]
            ).map((tab) => {
              const esActivo = activoPestana === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => establecerActivoPestana(tab.id as PestanaInventario)}
                  style={[estilos.pestanaElemento, esActivo && estilos.pestanaElementoActivo]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: esActivo }}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={esActivo ? "#f59e0b" : "#a8a29e"}
                  />
                  <Text style={[estilos.pestanaEtiqueta, esActivo && estilos.pestanaEtiquetaActivo]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <SeccionCatalogoCardex
        abrirEscaner={abrirEscaner}
        activoPestana={activoPestana}
        alternarProductoDeshabilitado={alternarProductoDeshabilitado}
        buscarQuery={buscarQuery}
        establecerBuscarQuery={establecerBuscarQuery}
        establecerKardexFiltrarProyecto={establecerKardexFiltrarProyecto}
        establecerKardexFiltrarSku={establecerKardexFiltrarSku}
        establecerKardexFiltrarTipo={establecerKardexFiltrarTipo}
        filtradoCardex={filtradoCardex}
        filtradoProductos={filtradoProductos}
        kardexFiltrarProyecto={kardexFiltrarProyecto}
        kardexFiltrarSku={kardexFiltrarSku}
        kardexFiltrarTipo={kardexFiltrarTipo}
        manejarAbrirEditarProducto={manejarAbrirEditarProducto}
        manejarAbrirNuevoProducto={manejarAbrirNuevoProducto}
        manejarExportarCardex={manejarExportarCardex}
        mostrarAviso={mostrarAviso}
        proyectos={proyectos}
        rolActual={rolActual}
      />

      <SeccionSolicitudesMaterial
        activoPestana={activoPestana}
        aprobarSolicitudMaterial={aprobarSolicitudMaterial}
        cancelarSolicitudMaterial={cancelarSolicitudMaterial}
        establecerRechazarModalSolicitud={establecerRechazarModalSolicitud}
        establecerRechazarMotivo={establecerRechazarMotivo}
        establecerSeleccionadoTimelineSolicitud={establecerSeleccionadoTimelineSolicitud}
        establecerSolicitudPestana={establecerSolicitudPestana}
        filtradoSolicitudes={filtradoSolicitudes}
        manejarAbrirNuevoSolicitud={manejarAbrirNuevoSolicitud}
        modificarSolicitudMaterial={modificarSolicitudMaterial}
        mostrarAviso={mostrarAviso}
        rolActual={rolActual}
        solicitudPestana={solicitudPestana}
        usuario={usuario}
      />

      <SeccionEgresoBodega
        abrirEscaner={abrirEscaner}
        activoDespachoSolicitud={activoDespachoSolicitud}
        activoPestana={activoPestana}
        aprobadoSolicitudes={aprobadoSolicitudes}
        despachoElementosEntries={despachoElementosEntries}
        despachoError={despachoError}
        despachoQuantities={despachoQuantities}
        despachoTecnicoRut={despachoTecnicoRut}
        esCompletoDespacho={esCompletoDespacho}
        esDesktop={esDesktop}
        establecerDespachoTecnicoRut={establecerDespachoTecnicoRut}
        manejarDespachoCantidadCambiar={manejarDespachoCantidadCambiar}
        manejarInitiateDespacho={manejarInitiateDespacho}
        manejarSeleccionarDespachoSolicitud={manejarSeleccionarDespachoSolicitud}
        mostrarAviso={mostrarAviso}
        productos={productos}
        seleccionadoDespachoSolicitudId={seleccionadoDespachoSolicitudId}
        seleccionadoDespachoTecnico={seleccionadoDespachoTecnico}
        tecnicos={tecnicos}
        totalUnidadesHastaDespacho={totalUnidadesHastaDespacho}
      />

      <SeccionMermas
        activoPestana={activoPestana}
        manejarAbrirMermaModal={manejarAbrirMermaModal}
        mermaSku={mermaSku}
        registrosMerma={registrosMerma}
        width={width}
      />

      <SeccionConteoFisico
        activoPestana={activoPestana}
        aprobarConteoFisico={aprobarConteoFisico}
        conteosFisicos={conteosFisicos}
        manejarAbrirConteoModal={manejarAbrirConteoModal}
        mermaSku={mermaSku}
        mostrarAviso={mostrarAviso}
        productos={productos}
        rechazarConteoFisico={rechazarConteoFisico}
        rolActual={rolActual}
        usuario={usuario}
        width={width}
      />

      <ModalesInventario
        abrirEscaner={abrirEscaner}
        activoDespachoSolicitud={activoDespachoSolicitud}
        activoProyectos={activoProyectos}
        calcularFaltanteExistencia={calcularFaltanteExistencia}
        confirmarDespachoVisible={confirmarDespachoVisible}
        conteoDiferencia={conteoDiferencia}
        conteoDiferenciaPorcentaje={conteoDiferenciaPorcentaje}
        conteoDiferenciaValor={conteoDiferenciaValor}
        conteoError={conteoError}
        conteoModalVisible={conteoModalVisible}
        conteoNotas={conteoNotas}
        conteoPhysicalCantidad={conteoPhysicalCantidad}
        conteoRequiresApproval={conteoRequiresApproval}
        conteoSku={conteoSku}
        editandoProducto={editandoProducto}
        escanerCallback={escanerCallback}
        escanerTitulo={escanerTitulo}
        escanerVisible={escanerVisible}
        establecerConfirmarDespachoVisible={establecerConfirmarDespachoVisible}
        establecerConteoModalVisible={establecerConteoModalVisible}
        establecerConteoNotas={establecerConteoNotas}
        establecerConteoPhysicalCantidad={establecerConteoPhysicalCantidad}
        establecerConteoSku={establecerConteoSku}
        establecerEscanerVisible={establecerEscanerVisible}
        establecerFaltanteExistenciaErrores={establecerFaltanteExistenciaErrores}
        establecerFormularioBarcode={establecerFormularioBarcode}
        establecerFormularioCategoria={establecerFormularioCategoria}
        establecerFormularioContenedorCapacity={establecerFormularioContenedorCapacity}
        establecerFormularioEsBulk={establecerFormularioEsBulk}
        establecerFormularioExistencia={establecerFormularioExistencia}
        establecerFormularioMinimoExistencia={establecerFormularioMinimoExistencia}
        establecerFormularioNombre={establecerFormularioNombre}
        establecerFormularioNombreError={establecerFormularioNombreError}
        establecerFormularioProveedor={establecerFormularioProveedor}
        establecerFormularioRestock={establecerFormularioRestock}
        establecerFormularioSku={establecerFormularioSku}
        establecerFormularioSkuError={establecerFormularioSkuError}
        establecerFormularioUnidad={establecerFormularioUnidad}
        establecerMermaCantidad={establecerMermaCantidad}
        establecerMermaModalVisible={establecerMermaModalVisible}
        establecerMermaMotivo={establecerMermaMotivo}
        establecerMermaObs={establecerMermaObs}
        establecerMermaSku={establecerMermaSku}
        establecerMostrarAdvancedProductoOpciones={establecerMostrarAdvancedProductoOpciones}
        establecerNuevoProductoModal={establecerNuevoProductoModal}
        establecerNuevoSolicitudModal={establecerNuevoSolicitudModal}
        establecerRechazarModalSolicitud={establecerRechazarModalSolicitud}
        establecerRechazarMotivo={establecerRechazarMotivo}
        establecerSeleccionadoProyectoId={establecerSeleccionadoProyectoId}
        establecerSeleccionadoTimelineSolicitud={establecerSeleccionadoTimelineSolicitud}
        establecerSolicitudComentario={establecerSolicitudComentario}
        establecerSolicitudElementos={establecerSolicitudElementos}
        faltanteExistenciaErrores={faltanteExistenciaErrores}
        formularioBarcode={formularioBarcode}
        formularioCategoria={formularioCategoria}
        formularioContenedorCapacity={formularioContenedorCapacity}
        formularioError={formularioError}
        formularioEsBulk={formularioEsBulk}
        formularioExistencia={formularioExistencia}
        formularioMinimoExistencia={formularioMinimoExistencia}
        formularioNombre={formularioNombre}
        formularioNombreError={formularioNombreError}
        formularioProveedor={formularioProveedor}
        formularioRestock={formularioRestock}
        formularioSku={formularioSku}
        formularioSkuError={formularioSkuError}
        formularioUnidad={formularioUnidad}
        manejarEnviarSolicitud={manejarEnviarSolicitud}
        manejarExecuteDespacho={manejarExecuteDespacho}
        manejarGuardarProducto={manejarGuardarProducto}
        manejarRegisterConteo={manejarRegisterConteo}
        manejarRegisterMerma={manejarRegisterMerma}
        manejarSolicitudElementoCambiar={manejarSolicitudElementoCambiar}
        mermaCantidad={mermaCantidad}
        mermaCantidadNumero={mermaCantidadNumero}
        mermaError={mermaError}
        mermaModalVisible={mermaModalVisible}
        mermaMotivo={mermaMotivo}
        mermaObs={mermaObs}
        mermaSku={mermaSku}
        mermaTotalPerdida={mermaTotalPerdida}
        mostrarAdvancedProductoOpciones={mostrarAdvancedProductoOpciones}
        mostrarAviso={mostrarAviso}
        nombreEntradaReferencia={nombreEntradaReferencia}
        nuevoProductoModal={nuevoProductoModal}
        nuevoSolicitudModal={nuevoSolicitudModal}
        productos={productos}
        rechazarModalSolicitud={rechazarModalSolicitud}
        rechazarMotivo={rechazarMotivo}
        rechazarSolicitudMaterial={rechazarSolicitudMaterial}
        seleccionadoConteoProducto={seleccionadoConteoProducto}
        seleccionadoMermaProducto={seleccionadoMermaProducto}
        seleccionadoProyectoId={seleccionadoProyectoId}
        seleccionadoTimelineSolicitud={seleccionadoTimelineSolicitud}
        skuEntradaReferencia={skuEntradaReferencia}
        solicitudComentario={solicitudComentario}
        solicitudElementos={solicitudElementos}
        solicitudError={solicitudError}
        totalUnidadesHastaDespacho={totalUnidadesHastaDespacho}
        usuario={usuario}
      />
    </View>
    </ContenedorEstadoPantalla>
  );
};

