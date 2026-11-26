import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import {
    ESTADO_DEVOLUCION_EN_TRANSITO,
    ESTADO_DEVOLUCION_RECIBIDA,
    LineaDevolucionDb,
    calcularMontoAjusteCosto,
    construirAlertaDiferenciaDevolucion,
    planificarConfirmacionRecepcion,
} from '../services/devolucionBodegaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';

export { ESTADO_DEVOLUCION_EN_TRANSITO };

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
    const tecRes = await cliente.query<{
        id_usuario: number;
        rut: string;
        nombre_completo?: string;
        nombre?: string;
        apellido?: string | null;
    }>(
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
    const filaTec = tecRes.rows[0];
    const tecnico = {
        id_usuario: filaTec.id_usuario,
        rut: filaTec.rut ?? '',
        nombre_completo:
            filaTec.nombre_completo ||
            [filaTec.nombre, filaTec.apellido].filter(Boolean).join(' ').trim() ||
            'Técnico',
    };

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
    const acumuladoPorArticulo = new Map<
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
            activo?: boolean;
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
        if (art.activo === false) {
            throw new ErrorAplicacion(
                400,
                `El insumo "${art.nombre_articulo}" (${art.sku || art.id_articulo}) se encuentra inactivo`
            );
        }

        idArt = Number(art.id_articulo);
        const previo = acumuladoPorArticulo.get(idArt);
        acumuladoPorArticulo.set(idArt, {
            sku: art.sku || String(idArt),
            nombre_articulo: art.nombre_articulo,
            cantidad: redondear((previo?.cantidad ?? 0) + redondear(cant)),
        });
    }

    // 4. Serializar las declaraciones del mismo técnico y proyecto.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
        claveBloqueoDevolucion(idTecnico, idProyecto),
    ]);

    // 5. Calcular el máximo devolvible por artículo y validar todas las líneas antes de escribir
    const snapshotsPorArticulo = new Map<
        number,
        {
            cantidad_retirada: number;
            cantidad_utilizada: number;
            cantidad_devuelta_previa: number;
            cantidad_maxima_devolvible: number;
        }
    >();
    const erroresSobrante: string[] = [];

    for (const [idArt, info] of acumuladoPorArticulo.entries()) {
        const retiradoRes = await cliente.query<{ total?: number; total_retirado?: number }>(
            `SELECT COALESCE(SUM(el.cantidad_egresada), 0)::float8 AS total
             FROM egreso_lineas el
             JOIN egresos_bodega e ON e.id_egreso = el.id_egreso
             WHERE e.proyecto_id = $1
               AND el.id_articulo = $2
               AND (e.tecnico_retira_id = $3 OR ($4 <> '' AND e.tecnico_retira_rut = $4))`,
            [idProyecto, idArt, idTecnico, tecnico.rut]
        );

        const usadoRes = await cliente.query<{ total?: number; total_utilizado?: number }>(
            `SELECT COALESCE(SUM(cantidad_utilizada), 0)::float8 AS total
             FROM uso_insumos_proyecto
             WHERE proyecto_id = $1 AND tecnico_id = $2 AND id_articulo = $3`,
            [idProyecto, idTecnico, idArt]
        );

        const previaRes = await cliente.query<{ total?: number; total_devuelto?: number }>(
            `SELECT COALESCE(SUM(dl.cantidad_declarada), 0)::float8 AS total
             FROM devolucion_lineas dl
             JOIN devoluciones_tecnico d ON d.id_devolucion = dl.id_devolucion
             WHERE d.proyecto_id = $1
               AND d.tecnico_id = $2
               AND dl.id_articulo = $3
               AND d.estado IN ('En tránsito', 'Recibida')`,
            [idProyecto, idTecnico, idArt]
        );

        const retirada = redondear(Number(retiradoRes.rows[0]?.total ?? retiradoRes.rows[0]?.total_retirado ?? 0));
        const utilizada = redondear(Number(usadoRes.rows[0]?.total ?? usadoRes.rows[0]?.total_utilizado ?? 0));
        const previa = redondear(Number(previaRes.rows[0]?.total ?? previaRes.rows[0]?.total_devuelto ?? 0));
        const maximo = redondear(Math.max(0, retirada - utilizada - previa));

        snapshotsPorArticulo.set(idArt, {
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

    // 6. Insertar cabecera
    const cabRes = await cliente.query<{
        id_devolucion: number;
        fecha_declaracion: string;
    }>(
        `INSERT INTO devoluciones_tecnico (
             proyecto_id, tecnico_id, tecnico_rut, tecnico_nombre, estado, id_usuario_declara
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_devolucion, fecha_declaracion::text AS fecha_declaracion`,
        [idProyecto, idTecnico, tecnico.rut, tecnico.nombre_completo, ESTADO_DEVOLUCION_EN_TRANSITO, idTecnico]
    );
    const idDevolucion = cabRes.rows[0].id_devolucion;
    const fechaDeclaracion = cabRes.rows[0].fecha_declaracion;
    const codigoDevolucion = `DEV-${new Date().getFullYear()}-${String(idDevolucion).padStart(5, '0')}`;

    await cliente.query(
        'UPDATE devoluciones_tecnico SET codigo_devolucion = $2, codigo = $2 WHERE id_devolucion = $1',
        [idDevolucion, codigoDevolucion]
    );

    // 7. Insertar líneas
    const lineasDeclaradas: LineaDevolucionDeclarada[] = [];
    for (const [idArt, info] of acumuladoPorArticulo.entries()) {
        const snap = snapshotsPorArticulo.get(idArt)!;
        const lineaRes = await cliente.query<{ id_devolucion_linea: number }>(
            `INSERT INTO devolucion_lineas (
                 id_devolucion, id_articulo, cantidad_retirada, cantidad_utilizada, cantidad_declarada
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id_devolucion_linea`,
            [idDevolucion, idArt, snap.cantidad_retirada, snap.cantidad_utilizada, info.cantidad]
        );
        lineasDeclaradas.push({
            id_devolucion_linea: lineaRes.rows[0].id_devolucion_linea,
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

    // 8. Alerta para el Bodeguero
    const resumenLineas = lineasDeclaradas.map((l) => `${l.cantidad_declarada} x ${l.sku} (${l.nombre_articulo})`).join(', ');
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

    // 9. Auditoría inmutable
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
        alerta_bodeguero: alertaRes.rows[0] ?? null,
    };
};

export const declararDevolucion = async (req: Request, res: Response): Promise<void> => {
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

/**
 * [FRONT-2 / BACK-2] Consulta el sobrante real por insumo de un técnico en un proyecto
 * (cantidad_retirada - cantidad_utilizada - cantidad_devuelta_previa), para alimentar
 * la pantalla móvil y mostrar el tope máximo devolvible.
 */
export const obtenerSobranteDevolucion = async (req: Request, res: Response): Promise<void> => {
    try {
        const idProyecto = Number(req.query.id_proyecto ?? req.query.proyecto_id);
        if (!Number.isInteger(idProyecto) || idProyecto <= 0) {
            throw new ErrorAplicacion(400, 'El parámetro id_proyecto es obligatorio');
        }

        const idEjecutor = obtenerIdEjecutor(req);
        if (!idEjecutor) {
            throw new ErrorAplicacion(401, 'Debes iniciar sesión');
        }

        let idTecnico = idEjecutor;
        const usuarioSesion = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        if (req.query.id_tecnico && (usuarioSesion?.rol === 'admin' || usuarioSesion?.rol === 'warehouse')) {
            const idTecParam = Number(req.query.id_tecnico);
            if (Number.isInteger(idTecParam) && idTecParam > 0) {
                idTecnico = idTecParam;
            }
        }

        const tecRes = await pool.query<{ rut: string }>(
            `SELECT COALESCE(rut, '') AS rut FROM usuario WHERE id_usuario = $1 LIMIT 1`,
            [idTecnico]
        );
        const rutTecnico = tecRes.rows[0]?.rut ?? '';

        const retirados = await pool.query<{
            id_articulo: number;
            sku: string;
            nombre_articulo: string;
            unidad: string;
            total_retirado: number;
        }>(
            `SELECT a.id_articulo,
                    COALESCE(a.sku, a.id_articulo::text) AS sku,
                    a.nombre_articulo,
                    COALESCE(um.codigo, 'un') AS unidad,
                    COALESCE(SUM(el.cantidad_egresada), 0)::float8 AS total_retirado
             FROM egreso_lineas el
             JOIN egresos_bodega e ON e.id_egreso = el.id_egreso
             JOIN articulo a ON a.id_articulo = el.id_articulo
             LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
             LEFT JOIN unidades_medida um ON um.id_unidad = i.id_unidad
             WHERE e.proyecto_id = $1
               AND (e.tecnico_retira_id = $2 OR ($3 <> '' AND e.tecnico_retira_rut = $3))
             GROUP BY a.id_articulo, a.sku, a.nombre_articulo, um.codigo
             ORDER BY a.nombre_articulo ASC`,
            [idProyecto, idTecnico, rutTecnico]
        );

        const idsArticulos = retirados.rows.map((r) => r.id_articulo);
        if (idsArticulos.length === 0) {
            res.status(200).json({ id_proyecto: idProyecto, items: [] });
            return;
        }

        const utilizados = await pool.query<{ id_articulo: number; total_utilizado: number }>(
            `SELECT u.id_articulo, COALESCE(SUM(u.cantidad_utilizada), 0)::float8 AS total_utilizado
             FROM uso_insumos_proyecto u
             WHERE u.proyecto_id = $1 AND u.tecnico_id = $2 AND u.id_articulo = ANY($3::int[])
             GROUP BY u.id_articulo`,
            [idProyecto, idTecnico, idsArticulos]
        );
        const mapaUtilizados = new Map<number, number>(utilizados.rows.map((r) => [r.id_articulo, Number(r.total_utilizado)]));

        const devueltos = await pool.query<{ id_articulo: number; total_devuelto: number }>(
            `SELECT dl.id_articulo, COALESCE(SUM(dl.cantidad_declarada), 0)::float8 AS total_devuelto
             FROM devoluciones_tecnico dt
             JOIN devolucion_lineas dl ON dl.id_devolucion = dt.id_devolucion
             WHERE dt.proyecto_id = $1 AND dt.tecnico_id = $2 AND dt.estado IN ('En tránsito', 'Recibida')
               AND dl.id_articulo = ANY($3::int[])
             GROUP BY dl.id_articulo`,
            [idProyecto, idTecnico, idsArticulos]
        );
        const mapaDevueltos = new Map<number, number>(devueltos.rows.map((r) => [r.id_articulo, Number(r.total_devuelto)]));

        const items = retirados.rows.map((r) => {
            const retirado = redondear(Number(r.total_retirado));
            const utilizado = redondear(mapaUtilizados.get(r.id_articulo) ?? 0);
            const devueltoPrevio = redondear(mapaDevueltos.get(r.id_articulo) ?? 0);
            const maxDevolvible = redondear(Math.max(0, retirado - utilizado - devueltoPrevio));

            return {
                id_articulo: r.id_articulo,
                sku: r.sku,
                nombre_articulo: r.nombre_articulo,
                unidad: r.unidad,
                cantidad_retirada: retirado,
                cantidad_utilizada: utilizado,
                cantidad_devuelta_previa: devueltoPrevio,
                cantidad_maxima_devolvible: maxDevolvible,
            };
        });

        res.status(200).json({ id_proyecto: idProyecto, items });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al consultar sobrante de insumos');
    }
};

// =========================================================================================
// [BACK-1] CONFIRMACIÓN DE RECEPCIÓN FÍSICA PARA EL BODEGUERO
// =========================================================================================

export interface LineaRecepcionConfirmada {
    id_devolucion_linea: number;
    id_articulo: number;
    sku: string;
    nombre_articulo: string;
    cantidad_declarada: number;
    cantidad_recibida: number;
    diferencia: number;
    disponible_anterior: number;
    disponible_nuevo: number;
    costo_unitario: number;
    ajuste_costo: number;
    id_movimiento_cardex: number | null;
}

export interface ResultadoConfirmacionRecepcion {
    id_devolucion: number;
    codigo: string;
    estado: typeof ESTADO_DEVOLUCION_RECIBIDA;
    proyecto_id: number;
    tiene_diferencia: boolean;
    lineas: LineaRecepcionConfirmada[];
    ajuste_costo_total: number;
    alerta_administrador: { titulo: string; descripcion: string } | null;
}

export const confirmarRecepcionDevolucionEnTransaccion = async (
    cliente: PoolClient,
    idDevolucion: number,
    entradas: unknown,
    observaciones: string | null,
    idBodeguero: number | null
): Promise<ResultadoConfirmacionRecepcion> => {
    const cabeceraRes = await cliente.query<{
        id_devolucion: number;
        codigo: string;
        codigo_devolucion: string | null;
        proyecto_id: number;
        tecnico_id: number;
        estado: string;
    }>(
        `/* dev:select-cabecera */
         SELECT id_devolucion, COALESCE(codigo, codigo_devolucion, 'DEV-' || id_devolucion::text) AS codigo,
                codigo_devolucion, proyecto_id, tecnico_id, estado
         FROM devoluciones_tecnico
         WHERE id_devolucion = $1
         FOR UPDATE`,
        [idDevolucion]
    );
    const cabecera = cabeceraRes.rows[0];
    if (!cabecera) throw new ErrorAplicacion(404, 'Devolución no encontrada');
    if (cabecera.estado !== ESTADO_DEVOLUCION_EN_TRANSITO) {
        throw new ErrorAplicacion(409, `La devolución ${cabecera.codigo} ya fue confirmada; no se puede recibir dos veces`);
    }

    const lineasRes = await cliente.query<LineaDevolucionDb>(
        `/* dev:select-lineas */
         SELECT id_devolucion_linea, id_articulo, cantidad_declarada::float8 AS cantidad_declarada
         FROM devolucion_lineas
         WHERE id_devolucion = $1
         ORDER BY id_devolucion_linea
         FOR UPDATE`,
        [idDevolucion]
    );
    const plan = planificarConfirmacionRecepcion(
        lineasRes.rows.map((l) => ({ ...l, cantidad_declarada: Number(l.cantidad_declarada) })),
        entradas
    );

    const lineasConfirmadas: LineaRecepcionConfirmada[] = [];
    let ajusteTotal = 0;

    for (const item of plan) {
        const stockRes = await cliente.query<{
            cantidad_disponible: number;
            cantidad_comprometida: number;
            pmp: number;
            precio_unitario: number;
            sku: string;
            nombre_articulo: string;
        }>(
            `/* dev:select-stock */
             SELECT s.cantidad_disponible::float8 AS cantidad_disponible,
                    s.cantidad_comprometida::float8 AS cantidad_comprometida,
                    COALESCE(s.pmp, 0)::float8 AS pmp,
                    COALESCE(a.precio_unitario, 0)::float8 AS precio_unitario,
                    a.sku, a.nombre_articulo
             FROM articulos_stock s
             JOIN articulo a ON a.id_articulo = s.id_articulo
             WHERE s.id_articulo = $1
             FOR UPDATE OF s`,
            [item.id_articulo]
        );
        const stock = stockRes.rows[0];
        if (!stock) throw new ErrorAplicacion(404, `El artículo #${item.id_articulo} no tiene registro de stock`);

        const dispAnterior = Number(stock.cantidad_disponible);
        const comprometido = Number(stock.cantidad_comprometida);
        const pmp = Number(stock.pmp) > 0 ? Number(stock.pmp) : Number(stock.precio_unitario);
        const dispNuevo = Number((dispAnterior + item.cantidad_recibida).toFixed(3));
        const ajuste = item.cantidad_recibida > 0 ? -calcularMontoAjusteCosto(item.cantidad_recibida, pmp) : 0;
        let idMovimiento: number | null = null;

        if (item.cantidad_recibida > 0) {
            await cliente.query(
                `/* dev:update-stock */
                 UPDATE articulos_stock SET cantidad_disponible = $2 WHERE id_articulo = $1`,
                [item.id_articulo, dispNuevo]
            );

            const saldoHistorico = Number((dispNuevo + comprometido).toFixed(3));
            const valorTotal = Math.round(saldoHistorico * pmp);
            const referencia =
                `${cabecera.codigo} | Devolución de técnico #${cabecera.tecnico_id} | Proyecto #${cabecera.proyecto_id} | ` +
                `Declarado: ${item.cantidad_declarada}, Recibido real: ${item.cantidad_recibida}`;

            const movRes = await cliente.query<{ id_movimiento: number }>(
                `/* dev:insert-cardex */
                 INSERT INTO movimientos_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, valor_total_historico, referencia, id_usuario)
                 VALUES ($1, 'Entrada', 'disponible', $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id_movimiento`,
                [item.id_articulo, item.cantidad_recibida, pmp, saldoHistorico, pmp, valorTotal, referencia, idBodeguero]
            );
            idMovimiento = movRes.rows[0]?.id_movimiento ?? null;

            await cliente.query(
                `/* dev:insert-cardex-simple */
                 INSERT INTO movimiento_inventario
                     (id_insumo, tipo_movimiento, destino_bolsa, cantidad, costo_unitario, saldo_historico,
                      pmp_historico, referencia, id_usuario)
                 VALUES ($1, 'Entrada', 'disponible', $2, $3, $4, $5, $6, $7)`,
                [item.id_articulo, item.cantidad_recibida, pmp, saldoHistorico, pmp, referencia, idBodeguero]
            );

            await cliente.query(
                `/* dev:insert-ajuste-costo */
                 INSERT INTO proyecto_costo_ajuste
                     (proyecto_id, id_devolucion, id_articulo, cantidad, costo_unitario, monto, tipo)
                 VALUES ($1, $2, $3, $4, $5, $6, 'devolucion_bodega')`,
                [cabecera.proyecto_id, cabecera.id_devolucion, item.id_articulo, item.cantidad_recibida, pmp, ajuste]
            );
        }

        await cliente.query(
            `/* dev:update-linea */
             UPDATE devolucion_lineas
             SET cantidad_recibida = $2, diferencia = $3, costo_unitario = $4, id_movimiento_cardex = $5
             WHERE id_devolucion_linea = $1`,
            [item.id_devolucion_linea, item.cantidad_recibida, item.diferencia, item.cantidad_recibida > 0 ? pmp : null, idMovimiento]
        );

        ajusteTotal += ajuste;
        lineasConfirmadas.push({
            id_devolucion_linea: item.id_devolucion_linea,
            id_articulo: item.id_articulo,
            sku: stock.sku,
            nombre_articulo: stock.nombre_articulo,
            cantidad_declarada: item.cantidad_declarada,
            cantidad_recibida: item.cantidad_recibida,
            diferencia: item.diferencia,
            disponible_anterior: dispAnterior,
            disponible_nuevo: item.cantidad_recibida > 0 ? dispNuevo : dispAnterior,
            costo_unitario: pmp,
            ajuste_costo: ajuste,
            id_movimiento_cardex: idMovimiento,
        });
    }

    const tieneDiferencia = lineasConfirmadas.some((l) => l.diferencia !== 0);
    await cliente.query(
        `/* dev:update-cabecera */
         UPDATE devoluciones_tecnico
         SET estado = 'Recibida', bodeguero_id = $2, tiene_diferencia = $3,
             observaciones_recepcion = $4, fecha_recepcion = CURRENT_TIMESTAMP
         WHERE id_devolucion = $1`,
        [cabecera.id_devolucion, idBodeguero, tieneDiferencia, observaciones]
    );

    let alerta: ResultadoConfirmacionRecepcion['alerta_administrador'] = null;
    if (tieneDiferencia) {
        alerta = construirAlertaDiferenciaDevolucion({
            codigo: cabecera.codigo,
            proyectoId: cabecera.proyecto_id,
            tecnicoId: cabecera.tecnico_id,
            lineas: lineasConfirmadas.map((l) => ({ sku: l.sku, declarada: l.cantidad_declarada, recibida: l.cantidad_recibida })),
        });
        await cliente.query(
            `/* dev:insert-alerta */
             INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
             VALUES ('diferencia_devolucion', 'amarillo', $1, $2, NULL, NULL, FALSE)`,
            [alerta.titulo, alerta.descripcion]
        );
    }

    await registrarAuditoria(
        {
            entidad: 'devolucion_tecnico',
            accion: 'confirmar_recepcion',
            idRegistro: cabecera.id_devolucion,
            idUsuarioEjecutor: idBodeguero,
            estadoAnterior: { estado: ESTADO_DEVOLUCION_EN_TRANSITO },
            estadoNuevo: {
                estado: ESTADO_DEVOLUCION_RECIBIDA,
                tiene_diferencia: tieneDiferencia,
                ajuste_costo_total: ajusteTotal,
                lineas: lineasConfirmadas.map((l) => ({
                    id_articulo: l.id_articulo,
                    declarada: l.cantidad_declarada,
                    recibida: l.cantidad_recibida,
                })),
            },
            descripcion: observaciones ?? undefined,
        },
        cliente
    );

    return {
        id_devolucion: cabecera.id_devolucion,
        codigo: cabecera.codigo,
        estado: ESTADO_DEVOLUCION_RECIBIDA,
        proyecto_id: cabecera.proyecto_id,
        tiene_diferencia: tieneDiferencia,
        lineas: lineasConfirmadas,
        ajuste_costo_total: ajusteTotal,
        alerta_administrador: alerta,
    };
};

export const listarDevolucionesTecnico = async (req: Request, res: Response): Promise<void> => {
    try {
        const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
        if (estado && estado !== ESTADO_DEVOLUCION_EN_TRANSITO && estado !== ESTADO_DEVOLUCION_RECIBIDA) {
            throw new ErrorAplicacion(400, `estado debe ser "${ESTADO_DEVOLUCION_EN_TRANSITO}" o "${ESTADO_DEVOLUCION_RECIBIDA}"`);
        }

        const idEjecutor = obtenerIdEjecutor(req);
        const usuarioSesion = typeof req.usuario === 'object' && req.usuario !== null ? req.usuario : null;
        const esTecnico = usuarioSesion?.rol === 'technician';

        const resultado = await pool.query(
            `SELECT d.id_devolucion,
                    COALESCE(d.codigo, d.codigo_devolucion, 'DEV-' || d.id_devolucion::text) AS codigo,
                    COALESCE(d.codigo_devolucion, d.codigo, 'DEV-' || d.id_devolucion::text) AS codigo_devolucion,
                    d.proyecto_id,
                    p.nombre_proyecto,
                    p.codigo_proyecto,
                    d.tecnico_id,
                    d.tecnico_nombre,
                    d.tecnico_rut,
                    d.estado,
                    d.tiene_diferencia,
                    d.observaciones_recepcion,
                    d.bodeguero_id,
                    d.fecha_declaracion,
                    d.fecha_recepcion,
                    COALESCE((SELECT json_agg(json_build_object(
                        'id_devolucion_linea', l.id_devolucion_linea,
                        'id_articulo', l.id_articulo,
                        'sku', a.sku,
                        'nombre_articulo', a.nombre_articulo,
                        'unidad', COALESCE(um.codigo, 'un'),
                        'cantidad_retirada', l.cantidad_retirada::float8,
                        'cantidad_utilizada', l.cantidad_utilizada::float8,
                        'cantidad_declarada', l.cantidad_declarada::float8,
                        'cantidad_recibida', l.cantidad_recibida::float8,
                        'diferencia', l.diferencia::float8
                    ) ORDER BY l.id_devolucion_linea)
                    FROM devolucion_lineas l
                    JOIN articulo a ON a.id_articulo = l.id_articulo
                    LEFT JOIN insumos i ON i.id_insumo = a.id_articulo
                    LEFT JOIN unidades_medida um ON um.id_unidad = i.id_unidad
                    WHERE l.id_devolucion = d.id_devolucion), '[]'::json) AS items
             FROM devoluciones_tecnico d
             JOIN proyecto p ON p.id_proyecto = d.proyecto_id
             WHERE ($1 = '' OR d.estado = $1)
               AND ($2::boolean = FALSE OR d.tecnico_id = $3)
             ORDER BY d.fecha_declaracion DESC`,
            [estado, esTecnico, idEjecutor]
        );
        const filas = resultado.rows.map((r: any) => ({
            ...r,
            lineas: r.items,
        }));
        res.status(200).json(filas);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las devoluciones');
    }
};

export const confirmarRecepcionDevolucion = async (req: Request, res: Response): Promise<void> => {
    try {
        const idDevolucion = Number(req.params.id);
        if (!Number.isInteger(idDevolucion) || idDevolucion <= 0) throw new ErrorAplicacion(400, 'Identificador inválido');

        const observaciones =
            typeof req.body?.observaciones === 'string' && req.body.observaciones.trim()
                ? req.body.observaciones.trim().slice(0, 250)
                : null;
        const idBodeguero = obtenerIdEjecutor(req);

        const resultado = await ejecutarTransaccion((cliente) =>
            confirmarRecepcionDevolucionEnTransaccion(
                cliente,
                idDevolucion,
                req.body?.lineas ?? req.body?.items,
                observaciones,
                idBodeguero
            )
        );
        res.status(200).json(resultado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al confirmar la recepción de la devolución');
    }
};
