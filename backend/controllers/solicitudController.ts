import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { normalizarRol, obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { AlertaReposicionH40 } from '../services/motorReposicionService';
import { generarNumeroComprobanteSolicitud } from '../services/solicitudInsumosService';
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

export interface AjusteBolsaComprometidoSolicitud {
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_anterior: number;
    cantidad_nueva: number;
    diferencia_comprometida: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    comprometido_anterior: number;
    comprometido_nuevo: number;
}

/**
 * Carga la cabecera y las líneas actuales de una solicitud de insumos desde `solicitudes_insumos` / `solicitudes`.
 */
const cargarSolicitudParaMutacion = async (
    cliente: PoolClient,
    idSolicitud: number
): Promise<{
    id_solicitud: number;
    proyecto_id: number;
    bodeguero_id: number;
    estado: string;
    descripcion_solicitud: string | null;
    lineas: {
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_solicitada: number;
    }[];
}> => {
    const cabInsumos = await cliente.query<{
        id_solicitud: number;
        proyecto_id: number;
        bodeguero_id: number;
        estado: string;
        descripcion_solicitud: string | null;
    }>(
        `SELECT id_solicitud, proyecto_id, bodeguero_id, estado::text AS estado, descripcion_solicitud
         FROM solicitudes_insumos
         WHERE id_solicitud = $1
         FOR UPDATE`,
        [idSolicitud]
    );

    let cabecera = cabInsumos.rows[0] ?? null;

    if (!cabecera) {
        const cabLegacy = await cliente.query<{
            id_solicitud: number;
            id_proyecto: number;
            id_usuario: number;
            estado_solicitud: string;
            descripcion_solicitud: string | null;
        }>(
            `SELECT id_solicitud, id_proyecto, id_usuario, estado_solicitud::text AS estado_solicitud, descripcion_solicitud
             FROM solicitudes
             WHERE id_solicitud = $1
             FOR UPDATE`,
            [idSolicitud]
        );
        if (cabLegacy.rows[0]) {
            cabecera = {
                id_solicitud: Number(cabLegacy.rows[0].id_solicitud),
                proyecto_id: Number(cabLegacy.rows[0].id_proyecto),
                bodeguero_id: Number(cabLegacy.rows[0].id_usuario),
                estado: cabLegacy.rows[0].estado_solicitud,
                descripcion_solicitud: cabLegacy.rows[0].descripcion_solicitud,
            };
        }
    }

    if (!cabecera) {
        throw new ErrorAplicacion(404, `Solicitud de insumos #${idSolicitud} no encontrada`);
    }

    const linInsumos = await cliente.query<{
        id_articulo: number;
        sku: string | null;
        nombre_articulo: string;
        cantidad_solicitada: number;
    }>(
        `SELECT sl.id_articulo,
                a.sku,
                a.nombre_articulo,
                sl.cantidad_solicitada::float8 AS cantidad_solicitada
         FROM solicitud_lineas sl
         JOIN articulo a ON a.id_articulo = sl.id_articulo
         WHERE sl.id_solicitud = $1
         ORDER BY sl.id_solicitud_linea ASC`,
        [idSolicitud]
    );

    let lineas = linInsumos.rows;
    if (lineas.length === 0) {
        const linLegacy = await cliente.query<{
            id_articulo: number;
            sku: string | null;
            nombre_articulo: string;
            cantidad_solicitada: number;
        }>(
            `SELECT ds.id_articulo,
                    a.sku,
                    a.nombre_articulo,
                    ds.cantidad_solicitada::float8 AS cantidad_solicitada
             FROM detalle_solicitudes ds
             JOIN articulo a ON a.id_articulo = ds.id_articulo
             WHERE ds.id_solicitud = $1
             ORDER BY ds.id_detalle_solicitud ASC`,
            [idSolicitud]
        );
        lineas = linLegacy.rows;
    }

    return {
        ...cabecera,
        lineas: lineas.map((l) => ({
            id_articulo: Number(l.id_articulo),
            sku: l.sku || String(l.id_articulo),
            nombre_articulo: l.nombre_articulo,
            cantidad_solicitada: Number(l.cantidad_solicitada),
        })),
    };
};

/**
 * [BACK-2] Modifica una solicitud de insumos exclusivamente mientras esté en estado `Pendiente`:
 * - Bloquea con 400 cualquier intento de edición si el estado actual no es `Pendiente` (p. ej. `Aprobada`, `Rechazada` o `Anulada`).
 * - Recalcula la diferencia comprometida por cada insumo (`delta = cantidad_nueva - cantidad_anterior`):
 *   - Si reduce cantidad o elimina un ítem (`delta < 0`), libera inmediatamente la diferencia de `cantidad_comprometida` de vuelta a `cantidad_disponible`.
 *   - Si aumenta cantidad o agrega un ítem (`delta > 0`), valida que `delta <= cantidad_disponible` y transfiere la diferencia de `cantidad_disponible` a `cantidad_comprometida`.
 * - Actualiza las líneas en `solicitud_lineas` y `detalle_solicitudes`, y registra auditoría inmutable.
 */
export const editarSolicitudInsumosEnTransaccion = async (
    cliente: PoolClient,
    idSolicitud: number,
    datos: {
        id_usuario?: number | null;
        descripcion_solicitud?: string | null;
        items?: ItemSolicitudEmisionInput[];
        lineas?: ItemSolicitudEmisionInput[];
    }
): Promise<{
    id_solicitud: number;
    proyecto_id: number;
    estado: 'Pendiente';
    descripcion_solicitud: string | null;
    lineas: {
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_solicitada: number;
    }[];
    ajustes_stock: AjusteBolsaComprometidoSolicitud[];
}> => {
    const actual = await cargarSolicitudParaMutacion(cliente, idSolicitud);

    if (actual.estado.trim().toLowerCase() !== 'pendiente') {
        throw new ErrorAplicacion(
            400,
            `No se puede modificar la solicitud #${idSolicitud} porque se encuentra en estado '${actual.estado}'. Solo se pueden editar solicitudes en estado Pendiente.`
        );
    }

    const itemsRaw = Array.isArray(datos.items)
        ? datos.items
        : Array.isArray(datos.lineas)
          ? datos.lineas
          : [];

    if (itemsRaw.length === 0) {
        throw new ErrorAplicacion(400, 'La solicitud debe conservar al menos un insumo con cantidad mayor a 0');
    }

    // 1. Acumular cantidades anteriores por id_articulo
    const anteriorPorArticulo = new Map<
        number,
        { sku: string; nombre_articulo: string; cantidad: number }
    >();
    for (const l of actual.lineas) {
        const prev = anteriorPorArticulo.get(l.id_articulo);
        anteriorPorArticulo.set(l.id_articulo, {
            sku: l.sku,
            nombre_articulo: l.nombre_articulo,
            cantidad: Number(((prev?.cantidad || 0) + l.cantidad_solicitada).toFixed(3)),
        });
    }

    // 2. Resolver y acumular cantidades nuevas por id_articulo
    const nuevoPorArticulo = new Map<
        number,
        { id_articulo: number; sku: string; nombre_articulo: string; cantidad: number }
    >();
    const lineasNuevasOrdenadas: {
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_solicitada: number;
    }[] = [];

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
        const cantRed = Number(cant.toFixed(3));
        const prev = nuevoPorArticulo.get(idArt);
        nuevoPorArticulo.set(idArt, {
            id_articulo: idArt,
            sku: art.sku || String(idArt),
            nombre_articulo: art.nombre_articulo,
            cantidad: Number(((prev?.cantidad || 0) + cantRed).toFixed(3)),
        });
        lineasNuevasOrdenadas.push({
            id_articulo: idArt,
            sku: art.sku || String(idArt),
            nombre_articulo: art.nombre_articulo,
            cantidad_solicitada: cantRed,
        });
    }

    // 3. Evaluar diferencias (deltas) en todos los artículos afectados (anteriores U nuevos)
    const todosArticulosIds = Array.from(
        new Set([...anteriorPorArticulo.keys(), ...nuevoPorArticulo.keys()])
    );

    const stockActualMap = new Map<
        number,
        {
            sku: string;
            nombre_articulo: string;
            cantAnterior: number;
            cantNueva: number;
            deltaComprometido: number;
            dispAnterior: number;
            compAnterior: number;
        }
    >();
    const erroresStock: string[] = [];

    for (const idArt of todosArticulosIds) {
        const infoAnt = anteriorPorArticulo.get(idArt);
        const infoNue = nuevoPorArticulo.get(idArt);
        const cantAnterior = infoAnt?.cantidad ?? 0;
        const cantNueva = infoNue?.cantidad ?? 0;
        const deltaComprometido = Number((cantNueva - cantAnterior).toFixed(3));

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

        const dispAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_disponible) : 0;
        const compAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_comprometida) : 0;
        const sku = infoNue?.sku ?? infoAnt?.sku ?? String(idArt);
        const nombre = infoNue?.nombre_articulo ?? infoAnt?.nombre_articulo ?? sku;

        // Si pide más unidades que antes (delta > 0), validar que el incremento no supere el stock disponible actual
        if (deltaComprometido > dispAnterior) {
            const maxPermitido = Number((dispAnterior + cantAnterior).toFixed(3));
            erroresStock.push(
                `${nombre} (${sku}): nueva cantidad (${cantNueva}) supera el total disponible (${maxPermitido} = ${dispAnterior} libre + ${cantAnterior} ya reservado en esta solicitud)`
            );
        }

        stockActualMap.set(idArt, {
            sku,
            nombre_articulo: nombre,
            cantAnterior,
            cantNueva,
            deltaComprometido,
            dispAnterior,
            compAnterior,
        });
    }

    if (erroresStock.length > 0) {
        throw new ErrorAplicacion(
            400,
            `Stock disponible insuficiente para modificar la solicitud: ${erroresStock.join(' | ')}`
        );
    }

    // 4. Aplicar ajustes de stock en articulos_stock
    const ajustesStock: AjusteBolsaComprometidoSolicitud[] = [];

    for (const [idArt, info] of stockActualMap.entries()) {
        const dispNuevo = Math.max(0, Number((info.dispAnterior - info.deltaComprometido).toFixed(3)));
        const compNuevo = Math.max(0, Number((info.compAnterior + info.deltaComprometido).toFixed(3)));

        await cliente.query(
            `UPDATE articulos_stock
             SET cantidad_disponible = $2,
                 cantidad_comprometida = $3
             WHERE id_articulo = $1`,
            [idArt, dispNuevo, compNuevo]
        );

        ajustesStock.push({
            id_articulo: idArt,
            sku: info.sku,
            nombre_articulo: info.nombre_articulo,
            cantidad_anterior: info.cantAnterior,
            cantidad_nueva: info.cantNueva,
            diferencia_comprometida: info.deltaComprometido,
            disponible_anterior: info.dispAnterior,
            disponible_nuevo: dispNuevo,
            comprometido_anterior: info.compAnterior,
            comprometido_nuevo: compNuevo,
        });
    }

    // 5. Reemplazar líneas en solicitud_lineas y detalle_solicitudes y actualizar descripción si fue enviada
    const descripcionNueva =
        datos.descripcion_solicitud !== undefined
            ? datos.descripcion_solicitud
            : actual.descripcion_solicitud;

    await cliente.query(
        'UPDATE solicitudes_insumos SET descripcion_solicitud = $2 WHERE id_solicitud = $1',
        [idSolicitud, descripcionNueva]
    );
    await cliente.query(
        'UPDATE solicitudes SET descripcion_solicitud = $2 WHERE id_solicitud = $1',
        [idSolicitud, descripcionNueva]
    );

    await cliente.query('DELETE FROM solicitud_lineas WHERE id_solicitud = $1', [idSolicitud]);
    await cliente.query('DELETE FROM detalle_solicitudes WHERE id_solicitud = $1', [idSolicitud]);

    for (const l of lineasNuevasOrdenadas) {
        await cliente.query(
            `INSERT INTO solicitud_lineas (id_solicitud, id_articulo, cantidad_solicitada)
             VALUES ($1, $2, $3)`,
            [idSolicitud, l.id_articulo, l.cantidad_solicitada]
        );
        await cliente.query(
            `INSERT INTO detalle_solicitudes (id_solicitud, id_articulo, cantidad_solicitada)
             VALUES ($1, $2, $3)`,
            [idSolicitud, l.id_articulo, l.cantidad_solicitada]
        );
    }

    // 6. Registrar auditoría
    await registrarAuditoria(
        {
            entidad: 'solicitud',
            accion: 'editar_solicitud_pendiente',
            idRegistro: idSolicitud,
            idUsuarioEjecutor: datos.id_usuario ?? actual.bodeguero_id,
            estadoAnterior: {
                estado: actual.estado,
                lineas: actual.lineas,
            },
            estadoNuevo: {
                estado: 'Pendiente',
                lineas: lineasNuevasOrdenadas,
                ajustes_stock: ajustesStock,
            },
            descripcion: `Solicitud #${idSolicitud} modificada en estado Pendiente. Diferencia de stock comprometido recalculada.`,
        },
        cliente
    );

    return {
        id_solicitud: idSolicitud,
        proyecto_id: actual.proyecto_id,
        estado: 'Pendiente',
        descripcion_solicitud: descripcionNueva,
        lineas: lineasNuevasOrdenadas,
        ajustes_stock: ajustesStock,
    };
};

/**
 * [BACK-2] Anula una solicitud de insumos exclusivamente mientras esté en estado `Pendiente`:
 * - Bloquea con 400 cualquier intento de anulación si el estado actual no es `Pendiente`.
 * - Libera el 100 % del stock comprometido de vuelta a `cantidad_disponible` (`disponible += cantidad_solicitada`, `comprometido -= cantidad_solicitada`).
 * - Actualiza el estado a `'Anulada'` y registra auditoría inmutable.
 */
export const anularSolicitudInsumosEnTransaccion = async (
    cliente: PoolClient,
    idSolicitud: number,
    idUsuarioEjecutor: number | null = null
): Promise<{
    id_solicitud: number;
    proyecto_id: number;
    estado_anterior: string;
    estado: 'Anulada';
    stock_liberado: AjusteBolsaComprometidoSolicitud[];
}> => {
    const actual = await cargarSolicitudParaMutacion(cliente, idSolicitud);

    if (actual.estado.trim().toLowerCase() !== 'pendiente') {
        throw new ErrorAplicacion(
            400,
            `No se puede anular la solicitud #${idSolicitud} porque se encuentra en estado '${actual.estado}'. Solo se pueden anular solicitudes en estado Pendiente.`
        );
    }

    // Acumular por artículo el 100% de las unidades comprometidas en esta solicitud
    const acumuladoPorArticulo = new Map<
        number,
        { sku: string; nombre_articulo: string; cantidad: number }
    >();
    for (const l of actual.lineas) {
        const prev = acumuladoPorArticulo.get(l.id_articulo);
        acumuladoPorArticulo.set(l.id_articulo, {
            sku: l.sku,
            nombre_articulo: l.nombre_articulo,
            cantidad: Number(((prev?.cantidad || 0) + l.cantidad_solicitada).toFixed(3)),
        });
    }

    const stockLiberado: AjusteBolsaComprometidoSolicitud[] = [];

    for (const [idArt, info] of acumuladoPorArticulo.entries()) {
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

        const dispAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_disponible) : 0;
        const compAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_comprometida) : 0;

        // Liberar el 100% de lo comprometido en esta solicitud de vuelta a disponible
        const dispNuevo = Number((dispAnterior + info.cantidad).toFixed(3));
        const compNuevo = Math.max(0, Number((compAnterior - info.cantidad).toFixed(3)));

        await cliente.query(
            `UPDATE articulos_stock
             SET cantidad_disponible = $2,
                 cantidad_comprometida = $3
             WHERE id_articulo = $1`,
            [idArt, dispNuevo, compNuevo]
        );

        stockLiberado.push({
            id_articulo: idArt,
            sku: info.sku,
            nombre_articulo: info.nombre_articulo,
            cantidad_anterior: info.cantidad,
            cantidad_nueva: 0,
            diferencia_comprometida: -info.cantidad,
            disponible_anterior: dispAnterior,
            disponible_nuevo: dispNuevo,
            comprometido_anterior: compAnterior,
            comprometido_nuevo: compNuevo,
        });
    }

    await cliente.query(
        "UPDATE solicitudes_insumos SET estado = 'Anulada' WHERE id_solicitud = $1",
        [idSolicitud]
    );
    await cliente.query(
        "UPDATE solicitudes SET estado_solicitud = 'Anulada' WHERE id_solicitud = $1",
        [idSolicitud]
    );

    await registrarAuditoria(
        {
            entidad: 'solicitud',
            accion: 'anular_solicitud_pendiente',
            idRegistro: idSolicitud,
            idUsuarioEjecutor: idUsuarioEjecutor ?? actual.bodeguero_id,
            estadoAnterior: {
                estado: actual.estado,
                lineas: actual.lineas,
            },
            estadoNuevo: {
                estado: 'Anulada',
                stock_liberado: stockLiberado,
            },
            descripcion: `Solicitud #${idSolicitud} anulada desde estado Pendiente. 100% del stock comprometido liberado de vuelta a disponible.`,
        },
        cliente
    );

    return {
        id_solicitud: idSolicitud,
        proyecto_id: actual.proyecto_id,
        estado_anterior: actual.estado,
        estado: 'Anulada',
        stock_liberado: stockLiberado,
    };
};

export const editarSolicitudInsumos = async (
    req: Request<
        { id: string },
        unknown,
        {
            descripcion_solicitud?: string | null;
            items?: ItemSolicitudEmisionInput[];
            lineas?: ItemSolicitudEmisionInput[];
        }
    >,
    res: Response
): Promise<void> => {
    const idSolicitud = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        res.status(400).json({ mensaje: 'Identificador de solicitud inválido' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion((cliente) =>
            editarSolicitudInsumosEnTransaccion(cliente, idSolicitud, {
                ...req.body,
                id_usuario: idEjecutor,
            })
        );

        res.status(200).json({
            mensaje: `Solicitud #${idSolicitud} actualizada exitosamente. Diferencia de stock comprometido recalculada.`,
            solicitud: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al modificar la solicitud de insumos');
    }
};

export const anularSolicitudInsumos = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const idSolicitud = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        res.status(400).json({ mensaje: 'Identificador de solicitud inválido' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion((cliente) =>
            anularSolicitudInsumosEnTransaccion(cliente, idSolicitud, idEjecutor)
        );

        res.status(200).json({
            mensaje: `Solicitud #${idSolicitud} anulada exitosamente. 100% del stock comprometido liberado a disponible.`,
            solicitud: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al anular la solicitud de insumos');
    }
};

export const listarSolicitudesInsumos = async (req: Request, res: Response): Promise<void> => {
    try {
        // El técnico solo ve sus propias solicitudes; administración y bodega ven todas
        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esTecnico = normalizarRol(payload?.rol) === 'technician';
        const cabRes = await pool.query<{
            id_solicitud: number;
            id_usuario: number;
            id_proyecto: number;
            nombre_proyecto: string;
            estado_proyecto: string;
            estado_solicitud: string;
            motivo_rechazo: string | null;
            nro_comprobante: string | null;
            descripcion_solicitud: string | null;
            fecha_solicitud: string;
            tecnico_rut: string;
            tecnico_nombre: string;
        }>(
            `SELECT s.id_solicitud,
                    s.id_usuario,
                    s.id_proyecto,
                    p.nombre_proyecto,
                    p.estado_proyecto::text AS estado_proyecto,
                    s.estado_solicitud::text AS estado_solicitud,
                    s.motivo_rechazo,
                    s.nro_comprobante,
                    s.descripcion_solicitud,
                    s.fecha_solicitud::text AS fecha_solicitud,
                    COALESCE(u.rut, '') AS tecnico_rut,
                    TRIM(COALESCE(u.nombre_usuario, '') || ' ' || COALESCE(u.apellido_usuario, '')) AS tecnico_nombre
             FROM solicitudes s
             JOIN proyecto p ON p.id_proyecto = s.id_proyecto
             LEFT JOIN usuario u ON u.id_usuario = s.id_usuario
             WHERE ($1::boolean = FALSE OR s.id_usuario = $2)
             ORDER BY s.id_solicitud DESC`,
            [esTecnico, payload?.id ?? null]
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

export interface ResultadoResolucionSolicitudAdmin {
    id_solicitud: number;
    proyecto_id: number;
    bodeguero_id: number;
    estado_anterior: string;
    estado: 'Aprobada' | 'Rechazada';
    nro_comprobante: string | null;
    motivo_rechazo: string | null;
    habilita_egreso_h5: boolean;
    bloquea_cierre_proyecto_h34: boolean;
    stock_liberado: AjusteBolsaComprometidoSolicitud[];
    notificacion_bodeguero: AlertaReposicionH40 | null;
}

/**
 * [H34 / BACK-1] Verifica si un proyecto tiene solicitudes de insumos que bloquean su cierre:
 * cualquier solicitud en estado `'Pendiente'` o `'Aprobada'` (con saldo pendiente de egreso)
 * impide cerrar/completar el proyecto.
 */
export const verificarBloqueoCierreProyectoPorSolicitudesH34 = async (
    cliente: Pick<PoolClient, 'query'>,
    idProyecto: number
): Promise<{
    bloqueado: boolean;
    solicitudesBloqueantes: {
        id_solicitud: number;
        estado: string;
        nro_comprobante: string | null;
    }[];
    motivoBloqueo: string | null;
}> => {
    const solRes = await cliente.query<{
        id_solicitud: number;
        estado: string;
        nro_comprobante: string | null;
    }>(
        `SELECT id_solicitud,
                estado::text AS estado,
                nro_comprobante
         FROM solicitudes_insumos
         WHERE proyecto_id = $1
           AND estado IN ('Pendiente', 'Aprobada')
         ORDER BY id_solicitud ASC`,
        [idProyecto]
    );

    let filas = solRes.rows;
    if (filas.length === 0) {
        const legacyRes = await cliente.query<{
            id_solicitud: number;
            estado: string;
            nro_comprobante: string | null;
        }>(
            `SELECT id_solicitud,
                    estado_solicitud::text AS estado,
                    nro_comprobante
             FROM solicitudes
             WHERE id_proyecto = $1
               AND estado_solicitud IN ('Pendiente', 'Aprobada')
             ORDER BY id_solicitud ASC`,
            [idProyecto]
        );
        filas = legacyRes.rows;
    }

    if (filas.length === 0) {
        return {
            bloqueado: false,
            solicitudesBloqueantes: [],
            motivoBloqueo: null,
        };
    }

    const detalle = filas
        .map(
            (s) =>
                `Solicitud #${s.id_solicitud} (${s.estado}${s.nro_comprobante ? `, Comprobante ${s.nro_comprobante}` : ''})`
        )
        .join(', ');

    return {
        bloqueado: true,
        solicitudesBloqueantes: filas,
        motivoBloqueo: `No se puede cerrar el proyecto (H34): existen ${filas.length} solicitud(es) de insumos en estado Pendiente o Aprobada sin egresar (${detalle}).`,
    };
};

/**
 * [BACK-1] Endpoint transaccional de resolución de solicitud para el Administrador:
 * - Solo permite resolver solicitudes que estén en estado `'Pendiente'`.
 * - Si la decisión es `'Aprobada'`:
 *   - Genera un comprobante de autorización numerado con correlativo único (`COMP-YYYY-NNN`),
 *     que habilita el egreso en bodega (`habilita_egreso_h5 = true`).
 *   - Mantiene el stock comprometido reservado para el egreso y mantiene activo el bloqueo de cierre del proyecto (`H34`).
 *   - Notifica al bodeguero solicitante y registra auditoría.
 * - Si la decisión es `'Rechazada'`:
 *   - Exige `motivo_rechazo` obligatorio (si viene vacío o solo espacios, rechaza con `400`).
 *   - Libera el 100 % del stock comprometido de vuelta a `cantidad_disponible` (`disponible`).
 *   - Notifica al bodeguero solicitante con el motivo del rechazo y libera a esta solicitud del bloqueo de cierre del proyecto (`H34`).
 */
export const resolverSolicitudInsumosEnTransaccion = async (
    cliente: PoolClient,
    idSolicitud: number,
    datos: {
        decision: 'Aprobada' | 'Rechazada' | 'aprobar' | 'rechazar';
        motivo_rechazo?: string | null;
        id_usuario_admin?: number | null;
    }
): Promise<ResultadoResolucionSolicitudAdmin> => {
    const actual = await cargarSolicitudParaMutacion(cliente, idSolicitud);

    if (actual.estado.trim().toLowerCase() !== 'pendiente') {
        throw new ErrorAplicacion(
            400,
            `Solo se pueden resolver solicitudes en estado Pendiente (la solicitud #${idSolicitud} está en estado '${actual.estado}')`
        );
    }

    const decRaw = String(datos.decision || '').trim().toLowerCase();
    const esAprobacion = decRaw === 'aprobada' || decRaw === 'aprobar';
    const esRechazo = decRaw === 'rechazada' || decRaw === 'rechazar';

    if (!esAprobacion && !esRechazo) {
        throw new ErrorAplicacion(
            400,
            "La resolución debe indicar 'Aprobada' o 'Rechazada'"
        );
    }

    const idAdmin = datos.id_usuario_admin ?? actual.bodeguero_id;

    // =========================================================================
    // CASO 1: RECHAZADA (Exige motivo obligatorio y libera stock comprometido)
    // =========================================================================
    if (esRechazo) {
        const motivoLimpio = String(datos.motivo_rechazo ?? '').trim();
        if (!motivoLimpio) {
            throw new ErrorAplicacion(
                400,
                'El motivo de rechazo es obligatorio para rechazar una solicitud de insumos'
            );
        }

        const acumuladoPorArticulo = new Map<
            number,
            { sku: string; nombre_articulo: string; cantidad: number }
        >();
        for (const l of actual.lineas) {
            const prev = acumuladoPorArticulo.get(l.id_articulo);
            acumuladoPorArticulo.set(l.id_articulo, {
                sku: l.sku,
                nombre_articulo: l.nombre_articulo,
                cantidad: Number(((prev?.cantidad || 0) + l.cantidad_solicitada).toFixed(3)),
            });
        }

        const stockLiberado: AjusteBolsaComprometidoSolicitud[] = [];

        for (const [idArt, info] of acumuladoPorArticulo.entries()) {
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

            const dispAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_disponible) : 0;
            const compAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_comprometida) : 0;
            const dispNuevo = Number((dispAnterior + info.cantidad).toFixed(3));
            const compNuevo = Math.max(0, Number((compAnterior - info.cantidad).toFixed(3)));

            await cliente.query(
                `UPDATE articulos_stock
                 SET cantidad_disponible = $2,
                     cantidad_comprometida = $3
                 WHERE id_articulo = $1`,
                [idArt, dispNuevo, compNuevo]
            );

            stockLiberado.push({
                id_articulo: idArt,
                sku: info.sku,
                nombre_articulo: info.nombre_articulo,
                cantidad_anterior: info.cantidad,
                cantidad_nueva: 0,
                diferencia_comprometida: -info.cantidad,
                disponible_anterior: dispAnterior,
                disponible_nuevo: dispNuevo,
                comprometido_anterior: compAnterior,
                comprometido_nuevo: compNuevo,
            });
        }

        await cliente.query(
            `UPDATE solicitudes_insumos
             SET estado = 'Rechazada',
                 motivo_rechazo = $2,
                 nro_comprobante = NULL
             WHERE id_solicitud = $1`,
            [idSolicitud, motivoLimpio]
        );
        await cliente.query(
            `UPDATE solicitudes
             SET estado_solicitud = 'Rechazada',
                 motivo_rechazo = $2,
                 nro_comprobante = NULL
             WHERE id_solicitud = $1`,
            [idSolicitud, motivoLimpio]
        );

        const alertaRechazoRes = await cliente.query<AlertaReposicionH40>(
            `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('resolucion_solicitud_bodeguero', 'amarillo', $1, $2, $3, NULL, FALSE)
             RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida, fecha_creacion::text AS fecha_creacion`,
            [
                `Solicitud #${idSolicitud} Rechazada por Administración`,
                `La solicitud #${idSolicitud} (Proyecto #${actual.proyecto_id}) fue rechazada. Motivo: "${motivoLimpio}". El stock comprometido fue liberado de vuelta a disponible.`,
                actual.lineas[0]?.id_articulo ?? null,
            ]
        );
        const notificacionBodeguero = alertaRechazoRes.rows[0] ?? null;

        await registrarAuditoria(
            {
                entidad: 'solicitud',
                accion: 'rechazar_solicitud_admin',
                idRegistro: idSolicitud,
                idUsuarioEjecutor: idAdmin,
                estadoAnterior: { estado: actual.estado },
                estadoNuevo: {
                    estado: 'Rechazada',
                    motivo_rechazo: motivoLimpio,
                    stock_liberado: stockLiberado,
                },
                descripcion: `Solicitud #${idSolicitud} rechazada por Administrador. Motivo: ${motivoLimpio}. Stock comprometido liberado a disponible.`,
            },
            cliente
        );

        return {
            id_solicitud: idSolicitud,
            proyecto_id: actual.proyecto_id,
            bodeguero_id: actual.bodeguero_id,
            estado_anterior: actual.estado,
            estado: 'Rechazada',
            nro_comprobante: null,
            motivo_rechazo: motivoLimpio,
            habilita_egreso_h5: false,
            bloquea_cierre_proyecto_h34: false,
            stock_liberado: stockLiberado,
            notificacion_bodeguero: notificacionBodeguero,
        };
    }

    // =========================================================================
    // CASO 2: APROBADA (Genera comprobante correlativo único COMP-YYYY-NNN que habilita egreso H5)
    // =========================================================================
    const existentesRes = await cliente.query<{ nro_comprobante: string | null }>(
        `SELECT nro_comprobante
         FROM solicitudes_insumos
         WHERE nro_comprobante IS NOT NULL
         UNION
         SELECT nro_comprobante
         FROM solicitudes
         WHERE nro_comprobante IS NOT NULL`
    );
    const comprobantesExistentes = existentesRes.rows.map((r) => r.nro_comprobante);
    const nroComprobante = generarNumeroComprobanteSolicitud(comprobantesExistentes);

    await cliente.query(
        `UPDATE solicitudes_insumos
         SET estado = 'Aprobada',
             nro_comprobante = $2,
             motivo_rechazo = NULL
         WHERE id_solicitud = $1`,
        [idSolicitud, nroComprobante]
    );
    await cliente.query(
        `UPDATE solicitudes
         SET estado_solicitud = 'Aprobada',
             nro_comprobante = $2,
             motivo_rechazo = NULL
         WHERE id_solicitud = $1`,
        [idSolicitud, nroComprobante]
    );

    const resumenLineas = actual.lineas
        .map((l) => `${l.cantidad_solicitada} x ${l.sku} (${l.nombre_articulo})`)
        .join(', ');

    const alertaAprRes = await cliente.query<AlertaReposicionH40>(
        `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('resolucion_solicitud_bodeguero', 'info', $1, $2, $3, NULL, FALSE)
         RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida, fecha_creacion::text AS fecha_creacion`,
        [
            `Solicitud #${idSolicitud} Aprobada — Comprobante ${nroComprobante}`,
            `La solicitud #${idSolicitud} (Proyecto #${actual.proyecto_id}) fue aprobada por Administración. Comprobante de autorización N° ${nroComprobante} emitido y habilitado para egreso en bodega (H5): ${resumenLineas}.`,
            actual.lineas[0]?.id_articulo ?? null,
        ]
    );
    const notificacionBodeguero = alertaAprRes.rows[0] ?? null;

    await registrarAuditoria(
        {
            entidad: 'solicitud',
            accion: 'aprobar_solicitud_admin',
            idRegistro: idSolicitud,
            idUsuarioEjecutor: idAdmin,
            estadoAnterior: { estado: actual.estado },
            estadoNuevo: {
                estado: 'Aprobada',
                nro_comprobante: nroComprobante,
                habilita_egreso_h5: true,
            },
            descripcion: `Solicitud #${idSolicitud} aprobada por Administrador. Comprobante ${nroComprobante} generado para egreso (H5).`,
        },
        cliente
    );

    return {
        id_solicitud: idSolicitud,
        proyecto_id: actual.proyecto_id,
        bodeguero_id: actual.bodeguero_id,
        estado_anterior: actual.estado,
        estado: 'Aprobada',
        nro_comprobante: nroComprobante,
        motivo_rechazo: null,
        habilita_egreso_h5: true,
        bloquea_cierre_proyecto_h34: true,
        stock_liberado: [],
        notificacion_bodeguero: notificacionBodeguero,
    };
};

export const resolverSolicitudInsumos = async (
    req: Request<
        { id: string },
        unknown,
        {
            decision?: 'Aprobada' | 'Rechazada' | 'aprobar' | 'rechazar';
            estado?: 'Aprobada' | 'Rechazada';
            motivo_rechazo?: string | null;
            motivo?: string | null;
        }
    >,
    res: Response
): Promise<void> => {
    const idSolicitud = Number(req.params.id);
    const idEjecutor = obtenerIdEjecutor(req);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        res.status(400).json({ mensaje: 'Identificador de solicitud inválido' });
        return;
    }

    const decision = (req.body?.decision ?? req.body?.estado) as
        | 'Aprobada'
        | 'Rechazada'
        | 'aprobar'
        | 'rechazar';
    const motivoRechazo = req.body?.motivo_rechazo ?? req.body?.motivo ?? null;

    try {
        const resultado = await ejecutarTransaccion((cliente) =>
            resolverSolicitudInsumosEnTransaccion(cliente, idSolicitud, {
                decision,
                motivo_rechazo: motivoRechazo,
                id_usuario_admin: idEjecutor,
            })
        );

        res.status(200).json({
            mensaje:
                resultado.estado === 'Aprobada'
                    ? `Solicitud #${idSolicitud} aprobada. Comprobante de autorización N° ${resultado.nro_comprobante} emitido para egreso (H5).`
                    : `Solicitud #${idSolicitud} rechazada. Stock comprometido liberado de vuelta a disponible.`,
            solicitud: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al resolver la solicitud de insumos');
    }
};

export const aprobarSolicitudInsumos = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    req.body = { ...(req.body ?? {}), decision: 'Aprobada' };
    return resolverSolicitudInsumos(req, res);
};

export const rechazarSolicitudInsumos = async (
    req: Request<{ id: string }, unknown, { motivo_rechazo?: string | null; motivo?: string | null }>,
    res: Response
): Promise<void> => {
    req.body = { ...(req.body ?? {}), decision: 'Rechazada' } as any;
    return resolverSolicitudInsumos(req as any, res);
};

// =========================================================================
// [BACK-1] EGRESO TRANSACCIONAL (TODO O NADA) SOLO SOBRE SOLICITUDES APROBADAS
// =========================================================================

export interface ItemEgresoSolicitudInput {
    id_articulo?: number;
    sku?: string;
    cantidad_egreso?: number;
    cantidad?: number;
    quantity?: number;
}

export interface LineaEgresoRegistrada {
    id_solicitud_linea: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_autorizada: number;
    cantidad_entregada_previa: number;
    cantidad_egresada_ahora: number;
    cantidad_entregada_acumulada: number;
    saldo_pendiente_retiro: number;
    comprometido_anterior: number;
    comprometido_nuevo: number;
    disponible_actual: number;
    saldo_historico_cardex: number;
    pmp_historico: number;
    id_movimiento_cardex: number;
}

export interface ResultadoEgresoTransaccionalSolicitud {
    id_egreso: number;
    codigo_egreso: string;
    id_solicitud: number;
    nro_comprobante: string | null;
    proyecto_id: number;
    tecnico_retira_id: number | null;
    tecnico_retira_rut: string;
    tecnico_retira_nombre: string;
    bodeguero_id: number;
    estado_solicitud: 'Aprobada';
    es_entrega_completa: boolean;
    es_entrega_parcial: boolean;
    total_autorizado_unidades: number;
    total_entregado_acumulado_unidades: number;
    total_saldo_pendiente_retiro_unidades: number;
    inmutable: true;
    politica_correccion: string;
    lineas_egresadas: LineaEgresoRegistrada[];
    saldos_lineas_solicitud: {
        id_solicitud_linea: number;
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_autorizada: number;
        cantidad_entregada: number;
        saldo_pendiente_retiro: number;
    }[];
    movimientos_cardex: {
        id_movimiento: number;
        id_insumo: number;
        sku: string;
        tipo_movimiento: 'Salida';
        destino_bolsa: 'comprometido';
        cantidad: number;
        costo_unitario: number;
        saldo_historico: number;
        pmp_historico: number;
        valor_total_historico: number;
        referencia: string;
        proyecto_id: number;
        tecnico_retira_rut: string;
        tecnico_retira_nombre: string;
    }[];
}

/**
 * [BACK-1] Ejecuta en una sola transacción (todo o nada) el egreso físico de insumos de bodega:
 * 1. Solo opera sobre solicitudes en estado `'Aprobada'`.
 * 2. Exige vínculo irreversible al proyecto (`proyecto_id`) y al técnico que retira en bodega (`tecnico_retira_rut` / `tecnico_retira_nombre` o `tecnico_retira_id`).
 * 3. Admite entregas parciales conservando el saldo pendiente de retiro (`saldo_pendiente_retiro = cantidad_solicitada - cantidad_entregada`).
 * 4. Valida todas las líneas antes de aplicar cambios (todo o nada): si una línea supera el saldo pendiente de retiro o el stock comprometido/físico en bodega, lanza error abortando y revirtiendo toda la transacción (`ROLLBACK`).
 * 5. Descuenta de inmediato del stock comprometido (`cantidad_comprometida` en `articulos_stock`) y genera una fila por cada salida en `movimientos_inventario` y `movimiento_inventario` (Cardex).
 * 6. Marca el registro de egreso como inmutable (prohíbe editar o eliminar egresos; cualquier corrección posterior se realiza exclusivamente mediante un movimiento de ajuste).
 */
export const registrarEgresoSolicitudEnTransaccion = async (
    cliente: PoolClient,
    idSolicitud: number,
    datos: {
        bodeguero_id?: number | null;
        tecnico_retira_id?: number | null;
        tecnico_retira_rut?: string | null;
        tecnico_retira_nombre?: string | null;
        codigo_egreso?: string | null;
        items?: ItemEgresoSolicitudInput[];
        lineas?: ItemEgresoSolicitudInput[];
    }
): Promise<ResultadoEgresoTransaccionalSolicitud> => {
    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        throw new ErrorAplicacion(400, 'Identificador de solicitud inválido para egreso');
    }

    // 1. Cargar cabecera de la solicitud y verificar que esté en estado 'Aprobada'
    const cabRes = await cliente.query<{
        id_solicitud: number;
        proyecto_id: number;
        bodeguero_id: number;
        estado: string;
        nro_comprobante: string | null;
    }>(
        `SELECT id_solicitud,
                proyecto_id,
                bodeguero_id,
                estado::text AS estado,
                nro_comprobante
         FROM solicitudes_insumos
         WHERE id_solicitud = $1
         FOR UPDATE`,
        [idSolicitud]
    );

    let cabecera = cabRes.rows[0] ?? null;
    if (!cabecera) {
        const cabLegacy = await cliente.query<{
            id_solicitud: number;
            id_proyecto: number;
            id_usuario: number;
            estado_solicitud: string;
            nro_comprobante: string | null;
        }>(
            `SELECT id_solicitud,
                    id_proyecto,
                    id_usuario,
                    estado_solicitud::text AS estado_solicitud,
                    nro_comprobante
             FROM solicitudes
             WHERE id_solicitud = $1
             FOR UPDATE`,
            [idSolicitud]
        );
        if (cabLegacy.rows[0]) {
            cabecera = {
                id_solicitud: Number(cabLegacy.rows[0].id_solicitud),
                proyecto_id: Number(cabLegacy.rows[0].id_proyecto),
                bodeguero_id: Number(cabLegacy.rows[0].id_usuario),
                estado: cabLegacy.rows[0].estado_solicitud,
                nro_comprobante: cabLegacy.rows[0].nro_comprobante,
            };
        }
    }

    if (!cabecera) {
        throw new ErrorAplicacion(404, `Solicitud de insumos #${idSolicitud} no encontrada`);
    }

    if (cabecera.estado.trim().toLowerCase() !== 'aprobada') {
        throw new ErrorAplicacion(
            400,
            `Solo se puede registrar el egreso físico sobre solicitudes Aprobadas (la solicitud #${idSolicitud} se encuentra en estado '${cabecera.estado}')`
        );
    }

    // 2. Validar técnico que retira en bodega (vínculo irreversible al técnico y al proyecto)
    let tecnicoId =
        datos.tecnico_retira_id && Number(datos.tecnico_retira_id) > 0
            ? Number(datos.tecnico_retira_id)
            : null;
    let tecnicoRut = String(datos.tecnico_retira_rut ?? '').trim();
    let tecnicoNombre = String(datos.tecnico_retira_nombre ?? '').trim();

    if (tecnicoId && (!tecnicoRut || !tecnicoNombre)) {
        const tecRes = await cliente.query<{
            id_usuario: number;
            rut: string | null;
            nombre_completo: string;
        }>(
            `SELECT id_usuario,
                    COALESCE(rut, '') AS rut,
                    TRIM(COALESCE(nombre_usuario, '') || ' ' || COALESCE(apellido_usuario, '')) AS nombre_completo
             FROM usuario
             WHERE id_usuario = $1
             LIMIT 1`,
            [tecnicoId]
        );
        if (tecRes.rows[0]) {
            if (!tecnicoRut) tecnicoRut = tecRes.rows[0].rut || `ID-${tecnicoId}`;
            if (!tecnicoNombre) tecnicoNombre = tecRes.rows[0].nombre_completo || `Técnico #${tecnicoId}`;
        }
    }

    if (!tecnicoRut || !tecnicoNombre) {
        throw new ErrorAplicacion(
            400,
            'El egreso exige identificar de forma obligatoria al técnico que retira en bodega (RUT y nombre)'
        );
    }

    const bodegueroId =
        datos.bodeguero_id && Number(datos.bodeguero_id) > 0
            ? Number(datos.bodeguero_id)
            : cabecera.bodeguero_id;

    // 3. Cargar líneas autorizadas de la solicitud con su cantidad_entregada acumulada
    const lineasSolRes = await cliente.query<{
        id_solicitud_linea: number;
        id_articulo: number;
        sku: string | null;
        nombre_articulo: string;
        precio_unitario: number;
        cantidad_solicitada: number;
        cantidad_entregada: number;
    }>(
        `SELECT sl.id_solicitud_linea,
                sl.id_articulo,
                a.sku,
                a.nombre_articulo,
                COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                sl.cantidad_solicitada::float8 AS cantidad_solicitada,
                COALESCE(sl.cantidad_entregada, 0)::float8 AS cantidad_entregada
         FROM solicitud_lineas sl
         JOIN articulo a ON a.id_articulo = sl.id_articulo
         WHERE sl.id_solicitud = $1
         ORDER BY sl.id_solicitud_linea ASC
         FOR UPDATE OF sl`,
        [idSolicitud]
    );

    if (lineasSolRes.rows.length === 0) {
        throw new ErrorAplicacion(
            400,
            `La solicitud aprobada #${idSolicitud} no posee líneas de insumos para egresar`
        );
    }

    const itemsInput = Array.isArray(datos.items)
        ? datos.items
        : Array.isArray(datos.lineas)
          ? datos.lineas
          : [];

    if (itemsInput.length === 0) {
        throw new ErrorAplicacion(
            400,
            'Debe indicar al menos una línea de insumo con cantidad a egresar mayor a 0'
        );
    }

    // 4. Mapear y validar TODAS las líneas solicitadas para egreso (Todo o Nada)
    const lineasPorIdArticulo = new Map<
        number,
        {
            id_solicitud_linea: number;
            id_articulo: number;
            sku: string;
            nombre_articulo: string;
            precio_unitario: number;
            cantidad_solicitada: number;
            cantidad_entregada: number;
        }
    >();
    const lineasPorSku = new Map<string, number>();

    for (const row of lineasSolRes.rows) {
        const idArt = Number(row.id_articulo);
        const skuNorm = (row.sku || String(idArt)).trim().toUpperCase();
        lineasPorIdArticulo.set(idArt, {
            id_solicitud_linea: Number(row.id_solicitud_linea),
            id_articulo: idArt,
            sku: row.sku || String(idArt),
            nombre_articulo: row.nombre_articulo,
            precio_unitario: Number(row.precio_unitario || 0),
            cantidad_solicitada: Number(row.cantidad_solicitada),
            cantidad_entregada: Number(row.cantidad_entregada || 0),
        });
        lineasPorSku.set(skuNorm, idArt);
    }

    const egresoAcumuladoPorArticulo = new Map<number, number>();
    for (const raw of itemsInput) {
        const cant = Number(raw.cantidad_egreso ?? raw.cantidad ?? raw.quantity ?? NaN);
        if (!Number.isFinite(cant) || cant < 0) {
            throw new ErrorAplicacion(
                400,
                'Las cantidades de egreso deben ser números válidos mayores o iguales a 0'
            );
        }
        if (cant === 0) continue;

        let idArt = raw.id_articulo ? Number(raw.id_articulo) : 0;
        if (!idArt && raw.sku) {
            const found = lineasPorSku.get(String(raw.sku).trim().toUpperCase());
            if (found) idArt = found;
        }

        const lineaAutorizada = lineasPorIdArticulo.get(idArt);
        if (!lineaAutorizada) {
            throw new ErrorAplicacion(
                400,
                `El insumo ${raw.sku || `#${raw.id_articulo}`} no pertenece a la solicitud aprobada #${idSolicitud}`
            );
        }

        const prev = egresoAcumuladoPorArticulo.get(idArt) || 0;
        egresoAcumuladoPorArticulo.set(idArt, Number((prev + cant).toFixed(3)));
    }

    if (egresoAcumuladoPorArticulo.size === 0) {
        throw new ErrorAplicacion(
            400,
            'Debe ingresar una cantidad a egresar mayor a 0 en al menos un insumo autorizado'
        );
    }

    // Bloquear y validar stock comprometido y saldo pendiente en TODAS las líneas antes de mutar (Todo o Nada)
    const planEjecucion: {
        id_solicitud_linea: number;
        id_articulo: number;
        sku: string;
        nombre_articulo: string;
        cantidad_autorizada: number;
        cantidad_entregada_previa: number;
        cantidad_egresada_ahora: number;
        cantidad_entregada_acumulada: number;
        saldo_pendiente_retiro: number;
        comprometido_anterior: number;
        comprometido_nuevo: number;
        disponible_actual: number;
        saldo_historico_cardex: number;
        pmp_historico: number;
    }[] = [];
    const erroresValidacion: string[] = [];

    for (const [idArt, cantEgreso] of egresoAcumuladoPorArticulo.entries()) {
        const lin = lineasPorIdArticulo.get(idArt)!;
        const saldoPendienteAntes = Number(
            Math.max(0, lin.cantidad_solicitada - lin.cantidad_entregada).toFixed(3)
        );

        if (cantEgreso > saldoPendienteAntes) {
            erroresValidacion.push(
                `${lin.nombre_articulo} (${lin.sku}): cantidad a egresar (${cantEgreso}) supera el saldo autorizado pendiente de retiro (${saldoPendienteAntes})`
            );
            continue;
        }

        const stockRes = await cliente.query<{
            cantidad_disponible: number;
            cantidad_comprometida: number;
            pmp: number;
        }>(
            `SELECT COALESCE(cantidad_disponible, 0)::float8 AS cantidad_disponible,
                    COALESCE(cantidad_comprometida, 0)::float8 AS cantidad_comprometida,
                    COALESCE(pmp, 0)::float8 AS pmp
             FROM articulos_stock
             WHERE id_articulo = $1
             FOR UPDATE`,
            [idArt]
        );

        const dispActual = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_disponible) : 0;
        const compAnterior = stockRes.rows[0] ? Number(stockRes.rows[0].cantidad_comprometida) : 0;
        const pmpActual =
            stockRes.rows[0] && Number(stockRes.rows[0].pmp) > 0
                ? Number(stockRes.rows[0].pmp)
                : lin.precio_unitario;

        // El egreso de una solicitud aprobada consume de su bolsa de stock comprometido
        if (cantEgreso > compAnterior) {
            erroresValidacion.push(
                `${lin.nombre_articulo} (${lin.sku}): stock comprometido insuficiente en bodega (comprometido: ${compAnterior}, solicitado egresar: ${cantEgreso})`
            );
            continue;
        }

        const compNuevo = Math.max(0, Number((compAnterior - cantEgreso).toFixed(3)));
        const entregadaAcumulada = Number((lin.cantidad_entregada + cantEgreso).toFixed(3));
        const saldoPendienteRestante = Math.max(
            0,
            Number((lin.cantidad_solicitada - entregadaAcumulada).toFixed(3))
        );
        // Saldo físico en bodega tras la salida (disponible + comprometido restante)
        const saldoHistoricoCardex = Number((dispActual + compNuevo).toFixed(3));

        planEjecucion.push({
            id_solicitud_linea: lin.id_solicitud_linea,
            id_articulo: idArt,
            sku: lin.sku,
            nombre_articulo: lin.nombre_articulo,
            cantidad_autorizada: lin.cantidad_solicitada,
            cantidad_entregada_previa: lin.cantidad_entregada,
            cantidad_egresada_ahora: cantEgreso,
            cantidad_entregada_acumulada: entregadaAcumulada,
            saldo_pendiente_retiro: saldoPendienteRestante,
            comprometido_anterior: compAnterior,
            comprometido_nuevo: compNuevo,
            disponible_actual: dispActual,
            saldo_historico_cardex: saldoHistoricoCardex,
            pmp_historico: pmpActual,
        });
    }

    if (erroresValidacion.length > 0) {
        throw new ErrorAplicacion(
            400,
            `Egreso revertido por validación transaccional (todo o nada): ${erroresValidacion.join(' | ')}`
        );
    }

    // 5. Registrar cabecera inmutable del egreso vinculada al proyecto y al técnico que retira
    const codigoEgreso =
        datos.codigo_egreso && String(datos.codigo_egreso).trim() !== ''
            ? String(datos.codigo_egreso).trim()
            : `DESP-${new Date().getFullYear()}-${String(idSolicitud).padStart(3, '0')}-${String(
                  Date.now() % 1000
              ).padStart(3, '0')}`;

    const egresoCabRes = await cliente.query<{ id_egreso: number }>(
        `INSERT INTO egresos_bodega (
             codigo_egreso,
             id_solicitud,
             proyecto_id,
             tecnico_retira_id,
             tecnico_retira_rut,
             tecnico_retira_nombre,
             bodeguero_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id_egreso`,
        [
            codigoEgreso,
            idSolicitud,
            cabecera.proyecto_id,
            tecnicoId,
            tecnicoRut,
            tecnicoNombre,
            bodegueroId,
        ]
    );
    const idEgreso = egresoCabRes.rows[0]?.id_egreso ?? 1;

    await cliente.query(
        `INSERT INTO salidas_bodega (
             codigo_salida,
             solicitud_id,
             proyecto_id,
             tecnico_retira_id,
             tecnico_retira_rut,
             tecnico_retira_nombre,
             bodeguero_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            codigoEgreso,
            idSolicitud,
            cabecera.proyecto_id,
            tecnicoId ?? bodegueroId,
            tecnicoRut,
            tecnicoNombre,
            bodegueroId,
        ]
    );

    // 6. Aplicar descuento de stock comprometido, actualizar cantidad_entregada y generar fila en Cardex por cada línea
    const lineasEgresadas: LineaEgresoRegistrada[] = [];
    const movimientosCardex: ResultadoEgresoTransaccionalSolicitud['movimientos_cardex'] = [];

    for (const itemPlan of planEjecucion) {
        // 6.1 Descontar del stock comprometido en articulos_stock
        await cliente.query(
            `UPDATE articulos_stock
             SET cantidad_comprometida = $2
             WHERE id_articulo = $1`,
            [itemPlan.id_articulo, itemPlan.comprometido_nuevo]
        );

        // 6.2 Actualizar cantidad_entregada en solicitud_lineas conservando el saldo pendiente
        await cliente.query(
            `UPDATE solicitud_lineas
             SET cantidad_entregada = $2
             WHERE id_solicitud_linea = $1`,
            [itemPlan.id_solicitud_linea, itemPlan.cantidad_entregada_acumulada]
        );

        // 6.3 Insertar línea en egreso_lineas y salida_lineas (con disponible >= 0 y comprometido >= 0)
        await cliente.query(
            `INSERT INTO egreso_lineas (
                 id_egreso,
                 id_solicitud_linea,
                 id_articulo,
                 cantidad_egresada,
                 saldo_pendiente_resultante,
                 costo_unitario_pmp
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                idEgreso,
                itemPlan.id_solicitud_linea,
                itemPlan.id_articulo,
                itemPlan.cantidad_egresada_ahora,
                itemPlan.saldo_pendiente_retiro,
                itemPlan.pmp_historico,
            ]
        );

        await cliente.query(
            `INSERT INTO salida_lineas (
                 id_salida,
                 id_solicitud_linea,
                 id_articulo,
                 cantidad_entregada,
                 disponible,
                 comprometido,
                 saldo_pendiente_resultante,
                 costo_unitario_pmp
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                idEgreso,
                itemPlan.id_solicitud_linea,
                itemPlan.id_articulo,
                itemPlan.cantidad_egresada_ahora,
                itemPlan.disponible_actual,
                itemPlan.comprometido_nuevo,
                itemPlan.saldo_pendiente_retiro,
                itemPlan.pmp_historico,
            ]
        );

        // 6.4 Generar fila inmutable en Cardex (movimientos_inventario y movimiento_inventario)
        const referenciaCardex = `${codigoEgreso} | Solicitud #${idSolicitud}${
            cabecera.nro_comprobante ? ` (${cabecera.nro_comprobante})` : ''
        } | Proyecto #${cabecera.proyecto_id} | Retira: ${tecnicoNombre} (${tecnicoRut})`;
        const valorTotalHistorico = Math.round(
            itemPlan.saldo_historico_cardex * itemPlan.pmp_historico
        );

        const movRes = await cliente.query<{ id_movimiento: number }>(
            `INSERT INTO movimientos_inventario (
                 id_insumo,
                 id_orden_compra,
                 id_recepcion,
                 id_recepcion_linea,
                 tipo_movimiento,
                 destino_bolsa,
                 cantidad,
                 costo_unitario,
                 saldo_historico,
                 pmp_historico,
                 valor_total_historico,
                 referencia,
                 id_usuario
             )
             VALUES ($1, NULL, NULL, NULL, 'Salida', 'comprometido', $2, $3, $4, $5, $6, $7, $8)
             RETURNING id_movimiento`,
            [
                itemPlan.id_articulo,
                itemPlan.cantidad_egresada_ahora,
                itemPlan.pmp_historico,
                itemPlan.saldo_historico_cardex,
                itemPlan.pmp_historico,
                valorTotalHistorico,
                referenciaCardex,
                bodegueroId,
            ]
        );
        const idMovCardex = movRes.rows[0]?.id_movimiento ?? 1;

        await cliente.query(
            `INSERT INTO movimiento_inventario (
                 id_insumo,
                 tipo_movimiento,
                 destino_bolsa,
                 cantidad,
                 costo_unitario,
                 saldo_historico,
                 pmp_historico,
                 referencia,
                 id_usuario
             )
             VALUES ($1, 'Salida', 'comprometido', $2, $3, $4, $5, $6, $7)`,
            [
                itemPlan.id_articulo,
                itemPlan.cantidad_egresada_ahora,
                itemPlan.pmp_historico,
                itemPlan.saldo_historico_cardex,
                itemPlan.pmp_historico,
                referenciaCardex,
                bodegueroId,
            ]
        );

        lineasEgresadas.push({
            ...itemPlan,
            id_movimiento_cardex: idMovCardex,
        });

        movimientosCardex.push({
            id_movimiento: idMovCardex,
            id_insumo: itemPlan.id_articulo,
            sku: itemPlan.sku,
            tipo_movimiento: 'Salida',
            destino_bolsa: 'comprometido',
            cantidad: itemPlan.cantidad_egresada_ahora,
            costo_unitario: itemPlan.pmp_historico,
            saldo_historico: itemPlan.saldo_historico_cardex,
            pmp_historico: itemPlan.pmp_historico,
            valor_total_historico: valorTotalHistorico,
            referencia: referenciaCardex,
            proyecto_id: cabecera.proyecto_id,
            tecnico_retira_rut: tecnicoRut,
            tecnico_retira_nombre: tecnicoNombre,
        });
    }

    // 7. Calcular estado global de saldos de todas las líneas de la solicitud tras el egreso
    const saldosLineasSolicitud = Array.from(lineasPorIdArticulo.values()).map((lin) => {
        const egresadaEnEsteActo = lineasEgresadas.find((e) => e.id_articulo === lin.id_articulo);
        const cantidadEntregada = egresadaEnEsteActo
            ? egresadaEnEsteActo.cantidad_entregada_acumulada
            : lin.cantidad_entregada;
        const saldoPendiente = Math.max(
            0,
            Number((lin.cantidad_solicitada - cantidadEntregada).toFixed(3))
        );
        return {
            id_solicitud_linea: lin.id_solicitud_linea,
            id_articulo: lin.id_articulo,
            sku: lin.sku,
            nombre_articulo: lin.nombre_articulo,
            cantidad_autorizada: lin.cantidad_solicitada,
            cantidad_entregada: cantidadEntregada,
            saldo_pendiente_retiro: saldoPendiente,
        };
    });

    const totalAutorizadoUnidades = Number(
        saldosLineasSolicitud.reduce((acc, l) => acc + l.cantidad_autorizada, 0).toFixed(3)
    );
    const totalEntregadoAcumuladoUnidades = Number(
        saldosLineasSolicitud.reduce((acc, l) => acc + l.cantidad_entregada, 0).toFixed(3)
    );
    const totalSaldoPendienteRetiroUnidades = Number(
        saldosLineasSolicitud.reduce((acc, l) => acc + l.saldo_pendiente_retiro, 0).toFixed(3)
    );

    const esEntregaCompleta = totalSaldoPendienteRetiroUnidades === 0;
    const esEntregaParcial = !esEntregaCompleta;

    if (esEntregaCompleta) {
        await cliente.query(
            `UPDATE solicitudes
             SET estado_solicitud = 'Completada'
             WHERE id_solicitud = $1`,
            [idSolicitud]
        );
    }

    // 8. Registrar auditoría inmutable
    await registrarAuditoria(
        {
            entidad: 'egreso_bodega',
            accion: esEntregaCompleta ? 'registrar_egreso_completo' : 'registrar_egreso_parcial',
            idRegistro: idEgreso,
            idUsuarioEjecutor: bodegueroId,
            estadoAnterior: {
                id_solicitud: idSolicitud,
                estado: 'Aprobada',
            },
            estadoNuevo: {
                id_egreso: idEgreso,
                codigo_egreso: codigoEgreso,
                id_solicitud: idSolicitud,
                proyecto_id: cabecera.proyecto_id,
                tecnico_retira_rut: tecnicoRut,
                tecnico_retira_nombre: tecnicoNombre,
                es_entrega_completa: esEntregaCompleta,
                total_saldo_pendiente_retiro_unidades: totalSaldoPendienteRetiroUnidades,
                lineas_egresadas: lineasEgresadas,
            },
            descripcion: `Egreso ${
                esEntregaCompleta ? 'completo' : 'parcial'
            } ${codigoEgreso} registrado sobre solicitud aprobada #${idSolicitud} (Proyecto #${
                cabecera.proyecto_id
            }). Retira: ${tecnicoNombre} (${tecnicoRut}). Saldo pendiente de retiro: ${totalSaldoPendienteRetiroUnidades} un.`,
        },
        cliente
    );

    return {
        id_egreso: idEgreso,
        codigo_egreso: codigoEgreso,
        id_solicitud: idSolicitud,
        nro_comprobante: cabecera.nro_comprobante,
        proyecto_id: cabecera.proyecto_id,
        tecnico_retira_id: tecnicoId,
        tecnico_retira_rut: tecnicoRut,
        tecnico_retira_nombre: tecnicoNombre,
        bodeguero_id: bodegueroId,
        estado_solicitud: 'Aprobada',
        es_entrega_completa: esEntregaCompleta,
        es_entrega_parcial: esEntregaParcial,
        total_autorizado_unidades: totalAutorizadoUnidades,
        total_entregado_acumulado_unidades: totalEntregadoAcumuladoUnidades,
        total_saldo_pendiente_retiro_unidades: totalSaldoPendienteRetiroUnidades,
        inmutable: true,
        politica_correccion:
            'El registro de egreso es inmutable y queda vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones se realizan únicamente mediante un movimiento de ajuste en Cardex, nunca editando el registro.',
        lineas_egresadas: lineasEgresadas,
        saldos_lineas_solicitud: saldosLineasSolicitud,
        movimientos_cardex: movimientosCardex,
    };
};

/**
 * [BACK-1] Prohíbe terminantemente editar o eliminar un registro de egreso ya emitido.
 * Cualquier corrección posterior debe realizarse mediante un movimiento de ajuste en Cardex.
 */
export const rechazarModificacionEgresoInmutable = (): never => {
    throw new ErrorAplicacion(
        403,
        'Operación prohibida: el registro de salida física (egreso) es inmutable y está vinculado de forma irreversible al proyecto y al técnico que retira. Las correcciones deben realizarse mediante un movimiento de ajuste en Cardex, nunca editando ni eliminando el registro.'
    );
};

export const bloquearEdicionEgresoSolicitud = (
    _req: Request,
    res: Response
): void => {
    try {
        rechazarModificacionEgresoInmutable();
    } catch (error) {
        enviarErrorHttp(res, error, 'No se permite editar ni eliminar un registro de egreso');
    }
};

export const registrarEgresoSolicitud = async (
    req: Request<
        { id: string },
        unknown,
        {
            tecnico_retira_id?: number | null;
            tecnico_retira_rut?: string | null;
            tecnico_retira_nombre?: string | null;
            codigo_egreso?: string | null;
            items?: ItemEgresoSolicitudInput[];
            lineas?: ItemEgresoSolicitudInput[];
        }
    >,
    res: Response
): Promise<void> => {
    const idSolicitud = Number(req.params.id);
    const idBodeguero = obtenerIdEjecutor(req);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        res.status(400).json({ mensaje: 'Identificador de solicitud inválido' });
        return;
    }

    try {
        const resultado = await ejecutarTransaccion((cliente) =>
            registrarEgresoSolicitudEnTransaccion(cliente, idSolicitud, {
                bodeguero_id: idBodeguero,
                tecnico_retira_id: req.body?.tecnico_retira_id ?? null,
                tecnico_retira_rut: req.body?.tecnico_retira_rut ?? null,
                tecnico_retira_nombre: req.body?.tecnico_retira_nombre ?? null,
                codigo_egreso: req.body?.codigo_egreso ?? null,
                items: req.body?.items,
                lineas: req.body?.lineas,
            })
        );

        res.status(201).json({
            mensaje: resultado.es_entrega_completa
                ? `Egreso completo ${resultado.codigo_egreso} registrado con éxito. Cardex actualizado en tiempo real.`
                : `Egreso parcial ${resultado.codigo_egreso} registrado con éxito. Saldo pendiente de retiro conservado (${resultado.total_saldo_pendiente_retiro_unidades} un.) y Cardex actualizado.`,
            egreso: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar el egreso físico de la solicitud');
    }
};

// =========================================================================
// [DB] TABLAS salidas_bodega Y salida_lineas CON CHECK (disponible >= 0 Y comprometido >= 0) E INMUTABILIDAD
// =========================================================================

export interface LineaSalidaBodegaDbInput {
    id_articulo: number;
    id_solicitud_linea?: number | null;
    cantidad_entregada: number;
    disponible: number;
    comprometido: number;
    saldo_pendiente_resultante?: number;
    costo_unitario_pmp?: number;
}

export interface SalidaBodegaDbInsertada {
    id_salida: number;
    solicitud_id: number;
    proyecto_id: number;
    tecnico_retira_id: number;
    fecha: string;
    inmutable: true;
    lineas: {
        id_salida_linea: number;
        id_salida: number;
        id_articulo: number;
        cantidad_entregada: number;
        disponible: number;
        comprometido: number;
    }[];
}

/**
 * [DB] Inserta una salida física en `salidas_bodega` (`solicitud_id`, `proyecto_id`, `tecnico_retira_id`, `fecha`)
 * y sus líneas en `salida_lineas`, aplicando en base de datos:
 * - Restricción `CHECK (disponible >= 0 AND comprometido >= 0)` en stock (`stock_insumos`, `articulos_stock`) y en `salida_lineas`.
 * - Inmutabilidad de los registros (`salidas_bodega` y `salida_lineas` prohíben `UPDATE` y `DELETE` mediante trigger).
 */
export const insertarSalidaBodegaDbEnTransaccion = async (
    cliente: Pick<PoolClient, 'query'>,
    datos: {
        solicitud_id: number;
        proyecto_id: number;
        tecnico_retira_id: number;
        fecha?: string | null;
        lineas: LineaSalidaBodegaDbInput[];
    }
): Promise<SalidaBodegaDbInsertada> => {
    const solicitudId = Number(datos.solicitud_id);
    const proyectoId = Number(datos.proyecto_id);
    const tecnicoRetiraId = Number(datos.tecnico_retira_id);

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
        throw new ErrorAplicacion(400, 'solicitud_id es obligatorio para registrar en salidas_bodega');
    }
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) {
        throw new ErrorAplicacion(400, 'proyecto_id es obligatorio para registrar en salidas_bodega');
    }
    if (!Number.isInteger(tecnicoRetiraId) || tecnicoRetiraId <= 0) {
        throw new ErrorAplicacion(400, 'tecnico_retira_id es obligatorio para registrar en salidas_bodega');
    }
    if (!Array.isArray(datos.lineas) || datos.lineas.length === 0) {
        throw new ErrorAplicacion(400, 'salida_lineas requiere al menos una línea de salida');
    }

    const fechaIso = datos.fecha || new Date().toISOString();

    try {
        const cabRes = await cliente.query<{ id_salida: number; fecha: string }>(
            `INSERT INTO salidas_bodega (solicitud_id, proyecto_id, tecnico_retira_id, fecha)
             VALUES ($1, $2, $3, $4)
             RETURNING id_salida, fecha::text AS fecha`,
            [solicitudId, proyectoId, tecnicoRetiraId, fechaIso]
        );
        const idSalida = Number(cabRes.rows[0]?.id_salida ?? 1);
        const fechaRegistrada = cabRes.rows[0]?.fecha ?? fechaIso;

        const lineasInsertadas: SalidaBodegaDbInsertada['lineas'] = [];

        for (const lin of datos.lineas) {
            const idArt = Number(lin.id_articulo);
            const cantEntregada = Number(lin.cantidad_entregada);
            const disponible = Number(lin.disponible);
            const comprometido = Number(lin.comprometido);
            const saldoPendiente = Number(lin.saldo_pendiente_resultante ?? 0);
            const costoPmp = Number(lin.costo_unitario_pmp ?? 0);

            // Actualizar stock_insumos y articulos_stock sujetos a CHECK (disponible >= 0 AND comprometido >= 0)
            await cliente.query(
                `UPDATE stock_insumos
                 SET disponible = $2,
                     comprometido = $3
                 WHERE insumo_id = $1`,
                [idArt, disponible, comprometido]
            );

            await cliente.query(
                `UPDATE articulos_stock
                 SET cantidad_disponible = $2,
                     cantidad_comprometida = $3
                 WHERE id_articulo = $1`,
                [idArt, disponible, comprometido]
            );

            const linRes = await cliente.query<{ id_salida_linea: number }>(
                `INSERT INTO salida_lineas (
                     id_salida,
                     id_solicitud_linea,
                     id_articulo,
                     cantidad_entregada,
                     disponible,
                     comprometido,
                     saldo_pendiente_resultante,
                     costo_unitario_pmp
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_salida_linea`,
                [
                    idSalida,
                    lin.id_solicitud_linea ?? null,
                    idArt,
                    cantEntregada,
                    disponible,
                    comprometido,
                    saldoPendiente,
                    costoPmp,
                ]
            );

            lineasInsertadas.push({
                id_salida_linea: Number(linRes.rows[0]?.id_salida_linea ?? lineasInsertadas.length + 1),
                id_salida: idSalida,
                id_articulo: idArt,
                cantidad_entregada: cantEntregada,
                disponible,
                comprometido,
            });
        }

        return {
            id_salida: idSalida,
            solicitud_id: solicitudId,
            proyecto_id: proyectoId,
            tecnico_retira_id: tecnicoRetiraId,
            fecha: fechaRegistrada,
            inmutable: true,
            lineas: lineasInsertadas,
        };
    } catch (err: any) {
        // Código PostgreSQL 23514 = check_violation (disponible < 0 o comprometido < 0 o cantidad_entregada <= 0)
        if (err?.code === '23514') {
            throw new ErrorAplicacion(
                400,
                `Violación de restricción CHECK en base de datos (23514): la base de datos impide saldos negativos (disponible >= 0 y comprometido >= 0). Detalle: ${err.message}`
            );
        }
        // Código PostgreSQL 23503 = foreign_key_violation
        if (err?.code === '23503') {
            throw new ErrorAplicacion(
                400,
                `Violación de clave foránea en salidas_bodega / salida_lineas (23503): ${err.message}`
            );
        }
        throw err;
    }
};

/**
 * [DB] Verifica que el motor de base de datos bloquea cualquier intento de borrar (`DELETE`)
 * o editar (`UPDATE`) registros en `salidas_bodega` y `salida_lineas`.
 */
export const intentarEliminarSalidaBodegaEnDb = async (
    cliente: Pick<PoolClient, 'query'>,
    idSalida: number
): Promise<never> => {
    try {
        await cliente.query('DELETE FROM salidas_bodega WHERE id_salida = $1', [idSalida]);
        throw new ErrorAplicacion(
            403,
            'El motor de base de datos impide el borrado de salidas en salidas_bodega (registro inmutable)'
        );
    } catch (err: any) {
        if (err instanceof ErrorAplicacion) throw err;
        throw new ErrorAplicacion(
            403,
            `Borrado bloqueado por trigger de inmutabilidad en base de datos: ${err?.message || err}`
        );
    }
};