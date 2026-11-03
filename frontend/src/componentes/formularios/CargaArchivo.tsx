import React, { useState } from "react";
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";

export interface ArchivoCargado {
  id: string;
  name: string;
  sizeStr: string;
  type: "image" | "pdf" | "doc";
  uri?: string;
}

export interface PropiedadesCargaArchivo {
  label: string;
  files: ArchivoCargado[];
  onAddFile: (file: ArchivoCargado) => void;
  onRemoveFile: (fileId: string) => void;
  accept?: string;
  maxFiles?: number;
  required?: boolean;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const CargaArchivo: React.FC<PropiedadesCargaArchivo> = ({
  label,
  files,
  onAddFile,
  onRemoveFile,
  accept = "PDF, PNG, JPG (máx 10 MB)",
  maxFiles = 3,
  required = false,
  error,
  helper,
  containerStyle,
}) => {
  const [esSimulatingSubir, establecerEsSimulatingSubir] = useState(false);

  // Simulación realista de carga de archivo (Factura, Guía o Foto de Faena)
  const manejarSimulatePick = () => {
    if (files.length >= maxFiles) return;

    establecerEsSimulatingSubir(true);
    setTimeout(() => {
      const esImg = files.length % 2 === 0;
      const nuevoArchivo: ArchivoCargado = {
        id: "file_" + Date.now(),
        name: esImg ? `Foto_Evidencia_${files.length + 1}.jpg` : `Factura_Guia_${files.length + 1}.pdf`,
        sizeStr: esImg ? "2.4 MB" : "840 KB",
        type: esImg ? "image" : "pdf",
        uri: esImg
          ? "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&q=80"
          : undefined,
      };
      onAddFile(nuevoArchivo);
      establecerEsSimulatingSubir(false);
    }, 600);
  };

  return (
    <View style={[estilos.contenedor, containerStyle]}>
      {/* Etiqueta visible */}
      <View style={estilos.etiquetaFila}>
        <Text style={estilos.etiqueta}>
          {label}
          {required && <Text style={estilos.requiredMarcar}> *</Text>}
        </Text>
        <Text style={estilos.conteoTexto}>
          ({files.length}/{maxFiles})
        </Text>
      </View>

      {/* Zona de subida táctil */}
      {files.length < maxFiles && (
        <TouchableOpacity
          onPress={manejarSimulatePick}
          disabled={esSimulatingSubir}
          activeOpacity={0.7}
          style={[
            estilos.dropZone,
            Boolean(error) && estilos.dropZoneError,
          ]}
        >
          <View style={estilos.subirIconoCirculo}>
            <Ionicons
              name={esSimulatingSubir ? "hourglass-outline" : "cloud-upload-outline"}
              size={24}
              color={tema.colors.primary}
            />
          </View>
          <Text style={estilos.dropTitulo}>
            {esSimulatingSubir ? "Procesando adjunto..." : "Presione para adjuntar archivo o foto"}
          </Text>
          <Text style={estilos.dropHint}>{accept}</Text>
        </TouchableOpacity>
      )}

      {/* Lista de archivos con vista previa */}
      {files.length > 0 && (
        <View style={estilos.archivosLista}>
          {files.map((file) => (
            <View key={file.id} style={estilos.archivoElemento}>
              {/* Thumbnail o Icono */}
              {file.type === "image" && file.uri ? (
                <Image source={{ uri: file.uri }} style={estilos.thumbImage} />
              ) : (
                <View style={estilos.docIconoCaja}>
                  <Ionicons
                    name={file.type === "pdf" ? "document-text" : "attach"}
                    size={22}
                    color={tema.colors.dangerDark}
                  />
                </View>
              )}

              {/* Info de archivo */}
              <View style={estilos.archivoDetalles}>
                <Text style={estilos.archivoNombre} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={estilos.archivoMeta}>
                  {file.sizeStr} • {file.type.toUpperCase()}
                </Text>
              </View>

              {/* Botón eliminar */}
              <TouchableOpacity
                onPress={() => onRemoveFile(file.id)}
                style={estilos.eliminarBoton}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Eliminar ${file.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={tema.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Error o Helper */}
      {Boolean(error) ? (
        <View style={estilos.mensajeFila}>
          <Ionicons name="alert-circle" size={14} color={tema.colors.dangerDark} />
          <Text style={estilos.errorTexto}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={estilos.helperTexto}>{helper}</Text>
      ) : null}
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    marginBottom: tema.spacing.md,
  },
  etiquetaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  etiqueta: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  requiredMarcar: {
    color: tema.colors.danger,
    fontWeight: "bold",
  },
  conteoTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: tema.colors.primaryBorder,
    backgroundColor: tema.colors.primaryLight,
    borderRadius: tema.radius.lg,
    paddingVertical: 18,
    paddingHorizontal: tema.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  dropZoneError: {
    borderColor: tema.colors.danger,
    backgroundColor: "#fff5f5",
  },
  subirIconoCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...tema.shadows.sm,
  },
  dropTitulo: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.primaryDark,
    textAlign: "center",
  },
  dropHint: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  archivosLista: {
    marginTop: tema.spacing.sm,
  },
  archivoElemento: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.colors.card,
    borderWidth: 1,
    borderColor: tema.colors.border,
    borderRadius: tema.radius.md,
    padding: tema.spacing.sm,
    marginBottom: 6,
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: tema.radius.sm,
    marginRight: 10,
  },
  docIconoCaja: {
    width: 44,
    height: 44,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  archivoDetalles: {
    flex: 1,
    marginRight: 8,
  },
  archivoNombre: {
    fontSize: tema.fontSize.sm,
    fontWeight: "600",
    color: tema.colors.text,
  },
  archivoMeta: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 2,
  },
  eliminarBoton: {
    padding: 8,
    borderRadius: tema.radius.sm,
    backgroundColor: tema.colors.surfaceAlt,
  },
  mensajeFila: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  helperTexto: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 4,
  },
});
