import React, { useEffect, useState } from "react";
import {
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
import { formatearCLP, formatearFecha, esRutValido } from "@/nucleo/formato";
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
  ModalEscanerQr,
  CalificacionEstrellas,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  Cliente,
  FacturaCompra,
  ItemFacturaCompra,
  OrdenCompra,
  ItemOrdenCompra,
  Proveedor,
  CalificacionProveedor,
} from "@/nucleo/tipos";
import { estilos } from "./estilos";
import { SeccionOrdenesCompra, SeccionFacturasProveedor, SeccionRecepcionBodega, SeccionDirectorioTerceros, ModalesCompras } from "./componentes";

export type PestanaCompras = "ordenes" | "facturas" | "recepcion" | "terceros";

export interface PropiedadesPantallaCompras {
  initialTab?: PestanaCompras;
  hideTabBar?: boolean;
  title?: string;
  subtitle?: string;
}

export const PantallaCompras: React.FC<PropiedadesPantallaCompras> = ({
  initialTab = "ordenes",
  hideTabBar = false,
  title: propTitle,
  subtitle: propSubtitle,
}) => {
  const {
    ordenesCompra,
    facturasCompra,
    proveedores,
    clientes,
    productos,
    crearOrdenCompra,
    aprobarYEnviarOrden,
    calificarProveedor,
    crearFactura,
    confirmarRecepcionOrden,
    agregarProveedor,
    agregarCliente,
    alternarProveedorDeshabilitado,
    alternarClienteDeshabilitado,
  } = usarAplicacion();
  const { rolActual } = usarAutenticacion();
  const { width } = useWindowDimensions();
  const esDesktop = width >= 900;

  const [activoPestana, establecerActivoPestana] = useState<PestanaCompras>(initialTab);
  const [avisoMensaje, establecerAvisoMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      establecerActivoPestana(initialTab);
    }
  }, [initialTab]);

  const mostrarAviso = (msg: string) => {
    establecerAvisoMensaje(msg);
    setTimeout(() => establecerAvisoMensaje(null), 3500);
  };

  // =========================================================================
  // 1. ÓRDENES DE COMPRA (OC) STATE
  // =========================================================================
  const [poFiltrarEstado, establecerPoFiltrarEstado] = useState<string>("todas");
  const [poModal, establecerPoModal] = useState(false);
  const [editandoPo, establecerEditandoPo] = useState<OrdenCompra | null>(null);
  const [seleccionadoProveedorId, establecerSeleccionadoProveedorId] = useState(proveedores[0]?.id || "");
  const [poElementos, establecerPoElementos] = useState<{ sku: string; quantity: number; unitPrice: number }[]>([]);
  const [poNotas, establecerPoNotas] = useState("");
  const [poEsperadoFecha, establecerPoEsperadoFecha] = useState("2026-10-25");
  const [poEsAutomaticoMinimo, establecerPoEsAutomaticoMinimo] = useState(false);
  const [poError, establecerPoError] = useState("");

  // Vista Previa PDF de la OC
  const [pdfVistaPreviaOrden, establecerPdfVistaPreviaOrden] = useState<OrdenCompra | null>(null);

  // Modal de Calificación de Proveedor al cerrar OC recibida
  const [tarifaModalOrden, establecerTarifaModalOrden] = useState<OrdenCompra | null>(null);
  const [calificacionTiempo, establecerCalificacionTiempo] = useState(5);
  const [calificacionQuality, establecerCalificacionQuality] = useState(5);
  const [calificacionPrecio, establecerCalificacionPrecio] = useState(5);
  const [calificacionComentario, establecerCalificacionComentario] = useState("");

  const filtradoOrdenes = ordenesCompra.filter((order) => {
    if (poFiltrarEstado === "todas") return true;
    return order.status === poFiltrarEstado;
  });

  const manejarAbrirNuevoOrden = (defaultSupplierId?: string) => {
    establecerEditandoPo(null);
    establecerSeleccionadoProveedorId(defaultSupplierId || proveedores[0]?.id || "");
    const firstProducto = productos[0];
    establecerPoElementos([
      { sku: firstProducto?.sku || "", quantity: 10, unitPrice: firstProducto?.unitCost || 1000 },
    ]);
    establecerPoNotas("Entrega en Bodega Central antes de las 16:00 hrs.");
    establecerPoEsperadoFecha(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    establecerPoEsAutomaticoMinimo(false);
    establecerPoError("");
    establecerPoModal(true);
  };

  const manejarAbrirEditarOrden = (order: OrdenCompra) => {
    establecerEditandoPo(order);
    establecerSeleccionadoProveedorId(order.supplierId);
    establecerPoElementos(
      order.items.map((i) => ({ sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice }))
    );
    establecerPoNotas(order.notes || "");
    establecerPoEsperadoFecha(order.expectedDate);
    establecerPoEsAutomaticoMinimo(Boolean(order.isAutoMinStock));
    establecerPoError("");
    establecerPoModal(true);
  };

  const manejarGuardarCompraOrden = (asDraft = true) => {
    const sup = proveedores.find((s) => s.id === seleccionadoProveedorId);
    if (!sup) {
      establecerPoError("Seleccione un proveedor válido.");
      return;
    }
    if (poElementos.length === 0) {
      establecerPoError("Debe incluir al menos un insumo en la orden.");
      return;
    }

    const elementosHastaEnviar: ItemOrdenCompra[] = poElementos.map((it) => {
      const p = productos.find((prod) => prod.sku === it.sku);
      return {
        sku: it.sku,
        name: p ? p.name : it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: p ? p.unit : "un",
      };
    });

    const resultado = crearOrdenCompra({
      supplierId: sup.id,
      supplier: sup.businessName,
      supplierRut: sup.rut,
      status: asDraft ? "borrador" : "enviada",
      isAutoMinStock: poEsAutomaticoMinimo,
      items: elementosHastaEnviar,
      expectedDate: poEsperadoFecha,
      notes: poNotas,
    });

    if (resultado.success) {
      mostrarAviso(asDraft ? "Orden de compra guardada en borrador." : "Orden aprobada y enviada a proveedor.");
      establecerPoModal(false);
    } else {
      establecerPoError(resultado.error || "Error al crear la orden de compra.");
    }
  };

  const manejarGuardarCalificacion = () => {
    if (!tarifaModalOrden) return;
    const promedio = Number(((calificacionTiempo + calificacionQuality + calificacionPrecio) / 3).toFixed(1));
    const calificacion: CalificacionProveedor = {
      timeRating: calificacionTiempo,
      qualityRating: calificacionQuality,
      priceRating: calificacionPrecio,
      average: promedio,
      comment: calificacionComentario.trim() || undefined,
      ratedAt: new Date().toISOString().slice(0, 10),
    };
    calificarProveedor(tarifaModalOrden.id, calificacion);
    mostrarAviso(`OC ${tarifaModalOrden.code} cerrada con calificación promedio de ${promedio} ⭐`);
    establecerTarifaModalOrden(null);
  };

  // =========================================================================
  // 2. FACTURAS DE COMPRA CON CASCADA E IVA STATE
  // =========================================================================
  const [invProveedorId, establecerInvProveedorId] = useState(proveedores[0]?.id || "");
  const [invNumero, establecerInvNumero] = useState("");
  const [invOrdenCodigo, establecerInvOrdenCodigo] = useState("");
  const [invElementos, establecerInvElementos] = useState<{
    sku: string;
    quantity: number;
    grossPrice: number;
    disc1: number;
    disc2: number;
    disc3: number;
  }[]>([
    { sku: productos[0]?.sku || "", quantity: 10, grossPrice: 5000, disc1: 5, disc2: 0, disc3: 0 },
  ]);
  const [invError, establecerInvError] = useState("");

  // Cálculo en cascada en vivo para cada ítem:
  // Paso 1: P1 = Bruto * (1 - d1/100)
  // Paso 2: P2 = P1 * (1 - d2/100)
  // Paso 3: Neto = P2 * (1 - d3/100)
  const calculatedFacturaElementos: ItemFacturaCompra[] = invElementos.map((i) => {
    const p = productos.find((prod) => prod.sku === i.sku);
    const paso1 = i.grossPrice * (1 - (i.disc1 || 0) / 100);
    const paso2 = paso1 * (1 - (i.disc2 || 0) / 100);
    const netoUnidadPrecio = Math.round(paso2 * (1 - (i.disc3 || 0) / 100));
    const subtotalNeto = netoUnidadPrecio * (i.quantity || 0);
    return {
      sku: i.sku,
      name: p ? p.name : i.sku,
      quantity: i.quantity,
      grossPrice: i.grossPrice,
      discount1Pct: i.disc1,
      discount2Pct: i.disc2,
      discount3Pct: i.disc3,
      netUnitPrice: netoUnidadPrecio,
      subtotalNet: subtotalNeto,
      unit: p ? p.unit : "un",
    };
  });

  const facturaSubtotalNeto = calculatedFacturaElementos.reduce((acc, i) => acc + i.subtotalNet, 0);
  const facturaIva = Math.round(facturaSubtotalNeto * 0.19);
  const facturaTotal = facturaSubtotalNeto + facturaIva;

  // Validación de duplicado de factura por proveedor
  const seleccionadoInvProveedor = proveedores.find((s) => s.id === invProveedorId);
  const esFacturaDuplicate = Boolean(
    invNumero.trim() &&
      seleccionadoInvProveedor &&
      facturasCompra.some(
        (inv) =>
          inv.supplierRut.replace(/[.\s-]/g, "") === seleccionadoInvProveedor.rut.replace(/[.\s-]/g, "") &&
          inv.number.trim().toLowerCase() === invNumero.trim().toLowerCase()
      )
  );

  const manejarGuardarFactura = () => {
    establecerInvError("");
    if (!invNumero.trim()) {
      establecerInvError("Ingrese el número de la factura.");
      return;
    }
    if (!seleccionadoInvProveedor) {
      establecerInvError("Seleccione un proveedor.");
      return;
    }
    if (esFacturaDuplicate) {
      establecerInvError(`La factura N° ${invNumero} ya fue ingresada para el proveedor ${seleccionadoInvProveedor.businessName}.`);
      return;
    }

    const nuevoFactura: FacturaCompra = {
      id: `inv_${Date.now()}`,
      number: invNumero.trim(),
      supplierId: seleccionadoInvProveedor.id,
      supplierName: seleccionadoInvProveedor.businessName,
      supplierRut: seleccionadoInvProveedor.rut,
      orderCode: invOrdenCodigo.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
      items: calculatedFacturaElementos,
      subtotalNet: facturaSubtotalNeto,
      totalDiscounts: 0,
      iva: facturaIva,
      total: facturaTotal,
      status: "registrada",
    };

    const res = crearFactura(nuevoFactura);
    if (!res.success) {
      establecerInvError(res.error || "Error al registrar la factura.");
    } else {
      mostrarAviso(`Factura N° ${invNumero} registrada exitosamente.`);
      establecerInvNumero("");
      establecerInvOrdenCodigo("");
    }
  };

  // =========================================================================
  // 3. RECEPCIÓN CHECKLIST STATE
  // =========================================================================
  const [seleccionadoOcCodigo, establecerSeleccionadoOcCodigo] = useState(
    ordenesCompra.find((o) => o.status === "enviada" || o.status === "recibida_parcial")?.code || ""
  );
  const activoRecepcionOrden = ordenesCompra.find((o) => o.code === seleccionadoOcCodigo);
  const [seleccionadoFacturaNumero, establecerSeleccionadoFacturaNumero] = useState<string>("");
  const [recepcionListaChequeo, establecerRecepcionListaChequeo] = useState<{
    sku: string;
    received: number;
    defective: number;
    missing: number;
    scanned?: boolean;
  }[]>([]);

  // Escáner QR / Barras con la cámara de la tablet
  const [escanerAbrir, establecerEscanerAbrir] = useState(false);
  const [scanningTargetSku, establecerScanningTargetSku] = useState<string | null>(null);

  useEffect(() => {
    if (activoRecepcionOrden) {
      establecerRecepcionListaChequeo(
        activoRecepcionOrden.items.map((it) => {
          const pendiente = Math.max(0, it.quantity - (it.receivedQuantity || 0));
          return {
            sku: it.sku,
            received: pendiente,
            defective: 0,
            missing: 0,
            scanned: false,
          };
        })
      );

      // Vincular automáticamente la factura asociada si ya existe registrada
      const linkedInv = facturasCompra.find((inv) => inv.orderCode === activoRecepcionOrden.code);
      if (linkedInv) {
        establecerSeleccionadoFacturaNumero(linkedInv.number);
      } else {
        establecerSeleccionadoFacturaNumero("");
      }
    }
  }, [seleccionadoOcCodigo]);

  const manejarAbrirEscaner = (targetSku?: string) => {
    establecerScanningTargetSku(targetSku || null);
    establecerEscanerAbrir(true);
  };

  const manejarEscanearCodigo = (scannedCode: string) => {
    establecerEscanerAbrir(false);
    const clean = scannedCode.trim();

    // 1. Validar si el código existe en el catálogo maestro
    const matchedProducto = productos.find((p) => p.sku === clean || p.barcode === clean);
    if (!matchedProducto) {
      mostrarAviso(`El código "${clean}" no existe en el catálogo del sistema.`);
      return;
    }

    if (!activoRecepcionOrden) return;

    // 2. Validar si el insumo pertenece a la OC activa
    const poElemento = activoRecepcionOrden.items.find((it) => it.sku === matchedProducto.sku);
    if (!poElemento) {
      mostrarAviso(
        `El insumo ${matchedProducto.name} (${matchedProducto.sku}) no pertenece a la OC ${activoRecepcionOrden.code}.`
      );
      return;
    }

    // 3. Marcar como verificado y autocompletar la cantidad pendiente como conforme
    const pendiente = Math.max(0, poElemento.quantity - (poElemento.receivedQuantity || 0));
    establecerRecepcionListaChequeo((prev) =>
      prev.map((c) =>
        c.sku === matchedProducto.sku
          ? { ...c, scanned: true, received: pendiente, defective: 0, missing: 0 }
          : c
      )
    );
    mostrarAviso(`✓ Insumo identificado y validado: ${matchedProducto.name} (${matchedProducto.sku})`);
  };

  // Alerta de discrepancia en recepción física vs esperada
  const tieneRecepcionDiscrepancy = recepcionListaChequeo.some((item) => {
    const poItem = activoRecepcionOrden?.items.find((i) => i.sku === item.sku);
    const pending = poItem ? Math.max(0, poItem.quantity - (poItem.receivedQuantity || 0)) : 0;
    const totalContado = item.received + item.defective + item.missing;
    return totalContado !== pending || item.defective > 0 || item.missing > 0;
  });

  const manejarConfirmarRecepcion = () => {
    if (!seleccionadoOcCodigo) return;
    confirmarRecepcionOrden(seleccionadoOcCodigo, recepcionListaChequeo, seleccionadoFacturaNumero || undefined);
    mostrarAviso(`Recepción confirmada para ${seleccionadoOcCodigo}. Stock actualizado y PMP recalculado.`);
    establecerSeleccionadoOcCodigo("");
  };

  // =========================================================================
  // 4. TERCEROS (PROVEEDORES Y CLIENTES) STATE
  // =========================================================================
  const [thirdPartyPestana, establecerThirdPartyPestana] = useState<"proveedores" | "clientes">("proveedores");
  const [thirdPartyBuscar, establecerThirdPartyBuscar] = useState("");
  const [thirdPartyOrdenar, establecerThirdPartyOrdenar] = useState<"rating_desc" | "rating_asc" | "alpha">("rating_desc");

  const [partyModal, establecerPartyModal] = useState(false);
  const [partyRut, establecerPartyRut] = useState("");
  const [partyNombre, establecerPartyNombre] = useState("");
  const [partyTradeNombre, establecerPartyTradeNombre] = useState("");
  const [partyCategoria, establecerPartyCategoria] = useState("");
  const [partyTelefono, establecerPartyTelefono] = useState("+56 9 ");
  const [partyCorreo, establecerPartyCorreo] = useState("");
  const [partyDireccion, establecerPartyDireccion] = useState("");
  const [partyContacto, establecerPartyContacto] = useState("");
  const [bancoNombre, establecerBancoNombre] = useState("Banco de Chile");
  const [cuentaTipo, establecerCuentaTipo] = useState<"corriente" | "vista" | "ahorro">("corriente");
  const [cuentaNumero, establecerCuentaNumero] = useState("");
  const [partyError, establecerPartyError] = useState("");

  const manejarAbrirPartyModal = () => {
    establecerPartyRut("");
    establecerPartyNombre("");
    establecerPartyTradeNombre("");
    establecerPartyCategoria(thirdPartyPestana === "proveedores" ? "Materiales Eléctricos" : "Inmobiliaria");
    establecerPartyTelefono("+56 9 ");
    establecerPartyCorreo("");
    establecerPartyDireccion("Santiago, Chile");
    establecerPartyContacto("");
    establecerBancoNombre("Banco de Chile");
    establecerCuentaTipo("corriente");
    establecerCuentaNumero("");
    establecerPartyError("");
    establecerPartyModal(true);
  };

  const manejarGuardarParty = () => {
    establecerPartyError("");
    if (!esRutValido(partyRut)) {
      establecerPartyError("El RUT ingresado no es válido (verifique formato y dígito verificador módulo 11).");
      return;
    }
    if (!partyNombre.trim()) {
      establecerPartyError("La Razón Social es obligatoria.");
      return;
    }

    // Detección de duplicados de RUT
    const cleanRut = partyRut.replace(/[.\s-]/g, "").toUpperCase();
    if (thirdPartyPestana === "proveedores") {
      const exists = proveedores.some((s) => s.rut.replace(/[.\s-]/g, "").toUpperCase() === cleanRut);
      if (exists) {
        establecerPartyError("Ya existe un proveedor registrado con este RUT.");
        return;
      }

      const res = agregarProveedor({
        id: `sup_${Date.now()}`,
        rut: partyRut.trim(),
        businessName: partyNombre.trim(),
        tradeName: partyTradeNombre.trim() || partyNombre.trim(),
        category: partyCategoria,
        phone: partyTelefono,
        email: partyCorreo,
        address: partyDireccion,
        contactName: partyContacto || "Contacto Principal",
        contactPhone: partyTelefono,
        bankDetails: {
          bank: bancoNombre,
          accountType: cuentaTipo,
          accountNumber: cuentaNumero,
          transferEmail: partyCorreo,
        },
        ratingAvg: 5.0,
        ratingCount: 1,
      });
      if (!res.success) {
        establecerPartyError(res.error || "Error al agregar proveedor.");
      } else {
        mostrarAviso(`Proveedor ${partyNombre} registrado exitosamente.`);
        establecerPartyModal(false);
      }
    } else {
      const exists = clientes.some((c) => c.rut.replace(/[.\s-]/g, "").toUpperCase() === cleanRut);
      if (exists) {
        establecerPartyError("Ya existe un cliente registrado con este RUT.");
        return;
      }

      const res = agregarCliente({
        id: `cli_${Date.now()}`,
        rut: partyRut.trim(),
        businessName: partyNombre.trim(),
        category: partyCategoria,
        phone: partyTelefono,
        email: partyCorreo,
        address: partyDireccion,
        contactName: partyContacto || "Contacto Comercial",
        activeProjectsCount: 1,
      });
      if (!res.success) {
        establecerPartyError(res.error || "Error al agregar cliente.");
      } else {
        mostrarAviso(`Cliente ${partyNombre} registrado exitosamente.`);
        establecerPartyModal(false);
      }
    }
  };

  // Filtrado y ordenación de proveedores
  const filtradoProveedores = proveedores
    .filter((s) => {
      const q = thirdPartyBuscar.toLowerCase().trim();
      if (!q) return true;
      return (
        s.businessName.toLowerCase().includes(q) ||
        s.tradeName.toLowerCase().includes(q) ||
        s.rut.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (thirdPartyOrdenar === "rating_desc") return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (thirdPartyOrdenar === "rating_asc") return (a.ratingAvg || 0) - (b.ratingAvg || 0);
      return a.businessName.localeCompare(b.businessName);
    });

  // Filtrado de clientes
  const filtradoClientes = clientes.filter((c) => {
    const q = thirdPartyBuscar.toLowerCase().trim();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.rut.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const pendienteRecepcionOrdenes = ordenesCompra.filter(
    (o) => o.status === "enviada" || o.status === "recibida_parcial"
  );

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================
  return (
    <ContenedorEstadoPantalla screenTitle="Compras y Terceros" skeletonType="table">
    <View style={estilos.contenedor}>
      {/* Toast Notification */}
      <NotificacionFlotante
        visible={Boolean(avisoMensaje)}
        message={avisoMensaje || ""}
        onDismiss={() => establecerAvisoMensaje(null)}
      />
      {/* ENCABEZADO PRINCIPAL */}
      <EncabezadoPagina
        title={
          propTitle && hideTabBar
            ? propTitle
            : rolActual === "warehouse"
            ? activoPestana === "recepcion"
              ? "Recepción en Bodega"
              : activoPestana === "facturas"
              ? "Facturas de Compra"
              : "Órdenes de Compra"
            : activoPestana === "terceros"
            ? "Directorio de Proveedores"
            : activoPestana === "ordenes"
            ? "Órdenes de Compra"
            : activoPestana === "recepcion"
            ? "Recepción en Bodega"
            : "Facturas de Proveedor"
        }
        subtitle={
          propSubtitle && hideTabBar
            ? propSubtitle
            : rolActual === "warehouse"
            ? activoPestana === "recepcion"
              ? "Control físico y calidad contra OC. Conforme a stock; defectuoso a cuarentena"
              : activoPestana === "facturas"
              ? "Registro de facturas con hasta 3 descuentos sucesivos y recálculo de PMP"
              : "Seguimiento de órdenes de compra emitidas y estado de cumplimiento"
            : activoPestana === "terceros"
            ? "Consulta y alta de proveedores homologados, contactos y cuentas bancarias"
            : activoPestana === "ordenes"
            ? "Emisión, seguimiento y control del ciclo de vida de órdenes de compra"
            : activoPestana === "recepcion"
            ? "Verificación física y control de conformidad de mercadería en bodega o faena"
            : "Ingreso de facturas con hasta 3 descuentos sucesivos y conciliación con OC"
        }
      />

      {/* PESTAÑAS DE NAVEGACIÓN CONTEXTUAL (Ocultas en vistas independientes) */}
      {!hideTabBar && (
        <View style={estilos.pestanaBarraContenedor}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.pestanaScrollContenido}
          >
            {(rolActual === "warehouse"
              ? [
                  {
                    id: "recepcion" as PestanaCompras,
                    label: `Recepción en Bodega (${pendienteRecepcionOrdenes.length} pend.)`,
                    icon: "checkmark-circle-outline",
                  },
                  {
                    id: "facturas" as PestanaCompras,
                    label: `Facturas (${facturasCompra.length})`,
                    icon: "receipt-outline",
                  },
                  {
                    id: "ordenes" as PestanaCompras,
                    label: `Órdenes de Compra (${ordenesCompra.length})`,
                    icon: "cart-outline",
                  },
                ]
              : [
                  {
                    id: "ordenes" as PestanaCompras,
                    label: `Órdenes Emitidas (${ordenesCompra.length})`,
                    icon: "cart-outline",
                  },
                  {
                    id: "recepcion" as PestanaCompras,
                    label: `Recepción en Bodega (${pendienteRecepcionOrdenes.length} pend.)`,
                    icon: "checkmark-circle-outline",
                  },
                ]
            ).map((tab) => {
              const esActivo = activoPestana === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[estilos.pestanaElemento, esActivo && estilos.pestanaElementoActivo]}
                  onPress={() => establecerActivoPestana(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: esActivo }}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={esActivo ? tema.colors.primary : tema.colors.textMuted}
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

      <SeccionOrdenesCompra
        activoPestana={activoPestana}
        aprobarYEnviarOrden={aprobarYEnviarOrden}
        establecerCalificacionComentario={establecerCalificacionComentario}
        establecerCalificacionPrecio={establecerCalificacionPrecio}
        establecerCalificacionQuality={establecerCalificacionQuality}
        establecerCalificacionTiempo={establecerCalificacionTiempo}
        establecerPdfVistaPreviaOrden={establecerPdfVistaPreviaOrden}
        establecerPoFiltrarEstado={establecerPoFiltrarEstado}
        establecerTarifaModalOrden={establecerTarifaModalOrden}
        filtradoOrdenes={filtradoOrdenes}
        manejarAbrirEditarOrden={manejarAbrirEditarOrden}
        manejarAbrirNuevoOrden={manejarAbrirNuevoOrden}
        mostrarAviso={mostrarAviso}
        poFiltrarEstado={poFiltrarEstado}
        rolActual={rolActual}
      />

      <SeccionFacturasProveedor
        activoPestana={activoPestana}
        calculatedFacturaElementos={calculatedFacturaElementos}
        esFacturaDuplicate={esFacturaDuplicate}
        establecerInvElementos={establecerInvElementos}
        establecerInvNumero={establecerInvNumero}
        establecerInvOrdenCodigo={establecerInvOrdenCodigo}
        establecerInvProveedorId={establecerInvProveedorId}
        facturaIva={facturaIva}
        facturaSubtotalNeto={facturaSubtotalNeto}
        facturaTotal={facturaTotal}
        invElementos={invElementos}
        invError={invError}
        invNumero={invNumero}
        invOrdenCodigo={invOrdenCodigo}
        invProveedorId={invProveedorId}
        manejarGuardarFactura={manejarGuardarFactura}
        productos={productos}
        proveedores={proveedores}
      />

      {/* =====================================================================
          3. TAB RECEPCIÓN CHECKLIST Y CONTROL DE CALIDAD
          ===================================================================== */}
      <SeccionRecepcionBodega
        activoPestana={activoPestana}
        activoRecepcionOrden={activoRecepcionOrden}
        establecerRecepcionListaChequeo={establecerRecepcionListaChequeo}
        establecerSeleccionadoFacturaNumero={establecerSeleccionadoFacturaNumero}
        establecerSeleccionadoOcCodigo={establecerSeleccionadoOcCodigo}
        facturasCompra={facturasCompra}
        manejarAbrirEscaner={manejarAbrirEscaner}
        manejarConfirmarRecepcion={manejarConfirmarRecepcion}
        ordenesCompra={ordenesCompra}
        productos={productos}
        recepcionListaChequeo={recepcionListaChequeo}
        seleccionadoFacturaNumero={seleccionadoFacturaNumero}
        seleccionadoOcCodigo={seleccionadoOcCodigo}
        tieneRecepcionDiscrepancy={tieneRecepcionDiscrepancy}
        width={width}
      />

      <SeccionDirectorioTerceros
        activoPestana={activoPestana}
        alternarClienteDeshabilitado={alternarClienteDeshabilitado}
        alternarProveedorDeshabilitado={alternarProveedorDeshabilitado}
        clientes={clientes}
        establecerActivoPestana={establecerActivoPestana}
        establecerThirdPartyBuscar={establecerThirdPartyBuscar}
        establecerThirdPartyOrdenar={establecerThirdPartyOrdenar}
        establecerThirdPartyPestana={establecerThirdPartyPestana}
        filtradoClientes={filtradoClientes}
        filtradoProveedores={filtradoProveedores}
        manejarAbrirNuevoOrden={manejarAbrirNuevoOrden}
        manejarAbrirPartyModal={manejarAbrirPartyModal}
        mostrarAviso={mostrarAviso}
        partyNombre={partyNombre}
        partyRut={partyRut}
        proveedores={proveedores}
        rolActual={rolActual}
        thirdPartyBuscar={thirdPartyBuscar}
        thirdPartyOrdenar={thirdPartyOrdenar}
        thirdPartyPestana={thirdPartyPestana}
      />

      <ModalesCompras
        bancoNombre={bancoNombre}
        calificacionComentario={calificacionComentario}
        calificacionPrecio={calificacionPrecio}
        calificacionQuality={calificacionQuality}
        calificacionTiempo={calificacionTiempo}
        cuentaNumero={cuentaNumero}
        cuentaTipo={cuentaTipo}
        editandoPo={editandoPo}
        escanerAbrir={escanerAbrir}
        establecerBancoNombre={establecerBancoNombre}
        establecerCalificacionComentario={establecerCalificacionComentario}
        establecerCalificacionPrecio={establecerCalificacionPrecio}
        establecerCalificacionQuality={establecerCalificacionQuality}
        establecerCalificacionTiempo={establecerCalificacionTiempo}
        establecerCuentaNumero={establecerCuentaNumero}
        establecerCuentaTipo={establecerCuentaTipo}
        establecerEscanerAbrir={establecerEscanerAbrir}
        establecerPartyCategoria={establecerPartyCategoria}
        establecerPartyContacto={establecerPartyContacto}
        establecerPartyCorreo={establecerPartyCorreo}
        establecerPartyDireccion={establecerPartyDireccion}
        establecerPartyModal={establecerPartyModal}
        establecerPartyNombre={establecerPartyNombre}
        establecerPartyRut={establecerPartyRut}
        establecerPartyTelefono={establecerPartyTelefono}
        establecerPartyTradeNombre={establecerPartyTradeNombre}
        establecerPdfVistaPreviaOrden={establecerPdfVistaPreviaOrden}
        establecerPoElementos={establecerPoElementos}
        establecerPoEsAutomaticoMinimo={establecerPoEsAutomaticoMinimo}
        establecerPoEsperadoFecha={establecerPoEsperadoFecha}
        establecerPoModal={establecerPoModal}
        establecerPoNotas={establecerPoNotas}
        establecerSeleccionadoProveedorId={establecerSeleccionadoProveedorId}
        establecerTarifaModalOrden={establecerTarifaModalOrden}
        manejarEscanearCodigo={manejarEscanearCodigo}
        manejarGuardarCalificacion={manejarGuardarCalificacion}
        manejarGuardarCompraOrden={manejarGuardarCompraOrden}
        manejarGuardarParty={manejarGuardarParty}
        mostrarAviso={mostrarAviso}
        partyCategoria={partyCategoria}
        partyContacto={partyContacto}
        partyCorreo={partyCorreo}
        partyDireccion={partyDireccion}
        partyError={partyError}
        partyModal={partyModal}
        partyNombre={partyNombre}
        partyRut={partyRut}
        partyTelefono={partyTelefono}
        partyTradeNombre={partyTradeNombre}
        pdfVistaPreviaOrden={pdfVistaPreviaOrden}
        poElementos={poElementos}
        poError={poError}
        poEsAutomaticoMinimo={poEsAutomaticoMinimo}
        poEsperadoFecha={poEsperadoFecha}
        poModal={poModal}
        poNotas={poNotas}
        productos={productos}
        proveedores={proveedores}
        scanningTargetSku={scanningTargetSku}
        seleccionadoProveedorId={seleccionadoProveedorId}
        tarifaModalOrden={tarifaModalOrden}
        thirdPartyPestana={thirdPartyPestana}
        width={width}
      />
    </View>
    </ContenedorEstadoPantalla>
  );
};

