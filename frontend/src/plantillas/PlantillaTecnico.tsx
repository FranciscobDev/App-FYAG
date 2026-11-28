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
import { BannerSinConexion } from "@/componentes/dominio/BannerSinConexion";
import { ChipSincronizacion } from "@/componentes/dominio/ChipSincronizacion";
import { NotificacionFlotante, TipoNotificacionFlotante } from "@/componentes/retroalimentacion/NotificacionFlotante";


// Pantallas del Técnico
import { VistaProyectosTecnico } from "@/modulos/tecnico/VistaProyectosTecnico";
import { VistaMaterialesTecnico } from "@/modulos/tecnico/VistaMaterialesTecnico";
import { VistaRegistroTecnico } from "@/modulos/tecnico/VistaRegistroTecnico";
import { VistaHojasServicioTecnico } from "@/modulos/tecnico/VistaHojasServicioTecnico";
import { Proyecto } from "@/nucleo/tipos";

export type PestanaTecnico = "proyectos" | "insumos" | "registrar" | "alertas";

export interface PropiedadesPlantillaTecnico {
  onLogout?: () => void;
}

export const PlantillaTecnico: React.FC<PropiedadesPlantillaTecnico> = ({ onLogout }) => {
  const { usuario, rolActual, establecerRol } = usarAutenticacion();
  const { solicitudesMaterial, hojasServicio } = usarAplicacion();
  const insets = useSafeAreaInsets();
  const superiorInset = Math.max(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0
  );
  const inferiorInset = insets.bottom;

  const [activoPestana, establecerActivoPestana] = useState<PestanaTecnico>("proyectos");
  const [seleccionadoProyectoForPestana, establecerSeleccionadoProyectoForPestana] = useState<Proyecto | null>(null);
  const [registerInicialSubPestana, establecerRegisterInicialSubPestana] = useState<"avance" | "horas" | "sobrante">("avance");
  const [esSinConexion, establecerEsSinConexion] = useState(false);
  const [pendienteSincronizacionConteo, establecerPendienteSincronizacionConteo] = useState(0);

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

  // Conflictos o alertas
  const conflictoConteo = hojasServicio.filter((s) => s.hasVersionConflict).length;
  const activoAlertasConteo = solicitudesMaterial.filter((r) => r.status === "aprobada" || r.status === "pendiente").length;

  const renderizarContenido = () => {
    switch (activoPestana) {
      case "proyectos":
        return (
          <VistaProyectosTecnico
            isOffline={esSinConexion}
            onNavigateTab={(tab, proj, subTab) => {
              if (proj) establecerSeleccionadoProyectoForPestana(proj);
              if (tab === "registrar") {
                establecerRegisterInicialSubPestana(subTab || "horas");
                establecerActivoPestana("registrar");
              } else if (tab === "insumos") {
                establecerActivoPestana("insumos");
              }
            }}
          />
        );
      case "insumos":
        return (
          <VistaMaterialesTecnico
            isOffline={esSinConexion}
            initialProjectId={seleccionadoProyectoForPestana?.id}
            onNavigateTab={(tab) => {
              if (tab === "registrar") {
                establecerRegisterInicialSubPestana("sobrante");
                establecerActivoPestana("registrar");
              }
            }}
          />
        );
      case "registrar":
        return (
          <VistaRegistroTecnico
            initialSubTab={registerInicialSubPestana}
            initialProjectId={seleccionadoProyectoForPestana?.id}
          />
        );
      case "alertas":
        return <VistaHojasServicioTecnico isOffline={esSinConexion} />;
      default:
        return <VistaProyectosTecnico isOffline={esSinConexion} />;
    }
  };

  return (
    <View style={estilos.contenedor}>
      {/* ========================================================================= */}
      {/* 1. TOPBAR CELULAR MOBILE-FIRST                                            */}
      {/* ========================================================================= */}
      <View
        style={[
          estilos.barraSuperior,
          {
            paddingTop: superiorInset,
            minHeight: 58 + superiorInset,
            paddingLeft: Math.max(insets.left, tema.spacing.md),
            paddingRight: Math.max(insets.right, tema.spacing.md),
          },
        ]}
      >
        <View style={estilos.superiorIzquierda}>
          <View style={estilos.marcaCirculo}>
            <Ionicons name="hammer" size={16} color={tema.colors.textInverse} />
          </View>
          <View>
            <Text style={estilos.marcaTitulo}>FYAG TÉCNICO</Text>
            <Text style={estilos.usuarioNombre}>{usuario.name.split(" ")[0]} • Faena</Text>
          </View>
        </View>

        {/* SyncStatusChip y Selector de Usuario */}
        <View style={estilos.superiorDerecha}>
          <ChipSincronizacion
            variant="dark"
            status={esSinConexion || pendienteSincronizacionConteo > 0 ? "pendiente" : "sincronizado"}
            pendingCount={pendienteSincronizacionConteo}
            onPress={() => {
              if (pendienteSincronizacionConteo > 0) {
                mostrarAviso("Sincronizando operaciones pendientes con el servidor...", "ok");
                establecerPendienteSincronizacionConteo(0);
              } else {
                mostrarAviso(esSinConexion ? "Operando en modo sin conexión" : "Todos los datos sincronizados", "info");
              }
            }}
          />



          <TouchableOpacity
            onPress={() => establecerUsuarioMenuAbrir(true)}
            style={estilos.avatarBoton}
            accessibilityLabel="Menú de usuario"
          >
            <Text style={estilos.avatarTexto}>{usuario.initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. OFFLINE BANNER FIJO SUPERIOR (FAENAS REMOTAS SIN SEÑAL)                */}
      {/* ========================================================================= */}
      <BannerSinConexion
        onToggle={(offline) => {
          establecerEsSinConexion(offline);
          if (offline) {
            establecerPendienteSincronizacionConteo((c) => c + 1);
            mostrarAviso("Modo Offline activado: Los registros se guardarán localmente", "warn");
          } else {
            mostrarAviso("Conexión restablecida: Sincronizando con base central...", "ok");
          }
        }}
      />

      {/* ========================================================================= */}
      {/* 3. ÁREA DE CONTENIDO CENTRAL                                              */}
      {/* ========================================================================= */}
      <View style={estilos.principalContenido}>
        <View style={estilos.contenidoContenedor}>
          {renderizarContenido()}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 4. BOTTOMNAV CON EXACTAMENTE 4 PESTAÑAS (TOUCH TARGET ≥ 52 PX)            */}
      {/* ========================================================================= */}
      <View
        style={[
          estilos.inferiorNavegacion,
          {
            paddingBottom: Math.max(inferiorInset, 6),
            height: 60 + inferiorInset,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {/* Pestaña 1: Proyectos */}
        <TouchableOpacity
          onPress={() => establecerActivoPestana("proyectos")}
          activeOpacity={0.7}
          style={[
            estilos.navegacionPestana,
            activoPestana === "proyectos" && estilos.navegacionPestanaActivo,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Mis Proyectos en faena"
        >
          <Ionicons
            name={activoPestana === "proyectos" ? "hammer" : "hammer-outline"}
            size={22}
            color={activoPestana === "proyectos" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              estilos.navegacionPestanaEtiqueta,
              activoPestana === "proyectos" && estilos.navegacionPestanaEtiquetaActivo,
            ]}
          >
            Proyectos
          </Text>
        </TouchableOpacity>

        {/* Pestaña 2: Insumos */}
        <TouchableOpacity
          onPress={() => establecerActivoPestana("insumos")}
          activeOpacity={0.7}
          style={[
            estilos.navegacionPestana,
            activoPestana === "insumos" && estilos.navegacionPestanaActivo,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Catálogo de Insumos y Pedidos"
        >
          <Ionicons
            name={activoPestana === "insumos" ? "cube" : "cube-outline"}
            size={22}
            color={activoPestana === "insumos" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              estilos.navegacionPestanaEtiqueta,
              activoPestana === "insumos" && estilos.navegacionPestanaEtiquetaActivo,
            ]}
          >
            Insumos
          </Text>
        </TouchableOpacity>

        {/* Pestaña 3: Registrar */}
        <TouchableOpacity
          onPress={() => establecerActivoPestana("registrar")}
          activeOpacity={0.7}
          style={[
            estilos.navegacionPestana,
            activoPestana === "registrar" && estilos.navegacionPestanaActivo,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Registrar devolución o consumo"
        >
          <Ionicons
            name={activoPestana === "registrar" ? "add-circle" : "add-circle-outline"}
            size={24}
            color={activoPestana === "registrar" ? "#f59e0b" : "#78716c"}
          />
          <Text
            style={[
              estilos.navegacionPestanaEtiqueta,
              activoPestana === "registrar" && estilos.navegacionPestanaEtiquetaActivo,
            ]}
          >
            Registrar
          </Text>
        </TouchableOpacity>

        {/* Pestaña 4: Alertas */}
        <TouchableOpacity
          onPress={() => establecerActivoPestana("alertas")}
          activeOpacity={0.7}
          style={[
            estilos.navegacionPestana,
            activoPestana === "alertas" && estilos.navegacionPestanaActivo,
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Alertas y notificaciones"
        >
          <View style={{ position: "relative" }}>
            <Ionicons
              name={activoPestana === "alertas" ? "notifications" : "notifications-outline"}
              size={22}
              color={activoPestana === "alertas" ? "#f59e0b" : "#78716c"}
            />
            {activoAlertasConteo > 0 && (
              <View style={estilos.alertaInsigniaPunto}>
                <Text style={estilos.alertaInsigniaTexto}>{activoAlertasConteo}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              estilos.navegacionPestanaEtiqueta,
              activoPestana === "alertas" && estilos.navegacionPestanaEtiquetaActivo,
            ]}
          >
            Alertas
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 5. MODALES: USUARIO Y DISEÑO                                              */}
      {/* ========================================================================= */}
      <Modal
        visible={usuarioMenuAbrir}
        transparent
        animationType="fade"
        onRequestClose={() => establecerUsuarioMenuAbrir(false)}
      >
        <Pressable
          style={[
            estilos.modalBackdrop,
            { paddingTop: superiorInset + 58 },
          ]}
          onPress={() => establecerUsuarioMenuAbrir(false)}
        >
          <View style={estilos.usuarioMenuTarjeta} onStartShouldSetResponder={() => true}>
            <View style={estilos.usuarioMenuEncabezado}>
              <View style={[estilos.avatarGrande, { backgroundColor: "#1c1917", borderWidth: 2, borderColor: tema.colors.primary }]}>
                <Text style={[estilos.avatarGrandeTexto, { color: "#f59e0b" }]}>{usuario.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={estilos.usuarioMenuNombre}>{usuario.name}</Text>
                <Text style={estilos.usuarioMenuRut}>{usuario.rut}</Text>
                <Insignia label="Técnico Especialista" tone="warn" size="sm" style={{ marginTop: 4 }} />
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
                  color={r === rolActual ? tema.colors.primaryDark : tema.colors.textMuted}
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
                  <Ionicons name="checkmark" size={16} color={tema.colors.primaryDark} />
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
    minHeight: 58,
    paddingVertical: 8,
    backgroundColor: "#1c1917", // Dark Titanium Technical Bar
    borderBottomWidth: 1.5,
    borderBottomColor: "#292524",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tema.spacing.md,
    ...tema.shadows.md,
  },
  superiorIzquierda: {
    flexDirection: "row",
    alignItems: "center",
  },
  marcaCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  marcaTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  usuarioNombre: {
    fontSize: 10,
    color: "#a8a29e",
  },
  superiorDerecha: {
    flexDirection: "row",
    alignItems: "center",
  },
  designBoton: {
    padding: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.primaryLight,
    marginHorizontal: 8,
  },
  avatarBoton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#292524",
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  avatarTexto: {
    fontSize: tema.fontSize.caption,
    fontWeight: tema.fontWeight.semibold,
    color: "#f59e0b",
  },
  principalContenido: {
    flex: 1,
    backgroundColor: tema.colors.background,
    alignItems: "center",
  },
  contenidoContenedor: {
    width: "100%",
    maxWidth: 680,
    flex: 1,
  },
  inferiorNavegacion: {
    flexDirection: "row",
    backgroundColor: "#1c1917", // Dark Titanium
    borderTopWidth: 1.5,
    borderTopColor: "#292524",
    paddingBottom: 6,
    paddingTop: 4,
    height: 60,
    ...tema.shadows.md,
  },
  navegacionPestana: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  navegacionPestanaActivo: {
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
    marginTop: -4,
    paddingTop: 2,
  },
  navegacionPestanaEtiqueta: {
    fontSize: 10,
    fontWeight: tema.fontWeight.semibold,
    color: "#78716c",
    marginTop: 2,
  },
  navegacionPestanaEtiquetaActivo: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  alertaInsigniaPunto: {
    position: "absolute",
    top: -2,
    right: -6,
    backgroundColor: tema.colors.danger,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  alertaInsigniaTexto: {
    color: tema.colors.textInverse,
    fontSize: 8,
    fontWeight: tema.fontWeight.semibold,
  },
  alertasContenedor: {
    flex: 1,
  },
  alertasContenido: {
    padding: tema.spacing.md,
  },
  alertasEncabezado: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: tema.spacing.md,
  },
  alertaTarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: tema.spacing.md,
    marginBottom: 8,
    ...tema.shadows.sm,
  },
  alertaSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  alertaCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  alertaProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  alertaElementos: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 68,
    paddingRight: 16,
  },
  usuarioMenuTarjeta: {
    width: 270,
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
    fontWeight: tema.fontWeight.semibold,
    color: tema.colors.textInverse,
  },
  usuarioMenuNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: tema.fontWeight.semibold,
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
