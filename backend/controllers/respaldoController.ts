import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/db';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { enviarErrorHttp } from '../services/errores';
import {
    EjecutorRespaldo,
    clasificarErrorRespaldo,
    cumpleRto,
    evaluarPruebaRestauracion,
    evaluarRpo,
    msHastaProximaVentana,
    obtenerEjecutorRespaldo,
    validarPruebaRestauracion,
} from '../services/respaldoMonitorService';
import { ejecutarTransaccion } from '../services/transaccion';
import { crearAlertaConDespachoOpcionalEnTransaccion } from './alertaController';

type Cliente = Pick<PoolClient, 'query'>;

const leerParametro = async (c: Cliente, clave: string, defecto: number): Promise<number> => {
    const r = await c.query(`/* resp:param */ SELECT valor FROM parametro_sistema WHERE clave = $1`, [clave]);
    const v = Number(r.rows[0]?.valor);
    return Number.isFinite(v) && v > 0 ? v : defecto;
};

const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

/**
 * Ejecuta el respaldo bajo monitoreo: registra SIEMPRE el resultado (éxito o fallo) y, ante un fallo,
 * alerta de inmediato al Administrador en el sistema y por correo.
 */
export const ejecutarRespaldoMonitoreado = async (
    cliente: Cliente,
    opciones: { origen?: 'automatico' | 'manual'; idUsuario?: number | null; ejecutor?: EjecutorRespaldo; ahora?: () => Date } = {}
) => {
    const ahora = opciones.ahora ?? (() => new Date());
    const ejecutor = opciones.ejecutor ?? obtenerEjecutorRespaldo();
    const diasRetencion = await leerParametro(cliente, 'dias_retencion_respaldos', 30);

    const inicio = ahora();
    let estado: 'exito' | 'fallo' = 'exito';
    let resultado: { tamano_bytes: number; ubicacion_nube: string; cifrado: boolean } | null = null;
    let error: { codigo: string; mensaje: string } | null = null;

    try {
        resultado = await ejecutor({ dias_retencion: diasRetencion });
        if (!resultado.cifrado) {
            // El respaldo debe guardarse cifrado: uno en claro se considera fallido
            error = { codigo: 'NO_CIFRADO', mensaje: 'El respaldo no se guardó cifrado' };
            estado = 'fallo';
        }
    } catch (e) {
        error = clasificarErrorRespaldo(e);
        estado = 'fallo';
    }
    const fin = ahora();

    const ins = await cliente.query(
        `/* resp:insert */ INSERT INTO respaldos_ejecucion
            (origen, estado, fecha_inicio, fecha_fin, duracion_ms, tamano_bytes, ubicacion_nube, cifrado, codigo_error, mensaje_error, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
            opciones.origen ?? 'automatico', estado, inicio, fin, Math.max(fin.getTime() - inicio.getTime(), 0),
            resultado?.tamano_bytes ?? null, resultado?.ubicacion_nube ?? null, resultado?.cifrado ?? false,
            error?.codigo ?? null, error?.mensaje ?? null, opciones.idUsuario ?? null,
        ]
    );

    let alerta = null;
    if (estado === 'fallo' && error) {
        alerta = await crearAlertaConDespachoOpcionalEnTransaccion(cliente, {
            tipo: 'respaldo_fallido',
            severidad: 'rojo',
            titulo: `Falló el respaldo de la base de datos (${error.codigo})`,
            descripcion: `Respaldo ${opciones.origen ?? 'automatico'} del ${fmt(inicio)} UTC: ${error.mensaje}`,
            rol_destino: 'admin',
            enviar_correo: true,
        });
    }
    return { respaldo: ins.rows[0], estado, alerta_generada: alerta };
};

/** Estado de salud: RPO (24 h) y prueba de restauración vigente; alerta una vez al día si algo incumple. */
export const verificarSaludRespaldosEnTransaccion = async (cliente: Cliente, ahoraMs: number = Date.now()) => {
    const horasRpo = await leerParametro(cliente, 'horas_max_perdida_datos', 24);
    const diasPrueba = await leerParametro(cliente, 'dias_prueba_restauracion', 90);

    const ult = await cliente.query(
        `/* resp:ultimo-exito */ SELECT MAX(fecha_fin) AS fecha FROM respaldos_ejecucion WHERE estado = 'exito'`
    );
    const prueba = await cliente.query(
        `/* resp:ultima-prueba */ SELECT MAX(fecha_prueba) AS fecha FROM pruebas_restauracion WHERE resultado = 'exitosa'`
    );
    const rpo = evaluarRpo(ult.rows[0]?.fecha ?? null, horasRpo, ahoraMs);
    const pr = evaluarPruebaRestauracion(prueba.rows[0]?.fecha ?? null, diasPrueba, ahoraMs);

    const alertas: string[] = [];
    const avisar = async (tipo: string, titulo: string, descripcion: string) => {
        const rec = await cliente.query(
            `/* resp:alerta-reciente */ SELECT 1 FROM alertas_sistema
             WHERE tipo = $1 AND fecha_creacion > NOW() - INTERVAL '20 hours' LIMIT 1`,
            [tipo]
        );
        if (rec.rows[0]) return;
        await crearAlertaConDespachoOpcionalEnTransaccion(cliente, {
            tipo, severidad: 'amarillo', titulo, descripcion, rol_destino: 'admin', enviar_correo: true,
        });
        alertas.push(tipo);
    };
    if (!rpo.cumple) {
        await avisar(
            'respaldo_desactualizado',
            `Sin respaldo exitoso en las últimas ${horasRpo} horas`,
            rpo.horas_desde_ultimo_exito === null
                ? 'Nunca se registró un respaldo exitoso.'
                : `Último respaldo exitoso hace ${rpo.horas_desde_ultimo_exito} horas (objetivo RPO: ${horasRpo} h).`
        );
    }
    if (!pr.vigente) {
        await avisar(
            'prueba_restauracion_pendiente',
            'Prueba trimestral de restauración vencida',
            pr.dias_desde_ultima === null
                ? 'No hay pruebas de restauración exitosas documentadas.'
                : `La última prueba exitosa fue hace ${pr.dias_desde_ultima} días (máximo ${diasPrueba}).`
        );
    }
    return { rpo: { ...rpo, horas_max: horasRpo }, prueba_restauracion: { ...pr, dias_max: diasPrueba }, alertas_generadas: alertas };
};

export const registrarPruebaRestauracionEnTransaccion = async (
    cliente: Cliente,
    body: Record<string, unknown>,
    idUsuario: number | null,
    hoy: string = new Date().toISOString().slice(0, 10)
) => {
    const d = validarPruebaRestauracion(body, hoy);
    const horasRto = await leerParametro(cliente, 'horas_max_recuperacion', 4);
    const cumple = d.resultado === 'exitosa' && cumpleRto(d.tiempo_recuperacion_min, horasRto);

    const ins = await cliente.query(
        `/* resp:insert-prueba */ INSERT INTO pruebas_restauracion
            (fecha_prueba, id_respaldo, resultado, tiempo_recuperacion_min, cumple_rto, observaciones, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [d.fecha_prueba, d.id_respaldo, d.resultado, d.tiempo_recuperacion_min, cumple, d.observaciones, idUsuario]
    );
    await registrarAuditoria(
        {
            entidad: 'respaldo',
            accion: 'registrar_prueba_restauracion',
            idRegistro: ins.rows[0]?.id_prueba ?? null,
            idUsuarioEjecutor: idUsuario,
            estadoAnterior: null,
            estadoNuevo: { ...d, cumple_rto: cumple, rto_horas: horasRto },
            descripcion: `Prueba de restauración ${d.resultado} en ${d.tiempo_recuperacion_min} min (RTO ${horasRto} h)`,
        },
        cliente as PoolClient
    );
    return { prueba: ins.rows[0], cumple_rto: cumple, rto_horas: horasRto };
};

// ---- Handlers HTTP (Administrador) ----
export const ejecutarRespaldoManual = async (req: Request, res: Response): Promise<void> => {
    try {
        const r = await ejecutarTransaccion((c) =>
            ejecutarRespaldoMonitoreado(c, { origen: 'manual', idUsuario: obtenerIdEjecutor(req) })
        );
        res.status(r.estado === 'exito' ? 201 : 502).json({ ok: r.estado === 'exito', ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al ejecutar el respaldo');
    }
};

export const estadoRespaldos = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [hist, salud] = await Promise.all([
            pool.query('SELECT * FROM respaldos_ejecucion ORDER BY fecha_inicio DESC LIMIT 60'),
            verificarSaludSoloLectura(),
        ]);
        res.status(200).json({ ok: true, salud, ejecuciones: hist.rows });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al consultar los respaldos');
    }
};

const verificarSaludSoloLectura = async () => {
    const horasRpo = await leerParametro(pool, 'horas_max_perdida_datos', 24);
    const diasPrueba = await leerParametro(pool, 'dias_prueba_restauracion', 90);
    const ult = await pool.query(`SELECT MAX(fecha_fin) AS fecha FROM respaldos_ejecucion WHERE estado = 'exito'`);
    const pr = await pool.query(`SELECT MAX(fecha_prueba) AS fecha FROM pruebas_restauracion WHERE resultado = 'exitosa'`);
    return {
        rpo: { ...evaluarRpo(ult.rows[0]?.fecha ?? null, horasRpo, Date.now()), horas_max: horasRpo },
        prueba_restauracion: { ...evaluarPruebaRestauracion(pr.rows[0]?.fecha ?? null, diasPrueba, Date.now()), dias_max: diasPrueba },
    };
};

export const registrarPruebaRestauracion = async (req: Request, res: Response): Promise<void> => {
    try {
        const r = await ejecutarTransaccion((c) =>
            registrarPruebaRestauracionEnTransaccion(c, req.body ?? {}, obtenerIdEjecutor(req))
        );
        res.status(201).json({ ok: true, mensaje: 'Prueba de restauración documentada', ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al registrar la prueba de restauración');
    }
};

export const listarPruebasRestauracion = async (_req: Request, res: Response): Promise<void> => {
    try {
        const r = await pool.query('SELECT * FROM pruebas_restauracion ORDER BY fecha_prueba DESC, id_prueba DESC');
        res.status(200).json({ ok: true, total: r.rows.length, pruebas: r.rows });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al consultar las pruebas de restauración');
    }
};

// ---- Job diario en horario de baja actividad (02:00 local) ----
let temporizador: NodeJS.Timeout | null = null;
export const iniciarJobDiarioRespaldos = (): void => {
    if (temporizador) return;
    const MS_DIA = 24 * 3600 * 1000;
    const correr = () =>
        ejecutarTransaccion(async (c) => {
            await ejecutarRespaldoMonitoreado(c, { origen: 'automatico' });
            await verificarSaludRespaldosEnTransaccion(c);
        }).catch((e) => console.error('Error en el job diario de respaldos', e));
    const primera = setTimeout(() => {
        correr();
        temporizador = setInterval(correr, MS_DIA);
        temporizador.unref();
    }, msHastaProximaVentana(new Date()));
    primera.unref();
    temporizador = primera;
};
