import type { PoolClient } from 'pg';
import pool from '../config/db';
import { registrarAuditoria } from './auditoriaService';
import { ejecutarTransaccion } from './transaccion';
import { ErrorAplicacion } from './errores';

export interface Parametro {
    clave: string;
    descripcion: string;
    valor: number;
    valor_minimo: number;
    valor_maximo: number;
    unidad: string;
    fecha_actualizacion: string;
}

/**
 * Valida que `valor` sea un entero dentro de [minimo, maximo].
 * Acepta número o texto numérico; rechaza decimales, texto no numérico y valores fuera de rango.
 */
export const validarValorParametro = (valor: unknown, clave: string, minimo: number, maximo: number): number => {
    let numero: number;
    if (typeof valor === 'number') {
        numero = valor;
    } else if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) {
        numero = Number(valor.trim());
    } else {
        throw new ErrorAplicacion(400, `El valor de ${clave} debe ser un número entero`);
    }

    if (!Number.isSafeInteger(numero)) {
        throw new ErrorAplicacion(400, `El valor de ${clave} debe ser un número entero`);
    }
    if (numero < minimo || numero > maximo) {
        throw new ErrorAplicacion(400, `El valor de ${clave} debe estar entre ${minimo} y ${maximo}`);
    }
    return numero;
};

/**
 * Lee el valor vigente desde la BD en cada llamada (sin caché), así un cambio
 * administrativo se aplica de inmediato en el siguiente login.
 */
export const obtenerValorParametro = async (clave: string): Promise<number> => {
    const res = await pool.query<{ valor: number }>(
        'SELECT valor FROM parametro_sistema WHERE clave = $1',
        [clave]
    );
    if (!res.rows[0]) {
        throw new Error(`Parámetro del sistema no existe: ${clave}`);
    }
    return Number(res.rows[0].valor);
};

export const listarParametros = async (): Promise<Parametro[]> => {
    const res = await pool.query<Parametro>(
        `SELECT clave, descripcion, valor, valor_minimo, valor_maximo, unidad, fecha_actualizacion
         FROM parametro_sistema
         ORDER BY clave ASC`
    );
    return res.rows;
};

export const actualizarParametro = async (
    clave: string,
    valorNuevo: unknown,
    idUsuarioEjecutor: number | null
): Promise<Parametro> => {
    return ejecutarTransaccion(async (cliente: PoolClient) => {
        const actual = await cliente.query<Parametro>(
            `SELECT clave, descripcion, valor, valor_minimo, valor_maximo, unidad, fecha_actualizacion
             FROM parametro_sistema WHERE clave = $1 FOR UPDATE`,
            [clave]
        );
        const anterior = actual.rows[0];
        if (!anterior) {
            throw new ErrorAplicacion(404, `No existe el parámetro ${clave}`);
        }

        // Si el valor es inválido se lanza antes del UPDATE: no hay cambio ni auditoría
        const valor = validarValorParametro(valorNuevo, clave, anterior.valor_minimo, anterior.valor_maximo);

        const actualizado = await cliente.query<Parametro>(
            `UPDATE parametro_sistema
             SET valor = $2, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE clave = $1
             RETURNING clave, descripcion, valor, valor_minimo, valor_maximo, unidad, fecha_actualizacion`,
            [clave, valor]
        );
        const nuevo = actualizado.rows[0];

        await registrarAuditoria({
            entidad: 'parametro',
            accion: 'editar',
            idRegistro: null, // los parámetros se identifican por clave, no por ID numérico
            idUsuarioEjecutor,
            estadoAnterior: { clave, valor: anterior.valor },
            estadoNuevo: { clave, valor: nuevo.valor },
            descripcion: `Parámetro ${clave} cambiado de ${anterior.valor} a ${nuevo.valor}`,
        }, cliente);

        return nuevo;
    });
};
