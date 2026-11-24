import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';

export const ESTADO_DEVOLUCION_EN_TRANSITO = 'En tránsito';

/** Clave del bloqueo consultivo que serializa las declaraciones de un mismo técnico en un mismo proyecto. */
export const claveBloqueoDevolucion = (idTecnico: number, idProyecto: number): string =>
    `devolucion:${idTecnico}:${idProyecto}`;

export interface ItemDevolucionInput {
    id_articulo?: number;
    sku?: string;
    cantidad_declarada?: number;
    cantidad?: number;
    quantity?: number;
}

export interface LineaDevolucionDeclarada {
    id_devolucion_linea: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_retirada: number;
    cantidad_utilizada: number;
    cantidad_devuelta_previa: number;
    cantidad_maxima_devolvible: number;
    cantidad_declarada: number;
}

export interface AlertaDevolucionBodeguero {
    id_alerta: number;
    tipo: string;
    severidad: string;
    titulo: string;
    descripcion: string;
    id_articulo: number | null;
    leida: boolean;
    fecha_creacion: string;
}

export interface DevolucionDeclarada {
    id_devolucion: number;
    codigo_devolucion: string;
    proyecto_id: number;
    tecnico_id: number;
    tecnico_rut: string;
    tecnico_nombre: string;
    estado: typeof ESTADO_DEVOLUCION_EN_TRANSITO;
    fecha_declaracion: string;
    lineas: LineaDevolucionDeclarada[];
    alerta_bodeguero: AlertaDevolucionBodeguero | null;
}

const redondear = (valor: number): number => Number(valor.toFixed(3));

/**
 * [BACK-2] Declara una devolución de sobrante de obra dentro de una transacción atómica.
 *
 * Regla de negocio: por cada insumo,
 *   máximo devolvible = retirado − utilizado − ya declarado en devoluciones vigentes
 * donde:
 *   - retirado   = suma de egresos de bodega del técnico para ese proyecto e insumo;
 *   - utilizado  = suma de usos en terreno registrados para ese técnico, proyecto e insumo;
 *   - ya declarado = devoluciones del mismo técnico/proyecto/insumo que siguen en tránsito o recibidas.
 * Se descuentan las devoluciones previas para impedir que dos declaraciones sucesivas devuelvan
 * juntas más de lo que el técnico tiene en su poder.
 *
 * Si alguna línea supera el máximo, se rechaza TODA la devolución (400) sin crear registros ni alertas.
 * Si todo cumple, la devolución queda en estado 'En tránsito', se genera una alerta para el Bodeguero
 * y se registra auditoría inmutable.
 */
export const declararDevolucionEnTransaccion = async (
    cliente: PoolClient,
    idTecnico: number,
    datos: {
        id_proyecto?: number;
        proyecto_id?: number;
        items?: ItemDevolucionInput[];
        lineas?: ItemDevolucionInput[];
    }
): Promise<DevolucionDeclarada> => {
    const idProyecto = Number(datos.id_proyecto ?? datos.proyecto_id ?? 0);
    if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
        throw new ErrorAplicacion(400, 'El proyecto es obligatorio para declarar una devolución');
    }

    const itemsRaw = Array.isArray(datos.items)
        ? datos.items
        : Array.isArray(datos.lineas)
          ? datos.lineas
          : [];
    if (itemsRaw.length === 0) {
        throw new ErrorAplicacion(400, 'Debe incluir al menos un insumo con cantidad a devolver');
    }

    // 1. Técnico que declara (siempre el del token, nunca uno indicado en el cuerpo)
    const tecRes = await cliente.query<{ id_usuario: number; rut: string; nombre_completo: string }>(
        `SELECT id_usuario,
                COALESCE(rut, '') AS rut,
                TRIM(COALESCE(nombre_usuario, '') || ' ' || COALESCE(apellido_usuario, '')) AS nombre_completo
         FROM usuario
         WHERE id_usuario = $1 AND activo = TRUE
         LIMIT 1`,
        [idTecnico]
    );
    if (tecRes.rows.length === 0) {
        throw new ErrorAplicacion(404, 'El técnico que declara la devolución no existe o está inactivo');
    }
    const tecnico = tecRes.rows[0];

    // 2. Proyecto
    const proyRes = await cliente.query<{ id_proyecto: number; nombre_proyecto: string }>(
        'SELECT id_proyecto, nombre_proyecto FROM proyecto WHERE id_proyecto = $1 LIMIT 1',
        [idProyecto]
    );
    if (proyRes.rows.length === 0) {
        throw new ErrorAplicacion(404, 'El proyecto indicado no existe');
    }
    const proyecto = proyRes.rows[0];

    // 3. Resolver insumos y acumular la cantidad declarada por artículo
    const declaradoPorArticulo = new Map<
        number,
        { sku: string; nombre_articulo: string; cantidad: number }
    >();

    for (const raw of itemsRaw) {
        const cant = Number(raw.cantidad_declarada ?? raw.cantidad ?? raw.quantity ?? NaN);
        if (!Number.isFinite(cant) || cant <= 0) {
            throw new ErrorAplicacion(400, 'Todas las cantidades a devolver deben ser números mayores a 0');
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
        const previo = declaradoPorArticulo.get(idArt);
        declaradoPorArticulo.set(idArt, {
            sku: art.sku || String(idArt),
            nombre_articulo: art.nombre_articulo,
            cantidad: redondear((previo?.cantidad ?? 0) + redondear(cant)),
        });
    }

    // 4. Serializar las declaraciones del mismo técnico y proyecto.
    //    Sin este bloqueo, dos solicitudes simultáneas podrían leer el mismo sobrante y ambas aprobarse.
    //    El bloqueo se libera solo al terminar la transacción.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
        claveBloqueoDevolucion(idTecnico, idProyecto),
    ]);

    // 5. Calcular el máximo devolvible por artículo y validar todas las líneas antes de escribir
    const snapshotPorArticulo = new Map<
        number,
        {
            cantidad_retirada: number;
            cantidad_utilizada: number;
            cantidad_devuelta_previa: number;
            cantidad_maxima_devolvible: number;
        }
    >();
    const erroresSobrante: string[] = [];

    for (const [idArt, info] of declaradoPorArticulo.entries()) {
        const retiradoRes = await cliente.query<{ total: number }>(
            `SELECT COALESCE(SUM(el.cantidad_egresada), 0)::float8 AS total
             FROM egreso_lineas el
             JOIN egresos_bodega e ON e.id_egreso = el.id_egreso
             WHERE e.proyecto_id = $1
               AND el.id_articulo = $2
               AND (e.tecnico_retira_id = $3 OR ($4 <> '' AND e.tecnico_retira_rut = $4))`,
            [idProyecto, idArt, idTecnico, tecnico.rut]
        );

        const usadoRes = await cliente.query<{ total: number }>(
            `SELECT COALESCE(SUM(cantidad_utilizada), 0)::float8 AS total
             FROM uso_insumos_proyecto
             WHERE proyecto_id = $1 AND tecnico_id = $2 AND id_articulo = $3`,
            [idProyecto, idTecnico, idArt]
        );

        const previaRes = await cliente.query<{ total: number }>(
            `SELECT COALESCE(SUM(dl.cantidad_declarada), 0)::float8 AS total
             FROM devolucion_lineas dl
             JOIN devoluciones_tecnico d ON d.id_devolucion = dl.id_devolucion
             WHERE d.proyecto_id = $1
               AND d.tecnico_id = $2
               AND dl.id_articulo = $3
               AND d.estado IN ('En tránsito', 'Recibida')`,
            [idProyecto, idTecnico, idArt]
        );

        const retirada = redondear(Number(retiradoRes.rows[0]?.total ?? 0));
        const utilizada = redondear(Number(usadoRes.rows[0]?.total ?? 0));
        const previa = redondear(Number(previaRes.rows[0]?.total ?? 0));
        const maximo = redondear(Math.max(0, retirada - utilizada - previa));

        snapshotPorArticulo.set(idArt, {
            cantidad_retirada: retirada,
            cantidad_utilizada: utilizada,
            cantidad_devuelta_previa: previa,
            cantidad_maxima_devolvible: maximo,
        });

        if (info.cantidad > maximo) {
            erroresSobrante.push(
                `${info.nombre_articulo} (${info.sku}): se intentó devolver ${info.cantidad}, máximo devolvible ${maximo} (retirado ${retirada} − usado ${utilizada} − ya declarado ${previa})`
            );
        }
    }

    if (erroresSobrante.length > 0) {
        throw new ErrorAplicacion(
            400,
            `No se puede declarar la devolución: supera el sobrante real del técnico. ${erroresSobrante.join(' | ')}`
        );
    }

    // 6. Cabecera de la devolución en estado 'En tránsito'
    const cabRes = await cliente.query<{ id_devolucion: number; fecha_declaracion: string }>(
        `INSERT INTO devoluciones_tecnico (proyecto_id, tecnico_id, tecnico_rut, tecnico_nombre, estado, id_usuario_declara)
         VALUES ($1, $2, $3, $4, $5, $2)
         RETURNING id_devolucion, fecha_declaracion::text AS fecha_declaracion`,
        [idProyecto, idTecnico, tecnico.rut, tecnico.nombre_completo, ESTADO_DEVOLUCION_EN_TRANSITO]
    );
    const idDevolucion = Number(cabRes.rows[0].id_devolucion);
    const fechaDeclaracion = cabRes.rows[0].fecha_declaracion;
    const codigoDevolucion = `DEV-${new Date().getFullYear()}-${String(idDevolucion).padStart(5, '0')}`;

    await cliente.query(
        'UPDATE devoluciones_tecnico SET codigo_devolucion = $2 WHERE id_devolucion = $1',
        [idDevolucion, codigoDevolucion]
    );

    // 7. Líneas con la foto de retirado / utilizado / declarado
    const lineasDeclaradas: LineaDevolucionDeclarada[] = [];
    for (const [idArt, info] of declaradoPorArticulo.entries()) {
        const snap = snapshotPorArticulo.get(idArt)!;
        const linRes = await cliente.query<{ id_devolucion_linea: number }>(
            `INSERT INTO devolucion_lineas (id_devolucion, id_articulo, cantidad_retirada, cantidad_utilizada, cantidad_declarada)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id_devolucion_linea`,
            [idDevolucion, idArt, snap.cantidad_retirada, snap.cantidad_utilizada, info.cantidad]
        );
        lineasDeclaradas.push({
            id_devolucion_linea: Number(linRes.rows[0].id_devolucion_linea),
            id_articulo: idArt,
            sku: info.sku,
            nombre_articulo: info.nombre_articulo,
            cantidad_retirada: snap.cantidad_retirada,
            cantidad_utilizada: snap.cantidad_utilizada,
            cantidad_devuelta_previa: snap.cantidad_devuelta_previa,
            cantidad_maxima_devolvible: snap.cantidad_maxima_devolvible,
            cantidad_declarada: info.cantidad,
        });
    }

    // 8. Alerta para el Bodeguero (la alerta del sistema es global, igual que en las solicitudes)
    const resumenLineas = lineasDeclaradas
        .map((l) => `${l.cantidad_declarada} x ${l.sku} (${l.nombre_articulo})`)
        .join(', ');
    const alertaRes = await cliente.query<AlertaDevolucionBodeguero>(
        `INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('devolucion_en_transito', 'amarillo', $1, $2, $3, NULL, FALSE)
         RETURNING id_alerta, tipo, severidad, titulo, descripcion, id_articulo, leida, fecha_creacion::text AS fecha_creacion`,
        [
            `Devolución ${codigoDevolucion} en tránsito hacia Bodega`.slice(0, 200),
            `${tecnico.nombre_completo} declaró devolver sobrante del proyecto \"${proyecto.nombre_proyecto}\": ${resumenLineas}. Pendiente de confirmación física en bodega.`.slice(0, 500),
            lineasDeclaradas[0]?.id_articulo ?? null,
        ]
    );
    const alertaBodeguero = alertaRes.rows[0] ?? null;

    // 9. Auditoría inmutable dentro de la misma transacción
    await registrarAuditoria(
        {
            entidad: 'devolucion',
            accion: 'declarar_devolucion',
            idRegistro: idDevolucion,
            idUsuarioEjecutor: idTecnico,
            estadoAnterior: null,
            estadoNuevo: {
                id_devolucion: idDevolucion,
                codigo_devolucion: codigoDevolucion,
                proyecto_id: idProyecto,
                estado: ESTADO_DEVOLUCION_EN_TRANSITO,
                lineas: lineasDeclaradas,
            },
            descripcion: `Devolución ${codigoDevolucion} declarada en estado En tránsito por ${tecnico.nombre_completo} para proyecto #${idProyecto}. Bodeguero alertado.`,
        },
        cliente
    );

    return {
        id_devolucion: idDevolucion,
        codigo_devolucion: codigoDevolucion,
        proyecto_id: idProyecto,
        tecnico_id: idTecnico,
        tecnico_rut: tecnico.rut,
        tecnico_nombre: tecnico.nombre_completo,
        estado: ESTADO_DEVOLUCION_EN_TRANSITO,
        fecha_declaracion: fechaDeclaracion,
        lineas: lineasDeclaradas,
        alerta_bodeguero: alertaBodeguero,
    };
};

export const declararDevolucion = async (
    req: Request<
        Record<string, string>,
        unknown,
        {
            id_proyecto?: number;
            proyecto_id?: number;
            items?: ItemDevolucionInput[];
            lineas?: ItemDevolucionInput[];
        }
    >,
    res: Response
): Promise<void> => {
    const idEjecutor = obtenerIdEjecutor(req);
    if (!idEjecutor) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión' });
        return;
    }

    try {
        const devolucion = await ejecutarTransaccion((cliente) =>
            declararDevolucionEnTransaccion(cliente, idEjecutor, req.body ?? {})
        );

        res.status(201).json({
            mensaje: `Devolución ${devolucion.codigo_devolucion} declarada en estado En tránsito. Bodega fue alertada para confirmar la recepción física.`,
            devolucion,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al declarar la devolución de sobrante');
    }
};
