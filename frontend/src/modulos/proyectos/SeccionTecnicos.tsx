import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/nucleo/tema";
import { estilos } from "./estilos";
import {
  Tecnico,
  asignarTecnico,
  listarTecnicos,
  listarTecnicosDeProyecto,
  quitarTecnico,
} from "./proyectosApi";

type Props = {
  proyectoId: number;
  onAviso?: (mensaje: string) => void;
};

const inicial = (nombre: string) => nombre.trim().charAt(0).toUpperCase();

export const SeccionTecnicos: React.FC<Props> = ({ proyectoId, onAviso }) => {
  const [asignados, establecerAsignados] = useState<Tecnico[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);

  const [modalVisible, establecerModalVisible] = useState(false);
  const [todos, establecerTodos] = useState<Tecnico[]>([]);
  const [cargandoModal, establecerCargandoModal] = useState(false);
  const [errorModal, establecerErrorModal] = useState<string | null>(null);
  const [asignando, establecerAsignando] = useState<number | null>(null);

  const cargarAsignados = useCallback(async () => {
    establecerCargando(true);
    const res = await listarTecnicosDeProyecto(proyectoId);
    if (res.ok && res.data) {
      establecerAsignados(res.data);
      establecerError(null);
    } else {
      establecerError(res.error ?? "No se pudieron cargar los técnicos");
    }
    establecerCargando(false);
  }, [proyectoId]);

  const cargarTodos = useCallback(async () => {
    establecerCargandoModal(true);
    const res = await listarTecnicos();
    if (res.ok && res.data) {
      establecerTodos(res.data);
      establecerErrorModal(null);
    } else {
      establecerErrorModal(res.error ?? "No se pudieron cargar los técnicos");
    }
    establecerCargandoModal(false);
  }, []);

  useEffect(() => {
    cargarAsignados();
  }, [cargarAsignados]);

  const abrirModal = async () => {
    establecerModalVisible(true);
    await cargarTodos();
  };

  const disponibles = todos.filter(
    (t) => !asignados.some((a) => a.id_usuario === t.id_usuario)
  );

  const asignar = async (t: Tecnico) => {
    establecerAsignando(t.id_usuario);
    const res = await asignarTecnico(proyectoId, t.id_usuario);
    establecerAsignando(null);

    if (!res.ok || !res.data) {
      onAviso?.(res.error ?? "No se pudo asignar el técnico");
      return;
    }
    establecerAsignados((prev) => [...prev, t]);
    establecerModalVisible(false);
    onAviso?.(res.data.mensaje);
  };

    const quitar = async (t: Tecnico) => {
  const res = await quitarTecnico(proyectoId, t.id_usuario);
  if (!res.ok || !res.data) {
    onAviso?.(res.error ?? "No se pudo quitar el técnico");
    return;
  }
  establecerAsignados((prev) =>
    prev.filter((x) => x.id_usuario !== t.id_usuario)
  );
  onAviso?.(res.data.mensaje);
    };
  const contenidoModal = () => {
    if (cargandoModal) {
      return <ActivityIndicator color={tema.colors.primary} />;
    }
    if (errorModal) {
      return <Text style={estilos.errorTexto}>{errorModal}</Text>;
    }
    if (todos.length === 0) {
      return (
        <Text style={estilos.vacioNota}>
          No hay técnicos activos. Revisa que el usuario tenga el rol Técnico y esté activo.
        </Text>
      );
    }
    if (disponibles.length === 0) {
      return (
        <Text style={estilos.vacioNota}>
          Todos los técnicos ya están asignados a este proyecto.
        </Text>
      );
    }
    return disponibles.map((t) => (
      <Pressable
        key={t.id_usuario}
        style={estilos.tecnicoFila}
        onPress={() => asignar(t)}
        disabled={asignando !== null}
      >
        <View style={estilos.tecnicoAvatar}>
          <Text style={styles.avatarTexto}>{inicial(t.nombre)}</Text>
        </View>
        <View style={estilos.tecnicoInfoColumna}>
          <Text style={estilos.tecnicoNombre}>{t.nombre}</Text>
        </View>
        {asignando === t.id_usuario ? (
          <ActivityIndicator color={tema.colors.primary} />
        ) : (
          <Ionicons name="add-circle-outline" size={22} color={tema.colors.primary} />
        )}
      </Pressable>
    ));
  };

  return (
    <View style={[estilos.finalAuditoriaTarjeta, { marginTop: 0 }]}>
      <View style={styles.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.subTitulo}>Técnicos asignados</Text>
          <Text style={estilos.seccionSubtitulo}>{asignados.length} asignado(s)</Text>
        </View>
        <TouchableOpacity style={styles.botonAsignar} onPress={abrirModal}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.botonAsignarTexto}>Asignar</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator color={tema.colors.primary} />
      ) : error ? (
        <Text style={estilos.errorTexto}>{error}</Text>
      ) : asignados.length === 0 ? (
        <Text style={estilos.vacioNota}>Este proyecto no tiene técnicos asignados.</Text>
      ) : (
        asignados.map((t) => (
          <View key={t.id_usuario} style={estilos.tecnicoFila}>
            <View style={estilos.tecnicoAvatar}>
              <Text style={styles.avatarTexto}>{inicial(t.nombre)}</Text>
            </View>
            <View style={estilos.tecnicoInfoColumna}>
              <Text style={estilos.tecnicoNombre}>{t.nombre}</Text>
            </View>
              <Pressable onPress={() => quitar(t)} hitSlop={8}>
                <Ionicons name="close-circle-outline" size={22} color={tema.colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => establecerModalVisible(false)}
      >
        <View style={estilos.contenedor}>
          <Text style={estilos.subTitulo}>Asignar técnico</Text>
          <Text style={estilos.subDescripcion}>
            Elige un técnico para agregarlo al proyecto.
          </Text>

          <ScrollView contentContainerStyle={estilos.detalleScroll}>
            {contenidoModal()}
          </ScrollView>

          <View style={estilos.modalBotonesFila}>
            <TouchableOpacity
              style={styles.botonSecundario}
              onPress={() => establecerModalVisible(false)}
            >
              <Text style={styles.botonSecundarioTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  botonAsignar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tema.radius.md,
  },
  botonAsignarTexto: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: tema.fontSize.xs,
  },
  avatarTexto: {
    color: tema.colors.primaryDark,
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
  botonSecundario: {
    backgroundColor: tema.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tema.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tema.radius.md,
  },
  botonSecundarioTexto: {
    color: tema.colors.text,
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
});