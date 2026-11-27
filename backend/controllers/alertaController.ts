import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { normalizarRol, obtenerIdEjecutor } from '../middleware/authMiddleware';
import {
    CATALOGO_TIPOS_ALERTA,
    DIAS_RETENCION_ALERTAS_DEFECTO,
    RolUsuarioAlerta,
    debeEnviarCorreoPorTipoAlerta,
    esAlertaVisibleParaUsuario,
    obtenerCodigoHistoriaAlerta,
    obtenerRolesPermitidosPorTipoAlerta,
} from '../services/alertaService';
import { enviarCorreo } from '../services/correo';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export interface AlertaNotificacionDto {
    id_alerta: number;
    tipo: string;
    codigo_historia: string;
    severidad: string;
    titulo: string;
    descripcion: string;
    id_articulo: number | null;
    id_orden_compra: number | null;
    rol_destino: string | null;
    id_usuario_destino: number | null;
    leida: boolean;
    fecha_creacion: string;
    fecha_lectura: string | null;
    correo_enviado: boolean;
    destinatario_correo: string | null;
}

export interface BandejaAlertasRespuesta {
    rol: RolUsuarioAlerta;
    dias_retencion: number;
    total: number;
    total_no_leidas: number;
    alertas: AlertaNotificacionDto[];
}

const normalizarRolAlerta = (rolCrudo?: string | null): RolUsuarioAlerta => {
    const r = normalizarRol(rolCrudo);
    if (r === 'admin' || r === 'warehouse' || r === 'technician') {
        return r;
    }
    return 'technician';
};

const obtenerDiasRetencionAlertas = async (cliente: Pick<PoolClient, 'query'>): Promise<number> => {
    const res = await cliente.query<{ valor: number }>(
        `/* alerta:select-retencion */
         SELECT valor FROM parametro_sistema WHERE clave = 'dias_retencion_alertas' LIMIT 1`
    );
    const val = Number(res.rows?.[0]?.valor);
    return Number.isFinite(val) && val > 0 ? val : DIAS_RETENCION_ALERTAS_DEFECTO;
};

/**
 * [BACK-1] Consulta la bandeja de alertas filtrada estrictamente por el rol y el id_usuario del destinatario,
 * aplicando la conservación de 90 días y calculando en tiempo real el contador de no leídas.
 */
export const consultarAlertasUsuarioEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    usuario: { id_usuario: number; rol: RolUsuarioAlerta },
    filtros: { solo_no_leidas?: boolean; tipo?: string } = {}
): Promise<BandejaAlertasRespuesta> => {
    const diasRetencion = await obtenerDiasRetencionAlertas(cliente);
    const res = await cliente.query<{
        id_alerta: number;
        tipo: string;
        severidad: string;
        titulo: string;
        descripcion: string;
        id_articulo: number | null;
        id_orden_compra: number | null;
        rol_destino: string | null;
        id_usuario_destino: number | null;
        leida: boolean;
        fecha_creacion: string;
        fecha_lectura: string | null;
        correo_enviado?: boolean;
        destinatario_correo?: string | null;
    }>(
        `/* alerta:select-todas */
         SELECT id_alerta, tipo, severidad, titulo, descripcion,
                id_articulo, id_orden_compra, rol_destino, id_usuario_destino,
                leida, fecha_creacion::text AS fecha_creacion,
                fecha_lectura::text AS fecha_lectura,
                COALESCE(correo_enviado, FALSE) AS correo_enviado,
                destinatario_correo
         FROM alertas_sistema
         WHERE fecha_creacion >= CURRENT_TIMESTAMP - ($1::int || ' days')::interval
         ORDER BY fecha_creacion DESC, id_alerta DESC`,
        [diasRetencion]
    );

    const visibles = (res.rows ?? []).filter((fila) =>
        esAlertaVisibleParaUsuario(fila, usuario, diasRetencion)
    );

    const totalNoLeidas = visibles.filter((a) => !a.leida).length;

    const filtradas = visibles.filter((a) => {
        if (filtros.solo_no_leidas && a.leida) return false;
        if (filtros.tipo && filtros.tipo.trim() !== '' && a.tipo !== filtros.tipo.trim()) return false;
        return true;
    });

    const alertasDto: AlertaNotificacionDto[] = filtradas.map((a) => ({
        id_alerta: Number(a.id_alerta),
        tipo: a.tipo,
        codigo_historia: obtenerCodigoHistoriaAlerta(a.tipo),
        severidad: a.severidad,
        titulo: a.titulo,
        descripcion: a.descripcion,
        id_articulo: a.id_articulo != null ? Number(a.id_articulo) : null,
        id_orden_compra: a.id_orden_compra != null ? Number(a.id_orden_compra) : null,
        rol_destino: a.rol_destino ?? obtenerRolesPermitidosPorTipoAlerta(a.tipo)[0] ?? null,
        id_usuario_destino: a.id_usuario_destino != null ? Number(a.id_usuario_destino) : null,
        leida: Boolean(a.leida),
        fecha_creacion: a.fecha_creacion,
        fecha_lectura: a.fecha_lectura ?? null,
        correo_enviado: Boolean(a.correo_enviado),
        destinatario_correo: a.destinatario_correo ?? null,
    }));

    return {
        rol: usuario.rol,
        dias_retencion: diasRetencion,
        total: alertasDto.length,
        total_no_leidas: totalNoLeidas,
        alertas: alertasDto,
    };
};

/**
 * [BACK-1] Marca una alerta como leída si y solo si corresponde al rol/usuario que la consulta,
 * y devuelve el nuevo contador de no leídas en tiempo real.
 */
export const marcarAlertaLeidaEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    idAlerta: number,
    usuario: { id_usuario: number; rol: RolUsuarioAlerta }
): Promise<{ alerta: AlertaNotificacionDto; total_no_leidas: number }> => {
    if (!Number.isInteger(idAlerta) || idAlerta <= 0) {
        throw new ErrorAplicacion(400, 'Identificador de alerta inválido');
    }

    const diasRetencion = await obtenerDiasRetencionAlertas(cliente);
    const res = await cliente.query<{
        id_alerta: number;
        tipo: string;
        severidad: string;
        titulo: string;
        descripcion: string;
        id_articulo: number | null;
        id_orden_compra: number | null;
        rol_destino: string | null;
        id_usuario_destino: number | null;
        leida: boolean;
        fecha_creacion: string;
        fecha_lectura: string | null;
        correo_enviado?: boolean;
        destinatario_correo?: string | null;
    }>(
        `/* alerta:select-por-id */
         SELECT id_alerta, tipo, severidad, titulo, descripcion,
                id_articulo, id_orden_compra, rol_destino, id_usuario_destino,
                leida, fecha_creacion::text AS fecha_creacion,
                fecha_lectura::text AS fecha_lectura,
                COALESCE(correo_enviado, FALSE) AS correo_enviado,
                destinatario_correo
         FROM alertas_sistema
         WHERE id_alerta = $1`,
        [idAlerta]
    );

    const fila = res.rows?.[0];
    if (!fila) {
        throw new ErrorAplicacion(404, 'Alerta no encontrada');
    }

    if (!esAlertaVisibleParaUsuario(fila, usuario, diasRetencion)) {
        throw new ErrorAplicacion(403, 'No tienes permiso para acceder o marcar una alerta que no corresponde a tu rol');
    }

    const fechaLectura = new Date().toISOString();
    await cliente.query(
        `/* alerta:marcar-leida */
         UPDATE alertas_sistema
         SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
         WHERE id_alerta = $1`,
        [idAlerta]
    );

    const bandeja = await consultarAlertasUsuarioEnTransaccion(cliente, usuario);

    return {
        alerta: {
            id_alerta: Number(fila.id_alerta),
            tipo: fila.tipo,
            codigo_historia: obtenerCodigoHistoriaAlerta(fila.tipo),
            severidad: fila.severidad,
            titulo: fila.titulo,
            descripcion: fila.descripcion,
            id_articulo: fila.id_articulo != null ? Number(fila.id_articulo) : null,
            id_orden_compra: fila.id_orden_compra != null ? Number(fila.id_orden_compra) : null,
            rol_destino: fila.rol_destino ?? obtenerRolesPermitidosPorTipoAlerta(fila.tipo)[0] ?? null,
            id_usuario_destino: fila.id_usuario_destino != null ? Number(fila.id_usuario_destino) : null,
            leida: true,
            fecha_creacion: fila.fecha_creacion,
            fecha_lectura: fila.fecha_lectura ?? fechaLectura,
            correo_enviado: Boolean(fila.correo_enviado),
            destinatario_correo: fila.destinatario_correo ?? null,
        },
        total_no_leidas: bandeja.total_no_leidas,
    };
};

/**
 * [BACK-1] Marca como leídas únicamente las alertas que pertenecen al rol/usuario en sesión.
 */
export const marcarTodasAlertasLeidasEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    usuario: { id_usuario: number; rol: RolUsuarioAlerta }
): Promise<{ marcadas: number; total_no_leidas: number }> => {
    const bandejaAntes = await consultarAlertasUsuarioEnTransaccion(cliente, usuario, { solo_no_leidas: true });
    const idsParaMarcar = bandejaAntes.alertas.map((a) => a.id_alerta);

    if (idsParaMarcar.length > 0) {
        await cliente.query(
            `/* alerta:marcar-lote-leidas */
             UPDATE alertas_sistema
             SET leida = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
             WHERE id_alerta = ANY($1::int[])`,
            [idsParaMarcar]
        );
    }

    return {
        marcadas: idsParaMarcar.length,
        total_no_leidas: 0,
    };
};

/**
 * [BACK-1] Crea una alerta centralizada y ejecuta el despacho opcional por correo electrónico
 * según la configuración del tipo de alerta o el parámetro explícito `enviar_correo`.
 */
export const crearAlertaConDespachoOpcionalEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    datos: {
        tipo: string;
        severidad?: string;
        titulo: string;
        descripcion: string;
        id_articulo?: number | null;
        id_orden_compra?: number | null;
        rol_destino?: RolUsuarioAlerta | null;
        id_usuario_destino?: number | null;
        enviar_correo?: boolean;
        destinatario_correo?: string | null;
    }
): Promise<AlertaNotificacionDto> => {
    const tipo = String(datos.tipo ?? '').trim();
    if (!tipo) {
        throw new ErrorAplicacion(400, 'El tipo de alerta es obligatorio');
    }
    const titulo = String(datos.titulo ?? '').trim();
    const descripcion = String(datos.descripcion ?? '').trim();
    if (!titulo || !descripcion) {
        throw new ErrorAplicacion(400, 'El título y la descripción de la alerta son obligatorios');
    }

    const severidad = String(datos.severidad ?? 'amarillo').trim();
    const rolDestino = datos.rol_destino ?? obtenerRolesPermitidosPorTipoAlerta(tipo)[0] ?? 'admin';

    // Consultar configuración de correo para este tipo de alerta en BD
    const cfgRes = await cliente.query<{ enviar_correo: boolean; correo_destino_defecto: string | null }>(
        `/* alerta:select-config-correo */
         SELECT enviar_correo, correo_destino_defecto
         FROM configuracion_correo_alertas
         WHERE tipo_alerta = $1
         LIMIT 1`,
        [tipo]
    );
    const filaCfg = cfgRes.rows?.[0];
    const mapaCfg = new Map<string, boolean>();
    if (filaCfg) {
        mapaCfg.set(tipo, Boolean(filaCfg.enviar_correo));
    }

    const despacharCorreo = debeEnviarCorreoPorTipoAlerta({
        tipo,
        enviarCorreoExplicito: datos.enviar_correo,
        configuracionBd: mapaCfg,
    });

    let destinatarioCorreo =
        (datos.destinatario_correo && datos.destinatario_correo.trim()) ||
        (filaCfg?.correo_destino_defecto && filaCfg.correo_destino_defecto.trim()) ||
        null;

    if (despacharCorreo && !destinatarioCorreo) {
        destinatarioCorreo = rolDestino === 'warehouse' ? 'bodegafyag@gmail.com' : 'adminfyag@gmail.com';
    }

    let correoEnviado = false;
    if (despacharCorreo && destinatarioCorreo) {
        const codigoHistoria = obtenerCodigoHistoriaAlerta(tipo);
        await enviarCorreo({
            para: destinatarioCorreo,
            asunto: `[FYAG • ${codigoHistoria}] ${titulo}`,
            texto: `${titulo}\n\n${descripcion}\n\nTipo: ${tipo} (${codigoHistoria}) | Severidad: ${severidad}`,
        });
        correoEnviado = true;
    }

    const insRes = await cliente.query<{ id_alerta: number; fecha_creacion: string }>(
        `/* alerta:insert */
         INSERT INTO alertas_sistema (
             tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra,
             rol_destino, id_usuario_destino, leida, correo_enviado, destinatario_correo
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10)
         RETURNING id_alerta, fecha_creacion::text AS fecha_creacion`,
        [
            tipo,
            severidad,
            titulo.slice(0, 200),
            descripcion.slice(0, 500),
            datos.id_articulo ?? null,
            datos.id_orden_compra ?? null,
            rolDestino,
            datos.id_usuario_destino ?? null,
            correoEnviado,
            correoEnviado ? destinatarioCorreo : null,
        ]
    );

    const idAlerta = Number(insRes.rows[0].id_alerta);
    const fechaCreacion = insRes.rows[0].fecha_creacion || new Date().toISOString();

    return {
        id_alerta: idAlerta,
        tipo,
        codigo_historia: obtenerCodigoHistoriaAlerta(tipo),
        severidad,
        titulo,
        descripcion,
        id_articulo: datos.id_articulo ?? null,
        id_orden_compra: datos.id_orden_compra ?? null,
        rol_destino: rolDestino,
        id_usuario_destino: datos.id_usuario_destino ?? null,
        leida: false,
        fecha_creacion: fechaCreacion,
        fecha_lectura: null,
        correo_enviado: correoEnviado,
        destinatario_correo: correoEnviado ? destinatarioCorreo : null,
    };
};

// =========================================================================================
// CONTROLADORES HTTP EXPRESS
// =========================================================================================

export const listarAlertasUsuario = async (req: Request, res: Response): Promise<void> => {
    try {
        const idUsuario = obtenerIdEjecutor(req) ?? 0;
        const payload = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        const rol = normalizarRolAlerta(payload?.rol);
        const soloNoLeidas = req.query.no_leidas === 'true' || req.query.leida === 'false';
        const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;

        const respuesta = await consultarAlertasUsuarioEnTransaccion(
            pool,
            { id_usuario: idUsuario, rol },
            { solo_no_leidas: soloNoLeidas, tipo }
        );
        res.status(200).json(respuesta);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar la bandeja de alertas');
    }
};

export const obtenerContadorAlertasNoLeidas = async (req: Request, res: Response): Promise<void> => {
    try {
        const idUsuario = obtenerIdEjecutor(req) ?? 0;
        const payload = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        const rol = normalizarRolAlerta(payload?.rol);

        const bandeja = await consultarAlertasUsuarioEnTransaccion(
            pool,
            { id_usuario: idUsuario, rol },
            { solo_no_leidas: true }
        );
        res.status(200).json({
            rol,
            total_no_leidas: bandeja.total_no_leidas,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener el contador de alertas no leídas');
    }
};

export const marcarAlertaComoLeida = async (req: Request, res: Response): Promise<void> => {
    try {
        const idAlerta = Number(req.params.id);
        const idUsuario = obtenerIdEjecutor(req) ?? 0;
        const payload = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        const rol = normalizarRolAlerta(payload?.rol);

        const resultado = await ejecutarTransaccion((cliente) =>
            marcarAlertaLeidaEnTransaccion(cliente, idAlerta, { id_usuario: idUsuario, rol })
        );
        res.status(200).json({
            mensaje: 'Alerta marcada como leída',
            ...resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al marcar la alerta como leída');
    }
};

export const marcarTodasAlertasComoLeidas = async (req: Request, res: Response): Promise<void> => {
    try {
        const idUsuario = obtenerIdEjecutor(req) ?? 0;
        const payload = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        const rol = normalizarRolAlerta(payload?.rol);

        const resultado = await ejecutarTransaccion((cliente) =>
            marcarTodasAlertasLeidasEnTransaccion(cliente, { id_usuario: idUsuario, rol })
        );
        res.status(200).json({
            mensaje: `${resultado.marcadas} alerta(s) marcada(s) como leídas`,
            ...resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al marcar todas las alertas como leídas');
    }
};

export const crearAlertaSistema = async (req: Request, res: Response): Promise<void> => {
    try {
        const alerta = await ejecutarTransaccion((cliente) =>
            crearAlertaConDespachoOpcionalEnTransaccion(cliente, req.body ?? {})
        );
        res.status(201).json({
            mensaje: alerta.correo_enviado
                ? `Alerta creada y despachada por correo a ${alerta.destinatario_correo}`
                : 'Alerta registrada en la bandeja del sistema',
            alerta,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al crear la alerta del sistema');
    }
};

export const obtenerConfiguracionCorreoAlertas = async (_req: Request, res: Response): Promise<void> => {
    try {
        const resultado = await pool.query(
            `SELECT tipo_alerta, codigo_historia, descripcion, enviar_correo, correo_destino_defecto, fecha_actualizacion
             FROM configuracion_correo_alertas
             ORDER BY codigo_historia ASC, tipo_alerta ASC`
        );
        res.status(200).json(
            resultado.rows.length > 0
                ? resultado.rows
                : Object.values(CATALOGO_TIPOS_ALERTA).map((c) => ({
                      tipo_alerta: c.tipo,
                      codigo_historia: c.codigo_historia,
                      enviar_correo: c.enviar_correo_por_defecto,
                  }))
        );
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar la configuración de correo de alertas');
    }
};

export const actualizarConfiguracionCorreoAlerta = async (req: Request, res: Response): Promise<void> => {
    try {
        const tipoAlerta = String(req.params.tipo ?? req.body?.tipo_alerta ?? '').trim();
        if (!tipoAlerta) {
            throw new ErrorAplicacion(400, 'Debe indicar el tipo_alerta a configurar');
        }
        const enviarCorreoFlag = Boolean(req.body?.enviar_correo);
        const correoDestino =
            typeof req.body?.correo_destino_defecto === 'string' && req.body.correo_destino_defecto.trim()
                ? req.body.correo_destino_defecto.trim()
                : null;
        const codigoHistoria = obtenerCodigoHistoriaAlerta(tipoAlerta);

        const resultado = await pool.query(
            `INSERT INTO configuracion_correo_alertas (tipo_alerta, codigo_historia, descripcion, enviar_correo, correo_destino_defecto, fecha_actualizacion)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (tipo_alerta) DO UPDATE
             SET enviar_correo = EXCLUDED.enviar_correo,
                 correo_destino_defecto = COALESCE(EXCLUDED.correo_destino_defecto, configuracion_correo_alertas.correo_destino_defecto),
                 fecha_actualizacion = CURRENT_TIMESTAMP
             RETURNING *`,
            [tipoAlerta, codigoHistoria, `Configuración correo ${tipoAlerta}`, enviarCorreoFlag, correoDestino]
        );
        res.status(200).json({
            mensaje: 'Configuración de despacho por correo actualizada',
            configuracion: resultado.rows[0],
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al actualizar la configuración de correo de la alerta');
    }
};
