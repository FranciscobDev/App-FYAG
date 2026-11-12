import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";

/**
 * Definición estricta de la estructura de la entidad (Proveedor o Cliente) [FRONT-2]
 */
export interface EntidadData {
  id?: string;
  rut?: string;
  nombre?: string;
  tipo?: "Proveedor" | "Cliente";
  contacto?: string;
  telefono?: string;
  direccion?: string;
  calificacionPromedio?: number;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  transferEmail?: string;
}

/**
 * Props del componente FichaTercero
 */
export interface FichaTerceroProps {
  entidadData?: EntidadData;
  userRole?: "Administrador" | "Bodeguero" | "admin" | "warehouse" | string;
  onSave?: (data: Required<EntidadData>) => void;
  onClose?: () => void;
  /**
   * Muestra la barra interactiva para cambiar y comparar en vivo entre Administrador y Bodeguero [SCRUM]
   */
  mostrarComparadorScrum?: boolean;
}

/**
 * Componente Mantenedor de Proveedores y Clientes [FRONT-2]
 *
 * Requerimientos:
 * 1. Oculta la sección bancaria si el usuario NO es Administrador (Bodeguero no visualiza cuentas bancarias).
 * 2. Muestra la calificación promedio en la ficha del proveedor.
 * 3. Permite al Administrador gestionar las fichas completas y guardar cambios.
 * 4. [SCRUM] Facilita la comparación de la vista de ficha entre Administrador y Bodeguero.
 */
export const FichaTercero: React.FC<FichaTerceroProps> = ({
  entidadData,
  userRole,
  onSave,
  onClose,
  mostrarComparadorScrum = true,
}) => {
  const auth = usarAutenticacion();
  const { width } = useWindowDimensions();
  const esDesktop = width >= 768;

  // Estado para la simulación interactiva de roles [SCRUM]
  const [rolSimulado, setRolSimulado] = useState<string | null>(null);

  // Determinar rol efectivo: prioridad al rol simulado en la barra Scrum, luego a userRole, luego a auth
  const rolEfectivo =
    rolSimulado ||
    userRole ||
    (auth?.rolActual === "admin" ? "Administrador" : "Bodeguero");

  // Verificación estricta de permisos de Administrador
  const isAdmin =
    rolEfectivo === "Administrador" ||
    rolEfectivo === "admin" ||
    rolEfectivo === "Admin";

  // Estado tipado para los datos del formulario
  const [formData, setFormData] = useState<Required<EntidadData>>({
    id: entidadData?.id || "ent-001",
    rut: entidadData?.rut || "76.543.210-K",
    nombre: entidadData?.nombre || "Proveedor Ejemplo SpA",
    tipo: entidadData?.tipo || "Proveedor",
    contacto: entidadData?.contacto || "contacto@ejemplo.cl",
    telefono: entidadData?.telefono || "+56 9 8765 4321",
    direccion: entidadData?.direccion || "Av. Industrial 4520, Santiago",
    calificacionPromedio: entidadData?.calificacionPromedio ?? 4.7,
    banco: entidadData?.banco || "Banco Estado",
    tipoCuenta: entidadData?.tipoCuenta || "Cuenta Corriente",
    numeroCuenta: entidadData?.numeroCuenta || "12345678-9",
    transferEmail: entidadData?.transferEmail || "pagos@proveedor.cl",
  });

  // Sincronizar datos si cambian las props
  useEffect(() => {
    if (entidadData) {
      setFormData({
        id: entidadData.id || "ent-001",
        rut: entidadData.rut || "76.543.210-K",
        nombre: entidadData.nombre || "Proveedor Ejemplo SpA",
        tipo: entidadData.tipo || "Proveedor",
        contacto: entidadData.contacto || "contacto@ejemplo.cl",
        telefono: entidadData.telefono || "+56 9 8765 4321",
        direccion: entidadData.direccion || "Av. Industrial 4520, Santiago",
        calificacionPromedio: entidadData.calificacionPromedio ?? 4.7,
        banco: entidadData.banco || "Banco Estado",
        tipoCuenta: entidadData.tipoCuenta || "Cuenta Corriente",
        numeroCuenta: entidadData.numeroCuenta || "12345678-9",
        transferEmail: entidadData.transferEmail || "pagos@proveedor.cl",
      });
    }
  }, [entidadData]);

  // Manejador de cambios genérico en los campos del formulario
  const handleChange = (name: keyof EntidadData, value: string | number) => {
    if (!isAdmin) return; // Protección en modo lectura
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Mensajes de retroalimentación multiplataforma
  const emitirAlerta = (titulo: string, mensaje: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
      window.alert(`${titulo}: ${mensaje}`);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  // Manejador de guardado seguro
  const handleSave = () => {
    if (!isAdmin) {
      emitirAlerta(
        "Acceso denegado",
        "Operación permitida exclusivamente para perfiles Administrador."
      );
      return;
    }

    if (!formData.nombre.trim()) {
      emitirAlerta("Validación", "El nombre o razón social es obligatorio.");
      return;
    }

    console.log("Guardando ficha completa [FRONT-2]:", formData);
    if (onSave) {
      onSave(formData);
    }
    emitirAlerta("Éxito", "Ficha actualizada correctamente.");
  };

  // Vista individual de la ficha para un rol dado
  const renderFichaContenido = (esPerfilAdmin: boolean, etiquetaTitulo?: string) => (
    <View style={estilos.tarjetaFicha}>
      {/* Indicador de perfil visualizado */}
      {etiquetaTitulo && (
        <View
          style={[
            estilos.insigniaRolHeader,
            esPerfilAdmin ? estilos.insigniaRolAdmin : estilos.insigniaRolBodega,
          ]}
        >
          <Ionicons
            name={esPerfilAdmin ? "shield-checkmark" : "eye-outline"}
            size={14}
            color={esPerfilAdmin ? "#1e40af" : "#92400e"}
          />
          <Text
            style={[
              estilos.insigniaRolTexto,
              esPerfilAdmin ? estilos.insigniaRolTextoAdmin : estilos.insigniaRolTextoBodega,
            ]}
          >
            {etiquetaTitulo}
          </Text>
        </View>
      )}

      {/* Cabecera: Nombre de la Entidad y Calificación Promedio */}
      <View style={estilos.cabeceraFicha}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={estilos.tituloNombre}>{formData.nombre}</Text>
          <View style={estilos.filaBadges}>
            <View
              style={[
                estilos.badgeTipo,
                formData.tipo === "Proveedor"
                  ? estilos.badgeProveedor
                  : estilos.badgeCliente,
              ]}
            >
              <Text
                style={[
                  estilos.badgeTipoTexto,
                  formData.tipo === "Proveedor"
                    ? estilos.badgeProveedorTexto
                    : estilos.badgeClienteTexto,
                ]}
              >
                {formData.tipo}
              </Text>
            </View>
            <Text style={estilos.rutTexto}>RUT: {formData.rut}</Text>
          </View>
        </View>

        {/* ⭐ Calificación Promedio: Solo visible si la entidad es Proveedor [FRONT-2] */}
        {formData.tipo === "Proveedor" && (
          <View style={estilos.cajaCalificacion}>
            <Text style={estilos.estrellaIcono}>★</Text>
            <View>
              <Text style={estilos.calificacionEtiqueta}>Calificación Promedio</Text>
              <Text style={estilos.calificacionValor}>
                {formData.calificacionPromedio.toFixed(1)} / 5.0
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Formulario de Datos Generales (Lectura para Bodeguero, Editable para Admin) */}
      <View style={estilos.seccionFormulario}>
        <Text style={estilos.subtituloSeccion}>Datos Generales de la Ficha</Text>

        <View style={estilos.cuadriculaCampos}>
          <View style={estilos.columnaCampo}>
            <Text style={estilos.labelCampo}>Nombre / Razón Social</Text>
            <TextInput
              style={[
                estilos.inputTexto,
                !esPerfilAdmin && estilos.inputDeshabilitado,
              ]}
              value={formData.nombre}
              editable={esPerfilAdmin}
              onChangeText={(text) => handleChange("nombre", text)}
              placeholder="Razón Social o Nombre"
            />
          </View>

          <View style={estilos.columnaCampo}>
            <Text style={estilos.labelCampo}>Contacto Principal</Text>
            <TextInput
              style={[
                estilos.inputTexto,
                !esPerfilAdmin && estilos.inputDeshabilitado,
              ]}
              value={formData.contacto}
              editable={esPerfilAdmin}
              onChangeText={(text) => handleChange("contacto", text)}
              placeholder="contacto@ejemplo.cl"
            />
          </View>
        </View>

        <View style={estilos.cuadriculaCampos}>
          <View style={estilos.columnaCampo}>
            <Text style={estilos.labelCampo}>Teléfono</Text>
            <TextInput
              style={[
                estilos.inputTexto,
                !esPerfilAdmin && estilos.inputDeshabilitado,
              ]}
              value={formData.telefono}
              editable={esPerfilAdmin}
              onChangeText={(text) => handleChange("telefono", text)}
              placeholder="+56 9 ..."
            />
          </View>

          <View style={estilos.columnaCampo}>
            <Text style={estilos.labelCampo}>Dirección</Text>
            <TextInput
              style={[
                estilos.inputTexto,
                !esPerfilAdmin && estilos.inputDeshabilitado,
              ]}
              value={formData.direccion}
              editable={esPerfilAdmin}
              onChangeText={(text) => handleChange("direccion", text)}
              placeholder="Dirección comercial"
            />
          </View>
        </View>
      </View>

      {/* 🔒 SECCIÓN BANCARIA: Oculta estrictamente si el usuario NO es Administrador [FRONT-2] */}
      {esPerfilAdmin ? (
        <View style={estilos.cajaBancariaAdmin}>
          <View style={estilos.encabezadoBancarioAdmin}>
            <Ionicons name="card" size={18} color="#1e3a8a" style={{ marginRight: 6 }} />
            <Text style={estilos.tituloBancarioAdmin}>
              🔒 Información Bancaria y Financiera (Gestión Exclusiva Admin)
            </Text>
          </View>

          <View style={estilos.cuadriculaCamposBancarios}>
            <View style={estilos.columnaCampoBancario}>
              <Text style={estilos.labelCampoBancario}>Banco</Text>
              <TextInput
                style={estilos.inputBancario}
                value={formData.banco}
                onChangeText={(text) => handleChange("banco", text)}
                placeholder="Ej: Banco Estado, Santander"
              />
            </View>

            <View style={estilos.columnaCampoBancario}>
              <Text style={estilos.labelCampoBancario}>Tipo de Cuenta</Text>
              <TextInput
                style={estilos.inputBancario}
                value={formData.tipoCuenta}
                onChangeText={(text) => handleChange("tipoCuenta", text)}
                placeholder="Ej: Cuenta Corriente, Vista"
              />
            </View>

            <View style={estilos.columnaCampoBancario}>
              <Text style={estilos.labelCampoBancario}>N° de Cuenta</Text>
              <TextInput
                style={estilos.inputBancario}
                value={formData.numeroCuenta}
                onChangeText={(text) => handleChange("numeroCuenta", text)}
                placeholder="12345678-9"
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={estilos.cajaBancariaBodega}>
          <Ionicons name="lock-closed" size={20} color="#78716c" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={estilos.textoRestriccionBancaria}>
              ℹ️ Sección de cuentas bancarias restringida (Solo visible para perfiles Administrador según normativa de seguridad).
            </Text>
            <Text style={estilos.subtextoRestriccionBancaria}>
              El perfil Bodeguero cuenta con permisos de solo lectura para información operativa y no tiene acceso a cuentas financieras.
            </Text>
          </View>
        </View>
      )}

      {/* Botón de guardado: Exclusivo para Administrador [FRONT-2] */}
      {esPerfilAdmin ? (
        <TouchableOpacity
          style={estilos.botonGuardarAdmin}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Ionicons name="save-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={estilos.botonGuardarAdminTexto}>
            Guardar Cambios de Ficha Completa
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={estilos.cajaModoConsulta}>
          <Ionicons name="information-circle-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={estilos.textoModoConsulta}>
            Vista en Modo Consulta: Las modificaciones y datos bancarios están restringidos a Administradores.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      style={estilos.contenedorScroll}
      contentContainerStyle={estilos.scrollContenido}
      showsVerticalScrollIndicator={false}
    >
      {/* =====================================================================
          BARRA SCRUM: Herramienta de Comparación Rápida Admin vs Bodeguero
          ===================================================================== */}
      {mostrarComparadorScrum && (
        <View style={estilos.barraScrum}>
          <View style={estilos.scrumInfo}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="git-compare-outline" size={18} color={tema.colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={estilos.scrumTitulo}>[SCRUM] Verificación de Ficha (FRONT-2)</Text>
            </View>
            <Text style={estilos.scrumSubtitulo}>
              Compara la vista entre Administrador (gestiona cuentas bancarias y edición) y Bodeguero (banco oculto y solo lectura).
            </Text>
          </View>

          <View style={estilos.scrumSelectorBotones}>
            <TouchableOpacity
              onPress={() => setRolSimulado("Administrador")}
              style={[
                estilos.scrumBoton,
                isAdmin && !rolSimulado?.includes("Comparativa") && estilos.scrumBotonActivoAdmin,
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={isAdmin && !rolSimulado?.includes("Comparativa") ? "#ffffff" : "#1e40af"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  estilos.scrumBotonTexto,
                  isAdmin && !rolSimulado?.includes("Comparativa") && estilos.scrumBotonTextoActivo,
                ]}
              >
                Vista Admin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRolSimulado("Bodeguero")}
              style={[
                estilos.scrumBoton,
                !isAdmin && !rolSimulado?.includes("Comparativa") && estilos.scrumBotonActivoBodega,
              ]}
            >
              <Ionicons
                name="cube-outline"
                size={14}
                color={!isAdmin && !rolSimulado?.includes("Comparativa") ? "#ffffff" : "#92400e"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  estilos.scrumBotonTexto,
                  !isAdmin && !rolSimulado?.includes("Comparativa") && estilos.scrumBotonTextoActivo,
                ]}
              >
                Vista Bodeguero
              </Text>
            </TouchableOpacity>

            {esDesktop && (
              <TouchableOpacity
                onPress={() =>
                  setRolSimulado((prev) =>
                    prev === "Comparativa" ? null : "Comparativa"
                  )
                }
                style={[
                  estilos.scrumBoton,
                  rolSimulado === "Comparativa" && estilos.scrumBotonActivoScrum,
                ]}
              >
                <Ionicons
                  name="columns-outline"
                  size={14}
                  color={rolSimulado === "Comparativa" ? "#ffffff" : tema.colors.primaryDark}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    estilos.scrumBotonTexto,
                    rolSimulado === "Comparativa" && estilos.scrumBotonTextoActivo,
                  ]}
                >
                  Comparar Lado a Lado
                </Text>
              </TouchableOpacity>
            )}

            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                style={estilos.botonCerrarHeader}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* =====================================================================
          RENDERIZADO DE FICHA O COMPARATIVA
          ===================================================================== */}
      {rolSimulado === "Comparativa" && esDesktop ? (
        <View style={estilos.filaComparativa}>
          <View style={estilos.columnaComparativa}>
            {renderFichaContenido(true, "VISTA ADMINISTRADOR (Edición Completa + Banco)")}
          </View>
          <View style={estilos.columnaComparativa}>
            {renderFichaContenido(false, "VISTA BODEGUERO (Solo Lectura + Banco Restringido)")}
          </View>
        </View>
      ) : (
        renderFichaContenido(
          isAdmin,
          `Modo Activo: ${isAdmin ? "Administrador (Ficha completa editable)" : "Bodeguero (Solo lectura, banco restringido)"}`
        )
      )}
    </ScrollView>
  );
};

export default FichaTercero;

const estilos = StyleSheet.create({
  contenedorScroll: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContenido: {
    padding: 16,
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  barraScrum: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scrumInfo: {
    marginBottom: 10,
  },
  scrumTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  scrumSubtitulo: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  scrumSelectorBotones: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  scrumBoton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  scrumBotonActivoAdmin: {
    backgroundColor: "#1e40af",
    borderColor: "#1e40af",
  },
  scrumBotonActivoBodega: {
    backgroundColor: "#b45309",
    borderColor: "#b45309",
  },
  scrumBotonActivoScrum: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primary,
  },
  scrumBotonTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  scrumBotonTextoActivo: {
    color: "#ffffff",
  },
  botonCerrarHeader: {
    marginLeft: "auto",
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  filaComparativa: {
    flexDirection: "row",
    gap: 16,
  },
  columnaComparativa: {
    flex: 1,
  },
  tarjetaFicha: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  insigniaRolHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  insigniaRolAdmin: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  insigniaRolBodega: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  insigniaRolTexto: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  insigniaRolTextoAdmin: {
    color: "#1e40af",
  },
  insigniaRolTextoBodega: {
    color: "#92400e",
  },
  cabeceraFicha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 16,
  },
  tituloNombre: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  filaBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeTipo: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeProveedor: {
    backgroundColor: "#e0e7ff",
  },
  badgeCliente: {
    backgroundColor: "#dcfce7",
  },
  badgeTipoTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeProveedorTexto: {
    color: "#3730a3",
  },
  badgeClienteTexto: {
    color: "#166534",
  },
  rutTexto: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  cajaCalificacion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  estrellaIcono: {
    fontSize: 20,
    color: "#f59e0b",
    marginRight: 6,
  },
  calificacionEtiqueta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
  },
  calificacionValor: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1c1917",
  },
  seccionFormulario: {
    marginBottom: 16,
  },
  subtituloSeccion: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  cuadriculaCampos: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  columnaCampo: {
    flex: 1,
  },
  labelCampo: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  inputTexto: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  inputDeshabilitado: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    color: "#64748b",
  },
  cajaBancariaAdmin: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  encabezadoBancarioAdmin: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  tituloBancarioAdmin: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  cuadriculaCamposBancarios: {
    flexDirection: "row",
    gap: 10,
  },
  columnaCampoBancario: {
    flex: 1,
  },
  labelCampoBancario: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3b82f6",
    marginBottom: 4,
  },
  inputBancario: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: "#1e293b",
  },
  cajaBancariaBodega: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  textoRestriccionBancaria: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 16,
  },
  subtextoRestriccionBancaria: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 15,
  },
  botonGuardarAdmin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: "#2563eb",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  botonGuardarAdminTexto: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cajaModoConsulta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  textoModoConsulta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
});
