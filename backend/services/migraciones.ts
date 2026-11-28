import fs from 'fs';
import path from 'path';
import pool from '../config/db';

/**
 * Aplica los scripts de backend/migraciones en orden alfabético.
 * Cada script es idempotente (IF NOT EXISTS / ON CONFLICT), así que es seguro en cada arranque
 * sobre bases creadas de forma incremental.
 *
 * Si la base se aprovisionó con el esquema consolidado (estructura_db.md), ese esquema ya incluye
 * todas las migraciones: define APLICAR_MIGRACIONES=false para omitirlas.
 */
export const aplicarMigraciones = async (): Promise<void> => {
    if (process.env.APLICAR_MIGRACIONES?.trim().toLowerCase() === 'false') {
        console.log('⏭️  Migraciones omitidas (APLICAR_MIGRACIONES=false): el esquema ya está aprovisionado');
        return;
    }

    const carpetaLocal = path.resolve(__dirname, '../migraciones');
    const carpetaRaiz = path.resolve(process.cwd(), 'migraciones');
    const carpeta = fs.existsSync(carpetaLocal) ? carpetaLocal : carpetaRaiz;
    const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();

    for (const archivo of archivos) {
        const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
        await pool.query(sql);
        console.log(`✅ Migración aplicada: ${archivo}`);
    }
};
