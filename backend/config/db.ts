import path from 'path';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';

types.setTypeParser(1082, (valor: string) => valor);

// Carga backend/.env asegurando prioridad sobre variables previas del entorno
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

if (!process.env.DB_PASSWORD) {
    console.warn('⚠️ [Advertencia DB] La variable DB_PASSWORD no está definida en backend/.env');
}

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'fyag_db',
    password: String(process.env.DB_PASSWORD ?? ''),
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
});

export default pool;
