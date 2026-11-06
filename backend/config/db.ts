import path from 'path';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';

types.setTypeParser(1082, (valor: string) => valor);

// Carga backend/.env asegurando prioridad sobre variables previas del entorno
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
});

export default pool;
