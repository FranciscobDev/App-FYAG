import React, { useState, useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { Rol, UsuarioSistema } from "@/nucleo/tipos";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";

export interface PropiedadesSeccionPrivacidadDatos {
  activoPestana: string;
  usuariosSistema: UsuarioSistema[];
  usuarioActual: any;
  activoAdministradoresConteo: number;
  ejecutarAnonimizacionUsuario: (usuario: UsuarioSistema) => Promise<boolean>;
  mostrarFeedback: (type: "ok" | "error" | "info", message: string) => void;
  width: number;
}

const etiquetaRol = (rol: Rol) => {
  switch (rol) {
    case "admin":
      return "Administrador";
    case "warehouse":
      return "Bodeguero";
    case "technician":
      return "Técnico";
    default:
      return rol;
  }
};

const esAnonimizado = (u: UsuarioSistema) => {
  return (
    !u.rut ||
    u.rut === "Sin RUT" ||
    u.rut === "XX.XXX.XXX-X" ||
    u.name.toLowerCase().includes("anonimiz") ||
    u.email.toLowerCase().includes("@privacidad.local")
  );
};

export const SeccionPrivacidadDatos: React.FC<PropiedadesSeccionPrivacidadDatos> = ({
  activoPestana,
  usuariosSistema,
  usuarioActual,
  activoAdministradoresConteo,
  ejecutarAnonimizacionUsuario,
  mostrarFeedback,
  width,
}) => {
  if (activoPestana !== "privacidad") return null;

  const esMobile = width < 768;
  const esPantallaPequena = width < 480;

  // Estado de búsqueda y filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "anonimizados">("todos");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioSistema | null>(null);

  // Estado del flujo de anonimización (Doble confirmación obligatoria)
  const [modalAnonimizarAbierto, setModalAnonimizarAbierto] = useState(false);
  const [pasoConfirmacion, setPasoConfirmacion] = useState<1 | 2>(1);
  const [palabraClave, setPalabraClave] = useState("");
  const [ejecutandoAnonimizacion, setEjecutandoAnonimizacion] = useState(false);

  // Métricas de privacidad
  const metricas = useMemo(() => {
    const total = usuariosSistema.length;
    const anonimizados = usuariosSistema.filter(esAnonimizado).length;
    const activos = total - anonimizados;
    return { total, anonimizados, activos };
  }, [usuariosSistema]);

  // Lista filtrada
  const usuariosFiltrados = useMemo(() => {
    return usuariosSistema.filter((u) => {
      const q = busqueda.toLowerCase().trim();
      const matchBusqueda =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.rut.toLowerCase().includes(q);

      const anon = esAnonimizado(u);
      if (filtroEstado === "activos") return matchBusqueda && !anon;
      if (filtroEstado === "anonimizados") return matchBusqueda && anon;
      return matchBusqueda;
    });
  }, [usuariosSistema, busqueda, filtroEstado]);

  // Mantener actualizado el usuario seleccionado si cambia en la lista
  const usuarioActivoEnVivo = useMemo(() => {
    if (!usuarioSeleccionado) return null;
    return usuariosSistema.find((u) => u.id === usuarioSeleccionado.id) || usuarioSeleccionado;
  }, [usuarioSeleccionado, usuariosSistema]);

  // ---------------------------------------------------------------------------
  // Exportación JSON y CSV (Portabilidad Ley 19.628)
  // ---------------------------------------------------------------------------
  const exportarJSON = async (user: UsuarioSistema) => {
    try {
      const dataJson = {
        metadata: {
          titulo: "Exportación de Datos Personales (Portabilidad de Datos)",
          normativa: "Ley 19.628 de Protección de la Vida Privada (Chile)",
          fechaExportacion: new Date().toISOString(),
          responsableTratamiento: "FYAG S.A.",
          operadorAutorizado: usuarioActual?.name || "Administrador",
        },
        titular: {
          identificadorSistema: user.id_usuario ? `BD_${user.id_usuario}` : user.id,
          idUsuarioBd: user.id_usuario || null,
          rutOficial: user.rut,
          nombreCompleto: user.name,
          nombre: user.nombre || null,
          apellido: user.apellido || null,
          correoElectronico: user.email,
          rolAsignado: user.role,
          rolNombre: etiquetaRol(user.role),
          especializacion: user.especializacion || null,
          estadoCuenta: user.disabled ? "Deshabilitada / Inactiva" : "Activa",
          estadoPrivacidad: esAnonimizado(user)
            ? "DATOS_ANONIMIZADOS_IRREVERSIBLEMENTE"
            : "DATOS_PERSONALES_ACTIVOS",
          fechaRegistro: user.createdAt,
          ultimoAcceso: user.lastLogin,
        },
      };

      const contenido = JSON.stringify(dataJson, null, 2);
      const nombreArchivo = `datos_personales_${user.rut ? user.rut.replace(/[^0-9kK]/g, "") : user.id}.json`;

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
        const blob = new Blob([contenido], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        await Share.share({
          title: nombreArchivo,
          message: contenido,
        });
      }

      mostrarFeedback("ok", `Datos personales de ${user.name} exportados exitosamente en formato JSON.`);
    } catch (error) {
      console.error("Error al exportar JSON:", error);
      mostrarFeedback("error", "No fue posible generar el archivo JSON.");
    }
  };

  const exportarCSV = async (user: UsuarioSistema) => {
    try {
      const escaparCsv = (valor: string | number | null | undefined): string => {
        if (valor === null || valor === undefined) return '""';
        const str = String(valor).replace(/"/g, '""');
        return `"${str}"`;
      };

      const cabeceras = [
        "ID Sistema",
        "RUT",
        "Nombre",
        "Apellido",
        "Nombre Completo",
        "Correo Electronico",
        "Rol",
        "Especializacion",
        "Estado Cuenta",
        "Estado Privacidad",
        "Fecha Registro",
        "Ultimo Acceso",
        "Fecha Exportacion",
        "Normativa Aplicable",
      ];

      const fila = [
        user.id_usuario ? `BD_${user.id_usuario}` : user.id,
        user.rut || "Sin RUT",
        user.nombre || "-",
        user.apellido || "-",
        user.name || "-",
        user.email || "-",
        etiquetaRol(user.role),
        user.especializacion || "No aplica",
        user.disabled ? "Deshabilitada" : "Activa",
        esAnonimizado(user) ? "Anonimizado (Ley 19.628)" : "Datos Activos",
        user.createdAt || "-",
        user.lastLogin || "-",
        new Date().toISOString(),
        "Ley 19.628 Sobre Proteccion de la Vida Privada (Chile)",
      ];

      // Incluye BOM UTF-8 (\uFEFF) para visualización correcta de tildes en Excel
      const contenidoCsv = "\uFEFF" + cabeceras.join(",") + "\r\n" + fila.map(escaparCsv).join(",");
      const nombreArchivo = `datos_personales_${user.rut ? user.rut.replace(/[^0-9kK]/g, "") : user.id}.csv`;

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
        const blob = new Blob([contenidoCsv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        await Share.share({
          title: nombreArchivo,
          message: contenidoCsv,
        });
      }

      mostrarFeedback("ok", `Datos personales de ${user.name} exportados exitosamente en formato CSV.`);
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      mostrarFeedback("error", "No fue posible generar el archivo CSV.");
    }
  };

  // ---------------------------------------------------------------------------
  // Manejo de Anonimización con Doble Confirmación
  // ---------------------------------------------------------------------------
  const iniciarFlujoAnonimizacion = (user: UsuarioSistema) => {
    if (user.role === "admin" && !user.disabled && activoAdministradoresConteo <= 1) {
      mostrarFeedback(
        "error",
        "Operación bloqueada: No se puede anonimizar al único Administrador activo del sistema."
      );
      return;
    }
    setUsuarioSeleccionado(user);
    setPasoConfirmacion(1);
    setPalabraClave("");
    setModalAnonimizarAbierto(true);
  };

  const ejecutarConfirmacionDefinitiva = async () => {
    if (!usuarioActivoEnVivo) return;
    if (palabraClave.trim().toUpperCase() !== "CONFIRMAR") {
      mostrarFeedback("error", 'Debe escribir exactamente la palabra "CONFIRMAR" para autorizar la acción.');
      return;
    }

    setEjecutandoAnonimizacion(true);
    const exito = await ejecutarAnonimizacionUsuario(usuarioActivoEnVivo);
    setEjecutandoAnonimizacion(false);

    if (exito) {
      setModalAnonimizarAbierto(false);
      setPalabraClave("");
      setPasoConfirmacion(1);
    }
  };

  return (
    <View style={estilosLocales.seccionContenedor}>
      {/* 1. CABECERA NORMATIVA Y RESUMEN KPI LEY 19.628 */}
      <Tarjeta variant="outlined" style={estilosLocales.tarjetaCabecera}>
        <View style={estilosLocales.cabeceraFila}>
          <View style={estilosLocales.iconoCabeceraContenedor}>
            <Ionicons name="shield-checkmark" size={24} color={tema.colors.primaryDark} />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Text style={estilosLocales.cabeceraTitulo}>
                Privacidad y Protección de Datos Personales
              </Text>
              <View style={estilosLocales.insigniaLey}>
                <Ionicons name="document-lock-outline" size={12} color="#1e40af" />
                <Text style={estilosLocales.insigniaLeyTexto}>Ley 19.628 (Chile)</Text>
              </View>
            </View>
            <Text style={estilosLocales.cabeceraSubtitulo}>
              Panel exclusivo de Administrador para gestionar el derecho de acceso, portabilidad (exportación JSON/CSV) y derecho al olvido (anonimización irreversible).
            </Text>
          </View>
        </View>

        {/* Métricas rápidas */}
        <View style={estilosLocales.kpiFila}>
          <View style={[estilosLocales.kpiTarjeta, { backgroundColor: "#f8fafc", borderColor: "#cbd5e1" }]}>
            <Text style={estilosLocales.kpiEtiqueta}>Total Titulares</Text>
            <Text style={[estilosLocales.kpiValor, { color: tema.colors.text }]}>{metricas.total}</Text>
          </View>
          <View style={[estilosLocales.kpiTarjeta, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}>
            <Text style={[estilosLocales.kpiEtiqueta, { color: "#166534" }]}>Datos Activos</Text>
            <Text style={[estilosLocales.kpiValor, { color: "#15803d" }]}>{metricas.activos}</Text>
          </View>
          <View style={[estilosLocales.kpiTarjeta, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <Text style={[estilosLocales.kpiEtiqueta, { color: "#991b1b" }]}>Anonimizados</Text>
            <Text style={[estilosLocales.kpiValor, { color: "#b91c1c" }]}>{metricas.anonimizados}</Text>
          </View>
          <View style={[estilosLocales.kpiTarjeta, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
            <Text style={[estilosLocales.kpiEtiqueta, { color: "#1e40af" }]}>Portabilidad</Text>
            <Text style={[estilosLocales.kpiValor, { color: "#1d4ed8", fontSize: 13, marginTop: 4 }]}>
              JSON / CSV
            </Text>
          </View>
        </View>
      </Tarjeta>

      {/* 2. BARRA DE BÚSQUEDA Y FILTROS */}
      <View style={estilosLocales.barraBusquedaFila}>
        <View style={estilosLocales.cajaEntradaBusqueda}>
          <Ionicons name="search-outline" size={18} color={tema.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por RUT, Nombre o Correo del titular..."
            placeholderTextColor={tema.colors.textLight}
            style={estilosLocales.inputBusqueda}
          />
          {Boolean(busqueda) && (
            <Pressable onPress={() => setBusqueda("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Filtros de estado */}
        <View style={estilosLocales.filtrosEstadoFila}>
          {[
            { id: "todos" as const, label: "Todos", count: metricas.total },
            { id: "activos" as const, label: "Activos", count: metricas.activos },
            { id: "anonimizados" as const, label: "Anonimizados", count: metricas.anonimizados },
          ].map((f) => {
            const activo = filtroEstado === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFiltroEstado(f.id)}
                style={[
                  estilosLocales.botonFiltroPill,
                  activo && estilosLocales.botonFiltroPillActivo,
                ]}
              >
                <Text
                  style={[
                    estilosLocales.botonFiltroPillTexto,
                    activo && estilosLocales.botonFiltroPillTextoActivo,
                  ]}
                >
                  {f.label} ({f.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. CONTENIDO: DETALLE DEL TITULAR SELECCIONADO (SI EXISTE) */}
      {usuarioActivoEnVivo && (
        <Tarjeta
          variant="elevated"
          style={[
            estilosLocales.tarjetaDetalleSeleccionado,
            esAnonimizado(usuarioActivoEnVivo)
              ? estilosLocales.tarjetaAnonimizadaBorde
              : estilosLocales.tarjetaActivaBorde,
          ]}
        >
          <View style={estilosLocales.detalleCabecera}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <Text style={estilosLocales.detalleTitulo}>{usuarioActivoEnVivo.name}</Text>
                {esAnonimizado(usuarioActivoEnVivo) ? (
                  <Insignia label="Anonimizado (Ley 19.628)" tone="danger" size="sm" />
                ) : (
                  <Insignia label="Datos Activos" tone="ok" size="sm" />
                )}
                <Insignia
                  label={etiquetaRol(usuarioActivoEnVivo.role)}
                  tone={usuarioActivoEnVivo.role === "admin" ? "warn" : "info"}
                  size="sm"
                />
              </View>
              <Text style={estilosLocales.detalleSubtitulo}>
                RUT: {usuarioActivoEnVivo.rut || "Sin RUT"} • Correo: {usuarioActivoEnVivo.email}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setUsuarioSeleccionado(null)}
              style={estilosLocales.botonCerrarDetalle}
            >
              <Ionicons name="close" size={18} color={tema.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Grilla de datos personales */}
          <View style={estilosLocales.grillaDatosPersonales}>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>ID Sistema</Text>
              <Text style={estilosLocales.valorDato} numberOfLines={1}>
                {usuarioActivoEnVivo.id_usuario ? `BD #${usuarioActivoEnVivo.id_usuario}` : usuarioActivoEnVivo.id}
              </Text>
            </View>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>RUT Oficial</Text>
              <Text
                style={[
                  estilosLocales.valorDato,
                  esAnonimizado(usuarioActivoEnVivo) && { color: tema.colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {usuarioActivoEnVivo.rut || "Sin RUT"}
              </Text>
            </View>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>Correo Electrónico</Text>
              <Text style={estilosLocales.valorDato} numberOfLines={1}>
                {usuarioActivoEnVivo.email}
              </Text>
            </View>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>Especialización</Text>
              <Text style={estilosLocales.valorDato} numberOfLines={1}>
                {usuarioActivoEnVivo.especializacion || "No especificada"}
              </Text>
            </View>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>Último Acceso</Text>
              <Text style={estilosLocales.valorDato} numberOfLines={1}>
                {usuarioActivoEnVivo.lastLogin || "Nunca"}
              </Text>
            </View>
            <View style={estilosLocales.columnaDato}>
              <Text style={estilosLocales.etiquetaDato}>Estado de Cuenta</Text>
              <Text style={estilosLocales.valorDato} numberOfLines={1}>
                {usuarioActivoEnVivo.disabled ? "Deshabilitada" : "Habilitada"}
              </Text>
            </View>
          </View>

          {/* Acciones de Portabilidad (Exportar JSON / CSV) y Anonimización */}
          <View style={estilosLocales.panelAccionesFila}>
            {/* Bloque de Exportación */}
            <View style={{ flex: 1, minWidth: esMobile ? "100%" : 260 }}>
              <Text style={estilosLocales.accionesBloqueTitulo}>
                <Ionicons name="download-outline" size={14} color={tema.colors.primaryDark} /> Portabilidad de Datos (Exportar)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                <Boton
                  title="Exportar JSON"
                  variant="primary"
                  size="sm"
                  icon="code-download-outline"
                  onPress={() => exportarJSON(usuarioActivoEnVivo)}
                  style={{ flex: 1, minWidth: 120, minHeight: 40 }}
                />
                <Boton
                  title="Exportar CSV"
                  variant="outline"
                  size="sm"
                  icon="document-text-outline"
                  onPress={() => exportarCSV(usuarioActivoEnVivo)}
                  style={{ flex: 1, minWidth: 120, minHeight: 40, backgroundColor: "#ffffff" }}
                />
              </View>
            </View>

            {/* Bloque de Anonimización (Derecho al Olvido) */}
            <View style={{ flex: 1, minWidth: esMobile ? "100%" : 260 }}>
              <Text style={estilosLocales.accionesBloqueTitulo}>
                <Ionicons name="eye-off-outline" size={14} color={tema.colors.dangerDark} /> Derecho al Olvido (Anonimización)
              </Text>
              <View style={{ marginTop: 6 }}>
                {esAnonimizado(usuarioActivoEnVivo) ? (
                  <View style={estilosLocales.cajaYaAnonimizado}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#15803d" />
                    <Text style={estilosLocales.cajaYaAnonimizadoTexto}>
                      Titular ya anonimizado conforme a la Ley 19.628. Sus datos personales fueron destruidos irreversiblemente.
                    </Text>
                  </View>
                ) : usuarioActivoEnVivo.role === "admin" &&
                  !usuarioActivoEnVivo.disabled &&
                  activoAdministradoresConteo <= 1 ? (
                  <View style={estilosLocales.cajaProtegidoAdmin}>
                    <Ionicons name="shield" size={16} color="#b45309" />
                    <Text style={estilosLocales.cajaProtegidoAdminTexto}>
                      Único Administrador activo: protegido contra anonimización para asegurar acceso al sistema.
                    </Text>
                  </View>
                ) : (
                  <Boton
                    title="Anonimizar Datos (Doble Confirmación)"
                    variant="danger"
                    size="sm"
                    icon="trash-bin-outline"
                    onPress={() => iniciarFlujoAnonimizacion(usuarioActivoEnVivo)}
                    style={{ minHeight: 40 }}
                    fullWidth
                  />
                )}
              </View>
            </View>
          </View>
        </Tarjeta>
      )}

      {/* 4. LISTA DE USUARIOS REGISTRADOS PARA SELECCIÓN */}
      <Text style={estilosLocales.subtituloLista}>
        Seleccionar Titular para Inspección de Datos Personales ({usuariosFiltrados.length})
      </Text>

      {usuariosFiltrados.length === 0 ? (
        <EstadoVacio
          icon="people-outline"
          title="No se encontraron usuarios"
          description={
            busqueda
              ? `No hay usuarios que coincidan con "${busqueda}".`
              : "No hay registros disponibles en este filtro."
          }
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        <View style={estilosLocales.grillaUsuarios}>
          {usuariosFiltrados.map((u) => {
            const esSeleccionado = usuarioActivoEnVivo?.id === u.id;
            const anon = esAnonimizado(u);

            return (
              <TouchableOpacity
                key={u.id}
                activeOpacity={0.85}
                onPress={() => setUsuarioSeleccionado(u)}
                style={[
                  estilosLocales.tarjetaUsuarioItem,
                  esSeleccionado && estilosLocales.tarjetaUsuarioItemSeleccionada,
                  anon && estilosLocales.tarjetaUsuarioItemAnonimizada,
                ]}
              >
                <View style={estilosLocales.tarjetaUsuarioHeader}>
                  <View style={estilosLocales.avatarUsuario}>
                    <Ionicons
                      name={anon ? "lock-closed" : u.role === "admin" ? "shield" : "person"}
                      size={18}
                      color={anon ? "#64748b" : u.role === "admin" ? "#1e40af" : "#0f766e"}
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        estilosLocales.nombreUsuarioItem,
                        anon && { color: "#475569", fontStyle: "italic" },
                      ]}
                      numberOfLines={1}
                    >
                      {u.name}
                    </Text>
                    <Text style={estilosLocales.rutUsuarioItem} numberOfLines={1}>
                      RUT: {u.rut || "Sin RUT"}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Insignia
                      label={etiquetaRol(u.role)}
                      tone={u.role === "admin" ? "warn" : "info"}
                      size="sm"
                    />
                    {anon ? (
                      <Insignia label="Anonimizado" tone="danger" size="sm" />
                    ) : u.disabled ? (
                      <Insignia label="Inactivo" tone="mute" size="sm" />
                    ) : (
                      <Insignia label="Activo" tone="ok" size="sm" />
                    )}
                  </View>
                </View>

                <View style={estilosLocales.tarjetaUsuarioCuerpo}>
                  <Text style={estilosLocales.correoUsuarioItem} numberOfLines={1}>
                    ✉️ {u.email}
                  </Text>
                </View>

                {/* Acciones directas compactas */}
                <View style={estilosLocales.tarjetaUsuarioAcciones}>
                  <TouchableOpacity
                    onPress={() => setUsuarioSeleccionado(u)}
                    style={[
                      estilosLocales.botonItemAccion,
                      esSeleccionado && { backgroundColor: tema.colors.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name={esSeleccionado ? "checkmark-circle" : "search-outline"}
                      size={14}
                      color={tema.colors.primaryDark}
                    />
                    <Text style={estilosLocales.botonItemAccionTexto}>
                      {esSeleccionado ? "Inspeccionando" : "Inspeccionar"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => exportarJSON(u)}
                    style={estilosLocales.botonItemIcono}
                    hitSlop={6}
                  >
                    <Ionicons name="code-download-outline" size={16} color={tema.colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => exportarCSV(u)}
                    style={estilosLocales.botonItemIcono}
                    hitSlop={6}
                  >
                    <Ionicons name="document-text-outline" size={16} color={tema.colors.textSecondary} />
                  </TouchableOpacity>

                  {!anon && (
                    <TouchableOpacity
                      onPress={() => iniciarFlujoAnonimizacion(u)}
                      style={[estilosLocales.botonItemIcono, { borderColor: "#fecaca" }]}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-bin-outline" size={16} color={tema.colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* =======================================================================
          5. MODAL DE DOBLE CONFIRMACIÓN OBLIGATORIA (LEY 19.628 / IRREVERSIBLE)
          ======================================================================= */}
      <Modal
        visible={modalAnonimizarAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!ejecutandoAnonimizacion) {
            setModalAnonimizarAbierto(false);
          }
        }}
      >
        <View style={estilosLocales.modalFondoOscuro}>
          <View
            style={[
              estilosLocales.modalCajaContenedor,
              { width: esPantallaPequena ? "94%" : "90%", maxWidth: 520 },
            ]}
          >
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Encabezado del modal */}
              <View style={estilosLocales.modalHeader}>
                <View
                  style={[
                    estilosLocales.modalIconoPaso,
                    pasoConfirmacion === 1
                      ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }
                      : { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
                  ]}
                >
                  <Ionicons
                    name={pasoConfirmacion === 1 ? "warning-outline" : "alert-circle-outline"}
                    size={24}
                    color={pasoConfirmacion === 1 ? "#d97706" : "#dc2626"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={estilosLocales.modalPasoInsignia}>
                    {pasoConfirmacion === 1 ? "PASO 1 DE 2: ADVERTENCIA OBLIGATORIA" : "PASO 2 DE 2: CONFIRMACIÓN DEFINITIVA"}
                  </Text>
                  <Text style={estilosLocales.modalTitulo}>
                    {pasoConfirmacion === 1
                      ? "Anonimización Irreversible de Datos"
                      : "Confirmar Destrucción de Datos"}
                  </Text>
                </View>
              </View>

              {/* ---------------- PASO 1 ---------------- */}
              {pasoConfirmacion === 1 && (
                <View style={{ gap: 14 }}>
                  <View style={estilosLocales.cajaAlertaPaso1}>
                    <Ionicons name="alert-circle" size={20} color="#991b1b" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={estilosLocales.cajaAlertaTituloPaso1}>
                        ADVERTENCIA LEGAL: ESTA ACCIÓN ES TOTALMENTE IRREVERSIBLE
                      </Text>
                      <Text style={estilosLocales.cajaAlertaCuerpoPaso1}>
                        En conformidad con la Ley 19.628 de Protección de la Vida Privada (Chile), todos los datos personales identificables del usuario serán eliminados de manera permanente de la base de datos y sustituidos por registros anónimos.
                      </Text>
                    </View>
                  </View>

                  <View style={estilosLocales.cajaResumenAfectado}>
                    <Text style={estilosLocales.resumenAfectadoTitulo}>Titular seleccionado para anonimizar:</Text>
                    <Text style={estilosLocales.resumenAfectadoNombre}>{usuarioActivoEnVivo?.name}</Text>
                    <Text style={estilosLocales.resumenAfectadoSub}>
                      RUT: {usuarioActivoEnVivo?.rut || "Sin RUT"} • Correo: {usuarioActivoEnVivo?.email} • Rol: {etiquetaRol(usuarioActivoEnVivo?.role || "technician")}
                    </Text>
                  </View>

                  <View style={estilosLocales.cajaListaImpactos}>
                    <Text style={estilosLocales.impactoItem}>
                      ❌ <Text style={{ fontWeight: "700" }}>RUT y Nombres:</Text> Serán reemplazados permanentemente por "Usuario Anonimizado".
                    </Text>
                    <Text style={estilosLocales.impactoItem}>
                      ❌ <Text style={{ fontWeight: "700" }}>Correo y Teléfono:</Text> Serán eliminados y reemplazados por un buzón anónimo inaccesible.
                    </Text>
                    <Text style={estilosLocales.impactoItem}>
                      🔒 <Text style={{ fontWeight: "700" }}>Cuenta:</Text> Será deshabilitada y no podrá volver a iniciar sesión nunca más.
                    </Text>
                    <Text style={estilosLocales.impactoItem}>
                      📋 <Text style={{ fontWeight: "700" }}>Auditoría Inmutable:</Text> Se dejará constancia en bitácora del ejercicio de derecho al olvido.
                    </Text>
                  </View>

                  <View style={estilosLocales.modalBotonesFila}>
                    <Boton
                      title="Cancelar"
                      variant="secondary"
                      size="md"
                      onPress={() => setModalAnonimizarAbierto(false)}
                      style={{ flex: 1, minHeight: 44 }}
                    />
                    <Boton
                      title="Entendido, Continuar al Paso 2 ➔"
                      variant="danger"
                      size="md"
                      icon="arrow-forward-outline"
                      onPress={() => setPasoConfirmacion(2)}
                      style={{ flex: 1.4, minHeight: 44 }}
                    />
                  </View>
                </View>
              )}

              {/* ---------------- PASO 2 ---------------- */}
              {pasoConfirmacion === 2 && (
                <View style={{ gap: 14 }}>
                  <View style={estilosLocales.cajaAlertaPaso2}>
                    <Ionicons name="warning" size={20} color="#b91c1c" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={estilosLocales.cajaAlertaTituloPaso2}>
                        SEGUNDA CONFIRMACIÓN REQUERIDA
                      </Text>
                      <Text style={estilosLocales.cajaAlertaCuerpoPaso2}>
                        Para ratificar la eliminación irreversible de los datos de{" "}
                        <Text style={{ fontWeight: "800", color: "#7f1d1d" }}>
                          {usuarioActivoEnVivo?.name}
                        </Text>
                        , debe escribir exactamente la palabra{" "}
                        <Text style={{ fontWeight: "900", color: "#991b1b" }}>CONFIRMAR</Text> a continuación:
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text style={estilosLocales.labelPalabraClave}>
                      Escriba <Text style={{ color: tema.colors.dangerDark }}>CONFIRMAR</Text> para habilitar la acción:
                    </Text>
                    <TextInput
                      value={palabraClave}
                      onChangeText={setPalabraClave}
                      placeholder="CONFIRMAR"
                      placeholderTextColor={tema.colors.textLight}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      style={[
                        estilosLocales.inputPalabraClave,
                        palabraClave.trim().toUpperCase() === "CONFIRMAR" && estilosLocales.inputPalabraClaveValido,
                      ]}
                    />
                    <Text style={estilosLocales.ayudaPalabraClave}>
                      {palabraClave.trim().toUpperCase() === "CONFIRMAR"
                        ? "✓ Palabra clave verificada. Ya puede ejecutar la anonimización definitiva."
                        : "El botón definitivo permanecerá bloqueado hasta que coincida exactamente."}
                    </Text>
                  </View>

                  <View style={estilosLocales.modalBotonesFila}>
                    <Boton
                      title="← Volver al Paso 1"
                      variant="outline"
                      size="md"
                      onPress={() => setPasoConfirmacion(1)}
                      disabled={ejecutandoAnonimizacion}
                      style={{ flex: 1, minHeight: 44, backgroundColor: "#ffffff" }}
                    />
                    <Boton
                      title={ejecutandoAnonimizacion ? "Anonimizando..." : "Confirmar y Anonimizar"}
                      variant="danger"
                      size="md"
                      icon="trash-bin-outline"
                      disabled={
                        palabraClave.trim().toUpperCase() !== "CONFIRMAR" || ejecutandoAnonimizacion
                      }
                      onPress={ejecutarConfirmacionDefinitiva}
                      style={{ flex: 1.5, minHeight: 44 }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const estilosLocales = StyleSheet.create({
  seccionContenedor: {
    marginTop: 10,
    gap: 12,
  },
  tarjetaCabecera: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  cabeceraFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  iconoCabeceraContenedor: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cabeceraTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: tema.colors.text,
  },
  insigniaLey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  insigniaLeyTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e40af",
  },
  cabeceraSubtitulo: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  kpiFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  kpiTarjeta: {
    flex: 1,
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  kpiEtiqueta: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textSecondary,
    textTransform: "uppercase",
  },
  kpiValor: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  barraBusquedaFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  cajaEntradaBusqueda: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  inputBusqueda: {
    flex: 1,
    fontSize: 13,
    color: tema.colors.text,
  },
  filtrosEstadoFila: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  botonFiltroPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: "#ffffff",
  },
  botonFiltroPillActivo: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  botonFiltroPillTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  botonFiltroPillTextoActivo: {
    color: "#ffffff",
  },
  subtituloLista: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.textSecondary,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grillaUsuarios: {
    gap: 10,
  },
  tarjetaUsuarioItem: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  tarjetaUsuarioItemSeleccionada: {
    borderColor: tema.colors.primary,
    borderWidth: 2,
    backgroundColor: "#f8fafc",
  },
  tarjetaUsuarioItemAnonimizada: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    opacity: 0.9,
  },
  tarjetaUsuarioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarUsuario: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  nombreUsuarioItem: {
    fontSize: 14,
    fontWeight: "800",
    color: tema.colors.text,
  },
  rutUsuarioItem: {
    fontSize: 11,
    color: tema.colors.textMuted,
    fontWeight: "600",
  },
  tarjetaUsuarioCuerpo: {
    flexDirection: "row",
    alignItems: "center",
  },
  correoUsuarioItem: {
    fontSize: 12,
    color: tema.colors.textSecondary,
  },
  tarjetaUsuarioAcciones: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  botonItemAccion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: tema.colors.border,
    backgroundColor: "#ffffff",
  },
  botonItemAccionTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  botonItemIcono: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  // Detalle seleccionado
  tarjetaDetalleSeleccionado: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  tarjetaActivaBorde: {
    borderLeftWidth: 6,
    borderLeftColor: tema.colors.primary,
  },
  tarjetaAnonimizadaBorde: {
    borderLeftWidth: 6,
    borderLeftColor: tema.colors.danger,
  },
  detalleCabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  detalleTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: tema.colors.text,
  },
  detalleSubtitulo: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  botonCerrarDetalle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  grillaDatosPersonales: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginVertical: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  columnaDato: {
    flex: 1,
    minWidth: 140,
  },
  etiquetaDato: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  valorDato: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 2,
  },
  panelAccionesFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 6,
  },
  accionesBloqueTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: tema.colors.text,
  },
  cajaYaAnonimizado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    padding: 10,
    borderRadius: 8,
  },
  cajaYaAnonimizadoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    flex: 1,
  },
  cajaProtegidoAdmin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    padding: 10,
    borderRadius: 8,
  },
  cajaProtegidoAdminTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
    flex: 1,
  },

  // Modal de doble confirmación
  modalFondoOscuro: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCajaContenedor: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  modalIconoPaso: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPasoInsignia: {
    fontSize: 10,
    fontWeight: "900",
    color: tema.colors.dangerDark,
    letterSpacing: 0.5,
  },
  modalTitulo: {
    fontSize: 16,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 2,
  },
  cajaAlertaPaso1: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1.5,
    borderColor: "#f87171",
    padding: 12,
    borderRadius: 10,
  },
  cajaAlertaTituloPaso1: {
    fontSize: 12,
    fontWeight: "900",
    color: "#991b1b",
    marginBottom: 4,
  },
  cajaAlertaCuerpoPaso1: {
    fontSize: 12,
    color: "#7f1d1d",
    lineHeight: 18,
  },
  cajaResumenAfectado: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    borderRadius: 10,
  },
  resumenAfectadoTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  resumenAfectadoNombre: {
    fontSize: 15,
    fontWeight: "800",
    color: tema.colors.text,
    marginTop: 2,
  },
  resumenAfectadoSub: {
    fontSize: 12,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  cajaListaImpactos: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  impactoItem: {
    fontSize: 12,
    color: tema.colors.text,
    lineHeight: 18,
  },
  modalBotonesFila: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  // Paso 2
  cajaAlertaPaso2: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff1f2",
    borderWidth: 2,
    borderColor: "#e11d48",
    padding: 14,
    borderRadius: 10,
  },
  cajaAlertaTituloPaso2: {
    fontSize: 12,
    fontWeight: "900",
    color: "#9f1239",
    marginBottom: 4,
  },
  cajaAlertaCuerpoPaso2: {
    fontSize: 12,
    color: "#881337",
    lineHeight: 18,
  },
  labelPalabraClave: {
    fontSize: 12,
    fontWeight: "700",
    color: tema.colors.text,
    marginBottom: 6,
  },
  inputPalabraClave: {
    borderWidth: 2,
    borderColor: "#fca5a5",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "800",
    color: tema.colors.dangerDark,
    letterSpacing: 1.5,
  },
  inputPalabraClaveValido: {
    borderColor: tema.colors.ok,
    backgroundColor: "#f0fdf4",
    color: tema.colors.okDark,
  },
  ayudaPalabraClave: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
});
