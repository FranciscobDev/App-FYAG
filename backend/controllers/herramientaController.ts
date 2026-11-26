import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import { ejecutarTransaccion } from '../services/transaccion';
import { estaMantenimientoVencido, hoyIso } from '../services/mantenimientoHerramientaService';

/** Marca visual: mantenimiento vencido (fecha pasada y herramienta no dada de baja). */
const marcarVencimiento = (h: HerramientaFila) => ({
    ...h,
    mantenimiento_vencido: estaMantenimientoVencido(h, hoyIso()),
});

export const ESTADOS_HERRAMIENTA = [
    'disponible',
    'asignada',
    'en mantención',
    'dada de baja',
] as const;

export type EstadoHerramienta = (typeof ESTADOS_HERRAMIENTA)[number];

export interface HerramientaFila {
    id_herramienta: number;
    codigo_herramienta: string;
    nombre: string;
    categoria: string | null;
    valor: number;
    estado: EstadoHerramienta;
    fecha_proximo_mantenimiento: string | null;
    codigo_qr: string | null;
    ubicacion: string | null;
    activo: boolean;
    fecha_creacion: string;
    fecha_actualizacion: string;
}

export const normalizarEstadoHerramienta = (estadoEntrada?: unknown): EstadoHerramienta => {
    if (typeof estadoEntrada !== 'string') {
        throw new ErrorAplicacion(
            400,
            'El estado de la herramienta es obligatorio y debe ser un texto válido'
        );
    }

    const estadoLimpio = estadoEntrada.trim().toLowerCase();
    if (estadoLimpio === 'disponible') return 'disponible';
    if (estadoLimpio === 'asignada') return 'asignada';
    if (
        estadoLimpio === 'en mantencion' ||
        estadoLimpio === 'en mantención' ||
        estadoLimpio === 'mantenimiento' ||
        estadoLimpio === 'en mantenimiento'
    ) {
        return 'en mantención';
    }
    if (
        estadoLimpio === 'dada de baja' ||
        estadoLimpio === 'baja' ||
        estadoLimpio === 'dada_de_baja'
    ) {
        return 'dada de baja';
    }

    throw new ErrorAplicacion(
        400,
        `Estado no reconocido: "${estadoEntrada}". Los estados permitidos son: ${ESTADOS_HERRAMIENTA.join(', ')}`
    );
};

export const validarFechaIsoOpcional = (fecha?: unknown): string | null => {
    if (fecha === null || fecha === undefined || fecha === '') return null;
    if (typeof fecha !== 'string') {
        throw new ErrorAplicacion(400, 'La fecha de mantenimiento debe ser un texto con formato AAAA-MM-DD');
    }
    const fechaTrim = fecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTrim)) {
        throw new ErrorAplicacion(400, 'Formato de fecha inválido. Utilice AAAA-MM-DD');
    }
    const timestamp = Date.parse(fechaTrim);
    if (Number.isNaN(timestamp)) {
        throw new ErrorAplicacion(400, 'La fecha ingresada no corresponde a una fecha de calendario válida');
    }
    return fechaTrim;
};

// Asegurar tabla si no existe en ambientes de test rápidos
let tablaVerificada = false;
export const asegurarTablaHerramientas = async (cliente?: Pick<PoolClient, 'query'>): Promise<void> => {
    if (tablaVerificada) return;
    const c = cliente ?? pool;
    await c.query(`
        CREATE TABLE IF NOT EXISTS herramientas (
            id_herramienta SERIAL PRIMARY KEY,
            codigo_herramienta VARCHAR(50) NOT NULL UNIQUE,
            nombre VARCHAR(150) NOT NULL,
            categoria VARCHAR(80) NULL,
            valor BIGINT NOT NULL DEFAULT 0 CHECK (valor >= 0),
            estado VARCHAR(30) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignada', 'en mantención', 'dada de baja')),
            fecha_proximo_mantenimiento DATE NULL,
            codigo_qr VARCHAR(100) NULL UNIQUE,
            ubicacion VARCHAR(120) NULL,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
    tablaVerificada = true;
};

/**
 * Operación transaccional reusable para creación de herramientas.
 */
export const crearHerramientaEnTransaccion = async (
    cliente: PoolClient,
    datos: {
        codigo_herramienta: string;
        nombre: string;
        categoria?: string | null;
        valor?: number;
        estado?: string;
        fecha_proximo_mantenimiento?: string | null;
        codigo_qr?: string | null;
        ubicacion?: string | null;
    },
    idEjecutor: number | null
): Promise<HerramientaFila> => {
    const codigoLimpio = String(datos.codigo_herramienta ?? '').trim();
    if (!codigoLimpio) {
        throw new ErrorAplicacion(400, 'El código único de la herramienta es obligatorio');
    }

    const nombreLimpio = String(datos.nombre ?? '').trim();
    if (!nombreLimpio) {
        throw new ErrorAplicacion(400, 'El nombre de la herramienta es obligatorio');
    }

    const valorNumerico = Number(datos.valor ?? 0);
    if (Number.isNaN(valorNumerico) || valorNumerico < 0) {
        throw new ErrorAplicacion(400, 'El valor de la herramienta debe ser un número mayor o igual a 0');
    }

    const estadoNormalizado = normalizarEstadoHerramienta(datos.estado ?? 'disponible');
    const fechaMantenimiento = validarFechaIsoOpcional(datos.fecha_proximo_mantenimiento);
    const codigoQrLimpio = datos.codigo_qr !== undefined && datos.codigo_qr !== null && String(datos.codigo_qr).trim() !== ''
        ? String(datos.codigo_qr).trim()
        : null;

    // Verificar unicidad de código
    const existeCodigo = await cliente.query(
        'SELECT id_herramienta FROM herramientas WHERE LOWER(codigo_herramienta) = LOWER($1)',
        [codigoLimpio]
    );
    if (existeCodigo.rows.length > 0) {
        throw new ErrorAplicacion(409, `Ya existe una herramienta registrada con el código "${codigoLimpio}"`);
    }

    // Verificar unicidad de QR si viene
    if (codigoQrLimpio) {
        const existeQr = await cliente.query(
            'SELECT id_herramienta FROM herramientas WHERE codigo_qr = $1',
            [codigoQrLimpio]
        );
        if (existeQr.rows.length > 0) {
            throw new ErrorAplicacion(409, `El código QR "${codigoQrLimpio}" ya se encuentra asignado a otra herramienta`);
        }
    }

    const insercion = await cliente.query<HerramientaFila>(
        `INSERT INTO herramientas (
            codigo_herramienta,
            nombre,
            categoria,
            valor,
            estado,
            fecha_proximo_mantenimiento,
            codigo_qr,
            ubicacion,
            activo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        RETURNING *`,
        [
            codigoLimpio,
            nombreLimpio,
            datos.categoria ? String(datos.categoria).trim() : null,
            Math.round(valorNumerico),
            estadoNormalizado,
            fechaMantenimiento,
            codigoQrLimpio,
            datos.ubicacion ? String(datos.ubicacion).trim() : null,
        ]
    );

    const herramientaCreada = insercion.rows[0];

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'crear',
            idRegistro: herramientaCreada.id_herramienta,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: null,
            estadoNuevo: herramientaCreada,
            descripcion: `Registro inicial de herramienta ${herramientaCreada.codigo_herramienta} - ${herramientaCreada.nombre}`,
        },
        cliente
    );

    return herramientaCreada;
};

/**
 * POST /api/herramientas
 */
export const crearHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const idEjecutor = obtenerIdEjecutor(req);
        const {
            codigo_herramienta,
            nombre,
            categoria,
            valor,
            estado,
            fecha_proximo_mantenimiento,
            codigo_qr,
            ubicacion,
        } = req.body ?? {};

        const resultado = await ejecutarTransaccion((cliente) =>
            crearHerramientaEnTransaccion(
                cliente,
                {
                    codigo_herramienta,
                    nombre,
                    categoria,
                    valor,
                    estado,
                    fecha_proximo_mantenimiento,
                    codigo_qr,
                    ubicacion,
                },
                idEjecutor
            )
        );

        res.status(201).json({
            ok: true,
            mensaje: 'Herramienta registrada exitosamente',
            herramienta: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al registrar la herramienta');
    }
};

/**
 * GET /api/herramientas
 */
export const listarHerramientas = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const { estado, buscar, incluir_inactivas, solo_inactivas } = req.query;

        const condiciones: string[] = [];
        const parametros: unknown[] = [];

        if (solo_inactivas === 'true') {
            condiciones.push('activo = FALSE');
        } else if (incluir_inactivas !== 'true') {
            condiciones.push('activo = TRUE');
        }

        if (estado && typeof estado === 'string' && estado.trim() !== '') {
            parametros.push(normalizarEstadoHerramienta(estado));
            condiciones.push(`estado = $${parametros.length}`);
        }

        if (buscar && typeof buscar === 'string' && buscar.trim() !== '') {
            parametros.push(`%${buscar.trim()}%`);
            const idx = parametros.length;
            condiciones.push(
                `(codigo_herramienta ILIKE $${idx} OR nombre ILIKE $${idx} OR codigo_qr ILIKE $${idx} OR categoria ILIKE $${idx})`
            );
        }

        const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
        const consulta = `
            SELECT *
            FROM herramientas
            ${clausulaWhere}
            ORDER BY activo DESC, nombre ASC, id_herramienta ASC
        `;

        const resultado = await pool.query<HerramientaFila>(consulta, parametros);

        res.status(200).json({
            ok: true,
            total: resultado.rows.length,
            herramientas: resultado.rows.map(marcarVencimiento),
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar las herramientas');
    }
};

/**
 * GET /api/herramientas/:id
 */
export const obtenerHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const { id } = req.params;
        const esNumero = /^\d+$/.test(id);

        const consulta = esNumero
            ? 'SELECT * FROM herramientas WHERE id_herramienta = $1'
            : 'SELECT * FROM herramientas WHERE LOWER(codigo_herramienta) = LOWER($1) OR codigo_qr = $1';

        const resultado = await pool.query<HerramientaFila>(consulta, [id]);
        if (resultado.rows.length === 0) {
            res.status(404).json({
                ok: false,
                mensaje: `No se encontró la herramienta con identificador "${id}"`,
                codigo: 'HERRAMIENTA_NO_ENCONTRADA',
            });
            return;
        }

        res.status(200).json({
            ok: true,
            herramienta: marcarVencimiento(resultado.rows[0]),
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener la herramienta');
    }
};

/**
 * Operación transaccional reusable para actualización de herramientas.
 */
export const actualizarHerramientaEnTransaccion = async (
    cliente: PoolClient,
    idHerramienta: number,
    datos: {
        codigo_herramienta?: string;
        nombre?: string;
        categoria?: string | null;
        valor?: number;
        estado?: string;
        fecha_proximo_mantenimiento?: string | null;
        codigo_qr?: string | null;
        ubicacion?: string | null;
        activo?: boolean;
    },
    idEjecutor: number | null
): Promise<HerramientaFila> => {
    const actual = await cliente.query<HerramientaFila>(
        'SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE',
        [idHerramienta]
    );

    if (actual.rows.length === 0) {
        throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    }

    const herramientaActual = actual.rows[0];

    let nuevoCodigo = herramientaActual.codigo_herramienta;
    if (datos.codigo_herramienta !== undefined) {
        const codigoLimpio = String(datos.codigo_herramienta).trim();
        if (!codigoLimpio) {
            throw new ErrorAplicacion(400, 'El código de herramienta no puede estar vacío');
        }
        if (codigoLimpio.toLowerCase() !== herramientaActual.codigo_herramienta.toLowerCase()) {
            const duplicado = await cliente.query(
                'SELECT id_herramienta FROM herramientas WHERE LOWER(codigo_herramienta) = LOWER($1) AND id_herramienta <> $2',
                [codigoLimpio, idHerramienta]
            );
            if (duplicado.rows.length > 0) {
                throw new ErrorAplicacion(409, `El código "${codigoLimpio}" ya pertenece a otra herramienta`);
            }
        }
        nuevoCodigo = codigoLimpio;
    }

    let nuevoNombre = herramientaActual.nombre;
    if (datos.nombre !== undefined) {
        const nom = String(datos.nombre).trim();
        if (!nom) throw new ErrorAplicacion(400, 'El nombre no puede estar vacío');
        nuevoNombre = nom;
    }

    let nuevoValor = herramientaActual.valor;
    if (datos.valor !== undefined) {
        const val = Number(datos.valor);
        if (Number.isNaN(val) || val < 0) {
            throw new ErrorAplicacion(400, 'El valor debe ser un número >= 0');
        }
        nuevoValor = Math.round(val);
    }

    let nuevoEstado = herramientaActual.estado;
    if (datos.estado !== undefined) {
        nuevoEstado = normalizarEstadoHerramienta(datos.estado);
    }

    let nuevaFechaMant = herramientaActual.fecha_proximo_mantenimiento;
    if (datos.fecha_proximo_mantenimiento !== undefined) {
        nuevaFechaMant = validarFechaIsoOpcional(datos.fecha_proximo_mantenimiento);
    }

    let nuevoQr = herramientaActual.codigo_qr;
    if (datos.codigo_qr !== undefined) {
        const qrLimpio = datos.codigo_qr !== null && String(datos.codigo_qr).trim() !== '' ? String(datos.codigo_qr).trim() : null;
        if (qrLimpio && qrLimpio !== herramientaActual.codigo_qr) {
            const dupQr = await cliente.query(
                'SELECT id_herramienta FROM herramientas WHERE codigo_qr = $1 AND id_herramienta <> $2',
                [qrLimpio, idHerramienta]
            );
            if (dupQr.rows.length > 0) {
                throw new ErrorAplicacion(409, `El QR "${qrLimpio}" ya está asignado a otra herramienta`);
            }
        }
        nuevoQr = qrLimpio;
    }

    const nuevaCategoria = datos.categoria !== undefined
        ? (datos.categoria ? String(datos.categoria).trim() : null)
        : herramientaActual.categoria;
    const nuevaUbicacion = datos.ubicacion !== undefined
        ? (datos.ubicacion ? String(datos.ubicacion).trim() : null)
        : herramientaActual.ubicacion;
    const nuevoActivo = datos.activo !== undefined ? Boolean(datos.activo) : herramientaActual.activo;

    const resUpdate = await cliente.query<HerramientaFila>(
        `UPDATE herramientas SET
            codigo_herramienta = $1,
            nombre = $2,
            categoria = $3,
            valor = $4,
            estado = $5,
            fecha_proximo_mantenimiento = $6,
            codigo_qr = $7,
            ubicacion = $8,
            activo = $9,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_herramienta = $10
        RETURNING *`,
        [
            nuevoCodigo,
            nuevoNombre,
            nuevaCategoria,
            nuevoValor,
            nuevoEstado,
            nuevaFechaMant,
            nuevoQr,
            nuevaUbicacion,
            nuevoActivo,
            idHerramienta,
        ]
    );

    const herramientaModificada = resUpdate.rows[0];

    const cambioEstado = herramientaActual.estado !== herramientaModificada.estado;
    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: cambioEstado ? 'cambio_estado' : 'editar',
            idRegistro: idHerramienta,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: herramientaActual,
            estadoNuevo: herramientaModificada,
            descripcion: cambioEstado
                ? `Cambio de estado de "${herramientaActual.estado}" a "${herramientaModificada.estado}" en herramienta ${herramientaModificada.codigo_herramienta}`
                : `Actualización de herramienta ${herramientaModificada.codigo_herramienta}`,
        },
        cliente
    );

    return herramientaModificada;
};

/**
 * PUT /api/herramientas/:id
 */
export const actualizarHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const idEjecutor = obtenerIdEjecutor(req);
        const idHerramienta = Number(req.params.id);

        if (!Number.isInteger(idHerramienta) || idHerramienta <= 0) {
            res.status(400).json({ mensaje: 'ID de herramienta inválido' });
            return;
        }

        const resultado = await ejecutarTransaccion((cliente) =>
            actualizarHerramientaEnTransaccion(cliente, idHerramienta, req.body ?? {}, idEjecutor)
        );

        res.status(200).json({
            ok: true,
            mensaje: 'Herramienta actualizada exitosamente',
            herramienta: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al actualizar la herramienta');
    }
};

/**
 * Operación transaccional reusable para cambio de estado operativo.
 */
export const cambiarEstadoHerramientaEnTransaccion = async (
    cliente: PoolClient,
    idHerramienta: number,
    datos: {
        estado: string;
        fecha_proximo_mantenimiento?: string | null;
        motivo?: string;
    },
    idEjecutor: number | null
): Promise<{ anterior: EstadoHerramienta; actual: EstadoHerramienta; herramienta: HerramientaFila }> => {
    const nuevoEstado = normalizarEstadoHerramienta(datos.estado);
    const nuevaFechaMant = datos.fecha_proximo_mantenimiento !== undefined
        ? validarFechaIsoOpcional(datos.fecha_proximo_mantenimiento)
        : undefined;

    const actual = await cliente.query<HerramientaFila>(
        'SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE',
        [idHerramienta]
    );

    if (actual.rows.length === 0) {
        throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    }

    const herramientaActual = actual.rows[0];

    let query = `
        UPDATE herramientas SET
            estado = $1,
            fecha_actualizacion = CURRENT_TIMESTAMP
    `;
    const params: unknown[] = [nuevoEstado];

    if (nuevaFechaMant !== undefined) {
        params.push(nuevaFechaMant);
        query += `, fecha_proximo_mantenimiento = $${params.length}`;
    }

    params.push(idHerramienta);
    query += ` WHERE id_herramienta = $${params.length} RETURNING *`;

    const resUpdate = await cliente.query<HerramientaFila>(query, params);
    const herramientaModificada = resUpdate.rows[0];

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'cambio_estado',
            idRegistro: idHerramienta,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: { estado: herramientaActual.estado, fecha_proximo_mantenimiento: herramientaActual.fecha_proximo_mantenimiento },
            estadoNuevo: { estado: herramientaModificada.estado, fecha_proximo_mantenimiento: herramientaModificada.fecha_proximo_mantenimiento },
            descripcion: `Transición de estado de "${herramientaActual.estado}" a "${nuevoEstado}" para herramienta ${herramientaActual.codigo_herramienta}${datos.motivo ? `. Motivo: ${datos.motivo}` : ''}`,
        },
        cliente
    );

    return {
        anterior: herramientaActual.estado,
        actual: herramientaModificada.estado,
        herramienta: herramientaModificada,
    };
};

/**
 * PATCH /api/herramientas/:id/estado
 */
export const cambiarEstadoHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const idEjecutor = obtenerIdEjecutor(req);
        const idHerramienta = Number(req.params.id);

        if (!Number.isInteger(idHerramienta) || idHerramienta <= 0) {
            res.status(400).json({ mensaje: 'ID de herramienta inválido' });
            return;
        }

        const { estado, fecha_proximo_mantenimiento, motivo } = req.body ?? {};
        const resultado = await ejecutarTransaccion((cliente) =>
            cambiarEstadoHerramientaEnTransaccion(
                cliente,
                idHerramienta,
                { estado, fecha_proximo_mantenimiento, motivo },
                idEjecutor
            )
        );

        res.status(200).json({
            ok: true,
            mensaje: `Estado de la herramienta cambiado exitosamente de "${resultado.anterior}" a "${resultado.actual}"`,
            herramienta: resultado.herramienta,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al cambiar estado de la herramienta');
    }
};

/**
 * Operación transaccional reusable para deshabilitación lógica (bloqueo de eliminación física).
 */
export const eliminarHerramientaEnTransaccion = async (
    cliente: PoolClient,
    idHerramienta: number,
    idEjecutor: number | null
): Promise<{ yaDeshabilitada: boolean; herramienta: HerramientaFila }> => {
    const actual = await cliente.query<HerramientaFila>(
        'SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE',
        [idHerramienta]
    );

    if (actual.rows.length === 0) {
        throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    }

    const herramientaActual = actual.rows[0];

    if (!herramientaActual.activo) {
        return {
            yaDeshabilitada: true,
            herramienta: herramientaActual,
        };
    }

    // Deshabilitar lógicamente (sustituyendo DELETE físico)
    const resUpdate = await cliente.query<HerramientaFila>(
        `UPDATE herramientas SET
            activo = FALSE,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_herramienta = $1
        RETURNING *`,
        [idHerramienta]
    );

    const herramientaDeshabilitada = resUpdate.rows[0];

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'deshabilitar',
            idRegistro: idHerramienta,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: herramientaActual,
            estadoNuevo: herramientaDeshabilitada,
            descripcion: `Deshabilitación lógica de herramienta ${herramientaActual.codigo_herramienta} (política de bloqueo de eliminación física para conservar historial)`,
        },
        cliente
    );

    return {
        yaDeshabilitada: false,
        herramienta: herramientaDeshabilitada,
    };
};

/**
 * DELETE /api/herramientas/:id
 */
export const eliminarHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const idEjecutor = obtenerIdEjecutor(req);
        const idHerramienta = Number(req.params.id);

        if (!Number.isInteger(idHerramienta) || idHerramienta <= 0) {
            res.status(400).json({ mensaje: 'ID de herramienta inválido' });
            return;
        }

        const resultado = await ejecutarTransaccion((cliente) =>
            eliminarHerramientaEnTransaccion(cliente, idHerramienta, idEjecutor)
        );

        res.status(200).json({
            ok: true,
            bloqueoEliminacionFisica: true,
            mensaje: resultado.yaDeshabilitada
                ? 'La herramienta ya se encontraba deshabilitada previamente (se conserva historial íntegro).'
                : 'Herramienta deshabilitada exitosamente. Se conserva el historial según la política de bloqueo de eliminación física.',
            herramienta: resultado.herramienta,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al deshabilitar la herramienta');
    }
};

/**
 * Operación transaccional reusable para reactivación.
 */
export const reactivarHerramientaEnTransaccion = async (
    cliente: PoolClient,
    idHerramienta: number,
    idEjecutor: number | null
): Promise<HerramientaFila> => {
    const actual = await cliente.query<HerramientaFila>(
        'SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE',
        [idHerramienta]
    );

    if (actual.rows.length === 0) {
        throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    }

    const herramientaActual = actual.rows[0];
    const resUpdate = await cliente.query<HerramientaFila>(
        `UPDATE herramientas SET
            activo = TRUE,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_herramienta = $1
        RETURNING *`,
        [idHerramienta]
    );

    const herramientaReactivada = resUpdate.rows[0];

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'habilitar',
            idRegistro: idHerramienta,
            idUsuarioEjecutor: idEjecutor,
            estadoAnterior: herramientaActual,
            estadoNuevo: herramientaReactivada,
            descripcion: `Reactivación de herramienta ${herramientaActual.codigo_herramienta}`,
        },
        cliente
    );

    return herramientaReactivada;
};

/**
 * PATCH /api/herramientas/:id/activar
 */
export const reactivarHerramienta = async (req: Request, res: Response): Promise<void> => {
    try {
        await asegurarTablaHerramientas();
        const idEjecutor = obtenerIdEjecutor(req);
        const idHerramienta = Number(req.params.id);

        if (!Number.isInteger(idHerramienta) || idHerramienta <= 0) {
            res.status(400).json({ mensaje: 'ID de herramienta inválido' });
            return;
        }

        const resultado = await ejecutarTransaccion((cliente) =>
            reactivarHerramientaEnTransaccion(cliente, idHerramienta, idEjecutor)
        );

        res.status(200).json({
            ok: true,
            mensaje: 'Herramienta reactivada exitosamente',
            herramienta: resultado,
        });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al reactivar la herramienta');
    }
};
