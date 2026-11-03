import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatearFecha } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  EstadoVacio,
} from "@/componentes/comunes";
import { estilos } from "../estilos";

export interface PropiedadesSeccionSolicitudesMaterial {
  activoPestana: any;
  aprobarSolicitudMaterial: any;
  cancelarSolicitudMaterial: any;
  establecerRechazarModalSolicitud: any;
  establecerRechazarMotivo: any;
  establecerSeleccionadoTimelineSolicitud: any;
  establecerSolicitudPestana: any;
  filtradoSolicitudes: any;
  manejarAbrirNuevoSolicitud: any;
  modificarSolicitudMaterial: any;
  mostrarAviso: any;
  rolActual: any;
  solicitudPestana: any;
  usuario: any;
}

export const SeccionSolicitudesMaterial: React.FC<PropiedadesSeccionSolicitudesMaterial> = ({
  activoPestana,
  aprobarSolicitudMaterial,
  cancelarSolicitudMaterial,
  establecerRechazarModalSolicitud,
  establecerRechazarMotivo,
  establecerSeleccionadoTimelineSolicitud,
  establecerSolicitudPestana,
  filtradoSolicitudes,
  manejarAbrirNuevoSolicitud,
  modificarSolicitudMaterial,
  mostrarAviso,
  rolActual,
  solicitudPestana,
  usuario,
}) => {
  const { width } = useWindowDimensions();
  const esMovil = width < 480;

  return (
    <>
      {/* =====================================================================
          3. TAB SOLICITUDES
          ===================================================================== */}
      {activoPestana === "solicitudes" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <View style={estilos.solicitudSuperiorBarra}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.solicitudPestanasScroll}>
              {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((t: any) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => establecerSolicitudPestana(t)}
                  style={[estilos.solicitudPestanaBoton, solicitudPestana === t && estilos.solicitudPestanaBotonActivo]}
                >
                  <Text style={[estilos.solicitudPestanaTexto, solicitudPestana === t && estilos.solicitudPestanaTextoActivo]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Boton
              title="Nueva Solicitud"
              variant="primary"
              size="sm"
              icon="add-outline"
              onPress={manejarAbrirNuevoSolicitud}
            />
          </View>

          {filtradoSolicitudes.length === 0 ? (
            <EstadoVacio
              icon="document-text-outline"
              title="Sin solicitudes"
              description={
                solicitudPestana === "todas"
                  ? "No se registran solicitudes de materiales en el sistema."
                  : `No hay solicitudes con estado "${solicitudPestana}".`
              }
              actionTitle={rolActual !== "warehouse" ? "Nueva Solicitud" : undefined}
              onAction={rolActual !== "warehouse" ? manejarAbrirNuevoSolicitud : undefined}
              containerStyle={{ marginVertical: 32 }}
            />
          ) : (
            filtradoSolicitudes.map((req: any) => (
              <Tarjeta key={req.id} variant="elevated" style={estilos.solicitudElementoTarjeta}>
                <View style={estilos.solicitudElementoSuperior}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <View style={estilos.solicitudEncabezadoFila}>
                      <Text style={estilos.solicitudCodigoTexto}>{req.code}</Text>
                      <Insignia
                        label={req.status.toUpperCase()}
                        tone={
                          req.status === "aprobada"
                            ? "ok"
                            : req.status === "rechazada"
                            ? "danger"
                            : "warn"
                        }
                        size="sm"
                      />
                      {req.receiptNumber && (
                        <Insignia
                          label={`N° ${req.receiptNumber}`}
                          tone="info"
                          size="sm"
                        />
                      )}
                    </View>
                    <Text style={estilos.solicitudProyectoNombre}>{req.projectName}</Text>
                    <Text style={estilos.solicitudTecnicoInfo}>
                      Por: {req.technicianName} • {formatearFecha(req.date)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => establecerSeleccionadoTimelineSolicitud(req)}
                    style={estilos.timelineEnlaceBoton}
                  >
                    <Ionicons name="git-network-outline" size={16} color={tema.colors.primary} />
                    <Text style={estilos.timelineEnlaceTexto}>Línea de tiempo</Text>
                  </TouchableOpacity>
                </View>

                <View style={estilos.solicitudElementosCaja}>
                  <Text style={estilos.elementosCajaTitulo}>Ítems Solicitados:</Text>
                  {req.items.map((it: any, idx: any) => (
                    <View key={idx} style={estilos.solicitudElementoResumenFila}>
                      <Text style={estilos.solicitudElementoFila}>
                        • {it.quantity} {it.unit} de {it.name}
                      </Text>
                      {it.deliveredQuantity !== undefined && it.deliveredQuantity > 0 && (
                        <Text style={estilos.entregadoResumenTexto}>
                          (Entregados: {it.deliveredQuantity} / {it.quantity})
                        </Text>
                      )}
                    </View>
                  ))}
                  {req.rejectionReason && (
                    <View style={estilos.rechazarAviso}>
                      <Text style={estilos.rechazarAvisoTitulo}>Motivo de rechazo:</Text>
                      <Text style={estilos.rechazarAvisoTexto}>{req.rejectionReason}</Text>
                    </View>
                  )}
                </View>

                {/* Botones de acción según rol */}
                <View style={estilos.solicitudBotonesFila}>
                  {/* Admin aprueba o rechaza (con motivo obligatorio) */}
                  {req.status === "pendiente" && rolActual === "admin" && (
                    <>
                      <Boton
                        title="Rechazar"
                        variant="outline"
                        size="sm"
                        icon="close-outline"
                        onPress={() => {
                          establecerRechazarModalSolicitud(req);
                          establecerRechazarMotivo("");
                        }}
                        style={[
                          { borderColor: tema.colors.danger },
                          esMovil && { flexGrow: 1 },
                        ]}
                        textStyle={{ color: tema.colors.danger }}
                      />
                      <Boton
                        title="Aprobar y Generar Comprobante"
                        variant="success"
                        size="sm"
                        icon="checkmark-outline"
                        onPress={() => {
                          aprobarSolicitudMaterial(req.id, usuario.name);
                          mostrarAviso(`Solicitud ${req.code} aprobada. Comprobante generado.`);
                        }}
                        style={esMovil ? { flexGrow: 1 } : undefined}
                      />
                    </>
                  )}

                  {/* Bodeguero puede Modificar o Anular si está Pendiente */}
                  {req.status === "pendiente" && rolActual === "warehouse" && (
                    <>
                      <Boton
                        title="Anular Solicitud"
                        variant="danger"
                        size="sm"
                        icon="trash-outline"
                        onPress={() => {
                          cancelarSolicitudMaterial(req.id);
                          mostrarAviso(`Solicitud ${req.code} anulada.`);
                        }}
                        style={esMovil ? { flexGrow: 1 } : undefined}
                      />
                      <Boton
                        title="Modificar Cantidades"
                        variant="secondary"
                        size="sm"
                        icon="create-outline"
                        onPress={() => {
                          const updated = req.items.map((i: any) => ({
                            ...i,
                            quantity: Math.max(1, i.quantity - 1),
                          }));
                          modificarSolicitudMaterial(req.id, updated);
                          mostrarAviso(`Cantidades de solicitud ${req.code} modificadas.`);
                        }}
                        style={esMovil ? { flexGrow: 1 } : undefined}
                      />
                    </>
                  )}
                </View>
              </Tarjeta>
            ))
          )}
        </ScrollView>
      )}
    </>
  );
};
