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
  return (
    <>
      {/* =====================================================================
          4. TAB TERCEROS (PROVEEDORES Y CLIENTES)
          ===================================================================== */}
      {activoPestana === "terceros" && (
        <ScrollView style={estilos.pestanaContenido} contentContainerStyle={estilos.scrollCuerpo}>
          <View style={estilos.subPestanaBarra}>
            <TouchableOpacity
              onPress={() => establecerThirdPartyPestana("proveedores")}
              style={[estilos.subPestanaBoton, thirdPartyPestana === "proveedores" && estilos.subPestanaBotonActivo]}
            >
              <Text
                style={[
                  estilos.subPestanaTexto,
                  thirdPartyPestana === "proveedores" && estilos.subPestanaTextoActivo,
                ]}
              >
                Proveedores ({proveedores.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => establecerThirdPartyPestana("clientes")}
              style={[estilos.subPestanaBoton, thirdPartyPestana === "clientes" && estilos.subPestanaBotonActivo]}
            >
              <Text
                style={[
                  estilos.subPestanaTexto,
                  thirdPartyPestana === "clientes" && estilos.subPestanaTextoActivo,
                ]}
              >
                Clientes ({clientes.length})
              </Text>
            </TouchableOpacity>

            <Boton
              title={`+ Nuevo ${thirdPartyPestana === "proveedores" ? "Proveedor" : "Cliente"}`}
              variant="primary"
              size="sm"
              onPress={manejarAbrirPartyModal}
            />
          </View>

          {/* Barra de búsqueda y ordenación */}
          <View style={estilos.partyFiltrarFila}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <CampoTexto
                label="Buscar Terceros"
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
            {thirdPartyPestana === "proveedores" && (
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
            )}
          </View>

          {/* Lista de Proveedores */}
          {thirdPartyPestana === "proveedores" ? (
            filtradoProveedores.length === 0 ? (
              <EstadoVacio
                icon="people-outline"
                title="No se encontraron proveedores"
                description={
                  thirdPartyBuscar
                    ? `No hay proveedores que coincidan con "${thirdPartyBuscar}".`
                    : "No hay proveedores registrados en el sistema."
                }
                actionTitle="+ Nuevo Proveedor"
                onAction={manejarAbrirPartyModal}
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

                {/* Acción: Deshabilitar o Crear OC */}
                <View style={estilos.partyAcciones}>
                  {!s.disabled && rolActual === "admin" && (
                    <Boton
                      title="Crear OC"
                      variant="primary"
                      size="sm"
                      icon="cart-outline"
                      onPress={() => {
                        manejarAbrirNuevoOrden(s.id);
                      }}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Boton
                    title={s.disabled ? "Habilitar Proveedor" : "Deshabilitar"}
                    variant={s.disabled ? "success" : "secondary"}
                    size="sm"
                    icon={s.disabled ? "checkmark-circle-outline" : "ban-outline"}
                    onPress={() => {
                      alternarProveedorDeshabilitado(s.id);
                      mostrarAviso(`Proveedor ${s.businessName} ${s.disabled ? "habilitado" : "deshabilitado"}.`);
                    }}
                  />
                </View>
              </Tarjeta>
            ))
            )
          ) : (
            filtradoClientes.length === 0 ? (
              <EstadoVacio
                icon="business-outline"
                title="No se encontraron clientes"
                description={
                  thirdPartyBuscar
                    ? `No hay clientes que coincidan con "${thirdPartyBuscar}".`
                    : "No hay clientes registrados en el sistema."
                }
                actionTitle="+ Nuevo Cliente"
                onAction={manejarAbrirPartyModal}
                containerStyle={{ marginVertical: 24 }}
              />
            ) : (
              filtradoClientes.map((c: any) => (
              <Tarjeta
                key={c.id}
                variant="default"
                style={[estilos.partyTarjeta, c.disabled && estilos.deshabilitadoPartyTarjeta]}
              >
                <View style={estilos.partySuperior}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={estilos.partyNombre}>{c.businessName}</Text>
                      {c.disabled && (
                        <Insignia label="Deshabilitado" tone="mute" size="sm" style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <Text style={estilos.partyRut}>RUT: {c.rut}</Text>
                    <Text style={estilos.partyCat}>{c.category}</Text>
                  </View>
                  <Insignia
                    label={`${c.activeProjectsCount} obras activas`}
                    tone="info"
                    size="sm"
                  />
                </View>

                <View style={estilos.partyContactoCaja}>
                  <Text style={estilos.contactoLinea}>Contacto: {c.contactName} • {c.phone}</Text>
                  <Text style={estilos.contactoLinea}>Email: {c.email} • Dirección: {c.address}</Text>
                </View>

                {/* Acción: Deshabilitar en vez de eliminar */}
                <View style={estilos.partyAcciones}>
                  <Boton
                    title={c.disabled ? "Habilitar Cliente" : "Deshabilitar"}
                    variant={c.disabled ? "success" : "secondary"}
                    size="sm"
                    icon={c.disabled ? "checkmark-circle-outline" : "ban-outline"}
                    onPress={() => {
                      alternarClienteDeshabilitado(c.id);
                      mostrarAviso(`Cliente ${c.businessName} ${c.disabled ? "habilitado" : "deshabilitado"}.`);
                    }}
                  />
                </View>
              </Tarjeta>
            ))
            )
          )}
        </ScrollView>
      )}
    </>
  );
};
