import type { PoolClient } from 'pg';
import pool from '../config/db';

/**
 * Ejecuta `fn` dentro de una transacción. Si `fn` lanza, se hace ROLLBACK,
 * de modo que la mutación y su registro de auditoría son atómicos.
 */
export const ejecutarTransaccion = async <T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> => {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await fn(cliente);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        cliente.release();
    }
};
