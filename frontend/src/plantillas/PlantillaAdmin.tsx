import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { ROLES, ORDEN_ROLES } from "@/nucleo/roles";
import { tema } from "@/nucleo/tema";
import { Rol } from "@/nucleo/tipos";

// Componentes
import { Insignia } from "@/componentes/base/Insignia";
import { CampanaNotificaciones } from "@/componentes/dominio/CampanaNotificaciones";
import { CampoBusqueda } from "@/componentes/formularios/CampoBusqueda";
import { ModalExpiracionSesion } from "@/componentes/dominio/ModalExpiracionSesion";


import { usarAplicacion } from "@/contexto/ContextoAplicacion";

// Pantallas administradas
import { PanelAdmin } from "@/modulos/panel/PanelAdmin";
import { PantallaInventario } from "@/modulos/inventario/PantallaInventario";
import { PantallaCompras } from "@/modulos/compras/PantallaCompras";
import { PantallaProyectos } from "@/modulos/proyectos/PantallaProyectos";
import { PantallaHerramientas } from "@/modulos/herramientas/PantallaHerramientas";
import { PantallaDevoluciones } from "@/modulos/devoluciones/PantallaDevoluciones";
import { PantallaAdministracion } from "@/modulos/administracion/PantallaAdministracion";
import { PantallaHorasManualesAdmin } from "@/modulos/administracion/PantallaHorasManualesAdmin";
import { PantallaInformes } from "@/modulos/informes/PantallaInformes";

export type RutaAdmin =
  | "dashboard"
  | "inventario"
  | "solicitudes"
  | "mermas"
  | "conteo"
  | "devoluciones"
  | "proveedores"
  | "compras"
  | "facturas"
  | "proyectos"
  | "horas_tecnicos"
  | "herramientas"
  | "informes"
  | "administracion";

export interface ElementoNavAdmin {
  id: RutaAdmin;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeTone?: "primary" | "ok" | "warn" | "danger" | "info" | "mute";
}

export interface GrupoNavAdmin {
  title: string;
  items: ElementoNavAdmin[];
}

export interface PropiedadesPlantillaAdmin {
  onLogout?: () => void;
}

export const PlantillaAdmin: React.FC<PropiedadesPlantillaAdmin> = ({ onLogout }) => {
  const { usuario, rolActual, establecerRol } = usarAutenticacion();
  const {
    productos,
    proyectos,
    ordenesCompra,
    facturasCompra,
    proveedores,
    solicitudesMaterial,
    herramientas,
    conteosFisicos,
  } = usarAplicacion();
  const { width } = useWindowDimensions();

  // Menú Drawer lateral desplegable desde las 3 líneas
  const [menuLateralAbrir, establecerMenuLateralAbrir] = useState(false);
  const [activoRoute, establecerActivoRoute] = useState<RutaAdmin>("dashboard");

  // Contadores dinámicos para badges de gestión
  const pendienteSolicitudesConteo = solicitudesMaterial.filter((r) => r.status === "pendiente").length;
  const pendienteConteosConteo = conteosFisicos.filter((c) => c.status === "pendiente_aprobacion").length;

  const adminGrupos: GrupoNavAdmin[] = [
    {
      title: "RESUMEN Y MONITOREO",
      items: [
        {
          id: "dashboard",
          label: "Dashboard General",
          description: "Métricas ejecutivas, alertas de faena, compras y KPIs",
          icon: "grid-outline",
        },
      ],
    },
    {
      title: "INVENTARIO Y BODEGA",
      items: [
        {
          id: "inventario",
          label: "Inventario & Cardex",
          description: "Control de existencias, PMP valorizado y trazabilidad",
          icon: "cube-outline",
        },
        {
          id: "solicitudes",
          label: "Aprobación de Solicitudes",
          description: "Aprobar, rechazar o ajustar pedidos de materiales en faena",
          icon: "clipboard-outline",
          badge: pendienteSolicitudesConteo > 0 ? String(pendienteSolicitudesConteo) : undefined,
          badgeTone: "warn",
        },
        {
          id: "mermas",
          label: "Control de Mermas",
          description: "Autorizar bajas por daño, pérdida o caducidad en Cardex",
          icon: "trash-outline",
        },
        {
          id: "conteo",
          label: "Auditoría de Conteos Físicos",
          description: "Validar y aprobar cuadres de stock reportados por bodega",
          icon: "checkbox-outline",
          badge: pendienteConteosConteo > 0 ? String(pendienteConteosConteo) : undefined,
          badgeTone: "info",
        },
        {
          id: "devoluciones",
          label: "Devoluciones de Stock",
          description: "Supervisar retornos de obra, conciliación física y garantías con proveedores",
          icon: "return-down-back-outline",
        },
      ],
    },
    {
      title: "COMPRAS Y PROVEEDORES",
      items: [
        {
          id: "proveedores",
          label: "Directorio de Proveedores",
          description: "Consulta y alta de proveedores, contactos y datos bancarios",
          icon: "people-outline",
        },
        {
          id: "compras",
          label: "Órdenes de Compra",
          description: "Emisión, aprobación a proveedores y control de recepción",
          icon: "cart-outline",
        },
        {
          id: "facturas",
          label: "Facturas de Proveedor",
          description: "Validación contable con hasta 3 descuentos sucesivos",
          icon: "receipt-outline",
        },
      ],
    },
    {
      title: "PROYECTOS Y MANO DE OBRA",
      items: [
        {
          id: "proyectos",
          label: "Proyectos y Obras",
          description: "Presupuestos, costos reales H27/H28 y liquidación final",
          icon: "business-outline",
        },
        {
          id: "horas_tecnicos",
          label: "Carga Horas Técnicos",
          description: "Imputar HH en bloques de 0,5 h con motivo justificado",
          icon: "time-outline",
        },
      ],
    },
    {
      title: "ACTIVOS Y GOBERNANZA",
      items: [
        {
          id: "herramientas",
          label: "Control de Herramientas",
          description: "Préstamos a técnicos, estados y mantenciones preventivas",
          icon: "construct-outline",
        },
        {
          id: "informes",
          label: "Informes",
          description: "Reporte de movimientos, inventario, proyectos, compras y mermas",
          icon: "stats-chart-outline",
        },
        {
          id: "administracion",
          label: "Sistema y Auditoría",
          description: "Usuarios, roles, parámetros del sistema y logs de auditoría",
          icon: "settings-outline",
        },
      ],
    },
  ];

  // Modales
  const [usuarioMenuAbrir, establecerUsuarioMenuAbrir] = useState(false);
  const [globalBuscar, establecerGlobalBuscar] = useState("");
  const [globalBuscarAbrir, establecerGlobalBuscarAbrir] = useState(false);

  // Modal de Aviso por Expiración de Sesión (30 min de inactividad, solo web)
  const [sesionTiempoEsperaAbrir, establecerSesionTiempoEsperaAbrir] = useState(false);

  // Temporizador de inactividad (30 min = 1.800.000 ms) en web
  useEffect(() => {
    const INACTIVIDAD_MS = 30 * 60 * 1000;
    let temporizador: ReturnType<typeof setTimeout>;

    const restablecerTemporizador = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        establecerSesionTiempoEsperaAbrir(true);
      }, INACTIVIDAD_MS);
    };

    restablecerTemporizador();

    // Solo para navegador web: escuchar actividad del usuario
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
      events.forEach((evt) => {
        window.addEventListener(evt, restablecerTemporizador, { passive: true });
      });

      return () => {
        clearTimeout(temporizador);
        events.forEach((evt) => {
          window.removeEventListener(evt, restablecerTemporizador);
        });
      };
    }

    return () => clearTimeout(temporizador);
  }, []);

  // Atajo de teclado global: Ctrl+K / Cmd+K para abrir buscador global en web
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const manejarGlobalClaveDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          establecerGlobalBuscarAbrir((prev) => !prev);
        }
      };
      window.addEventListener("keydown", manejarGlobalClaveDown);
      return () => window.removeEventListener("keydown", manejarGlobalClaveDown);
    }
  }, []);

  // Resultados filtrados para el Buscador Global (Lupa / Ctrl+K)
  const terminoBusqueda = globalBuscar.trim().toLowerCase();
  const resultadosBusquedaGlobal = React.useMemo(() => {
    if (!terminoBusqueda) return [];
    const lista: Array<{
      id: string;
      categoria: string;
      titulo: string;
      subtitulo: string;
      icono: keyof typeof Ionicons.glyphMap;
      ruta: RutaAdmin;
      tonoInsignia: "primary" | "ok" | "warn" | "danger" | "info" | "mute";
    }> = [];

    // 1. Módulos del sistema
    adminGrupos.forEach((grupo) => {
      grupo.items.forEach((item) => {
        if (
          item.label.toLowerCase().includes(terminoBusqueda) ||
          item.description.toLowerCase().includes(terminoBusqueda)
        ) {
          lista.push({
            id: `mod-${item.id}`,
            categoria: "Módulo",
            titulo: item.label,
            subtitulo: item.description,
            icono: item.icon,
            ruta: item.id,
            tonoInsignia: "primary",
          });
        }
      });
    });

    // 2. Insumos / Productos
    productos
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(terminoBusqueda) ||
          p.name.toLowerCase().includes(terminoBusqueda) ||
          p.category.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 5)
      .forEach((p) => {
        lista.push({
          id: `prod-${p.sku}`,
          categoria: "Insumo",
          titulo: `${p.sku} • ${p.name}`,
          subtitulo: `Stock: ${p.stock} ${p.unit} • Ubicación: ${p.location}`,
          icono: "cube-outline",
          ruta: "inventario",
          tonoInsignia: p.stock <= p.minStock ? "danger" : "ok",
        });
      });

    // 3. Proyectos
    proyectos
      .filter(
        (pr) =>
          pr.code.toLowerCase().includes(terminoBusqueda) ||
          pr.name.toLowerCase().includes(terminoBusqueda) ||
          pr.client.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 4)
      .forEach((pr) => {
        lista.push({
          id: `proy-${pr.id}`,
          categoria: "Proyecto",
          titulo: `${pr.code} • ${pr.name}`,
          subtitulo: `Cliente: ${pr.client} • Avance: ${pr.progress}%`,
          icono: "business-outline",
          ruta: "proyectos",
          tonoInsignia: "info",
        });
      });

    // 4. Órdenes de Compra
    ordenesCompra
      .filter(
        (oc) =>
          oc.code.toLowerCase().includes(terminoBusqueda) ||
          oc.supplier.toLowerCase().includes(terminoBusqueda) ||
          (oc.supplierRut && oc.supplierRut.toLowerCase().includes(terminoBusqueda))
      )
      .slice(0, 4)
      .forEach((oc) => {
        lista.push({
          id: `oc-${oc.id}`,
          categoria: "Orden Compra",
          titulo: `${oc.code} • ${oc.supplier}`,
          subtitulo: `Estado: ${oc.status.toUpperCase()} • Fecha: ${oc.date}`,
          icono: "cart-outline",
          ruta: "compras",
          tonoInsignia: "warn",
        });
      });

    // 5. Proveedores
    proveedores
      .filter(
        (pv) =>
          pv.rut.toLowerCase().includes(terminoBusqueda) ||
          pv.businessName.toLowerCase().includes(terminoBusqueda) ||
          pv.tradeName.toLowerCase().includes(terminoBusqueda) ||
          pv.category.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 4)
      .forEach((pv) => {
        lista.push({
          id: `prov-${pv.id}`,
          categoria: "Proveedor",
          titulo: `${pv.businessName} (${pv.rut})`,
          subtitulo: `Rubro: ${pv.category} • Contacto: ${pv.contactName}`,
          icono: "people-outline",
          ruta: "proveedores",
          tonoInsignia: "primary",
        });
      });

    // 6. Facturas de Proveedor
    facturasCompra
      .filter(
        (fa) =>
          fa.number.toLowerCase().includes(terminoBusqueda) ||
          fa.supplierName.toLowerCase().includes(terminoBusqueda) ||
          fa.supplierRut.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 3)
      .forEach((fa) => {
        lista.push({
          id: `fac-${fa.id}`,
          categoria: "Factura",
          titulo: `Factura N° ${fa.number} • ${fa.supplierName}`,
          subtitulo: `RUT: ${fa.supplierRut} • Fecha: ${fa.date}`,
          icono: "receipt-outline",
          ruta: "facturas",
          tonoInsignia: "info",
        });
      });

    // 7. Solicitudes de Material
    solicitudesMaterial
      .filter(
        (sol) =>
          sol.code.toLowerCase().includes(terminoBusqueda) ||
          sol.projectName.toLowerCase().includes(terminoBusqueda) ||
          sol.technicianName.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 4)
      .forEach((sol) => {
        lista.push({
          id: `sol-${sol.id}`,
          categoria: "Solicitud",
          titulo: `${sol.code} • ${sol.projectName}`,
          subtitulo: `Solicitante: ${sol.technicianName} • Estado: ${sol.status}`,
          icono: "clipboard-outline",
          ruta: "solicitudes",
          tonoInsignia: sol.status === "pendiente" ? "warn" : "ok",
        });
      });

    // 8. Herramientas
    herramientas
      .filter(
        (h) =>
          h.code.toLowerCase().includes(terminoBusqueda) ||
          h.name.toLowerCase().includes(terminoBusqueda) ||
          h.serialNumber.toLowerCase().includes(terminoBusqueda)
      )
      .slice(0, 4)
      .forEach((h) => {
        lista.push({
          id: `her-${h.id}`,
          categoria: "Herramienta",
          titulo: `${h.code} • ${h.name}`,
          subtitulo: `Serie: ${h.serialNumber} • Estado: ${h.status}`,
          icono: "construct-outline",
          ruta: "herramientas",
          tonoInsignia: "mute",
        });
      });

    return lista;
  }, [
    terminoBusqueda,
    productos,
    proyectos,
    ordenesCompra,
    proveedores,
    facturasCompra,
    solicitudesMaterial,
    herramientas,
  ]);

  // Renderizar la pantalla correspondiente
  const renderizarContenido = () => {
    switch (activoRoute) {
      case "dashboard":
        return <PanelAdmin onNavigate={(tab) => establecerActivoRoute(tab as RutaAdmin)} />;
      case "inventario":
        return (
          <PantallaInventario
            key="inventario"
            initialTab="catalogo"
            title="Inventario & Cardex"
            subtitle="Control de existencias, PMP valorizado y trazabilidad"
          />
        );
      case "solicitudes":
        return (
          <PantallaInventario
            key="solicitudes"
            initialTab="solicitudes"
            hideTabBar={true}
            title="Aprobación de Solicitudes"
            subtitle="Aprobar, rechazar o ajustar pedidos de materiales en faena"
          />
        );
      case "mermas":
        return (
          <PantallaInventario
            key="mermas"
            initialTab="mermas"
            hideTabBar={true}
            title="Control de Mermas"
            subtitle="Autorizar bajas por daño, pérdida o caducidad en Cardex"
          />
        );
      case "conteo":
        return (
          <PantallaInventario
            key="conteo"
            initialTab="conteo"
            hideTabBar={true}
            title="Auditoría de Conteos Físicos"
            subtitle="Validar y aprobar cuadres de stock reportados por bodega"
          />
        );
      case "proveedores":
        return (
          <PantallaCompras
            key="proveedores"
            initialTab="terceros"
            hideTabBar={true}
            title="Directorio de Proveedores"
            subtitle="Consulta y alta de proveedores homologados, contactos y cuentas bancarias"
          />
        );
      case "compras":
        return (
          <PantallaCompras
            key="compras"
            initialTab="ordenes"
            title="Órdenes de Compra"
            subtitle="Emisión, seguimiento y control de recepción de órdenes de compra"
          />
        );
      case "facturas":
        return (
          <PantallaCompras
            key="facturas"
            initialTab="facturas"
            hideTabBar={true}
            title="Facturas de Proveedor"
            subtitle="Validación contable con hasta 3 descuentos sucesivos y conciliación con OC"
          />
        );
      case "proyectos":
        return <PantallaProyectos />;
      case "horas_tecnicos":
        return <PantallaHorasManualesAdmin />;
      case "herramientas":
        return <PantallaHerramientas />;
      case "informes":
        return <PantallaInformes />;
      case "devoluciones":
        return <PantallaDevoluciones />;
      case "administracion":
        return <PantallaAdministracion />;
      default:
        return <PanelAdmin onNavigate={(tab) => establecerActivoRoute(tab as RutaAdmin)} />;
    }
  };

  return (
    <View style={estilos.contenedor}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR RESPONSIVA                                                      */}
      {/* ========================================================================= */}
      <View style={[estilos.barraSuperior, width < 600 && estilos.barraSuperiorCompacto]}>
        {/* Lado Izquierdo: Botón Menú + Logo */}
        <View style={estilos.superiorIzquierda}>
          <TouchableOpacity
            onPress={() => establecerMenuLateralAbrir(true)}
            style={estilos.alternarBoton}
            accessibilityLabel="Abrir menú de navegación"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Ionicons
              name="menu-outline"
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          <View style={estilos.marcaFila}>
            <View style={estilos.marcaLogoCaja}>
              <Ionicons name="flash" size={16} color={tema.colors.textInverse} />
            </View>
            <Text style={estilos.marcaNombre}>FYAG</Text>
            {width >= 480 && (
              <Insignia label="ADMIN" tone="primary" size="sm" style={estilos.rolInsignia} />
            )}
          </View>
        </View>

        {/* Centro: Buscador Global (visible en pantallas medianas y grandes, o botón en pantallas chicas) */}
        {width >= 700 ? (
          <View style={estilos.superiorCentro}>
            <CampoBusqueda
              value={globalBuscar}
              onChangeText={(t) => {
                establecerGlobalBuscar(t);
                if (t.trim().length > 1) establecerGlobalBuscarAbrir(true);
              }}
              placeholder="Buscar SKU, RUT, OC, Proyecto... (Ctrl+K)"
              containerStyle={estilos.globalBuscarCaja}
            />
          </View>
        ) : (
          <View style={estilos.superiorCentroCompacto}>
            <TouchableOpacity
              onPress={() => establecerGlobalBuscarAbrir(true)}
              style={estilos.compactoBuscarBoton}
              accessibilityLabel="Buscar global"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Lado Derecho: Notificaciones */}
        <View style={estilos.superiorDerecha}>
          <CampanaNotificaciones
            variant="dark"
            onNavigateToObject={(entityType) => {
              if (entityType === "insumo") {
                establecerActivoRoute("inventario");
              } else if (entityType === "solicitud") {
                establecerActivoRoute("solicitudes");
              } else if (entityType === "proyecto") {
                establecerActivoRoute("proyectos");
              } else if (entityType === "orden_compra") {
                establecerActivoRoute("compras");
              } else if (entityType === "herramienta") {
                establecerActivoRoute("herramientas");
              } else {
                establecerActivoRoute("administracion");
              }
            }}
          />
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. LAYOUT: CONTENIDO A PANTALLA COMPLETA (SIN MENÚ LATERAL FIJO)          */}
      {/* ========================================================================= */}
      <View style={estilos.cuerpoEnvoltorio}>
        <View style={estilos.principalContenido}>
          <View style={estilos.contenidoContenedor}>
            {renderizarContenido()}
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2.1 MENÚ DRAWER (ABRE CON EL BOTÓN DE 3 LÍNEAS)                           */}
      {/* ========================================================================= */}
      <Modal
        visible={menuLateralAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerMenuLateralAbrir(false)}
      >
        <View style={estilos.menuLateralOverlay}>
          <Pressable style={estilos.menuLateralBackdrop} onPress={() => establecerMenuLateralAbrir(false)} />

          <View style={estilos.menuLateralContenido} onStartShouldSetResponder={() => true}>
            {/* Header del Drawer */}
            <View style={estilos.menuLateralEncabezado}>
              <View style={estilos.marcaFila}>
                <View style={estilos.marcaLogoCaja}>
                  <Ionicons name="flash" size={16} color={tema.colors.textInverse} />
                </View>
                <Text style={estilos.marcaNombre}>FYAG</Text>
                <Insignia label="ADMIN" tone="primary" size="sm" style={estilos.rolInsignia} />
              </View>

              <TouchableOpacity
                onPress={() => establecerMenuLateralAbrir(false)}
                style={estilos.menuLateralCerrarBoton}
                accessibilityLabel="Cerrar menú"
                accessibilityRole="button"
              >
                <Ionicons name="close-outline" size={24} color={tema.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Lista de navegación con Título y Descripción de cada categoría */}
            <ScrollView
              style={estilos.menuLateralScroll}
              contentContainerStyle={estilos.menuLateralScrollContenido}
              showsVerticalScrollIndicator={false}
            >
              {adminGrupos.map((group) => (
                <View key={group.title} style={estilos.navegacionGrupo}>
                  <Text style={estilos.grupoTitulo}>{group.title}</Text>
                  {group.items.map((item) => {
                    const esActivo = activoRoute === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          establecerActivoRoute(item.id);
                          establecerMenuLateralAbrir(false);
                        }}
                        activeOpacity={0.7}
                        style={[
                          estilos.navegacionElemento,
                          esActivo && estilos.navegacionElementoActivo,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.label}: ${item.description}`}
                      >
                        <View style={[estilos.navegacionIconoCaja, esActivo && estilos.navegacionIconoCajaActivo]}>
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={esActivo ? tema.colors.primaryDark : tema.colors.textSecondary}
                          />
                        </View>
                        <View style={estilos.navegacionTextoColumna}>
                          <View style={estilos.navegacionEtiquetaFila}>
                            <Text
                              style={[
                                estilos.navegacionEtiqueta,
                                esActivo && estilos.navegacionEtiquetaActivo,
                              ]}
                              numberOfLines={1}
                            >
                              {item.label}
                            </Text>
                            {Boolean(item.badge) && (
                              <Insignia
                                label={item.badge!}
                                tone={item.badgeTone || "warn"}
                                size="sm"
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              estilos.navegacionDescripcion,
                              esActivo && estilos.navegacionDescripcionActivo,
                            ]}
                            numberOfLines={2}
                          >
                            {item.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* SECCIÓN FIJA ABAJO A LA IZQUIERDA: LOGIN / PERFIL DE USUARIO */}
            <View style={estilos.menuLateralUsuarioPie}>
              <TouchableOpacity
                onPress={() => {
                  establecerUsuarioMenuAbrir(true);
                }}
                style={estilos.menuLateralUsuarioTrigger}
                activeOpacity={0.8}
                accessibilityLabel="Menú de usuario y sesión"
              >
                <View style={estilos.avatar}>
                  <Text style={estilos.avatarTexto}>{usuario.initials}</Text>
                </View>
                <View style={estilos.usuarioInfo}>
                  <Text style={estilos.usuarioNombre} numberOfLines={1}>{usuario.name}</Text>
                  <Text style={estilos.usuarioRolTexto}>Administrador</Text>
                </View>
                <Ionicons name="ellipsis-vertical" size={18} color={tema.colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. MODALES DE APOYO: USUARIO Y CATÁLOGO DE DISEÑO                         */}
      {/* ========================================================================= */}
      {/* Modal Menú de Usuario */}
      <Modal
        visible={usuarioMenuAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerUsuarioMenuAbrir(false)}
      >
        <Pressable style={estilos.modalBackdrop} onPress={() => establecerUsuarioMenuAbrir(false)}>
          <View style={estilos.usuarioMenuTarjeta} onStartShouldSetResponder={() => true}>
            <View style={estilos.usuarioMenuEncabezado}>
              <View style={estilos.avatarGrande}>
                <Text style={estilos.avatarGrandeTexto}>{usuario.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={estilos.usuarioMenuNombre}>{usuario.name}</Text>
                <Text style={estilos.usuarioMenuRut}>{usuario.rut}</Text>
                <Insignia label="Administrador General" tone="primary" size="sm" style={{ marginTop: 4 }} />
              </View>
            </View>

            <View style={estilos.usuarioMenuDivisor} />

            <Text style={estilos.usuarioMenuSeccionTitulo}>Cambiar a otro rol:</Text>
            {ORDEN_ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  estilos.rolSwitchBoton,
                  r === rolActual && estilos.rolSwitchBotonActual,
                ]}
                onPress={() => {
                  establecerRol(r);
                  establecerUsuarioMenuAbrir(false);
                }}
              >
                <Ionicons
                  name={r === "admin" ? "briefcase" : r === "warehouse" ? "cube" : "hammer"}
                  size={18}
                  color={r === rolActual ? tema.colors.primary : tema.colors.textMuted}
                />
                <Text
                  style={[
                    estilos.rolSwitchTexto,
                    r === rolActual && estilos.rolSwitchTextoActual,
                  ]}
                >
                  {ROLES[r].label}
                </Text>
                {r === rolActual && (
                  <Ionicons name="checkmark" size={16} color={tema.colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            <View style={estilos.usuarioMenuDivisor} />

            {/* Test Rápido Aviso Expiración 30 min (Requerimiento Paso 4) */}
            <TouchableOpacity
              onPress={() => {
                establecerUsuarioMenuAbrir(false);
                establecerSesionTiempoEsperaAbrir(true);
              }}
              style={estilos.testSesionBoton}
            >
              <Ionicons name="time-outline" size={18} color={tema.colors.warnDark} />
              <Text style={estilos.testSesionTexto}>Aviso 30 min Inactividad (Test)</Text>
            </TouchableOpacity>

            {/* Cerrar Sesión */}
            <TouchableOpacity
              onPress={() => {
                establecerUsuarioMenuAbrir(false);
                if (onLogout) onLogout();
              }}
              style={estilos.cerrarSesionBoton}
            >
              <Ionicons name="log-out-outline" size={18} color={tema.colors.danger} />
              <Text style={estilos.cerrarSesionTexto}>Cerrar Sesión / Salir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>



      {/* Modal Buscador Rápido Global (Lupa / Ctrl+K) */}
      <Modal
        visible={globalBuscarAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerGlobalBuscarAbrir(false)}
      >
        <Pressable
          style={estilos.buscadorModalOverlay}
          onPress={() => establecerGlobalBuscarAbrir(false)}
        >
          <View
            style={estilos.buscadorModalTarjeta}
            onStartShouldSetResponder={() => true}
          >
            <View style={estilos.buscadorModalEncabezado}>
              <View style={estilos.buscadorModalTituloFila}>
                <Ionicons name="search" size={18} color={tema.colors.primary} />
                <Text style={estilos.buscadorModalTitulo}>Buscador Global</Text>
              </View>
              <TouchableOpacity
                onPress={() => establecerGlobalBuscarAbrir(false)}
                style={estilos.buscadorCerrarBoton}
                accessibilityLabel="Cerrar buscador global"
              >
                <Ionicons name="close" size={20} color={tema.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={estilos.buscadorInputContenedor}>
              <CampoBusqueda
                value={globalBuscar}
                onChangeText={establecerGlobalBuscar}
                placeholder="Buscar por SKU, insumo, proyecto, OC, RUT proveedor o módulo..."
                containerStyle={{ marginBottom: 0 }}
              />
            </View>

            <ScrollView
              style={estilos.buscadorResultadosScroll}
              contentContainerStyle={estilos.buscadorResultadosContenido}
              keyboardShouldPersistTaps="handled"
            >
              {!terminoBusqueda ? (
                <View>
                  <Text style={estilos.buscadorSeccionSubtitulo}>
                    ACCESOS RÁPIDOS A MÓDULOS
                  </Text>
                  {adminGrupos.flatMap((g) => g.items).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={estilos.buscadorResultadoItem}
                      onPress={() => {
                        establecerActivoRoute(item.id);
                        establecerGlobalBuscarAbrir(false);
                      }}
                    >
                      <View style={estilos.buscadorResultadoIcono}>
                        <Ionicons name={item.icon} size={18} color={tema.colors.primaryDark} />
                      </View>
                      <View style={estilos.buscadorResultadoTextos}>
                        <Text style={estilos.buscadorResultadoTitulo} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={estilos.buscadorResultadoSubtitulo} numberOfLines={1}>
                          {item.description}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={tema.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : resultadosBusquedaGlobal.length === 0 ? (
                <View style={estilos.buscadorVacioCaja}>
                  <Ionicons name="search-outline" size={32} color={tema.colors.textMuted} />
                  <Text style={estilos.buscadorVacioTitulo}>
                    Sin coincidencias para "{globalBuscar}"
                  </Text>
                  <Text style={estilos.buscadorVacioSubtitulo}>
                    Intenta con otro código SKU, RUT, número de OC, nombre de obra o herramienta.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={estilos.buscadorSeccionSubtitulo}>
                    RESULTADOS ENCONTRADOS ({resultadosBusquedaGlobal.length})
                  </Text>
                  {resultadosBusquedaGlobal.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={estilos.buscadorResultadoItem}
                      onPress={() => {
                        establecerActivoRoute(item.ruta);
                        establecerGlobalBuscarAbrir(false);
                        establecerGlobalBuscar("");
                      }}
                    >
                      <View style={estilos.buscadorResultadoIcono}>
                        <Ionicons name={item.icono} size={18} color={tema.colors.primaryDark} />
                      </View>
                      <View style={estilos.buscadorResultadoTextos}>
                        <View style={estilos.buscadorResultadoEncabezadoFila}>
                          <Text style={estilos.buscadorResultadoTitulo} numberOfLines={1}>
                            {item.titulo}
                          </Text>
                          <Insignia label={item.categoria} tone={item.tonoInsignia} size="sm" />
                        </View>
                        <Text style={estilos.buscadorResultadoSubtitulo} numberOfLines={1}>
                          {item.subtitulo}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={tema.colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Aviso por Expiración de Sesión (30 min de inactividad, solo web) */}
      <ModalExpiracionSesion
        visible={sesionTiempoEsperaAbrir}
        timeoutSeconds={60}
        onStayLoggedIn={() => establecerSesionTiempoEsperaAbrir(false)}
        onLogout={() => {
          establecerSesionTiempoEsperaAbrir(false);
          if (onLogout) onLogout();
        }}
      />
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  barraSuperior: {
    height: 64,
    backgroundColor: "#1c1917", // Dark Titanium Bar
    borderBottomWidth: 1.5,
    borderBottomColor: "#292524",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.lg,
    zIndex: 10,
    ...tema.shadows.md,
  },
  barraSuperiorCompacto: {
    paddingHorizontal: tema.spacing.md,
  },
  superiorIzquierda: {
    flexDirection: "row",
    alignItems: "center",
  },
  alternarBoton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  marcaFila: {
    flexDirection: "row",
    alignItems: "center",
  },
  marcaLogoCaja: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  marcaNombre: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    letterSpacing: 0.5,
    color: "#ffffff",
  },
  rolInsignia: {
    marginLeft: 8,
  },
  superiorCentro: {
    flex: 1,
    maxWidth: 420,
    marginHorizontal: 16,
  },
  superiorCentroCompacto: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 8,
  },
  compactoBuscarBoton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  globalBuscarCaja: {
    marginBottom: 0,
  },
  superiorDerecha: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    marginRight: 12,
  },
  designBotonTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.primaryDark,
    marginLeft: 4,
  },
  floatingUsuarioTrigger: {
    position: "absolute",
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    ...tema.shadows.md,
    zIndex: 90,
  },
  usuarioMenuTrigger: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: {
    fontSize: 12,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textInverse,
  },
  usuarioInfo: {
    marginHorizontal: 8,
  },
  usuarioNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    maxWidth: 120,
  },
  usuarioRolTexto: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  cuerpoEnvoltorio: {
    flex: 1,
    width: "100%",
  },
  principalContenido: {
    flex: 1,
    backgroundColor: tema.colors.background,
    width: "100%",
    alignItems: "center",
  },
  contenidoContenedor: {
    width: "100%",
    maxWidth: 1280,
    flex: 1,
    alignSelf: "center",
  },
  menuLateralOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  menuLateralBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  menuLateralContenido: {
    width: 325,
    maxWidth: "88%",
    height: "100%",
    backgroundColor: tema.colors.card,
    borderRightWidth: 1,
    borderRightColor: tema.colors.border,
    justifyContent: "space-between",
    ...tema.shadows.lg,
    zIndex: 10,
  },
  menuLateralEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  menuLateralCerrarBoton: {
    padding: 6,
    borderRadius: tema.radius.sm,
  },
  menuLateralScroll: {
    flex: 1,
  },
  menuLateralScrollContenido: {
    paddingVertical: 12,
  },
  navegacionGrupo: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  grupoTitulo: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.8,
    color: tema.colors.textMuted,
    paddingHorizontal: 12,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  navegacionElemento: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    marginBottom: 4,
    backgroundColor: "transparent",
    minHeight: 48,
  },
  navegacionElementoActivo: {
    backgroundColor: "#fff7ed",
    borderLeftWidth: 3,
    borderLeftColor: tema.colors.primary,
  },
  navegacionIconoCaja: {
    width: 32,
    height: 32,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  navegacionIconoCajaActivo: {
    backgroundColor: "#fed7aa",
  },
  navegacionTextoColumna: {
    flex: 1,
  },
  navegacionEtiquetaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  navegacionEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.text,
    flex: 1,
  },
  navegacionEtiquetaActivo: {
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },
  navegacionDescripcion: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  navegacionDescripcionActivo: {
    color: tema.colors.textSecondary,
  },
  menuLateralUsuarioPie: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    backgroundColor: tema.colors.surfaceAlt,
  },
  menuLateralUsuarioTrigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    ...tema.shadows.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingBottom: 76,
    paddingLeft: 16,
  },
  usuarioMenuTarjeta: {
    width: 280,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    ...tema.shadows.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  usuarioMenuEncabezado: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarGrande: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGrandeTexto: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  usuarioMenuNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  usuarioMenuRut: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  usuarioMenuDivisor: {
    height: 1,
    backgroundColor: tema.colors.borderLight,
    marginVertical: 12,
  },
  usuarioMenuSeccionTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginBottom: 8,
  },
  rolSwitchBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 4,
  },
  rolSwitchBotonActual: {
    backgroundColor: tema.colors.primaryLight,
  },
  rolSwitchTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  rolSwitchTextoActual: {
    color: tema.colors.primaryDark,
    fontWeight: "bold",
  },
  testSesionBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    borderRadius: tema.radius.sm,
    marginBottom: 6,
  },
  testSesionTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.warnDark,
    marginLeft: 8,
  },
  cerrarSesionBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cerrarSesionTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.danger,
    marginLeft: 8,
  },
  designModalEnvoltorio: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  designModalEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: tema.spacing.lg,
    paddingVertical: tema.spacing.md,
    backgroundColor: tema.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.border,
    paddingTop: 50,
  },
  designModalTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
    marginLeft: 8,
  },
  cerrarDesignBoton: {
    padding: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surfaceAlt,
  },
  buscadorModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 14,
  },
  buscadorModalTarjeta: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "82%",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
    overflow: "hidden",
    ...tema.shadows.lg,
  },
  buscadorModalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    backgroundColor: tema.colors.surfaceAlt,
  },
  buscadorModalTituloFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buscadorModalTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "700",
    color: tema.colors.text,
  },
  buscadorCerrarBoton: {
    padding: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  buscadorInputContenedor: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  buscadorResultadosScroll: {
    maxHeight: 420,
  },
  buscadorResultadosContenido: {
    padding: 12,
  },
  buscadorSeccionSubtitulo: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tema.colors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  buscadorResultadoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.borderLight,
    backgroundColor: tema.colors.surface,
    marginBottom: 6,
    gap: 10,
  },
  buscadorResultadoIcono: {
    width: 34,
    height: 34,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  buscadorResultadoTextos: {
    flex: 1,
    minWidth: 0,
  },
  buscadorResultadoEncabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  buscadorResultadoTitulo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
    flexShrink: 1,
  },
  buscadorResultadoSubtitulo: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  buscadorVacioCaja: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  buscadorVacioTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "700",
    color: tema.colors.text,
    marginTop: 8,
    textAlign: "center",
  },
  buscadorVacioSubtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
