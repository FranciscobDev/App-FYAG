import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AreaTexto, Boton, Insignia, VistaModal } from "@/componentes/comunes";
import { tema } from "@/nucleo/tema";
import { SolicitudMaterial } from "@/nucleo/tipos";

const MOTIVOS_SUGERIDOS = [
  "Insumo no corresponde a la partida aprobada del proyecto",
  "Cantidad solicitada excede el presupuesto asignado",
  "Stock reservado para otra obra prioritaria en curso",
  "Falta especificar justificación técnica de faena",
];

export interface PropiedadesModalRechazoSolicitud {
  solicitud: SolicitudMaterial | null;
  motivoInicial?: string;
  onClose: () => void;
  onConfirmarRechazo: (
    solicitud: SolicitudMaterial,
    motivo: string
  ) => { success: boolean; error?: string };
}

/**
 * Modal reutilizable que exige motivo obligatorio al rechazar una solicitud y notifica al solicitante.
 */
export const ModalRechazoSolicitud: React.FC<PropiedadesModalRechazoSolicitud> = ({
  solicitud,
  motivoInicial = "",
  onClose,
  onConfirmarRechazo,
}) => {
  const [motivo, establecerMotivo] = useState(motivoInicial);
  const [errorMotivo, establecerErrorMotivo] = useState("");

  useEffect(() => {
    if (solicitud) {
      establecerMotivo(motivoInicial);
      establecerErrorMotivo("");
    }
  }, [solicitud, motivoInicial]);

  const manejarConfirmar = () => {
    if (!solicitud) return;
    const limpio = motivo.trim();
    if (!limpio) {
      establecerErrorMotivo("El motivo de rechazo es obligatorio.");
      return;
    }
    if (limpio.length < 5) {
      establecerErrorMotivo("Ingresa un motivo más descriptivo (mínimo 5 caracteres).");
      return;
    }

    const resultado = onConfirmarRechazo(solicitud, limpio);
    if (!resultado.success) {
      establecerErrorMotivo(resultado.error || "No se pudo registrar el rechazo.");
      return;
    }
    onClose();
  };

  return (
    <VistaModal
      visible={Boolean(solicitud)}
      onClose={onClose}
      title="Rechazar Solicitud de Material"
      subtitle={
        solicitud ? `${solicitud.code} • ${solicitud.projectName}` : ""
      }
    >
      {solicitud && (
        <View style={estilos.resumenCaja}>
          <View style={estilos.resumenSuperior}>
            <Text style={estilos.resumenCodigo}>{solicitud.code}</Text>
            <Insignia
              label={solicitud.urgency.toUpperCase()}
              tone={
                solicitud.urgency === "urgente"
                  ? "danger"
                  : solicitud.urgency === "alta"
                  ? "warn"
                  : "info"
              }
              size="sm"
            />
          </View>
          <Text style={estilos.resumenProyecto}>{solicitud.projectName}</Text>
          <Text style={estilos.resumenMeta}>
            Solicitante: {solicitud.technicianName} • {solicitud.items.length} ítem(s)
          </Text>
        </View>
      )}

      {/* Motivos frecuentes seleccionables para agilizar la respuesta administrativa */}
      <Text style={estilos.sugerenciasEtiqueta}>Motivos frecuentes (opcional):</Text>
      <View style={estilos.sugerenciasFila}>
        {MOTIVOS_SUGERIDOS.map((sugerencia) => (
          <TouchableOpacity
            key={sugerencia}
            onPress={() => {
              establecerMotivo(sugerencia);
              if (errorMotivo) establecerErrorMotivo("");
            }}
            style={estilos.sugerenciaChip}
            activeOpacity={0.75}
          >
            <Text style={estilos.sugerenciaTexto}>{sugerencia}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AreaTexto
        label="Motivo de rechazo"
        required
        value={motivo}
        onChangeText={(texto) => {
          establecerMotivo(texto);
          if (errorMotivo) establecerErrorMotivo("");
        }}
        placeholder="Describe el motivo detallado del rechazo para el bodeguero solicitante..."
        maxLength={300}
        rows={4}
        error={errorMotivo || undefined}
        helper="Campo obligatorio: se registrará en la bitácora y se notificará al solicitante."
      />

      <View style={estilos.avisoCaja}>
        <Ionicons name="notifications-outline" size={16} color={tema.colors.dangerDark} />
        <Text style={estilos.avisoTexto}>
          Al confirmar, el bodeguero solicitante recibirá una notificación con el motivo ingresado.
        </Text>
      </View>

      <View style={estilos.botonesPie}>
        <Boton title="Cancelar" variant="ghost" onPress={onClose} />
        <Boton
          title="Confirmar Rechazo"
          variant="danger"
          icon="close-circle-outline"
          onPress={manejarConfirmar}
        />
      </View>
    </VistaModal>
  );
};

const estilos = StyleSheet.create({
  resumenCaja: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  resumenSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resumenCodigo: {
    fontSize: 13,
    fontWeight: "800",
    color: tema.colors.text,
  },
  resumenProyecto: {
    fontSize: 13,
    fontWeight: "600",
    color: tema.colors.primaryDark,
  },
  resumenMeta: {
    fontSize: 11,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  sugerenciasEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.colors.textSecondary,
    marginBottom: 6,
  },
  sugerenciasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  sugerenciaChip: {
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sugerenciaTexto: {
    fontSize: 11,
    color: tema.colors.textSecondary,
    fontWeight: "500",
  },
  avisoCaja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.colors.dangerLight,
    borderWidth: 1,
    borderColor: tema.colors.dangerBorder,
    borderRadius: tema.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: tema.colors.dangerDark,
  },
  botonesPie: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
});
