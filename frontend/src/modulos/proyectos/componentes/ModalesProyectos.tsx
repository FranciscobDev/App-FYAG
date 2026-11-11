import React, { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usarAplicacion } from "@/contexto/ContextoAplicacion";
import { usarAutenticacion } from "@/contexto/ContextoAutenticacion";
import { formatearCLP, formatearFecha } from "@/nucleo/formato";
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
  EncabezadoPagina,
  BarraProgreso,
  ContenedorEstadoPantalla,
  NotificacionFlotante,
} from "@/componentes/comunes";
import { Proyecto, TipoProyecto, EstadoProyecto } from "@/nucleo/tipos";
import { SelectorFecha } from "@/componentes/formularios/SelectorFecha";
import { estilos } from "../estilos";

export interface PropiedadesModalesProyectos {
  adminManualDescripcion: any;
  adminManualError: any;
  adminManualFecha: any;
  adminManualHoras: any;
  adminManualModalAbrir: any;
  adminManualMotivo: any;
  adminManualTecnicoRut: any;
  cerrarBloques: any;
  cerrarModalVisible: any;
  cerrarProyectoTarget: any;
  clientes: any;
  editandoProyecto: any;
  establecerAdminManualDescripcion: any;
  establecerAdminManualFecha: any;
  establecerAdminManualHoras: any;
  establecerAdminManualModalAbrir: any;
  establecerAdminManualMotivo: any;
  establecerAdminManualTecnicoRut: any;
  establecerCerrarModalVisible: any;
  establecerFormularioClase: any;
  establecerFormularioCliente: any;
  establecerFormularioClienteError: any;
  establecerFormularioDireccion: any;
  establecerFormularioEstado: any;
  establecerFormularioIniciarFecha: any;
  establecerFormularioModalVisible: any;
  establecerFormularioNombre: any;
  establecerFormularioNombreError: any;
  establecerFormularioPlazo: any;
  establecerFormularioPresupuestoHoras: any;
  establecerFormularioPresupuestoMateriales: any;
  establecerFormularioVentaValor: any;
  formularioClase: any;
  formularioCliente: any;
  formularioClienteError: any;
  formularioDireccion: any;
  formularioError: any;
  formularioEstado: any;
  formularioIniciarFecha: any;
  formularioModalVisible: any;
  formularioNombre: any;
  formularioNombreError: any;
  formularioPlazo: any;
  formularioPresupuestoHoras: any;
  formularioPresupuestoMateriales: any;
  formularioVentaValor: any;
  manejarConfirmarAdminManualHoras: any;
  manejarConfirmarCerrar: any;
  manejarGuardarProyecto: any;
  proyectoNombreEntradaReferencia: any;
  seleccionadoProyecto: any;
  tecnicos: any;
  usuario: any;
}

export const ModalesProyectos: React.FC<PropiedadesModalesProyectos> = ({
  adminManualDescripcion,
  adminManualError,
  adminManualFecha,
  adminManualHoras,
  adminManualModalAbrir,
  adminManualMotivo,
  adminManualTecnicoRut,
  cerrarBloques,
  cerrarModalVisible,
  cerrarProyectoTarget,
  clientes,
  editandoProyecto,
  establecerAdminManualDescripcion,
  establecerAdminManualFecha,
  establecerAdminManualHoras,
  establecerAdminManualModalAbrir,
  establecerAdminManualMotivo,
  establecerAdminManualTecnicoRut,
  establecerCerrarModalVisible,
  establecerFormularioClase,
  establecerFormularioCliente,
  establecerFormularioClienteError,
  establecerFormularioDireccion,
  establecerFormularioEstado,
  establecerFormularioIniciarFecha,
  establecerFormularioModalVisible,
  establecerFormularioNombre,
  establecerFormularioNombreError,
  establecerFormularioPlazo,
  establecerFormularioPresupuestoHoras,
  establecerFormularioPresupuestoMateriales,
  establecerFormularioVentaValor,
  formularioClase,
  formularioCliente,
  formularioClienteError,
  formularioDireccion,
  formularioError,
  formularioEstado,
  formularioIniciarFecha,
  formularioModalVisible,
  formularioNombre,
  formularioNombreError,
  formularioPlazo,
  formularioPresupuestoHoras,
  formularioPresupuestoMateriales,
  formularioVentaValor,
  manejarConfirmarAdminManualHoras,
  manejarConfirmarCerrar,
  manejarGuardarProyecto,
  proyectoNombreEntradaReferencia,
  seleccionadoProyecto,
  tecnicos,
  usuario,
}) => {
  return (
    <>
      {/* =====================================================================
          3. FORMULARIO DE PROYECTO (NO EDITABLE SI ESTÁ CERRADO, NUNCA ELIMINAR)
          ===================================================================== */}
      <VistaModal
        visible={formularioModalVisible}
        onClose={() => establecerFormularioModalVisible(false)}
        title={editandoProyecto ? `Editar Proyecto: ${editandoProyecto.code}` : "Nuevo Proyecto / Obra"}
        subtitle="Nombre, cliente, fechas, presupuestos de materiales y HH, valor de venta"
      >
        {/* 1. INFORMACIÓN GENERAL */}
        <Text style={estilos.formularioSeccionEncabezado}>1. Información General del Proyecto</Text>
        <CampoTexto
          ref={proyectoNombreEntradaReferencia}
          label="Nombre del Proyecto"
          value={formularioNombre}
          onChangeText={(text: any) => {
            establecerFormularioNombre(text);
            if (formularioNombreError) establecerFormularioNombreError("");
          }}
          error={formularioNombreError}
          placeholder="Ej: Montaje Tableros Centro Logístico"
        />

        {/* Selector de Cliente */}
        <Text style={estilos.campoEtiqueta}>Cliente:</Text>
        {Boolean(formularioClienteError) && (
          <Text style={[estilos.errorTexto, { marginBottom: 4 }]}>{formularioClienteError}</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {clientes.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => {
                establecerFormularioCliente(c.businessName);
                if (formularioClienteError) establecerFormularioClienteError("");
              }}
              style={[estilos.clienteChip, formularioCliente === c.businessName && estilos.clienteChipActivo]}
            >
              <Text style={[estilos.clienteChipTexto, formularioCliente === c.businessName && estilos.clienteChipTextoActivo]}>
                {c.businessName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <CampoTexto
          label="Dirección de la Obra / Faena"
          value={formularioDireccion}
          onChangeText={establecerFormularioDireccion}
          placeholder="Ej: Camino El Alba 1200, Quilicura"
        />

        <Text style={estilos.campoEtiqueta}>Tipo de Proyecto:</Text>
        <View style={estilos.botonGrupoFila}>
          <TouchableOpacity
            onPress={() => establecerFormularioClase("obra")}
            style={[estilos.grupoBoton, formularioClase === "obra" && estilos.grupoBotonActivo]}
          >
            <Text style={[estilos.grupoBotonTexto, formularioClase === "obra" && estilos.grupoBotonTextoActivo]}>
              OBRA NUEVA
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => establecerFormularioClase("mantencion")}
            style={[estilos.grupoBoton, formularioClase === "mantencion" && estilos.grupoBotonActivo]}
          >
            <Text style={[estilos.grupoBotonTexto, formularioClase === "mantencion" && estilos.grupoBotonTextoActivo]}>
              MANTENCIÓN
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. PRESUPUESTOS Y PLAZOS */}
        <Text style={estilos.formularioSeccionEncabezado}>2. Presupuestos, Plazos y Estado</Text>
        <View style={estilos.formularioFilaTwo}>
          <SelectorFecha
            label="Fecha Inicio"
            required
            value={formularioIniciarFecha}
            onChangeDate={(date) => {
              establecerFormularioIniciarFecha(date);
              if (formularioPlazo && formularioPlazo < date) {
                establecerFormularioPlazo(date);
              }
            }}
            placeholder="Seleccionar inicio"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <SelectorFecha
            label="Fecha Límite"
            value={formularioPlazo}
            onChangeDate={establecerFormularioPlazo}
            onClear={() => establecerFormularioPlazo("")}
            minDate={formularioIniciarFecha}
            error={
              formularioIniciarFecha && formularioPlazo && formularioPlazo < formularioIniciarFecha
                ? "La fecha límite no puede ser anterior al inicio"
                : undefined
            }
            placeholder="Sin fecha límite"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={estilos.formularioFilaTwo}>
          <CampoTexto
            label="Presupuesto Materiales ($ CLP)"
            value={formularioPresupuestoMateriales}
            onChangeText={establecerFormularioPresupuestoMateriales}
            keyboardType="numeric"
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <CampoTexto
            label="Presupuesto Horas (HH)"
            value={formularioPresupuestoHoras}
            onChangeText={establecerFormularioPresupuestoHoras}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <CampoTexto
          label="Valor de Venta del Proyecto ($ CLP)"
          value={formularioVentaValor}
          onChangeText={establecerFormularioVentaValor}
          keyboardType="numeric"
          placeholder="Ej: 18000000"
        />

        <Text style={estilos.campoEtiqueta}>Estado Inicial / Actual:</Text>
        <View style={estilos.botonGrupoFila}>
          {(["planificado", "activo"] as const).map((st: any) => (
            <TouchableOpacity
              key={st}
              onPress={() => establecerFormularioEstado(st)}
              style={[estilos.grupoBoton, formularioEstado === st && estilos.grupoBotonActivo]}
            >
              <Text style={[estilos.grupoBotonTexto, formularioEstado === st && estilos.grupoBotonTextoActivo]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {Boolean(formularioError) && <Text style={estilos.errorTexto}>{formularioError}</Text>}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerFormularioModalVisible(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title={editandoProyecto ? "Guardar Cambios" : "Crear Proyecto"}
            variant="primary"
            onPress={manejarGuardarProyecto}
          />
        </View>
      </VistaModal>

      {/* =====================================================================
          4. MODAL DE CIERRE QUE LISTA BLOQUEOS (SOLICITUDES Y MATERIAL EN TRÁNSITO)
          ===================================================================== */}
      <VistaModal
        visible={cerrarModalVisible}
        onClose={() => establecerCerrarModalVisible(false)}
        title="Cierre Contable de Proyecto"
        subtitle={cerrarProyectoTarget ? `${cerrarProyectoTarget.code} • ${cerrarProyectoTarget.name}` : ""}
      >
        {cerrarBloques.length > 0 ? (
          <View style={estilos.blockAvisoCaja}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={24} color={tema.colors.danger} />
              <Text style={estilos.blockAvisoTitulo}>
                Bloqueo Activo: No es posible cerrar el proyecto
              </Text>
            </View>

            <Text style={estilos.blockAvisoSub}>
              Se detectaron solicitudes de insumos o materiales pendientes de liquidar:
            </Text>

            {cerrarBloques.map((blk: any, idx: any) => (
              <View key={idx} style={estilos.blockElementoFila}>
                <Ionicons name="close-circle" size={18} color={tema.colors.danger} />
                <Text style={estilos.blockElementoTexto}>{blk}</Text>
              </View>
            ))}

            <Text style={estilos.blockAdvice}>
              Debe liquidar o despachar todas las solicitudes pendientes y recepcionar las devoluciones en tránsito en bodega antes de autorizar el cierre contable.
            </Text>

            <Boton
              title="Entendido"
              variant="secondary"
              onPress={() => establecerCerrarModalVisible(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={estilos.confirmarCerrarCaja}>
            <Ionicons name="checkmark-done-circle" size={40} color={tema.colors.ok} style={{ alignSelf: "center", marginBottom: 8 }} />
            <Text style={estilos.confirmarCerrarTitulo}>Sin Bloqueos Pendientes</Text>
            <Text style={estilos.confirmarCerrarTexto}>
              Todas las solicitudes y devoluciones de este proyecto están liquidadas y recibidas en bodega.
            </Text>

            <View style={estilos.cerrarAuditoriaDatosCaja}>
              <Text style={estilos.cerrarAuditoriaLinea}>
                Responsable de Cierre: <Text style={{ fontWeight: "bold" }}>{usuario.name}</Text>
              </Text>
              <Text style={estilos.cerrarAuditoriaLinea}>
                Fecha de Cierre: <Text style={{ fontWeight: "bold" }}>{new Date().toISOString().slice(0, 10)}</Text>
              </Text>
            </View>

            <Text style={estilos.cerrarAdvertenciaTexto}>
              Atención: Al cerrar el proyecto, este pasará a modo Solo Lectura (no editable) y se activará el informe final de rentabilidad.
            </Text>

            <View style={estilos.modalBotonesFila}>
              <Boton
                title="Cancelar"
                variant="ghost"
                onPress={() => establecerCerrarModalVisible(false)}
                style={{ marginRight: 8 }}
              />
              <Boton
                title="Confirmar Cierre Definitivo"
                variant="danger"
                icon="lock-closed"
                onPress={manejarConfirmarCerrar}
              />
            </View>
          </View>
        )}
      </VistaModal>

      {/* =====================================================================
          5. MODAL DE CARGA MANUAL DE HORAS POR ADMINISTRADOR (H27 / H28)
          ===================================================================== */}
      <VistaModal
        visible={adminManualModalAbrir}
        onClose={() => establecerAdminManualModalAbrir(false)}
        title="Carga Manual de Horas (Admin)"
        subtitle={`Imputación contable directa para ${seleccionadoProyecto?.code || "Proyecto"}`}
      >
        <Text style={estilos.formularioSeccionEncabezado}>1. Seleccionar Técnico</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {tecnicos.map((t: any) => {
            const esSeleccionado = adminManualTecnicoRut === t.rut;
            return (
              <TouchableOpacity
                key={t.rut}
                onPress={() => establecerAdminManualTecnicoRut(t.rut)}
                style={[
                  estilos.adminTecnicoChip,
                  esSeleccionado && estilos.adminTecnicoChipActivo,
                ]}
                activeOpacity={0.8}
              >
                <View style={[estilos.adminTecnicoAvatar, esSeleccionado && estilos.adminTecnicoAvatarActivo]}>
                  <Ionicons
                    name="person"
                    size={16}
                    color={esSeleccionado ? "#ffffff" : tema.colors.primary}
                  />
                </View>
                <View>
                  <Text style={[estilos.adminTecnicoNombre, esSeleccionado && estilos.adminTecnicoNombreActivo]}>
                    {t.name}
                  </Text>
                  <Text style={estilos.adminTecnicoRut}>{t.rut} • {t.specialty || "Técnico"}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={estilos.formularioSeccionEncabezado}>2. Fecha de la Jornada Laboral</Text>
        <View style={estilos.rapidoFechaFila}>
          {[
            { label: "Hoy", val: new Date().toISOString().slice(0, 10) },
            {
              label: "Ayer",
              val: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            },
            {
              label: "Anteayer",
              val: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
            },
          ].map((d: any) => (
            <TouchableOpacity
              key={d.label}
              onPress={() => establecerAdminManualFecha(d.val)}
              style={[
                estilos.rapidoFechaBoton,
                adminManualFecha === d.val && estilos.rapidoFechaBotonActivo,
              ]}
            >
              <Text
                style={[
                  estilos.rapidoFechaTexto,
                  adminManualFecha === d.val && estilos.rapidoFechaTextoActivo,
                ]}
              >
                {d.label} ({d.val.slice(5)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <CampoTexto
          label="Fecha de Ejecución (YYYY-MM-DD)"
          value={adminManualFecha}
          onChangeText={establecerAdminManualFecha}
          placeholder="2026-10-16"
          containerStyle={{ marginBottom: 12 }}
        />

        <Text style={estilos.formularioSeccionEncabezado}>3. Cantidad de Horas (Bloques de 0,5 h - Máx 24h)</Text>
        <View style={estilos.horasAjustadorFila}>
          <TouchableOpacity
            onPress={() => establecerAdminManualHoras((prev: any) => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
            style={estilos.ajustadorBoton}
            accessibilityLabel="Restar 0.5 horas"
          >
            <Ionicons name="remove" size={22} color={tema.colors.text} />
          </TouchableOpacity>

          <View style={estilos.ajustadorValorCaja}>
            <Text style={estilos.ajustadorValorNumero}>{adminManualHoras.toFixed(1)}</Text>
            <Text style={estilos.ajustadorValorUnidad}>HH</Text>
          </View>

          <TouchableOpacity
            onPress={() => establecerAdminManualHoras((prev: any) => Math.min(24.0, Number((prev + 0.5).toFixed(1))))}
            style={estilos.ajustadorBoton}
            accessibilityLabel="Sumar 0.5 horas"
          >
            <Ionicons name="add" size={22} color={tema.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={estilos.rapidoHorasFila}>
          {[4.0, 8.0, 9.0, 10.0].map((h: any) => (
            <TouchableOpacity
              key={h}
              onPress={() => establecerAdminManualHoras(h)}
              style={[
                estilos.rapidoHoraChip,
                adminManualHoras === h && estilos.rapidoHoraChipActivo,
              ]}
            >
              <Text
                style={[
                  estilos.rapidoHoraChipTexto,
                  adminManualHoras === h && estilos.rapidoHoraChipTextoActivo,
                ]}
              >
                {h.toFixed(1)} h
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={estilos.formularioSeccionEncabezado}>4. Causa del No Registro Automático</Text>
        <View style={estilos.motivoWrap}>
          {[
            "Falla de Batería en Faena",
            "Zona Rural Sin Cobertura",
            "Olvido de Marcaje de Inicio",
            "Corte Eléctrico en Terreno",
            "Jornada Extraordinaria / Urgencia",
          ].map((r: any) => {
            const esSel = adminManualMotivo === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => establecerAdminManualMotivo(r)}
                style={[estilos.motivoChip, esSel && estilos.motivoChipActivo]}
              >
                <Text style={[estilos.motivoChipTexto, esSel && estilos.motivoChipTextoActivo]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <CampoTexto
          label="Detalles o Justificación Adicional"
          value={adminManualDescripcion}
          onChangeText={establecerAdminManualDescripcion}
          placeholder="Ej: Faena de empalme subterráneo sin acceso a red móvil durante toda la jornada."
          multiline
          numberOfLines={2}
          containerStyle={{ marginTop: 10, marginBottom: 14 }}
        />

        {/* Live Cost Impact Box */}
        {seleccionadoProyecto && (
          <View style={estilos.costoVistaPreviaCaja}>
            <View style={estilos.costoVistaPreviaFila}>
              <Text style={estilos.costoVistaPreviaEtiqueta}>Tasa Horaria Proyecto:</Text>
              <Text style={estilos.costoVistaPreviaValor}>{formatearCLP(seleccionadoProyecto.hourlyRate || 18500)} / HH</Text>
            </View>
            <View style={estilos.costoVistaPreviaFila}>
              <Text style={estilos.costoVistaPreviaEtiqueta}>Costo Total a Imputar (H27):</Text>
              <Text style={estilos.costoVistaPreviaTotal}>
                {formatearCLP(adminManualHoras * (seleccionadoProyecto.hourlyRate || 18500))}
              </Text>
            </View>
            <Text style={estilos.costoVistaPreviaNota}>
              * Se recalcula inmediatamente el balance H28 y se genera registro de auditoría administrativa.
            </Text>
          </View>
        )}

        {Boolean(adminManualError) && (
          <View style={estilos.errorBannerCaja}>
            <Ionicons name="alert-circle" size={18} color={tema.colors.danger} />
            <Text style={estilos.errorBannerTexto}>{adminManualError}</Text>
          </View>
        )}

        <View style={estilos.modalBotonesFila}>
          <Boton
            title="Cancelar"
            variant="ghost"
            onPress={() => establecerAdminManualModalAbrir(false)}
            style={{ marginRight: 8 }}
          />
          <Boton
            title="Confirmar e Imputar HH"
            variant="primary"
            icon="checkmark-circle"
            onPress={manejarConfirmarAdminManualHoras}
          />
        </View>
      </VistaModal>
    </>
  );
};
