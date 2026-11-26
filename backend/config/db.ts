import path from 'path';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';

types.setTypeParser(1082, (valor: string) => valor);

// Carga backend/.env como fallback; variables inyectadas por el entorno tienen prioridad.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    max: 10,
    idleTimeoutMillis: 30000,
});

export default pool;
