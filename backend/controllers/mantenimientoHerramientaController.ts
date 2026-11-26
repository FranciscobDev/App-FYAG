import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { obtenerIdEjecutor } from '../middleware/authMiddleware';
import { registrarAuditoria } from '../services/auditoriaService';
import { ErrorAplicacion, enviarErrorHttp } from '../services/errores';
import {
    aIsoFecha,
    avisoMantenimientoPendiente,
    diasHastaVencimiento,
    hoyIso,
} from '../services/mantenimientoHerramientaService';
import { ejecutarTransaccion } from '../services/transaccion';
import { crearAlertaConDespachoOpcionalEnTransaccion } from './alertaController';
import { validarFechaIsoOpcional } from './herramientaController';

type Cliente = Pick<PoolClient, 'query'>;
const MS_DIA = 24 * 60 * 60 * 1000;

const leerParametro = async (c: Cliente, clave: string, defecto: number): Promise<number> => {
    const r = await c.query(`/* mant:param */ SELECT valor FROM parametro_sistema WHERE clave = $1`, [clave]);
    return r.rows[0] ? Number(r.rows[0].valor) : defecto;
};

/** Job diario: avisa en el sistema (H40) y por correo al Administrador 7 y 1 día antes (H39). */
export const procesarAvisosMantenimientoEnTransaccion = async (cliente: Cliente, hoy: string = hoyIso()) => {
    const diasPrevio = await leerParametro(cliente, 'dias_aviso_mantenimiento_previo', 7);
    const diasFinal = await leerParametro(cliente, 'dias_aviso_mantenimiento_final', 1);

    const cand = await cliente.query(
        `/* mant:candidatas */
         SELECT id_herramienta, codigo_herramienta, nombre, fecha_proximo_mantenimiento,
                aviso_mant_previo_para, aviso_mant_final_para
         FROM herramientas
         WHERE activo = TRUE AND estado <> 'dada de baja' AND fecha_proximo_mantenimiento IS NOT NULL`
    );

    const avisos: { id_herramienta: number; aviso: string; dias: number; correo_enviado: boolean }[] = [];
    for (const h of cand.rows) {
        const fecha = aIsoFecha(h.fecha_proximo_mantenimiento) as string;
        const dias = diasHastaVencimiento(fecha, hoy);
        const aviso = avisoMantenimientoPendiente(dias, diasPrevio, diasFinal, {
            previo: aIsoFecha(h.aviso_mant_previo_para) === fecha,
            final: aIsoFecha(h.aviso_mant_final_para) === fecha,
        });
        if (!aviso) continue;

        const cuando = dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `vence en ${dias} días`;
        const alerta = await crearAlertaConDespachoOpcionalEnTransaccion(cliente, {
            tipo: 'mantenimiento_herramienta_proximo',
            severidad: aviso === 'final' ? 'rojo' : 'amarillo',
            titulo: `Mantenimiento de herramienta ${cuando}: ${h.codigo_herramienta}`,
            descripcion: `${h.nombre}: mantenimiento programado para el ${fecha} (${cuando}).`,
            rol_destino: 'admin',
            enviar_correo: true,
        });

        const columna = aviso === 'final' ? 'aviso_mant_final_para' : 'aviso_mant_previo_para';
        await cliente.query(
            `/* mant:marcar-${aviso} */ UPDATE herramientas SET ${columna} = $1 WHERE id_herramienta = $2`,
            [fecha, h.id_herramienta]
        );
        avisos.push({ id_herramienta: h.id_herramienta, aviso, dias, correo_enviado: alerta.correo_enviado });
    }
    return { dias_previo: diasPrevio, dias_final: diasFinal, avisos_generados: avisos.length, avisos };
};

/** Registra el mantenimiento realizado, programa la siguiente fecha y limpia el estado vencido. */
export const registrarMantenimientoEnTransaccion = async (
    cliente: Cliente,
    idHerramienta: number,
    datos: { fecha_realizada?: string | null; fecha_siguiente: unknown; observacion?: string },
    idUsuario: number | null,
    hoy: string = hoyIso()
) => {
    const realizada = validarFechaIsoOpcional(datos.fecha_realizada) ?? hoy;
    const siguiente = validarFechaIsoOpcional(datos.fecha_siguiente);
    if (!siguiente) throw new ErrorAplicacion(400, 'Debes indicar la fecha del siguiente mantenimiento');
    if (siguiente <= realizada) {
        throw new ErrorAplicacion(400, 'La fecha siguiente debe ser posterior al mantenimiento realizado');
    }

    const r = await cliente.query('SELECT * FROM herramientas WHERE id_herramienta = $1 FOR UPDATE', [idHerramienta]);
    const h = r.rows[0];
    if (!h) throw new ErrorAplicacion(404, 'Herramienta no encontrada');
    if (h.estado === 'dada de baja') throw new ErrorAplicacion(409, 'No se puede registrar mantenimiento a una herramienta dada de baja');

    const mant = await cliente.query(
        `INSERT INTO mantenimientos_herramienta
            (id_herramienta, fecha_realizada, fecha_programada_anterior, fecha_siguiente, observacion, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [idHerramienta, realizada, aIsoFecha(h.fecha_proximo_mantenimiento), siguiente, datos.observacion ?? null, idUsuario]
    );
    // Sale de "en mantención" (si estaba) y se re-armaron los avisos para la nueva fecha
    const upd = await cliente.query(
        `UPDATE herramientas SET fecha_proximo_mantenimiento = $1,
                estado = CASE WHEN estado = 'en mantención' THEN 'disponible' ELSE estado END,
                aviso_mant_previo_para = NULL, aviso_mant_final_para = NULL,
                fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_herramienta = $2 RETURNING *`,
        [siguiente, idHerramienta]
    );

    await registrarAuditoria(
        {
            entidad: 'herramienta',
            accion: 'registrar_mantenimiento',
            idRegistro: idHerramienta,
            idUsuarioEjecutor: idUsuario,
            estadoAnterior: { estado: h.estado, fecha_proximo_mantenimiento: aIsoFecha(h.fecha_proximo_mantenimiento) },
            estadoNuevo: { estado: upd.rows[0]?.estado, fecha_proximo_mantenimiento: siguiente },
            descripcion: `Mantenimiento realizado el ${realizada}; próximo: ${siguiente}`,
        },
        cliente as PoolClient
    );

    return { mantenimiento: mant.rows[0], herramienta: upd.rows[0] };
};

export const registrarMantenimiento = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ mensaje: 'ID de herramienta inválido' });
            return;
        }
        const b = req.body ?? {};
        const r = await ejecutarTransaccion((c) =>
            registrarMantenimientoEnTransaccion(c, id, b, obtenerIdEjecutor(req))
        );
        res.status(201).json({ ok: true, mensaje: 'Mantenimiento registrado y próxima fecha actualizada', ...r });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al registrar el mantenimiento');
    }
};

export const ejecutarJobMantenimiento = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ ok: true, ...(await ejecutarTransaccion((c) => procesarAvisosMantenimientoEnTransaccion(c))) });
    } catch (e) {
        enviarErrorHttp(res, e, 'Error al ejecutar el job de mantenimiento');
    }
};

let temporizador: NodeJS.Timeout | null = null;
export const iniciarJobDiarioMantenimiento = (): void => {
    if (temporizador) return;
    const correr = () =>
        ejecutarTransaccion((c) => procesarAvisosMantenimientoEnTransaccion(c)).catch((e) =>
            console.error('Error en job diario de mantenimiento de herramientas', e)
        );
    setTimeout(correr, 10_000).unref();
    temporizador = setInterval(correr, MS_DIA);
    temporizador.unref();
};
