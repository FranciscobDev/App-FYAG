import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { AlertaReposicionH40 } from '../services/motorReposicionService';
import { ejecutarTransaccion } from '../services/transaccion';

export interface ItemSolicitudEmisionInput {
    id_articulo?: number;
    sku?: string;
    cantidad_solicitada?: number;
    cantidad?: number;
    quantity?: number;
}

export interface LineaSolicitudEmitida {
    id_detalle_solicitud: number;
    id_solicitud: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_solicitada: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    comprometido_anterior: number;
    comprometido_nuevo: number;
}

export interface SolicitudEmitidaCompleta {
    id_solicitud: number;
    id_proyecto: number;
    proyecto_id: number;
    nombre_proyecto: string;
    estado_proyecto: string;
    id_usuario: number;
    bodeguero_id: number;
    estado_solicitud: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Anulada' | 'En Proceso' | 'Completada';
    estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Anulada';
    motivo_rechazo: string | null;
    nro_comprobante: string | null;
    descripcion_solicitud: string | null;
    fecha_solicitud: string;
    lineas: LineaSolicitudEmitida[];
    alerta_administrador: AlertaReposicionH40 | null;
}

const ESTADOS_PROYECTO_ACTIVOS_BD = new Set([
    'planificado',
    'en proceso',
    'en_curso',
    'activo',
]);

export const esEstadoProyectoActivoBd = (estadoProyecto: unknown): boolean => {
    const limpio = String(estadoProyecto || '').trim().toLowerCase();
    if (!limpio) return false;
    if (
        limpio === 'completado' ||
        limpio === 'cancelado' ||
        limpio === 'pausado' ||
        limpio === 'cerrado' ||
        limpio === 'finalizado' ||
        limpio === 'inactivo'
    ) {
        return false;
    }
    return ESTADOS_PROYECTO_ACTIVOS_BD.has(limpio);
};

/**
 * [BACK-1] Emite una Solicitud de Insumos dentro de una transacción atómica:
 *  1. Exige proyecto obligatorio y en estado activo ('Planificado' o 'En Proceso').
 *  2. Exige al menos un insumo con cantidad > 0.
 *  3. Acumula cantidades por artículo y bloquea con `FOR UPDATE` las filas de stock.
 *  4. Si la cantidad solicitada de cualquier ítem supera el stock disponible (p. ej. 1 unidad más del disponible),
 *     rechaza toda la solicitud lanzando `ErrorAplicacion(400)` sin crear cabecera ni tocar saldos.
 *  5. Si todos cumplen, inserta la solicitud en estado inicial `'Pendiente'`, descuenta de `cantidad_disponible`
 *     (`disponible`), suma a `cantidad_comprometida` (`comprometido`) y genera notificación/alerta al Administrador.
 */
export const emitirSolicitudInsumosEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        id_proyecto?: number;
        proyecto_id?: number;
        id_usuario?: number | null;
        descripcion_solicitud?: string | null;
        items?: ItemSolicitudEmisionInput[];
        lineas?: ItemSolicitudEmisionInput[];
    }
): Promise<SolicitudEmitidaCompleta> => {
    const idProyecto = Number(datos.id_proyecto ?? datos.proyecto_id ?? 0);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
        throw new ErrorAplicacion(400, 'El proyecto es obligatorio para emitir una solicitud de insumos');
    }

    const itemsRaw = Array.isArray(datos.items)
        ? datos.items
        : Array.isArray(datos.lineas)
          ? datos.lineas
          : [];

    if (itemsRaw.length === 0) {
        throw new ErrorAplicacion(400, 'Debe incluir al menos un insumo y cantidad en la solicitud');
    }

    // 1. Verificar que el proyecto exista y esté ACTIVO
    const proyRes = await cliente.query<{
        id_proyecto: number;
        nombre_proyecto: string;
        estado_proyecto: string;
    }>(
        `SELECT id_proyecto, nombre_proyecto, estado_proyecto::text AS estado_proyecto
         FROM proyecto
         WHERE id_proyecto = $1
         LIMIT 1`,
        [idProyecto]
    );
    if (proyRes.rows.length === 0) {
        throw new ErrorAplicacion(404, 'El proyecto indicado no existe');
    }
    const proyecto = proyRes.rows[0];
    if (!esEstadoProyectoActivoBd(proyecto.estado_proyecto)) {
        throw new ErrorAplicacion(
            400,
            `Solo se pueden solicitar insumos para proyectos activos. El proyecto "${proyecto.nombre_proyecto}" se encuentra en estado '${proyecto.estado_proyecto}'.`
        );
    }

    // 2. Resolver usuario solicitante
    let idUsuarioFinal =
        datos.id_usuario && Number.isInteger(Number(datos.id_usuario)) && Number(datos.id_usuario) > 0
            ? Number(datos.id_usuario)
            : 0;
    if (idUsuarioFinal <= 0) {
        const usrRes = await cliente.query<{ id_usuario: number }>(
            'SELECT id_usuario FROM usuario WHERE activo = TRUE ORDER BY id_usuario ASC LIMIT 1'
        );
        idUsuarioFinal = usrRes.rows[0] ? Number(usrRes.rows[0].id_usuario) : 1;
    }

    // 3. Resolver cada ítem y acumular cantidades por id_articulo
    const itemsResueltos: {
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad: number;
    }[] = [];
    const acumuladoPorArticulo = new Map<number, number>();

    for (const raw of itemsRaw) {
        const cant = Number(raw.cantidad_solicitada ?? raw.cantidad ?? raw.quantity ?? NaN);
        if (!Number.isFinite(cant) || cant <= 0) {
            throw new ErrorAplicacion(400, 'Todas las cantidades solicitadas deben ser números mayores a 0');
        }

        let idArt = raw.id_articulo ? Number(raw.id_articulo) : 0;
        const skuInput = raw.sku ? String(raw.sku).trim() : '';

        const artRes = await cliente.query<{
            id_articulo: number;
            sku: string | null;
            nombre_articulo: string;
            activo: boolean;
        }>(
            idArt > 0
                ? 'SELECT id_articulo, sku, nombre_articulo, activo FROM articulo WHERE id_articulo = $1 LIMIT 1'
                : 'SELECT id_articulo, sku, nombre_articulo, activo FROM articulo WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1)) LIMIT 1',
            [idArt > 0 ? idArt : skuInput]
        );

        if (artRes.rows.length === 0) {
            throw new ErrorAplicacion(
                404,
                `El insumo ${idArt > 0 ? `#${idArt}` : `'${skuInput}'`} no existe en el catálogo`
            );
        }
        const art = artRes.rows[0];
        if (!art.activo) {
            throw new ErrorAplicacion(
                400,
                `El insumo "${art.nombre_articulo}" (${art.sku || art.id_articulo}) se encuentra inactivo`
            );
        }

        idArt = Number(art.id_articulo);
        const cantRedondeada = Number(cant.toFixed(3));
        acumuladoPorArticulo.set(
            idArt,
            Number(((acumuladoPorArticulo.get(idArt) || 0) + cantRedondeada).toFixed(3))
        );
        itemsResueltos.push({
            id_articulo: idArt,
            sku: art.sku || String(idArt),
            nombre_articulo: art.nombre_articulo,
            cantidad: cantRedondeada,
        });
    }

    // 4. Validar stock disponible para TODOS los insumos ANTES de crear la solicitud o modificar saldos
    const stockPorArticulo = new Map<
        number,
        { disponible: number; comprometido: number }
    >();
    const erroresStock: string[] = [];

    for (const [idArt, totalSolicitado] of acumuladoPorArticulo.entries()) {
        const stockRes = await cliente.query<{
            cantidad_disponible: number;
            cantidad_comprometida: number;
        }>(
            `SELECT COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible,
                    COALESCE(cantidad_comprometida, 0)::float8 AS cantidad_comprometida
             FROM articulos_stock
             WHERE id_articulo = $1
             FOR UPDATE`,
            [idArt]
        );

        const dispActual = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_disponible) : 0;
        const compActual = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_comprometida) : 0;
        stockPorArticulo.set(idArt, { disponible: dispActual, comprometido: compActual });

        if (totalSolicitado > dispActual) {
            const infoArt = itemsResueltos.find((i) => i.id_articulo === idArt)!;
            const faltante = Number((totalSolicitado - dispActual).toFixed(3));
            erroresStock.push(
                `${infoArt.nombre_articulo} (${infoArt.sku}): solicitado ${totalSolicitado}, disponible ${dispActual} (faltan ${faltante})`
            );
        }
    }

    if (erroresStock.length > 0) {
        throw new ErrorAplicacion(
            400,
            `Stock disponible insuficiente para emitir la solicitud: ${erroresStock.join(' | ')}`
        );
    }

    // 5. Insertar cabecera de la solicitud en estado inicial 'Pendiente' en `solicitudes_insumos` [DB] y en `solicitudes`
    const descripcionFinal =
        typeof datos.descripcion_solicitud === 'string' && datos.descripcion_solicitud.trim() !== ''
            ? datos.descripcion_solicitud.trim().slice(0, 250)
            : null;

    const solInsumosRes = await cliente.query<{
        id_solicitud: number;
        estado: 'Pendiente';
        fecha_solicitud: string;
    }>(
        `INSERT INTO solicitudes_insumos (proyecto_id, bodeguero_id, estado, motivo_rechazo, nro_comprobante, descripcion_solicitud)
         VALUES ($1, $2, 'Pendiente', NULL, NULL, $3)
         RETURNING id_solicitud, estado::text AS estado, fecha_solicitud::text AS fecha_solicitud`,
        [idProyecto, idUsuarioFinal, descripcionFinal]
    );

    const solRes = await cliente.query<{
        id_solicitud: number;
        estado_solicitud: 'Pendiente';
        fecha_solicitud: string;
    }>(
        `INSERT INTO solicitudes (id_usuario, id_proyecto, estado_solicitud, descripcion_solicitud)
         VALUES ($1, $2, 'Pendiente', $3)
         RETURNING id_solicitud, estado_solicitud::text AS estado_solicitud, fecha_solicitud::text AS fecha_solicitud`,
        [idUsuarioFinal, idProyecto, descripcionFinal]
    );
    const idSolicitudInsumos = Number(
        solInsumosRes.rows[0]?.id_solicitud ?? solRes.rows[0]?.id_solicitud ?? 1
    );
    const idSolicitud = Number(solRes.rows[0]?.id_solicitud ?? idSolicitudInsumos);
    const fechaSolicitud =
        solInsumosRes.rows[0]?.fecha_solicitud ??
        solRes.rows[0]?.fecha_solicitud ??
        new Date().toISOString();

    // 6. Insertar `solicitud_lineas` [DB] y `detalle_solicitudes`, y transferir stock de disponible a comprometido
    const lineasEmitidas: LineaSolicitudEmitida[] = [];

    for (const item of itemsResueltos) {
        const linInsumosRes = await cliente.query<{ id_solicitud_linea: number }>(
            `INSERT INTO solicitud_lineas (id_solicitud, id_articulo, cantidad_solicitada)
             VALUES ($1, $2, $3)
             RETURNING id_solicitud_linea`,
            [idSolicitudInsumos, item.id_articulo, item.cantidad]
        );
        const detRes = await cliente.query<{ id_detalle_solicitud: number }>(
            `INSERT INTO detalle_solicitudes (id_solicitud, id_articulo, cantidad_solicitada)
             VALUES ($1, $2, $3)
             RETURNING id_detalle_solicitud`,
            [idSolicitud, item.id_articulo, item.cantidad]
        );
        const idDetalle = Number(
            detRes.rows[0]?.id_detalle_solicitud ?? linInsumosRes.rows[0]?.id_solicitud_linea ?? 1
        );

        const estadoStock = stockPorArticulo.get(item.id_articulo)!;
        const dispAnterior = estadoStock.disponible;
        const compAnterior = estadoStock.comprometido;
        const dispNuevo = Number((dispAnterior - item.cantidad).toFixed(3));
        const compNuevo = Number((compAnterior + item.cantidad).toFixed(3));

        await cliente.query(
            `UPDATE articulos_stock
             SET cantidad_disponible = $2,
                 cantidad_comprometida = $3
             WHERE id_articulo = $1`,
            [item.id_articulo, dispNuevo, compNuevo]
        );

        // Actualizar el mapa en memoria por si hay otra línea del mismo artículo
        stockPorArticulo.set(item.id_articulo, {
            disponible: dispNuevo,
            comprometido: compNuevo,
        });

        lineasEmitidas.push({
            id_detalle_solicitud: idDetalle,
            id_solicitud: idSolicitud,
            id_articulo: item.id_articulo,
            sku: item.sku,
            nombre_articulo: item.nombre_articulo,
            cantidad_solicitada: item.cantidad,
            disponible_anterior: dispAnterior,
            disponible_nuevo: dispNuevo,
            comprometido_anterior: compAnterior,
            comprometido_nuevo: compNuevo,
        });
    }

    // 7. Notificar al Administrador registrando alerta en `alertas_sistema`
    const resumenInsumos = lineasEmitidas
        .map((l) => `${l.cantidad_solicitada} x ${l.sku} (${l.nombre_articulo})`)
        .join(', ');

    const alertaRes = await cliente.query<AlertaReposicionH40>(
        `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('nueva_solicitud_insumos', 'amarillo', $1, $2, $3, NULL, FALSE)
         RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida, fecha_creacion::text AS fecha_creacion`,
        [
            `Nueva Solicitud de Insumos #${idSolicitud} Pendiente (${proyecto.nombre_proyecto})`,
            `Solicitud #${idSolicitud} en estado Pendiente para el proyecto "${proyecto.nombre_proyecto}": ${resumenInsumos}. El stock solicitado pasó a Comprometido.`,
            lineasEmitidas[0]?.id_articulo ?? null,
        ]
    );
    const alertaAdmin = alertaRes.rows[0] ?? null;

    await registrarAuditoria(
        {
            entidad: 'solicitud',
            accion: 'emitir_solicitud_insumos',
            idRegistro: idSolicitud,
            idUsuarioEjecutor: idUsuarioFinal,
            estadoAnterior: null,
            estadoNuevo: {
                id_solicitud: idSolicitud,
                id_proyecto: idProyecto,
                estado_solicitud: 'Pendiente',
                lineas: lineasEmitidas,
            },
            descripcion: `Solicitud de insumos #${idSolicitud} emitida en estado Pendiente para proyecto #${idProyecto} (${proyecto.nombre_proyecto}) con reserva de stock comprometido`,
        },
        cliente
    );

    return {
        id_solicitud: idSolicitudInsumos || idSolicitud,
        id_proyecto: idProyecto,
        proyecto_id: idProyecto,
        nombre_proyecto: proyecto.nombre_proyecto,
        estado_proyecto: proyecto.estado_proyecto,
        id_usuario: idUsuarioFinal,
        bodeguero_id: idUsuarioFinal,
        estado_solicitud: 'Pendiente',
        estado: 'Pendiente',
        motivo_rechazo: null,
        nro_comprobante: null,
        descripcion_solicitud: descripcionFinal,
        fecha_solicitud: fechaSolicitud,
        lineas: lineasEmitidas,
        alerta_administrador: alertaAdmin,
    };
};

export const crearSolicitudInsumos = async (
    req: Request<
        Record<string, string>,
        unknown,
        {
            id_proyecto?: number;
            proyecto_id?: number;
            descripcion_solicitud?: string | null;
            items?: ItemSolicitudEmisionInput[];
            lineas?: ItemSolicitudEmisionInput[];
        }
    >,
    res: Response
): Promise<void> => {
    const idEjecutor = obtenerIdEjecutor(req);

    try {
        const resultado = await ejecutarTransaccion((cliente) =>
            emitirSolicitudInsumosEnTransaccion(cliente, {
                ...req.body,
                id_usuario: idEjecutor,
            })
        );

        res.status(201).json({
            mensaje: `Solicitud de insumos #${resultado.id_solicitud} creada en estado Pendiente. Stock reservado en Comprometido.`,
            solicitud: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al emitir la solicitud de insumos');
    }
};

export const ESTADOS_SOLICITUD_INSUMOS = [
    'Pendiente',
    'Aprobada',
    'Rechazada',
    'Anulada',
] as const;

export type EstadoSolicitudInsumos = (typeof ESTADOS_SOLICITUD_INSUMOS)[number];

/**
 * [DB] Inserta directamente en `solicitudes_insumos` y `solicitud_lineas` dentro de una transacción,
 * verificando estructura, estados permitidos ('Pendiente' | 'Aprobada' | 'Rechazada' | 'Anulada'),
 * `motivo_rechazo`, `nro_comprobante` y claves foráneas hacia `proyecto(id_proyecto)` y `usuario(id_usuario)`.
 */
export const insertarSolicitudInsumosDbEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        proyecto_id: number;
        bodeguero_id: number;
        estado?: EstadoSolicitudInsumos;
        motivo_rechazo?: string | null;
        nro_comprobante?: string | null;
        descripcion_solicitud?: string | null;
        lineas: { id_articulo: number; cantidad_solicitada: number }[];
    }
): Promise<{
    id_solicitud: number;
    proyecto_id: number;
    bodeguero_id: number;
    estado: EstadoSolicitudInsumos;
    motivo_rechazo: string | null;
    nro_comprobante: string | null;
    lineas: {
        id_solicitud_linea: number;
        id_solicitud: number;
        id_articulo: number;
        cantidad_solicitada: number;
    }[];
}> => {
    const proyectoId = Number(datos.proyecto_id);
    const bodegueroId = Number(datos.bodeguero_id);
    const estado: EstadoSolicitudInsumos = datos.estado ?? 'Pendiente';

    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
        throw new ErrorAplicacion(400, 'proyecto_id debe referenciar un proyecto existente');
    }
    if (!Number.isInteger(bodegueroId) || bodegueroId <= 0) {
        throw new ErrorAplicacion(400, 'bodeguero_id debe referenciar un usuario existente');
    }
    if (!(ESTADOS_SOLICITUD_INSUMOS as readonly string[]).includes(estado)) {
        throw new ErrorAplicacion(
            400,
            `Estado de solicitud inválido ('${estado}'). Valores permitidos: ${ESTADOS_SOLICITUD_INSUMOS.join(', ')}`
        );
    }

    // Verificar clave foránea hacia `proyecto(id_proyecto)`
    const proyRes = await cliente.query<{ id_proyecto: number }>(
        'SELECT id_proyecto FROM proyecto WHERE id_proyecto = $1 LIMIT 1',
        [proyectoId]
    );
    if (proyRes.rows.length === 0) {
        const fkError: any = new Error(
            `insert or update on table "solicitudes_insumos" violates foreign key constraint "fk_solicitudes_insumos_proyecto": Key (proyecto_id)=(${proyectoId}) is not present in table "proyecto".`
        );
        fkError.code = '23503';
        throw fkError;
    }

    const cabRes = await cliente.query<{ id_solicitud: number }>(
        `INSERT INTO solicitudes_insumos (proyecto_id, bodeguero_id, estado, motivo_rechazo, nro_comprobante, descripcion_solicitud)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_solicitud`,
        [
            proyectoId,
            bodegueroId,
            estado,
            datos.motivo_rechazo ?? null,
            datos.nro_comprobante ?? null,
            datos.descripcion_solicitud ?? null,
        ]
    );
    const idSolicitud = Number(cabRes.rows[0].id_solicitud);

    const lineasInsertadas: {
        id_solicitud_linea: number;
        id_solicitud: number;
        id_articulo: number;
        cantidad_solicitada: number;
    }[] = [];

    for (const l of datos.lineas || []) {
        const cant = Number(l.cantidad_solicitada);
        if (!Number.isFinite(cant) || cant <= 0) {
            throw new ErrorAplicacion(400, 'cantidad_solicitada debe ser mayor a 0');
        }
        const linRes = await cliente.query<{ id_solicitud_linea: number }>(
            `INSERT INTO solicitud_lineas (id_solicitud, id_articulo, cantidad_solicitada)
             VALUES ($1, $2, $3)
             RETURNING id_solicitud_linea`,
            [idSolicitud, Number(l.id_articulo), cant]
        );
        lineasInsertadas.push({
            id_solicitud_linea: Number(linRes.rows[0].id_solicitud_linea),
            id_solicitud: idSolicitud,
            id_articulo: Number(l.id_articulo),
            cantidad_solicitada: cant,
        });
    }

    return {
        id_solicitud: idSolicitud,
        proyecto_id: proyectoId,
        bodeguero_id: bodegueroId,
        estado,
        motivo_rechazo: datos.motivo_rechazo ?? null,
        nro_comprobante: datos.nro_comprobante ?? null,
        lineas: lineasInsertadas,
    };
};

export const listarSolicitudesInsumos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const cabRes = await pool.query<{
            id_solicitud: number;
            id_usuario: number;
            id_proyecto: number;
            nombre_proyecto: string;
            estado_proyecto: string;
            estado_solicitud: string;
            descripcion_solicitud: string | null;
            fecha_solicitud: string;
        }>(
            `SELECT s.id_solicitud,
                    s.id_usuario,
                    s.id_proyecto,
                    p.nombre_proyecto,
                    p.estado_proyecto::text AS estado_proyecto,
                    s.estado_solicitud::text AS estado_solicitud,
                    s.descripcion_solicitud,
                    s.fecha_solicitud::text AS fecha_solicitud
             FROM solicitudes s
             JOIN proyecto p ON p.id_proyecto = s.id_proyecto
             ORDER BY s.id_solicitud DESC`
        );

        const detRes = await pool.query<{
            id_detalle_solicitud: number;
            id_solicitud: number;
            id_articulo: number;
            sku: string | null;
            nombre_articulo: string;
            cantidad_solicitada: number;
        }>(
            `SELECT d.id_detalle_solicitud,
                    d.id_solicitud,
                    d.id_articulo,
                    a.sku,
                    a.nombre_articulo,
                    d.cantidad_solicitada::float8 AS cantidad_solicitada
             FROM detalle_solicitudes d
             JOIN articulo a ON a.id_articulo = d.id_articulo
             ORDER BY d.id_detalle_solicitud ASC`
        );

        const resultado = cabRes.rows.map((s) => ({
            ...s,
            lineas: detRes.rows.filter((d) => d.id_solicitud === s.id_solicitud),
        }));

        res.status(200).json(resultado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las solicitudes de insumos');
    }
};
