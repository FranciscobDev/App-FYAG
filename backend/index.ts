import dotenv from 'dotenv';
dotenv.config();

import pool from './config/db';
import { app } from './app';
import { aplicarMigraciones } from './services/migraciones';

const PORT = Number(process.env.PORT) || 3000;

const probarConexion = async (): Promise<void> => {
    try {
        const res = await pool.query<{ now: Date }>('SELECT NOW()');
        console.log('--------------------------------------------------');
        console.log('✅ Conexión a PostgreSQL establecida exitosamente');
        console.log(`🕒 Hora actual del servidor DB: ${res.rows[0].now}`);
        console.log('--------------------------------------------------');
    } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        console.error('❌ Error al conectar a PostgreSQL:', mensaje);
    }
};

// Las migraciones son idempotentes: se aplican antes de aceptar tráfico
aplicarMigraciones()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Servidor en puerto ${PORT}`);
            probarConexion();
        });
    })
    .catch((error) => {
        console.error('❌ No se pudieron aplicar las migraciones; el servidor no arranca:', error);
        process.exit(1);
    });
