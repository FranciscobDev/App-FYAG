import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { tema } from "@/nucleo/tema";
import { Insignia } from "@/componentes/base/Insignia";
import { Boton } from "@/componentes/base/Boton";
import { Tarjeta } from "@/componentes/base/Tarjeta";
import { EstadoVacio } from "@/componentes/retroalimentacion/EstadoVacio";
import { InsigniaEstado } from "@/componentes/base/InsigniaEstado";
import { ModalEscanerQr } from "@/componentes/dominio/ModalEscanerQr";
import { ContenedorEstadoPantalla } from "@/componentes/retroalimentacion/ContenedorEstadoPantalla";

interface WarehouseDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const PanelBodega: React.FC<WarehouseDashboardProps> = ({ onNavigate }) => {
  const {
    productos,
    solicitudesMaterial,
    ordenesDevolucion,
    recepcionesPendientes,
  } = usarAplicacion();

  const [escanerAbrir, establecerEscanerAbrir] = useState(false);
  const [escaneadoCodigo, establecerEscaneadoCodigo] = useState<string | null>(null);

  const criticalExistencia = productos.filter((p) => p.stock <= p.minStock && !p.disabled);
  const aprobadoForDespacho = solicitudesMaterial.filter((r) => r.status === "aprobada");
  const inTransitDevoluciones = ordenesDevolucion.filter((r) => r.status === "en_transito");
  const pendienteHastaConfirmar = recepcionesPendientes.filter((p) => p.status === "por_confirmar");

  return (
    <ContenedorEstadoPantalla screenTitle="Dashboard Bodega" skeletonType="cards">
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      {/* 0. HERO BOTÓN ESCÁNER QR/BARRAS (TABLET BODEGUERO) */}
      <TouchableOpacity
        style={estilos.escanerHeroBoton}
        onPress={() => establecerEscanerAbrir(true)}
        activeOpacity={0.85}
      >
        <View style={estilos.escanerHeroIcono}>
          <Ionicons name="barcode-outline" size={26} color="#ffffff" />
        </View>
        <View style={estilos.escanerHeroTextoColumna}>
          <Text style={estilos.escanerHeroTitulo}>Escanear Código QR / Barras</Text>
          <Text style={estilos.escanerHeroSub}>
            Cámara táctil para tablet • Búsqueda instantánea de insumo o bulto
          </Text>
        </View>
        <Ionicons name="camera-outline" size={22} color={tema.colors.primaryDark} />
      </TouchableOpacity>

      {/* BANNER RESULTADO ESCANEADO */}
      {escaneadoCodigo && (
        <View style={estilos.escaneadoAlerta}>
          <Ionicons name="checkmark-circle" size={24} color={tema.colors.ok} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={estilos.escaneadoTitulo}>Código escaneado: {escaneadoCodigo}</Text>
            <Text style={estilos.escaneadoSub}>
              {productos.find((p) => p.sku === escaneadoCodigo)?.name || "Insumo / Bulto identificado con éxito"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => establecerEscaneadoCodigo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color={tema.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* 1. ACCESOS RÁPIDOS */}
      <Text style={estilos.seccionEncabezado}>Accesos Rápidos</Text>
      <View style={estilos.rapidoAccionesGrilla}>
        <TouchableOpacity
          style={[estilos.rapidoAccionBoton, { backgroundColor: "#e0f2fe" }]}
          onPress={() => onNavigate && onNavigate("egreso")}
          activeOpacity={0.8}
        >
          <View style={estilos.rapidoAccionSuperiorFila}>
            <Ionicons name="arrow-up-circle-outline" size={26} color={tema.colors.primary} />
            {aprobadoForDespacho.length > 0 && (
              <Insignia label={String(aprobadoForDespacho.length)} tone="primary" size="sm" />
            )}
          </View>
          <Text style={[estilos.rapidoAccionEtiqueta, { color: tema.colors.primaryDark }]}>
            Egreso / Despacho
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilos.rapidoAccionBoton, { backgroundColor: "#dcfce7" }]}
          onPress={() => onNavigate && onNavigate("recepcion")}
          activeOpacity={0.8}
        >
          <View style={estilos.rapidoAccionSuperiorFila}>
            <Ionicons name="arrow-down-circle-outline" size={26} color={tema.colors.ok} />
            {pendienteHastaConfirmar.length > 0 && (
              <Insignia label={String(pendienteHastaConfirmar.length)} tone="ok" size="sm" />
            )}
          </View>
          <Text style={[estilos.rapidoAccionEtiqueta, { color: tema.colors.ok }]}>
            Recepción OC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilos.rapidoAccionBoton, { backgroundColor: "#fef3c7" }]}
          onPress={() => onNavigate && onNavigate("conteo")}
          activeOpacity={0.8}
        >
          <View style={estilos.rapidoAccionSuperiorFila}>
            <Ionicons name="clipboard-outline" size={26} color={tema.colors.warn} />
            {criticalExistencia.length > 0 && (
              <Insignia label={String(criticalExistencia.length)} tone="warn" size="sm" />
            )}
          </View>
          <Text style={[estilos.rapidoAccionEtiqueta, { color: tema.colors.warn }]}>
            Conteo Cíclico
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilos.rapidoAccionBoton, { backgroundColor: "#ede9fe" }]}
          onPress={() => onNavigate && onNavigate("devoluciones")}
          activeOpacity={0.8}
        >
          <View style={estilos.rapidoAccionSuperiorFila}>
            <Ionicons name="return-down-back-outline" size={26} color={tema.colors.transit} />
            {inTransitDevoluciones.length > 0 && (
              <Insignia label={String(inTransitDevoluciones.length)} tone="transit" size="sm" />
            )}
          </View>
          <Text style={[estilos.rapidoAccionEtiqueta, { color: tema.colors.transit }]}>
            Devoluciones Faena
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. STOCK CRÍTICO */}
      <Tarjeta variant="elevated">
        <View style={estilos.tarjetaEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="alert-circle-outline" size={20} color={tema.colors.danger} />
            <Text style={estilos.tarjetaTitulo}>Insumos con Stock Crítico ({criticalExistencia.length})</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("inventario")}>
            <Text style={estilos.enlaceTexto}>Ver inventario</Text>
          </TouchableOpacity>
        </View>

        {criticalExistencia.length === 0 ? (
          <EstadoVacio
            icon="shield-checkmark-outline"
            title="Stock en niveles óptimos"
            description="Todos los insumos se encuentran por sobre el umbral mínimo de seguridad."
            containerStyle={{ borderWidth: 0, paddingVertical: 16 }}
          />
        ) : (
          criticalExistencia.slice(0, 4).map((p) => (
            <View key={p.sku} style={estilos.criticalElementoFila}>
              <View style={estilos.elementoInfoColumna}>
                <Text style={estilos.skuTexto}>{p.sku}</Text>
                <Text style={estilos.productoNombre}>{p.name}</Text>
                <Text style={estilos.ubicacionTexto}>Ubicación: {p.location}</Text>
              </View>
              <View style={estilos.existenciaColumna}>
                <View style={estilos.existenciaNumbers}>
                  <Text style={estilos.existenciaAlertaTexto}>{p.stock} {p.unit}</Text>
                  <Text style={estilos.minimoExistenciaTexto}> (mín {p.minStock})</Text>
                </View>
                <Insignia label="Crítico" tone="danger" size="sm" />
              </View>
            </View>
          ))
        )}
      </Tarjeta>

      {/* 3. APROBADAS PENDIENTES DE EGRESO */}
      <Tarjeta variant="elevated">
        <View style={estilos.tarjetaEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={tema.colors.ok} />
            <Text style={estilos.tarjetaTitulo}>
              Aprobadas Pendientes de Egreso ({aprobadoForDespacho.length})
            </Text>
          </View>
        </View>

        {aprobadoForDespacho.length === 0 ? (
          <EstadoVacio
            icon="checkmark-done-circle-outline"
            title="Sin despachos pendientes"
            description="No hay solicitudes aprobadas esperando retiro en este momento."
            containerStyle={{ borderWidth: 0, paddingVertical: 16 }}
          />
        ) : (
          aprobadoForDespacho.map((req) => (
            <View key={req.id} style={estilos.aprobadoTarjeta}>
              <View style={estilos.aprobadoSuperior}>
                <Text style={estilos.aprobadoCodigo}>{req.code}</Text>
                <Insignia label="Aprobada" tone="ok" size="sm" />
              </View>
              <Text style={estilos.aprobadoProyecto}>{req.projectName}</Text>
              <Text style={estilos.aprobadoTecnico}>Retira: {req.technicianName}</Text>
              <View style={estilos.aprobadoElementosResumen}>
                <Text style={estilos.elementosResumenTexto}>
                  {req.items.length} insumo(s): {req.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}
                </Text>
              </View>
              <Boton
                title="Generar Salida de Bodega"
                variant="primary"
                size="sm"
                icon="arrow-up-circle-outline"
                onPress={() => onNavigate && onNavigate("inventario")}
                style={{ marginTop: 8 }}
              />
            </View>
          ))
        )}
      </Tarjeta>

      {/* 4. DEVOLUCIONES EN TRÁNSITO */}
      <Tarjeta variant="outlined">
        <View style={estilos.tarjetaEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="car-outline" size={20} color={tema.colors.transit} />
            <Text style={estilos.tarjetaTitulo}>
              Devoluciones en Tránsito ({inTransitDevoluciones.length})
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("devoluciones")}>
            <Text style={estilos.enlaceTexto}>Gestionar</Text>
          </TouchableOpacity>
        </View>

        {inTransitDevoluciones.length === 0 ? (
          <Text style={estilos.vacioNota}>No hay devoluciones en camino desde terreno.</Text>
        ) : (
          inTransitDevoluciones.map((ret) => (
            <View key={ret.id} style={estilos.devolucionFila}>
              <View style={estilos.devolucionInfo}>
                <Text style={estilos.devolucionCodigo}>{ret.code}</Text>
                <Text style={estilos.devolucionProyecto}>{ret.projectName}</Text>
                <Text style={estilos.devolucionResumen}>
                  {ret.technicianName} devuelve: {ret.summary}
                </Text>
              </View>
              <InsigniaEstado status="en_transito" size="sm" />
            </View>
          ))
        )}
      </Tarjeta>

      {/* 5. RECEPCIONES POR CONFIRMAR */}
      <Tarjeta variant="outlined">
        <View style={estilos.tarjetaEncabezado}>
          <View style={estilos.tituloWithIcono}>
            <Ionicons name="cube-outline" size={20} color={tema.colors.info} />
            <Text style={estilos.tarjetaTitulo}>
              Recepciones de Proveedor por Confirmar ({pendienteHastaConfirmar.length})
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate && onNavigate("recepcion")}>
            <Text style={estilos.enlaceTexto}>Ver checklist</Text>
          </TouchableOpacity>
        </View>

        {pendienteHastaConfirmar.length === 0 ? (
          <Text style={estilos.vacioNota}>No hay bultos pendientes de ingreso.</Text>
        ) : (
          pendienteHastaConfirmar.map((rec) => (
            <View key={rec.id} style={estilos.recepcionFila}>
              <View style={estilos.recepcionInfo}>
                <Text style={estilos.recepcionOc}>{rec.ocCode} • {rec.supplier}</Text>
                <Text style={estilos.recepcionResumen}>{rec.itemsSummary}</Text>
                <Text style={estilos.recepcionBultos}>{rec.packagesCount} bulto(s) arribados</Text>
              </View>
              <InsigniaEstado status="pendiente" size="sm" />
            </View>
          ))
        )}
      </Tarjeta>

      {/* MODAL ESCÁNER QR/BARRAS TABLET */}
      <ModalEscanerQr
        visible={escanerAbrir}
        onClose={() => establecerEscanerAbrir(false)}
        onScanResult={(val) => {
          establecerEscaneadoCodigo(val);
          establecerEscanerAbrir(false);
        }}
      />
    </ScrollView>
    </ContenedorEstadoPantalla>
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
  escanerHeroBoton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
    borderWidth: 2,
    borderColor: tema.colors.primary,
    ...tema.shadows.md,
    minHeight: 64,
  },
  escanerHeroIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tema.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tema.spacing.md,
  },
  escanerHeroTextoColumna: {
    flex: 1,
  },
  escanerHeroTitulo: {
    fontSize: tema.fontSize.base,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  escanerHeroSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  escaneadoAlerta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.okLight,
    borderColor: tema.colors.okBorder,
    borderWidth: 1.5,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.md,
  },
  escaneadoTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.okDark,
  },
  escaneadoSub: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.okDark,
    marginTop: 2,
  },
  seccionEncabezado: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: tema.colors.textMuted,
    marginBottom: tema.spacing.sm,
  },
  rapidoAccionesGrilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: tema.spacing.lg,
  },
  rapidoAccionBoton: {
    width: "48%",
    borderRadius: tema.radius.lg,
    padding: tema.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tema.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  rapidoAccionSuperiorFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    flexWrap: "wrap",
    gap: 6,
  },
  rapidoAccionEtiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "center",
  },
  tarjetaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tema.spacing.md,
  },
  tituloWithIcono: {
    flexDirection: "row",
    alignItems: "center",
  },
  tarjetaTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
    marginLeft: 6,
  },
  enlaceTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "600",
    color: tema.colors.primary,
  },
  vacioNota: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: tema.spacing.sm,
  },
  criticalElementoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tema.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
  },
  elementoInfoColumna: {
    flex: 1,
    marginRight: tema.spacing.sm,
  },
  skuTexto: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.primaryDark,
  },
  productoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "500",
    color: tema.colors.text,
  },
  ubicacionTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  existenciaColumna: {
    alignItems: "flex-end",
  },
  existenciaNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  existenciaAlertaTexto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.danger,
  },
  minimoExistenciaTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  aprobadoTarjeta: {
    backgroundColor: tema.colors.surfaceAlt,
    borderRadius: tema.radius.md,
    padding: tema.spacing.md,
    marginBottom: tema.spacing.sm,
  },
  aprobadoSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  aprobadoCodigo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  aprobadoProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.primaryDark,
    marginTop: 2,
  },
  aprobadoTecnico: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  aprobadoElementosResumen: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.sm,
    padding: tema.spacing.sm,
    marginTop: 6,
  },
  elementosResumenTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.text,
  },
  devolucionFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tema.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    flexWrap: "wrap",
    gap: 6,
  },
  devolucionInfo: {
    flex: 1,
    marginRight: tema.spacing.sm,
  },
  devolucionCodigo: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.transit,
  },
  devolucionProyecto: {
    fontSize: tema.fontSize.sm,
    fontWeight: "500",
    color: tema.colors.text,
  },
  devolucionResumen: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  recepcionFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tema.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tema.colors.borderLight,
    flexWrap: "wrap",
    gap: 6,
  },
  recepcionInfo: {
    flex: 1,
    marginRight: tema.spacing.sm,
  },
  recepcionOc: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  recepcionResumen: {
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
  },
  recepcionBultos: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
});
