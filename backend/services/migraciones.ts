import fs from 'fs';
import path from 'path';
import pool from '../config/db';

/**
 * Aplica los scripts de backend/migraciones en orden alfabético.
 * Cada script es idempotente (IF NOT EXISTS / ON CONFLICT), así que es seguro en cada arranque.
 */
export const aplicarMigraciones = async (): Promise<void> => {
    const carpeta = path.resolve(__dirname, '../migraciones');
    const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();

    for (const archivo of archivos) {
        const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
        await pool.query(sql);
        console.log(`✅ Migración aplicada: ${archivo}`);
    }
};
