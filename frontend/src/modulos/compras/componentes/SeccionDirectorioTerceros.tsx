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
  const { width } = useWindowDimensions();
  const esMovilEstrecho = width < 440;
  const [fichaModalEntidad, setFichaModalEntidad] = useState<EntidadData | null>(null);
  const [filtroDirectorio, setFiltroDirectorio] = useState<"activos" | "destacados" | "archivados">("activos");

  const metricasProveedores = React.useMemo(() => {
    const lista = proveedores || [];
    const activos = lista.filter((p: any) => !p.disabled);
    const archivados = lista.filter((p: any) => Boolean(p.disabled));
    const evaluados = activos.filter((p: any) => typeof p.ratingAvg === "number" && !isNaN(p.ratingAvg) && p.ratingAvg > 0);
    const destacados = evaluados.filter((p: any) => p.ratingAvg >= 4.5);
    const sumaRating = evaluados.reduce((acc: number, p: any) => acc + Number(p.ratingAvg), 0);
    const promedio = evaluados.length > 0 ? (sumaRating / evaluados.length).toFixed(1) : "—";

    return {
      activosConteo: activos.length,
      destacadosConteo: destacados.length,
      archivadosConteo: archivados.length,
      promedioGlobal: promedio,
    };
  }, [proveedores]);

  const proveedoresVisibles = React.useMemo(() => {
    const base = filtradoProveedores || [];
    if (filtroDirectorio === "archivados") {
      return base.filter((p: any) => Boolean(p.disabled));
    }
    const activos = base.filter((p: any) => !p.disabled);
    if (filtroDirectorio === "destacados") {
      return activos.filter((p: any) => typeof p.ratingAvg === "number" && !isNaN(p.ratingAvg) && p.ratingAvg >= 4.5);
    }
    return activos;
  }, [filtradoProveedores, filtroDirectorio]);

  const obtenerEstiloSemaforoProveedor = (ratingAvg?: number, disabled?: boolean) => {
    if (disabled) {
      return {
        fondoTarjeta: "#f8fafc",
        bordeTarjeta: "#cbd5e1",
        franjaLateral: "#64748b",
        colorTexto: "#334155",
        divisorColor: "#e2e8f0",
      };
    }
    if (typeof ratingAvg !== "number" || isNaN(ratingAvg) || ratingAvg <= 0) {
      return {
        fondoTarjeta: "#ffffff",
        bordeTarjeta: "#e2e8f0",
        franjaLateral: "#94a3b8",
        colorTexto: "#334155",
        divisorColor: "#f1f5f9",
      };
    }
    if (ratingAvg < 4.0) {
      return {
        fondoTarjeta: "#fffbeb",
        bordeTarjeta: "#fcd34d",
        franjaLateral: "#d97706",
        colorTexto: "#92400e",
        divisorColor: "#fde68a",
      };
    }
    return {
      fondoTarjeta: "#f0fdf4",
      bordeTarjeta: "#86efac",
      franjaLateral: "#16a34a",
      colorTexto: "#166534",
      divisorColor: "#bbf7d0",
    };
  };

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
          {/* 1. CABECERA COMPACTA INDUSTRIAL + CALIFICACIÓN MEDIA */}
          <Tarjeta variant="outlined" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 210 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: tema.colors.primaryLight,
                    borderWidth: 1,
                    borderColor: tema.colors.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="business-outline" size={20} color={tema.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: tema.colors.text }}>
                    Directorio de Proveedores
                  </Text>
                  <Text style={{ fontSize: 11, color: tema.colors.textSecondary, marginTop: 1 }}>
                    <Text style={{ fontWeight: "800", color: tema.colors.primaryDark }}>
                      {metricasProveedores.activosConteo} homologados activos
                    </Text>{" "}
                    • Calificación media: ★ {metricasProveedores.promedioGlobal}
                  </Text>
                </View>
              </View>

              <Boton
                title="Nuevo Proveedor"
                variant="primary"
                size="sm"
                icon="add-outline"
                onPress={() => {
                  establecerThirdPartyPestana("proveedores");
                  manejarAbrirPartyModal();
                }}
                style={{ minHeight: 40 }}
                fullWidth={esMovilEstrecho}
              />
            </View>
          </Tarjeta>

          {/* 2. PESTAÑAS KPI INTERACTIVAS: ACTIVOS / DESTACADOS / ARCHIVADOS */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              {
                id: "activos" as const,
                titulo: "Activos",
                valor: metricasProveedores.activosConteo,
                sub: "Habilitados OC",
                icon: "checkmark-done-circle-outline" as const,
                bg: "#f0fdf4",
                border: "#86efac",
                borderActivo: "#16a34a",
                textColor: "#166534",
              },
              {
                id: "destacados" as const,
                titulo: "Top (★ ≥ 4.5)",
                valor: metricasProveedores.destacadosConteo,
                sub: "Mejor evaluados",
                icon: "star-outline" as const,
                bg: "#fffbeb",
                border: "#fcd34d",
                borderActivo: "#d97706",
                textColor: "#92400e",
              },
              {
                id: "archivados" as const,
                titulo: "Archivados",
                valor: metricasProveedores.archivadosConteo,
                sub: "Inactivos",
                icon: "archive-outline" as const,
                bg: "#f1f5f9",
                border: "#cbd5e1",
                borderActivo: "#475569",
                textColor: "#334155",
              },
            ].map((kpi) => {
              const activo = filtroDirectorio === kpi.id;
              return (
                <TouchableOpacity
                  key={kpi.id}
                  activeOpacity={0.8}
                  onPress={() => setFiltroDirectorio(kpi.id)}
                  style={{
                    flex: 1,
                    minWidth: 105,
                    backgroundColor: kpi.bg,
                    borderWidth: activo ? 2 : 1,
                    borderColor: activo ? kpi.borderActivo : kpi.border,
                    borderLeftWidth: 5,
                    borderLeftColor: kpi.borderActivo,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: kpi.textColor,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {kpi.titulo}
                    </Text>
                    <Ionicons name={kpi.icon} size={14} color={kpi.textColor} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: kpi.textColor }}>
                      {kpi.valor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: activo ? "800" : "600",
                        color: kpi.textColor,
                      }}
                      numberOfLines={1}
                    >
                      {activo ? "● Activo" : kpi.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. BUSCADOR CON LUPA + BARRA DE ORDENAMIENTO CON ICONOS VECTORIALES */}
          <View style={{ gap: 8, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: tema.colors.card,
                borderWidth: 1,
                borderColor: tema.colors.borderDark,
                borderRadius: 10,
                paddingHorizontal: 12,
                height: 42,
              }}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={tema.colors.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                value={thirdPartyBuscar}
                onChangeText={establecerThirdPartyBuscar}
                placeholder="Buscar proveedor por RUT, Razón Social o Giro..."
                placeholderTextColor={tema.colors.textLight}
                style={{ flex: 1, minWidth: 0, fontSize: 13, color: tema.colors.text }}
              />
              {Boolean(thirdPartyBuscar) && (
                <Pressable onPress={() => establecerThirdPartyBuscar("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={tema.colors.textMuted} />
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: tema.colors.textMuted, marginRight: 2 }}>
                Ordenar:
              </Text>
              {[
                { id: "rating_desc", label: "[SCRUM] Ranking: Mayor a Menor ★", icon: "star" as const },
                { id: "rating_asc", label: "Menor Calificación", icon: "trending-down-outline" as const },
                { id: "alpha", label: "Alfabético A-Z", icon: "text-outline" as const },
              ].map((s) => {
                const activo = thirdPartyOrdenar === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => establecerThirdPartyOrdenar(s.id as any)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 7,
                      borderWidth: 1,
                      backgroundColor: activo ? (s.id === "rating_desc" ? "#fef3c7" : tema.colors.primaryLight) : "#ffffff",
                      borderColor: activo ? (s.id === "rating_desc" ? "#f59e0b" : tema.colors.primary) : tema.colors.border,
                    }}
                  >
                    <Ionicons
                      name={s.icon}
                      size={12}
                      color={activo ? (s.id === "rating_desc" ? "#b45309" : tema.colors.primaryDark) : tema.colors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: activo ? "800" : "600",
                        color: activo ? (s.id === "rating_desc" ? "#92400e" : tema.colors.primaryDark) : tema.colors.textSecondary,
                      }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. LISTA COMPACTA DE PROVEEDORES CON SEMÁFORO DE SUPERFICIE COMPLETA */}
          {proveedoresVisibles.length === 0 ? (
            <EstadoVacio
              icon={filtroDirectorio === "archivados" ? "archive-outline" : "people-outline"}
              title={
                filtroDirectorio === "archivados"
                  ? "No hay proveedores archivados"
                  : "No se encontraron proveedores"
              }
              description={
                thirdPartyBuscar
                  ? `No hay proveedores que coincidan con "${thirdPartyBuscar}".`
                  : filtroDirectorio === "archivados"
                  ? "Los proveedores que archives o deshabilites se moverán automáticamente a esta pestaña."
                  : "No hay proveedores activos registrados en este filtro."
              }
              actionTitle={filtroDirectorio !== "archivados" ? "Nuevo Proveedor" : undefined}
              onAction={
                filtroDirectorio !== "archivados"
                  ? () => {
                      establecerThirdPartyPestana("proveedores");
                      manejarAbrirPartyModal();
                    }
                  : undefined
              }
              containerStyle={{ marginVertical: 24 }}
            />
          ) : (
            proveedoresVisibles.map((s: any, idx: number) => {
              const tieneCalificacion = typeof s.ratingAvg === "number" && !isNaN(s.ratingAvg) && s.ratingAvg > 0;
              const rating = tieneCalificacion ? Number(s.ratingAvg) : 0;
              const ratingCount = s.ratingCount || 0;
              const semaforo = obtenerEstiloSemaforoProveedor(tieneCalificacion ? rating : undefined, s.disabled);
              const esRankingActivo = thirdPartyOrdenar === "rating_desc";

              return (
                <Tarjeta
                  key={s.id}
                  variant="outlined"
                  style={{
                    marginBottom: 10,
                    padding: 12,
                    backgroundColor: semaforo.fondoTarjeta,
                    borderColor: semaforo.bordeTarjeta,
                    borderWidth: 1.5,
                    borderLeftWidth: 6,
                    borderLeftColor: semaforo.franjaLateral,
                    borderRadius: 12,
                  }}
                >
                  {/* Cabecera compacta: RUT + Categoría + Ranking + Nombre a la izquierda / Badge de Calificación a la derecha */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        {esRankingActivo && tieneCalificacion && (
                          <View
                            style={{
                              backgroundColor: idx === 0 ? "#fef3c7" : idx === 1 ? "#f1f5f9" : idx === 2 ? "#ffedd5" : "#ede9fe",
                              borderWidth: 1,
                              borderColor: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#f97316" : "#8b5cf6",
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Ionicons
                              name={idx === 0 ? "trophy" : idx < 3 ? "medal" : "ribbon"}
                              size={12}
                              color={idx === 0 ? "#b45309" : idx === 1 ? "#475569" : idx === 2 ? "#c2410c" : "#6d28d9"}
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "800",
                                color: idx === 0 ? "#92400e" : idx === 1 ? "#334155" : idx === 2 ? "#9a3412" : "#5b21b6",
                              }}
                            >
                              #{idx + 1} Ranking
                            </Text>
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: semaforo.colorTexto,
                            letterSpacing: 0.3,
                          }}
                        >
                          RUT: {s.rut}
                        </Text>
                        <View
                          style={{
                            backgroundColor: "#ffffff",
                            borderWidth: 1,
                            borderColor: semaforo.bordeTarjeta,
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: tema.colors.textSecondary }}>
                            {s.category}
                          </Text>
                        </View>
                        {s.disabled && <Insignia label="Archivado" tone="mute" size="sm" />}
                      </View>

                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: tema.colors.text,
                          marginTop: 2,
                          flexShrink: 1,
                        }}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {s.businessName}
                      </Text>
                    </View>

                    {tieneCalificacion ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: "#fef3c7",
                          borderWidth: 1,
                          borderColor: "#f59e0b",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Ionicons name="star" size={13} color="#d97706" />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#92400e" }}>
                          {rating.toFixed(1)}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: "600", color: "#b45309" }}>
                          ({ratingCount} {ratingCount === 1 ? "eval" : "evals"})
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: "#f1f5f9",
                          borderWidth: 1,
                          borderColor: "#cbd5e1",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Ionicons name="star-outline" size={12} color="#94a3b8" />
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#64748b" }}>
                          Sin calificación
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Caja blanca unificada: Contacto + Datos Bancarios (Cero azul eléctrico) */}
                  <View
                    style={{
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: semaforo.divisorColor,
                      borderRadius: 9,
                      padding: 10,
                      marginTop: 8,
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: tema.colors.textSecondary }} numberOfLines={1}>
                      👤 <Text style={{ fontWeight: "700", color: tema.colors.text }}>{s.contactName}</Text> • 📞{" "}
                      {s.phone} • ✉️ {s.email}
                    </Text>
                    <Text style={{ fontSize: 11, color: tema.colors.textMuted }} numberOfLines={1}>
                      📍 {s.address}
                    </Text>

                    {s.bankDetails && rolActual === "admin" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 6,
                          backgroundColor: tema.colors.primaryLight,
                          borderWidth: 1,
                          borderColor: tema.colors.primaryBorder,
                          borderRadius: 7,
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          marginTop: 4,
                        }}
                      >
                        <Ionicons name="card-outline" size={14} color={tema.colors.primaryDark} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: tema.colors.primaryDeep,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {s.bankDetails.bank} • Cta. {s.bankDetails.accountType} N°{" "}
                          {s.bankDetails.accountNumber} ({s.bankDetails.transferEmail})
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: tema.colors.surfaceAlt,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginTop: 4,
                        }}
                      >
                        <Ionicons name="lock-closed" size={12} color={tema.colors.textMuted} />
                        <Text style={{ fontSize: 10, color: tema.colors.textMuted }}>
                          Datos bancarios protegidos (Exclusivo Administrador)
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Fila compacta de 3 acciones */}
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <Boton
                      title={rolActual === "admin" ? "Ficha" : "Ver Ficha"}
                      variant="outline"
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
                          calificacionPromedio: tieneCalificacion ? rating : undefined,
                          ratingAvg: tieneCalificacion ? rating : undefined,
                          ratingCount: ratingCount,
                          banco: s.bankDetails?.bank || "Banco Estado",
                          tipoCuenta: s.bankDetails?.accountType || "Cuenta Corriente",
                          numeroCuenta: s.bankDetails?.accountNumber || "12345678-9",
                          transferEmail: s.bankDetails?.transferEmail || s.email,
                        });
                      }}
                      style={{ flex: 1, minHeight: 34, backgroundColor: "#ffffff" }}
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
                        style={{ flex: 1.15, minHeight: 34 }}
                      />
                    )}
                    {rolActual === "admin" && (
                      <Boton
                        title={s.disabled ? "Restaurar" : "Archivar"}
                        variant={s.disabled ? "success" : "outline"}
                        size="sm"
                        icon={s.disabled ? "refresh-outline" : "archive-outline"}
                        style={{
                          flex: 1,
                          minHeight: 34,
                          backgroundColor: s.disabled ? undefined : "#ffffff",
                        }}
                        onPress={() => {
                          alternarProveedorDeshabilitado(s.id);
                          mostrarAviso(
                            `Proveedor ${s.businessName} ${
                              s.disabled
                                ? "restaurado al directorio activo."
                                : "movido a Archivados."
                            }`
                          );
                        }}
                      />
                    )}
                  </View>
                </Tarjeta>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal de Ficha del Tercero */}
      <Modal
        visible={Boolean(fichaModalEntidad)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setFichaModalEntidad(null);
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
                {`Ficha de ${fichaModalEntidad?.tipo || "Tercero"}`}
              </Text>
              <Text style={{ fontSize: 12, color: "#64748b" }}>
                Información general, contacto, calificación promedio y datos bancarios
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setFichaModalEntidad(null);
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
            }}
            mostrarComparadorScrum={false}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};
