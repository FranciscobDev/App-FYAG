import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { CampoTexto } from "@/componentes/formularios/CampoTexto";
import { VistaModal } from "@/componentes/superposicion/VistaModal";
import { HojaServicio, ItemListaChequeoServicio, FotoHojaServicio } from "@/nucleo/tipos";

interface TechnicianServiceSheetsViewProps {
  isOffline?: boolean;
}

export const VistaHojasServicioTecnico: React.FC<TechnicianServiceSheetsViewProps> = ({
  isOffline = false,
}) => {
  const {
    proyectos,
    hojasServicio,
    solicitudesMaterial,
    crearHojaServicio,
    resolverConflictoHojaServicio,
  } = usarAplicacion();
  const { usuario } = usarAutenticacion();

  const activoProyectos = proyectos.filter(
    (p) =>
      p.status !== "cerrado" &&
      (p.technicianRuts.includes(usuario.rut) || p.technicianRuts.length === 0)
  );

  // Modal para Nueva Hoja de Servicio
  const [nuevoHojaModal, establecerNuevoHojaModal] = useState(false);
  const [hojaProyectoId, establecerHojaProyectoId] = useState<string>(activoProyectos[0]?.id || "");
  const [hojaReceptor, establecerHojaReceptor] = useState<string>("Carlos Mendoza (Supervisor de Obra)");
  const [hojaNotas, establecerHojaNotas] = useState<string>("Trabajo ejecutado según especificaciones de planos de ingeniería.");

  // Checklist interactivo
  const [listaChequeo, establecerListaChequeo] = useState<ItemListaChequeoServicio[]>([
    { id: "c1", label: "Verificación de aislamiento eléctrico y continuidad de fases", completed: true },
    { id: "c2", label: "Prueba de hermeticidad y estanqueidad hidrostática/nitrógeno", completed: true },
    { id: "c3", label: "Carga de refrigerante y verificación de presiones de alta y baja", completed: true },
    { id: "c4", label: "Inspección de anclajes mecánicos y soportes antivibratorios", completed: false },
    { id: "c5", label: "Limpieza profunda y retiro de excedentes de obra", completed: true },
  ]);
  const [personalizadoTareaEtiqueta, establecerPersonalizadoTareaEtiqueta] = useState("");

  // Fotos adjuntas (Control estricto de máximo 5 MB cada una)
  const [fotos, establecerFotos] = useState<FotoHojaServicio[]>([
    { id: "ph1", name: "tablero_electrico_montado.jpg", sizeMb: 2.1, timestamp: "Hoy 10:15" },
    { id: "ph2", name: "prueba_manometro_digital.jpg", sizeMb: 3.4, timestamp: "Hoy 11:20" },
  ]);
  const [fotoError, establecerFotoError] = useState("");
  const [formularioError, establecerFormularioError] = useState("");

  const manejarAlternarListaChequeoElemento = (id: string) => {
    establecerListaChequeo((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  const manejarAgregarPersonalizadoTarea = () => {
    if (!personalizadoTareaEtiqueta.trim()) return;
    establecerListaChequeo((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, label: personalizadoTareaEtiqueta.trim(), completed: true },
    ]);
    establecerPersonalizadoTareaEtiqueta("");
  };

  // Simular carga de foto con validación estricta de peso (< 5 MB)
  const manejarSimulateAgregarFoto = (simulatedSizeMb: number) => {
    establecerFotoError("");
    if (simulatedSizeMb > 5.0) {
      establecerFotoError(`¡Bloqueo! La fotografía (${simulatedSizeMb} MB) supera el límite máximo permitido de 5 MB por archivo.`);
      return;
    }

    const nuevoPh: FotoHojaServicio = {
      id: `photo_${Date.now()}`,
      name: `registro_faena_${fotos.length + 1}.jpg`,
      sizeMb: simulatedSizeMb,
      timestamp: "Hace un momento",
    };
    establecerFotos((prev) => [...prev, nuevoPh]);
  };

  const manejarQuitarFoto = (id: string) => {
    establecerFotos((prev) => prev.filter((p) => p.id !== id));
  };

  const manejarGuardarHoja = () => {
    establecerFormularioError("");
    const proyecto = activoProyectos.find((p) => p.id === hojaProyectoId) || activoProyectos[0];
    if (!proyecto) {
      establecerFormularioError("Seleccione un proyecto válido.");
      return;
    }

    const codigo = `HS-2026-${String(hojasServicio.length + 106).padStart(3, "0")}`;

    crearHojaServicio({
      code: codigo,
      projectId: proyecto.id,
      projectCode: proyecto.code,
      projectName: proyecto.name,
      date: new Date().toISOString().slice(0, 10),
      technicianRut: usuario.rut,
      technicianName: usuario.name,
      checklist: listaChequeo,
      photos: fotos,
      receptorName: hojaReceptor.trim() || "Supervisor de Terreno",
      syncStatus: isOffline ? "pendiente" : "sincronizado",
      notes: hojaNotas.trim(),
    });

    establecerNuevoHojaModal(false);
  };

  // Hojas con conflicto de versiones
  const conflictoHojas = hojasServicio.filter((s) => s.hasVersionConflict);

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {/* 1. TOP HEADER CON BOTÓN ACCIÓN */}
      <View style={estilos.encabezadoFila}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.encabezadoTitulo}>Hojas de Servicio y Faena</Text>
          <Text style={estilos.encabezadoSub}>
            Checklist técnico, fotografías de respaldo (máx. 5 MB) y actas de recepción
          </Text>
        </View>

        <Boton
          title="+ Nueva Hoja"
          variant="primary"
          size="sm"
          icon="document-attach-outline"
          onPress={() => {
            establecerFormularioError("");
            establecerFotoError("");
            establecerNuevoHojaModal(true);
          }}
          style={{ height: 44 }}
        />
      </View>

      {/* ========================================================================= */}
      {/* 2. BANNER DE CONFLICTO DE VERSIONES (REQUISITO EXPLICITO PASO 10)         */}
      {/* ========================================================================= */}
      {conflictoHojas.map((s) => (
        <View key={s.id} style={estilos.conflictoBanner}>
          <View style={estilos.conflictoEncabezado}>
            <Ionicons name="warning" size={22} color={tema.colors.danger} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.conflictoTitulo}>
                ⚠️ Conflicto de Versiones Detectado en {s.code}
              </Text>
              <Text style={estilos.conflictoSub}>
                El servidor central recibió cambios concurrentes mientras operabas en modo sin conexión.
              </Text>
            </View>
          </View>

          {s.conflictDetails && (
            <View style={estilos.conflictoCompareGrilla}>
              <View style={estilos.compareColumna}>
                <Text style={estilos.compareColumnaTitulo}>Versión en Servidor Central:</Text>
                <Text style={estilos.compareColumnaAutor}>Por: {s.conflictDetails.serverAuthor}</Text>
                <Text style={estilos.compareColumnaFecha}>Fecha: {s.conflictDetails.serverModifiedAt}</Text>
                <Text style={estilos.compareColumnaNotas}>"{s.conflictDetails.serverNotes}"</Text>
              </View>

              <View style={[estilos.compareColumna, estilos.compareColumnaLocal]}>
                <Text style={estilos.compareColumnaTitulo}>Tu Versión Local (Celular):</Text>
                <Text style={estilos.compareColumnaAutor}>Por: {s.technicianName}</Text>
                <Text style={estilos.compareColumnaFecha}>Fecha: {s.conflictDetails.localModifiedAt}</Text>
                <Text style={estilos.compareColumnaNotas}>"{s.conflictDetails.localNotes}"</Text>
              </View>
            </View>
          )}

          <View style={estilos.conflictoAccionBotones}>
            <Boton
              title="Aceptar Versión Servidor"
              variant="outline"
              size="sm"
              onPress={() => resolverConflictoHojaServicio(s.id, "server")}
              style={{ flex: 1, marginRight: 8, height: 44 }}
            />
            <Boton
              title="Conservar Versión Local"
              variant="primary"
              size="sm"
              onPress={() => resolverConflictoHojaServicio(s.id, "local")}
              style={{ flex: 1, height: 44 }}
            />
          </View>
        </View>
      ))}

      {/* 3. LISTADO DE HOJAS DE SERVICIO */}
      <Text style={estilos.seccionEncabezado}>Registros Emitidos en Faena:</Text>

      {hojasServicio.length === 0 ? (
        <EstadoVacio
          icon="document-text-outline"
          title="Sin hojas de servicio"
          description="Aún no has emitido reportes técnicos u hojas de servicio en faena."
          actionTitle="+ Nueva Hoja"
          onAction={() => establecerNuevoHojaModal(true)}
          containerStyle={{ marginVertical: 20 }}
        />
      ) : (
        hojasServicio.map((sheet) => {
        const completadoConteo = sheet.checklist.filter((c) => c.completed).length;
        const totalConteo = sheet.checklist.length;
        const totalMb = sheet.photos.reduce((acc, p) => acc + p.sizeMb, 0).toFixed(1);
        const esSynced = sheet.syncStatus === "sincronizado";

        return (
          <Tarjeta key={sheet.id} variant="elevated" style={estilos.hojaTarjeta}>
            <View style={estilos.hojaSuperiorFila}>
              <View style={{ flex: 1 }}>
                <View style={estilos.codigoFila}>
                  <Text style={estilos.hojaCodigo}>{sheet.code}</Text>
                  <Insignia
                    label={esSynced ? "Sincronizado" : "Pendiente"}
                    tone={esSynced ? "ok" : "warn"}
                    icon={esSynced ? "cloud-done-outline" : "cloud-upload-outline"}
                    size="sm"
                  />
                </View>
                <Text style={estilos.hojaProyecto}>{sheet.projectName} ({sheet.projectCode})</Text>
                <Text style={estilos.hojaFecha}>Fecha de ejecución: {formatearFecha(sheet.date)}</Text>
              </View>
            </View>

            {/* Checklist summary */}
            <View style={estilos.hojaMetricsFila}>
              <View style={estilos.hojaMetric}>
                <Ionicons name="checkbox-outline" size={16} color={tema.colors.ok} style={{ marginRight: 4 }} />
                <Text style={estilos.hojaMetricTexto}>
                  Checklist: <Text style={{ fontWeight: "bold" }}>{completadoConteo}/{totalConteo}</Text>
                </Text>
              </View>

              <View style={estilos.hojaMetric}>
                <Ionicons name="camera-outline" size={16} color={tema.colors.primary} style={{ marginRight: 4 }} />
                <Text style={estilos.hojaMetricTexto}>
                  Fotos: <Text style={{ fontWeight: "bold" }}>{sheet.photos.length} ({totalMb} MB)</Text>
                </Text>
              </View>
            </View>

            {/* Receptor y Observaciones */}
            <View style={estilos.hojaPieCaja}>
              <Text style={estilos.receptorTexto}>
                Receptor en faena: <Text style={{ fontWeight: "600", color: tema.colors.text }}>{sheet.receptorName}</Text>
              </Text>
              {sheet.notes && (
                <Text style={estilos.hojaNotasTexto}>"{sheet.notes}"</Text>
              )}
            </View>
          </Tarjeta>
        );
      })
      )}

      {/* 4. SECCIÓN DE ALERTAS Y NOTIFICACIONES DE FAENA */}
      <Text style={[estilos.seccionEncabezado, { marginTop: tema.spacing.lg }]}>
        Alertas y Notificaciones de Solicitudes:
      </Text>

      {solicitudesMaterial.slice(0, 4).map((req) => (
        <Tarjeta key={req.id} variant="default" style={estilos.alertaTarjeta}>
          <View style={estilos.alertaEncabezado}>
            <Text style={estilos.alertaCodigo}>{req.code}</Text>
            <Insignia
              label={req.status === "aprobada" ? "Aprobada" : req.status === "rechazada" ? "Rechazada" : "Pendiente"}
              tone={req.status === "aprobada" ? "ok" : req.status === "rechazada" ? "danger" : "warn"}
              size="sm"
            />
          </View>
          <Text style={estilos.alertaProyecto}>Faena: {req.projectName}</Text>
          <Text style={estilos.alertaResumen}>{req.items.length} insumo(s) • Fecha: {formatearFecha(req.date)}</Text>
        </Tarjeta>
      ))}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA HOJA DE SERVICIO                                             */}
      {/* ========================================================================= */}
      <VistaModal
        visible={nuevoHojaModal}
        onClose={() => establecerNuevoHojaModal(false)}
        title="Nueva Hoja de Servicio de Faena"
        subtitle="Control de calidad, checklist y registro fotográfico"
      >
        <Text style={estilos.campoEtiqueta}>1. Proyecto / Faena:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.chipsScroll}>
          {activoProyectos.map((p) => {
            const esSeleccionado = p.id === hojaProyectoId;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => establecerHojaProyectoId(p.id)}
                style={[estilos.chipBoton, esSeleccionado && estilos.chipBotonActivo]}
              >
                <Text style={[estilos.chipTexto, esSeleccionado && estilos.chipTextoActivo]}>
                  {p.code} - {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. CHECKLIST INTERACTIVO */}
        <Text style={estilos.campoEtiqueta}>2. Checklist de Inspección y Entrega:</Text>
        {listaChequeo.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => manejarAlternarListaChequeoElemento(c.id)}
            style={estilos.verificarElementoFila}
            activeOpacity={0.7}
          >
            <Ionicons
              name={c.completed ? "checkbox" : "square-outline"}
              size={22}
              color={c.completed ? tema.colors.ok : tema.colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[estilos.verificarElementoEtiqueta, c.completed && estilos.verificarElementoDone]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Agregar ítem al checklist */}
        <View style={estilos.agregarListaChequeoFila}>
          <TextInput
            value={personalizadoTareaEtiqueta}
            onChangeText={establecerPersonalizadoTareaEtiqueta}
            placeholder="Añadir tarea de inspección personalizada..."
            placeholderTextColor={tema.colors.textLight}
            style={estilos.agregarListaChequeoEntrada}
          />
          <TouchableOpacity onPress={manejarAgregarPersonalizadoTarea} style={estilos.agregarListaChequeoBoton}>
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* 3. FOTOGRAFÍAS (MÁX 5 MB POR FOTO) */}
        <Text style={[estilos.campoEtiqueta, { marginTop: 12 }]}>
          3. Fotografías de Respaldo (Máx. 5 MB por archivo):
        </Text>

        <View style={estilos.fotosSimulateBarra}>
          <Boton
            title="+ Foto Cámara (2.2 MB)"
            variant="outline"
            size="sm"
            icon="camera-outline"
            onPress={() => manejarSimulateAgregarFoto(2.2)}
            style={{ flex: 1, marginRight: 6 }}
          />
          <Boton
            title="+ Foto Pesada (5.8 MB)"
            variant="ghost"
            size="sm"
            icon="alert-circle-outline"
            onPress={() => manejarSimulateAgregarFoto(5.8)}
            style={{ flex: 1 }}
          />
        </View>

        {Boolean(fotoError) && (
          <View style={estilos.fotoErrorCaja}>
            <Ionicons name="alert-circle" size={16} color={tema.colors.danger} style={{ marginRight: 6 }} />
            <Text style={estilos.fotoErrorTexto}>{fotoError}</Text>
          </View>
        )}

        {/* Galería de Fotos */}
        {fotos.map((ph) => (
          <View key={ph.id} style={estilos.fotoElementoTarjeta}>
            <Ionicons name="image-outline" size={20} color={tema.colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.fotoNombre}>{ph.name}</Text>
              <Text style={estilos.fotoTamano}>
                Tamaño: <Text style={{ fontWeight: "bold" }}>{ph.sizeMb} MB</Text> / 5.0 MB máx. • {ph.timestamp}
              </Text>
            </View>
            <TouchableOpacity onPress={() => manejarQuitarFoto(ph.id)} style={estilos.quitarFotoBoton}>
              <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        {/* 4. RECEPTOR Y NOTAS */}
        <CampoTexto
          label="Nombre del Receptor / Inspector en Faena"
          value={hojaReceptor}
          onChangeText={establecerHojaReceptor}
          placeholder="Nombre y cargo de quien recibe el trabajo..."
        />

        <CampoTexto
          label="Observaciones o Constancias Técnicas"
          value={hojaNotas}
          onChangeText={establecerHojaNotas}
          placeholder="Aclaraciones sobre parámetros, presiones, circuitos..."
        />

        {Boolean(formularioError) && <Text style={estilos.errorTexto}>{formularioError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerNuevoHojaModal(false)}
            style={{ marginRight: 8, flex: 1 }}
          />
          <Boton
            title="Emitir Hoja de Servicio"
            variant="primary"
            onPress={manejarGuardarHoja}
            style={{ flex: 2, height: 46 }}
          />
        </View>
      </VistaModal>
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: tema.colors.background,
  },
  contenido: {
    padding: tema.spacing.md,
    paddingBottom: 40,
  },
  encabezadoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tema.spacing.md,
    flexWrap: "wrap",
    gap: 8,
  },
  encabezadoTitulo: {
    fontSize: tema.fontSize.md,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  encabezadoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
    maxWidth: 240,
  },
  conflictoBanner: {
    backgroundColor: tema.colors.dangerLight,
    borderRadius: tema.radius.md,
    padding: 12,
    marginBottom: tema.spacing.md,
    borderWidth: 2,
    borderColor: tema.colors.danger,
  },
  conflictoEncabezado: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  conflictoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.danger,
  },
  conflictoSub: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  conflictoCompareGrilla: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  compareColumna: {
    flex: 1,
    backgroundColor: tema.colors.card,
    padding: 8,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 4,
  },
  compareColumnaLocal: {
    marginRight: 0,
    marginLeft: 4,
    borderColor: tema.colors.primary,
  },
  compareColumnaTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  compareColumnaAutor: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  compareColumnaFecha: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  compareColumnaNotas: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  conflictoAccionBotones: {
    flexDirection: "row",
    marginTop: 6,
    flexWrap: "wrap",
    gap: 8,
  },
  seccionEncabezado: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hojaTarjeta: {
    marginBottom: tema.spacing.sm,
    backgroundColor: tema.colors.card,
  },
  hojaSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codigoFila: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    flexWrap: "wrap",
    gap: 6,
  },
  hojaCodigo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
    marginRight: 8,
  },
  hojaProyecto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
    marginTop: 2,
  },
  hojaFecha: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  hojaMetricsFila: {
    flexDirection: "row",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginVertical: 8,
  },
  hojaMetric: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  hojaMetricTexto: {
    fontSize: 11,
    color: tema.colors.text,
  },
  hojaPieCaja: {
    borderTopWidth: 1,
    borderTopColor: tema.colors.border,
    paddingTop: 6,
  },
  receptorTexto: {
    fontSize: 11,
    color: tema.colors.textMuted,
  },
  hojaNotasTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  alertaTarjeta: {
    marginBottom: 6,
    backgroundColor: tema.colors.card,
  },
  alertaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  alertaCodigo: {
    fontSize: 12,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  alertaProyecto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    marginTop: 2,
  },
  alertaResumen: {
    fontSize: 10,
    color: tema.colors.textMuted,
    marginTop: 1,
  },
  campoEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 10,
  },
  chipBoton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tema.radius.full,
    backgroundColor: tema.colors.surface,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    marginRight: 6,
  },
  chipBotonActivo: {
    backgroundColor: tema.colors.primary,
    borderColor: tema.colors.primaryDark,
  },
  chipTexto: {
    fontSize: 11,
    color: tema.colors.text,
  },
  chipTextoActivo: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  verificarElementoFila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surface,
    marginBottom: 4,
  },
  verificarElementoEtiqueta: {
    fontSize: 12,
    color: tema.colors.text,
    flex: 1,
  },
  verificarElementoDone: {
    color: tema.colors.okDark,
    fontWeight: "500",
  },
  agregarListaChequeoFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  agregarListaChequeoEntrada: {
    flex: 1,
    height: 38,
    backgroundColor: tema.colors.surface,
    borderRadius: tema.radius.sm,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    paddingHorizontal: 10,
    fontSize: 11,
    color: tema.colors.text,
    marginRight: 6,
  },
  agregarListaChequeoBoton: {
    width: 38,
    height: 38,
    backgroundColor: tema.colors.primary,
    borderRadius: tema.radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  fotosSimulateBarra: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  fotoErrorCaja: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.dangerLight,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 8,
  },
  fotoErrorTexto: {
    fontSize: tema.fontSize.caption,
    color: tema.colors.danger,
    fontWeight: tema.fontWeight.semibold,
    flex: 1,
  },
  fotoElementoTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.surface,
    padding: 8,
    borderRadius: tema.radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
  },
  fotoNombre: {
    fontSize: 11,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  fotoTamano: {
    fontSize: 10,
    color: tema.colors.textMuted,
  },
  quitarFotoBoton: {
    padding: 6,
  },
  errorTexto: {
    fontSize: 12,
    color: tema.colors.danger,
    fontWeight: "bold",
    marginTop: 6,
  },
  modalBotonesFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 8,
  },
});
