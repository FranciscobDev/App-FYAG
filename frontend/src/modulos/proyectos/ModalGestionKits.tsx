import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { formatearCLP } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { KitProyecto } from "@/nucleo/tipos";
import {
  ArticuloDisponible,
  FormularioKit,
  ItemFormularioKit,
  actualizarKit,
  crearKit,
  eliminarKit,
  listarArticulosParaKit,
  listarKits,
} from "./kitsApi";

interface PropiedadesModalGestionKits {
  visible: boolean;
  onClose: () => void;
  onKitSeleccionadoParaProyecto?: (kit: KitProyecto) => void;
  onKitsActualizados?: () => void;
}

const CATEGORIAS_KIT = ["Climatización", "Eléctrico", "Materiales", "Equipos", "Seguridad"];

export const ModalGestionKits: React.FC<PropiedadesModalGestionKits> = ({
  visible,
  onClose,
  onKitSeleccionadoParaProyecto,
  onKitsActualizados,
}) => {
  const [kits, establecerKits] = useState<KitProyecto[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [busqueda, establecerBusqueda] = useState("");
  const [filtroCategoria, establecerFiltroCategoria] = useState("Todas");

  // Estado del formulario de creación/edición
  const [modoFormulario, establecerModoFormulario] = useState(false);
  const [editandoKitId, establecerEditandoKitId] = useState<number | null>(null);
  const [formNombre, establecerFormNombre] = useState("");
  const [formDescripcion, establecerFormDescripcion] = useState("");
  const [formCategoria, establecerFormCategoria] = useState(CATEGORIAS_KIT[0]);
  const [formItems, establecerFormItems] = useState<ItemFormularioKit[]>([]);
  const [errorForm, establecerErrorForm] = useState("");
  const [guardando, establecerGuardando] = useState(false);

  // Selector de insumos para agregar al kit
  const [articulosDisponibles, establecerArticulosDisponibles] = useState<ArticuloDisponible[]>([]);
  const [busquedaArticulo, establecerBusquedaArticulo] = useState("");
  const [articuloSeleccionado, establecerArticuloSeleccionado] = useState<ArticuloDisponible | null>(null);
  const [cantidadNueva, establecerCantidadNueva] = useState("1");
  const [modalSelectorInsumo, establecerModalSelectorInsumo] = useState(false);

  // Kits expandidos para ver detalle
  const [expandidos, establecerExpandidos] = useState<Record<number, boolean>>({});

  const cargarDatos = async () => {
    establecerCargando(true);
    const [resKits, arts] = await Promise.all([listarKits(), listarArticulosParaKit()]);
    if (resKits.ok && resKits.data) {
      establecerKits(resKits.data);
    }
    establecerArticulosDisponibles(arts);
    establecerCargando(false);
  };

  useEffect(() => {
    if (visible) {
      cargarDatos();
      establecerModoFormulario(false);
      establecerErrorForm("");
    }
  }, [visible]);

  const toggleExpandir = (id: number) => {
    establecerExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtrado de kits en la vista principal
  const kitsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return kits.filter((k) => {
      if (filtroCategoria !== "Todas" && (k.categoria ?? "").toLowerCase() !== filtroCategoria.toLowerCase()) {
        return false;
      }
      if (q) {
        const coincide =
          k.nombre_kit.toLowerCase().includes(q) ||
          (k.descripcion_kit ?? "").toLowerCase().includes(q) ||
          (k.categoria ?? "").toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [kits, busqueda, filtroCategoria]);

  // Artículos filtrados para el selector
  const articulosFiltrados = useMemo(() => {
    const q = busquedaArticulo.trim().toLowerCase();
    if (!q) return articulosDisponibles.slice(0, 20);
    return articulosDisponibles.filter(
      (a) =>
        a.nombre_articulo.toLowerCase().includes(q) ||
        (a.sku ?? "").toLowerCase().includes(q) ||
        (a.categoria ?? "").toLowerCase().includes(q)
    );
  }, [articulosDisponibles, busquedaArticulo]);

  // Costo total acumulado en el formulario
  const costoTotalFormulario = useMemo(() => {
    return formItems.reduce((acc, item) => acc + item.cantidad_requerida_kit * item.precio_unitario, 0);
  }, [formItems]);

  const abrirNuevoKit = () => {
    establecerEditandoKitId(null);
    establecerFormNombre("");
    establecerFormDescripcion("");
    establecerFormCategoria(CATEGORIAS_KIT[0]);
    establecerFormItems([]);
    establecerErrorForm("");
    establecerModoFormulario(true);
  };

  const abrirEditarKit = (kit: KitProyecto) => {
    establecerEditandoKitId(kit.id_kit_proyecto);
    establecerFormNombre(kit.nombre_kit);
    establecerFormDescripcion(kit.descripcion_kit ?? "");
    establecerFormCategoria(kit.categoria ?? CATEGORIAS_KIT[0]);
    establecerFormItems(
      kit.items.map((it) => ({
        id_articulo: it.id_articulo,
        nombre_articulo: it.nombre_articulo,
        sku: it.sku,
        precio_unitario: it.precio_unitario,
        cantidad_requerida_kit: it.cantidad_requerida_kit,
        subtotal: it.subtotal ?? it.cantidad_requerida_kit * it.precio_unitario,
      }))
    );
    establecerErrorForm("");
    establecerModoFormulario(true);
  };

  const agregarInsumoAlKit = () => {
    if (!articuloSeleccionado) {
      establecerErrorForm("Seleccione un insumo de la lista");
      return;
    }
    const cant = parseFloat(cantidadNueva);
    if (isNaN(cant) || cant <= 0) {
      establecerErrorForm("Ingrese una cantidad válida mayor a 0");
      return;
    }

    // Verificar si ya existe en el kit
    const yaExiste = formItems.some((it) => it.id_articulo === articuloSeleccionado.id_articulo);
    if (yaExiste) {
      establecerFormItems((prev) =>
        prev.map((it) =>
          it.id_articulo === articuloSeleccionado.id_articulo
            ? {
              ...it,
              cantidad_requerida_kit: it.cantidad_requerida_kit + cant,
              subtotal: (it.cantidad_requerida_kit + cant) * it.precio_unitario,
            }
            : it
        )
      );
    } else {
      const nuevoItem: ItemFormularioKit = {
        id_articulo: articuloSeleccionado.id_articulo,
        nombre_articulo: articuloSeleccionado.nombre_articulo,
        sku: articuloSeleccionado.sku,
        precio_unitario: articuloSeleccionado.precio_unitario,
        cantidad_requerida_kit: cant,
        subtotal: Math.round(cant * articuloSeleccionado.precio_unitario),
      };
      establecerFormItems((prev) => [...prev, nuevoItem]);
    }

    establecerArticuloSeleccionado(null);
    establecerCantidadNueva("1");
    establecerErrorForm("");
    establecerModalSelectorInsumo(false);
  };

  const quitarInsumo = (idArticulo: number) => {
    establecerFormItems((prev) => prev.filter((it) => it.id_articulo !== idArticulo));
  };

  const modificarCantidadItem = (idArticulo: number, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      quitarInsumo(idArticulo);
      return;
    }
    establecerFormItems((prev) =>
      prev.map((it) =>
        it.id_articulo === idArticulo
          ? {
            ...it,
            cantidad_requerida_kit: nuevaCantidad,
            subtotal: Math.round(nuevaCantidad * it.precio_unitario),
          }
          : it
      )
    );
  };

  const guardarKit = async () => {
    if (!formNombre.trim()) {
      establecerErrorForm("El nombre del kit es obligatorio");
      return;
    }
    if (formItems.length === 0) {
      establecerErrorForm("Debe agregar al menos un insumo al kit");
      return;
    }

    const payload: FormularioKit = {
      nombre_kit: formNombre.trim(),
      descripcion_kit: formDescripcion.trim() || null,
      categoria: formCategoria,
      disponible_kit: 1,
      items: formItems,
    };

    establecerGuardando(true);
    let res;
    if (editandoKitId) {
      res = await actualizarKit(editandoKitId, payload);
    } else {
      res = await crearKit(payload);
    }
    establecerGuardando(false);

    if (res.ok) {
      establecerModoFormulario(false);
      await cargarDatos();
      if (onKitsActualizados) onKitsActualizados();
    } else {
      establecerErrorForm(res.error ?? "Error al guardar el kit");
    }
  };

  const confirmarEliminar = (kit: KitProyecto) => {
    const ejecutar = async () => {
      const res = await eliminarKit(kit.id_kit_proyecto);
      if (res.ok) {
        await cargarDatos();
        if (onKitsActualizados) onKitsActualizados();
      }
    };

    const mensaje = `¿Eliminar el kit "${kit.nombre_kit}"?`;
    if (Platform.OS === "web") {
      if (window.confirm(mensaje)) ejecutar();
      return;
    }
    Alert.alert("Eliminar Kit", mensaje, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: ejecutar },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCaja}>
          {/* ENCABEZADO */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTagFila}>
                <Ionicons name="cube-outline" size={20} color={tema.colors.primary} />
                <Text style={styles.headerTagTexto}>CONFIGURACIÓN DE PROYECTOS</Text>
              </View>
              <Text style={styles.modalTitulo}>
                {modoFormulario
                  ? editandoKitId
                    ? "Editar Kit Predeterminado"
                    : "Crear Nuevo Kit Predeterminado"
                  : "Kits Predeterminados para Proyectos"}
              </Text>
              <Text style={styles.modalSubtitulo}>
                {modoFormulario
                  ? "Define los insumos y cantidades requeridas para calcular el presupuesto automático."
                  : "Crea y administra kits de insumos estandarizados para asignarlos al crear proyectos."}
              </Text>
            </View>

            <TouchableOpacity style={styles.cerrarBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color={tema.colors.text} />
            </TouchableOpacity>
          </View>

          {/* CUERPO: MODO LISTA vs MODO FORMULARIO */}
          {!modoFormulario ? (
            // ==================== LISTA DE KITS ====================
            <View style={{ flex: 1 }}>
              {/* Barra de Búsqueda y Botón Nuevo */}
              <View style={styles.barraAcciones}>
                <View style={styles.buscador}>
                  <Ionicons name="search" size={16} color={tema.colors.textMuted} />
                  <TextInput
                    style={styles.buscadorInput}
                    placeholder="Buscar kits por nombre o categoría..."
                    placeholderTextColor={tema.colors.textMuted}
                    value={busqueda}
                    onChangeText={establecerBusqueda}
                  />
                  {Boolean(busqueda) && (
                    <TouchableOpacity onPress={() => establecerBusqueda("")}>
                      <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={styles.btnNuevoKit} onPress={abrirNuevoKit}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.btnNuevoKitTexto}>+ Nuevo Kit</Text>
                </TouchableOpacity>
              </View>

              {/* Filtro por Categorías */}
              <View style={styles.categoriasFila}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {["Todas", ...CATEGORIAS_KIT].map((cat) => {
                    const activo = filtroCategoria === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => establecerFiltroCategoria(cat)}
                        style={[styles.categoriaChip, activo && styles.categoriaChipActiva]}
                      >
                        <Text style={[styles.categoriaChipTexto, activo && styles.categoriaChipTextoActiva]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Listado */}
              {cargando ? (
                <View style={styles.cargandoCont}>
                  <ActivityIndicator size="large" color={tema.colors.primary} />
                  <Text style={styles.cargandoTexto}>Cargando kits predeterminados...</Text>
                </View>
              ) : kitsFiltrados.length === 0 ? (
                <View style={styles.vacioCont}>
                  <Ionicons name="cube-outline" size={48} color={tema.colors.textMuted} />
                  <Text style={styles.vacioTitulo}>No hay kits registrados</Text>
                  <Text style={styles.vacioDesc}>
                    Crea tu primer kit predeterminado para acelerar la asignación de presupuestos.
                  </Text>
                  <TouchableOpacity style={[styles.btnNuevoKit, { marginTop: 12 }]} onPress={abrirNuevoKit}>
                    <Text style={styles.btnNuevoKitTexto}>Crear Primer Kit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.scrollLista} contentContainerStyle={{ paddingBottom: 24 }}>
                  {kitsFiltrados.map((k) => {
                    const expandido = Boolean(expandidos[k.id_kit_proyecto]);
                    return (
                      <View key={k.id_kit_proyecto} style={styles.tarjetaKit}>
                        <View style={styles.tarjetaHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.tarjetaTopFila}>
                              <View style={styles.categoriaInsignia}>
                                <Text style={styles.categoriaInsigniaTexto}>{k.categoria ?? "Materiales"}</Text>
                              </View>
                              <View style={styles.articulosBadge}>
                                <Ionicons name="layers-outline" size={12} color="#4b5563" />
                                <Text style={styles.articulosBadgeTexto}>
                                  {k.items.length} {k.items.length === 1 ? "insumo" : "insumos"}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.tarjetaTitulo}>{k.nombre_kit}</Text>
                            {Boolean(k.descripcion_kit) && (
                              <Text style={styles.tarjetaDesc} numberOfLines={expandido ? undefined : 2}>
                                {k.descripcion_kit}
                              </Text>
                            )}
                          </View>

                          <View style={styles.tarjetaCostoBox}>
                            <Text style={styles.tarjetaCostoLabel}>Costo Presupuestado</Text>
                            <Text style={styles.tarjetaCostoValor}>
                              {formatearCLP(k.costo_total ?? 0)}
                            </Text>
                          </View>
                        </View>

                        {/* Desglose de insumos (Expandible) */}
                        {expandido && (
                          <View style={styles.desgloseContenedor}>
                            <Text style={styles.desgloseTitulo}>Insumos incluidos en el kit:</Text>
                            {k.items.map((it, idx) => (
                              <View key={idx} style={styles.desgloseFila}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.desgloseItemNombre}>{it.nombre_articulo}</Text>
                                  <Text style={styles.desgloseItemSku}>
                                    SKU: {it.sku ?? "S/N"} · Cantidad: {it.cantidad_requerida_kit}
                                  </Text>
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
                                  <Text style={styles.desgloseItemSubtotal}>
                                    {formatearCLP(it.subtotal ?? it.cantidad_requerida_kit * it.precio_unitario)}
                                  </Text>
                                  <Text style={styles.desgloseItemUnitario}>
                                    ({formatearCLP(it.precio_unitario)} c/u)
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Botones de acción de la tarjeta */}
                        <View style={styles.tarjetaFooter}>
                          <TouchableOpacity
                            style={styles.btnExpandir}
                            onPress={() => toggleExpandir(k.id_kit_proyecto)}
                          >
                            <Ionicons
                              name={expandido ? "chevron-up" : "chevron-down"}
                              size={16}
                              color={tema.colors.primary}
                            />
                            <Text style={styles.btnExpandirTexto}>
                              {expandido ? "Ocultar insumos" : "Ver insumos incluidos"}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.tarjetaBotonesAccion}>
                            {onKitSeleccionadoParaProyecto && (
                              <TouchableOpacity
                                style={styles.btnAsignar}
                                onPress={() => {
                                  onKitSeleccionadoParaProyecto(k);
                                  onClose();
                                }}
                              >
                                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                                <Text style={styles.btnAsignarTexto}>Asignar al Proyecto</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.btnEditarIcono}
                              onPress={() => abrirEditarKit(k)}
                            >
                              <Ionicons name="create-outline" size={16} color={tema.colors.text} />
                              <Text style={styles.btnEditarTexto}>Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.btnEliminarIcono}
                              onPress={() => confirmarEliminar(k)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#dc2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            // ==================== FORMULARIO DE KIT ====================
            <ScrollView style={styles.scrollForm} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.formSeccion}>
                <Text style={styles.formSeccionTitulo}>1. Datos Generales del Kit</Text>

                <Text style={styles.label}>Nombre del Kit Predeterminado *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Kit Climatización Split 18.000 BTU"
                  placeholderTextColor={tema.colors.textMuted}
                  value={formNombre}
                  onChangeText={(t) => {
                    establecerFormNombre(t);
                    if (errorForm) establecerErrorForm("");
                  }}
                />

                <Text style={styles.label}>Categoría *</Text>
                <View style={styles.categoriasFormFila}>
                  {CATEGORIAS_KIT.map((c) => {
                    const activo = formCategoria === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => establecerFormCategoria(c)}
                        style={[styles.categoriaChip, activo && styles.categoriaChipActiva]}
                      >
                        <Text style={[styles.categoriaChipTexto, activo && styles.categoriaChipTextoActiva]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Descripción / Alcance</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: "top" }]}
                  placeholder="Detalles sobre en qué tipo de proyecto o faena se sugiere aplicar este kit..."
                  placeholderTextColor={tema.colors.textMuted}
                  multiline
                  value={formDescripcion}
                  onChangeText={establecerFormDescripcion}
                />
              </View>

              {/* SECCIÓN 2: INSUMOS Y CANTIDADES */}
              <View style={styles.formSeccion}>
                <View style={styles.insumosHeaderFila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formSeccionTitulo}>2. Insumos y Cantidades del Kit</Text>
                    <Text style={styles.formSeccionDesc}>
                      Agrega los insumos que componen este kit y sus cantidades requeridas.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnAgregarInsumoModal}
                    onPress={() => {
                      establecerBusquedaArticulo("");
                      establecerModalSelectorInsumo(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text style={styles.btnAgregarInsumoModalTexto}>+ Agregar Insumo</Text>
                  </TouchableOpacity>
                </View>

                {formItems.length === 0 ? (
                  <View style={styles.insumosVaciosCaja}>
                    <Ionicons name="bag-add-outline" size={32} color={tema.colors.textMuted} />
                    <Text style={styles.insumosVaciosTexto}>Aún no has agregado insumos a este kit</Text>
                    <Text style={styles.insumosVaciosSubtexto}>
                      Presiona "+ Agregar Insumo" para seleccionar artículos del catálogo y definir sus cantidades.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tablaInsumos}>
                    {formItems.map((it) => (
                      <View key={it.id_articulo} style={styles.filaInsumoItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.filaInsumoNombre}>{it.nombre_articulo}</Text>
                          <Text style={styles.filaInsumoDetalle}>
                            SKU: {it.sku ?? "S/N"} · Precio unitario: {formatearCLP(it.precio_unitario)}
                          </Text>
                        </View>

                        {/* Control de cantidad */}
                        <View style={styles.controlCantidadFila}>
                          <TouchableOpacity
                            style={styles.btnPasoCantidad}
                            onPress={() => modificarCantidadItem(it.id_articulo, it.cantidad_requerida_kit - 1)}
                          >
                            <Ionicons name="remove" size={14} color={tema.colors.text} />
                          </TouchableOpacity>

                          <TextInput
                            style={styles.inputCantidad}
                            keyboardType="numeric"
                            value={String(it.cantidad_requerida_kit)}
                            onChangeText={(val) => {
                              const num = parseFloat(val);
                              modificarCantidadItem(it.id_articulo, isNaN(num) ? 0 : num);
                            }}
                          />

                          <TouchableOpacity
                            style={styles.btnPasoCantidad}
                            onPress={() => modificarCantidadItem(it.id_articulo, it.cantidad_requerida_kit + 1)}
                          >
                            <Ionicons name="add" size={14} color={tema.colors.text} />
                          </TouchableOpacity>
                        </View>

                        {/* Subtotal del insumo */}
                        <View style={styles.columnaSubtotal}>
                          <Text style={styles.subtotalValor}>
                            {formatearCLP(it.cantidad_requerida_kit * it.precio_unitario)}
                          </Text>
                        </View>

                        {/* Quitar */}
                        <TouchableOpacity
                          style={styles.btnQuitarInsumo}
                          onPress={() => quitarInsumo(it.id_articulo)}
                        >
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* BANNER DE TOTAL CALCULADO EN TIEMPO REAL */}
                <View style={styles.bannerCostoCalculado}>
                  <View style={styles.bannerCostoIcono}>
                    <Ionicons name="calculator-outline" size={24} color="#065f46" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerCostoTitulo}>Presupuesto de Materiales Calculado</Text>
                    <Text style={styles.bannerCostoSub}>
                      {formItems.length} {formItems.length === 1 ? "insumo asignado" : "insumos asignados"} al kit
                    </Text>
                  </View>
                  <Text style={styles.bannerCostoMonto}>{formatearCLP(costoTotalFormulario)}</Text>
                </View>
              </View>

              {Boolean(errorForm) && (
                <View style={styles.errorCaja}>
                  <Ionicons name="alert-circle" size={18} color="#dc2626" />
                  <Text style={styles.errorTexto}>{errorForm}</Text>
                </View>
              )}

              {/* BOTONES FORMULARIO */}
              <View style={styles.formBotonesFila}>
                <TouchableOpacity
                  style={styles.btnCancelarForm}
                  onPress={() => establecerModoFormulario(false)}
                  disabled={guardando}
                >
                  <Text style={styles.btnCancelarFormTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnGuardarForm, guardando && { opacity: 0.7 }]}
                  onPress={guardarKit}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" />
                      <Text style={styles.btnGuardarFormTexto}>
                        {editandoKitId ? "Guardar Cambios" : "Guardar Kit Predeterminado"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ==================== SELECTOR MODAL DE INSUMO ==================== */}
          <Modal
            visible={modalSelectorInsumo}
            transparent
            animationType="fade"
            onRequestClose={() => establecerModalSelectorInsumo(false)}
          >
            <View style={styles.overlayInterno}>
              <View style={styles.selectorCaja}>
                <View style={styles.selectorHeader}>
                  <Text style={styles.selectorTitulo}>Seleccionar Insumo del Catálogo</Text>
                  <TouchableOpacity onPress={() => establecerModalSelectorInsumo(false)}>
                    <Ionicons name="close" size={20} color={tema.colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Buscador de artículos */}
                <View style={styles.buscador}>
                  <Ionicons name="search" size={16} color={tema.colors.textMuted} />
                  <TextInput
                    style={styles.buscadorInput}
                    placeholder="Buscar por nombre, SKU o categoría..."
                    placeholderTextColor={tema.colors.textMuted}
                    value={busquedaArticulo}
                    onChangeText={establecerBusquedaArticulo}
                    autoFocus
                  />
                </View>

                {/* Lista de artículos */}
                <ScrollView style={styles.selectorLista}>
                  {articulosFiltrados.map((art) => {
                    const seleccionado = articuloSeleccionado?.id_articulo === art.id_articulo;
                    return (
                      <TouchableOpacity
                        key={art.id_articulo}
                        style={[styles.selectorItem, seleccionado && styles.selectorItemActivo]}
                        onPress={() => establecerArticuloSeleccionado(art)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectorItemNombre, seleccionado && styles.selectorItemNombreActivo]}>
                            {art.nombre_articulo}
                          </Text>
                          <Text style={styles.selectorItemDetalle}>
                            SKU: {art.sku ?? "S/N"} · {art.categoria}
                          </Text>
                        </View>
                        <Text style={[styles.selectorItemPrecio, seleccionado && styles.selectorItemNombreActivo]}>
                          {formatearCLP(art.precio_unitario)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Cantidad requerida para este insumo */}
                {articuloSeleccionado && (
                  <View style={styles.cantidadSelectorCaja}>
                    <Text style={styles.cantidadSelectorLabel}>
                      Cantidad para "{articuloSeleccionado.nombre_articulo}":
                    </Text>
                    <View style={styles.cantidadInputFila}>
                      <TextInput
                        style={styles.inputCantidadGrande}
                        keyboardType="numeric"
                        value={cantidadNueva}
                        onChangeText={establecerCantidadNueva}
                      />
                      <Text style={styles.subtotalEnSelector}>
                        Subtotal:{" "}
                        {formatearCLP(
                          (parseFloat(cantidadNueva) || 0) * articuloSeleccionado.precio_unitario
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Botones del selector */}
                <View style={styles.selectorBotonesFila}>
                  <TouchableOpacity
                    style={styles.btnCancelarForm}
                    onPress={() => establecerModalSelectorInsumo(false)}
                  >
                    <Text style={styles.btnCancelarFormTexto}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btnGuardarForm,
                      !articuloSeleccionado && { opacity: 0.5 },
                    ]}
                    disabled={!articuloSeleccionado}
                    onPress={agregarInsumoAlKit}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.btnGuardarFormTexto}>Agregar al Kit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCaja: {
    width: "100%",
    maxWidth: 820,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: tema.radius.xl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  headerTagFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerTagTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.primary,
    letterSpacing: 0.6,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitulo: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  cerrarBtn: {
    padding: 6,
    borderRadius: 8,
  },
  barraAcciones: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    alignItems: "center",
  },
  buscador: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 13,
    color: "#1f2937",
  },
  btnNuevoKit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: tema.radius.md,
    justifyContent: "center",
  },
  btnNuevoKitTexto: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  categoriasFila: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  categoriaChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  categoriaChipActiva: {
    backgroundColor: tema.colors.primary,
  },
  categoriaChipTexto: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4b5563",
  },
  categoriaChipTextoActiva: {
    color: "#fff",
    fontWeight: "600",
  },
  scrollLista: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  cargandoCont: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cargandoTexto: {
    marginTop: 10,
    fontSize: 13,
    color: "#6b7280",
  },
  vacioCont: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  vacioTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
  },
  vacioDesc: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 340,
  },
  tarjetaKit: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: tema.radius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tarjetaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  tarjetaTopFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  categoriaInsignia: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  categoriaInsigniaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  articulosBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  articulosBadgeTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4b5563",
  },
  tarjetaTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  tarjetaDesc: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
  tarjetaCostoBox: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
    minWidth: 140,
  },
  tarjetaCostoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065f46",
    textTransform: "uppercase",
  },
  tarjetaCostoValor: {
    fontSize: 15,
    fontWeight: "800",
    color: "#047857",
    marginTop: 2,
  },
  desgloseContenedor: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
  },
  desgloseTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  desgloseFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  desgloseItemNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
  },
  desgloseItemSku: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  desgloseItemSubtotal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  desgloseItemUnitario: {
    fontSize: 10,
    color: "#6b7280",
  },
  tarjetaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  btnExpandir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  btnExpandirTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: tema.colors.primary,
  },
  tarjetaBotonesAccion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnAsignar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnAsignarTexto: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  btnEditarIcono: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  btnEditarTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  btnEliminarIcono: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  // ESTILOS FORMULARIO
  scrollForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  formSeccion: {
    marginBottom: 20,
  },
  formSeccionTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  formSeccionDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#fff",
  },
  categoriasFormFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  insumosHeaderFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  btnAgregarInsumoModal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
  },
  btnAgregarInsumoModalTexto: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  insumosVaciosCaja: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  insumosVaciosTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
  },
  insumosVaciosSubtexto: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 2,
    maxWidth: 320,
  },
  tablaInsumos: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  filaInsumoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 10,
  },
  filaInsumoNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
  },
  filaInsumoDetalle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  controlCantidadFila: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  btnPasoCantidad: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
  },
  inputCantidad: {
    width: 44,
    height: 30,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  columnaSubtotal: {
    minWidth: 84,
    alignItems: "flex-end",
  },
  subtotalValor: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  btnQuitarInsumo: {
    padding: 4,
  },
  bannerCostoCalculado: {
    marginTop: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#10b981",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerCostoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCostoTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
  bannerCostoSub: {
    fontSize: 11,
    color: "#047857",
  },
  bannerCostoMonto: {
    fontSize: 18,
    fontWeight: "800",
    color: "#047857",
  },
  errorCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorTexto: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600",
    flex: 1,
  },
  formBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  btnCancelarForm: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: tema.radius.md,
    borderWidth: 1,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnCancelarFormTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  btnGuardarForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.primary,
    justifyContent: "center",
  },
  btnGuardarFormTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  // ESTILOS SELECTOR INTERNO
  overlayInterno: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  selectorCaja: {
    width: "100%",
    maxWidth: 540,
    maxHeight: 520,
    backgroundColor: "#fff",
    borderRadius: tema.radius.lg,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  selectorTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  selectorLista: {
    maxHeight: 220,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
  },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  selectorItemActivo: {
    backgroundColor: "#eff6ff",
  },
  selectorItemNombre: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
  },
  selectorItemNombreActivo: {
    color: tema.colors.primary,
    fontWeight: "700",
  },
  selectorItemDetalle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  selectorItemPrecio: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  cantidadSelectorCaja: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  cantidadSelectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  cantidadInputFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputCantidadGrande: {
    width: 80,
    height: 38,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  subtotalEnSelector: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  selectorBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});

