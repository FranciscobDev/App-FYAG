import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { normalizarRol, obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import {
    MAX_BYTES_LOTE,
    MAX_REGISTROS_POR_LOTE,
    RegistroEntrante,
    construirTextoAlertaConflicto,
    hayConflictoDeVersion,
    validarRegistroEntrante,
} from '../services/sincronizacionService';
import { ejecutarTransaccion } from '../services/transaccion';

export type EstadoResultadoSync = 'sincronizado' | 'conflicto' | 'duplicado' | 'rechazado' | 'error';

export interface ResultadoSincronizacionRegistro {
    id_local: string | null;
    id_envio: string | null;
    estado: EstadoResultadoSync;
    codigo?: string;
    mensaje?: string;
    id_registro?: number;
    /** Versión vigente en la central tras procesar el envío. */
    version_central?: number;
    /** Presente cuando hubo conflicto: la versión del móvil quedó guardada aparte. */
    id_version_conflicto?: number;
    fotos_guardadas?: number;
}

interface FilaRegistro {
    id_registro: number;
    version: number;
    datos: Record<string, unknown>;
    id_usuario_creador: number | null;
}

const insertarFotos = async (
    cliente: PoolClient,
    idRegistro: number,
    idVersion: number,
    fotos: RegistroEntrante['fotos']
): Promise<number> => {
    for (const foto of fotos) {
        await cliente.query(
            `/* sync:insert-foto */
             INSERT INTO sync_foto (id_registro, id_version, nombre, mime_type, tamano_bytes, contenido)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [idRegistro, idVersion, foto.nombre, foto.mime_type, foto.tamano_bytes, foto.contenido]
        );
    }
    return fotos.length;
};

const insertarVersion = async (
    cliente: PoolClient,
    datos: {
        idRegistro: number;
        numeroVersion: number | null;
        estado: 'vigente' | 'historica' | 'conflicto';
        origen: 'movil' | 'central';
        baseVersion: number | null;
        idEnvio: string | null;
        idUsuario: number | null;
        contenido: Record<string, unknown>;
        fechaCliente: Date | null;
    }
): Promise<number> => {
    const res = await cliente.query<{ id_version: number }>(
        `/* sync:insert-version */
         INSERT INTO sync_registro_version
             (id_registro, numero_version, estado, origen, base_version, id_envio, id_usuario, datos, fecha_cliente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         RETURNING id_version`,
        [
            datos.idRegistro,
            datos.numeroVersion,
            datos.estado,
            datos.origen,
            datos.baseVersion,
            datos.idEnvio,
            datos.idUsuario,
            JSON.stringify(datos.contenido),
            datos.fechaCliente,
        ]
    );
    return res.rows[0].id_version;
};

const bloquearRegistro = async (
    cliente: PoolClient,
    tipo: string,
    idLocal: string
): Promise<FilaRegistro | null> => {
    const res = await cliente.query<FilaRegistro>(
        `/* sync:select-registro */
         SELECT id_registro, version, datos, id_usuario_creador
         FROM sync_registro
         WHERE tipo_registro = $1 AND id_local = $2
         FOR UPDATE`,
        [tipo, idLocal]
    );
    return res.rows[0] ?? null;
};

/**
 * Procesa UN registro del lote dentro de una transacción (todo o nada por registro):
 *  - Registro nuevo            -> versión 1 vigente.
 *  - Móvil al día con central  -> nueva versión vigente; la anterior pasa a 'historica' (no se borra).
 *  - Central modificada        -> CONFLICTO: la versión del móvil se guarda aparte (con sus fotos),
 *                                 la de la central NO se toca y se alerta al Administrador.
 *  - Reintento del mismo envío -> 'duplicado' (idempotente, no crea nada).
 */
export const procesarRegistroSincronizadoEnTransaccion = async (
    cliente: PoolClient,
    registro: RegistroEntrante,
    idUsuario: number | null
): Promise<ResultadoSincronizacionRegistro> => {
    const base = { id_local: registro.id_local, id_envio: registro.id_envio };
    let actual = await bloquearRegistro(cliente, registro.tipo_registro, registro.id_local);

    if (!actual) {
        const insertado = await cliente.query<{ id_registro: number }>(
            `/* sync:insert-registro */
             INSERT INTO sync_registro
                 (tipo_registro, id_local, id_usuario_creador, id_usuario_ultima_modificacion, datos, version, origen_ultima_modificacion)
             VALUES ($1, $2, $3, $3, $4::jsonb, 1, 'movil')
             ON CONFLICT (tipo_registro, id_local) DO NOTHING
             RETURNING id_registro`,
            [registro.tipo_registro, registro.id_local, idUsuario, JSON.stringify(registro.datos)]
        );

        if (insertado.rows[0]) {
            const idRegistro = insertado.rows[0].id_registro;
            const idVersion = await insertarVersion(cliente, {
                idRegistro,
                numeroVersion: 1,
                estado: 'vigente',
                origen: 'movil',
                baseVersion: registro.base_version,
                idEnvio: registro.id_envio,
                idUsuario,
                contenido: registro.datos,
                fechaCliente: registro.fecha_cliente,
            });
            const fotos = await insertarFotos(cliente, idRegistro, idVersion, registro.fotos);
            return { ...base, estado: 'sincronizado', id_registro: idRegistro, version_central: 1, fotos_guardadas: fotos };
        }
        // Otro envío creó el registro en paralelo: se continúa por la ruta de registro existente.
        actual = await bloquearRegistro(cliente, registro.tipo_registro, registro.id_local);
        if (!actual) throw new ErrorAplicacion(500, 'No se pudo resolver el registro a sincronizar');
    }

    // Idempotencia: el mismo envío ya fue procesado (p. ej. se cortó la respuesta y el móvil reintentó).
    const previo = await cliente.query(
        `/* sync:select-envio */
         SELECT id_version, estado FROM sync_registro_version
         WHERE id_registro = $1 AND id_envio = $2
         LIMIT 1`,
        [actual.id_registro, registro.id_envio]
    );
    if (previo.rows[0]) {
        return {
            ...base,
            estado: 'duplicado',
            id_registro: actual.id_registro,
            version_central: actual.version,
            ...(previo.rows[0].estado === 'conflicto' ? { id_version_conflicto: previo.rows[0].id_version } : {}),
        };
    }

    if (!hayConflictoDeVersion(registro.base_version, actual.version)) {
        // El móvil partió de la versión vigente: avanza la versión y conserva la anterior como histórica.
        await cliente.query(
            `/* sync:archivar-vigente */
             UPDATE sync_registro_version SET estado = 'historica'
             WHERE id_registro = $1 AND estado = 'vigente'`,
            [actual.id_registro]
        );
        const nuevaVersion = actual.version + 1;
        const idVersion = await insertarVersion(cliente, {
            idRegistro: actual.id_registro,
            numeroVersion: nuevaVersion,
            estado: 'vigente',
            origen: 'movil',
            baseVersion: registro.base_version,
            idEnvio: registro.id_envio,
            idUsuario,
            contenido: registro.datos,
            fechaCliente: registro.fecha_cliente,
        });
        await cliente.query(
            `/* sync:update-registro */
             UPDATE sync_registro
             SET datos = $2::jsonb, version = $3, origen_ultima_modificacion = $4,
                 id_usuario_ultima_modificacion = $5, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id_registro = $1`,
            [actual.id_registro, JSON.stringify(registro.datos), nuevaVersion, 'movil', idUsuario]
        );
        const fotos = await insertarFotos(cliente, actual.id_registro, idVersion, registro.fotos);
        return {
            ...base,
            estado: 'sincronizado',
            id_registro: actual.id_registro,
            version_central: nuevaVersion,
            fotos_guardadas: fotos,
        };
    }

    // CONFLICTO: se guarda la versión del móvil AL LADO de la central; la central no se modifica.
    const idVersionConflicto = await insertarVersion(cliente, {
        idRegistro: actual.id_registro,
        numeroVersion: null,
        estado: 'conflicto',
        origen: 'movil',
        baseVersion: registro.base_version,
        idEnvio: registro.id_envio,
        idUsuario,
        contenido: registro.datos,
        fechaCliente: registro.fecha_cliente,
    });
    const fotos = await insertarFotos(cliente, actual.id_registro, idVersionConflicto, registro.fotos);
    await cliente.query(
        `/* sync:marcar-conflicto */
         UPDATE sync_registro SET tiene_conflicto = TRUE WHERE id_registro = $1`,
        [actual.id_registro]
    );

    const texto = construirTextoAlertaConflicto({
        tipoRegistro: registro.tipo_registro,
        idLocal: registro.id_local,
        idUsuario,
        versionBase: registro.base_version,
        versionCentral: actual.version,
        idVersionConflicto,
    });
    await cliente.query(
        `/* sync:insert-alerta */
         INSERT INTO alertas_sistema (tipo, severidad, titulo, descripcion, id_articulo, id_orden_compra, leida)
         VALUES ('conflicto_sincronizacion', 'rojo', $1, $2, NULL, NULL, FALSE)`,
        [texto.titulo, texto.descripcion]
    );
    await registrarAuditoria(
        {
            entidad: 'sync_registro',
            accion: 'conflicto_sincronizacion',
            idRegistro: actual.id_registro,
            idUsuarioEjecutor: idUsuario,
            estadoAnterior: { version: actual.version, datos: actual.datos },
            estadoNuevo: { version_movil_en_conflicto: idVersionConflicto, datos: registro.datos },
            descripcion: texto.descripcion,
        },
        cliente
    );

    return {
        ...base,
        estado: 'conflicto',
        codigo: 'CONFLICTO_VERSION',
        mensaje:
            'El registro fue modificado en la central. Se conservaron ambas versiones y se avisó al Administrador.',
        id_registro: actual.id_registro,
        version_central: actual.version,
        id_version_conflicto: idVersionConflicto,
        fotos_guardadas: fotos,
    };
};

/** POST /api/sincronizacion/lote — acepta hasta 10 registros con fotos de hasta 5 MB cada una. */
export const sincronizarLote = async (req: Request, res: Response): Promise<void> => {
    try {
        const idUsuario = obtenerIdEjecutor(req);
        const registros: unknown = req.body?.registros;

        if (!Array.isArray(registros) || registros.length === 0) {
            throw new ErrorAplicacion(400, 'Debes enviar "registros" con al menos un elemento');
        }
        if (registros.length > MAX_REGISTROS_POR_LOTE) {
            throw new ErrorAplicacion(400, `Máximo ${MAX_REGISTROS_POR_LOTE} registros por lote`);
        }

        const validados = registros.map((r) => validarRegistroEntrante(r));
        const bytesLote = validados.reduce(
            (suma, v) => (v.ok ? suma + v.valor.fotos.reduce((s, f) => s + f.tamano_bytes, 0) : suma),
            0
        );
        if (bytesLote > MAX_BYTES_LOTE) {
            throw new ErrorAplicacion(413, 'El lote supera el tamaño máximo de fotos; envíalo en lotes más pequeños');
        }

        const resultados: ResultadoSincronizacionRegistro[] = [];
        for (const validacion of validados) {
            if (!validacion.ok) {
                resultados.push({
                    id_local: validacion.id_local,
                    id_envio: validacion.id_envio,
                    estado: 'rechazado',
                    codigo: validacion.codigo,
                    mensaje: validacion.mensaje,
                });
                continue;
            }
            try {
                resultados.push(
                    await ejecutarTransaccion((cliente) =>
                        procesarRegistroSincronizadoEnTransaccion(cliente, validacion.valor, idUsuario)
                    )
                );
            } catch (error) {
                console.error('Error al sincronizar registro offline:', error);
                // Falla técnica: el registro NO se confirma, el móvil lo conserva y reintenta.
                resultados.push({
                    id_local: validacion.valor.id_local,
                    id_envio: validacion.valor.id_envio,
                    estado: 'error',
                    codigo: 'ERROR_INTERNO',
                    mensaje: 'No se pudo guardar este registro; permanece pendiente en el dispositivo.',
                });
            }
        }

        const resumen = {
            total: resultados.length,
            sincronizados: resultados.filter((r) => r.estado === 'sincronizado' || r.estado === 'duplicado').length,
            conflictos: resultados.filter((r) => r.estado === 'conflicto').length,
            rechazados: resultados.filter((r) => r.estado === 'rechazado').length,
            errores: resultados.filter((r) => r.estado === 'error').length,
        };
        const hayRechazoFoto = resultados.some((r) => r.codigo === 'FOTO_EXCEDE_5MB');
        const aceptados = resumen.total - resumen.rechazados - resumen.errores;

        // 413 si todo el lote fue rechazado por fotos > 5 MB; 207 si el resultado es mixto.
        const estadoHttp = hayRechazoFoto && aceptados === 0 ? 413 : resumen.rechazados + resumen.errores > 0 ? 207 : 200;
        res.status(estadoHttp).json({ resumen, resultados });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al sincronizar el lote');
    }
};

/** PUT /api/sincronizacion/registros/:id — edición desde la central (web). Crea una versión nueva. */
export const editarRegistroCentral = async (req: Request, res: Response): Promise<void> => {
    try {
        const idRegistro = Number(req.params.id);
        const datos: unknown = req.body?.datos;
        const versionEsperada = req.body?.version_esperada;
        const idUsuario = obtenerIdEjecutor(req);

        if (!Number.isInteger(idRegistro) || idRegistro <= 0) throw new ErrorAplicacion(400, 'Identificador inválido');
        if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
            throw new ErrorAplicacion(400, 'datos debe ser un objeto con los campos del registro');
        }

        const resultado = await ejecutarTransaccion(async (cliente) => {
            const actual = await cliente.query<FilaRegistro>(
                `SELECT id_registro, version, datos, id_usuario_creador
                 FROM sync_registro WHERE id_registro = $1 FOR UPDATE`,
                [idRegistro]
            );
            const fila = actual.rows[0];
            if (!fila) throw new ErrorAplicacion(404, 'Registro no encontrado');
            if (versionEsperada !== undefined && Number(versionEsperada) !== fila.version) {
                throw new ErrorAplicacion(409, `El registro cambió (versión actual ${fila.version}). Recárgalo antes de editar.`);
            }

            await cliente.query(
                `UPDATE sync_registro_version SET estado = 'historica'
                 WHERE id_registro = $1 AND estado = 'vigente'`,
                [idRegistro]
            );
            const nuevaVersion = fila.version + 1;
            await insertarVersion(cliente, {
                idRegistro,
                numeroVersion: nuevaVersion,
                estado: 'vigente',
                origen: 'central',
                baseVersion: fila.version,
                idEnvio: null,
                idUsuario,
                contenido: datos as Record<string, unknown>,
                fechaCliente: null,
            });
            await cliente.query(
                `UPDATE sync_registro
                 SET datos = $2::jsonb, version = $3, origen_ultima_modificacion = 'central',
                     id_usuario_ultima_modificacion = $4, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_registro = $1`,
                [idRegistro, JSON.stringify(datos), nuevaVersion, idUsuario]
            );
            await registrarAuditoria(
                {
                    entidad: 'sync_registro',
                    accion: 'editar_central',
                    idRegistro,
                    idUsuarioEjecutor: idUsuario,
                    estadoAnterior: { version: fila.version, datos: fila.datos },
                    estadoNuevo: { version: nuevaVersion, datos },
                },
                cliente
            );
            return { id_registro: idRegistro, version: nuevaVersion };
        });

        res.status(200).json(resultado);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al editar el registro');
    }
};

/** GET /api/sincronizacion/registros/:id — registro vigente + historial de versiones y fotos (sin binarios). */
export const obtenerRegistroSincronizado = async (req: Request, res: Response): Promise<void> => {
    try {
        const idRegistro = Number(req.params.id);
        if (!Number.isInteger(idRegistro) || idRegistro <= 0) throw new ErrorAplicacion(400, 'Identificador inválido');

        const registro = await pool.query(
            `SELECT id_registro, tipo_registro, id_local, id_usuario_creador, datos, version,
                    origen_ultima_modificacion, tiene_conflicto, fecha_creacion, fecha_actualizacion
             FROM sync_registro WHERE id_registro = $1`,
            [idRegistro]
        );
        const fila = registro.rows[0];
        if (!fila) throw new ErrorAplicacion(404, 'Registro no encontrado');

        const payload = typeof req.usuario === 'object' ? req.usuario : null;
        const esAdmin = normalizarRol(payload?.rol) === 'admin';
        if (!esAdmin && Number(fila.id_usuario_creador) !== obtenerIdEjecutor(req)) {
            throw new ErrorAplicacion(403, 'No tienes permiso para ver este registro');
        }

        const versiones = await pool.query(
            `SELECT v.id_version, v.numero_version, v.estado, v.origen, v.base_version, v.id_usuario,
                    v.datos, v.fecha_cliente, v.fecha_recepcion,
                    COALESCE((SELECT json_agg(json_build_object(
                        'id_foto', f.id_foto, 'nombre', f.nombre, 'mime_type', f.mime_type, 'tamano_bytes', f.tamano_bytes
                    ) ORDER BY f.id_foto) FROM sync_foto f WHERE f.id_version = v.id_version), '[]'::json) AS fotos
             FROM sync_registro_version v
             WHERE v.id_registro = $1
             ORDER BY v.id_version`,
            [idRegistro]
        );
        res.status(200).json({ registro: fila, versiones: versiones.rows });
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al obtener el registro');
    }
};

/** GET /api/sincronizacion/conflictos — Administrador: ambas versiones lado a lado. */
export const listarConflictosSincronizacion = async (_req: Request, res: Response): Promise<void> => {
    try {
        const conflictos = await pool.query(
            `SELECT v.id_version AS id_version_conflicto, r.id_registro, r.tipo_registro, r.id_local,
                    r.version AS version_central, r.datos AS datos_central,
                    v.base_version, v.datos AS datos_movil, v.id_usuario AS id_usuario_movil,
                    v.fecha_cliente, v.fecha_recepcion,
                    COALESCE((SELECT json_agg(json_build_object(
                        'id_foto', f.id_foto, 'nombre', f.nombre, 'tamano_bytes', f.tamano_bytes
                    ) ORDER BY f.id_foto) FROM sync_foto f WHERE f.id_version = v.id_version), '[]'::json) AS fotos_movil
             FROM sync_registro_version v
             JOIN sync_registro r ON r.id_registro = v.id_registro
             WHERE v.estado = 'conflicto'
             ORDER BY v.fecha_recepcion DESC`
        );
        res.status(200).json(conflictos.rows);
    } catch (error) {
        enviarErrorHttp(res, error, 'Error al listar conflictos de sincronización');
    }
};
