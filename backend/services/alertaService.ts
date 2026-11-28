export type RolUsuarioAlerta = 'admin' | 'warehouse' | 'technician';

export const DIAS_RETENCION_ALERTAS_DEFECTO = 90;

export interface DefinicionTipoAlerta {
    tipo: string;
    codigo_historia: string;
    roles_destinatarios: readonly RolUsuarioAlerta[];
    enviar_correo_por_defecto: boolean;
}

/**
 * [BACK-1] Matriz oficial que centraliza las alertas de H3, H17, H19, H21, H22, H24, H25 y H33
 * y define estrictamente qué roles pueden ver cada tipo de alerta.
 *
 * Garantía [SCRUM]:
 * - El Técnico ('technician') NUNCA recibe alertas de OC / Facturas (H25), Mermas (H17),
 *   Conteo físico retenido (H19), Diferencias de devolución (H22), Egresos de cuarentena (H24),
 *   Stock mínimo (H3) ni Discrepancias de recepción (H33).
 * - El Bodeguero ('warehouse') recibe alertas operativas de bodega: Devoluciones en tránsito (H21),
 *   Recepciones (H33) y Resoluciones de solicitudes, pero no alertas financieras exclusivas de Administración (H17, H25).
 * - El Administrador ('admin') supervisa las alertas de H3, H17, H19, H22, H24, H25 y H33.
 */
export const CATALOGO_TIPOS_ALERTA: Record<string, DefinicionTipoAlerta> = {
    // H3 / H40: Stock mínimo y generación de OC automática
    stock_minimo_oc: {
        tipo: 'stock_minimo_oc',
        codigo_historia: 'H3',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H17: Mermas de inventario valorizadas a PMP
    merma_inventario: {
        tipo: 'merma_inventario',
        codigo_historia: 'H17',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H19: Conteo físico que supera el umbral de 5% (H39)
    conteo_pendiente_aprobacion: {
        tipo: 'conteo_pendiente_aprobacion',
        codigo_historia: 'H19',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H21: Devolución de sobrante declarada por técnico hacia bodega
    devolucion_en_transito: {
        tipo: 'devolucion_en_transito',
        codigo_historia: 'H21',
        roles_destinatarios: ['warehouse'],
        enviar_correo_por_defecto: false,
    },
    // H22: Diferencia detectada por el bodeguero al confirmar recepción de devolución
    diferencia_devolucion: {
        tipo: 'diferencia_devolucion',
        codigo_historia: 'H22',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H24: Egreso desde cuarentena a proveedor con guía de despacho
    devolucion_proveedor_cuarentena: {
        tipo: 'devolucion_proveedor_cuarentena',
        codigo_historia: 'H24',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H25: Órdenes de compra / Discrepancia entre factura y recepción
    discrepancia_factura_recepcion: {
        tipo: 'discrepancia_factura_recepcion',
        codigo_historia: 'H25',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    orden_compra: {
        tipo: 'orden_compra',
        codigo_historia: 'H25',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H33: Discrepancias o defectuosos en recepción de OC
    recepcion_discrepancia: {
        tipo: 'recepcion_discrepancia',
        codigo_historia: 'H33',
        roles_destinatarios: ['admin', 'warehouse'],
        enviar_correo_por_defecto: false,
    },
    // Otras alertas del flujo de solicitudes y sincronización
    nueva_solicitud_insumos: {
        tipo: 'nueva_solicitud_insumos',
        codigo_historia: 'H6',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: false,
    },
    resolucion_solicitud_bodeguero: {
        tipo: 'resolucion_solicitud_bodeguero',
        codigo_historia: 'H6',
        roles_destinatarios: ['warehouse'],
        enviar_correo_por_defecto: false,
    },
    conflicto_sincronizacion: {
        tipo: 'conflicto_sincronizacion',
        codigo_historia: 'H20',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    asignacion_proyecto_tecnico: {
        tipo: 'asignacion_proyecto_tecnico',
        codigo_historia: 'H2',
        roles_destinatarios: ['technician'],
        enviar_correo_por_defecto: false,
    },
    // H27: Alertas financieras de presupuesto de proyecto (Amarillo >= 80%, Rojo > 100%)
    presupuesto_proyecto_amarillo: {
        tipo: 'presupuesto_proyecto_amarillo',
        codigo_historia: 'H27',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    presupuesto_proyecto_rojo: {
        tipo: 'presupuesto_proyecto_rojo',
        codigo_historia: 'H27',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // H40: Mantenimiento de herramientas próximo a vencer (7 y 1 día antes, H39)
    mantenimiento_herramienta_proximo: {
        tipo: 'mantenimiento_herramienta_proximo',
        codigo_historia: 'H40',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // Monitor de respaldos en la nube y pruebas de restauración (solo Administrador)
    respaldo_fallido: {
        tipo: 'respaldo_fallido',
        codigo_historia: 'SIS',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    respaldo_desactualizado: {
        tipo: 'respaldo_desactualizado',
        codigo_historia: 'SIS',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    prueba_restauracion_pendiente: {
        tipo: 'prueba_restauracion_pendiente',
        codigo_historia: 'SIS',
        roles_destinatarios: ['admin'],
        enviar_correo_por_defecto: true,
    },
    // Herramienta sin devolver tras 7 días (H39) o al cerrar el proyecto
    herramienta_no_devuelta: {
        tipo: 'herramienta_no_devuelta',
        codigo_historia: 'H43',
        roles_destinatarios: ['admin', 'warehouse'],
        enviar_correo_por_defecto: true,
    },
};

/** Tipos de alerta que JAMÁS pueden ser visibles para un Técnico, incluso si tuvieran destinatario erróneo. */
const TIPOS_PROHIBIDOS_PARA_TECNICO = new Set<string>([
    'stock_minimo_oc',
    'merma_inventario',
    'conteo_pendiente_aprobacion',
    'diferencia_devolucion',
    'devolucion_proveedor_cuarentena',
    'discrepancia_factura_recepcion',
    'orden_compra',
    'recepcion_discrepancia',
    'nueva_solicitud_insumos',
    'conflicto_sincronizacion',
    'presupuesto_proyecto_amarillo',
    'presupuesto_proyecto_rojo',
    'herramienta_no_devuelta',
    'mantenimiento_herramienta_proximo',
    'respaldo_fallido',
    'respaldo_desactualizado',
    'prueba_restauracion_pendiente',
]);

export const obtenerCodigoHistoriaAlerta = (tipo: string): string =>
    CATALOGO_TIPOS_ALERTA[tipo]?.codigo_historia ?? 'SIS';

export const obtenerRolesPermitidosPorTipoAlerta = (tipo: string): readonly RolUsuarioAlerta[] =>
    CATALOGO_TIPOS_ALERTA[tipo]?.roles_destinatarios ?? ['admin'];

/**
 * [BACK-1] Determina si una alerta debe mostrarse a un usuario según su rol y su id_usuario,
 * aplicando también la ventana de conservación de 90 días.
 */
export const esAlertaVisibleParaUsuario = (
    alerta: {
        tipo: string;
        rol_destino?: string | null;
        id_usuario_destino?: number | null;
        fecha_creacion?: string | Date | null;
    },
    usuario: { id_usuario: number; rol: RolUsuarioAlerta },
    diasRetencion = DIAS_RETENCION_ALERTAS_DEFECTO,
    ahoraMs = Date.now()
): boolean => {
    const tipo = String(alerta.tipo ?? '').trim();

    // 1. Verificar ventana de retención (90 días por defecto)
    if (alerta.fecha_creacion) {
        const fechaMs = new Date(alerta.fecha_creacion).getTime();
        if (Number.isFinite(fechaMs)) {
            const limiteAntiguedadMs = ahoraMs - diasRetencion * 24 * 60 * 60 * 1000;
            if (fechaMs < limiteAntiguedadMs) {
                return false;
            }
        }
    }

    // 2. Barrera estricta [SCRUM]: Un Técnico NUNCA puede recibir alertas de OC (H25), mermas (H17), conteos (H19), etc.
    if (usuario.rol === 'technician' && TIPOS_PROHIBIDOS_PARA_TECNICO.has(tipo)) {
        return false;
    }

    // 3. Si la alerta está dirigida a un usuario específico, solo ese usuario puede verla
    if (alerta.id_usuario_destino != null && Number(alerta.id_usuario_destino) > 0) {
        if (Number(alerta.id_usuario_destino) !== Number(usuario.id_usuario)) {
            return false;
        }
    }

    // 4. Si la alerta tiene un rol_destino explícito, debe coincidir con el rol del usuario
    if (alerta.rol_destino && alerta.rol_destino.trim() !== '') {
        return alerta.rol_destino.trim().toLowerCase() === usuario.rol;
    }

    // 5. Regla por catálogo de tipos de alerta (H3, H17, H19, H21, H22, H24, H25, H33)
    const rolesPermitidos = obtenerRolesPermitidosPorTipoAlerta(tipo);
    return rolesPermitidos.includes(usuario.rol);
};

/**
 * Determina si corresponde despachar correo electrónico para el tipo de alerta.
 */
export const debeEnviarCorreoPorTipoAlerta = (params: {
    tipo: string;
    enviarCorreoExplicito?: boolean;
    configuracionBd?: Map<string, boolean>;
}): boolean => {
    if (typeof params.enviarCorreoExplicito === 'boolean') {
        return params.enviarCorreoExplicito;
    }
    if (params.configuracionBd && params.configuracionBd.has(params.tipo)) {
        return Boolean(params.configuracionBd.get(params.tipo));
    }
    return CATALOGO_TIPOS_ALERTA[params.tipo]?.enviar_correo_por_defecto ?? false;
};
