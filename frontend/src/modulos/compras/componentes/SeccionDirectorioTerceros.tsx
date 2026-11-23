import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha, esRutValido } from "@/nucleo/formato";
import { tema } from "@/nucleo/tema";
import {
  Insignia,
  Boton,
  Tarjeta,
  DialogoConfirmacion,
  EstadoVacio,
  BotonExportar,
  CampoTexto,
  VistaModal,
  CampoNumero,
  EncabezadoPagina,
  ModalEscanerQr,
  CalificacionEstrellas,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import {
  Cliente,
  FacturaCompra,
  ItemFacturaCompra,
  OrdenCompra,
  ItemOrdenCompra,
  Proveedor,
  CalificacionProveedor,
} from "@/nucleo/tipos";
import { FichaTercero, EntidadData } from "@/componentes/dominio/FichaTercero";
import { estilos } from "../estilos";

export interface PropiedadesSeccionDirectorioTerceros {
  activoPestana: any;
  alternarClienteDeshabilitado: any;
  alternarProveedorDeshabilitado: any;
  clientes: any;
  establecerActivoPestana: any;
  establecerThirdPartyBuscar: any;
  establecerThirdPartyOrdenar: any;
  establecerThirdPartyPestana: any;
  filtradoClientes: any;
  filtradoProveedores: any;
  manejarAbrirNuevoOrden: any;
  manejarAbrirPartyModal: any;
  mostrarAviso: any;
  partyNombre: any;
  partyRut: any;
  proveedores: any;
  rolActual: any;
  thirdPartyBuscar: any;
  thirdPartyOrdenar: any;
  thirdPartyPestana: any;
}

export const SeccionDirectorioTerceros: React.FC<PropiedadesSeccionDirectorioTerceros> = ({
  activoPestana,
  alternarClienteDeshabilitado,
  alternarProveedorDeshabilitado,
  clientes,
  establecerActivoPestana,
  establecerThirdPartyBuscar,
  establecerThirdPartyOrdenar,
  establecerThirdPartyPestana,
  filtradoClientes,
  filtradoProveedores,
  manejarAbrirNuevoOrden,
  manejarAbrirPartyModal,
  mostrarAviso,
  partyNombre,
  partyRut,
  proveedores,
  rolActual,
  thirdPartyBuscar,
  thirdPartyOrdenar,
  thirdPartyPestana,
}) => {
  const { actualizarProveedor, actualizarCliente } = usarAplicacion();
  const [fichaModalEntidad, setFichaModalEntidad] = useState<EntidadData | null>(null);
  const [mostrarModalScrum, setMostrarModalScrum] = useState<boolean>(false);

  const handleGuardarFicha = (data: Required<EntidadData>) => {
    if (data.tipo === "Proveedor") {
      actualizarProveedor(data.id, {
        businessName: data.nombre,
        email: data.contacto,
        phone: data.telefono,
        address: data.direccion,
        bankDetails: {
          bank: data.banco,
          accountType: (data.tipoCuenta?.toLowerCase().includes("vista")
            ? "vista"
            : data.tipoCuenta?.toLowerCase().includes("ahorro")
            ? "ahorro"
            : "corriente") as any,
          accountNumber: data.numeroCuenta,
          transferEmail: data.transferEmail || data.contacto,
        },
      });
      mostrarAviso(`Ficha de proveedor "${data.nombre}" actualizada correctamente.`);
    } else {
      actualizarCliente(data.id, {
        businessName: data.nombre,
        email: data.contacto,
        phone: data.telefono,
        address: data.direccion,
      });
      mostrarAviso(`Ficha de cliente "${data.nombre}" actualizada correctamente.`);
    }
    setFichaModalEntidad(null);
  };

  return (
    <>
      {/* =====================================================================
          4. TAB DIRECTORIO DE PROVEEDORES (EXCLUSIVO PROVEEDORES)
          ===================================================================== */}
      {activoPestana === "terceros" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <View style={estilos.subPestanaBarra}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 210 }}>
              <View
                style={[
                  estilos.subPestanaBoton,
                  estilos.subPestanaBotonActivo,
                  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, minHeight: 40, marginRight: 0 },
                ]}
              >
                <Ionicons name="people-outline" size={16} color={tema.colors.primaryDark} />
                <Text style={[estilos.subPestanaTexto, estilos.subPestanaTextoActivo]}>
                  Proveedores Homologados ({proveedores.length})
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginLeft: "auto" }}>
              <Boton
                title="[SCRUM] Comparar Vistas"
                variant="secondary"
                size="sm"
                icon="git-compare-outline"
                onPress={() => setMostrarModalScrum(true)}
              />
              <Boton
                title="+ Nuevo Proveedor"
                variant="primary"
                size="sm"
                onPress={() => {
                  establecerThirdPartyPestana("proveedores");
                  manejarAbrirPartyModal();
                }}
                style={{ minHeight: 40 }}
              />
            </View>
          </View>

          {/* Barra de búsqueda y ordenación de proveedores */}
          <View style={estilos.partyFiltrarFila}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <CampoTexto
                label="Buscar Proveedor"
                value={thirdPartyBuscar}
                onChangeText={establecerThirdPartyBuscar}
                placeholder="Buscar por RUT, Razón Social o Giro..."
              />
            </View>
            {Boolean(thirdPartyBuscar) && (
              <Boton
                title="Limpiar"
                variant="ghost"
                size="sm"
                icon="close-circle-outline"
                onPress={() => establecerThirdPartyBuscar("")}
                style={{ alignSelf: "flex-end", marginBottom: 8, marginRight: 8 }}
              />
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42 }}>
              {[
                { id: "rating_desc", label: "Mayor Calificación ⭐" },
                { id: "rating_asc", label: "Menor Calificación" },
                { id: "alpha", label: "Alfabético A-Z" },
              ].map((s: any) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => establecerThirdPartyOrdenar(s.id as any)}
                  style={[estilos.ordenarChip, thirdPartyOrdenar === s.id && estilos.ordenarChipActivo]}
                >
                  <Text style={[estilos.ordenarChipTexto, thirdPartyOrdenar === s.id && estilos.ordenarChipTextoActivo]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Lista de Proveedores */}
          {filtradoProveedores.length === 0 ? (
            <EstadoVacio
              icon="people-outline"
              title="No se encontraron proveedores"
              description={
                thirdPartyBuscar
                  ? `No hay proveedores que coincidan con "${thirdPartyBuscar}".`
                  : "No hay proveedores registrados en el sistema."
              }
              actionTitle="+ Nuevo Proveedor"
              onAction={() => {
                establecerThirdPartyPestana("proveedores");
                manejarAbrirPartyModal();
              }}
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            filtradoProveedores.map((s: any) => (
              <Tarjeta
                key={s.id}
                variant="default"
                style={[estilos.partyTarjeta, s.disabled && estilos.deshabilitadoPartyTarjeta]}
              >
                <View style={estilos.partySuperior}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={estilos.partyNombre}>{s.businessName}</Text>
                      {s.disabled && (
                        <Insignia label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <Text style={estilos.partyRut}>RUT: {s.rut}</Text>
                    <Text style={estilos.partyCat}>{s.category}</Text>
                  </View>
                  <Insignia
                    label={`⭐ ${s.ratingAvg?.toFixed(1) || "5.0"} (${s.ratingCount || 1} eval)`}
                    tone="warn"
                    size="md"
                  />
                </View>

                <View style={estilos.partyContactoCaja}>
                  <Text style={estilos.contactoLinea}>Contacto: {s.contactName} • {s.phone}</Text>
                  <Text style={estilos.contactoLinea}>Email: {s.email} • Dirección: {s.address}</Text>
                </View>

                {/* Sección de Datos Bancarios (SOLO VISIBLE PARA ADMIN) */}
                {s.bankDetails && rolActual === "admin" ? (
                  <View style={estilos.bancoCaja}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="card-outline" size={14} color={tema.colors.primaryDark} style={{ marginRight: 4 }} />
                      <Text style={estilos.bancoTitulo}>Datos Bancarios (Exclusivo Admin):</Text>
                    </View>
                    <Text style={estilos.bancoTexto}>
                      {s.bankDetails.bank} • Cta. {s.bankDetails.accountType} N° {s.bankDetails.accountNumber}
                    </Text>
                    <Text style={estilos.bancoTexto}>Transferencias: {s.bankDetails.transferEmail}</Text>
                  </View>
                ) : (
                  <View style={estilos.restrictedBancoCaja}>
                    <Ionicons name="lock-closed" size={14} color={tema.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={estilos.restrictedBancoTexto}>
                      Datos bancarios protegidos (Visible solo para perfil Administrador)
                    </Text>
                  </View>
                )}

                {/* Acción: Ver Ficha, Deshabilitar o Crear OC */}
                <View style={estilos.partyAcciones}>
                  <Boton
                    title={rolActual === "admin" ? "Gestionar Ficha" : "Ver Ficha"}
                    variant="secondary"
                    size="sm"
                    icon="document-text-outline"
                    onPress={() => {
                      setFichaModalEntidad({
                        id: s.id,
                        rut: s.rut,
                        nombre: s.businessName,
                        tipo: "Proveedor",
                        contacto: s.email,
                        telefono: s.phone,
                        direccion: s.address,
                        calificacionPromedio: s.ratingAvg || 4.7,
                        banco: s.bankDetails?.bank || "Banco Estado",
                        tipoCuenta: s.bankDetails?.accountType || "Cuenta Corriente",
                        numeroCuenta: s.bankDetails?.accountNumber || "12345678-9",
                        transferEmail: s.bankDetails?.transferEmail || s.email,
                      });
                    }}
                    style={{ marginRight: 8 }}
                  />
                  {!s.disabled && rolActual === "admin" && (
                    <Boton
                      title="Crear OC"
                      variant="primary"
                      size="sm"
                      icon="cart-outline"
                      onPress={() => {
                        manejarAbrirNuevoOrden(s.id);
                      }}
                      style={{ flex: 1, minHeight: 38 }}
                    />
                  )}
                  {rolActual === "admin" && (
                    <Boton
                      title={s.disabled ? "Habilitar Proveedor" : "Deshabilitar"}
                      variant={s.disabled ? "success" : "secondary"}
                      size="sm"
                      icon={s.disabled ? "checkmark-circle-outline" : "ban-outline"}
                      style={{ flex: 1, minHeight: 38 }}
                      onPress={() => {
                        alternarProveedorDeshabilitado(s.id);
                        mostrarAviso(`Proveedor ${s.businessName} ${s.disabled ? "habilitado" : "deshabilitado"}.`);
                      }}
                    />
                  )}
                </View>
              </Tarjeta>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal de Ficha del Tercero [FRONT-2 / SCRUM] */}
      <Modal
        visible={Boolean(fichaModalEntidad) || mostrarModalScrum}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setFichaModalEntidad(null);
          setMostrarModalScrum(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: "#ffffff",
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                {mostrarModalScrum
                  ? "[SCRUM] Comparativa de Ficha Técnica"
                  : `Ficha de ${fichaModalEntidad?.tipo || "Tercero"}`}
              </Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>
                FRONT-2: Control de acceso a datos bancarios y calificación promedio
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setFichaModalEntidad(null);
                setMostrarModalScrum(false);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: "#f1f5f9",
              }}
            >
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>

          <FichaTercero
            entidadData={
              fichaModalEntidad || {
                nombre: "Proveedor Ejemplo SpA",
                tipo: "Proveedor",
                contacto: "contacto@ejemplo.cl",
                calificacionPromedio: 4.7,
                banco: "Banco Estado",
                tipoCuenta: "Cuenta Corriente",
                numeroCuenta: "12345678-9",
              }
            }
            userRole={rolActual === "admin" ? "Administrador" : "Bodeguero"}
            onSave={handleGuardarFicha}
            onClose={() => {
              setFichaModalEntidad(null);
              setMostrarModalScrum(false);
            }}
            mostrarComparadorScrum={true}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};
