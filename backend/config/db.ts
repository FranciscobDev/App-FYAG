import path from 'path';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import { resolverSslBaseDatos } from './entorno';

types.setTypeParser(1082, (valor: string) => valor);

// Carga backend/.env como fallback; variables inyectadas por el entorno tienen prioridad.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: resolverSslBaseDatos(process.env),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
});

export default pool;
