import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { validarConfiguracionEntorno } from './config/entorno';

const rutaEnvLocal = path.resolve(__dirname, '.env');
const rutaEnvPadre = path.resolve(__dirname, '../.env');
dotenv.config({ path: fs.existsSync(rutaEnvLocal) ? rutaEnvLocal : rutaEnvPadre });

const iniciarServidor = async (): Promise<void> => {
    const configuracion = validarConfiguracionEntorno();
    const [{ app }, { default: pool }, { aplicarMigraciones }, prestamos, mantenimiento, respaldos] =
        await Promise.all([
            import('./app'),
            import('./config/db'),
            import('./services/migraciones'),
            import('./controllers/prestamoHerramientaController'),
            import('./controllers/mantenimientoHerramientaController'),
            import('./controllers/respaldoController'),
        ]);

    const probarConexion = async (): Promise<void> => {
        const res = await pool.query<{ now: Date }>('SELECT NOW()');
        console.log('--------------------------------------------------');
        console.log('✅ Conexión a PostgreSQL establecida exitosamente');
        console.log(`🕒 Hora actual del servidor DB: ${res.rows[0].now}`);
        console.log('--------------------------------------------------');
    };

    await aplicarMigraciones();
    app.listen(configuracion.port, '0.0.0.0', () => {
        console.log(`Servidor en puerto ${configuracion.port}`);
        prestamos.iniciarProcesoDiarioPrestamos();
        mantenimiento.iniciarJobDiarioMantenimiento();
        respaldos.iniciarJobDiarioRespaldos();
        void probarConexion().catch((error: unknown) => {
            const mensaje = error instanceof Error ? error.message : String(error);
            console.error('❌ Error al conectar a PostgreSQL:', mensaje);
        });
    });
};

iniciarServidor().catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error('❌ No se pudo iniciar el backend:', mensaje);
    process.exit(1);
});
