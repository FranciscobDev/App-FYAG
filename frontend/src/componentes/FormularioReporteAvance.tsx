import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Boton } from "@/componentes/base/Boton";
import { Insignia } from "@/componentes/base/Insignia";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { BarraProgreso } from "@/componentes/base/BarraProgreso";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { Producto, Proyecto, ReporteAvanceTecnico } from "@/nucleo/tipos";

export interface ItemInsumoReporte {
  sku: string;
  name: string;
  unit: string;
  quantityAssigned: number;
  quantityUsed: number;
  selected: boolean;
}

export interface PropiedadesFormularioReporteAvance {
  /** ID del proyecto preseleccionado al abrir el formulario */
  proyectoInicialId?: string;
  /** Porcentaje de avance inicial si se requiere forzar (ej. 50%) */
  avanceInicial?: number;
  /** Callback opcional al guardar exitosamente el avance */
  onGuardarAvance?: (reporte: Omit<ReporteAvanceTecnico, "id" | "syncStatus">) => void;
  /** Callback para cerrar cuando se utiliza en modal */
  onCerrar?: () => void;
  /** Callback con el nuevo porcentaje y código del proyecto tras guardar */
  onExito?: (nuevoPorcentaje: number, codigoProyecto: string) => void;
  /** Muestra la sección de historial de avances previos */
  mostrarHistorial?: boolean;
  /** Modo modal con botón de cierre en encabezado */
  modoModal?: boolean;
}

/**
 * [FRONT-2] Construir formulario móvil de reporte de avance con deslizador/input
 * de 0 a 100 %, campo de observaciones y selector de insumos asignados utilizados.
 * Permite enviar reportes rápidos desde terreno.
 * [SCRUM] Registra un avance del 50 % desde el celular y lo verifica en el proyecto.
 */
export const FormularioReporteAvance: React.FC<PropiedadesFormularioReporteAvance> = ({
  proyectoInicialId,
  avanceInicial,
  onGuardarAvance,
  onCerrar,
  onExito,
  mostrarHistorial = true,
  modoModal = false,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 768;

  const {
    proyectos,
    productos,
    reportesAvanceTecnico,
    crearReporteAvanceTecnico,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  // Filtrar proyectos asignados y que no estén cerrados
  const activoProyectos = useMemo(() => {
    return proyectos.filter(
      (p) =>
        p.status !== "cerrado" &&
        (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
    );
  }, [proyectos, usuario.rut]);

  // Selección de proyecto activo
  const [seleccionadoProyectoId, establecerSeleccionadoProyectoId] = useState<string>(
    proyectoInicialId || activoProyectos[0]?.id || ""
  );

  // Sincronizar si cambia la prop proyectoInicialId
  useEffect(() => {
    if (proyectoInicialId) {
      establecerSeleccionadoProyectoId(proyectoInicialId);
    } else if (activoProyectos.length > 0 && !seleccionadoProyectoId) {
      establecerSeleccionadoProyectoId(activoProyectos[0].id);
    }
  }, [proyectoInicialId, activoProyectos]);

  const actualProyecto = useMemo(() => {
    return activoProyectos.find((p) => p.id === seleccionadoProyectoId) || activoProyectos[0];
  }, [activoProyectos, seleccionadoProyectoId]);

  // =========================================================================
  // 1. ESTADO DE AVANCE (0-100%, SLIDER + INPUT NUMÉRICO + CHIPS RÁPIDOS)
  // =========================================================================
  const [avancePorcentaje, establecerAvancePorcentaje] = useState<number>(() => {
    if (typeof avanceInicial === "number") return avanceInicial;
    return actualProyecto?.progress ?? 50;
  });

  // Al cambiar de proyecto seleccionado, sincronizar con su avance actual
  useEffect(() => {
    if (actualProyecto && typeof avanceInicial !== "number") {
      establecerAvancePorcentaje(actualProyecto.progress);
    }
  }, [actualProyecto?.id]);

  // Si cambia avanceInicial desde fuera
  useEffect(() => {
    if (typeof avanceInicial === "number") {
      establecerAvancePorcentaje(avanceInicial);
    }
  }, [avanceInicial]);

  // =========================================================================
  // 2. CAMPO DE OBSERVACIONES Y COMENTARIOS DE TERRENO
  // =========================================================================
  const [observaciones, establecerObservaciones] = useState<string>(
    "Reporte de avance físico en terreno. Cuadrilla operativa en faena."
  );

  // Sugerencias rápidas para escribir con un solo toque desde móvil
  const sugerenciasRapidas = [
    "Avance al 50 % según cronograma",
    "Instalaciones eléctricas y tuberías montadas",
    "Pruebas de presión y sellado conformes",
    "Jornada en faena finalizada sin atrasos",
  ];

  // =========================================================================
  // 3. SELECTOR DE INSUMOS ASIGNADOS UTILIZADOS
  // =========================================================================
  const [listaInsumos, establecerListaInsumos] = useState<ItemInsumoReporte[]>([]);
  const [modalCatalogoVisible, establecerModalCatalogoVisible] = useState(false);
  const [filtroCatalogo, establecerFiltroCatalogo] = useState("");

  // Construir lista de insumos asignados a partir de los despachos del proyecto o catálogo clave
  useEffect(() => {
    if (!actualProyecto) {
      establecerListaInsumos([]);
      return;
    }

    const despachos = actualProyecto.dispatches || [];
    const asignadosPorSku: Record<string, { qty: number; name: string; unit: string }> = {};

    despachos.forEach((d) => {
      if (!asignadosPorSku[d.sku]) {
        asignadosPorSku[d.sku] = { qty: 0, name: d.productName, unit: d.unit };
      }
      asignadosPorSku[d.sku].qty += d.quantity;
    });

    // Insumos base típicos según tipo de proyecto si no hay despachos suficientes
    const baseItems = [
      { sku: "GAS-TUB-0020", name: "Tubo cobre tipo L 3/4\" 6 m", unit: "un", defaultQty: 80 },
      { sku: "CLI-GAS-R410", name: "Gas refrigerante R410A 11,3 kg", unit: "cilindro", defaultQty: 12 },
      { sku: "ELE-CBL-0012", name: "Cable THHN 12 AWG rollo 100 m", unit: "rollo", defaultQty: 6 },
      { sku: "FER-PER-0008", name: "Perno anclaje 8 mm x 80", unit: "caja", defaultQty: 10 },
      { sku: "ELE-DIS-0016", name: "Disyuntor termomagnético 16 A", unit: "un", defaultQty: 25 },
    ];

    const combinados: ItemInsumoReporte[] = baseItems.map((item, idx) => {
      const despachado = asignadosPorSku[item.sku]?.qty;
      const cantAsignada = despachado !== undefined && despachado > 0 ? despachado : item.defaultQty;
      // Pre-seleccionar los dos primeros como demo interactiva
      const esInicialSeleccionado = idx === 0 || idx === 2;
      return {
        sku: item.sku,
        name: asignadosPorSku[item.sku]?.name || item.name,
        unit: asignadosPorSku[item.sku]?.unit || item.unit,
        quantityAssigned: cantAsignada,
        quantityUsed: esInicialSeleccionado ? (idx === 0 ? 6 : 1) : 0,
        selected: esInicialSeleccionado,
      };
    });

    establecerListaInsumos(combinados);
  }, [actualProyecto?.id]);

  // Alternar selección de un insumo
  const toggleSeleccionInsumo = (sku: string) => {
    establecerListaInsumos((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        const nuevoSeleccionado = !item.selected;
        return {
          ...item,
          selected: nuevoSeleccionado,
          quantityUsed: nuevoSeleccionado ? (item.quantityUsed > 0 ? item.quantityUsed : 1) : 0,
        };
      })
    );
  };

  // Ajustar cantidad utilizada de un insumo
  const ajustarCantidadInsumo = (sku: string, delta: number) => {
    establecerListaInsumos((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        const nueva = Math.max(0, item.quantityUsed + delta);
        return {
          ...item,
          quantityUsed: nueva,
          selected: nueva > 0,
        };
      })
    );
  };

  // Establecer cantidad directa por input
  const cambiarCantidadInsumoDirecta = (sku: string, texto: string) => {
    const limpio = texto.replace(/[^0-9]/g, "");
    const valor = limpio === "" ? 0 : parseInt(limpio, 10);
    establecerListaInsumos((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;
        return {
          ...item,
          quantityUsed: isNaN(valor) ? 0 : valor,
          selected: valor > 0,
        };
      })
    );
  };

  // Agregar insumo extra desde catálogo
  const agregarInsumoDesdeCatalogo = (prod: Producto) => {
    if (listaInsumos.some((i) => i.sku === prod.sku)) {
      toggleSeleccionInsumo(prod.sku);
    } else {
      establecerListaInsumos((prev) => [
        ...prev,
        {
          sku: prod.sku,
          name: prod.name,
          unit: prod.unit,
          quantityAssigned: prod.stock || 10,
          quantityUsed: 1,
          selected: true,
        },
      ]);
    }
    establecerModalCatalogoVisible(false);
  };

  // =========================================================================
  // 4. CONTROL DE PORCENTAJE (DESLIZADOR / STEPPER / INPUT)
  // =========================================================================
  const manejarAjustarPorcentaje = (delta: number) => {
    establecerAvancePorcentaje((prev) => Math.max(0, Math.min(100, prev + delta)));
  };

  const manejarCambioTextoPorcentaje = (texto: string) => {
    const limpio = texto.replace(/[^0-9]/g, "");
    if (limpio === "") {
      establecerAvancePorcentaje(0);
      return;
    }
    const num = parseInt(limpio, 10);
    if (!isNaN(num)) {
      establecerAvancePorcentaje(Math.max(0, Math.min(100, num)));
    }
  };

  // =========================================================================
  // 5. ENVÍO Y GUARDADO DEL REPORTE
  // =========================================================================
  const [guardando, establecerGuardando] = useState(false);
  const [mensajeExito, establecerMensajeExito] = useState<string>("");
  const [mensajeError, establecerMensajeError] = useState<string>("");

  const insumosSeleccionados = useMemo(() => {
    return listaInsumos
      .filter((i) => i.selected && i.quantityUsed > 0)
      .map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantityUsed,
        unit: i.unit,
      }));
  }, [listaInsumos]);

  const manejarGuardar = () => {
    establecerMensajeError("");
    establecerMensajeExito("");

    if (!actualProyecto) {
      establecerMensajeError("Debes seleccionar una faena o proyecto para enviar el reporte.");
      return;
    }

    if (!observaciones.trim()) {
      establecerMensajeError("Por favor, ingresa una observación o comentario del trabajo realizado.");
      return;
    }

    establecerGuardando(true);

    const payload: Omit<ReporteAvanceTecnico, "id" | "syncStatus"> = {
      projectId: actualProyecto.id,
      projectCode: actualProyecto.code,
      projectName: actualProyecto.name,
      date: new Date().toISOString().slice(0, 10),
      progressPct: avancePorcentaje,
      comments: observaciones.trim(),
      materialsUsed: insumosSeleccionados,
    };

    try {
      if (onGuardarAvance) {
        onGuardarAvance(payload);
      } else {
        crearReporteAvanceTecnico(payload);
      }

      const textoConfirmacion = `✓ ¡Avance del ${avancePorcentaje}% guardado exitosamente para ${actualProyecto.code}!`;
      establecerMensajeExito(textoConfirmacion);

      if (onExito) {
        onExito(avancePorcentaje, actualProyecto.code);
      }

      // Si es modal, cerrar tras breve animación
      if (modoModal && onCerrar) {
        setTimeout(() => {
          onCerrar();
        }, 1200);
      } else {
        setTimeout(() => {
          establecerMensajeExito("");
        }, 4500);
      }
    } catch {
      establecerMensajeError("Ocurrió un error al guardar el reporte de avance.");
    } finally {
      establecerGuardando(false);
    }
  };

  // Tono visual dinámico según el porcentaje
  const colorProgreso = useMemo(() => {
    if (avancePorcentaje >= 80) return tema.colors.ok;
    if (avancePorcentaje >= 50) return tema.colors.primary;
    if (avancePorcentaje >= 25) return tema.colors.warn;
    return tema.colors.textMuted;
  }, [avancePorcentaje]);

  // Historial de reportes asociados al proyecto actual
  const historialProyecto = useMemo(() => {
    if (!actualProyecto) return [];
    return reportesAvanceTecnico.filter((r) => r.projectId === actualProyecto.id);
  }, [reportesAvanceTecnico, actualProyecto?.id]);

  // Productos del catálogo filtrados para modal de agregar insumo
  const productosFiltrados = useMemo(() => {
    const q = filtroCatalogo.trim().toLowerCase();
    return productos.filter(
      (p) =>
        !p.disabled &&
        (p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q))
    );
  }, [productos, filtroCatalogo]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={estilos.contenedor}
    >
      <ScrollView
        style={estilos.scrollView}
        contentContainerStyle={estilos.scrollContenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO DEL FORMULARIO */}
        <View style={estilos.encabezado}>
          <View style={{ flex: 1 }}>
            <View style={estilos.etiquetaTicketFila}>
              <Insignia label="Terreno Móvil" tone="mute" size="sm" />
            </View>
            <Text style={estilos.titulo}>Reporte de Avance en Terreno</Text>
            <Text style={estilos.subtitulo}>
              Registra el progreso físico de la faena y los insumos utilizados
            </Text>
          </View>

          {modoModal && onCerrar && (
            <TouchableOpacity
              onPress={onCerrar}
              style={estilos.botonCerrarModal}
              accessibilityLabel="Cerrar formulario"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={tema.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 1. SELECTOR DE FAENA / PROYECTO */}
        <View style={estilos.bloque}>
          <Text style={estilos.bloqueEtiqueta}>
            1. Seleccionar Proyecto o Faena:
          </Text>
          {activoProyectos.length === 0 ? (
            <EstadoVacio
              icon="folder-open-outline"
              title="Sin faenas activas"
              description="No tienes proyectos asignados actualmente para reportar avance."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={estilos.proyectosChipsScroll}
            >
              {activoProyectos.map((p) => {
                const esActivo = p.id === actualProyecto?.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => establecerSeleccionadoProyectoId(p.id)}
                    style={[
                      estilos.proyectoChip,
                      esActivo && estilos.proyectoChipActivo,
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: esActivo }}
                  >
                    <View style={estilos.proyectoChipCabecera}>
                      <Text
                        style={[
                          estilos.proyectoChipCodigo,
                          esActivo && estilos.proyectoChipCodigoActivo,
                        ]}
                      >
                        {p.code}
                      </Text>
                      <Insignia
                        label={`${p.progress}%`}
                        tone={p.progress >= 50 ? "ok" : "warn"}
                        size="sm"
                      />
                    </View>
                    <Text
                      style={[
                        estilos.proyectoChipNombre,
                        esActivo && estilos.proyectoChipNombreActivo,
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={[
                        estilos.proyectoChipCliente,
                        esActivo && estilos.proyectoChipClienteActivo,
                      ]}
                      numberOfLines={1}
                    >
                      {p.client}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {actualProyecto && (
          <>
            {/* 2. CONTROLADOR DE AVANCE (DESLIZADOR / INPUT / CHIPS 0-100%) */}
            <Tarjeta variant="elevated" style={estilos.tarjetaAvance}>
              <View style={estilos.tarjetaAvanceCabecera}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.tarjetaAvanceTitulo}>
                    2. Avance Físico del Proyecto
                  </Text>
                  <Text style={estilos.tarjetaAvanceSub}>
                    Avance actual registrado:{" "}
                    <Text style={{ fontWeight: "700", color: tema.colors.primaryDark }}>
                      {actualProyecto.progress} %
                    </Text>
                    {avancePorcentaje !== actualProyecto.progress && (
                      <Text style={{ color: avancePorcentaje > actualProyecto.progress ? tema.colors.ok : tema.colors.danger }}>
                        {" "}
                        ({avancePorcentaje > actualProyecto.progress ? "+" : ""}
                        {avancePorcentaje - actualProyecto.progress} %)
                      </Text>
                    )}
                  </Text>
                </View>

                {/* Insignia visual del porcentaje actual */}
                <View
                  style={[
                    estilos.insigniaAvanceGrande,
                    { backgroundColor: colorProgreso },
                  ]}
                >
                  <Text style={estilos.insigniaAvanceGrandeTexto}>
                    {avancePorcentaje}%
                  </Text>
                </View>
              </View>

              {/* Hitos Rápidos */}
              <Text style={estilos.campoSubEtiqueta}>
                Selección Rápida de Hito (1 toque):
              </Text>
              <View style={estilos.hitosFila}>
                {[10, 25, 50, 75, 90, 100].map((pct) => {
                  const esSeleccionado = avancePorcentaje === pct;

                  return (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => establecerAvancePorcentaje(pct)}
                      style={[
                        estilos.hitoChip,
                        esSeleccionado && estilos.hitoChipActivo,
                      ]}
                      activeOpacity={0.7}
                      accessibilityLabel={`Fijar avance al ${pct} por ciento`}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          estilos.hitoChipTexto,
                          esSeleccionado && estilos.hitoChipTextoActivo,
                        ]}
                      >
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Controles de Ajuste Numérico Fino */}
              <View style={estilos.ajusteFila}>
                <TouchableOpacity
                  onPress={() => manejarAjustarPorcentaje(-10)}
                  style={estilos.botonPaso}
                  activeOpacity={0.7}
                  accessibilityLabel="Restar 10 por ciento"
                >
                  <Text style={estilos.botonPasoTexto}>−10%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => manejarAjustarPorcentaje(-5)}
                  style={estilos.botonPaso}
                  activeOpacity={0.7}
                  accessibilityLabel="Restar 5 por ciento"
                >
                  <Text style={estilos.botonPasoTexto}>−5%</Text>
                </TouchableOpacity>

                {/* Campo de Entrada Numérica Directa (Input 0-100) */}
                <View style={estilos.entradaNumeroCaja}>
                  <TextInput
                    value={String(avancePorcentaje)}
                    onChangeText={manejarCambioTextoPorcentaje}
                    keyboardType="numeric"
                    maxLength={3}
                    selectTextOnFocus
                    style={estilos.entradaNumeroInput}
                    accessibilityLabel="Porcentaje de avance numérico"
                  />
                  <Text style={estilos.entradaNumeroSimbolo}>%</Text>
                </View>

                <TouchableOpacity
                  onPress={() => manejarAjustarPorcentaje(+5)}
                  style={estilos.botonPaso}
                  activeOpacity={0.7}
                  accessibilityLabel="Sumar 5 por ciento"
                >
                  <Text style={estilos.botonPasoTexto}>+5%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => manejarAjustarPorcentaje(+10)}
                  style={estilos.botonPaso}
                  activeOpacity={0.7}
                  accessibilityLabel="Sumar 10 por ciento"
                >
                  <Text style={estilos.botonPasoTexto}>+10%</Text>
                </TouchableOpacity>
              </View>

              {/* Barra Deslizadora Táctil Interactiva */}
              <View style={estilos.deslizadorContenedor}>
                <View style={estilos.deslizadorTrack}>
                  <View
                    style={[
                      estilos.deslizadorRelleno,
                      {
                        width: `${avancePorcentaje}%`,
                        backgroundColor: colorProgreso,
                      },
                    ]}
                  />
                  {/* Thumb / Indicador circular */}
                  <View
                    style={[
                      estilos.deslizadorThumb,
                      {
                        left: `${Math.max(2, Math.min(96, avancePorcentaje))}%`,
                        borderColor: colorProgreso,
                      },
                    ]}
                  />
                </View>
                <View style={estilos.deslizadorEscala}>
                  <Text style={estilos.escalaTexto}>0%</Text>
                  <Text style={estilos.escalaTexto}>50%</Text>
                  <Text style={estilos.escalaTexto}>100%</Text>
                </View>
              </View>
            </Tarjeta>

            {/* 3. CAMPO DE OBSERVACIONES */}
            <View style={estilos.bloque}>
              <Text style={estilos.bloqueEtiqueta}>
                3. Observaciones y Comentarios de Faena:
              </Text>

              {/* Sugerencias Rápidas */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={estilos.sugerenciasScroll}
              >
                {sugerenciasRapidas.map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => establecerObservaciones(sug)}
                    style={estilos.sugerenciaChip}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={12}
                      color={tema.colors.primaryDark}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={estilos.sugerenciaTexto}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={estilos.areaTexto}
                multiline
                numberOfLines={3}
                value={observaciones}
                onChangeText={establecerObservaciones}
                placeholder="Describe los trabajos efectuados, cuadrilla en faena, hitos cumplidos..."
                placeholderTextColor={tema.colors.textLight}
                textAlignVertical="top"
              />
            </View>

            {/* 4. SELECTOR DE INSUMOS ASIGNADOS UTILIZADOS */}
            <View style={estilos.bloque}>
              <View style={estilos.bloqueCabeceraFila}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.bloqueEtiqueta}>
                    4. Insumos Asignados Utilizados:
                  </Text>
                  <Text style={estilos.bloqueSubEtiqueta}>
                    Selecciona los materiales de la faena consumidos en esta jornada
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    establecerFiltroCatalogo("");
                    establecerModalCatalogoVisible(true);
                  }}
                  style={estilos.botonAgregarInsumo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={16} color={tema.colors.primaryDark} />
                  <Text style={estilos.botonAgregarInsumoTexto}>+ Catálogo</Text>
                </TouchableOpacity>
              </View>

              {/* Banner informativo de normativa contable */}
              <View style={estilos.bannerNormativa}>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={tema.colors.primaryDark}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <Text style={estilos.bannerNormativaTexto}>
                  <Text style={{ fontWeight: "700" }}>Nota informativa en terreno:</Text>{" "}
                  El reporte de insumos utilizados es para control técnico y{" "}
                  <Text style={{ fontWeight: "700" }}>NO rebaja stock físico en bodega</Text>{" "}
                  ni genera egreso contable automático.
                </Text>
              </View>

              {/* Lista interactiva de insumos asignados */}
              {listaInsumos.map((item) => (
                <View
                  key={item.sku}
                  style={[
                    estilos.insumoTarjeta,
                    item.selected && estilos.insumoTarjetaSeleccionada,
                  ]}
                >
                  {/* Selector / Checkbox Touch */}
                  <TouchableOpacity
                    onPress={() => toggleSeleccionInsumo(item.sku)}
                    style={estilos.insumoCheckArea}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.selected }}
                  >
                    <View
                      style={[
                        estilos.checkboxCuadrado,
                        item.selected && estilos.checkboxCuadradoActivo,
                      ]}
                    >
                      {item.selected && (
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={estilos.insumoNombre}>{item.name}</Text>
                      <View style={estilos.insumoDetallesFila}>
                        <Insignia label={item.sku} tone="mute" size="sm" />
                        <Text style={estilos.insumoAsignadoTexto}>
                          Asignado: {item.quantityAssigned} {item.unit}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Selector de cantidad utilizada (si está seleccionado) */}
                  {item.selected && (
                    <View style={estilos.insumoCantidadCaja}>
                      <Text style={estilos.insumoCantidadEtiqueta}>Utilizado:</Text>
                      <View style={estilos.stepperCantidad}>
                        <TouchableOpacity
                          onPress={() => ajustarCantidadInsumo(item.sku, -1)}
                          style={estilos.stepperBoton}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={16} color={tema.colors.text} />
                        </TouchableOpacity>

                        <TextInput
                          value={String(item.quantityUsed)}
                          onChangeText={(t) => cambiarCantidadInsumoDirecta(item.sku, t)}
                          keyboardType="numeric"
                          maxLength={4}
                          style={estilos.stepperInput}
                          selectTextOnFocus
                        />

                        <TouchableOpacity
                          onPress={() => ajustarCantidadInsumo(item.sku, +1)}
                          style={estilos.stepperBoton}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color={tema.colors.text} />
                        </TouchableOpacity>
                      </View>
                      <Text style={estilos.insumoUnidadTexto}>{item.unit}</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Resumen de insumos seleccionados */}
              <View style={estilos.resumenInsumosFila}>
                <Ionicons name="cube-outline" size={16} color={tema.colors.textMuted} />
                <Text style={estilos.resumenInsumosTexto}>
                  Insumos a reportar:{" "}
                  <Text style={{ fontWeight: "700", color: tema.colors.text }}>
                    {insumosSeleccionados.length} elemento(s)
                  </Text>
                </Text>
              </View>
            </View>

            {/* MENSAJES DE ESTADO */}
            {Boolean(mensajeError) && (
              <View style={estilos.mensajeErrorCaja}>
                <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
                <Text style={estilos.mensajeErrorTexto}>{mensajeError}</Text>
              </View>
            )}

            {Boolean(mensajeExito) && (
              <View style={estilos.mensajeExitoCaja}>
                <Ionicons name="checkmark-circle" size={18} color={tema.colors.ok} />
                <Text style={estilos.mensajeExitoTexto}>{mensajeExito}</Text>
              </View>
            )}

            {/* 5. BOTÓN PRINCIPAL DE ENVÍO RÁPIDO */}
            <Boton
              title={`Registrar Reporte de Avance (${avancePorcentaje}%)`}
              variant="primary"
              icon="checkmark-done"
              size="lg"
              onPress={manejarGuardar}
              disabled={guardando}
              style={estilos.botonEnviar}
            />

            {/* 6. HISTORIAL DE REPORTES DEL PROYECTO */}
            {mostrarHistorial && (
              <View style={estilos.bloqueHistorial}>
                <View style={estilos.historialCabecera}>
                  <Text style={estilos.historialTitulo}>
                    Reportes Previos ({historialProyecto.length})
                  </Text>
                  <Text style={estilos.historialSub}>
                    Histórico de avance registrado en esta obra
                  </Text>
                </View>

                {historialProyecto.length === 0 ? (
                  <Text style={estilos.historialVacio}>
                    No hay reportes de avance registrados previamente para esta faena.
                  </Text>
                ) : (
                  historialProyecto.map((rep) => (
                    <Tarjeta
                      key={rep.id}
                      variant="default"
                      style={estilos.tarjetaHistorial}
                    >
                      <View style={estilos.historialItemCabecera}>
                        <View style={{ flex: 1 }}>
                          <Text style={estilos.historialItemFecha}>
                            Fecha: {formatearFecha(rep.date)}
                          </Text>
                          <Text style={estilos.historialItemComentario}>
                            "{rep.comments}"
                          </Text>
                        </View>
                        <Insignia
                          label={`${rep.progressPct}%`}
                          tone={rep.progressPct >= 50 ? "ok" : "warn"}
                          size="md"
                        />
                      </View>

                      {rep.materialsUsed && rep.materialsUsed.length > 0 && (
                        <View style={estilos.historialMaterialesCaja}>
                          <Text style={estilos.historialMaterialesTitulo}>
                            Insumos informados:
                          </Text>
                          {rep.materialsUsed.map((mat, i) => (
                            <Text key={i} style={estilos.historialMaterialItem}>
                              • {mat.name} ({mat.quantity} {mat.unit})
                            </Text>
                          ))}
                        </View>
                      )}
                    </Tarjeta>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL PARA AGREGAR INSUMO EXTRA DESDE EL CATÁLOGO */}
      <Modal
        visible={modalCatalogoVisible}
        animationType="slide"
        transparent
        onRequestClose={() => establecerModalCatalogoVisible(false)}
      >
        <Pressable
          style={estilos.modalOverlay}
          onPress={() => establecerModalCatalogoVisible(false)}
        >
          <Pressable style={estilos.modalContenido} onPress={(e) => e.stopPropagation()}>
            <View style={estilos.modalCabecera}>
              <View>
                <Text style={estilos.modalTitulo}>Agregar Insumo del Catálogo</Text>
                <Text style={estilos.modalSub}>
                  Selecciona un material para reportar en esta jornada
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => establecerModalCatalogoVisible(false)}
                style={estilos.botonCerrarModal}
              >
                <Ionicons name="close" size={20} color={tema.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Buscador */}
            <View style={estilos.modalBuscarCaja}>
              <Ionicons
                name="search-outline"
                size={18}
                color={tema.colors.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={estilos.modalBuscarInput}
                placeholder="Buscar por nombre, SKU o categoría..."
                placeholderTextColor={tema.colors.textLight}
                value={filtroCatalogo}
                onChangeText={establecerFiltroCatalogo}
                autoFocus
              />
            </View>

            {/* Lista de productos */}
            <ScrollView style={{ maxHeight: 340 }}>
              {productosFiltrados.slice(0, 15).map((prod) => (
                <TouchableOpacity
                  key={prod.sku}
                  onPress={() => agregarInsumoDesdeCatalogo(prod)}
                  style={estilos.productoItemModal}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.productoItemNombre}>{prod.name}</Text>
                    <View style={estilos.productoItemMeta}>
                      <Insignia label={prod.sku} tone="mute" size="sm" />
                      <Text style={estilos.productoItemStock}>
                        Stock: {prod.stock} {prod.unit}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color={tema.colors.primary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  etiquetaTicketFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  titulo: {
    fontSize: tema.fontSize.xl,
    fontWeight: "800",
    color: tema.colors.text,
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  botonCerrarModal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  bloque: {
    marginBottom: tema.spacing.lg,
  },
  bloqueEtiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "700",
    color: tema.colors.text,
    marginBottom: 8,
  },
  bloqueSubEtiqueta: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginBottom: 8,
  },
  bloqueCabeceraFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  proyectosChipsScroll: {
    flexDirection: "row",
    marginBottom: 4,
  },
  proyectoChip: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    marginRight: 10,
    width: 220,
    minHeight: 84,
  },
  proyectoChipActivo: {
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
  },
  proyectoChipCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  proyectoChipCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
  },
  proyectoChipCodigoActivo: {
    color: tema.colors.primaryDark,
  },
  proyectoChipNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
    marginBottom: 2,
  },
  proyectoChipNombreActivo: {
    color: tema.colors.text,
  },
  proyectoChipCliente: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  proyectoChipClienteActivo: {
    color: tema.colors.textSecondary,
  },
  tarjetaAvance: {
    padding: tema.spacing.md,
    marginBottom: tema.spacing.lg,
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
  },
  tarjetaAvanceCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  tarjetaAvanceTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "800",
    color: tema.colors.text,
  },
  tarjetaAvanceSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  insigniaAvanceGrande: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  insigniaAvanceGrandeTexto: {
    fontSize: tema.fontSize.lg,
    fontWeight: "800",
    color: "#ffffff",
  },
  campoSubEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.textSecondary,
    marginBottom: 8,
  },
  hitosFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: tema.spacing.md,
  },
  hitoChip: {
    flex: 1,
    minWidth: 48,
    height: 40,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  hitoChipScrum: {
    borderColor: tema.colors.primary,
    backgroundColor: tema.colors.primaryLight,
  },
  hitoChipActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  hitoChipTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
  },
  hitoChipScrumTexto: {
    color: tema.colors.primaryDark,
    fontWeight: "800",
  },
  hitoChipTextoActivo: {
    color: "#ffffff",
  },
  scrumEstrellaBadge: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  ajusteFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
    gap: 6,
  },
  botonPaso: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
  },
  botonPasoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
  },
  entradaNumeroCaja: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderWidth: 2,
    borderColor: tema.colors.primary,
    borderRadius: tema.radius.md,
    backgroundColor: tema.colors.card,
    paddingHorizontal: 8,
  },
  entradaNumeroInput: {
    fontSize: tema.fontSize.lg,
    fontWeight: "800",
    color: tema.colors.text,
    textAlign: "center",
    minWidth: 44,
  },
  entradaNumeroSimbolo: {
    fontSize: tema.fontSize.base,
    fontWeight: "700",
    color: tema.colors.primaryDark,
    marginLeft: 2,
  },
  deslizadorContenedor: {
    marginTop: 6,
  },
  deslizadorTrack: {
    height: 12,
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tema.colors.border,
  },
  deslizadorRelleno: {
    height: "100%",
    borderRadius: 6,
  },
  deslizadorThumb: {
    position: "absolute",
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 3,
    marginLeft: -8,
  },
  deslizadorEscala: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  escalaTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  sugerenciasScroll: {
    flexDirection: "row",
    marginBottom: 8,
  },
  sugerenciaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    borderRadius: tema.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  sugerenciaTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.primaryDark,
  },
  areaTexto: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    padding: 12,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
    minHeight: 76,
  },
  botonAgregarInsumo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.primaryLight,
    borderWidth: 1,
    borderColor: tema.colors.primaryBorder,
    borderRadius: tema.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  botonAgregarInsumoTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.primaryDark,
  },
  bannerNormativa: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tema.colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: tema.colors.primary,
    padding: 10,
    borderRadius: tema.radius.sm,
    marginBottom: 10,
  },
  bannerNormativaTexto: {
    flex: 1,
    fontSize: 11,
    color: tema.colors.textSecondary,
    lineHeight: 16,
  },
  insumoTarjeta: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 8,
  },
  insumoTarjetaSeleccionada: {
    borderColor: tema.colors.primary,
    backgroundColor: "#fffdfa",
  },
  insumoCheckArea: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  checkboxCuadrado: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tema.colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.colors.card,
  },
  checkboxCuadradoActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  insumoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  insumoDetallesFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  insumoAsignadoTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  insumoCantidadCaja: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
    gap: 8,
  },
  insumoCantidadEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.textSecondary,
  },
  stepperCantidad: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.card,
  },
  stepperBoton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.colors.surfaceAlt,
  },
  stepperInput: {
    width: 44,
    height: 32,
    textAlign: "center",
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.text,
  },
  insumoUnidadTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  resumenInsumosFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  resumenInsumosTexto: {
    fontSize: 12,
    color: tema.colors.textMuted,
  },
  mensajeErrorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  mensajeErrorTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.dangerDark,
  },
  mensajeExitoCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.okLight,
    borderWidth: 1,
    borderColor: tema.colors.okBorder,
    borderRadius: tema.radius.md,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  mensajeExitoTexto: {
    flex: 1,
    fontSize: tema.fontSize.xs,
    fontWeight: "700",
    color: tema.colors.okDark,
  },
  botonEnviar: {
    height: 50,
    marginTop: 6,
    marginBottom: tema.spacing.xl,
  },
  bloqueHistorial: {
    marginTop: tema.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    paddingTop: tema.spacing.lg,
  },
  historialCabecera: {
    marginBottom: tema.spacing.sm,
  },
  historialTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "800",
    color: tema.colors.text,
  },
  historialSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  historialVacio: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textLight,
    fontStyle: "italic",
    marginVertical: 8,
  },
  tarjetaHistorial: {
    marginBottom: 10,
    padding: 12,
  },
  historialItemCabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  historialItemFecha: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textMuted,
  },
  historialItemComentario: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
    fontStyle: "italic",
    marginTop: 4,
  },
  historialMaterialesCaja: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tema.colors.borderLight,
  },
  historialMaterialesTitulo: {
    fontSize: 10,
    fontWeight: "700",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
  },
  historialMaterialItem: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginLeft: 4,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContenido: {
    backgroundColor: tema.colors.card,
    borderTopLeftRadius: tema.radius.xl,
    borderTopRightRadius: tema.radius.xl,
    padding: tema.spacing.lg,
    maxHeight: "80%",
  },
  modalCabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tema.spacing.md,
  },
  modalTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "800",
    color: tema.colors.text,
  },
  modalSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  modalBuscarCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: tema.spacing.md,
  },
  modalBuscarInput: {
    flex: 1,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
  },
  productoItemModal: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  productoItemNombre: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.text,
  },
  productoItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  productoItemStock: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
});
