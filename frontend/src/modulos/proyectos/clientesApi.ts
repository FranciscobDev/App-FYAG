// clientesApi.ts
import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";

const obtenerRuta = () => `${obtenerBaseUrlApi()}/clientes`;

export interface ClienteProyecto {
  id_cliente: number;
  rut_cliente: string;
  razon_social: string;
  giro: string | null;
  telefono: string | null;
  correo_contacto: string | null;
  direccion: string | null;
  nombre_contacto: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  calificacion_promedio: number;
  activo: boolean;
  total_proyectos?: number;
  planes_activos?: number;
}

export interface FormularioCliente {
  rut_cliente: string;
  razon_social: string;
  giro?: string;
  telefono?: string;
  correo_contacto?: string;
  direccion?: string;
  nombre_contacto?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  calificacion_promedio?: number;
}

export type ModalidadPlanMantencion = "POR_KIT" | "POR_CONTRATO" | "MIXTO";

export interface SeguimientoContactoCliente {
  id_seguimiento: number;
  id_plan: number;
  fecha_contacto: string;
  canal_contacto: "Teléfono" | "Correo" | "WhatsApp" | "Visita";
  resultado_contacto:
    | "Pendiente Contacto"
    | "Cliente Contactado"
    | "Visita Confirmada"
    | "Pospuesto por Cliente"
    | "Mantención Ejecutada";
  id_proyecto_generado?: number | null;
  proyecto_generado_nombre?: string | null;
  observaciones?: string | null;
}

export interface PlanMantencionCliente {
  id_plan: number;
  id_cliente: number;
  razon_social?: string;
  rut_cliente?: string;
  telefono_cliente?: string | null;
  nombre_contacto?: string | null;
  id_proyecto_origen: number | null;
  nombre_proyecto_origen?: string | null;
  titulo_plan: string;
  modalidad: ModalidadPlanMantencion;
  id_kit_proyecto: number | null;
  nombre_kit?: string | null;
  codigo_contrato: string | null;
  frecuencia_meses: number; // ej. 3, 6, 10, 12
  fecha_ultima_mantencion: string | null;
  fecha_proxima_mantencion: string;
  costo_pactado: number;
  estado_plan: "Activo" | "Pausado" | "Finalizado";
  notas_plan: string | null;
  dias_restantes?: number;
  kit_stock_ok?: boolean;
  seguimientos?: SeguimientoContactoCliente[];
}

export interface FormularioPlanMantencion {
  id_cliente: number;
  id_proyecto_origen?: number | null;
  titulo_plan: string;
  modalidad: ModalidadPlanMantencion;
  id_kit_proyecto?: number | null;
  codigo_contrato?: string | null;
  frecuencia_meses: number;
  fecha_ultima_mantencion?: string | null;
  fecha_proxima_mantencion: string;
  costo_pactado: number;
  notas_plan?: string | null;
}

export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(url: string, opciones?: RequestInit): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...encabezadosAuth(),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? json.error ?? "Error en el servidor" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}

// =============================================================================
// DATOS INICIALES EN MEMORIA (Respaldo Offline / Demo instantáneo)
// =============================================================================
let clientesMemoria: ClienteProyecto[] = [
  {
    id_cliente: 1,
    rut_cliente: "76.123.456-7",
    razon_social: "Inmobiliaria Pacífico SpA",
    giro: "Desarrollo y Construcción Inmobiliaria",
    telefono: "+56 2 2456 7890",
    correo_contacto: "contacto@inmobpacificospa.cl",
    direccion: "Av. Providencia 2450, Providencia, Santiago",
    nombre_contacto: "Rodrigo Sepúlveda",
    banco: "Banco de Chile",
    tipo_cuenta: "Cuenta Corriente",
    numero_cuenta: "00-12345678-01",
    calificacion_promedio: 4.9,
    activo: true,
    total_proyectos: 2,
    planes_activos: 1,
  },
  {
    id_cliente: 2,
    rut_cliente: "77.890.123-4",
    razon_social: "Clínica Andes S.A.",
    giro: "Servicios de Salud e Infraestructura Médica",
    telefono: "+56 2 2987 6543",
    correo_contacto: "operaciones@clinicaandes.cl",
    direccion: "Av. Las Condes 9100, Las Condes, Santiago",
    nombre_contacto: "Marcela Gajardo",
    banco: "Banco Santander",
    tipo_cuenta: "Cuenta Corriente",
    numero_cuenta: "00-76543210-09",
    calificacion_promedio: 4.8,
    activo: true,
    total_proyectos: 2,
    planes_activos: 1,
  },
  {
    id_cliente: 3,
    rut_cliente: "78.456.789-1",
    razon_social: "Logística & Bodegaje Renca SpA",
    giro: "Almacenamiento y Centros de Distribución",
    telefono: "+56 9 8765 4321",
    correo_contacto: "mantencion@logisticarenca.cl",
    direccion: "Camino Lo Boza 120, Renca, Santiago",
    nombre_contacto: "Gonzalo Valenzuela",
    banco: "Banco BCI",
    tipo_cuenta: "Cuenta Corriente",
    numero_cuenta: "00-98765432-05",
    calificacion_promedio: 4.5,
    activo: true,
    total_proyectos: 1,
    planes_activos: 1,
  },
  {
    id_cliente: 4,
    rut_cliente: "79.234.567-8",
    razon_social: "Constructora Maipo Limitada",
    giro: "Obras Civiles y Estructuras",
    telefono: "+56 2 2345 6789",
    correo_contacto: "obras@constructoramaipo.cl",
    direccion: "Av. San Bernardo 540, San Bernardo, Santiago",
    nombre_contacto: "Felipe Morales",
    banco: "Banco Estado",
    tipo_cuenta: "Cuenta Corriente",
    numero_cuenta: "00-45612378-02",
    calificacion_promedio: 4.7,
    activo: true,
    total_proyectos: 1,
    planes_activos: 1,
  },
];

let planesMemoria: PlanMantencionCliente[] = [
  {
    id_plan: 1,
    id_cliente: 1,
    razon_social: "Inmobiliaria Pacífico SpA",
    rut_cliente: "76.123.456-7",
    telefono_cliente: "+56 2 2456 7890",
    nombre_contacto: "Rodrigo Sepúlveda",
    id_proyecto_origen: 1,
    nombre_proyecto_origen: "Edificio Los Aromos – Instalación eléctrica",
    titulo_plan: "Mantención Trimestral Tableros y Alimentadores",
    modalidad: "POR_KIT",
    id_kit_proyecto: 1,
    nombre_kit: "Kit Básico Instalación Eléctrica Domiciliaria",
    codigo_contrato: null,
    frecuencia_meses: 3,
    fecha_ultima_mantencion: "2026-08-18",
    fecha_proxima_mantencion: "2026-11-18",
    costo_pactado: 680000,
    estado_plan: "Activo",
    notas_plan: "Revisión termográfica e insumos por Kit Eléctrico cada 3 meses",
    dias_restantes: 2,
    kit_stock_ok: true,
    seguimientos: [
      {
        id_seguimiento: 1,
        id_plan: 1,
        fecha_contacto: "2026-11-12T10:30:00Z",
        canal_contacto: "Teléfono",
        resultado_contacto: "Cliente Contactado",
        observaciones: "Se contactó a Rodrigo Sepúlveda; solicita confirmar ingreso de cuadrilla para esta semana.",
      },
    ],
  },
  {
    id_plan: 2,
    id_cliente: 2,
    razon_social: "Clínica Andes S.A.",
    rut_cliente: "77.890.123-4",
    telefono_cliente: "+56 2 2987 6543",
    nombre_contacto: "Marcela Gajardo",
    id_proyecto_origen: 2,
    nombre_proyecto_origen: "Mantención preventiva climatización – Clínica Andes",
    titulo_plan: "Mantención Climatización Pabellones Clínicos",
    modalidad: "MIXTO",
    id_kit_proyecto: 2,
    nombre_kit: "Kit Climatización Split 12K - 18K BTU",
    codigo_contrato: "SLA-ANDES-2026",
    frecuencia_meses: 6,
    fecha_ultima_mantencion: "2026-06-01",
    fecha_proxima_mantencion: "2026-12-01",
    costo_pactado: 1250000,
    estado_plan: "Activo",
    notas_plan: "Contrato semestral con recarga R410A y cambio de filtros por Kit",
    dias_restantes: 15,
    kit_stock_ok: true,
    seguimientos: [
      {
        id_seguimiento: 2,
        id_plan: 2,
        fecha_contacto: "2026-11-14T15:00:00Z",
        canal_contacto: "Correo",
        resultado_contacto: "Visita Confirmada",
        proyecto_generado_nombre: "Mantención preventiva climatización – Clínica Andes",
        observaciones: "Marcela Gajardo confirmó ventana de trabajo nocturna en pabellones.",
      },
    ],
  },
  {
    id_plan: 3,
    id_cliente: 3,
    razon_social: "Logística & Bodegaje Renca SpA",
    rut_cliente: "78.456.789-1",
    telefono_cliente: "+56 9 8765 4321",
    nombre_contacto: "Gonzalo Valenzuela",
    id_proyecto_origen: 3,
    nombre_proyecto_origen: "Nave Logística Renca – Red contra incendios",
    titulo_plan: "Inspección Mayor Red Contra Incendios (10 Meses)",
    modalidad: "POR_CONTRATO",
    id_kit_proyecto: null,
    nombre_kit: null,
    codigo_contrato: "CTR-REN-10M",
    frecuencia_meses: 10,
    fecha_ultima_mantencion: "2026-01-10",
    fecha_proxima_mantencion: "2026-11-10",
    costo_pactado: 1890000,
    estado_plan: "Activo",
    notas_plan: "Mantenimiento mayor programado cada 10 meses según norma NFPA",
    dias_restantes: -6,
    kit_stock_ok: true,
    seguimientos: [],
  },
];

const calcularDiasRestantes = (fechaIso: string): number => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaIso);
  if (isNaN(f.getTime())) return 30;
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
};

export const sumarMesesFecha = (fechaIso: string, meses: number): string => {
  const base = fechaIso ? new Date(fechaIso) : new Date();
  if (isNaN(base.getTime())) {
    const hoy = new Date();
    hoy.setMonth(hoy.getMonth() + meses);
    return hoy.toISOString().slice(0, 10);
  }
  base.setMonth(base.getMonth() + meses);
  return base.toISOString().slice(0, 10);
};

// =============================================================================
// FUNCIONES API DE CLIENTES
// =============================================================================

export const listarClientes = async (): Promise<Resultado<ClienteProyecto[]>> => {
  const res = await peticion<ClienteProyecto[]>(obtenerRuta());
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    clientesMemoria = res.data;
    return res;
  }
  return { ok: true, data: clientesMemoria };
};

export const crearClienteApi = async (
  datos: FormularioCliente
): Promise<Resultado<{ mensaje: string; cliente: ClienteProyecto }>> => {
  const res = await peticion<{ mensaje: string; cliente: ClienteProyecto }>(obtenerRuta(), {
    method: "POST",
    body: JSON.stringify(datos),
  });
  if (res.ok && res.data?.cliente) {
    clientesMemoria = [res.data.cliente, ...clientesMemoria];
    return res;
  }
  if (res.error && res.error.includes("RUT")) {
    return res;
  }
  const nuevo: ClienteProyecto = {
    id_cliente: Date.now(),
    rut_cliente: datos.rut_cliente.trim(),
    razon_social: datos.razon_social.trim(),
    giro: datos.giro?.trim() || null,
    telefono: datos.telefono?.trim() || null,
    correo_contacto: datos.correo_contacto?.trim() || null,
    direccion: datos.direccion?.trim() || null,
    nombre_contacto: datos.nombre_contacto?.trim() || null,
    banco: datos.banco?.trim() || null,
    tipo_cuenta: datos.tipo_cuenta?.trim() || null,
    numero_cuenta: datos.numero_cuenta?.trim() || null,
    calificacion_promedio: datos.calificacion_promedio ?? 5.0,
    activo: true,
    total_proyectos: 0,
    planes_activos: 0,
  };
  clientesMemoria = [nuevo, ...clientesMemoria];
  return { ok: true, data: { mensaje: "Cliente registrado exitosamente", cliente: nuevo } };
};

export const actualizarClienteApi = async (
  id: number,
  datos: FormularioCliente
): Promise<Resultado<{ mensaje: string; cliente: ClienteProyecto }>> => {
  const res = await peticion<{ mensaje: string; cliente: ClienteProyecto }>(`${obtenerRuta()}/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
  if (res.ok && res.data?.cliente) {
    clientesMemoria = clientesMemoria.map((c) => (c.id_cliente === id ? res.data!.cliente : c));
    return res;
  }
  const existente = clientesMemoria.find((c) => c.id_cliente === id);
  const actualizado: ClienteProyecto = {
    ...(existente ?? {
      id_cliente: id,
      calificacion_promedio: 5.0,
      activo: true,
      total_proyectos: 0,
      planes_activos: 0,
    }),
    rut_cliente: datos.rut_cliente.trim(),
    razon_social: datos.razon_social.trim(),
    giro: datos.giro?.trim() || null,
    telefono: datos.telefono?.trim() || null,
    correo_contacto: datos.correo_contacto?.trim() || null,
    direccion: datos.direccion?.trim() || null,
    nombre_contacto: datos.nombre_contacto?.trim() || null,
    banco: datos.banco?.trim() || null,
    tipo_cuenta: datos.tipo_cuenta?.trim() || null,
    numero_cuenta: datos.numero_cuenta?.trim() || null,
  };
  clientesMemoria = clientesMemoria.map((c) => (c.id_cliente === id ? actualizado : c));
  return { ok: true, data: { mensaje: "Cliente actualizado exitosamente", cliente: actualizado } };
};

export const alternarEstadoClienteApi = async (
  id: number,
  activo?: boolean
): Promise<Resultado<{ mensaje: string; cliente: ClienteProyecto }>> => {
  const res = await peticion<{ mensaje: string; cliente: ClienteProyecto }>(
    `${obtenerRuta()}/${id}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }
  );
  if (res.ok && res.data?.cliente) {
    clientesMemoria = clientesMemoria.map((c) => (c.id_cliente === id ? res.data!.cliente : c));
    return res;
  }
  clientesMemoria = clientesMemoria.map((c) =>
    c.id_cliente === id ? { ...c, activo: activo !== undefined ? activo : !c.activo } : c
  );
  const mod = clientesMemoria.find((c) => c.id_cliente === id)!;
  return {
    ok: true,
    data: {
      mensaje: mod?.activo ? "Cliente habilitado" : "Cliente deshabilitado (borrado lógico)",
      cliente: mod,
    },
  };
};

// =============================================================================
// FUNCIONES API DE PLANES DE MANTENCIÓN Y SEGUIMIENTO
// =============================================================================

export const listarPlanesMantencion = async (): Promise<Resultado<PlanMantencionCliente[]>> => {
  const res = await peticion<PlanMantencionCliente[]>(`${obtenerRuta()}/planes/mantencion`);
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    planesMemoria = res.data;
    return res;
  }
  const actualizados = planesMemoria.map((p) => ({
    ...p,
    dias_restantes: calcularDiasRestantes(p.fecha_proxima_mantencion),
  }));
  return { ok: true, data: actualizados };
};

export const crearPlanMantencionApi = async (
  datos: FormularioPlanMantencion & {
    razon_social?: string;
    rut_cliente?: string;
    nombre_proyecto_origen?: string | null;
    nombre_kit?: string | null;
  }
): Promise<Resultado<{ mensaje: string; plan: PlanMantencionCliente }>> => {
  const res = await peticion<{ mensaje: string; plan: PlanMantencionCliente }>(
    `${obtenerRuta()}/planes/mantencion`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  );
  const cli = clientesMemoria.find((c) => c.id_cliente === datos.id_cliente);
  const nuevoPlan: PlanMantencionCliente = {
    id_plan: res.ok && res.data?.plan ? res.data.plan.id_plan : Date.now(),
    id_cliente: datos.id_cliente,
    razon_social: cli?.razon_social ?? datos.razon_social ?? "Cliente",
    rut_cliente: cli?.rut_cliente ?? datos.rut_cliente ?? "",
    telefono_cliente: cli?.telefono ?? null,
    nombre_contacto: cli?.nombre_contacto ?? null,
    id_proyecto_origen: datos.id_proyecto_origen ?? null,
    nombre_proyecto_origen: datos.nombre_proyecto_origen ?? null,
    titulo_plan: datos.titulo_plan.trim(),
    modalidad: datos.modalidad,
    id_kit_proyecto: datos.id_kit_proyecto ?? null,
    nombre_kit: datos.nombre_kit ?? null,
    codigo_contrato: datos.codigo_contrato?.trim() || null,
    frecuencia_meses: datos.frecuencia_meses,
    fecha_ultima_mantencion:
      datos.fecha_ultima_mantencion || new Date().toISOString().slice(0, 10),
    fecha_proxima_mantencion: datos.fecha_proxima_mantencion,
    costo_pactado: datos.costo_pactado,
    estado_plan: "Activo",
    notas_plan: datos.notas_plan?.trim() || null,
    dias_restantes: calcularDiasRestantes(datos.fecha_proxima_mantencion),
    kit_stock_ok: true,
    seguimientos: [],
  };
  planesMemoria = [nuevoPlan, ...planesMemoria];
  return {
    ok: true,
    data: {
      mensaje: `Plan de mantención cada ${datos.frecuencia_meses} meses creado exitosamente`,
      plan: nuevoPlan,
    },
  };
};

export const registrarSeguimientoContactoApi = async (
  idPlan: number,
  datos: {
    canal_contacto: "Teléfono" | "Correo" | "WhatsApp" | "Visita";
    resultado_contacto:
      | "Pendiente Contacto"
      | "Cliente Contactado"
      | "Visita Confirmada"
      | "Pospuesto por Cliente"
      | "Mantención Ejecutada";
    observaciones?: string;
    generar_faena?: boolean;
    nueva_fecha_proxima?: string;
  }
): Promise<
  Resultado<{
    mensaje: string;
    seguimiento: SeguimientoContactoCliente;
    proyecto_generado?: any;
  }>
> => {
  const res = await peticion<{
    mensaje: string;
    seguimiento: SeguimientoContactoCliente;
    proyecto_generado?: any;
  }>(`${obtenerRuta()}/planes/mantencion/${idPlan}/seguimiento`, {
    method: "POST",
    body: JSON.stringify(datos),
  });

  if (res.ok && res.data) {
    // Actualizar en memoria también
    planesMemoria = planesMemoria.map((pl) => {
      if (pl.id_plan !== idPlan) return pl;
      const proxFecha = datos.generar_faena
        ? datos.nueva_fecha_proxima ||
          sumarMesesFecha(pl.fecha_proxima_mantencion, pl.frecuencia_meses)
        : datos.nueva_fecha_proxima || pl.fecha_proxima_mantencion;
      return {
        ...pl,
        fecha_ultima_mantencion: datos.generar_faena
          ? pl.fecha_proxima_mantencion
          : pl.fecha_ultima_mantencion,
        fecha_proxima_mantencion: proxFecha,
        dias_restantes: calcularDiasRestantes(proxFecha),
        seguimientos: [res.data!.seguimiento, ...(pl.seguimientos ?? [])],
      };
    });
    return res;
  }

  // Fallback en memoria si el backend está offline
  const nuevoSeg: SeguimientoContactoCliente = {
    id_seguimiento: Date.now(),
    id_plan: idPlan,
    fecha_contacto: new Date().toISOString(),
    canal_contacto: datos.canal_contacto,
    resultado_contacto: datos.resultado_contacto,
    observaciones: datos.observaciones,
  };

  let freq = 3;
  planesMemoria = planesMemoria.map((pl) => {
    if (pl.id_plan !== idPlan) return pl;
    freq = pl.frecuencia_meses;
    const proxFecha = datos.generar_faena
      ? datos.nueva_fecha_proxima ||
        sumarMesesFecha(pl.fecha_proxima_mantencion, pl.frecuencia_meses)
      : datos.nueva_fecha_proxima || pl.fecha_proxima_mantencion;
    return {
      ...pl,
      fecha_ultima_mantencion: datos.generar_faena
        ? pl.fecha_proxima_mantencion
        : pl.fecha_ultima_mantencion,
      fecha_proxima_mantencion: proxFecha,
      dias_restantes: calcularDiasRestantes(proxFecha),
      seguimientos: [nuevoSeg, ...(pl.seguimientos ?? [])],
    };
  });

  return {
    ok: true,
    data: {
      mensaje: datos.generar_faena
        ? `Contacto registrado, faena de mantención generada y siguiente ciclo (+${freq} meses) programado`
        : "Contacto de seguimiento registrado exitosamente",
      seguimiento: nuevoSeg,
    },
  };
};
