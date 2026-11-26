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
import { usarAplicacion } from "@/contexto/ContextoAplicacion";

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
  ratingAvg?: number;
  ratingCount?: number;
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
  const app = usarAplicacion();
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
    calificacionPromedio: entidadData?.calificacionPromedio ?? entidadData?.ratingAvg ?? 0,
    ratingAvg: entidadData?.ratingAvg ?? entidadData?.calificacionPromedio ?? 0,
    ratingCount: entidadData?.ratingCount ?? (entidadData?.ratingAvg ? 1 : 0),
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
        calificacionPromedio: entidadData.calificacionPromedio ?? entidadData.ratingAvg ?? 0,
        ratingAvg: entidadData.ratingAvg ?? entidadData.calificacionPromedio ?? 0,
        ratingCount: entidadData.ratingCount ?? (entidadData.ratingAvg ? 1 : 0),
        banco: entidadData.banco || "Banco Estado",
        tipoCuenta: entidadData.tipoCuenta || "Cuenta Corriente",
        numeroCuenta: entidadData.numeroCuenta || "12345678-9",
        transferEmail: entidadData.transferEmail || "pagos@proveedor.cl",
      });
    }
  }, [entidadData]);

  // Consulta reactiva del proveedor en tiempo real desde el contexto
  const proveedorEnVivo =
    formData.tipo === "Proveedor"
      ? (app?.proveedores || []).find(
          (p: any) =>
            (formData.id && p.id === formData.id) ||
            (formData.rut && p.rut && p.rut.replace(/[.\s-]/g, "") === formData.rut.replace(/[.\s-]/g, "")) ||
            (formData.nombre && p.businessName && p.businessName.trim().toLowerCase() === formData.nombre.trim().toLowerCase())
        )
      : null;

  const rawRating = proveedorEnVivo?.ratingAvg ?? formData.ratingAvg ?? formData.calificacionPromedio;
  const tieneCalificacion = typeof rawRating === "number" && !isNaN(rawRating) && rawRating > 0;
  const calificacionPromedioEfectiva = tieneCalificacion ? rawRating : null;
  const ratingConteoEfectivo =
    proveedorEnVivo?.ratingCount ?? formData.ratingCount ?? (tieneCalificacion ? 1 : 0);

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
      <View style={[estilos.cabeceraFicha, { flexWrap: "wrap", gap: 10 }]}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={[estilos.tituloNombre, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
            {formData.nombre}
          </Text>
          <View style={[estilos.filaBadges, { flexWrap: "wrap", gap: 6 }]}>
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

        {/* ⭐ Calificación Promedio con Estrellas: Solo visible si la entidad es Proveedor [FRONT-2 / H15] */}
        {formData.tipo === "Proveedor" && (
          <View style={estilos.cajaCalificacion}>
            <View style={estilos.cajaCalificacionHeader}>
              <Text style={estilos.calificacionEtiqueta}>Calificación [H15]</Text>
              <View
                style={[
                  estilos.insigniaPuntaje,
                  !tieneCalificacion && estilos.insigniaPuntajeVacia,
                ]}
              >
                <Text
                  style={[
                    estilos.insigniaPuntajeTexto,
                    !tieneCalificacion && estilos.insigniaPuntajeTextoVacia,
                  ]}
                >
                  {tieneCalificacion
                    ? (calificacionPromedioEfectiva! >= 4.5
                        ? "Excelente"
                        : calificacionPromedioEfectiva! >= 3.8
                        ? "Bueno"
                        : calificacionPromedioEfectiva! >= 3.0
                        ? "Aceptable"
                        : "Regular")
                    : "Sin calificación"}
                </Text>
              </View>
            </View>

            {/* Fila de estrellas vectoriales y promedio actualizado */}
            <View style={estilos.calificacionFilaEstrellas}>
              <View style={estilos.estrellasContenedor}>
                {[1, 2, 3, 4, 5].map((estrella) => {
                  const llena = tieneCalificacion && estrella <= Math.round(calificacionPromedioEfectiva!);
                  return (
                    <Ionicons
                      key={estrella}
                      name={llena ? "star" : "star-outline"}
                      size={18}
                      color={llena ? "#f59e0b" : "#cbd5e1"}
                      style={{ marginRight: 2 }}
                    />
                  );
                })}
              </View>

              <Text style={estilos.calificacionValor}>
                {tieneCalificacion ? calificacionPromedioEfectiva!.toFixed(1) : "—"}{" "}
                <Text style={estilos.calificacionEscala}>/ 5.0</Text>
              </Text>
            </View>

            <Text style={estilos.calificacionConteoTexto}>
              {tieneCalificacion
                ? `${ratingConteoEfectivo} ${ratingConteoEfectivo === 1 ? "evaluación registrada" : "evaluaciones registradas"}`
                : "Aún no registra evaluaciones en órdenes cerradas"}
            </Text>
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
          <View style={[estilos.encabezadoBancarioAdmin, { flexWrap: "wrap" }]}>
            <Ionicons name="card" size={18} color="#1e3a8a" style={{ marginRight: 6 }} />
            <Text style={[estilos.tituloBancarioAdmin, { flex: 1, flexShrink: 1 }]}>
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
          <Ionicons name="lock-closed" size={20} color="#64748b" style={{ marginRight: 8 }} />
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

      {/* ⭐ SECCIÓN DE DESEMPEÑO Y EVALUACIÓN DE ÓRDENES CERRADAS (H15) */}
      {formData.tipo === "Proveedor" && (
        <View style={estilos.seccionEvaluacionesH15}>
          <View style={estilos.encabezadoEvaluaciones}>
            <Ionicons name="star" size={18} color="#d97706" style={{ marginRight: 6 }} />
            <Text style={estilos.tituloEvaluaciones}>
              ⭐ Desempeño Comercial y Evaluación de Órdenes (H15)
            </Text>
          </View>

          {/* Criterios evaluados */}
          <View style={estilos.criteriosCuadricula}>
            <View style={estilos.criterioItem}>
              <Text style={estilos.criterioIcono}>⏱️</Text>
              <Text style={estilos.criterioTitulo}>Cumplimiento Plazos</Text>
              <Text style={estilos.criterioSub}>Puntualidad en entrega</Text>
            </View>
            <View style={estilos.criterioItem}>
              <Text style={estilos.criterioIcono}>📦</Text>
              <Text style={estilos.criterioTitulo}>Calidad y Embalaje</Text>
              <Text style={estilos.criterioSub}>Conforme y sin mermas</Text>
            </View>
            <View style={estilos.criterioItem}>
              <Text style={estilos.criterioIcono}>💲</Text>
              <Text style={estilos.criterioTitulo}>Precio y Facturación</Text>
              <Text style={estilos.criterioSub}>Condiciones pactadas</Text>
            </View>
          </View>

          {/* Listado de OCs calificadas de este proveedor */}
          {(() => {
            const ocsCalificadas = (app?.ordenesCompra || []).filter(
              (o: any) =>
                (o.supplierId === (proveedorEnVivo?.id || formData.id) ||
                  (o.supplier && o.supplier.trim().toLowerCase() === formData.nombre.trim().toLowerCase())) &&
                Boolean(o.rating)
            );

            if (ocsCalificadas.length === 0) {
              return (
                <View style={estilos.cajaSinEvaluaciones}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color="#92400e" style={{ marginRight: 8 }} />
                  <Text style={estilos.textoSinEvaluaciones}>
                    Las evaluaciones se generan automáticamente con estrellas al calificar y cerrar una Orden de Compra en el módulo de Compras.
                  </Text>
                </View>
              );
            }

            return (
              <View style={{ marginTop: 6, gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                  Historial de Órdenes Calificadas ({ocsCalificadas.length}):
                </Text>
                {ocsCalificadas.map((oc: any) => (
                  <View key={oc.id} style={estilos.tarjetaOcCalificada}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#1e293b" }}>
                        {oc.code}
                      </Text>
                      <View style={estilos.calificacionPuntajeMini}>
                        <Ionicons name="star" size={13} color="#d97706" />
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#92400e" }}>
                          {oc.rating.average} / 5.0
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      <Text style={estilos.desgloseCriterioTexto}>
                        Plazo: <Text style={{ fontWeight: "700" }}>{oc.rating.timeRating || 5}★</Text>
                      </Text>
                      <Text style={estilos.desgloseCriterioTexto}>
                        Calidad: <Text style={{ fontWeight: "700" }}>{oc.rating.qualityRating || 5}★</Text>
                      </Text>
                      <Text style={estilos.desgloseCriterioTexto}>
                        Precio: <Text style={{ fontWeight: "700" }}>{oc.rating.priceRating || 5}★</Text>
                      </Text>
                      {oc.rating.ratedAt && (
                        <Text style={[estilos.desgloseCriterioTexto, { color: "#64748b" }]}>
                          📅 {oc.rating.ratedAt}
                        </Text>
                      )}
                    </View>

                    {Boolean(oc.rating.comment) && (
                      <Text style={estilos.comentarioEvaluacionTexto}>
                        "{oc.rating.comment}"
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })()}
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
          RENDERIZADO DE FICHA
          ===================================================================== */}
      {renderFichaContenido(
        isAdmin,
        `Modo Activo: ${isAdmin ? "Administrador (Ficha completa editable)" : "Bodeguero (Solo lectura, banco restringido)"}`
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
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 175,
  },
  cajaCalificacionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 6,
  },
  insigniaPuntaje: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  insigniaPuntajeVacia: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
  },
  insigniaPuntajeTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b45309",
    textTransform: "uppercase",
  },
  insigniaPuntajeTextoVacia: {
    color: "#64748b",
  },
  calificacionFilaEstrellas: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  estrellasContenedor: {
    flexDirection: "row",
    alignItems: "center",
  },
  estrellaIcono: {
    fontSize: 18,
    color: "#f59e0b",
    marginRight: 6,
  },
  calificacionEtiqueta: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
    textTransform: "uppercase",
  },
  calificacionValor: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  calificacionEscala: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  calificacionConteoTexto: {
    fontSize: 10,
    fontWeight: "600",
    color: "#78350f",
    marginTop: 2,
  },
  seccionEvaluacionesH15: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  encabezadoEvaluaciones: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  tituloEvaluaciones: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
  },
  criteriosCuadricula: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  criterioItem: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  criterioIcono: {
    fontSize: 18,
    marginBottom: 2,
  },
  criterioTitulo: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  },
  criterioSub: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
    marginTop: 1,
  },
  cajaSinEvaluaciones: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 10,
  },
  textoSinEvaluaciones: {
    fontSize: 11,
    color: "#92400e",
    flex: 1,
  },
  tarjetaOcCalificada: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 10,
  },
  calificacionPuntajeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  desgloseCriterioTexto: {
    fontSize: 11,
    color: "#475569",
  },
  comentarioEvaluacionTexto: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#334155",
    marginTop: 4,
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 6,
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
