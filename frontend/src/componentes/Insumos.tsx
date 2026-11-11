import React, { useState } from "react";
import {
  Modal,
  Platform,
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

// Lista simulada de SKUs ya existentes en el sistema para validar unicidad (fallback)
export const DEFAULT_EXISTING_SKUS = ["SKU-001", "SKU-002", "SKU-003"];

// Configuración de reglas por cada unidad de medida
export interface ConfigUnidad {
  label: string;
  permiteDecimales: boolean;
  step: string;
  unidadBase: string;
}

export const UNIDADES_CONFIG: { [key: string]: ConfigUnidad } = {
  unidad: {
    label: "Unidad (Sin decimales)",
    permiteDecimales: false,
    step: "1",
    unidadBase: "un",
  },
  pieza: {
    label: "Pieza (Sin decimales)",
    permiteDecimales: false,
    step: "1",
    unidadBase: "pieza",
  },
  kilogramos: {
    label: "Kilogramos (Con decimales)",
    permiteDecimales: true,
    step: "0.01",
    unidadBase: "kg",
  },
  gramos: {
    label: "Gramos (Sin decimales)",
    permiteDecimales: false,
    step: "1",
    unidadBase: "g",
  },
  litros: {
    label: "Litros (Con decimales)",
    permiteDecimales: true,
    step: "0.01",
    unidadBase: "l",
  },
};

export interface PropiedadesInsumoForm {
  /** Lista opcional de SKUs para validar unicidad. Si no se pasa, utiliza los productos del contexto o el fallback por defecto */
  existingSkus?: string[];
  /** Callback ejecutado al validar y guardar exitosamente */
  onSubmit?: (data: {
    nombre: string;
    sku: string;
    unidad: string;
    cantidad: number;
  }) => void | Promise<void>;
  /** Callback opcional de cancelación o cierre (por ejemplo si está dentro de un modal) */
  onCancel?: () => void;
  /** Datos iniciales en caso de edición */
  initialData?: Partial<{
    nombre: string;
    sku: string;
    unidad: string;
    cantidad: string | number;
  }>;
  /** Título del formulario */
  title?: string;
  /** Si debe persistir automáticamente en el Contexto de la Aplicación si está disponible */
  autoPersist?: boolean;
}

export function InsumoForm({
  existingSkus: customExistingSkus,
  onSubmit,
  onCancel,
  initialData,
  title = "Registro de Insumos",
  autoPersist = true,
}: PropiedadesInsumoForm = {}) {
  // Conectar con el contexto de la aplicación para obtener los SKUs reales registrados
  let productosDelContexto: any[] = [];
  let agregarProductoFn: any = null;

  try {
    const appContext = usarAplicacion();
    if (appContext) {
      productosDelContexto = appContext.productos || [];
      agregarProductoFn = appContext.agregarProducto;
    }
  } catch {
    // Si se monta fuera de ProveedorAplicacion (tests unitarios o componente aislado), opera con fallback
  }

  // Si se pasaron SKUs específicos por props se usan, sino los del contexto, sino los simulados por defecto
  const existingSkus =
    customExistingSkus ||
    (productosDelContexto.length > 0
      ? productosDelContexto.map((p) => String(p.sku || "").trim().toUpperCase())
      : DEFAULT_EXISTING_SKUS);

  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || "",
    sku: initialData?.sku || "",
    unidad: initialData?.unidad || "unidad",
    cantidad:
      initialData?.cantidad !== undefined ? String(initialData.cantidad) : "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [modalUnidadVisible, setModalUnidadVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const unidadActual =
    UNIDADES_CONFIG[formData.unidad] || {
      label: "Unidad (Sin decimales)",
      permiteDecimales: false,
      step: "1",
      unidadBase: "un",
    };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar errores del campo al escribir
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const handleSubmit = async () => {
    const newErrors: { [key: string]: string } = {};

    // 1. Validar nombre
    if (!formData.nombre.trim()) {
      newErrors.nombre = "El nombre del insumo es obligatorio.";
    }

    // 2. Validar SKU único
    const skuTrimmed = formData.sku.trim().toUpperCase();
    if (!skuTrimmed) {
      newErrors.sku = "El SKU es obligatorio.";
    } else if (existingSkus.includes(skuTrimmed)) {
      newErrors.sku = "Este SKU ya está registrado. Debe ser único.";
    }

    // 3. Validar cantidad según la unidad seleccionada
    if (!formData.cantidad.trim()) {
      newErrors.cantidad = "La cantidad es obligatoria.";
    } else {
      const num = Number(formData.cantidad);
      if (isNaN(num) || num <= 0) {
        newErrors.cantidad = "Debe ser un valor numérico mayor a 0.";
      } else if (!unidadActual.permiteDecimales && !Number.isInteger(num)) {
        newErrors.cantidad =
          "Esta unidad no permite decimales (ingrese un número entero).";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSuccessMessage("");
      return;
    }

    // Éxito en la validación
    const cantidadNum = Number(formData.cantidad);
    const datosFinales = {
      nombre: formData.nombre.trim(),
      sku: skuTrimmed,
      unidad: formData.unidad,
      cantidad: cantidadNum,
    };

    setGuardando(true);

    try {
      // Auto-persistencia en el catálogo general si está disponible
      if (autoPersist && agregarProductoFn) {
        await agregarProductoFn({
          sku: skuTrimmed,
          name: datosFinales.nombre,
          category: "Materiales",
          unit: unidadActual.unidadBase,
          stock: cantidadNum,
          minStock: 5,
          unitCost: 1000,
          pmp: 1000,
          location: "Bodega Principal - Insumos",
        });
      }

      if (onSubmit) {
        await onSubmit(datosFinales);
      }

      setSuccessMessage("¡Insumo creado/editado correctamente!");
      setErrors({});
      console.log("Datos enviados:", { ...formData, sku: skuTrimmed });
    } catch (err: any) {
      setErrors({ form: err?.message || "Ocurrió un error al guardar el insumo." });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={estilos.tarjetaContenedor}>
      {/* Encabezado */}
      <View style={estilos.encabezadoFila}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo}>{title}</Text>
          <Text style={estilos.subtitulo}>
            Control de SKU único y validación de magnitudes físicas
          </Text>
        </View>
        {onCancel ? (
          <TouchableOpacity
            onPress={onCancel}
            style={estilos.botonCerrar}
            accessibilityLabel="Cerrar formulario"
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Mensaje de Éxito */}
      {successMessage ? (
        <View style={estilos.cajaExito}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color="#15803d"
            style={{ marginRight: 8 }}
          />
          <Text style={estilos.textoExito}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Error Global */}
      {errors.form ? (
        <View style={estilos.cajaErrorGlobal}>
          <Ionicons
            name="alert-circle"
            size={18}
            color="#b91c1c"
            style={{ marginRight: 8 }}
          />
          <Text style={estilos.textoErrorGlobal}>{errors.form}</Text>
        </View>
      ) : null}

      <View style={estilos.formulario}>
        {/* Campo 1: Nombre */}
        <View style={estilos.grupoCampo}>
          <Text style={estilos.etiqueta}>
            Nombre <Text style={estilos.asterisco}>*</Text>
          </Text>
          <TextInput
            value={formData.nombre}
            onChangeText={(val: string) => handleChange("nombre", val)}
            onFocus={() => setFocusedField("nombre")}
            onBlur={() => setFocusedField(null)}
            placeholder="Ej. Harina de trigo"
            placeholderTextColor="#9ca3af"
            style={[
              estilos.entrada,
              focusedField === "nombre" ? estilos.entradaEnfocada : null,
              errors.nombre ? estilos.entradaError : null,
            ]}
          />
          {errors.nombre ? (
            <Text style={estilos.textoError}>{errors.nombre}</Text>
          ) : null}
        </View>

        {/* Campo 2: SKU */}
        <View style={estilos.grupoCampo}>
          <View style={estilos.etiquetaFila}>
            <Text style={estilos.etiqueta}>
              SKU (Único) <Text style={estilos.asterisco}>*</Text>
            </Text>
            <Text style={estilos.etiquetaAyuda}>Mayúsculas automáticas</Text>
          </View>
          <TextInput
            value={formData.sku}
            onChangeText={(val: string) => handleChange("sku", val.toUpperCase())}
            onFocus={() => setFocusedField("sku")}
            onBlur={() => setFocusedField(null)}
            placeholder="Ej. SKU-1001"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            style={[
              estilos.entrada,
              estilos.entradaSku,
              focusedField === "sku" ? estilos.entradaEnfocada : null,
              errors.sku ? estilos.entradaError : null,
            ]}
          />
          {errors.sku ? (
            <Text style={estilos.textoError}>{errors.sku}</Text>
          ) : null}
        </View>

        {/* Campo 3: Unidad de Medida */}
        <View style={estilos.grupoCampo}>
          <Text style={estilos.etiqueta}>Unidad de Medida</Text>
          <TouchableOpacity
            onPress={() => setModalUnidadVisible(true)}
            style={[
              estilos.selectorBoton,
              modalUnidadVisible ? estilos.entradaEnfocada : null,
            ]}
            activeOpacity={0.7}
          >
            <View style={estilos.selectorTextoFila}>
              <Text style={estilos.selectorTexto}>{unidadActual.label}</Text>
              <View
                style={[
                  estilos.insigniaPildora,
                  unidadActual.permiteDecimales
                    ? estilos.insigniaDecimal
                    : estilos.insigniaEntero,
                ]}
              >
                <Text
                  style={[
                    estilos.insigniaPildoraTexto,
                    unidadActual.permiteDecimales
                      ? estilos.insigniaDecimalTexto
                      : estilos.insigniaEnteroTexto,
                  ]}
                >
                  {unidadActual.permiteDecimales ? "Con decimales" : "Sin decimales"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Campo 4: Cantidad */}
        <View style={estilos.grupoCampo}>
          <Text style={estilos.etiqueta}>
            Cantidad ({formData.unidad}) <Text style={estilos.asterisco}>*</Text>
          </Text>
          <TextInput
            value={formData.cantidad}
            onChangeText={(val: string) => handleChange("cantidad", val)}
            onFocus={() => setFocusedField("cantidad")}
            onBlur={() => setFocusedField(null)}
            placeholder={unidadActual.permiteDecimales ? "Ej. 1.5" : "Ej. 10"}
            placeholderTextColor="#9ca3af"
            keyboardType={
              unidadActual.permiteDecimales
                ? Platform.OS === "ios"
                  ? "decimal-pad"
                  : "numeric"
                : "number-pad"
            }
            style={[
              estilos.entrada,
              focusedField === "cantidad" ? estilos.entradaEnfocada : null,
              errors.cantidad ? estilos.entradaError : null,
            ]}
          />
          <Text
            style={[
              estilos.textoAyuda,
              unidadActual.permiteDecimales
                ? estilos.textoAyudaDecimal
                : estilos.textoAyudaEntero,
            ]}
          >
            {unidadActual.permiteDecimales
              ? "✓ Permite valores con decimales."
              : "⚠ Solo números enteros para esta unidad."}
          </Text>
          {errors.cantidad ? (
            <Text style={estilos.textoError}>{errors.cantidad}</Text>
          ) : null}
        </View>

        {/* Botón de Acción */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={guardando}
          style={[estilos.botonGuardar, guardando ? estilos.botonDeshabilitado : null]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="save-outline"
            size={18}
            color="#ffffff"
            style={{ marginRight: 8 }}
          />
          <Text style={estilos.botonGuardarTexto}>
            {guardando ? "Guardando..." : "Guardar Insumo"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal para selección de unidad de medida */}
      <Modal
        visible={modalUnidadVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalUnidadVisible(false)}
      >
        <Pressable
          style={estilos.modalFondo}
          onPress={() => setModalUnidadVisible(false)}
        >
          <View style={estilos.modalContenido}>
            <View style={estilos.modalEncabezado}>
              <Text style={estilos.modalTitulo}>Seleccionar Unidad de Medida</Text>
              <TouchableOpacity onPress={() => setModalUnidadVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {Object.entries(UNIDADES_CONFIG).map(([key, config]) => {
                const isSelected = formData.unidad === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      handleChange("unidad", key);
                      setModalUnidadVisible(false);
                    }}
                    style={[
                      estilos.opcionItem,
                      isSelected ? estilos.opcionItemSeleccionado : null,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          estilos.opcionTexto,
                          isSelected ? estilos.opcionTextoSeleccionado : null,
                        ]}
                      >
                        {config.label}
                      </Text>
                      <Text style={estilos.opcionSubtexto}>
                        {config.permiteDecimales
                          ? "Permite valores fraccionarios (ej. 1.25)"
                          : "Solo cantidades enteras (ej. 1, 2, 5)"}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#2563eb"
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default InsumoForm;

const estilos = StyleSheet.create({
  tarjetaContenedor: {
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginVertical: 16,
  },
  encabezadoFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  botonCerrar: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  cajaExito: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
  },
  textoExito: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  cajaErrorGlobal: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  textoErrorGlobal: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  formulario: {
    gap: 16,
  },
  grupoCampo: {
    marginBottom: 2,
  },
  etiquetaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  etiquetaAyuda: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 6,
  },
  asterisco: {
    color: "#ef4444",
  },
  entrada: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "#ffffff",
  },
  entradaSku: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  entradaEnfocada: {
    borderColor: "#2563eb",
    borderWidth: 1.8,
  },
  entradaError: {
    borderColor: "#ef4444",
    borderWidth: 1.5,
    backgroundColor: "#fff5f5",
  },
  textoError: {
    fontSize: 11,
    color: "#ef4444",
    marginTop: 4,
    fontWeight: "500",
  },
  textoAyuda: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  textoAyudaDecimal: {
    color: "#059669",
  },
  textoAyudaEntero: {
    color: "#d97706",
  },
  selectorBoton: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  selectorTextoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  selectorTexto: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  insigniaPildora: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  insigniaDecimal: {
    backgroundColor: "#ecfdf5",
  },
  insigniaDecimalTexto: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "bold",
  },
  insigniaEntero: {
    backgroundColor: "#fef3c7",
  },
  insigniaEnteroTexto: {
    color: "#d97706",
    fontSize: 10,
    fontWeight: "bold",
  },
  insigniaPildoraTexto: {
    fontSize: 10,
  },
  botonGuardar: {
    width: "100%",
    height: 46,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  botonGuardarTexto: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContenido: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
  },
  opcionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  opcionItemSeleccionado: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  opcionTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  opcionTextoSeleccionado: {
    color: "#1d4ed8",
    fontWeight: "bold",
  },
  opcionSubtexto: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
});
