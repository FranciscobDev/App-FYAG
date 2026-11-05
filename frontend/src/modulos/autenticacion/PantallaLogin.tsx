import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { tema } from "@/nucleo/tema";
import { usarSesion } from "@/contexto/ContextoSesion";

export const PantallaLogin: React.FC = () => {
  const { iniciarSesion } = usarSesion();
  const [correo, establecerCorreo] = useState("");
  const [contrasena, establecerContrasena] = useState("");
  const [error, establecerError] = useState<string | null>(null);
  const [cargando, establecerCargando] = useState(false);

  const entrar = async () => {
    if (!correo.trim() || !contrasena) {
      establecerError("Ingresa tu correo y contraseña.");
      return;
    }
    establecerCargando(true);
    establecerError(null);
    const mensaje = await iniciarSesion(correo.trim(), contrasena);
    establecerCargando(false);
    if (mensaje) establecerError(mensaje);
  };

  return (
    <View style={styles.contenedor}>
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Iniciar sesión</Text>
        <Text style={styles.subtitulo}>Ingresa con tu correo y contraseña.</Text>

        <Text style={styles.etiqueta}>Correo</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={correo}
          onChangeText={establecerCorreo}
        />

        <Text style={styles.etiqueta}>Contraseña</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={contrasena}
          onChangeText={establecerContrasena}
          onSubmitEditing={entrar}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.boton} onPress={entrar} disabled={cargando}>
          {cargando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botonTexto}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: "center",
    padding: tema.spacing.md,
    backgroundColor: tema.colors.background,
  },
  tarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: tema.radius.lg,
    borderWidth: 1,
    borderColor: tema.colors.border,
    padding: tema.spacing.lg,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  titulo: {
    fontSize: tema.fontSize.lg,
    fontWeight: "bold",
    color: tema.colors.text,
  },
  subtitulo: {
    fontSize: tema.fontSize.xs,
    color: tema.colors.textMuted,
    marginTop: 4,
    marginBottom: tema.spacing.md,
  },
  etiqueta: {
    fontSize: tema.fontSize.xs,
    fontWeight: "bold",
    color: tema.colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: tema.colors.borderDark,
    borderRadius: tema.radius.md,
    paddingHorizontal: 12,
    fontSize: tema.fontSize.sm,
    color: tema.colors.text,
    backgroundColor: tema.colors.card,
  },
  error: {
    color: tema.colors.danger,
    fontSize: tema.fontSize.xs,
    marginTop: tema.spacing.sm,
  },
  boton: {
    backgroundColor: tema.colors.primary,
    height: 46,
    borderRadius: tema.radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: tema.spacing.md,
  },
  botonTexto: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: tema.fontSize.sm,
  },
});