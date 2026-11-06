import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { ROLES, ORDEN_ROLES } from "@/nucleo/roles";
import { tema } from "@/nucleo/tema";

// Componentes
import { Insignia } from "@/componentes/base/Insignia";
import { CampanaNotificaciones } from "@/componentes/dominio/CampanaNotificaciones";
import { ModalEscanerQr } from "@/componentes/dominio/ModalEscanerQr";
import { NotificacionFlotante, TipoNotificacionFlotante } from "@/componentes/retroalimentacion/NotificacionFlotante";


// Pantallas de Bodega
import { PanelBodega } from "@/modulos/panel/PanelBodega";
import { PantallaInventario } from "@/modulos/inventario/PantallaInventario";
import { PantallaCompras } from "@/modulos/compras/PantallaCompras";
import { PantallaHerramientas } from "@/modulos/herramientas/PantallaHerramientas";
import { PantallaDevoluciones } from "@/modulos/devoluciones/PantallaDevoluciones";

export type RutaBodega =
  | "home"
  | "egreso"
  | "recepcion"
  | "devoluciones"
  | "inventario"
  | "conteo"
  | "mermas"
  | "herramientas";

export interface ElementoNavBodega {
  id: RutaBodega;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeTone?: "primary" | "ok" | "warn" | "danger" | "info" | "mute";
}

export interface GrupoNavBodega {
  title: string;
  items: ElementoNavBodega[];
}

export interface PropiedadesPlantillaBodega {
  onLogout?: () => void;
}

export const PlantillaBodega: React.FC<PropiedadesPlantillaBodega> = ({ onLogout }) => {
  const { usuario, rolActual, establecerRol } = usarAutenticacion();
  const { productos, solicitudesMaterial, recepcionesPendientes, ordenesDevolucion } = usarAplicacion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const superiorInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0
  );
  const inferiorInset = insets.bottom;
  const esCompacto = width < 560;

  const [activoRoute, establecerActivoRoute] = useState<RutaBodega>("home");
  const [menuLateralAbrir, establecerMenuLateralAbrir] = useState(false);
  const [escanerAbrir, establecerEscanerAbrir] = useState(false);
  const [escaneadoCodigo, establecerEscaneadoCodigo] = useState<string | null>(null);

  // Contadores dinámicos para badges de bodega
  const pendienteEgressConteo = solicitudesMaterial.filter((r) => r.status === "aprobada").length;
  const pendienteRecepcionesConteo = recepcionesPendientes.filter((p) => p.status === "por_confirmar").length;
  const pendienteDevolucionesConteo = ordenesDevolucion.filter((r) => r.status === "en_transito").length;

  const bodegaGrupos: GrupoNavBodega[] = [
    {
      title: "OPERACIÓN Y MOVIMIENTOS",
      items: [
        {
          id: "home",
          label: "Panel Principal",
          description: "Resumen de pendientes del día, accesos rápidos y alertas",
          icon: "grid-outline",
        },
        {
          id: "egreso",
          label: "Egreso y Despacho",
          description: "Entrega física de materiales a técnicos con guía de salida",
          icon: "arrow-up-circle-outline",
          badge: pendienteEgressConteo > 0 ? String(pendienteEgressConteo) : undefined,
          badgeTone: "primary",
        },
        {
          id: "recepcion",
          label: "Recepción de Compras",
          description: "Verificar bultos, guías de proveedor y dar conformidad a OC",
          icon: "arrow-down-circle-outline",
          badge: pendienteRecepcionesConteo > 0 ? String(pendienteRecepcionesConteo) : undefined,
          badgeTone: "warn",
        },
        {
          id: "devoluciones",
          label: "Devoluciones de Stock",
          description: "Recepción de sobrantes de obra y salida de defectuosos a proveedores",
          icon: "return-down-back-outline",
          badge: pendienteDevolucionesConteo > 0 ? String(pendienteDevolucionesConteo) : undefined,
          badgeTone: "info",
        },
      ],
    },
    {
      title: "CONTROL DE EXISTENCIAS",
      items: [
        {
          id: "inventario",
          label: "Inventario de Bodega",
          description: "Consultar stock disponible, pasillo, estante y PMP",
          icon: "cube-outline",
        },
        {
          id: "conteo",
          label: "Conteo Físico Cíclico",
          description: "Escanear insumos, cuadrar stock físico y reportar diferencias",
          icon: "checkbox-outline",
        },
        {
          id: "mermas",
          label: "Registro de Mermas",
          description: "Reportar insumos dañados, caducados o pérdidas para baja",
          icon: "trash-outline",
        },
      ],
    },
    {
      title: "EQUIPOS Y HERRAMIENTAS",
      items: [
        {
          id: "herramientas",
          label: "Préstamo de Herramientas",
          description: "Asignar herramientas a técnicos y verificar estado al retorno",
          icon: "construct-outline",
        },
      ],
    },
  ];

  // Modales
  const [usuarioMenuAbrir, establecerUsuarioMenuAbrir] = useState(false);

  // Toast
  const [avisoVisible, establecerAvisoVisible] = useState(false);
  const [avisoMensaje, establecerAvisoMensaje] = useState("");
  const [avisoTipo, establecerAvisoTipo] = useState<TipoNotificacionFlotante>("ok");

  const mostrarAviso = (msg: string, type: TipoNotificacionFlotante = "ok") => {
    establecerAvisoMensaje(msg);
    establecerAvisoTipo(type);
    establecerAvisoVisible(true);
  };

  const manejarEscanearResultado = (code: string) => {
    establecerEscaneadoCodigo(code);
    establecerEscanerAbrir(false);
    const producto = productos.find((p) => p.sku === code);
    if (producto) {
      mostrarAviso(`SKU Identificado: ${producto.name} (${producto.stock} ${producto.unit} en stock)`, "ok");
    } else {
      mostrarAviso(`Código escaneado: ${code}`, "info");
    }
  };

  const renderizarContenido = () => {
    switch (activoRoute) {
      case "home":
        return <PanelBodega onNavigate={(tab) => establecerActivoRoute(tab as RutaBodega)} />;
      case "egreso":
        return (
          <PantallaInventario
            key="egreso"
            initialTab="egreso"
            hideTabBar={true}
            title="Egreso y Despacho"
            subtitle="Entrega física de materiales a técnicos con guía de salida"
          />
        );
      case "conteo":
        return (
          <PantallaInventario
            key="conteo"
            initialTab="conteo"
            hideTabBar={true}
            title="Conteo Físico Cíclico"
            subtitle="Escanear insumos, cuadrar stock físico y reportar diferencias"
          />
        );
      case "mermas":
        return (
          <PantallaInventario
            key="mermas"
            initialTab="mermas"
            hideTabBar={true}
            title="Registro de Mermas"
            subtitle="Reportar insumos dañados, caducados o pérdidas para baja"
          />
        );
      case "inventario":
        return (
          <PantallaInventario
            key="inventario"
            initialTab="catalogo"
            hideTabBar={true}
            title="Inventario de Bodega"
            subtitle="Consultar stock disponible, pasillo, estante y PMP"
          />
        );
      case "recepcion":
        return (
          <PantallaCompras
            key="recepcion"
            initialTab="recepcion"
            hideTabBar={true}
            title="Recepción de Compras"
            subtitle="Verificar bultos, guías de proveedor y dar conformidad a Órdenes de Compra"
          />
        );
      case "herramientas":
        return <PantallaHerramientas />;
      case "devoluciones":
        return <PantallaDevoluciones />;
      default:
        return <PanelBodega onNavigate={(tab) => establecerActivoRoute(tab as RutaBodega)} />;
    }
  };

  return (
    <View style={estilos.contenedor}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR RESPONSIVA                                                      */}
      {/* ========================================================================= */}
      <View
        style={[
          estilos.barraSuperior,
          esCompacto && estilos.barraSuperiorCompacto,
          {
            paddingTop: superiorInset,
            minHeight: (esCompacto ? 56 : 64) + superiorInset,
            paddingLeft: Math.max(insets.left, esCompacto ? tema.spacing.md : tema.spacing.lg),
            paddingRight: Math.max(insets.right, esCompacto ? tema.spacing.md : tema.spacing.lg),
          },
        ]}
      >
        <View style={estilos.superiorIzquierda}>
          <TouchableOpacity
            onPress={() => establecerMenuLateralAbrir(true)}
            style={estilos.alternarBoton}
            accessibilityLabel="Abrir menú de navegación"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={estilos.marcaIconoCirculo}>
            <Ionicons name="cube" size={20} color={tema.colors.textInverse} />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={estilos.marcaTitulo}>FYAG BODEGA</Text>
              {width >= 480 && (
                <Insignia label="TABLET" tone="warn" size="sm" style={{ marginLeft: 6 }} />
              )}
            </View>
            {width >= 600 && (
              <Text style={estilos.bodegaSubtitulo}>Bodega Central Santiago • Terminal R-1</Text>
            )}
          </View>
        </View>

        {/* Acciones Rápidas Superior: Campana en la esquina */}
        <View style={estilos.superiorDerecha}>
          <CampanaNotificaciones variant="dark" />
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. CUERPO: ÁREA PRINCIPAL A PANTALLA COMPLETA                             */}
      {/* ========================================================================= */}
      <View
        style={[
          estilos.cuerpoEnvoltorio,
          {
            paddingBottom: inferiorInset,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {/* ÁREA DE CONTENIDO */}
        <View style={estilos.principalContenido}>
          {/* Banner de código escaneado si existe */}
          {escaneadoCodigo && (
            <View style={estilos.escaneadoAviso}>
              <Ionicons name="checkmark-circle" size={20} color={tema.colors.ok} />
              <Text style={estilos.escaneadoAvisoTexto}>
                Última lectura: <Text style={{ fontWeight: tema.fontWeight.semibold }}>{escaneadoCodigo}</Text>
              </Text>
              <TouchableOpacity onPress={() => establecerEscaneadoCodigo(null)} style={{ marginLeft: "auto" }}>
                <Ionicons name="close" size={18} color={tema.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

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
            <View
              style={[
                estilos.menuLateralEncabezado,
                { paddingTop: Math.max(superiorInset + 10, 14) },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={estilos.marcaIconoCirculo}>
                  <Ionicons name="cube" size={20} color={tema.colors.textInverse} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={estilos.marcaTitulo}>FYAG BODEGA</Text>
                  <Insignia label="TABLET" tone="warn" size="sm" style={{ alignSelf: "flex-start", marginTop: 2 }} />
                </View>
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
              {bodegaGrupos.map((group) => (
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
                            color={esActivo ? tema.colors.warnDark : tema.colors.textSecondary}
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
            <View
              style={[
                estilos.menuLateralUsuarioPie,
                { paddingBottom: Math.max(inferiorInset + 10, 12) },
              ]}
            >
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
                  <Text style={estilos.usuarioRol}>Bodeguero</Text>
                </View>
                <Ionicons name="ellipsis-vertical" size={18} color={tema.colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. BOTÓN FLOTANTE: ESCÁNER QR/BARRAS                                      */}
      {/* ========================================================================= */}
      <TouchableOpacity
        onPress={() => establecerEscanerAbrir(true)}
        style={[
          estilos.floatingEscanearFab,
          { bottom: Math.max(inferiorInset + 16, 24) },
        ]}
        activeOpacity={0.85}
        accessibilityLabel="Escanear código QR o código de barras de material"
        accessibilityRole="button"
      >
        <Ionicons name="barcode-outline" size={24} color={tema.colors.textInverse} />
        <Text style={estilos.floatingFabTexto}>Escanear</Text>
      </TouchableOpacity>

      {/* ========================================================================= */}
      {/* 4. MODALES: ESCÁNER, USUARIO Y DISEÑO                                     */}
      {/* ========================================================================= */}
      <ModalEscanerQr
        visible={escanerAbrir}
        onClose={() => establecerEscanerAbrir(false)}
        onScanResult={manejarEscanearResultado}
      />

      {/* Modal Menú de Usuario */}
      <Modal
        visible={usuarioMenuAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerUsuarioMenuAbrir(false)}
      >
        <Pressable
          style={[
            estilos.modalBackdrop,
            { paddingBottom: Math.max(inferiorInset + 64, 76) },
          ]}
          onPress={() => establecerUsuarioMenuAbrir(false)}
        >
          <View style={estilos.usuarioMenuTarjeta} onStartShouldSetResponder={() => true}>
            <View style={estilos.usuarioMenuEncabezado}>
              <View style={[estilos.avatarGrande, { backgroundColor: tema.colors.warnDark }]}>
                <Text style={estilos.avatarGrandeTexto}>{usuario.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={estilos.usuarioMenuNombre}>{usuario.name}</Text>
                <Text style={estilos.usuarioMenuRut}>{usuario.rut}</Text>
                <Insignia label="Bodeguero Central" tone="warn" size="sm" style={{ marginTop: 4 }} />
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
                  color={r === rolActual ? tema.colors.warnDark : tema.colors.textMuted}
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
                  <Ionicons name="checkmark" size={16} color={tema.colors.warnDark} />
                )}
              </TouchableOpacity>
            ))}

            <View style={estilos.usuarioMenuDivisor} />

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



      {/* TOAST FLOTANTE */}
      <NotificacionFlotante
        visible={avisoVisible}
        message={avisoMensaje}
        type={avisoTipo}
        onDismiss={() => establecerAvisoVisible(false)}
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
    minHeight: 64,
    paddingVertical: 8,
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
  marcaIconoCirculo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  marcaTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: "#ffffff",
  },
  bodegaSubtitulo: {
    fontSize: 11,
    color: "#a8a29e",
  },
  superiorDerecha: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.warnLight,
    borderWidth: 1,
    borderColor: tema.colors.warnBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tema.radius.full,
    marginRight: 12,
  },
  designBotonTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.warnDark,
    marginLeft: 4,
  },
  usuarioInsigniaBoton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tema.colors.warnDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  usuarioNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  usuarioRol: {
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
    position: "relative",
    width: "100%",
    alignItems: "center",
  },
  contenidoContenedor: {
    width: "100%",
    maxWidth: 1280,
    flex: 1,
    alignSelf: "center",
  },
  escaneadoAviso: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.primaryBorder,
    paddingHorizontal: tema.spacing.md,
    paddingVertical: 8,
    width: "100%",
  },
  escaneadoAvisoTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.primaryDark,
    marginLeft: 6,
  },
  floatingEscanearFab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: tema.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: tema.radius.full,
    minHeight: 48,
    ...tema.shadows.md,
    zIndex: 90,
  },
  floatingFabTexto: {
    color: tema.colors.textInverse,
    fontWeight: tema.fontWeight.semibold,
    fontSize: tema.fontSize.sm,
    marginLeft: 8,
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
    backgroundColor: "#fffbeb",
    borderLeftWidth: 3,
    borderLeftColor: tema.colors.warnDark,
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
    backgroundColor: "#fde68a",
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
    color: tema.colors.warnDark,
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
  usuarioInfo: {
    marginHorizontal: 8,
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
    backgroundColor: tema.colors.warnLight,
  },
  rolSwitchTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  rolSwitchTextoActual: {
    color: tema.colors.warnDark,
    fontWeight: "bold",
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
});
