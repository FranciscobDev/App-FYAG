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
import { theme } from "@/core/theme";

export interface UploadedFile {
  id: string;
  name: string;
  sizeStr: string;
  type: "image" | "pdf" | "doc";
  uri?: string;
}

export interface FileUploadProps {
  label: string;
  files: UploadedFile[];
  onAddFile: (file: UploadedFile) => void;
  onRemoveFile: (fileId: string) => void;
  accept?: string;
  maxFiles?: number;
  required?: boolean;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const FileUpload: React.FC<FileUploadProps> = ({
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
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  // Simulación realista de carga de archivo (Factura, Guía o Foto de Faena)
  const handleSimulatePick = () => {
    if (files.length >= maxFiles) return;

    setIsSimulatingUpload(true);
    setTimeout(() => {
      const isImg = files.length % 2 === 0;
      const newFile: UploadedFile = {
        id: "file_" + Date.now(),
        name: isImg ? `Foto_Evidencia_${files.length + 1}.jpg` : `Factura_Guia_${files.length + 1}.pdf`,
        sizeStr: isImg ? "2.4 MB" : "840 KB",
        type: isImg ? "image" : "pdf",
        uri: isImg
          ? "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&q=80"
          : undefined,
      };
      onAddFile(newFile);
      setIsSimulatingUpload(false);
    }, 600);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Etiqueta visible */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
        <Text style={styles.countText}>
          ({files.length}/{maxFiles})
        </Text>
      </View>

      {/* Zona de subida táctil */}
      {files.length < maxFiles && (
        <TouchableOpacity
          onPress={handleSimulatePick}
          disabled={isSimulatingUpload}
          activeOpacity={0.7}
          style={[
            styles.dropZone,
            Boolean(error) && styles.dropZoneError,
          ]}
        >
          <View style={styles.uploadIconCircle}>
            <Ionicons
              name={isSimulatingUpload ? "hourglass-outline" : "cloud-upload-outline"}
              size={24}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.dropTitle}>
            {isSimulatingUpload ? "Procesando adjunto..." : "Presione para adjuntar archivo o foto"}
          </Text>
          <Text style={styles.dropHint}>{accept}</Text>
        </TouchableOpacity>
      )}

      {/* Lista de archivos con vista previa */}
      {files.length > 0 && (
        <View style={styles.filesList}>
          {files.map((file) => (
            <View key={file.id} style={styles.fileItem}>
              {/* Thumbnail o Icono */}
              {file.type === "image" && file.uri ? (
                <Image source={{ uri: file.uri }} style={styles.thumbImage} />
              ) : (
                <View style={styles.docIconBox}>
                  <Ionicons
                    name={file.type === "pdf" ? "document-text" : "attach"}
                    size={22}
                    color={theme.colors.dangerDark}
                  />
                </View>
              )}

              {/* Info de archivo */}
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileMeta}>
                  {file.sizeStr} • {file.type.toUpperCase()}
                </Text>
              </View>

              {/* Botón eliminar */}
              <TouchableOpacity
                onPress={() => onRemoveFile(file.id)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Eliminar ${file.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Error o Helper */}
      {Boolean(error) ? (
        <View style={styles.msgRow}>
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerDark} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  requiredMark: {
    color: theme.colors.danger,
    fontWeight: "bold",
  },
  countText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.colors.primaryBorder,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  dropZoneError: {
    borderColor: theme.colors.danger,
    backgroundColor: "#fff5f5",
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...theme.shadows.sm,
  },
  dropTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  dropHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  filesList: {
    marginTop: theme.spacing.sm,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: 6,
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    marginRight: 10,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  fileDetails: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  fileMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dangerDark,
    marginLeft: 4,
    fontWeight: "500",
  },
  helperText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
