import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Boton } from "@/componentes/base/Boton";
import { CampoContrasena } from "@/componentes/formularios/CampoContrasena";
import { restablecerClaveApi } from "@/modulos/autenticacion/recuperacionApi";
import { tema } from "@/nucleo/tema";

interface PropiedadesPantallaRestablecerClave {
  token: string;
  /** Vuelve al inicio de sesión (tras éxito) */
  onTerminado: () => void;
  /** Lleva a solicitar un enlace nuevo (enlace vencido o ya usado) */
  onSolicitarNuevo: () => void;
}

// Misma política que el backend (services/claves.ts)
const cumplePolitica = (clave: string) => ({
  longitud: clave.length >= 10,
  mayuscula: /[A-Z]/.test(clave),
  numero: /[0-9]/.test(clave),
});

export const PantallaRestablecerClave: React.FC<PropiedadesPantallaRestablecerClave> = ({
  token,
  onTerminado,
  onSolicitarNuevo,
}) => {
  const [contrasena, establecerContrasena] = useState("");
  const [confirmacion, establecerConfirmacion] = useState("");
  const [cargando, establecerCargando] = useState(false);
  const [exito, establecerExito] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const [enlaceInvalido, establecerEnlaceInvalido] = useState(false);

  const politica = cumplePolitica(contrasena);
  const coincide = contrasena.length > 0 && contrasena === confirmacion;
  const formularioValido = politica.longitud && politica.mayuscula && politica.numero && coincide;

  const enviar = async () => {
    if (!formularioValido) {
      establecerError("Revisa los requisitos de la contraseña.");
      return;
    }
    establecerCargando(true);
    establecerError(null);
    const respuesta = await restablecerClaveApi(token, contrasena);
    establecerCargando(false);

    if (respuesta.ok) {
      establecerExito(true);
      return;
    }
    establecerError(respuesta.mensaje);
    // Enlace vencido, usado o inexistente: se ofrece pedir uno nuevo
    establecerEnlaceInvalido(respuesta.codigo === "ENLACE_INVALIDO");
  };

  if (exito) {
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>Contraseña actualizada</Text>
          <Text style={estilos.texto}>
            Tu contraseña fue cambiada y todas tus sesiones anteriores se cerraron. Inicia sesión con tu nueva contraseña.
          </Text>
          <Boton title="Ir a iniciar sesión" variant="primary" size="md" onPress={onTerminado} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Restablecer contraseña</Text>
        <Text style={estilos.texto}>Ingresa tu nueva contraseña.</Text>

        <CampoContrasena
          label="Nueva contraseña"
          value={contrasena}
          onChangeText={establecerContrasena}
          required
          disabled={cargando}
        />
        <CampoContrasena
          label="Confirmar contraseña"
          value={confirmacion}
          onChangeText={establecerConfirmacion}
          required
          disabled={cargando}
          error={confirmacion.length > 0 && !coincide ? "Las contraseñas no coinciden" : undefined}
        />

        <View style={estilos.requisitos}>
          <Text style={politica.longitud ? estilos.cumple : estilos.noCumple}>• Mínimo 10 caracteres</Text>
          <Text style={politica.mayuscula ? estilos.cumple : estilos.noCumple}>• Una letra mayúscula</Text>
          <Text style={politica.numero ? estilos.cumple : estilos.noCumple}>• Un número</Text>
        </View>

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Boton
          title="Guardar nueva contraseña"
          variant="primary"
          size="md"
          loading={cargando}
          disabled={!formularioValido || cargando}
          onPress={enviar}
          style={{ marginTop: 8 }}
        />

        {enlaceInvalido ? (
          <Boton
            title="Solicitar un enlace nuevo"
            variant="secondary"
            size="md"
            onPress={onSolicitarNuevo}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: tema.colors.background,
  },
  tarjeta: {
    backgroundColor: tema.colors.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: tema.colors.border,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  titulo: { fontSize: 20, fontWeight: "700", color: tema.colors.text, marginBottom: 8 },
  texto: { fontSize: 14, color: tema.colors.textSecondary, marginBottom: 16 },
  requisitos: { marginTop: 4, marginBottom: 8, gap: 2 },
  cumple: { fontSize: 13, color: tema.colors.ok },
  noCumple: { fontSize: 13, color: tema.colors.textMuted },
  error: { fontSize: 13, color: tema.colors.danger, marginTop: 4 },
});
